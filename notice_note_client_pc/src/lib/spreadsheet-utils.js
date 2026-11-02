// Excel 预览序列化工具（纯函数）

function formatSpreadsheetValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toLocaleString('zh-CN');
  }
  if (typeof value === 'object') {
    if ('result' in value) {
      return formatSpreadsheetValue(value.result);
    }
    if (Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text || '').join('');
    }
    return value.text || value.hyperlink || JSON.stringify(value);
  }
  return String(value);
}

function getSpreadsheetColor(color) {
  const argb = color?.argb;
  if (typeof argb !== 'string' || !/^[0-9a-f]{8}$/i.test(argb)) {
    return null;
  }
  return `#${argb.slice(2)}`;
}

function serializeSpreadsheetBorder(border) {
  if (!border?.style) {
    return null;
  }
  return {
    style: border.style,
    color: getSpreadsheetColor(border.color)
  };
}

function serializeSpreadsheetCell(cell) {
  const patternFillColors = {
    gray125: '#e7e7e7',
    lightGray: '#e2e2e2',
    mediumGray: '#b7b7b7',
    darkGray: '#7f7f7f'
  };
  const fillColor = cell.fill?.type === 'pattern'
    ? cell.fill.pattern === 'solid'
      ? getSpreadsheetColor(cell.fill.fgColor)
      : patternFillColors[cell.fill.pattern] || null
    : null;
  return {
    value: cell.text || formatSpreadsheetValue(cell.value),
    style: {
      fontName: cell.font?.name || null,
      fontSize: Number(cell.font?.size) || null,
      bold: Boolean(cell.font?.bold),
      italic: Boolean(cell.font?.italic),
      underline: Boolean(cell.font?.underline),
      strike: Boolean(cell.font?.strike),
      fontColor: getSpreadsheetColor(cell.font?.color),
      fillColor,
      horizontal: cell.alignment?.horizontal || null,
      vertical: cell.alignment?.vertical || null,
      wrapText: Boolean(cell.alignment?.wrapText),
      borders: {
        top: serializeSpreadsheetBorder(cell.border?.top),
        right: serializeSpreadsheetBorder(cell.border?.right),
        bottom: serializeSpreadsheetBorder(cell.border?.bottom),
        left: serializeSpreadsheetBorder(cell.border?.left)
      }
    }
  };
}

function parseSpreadsheetCellAddress(address) {
  const match = /^\$?([A-Z]+)\$?(\d+)$/i.exec(address);
  if (!match) {
    return null;
  }
  const column = [...match[1].toUpperCase()].reduce((value, letter) => {
    return value * 26 + letter.charCodeAt(0) - 64;
  }, 0);
  return { row: Number(match[2]), column };
}

function getSpreadsheetMergeMap(worksheet, rowCount, columnCount) {
  const mergeMap = new Map();
  for (const range of worksheet.model.merges || []) {
    const [startAddress, endAddress = startAddress] = range.split(':');
    const start = parseSpreadsheetCellAddress(startAddress);
    const end = parseSpreadsheetCellAddress(endAddress);
    if (!start || !end || start.row > rowCount || start.column > columnCount) {
      continue;
    }

    const endRow = Math.min(end.row, rowCount);
    const endColumn = Math.min(end.column, columnCount);
    for (let row = start.row; row <= endRow; row++) {
      for (let column = start.column; column <= endColumn; column++) {
        const key = `${row}:${column}`;
        mergeMap.set(key, row === start.row && column === start.column
          ? { rowSpan: endRow - start.row + 1, columnSpan: endColumn - start.column + 1 }
          : { skip: true });
      }
    }
  }
  return mergeMap;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  formatSpreadsheetValue,
  getSpreadsheetColor,
  serializeSpreadsheetBorder,
  serializeSpreadsheetCell,
  parseSpreadsheetCellAddress,
  getSpreadsheetMergeMap,
  escapeHtml
};
