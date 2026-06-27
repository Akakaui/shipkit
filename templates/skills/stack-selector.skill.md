# STACK SELECTOR — Tech Stack Selection

## PURPOSE

Selects the appropriate tech stack based on project
type, scope, constraints, and team expertise.

## TRIGGERS

- "Choose my stack"
- "What tech should I use?"
- "Select framework"

## WORKFLOW

### Step 1: Review Classification

Load scope classification:
  - Project type (Web/Mobile/Extension)
  - Scope (Landing/Interactive/Lightweight/Full-Scale)
  - Required layers

### Step 2: Assess Constraints

Ask about:
  - Team expertise (what do they know?)
  - Budget (hosting costs)
  - Timeline (speed to launch)
  - Scalability needs
  - Compliance requirements

### Step 3: Select Frontend

For Web:
  - Landing Page: HTML/CSS/JS + Tailwind CSS
  - Interactive: React + Next.js (recommended)
  - Lightweight: React + Next.js
  - Full-Scale: React + Next.js

For Mobile:
  - Single-screen: React Native + Expo
  - Multi-screen: React Native + Expo
  - Lightweight: React Native + Expo
  - Full-Scale: React Native + Expo or Flutter

For Chrome Extension:
  - Simple: Vanilla JS or React
  - Interactive: React + Manifest V3
  - Full-featured: React + Manifest V3

### Step 4: Select Backend

For Web/Mobile:
  - Landing Page: None
  - Interactive: None or BaaS (Supabase, Firebase)
  - Lightweight: Node.js + Fastify/Express or Python + FastAPI
  - Full-Scale: Node.js + Fastify or Python + FastAPI

For Chrome Extension:
  - Simple: None
  - Interactive: Same as web or extension-only
  - Full-featured: Same as web

### Step 5: Select Database

  - Landing Page: None
  - Interactive: None or BaaS
  - Lightweight: PostgreSQL (recommended) or MongoDB
  - Full-Scale: PostgreSQL + Redis (caching)

### Step 6: Select Hosting

  - Landing Page: Vercel, Netlify
  - Interactive: Vercel, Netlify
  - Lightweight: Vercel, AWS, GCP
  - Full-Scale: AWS, GCP, Azure

### Step 7: Output Stack

  STACK SELECTION:
  Frontend: [framework]
  Backend: [framework]
  Database: [database]
  Hosting: [platform]
  Reasoning: [why each choice]

## RULES

- ALWAYS choose simplest stack that meets requirements
- ALWAYS consider team expertise
- ALWAYS document reasoning
- ALWAYS consider upgrade path
- NEVER overengineer for current scope
- NEVER choose unfamiliar stack without good reason