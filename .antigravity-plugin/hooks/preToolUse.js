// shipkit — Antigravity pre-tool hook
export default async function preToolUse({ toolName, args }) {
  return { allowed: true };
}
