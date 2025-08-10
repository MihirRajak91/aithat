import * as vscode from 'vscode';
import { getExtensionContext } from '../context';
import { JiraProvider } from '../providers/jira';
import { OllamaProvider } from '../llm/ollama';

type Settings = {
  jiraBaseUrl?: string;
  jiraToken?: string;
  ollamaModel?: string;
  openrouterApiKey?: string;
};

export class SettingsPanel {
  private panel: vscode.WebviewPanel;
  private disposed = false;

  constructor() {
    this.panel = vscode.window.createWebviewPanel(
      'aiPlanSettings',
      'AI Plan Settings',
      { viewColumn: vscode.ViewColumn.One, preserveFocus: false },
      { enableScripts: true, retainContextWhenHidden: true }
    );
    this.panel.onDidDispose(() => { this.disposed = true; });
    this.panel.webview.html = this.getHtml();
    this.panel.webview.onDidReceiveMessage(async (msg) => {
      if (this.disposed) return;
      const ctx = getExtensionContext();
      if (!ctx) {
        void vscode.window.showErrorMessage('Extension context not available.');
        return;
      }
      try {
        if (msg.type === 'requestSettings') {
          const settings: Settings = {
            jiraBaseUrl: await ctx.secrets.get('jira.baseUrl') || '',
            jiraToken: await ctx.secrets.get('jira.token') || '',
            ollamaModel: await ctx.secrets.get('ollama.model') || 'llama2:13b',
            openrouterApiKey: await ctx.secrets.get('openrouter.apiKey') || ''
          };
          this.panel.webview.postMessage({ type: 'settings', settings });
        } else if (msg.type === 'saveSettings') {
          const s: Settings = msg.settings || {};
          if (typeof s.jiraBaseUrl === 'string') {
            await ctx.secrets.store('jira.baseUrl', s.jiraBaseUrl);
          }
          if (typeof s.jiraToken === 'string') {
            await ctx.secrets.store('jira.token', s.jiraToken);
          }
          if (typeof s.ollamaModel === 'string') {
            await ctx.secrets.store('ollama.model', s.ollamaModel);
          }
          if (typeof s.openrouterApiKey === 'string') {
            await ctx.secrets.store('openrouter.apiKey', s.openrouterApiKey);
          }
          this.panel.webview.postMessage({ type: 'saveResult', ok: true });
          void vscode.window.showInformationMessage('AI Plan settings saved.');
        } else if (msg.type === 'testJira') {
          const baseUrl = await ctx.secrets.get('jira.baseUrl');
          const token = await ctx.secrets.get('jira.token');
          if (!baseUrl || !token) {
            this.panel.webview.postMessage({ type: 'testResult', provider: 'jira', ok: false, message: 'Missing Jira URL or token.' });
            return;
          }
          const provider = new JiraProvider({ baseUrl, token });
          const ok = await provider.validateConfig();
          this.panel.webview.postMessage({ type: 'testResult', provider: 'jira', ok, message: ok ? 'Jira OK' : 'Jira failed' });
        } else if (msg.type === 'testOllama') {
          const provider = new OllamaProvider({});
          const ok = await provider.validateConfig();
          this.panel.webview.postMessage({ type: 'testResult', provider: 'ollama', ok, message: ok ? 'Ollama OK' : 'Ollama failed' });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.panel.webview.postMessage({ type: 'error', message });
      }
    });
  }

  private getHtml(): string {
    const css = `
      :root { color-scheme: light dark; }
      body { margin: 0; font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
      .wrap { padding: 16px; max-width: 800px; }
      h1 { margin: 0 0 12px; font-size: 18px; }
      .section { margin: 16px 0; padding: 12px; background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-editorWidget-border); border-radius: 6px; }
      label { display: block; margin: 8px 0 4px; font-weight: 600; }
      input[type="text"], input[type="password"] { width: 100%; padding: 6px 8px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 4px; }
      .row { display: flex; gap: 12px; }
      .row > div { flex: 1; }
      .buttons { display: flex; gap: 8px; margin-top: 12px; }
      button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
      button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
      .status { margin-top: 8px; font-size: 12px; opacity: 0.9; }
    `;
    const js = `
      const vscode = acquireVsCodeApi();
      const byId = (id) => document.getElementById(id);
      function load() { vscode.postMessage({ type: 'requestSettings' }); }
      function save() {
        const settings = {
          jiraBaseUrl: byId('jiraBaseUrl').value,
          jiraToken: byId('jiraToken').value,
          ollamaModel: byId('ollamaModel').value,
          openrouterApiKey: byId('openrouterApiKey').value,
        };
        vscode.postMessage({ type: 'saveSettings', settings });
      }
      function testJira() { vscode.postMessage({ type: 'testJira' }); }
      function testOllama() { vscode.postMessage({ type: 'testOllama' }); }
      window.addEventListener('message', (e) => {
        const msg = e.data;
        if (msg.type === 'settings') {
          const s = msg.settings || {};
          byId('jiraBaseUrl').value = s.jiraBaseUrl || '';
          byId('jiraToken').value = s.jiraToken || '';
          byId('ollamaModel').value = s.ollamaModel || 'llama2:13b';
          byId('openrouterApiKey').value = s.openrouterApiKey || '';
        } else if (msg.type === 'saveResult') {
          byId('status').textContent = 'Saved.';
        } else if (msg.type === 'testResult') {
          byId('status').textContent = (msg.provider + ': ' + (msg.ok ? 'OK' : 'Failed'));
        } else if (msg.type === 'error') {
          byId('status').textContent = 'Error: ' + msg.message;
        }
      });
      window.addEventListener('load', load);
    `;
    return `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>${css}</style>
      </head>
      <body>
        <div class="wrap">
          <h1>AI Plan Settings</h1>
          <div class="section">
            <div class="row">
              <div>
                <label for="jiraBaseUrl">Jira Base URL</label>
                <input id="jiraBaseUrl" type="text" placeholder="https://company.atlassian.net" />
              </div>
              <div>
                <label for="jiraToken">Jira Token</label>
                <input id="jiraToken" type="password" placeholder="Personal Access Token" />
              </div>
            </div>
            <div class="row">
              <div>
                <label for="ollamaModel">Ollama Model</label>
                <input id="ollamaModel" type="text" placeholder="llama2:13b" />
              </div>
              <div>
                <label for="openrouterApiKey">OpenRouter API Key</label>
                <input id="openrouterApiKey" type="password" placeholder="sk-..." />
              </div>
            </div>
            <div class="buttons">
              <button onclick="save()">Save</button>
              <button class="secondary" onclick="testJira()">Test Jira</button>
              <button class="secondary" onclick="testOllama()">Test Ollama</button>
            </div>
            <div id="status" class="status"></div>
          </div>
        </div>
        <script>${js}</script>
      </body>
      </html>`;
  }
}


