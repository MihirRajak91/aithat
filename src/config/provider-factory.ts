/**
 * Provider factory that creates providers using environment configuration
 * This helps avoid hardcoded secrets in the codebase
 */

import { JiraProvider } from '../providers/jira';
import { LinearProvider } from '../providers/linear';
import { SlackProvider } from '../providers/slack';
import { GitHubProvider } from '../providers/github';
import { getProviderConfig, isProviderConfigured } from './environment';
import { ErrorFactory } from '../utils/errorTypes';

/**
 * Create a Jira provider using environment configuration
 */
export function createJiraProvider(): JiraProvider {
  if (!isProviderConfigured('jira')) {
    throw ErrorFactory.invalidConfig('ProviderFactory', 'Jira configuration missing in environment');
  }
  
  const config = getProviderConfig('jira');
  return new JiraProvider({
    baseUrl: config.baseUrl!,
    token: config.token!
  });
}

/**
 * Create a Linear provider using environment configuration
 */
export function createLinearProvider(): LinearProvider {
  if (!isProviderConfigured('linear')) {
    throw ErrorFactory.invalidConfig('ProviderFactory', 'Linear configuration missing in environment');
  }
  
  const config = getProviderConfig('linear');
  return new LinearProvider({
    token: config.apiToken!
  });
}

/**
 * Create a Slack provider using environment configuration
 */
export function createSlackProvider(): SlackProvider {
  if (!isProviderConfigured('slack')) {
    throw ErrorFactory.invalidConfig('ProviderFactory', 'Slack configuration missing in environment');
  }
  
  const config = getProviderConfig('slack');
  return new SlackProvider({
    token: config.botToken!
  });
}

/**
 * Create a GitHub provider using environment configuration
 */
export function createGitHubProvider(): GitHubProvider {
  if (!isProviderConfigured('github')) {
    throw ErrorFactory.invalidConfig('ProviderFactory', 'GitHub configuration missing in environment');
  }
  
  const config = getProviderConfig('github');
  return new GitHubProvider({
    token: config.token!
  });
}

/**
 * Get available providers based on environment configuration
 */
export function getAvailableProviders(): string[] {
  const providers: string[] = [];
  
  if (isProviderConfigured('jira')) {
    providers.push('jira');
  }
  
  if (isProviderConfigured('linear')) {
    providers.push('linear');
  }
  
  if (isProviderConfigured('slack')) {
    providers.push('slack');
  }
  
  if (isProviderConfigured('github')) {
    providers.push('github');
  }
  
  return providers;
}

/**
 * Create provider by name using environment configuration
 */
export function createProvider(providerName: string) {
  switch (providerName.toLowerCase()) {
  case 'jira':
    return createJiraProvider();
  case 'linear':
    return createLinearProvider();
  case 'slack':
    return createSlackProvider();
  case 'github':
    return createGitHubProvider();
  default:
    throw ErrorFactory.invalidConfig('ProviderFactory', `Unknown provider: ${providerName}`);
  }
}