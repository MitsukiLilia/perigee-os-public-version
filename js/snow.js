// Perigee OS — 雪国主题 WebGL 飘雪引擎（v2.145.0）
//
// 整块桌面 = 北海道雪原上空：一个全屏透明 <canvas> 盖在 #desktop 上层
// （pointer-events:none 不挡点击、z-index:5 盖在雪景背景 + 图标之上、alpha 混合只画雪、其余透出照片）。
// 致敬《情书》《雪国》的清冷留白：多层视差 + 景深虚化（DoF），雪又深又软、有空气感，克制不抢戏。
//
// ── 关于实现来源（版权） ─────────────────────────────────────────
// 「多层视差procedural雪 + 景深」是图形学通用思路（思路/物理不受版权保护）。
// 本 shader 全部为本项目原创代码表达：自写 hash、圆形雪片 smoothstep、层循环、风漂、
// 透明 alpha 叠加输出（透出 CSS 背景照片，而非独立黑底）。不复制任何第三方
// 着色器代码（尤其不抄 CC-BY-NC-SA 等带非商用 NC/传染条款的实现——Perigee 公开库 AGPL-3.0，
// 其 NC 非商用条款与 AGPL 不兼容、不能引入。与 v2.116 夏雨「只借物理思路、代码自己写」同一红线）。
// ─────────────────────────────────────────────────────────────
//
// WebGL 引擎骨架（上下文/编译/全屏 quad/五道生命闸/resize/context-lost）沿用本项目自有的
// js/rain-glass.js 样式。只在 #desktop 上画、仿真 app 内部一律不碰。生命周期闸严格管控：
// 主题≠snow-country / 桌面无 .active / 动态开关关 / prefers-reduced-motion /
// document.hidden —— 任一成立就 cancelAnimationFrame 暂停（后台不空跑耗电）。
//
// ┌──────────────────────────────────────────────────────────────────┐
// │ 可调常量（验收时在浏览器里改 uniform 微调密度/速度/亮度到自然飘雪）│
// └──────────────────────────────────────────────────────────────────┘
const SnowConfig = {
    THEME_NAME: 'snow-country',    // 仅此主题启动
    Z_INDEX: 5,                    // canvas 层级（盖雪景背景 + 图标，雪飘在最前）
    LAYERS: 30,                    // 视差层数（情书轻雪；越多越密越耗、需编译进 shader 的常量）
    RENDER_DPR_CAP: 1.75,          // backing store 最高倍率（雪很软、降采样肉眼无损、省 GPU）

    // —— 运行时 uniform（可在 Chrome 控制台 SnowEngine.set(...) 实时调，定稿后回填这里）——
    alpha:   0.95,                 // 整体不透明度
    speed:   0.85,                 // 下落速度
    density: 1.0,                  // 每层雪片密度（越大越密）
    gap:     0.80,                 // 空格率（0~1，越大越多空格 = 越稀疏留白）
    tint: [1.0, 1.0, 1.0],         // 雪片纯白（偏蓝会在冷雾背景上显灰=灰尘感）
};

// iOS / iPadOS（含 iPadOS 13+ 桌面模式报 MacIntel 的情况）→ 回避 WebGL，交 Canvas 2D 兜底。
// Mac Safari（非触屏）GPU 余量足、不命中，照常走 WebGL。
function _snowAvoidWebGL() {
    const ua = navigator.userAgent || '';
    const plat = navigator.platform || '';
    const iOS = /iP(hone|ad|od)/.test(ua) || /iP(hone|ad|od)/.test(plat);
    const iPadOS13 = plat === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
    return iOS || iPadOS13;
}

