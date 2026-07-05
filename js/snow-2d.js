// Perigee OS — 雪国主题 Canvas 2D 飘雪引擎（iOS 兜底，v2.164.0）
//
// 为什么有这个文件：snow.js 的 WebGL 雪在 iOS Safari 上会吃垮 GPU 纹理预算，
// 导致 #desktop 的壁纸 webp + 图标 webp 全传不上纹理、渲染成空白 → 整屏白
// （纯色和矢量投影照画、只有图片层崩）。和夏雨同源——夏雨 iOS 走 rain.js 2D、
// 安卓/Chrome 走 rain-glass.js WebGL。这里给雪做同款双引擎：
//   · 安卓/Chrome：WebGL SnowEngine 可用 → 本 2D 引擎让位（_shouldRun 检 SnowEngine.available）
//   · iOS：snow.js 的 init 检测到 iOS 主动弃权（available=false）→ 本 2D 引擎接管
//
// 轻量多层视差雪：每片雪一个深度 depth(0 远..1 近)，近层更大更快更亮、远层小慢淡，
// 横向用 sin 摆动 + 轻风做自然飘移。柔边靠预渲一张 radial 雪片精灵 drawImage（不用
// shadowBlur，iOS 上便宜）。只在 #desktop 上画、仿真 app 内部一律不碰。生命周期闸
// 与 WebGL 版完全一致：主题≠snow-country / 桌面无 .active / 开关关(enabled+snow-off) /
// prefers-reduced-motion / document.hidden —— 任一成立就 cancelAnimationFrame 暂停。

const Snow2DConfig = {
    THEME_NAME: 'snow-country',
    Z_INDEX: 5,                 // 盖图标，pointer-events:none 不挡点击
    FLAKE_MAX: 150,             // 雪片数量上限（留白美学，别堆成暴雪）
    FLAKE_AREA_DIVISOR: 2600,   // 数量 = min(FLAKE_MAX, round(W*H/此值))
    DPR_CAP: 2,                 // backing store 最高倍率（雪软，封顶省 GPU）

    // 深度映射区间（远 → 近）
    R_MIN: 0.8,  R_MAX: 3.4,    // 雪片半径(CSS px)
    FALL_MIN: 12, FALL_MAX: 44, // 下落速度(px/秒)，近层更快
    OP_MIN: 0.32, OP_MAX: 0.95, // 不透明度，远层更淡

    // 横向飘移
    WIND: -5,                   // 基础风(px/秒，轻微向左)
    SWAY_AMP_MIN: 5, SWAY_AMP_MAX: 18, // 摆动横向速度幅度(px/秒)
    SWAY_FREQ_MIN: 0.25, SWAY_FREQ_MAX: 0.8, // 摆动频率(rad/秒)

    TINT: '255, 255, 255',      // 雪片纯白
};

