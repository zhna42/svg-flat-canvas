# SVG Canvas

<p align="center">
  <b>Библиотека для рендеринга и интерактивного редактирования SVG-графики</b><br>
  Редактирование мышью и через API · Undo/Redo · Группы · Привязки · Редактирование узлов пути
</p>

---

## Установка

Клонирование репозитория и сборка:

```bash
git clone https://github.com/<user>/svg-canvas.git
cd svg-canvas
npm install
npm run build
```

Подключение в проекте — импорт из исходников (tsconfig paths `@/` → `src/`) или из собранного бандла:

```ts
import { SvgCanvas } from './path/to/dist/index.mjs';   // ESM
// или
const { SvgCanvas } = require('./path/to/dist/index.js'); // CJS
```

## Быстрый старт

```ts
import { SvgCanvas } from './path/to/svg-canvas';

const canvas = new SvgCanvas(document.getElementById('container')!, {
  width: 800,
  height: 600,
});

const api = canvas.getExternalApi();

// Создать прямоугольник
const rect = api.createShape({
  type: 'rect',
  geometry: { x: 100, y: 100, width: 200, height: 150 },
  style: { fill: '#3498db', stroke: '#2c3e50', strokeWidth: 2 },
});

// Подписаться на события
canvas.on('SVG_CAD_SELECT', (e) => {
  console.log('Выделено:', e.data.elementIds);
});
```

---

## Внешний API

### Создание элементов

```ts
// Одна фигура
const el = api.createShape({
  type: 'rect',                    // rect | circle | ellipse | line | path | polygon | polyline | text | image
  geometry: { x: 10, y: 10, width: 100, height: 50 },
  style: { fill: 'red', stroke: 'black', strokeWidth: 2, opacity: 0.8 },
  transform: { x: 200, y: 100, angle: 45 },
  name: 'Мой элемент',
  visible: true,
  lock: false,
  groupId: 'group-1',
  data: { author: 'Иван' },
});

// Пачка фигур как файл (группируются, откатываются вместе)
const { groupId, elements } = api.createFile([
  { type: 'rect', geometry: { x: 0, y: 0, width: 100, height: 50 }, style: { fill: 'blue' } },
  { type: 'circle', geometry: { cx: 150, cy: 25, r: 20 }, style: { fill: 'green' } },
], 'чертёж-1');
```

### Редактирование

```ts
// Обновить стили, трансформацию, геометрию, имя, видимость, блокировку, groupId, data
api.updateShapes({
  elementIds: ['id1', 'id2'],
  style: { fill: 'red', strokeWidth: 3 },
  visible: true,
});

api.moveShapes({ elementIds: ['id1'], delta: { x: 50, y: 0 } });
api.rotateShapes({ elementIds: ['id1'], angle: 45 });
api.resizeShapes({ elementIds: ['id1'], bbox: { x: 0, y: 0, width: 300, height: 200 } });
api.setTransformShapes({ elementIds: ['id1'], matrix: [1, 0, 0, 1, 100, 100] });
api.deleteShapes({ elementIds: ['id1', 'id2'] });
```

### Z-order

```ts
api.sortShapes({ elementIds: ['id1'], targetId: 'id2', position: 'before' });
api.sortShapes({ elementIds: ['id1'], targetId: 'id2', position: 'after' });
```

### Выделение

```ts
api.selectShapes({ elementIds: ['id1', 'id2'] });
api.selectShapes({ elementIds: ['id1'], toggle: true });  // переключить
api.clearSelection();
const selected = api.getAllShapes();  // AbstractGraphicElement[]
```

### Группы

```ts
const groupId = api.groupCreate({ name: 'Моя группа' });
api.groupDelete({ groupId });
api.groupAddElements({ groupId, elementIds: ['id1', 'id2'] });
api.groupRemoveElements({ groupId, elementIds: ['id1'] });
```

### Инструменты

```ts
api.setActiveCreationTool('rect');   // интерактивное рисование кликами
api.setActiveCreationTool(null);     // режим выделения
api.setPanMode(true);                // панорамирование
api.getCanvasSize();                 // { widthMM, heightMM, widthPx, heightPx, pxPerMM }
```

---

## Типы геометрии

| Тип | Параметры |
|-----|-----------|
| `rect` | `{ x, y, width, height, rx?, ry? }` |
| `circle` | `{ cx, cy, r }` |
| `ellipse` | `{ cx, cy, rx, ry }` |
| `line` | `{ x1, y1, x2, y2 }` |
| `path` | `{ d: string }` — например `'M 10 10 L 100 100 C 150 50, 200 150, 250 100 Z'` |
| `polygon` | `{ points: string }` — например `'10,10 50,50 90,10'` |
| `polyline` | `{ points: string }` |
| `text` | `{ x, y, fontSize?, fontFamily?, textAnchor?, textContent? }` |
| `image` | `{ x, y, width, height, href }` |

