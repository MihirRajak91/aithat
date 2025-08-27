/**
 * Environment configuration management
 * Handles loading and validation of environment variables
 */

interface EnvironmentConfig {
  // Jira
  jira: {
    baseUrl?: string;
    token?: string;
  };
  
  // Linear
  linear: {
    apiToken?: string;
  };
  
  // Slack
  slack: {
    botToken?: string;
  };
  
  // GitHub
  github: {
    token?: string;
  };
  
  // Ollama
  ollama: {
    baseUrl: string;
    model: string;
  };
  
  // OpenRouter
  openRouter: {
    apiKey?: string;
    model?: string;
  };
  
  // Development
  nodeEnv: string;
  logLevel: string;
}

/**
 * Load environment variables with defaults
 */
export function loadEnvironmentConfig(): EnvironmentConfig {
  // In VS Code extensions, we need to handle environment variables carefully
  // since they run in a different context than typical Node.js apps
  const env = process.env;
  
  return {
    jira: {
      baseUrl: env.JIRA_BASE_URL,
      token: env.JIRA_TOKEN
    },
    linear: {
      apiToken: env.LINEAR_API_TOKEN
    },
    slack: {
      botToken: env.SLACK_BOT_TOKEN
    },
    github: {
      token: env.GITHUB_TOKEN
    },
    ollama: {
      baseUrl: env.OLLAMA_BASE_URL || 'http://localhost:11434',
      model: env.OLLAMA_MODEL || 'llama2:13b'
    },
    openRouter: {
      apiKey: env.OPENROUTER_API_KEY,
      model: env.OPENROUTER_MODEL || 'anthropic/claude-3-sonnet-20240229'
    },
    nodeEnv: env.NODE_ENV || 'development',
    logLevel: env.LOG_LEVEL || 'info'
  };
}

/**
 * Get configuration for a specific provider
 */
export function getProviderConfig(provider: 'jira' | 'linear' | 'slack' | 'github' | 'ollama' | 'openRouter') {
  const config = loadEnvironmentConfig();
  return config[provider];
}

/**
 * Check if environment variables are properly configured for a provider
 */
export function isProviderConfigured(provider: 'jira' | 'linear' | 'slack' | 'github'): boolean {
  const config = loadEnvironmentConfig();
  
  switch (provider) {
  case 'jira':
    return !!(config.jira.baseUrl && config.jira.token);
  case 'linear':
    return !!config.linear.apiToken;
  case 'slack':
    return !!config.slack.botToken;
  case 'github':
    return !!config.github.token;
  default:
    return false;
  }
}

/**
 * Get masked configuration for logging (hide sensitive values)
 */
export function getMaskedConfig(): Record<string, any> {
  const config = loadEnvironmentConfig();
  
  return {
    jira: {
      baseUrl: config.jira.baseUrl,
      token: config.jira.token ? '***MASKED***' : undefined
    },
    linear: {
      apiToken: config.linear.apiToken ? '***MASKED***' : undefined
    },
    slack: {
      botToken: config.slack.botToken ? '***MASKED***' : undefined
    },
    github: {
      token: config.github.token ? '***MASKED***' : undefined
    },
    ollama: config.ollama,
    openRouter: {
      apiKey: config.openRouter.apiKey ? '***MASKED***' : undefined,
      model: config.openRouter.model
    },
    nodeEnv: config.nodeEnv,
    logLevel: config.logLevel
  };
}