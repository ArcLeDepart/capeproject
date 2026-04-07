// ============================================================
// Minecraft Cape Creator - Main Application Script
// ============================================================

// ===== CONSTANTS =====

const BASE_WIDTH = 64;
const BASE_HEIGHT = 32;

// Cape area in base resolution (22×17 pixels used out of 64×32)
const CAPE_AREA_W = 22;
const CAPE_AREA_H = 17;

// Face layout at base resolution
const FACES = {
    top:    { x: 1,  y: 0,  w: 10, h: 1  },
    bottom: { x: 11, y: 0,  w: 10, h: 1  },
    left:   { x: 0,  y: 1,  w: 1,  h: 16 },
    front:  { x: 1,  y: 1,  w: 10, h: 16 },
    right:  { x: 11, y: 1,  w: 1,  h: 16 },
    back:   { x: 12, y: 1,  w: 10, h: 16 },
};

const FACE_COLORS = {
    top:    { fill: 'rgba(74, 222, 128, 0.15)',  stroke: '#4ade80' },
    bottom: { fill: 'rgba(168, 85, 247, 0.15)',  stroke: '#a855f7' },
    left:   { fill: 'rgba(250, 204, 21, 0.15)',  stroke: '#facc15' },
    front:  { fill: 'rgba(59, 130, 246, 0.15)',  stroke: '#3b82f6' },
    right:  { fill: 'rgba(250, 204, 21, 0.15)',  stroke: '#facc15' },
    back:   { fill: 'rgba(251, 146, 60, 0.15)',  stroke: '#fb923c' },
};

const FACE_LABELS = {
    top: 'Haut', bottom: 'Bas', left: 'G',
    front: 'Avant', right: 'D', back: 'Arrière',
};

const PRESET_COLORS = [
    '#000000', '#555555', '#aaaaaa', '#ffffff',
    '#ff0000', '#ff8800', '#ffff00', '#88ff00',
    '#00ff00', '#00ff88', '#00ffff', '#0088ff',
    '#0000ff', '#8800ff', '#ff00ff', '#ff0088',
    '#884400', '#228822', '#224488', '#882244',
];

const MAX_UNDO = 40;

// ===== STATE =====

let scale = 0;
let texW = 0;
let texH = 0;
let zoom = 1;
let currentTool = 'pencil';
let currentColor = { r: 255, g: 0, b: 0, a: 255 };
let brushSize = 1;
let isDrawing = false;
let lastPx = -1;
let lastPy = -1;
let undoStack = [];
let showGrid = true;
let showOverlay = true;

// ===== CANVAS REFERENCES =====

let texCanvas, texCtx;       // Offscreen texture (full resolution)
let dispCanvas, dispCtx;     // Display canvas (zoomed view)
let checkerPattern = null;

// ===== DOM REFERENCES (cached on init) =====

let elInfoSize, elInfoPos, elInfoFace, elInfoZoom;
let elColorInput, elColorPreview, elBrushSize, elBrushLabel;

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Cache DOM references
    dispCanvas = document.getElementById('display-canvas');
    dispCtx = dispCanvas.getContext('2d');
    elInfoSize = document.getElementById('info-size');
    elInfoPos = document.getElementById('info-pos');
    elInfoFace = document.getElementById('info-face');
    elInfoZoom = document.getElementById('info-zoom');
    elColorInput = document.getElementById('color-input');
    elColorPreview = document.getElementById('color-preview');
    elBrushSize = document.getElementById('brush-size');
    elBrushLabel = document.getElementById('brush-size-label');

    setupEventListeners();
    buildColorPresets();
    updateColorUI();
});

// ===== Size Selection =====

function selectSize(s) {
    scale = s;
    texW = BASE_WIDTH * s;
    texH = BASE_HEIGHT * s;

    // Create offscreen texture canvas
    texCanvas = document.createElement('canvas');
    texCanvas.width = texW;
    texCanvas.height = texH;
    texCtx = texCanvas.getContext('2d');
    texCtx.imageSmoothingEnabled = false;

    // Reset state
    undoStack = [];
    isDrawing = false;
    lastPx = -1;
    lastPy = -1;

    // Switch to editor screen
    document.getElementById('selection-screen').classList.remove('active');
    document.getElementById('editor-screen').classList.add('active');

    // Calculate zoom after screen is visible so container has dimensions
    requestAnimationFrame(() => {
        calculateDefaultZoom();
        resizeDisplayCanvas();
        updateInfoBar();
        render();
    });
}

function goBack() {
    document.getElementById('editor-screen').classList.remove('active');
    document.getElementById('selection-screen').classList.add('active');
}

