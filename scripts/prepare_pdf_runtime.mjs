#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = mkdtempSync(path.join(tmpdir(), 'program-tool-pdf-runtime-'));
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const vendorDir = path.join(root, 'vendor');
const editorPath = path.join(root, 'pdf-editor', 'index.html');

const replacements = new Map([
  ['https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js', '/vendor/pdf.min.js'],
  ['https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js', '/vendor/pdf.worker.min.js'],
  ['https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js', '/vendor/jspdf.umd.min.js'],
]);

function requireNonEmpty(filePath) {
  if (statSync(filePath).size <= 0) throw new Error(`Empty generated file: ${filePath}`);
}

try {
  const install = spawnSync(
    npmCommand,
    [
      'install',
      '--prefix', temp,
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--silent',
      'pdfjs-dist@3.11.174',
      'jspdf@2.5.1',
    ],
    { stdio: 'inherit' },
  );
  if (install.status !== 0) throw new Error(`npm install failed with exit code ${install.status}`);

  mkdirSync(vendorDir, { recursive: true });
  const generated = [
    [path.join(temp, 'node_modules', 'pdfjs-dist', 'build', 'pdf.min.js'), path.join(vendorDir, 'pdf.min.js')],
    [path.join(temp, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.js'), path.join(vendorDir, 'pdf.worker.min.js')],
    [path.join(temp, 'node_modules', 'jspdf', 'dist', 'jspdf.umd.min.js'), path.join(vendorDir, 'jspdf.umd.min.js')],
  ];
  for (const [source, destination] of generated) {
    copyFileSync(source, destination);
    requireNonEmpty(destination);
  }

  let html = readFileSync(editorPath, 'utf8');
  for (const [remote, local] of replacements) {
    if (html.includes(remote)) html = html.split(remote).join(local);
    else if (!html.includes(local)) throw new Error(`PDF runtime path not found: ${remote}`);
  }
  for (const remote of replacements.keys()) {
    if (html.includes(remote)) throw new Error(`Remote PDF runtime path remains: ${remote}`);
  }
  writeFileSync(editorPath, html, 'utf8');

  // Firebase --json writes machine-readable output to stdout. Keep predeploy
  // diagnostics on stderr so the JSON stream remains valid for CI parsers.
  console.error('PDF editor runtime prepared with same-origin vendor assets.');
  for (const [, destination] of generated) console.error(`${path.relative(root, destination)}: ${statSync(destination).size} bytes`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
