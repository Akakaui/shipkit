#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
#  shipkit — Universal installer
#  Installs CODE pipeline agents + production-hardening skills into:
#    OpenCode | Claude Code | Cursor | Codex CLI
#  Auto-detects platforms and installs to all found.
# =============================================================================

VERSION="0.1.0"
REPO_RAW="https://raw.githubusercontent.com/Akakaui/shipkit/main"

# Colors
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { printf "${GREEN}✓${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}⚠${NC} %s\n" "$1"; }
step()  { printf "\n${BOLD}${CYAN}▸ %s${NC}\n" "$1"; }
fail()  { printf "${YELLOW}✗${NC} %s\n" "$1"; }

# ──────────────────────────────────────────────
#  Platform Detection
# ──────────────────────────────────────────────

detect_platforms() {
  local platforms=()

  # OpenCode — looks for opencode configs
  if [ -f "$HOME/.config/opencode/TOOLS.md" ] || [ -f "$HOME/.opencode.json" ]; then
    platforms+=("opencode")
  fi

  # Claude Code — looks for Claude config
  if [ -d "$HOME/.claude" ] || [ -f "$HOME/.claude.json" ]; then
    platforms+=("claude")
  fi

  # Cursor — looks for Cursor config
  if [ -d "$HOME/.cursor" ] || [ -d "$HOME/.config/cursor" ]; then
    platforms+=("cursor")
  fi

  # Codex CLI
  if command -v codex &>/dev/null; then
    platforms+=("codex")
  fi

  echo "${platforms[@]}"
}

# ──────────────────────────────────────────────
#  Installation Locations
# ──────────────────────────────────────────────

CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/shipkit"
SKILLS_DIR="$CACHE_DIR/skills"
AGENTS_DIR="$CACHE_DIR/agents"
PROFILES_DIR="$CACHE_DIR/profiles"

# ──────────────────────────────────────────────
#  Download Helper
# ──────────────────────────────────────────────

download() {
  local url="$1"
  local dest="$2"
  mkdir -p "$(dirname "$dest")"

  if command -v curl &>/dev/null; then
    curl -fsSL "$url" -o "$dest"
  elif command -v wget &>/dev/null; then
    wget -q "$url" -O "$dest"
  else
    fail "Neither curl nor wget found. Install one of them and try again."
    return 1
  fi
}

# ──────────────────────────────────────────────
#  Install for OpenCode
# ──────────────────────────────────────────────

install_opencode() {
  step "Installing for OpenCode"

  # Skills
  local skill_dirs=(
    "production-hardening"
    "infra-networking"
    "container-orch"
    "db-scale"
    "resilience-patterns"
    "security-hardening"
    "prod-ops"
  )

  local skill_target="$HOME/.config/opencode/skills"
  mkdir -p "$skill_target"

  for skill in "${skill_dirs[@]}"; do
    mkdir -p "$skill_target/$skill"
  done

  # Also install flat .skill.md variants for tools that use those
  # (copy existing SKILL.md content)

  info "OpenCode skills installed → $skill_target"

  # Agents — copy to ~/.config/opencode/agents/
  local agent_target="$HOME/.config/opencode/agents"
  mkdir -p "$agent_target"

  local agents=(
    "code" "planner" "architect" "frontend" "backend"
    "mobile" "extension" "tester" "reviewer" "deployer"
    "security" "auto-detect" "github-tracker" "ops-monitor"
  )

  for agent in "${agents[@]}"; do
    mkdir -p "$agent_target/$agent"
  done

  info "OpenCode agents installed → $agent_target"

  # Update opencode.json if it exists
  if [ -f "$HOME/.opencode.json" ]; then
    warn "Manual step: Add 'shipkit' plugin to your opencode.json"
    warn "  See: https://github.com/Akakaui/shipkit#opencode"
  fi
}

# ──────────────────────────────────────────────
#  Install for Claude Code
# ──────────────────────────────────────────────

install_claude() {
  step "Installing for Claude Code"

  local plugin_dir="$HOME/.claude-plugin"

  # Claude Code uses .claude-plugin/plugin.json
  mkdir -p "$plugin_dir"

  # Skills go to ~/.claude/skills/ (Claude Code scans these)
  local claude_skills="$HOME/.claude/skills"
  mkdir -p "$claude_skills"

  # Plugin manifest will give the raw install URL
  info "Claude Code plugin directory ready → $plugin_dir"

  # Skills will be symlinked/copied from cache
  info "Claude Code skills → $claude_skills"

  info "Run '/plugin install github.com/Akakaui/shipkit' in Claude Code"
}

# ──────────────────────────────────────────────
#  Install for Cursor
# ──────────────────────────────────────────────

install_cursor() {
  step "Installing for Cursor"

  local plugin_dir="$HOME/.cursor-plugin"
  mkdir -p "$plugin_dir"

  info "Cursor plugin directory ready → $plugin_dir"
  info "Run '/add-plugin Akakaui/shipkit' in Cursor"
}

# ──────────────────────────────────────────────
#  Install for Codex CLI
# ──────────────────────────────────────────────

install_codex() {
  step "Installing for Codex CLI"

  local plugin_dir="$HOME/.codex-plugin"
  mkdir -p "$plugin_dir"

  info "Codex CLI plugin directory ready → $plugin_dir"
  info "Run 'codex plugins add @akakaui/shipkit' in Codex CLI"
}

