import * as vscode from 'vscode';
import { ExtensionError, ProviderError, ValidationError, ErrorCode, ErrorSeverity } from '../utils/errorTypes';

export interface ErrorAction {
  label: string;
  action: () => Promise<void>;
}

export class EnhancedErrorHandler {
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('AI Plan - Error Log');
  }

  /**
   * Handle ExtensionError with enhanced context and retry logic
   */
  async handleExtensionError(error: ExtensionError): Promise<void> {
    const timestamp = new Date().toISOString();
    
    // Log detailed error
    this.outputChannel.appendLine(`[${timestamp}] ${error.severity.toUpperCase()} ${error.code} in ${error.context.component}:`);
    this.outputChannel.appendLine(`  Operation: ${error.context.operation}`);
    this.outputChannel.appendLine(`  Message: ${error.message}`);
    this.outputChannel.appendLine(`  Retryable: ${error.isRetryable}`);
    
    if (error.context.metadata) {
      this.outputChannel.appendLine(`  Metadata: ${JSON.stringify(error.context.metadata, null, 2)}`);
    }
    
    if (error.stack) {
      this.outputChannel.appendLine(`  Stack: ${error.stack}`);
    }

    // Generate contextual actions
    const actions = this.generateContextualActions(error);
    
    // Show appropriate user message based on severity
    await this.showUserMessage(error, actions);
  }

  async handleError(
    error: Error | string | ExtensionError,
    context: string,
    actions: ErrorAction[] = []
  ): Promise<void> {
    // Handle new ExtensionError types
    if (error instanceof ExtensionError) {
      return this.handleExtensionError(error);
    }
    const errorMessage = error instanceof Error ? error.message : error;
    const timestamp = new Date().toISOString();
    
    // Log detailed error
    this.outputChannel.appendLine(`[${timestamp}] ERROR in ${context}: ${errorMessage}`);
    if (error instanceof Error && error.stack) {
      this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
    }

    // Create user-friendly error message with context
    const userMessage = this.createUserFriendlyMessage(errorMessage, context);
    
    // Default actions if none provided
    const defaultActions: ErrorAction[] = [
      {
        label: 'View Logs',
        action: async () => {
          this.outputChannel.show();
        }
      },
      {
        label: 'Open Settings',
        action: async () => {
          await vscode.commands.executeCommand('ai-plan.settings');
        }
      }
    ];

    const allActions = [...actions, ...defaultActions];
    const actionLabels = allActions.map(a => a.label);

    // Show error with actions
    const selectedAction = await vscode.window.showErrorMessage(
      userMessage,
      { modal: false },
      ...actionLabels
    );

    // Execute selected action
    if (selectedAction) {
      const action = allActions.find(a => a.label === selectedAction);
      if (action) {
        try {
          await action.action();
        } catch (actionError) {
          this.outputChannel.appendLine(`[${timestamp}] Error executing action "${selectedAction}": ${actionError}`);
        }
      }
    }
  }

  async handleWarning(
    message: string,
    context: string,
    actions: ErrorAction[] = []
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] WARNING in ${context}: ${message}`);

    const actionLabels = actions.map(a => a.label);
    const selectedAction = await vscode.window.showWarningMessage(
      `⚠️ ${message}`,
      ...actionLabels
    );

    if (selectedAction) {
      const action = actions.find(a => a.label === selectedAction);
      if (action) {
        await action.action();
      }
    }
  }

  async showSuccess(
    message: string,
    actions: ErrorAction[] = []
  ): Promise<void> {
    const actionLabels = actions.map(a => a.label);
    const selectedAction = await vscode.window.showInformationMessage(
      `✅ ${message}`,
      ...actionLabels
    );

    if (selectedAction) {
      const action = actions.find(a => a.label === selectedAction);
      if (action) {
        await action.action();
      }
    }
  }

  private createUserFriendlyMessage(error: string, context: string): string {
    const contextMap: Record<string, string> = {
      'ticket_fetch': '🎫 Ticket Loading',
      'context_build': '📁 Workspace Analysis', 
      'ai_generation': '🤖 AI Plan Generation',
      'provider_connection': '🔗 Service Connection',
      'settings_save': '⚙️ Settings Configuration'
    };

    const errorMap: Record<string, string> = {
      'connection_failed': 'Unable to connect to the service. Please check your network and credentials.',
      'invalid_credentials': 'Your credentials appear to be invalid. Please check your settings.',
      'service_unavailable': 'The service is currently unavailable. Please try again later.',
      'timeout': 'The request timed out. Please try again or check your connection.',
      'rate_limit': 'Too many requests. Please wait a moment and try again.',
      'invalid_config': 'Configuration is invalid. Please check your settings.'
    };

    const friendlyContext = contextMap[context] || context;
    const friendlyError = errorMap[error] || error;

    return `${friendlyContext}: ${friendlyError}`;
  }

  showLogs(): void {
    this.outputChannel.show();
  }

  clearLogs(): void {
    this.outputChannel.clear();
  }

  private generateContextualActions(error: ExtensionError): ErrorAction[] {
    const actions: ErrorAction[] = [];

    // Add retry action for retryable errors
    if (error.isRetryable) {
      actions.push({
        label: 'Retry',
        action: async () => {
          // This would need to be implemented based on the specific operation
          await vscode.window.showInformationMessage('Retry functionality needs to be implemented for this operation');
        }
      });
    }

    // Add provider-specific actions
    if (error instanceof ProviderError) {
      actions.push({
        label: `Configure ${error.provider}`,
        action: async () => {
          await vscode.commands.executeCommand('ai-plan.configure');
        }
      });
    }

    // Add validation-specific actions
    if (error instanceof ValidationError) {
      actions.push({
        label: 'Fix Configuration',
        action: async () => {
          await vscode.commands.executeCommand('ai-plan.settings');
        }
      });
    }

    // Add common actions
    actions.push(
      {
        label: 'View Logs',
        action: async () => {
          this.outputChannel.show();
        }
      },
      {
        label: 'Open Settings',
        action: async () => {
          await vscode.commands.executeCommand('ai-plan.settings');
        }
      }
    );

    return actions;
  }

  private async showUserMessage(error: ExtensionError, actions: ErrorAction[]): Promise<void> {
    const message = this.createUserFriendlyMessageFromError(error);
    const actionLabels = actions.map(a => a.label);

    let selectedAction: string | undefined;

    switch (error.severity) {
    case ErrorSeverity.CRITICAL:
    case ErrorSeverity.HIGH:
      selectedAction = await vscode.window.showErrorMessage(
        `❌ ${message}`,
        { modal: true },
        ...actionLabels
      );
      break;
    case ErrorSeverity.MEDIUM:
      selectedAction = await vscode.window.showWarningMessage(
        `⚠️ ${message}`,
        ...actionLabels
      );
      break;
    case ErrorSeverity.LOW:
      selectedAction = await vscode.window.showInformationMessage(
        `ℹ️ ${message}`,
        ...actionLabels
      );
      break;
    }

    if (selectedAction) {
      const action = actions.find(a => a.label === selectedAction);
      if (action) {
        try {
          await action.action();
        } catch (actionError) {
          this.outputChannel.appendLine(`Error executing action "${selectedAction}": ${actionError}`);
        }
      }
    }
  }

  private createUserFriendlyMessageFromError(error: ExtensionError): string {
    const contextMap: Record<string, string> = {
      'JiraProvider': '🎫 Jira Integration',
      'LinearProvider': '📋 Linear Integration',
      'SlackProvider': '💬 Slack Integration',
      'PlanGenerator': '🤖 AI Plan Generation',
      'ContextBuilder': '📁 Workspace Analysis',
      'SettingsPanel': '⚙️ Settings'
    };

    const operationMap: Record<string, string> = {
      'connection': 'connecting to service',
      'authentication': 'authenticating',
      'api_request': 'making API request',
      'validation': 'validating input',
      'configuration': 'configuring',
      'workspace_analysis': 'analyzing workspace'
    };

    const component = contextMap[error.context.component] || error.context.component;
    const operation = operationMap[error.context.operation] || error.context.operation;

    return `${component}: Error while ${operation} - ${error.message}`;
  }
}

// Global error handler instance
export const errorHandler = new EnhancedErrorHandler();