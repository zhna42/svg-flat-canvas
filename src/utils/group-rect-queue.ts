import type { RenderQueue } from '@/renderer/RenderQueue';

let globalQueue: RenderQueue | null = null;

export const setGroupRectQueue = (queue: RenderQueue | null): void => {
  globalQueue = queue;
};

export const getGroupRectQueue = (): RenderQueue | null => globalQueue;
