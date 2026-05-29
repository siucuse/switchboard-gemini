const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const { getFolderIndexMtimeMs } = require('../folder-index-state');
const { extractCwdFromJsonl } = require('../derive-project-path');
const { readSessionFile } = require('../read-session-file');
const { encodeProjectPath } = require('../encode-project-path');

const PROJECTS_DIR = workerData.projectsDir;

async function run() {
  try {
    const resultsMap = new Map(); // projectPath -> { folder, projectPath, sessions, indexMtimeMs }

    async function processJsonl(filePath, folderOverride = null) {
      // For Gemini CLI, we must derive project path from the file content itself
      const projectPath = await extractCwdFromJsonl(filePath);
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
    if (fs.existsSync(PROJECTS_DIR)) {
      const topFiles = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.jsonl'));
      for (let i = 0; i < topFiles.length; i++) {
        if (i % 20 === 0) {
          parentPort.postMessage({ type: 'progress', text: `Processing sessions (${i + 1}/${topFiles.length})\u2026` });
        }
        await processJsonl(path.join(PROJECTS_DIR, topFiles[i]));
      }
    }

    // 2. Scan subdirectories (nested structure)
    const folders = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== '.git')
      .map(d => d.name);

    for (let i = 0; i < folders.length; i++) {
      parentPort.postMessage({ type: 'progress', text: `Scanning subdirectories (${i + 1}/${folders.length})\u2026` });
      const folderPath = path.join(PROJECTS_DIR, folders[i]);
      const subFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.jsonl'));
      for (const f of subFiles) {
        await processJsonl(path.join(folderPath, f), folders[i]);
      }
    }

    parentPort.postMessage({ ok: true, results: Array.from(resultsMap.values()) });
  } catch (err) {
    parentPort.postMessage({ ok: false, error: err.message });
  }
}

run();
