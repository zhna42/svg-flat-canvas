import { EventManager } from '@/events/EventManager';
import { Renderer } from '@/renderer/Renderer';
import { ShapeManager } from '@/shapes/ShapeManager';
import { Camera } from '@/camera/Camera';
import type { SvgElement } from '@/shapes/elements/SvgElement';
import { createFromJSONArray } from '@/shapes/elements/factory';
import type { ElementJSON } from '@/shapes/elements/factory';
import type { SvgCanvasOptions } from '@/types';
import { SelectionState } from '@/selection/SelectionState';
import { SpatialGrid } from '@/selection/SpatialGrid';
import { SelectionHandler } from '@/selection/handlers/SelectionHandler';
import type { SelectionMode } from '@/selection/SelectionMode';
import type { SelectionFilter } from '@/selection/selection-filter';
import type { SelectionShortcuts } from '@/selection/selection-defaults';
import type { SelectionGesture } from '@/selection';
import { SelectionOverlay } from '@/selection/SelectionOverlay';
import { DebugOverlay } from '@/debug/DebugOverlay';
import { GroupManager, type GroupData, type GroupConflictAction } from '@/group';
import type { Group } from '@/group';

export class SvgCanvas {
  private readonly element: HTMLElement;
  private readonly svg: SVGSVGElement;
  private readonly camera: Camera;
  private readonly renderer: Renderer;
  private readonly shapeManager: ShapeManager;
  private readonly eventManager: EventManager;
  private readonly selectionState: SelectionState;
  private readonly spatialGrid: SpatialGrid;
  private readonly selectionHandler: SelectionHandler;
  private readonly selectionOverlay: SelectionOverlay;
  private readonly debugOverlay: DebugOverlay;
  private readonly groupManager: GroupManager;
  private _debugShowHitArea: boolean;

  public readonly panActive = { value: false };

  public constructor(container: HTMLElement, options?: SvgCanvasOptions) {
    this.element = container;
    this.svg = this.createSvgElement(options);
    this.camera = new Camera();
    this.renderer = new Renderer(this.svg, this.camera);
    this.shapeManager = new ShapeManager(this.renderer);
    this.eventManager = new EventManager(this.svg);
    this.selectionState = new SelectionState();
    this.spatialGrid = new SpatialGrid(800, 600, 100);

    this.selectionHandler = new SelectionHandler(
      this.svg,
      this.renderer.getCameraGroup(),
      this.camera,
      this.selectionState,
      () => this.shapeManager.getAll(),
      this.spatialGrid,
      () => this.panActive.value,
      undefined,
      (elementId) => {
        const g = this.groupManager.getGroupByElement(elementId);
        return g?.id;
      },
    );
    this.selectionHandler.onGroupSelect = (ids) => {
      this.groupManager.setSelectedGroupIds(ids);
    };

    this.element.appendChild(this.svg);

    const overlaysGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.renderer.appendOverlay(overlaysGroup);

    this.selectionOverlay = new SelectionOverlay(this.camera);
    overlaysGroup.appendChild(this.selectionOverlay.getElement());

    this.debugOverlay = new DebugOverlay(this.camera);
    overlaysGroup.appendChild(this.debugOverlay.getElement());
    this._debugShowHitArea = options?.debugShowHitArea ?? false;

    this.groupManager = new GroupManager(
      this.renderer.getCameraGroup(),
      this.camera,
      () => this.shapeManager.getAll(),
    );

    const updateOverlay = (): void => {
      this.selectionOverlay.update(this.selectionState.selected);
      if (this._debugShowHitArea) {
        this.debugOverlay.update(this.shapeManager.getAll());
      }
    };
    this.selectionState.setOnChange(updateOverlay);

    const origSetOnChange = this.selectionState.setOnChange.bind(this.selectionState);
    this.selectionState.setOnChange = (fn) => {
      origSetOnChange((selected) => {
        fn?.(selected);
        updateOverlay();
      });
    };
  }

  public getSVG(): SVGSVGElement {
    return this.svg;
  }

  public getCamera(): Camera {
    return this.camera;
  }

  public addShape(shape: SvgElement): void {
    this.shapeManager.add(shape);
    this.indexShape(shape);
  }

  public loadJSON(items: ElementJSON[]): void {
    const elements = createFromJSONArray(items);
    for (const el of elements) {
      this.shapeManager.add(el);
      this.indexShape(el);
    }
  }

  public setArtboardSize(widthMM: number, heightMM: number): void {
    const artboard = this.renderer.getArtboard();
    artboard.setSize(widthMM, heightMM);

    const vb = this.svg.getAttribute('viewBox') || '0 0 800 600';
    const parts = vb.split(/\s+/).map(Number);
    const vw = parts[2] || 800;
    const vh = parts[3] || 600;
    const pw = widthMM * 3.7795;
    const ph = heightMM * 3.7795;
    this.camera.fitToViewport(pw, ph, vw, vh, 40);
  }

