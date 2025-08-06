# AI Plan Extension - Python Developer's Guide

## 🎯 What is this?

A VS Code extension that generates implementation plans from your recent tickets using AI. Think of it as a Python script that:
1. Reads your Jira tickets
2. Analyzes your codebase  
3. Uses AI to create step-by-step implementation plans

## 🏗️ Architecture Comparison

### Python Equivalent
```python
# If this were Python:
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
// What we actually built:
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

## 📁 File Structure

| Python Concept | TypeScript Reality | Purpose |
|----------------|-------------------|---------|
| `main.py` | `src/extension.ts` | Entry point |
| `models.py` | `src/types.ts` | Data structures |
| `providers/` | `src/providers/` | API integrations |
| `ai/` | `src/llm/` | AI integrations |
| `ui/` | `src/ui/` | User interface |
| `utils/` | `src/contextBuilder.ts` | Helper functions |

## 🔧 Key Components

### 1. Type Definitions (`src/types.ts`)

**Python:**
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

**TypeScript:**
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

### 2. Abstract Base Classes (`src/providers/base.ts`)

**Python:**
```python
from abc import ABC, abstractmethod
import requests

class BaseProvider(ABC):
    def __init__(self, config: dict):
        self.config = config
    
    @abstractmethod
    def get_recent_tickets(self, limit: int = 10) -> List[RecentTicket]:
        pass
    
    def make_request(self, url: str, **kwargs):
        headers = self.get_auth_headers()
        response = requests.get(url, headers=headers, **kwargs)
        return response.json()
```

**TypeScript:**
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
}
```

### 3. Jira Provider (`src/providers/jira.ts`)

**Python equivalent:**
```python
import requests
from datetime import datetime

class JiraProvider(BaseProvider):
    def get_provider_name(self) -> str:
        return "jira"
    
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

### 4. AI Integration (`src/llm/ollama.ts`)

**Python equivalent:**
```python
import requests

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

### 5. Main Extension (`src/extension.ts`)

**Python equivalent:**
```python
# Like a Flask app
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/generate-plan', methods=['POST'])
def generate_plan():
    try:
        ticket_data = request.json
        
        picker = RecentTicketsPicker()
        generator = PlanGenerator()
        
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
}
```

## 🔄 Development Workflow

### Python vs TypeScript

| Python Development | TypeScript Development |
|-------------------|----------------------|
| `python script.py` | `npm run compile` then run |
| `pip install package` | `npm install package` |
| `requirements.txt` | `package.json` |
| `venv` | `node_modules` |
| `pytest` | `npm test` |

### Building and Running

**Python:**
```bash
pip install -r requirements.txt
pytest
python main.py
```

**TypeScript:**
```bash
npm install
npm run compile
npm test
# Press F5 in VS Code
```

## 🎯 Key TypeScript Concepts

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

## 🚀 How to Extend

### Adding a New Provider

**Python:**
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

**TypeScript:**
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
}
```

## 📚 Learning Resources

1. **TypeScript Handbook**: https://www.typescriptlang.org/docs/
2. **VS Code Extension API**: https://code.visualstudio.com/api
3. **Node.js Documentation**: https://nodejs.org/docs/

## 🎉 Summary

This project demonstrates:
- **Modern TypeScript Development**: Clean, type-safe code
- **VS Code Extension Architecture**: Proper extension lifecycle
- **API Integration**: REST and GraphQL API consumption
- **AI Integration**: Local and cloud AI model usage
- **User Experience**: Intuitive UI with progress indicators
- **Security**: Secure credential management
- **Extensibility**: Abstract interfaces for easy expansion

**Ready to ship faster with AI-powered planning! 🚀**
