# SCOPE CLASSIFIER — Project Type & Scope Classification

## PURPOSE

Classifies project type (Web, Mobile, Extension) and
scope (Landing, Interactive, Lightweight, Full-Scale).

## TRIGGERS

- "What type of project is this?"
- "Classify my project"
- "Determine scope"

## CLASSIFICATION LOGIC

### Step 1: Project Type

Ask user to select ONE:

  WEB:
  - Landing Page
  - Interactive Frontend (no backend)
  - Lightweight Web App (basic backend)
  - Full-Scale Web App

  MOBILE:
  - Single-screen / Landing-like App
  - Multi-screen interactive App (small backend)
  - Lightweight App with Backend
  - Full-Scale Production Mobile App

  CHROME EXTENSION:
  - Simple (popup only, minimal background)
  - Interactive (popup + content scripts + API)
  - Full-featured (background + content + options + API + offline)

### Step 2: Map to Engineering Layers

Based on type + scope, determine required layers:

  LANDING PAGE (Web):
    - Required: Frontend only
    - Optional: None
    - Skip: Backend, Database, Auth

  INTERACTIVE FRONTEND (Web):
    - Required: Frontend, State Management
    - Optional: API integration
    - Skip: Backend, Database, Auth

  LIGHTWEIGHT WEB APP (Web):
    - Required: Frontend, Backend, Database, Auth
    - Optional: Testing, Monitoring
    - Skip: Complex infrastructure

  FULL-SCALE WEB APP (Web):
    - Required: All 10 engineering areas
    - Optional: None
    - Skip: None

  (Similar mapping for Mobile and Extension)

### Step 3: Output Classification

  PROJECT CLASSIFICATION:
  Type: [Web | Mobile | Extension]
  Scope: [Landing | Interactive | Lightweight | Full-Scale]
  Required Layers: [list]
  Optional Layers: [list]
  Skipped Layers: [list]

## RULES

- ALWAYS classify before architecture
- ALWAYS map scope to engineering layers
- ALWAYS skip unnecessary layers
- NEVER overengineer for scope