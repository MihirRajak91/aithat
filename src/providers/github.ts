/**
 * GitHub provider for fetching issues and pull requests
 * Uses GitHub REST API v4 for data retrieval
 */

import { BaseProvider } from './base';
import { RecentTicket, TaskGroup, ProjectGroup } from '../types';
import { cacheManager } from '../utils/cache';
import { ErrorFactory } from '../utils/errorTypes';

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  description?: string;
  private: boolean;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  labels: Array<{
    name: string;
    color: string;
  }>;
  assignee?: {
    login: string;
  };
  created_at: string;
  updated_at: string;
  html_url: string;
  repository?: GitHubRepository;
  pull_request?: any; // Indicates if this is a PR
}

/**
 * GitHub API provider for fetching issues and pull requests
 */
export class GitHubProvider extends BaseProvider {
  private readonly API_BASE_URL = 'https://api.github.com';
  private cache = cacheManager.getCache<any>('github', {
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    maxSize: 50
  });

  getProviderName(): string {
    return 'github';
  }

  async validateConfig(): Promise<boolean> {
    if (!this.config.token) {
      return false;
    }

    try {
      await this.makeRequest(`${this.API_BASE_URL}/user`);
      return true;
    } catch (error) {
      console.error('GitHub validation failed:', error);
      return false;
    }
  }

  /**
   * Get recent issues assigned to the current user
   */
  async getRecentTickets(limit: number = 20): Promise<RecentTicket[]> {
    const cacheKey = `recent-tickets-${limit}`;
    return this.cache.getOrCompute(cacheKey, async () => {
      const url = `${this.API_BASE_URL}/issues`;
      const response = await this.makeRequest(url, {
        method: 'GET',
        params: {
          filter: 'assigned',
          state: 'open',
          sort: 'updated',
          direction: 'desc',
          per_page: limit
        }
      });

      return response.map((issue: GitHubIssue) => this.mapToRecentTicket(issue));
    });
  }

