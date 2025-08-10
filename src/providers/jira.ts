import { BaseProvider } from './base';
import { RecentTicket } from '../types';

export class JiraProvider extends BaseProvider {
  getProviderName(): string {
    return 'jira';
  }

  async validateConfig(): Promise<boolean> {
    if (!this.config.baseUrl || !this.config.token) {
      return false;
    }

    try {
      await this.makeRequest(`${this.config.baseUrl}/rest/api/3/myself`);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getRecentTickets(limit: number = 10): Promise<RecentTicket[]> {
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

    return response.issues.map((issue: any) => this.mapToRecentTicket(issue));
  }

  async getTicket(id: string): Promise<RecentTicket> {
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
  async getMyWork(limit: number = 20): Promise<RecentTicket[]> {
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

    return response.issues.map((issue: any) => this.mapToRecentTicket(issue));
  }

  // Full-text search in issues (title/description/comments depending on instance config)
  async searchByText(query: string, limit: number = 20): Promise<RecentTicket[]> {
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

    return response.issues.map((issue: any) => this.mapToRecentTicket(issue));
  }

  async getProjects(): Promise<Array<{ key: string; name: string }>> {
    const url = `${this.config.baseUrl}/rest/api/3/project/search`;
    const response = await this.makeRequest(url, { method: 'GET' });
    const values = response.values || [];
    return values.map((p: any) => ({ key: p.key, name: p.name }));
  }

  async getRecentTicketsForProjects(projectKeys: string[], limit: number = 20): Promise<RecentTicket[]> {
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
    return response.issues.map((issue: any) => this.mapToRecentTicket(issue));
  }

  // Boards (Jira Software Agile API)
  async getBoards(limit: number = 50): Promise<Array<{ id: number; name: string; type?: string }>> {
    const url = `${this.config.baseUrl}/rest/agile/1.0/board`;
    const response = await this.makeRequest(url, {
      method: 'GET',
      params: {
        maxResults: limit
      }
    });
    const values = response.values || [];
    return values.map((b: any) => ({ id: b.id, name: b.name, type: b.type }));
  }

  async getBoardIssuesAssignedToMe(boardId: number, limit: number = 50): Promise<RecentTicket[]> {
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
    return (response.issues || []).map((issue: any) => this.mapToRecentTicket(issue));
  }

  protected mapToRecentTicket(issue: any): RecentTicket {
    const priorityMap: Record<string, 'low' | 'medium' | 'high' | 'urgent'> = {
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

  protected getAuthHeaders(): Record<string, string> {
    if (!this.config.token) {
      return {};
    }

    return {
      'Authorization': `Basic ${Buffer.from(this.config.token).toString('base64')}`,
      'Content-Type': 'application/json'
    };
  }
}
