import { SvgCanvas, ExternalApi, svgNodesToElements } from '@/index';
import type { BusEvent, GroupData, SvgNodeDto, CreateShapeDTO } from '@/index';
import type { DitherAlgorithm } from '@/index';
import svgNodes from './svg-nodes.json';
import groupsData from './groups.json';

let api: ExternalApi;

// ─── Initialization ──────────────────────────────────────

function init(): void {
  const container = document.getElementById('canvas-container')!;
  const canvas = new SvgCanvas(container, { width: 800, height: 600 });
  api = canvas.api;
  api.canvas.setArtboardSize(210, 297);
  api.canvas.setArtboardCenter(40);

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
  setupArtboardSize();
  setupRasterModal();
  setupMaskPanel();
  setupZOrderButtons();
}

const GOOGLE_FONTS_KEY = 'AIzaSyBtoXXgjyOUNazwWDWAenfPkoRN7U8VlUs';

function setupTextPanel(): void {
  const fontSel = document.getElementById('txt-font') as HTMLSelectElement;
  const weightSel = document.getElementById('txt-weight') as HTMLSelectElement;
  const sizeInp = document.getElementById('txt-size') as HTMLInputElement;
  const lineHInp = document.getElementById('txt-line-height') as HTMLInputElement;
  const colorInp = document.getElementById('txt-color') as HTMLInputElement;

  const fillWeights = (family: string): void => {
    const meta = api.textEdit.getFontVariants(family);
    weightSel.innerHTML = '';
    const weights = meta?.weights ?? ['400', '700'];
    for (const w of weights) {
      const o = document.createElement('option');
      o.value = w;
      o.textContent = w;
      weightSel.appendChild(o);
    }
  };

  api.textEdit
    .initTextFonts(GOOGLE_FONTS_KEY)
    .then(() => {
      const fonts = api.textEdit.searchFonts('').slice(0, 100);
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
    api.textEdit.setTextFontFamily(fontSel.value);
    sizeInp.value = '4000';
  };
  weightSel.onchange = () => api.textEdit.setTextWeight(weightSel.value);
  sizeInp.onchange = () => api.textEdit.setTextFontSize(parseFloat(sizeInp.value));
  lineHInp.onchange = () => api.textEdit.setTextLineHeight(parseFloat(lineHInp.value));
  colorInp.onchange = () => api.textEdit.setTextColor(colorInp.value);
  document.getElementById('txt-italic')!.onclick = () =>
    api.textEdit.setTextItalic(toggleBtn('txt-italic'));
  document.getElementById('txt-underline')!.onclick = () =>
    api.textEdit.setTextUnderline(toggleBtn('txt-underline'));
  document.getElementById('txt-strike')!.onclick = () =>
    api.textEdit.setTextStrike(toggleBtn('txt-strike'));
  document.getElementById('txt-align-left')!.onclick = () =>
    api.textEdit.setTextAlign('left');
  document.getElementById('txt-align-center')!.onclick = () =>
    api.textEdit.setTextAlign('center');
  document.getElementById('txt-align-right')!.onclick = () =>
    api.textEdit.setTextAlign('right');

  // Кнопка «🔤 Текст» — инструмент создания
  document.getElementById('btn-creation-text')!.onclick = () => {
    api.canvas.setActiveCreationTool('text');
  };
}

// ─── Artboard Size ──────────────────────────────────────

function setupArtboardSize(): void {
  const inpW = document.getElementById('inp-artboard-w') as HTMLInputElement;
  const inpH = document.getElementById('inp-artboard-h') as HTMLInputElement;
  const btn = document.getElementById('btn-apply-artboard')!;

  const apply = (): void => {
    const w = parseFloat(inpW.value);
    const h = parseFloat(inpH.value);
    if (w > 0 && h > 0) {
      api.canvas.setArtboardSize(w, h);
    }
  };

  btn.onclick = apply;
  inpW.addEventListener('keydown', (e) => e.key === 'Enter' && apply());
  inpH.addEventListener('keydown', (e) => e.key === 'Enter' && apply());
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
    api.shapes.addShape(el);
  }

  api.data.loadGroups(groupsData as Record<string, unknown>[]);

  for (const el of elements) {
    if (el.groupId) {
      api.groups.groupAddElements({ groupId: el.groupId, elementIds: [el.id] });
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
  toggleButton('btn-snap-corners', false, (v) => api.snap.setSnapToCorners(v));
  toggleButton('btn-snap-planes', false, (v) => api.snap.setSnapToPlanes(v));
  toggleButton('btn-snap-artboard', false, (v) => api.snap.setSnapToArtboard(v));
  toggleButton('btn-snap-guidelines', false, (v) => api.snap.setSnapToGuidelines(v));
  toggleButton('btn-snap-grid', false, (v) => api.snap.setSnapToGrid(v));
  toggleButton('btn-snap-elements', true, (v) => api.snap.setSnapToElements(v));
  toggleButton('btn-avoid-collisions', false, (v) => api.snap.setAvoidCollisions(v));
  toggleButton('btn-lock-drag-axis', false, (v) => api.snap.setLockDragAxis(v));

  api.on('SNAP_CORNERS_CHANGED', (ev: BusEvent) => {
    updateButtonState('btn-snap-corners', ev.data.enabled);
  });
  api.on('SNAP_PLANES_CHANGED', (ev: BusEvent) => {
    updateButtonState('btn-snap-planes', ev.data.enabled);
  });

  const snapAxis = document.getElementById(
    'sel-snap-axis',
  ) as HTMLSelectElement;
  snapAxis.onchange = () => {
    api.snap.setSnapAxis(snapAxis.value as 'both' | 'horizontal' | 'vertical');
  };

  document.getElementById('btn-transform-resize')!.onclick = () =>
    api.selection.setTransformMode('resize');
  document.getElementById('btn-transform-rotate')!.onclick = () =>
    api.selection.setTransformMode('rotate');
  toggleButton('btn-proportional-resize', false, (v) =>
    api.selection.setProportionalResize(v),
  );
  toggleButton('btn-snap-rotation', false, (v) => api.selection.setSnapRotation(v));

  document.getElementById('btn-flex-tree')!.onclick = () => {
    const panel = document.getElementById('flex-tree-panel')!;
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    if (panel.style.display === 'block') syncFlexPanelFromSelection();
  };

  toggleButton('btn-pan-mode', false, (v) => api.canvas.setPanMode(v));
  toggleButton('btn-toggle-rulers', false, (v) => api.canvas.setRulersVisible(v));
  toggleButton('btn-flip-ruler-y', false, (v) => api.canvas.setRulerFlipY(v));
  toggleButton('btn-toggle-grid', false, (v) =>
    v ? api.canvas.showGrid() : api.canvas.hideGrid(),
  );

  const gridStep = document.getElementById(
    'input-grid-step',
  ) as HTMLInputElement;
  gridStep.onchange = () => api.canvas.setGridStep(Number(gridStep.value));

  let booleanActive = false;
  document.getElementById('btn-bool-union')!.onclick = () => {
    api.shapes.enterBooleanMode('UNION');
    setBooleanActive(true);
  };
  document.getElementById('btn-bool-intersect')!.onclick = () => {
    api.shapes.enterBooleanMode('INTERSECT');
    setBooleanActive(true);
  };
  document.getElementById('btn-bool-diff')!.onclick = () => {
    api.shapes.enterBooleanMode('DIFFERENCE');
    setBooleanActive(true);
  };
  document.getElementById('btn-bool-exit')!.onclick = () => {
    api.shapes.exitBooleanMode();
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
    api.canvas.debugShowHitArea = v;
  });

  document.getElementById('btn-preloader')!.onclick = () => {
    if (api.canvas.isPreloaderVisible()) {
      api.canvas.hidePreloader();
    } else {
      api.canvas.showPreloader();
    }
  };
}

// ─── Left Toolbar ────────────────────────────────────────

let currentCreationType: string | null = null;

function setupLeftToolbar(): void {
  const btnElem = document.getElementById('btn-sel-element')!;
  const btnGroup = document.getElementById('btn-sel-group')!;

  btnElem.onclick = () => {
    api.selection.setSelectionMode('element');
    btnElem.classList.add('active');
    btnGroup.classList.remove('active');
  };
  btnGroup.onclick = () => {
    api.selection.setSelectionMode('group');
    btnGroup.classList.add('active');
    btnElem.classList.remove('active');
  };

  const gestureBtns = document.querySelectorAll('.gesture-btn');
  const setGesture = (gesture: string, activeBtn: Element) => {
    api.selection.setSelectionGesture(gesture as any);
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
      api.canvas.setActiveCreationTool(type as any);
      creationTools.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      cancelBtn.style.display = '';
    });
  });

  cancelBtn.onclick = () => {
    currentCreationType = null;
    api.canvas.setActiveCreationTool(null);
    creationTools.forEach((b) => b.classList.remove('active'));
    cancelBtn.style.display = 'none';
  };

  document.getElementById('btn-undo')!.onclick = () => api.history.undo();
  document.getElementById('btn-redo')!.onclick = () => api.history.redo();

  document.getElementById('btn-delete')!.onclick = () => {
    const selected = api.selection.getSelected();
    if (selected.length > 0) {
      api.shapes.deleteShapes({ elementIds: selected.map((e) => e.id) });
    }
  };

  document.getElementById('btn-outline')!.onclick = () => {
    const selected = api.selection.getSelected();
    if (selected.length > 0) {
      api.shapes.outlineElement(selected[0].id);
    }
  };

  document.getElementById('btn-sel-all')!.onclick = () => {
    const all = api.shapes.getAllShapes();
    api.selection.selectShapes({ elementIds: all.map((e) => e.id) });
  };
  document.getElementById('btn-sel-none')!.onclick = () => api.selection.clearSelection();

  // ── Copy / Use ──
  document.getElementById('btn-dup-selected')!.onclick = () => {
    api.clipboard.duplicateSelected(30, 30);
  };
  document.getElementById('btn-use-dup')!.onclick = () => {
    api.clipboard.useDuplicateSelected(30, 30);
  };
  document.getElementById('btn-unbind-use')!.onclick = () => {
    const selected = api.selection.getSelected();
    for (const el of selected) {
      if (api.clipboard.isUseElement(el.id)) {
        api.clipboard.unbindUseElement(el.id);
      }
    }
  };
  document.getElementById('btn-unbind-all')!.onclick = () => {
    const selected = api.selection.getSelected();
    for (const el of selected) {
      const useIds = api.clipboard.getUseChildIds(el.id);
      if (useIds.length > 0) {
        api.clipboard.unbindAllUseReferences(el.id);
        break;
      }
    }
  };
  document.getElementById('sel-use-opacity')!.onchange = (e) => {
    const opacity = parseFloat((e.target as HTMLSelectElement).value) as
      | 0
      | 0.25
      | 1;
    const selected = api.selection.getSelected();
    for (const el of selected) {
      if (api.clipboard.isUseElement(el.id)) {
        api.clipboard.setUseOpacity(el.id, opacity);
      }
    }
  };

  document.getElementById('btn-apply-style')!.onclick = () => {
    const selected = api.selection.getSelected();
    if (selected.length === 0) return;

    const fill = (document.getElementById('input-fill') as HTMLInputElement)
      .value;
    const stroke = (document.getElementById('input-stroke') as HTMLInputElement)
      .value;
    const strokeWidth = Number(
      (document.getElementById('input-stroke-width') as HTMLInputElement).value,
    );

    api.shapes.updateShapes({
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
    const groups = api.groups.getGroups();
    list.innerHTML = '';

    for (const g of groups) {
      const li = document.createElement('li');
      li.innerHTML = `<span>${g.name}</span><span class="group-count">${g.elementIds?.size ?? 0} elem</span>`;
      if (g.id === selectedGroupId) li.classList.add('selected');

      li.onclick = () => {
        selectedGroupId = g.id;
        api.groups.selectGroup(g.id);
        renderGroups();
      };
      li.ondblclick = () => {
        api.groups.selectGroupElements(g.id);
      };
      list.appendChild(li);
    }

    if (groups.length === 0) {
      list.innerHTML =
        '<li style="color:var(--text-muted);cursor:default">No groups</li>';
    }
  }

  api.groups.onGroupsChange = () => renderGroups();

  document.getElementById('btn-group-create')!.onclick = () => {
    api.groups.groupCreate({ name: nameInput.value.trim() || 'New Group' });
    renderGroups();
  };

  document.getElementById('btn-group-delete')!.onclick = () => {
    if (selectedGroupId) {
      api.groups.groupDelete({ groupId: selectedGroupId });
      selectedGroupId = null;
      renderGroups();
    }
  };

  document.getElementById('btn-group-add-elem')!.onclick = () => {
    if (!selectedGroupId) return;
    const selected = api.selection.getSelected();
    if (selected.length > 0) {
      api.groups.groupAddElements({
        groupId: selectedGroupId,
        elementIds: selected.map((e) => e.id),
      });
    }
  };

  document.getElementById('btn-group-rem-elem')!.onclick = () => {
    if (!selectedGroupId) return;
    const selected = api.selection.getSelected();
    if (selected.length > 0) {
      api.groups.groupRemoveElements({
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
      !api.textEdit.isTextEditing() &&
      !api.nodeEdit.isNodeEditing &&
      !api.measure.getMeasureTool()
    ) {
      e.preventDefault();
      api.canvas.setPanHeld(true);
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
      api.canvas.setPanHeld(false);
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

    // ── Инструменты измерения ──
    if (api.measure.getMeasureTool()) {
      if (e.key === 'Escape') {
        e.preventDefault();
        api.measure.cancelMeasure();
        api.measure.deactivateMeasureTool();
        return;
      }
    }

    // ── Режим редактирования узлов ──
    if (api.nodeEdit.isNodeEditing) {
      if (meta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        api.nodeEdit.undoNodeEdit();
        return;
      }
      if (meta && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        api.nodeEdit.redoNodeEdit();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        api.nodeEdit.exitNodeEdit();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        api.nodeEdit.deleteSelectedNodes();
        return;
      }
      if (meta && e.key === 'a') {
        e.preventDefault();
        api.nodeEdit.selectAllNodes();
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        api.nodeEdit.nudgeSelectedNodes(-step, 0);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        api.nodeEdit.nudgeSelectedNodes(step, 0);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        api.nodeEdit.nudgeSelectedNodes(0, -step);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        api.nodeEdit.nudgeSelectedNodes(0, step);
        return;
      }
      return;
    }

    // ── Обычный режим ──
    if (meta && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      api.history.undo();
      return;
    }
    if (meta && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      api.history.redo();
      return;
    }
    if (meta && e.key === 'd' && !e.shiftKey) {
      e.preventDefault();
      api.clipboard.duplicateSelected(30, 30);
      return;
    }
    if (meta && e.key === 'd' && e.shiftKey) {
      e.preventDefault();
      api.clipboard.useDuplicateSelected(30, 30);
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const selected = api.selection.getSelected();
      if (selected.length > 0) {
        api.shapes.deleteShapes({ elementIds: selected.map((el) => el.id) });
      }
      return;
    }
    if (meta && e.key === 'a') {
      e.preventDefault();
      const all = api.shapes.getAllShapes();
      api.selection.selectShapes({ elementIds: all.map((el) => el.id) });
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
  const connectSection = document.getElementById('node-connect-section') as HTMLElement;
  const segSection = document.getElementById('node-segment-section') as HTMLElement;
  const segInfo = document.getElementById('node-seg-info') as HTMLElement;
  const closedChk = document.getElementById('chk-node-closed') as HTMLInputElement;

  const show = (visible: boolean): void => {
    panel.style.display = visible ? 'block' : 'none';
  };

  api.on('NODE_EDIT_ENTERED', () => {
    show(true);
    segSection.style.display = 'none';
    connectSection.style.display = 'none';
    const ids = api.nodeEdit.session.getTargetIds();
    if (ids.length > 0) {
      closedChk.checked = api.nodeEdit.isPathClosed(ids[0], 0);
    }
  });
  api.on('NODE_EDIT_EXITED', () => {
    show(false);
    multiBtn.textContent = 'Мультивыбор: off';
    multiBtn.classList.remove('active');
  });
  api.on('NODE_SELECTION_CHANGED', (ev) => {
    const count = (ev.data as { count?: number })?.count ?? 0;
    countEl.textContent = `Выбрано: ${count}`;
    connectSection.style.display = count === 2 ? '' : 'none';
    if (count === 0) segSection.style.display = 'none';
  });

  let _segContourIdx = 0;
  let _segSegIdx = 0;

  api.on('SEGMENT_SELECTED', (ev) => {
    const d = ev.data as { elementId?: string; contourIdx?: number; segIdx?: number };
    _segContourIdx = d.contourIdx ?? 0;
    _segSegIdx = d.segIdx ?? 0;
    segInfo.textContent = `Контур ${d.contourIdx ?? '?'}, сегмент ${d.segIdx ?? '?'}`;
    segSection.style.display = '';
  });

  api.on('SEGMENT_DELETED', () => {
    segSection.style.display = 'none';
  });

  api.on('NODES_CONNECTED', () => {
    connectSection.style.display = 'none';
    segSection.style.display = 'none';
  });

  api.on('PATH_CLOSED_CHANGED', (ev) => {
    const d = ev.data as { closed?: boolean };
    closedChk.checked = d.closed ?? false;
  });

  const click = (id: string, fn: () => void): void => {
    const el = document.getElementById(id);
    if (el) (el as HTMLButtonElement).onclick = fn;
  };

  multiBtn.onclick = () => {
    const on = !api.nodeEdit.getNodeMultiSelect();
    api.nodeEdit.setNodeMultiSelect(on);
    multiBtn.textContent = `Мультивыбор: ${on ? 'on' : 'off'}`;
    multiBtn.classList.toggle('active', on);
  };

  click('btn-node-exit', () => api.nodeEdit.exitNodeEdit());
  click('btn-node-selall', () => api.nodeEdit.selectAllNodes());
  click('btn-node-selnone', () => api.nodeEdit.clearNodeSelection());
  click('btn-node-selinv', () => api.nodeEdit.invertNodeSelection());
  click('btn-node-corner', () => api.nodeEdit.setSelectedNodesType('corner'));
  click('btn-node-smooth', () => api.nodeEdit.setSelectedNodesType('smooth'));
  click('btn-node-symmetric', () => api.nodeEdit.setSelectedNodesType('symmetric'));
  click('btn-node-smooth-op', () => api.nodeEdit.smoothSelectedNodes());
  click('btn-node-sharpen-op', () => api.nodeEdit.sharpenSelectedNodes());
  click('btn-node-distribute', () => api.nodeEdit.distributeSelectedNodesEvenly());
  click('btn-node-delete', () => api.nodeEdit.deleteSelectedNodes());
  click('btn-node-undo', () => api.nodeEdit.undoNodeEdit());
  click('btn-node-redo', () => api.nodeEdit.redoNodeEdit());

  click('btn-node-connect', () => {
    const refs = api.nodeEdit.getSelectedNodeRefs();
    if (refs.length === 2) {
      api.nodeEdit.connectNodes(refs[0].elementId, refs[0].nodeId, refs[1].nodeId);
    }
  });

  click('btn-node-seg-delete', () => {
    const ids = api.nodeEdit.session.getTargetIds();
    if (ids.length === 0) return;
    api.nodeEdit.deleteSegment(ids[0], _segContourIdx, _segSegIdx);
  });

  const extendBtn = document.getElementById('btn-node-extend') as HTMLButtonElement;
  click('btn-node-extend', () => {
    if (api.nodeEdit.isExtendingPath) {
      api.nodeEdit.extendPathStop();
      extendBtn.textContent = 'Дорисовать';
      extendBtn.classList.remove('active');
    } else {
      api.nodeEdit.extendPathStart();
      extendBtn.textContent = 'Стоп';
      extendBtn.classList.add('active');
    }
  });

  click('btn-node-split', () => {
    api.nodeEdit.splitPath();
  });

  closedChk.onchange = () => {
    const ids = api.nodeEdit.session.getTargetIds();
    if (ids.length === 0) return;
    api.nodeEdit.closePath(ids[0], 0, closedChk.checked);
  };

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
    api.measure.activateRuler();
  };
  angleBtn.onclick = () => {
    clearActive();
    angleBtn.classList.add('active');
    api.measure.activateProtractor('points');
  };
  angleObjBtn.onclick = () => {
    clearActive();
    angleObjBtn.classList.add('active');
    api.measure.activateProtractor('objects');
  };
  document.getElementById('btn-measure-clear')!.onclick = () =>
    api.measure.clearMeasurements();
  exitBtn.onclick = () => api.measure.deactivateMeasureTool();
}

// ─── Size Inputs ───────────────────────────────────────────

function setupSizeInputs(): void {
  const inpX = document.getElementById('inp-pos-x') as HTMLInputElement;
  const inpY = document.getElementById('inp-pos-y') as HTMLInputElement;
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
      xMm: number;
      yMm: number;
      widthMm: number;
      heightMm: number;
      angleDeg: number;
    };
    if (!data.id) {
      inpX.disabled = true;
      inpY.disabled = true;
      inpW.disabled = true;
      inpH.disabled = true;
      inpX.value = '';
      inpY.value = '';
      inpW.value = '';
      inpH.value = '';
      currentId = null;
      return;
    }
    currentId = data.id;
    currentAngle = data.angleDeg;

    inpX.value = data.xMm.toFixed(1);
    inpX.disabled = false;
    inpY.value = data.yMm.toFixed(1);
    inpY.disabled = false;

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
        if (Math.abs(delta) > 0.001) api.shapes.rotateElement(currentId, delta);
      }
    } else {
      const x = parseFloat(inpX.value);
      const y = parseFloat(inpY.value);
      if (!isNaN(x) || !isNaN(y)) {
        api.shapes.setElementPosition(currentId, x, y);
      }
      const w = parseFloat(inpW.value);
      const h = parseFloat(inpH.value);
      if (w > 0 && h > 0) api.shapes.resizeElement(currentId, w, h);
    }
  };

  inpX.addEventListener('change', apply);
  inpY.addEventListener('change', apply);
  inpX.addEventListener('keydown', (e) => e.key === 'Enter' && apply());
  inpY.addEventListener('keydown', (e) => e.key === 'Enter' && apply());
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
  const selected = api.selection.getSelected();
  if (selected.length === 1) {
    flexSelectedElementId = selected[0].id;
  }
  if (!flexSelectedElementId) return;

  const cfg = api.flexTree.getFlexTreeConfig(flexSelectedElementId);
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
    api.flexTree.setFlexTreeAlgorithm(flexSelectedElementId, algo as never);
    api.flexTree.setFlexTreeParams(flexSelectedElementId, {
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
    api.flexTree.removeFlexTree(flexSelectedElementId);
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
    api.flexTree.applyFlexTreePreset(flexSelectedElementId, preset);
}

// ─── Z-Order Buttons ──────────────────────────────────────

function setupZOrderButtons(): void {
  const getIds = (): string[] =>
    api.selection.getSelected().map((e) => e.id);

  document.getElementById('btn-z-raise')!.onclick = () => {
    const ids = getIds();
    if (ids.length) api.zOrder.raise(ids);
  };
  document.getElementById('btn-z-lower')!.onclick = () => {
    const ids = getIds();
    if (ids.length) api.zOrder.lower(ids);
  };
  document.getElementById('btn-z-top')!.onclick = () => {
    const ids = getIds();
    if (ids.length) api.zOrder.raiseToTop(ids);
  };
  document.getElementById('btn-z-bottom')!.onclick = () => {
    const ids = getIds();
    if (ids.length) api.zOrder.lowerToBottom(ids);
  };
  document.getElementById('btn-bake')!.onclick = () => {
    const ids = getIds();
    if (ids.length) api.bake.bake(ids);
  };
  document.getElementById('btn-merge')!.onclick = () => {
    const ids = getIds();
    if (ids.length) api.merge.merge(ids);
  };
  document.getElementById('btn-text-to-path')!.onclick = () => {
    api.textToPath.convertSelected();
  };
  document.getElementById('btn-path-detail')!.onclick = () => {
    const ids = getIds();
    for (const id of ids) {
      const el = api.shapes.getElementById(id);
      if (el?.type === 'path') {
        const simple = (el as { isSimpleHitArea?: boolean }).isSimpleHitArea ?? true;
        api.shapes.setSimpleHitArea(id, !simple);
      }
    }
  };
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

function updateButtonState(id: string, enabled: boolean): void {
  const btn = document.getElementById(id);
  if (!btn) return;
  if (enabled) btn.classList.add('on');
  else btn.classList.remove('on');
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
    const s = api.laser.getLaserSettings();
    spotEl.textContent = s.spotSizeMm.toFixed(3);
    dpiEl.textContent = String(s.recommendedDpi);
  };

  focal.onchange = () => {
    api.laser.setLaserLensFocal(parseFloat(focal.value));
  };
  lensDia.onchange = () => api.laser.setLaserLensDiameter(parseFloat(lensDia.value));
  beamDia.onchange = () => api.laser.setLaserBeamDiameter(parseFloat(beamDia.value));
  height.onchange = () => api.laser.setLaserMaterialHeight(parseFloat(height.value));
  engColor.onchange = () => api.laser.setLaserEngraveColor(engColor.value);
  cutColor.onchange = () => api.laser.setLaserCutColor(cutColor.value);
  ($('laser-hide-nonlaser') as HTMLInputElement).onchange = (e) =>
    api.laser.setNonLaserElementsVisible(!(e.target as HTMLInputElement).checked);
  ($('laser-translucent') as HTMLInputElement).onchange = (e) =>
    api.laser.setLaserElementsTranslucent((e.target as HTMLInputElement).checked);

  $('laser-create').onclick = () => {
    const name = ($('laser-group-name') as HTMLInputElement).value || 'Laser';
    api.laser.createLaserGroup({ name });
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

  const btnCutParams = $('btn-cut-params-mode') as HTMLButtonElement;
  const cpControls = $('laser-cut-params-controls') as HTMLElement;
  const chkMove = $('chk-cut-params-movable') as HTMLInputElement;
  const chkResize = $('chk-cut-params-resizable') as HTMLInputElement;
  const laserEditSection = $('laser-edit-section') as HTMLElement;

  btnCutParams.onclick = () => {
    const active = !api.laser.cutParams.isActive();
    api.laser.cutParams.setMode(active);
    btnCutParams.classList.toggle('active', active);
    cpControls.style.display = active ? '' : 'none';
    if (!active) {
      chkMove.checked = false;
      chkResize.checked = false;
    }
  };

  chkMove.onchange = () =>
    api.laser.cutParams.setMovable(chkMove.checked);
  chkResize.onchange = () =>
    api.laser.cutParams.setResizable(chkResize.checked);

  api.on('CUT_PARAMS_MODE_CHANGED', (ev) => {
    const { enabled } = ev.data as { enabled: boolean };
    btnCutParams.classList.toggle('active', enabled);
    cpControls.style.display = enabled ? '' : 'none';

    const creationTools = document.querySelectorAll('.creation-tool');
    creationTools.forEach((t) => {
      (t as HTMLElement).style.display = enabled ? 'none' : '';
    });
    const deleteBtn = document.getElementById('btn-delete');
    if (deleteBtn) deleteBtn.style.display = enabled ? 'none' : '';

    if (!enabled) {
      chkMove.checked = false;
      chkResize.checked = false;
    }
  });
}

function renderLaserGroups(): void {
  const list = document.getElementById('laser-group-list');
  if (!list) return;
  const grading = api.laser.getLaserColorGrading();
  const groups = api.laser.getLaserGroups();
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
             <option value="raster_engrave"${g.type === 'raster_engrave' ? ' selected' : ''}>Грав. раст</option>
             <option value="vector_engrave"${g.type === 'vector_engrave' ? ' selected' : ''}>Грав. вект</option>
           </select>
         </label>
       </div>
       <div class="lg-row">
         <label>V рез <input type="number" data-f="cutSpeed" value="${g.cutSpeed}" /></label>
         <label>P рез <input type="number" data-f="cutPower" value="${g.cutPower}" /></label>
       </div>
       <div class="lg-row">
         <label>V раст <input type="number" data-f="rasterSpeed" value="${g.rasterSpeed}" /></label>
         <label>P раст <input type="number" data-f="rasterPower" value="${g.rasterPower}" /></label>
       </div>
       <div class="lg-row">
         <label>DPI <input type="number" data-f="rasterDpi" value="${g.rasterDpi}" /></label>
       </div>
       <div class="lg-row">
         <label>V вект <input type="number" data-f="vectorSpeed" value="${g.vectorSpeed}" /></label>
         <label>P вект <input type="number" data-f="vectorPower" value="${g.vectorPower}" /></label>
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
        api.laser.updateLaserGroup(g.id, { [f]: value } as never);
      });
    });

    const sel = (): string[] => api.selection.getSelected().map((e) => e.id);
    (item.querySelector('[data-a="add"]') as HTMLButtonElement).onclick =
      () => {
        api.laser.laserGroupAddElements(g.id, sel());
      };
    (item.querySelector('[data-a="rem"]') as HTMLButtonElement).onclick =
      () => {
        api.laser.laserGroupRemoveElements(g.id, sel());
      };
    (item.querySelector('[data-a="del"]') as HTMLButtonElement).onclick =
      () => {
        api.laser.deleteLaserGroup(g.id);
      };

    list.appendChild(item);
  }
}

