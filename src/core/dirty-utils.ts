type DirtyElement = {
  pushDiffRendering?: ((instance: any) => void) | null;
};

let _globalDirtyFn: ((el: DirtyElement) => void) | null = null;

export const setGlobalDirtyFn = (
  fn: ((el: DirtyElement) => void) | null,
): void => {
  _globalDirtyFn = fn;
};

export const markDirty = (el: DirtyElement): void => {
  if (el.pushDiffRendering) {
    el.pushDiffRendering(el);
  } else if (_globalDirtyFn) {
    _globalDirtyFn(el);
  }
};
