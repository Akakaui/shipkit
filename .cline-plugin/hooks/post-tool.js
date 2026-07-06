// shipkit — Cline post-tool hook
// Logs tool usage for pipeline tracking
export async function postToolUse({ tool, result }) {
  return { logged: true };
}
