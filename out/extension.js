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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const recentTicketsPicker_1 = require("./ui/recentTicketsPicker");
const planGenerator_1 = require("./ui/planGenerator");
const context_1 = require("./context");
const settingsPanel_1 = require("./ui/settingsPanel");
const feedbackSystem_1 = require("./ui/feedbackSystem");
const errorHandler_1 = require("./ui/errorHandler");
function activate(context) {
    console.log('AI Plan extension is now active!');
    (0, context_1.setExtensionContext)(context);
    // Register the main command with enhanced UI
    const disposable = vscode.commands.registerCommand('ai-plan.generateFromRecent', async () => {
        try {
            feedbackSystem_1.feedbackSystem.showStatusBarMessage('$(search) Selecting ticket...', 'info');
            const picker = new recentTicketsPicker_1.RecentTicketsPicker();
            const ticket = await picker.showRecentTickets();
            if (ticket) {
                feedbackSystem_1.feedbackSystem.showStatusBarMessage('$(rocket) Generating plan...', 'progress');
                const generator = new planGenerator_1.PlanGenerator();
                await generator.generatePlan(ticket);
            }
            else {
                feedbackSystem_1.feedbackSystem.showStatusBarMessage('$(info) No ticket selected', 'info', 2000);
            }
        }
        catch (error) {
            console.error('Error in generateFromRecent command:', error);
            await errorHandler_1.errorHandler.handleError(error instanceof Error ? error : new Error(String(error)), 'ticket_selection', [
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
            ]);
        }
    });
    context.subscriptions.push(disposable);
    // Register a streaming variant that writes into Output Channel
    const streamingDisposable = vscode.commands.registerCommand('ai-plan.generateFromRecentStreaming', async () => {
        try {
            const picker = new recentTicketsPicker_1.RecentTicketsPicker();
            const ticket = await picker.showRecentTickets();
            if (ticket) {
                const generator = new planGenerator_1.PlanGenerator();
                await generator.generatePlan(ticket);
            }
        }
        catch (error) {
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
            feedbackSystem_1.feedbackSystem.showStatusBarMessage('$(gear) Opening settings...', 'info');
            new settingsPanel_1.SettingsPanel();
        }
        catch (error) {
            await errorHandler_1.errorHandler.handleError(error instanceof Error ? error : new Error(String(error)), 'settings_open');
        }
    });
    context.subscriptions.push(settingsDisposable);
    // Register status command
    const statusDisposable = vscode.commands.registerCommand('ai-plan.showStatus', async () => {
        await feedbackSystem_1.feedbackSystem.showSuccess('AI Plan extension is active and ready!', {
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
                        errorHandler_1.errorHandler.showLogs();
                    }
                }
            ]
        });
    });
    context.subscriptions.push(statusDisposable);
    // Initialize feedback system
    feedbackSystem_1.feedbackSystem.showStatusBarMessage('$(check) AI Plan Ready', 'success', 3000);
    // Check if configuration is needed
    checkConfiguration(context);
}
async function configureExtension(context) {
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
async function configureJira(context) {
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
async function configureSlack(context) {
    const token = await vscode.window.showInputBox({
        prompt: 'Enter your Slack Bot Token (xoxb-...)',
        password: true,
        placeHolder: 'xoxb-1234567890-1234567890123-AbCdEfGhIjKlMnOpQrStUvWx',
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
async function configureOllama(context) {
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
async function testConnections(context) {
    let successCount = 0;
    let totalTests = 0;
    // Test Jira connection
    const jiraBaseUrl = await context.secrets.get('jira.baseUrl');
    const jiraToken = await context.secrets.get('jira.token');
    if (jiraBaseUrl && jiraToken) {
        totalTests++;
        console.log('Testing Jira connection...');
        try {
            const { JiraProvider } = await Promise.resolve().then(() => __importStar(require('./providers/jira')));
            const provider = new JiraProvider({ baseUrl: jiraBaseUrl, token: jiraToken });
            const isValid = await provider.validateConfig();
            if (isValid) {
                successCount++;
                console.log('✅ Jira connection successful!');
            }
            else {
                console.error('❌ Jira connection failed');
            }
        }
        catch (error) {
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
            const { SlackProvider } = await Promise.resolve().then(() => __importStar(require('./providers/slack')));
            const provider = new SlackProvider({ token: slackToken });
            const isValid = await provider.validateConfig();
            if (isValid) {
                successCount++;
                console.log('✅ Slack connection successful!');
            }
            else {
                console.error('❌ Slack connection failed');
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('❌ Slack connection failed:', errorMessage);
        }
    }
    // Test Ollama connection
    totalTests++;
    try {
        const { OllamaProvider } = await Promise.resolve().then(() => __importStar(require('./llm/ollama')));
        const provider = new OllamaProvider({});
        const isValid = await provider.validateConfig();
        if (isValid) {
            successCount++;
            console.log('✅ Ollama connection successful!');
        }
        else {
            console.error('❌ Ollama connection failed');
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ Ollama connection failed:', errorMessage);
    }
    // Show summary
    const message = `Connection test results: ${successCount}/${totalTests} successful`;
    if (successCount === totalTests) {
        await vscode.window.showInformationMessage(`✅ ${message}! All connections working.`);
    }
    else if (successCount > 0) {
        await vscode.window.showWarningMessage(`⚠️ ${message}. Some connections need attention.`);
    }
    else {
        await vscode.window.showErrorMessage(`❌ ${message}. Please check your configuration.`);
    }
}
async function checkConfiguration(context) {
    const jiraBaseUrl = await context.secrets.get('jira.baseUrl');
    const jiraToken = await context.secrets.get('jira.token');
    const slackToken = await context.secrets.get('slack.token');
    const hasJira = jiraBaseUrl && jiraToken;
    const hasSlack = slackToken;
    if (!hasJira && !hasSlack) {
        const action = await vscode.window.showInformationMessage('AI Plan extension needs configuration. Would you like to configure Jira or Slack?', 'Configure Jira', 'Configure Slack', 'Later');
        if (action === 'Configure Jira') {
            await configureJira(context);
        }
        else if (action === 'Configure Slack') {
            await configureSlack(context);
        }
    }
}
function deactivate() {
    console.log('AI Plan extension is now deactivated!');
}
//# sourceMappingURL=extension.js.map