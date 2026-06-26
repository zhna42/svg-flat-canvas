import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { CommandBus } from '@/commands/CommandBus';
import type { Camera } from '@/camera/Camera';
import type { SpatialGrid } from '@/spatial/SpatialGrid';
import { createDragEndCommand } from '@/commands/factories/drag-command-factory';
import { DragSnapHelper, type SnapAxisMode } from '@/selection/drag/DragSnap';
import { checkSceneCollisions } from '@/selection/drag/DragCollision';

export class DragHandler {
  private _active = false;
  private snapToCorners = false;
  private snapToPlanes = false;
  private snapToArtboard = false;
  private avoidCollisions = false;
  private lastMouseWorld = { x: 0, y: 0 };
  private currentDx = 0;
  private currentDy = 0;
  private targets: AbstractGraphicElement[] = [];
  private startMatrices = new Map<string, DOMMatrix>();
  private _mode = 'element';
  private bus: CommandBus;
  private dragSnap: DragSnapHelper;
  private camera: Camera;
  private grid: SpatialGrid;
  private getElements: () => AbstractGraphicElement[];

  public onDragStart: (() => void) | null = null;
  public onDragMove: ((dx: number, dy: number) => void) | null = null;
  public onDragEnd: (() => void) | null = null;

  public constructor(
    bus: CommandBus,
    camera: Camera,
    grid: SpatialGrid,
    getElements: () => AbstractGraphicElement[],
    getArtboardRect: () => {
      x: number;
      y: number;
      width: number;
      height: number;
    } | null,
    getGuidelines: () => Array<{
      orientation: 'v' | 'h';
      position: number;
    }>,
    getGridLines: () => Array<{
      orientation: 'v' | 'h';
      position: number;
    }>,
  ) {
    this.bus = bus;
    this.camera = camera;
    this.grid = grid;
    this.getElements = getElements;
    this.dragSnap = new DragSnapHelper(
      camera,
      getElements,
      getArtboardRect,
      getGuidelines,
      getGridLines,
    );
  }

  public setMode(mode: string): void {
    this._mode = mode;
  }

  public setAvoidCollisions(enabled: boolean): void {
    this.avoidCollisions = enabled;
  }

  public setSnapToCorners(enabled: boolean): void {
    this.snapToCorners = enabled;
  }

  public setSnapToPlanes(enabled: boolean): void {
    this.snapToPlanes = enabled;
  }

  public setSnapToArtboard(enabled: boolean): void {
    this.snapToArtboard = enabled;
  }

  public setSnapToGuidelines(enabled: boolean): void {
    this.dragSnap.snapToGuidelines = enabled;
  }

  public setSnapToGrid(enabled: boolean): void {
    this.dragSnap.snapToGrid = enabled;
  }

  public setSnapAxis(mode: SnapAxisMode): void {
    this.dragSnap.snapAxis = mode;
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

    this._active = true;
    this.lastMouseWorld = { x: worldPoint.x, y: worldPoint.y };
    this.currentDx = 0;
    this.currentDy = 0;
    this.targets = Array.from(currentSelected);
    this._mode = 'element';
    this.startMatrices.clear();
    for (const el of currentSelected) {
      this.startMatrices.set(
        el.id,
        new DOMMatrix(el.transform.matrix.toString()),
      );
    }

    if (
      this.snapToCorners ||
      this.snapToPlanes ||
      this.dragSnap.snapToGuidelines ||
      this.dragSnap.snapToGrid
    ) {
      this.dragSnap.buildTargets(
        this.targets,
        this.snapToArtboard,
        this.snapToCorners,
        this.snapToPlanes,
      );
    }

    this.onDragStart?.();
    return true;
  }

  public startWithoutCheck(
    worldPoint: { x: number; y: number },
    currentSelected: readonly AbstractGraphicElement[],
  ): void {
    if (currentSelected.length === 0) return;
    this._active = true;
    this.lastMouseWorld = { x: worldPoint.x, y: worldPoint.y };
    this.currentDx = 0;
    this.currentDy = 0;
    this.targets = Array.from(currentSelected);
    this.startMatrices.clear();
    for (const el of currentSelected) {
      this.startMatrices.set(
        el.id,
        new DOMMatrix(el.transform.matrix.toString()),
      );
    }

    if (
      this.snapToCorners ||
      this.snapToPlanes ||
      this.dragSnap.snapToGuidelines ||
      this.dragSnap.snapToGrid
    ) {
      this.dragSnap.buildTargets(
        this.targets,
        this.snapToArtboard,
        this.snapToCorners,
        this.snapToPlanes,
      );
    } else {
      this.dragSnap.reset();
    }

    this.onDragStart?.();
  }

