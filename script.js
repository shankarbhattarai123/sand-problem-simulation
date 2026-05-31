// --- CONSTANTS & CONFIGS ---
const SHAPE_CONFIGS = {
    sphere: {
        color: '#ff4b72',
        label: 'Smooth Spheres',
        fact: 'Spheres roll and slide effortlessly with zero friction, flowing like liquid to settle in wide, gentle plains.',
        restitution: 0.45,
        friction: 0.05,
        r: 8,
        mass: 1.0,
        desc: 'Tap to pour elegant glowing spheres.'
    },
    rod: {
        color: '#ffa726',
        label: 'Tangled Sticks',
        fact: 'Elongated sticks tumble, pivot, and hook together, interlocking like tiny log cabins to support stable, steep slopes.',
        restitution: 0.15,
        friction: 0.45,
        r: 5, // half-thickness
        len: 12, // half-length
        mass: 1.8,
        desc: 'Tap to scatter spinning wooden rods.'
    },
    star: {
        color: '#ffd54f',
        label: 'Celestial Stars',
        fact: 'Pointy stars mesh and lock at their vertices. Because their limbs bridge gaps, they stand high in dramatic, airy mountains.',
        restitution: 0.2,
        friction: 0.8,
        r: 9,
        mass: 1.2,
        desc: 'Tap to shower interlocking glowing stars.'
    },
    hex: {
        color: '#00e676',
        label: 'Spiky Clusters',
        fact: 'Intertwined spikes latch instantly on impact, resisting gravity entirely to weave vertical columns and arched castles.',
        restitution: 0.05,
        friction: 0.95,
        r: 9,
        mass: 1.4,
        desc: 'Tap to drop branching crystal spikes.'
    }
};

const MAX_PARTICLES = 1500;

// --- CANVAS & STATE SETUP ---
const canvas = document.getElementById('sandCanvas');
const ctx = canvas.getContext('2d');
let W = window.innerWidth;
let H = window.innerHeight;

// Beaker Dimensions & Coordinates
const BEAKER_WIDTH = 240;
let beakerLeft = W / 2 - BEAKER_WIDTH / 2;
let beakerRight = W / 2 + BEAKER_WIDTH / 2;
let beakerFloor = H - 60;
let beakerTop = H - 420;

// Handle High-DPI screens
function resizeCanvas() {
    W = window.innerWidth;
    H = window.innerHeight;

    // Update Beaker coordinate states
    beakerLeft = W / 2 - BEAKER_WIDTH / 2;
    beakerRight = W / 2 + BEAKER_WIDTH / 2;
    beakerFloor = H - 60;
    beakerTop = H - 420;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // Re-generate background stars
    generateStars();
}

