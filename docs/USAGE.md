# SVG Editor — Документация по использованию

## Установка и подключение

```ts
import { SvgCanvas, ExternalApi, Events } from 'svg-editor';
```

## Быстрый старт

```ts
const canvas = new SvgCanvas(document.getElementById('container')!, {
  width: 800,
  height: 600,
});
const api = canvas.getExternalApi();

// Создать прямоугольник
api.createShape({
  type: 'rect',
  geometry: { x: 100, y: 100, width: 200, height: 150 },
  style: { fill: '#3498db', stroke: '#2c3e50', strokeWidth: 2 },
});
```

---

## API — фигуры

### createShape(dto: CreateShapeDTO): AbstractGraphicElement

Создаёт фигуру и возвращает её экземпляр.

```ts
interface CreateShapeDTO {
  id?: string;
  type: 'rect' | 'circle' | 'ellipse' | 'line' | 'path' | 'polygon' | 'polyline' | 'text' | 'image';
  geometry: RectGeometryDTO | CircleGeometryDTO | ...;
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

```ts
api.deleteShapes({ elementIds: ['id1', 'id2'] });
```

### updateShapes(dto: UpdateShapesDTO): void

Обновляет свойства нескольких фигур. Все поля опциональны.

```ts
api.updateShapes({
  elementIds: ['id1'],
  style: { fill: 'red', strokeWidth: 3 },
  visible: true,
});
```

### moveShapes(dto: MoveShapesDTO): void

Сдвиг фигур на дельту.

```ts
api.moveShapes({ elementIds: ['id1'], delta: { x: 50, y: 0 } });
```

### rotateShapes(dto: RotateShapesDTO): void

Поворот на угол (градусы).

```ts
api.rotateShapes({ elementIds: ['id1'], angle: 45 });
```

### resizeShapes(dto: ResizeShapesDTO): void

```ts
api.resizeShapes({ elementIds: ['id1'], bbox: { x: 0, y: 0, width: 300, height: 200 } });
```

### setTransformShapes(dto: SetTransformShapesDTO): void

Установка матрицы трансформации.

```ts
api.setTransformShapes({
  elementIds: ['id1'],
  matrix: [1, 0, 0, 1, 100, 100],  // [a, b, c, d, e, f]
});
```

---

## API — выделение

```ts
api.selectShapes({ elementIds: ['id1', 'id2'] });
api.selectShapes({ elementIds: ['id1'], toggle: true });  // переключить
api.clearSelection();
const selected = api.getAllShapes();  // readonly AbstractGraphicElement[]
```

---

## API — группы

```ts
const groupId = api.groupCreate({ name: 'Моя группа' });
api.groupDelete({ groupId });
api.groupAddElements({ groupId, elementIds: ['id1', 'id2'] });
api.groupRemoveElements({ groupId, elementIds: ['id1'] });
```

---

## API — утилиты

```ts
// Z-order
api.sortShapes({ elementIds: ['id1'], targetId: 'id2', position: 'before' });

// Интерактивное рисование (кликами на холсте)
api.setActiveCreationTool('rect');   // начать рисование
api.setActiveCreationTool(null);     // вернуться в режим выделения
```

Доступные инструменты: `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `path`.

---

## Типы геометрии

```ts
// rect
{ x: number, y: number, width: number, height: number, rx?: number, ry?: number }

// circle
{ cx: number, cy: number, r: number }

// ellipse
{ cx: number, cy: number, rx: number, ry: number }

// line
{ x1: number, y1: number, x2: number, y2: number }

// path
{ d: string }
// Пример: { d: 'M 10 10 L 100 100 C 150 50, 200 150, 250 100 Z' }

// polygon / polyline
{ points: string }
// Пример: { points: '10,10 50,50 90,10' }

// text
{ x: string, y: string, fontSize?: string, fontFamily?: string, textAnchor?: string, textContent?: string }

// image
{ x: number, y: number, width: number, height: number, href: string }
```

## Типы стилей

```ts
interface StyleDTO {
  fill?: string;        // цвет заливки
  stroke?: string;      // цвет обводки
  strokeWidth?: number; // толщина обводки
  opacity?: number;     // прозрачность (0-1)
  visible?: boolean;    // видимость
}
```

## Типы трансформаций

```ts
interface TransformDTO {
  x?: number;           // абсолютная позиция X
  y?: number;           // абсолютная позиция Y
  scaleX?: number;
  scaleY?: number;
  angle?: number;       // градусы
  matrix?: [number, number, number, number, number, number]; // приоритетнее полей выше
}
```

---

## Подписка на события

```ts
const canvas = new SvgCanvas(container);
const api = canvas.getExternalApi();

// Подписаться
const unsubscribe = canvas.on(Events.SelectionChange, (selected) => {
  console.log('Выделено:', selected.map(s => s.id));
});

// Отписаться
unsubscribe();
// или
canvas.off(Events.SelectionChange, handler);
```

### Список событий (Events)