  public move(worldPoint: { x: number; y: number }): void {
    if (!this._active) return;

    const frameDx = worldPoint.x - this.lastMouseWorld.x;
    const frameDy = worldPoint.y - this.lastMouseWorld.y;
    this.lastMouseWorld = { x: worldPoint.x, y: worldPoint.y };

    if (Math.abs(frameDx) < 0.1 && Math.abs(frameDy) < 0.1) return;

    let currentFrameDx = frameDx;
    let currentFrameDy = frameDy;

    if (this.snapToCorners || this.snapToPlanes) {
      const snapResult = this.dragSnap.computeCorrection(
        this.targets,
        this.startMatrices,
        this.currentDx,
        this.currentDy,
        frameDx,
        frameDy,
      );

      currentFrameDx += snapResult.correctionX / this.camera.zoom;
      currentFrameDy += snapResult.correctionY / this.camera.zoom;
    }

    if (this.avoidCollisions) {
      let nextDx = this.currentDx + currentFrameDx;
      let nextDy = this.currentDy + currentFrameDy;

      const collisionNormal = checkSceneCollisions(
        this.targets,
        this.startMatrices,
        nextDx,
        nextDy,
        this.camera,
        this.grid,
        this.getElements,
      );

      if (collisionNormal) {
        const dotProduct =
          currentFrameDx * collisionNormal.x +
          currentFrameDy * collisionNormal.y;

        if (dotProduct < 0) {
          currentFrameDx -= dotProduct * collisionNormal.x;
          currentFrameDy -= dotProduct * collisionNormal.y;
        }

        nextDx = this.currentDx + currentFrameDx;
        nextDy = this.currentDy + currentFrameDy;

        if (
          !checkSceneCollisions(
            this.targets,
            this.startMatrices,
            nextDx,
            nextDy,
            this.camera,
            this.grid,
            this.getElements,
          )
        ) {
          this.currentDx = nextDx;
          this.currentDy = nextDy;
        } else {
          const testXDx = this.currentDx + currentFrameDx;
          const testYDy = this.currentDy + currentFrameDy;

          if (
            !checkSceneCollisions(
              this.targets,
              this.startMatrices,
              testXDx,
              this.currentDy,
              this.camera,
              this.grid,
              this.getElements,
            )
          ) {
            this.currentDx = testXDx;
          } else if (
            !checkSceneCollisions(
              this.targets,
              this.startMatrices,
              this.currentDx,
              testYDy,
              this.camera,
              this.grid,
              this.getElements,
            )
          ) {
            this.currentDy = testYDy;
          }
        }
      } else {
        this.currentDx = nextDx;
        this.currentDy = nextDy;
      }
    } else {
      this.currentDx += currentFrameDx;
      this.currentDy += currentFrameDy;
    }

    for (const el of this.targets) {
      const start = this.startMatrices.get(el.id);
      if (!start) continue;
      const m = new DOMMatrix(start.toString());
      m.e += this.currentDx;
      m.f += this.currentDy;
      el.transform.matrix = m;
      el.markRenderKey('matrix');
      el.setDirtyTransform();
    }

    this.onDragMove?.(this.currentDx, this.currentDy);
  }

  public end(): void {
    if (!this._active) return;
    this._active = false;

    if (this.currentDx === 0 && this.currentDy === 0) {
      this.targets = [];
      this.startMatrices.clear();
      this.dragSnap.reset();
      this.onDragEnd?.();
      return;
    }

    for (const el of this.targets) {
      el.rebuildHitArea();
      el.setDirtyAll();
    }

    const ids = this.targets.map((e) => e.id);
    const cmd = createDragEndCommand(ids);
    (cmd as any).options.mode = this._mode;
    this.bus.execute(cmd);

    this.targets = [];
    this.startMatrices.clear();
    this.dragSnap.reset();
    this.onDragEnd?.();
  }

  public abort(): void {
    if (!this._active) return;
    this._active = false;
    this.targets = [];
    this.startMatrices.clear();
    this.dragSnap.reset();
  }
}
