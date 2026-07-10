import { SvgCanvas } from '../src/core';
import type { ExternalApi } from '../src/api/external-api';
import type { BusEvent } from '../src/types';
import type { GroupData } from '../src/types';
import { svgNodesToElements } from '../src/api/dto/svg-node-factory';
import type { SvgNodeDto } from '../src/api/dto/svg-node-dto';
import svgNodes from './svg-nodes.json';
import groupsData from './groups.json';
import type { CreateShapeDTO } from '../src/api/dto';

let api: ExternalApi;

// ─── Initialization ──────────────────────────────────────

function init(): void {
  const container = document.getElementById('canvas-container')!;
  const canvas = new SvgCanvas(container, { width: 800, height: 600 });
  api = canvas.api;
  api.setArtboardSize(210, 297);

  loadDemoData();
  setupEventLog();
  setupTopToolbar();
  setupLeftToolbar();
  setupRightPanel();
  setupFlexTreePanel();
  setupKeyboardShortcuts();
  setupNodeEditToolbar();
  setupMeasureToolbar();
  setupSizeInputs();
  setupLaserPanel();
  setupTextPanel();
}

const GOOGLE_FONTS_KEY = 'AIzaSyBtoXXgjyOUNazwWDWAenfPkoRN7U8VlUs';

function setupTextPanel(): void {
  const fontSel = document.getElementById('txt-font') as HTMLSelectElement;
  const weightSel = document.getElementById('txt-weight') as HTMLSelectElement;
  const sizeInp = document.getElementById('txt-size') as HTMLInputElement;
  const colorInp = document.getElementById('txt-color') as HTMLInputElement;

  const fillWeights = (family: string): void => {
    const meta = api.getFontVariants(family);
    weightSel.innerHTML = '';
    const weights = meta?.weights ?? ['400', '700'];
    for (const w of weights) {
      const o = document.createElement('option');
      o.value = w;
      o.textContent = w;
      weightSel.appendChild(o);
    }
  };

  api
    .initTextFonts(GOOGLE_FONTS_KEY)
    .then(() => {
      const fonts = api.searchFonts('').slice(0, 100);
      fontSel.innerHTML = '';
      for (const f of fonts) {
        const o = document.createElement('option');
        o.value = f.family;
        o.textContent = f.family;
        fontSel.appendChild(o);
      }
      if (fonts[0]) fillWeights(fonts[0].family);
    })
    .catch((e) => console.warn('Fonts init failed', e));

  fontSel.onchange = () => {
    fillWeights(fontSel.value);
    api.setTextFontFamily(fontSel.value);
  };
  weightSel.onchange = () => api.setTextWeight(weightSel.value);
  sizeInp.onchange = () => api.setTextFontSize(parseFloat(sizeInp.value));
  colorInp.onchange = () => api.setTextColor(colorInp.value);
  document.getElementById('txt-italic')!.onclick = () =>
    api.setTextItalic(toggleBtn('txt-italic'));
  document.getElementById('txt-underline')!.onclick = () =>
    api.setTextUnderline(toggleBtn('txt-underline'));
  document.getElementById('txt-strike')!.onclick = () =>
    api.setTextStrike(toggleBtn('txt-strike'));
  document.getElementById('txt-align-left')!.onclick = () =>
    api.setTextAlign('left');
  document.getElementById('txt-align-center')!.onclick = () =>
    api.setTextAlign('center');
  document.getElementById('txt-align-right')!.onclick = () =>
    api.setTextAlign('right');

  // Кнопка «🔤 Текст» — инструмент создания
  document.getElementById('btn-creation-text')!.onclick = () => {
    api.setActiveCreationTool('text');
  };
}

function toggleBtn(id: string): boolean {
  const btn = document.getElementById(id)!;
  const on = !btn.classList.contains('on');
  btn.classList.toggle('on', on);
  return on;
}

// ─── Demo Data ───────────────────────────────────────────

function loadDemoData(): void {
  const elements = svgNodesToElements(svgNodes as SvgNodeDto[]);
  for (const el of elements) {
    api.addShape(el);
  }

  api.loadGroups(groupsData as Record<string, unknown>[]);

  for (const el of elements) {
    if (el.groupId) {
      api.groupAddElements({ groupId: el.groupId, elementIds: [el.id] });
    }
  }
}

// ─── Event Log ───────────────────────────────────────────

