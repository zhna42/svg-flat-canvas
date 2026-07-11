import type { ElementType, Point, PathCommand } from './index';
export type { ElementType, Point, PathCommand };

export type ElementSnapshot = Record<string, unknown>;

export interface ElementJSON {
  id: string;
  type: ElementType;
  attributes: Record<string, string>;
  groupId?: string;
  name?: string;
  visible?: boolean;
  lock?: boolean;
  data?: Record<string, unknown>;
  textContent?: string;
}

export interface NodeEditPoint {
  x: number;
  y: number;
  type: 'anchor' | 'control';
  cmdIdx: number;
  ptIdx: number;
  parentAnchor?: { x: number; y: number };
}

export interface GroupData {
  id: string;
  name: string;
  elementIds: string[];
}

export type GroupConflictAction = 'move' | 'cancel';
