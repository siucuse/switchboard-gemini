import os
import re

replacements = [
    ('Claude Code', 'Gemini CLI'),
    ('Claude', 'Gemini'),
    ('claude', 'gemini'),
    ('CLAUDE.md', 'GEMINI.md'),
    ('.claude', '.gemini'),
    ('Switchboard', 'SwitchboardGemini'),
    ('CLAUDE', 'GEMINI')
]

files = [
    "./encode-project-path.js",
    "./db.js",
    "./session-cache.js",
    "./README.md",
    "./main.js",
    "./public/stats-view.js",
    "./public/index.html",
    "./public/file-panel.js",
    "./public/terminal-themes.js",
    "./public/sidebar.js",
    "./public/settings-panel.js",
    "./public/dialogs.js",
    "./public/plans-memory-view.js",
    "./public/terminal-manager.js",
    "./public/style.css",
    "./public/jsonl-viewer.js",
    "./public/utils.js",
    "./public/app.js",
    "./package.json",
    "./scripts/generate-icons.js",
    "./schedule-ipc.js",
    "./gemini-auth.js",
    "./derive-project-path.js",
    "./schedule-runner.js",
    "./mcp-bridge.js"
]

for file_path in files:
    if not os.path.exists(file_path):
        print(f"Skipping {file_path}, not found.")
        continue
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for old, new in replacements:
        new_content = new_content.replace(old, new)
    
    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {file_path}")
    else:
        print(f"No changes in {file_path}")
