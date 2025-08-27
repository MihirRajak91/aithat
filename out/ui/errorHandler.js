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
exports.errorHandler = exports.EnhancedErrorHandler = void 0;
const vscode = __importStar(require("vscode"));
class EnhancedErrorHandler {
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('AI Plan - Error Log');
    }
    async handleError(error, context, actions = []) {
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
        const defaultActions = [
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
        const selectedAction = await vscode.window.showErrorMessage(userMessage, { modal: false }, ...actionLabels);
        // Execute selected action
        if (selectedAction) {
            const action = allActions.find(a => a.label === selectedAction);
            if (action) {
                try {
                    await action.action();
                }
                catch (actionError) {
                    this.outputChannel.appendLine(`[${timestamp}] Error executing action "${selectedAction}": ${actionError}`);
                }
            }
        }
    }
    async handleWarning(message, context, actions = []) {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] WARNING in ${context}: ${message}`);
        const actionLabels = actions.map(a => a.label);
        const selectedAction = await vscode.window.showWarningMessage(`⚠️ ${message}`, ...actionLabels);
        if (selectedAction) {
            const action = actions.find(a => a.label === selectedAction);
            if (action) {
                await action.action();
            }
        }
    }
    async showSuccess(message, actions = []) {
        const actionLabels = actions.map(a => a.label);
        const selectedAction = await vscode.window.showInformationMessage(`✅ ${message}`, ...actionLabels);
        if (selectedAction) {
            const action = actions.find(a => a.label === selectedAction);
            if (action) {
                await action.action();
            }
        }
    }
    createUserFriendlyMessage(error, context) {
        const contextMap = {
            'ticket_fetch': '🎫 Ticket Loading',
            'context_build': '📁 Workspace Analysis',
            'ai_generation': '🤖 AI Plan Generation',
            'provider_connection': '🔗 Service Connection',
            'settings_save': '⚙️ Settings Configuration'
        };
        const errorMap = {
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
    showLogs() {
        this.outputChannel.show();
    }
    clearLogs() {
        this.outputChannel.clear();
    }
}
exports.EnhancedErrorHandler = EnhancedErrorHandler;
// Global error handler instance
exports.errorHandler = new EnhancedErrorHandler();
//# sourceMappingURL=errorHandler.js.map