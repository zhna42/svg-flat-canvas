import { CanvasView } from './CanvasView';
import { DrawPayload, LayerName } from './types';

/**
 * Расширяем интерфейс: теперь узел обязан знать, в каком слое он рендерится
 */
interface IRenderableNode {
  id: string;
  type: string;
  layerName: LayerName; // Узел сам хранит информацию о своем слое
  getRenderingDiff(): Record<string, unknown>;
  clearRenderingDiff(): void;
}

export class RenderScheduler {
  private readonly _view: CanvasView;

  // Очередь уникальных "грязных" объектов на текущий кадр
  private _dirtyNodes = new Set<IRenderableNode>();
  private _rafId: number | null = null;

  constructor(view: CanvasView) {
    this._view = view;
  }

  /**
   * Регистрация «грязного» узла для планирования в RAF
   */
  public registerDirtyNode = (node: IRenderableNode): void => {
    this._dirtyNodes.add(node);
    this._requestFrame();
  };

  /**
   * Запрос кадра анимации (RAF)
   */
  private _requestFrame(): void {
    if (this._rafId === null && this._dirtyNodes.size > 0) {
      this._rafId = requestAnimationFrame(this._tick);
    }
  }

  /**
   * Выполнение пакета обновлений в цикле RAF
   */
  private _tick = (): void => {
    this._rafId = null;

    if (this._dirtyNodes.size === 0) return;

    for (const node of this._dirtyNodes) {
      const diff = node.getRenderingDiff();
      // Формируем плоский payload, куда ВСЕГДА подмешиваем layerName узла
      const payload: DrawPayload = {
        id: node.id,
        type: node.type,
        layerName: node.layerName, // Передаем слой при каждом вызове draw
        ...diff,
      };

      // Отправляем на отрисовку в DOM
      this._view.draw(payload);

      // Очищаем локальный дифф внутри узла
      node.clearRenderingDiff();
    }

    // Очищаем очередь для подготовки к следующему кадру
    this._dirtyNodes.clear();
  };
}