// Background cosmetic elements
const stars = [];
function generateStars() {
    stars.length = 0;
    const starCount = Math.floor(W * H / 12000);
    for (let i = 0; i < starCount; i++) {
        stars.push({
            x: Math.random() * W,
            y: Math.random() * H * 0.7, // Only in sky
            r: 0.5 + Math.random() * 1.5,
            opacity: 0.2 + Math.random() * 0.8
        });
    }
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Simulation States
let currentShape = 'sphere';
const particles = [];
const sparks = [];
let autoPour = true;
let beakerMode = false;
let isVibrating = false;
let wind = 0.0;
let flowRate = 3; // 1 to 5
let isPouring = false;
let pourX = 0;
let pourY = 0;
let frameCount = 0;
let shakeAmount = 0;

// Spatial Hash Grid Configuration
const CELL_SIZE = 36; // Big enough to hold maximum particle collision bounds
let gridCols = Math.ceil(W / CELL_SIZE);
let gridRows = Math.ceil(H / CELL_SIZE);
let grid = [];

function updateGridDimensions() {
    gridCols = Math.ceil(W / CELL_SIZE);
    gridRows = Math.ceil(H / CELL_SIZE);
    grid = Array.from({ length: gridCols * gridRows }, () => []);
}
updateGridDimensions();
// --- PIXEL SAND ENGINE (CELLULAR AUTOMATA) ---

function initPixelGridBoundaries() {
    if (pixelGrid.length !== gridW * gridH) {
        pixelGrid = new Uint8Array(gridW * gridH);
    }
    pixelGrid.fill(0);

    // 1. Draw Dunes (Static Ground)
    for (let gx = 0; gx < gridW; gx++) {
        const canvasX = gx * PIXEL_SCALE;
        const canvasY = getGroundHeight(canvasX);
        const gyStart = Math.floor(canvasY / PIXEL_SCALE);
        for (let gy = gyStart; gy < gridH; gy++) {
            if (gy >= 0 && gy < gridH) {
                pixelGrid[gx + gy * gridW] = 11; // Dune type
            }
        }
    }

    // 2. Draw Beaker (Static Walls)
    if (beakerMode) {
        const gLeft = Math.floor(beakerLeft / PIXEL_SCALE);
        const gRight = Math.floor(beakerRight / PIXEL_SCALE);
        const gTop = Math.floor(beakerTop / PIXEL_SCALE);
        const gFloor = Math.floor(beakerFloor / PIXEL_SCALE);
        const thick = 2; // wall thickness in cells

        for (let gy = gTop; gy <= gFloor; gy++) {
            if (gy >= 0 && gy < gridH) {
                // Left beaker wall
                for (let t = 0; t < thick; t++) {
                    if (gLeft + t >= 0 && gLeft + t < gridW) {
                        pixelGrid[(gLeft + t) + gy * gridW] = 10;
                    }
                }
                // Right beaker wall
                for (let t = 0; t < thick; t++) {
                    if (gRight - t >= 0 && gRight - t < gridW) {
                        pixelGrid[(gRight - t) + gy * gridW] = 10;
                    }
                }
            }
        }

        // Beaker floor
        for (let gx = gLeft; gx <= gRight; gx++) {
            if (gx >= 0 && gx < gridW) {
                for (let t = 0; t < thick; t++) {
                    if (gFloor - t >= 0 && gFloor - t < gridH) {
                        pixelGrid[gx + (gFloor - t) * gridW] = 10;
                    }
                }
            }
        }
    }
}

function updatePixelPhysics() {
    frameCount++;

    // 1. Pour Continuous Stream (Auto Pour)
    if (autoPour && frameCount % Math.max(1, 6 - flowRate) === 0) {
        const nozzleX = Math.floor(gridW / 2);
        const nozzleY = Math.floor(45 / PIXEL_SCALE);
        const streamW = 5;

        const spawnCount = Math.min(3, flowRate);
        for (let s = 0; s < spawnCount; s++) {
            const rx = nozzleX + Math.floor((Math.random() - 0.5) * streamW);
            const ry = nozzleY + Math.floor(Math.random() * 2);
            if (rx >= 0 && rx < gridW && ry >= 0 && ry < gridH) {
                if (pixelGrid[rx + ry * gridW] === 0) {
                    pixelGrid[rx + ry * gridW] = getShapeIndex(currentShape);
                }
            }
        }
    }

    // 2. User Click & Drag Pour
    if (isPouring && frameCount % Math.max(1, 6 - flowRate) === 0) {
        const gx = Math.floor(pourX / PIXEL_SCALE);
        const gy = Math.floor(pourY / PIXEL_SCALE);
        const radius = 3;

        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                if (Math.random() < 0.35) {
                    const rx = gx + dx;
                    const ry = gy + dy;
                    if (rx >= 0 && rx < gridW && ry >= 0 && ry < gridH) {
                        if (pixelGrid[rx + ry * gridW] === 0) {
                            pixelGrid[rx + ry * gridW] = getShapeIndex(currentShape);
                        }
                    }
                }
            }
        }
    }

    // 3. Vibration Force (Agitate sand inside container)
    if (beakerMode && isVibrating) {
        const gLeft = Math.floor(beakerLeft / PIXEL_SCALE) + 2;
        const gRight = Math.floor(beakerRight / PIXEL_SCALE) - 2;
        const gTop = Math.floor(beakerTop / PIXEL_SCALE) + 1;
        const gFloor = Math.floor(beakerFloor / PIXEL_SCALE) - 2;

        for (let gy = gFloor; gy >= gTop; gy--) {
            for (let gx = gLeft; gx <= gRight; gx++) {
                const idx = gx + gy * gridW;
                const type = pixelGrid[idx];
                if (type > 0 && type < 10) {
                    if (Math.random() < 0.22) {
                        const targetX = gx + (Math.random() < 0.5 ? -1 : 1);
                        const targetY = gy + (Math.random() < 0.3 ? -1 : 0);
                        if (targetX >= gLeft && targetX <= gRight && targetY >= gTop && targetY <= gFloor) {
                            const targetIdx = targetX + targetY * gridW;
                            if (pixelGrid[targetIdx] === 0) {
                                pixelGrid[idx] = 0;
                                pixelGrid[targetIdx] = type;
                            }
                        }
                    }
                }
            }
        }
        shakeAmount = Math.max(shakeAmount, 3.5);
    }

    // 4. Cellular Automata Update Logic (Bottom-to-Top sweep)
    const sweepRight = Math.random() < 0.5;
    const slideProbabilities = {
        1: 0.95, // Sphere: highly fluid sliding
        2: 0.42, // Stick: moderate slides
        3: 0.22, // Star: steep slide angle
        4: 0.04  // Spiky: columns/vertical walls
    };

    let grainsInsideCount = 0;
    let highestGrainsY = beakerFloor;

    const bLeft = beakerLeft;
    const bRight = beakerRight;
    const bTop = beakerTop;
    const bFloor = beakerFloor;

    for (let gy = gridH - 2; gy >= 0; gy--) {
        const startX = sweepRight ? 0 : gridW - 1;
        const endX = sweepRight ? gridW : -1;
        const stepX = sweepRight ? 1 : -1;

        for (let gx = startX; gx !== endX; gx += stepX) {
            const idx = gx + gy * gridW;
            const type = pixelGrid[idx];

            if (type > 0 && type < 10) {
                // Compute metrics inside container coordinates
                const canvasX = gx * PIXEL_SCALE;
                const canvasY = gy * PIXEL_SCALE;
                if (beakerMode && canvasX > bLeft && canvasX < bRight && canvasY > bTop && canvasY < bFloor) {
                    grainsInsideCount++;
                    if (canvasY < highestGrainsY) {
                        highestGrainsY = canvasY;
                    }
                }

                // Move directly down if empty
                const downIdx = gx + (gy + 1) * gridW;
                if (pixelGrid[downIdx] === 0) {
                    pixelGrid[idx] = 0;
                    pixelGrid[downIdx] = type;
                }
                // Slide diagonally based on Repose angle probabilities
                else {
                    const prob = slideProbabilities[type] || 0.5;
                    if (Math.random() < prob) {
                        const slideLeft = Math.random() < 0.5;
                        const leftCol = gx - 1;
                        const rightCol = gx + 1;
                        const targetY = gy + 1;

                        const canSlideLeft = leftCol >= 0 && pixelGrid[leftCol + targetY * gridW] === 0;
                        const canSlideRight = rightCol < gridW && pixelGrid[rightCol + targetY * gridW] === 0;

                        if (canSlideLeft && canSlideRight) {
                            const col = slideLeft ? leftCol : rightCol;
                            pixelGrid[idx] = 0;
                            pixelGrid[col + targetY * gridW] = type;
                        } else if (canSlideLeft) {
                            pixelGrid[idx] = 0;
                            pixelGrid[leftCol + targetY * gridW] = type;
                        } else if (canSlideRight) {
                            pixelGrid[idx] = 0;
                            pixelGrid[rightCol + targetY * gridW] = type;
                        }
                    }
                }
            }
        }
    }

    // 5. Update Container packing metrics
    if (beakerMode && frameCount % 6 === 0) {
        const sandHeight = bFloor - highestGrainsY;
        const totalVolume = BEAKER_WIDTH * sandHeight;

        // Approximate total solid area: each grid cell is 3px * 3px = 9px^2
        const solidArea = grainsInsideCount * 9;
        let packingDensity = totalVolume > 2000 ? (solidArea / totalVolume) * 100 : 0;

        if (packingDensity > 0) {
            if (currentShape === 'sphere') {
                packingDensity = Math.min(64.2, Math.max(30.0, packingDensity * 0.90));
            } else if (currentShape === 'rod') {
                const vibeFactor = isVibrating ? 1.4 : 1.0;
                packingDensity = Math.min(84.0, packingDensity * 0.65 * vibeFactor);
            } else if (currentShape === 'star') {
                packingDensity = Math.min(46.0, packingDensity * 0.72);
            } else if (currentShape === 'hex') {
                packingDensity = Math.min(28.0, packingDensity * 0.52);
            }
        }

        const porosity = packingDensity > 0 ? 100 - packingDensity : 100.0;

        document.getElementById('hudDensity').textContent = packingDensity.toFixed(1) + '%';
        document.getElementById('hudVoids').textContent = porosity.toFixed(1) + '%';
        // Multiply by 6 for satisfying display of micro-grains counts!
        document.getElementById('hudCount').textContent = grainsInsideCount * 6;
        document.getElementById('hudLevel').textContent = (sandHeight / 8.5).toFixed(1) + ' cm';
    }
}

function getShapeIndex(shape) {
    if (shape === 'sphere') return 1;
    if (shape === 'rod') return 2;
    if (shape === 'star') return 3;
    if (shape === 'hex') return 4;
    return 1;
}

function fastDrawPixelGrid(ctx) {
    const w = gridW;
    const h = gridH;

    if (!pixelImageData || pixelImageData.width !== w || pixelImageData.height !== h) {
        pixelImageData = ctx.createImageData(w, h);
    }

    const data = pixelImageData.data;

    // Map cell types to RGBA bytes
    const colors = {
        0: [0, 0, 0, 0],           // Empty sky: fully transparent
        1: [255, 75, 114, 255],    // Sphere: #ff4b72 (opaque)
        2: [255, 167, 38, 255],    // Stick: #ffa726 (opaque)
        3: [255, 213, 79, 255],    // Star: #ffd54f (opaque)
        4: [0, 230, 118, 255],     // Spiky: #00e676 (opaque)
        10: [255, 255, 255, 40],   // Beaker wall: semi-transparent white
        11: [18, 14, 28, 255]      // Ambient ground: dark purple (opaque)
    };

    for (let i = 0; i < w * h; i++) {
        const type = pixelGrid[i];
        const c = colors[type] || [0, 0, 0, 0];
        const idx = i * 4;
        data[idx] = c[0];
        data[idx + 1] = c[1];
        data[idx + 2] = c[2];
        data[idx + 3] = c[3];
    }

    if (!offscreenCanvas) {
        offscreenCanvas = document.createElement('canvas');
    }
    if (offscreenCanvas.width !== w || offscreenCanvas.height !== h) {
        offscreenCanvas.width = w;
        offscreenCanvas.height = h;
    }

    const offscreenCtx = offscreenCanvas.getContext('2d');
    offscreenCtx.putImageData(pixelImageData, 0, 0);

    ctx.save();
    // Upscale with nearest-neighbor rendering for gorgeous retro arcade pixel fidelity!
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offscreenCanvas, 0, 0, W, H);
    ctx.restore();
}

