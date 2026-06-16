import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { CommandBus } from '@/commands/CommandBus';
import type { Camera } from '@/camera/Camera';
import { SvgSnap } from '@/snap/SvgSnap';
import { createDragEndCommand } from '@/commands/factories/drag-command-factory';

export class DragHandler {
  private _active = false;
  private snapEnabled = false;
  private snapToArtboard = false;
  private startWorld = { x: 0, y: 0 };
  private targets: AbstractGraphicElement[] = [];
  private startMatrices = new Map<string, DOMMatrix>();
  private bus: CommandBus;
  private snap = new SvgSnap();
  private camera: Camera;
  private getElements: () => AbstractGraphicElement[];
  private getArtboardRect: () => {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;

  public onDragStart: (() => void) | null = null;
  public onDragMove: (() => void) | null = null;
  public onDragEnd: (() => void) | null = null;

  public constructor(
    bus: CommandBus,
    camera: Camera,
    getElements: () => AbstractGraphicElement[],
    getArtboardRect: () => {
      x: number;
      y: number;
      width: number;
      height: number;
    } | null,
  ) {
    this.bus = bus;
    this.camera = camera;
    this.getElements = getElements;
    this.getArtboardRect = getArtboardRect;
  }

  public setSnapEnabled(enabled: boolean): void {
    this.snapEnabled = enabled;
  }

  public setSnapToArtboard(enabled: boolean): void {
    this.snapToArtboard = enabled;
  }

  public get isActive(): boolean {
    return this._active;
  }

  public get targetIds(): string[] {
    return this.targets.map((e) => e.id);
  }

  public tryStart(
    worldPoint: { x: number; y: number },
    currentSelected: readonly AbstractGraphicElement[],
  ): boolean {
    if (currentSelected.length === 0) return false;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
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
      worldPoint.x < minX - pad ||
      worldPoint.x > maxX + pad ||
      worldPoint.y < minY - pad ||
      worldPoint.y > maxY + pad
    ) {
      return false;
    }

    this.startWithoutCheck(worldPoint, currentSelected);
    return true;
  }

  public startWithoutCheck(
    worldPoint: { x: number; y: number },
    currentSelected: readonly AbstractGraphicElement[],
  ): void {
    if (currentSelected.length === 0) return;
    this._active = true;
    this.startWorld = { x: worldPoint.x, y: worldPoint.y };
    this.targets = Array.from(currentSelected);
    this.startMatrices.clear();
    for (const el of currentSelected) {
      this.startMatrices.set(
        el.id,
        new DOMMatrix(el.transform.matrix.toString()),
      );
    }
    this.snap.reset();
    this.onDragStart?.();
  }

  public move(worldPoint: { x: number; y: number }): void {
    if (!this._active) return;

    let dx = worldPoint.x - this.startWorld.x;
    let dy = worldPoint.y - this.startWorld.y;

    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

    if (this.snapEnabled) {
      const movingBBox = this.getMovingScreenBBox();
      if (movingBBox) {
        const movingRect = new DOMRect(
          movingBBox.x + dx * this.camera.zoom,
          movingBBox.y + dy * this.camera.zoom,
          movingBBox.width,
          movingBBox.height,
        );

        const targetRects: DOMRect[] = [];
        const selectedIds = new Set(this.targets.map((t) => t.id));
        for (const el of this.getElements()) {
          if (selectedIds.has(el.id)) continue;
          const bbox = el.getWorldBBox();
          if (bbox.width === 0 && bbox.height === 0) continue;
          const screen = this.camera.worldRectToScreen(bbox);
          targetRects.push(
            new DOMRect(screen.x, screen.y, screen.width, screen.height),
          );
        }

        let listRect: DOMRect | undefined;
        if (this.snapToArtboard) {
          const artboard = this.getArtboardRect();
          if (artboard) {
            const screen = this.camera.worldRectToScreen(artboard);
            listRect = new DOMRect(
              screen.x,
              screen.y,
              screen.width,
              screen.height,
            );
          }
        }

        const result = this.snap.computeCorrection(movingRect, {
          targetRects,
          listRect,
        });

        this.snap.updatePull(
          dx * this.camera.zoom -
            (result.correctionX - ((this as any)._lastSnapCorrectionX ?? 0)),
          dy * this.camera.zoom -
            (result.correctionY - ((this as any)._lastSnapCorrectionY ?? 0)),
        );
        (this as any)._lastSnapCorrectionX = result.correctionX;
        (this as any)._lastSnapCorrectionY = result.correctionY;

        dx += result.correctionX / this.camera.zoom;
        dy += result.correctionY / this.camera.zoom;
      }
    }

    for (const el of this.targets) {
      const start = this.startMatrices.get(el.id);
      if (!start) continue;
      const m = new DOMMatrix(start.toString());
      m.e += dx;
      m.f += dy;
      el.transform.matrix = m;
      el.invalidateHitArea();
    }

    this.onDragMove?.();
  }

  public end(): void {
    if (!this._active) return;
    this._active = false;

    const ids = this.targets.map((e) => e.id);
    const cmd = createDragEndCommand(ids);
    this.bus.execute(cmd);

    this.targets = [];
    this.startMatrices.clear();
    this.snap.reset();
    (this as any)._lastSnapCorrectionX = 0;
    (this as any)._lastSnapCorrectionY = 0;
    this.onDragEnd?.();
  }

  public abort(): void {
    if (!this._active) return;
    this._active = false;
    this.targets = [];
    this.startMatrices.clear();
    this.snap.reset();
  }

  private getMovingScreenBBox(): {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    let hasAny = false;
    for (const el of this.targets) {
      const bbox = el.getWorldBBox();
      if (bbox.width === 0 && bbox.height === 0) continue;
      hasAny = true;
      if (bbox.x < minX) minX = bbox.x;
      if (bbox.y < minY) minY = bbox.y;
      if (bbox.x + bbox.width > maxX) maxX = bbox.x + bbox.width;
      if (bbox.y + bbox.height > maxY) maxY = bbox.y + bbox.height;
    }
    if (!hasAny) return null;
    return this.camera.worldRectToScreen({
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    });
  }
}
