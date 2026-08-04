import { AbstractGraphicElement } from './AbstractGraphicElement';
import type { Point } from '@/core/type';

export class NodeEditOverlayElement extends AbstractGraphicElement {
  public anchorRects: Record<
    string,
    { x: number; y: number; w: number; h: number; kind: string }
  > = {};
  public controlCircles: Record<string, { cx: number; cy: number; r: number }> = {};
  public handleLines: Record<
    string,
    { x1: number; y1: number; x2: number; y2: number }
  > = {};
  public editing = false;

  public constructor(id: string) {
    super(id, 'overlay' as 'path');
    this.subscribeGeometry(
      'anchorRects',
      'controlCircles',
      'handleLines',
      'editing',
    );
  }

  public getBBox() {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  public buildHitArea(): void {
    /* noop */
  }
  public get hitArea(): Point[] {
    return [];
  }
  protected getGeometryProps(): Record<string, unknown> {
    return {
      _anchors: JSON.stringify(this.anchorRects),
      _controls: JSON.stringify(this.controlCircles),
      _lines: JSON.stringify(this.handleLines),
    };
  }
  protected getGeometrySnapshot(): Record<string, unknown> {
    return {};
  }
  protected applyGeometrySnapshot(_data: Record<string, unknown>): void {
    /* noop */
  }
  protected copyGeometryTo(_clone: AbstractGraphicElement): void {
    /* noop */
  }
  protected flattenTranslateDelta(_dx: number, _dy: number): void {
    /* noop */
  }
  public toOutlinePath() {
    return null as any;
  }
  public toSegmentPolygons(): Point[][] {
    return [];
  }
}