const SnowEngine2D = {
    canvas: null,
    ctx: null,
    sprite: null,
    dpr: 1,
    W: 0, H: 0,                 // CSS 像素
    flakes: [],
    rafId: null,
    running: false,
    enabled: true,             // 飘雪开关（settings 管存盘，这里只记当前态）
    lastTs: 0,
    _inited: false,
    _reducedMQ: null,

    // —— 初始化：建 canvas + 预渲精灵 + 绑闸 + 首评估 ——
    init() {
        if (this._inited) { this.evaluate(); return; }
        this._inited = true;

        const desktop = document.getElementById('desktop');
        if (!desktop) return;

        // canvas：内联 position:absolute 特异性最高，绕过 #desktop > * 的 relative 压制；
        // width/height:100% 让显示框跟 #desktop 走（铺到物理底、不留底缝、不依赖 JS 测高）。
        const canvas = document.createElement('canvas');
        canvas.id = 'snow2dCanvas';
        canvas.style.cssText =
            'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:' + Snow2DConfig.Z_INDEX + ';';
        desktop.appendChild(canvas);
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this._makeSprite();

        this._reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

        // —— 绑五道闸的监听 ——
        const reeval = () => this.evaluate();
        document.addEventListener('visibilitychange', reeval);
        window.addEventListener('resize', () => { this._resize(); this.evaluate(); });
        if (this._reducedMQ.addEventListener) this._reducedMQ.addEventListener('change', reeval);
        else if (this._reducedMQ.addListener) this._reducedMQ.addListener(reeval);
        new MutationObserver(reeval).observe(desktop, { attributes: true, attributeFilter: ['class'] });
        new MutationObserver(reeval).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        this._resize();
        this.evaluate();
    },

    // 预渲一张柔边白雪片精灵（radial：实白核 → 透明边），后续 drawImage 缩放复用
    _makeSprite() {
        const S = 24;
        const s = document.createElement('canvas');
        s.width = S; s.height = S;
        const c = s.getContext('2d');
        const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
        g.addColorStop(0,    'rgba(' + Snow2DConfig.TINT + ',1)');
        g.addColorStop(0.35, 'rgba(' + Snow2DConfig.TINT + ',0.92)');
        g.addColorStop(0.7,  'rgba(' + Snow2DConfig.TINT + ',0.30)');
        g.addColorStop(1,    'rgba(' + Snow2DConfig.TINT + ',0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
        c.fill();
        this.sprite = s;
    },

    // —— 开关（settings.applySnowEffect 调用）——
    setEnabled(enabled) { this.enabled = !!enabled; this.evaluate(); },

    // —— 实时调参（控制台：SnowEngine2D.set({FALL_MAX:60}); 改完会重铺一次贴合）——
    set(opts) {
        Object.assign(Snow2DConfig, opts || {});
        if (this.W && this.H) this._seed();
    },

    // —— 五道闸：任一成立则不跑 ——
    _shouldRun() {
        if (!this.canvas) return false;
        // WebGL 雪可用（安卓/Chrome）→ 2D 让位，不同时跑两套雪
        if (window.SnowEngine && SnowEngine.available) return false;
        if (document.documentElement.dataset.theme !== Snow2DConfig.THEME_NAME) return false;
        const desktop = document.getElementById('desktop');
        if (!desktop || !desktop.classList.contains('active')) return false;
        if (!this.enabled) return false;
        if (document.body.classList.contains('snow-off')) return false;
        if (this._reducedMQ && this._reducedMQ.matches) return false;
        if (document.hidden) return false;
        return true;
    },

    evaluate() { if (this._shouldRun()) this._start(); else this._stop(); },

    _start() {
        if (this.running) return;
        if (this.canvas) this.canvas.style.display = '';   // 先显示再量尺寸，避免 display:none 时量出 0×0
        this._resize();                                    // 无条件按真实尺寸重量+播种（含旋转后切回的新朝向）
        if (!this.flakes.length) this._seed();             // _resize 量不到尺寸时的兜底
        this.running = true;
        this.lastTs = 0;
        this.rafId = requestAnimationFrame((ts) => this._loop(ts));
    },

    _stop() {
        this.running = false;
        if (this.rafId != null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
        if (this.ctx && this.W && this.H) this.ctx.clearRect(0, 0, this.W, this.H);
        if (this.canvas) this.canvas.style.display = 'none';
    },

    // —— 尺寸：显示框由 CSS 100% 撑满，这里按实际渲染尺寸算 backing store（dpr 封顶）——
    _resize() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const w = rect.width, h = rect.height;
        if (!w || !h) return;
        const dpr = Math.min(window.devicePixelRatio || 1, Snow2DConfig.DPR_CAP);
        this.dpr = dpr;
        this.W = w; this.H = h;
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 之后都用 CSS 像素坐标画
        this._seed();
    },

    _rand(min, max) { return min + Math.random() * (max - min); },

    _newFlake(initial) {
        const C = Snow2DConfig;
        const d = Math.random();                       // 深度 0 远 .. 1 近
        const r = C.R_MIN + (C.R_MAX - C.R_MIN) * d;
        return {
            x: Math.random() * this.W,
            y: initial ? Math.random() * this.H : -r,  // 初铺散布全屏；重生从顶上进入
            r,
            fall: C.FALL_MIN + (C.FALL_MAX - C.FALL_MIN) * d,
            opacity: C.OP_MIN + (C.OP_MAX - C.OP_MIN) * d,
            swayAmp: this._rand(C.SWAY_AMP_MIN, C.SWAY_AMP_MAX) * (0.5 + 0.5 * d),
            swayFreq: this._rand(C.SWAY_FREQ_MIN, C.SWAY_FREQ_MAX),
            swayPhase: Math.random() * Math.PI * 2,
        };
    },

    _seed() {
        const C = Snow2DConfig;
        const n = Math.min(C.FLAKE_MAX, Math.round(this.W * this.H / C.FLAKE_AREA_DIVISOR));
        this.flakes = [];
        for (let i = 0; i < n; i++) this.flakes.push(this._newFlake(true));
    },

    _loop(ts) {
        if (!this.running) return;
        // dt 秒；切后台回来钳制防跳变
        let dt = this.lastTs ? (ts - this.lastTs) / 1000 : 0.016;
        if (dt > 0.05) dt = 0.05;
        this.lastTs = ts;

        const ctx = this.ctx, C = Snow2DConfig, sp = this.sprite;
        ctx.clearRect(0, 0, this.W, this.H);

        for (const f of this.flakes) {
            f.y += f.fall * dt;
            f.swayPhase += f.swayFreq * dt;
            f.x += (C.WIND + Math.sin(f.swayPhase) * f.swayAmp) * dt;

            // 出界回绕
            if (f.y - f.r > this.H) { const nf = this._newFlake(false); Object.assign(f, nf); continue; }
            if (f.x < -f.r) f.x = this.W + f.r;
            else if (f.x > this.W + f.r) f.x = -f.r;

            ctx.globalAlpha = f.opacity;
            ctx.drawImage(sp, f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
        }
        ctx.globalAlpha = 1;

        this.rafId = requestAnimationFrame((t) => this._loop(t));
    },
};

window.SnowEngine2D = SnowEngine2D;
