# Environment Configuration Guide

This guide explains how to set up environment variables for the AI Plan extension to avoid committing sensitive information to version control.

## Quick Setup

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your actual credentials:**
   ```bash
   # Open in your preferred editor
   code .env
   ```

3. **Fill in your API tokens and URLs**

## Environment Variables

### Jira Configuration
```bash
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_TOKEN=your_jira_personal_access_token
```

**How to get Jira credentials:**
1. Go to your Jira instance → Profile → Personal Access Tokens
2. Create a new token with appropriate permissions
3. Copy the token to your `.env` file

### Linear Configuration
```bash
LINEAR_API_TOKEN=lin_your_linear_api_token
```

**How to get Linear credentials:**
1. Go to Linear → Settings → API → Personal API keys
2. Generate a new API key
3. Copy the token (starts with `lin_`) to your `.env` file

### Slack Configuration
```bash
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
```

**How to get Slack credentials:**
1. Go to https://api.slack.com/apps
2. Create a new app or select existing app
3. Go to OAuth & Permissions
4. Install app to workspace and copy Bot User OAuth Token
5. Token should start with `xoxb-`

### Ollama Configuration (Optional)
```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2:13b
```

### OpenRouter Configuration (Optional)
```bash
OPENROUTER_API_KEY=your_openrouter_api_key
```

## Security Best Practices

### ✅ DO:
- Keep your `.env` file local (it's in `.gitignore`)
- Use strong, unique API tokens
- Rotate tokens regularly
- Use least-privilege permissions for API tokens
- Share `.env.example` with your team (without real values)

### ❌ DON'T:
- Commit `.env` files to version control
- Share API tokens in chat, email, or documentation
- Use production tokens in development
- Hardcode secrets in source code

## Troubleshooting

### "Provider not configured" Error
This means the environment variable is missing or empty:

1. Check your `.env` file exists in the project root
2. Verify the variable name matches exactly (case-sensitive)
3. Ensure there are no extra spaces around the `=` sign
4. Restart VS Code after changing `.env` variables

### "Invalid token format" Error
- **Jira**: Check token is valid and has correct permissions
- **Linear**: Token must start with `lin_`
- **Slack**: Bot token must start with `xoxb-`

### Extension Not Loading Environment Variables
1. Ensure `.env` is in the extension root directory
2. Check file permissions (readable)
3. Look at VS Code Developer Console for error messages

## Development vs Production

### Development (Local)
Use `.env` file with development/testing credentials:
```bash
NODE_ENV=development
LOG_LEVEL=debug
```

### Production (CI/CD)
Set environment variables directly in your deployment system:
- GitHub Actions: Repository Secrets
- Azure DevOps: Variable Groups
- Docker: Environment variables
- AWS/GCP: Parameter Store/Secret Manager

## File Structure
```
project-root/
├── .env                 # Your actual credentials (NEVER commit)
├── .env.example         # Template file (safe to commit)
├── .gitignore           # Contains .env to prevent commits
└── src/
    └── config/
        ├── environment.ts      # Environment loading logic
        ├── dotenv-loader.ts    # Custom .env parser
        └── provider-factory.ts # Creates providers from env vars
```

## Example Configuration Flow

1. **Extension starts** → Loads `.env` file
2. **Environment module** → Validates and structures variables
3. **Provider factory** → Creates providers with env credentials
4. **Providers** → Use credentials for API calls

This ensures sensitive data never appears in your source code while maintaining a smooth development experience.