## Типы стилей

```ts
interface StyleDTO {
  fill?: string;        // цвет заливки (CSS)
  stroke?: string;      // цвет обводки
  strokeWidth?: number; // толщина обводки
  opacity?: number;     // прозрачность 0–1
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
  angle?: number;       // поворот в градусах
  matrix?: [a, b, c, d, e, f]; // матрица 2×3 (приоритетнее полей выше)
}
```

---

## События

```ts
import { SvgCanvas, Events } from './path/to/svg-canvas';

const unsub = canvas.on(Events.SelectionChange, (selected) => {
  console.log('Выделено:', selected.map(s => s.id));
});
unsub(); // отписка
```

| Событие | Данные | Когда |
|---------|--------|-------|
| `Events.ElementCreated` | `AbstractGraphicElement` | Создан элемент через API |
| `Events.ElementChanged` | `{ elementIds: string[] }` | Изменены/удалены элементы через API |
| `Events.SelectionChange` | `readonly AbstractGraphicElement[]` | Изменилось выделение |
| `Events.DragStart` | `void` | Начало перетаскивания |
| `Events.DragEnd` | `void` | Конец перетаскивания |
| `Events.TransformStart` | `'resize' \| 'rotate'` | Начало ресайза/поворота |
| `Events.TransformEnd` | `'resize' \| 'rotate'` | Конец ресайза/поворота |
| `Events.GroupSelect` | `string[]` | ID выбранных групп |
| `Events.GroupsChange` | `void` | Изменён состав групп |
| `Events.FileCreated` | `{ groupId, elements }` | Файл создан через `createFile` |

---

## Основной класс SvgCanvas

```ts
const canvas = new SvgCanvas(container, { width: 800, height: 600 });

// Артборд
canvas.setArtboardSize(210, 297);  // A4 в мм

// Выделение
canvas.getSelected();               // AbstractGraphicElement[]
canvas.setSelectedElements(elements);
canvas.setSelectionMode('element' | 'group');
canvas.setSelectionGesture('click' | 'rect' | 'lasso');

// Привязки
canvas.setSnapToElements(true);
canvas.setSnapToArtboard(true);
canvas.setAvoidCollisions(true);

// Undo / Redo
canvas.undo();
canvas.redo();
canvas.canUndo;  // boolean
canvas.canRedo;  // boolean

// Группы
canvas.groups;                     // Group[]
canvas.createGroup(name?);         // → string (groupId)
canvas.deleteGroup(id);
canvas.addToGroup(groupId, [elementIds]);
canvas.removeFromGroup(groupId, [elementIds]);
canvas.getElementIdsInGroup(id);
canvas.highlightGroupElements(id);
canvas.selectGroup(id);
canvas.selectGroupElements(id);
canvas.selectMultipleGroups([id]);
canvas.setGroups(data);

// Камера
canvas.getCamera();                // { zoom, panX, panY, ... }
canvas.getSVG();                   // SVGSVGElement

// Пути — редактирование узлов
canvas.editingPath = pathElement;  // войти в режим
canvas.editingPath = null;         // выйти

// Сохранение / загрузка состояния
const records = canvas.saveTimeMachine();   // TimeMachineRecord[]
canvas.loadTimeMachine(records);

// Отладка
canvas.debugShowHitArea = true;    // показать hit-области

canvas.destroy();  // уничтожить
```

---

## Импорт / экспорт данных

### Загрузка из JSON

```ts
canvas.loadJSON([
  { id: 'bg', type: 'rect', attributes: { x: '0', y: '0', width: '800', height: '600', fill: '#f5f5f5' } },
  { id: 'r1', type: 'rect', attributes: { x: '100', y: '100', width: '200', height: '150', fill: 'blue' } },
]);
```

### Конвертация SVG-узлов в элементы

```ts
import { svgNodesToElements } from './path/to/svg-canvas';

const elements = svgNodesToElements([
  { id: 'path-1', type: 'path', attributes: { d: 'M 10 10 L 100 100', stroke: 'black', 'stroke-width': '2', fill: 'none' } },
  // ...
]);
for (const el of elements) {
  canvas.addShape(el);
}
```

### Сохранение истории

```ts
// Сериализовать и сохранить в БД
const records = canvas.saveTimeMachine();
localStorage.setItem('canvas-snapshot', JSON.stringify(records));

// Восстановить
const loaded = JSON.parse(localStorage.getItem('canvas-snapshot')!);
canvas.loadTimeMachine(loaded);
```

---

## Редактирование узлов пути

