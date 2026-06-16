export class Style {
  public fill = '';
  public stroke = '';
  public strokeWidth = 0;
  public opacity = 1;
  public visible = true;

  public setFill(color: string): void {
    this.fill = color;
  }

  public setStroke(color: string): void {
    this.stroke = color;
  }

  public setStrokeWidth(w: number): void {
    this.strokeWidth = w;
  }

  public setOpacity(v: number): void {
    this.opacity = v;
  }

  public get hasFill(): boolean {
    return this.fill !== '' && this.fill !== 'none';
  }

  public get effectiveStrokeWidth(): number {
    return Math.max(this.strokeWidth, 6);
  }

  public getProps(): Record<string, unknown> {
    return {
      fill: this.fill,
      stroke: this.stroke,
      strokeWidth: this.strokeWidth,
      opacity: this.opacity,
      visible: this.visible,
    };
  }
}
