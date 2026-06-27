# create-code

AI Development Operating System - scaffolds complete projects with agents, skills, and tools.

## Quick Start

\`\`\`bash
npx @akakaui/create-code@latest my-app
\`\`\`

Then follow the interactive prompts to choose:
- Project type: web, mobile, or extension
- Scope: landing, interactive, lightweight, or full-scale

## What You Get

Every project created with `create-code` comes with:

### Agents (11)
- `@code` - Main orchestrator
- `@planner` - Requirements & planning
- `@architect` - Stack selection
- `@frontend` - UI implementation
- `@backend` - API implementation
- `@mobile` - Mobile app implementation
- `@extension` - Chrome extension implementation
- `@tester` - Test generation
- `@deployer` - CI/CD & deployment
- `@reviewer` - Code review & handoff
- `@security` - Security audit

### Skills (15)
- Scope classifier, feature prioritizer, stack selector
- Modularity, testing, git workflow
- Security, documentation, performance
- Deployment, monitoring, handoff
- Cleanup, context manager, confirmation

### Tools (5)
- Scaffolder - Create folder structures
- Test runner - Run tests with coverage
- Bundle analyzer - Check performance
- Deploy pipeline - Deploy to environments
- Handoff validator - 30-minute rule check

## How to Use

After running `npx @akakaui/create-code my-app`:

1. Open `my-app/` in your AI coding assistant (Claude Code, Cursor, etc.)
2. Ask `@code` to help with your project
3. The system will automatically route to the right agent

Example conversations:
- "Plan my new SaaS dashboard" → routes to `@planner`
- "Build me a landing page" → routes to `@frontend`
- "Set up Stripe payments" → routes to `@backend`
- "Deploy to production" → routes to `@deployer`
- "Is my code ready to hand off?" → routes to `@reviewer`

## Commands

\`\`\`bash
# Create new project
npx @akakaui/create-code my-app

# Skip prompts with flags
npx @akakaui/create-code my-app --type web --scope lightweight

# Skip git init
npx @akakaui/create-code my-app --no-git

# Skip npm install
npx @akakaui/create-code my-app --no-install

# Initialize in existing project
npx @akakaui/create-code init

# List templates
npx @akakaui/create-code templates

# List agents
npx @akakaui/create-code agents

# List skills
npx @akakaui/create-code skills
\`\`\`

## Architecture

create-code follows a layered architecture:

1. **Templates** - Base scaffolds for each project type/scope
2. **Agents** - Specialized AI personas for each domain
3. **Skills** - Reusable protocols loaded by agents
4. **Tools** - Automation scripts run by agents

When you ask `@code` for help, it:
1. Classifies the request (planning, building, testing, etc.)
2. Loads relevant context (project state, planning summary)
3. Routes to the appropriate sub-agent
4. Applies relevant skills
5. Runs tools as needed

## Project Types & Scopes

### Web Applications
- **Landing Page** - Single page, no backend
- **Interactive Frontend** - Client-side only
- **Lightweight Web App** - Basic backend
- **Full-Scale Web App** - Complex backend

### Mobile Apps
- **Single-screen** - Minimal interaction
- **Multi-screen** - Multiple flows
- **Lightweight** - Backend integration
- **Full-Scale** - Full production app

### Chrome Extensions
- **Simple** - Popup only
- **Interactive** - Content scripts + API
- **Full-featured** - Background, content, options, offline

## Quality Standards

Every project includes:
- TypeScript strict mode
- ESLint configuration
- Vitest testing setup
- 70%+ code coverage targets
- 250-line file size limit
- 50-line function size limit
- Conventional commits
- CI/CD template (.github/workflows)

## License

MIT © Akakaui