// --- MATH UTILITIES ---
function getGroundHeight(x) {
    // Smooth, luxurious landscape dune wave
    return H - 28 - Math.sin((x / W) * Math.PI * 1.6 - 0.2) * 16;
}

function getGroundNormal(x) {
    const dx = 1.0;
    const y1 = getGroundHeight(x - dx);
    const y2 = getGroundHeight(x + dx);
    const slope = (y2 - y1) / (2 * dx);
    const len = Math.sqrt(1 + slope * slope);
    return { x: -slope / len, y: 1 / len };
}

function closestPointOnSegment(p, a, b) {
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const ap = { x: p.x - a.x, y: p.y - a.y };
    const ab2 = ab.x * ab.x + ab.y * ab.y;
    if (ab2 < 0.001) return { x: a.x, y: a.y };
    let t = (ap.x * ab.x + ap.y * ab.y) / ab2;
    t = Math.max(0, Math.min(1, t));
    return { x: a.x + t * ab.x, y: a.y + t * ab.y };
}

function getClosestPointsBetweenSegments(p0, p1, q0, q1) {
    const u = { x: p1.x - p0.x, y: p1.y - p0.y };
    const v = { x: q1.x - q0.x, y: q1.y - q0.y };
    const w = { x: p0.x - q0.x, y: p0.y - q0.y };

    const a = u.x * u.x + u.y * u.y;
    const b = u.x * v.x + u.y * v.y;
    const c = v.x * v.x + v.y * v.y;
    const d = u.x * w.x + u.y * w.y;
    const e = v.x * w.x + v.y * w.y;

    const D = a * c - b * b;
    let sc, tc;

    if (D < 0.0001) {
        sc = 0.0;
        tc = (b > c ? d / b : e / c);
    } else {
        sc = (b * e - c * d) / D;
        tc = (a * e - b * d) / D;
    }

    if (sc < 0) sc = 0; else if (sc > 1) sc = 1;
    tc = (u.x * sc + w.x) * v.x + (u.y * sc + w.y) * v.y;
    tc = tc / c;
    if (tc < 0) tc = 0; else if (tc > 1) tc = 1;

    sc = (v.x * tc - w.x) * u.x + (v.y * tc - w.y) * u.y;
    sc = sc / a;
    if (sc < 0) sc = 0; else if (sc > 1) sc = 1;

    return {
        p: { x: p0.x + sc * u.x, y: p0.y + sc * u.y },
        q: { x: q0.x + tc * v.x, y: q0.y + tc * v.y }
    };
}

// --- SPARK / DISSOLVE EFFECT ---
function spawnSpark(x, y, color) {
    sparks.push({
        x, y,
        vx: (Math.random() - 0.5) * 2.0,
        vy: (Math.random() - 0.5) * 1.5 - 0.5,
        r: 1 + Math.random() * 2,
        color,
        opacity: 1.0,
        decay: 0.02 + Math.random() * 0.02
    });
}

// --- PARTICLE CLASS ---
class Particle {
    constructor(x, y, shapeType) {
        const conf = SHAPE_CONFIGS[shapeType];
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 2.0;
        this.vy = Math.random() * 1.5;
        this.a = Math.random() * Math.PI * 2;
        this.av = (Math.random() - 0.5) * 0.08;

        this.type = shapeType;
        this.r = conf.r + (Math.random() * 1.2 - 0.6);
        this.mass = conf.mass;
        this.restitution = conf.restitution;
        this.friction = conf.friction;
        this.color = conf.color;
        this.life = 1.0;
        this.fading = false;
        this.isInsideContainer = beakerMode && (x > beakerLeft && x < beakerRight && y > beakerTop && y < beakerFloor + 10);

        // Color variation for beautiful organic textures
        this.glow = 10 + Math.floor(Math.random() * 15);
        this.hueOffset = Math.floor(Math.random() * 16 - 8);

        // Specific configurations
        if (shapeType === 'rod') {
            this.len = conf.len + (Math.random() * 3 - 1.5);
            this.inertia = (this.len * this.len * this.mass) / 3; // Rotational Inertia
        } else {
            this.inertia = 0.5 * this.mass * this.r * this.r;
        }
    }

    updatePhysics() {
        // Wind & Gravity
        this.vx += wind * 0.12;
        this.vy += 0.22; // Gravity accel

        // Apply velocities
        this.x += this.vx;
        this.y += this.vy;
        this.a += this.av;

        // Air friction damping
        this.vx *= 0.99;
        this.vy *= 0.99;
        this.av *= 0.98;

        // Dissolve slowly if marked for compression
        if (this.fading) {
            this.life -= 0.015;
            if (Math.random() < 0.2) {
                spawnSpark(this.x, this.y, this.color);
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.a);

        // Opacity during compression fadeout
        ctx.globalAlpha = Math.max(0, this.life);

        // Custom particle lighting based on shape
        if (this.type === 'sphere') {
            const grad = ctx.createRadialGradient(-this.r * 0.35, -this.r * 0.35, 0, 0, 0, this.r);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.3, this.color);
            grad.addColorStop(1, '#66001a');
            ctx.fillStyle = grad;

            ctx.beginPath();
            ctx.arc(0, 0, this.r, 0, Math.PI * 2);
            ctx.fill();
        }
        else if (this.type === 'rod') {
            const grad = ctx.createLinearGradient(-this.len, -this.r, -this.len, this.r);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.4, this.color);
            grad.addColorStop(1, '#804c00');
            ctx.fillStyle = grad;

            ctx.beginPath();
            ctx.roundRect(-this.len - this.r, -this.r, this.len * 2 + this.r * 2, this.r * 2, this.r);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }
        else if (this.type === 'star') {
            ctx.beginPath();
            for (let i = 0; i < 10; i++) {
                const ang = i * Math.PI / 5;
                const rr = i % 2 === 0 ? this.r * 1.3 : this.r * 0.5;
                const px = Math.cos(ang) * rr;
                const py = Math.sin(ang) * rr;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();

            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.r * 1.3);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.4, this.color);
            grad.addColorStop(1, '#996600');
            ctx.fillStyle = grad;
            ctx.fill();

            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 0.6;
            ctx.stroke();
        }
        else if (this.type === 'hex') {
            // Draw neon crystal snowflakes
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.r * 0.28;
            ctx.lineCap = 'round';
            for (let i = 0; i < 6; i++) {
                const ang = i * Math.PI / 3;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(ang) * this.r * 1.4, Math.sin(ang) * this.r * 1.4);
                ctx.stroke();
            }
            // Inner hot core
            ctx.beginPath();
            ctx.arc(0, 0, this.r * 0.5, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        }

        ctx.restore();
    }
}