// ─── Raster Dithering Modal ──────────────────────────────

function setupRasterModal(): void {
  let currentElementId: string | null = null;
  let ditherTimer: ReturnType<typeof setTimeout> | null = null;

  const el = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
    document.getElementById(id) as T | null;

  const getOverlay = (): HTMLElement | null => el('raster-modal-overlay');
  const getPreviewImg = (): HTMLImageElement | null => el<HTMLImageElement>('raster-preview-img');
  const getAlgoSelect = (): HTMLSelectElement | null => el<HTMLSelectElement>('raster-algo');
  const getBrightnessInput = (): HTMLInputElement | null => el<HTMLInputElement>('raster-brightness');
  const getContrastInput = (): HTMLInputElement | null => el<HTMLInputElement>('raster-contrast');
  const getThresholdInput = (): HTMLInputElement | null => el<HTMLInputElement>('raster-threshold');
  const getInvertChk = (): HTMLInputElement | null => el<HTMLInputElement>('raster-invert');
  const getBrightnessVal = (): HTMLElement | null => el('raster-brightness-val');
  const getContrastVal = (): HTMLElement | null => el('raster-contrast-val');
  const getThresholdVal = (): HTMLElement | null => el('raster-threshold-val');

  const updatePreview = (src: string | undefined): void => {
    const img = getPreviewImg();
    if (!img) return;
    if (src) {
      img.src = src;
      img.style.display = 'block';
    } else {
      img.style.display = 'none';
    }
  };

  const runDithering = (): void => {
    if (!currentElementId) return;
    const algoSelect = getAlgoSelect();
    if (!algoSelect) return;

    const thresholdInput = getThresholdInput();
    const brightnessInput = getBrightnessInput();
    const contrastInput = getContrastInput();
    const invertChk = getInvertChk();

    const algorithm = algoSelect.value as DitherAlgorithm;
    const options = {
      threshold: thresholdInput ? parseInt(thresholdInput.value, 10) : 128,
      brightness: brightnessInput ? parseInt(brightnessInput.value, 10) : 0,
      contrast: contrastInput ? parseInt(contrastInput.value, 10) : 0,
      invert: invertChk ? invertChk.checked : false,
      halftoneSize: 4,
      halftoneAngle: 0,
    };

    api.raster.applyDithering(currentElementId, algorithm, options)
      .then(() => {
        const state = api.raster.getState(currentElementId);
        updatePreview(state?.editedImage);
      })
      .catch((err: Error) => {
        console.error('Dithering failed:', err.message);
      });
  };

  const scheduleDithering = (): void => {
    if (ditherTimer) clearTimeout(ditherTimer);
    ditherTimer = setTimeout(runDithering, 100);
  };

  const syncSliderLabel = (input: HTMLInputElement, getLabel: () => HTMLElement | null): void => {
    const label = getLabel();
    if (label) label.textContent = input.value;
  };

  const brightnessInput = getBrightnessInput();
  const contrastInput = getContrastInput();
  const thresholdInput = getThresholdInput();
  const invertChk = getInvertChk();
  const algoSelect = getAlgoSelect();

  if (brightnessInput) {
    brightnessInput.addEventListener('input', () => {
      syncSliderLabel(brightnessInput, getBrightnessVal);
      scheduleDithering();
    });
  }
  if (contrastInput) {
    contrastInput.addEventListener('input', () => {
      syncSliderLabel(contrastInput, getContrastVal);
      scheduleDithering();
    });
  }
  if (thresholdInput) {
    thresholdInput.addEventListener('input', () => {
      syncSliderLabel(thresholdInput, getThresholdVal);
      scheduleDithering();
    });
  }
  if (algoSelect) {
    algoSelect.addEventListener('change', scheduleDithering);
  }
  if (invertChk) {
    invertChk.addEventListener('change', scheduleDithering);
  }

  const closeBtn = el('raster-modal-close');
  if (closeBtn) {
    closeBtn.onclick = () => {
      const overlay = getOverlay();
      if (overlay) overlay.style.display = 'none';
      currentElementId = null;
    };
  }

  const resetBtn = el('raster-modal-reset');
  if (resetBtn) {
    resetBtn.onclick = () => {
      if (!currentElementId) return;
      api.raster.reset(currentElementId);
      updatePreview(undefined);
    };
  }

  const applyBtn = el('raster-modal-apply');
  if (applyBtn) {
    applyBtn.onclick = () => {
      if (ditherTimer) clearTimeout(ditherTimer);
      runDithering();
    };
  }

  document.querySelectorAll('.raster-step-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.raster-step-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const step = (tab as HTMLElement).dataset.step;
      const dither = el('raster-step-dither');
      const raster = el('raster-step-raster');
      if (dither) dither.style.display = step === 'dither' ? '' : 'none';
      if (raster) raster.style.display = step === 'raster' ? '' : 'none';
    });
  });

  api.on('IMG_SELECT_EDIT', (ev: BusEvent) => {
    const dto = ev.data as Record<string, unknown>;
    const elementId = dto.id as string;
    if (!elementId) return;

    currentElementId = elementId;

    const state = api.raster.getState(elementId);
    const tInput = getThresholdInput();
    const bInput = getBrightnessInput();
    const cInput = getContrastInput();
    const aSelect = getAlgoSelect();
    const iChk = getInvertChk();

    if (state) {
      if (aSelect) aSelect.value = state.algorithm;
      if (state.params.threshold !== undefined && tInput) {
        tInput.value = String(state.params.threshold);
        syncSliderLabel(tInput, getThresholdVal);
      }
      if (state.params.brightness !== undefined && bInput) {
        bInput.value = String(state.params.brightness);
        syncSliderLabel(bInput, getBrightnessVal);
      }
      if (state.params.contrast !== undefined && cInput) {
        cInput.value = String(state.params.contrast);
        syncSliderLabel(cInput, getContrastVal);
      }
      if (iChk) iChk.checked = state.params.invert ?? false;

      const previewSrc = state.editedImage || state.processedSource || state.originalImage || (dto.href as string | undefined) || '';
      updatePreview(previewSrc || undefined);
    } else {
      if (aSelect) aSelect.value = 'floyd-steinberg';
      if (tInput) { tInput.value = '128'; syncSliderLabel(tInput, getThresholdVal); }
      if (bInput) { bInput.value = '0'; syncSliderLabel(bInput, getBrightnessVal); }
      if (cInput) { cInput.value = '0'; syncSliderLabel(cInput, getContrastVal); }
      if (iChk) iChk.checked = false;

      const previewSrc = (dto.editedImage as string | undefined)
        || (dto.originalImage as string | undefined)
        || (dto.href as string | undefined)
        || '';
      updatePreview(previewSrc || undefined);
    }

    const overlay = getOverlay();
    if (overlay) overlay.style.display = 'flex';
  });
}

