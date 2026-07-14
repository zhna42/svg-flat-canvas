export class CanvasClipPath {
  readonly _elements: Map<string, SVGElement>;
  readonly _defsNode: SVGDefsElement;
  /** Обратный индекс: maskElementId → Set<imageId> */
  _maskToImages = new Map<string, Set<string>>();

  constructor(
    elements: Map<string, SVGElement>,
    defsNode: SVGDefsElement,
  ) {
    this._elements = elements;
    this._defsNode = defsNode;
  }

  sync(imageId: string, diff: Record<string, unknown>): void {
    if (!('maskElementIds' in diff)) return;

    const imageEl = this._elements.get(imageId);
    if (!imageEl) return;

    const maskIds = diff.maskElementIds as string[] | undefined;

    this._updateReverseIndex(imageId, maskIds ?? []);

    if (!maskIds || maskIds.length === 0) {
      imageEl.removeAttribute('clip-path');
      this._removeClipNode(imageId);
      return;
    }

    this._rebuildClipPath(imageId, maskIds, imageEl);
  }

  /** Перестраивает clip-path для картинки (при движении/изменении маски). */
  refreshImage(imageId: string): void {
    const imageEl = this._elements.get(imageId);
    if (!imageEl) return;

    const maskIds = Array.from(this._maskToImages.entries())
      .filter(([, imageSet]) => imageSet.has(imageId))
      .map(([maskId]) => maskId);

    if (maskIds.length === 0) {
      imageEl.removeAttribute('clip-path');
      this._removeClipNode(imageId);
      return;
    }

    this._rebuildClipPath(imageId, maskIds, imageEl);
  }

  /** Проверяет, есть ли у картинки активный clip-path (используется как маска). */
  hasClipPath(imageId: string): boolean {
    const imageEl = this._elements.get(imageId);
    if (!imageEl) return false;
    return imageEl.hasAttribute('clip-path');
  }

  /** Возвращает maskIds для заданной картинки. */
  getMaskIdsForImage(imageId: string): string[] {
    return Array.from(this._maskToImages.entries())
      .filter(([, imageSet]) => imageSet.has(imageId))
      .map(([maskId]) => maskId);
  }

  private _rebuildClipPath(
    imageId: string,
    maskIds: string[],
    imageEl: SVGElement,
  ): void {
    const clipId = `clip-mask-${imageId}`;
    let clipNode = this._defsNode.querySelector(
      `#${clipId}`,
    ) as SVGClipPathElement | null;

    if (!clipNode) {
      clipNode = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'clipPath',
      );
      clipNode.setAttribute('id', clipId);
      this._defsNode.appendChild(clipNode);
    }

    clipNode.innerHTML = '';

    const imageMatrix = this._readMatrix(imageEl);

    for (const maskId of maskIds) {
      const maskEl = this._elements.get(maskId);
      if (!maskEl) continue;

      const maskMatrix = this._readMatrix(maskEl);
      const relative = this._relativeMatrix(imageMatrix, maskMatrix);

      const clone = maskEl.cloneNode(true) as SVGElement;
      clone.removeAttribute('id');
      clone.removeAttribute('fill');
      clone.removeAttribute('stroke');
      clone.removeAttribute('style');
      clone.removeAttribute('stroke-width');
      clone.removeAttribute('opacity');
      clone.removeAttribute('visibility');

      clone.setAttribute(
        'transform',
        `matrix(${relative.a},${relative.b},${relative.c},${relative.d},${relative.e},${relative.f})`,
      );

      clipNode.appendChild(clone);
    }

    imageEl.setAttribute('clip-path', `url(#${clipId})`);
  }

  private _readMatrix(el: SVGElement): DOMMatrix {
    const t = el.getAttribute('transform');
    if (!t) return new DOMMatrix();
    try {
      const m = new DOMMatrix(t);
      return m.is2D ? m : new DOMMatrix();
    } catch {
      return new DOMMatrix();
    }
  }

  private _relativeMatrix(
    imageMatrix: DOMMatrix,
    maskMatrix: DOMMatrix,
  ): DOMMatrix {
    try {
      const inv = imageMatrix.inverse();
      return inv.multiply(maskMatrix);
    } catch {
      return maskMatrix;
    }
  }

  /** Возвращает ID картинок, которые маскируются данным элементом. */
  getMaskedImageIds(maskElementId: string): string[] {
    const set = this._maskToImages.get(maskElementId);
    return set ? Array.from(set) : [];
  }

  /** Чистит defs и обратный индекс при удалении элемента. */
  remove(elementId: string): void {
    this._removeClipNode(elementId);
    this._maskToImages.delete(elementId);
    for (const [, imageSet] of this._maskToImages) {
      imageSet.delete(elementId);
    }
    const affectedImages = Array.from(this._maskToImages.entries())
      .filter(([, imageSet]) => imageSet.size === 0)
      .map(([maskId]) => maskId);
    for (const id of affectedImages) {
      this._maskToImages.delete(id);
    }
  }

  private _updateReverseIndex(imageId: string, maskIds: string[]): void {
    for (const [, imageSet] of this._maskToImages) {
      imageSet.delete(imageId);
    }
    for (const maskId of maskIds) {
      let imageSet = this._maskToImages.get(maskId);
      if (!imageSet) {
        imageSet = new Set();
        this._maskToImages.set(maskId, imageSet);
      }
      imageSet.add(imageId);
    }
  }

  private _removeClipNode(id: string): void {
    const node = this._defsNode.querySelector(`#clip-mask-${id}`);
    node?.remove();
  }
}
