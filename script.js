/* ============================================================
   UTILITIES
   ============================================================ */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

function mulberry32(seed) {
    return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/* ============================================================
   NAV
   ============================================================ */
$('#navPlayBtn').addEventListener('click', () => $('#play').scrollIntoView({ behavior: 'smooth' }));
$('#startStoryBtn').addEventListener('click', () => $('#story').scrollIntoView({ behavior: 'smooth' }));

/* ============================================================
   AMBIENT BACKGROUND — soft floating bubbles (kept gentle & simple)
   ============================================================ */
(function bg() {
    const canvas = $('#bg-canvas');
    const ctx = canvas.getContext('2d');
    const rand = mulberry32(3);
    let w, h, bubbles = [];
    const colors = ['#FFC94A', '#59C48F', '#59C48F', '#9B8CF2', '#4E9BD6'];

    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
        const count = Math.max(14, Math.floor((w * h) / 90000));
        bubbles = Array.from({ length: count }, () => ({
            x: rand() * w,
            y: rand() * h,
            r: rand() * 16 + 6,
            speed: rand() * 0.25 + 0.08,
            drift: (rand() - 0.5) * 0.3,
            color: colors[Math.floor(rand() * colors.length)],
            alpha: rand() * 0.12 + 0.05
        }));
    }
    window.addEventListener('resize', resize);
    resize();

    function step() {
        ctx.clearRect(0, 0, w, h);
        bubbles.forEach(b => {
            b.y -= b.speed;
            b.x += b.drift;
            if (b.y < -30) { b.y = h + 30; b.x = rand() * w; }
            if (b.x < -30) b.x = w + 30;
            if (b.x > w + 30) b.x = -30;
            ctx.beginPath();
            ctx.fillStyle = b.color;
            ctx.globalAlpha = b.alpha;
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
        requestAnimationFrame(step);
    }
    step();
})();

/* ============================================================
   REAL PHOTO SOURCE
   One real, freely-licensed wide panorama photograph. Every
   "photo" on this page — hero cards, story steps, playground —
   is really just a different crop of this ONE picture. That's
   what makes lining pieces up always look right, and it means
   everything you see is an actual photograph, not a drawing.
   Source: "North Walls of Ani, Turkey" by Ggia, Wikimedia
   Commons, CC BY-SA 3.0.
   ============================================================ */
const PANO_REF_W = 1600;
const PANO_URL = 'https://commons.wikimedia.org/wiki/Special:FilePath/20110419_Ani_North_Walls_Turkey_Panorama.jpg?width=' + PANO_REF_W;
const panoramaImg = new Image();
let panoramaReady = false;
panoramaImg.onload = () => { panoramaReady = true; try { drawStory(storyPos); drawPlayground(); } catch (e) { } };
panoramaImg.src = PANO_URL;

/* ============================================================
   HERO — floating polaroid photos (real crops of the photo above)
   ============================================================ */
(function heroArt() {
    const host = $('#heroArt');
    const layout = [
        { top: '4%', left: '6%', rot: -9, delay: 0, pos: 12 },
        { top: '14%', left: '46%', rot: 6, delay: 0.6, pos: 40 },
        { top: '46%', left: '4%', rot: 5, delay: 1.1, pos: 68 },
        { top: '50%', left: '48%', rot: -6, delay: 1.6, pos: 92 },
    ];
    layout.forEach((p) => {
        const el = document.createElement('div');
        el.className = 'polaroid float-photo';
        el.style.top = p.top;
        el.style.left = p.left;
        el.style.transform = `rotate(${p.rot}deg)`;
        el.style.animationDelay = p.delay + 's';
        el.innerHTML = `<div class="pic"><img src="${PANO_URL}" alt="" style="object-position:${p.pos}% 50%"></div><div class="tape" style="top:-10px;left:50%;transform:translateX(-50%) rotate(${p.rot > 0 ? -8 : 8}deg)"></div>`;
        host.appendChild(el);
    });
})();

/* add small float keyframes via injected style (keeps CSS file clean/declarative) */
const floatStyle = document.createElement('style');
floatStyle.textContent = `
@keyframes floatPhoto { 0%,100%{ transform: translateY(0) rotate(var(--r,0deg)); } 50%{ transform: translateY(-14px) rotate(var(--r,0deg)); } }
.float-photo { animation: floatPhoto 5s ease-in-out infinite; }
`;
document.head.appendChild(floatStyle);

/* ============================================================
   VIRTUAL PANORAMA SCENE
   Every "photo" is really just a crop of ONE continuous real
   photograph (loaded above). That's what makes lining them up
   always look correct — and it mirrors the real idea: each
   photo IS a piece of the same real world. "vx" values below
   are positions along that one wide photo.
   ============================================================ */
const VWIDTH = 1400, VHEIGHT = 420;

function drawSlice(ctx, dx, dy, dw, dh, vx0, vw) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx, dy, dw, dh);
    ctx.clip();

    if (panoramaReady) {
        const iw = panoramaImg.naturalWidth, ih = panoramaImg.naturalHeight;
        const scale = iw / VWIDTH;
        const sx = vx0 * scale, sw = vw * scale;
        ctx.drawImage(panoramaImg, sx, 0, sw, ih, dx, dy, dw, dh);
    } else {
        // gentle placeholder while the real photo loads
        const sky = ctx.createLinearGradient(0, dy, 0, dy + dh);
        sky.addColorStop(0, '#DDEEFB');
        sky.addColorStop(1, '#F3ECD8');
        ctx.fillStyle = sky;
        ctx.fillRect(dx, dy, dw, dh);
    }

    ctx.restore();
}