function calculateDefaultZoom() {
    const container = document.getElementById('canvas-scroll');
    const availW = container.clientWidth - 60;
    const availH = container.clientHeight - 60;
    const capeW = CAPE_AREA_W * scale;
    const capeH = CAPE_AREA_H * scale;

    zoom = Math.max(1, Math.floor(Math.min(availW / capeW, availH / capeH)));
}

function resizeDisplayCanvas() {
    const capeW = CAPE_AREA_W * scale;
    const capeH = CAPE_AREA_H * scale;
    dispCanvas.width = capeW * zoom;
    dispCanvas.height = capeH * zoom;

    // Recreate checkerboard pattern (context resets on resize)
    createCheckerboard();
}

function createCheckerboard() {
    const size = 8;
    const pc = document.createElement('canvas');
    pc.width = size * 2;
    pc.height = size * 2;
    const ctx = pc.getContext('2d');
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(0, 0, size * 2, size * 2);
    ctx.fillStyle = '#222233';
    ctx.fillRect(0, 0, size, size);
    ctx.fillRect(size, size, size, size);
    checkerPattern = dispCtx.createPattern(pc, 'repeat');
}

// ============================================================
// RENDERING
// ============================================================

function render() {
    const dw = dispCanvas.width;
    const dh = dispCanvas.height;
    const capeW = CAPE_AREA_W * scale;
    const capeH = CAPE_AREA_H * scale;

    // 1) Checkerboard background
    dispCtx.fillStyle = checkerPattern;
    dispCtx.fillRect(0, 0, dw, dh);

    // 2) Texture data (zoomed, crisp)
    dispCtx.imageSmoothingEnabled = false;
    dispCtx.drawImage(texCanvas, 0, 0, capeW, capeH, 0, 0, dw, dh);

    // 3) Face overlays
    if (showOverlay) {
        drawFaceOverlays();
    }

    // 4) Grid lines
    if (showGrid && zoom >= 3) {
        drawGrid(capeW, capeH);
    }
}

function drawFaceOverlays() {
    for (const [name, base] of Object.entries(FACES)) {
        const sx = base.x * scale * zoom;
        const sy = base.y * scale * zoom;
        const sw = base.w * scale * zoom;
        const sh = base.h * scale * zoom;

        const colors = FACE_COLORS[name];

        // Fill
        dispCtx.fillStyle = colors.fill;
        dispCtx.fillRect(sx, sy, sw, sh);

        // Border
        dispCtx.strokeStyle = colors.stroke;
        dispCtx.lineWidth = Math.max(1, Math.min(2, zoom / 3));
        dispCtx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);

        // Label (only if face is large enough)
        if (sw > 28 && sh > 16) {
            const fontSize = Math.max(9, Math.min(14, Math.floor(sh / 4)));
            dispCtx.fillStyle = colors.stroke;
            dispCtx.font = `bold ${fontSize}px sans-serif`;
            dispCtx.textAlign = 'center';
            dispCtx.textBaseline = 'middle';
            dispCtx.fillText(FACE_LABELS[name], sx + sw / 2, sy + sh / 2);
        }
    }
}

function drawGrid(capeW, capeH) {
    dispCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    dispCtx.lineWidth = 0.5;
    dispCtx.beginPath();

    for (let x = 0; x <= capeW; x++) {
        const dx = x * zoom + 0.5;
        dispCtx.moveTo(dx, 0);
        dispCtx.lineTo(dx, dispCanvas.height);
    }
    for (let y = 0; y <= capeH; y++) {
        const dy = y * zoom + 0.5;
        dispCtx.moveTo(0, dy);
        dispCtx.lineTo(dispCanvas.width, dy);
    }

    dispCtx.stroke();
}

// ============================================================
// COORDINATE CONVERSION
// ============================================================

function displayToTexture(clientX, clientY) {
    const rect = dispCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return {
        x: Math.floor(x / zoom),
        y: Math.floor(y / zoom),
    };
}

function getFaceAt(tx, ty) {
    for (const [name, base] of Object.entries(FACES)) {
        const fx = base.x * scale;
        const fy = base.y * scale;
        const fw = base.w * scale;
        const fh = base.h * scale;
        if (tx >= fx && tx < fx + fw && ty >= fy && ty < fy + fh) {
            return name;
        }
    }
    return null;
}

// ============================================================
// DRAWING TOOLS
// ============================================================

function drawPixelsAt(cx, cy) {
    const half = Math.floor(brushSize / 2);
    for (let dy = -half; dy < brushSize - half; dy++) {
        for (let dx = -half; dx < brushSize - half; dx++) {
            const px = cx + dx;
            const py = cy + dy;
            if (getFaceAt(px, py) !== null) {
                if (currentTool === 'eraser') {
                    texCtx.clearRect(px, py, 1, 1);
                } else {
                    texCtx.fillStyle = `rgba(${currentColor.r},${currentColor.g},${currentColor.b},${currentColor.a / 255})`;
                    texCtx.fillRect(px, py, 1, 1);
                }
            }
        }
    }
}

