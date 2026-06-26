export class ColorMap {
  private _fillMap = new Map<string, Set<string>>();
  private _strokeMap = new Map<string, Set<string>>();
  private _step = 16;

  public get step(): number {
    return this._step;
  }

  public get fillMap(): ReadonlyMap<string, ReadonlySet<string>> {
    return this._fillMap;
  }

  public get strokeMap(): ReadonlyMap<string, ReadonlySet<string>> {
    return this._strokeMap;
  }

  public static quantize(r: number, g: number, b: number, step = 16): string {
    const qr = Math.min(255, Math.round(r / step) * step);
    const qg = Math.min(255, Math.round(g / step) * step);
    const qb = Math.min(255, Math.round(b / step) * step);
    return `${qr},${qg},${qb}`;
  }

  public setStep(step: number): void {
    this._step = step;
  }

  public recalculate(
    elements: Array<{
      id: string;
      fill: string;
      stroke: string;
    }>,
  ): void {
    this._fillMap.clear();
    this._strokeMap.clear();

    for (const el of elements) {
      if (el.fill && el.fill !== 'none') {
        const key = this.getFillKey(el.fill);
        this.addToFillMap(key, el.id);
      }
      if (el.stroke && el.stroke !== 'none') {
        const key = this.getStrokeKey(el.stroke);
        this.addToStrokeMap(key, el.id);
      }
    }
  }

  public getFillKey(color: string): string {
    const { r, g, b } = this.parseColor(color);
    return ColorMap.quantize(r, g, b, this._step);
  }

  public getStrokeKey(color: string): string {
    const { r, g, b } = this.parseColor(color);
    return ColorMap.quantize(r, g, b, this._step);
  }

  public addToFillMap(key: string, id: string): void {
    let set = this._fillMap.get(key);
    if (!set) {
      set = new Set();
      this._fillMap.set(key, set);
    }
    set.add(id);
  }

  public removeFromFillMap(key: string, id: string): void {
    const set = this._fillMap.get(key);
    if (set) set.delete(id);
  }

  public addToStrokeMap(key: string, id: string): void {
    let set = this._strokeMap.get(key);
    if (!set) {
      set = new Set();
      this._strokeMap.set(key, set);
    }
    set.add(id);
  }

  public removeFromStrokeMap(key: string, id: string): void {
    const set = this._strokeMap.get(key);
    if (set) set.delete(id);
  }

  private parseColor(color: string): { r: number; g: number; b: number } {
    if (!color || color === 'none') return { r: 0, g: 0, b: 0 };

    if (color.startsWith('#')) {
      const hex = color.replace('#', '');
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16),
        };
      }
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
      };
    }

    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      return {
        r: parseInt(match[1], 10),
        g: parseInt(match[2], 10),
        b: parseInt(match[3], 10),
      };
    }

    const named: Record<string, { r: number; g: number; b: number }> = {
      red: { r: 255, g: 0, b: 0 },
      green: { r: 0, g: 128, b: 0 },
      blue: { r: 0, g: 0, b: 255 },
      white: { r: 255, g: 255, b: 255 },
      black: { r: 0, g: 0, b: 0 },
      gray: { r: 128, g: 128, b: 128 },
      grey: { r: 128, g: 128, b: 128 },
      yellow: { r: 255, g: 255, b: 0 },
      cyan: { r: 0, g: 255, b: 255 },
      magenta: { r: 255, g: 0, b: 255 },
      orange: { r: 255, g: 165, b: 0 },
      purple: { r: 128, g: 0, b: 128 },
      pink: { r: 255, g: 192, b: 203 },
    };
    if (named[color.toLowerCase()]) return named[color.toLowerCase()];

    return { r: 0, g: 0, b: 0 };
  }
}
