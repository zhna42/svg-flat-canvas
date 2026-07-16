declare module 'simplify-js' {
  interface Point { x: number; y: number }
  function simplify(points: Point[], tolerance?: number, highestQuality?: boolean): Point[];
  export = simplify;
}
