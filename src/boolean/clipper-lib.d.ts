declare module 'clipper-lib' {
  class Clipper {
    static ioReverseSolution: number;
    static ioStrictlySimple: number;
    static ioPreserveCollinear: number;
    constructor(initOptions?: number);
    AddPath(pg: IntPoint[], polyType: number, closed: boolean): boolean;
    AddPaths(ppg: IntPoint[][], polyType: number, closed: boolean): boolean;
    Clear(): void;
    Execute(
      clipType: number,
      solution: IntPoint[][],
      subjFillType?: number,
      clipFillType?: number,
    ): boolean;
  }

  interface Path extends Array<IntPoint> {}

  class Paths extends Array<Path> {}

  const ClipType: {
    ctIntersection: number;
    ctUnion: number;
    ctDifference: number;
    ctXor: number;
  };

  const PolyType: {
    ptSubject: number;
    ptClip: number;
  };

  const PolyFillType: {
    pftEvenOdd: number;
    pftNonZero: number;
    pftPositive: number;
    pftNegative: number;
  };

  interface IntPoint {
    X: number;
    Y: number;
  }
}

