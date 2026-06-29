const { defineConfig } = require('vite');
const path = require('node:path');
const fs = require('node:fs');

module.exports = defineConfig({
  plugins: [{
    name: 'copy-pdf-worker',
    closeBundle() {
      fs.copyFileSync(
        require.resolve('pdfjs-dist/build/pdf.worker.min.mjs'),
        path.resolve(__dirname, 'src/vendor/pdf.worker.min.mjs')
      );
    }
  }],
  build: {
    outDir: path.resolve(__dirname, 'src/vendor'),
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'src/editor-entry.js'),
      name: 'NoticeNoteEditorBundle',
      formats: ['iife'],
      fileName: () => 'editor.bundle.js'
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
