import { parseAnswer, type Inline } from "./assistant-text";

export interface AssistantContext {
  uclCode: string | null;
  layer: string;
  outcome: string;
}

export interface AssistantOptions {
  /** Worker endpoint (POST). Empty disables the assistant and hides its button. */
  url: string;
  getContext: () => AssistantContext;
  /** Called with the query string of an Atlas link the user clicked inside an answer. */
  onNavigate: (search: string) => void;
  /** True when a mobile layout (full-screen chat) is active. */
  isMobile: () => boolean;
}

interface Turn {
  role: "user" | "assistant";
  content: string;
}

const MAX_HISTORY = 8;
const REQUEST_TIMEOUT_MS = 35_000;

const STARTERS: Array<{ label: string; question: string; needsTown?: boolean }> = [
  { label: "Tell me about this town", question: "Tell me about this town.", needsTown: true },
  { label: "Compare two towns", question: "Compare Brewarrina and Wilcannia." },
  { label: "Where is asthma highest?", question: "Which towns have the highest Census-reported asthma?" },
  { label: "Explain hospital admissions", question: "What do the hospital admissions figures mean?" },
  { label: "Find towns like this one", question: "Find towns like this one, with similar population and remoteness.", needsTown: true },
];

function renderInline(parent: HTMLElement, inline: Inline[], opts: AssistantOptions, close: () => void): void {
  for (const part of inline) {
    if (part.kind === "text") {
      parent.append(part.text);
    } else if (part.kind === "bold") {
      const b = document.createElement("strong");
      b.textContent = part.text;
      parent.append(b);
    } else {
      const a = document.createElement("a");
      a.textContent = part.text;
      a.href = part.href;
      a.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        const url = new URL(part.href);
        if (url.search) {
          e.preventDefault();
          opts.onNavigate(url.search);
          if (opts.isMobile()) close(); // reveal the map and town sheet behind the full-screen chat
        }
      });
      parent.append(a);
    }
  }
}

export function initAssistant(opts: AssistantOptions): void {
  const openButton = document.getElementById("ask-open") as HTMLButtonElement | null;
  const dialog = document.getElementById("ask") as HTMLElement | null;
  if (!openButton || !dialog) return;
  if (!opts.url) {
    openButton.hidden = true;
    return;
  }
  const log = document.getElementById("ask-log") as HTMLElement;
  const starters = document.getElementById("ask-starters") as HTMLElement;
  const form = document.getElementById("ask-form") as HTMLFormElement;
  const input = document.getElementById("ask-input") as HTMLInputElement;
  const send = document.getElementById("ask-send") as HTMLButtonElement;
  const closeButton = document.getElementById("ask-close") as HTMLButtonElement;

  const history: Turn[] = [];
  let busy = false;

  const close = () => {
    if (dialog.hidden) return;
    dialog.hidden = true;
    document.body.classList.remove("ask-open");
    openButton.setAttribute("aria-expanded", "false");
    openButton.focus();
  };
  const open = () => {
    dialog.hidden = false;
    document.body.classList.add("ask-open");
    openButton.setAttribute("aria-expanded", "true");
    renderStarters();
    input.focus();
  };

  function renderStarters(): void {
    starters.replaceChildren();
    if (history.length) return;
    const hasTown = !!opts.getContext().uclCode;
    for (const s of STARTERS) {
      if (s.needsTown && !hasTown) continue;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "ask-chip";
      chip.textContent = s.label;
      chip.addEventListener("click", () => void ask(s.question));
      starters.append(chip);
    }
  }

  function addBubble(role: "user" | "assistant" | "error", text: string): HTMLElement {
    const bubble = document.createElement("div");
    bubble.className = `ask-msg ask-${role}`;
    if (role === "assistant") {
      for (const block of parseAnswer(text, window.location.hostname)) {
        if (block.kind === "p") {
          const p = document.createElement("p");
          renderInline(p, block.inline, opts, close);
          bubble.append(p);
        } else {
          const ul = document.createElement("ul");
          for (const item of block.items) {
            const li = document.createElement("li");
            renderInline(li, item, opts, close);
            ul.append(li);
          }
          bubble.append(ul);
        }
      }
    } else {
      bubble.textContent = text;
    }
    log.append(bubble);
    log.scrollTop = log.scrollHeight;
    return bubble;
  }

  async function ask(question: string): Promise<void> {
    const text = question.trim();
    if (!text || busy) return;
    busy = true;
    send.disabled = true;
    input.value = "";
    starters.replaceChildren();
    addBubble("user", text);
    history.push({ role: "user", content: text });
    const pending = addBubble("assistant", "");
    pending.classList.add("ask-pending");
    pending.textContent = "Looking at the Atlas data…";
    const ctx = opts.getContext();
    try {
      const res = await fetch(opts.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: history.slice(-MAX_HISTORY),
          ui: { uclCode: ctx.uclCode, layer: ctx.layer, outcome: ctx.outcome },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
      pending.remove();
      if (!res.ok || !data.reply) {
        history.pop();
        addBubble("error", data.error ?? "The assistant could not answer just now. Please try again.");
      } else {
        history.push({ role: "assistant", content: data.reply });
        addBubble("assistant", data.reply);
      }
    } catch {
      pending.remove();
      history.pop();
      addBubble("error", "Could not reach the assistant. Check your connection and try again.");
    } finally {
      busy = false;
      send.disabled = false;
      input.focus();
    }
  }

  openButton.addEventListener("click", () => (dialog.hidden ? open() : close()));
  closeButton.addEventListener("click", close);
  dialog.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    void ask(input.value);
  });
}
