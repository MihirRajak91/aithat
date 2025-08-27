"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamingPanel = void 0;
const vscode = __importStar(require("vscode"));
class StreamingPanel {
    constructor(title) {
        this.isDisposed = false;
        this.panel = vscode.window.createWebviewPanel('aiPlanStreaming', title, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }, { enableScripts: true, retainContextWhenHidden: true });
        this.panel.onDidDispose(() => { this.isDisposed = true; });
        this.panel.webview.html = this.getHtml();
    }
    setHeader(headerMarkdown) {
        if (this.isDisposed) {
            return;
        }
        this.panel.webview.postMessage({ type: 'header', markdown: headerMarkdown });
    }
    setProgress(current, total) {
        if (this.isDisposed) {
            return;
        }
        this.panel.webview.postMessage({ type: 'progress', current, total });
    }
    appendToken(text) {
        if (this.isDisposed) {
            return;
        }
        this.panel.webview.postMessage({ type: 'append', text });
    }
    finish() {
        if (this.isDisposed) {
            return;
        }
        this.panel.webview.postMessage({ type: 'done' });
    }
    getHtml() {
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
      const content = document.getElementById('planContent');
      const headerTitle = document.getElementById('headerTitle');
      const headerSubtitle = document.getElementById('headerSubtitle');
      const headerStatus = document.getElementById('headerStatus');
      const progressBar = document.getElementById('progressBar');
      const completionMessage = document.getElementById('completionMessage');
      const copyBtn = document.getElementById('copyBtn');
      const saveBtn = document.getElementById('saveBtn');
      const clearBtn = document.getElementById('clearBtn');
      const wordCount = document.getElementById('wordCount');
      const charCount = document.getElementById('charCount');
      const timeElapsed = document.getElementById('timeElapsed');
      const vscodeApi = acquireVsCodeApi();
      
      let startTime = Date.now();
      let isGenerating = true;
      let totalWords = 0;
      let totalChars = 0;
      
      function updateStats() {
        const text = content.textContent || '';
        totalWords = text.trim() ? text.trim().split(/\\s+/).length : 0;
        totalChars = text.length;
        
        wordCount.textContent = totalWords;
        charCount.textContent = totalChars;
        
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        timeElapsed.textContent = minutes > 0 ? minutes + 'm ' + seconds + 's' : seconds + 's';
      }
      
      function showTypingIndicator() {
        if (isGenerating) {
          const indicator = document.createElement('span');
          indicator.className = 'typing-indicator';
          indicator.id = 'typingIndicator';
          content.appendChild(indicator);
        }
      }
      
      function removeTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
          indicator.remove();
        }
      }
      
      function updateProgress(current, total) {
        const percent = total > 0 ? (current / total) * 100 : 0;
        progressBar.style.width = Math.min(percent, 100) + '%';
      }

      window.addEventListener('message', (event) => {
        const msg = event.data;
        
        if (msg.type === 'header') {
          headerTitle.textContent = msg.markdown;
          headerSubtitle.textContent = 'Generating implementation plan with AI';
          headerStatus.innerHTML = '⏳ Generating...';
          startTime = Date.now();
          
          // Clear empty state
          content.innerHTML = '';
          showTypingIndicator();
          
        } else if (msg.type === 'append') {
          removeTypingIndicator();
          content.textContent += msg.text;
          content.scrollTop = content.scrollHeight;
          updateStats();
          
          // Simulate progress based on content length (rough estimation)
          const estimatedTotal = 2000; // Average plan length
          updateProgress(totalChars, estimatedTotal);
          
        } else if (msg.type === 'done') {
          isGenerating = false;
          removeTypingIndicator();
          
          headerStatus.innerHTML = '✅ Completed';
          headerSubtitle.textContent = 'Implementation plan ready';
          
          completionMessage.innerHTML = '🎉 <strong>Plan Generated Successfully!</strong><br>Your AI-powered implementation plan is ready to use.';
          completionMessage.classList.add('show');
          
          progressBar.style.width = '100%';
          
          // Enable save/copy buttons
          saveBtn.disabled = false;
          copyBtn.disabled = false;
          
          updateStats();
        }
      });

      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(content.textContent || '');
          copyBtn.innerHTML = '✅ Copied!';
          setTimeout(() => {
            copyBtn.innerHTML = '📋 Copy Plan';
          }, 2000);
        } catch (e) {
          vscodeApi.postMessage({ type: 'copyFallback', text: content.textContent || '' });
        }
      });
      
      saveBtn.addEventListener('click', () => {
        vscodeApi.postMessage({ type: 'saveAsMarkdown', text: content.textContent || '' });
        saveBtn.innerHTML = '✅ Saved!';
        setTimeout(() => {
          saveBtn.innerHTML = '💾 Save as Markdown';
        }, 2000);
      });
      
      clearBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the current plan?')) {
          content.textContent = '';
          completionMessage.classList.remove('show');
          updateStats();
          progressBar.style.width = '0%';
        }
      });
      
      // Update stats every second
      setInterval(updateStats, 1000);
    `;
        return `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>AI Plan Generator</title>
        <style>${css}</style>
      </head>
      <body>
        <div class="container">
          <div class="progress-bar" id="progressBar"></div>
          
          <div class="header">
            <div class="header-content">
              <div class="header-icon">🤖</div>
              <div class="header-text">
                <h1 class="header-title" id="headerTitle">AI Plan Generator</h1>
                <div class="header-subtitle" id="headerSubtitle">Initializing...</div>
              </div>
            </div>
            <div class="header-status" id="headerStatus">⏳ Starting...</div>
          </div>
          
          <div class="content">
            <div class="content-wrapper">
              <div class="plan-content" id="planContent">
                <div class="empty-state">
                  <div class="empty-icon">📝</div>
                  <div>Waiting for AI to generate your implementation plan...</div>
                </div>
              </div>
              
              <div class="completion-message" id="completionMessage"></div>
            </div>
          </div>
          
          <div class="toolbar">
            <div class="toolbar-section">
              <button id="copyBtn" class="secondary" disabled>📋 Copy Plan</button>
              <button id="saveBtn" class="primary" disabled>💾 Save as Markdown</button>
            </div>
            
            <div class="toolbar-divider"></div>
            
            <div class="toolbar-section">
              <button id="clearBtn" class="secondary">🗑️ Clear</button>
            </div>
            
            <div style="flex: 1;"></div>
            
            <div class="stats">
              <div class="stat-item">
                <span>🔤</span>
                <span id="wordCount">0</span> words
              </div>
              <div class="stat-item">
                <span>📊</span>
                <span id="charCount">0</span> chars
              </div>
              <div class="stat-item">
                <span>⏱️</span>
                <span id="timeElapsed">0s</span>
              </div>
            </div>
          </div>
        </div>
        
        <script>${js}</script>
      </body>
      </html>`;
    }
}
exports.StreamingPanel = StreamingPanel;
//# sourceMappingURL=streamingPanel.js.map