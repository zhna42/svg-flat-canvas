import type { SvgElement } from '@/shapes/elements/SvgElement';
import type { CommandBus } from '@/commands/CommandBus';
import { createDragMoveCommand, createDragEndCommand } from '@/commands/factories/drag-command-factory';

export class DragHandler {
  private _active = false;
  private prevWorld = { x: 0, y: 0 };
  private targets: SvgElement[] = [];
  private bus: CommandBus;

  public onDragStart: (() => void) | null = null;
  public onDragMove: (() => void) | null = null;
  public onDragEnd: (() => void) | null = null;

  public constructor(bus: CommandBus) {
    this.bus = bus;
  }

  public get isActive(): boolean {
    return this._active;
  }

  public get targetIds(): string[] {
    return this.targets.map((e) => e.id);
  }

  public tryStart(
    worldPoint: { x: number; y: number },
    currentSelected: readonly SvgElement[],
  ): boolean {
    if (currentSelected.length === 0) return false;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of currentSelected) {
      const bbox = el.getTransformedBBox();
      if (bbox.width === 0 && bbox.height === 0) continue;
      if (bbox.x < minX) minX = bbox.x;
      if (bbox.y < minY) minY = bbox.y;
      if (bbox.x + bbox.width > maxX) maxX = bbox.x + bbox.width;
      if (bbox.y + bbox.height > maxY) maxY = bbox.y + bbox.height;
    }
    if (!isFinite(minX)) return false;

    const pad = Math.max((maxX - minX) * 0.25, (maxY - minY) * 0.25, 10);
    if (
      worldPoint.x < minX - pad || worldPoint.x > maxX + pad ||
      worldPoint.y < minY - pad || worldPoint.y > maxY + pad
    ) {
      return false;
    }

    this.startWithoutCheck(worldPoint, currentSelected);
    return true;
  }

  public startWithoutCheck(
    worldPoint: { x: number; y: number },
    currentSelected: readonly SvgElement[],
  ): void {
    if (currentSelected.length === 0) return;
    this._active = true;
    this.prevWorld = { ...worldPoint };
    this.targets = Array.from(currentSelected);
    this.onDragStart?.();
  }

  public move(worldPoint: { x: number; y: number }): void {
    if (!this._active) return;
    const dx = worldPoint.x - this.prevWorld.x;
    const dy = worldPoint.y - this.prevWorld.y;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    const ids = this.targets.map((e) => e.id);
    const cmd = createDragMoveCommand('element', { x: dx, y: dy }, ids);
    this.bus.execute(cmd);

    this.prevWorld = { ...worldPoint };
    this.onDragMove?.();
  }

  public end(): void {
    if (!this._active) return;
    this._active = false;

    const ids = this.targets.map((e) => e.id);
    const cmd = createDragEndCommand(ids);
    this.bus.execute(cmd);

    this.targets = [];
    this.onDragEnd?.();
  }

  public abort(): void {
    if (!this._active) return;
    this._active = false;
    this.targets = [];
  }
}