/* ============================================================
   SECTION: STORY (5 simple steps)
   ============================================================ */
const N_STORY = 4;
const photoW = 250, photoH = 180, overlap = 66;
const step = photoW - overlap;
const totalSpan = photoW + (N_STORY - 1) * step;
const vxFor = i => i * step;

// scattered display order (so it visually reads as "unordered photos")
const shuffleOrder = [2, 0, 3, 1];

const STEP_INFO = [
    { title: '1. Here are your photos', text: 'You snap a few photos, one after another, kind of overlapping. They can be in any order — messy is totally fine!' },
    { title: '2. Spot the matching bits', text: 'The computer looks for the same little detail in two photos — like this rock, this edge, or this shadow — so it knows which photos belong together.' },
    { title: '3. Line them all up', text: 'Once it knows what matches, it slides and turns the photos until those matching bits sit exactly on top of each other.' },
    { title: '4. Smooth out the seams', text: 'The edges might look a little different in brightness or color, so the computer gently blends them so you can\u2019t see any lines.' },
    { title: '5. Ta-da! One big photo', text: 'All the little photos are now one wide, seamless picture — as if you\u2019d taken it in a single shot!' },
];

// canvas-space layout container
const storyCanvas = $('#storyCanvas');
const sctx = storyCanvas.getContext('2d');
const SC_W = storyCanvas.width, SC_H = storyCanvas.height;
const groupW = totalSpan, groupH = photoH;
const groupX = (SC_W - groupW) / 2, groupY = SC_H / 2 - groupH / 2 - 20;

// scattered positions for step 0 (per photo identity, not display order)
const scatterRand = mulberry32(11);
const scatterPos = Array.from({ length: N_STORY }, (_, i) => ({
    x: 90 + (i % 2) * 430 + (scatterRand() - 0.5) * 40,
    y: 60 + Math.floor(i / 2) * 260 + (scatterRand() - 0.5) * 30,
    rot: (scatterRand() - 0.5) * 22
}));

// step states: for each of 5 steps, per-photo {x,y,rot} (top-left anchor, rot in degrees)
function lineupPos(i) {
    return { x: groupX + vxFor(i), y: groupY, rot: 0 };
}
const STATES = [
    scatterPos.map(p => ({ x: p.x, y: p.y, rot: p.rot })),                      // step 0: scattered
    scatterPos.map((p, i) => ({                                                 // step 1: loosely gathered, matches shown
        x: lerp(p.x, lineupPos(i).x, 0.35), y: lerp(p.y, lineupPos(i).y, 0.35), rot: p.rot * 0.4
    })),
    Array.from({ length: N_STORY }, (_, i) => lineupPos(i)),                    // step 2: lined up, hard seams
    Array.from({ length: N_STORY }, (_, i) => lineupPos(i)),                    // step 3: lined up, blended
    Array.from({ length: N_STORY }, (_, i) => lineupPos(i)),                    // step 4: final single photo
];

let storyTarget = 0, storyPos = 0, storyAnimHandle = null, storyPlaying = false, storyPlayTimer = null;
let confettiParticles = [], confettiFiredFor = -1;

function photoState(i, pos) {
    const s0 = STATES[clamp(Math.floor(pos), 0, 4)][i];
    const s1 = STATES[clamp(Math.ceil(pos), 0, 4)][i];
    const f = smooth(pos - Math.floor(pos));
    return {
        x: lerp(s0.x, s1.x, f),
        y: lerp(s0.y, s1.y, f),
        rot: lerp(s0.rot, s1.rot, f)
    };
}

