import { BaseSelectionBox, type HandlePosition } from './BaseSelectionBox';
import { SelectionElementBox } from './SelectionElementBox';
import { SelectionGroupBox } from './SelectionGroupBox';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { Group } from '@/shapes/group/Group';
import type { IRenderableNode } from '@/types';

export class SelectionManager {
  private boxes = new Map<string, BaseSelectionBox>();
  private registerDirty: (node: IRenderableNode) => void;

  constructor(registerDirty: (node: IRenderableNode) => void) {
    this.registerDirty = registerDirty;
  }

  setElementSelection(
    elementIds: string[],
    getElement: (id: string) => AbstractGraphicElement | undefined,
  ): void {
    const newKeys = new Set(elementIds.map((id) => `sel-${id}`));

    for (const [key, box] of this.boxes) {
      if (!newKeys.has(key) && !box.isGroup) {
        box.hide();
        this.boxes.delete(key);
      }
    }

    for (const eid of elementIds) {
      const el = getElement(eid);
      if (!el) continue;

      const key = `sel-${eid}`;
      if (this.boxes.has(key)) {
        (this.boxes.get(key) as SelectionElementBox).syncFromElement(el);
      } else {
        const box = new SelectionElementBox(eid, this.registerDirty);
        this.boxes.set(key, box);
        box.syncFromElement(el);
      }
    }
  }

  setGroupSelection(
    groupIds: string[],
    getGroup: (id: string) => Group | undefined,
    getElement: (id: string) => AbstractGraphicElement | undefined,
  ): void {
    const newKeys = new Set(groupIds.map((id) => `sel-grp-${id}`));

    for (const [key, box] of this.boxes) {
      if (!newKeys.has(key) && box.isGroup) {
        box.hide();
        this.boxes.delete(key);
      }
    }

    for (const gid of groupIds) {
      const group = getGroup(gid);
      if (!group) continue;

      const key = `sel-grp-${gid}`;
      if (this.boxes.has(key)) {
        (this.boxes.get(key) as SelectionGroupBox).syncFromGroup(group, getElement);
      } else {
        const box = new SelectionGroupBox(gid, this.registerDirty);
        this.boxes.set(key, box);
        box.syncFromGroup(group, getElement);
      }
    }
  }

  syncElementPositions(
    getElement: (id: string) => AbstractGraphicElement | undefined,
  ): void {
    for (const box of this.boxes.values()) {
      if (box.isGroup) continue;
      const el = getElement(box.targetId);
      if (el) (box as SelectionElementBox).syncFromElement(el);
    }
  }

  syncGroupPositions(
    getGroup: (id: string) => Group | undefined,
    getElement: (id: string) => AbstractGraphicElement | undefined,
  ): void {
    for (const box of this.boxes.values()) {
      if (!box.isGroup) continue;
      const group = getGroup(box.targetId);
      if (group) (box as SelectionGroupBox).syncFromGroup(group, getElement);
    }
  }

  moveBy(dx: number, dy: number): void {
    for (const box of this.boxes.values()) {
      box.x += dx;
      box.y += dy;
    }
  }

  hitTestHandle(svgX: number, svgY: number): {
    handle: HandlePosition;
    targetId: string;
    isGroup: boolean;
  } | null {
    for (const box of this.boxes.values()) {
      const handle = box.hitTestHandle(svgX, svgY);
      if (handle) return { handle, targetId: box.targetId, isGroup: box.isGroup };
    }
    return null;
  }

  clear(): void {
    for (const box of this.boxes.values()) box.hide();
    this.boxes.clear();
  }

  getVisibleBoxes(): BaseSelectionBox[] {
    return Array.from(this.boxes.values());
  }

  destroy(): void {
    this.clear();
  }
}
