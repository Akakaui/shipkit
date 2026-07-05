# TOOLS SKILL

Last updated: 2026-06-26
Version: 1
Scope: ALL AGENTS

## PURPOSE

Every agent must know what tools are available, what each
tool does, and when to reach for it. This file is the
complete tool literacy guide for the OPEX system.

## TOOL SELECTION LOGIC

Before calling any tool, run this check:

1. Can I answer this from files already in context? → No tool needed
2. Do I need current information? → web_search
3. Do I need stored OPEX knowledge? → qdrant_query
4. Do I need to save something permanently? → qdrant_write + file_write
5. Do I need to analyze a video? → watch_video
6. Do I need to produce a visual? → image_generation or playwright
7. Do I need to produce a video? → remotion
8. Do I need to push content to Notion? → notion
9. Do I need to backup memory? → google_drive (weekly)
10. Am I missing a tool entirely? → REQUEST_HUMAN_INPUT

## TOOL DESCRIPTIONS

### web_search

What it does: Searches the web for current information
Use when: Research, competitor analysis, trending topics,
          finding data to support content, current events
Do not use when: The answer is already in system files
Query style: Short, specific, 1-6 words preferred

### qdrant_query [READ]

What it does: Semantic search across stored knowledge
Collections and when to query each:
  knowledge/ — expert frameworks, methods, insights
  performance/ — past post results, what worked
  goals/ — goal history, milestone records
  hooks-pi/ — saved hooks and pattern interrupts
  methods-log/ — what methods were applied and when
  skills-log/ — skill creation and update history
Use when: Need context before producing any output

### qdrant_write [WRITE — REQUIRES CONFIRMATION]

What it does: Saves structured data to a collection
Always include: timestamp, source, category, tags
Requires user confirmation before executing

### file_read

What it does: Reads any file in .opex/ folder
Use when: Loading a skill, reading memory, checking config
No confirmation needed for read operations

### file_write [REQUIRES CONFIRMATION]

What it does: Writes or updates any file in .opex/ folder
Always: Read the file first, increment version, log the change
Format for version header:
  Last updated: [DATE]
  Version: [N+1]
  Changed by: [Agent Name]
  Reason: [why this update was made]

### image_generation [REQUIRES CONFIRMATION]

What it does: Generates images via OpenRouter (Nano Banana)
Use when: Blog headers, social visuals, article covers
Models:
  Nano Banana 2 (gemini-3.1-flash-image) — drafts, fast
  Nano Banana Pro (gemini-3-pro-image) — finals, highest quality
Process: Draft prompt first → present to user → confirm → generate
Never: Generate without showing the prompt first

### watch_video

What it does: Downloads video, extracts frames and transcript,
              hands both to the agent for analysis
Reference: bradautomates/claude-video (MIT license)
Use when: Analyzing a reel for patterns, processing expert video
          for knowledge ingestion, competitive content analysis
Invoke: /watch [URL] [specific question or instruction]
Frame budget: auto-scaled to video duration, max 100 frames
Whisper: fallback transcription when captions unavailable

### playwright [REQUIRES CONFIRMATION]

What it does: Renders HTML to PNG at exact pixel dimensions
Use when: Exporting carousel slides at 1080x1350px
Always: Use Python not shell scripts
         Keep viewport 420x525, device_scale_factor = 1080/420
         Wait 3000ms for fonts before capturing

### remotion

What it does: Renders programmatic video from React components
Location: .opex/video-engine/
Use when: Creating Instagram reels or YouTube videos
Process: Plan → asset check → confirm → render
Never: Render without confirmed assets

### notion [REQUIRES CONFIRMATION]

What it does: Creates/updates pages in Notion
Use when: Daily brief, goal updates, content calendar,
          push approved content for posting
Structure: Content database, Goals dashboard, Daily briefs
Invoke: Notion MCP

### google_drive [REQUIRES CONFIRMATION]

What it does: Pushes backup files to Google Drive
Structure: OPEX-System/Memory-Backups/[YYYY-MM-DD]/
Use when: Weekly memory backups only
Invoke: Drive MCP

### ollama

What it does: Generates embeddings locally for Qdrant
Model: nomic-embed-text (768 dimensions)
Use when: Any Qdrant write operation needs vectorization
Endpoint: localhost:11434
Cost: Free — runs entirely on VPS

## WHEN A TOOL IS MISSING

Use this format exactly:

BLOCKED — [Agent Name]

Task: [what was being attempted]
Missing: [tool or access needed]
Why: [why this blocks progress]
Format needed: [API key / MCP connection / file / approval]
Once you provide this: [what will happen next]

Never guess. Never hallucinate. Always ask.
