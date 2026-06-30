import { SvgCanvas, svgNodesToElements } from '../src/index';
import type { SvgNodeDto } from '../src/index';
import nodesData from './svg-nodes.json';
import groupsData from './groups.json';

const canvas = new SvgCanvas(document.getElementById('canvas-container')!, {
  width: 800,
  height: 600,
});

const api = canvas.getExternalApi();

canvas.setArtboardSize(210, 297);

const log = document.getElementById('info')!;
function info(msg: string) {
  log.textContent += '\n' + msg;
  log.scrollTop = log.scrollHeight;
}

const elements = svgNodesToElements(nodesData as SvgNodeDto[]);
for (const el of elements) {
  canvas.addShape(el);
}

info(`Loaded ${elements.length} shapes from svg-nodes.json`);
info('Scroll to zoom, drag to pan');
info('Artboard: A4 (210×297 mm)');

const pathCutout = elements.find((e) => e.id === 'path-cutout-001');
if (pathCutout) {
  info(`  path-cutout-001 hitArea points: ${pathCutout.hitArea.length}`);
}
const independentEl = elements.find(
  (e) => e.id === 'independent-inside-cutout',
);
if (independentEl) {
  info(
    `  independent-inside-cutout hitArea points: ${independentEl.hitArea.length}`,
  );
}

// ----- groups -----
canvas.setGroups(groupsData);
info(`Loaded ${canvas.groups.length} groups from groups.json`);

// ----- selection debug -----
canvas.on('SVG_CAD_SELECT', (event) => {
  const selected = event.data as any;
  info(`Selection: ${selected.elementIds?.join(', ') || '(none)'}`);
});

// ----- selection mode toggle -----
function setMode(mode: 'element' | 'group') {
  canvas.setSelectionMode(mode);
  info(`Mode: ${mode}`);
  document
    .querySelectorAll('.mode-btn')
    .forEach((b) => b.classList.remove('active'));
  document.getElementById(`btn-mode-${mode}`)?.classList.add('active');
  document.getElementById('btn-mode-element')!.textContent =
    mode === 'element' ? '● Element' : '○ Element';
  document.getElementById('btn-mode-group')!.textContent =
    mode === 'group' ? '● Group' : '○ Group';
}
document.getElementById('btn-mode-element')!.onclick = () => setMode('element');
document.getElementById('btn-mode-group')!.onclick = () => setMode('group');
setMode('element');

let currentGesture = 'click';

function setGesture(g: string) {
  currentGesture = g;
  canvas.setSelectionGesture(g as any);
  info(`Gesture: ${g}`);
  document
    .querySelectorAll('.gesture-btn')
    .forEach((b) => b.classList.remove('active'));
  document.getElementById(`btn-gesture-${g}`)?.classList.add('active');
}

document.getElementById('btn-gesture-click')!.onclick = () =>
  setGesture('click');
document.getElementById('btn-gesture-rect')!.onclick = () => setGesture('rect');
document.getElementById('btn-gesture-lasso')!.onclick = () =>
  setGesture('lasso');
setGesture('click');

// ----- debug hitArea button -----
document.getElementById('btn-debug-hitarea')!.onclick = () => {
  canvas.debugShowHitArea = !canvas.debugShowHitArea;
  const btn = document.getElementById('btn-debug-hitarea')!;
  btn.textContent = canvas.debugShowHitArea ? 'HitArea: on' : 'HitArea: off';
  btn.classList.toggle('active', canvas.debugShowHitArea);
  info(canvas.debugShowHitArea ? 'HitArea debug: ON' : 'HitArea debug: OFF');
};

// ----- snap toggles -----
let snapCorners = false;
document.getElementById('btn-snap-corners')!.onclick = () => {
  snapCorners = !snapCorners;
  canvas.setSnapToCorners(snapCorners);
  const btn = document.getElementById('btn-snap-corners')!;
  btn.textContent = snapCorners ? 'Snap corners: on' : 'Snap corners: off';
  btn.classList.toggle('active', snapCorners);
  info(snapCorners ? 'Snap to corners: ON' : 'Snap to corners: OFF');
};