let logPaused = false;
let logEntries: HTMLElement[] = [];
const MAX_LOG = 200;

function setupEventLog(): void {
  const logEl = document.getElementById('event-log')!;

  api.on('*', (event: BusEvent) => {
    if (logPaused) return;

    const time = new Date().toLocaleTimeString();
    const dataStr =
      event.data !== undefined && event.data !== null
        ? typeof event.data === 'object'
          ? JSON.stringify(event.data).slice(0, 120)
          : String(event.data).slice(0, 120)
        : '';

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `<span class="time">${time}</span><span class="event-name">${event.type}</span> <span class="event-data">${dataStr}</span>`;
    logEl.prepend(entry);
    logEntries.push(entry);

    while (logEntries.length > MAX_LOG) {
      const old = logEntries.shift();
      old?.remove();
    }
  });

  document.getElementById('btn-log-clear')!.onclick = () => {
    logEl.innerHTML = '';
    logEntries = [];
  };

  const pauseChk = document.getElementById('chk-log-pause') as HTMLInputElement;
  pauseChk.onchange = () => {
    logPaused = pauseChk.checked;
  };
}

// ─── Top Toolbar ─────────────────────────────────────────

function setupTopToolbar(): void {
  toggleButton('btn-snap-corners', false, (v) => api.setSnapToCorners(v));
  toggleButton('btn-snap-planes', false, (v) => api.setSnapToPlanes(v));
  toggleButton('btn-snap-artboard', false, (v) => api.setSnapToArtboard(v));
  toggleButton('btn-snap-guidelines', false, (v) => api.setSnapToGuidelines(v));
  toggleButton('btn-snap-grid', false, (v) => api.setSnapToGrid(v));
  toggleButton('btn-snap-elements', true, (v) => api.setSnapToElements(v));
  toggleButton('btn-avoid-collisions', false, (v) => api.setAvoidCollisions(v));
  toggleButton('btn-lock-drag-axis', false, (v) => api.setLockDragAxis(v));

  const snapAxis = document.getElementById(
    'sel-snap-axis',
  ) as HTMLSelectElement;
  snapAxis.onchange = () => {
    api.setSnapAxis(snapAxis.value as 'both' | 'horizontal' | 'vertical');
  };

  document.getElementById('btn-transform-resize')!.onclick = () =>
    api.setTransformMode('resize');
  document.getElementById('btn-transform-rotate')!.onclick = () =>
    api.setTransformMode('rotate');
  toggleButton('btn-proportional-resize', false, (v) =>
    api.setProportionalResize(v),
  );
  toggleButton('btn-snap-rotation', false, (v) => api.setSnapRotation(v));

  document.getElementById('btn-flex-tree')!.onclick = () => {
    const panel = document.getElementById('flex-tree-panel')!;
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    if (panel.style.display === 'block') syncFlexPanelFromSelection();
  };

  toggleButton('btn-pan-mode', false, (v) => api.setPanMode(v));
  toggleButton('btn-toggle-rulers', false, (v) => api.setRulersVisible(v));
  toggleButton('btn-toggle-grid', false, (v) =>
    v ? api.showGrid() : api.hideGrid(),
  );

  const gridStep = document.getElementById(
    'input-grid-step',
  ) as HTMLInputElement;
  gridStep.onchange = () => api.setGridStep(Number(gridStep.value));

  let booleanActive = false;
  document.getElementById('btn-bool-union')!.onclick = () => {
    api.enterBooleanMode('UNION');
    setBooleanActive(true);
  };
  document.getElementById('btn-bool-intersect')!.onclick = () => {
    api.enterBooleanMode('INTERSECT');
    setBooleanActive(true);
  };
  document.getElementById('btn-bool-diff')!.onclick = () => {
    api.enterBooleanMode('DIFFERENCE');
    setBooleanActive(true);
  };
  document.getElementById('btn-bool-exit')!.onclick = () => {
    api.exitBooleanMode();
    setBooleanActive(false);
  };

  function setBooleanActive(v: boolean): void {
    booleanActive = v;
    ['btn-bool-union', 'btn-bool-intersect', 'btn-bool-diff'].forEach((id) => {
      document.getElementById(id)!.style.display = v ? 'none' : '';
    });
    document.getElementById('btn-bool-exit')!.style.display = v ? '' : 'none';
  }

  toggleButton('btn-debug-hitarea', false, (v) => {
    api.debugShowHitArea = v;
  });

  document.getElementById('btn-preloader')!.onclick = () => {
    if (api.isPreloaderVisible()) {
      api.hidePreloader();
    } else {
      api.showPreloader();
    }
  };
}

