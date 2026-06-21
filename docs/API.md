# External API Reference

## Методы

### Создание элементов

| Метод | Описание |
|---|---|
| `createShape(dto: CreateShapeDTO)` | Создать элемент (rect, circle, ellipse, line, polyline, polygon, path, text, image) |
| `createFile(dtos: CreateShapeDTO[], name?: string)` | Создать несколько элементов как группу-файл, возвращает `{ groupId, elements }` |

### Редактирование

| Метод | Описание |
|---|---|
| `updateShapes(dto: UpdateShapesDTO)` | Обновить стили, трансформ, геометрию, имя, видимость, блокировку, groupId, data |
| `moveShapes(dto: MoveShapesDTO)` | Сдвинуть элементы на дельту |
| `rotateShapes(dto: RotateShapesDTO)` | Повернуть элементы на угол |
| `resizeShapes(dto: ResizeShapesDTO)` | Изменить размер по bbox |
| `setTransformShapes(dto: SetTransformShapesDTO)` | Применить матрицу трансформации |
| `deleteShapes(dto: DeleteShapesDTO)` | Удалить элементы |
| `sortShapes(dto: SortShapesDTO)` | Переместить элементы (before/after target) |

### Группы

| Метод | Описание |
|---|---|
| `groupCreate(dto: GroupCreateDTO)` | Создать группу, возвращает groupId |
| `groupDelete(dto: GroupDeleteDTO)` | Удалить группу |
| `groupAddElements(dto: GroupAddElementsDTO)` | Добавить элементы в группу |
| `groupRemoveElements(dto: GroupRemoveElementsDTO)` | Удалить элементы из группы |

### Выделение

| Метод | Описание |
|---|---|
| `selectShapes(dto: SelectShapesDTO)` | Выбрать элементы (с режимом toggle) |
| `clearSelection()` | Сбросить выделение |
| `getAllShapes()` | Вернуть все выбранные элементы |

### Холст

| Метод | Описание |
|---|---|
| `getCanvasSize()` | Размер холста: `{ widthMM, heightMM, widthPx, heightPx, pxPerMM }` |
| `setActiveCreationTool(type: ElementType \| null)` | Включить инструмент рисования (rect, circle, ellipse, line, polyline, polygon, path, null) |
| `setPanMode(enabled: boolean)` | Включить/выключить режим панорамирования |

### Подписка на события

| Метод | Описание |
|---|---|
| `on(type: string, fn: (event: BusEvent) => void)` | Подписаться на событие, возвращает `() => void` для отписки |
| `off(type: string, fn: (event: BusEvent) => void)` | Отписаться |

Событие `BusEvent`: `{ type: string, data: unknown }`

Для `type = '*'` — подписка на все события. Слушатель получает `data` напрямую (без обёртки `BusEvent`).

---

## Команды (эмитят `SVG_CAD_{COMMAND}` с `diff: Record<elementId, { type, changed поля }>`)

| Команда | Событие | Diff содержит |
|---|---|---|
| `CREATE` | `SVG_CAD_CREATE` | type, id, fill, stroke, matrix, geometry… |
| `DELETE` | `SVG_CAD_DELETE` | type: '', все поля null |
| `DRAG_END` | `SVG_CAD_DRAG_END` | type, matrix (+ mode: element/group) |
| `RESIZE` | `SVG_CAD_RESIZE` | type, matrix |
| `ROTATE` | `SVG_CAD_ROTATE` | type, matrix |
| `TRANSFORM` | `SVG_CAD_TRANSFORM` | type, matrix |
| `SELECT` | `SVG_CAD_SELECT` | `{}` пустой (+ mode: element/group) |
| `GEOMETRY_MUTATE` | `SVG_CAD_GEOMETRY_MUTATE` | type, commands |
| `PATH_ADD_NODE` | `SVG_CAD_PATH_ADD_NODE` | type, commands |
| `PATH_REMOVE_NODE` | `SVG_CAD_PATH_REMOVE_NODE` | type, commands |
| `PATH_CHANGE_NODE_TYPE` | `SVG_CAD_PATH_CHANGE_NODE_TYPE` | type, commands |
| `PATH_MOVE_SUBPATH` | `SVG_CAD_PATH_MOVE_SUBPATH` | type, commands |
| `CREATE_FILE` | `SVG_CAD_CREATE_FILE` | type, matrix, groupId… |
| `GROUP_CREATE` | `SVG_CAD_GROUP_CREATE` | — |
| `GROUP_DELETE` | `SVG_CAD_GROUP_DELETE` | — |
| `GROUP_ADD` | `SVG_CAD_GROUP_ADD` | — |
| `GROUP_REMOVE` | `SVG_CAD_GROUP_REMOVE` | — |
| `GROUP_CLEAR` | `SVG_CAD_GROUP_CLEAR` | — |

---

## Интерфейсы DTO

```typescript
// --- Стили ---
interface StyleDTO {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  visible?: boolean;
}

// --- Трансформация ---
interface TransformDTO {
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  matrix?: [number, number, number, number, number, number];
}

// --- Геометрия ---
interface RectGeometryDTO {
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
  ry?: number;
}

interface CircleGeometryDTO {
  cx: number;
  cy: number;
  r: number;
}

interface EllipseGeometryDTO {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

interface LineGeometryDTO {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface PathGeometryDTO {
  d: string;
}

interface PolygonGeometryDTO {
  points: string;
}

interface PolylineGeometryDTO {
  points: string;
}

interface TextGeometryDTO {
  x: string;
  y: string;
  fontSize?: string;
  fontFamily?: string;
  textAnchor?: string;
  textContent?: string;
}

interface ImageGeometryDTO {
  x: number;
  y: number;
  width: number;
  height: number;
  href: string;
}

type ElementGeometryDTO =
  | RectGeometryDTO
  | CircleGeometryDTO
  | EllipseGeometryDTO
  | LineGeometryDTO
  | PathGeometryDTO
  | PolygonGeometryDTO
  | PolylineGeometryDTO
  | TextGeometryDTO
  | ImageGeometryDTO;

// --- CRUD ---
interface CreateShapeDTO {
  id?: string;
  type: ElementType;
  geometry: ElementGeometryDTO;
  style?: StyleDTO;
  transform?: TransformDTO;
  name?: string;
  visible?: boolean;
  lock?: boolean;
  groupId?: string;
  data?: Record<string, unknown>;
}

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

interface DeleteShapesDTO {
  elementIds: string[];
}

interface MoveShapesDTO {
  elementIds: string[];
  delta: { x: number; y: number };
}

interface RotateShapesDTO {
  elementIds: string[];
  angle: number;
}

interface ResizeShapesDTO {
  elementIds: string[];
  bbox: { x: number; y: number; width: number; height: number };
}

interface SetTransformShapesDTO {
  elementIds: string[];
  matrix: [number, number, number, number, number, number];
}

// --- Выделение ---
interface SelectShapesDTO {
  elementIds: string[];
  toggle?: boolean;
}

interface SortShapesDTO {
  elementIds: string[];
  targetId: string;
  position: 'before' | 'after';
}

// --- Группы ---
interface GroupCreateDTO {
  name?: string;
}

interface GroupDeleteDTO {
  groupId: string;
}

interface GroupAddElementsDTO {
  groupId: string;
  elementIds: string[];
}

interface GroupRemoveElementsDTO {
  groupId: string;
  elementIds: string[];
}

// --- Типы элементов ---
type ElementType =
  | 'rect' | 'circle' | 'ellipse' | 'line'
  | 'polyline' | 'polygon' | 'path'
  | 'text' | 'image';
```