let snapPlanes = false;
document.getElementById('btn-snap-planes')!.onclick = () => {
  snapPlanes = !snapPlanes;
  canvas.setSnapToPlanes(snapPlanes);
  const btn = document.getElementById('btn-snap-planes')!;
  btn.textContent = snapPlanes ? 'Snap planes: on' : 'Snap planes: off';
  btn.classList.toggle('active', snapPlanes);
  info(snapPlanes ? 'Snap to planes: ON' : 'Snap to planes: OFF');
};

let snapArtboard = false;
document.getElementById('btn-snap-artboard')!.onclick = () => {
  snapArtboard = !snapArtboard;
  canvas.setSnapToArtboard(snapArtboard);
  const btn = document.getElementById('btn-snap-artboard')!;
  btn.textContent = snapArtboard ? 'Snap artboard: on' : 'Snap artboard: off';
  btn.classList.toggle('active', snapArtboard);
  info(snapArtboard ? 'Snap to artboard: ON' : 'Snap to artboard: OFF');
};

// ----- avoid collisions toggle -----
let avoidCollisions = false;
document.getElementById('btn-avoid-collisions')!.onclick = () => {
  avoidCollisions = !avoidCollisions;
  canvas.setAvoidCollisions(avoidCollisions);
  const btn = document.getElementById('btn-avoid-collisions')!;
  btn.textContent = avoidCollisions ? 'Avoid collisions: on' : 'Avoid collisions: off';
  btn.classList.toggle('active', avoidCollisions);
  info(avoidCollisions ? 'Avoid collisions: ON' : 'Avoid collisions: OFF');
};

// ----- pan mode button -----
let panActive = false;
document.getElementById('btn-toggle-pan')!.onclick = () => {
  panActive = !panActive;
  api.setPanMode(panActive);
  if (zoomRaf) { cancelAnimationFrame(zoomRaf); zoomRaf = null; zoomTarget = null; }
  document.getElementById('btn-toggle-pan')!.textContent = panActive ? 'Pan: on' : 'Pan: off';
  info(panActive ? 'Pan mode: ON' : 'Pan mode: OFF');
};

// ----- mouse wheel zoom (smooth) -----
const svgEl = canvas.getSVG();
let zoomTarget: { x: number; y: number; zoom: number } | null = null;
let zoomRaf: number | null = null;

svgEl.addEventListener('wheel', (e: WheelEvent) => {
  e.preventDefault();
  const point = svgEl.createSVGPoint();
  point.x = e.clientX;
  point.y = e.clientY;
  const ctm = svgEl.getScreenCTM();
  if (!ctm) return;
  const svgPt = point.matrixTransform(ctm.inverse());
  const cam = canvas.getCamera();
  const speed = 0.12 * (1 + 5 / (cam.zoom + 0.8));
  const factor = e.deltaY < 0 ? 1 + speed : 1 / (1 + speed);
  const targetZoom = Math.max(0.05, Math.min(cam.zoom * factor, 50));
  zoomTarget = { x: svgPt.x, y: svgPt.y, zoom: targetZoom };

  if (zoomRaf) return;

  const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);

  const animate = (): void => {
    if (!zoomTarget) { zoomRaf = null; return; }
    const cam2 = canvas.getCamera();
    const dz = zoomTarget.zoom - cam2.zoom;
    if (Math.abs(dz) < 0.001) {
      cam2.setZoom({ x: zoomTarget.x, y: zoomTarget.y }, 1);
      zoomTarget = null;
      zoomRaf = null;
      return;
    }
    const step = dz * 0.09;
    cam2.setZoom({ x: zoomTarget.x, y: zoomTarget.y }, (cam2.zoom + step) / cam2.zoom);
    zoomRaf = requestAnimationFrame(animate);
  };
  zoomRaf = requestAnimationFrame(animate);
});

