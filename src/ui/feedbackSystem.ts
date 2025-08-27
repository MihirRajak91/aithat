import * as vscode from 'vscode';

export interface FeedbackOptions {
  title?: string;
  detail?: string;
  actions?: Array<{ label: string; action: () => Promise<void> }>;
  timeout?: number;
  persistent?: boolean;
}

export class FeedbackSystem {
  private static instance: FeedbackSystem;
  private statusBarItem: vscode.StatusBarItem;
  private notifications: Set<string> = new Set();

  private constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right, 
      100
    );
    this.statusBarItem.command = 'ai-plan.showStatus';
    this.statusBarItem.text = '$(robot) AI Plan';
    this.statusBarItem.tooltip = 'AI Plan Extension';
    this.statusBarItem.show();
  }

  static getInstance(): FeedbackSystem {
    if (!FeedbackSystem.instance) {
      FeedbackSystem.instance = new FeedbackSystem();
    }
    return FeedbackSystem.instance;
  }

  async showSuccess(message: string, options: FeedbackOptions = {}): Promise<void> {
    const fullMessage = `✅ ${options.title || 'Success'}: ${message}`;
    
    this.updateStatusBar('$(check) Success', 'success', 3000);
    
    if (!options.persistent && this.notifications.has(fullMessage)) {
      return;
    }
    
    this.notifications.add(fullMessage);
    
    const actionLabels = options.actions?.map(a => a.label) || [];
    const selectedAction = await vscode.window.showInformationMessage(
      fullMessage,
      { detail: options.detail },
      ...actionLabels
    );

    await this.handleActionSelection(selectedAction, options.actions);
    
    if (!options.persistent) {
      setTimeout(() => this.notifications.delete(fullMessage), options.timeout || 5000);
    }
  }

  async showError(message: string, options: FeedbackOptions = {}): Promise<void> {
    const fullMessage = `❌ ${options.title || 'Error'}: ${message}`;
    
    this.updateStatusBar('$(error) Error', 'error', 5000);
    
    const defaultActions = [
      {
        label: 'View Logs',
        action: async () => {
          const outputChannel = vscode.window.createOutputChannel('AI Plan - Error Details');
          outputChannel.appendLine(`Error: ${message}`);
          if (options.detail) {
            outputChannel.appendLine(`Details: ${options.detail}`);
          }
          outputChannel.show();
        }
      }
    ];
    
    const allActions = [...(options.actions || []), ...defaultActions];
    const actionLabels = allActions.map(a => a.label);
    
    const selectedAction = await vscode.window.showErrorMessage(
      fullMessage,
      { detail: options.detail, modal: !options.persistent },
      ...actionLabels
    );

    await this.handleActionSelection(selectedAction, allActions);
  }

  async showWarning(message: string, options: FeedbackOptions = {}): Promise<void> {
    const fullMessage = `⚠️ ${options.title || 'Warning'}: ${message}`;
    
    this.updateStatusBar('$(warning) Warning', 'warning', 4000);
    
    const actionLabels = options.actions?.map(a => a.label) || [];
    const selectedAction = await vscode.window.showWarningMessage(
      fullMessage,
      { detail: options.detail },
      ...actionLabels
    );

    await this.handleActionSelection(selectedAction, options.actions);
  }

  async showProgress<T>(
    title: string,
    task: (progress: vscode.Progress<{message?: string, increment?: number}>, token: vscode.CancellationToken) => Promise<T>,
    options: { cancellable?: boolean } = {}
  ): Promise<T | undefined> {
    this.updateStatusBar('$(loading~spin) Working...', 'progress');
    
    try {
      const result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `🤖 AI Plan: ${title}`,
        cancellable: options.cancellable || false
      }, task);

      this.updateStatusBar('$(check) Complete', 'success', 2000);
      return result;
    } catch (error) {
      this.updateStatusBar('$(error) Failed', 'error', 3000);
      throw error;
    }
  }

  showStatusBarMessage(message: string, type: 'info' | 'success' | 'warning' | 'error' | 'progress' = 'info', timeout?: number): void {
    this.updateStatusBar(message, type, timeout);
  }

  async requestUserInput(
    title: string,
    placeholder?: string,
    options: {
      password?: boolean;
      validateInput?: (value: string) => string | undefined;
    } = {}
  ): Promise<string | undefined> {
    return await vscode.window.showInputBox({
      title: `🤖 AI Plan: ${title}`,
      placeHolder: placeholder,
      password: options.password,
      validateInput: options.validateInput
    });
  }

  async requestUserChoice<T>(
    title: string,
    items: Array<{ label: string; description?: string; detail?: string; value: T }>,
    options: { canPickMany?: boolean } = {}
  ): Promise<T | T[] | undefined> {
    const quickPickItems = items.map(item => ({
      label: item.label,
      description: item.description,
      detail: item.detail,
      value: item.value
    }));

    if (options.canPickMany) {
      const selected = await vscode.window.showQuickPick(
        quickPickItems,
        {
          title: `🤖 AI Plan: ${title}`,
          canPickMany: true,
          matchOnDescription: true,
          matchOnDetail: true
        }
      );
      return selected?.map(item => item.value);
    } else {
      const selected = await vscode.window.showQuickPick(
        quickPickItems,
        {
          title: `🤖 AI Plan: ${title}`,
          matchOnDescription: true,
          matchOnDetail: true
        }
      );
      return selected?.value;
    }
  }

  private async handleActionSelection(
    selectedAction: string | undefined,
    actions?: Array<{ label: string; action: () => Promise<void> }>
  ): Promise<void> {
    if (selectedAction && actions) {
      const action = actions.find(a => a.label === selectedAction);
      if (action) {
        try {
          await action.action();
        } catch (error) {
          await this.showError(`Action "${selectedAction}" failed`, {
            detail: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
  }

  private updateStatusBar(
    text: string, 
    type: 'info' | 'success' | 'warning' | 'error' | 'progress',
    timeout?: number
  ): void {
    this.statusBarItem.text = text;
    
    const colorMap = {
      info: undefined,
      success: new vscode.ThemeColor('statusBarItem.prominentBackground'),
      warning: new vscode.ThemeColor('statusBarItem.warningBackground'),
      error: new vscode.ThemeColor('statusBarItem.errorBackground'),
      progress: new vscode.ThemeColor('statusBarItem.prominentBackground')
    };
    
    this.statusBarItem.backgroundColor = colorMap[type];
    
    if (timeout) {
      setTimeout(() => {
        this.statusBarItem.text = '$(robot) AI Plan';
        this.statusBarItem.backgroundColor = undefined;
      }, timeout);
    }
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}

export const feedbackSystem = FeedbackSystem.getInstance();