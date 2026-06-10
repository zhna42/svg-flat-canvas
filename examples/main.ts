import { SvgCanvas } from '../src/index';
import { svgNodesToElements } from '../src/dto/svg-node-factory';
import type { SvgNodeDto } from '../src/dto/svg-node-dto';
import nodesData from './svg-nodes.json';

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
  info(
    `  independent-inside-cutout hitArea points: ${independentEl.hitArea.length}`,
  );
}

// ----- mouse wheel zoom -----
const svgEl = canvas.getSVG();
svgEl.addEventListener('wheel', (e: WheelEvent) => {
  e.preventDefault();
  const rect = svgEl.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  canvas.getCamera().setZoom({ x, y }, factor);
});

// ----- mouse drag pan -----
let isPanning = false;
let panStartX = 0;
let panStartY = 0;

svgEl.addEventListener('mousedown', (e: MouseEvent) => {
  if (e.button === 1 || e.button === 0) {
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    svgEl.style.cursor = 'grabbing';
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
    svgEl.style.cursor = '';
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
