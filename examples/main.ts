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
  document.addEventListener('keydown', (e) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;

    const meta = e.metaKey || e.ctrlKey;

    // ── Инструменты измерения ──
    if (api.getMeasureTool()) {
      if (e.key === 'Escape') {
        e.preventDefault();
        api.cancelMeasure();
        api.deactivateMeasureTool();
        return;
      }
    }

    // ── Режим редактирования узлов (клавиатура — на стороне приложения) ──
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

// ─── Boot ────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