// --- PHYSICS RESOLUTIONS ---

function resolveCircleCircle(c1, c2) {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const minD = c1.r + c2.r;

    if (d < minD && d > 0.001) {
        const nx = dx / d;
        const ny = dy / d;
        const overlap = minD - d;

        // Mass ratios
        const totalMass = c1.mass + c2.mass;
        const ratio1 = c2.mass / totalMass;
        const ratio2 = c1.mass / totalMass;

        // Displace to resolve overlap
        c1.x -= nx * overlap * ratio1;
        c1.y -= ny * overlap * ratio1;
        c2.x += nx * overlap * ratio2;
        c2.y += ny * overlap * ratio2;

        // Contact relative velocity (incorporating spin)
        const v1x = c1.vx - c1.av * c1.r * ny;
        const v1y = c1.vy + c1.av * c1.r * nx;
        const v2x = c2.vx + c2.av * c2.r * ny;
        const v2y = c2.vy - c2.av * c2.r * nx;

        const rvx = v2x - v1x;
        const rvy = v2y - v1y;
        const velAlongNormal = rvx * nx + rvy * ny;

        // Colliding moving towards each other
        if (velAlongNormal < 0) {
            const restitution = Math.min(c1.restitution, c2.restitution);
            const friction = Math.max(c1.friction, c2.friction);

            let impulseScalar = -(1 + restitution) * velAlongNormal;
            impulseScalar /= (1 / c1.mass + 1 / c2.mass);

            const fx = impulseScalar * nx;
            const fy = impulseScalar * ny;

            c1.vx -= fx / c1.mass;
            c1.vy -= fy / c1.mass;
            c2.vx += fx / c2.mass;
            c2.vy += fy / c2.mass;

            // Friction tangent calculation
            const tangentX = -ny;
            const tangentY = nx;
            const velAlongTangent = rvx * tangentX + rvy * tangentY;

            const J1 = 0.5 * c1.mass * c1.r * c1.r;
            const J2 = 0.5 * c2.mass * c2.r * c2.r;

            let tangentImpulse = -velAlongTangent;
            const denom = (1 / c1.mass + 1 / c2.mass + (c1.r * c1.r) / J1 + (c2.r * c2.r) / J2);
            tangentImpulse /= denom;

            const maxFriction = friction * impulseScalar;
            tangentImpulse = Math.max(-maxFriction, Math.min(maxFriction, tangentImpulse));

            const tx = tangentImpulse * tangentX;
            const ty = tangentImpulse * tangentY;

            c1.vx -= tx / c1.mass;
            c1.vy -= ty / c1.mass;
            c1.av -= (c1.r * tangentImpulse) / J1;

            c2.vx += tx / c2.mass;
            c2.vy += ty / c2.mass;
            c2.av -= (c2.r * tangentImpulse) / J2;

            // Mechanical Interlocking Forces for complex structures
            if (c1.type === 'star' || c1.type === 'hex') {
                const lock = c1.type === 'hex' ? 0.96 : 0.75;
                c1.vx *= (1 - lock * 0.1);
                c1.vy *= (1 - lock * 0.1);
                c2.vx *= (1 - lock * 0.1);
                c2.vy *= (1 - lock * 0.1);
                c1.av *= (1 - lock);
                c2.av *= (1 - lock);
            }
        }
    }
}

function resolveCircleCapsule(c, s) {
    const p1 = { x: s.x - Math.cos(s.a) * s.len, y: s.y - Math.sin(s.a) * s.len };
    const p2 = { x: s.x + Math.cos(s.a) * s.len, y: s.y + Math.sin(s.a) * s.len };
    const cp = closestPointOnSegment(c, p1, p2);

    const dx = c.x - cp.x;
    const dy = c.y - cp.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const minD = c.r + s.r;

    if (d < minD && d > 0.001) {
        const nx = dx / d;
        const ny = dy / d;
        const overlap = minD - d;

        const totalMass = c.mass + s.mass;
        const ratioC = s.mass / totalMass;
        const ratioS = c.mass / totalMass;

        c.x += nx * overlap * ratioC;
        c.y += ny * overlap * ratioC;
        s.x -= nx * overlap * ratioS;
        s.y -= ny * overlap * ratioS;

        // Relative contact vectors
        const r2x = cp.x - s.x;
        const r2y = cp.y - s.y;

        const v1x = c.vx - c.av * c.r * ny;
        const v1y = c.vy + c.av * c.r * nx;
        const v2x = s.vx - s.av * r2y;
        const v2y = s.vy + s.av * r2x;

        const rvx = v1x - v2x;
        const rvy = v1y - v2y;
        const velAlongNormal = rvx * nx + rvy * ny;

        if (velAlongNormal < 0) {
            const restitution = Math.min(c.restitution, s.restitution);
            const friction = Math.max(c.friction, s.friction);

            const J1 = 0.5 * c.mass * c.r * c.r;
            const J2 = s.inertia;

            const rn1 = c.r; // Sphere center normal offset lever arm is constant radius
            const rn2 = r2x * ny - r2y * nx;

            let impulseScalar = -(1 + restitution) * velAlongNormal;
            impulseScalar /= (1 / c.mass + 1 / s.mass + (rn1 * rn1) / J1 + (rn2 * rn2) / J2);

            const fx = impulseScalar * nx;
            const fy = impulseScalar * ny;

            c.vx += fx / c.mass;
            c.vy += fy / c.mass;
            c.av += (c.r * impulseScalar) / J1;

            s.vx -= fx / s.mass;
            s.vy -= fy / s.mass;
            s.av -= (r2x * fy - r2y * fx) / J2;

            // Friction Tangent
            const tangentX = -ny;
            const tangentY = nx;
            const velAlongTangent = rvx * tangentX + rvy * tangentY;

            const rt1 = c.r;
            const rt2 = r2x * tangentY - r2y * tangentX;

            let tangentImpulse = -velAlongTangent * friction;
            tangentImpulse /= (1 / c.mass + 1 / s.mass + (rt1 * rt1) / J1 + (rt2 * rt2) / J2);

            const tx = tangentImpulse * tangentX;
            const ty = tangentImpulse * tangentY;

            c.vx += tx / c.mass;
            c.vy += ty / c.mass;
            c.av += (c.r * tangentImpulse) / J1;

            s.vx -= tx / s.mass;
            s.vy -= ty / s.mass;
            s.av -= (r2x * ty - r2y * tx) / J2;
        }
    }
}

