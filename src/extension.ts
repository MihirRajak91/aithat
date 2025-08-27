import * as vscode from 'vscode';
import { RecentTicketsPicker } from './ui/recentTicketsPicker';
import { PlanGenerator } from './ui/planGenerator';
import { setExtensionContext } from './context';
import { SettingsPanel } from './ui/settingsPanel';
import { feedbackSystem } from './ui/feedbackSystem';
import { errorHandler } from './ui/errorHandler';
import { loadDotenv } from './config/dotenv-loader';
import { getMaskedConfig } from './config/environment';

export function activate(context: vscode.ExtensionContext) {
  console.log('AI Plan extension is now active!');
  
  // Load environment variables from .env file
  loadDotenv(context.extensionPath);
  console.log('Environment configuration:', getMaskedConfig());
  
  setExtensionContext(context);

  // Register the main command with enhanced UI
  const disposable = vscode.commands.registerCommand('ai-plan.generateFromRecent', async () => {
    try {
      feedbackSystem.showStatusBarMessage('$(search) Selecting ticket...', 'info');
      
      const picker = new RecentTicketsPicker();
      const ticket = await picker.showRecentTickets();
      
      if (ticket) {
        feedbackSystem.showStatusBarMessage('$(rocket) Generating plan...', 'progress');
        const generator = new PlanGenerator();
        await generator.generatePlan(ticket);
      } else {
        feedbackSystem.showStatusBarMessage('$(info) No ticket selected', 'info', 2000);
      }
    } catch (error) {
      console.error('Error in generateFromRecent command:', error);
      await errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'ticket_selection',
        [
          {
            label: 'Try Again',
            action: async () => {
              await vscode.commands.executeCommand('ai-plan.generateFromRecent');
            }
          },
          {
            label: 'Check Settings',
            action: async () => {
              await vscode.commands.executeCommand('ai-plan.settings');
            }
          }
        ]
      );
    }
  });

  context.subscriptions.push(disposable);

  // Register a streaming variant that writes into Output Channel
  const streamingDisposable = vscode.commands.registerCommand('ai-plan.generateFromRecentStreaming', async () => {
    try {
      const picker = new RecentTicketsPicker();
      const ticket = await picker.showRecentTickets();
      
      if (ticket) {
        const generator = new PlanGenerator();
        await generator.generatePlan(ticket);
      }
    } catch (error) {
      console.error('Error in generateFromRecentStreaming command:', error);
      await vscode.window.showErrorMessage('Failed to generate plan (streaming). Please check your configuration.');
    }
  });

  context.subscriptions.push(streamingDisposable);

  // Register configuration command
  const configDisposable = vscode.commands.registerCommand('ai-plan.configure', async () => {
    await configureExtension(context);
  });

  context.subscriptions.push(configDisposable);

  const settingsDisposable = vscode.commands.registerCommand('ai-plan.settings', async () => {
    try {
      feedbackSystem.showStatusBarMessage('$(gear) Opening settings...', 'info');
      new SettingsPanel();
    } catch (error) {
      await errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'settings_open'
      );
    }
  });

  context.subscriptions.push(settingsDisposable);

  // Register status command
  const statusDisposable = vscode.commands.registerCommand('ai-plan.showStatus', async () => {
    await feedbackSystem.showSuccess('AI Plan extension is active and ready!', {
      title: 'Extension Status',
      actions: [
        {
          label: 'Generate Plan',
          action: async () => {
            await vscode.commands.executeCommand('ai-plan.generateFromRecent');
          }
        },
        {
          label: 'Open Settings',
          action: async () => {
            await vscode.commands.executeCommand('ai-plan.settings');
          }
        },
        {
          label: 'View Logs',
          action: async () => {
            errorHandler.showLogs();
          }
        }
      ]
    });
  });

  context.subscriptions.push(statusDisposable);

  // Initialize feedback system
  feedbackSystem.showStatusBarMessage('$(check) AI Plan Ready', 'success', 3000);

  // Check if configuration is needed
  checkConfiguration(context);
}

async function configureExtension(context: vscode.ExtensionContext): Promise<void> {
  const action = await vscode.window.showQuickPick([
    { label: 'Configure Jira', value: 'jira' },
    { label: 'Configure Slack', value: 'slack' },
    { label: 'Configure Ollama', value: 'ollama' },
    { label: 'Test Connection', value: 'test' }
  ], {
    placeHolder: 'Select configuration option...'
  });

  if (!action) {
    return;
  }

  switch (action.value) {
  case 'jira':
    await configureJira(context);
    break;
  case 'slack':
    await configureSlack(context);
    break;
  case 'ollama':
    await configureOllama(context);
    break;
  case 'test':
    await testConnections(context);
    break;
  }
}

