import { SvgCanvas } from '../src/index';
import { Events } from '../src/core/EventBus';
import { svgNodesToElements } from '../src/dto/svg-node-factory';
import type { SvgNodeDto } from '../src/dto/svg-node-dto';
import nodesData from './svg-nodes.json';
import groupsData from './groups.json';

const canvas = new SvgCanvas(document.getElementById('app')!, {
  width: 800,
  height: 600,
});

canvas.setArtboardSize(210, 297);

const log = document.getElementById('console')!;
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
  info(`  independent-inside-cutout hitArea points: ${independentEl.hitArea.length}`);
}

// ----- groups -----
canvas.setGroups(groupsData);
info(`Loaded ${canvas.groups.length} groups from groups.json`);

// ----- selection debug -----
canvas.on(Events.SelectionChange, (selected) => {
  info(`Selection: ${selected.map((s) => s.id).join(', ') || '(none)'}`);
});

// ----- selection mode toggle -----
function setMode(mode: 'element' | 'group') {
  canvas.setSelectionMode(mode);
  info(`Mode: ${mode}`);
  document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
  document.getElementById(`btn-mode-${mode}`)?.classList.add('active');
  document.getElementById('btn-mode-element')!.textContent = mode === 'element' ? '● Element' : '○ Element';
  document.getElementById('btn-mode-group')!.textContent = mode === 'group' ? '● Group' : '○ Group';
}
document.getElementById('btn-mode-element')!.onclick = () => setMode('element');
document.getElementById('btn-mode-group')!.onclick = () => setMode('group');
setMode('element');

let currentGesture = 'click';

function setGesture(g: string) {
  currentGesture = g;
  canvas.setSelectionGesture(g as any);
  info(`Gesture: ${g}`);
  document.querySelectorAll('.gesture-btn').forEach((b) => b.classList.remove('active'));
  document.getElementById(`btn-gesture-${g}`)?.classList.add('active');
}

document.getElementById('btn-gesture-click')!.onclick = () => setGesture('click');
document.getElementById('btn-gesture-rect')!.onclick = () => setGesture('rect');
document.getElementById('btn-gesture-lasso')!.onclick = () => setGesture('lasso');
setGesture('click');

// ----- debug hitArea button -----
document.getElementById('btn-debug-hitarea')!.onclick = () => {
  canvas.debugShowHitArea = !canvas.debugShowHitArea;
  const btn = document.getElementById('btn-debug-hitarea')!;
  btn.textContent = canvas.debugShowHitArea ? 'HitArea: on' : 'HitArea: off';
  btn.classList.toggle('active', canvas.debugShowHitArea);
  info(canvas.debugShowHitArea ? 'HitArea debug: ON' : 'HitArea debug: OFF');
};

// ----- toggle pan button -----
let panLocked = false;
document.getElementById('btn-toggle-pan')!.onclick = () => {
  panLocked = !panLocked;
  const btn = document.getElementById('btn-toggle-pan')!;
  btn.textContent = panLocked ? 'Pan: on' : 'Pan: off';
  btn.classList.toggle('active', panLocked);
  info(panLocked ? 'Pan mode: ON (LMB always pans)' : 'Pan mode: OFF');
};

// ----- mouse wheel zoom -----
const svgEl = canvas.getSVG();
svgEl.addEventListener('wheel', (e: WheelEvent) => {
  e.preventDefault();
  const point = svgEl.createSVGPoint();
  point.x = e.clientX;
  point.y = e.clientY;
  const ctm = svgEl.getScreenCTM();
  if (!ctm) return;
  const svgPt = point.matrixTransform(ctm.inverse());
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  canvas.getCamera().setZoom({ x: svgPt.x, y: svgPt.y }, factor);
});

// ----- mouse drag pan (space + LMB, or middle button) -----
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let spaceHeld = false;

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.code === 'Space') {
    spaceHeld = true;
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e: KeyboardEvent) => {
  if (e.code === 'Space') {
    spaceHeld = false;
    svgEl.style.cursor = '';
  }
});

svgEl.addEventListener('mousedown', (e: MouseEvent) => {
  if (e.button === 1 || (e.button === 0 && spaceHeld) || (e.button === 0 && panLocked)) {
    canvas.panActive.value = true;
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    svgEl.style.cursor = 'grabbing';
    e.preventDefault();
  }
});

window.addEventListener('mousemove', (e: MouseEvent) => {
  if (!isPanning) return;
  const dx = e.clientX - panStartX;
  const dy = e.clientY - panStartY;
  canvas.getCamera().pan(dx, dy);
  panStartX = e.clientX;
  panStartY = e.clientY;
});

window.addEventListener('mouseup', () => {
  if (isPanning) {
    isPanning = false;
    canvas.panActive.value = false;
    svgEl.style.cursor = spaceHeld ? 'grab' : '';
  }
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
  if (!selectedGroupId) { info('No group selected'); return; }
  canvas.deleteGroup(selectedGroupId);
  selectedGroupId = null;
  renderGroupList();
  info('Group deleted');
};

document.getElementById('btn-group-clear')!.onclick = () => {
  if (!selectedGroupId) { info('No group selected'); return; }
  canvas.clearGroup(selectedGroupId);
  renderGroupList();
  info('Group cleared');
};

document.getElementById('btn-group-select')!.onclick = () => {
  if (!selectedGroupId) { info('No group selected'); return; }
  canvas.selectGroupElements(selectedGroupId);
  canvas.selectMultipleGroups([]);
  renderGroupList();
  info('Selected all elements in group');
};

document.getElementById('btn-group-add')!.onclick = () => {
  const sel = document.getElementById('group-select') as HTMLSelectElement;
  const gid = sel.value;
  if (!gid) { info('Select a group first'); return; }
  const selected = Array.from(canvas.getSelected());
  if (selected.length === 0) { info('No elements selected'); return; }
  canvas.addToGroup(gid, selected.map(e => e.id));
  renderGroupList();
  info(`Added ${selected.length} element(s) to group`);
};

document.getElementById('btn-group-remove')!.onclick = () => {
  const sel = document.getElementById('group-select') as HTMLSelectElement;
  const gid = sel.value;
  if (!gid) { info('Select a group first'); return; }
  const selected = Array.from(canvas.getSelected());
  if (selected.length === 0) { info('No elements selected'); return; }
  canvas.removeFromGroup(gid, selected.map(e => e.id));
  renderGroupList();
  info(`Removed ${selected.length} element(s) from group`);
};

// ----- undo/redo keyboard shortcuts -----
window.addEventListener('keydown', (e: KeyboardEvent) => {
  const isCmd = e.metaKey || e.ctrlKey;
  if (isCmd && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    if (canvas.canUndo) {
      canvas.undo();
      info('Undo');
    }
  } else if ((isCmd && e.key === 'z' && e.shiftKey) || (isCmd && e.key === 'y')) {
    e.preventDefault();
    if (canvas.canRedo) {
      canvas.redo();
      info('Redo');
    }
  }
});

canvas.onGroupsChange = renderGroupList;
renderGroupList();