function drawLinePixels(x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let cx = x0, cy = y0;

    while (true) {
        drawPixelsAt(cx, cy);
        if (cx === x1 && cy === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; cx += sx; }
        if (e2 < dx) { err += dx; cy += sy; }
    }
}

function floodFill(startX, startY) {
    const faceName = getFaceAt(startX, startY);
    if (!faceName) return;

    const base = FACES[faceName];
    const faceX = base.x * scale;
    const faceY = base.y * scale;
    const faceW = base.w * scale;
    const faceH = base.h * scale;

    const imageData = texCtx.getImageData(faceX, faceY, faceW, faceH);
    const data = imageData.data;

    const localX = startX - faceX;
    const localY = startY - faceY;
    const startIdx = (localY * faceW + localX) * 4;

    const targetR = data[startIdx];
    const targetG = data[startIdx + 1];
    const targetB = data[startIdx + 2];
    const targetA = data[startIdx + 3];

    // Don't fill if colors match
    if (targetR === currentColor.r && targetG === currentColor.g &&
        targetB === currentColor.b && targetA === currentColor.a) {
        return;
    }

    const stack = [[localX, localY]];
    const visited = new Uint8Array(faceW * faceH);

    while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        if (cx < 0 || cx >= faceW || cy < 0 || cy >= faceH) continue;

        const vi = cy * faceW + cx;
        if (visited[vi]) continue;

        const pi = vi * 4;
        if (data[pi] !== targetR || data[pi + 1] !== targetG ||
            data[pi + 2] !== targetB || data[pi + 3] !== targetA) {
            continue;
        }

        visited[vi] = 1;
        data[pi] = currentColor.r;
        data[pi + 1] = currentColor.g;
        data[pi + 2] = currentColor.b;
        data[pi + 3] = currentColor.a;

        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }

    texCtx.putImageData(imageData, faceX, faceY);
}

function pickColor(tx, ty) {
    const pixel = texCtx.getImageData(tx, ty, 1, 1).data;
    currentColor = { r: pixel[0], g: pixel[1], b: pixel[2], a: pixel[3] || 255 };
    updateColorUI();
    // Switch back to pencil after picking
    setTool('pencil');
}

// ============================================================
// HISTORY (Undo)
// ============================================================

function saveState() {
    undoStack.push(texCtx.getImageData(0, 0, texW, texH));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
}

function undo() {
    if (undoStack.length === 0) return;
    texCtx.putImageData(undoStack.pop(), 0, 0);
    render();
}

// ============================================================
// IMAGE UPLOAD
// ============================================================

function uploadImage() {
    document.getElementById('file-input').click();
}

function handleImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            saveState();

            const front = FACES.front;
            const back = FACES.back;

            const fx = front.x * scale;
            const fy = front.y * scale;
            const fw = front.w * scale;
            const fh = front.h * scale;
            const bx = back.x * scale;
            const by = back.y * scale;
            const bw = back.w * scale;
            const bh = back.h * scale;

            // Draw on front face
            texCtx.clearRect(fx, fy, fw, fh);
            texCtx.drawImage(img, fx, fy, fw, fh);

            // Draw mirrored on back face
            texCtx.save();
            texCtx.clearRect(bx, by, bw, bh);
            texCtx.translate(bx + bw, by);
            texCtx.scale(-1, 1);
            texCtx.drawImage(img, 0, 0, bw, bh);
            texCtx.restore();

            render();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ============================================================
// DOWNLOAD
// ============================================================

function downloadCape() {
    const link = document.createElement('a');
    link.download = `minecraft_cape_${texW}x${texH}.png`;
    link.href = texCanvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================================
// CLEAR
// ============================================================

function clearCanvas() {
    if (!confirm('Effacer toute la cape ?')) return;
    saveState();
    texCtx.clearRect(0, 0, texW, texH);
    render();
}

// ============================================================
// UI HELPERS
// ============================================================

function updateColorUI() {
    const hex = rgbToHex(currentColor.r, currentColor.g, currentColor.b);
    elColorInput.value = hex;
    elColorPreview.style.backgroundColor = hex;
}

function updateInfoBar() {
    elInfoSize.textContent = `${texW} × ${texH}`;
    elInfoZoom.textContent = `Zoom: ${zoom}×`;
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex) {
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return null;
    return {
        r: parseInt(m[1], 16),
        g: parseInt(m[2], 16),
        b: parseInt(m[3], 16),
        a: 255,
    };
}

function setTool(t) {
    currentTool = t;
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === t);
    });
}

