declare module 'fit-curves' {
  type Point = [number, number];
  type BezierCurve = [Point, Point, Point, Point];
  export default function fitCurve(points: Point[], maxError: number): BezierCurve[];
}
