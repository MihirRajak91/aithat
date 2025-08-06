# AI Plan VS Code Extension - Python Developer's Guide

*This guide explains the entire AI Plan project in Python-friendly terms, helping Python developers understand TypeScript, VS Code extensions, and the project architecture.*

---

## 🎯 Project Overview

**What is this?** A VS Code extension that generates implementation plans from your recent tickets using AI.

**Think of it like:** A Python script that reads your Jira tickets, analyzes your codebase, and uses AI to create a step-by-step implementation plan.

**The difference:** Instead of a standalone Python script, this is a VS Code extension written in TypeScript that integrates directly into your development environment.

---

## 🏗️ Architecture Overview

### Python Analogy
```python
# If this were Python, the structure would be:
class TicketProvider:
    def get_recent_tickets(self) -> List[Ticket]:
        pass

class AIGenerator:
    def generate_plan(self, ticket: Ticket, context: str) -> str:
        pass

class WorkspaceAnalyzer:
    def build_context(self) -> str:
        pass

# Main workflow
def main():
    provider = TicketProvider()
    analyzer = WorkspaceAnalyzer()
    ai = AIGenerator()
    
    tickets = provider.get_recent_tickets()
    ticket = user_select(tickets)
    context = analyzer.build_context()
    plan = ai.generate_plan(ticket, context)
    display_plan(plan)
```

### TypeScript Reality
```typescript
// This is what we actually built:
interface RecentTicket {
  id: string;
  key: string;
  summary: string;
  // ... more fields
}

class JiraProvider extends BaseProvider {
  async getRecentTickets(): Promise<RecentTicket[]> {
    // Fetch from Jira API
  }
}

class OllamaProvider extends BaseLLM {
  async generatePlan(prompt: string): Promise<LLMResponse> {
    // Call local AI model
  }
}
```

---

## 📁 Project Structure Explained

### File Organization (Python vs TypeScript)

| Python Concept | TypeScript Reality | Purpose |
|----------------|-------------------|---------|
| `main.py` | `src/extension.ts` | Entry point, registers commands |
| `models.py` | `src/types.ts` | Data structures and interfaces |
| `providers/` | `src/providers/` | API integrations (Jira, GitHub, etc.) |
| `ai/` | `src/llm/` | AI model integrations |
| `ui/` | `src/ui/` | User interface components |
| `utils/` | `src/contextBuilder.ts` | Helper functions |

### Key Files Explained

#### 1. `package.json` (Like `requirements.txt` + `setup.py`)
```json
{
  "name": "ai-plan",
  "version": "0.0.1",
  "dependencies": {
    "axios": "^1.6.0",        // Like requests in Python
    "ignore": "^5.3.0"        // Like pathlib + fnmatch
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0", // TypeScript type definitions
    "typescript": "^5.0.0"       // TypeScript compiler
  }
}
```

#### 2. `tsconfig.json` (Like Python's type hints configuration)
```json
{
  "compilerOptions": {
    "target": "ES2020",        // JavaScript version to target
    "module": "commonjs",      // Module system (like Python imports)
    "strict": true,            // Strict type checking
    "outDir": "out"            // Where compiled JS goes
  }
}
```

---

## 🔧 Core Components Deep Dive

### 1. Type Definitions (`src/types.ts`)

**Python equivalent:**
```python
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional

@dataclass
class RecentTicket:
    id: str
    key: str
    summary: str
    description: str
    provider: str  # 'jira', 'linear', 'github', 'slack'
    priority: str  # 'low', 'medium', 'high', 'urgent'
    assignee: Optional[str]
    labels: List[str]
    created_at: datetime
    updated_at: datetime
    url: str
    status: str
```

**TypeScript reality:**
```typescript
export interface RecentTicket {
  id: string;
  key: string;
  summary: string;
  description: string;
  provider: 'jira' | 'linear' | 'github' | 'slack';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee?: string;  // ? means optional
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
  url: string;
  status: string;
}
```