async function configureJira(context: vscode.ExtensionContext): Promise<void> {
  const baseUrl = await vscode.window.showInputBox({
    prompt: 'Enter your Jira base URL (e.g., https://company.atlassian.net)',
    placeHolder: 'https://company.atlassian.net'
  });

  if (!baseUrl) {
    return;
  }

  const token = await vscode.window.showInputBox({
    prompt: 'Enter your Jira Personal Access Token',
    password: true
  });

  if (!token) {
    return;
  }

  // Store secrets
  await context.secrets.store('jira.baseUrl', baseUrl);
  await context.secrets.store('jira.token', token);

  await vscode.window.showInformationMessage('Jira configuration saved!');
}

async function configureSlack(context: vscode.ExtensionContext): Promise<void> {
  const token = await vscode.window.showInputBox({
    prompt: 'Enter your Slack Bot Token',
    password: true,
    placeHolder: 'Bot token from Slack API dashboard',
    validateInput: (value) => {
      if (!value) {
        return 'Token is required';
      }
      if (!value.startsWith('xoxb-')) {
        return 'Please enter a Bot Token (should start with xoxb-)';
      }
      if (value.length < 50) {
        return 'Token appears to be too short';
      }
      return null;
    }
  });

  if (!token) {
    return;
  }

  // Store token
  await context.secrets.store('slack.token', token);

  await vscode.window.showInformationMessage('Slack configuration saved! 💬');
}

async function configureOllama(context: vscode.ExtensionContext): Promise<void> {
  const model = await vscode.window.showInputBox({
    prompt: 'Enter Ollama model name (e.g., llama2:13b)',
    placeHolder: 'llama2:13b',
    value: 'llama2:13b'
  });

  if (!model) {
    return;
  }

  await context.secrets.store('ollama.model', model);
  await vscode.window.showInformationMessage('Ollama configuration saved!');
}

async function testConnections(context: vscode.ExtensionContext): Promise<void> {
  let successCount = 0;
  let totalTests = 0;

  // Test Jira connection
  const jiraBaseUrl = await context.secrets.get('jira.baseUrl');
  const jiraToken = await context.secrets.get('jira.token');

  if (jiraBaseUrl && jiraToken) {
    totalTests++;
    console.log('Testing Jira connection...');
    try {
      const { JiraProvider } = await import('./providers/jira');
      const provider = new JiraProvider({ baseUrl: jiraBaseUrl, token: jiraToken });
      const isValid = await provider.validateConfig();
      
      if (isValid) {
        successCount++;
        console.log('✅ Jira connection successful!');
      } else {
        console.error('❌ Jira connection failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Jira connection failed:', errorMessage);
    }
  }

  // Test Slack connection
  const slackToken = await context.secrets.get('slack.token');

  if (slackToken) {
    totalTests++;
    console.log('Testing Slack connection...');
    try {
      const { SlackProvider } = await import('./providers/slack');
      const provider = new SlackProvider({ token: slackToken });
      const isValid = await provider.validateConfig();
      
      if (isValid) {
        successCount++;
        console.log('✅ Slack connection successful!');
      } else {
        console.error('❌ Slack connection failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Slack connection failed:', errorMessage);
    }
  }

  // Test Ollama connection
  totalTests++;
  try {
    const { OllamaProvider } = await import('./llm/ollama');
    const provider = new OllamaProvider({});
    const isValid = await provider.validateConfig();
    
    if (isValid) {
      successCount++;
      console.log('✅ Ollama connection successful!');
    } else {
      console.error('❌ Ollama connection failed');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Ollama connection failed:', errorMessage);
  }

  // Show summary
  const message = `Connection test results: ${successCount}/${totalTests} successful`;
  if (successCount === totalTests) {
    await vscode.window.showInformationMessage(`✅ ${message}! All connections working.`);
  } else if (successCount > 0) {
    await vscode.window.showWarningMessage(`⚠️ ${message}. Some connections need attention.`);
  } else {
    await vscode.window.showErrorMessage(`❌ ${message}. Please check your configuration.`);
  }
}

async function checkConfiguration(context: vscode.ExtensionContext): Promise<void> {
  const jiraBaseUrl = await context.secrets.get('jira.baseUrl');
  const jiraToken = await context.secrets.get('jira.token');
  const slackToken = await context.secrets.get('slack.token');

  const hasJira = jiraBaseUrl && jiraToken;
  const hasSlack = slackToken;

  if (!hasJira && !hasSlack) {
    const action = await vscode.window.showInformationMessage(
      'AI Plan extension needs configuration. Would you like to configure Jira or Slack?',
      'Configure Jira', 'Configure Slack', 'Later'
    );

    if (action === 'Configure Jira') {
      await configureJira(context);
    } else if (action === 'Configure Slack') {
      await configureSlack(context);
    }
  }
}

export function deactivate() {
  console.log('AI Plan extension is now deactivated!');
}
