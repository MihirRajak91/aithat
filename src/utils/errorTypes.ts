/**
 * Standardized error types for the AI Plan extension
 */

export enum ErrorCode {
  // Configuration errors
  INVALID_CONFIG = 'INVALID_CONFIG',
  MISSING_CREDENTIALS = 'MISSING_CREDENTIALS',
  
  // Network errors
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  
  // Authentication errors
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  
  // Provider errors
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  
  // AI/LLM errors
  AI_REQUEST_FAILED = 'AI_REQUEST_FAILED',
  CONTEXT_TOO_LARGE = 'CONTEXT_TOO_LARGE',
  
  // Workspace errors
  WORKSPACE_READ_ERROR = 'WORKSPACE_READ_ERROR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  
  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  operation: string;
  component: string;
  metadata?: Record<string, any>;
}

export class ExtensionError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly timestamp: Date;
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    context: ErrorContext,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'ExtensionError';
    this.code = code;
    this.severity = severity;
    this.context = context;
    this.timestamp = new Date();
    this.isRetryable = isRetryable;
  }

  toJson(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      isRetryable: this.isRetryable,
      stack: this.stack
    };
  }
}

export class ProviderError extends ExtensionError {
  public readonly provider: string;

  constructor(
    message: string,
    provider: string,
    code: ErrorCode = ErrorCode.PROVIDER_UNAVAILABLE,
    context: ErrorContext,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    isRetryable: boolean = true
  ) {
    super(message, code, context, severity, isRetryable);
    this.name = 'ProviderError';
    this.provider = provider;
  }
}

export class ValidationError extends ExtensionError {
  public readonly field: string;
  public readonly value: any;

  constructor(
    message: string,
    field: string,
    value: any,
    context: ErrorContext
  ) {
    super(message, ErrorCode.VALIDATION_ERROR, context, ErrorSeverity.LOW, false);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Error factory functions for common error scenarios
 */
export const ErrorFactory = {
  invalidConfig: (component: string, details?: string): ExtensionError => 
    new ExtensionError(
      `Invalid configuration${details ? `: ${  details}` : ''}`,
      ErrorCode.INVALID_CONFIG,
      { operation: 'configuration', component },
      ErrorSeverity.HIGH
    ),

  connectionFailed: (component: string, provider?: string): ProviderError =>
    new ProviderError(
      'Failed to connect to service',
      provider || 'unknown',
      ErrorCode.CONNECTION_FAILED,
      { operation: 'connection', component },
      ErrorSeverity.MEDIUM,
      true
    ),

  authenticationFailed: (component: string, provider?: string): ProviderError =>
    new ProviderError(
      'Authentication failed - please check your credentials',
      provider || 'unknown',
      ErrorCode.AUTHENTICATION_FAILED,
      { operation: 'authentication', component },
      ErrorSeverity.HIGH,
      false
    ),

  rateLimited: (component: string, provider?: string, retryAfter?: number): ProviderError => {
    const error = new ProviderError(
      'Rate limit exceeded - please try again later',
      provider || 'unknown',
      ErrorCode.RATE_LIMITED,
      { operation: 'api_request', component, metadata: { retryAfter } },
      ErrorSeverity.MEDIUM,
      true
    );
    return error;
  },

  validationFailed: (component: string, field: string, value: any, reason?: string): ValidationError =>
    new ValidationError(
      `Validation failed for ${field}${reason ? `: ${  reason}` : ''}`,
      field,
      value,
      { operation: 'validation', component }
    ),

  workspaceError: (component: string, operation: string, details?: string): ExtensionError =>
    new ExtensionError(
      `Workspace ${operation} failed${details ? `: ${  details}` : ''}`,
      ErrorCode.WORKSPACE_READ_ERROR,
      { operation, component },
      ErrorSeverity.MEDIUM,
      true
    )
};