// ─── Left Toolbar ────────────────────────────────────────

let currentCreationType: string | null = null;

function setupLeftToolbar(): void {
  const btnElem = document.getElementById('btn-sel-element')!;
  const btnGroup = document.getElementById('btn-sel-group')!;

  btnElem.onclick = () => {
    api.setSelectionMode('element');
    btnElem.classList.add('active');
    btnGroup.classList.remove('active');
  };
  btnGroup.onclick = () => {
    api.setSelectionMode('group');
    btnGroup.classList.add('active');
    btnElem.classList.remove('active');
  };

  const gestureBtns = document.querySelectorAll('.gesture-btn');
  const setGesture = (gesture: string, activeBtn: Element) => {
    api.setSelectionGesture(gesture as any);
    gestureBtns.forEach((b) => b.classList.remove('active'));
    activeBtn.classList.add('active');
  };
  document.getElementById('btn-gesture-click')!.onclick = function () {
    setGesture('click', this);
  };
  document.getElementById('btn-gesture-rect')!.onclick = function () {
    setGesture('rect', this);
  };
  document.getElementById('btn-gesture-lasso')!.onclick = function () {
    setGesture('lasso', this);
  };

  const creationTools = document.querySelectorAll('.creation-tool[data-type]');
  const cancelBtn = document.getElementById('btn-creation-cancel')!;

  creationTools.forEach((btn) => {
    const type = (btn as HTMLElement).dataset.type!;
    btn.addEventListener('click', () => {
      currentCreationType = type;
      api.setActiveCreationTool(type as any);
      creationTools.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      cancelBtn.style.display = '';
    });
  });

  cancelBtn.onclick = () => {
    currentCreationType = null;
    api.setActiveCreationTool(null);
    creationTools.forEach((b) => b.classList.remove('active'));
    cancelBtn.style.display = 'none';
  };

  document.getElementById('btn-undo')!.onclick = () => api.undo();
  document.getElementById('btn-redo')!.onclick = () => api.redo();

  document.getElementById('btn-delete')!.onclick = () => {
    const selected = api.getSelected();
    if (selected.length > 0) {
      api.deleteShapes({ elementIds: selected.map((e) => e.id) });
    }
  };

  document.getElementById('btn-outline')!.onclick = () => {
    const selected = api.getSelected();
    if (selected.length > 0) {
      api.outlineElement(selected[0].id);
    }
  };

  document.getElementById('btn-sel-all')!.onclick = () => {
    const all = api.getAllShapes();
    api.selectShapes({ elementIds: all.map((e) => e.id) });
  };
  document.getElementById('btn-sel-none')!.onclick = () => api.clearSelection();

  document.getElementById('btn-apply-style')!.onclick = () => {
    const selected = api.getSelected();
    if (selected.length === 0) return;

    const fill = (document.getElementById('input-fill') as HTMLInputElement)
      .value;
    const stroke = (document.getElementById('input-stroke') as HTMLInputElement)
      .value;
    const strokeWidth = Number(
      (document.getElementById('input-stroke-width') as HTMLInputElement).value,
    );

    api.updateShapes({
      elementIds: selected.map((e) => e.id),
      style: {
        fill,
        stroke,
        strokeWidth: isNaN(strokeWidth) ? undefined : strokeWidth,
      },
    });
  };
}

// ─── Right Panel: Groups ─────────────────────────────────

