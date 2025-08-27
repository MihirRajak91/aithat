"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraProvider = void 0;
const base_1 = require("./base");
const cache_1 = require("../utils/cache");
class JiraProvider extends base_1.BaseProvider {
    constructor() {
        super(...arguments);
        this.cache = cache_1.cacheManager.getCache('jira', {
            defaultTTL: 5 * 60 * 1000, // 5 minutes
            maxSize: 50
        });
        this.currentUser = null;
    }
    getProviderName() {
        return 'jira';
    }
    async validateConfig() {
        if (!this.config.baseUrl || !this.config.token) {
            return false;
        }
        try {
            const user = await this.makeRequest(`${this.config.baseUrl}/rest/api/3/myself`);
            this.currentUser = user; // Cache user info
            return true;
        }
        catch (error) {
            console.error('Jira validation failed:', error);
            return false;
        }
    }
    // =================== CORE OPTIMIZED METHODS ===================
    // Primary method - get user's active work items grouped intelligently
    async getMyActiveWorkItems(limit = 50) {
        const cacheKey = `my-active-work-${limit}`;
        return this.getCachedData(cacheKey, async () => {
            const tasks = await this.getMyAssignedTasks(limit);
            const groups = [
                {
                    title: 'High Priority Tasks',
                    icon: '🔥',
                    count: 0,
                    tasks: tasks.filter(t => ['urgent', 'high'].includes(t.priority)),
                    priority: 'high'
                },
                {
                    title: 'In Progress',
                    icon: '⚡',
                    count: 0,
                    tasks: tasks.filter(t => this.isInProgress(t.status)),
                    priority: 'medium'
                },
                {
                    title: 'Ready to Start',
                    icon: '📋',
                    count: 0,
                    tasks: tasks.filter(t => this.isReadyToStart(t.status)),
                    priority: 'medium'
                },
                {
                    title: 'Blocked/Waiting',
                    icon: '🚫',
                    count: 0,
                    tasks: tasks.filter(t => this.isBlocked(t.status)),
                    priority: 'low'
                }
            ];
            // Update counts and filter empty groups
            return groups
                .map(group => ({ ...group, count: group.tasks.length }))
                .filter(group => group.count > 0)
                .sort((a, b) => {
                const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
                return (priorityOrder[a.priority || 'medium'] || 2) - (priorityOrder[b.priority || 'medium'] || 2);
            });
        });
    }
    // Get tasks organized by project/board
    async getTasksByProject(limit = 100) {
        const cacheKey = `tasks-by-project-${limit}`;
        return this.getCachedData(cacheKey, async () => {
            const boards = await this.getBoardsWithMyTasks();
            const projects = [];
            for (const board of boards.slice(0, 10)) { // Limit to top 10 boards
                const tasks = await this.getBoardIssuesAssignedToMe(board.id, limit);
                if (tasks.length > 0) {
                    projects.push({
                        id: board.id.toString(),
                        name: board.name,
                        key: board.projectKey || board.name.toUpperCase().replace(/\s+/g, ''),
                        taskCount: tasks.length,
                        icon: this.getProjectIcon(board.type),
                        description: `${tasks.length} tasks assigned to you`,
                        tasks: tasks
                    });
                }
            }
            return projects.sort((a, b) => b.taskCount - a.taskCount);
        });
    }
    // Get recently updated tasks (fast query)
    async getRecentlyUpdatedTasks(days = 7, limit = 20) {
        const cacheKey = `recent-updated-${days}-${limit}`;
        return this.getCachedData(cacheKey, async () => {
            const dateFrom = new Date();
            dateFrom.setDate(dateFrom.getDate() - days);
            const jql = `assignee = currentUser() AND updated >= "${dateFrom.toISOString().split('T')[0]}" ORDER BY updated DESC`;
            return await this.executeJQLQuery(jql, limit);
        });
    }
    // Get urgent tasks (highest priority)
    async getUrgentTasks(limit = 10) {
        const cacheKey = `urgent-tasks-${limit}`;
        return this.getCachedData(cacheKey, async () => {
            const jql = 'assignee = currentUser() AND priority in (Highest, High) AND status != Done AND status != Closed ORDER BY priority DESC, updated DESC';
            return await this.executeJQLQuery(jql, limit);
        });
    }
    // Get tasks due soon
    async getTasksDueSoon(days = 7, limit = 20) {
        const cacheKey = `due-soon-${days}-${limit}`;
        return this.getCachedData(cacheKey, async () => {
            const dateTo = new Date();
            dateTo.setDate(dateTo.getDate() + days);
            const jql = `assignee = currentUser() AND due <= "${dateTo.toISOString().split('T')[0]}" AND status != Done AND status != Closed ORDER BY due ASC`;
            return await this.executeJQLQuery(jql, limit);
        });
    }
    // Get current sprint tasks
    async getCurrentSprintTasks(boardId, limit = 50) {
        const cacheKey = `sprint-tasks-${boardId || 'all'}-${limit}`;
        return this.getCachedData(cacheKey, async () => {
            if (boardId) {
                return await this.getMySprintTasks(boardId);
            }
            // If no specific board, get from all active sprints
            const boards = await this.getBoardsWithMyTasks();
            const allSprintTasks = [];
            for (const board of boards.slice(0, 5)) { // Limit to avoid API throttling
                const sprintTasks = await this.getMySprintTasks(board.id);
                allSprintTasks.push(...sprintTasks);
            }
            return allSprintTasks.slice(0, limit);
        });
    }
    // =================== LEGACY METHODS (Updated) ===================
    async getRecentTickets(limit = 10) {
        const jql = 'ORDER BY updated DESC';
        const url = `${this.config.baseUrl}/rest/api/3/search`;
        const response = await this.makeRequest(url, {
            method: 'GET',
            params: {
                jql,
                maxResults: limit,
                fields: 'summary,description,priority,assignee,labels,created,updated,status,key'
            }
        });
        return response.issues.map((issue) => this.mapToRecentTicket(issue));
    }
    async getTicket(id) {
        const url = `${this.config.baseUrl}/rest/api/3/issue/${id}`;
        const response = await this.makeRequest(url, {
            method: 'GET',
            params: {
                fields: 'summary,description,priority,assignee,labels,created,updated,status,key'
            }
        });
        return this.mapToRecentTicket(response);
    }
    // Fetch issues related to the current user (assigned or reported)
    async getMyWork(limit = 20) {
        const jql = 'assignee = currentUser() OR reporter = currentUser() ORDER BY updated DESC';
        const url = `${this.config.baseUrl}/rest/api/3/search`;
        const response = await this.makeRequest(url, {
            method: 'GET',
            params: {
                jql,
                maxResults: limit,
                fields: 'summary,description,priority,assignee,labels,created,updated,status,key'
            }
        });
        return response.issues.map((issue) => this.mapToRecentTicket(issue));
    }
    // Full-text search in issues (title/description/comments depending on instance config)
    async searchByText(query, limit = 20) {
        const safe = query.replace(/"/g, '\\"');
        const jql = `text ~ "${safe}" ORDER BY updated DESC`;
        const url = `${this.config.baseUrl}/rest/api/3/search`;
        const response = await this.makeRequest(url, {
            method: 'GET',
            params: {
                jql,
                maxResults: limit,
                fields: 'summary,description,priority,assignee,labels,created,updated,status,key'
            }
        });
        return response.issues.map((issue) => this.mapToRecentTicket(issue));
    }
    async getProjects() {
        const url = `${this.config.baseUrl}/rest/api/3/project/search`;
        const response = await this.makeRequest(url, { method: 'GET' });
        const values = response.values || [];
        return values.map((p) => ({ key: p.key, name: p.name }));
    }
    async getRecentTicketsForProjects(projectKeys, limit = 20) {
        if (!projectKeys.length) {
            return this.getRecentTickets(limit);
        }
        const jql = `project in (${projectKeys.map(k => `'${k}'`).join(',')}) ORDER BY updated DESC`;
        const url = `${this.config.baseUrl}/rest/api/3/search`;
        const response = await this.makeRequest(url, {
            method: 'GET',
            params: {
                jql,
                maxResults: limit,
                fields: 'summary,description,priority,assignee,labels,created,updated,status,key'
            }
        });
        return response.issues.map((issue) => this.mapToRecentTicket(issue));
    }
    // Boards (Jira Software Agile API)
    async getBoards(limit = 50) {
        const url = `${this.config.baseUrl}/rest/agile/1.0/board`;
        const response = await this.makeRequest(url, {
            method: 'GET',
            params: {
                maxResults: limit
            }
        });
        const values = response.values || [];
        return values.map((b) => ({ id: b.id, name: b.name, type: b.type }));
    }
    async getBoardIssuesAssignedToMe(boardId, limit = 50) {
        const jql = 'assignee = currentUser() ORDER BY updated DESC';
        const url = `${this.config.baseUrl}/rest/agile/1.0/board/${boardId}/issue`;
        const response = await this.makeRequest(url, {
            method: 'GET',
            params: {
                jql,
                maxResults: limit,
                fields: 'summary,description,priority,assignee,labels,created,updated,status,key'
            }
        });
        return (response.issues || []).map((issue) => this.mapToRecentTicket(issue));
    }
    // Remove duplicate - using enhanced version below
    // =================== HELPER METHODS ===================
    // Optimized JQL execution
    async executeJQLQuery(jql, maxResults = 50) {
        const url = `${this.config.baseUrl}/rest/api/3/search`;
        const response = await this.makeRequest(url, {
            method: 'GET',
            params: {
                jql,
                maxResults,
                fields: 'summary,description,priority,assignee,labels,created,updated,status,key,project,duedate'
            }
        });
        return (response.issues || []).map((issue) => this.mapToRecentTicket(issue));
    }
    // Get user's assigned tasks (core method)
    async getMyAssignedTasks(limit = 50) {
        const jql = 'assignee = currentUser() AND status != Done AND status != Closed AND status != Resolved ORDER BY priority DESC, updated DESC';
        return await this.executeJQLQuery(jql, limit);
    }
    // Status classification helpers
    isInProgress(status) {
        const inProgressStates = [
            'in progress', 'in development', 'in review', 'code review',
            'testing', 'qa', 'doing', 'development', 'implementing'
        ];
        return inProgressStates.some(state => status.toLowerCase().includes(state.toLowerCase()));
    }
    isReadyToStart(status) {
        const readyStates = [
            'to do', 'open', 'new', 'ready', 'backlog', 'selected', 'todo'
        ];
        return readyStates.some(state => status.toLowerCase().includes(state.toLowerCase()));
    }
    isBlocked(status) {
        const blockedStates = [
            'blocked', 'waiting', 'hold', 'paused', 'impediment', 'stuck'
        ];
        return blockedStates.some(state => status.toLowerCase().includes(state.toLowerCase()));
    }
    getProjectIcon(boardType) {
        const iconMap = {
            'scrum': '🏃',
            'kanban': '📋',
            'simple': '📝',
            'software': '💻',
            'business': '💼'
        };
        return iconMap[boardType?.toLowerCase() || 'simple'] || '📊';
    }
    // Enhanced caching system
    async getCachedData(key, fetcher, ttl) {
        return this.cache.getOrCompute(key, fetcher, ttl);
    }
    // Clear cache (useful for refresh operations)
    clearCache() {
        this.cache.clear();
    }
    // Get cache stats (for debugging)
    getCacheStats() {
        return this.cache.getStats();
    }
    // Invalidate specific cache patterns
    invalidateCache(pattern) {
        return this.cache.invalidate(pattern);
    }
    // Enhanced board methods
    async getBoardsWithMyTasks() {
        const cacheKey = 'boards-with-tasks';
        return this.getCachedData(cacheKey, async () => {
            try {
                const boards = await this.getBoards(50);
                const boardsWithTasks = [];
                // Process boards in parallel for better performance
                const boardPromises = boards.slice(0, 20).map(async (board) => {
                    try {
                        // Quick check if board has any assigned tasks
                        const quickCheck = await this.executeJQLQuery(`project = "${board.location?.projectId || board.name}" AND assignee = currentUser() AND status != Done AND status != Closed`, 1);
                        if (quickCheck.length > 0) {
                            // Get actual count
                            const allTasks = await this.executeJQLQuery(`project = "${board.location?.projectId || board.name}" AND assignee = currentUser() AND status != Done AND status != Closed`, 100);
                            return {
                                id: board.id,
                                name: board.name,
                                type: board.type,
                                taskCount: allTasks.length,
                                projectKey: board.location?.projectId,
                                location: board.location
                            };
                        }
                    }
                    catch (error) {
                        console.error(`Error checking tasks for board ${board.name}:`, error);
                    }
                    return null;
                });
                const results = await Promise.all(boardPromises);
                boardsWithTasks.push(...results.filter((board) => board !== null));
                return boardsWithTasks.sort((a, b) => b.taskCount - a.taskCount);
            }
            catch (error) {
                console.error('Error fetching boards with my tasks:', error);
                return [];
            }
        });
    }
    // Sprint methods
    async getMySprintTasks(boardId) {
        const cacheKey = `sprint-tasks-${boardId}`;
        return this.getCachedData(cacheKey, async () => {
            try {
                const sprints = await this.getActiveSprints(boardId);
                if (sprints.length === 0) {
                    return [];
                }
                const sprintId = sprints[0].id;
                const url = `${this.config.baseUrl}/rest/agile/1.0/sprint/${sprintId}/issue`;
                const response = await this.makeRequest(url, {
                    method: 'GET',
                    params: {
                        jql: 'assignee = currentUser() AND status != Done AND status != Closed',
                        fields: 'summary,description,priority,assignee,labels,created,updated,status,key,project,duedate'
                    }
                });
                return (response.issues || []).map((issue) => this.mapToRecentTicket(issue));
            }
            catch (error) {
                console.error(`Error fetching sprint tasks for board ${boardId}:`, error);
                return [];
            }
        });
    }
    async getActiveSprints(boardId) {
        const cacheKey = `active-sprints-${boardId}`;
        return this.getCachedData(cacheKey, async () => {
            try {
                const url = `${this.config.baseUrl}/rest/agile/1.0/board/${boardId}/sprint`;
                const response = await this.makeRequest(url, {
                    method: 'GET',
                    params: {
                        state: 'active'
                    }
                });
                return (response.values || []).map((sprint) => ({
                    id: sprint.id,
                    name: sprint.name,
                    state: sprint.state,
                    startDate: sprint.startDate ? new Date(sprint.startDate) : undefined,
                    endDate: sprint.endDate ? new Date(sprint.endDate) : undefined
                }));
            }
            catch (error) {
                console.error(`Error fetching active sprints for board ${boardId}:`, error);
                return [];
            }
        });
    }
    // Enhanced ticket mapping with better description extraction
    mapToRecentTicket(issue) {
        const priorityMap = {
            'Lowest': 'low',
            'Low': 'low',
            'Medium': 'medium',
            'High': 'high',
            'Highest': 'urgent',
            'Critical': 'urgent'
        };
        return {
            id: issue.id,
            key: issue.key,
            summary: issue.fields.summary || '',
            description: this.extractDescription(issue.fields.description),
            provider: 'jira',
            priority: priorityMap[issue.fields.priority?.name] || 'medium',
            assignee: issue.fields.assignee?.displayName,
            labels: (issue.fields.labels || []).map((label) => typeof label === 'string' ? label : label.name || label),
            createdAt: new Date(issue.fields.created),
            updatedAt: new Date(issue.fields.updated),
            url: `${this.config.baseUrl}/browse/${issue.key}`,
            status: issue.fields.status?.name || 'Unknown'
        };
    }
    extractDescription(description) {
        if (!description) {
            return '';
        }
        // If it's a string, return as-is
        if (typeof description === 'string') {
            return description;
        }
        // If it's Atlassian Document Format (ADF), extract text content
        if (description.type === 'doc' && description.content) {
            return this.extractTextFromADF(description.content);
        }
        // Try to stringify if it's an object
        if (typeof description === 'object') {
            return JSON.stringify(description, null, 2);
        }
        return String(description);
    }
    extractTextFromADF(content) {
        let text = '';
        for (const node of content) {
            if (node.type === 'paragraph' && node.content) {
                for (const inline of node.content) {
                    if (inline.type === 'text') {
                        text += `${inline.text} `;
                    }
                }
                text += '\n';
            }
            else if (node.type === 'heading' && node.content) {
                text += '## ';
                for (const inline of node.content) {
                    if (inline.type === 'text') {
                        text += inline.text;
                    }
                }
                text += '\n';
            }
            else if (node.type === 'bulletList' && node.content) {
                for (const listItem of node.content) {
                    text += '• ';
                    if (listItem.content) {
                        text += this.extractTextFromADF(listItem.content);
                    }
                }
            }
            else if (node.type === 'codeBlock' && node.content) {
                text += '\n```\n';
                for (const inline of node.content) {
                    if (inline.type === 'text') {
                        text += inline.text;
                    }
                }
                text += '\n```\n';
            }
        }
        return text.trim();
    }
    getAuthHeaders() {
        if (!this.config.token) {
            return {};
        }
        return {
            'Authorization': `Basic ${Buffer.from(this.config.token).toString('base64')}`,
            'Content-Type': 'application/json'
        };
    }
}
exports.JiraProvider = JiraProvider;
//# sourceMappingURL=jira.js.map