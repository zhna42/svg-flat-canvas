import type { SvgCanvas } from '@/canvas/SvgCanvas';
import type { BusEvent } from '@/core/type';
import { DebugLog } from '@/canvas/overlays/debug/DebugLog';
import { ShapeController } from './controllers/ShapeController';
import { GroupController } from './controllers/GroupController';
import { SelectionController } from './controllers/SelectionController';
import { CanvasController } from './controllers/CanvasController';
import { SnapController } from './controllers/SnapController';
import { HistoryController } from './controllers/HistoryController';
import { LaserController } from './controllers/LaserController';
import { TextEditController } from './controllers/TextEditController';
import { MeasureController } from './controllers/MeasureController';
import { NodeEditController } from './controllers/NodeEditController';
import { ClipboardController } from './controllers/ClipboardController';
import { DataController } from './controllers/DataController';
import { FlexTreeController } from './controllers/FlexTreeController';
import { RasterController } from '../raster';
import { MaskController } from './controllers/MaskController';
import { ZOrderController } from './controllers/ZOrderController';
import { BakeController } from './controllers/BakeController';
import { MergeController } from './controllers/MergeController';
import { TextToPathController } from './controllers/TextToPathController';

export class ExternalApi {
  private readonly _canvas: SvgCanvas;
  private readonly dbg = new DebugLog();

  readonly shapes: ShapeController;
  readonly groups: GroupController;
  readonly selection: SelectionController;
  readonly canvas: CanvasController;
  readonly snap: SnapController;
  readonly history: HistoryController;
  readonly laser: LaserController;
  readonly textEdit: TextEditController;
  readonly measure: MeasureController;
  readonly nodeEdit: NodeEditController;
  readonly clipboard: ClipboardController;
  readonly data: DataController;
  readonly flexTree: FlexTreeController;
  readonly raster: RasterController;
  readonly mask: MaskController;
  readonly zOrder: ZOrderController;
  readonly bake: BakeController;
  readonly merge: MergeController;
  readonly textToPath: TextToPathController;

  constructor(canvas: SvgCanvas) {
    this._canvas = canvas;
    this.shapes = new ShapeController(canvas);
    this.groups = new GroupController(canvas);
    this.selection = new SelectionController(canvas);
    this.canvas = new CanvasController(canvas);
    this.snap = new SnapController(canvas);
    this.history = new HistoryController(canvas);
    this.laser = new LaserController(canvas);
    this.textEdit = new TextEditController(canvas);
    this.measure = new MeasureController(canvas);
    this.nodeEdit = new NodeEditController(canvas);
    this.clipboard = new ClipboardController(canvas);
    this.data = new DataController(canvas);
    this.flexTree = new FlexTreeController(canvas);
    this.raster = new RasterController(canvas);
    this.mask = new MaskController(canvas);
    this.zOrder = new ZOrderController(canvas);
    this.bake = new BakeController(canvas);
    this.merge = new MergeController(canvas);
    this.textToPath = new TextToPathController(canvas);
  }

  // ── События ──

  on(type: string, fn: (event: BusEvent) => void): () => void {
    this.dbg.log('API', `on ${type}`);
    return this._canvas.events.on(type, fn);
  }

  off(type: string, fn: (event: BusEvent) => void): void {
    this.dbg.log('API', `off ${type}`);
    this._canvas.events.off(type, fn);
  }

  // ── Жизненный цикл ──

  destroy(): void {
    this._canvas.svg.remove();
    this._canvas.eventManager.destroy();
    this._canvas.shapeManager.clear();
    this._canvas.groupManager.destroy();
  }
}
