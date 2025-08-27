/**
 * Dotenv loader for VS Code extensions
 * Safely loads .env files in the extension context
 */

import * as path from 'path';
import * as fs from 'fs';

/**
 * Load environment variables from .env file
 * This is a custom implementation since VS Code extensions have different file access patterns
 */
export function loadDotenv(extensionPath: string): void {
  const envPath = path.join(extensionPath, '.env');
  
  try {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envVars = parseDotenvContent(envContent);
      
      // Set environment variables that don't already exist
      for (const [key, value] of Object.entries(envVars)) {
        if (!(key in process.env)) {
          process.env[key] = value;
        }
      }
      
      console.log(`Loaded environment variables from ${envPath}`);
    } else {
      console.log(`No .env file found at ${envPath}`);
    }
  } catch (error) {
    console.warn(`Failed to load .env file: ${error.message}`);
  }
}

/**
 * Parse .env file content
 */
function parseDotenvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  
  const lines = content.split('\n');
  
  for (const line of lines) {
    // Skip empty lines and comments
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    
    // Parse key=value pairs
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) {
      continue;
    }
    
    const key = trimmed.substring(0, equalIndex).trim();
    let value = trimmed.substring(equalIndex + 1).trim();
    
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    result[key] = value;
  }
  
  return result;
}