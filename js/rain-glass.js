// Perigee OS — 夏雨主题 WebGL「真折射玻璃窗」引擎（v2.116.0）
//
// 桌面背景层一块全屏 <canvas>（z-index:0 在图标之下、当活壁纸），用自写 GLSL
// 把 summer-rain-bg.webp 当纹理做真实折射的起雾雨天玻璃窗。图标/widget 浮在其上。
// GLSL 全部自己写，仅以 Heartfelt(BigWings, CC-BY-NC-SA) 作物理参考、零代码拷贝。
//
// 只在 #desktop 上画、仿真 app 内部一律不碰。纯 rAF + 与 rain.js 同款五道生命闸：
// 主题≠summer-rain / 桌面无 .active / 雨开关关 / prefers-reduced-motion / hidden。
// WebGL 不可用时 this.available=false，把雨交还 2D RainEngine 兜底（见 rain.js）。
//
// 可调参数集中在 GlassConfig（Chrome 实时预览陪作者一格格调）。

const GlassConfig = {
    THEME_NAME: 'summer-rain',     // 仅此主题启动
    TEX_URL: 'assets/textures/summer-rain-bg.webp', // 折射纹理（相对文档根，同 index.html 资源）

    // —— 性能 ——
    FPS_CAP: 30,                   // 帧率上限（雨不需要 60fps，省电）
    RENDER_SCALE: 0.8,             // 渲染分辨率系数（<1 降采样再由 CSS 拉伸，折射模糊看不出；邻格扫描后降一档省电）

    // —— 折射 / 雾 ——
    REFRACT_STRENGTH: 0.07,        // 折射强度（背景扭曲程度、水珠透镜感；越大水珠像放大镜）
    FOG_DENSITY: 0.24,             // 雾浓度（0=无雾 1=全糊）

    // —— 雨滴 ——
    DROP_DENSITY: 1.0,             // 雨滴密度总系数
    TRAIL_STRENGTH: 0.6,           // 雨滴拖痕明显度
    HIGHLIGHT_STRENGTH: 0.45,      // 水珠玻璃高光强度（左上受光亮边、越大越透亮发光）

    // —— 氛围 ——
    COLOR_BREATH_AMOUNT: 0.5,      // 冷暖色彩呼吸幅度（再乘进 shader 极淡常量、几乎不可察觉）
    COLOR_BREATH_SPEED: 0.18,      // 色彩呼吸速度(rad/s)
    LIGHT_GLOW_INTERVAL: 26.0,     // 天光微亮周期(s)，几十秒一次
    LIGHT_GLOW_AMOUNT: 0.6,        // 天光亮度（再乘进 shader 0.10 常量、克制）
    VIGNETTE_AMOUNT: 0.28,         // 四角暗角强度
};

