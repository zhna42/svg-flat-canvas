import type { ColorMap } from '@/core/color/ColorMap';
import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';

export class ColorIndexer {
  constructor(private readonly colorMap: ColorMap) {}

  get fillMap(): ReadonlyMap<string, ReadonlySet<string>> {
    return this.colorMap.fillMap;
  }

  get strokeMap(): ReadonlyMap<string, ReadonlySet<string>> {
    return this.colorMap.strokeMap;
  }

  setStep(step: number): void {
    this.colorMap.setStep(step);
  }

  add(el: AbstractGraphicElement): void {
    if (el.style.fill && el.style.fill !== 'none') {
      const key = this.colorMap.getFillKey(el.style.fill);
      this.colorMap.addToFillMap(key, el.id);
      el.data._prevFillKey = key;
    }
    if (el.style.stroke && el.style.stroke !== 'none') {
      const key = this.colorMap.getStrokeKey(el.style.stroke);
      this.colorMap.addToStrokeMap(key, el.id);
      el.data._prevStrokeKey = key;
    }
  }

  update(el: AbstractGraphicElement): void {
    const oldFillKey = (el.data._prevFillKey as string) || null;
    const oldStrokeKey = (el.data._prevStrokeKey as string) || null;
    if (oldFillKey) this.colorMap.removeFromFillMap(oldFillKey, el.id);
    if (oldStrokeKey) this.colorMap.removeFromStrokeMap(oldStrokeKey, el.id);

    let newFillKey: string | null = null;
    let newStrokeKey: string | null = null;
    if (el.style.fill && el.style.fill !== 'none') {
      newFillKey = this.colorMap.getFillKey(el.style.fill);
      this.colorMap.addToFillMap(newFillKey, el.id);
    }
    if (el.style.stroke && el.style.stroke !== 'none') {
      newStrokeKey = this.colorMap.getStrokeKey(el.style.stroke);
      this.colorMap.addToStrokeMap(newStrokeKey, el.id);
    }
    el.data._prevFillKey = newFillKey;
    el.data._prevStrokeKey = newStrokeKey;
  }

  recalculate(elements: AbstractGraphicElement[]): void {
    this.colorMap.recalculate(
      elements.map((el) => ({
        id: el.id,
        fill: el.style.fill,
        stroke: el.style.stroke,
      })),
    );
  }
}
