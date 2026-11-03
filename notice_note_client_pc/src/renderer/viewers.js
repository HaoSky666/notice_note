// 文件预览器：PDF / Word / Excel / 图片灯箱 / 查看器内搜索
// 注意：本文件为经典脚本，顶层 const/let 处于页面全局词法环境，跨文件共享；请勿重复声明同名标识符。
function updateImageLightboxZoomControls() {
  const canZoom = Number(imageLightboxImage.dataset.baseWidth) > 0;
  zoomOutImageLightboxButton.disabled =
    !canZoom || imageLightboxZoom <= IMAGE_LIGHTBOX_MIN_ZOOM;
  zoomInImageLightboxButton.disabled =
    !canZoom || imageLightboxZoom >= IMAGE_LIGHTBOX_MAX_ZOOM;
}
function resetImageLightboxZoom() {
  imageLightboxZoom = 1;
  delete imageLightboxImage.dataset.baseWidth;
  delete imageLightboxImage.dataset.baseHeight;
  imageLightboxImage.style.width = "";
  imageLightboxImage.style.height = "";
  imageLightboxImage.style.maxWidth = "";
  imageLightboxImage.style.maxHeight = "";
  imageLightboxStage.scrollTop = 0;
  imageLightboxStage.scrollLeft = 0;
  updateImageLightboxZoomControls();
}
function captureImageLightboxBaseSize() {
  const rect = imageLightboxImage.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }
  imageLightboxImage.dataset.baseWidth = String(rect.width);
  imageLightboxImage.dataset.baseHeight = String(rect.height);
  updateImageLightboxZoomControls();
}
function changeImageLightboxZoom(step) {
  const baseWidth = Number(imageLightboxImage.dataset.baseWidth);
  const baseHeight = Number(imageLightboxImage.dataset.baseHeight);
  if (!baseWidth || !baseHeight) {
    return;
  }
  const nextZoom = Math.min(
    IMAGE_LIGHTBOX_MAX_ZOOM,
    Math.max(IMAGE_LIGHTBOX_MIN_ZOOM, imageLightboxZoom + step),
  );
  if (nextZoom === imageLightboxZoom) {
    return;
  }
  imageLightboxZoom = nextZoom;
  imageLightboxImage.style.maxWidth = "none";
  imageLightboxImage.style.maxHeight = "none";
  imageLightboxImage.style.width = `${baseWidth * imageLightboxZoom}px`;
  imageLightboxImage.style.height = `${baseHeight * imageLightboxZoom}px`;
  updateImageLightboxZoomControls();
}
function openImageLightbox(image) {
  const src = image.currentSrc || image.src;
  if (!src) {
    return;
  }
  imageLightboxPreviousFocus = document.activeElement;
  resetImageLightboxZoom();
  imageLightboxImage.src = src;
  imageLightboxImage.alt = image.alt || "图片预览";
  imageLightbox.hidden = false;
  document.body.classList.add("image-lightbox-open");
  if (imageLightboxImage.complete) {
    captureImageLightboxBaseSize();
  } else {
    imageLightboxImage.addEventListener("load", captureImageLightboxBaseSize, {
      once: true,
    });
  }
  closeImageLightboxButton.focus();
}
function closeImageLightbox() {
  if (imageLightbox.hidden) {
    return;
  }
  imageLightbox.hidden = true;
  resetImageLightboxZoom();
  imageLightboxImage.removeAttribute("src");
  imageLightboxImage.alt = "";
  document.body.classList.remove("image-lightbox-open");
  if (imageLightboxPreviousFocus?.isConnected) {
    imageLightboxPreviousFocus.focus();
  }
  imageLightboxPreviousFocus = null;
}
function trapImageLightboxFocus(event) {
  const controls = [
    ...imageLightbox.querySelectorAll("button:not(:disabled)"),
  ];
  if (controls.length === 0) {
    return;
  }
  const firstControl = controls[0];
  const lastControl = controls[controls.length - 1];
  const activeElement = document.activeElement;
  const shouldWrapBackward =
    event.shiftKey &&
    (activeElement === firstControl || !imageLightbox.contains(activeElement));
  const shouldWrapForward =
    !event.shiftKey &&
    (activeElement === lastControl || !imageLightbox.contains(activeElement));
  if (controls.length === 1 || shouldWrapBackward || shouldWrapForward) {
    event.preventDefault();
    (event.shiftKey ? lastControl : firstControl).focus();
  }
}
function resolveNoteImageSrc(src) {
  const imageSource = String(src || "").trim();
  if (!imageSource || /^(?:[a-z][a-z\d+.-]*:|\/\/|\/|#)/i.test(imageSource)) {
    return imageSource;
  }

  const activeNote = getActiveNote();
  if (!activeNote?.sourceUrl || !storageInfo?.notesUrl) {
    return imageSource;
  }

  try {
    const resolvedUrl = new URL(imageSource, activeNote.sourceUrl);
    return resolvedUrl.href.startsWith(storageInfo.notesUrl)
      ? resolvedUrl.href
      : "";
  } catch {
    return "";
  }
}
function setPdfOutlineWidth(width) {
  const clamped = Math.max(
    PDF_OUTLINE_MIN_WIDTH,
    Math.min(PDF_OUTLINE_MAX_WIDTH, width),
  );
  pdfOutline.style.flexBasis = `${clamped}px`;
  localStorage.setItem(PDF_OUTLINE_WIDTH_KEY, String(clamped));
}
function initPdfOutlineResizer() {
  const savedWidth = Number(localStorage.getItem(PDF_OUTLINE_WIDTH_KEY));
  if (Number.isFinite(savedWidth)) {
    setPdfOutlineWidth(savedWidth);
  }

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  pdfOutlineResizer.addEventListener("pointerdown", (event) => {
    if (pdfOutline.hidden || event.button !== 0) {
      return;
    }
    event.preventDefault();
    isResizing = true;
    startX = event.clientX;
    startWidth = pdfOutline.offsetWidth;
    pdfOutlineResizer.setPointerCapture(event.pointerId);
    pdfOutlineResizer.classList.add("is-resizing");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });

  pdfOutlineResizer.addEventListener("pointermove", (event) => {
    if (!isResizing) {
      return;
    }
    setPdfOutlineWidth(startWidth + event.clientX - startX);
  });

  const stopResizing = () => {
    if (!isResizing) {
      return;
    }
    isResizing = false;
    pdfOutlineResizer.classList.remove("is-resizing");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  pdfOutlineResizer.addEventListener("pointerup", stopResizing);
  pdfOutlineResizer.addEventListener("pointercancel", stopResizing);
}
function getViewerSearchRoot() {
  if (activePdfId) {
    return pdfPages;
  }
  const file = resourceFiles.find((item) => item.id === activeResourceId);
  return file?.kind === "word"
    ? fileViewerContent.querySelector(".word-preview")
    : null;
}
function clearViewerSearchHighlights() {
  if (!window.CSS?.highlights) {
    return;
  }
  CSS.highlights.delete("viewer-search-match");
  CSS.highlights.delete("viewer-search-active");
}
function buildViewerSearchRanges(root, query) {
  const segments = [];
  let text = "";
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const value = node.nodeValue || "";
    if (value) {
      segments.push({
        node,
        start: text.length,
        end: text.length + value.length,
      });
      text += value;
    }
    node = walker.nextNode();
  }

  const normalizedText = text.toLocaleLowerCase("zh-CN");
  const normalizedQuery = query.toLocaleLowerCase("zh-CN");
  const ranges = [];
  let searchFrom = 0;
  while (ranges.length < 500) {
    const matchStart = normalizedText.indexOf(normalizedQuery, searchFrom);
    if (matchStart < 0) {
      break;
    }
    const matchEnd = matchStart + normalizedQuery.length;
    const startSegment = segments.find(
      (segment) => matchStart >= segment.start && matchStart < segment.end,
    );
    const endSegment = segments.find(
      (segment) => matchEnd > segment.start && matchEnd <= segment.end,
    );
    if (startSegment && endSegment) {
      const range = document.createRange();
      range.setStart(startSegment.node, matchStart - startSegment.start);
      range.setEnd(endSegment.node, matchEnd - endSegment.start);
      ranges.push(range);
    }
    searchFrom = matchStart + normalizedQuery.length;
  }
  return ranges;
}
function showActiveViewerSearchMatch() {
  const match = viewerSearchMatches[activeViewerSearchIndex];
  if (!match) {
    viewerSearchCount.textContent = "0 / 0";
    return;
  }

  viewerSearchCount.textContent = `${activeViewerSearchIndex + 1} / ${viewerSearchMatches.length}`;
  if (window.CSS?.highlights && typeof window.Highlight === "function") {
    CSS.highlights.set("viewer-search-active", new Highlight(match));
  }
  match.startContainer.parentElement?.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "center",
  });
}
function updateViewerSearch() {
  clearViewerSearchHighlights();
  viewerSearchMatches = [];
  activeViewerSearchIndex = -1;
  const root = getViewerSearchRoot();
  const query = viewerSearchInput.value.trim();
  if (!root || !query) {
    viewerSearchCount.textContent = "0 / 0";
    return;
  }

  viewerSearchMatches = buildViewerSearchRanges(root, query);
  if (
    window.CSS?.highlights &&
    typeof window.Highlight === "function" &&
    viewerSearchMatches.length > 0
  ) {
    CSS.highlights.set(
      "viewer-search-match",
      new Highlight(...viewerSearchMatches),
    );
  }
  if (viewerSearchMatches.length > 0) {
    activeViewerSearchIndex = 0;
    showActiveViewerSearchMatch();
  } else {
    viewerSearchCount.textContent = "0 / 0";
  }
}
function moveViewerSearch(step) {
  if (viewerSearchMatches.length === 0) {
    return;
  }
  activeViewerSearchIndex =
    (activeViewerSearchIndex + step + viewerSearchMatches.length) %
    viewerSearchMatches.length;
  showActiveViewerSearchMatch();
}
function openViewerSearch() {
  if (!getViewerSearchRoot()) {
    return;
  }
  viewerSearchBar.hidden = false;
  viewerSearchInput.focus();
  viewerSearchInput.select();
  updateViewerSearch();
}
function closeViewerSearch() {
  clearViewerSearchHighlights();
  viewerSearchBar.hidden = true;
  viewerSearchMatches = [];
  activeViewerSearchIndex = -1;
  viewerSearchCount.textContent = "0 / 0";
}
function destroyPdfPreview() {
  pdfLoadVersion++;
  pdfPageRenderVersion++;
  pdfLoadingTask?.destroy();
  pdfLoadingTask = null;
  pdfDocument = null;
  pdfPreviewKey = null;
  pdfPreviewReadyKey = null;
  pdfPreviewPromise = null;
  pdfOutlineEntries = [];
  pdfOutlineIndexVersion++;
  if (pdfOutlineHighlightFrame !== null) {
    cancelAnimationFrame(pdfOutlineHighlightFrame);
    pdfOutlineHighlightFrame = null;
  }
  activePdfOutlineButton = null;
  pdfPages.innerHTML = "";
  pdfPageCount.textContent = "";
  pdfOutlineList.innerHTML = "";
}
function getPdfPreviewKey(pdf) {
  return `${pdf.id}:${pdf.size}:${pdf.updatedAt || ""}`;
}
function showPdfStatus(message, isError = false) {
  pdfPages.innerHTML = "";
  const status = document.createElement("div");
  status.className = `pdf-preview-status${isError ? " is-error" : ""}`;
  status.textContent = message;
  pdfPages.append(status);
}
async function renderPdfPageCanvas(job) {
  await job.page.render({
    canvasContext: job.canvas.getContext("2d"),
    transform:
      job.outputScale === 1
        ? null
        : [job.outputScale, 0, 0, job.outputScale, 0, 0],
    viewport: job.viewport,
  }).promise;
}
async function renderPdfPageText(job) {
  const textContent = await job.page.getTextContent();
  const layer = new window.noticeNotePdf.TextLayer({
    textContentSource: textContent,
    container: job.textLayer,
    viewport: job.viewport,
  });
  await layer.render();
}
async function renderPdfPages(options = {}) {
  if (!pdfDocument) {
    return false;
  }

  const version = ++pdfPageRenderVersion;
  const documentToRender = pdfDocument;
  const availableWidth = Math.max(320, pdfPages.clientWidth - 48);
  const pageNumbers = Array.from(
    { length: documentToRender.numPages },
    (_, index) => index + 1,
  );
  const pages = await Promise.all(
    pageNumbers.map((pageNumber) => documentToRender.getPage(pageNumber)),
  );
  if (version !== pdfPageRenderVersion) {
    return false;
  }

  const fragment = document.createDocumentFragment();
  const jobs = pages.map((page, index) => {
    const pageNumber = index + 1;
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
      scale: (availableWidth / baseViewport.width) * pdfZoom,
    });
    const outputScale = Math.min(window.devicePixelRatio || 1, 2);
    const pageElement = document.createElement("section");
    pageElement.className = "pdf-page";
    pageElement.dataset.pageNumber = String(pageNumber);
    pageElement.style.setProperty("--scale-factor", String(viewport.scale));
    pageElement.style.setProperty(
      "--user-unit",
      String(viewport.userUnit || 1),
    );
    pageElement.style.width = `${Math.floor(viewport.width)}px`;
    pageElement.style.height = `${Math.floor(viewport.height)}px`;

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    canvas.setAttribute("aria-label", `第 ${pageNumber} 页`);
    const textLayer = document.createElement("div");
    textLayer.className = "textLayer";
    pageElement.append(canvas, textLayer);
    fragment.append(pageElement);
    return {
      pageNumber,
      page,
      viewport,
      outputScale,
      pageElement,
      canvas,
      textLayer,
    };
  });

  const priorityPageNumber = Number(options.priorityPageNumber) || 1;
  const priorityJob =
    jobs.find((job) => job.pageNumber === priorityPageNumber) || jobs[0];
  if (priorityJob) {
    await renderPdfPageCanvas(priorityJob);
  }
  if (version !== pdfPageRenderVersion) {
    return false;
  }

  pdfPages.replaceChildren(fragment);
  options.onLayoutReady?.();
  schedulePdfOutlineHighlight();

  if (priorityJob) {
    await renderPdfPageText(priorityJob);
  }
  if (version !== pdfPageRenderVersion) {
    return false;
  }

  const remainingJobs = jobs
    .filter((job) => job !== priorityJob)
    .sort((a, b) => {
      return (
        Math.abs(a.pageNumber - priorityPageNumber) -
        Math.abs(b.pageNumber - priorityPageNumber)
      );
    });
  for (const job of remainingJobs) {
    if (version !== pdfPageRenderVersion) {
      return false;
    }
    await renderPdfPageCanvas(job);
    if (version !== pdfPageRenderVersion) {
      return false;
    }
    await renderPdfPageText(job);
    if (version !== pdfPageRenderVersion) {
      return false;
    }
  }

  if (!viewerSearchBar.hidden) {
    updateViewerSearch();
  }
  schedulePdfOutlineHighlight();
  return true;
}
function getPdfViewportAnchor(anchor) {
  if (anchor?.page?.isConnected) {
    return anchor;
  }
  const pageElements = [...pdfPages.querySelectorAll(".pdf-page")];
  if (pageElements.length === 0) {
    return null;
  }
  const pagesRect = pdfPages.getBoundingClientRect();
  const clientX = pagesRect.left + pdfPages.clientWidth / 2;
  const clientY = pagesRect.top + pdfPages.clientHeight / 2;
  const page =
    pageElements.find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top <= clientY && rect.bottom >= clientY;
    }) ||
    pageElements.reduce((nearest, element) => {
      const rect = element.getBoundingClientRect();
      const distance = Math.min(
        Math.abs(clientY - rect.top),
        Math.abs(clientY - rect.bottom),
      );
      return !nearest || distance < nearest.distance
        ? { element, distance }
        : nearest;
    }, null)?.element;
  return page ? { page, clientX, clientY } : null;
}
async function getPdfOutlineDestination(item, documentToRead = pdfDocument) {
  if (!documentToRead || !item.dest) {
    return null;
  }

  const destination =
    typeof item.dest === "string"
      ? await documentToRead.getDestination(item.dest)
      : item.dest;
  if (!Array.isArray(destination) || destination.length === 0) {
    return null;
  }

  const pageRef = destination[0];
  const pageIndex = Number.isInteger(pageRef)
    ? pageRef
    : await documentToRead.getPageIndex(pageRef);
  return {
    pageNumber: pageIndex + 1,
    destination,
  };
}
function getPdfDestinationTop(destination) {
  const destinationType = destination?.[1]?.name;
  if (destinationType === "XYZ") {
    return destination[3];
  }
  if (destinationType === "FitH" || destinationType === "FitBH") {
    return destination[2];
  }
  if (destinationType === "FitR") {
    return destination[5];
  }
  return null;
}
async function getPdfDestinationOffsetRatio(
  target,
  documentToRead = pdfDocument,
) {
  const destinationTop = getPdfDestinationTop(target?.destination);
  if (
    !target?.pageNumber ||
    !documentToRead ||
    !Number.isFinite(destinationTop)
  ) {
    return 0;
  }

  const page = await documentToRead.getPage(target.pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const viewportY = viewport.convertToViewportPoint(0, destinationTop)[1];
  return Math.min(1, Math.max(0, viewportY / viewport.height));
}
async function scrollToPdfOutlineDestination(target, offsetRatio = null) {
  if (!target?.pageNumber || !pdfDocument) {
    return;
  }

  const documentToRead = pdfDocument;
  let pageElement = pdfPages.querySelector(
    `[data-page-number="${target.pageNumber}"]`,
  );
  if (!pageElement && pdfPreviewPromise) {
    await pdfPreviewPromise;
    if (pdfDocument !== documentToRead) {
      return;
    }
    pageElement = pdfPages.querySelector(
      `[data-page-number="${target.pageNumber}"]`,
    );
  }
  if (!pageElement) {
    return;
  }

  const normalizedOffset = Number.isFinite(offsetRatio)
    ? offsetRatio
    : await getPdfDestinationOffsetRatio(target, documentToRead);
  const offsetWithinPage = pageElement.clientHeight * normalizedOffset;

  const pagesRect = pdfPages.getBoundingClientRect();
  const pageRect = pageElement.getBoundingClientRect();
  const targetTop =
    pdfPages.scrollTop + pageRect.top - pagesRect.top + offsetWithinPage - 16;
  pdfPages.scrollTo({
    top: Math.max(0, targetTop),
    behavior: "smooth",
  });
}
function setActivePdfOutlineButton(button) {
  if (activePdfOutlineButton === button) {
    return;
  }
  activePdfOutlineButton?.classList.remove("is-current");
  activePdfOutlineButton = button || null;
  activePdfOutlineButton?.classList.add("is-current");
  if (activePdfOutlineButton && !pdfOutline.hidden) {
    activePdfOutlineButton.scrollIntoView({ block: "nearest" });
  }
}
function updateActivePdfOutline() {
  pdfOutlineHighlightFrame = null;
  const pagesRect = pdfPages.getBoundingClientRect();
  const readerPosition =
    pdfPages.scrollTop + Math.min(48, pdfPages.clientHeight * 0.12);
  const pagePositions = new Map();
  let activeEntry = null;
  let activePosition = -Infinity;
  for (const entry of pdfOutlineEntries) {
    if (!entry.pageNumber || !Number.isFinite(entry.pageOffsetRatio)) {
      continue;
    }
    let pagePosition = pagePositions.get(entry.pageNumber);
    if (!pagePosition) {
      const pageElement = pdfPages.querySelector(
        `[data-page-number="${entry.pageNumber}"]`,
      );
      if (!pageElement) {
        continue;
      }
      const pageRect = pageElement.getBoundingClientRect();
      pagePosition = {
        top: pdfPages.scrollTop + pageRect.top - pagesRect.top,
        height: pageElement.clientHeight,
      };
      pagePositions.set(entry.pageNumber, pagePosition);
    }
    const entryPosition =
      pagePosition.top + pagePosition.height * entry.pageOffsetRatio;
    if (entryPosition <= readerPosition && entryPosition >= activePosition) {
      activeEntry = entry;
      activePosition = entryPosition;
    }
  }
  if (activeEntry) {
    setActivePdfOutlineButton(activeEntry.button);
  }
}
function schedulePdfOutlineHighlight() {
  if (pdfOutlineHighlightFrame !== null) {
    return;
  }
  pdfOutlineHighlightFrame = requestAnimationFrame(updateActivePdfOutline);
}
async function indexPdfOutlineEntries(entries) {
  const version = ++pdfOutlineIndexVersion;
  const documentToRead = pdfDocument;
  let nextIndex = 0;
  const workerCount = Math.min(8, entries.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (version === pdfOutlineIndexVersion && nextIndex < entries.length) {
      const entry = entries[nextIndex++];
      try {
        const target = await getPdfOutlineDestination(
          entry.item,
          documentToRead,
        );
        entry.pageNumber = target?.pageNumber || null;
        entry.destination = target?.destination || null;
        entry.pageOffsetRatio = target
          ? await getPdfDestinationOffsetRatio(target, documentToRead)
          : null;
      } catch (_error) {
        entry.pageNumber = null;
        entry.destination = null;
        entry.pageOffsetRatio = null;
      }
      schedulePdfOutlineHighlight();
    }
  });
  await Promise.all(workers);
  if (version === pdfOutlineIndexVersion) {
    schedulePdfOutlineHighlight();
  }
}
function createPdfOutlineItems(items, entries) {
  const list = document.createElement("ul");

  for (const item of items) {
    const listItem = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.title || "未命名章节";
    button.disabled = !item.dest;
    if (item.bold) {
      button.classList.add("is-bold");
    }
    if (item.italic) {
      button.classList.add("is-italic");
    }
    const entry = {
      item,
      button,
      pageNumber: null,
      destination: null,
      pageOffsetRatio: null,
    };
    entries.push(entry);
    button.addEventListener("click", async () => {
      const target =
        entry.pageNumber && entry.destination
          ? { pageNumber: entry.pageNumber, destination: entry.destination }
          : await getPdfOutlineDestination(item);
      if (target?.pageNumber) {
        entry.pageNumber = target.pageNumber;
        entry.destination = target.destination;
        if (!Number.isFinite(entry.pageOffsetRatio)) {
          entry.pageOffsetRatio = await getPdfDestinationOffsetRatio(target);
        }
        setActivePdfOutlineButton(button);
      }
      await scrollToPdfOutlineDestination(target, entry.pageOffsetRatio);
    });
    listItem.append(button);

    if (Array.isArray(item.items) && item.items.length > 0) {
      listItem.append(createPdfOutlineItems(item.items, entries));
    }
    list.append(listItem);
  }

  return list;
}
function renderPdfOutline(items) {
  pdfOutlineList.innerHTML = "";
  pdfOutlineEntries = [];
  activePdfOutlineButton = null;
  pdfOutlineIndexVersion++;
  if (!Array.isArray(items) || items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "pdf-outline-empty";
    empty.textContent = "该文档没有目录";
    pdfOutlineList.append(empty);
    return;
  }

  const entries = [];
  pdfOutlineList.append(createPdfOutlineItems(items, entries));
  pdfOutlineEntries = entries;
  indexPdfOutlineEntries(entries).catch(console.error);
}
function loadPdfPreview(pdf, initialZoom = 1) {
  const previewKey = getPdfPreviewKey(pdf);
  if (pdfPreviewKey === previewKey) {
    return pdfPreviewPromise || Promise.resolve();
  }

  destroyPdfPreview();
  pdfPreviewKey = previewKey;
  pdfZoom = Math.min(2, Math.max(0.5, Number(initialZoom) || 1));
  pdfZoomValue.textContent = `${Math.round(pdfZoom * 100)}%`;
  pdfZoomOut.disabled = pdfZoom <= 0.5;
  pdfZoomIn.disabled = pdfZoom >= 2;
  pdfOutline.hidden = false;
  pdfOutlineToggle.classList.add("is-active");
  pdfOutlineList.textContent = "正在读取目录…";
  showPdfStatus("正在加载 PDF…");
  const version = ++pdfLoadVersion;

  const previewPromise = (async () => {
    try {
      const bytes = await window.noticeNote.readPdf(pdf.id);
      if (version !== pdfLoadVersion) {
        return;
      }

      pdfLoadingTask = window.noticeNotePdf.getDocument({
        data: new Uint8Array(bytes),
      });
      pdfDocument = await pdfLoadingTask.promise;
      if (version !== pdfLoadVersion) {
        return;
      }

      pdfPageCount.textContent = `${pdfDocument.numPages} 页`;
      const outlinePromise = pdfDocument.getOutline().then((outline) => {
        if (version === pdfLoadVersion) {
          renderPdfOutline(outline);
        }
      });
      const [, pagesRendered] = await Promise.all([
        outlinePromise,
        renderPdfPages(),
      ]);
      if (version === pdfLoadVersion && pagesRendered) {
        pdfPreviewReadyKey = previewKey;
      }
    } catch (error) {
      if (version === pdfLoadVersion) {
        pdfPreviewKey = null;
        pdfPreviewReadyKey = null;
        showPdfStatus(`PDF 加载失败：${error.message}`, true);
      }
    }
  })();
  pdfPreviewPromise = previewPromise;
  return previewPromise.finally(() => {
    if (pdfPreviewPromise === previewPromise) {
      pdfPreviewPromise = null;
    }
  });
}
async function changePdfZoom(step, anchor = null) {
  const nextZoom = Math.min(2, Math.max(0.5, pdfZoom + step));
  if (nextZoom === pdfZoom) {
    return;
  }

  const viewportAnchor = getPdfViewportAnchor(anchor);
  const pageNumber = viewportAnchor?.page?.dataset.pageNumber;
  const pageRect = viewportAnchor?.page?.getBoundingClientRect();
  const anchorRatioX = pageRect
    ? Math.min(
        1,
        Math.max(0, (viewportAnchor.clientX - pageRect.left) / pageRect.width),
      )
    : 0;
  const anchorRatioY = pageRect
    ? Math.min(
        1,
        Math.max(0, (viewportAnchor.clientY - pageRect.top) / pageRect.height),
      )
    : 0;

  const restoreAnchor = () => {
    if (!pageNumber || pdfZoom !== nextZoom) {
      return;
    }
    const nextPage = pdfPages.querySelector(
      `[data-page-number="${pageNumber}"]`,
    );
    const nextRect = nextPage?.getBoundingClientRect();
    if (!nextRect) {
      return;
    }
    pdfPages.scrollLeft +=
      nextRect.left + nextRect.width * anchorRatioX - viewportAnchor.clientX;
    pdfPages.scrollTop +=
      nextRect.top + nextRect.height * anchorRatioY - viewportAnchor.clientY;
  };

  pdfZoom = nextZoom;
  pdfZoomValue.textContent = `${Math.round(pdfZoom * 100)}%`;
  pdfZoomOut.disabled = pdfZoom <= 0.5;
  pdfZoomIn.disabled = pdfZoom >= 2;
  const previewKey = pdfPreviewKey;
  pdfPreviewReadyKey = null;
  const pagesRendered = await renderPdfPages({
    priorityPageNumber: pageNumber,
    onLayoutReady: restoreAnchor,
  });
  if (pagesRendered && previewKey && pdfPreviewKey === previewKey) {
    pdfPreviewReadyKey = previewKey;
  }
}
function changeImageZoom(step, anchor) {
  const image = fileViewerContent.querySelector(".file-preview-image");
  if (!image?.complete || !image.naturalWidth) {
    return;
  }

  const nextZoom = Math.min(5, Math.max(0.25, imageZoom + step));
  if (nextZoom === imageZoom) {
    return;
  }

  const previousRect = image.getBoundingClientRect();
  if (imageZoom === 1) {
    image.dataset.baseWidth = String(previousRect.width);
    image.dataset.baseHeight = String(previousRect.height);
  }

  const anchorRatioX =
    (anchor.clientX - previousRect.left) / previousRect.width;
  const anchorRatioY =
    (anchor.clientY - previousRect.top) / previousRect.height;
  const baseWidth =
    Number(image.dataset.baseWidth) || previousRect.width / imageZoom;
  const baseHeight =
    Number(image.dataset.baseHeight) || previousRect.height / imageZoom;

  imageZoom = nextZoom;
  image.style.maxWidth = "none";
  image.style.maxHeight = "none";
  image.style.width = `${baseWidth * imageZoom}px`;
  image.style.height = `${baseHeight * imageZoom}px`;

  const nextRect = image.getBoundingClientRect();
  fileViewerContent.scrollLeft +=
    nextRect.left + nextRect.width * anchorRatioX - anchor.clientX;
  fileViewerContent.scrollTop +=
    nextRect.top + nextRect.height * anchorRatioY - anchor.clientY;
}
function renderPdf() {
  const pdf = pdfFiles.find((item) => item.id === activePdfId);
  if (!pdf) {
    activePdfId = null;
    renderEditor();
    return;
  }

  editorPanel.hidden = true;
  pdfViewer.hidden = false;
  fileViewer.hidden = true;
  filePreviewVersion++;
  pdfTitle.textContent = pdf.name;
  pdfMeta.textContent = `PDF 文档 · ${formatFileSize(pdf.size)} · 创建于 ${formatListDateTime(pdf.createdAt)} · 修改于 ${formatListDateTime(pdf.updatedAt)}`;
  pdfPath.textContent = pdf.path;
  pdfPath.title = pdf.path;
  const tabKey = getWorkspaceTabKey("pdf", pdf.id);
  const viewState = workspaceTabViewStates.get(tabKey);
  renderNoteList();
  renderWorkspaceTabs();
  const previewKey = getPdfPreviewKey(pdf);
  const canRestoreImmediately = pdfPreviewReadyKey === previewKey;
  const previewPromise = loadPdfPreview(pdf, viewState?.pdfZoom);
  if (canRestoreImmediately) {
    restoreWorkspaceTabViewState(tabKey, pdfPages);
  }
  previewPromise
    .then(() => {
      if (!canRestoreImmediately) {
        restoreWorkspaceTabViewState(tabKey, pdfPages);
      }
    })
    .catch((error) => showPdfStatus(`PDF 加载失败：${error.message}`, true));
}
function showFilePreviewStatus(message) {
  fileViewerContent.innerHTML = "";
  if (!message) return;
  const status = document.createElement("div");
  status.className = "file-preview-status";
  status.textContent = message;
  fileViewerContent.append(status);
}
function showFileViewerToast(message, isError = false) {
  if (!fileViewerToast) return;
  if (!message) {
    fileViewerToast.hidden = true;
    return;
  }
  fileViewerToast.textContent = message;
  fileViewerToast.className = `file-viewer-toast ${isError ? 'is-error' : 'is-success'}`;
  fileViewerToast.hidden = false;
  clearTimeout(fileViewerToastTimer);
  fileViewerToastTimer = setTimeout(() => {
    if (fileViewerToast) fileViewerToast.hidden = true;
  }, 4500);
}
function applySpreadsheetBorder(element, side, border) {
  if (!border) {
    return;
  }

  const width = [
    "medium",
    "mediumDashed",
    "mediumDashDot",
    "mediumDashDotDot",
  ].includes(border.style)
    ? 2
    : border.style === "thick"
      ? 3
      : 1;
  const lineStyle =
    border.style === "double"
      ? "double"
      : border.style.includes("dash") || border.style.includes("Dash")
        ? "dashed"
        : border.style === "dotted" || border.style === "hair"
          ? "dotted"
          : "solid";
  element.style[`border${side}Width`] =
    `${border.style === "double" ? 3 : width}px`;
  element.style[`border${side}Style`] = lineStyle;
  element.style[`border${side}Color`] = border.color || "#5f594e";
}
function applySpreadsheetCellStyle(cell, style = {}) {
  if (style.fontName) {
    cell.style.fontFamily = `"${style.fontName}", "Microsoft YaHei", sans-serif`;
  }
  if (style.fontSize) {
    cell.style.fontSize = `${style.fontSize}pt`;
  }
  cell.style.fontWeight = style.bold ? "700" : "400";
  cell.style.fontStyle = style.italic ? "italic" : "normal";
  if (style.underline || style.strike) {
    cell.style.textDecoration = [
      style.underline ? "underline" : "",
      style.strike ? "line-through" : "",
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (style.fontColor) {
    cell.style.color = style.fontColor;
  }
  if (style.fillColor) {
    cell.style.backgroundColor = style.fillColor;
  }

  const horizontal =
    style.horizontal === "centerContinuous" ? "center" : style.horizontal;
  if (["left", "center", "right", "justify"].includes(horizontal)) {
    cell.style.textAlign = horizontal;
  }
  if (style.vertical === "middle") {
    cell.style.verticalAlign = "middle";
  } else if (["top", "bottom"].includes(style.vertical)) {
    cell.style.verticalAlign = style.vertical;
  }
  if (style.wrapText) {
    cell.style.whiteSpace = "normal";
    cell.style.overflowWrap = "anywhere";
  }

  applySpreadsheetBorder(cell, "Top", style.borders?.top);
  applySpreadsheetBorder(cell, "Right", style.borders?.right);
  applySpreadsheetBorder(cell, "Bottom", style.borders?.bottom);
  applySpreadsheetBorder(cell, "Left", style.borders?.left);
}
function renderSpreadsheetPreview(sheets) {
  fileViewerContent.innerHTML = "";
  const preview = document.createElement("div");
  preview.className = "spreadsheet-preview";
  const tabs = document.createElement("div");
  tabs.className = "spreadsheet-sheet-tabs";
  const sheetRoot = document.createElement("div");
  preview.append(tabs, sheetRoot);
  fileViewerContent.append(preview);

  const renderSheet = (sheet, activeButton) => {
    for (const button of tabs.querySelectorAll("button")) {
      button.classList.toggle("is-active", button === activeButton);
    }
    sheetRoot.innerHTML = "";
    const section = document.createElement("section");
    section.className = "spreadsheet-preview-sheet";
    const heading = document.createElement("h2");
    heading.textContent = sheet.name;
    const tableWrap = document.createElement("div");
    tableWrap.className = "spreadsheet-preview-table-wrap";
    const table = document.createElement("table");
    table.className = "spreadsheet-preview-table";

    const colgroup = document.createElement("colgroup");
    for (const column of sheet.columns || []) {
      const col = document.createElement("col");
      col.style.width = `${column.width}px`;
      colgroup.append(col);
    }
    const tableWidth = (sheet.columns || []).reduce(
      (total, column) => total + column.width,
      0,
    );
    if (tableWidth > 0) {
      table.style.width = `${tableWidth}px`;
    }
    table.append(colgroup);

    for (const row of sheet.rows) {
      const tr = document.createElement("tr");
      if (row.height) {
        tr.style.height = `${row.height}px`;
      }
      for (const cell of row.cells) {
        if (cell.skip) {
          continue;
        }
        const td = document.createElement("td");
        td.textContent = cell.value;
        if (cell.rowSpan > 1) {
          td.rowSpan = cell.rowSpan;
        }
        if (cell.columnSpan > 1) {
          td.colSpan = cell.columnSpan;
        }
        applySpreadsheetCellStyle(td, cell.style);
        tr.append(td);
      }
      table.append(tr);
    }
    tableWrap.append(table);
    section.append(heading, tableWrap);

    if (sheet.truncated) {
      const note = document.createElement("p");
      note.className = "spreadsheet-preview-note";
      note.textContent = "表格较大，当前仅显示前 500 行、50 列。";
      section.append(note);
    }
    sheetRoot.append(section);
  };

  for (const [index, sheet] of sheets.entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = sheet.name;
    button.addEventListener("click", () => renderSheet(sheet, button));
    tabs.append(button);
    if (index === 0) {
      renderSheet(sheet, button);
    }
  }
}
function appendSanitizedWordNode(sourceNode, targetParent) {
  if (sourceNode.nodeType === Node.TEXT_NODE) {
    targetParent.append(document.createTextNode(sourceNode.textContent || ""));
    return;
  }
  if (sourceNode.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const tagName = sourceNode.tagName.toLowerCase();
  const allowedTags = new Set([
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "sup",
    "sub",
    "a",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "img",
    "blockquote",
    "hr",
  ]);

  if (!allowedTags.has(tagName)) {
    for (const child of sourceNode.childNodes) {
      appendSanitizedWordNode(child, targetParent);
    }
    return;
  }

  const target = document.createElement(tagName);
  if (sourceNode.id) {
    target.id = sourceNode.id;
  }

  const wordClasses = [...sourceNode.classList].filter((className) =>
    className.startsWith("word-"),
  );
  if (wordClasses.length > 0) {
    target.className = wordClasses.join(" ");
  }

  if (tagName === "a") {
    const href = sourceNode.getAttribute("href") || "";
    if (href.startsWith("#")) {
      target.setAttribute("href", href);
    }
  } else if (tagName === "img") {
    const src = sourceNode.getAttribute("src") || "";
    if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(src)) {
      target.setAttribute("src", src);
    }
    target.setAttribute("alt", sourceNode.getAttribute("alt") || "文档图片");
  } else if (tagName === "td" || tagName === "th") {
    for (const attributeName of ["colspan", "rowspan"]) {
      const value = Number(sourceNode.getAttribute(attributeName));
      if (Number.isInteger(value) && value > 1 && value <= 100) {
        target.setAttribute(attributeName, String(value));
      }
    }
  }

  for (const child of sourceNode.childNodes) {
    appendSanitizedWordNode(child, target);
  }
  targetParent.append(target);
}
function enhanceWordPreview(content) {
  const children = [...content.children];
  const tocIndex = children.findIndex((element) => {
    return (
      element.tagName === "P" &&
      element.textContent.replace(/\s/g, "") === "目录"
    );
  });
  if (tocIndex < 3) {
    return;
  }

  const coverElements = children.slice(0, tocIndex);
  const cover = document.createElement("section");
  cover.className = "word-cover";
  content.insertBefore(cover, coverElements[0]);
  cover.append(...coverElements);

  const paragraphs = [...cover.querySelectorAll(":scope > p")];
  paragraphs[0]?.classList.add("word-cover-organization");
  const title =
    paragraphs.find((paragraph) => {
      return /(规格书|方案|报告|说明书|合同|招标文件|技术要求)/.test(
        paragraph.textContent,
      );
    }) || paragraphs[1];
  title?.classList.add("word-cover-title");

  for (const paragraph of paragraphs) {
    const text = paragraph.textContent.replace(/\s/g, "");
    if (/(编制人|审核人|分管领导|主要领导|负责人)[:：]/.test(text)) {
      paragraph.classList.add("word-cover-field");
    } else if (/^\d{4}年\d{1,2}月(?:\d{1,2}日)?$/.test(text)) {
      paragraph.classList.add("word-cover-date");
    }
  }

  children[tocIndex].classList.add("word-toc-title");
}
function updateWordOutlineHighlight() {
  wordOutlineHighlightFrame = null;
  if (wordOutline.hidden || wordOutlineHeadings.length === 0) {
    return;
  }

  const viewerTop = fileViewerContent.getBoundingClientRect().top + 88;
  let activeIndex = 0;
  for (const [index, entry] of wordOutlineHeadings.entries()) {
    if (entry.target.getBoundingClientRect().top <= viewerTop) {
      activeIndex = index;
    } else {
      break;
    }
  }

  for (const [index, entry] of wordOutlineHeadings.entries()) {
    entry.button.classList.toggle("is-current", index === activeIndex);
  }
}
function scheduleWordOutlineHighlight() {
  if (wordOutlineHighlightFrame !== null) {
    return;
  }
  wordOutlineHighlightFrame = requestAnimationFrame(updateWordOutlineHighlight);
}
function renderWordOutline(content) {
  wordOutlineList.innerHTML = "";
  wordOutlineHeadings = [];

  const targetsById = new Map(
    [...content.querySelectorAll("[id]")].map((element) => [
      element.id,
      element,
    ]),
  );

  const tocTitleEl = content.querySelector(".word-toc-title");
  const tocAreaElements = new Set();
  if (tocTitleEl) {
    let sibling = tocTitleEl.nextElementSibling;
    while (sibling) {
      const text = sibling.textContent.trim();
      if (
        sibling.tagName === "P" &&
        /^\d+(?:\.\d+)*[\s.、]+[\u4e00-\u9fa5A-Za-z]/.test(text)
      ) {
        tocAreaElements.add(sibling);
        sibling = sibling.nextElementSibling;
      } else if (sibling.classList.contains("word-toc")) {
        tocAreaElements.add(sibling);
        sibling = sibling.nextElementSibling;
      } else {
        break;
      }
    }
  }

  const isInsideTocArea = (el) => {
    if (!el) return false;
    if (
      el.closest(".word-toc") ||
      el.closest(".word-cover") ||
      el.classList.contains("word-toc-title")
    ) {
      return true;
    }
    if (tocAreaElements.has(el)) return true;
    return false;
  };

  const isHeadingLikeText = (text) => {
    return /^[1-9]\d*(?:\.\d+)*(?:[\s.、]+)[\u4e00-\u9fa5A-Za-z]/.test(text);
  };

  const findBodyTargetForText = (rawText) => {
    if (!rawText) return null;
    const cleanTitle = rawText.replace(/\s+\d+\s*$/, "").trim();
    const numMatch = cleanTitle.match(/^(\d+(?:\.\d+)*)/);
    const searchNum = numMatch ? numMatch[1] : "";

    const candidates = [
      ...content.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li"),
    ];
    return candidates.find((candidate) => {
      if (isInsideTocArea(candidate)) return false;
      if (candidate.closest("table")) return false;
      const candText = candidate.textContent.trim();
      if (
        searchNum &&
        (candText === cleanTitle ||
          candText.startsWith(`${searchNum} `) ||
          candText.startsWith(`${searchNum}.`))
      ) {
        return true;
      }
      return candText === cleanTitle;
    });
  };

  const tocEntries = [...content.querySelectorAll(".word-toc")]
    .map((paragraph) => {
      const link = paragraph.querySelector('a[href^="#"]');
      const targetId = link?.getAttribute("href")?.slice(1) || "";
      let target = targetId ? targetsById.get(targetId) : null;
      const rawText = (link?.textContent || paragraph.textContent)
        .replace(/\s+\d+\s*$/, "")
        .trim();

      if (!target || isInsideTocArea(target)) {
        target = findBodyTargetForText(rawText);
      }

      const levelClass = [...paragraph.classList].find((className) =>
        /^word-toc-[1-6]$/.test(className),
      );
      return {
        target: target || paragraph,
        label: rawText,
        level: Math.max(0, Number(levelClass?.slice(-1) || 1) - 1),
      };
    })
    .filter((entry) => entry.label);

  const implicitTocEntries = [];
  if (tocEntries.length === 0 && tocAreaElements.size > 0) {
    for (const el of tocAreaElements) {
      const text = el.textContent.trim();
      const cleanLabel = text.replace(/\s+\d+\s*$/, "").trim();
      if (!cleanLabel) continue;
      const target = findBodyTargetForText(cleanLabel);
      const numDotCount = (cleanLabel.match(/\./g) || []).length;
      implicitTocEntries.push({
        target: target || el,
        label: cleanLabel,
        level: Math.min(4, numDotCount),
      });
    }
  }

  const headingEntries = [
    ...content.querySelectorAll("h1, h2, h3, h4, h5, h6"),
  ]
    .filter((heading) => {
      return (
        heading.textContent.trim() &&
        !isInsideTocArea(heading) &&
        !heading.classList.contains("word-document-title")
      );
    })
    .map((heading, index) => {
      if (!heading.id) {
        heading.id = `word-heading-${index + 1}`;
      }
      return {
        target: heading,
        label: heading.textContent.trim(),
        level: Math.max(0, Number(heading.tagName.slice(1)) - 1),
      };
    });

  const numberedParagraphEntries = [
    ...content.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6"),
  ]
    .filter((el) => {
      if (isInsideTocArea(el)) return false;
      if (el.closest("table")) return false;
      const text = el.textContent.trim();
      return (
        !el.classList.contains("word-document-title") &&
        isHeadingLikeText(text) &&
        text.length >= 4 &&
        text.length <= 100
      );
    })
    .map((el, index) => {
      if (!el.id) {
        el.id = `word-num-heading-${index + 1}`;
      }
      const text = el.textContent.trim();
      const numDotCount = (text.match(/\./g) || []).length;
      return {
        target: el,
        label: text,
        level: Math.min(4, numDotCount),
      };
    });

  let outlineEntries =
    tocEntries.length > 0
      ? tocEntries
      : implicitTocEntries.length > 0
        ? implicitTocEntries
        : headingEntries;
  if (outlineEntries.length === 0) {
    outlineEntries = numberedParagraphEntries;
  }

  for (const entry of outlineEntries) {
    if (!entry.target || isInsideTocArea(entry.target)) {
      const bodyTarget = findBodyTargetForText(entry.label);
      if (bodyTarget) {
        entry.target = bodyTarget;
      }
    }
  }

  if (outlineEntries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "word-outline-empty";
    empty.textContent = "文档中没有可用的目录或标题。";
    wordOutlineList.append(empty);
    return;
  }

  for (const entry of outlineEntries) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = entry.label;
    button.style.paddingLeft = `${8 + entry.level * 12}px`;
    button.title = button.textContent;
    button.addEventListener("click", () => {
      if (entry.target) {
        entry.target.scrollIntoView({ behavior: "smooth", block: "start" });
        entry.target.classList.add("word-heading-highlight");
        setTimeout(
          () => entry.target.classList.remove("word-heading-highlight"),
          2000,
        );
      }
      for (const outlineEntry of wordOutlineHeadings) {
        outlineEntry.button.classList.toggle(
          "is-current",
          outlineEntry.button === button,
        );
      }
    });
    wordOutlineList.append(button);
    wordOutlineHeadings.push({ target: entry.target, button });
  }
  scheduleWordOutlineHighlight();
}
function renderWordPreview(html) {
  const content = document.createElement("article");
  content.className = "word-preview";
  const parsed = new DOMParser().parseFromString(html || "", "text/html");

  for (const child of parsed.body.childNodes) {
    appendSanitizedWordNode(child, content);
  }

  if (!content.hasChildNodes()) {
    content.textContent = "文档没有可显示的内容。";
  } else {
    enhanceWordPreview(content);
  }

  content.addEventListener("click", (event) => {
    const link =
      event.target.closest("a[href^='#']") ||
      event.target.closest(".word-toc") ||
      event.target.closest("p");
    if (!link) return;
    if (link.closest("table")) return;

    const text = link.textContent.trim();

    const tocTitle = content.querySelector(".word-toc-title");
    let isInTocArea = false;
    if (tocTitle) {
      let sib = tocTitle.nextElementSibling;
      while (sib) {
        if (sib === link) {
          isInTocArea = true;
          break;
        }
        const sibText = sib.textContent.trim();
        if (
          sib.tagName === "P" &&
          /^\d+(?:\.\d+)*[\s.、]+[\u4e00-\u9fa5A-Za-z]/.test(sibText)
        ) {
          sib = sib.nextElementSibling;
        } else if (sib.classList.contains("word-toc")) {
          sib = sib.nextElementSibling;
        } else {
          break;
        }
      }
    }

    const isTocElement =
      link.classList.contains("word-toc") ||
      Boolean(link.querySelector("a[href^='#']")) ||
      isInTocArea;
    const isNumberedTocText =
      /^[1-9]\d*(?:\.\d+)*\s+\S+/.test(text) && /\s+\d+\s*$/.test(text);

    if (!isTocElement && !isNumberedTocText) return;

    const href =
      link.getAttribute?.("href") ||
      link.querySelector?.("a")?.getAttribute("href") ||
      "";
    const targetId = href.startsWith("#") ? href.slice(1) : "";

    let target = targetId
      ? content.querySelector(`#${CSS.escape(targetId)}`)
      : null;

    if (!target) {
      const cleanTitle = text.replace(/\s+\d+\s*$/, "").trim();
      const numMatch = cleanTitle.match(/^(\d+(?:\.\d+)*)/);
      const searchNum = numMatch ? numMatch[1] : "";

      const candidates = [
        ...content.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li"),
      ];
      target = candidates.find((el) => {
        if (el === link || el.closest("table")) return false;
        if (
          el.closest(".word-toc") ||
          el.closest(".word-cover")
        )
          return false;
        if (tocTitle) {
          let sib2 = tocTitle.nextElementSibling;
          while (sib2) {
            if (sib2 === el) return false;
            if (
              sib2.tagName === "P" &&
              /^\d+(?:\.\d+)*[\s.、]+[\u4e00-\u9fa5A-Za-z]/.test(
                sib2.textContent.trim(),
              )
            ) {
              sib2 = sib2.nextElementSibling;
            } else if (sib2.classList.contains("word-toc")) {
              sib2 = sib2.nextElementSibling;
            } else {
              break;
            }
          }
        }
        const elText = el.textContent.trim();
        if (
          searchNum &&
          (elText === cleanTitle ||
            elText.startsWith(`${searchNum} `) ||
            elText.startsWith(`${searchNum}.`))
        ) {
          return true;
        }
        return elText === cleanTitle;
      });
    }

    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.classList.add("word-heading-highlight");
      setTimeout(
        () => target.classList.remove("word-heading-highlight"),
        2000,
      );
    }
  });

  fileViewerContent.append(content);
  renderWordOutline(content);
  if (!viewerSearchBar.hidden) {
    updateViewerSearch();
  }
}
async function loadResourcePreview(file, version, viewState = {}) {
  try {
    const preview = await window.noticeNote.previewFile(file.id);
    if (version !== filePreviewVersion) {
      return;
    }

    fileViewerContent.innerHTML = "";
    if (preview.kind === "image") {
      imageZoom = Math.min(4, Math.max(0.25, Number(viewState.imageZoom) || 1));
      const image = document.createElement("img");
      image.className = "file-preview-image";
      image.alt = file.name;
      const imageLoaded = new Promise((resolve) => {
        image.addEventListener(
          "load",
          () => {
            const rect = image.getBoundingClientRect();
            image.dataset.baseWidth = String(rect.width);
            image.dataset.baseHeight = String(rect.height);
            if (imageZoom !== 1) {
              image.style.maxWidth = "none";
              image.style.maxHeight = "none";
              image.style.width = `${rect.width * imageZoom}px`;
              image.style.height = `${rect.height * imageZoom}px`;
            }
            resolve();
          },
          { once: true },
        );
        image.addEventListener("error", resolve, { once: true });
      });
      image.src = preview.fileUrl;
      fileViewerContent.append(image);
      await imageLoaded;
    } else if (preview.kind === "word") {
      renderWordPreview(preview.html);
    } else if (preview.kind === "spreadsheet") {
      renderSpreadsheetPreview(preview.sheets);
    }
  } catch (error) {
    if (version === filePreviewVersion) {
      showFilePreviewStatus(`文件预览失败：${error.message}`);
    }
  }
}
function renderResourceFile() {
  const file = resourceFiles.find((item) => item.id === activeResourceId);
  if (!file || !file.canOpen || file.kind === "pdf") {
    activeResourceId = null;
    renderEditor();
    return;
  }

  editorPanel.hidden = true;
  pdfViewer.hidden = true;
  fileViewer.hidden = false;
  fileViewerIcon.textContent = file.typeLabel;
  fileViewerTitle.textContent = file.name;
  fileViewerMeta.textContent = `${formatFileSize(file.size)} · 创建于 ${formatListDateTime(file.createdAt)} · 修改于 ${formatListDateTime(file.updatedAt)}`;
  fileViewerType.textContent = file.typeLabel;
  fileViewerPath.textContent = file.path;
  fileViewerPath.title = file.path;
  const isWordPreview = file.kind === "word";
  wordOutlineToggle.hidden = !isWordPreview;
  wordOutlineToggle.classList.toggle("is-active", isWordPreview);
  wordOutlineToggle.setAttribute("aria-expanded", String(isWordPreview));
  wordOutline.hidden = !isWordPreview;
  wordOutlineList.innerHTML = "";
  wordOutlineHeadings = [];
  const tabKey = getWorkspaceTabKey("file", file.id);
  const viewState = workspaceTabViewStates.get(tabKey);
  resetFileViewerActions(file);
  showFilePreviewStatus("正在加载文件…");
  const version = ++filePreviewVersion;
  renderNoteList();
  renderWorkspaceTabs();
  loadResourcePreview(file, version, viewState)
    .then(() => restoreWorkspaceTabViewState(tabKey, fileViewerContent))
    .catch(console.error);
}
function resetFileViewerActions(file) {
  showFileViewerToast('');
  const isOfficePreview = file && (file.kind === 'word' || file.kind === 'spreadsheet');
  if (fileViewerOpenExternalButton) {
    fileViewerOpenExternalButton.hidden = !file;
  }
  if (fileViewerReadOnlyNotice) {
    fileViewerReadOnlyNotice.hidden = !isOfficePreview;
  }
}
function openActiveFileExternal() {
  const file = resourceFiles.find((item) => item.id === activeResourceId);
  if (!file) return;
  window.noticeNote.openEntryWithDefaultApp({ path: file.path }).catch(console.error);
}
