# SVG Canvas

Библиотека для рендеринга и интерактивного редактирования SVG-графики. Редактирование мышью и через API, Undo/Redo, группы, привязки, булевы операции, растровая обработка, лазерная раскройка.

## Установка

```bash
git clone https://github.com/<user>/svg-canvas.git
cd svg-canvas
npm install
npm run build
```

```ts
import { SvgCanvas } from 'svg-canvas';
```

---

## Минимальный пример

```ts
import { SvgCanvas } from 'svg-canvas';

const canvas = new SvgCanvas(document.getElementById('container')!, {
  width: 800,
  height: 600,
});

const api = canvas.api;

// Создать фигуру
const rect = api.shapes.createShape({
  type: 'rect',
  geometry: { x: 100, y: 100, width: 200, height: 150 },
  style: { fill: '#3498db', stroke: '#2c3e50', strokeWidth: 2 },
});

// Выделить через API
api.selection.selectShapes({ elementIds: [rect.id] });

// Подписаться на события
api.on('GROUP_CREATED', (e) => {
  console.log('Группа создана:', e.data);
});

// Создать группу
const groupId = api.groups.groupCreate({ name: 'Деталь' });
api.groups.groupAddElements({ groupId, elementIds: [rect.id] });

// Undo
api.history.undo();
api.history.redo();

// Сохранить/восстановить состояние
const snapshot = api.history.save();
api.history.load(snapshot);
```

---

## API

Экземпляр `ExternalApi` доступен через `canvas.api`. Методы сгруппированы по контроллерам.

### shapes — элементы

```ts
// Создание
api.shapes.createShape(dto: CreateShapeDTO): AbstractGraphicElement
api.shapes.createFile(dtos: CreateShapeDTO[], name?: string): { groupId, elements }

// Редактирование
api.shapes.updateShapes({ elementIds, style?, geometry?, transform?, visible?, lock?, name?, groupId?, data? })
api.shapes.deleteShapes({ elementIds: string[] })
api.shapes.moveShapes({ elementIds: string[], delta: { x, y } })
api.shapes.rotateShapes({ elementIds: string[], angle: number })
api.shapes.resizeShapes({ elementIds: string[], bbox: BoundingBox })
api.shapes.setTransformShapes({ elementIds: string[], matrix: [a,b,c,d,e,f] })

// Запросы
api.shapes.getAllShapes(): readonly AbstractGraphicElement[]
api.shapes.getElementById(id: string): Record<string, unknown> | null
api.shapes.getElementPosition(id: string): { xMm, yMm } | null
api.shapes.setElementPosition(id: string, xMm: number, yMm: number): void
api.shapes.resizeElement(id: string, widthMm: number, heightMm: number): void
api.shapes.rotateElement(id: string, angle: number): void

// Булевы операции
api.shapes.enterBooleanMode(op: 'UNION' | 'INTERSECT' | 'DIFFERENCE'): void
api.shapes.exitBooleanMode(): void

// Outline
api.shapes.outlineElement(id: string): void
api.shapes.getOutlinePath(id: string): Record<string, unknown> | null
```

### groups — группы

```ts
const gid = api.groups.groupCreate({ name: string })
api.groups.groupDelete({ groupId: string })
api.groups.groupAddElements({ groupId, elementIds })
api.groups.groupRemoveElements({ groupId, elementIds })
api.groups.selectGroup(groupId: string)
api.groups.selectGroupElements(groupId: string)
api.groups.selectMultipleGroups(ids: string[])
```

### selection — выделение

```ts
api.selection.selectShapes({ elementIds: string[], toggle?: boolean })
api.selection.clearSelection()
api.selection.setSelectionMode('element' | 'group')
api.selection.setSelectionGesture('click' | 'rect' | 'lasso')
api.selection.setTransformMode('free' | 'rotate' | 'scale')
api.selection.setProportionalResize(enabled: boolean)
api.selection.setSnapRotation(enabled: boolean)
api.selection.setRotationStep(step: number)
```

### canvas — холст и инструменты

```ts
api.canvas.getCanvasSize(): { widthMM, heightMM, widthPx, heightPx, pxPerMM }
api.canvas.setArtboardSize(widthMM, heightMM)
api.canvas.setPanMode(enabled: boolean)
api.canvas.setActiveCreationTool(type: ElementType | null)
api.canvas.showGrid() / hideGrid() / isGridVisible() / setGridStep(mm)
api.canvas.showPreloader() / hidePreloader()
api.canvas.setRulersVisible(v: boolean)
api.canvas.addGuideline(orientation: 'v' | 'h', position: number): string
api.canvas.removeGuideline(id: string)
api.canvas.setDebugMode(enabled: boolean)
api.canvas.debugShowHitArea: boolean
```

