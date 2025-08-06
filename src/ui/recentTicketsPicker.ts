import * as vscode from 'vscode';
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
    const context = vscode.extensions.getExtension('ai-plan')?.exports?.context;
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
      // Show loading message
      await vscode.window.showInformationMessage('Fetching recent tickets...');

      // Fetch tickets from all providers
      const allTickets: RecentTicket[] = [];
      
      for (const provider of this.providers) {
        try {
          const tickets = await provider.getRecentTickets(10);
          allTickets.push(...tickets);
        } catch (error) {
          console.error(`Error fetching tickets from ${provider.getProviderName()}:`, error);
        }
      }

      if (allTickets.length === 0) {
        await vscode.window.showWarningMessage('No recent tickets found. Please configure your ticketing providers.');
        return null;
      }

      // Sort by most recent
      allTickets.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      // Create quick pick items
      const items = allTickets.map(ticket => ({
        label: `${ticket.key} - ${ticket.summary}`,
        description: `${ticket.provider} • ${this.formatTimeAgo(ticket.updatedAt)} • ${ticket.priority} Priority`,
        detail: ticket.description.substring(0, 100) + (ticket.description.length > 100 ? '...' : ''),
        ticket: ticket
      }));

      // Show quick pick
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a recent ticket to generate plan for...',
        matchOnDescription: true,
        matchOnDetail: true
      });

      return selected?.ticket || null;

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
