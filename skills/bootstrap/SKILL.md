# BOOTSTRAP SKILL

Last updated: 2026-07-01
Version: 2
Scope: ALL AGENT TOOLS — startup orientation file

## PURPOSE

You are operating inside the OPEX Business Operating System.
This file tells you exactly how to orient yourself at the
start of every session, every time, without fail.

## STARTUP SEQUENCE

Execute these steps in order BEFORE responding to any request.

### Step 1 — Load user identity
File: .opex/config/user.config.md
This tells you who the user is, what their business does,
which platforms they are on, and their brand identity.

### Step 2 — Load your decision logic (THIS FILE IS CRITICAL)
File: .opex/agents/OPEX.md
This is the master orchestrator file. It contains:
- Agent routing table (which agent handles what)
- Skill loading requirements (which skills each agent needs)
- Content Production Pipeline (exact day workflow sequence)
- Knowledge Ingestion Pipeline
- Session persistence protocol

Without reading this file, you will route requests wrong.

### Step 3 — Load session state
File: .opex/memory/session.state.md
This tells you what was done in previous sessions.
Check for pending work before starting new tasks.
If file doesn't exist, create it.

### Step 4 — Load active goals
File: goals.memory.md (at workspace root)
This tells you what Akaka is currently working toward.
Every task must connect to an active goal.

### Step 5 — Load recent performance
File: .opex/memory/performance.memory.md
This tells you what has been working and what has not.
Use this to inform every content and strategy decision.

### Step 6 — Load memory files (in order)
Read all 7 files in this exact sequence:
1. .opex/memory/01-brand-and-design.md
2. .opex/memory/02-posting-schedule.md
3. .opex/memory/03-goals-and-missions.md
4. .opex/memory/04-human-voice-rules.md
5. .opex/memory/05-tone-and-protocol.md
6. .opex/memory/06-milestones.md
7. .opex/memory/07-profile-knowledge.md

### Step 7 — Load knowledge ingestion log
File: .opex/memory/knowledge-ingestion-log.md
This tells you what content has been ingested into Qdrant
and what domains are available for content creation.

### Step 8 — Identify the task
Only after reading all files above, respond to
the user's request using OPEX's decision logic.

If the user says "Quick update" or any greeting:
First follow the Session Start Protocol from OPEX.md.

## SKILL LOADING RULE

Before delegating to ANY agent, you MUST load the relevant skills
using the skill() tool. See .opex/agents/OPEX.md for the full list
of which skills each agent needs.

CRITICAL: Do NOT skip skill loading. The agents are useless without
their skills loaded.

## FOLDER MAP

.opex/
  agents/     agent instruction files (contains OPEX.md)
  skills/     skill files
  memory/     memory, session state, and log files
  config/     user configuration
  knowledge/  expert knowledge agents and playbooks
  tools/      utility scripts
  content/    generated content packages

## KNOWLEDGE INGESTION

When user shares a URL or says "watch this" / "ingest this":
1. Route to Knowledge Ingestion Agent
2. Load watch skill
3. Follow Knowledge Ingestion Pipeline in OPEX.md

## RULE

Never operate from memory alone.
Always read the relevant file before acting.
If a file version header looks outdated, flag it.
If a file does not exist yet, create it with initial state.

If you fail to follow this bootstrap sequence, you will:
- Route requests to wrong agents
- Skip skill loading
- Produce content that doesn't match Akaka's voice
- Break the system

**Do not skip steps. Read every file before responding.**
