// Perigee OS — 夏雨主题 Canvas 2D 真雨引擎（v2.91.0）
//
// 整块桌面 = 一扇雨天玻璃窗：一个全屏 <canvas> 盖在 #desktop 最上层
// （pointer-events:none 不挡点击、z-index:5 盖住图标/widget），雨丝真下落 +
// 玻璃水珠大小不一随机挂壁、偶尔滑落拖水痕。水珠自然盖在图标上 = 图标像沾了雨。
// 状态栏区（顶部安全区+44px）不挂水珠（雨丝可稀疏穿过），避免挡时间。
//
// 只在 #desktop 上画、仿真 app 内部一律不碰。纯 rAF + 生命周期闸严格管控：
// 主题≠summer-rain / 桌面无 .active / 雨开关关 / prefers-reduced-motion /
// document.hidden —— 任一成立就 cancelAnimationFrame 暂停（后台不空跑耗电）。
//
// ┌──────────────────────────────────────────────────────────────────┐
// │ 可调常量（主 Claude 验收时在浏览器里微调密度/速度/水珠样式到自然）│
// └──────────────────────────────────────────────────────────────────┘
const RainConfig = {
    // —— 全局 ——
    THEME_NAME: 'summer-rain',     // 仅此主题启动
    Z_INDEX: 5,                    // canvas 层级（盖图标/widget、status-bar 是 z-index:2 靠避让区让开）
    TOP_SAFE: 64,                  // 顶部状态栏避让高度(px)：此区内不挂水珠、雨丝稀疏穿过（≈安全区 20 + 44）

    // —— 雨丝层 drops ——
    DROP_MAX: 320,                 // 雨丝数量上限（v2.115.0 加密雨丝）
    DROP_AREA_DIVISOR: 6000,       // 数量 = min(DROP_MAX, round(W*H/此值))，手机更密
    DROP_LEN_MIN: 8,               // 雨丝长度下限(px)
    DROP_LEN_MAX: 22,              // 雨丝长度上限(px)
    DROP_SPEED_MIN: 11,            // 下落速度下限(px/帧 @60fps)
    DROP_SPEED_MAX: 22,            // 下落速度上限
    DROP_OPACITY_MIN: 0.08,        // 雨丝透明度下限
    DROP_OPACITY_MAX: 0.28,        // 雨丝透明度上限
    DROP_TILT_MIN: 6,              // 向左倾斜角下限(deg)
    DROP_TILT_MAX: 14,             // 向左倾斜角上限(deg)
    DROP_TOP_OPACITY_SCALE: 0.45,  // 雨丝穿过状态栏区(y<TOP_SAFE)时透明度衰减系数（稀疏感）
    DROP_LINE_WIDTH: 1,            // 雨丝线宽
    DROP_COLOR: '255, 255, 255',   // 雨丝 RGB

    // —— 水珠层 beads ——
    BEAD_MAX: 130,                 // 水珠数量上限（v2.115.0 加多；性能吃紧时优先降这个）
    BEAD_AREA_DIVISOR: 4200,       // 数量 = min(BEAD_MAX, round(W*H/此值))，手机更多水珠
    BEAD_R_MIN: 1.5,               // 普通水珠半径下限(px)
    BEAD_R_MAX: 5,                 // 普通水珠半径上限
    BEAD_BIG_CHANCE: 0.22,         // 生成时成为大颗水珠的概率（v2.115.0 略增大颗）
    BEAD_BIG_R_MIN: 5,             // 大颗水珠半径下限
    BEAD_BIG_R_MAX: 9,             // 大颗水珠半径上限

    // —— 滑落 slide ——
    SLIDE_MAX_CONCURRENT: 4,       // 同时滑落上限（v2.115.0 滑落更活）
    SLIDE_START_CHANCE: 0.016,     // 每帧检查时单颗大水珠激活滑落的概率（v2.115.0 略提）
    SLIDE_MIN_R: 4,                // 只有半径 ≥ 此值的水珠才可能滑落
    SLIDE_GRAVITY: 0.05,           // 滑落重力加速度(px/帧²)
    SLIDE_VY_START: 0.4,           // 滑落初速度(px/帧)
    SLIDE_VY_MAX: 6,               // 滑落最大速度(px/帧)
    SLIDE_GROW: 0.012,             // 滑落每帧半径增长(吸收沿途水)
    SLIDE_GROW_MAX_R: 11,          // 滑落水珠半径增长上限
    SLIDE_EAT_RADIUS: 7,           // 滑落路径吃掉附近小水珠的横向判定半径(px)
    TRAIL_LIFE: 650,              // 水痕一节的存活时间(ms)，到期淡尽（v2.115.0 水痕更久更清）
    TRAIL_WIDTH_SCALE: 0.55,       // 水痕宽度 = 滑落水珠半径 × 此值

    // —— 节流 ——
    BEAD_SLIDE_CHECK_INTERVAL: 5,  // 每隔多少帧检查一次「是否激活新的滑落」（省 CPU）
};