  // ---- Selection API ----

  public setSelectionMode(mode: SelectionMode): void {
    this.selectionState.setMode(mode);
  }

  public getSelectionMode(): SelectionMode {
    return this.selectionState.mode;
  }

  public set onSelectionModeChange(fn: ((mode: SelectionMode) => void) | null) {
    this.selectionState.setOnModeChange(fn);
  }

  public set selectionFilter(fn: SelectionFilter | null) {
    this.selectionState.setFilter(fn);
  }

  public set onSelectionChange(fn: ((selected: SvgElement[]) => void) | null) {
    this.selectionState.setOnChange(fn);
  }

  public getSelected(): readonly SvgElement[] {
    return this.selectionState.selected;
  }

  public setSelectionShortcuts(s: Partial<SelectionShortcuts>): void {
    this.selectionHandler.setShortcuts(s);
  }

  public setSelectionGesture(g: SelectionGesture): void {
    this.selectionHandler.setGesture(g);
  }

  public getSelectionGesture(): SelectionGesture {
    return this.selectionHandler.getGesture();
  }

  public get debugShowHitArea(): boolean {
    return this._debugShowHitArea;
  }

  public set debugShowHitArea(v: boolean) {
    this._debugShowHitArea = v;
    if (v) {
      this.debugOverlay.update(this.shapeManager.getAll());
    } else {
      this.debugOverlay.update([]);
    }
  }

  // ---- Group API ----

  public get groups(): Group[] {
    return this.groupManager.getGroups();
  }

  public setGroups(data: GroupData[]): void {
    this.groupManager.setGroups(data);
  }

  public createGroup(name?: string): string {
    return this.groupManager.createGroup(name);
  }

  public deleteGroup(id: string): void {
    this.groupManager.deleteGroup(id);
  }

  public addToGroup(groupId: string, elementId: string): void {
    this.groupManager.addToGroup(groupId, elementId);
  }

  public removeFromGroup(groupId: string, elementId: string): void {
    this.groupManager.removeFromGroup(groupId, elementId);
  }

  public clearGroup(id: string): void {
    this.groupManager.clearGroup(id);
  }

  public getElementIdsInGroup(id: string): string[] {
    return this.groupManager.getElementIdsInGroup(id);
  }

  public selectGroupElements(id: string): void {
    const ids = this.groupManager.getElementIdsInGroup(id);
    const all = this.shapeManager.getAll();
    const elements = all.filter((e) => ids.includes(e.id));
    this.selectionState.replace(elements);
  }

  public selectGroup(id: string): void {
    this.selectionState.clear();
    this.groupManager.setSelectedGroupIds([id]);
  }

  public selectMultipleGroups(ids: string[]): void {
    this.groupManager.setSelectedGroupIds(ids);
  }

  public getSelectedGroupIds(): string[] {
    return Array.from(this.groupManager.selectedGroupIds);
  }

  public set onGroupSelect(fn: ((ids: string[]) => void) | null) {
    this.groupManager.onGroupSelect = fn;
  }

  public highlightGroupElements(id: string): void {
    const ids = this.groupManager.getElementIdsInGroup(id);
    const all = this.shapeManager.getAll();
    const elements = all.filter((e) => ids.includes(e.id));
    this.selectionState.replace(elements);
  }

  public set onGroupsChange(fn: (() => void) | null) {
    this.groupManager.setOnChange(fn);
  }

  public set onGroupConflict(
    fn: ((elementId: string, fromGroup: string, toGroup: string) => GroupConflictAction | null) | null,
  ) {
    this.groupManager.onConflict = fn;
  }

  public get groupConflictSuppressed(): boolean {
    return this.groupManager.conflictSuppressed;
  }

  public set groupConflictSuppressed(v: boolean) {
    this.groupManager.conflictSuppressed = v;
  }

  public destroy(): void {
    this.renderer.destroy();
    this.eventManager.destroy();
    this.shapeManager.clear();
    this.groupManager.destroy();
    this.svg.remove();
  }

  private createSvgElement(options?: SvgCanvasOptions): SVGSVGElement {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    const w = options?.width ?? 800;
    const h = options?.height ?? 600;
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.style.display = 'block';
    return svg;
  }

  private indexShape(shape: SvgElement): void {
    const bbox = shape.getBBox();
    this.spatialGrid.insert(shape.id, bbox.x, bbox.y, bbox.width, bbox.height);
  }
}