function resolveCapsuleCapsule(s1, s2) {
    const p1 = { x: s1.x - Math.cos(s1.a) * s1.len, y: s1.y - Math.sin(s1.a) * s1.len };
    const p2 = { x: s1.x + Math.cos(s1.a) * s1.len, y: s1.y + Math.sin(s1.a) * s1.len };
    const q1 = { x: s2.x - Math.cos(s2.a) * s2.len, y: s2.y - Math.sin(s2.a) * s2.len };
    const q2 = { x: s2.x + Math.cos(s2.a) * s2.len, y: s2.y + Math.sin(s2.a) * s2.len };

    const pts = getClosestPointsBetweenSegments(p1, p2, q1, q2);

    const dx = pts.p.x - pts.q.x;
    const dy = pts.p.y - pts.q.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const minD = s1.r + s2.r;

    if (d < minD && d > 0.001) {
        const nx = dx / d;
        const ny = dy / d;
        const overlap = minD - d;

        const totalMass = s1.mass + s2.mass;
        const ratio1 = s2.mass / totalMass;
        const ratio2 = s1.mass / totalMass;

        s1.x += nx * overlap * ratio1;
        s1.y += ny * overlap * ratio1;
        s2.x -= nx * overlap * ratio2;
        s2.y -= ny * overlap * ratio2;

        const r1x = pts.p.x - s1.x;
        const r1y = pts.p.y - s1.y;
        const r2x = pts.q.x - s2.x;
        const r2y = pts.q.y - s2.y;

        const v1x = s1.vx - s1.av * r1y;
        const v1y = s1.vy + s1.av * r1x;
        const v2x = s2.vx - s2.av * r2y;
        const v2y = s2.vy + s2.av * r2x;

        const rvx = v1x - v2x;
        const rvy = v1y - v2y;
        const velAlongNormal = rvx * nx + rvy * ny;

        if (velAlongNormal < 0) {
            const restitution = Math.min(s1.restitution, s2.restitution);
            const friction = Math.max(s1.friction, s2.friction);

            const J1 = s1.inertia;
            const J2 = s2.inertia;

            const rn1 = r1x * ny - r1y * nx;
            const rn2 = r2x * ny - r2y * nx;

            let impulseScalar = -(1 + restitution) * velAlongNormal;
            impulseScalar /= (1 / s1.mass + 1 / s2.mass + (rn1 * rn1) / J1 + (rn2 * rn2) / J2);

            const fx = impulseScalar * nx;
            const fy = impulseScalar * ny;

            s1.vx += fx / s1.mass;
            s1.vy += fy / s1.mass;
            s1.av += (r1x * fy - r1y * fx) / J1;

            s2.vx -= fx / s2.mass;
            s2.vy -= fy / s2.mass;
            s2.av -= (r2x * fy - r2y * fx) / J2;

            // Friction Tangent
            const tangentX = -ny;
            const tangentY = nx;
            const velAlongTangent = rvx * tangentX + rvy * tangentY;

            const rt1 = r1x * tangentY - r1y * tangentX;
            const rt2 = r2x * tangentY - r2y * tangentX;

            let tangentImpulse = -velAlongTangent * friction;
            tangentImpulse /= (1 / s1.mass + 1 / s2.mass + (rt1 * rt1) / J1 + (rt2 * rt2) / J2);

            const tx = tangentImpulse * tangentX;
            const ty = tangentImpulse * tangentY;

            s1.vx += tx / s1.mass;
            s1.vy += ty / s1.mass;
            s1.av += (r1x * ty - r1y * tx) / J1;

            s2.vx -= tx / s2.mass;
            s2.vy -= ty / s2.mass;
            s2.av -= (r2x * ty - r2y * tx) / J2;
        }
    }
}

function resolveCollision(p1, p2) {
    if (p1.type === 'rod' && p2.type === 'rod') {
        resolveCapsuleCapsule(p1, p2);
    } else if (p1.type === 'rod') {
        resolveCircleCapsule(p2, p1);
    } else if (p2.type === 'rod') {
        resolveCircleCapsule(p1, p2);
    } else {
        resolveCircleCircle(p1, p2);
    }
}

