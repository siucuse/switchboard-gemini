const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const { getFolderIndexMtimeMs } = require('../folder-index-state');
const { deriveProjectPath } = require('../derive-project-path');
const { readSessionFile } = require('../read-session-file');
const { encodeProjectPath } = require('../encode-project-path');

const PROJECTS_DIR = workerData.projectsDir;

// Scan all .jsonl files in PROJECTS_DIR (non-recursive for top-level, or check subdirs)
try {
  const resultsMap = new Map(); // projectPath -> { folder, projectPath, sessions, indexMtimeMs }

  function processJsonl(filePath, folderOverride = null) {
    const sessionId = path.basename(filePath, '.jsonl');
    // For Gemini CLI, we must derive project path from the file content itself
    const projectPath = deriveProjectPath(path.dirname(filePath)); // This is slow, maybe optimize later
    if (!projectPath) return;

    const folder = folderOverride || encodeProjectPath(projectPath);
    if (!resultsMap.has(projectPath)) {
      resultsMap.set(projectPath, {
        folder,
        projectPath,
        sessions: [],
        indexMtimeMs: getFolderIndexMtimeMs(path.dirname(filePath))
      });
    }
    
    const s = readSessionFile(filePath, folder, projectPath);
    if (s) resultsMap.get(projectPath).sessions.push(s);
  }

  // 1. Scan top-level .jsonl (flat structure like ~/.gemini/tmp/code/chats)
  const topFiles = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.jsonl'));
  for (const f of topFiles) {
    processJsonl(path.join(PROJECTS_DIR, f));
  }

  // 2. Scan subdirectories (nested structure like ~/.gemini/projects/<project>/)
  const folders = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== '.git')
    .map(d => d.name);

  for (let i = 0; i < folders.length; i++) {
    if (i % 5 === 0 || i === folders.length - 1) {
      parentPort.postMessage({ type: 'progress', text: `Scanning projects (${i + 1}/${folders.length})\u2026` });
    }
    const folderPath = path.join(PROJECTS_DIR, folders[i]);
    const subFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.jsonl'));
    for (const f of subFiles) {
      processJsonl(path.join(folderPath, f), folders[i]);
    }
  }

  parentPort.postMessage({ ok: true, results: Array.from(resultsMap.values()) });
} catch (err) {
  parentPort.postMessage({ ok: false, error: err.message });
}