```ts
// Войти в режим
canvas.editingPath = pathElement;

// Добавить узел
canvas.getCommandBus().execute({
  type: 'PATH_ADD_NODE',
  options: { id: pathElement.id, cmdIdx: 0, x: 150, y: 150, t: 0.5, prevEndX: 100, prevEndY: 100 },
});

// Удалить узел
canvas.getCommandBus().execute({
  type: 'PATH_REMOVE_NODE',
  options: { id: pathElement.id, cmdIdx: 0 },
});

// Сменить тип узла (C — кубическая Безье, L — линия)
canvas.getCommandBus().execute({
  type: 'PATH_CHANGE_NODE_TYPE',
  options: { id: pathElement.id, cmdIdx: 0, newType: 'C' },
});

// Сдвинуть суб-путь
canvas.getCommandBus().execute({
  type: 'PATH_MOVE_SUBPATH',
  options: { id: pathElement.id, subpathIdx: 0, delta: { x: 50, y: 0 } },
});

// Выйти из режима
canvas.editingPath = null;
```

---

## Команды (низкоуровневый доступ)

```ts
const bus = canvas.getCommandBus();

// Ручное перемещение
bus.execute({ type: 'DRAG_MOVE', options: { delta: { x: 10, y: 0 } } });
bus.execute({ type: 'DRAG_END', options: {} });

// Удаление
bus.execute({ type: 'DELETE', options: { elementIds: ['id1'] } });

// Группы
bus.execute({ type: 'GROUP_CREATE', options: { name: 'MyGroup' } });
bus.execute({ type: 'GROUP_DELETE', options: { groupId: 'g1' } });
bus.execute({ type: 'GROUP_ADD', options: { groupId: 'g1', elementIds: ['id1'] } });
bus.execute({ type: 'GROUP_REMOVE', options: { groupId: 'g1', elementIds: ['id1'] } });

// Трансформации
bus.execute({ type: 'RESIZE', options: { elementIds: ['id1'], bbox: { x: 0, y: 0, width: 200, height: 100 } } });
bus.execute({ type: 'ROTATE', options: { elementIds: ['id1'], angle: 45 } });
bus.execute({ type: 'TRANSFORM', options: { elementIds: ['id1'], matrix: [1, 0, 0, 1, 100, 0] } });

// Выделение
bus.execute({ type: 'SELECT', options: { elementIds: ['id1'], toggle: false } });

// Z-order
bus.execute({ type: 'SORT', options: { elementIds: ['id1'], targetId: 'id2', position: 'before' } });
```

Каждая команда попадает в `TimeMachine` и может быть отменена через `canvas.undo()`.

---

## Полный пример

```ts
import { SvgCanvas, Events } from './path/to/svg-canvas';

const canvas = new SvgCanvas(document.getElementById('app')!, {
  width: 1200,
  height: 800,
});

const api = canvas.getExternalApi();

// Артборд A4
canvas.setArtboardSize(210, 297);

// Подписка на события
canvas.on(Events.SelectionChange, (selected) => {
  console.log('Выделено:', selected.length, 'элементов');
});

canvas.on(Events.ElementCreated, (el) => {
  console.log('Создан:', el.id, el.type);
});

// Загрузка подложки
canvas.loadJSON([
  { id: 'bg', type: 'rect', attributes: { x: '0', y: '0', width: '800', height: '600', fill: '#fafafa' } },
]);

// Создание фигур
const rect = api.createShape({
  type: 'rect',
  geometry: { x: 100, y: 100, width: 200, height: 150 },
  style: { fill: '#3498db', stroke: '#2c3e50', strokeWidth: 2 },
  data: { author: 'Иван', material: 'фанера 3мм' },
});

const circle = api.createShape({
  type: 'circle',
  geometry: { cx: 300, cy: 200, r: 40 },
  style: { fill: '#e74c3c', stroke: '#c0392b', strokeWidth: 2 },
});

// Группировка
const groupId = api.groupCreate({ name: 'Деталь А' });
api.groupAddElements({ groupId, elementIds: [rect.id, circle.id] });

// Поворот группы
api.rotateShapes({ elementIds: [rect.id, circle.id], angle: 15 });

// Отмена
canvas.undo();

// Сохранение
const snapshot = canvas.saveTimeMachine();
localStorage.setItem('project', JSON.stringify(snapshot));

// Включить привязки
canvas.setSnapToElements(true);
canvas.setSnapToArtboard(true);

// Включить инструмент рисования прямоугольников
api.setActiveCreationTool('rect');
```

---

## Разработка

```bash
npm install
npm run dev        # сборка в watch-режиме
npm run example    # запуск примеров (Vite)
npm run lint       # проверка ESLint
npm run typecheck  # проверка TypeScript
npm run build      # production-сборка в dist/
```

---

## Лицензия

MIT
