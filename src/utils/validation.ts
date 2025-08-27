/**
 * Input validation utilities for the AI Plan extension
 */

import { ValidationError, ErrorFactory } from './errorTypes';

export interface ValidationRule<T = any> {
  test: (value: T) => boolean;
  message: string;
}

export interface ValidationSchema<T = any> {
  [key: string]: ValidationRule<T>[];
}

export class Validator {
  /**
   * Validate a single value against rules
   */
  static validateField<T>(
    value: T,
    fieldName: string,
    rules: ValidationRule<T>[],
    component: string = 'unknown'
  ): void {
    for (const rule of rules) {
      if (!rule.test(value)) {
        throw ErrorFactory.validationFailed(component, fieldName, value, rule.message);
      }
    }
  }

  /**
   * Validate an object against a schema
   */
  static validateObject<T extends Record<string, any>>(
    obj: T,
    schema: ValidationSchema,
    component: string = 'unknown'
  ): void {
    for (const [fieldName, rules] of Object.entries(schema)) {
      const value = obj[fieldName];
      this.validateField(value, fieldName, rules, component);
    }
  }

  /**
   * Validate and sanitize input, returning cleaned value
   */
  static sanitizeAndValidate<T>(
    value: T,
    fieldName: string,
    rules: ValidationRule<T>[],
    sanitizer?: (value: T) => T,
    component: string = 'unknown'
  ): T {
    // Sanitize first if sanitizer provided
    const cleanValue = sanitizer ? sanitizer(value) : value;
    
    // Then validate
    this.validateField(cleanValue, fieldName, rules, component);
    
    return cleanValue;
  }
}

// Common validation rules
export const ValidationRules = {
  required: <T>(message: string = 'Field is required'): ValidationRule<T> => ({
    test: (value: T) => value !== null && value !== undefined && value !== '',
    message
  }),

  minLength: (min: number, message?: string): ValidationRule<string> => ({
    test: (value: string) => value && value.length >= min,
    message: message || `Must be at least ${min} characters long`
  }),

  maxLength: (max: number, message?: string): ValidationRule<string> => ({
    test: (value: string) => !value || value.length <= max,
    message: message || `Must be no more than ${max} characters long`
  }),

  pattern: (regex: RegExp, message: string = 'Invalid format'): ValidationRule<string> => ({
    test: (value: string) => !value || regex.test(value),
    message
  }),

  url: (message: string = 'Must be a valid URL'): ValidationRule<string> => ({
    test: (value: string) => {
      if (!value) {return true;}
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message
  }),

  email: (message: string = 'Must be a valid email address'): ValidationRule<string> => ({
    test: (value: string) => {
      if (!value) {return true;}
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value);
    },
    message
  }),

  token: (prefix?: string, message?: string): ValidationRule<string> => ({
    test: (value: string) => {
      if (!value) {return false;}
      if (prefix) {
        return value.startsWith(prefix);
      }
      return value.length >= 10; // Basic token length check
    },
    message: message || (prefix ? `Token must start with ${prefix}` : 'Invalid token format')
  }),

  oneOf: <T>(allowedValues: T[], message?: string): ValidationRule<T> => ({
    test: (value: T) => allowedValues.includes(value),
    message: message || `Must be one of: ${allowedValues.join(', ')}`
  }),

  numeric: (message: string = 'Must be a number'): ValidationRule<string | number> => ({
    test: (value: string | number) => {
      if (typeof value === 'number') {return !isNaN(value);}
      return !isNaN(Number(value));
    },
    message
  }),

  range: (min: number, max: number, message?: string): ValidationRule<number> => ({
    test: (value: number) => value >= min && value <= max,
    message: message || `Must be between ${min} and ${max}`
  })
};

// Common sanitizers
export const Sanitizers = {
  trim: (value: string): string => value ? value.trim() : value,
  
  toLowerCase: (value: string): string => value ? value.toLowerCase() : value,
  
  removeExtraSpaces: (value: string): string => 
    value ? value.replace(/\s+/g, ' ').trim() : value,
  
  normalizeUrl: (value: string): string => {
    if (!value) {return value;}
    let url = value.trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${  url}`;
    }
    return url;
  },
  
  alphanumericOnly: (value: string): string => 
    value ? value.replace(/[^a-zA-Z0-9]/g, '') : value,
  
  removeNewlines: (value: string): string => 
    value ? value.replace(/[\r\n]/g, ' ').trim() : value
};

// Pre-defined validation schemas for common configurations
export const ConfigSchemas = {
  jira: {
    baseUrl: [
      ValidationRules.required('Jira base URL is required'),
      ValidationRules.url('Must be a valid Jira URL')
    ],
    token: [
      ValidationRules.required('Jira token is required'),
      ValidationRules.minLength(10, 'Token appears to be too short')
    ]
  },

  linear: {
    token: [
      ValidationRules.required('Linear API token is required'),
      ValidationRules.token('lin_', 'Linear token must start with "lin_"')
    ]
  },

  slack: {
    token: [
      ValidationRules.required('Slack bot token is required'),
      ValidationRules.token('xoxb-', 'Slack bot token must start with "xoxb-"'),
      ValidationRules.minLength(50, 'Slack token appears to be too short')
    ]
  },

  ollama: {
    model: [
      ValidationRules.required('Ollama model name is required'),
      ValidationRules.minLength(1, 'Model name cannot be empty')
    ],
    baseUrl: [
      ValidationRules.url('Must be a valid Ollama server URL')
    ]
  }
};

/**
 * Configuration validator helper
 */
export class ConfigValidator {
  static validateJiraConfig(config: any, component: string = 'JiraProvider'): void {
    Validator.validateObject(config, ConfigSchemas.jira, component);
    
    // Additional Jira-specific validation
    if (config.baseUrl) {
      const url = Sanitizers.normalizeUrl(config.baseUrl);
      if (!url.includes('atlassian.net') && !url.includes('jira')) {
        console.warn('URL does not appear to be a Jira instance');
      }
    }
  }

  static validateLinearConfig(config: any, component: string = 'LinearProvider'): void {
    Validator.validateObject(config, ConfigSchemas.linear, component);
  }

  static validateSlackConfig(config: any, component: string = 'SlackProvider'): void {
    Validator.validateObject(config, ConfigSchemas.slack, component);
  }

  static validateOllamaConfig(config: any, component: string = 'OllamaProvider'): void {
    Validator.validateObject(config, ConfigSchemas.ollama, component);
  }

  /**
   * Sanitize configuration before validation
   */
  static sanitizeConfig<T extends Record<string, any>>(config: T): T {
    const sanitized = { ...config };
    
    // Sanitize string fields
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'string') {
        switch (key) {
        case 'baseUrl':
        case 'url':
          sanitized[key] = Sanitizers.normalizeUrl(value);
          break;
        case 'token':
        case 'apiKey':
          sanitized[key] = Sanitizers.trim(value);
          break;
        case 'model':
        case 'name':
          sanitized[key] = Sanitizers.removeExtraSpaces(value);
          break;
        default:
          sanitized[key] = Sanitizers.trim(value);
        }
      }
    }
    
    return sanitized;
  }
}