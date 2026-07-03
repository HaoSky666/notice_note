import { EditorState, RangeSetBuilder } from '@codemirror/state';
import { EditorView, Decoration, ViewPlugin, WidgetType, keymap, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { getDocument, GlobalWorkerOptions, TextLayer } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.mjs';

const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.72em', fontWeight: '700' },
  { tag: tags.heading2, fontSize: '1.42em', fontWeight: '700' },
  { tag: tags.heading3, fontSize: '1.2em', fontWeight: '700' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.monospace, backgroundColor: '#f1ebdf', borderRadius: '6px' },
  { tag: tags.quote, color: '#5f594e' },
  { tag: tags.link, color: '#2f6b55' }
]);

function isLineActive(view, line) {
  if (!view.hasFocus) {
    return false;
  }

  return view.state.selection.ranges.some((range) => {
    const headLine = view.state.doc.lineAt(range.head);
    const anchorLine = view.state.doc.lineAt(range.anchor);
    return line.number >= Math.min(headLine.number, anchorLine.number)
      && line.number <= Math.max(headLine.number, anchorLine.number);
  });
}

function isPrefixActive(view, line, prefixEnd) {
  if (!view.hasFocus) {
    return false;
  }

  return view.state.selection.ranges.some((range) => {
    const from = Math.min(range.anchor, range.head);
    const to = Math.max(range.anchor, range.head);
    if (from === to) {
      return from >= line.from && from < prefixEnd;
    }
    return from < prefixEnd && to > line.from;
  });
}

function replaceWithEmpty(builder, from, to) {
  if (from < to) {
    builder.add(from, to, Decoration.replace({ widget: new EmptyWidget() }));
  }
}

function addLineClass(builder, line, className) {
  builder.add(line.from, line.from, Decoration.line({ class: className }));
}

function insertMarkdownAtSelection(view, value) {
  const insertText = value || '';
  const selection = view.state.selection.main;
  view.dispatch({
    changes: {
      from: selection.from,
      to: selection.to,
      insert: insertText
    },
    selection: {
      anchor: selection.from + insertText.length
    },
    scrollIntoView: true
  });
}

function getIndentColumns(indentText) {
  return [...indentText].reduce((total, char) => total + (char === '\t' ? 4 : 1), 0);
}

function getListDepth(indentText) {
  return Math.min(4, Math.floor(getIndentColumns(indentText) / 2) + 1);
}

function addListLineClass(builder, line, depth) {
  addLineClass(builder, line, `cm-list-line cm-list-depth-${depth}`);
}

function collectFencedCodeBlocks(doc) {
  const blocks = [];
  let opening = null;

  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber++) {
    const line = doc.line(lineNumber);
    if (!opening) {
      const fence = /^```(?:\s*([\w-]+))?\s*$/.exec(line.text);
      if (fence) {
        opening = { lineNumber, language: fence[1] || '' };
      }
      continue;
    }

    if (/^```\s*$/.test(line.text)) {
      blocks.push({
        startLine: opening.lineNumber,
        endLine: lineNumber,
        language: opening.language
      });
      opening = null;
    }
  }

  return blocks;
}

function selectCurrentCodeBlock(view, options = {}) {
  if (options.isPlainText?.()) {
    return false;
  }

  const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;
  const block = collectFencedCodeBlocks(view.state.doc).find((item) => {
    return cursorLine >= item.startLine && cursorLine <= item.endLine;
  });
  if (!block) {
    return false;
  }

  const openingLine = view.state.doc.line(block.startLine);
  const closingLine = view.state.doc.line(block.endLine);
  const contentFrom = Math.min(openingLine.to + 1, closingLine.from);
  const contentTo = Math.max(contentFrom, closingLine.from - 1);
  view.dispatch({
    selection: { anchor: contentFrom, head: contentTo },
    scrollIntoView: true
  });
  return true;
}