  /**
   * Get a specific issue by repository and number
   */
  async getTicket(id: string): Promise<RecentTicket> {
    // ID format should be "owner/repo#number"
    const match = id.match(/^([^\/]+)\/([^#]+)#(\d+)$/);
    if (!match) {
      throw ErrorFactory.validationFailed('GitHubProvider', 'id', id, 'Format should be "owner/repo#number"');
    }

    const [, owner, repo, number] = match;
    const url = `${this.API_BASE_URL}/repos/${owner}/${repo}/issues/${number}`;
    
    const issue = await this.makeRequest(url);
    return this.mapToRecentTicket(issue);
  }

  /**
   * Get issues grouped by status and priority
   */
  async getMyActiveWorkItems(limit: number = 50): Promise<TaskGroup[]> {
    const cacheKey = `my-active-work-${limit}`;
    return this.cache.getOrCompute(cacheKey, async () => {
      const issues = await this.getMyAssignedIssues(limit);

      const groups: TaskGroup[] = [
        {
          title: 'High Priority Issues',
          icon: '🔥',
          count: 0,
          tasks: issues.filter(issue => this.isHighPriority(issue)),
          priority: 'high'
        },
        {
          title: 'Pull Requests',
          icon: '🔀',
          count: 0,
          tasks: issues.filter(issue => issue.labels.includes('pull-request')),
          priority: 'medium'
        },
        {
          title: 'Bugs',
          icon: '🐛',
          count: 0,
          tasks: issues.filter(issue => issue.labels.includes('bug')),
          priority: 'high'
        },
        {
          title: 'Features',
          icon: '✨',
          count: 0,
          tasks: issues.filter(issue => 
            issue.labels.includes('enhancement') || 
            issue.labels.includes('feature')
          ),
          priority: 'medium'
        },
        {
          title: 'Other Issues',
          icon: '📋',
          count: 0,
          tasks: issues.filter(issue => 
            !this.isHighPriority(issue) &&
            !issue.labels.includes('pull-request') &&
            !issue.labels.includes('bug') &&
            !issue.labels.includes('enhancement') &&
            !issue.labels.includes('feature')
          ),
          priority: 'low'
        }
      ];

      return groups
        .map(group => ({ ...group, count: group.tasks.length }))
        .filter(group => group.count > 0)
        .sort((a, b) => {
          const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
          return (priorityOrder[a.priority || 'medium'] || 1) - (priorityOrder[b.priority || 'medium'] || 1);
        });
    });
  }

  /**
   * Get issues organized by repository
   */
  async getTasksByProject(limit: number = 100): Promise<ProjectGroup[]> {
    const cacheKey = `tasks-by-project-${limit}`;
    return this.cache.getOrCompute(cacheKey, async () => {
      const issues = await this.getMyAssignedIssues(limit);
      const projectMap = new Map<string, RecentTicket[]>();

      // Group issues by repository
      for (const issue of issues) {
        const repoKey = this.extractRepoFromUrl(issue.url);
        if (!projectMap.has(repoKey)) {
          projectMap.set(repoKey, []);
        }
        projectMap.get(repoKey)!.push(issue);
      }

      const projects: ProjectGroup[] = [];
      for (const [repoKey, tasks] of projectMap.entries()) {
        const [owner, repo] = repoKey.split('/');
        projects.push({
          id: repoKey,
          name: repo,
          key: repoKey,
          taskCount: tasks.length,
          icon: '📦',
          description: `${owner}/${repo} - ${tasks.length} issues assigned`,
          tasks
        });
      }

      return projects.sort((a, b) => b.taskCount - a.taskCount);
    });
  }

  /**
   * Search issues by text content
   */
  async searchByText(query: string, limit: number = 20): Promise<RecentTicket[]> {
    const cacheKey = `search-${query}-${limit}`;
    return this.cache.getOrCompute(cacheKey, async () => {
      const url = `${this.API_BASE_URL}/search/issues`;
      const searchQuery = `${query} assignee:@me is:issue`;
      
      const response = await this.makeRequest(url, {
        method: 'GET',
        params: {
          q: searchQuery,
          sort: 'updated',
          order: 'desc',
          per_page: limit
        }
      });

      return (response.items || []).map((issue: GitHubIssue) => this.mapToRecentTicket(issue));
    });
  }

  /**
   * Get issues in a specific repository
   */
  async getRepositoryIssues(owner: string, repo: string, limit: number = 50): Promise<RecentTicket[]> {
    const cacheKey = `repo-issues-${owner}-${repo}-${limit}`;
    return this.cache.getOrCompute(cacheKey, async () => {
      const url = `${this.API_BASE_URL}/repos/${owner}/${repo}/issues`;
      
      const response = await this.makeRequest(url, {
        method: 'GET',
        params: {
          assignee: '@me',
          state: 'open',
          sort: 'updated',
          direction: 'desc',
          per_page: limit
        }
      });

      return response.map((issue: GitHubIssue) => this.mapToRecentTicket(issue));
    });
  }

  /**
   * Get pull requests assigned to current user
   */
  async getMyPullRequests(limit: number = 20): Promise<RecentTicket[]> {
    const cacheKey = `my-pull-requests-${limit}`;
    return this.cache.getOrCompute(cacheKey, async () => {
      const url = `${this.API_BASE_URL}/search/issues`;
      const searchQuery = 'is:pr assignee:@me is:open';
      
      const response = await this.makeRequest(url, {
        method: 'GET',
        params: {
          q: searchQuery,
          sort: 'updated',
          order: 'desc',
          per_page: limit
        }
      });

      return (response.items || []).map((issue: GitHubIssue) => this.mapToRecentTicket(issue));
    });
  }

  // Private helper methods

  private async getMyAssignedIssues(limit: number): Promise<RecentTicket[]> {
    const url = `${this.API_BASE_URL}/issues`;
    const response = await this.makeRequest(url, {
      method: 'GET',
      params: {
        filter: 'assigned',
        state: 'open',
        sort: 'updated',
        direction: 'desc',
        per_page: limit
      }
    });

    return response.map((issue: GitHubIssue) => this.mapToRecentTicket(issue));
  }

  private isHighPriority(ticket: RecentTicket): boolean {
    const highPriorityLabels = ['critical', 'urgent', 'high priority', 'p1', 'priority-high'];
    return ticket.labels.some(label => 
      highPriorityLabels.some(priority => 
        label.toLowerCase().includes(priority)
      )
    );
  }

  private extractRepoFromUrl(url: string): string {
    const match = url.match(/github\.com\/([^\/]+\/[^\/]+)/);
    return match ? match[1] : 'unknown/unknown';
  }

  private mapToRecentTicket(issue: GitHubIssue): RecentTicket {
    const priority = this.determinePriority(issue.labels);
    
    return {
      id: issue.repository ? `${issue.repository.full_name}#${issue.number}` : `#${issue.number}`,
      key: `#${issue.number}`,
      summary: issue.title,
      description: issue.body || '',
      provider: 'github',
      priority,
      assignee: issue.assignee?.login,
      labels: issue.labels.map(label => label.name),
      createdAt: new Date(issue.created_at),
      updatedAt: new Date(issue.updated_at),
      url: issue.html_url,
      status: issue.state === 'open' ? 'Open' : 'Closed'
    };
  }

  private determinePriority(labels: Array<{ name: string; color: string }>): 'low' | 'medium' | 'high' | 'urgent' {
    const labelNames = labels.map(l => l.name.toLowerCase());
    
    if (labelNames.some(name => ['critical', 'urgent', 'p1'].includes(name))) {
      return 'urgent';
    }
    if (labelNames.some(name => ['high', 'important', 'p2'].includes(name))) {
      return 'high';
    }
    if (labelNames.some(name => ['low', 'minor', 'p4'].includes(name))) {
      return 'low';
    }
    return 'medium';
  }

  protected getAuthHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'AI-Plan-VSCode-Extension'
    };
  }

  // Cache management methods
  public clearCache(): void {
    this.cache.clear();
  }

  public getCacheStats() {
    return this.cache.getStats();
  }

  public invalidateCache(pattern?: string | RegExp): number {
    return this.cache.invalidate(pattern);
  }
}