const RainEngine = {
    canvas: null,
    ctx: null,
    dpr: 1,
    W: 0,            // CSS 像素宽
    H: 0,            // CSS 像素高
    drops: [],
    beads: [],
    trails: [],      // 水痕节点 [{x, y0, y1, r, born}]
    rafId: null,
    running: false,
    enabled: true,   // 雨开关（settings 管存盘，这里只记当前态）
    lastTs: 0,
    frame: 0,
    _inited: false,
    _reducedMQ: null,
    _bound: null,    // 绑定后的监听器引用（便于复用）

    // —— 初始化：建 canvas + 绑监听 + 首次评估 ——
    init() {
        if (this._inited) { this.evaluate(); return; }
        this._inited = true;

        const desktop = document.getElementById('desktop');
        if (!desktop) return;

        // 建 canvas（动态创建、自包含）
        const canvas = document.createElement('canvas');
        canvas.id = 'rainCanvas';
        canvas.style.cssText =
            'position:absolute;inset:0;pointer-events:none;z-index:' + RainConfig.Z_INDEX + ';';
        // #desktop > * 那条 ID 规则会把子元素压成 relative + 0 高（希卡/动森老坑），
        // 用 cssText 直接写 position:absolute + inset:0 内联样式特异性最高、不被压。
        desktop.appendChild(canvas);
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // reduced-motion media query
        this._reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

        // —— 绑监听 ——
        this._bound = {
            visibility: () => this.evaluate(),
            resize:     () => { this._resize(); this.evaluate(); },
            reduced:    () => this.evaluate(),
        };
        document.addEventListener('visibilitychange', this._bound.visibility);
        window.addEventListener('resize', this._bound.resize);
        // reduced-motion 监听（兼容老 Safari 的 addListener）
        if (this._reducedMQ.addEventListener) {
            this._reducedMQ.addEventListener('change', this._bound.reduced);
        } else if (this._reducedMQ.addListener) {
            this._reducedMQ.addListener(this._bound.reduced);
        }

        // 观察 #desktop 的 class 变化（进/出桌面：.active 增减）
        const deskObs = new MutationObserver(() => this.evaluate());
        deskObs.observe(desktop, { attributes: true, attributeFilter: ['class'] });

        // 观察 <html> 的 data-theme 变化（切主题）
        const themeObs = new MutationObserver(() => this.evaluate());
        themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        this._resize();
        this.evaluate();
    },

    // —— 开关（settings.applyRainEffect 调用）——
    setEnabled(enabled) {
        this.enabled = !!enabled;
        this.evaluate();
    },

    // —— 判断该不该跑：任一闸条件成立则暂停 ——
    _shouldRun() {
        if (!this.canvas) return false;
        // shader 主力：WebGL 玻璃引擎可用时，2D 让位（不同时跑两套雨）
        if (window.GlassRainEngine && GlassRainEngine.available) return false;
        // 1. 主题
        if (document.documentElement.dataset.theme !== RainConfig.THEME_NAME) return false;
        // 2. 桌面可见
        const desktop = document.getElementById('desktop');
        if (!desktop || !desktop.classList.contains('active')) return false;
        // 3. 雨开关（实例 enabled + body.rain-off 双查、任一关都停）
        if (!this.enabled) return false;
        if (document.body.classList.contains('rain-off')) return false;
        // 4. reduced-motion
        if (this._reducedMQ && this._reducedMQ.matches) return false;
        // 5. 页面隐藏
        if (document.hidden) return false;
        return true;
    },

    evaluate() {
        if (this._shouldRun()) this._start();
        else this._stop();
    },

    _start() {
        if (this.running) return;
        if (!this.W || !this.H) this._resize();
        // 首次/重启若粒子为空则铺满
        if (!this.drops.length) this._seedDrops();
        if (!this.beads.length) this._seedBeads();
        this.running = true;
        if (this.canvas) this.canvas.style.display = '';
        this.lastTs = 0;
        this.rafId = requestAnimationFrame((ts) => this._loop(ts));
    },

    _stop() {
        this.running = false;
        if (this.rafId != null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        // 清空画布 + 隐藏（无残留）
        if (this.ctx && this.W && this.H) this.ctx.clearRect(0, 0, this.W, this.H);
        if (this.canvas) this.canvas.style.display = 'none';
        // 清掉水痕（重启时不留旧痕）
        this.trails.length = 0;
    },

    // —— 尺寸：CSS 像素 × dpr，scale 后用 CSS 坐标 ——
    _resize() {
        const desktop = document.getElementById('desktop');
        if (!desktop || !this.canvas) return;
        const w = desktop.clientWidth;
        const h = desktop.clientHeight;
        if (!w || !h) return;
        const dpr = window.devicePixelRatio || 1;
        this.dpr = dpr;
        this.W = w;
        this.H = h;
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // scale(dpr,dpr) + 重置（防累积）
        // 重新分布粒子贴合新尺寸
        this._seedDrops();
        this._seedBeads();
        this.trails.length = 0;
    },

    _rand(min, max) { return min + Math.random() * (max - min); },

    // —— 雨丝层 ——
    _newDrop(initial) {
        const C = RainConfig;
        const len = this._rand(C.DROP_LEN_MIN, C.DROP_LEN_MAX);
        return {
            x: Math.random() * this.W,
            // 初次铺满时散布全屏；reset 时从顶部上方进入
            y: initial ? Math.random() * this.H : -len,
            len,
            speed: this._rand(C.DROP_SPEED_MIN, C.DROP_SPEED_MAX),
            opacity: this._rand(C.DROP_OPACITY_MIN, C.DROP_OPACITY_MAX),
            tilt: this._rand(C.DROP_TILT_MIN, C.DROP_TILT_MAX) * Math.PI / 180,
        };
    },

    _seedDrops() {
        const C = RainConfig;
        const n = Math.min(C.DROP_MAX, Math.round(this.W * this.H / C.DROP_AREA_DIVISOR));
        this.drops = [];
        for (let i = 0; i < n; i++) this.drops.push(this._newDrop(true));
    },

    // —— 水珠层 ——
    _newBead(initial) {
        const C = RainConfig;
        const big = Math.random() < C.BEAD_BIG_CHANCE;
        const targetR = big ? this._rand(C.BEAD_BIG_R_MIN, C.BEAD_BIG_R_MAX)
                            : this._rand(C.BEAD_R_MIN, C.BEAD_R_MAX);
        // 首屏铺满(initial)直接成熟；后续补充/重生的水珠从小凝结淡入（更像真实雨水积聚）
        const r = initial ? targetR : targetR * 0.3;
        // 不在状态栏区生成（y > TOP_SAFE + targetR 留出余量）
        const yMin = C.TOP_SAFE + targetR + 2;
        const yMax = this.H - targetR - 2;
        return {
            x: this._rand(targetR + 2, this.W - targetR - 2),
            y: this._rand(yMin, Math.max(yMin + 1, yMax)),
            r,
            targetR,
            alpha: initial ? 1 : 0,
            state: initial ? 'static' : 'appearing',  // 'static' | 'appearing' | 'sliding'
            vy: 0,
            wobble: Math.random() * Math.PI * 2, // 静态微抖动相位（克制）
        };
    },

    _seedBeads() {
        const C = RainConfig;
        const n = Math.min(C.BEAD_MAX, Math.round(this.W * this.H / C.BEAD_AREA_DIVISOR));
        this.beads = [];
        for (let i = 0; i < n; i++) this.beads.push(this._newBead(true));
    },

    _slidingCount() {
        let c = 0;
        for (const b of this.beads) if (b.state === 'sliding') c++;
        return c;
    },

    // —— 主循环 ——
    _loop(ts) {
        if (!this.running) return;
        // 时间步长归一（以 60fps 为基准），切后台回来时钳制防跳变
        let dt = this.lastTs ? (ts - this.lastTs) / 16.667 : 1;
        if (dt > 3) dt = 3;
        this.lastTs = ts;
        this.frame++;

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.W, this.H);

        this._updateAndDrawTrails(ts);
        this._updateAndDrawDrops(dt);
        this._maybeStartSlide();
        this._updateAndDrawBeads(dt, ts);

        this.rafId = requestAnimationFrame((t) => this._loop(t));
    },

    _updateAndDrawDrops(dt) {
        const C = RainConfig;
        const ctx = this.ctx;
        ctx.lineWidth = C.DROP_LINE_WIDTH;
        ctx.lineCap = 'round';
        for (const d of this.drops) {
            d.y += d.speed * dt;
            d.x -= d.speed * Math.tan(d.tilt) * dt;
            if (d.y - d.len > this.H) {
                // reset 重随机
                const nd = this._newDrop(false);
                d.x = nd.x; d.y = nd.y; d.len = nd.len;
                d.speed = nd.speed; d.opacity = nd.opacity; d.tilt = nd.tilt;
            }
            // 状态栏区透明度衰减（稀疏穿过、不碍时间）
            let op = d.opacity;
            if (d.y < C.TOP_SAFE) op *= C.DROP_TOP_OPACITY_SCALE;
            const dx = Math.tan(d.tilt) * d.len; // 倾斜横向位移（向右上、因雨向左下）
            // 沿线 alpha 渐变做运动模糊：头(下端)较实、尾(上端)淡
            const grad = ctx.createLinearGradient(d.x, d.y, d.x + dx, d.y - d.len);
            grad.addColorStop(0, 'rgba(' + C.DROP_COLOR + ',' + op.toFixed(3) + ')');
            grad.addColorStop(1, 'rgba(' + C.DROP_COLOR + ',0)');
            ctx.strokeStyle = grad;
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x + dx, d.y - d.len);
            ctx.stroke();
        }
    },

    // 低频激活少数大水珠滑落
    _maybeStartSlide() {
        const C = RainConfig;
        if (this.frame % C.BEAD_SLIDE_CHECK_INTERVAL !== 0) return;
        if (this._slidingCount() >= C.SLIDE_MAX_CONCURRENT) return;
        if (Math.random() > C.SLIDE_START_CHANCE) return;
        // 从够大的静态水珠里随机挑一颗激活
        const cands = this.beads.filter(b => b.state === 'static' && b.r >= C.SLIDE_MIN_R);
        if (!cands.length) return;
        const b = cands[(Math.random() * cands.length) | 0];
        b.state = 'sliding';
        b.vy = C.SLIDE_VY_START;
        b._trailY = b.y; // 上一次落下水痕节点的 y
    },

    _updateAndDrawBeads(dt, ts) {
        const C = RainConfig;
        for (let i = 0; i < this.beads.length; i++) {
            const b = this.beads[i];
            if (b.state === 'sliding') {
                // 受重力渐增
                b.vy = Math.min(C.SLIDE_VY_MAX, b.vy + C.SLIDE_GRAVITY * dt);
                b.y += b.vy * dt;
                // 略微变大（吸收沿途）
                b.r = Math.min(C.SLIDE_GROW_MAX_R, b.r + C.SLIDE_GROW * dt);

                // 身后留水痕节点（按移动距离补节点、避免快滑断节）
                if (b._trailY == null) b._trailY = b.y;
                if (b.y - b._trailY >= 1) {
                    this.trails.push({
                        x: b.x,
                        y0: b._trailY,
                        y1: b.y,
                        r: b.r,
                        born: ts,
                    });
                    b._trailY = b.y;
                }

                // 吃掉路径附近的小水珠（标记重生）
                this._eatAlongPath(b, i);

                // 滑到底 → 消失并在随机位置重生一颗静态水珠补回总数
                if (b.y - b.r > this.H) {
                    const nb = this._newBead(false);
                    this.beads[i] = nb;
                    continue;
                }
            } else if (b.state === 'appearing') {
                // 凝结：半径朝 targetR 逼近、alpha 淡入，到位转 static
                b.r += (b.targetR - b.r) * 0.04 * dt;
                b.alpha = Math.min(1, b.alpha + 0.03 * dt);
                if (b.targetR - b.r < 0.3 && b.alpha >= 0.99) {
                    b.r = b.targetR; b.alpha = 1; b.state = 'static';
                }
                b.wobble += 0.02 * dt;
            } else {
                // 静态：极克制的微抖动相位推进（画时用、几乎不可见）
                b.wobble += 0.02 * dt;
            }
            this._drawBead(b);
        }
    },

    // 滑落水珠吃掉路径附近的小静态水珠
    _eatAlongPath(slider, sliderIdx) {
        const C = RainConfig;
        for (let j = 0; j < this.beads.length; j++) {
            if (j === sliderIdx) continue;
            const o = this.beads[j];
            if (o.state !== 'static') continue;
            if (Math.abs(o.x - slider.x) > C.SLIDE_EAT_RADIUS) continue;
            // 在滑落水珠当前 y 上方一小段路径内 → 被吞
            if (o.y > slider._trailY - slider.r && o.y < slider.y + slider.r) {
                // 被吃：在状态栏区下方随机位置重生一颗（保持总数 + 分布）
                this.beads[j] = this._newBead(false);
            }
        }
    },

    // —— 水痕：逐节存活 TRAIL_LIFE 后淡尽 ——
    _updateAndDrawTrails(ts) {
        const C = RainConfig;
        const ctx = this.ctx;
        for (let i = this.trails.length - 1; i >= 0; i--) {
            const t = this.trails[i];
            const age = ts - t.born;
            if (age >= C.TRAIL_LIFE) { this.trails.splice(i, 1); continue; }
            const k = 1 - age / C.TRAIL_LIFE; // 1→0
            const w = Math.max(0.5, t.r * C.TRAIL_WIDTH_SCALE * k);
            ctx.lineWidth = w;
            ctx.lineCap = 'round';
            // 水痕：半透微亮竖线 + 一点高光（残留的湿润感）
            ctx.strokeStyle = 'rgba(225, 238, 247,' + (0.20 * k).toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(t.x, t.y0);
            ctx.lineTo(t.x, t.y1);
            ctx.stroke();
        }
    },

    // —— 单颗水珠画法：玻璃折射感（radial 高光 + 边缘暗 + 底部暗弧）——
    _drawBead(b) {
        const ctx = this.ctx;
        const r = b.r;
        const x = b.x;
        const y = b.y;
        const a = (b.alpha == null) ? 1 : b.alpha;  // 凝结淡入透明度

        // 1. 主体 radialGradient（高光偏上一点）
        const grad = ctx.createRadialGradient(
            x - r * 0.3, y - r * 0.35, r * 0.1,  // 内圈（高光位置）
            x, y, r                                // 外圈
        );
        grad.addColorStop(0,   'rgba(255, 255, 255, ' + (0.60 * a).toFixed(3) + ')');
        grad.addColorStop(0.45,'rgba(225, 238, 247, ' + (0.18 * a).toFixed(3) + ')');
        grad.addColorStop(1,   'rgba(255, 255, 255, ' + (0.04 * a).toFixed(3) + ')');

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // 2. 底部暗弧 / 微投影（让水珠"鼓起"挂壁）
        ctx.beginPath();
        ctx.arc(x, y + r * 0.18, r * 0.92, Math.PI * 0.15, Math.PI * 0.85);
        ctx.strokeStyle = 'rgba(20, 40, 60, ' + (0.18 * a).toFixed(3) + ')';
        ctx.lineWidth = Math.max(0.6, r * 0.18);
        ctx.lineCap = 'round';
        ctx.stroke();

        // 3. 左上小高光点（白、r 的 ~25%）
        ctx.beginPath();
        ctx.arc(x - r * 0.32, y - r * 0.38, Math.max(0.5, r * 0.25), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.85 * a).toFixed(3) + ')';
        ctx.fill();
    },
};

window.RainEngine = RainEngine;
