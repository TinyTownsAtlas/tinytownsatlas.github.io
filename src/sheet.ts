/**
 * Mobile town-profile bottom sheet: two snap points (peek, expanded), driven by touch drag or tap.
 *
 * State lives in `body.panel-expanded` (CSS positions the sheet from it). While a finger is down the
 * sheet follows it through an inline transform; on release the inline style is removed and the CSS
 * transition animates to the chosen snap point. Touch events (not pointer events) are used because
 * they allow preventDefault mid-gesture, which is what keeps iOS Safari from scrolling or
 * rubber-banding the page and keeps the map from receiving the gesture.
 */

/** Below this width the panel is a bottom sheet (must match the CSS media query). */
export const SHEET_MEDIA_QUERY = "(max-width: 700px)";

const TAP_SLOP_PX = 8;
const FLICK_VELOCITY_PX_PER_MS = 0.35;

/**
 * Decide the snap point on release. `offset` is the sheet's distance below fully expanded
 * (0 = expanded, `peekOffset` = peek). A fast flick wins; otherwise the nearer snap point.
 */
export function resolveSnap(offset: number, peekOffset: number, velocityPxPerMs: number): "expanded" | "peek" {
  if (Math.abs(velocityPxPerMs) >= FLICK_VELOCITY_PX_PER_MS) return velocityPxPerMs < 0 ? "expanded" : "peek";
  return offset < peekOffset / 2 ? "expanded" : "peek";
}

export interface SheetElements {
  panel: HTMLElement;
  handle: HTMLElement;
  /** The scrolling region inside the sheet. */
  content: HTMLElement;
}

export function initSheet({ panel, handle, content }: SheetElements): { setExpanded: (expanded: boolean) => void } {
  const mobile = window.matchMedia(SHEET_MEDIA_QUERY);
  const isExpanded = () => document.body.classList.contains("panel-expanded");

  function setExpanded(expanded: boolean): void {
    document.body.classList.toggle("panel-expanded", expanded);
    // The peek strip must always show the town name, not wherever the content was scrolled to.
    if (!expanded) content.scrollTop = 0;
    handle.setAttribute("aria-expanded", String(expanded));
  }

  // --- tap / keyboard toggle ---
  let suppressClickUntil = 0;
  handle.addEventListener("click", () => {
    if (performance.now() < suppressClickUntil) return;
    setExpanded(!isExpanded());
  });

  // --- drag ---
  type Mode = "pending" | "sheet" | "scroll";
  let mode: Mode | null = null;
  let startY = 0;
  let startOffset = 0;
  let peekOffset = 0;
  let lastY = 0;
  let lastT = 0;
  let velocity = 0;
  let fromHandle = false;
  let currentOffset = 0;

  function measurePeekOffset(): number {
    // Same as the CSS peek transform: sheet height minus the visible peek strip.
    const visible = parseFloat(getComputedStyle(panel).getPropertyValue("--sheet-peek")) || 96;
    return Math.max(0, panel.offsetHeight - visible);
  }

  function onTouchStart(e: TouchEvent): void {
    if (!mobile.matches || e.touches.length !== 1 || (e.target as Element).closest("select, input, a, summary, #panel-close")) {
      mode = null;
      return;
    }
    const y = e.touches[0].clientY;
    mode = "pending";
    startY = lastY = y;
    lastT = e.timeStamp;
    velocity = 0;
    peekOffset = measurePeekOffset();
    startOffset = isExpanded() ? 0 : peekOffset;
    currentOffset = startOffset;
    fromHandle = handle.contains(e.target as Node);
  }

  function onTouchMove(e: TouchEvent): void {
    if (mode === null || mode === "scroll") return;
    const y = e.touches[0].clientY;
    const dy = y - startY;

    if (mode === "pending") {
      if (Math.abs(dy) < TAP_SLOP_PX) return;
      const expanded = isExpanded();
      // Expanded: the content scrolls normally, except a downward pull from scrollTop 0 moves the sheet.
      // Peek (or grabbing the handle): every vertical drag moves the sheet.
      const pullsSheet = !expanded || fromHandle || (content.scrollTop <= 0 && dy > 0);
      if (!pullsSheet) {
        mode = "scroll";
        return;
      }
      mode = "sheet";
      startY = y; // the sheet follows the finger from here, so it does not jump by the slop distance
      lastY = y;
      lastT = e.timeStamp;
      panel.classList.add("sheet-dragging");
      return;
    }

    // mode === "sheet"
    if (e.cancelable) e.preventDefault();
    const dt = e.timeStamp - lastT;
    if (dt > 0) velocity = 0.8 * velocity + 0.2 * ((y - lastY) / dt);
    lastY = y;
    lastT = e.timeStamp;
    currentOffset = Math.min(peekOffset, Math.max(0, startOffset + (y - startY)));
    panel.style.transform = `translateY(${currentOffset}px)`;
  }

  function onTouchEnd(e: TouchEvent): void {
    const wasSheet = mode === "sheet";
    mode = null;
    if (!wasSheet) return;
    suppressClickUntil = performance.now() + 400;
    panel.classList.remove("sheet-dragging");
    const snap = e.type === "touchcancel" ? (isExpanded() ? "expanded" : "peek") : resolveSnap(currentOffset, peekOffset, velocity);
    panel.style.removeProperty("transform");
    setExpanded(snap === "expanded");
  }

  panel.addEventListener("touchstart", onTouchStart, { passive: true });
  panel.addEventListener("touchmove", onTouchMove, { passive: false });
  panel.addEventListener("touchend", onTouchEnd);
  panel.addEventListener("touchcancel", onTouchEnd);

  // Leaving the mobile layout (rotate/resize) must not leave a stale inline transform behind.
  mobile.addEventListener("change", () => {
    panel.style.removeProperty("transform");
    panel.classList.remove("sheet-dragging");
    mode = null;
  });

  return { setExpanded };
}
