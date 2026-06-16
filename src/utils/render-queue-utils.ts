import type { RenderQueue } from '@/renderer/RenderQueue';

let globalQueue: RenderQueue | null = null;

export const setRenderQueue = (queue: RenderQueue | null): void => {
  globalQueue = queue;
};

export const getRenderQueue = (): RenderQueue | null => globalQueue;
