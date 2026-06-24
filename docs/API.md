# ExternalApi

## События

| Метод | Описание |
|---|---|
| `on(type, fn)` | Подписка на событие, возвращает функцию отписки. `type = '*'` — все события |
| `off(type, fn)` | Отписка от события |

### Типы событий

| Событие | `data` | Когда |
|---|---|---|
| `SVG_CAD_SELECT` | `{ mode, elementIds, diff }` | Изменение селекта |
| `SVG_CAD_PAN_MODE_CHANGED` | `{ enabled }` | Вкл/выкл режим панорамирования |
| `RULER_VISIBILITY_CHANGED` | `{ visible }` | Изменение видимости линеек |
| `RULER_GUIDELINE_ADD` | `{ id, orientation, position }` | Добавлена направляющая |
| `RULER_GUIDELINE_REMOVE` | `{ id }` | Удалена направляющая |
| `RULER_GUIDELINE_MOVE` | `{ id, orientation, position }` | Перемещена направляющая |
| `RULER_GUIDELINES_VISIBILITY_CHANGED` | `{ orientation, visible }` | Видимость направляющих |
| `BOOLEAN_MODE_ENTER` | `{ op }` | Вход в режим булевой операции |
| `BOOLEAN_MODE_EXIT` | `{}` | Выход из режима |
| `BOOLEAN_COMMIT` | `{ op, subjectIds, clipIds }` | Завершение булевой операции |
| `BOOLEAN_CANCEL` | `{ op, subjectIds }` | Отмена булевой операции |

---

## Создание / удаление

| Метод | Описание |
|---|---|
| `createShape(dto)` | Создать фигуру. Пишет в TimeMachine |
| `createFile(dtos, name?)` | Создать группу фигур как файл. Возвращает `{ groupId, elements }` |
| `deleteShapes(dto)` | Удалить фигуры по ID |
| `updateShapes(dto)` | Обновить свойства фигур. Без TimeMachine |

---

## Трансформации

| Метод | Описание |
|---|---|
| `moveShapes(dto)` | DRAG_MOVE — переместить на delta. Без TimeMachine |
| `rotateShapes(dto)` | ROTATE — повернуть на угол. Пишет в TimeMachine |
| `resizeShapes(dto)` | RESIZE — изменить размер по bbox. Пишет в TimeMachine |
| `setTransformShapes(dto)` | TRANSFORM — установить матрицу. Пишет в TimeMachine |

---

## Селект

| Метод | Описание |
|---|---|
| `selectShapes(dto)` | Выбрать фигуры (toggle) |
| `clearSelection()` | Сбросить выделение |
| `getAllShapes()` | Получить все фигуры на сцене |

---

## Группировка

| Метод | Описание |
|---|---|
| `groupCreate(dto)` | Создать группу |
| `groupDelete(dto)` | Удалить группу |
| `groupAddElements(dto)` | Добавить элементы в группу |
| `groupRemoveElements(dto)` | Удалить элементы из группы |

---

## Z-порядок

| Метод | Описание |
|---|---|
| `sortShapes(dto)` | Переместить фигуры перед/за targetId |

---

## Канвас / артборд

| Метод | Описание |
|---|---|
| `getCanvasSize()` | Размеры артборда: `{ widthMM, heightMM, widthPx, heightPx, pxPerMM }` |
| `setPanMode(enabled)` | Вкл/выкл ручное панорамирование |
| `setActiveCreationTool(type)` | Инструмент рисования: `rect`, `circle`, `path`… `null` = селект |
| `setTransformMode(mode)` | Режим трансформации: `'resize'` \| `'rotate'` |

---

## Snap-настройки

| Метод | Описание |
|---|---|
| `setSnapToCorners(enabled)` | Прилипание к углам |
| `setSnapToPlanes(enabled)` | Прилипание к плоскостям |
| `setSnapToArtboard(enabled)` | Прилипание к артборду |
| `setAvoidCollisions(enabled)` | Избегать коллизий |

---

## Линейки и направляющие

| Метод | Описание |
|---|---|
| `setRulersVisible(v)` | Показать/скрыть линейки |
| `getRulersVisible()` | Видимость линеек |
| `addGuideline(orientation, position)` | Добавить направляющую. Возвращает ID |
| `removeGuideline(id)` | Удалить направляющую |
| `getGuidelines()` | Все направляющие |
| `setGuidelinesVisible(orientation, v)` | Показать/скрыть по оси |
| `getGuidelinesVisible(orientation)` | Видимость по оси |