function drawStory(pos) {
    sctx.clearRect(0, 0, SC_W, SC_H);

    const dotsOpacity = clamp(1 - Math.abs(pos - 1), 0, 1);
    const blendOpacity = smooth((pos - 2));           // 0 at step2 -> 1 at step3
    const finalOpacity = smooth((pos - 3));            // 0 at step3 -> 1 at step4

    // draw individual photos (fade out fully-merged look as finalOpacity rises)
    if (finalOpacity < 1) {
        const order = pos < 1.5 ? shuffleOrder : [0, 1, 2, 3];
        order.forEach(i => {
            const st = photoState(i, pos);
            sctx.save();
            sctx.translate(st.x + photoW / 2, st.y + photoH / 2);
            sctx.rotate(st.rot * Math.PI / 180);
            sctx.translate(-photoW / 2, -photoH / 2);

            // white polaroid border (fades at seams once blended, stays at outer edges)
            sctx.fillStyle = '#FFFDF7';
            const pad = 8;
            sctx.fillRect(-pad, -pad, photoW + pad * 2, photoH + pad * 2 + 18);
            sctx.save();
            sctx.globalAlpha = 1 - blendOpacity * 0.9;
            sctx.strokeStyle = 'rgba(31,42,68,0.15)';
            sctx.lineWidth = 2;
            sctx.strokeRect(-pad, -pad, photoW + pad * 2, photoH + pad * 2 + 18);
            sctx.restore();

            drawSlice(sctx, 0, 0, photoW, photoH, vxFor(i), photoW + overlap);

            sctx.restore();
        });

        // seam blend overlays once photos are lined up
        if (pos >= 2) {
            for (let i = 1; i < N_STORY; i++) {
                const seamX = groupX + vxFor(i);
                const soft = 46;
                const grad = sctx.createLinearGradient(seamX - soft, 0, seamX + soft, 0);
                grad.addColorStop(0, 'rgba(247,243,230,0)');
                grad.addColorStop(0.5, `rgba(247,243,230,${0.55 * blendOpacity})`);
                grad.addColorStop(1, 'rgba(247,243,230,0)');
                sctx.fillStyle = grad;
                sctx.fillRect(seamX - soft, groupY, soft * 2, groupH);
            }
        }
    }

    // matching dots + lines (step 1 only)
    if (dotsOpacity > 0.02) {
        const featureVX = [step * 0.85, step * 1.85, step * 2.85];
        sctx.save();
        sctx.globalAlpha = dotsOpacity;
        featureVX.forEach((vx, idx) => {
            const iLeft = idx, iRight = idx + 1;
            const stL = photoState(iLeft, pos), stR = photoState(iRight, pos);
            const localX = vx - vxFor(iLeft);
            const px1 = stL.x + localX, py1 = stL.y + photoH * 0.4;
            const localX2 = vx - vxFor(iRight);
            const px2 = stR.x + localX2, py2 = stR.y + photoH * 0.4;

            sctx.strokeStyle = '#59C48F';
            sctx.lineWidth = 2.5;
            sctx.setLineDash([6, 6]);
            sctx.beginPath();
            sctx.moveTo(px1, py1 - 40);
            sctx.quadraticCurveTo((px1 + px2) / 2, py1 - 90, px2, py2 - 40);
            sctx.stroke();
            sctx.setLineDash([]);

            [[px1, py1], [px2, py2]].forEach(([x, y]) => {
                sctx.beginPath();
                sctx.fillStyle = '#59C48F';
                sctx.arc(x, y, 7, 0, Math.PI * 2);
                sctx.fill();
                sctx.beginPath();
                sctx.strokeStyle = 'white';
                sctx.lineWidth = 2;
                sctx.arc(x, y, 7, 0, Math.PI * 2);
                sctx.stroke();
            });
        });
        sctx.restore();
    }

    // final merged single photo
    if (finalOpacity > 0.02) {
        sctx.save();
        sctx.globalAlpha = finalOpacity;
        const pad = 10;
        sctx.fillStyle = '#FFFDF7';
        sctx.fillRect(groupX - pad, groupY - pad, groupW + pad * 2, groupH + pad * 2 + 20);
        drawSlice(sctx, groupX, groupY, groupW, groupH, 0, groupW);
        sctx.strokeStyle = 'rgba(31,42,68,0.15)';
        sctx.lineWidth = 2;
        sctx.strokeRect(groupX - pad, groupY - pad, groupW + pad * 2, groupH + pad * 2 + 20);
        sctx.restore();
    }

    // confetti burst when reaching final step
    if (Math.round(pos) === 4 && confettiFiredFor !== 4) {
        confettiFiredFor = 4;
        spawnConfetti();
    }
    if (pos < 3.5) confettiFiredFor = -1;
    drawConfetti();
}

