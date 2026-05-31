/**
 * Protected Files Guard
 * Blocks edits to safety-locked files defined in .claude/protected-paths.txt
 *
 * Claude Code passes tool input as JSON on stdin.
 * Exit 0 = allow the edit
 * Exit 2 = block the edit (stderr message becomes the rejection reason)
 */

const fs = require('fs');
const path = require('path');

const PROTECTED_PATHS_FILE = path.join('.claude', 'protected-paths.txt');

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
    // If stdin parsing fails, allow the edit (don't block on hook errors)
    process.exit(0);
  }

  if (!targetFile) process.exit(0);

  // Normalize path separators for Windows compatibility
  const normalizedTarget = targetFile.replace(/\\/g, '/');

  if (!fs.existsSync(PROTECTED_PATHS_FILE)) {
    process.exit(0);
  }

  const lines = fs.readFileSync(PROTECTED_PATHS_FILE, 'utf-8').split('\n');

  for (const line of lines) {
    const pattern = line.trim();
    if (!pattern || pattern.startsWith('#')) continue;

    // Convert glob pattern to regex (anchored). Match against the full path OR any
    // path suffix, so an absolute path like ".../claude-test/.env.local" still matches
    // a relative pattern like ".env.local" or "supabase/migrations/**".
    const regexStr = '(^|/)' + pattern
      .replace(/\\/g, '/')
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{GLOBSTAR}}/g, '.*')
      .replace(/\?/g, '.') + '$';

    const regex = new RegExp(regexStr);

    if (regex.test(normalizedTarget)) {
      console.error('');
      console.error('========== ACCESS DENIED ==========');
      console.error(`BLOCKED: "${targetFile}" is a SAFETY-LOCKED file.`);
      console.error('This file is protected by Project Governance and CANNOT be modified.');
      console.error('DO NOT attempt to edit this file again.');
      console.error('DO NOT try to work around this restriction.');
      console.error('If this edit is genuinely necessary, STOP and ask the human for approval.');
      console.error('===================================');
      console.error('');
      process.exit(2);
    }
  }

  process.exit(0);
});
