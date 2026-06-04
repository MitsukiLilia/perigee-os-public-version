// Perigee OS — 夜空主题 Canvas 2D 星空引擎（v2.92.0）
//
// 整块桌面 = 一片夜空：一个全屏 <canvas> 盖在 #desktop 最上层
// （pointer-events:none 不挡点击、z-index:5 盖在背景星空照片 + 图标之上）。
// 三层动态：① 满天星星呼吸闪烁（亮星带十字芒 + 柔光晕）② 偶发流星从上方斜划带运动模糊拖尾
// ③ 整层星点极缓慢漂移营造「活着的星空」流动感（克制、几乎察觉不到突变）。
//
// 只在 #desktop 上画、仿真 app 内部一律不碰。纯 rAF + 生命周期闸严格管控（与夏雨 RainEngine 同款）：
// 主题≠night-sky / 桌面无 .active / 动态开关关 / prefers-reduced-motion /
// document.hidden —— 任一成立就 cancelAnimationFrame 暂停（后台不空跑耗电）。
//
// ┌──────────────────────────────────────────────────────────────────┐
// │ 可调常量（验收时在浏览器里微调密度/速度/流星频率/闪烁/漂移到自然）│
// └──────────────────────────────────────────────────────────────────┘
const StarfieldConfig = {
    // —— 全局 ——
    THEME_NAME: 'night-sky',       // 仅此主题启动
    Z_INDEX: 5,                    // canvas 层级（盖背景星空 + 图标）

    // —— 星星层 stars ——
    STAR_MAX: 240,                 // 星星数量上限
    STAR_AREA_DIVISOR: 2600,       // 数量 = min(STAR_MAX, round(W*H/此值))，手机 ~150-240 颗（星空要密）
    STAR_R_MIN: 0.4,               // 普通星半径下限(px)
    STAR_R_MAX: 1.3,               // 普通星半径上限
    STAR_BRIGHT_CHANCE: 0.12,      // 生成时成为「亮星」(更大 + 十字芒 + 光晕)的概率
    STAR_BRIGHT_R_MIN: 1.3,        // 亮星半径下限
    STAR_BRIGHT_R_MAX: 2.3,        // 亮星半径上限
    STAR_WARM_CHANCE: 0.22,        // 偏暖紫白(否则冷白)的概率
    STAR_ALPHA_MIN: 0.22,          // 基础亮度下限
    STAR_ALPHA_MAX: 0.72,          // 基础亮度上限
    STAR_TWINKLE_AMP: 0.34,        // 呼吸振幅（alpha 在 base ± amp*随机 间波动）
    STAR_TWINKLE_SPEED_MIN: 0.018, // 呼吸速度下限(rad/帧 @60fps)，约 6s 一个周期
    STAR_TWINKLE_SPEED_MAX: 0.055, // 呼吸速度上限，约 2s 一个周期
    STAR_COLOR: '255, 255, 255',   // 冷白星 RGB
    STAR_COLOR_WARM: '224, 218, 246', // 暖紫白星 RGB

    // —— 流星层 meteors ——
    METEOR_MAX_CONCURRENT: 2,      // 同时在场上限
    METEOR_SPAWN_CHECK_INTERVAL: 6,// 每隔多少帧检查一次是否生成
    METEOR_SPAWN_CHANCE: 0.05,     // 每次检查时的生成概率（低频，平均几秒一颗）
    METEOR_LEN_MIN: 80,            // 拖尾长度下限(px)
    METEOR_LEN_MAX: 170,           // 拖尾长度上限
    METEOR_SPEED_MIN: 9,           // 速度下限(px/帧)
    METEOR_SPEED_MAX: 16,          // 速度上限
    METEOR_ANGLE_MIN: 18,          // 偏离竖直角下限(deg)，越大越斜
    METEOR_ANGLE_MAX: 40,          // 偏离竖直角上限
    METEOR_WIDTH: 1.6,             // 流星线宽(px)
    METEOR_FADE_IN: 0.10,          // 每帧淡入速度
    METEOR_ALPHA_MAX: 0.92,        // 流星最高亮度

    // —— 漂移 drift ——（整层星点极缓慢移动 + 环绕，营造流动感）
    DRIFT_SPEED_X: 0.012,          // 横向漂移(px/帧)
    DRIFT_SPEED_Y: 0.005,          // 纵向漂移(px/帧)
};