// ----- set A4 / A3 buttons -----
document.getElementById('btn-size-a4')!.onclick = () => {
  canvas.setArtboardSize(210, 297);
  info('Artboard: A4 (210×297 mm)');
};
document.getElementById('btn-size-a3')!.onclick = () => {
  canvas.setArtboardSize(297, 420);
  info('Artboard: A3 (297×420 mm)');
};

// ----- group UI -----
let selectedGroupId: string | null = null;

function renderGroupList() {
  const list = document.getElementById('group-list')!;
  list.innerHTML = '';
  for (const g of canvas.groups) {
    const div = document.createElement('div');
    div.className = 'group-item' + (g.id === selectedGroupId ? ' active' : '');
    div.textContent = `${g.name} (${g.elementIds.size})`;
    div.onclick = () => {
      selectedGroupId = g.id;
      canvas.highlightGroupElements(g.id);
      canvas.selectGroup(g.id);
      renderGroupList();
    };
    list.appendChild(div);
  }

  const sel = document.getElementById('group-select') as HTMLSelectElement;
  sel.innerHTML = '<option value="">— no group —</option>';
  for (const g of canvas.groups) {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.name;
    sel.appendChild(opt);
  }
}

document.getElementById('btn-group-create')!.onclick = () => {
  const id = canvas.createGroup();
  selectedGroupId = id;
  renderGroupList();
  info(`Group created: ${id}`);
};

document.getElementById('btn-group-delete')!.onclick = () => {
  if (!selectedGroupId) {
    info('No group selected');
    return;
  }
  canvas.deleteGroup(selectedGroupId);
  selectedGroupId = null;
  renderGroupList();
  info('Group deleted');
};

document.getElementById('btn-group-clear')!.onclick = () => {
  if (!selectedGroupId) {
    info('No group selected');
    return;
  }
  canvas.clearGroup(selectedGroupId);
  renderGroupList();
  info('Group cleared');
};

document.getElementById('btn-group-select')!.onclick = () => {
  if (!selectedGroupId) {
    info('No group selected');
    return;
  }
  canvas.selectGroupElements(selectedGroupId);
  canvas.selectMultipleGroups([]);
  renderGroupList();
  info('Selected all elements in group');
};

document.getElementById('btn-group-add')!.onclick = () => {
  const sel = document.getElementById('group-select') as HTMLSelectElement;
  const gid = sel.value;
  if (!gid) {
    info('Select a group first');
    return;
  }
  const selected = Array.from(canvas.getSelected());
  if (selected.length === 0) {
    info('No elements selected');
    return;
  }
  canvas.addToGroup(
    gid,
    selected.map((e: any) => e.id),
  );
  renderGroupList();
  info(`Added ${selected.length} element(s) to group`);
};

document.getElementById('btn-group-remove')!.onclick = () => {
  const sel = document.getElementById('group-select') as HTMLSelectElement;
  const gid = sel.value;
  if (!gid) {
    info('Select a group first');
    return;
  }
  const selected = Array.from(canvas.getSelected());
  if (selected.length === 0) {
    info('No elements selected');
    return;
  }
  canvas.removeFromGroup(
    gid,
    selected.map((e: any) => e.id),
  );
  renderGroupList();
  info(`Removed ${selected.length} element(s) from group`);
};

// ----- transform buttons -----
document.getElementById('btn-transform-resize')!.onclick = () => {
  const sel = canvas.getSelected();
  if (sel.length === 0) {
    info('No element selected');
    return;
  }
  const el = sel[0];
  const bbox = el.getTransformedBBox();
  canvas.resizeElement(el.id, bbox.width * 1.2, bbox.height * 1.2);
  canvas.getTimeMachine().push('RESIZE');
  info(`Resized ${el.id} +20%`);
};
document.getElementById('btn-transform-rotate')!.onclick = () => {
  const sel = canvas.getSelected();
  if (sel.length === 0) {
    info('No element selected');
    return;
  }
  const el = sel[0];
  canvas.rotateElement(el.id, 15);
  canvas.getTimeMachine().push('ROTATE', [el.id], 'element', [el.id], []);
  info(`Rotated ${el.id} 15deg`);
};
document.getElementById('btn-transform-matrix')!.onclick = () => {
  const sel = canvas.getSelected();
  if (sel.length === 0) {
    info('No element selected');
    return;
  }
  const el = sel[0];
  canvas.transformElement(el.id, [1, 0.2, 0, 1, 0, 0]);
  canvas.getTimeMachine().push('TRANSFORM');
  info(`Applied matrix skew to ${el.id}`);
};

