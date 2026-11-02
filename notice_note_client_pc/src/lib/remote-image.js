// 远程图片下载与 SSRF 防护
const path = require('node:path');
const dns = require('node:dns/promises');
const nodeNet = require('node:net');
const { net: electronNet } = require('electron');

const MAX_REMOTE_IMAGE_BYTES = 20 * 1024 * 1024;
const REMOTE_IMAGE_TIMEOUT = 15 * 1000;
const MAX_REMOTE_IMAGE_REDIRECTS = 5;

function isPathInside(parentPath, targetPath) {
  const relativePath = path.relative(parentPath, targetPath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function isPrivateIpv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [first, second] = parts;
  return first === 0
    || first === 10
    || first === 127
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 198 && [18, 19].includes(second))
    || first >= 224;
}

function isPrivateIpAddress(address) {
  const normalizedAddress = String(address || '').toLowerCase().split('%')[0];
  if (nodeNet.isIPv4(normalizedAddress)) {
    return isPrivateIpv4(normalizedAddress);
  }
  if (!nodeNet.isIPv6(normalizedAddress)) {
    return true;
  }

  const mappedIpv4 = /^::ffff:(\d+(?:\.\d+){3})$/.exec(normalizedAddress);
  if (mappedIpv4) {
    return isPrivateIpv4(mappedIpv4[1]);
  }
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(normalizedAddress);
  if (mappedHex) {
    const value = (Number.parseInt(mappedHex[1], 16) << 16) | Number.parseInt(mappedHex[2], 16);
    return isPrivateIpv4([
      (value >>> 24) & 255,
      (value >>> 16) & 255,
      (value >>> 8) & 255,
      value & 255
    ].join('.'));
  }

  return normalizedAddress === '::'
    || normalizedAddress === '::1'
    || normalizedAddress.startsWith('fc')
    || normalizedAddress.startsWith('fd')
    || /^fe[89ab]/.test(normalizedAddress)
    || normalizedAddress.startsWith('ff');
}

async function validateRemoteImageUrl(value) {
  const remoteUrl = new URL(String(value || ''));
  if (!['http:', 'https:'].includes(remoteUrl.protocol)) {
    throw new Error('仅支持 HTTP 或 HTTPS 图片地址');
  }
  if (remoteUrl.username || remoteUrl.password) {
    throw new Error('图片地址不能包含登录凭据');
  }

  const hostname = remoteUrl.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('不能访问本机或私有网络图片');
  }

  const ipType = nodeNet.isIP(hostname);
  const addresses = ipType
    ? [{ address: hostname }]
    : await dns.lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((item) => isPrivateIpAddress(item.address))) {
    throw new Error('不能访问本机或私有网络图片');
  }
  return remoteUrl;
}

async function readResponseWithLimit(response, byteLimit) {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > byteLimit) {
    throw new Error('远程图片不能超过 20MB');
  }
  if (!response.body) {
    throw new Error('远程图片响应为空');
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > byteLimit) {
        await reader.cancel();
        throw new Error('远程图片不能超过 20MB');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, totalBytes);
}

async function downloadRemoteImage(value) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REMOTE_IMAGE_TIMEOUT);
  try {
    let currentUrl = await validateRemoteImageUrl(value);
    for (let redirectCount = 0; redirectCount <= MAX_REMOTE_IMAGE_REDIRECTS; redirectCount += 1) {
      const response = await electronNet.fetch(currentUrl.href, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirectCount === MAX_REMOTE_IMAGE_REDIRECTS) {
          throw new Error('远程图片重定向次数过多');
        }
        const location = response.headers.get('location');
        if (!location) {
          throw new Error('远程图片重定向地址无效');
        }
        await response.body?.cancel();
        currentUrl = await validateRemoteImageUrl(new URL(location, currentUrl).href);
        continue;
      }
      if (!response.ok) {
        throw new Error(`下载远程图片失败（HTTP ${response.status}）`);
      }

      const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const allowedRemoteImageTypes = new Set([
        'image/png',
        'image/jpeg',
        'image/gif',
        'image/bmp',
        'image/webp'
      ]);
      if (!allowedRemoteImageTypes.has(contentType)) {
        throw new Error('远程地址返回的图片类型不受支持');
      }
      return {
        buffer: await readResponseWithLimit(response, MAX_REMOTE_IMAGE_BYTES),
        contentType
      };
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('下载远程图片超时');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
  throw new Error('下载远程图片失败');
}

function getMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.zip': 'application/zip'
  };
  return mimeTypes[extension] || 'application/octet-stream';
}

module.exports = {
  MAX_REMOTE_IMAGE_BYTES,
  isPathInside,
  isPrivateIpv4,
  isPrivateIpAddress,
  validateRemoteImageUrl,
  readResponseWithLimit,
  downloadRemoteImage,
  getMimeType
};