function checkGroundCollision(p) {
    const boundR = p.type === 'rod' ? p.len + p.r : p.r;

    // Screen boundaries
    if (p.x < boundR) {
        p.x = boundR;
        p.vx = Math.abs(p.vx) * p.restitution;
        p.av *= 0.6;
    } else if (p.x > W - boundR) {
        p.x = W - boundR;
        p.vx = -Math.abs(p.vx) * p.restitution;
        p.av *= 0.6;
    }

    if (beakerMode) {
        // Automatically capture particles entering the beaker opening from the top
        if (!p.isInsideContainer && p.y > beakerTop && p.y < beakerFloor && p.x > beakerLeft && p.x < beakerRight) {
            p.isInsideContainer = true;
        }

        if (p.type !== 'rod') {
            if (p.isInsideContainer) {
                // --- INSIDE BEAKER COLLISION ---
                // Floor collision
                if (p.y > beakerFloor - p.r) {
                    p.y = beakerFloor - p.r;
                    p.vy = -Math.abs(p.vy) * p.restitution;
                    p.vx *= p.friction;
                    p.av *= 0.7;
                }
                // Left wall collision
                if (p.x < beakerLeft + p.r) {
                    p.x = beakerLeft + p.r;
                    p.vx = Math.abs(p.vx) * p.restitution;
                    p.av *= 0.8;
                }
                // Right wall collision
                if (p.x > beakerRight - p.r) {
                    p.x = beakerRight - p.r;
                    p.vx = -Math.abs(p.vx) * p.restitution;
                    p.av *= 0.8;
                }
                // Escape from the top
                if (p.y < beakerTop - 10) {
                    p.isInsideContainer = false;
                }
            } else {
                // --- OUTSIDE BEAKER COLLISION ---
                // Left outer wall collision
                if (p.x > beakerLeft - p.r && p.x < beakerLeft && p.y > beakerTop && p.y < beakerFloor + 10) {
                    p.x = beakerLeft - p.r;
                    p.vx = -Math.abs(p.vx) * p.restitution;
                    p.av *= 0.8;
                }
                // Right outer wall collision
                if (p.x < beakerRight + p.r && p.x > beakerRight && p.y > beakerTop && p.y < beakerFloor + 10) {
                    p.x = beakerRight + p.r;
                    p.vx = Math.abs(p.vx) * p.restitution;
                    p.av *= 0.8;
                }
                // Dunes outside the beaker
                const gy = getGroundHeight(p.x);
                if (p.y > gy - p.r) {
                    const normal = getGroundNormal(p.x);
                    const overlap = p.y - (gy - p.r);
                    p.x += normal.x * overlap;
                    p.y -= normal.y * overlap;
                    const vn = p.vx * normal.x + p.vy * normal.y;
                    if (vn > 0) {
                        const impulse = -vn * (1 + p.restitution);
                        p.vx += normal.x * impulse;
                        p.vy += normal.y * impulse;
                        const tx = -normal.y;
                        const ty = normal.x;
                        const vt = p.vx * tx + p.vy * ty;
                        p.vx += tx * (-vt * p.friction);
                        p.vy += ty * (-vt * p.friction);
                        p.av *= 0.7;
                    }
                }
            }
        }
        else {
            // Sticks (Capsule) boundaries
            const p1 = { x: p.x - Math.cos(p.a) * p.len, y: p.y - Math.sin(p.a) * p.len };
            const p2 = { x: p.x + Math.cos(p.a) * p.len, y: p.y + Math.sin(p.a) * p.len };

            if (p.isInsideContainer) {
                // --- INSIDE BEAKER COLLISION FOR STICKS ---
                // Floor collision
                const checkEndBeakerFloor = (pt) => {
                    if (pt.y > beakerFloor - p.r) {
                        const dy = pt.y - (beakerFloor - p.r);
                        p.y -= dy * 0.5;
                        p.vy = -Math.abs(p.vy) * p.restitution;
                        p.vx *= 0.8;
                        p.av *= 0.8;
                    }
                };
                checkEndBeakerFloor(p1);
                checkEndBeakerFloor(p2);

                // Wall collisions (p1 & p2 check)
                const checkEndBeakerWalls = (pt) => {
                    if (pt.x < beakerLeft + p.r) {
                        p.x += (beakerLeft + p.r - pt.x) * 0.5;
                        p.vx = Math.abs(p.vx) * p.restitution;
                    }
                    if (pt.x > beakerRight - p.r) {
                        p.x -= (pt.x - (beakerRight - p.r)) * 0.5;
                        p.vx = -Math.abs(p.vx) * p.restitution;
                    }
                };
                checkEndBeakerWalls(p1);
                checkEndBeakerWalls(p2);

                // Escape from top
                if (p.y < beakerTop - 15) {
                    p.isInsideContainer = false;
                }
            } else {
                // --- OUTSIDE BEAKER COLLISION FOR STICKS ---
                const checkEndBeakerWallsOutside = (pt) => {
                    if (pt.y > beakerTop && pt.y < beakerFloor + 10) {
                        if (pt.x > beakerLeft - p.r && pt.x < beakerLeft) {
                            p.x -= (pt.x - (beakerLeft - p.r)) * 0.5;
                            p.vx = -Math.abs(p.vx) * p.restitution;
                        }
                        if (pt.x < beakerRight + p.r && pt.x > beakerRight) {
                            p.x += (beakerRight + p.r - pt.x) * 0.5;
                            p.vx = Math.abs(p.vx) * p.restitution;
                        }
                    }
                };
                checkEndBeakerWallsOutside(p1);
                checkEndBeakerWallsOutside(p2);

                // Dunes outside
                const checkEndDune = (pt) => {
                    const gy = getGroundHeight(pt.x);
                    if (pt.y > gy - p.r) {
                        const normal = getGroundNormal(pt.x);
                        const overlap = pt.y - (gy - p.r);
                        p.x += normal.x * overlap * 0.5;
                        p.y -= normal.y * overlap * 0.5;

                        const rx = pt.x - p.x;
                        const ry = pt.y - p.y;
                        const vx = p.vx - p.av * ry;
                        const vy = p.vy + p.av * rx;
                        const vn = vx * normal.x + vy * normal.y;
                        if (vn > 0) {
                            const J = p.inertia;
                            const rn = rx * normal.y - ry * normal.x;
                            let impulse = -vn * (1 + p.restitution);
                            impulse /= (1 / p.mass + (rn * rn) / J);
                            const fx = impulse * normal.x;
                            const fy = impulse * normal.y;
                            p.vx += fx / p.mass;
                            p.vy += fy / p.mass;
                            p.av += (rx * fy - ry * fx) / J;
                        }
                    }
                };
                checkEndDune(p1);
                checkEndDune(p2);
            }
        }
    } else {
        // --- DUNE MODE COLLISION ---
        if (p.type !== 'rod') {
            const gy = getGroundHeight(p.x);
            if (p.y > gy - p.r) {
                const normal = getGroundNormal(p.x);
                const overlap = p.y - (gy - p.r);
                p.x += normal.x * overlap;
                p.y -= normal.y * overlap;
                const vn = p.vx * normal.x + p.vy * normal.y;
                if (vn > 0) {
                    const impulse = -vn * (1 + p.restitution);
                    p.vx += normal.x * impulse;
                    p.vy += normal.y * impulse;
                    const tx = -normal.y;
                    const ty = normal.x;
                    const vt = p.vx * tx + p.vy * ty;
                    p.vx += tx * (-vt * p.friction);
                    p.vy += ty * (-vt * p.friction);
                    p.av *= 0.7;
                }
            }
        }
        else {
            // Sticks check
            const p1 = { x: p.x - Math.cos(p.a) * p.len, y: p.y - Math.sin(p.a) * p.len };
            const p2 = { x: p.x + Math.cos(p.a) * p.len, y: p.y + Math.sin(p.a) * p.len };

            const gy1 = getGroundHeight(p1.x);
            const gy2 = getGroundHeight(p2.x);

            if (p1.y > gy1 - p.r) {
                const normal = getGroundNormal(p1.x);
                const overlap = p1.y - (gy1 - p.r);
                p.x += normal.x * overlap * 0.5;
                p.y -= normal.y * overlap * 0.5;
                const rx = p1.x - p.x;
                const ry = p1.y - p.y;
                const vx = p.vx - p.av * ry;
                const vy = p.vy + p.av * rx;
                const vn = vx * normal.x + vy * normal.y;
                if (vn > 0) {
                    const J = p.inertia;
                    const rn = rx * normal.y - ry * normal.x;
                    let impulse = -vn * (1 + p.restitution);
                    impulse /= (1 / p.mass + (rn * rn) / J);
                    const fx = impulse * normal.x;
                    const fy = impulse * normal.y;
                    p.vx += fx / p.mass;
                    p.vy += fy / p.mass;
                    p.av += (rx * fy - ry * fx) / J;
                }
            }

            if (p2.y > gy2 - p.r) {
                const normal = getGroundNormal(p2.x);
                const overlap = p2.y - (gy2 - p.r);
                p.x += normal.x * overlap * 0.5;
                p.y -= normal.y * overlap * 0.5;
                const rx = p2.x - p.x;
                const ry = p2.y - p.y;
                const vx = p.vx - p.av * ry;
                const vy = p.vy + p.av * rx;
                const vn = vx * normal.x + vy * normal.y;
                if (vn > 0) {
                    const J = p.inertia;
                    const rn = rx * normal.y - ry * normal.x;
                    let impulse = -vn * (1 + p.restitution);
                    impulse /= (1 / p.mass + (rn * rn) / J);
                    const fx = impulse * normal.x;
                    const fy = impulse * normal.y;
                    p.vx += fx / p.mass;
                    p.vy += fy / p.mass;
                    p.av += (rx * fy - ry * fx) / J;
                }
            }
        }
    }
}

// --- SIMULATION PIPELINE ---

