export type SnapResult = {
  correctionX: number;
  correctionY: number;
};

export type SnapOptions = {
  targetRects?: DOMRect[];
  listRect?: DOMRect;
};
