import { BaseProvider } from './base';
import { RecentTicket, TaskGroup, ProjectGroup } from '../types';

/**
 * Linear API provider for fetching issues and tasks
 * Uses Linear's GraphQL API for data retrieval
 */
export class LinearProvider extends BaseProvider {
  private readonly GRAPHQL_ENDPOINT = 'https://api.linear.app/graphql';
  private taskCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  getProviderName(): string {
    return 'linear';
  }

  async validateConfig(): Promise<boolean> {
    if (!this.config.token) {
      return false;
    }

    try {
      const query = `
        query {
          viewer {
            id
            name
            email
          }
        }
      `;

      await this.graphqlRequest(query);
      return true;
    } catch (error) {
      console.error('Linear validation failed:', error);
      return false;
    }
  }

  /**
   * Get recent tickets assigned to the current user
   */
  async getRecentTickets(limit: number = 10): Promise<RecentTicket[]> {
    const query = `
      query GetRecentIssues($first: Int!) {
        issues(
          filter: { assignee: { isMe: { eq: true } } }
          orderBy: updatedAt
          first: $first
        ) {
          nodes {
            id
            identifier
            title
            description
            priority
            state {
              name
              type
            }
            assignee {
              name
              email
            }
            labels {
              nodes {
                name
              }
            }
            createdAt
            updatedAt
            url
            team {
              name
            }
          }
        }
      }
    `;

    const response = await this.graphqlRequest(query, { first: limit });
    return response.data.issues.nodes.map((issue: any) => this.mapToRecentTicket(issue));
  }

  /**
   * Get a specific ticket by ID
   */
  async getTicket(id: string): Promise<RecentTicket> {
    const query = `
      query GetIssue($id: String!) {
        issue(id: $id) {
          id
          identifier
          title
          description
          priority
          state {
            name
            type
          }
          assignee {
            name
            email
          }
          labels {
            nodes {
              name
            }
          }
          createdAt
          updatedAt
          url
          team {
            name
          }
        }
      }
    `;

    const response = await this.graphqlRequest(query, { id });
    return this.mapToRecentTicket(response.data.issue);
  }

  /**
   * Get tasks grouped by status/workflow
   */
  async getMyActiveWorkItems(limit: number = 50): Promise<TaskGroup[]> {
    const cacheKey = `my-active-work-${limit}`;
    return this.getCachedData(cacheKey, async () => {
      const tasks = await this.getMyAssignedTasks(limit);

      const groups: TaskGroup[] = [
        {
          title: 'High Priority',
          icon: '🔥',
          count: 0,
          tasks: tasks.filter(t => t.priority === 'urgent' || t.priority === 'high'),
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
          title: 'Todo',
          icon: '📋',
          count: 0,
          tasks: tasks.filter(t => this.isTodo(t.status)),
          priority: 'medium'
        },
        {
          title: 'Blocked',
          icon: '🚫',
          count: 0,
          tasks: tasks.filter(t => this.isBlocked(t.status)),
          priority: 'low'
        }
      ];

      return groups
        .map(group => ({ ...group, count: group.tasks.length }))
        .filter(group => group.count > 0);
    });
  }

  /**
   * Get tasks organized by team/project
   */
  async getTasksByProject(limit: number = 100): Promise<ProjectGroup[]> {
    const cacheKey = `tasks-by-project-${limit}`;
    return this.getCachedData(cacheKey, async () => {
      const query = `
        query GetTeamsWithIssues($first: Int!) {
          teams {
            nodes {
              id
              name
              key
              description
              issues(
                filter: { assignee: { isMe: { eq: true } } }
                first: $first
              ) {
                nodes {
                  id
                  identifier
                  title
                  description
                  priority
                  state {
                    name
                    type
                  }
                  assignee {
                    name
                  }
                  labels {
                    nodes {
                      name
                    }
                  }
                  createdAt
                  updatedAt
                  url
                }
              }
            }
          }
        }
      `;

      const response = await this.graphqlRequest(query, { first: limit });
      const projects: ProjectGroup[] = [];

      for (const team of response.data.teams.nodes) {
        const tasks = team.issues.nodes.map((issue: any) => this.mapToRecentTicket(issue));
        if (tasks.length > 0) {
          projects.push({
            id: team.id,
            name: team.name,
            key: team.key,
            taskCount: tasks.length,
            icon: '📊',
            description: team.description || `${tasks.length} tasks assigned`,
            tasks
          });
        }
      }

      return projects.sort((a, b) => b.taskCount - a.taskCount);
    });
  }

