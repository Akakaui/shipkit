#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
#  shipkit — Universal installer
#  Installs CODE pipeline agents + production-hardening skills into:
#    OpenCode | Claude Code | Cursor | Codex CLI | Cline | Antigravity | Aider | Windsurf
#  Auto-detects platforms and installs to all found.
#
#  Usage:
#    bash installer.sh              # Auto-detect + install globally
#    bash installer.sh --local      # Install in current project only
#    bash installer.sh --list       # List detected platforms only
# =============================================================================

VERSION="1.0.0"
REPO_RAW="https://raw.githubusercontent.com/Akakaui/shipkit/main"

# Colors
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { printf "${GREEN}✓${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}⚠${NC} %s\n" "$1"; }
step()  { printf "\n${BOLD}${CYAN}▸ %s${NC}\n" "$1"; }
fail()  { printf "${YELLOW}✗${NC} %s\n" "$1"; }

# ──────────────────────────────────────────────
#  Platform Detection
# ──────────────────────────────────────────────

detect_platforms() {
  local platforms=()

  # OpenCode
  if [ -f "$HOME/.config/opencode/opencode.json" ] || [ -d "$HOME/.config/opencode" ]; then
    platforms+=("opencode")
  fi

  # Claude Code
  if [ -d "$HOME/.claude" ] || [ -f "$HOME/.claude.json" ]; then
    platforms+=("claude")
  fi

  # Cursor
  if [ -d "$HOME/.cursor" ]; then
    platforms+=("cursor")
  fi

  # Codex CLI
  if [ -d "$HOME/.codex" ] || command -v codex &>/dev/null; then
    platforms+=("codex")
  fi

  # Cline
  if [ -d "$HOME/.cline" ]; then
    platforms+=("cline")
  fi

  # Antigravity CLI
  if [ -d "$HOME/.gemini/antigravity-cli/plugins" ] || [ -d "$HOME/.antigravity" ]; then
    platforms+=("antigravity")
  fi

  # Aider (no plugin system — detect by config or binary)
  if [ -f "$HOME/.aider.conf.yml" ] || command -v aider &>/dev/null; then
    platforms+=("aider")
  fi

  # Windsurf
  if [ -d "$HOME/.windsurf" ]; then
    platforms+=("windsurf")
  fi

  echo "${platforms[@]}"
}

CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/shipkit"
SKILLS_DIR="$CACHE_DIR/skills"
AGENTS_DIR="$CACHE_DIR/agents"
PROFILES_DIR="$CACHE_DIR/profiles"

# ──────────────────────────────────────────────
#  Install for each platform
# ──────────────────────────────────────────────

install_opencode() {
  step "Installing for OpenCode"

  local skill_target="$HOME/.config/opencode/skills"
  local agent_target="$HOME/.config/opencode/agents"
  mkdir -p "$skill_target" "$agent_target"

  local skills=(
    "production-hardening" "infra-networking" "container-orch"
    "db-scale" "resilience-patterns" "security-hardening" "prod-ops"
  )
  for skill in "${skills[@]}"; do
    mkdir -p "$skill_target/$skill"
  done

  local agents=(
    "code" "planner" "architect" "frontend" "backend"
    "mobile" "extension" "tester" "reviewer" "deployer"
    "security" "auto-detect" "github-tracker" "ops-monitor"
  )
  for agent in "${agents[@]}"; do
    mkdir -p "$agent_target/$agent"
  done

  info "OpenCode skills → $skill_target"
  info "OpenCode agents → $agent_target"
}

install_claude() {
  step "Installing for Claude Code"

  local skill_target="$HOME/.claude/skills"
  local agent_target="$HOME/.claude/agents"
  mkdir -p "$skill_target" "$agent_target"

  info "Claude Code skills → $skill_target"
  info "Claude Code agents → $agent_target"
  info "Plugin manifest at $HOME/.claude/plugin.json"
}

install_cursor() {
  step "Installing for Cursor"

  local skill_target="$HOME/.cursor/skills"
  local agent_target="$HOME/.cursor/agents"
  mkdir -p "$skill_target" "$agent_target"

  info "Cursor skills → $skill_target"
  info "Cursor agents → $agent_target"
  info "Hooks config at $HOME/.cursor/hooks.json"
}

install_codex() {
  step "Installing for Codex CLI"

  local skill_target="$HOME/.codex/skills"
  local agent_target="$HOME/.codex/agents"
  mkdir -p "$skill_target" "$agent_target"

  info "Codex CLI skills → $skill_target"
  info "Codex CLI agents → $agent_target"
  info "Plugin manifest at $HOME/.codex/plugin.json"
}

install_cline() {
  step "Installing for Cline"

  local plugin_dir="$HOME/.cline/plugins/shipkit"
  mkdir -p "$plugin_dir/skills" "$plugin_dir/agents" "$plugin_dir/hooks"

  info "Cline plugin → $plugin_dir"
  info "  skills/ → $plugin_dir/skills"
  info "  agents/ → $plugin_dir/agents"
  info "  hooks/  → $plugin_dir/hooks"
}

install_antigravity() {
  step "Installing for Antigravity CLI"

  local plugin_dir="$HOME/.gemini/antigravity-cli/plugins/shipkit"
  mkdir -p "$plugin_dir/skills" "$plugin_dir/agents" "$plugin_dir/hooks"

  info "Antigravity plugin → $plugin_dir"
  info "  skills/ → $plugin_dir/skills"
  info "  agents/ → $plugin_dir/agents"
  info "  hooks/  → $plugin_dir/hooks"
}