---

## Булевы операции

| Метод | Описание |
|---|---|
| `enterBooleanMode(op)` | Войти в режим: `'UNION'` \| `'INTERSECT'` \| `'DIFFERENCE'` |
| `exitBooleanMode()` | Выйти из режима |

---

# DTO — аргументы методов

### `StyleDTO`
```ts
interface StyleDTO {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  visible?: boolean;
}
```

### `TransformDTO`
```ts
interface TransformDTO {
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  matrix?: [number, number, number, number, number, number]; // a,b,c,d,e,f
}
```

### `CreateShapeDTO`
```ts
interface CreateShapeDTO {
  id?: string;
  type: ElementType;                            // 'rect' | 'circle' | 'ellipse' | 'line' | 'path' | 'polygon' | 'polyline' | 'text' | 'image'
  geometry: ElementGeometryDTO;
  style?: StyleDTO;
  transform?: TransformDTO;
  name?: string;
  visible?: boolean;
  lock?: boolean;
  groupId?: string;
  data?: Record<string, unknown>;
}
```

### `UpdateShapesDTO`
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

### `DeleteShapesDTO`
```ts
interface DeleteShapesDTO {
  elementIds: string[];
}
```

### `MoveShapesDTO`
```ts
interface MoveShapesDTO {
  elementIds: string[];
  delta: { x: number; y: number };
}
```

### `RotateShapesDTO`
```ts
interface RotateShapesDTO {
  elementIds: string[];
  angle: number;
}
```

### `ResizeShapesDTO`
```ts
interface ResizeShapesDTO {
  elementIds: string[];
  bbox: { x: number; y: number; width: number; height: number };
}
```

### `SetTransformShapesDTO`
```ts
interface SetTransformShapesDTO {
  elementIds: string[];
  matrix: [number, number, number, number, number, number];
}
```

### `SelectShapesDTO`
```ts
interface SelectShapesDTO {
  elementIds: string[];
  toggle?: boolean;
}
```

### `SortShapesDTO`
```ts
interface SortShapesDTO {
  elementIds: string[];
  targetId: string;
  position: 'before' | 'after';
}
```

### `GroupCreateDTO`
```ts
interface GroupCreateDTO {
  name?: string;
}
```

### `GroupDeleteDTO`
```ts
interface GroupDeleteDTO {
  groupId: string;
}
```

### `GroupAddElementsDTO`
```ts
interface GroupAddElementsDTO {
  groupId: string;
  elementIds: string[];
}
```

### `GroupRemoveElementsDTO`
```ts
interface GroupRemoveElementsDTO {
  groupId: string;
  elementIds: string[];
}
```

### `ElementGeometryDTO` — union type
```ts
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
```

### `RectGeometryDTO`
```ts
interface RectGeometryDTO {
  x: number; y: number;
  width: number; height: number;
  rx?: number; ry?: number;
}
```

### `CircleGeometryDTO`
```ts
interface CircleGeometryDTO {
  cx: number; cy: number;
  r: number;
}
```

### `EllipseGeometryDTO`
```ts
interface EllipseGeometryDTO {
  cx: number; cy: number;
  rx: number; ry: number;
}
```

### `LineGeometryDTO`
```ts
interface LineGeometryDTO {
  x1: number; y1: number;
  x2: number; y2: number;
}
```

### `PathGeometryDTO`
```ts
interface PathGeometryDTO {
  d: string;       // SVG path data
}
```

### `PolygonGeometryDTO`
```ts
interface PolygonGeometryDTO {
  points: string;  // "x1,y1 x2,y2 ..."
}
```

### `PolylineGeometryDTO`
```ts
interface PolylineGeometryDTO {
  points: string;  // "x1,y1 x2,y2 ..."
}
```

### `TextGeometryDTO`
```ts
interface TextGeometryDTO {
  x: string; y: string;
  fontSize?: string;
  fontFamily?: string;
  textAnchor?: string;
  textContent?: string;
}
```

### `ImageGeometryDTO`
```ts
interface ImageGeometryDTO {
  x: number; y: number;
  width: number; height: number;
  href: string;
}
```
