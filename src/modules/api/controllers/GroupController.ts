import type { SvgCanvas } from '@/canvas/SvgCanvas';
import type { Group } from '@/core/shapes/group';
import type { GroupConflictAction } from '@/core/type';
import type {
  GroupCreateDTO,
  GroupDeleteDTO,
  GroupAddElementsDTO,
  GroupRemoveElementsDTO,
} from '../dto-types';
import { DebugLog } from '@/canvas/overlays/debug/DebugLog';

export class GroupController {
  private readonly canvas: SvgCanvas;
  private readonly dbg = new DebugLog();

  public constructor(canvas: SvgCanvas) {
    this.canvas = canvas;
  }

  public groupCreate(dto: GroupCreateDTO): string {
    this.dbg.log('API', 'groupCreate', { name: dto.name });
    return this.canvas.groupManager.createGroup(dto.name);
  }

  public groupDelete(dto: GroupDeleteDTO): void {
    this.dbg.log('API', 'groupDelete', { groupId: dto.groupId });
    this.canvas.groupManager.deleteGroup(dto.groupId);
  }

  public groupAddElements(dto: GroupAddElementsDTO): void {
    this.dbg.log('API', 'groupAddElements', {
      groupId: dto.groupId,
      count: dto.elementIds.length,
    });
    for (const elementId of dto.elementIds) {
      this.canvas.groupManager.addToGroup(dto.groupId, elementId);
    }
  }

  public groupRemoveElements(dto: GroupRemoveElementsDTO): void {
    this.dbg.log('API', 'groupRemoveElements', {
      groupId: dto.groupId,
      count: dto.elementIds.length,
    });
    for (const elementId of dto.elementIds) {
      this.canvas.groupManager.removeFromGroup(dto.groupId, elementId);
    }
  }

  public getGroups(): Group[] {
    this.dbg.log('API', 'getGroups');
    return this.canvas.groupManager.getGroups();
  }

  public selectGroup(id: string): void {
    this.dbg.log('API', 'selectGroup', { id });
    this.canvas.selectionState.clear();
    this.canvas.groupManager.setSelectedGroupIds([id]);
    this.syncGroupOverlay();
  }

  public selectGroupElements(id: string): void {
    this.dbg.log('API', 'selectGroupElements', { id });
    const ids = this.canvas.groupManager.getElementIdsInGroup(id);
    this.canvas.selectionState.replace(
      this.canvas.shapeManager.getAll().filter((e) => ids.includes(e.id)),
    );
  }

  public getElementIdsInGroup(id: string): string[] {
    this.dbg.log('API', 'getElementIdsInGroup', { id });
    return this.canvas.groupManager.getElementIdsInGroup(id);
  }

  public selectMultipleGroups(ids: string[]): void {
    this.canvas.groupManager.setSelectedGroupIds(ids);
    this.syncGroupOverlay();
  }

  public highlightGroupElements(id: string): void {
    const ids = this.canvas.groupManager.getElementIdsInGroup(id);
    this.canvas.selectionState.replace(
      this.canvas.shapeManager.getAll().filter((e) => ids.includes(e.id)),
    );
  }

  public selectGroupWithElements(id: string): void {
    this.canvas.groupManager.setSelectedGroupIds([id]);
    this.syncGroupOverlay();
    const ids = this.canvas.groupManager.getElementIdsInGroup(id);
    this.canvas.selectionState.replace(
      this.canvas.shapeManager.getAll().filter((e) => ids.includes(e.id)),
    );
  }

  public clearGroup(id: string): void {
    this.canvas.groupManager.clearGroup(id);
  }

  public get onGroupsChange(): (() => void) | null {
    return null;
  }
  public set onGroupsChange(fn: (() => void) | null) {
    this.canvas.groupManager.setOnChange(fn);
  }

  public get onGroupConflict():
    | ((
        elementId: string,
        fromGroup: string,
        toGroup: string,
      ) => GroupConflictAction | null)
    | null {
    return this.canvas.groupManager.onConflict;
  }
  public set onGroupConflict(
    fn:
      | ((
          elementId: string,
          fromGroup: string,
          toGroup: string,
        ) => GroupConflictAction | null)
      | null,
  ) {
    this.canvas.groupManager.onConflict = fn;
  }

  public get groupConflictSuppressed(): boolean {
    return this.canvas.groupManager.conflictSuppressed;
  }
  public set groupConflictSuppressed(v: boolean) {
    this.canvas.groupManager.conflictSuppressed = v;
  }

  private syncGroupOverlay(): void {
    const selectedGroups = Array.from(this.canvas.groupManager.selectedGroupIds)
      .map((id) => this.canvas.groupManager.getGroup(id))
      .filter((g): g is Group => g !== undefined);
    this.canvas.selectionManager.setGroupSelection(
      selectedGroups.map((g) => g.id),
      (id) => this.canvas.groupManager.getGroup(id),
      (id) => this.canvas.shapeManager.getAll().find((e) => e.id === id),
    );
  }
}