**Key differences:**
- TypeScript uses `interface` instead of `@dataclass`
- `|` means "union type" (like Python's `Union`)
- `?` means optional (like `Optional[str]`)
- `Date` is built-in (like Python's `datetime`)

### 2. Abstract Base Classes (`src/providers/base.ts`)

**Python equivalent:**
```python
from abc import ABC, abstractmethod
from typing import List
import requests

class BaseProvider(ABC):
    def __init__(self, config: dict):
        self.config = config
    
    @abstractmethod
    def get_recent_tickets(self, limit: int = 10) -> List[RecentTicket]:
        pass
    
    @abstractmethod
    def validate_config(self) -> bool:
        pass
    
    def make_request(self, url: str, **kwargs):
        headers = self.get_auth_headers()
        response = requests.get(url, headers=headers, **kwargs)
        return response.json()
    
    def get_auth_headers(self) -> dict:
        if not self.config.get('token'):
            return {}
        return {
            'Authorization': f'Bearer {self.config["token"]}',
            'Content-Type': 'application/json'
        }
```

**TypeScript reality:**
```typescript
export abstract class BaseProvider {
  protected config: {
    baseUrl?: string;
    token?: string;
  };

  constructor(config: { baseUrl?: string; token?: string }) {
    this.config = config;
  }

  abstract getRecentTickets(limit?: number): Promise<RecentTicket[]>;
  abstract validateConfig(): Promise<boolean>;
  abstract getProviderName(): string;

  protected async makeRequest(url: string, options: any = {}): Promise<any> {
    const { default: axios } = await import('axios');
    
    try {
      const response = await axios({
        url,
        headers: {
          ...this.getAuthHeaders(),
          ...options.headers
        },
        ...options
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error making request to ${url}:`, error);
      throw error;
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (!this.config.token) {
      return {};
    }
    return {
      'Authorization': `Bearer ${this.config.token}`,
      'Content-Type': 'application/json'
    };
  }
}
```

**Key differences:**
- `abstract class` instead of `ABC`
- `async/await` for HTTP requests (like Python's `aiohttp`)
- `Promise<T>` is TypeScript's way of handling async operations
- `Record<string, string>` is like `Dict[str, str]`

### 3. Jira Provider Implementation (`src/providers/jira.ts`)

**Python equivalent:**
```python
import requests
from datetime import datetime

class JiraProvider(BaseProvider):
    def get_provider_name(self) -> str:
        return "jira"
    
    async def validate_config(self) -> bool:
        if not self.config.get('baseUrl') or not self.config.get('token'):
            return False
        
        try:
            response = requests.get(
                f"{self.config['baseUrl']}/rest/api/3/myself",
                headers=self.get_auth_headers()
            )
            return response.status_code == 200
        except:
            return False
    
    async def get_recent_tickets(self, limit: int = 10) -> List[RecentTicket]:
        jql = "ORDER BY updated DESC"
        url = f"{self.config['baseUrl']}/rest/api/3/search"
        
        response = requests.get(url, params={
            'jql': jql,
            'maxResults': limit,
            'fields': 'summary,description,priority,assignee,labels,created,updated,status,key'
        }, headers=self.get_auth_headers())
        
        issues = response.json()['issues']
        return [self.map_to_recent_ticket(issue) for issue in issues]
    
    def map_to_recent_ticket(self, issue: dict) -> RecentTicket:
        priority_map = {
            'Low': 'low',
            'Medium': 'medium',
            'High': 'high',
            'Highest': 'urgent'
        }
        
        return RecentTicket(
            id=issue['id'],
            key=issue['key'],
            summary=issue['fields']['summary'] or '',
            description=issue['fields']['description'] or '',
            provider='jira',
            priority=priority_map.get(issue['fields']['priority']['name'], 'medium'),
            assignee=issue['fields']['assignee']['displayName'] if issue['fields']['assignee'] else None,
            labels=issue['fields']['labels'] or [],
            created_at=datetime.fromisoformat(issue['fields']['created']),
            updated_at=datetime.fromisoformat(issue['fields']['updated']),
            url=f"{self.config['baseUrl']}/browse/{issue['key']}",
            status=issue['fields']['status']['name'] if issue['fields']['status'] else 'Unknown'
        )
```

**TypeScript reality:**
```typescript
export class JiraProvider extends BaseProvider {
  getProviderName(): string {
    return 'jira';
  }

