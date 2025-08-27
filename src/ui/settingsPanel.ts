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
      if (this.disposed) {return;}
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
          this.panel.webview.postMessage({ type: 'testResult', provider: 'jira', ok, message: ok ? 'Successfully connected to Jira' : 'Failed to connect - check your URL and token' });
        } else if (msg.type === 'testOllama') {
          const provider = new OllamaProvider({});
          const ok = await provider.validateConfig();
          this.panel.webview.postMessage({ type: 'testResult', provider: 'ollama', ok, message: ok ? 'Ollama is running and accessible' : 'Ollama is not running or not accessible on localhost:11434' });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.panel.webview.postMessage({ type: 'error', message });
      }
    });
  }

  private getHtml(): string {
    const css = `
      :root { 
        color-scheme: light dark;
        --primary-color: #007acc;
        --success-color: #4caf50;
        --error-color: #f44336;
        --warning-color: #ff9800;
        --border-radius: 8px;
        --spacing: 16px;
        --animation-speed: 0.2s;
      }
      
      * {
        box-sizing: border-box;
      }
      
      body { 
        margin: 0; 
        font-family: var(--vscode-font-family); 
        color: var(--vscode-foreground); 
        background: var(--vscode-editor-background);
        line-height: 1.6;
      }
      
      .container {
        max-width: 900px;
        margin: 0 auto;
        padding: var(--spacing);
      }
      
      .header {
        text-align: center;
        margin-bottom: calc(var(--spacing) * 2);
        padding-bottom: var(--spacing);
        border-bottom: 2px solid var(--vscode-editorWidget-border);
      }
      
      .header h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 300;
        color: var(--primary-color);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
      }
      
      .header .subtitle {
        margin-top: 8px;
        font-size: 14px;
        opacity: 0.8;
      }
      
      .section {
        margin: calc(var(--spacing) * 1.5) 0;
        padding: calc(var(--spacing) * 1.5);
        background: var(--vscode-editorWidget-background);
        border: 1px solid var(--vscode-editorWidget-border);
        border-radius: var(--border-radius);
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        transition: all var(--animation-speed) ease;
      }
      
      .section:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      }
      
      .section-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: var(--spacing);
        padding-bottom: 12px;
        border-bottom: 1px solid var(--vscode-editorWidget-border);
      }
      
      .section-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0;
      }
      
      .section-icon {
        font-size: 20px;
      }
      
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: var(--spacing);
      }
      
      .form-group {
        position: relative;
      }
      
      .form-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 600;
        font-size: 14px;
        color: var(--vscode-foreground);
      }
      
      .form-group .field-description {
        font-size: 12px;
        opacity: 0.7;
        margin-bottom: 8px;
      }
      
      input[type="text"], input[type="password"], select {
        width: 100%;
        padding: 12px 16px;
        border: 2px solid var(--vscode-input-border);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border-radius: var(--border-radius);
        font-size: 14px;
        transition: all var(--animation-speed) ease;
      }
      
      input:focus, select:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.2);
      }
      
      .input-with-icon {
        position: relative;
      }
      
      .input-icon {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        opacity: 0.5;
        pointer-events: none;
      }
      
      .buttons {
        display: flex;
        gap: 12px;
        margin-top: calc(var(--spacing) * 1.5);
        flex-wrap: wrap;
      }
      
      button {
        padding: 12px 24px;
        border: none;
        border-radius: var(--border-radius);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all var(--animation-speed) ease;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      button.primary {
        background: var(--primary-color);
        color: white;
      }
      
      button.primary:hover {
        background: #005a9e;
        transform: translateY(-1px);
      }
      
      button.secondary {
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: 1px solid var(--vscode-input-border);
      }
      
      button.secondary:hover {
        background: var(--vscode-list-hoverBackground);
        transform: translateY(-1px);
      }
      
      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none !important;
      }
      
      .status {
        margin-top: var(--spacing);
        padding: 12px 16px;
        border-radius: var(--border-radius);
        font-size: 14px;
        font-weight: 500;
        display: none;
        align-items: center;
        gap: 8px;
      }
      
      .status.show {
        display: flex;
      }
      
      .status.success {
        background: rgba(76, 175, 80, 0.1);
        color: var(--success-color);
        border: 1px solid var(--success-color);
      }
      
      .status.error {
        background: rgba(244, 67, 54, 0.1);
        color: var(--error-color);
        border: 1px solid var(--error-color);
      }
      
      .status.info {
        background: rgba(0, 122, 204, 0.1);
        color: var(--primary-color);
        border: 1px solid var(--primary-color);
      }
      
      .connection-status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 4px;
        margin-left: 8px;
      }
      
      .connection-status.connected {
        background: rgba(76, 175, 80, 0.2);
        color: var(--success-color);
      }
      
      .connection-status.disconnected {
        background: rgba(244, 67, 54, 0.2);
        color: var(--error-color);
      }
      
      .help-text {
        margin-top: calc(var(--spacing) * 2);
        padding: var(--spacing);
        background: var(--vscode-textCodeBlock-background);
        border-left: 4px solid var(--primary-color);
        border-radius: 0 var(--border-radius) var(--border-radius) 0;
        font-size: 14px;
      }
      
      .help-text h3 {
        margin: 0 0 12px;
        color: var(--primary-color);
      }
      
      .help-text ul {
        margin: 0;
        padding-left: 20px;
      }
      
      .help-text li {
        margin-bottom: 8px;
      }
      
      @keyframes pulse {
        0% { opacity: 0.6; }
        50% { opacity: 1; }
        100% { opacity: 0.6; }
      }
      
      .loading {
        animation: pulse 1.5s infinite;
      }
    `;
    const js = `
      const vscode = acquireVsCodeApi();
      const byId = (id) => document.getElementById(id);
      
      let connectionStatus = {
        jira: null,
        ollama: null
      };
      
      function load() { 
        vscode.postMessage({ type: 'requestSettings' }); 
        updateConnectionStatus();
      }
      
      function save() {
        const saveBtn = byId('saveBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '⏳ Saving...';
        
        const settings = {
          jiraBaseUrl: byId('jiraBaseUrl').value.trim(),
          jiraToken: byId('jiraToken').value.trim(),
          ollamaModel: byId('ollamaModel').value.trim(),
          openrouterApiKey: byId('openrouterApiKey').value.trim(),
        };
        
        vscode.postMessage({ type: 'saveSettings', settings });
      }
      
      function testConnection(provider) {
        const button = byId(provider + 'TestBtn');
        button.disabled = true;
        button.innerHTML = '⏳ Testing...';
        button.classList.add('loading');
        
        vscode.postMessage({ type: 'test' + provider.charAt(0).toUpperCase() + provider.slice(1) });
      }
      
      function showStatus(message, type = 'info', duration = 5000) {
        const status = byId('status');
        status.className = 'status show ' + type;
        status.innerHTML = getStatusIcon(type) + ' ' + message;
        
        setTimeout(() => {
          status.classList.remove('show');
        }, duration);
      }
      
      function getStatusIcon(type) {
        const icons = {
          success: '✅',
          error: '❌',
          info: 'ℹ️',
          warning: '⚠️'
        };
        return icons[type] || 'ℹ️';
      }
      
      function updateConnectionStatus() {
        const jiraStatus = byId('jiraStatus');
        const ollamaStatus = byId('ollamaStatus');
        
        if (connectionStatus.jira !== null) {
          jiraStatus.className = 'connection-status ' + (connectionStatus.jira ? 'connected' : 'disconnected');
          jiraStatus.innerHTML = (connectionStatus.jira ? '🟢 Connected' : '🔴 Disconnected');
        }
        
        if (connectionStatus.ollama !== null) {
          ollamaStatus.className = 'connection-status ' + (connectionStatus.ollama ? 'connected' : 'disconnected');
          ollamaStatus.innerHTML = (connectionStatus.ollama ? '🟢 Connected' : '🔴 Disconnected');
        }
      }
      
      function resetTestButton(provider, success) {
        const button = byId(provider + 'TestBtn');
        button.disabled = false;
        button.classList.remove('loading');
        button.innerHTML = '🔍 Test ' + provider.charAt(0).toUpperCase() + provider.slice(1);
      }
      
      window.addEventListener('message', (e) => {
        const msg = e.data;
        
        if (msg.type === 'settings') {
          const s = msg.settings || {};
          byId('jiraBaseUrl').value = s.jiraBaseUrl || '';
          byId('jiraToken').value = s.jiraToken || '';
          byId('ollamaModel').value = s.ollamaModel || 'llama2:13b';
          byId('openrouterApiKey').value = s.openrouterApiKey || '';
          
        } else if (msg.type === 'saveResult') {
          const saveBtn = byId('saveBtn');
          saveBtn.disabled = false;
          saveBtn.innerHTML = '💾 Save Configuration';
          
          if (msg.ok) {
            showStatus('Configuration saved successfully!', 'success');
          } else {
            showStatus('Failed to save configuration', 'error');
          }
          
        } else if (msg.type === 'testResult') {
          const provider = msg.provider;
          connectionStatus[provider] = msg.ok;
          updateConnectionStatus();
          resetTestButton(provider, msg.ok);
          
          const statusText = provider.charAt(0).toUpperCase() + provider.slice(1) + ' connection ' + (msg.ok ? 'successful!' : 'failed');
          showStatus(statusText + (msg.message ? ' - ' + msg.message : ''), msg.ok ? 'success' : 'error');
          
        } else if (msg.type === 'error') {
          showStatus('Error: ' + msg.message, 'error');
          // Reset any loading buttons
          ['jira', 'ollama'].forEach(provider => resetTestButton(provider, false));
          const saveBtn = byId('saveBtn');
          saveBtn.disabled = false;
          saveBtn.innerHTML = '💾 Save Configuration';
        }
      });
      
      // Auto-save on input changes (debounced)
      let saveTimeout;
      function autoSave() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          const saveBtn = byId('saveBtn');
          if (!saveBtn.disabled) {
            save();
          }
        }, 2000);
      }
      
      // Add event listeners for auto-save
      window.addEventListener('load', () => {
        load();
        ['jiraBaseUrl', 'jiraToken', 'ollamaModel', 'openrouterApiKey'].forEach(id => {
          byId(id).addEventListener('input', autoSave);
        });
      });
    `;
    return `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>AI Plan Settings</title>
        <style>${css}</style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🤖 AI Plan Configuration</h1>
            <div class="subtitle">Configure your ticketing systems and AI providers</div>
          </div>
          
          <div class="section">
            <div class="section-header">
              <div class="section-icon">🏢</div>
              <h2 class="section-title">Jira Integration</h2>
              <span id="jiraStatus" class="connection-status">🔄 Unknown</span>
            </div>
            
            <div class="form-grid">
              <div class="form-group">
                <label for="jiraBaseUrl">Jira Base URL</label>
                <div class="field-description">Your Jira instance URL (e.g., https://company.atlassian.net)</div>
                <div class="input-with-icon">
                  <input id="jiraBaseUrl" type="text" placeholder="https://company.atlassian.net" />
                  <span class="input-icon">🌐</span>
                </div>
              </div>
              
              <div class="form-group">
                <label for="jiraToken">Personal Access Token</label>
                <div class="field-description">Create a token in your Jira account settings</div>
                <div class="input-with-icon">
                  <input id="jiraToken" type="password" placeholder="Enter your Jira token" />
                  <span class="input-icon">🔑</span>
                </div>
              </div>
            </div>
            
            <div class="buttons">
              <button id="jiraTestBtn" class="secondary" onclick="testConnection('jira')">🔍 Test Jira</button>
            </div>
          </div>
          
          <div class="section">
            <div class="section-header">
              <div class="section-icon">🧠</div>
              <h2 class="section-title">AI Providers</h2>
              <span id="ollamaStatus" class="connection-status">🔄 Unknown</span>
            </div>
            
            <div class="form-grid">
              <div class="form-group">
                <label for="ollamaModel">Ollama Model</label>
                <div class="field-description">Local AI model for plan generation (requires Ollama running)</div>
                <select id="ollamaModel">
                  <option value="llama2:13b">Llama2 13B (Recommended)</option>
                  <option value="llama2:7b">Llama2 7B (Faster)</option>
                  <option value="codellama:7b">CodeLlama 7B (Code-focused)</option>
                  <option value="codellama:13b">CodeLlama 13B (Code-focused)</option>
                  <option value="mistral:7b">Mistral 7B</option>
                  <option value="custom">Custom Model</option>
                </select>
              </div>
              
              <div class="form-group">
                <label for="openrouterApiKey">OpenRouter API Key (Optional)</label>
                <div class="field-description">Cloud AI alternative - get your key from openrouter.ai</div>
                <div class="input-with-icon">
                  <input id="openrouterApiKey" type="password" placeholder="sk-or-..." />
                  <span class="input-icon">☁️</span>
                </div>
              </div>
            </div>
            
            <div class="buttons">
              <button id="ollamaTestBtn" class="secondary" onclick="testConnection('ollama')">🔍 Test Ollama</button>
            </div>
          </div>
          
          <div class="buttons" style="justify-content: center; margin-top: 32px;">
            <button id="saveBtn" class="primary" onclick="save()">💾 Save Configuration</button>
          </div>
          
          <div id="status" class="status"></div>
          
          <div class="help-text">
            <h3>📚 Quick Setup Guide</h3>
            <ul>
              <li><strong>Jira:</strong> Go to Jira → Settings → Personal Access Tokens → Create Token</li>
              <li><strong>Ollama:</strong> Install from <code>ollama.ai</code>, then run <code>ollama pull llama2:13b</code></li>
              <li><strong>OpenRouter:</strong> Visit <code>openrouter.ai</code> to get your API key (optional)</li>
              <li><strong>Auto-save:</strong> Settings are automatically saved as you type</li>
            </ul>
          </div>
        </div>
        
        <script>${js}</script>
      </body>
      </html>`;
  }
}


