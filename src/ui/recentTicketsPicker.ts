import * as vscode from 'vscode';
import { getExtensionContext } from '../context';
import { RecentTicket } from '../types';
import { JiraProvider } from '../providers/jira';
import { BaseProvider } from '../providers/base';

export class RecentTicketsPicker {
  private providers: BaseProvider[] = [];

  constructor() {
    // Initialize providers (we'll start with Jira)
    this.initializeProviders();
  }

  private async initializeProviders(): Promise<void> {
    // For now, we'll hardcode Jira provider
    // In the future, this will be configurable
    const jiraConfig = await this.getJiraConfig();
    if (jiraConfig) {
      this.providers.push(new JiraProvider(jiraConfig));
    }
  }

  private async getJiraConfig(): Promise<{ baseUrl: string; token: string } | null> {
    const context = getExtensionContext();
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

  async showRecentTickets(): Promise<RecentTicket | null> {
    try {
      let limit = 10;
      while (true) {
        const allTickets: RecentTicket[] = [];
        for (const provider of this.providers) {
          try {
            // Prefer tickets related to the current user first, then fall back to recent
            const assigned = (provider as any).getMyWork ? await (provider as any).getMyWork(limit) : [];
            const recent = await provider.getRecentTickets(limit);
            const merged = [...assigned, ...recent];
            const dedup = new Map<string, RecentTicket>();
            for (const t of merged) dedup.set(t.id, t);
            allTickets.push(...dedup.values());
          } catch (error) {
            console.error(`Error fetching tickets from ${provider.getProviderName()}:`, error);
          }
        }

        allTickets.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

        type Item = vscode.QuickPickItem & { ticket?: RecentTicket; command?: 'search' | 'searchText' | 'browseBoards' | 'loadMore' | 'openSettings' };

        const actionItems: Item[] = [
          { label: '$(search) Search by key or ID...', description: 'Find an issue by exact key/ID', command: 'search' },
          { label: '$(filter) Search by text...', description: 'Search issues by summary/description text', command: 'searchText' },
          { label: '$(symbol-color) Browse boards assigned to me...', description: 'Select a board and list issues assigned to you', command: 'browseBoards' },
          { label: '$(list-unordered) Load more', description: `Increase list size (currently ${limit})`, command: 'loadMore' },
          { label: '$(gear) Open Settings', description: 'Configure Jira base URL and token', command: 'openSettings' }
        ];

        const ticketItems: Item[] = allTickets.map(ticket => ({
          label: `${ticket.key} - ${ticket.summary}`,
          description: `${ticket.provider} • ${this.formatTimeAgo(ticket.updatedAt)} • ${ticket.priority} Priority`,
          detail: ticket.description.substring(0, 100) + (ticket.description.length > 100 ? '...' : ''),
          ticket
        }));

        const selected = await vscode.window.showQuickPick<Item>([...actionItems, ...ticketItems], {
          placeHolder: allTickets.length === 0
            ? 'No recent tickets found. Search by key/ID, load more, or open settings...'
            : 'Select a ticket, search by key/ID, or load more...',
          matchOnDescription: true,
          matchOnDetail: true
        });

        if (!selected) {
          return null;
        }

        if (selected.command === 'loadMore') {
          limit = Math.min(limit + 20, 100);
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
            } catch (error) {
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
          const results: RecentTicket[] = [];
          for (const provider of this.providers) {
            try {
              const method = (provider as any).searchByText;
              if (typeof method === 'function') {
                const found = await method.call(provider, q, 20);
                results.push(...found);
              }
            } catch {
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
          })) as Item[];
          const picked = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a ticket from search results...',
            matchOnDescription: true,
            matchOnDetail: true
          });
          if (picked?.ticket) return picked.ticket;
          continue;
        }

        // Optional: Browse boards assigned to you
        if ((selected as any).command === 'browseBoards') {
          for (const provider of this.providers) {
            const getBoards = (provider as any).getBoards;
            const getBoardIssuesAssignedToMe = (provider as any).getBoardIssuesAssignedToMe;
            if (typeof getBoards === 'function' && typeof getBoardIssuesAssignedToMe === 'function') {
              const boards = await getBoards.call(provider, 50);
              if (!boards || boards.length === 0) {
                await vscode.window.showWarningMessage('No boards found.');
                continue;
              }
              type BoardItem = vscode.QuickPickItem & { boardId: number };
              const boardPick = await vscode.window.showQuickPick<BoardItem>(
                boards.map((b: any) => ({ label: `${b.name}`, description: b.type ? `${b.type}` : undefined, boardId: b.id })),
                { placeHolder: 'Select a board...' }
              );
              if (!boardPick) continue;
              const issues = await getBoardIssuesAssignedToMe.call(provider, boardPick.boardId, 50);
              if (!issues || issues.length === 0) {
                await vscode.window.showWarningMessage('No issues assigned to you on this board.');
                continue;
              }
              const items = issues.map((r: RecentTicket) => ({
                label: `${r.key} - ${r.summary}`,
                description: `${r.provider} • ${this.formatTimeAgo(r.updatedAt)} • ${r.priority} Priority`,
                detail: r.description.substring(0, 100) + (r.description.length > 100 ? '...' : ''),
                ticket: r
              })) as Item[];
              const picked = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a ticket from the board...',
                matchOnDescription: true,
                matchOnDetail: true
              });
              if (picked?.ticket) return picked.ticket;
            }
          }
          continue;
        }

        if (selected.ticket) {
          return selected.ticket;
        }
      }

    } catch (error) {
      console.error('Error showing recent tickets:', error);
      await vscode.window.showErrorMessage('Failed to fetch recent tickets. Please check your configuration.');
      return null;
    }
  }

  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      return `${diffInDays}d ago`;
    }
  }

  async showTicketDetails(ticket: RecentTicket): Promise<void> {
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
}
