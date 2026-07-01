import { RectElement } from '@/shapes/elements/RectElement';
import { PatternElement } from '@/shapes/elements/PatternElement';

export class Background {
  public readonly pattern: PatternElement;
  public readonly fillRect: RectElement;

  public constructor() {
    this.pattern = new PatternElement('bg-checkers');
    this.pattern.cells = [
      { x: 0, y: 0, width: 8, height: 8, fill: '#e0e0e0' },
      { x: 8, y: 8, width: 8, height: 8, fill: '#e0e0e0' },
    ];
    this.pattern.geometry.patternUnits = 'userSpaceOnUse';

    this.fillRect = new RectElement('bg-fill');
    this.fillRect.geometry.x = -10000;
    this.fillRect.geometry.y = -10000;
    this.fillRect.geometry.width = 20000;
    this.fillRect.geometry.height = 20000;
    this.fillRect.style.fill = 'url(#bg-checkers)';
    this.fillRect.style.visible = true;
    this.fillRect.visible = true;
  }
}
