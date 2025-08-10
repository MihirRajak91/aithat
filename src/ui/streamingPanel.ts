import * as vscode from 'vscode';

export class StreamingPanel {
  private panel: vscode.WebviewPanel;
  private isDisposed = false;

  constructor(title: string) {
    this.panel = vscode.window.createWebviewPanel(
      'aiPlanStreaming',
      title,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true }
    );
    this.panel.onDidDispose(() => { this.isDisposed = true; });
    this.panel.webview.html = this.getHtml();
  }

  public setHeader(headerMarkdown: string): void {
    if (this.isDisposed) return;
    this.panel.webview.postMessage({ type: 'header', markdown: headerMarkdown });
  }

  public appendToken(text: string): void {
    if (this.isDisposed) return;
    this.panel.webview.postMessage({ type: 'append', text });
  }

  public finish(): void {
    if (this.isDisposed) return;
    this.panel.webview.postMessage({ type: 'done' });
  }

  private getHtml(): string {
    const css = `
      :root {
        color-scheme: light dark;
      }
      body {
        margin: 0;
        padding: 0;
        font-family: var(--vscode-font-family);
        color: var(--vscode-editor-foreground);
        background: var(--vscode-editor-background);
      }
      .container {
        display: flex;
        flex-direction: column;
        height: 100vh;
      }
      .header {
        padding: 12px 16px;
        border-bottom: 1px solid var(--vscode-editorWidget-border);
        background: var(--vscode-editorWidget-background);
        font-weight: 600;
      }
      .content {
        flex: 1;
        padding: 16px;
        overflow-y: auto;
        line-height: 1.5;
        white-space: pre-wrap;
        font-family: var(--vscode-editor-font-family, monospace);
      }
      .toolbar {
        border-top: 1px solid var(--vscode-editorWidget-border);
        padding: 8px 16px;
        display: flex;
        gap: 8px;
        background: var(--vscode-editorWidget-background);
      }
      button {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
      }
      button:hover { filter: brightness(1.1); }
      .muted { opacity: 0.8; font-size: 12px; }
    `;
    const js = `
      const content = document.getElementById('content');
      const header = document.getElementById('header');
      const copyBtn = document.getElementById('copy');
      const saveBtn = document.getElementById('save');
      const vscodeApi = acquireVsCodeApi();

      window.addEventListener('message', (event) => {
        const msg = event.data;
        if (msg.type === 'header') {
          header.textContent = msg.markdown;
        } else if (msg.type === 'append') {
          content.textContent += msg.text;
          content.scrollTop = content.scrollHeight;
        } else if (msg.type === 'done') {
          const hr = document.createElement('div');
          hr.className = 'muted';
          hr.textContent = '\\n---\\nDone.';
          content.appendChild(hr);
          content.scrollTop = content.scrollHeight;
        }
      });

      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(content.textContent || '');
        } catch (e) {
          vscodeApi.postMessage({ type: 'copyFallback', text: content.textContent || '' });
        }
      });
      saveBtn.addEventListener('click', () => {
        vscodeApi.postMessage({ type: 'saveAsMarkdown', text: content.textContent || '' });
      });
    `;
    return `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>${css}</style>
      </head>
      <body>
        <div class="container">
          <div id="header" class="header">AI Plan (Streaming)</div>
          <pre id="content" class="content"></pre>
          <div class="toolbar">
            <button id="copy">Copy All</button>
            <button id="save">Save as Markdown</button>
          </div>
        </div>
        <script>${js}</script>
      </body>
      </html>`;
  }
}


