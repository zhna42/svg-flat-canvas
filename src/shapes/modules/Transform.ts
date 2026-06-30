import type { Point } from '@/types';

export class Transform {
  public matrix = new DOMMatrix();

  public get x(): number {
    return this.matrix.e;
  }

  public get y(): number {
    return this.matrix.f;
  }

  public get scaleX(): number {
    return (
      Math.sqrt(this.matrix.a * this.matrix.a + this.matrix.b * this.matrix.b) *
      (this.matrix.a < 0 ? -1 : 1)
    );
  }

  public get scaleY(): number {
    return (
      Math.sqrt(this.matrix.c * this.matrix.c + this.matrix.d * this.matrix.d) *
      (this.matrix.d < 0 ? -1 : 1)
    );
  }

  public get angle(): number {
    return Math.atan2(this.matrix.b, this.matrix.a) * (180 / Math.PI);
  }

  public applyTranslate(dx: number, dy: number, angleDeg: number): void {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const localX = dx * cos + dy * sin;
    const localY = -dx * sin + dy * cos;
    const m = new DOMMatrix().translateSelf(localX, localY);
    this.matrix = m.multiply(this.matrix);
  }

  public applyRotate(
    angleDelta: number,
    localCenter: Point,
    startingMatrix: DOMMatrix,
  ): void {
    const globalCenter = startingMatrix.transformPoint({
      x: localCenter.x,
      y: localCenter.y,
    });
    this.matrix = new DOMMatrix()
      .translateSelf(globalCenter.x, globalCenter.y)
      .rotateSelf(0, 0, angleDelta)
      .translateSelf(-globalCenter.x, -globalCenter.y)
      .multiply(startingMatrix);
  }

  public applyScale(
    delta: Record<string, number>,
    startingMatrix: DOMMatrix,
  ): void {
    const baseScaleX =
      Math.sqrt(
        startingMatrix.a * startingMatrix.a +
          startingMatrix.b * startingMatrix.b,
      ) * (startingMatrix.a < 0 ? -1 : 1);
    const baseScaleY =
      Math.sqrt(
        startingMatrix.c * startingMatrix.c +
          startingMatrix.d * startingMatrix.d,
      ) * (startingMatrix.d < 0 ? -1 : 1);
    const localDeltaX = (delta.x ?? 0) / baseScaleX;
    const localDeltaY = (delta.y ?? 0) / baseScaleY;
    const factorX = 1 + localDeltaX / (delta.width || 1);
    const factorY = 1 + localDeltaY / (delta.height || 1);
    if (factorX <= 0 || factorY <= 0) return;
    const localOrigin = new DOMMatrix(startingMatrix.toString())
      .invertSelf()
      .transformPoint({ x: delta.originX ?? 0, y: delta.originY ?? 0 });
    const m = new DOMMatrix()
      .translateSelf(startingMatrix.e, startingMatrix.f)
      .rotateSelf(
        0,
        0,
        (Math.atan2(startingMatrix.b, startingMatrix.a) * 180) / Math.PI,
      )
      .translateSelf(localOrigin.x, localOrigin.y)
      .scaleSelf(factorX, factorY)
      .translateSelf(-localOrigin.x, -localOrigin.y);
    this.matrix = m;
  }

  public transformPoint(p: Point): Point {
    return this.matrix.transformPoint({ x: p.x, y: p.y });
  }

  public reset(): void {
    this.matrix = new DOMMatrix();
  }

  public toArray(): number[] {
    return [this.matrix.a, this.matrix.b, this.matrix.c, this.matrix.d, this.matrix.e, this.matrix.f];
  }

  public translate(dx: number, dy: number): void {
    this.applyTranslate(dx, dy, this.angle);
    this.matrix = new DOMMatrix(this.matrix.toString());
  }

  public rotate(angle: number, localCenter: Point): void {
    this.applyRotate(angle, localCenter, this.matrix);
    this.matrix = new DOMMatrix(this.matrix.toString());
  }

  public scale(delta: Record<string, number>): void {
    this.applyScale(delta, this.matrix);
    this.matrix = new DOMMatrix(this.matrix.toString());
  }
}
