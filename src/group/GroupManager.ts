import { SVG_NS } from '@/constants';
import type { SvgElement } from '@/shapes/elements/SvgElement';
import type { Camera } from '@/camera/Camera';
import { Group, type GroupData } from './Group';

export type GroupConflictAction = 'move' | 'cancel';

export class GroupManager {
  private readonly groups = new Map<string, Group>();
  private readonly getElements: () => SvgElement[];
  private readonly camera: Camera;
  private readonly overlayGroup: SVGGElement;
  private _onChange: (() => void) | null = null;
  public onConflict:
    | ((elementId: string, fromGroup: string, toGroup: string) => GroupConflictAction | null)
    | null = null;
  public conflictSuppressed = false;

  public constructor(
    parent: SVGGElement,
    camera: Camera,
    getElements: () => SvgElement[],
  ) {
    this.camera = camera;
    this.getElements = getElements;
    this.overlayGroup = document.createElementNS(SVG_NS, 'g');
    this.overlayGroup.setAttribute('pointer-events', 'none');
    parent.appendChild(this.overlayGroup);
  }

  public setOnChange(fn: (() => void) | null): void {
    this._onChange = fn;
  }

  private notify(): void {
    this.renderOverlay();
    this._onChange?.();
  }

  // ---- CRUD ----

  public createGroup(name?: string): string {
    const id = 'grp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const g = new Group({ id, name: name || `Group-${this.groups.size + 1}`, elementIds: [] });
    this.groups.set(id, g);
    this.notify();
    return id;
  }

  public deleteGroup(id: string): void {
    const g = this.groups.get(id);
    if (!g) return;
    for (const elId of g.elementIds) {
      const el = this.findElement(elId);
      if (el) el.groupId = '';
    }
    this.groups.delete(id);
    this.notify();
  }

  public addToGroup(groupId: string, elementId: string): void {
    const g = this.groups.get(groupId);
    if (!g) return;

    const el = this.findElement(elementId);
    if (!el) return;

    // check nesting — groups cannot be added to groups (not applicable for virtual groups)

    // check if already in this group
    if (g.elementIds.has(elementId)) return;

    // check if element already in another group
    if (el.groupId && el.groupId !== groupId) {
      const resolved = this.resolveConflict(elementId, el.groupId, groupId);
      if (resolved === 'cancel') return;
      // 'move' — remove from old group
      const oldGroup = this.groups.get(el.groupId);
      if (oldGroup) {
        oldGroup.elementIds.delete(elementId);
      }
    }

    el.groupId = groupId;
    g.elementIds.add(elementId);
    this.notify();
  }

  public removeFromGroup(groupId: string, elementId: string): void {
    const g = this.groups.get(groupId);
    if (!g) return;
    if (!g.elementIds.has(elementId)) return;
    g.elementIds.delete(elementId);
    const el = this.findElement(elementId);
    if (el && el.groupId === groupId) el.groupId = '';
    this.notify();
  }

  public clearGroup(id: string): void {
    const g = this.groups.get(id);
    if (!g) return;
    for (const elId of g.elementIds) {
      const el = this.findElement(elId);
      if (el && el.groupId === id) el.groupId = '';
    }
    g.elementIds.clear();
    this.notify();
  }

  public getGroup(id: string): Group | undefined {
    return this.groups.get(id);
  }

  public getGroups(): Group[] {
    return Array.from(this.groups.values());
  }

  public getElementIdsInGroup(id: string): string[] {
    const g = this.groups.get(id);
    return g ? Array.from(g.elementIds) : [];
  }

  public getGroupByElement(elementId: string): Group | undefined {
    for (const g of this.groups.values()) {
      if (g.elementIds.has(elementId)) return g;
    }
    return undefined;
  }

  // ---- setGroups (bulk replace from external data) ----

  public setGroups(data: GroupData[]): void {
    this.groups.clear();

    for (const d of data) {
      const validIds = d.elementIds.filter((eid) => this.findElement(eid) !== undefined);
      this.groups.set(d.id, new Group({ ...d, elementIds: validIds }));
    }

    this.notify();
  }

  // ---- conflict resolution ----

  private resolveConflict(
    elementId: string,
    fromGroup: string,
    toGroup: string,
  ): GroupConflictAction {
    if (this.conflictSuppressed) return 'move';

    const result = this.onConflict?.(elementId, fromGroup, toGroup);
    if (result === 'move') return 'move';
    if (result === 'cancel') return 'cancel';

    if (typeof window !== 'undefined') {
      const msg = `Element "${elementId}" is already in group "${fromGroup}". Move it to "${toGroup}"?`;
      return window.confirm(msg) ? 'move' : 'cancel';
    }

    return 'cancel';
  }

  // ---- overlay rendering ----

  private renderOverlay(): void {
    while (this.overlayGroup.firstChild) {
      this.overlayGroup.removeChild(this.overlayGroup.firstChild);
    }

    const z = this.camera.zoom;

    for (const g of this.groups.values()) {
      if (g.elementIds.size === 0) continue;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let hasAny = false;

      for (const elId of g.elementIds) {
        const el = this.findElement(elId);
        if (!el) continue;
        const bbox = el.getTransformedBBox();
        if (bbox.width === 0 && bbox.height === 0) continue;
        hasAny = true;
        if (bbox.x < minX) minX = bbox.x;
        if (bbox.y < minY) minY = bbox.y;
        if (bbox.x + bbox.width > maxX) maxX = bbox.x + bbox.width;
        if (bbox.y + bbox.height > maxY) maxY = bbox.y + bbox.height;
      }

      if (!hasAny) continue;

      const pad = 2 / z;
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(minX - pad));
      rect.setAttribute('y', String(minY - pad));
      rect.setAttribute('width', String(maxX - minX + pad * 2));
      rect.setAttribute('height', String(maxY - minY + pad * 2));
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', '#888');
      rect.setAttribute('stroke-width', String(1.5 / z));
      rect.setAttribute('stroke-dasharray', String(6 / z) + ' ' + String(3 / z));
      this.overlayGroup.appendChild(rect);
    }
  }

  // ---- helpers ----

  private findElement(id: string): SvgElement | undefined {
    return this.getElements().find((e) => e.id === id);
  }

  public destroy(): void {
    this.overlayGroup.remove();
  }
}