  /**
   * Search issues by text
   */
  async searchByText(query: string, limit: number = 20): Promise<RecentTicket[]> {
    const graphqlQuery = `
      query SearchIssues($query: String!, $first: Int!) {
        issues(
          filter: { 
            assignee: { isMe: { eq: true } }
            or: [
              { title: { containsIgnoreCase: $query } }
              { description: { containsIgnoreCase: $query } }
            ]
          }
          first: $first
        ) {
          nodes {
            id
            identifier
            title
            description
            priority
            state {
              name
              type
            }
            assignee {
              name
            }
            labels {
              nodes {
                name
              }
            }
            createdAt
            updatedAt
            url
            team {
              name
            }
          }
        }
      }
    `;

    const response = await this.graphqlRequest(graphqlQuery, { query, first: limit });
    return response.data.issues.nodes.map((issue: any) => this.mapToRecentTicket(issue));
  }

  // Private helper methods

  private async getMyAssignedTasks(limit: number): Promise<RecentTicket[]> {
    const query = `
      query GetMyTasks($first: Int!) {
        issues(
          filter: { 
            assignee: { isMe: { eq: true } }
            state: { type: { nin: [completed, canceled] } }
          }
          orderBy: priority
          first: $first
        ) {
          nodes {
            id
            identifier
            title
            description
            priority
            state {
              name
              type
            }
            assignee {
              name
            }
            labels {
              nodes {
                name
              }
            }
            createdAt
            updatedAt
            url
            team {
              name
            }
          }
        }
      }
    `;

    const response = await this.graphqlRequest(query, { first: limit });
    return response.data.issues.nodes.map((issue: any) => this.mapToRecentTicket(issue));
  }

  private isInProgress(status: string): boolean {
    const inProgressStates = ['in progress', 'started', 'doing', 'in development', 'in review'];
    return inProgressStates.some(state => status.toLowerCase().includes(state));
  }

  private isTodo(status: string): boolean {
    const todoStates = ['todo', 'backlog', 'triage', 'ready'];
    return todoStates.some(state => status.toLowerCase().includes(state));
  }

  private isBlocked(status: string): boolean {
    const blockedStates = ['blocked', 'waiting', 'hold', 'paused'];
    return blockedStates.some(state => status.toLowerCase().includes(state));
  }

  private async graphqlRequest(query: string, variables?: any): Promise<any> {
    const response = await this.makeRequest(this.GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.token}`
      },
      data: {
        query,
        variables: variables || {}
      }
    });

    if (response.errors) {
      throw new Error(`Linear GraphQL Error: ${response.errors.map((e: any) => e.message).join(', ')}`);
    }

    return response;
  }

  private mapToRecentTicket(issue: any): RecentTicket {
    const priorityMap: Record<number, 'low' | 'medium' | 'high' | 'urgent'> = {
      0: 'low',     // None
      1: 'low',     // Low  
      2: 'medium',  // Medium
      3: 'high',    // High
      4: 'urgent'   // Urgent
    };

    return {
      id: issue.id,
      key: issue.identifier,
      summary: issue.title || '',
      description: issue.description || '',
      provider: 'linear',
      priority: priorityMap[issue.priority] || 'medium',
      assignee: issue.assignee?.name,
      labels: (issue.labels?.nodes || []).map((label: any) => label.name),
      createdAt: new Date(issue.createdAt),
      updatedAt: new Date(issue.updatedAt),
      url: issue.url,
      status: issue.state?.name || 'Unknown'
    };
  }

  private async getCachedData<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.taskCache.get(key);

    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data as T;
    }

    const data = await fetcher();
    this.taskCache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  protected getAuthHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.token}`,
      'Content-Type': 'application/json'
    };
  }
}