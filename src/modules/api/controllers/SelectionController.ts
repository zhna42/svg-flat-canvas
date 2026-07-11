import type { SvgCanvas } from '@/canvas/SvgCanvas';
import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import { guardEditMode } from './helpers';
import type {
  SelectionMode,
  SelectionGesture,
  SelectionShortcuts,
  TransformMode,
} from '@/core/type';
import type { SelectShapesDTO } from '../dto-types';
import { DebugLog } from '@/canvas/overlays/debug/DebugLog';

export class SelectionController {
  private readonly canvas: SvgCanvas;
  private readonly dbg = new DebugLog();

  public constructor(canvas: SvgCanvas) {
    this.canvas = canvas;
  }

  public selectShapes(dto: SelectShapesDTO): void {
    if (!guardEditMode(this.canvas)) return;
    const elements = this.findElements(dto.elementIds);
    if (dto.toggle) {
      const current = [...this.getSelected()];
      for (const el of elements) {
        const idx = current.findIndex((s) => s.id === el.id);
        if (idx >= 0) {
          current.splice(idx, 1);
        } else {
          current.push(el);
        }
      }
      this.canvas.selectionState.replace(current);
    } else {
      this.canvas.selectionState.replace(elements);
    }
  }

  public clearSelection(): void {
    this.dbg.log('API', 'clearSelection');
    this.canvas.selectionState.replace([]);
  }

  public selectElements(ids: string[]): void {
    this.canvas.elementManager.selectElements(ids);
  }

  public setSelectionMode(mode: SelectionMode): void {
    this.canvas.selectionState.setMode(mode);
  }

  public getSelectionMode(): SelectionMode {
    return this.canvas.selectionState.mode;
  }

  public getSelected(): readonly AbstractGraphicElement[] {
    return this.canvas.selectionState.selected;
  }

  public setSelectedElements(elements: AbstractGraphicElement[]): void {
    this.canvas.selectionState.replace(elements);
  }

  public getSelectedStyles(): Array<Record<string, unknown>> {
    return this.canvas.elementManager.getSelectedStyles();
  }

  public setSelectionShortcuts(s: Partial<SelectionShortcuts>): void {
    this.canvas.selectionHandler.setShortcuts(s);
  }

  public setSelectionGesture(g: SelectionGesture): void {
    this.canvas.selectionHandler.setGesture(g);
  }

  public getSelectionGesture(): SelectionGesture {
    return this.canvas.selectionHandler.getGesture();
  }

  public setTransformMode(mode: TransformMode): void {
    this.canvas.transformHandler.setMode(mode);
    this.canvas.groupTransformHandler.setMode(mode);
  }

  public setProportionalResize(enabled: boolean): void {
    this.canvas.transformHandler.setProportionalResize(enabled);
    this.canvas.groupTransformHandler.setProportionalResize(enabled);
    this.canvas.events.emit('PROPORTIONAL_RESIZE_TOGGLED', { enabled });
  }

  public setSnapRotation(enabled: boolean): void {
    this.canvas.selectionHandler.setSnapRotation(enabled);
    this.canvas.events.emit('ROTATION_SNAP_TOGGLED', { enabled });
  }

  public setRotationStep(step: number): void {
    this.canvas.selectionHandler.setRotationStep(step);
    this.canvas.events.emit('ROTATION_STEP_CHANGED', { step });
  }

  private findElements(ids: string[]): AbstractGraphicElement[] {
    const all = this.canvas.shapeManager.getAll();
    return all.filter((e) => ids.includes(e.id));
  }
}
