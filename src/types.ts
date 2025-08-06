export interface RecentTicket {
  id: string;
  key: string;
  summary: string;
  description: string;
  provider: 'jira' | 'linear' | 'github' | 'slack';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee?: string;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
  url: string;
  status: string;
}

export interface LLMResponse {
  content: string;
  isStreaming: boolean;
}

export interface ProviderConfig {
  type: 'jira' | 'linear' | 'github' | 'slack';
  baseUrl?: string;
  token?: string;
}

export interface PlanGenerationOptions {
  includeCodeExamples: boolean;
  includeFileStructure: boolean;
  includeTestingStrategy: boolean;
  includeDeploymentSteps: boolean;
}

export interface WorkspaceContext {
  files: string[];
  structure: string;
  totalSize: number;
  ignoredFiles: string[];
}
