const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function extractCwdFromJsonl(filePath) {
  try {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let lineCount = 0;
    for await (const line of rl) {
      lineCount++;
      if (lineCount > 10) break; // Usually in the first few lines
      
      try {
        const parsed = JSON.parse(line);
        if (parsed.cwd) {
          rl.close();
          return parsed.cwd;
        }
        
        // Gemini CLI context parsing
        const messages = parsed.$set?.messages || parsed.messages;
        if (messages) {
          for (const msg of messages) {
            const content = msg.content;
            let text = '';
            if (Array.isArray(content)) {
              text = content.find(c => c.text)?.text || '';
            } else if (typeof content === 'string') {
              text = content;
            }
            
            if (text.includes('<session_context>')) {
              const workspaceMatch = text.match(/- \*\*Workspace Directories:\*\*\n\s+- (.+)/);
              if (workspaceMatch) {
                rl.close();
                return workspaceMatch[1].trim();
              }
            }
          }
        }
      } catch {}
    }
  } catch {}
  return null;
}

function resolveWorktreePath(cwd) {
  if (!cwd) return cwd;
  // Detect worktree paths: <project>/.gemini-worktrees/<name>, <project>/.worktrees/<name>, or <project>/.gemini/worktrees/<name>
  const worktreeMatch = cwd.match(/^(.+?)\/\.(?:gemini\/worktrees|gemini-worktrees|worktrees)\/[^/]+\/?$/);
  if (worktreeMatch) {
    const parent = worktreeMatch[1];
    if (fs.existsSync(parent)) return parent;
  }
  return cwd;
}

function deriveProjectPathSync(folderPath) {
  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    // Check direct .jsonl files first
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith('.jsonl')) {
        // Fast sync read of the first few lines
        try {
          const content = fs.readFileSync(path.join(folderPath, e.name), 'utf8');
          const lines = content.split('\n').slice(0, 20);
          for (const line of lines) {
            if (!line) continue;
            const parsed = JSON.parse(line);
            if (parsed.cwd) return parsed.cwd;
            
            const messages = parsed.$set?.messages || parsed.messages;
            if (messages) {
              for (const msg of messages) {
                const text = Array.isArray(msg.content) ? (msg.content.find(c => c.text)?.text || '') : (msg.content || '');
                if (text.includes('<session_context>')) {
                  const match = text.match(/- \*\*Workspace Directories:\*\*\n\s+- (.+)/);
                  if (match) return match[1].trim();
                }
              }
            }
          }
        } catch {}
      }
    }
  } catch {}
  return null;
}

module.exports = { extractCwdFromJsonl, resolveWorktreePath, deriveProjectPath: deriveProjectPathSync };
