# External API — SVG Editor

## Подключение

```ts
import { SvgCanvas } from 'svg-editor';

const canvas = new SvgCanvas(container);
const api = canvas.getExternalApi();
```

---

## createFile — создать файл (пачку фигур как один шаг undo)

Создаёт несколько фигур одной командой. **Все фигуры автоматически собираются в группу**. Undo откатывает всё целиком.

```ts
function createFile(dtos: CreateShapeDTO[], name?: string): FileCreatedEvent
```

### Параметры

| Поле | Тип | Описание |
|------|-----|----------|
| `dtos` | `CreateShapeDTO[]` | Массив DTO фигур (см. createShape ниже) |
| `name` | `string?` | Имя группы. Авто: `file_1`, `file_2`... |

### Возвращает

```ts
interface FileCreatedEvent {
  groupId: string;     // ID созданной группы
  elements: AbstractGraphicElement[];  // созданные элементы
}
```

### Пример

```ts
const { groupId, elements } = api.createFile([
  { type: 'ellipse', geometry: { cx: 200, cy: 300, rx: 60, ry: 40 }, style: { stroke: 'black', strokeWidth: 2, fill: 'none' } },
  { type: 'ellipse', geometry: { cx: 260, cy: 280, rx: 40, ry: 30 }, style: { stroke: 'black', strokeWidth: 2, fill: 'none' } },
  { type: 'ellipse', geometry: { cx: 270, cy: 270, rx: 5, ry: 5 }, style: { fill: 'black' } },
  { type: 'path', geometry: { d: 'M 200 300 L 200 340 L 190 350 M 230 340 L 220 350 ...' }, style: { stroke: 'black', strokeWidth: 2, fill: 'none' } },
], 'myDrawing');

// groupId   — ID группы, можно использовать для groupDelete, groupAddElements и т.д.
// elements  — массив созданных элементов, у каждого проставлен `.groupId`
```

### Событие

```ts
canvas.on(Events.FileCreated, ({ groupId, elements }) => {
  // groupId: string
  // elements: AbstractGraphicElement[]
});
```

---

## createShape — создать одну фигуру

```ts
function createShape(dto: CreateShapeDTO): AbstractGraphicElement
```

### CreateShapeDTO

```ts
interface CreateShapeDTO {
  id?: string;                    // авто-ID если не указан
  type: ElementType;              // 'rect' | 'circle' | 'ellipse' | 'line' | 'path' | 'polygon' | 'polyline' | 'text' | 'image'
  geometry: ElementGeometryDTO;   // зависит от type (см. таблицу)
  style?: StyleDTO;
  transform?: TransformDTO;
  name?: string;
  visible?: boolean;
  lock?: boolean;
  groupId?: string;
  data?: Record<string, unknown>;
}
```

### Геометрия по типам

| type | geometry |
|---|---|
| `rect` | `{ x, y, width, height, rx?, ry? }` |
| `circle` | `{ cx, cy, r }` |
| `ellipse` | `{ cx, cy, rx, ry }` |
| `line` | `{ x1, y1, x2, y2 }` |
| `path` | `{ d: string }` |
| `polygon` | `{ points: string }` |
| `polyline` | `{ points: string }` |
| `text` | `{ x: string, y: string, fontSize?, fontFamily?, textAnchor?, textContent? }` |
| `image` | `{ x, y, width, height, href }` |

### StyleDTO

```ts
{ fill?: string, stroke?: string, strokeWidth?: number, opacity?: number, visible?: boolean }
```

### TransformDTO

```ts
{ x?: number, y?: number, scaleX?: number, scaleY?: number, angle?: number, matrix?: [a,b,c,d,e,f] }
```

### Пример

```ts
const el = api.createShape({
  type: 'rect',
  geometry: { x: 10, y: 10, width: 100, height: 50 },
  style: { fill: 'red', stroke: '#000', strokeWidth: 2 },
});
// el.id — можно использовать в других методах
```

---

## deleteShapes — удалить

```ts
api.deleteShapes({ elementIds: ['id1', 'id2'] });
```

## updateShapes — обновить свойства (все поля опциональны)

```ts
api.updateShapes({ elementIds: ['id1'], style: { fill: 'blue', strokeWidth: 3 }, visible: true });
```

Можно менять: `style`, `transform`, `geometry`, `name`, `visible`, `lock`, `groupId`, `data`.

## moveShapes — сдвинуть

```ts
api.moveShapes({ elementIds: ['id1'], delta: { x: 50, y: 0 } });
```

## rotateShapes — повернуть

```ts
api.rotateShapes({ elementIds: ['id1'], angle: 45 });
```

## resizeShapes — ресайз

```ts
api.resizeShapes({ elementIds: ['id1'], bbox: { x: 0, y: 0, width: 300, height: 200 } });
```

## setTransformShapes — установить матрицу трансформации

```ts
api.setTransformShapes({ elementIds: ['id1'], matrix: [1, 0, 0, 1, 100, 100] });
```

---

## Выделение

```ts
api.selectShapes({ elementIds: ['id1', 'id2'] });
api.selectShapes({ elementIds: ['id1'], toggle: true });  // переключить выделение
api.clearSelection();
const selected = api.getAllShapes();  // AbstractGraphicElement[]
```

---

## Группы

```ts
const groupId = api.groupCreate({ name: 'MyGroup' });  // → string
api.groupDelete({ groupId });
api.groupAddElements({ groupId, elementIds: ['id1'] });
api.groupRemoveElements({ groupId, elementIds: ['id1'] });
```

---

## Z-order

```ts
api.sortShapes({ elementIds: ['id1'], targetId: 'id2', position: 'before' });
api.sortShapes({ elementIds: ['id1'], targetId: 'id2', position: 'after' });
```

---

## Undo / Redo

```ts
canvas.undo();
canvas.redo();
canvas.canUndo;  // boolean
canvas.canRedo;  // boolean
```

---

## События

```ts
canvas.on(Events.FileCreated, ({ groupId, elements }) => { ... });
canvas.on(Events.ElementCreated, (el) => { ... });
canvas.on(Events.ElementChanged, ({ elementIds }) => { ... });
canvas.on(Events.SelectionChange, (selected) => { ... });
canvas.on(Events.DragStart, () => {});
canvas.on(Events.DragEnd, () => {});
canvas.on(Events.TransformStart, (mode) => {});
canvas.on(Events.TransformEnd, (mode) => {});
canvas.on(Events.GroupSelect, (ids) => {});
canvas.on(Events.GroupsChange, () => {});

// Отписка:
const unsub = canvas.on(Events.SelectionChange, fn);
unsub();
```

---

## Прямые методы SvgCanvas

```ts
canvas.getSelected();              // выделенные элементы
canvas.setSelectedElements(elements);
canvas.getSVG();                   // SVGSVGElement
canvas.setArtboardSize(210, 297);  // A4 в мм
canvas.setSnapToElements(true);
canvas.setSnapToArtboard(true);
canvas.setAvoidCollisions(true);
canvas.debugShowHitArea = true;
canvas.loadJSON([...]);            // загрузить элементы из JSON
canvas.saveTimeMachine();           // сохранить историю
canvas.loadTimeMachine(records);    // восстановить историю
canvas.destroy();
```