function setupRightPanel(): void {
  const list = document.getElementById('group-list')!;
  const nameInput = document.getElementById(
    'input-group-name',
  ) as HTMLInputElement;
  let selectedGroupId: string | null = null;

  function renderGroups(): void {
    const groups = api.getGroups();
    list.innerHTML = '';

    for (const g of groups) {
      const li = document.createElement('li');
      li.innerHTML = `<span>${g.name}</span><span class="group-count">${g.elementIds?.size ?? 0} elem</span>`;
      if (g.id === selectedGroupId) li.classList.add('selected');

      li.onclick = () => {
        selectedGroupId = g.id;
        api.selectGroup(g.id);
        renderGroups();
      };
      li.ondblclick = () => {
        api.selectGroupElements(g.id);
      };
      list.appendChild(li);
    }

    if (groups.length === 0) {
      list.innerHTML =
        '<li style="color:var(--text-muted);cursor:default">No groups</li>';
    }
  }

  api.onGroupsChange = () => renderGroups();

  document.getElementById('btn-group-create')!.onclick = () => {
    api.groupCreate({ name: nameInput.value.trim() || 'New Group' });
    renderGroups();
  };

  document.getElementById('btn-group-delete')!.onclick = () => {
    if (selectedGroupId) {
      api.groupDelete({ groupId: selectedGroupId });
      selectedGroupId = null;
      renderGroups();
    }
  };

  document.getElementById('btn-group-add-elem')!.onclick = () => {
    if (!selectedGroupId) return;
    const selected = api.getSelected();
    if (selected.length > 0) {
      api.groupAddElements({
        groupId: selectedGroupId,
        elementIds: selected.map((e) => e.id),
      });
    }
  };

  document.getElementById('btn-group-rem-elem')!.onclick = () => {
    if (!selectedGroupId) return;
    const selected = api.getSelected();
    if (selected.length > 0) {
      api.groupRemoveElements({
        groupId: selectedGroupId,
        elementIds: selected.map((e) => e.id),
      });
    }
  };

  renderGroups();
}

// ─── Keyboard Shortcuts ──────────────────────────────────

function setupKeyboardShortcuts(): void {
  // Пан по пробелу
  document.addEventListener('keydown', (e) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;
    if (
      e.key === ' ' &&
      !e.repeat &&
      !api.isTextEditing() &&
      !api.isNodeEditing &&
      !api.getMeasureTool()
    ) {
      e.preventDefault();
      api.setPanHeld(true);
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
      api.setPanHeld(false);
    }
  });

  // Основная клавиатура
  document.addEventListener('keydown', (e) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;

    const meta = e.metaKey || e.ctrlKey;

    // ── Редактирование текста (дабл-клик) ──
    if (api.isTextEditing()) {
      if (e.key === 'Escape') {
        e.preventDefault();
        api.exitTextEdit();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        api.deleteTextCharacter('backward');
        return;
      }
      if (meta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        api.undoTextEdit();
        return;
      }
      if (meta && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        api.redoTextEdit();
        return;
      }
      return;
    }

    // ── Инструменты измерения ──
    if (api.getMeasureTool()) {
      if (e.key === 'Escape') {
        e.preventDefault();
        api.cancelMeasure();
        api.deactivateMeasureTool();
        return;
      }
    }

    // ── Режим редактирования узлов ──
    if (api.isNodeEditing) {
      if (meta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        api.undoNodeEdit();
        return;
      }
      if (meta && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        api.redoNodeEdit();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        api.exitNodeEdit();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        api.deleteSelectedNodes();
        return;
      }
      if (meta && e.key === 'a') {
        e.preventDefault();
        api.selectAllNodes();
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        api.nudgeSelectedNodes(-step, 0);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        api.nudgeSelectedNodes(step, 0);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        api.nudgeSelectedNodes(0, -step);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        api.nudgeSelectedNodes(0, step);
        return;
      }
      return;
    }

    // ── Обычный режим ──
    if (meta && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      api.undo();
      return;
    }
    if (meta && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      api.redo();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const selected = api.getSelected();
      if (selected.length > 0) {
        api.deleteShapes({ elementIds: selected.map((el) => el.id) });
      }
      return;
    }
    if (meta && e.key === 'a') {
      e.preventDefault();
      const all = api.getAllShapes();
      api.selectShapes({ elementIds: all.map((el) => el.id) });
      return;
    }
  });
}

// ─── Node Edit Panel ──────────────────────────────────────

