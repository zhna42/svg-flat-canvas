import type { ICanvasContext } from '@/core/type/internal';
import { invalidateGroupBBox } from '@/core/math/group-bbox';
import type { Group } from '@/core/shapes/group/Group';
import { MM_TO_PX } from '@/constants';
import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';

export class OverlayCoordinator {
  constructor(private readonly ctx: ICanvasContext) {}

  wire(): void {
    this.wireCameraSubscription();
    this.wireTransformCallbacks();
  }

  updateOverlay(): void {
    const selected = this.ctx.selectionState.selected;
    if (selected.length > 0 && !this.ctx.nodeEdit.isActive) {
      this.ctx.selectionManager.syncElementPositions((id) =>
        this.ctx.shapeManager.getAll().find((e) => e.id === id),
      );
    }
    if (this.ctx.groupManager.selectedGroupIds.size > 0) {
      this.syncGroups();
    }
  }

  syncGroups(): void {
    this.invalidateSelectedGroupBBoxes();
    const selectedGroups = Array.from(this.ctx.groupManager.selectedGroupIds)
      .map((id) => this.ctx.groupManager.getGroup(id))
      .filter((g: Group | undefined): g is Group => g !== undefined);
    this.ctx.selectionManager.setGroupSelection(
      selectedGroups.map((g) => g.id),
      (id) => this.ctx.groupManager.getGroup(id),
      (id) => this.ctx.shapeManager.getAll().find((e) => e.id === id),
    );
  }

  invalidateSelectedGroupBBoxes(): void {
    for (const id of this.ctx.groupManager.selectedGroupIds) {
      const g = this.ctx.groupManager.getGroup(id);
      if (g) {
        invalidateGroupBBox(g);
      }
    }
  }

  private wireCameraSubscription(): void {
    this.ctx.camera.subscribe(['x', 'y', 'zoom'], () => {
      const selected = this.ctx.selectionState.selected;
      if (selected.length > 0 && !this.ctx.nodeEdit.isActive) {
        this.ctx.selectionManager.syncElementPositions((id) =>
          this.ctx.shapeManager.getAll().find((e) => e.id === id),
        );
      }
      if (this.ctx.nodeEdit.isActive) {
        this.ctx.nodeEdit.onZoomChange();
      }
      this.ctx.measure.onCameraChange();
      if (this.ctx.groupManager.selectedGroupIds.size > 0) {
        this.syncGroups();
      }
      this.ctx.rulers.syncCamera(
        this.ctx.camera.x,
        this.ctx.camera.y,
        this.ctx.camera.zoom,
      );
      this.ctx.guidelineManager.onCameraChange();
    });
  }

  private wireTransformCallbacks(): void {
    this.ctx.transformHandler.onTransformEnd = () => {
      this.updateOverlay();
      this.emitSizeForSelected();
    };

    this.ctx.transformHandler.onTransformMove = () => {
      const selected = this.ctx.selectionState.selected;
      if (selected.length > 0) {
        this.ctx.selectionManager.syncElementPositions((id) =>
          this.ctx.shapeManager.getAll().find((e) => e.id === id),
        );
      }
      this.emitSizeForSelected();
    };

    this.ctx.groupTransformHandler.onTransformStart = () => {
      for (const g of this.ctx.groupTransformHandler.selectedGroups) {
        invalidateGroupBBox(g);
      }
      this.syncGroups();
    };

    this.ctx.groupTransformHandler.onTransformMove = () => {
      this.syncGroups();
    };

    this.ctx.groupTransformHandler.onTransformEnd = () => {
      this.syncGroups();
    };
  }

  private emitSizeForSelected(): void {
    const selected = this.ctx.selectionState.selected;
    if (selected.length === 1) {
      const el = selected[0] as AbstractGraphicElement;
      const bbox = el.getTransformedBBox();
      this.ctx.events.emit('ELEMENT_SIZE', {
        id: el.id,
        widthMm: bbox.width / MM_TO_PX,
        heightMm: bbox.height / MM_TO_PX,
        angleDeg: el.transform.angle,
      });
    }
  }
}
