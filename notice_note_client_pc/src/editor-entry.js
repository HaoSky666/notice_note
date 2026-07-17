import { EditorState, RangeSetBuilder, StateField } from '@codemirror/state';
import { EditorView, Decoration, ViewPlugin, WidgetType, keymap, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
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

function addDecoration(items, from, to, decoration) {
  items.push({ from, to, decoration, order: items.length });
}

function addSortedDecorations(builder, items) {
  items
    .sort((left, right) => {
      return left.from - right.from
        || left.decoration.startSide - right.decoration.startSide
        || left.to - right.to
        || left.decoration.endSide - right.decoration.endSide
        || left.order - right.order;
    })
    .forEach((item) => {
      builder.add(item.from, item.to, item.decoration);
    });
}

function replaceWithEmpty(items, from, to) {
  if (from < to) {
    addDecoration(items, from, to, Decoration.replace({ widget: new EmptyWidget() }));
  }
}

function addLineClass(items, line, className) {
  addDecoration(items, line.from, line.from, Decoration.line({ class: className }));
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

function addListLineClass(items, line, depth) {
  addLineClass(items, line, `cm-list-line cm-list-depth-${depth}`);
}

function collectFencedCodeBlocks(doc) {
  const blocks = [];
  let opening = null;

  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber++) {
    const line = doc.line(lineNumber);
    if (!opening) {
      const fence = /^\s{0,3}```(?:\s*([\w-]+))?\s*$/.exec(line.text);
      if (fence) {
        opening = { lineNumber, language: fence[1] || '' };
      }
      continue;
    }

    if (/^\s{0,3}```\s*$/.test(line.text)) {
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

function splitTableRow(text) {
  const trimmed = text.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = [];
  let cell = '';
  let escaped = false;

  for (const char of trimmed) {
    if (escaped) {
      cell += char === '|' ? '|' : `\\${char}`;
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === '|') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }
  if (escaped) {
    cell += '\\';
  }
  cells.push(cell.trim());
  return cells;
}

function isTableSeparatorLine(text) {
  const cells = splitTableRow(text);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function getTableAlignment(separator) {
  const value = separator.trim();
  if (value.startsWith(':') && value.endsWith(':')) {
    return 'center';
  }
  if (value.endsWith(':')) {
    return 'right';
  }
  return 'left';
}

function getTableSeparator(alignment) {
  if (alignment === 'center') {
    return ':---:';
  }
  if (alignment === 'right') {
    return '---:';
  }
  return '---';
}

function escapeTableCell(value) {
  return String(value || '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

function serializeMarkdownTable(rows, alignments) {
  const columnCount = Math.max(1, alignments.length, ...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) => {
    return Array.from({ length: columnCount }, (_value, index) => escapeTableCell(row[index]));
  });
  const header = normalizedRows[0] || Array(columnCount).fill('');
  const separator = Array.from({ length: columnCount }, (_value, index) => {
    return getTableSeparator(alignments[index] || 'left');
  });
  const body = normalizedRows.slice(1);
  return [header, separator, ...body]
    .map((row) => `| ${row.join(' | ')} |`)
    .join('\n');
}

function collectMarkdownTables(doc) {
  const tables = [];
  let lineNumber = 1;

  while (lineNumber < doc.lines) {
    const headerLine = doc.line(lineNumber);
    const separatorLine = doc.line(lineNumber + 1);
    const headerCells = splitTableRow(headerLine.text);
    if (!headerLine.text.includes('|') || headerCells.length < 2 || !isTableSeparatorLine(separatorLine.text)) {
      lineNumber += 1;
      continue;
    }

    const separatorCells = splitTableRow(separatorLine.text);
    const rows = [headerCells];
    let endLine = lineNumber + 1;
    while (endLine < doc.lines) {
      const nextLine = doc.line(endLine + 1);
      if (!nextLine.text.includes('|') || /^\s*$/.test(nextLine.text)) {
        break;
      }
      rows.push(splitTableRow(nextLine.text));
      endLine += 1;
    }

    tables.push({
      startLine: lineNumber,
      endLine,
      rows,
      alignments: separatorCells.map(getTableAlignment)
    });
    lineNumber = endLine + 1;
  }

  return tables;
}

function buildTableDecorations(state, options = {}) {
  if (options.isPlainText?.()) {
    return Decoration.none;
  }

  const decorations = [];
  for (const table of collectMarkdownTables(state.doc)) {
    const from = state.doc.line(table.startLine).from;
    const to = state.doc.line(table.endLine).to;
    decorations.push(Decoration.replace({
      block: true,
      widget: new MarkdownTableWidget(table.rows, table.alignments, from, to)
    }).range(from, to));
  }
  return Decoration.set(decorations, true);
}

function createTablePreviewField(options) {
  return StateField.define({
    create(state) {
      return buildTableDecorations(state, options);
    },
    update(_decorations, transaction) {
      return buildTableDecorations(transaction.state, options);
    },
    provide: (field) => EditorView.decorations.from(field)
  });
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

  const items = [];
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
        addLineClass(items, line, `cm-code-block-line ${positionClass}${editingClass}`);

        if (!isEditing) {
          if (line.number === codeBlock.startLine) {
            addDecoration(
              items,
              line.from,
              line.to,
              Decoration.replace({ widget: new CodeFenceWidget(codeBlock.language) })
            );
          } else if (line.number === codeBlock.endLine) {
            replaceWithEmpty(items, line.from, line.to);
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
        addListLineClass(items, line, depth);
        addDecoration(
          items,
          line.from,
          line.from + unordered[0].length,
          Decoration.replace({ widget: new BulletWidget(depth) })
        );
      }

      const ordered = /^(\s*)(\d+\.)\s+/.exec(text);
      if (ordered && !isPrefixActive(view, line, line.from + ordered[0].length)) {
        const depth = getListDepth(ordered[1]);
        addListLineClass(items, line, depth);
        addDecoration(
          items,
          line.from,
          line.from + ordered[0].length,
          Decoration.replace({ widget: new OrderedMarkerWidget(ordered[2], depth) })
        );
      }

      if (!isLineActive(view, line)) {
        const heading = /^(#{1,6})\s+/.exec(text);
        if (heading) {
          addLineClass(items, line, `cm-heading-line cm-heading-${heading[1].length}`);
          replaceWithEmpty(items, line.from, line.from + heading[0].length);
        }

        const quote = /^(\s*>+\s*)/.exec(text);
        if (quote) {
          addLineClass(items, line, 'cm-quote-line');
          replaceWithEmpty(items, line.from, line.from + quote[1].length);
        }

        const image = /!\[([^\]]*)\]\(([^)]+)\)/g;
        for (const match of text.matchAll(image)) {
          const start = line.from + match.index;
          const src = options.resolveImageSrc?.(match[2].trim()) || match[2].trim();
          addLineClass(items, line, 'cm-image-line');
          addDecoration(
            items,
            start,
            start + match[0].length,
            Decoration.replace({ widget: new ImageWidget(match[1], src) })
          );
        }

        const inlineCode = /`([^`]+)`/g;
        for (const match of text.matchAll(inlineCode)) {
          const start = line.from + match.index;
          replaceWithEmpty(items, start, start + 1);
          addDecoration(items, start + 1, start + match[0].length - 1, Decoration.mark({ class: 'cm-inline-code-rendered' }));
          replaceWithEmpty(items, start + match[0].length - 1, start + match[0].length);
        }

        const bold = /(\*\*|__)(.+?)\1/g;
        for (const match of text.matchAll(bold)) {
          const start = line.from + match.index;
          replaceWithEmpty(items, start, start + 2);
          replaceWithEmpty(items, start + match[0].length - 2, start + match[0].length);
        }

        const italic = /(^|[^*_])([*_])([^*_]+?)\2/g;
        for (const match of text.matchAll(italic)) {
          const markerStart = line.from + match.index + match[1].length;
          replaceWithEmpty(items, markerStart, markerStart + 1);
          replaceWithEmpty(items, markerStart + match[0].length - match[1].length - 1, markerStart + match[0].length - match[1].length);
        }
      }

      if (line.to >= to) {
        break;
      }
      pos = line.to + 1;
    }
  }

  addSortedDecorations(builder, items);
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

class MarkdownTableWidget extends WidgetType {
  constructor(rows, alignments, sourceFrom, sourceTo) {
    super();
    this.rows = rows;
    this.alignments = alignments;
    this.sourceFrom = sourceFrom;
    this.sourceTo = sourceTo;
    this.openMenu = null;
  }

  eq(other) {
    return other.sourceFrom === this.sourceFrom
      && other.sourceTo === this.sourceTo
      && JSON.stringify(other.rows) === JSON.stringify(this.rows)
      && JSON.stringify(other.alignments) === JSON.stringify(this.alignments);
  }

  updateTable(view, rows, alignments = this.alignments) {
    view.dispatch({
      changes: {
        from: this.sourceFrom,
        to: this.sourceTo,
        insert: serializeMarkdownTable(rows, alignments)
      }
    });
  }

  restoreCellFocus(view, rowIndex, columnIndex) {
    requestAnimationFrame(() => {
      const wrapper = [...view.dom.querySelectorAll('.cm-markdown-table-wrap')]
        .find((item) => Number(item.dataset.tableFrom) === this.sourceFrom);
      const content = wrapper?.querySelector(
        `.cm-table-cell-content[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`
      );
      content?.focus();
    });
  }

  closeColumnMenu() {
    this.openMenu?.remove();
    this.openMenu = null;
  }

  runColumnAction(view, columnIndex, action) {
    const rows = this.rows.map((row) => [...row]);
    const columnCount = Math.max(this.alignments.length, ...rows.map((row) => row.length));
    rows.forEach((row) => {
      while (row.length < columnCount) {
        row.push('');
      }
    });
    const alignments = Array.from({ length: columnCount }, (_value, index) => {
      return this.alignments[index] || 'left';
    });

    if (action === 'sort-asc' || action === 'sort-desc') {
      const direction = action === 'sort-asc' ? 1 : -1;
      const bodyRows = rows.slice(1).sort((left, right) => {
        return direction * String(left[columnIndex] || '').localeCompare(
          String(right[columnIndex] || ''),
          'zh-CN',
          { numeric: true, sensitivity: 'base' }
        );
      });
      this.updateTable(view, [rows[0], ...bodyRows], alignments);
      return;
    }

    if (action === 'insert-left' || action === 'insert-right') {
      const insertIndex = columnIndex + (action === 'insert-right' ? 1 : 0);
      rows.forEach((row) => row.splice(insertIndex, 0, ''));
      alignments.splice(insertIndex, 0, 'left');
      this.updateTable(view, rows, alignments);
      return;
    }

    if (action === 'move-left' || action === 'move-right') {
      const targetIndex = columnIndex + (action === 'move-right' ? 1 : -1);
      if (targetIndex < 0 || targetIndex >= columnCount) {
        return;
      }
      rows.forEach((row) => {
        [row[columnIndex], row[targetIndex]] = [row[targetIndex], row[columnIndex]];
      });
      [alignments[columnIndex], alignments[targetIndex]] = [alignments[targetIndex], alignments[columnIndex]];
      this.updateTable(view, rows, alignments);
      return;
    }

    if (action.startsWith('align-')) {
      alignments[columnIndex] = action.slice('align-'.length);
      this.updateTable(view, rows, alignments);
      return;
    }

    if (action === 'copy') {
      rows.forEach((row) => row.splice(columnIndex + 1, 0, row[columnIndex]));
      alignments.splice(columnIndex + 1, 0, alignments[columnIndex]);
      this.updateTable(view, rows, alignments);
      return;
    }

    if (action === 'delete' && columnCount > 1) {
      rows.forEach((row) => row.splice(columnIndex, 1));
      alignments.splice(columnIndex, 1);
      this.updateTable(view, rows, alignments);
    }
  }

  runRowAction(view, rowIndex, action) {
    const rows = this.rows.map((row) => [...row]);
    const columnCount = Math.max(this.alignments.length, ...rows.map((row) => row.length));
    rows.forEach((row) => {
      while (row.length < columnCount) {
        row.push('');
      }
    });

    if (action === 'insert-above' || action === 'insert-below') {
      const baseIndex = rowIndex === 0 ? 1 : rowIndex;
      const insertIndex = baseIndex + (action === 'insert-below' && rowIndex > 0 ? 1 : 0);
      rows.splice(insertIndex, 0, Array(columnCount).fill(''));
      this.updateTable(view, rows);
      return;
    }

    if (action === 'move-up' || action === 'move-down') {
      const targetIndex = rowIndex + (action === 'move-down' ? 1 : -1);
      if (rowIndex <= 0 || targetIndex <= 0 || targetIndex >= rows.length) {
        return;
      }
      [rows[rowIndex], rows[targetIndex]] = [rows[targetIndex], rows[rowIndex]];
      this.updateTable(view, rows);
      return;
    }

    if (action === 'copy' && rowIndex > 0) {
      rows.splice(rowIndex + 1, 0, [...rows[rowIndex]]);
      this.updateTable(view, rows);
      return;
    }

    if (action === 'delete' && rowIndex > 0) {
      rows.splice(rowIndex, 1);
      this.updateTable(view, rows);
    }
  }

  mountMenu(menu, left, top) {
    document.body.append(menu);
    this.openMenu = menu;
    const menuRect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(left, window.innerWidth - menuRect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(top, window.innerHeight - menuRect.height - 8))}px`;
    setTimeout(() => {
      document.addEventListener('pointerdown', (event) => {
        if (!menu.contains(event.target)) {
          this.closeColumnMenu();
        }
      }, { once: true });
    });
  }

  showColumnMenu(view, button, columnIndex) {
    this.closeColumnMenu();
    const columnCount = Math.max(this.alignments.length, ...this.rows.map((row) => row.length));
    const menu = document.createElement('div');
    menu.className = 'cm-table-column-menu';
    const groups = [
      [
        ['A↓', '按列升序 (A-Z)', 'sort-asc'],
        ['Z↑', '按列降序 (Z-A)', 'sort-desc']
      ],
      [
        ['▏←', '在左侧新增列', 'insert-left'],
        ['→▕', '在右侧新增列', 'insert-right']
      ],
      [
        ...(columnIndex > 0 ? [['←', '向左移动列', 'move-left']] : []),
        ...(columnIndex < columnCount - 1 ? [['→', '向右移动列', 'move-right']] : [])
      ],
      [
        ['☰', '左对齐', 'align-left'],
        ['≡', '居中对齐', 'align-center'],
        ['☷', '右对齐', 'align-right']
      ],
      [
        ['▣', '复制列', 'copy'],
        ['⌫', '删除列', 'delete']
      ]
    ];

    groups.filter((group) => group.length > 0).forEach((group, groupIndex) => {
      if (groupIndex > 0) {
        menu.append(document.createElement('hr'));
      }
      group.forEach(([icon, label, action]) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'cm-table-column-menu-item';
        item.disabled = action === 'delete' && columnCount <= 1;
        const iconElement = document.createElement('span');
        iconElement.className = 'cm-table-column-menu-icon';
        iconElement.textContent = icon;
        const labelElement = document.createElement('span');
        labelElement.textContent = label;
        item.append(iconElement, labelElement);
        item.addEventListener('mousedown', (event) => {
          event.preventDefault();
        });
        item.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.closeColumnMenu();
          this.runColumnAction(view, columnIndex, action);
        });
        menu.append(item);
      });
    });

    const rect = button.getBoundingClientRect();
    this.mountMenu(menu, rect.left, rect.bottom + 4);
  }

  showRowMenu(view, button, rowIndex) {
    this.closeColumnMenu();
    const menu = document.createElement('div');
    menu.className = 'cm-table-column-menu cm-table-row-menu';
    const groups = [
      [
        ['▤', '在上方新增行', 'insert-above', false],
        ['▥', '在下方新增行', 'insert-below', false]
      ],
      [
        ['↑', '向上移动行', 'move-up', rowIndex <= 1],
        ['↓', '向下移动行', 'move-down', rowIndex >= this.rows.length - 1]
      ],
      [
        ['▣', '复制行', 'copy', false],
        ['⌫', '删除行', 'delete', false]
      ]
    ];

    groups.forEach((group, groupIndex) => {
      if (groupIndex > 0) {
        menu.append(document.createElement('hr'));
      }
      group.forEach(([icon, label, action, disabled]) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'cm-table-column-menu-item';
        item.disabled = disabled;
        const iconElement = document.createElement('span');
        iconElement.className = 'cm-table-column-menu-icon';
        iconElement.textContent = icon;
        const labelElement = document.createElement('span');
        labelElement.textContent = label;
        item.append(iconElement, labelElement);
        item.addEventListener('mousedown', (event) => event.preventDefault());
        item.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.closeColumnMenu();
          this.runRowAction(view, rowIndex, action);
        });
        menu.append(item);
      });
    });

    const rect = button.getBoundingClientRect();
    this.mountMenu(menu, rect.right + 4, rect.top);
  }

  showCellMenu(view, event, rowIndex, columnIndex) {
    this.closeColumnMenu();
    const menu = document.createElement('div');
    menu.className = 'cm-table-column-menu cm-table-cell-menu';
    if (event.clientX > window.innerWidth - 420) {
      menu.classList.add('opens-left');
    }
    const columnCount = Math.max(this.alignments.length, ...this.rows.map((row) => row.length));

    const appendAction = (container, icon, label, action, type, disabled = false) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'cm-table-column-menu-item';
      item.disabled = disabled;
      const iconElement = document.createElement('span');
      iconElement.className = 'cm-table-column-menu-icon';
      iconElement.textContent = icon;
      const labelElement = document.createElement('span');
      labelElement.textContent = label;
      item.append(iconElement, labelElement);
      item.addEventListener('mousedown', (mouseEvent) => mouseEvent.preventDefault());
      item.addEventListener('click', (mouseEvent) => {
        mouseEvent.preventDefault();
        mouseEvent.stopPropagation();
        this.closeColumnMenu();
        if (type === 'row') {
          this.runRowAction(view, rowIndex, action);
        } else {
          this.runColumnAction(view, columnIndex, action);
        }
      });
      container.append(item);
    };

    const appendSubmenu = (icon, label, actions) => {
      const host = document.createElement('div');
      host.className = 'cm-table-submenu-host';
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'cm-table-column-menu-item cm-table-submenu-trigger';
      const iconElement = document.createElement('span');
      iconElement.className = 'cm-table-column-menu-icon';
      iconElement.textContent = icon;
      const labelElement = document.createElement('span');
      labelElement.textContent = label;
      const arrow = document.createElement('span');
      arrow.textContent = '›';
      trigger.append(iconElement, labelElement, arrow);
      const submenu = document.createElement('div');
      submenu.className = 'cm-table-column-menu cm-table-submenu';
      actions.forEach((action) => appendAction(submenu, ...action));
      host.append(trigger, submenu);
      menu.append(host);
    };

    appendSubmenu('▦', '行', [
      ['↑', '在上方新增行', 'insert-above', 'row'],
      ['↓', '在下方新增行', 'insert-below', 'row'],
      ['⇡', '向上移动行', 'move-up', 'row', rowIndex <= 1],
      ['⇣', '向下移动行', 'move-down', 'row', rowIndex === 0 || rowIndex >= this.rows.length - 1],
      ['▣', '复制行', 'copy', 'row', rowIndex === 0],
      ['⌫', '删除行', 'delete', 'row', rowIndex === 0]
    ]);
    appendSubmenu('▥', '列', [
      ['▏←', '在左侧新增列', 'insert-left', 'column'],
      ['→▕', '在右侧新增列', 'insert-right', 'column'],
      ['←', '向左移动列', 'move-left', 'column', columnIndex === 0],
      ['→', '向右移动列', 'move-right', 'column', columnIndex >= columnCount - 1],
      ['☰', '左对齐', 'align-left', 'column'],
      ['≡', '居中对齐', 'align-center', 'column'],
      ['☷', '右对齐', 'align-right', 'column'],
      ['▣', '复制列', 'copy', 'column'],
      ['⌫', '删除列', 'delete', 'column', columnCount <= 1]
    ]);
    menu.append(document.createElement('hr'));
    appendAction(menu, 'A↓', '按列升序 (A-Z)', 'sort-asc', 'column');
    appendAction(menu, 'Z↑', '按列降序 (Z-A)', 'sort-desc', 'column');
    this.mountMenu(menu, event.clientX, event.clientY);
  }

  toDOM(view) {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-markdown-table-wrap';
    wrapper.dataset.tableFrom = String(this.sourceFrom);

    const table = document.createElement('table');
    table.className = 'cm-markdown-table';
    this.rows.forEach((row, rowIndex) => {
      const tableRow = document.createElement('tr');
      const columnCount = Math.max(this.alignments.length, ...this.rows.map((item) => item.length));
      Array.from({ length: columnCount }, (_value, columnIndex) => row[columnIndex] || '').forEach((cell, columnIndex) => {
        const tableCell = document.createElement(rowIndex === 0 ? 'th' : 'td');
        tableCell.style.textAlign = this.alignments[columnIndex] || 'left';
        const content = document.createElement('span');
        content.className = 'cm-table-cell-content';
        content.contentEditable = 'plaintext-only';
        content.spellcheck = false;
        content.textContent = cell;
        content.dataset.rowIndex = String(rowIndex);
        content.dataset.columnIndex = String(columnIndex);
        content.addEventListener('input', () => {
          while (this.rows[rowIndex].length <= columnIndex) {
            this.rows[rowIndex].push('');
          }
          this.rows[rowIndex][columnIndex] = content.textContent;
        });
        content.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            content.blur();
          }
        });
        content.addEventListener('blur', (event) => {
          const nextValue = content.textContent.trim();
          if (nextValue === cell) {
            return;
          }
          const nextCell = event.relatedTarget?.closest?.('.cm-table-cell-content');
          const nextRowIndex = Number(nextCell?.dataset.rowIndex);
          const nextColumnIndex = Number(nextCell?.dataset.columnIndex);
          const shouldRestoreFocus = nextCell?.closest('.cm-markdown-table-wrap') === wrapper;
          const rows = this.rows.map((item) => [...item]);
          while (rows[rowIndex].length <= columnIndex) {
            rows[rowIndex].push('');
          }
          rows[rowIndex][columnIndex] = nextValue;
          this.updateTable(view, rows);
          if (shouldRestoreFocus) {
            this.restoreCellFocus(view, nextRowIndex, nextColumnIndex);
          }
        });
        tableCell.append(content);
        if (rowIndex === 0) {
          const menuButton = document.createElement('button');
          menuButton.type = 'button';
          menuButton.className = 'cm-table-column-menu-button';
          menuButton.textContent = '⋮';
          menuButton.title = '列操作';
          menuButton.setAttribute('aria-label', `第 ${columnIndex + 1} 列操作`);
          menuButton.addEventListener('mousedown', (event) => {
            event.preventDefault();
          });
          menuButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.showColumnMenu(view, menuButton, columnIndex);
          });
          menuButton.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.showColumnMenu(view, menuButton, columnIndex);
          });
          tableCell.append(menuButton);
        }
        if (columnIndex === 0 && rowIndex > 0) {
          const rowMenuButton = document.createElement('button');
          rowMenuButton.type = 'button';
          rowMenuButton.className = 'cm-table-row-menu-button';
          rowMenuButton.textContent = '⋮';
          rowMenuButton.title = '行操作';
          rowMenuButton.setAttribute('aria-label', `第 ${rowIndex} 行操作`);
          rowMenuButton.addEventListener('mousedown', (event) => event.preventDefault());
          rowMenuButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.showRowMenu(view, rowMenuButton, rowIndex);
          });
          rowMenuButton.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.showRowMenu(view, rowMenuButton, rowIndex);
          });
          tableCell.append(rowMenuButton);
        }
        tableCell.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          this.showCellMenu(view, event, rowIndex, columnIndex);
        });
        tableRow.append(tableCell);
      });
      table.append(tableRow);
    });
    wrapper.append(table);
    return wrapper;
  }

  destroy() {
    this.closeColumnMenu();
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
        markdown({ base: markdownLanguage }),
        syntaxHighlighting(markdownHighlight),
        EditorView.domEventHandlers({
          paste: (event, view) => {
            const imageFile = [...(event.clipboardData?.files || [])]
              .find((file) => file.type.startsWith('image/'));
            if (imageFile && typeof options.onPasteImage === 'function') {
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

            return false;
          }
        }),
        keymap.of([
          indentWithTab,
          { key: 'Mod-a', run: (editorView) => selectCurrentCodeBlock(editorView, options) },
          ...defaultKeymap,
          ...historyKeymap
        ]),
        placeholder(options.placeholder || ''),
        createTablePreviewField(options),
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

  const contentDOM = view.contentDOM;
  contentDOM.addEventListener('paste', (event) => {
    const htmlText = event.clipboardData?.getData('text/html') || '';
    if (!htmlText.includes('<img') || typeof options.onPasteHtml !== 'function') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const plainText = event.clipboardData?.getData('text/plain') || '';
    options.onPasteHtml(htmlText, plainText)
      .then((markdownText) => {
        if (markdownText) {
          insertMarkdownAtSelection(view, markdownText);
        }
      })
      .catch((error) => {
        options.onError?.(error);
      });
  }, true);

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
