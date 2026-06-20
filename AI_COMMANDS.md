# AI Commands — SVG Editor

Ты — агент, управляющий SVG-редактором. У тебя есть объекты `api` (ExternalApi) и `canvas` (SvgCanvas). Ты НЕ можешь кликать мышкой — ты только вызываешь JS-методы.

## Доступ

```js
const api = canvas.getExternalApi();
// или window.api если объявлено
```

---

## createFile — создать файл (пачку фигур как один элемент)

Создаёт несколько фигур одной командой, автоматически группирует их. Undo откатывает всё разом.

```js
const result = api.createFile([
  { type: 'ellipse', geometry: { cx: 200, cy: 300, rx: 60, ry: 40 }, style: { stroke: 'black', strokeWidth: 2, fill: 'none' } },
  { type: 'ellipse', geometry: { cx: 260, cy: 280, rx: 40, ry: 30 }, style: { stroke: 'black', strokeWidth: 2, fill: 'none' } },
  // ... любые CreateShapeDTO
], 'fileName');  // name — опционально
```

Возвращает `{ groupId: string, elements: AbstractGraphicElement[] }`:
```js
const { groupId, elements } = api.createFile([...], 'drawing1');
// groupId — ID созданной группы
// elements — массив созданных элементов (у каждого проставлен groupId)
```

Событие `Events.FileCreated`:
```js
canvas.on(Events.FileCreated, ({ groupId, elements }) => {
  // groupId — группа, в которую собраны элементы
  // elements — все созданные элементы
});
```

---

## createShape — создать фигуру

```js
api.createShape({ type, geometry, style?, transform?, name?, visible?, lock?, groupId?, data? });
```

Всегда возвращает созданный элемент. Можно сохранить id:

```js
const r = api.createShape({ type: 'rect', geometry: { x: 10, y: 10, width: 100, height: 50 }, style: { fill: 'red' } });
// r.id — используй для дальнейших операций
```

### Допустимые типы geometry:

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

```js
{ fill?: string, stroke?: string, strokeWidth?: number, opacity?: number, visible?: boolean }
```

### TransformDTO

```js
{ x?: number, y?: number, scaleX?: number, scaleY?: number, angle?: number, matrix?: [a,b,c,d,e,f] }
```

---

## deleteShapes — удалить

```js
api.deleteShapes({ elementIds: ['id1', 'id2'] });
```

## updateShapes — обновить свойства

Все поля опциональны. Меняются только переданные.

```js
api.updateShapes({ elementIds: ['id1'], style: { fill: 'red', strokeWidth: 3 }, visible: true });
```

Также можно менять geometry, transform, name, lock, groupId, data.

## moveShapes — сдвинуть

```js
api.moveShapes({ elementIds: ['id1'], delta: { x: 50, y: 0 } });
```

## rotateShapes — повернуть

```js
api.rotateShapes({ elementIds: ['id1'], angle: 45 });
```

## resizeShapes — ресайз

```js
api.resizeShapes({ elementIds: ['id1'], bbox: { x: 0, y: 0, width: 300, height: 200 } });
```

## setTransformShapes — установить матрицу

```js
api.setTransformShapes({ elementIds: ['id1'], matrix: [1, 0, 0, 1, 100, 100] });
```

---

## selectShapes — выделить

```js
api.selectShapes({ elementIds: ['id1', 'id2'] });
api.selectShapes({ elementIds: ['id1'], toggle: true });  // переключить
api.clearSelection();
```

## getAllShapes — получить выделенные

```js
const selected = api.getAllShapes();
const ids = selected.map(el => el.id);
```

---

## Groups

```js
api.groupCreate({ name: 'MyGroup' });   // → string id
api.groupDelete({ groupId });
api.groupAddElements({ groupId, elementIds: ['id1'] });
api.groupRemoveElements({ groupId, elementIds: ['id1'] });
```

---

## Z-order

```js
api.sortShapes({ elementIds: ['id1'], targetId: 'id2', position: 'before' });
api.sortShapes({ elementIds: ['id1'], targetId: 'id2', position: 'after' });
```

---

## Undo / Redo

```js
canvas.undo();
canvas.redo();
canvas.canUndo;  // boolean
canvas.canRedo;  // boolean
```

---

## Path editing (режим узлов)

Включить:
```js
canvas.editingPath = somePathElement;
```

Выключить:
```js
canvas.editingPath = null;
```

