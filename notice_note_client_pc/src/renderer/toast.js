// 全局轻量提示：桌面应用没有 DevTools，catch(console.error) 等于把错误吞掉。
// 用 IIFE 包住，避免与 13 个经典脚本共享的全局词法环境重名。
(function () {
  "use strict";

  const TOAST_LIMIT = 4;
  let host = null;

  function getHost() {
    if (host && document.contains(host)) {
      return host;
    }
    host = document.querySelector("#appToastHost");
    if (!host) {
      host = document.createElement("div");
      host.id = "appToastHost";
      host.className = "toast-host";
      host.setAttribute("aria-live", "polite");
      document.body.append(host);
    }
    return host;
  }

  function showToast(message, type = "info", duration = 4200) {
    const text = String(message || "").trim();
    if (!text) {
      return null;
    }
    const container = getHost();
    while (container.children.length >= TOAST_LIMIT) {
      container.firstElementChild.remove();
    }
    const toast = document.createElement("div");
    toast.className = `toast${type === "error" ? " is-error" : type === "success" ? " is-success" : ""}`;
    toast.textContent = text;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    container.append(toast);
    const timer = setTimeout(() => {
      toast.classList.add("is-leaving");
      setTimeout(() => toast.remove(), 220);
    }, duration);
    toast.addEventListener("click", () => {
      clearTimeout(timer);
      toast.remove();
    });
    return toast;
  }

  function showErrorToast(error, prefix = "操作失败") {
    let message = String(error?.message || error || "未知错误");
    if (typeof window.getSaveErrorMessage === "function") {
      message = window.getSaveErrorMessage(error);
    }
    showToast(`${prefix}：${message}`, "error", 6000);
    console.error(prefix, error);
  }

  window.showToast = showToast;
  window.showErrorToast = showErrorToast;
})();
