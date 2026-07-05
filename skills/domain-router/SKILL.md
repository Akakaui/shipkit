---
name: domain-router
description: Route requests to domain-specific knowledge collections and patterns. Use when a task matches a known domain topic in the knowledge base.
---
# DOMAIN ROUTER SKILL

Last updated: 2026-06-26
Version: 1
Scope: Orchestrator, All Agents

## PURPOSE

Routes content to appropriate knowledge domains and retrieves domain-specific knowledge when creating content. The system automatically knows what you're trying to do and applies relevant knowledge without being asked.

## HOW IT WORKS

### When You Give Content (Training)

1. Content is extracted from URL (YouTube, IG, Twitter, blog, etc.)
2. System classifies content to a domain (platform + topic)
3. Domain is created if it doesn't exist
4. Patterns, frameworks, and examples are stored
5. Knowledge is embedded in Qdrant for retrieval

### When You Create Content (Application)

1. System understands the request context
2. Automatically loads relevant domain knowledge
3. Applies proven patterns and frameworks
4. Generates content grounded in your trained knowledge

## CLASSIFICATION RULES

### Platform Detection

- YouTube URLs → yt
- Instagram URLs → ig
- Twitter/X URLs → twitter
- TikTok URLs → tiktok
- LinkedIn URLs → linkedin
- Blog/article URLs → blog
- Podcast URLs → podcast
- Other URLs → web

### Topic Detection

Analyze content for:
- viral-hooks (viral, hook, attention, scroll-stop)
- content-strategy (calendar, plan, schedule, batch)
- sales-closing (sale, close, deal, pitch, offer)
- design (layout, color, font, visual, brand)
- growth (follower, audience, reach, scale)
- monetization (money, revenue, income, profit)
- copywriting (headline, CTA, persuade, write)
- psychology (mindset, behavior, influence)
- analytics (data, metric, track, measure)
- automation (automate, system, workflow)

### Domain Naming

Format: `{platform}-{topic}`
Examples: `ig-viral-hooks`, `yt-thumbnail-design`, `sales-closing`

## TOOLS

- `tools/ingest/pipeline.js` — Full ingestion pipeline
- `tools/ingest/extractor.js` — Content extraction
- `tools/ingest/classifier.js` — Domain classification
- `tools/ingest/embedder.js` — Vector embeddings
- `tools/ingest/qdrant.js` — Vector DB operations

## COMMANDS

### Ingest Content

```bash
# Auto-classify and store
node tools/ingest/pipeline.js <url>

# Transcript only
node tools/ingest/pipeline.js <url> --mode transcript

# Full analysis
node tools/ingest/pipeline.js <url> --mode analysis

# Deep analysis
node tools/ingest/pipeline.js <url> --mode deep
```

### List Domains

```bash
cat ~/.config/opencode/skills/domain-router/domains.json
```

### Search Domain Knowledge

```bash
node tools/ingest/qdrant.js search <domain> <vector> <limit>
```

## DOMAIN STRUCTURE

Each domain has:
```
skills/{domain}/
├── SKILL.md          # Domain description and patterns
└── knowledge.json    # Examples, frameworks, sources
```

## REGISTERED DOMAINS (as of 2026-07-02)

| Domain | Platform | Topic | Qdrant Points | Source |
|--------|----------|-------|---------------|--------|
| yt-content-psychology | YouTube | Hooks, Psychology, Persuasion | 139 | 7 YT scripts |
| yt-social-strategy | YouTube | Social Media Strategy | 264 | 9 YT scripts |
| yt-personal-brand | YouTube | Personal Brand Building | 67 | 3 YT scripts |
| applied-business | Web | Funnels, Pricing, Email, Sales | 119 | 7 consolidated sources |
| sales-insights | Web | Revenue Leaks, Booking, CRM | 68 | 3 generated sales pieces |
| hooks-pi | Cross | Hook Patterns (457 extracted) | 457 | All sources |
| yt-copywriting | YouTube | Copywriting | — | Legacy |
| yt-wealth-creation | YouTube | Wealth Creation | — | Legacy |

## PHASE 3: QDRANT QUERY

During content production, the orchestrator runs:
```bash
python3 .opex/tools/query_qdrant.py --topic "<topic>" --platform <platform> --limit 5 --json
```

Returns: ranked results with hook patterns, frameworks, and platform-specific tactics matching the content brief.

### Query Examples
```bash
# LinkedIn post about revenue leaks
python3 .opex/tools/query_qdrant.py --topic "revenue leaks" --platform linkedin

# Twitter thread about AI content
python3 .opex/tools/query_qdrant.py --topic "AI content system" --platform twitter

# YouTube script about hooks
python3 .opex/tools/query_qdrant.py --topic "hooks" --platform youtube
```

## AUTOMATIC APPLICATION

When creating content, the orchestrator:
1. Identifies the content type and platform
2. Runs Phase 3 Qdrant query for matching domain patterns
3. Retrieves relevant hook patterns, frameworks, and insights
4. Applies patterns and frameworks automatically
5. No need to ask "apply viral patterns" — it knows

### What Gets Injected
- **Hooks**: Top-ranked hook patterns from the hooks-pi and content-psychology collections, matched by topic similarity
- **Frameworks**: Step-by-step systems and formulas from relevant domains
- **Data**: Statistical claims and authority-building data points
- **Tactics**: Platform-specific content patterns (LinkedIn video boost, Twitter thread structures, etc.)

## EXAMPLES

**Training:**
```
@opex https://youtube.com/watch?v=abc123
# → Classifies to yt-viral-hooks
# → Stores transcript and patterns
```

**Creating (automatic application):**
```
@opex write me a LinkedIn post
# → Automatically loads: voice rules + attention hooks + humanizer
# → Applies LinkedIn-specific patterns from domain knowledge
```

**Watching:**
```
@opex watch https://youtube.com/watch?v=abc123
# → Downloads video, extracts frames + audio + subtitles
# → Analyzes visual patterns, editing style, hooks
# → Stores in appropriate domain
```