Удалить активный узел (если курсор на ручке):

```js
// Имитация Delete через API недоступна — нужно мышью.
// Но можно отправить команду напрямую:
canvas.getCommandBus().execute({
  type: 'PATH_REMOVE_NODE',
  options: { id: canvas.editingPath.id, cmdIdx: 0 }
});
```

Добавить точку на отрезок:
```js
canvas.getCommandBus().execute({
  type: 'PATH_ADD_NODE',
  options: { id: canvas.editingPath.id, cmdIdx: 0, x: 150, y: 150, t: 0.5, prevEndX: 100, prevEndY: 100 }
});
```

Сменить тип узла:
```js
canvas.getCommandBus().execute({
  type: 'PATH_CHANGE_NODE_TYPE',
  options: { id: canvas.editingPath.id, cmdIdx: 0, newType: 'C' } // 'C' или 'L'
});
```

Сдвинуть суб-путь:
```js
canvas.getCommandBus().execute({
  type: 'PATH_MOVE_SUBPATH',
  options: { id: canvas.editingPath.id, subpathIdx: 0, delta: { x: 50, y: 0 } }
});
```

---

## Events — подписка

```js
canvas.on(Events.ElementCreated, (el) => { /* el — AbstractGraphicElement */ });
canvas.on(Events.ElementChanged, ({ elementIds }) => { /* string[] */ });
canvas.on(Events.SelectionChange, (selected) => { /* AbstractGraphicElement[] */ });
canvas.on(Events.DragStart, () => {});
canvas.on(Events.DragEnd, () => {});
canvas.on(Events.TransformStart, (mode) => {});  // 'resize' | 'rotate'
canvas.on(Events.TransformEnd, (mode) => {});
canvas.on(Events.GroupSelect, (ids) => {});
canvas.on(Events.GroupsChange, () => {});
canvas.on(Events.FileCreated, ({ groupId, elements }) => { /* groupId: string, elements: AbstractGraphicElement[] */ });
```

Отписка:
```js
const unsub = canvas.on(Events.SelectionChange, fn);
unsub(); // отписаться
```

---

## Загрузка / сохранение истории

```js
canvas.loadJSON([{ id: 'bg', type: 'rect', attributes: { x: '0', y: '0', width: '800', height: '600', fill: '#f5f5f5' } }]);

const records = canvas.saveTimeMachine();
canvas.loadTimeMachine(records);
```

---

## destroy

```js
canvas.destroy();
```

---

## SvgCanvas (прямые методы)

```js
canvas.getSelected();                // выделенные элементы
canvas.setSelectedElements(elements);
canvas.getSVG();                     // SVGSVGElement
canvas.setArtboardSize(210, 297);    // A4 в мм
canvas.addShape(element);            // добавить готовый элемент
canvas.setSnapToElements(true);
canvas.setSnapToArtboard(true);
canvas.setAvoidCollisions(true);
canvas.debugShowHitArea = true;
```

---

## Стратегия рисования для ИИ

Ты НЕ можешь кликать мышью. ВСЕ фигуры создаются через `api.createShape()`. Если тебя просят "нарисуй" — ты вычисляешь координаты в коде и вызываешь `api.createShape()`.

Правила:
1. Каждая фигура — отдельный вызов `api.createShape()`
2. Сохраняй результат, чтобы потом модифицировать фигуру
3. Координаты выдумывай сам, руководствуясь здравым смыслом
4. Пути с кривыми Безье задавай строкой `d`
5. Для сложных композиций рисуй несколько фигур и комбинируй

Пример: нарисовать дом
```js
// Стена
api.createShape({ type: 'rect', geometry: { x: 100, y: 150, width: 200, height: 150 }, style: { fill: '#f5f5f5', stroke: '#333', strokeWidth: 2 } });
// Крыша — треугольник
api.createShape({ type: 'polygon', geometry: { points: '80,150 200,80 320,150' }, style: { fill: '#c0392b', stroke: '#333', strokeWidth: 2 } });
// Дверь
api.createShape({ type: 'rect', geometry: { x: 175, y: 230, width: 50, height: 70 }, style: { fill: '#8B4513', stroke: '#333', strokeWidth: 2 } });
// Окно
api.createShape({ type: 'rect', geometry: { x: 120, y: 180, width: 40, height: 40 }, style: { fill: '#85c1e9', stroke: '#333', strokeWidth: 2 } });
```
