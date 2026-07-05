import { ReactiveNode } from '@/core/ReactiveNode';
import type { LayerName, IRenderableNode } from '@/types';
import { pointInPolygon } from '@/core/HitTestEngine';

export type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface HandleHitArea {
  handle: HandlePosition;
  points: Array<{ x: number; y: number }>;
}

const HW = 6;
const HH = 10;

function computeHandleHitAreas(w: number, h: number): HandleHitArea[] {
  const hw = w / 2;
  const hh = h / 2;
  const oc = 7;
  const oe = 12;

  const positions: Array<{ handle: HandlePosition; cx: number; cy: number }> = [
    { handle: 'nw', cx: -oc,   cy: -oc   },
    { handle: 'n',  cx: hw,    cy: -oe   },
    { handle: 'ne', cx: w + oc, cy: -oc   },
    { handle: 'e',  cx: w + oe, cy: hh    },
    { handle: 'se', cx: w + oc, cy: h + oc },
    { handle: 's',  cx: hw,    cy: h + oe },
    { handle: 'sw', cx: -oc,   cy: h + oc },
    { handle: 'w',  cx: -oe,   cy: hh    },
  ];

  return positions.map((p) => ({
    handle: p.handle,
    points: [
      { x: p.cx - HW, y: p.cy - HH },
      { x: p.cx + HW, y: p.cy - HH },
      { x: p.cx + HW, y: p.cy + HH },
      { x: p.cx - HW, y: p.cy + HH },
    ],
  }));
}

export class BaseSelectionBox extends ReactiveNode {
  public x = 0;
  public y = 0;
  public width = 0;
  public height = 0;
  public angle = 0;
  public visible = false;

  public _domRef: string | null = null;

  public readonly targetId: string;
  public readonly isGroup: boolean;

  constructor(
    id: string,
    targetId: string,
    isGroup: boolean,
    registerDirty: (node: IRenderableNode) => void,
  ) {
    super(id, 'selection-box', 'selectionOverlay' as LayerName);
    this.targetId = targetId;
    this.isGroup = isGroup;
    this.pushDiffRendering = registerDirty;
  }

  setData(x: number, y: number, w: number, h: number, angle: number): void {
    this.x = x;
    this.y = y;
    this.width = Math.max(w, 1);
    this.height = Math.max(h, 1);
    this.angle = angle;
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }

  public override getRenderingPayload(): Record<string, unknown> {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      angle: this.angle,
      visible: this.visible,
    };
  }

  hitTestHandle(worldX: number, worldY: number): HandlePosition | null {
    if (!this.visible) return null;

    const hw = this.width / 2;
    const hh = this.height / 2;
    const rx = worldX - this.x - hw;
    const ry = worldY - this.y - hh;

    const angleRad = (-this.angle * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const localX = rx * cos - ry * sin + hw;
    const localY = rx * sin + ry * cos + hh;

    for (const ha of computeHandleHitAreas(this.width, this.height)) {
      if (pointInPolygon(localX, localY, ha.points)) return ha.handle;
    }
    return null;
  }

  destroy(): void {
    this.visible = false;
  }
}
