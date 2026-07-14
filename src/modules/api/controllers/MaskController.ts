import type { SvgCanvas } from '@/canvas/SvgCanvas';
import type { ImageElement } from '@/core/shapes/elements/ImageElement';

export class MaskController {
  private readonly canvas: SvgCanvas;

  constructor(canvas: SvgCanvas) {
    this.canvas = canvas;
  }

  enterMaskMode(imageId: string): void {
    const el = this.canvas.shapeManager.getById(imageId);
    if (!el || el.type !== 'image') return;
    this.canvas.maskMode = { imageId };
  }

  exitMaskMode(): void {
    this.canvas.maskMode = null;
    this._lockMaskSelection();
  }

  /** Запрещает селект элементов, используемых как маски. */
  private _lockMaskSelection(): void {
    const allImages = this.canvas.shapeManager.getAll().filter(
      (s) => s.type === 'image',
    );
    const maskIds = new Set<string>();
    for (const img of allImages) {
      const ids = (img as ImageElement).maskElementIds;
      for (const mid of ids) maskIds.add(mid);
    }

    if (maskIds.size > 0) {
      this.canvas.selectionState.setFilter(
        (elements) => elements.filter((el) => !maskIds.has(el.id)),
      );
    }
  }

  assignMask(elementId: string): void {
    const mode = this.canvas.maskMode;
    if (!mode) return;

    const image = this.canvas.shapeManager.getById(mode.imageId) as
      | ImageElement
      | undefined;
    if (!image || image.type !== 'image') { console.warn('[Mask] assignMask: image not found', mode.imageId); return; }

    console.log('[Mask] assignMask:', elementId, '→ image', mode.imageId);
    console.log('[Mask] image.pushDiffRendering type:', typeof (image as any).pushDiffRendering);
    console.log('[Mask] image.isAutoReRendering:', (image as any).isAutoReRendering);
    image.addMaskElementId(elementId);
    console.log('[Mask] after addMaskElementId, maskElementIds:', image.maskElementIds);
    console.log('[Mask] image._diffRendering:', (image as any)._diffRendering);

    // Освежаем лазерный стиль маскирующего элемента
    this.canvas.view.refreshLaserStyles([elementId]);

    // Dirty-им изображение для перестраивания clip-path
    this.canvas.shapeManager.dirtyMaskedImages(elementId);
  }

  removeMask(elementId: string): void {
    const mode = this.canvas.maskMode;
    if (!mode) return;

    const image = this.canvas.shapeManager.getById(mode.imageId) as
      | ImageElement
      | undefined;
    if (!image || image.type !== 'image') return;

    image.addMaskElementId(elementId);

    this.canvas.view.refreshLaserStyles([elementId]);

    // Dirty-им изображение
    const sched = this.canvas.scheduler;
    sched.registerDirtyNode(image);
  }

  unmaskImage(imageId: string): void {
    const image = this.canvas.shapeManager.getById(imageId) as
      | ImageElement
      | undefined;
    if (!image || image.type !== 'image') return;

    const oldMaskIds = [...image.maskElementIds];
    image.clearMaskElementIds();

    this.canvas.view.refreshLaserStyles(oldMaskIds);

    const sched = this.canvas.scheduler;
    sched.registerDirtyNode(image);

    this._lockMaskSelection();
  }

  getMaskedElements(imageId: string): string[] {
    const image = this.canvas.shapeManager.getById(imageId) as
      | ImageElement
      | undefined;
    if (!image || image.type !== 'image') return [];
    return [...image.maskElementIds];
  }
}