// ----- handle mode toggle -----
let handleMode: 'resize' | 'rotate' = 'resize';
document.getElementById('btn-handle-resize')!.onclick = () => {
  handleMode = 'resize';
  canvas.setTransformMode('resize');
  api.setTransformMode('resize');
  document.getElementById('btn-handle-resize')!.classList.add('active');
  document.getElementById('btn-handle-rotate')!.classList.remove('active');
  info('Handle mode: resize');
};
document.getElementById('btn-handle-rotate')!.onclick = () => {
  handleMode = 'rotate';
  canvas.setTransformMode('rotate');
  api.setTransformMode('rotate');
  document.getElementById('btn-handle-resize')!.classList.remove('active');
  document.getElementById('btn-handle-rotate')!.classList.add('active');
  info('Handle mode: rotate');
};

(document.getElementById('chk-proportional-resize') as HTMLInputElement).onchange = (e) => {
  const enabled = (e.target as HTMLInputElement).checked;
  api.setProportionalResize(enabled);
  info(`Proportional resize: ${enabled ? 'ON' : 'OFF'}`);
};

// ----- delete keyboard -----
window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (!e.target || (e.target as HTMLElement).tagName === 'BODY') {
      const mode = canvas.getSelectionMode();
      if (mode === 'group') {
        const gids = canvas.getSelectedGroupIds();
        if (gids.length > 0) {
          e.preventDefault();
          for (const gid of gids) {
            const ids = canvas.getElementIdsInGroup(gid);
            if (ids.length > 0) canvas.deleteElements(ids);
            canvas.deleteGroup(gid);
          }
          info(`Deleted ${gids.length} group(s)`);
        }
      } else {
        const selected = Array.from(canvas.getSelected());
        if (selected.length > 0) {
          e.preventDefault();
          canvas.deleteElements(selected.map((s: any) => s.id));
          info(`Deleted ${selected.length} element(s)`);
        }
      }
    }
  }
});

// ----- undo/redo keyboard shortcuts -----
window.addEventListener('keydown', (e: KeyboardEvent) => {
  const isCmd = e.metaKey || e.ctrlKey;
  if (isCmd && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    if (canvas.canUndo) {
      canvas.undo();
      info('Undo');
    }
  } else if (
    (isCmd && e.key === 'z' && e.shiftKey) ||
    (isCmd && e.key === 'y')
  ) {
    e.preventDefault();
    if (canvas.canRedo) {
      canvas.redo();
      info('Redo');
    }
  }
});

canvas.onGroupsChange = renderGroupList;
renderGroupList();

// ----- creation tools -----
type CreationTool = 'select' | 'rect' | 'circle' | 'ellipse' | 'line' | 'polyline' | 'polygon' | 'path';

const TOOL_TO_CREATION_TYPE: Record<string, CreationTool | null> = {
  select: null,
  rect: 'rect',
  circle: 'circle',
  ellipse: 'ellipse',
  line: 'line',
  polyline: 'polyline',
  polygon: 'polygon',
  path: 'path',
};

function setActiveTool(tool: CreationTool) {
  document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
  document.getElementById(`btn-tool-${tool}`)?.classList.add('active');

  const creationType = TOOL_TO_CREATION_TYPE[tool];
  canvas.setActiveCreationTool(creationType ?? null);
  info(`Tool: ${tool}`);
}

document.querySelectorAll('.tool-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tool = (btn as HTMLElement).id.replace('btn-tool-', '') as CreationTool;
    setActiveTool(tool);
  });
});

setActiveTool('select');

// ----- boolean operation buttons -----
let boolActive: string | null = null;