function setupNodeEditToolbar(): void {
  const panel = document.getElementById('node-edit-panel') as HTMLElement;
  const countEl = document.getElementById('node-sel-count') as HTMLElement;
  const multiBtn = document.getElementById(
    'btn-node-multi',
  ) as HTMLButtonElement;

  const show = (visible: boolean): void => {
    panel.style.display = visible ? 'block' : 'none';
  };

  api.on('NODE_EDIT_ENTERED', () => show(true));
  api.on('NODE_EDIT_EXITED', () => {
    show(false);
    multiBtn.textContent = 'Мультивыбор: off';
    multiBtn.classList.remove('active');
  });
  api.on('NODE_SELECTION_CHANGED', (ev) => {
    const count = (ev.data as { count?: number })?.count ?? 0;
    countEl.textContent = `Выбрано: ${count}`;
  });

  const click = (id: string, fn: () => void): void => {
    const el = document.getElementById(id);
    if (el) (el as HTMLButtonElement).onclick = fn;
  };

  multiBtn.onclick = () => {
    const on = !api.getNodeMultiSelect();
    api.setNodeMultiSelect(on);
    multiBtn.textContent = `Мультивыбор: ${on ? 'on' : 'off'}`;
    multiBtn.classList.toggle('active', on);
  };

  click('btn-node-exit', () => api.exitNodeEdit());
  click('btn-node-selall', () => api.selectAllNodes());
  click('btn-node-selnone', () => api.clearNodeSelection());
  click('btn-node-selinv', () => api.invertNodeSelection());
  click('btn-node-corner', () => api.setSelectedNodesType('corner'));
  click('btn-node-smooth', () => api.setSelectedNodesType('smooth'));
  click('btn-node-symmetric', () => api.setSelectedNodesType('symmetric'));
  click('btn-node-smooth-op', () => api.smoothSelectedNodes());
  click('btn-node-sharpen-op', () => api.sharpenSelectedNodes());
  click('btn-node-distribute', () => api.distributeSelectedNodesEvenly());
  click('btn-node-delete', () => api.deleteSelectedNodes());
  click('btn-node-undo', () => api.undoNodeEdit());
  click('btn-node-redo', () => api.redoNodeEdit());

  makeDraggable(
    panel,
    document.getElementById('node-edit-header') as HTMLElement,
  );
}

// ─── Measure Toolbar ──────────────────────────────────────

function setupMeasureToolbar(): void {
  const exitBtn = document.getElementById(
    'btn-measure-exit',
  ) as HTMLButtonElement;
  const rulerBtn = document.getElementById(
    'btn-measure-ruler',
  ) as HTMLButtonElement;
  const angleBtn = document.getElementById(
    'btn-measure-angle',
  ) as HTMLButtonElement;
  const angleObjBtn = document.getElementById(
    'btn-measure-angle-obj',
  ) as HTMLButtonElement;

  const clearActive = (): void => {
    for (const b of [rulerBtn, angleBtn, angleObjBtn])
      b.classList.remove('active');
  };

  api.on('MEASURE_TOOL_CHANGED', (ev) => {
    const tool = (ev.data as { tool?: string | null })?.tool ?? null;
    exitBtn.style.display = tool ? '' : 'none';
    if (!tool) clearActive();
  });

  rulerBtn.onclick = () => {
    clearActive();
    rulerBtn.classList.add('active');
    api.activateRuler();
  };
  angleBtn.onclick = () => {
    clearActive();
    angleBtn.classList.add('active');
    api.activateProtractor('points');
  };
  angleObjBtn.onclick = () => {
    clearActive();
    angleObjBtn.classList.add('active');
    api.activateProtractor('objects');
  };
  document.getElementById('btn-measure-clear')!.onclick = () =>
    api.clearMeasurements();
  exitBtn.onclick = () => api.deactivateMeasureTool();
}

// ─── Size Inputs ───────────────────────────────────────────

