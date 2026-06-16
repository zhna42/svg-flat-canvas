# External API

## Краткий список

- **Фигуры**: createShape, updateShapes, deleteShapes, moveShapes, rotateShapes, resizeShapes, setTransformShapes
- **Выделение**: selectShapes, clearSelection, getAllShapes
- **Группы**: groupCreate, groupDelete, groupAddElements, groupRemoveElements
- **Утилиты**: sortShapes, setActiveCreationTool

---

## Фигуры

### createShape(dto: CreateShapeDTO): AbstractGraphicElement

Создаёт новую фигуру. Возвращает созданный элемент.

```ts
interface CreateShapeDTO {
  id?: string;              // авто-ID если не указан
  type: ElementType;        // 'rect' | 'circle' | 'ellipse' | 'line' | 'path' | 'polygon' | 'polyline' | 'text' | 'image'
  geometry: ElementGeometryDTO; // типизированная геометрия под каждый type
  style?: StyleDTO;
  transform?: TransformDTO;
  name?: string;
  visible?: boolean;
  lock?: boolean;
  groupId?: string;
  data?: Record<string, unknown>;
}
```

### deleteShapes(dto: DeleteShapesDTO): void

Удаляет фигуры по массиву id. Проксирует `SvgCanvas.deleteElements()` через CommandBus.

```ts
interface DeleteShapesDTO {
  elementIds: string[];
}
```

### updateShapes(dto: UpdateShapesDTO): void

Обновляет свойства нескольких фигур. Все поля опциональны — меняются только переданные.

```ts
interface UpdateShapesDTO {
  elementIds: string[];
  style?: Partial<StyleDTO>;
  transform?: Partial<TransformDTO>;
  geometry?: Partial<ElementGeometryDTO>;
  name?: string;
  visible?: boolean;
  lock?: boolean;
  groupId?: string;
  data?: Record<string, unknown>;
}
```

### moveShapes(dto: MoveShapesDTO): void

Сдвигает фигуры на дельту. Проксирует `createDragMoveCommand` через CommandBus (с записью в TimeMachine).

```ts
interface MoveShapesDTO {
  elementIds: string[];
  delta: Point; // { x: number; y: number }
}
```

### rotateShapes(dto: RotateShapesDTO): void

Поворачивает фигуры на угол (градусы). Проксирует `createRotateCommand`.

```ts
interface RotateShapesDTO {
  elementIds: string[];
  angle: number;
}
```

### resizeShapes(dto: ResizeShapesDTO): void

Ресайзит фигуры. Проксирует `createResizeCommand`.

```ts
interface ResizeShapesDTO {
  elementIds: string[];
  bbox: { x: number; y: number; width: number; height: number };
}
```

### setTransformShapes(dto: SetTransformShapesDTO): void

Прямая установка DOMMatrix для фигур. Проксирует `createTransformCommand`.

```ts
interface SetTransformShapesDTO {
  elementIds: string[];
  matrix: [number, number, number, number, number, number]; // [a, b, c, d, e, f]
}
```

---

## Вспомогательные DTO

### StyleDTO

```ts
interface StyleDTO {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  visible?: boolean;
}
```

### TransformDTO

```ts
interface TransformDTO {
  x?: number;       // абсолютная позиция (не дельта)
  y?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  matrix?: [number, number, number, number, number, number]; // приоритетнее отдельных полей
}
```

### ElementGeometryDTO

Дискриминируется по `type` в `createShape`:

| type      | DTO                                           |
|-----------|-----------------------------------------------|
| rect      | RectGeometryDTO: x, y, width, height, rx?, ry? |
| circle    | CircleGeometryDTO: cx, cy, r                   |
| ellipse   | EllipseGeometryDTO: cx, cy, rx, ry             |
| line      | LineGeometryDTO: x1, y1, x2, y2               |
| path      | PathGeometryDTO: d                             |
| polygon   | PolygonGeometryDTO: points                     |
| polyline  | PolylineGeometryDTO: points                    |
| text      | TextGeometryDTO: x, y, fontSize?, fontFamily?, textAnchor?, textContent? |
| image     | ImageGeometryDTO: x, y, width, height, href    |

---

## Выделение

### selectShapes(dto: SelectShapesDTO): void

Устанавливает выделение по массиву id. При `toggle: true` переключает: если элемент уже выделен — снимает, если нет — добавляет.

```ts
interface SelectShapesDTO {
  elementIds: string[];
  toggle?: boolean; // default: false
}
```

### clearSelection(): void

Снимает выделение со всех фигур.

### getAllShapes(): readonly AbstractGraphicElement[]

Возвращает массив текущих выделенных элементов.

---

## Группы

### groupCreate(dto: GroupCreateDTO): string

Создаёт пустую группу, возвращает её id.

```ts
interface GroupCreateDTO {
  name?: string;
}
```

### groupDelete(dto: GroupDeleteDTO): void

Удаляет группу по id. Элементы группы **не удаляются**.

```ts
interface GroupDeleteDTO {
  groupId: string;
}
```

### groupAddElements(dto: GroupAddElementsDTO): void

Добавляет фигуры в группу.

```ts
interface GroupAddElementsDTO {
  groupId: string;
  elementIds: string[];
}
```

### groupRemoveElements(dto: GroupRemoveElementsDTO): void

Удаляет фигуры из группы. Сами фигуры не удаляются.

```ts
interface GroupRemoveElementsDTO {
  groupId: string;
  elementIds: string[];
}
```

---

## Утилиты

### sortShapes(dto: SortShapesDTO): void

Меняет z-order: перемещает фигуры до/после указанной целевой фигуры.

```ts
interface SortShapesDTO {
  elementIds: string[];
  targetId: string;
  position: 'before' | 'after';
}
```

### setActiveCreationTool(type: ElementType | null): void

Включает/выключает режим создания фигур мышкой. Разрешённые типы: rect, circle, ellipse, line, polyline, polygon.

---

## Подключение

```ts
import { SvgCanvas, ExternalApi } from 'svg-editor';

const canvas = new SvgCanvas(container);
const api = canvas.getExternalApi();

const rect = api.createShape({
  type: 'rect',
  geometry: { x: 10, y: 10, width: 100, height: 50 },
  style: { fill: '#ff0000', stroke: '#000', strokeWidth: 2 },
});

api.selectShapes({ elementIds: [rect.id] });
api.moveShapes({ elementIds: [rect.id], delta: { x: 50, y: 0 } });
```