install_aider() {
  step "Installing for Aider (convention-based)"

  local rule_dir="$HOME/.aider/rules"
  mkdir -p "$rule_dir"

  info "Aider rules (loaded via --read) → $rule_dir"
  info "Usage: aider --read $rule_dir/*.skill.md"
}

install_windsurf() {
  step "Installing for Windsurf (rule-based)"

  local rule_dir="$HOME/.windsurf/rules"
  mkdir -p "$rule_dir"

  info "Windsurf rules (loaded automatically) → $rule_dir"
}

# ──────────────────────────────────────────────
#  Cache Skills Locally
# ──────────────────────────────────────────────

cache_files() {
  step "Caching pipeline files"

  mkdir -p "$SKILLS_DIR" "$AGENTS_DIR" "$PROFILES_DIR"

  local skill_dirs=(
    "production-hardening" "infra-networking" "container-orch"
    "db-scale" "resilience-patterns" "security-hardening" "prod-ops"
  )

  for skill in "${skill_dirs[@]}"; do
    local dest="$SKILLS_DIR/$skill"
    mkdir -p "$dest"
    download "$REPO_RAW/skills/$skill/SKILL.md" "$dest/SKILL.md" 2>/dev/null || \
      warn "Could not download skill: $skill (offline mode ok)"
  done
  info "Skills cached → $SKILLS_DIR"

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

  local profiles=("saas" "api" "cli-tool" "mobile" "extension" "game" "fun-tool" "enterprise")
  for profile in "${profiles[@]}"; do
    download "$REPO_RAW/profiles/$profile.json" "$PROFILES_DIR/$profile.json" 2>/dev/null || \
      warn "Could not download profile: $profile (offline mode ok)"
  done
  info "Profiles cached → $PROFILES_DIR"

  download "$REPO_RAW/PIPELINE.md" "$CACHE_DIR/PIPELINE.md" 2>/dev/null || \
    warn "Could not download PIPELINE.md"
  download "$REPO_RAW/PLAN.md" "$CACHE_DIR/PLAN.md" 2>/dev/null || \
    warn "Could not download PLAN.md"

  info "Pipeline docs cached → $CACHE_DIR"
}

download() {
  local url="$1"
  local dest="$2"
  mkdir -p "$(dirname "$dest")"

  if command -v curl &>/dev/null; then
    curl -fsSL "$url" -o "$dest" 2>/dev/null
  elif command -v wget &>/dev/null; then
    wget -q "$url" -O "$dest" 2>/dev/null
  else
    return 1
  fi
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
    printf "    Claude Code:  npm install -g @akakaui/shipkit\n"
    printf "    Cursor:       npm install -g @akakaui/shipkit\n"
    printf "    Codex CLI:    npm install -g @akakaui/shipkit\n"
    printf "    Cline:        cp -r %s ~/.cline/plugins/shipkit/\n" "$CACHE_DIR"
    printf "    Antigravity:  cp -r %s ~/.gemini/antigravity-cli/plugins/shipkit/\n" "$CACHE_DIR"
    printf "    Aider:        cp %s/skills/*/SKILL.md ~/.aider/rules/\n" "$CACHE_DIR"
    printf "    Windsurf:     cp -r %s/skills/* ~/.windsurf/rules/\n" "$CACHE_DIR"
  else
    for platform in "${platforms[@]}"; do
      case "$platform" in
        opencode)    printf "  ${GREEN}✔${NC} OpenCode — ready\n" ;;
        claude)      printf "  ${GREEN}✔${NC} Claude Code — ready\n" ;;
        cursor)      printf "  ${GREEN}✔${NC} Cursor — ready\n" ;;
        codex)       printf "  ${GREEN}✔${NC} Codex CLI — ready\n" ;;
        cline)       printf "  ${GREEN}✔${NC} Cline — ready\n" ;;
        antigravity) printf "  ${GREEN}✔${NC} Antigravity — ready\n" ;;
        aider)       printf "  ${GREEN}✔${NC} Aider — ready (rules-based)\n" ;;
        windsurf)    printf "  ${GREEN}✔${NC} Windsurf — ready (rules-based)\n" ;;
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

  local mode="${1:-auto}"

  if [ "$mode" = "--list" ]; then
    read -ra platforms <<< "$(detect_platforms)"
    if [ ${#platforms[@]} -eq 0 ]; then
      echo "No supported AI coding agents detected."
    else
      echo "Detected platforms:"
      for p in "${platforms[@]}"; do echo "  - $p"; done
    fi
    exit 0
  fi

  if [ "$mode" = "--local" ]; then
    step "Installing locally in $PWD/.shipkit"
    mkdir -p ".shipkit/agents" ".shipkit/skills"
    info "Local project config at .shipkit/"
    exit 0
  fi

  # Detect platforms
  read -ra platforms <<< "$(detect_platforms)"

  if [ ${#platforms[@]} -eq 0 ]; then
    warn "No supported AI coding tools detected."
    printf "  ${BOLD}Supported:${NC} OpenCode, Claude Code, Cursor, Codex CLI, Cline, Antigravity, Aider, Windsurf\n\n"
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
      opencode)    install_opencode ;;
      claude)      install_claude ;;
      cursor)      install_cursor ;;
      codex)       install_codex ;;
      cline)       install_cline ;;
      antigravity) install_antigravity ;;
      aider)       install_aider ;;
      windsurf)    install_windsurf ;;
    esac
  done

  # Summary
  print_summary "${platforms[@]}"
}

main "${1:-auto}"
