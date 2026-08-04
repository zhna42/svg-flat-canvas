import type { SvgCanvas } from '@/canvas/SvgCanvas';
import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import { guardEditMode } from './helpers';
import { UseElement } from '@/core/shapes/elements/UseElement';
import { MM_TO_PX } from '@/constants';

let _idCounter = 0;

export class ClipboardController {
  constructor(private canvas: SvgCanvas) {}

  private _generateId(): string {
    return crypto.randomUUID?.() ?? `shape_${Date.now()}_${++_idCounter}`;
  }

  private _resolveRootElement(
    id: string,
  ): AbstractGraphicElement | undefined {
    const el = this.canvas.shapeManager.getById(id);
    if (!el) return undefined;
    if (el instanceof UseElement && el._parentElement) {
      return this._resolveRootElement(el._parentElement.id);
    }
    return el;
  }

  duplicateSelected(dx = 50, dy = 50): AbstractGraphicElement[] {
    if (!guardEditMode(this.canvas)) return [];
    const selected = this.canvas.selectionState.selected;
    if (selected.length === 0) return [];

    const clones: AbstractGraphicElement[] = [];

    for (const original of selected) {
      const resolved =
        original instanceof UseElement && original._parentElement
          ? this._resolveRootElement(original.id)!
          : original;

      const clone = resolved.clone();
      clone.id = this._generateId();
      clone.name = resolved.name;

      clone.transform.matrix.e += dx;
      clone.transform.matrix.f += dy;

      clone.setVisible(resolved.visible);
      clone.lock = resolved.lock;
      clone.rebuildHitArea();
      clone.clearTimeMachineDiff();
      clone.data = { ...clone.data, isCopy: true };

      this.canvas.elementManager.addShape(clone);
      clones.push(clone);
    }

    this.canvas.selectionState.replace(clones);
    this.canvas.selectionManager.setElementSelection(
      clones.map((c) => c.id),
      (id) => this.canvas.shapeManager.getById(id),
    );

    this.canvas.timeMachine.push(
      'CREATE',
      clones.map((c) => c.id),
      'element',
      [],
      clones,
    );

    this.canvas.events.emit('COPY', {
      ids: clones.map((c) => c.id),
      dx,
      dy,
    });

    return clones;
  }

  useDuplicateSelected(dx = 50, dy = 50): UseElement[] {
    if (!guardEditMode(this.canvas)) return [];
    const selected = this.canvas.selectionState.selected;
    if (selected.length === 0) return [];

    const useElements: UseElement[] = [];

    for (const original of selected) {
      const root = this._resolveRootElement(original.id);
      if (!root) continue;

      const useEl = new UseElement(this._generateId());
      useEl.style.opacity = 0.25;
      useEl.transform.matrix = new DOMMatrix().translateSelf(dx, dy);
      useEl.bindToParent(root);
      useEl.clearTimeMachineDiff();
      useEl.data = { ...useEl.data, isCopy: true };

      root.data = { ...root.data, hasCopies: true };

      this.canvas.elementManager.addShape(useEl);
      useElements.push(useEl);
    }

    this.canvas.selectionState.replace(useElements);
    this.canvas.selectionManager.setElementSelection(
      useElements.map((u) => u.id),
      (id) => this.canvas.shapeManager.getById(id),
    );

    this.canvas.timeMachine.push(
      'CREATE',
      useElements.map((u) => u.id),
      'element',
      [],
      useElements,
    );

    this.canvas.events.emit('USE_DUPLICATE', {
      ids: useElements.map((u) => u.id),
      dx,
      dy,
    });

    return useElements;
  }

  unbindUseElement(useId: string): AbstractGraphicElement | null {
    if (!guardEditMode(this.canvas)) return null;
    const el = this.canvas.shapeManager.getById(useId);
    if (!el || !(el instanceof UseElement)) return null;

    const parentId = el.refId;
    const clone = el.unobind();
    if (!clone) return null;

    clone.data = { ...clone.data, isCopy: false };

    this.canvas.elementManager.deleteElements([useId]);
    this.canvas.elementManager.addShape(clone);

    if (parentId) {
      const remainingUses = this.getUseChildIds(parentId);
      if (remainingUses.length === 0) {
        const parent = this.canvas.shapeManager.getById(parentId);
        if (parent) {
          parent.data = { ...parent.data, hasCopies: false };
        }
      }
    }

    this.canvas.selectionState.replace([clone]);
    this.canvas.selectionManager.setElementSelection([clone.id], (id) =>
      this.canvas.shapeManager.getById(id),
    );

    this.canvas.timeMachine.push(
      'CREATE',
      [clone.id],
      'element',
      [el.id],
      [clone],
    );

    this.canvas.events.emit('UNBIND', {
      id: clone.id,
      useId,
      parentId: parentId ?? null,
    });

    return clone;
  }

  setUseOpacity(useId: string, opacity: 0 | 0.25 | 1): void {
    const el = this.canvas.shapeManager.getById(useId);
    if (!el || !(el instanceof UseElement)) return;
    el.setDiff({ 'style.opacity': opacity } as Record<string, number | string>);
    const raw = el as unknown as Record<string, unknown>;
    raw._diffRendering = {
      ...((raw._diffRendering as Record<string, unknown>) || {}),
      'style.opacity': opacity,
    };
    el.pushDiffRendering?.(el);
  }

  isUseElement(id: string): boolean {
    const el = this.canvas.shapeManager.getById(id);
    return el instanceof UseElement;
  }

  getUseParentId(id: string): string | null {
    const el = this.canvas.shapeManager.getById(id);
    if (!el || !(el instanceof UseElement)) return null;
    return el.refId || null;
  }

  getUseChildIds(parentId: string): string[] {
    const all = this.canvas.shapeManager.getAll();
    return all
      .filter((el) => el instanceof UseElement && el.refId === parentId)
      .map((el) => el.id);
  }

  unbindAllUseReferences(parentId: string): AbstractGraphicElement[] {
    if (!guardEditMode(this.canvas)) return [];
    const useIds = this.getUseChildIds(parentId);
    if (useIds.length === 0) return [];

    const clones: AbstractGraphicElement[] = [];

    for (const useId of useIds) {
      const clone = this.unbindUseElement(useId);
      if (clone) clones.push(clone);
    }

    if (clones.length > 0) {
      this.canvas.selectionState.replace(clones);
      this.canvas.selectionManager.setElementSelection(
        clones.map((c) => c.id),
        (id) => this.canvas.shapeManager.getById(id),
      );
    }

    this.canvas.events.emit('UNBIND_ALL', {
      ids: clones.map((c) => c.id),
      parentId,
    });

    return clones;
  }

  _mmToPx(): number {
    return MM_TO_PX;
  }

  _deferredCreateTimer?: ReturnType<typeof setTimeout>;
  _deferredUuid = '';
}
