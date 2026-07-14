export class CanvasElementIndex {
  readonly _elements: Map<string, SVGElement>;

  constructor(elements: Map<string, SVGElement>) {
    this._elements = elements;
  }

  raise(id: string): void {
    const el = this._elements.get(id);
    if (!el?.parentElement) return;
    const sibling = el.nextElementSibling?.nextElementSibling ?? null;
    el.parentElement.insertBefore(el, sibling);
  }

  lower(id: string): void {
    const el = this._elements.get(id);
    if (!el?.parentElement || !el.previousElementSibling) return;
    el.parentElement.insertBefore(el, el.previousElementSibling);
  }

  raiseToTop(id: string): void {
    const el = this._elements.get(id);
    if (!el?.parentElement) return;
    el.parentElement.appendChild(el);
  }

  lowerToBottom(id: string): void {
    const el = this._elements.get(id);
    if (!el?.parentElement?.firstChild) return;
    el.parentElement.insertBefore(el, el.parentElement.firstChild);
  }

  insertBefore(id: string, referenceId: string): void {
    const el = this._elements.get(id);
    const ref = this._elements.get(referenceId);
    if (!el?.parentElement || !ref || el === ref) return;
    el.parentElement.insertBefore(el, ref);
  }

  getIndex(id: string): number {
    const el = this._elements.get(id);
    if (!el?.parentElement) return -1;
    return Array.from(el.parentElement.children).indexOf(el);
  }
}