function setupSizeInputs(): void {
  const inpW = document.getElementById('inp-size-w') as HTMLInputElement;
  const inpH = document.getElementById('inp-size-h') as HTMLInputElement;
  const labelW = inpW.parentElement!;
  const labelH = inpH.parentElement!;
  let currentId: string | null = null;
  let currentAngle = 0;
  let mode: 'resize' | 'rotate' = 'resize';

  const showSize = (): void => {
    labelW.style.display = '';
    inpW.type = 'number';
    inpW.step = '0.1';
    labelH.style.display = '';
    inpH.type = 'number';
    inpH.step = '0.1';
  };
  const showAngle = (): void => {
    labelW.firstChild!.textContent = '∠ ';
    labelW.style.display = '';
    inpW.type = 'number';
    inpW.step = '0.1';
    labelH.style.display = 'none';
  };

  api.on('ELEMENT_SIZE', (ev) => {
    const data = ev.data as {
      id: string | null;
      widthMm: number;
      heightMm: number;
      angleDeg: number;
    };
    if (!data.id) {
      inpW.disabled = true;
      inpH.disabled = true;
      inpW.value = '';
      inpH.value = '';
      currentId = null;
      return;
    }
    currentId = data.id;
    currentAngle = data.angleDeg;

    if (mode === 'rotate') {
      showAngle();
      inpW.value = data.angleDeg.toFixed(1);
      inpH.disabled = true;
    } else {
      showSize();
      inpW.value = data.widthMm.toFixed(1);
      inpH.value = data.heightMm.toFixed(1);
      inpH.disabled = false;
    }
    inpW.disabled = false;
  });

  const apply = (): void => {
    if (!currentId) return;
    if (mode === 'rotate') {
      const target = parseFloat(inpW.value);
      if (!isNaN(target)) {
        const delta = target - currentAngle;
        if (Math.abs(delta) > 0.001) api.rotateElement(currentId, delta);
      }
    } else {
      const w = parseFloat(inpW.value);
      const h = parseFloat(inpH.value);
      if (w > 0 && h > 0) api.resizeElement(currentId, w, h);
    }
  };

  inpW.addEventListener('change', apply);
  inpH.addEventListener('change', apply);
  inpW.addEventListener('keydown', (e) => e.key === 'Enter' && apply());
  inpH.addEventListener('keydown', (e) => e.key === 'Enter' && apply());

  // Отслеживаем режим — подписываемся на клики кнопок, не перезаписывая их
  document
    .getElementById('btn-transform-resize')!
    .addEventListener('click', () => {
      mode = 'resize';
    });
  document
    .getElementById('btn-transform-rotate')!
    .addEventListener('click', () => {
      mode = 'rotate';
      if (currentId) {
        showAngle();
        inpW.value = currentAngle.toFixed(1);
        inpH.disabled = true;
        inpW.disabled = false;
      }
    });
}

// ─── Flex Tree Panel ──────────────────────────────────────

let flexSelectedElementId: string | null = null;

function syncFlexPanelFromSelection(): void {
  flexSelectedElementId = null;
  // Use the API to find currently selected element
  const selected = (api as any).canvas?.selectionState?.selected as
    | Array<{ id: string }>
    | undefined;
  if (selected && selected.length === 1) {
    flexSelectedElementId = selected[0].id;
  }
  if (!flexSelectedElementId) return;

  const cfg = api.getFlexTreeConfig(flexSelectedElementId);
  const stepInp = document.getElementById('inp-flex-step') as HTMLInputElement;
  const linkInp = document.getElementById('inp-flex-link') as HTMLInputElement;
  const dashInp = document.getElementById('inp-flex-dash') as HTMLInputElement;
  const ampInp = document.getElementById(
    'inp-flex-amplitude',
  ) as HTMLInputElement;

  if (cfg) {
    stepInp.value = String(cfg.step);
    linkInp.value = String(cfg.link);
    dashInp.value = String(cfg.dash);
    ampInp.value = String(cfg.amplitude);
    setFlexModeBtn(cfg.algorithm);
  } else {
    stepInp.value = '3.5';
    linkInp.value = '3.0';
    dashInp.value = '25.0';
    ampInp.value = '1.0';
    setFlexModeBtn('linear');
  }
}

function setFlexModeBtn(mode: string): void {
  document
    .querySelectorAll('.flex-mode-btn')
    .forEach((b) => b.classList.remove('active'));
  const el = document.getElementById(`btn-flex-${mode}`);
  if (el) el.classList.add('active');
}

function setupFlexTreePanel(): void {
  document.getElementById('btn-flex-close')!.onclick = () => {
    document.getElementById('flex-tree-panel')!.style.display = 'none';
  };

  document.getElementById('btn-flex-linear')!.onclick = () =>
    setFlexModeBtn('linear');
  document.getElementById('btn-flex-wave')!.onclick = () =>
    setFlexModeBtn('wave');
  document.getElementById('btn-flex-cross')!.onclick = () =>
    setFlexModeBtn('cross');

  document.getElementById('btn-preset-thin')!.onclick = () =>
    applyPreset('thin');
  document.getElementById('btn-preset-standard')!.onclick = () =>
    applyPreset('standard');
  document.getElementById('btn-preset-thick')!.onclick = () =>
    applyPreset('thick');

  document.getElementById('btn-flex-apply')!.onclick = () => {
    if (!flexSelectedElementId) return;
    const active = document.querySelector('.flex-mode-btn.active');
    const algo = active ? active.id.replace('btn-flex-', '') : 'linear';
    api.setFlexTreeAlgorithm(flexSelectedElementId, algo as never);
    api.setFlexTreeParams(flexSelectedElementId, {
      step: Number(
        (document.getElementById('inp-flex-step') as HTMLInputElement).value,
      ),
      link: Number(
        (document.getElementById('inp-flex-link') as HTMLInputElement).value,
      ),
      dash: Number(
        (document.getElementById('inp-flex-dash') as HTMLInputElement).value,
      ),
      amplitude: Number(
        (document.getElementById('inp-flex-amplitude') as HTMLInputElement)
          .value,
      ),
    });
  };

  document.getElementById('btn-flex-remove')!.onclick = () => {
    if (!flexSelectedElementId) return;
    api.removeFlexTree(flexSelectedElementId);
  };
}