function buildColorPresets() {
    const container = document.getElementById('color-presets');
    PRESET_COLORS.forEach(hex => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = hex;
        swatch.title = hex;
        swatch.addEventListener('click', () => {
            const c = hexToRgb(hex);
            if (c) {
                currentColor = c;
                updateColorUI();
            }
        });
        container.appendChild(swatch);
    });
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function setupEventListeners() {
    // Size card selection
    document.querySelectorAll('.size-card').forEach(card => {
        card.addEventListener('click', () => {
            const s = parseInt(card.dataset.scale, 10);
            selectSize(s);
        });
    });

    // Back button
    document.getElementById('btn-back').addEventListener('click', goBack);

    // Tool buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', () => setTool(btn.dataset.tool));
    });

    // Color input
    elColorInput.addEventListener('input', (e) => {
        const c = hexToRgb(e.target.value);
        if (c) {
            currentColor = c;
            updateColorUI();
        }
    });

    // Brush size
    elBrushSize.addEventListener('input', () => {
        brushSize = parseInt(elBrushSize.value, 10);
        elBrushLabel.textContent = brushSize;
    });

    // Toggles
    document.getElementById('toggle-grid').addEventListener('change', (e) => {
        showGrid = e.target.checked;
        render();
    });
    document.getElementById('toggle-overlay').addEventListener('change', (e) => {
        showOverlay = e.target.checked;
        render();
    });

    // Action buttons
    document.getElementById('btn-upload').addEventListener('click', uploadImage);
    document.getElementById('btn-undo').addEventListener('click', undo);
    document.getElementById('btn-clear').addEventListener('click', clearCanvas);
    document.getElementById('btn-download').addEventListener('click', downloadCape);

    // File input
    document.getElementById('file-input').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleImageFile(e.target.files[0]);
            e.target.value = '';
        }
    });

    // Canvas mouse events
    dispCanvas.addEventListener('mousedown', onCanvasMouseDown);
    dispCanvas.addEventListener('mousemove', onCanvasMouseMove);
    window.addEventListener('mouseup', onCanvasMouseUp);
    dispCanvas.addEventListener('wheel', onCanvasWheel, { passive: false });
    dispCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Keyboard shortcuts
    window.addEventListener('keydown', onKeyDown);
}

// ===== Mouse Handlers =====

function onCanvasMouseDown(e) {
    if (e.button !== 0) return;

    const { x: tx, y: ty } = displayToTexture(e.clientX, e.clientY);

    if (currentTool === 'fill') {
        if (getFaceAt(tx, ty)) {
            saveState();
            floodFill(tx, ty);
            render();
        }
        return;
    }

    if (currentTool === 'picker') {
        if (getFaceAt(tx, ty)) {
            pickColor(tx, ty);
        }
        return;
    }

    // Pencil or eraser
    saveState();
    isDrawing = true;
    lastPx = tx;
    lastPy = ty;
    drawPixelsAt(tx, ty);
    render();
}

function onCanvasMouseMove(e) {
    const { x: tx, y: ty } = displayToTexture(e.clientX, e.clientY);

    // Update info bar
    const face = getFaceAt(tx, ty);
    elInfoPos.textContent = `Position: ${tx}, ${ty}`;
    elInfoFace.textContent = `Zone: ${face ? FACE_LABELS[face] : '-'}`;

    if (!isDrawing) return;

    // Interpolate line from last position
    if (lastPx >= 0 && lastPy >= 0) {
        drawLinePixels(lastPx, lastPy, tx, ty);
    }

    lastPx = tx;
    lastPy = ty;
    render();
}

function onCanvasMouseUp() {
    isDrawing = false;
    lastPx = -1;
    lastPy = -1;
}

function onCanvasWheel(e) {
    e.preventDefault();

    const oldZoom = zoom;
    if (e.deltaY < 0) {
        zoom = Math.min(zoom + (zoom < 8 ? 1 : 2), 40);
    } else {
        zoom = Math.max(zoom - (zoom <= 8 ? 1 : 2), 1);
    }

    if (zoom !== oldZoom) {
        resizeDisplayCanvas();
        elInfoZoom.textContent = `Zoom: ${zoom}×`;
        render();
    }
}

// ===== Keyboard Shortcuts =====

function onKeyDown(e) {
    // Ignore if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key.toLowerCase()) {
        case 'p': setTool('pencil'); break;
        case 'e': setTool('eraser'); break;
        case 'f': setTool('fill'); break;
        case 'i': setTool('picker'); break;
        case 'g':
            showGrid = !showGrid;
            document.getElementById('toggle-grid').checked = showGrid;
            render();
            break;
        case 'z':
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                undo();
            }
            break;
    }
}
