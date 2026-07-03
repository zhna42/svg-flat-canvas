import type { ICanvasContext } from './types';
import { invalidateGroupBBox } from '@/math/group-bbox-utils';

export class OverlayCoordinator {
  constructor(private readonly ctx: ICanvasContext) {}

  wire(): void {
    this.wireCameraSubscription();
    this.wireTransformCallbacks();
  }

  updateOverlay(): void {
    const selected = this.ctx.selectionState.selected;
    if (selected.length > 0) {
      this.ctx.selectionOverlay.setPositions(selected);
    }
    if (this.ctx.groupManager.selectedGroupIds.size > 0) {
      this.invalidateSelectedGroupBBoxes();
      this.syncGroups();
    }
  }

  syncGroups(): void {
    const selectedGroups = Array.from(this.ctx.groupManager.selectedGroupIds)
      .map((id) => this.ctx.groupManager.getGroup(id))
      .filter((g) => g !== undefined);
    this.ctx.groupSelectionOverlay.sync(selectedGroups, (id: string) =>
      this.ctx.shapeManager.getAll().find((e) => e.id === id),
    );
  }

  invalidateSelectedGroupBBoxes(): void {
    for (const id of this.ctx.groupManager.selectedGroupIds) {
      const g = this.ctx.groupManager.getGroup(id);
      if (g) {
        g._bboxDirty = true;
        g._cachedWorldBBox = null;
      }
    }
  }

  private wireCameraSubscription(): void {
    this.ctx.camera.subscribe(['x', 'y', 'zoom'], () => {
      const selected = this.ctx.selectionState.selected;
      if (selected.length > 0) {
        this.ctx.selectionOverlay.setPositions(selected);
      }
      if (this.ctx.api.editingPath) {
        this.ctx.selectionOverlay.updatePathNodes(this.ctx.api.editingPath);
      }
      if (this.ctx.groupManager.selectedGroupIds.size > 0) {
        this.syncGroups();
      }
      this.ctx.rulerManager.onCameraChange();
    });
  }

  private wireTransformCallbacks(): void {
    this.ctx.transformHandler.onTransformEnd = () => {
      this.updateOverlay();
    };

    this.ctx.transformHandler.onTransformMove = () => {
      const selected = this.ctx.selectionState.selected;
      if (selected.length > 0) {
        this.ctx.selectionOverlay.setPositions(selected);
      }
    };

    this.ctx.groupTransformHandler.onTransformStart = () => {
      for (const g of this.ctx.groupTransformHandler.selectedGroups) {
        g.matrix = new DOMMatrix();
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
}