function spawnConfetti() {
    const rand = mulberry32(Date.now() % 10000);
    const colors = ['#FFC94A', '#FF6F5E', '#59C48F', '#9B8CF2', '#4E9BD6'];
    confettiParticles = Array.from({ length: 60 }, () => ({
        x: SC_W / 2 + (rand() - 0.5) * groupW,
        y: groupY + groupH / 2,
        vx: (rand() - 0.5) * 6,
        vy: -rand() * 7 - 3,
        r: rand() * 4 + 3,
        color: colors[Math.floor(rand() * colors.length)],
        life: 1
    }));
}

function drawConfetti() {
    confettiParticles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life -= 0.012;
        if (p.life <= 0) return;
        sctx.save();
        sctx.globalAlpha = clamp(p.life, 0, 1);
        sctx.fillStyle = p.color;
        sctx.fillRect(p.x, p.y, p.r * 2, p.r * 2);
        sctx.restore();
    });
    confettiParticles = confettiParticles.filter(p => p.life > 0);
}

function renderStoryLoop() {
    const diff = storyTarget - storyPos;
    if (Math.abs(diff) > 0.002 || confettiParticles.length) {
        storyPos += diff * 0.12;
        if (Math.abs(diff) < 0.002) storyPos = storyTarget;
        drawStory(storyPos);
        storyAnimHandle = requestAnimationFrame(renderStoryLoop);
    } else {
        drawStory(storyPos);
        storyAnimHandle = null;
    }
}

function goToStoryStep(n) {
    storyTarget = clamp(n, 0, 4);
    updateStoryCaption();
    if (!storyAnimHandle) storyAnimHandle = requestAnimationFrame(renderStoryLoop);
}

function updateStoryCaption() {
    const info = STEP_INFO[storyTarget];
    $('#storyTitle').textContent = info.title;
    $('#storyText').textContent = info.text;
    $$('#storyDots span').forEach((d, i) => d.classList.toggle('active', i === storyTarget));
}

// build dots
const dotsHost = $('#storyDots');
STEP_INFO.forEach((_, i) => {
    const d = document.createElement('span');
    d.addEventListener('click', () => { stopStoryPlay(); goToStoryStep(i); });
    dotsHost.appendChild(d);
});

function stopStoryPlay() {
    storyPlaying = false;
    clearTimeout(storyPlayTimer);
    $('#storyPlay').textContent = '▶';
}

$('#storyPrev').addEventListener('click', () => { stopStoryPlay(); goToStoryStep(storyTarget - 1); });
$('#storyNext').addEventListener('click', () => { stopStoryPlay(); goToStoryStep(storyTarget + 1); });
$('#storyRestart').addEventListener('click', () => { stopStoryPlay(); goToStoryStep(0); });
$('#storyPlay').addEventListener('click', () => {
    if (storyPlaying) { stopStoryPlay(); return; }
    storyPlaying = true;
    $('#storyPlay').textContent = '⏸';
    if (storyTarget >= 4) goToStoryStep(0);
    const advance = () => {
        if (!storyPlaying) return;
        if (storyTarget >= 4) { stopStoryPlay(); return; }
        goToStoryStep(storyTarget + 1);
        storyPlayTimer = setTimeout(advance, 2200);
    };
    storyPlayTimer = setTimeout(advance, 2200);
});

goToStoryStep(0);

/* ============================================================
   SECTION: PLAYGROUND
   ============================================================ */
const PARAMS = [
    { id: 'count', label: 'How many photos?', min: 2, max: 6, step: 1, value: 4, kind: 'range' },
    { id: 'blend', label: 'How smooth are the seams?', min: 0, max: 10, step: 1, value: 6, kind: 'range' },
    { id: 'dots', label: 'Show the matching dots', kind: 'toggle', value: true },
];
const pstate = {};
const pcontrols = $('#playControls');
PARAMS.forEach(p => {
    pstate[p.id] = p.value;
    const el = document.createElement('div');
    el.className = 'control-item';
    if (p.kind === 'range') {
        el.innerHTML = `<div class="control-top"><span>${p.label}</span><span id="val-${p.id}">${p.value}</span></div>
        <input type="range" id="ctl-${p.id}" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.value}">`;
    } else {
        el.innerHTML = `<div class="control-toggle"><span>${p.label}</span><div class="switch ${p.value ? 'on' : ''}" id="ctl-${p.id}"></div></div>`;
    }
    pcontrols.appendChild(el);
});