const SnowEngine = {
    canvas: null,
    gl: null,
    program: null,
    quadBuf: null,
    uniforms: {},
    available: false,
    W: 0, H: 0,           // backing store 像素
    rafId: null,
    running: false,
    enabled: true,        // 动态开关（settings 管存盘，这里只记当前态）
    startTs: 0,
    _inited: false,
    _reducedMQ: null,

    // —— 顶点：全屏三角带，传 clip 坐标 ——
    VERT_SRC: [
        'attribute vec2 a_pos;',
        'void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }',
    ].join('\n'),

    // —— 片元：原创多层视差雪 + 景深虚化，透明 alpha 输出（只画雪、透出背景照片）——
    //    LAYERS 作为常量编译进来（GLSL ES 100 循环上界须为常量）。
    fragSrc() {
        return [
            'precision highp float;',
            'uniform vec2  u_res;',     // backing store 尺寸（gl_FragCoord 同坐标系）
            'uniform float u_time;',    // 秒
            'uniform float u_alpha;',   // 整体不透明度
            'uniform float u_speed;',   // 下落速度
            'uniform float u_density;', // 每层密度
            'uniform float u_gap;',     // 空格率
            'uniform vec3  u_tint;',    // 雪片色调
            '#define LAYERS ' + (SnowConfig.LAYERS | 0),

            // 自写标量 hash（非任何第三方魔数矩阵）
            'float h21(vec2 p){',
            '  p = fract(p * vec2(127.137, 311.741));',
            '  p += dot(p, p + 34.123);',
            '  return fract(p.x * p.y);',
            '}',
            // 自写二维 hash → 雪片在格内的随机位/亮度
            'vec2 h22(vec2 p){',
            '  float a = h21(p);',
            '  float b = h21(p + vec2(19.19, 7.31));',
            '  return vec2(a, b);',
            '}',

            'void main(){',
            // 屏幕 uv（修正纵横比让雪片是圆的；y 向上）
            '  vec2 uv = gl_FragCoord.xy / u_res.xy;',
            '  float aspect = u_res.x / u_res.y;',
            '  uv.x *= aspect;',
            '  float t = u_time;',
            '  float acc = 0.0;',
            // 雪 ≠ 雨：不做景深虚化/雾，每片雪都是清晰明亮的白点，层次只靠大小+速度+亮度（视差）。
            '  for(int i = 0; i < LAYERS; i++){',
            '    float fi = float(i);',
            '    float dn = fi / float(LAYERS - 1);',          // 0 近 .. 1 远
            '    float scale = mix(8.0, 18.0, dn) * u_density;', // 远层格更密（雪片在屏上更小）
            // 屏幕空间下落速度：近层更快（视差）；漂移方向每层随机
            '    float fallS = mix(0.085, 0.022, dn) * u_speed;',
            '    float driftS = (h21(vec2(fi, 7.3)) - 0.5) * mix(0.05, 0.018, dn) * u_speed;',
            '    vec2 q = uv * scale;',
            '    q.y += (t * fallS) * scale;',                  // 下落（屏位移 × scale → 格位移）
            '    q.x += (t * driftS + sin(t * 0.2 + fi) * 0.015) * scale;', // 漂移 + 轻摆
            '    vec2 id = floor(q);',
            '    vec2 f  = fract(q) - 0.5;',
            '    vec2 r  = h22(id + fi * 13.0);',
            '    float present = step(u_gap, r.x);',            // 部分格留空 → 稀疏留白
            '    vec2 c = (r - 0.5) * 0.7;',                    // 格内随机偏移
            '    float sz = mix(0.028, 0.07, h21(id - fi));',   // 雪片半径（格单位，小而清晰）
            '    float d = length(f - c);',
            // 清晰白点：实心白核（出到 0.35sz 都是 1）+ 一圈很淡柔边，不做 DoF 扩散。
            // 实心核保证单片雪就够白（不靠重合），柔边只是轻微羽化、不糊成灰团。
            '    float core = 1.0 - smoothstep(sz * 0.40, sz * 0.72, d);',
            '    float halo = 1.0 - smoothstep(sz * 0.72, sz * 1.20, d);',
            '    float flake = max(core, halo * 0.22);',
            '    float bright = (0.85 + 0.15 * r.y) * mix(1.0, 0.78, dn);', // 明亮白雪、远层仅微暗
            '    acc += flake * bright * present;',
            '  }',
            '  acc = clamp(acc * 1.1, 0.0, 1.0);',
            '  gl_FragColor = vec4(u_tint, acc * u_alpha);',     // 透明叠加：只雪片有 alpha
            '}',
        ].join('\n');
    },

    // —— 初始化：建 canvas + WebGL + 编译 + 绑闸 + 首评估 ——
    init() {
        // iOS Safari/WebKit：WebGL 雪 canvas 会吃垮 GPU 纹理预算 → #desktop 的壁纸/图标 webp
        // 全传不上纹理、整屏白（详见 js/snow-2d.js 头注）。iOS 主动弃权（available=false 留默认）、
        // 不建 context，飘雪交给 Canvas 2D 的 SnowEngine2D 接管（同夏雨 iOS 走 rain.js 2D）。
        if (_snowAvoidWebGL()) { this.available = false; return; }
        if (this._inited) { this.evaluate(); return; }
        this._inited = true;

        const desktop = document.getElementById('desktop');
        if (!desktop) return;

        // context restored 重入时先清掉旧的失效 canvas，避免每丢一次叠一个 #snowCanvas
        if (this.canvas) { this.canvas.remove(); this.canvas = null; }

        // canvas：z-index:5 盖图标，width/height:100% 撑满 #desktop（绕 #desktop>* relative 压制 +
        // iOS fixed 量化坑，见 rain-glass 注释）。pointer-events:none 不挡点击。
        const canvas = document.createElement('canvas');
        canvas.id = 'snowCanvas';
        canvas.style.cssText =
            'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:' + SnowConfig.Z_INDEX + ';';
        desktop.appendChild(canvas);
        this.canvas = canvas;

        const opts = { alpha: true, premultipliedAlpha: false, antialias: false,
                       depth: false, stencil: false, powerPreference: 'low-power' };
        const gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts);
        if (!gl) { this.available = false; this._reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)'); this._bindGates(desktop); return; }
        this.gl = gl;

        const program = this._buildProgram(gl, this.VERT_SRC, this.fragSrc());
        if (!program) { this.available = false; canvas.remove(); this.canvas = null; this.gl = null; this._reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)'); this._bindGates(desktop); return; }
        this.program = program;

        // 全屏四边形
        this.quadBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

        gl.useProgram(program);
        const U = this.uniforms;
        U.u_res     = gl.getUniformLocation(program, 'u_res');
        U.u_time    = gl.getUniformLocation(program, 'u_time');
        U.u_alpha   = gl.getUniformLocation(program, 'u_alpha');
        U.u_speed   = gl.getUniformLocation(program, 'u_speed');
        U.u_density = gl.getUniformLocation(program, 'u_density');
        U.u_gap     = gl.getUniformLocation(program, 'u_gap');
        U.u_tint    = gl.getUniformLocation(program, 'u_tint');
        const aPos = gl.getAttribLocation(program, 'a_pos');
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        // ★不开 gl.BLEND：shader 已在单次全屏 draw 里把所有雪层累加成 acc，每像素只写一次。
        // 若开 SRC_ALPHA 混合，白雪 (1,1,1,a) 会被 alpha 预乘成 (a,a,a) 存进透明画布，
        // 浏览器再以 premultipliedAlpha:false 合成时又乘一次 alpha → 白被双重压暗成灰
        // （只有两片雪重合 alpha 够高才白）。关掉 BLEND，直接输出 (白, acc) 交浏览器合成 → 白就是白。
        gl.disable(gl.BLEND);
        gl.clearColor(0, 0, 0, 0);

        this.available = true;

        // context lost：WebGL 弃权 + 交棒给 Canvas 2D 兜底（否则安卓 context 丢失后整段没雪）
        canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            this.available = false;
            this._stop();
            if (window.SnowEngine2D) SnowEngine2D.evaluate();
        }, false);
        // context restored：重建 WebGL（init 开头会清掉旧 canvas），再让 2D 退场
        canvas.addEventListener('webglcontextrestored', () => {
            this._inited = false;
            this.init();
            if (window.SnowEngine2D) SnowEngine2D.evaluate();
        }, false);

        this._reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
        this._bindGates(desktop);
        this._resize();
        this.evaluate();
    },

    // —— 绑五道闸的监听 ——
    _bindGates(desktop) {
        const reeval = () => this.evaluate();
        document.addEventListener('visibilitychange', reeval);
        window.addEventListener('resize', () => { this._resize(); this.evaluate(); });
        if (this._reducedMQ) {
            if (this._reducedMQ.addEventListener) this._reducedMQ.addEventListener('change', reeval);
            else if (this._reducedMQ.addListener) this._reducedMQ.addListener(reeval);
        }
        new MutationObserver(reeval).observe(desktop, { attributes: true, attributeFilter: ['class'] });
        new MutationObserver(reeval).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    },

    _buildProgram(gl, vsrc, fsrc) {
        const vs = this._compile(gl, gl.VERTEX_SHADER, vsrc);
        const fs = this._compile(gl, gl.FRAGMENT_SHADER, fsrc);
        if (!vs || !fs) return null;
        const p = gl.createProgram();
        gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
            console.warn('[Snow] program link failed:', gl.getProgramInfoLog(p));
            return null;
        }
        return p;
    },
    _compile(gl, type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            console.warn('[Snow] shader compile failed:', gl.getShaderInfoLog(s), '\n', src);
            return null;
        }
        return s;
    },

    // —— 开关（settings.applySnowEffect 调用）——
    setEnabled(enabled) { this.enabled = !!enabled; this.evaluate(); },

    // —— 实时调参（Chrome 控制台用：SnowEngine.set({density:1.4, speed:0.7})）——
    set(opts) {
        Object.assign(SnowConfig, opts || {});
        // 立即重画一帧反映新值（若在跑，下一帧自然带上）
        if (!this.running && this.gl) this._drawFrame(this.startTs ? (performance.now() - this.startTs) / 1000 : 0);
    },

    // —— 五道闸：任一成立则不跑 ——
    _shouldRun() {
        if (!this.canvas || !this.gl || !this.available) return false;
        if (document.documentElement.dataset.theme !== SnowConfig.THEME_NAME) return false;
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
        if (this.canvas) this.canvas.style.display = ''; // 先显示再量，避免 display:none 量出 0×0
        this._resize(); // 总是重测 backing store（桌面刚变 active / 旋屏 / 切回时尺寸才有效）
        this.running = true;
        this.startTs = 0;
        this.rafId = requestAnimationFrame((ts) => this._loop(ts));
    },

    _stop() {
        this.running = false;
        if (this.rafId != null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
        if (this.gl && this.W) { this.gl.clear(this.gl.COLOR_BUFFER_BIT); } // 清成透明
        if (this.canvas) this.canvas.style.display = 'none';
    },

    // —— 尺寸：canvas 显示由 CSS 100% 撑满；backing store 按 dpr（封顶）算 ——
    _resize() {
        if (!this.canvas || !this.gl) return;
        const rect = this.canvas.getBoundingClientRect();
        const w = rect.width, h = rect.height;
        if (!w || !h) return;
        const scale = Math.min(window.devicePixelRatio || 1, SnowConfig.RENDER_DPR_CAP);
        const bw = Math.max(1, Math.round(w * scale));
        const bh = Math.max(1, Math.round(h * scale));
        if (this.canvas.width !== bw || this.canvas.height !== bh) {
            this.canvas.width = bw;
            this.canvas.height = bh;
        }
        this.W = bw; this.H = bh;
        this.gl.viewport(0, 0, bw, bh);
    },

    _loop(ts) {
        if (!this.running) return;
        if (!this.startTs) this.startTs = ts;
        const tSec = (ts - this.startTs) / 1000;
        this._drawFrame(tSec);
        this.rafId = requestAnimationFrame((t) => this._loop(t));
    },

    _drawFrame(tSec) {
        const gl = this.gl; if (!gl || !this.program) return;
        const U = this.uniforms, C = SnowConfig;
        gl.useProgram(this.program);
        gl.uniform2f(U.u_res, this.W, this.H);
        gl.uniform1f(U.u_time, tSec);
        gl.uniform1f(U.u_alpha, C.alpha);
        gl.uniform1f(U.u_speed, C.speed);
        gl.uniform1f(U.u_density, C.density);
        gl.uniform1f(U.u_gap, C.gap);
        gl.uniform3f(U.u_tint, C.tint[0], C.tint[1], C.tint[2]);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
};

window.SnowEngine = SnowEngine;