function applyPreset(preset: 'thin' | 'standard' | 'thick'): void {
  const vals = {
    thin: { step: '2.5', link: '2.0', dash: '20.0' },
    standard: { step: '3.5', link: '3.0', dash: '25.0' },
    thick: { step: '4.5', link: '4.0', dash: '30.0' },
  };
  const p = vals[preset];
  (document.getElementById('inp-flex-step') as HTMLInputElement).value = p.step;
  (document.getElementById('inp-flex-link') as HTMLInputElement).value = p.link;
  (document.getElementById('inp-flex-dash') as HTMLInputElement).value = p.dash;
  document
    .querySelectorAll('.preset-btn')
    .forEach((b) => b.classList.remove('preset-active'));
  const btn = document.getElementById(`btn-preset-${preset}`);
  if (btn) btn.classList.add('preset-active');
  if (flexSelectedElementId)
    api.applyFlexTreePreset(flexSelectedElementId, preset);
}

// ─── Helpers ─────────────────────────────────────────────

function toggleButton(
  id: string,
  initial: boolean,
  onChange: (value: boolean) => void,
): void {
  const btn = document.getElementById(id)!;
  let state = initial;
  if (state) btn.classList.add('on');
  btn.addEventListener('click', () => {
    state = !state;
    state ? btn.classList.add('on') : btn.classList.remove('on');
    onChange(state);
  });
}

// ─── Laser Panel ───────────────────────────────────────────

function setupLaserPanel(): void {
  const $ = (id: string): HTMLElement => document.getElementById(id)!;
  const focal = $('laser-lens-focal') as HTMLSelectElement;
  const lensDia = $('laser-lens-dia') as HTMLInputElement;
  const beamDia = $('laser-beam-dia') as HTMLInputElement;
  const height = $('laser-height') as HTMLInputElement;
  const engColor = $('laser-engrave-color') as HTMLInputElement;
  const cutColor = $('laser-cut-color') as HTMLInputElement;
  const spotEl = $('laser-spot');
  const dpiEl = $('laser-dpi');

  const refreshReadout = (): void => {
    const s = api.getLaserSettings();
    spotEl.textContent = s.spotSizeMm.toFixed(3);
    dpiEl.textContent = String(s.recommendedDpi);
  };

  focal.onchange = () => {
    api.setLaserLensFocal(parseFloat(focal.value));
  };
  lensDia.onchange = () => api.setLaserLensDiameter(parseFloat(lensDia.value));
  beamDia.onchange = () => api.setLaserBeamDiameter(parseFloat(beamDia.value));
  height.onchange = () => api.setLaserMaterialHeight(parseFloat(height.value));
  engColor.onchange = () => api.setLaserEngraveColor(engColor.value);
  cutColor.onchange = () => api.setLaserCutColor(cutColor.value);
  ($('laser-hide-nonlaser') as HTMLInputElement).onchange = (e) =>
    api.setNonLaserElementsVisible(!(e.target as HTMLInputElement).checked);
  ($('laser-translucent') as HTMLInputElement).onchange = (e) =>
    api.setLaserElementsTranslucent((e.target as HTMLInputElement).checked);

  $('laser-create').onclick = () => {
    const name = ($('laser-group-name') as HTMLInputElement).value || 'Laser';
    api.createLaserGroup({ name });
    renderLaserGroups();
  };

  api.on('LASER_SETTINGS_CHANGED', refreshReadout);
  api.on('LASER_GROUP_CREATED', renderLaserGroups);
  api.on('LASER_GROUP_DELETED', renderLaserGroups);
  api.on('LASER_GROUP_UPDATED', renderLaserGroups);
  api.on('LASER_GROUP_ELEMENT_ADDED', renderLaserGroups);
  api.on('LASER_GROUP_ELEMENT_REMOVED', renderLaserGroups);
  api.on('LASER_COLOR_GRADING_CHANGED', renderLaserGroups);

  refreshReadout();
  renderLaserGroups();
}