PARAMS.forEach(p => {
    const ctl = $('#ctl-' + p.id);
    if (p.kind === 'range') {
        ctl.addEventListener('input', e => {
            pstate[p.id] = parseFloat(e.target.value);
            $('#val-' + p.id).textContent = pstate[p.id];
            drawPlayground();
        });
    } else {
        ctl.addEventListener('click', () => {
            pstate[p.id] = !pstate[p.id];
            ctl.classList.toggle('on', pstate[p.id]);
            drawPlayground();
        });
    }
});

const playCanvas = $('#playCanvas');
const pctx = playCanvas.getContext('2d');
const PC_W = playCanvas.width, PC_H = playCanvas.height;

function drawPlayground() {
    pctx.clearRect(0, 0, PC_W, PC_H);
    const n = pstate.count;
    const pw = 300, ph = 180, ov = 70;
    const st = pw - ov;
    const total = pw + (n - 1) * st;
    const gx = (PC_W - total) / 2, gy = PC_H / 2 - ph / 2;
    const blendAmt = pstate.blend / 10;

    const pad = 10;
    pctx.fillStyle = '#FFFDF7';
    pctx.fillRect(gx - pad, gy - pad, total + pad * 2, ph + pad * 2 + 18);

    for (let i = 0; i < n; i++) {
        drawSlice(pctx, gx + i * st, gy, pw, ph, i * st, pw + ov);
    }

    // seam blending
    for (let i = 1; i < n; i++) {
        const seamX = gx + i * st;
        const soft = 20 + blendAmt * 60;
        const grad = pctx.createLinearGradient(seamX - soft, 0, seamX + soft, 0);
        grad.addColorStop(0, 'rgba(247,243,230,0)');
        grad.addColorStop(0.5, `rgba(247,243,230,${0.65 * blendAmt})`);
        grad.addColorStop(1, 'rgba(247,243,230,0)');
        pctx.fillStyle = grad;
        pctx.fillRect(seamX - soft, gy, soft * 2, ph);

        // faint seam line strength inversely proportional to blend
        pctx.strokeStyle = `rgba(31,42,68,${0.25 * (1 - blendAmt)})`;
        pctx.lineWidth = 2;
        pctx.beginPath();
        pctx.moveTo(seamX, gy);
        pctx.lineTo(seamX, gy + ph);
        pctx.stroke();
    }

    pctx.strokeStyle = 'rgba(31,42,68,0.15)';
    pctx.lineWidth = 2;
    pctx.strokeRect(gx - pad, gy - pad, total + pad * 2, ph + pad * 2 + 18);

    // matching dots between each pair, if enabled
    if (pstate.dots) {
        for (let i = 1; i < n; i++) {
            const seamX = gx + i * st - ov / 2;
            const y = gy + ph * 0.4;
            pctx.beginPath();
            pctx.fillStyle = '#59C48F';
            pctx.arc(seamX, y, 7, 0, Math.PI * 2);
            pctx.fill();
            pctx.beginPath();
            pctx.strokeStyle = 'white';
            pctx.lineWidth = 2;
            pctx.arc(seamX, y, 7, 0, Math.PI * 2);
            pctx.stroke();
        }
    }
}
drawPlayground();

/* ============================================================
   SECTION: FUN FACTS
   ============================================================ */
const FACTS = [
    { icon: '🧩', title: 'Photos are like puzzle pieces', text: 'The computer looks for pieces that overlap, just like matching the edges of a jigsaw puzzle.' },
    { icon: '🔄', title: 'Order doesn\u2019t matter', text: 'You can hand it photos in any order, even upside down or mixed up, and it still figures out how they fit.' },
    { icon: '🔍', title: 'It remembers little details', text: 'It recognizes the same tree, window, or mountaintop even if a photo is tilted, zoomed in, or a different brightness.' },
    { icon: '🗑️', title: 'It ignores photos that don\u2019t belong', text: 'If you sneak in a totally unrelated photo, like your lunch, it politely leaves it out of the panorama.' },
    { icon: '🎨', title: 'It paints over the seams', text: 'Even after lining photos up, it smooths out any small color or brightness differences so it looks like one shot.' },
    { icon: '🌍', title: 'It can go all the way around', text: 'With enough photos, it can even wrap a full 360° view into one giant panorama.' },
];
const factsGrid = $('#factsGrid');
FACTS.forEach(f => {
    const card = document.createElement('div');
    card.className = 'fact-card';
    card.innerHTML = `<div class="fact-icon">${f.icon}</div><h4>${f.title}</h4><p>${f.text}</p>`;
    factsGrid.appendChild(card);
});
const factObserver = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
}, { threshold: 0.2 });
$$('.fact-card').forEach(el => factObserver.observe(el));