  async validateConfig(): Promise<boolean> {
    if (!this.config.baseUrl || !this.config.token) {
      return false;
    }

    try {
      await this.makeRequest(`${this.config.baseUrl}/rest/api/3/myself`);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getRecentTickets(limit: number = 10): Promise<RecentTicket[]> {
    const jql = 'ORDER BY updated DESC';
    const url = `${this.config.baseUrl}/rest/api/3/search`;
    
    const response = await this.makeRequest(url, {
      method: 'GET',
      params: {
        jql,
        maxResults: limit,
        fields: 'summary,description,priority,assignee,labels,created,updated,status,key'
      }
    });

    return response.issues.map((issue: any) => this.mapToRecentTicket(issue));
  }

  protected mapToRecentTicket(issue: any): RecentTicket {
    const priorityMap: Record<string, 'low' | 'medium' | 'high' | 'urgent'> = {
      'Low': 'low',
      'Medium': 'medium',
      'High': 'high',
      'Highest': 'urgent'
    };

    return {
      id: issue.id,
      key: issue.key,
      summary: issue.fields.summary || '',
      description: issue.fields.description || '',
      provider: 'jira',
      priority: priorityMap[issue.fields.priority?.name] || 'medium',
      assignee: issue.fields.assignee?.displayName,
      labels: issue.fields.labels || [],
      createdAt: new Date(issue.fields.created),
      updatedAt: new Date(issue.fields.updated),
      url: `${this.config.baseUrl}/browse/${issue.key}`,
      status: issue.fields.status?.name || 'Unknown'
    };
  }
}
```

**Key differences:**
- `extends` instead of inheritance syntax
- `async/await` for all HTTP operations
- `?.` is optional chaining (like `getattr(obj, 'attr', None)`)
- `||` is nullish coalescing (like `value or default`)

### 4. AI Integration (`src/llm/ollama.ts`)

**Python equivalent:**
```python
import requests
import json

class OllamaProvider:
    def __init__(self, config: dict):
        self.config = config
    
    async def validate_config(self) -> bool:
        try:
            response = requests.get('http://localhost:11434/api/tags')
            return response.status_code == 200
        except:
            return False
    
    async def generate_plan(self, prompt: str) -> dict:
        model = self.config.get('model', 'llama2:13b')
        
        try:
            response = requests.post('http://localhost:11434/api/generate', json={
                'model': model,
                'prompt': prompt,
                'stream': False,
                'options': {
                    'temperature': 0.7,
                    'top_p': 0.9,
                    'max_tokens': 2000
                }
            })
            
            return {
                'content': response.json()['response'],
                'isStreaming': False
            }
        except Exception as e:
            raise Exception(f"Failed to generate plan with Ollama: {str(e)}")
```

**TypeScript reality:**
```typescript
export class OllamaProvider extends BaseLLM {
  getProviderName(): string {
    return 'ollama';
  }

  async validateConfig(): Promise<boolean> {
    try {
      const { default: axios } = await import('axios');
      await axios.get('http://localhost:11434/api/tags');
      return true;
    } catch (error) {
      return false;
    }
  }

  async generatePlan(prompt: string): Promise<LLMResponse> {
    const model = this.config.model || 'llama2:13b';
    
    try {
      const { default: axios } = await import('axios');
      
      const response = await axios.post('http://localhost:11434/api/generate', {
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 2000
        }
      });

      return {
        content: response.data.response,
        isStreaming: false
      };
    } catch (error) {
      console.error('Error generating plan with Ollama:', error);
      throw new Error('Failed to generate plan with Ollama. Make sure Ollama is running and the model is available.');
    }
  }
}
```

### 5. Workspace Context Builder (`src/contextBuilder.ts`)

**Python equivalent:**
```python
import os
import pathlib
from typing import List

class ContextBuilder:
    MAX_CONTEXT_SIZE = 50 * 1024  # 50KB
    RELEVANT_EXTENSIONS = ['.py', '.js', '.ts', '.java', '.cpp', '.go', '.rs']
    
    def build_context(self) -> str:
        workspace_folder = self.get_workspace_folder()
        if not workspace_folder:
            raise Exception("No workspace folder found")
        
        ignore_patterns = self.read_gitignore(workspace_folder)
        files = self.walk_workspace(workspace_folder, ignore_patterns)
        context = self.build_context_from_files(files, workspace_folder)
        
        return context
    
    def read_gitignore(self, workspace_path: str) -> List[str]:
        gitignore_path = os.path.join(workspace_path, '.gitignore')
        
        if not os.path.exists(gitignore_path):
            return []
        
        try:
            with open(gitignore_path, 'r') as f:
                content = f.read()
            return [line.strip() for line in content.split('\n') 
                   if line.strip() and not line.startswith('#')]
        except Exception as e:
            print(f"Error reading .gitignore: {e}")
            return []
    
    def walk_workspace(self, workspace_path: str, ignore_patterns: List[str]) -> List[str]:
        files = []
        
        for root, dirs, filenames in os.walk(workspace_path):
            for filename in filenames:
                full_path = os.path.join(root, filename)
                relative_path = os.path.relpath(full_path, workspace_path)
                
                if self.should_ignore(relative_path, ignore_patterns):
                    continue
                
                ext = os.path.splitext(filename)[1].lower()
                if ext in self.RELEVANT_EXTENSIONS:
                    files.append(full_path)
        