### snap — привязки

```ts
api.snap.setSnapToElements(v: boolean)
api.snap.setSnapToArtboard(v: boolean)
api.snap.setSnapToGrid(v: boolean)
api.snap.setSnapToCorners(v: boolean)
api.snap.setSnapToPlanes(v: boolean)
api.snap.setAvoidCollisions(v: boolean)
api.snap.setLockDragAxis(v: boolean)
api.snap.setSnapAxis(v: boolean)
```

### zOrder

```ts
api.zOrder.raise()
api.zOrder.lower()
api.zOrder.raiseToTop()
api.zOrder.lowerToBottom()
```

### clipboard

```ts
api.clipboard.duplicateSelected()
api.clipboard.useDuplicateSelected()
api.clipboard.unbindUseElement(id: string)
```

### nodeEdit — редактирование узлов пути

```ts
api.nodeEdit.enterNodeEdit(elementIds: string[])
api.nodeEdit.exitNodeEdit()
api.nodeEdit.selectAllNodes()
api.nodeEdit.selectNoNodes()
api.nodeEdit.invertNodeSelection()
api.nodeEdit.changeNodeType(type: 'L' | 'C' | 'Q')
api.nodeEdit.smoothNode()
api.nodeEdit.sharpenNode()
api.nodeEdit.nudgeNode(delta: { x, y })
api.nodeEdit.deleteSelectedNodes()
```

### measure — измерения

```ts
api.measure.activateRuler()
api.measure.activateProtractor('points' | 'objects')
api.measure.deactivateMeasureTool()
api.measure.clearMeasurements()
```

### history

```ts
api.history.undo()
api.history.redo()
api.history.save(): TimeMachineRecord[]
api.history.load(records: TimeMachineRecord[])
```

### data — загрузка/выгрузка

```ts
api.data.load(elements, groups)
api.data.toDTO(): { elements, groups }
```

### bake — запекание

```ts
api.bake.bake()
```

### merge — склейка

```ts
api.merge.merge()
```

### textToPath

```ts
api.textToPath.convertSelected()
```

### laser — лазерная раскройка

```ts
api.laser.setLaserLensFocal(mm)
api.laser.setLaserDiameter(mm)
api.laser.setLaserBeamDiameter(mm)
api.laser.setMaterialHeight(mm)
api.laser.createLaserGroup(name, color, type, ...)
api.laser.deleteLaserGroup(id)
api.laser.laserGroupAddElements(groupId, elementIds)
api.laser.laserGroupRemoveElements(groupId, elementIds)
api.laser.setNonLaserElementsVisible(v: boolean)
api.laser.setLaserElementsTranslucent(v: boolean)
```

### cutParams — параметры реза

```ts
api.laser.cutParams.setMode(enabled: boolean)
api.laser.cutParams.setMovable(v: boolean)
api.laser.cutParams.setResizable(v: boolean)
api.laser.cutParams.isActive(): boolean
```

### raster — растрирование

```ts
api.raster.applyDithering(algorithm: DitherAlgorithm, options?: DitherOptions)
api.raster.getState(): RasterState | null
api.raster.reset()
```

### mask — маскирование изображений

```ts
api.mask.enterMaskMode()
api.mask.exitMaskMode()
api.mask.assignMask()
api.mask.removeMask()
api.mask.unmaskImage()
```

### flexTree

```ts
api.flexTree.setFlexTreeAlgorithm(elementId: string, algorithm: string)
api.flexTree.setFlexTreeParams(elementId: string, params: Record<string, unknown>)
api.flexTree.removeFlexTree(elementId: string)
api.flexTree.applyFlexTreePreset(elementId: string, preset: string)
```

### textEdit — шрифты

```ts
api.textEdit.initTextFonts(googleApiKey?: string)
api.textEdit.searchFonts(query: string): Promise<FontResult[]>
api.textEdit.getFontVariants(family: string): FontVariant[]
api.textEdit.setTextFontFamily(family: string)
api.textEdit.setTextFontWeight(weight: string)
api.textEdit.setTextFontSize(size: number)
api.textEdit.setTextLineHeight(height: number)
api.textEdit.setTextColor(color: string)
```

### Подписка на события

