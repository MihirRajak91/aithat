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
exports.RecentTicketsPicker = void 0;
const vscode = __importStar(require("vscode"));
const context_1 = require("../context");
const jira_1 = require("../providers/jira");
const slack_1 = require("../providers/slack");
const feedbackSystem_1 = require("./feedbackSystem");
class RecentTicketsPicker {
    constructor() {
        this.providers = [];
        this.jiraProvider = null;
        this.slackProvider = null;
        // Initialize providers (Jira and Slack)
        this.initializeProviders();
    }
    async initializeProviders() {
        const jiraConfig = await this.getJiraConfig();
        if (jiraConfig) {
            this.jiraProvider = new jira_1.JiraProvider(jiraConfig);
            this.providers.push(this.jiraProvider);
        }
        const slackConfig = await this.getSlackConfig();
        if (slackConfig) {
            this.slackProvider = new slack_1.SlackProvider(slackConfig);
            this.providers.push(this.slackProvider);
        }
    }
    async getJiraConfig() {
        const context = (0, context_1.getExtensionContext)();
        if (!context) {
            return null;
        }
        const baseUrl = await context.secrets.get('jira.baseUrl');
        const token = await context.secrets.get('jira.token');
        if (baseUrl && token) {
            return { baseUrl, token };
        }
        return null;
    }
    async getSlackConfig() {
        const context = (0, context_1.getExtensionContext)();
        if (!context) {
            return null;
        }
        const token = await context.secrets.get('slack.token');
        if (token) {
            return { token };
        }
        return null;
    }
    async showRecentTickets() {
        try {
            // Use enhanced UI flow
            return await this.showEnhancedTaskSelection();
        }
        catch (error) {
            console.error('Error in showRecentTickets:', error);
            // Fallback to legacy flow
            return await this.showLegacyTaskSelection();
        }
    }
    async showEnhancedTaskSelection() {
        if (!this.jiraProvider && !this.slackProvider) {
            throw new Error('No providers initialized. Please configure Jira or Slack.');
        }
        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '🎯 AI Plan - Loading your tasks',
            cancellable: true
        }, async (progress, token) => {
            while (true) {
                if (token.isCancellationRequested) {
                    return null;
                }
                progress.report({ message: 'Analyzing your workload...', increment: 20 });
                // Get task groups from available providers
                const taskGroups = [];
                if (this.jiraProvider) {
                    const jiraGroups = await this.jiraProvider.getMyActiveWorkItems(50);
                    taskGroups.push(...jiraGroups);
                }
                progress.report({ message: 'Organizing tasks by priority and status...', increment: 40 });
                const menuItems = [];
                // Quick access section
                menuItems.push({
                    label: '🚀 Quick Access',
                    action: 'separator',
                    kind: vscode.QuickPickItemKind.Separator
                });
                // Add urgent tasks if any
                const urgentTasks = taskGroups.find(g => g.title.includes('High Priority'));
                if (urgentTasks && urgentTasks.count > 0) {
                    menuItems.push({
                        label: `🔥 High Priority Tasks (${urgentTasks.count})`,
                        description: 'Your most important tasks requiring immediate attention',
                        action: 'show_group',
                        group: urgentTasks
                    });
                }
                // Add in-progress tasks
                const inProgressTasks = taskGroups.find(g => g.title.includes('In Progress'));
                if (inProgressTasks && inProgressTasks.count > 0) {
                    menuItems.push({
                        label: `⚡ Continue Work (${inProgressTasks.count})`,
                        description: 'Tasks you\'re currently working on',
                        action: 'show_group',
                        group: inProgressTasks
                    });
                }
                // Add ready to start tasks
                const readyTasks = taskGroups.find(g => g.title.includes('Ready to Start'));
                if (readyTasks && readyTasks.count > 0) {
                    menuItems.push({
                        label: `📋 Ready to Start (${readyTasks.count})`,
                        description: 'Tasks ready for implementation',
                        action: 'show_group',
                        group: readyTasks
                    });
                }
                // Browse section
                menuItems.push({
                    label: '📁 Browse by Project',
                    action: 'separator',
                    kind: vscode.QuickPickItemKind.Separator
                });
                menuItems.push({
                    label: '💼 Browse by Project/Board',
                    description: 'Organize tasks by project or Jira board',
                    action: 'browse_projects'
                });
                if (this.jiraProvider) {
                    menuItems.push({
                        label: '🏃 Active Sprint Tasks',
                        description: 'View tasks from your current sprints',
                        action: 'sprint_tasks'
                    });
                }
                if (this.slackProvider) {
                    menuItems.push({
                        label: '💬 Slack Task Channels',
                        description: 'Browse tasks from Slack channels',
                        action: 'slack_channels'
                    });
                    menuItems.push({
                        label: '🧵 My Slack Mentions',
                        description: 'Tasks and discussions where you were mentioned',
                        action: 'slack_mentions'
                    });
                }
                // Advanced options
                menuItems.push({
                    label: '🔧 Advanced Options',
                    action: 'separator',
                    kind: vscode.QuickPickItemKind.Separator
                });
                menuItems.push({
                    label: '📊 All My Tasks',
                    description: 'View all your assigned tasks',
                    action: 'all_tasks'
                });
                menuItems.push({
                    label: '📅 Recently Updated',
                    description: 'Tasks updated in the last week',
                    action: 'recent_updated'
                });
                menuItems.push({
                    label: '🔍 Search Tasks',
                    description: 'Search by key, text, or advanced filters',
                    action: 'search'
                });
                if (this.slackProvider) {
                    menuItems.push({
                        label: '🔥 High Priority Slack Tasks',
                        description: 'Urgent tasks and discussions from Slack',
                        action: 'slack_high_priority'
                    });
                }
                menuItems.push({
                    label: '🔄 Refresh Cache',
                    description: 'Reload tasks with fresh data',
                    action: 'refresh'
                });
                menuItems.push({
                    label: '⚙️ Settings',
                    description: 'Configure Jira connection and preferences',
                    action: 'settings'
                });
                progress.report({ message: 'Ready!', increment: 100 });
                // Show the main menu
                const selectedItem = await vscode.window.showQuickPick(menuItems, {
                    title: '🤖 AI Plan - Select Your Task',
                    placeHolder: taskGroups.length > 0
                        ? `Choose from ${taskGroups.reduce((sum, g) => sum + g.count, 0)} available tasks`
                        : '🔍 No active tasks found. Try searching or refresh your data.',
                    matchOnDescription: true,
                    ignoreFocusOut: false
                });
                if (!selectedItem) {
                    return null;
                }
                // Handle the selected action
                switch (selectedItem.action) {
                    case 'show_group':
                        if (selectedItem.group) {
                            const task = await this.showTaskGroup(selectedItem.group);
                            if (task)
                                return task;
                        }
                        continue;
                    case 'browse_projects':
                        const projectTask = await this.showProjectBrowser();
                        if (projectTask)
                            return projectTask;
                        continue;
                    case 'sprint_tasks':
                        const sprintTask = await this.showSprintTasks();
                        if (sprintTask)
                            return sprintTask;
                        continue;
                    case 'all_tasks':
                        const allTask = await this.showAllTasks();
                        if (allTask)
                            return allTask;
                        continue;
                    case 'recent_updated':
                        const recentTask = await this.showRecentlyUpdated();
                        if (recentTask)
                            return recentTask;
                        continue;
                    case 'search':
                        const searchTask = await this.showTaskSearch();
                        if (searchTask)
                            return searchTask;
                        continue;
                    case 'refresh':
                        if (this.jiraProvider) {
                            this.jiraProvider.clearCache();
                        }
                        if (this.slackProvider) {
                            this.slackProvider.clearCache();
                        }
                        feedbackSystem_1.feedbackSystem.showStatusBarMessage('🔄 Refreshed task data', 'success', 2000);
                        continue;
                    case 'slack_channels':
                        const slackChannelTask = await this.showSlackChannels();
                        if (slackChannelTask)
                            return slackChannelTask;
                        continue;
                    case 'slack_mentions':
                        const slackMentionTask = await this.showSlackMentions();
                        if (slackMentionTask)
                            return slackMentionTask;
                        continue;
                    case 'slack_high_priority':
                        const slackHighPriorityTask = await this.showSlackHighPriority();
                        if (slackHighPriorityTask)
                            return slackHighPriorityTask;
                        continue;
                    case 'settings':
                        await vscode.commands.executeCommand('ai-plan.settings');
                        continue;
                    default:
                        continue;
                }
            }
        });
    }
    async showLegacyTaskSelection() {
        try {
            let limit = 15;
            while (true) {
                const allTickets = [];
                for (const provider of this.providers) {
                    try {
                        // Prefer tickets related to the current user first, then fall back to recent
                        const assigned = provider.getMyWork ? await provider.getMyWork(limit) : [];
                        const recent = await provider.getRecentTickets(limit);
                        const merged = [...assigned, ...recent];
                        const dedup = new Map();
                        for (const t of merged)
                            dedup.set(t.id, t);
                        allTickets.push(...dedup.values());
                    }
                    catch (error) {
                        console.error(`Error fetching tickets from ${provider.getProviderName()}:`, error);
                    }
                }
                allTickets.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
                const actionItems = [
                    { label: '🔍 Quick Actions', kind: vscode.QuickPickItemKind.Separator },
                    {
                        label: '$(search) Search by Key',
                        description: 'Find a specific ticket by its key (e.g., PROJ-123)',
                        command: 'search',
                        detail: 'Enter a ticket key to find it directly'
                    },
                    {
                        label: '$(filter) Text Search',
                        description: 'Search tickets by title or description content',
                        command: 'searchText',
                        detail: 'Search across all ticket content'
                    },
                    {
                        label: '$(project) Browse Boards',
                        description: 'View tickets from specific boards assigned to you',
                        command: 'browseBoards',
                        detail: 'Organized view by project boards'
                    },
                    {
                        label: '$(refresh) Refresh',
                        description: 'Reload the ticket list with fresh data',
                        command: 'refresh',
                        detail: 'Get the latest updates'
                    },
                    {
                        label: '$(add) Load More',
                        description: `Show more tickets (currently showing ${Math.min(limit, allTickets.length)} of many)`,
                        command: 'loadMore',
                        detail: `Increase to ${limit + 10} tickets`
                    },
                    {
                        label: '$(gear) Settings',
                        description: 'Configure Jira connection and preferences',
                        command: 'openSettings',
                        detail: 'Manage your AI Plan configuration'
                    }
                ];
                const ticketSections = [];
                if (allTickets.length > 0) {
                    // Group tickets by status and priority
                    const myTickets = allTickets.filter(t => t.assignee && t.assignee.toLowerCase().includes('me'));
                    const highPriorityTickets = allTickets.filter(t => ['high', 'urgent'].includes(t.priority));
                    const recentTickets = allTickets.slice(0, Math.min(limit, allTickets.length));
                    if (myTickets.length > 0) {
                        ticketSections.push({ label: '👤 My Assigned Tickets', kind: vscode.QuickPickItemKind.Separator });
                        ticketSections.push(...myTickets.slice(0, 5).map(ticket => this.createTicketItem(ticket)));
                    }
                    if (highPriorityTickets.length > 0) {
                        ticketSections.push({ label: '🔥 High Priority Tickets', kind: vscode.QuickPickItemKind.Separator });
                        ticketSections.push(...highPriorityTickets.slice(0, 5).map(ticket => this.createTicketItem(ticket)));
                    }
                    ticketSections.push({ label: '📋 Recent Activity', kind: vscode.QuickPickItemKind.Separator });
                    ticketSections.push(...recentTickets.map(ticket => this.createTicketItem(ticket)));
                }
                const quickPick = vscode.window.createQuickPick();
                quickPick.items = [...actionItems, ...ticketSections];
                quickPick.placeholder = allTickets.length === 0
                    ? '🔍 No tickets found. Try searching or check your settings...'
                    : `🎯 Select a ticket to generate an AI implementation plan (${allTickets.length} available)`;
                quickPick.matchOnDescription = true;
                quickPick.matchOnDetail = true;
                quickPick.ignoreFocusOut = false;
                // Add custom title and description
                quickPick.title = '🤖 AI Plan - Select Ticket';
                const selected = await new Promise((resolve) => {
                    quickPick.onDidChangeSelection(items => {
                        if (items[0]) {
                            resolve(items[0]);
                            quickPick.hide();
                        }
                    });
                    quickPick.onDidHide(() => resolve(undefined));
                    quickPick.show();
                });
                if (!selected) {
                    return null;
                }
                if (selected.command === 'refresh') {
                    continue;
                }
                if (selected.command === 'loadMore') {
                    limit = Math.min(limit + 10, 50);
                    continue;
                }
                if (selected.command === 'openSettings') {
                    await vscode.commands.executeCommand('ai-plan.settings');
                    continue;
                }
                if (selected.command === 'search') {
                    const key = await vscode.window.showInputBox({
                        prompt: 'Enter issue key or ID (e.g., PROJ-123)',
                        placeHolder: 'PROJ-123'
                    });
                    if (!key) {
                        continue;
                    }
                    for (const provider of this.providers) {
                        try {
                            const ticket = await provider.getTicket(key);
                            return ticket;
                        }
                        catch (error) {
                            // Try next provider
                        }
                    }
                    await vscode.window.showErrorMessage('Ticket not found in configured providers.');
                    continue;
                }
                if (selected.command === 'searchText') {
                    const q = await vscode.window.showInputBox({
                        prompt: 'Search text (summary/description)',
                        placeHolder: 'e.g., auth bug login redirect'
                    });
                    if (!q) {
                        continue;
                    }
                    const results = [];
                    for (const provider of this.providers) {
                        try {
                            const method = provider.searchByText;
                            if (typeof method === 'function') {
                                const found = await method.call(provider, q, 20);
                                results.push(...found);
                            }
                        }
                        catch {
                            // ignore provider errors
                        }
                    }
                    if (results.length === 0) {
                        await vscode.window.showWarningMessage('No matches found.');
                        continue;
                    }
                    const items = results.map(r => ({
                        label: `${r.key} - ${r.summary}`,
                        description: `${r.provider} • ${this.formatTimeAgo(r.updatedAt)} • ${r.priority} Priority`,
                        detail: r.description.substring(0, 100) + (r.description.length > 100 ? '...' : ''),
                        ticket: r
                    }));
                    const picked = await vscode.window.showQuickPick(items, {
                        placeHolder: 'Select a ticket from search results...',
                        matchOnDescription: true,
                        matchOnDetail: true
                    });
                    if (picked?.ticket)
                        return picked.ticket;
                    continue;
                }
                // Optional: Browse boards assigned to you
                if (selected.command === 'browseBoards') {
                    for (const provider of this.providers) {
                        const getBoards = provider.getBoards;
                        const getBoardIssuesAssignedToMe = provider.getBoardIssuesAssignedToMe;
                        if (typeof getBoards === 'function' && typeof getBoardIssuesAssignedToMe === 'function') {
                            const boards = await getBoards.call(provider, 50);
                            if (!boards || boards.length === 0) {
                                await vscode.window.showWarningMessage('No boards found.');
                                continue;
                            }
                            const boardPick = await vscode.window.showQuickPick(boards.map((b) => ({ label: `${b.name}`, description: b.type ? `${b.type}` : undefined, boardId: b.id })), { placeHolder: 'Select a board...' });
                            if (!boardPick)
                                continue;
                            const issues = await getBoardIssuesAssignedToMe.call(provider, boardPick.boardId, 50);
                            if (!issues || issues.length === 0) {
                                await vscode.window.showWarningMessage('No issues assigned to you on this board.');
                                continue;
                            }
                            const items = issues.map((r) => ({
                                label: `${r.key} - ${r.summary}`,
                                description: `${r.provider} • ${this.formatTimeAgo(r.updatedAt)} • ${r.priority} Priority`,
                                detail: r.description.substring(0, 100) + (r.description.length > 100 ? '...' : ''),
                                ticket: r
                            }));
                            const picked = await vscode.window.showQuickPick(items, {
                                placeHolder: 'Select a ticket from the board...',
                                matchOnDescription: true,
                                matchOnDetail: true
                            });
                            if (picked?.ticket)
                                return picked.ticket;
                        }
                    }
                    continue;
                }
                if (selected.ticket) {
                    return selected.ticket;
                }
            }
        }
        catch (error) {
            console.error('Error showing recent tickets:', error);
            await vscode.window.showErrorMessage('Failed to fetch recent tickets. Please check your configuration.');
            return null;
        }
    }
    createTicketItem(ticket) {
        const priorityEmoji = this.getPriorityEmoji(ticket.priority);
        const statusEmoji = this.getStatusEmoji(ticket.status);
        const providerEmoji = this.getProviderEmoji(ticket.provider);
        return {
            label: `${priorityEmoji} ${ticket.key} • ${ticket.summary}`,
            description: `${providerEmoji} ${ticket.provider} • ${statusEmoji} ${ticket.status} • ${this.formatTimeAgo(ticket.updatedAt)}`,
            detail: this.truncateDescription(ticket.description),
            ticket
        };
    }
    getPriorityEmoji(priority) {
        const priorityMap = {
            'urgent': '🔴',
            'high': '🟠',
            'medium': '🟡',
            'low': '🟢'
        };
        return priorityMap[priority.toLowerCase()] || '⚪';
    }
    getStatusEmoji(status) {
        const statusLower = status.toLowerCase();
        if (statusLower.includes('progress') || statusLower.includes('doing'))
            return '⚡';
        if (statusLower.includes('done') || statusLower.includes('closed'))
            return '✅';
        if (statusLower.includes('review'))
            return '👀';
        if (statusLower.includes('blocked'))
            return '🚫';
        if (statusLower.includes('todo') || statusLower.includes('open') || statusLower.includes('new'))
            return '📝';
        return '📋';
    }
    getProviderEmoji(provider) {
        const providerMap = {
            'jira': '🏢',
            'github': '🐙',
            'linear': '📐',
            'slack': '💬'
        };
        return providerMap[provider.toLowerCase()] || '🔗';
    }
    truncateDescription(description, maxLength = 120) {
        if (!description)
            return 'No description available';
        const cleaned = description.replace(/\s+/g, ' ').trim();
        if (cleaned.length <= maxLength)
            return cleaned;
        return cleaned.substring(0, maxLength - 3) + '...';
    }
    formatTimeAgo(date) {
        const now = new Date();
        const diffInMs = now.getTime() - date.getTime();
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
        if (diffInMinutes < 60) {
            return `${diffInMinutes}m ago`;
        }
        else if (diffInHours < 24) {
            return `${diffInHours}h ago`;
        }
        else {
            return `${diffInDays}d ago`;
        }
    }
    async showTicketDetails(ticket) {
        const details = `**${ticket.key} - ${ticket.summary}**

**Provider:** ${ticket.provider}
**Priority:** ${ticket.priority}
**Status:** ${ticket.status}
**Assignee:** ${ticket.assignee || 'Unassigned'}
**Created:** ${ticket.createdAt.toLocaleDateString()}
**Updated:** ${ticket.updatedAt.toLocaleDateString()}
**Labels:** ${ticket.labels.join(', ') || 'None'}

**Description:**
${ticket.description}

**URL:** ${ticket.url}`;
        const document = await vscode.workspace.openTextDocument({
            content: details,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(document);
    }
    // =================== NEW UI METHODS ===================
    async showTaskGroup(group) {
        const items = group.tasks.map(task => ({
            label: `${this.getPriorityEmoji(task.priority)} ${task.key} • ${task.summary}`,
            description: `${this.getStatusEmoji(task.status)} ${task.status} • Updated ${this.formatTimeAgo(task.updatedAt)}`,
            detail: this.truncateDescription(task.description),
            task
        }));
        const selected = await vscode.window.showQuickPick(items, {
            title: `${group.icon} ${group.title} (${group.count} tasks)`,
            placeHolder: 'Select a task to generate an implementation plan...',
            matchOnDescription: true,
            matchOnDetail: true
        });
        return selected?.task || null;
    }
    async showProjectBrowser() {
        if (!this.jiraProvider)
            return null;
        const projects = await this.jiraProvider.getTasksByProject();
        if (projects.length === 0) {
            await vscode.window.showInformationMessage('No projects with assigned tasks found.');
            return null;
        }
        const projectItems = projects.map(project => ({
            label: `${project.icon} ${project.name}`,
            description: `${project.taskCount} tasks assigned to you`,
            detail: project.description,
            project
        }));
        const selectedProject = await vscode.window.showQuickPick(projectItems, {
            title: '🏢 Select Project/Board',
            placeHolder: 'Choose a project to view your assigned tasks...',
            matchOnDescription: true
        });
        if (!selectedProject)
            return null;
        // Show tasks from selected project
        const taskItems = selectedProject.project.tasks.map(task => ({
            label: `${this.getPriorityEmoji(task.priority)} ${task.key} • ${task.summary}`,
            description: `${this.getStatusEmoji(task.status)} ${task.status} • Updated ${this.formatTimeAgo(task.updatedAt)}`,
            detail: this.truncateDescription(task.description),
            task
        }));
        const selectedTask = await vscode.window.showQuickPick(taskItems, {
            title: `${selectedProject.project.icon} ${selectedProject.project.name} Tasks`,
            placeHolder: `Select from ${selectedProject.project.taskCount} assigned tasks...`,
            matchOnDescription: true,
            matchOnDetail: true
        });
        return selectedTask?.task || null;
    }
    async showSprintTasks() {
        if (!this.jiraProvider)
            return null;
        try {
            const sprintTasks = await this.jiraProvider.getCurrentSprintTasks();
            if (sprintTasks.length === 0) {
                await vscode.window.showInformationMessage('No active sprint tasks found.');
                return null;
            }
            const taskItems = sprintTasks.map(task => ({
                label: `${this.getPriorityEmoji(task.priority)} ${task.key} • ${task.summary}`,
                description: `${this.getStatusEmoji(task.status)} ${task.status} • Updated ${this.formatTimeAgo(task.updatedAt)}`,
                detail: this.truncateDescription(task.description),
                task
            }));
            const selectedTask = await vscode.window.showQuickPick(taskItems, {
                title: '🏃 Active Sprint Tasks',
                placeHolder: `Select from ${sprintTasks.length} sprint tasks...`,
                matchOnDescription: true,
                matchOnDetail: true
            });
            return selectedTask?.task || null;
        }
        catch (error) {
            await vscode.window.showErrorMessage('Failed to load sprint tasks. Please check your Jira configuration.');
            return null;
        }
    }
    async showAllTasks() {
        if (!this.jiraProvider)
            return null;
        try {
            const tasks = await this.jiraProvider.getRecentTickets(100);
            if (tasks.length === 0) {
                await vscode.window.showInformationMessage('No tasks found.');
                return null;
            }
            const taskItems = tasks.map(task => ({
                label: `${this.getPriorityEmoji(task.priority)} ${task.key} • ${task.summary}`,
                description: `${this.getProviderEmoji(task.provider)} ${task.provider} • ${this.getStatusEmoji(task.status)} ${task.status} • ${this.formatTimeAgo(task.updatedAt)}`,
                detail: this.truncateDescription(task.description),
                task
            }));
            const selectedTask = await vscode.window.showQuickPick(taskItems, {
                title: '📋 All My Tasks',
                placeHolder: `Select from ${tasks.length} assigned tasks...`,
                matchOnDescription: true,
                matchOnDetail: true
            });
            return selectedTask?.task || null;
        }
        catch (error) {
            await vscode.window.showErrorMessage('Failed to load all tasks. Please check your configuration.');
            return null;
        }
    }
    async showRecentlyUpdated() {
        if (!this.jiraProvider)
            return null;
        try {
            const recentTasks = await this.jiraProvider.getRecentlyUpdatedTasks(7, 50);
            if (recentTasks.length === 0) {
                await vscode.window.showInformationMessage('No recently updated tasks found.');
                return null;
            }
            const taskItems = recentTasks.map(task => ({
                label: `${this.getPriorityEmoji(task.priority)} ${task.key} • ${task.summary}`,
                description: `${this.getStatusEmoji(task.status)} ${task.status} • Updated ${this.formatTimeAgo(task.updatedAt)}`,
                detail: this.truncateDescription(task.description),
                task
            }));
            const selectedTask = await vscode.window.showQuickPick(taskItems, {
                title: '📅 Recently Updated Tasks (Last 7 Days)',
                placeHolder: `Select from ${recentTasks.length} recently updated tasks...`,
                matchOnDescription: true,
                matchOnDetail: true
            });
            return selectedTask?.task || null;
        }
        catch (error) {
            await vscode.window.showErrorMessage('Failed to load recent tasks. Please check your configuration.');
            return null;
        }
    }
    async showTaskSearch() {
        const searchOptions = [
            {
                label: '🔍 Search by Key',
                description: 'Find a specific task by its key (e.g., PROJ-123)',
                action: 'search_key'
            },
            {
                label: '📝 Search by Text',
                description: 'Search tasks by title or description content',
                action: 'search_text'
            },
            {
                label: '🔥 High Priority Only',
                description: 'Show only high and urgent priority tasks',
                action: 'filter_priority'
            },
            {
                label: '📅 Due Soon',
                description: 'Tasks due in the next 7 days',
                action: 'due_soon'
            }
        ];
        const selectedOption = await vscode.window.showQuickPick(searchOptions, {
            title: '🔍 Search & Filter Options',
            placeHolder: 'How would you like to find your task?'
        });
        if (!selectedOption || !this.jiraProvider)
            return null;
        try {
            switch (selectedOption.action) {
                case 'search_key':
                    return await this.searchByKey();
                case 'search_text':
                    return await this.searchByText();
                case 'filter_priority':
                    return await this.showHighPriorityTasks();
                case 'due_soon':
                    return await this.showDueSoonTasks();
                default:
                    return null;
            }
        }
        catch (error) {
            await vscode.window.showErrorMessage('Search failed. Please try again.');
            return null;
        }
    }
    async searchByKey() {
        const key = await vscode.window.showInputBox({
            prompt: 'Enter task key (e.g., PROJ-123)',
            placeHolder: 'PROJ-123',
            title: '🔍 Search by Key'
        });
        if (!key || !this.jiraProvider)
            return null;
        try {
            const ticket = await this.jiraProvider.getTicket(key.trim().toUpperCase());
            return ticket;
        }
        catch (error) {
            await vscode.window.showErrorMessage(`Task '${key}' not found or not accessible.`);
            return null;
        }
    }
    async searchByText() {
        const searchText = await vscode.window.showInputBox({
            prompt: 'Enter search text (searches in title and description)',
            placeHolder: 'e.g., login bug, API endpoint, user interface',
            title: '📝 Search by Text'
        });
        if (!searchText || !this.jiraProvider)
            return null;
        try {
            const results = await this.jiraProvider.searchByText(searchText, 20);
            if (results.length === 0) {
                await vscode.window.showInformationMessage(`No tasks found containing "${searchText}".`);
                return null;
            }
            const taskItems = results.map((task) => ({
                label: `${this.getPriorityEmoji(task.priority)} ${task.key} • ${task.summary}`,
                description: `${this.getStatusEmoji(task.status)} ${task.status} • ${this.formatTimeAgo(task.updatedAt)}`,
                detail: this.truncateDescription(task.description),
                task
            }));
            const selectedTask = await vscode.window.showQuickPick(taskItems, {
                title: `🔍 Search Results for "${searchText}"`,
                placeHolder: `Select from ${results.length} matching tasks...`,
                matchOnDescription: true,
                matchOnDetail: true
            });
            return selectedTask?.task || null;
        }
        catch (error) {
            await vscode.window.showErrorMessage('Text search failed. Please try a different search term.');
            return null;
        }
    }
    async showHighPriorityTasks() {
        if (!this.jiraProvider)
            return null;
        try {
            const urgentTasks = await this.jiraProvider.getUrgentTasks(30);
            if (urgentTasks.length === 0) {
                await vscode.window.showInformationMessage('No high priority tasks found.');
                return null;
            }
            const taskItems = urgentTasks.map(task => ({
                label: `${this.getPriorityEmoji(task.priority)} ${task.key} • ${task.summary}`,
                description: `${this.getStatusEmoji(task.status)} ${task.status} • ${this.formatTimeAgo(task.updatedAt)}`,
                detail: this.truncateDescription(task.description),
                task
            }));
            const selectedTask = await vscode.window.showQuickPick(taskItems, {
                title: '🔥 High Priority Tasks',
                placeHolder: `Select from ${urgentTasks.length} high priority tasks...`,
                matchOnDescription: true,
                matchOnDetail: true
            });
            return selectedTask?.task || null;
        }
        catch (error) {
            await vscode.window.showErrorMessage('Failed to load high priority tasks.');
            return null;
        }
    }
    async showDueSoonTasks() {
        if (!this.jiraProvider)
            return null;
        try {
            const dueTasks = await this.jiraProvider.getTasksDueSoon(7, 30);
            if (dueTasks.length === 0) {
                await vscode.window.showInformationMessage('No tasks due in the next 7 days.');
                return null;
            }
            const taskItems = dueTasks.map(task => ({
                label: `${this.getPriorityEmoji(task.priority)} ${task.key} • ${task.summary}`,
                description: `${this.getStatusEmoji(task.status)} ${task.status} • Due soon • ${this.formatTimeAgo(task.updatedAt)}`,
                detail: this.truncateDescription(task.description),
                task
            }));
            const selectedTask = await vscode.window.showQuickPick(taskItems, {
                title: '⏰ Tasks Due Soon (Next 7 Days)',
                placeHolder: `Select from ${dueTasks.length} tasks due soon...`,
                matchOnDescription: true,
                matchOnDetail: true
            });
            return selectedTask?.task || null;
        }
        catch (error) {
            await vscode.window.showErrorMessage('Failed to load tasks due soon.');
            return null;
        }
    }
    // =================== SLACK-SPECIFIC METHODS ===================
    async showSlackChannels() {
        if (!this.slackProvider)
            return null;
        try {
            const taskChannels = await this.slackProvider.getTaskChannels();
            if (taskChannels.length === 0) {
                await vscode.window.showInformationMessage('No task-related Slack channels found.');
                return null;
            }
            // Get channel names and task counts
            const channelItems = [];
            for (const channelId of taskChannels.slice(0, 20)) {
                try {
                    const tasks = await this.slackProvider.getTasksByChannel(channelId, 10);
                    if (tasks.length > 0) {
                        const channelName = tasks[0].labels.find(label => label.startsWith('#'))?.substring(1) || channelId;
                        channelItems.push({
                            label: `💬 #${channelName}`,
                            description: `${tasks.length} tasks found`,
                            detail: `Recent task discussions from this channel`,
                            channelId,
                            tasks
                        });
                    }
                }
                catch (error) {
                    console.error(`Error getting tasks for channel ${channelId}:`, error);
                }
            }
            const selectedChannel = await vscode.window.showQuickPick(channelItems, {
                title: '💬 Select Slack Channel',
                placeHolder: 'Choose a channel to view tasks from...',
                matchOnDescription: true
            });
            if (!selectedChannel)
                return null;
            // Show tasks from selected channel
            const taskItems = selectedChannel.tasks.map(task => ({
                label: `${this.getPriorityEmoji(task.priority)} ${task.summary}`,
                description: `${this.getStatusEmoji(task.status)} ${task.status} • ${this.formatTimeAgo(task.updatedAt)}`,
                detail: this.truncateDescription(task.description),
                task
            }));
            const selectedTask = await vscode.window.showQuickPick(taskItems, {
                title: `💬 #${selectedChannel.label.replace('💬 #', '')} Tasks`,
                placeHolder: `Select from ${selectedChannel.tasks.length} tasks...`,
                matchOnDescription: true,
                matchOnDetail: true
            });
            return selectedTask?.task || null;
        }
        catch (error) {
            await vscode.window.showErrorMessage('Failed to load Slack channels. Please check your configuration.');
            return null;
        }
    }
    async showSlackMentions() {
        if (!this.slackProvider)
            return null;
        try {
            const mentions = await this.slackProvider.getMyTaskMentions(7, 30);
            if (mentions.length === 0) {
                await vscode.window.showInformationMessage('No recent mentions found in Slack.');
                return null;
            }
            const taskItems = mentions.map(task => ({
                label: `${this.getPriorityEmoji(task.priority)} ${task.summary}`,
                description: `${this.getProviderEmoji('slack')} ${task.labels.find(l => l.startsWith('#')) || 'DM'} • ${this.getStatusEmoji(task.status)} ${task.status} • ${this.formatTimeAgo(task.updatedAt)}`,
                detail: this.truncateDescription(task.description),
                task
            }));
            const selectedTask = await vscode.window.showQuickPick(taskItems, {
                title: '🧵 My Slack Mentions (Last 7 Days)',
                placeHolder: `Select from ${mentions.length} mentions...`,
                matchOnDescription: true,
                matchOnDetail: true
            });
            return selectedTask?.task || null;
        }
        catch (error) {
            await vscode.window.showErrorMessage('Failed to load Slack mentions. Please check your configuration.');
            return null;
        }
    }
    async showSlackHighPriority() {
        if (!this.slackProvider)
            return null;
        try {
            const highPriorityTasks = await this.slackProvider.getHighPriorityTasks(20);
            if (highPriorityTasks.length === 0) {
                await vscode.window.showInformationMessage('No high priority Slack tasks found.');
                return null;
            }
            const taskItems = highPriorityTasks.map(task => ({
                label: `${this.getPriorityEmoji(task.priority)} ${task.summary}`,
                description: `${this.getProviderEmoji('slack')} ${task.labels.find(l => l.startsWith('#')) || 'DM'} • ${this.getStatusEmoji(task.status)} ${task.status} • ${this.formatTimeAgo(task.updatedAt)}`,
                detail: this.truncateDescription(task.description),
                task
            }));
            const selectedTask = await vscode.window.showQuickPick(taskItems, {
                title: '🔥 High Priority Slack Tasks',
                placeHolder: `Select from ${highPriorityTasks.length} urgent tasks...`,
                matchOnDescription: true,
                matchOnDetail: true
            });
            return selectedTask?.task || null;
        }
        catch (error) {
            await vscode.window.showErrorMessage('Failed to load high priority Slack tasks.');
            return null;
        }
    }
}
exports.RecentTicketsPicker = RecentTicketsPicker;
//# sourceMappingURL=recentTicketsPicker.js.map