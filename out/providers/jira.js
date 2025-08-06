"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraProvider = void 0;
const base_1 = require("./base");
class JiraProvider extends base_1.BaseProvider {
    getProviderName() {
        return 'jira';
    }
    async validateConfig() {
        if (!this.config.baseUrl || !this.config.token) {
            return false;
        }
        try {
            await this.makeRequest(`${this.config.baseUrl}/rest/api/3/myself`);
            return true;
        }
        catch (error) {
            return false;
        }
    }
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
    mapToRecentTicket(issue) {
        const priorityMap = {
            'Low': 'low',
            'Medium': 'medium',
            'High': 'high',
            'Highest': 'urgent'
        };
        return {
            id: issue.id,
            key: issue.key,
            summary: issue.fields.summary || '',
            description: issue.fields.description || '',
            provider: 'jira',
            priority: priorityMap[issue.fields.priority?.name] || 'medium',
            assignee: issue.fields.assignee?.displayName,
            labels: issue.fields.labels || [],
            createdAt: new Date(issue.fields.created),
            updatedAt: new Date(issue.fields.updated),
            url: `${this.config.baseUrl}/browse/${issue.key}`,
            status: issue.fields.status?.name || 'Unknown'
        };
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