        return files
```

**TypeScript reality:**
```typescript
export class ContextBuilder {
  private readonly MAX_CONTEXT_SIZE = 50 * 1024; // 50KB
  private readonly RELEVANT_EXTENSIONS = [
    '.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.cs',
    '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.scala', '.dart',
    '.vue', '.svelte', '.html', '.css', '.scss', '.less', '.json',
    '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
    '.md', '.txt', '.sql', '.sh', '.bash', '.zsh', '.fish'
  ];

  async buildContext(): Promise<string> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder found');
    }

    const workspacePath = workspaceFolder.uri.fsPath;
    const ignorePatterns = await this.readGitignore(workspacePath);
    const files = await this.walkWorkspace(workspacePath, ignorePatterns);
    
    const context = await this.buildContextFromFiles(files, workspacePath);
    
    return context;
  }

  private async readGitignore(workspacePath: string): Promise<string[]> {
    const gitignorePath = path.join(workspacePath, '.gitignore');
    
    if (!fs.existsSync(gitignorePath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      return content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    } catch (error) {
      console.error('Error reading .gitignore:', error);
      return [];
    }
  }

  private async walkWorkspace(workspacePath: string, ignorePatterns: string[]): Promise<string[]> {
    const files: string[] = [];
    
    const walkDir = (dir: string): void => {
      try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const relativePath = path.relative(workspacePath, fullPath);
          
          if (this.shouldIgnore(relativePath, ignorePatterns)) {
            continue;
          }
          
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            walkDir(fullPath);
          } else if (stat.isFile()) {
            const ext = path.extname(item).toLowerCase();
            if (this.RELEVANT_EXTENSIONS.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.error(`Error walking directory ${dir}:`, error);
      }
    };
    
    walkDir(workspacePath);
    return files;
  }
}
```

### 6. Main Extension Entry Point (`src/extension.ts`)

**Python equivalent:**
```python
# This would be like a Flask app or FastAPI application
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/generate-plan', methods=['POST'])
def generate_plan():
    try:
        # Get ticket from request
        ticket_data = request.json
        
        # Initialize components
        picker = RecentTicketsPicker()
        generator = PlanGenerator()
        
        # Generate plan
        plan = generator.generate_plan(ticket_data)
        
        return jsonify({'plan': plan})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run()
```

**TypeScript reality:**
```typescript
import * as vscode from 'vscode';
import { RecentTicketsPicker } from './ui/recentTicketsPicker';
import { PlanGenerator } from './ui/planGenerator';

export function activate(context: vscode.ExtensionContext) {
  console.log('AI Plan extension is now active!');

  // Register the main command
  const disposable = vscode.commands.registerCommand('ai-plan.generateFromRecent', async () => {
    try {
      const picker = new RecentTicketsPicker();
      const ticket = await picker.showRecentTickets();
      
      if (ticket) {
        const generator = new PlanGenerator();
        await generator.generatePlan(ticket);
      }
    } catch (error) {
      console.error('Error in generateFromRecent command:', error);
      await vscode.window.showErrorMessage('Failed to generate plan. Please check your configuration.');
    }
  });

  context.subscriptions.push(disposable);

  // Register configuration command
  const configDisposable = vscode.commands.registerCommand('ai-plan.configure', async () => {
    await configureExtension(context);
  });

  context.subscriptions.push(configDisposable);

  // Check if configuration is needed
  checkConfiguration(context);
}
```

---

## 🔄 Development Workflow

### Python vs TypeScript Development

| Python Development | TypeScript Development |
|-------------------|----------------------|
| `python script.py` | `npm run compile` then run |
| `pip install package` | `npm install package` |
| `requirements.txt` | `package.json` |
| `venv` | `node_modules` |
| `pytest` | `npm test` |
| `black` formatting | `prettier` formatting |

### Building and Running

**Python equivalent:**
```bash
# Install dependencies
pip install -r requirements.txt

# Run tests
pytest

# Run the application
python main.py
```

**TypeScript reality:**
```bash
# Install dependencies
npm install

# Compile TypeScript to JavaScript
npm run compile

# Run tests
npm test

# Run in development mode
# Press F5 in VS Code
```

---

## 🎯 Key TypeScript Concepts for Python Developers

### 1. Types and Interfaces

**Python:**
```python
from typing import List, Optional, Dict

def process_user(user: Dict[str, any]) -> str:
    name: str = user.get('name', 'Unknown')
    age: Optional[int] = user.get('age')
    return f"User: {name}, Age: {age}"
```

**TypeScript:**
```typescript
interface User {
  name: string;
  age?: number;  // Optional
}