```ts
const unsub = api.on(eventType: string, (event: BusEvent) => void): () => void
api.off(eventType: string, fn)
```

### Уничтожение

```ts
api.destroy()
```

---

## Типы

### CreateShapeDTO

```ts
interface CreateShapeDTO {
  type: 'rect' | 'circle' | 'ellipse' | 'line' | 'path' | 'polygon' | 'polyline' | 'text' | 'image' | 'use';
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

### Геометрия

| Тип | Параметры |
|-----|-----------|
| `rect` | `{ x, y, width, height, rx?, ry? }` |
| `circle` | `{ cx, cy, r }` |
| `ellipse` | `{ cx, cy, rx, ry }` |
| `line` | `{ x1, y1, x2, y2 }` |
| `path` | `{ d: string }` |
| `polygon` | `{ points: string }` |
| `polyline` | `{ points: string }` |
| `text` | `{ x, y, fontSize?, fontFamily?, textAnchor?, textContent? }` |
| `image` | `{ x, y, width, height, href }` |

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
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  matrix?: [a, b, c, d, e, f];
}
```

---

## События

События — строковые идентификаторы, подписка через `api.on(type, handler)`. Обработчик получает `BusEvent = { type: string; data: unknown }`. Подписка на `'*'` ловит все события.

### Элементы и холст

| Событие | `data` | Описание |
|---------|--------|----------|
| `NODE_EDIT_ENTERED` | `{ ids: string[] }` | Вход в режим редактирования узлов |
| `NODE_EDIT_EXITED` | `{}` | Выход из режима редактирования узлов |
| `NODE_SELECTION_CHANGED` | `{ count: number }` | Изменилось выделение узлов |
| `ELEMENT_SIZE` | `{ id, xMm, yMm, widthMm, heightMm, angleDeg }` | Изменились размеры/позиция элемента |
| `SVG_CAD_SELECT` | selection data | Изменилось выделение элементов |
| `element-outlined` | `{ id, newId }` | Элемент оконтурен |
| `IMG_SELECT_EDIT` | `{ id, href?, editedImage?, ... }` | Выбрано изображение для редактирования |

### Группы

| Событие | `data` | Описание |
|---------|--------|----------|
| `GROUP_CREATED` | `{ id, name }` | Группа создана |
| `GROUP_DELETED` | `{ id }` | Группа удалена |
| `GROUP_ELEMENT_ADDED` | `{ groupId, elementId }` | Элемент добавлен в группу |
| `GROUP_ELEMENT_REMOVED` | `{ groupId, elementId }` | Элемент удалён из группы |
| `GROUP_CLEARED` | `{ id }` | Группа очищена |
| `GROUP_SELECTION_CHANGED` | `{ ids: string[] }` | Изменилось выделение групп |

### Булевы операции

| Событие | `data` | Описание |
|---------|--------|----------|
| `BOOLEAN_MODE_ENTER` | `{ op: BooleanOp }` | Вход в режим булевых операций |
| `BOOLEAN_MODE_EXIT` | `{}` | Выход из режима |
| `BOOLEAN_COMMIT` | `{ subjectIds, clipIds, resultId }` | Применение булевой операции |
| `BOOLEAN_CANCEL` | `{ op: BooleanOp }` | Отмена булевой операции |

### Лазерная раскройка

| Событие | `data` | Описание |
|---------|--------|----------|
| `LASER_GROUP_CREATED` | `{ id, group }` | Лазерная группа создана |
| `LASER_GROUP_DELETED` | `{ id }` | Лазерная группа удалена |
| `LASER_GROUP_ELEMENT_ADDED` | `{ groupId, elementId }` | Элемент добавлен в лазерную группу |
| `LASER_GROUP_ELEMENT_REMOVED` | `{ groupId, elementId }` | Элемент удалён из лазерной группы |
| `LASER_GROUP_CLEARED` | `{ id }` | Лазерная группа очищена |
| `LASER_GROUP_UPDATED` | `{ id, fields }` | Лазерная группа обновлена |
| `LASER_SETTINGS_CHANGED` | настройки лазера | Изменились настройки лазера |
| `LASER_VISIBILITY_CHANGED` | `{ visibleNonLaser?, visibleTranslucent? }` | Изменилась видимость слоёв |
| `LASER_COLOR_GRADING_CHANGED` | `{ gradingMap }` | Изменился цветовой грейдинг |
| `LASER_STYLE_LOCKED` | `{ id: string }` | Стиль заблокирован |
| `CUT_PARAMS_GRADING_CHANGED` | `{ gradingMap }` | Изменился грейдинг параметров реза |
| `CUT_PARAMS_MODE_CHANGED` | `{ enabled: boolean }` | Включён/выключен режим параметров реза |

