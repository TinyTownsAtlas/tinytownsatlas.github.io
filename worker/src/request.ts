import type { ChatMessage } from "./openai";
import type { UiContext } from "./prompt";

export const MAX_BODY_BYTES = 16_000;
export const MAX_USER_CHARS = 600;
export const MAX_ASSISTANT_CHARS = 2_000;
export const MAX_HISTORY = 8;

export interface ChatRequest {
  messages: ChatMessage[];
  ui?: UiContext;
}

export type ParseResult = { ok: true; request: ChatRequest } | { ok: false; message: string };

const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.length <= max ? v : null);

/** Strict parse of the browser's request. Unknown fields are ignored; nothing user-supplied reaches tools directly. */
export function parseChatRequest(body: unknown): ParseResult {
  if (!body || typeof body !== "object") return { ok: false, message: "Request must be a JSON object." };
  const raw = (body as Record<string, unknown>).messages;
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, message: "messages must be a non-empty array." };
  const messages: ChatMessage[] = [];
  for (const m of raw.slice(-MAX_HISTORY)) {
    if (!m || typeof m !== "object") return { ok: false, message: "Invalid message." };
    const role = (m as Record<string, unknown>).role;
    const content = (m as Record<string, unknown>).content;
    if (role !== "user" && role !== "assistant") return { ok: false, message: "Invalid message role." };
    const text = str(content, role === "user" ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS);
    if (text === null) {
      return { ok: false, message: `Messages must be text of at most ${role === "user" ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS} characters.` };
    }
    if (!text.trim()) return { ok: false, message: "Empty message." };
    messages.push({ role, content: text });
  }
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (messages[messages.length - 1]?.role !== "user") return { ok: false, message: "The last message must be from the user." };

  const rawUi = (body as Record<string, unknown>).ui;
  let ui: UiContext | undefined;
  if (rawUi && typeof rawUi === "object") {
    const u = rawUi as Record<string, unknown>;
    ui = {
      uclCode: str(u.uclCode, 20),
      layer: str(u.layer, 40),
      outcome: str(u.outcome, 40),
    };
  }
  return { ok: true, request: { messages, ui } };
}

const DEFAULT_ORIGINS = [
  "https://tinytownsatlas.github.io",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
];

export function allowedOrigins(env: { ALLOWED_ORIGINS?: string }): string[] {
  return env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_ORIGINS;
}