const GlassRainEngine = {
    canvas: null,
    gl: null,
    program: null,
    quadBuf: null,
    tex: null,
    texReady: false,
    available: false,    // WebGL + program 就绪（同步在 init 决定；决定 2D 是否兜底）
    uniforms: {},        // uniform location 缓存
    dpr: 1,
    W: 0,                // CSS 像素宽
    H: 0,                // CSS 像素高
    rafId: null,
    running: false,
    enabled: true,       // 雨开关（settings 存盘，这里记当前态）
    startTs: 0,          // 起始时间戳（u_time 用相对秒、不依赖 Date）
    lastDraw: 0,         // 上次实际绘制时间戳（限帧用）
    _inited: false,
    _reducedMQ: null,

    // —— 顶点着色器：全屏四边形 ——
    VERT_SRC: [
        'attribute vec2 a_pos;',
        'void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }',
    ].join('\n'),

    // —— 片段着色器：雨天玻璃窗（折射 + 起雾 + 大小不一的下落水珠 + 玻璃高光）——
    FRAG_SRC: [
        'precision highp float;',
        'uniform sampler2D u_bg;',
        'uniform vec2  u_res;',
        'uniform float u_time;',      // 秒
        'uniform float u_refract;',
        'uniform float u_fog;',
        'uniform float u_dropDensity;',
        'uniform float u_trail;',
        'uniform float u_highlight;',
        'uniform float u_breathAmt;',
        'uniform float u_breathSpeed;',
        'uniform float u_glow;',      // CPU 端算好的天光脉冲 0..1
        'uniform float u_vignette;',
        // hash
        'float hash11(float p){ p=fract(p*0.1031); p*=p+33.33; p*=p+p; return fract(p); }',
        'vec2 hash22(vec2 p){',
        '  vec3 p3=fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973));',
        '  p3+=dot(p3,p3.yzx+33.33);',
        '  return fract((p3.xx+p3.yz)*p3.zy);',
        '}',
        // 一层下落雨滴 → 高度场。每格一滴（随机：有无/大小/水平位/格内垂直位），
        // 整层「匀速下滚」(st.y+=t*fall) = 水珠平滑跨格下落、无每格 fract 循环的瞬移。
        // ★扫上下相邻格(j=-1..1)让水珠/拖痕能跨格连续 = 消除「交界处水珠被裁掉」的板块缝。
        //   水平方向水珠不出格(cx∈[0.14,0.86]、半径折算后 reach∈[0.03,0.97])、故只扫纵向省 2/3 开销。
        // seed 让多层网格错开。fall = 该层下滚速度(格/秒)。
        'float dropLayer(vec2 uv, float t, vec2 g, float seed, float fall){',
        '  vec2 st=uv*g; st.y += t*fall;',
        '  vec2 id=floor(st);',
        '  vec2 f =fract(st);',
        '  float aspect=g.y/g.x;',
        '  float h=0.0;',
        '  for(int j=-1;j<=1;j++){',
        '    float fj=float(j);',
        '    vec2 cid=id+vec2(0.0,fj);',
        '    vec2 rnd=hash22(cid+seed);',
        '    float present=step(0.24, fract(rnd.x*rnd.y*97.0+seed));', // ~76% 格有滴、破规整网格
        '    float rsize=hash11(dot(cid,vec2(12.99,78.23))+seed);',
        '    float cx=0.5+(rnd.x-0.5)*0.72;',
        '    float cy=0.5+(rnd.y-0.5)*0.6;',         // 格内垂直随机位（静态、下落靠 st 下滚）
        '    float rad=0.07+rsize*0.15;',            // 0.07..0.22 大小不一
        '    vec2 dpos=vec2(cx, fj+cy);',
        '    float d=length((f-dpos)*vec2(aspect,1.0));',
        '    float drop=smoothstep(rad, rad*0.12, d);',
        '    float ty=f.y-dpos.y;',                  // drop 上方距离
        '    float trail=smoothstep(0.04,0.0,abs(f.x-cx))*smoothstep(0.0,0.08,ty)*smoothstep(0.75,0.12,ty);', // 有限长拖痕、防跨多格裁切
        '    h+=(drop+trail*u_trail*0.5)*present;',
        '  }',
        '  return h;',
        '}',
        // 三层 parallax：大/中/小 → 下滚速度递减（大水珠滑得快、小珠近静止），层间视差让落速差自然可感
        'float dropField(vec2 uv, float t){',
        '  float h=0.0;',
        '  h+=dropLayer(uv,           t, vec2(5.0,10.0),  0.0, 5.0);',       // 粗·大·快
        '  h+=dropLayer(uv*1.7+5.0,   t, vec2(5.0,10.0), 13.0, 3.0)*0.85;', // 中
        '  h+=dropLayer(uv*2.7+11.0,  t, vec2(5.0,10.0), 27.0, 1.6)*0.7;',  // 细·小·慢
        '  return clamp(h*u_dropDensity, 0.0, 1.6);',
        '}',
        'void main(){',
        '  vec2 uv=gl_FragCoord.xy/u_res;',
        '  float t=u_time;',
        '  float h=dropField(uv,t);',
        // 解析法线（2 次额外采样、不依赖 derivative 扩展 = cheap normals）。
        // 步长取数像素(STEP)放大坡度，否则单像素差分太小、折射≈不可见。
        '  vec2 e=3.0/u_res;',
        '  float hx=dropField(uv+vec2(e.x,0.0),t);',
        '  float hy=dropField(uv+vec2(0.0,e.y),t);',
        '  vec2 n=vec2(hx-h, hy-h);',
        // 折射采样：水珠越高折射越强 = 像放大镜透镜。
        // n 已是「3px 步长」的坡度(边缘可达 ~0.3)、直接当折射向量、不再额外放大。
        '  float lens=1.0+clamp(h,0.0,1.0)*1.4;',
        '  vec2 ruv=clamp(uv + n*u_refract*lens, 0.001, 0.999);',
        '  vec3 col=texture2D(u_bg, ruv).rgb;',
        // 起雾玻璃：drop/trail 处把雾擦清（透亮）
        '  vec3 fogCol=vec3(0.82,0.87,0.92);',
        '  float clearness=clamp(h*1.3,0.0,1.0);',
        '  col=mix(mix(col,fogCol,u_fog), col, clearness);',
        // 玻璃高光：水珠曲面左上受光的亮边 → 透亮发光感（n 同上量级、系数 ~4）
        '  float spec=clamp((-n.x*0.7 + n.y*1.0)*4.0, 0.0, 1.0);',
        '  spec*=smoothstep(0.04,0.5,h);',          // 只在水珠上
        '  col+=spec*u_highlight*vec3(1.0,1.0,1.0);',
        // 极淡冷暖呼吸
        '  float breath=sin(t*u_breathSpeed)*0.5+0.5;',
        '  col*=mix(vec3(1.0), vec3(0.965,0.985,1.04), breath*u_breathAmt);',
        // 偶尔天光
        '  col+=u_glow*0.10;',
        // 暗角
        '  vec2 vc=uv-0.5;',
        '  col*=1.0 - dot(vc,vc)*u_vignette;',
        '  gl_FragColor=vec4(col,1.0);',
        '}',
    ].join('\n'),

    init() {
        if (this._inited) { this.evaluate(); return; }
        this._inited = true;

        const desktop = document.getElementById('desktop');
        if (!desktop) return;

        // 建 canvas（内联定位：z-index:0 在图标之下、绕过 #desktop>* 的 relative/z1 压制）。
        // ★白条修法：用 width/height:100% 让 canvas 显示尺寸跟 #desktop 走（#desktop 是 .screen
        //   fixed+bottom:-env、已验证铺到物理底）。canvas 是替换元素、inset:0/auto 撑不开它，
        //   但显式 height:100% 是「确定值」会生效 → 显示尺寸由 CSS 定、不依赖 JS 测高度（iOS 对
        //   fixed 元素 rect 有量化怪癖、上一版测高度修法在真机没生效）→ 无论测量准不准都不留底缝。
        const canvas = document.createElement('canvas');
        canvas.id = 'rainGlassCanvas';
        canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;';
        desktop.appendChild(canvas);
        this.canvas = canvas;

        // 取 WebGL 上下文（alpha:true 让纹理未就绪时透出 CSS 背景图兜底）
        const opts = { alpha: true, premultipliedAlpha: false, antialias: false,
                       depth: false, stencil: false, powerPreference: 'low-power' };
        const gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts);
        if (!gl) { this.available = false; canvas.remove(); this.canvas = null; this._bindGates(desktop); return; }
        this.gl = gl;

        // 编译链接 program；失败则放弃 WebGL、交给 2D 兜底
        const program = this._buildProgram(gl, this.VERT_SRC, this.FRAG_SRC);
        if (!program) { this.available = false; canvas.remove(); this.canvas = null; this.gl = null; this._bindGates(desktop); return; }
        this.program = program;

        // 全屏四边形（TRIANGLE_STRIP）
        this.quadBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

        // uniform location
        gl.useProgram(program);
        this.uniforms.u_bg          = gl.getUniformLocation(program, 'u_bg');
        this.uniforms.u_res         = gl.getUniformLocation(program, 'u_res');
        this.uniforms.u_time        = gl.getUniformLocation(program, 'u_time');
        this.uniforms.u_refract     = gl.getUniformLocation(program, 'u_refract');
        this.uniforms.u_fog         = gl.getUniformLocation(program, 'u_fog');
        this.uniforms.u_dropDensity = gl.getUniformLocation(program, 'u_dropDensity');
        this.uniforms.u_trail       = gl.getUniformLocation(program, 'u_trail');
        this.uniforms.u_highlight   = gl.getUniformLocation(program, 'u_highlight');
        this.uniforms.u_breathAmt   = gl.getUniformLocation(program, 'u_breathAmt');
        this.uniforms.u_breathSpeed = gl.getUniformLocation(program, 'u_breathSpeed');
        this.uniforms.u_glow        = gl.getUniformLocation(program, 'u_glow');
        this.uniforms.u_vignette    = gl.getUniformLocation(program, 'u_vignette');

        // 纹理：NPOT 安全（CLAMP_TO_EDGE + LINEAR、不生 mipmap；雾靠颜色混合不靠 mip）
        this.tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        // 先填 1x1 占位，图加载完再替换
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                      new Uint8Array([200, 215, 230, 255]));
        const img = new Image();
        img.onload = () => {
            const g = this.gl; if (!g) return;
            g.bindTexture(g.TEXTURE_2D, this.tex);
            g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true); // 让图正立（texture v=0 对屏幕底）
            g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, img);
            this.texReady = true;
        };
        img.onerror = () => { this.texReady = false; }; // 图挂了：保持透出 CSS 背景，仍算 available
        img.src = GlassConfig.TEX_URL;

        // 着色器 + 上下文就绪 = 可用（纹理异步、未就绪时透出 CSS 兜底）
        this.available = true;
        gl.clearColor(0, 0, 0, 0);

        // context lost/restored（iOS 内存压力下 GPU 可能被回收）
        canvas.addEventListener('webglcontextlost', (e) => this._onContextLost(e), false);
        canvas.addEventListener('webglcontextrestored', () => this._onContextRestored(), false);

        this._reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
        this._bindGates(desktop);
        this._resize();
        this.evaluate();
    },

    // —— 绑五道闸的监听（即便 WebGL 不可用也绑，便于切主题时让 2D 兜底重判）——
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

    // —— 编译 + 链接，失败返回 null 并打日志 ——
    _buildProgram(gl, vsrc, fsrc) {
        const vs = this._compile(gl, gl.VERTEX_SHADER, vsrc);
        const fs = this._compile(gl, gl.FRAGMENT_SHADER, fsrc);
        if (!vs || !fs) return null;
        const p = gl.createProgram();
        gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
            console.warn('[GlassRain] program link failed:', gl.getProgramInfoLog(p));
            return null;
        }
        return p;
    },
    _compile(gl, type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            console.warn('[GlassRain] shader compile failed:', gl.getShaderInfoLog(s), '\n', src);
            return null;
        }
        return s;
    },

    setEnabled(enabled) { this.enabled = !!enabled; this.evaluate(); },

    // —— 五道闸：任一成立则不跑 ——
    _shouldRun() {
        if (!this.canvas || !this.gl || !this.available) return false;
        if (document.documentElement.dataset.theme !== GlassConfig.THEME_NAME) return false;
        const desktop = document.getElementById('desktop');
        if (!desktop || !desktop.classList.contains('active')) return false;
        if (!this.enabled) return false;
        if (document.body.classList.contains('rain-off')) return false;
        if (this._reducedMQ && this._reducedMQ.matches) return false;
        if (document.hidden) return false;
        return true;
    },

    evaluate() { if (this._shouldRun()) this._start(); else this._stop(); },

    _start() {
        if (this.running) return;
        if (!this.W || !this.H) this._resize();
        this.running = true;
        if (this.canvas) this.canvas.style.display = '';
        this.startTs = 0; this.lastDraw = 0;
        this.rafId = requestAnimationFrame((ts) => this._loop(ts));
    },

    _stop() {
        this.running = false;
        if (this.rafId != null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
        if (this.gl && this.W) { this.gl.clear(this.gl.COLOR_BUFFER_BIT); } // 清成透明
        if (this.canvas) this.canvas.style.display = 'none';
    },

    // —— 尺寸：canvas 显示框由 CSS width/height:100% 撑满 #desktop（铺到物理底、不留底缝、见 init 注释）。
    //   这里只按 canvas 实际渲染尺寸算 backing store（降采样）。canvas 已被 100% 撑开，
    //   getBoundingClientRect 取到的就是撑满后的真实尺寸。即便 iOS 测量略偏，显示由 CSS 100% 主导、不会留缝。
    _resize() {
        if (!this.canvas || !this.gl) return;
        const rect = this.canvas.getBoundingClientRect();
        const w = rect.width, h = rect.height;
        if (!w || !h) return;
        const dpr = window.devicePixelRatio || 1;
        this.dpr = dpr; this.W = w; this.H = h;
        const bw = Math.max(1, Math.round(w * dpr * GlassConfig.RENDER_SCALE));
        const bh = Math.max(1, Math.round(h * dpr * GlassConfig.RENDER_SCALE));
        this.canvas.width = bw; this.canvas.height = bh;
        this.gl.viewport(0, 0, bw, bh);
    },

    // —— 主循环：限帧 + 透传绘制 ——
    _loop(ts) {
        if (!this.running) return;
        this.rafId = requestAnimationFrame((t) => this._loop(t));
        // 限帧
        const minDelta = 1000 / GlassConfig.FPS_CAP;
        if (this.lastDraw && ts - this.lastDraw < minDelta) return;
        this.lastDraw = ts;
        this._draw(ts);
    },

    _draw(ts) {
        const gl = this.gl; if (!gl) return;
        if (this.startTs === 0) this.startTs = ts;
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (!this.texReady) return; // 纹理没好：透出 CSS 背景图兜底
        gl.useProgram(this.program);
        // 顶点
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
        const loc = gl.getAttribLocation(this.program, 'a_pos');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        // 纹理
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.uniform1i(this.uniforms.u_bg, 0);
        // uniform
        const C = GlassConfig;
        const timeSec = (ts - this.startTs) / 1000;
        // 天光：每 LIGHT_GLOW_INTERVAL 秒一记短促脉冲（sin 峰再 8 次幂收窄），按区段 hash 随机强弱
        const gp = timeSec / C.LIGHT_GLOW_INTERVAL;
        const seg = Math.floor(gp);
        const phase = gp - seg;
        const bump = Math.pow(Math.max(0, Math.sin(phase * Math.PI)), 8);
        const segRand = ((Math.sin(seg * 91.17) * 43758.5453) % 1 + 1) % 1; // 0..1 区段随机
        const glow = bump * (0.4 + 0.6 * segRand) * C.LIGHT_GLOW_AMOUNT;
        gl.uniform2f(this.uniforms.u_res, this.canvas.width, this.canvas.height);
        gl.uniform1f(this.uniforms.u_time, timeSec);
        gl.uniform1f(this.uniforms.u_refract, C.REFRACT_STRENGTH);
        gl.uniform1f(this.uniforms.u_fog, C.FOG_DENSITY);
        gl.uniform1f(this.uniforms.u_dropDensity, C.DROP_DENSITY);
        gl.uniform1f(this.uniforms.u_trail, C.TRAIL_STRENGTH);
        gl.uniform1f(this.uniforms.u_highlight, C.HIGHLIGHT_STRENGTH);
        gl.uniform1f(this.uniforms.u_breathAmt, C.COLOR_BREATH_AMOUNT);
        gl.uniform1f(this.uniforms.u_breathSpeed, C.COLOR_BREATH_SPEED);
        gl.uniform1f(this.uniforms.u_glow, glow);
        gl.uniform1f(this.uniforms.u_vignette, C.VIGNETTE_AMOUNT);
        // 画
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },

    _onContextLost(e) {
        e.preventDefault();              // 阻止默认 = 允许后续 restore
        this.available = false;          // 让 2D 兜底
        this.texReady = false;
        this._stop();
        if (window.RainEngine) RainEngine.evaluate(); // 2D 重判接管
        console.warn('[GlassRain] WebGL context lost → 交 2D 兜底');
    },
    _onContextRestored() {
        // 重建 program / buffer / texture（gl 对象本身仍是同一个，资源已失效）
        const gl = this.gl; if (!gl) return;
        this.program = this._buildProgram(gl, this.VERT_SRC, this.FRAG_SRC);
        if (!this.program) { this.available = false; return; }
        gl.useProgram(this.program);
        // 重取 uniform location
        const names = ['u_bg','u_res','u_time','u_refract','u_fog','u_dropDensity',
                       'u_trail','u_highlight','u_breathAmt','u_breathSpeed','u_glow','u_vignette'];
        this.uniforms = {};
        names.forEach(n => { this.uniforms[n] = gl.getUniformLocation(this.program, n); });
        // 重建 quad
        this.quadBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
        // 重建纹理（重新加载图）
        this.tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                      new Uint8Array([200, 215, 230, 255]));
        this.texReady = false;
        const img = new Image();
        img.onload = () => {
            const g = this.gl; if (!g) return;
            g.bindTexture(g.TEXTURE_2D, this.tex);
            g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
            g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, img);
            this.texReady = true;
        };
        img.src = GlassConfig.TEX_URL;
        gl.clearColor(0, 0, 0, 0);
        this.available = true;
        if (window.RainEngine) RainEngine.evaluate(); // 2D 让位
        this.evaluate();                               // shader 重新接管
        console.warn('[GlassRain] WebGL context restored → 重建资源接管');
    },
};

window.GlassRainEngine = GlassRainEngine;
