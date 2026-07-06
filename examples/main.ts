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
  setupKeyboardShortcuts();
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
  pauseChk.onchange = () => { logPaused = pauseChk.checked; };
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

  const snapAxis = document.getElementById('sel-snap-axis') as HTMLSelectElement;
  snapAxis.onchange = () => { api.setSnapAxis(snapAxis.value as 'both' | 'horizontal' | 'vertical'); };

  document.getElementById('btn-transform-resize')!.onclick = () => api.setTransformMode('resize');
  document.getElementById('btn-transform-rotate')!.onclick = () => api.setTransformMode('rotate');
  toggleButton('btn-proportional-resize', false, (v) => api.setProportionalResize(v));

  toggleButton('btn-pan-mode', false, (v) => api.setPanMode(v));
  toggleButton('btn-toggle-rulers', false, (v) => api.setRulersVisible(v));
  toggleButton('btn-toggle-grid', false, (v) => v ? api.showGrid() : api.hideGrid());

  const gridStep = document.getElementById('input-grid-step') as HTMLInputElement;
  gridStep.onchange = () => api.setGridStep(Number(gridStep.value));

  let booleanActive = false;
  document.getElementById('btn-bool-union')!.onclick = () => { api.enterBooleanMode('UNION'); setBooleanActive(true); };
  document.getElementById('btn-bool-intersect')!.onclick = () => { api.enterBooleanMode('INTERSECT'); setBooleanActive(true); };
  document.getElementById('btn-bool-diff')!.onclick = () => { api.enterBooleanMode('DIFFERENCE'); setBooleanActive(true); };
  document.getElementById('btn-bool-exit')!.onclick = () => { api.exitBooleanMode(); setBooleanActive(false); };

  function setBooleanActive(v: boolean): void {
    booleanActive = v;
    ['btn-bool-union', 'btn-bool-intersect', 'btn-bool-diff'].forEach((id) => {
      document.getElementById(id)!.style.display = v ? 'none' : '';
    });
    document.getElementById('btn-bool-exit')!.style.display = v ? '' : 'none';
  }

  toggleButton('btn-debug-hitarea', false, (v) => { api.debugShowHitArea = v; });

  document.getElementById('btn-preloader')!.onclick = () => {
    if (api.isPreloaderVisible()) { api.hidePreloader(); } else { api.showPreloader(); }
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
  document.getElementById('btn-gesture-click')!.onclick = function () { setGesture('click', this); };
  document.getElementById('btn-gesture-rect')!.onclick = function () { setGesture('rect', this); };
  document.getElementById('btn-gesture-lasso')!.onclick = function () { setGesture('lasso', this); };

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

    const fill = (document.getElementById('input-fill') as HTMLInputElement).value;
    const stroke = (document.getElementById('input-stroke') as HTMLInputElement).value;
    const strokeWidth = Number((document.getElementById('input-stroke-width') as HTMLInputElement).value);

    api.updateShapes({
      elementIds: selected.map((e) => e.id),
      style: { fill, stroke, strokeWidth: isNaN(strokeWidth) ? undefined : strokeWidth },
    });
  };
}

// ─── Right Panel: Groups ─────────────────────────────────

function setupRightPanel(): void {
  const list = document.getElementById('group-list')!;
  const nameInput = document.getElementById('input-group-name') as HTMLInputElement;
  let selectedGroupId: string | null = null;

  function renderGroups(): void {
    const groups = api.getGroups();
    list.innerHTML = '';

    for (const g of groups) {
      const li = document.createElement('li');
      li.innerHTML = `<span>${g.name}</span><span class="group-count">${g.elementIds?.size ?? 0} elem</span>`;
      if (g.id === selectedGroupId) li.classList.add('selected');

      li.onclick = () => { selectedGroupId = g.id; api.selectGroup(g.id); renderGroups(); };
      li.ondblclick = () => { api.selectGroupElements(g.id); };
      list.appendChild(li);
    }

    if (groups.length === 0) {
      list.innerHTML = '<li style="color:var(--text-muted);cursor:default">No groups</li>';
    }
  }

  api.onGroupsChange = () => renderGroups();

  document.getElementById('btn-group-create')!.onclick = () => {
    api.groupCreate({ name: nameInput.value.trim() || 'New Group' });
    renderGroups();
  };

  document.getElementById('btn-group-delete')!.onclick = () => {
    if (selectedGroupId) { api.groupDelete({ groupId: selectedGroupId }); selectedGroupId = null; renderGroups(); }
  };

  document.getElementById('btn-group-add-elem')!.onclick = () => {
    if (!selectedGroupId) return;
    const selected = api.getSelected();
    if (selected.length > 0) { api.groupAddElements({ groupId: selectedGroupId, elementIds: selected.map((e) => e.id) }); }
  };

  document.getElementById('btn-group-rem-elem')!.onclick = () => {
    if (!selectedGroupId) return;
    const selected = api.getSelected();
    if (selected.length > 0) { api.groupRemoveElements({ groupId: selectedGroupId, elementIds: selected.map((e) => e.id) }); }
  };

  renderGroups();
}

// ─── Keyboard Shortcuts ──────────────────────────────────

function setupKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;

    const meta = e.metaKey || e.ctrlKey;

    if (meta && e.key === 'z' && !e.shiftKey) { e.preventDefault(); api.undo(); return; }
    if (meta && e.key === 'z' && e.shiftKey) { e.preventDefault(); api.redo(); return; }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      const selected = api.getSelected();
      if (selected.length > 0) { api.deleteShapes({ elementIds: selected.map((el) => el.id) }); }
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

// ─── Helpers ─────────────────────────────────────────────

function toggleButton(id: string, initial: boolean, onChange: (value: boolean) => void): void {
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
