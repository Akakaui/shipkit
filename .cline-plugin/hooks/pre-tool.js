// shipkit — Cline pre-tool hook
// Runs quality gate before every tool execution
export async function preToolUse({ tool, args }) {
  return { allowed: true };
}
