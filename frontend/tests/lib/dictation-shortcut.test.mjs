import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const modulePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'src',
  'lib',
  'dictationShortcut.ts'
);
const require = createRequire(import.meta.url);

function loadTsModule(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const module = { exports: {} };
  vm.runInNewContext(compiled, { exports: module.exports, module, require });
  return module.exports;
}

const { captureDictationShortcut, shortcutParts } = loadTsModule(modulePath);

assert.equal(JSON.stringify(
  captureDictationShortcut({ key: 'd', code: 'KeyD', ctrlKey: true, altKey: true })
), JSON.stringify({ ok: true, shortcut: 'Ctrl+Alt+D' }));

assert.equal(JSON.stringify(
  captureDictationShortcut({ key: 'Control', code: 'ControlLeft', ctrlKey: true })
), JSON.stringify({ ok: false, reason: 'Add a letter, number, function key, or Space.' }));

assert.equal(JSON.stringify(
  captureDictationShortcut({ key: 'd', code: 'KeyD' })
), JSON.stringify({ ok: false, reason: 'Add Ctrl, Alt, Shift, or Win.' }));

assert.equal(JSON.stringify(
  captureDictationShortcut({ key: 'Escape', code: 'Escape' })
), JSON.stringify({ ok: false, cancelled: true }));

assert.equal(JSON.stringify(
  captureDictationShortcut({ key: 'F10', code: 'F10', ctrlKey: true, shiftKey: true })
), JSON.stringify({ ok: true, shortcut: 'Ctrl+Shift+F10' }));

assert.equal(JSON.stringify(
  captureDictationShortcut({ key: 'd', code: 'KeyD', shiftKey: true, metaKey: true, ctrlKey: true, altKey: true })
), JSON.stringify({ ok: true, shortcut: 'Ctrl+Alt+Shift+Win+D' }));

assert.equal(JSON.stringify(
  captureDictationShortcut({ key: '7', code: 'Digit7', altKey: true })
), JSON.stringify({ ok: true, shortcut: 'Alt+7' }));

assert.equal(JSON.stringify(
  captureDictationShortcut({ key: ' ', code: 'Space', ctrlKey: true, shiftKey: true })
), JSON.stringify({ ok: true, shortcut: 'Ctrl+Shift+Space' }));

assert.equal(JSON.stringify(
  captureDictationShortcut({ key: '+', code: 'Equal', ctrlKey: true, shiftKey: true })
), JSON.stringify({ ok: false, reason: 'Choose a letter, number, function key, or Space.' }));

assert.deepEqual(Array.from(shortcutParts('Ctrl+Alt+D')), ['Ctrl', 'Alt', 'D']);