const StarfieldEngine = {
    canvas: null,
    ctx: null,
    dpr: 1,
    W: 0,            // CSS 像素宽
    H: 0,            // CSS 像素高
    stars: [],
    meteors: [],
    driftX: 0,
    driftY: 0,
    rafId: null,
    running: false,
    enabled: true,   // 动态开关（settings 管存盘，这里只记当前态）
    lastTs: 0,
    frame: 0,
    _inited: false,
    _reducedMQ: null,
    _bound: null,

    // —— 初始化：建 canvas + 绑监听 + 首次评估 ——
    init() {
        if (this._inited) { this.evaluate(); return; }
        this._inited = true;

        const desktop = document.getElementById('desktop');
        if (!desktop) return;

        // 建 canvas（动态创建、自包含）
        const canvas = document.createElement('canvas');
        canvas.id = 'starCanvas';
        canvas.style.cssText =
            'position:absolute;inset:0;pointer-events:none;z-index:' + StarfieldConfig.Z_INDEX + ';';
        // #desktop > * 那条 ID 规则会把子元素压成 relative + 0 高，
        // 用 cssText 直接写 position:absolute + inset:0 内联样式特异性最高、不被压（夏雨同款坑）。
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

    // —— 开关（settings.applyStarfieldEffect 调用）——
    setEnabled(enabled) {
        this.enabled = !!enabled;
        this.evaluate();
    },

    // —— 判断该不该跑：任一闸条件成立则暂停 ——
    _shouldRun() {
        if (!this.canvas) return false;
        // 1. 主题
        if (document.documentElement.dataset.theme !== StarfieldConfig.THEME_NAME) return false;
        // 2. 桌面可见
        const desktop = document.getElementById('desktop');
        if (!desktop || !desktop.classList.contains('active')) return false;
        // 3. 动态开关（实例 enabled + body.starfield-off 双查、任一关都停）
        if (!this.enabled) return false;
        if (document.body.classList.contains('starfield-off')) return false;
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
        if (!this.stars.length) this._seedStars();
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
        // 清掉流星（重启不留旧流星；星星保留继续闪）
        this.meteors.length = 0;
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
        // 重新分布星星贴合新尺寸
        this._seedStars();
        this.meteors.length = 0;
        this.driftX = 0;
        this.driftY = 0;
    },

    _rand(min, max) { return min + Math.random() * (max - min); },

    // —— 星星层 ——
    _newStar() {
        const C = StarfieldConfig;
        const bright = Math.random() < C.STAR_BRIGHT_CHANCE;
        const r = bright ? this._rand(C.STAR_BRIGHT_R_MIN, C.STAR_BRIGHT_R_MAX)
                         : this._rand(C.STAR_R_MIN, C.STAR_R_MAX);
        return {
            x: Math.random() * this.W,
            y: Math.random() * this.H,
            r,
            bright,
            warm: Math.random() < C.STAR_WARM_CHANCE,
            baseAlpha: this._rand(C.STAR_ALPHA_MIN, C.STAR_ALPHA_MAX),
            twAmp: C.STAR_TWINKLE_AMP * this._rand(0.5, 1),
            twSpeed: this._rand(C.STAR_TWINKLE_SPEED_MIN, C.STAR_TWINKLE_SPEED_MAX),
            phase: Math.random() * Math.PI * 2,
        };
    },

    _seedStars() {
        const C = StarfieldConfig;
        const n = Math.min(C.STAR_MAX, Math.round(this.W * this.H / C.STAR_AREA_DIVISOR));
        this.stars = [];
        for (let i = 0; i < n; i++) this.stars.push(this._newStar());
    },

    // —— 流星层 ——
    _newMeteor() {
        const C = StarfieldConfig;
        const dir = Math.random() < 0.5 ? 1 : -1; // +1 右下 / -1 左下
        const angle = this._rand(C.METEOR_ANGLE_MIN, C.METEOR_ANGLE_MAX) * Math.PI / 180; // 偏离竖直
        const speed = this._rand(C.METEOR_SPEED_MIN, C.METEOR_SPEED_MAX);
        const len = this._rand(C.METEOR_LEN_MIN, C.METEOR_LEN_MAX);
        const vx = Math.sin(angle) * speed * dir;
        const vy = Math.cos(angle) * speed; // 向下为主
        // 起点：顶部外，给足横向划过空间
        const x0 = dir > 0 ? this._rand(0, this.W * 0.6) : this._rand(this.W * 0.4, this.W);
        const y0 = this._rand(-30, this.H * 0.15);
        return { x: x0, y: y0, vx, vy, len, moveAng: Math.atan2(vy, vx), alpha: 0 };
    },

    _maybeSpawnMeteor() {
        const C = StarfieldConfig;
        if (this.frame % C.METEOR_SPAWN_CHECK_INTERVAL !== 0) return;
        if (this.meteors.length >= C.METEOR_MAX_CONCURRENT) return;
        if (Math.random() > C.METEOR_SPAWN_CHANCE) return;
        this.meteors.push(this._newMeteor());
    },

    // —— 主循环 ——
    _loop(ts) {
        if (!this.running) return;
        let dt = this.lastTs ? (ts - this.lastTs) / 16.667 : 1;
        if (dt > 3) dt = 3; // 切后台回来钳制防跳变
        this.lastTs = ts;
        this.frame++;

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.W, this.H);

        this._updateAndDrawStars(dt);
        this._maybeSpawnMeteor();
        this._updateAndDrawMeteors(dt);

        this.rafId = requestAnimationFrame((t) => this._loop(t));
    },

    _updateAndDrawStars(dt) {
        const C = StarfieldConfig;
        // 整层缓慢漂移（环绕），保持 drift 在 [0,W)/[0,H) 防溢出
        this.driftX = (this.driftX + C.DRIFT_SPEED_X * dt) % this.W;
        this.driftY = (this.driftY + C.DRIFT_SPEED_Y * dt) % this.H;
        const W = this.W, H = this.H;
        for (const s of this.stars) {
            s.phase += s.twSpeed * dt;
            let alpha = s.baseAlpha + s.twAmp * Math.sin(s.phase);
            if (alpha < 0.04) alpha = 0.04; else if (alpha > 1) alpha = 1;
            const px = ((s.x + this.driftX) % W + W) % W;
            const py = ((s.y + this.driftY) % H + H) % H;
            this._drawStar(px, py, s, alpha);
        }
    },

    _drawStar(px, py, s, alpha) {
        const ctx = this.ctx;
        const col = s.warm ? StarfieldConfig.STAR_COLOR_WARM : StarfieldConfig.STAR_COLOR;
        if (s.bright) {
            // 柔光晕
            const halo = ctx.createRadialGradient(px, py, 0, px, py, s.r * 4.5);
            halo.addColorStop(0, 'rgba(' + col + ',' + (alpha * 0.42).toFixed(3) + ')');
            halo.addColorStop(1, 'rgba(' + col + ',0)');
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(px, py, s.r * 4.5, 0, Math.PI * 2);
            ctx.fill();
            // 十字芒
            ctx.strokeStyle = 'rgba(' + col + ',' + (alpha * 0.5).toFixed(3) + ')';
            ctx.lineWidth = 0.8;
            ctx.lineCap = 'round';
            const spike = s.r * 3.2;
            ctx.beginPath();
            ctx.moveTo(px - spike, py); ctx.lineTo(px + spike, py);
            ctx.moveTo(px, py - spike); ctx.lineTo(px, py + spike);
            ctx.stroke();
        }
        // 星核
        ctx.fillStyle = 'rgba(' + col + ',' + alpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(px, py, s.r, 0, Math.PI * 2);
        ctx.fill();
    },

    _updateAndDrawMeteors(dt) {
        const C = StarfieldConfig;
        const ctx = this.ctx;
        for (let i = this.meteors.length - 1; i >= 0; i--) {
            const m = this.meteors[i];
            m.x += m.vx * dt;
            m.y += m.vy * dt;
            m.alpha = Math.min(C.METEOR_ALPHA_MAX, m.alpha + C.METEOR_FADE_IN * dt);
            // 出屏 → 移除
            if (m.y - m.len > this.H || m.x < -m.len || m.x > this.W + m.len) {
                this.meteors.splice(i, 1);
                continue;
            }
            const tailX = m.x - Math.cos(m.moveAng) * m.len;
            const tailY = m.y - Math.sin(m.moveAng) * m.len;
            const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
            grad.addColorStop(0, 'rgba(255, 255, 255,' + m.alpha.toFixed(3) + ')');
            grad.addColorStop(0.4, 'rgba(224, 228, 255,' + (m.alpha * 0.45).toFixed(3) + ')');
            grad.addColorStop(1, 'rgba(255, 255, 255,0)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = C.METEOR_WIDTH;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(m.x, m.y);
            ctx.lineTo(tailX, tailY);
            ctx.stroke();
            // 头部亮点
            ctx.fillStyle = 'rgba(255, 255, 255,' + m.alpha.toFixed(3) + ')';
            ctx.beginPath();
            ctx.arc(m.x, m.y, C.METEOR_WIDTH * 0.9, 0, Math.PI * 2);
            ctx.fill();
        }
    },
};

window.StarfieldEngine = StarfieldEngine;
