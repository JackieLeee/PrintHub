export interface PortPromptHtmlParams {
  title: string;
  hintHtml: string;
  note: string;
  label: string;
  cancel: string;
  ok: string;
  current: number;
  min: number;
  max: number;
  channelOk: string;
  channelCancel: string;
}

export function buildPortPromptHtml(p: PortPromptHtmlParams): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(p.title)}</title>
<style>
  :root {
    color-scheme: dark;
    --bg: #0f1117;
    --surface: #171a22;
    --surface2: #1e2230;
    --border: #2a3142;
    --text: #e8eaef;
    --muted: #8b93a7;
    --accent: #4c8dff;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    height: 100%;
    font: 13px "SF Pro Text", "Segoe UI", system-ui, sans-serif;
    background: var(--surface);
    color: var(--text);
  }
  body {
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }
  .shell {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 16px;
    gap: 12px;
  }
  .title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.3;
  }
  .hint {
    margin: 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--text);
  }
  .hint strong { color: var(--text); font-weight: 600; }
  .note {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
    color: var(--muted);
  }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field label {
    font-size: 12px;
    font-weight: 500;
    color: var(--muted);
  }
  input {
    width: 100%;
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--surface2);
    color: var(--text);
    font: inherit;
    outline: none;
    transition: border-color 150ms ease-out;
  }
  input:focus { border-color: var(--accent); }
  .actions {
    margin-top: auto;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 4px;
  }
  button {
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--surface2);
    color: var(--text);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
    transition:
      border-color 150ms ease-out,
      background 150ms ease-out;
  }
  button:hover { border-color: var(--accent); }
  button.ghost {
    background: transparent;
    border-color: transparent;
    color: var(--muted);
  }
  button.ghost:hover {
    color: var(--text);
    border-color: var(--border);
    background: var(--surface2);
  }
  button.primary {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--surface);
    font-weight: 600;
  }
  button.primary:hover {
    background: color-mix(in srgb, var(--accent) 88%, white);
    border-color: var(--accent);
  }
</style>
</head>
<body>
  <div class="shell">
    <h1 class="title">${escapeHtml(p.title)}</h1>
    <p class="hint">${p.hintHtml}</p>
    <p class="note">${escapeHtml(p.note)}</p>
    <div class="field">
      <label for="p">${escapeHtml(p.label)}</label>
      <input id="p" type="number" min="${p.min}" max="${p.max}" value="${p.current}" autofocus />
    </div>
    <div class="actions">
      <button type="button" class="ghost" id="c">${escapeHtml(p.cancel)}</button>
      <button type="button" class="primary" id="o">${escapeHtml(p.ok)}</button>
    </div>
  </div>
<script>
const { ipcRenderer } = require('electron');
const input = document.getElementById('p');
function submit() { ipcRenderer.invoke('${p.channelOk}', input.value); }
document.getElementById('c').onclick = () => ipcRenderer.invoke('${p.channelCancel}');
document.getElementById('o').onclick = submit;
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submit();
  if (e.key === 'Escape') ipcRenderer.invoke('${p.channelCancel}');
});
</script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
