const { defineConfig } = require('vite');
const path = require('node:path');

module.exports = defineConfig({
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