function processUser(user: User): string {
  const name: string = user.name || 'Unknown';
  const age: number | undefined = user.age;
  return `User: ${name}, Age: ${age}`;
}
```

### 2. Async/Await

**Python:**
```python
import asyncio
import aiohttp

async def fetch_data(url: str) -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()

async def main():
    data = await fetch_data('https://api.example.com/data')
    print(data)
```

**TypeScript:**
```typescript
async function fetchData(url: string): Promise<any> {
  const response = await fetch(url);
  return await response.json();
}

async function main() {
  const data = await fetchData('https://api.example.com/data');
  console.log(data);
}
```

### 3. Classes and Inheritance

**Python:**
```python
class Animal:
    def __init__(self, name: str):
        self.name = name
    
    def speak(self) -> str:
        return "Some sound"

class Dog(Animal):
    def speak(self) -> str:
        return f"{self.name} says woof!"
```

**TypeScript:**
```typescript
class Animal {
  constructor(protected name: string) {}
  
  speak(): string {
    return "Some sound";
  }
}

class Dog extends Animal {
  speak(): string {
    return `${this.name} says woof!`;
  }
}
```

### 4. Error Handling

**Python:**
```python
try:
    result = risky_operation()
except ValueError as e:
    print(f"Value error: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")
finally:
    cleanup()
```

**TypeScript:**
```typescript
try {
  const result = riskyOperation();
} catch (error) {
  if (error instanceof ValueError) {
    console.error(`Value error: ${error.message}`);
  } else {
    console.error(`Unexpected error: ${error.message}`);
  }
} finally {
  cleanup();
}
```

---

## 🚀 How to Extend the Project

### Adding a New Provider (e.g., Linear)

**Python equivalent:**
```python
class LinearProvider(BaseProvider):
    def get_provider_name(self) -> str:
        return "linear"
    
    async def get_recent_tickets(self, limit: int = 10) -> List[RecentTicket]:
        # GraphQL query for Linear
        query = """
        query {
          issues(first: $limit, orderBy: {field: UPDATED_AT, direction: DESC}) {
            nodes {
              id
              title
              description
              priority
              assignee { name }
              labels { nodes { name } }
              createdAt
              updatedAt
              url
              state { name }
            }
          }
        }
        """
        
        response = await self.make_graphql_request(query, {'limit': limit})
        return [self.map_to_recent_ticket(issue) for issue in response['data']['issues']['nodes']]
```

**TypeScript implementation:**
```typescript
export class LinearProvider extends BaseProvider {
  getProviderName(): string {
    return 'linear';
  }

  async getRecentTickets(limit: number = 10): Promise<RecentTicket[]> {
    const query = `
      query GetRecentIssues($limit: Int!) {
        issues(first: $limit, orderBy: {field: UPDATED_AT, direction: DESC}) {
          nodes {
            id
            title
            description
            priority
            assignee { name }
            labels { nodes { name } }
            createdAt
            updatedAt
            url
            state { name }
          }
        }
      }
    `;

    const response = await this.makeGraphQLRequest(query, { limit });
    return response.data.issues.nodes.map((issue: any) => this.mapToRecentTicket(issue));
  }

  private async makeGraphQLRequest(query: string, variables: any): Promise<any> {
    const { default: axios } = await import('axios');
    
    const response = await axios.post(`${this.config.baseUrl}/graphql`, {
      query,
      variables
    }, {
      headers: this.getAuthHeaders()
    });
    
    return response.data;
  }
}
```

---

## 📚 Learning Resources

### For Python Developers Learning TypeScript

1. **TypeScript Handbook**: https://www.typescriptlang.org/docs/
2. **VS Code Extension API**: https://code.visualstudio.com/api
3. **Node.js Documentation**: https://nodejs.org/docs/

### Key Concepts to Master

1. **Type System**: Understand interfaces, types, and generics
2. **Async Programming**: Master Promise, async/await patterns
3. **Module System**: Learn ES6 modules and CommonJS
4. **VS Code API**: Understand the extension development lifecycle

---

## 🎉 Summary

This AI Plan VS Code extension demonstrates:

1. **Modern TypeScript Development**: Clean, type-safe code
2. **VS Code Extension Architecture**: Proper extension lifecycle management
3. **API Integration**: REST and GraphQL API consumption
4. **AI Integration**: Local and cloud AI model usage
5. **User Experience**: Intuitive UI with progress indicators
6. **Security**: Secure credential management
7. **Extensibility**: Abstract interfaces for easy expansion

The project successfully bridges the gap between Python development concepts and TypeScript/VS Code extension development, providing a solid foundation for building powerful development tools.

**Ready to ship faster with AI-powered planning! 🚀**
