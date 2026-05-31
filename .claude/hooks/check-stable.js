/**
 * Stable Module Warning
 * Warns when editing files listed in STABLE.md
 * Does NOT block — only warns. The agent can proceed but should justify.
 *
 * Parses STABLE.md entries by looking for ## [path] headings.
 * Claude Code passes tool input as JSON on stdin.
 */

const fs = require('fs');

const STABLE_FILE = 'STABLE.md';

let input = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let targetFile;
  try {
    const payload = JSON.parse(input);
    targetFile = payload.tool_input?.file_path
      || payload.tool_input?.path
      || '';
  } catch {
    process.exit(0);
  }

  if (!targetFile || !fs.existsSync(STABLE_FILE)) {
    process.exit(0);
  }

  const normalizedTarget = targetFile.replace(/\\/g, '/');
  const stableContent = fs.readFileSync(STABLE_FILE, 'utf-8');

  // Parse STABLE.md entries — look for file paths under ## headings
  const stableEntries = stableContent
    .split('\n')
    .filter(line => line.startsWith('## '))
    .map(line => line.replace('## ', '').trim());

  if (stableEntries.some(entry => entry && normalizedTarget.endsWith(entry))) {
    console.error('');
    console.error('⚠ STABILITY WARNING ⚠');
    console.error(`"${targetFile}" is listed in STABLE.md as a verified stable module.`);
    console.error('This file has been tested and is working in production.');
    console.error('Only modify it if this change is part of an explicitly approved task.');
    console.error('If you are unsure, STOP and ask the human before proceeding.');
    console.error('');
  }

  // Always exit 0 — this is a warning, not a block
  process.exit(0);
});