function setBooleanMode(op: string | null) {
  boolActive = op;
  document.querySelectorAll('.bool-btn').forEach((b) => b.classList.remove('active'));
  if (op) {
    document.getElementById(`btn-bool-${op}`)?.classList.add('active');
    api.enterBooleanMode(op as any);
    info(`Boolean mode: ${op}`);
  } else {
    document.getElementById('btn-bool-off')?.classList.add('active');
    api.exitBooleanMode();
    info('Boolean mode: OFF');
  }
}

document.getElementById('btn-bool-union')!.onclick = () => setBooleanMode('UNION');
document.getElementById('btn-bool-intersect')!.onclick = () => setBooleanMode('INTERSECT');
document.getElementById('btn-bool-difference')!.onclick = () => setBooleanMode('DIFFERENCE');
document.getElementById('btn-bool-off')!.onclick = () => setBooleanMode(null);

// ----- grid controls -----
let gridVisible = false;
document.getElementById('btn-grid-toggle')!.onclick = () => {
  gridVisible = !gridVisible;
  const btn = document.getElementById('btn-grid-toggle')!;
  if (gridVisible) {
    api.showGrid();
    btn.textContent = 'Grid: on';
    btn.classList.add('active');
    info('Grid: ON');
  } else {
    api.hideGrid();
    btn.textContent = 'Grid: off';
    btn.classList.remove('active');
    info('Grid: OFF');
  }
};

(document.getElementById('input-grid-step') as HTMLInputElement).onchange = (e) => {
  const step = parseInt((e.target as HTMLInputElement).value, 10);
  if (step > 0) {
    api.setGridStep(step);
    info(`Grid step: ${step} mm`);
  }
};

// ----- snap guidelines / grid -----
let snapGuidelines = false;
document.getElementById('btn-snap-guidelines')!.onclick = () => {
  snapGuidelines = !snapGuidelines;
  api.setSnapToGuidelines(snapGuidelines);
  const btn = document.getElementById('btn-snap-guidelines')!;
  btn.textContent = snapGuidelines ? 'Snap guides: on' : 'Snap guides: off';
  btn.classList.toggle('active', snapGuidelines);
  info(snapGuidelines ? 'Snap to guidelines: ON' : 'Snap to guidelines: OFF');
};

let snapGrid = false;
document.getElementById('btn-snap-grid')!.onclick = () => {
  snapGrid = !snapGrid;
  api.setSnapToGrid(snapGrid);
  const btn = document.getElementById('btn-snap-grid')!;
  btn.textContent = snapGrid ? 'Snap grid: on' : 'Snap grid: off';
  btn.classList.toggle('active', snapGrid);
  info(snapGrid ? 'Snap to grid: ON' : 'Snap to grid: OFF');
};

(document.getElementById('select-snap-axis') as HTMLSelectElement).onchange = (e) => {
  const axis = (e.target as HTMLSelectElement).value as 'both' | 'horizontal' | 'vertical';
  api.setSnapAxis(axis);
  info(`Snap axis: ${axis}`);
};

// ----- outline -----
document.getElementById('btn-outline')!.onclick = () => {
  const selected = Array.from(canvas.getSelected());
  if (selected.length === 0) {
    info('No element selected for outline');
    return;
  }
  for (const el of selected) {
    api.outlineElement((el as any).id);
  }
  info(`Outlined ${selected.length} element(s)`);
};

// ----- preloader toggle -----
let preloaderVisible = false;
document.getElementById('btn-preloader-toggle')!.onclick = () => {
  preloaderVisible = !preloaderVisible;
  const btn = document.getElementById('btn-preloader-toggle')!;
  if (preloaderVisible) {
    api.showPreloader();
    btn.textContent = 'Preloader: on';
    btn.classList.add('active');
  } else {
    api.hidePreloader();
    btn.textContent = 'Preloader: off';
    btn.classList.remove('active');
  }
  info(preloaderVisible ? 'Preloader: ON' : 'Preloader: OFF');
};

// External API — доступна из консоли
(window as any).api = api;
