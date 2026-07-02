import { NodeDOMFactory } from './NodeDOMFactory';
import { DrawPayload, LayerName } from './types/DrawPayload';

// Интерфейсы для системных классов (чтобы не привязываться к реализации)
interface ISystemNode {
  setId(id: string): void;
}

export class CanvasView {
  private readonly _svgRoot: SVGSVGElement;
  private readonly _factory: NodeDOMFactory;

  // Плоская карта всех элементов на холсте: от фона до рамки выделения
  private _elements = new Map<string, SVGElement>();

  // Ссылки на группы-слои для быстрого поиска при создании элементов
  private _layers = new Map<LayerName, SVGGElement>();

  // Ссылки на корневые системные узлы
  private _defsNode!: SVGDefsElement;
  private _cameraGroup!: SVGGElement;

  constructor(
    svgElement: SVGSVGElement,
    factory: NodeDOMFactory,
    camera: ISystemNode,
    artboard: ISystemNode,
    background: ISystemNode,
  ) {
    this._svgRoot = svgElement;
    this._factory = factory;

    // 1. Генерируем жесткую структуру слоев
    this._buildDOMSkeleton();

    // 2. Генерируем уникальные ID для системных компонентов и связываем их
    this._initSystemNodes(camera, artboard, background);
  }

  /**
   * Сборка стартового каркаса SVG согласно схеме
   */
  private _buildDOMSkeleton(): void {
    this._svgRoot.innerHTML = '';

    // <defs />
    this._defsNode = document.createElementNS('http://w3.org', 'defs');
    this._svgRoot.appendChild(this._defsNode);

    // <g id="cameraGroup">
    this._cameraGroup = document.createElementNS('http://w3.org', 'g');
    this._svgRoot.appendChild(this._cameraGroup);

    // Создаем рабочие слои-группы
    const shapes = document.createElementNS('http://w3.org', 'g');
    const preview = document.createElementNS('http://w3.org', 'g');
    const groupSelection = document.createElementNS('http://w3.org', 'g');
    const overlay = document.createElementNS('http://w3.org', 'g');

    // Раскладываем их по местам в соответствии со структурой
    this._cameraGroup.appendChild(shapes);
    this._cameraGroup.appendChild(preview);
    this._cameraGroup.appendChild(groupSelection);
    this._svgRoot.appendChild(overlay); // overlayRoot вне камеры!

    // Сохраняем ссылки в карту слоев для метода draw()
    this._layers.set('shapesGroup', shapes);
    this._layers.set('previewGroup', preview);
    this._layers.set('groupSelectionOverlay', groupSelection);
    this._layers.set('overlayRoot', overlay);
  }

  /**
   * Регистрация системных узлов в плоской структуре элементов
   */
  private _initSystemNodes(
    camera: ISystemNode,
    artboard: ISystemNode,
    background: ISystemNode,
  ): void {
    const bgId = crypto.randomUUID();
    const camId = crypto.randomUUID();
    const artId = crypto.randomUUID();

    // 1. Создаем и монтируем Бэкграунд (он идет перед cameraGroup)
    const bgEl = this._factory.createDOM('background');
    this._svgRoot.insertBefore(bgEl, this._cameraGroup);
    this._elements.set(bgId, bgEl);
    background.setId(bgId);

    // 2. Связываем камеру (ей не нужен отдельный тег, она управляет самой группой cameraGroup)
    this._elements.set(camId, this._cameraGroup);
    camera.setId(camId);

    // 3. Создаем и монтируем Артборд (первым элементом внутрь cameraGroup)
    const artEl = this._factory.createDOM('artboard');
    this._cameraGroup.insertBefore(artEl, this._cameraGroup.firstChild);
    this._elements.set(artId, artEl);
    artboard.setId(artId);
  }

  /**
   * Главный метод отрисовки (Универсальный draw)
   * Либо создает элемент и монтирует в слой, либо обновляет свойства существующего.
   */
  public draw(payload: DrawPayload): void {
    const { id, type, layerName, ...diff } = payload;
    let element = this._elements.get(id);

    // Если элемента нет — создаем его
    if (!element) {
      if (!layerName) {
        throw new Error(
          `Невозможно создать элемент ${id} (${type}): не указан layerName.`,
        );
      }

      const targetLayer = this._layers.get(layerName);
      if (!targetLayer) {
        throw new Error(`Слой ${layerName} не найден в структуре CanvasView.`);
      }

      // Запрашиваем создание у фабрики
      element = this._factory.createDOM(type);
      element.setAttribute('id', id);

      // Монтируем в DOM и сохраняем в плоскую карту elements
      targetLayer.appendChild(element);
      this._elements.set(id, element);
    }

    // Применяем дифф (мутируем свойства элемента)
    this._applyDiff(element, diff);
  }

  /**
   * Универсальное удаление элемента по ID (фигуры или системного узла)
   */
  public remove(id: string): void {
    const element = this._elements.get(id);
    if (element) {
      element.remove();
      this._elements.delete(id);
    }
  }

  /**
   * Геттер для дефсов (чтобы фабрика могла динамически пушить туда градиенты или паттерны сетки)
   */
  public get defs(): SVGDefsElement {
    return this._defsNode;
  }

  /**
   * Внутренний метод наката изменений на SVG-элемент
   */
  private _applyDiff(element: SVGElement, diff: Record<string, unknown>): void {
    for (const [path, value] of Object.entries(diff)) {
      // Поддержка вложенных стилей (например, "style.stroke": "red")
      if (path.startsWith('style.')) {
        const styleProp = path.split('.')[1];
        const cssProp = styleProp.replace(/([A-Z])/g, '-$1').toLowerCase();
        element.style.setProperty(cssProp, String(value));
        continue;
      }

      // Кастомный маппинг для камеры (если дифф пришел от нее, она меняет матрицу)
      if (path === 'transformMatrix' && value instanceof DOMMatrix) {
        element.setAttribute('transform', value.toString());
        continue;
      }

      // Базовые атрибуты SVG
      if (value === null || value === undefined) {
        element.removeAttribute(path);
      } else {
        element.setAttribute(path, String(value));
      }
    }
  }
}