// ─── Mask Panel ────────────────────────────────────────────

function setupMaskPanel(): void {
  const btnEnter = document.getElementById('btn-mask-enter')!;
  const btnExit = document.getElementById('btn-mask-exit')!;
  const btnAssign = document.getElementById('btn-mask-assign')!;
  const btnRemove = document.getElementById('btn-mask-remove')!;
  const btnUnmask = document.getElementById('btn-mask-unmask')!;
  const statusEl = document.getElementById('mask-status')!;

  let maskImageId: string | null = null;

  const getSelectedIds = (): string[] =>
    api.selection.getSelected().map((e) => e.id);
  const getImageId = (): string | null => {
    const ids = getSelectedIds();
    if (ids.length !== 1) return null;
    return ids[0];
  };

  const updateStatus = (): void => {
    if (maskImageId) {
      btnEnter.style.display = 'none';
      btnExit.style.display = '';
      statusEl.textContent = `Mode: masking image ${maskImageId}`;
    } else {
      btnEnter.style.display = '';
      btnExit.style.display = 'none';
      statusEl.textContent = '';
    }
  };

  btnEnter.onclick = () => {
    const imageId = getImageId();
    if (!imageId) {
      statusEl.textContent = 'Select an image first';
      return;
    }
    api.mask.enterMaskMode(imageId);
    maskImageId = imageId;
    updateStatus();
  };

  btnExit.onclick = () => {
    api.mask.exitMaskMode();
    maskImageId = null;
    updateStatus();
  };

  btnAssign.onclick = () => {
    const selected = getSelectedIds();
    for (const id of selected) {
      api.mask.assignMask(id);
    }
    updateStatus();
  };

  btnRemove.onclick = () => {
    const selected = getSelectedIds();
    for (const id of selected) {
      api.mask.removeMask(id);
    }
    updateStatus();
  };

  btnUnmask.onclick = () => {
    const imageId = getImageId();
    if (!imageId) {
      statusEl.textContent = 'Select an image to unmask';
      return;
    }
    api.mask.unmaskImage(imageId);
  };
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
