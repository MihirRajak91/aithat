import * as vscode from 'vscode';
import { RecentTicketsPicker } from './ui/recentTicketsPicker';
import { PlanGenerator } from './ui/planGenerator';

export function activate(context: vscode.ExtensionContext) {
  console.log('AI Plan extension is now active!');

  // Register the main command
  const disposable = vscode.commands.registerCommand('ai-plan.generateFromRecent', async () => {
    try {
      const picker = new RecentTicketsPicker();
      const ticket = await picker.showRecentTickets();
      
      if (ticket) {
        const generator = new PlanGenerator();
        await generator.generatePlan(ticket);
      }
    } catch (error) {
      console.error('Error in generateFromRecent command:', error);
      await vscode.window.showErrorMessage('Failed to generate plan. Please check your configuration.');
    }
  });

  context.subscriptions.push(disposable);

  // Register configuration command
  const configDisposable = vscode.commands.registerCommand('ai-plan.configure', async () => {
    await configureExtension(context);
  });

  context.subscriptions.push(configDisposable);

  // Check if configuration is needed
  checkConfiguration(context);
}

async function configureExtension(context: vscode.ExtensionContext): Promise<void> {
  const action = await vscode.window.showQuickPick([
    { label: 'Configure Jira', value: 'jira' },
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
  // Test Jira connection
  const jiraBaseUrl = await context.secrets.get('jira.baseUrl');
  const jiraToken = await context.secrets.get('jira.token');

  if (jiraBaseUrl && jiraToken) {
    try {
      const { JiraProvider } = await import('./providers/jira');
      const provider = new JiraProvider({ baseUrl: jiraBaseUrl, token: jiraToken });
      const isValid = await provider.validateConfig();
      
      if (isValid) {
        await vscode.window.showInformationMessage('✅ Jira connection successful!');
      } else {
        await vscode.window.showErrorMessage('❌ Jira connection failed. Please check your credentials.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await vscode.window.showErrorMessage('❌ Jira connection failed: ' + errorMessage);
    }
  } else {
    await vscode.window.showWarningMessage('⚠️ Jira not configured. Please configure Jira first.');
  }

  // Test Ollama connection
  try {
    const { OllamaProvider } = await import('./llm/ollama');
    const provider = new OllamaProvider({});
    const isValid = await provider.validateConfig();
    
    if (isValid) {
      await vscode.window.showInformationMessage('✅ Ollama connection successful!');
    } else {
      await vscode.window.showErrorMessage('❌ Ollama connection failed. Please ensure Ollama is running.');
    }
      } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await vscode.window.showErrorMessage('❌ Ollama connection failed: ' + errorMessage);
    }
}

async function checkConfiguration(context: vscode.ExtensionContext): Promise<void> {
  const jiraBaseUrl = await context.secrets.get('jira.baseUrl');
  const jiraToken = await context.secrets.get('jira.token');

  if (!jiraBaseUrl || !jiraToken) {
    const action = await vscode.window.showInformationMessage(
      'AI Plan extension needs configuration. Would you like to configure it now?',
      'Configure', 'Later'
    );

    if (action === 'Configure') {
      await configureExtension(context);
    }
  }
}

export function deactivate() {
  console.log('AI Plan extension is now deactivated!');
}