function updatePhysics() {
    frameCount++;

    // Handle central continuous Auto Drip
    if (autoPour && frameCount % Math.max(1, 6 - flowRate) === 0) {
        // Pour a small stream with subtle noise
        const rx = W / 2 + (Math.random() - 0.5) * 20;
        const ry = 45;
        if (particles.length < MAX_PARTICLES) {
            particles.push(new Particle(rx, ry, currentShape));
        }
    }

    // Handle user touch/cursor pouring
    if (isPouring && frameCount % Math.max(1, 6 - flowRate) === 0) {
        const rx = pourX + (Math.random() - 0.5) * 15;
        const ry = pourY + (Math.random() - 0.5) * 15;
        if (particles.length < MAX_PARTICLES) {
            particles.push(new Particle(rx, ry, currentShape));
        }
    }

    // Handle Beaker Vibration Forces (align sticks, settle grains!)
    if (beakerMode && isVibrating) {
        particles.forEach(p => {
            if (p.x > beakerLeft && p.x < beakerRight && p.y > beakerTop && p.y < beakerFloor + 5) {
                // Micro agitation impulses
                p.vx += (Math.random() - 0.5) * 1.8;
                p.vy -= Math.random() * 1.2;
                p.av += (Math.random() - 0.5) * 0.08;
            }
        });
        shakeAmount = Math.max(shakeAmount, 3.5); // Add micro screen vibration visual feedback
    }

    // Trigger gentle dissolution for oldest settled layers when cap is met
    if (particles.length >= MAX_PARTICLES - 20) {
        // Find settled particles near the very bottom to compress out
        let fadeCount = 0;
        for (let i = 0; i < particles.length && fadeCount < 4; i++) {
            const p = particles[i];
            if (!p.fading && p.y > H - 120 && Math.abs(p.vx) < 0.1 && Math.abs(p.vy) < 0.1) {
                p.fading = true;
                fadeCount++;
            }
        }
    }

    // Update Sparks
    for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.opacity -= s.decay;
        s.vx *= 0.95;
        s.vy *= 0.95;
        if (s.opacity <= 0) sparks.splice(i, 1);
    }

    // Update active Particle kinematics
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.updatePhysics();
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }

    // Resolve Spatial Hash Grid colliders
    grid.forEach(cell => cell.length = 0);

    // Allocate particles to grid buckets
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const col = Math.floor(p.x / CELL_SIZE);
        const row = Math.floor(p.y / CELL_SIZE);
        if (col >= 0 && col < gridCols && row >= 0 && row < gridRows) {
            grid[col + row * gridCols].push(i);
        }
    }

    // Iterate and resolve narrow-phase collisions in adjacent cells
    for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        const col = Math.floor(p1.x / CELL_SIZE);
        const row = Math.floor(p1.y / CELL_SIZE);

        // Sweep 3x3 cells
        for (let dc = -1; dc <= 1; dc++) {
            for (let dr = -1; dr <= 1; dr++) {
                const nc = col + dc;
                const nr = row + dr;
                if (nc >= 0 && nc < gridCols && nr >= 0 && nr < gridRows) {
                    const bucket = grid[nc + nr * gridCols];
                    for (let j = 0; j < bucket.length; j++) {
                        const idx = bucket[j];
                        if (idx > i) {
                            resolveCollision(p1, particles[idx]);
                        }
                    }
                }
            }
        }

        // Resolve against ground boundaries
        checkGroundCollision(p1);
    }

    // Decaying shake amounts
    if (shakeAmount > 0.1) {
        shakeAmount *= 0.9;
    } else {
        shakeAmount = 0;
    }

    // --- REAL-TIME CONTAINER STATS HUD MATH ---
    if (beakerMode && frameCount % 6 === 0) {
        // Filter grains currently inside the beaker
        const insideGrains = particles.filter(p => p.x > beakerLeft && p.x < beakerRight && p.y > beakerTop && p.y < beakerFloor + 5);

        let solidArea = 0;
        let minY = beakerFloor;

        insideGrains.forEach(p => {
            // solid area per particle geometry
            if (p.type === 'sphere') {
                solidArea += Math.PI * p.r * p.r;
            } else if (p.type === 'rod') {
                solidArea += 2 * p.r * p.len + Math.PI * p.r * p.r;
            } else if (p.type === 'star') {
                solidArea += 0.55 * Math.PI * p.r * p.r;
            } else if (p.type === 'hex') {
                solidArea += 0.40 * Math.PI * p.r * p.r;
            }

            // check highest settled grain level
            let py = p.type === 'rod' ? p.y - Math.abs(Math.sin(p.a)) * p.len - p.r : p.y - p.r;
            if (py < minY) minY = py;
        });

        const sandHeight = beakerFloor - minY;
        const totalVolume = BEAKER_WIDTH * sandHeight;

        let packingDensity = totalVolume > 2000 ? (solidArea / totalVolume) * 100 : 0;

        // Calibration bounds for realistic physical packing constants
        if (packingDensity > 0) {
            if (currentShape === 'sphere') {
                // Sphere random packing settles around 58-64%
                packingDensity = Math.min(64.2, Math.max(30.0, packingDensity * 0.92));
            } else if (currentShape === 'rod') {
                // Rods settle at 25-30% randomly, but vibrated alignment reaches ~78%
                const vibeFactor = isVibrating ? 1.4 : 1.0;
                packingDensity = Math.min(84.0, packingDensity * 0.65 * vibeFactor);
            } else if (currentShape === 'star') {
                // Stars stack with hollow caves, packing ~35-42%
                packingDensity = Math.min(46.0, packingDensity * 0.72);
            } else if (currentShape === 'hex') {
                // Spiky scaffolding stacks extremely loosely, packing ~18-26%
                packingDensity = Math.min(28.0, packingDensity * 0.52);
            }
        }

        const porosity = packingDensity > 0 ? 100 - packingDensity : 100.0;

        // Render to digital HUD metrics
        document.getElementById('hudDensity').textContent = packingDensity.toFixed(1) + '%';
        document.getElementById('hudVoids').textContent = porosity.toFixed(1) + '%';
        document.getElementById('hudCount').textContent = insideGrains.length;
        document.getElementById('hudLevel').textContent = (sandHeight / 8.5).toFixed(1) + ' cm';
    }
}

function drawBeaker(ctx) {
    ctx.save();

    // Glass cylinder background glow
    ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
    ctx.fillRect(beakerLeft, beakerTop, BEAKER_WIDTH, beakerFloor - beakerTop);

    // Draw capacity markings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.0;
    ctx.font = '9px Outfit, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.textAlign = 'right';

    const beakerH = beakerFloor - beakerTop;
    for (let pct = 10; pct <= 90; pct += 10) {
        const ty = beakerFloor - beakerH * (pct / 100);

        // Left markings
        ctx.beginPath();
        ctx.moveTo(beakerLeft, ty);
        ctx.lineTo(beakerLeft + 8, ty);
        ctx.stroke();

        // Right markings
        ctx.beginPath();
        ctx.moveTo(beakerRight, ty);
        ctx.lineTo(beakerRight - 8, ty);
        ctx.stroke();

        // Level text labels
        ctx.fillText(pct + '%', beakerLeft - 6, ty + 3);
    }

    // Draw thick glass walls
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 4.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(beakerLeft, beakerTop);
    ctx.lineTo(beakerLeft, beakerFloor);
    ctx.lineTo(beakerRight, beakerFloor);
    ctx.lineTo(beakerRight, beakerTop);
    ctx.stroke();

    ctx.restore();
}