function isCodeBlockActive(view, block) {
  if (!view.hasFocus) {
    return false;
  }

  return view.state.selection.ranges.some((range) => {
    const headLine = view.state.doc.lineAt(range.head).number;
    const anchorLine = view.state.doc.lineAt(range.anchor).number;
    const selectionStart = Math.min(headLine, anchorLine);
    const selectionEnd = Math.max(headLine, anchorLine);
    return selectionStart <= block.endLine && selectionEnd >= block.startLine;
  });
}

function buildLivePreviewDecorations(view, options = {}, codeBlocks = []) {
  const builder = new RangeSetBuilder();
  if (options.isPlainText?.()) {
    return builder.finish();
  }

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      const text = line.text;

      const codeBlock = codeBlocks.find((block) => {
        return line.number >= block.startLine && line.number <= block.endLine;
      });
      if (codeBlock) {
        const positionClass = line.number === codeBlock.startLine
          ? 'cm-code-block-start'
          : line.number === codeBlock.endLine
            ? 'cm-code-block-end'
            : 'cm-code-block-content';
        const isEditing = isCodeBlockActive(view, codeBlock);
        const editingClass = isEditing ? ' cm-code-block-editing' : '';
        addLineClass(builder, line, `cm-code-block-line ${positionClass}${editingClass}`);

        if (!isEditing) {
          if (line.number === codeBlock.startLine) {
            builder.add(
              line.from,
              line.to,
              Decoration.replace({ widget: new CodeFenceWidget(codeBlock.language) })
            );
          } else if (line.number === codeBlock.endLine) {
            replaceWithEmpty(builder, line.from, line.to);
          }
        }

        if (line.to >= to) {
          break;
        }
        pos = line.to + 1;
        continue;
      }

      const unordered = /^(\s*)([-*+])\s+/.exec(text);
      if (unordered && !isPrefixActive(view, line, line.from + unordered[0].length)) {
        const depth = getListDepth(unordered[1]);
        addListLineClass(builder, line, depth);
        builder.add(
          line.from,
          line.from + unordered[0].length,
          Decoration.replace({ widget: new BulletWidget(depth) })
        );
      }

      const ordered = /^(\s*)(\d+\.)\s+/.exec(text);
      if (ordered && !isPrefixActive(view, line, line.from + ordered[0].length)) {
        const depth = getListDepth(ordered[1]);
        addListLineClass(builder, line, depth);
        builder.add(
          line.from,
          line.from + ordered[0].length,
          Decoration.replace({ widget: new OrderedMarkerWidget(ordered[2], depth) })
        );
      }

      if (!isLineActive(view, line)) {
        const heading = /^(#{1,6})\s+/.exec(text);
        if (heading) {
          addLineClass(builder, line, `cm-heading-line cm-heading-${heading[1].length}`);
          replaceWithEmpty(builder, line.from, line.from + heading[0].length);
        }

        const quote = /^(\s*>+\s*)/.exec(text);
        if (quote) {
          addLineClass(builder, line, 'cm-quote-line');
          replaceWithEmpty(builder, line.from, line.from + quote[1].length);
        }

        const image = /!\[([^\]]*)\]\(([^)]+)\)/g;
        for (const match of text.matchAll(image)) {
          const start = line.from + match.index;
          const src = options.resolveImageSrc?.(match[2].trim()) || match[2].trim();
          addLineClass(builder, line, 'cm-image-line');
          builder.add(
            start,
            start + match[0].length,
            Decoration.replace({ widget: new ImageWidget(match[1], src) })
          );
        }

        const inlineCode = /`([^`]+)`/g;
        for (const match of text.matchAll(inlineCode)) {
          const start = line.from + match.index;
          replaceWithEmpty(builder, start, start + 1);
          builder.add(start + 1, start + match[0].length - 1, Decoration.mark({ class: 'cm-inline-code-rendered' }));
          replaceWithEmpty(builder, start + match[0].length - 1, start + match[0].length);
        }

        const bold = /(\*\*|__)(.+?)\1/g;
        for (const match of text.matchAll(bold)) {
          const start = line.from + match.index;
          replaceWithEmpty(builder, start, start + 2);
          replaceWithEmpty(builder, start + match[0].length - 2, start + match[0].length);
        }

        const italic = /(^|[^*_])([*_])([^*_]+?)\2/g;
        for (const match of text.matchAll(italic)) {
          const markerStart = line.from + match.index + match[1].length;
          replaceWithEmpty(builder, markerStart, markerStart + 1);
          replaceWithEmpty(builder, markerStart + match[0].length - match[1].length - 1, markerStart + match[0].length - match[1].length);
        }
      }

      if (line.to >= to) {
        break;
      }
      pos = line.to + 1;
    }
  }

  return builder.finish();
}

class EmptyWidget extends WidgetType {
  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-empty-markdown-widget';
    return span;
  }
}

class BulletWidget extends WidgetType {
  constructor(depth) {
    super();
    this.depth = depth;
  }

  toDOM() {
    const bullet = document.createElement('span');
    const symbols = ['•', '◦', '▪', '•'];
    bullet.className = `cm-rendered-bullet cm-rendered-bullet-depth-${this.depth}`;
    bullet.textContent = symbols[this.depth - 1] || symbols[0];
    return bullet;
  }
}

class OrderedMarkerWidget extends WidgetType {
  constructor(text, depth) {
    super();
    this.text = text;
    this.depth = depth;
  }

  toDOM() {
    const marker = document.createElement('span');
    marker.className = `cm-rendered-ordered-marker cm-rendered-ordered-depth-${this.depth}`;
    marker.textContent = this.text;
    return marker;
  }
}

class ImageWidget extends WidgetType {
  constructor(alt, src) {
    super();
    this.alt = alt || '图片';
    this.src = src;
  }

  toDOM() {
    const wrapper = document.createElement('span');
    wrapper.className = 'cm-rendered-image';

    const image = document.createElement('img');
    image.src = this.src;
    image.alt = this.alt;
    image.title = this.alt;
    image.loading = 'lazy';
    image.addEventListener('error', () => {
      wrapper.textContent = `${this.alt}（图片加载失败）`;
    });

    wrapper.append(image);
    return wrapper;
  }
}

class CodeFenceWidget extends WidgetType {
  constructor(language) {
    super();
    this.language = language;
  }

  eq(other) {
    return other.language === this.language;
  }

  toDOM() {
    const label = document.createElement('span');
    label.className = 'cm-code-block-language';
    label.textContent = this.language;
    return label;
  }
}

function createLivePreviewPlugin(options) {
  return ViewPlugin.fromClass(class {
    constructor(view) {
      this.codeBlocks = collectFencedCodeBlocks(view.state.doc);
      this.decorations = buildLivePreviewDecorations(view, options, this.codeBlocks);
      this.wasComposing = false;
    }

    update(update) {
      if (update.view.composing) {
        if (update.docChanged) {
          this.decorations = this.decorations.map(update.changes);
        }
        this.wasComposing = true;
        return;
      }

      if (this.wasComposing || update.docChanged) {
        this.codeBlocks = collectFencedCodeBlocks(update.state.doc);
      }
      if (this.wasComposing || update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged) {
        this.decorations = buildLivePreviewDecorations(update.view, options, this.codeBlocks);
      }
      this.wasComposing = false;
    }
  }, {
    decorations: (plugin) => plugin.decorations
  });
}

function createNoticeNoteEditor(options) {
  let internalUpdate = false;
  const view = new EditorView({
    parent: options.parent,
    state: EditorState.create({
      doc: options.initialValue || '',
      extensions: [
        history(),
        markdown(),
        syntaxHighlighting(markdownHighlight),
        EditorView.domEventHandlers({
          paste: (event, view) => {
            const imageFile = [...(event.clipboardData?.files || [])]
              .find((file) => file.type.startsWith('image/'));
            if (!imageFile || typeof options.onPasteImage !== 'function') {
              return false;
            }

            event.preventDefault();
            options.onPasteImage(imageFile)
              .then((markdownText) => {
                if (markdownText) {
                  insertMarkdownAtSelection(view, markdownText);
                }
              })
              .catch((error) => {
                options.onError?.(error);
              });
            return true;
          }
        }),
        keymap.of([
          indentWithTab,
          { key: 'Mod-a', run: (editorView) => selectCurrentCodeBlock(editorView, options) },
          ...defaultKeymap,
          ...historyKeymap
        ]),
        placeholder(options.placeholder || ''),
        createLivePreviewPlugin(options),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !internalUpdate) {
            options.onChange?.(view.state.doc.toString());
          }
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            background: '#fffdf8'
          },
          '.cm-scroller': {
            fontFamily: '"Microsoft YaHei", "Segoe UI", sans-serif',
            fontSize: '16px',
            lineHeight: '1.7'
          },
          '.cm-content': {
            minHeight: '100%',
            padding: '24px 32px'
          },
          '&.cm-focused': {
            outline: 'none'
          },
          '.cm-focused': {
            outline: 'none'
          },
          '.cm-line': {
            outline: 'none'
          },
          '.cm-line:focus': {
            outline: 'none'
          }
        })
      ]
    })
  });

  return {
    getMarkdown() {
      return view.state.doc.toString();
    },
    setMarkdown(value) {
      const nextValue = value || '';
      if (view.state.doc.toString() === nextValue) {
        return;
      }
      internalUpdate = true;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: nextValue }
      });
      internalUpdate = false;
    },
    insertMarkdown(value) {
      insertMarkdownAtSelection(view, value || '');
    },
    refresh() {
      view.dispatch({ selection: view.state.selection });
    },
    focus() {
      view.focus();
    },
    hasFocus() {
      return view.hasFocus;
    },
    getScrollPosition() {
      const scrollTop = view.scrollDOM.scrollTop;
      const topBlock = view.lineBlockAtHeight(scrollTop + 1);
      const selection = view.state.selection.main;
      return {
        top: scrollTop,
        left: view.scrollDOM.scrollLeft,
        documentAnchor: topBlock.from,
        documentOffset: scrollTop - topBlock.top,
        selectionAnchor: selection.anchor,
        selectionHead: selection.head,
        scrollSnapshot: view.scrollSnapshot()
      };
    },
    setScrollPosition(position = {}) {
      const documentLength = view.state.doc.length;
      let selection = null;
      if (Number.isFinite(position.selectionAnchor) && Number.isFinite(position.selectionHead)) {
        selection = {
          anchor: Math.min(documentLength, Math.max(0, position.selectionAnchor)),
          head: Math.min(documentLength, Math.max(0, position.selectionHead))
        };
      }
      if (selection || position.scrollSnapshot) {
        view.dispatch({
          ...(selection ? { selection } : {}),
          ...(position.scrollSnapshot ? { effects: position.scrollSnapshot } : {})
        });
      }
      if (position.scrollSnapshot) {
        return;
      }

      const documentAnchor = Number.isFinite(position.documentAnchor)
        ? Math.min(documentLength, Math.max(0, position.documentAnchor))
        : null;
      const documentOffset = Number(position.documentOffset) || 0;
      const fallbackTop = Number(position.top) || 0;
      const left = Number(position.left) || 0;
      view.requestMeasure({
        read(editorView) {
          const top = documentAnchor === null
            ? fallbackTop
            : editorView.lineBlockAt(documentAnchor).top + documentOffset;
          return { top: Math.max(0, top), left };
        },
        write(scrollPosition, editorView) {
          editorView.scrollDOM.scrollTo(scrollPosition);
        }
      });
    },
    destroy() {
      view.destroy();
    }
  };
}

window.createNoticeNoteEditor = createNoticeNoteEditor;
window.noticeNotePdf = { getDocument, TextLayer };