function renderLaserGroups(): void {
  const list = document.getElementById('laser-group-list');
  if (!list) return;
  const grading = api.getLaserColorGrading();
  const groups = api.getLaserGroups();
  list.innerHTML = '';

  for (const g of groups) {
    const item = document.createElement('div');
    item.className = 'laser-group-item';
    const color = grading[g.id] ?? '#888';
    item.innerHTML = `
      <div class="lg-head">
        <span class="lg-swatch" style="background:${color}"></span>
        <b>${g.name}</b>
        <span style="color:var(--text-muted)">(${g.elementIds.length})</span>
      </div>
      <div class="lg-row">
        <label>Тип
          <select data-f="type">
            <option value="cut"${g.type === 'cut' ? ' selected' : ''}>Резка</option>
            <option value="engrave"${g.type === 'engrave' ? ' selected' : ''}>Гравировка</option>
            <option value="cut_engrave"${g.type === 'cut_engrave' ? ' selected' : ''}>Резка+грав.</option>
          </select>
        </label>
      </div>
      <div class="lg-row">
        <label>V рез <input type="number" data-f="cutSpeed" value="${g.cutSpeed}" /></label>
        <label>P рез <input type="number" data-f="cutPower" value="${g.cutPower}" /></label>
      </div>
      <div class="lg-row">
        <label>V грав <input type="number" data-f="engraveSpeed" value="${g.engraveSpeed}" /></label>
        <label>P грав <input type="number" data-f="engravePower" value="${g.engravePower}" /></label>
      </div>
      <div class="lg-row">
        <label>DPI <input type="number" data-f="engraveDpi" value="${g.engraveDpi}" /></label>
      </div>
      <div class="lg-flags">
        <label><input type="checkbox" data-f="selectable"${g.selectable ? ' checked' : ''}/> Выбор</label>
        <label><input type="checkbox" data-f="movable"${g.movable ? ' checked' : ''}/> Движ.</label>
        <label><input type="checkbox" data-f="visible"${g.visible ? ' checked' : ''}/> Видно</label>
      </div>
      <div class="lg-row" style="margin-top:4px">
        <button data-a="add">+ Выбр.</button>
        <button data-a="rem">− Выбр.</button>
        <button data-a="del">Удалить</button>
      </div>
    `;

    item.querySelectorAll('[data-f]').forEach((el) => {
      el.addEventListener('change', () => {
        const f = (el as HTMLElement).dataset.f!;
        const input = el as HTMLInputElement | HTMLSelectElement;
        let value: unknown;
        if (input instanceof HTMLInputElement && input.type === 'checkbox') {
          value = input.checked;
        } else if (
          input instanceof HTMLInputElement &&
          input.type === 'number'
        ) {
          value = parseFloat(input.value);
        } else {
          value = input.value;
        }
        api.updateLaserGroup(g.id, { [f]: value } as never);
      });
    });

    const sel = (): string[] => api.getSelected().map((e) => e.id);
    (item.querySelector('[data-a="add"]') as HTMLButtonElement).onclick =
      () => {
        api.laserGroupAddElements(g.id, sel());
      };
    (item.querySelector('[data-a="rem"]') as HTMLButtonElement).onclick =
      () => {
        api.laserGroupRemoveElements(g.id, sel());
      };
    (item.querySelector('[data-a="del"]') as HTMLButtonElement).onclick =
      () => {
        api.deleteLaserGroup(g.id);
      };

    list.appendChild(item);
  }
}

// ─── Boot ────────────────────────────────────────────────
function makeDraggable(panel: HTMLElement, handle: HTMLElement): void {
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  handle.addEventListener('mousedown', (e) => {
    if (e.target instanceof HTMLButtonElement) return;
    dragging = true;
    const rect = panel.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    panel.style.right = 'auto';
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const x = Math.max(
      0,
      Math.min(window.innerWidth - panel.offsetWidth, e.clientX - offsetX),
    );
    const y = Math.max(
      0,
      Math.min(window.innerHeight - panel.offsetHeight, e.clientY - offsetY),
    );
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
  });

  window.addEventListener('mouseup', () => {
    dragging = false;
  });
}

document.addEventListener('DOMContentLoaded', init);