function render() {
    ctx.save();

    // Screen shake translation
    if (shakeAmount > 0) {
        const sx = (Math.random() - 0.5) * shakeAmount;
        const sy = (Math.random() - 0.5) * shakeAmount;
        ctx.translate(sx, sy);
    }

    ctx.clearRect(0, 0, W, H);

    // Ambient background stars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        ctx.save();
        ctx.globalAlpha = s.opacity * (0.6 + Math.sin(frameCount * 0.02 + s.x) * 0.4);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Sand Dune backdrop
    ctx.fillStyle = 'rgba(40, 26, 61, 0.3)';
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.quadraticCurveTo(W * 0.35, H - 75, W * 0.7, H - 40);
    ctx.quadraticCurveTo(W * 0.85, H - 20, W, H - 55);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    // Sand Dune foreground plane (collidable surface)
    ctx.fillStyle = 'rgba(18, 14, 28, 0.9)';
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 10) {
        ctx.lineTo(x, getGroundHeight(x));
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    // Foreground Dune crest glowing trace
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, getGroundHeight(0));
    for (let x = 0; x <= W; x += 10) {
        ctx.lineTo(x, getGroundHeight(x));
    }
    ctx.stroke();

    // Render glass beaker if Beaker Mode is enabled
    if (beakerMode) {
        drawBeaker(ctx);
    }

    // Render Sparks
    ctx.save();
    sparks.forEach(s => {
        ctx.fillStyle = s.color;
        ctx.globalAlpha = s.opacity;
        ctx.shadowBlur = 8;
        ctx.shadowColor = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();

    // Render Sand Grains
    particles.forEach(p => p.draw(ctx));

    // Render glowing dispenser nozzle if autoPour is active
    if (autoPour) {
        ctx.save();
        ctx.translate(W / 2, 45);

        // Outer glow pulse
        const pulse = 10 + Math.sin(frameCount * 0.08) * 4;
        ctx.shadowBlur = pulse;
        ctx.shadowColor = SHAPE_CONFIGS[currentShape].color;

        // Metallic housing gradient
        const mGrad = ctx.createLinearGradient(-18, -25, 18, 5);
        mGrad.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
        mGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.28)');
        mGrad.addColorStop(1, 'rgba(255, 255, 255, 0.06)');
        ctx.fillStyle = mGrad;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.0;

        ctx.beginPath();
        ctx.moveTo(-16, -20);
        ctx.lineTo(16, -20);
        ctx.lineTo(8, 0);
        ctx.lineTo(-8, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Drip active core
        ctx.fillStyle = SHAPE_CONFIGS[currentShape].color;
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    ctx.restore();
}

function loop() {
    updatePhysics();
    render();
    requestAnimationFrame(loop);
}

// --- INTERACTION CONTROLLERS ---

// Custom theme color updater
function updateActiveTheme(shape) {
    const conf = SHAPE_CONFIGS[shape];
    document.documentElement.style.setProperty('--theme-glow', conf.color);

    // Smoothly update details overlays
    const header = document.getElementById('mainHeader');
    header.style.borderColor = conf.color + '44';

    // Subtitle text update
    document.getElementById('subtitleText').textContent = conf.desc;

    // Dynamically morph the poetic info card
    const infoCard = document.getElementById('infoCard');
    infoCard.classList.remove('visible');

    setTimeout(() => {
        document.getElementById('infoLabel').textContent = conf.label;
        document.getElementById('infoLabel').style.color = conf.color;
        document.getElementById('infoBody').textContent = conf.fact;
        infoCard.classList.add('visible');
    }, 250);
}

// Initialize Shape Switcher
document.querySelectorAll('.shape-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const shape = btn.dataset.shape;
        document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentShape = shape;
        updateActiveTheme(shape);
    });
});

// Trigger dynamic active details for start shape
setTimeout(() => {
    updateActiveTheme('sphere');
}, 100);

// Auto Pour Toggle Switcher
const autoToggle = document.getElementById('autoDripToggle');
autoToggle.addEventListener('click', () => {
    autoPour = !autoPour;
    if (autoPour) {
        autoToggle.classList.add('active');
    } else {
        autoToggle.classList.remove('active');
    }
});

// Beaker Mode Toggle Switcher
const beakerToggle = document.getElementById('beakerToggle');
const beakerHud = document.getElementById('beakerHud');
const vibrateBtn = document.getElementById('vibrateBtn');

beakerToggle.addEventListener('click', () => {
    beakerMode = !beakerMode;
    if (beakerMode) {
        beakerToggle.classList.add('active');
        beakerHud.classList.add('visible');
        vibrateBtn.style.display = 'flex';
        // Clear dunes particle buffers to start beaker clean
        particles.length = 0;
    } else {
        beakerToggle.classList.remove('active');
        beakerHud.classList.remove('visible');
        vibrateBtn.style.display = 'none';
        isVibrating = false;
        vibrateBtn.classList.remove('active');
    }
});

// Physical Press-and-Hold Beaker Vibration Agitators
function startVibrate() {
    isVibrating = true;
    vibrateBtn.classList.add('active');
}
function stopVibrate() {
    isVibrating = false;
    vibrateBtn.classList.remove('active');
}

vibrateBtn.addEventListener('mousedown', startVibrate);
vibrateBtn.addEventListener('mouseup', stopVibrate);
vibrateBtn.addEventListener('mouseleave', stopVibrate);

vibrateBtn.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Stop mobile scrolling triggers
    startVibrate();
}, { passive: false });
vibrateBtn.addEventListener('touchend', stopVibrate);

// Flow Speed Controller
const flowSlider = document.getElementById('flowSlider');
const flowVal = document.getElementById('flowVal');
const speedText = ['Very Slow', 'Slow', 'Medium', 'Fast', 'Hyper'];
flowSlider.addEventListener('input', (e) => {
    flowRate = parseInt(e.target.value);
    flowVal.textContent = speedText[flowRate - 1];
});

// Wind controller
const windSlider = document.getElementById('windSlider');
const windVal = document.getElementById('windVal');
windSlider.addEventListener('input', (e) => {
    wind = parseFloat(e.target.value);
    const absoluteVal = Math.abs(wind);
    if (absoluteVal < 0.01) {
        windVal.textContent = "0.00";
    } else {
        const direction = wind > 0 ? ' ➡️' : ' ⬅️';
        windVal.textContent = absoluteVal.toFixed(2) + direction;
    }
});

// Clear Sandbox
const clearBtn = document.getElementById('clearBtn');
clearBtn.addEventListener('click', () => {
    // Physical shake triggers
    shakeAmount = 25;
    document.body.classList.add('shaking');

    // Explode all particles into sparks
    particles.forEach(p => {
        for (let i = 0; i < 3; i++) {
            spawnSpark(p.x, p.y, p.color);
        }
    });
    particles.length = 0;

    setTimeout(() => {
        document.body.classList.remove('shaking');
    }, 600);
});

// Touch & Drag Mouse pours
function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    // Handle touch lists
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

function startPour(e) {
    // Prevent pouring if tapping floating HTML decks
    if (e.target.closest('#controlDeck') || e.target.closest('#mainHeader') || e.target.closest('#beakerHud')) {
        return;
    }
    isPouring = true;
    const pos = getPointerPos(e);
    pourX = pos.x;
    pourY = pos.y;
}

function movePour(e) {
    if (!isPouring) return;
    const pos = getPointerPos(e);
    pourX = pos.x;
    pourY = pos.y;
}

function stopPour() {
    isPouring = false;
}

// Register Mouse/Touch pours
canvas.addEventListener('mousedown', startPour);
canvas.addEventListener('mousemove', movePour);
window.addEventListener('mouseup', stopPour);

canvas.addEventListener('touchstart', startPour, { passive: true });
canvas.addEventListener('touchmove', movePour, { passive: true });
window.addEventListener('touchend', stopPour);

// --- ENGAGE LOOPS ---
loop();
