declare module 'd3-contour' {
  export function contours(): {
    size(size: [number, number]): ReturnType<typeof contours>;
    contour(
      grid: Float64Array | number[],
      threshold: number,
    ): {
      type: 'MultiPolygon';
      value: number;
      coordinates: Array<Array<Array<[number, number]>>>;
    };
    thresholds(count: number): ReturnType<typeof contours>;
  };
}
