/**
 * InputHandler listens to and filters keyboard events (input sanitization).
 *
 * It is critical that shortcuts do not fire while the user is typing in a
 * comment/search box. For that reason, the event target and focused element are
 * ignored when they are form fields or contentEditable. Events are listened to
 * during the capture phase, so they pass through this filter before the website
 * can run its own shortcuts.
 */
type Dispatcher = (key: string, event: KeyboardEvent) => void;

export class InputHandler {
  private readonly dispatcher: Dispatcher;
  private readonly handler: (e: KeyboardEvent) => void;
  private attached = false;

  constructor(dispatcher: Dispatcher) {
    this.dispatcher = dispatcher;
    this.handler = this.onKeyDown.bind(this);
  }

  attach(): void {
    if (this.attached) return;
    window.addEventListener("keydown", this.handler, true);
    this.attached = true;
  }

  detach(): void {
    if (!this.attached) return;
    window.removeEventListener("keydown", this.handler, true);
    this.attached = false;
  }

  /** Rules 1 & 2: is the user typing in a form field or editable content? */
  private isTyping(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (target.isContentEditable) return true;
    return false;
  }

  private onKeyDown(event: KeyboardEvent): void {
    // Leave browser/OS shortcuts alone, such as Ctrl+C or Cmd+L.
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    // Rules 1 & 2: check both the event target and the focused element.
    if (this.isTyping(event.target) || this.isTyping(document.activeElement)) {
      return;
    }

    this.dispatcher(event.key, event);
  }
}
