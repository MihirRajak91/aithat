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
exports.feedbackSystem = exports.FeedbackSystem = void 0;
const vscode = __importStar(require("vscode"));
class FeedbackSystem {
    constructor() {
        this.notifications = new Set();
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'ai-plan.showStatus';
        this.statusBarItem.text = '$(robot) AI Plan';
        this.statusBarItem.tooltip = 'AI Plan Extension';
        this.statusBarItem.show();
    }
    static getInstance() {
        if (!FeedbackSystem.instance) {
            FeedbackSystem.instance = new FeedbackSystem();
        }
        return FeedbackSystem.instance;
    }
    async showSuccess(message, options = {}) {
        const fullMessage = `✅ ${options.title || 'Success'}: ${message}`;
        this.updateStatusBar('$(check) Success', 'success', 3000);
        if (!options.persistent && this.notifications.has(fullMessage)) {
            return;
        }
        this.notifications.add(fullMessage);
        const actionLabels = options.actions?.map(a => a.label) || [];
        const selectedAction = await vscode.window.showInformationMessage(fullMessage, { detail: options.detail }, ...actionLabels);
        await this.handleActionSelection(selectedAction, options.actions);
        if (!options.persistent) {
            setTimeout(() => this.notifications.delete(fullMessage), options.timeout || 5000);
        }
    }
    async showError(message, options = {}) {
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
        const selectedAction = await vscode.window.showErrorMessage(fullMessage, { detail: options.detail, modal: !options.persistent }, ...actionLabels);
        await this.handleActionSelection(selectedAction, allActions);
    }
    async showWarning(message, options = {}) {
        const fullMessage = `⚠️ ${options.title || 'Warning'}: ${message}`;
        this.updateStatusBar('$(warning) Warning', 'warning', 4000);
        const actionLabels = options.actions?.map(a => a.label) || [];
        const selectedAction = await vscode.window.showWarningMessage(fullMessage, { detail: options.detail }, ...actionLabels);
        await this.handleActionSelection(selectedAction, options.actions);
    }
    async showProgress(title, task, options = {}) {
        this.updateStatusBar('$(loading~spin) Working...', 'progress');
        try {
            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `🤖 AI Plan: ${title}`,
                cancellable: options.cancellable || false
            }, task);
            this.updateStatusBar('$(check) Complete', 'success', 2000);
            return result;
        }
        catch (error) {
            this.updateStatusBar('$(error) Failed', 'error', 3000);
            throw error;
        }
    }
    showStatusBarMessage(message, type = 'info', timeout) {
        this.updateStatusBar(message, type, timeout);
    }
    async requestUserInput(title, placeholder, options = {}) {
        return await vscode.window.showInputBox({
            title: `🤖 AI Plan: ${title}`,
            placeHolder: placeholder,
            password: options.password,
            validateInput: options.validateInput
        });
    }
    async requestUserChoice(title, items, options = {}) {
        const quickPickItems = items.map(item => ({
            label: item.label,
            description: item.description,
            detail: item.detail,
            value: item.value
        }));
        if (options.canPickMany) {
            const selected = await vscode.window.showQuickPick(quickPickItems, {
                title: `🤖 AI Plan: ${title}`,
                canPickMany: true,
                matchOnDescription: true,
                matchOnDetail: true
            });
            return selected?.map(item => item.value);
        }
        else {
            const selected = await vscode.window.showQuickPick(quickPickItems, {
                title: `🤖 AI Plan: ${title}`,
                matchOnDescription: true,
                matchOnDetail: true
            });
            return selected?.value;
        }
    }
    async handleActionSelection(selectedAction, actions) {
        if (selectedAction && actions) {
            const action = actions.find(a => a.label === selectedAction);
            if (action) {
                try {
                    await action.action();
                }
                catch (error) {
                    await this.showError(`Action "${selectedAction}" failed`, {
                        detail: error instanceof Error ? error.message : String(error)
                    });
                }
            }
        }
    }
    updateStatusBar(text, type, timeout) {
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
    dispose() {
        this.statusBarItem.dispose();
    }
}
exports.FeedbackSystem = FeedbackSystem;
exports.feedbackSystem = FeedbackSystem.getInstance();
//# sourceMappingURL=feedbackSystem.js.map