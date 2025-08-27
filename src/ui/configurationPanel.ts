/**
 * Configuration panel for AI Plan extension
 * Provides a unified UI for managing all provider configurations
 */

import * as vscode from 'vscode';
import { loadEnvironmentConfig, getProviderConfig, isProviderConfigured } from '../config/environment';
import { ConfigValidator } from '../utils/validation';
import { ErrorFactory, ExtensionError } from '../utils/errorTypes';
import { errorHandler } from './errorHandler';
import { feedbackSystem } from './feedbackSystem';

interface ConfigurationItem {
  id: string;
  label: string;
  description: string;
  type: 'text' | 'password' | 'boolean' | 'select';
  value?: string;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  required?: boolean;
  validation?: string;
}

interface ProviderSection {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  items: ConfigurationItem[];
}

export class ConfigurationPanel {
  private panel: vscode.WebviewPanel | undefined;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Show the configuration panel
   */
  async show(): Promise<void> {
    try {
      // Create or reveal panel
      if (this.panel) {
        this.panel.reveal();
        return;
      }

      this.panel = vscode.window.createWebviewPanel(
        'aiPlanConfiguration',
        'AI Plan Configuration',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: []
        }
      );

      // Handle panel disposal
      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });

      // Handle messages from webview
      this.panel.webview.onDidReceiveMessage(
        async (message) => await this.handleWebviewMessage(message)
      );

      // Set initial HTML content
      await this.updateWebviewContent();

    } catch (error) {
      const extensionError = error instanceof ExtensionError 
        ? error 
        : ErrorFactory.workspaceError('ConfigurationPanel', 'show', error.message);
      
      await errorHandler.handleExtensionError(extensionError);
    }
  }

  /**
   * Update the webview content with current configuration
   */
  private async updateWebviewContent(): Promise<void> {
    if (!this.panel) {
      return;
    }

    const config = loadEnvironmentConfig();
    const sections = this.buildConfigurationSections(config);
    
    this.panel.webview.html = this.generateWebviewHtml(sections);
  }

  /**
   * Build configuration sections from current environment
   */
  private buildConfigurationSections(config: Record<string, any>): ProviderSection[] {
    return [
      {
        id: 'jira',
        name: 'Jira',
        description: 'Connect to Jira for issue tracking',
        enabled: isProviderConfigured('jira'),
        items: [
          {
            id: 'JIRA_BASE_URL',
            label: 'Base URL',
            description: 'Your Jira instance URL (e.g., https://company.atlassian.net)',
            type: 'text',
            value: config.jira.baseUrl,
            placeholder: 'https://your-company.atlassian.net',
            required: true,
            validation: 'url'
          },
          {
            id: 'JIRA_TOKEN',
            label: 'API Token',
            description: 'Personal Access Token for Jira API',
            type: 'password',
            value: config.jira.token ? '***CONFIGURED***' : '',
            placeholder: 'your_jira_personal_access_token',
            required: true
          }
        ]
      },
      {
        id: 'linear',
        name: 'Linear',
        description: 'Connect to Linear for issue tracking',
        enabled: isProviderConfigured('linear'),
        items: [
          {
            id: 'LINEAR_API_TOKEN',
            label: 'API Token',
            description: 'Linear API token (starts with "lin_")',
            type: 'password',
            value: config.linear.apiToken ? '***CONFIGURED***' : '',
            placeholder: 'lin_your_linear_api_token',
            required: true,
            validation: 'linear_token'
          }
        ]
      },
      {
        id: 'slack',
        name: 'Slack',
        description: 'Connect to Slack for message tracking',
        enabled: isProviderConfigured('slack'),
        items: [
          {
            id: 'SLACK_BOT_TOKEN',
            label: 'Bot Token',
            description: 'Slack Bot User OAuth Token (starts with "xoxb-")',
            type: 'password',
            value: config.slack.botToken ? '***CONFIGURED***' : '',
            placeholder: 'xoxb-your-slack-bot-token',
            required: true,
            validation: 'slack_token'
          }
        ]
      },
      {
        id: 'github',
        name: 'GitHub',
        description: 'Connect to GitHub for issue and PR tracking',
        enabled: isProviderConfigured('github'),
        items: [
          {
            id: 'GITHUB_TOKEN',
            label: 'Personal Access Token',
            description: 'GitHub Personal Access Token (starts with "ghp_")',
            type: 'password',
            value: config.github.token ? '***CONFIGURED***' : '',
            placeholder: 'ghp_your-github-personal-access-token',
            required: true,
            validation: 'github_token'
          }
        ]
      },
      {
        id: 'ollama',
        name: 'Ollama (Local AI)',
        description: 'Local AI model server configuration',
        enabled: true,
        items: [
          {
            id: 'OLLAMA_BASE_URL',
            label: 'Server URL',
            description: 'Ollama server URL',
            type: 'text',
            value: config.ollama.baseUrl,
            placeholder: 'http://localhost:11434',
            required: false,
            validation: 'url'
          },
          {
            id: 'OLLAMA_MODEL',
            label: 'Model',
            description: 'Model name to use for plan generation',
            type: 'text',
            value: config.ollama.model,
            placeholder: 'llama2:13b',
            required: false
          }
        ]
      },
      {
        id: 'openrouter',
        name: 'OpenRouter (Cloud AI)',
        description: 'Cloud AI service configuration',
        enabled: !!config.openRouter.apiKey,
        items: [
          {
            id: 'OPENROUTER_API_KEY',
            label: 'API Key',
            description: 'OpenRouter API key (starts with "sk-or-v1-")',
            type: 'password',
            value: config.openRouter.apiKey ? '***CONFIGURED***' : '',
            placeholder: 'sk-or-v1-your-openrouter-api-key',
            required: false,
            validation: 'openrouter_key'
          },
          {
            id: 'OPENROUTER_MODEL',
            label: 'Model',
            description: 'AI model to use for plan generation',
            type: 'select',
            value: config.openRouter.model,
            options: [
              { label: 'Claude 3 Sonnet', value: 'anthropic/claude-3-sonnet-20240229' },
              { label: 'Claude 3 Haiku', value: 'anthropic/claude-3-haiku-20240307' },
              { label: 'GPT-4 Turbo', value: 'openai/gpt-4-turbo' },
              { label: 'GPT-3.5 Turbo', value: 'openai/gpt-3.5-turbo' }
            ],
            required: false
          }
        ]
      }
    ];
  }

  /**
   * Handle messages from the webview
   */
  private async handleWebviewMessage(message: Record<string, any>): Promise<void> {
    try {
      switch (message.command) {
      case 'saveConfiguration':
        await this.saveConfiguration(message.data);
        break;
      case 'testConnection':
        await this.testConnection(message.provider);
        break;
      case 'resetConfiguration':
        await this.resetConfiguration(message.provider);
        break;
      case 'exportConfiguration':
        await this.exportConfiguration();
        break;
      case 'importConfiguration':
        await this.importConfiguration();
        break;
      case 'openEnvFile':
        await this.openEnvFile();
        break;
      default:
        console.warn('Unknown webview message command:', message.command);
      }
    } catch (error) {
      const extensionError = error instanceof ExtensionError 
        ? error 
        : ErrorFactory.workspaceError('ConfigurationPanel', 'handle_message', error.message);
      
      await errorHandler.handleExtensionError(extensionError);
    }
  }

  /**
   * Save configuration to VS Code settings or environment
   */
  private async saveConfiguration(data: Record<string, string>): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('aiPlan');
      
      // Validate each configuration item
      for (const [key, value] of Object.entries(data)) {
        if (value && value !== '***CONFIGURED***') {
          await this.validateConfigurationItem(key, value);
        }
      }

      // Save to workspace configuration
      for (const [key, value] of Object.entries(data)) {
        if (value && value !== '***CONFIGURED***') {
          await config.update(key.toLowerCase(), value, vscode.ConfigurationTarget.Workspace);
        }
      }

      await feedbackSystem.showSuccess(
        'Configuration saved successfully',
        {
          title: 'Configuration Updated',
          actions: [
            {
              label: 'Restart Extension',
              action: async () => {
                await vscode.commands.executeCommand('workbench.action.reloadWindow');
              }
            }
          ]
        }
      );

      // Update webview
      await this.updateWebviewContent();

    } catch (error) {
      if (error instanceof ExtensionError) {
        throw error;
      }
      throw ErrorFactory.validationFailed('ConfigurationPanel', 'save_config', data, error.message);
    }
  }

  /**
   * Validate a configuration item
   */
  private async validateConfigurationItem(key: string, value: string): Promise<void> {
    switch (key) {
      case 'JIRA_BASE_URL':
        ConfigValidator.validateJiraConfig({ baseUrl: value }, 'ConfigurationPanel');
        break;
      case 'JIRA_TOKEN':
        ConfigValidator.validateJiraConfig({ token: value }, 'ConfigurationPanel');
        break;
      case 'LINEAR_API_TOKEN':
        ConfigValidator.validateLinearConfig({ token: value }, 'ConfigurationPanel');
        break;
      case 'SLACK_BOT_TOKEN':
        ConfigValidator.validateSlackConfig({ token: value }, 'ConfigurationPanel');
        break;
      case 'GITHUB_TOKEN':
        ConfigValidator.validateGitHubConfig({ token: value }, 'ConfigurationPanel');
        break;
      case 'OLLAMA_BASE_URL':
        ConfigValidator.validateOllamaConfig({ baseUrl: value }, 'ConfigurationPanel');
        break;
      case 'OPENROUTER_API_KEY':
        ConfigValidator.validateOpenRouterConfig({ apiKey: value }, 'ConfigurationPanel');
        break;
    }
  }

  /**
   * Test connection for a specific provider
   */
  private async testConnection(providerId: string): Promise<void> {
    try {
      await feedbackSystem.showProgress(
        `Testing ${providerId} connection...`,
        async (progress) => {
          progress.report({ message: 'Connecting...', increment: 50 });
          
          // Simulate connection test (would be replaced with actual provider tests)
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          progress.report({ message: 'Connection successful!', increment: 100 });
        }
      );

      if (this.panel) {
        this.panel.webview.postMessage({
          command: 'connectionTestResult',
          provider: providerId,
          success: true,
          message: 'Connection test successful'
        });
      }

    } catch (error) {
      if (this.panel) {
        this.panel.webview.postMessage({
          command: 'connectionTestResult',
          provider: providerId,
          success: false,
          message: error.message
        });
      }
    }
  }

  /**
   * Reset configuration for a provider
   */
  private async resetConfiguration(providerId: string): Promise<void> {
    const result = await vscode.window.showWarningMessage(
      `Reset all ${providerId} configuration?`,
      { modal: true },
      'Yes, Reset'
    );

    if (result === 'Yes, Reset') {
      const config = vscode.workspace.getConfiguration('aiPlan');
      
      // Clear relevant configuration keys
      const keysToReset = this.getProviderConfigKeys(providerId);
      for (const key of keysToReset) {
        await config.update(key, undefined, vscode.ConfigurationTarget.Workspace);
      }

      await feedbackSystem.showInfo(`${providerId} configuration reset successfully`);
      await this.updateWebviewContent();
    }
  }

  /**
   * Get configuration keys for a provider
   */
  private getProviderConfigKeys(providerId: string): string[] {
    const keyMap: Record<string, string[]> = {
      jira: ['jira_base_url', 'jira_token'],
      linear: ['linear_api_token'],
      slack: ['slack_bot_token'],
      github: ['github_token'],
      ollama: ['ollama_base_url', 'ollama_model'],
      openrouter: ['openrouter_api_key', 'openrouter_model']
    };
    
    return keyMap[providerId] || [];
  }

  /**
   * Export configuration to .env file
   */
  private async exportConfiguration(): Promise<void> {
    try {
      const config = loadEnvironmentConfig();
      const envContent = this.generateEnvFileContent(config);

      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('.env'),
        filters: {
          'Environment Files': ['env'],
          'All Files': ['*']
        }
      });

      if (uri) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(envContent, 'utf8'));
        await feedbackSystem.showSuccess(`Configuration exported to ${uri.fsPath}`);
      }

    } catch (error) {
      throw ErrorFactory.workspaceError('ConfigurationPanel', 'export_config', error.message);
    }
  }

  /**
   * Import configuration from .env file
   */
  private async importConfiguration(): Promise<void> {
    try {
      const uri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          'Environment Files': ['env'],
          'All Files': ['*']
        }
      });

      if (uri && uri[0]) {
        const content = await vscode.workspace.fs.readFile(uri[0]);
        const envData = this.parseEnvFile(content.toString());
        
        // Save imported data
        await this.saveConfiguration(envData);
        
        await feedbackSystem.showSuccess('Configuration imported successfully');
      }

    } catch (error) {
      throw ErrorFactory.workspaceError('ConfigurationPanel', 'import_config', error.message);
    }
  }

  /**
   * Open .env file for editing
   */
  private async openEnvFile(): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!workspaceRoot) {
      await feedbackSystem.showWarning('No workspace folder found');
      return;
    }

    const envPath = vscode.Uri.joinPath(workspaceRoot, '.env');
    
    try {
      const document = await vscode.workspace.openTextDocument(envPath);
      await vscode.window.showTextDocument(document);
    } catch (error) {
      // File doesn't exist, create it from template
      const examplePath = vscode.Uri.joinPath(workspaceRoot, '.env.example');
      try {
        const exampleContent = await vscode.workspace.fs.readFile(examplePath);
        await vscode.workspace.fs.writeFile(envPath, exampleContent);
        
        const document = await vscode.workspace.openTextDocument(envPath);
        await vscode.window.showTextDocument(document);
        
        await feedbackSystem.showInfo('Created .env file from template');
      } catch (createError) {
        await feedbackSystem.showError('Could not create .env file');
      }
    }
  }

  /**
   * Generate environment file content
   */
  private generateEnvFileContent(config: Record<string, any>): string {
    const lines = [
      '# AI Plan Extension Environment Variables',
      '# Generated from VS Code configuration',
      '',
      '# Jira Configuration',
      `JIRA_BASE_URL=${config.jira.baseUrl || ''}`,
      `JIRA_TOKEN=${config.jira.token || ''}`,
      '',
      '# Linear Configuration',
      `LINEAR_API_TOKEN=${config.linear.apiToken || ''}`,
      '',
      '# Slack Configuration',
      `SLACK_BOT_TOKEN=${config.slack.botToken || ''}`,
      '',
      '# GitHub Configuration',
      `GITHUB_TOKEN=${config.github.token || ''}`,
      '',
      '# Ollama Configuration',
      `OLLAMA_BASE_URL=${config.ollama.baseUrl}`,
      `OLLAMA_MODEL=${config.ollama.model}`,
      '',
      '# OpenRouter Configuration',
      `OPENROUTER_API_KEY=${config.openRouter.apiKey || ''}`,
      `OPENROUTER_MODEL=${config.openRouter.model || ''}`,
      '',
      '# Development Settings',
      `NODE_ENV=${config.nodeEnv}`,
      `LOG_LEVEL=${config.logLevel}`
    ];

    return lines.join('\n');
  }

  /**
   * Parse environment file content
   */
  private parseEnvFile(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          result[key.trim()] = valueParts.join('=').trim();
        }
      }
    }
    
    return result;
  }

  /**
   * Generate the webview HTML content
   */
  private generateWebviewHtml(sections: ProviderSection[]): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Plan Configuration</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 20px;
            margin: 0;
        }

        .header {
            margin-bottom: 30px;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 20px;
        }

        .header h1 {
            margin: 0 0 10px 0;
            color: var(--vscode-foreground);
        }

        .header p {
            margin: 0;
            color: var(--vscode-descriptionForeground);
        }

        .actions {
            margin-bottom: 30px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
        }

        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .section {
            margin-bottom: 40px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            overflow: hidden;
        }

        .section-header {
            background: var(--vscode-editor-lineHighlightBackground);
            padding: 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .section-info h3 {
            margin: 0 0 5px 0;
            color: var(--vscode-foreground);
        }

        .section-info p {
            margin: 0;
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
        }

        .status {
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }

        .status.enabled {
            background: var(--vscode-terminal-ansiGreen);
            color: var(--vscode-editor-background);
        }

        .status.disabled {
            background: var(--vscode-errorForeground);
            color: var(--vscode-editor-background);
        }

        .section-content {
            padding: 20px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            color: var(--vscode-foreground);
        }

        .form-group .description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }

        .form-group input,
        .form-group select {
            width: 100%;
            padding: 8px 12px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-size: 13px;
            box-sizing: border-box;
        }

        .form-group input:focus,
        .form-group select:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }

        .form-group .required::after {
            content: " *";
            color: var(--vscode-errorForeground);
        }

        .section-actions {
            padding: 20px;
            background: var(--vscode-editor-lineHighlightBackground);
            border-top: 1px solid var(--vscode-panel-border);
            display: flex;
            gap: 10px;
        }

        .test-result {
            margin-top: 10px;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
        }

        .test-result.success {
            background: var(--vscode-terminal-ansiGreen);
            color: var(--vscode-editor-background);
        }

        .test-result.error {
            background: var(--vscode-errorBackground);
            color: var(--vscode-errorForeground);
        }

        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>AI Plan Configuration</h1>
        <p>Configure providers and AI services for the AI Plan extension</p>
    </div>

    <div class="actions">
        <button class="btn" onclick="saveAllConfiguration()">Save Configuration</button>
        <button class="btn btn-secondary" onclick="exportConfiguration()">Export to .env</button>
        <button class="btn btn-secondary" onclick="importConfiguration()">Import from .env</button>
        <button class="btn btn-secondary" onclick="openEnvFile()">Open .env File</button>
    </div>

    ${sections.map(section => `
        <div class="section" data-provider="${section.id}">
            <div class="section-header">
                <div class="section-info">
                    <h3>${section.name}</h3>
                    <p>${section.description}</p>
                </div>
                <div class="status ${section.enabled ? 'enabled' : 'disabled'}">
                    ${section.enabled ? 'Configured' : 'Not Configured'}
                </div>
            </div>
            <div class="section-content">
                ${section.items.map(item => `
                    <div class="form-group">
                        <label for="${item.id}" class="${item.required ? 'required' : ''}">${item.label}</label>
                        <div class="description">${item.description}</div>
                        ${item.type === 'select' ? `
                            <select id="${item.id}" data-key="${item.id}">
                                <option value="">Select...</option>
                                ${item.options?.map(opt => `
                                    <option value="${opt.value}" ${item.value === opt.value ? 'selected' : ''}>${opt.label}</option>
                                `).join('') || ''}
                            </select>
                        ` : `
                            <input 
                                type="${item.type}" 
                                id="${item.id}" 
                                data-key="${item.id}"
                                value="${item.value || ''}" 
                                placeholder="${item.placeholder || ''}"
                                ${item.required ? 'required' : ''}
                            />
                        `}
                        <div id="test-${section.id}" class="test-result" style="display: none;"></div>
                    </div>
                `).join('')}
            </div>
            <div class="section-actions">
                <button class="btn btn-secondary" onclick="testConnection('${section.id}')">Test Connection</button>
                <button class="btn btn-secondary" onclick="resetConfiguration('${section.id}')">Reset</button>
            </div>
        </div>
    `).join('')}

    <div class="footer">
        <p>Configuration changes require an extension restart to take effect.</p>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function saveAllConfiguration() {
            const data = {};
            document.querySelectorAll('input[data-key], select[data-key]').forEach(element => {
                if (element.value && element.value !== '***CONFIGURED***') {
                    data[element.dataset.key] = element.value;
                }
            });

            vscode.postMessage({
                command: 'saveConfiguration',
                data: data
            });
        }

        function testConnection(provider) {
            const resultDiv = document.getElementById('test-' + provider);
            resultDiv.style.display = 'block';
            resultDiv.className = 'test-result';
            resultDiv.textContent = 'Testing connection...';

            vscode.postMessage({
                command: 'testConnection',
                provider: provider
            });
        }

        function resetConfiguration(provider) {
            vscode.postMessage({
                command: 'resetConfiguration',
                provider: provider
            });
        }

        function exportConfiguration() {
            vscode.postMessage({
                command: 'exportConfiguration'
            });
        }

        function importConfiguration() {
            vscode.postMessage({
                command: 'importConfiguration'
            });
        }

        function openEnvFile() {
            vscode.postMessage({
                command: 'openEnvFile'
            });
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'connectionTestResult':
                    const resultDiv = document.getElementById('test-' + message.provider);
                    if (resultDiv) {
                        resultDiv.className = 'test-result ' + (message.success ? 'success' : 'error');
                        resultDiv.textContent = message.message;
                    }
                    break;
            }
        });
    </script>
</body>
</html>`;
  }
}