### Измерения, холст, сетка

| Событие | `data` | Описание |
|---------|--------|----------|
| `MEASURE_TOOL_CHANGED` | `{ tool: string \| null }` | Активирован/деактивирован инструмент измерений |
| `MEASURE_ADDED` | `{ result: MeasureResult }` | Добавлен результат измерения |
| `SVG_CAD_PAN_MODE_CHANGED` | `{ enabled: boolean }` | Режим панорамирования изменён |
| `artboard-resized` | `{ widthMM, heightMM }` | Изменён размер артборда |
| `grid-toggled` | `{ visible: boolean }` | Сетка показана/скрыта |
| `grid-step-changed` | `{ stepMM: number }` | Изменён шаг сетки |
| `preloader-toggled` | `{ visible: boolean }` | Прелоадер показан/скрыт |

### Привязки, выделение, трансформация

| Событие | `data` | Описание |
|---------|--------|----------|
| `PROPORTIONAL_RESIZE_TOGGLED` | `{ enabled: boolean }` | Пропорциональный ресайз вкл/выкл |
| `ROTATION_SNAP_TOGGLED` | `{ enabled: boolean }` | Привязка поворота вкл/выкл |
| `ROTATION_STEP_CHANGED` | `{ step: number }` | Изменён шаг поворота |
| `DRAG_AXIS_LOCK_CHANGED` | `{ enabled: boolean }` | Блокировка оси перетаскивания |

### Линейки и направляющие

| Событие | `data` | Описание |
|---------|--------|----------|
| `RULER_VISIBILITY_CHANGED` | `{ visible: boolean }` | Линейки показаны/скрыты |
| `RULER_GUIDELINE_ADD` | `{ id, orientation: 'v' \| 'h', position }` | Направляющая добавлена |
| `RULER_GUIDELINE_REMOVE` | `{ id }` | Направляющая удалена |
| `RULER_GUIDELINE_MOVE` | `{ id, position }` | Направляющая передвинута |
| `RULER_GUIDELINES_VISIBILITY_CHANGED` | `{ orientation: 'v' \| 'h', visible }` | Видимость направляющих изменена |

### Шрифты и текст

| Событие | `data` | Описание |
|---------|--------|----------|
| `FONTS_READY` | `{}` | Шрифты загружены |
| `FONT_LOADING_START` | `{ family, weight }` | Начало загрузки шрифта |
| `FONT_LOADING_END` | `{ family, weight }` | Конец загрузки шрифта |

### FlexTree, Merge, Данные

| Событие | `data` | Описание |
|---------|--------|----------|
| `FLEX_TREE_CHANGED` | `{ id, algorithm? \| preset? \| params? }` | Изменён алгоритм/параметры flex tree |
| `FLEX_TREE_REMOVED` | `{ id }` | Flex tree удалён |
| `MERGE_WARNING` | `{ badIds: string[] }` | Предупреждение при склейке |
| `elements-loaded` | элементы | Элементы загружены |
| `elements-added` | элементы | Элементы добавлены |
| `elements-updated` | patches | Элементы обновлены |
| `groups-loaded` | группы | Группы загружены |
| `groups-added` | группы | Группы добавлены |
| `groups-updated` | patches | Группы обновлены |
| `color-map-recalculated` | `{}` | Пересчитана цветовая карта |

---

## Импорт / экспорт

### Конвертация SVG-узлов

```ts
import { svgNodesToElements } from 'svg-canvas';

const elements = svgNodesToElements([
  { id: 'p1', type: 'path', attributes: { d: 'M 10 10 L 100 100', stroke: 'black', 'stroke-width': '2', fill: 'none' } },
]);

for (const el of elements) {
  canvas.api.shapes.addShape(el);
}
```

### Сохранение/восстановление

```ts
const snapshot = api.history.save();
localStorage.setItem('project', JSON.stringify(snapshot));

const loaded = JSON.parse(localStorage.getItem('project')!);
api.history.load(loaded);
```

### Данные элементов и групп

```ts
const dto = api.data.toDTO();
api.data.load(dto.elements, dto.groups);
```

---

## Разработка

```bash
npm install
npm run dev         # сборка в watch-режиме
npm run example     # запуск примеров (Vite)
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm run build       # production-сборка в dist/
```

## Лицензия

MIT
