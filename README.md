# AI Plan - VS Code Extension

Generate implementation plans from recent tickets using AI.

## 🚀 Features

- **Recent Tickets Selection**: Browse and select from your recent tickets across multiple providers
- **Multi-Provider Support**: Works with Jira, Linear, GitHub Issues, and Slack
- **AI-Powered Plans**: Generate detailed implementation plans using local (Ollama) or cloud (OpenRouter) AI
- **Workspace Context**: Automatically analyzes your codebase to provide relevant context
- **Secure**: Uses VS Code's SecretStorage for secure credential management
- **Zero Copy-Paste**: No need to manually enter ticket IDs or URLs

## 📋 Requirements

- VS Code 1.85.0 or higher
- Node.js 18+ (for development)
- Ollama (for local AI) or OpenRouter API key (for cloud AI)

## 🛠️ Installation

### From Source

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Compile the extension:
   ```bash
   npm run compile
   ```
4. Press F5 in VS Code to run the extension in development mode

### From VSIX

1. Package the extension:
   ```bash
   vsce package
   ```
2. Install the generated `.vsix` file in VS Code

## ⚙️ Configuration

### 1. Configure Jira

1. Open VS Code Command Palette (`Ctrl+Shift+P`)
2. Run "AI Plan: Configure"
3. Select "Configure Jira"
4. Enter your Jira base URL (e.g., `https://company.atlassian.net`)
5. Enter your Jira Personal Access Token

### 2. Configure Ollama (Local AI)

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull a model:
   ```bash
   ollama pull llama2:13b
   ```
3. Start Ollama:
   ```bash
   ollama serve
   ```
4. Configure the extension to use Ollama (optional, it's the default)

### 3. Configure OpenRouter (Cloud AI)

1. Get an API key from [openrouter.ai](https://openrouter.ai)
2. Configure the extension with your API key

## 🎯 Usage

### Generate Plan from Recent Tickets

1. **Right-click** in the VS Code explorer and select "Generate Plan from Recent Tickets"
2. **Or** use the Command Palette (`Ctrl+Shift+P`) and run "Generate Plan from Recent Tickets"
3. Select a ticket from the list
4. Wait for the AI to generate your implementation plan
5. The plan will open in a new Markdown tab

### User Workflow

```
Open VS Code → Right-click folder → 
Select ticket → AI generates plan → 
Start implementing!
```

## 🏗️ Architecture

### Core Components

- **Providers**: Abstract interfaces for different ticketing systems
  - `JiraProvider`: Jira REST API integration
  - `LinearProvider`: Linear GraphQL API integration
  - `GitHubProvider`: GitHub REST API integration
  - `SlackProvider`: Slack Web API integration

- **LLM Providers**: AI model interfaces
  - `OllamaProvider`: Local AI using Ollama
  - `OpenRouterProvider`: Cloud AI using OpenRouter

- **Context Builder**: Analyzes workspace and builds context
  - Reads `.gitignore` patterns
  - Walks workspace directory
  - Filters and concatenates source files
  - Limits to 50KB total context

- **UI Components**:
  - `RecentTicketsPicker`: Shows recent tickets for selection
  - `PlanGenerator`: Handles AI plan generation workflow

### File Structure

```
src/
├── extension.ts              # Main activation
├── providers/
│   ├── base.ts              # Abstract provider interface
│   ├── jira.ts              # Jira implementation
│   ├── linear.ts            # Linear implementation
│   ├── github.ts            # GitHub implementation
│   └── slack.ts             # Slack implementation
├── llm/
│   ├── base.ts              # Abstract LLM interface
│   ├── ollama.ts            # Local Ollama integration
│   └── openrouter.ts        # OpenRouter API integration
├── ui/
│   ├── recentTicketsPicker.ts # Recent tickets UI
│   └── planGenerator.ts     # Plan generation UI
├── contextBuilder.ts        # Workspace context generation
└── types.ts                 # Shared interfaces
```

## 🔧 Development

### Prerequisites

- Node.js 18+
- VS Code Extension Development Host
- Ollama (for testing local AI)

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Compile TypeScript:
   ```bash
   npm run compile
   ```

3. Run in development mode:
   - Press F5 in VS Code
   - Or run `npm run watch` for continuous compilation

### Testing

```bash
npm test
```

### Building

```bash
npm run compile
vsce package
```

## 📦 Dependencies

### Core Dependencies
- `axios`: HTTP client for API calls
- `ignore`: .gitignore pattern matching
- `@slack/web-api`: Slack API integration
- `@octokit/rest`: GitHub API integration

### Development Dependencies
- `@types/vscode`: VS Code extension types
- `@types/node`: Node.js types
- `typescript`: TypeScript compiler
- `@vscode/vsce`: Extension packaging tool

## 🎯 Roadmap

### Phase 1: Foundation ✅
- [x] Project setup and structure
- [x] Core interfaces and types
- [x] Jira provider implementation
- [x] Ollama integration
- [x] Context builder
- [x] Basic UI components

### Phase 2: Additional Providers
- [ ] Linear provider
- [ ] GitHub provider
- [ ] Slack provider

### Phase 3: Enhanced Features
- [ ] OpenRouter integration
- [ ] Smart ticket filtering
- [ ] Plan customization options
- [ ] Batch processing

### Phase 4: Polish & Publishing
- [ ] Comprehensive testing
- [ ] Documentation
- [ ] Marketplace publishing

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- VS Code Extension API
- Ollama for local AI inference
- OpenRouter for cloud AI access
- All the ticketing platforms (Jira, Linear, GitHub, Slack)

---

**Made with ❤️ for developers who want to ship faster**