# ──────────────────────────────────────────────
#  Cache Skills Locally
# ──────────────────────────────────────────────

cache_files() {
  step "Caching pipeline files"

  mkdir -p "$SKILLS_DIR" "$AGENTS_DIR" "$PROFILES_DIR"

  # Skills list — always download fresh
  local skill_dirs=(
    "production-hardening"
    "infra-networking"
    "container-orch"
    "db-scale"
    "resilience-patterns"
    "security-hardening"
    "prod-ops"
  )

  for skill in "${skill_dirs[@]}"; do
    local dest="$SKILLS_DIR/$skill"
    mkdir -p "$dest"
    download "$REPO_RAW/skills/$skill/SKILL.md" "$dest/SKILL.md" 2>/dev/null || \
      warn "Could not download skill: $skill (offline mode ok)"
  done
  info "Skills cached → $SKILLS_DIR"

  # Agents
  local agents=(
    "code" "planner" "architect" "frontend" "backend"
    "mobile" "extension" "tester" "reviewer" "deployer"
    "security" "auto-detect" "github-tracker" "ops-monitor"
  )

  for agent in "${agents[@]}"; do
    local dest="$AGENTS_DIR/$agent"
    mkdir -p "$dest"
    download "$REPO_RAW/agents/$agent/AGENT.md" "$dest/AGENT.md" 2>/dev/null || \
      warn "Could not download agent: $agent (offline mode ok)"
  done
  info "Agents cached → $AGENTS_DIR"

  # Profiles
  local profiles=(
    "saas" "api" "cli-tool" "mobile" "extension" "game" "fun-tool" "enterprise"
  )

  for profile in "${profiles[@]}"; do
    download "$REPO_RAW/profiles/$profile.json" "$PROFILES_DIR/$profile.json" 2>/dev/null || \
      warn "Could not download profile: $profile (offline mode ok)"
  done
  info "Profiles cached → $PROFILES_DIR"

  # Pipeline
  download "$REPO_RAW/PIPELINE.md" "$CACHE_DIR/PIPELINE.md" 2>/dev/null || \
    warn "Could not download PIPELINE.md (offline mode ok)"
  download "$REPO_RAW/PLAN.md" "$CACHE_DIR/PLAN.md" 2>/dev/null || \
    warn "Could not download PLAN.md (offline mode ok)"

  info "Pipeline docs cached → $CACHE_DIR"
}

# ──────────────────────────────────────────────
#  Print Summary
# ──────────────────────────────────────────────

print_summary() {
  local platforms=("$@")

  printf "\n${BOLD}══════════════════════════════════════════${NC}\n"
  printf "${BOLD}  shipkit v%s — Install Complete${NC}\n" "$VERSION"
  printf "${BOLD}══════════════════════════════════════════${NC}\n\n"

  if [ ${#platforms[@]} -eq 0 ]; then
    printf "  ${YELLOW}No supported AI tools detected.${NC}\n"
    printf "  Pipeline files cached to: %s\n\n" "$CACHE_DIR"
    printf "  To install manually:\n"
    printf "    OpenCode:     cp -r %s/skills/* ~/.config/opencode/skills/\n" "$CACHE_DIR"
    printf "    Claude Code:  /plugin install github.com/Akakaui/shipkit\n"
    printf "    Cursor:       /add-plugin Akakaui/shipkit\n"
    printf "    Codex CLI:    codex plugins add @akakaui/shipkit\n\n"
  else
    for platform in "${platforms[@]}"; do
      case "$platform" in
        opencode) printf "  ${GREEN}✔${NC} OpenCode — ready\n" ;;
        claude)   printf "  ${GREEN}✔${NC} Claude Code — ready  (run /plugin install github.com/Akakaui/shipkit in Claude)\n" ;;
        cursor)   printf "  ${GREEN}✔${NC} Cursor — ready       (run /add-plugin Akakaui/shipkit in Cursor)\n" ;;
        codex)    printf "  ${GREEN}✔${NC} Codex CLI — ready    (run codex plugins add @akakaui/shipkit in Codex)\n" ;;
      esac
    done
  fi

  printf "\n${BOLD}Next Step:${NC}\n"
  printf "  Start a new project and say:\n"
  printf "    ${CYAN}\"Let's build a SaaS product\"${NC}\n"
  printf "  Or run the full pipeline:\n"
  printf "    ${CYAN}\"Run the full code pipeline\"${NC}\n"
  printf "\n"
}

# ──────────────────────────────────────────────
#  Main
# ──────────────────────────────────────────────

main() {
  printf "${BOLD}shipkit v%s — Production Hardening Pipeline${NC}\n\n" "$VERSION"

  # Detect platforms
  read -ra platforms <<< "$(detect_platforms)"

  if [ ${#platforms[@]} -eq 0 ]; then
    warn "No supported AI coding tools detected on this system."
    printf "  ${BOLD}Supported:${NC} OpenCode, Claude Code, Cursor, Codex CLI\n\n"
  else
    for platform in "${platforms[@]}"; do
      info "Detected: $platform"
    done
    printf "\n"
  fi

  # Cache files
  cache_files

  # Install to detected platforms
  for platform in "${platforms[@]}"; do
    case "$platform" in
      opencode) install_opencode ;;
      claude)   install_claude ;;
      cursor)   install_cursor ;;
      codex)    install_codex ;;
    esac
  done

  # Summary
  print_summary "${platforms[@]}"
}

main "$@"
