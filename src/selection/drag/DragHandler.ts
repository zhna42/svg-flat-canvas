import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { CommandBus } from '@/commands/CommandBus';
import type { Camera } from '@/canvas/Camera';
import type { SpatialGrid } from '@/math/spatial/SpatialGrid';
import { createDragEndCommand } from '@/commands/factories/drag-command-factory';
import { DragSnapHelper } from '@/selection/drag/DragSnap';
import type { SnapAxisMode } from '@/types';
import { checkSceneCollisions } from '@/selection/drag/DragCollision';

const HOLD_DIST_SCREEN = 40;

interface SnapState {
  type: 'point' | 'line' | 'curve';
  dx: number;
  dy: number;
  lineStartX?: number;
  lineStartY?: number;
  lineEndX?: number;
  lineEndY?: number;
}

export class DragHandler {
  private _active = false;
  private snapToCorners = false;
  private snapToPlanes = false;
  private snapToArtboard = false;
  private avoidCollisions = false;
  private dragStartMouse = { x: 0, y: 0 };
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

  private snapState: SnapState | null = null;

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
    this.startCommon(worldPoint, currentSelected);
    return true;
  }

  public startWithoutCheck(
    worldPoint: { x: number; y: number },
    currentSelected: readonly AbstractGraphicElement[],
  ): void {
    if (currentSelected.length === 0) return;
    this.startCommon(worldPoint, currentSelected);
  }

  private startCommon(
    worldPoint: { x: number; y: number },
    currentSelected: readonly AbstractGraphicElement[],
  ): void {
    this._active = true;
    this.dragStartMouse = { x: worldPoint.x, y: worldPoint.y };
    this.lastMouseWorld = { x: worldPoint.x, y: worldPoint.y };
    this.currentDx = 0;
    this.currentDy = 0;
    this.snapState = null;
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

    const mouseDx = worldPoint.x - this.dragStartMouse.x;
    const mouseDy = worldPoint.y - this.dragStartMouse.y;

    let elemDx = mouseDx;
    let elemDy = mouseDy;
    let snapEngaged = false;

    const snapEnabled = this.snapToCorners || this.snapToPlanes;

    if (snapEnabled) {
      const snapResult = this.dragSnap.computeWorldSnap(
        this.targets,
        this.startMatrices,
        mouseDx,
        mouseDy,
        0,
        0,
      );

      if (this.snapState) {
        elemDx = this.snapState.dx;
        elemDy = this.snapState.dy;

        if (this.snapState.type === 'line' || this.snapState.type === 'curve') {
          const lx =
            (this.snapState.lineEndX ?? 0) - (this.snapState.lineStartX ?? 0);
          const ly =
            (this.snapState.lineEndY ?? 0) - (this.snapState.lineStartY ?? 0);
          const lineLen = Math.hypot(lx, ly);

          if (lineLen > 1e-6) {
            const dirX = lx / lineLen;
            const dirY = ly / lineLen;

            const mouseAlong =
              (mouseDx - elemDx) * dirX + (mouseDy - elemDy) * dirY;
            elemDx = elemDx + mouseAlong * dirX;
            elemDy = elemDy + mouseAlong * dirY;

            const perpX = mouseDx - elemDx - mouseAlong * dirX;
            const perpY = mouseDy - elemDy - mouseAlong * dirY;
            const perpDist = Math.hypot(perpX, perpY) * this.camera.zoom;

            if (perpDist > HOLD_DIST_SCREEN) {
              this.snapState = null;
            } else {
              snapEngaged = true;
            }
          } else {
            this.snapState = null;
          }
        } else {
          const gapX = (mouseDx - elemDx) * this.camera.zoom;
          const gapY = (mouseDy - elemDy) * this.camera.zoom;
          const gapDist = Math.hypot(gapX, gapY);

          if (gapDist > HOLD_DIST_SCREEN) {
            this.snapState = null;
          } else if (mouseDx * mouseDx + mouseDy * mouseDy > 0.01) {
            const mouseDotDrag =
              mouseDx * (elemDx - mouseDx) + mouseDy * (elemDy - mouseDy);
            if (mouseDotDrag > 0) {
              this.snapState = null;
            } else {
              snapEngaged = true;
            }
          } else {
            snapEngaged = true;
          }
        }
      }

      if (
        (!this.snapState && snapResult.screenDx !== 0) ||
        snapResult.screenDy !== 0
      ) {
        const newDx = mouseDx + snapResult.correctionDx;
        const newDy = mouseDy + snapResult.correctionDy;

        const correctionLen = Math.hypot(
          snapResult.screenDx,
          snapResult.screenDy,
        );
        if (correctionLen > 0.1) {
          this.snapState = {
            type: snapResult.type,
            dx: newDx,
            dy: newDy,
            lineStartX: snapResult.lineStartX,
            lineStartY: snapResult.lineStartY,
            lineEndX: snapResult.lineEndX,
            lineEndY: snapResult.lineEndY,
          };
          elemDx = newDx;
          elemDy = newDy;
          snapEngaged = true;
        }
      }

      if (!this.snapState && !snapEngaged) {
        elemDx = mouseDx;
        elemDy = mouseDy;
      }
    }

    const prevDx = this.currentDx;
    const prevDy = this.currentDy;

    let currentFrameDx = elemDx - prevDx;
    let currentFrameDy = elemDy - prevDy;

    if (this.avoidCollisions) {
      let nextDx = prevDx + currentFrameDx;
      let nextDy = prevDy + currentFrameDy;

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

        nextDx = prevDx + currentFrameDx;
        nextDy = prevDy + currentFrameDy;

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
          const testXDx = prevDx + currentFrameDx;
          const testYDy = prevDy + currentFrameDy;

          if (
            !checkSceneCollisions(
              this.targets,
              this.startMatrices,
              testXDx,
              prevDy,
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
              prevDx,
              testYDy,
              this.camera,
              this.grid,
              this.getElements,
            )
          ) {
            this.currentDy = testYDy;
          }
        }

        if (snapEngaged) {
          const newGapX = Math.abs(mouseDx - this.currentDx) * this.camera.zoom;
          const newGapY = Math.abs(mouseDy - this.currentDy) * this.camera.zoom;
          if (newGapX > HOLD_DIST_SCREEN || newGapY > HOLD_DIST_SCREEN) {
            this.snapState = null;
          }
        }
      } else {
        this.currentDx = nextDx;
        this.currentDy = nextDy;
      }
    } else {
      this.currentDx = prevDx + currentFrameDx;
      this.currentDy = prevDy + currentFrameDy;
    }

    for (const el of this.targets) {
      const start = this.startMatrices.get(el.id);
      if (!start) continue;
      const m = new DOMMatrix(start.toString());
      m.e += this.currentDx;
      m.f += this.currentDy;
      el.transform.matrix = m;
    }

    this.onDragMove?.(this.currentDx, this.currentDy);
  }

  public end(): void {
    if (!this._active) return;
    this._active = false;

    if (this.currentDx === 0 && this.currentDy === 0) {
      this.resetDrag();
      this.onDragEnd?.();
      return;
    }

    for (const el of this.targets) {
      el.rebuildHitArea();
    }

    const ids = this.targets.map((e) => e.id);
    const cmd = createDragEndCommand(ids);
    (cmd as any).options.mode = this._mode;
    this.bus.execute(cmd);

    this.resetDrag();
    this.onDragEnd?.();
  }

  public abort(): void {
    if (!this._active) return;
    this._active = false;
    this.resetDrag();
  }

  private resetDrag(): void {
    this.targets = [];
    this.startMatrices.clear();
    this.dragSnap.reset();
    this.snapState = null;
  }
}