| Событие | Данные | Описание |
|---|---|---|
| `SelectionChange` | `readonly AbstractGraphicElement[]` | Изменилось выделение |
| `ElementCreated` | `AbstractGraphicElement` | Создан новый элемент (через API) |
| `ElementChanged` | `{ elementIds: string[] }` | Изменены/удалены элементы (через API) |
| `GroupSelect` | `string[]` | Выбраны группы по id |
| `GroupsChange` | `void` | Состав групп изменился |
| `DragStart` | `void` | Начало перетаскивания |
| `DragMove` | `void` | Перетаскивание |
| `DragEnd` | `void` | Конец перетаскивания |
| `TransformStart` | `TransformMode` | Начало ресайза/поворота |
| `TransformMove` | `void` | Ресайз/поворот |
| `TransformEnd` | `TransformMode` | Конец ресайза/поворота |

`TransformMode = 'resize' | 'rotate'`

---

## SvgCanvas — публичные методы (помимо ExternalApi)

```ts
const canvas = new SvgCanvas(container, options?);

canvas.addShape(element);             // добавить готовый элемент
canvas.loadJSON(items: ElementJSON[]); // загрузить массив фигур
canvas.setArtboardSize(widthMM, heightMM);

// Выделение
canvas.getSelected();                 // получить выделенные элементы
canvas.setSelectedElements(elements);
canvas.setSelectionMode('element' | 'group');
canvas.getSelectionMode();
canvas.selectionFilter = fn;
canvas.onSelectionChange = fn;

// Отмена / повтор
canvas.undo();
canvas.redo();
canvas.canUndo;   // boolean
canvas.canRedo;   // boolean

// Привязка к сетке
canvas.setSnapToElements(true);
canvas.setSnapToArtboard(true);
canvas.setAvoidCollisions(true);

// Группы
canvas.groups;
canvas.createGroup(name?);
canvas.deleteGroup(id);
canvas.addToGroup(groupId, elementOrIds);
canvas.removeFromGroup(groupId, elementOrIds);
canvas.clearGroup(id);
canvas.getElementIdsInGroup(id);
canvas.selectGroup(id);
canvas.selectGroupElements(id);
canvas.highlightGroupElements(id);
canvas.getSelectedGroupIds();
canvas.setGroups(data: GroupData[]);

// Пути — режим редактирования узлов
canvas.editingPath = pathElement;    // войти в режим
canvas.editingPath = null;           // выйти

// Сохранение / загрузка истории
canvas.saveTimeMachine();            // TimeMachineRecord[]
canvas.loadTimeMachine(records);

// Инструменты
canvas.setActiveCreationTool('rect' | 'circle' | ... | null);
canvas.setSelectionShortcuts(s);
canvas.setSelectionGesture('click' | 'rect' | 'lasso');
canvas.getSelectionGesture();
canvas.debugShowHitArea = true;

// Удаление
canvas.destroy();
```

---

## Загрузка данных из JSON

```ts
interface ElementJSON {
  id: string;
  type: ElementType;
  attributes: Record<string, string>;  // x, y, width, height, fill, stroke, d, points, ...
  groupId?: string;
  name?: string;
  visible?: boolean;
  lock?: boolean;
  data?: Record<string, unknown>;
  textContent?: string;
}

const items: ElementJSON[] = [
  { id: 'rect-1', type: 'rect', attributes: { x: '10', y: '10', width: '100', height: '50', fill: 'red' } },
  { id: 'circle-1', type: 'circle', attributes: { cx: '200', cy: '200', r: '30', fill: 'blue' } },
];

canvas.loadJSON(items);
```

---

## Консоль — отладка

```ts
window.api = canvas.getExternalApi();
```

После этого в консоли браузера:

```js
// Машинка
api.createShape({ type: 'rect', geometry: { x: 50, y: 100, width: 200, height: 60 }, style: { fill: '#3498db', stroke: '#2c3e50', strokeWidth: 2 } });

// Путь с кривыми Безье
api.createShape({ type: 'path', geometry: { d: 'M 30 420 C 90 370 170 370 230 420 S 290 490 350 420' }, style: { stroke: 'red', strokeWidth: 2, fill: 'none' } });

// Режим редактирования узлов пути
canvas.editingPath = canvas.getSelected()[0];

// Активировать инструмент рисования
api.setActiveCreationTool('path');
```

---

## Полный пример

```ts
import { SvgCanvas, ExternalApi, Events } from 'svg-editor';

const canvas = new SvgCanvas(document.getElementById('app')!, {
  width: 1200,
  height: 800,
});

const api = canvas.getExternalApi();

// Подписка на изменение выделения
canvas.on(Events.SelectionChange, (selected) => {
  console.log('Выделено:', selected.length, 'элементов');
});

// Загрузка данных
canvas.loadJSON([
  { id: 'bg', type: 'rect', attributes: { x: '0', y: '0', width: '1200', height: '800', fill: '#f5f5f5' } },
]);

// Создание фигуры через API
const rect = api.createShape({
  type: 'rect',
  geometry: { x: 100, y: 100, width: 200, height: 150 },
  style: { fill: '#3498db', stroke: '#2c3e50', strokeWidth: 2 },
  data: { author: 'Иван', material: 'фанера 3мм' },
});

// Вращение
api.rotateShapes({ elementIds: [rect.id], angle: 15 });

// Отмена
canvas.undo();

// Сохранение
const records = canvas.saveTimeMachine();
// Сериализовать records в JSON и сохранить в БД

// Восстановление
canvas.loadTimeMachine(records);
```
