import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { CommandBus } from '@/core/CommandBus';
import type { Camera } from '@/canvas/Camera';
import type { HitTestEngine } from '@/core/HitTestEngine';
import { createDragEndCommand } from '@/commands/factories/drag-command-factory';
import { DragSnapHelper } from '@/canvas/overlays/selection/drag/DragSnap';
import type { SnapAxisMode } from '@/types';
import {
  checkSceneCollisions,
  type CollisionContext,
} from '@/core/HitTestEngine';
import { getVisualWorldPoints } from '@/canvas/overlays/selection/drag/DragCollision';
import { PathElement } from '@/shapes/elements/PathElement';

const HOLD_DIST_SCREEN = 40;
const AXIS_LOCK_DEADZONE_PX = 2;

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
  private lockDragAxis = false;
  private lockOrigin: { dx: number; dy: number } | null = null;
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
  private hitTestEngine: HitTestEngine;
  private getElements: () => AbstractGraphicElement[];

  private snapState: SnapState | null = null;

  public onDragStart: (() => void) | null = null;
  public onDragMove: ((dx: number, dy: number) => void) | null = null;
  public onDragEnd: (() => void) | null = null;

  public constructor(
    bus: CommandBus,
    camera: Camera,
    hitTestEngine: HitTestEngine,
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
    this.hitTestEngine = hitTestEngine;
    this.getElements = getElements;
    this.dragSnap = new DragSnapHelper(
      camera,
      getElements,
      getArtboardRect,
      getGuidelines,
      getGridLines,
    );
  }

  private getCollisionContext(): CollisionContext {
    return {
      grid: this.hitTestEngine.spatialStore,
      getElements: () => this.getElements(),
      getVisualWorldPoints: (el) =>
        getVisualWorldPoints(
          el as unknown as AbstractGraphicElement,
          this.camera,
        ),
      isClosedShape: (el) => {
        const typed = el as unknown as AbstractGraphicElement;
        return (
          typed.type !== 'polyline' &&
          typed.type !== 'line' &&
          !(
            typed instanceof PathElement &&
            typed.geometry.commands.length > 0 &&
            !(
              typed.geometry.commands[typed.geometry.commands.length - 1]
                .command === 'Z' ||
              typed.geometry.commands[typed.geometry.commands.length - 1]
                .command === 'z'
            )
          )
        );
      },
    };
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

  public setSnapToElements(enabled: boolean): void {
    this.dragSnap.snapToElements = enabled;
  }

  public setLockDragAxis(enabled: boolean): void {
    this.lockDragAxis = enabled;
    if (enabled) {
      this.lockOrigin = this._active
        ? { dx: this.currentDx, dy: this.currentDy }
        : { dx: 0, dy: 0 };
    } else {
      this.lockOrigin = null;
    }
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
    this.lockOrigin = this.lockDragAxis ? { dx: 0, dy: 0 } : null;
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

    let lockedDx = mouseDx;
    let lockedDy = mouseDy;
    let lockedAxis: 'h' | 'v' | 'none' = 'none';
    let savedSnapAxis: SnapAxisMode | null = null;

    if (this.lockDragAxis) {
      const origin = this.lockOrigin ?? { dx: 0, dy: 0 };
      const relX = mouseDx - origin.dx;
      const relY = mouseDy - origin.dy;
      const relXpx = Math.abs(relX) * this.camera.zoom;
      const relYpx = Math.abs(relY) * this.camera.zoom;

      if (relXpx < AXIS_LOCK_DEADZONE_PX && relYpx < AXIS_LOCK_DEADZONE_PX) {
        lockedDx = origin.dx;
        lockedDy = origin.dy;
        lockedAxis = 'none';
      } else if (Math.abs(relX) >= Math.abs(relY)) {
        lockedDy = origin.dy;
        lockedAxis = 'h';
        savedSnapAxis = this.dragSnap.snapAxis;
        this.dragSnap.snapAxis = 'horizontal';
      } else {
        lockedDx = origin.dx;
        lockedAxis = 'v';
        savedSnapAxis = this.dragSnap.snapAxis;
        this.dragSnap.snapAxis = 'vertical';
      }
    }

    let elemDx = lockedDx;
    let elemDy = lockedDy;
    let snapEngaged = false;

    const snapEnabled = this.snapToCorners || this.snapToPlanes;

    if (snapEnabled) {
      const snapResult = this.dragSnap.computeWorldSnap(
        this.targets,
        this.startMatrices,
        lockedDx,
        lockedDy,
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
              (lockedDx - elemDx) * dirX + (lockedDy - elemDy) * dirY;
            elemDx = elemDx + mouseAlong * dirX;
            elemDy = elemDy + mouseAlong * dirY;

            const perpX = lockedDx - elemDx - mouseAlong * dirX;
            const perpY = lockedDy - elemDy - mouseAlong * dirY;
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
          const gapX = (lockedDx - elemDx) * this.camera.zoom;
          const gapY = (lockedDy - elemDy) * this.camera.zoom;
          const gapDist = Math.hypot(gapX, gapY);

          if (gapDist > HOLD_DIST_SCREEN) {
            this.snapState = null;
          } else if (lockedDx * lockedDx + lockedDy * lockedDy > 0.01) {
            const mouseDotDrag =
              lockedDx * (elemDx - lockedDx) + lockedDy * (elemDy - lockedDy);
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
        const newDx = lockedDx + snapResult.correctionDx;
        const newDy = lockedDy + snapResult.correctionDy;

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
        elemDx = lockedDx;
        elemDy = lockedDy;
      }
    }

    const prevDx = this.currentDx;
    const prevDy = this.currentDy;

    let currentFrameDx = elemDx - prevDx;
    let currentFrameDy = elemDy - prevDy;

    if (this.avoidCollisions) {
      let nextDx = prevDx + currentFrameDx;
      let nextDy = prevDy + currentFrameDy;

      const collisionContext = this.getCollisionContext();
      const collisionNormal = checkSceneCollisions(
        this.targets,
        this.startMatrices,
        nextDx,
        nextDy,
        collisionContext,
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
            collisionContext,
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
              collisionContext,
            )
          ) {
            this.currentDx = testXDx;
          } else if (
            !checkSceneCollisions(
              this.targets,
              this.startMatrices,
              prevDx,
              testYDy,
              collisionContext,
            )
          ) {
            this.currentDy = testYDy;
          } else {
            // iterative back-off: find the maximum safe t in [0,1]
            const origFrameDx = currentFrameDx;
            const origFrameDy = currentFrameDy;
            let t = 1;
            for (let step = 0; step < 8; step++) {
              const testDx = prevDx + origFrameDx * t;
              const testDy = prevDy + origFrameDy * t;
              if (
                !checkSceneCollisions(
                  this.targets,
                  this.startMatrices,
                  testDx,
                  testDy,
                  collisionContext,
                )
              ) {
                this.currentDx = testDx;
                this.currentDy = testDy;
                break;
              }
              t *= 0.5;
            }
          }
        }

        if (snapEngaged) {
          const newGapX =
            Math.abs(lockedDx - this.currentDx) * this.camera.zoom;
          const newGapY =
            Math.abs(lockedDy - this.currentDy) * this.camera.zoom;
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

    if (this.lockDragAxis && this.lockOrigin) {
      if (lockedAxis === 'none') {
        this.currentDx = this.lockOrigin.dx;
        this.currentDy = this.lockOrigin.dy;
      } else if (lockedAxis === 'h') {
        this.currentDy = this.lockOrigin.dy;
      } else {
        this.currentDx = this.lockOrigin.dx;
      }
    }

    if (savedSnapAxis !== null) {
      this.dragSnap.snapAxis = savedSnapAxis;
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
