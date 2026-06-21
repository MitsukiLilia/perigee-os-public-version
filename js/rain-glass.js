// Perigee OS — 夏雨主题 WebGL「真折射玻璃窗」引擎（v2.116.0）
//
// 桌面背景层一块全屏 <canvas>（z-index:0 在图标之下、当活壁纸），用自写 GLSL
// 把 seascape-bg.webp（清晰室外海景）+ seascape-bg-blur.webp（预模糊）当双纹理：整片玻璃默认采
// 模糊图＝真起雾看不清外面，水珠/水痕擦出清晰图＝透镜看到清晰室外（Heartfelt 灵魂）。图标/widget 浮其上。
// GLSL 全部自己写，仅以 Heartfelt(BigWings, CC-BY-NC-SA) 作物理参考、零代码拷贝。
//
// 只在 #desktop 上画、仿真 app 内部一律不碰。纯 rAF + 与 rain.js 同款五道生命闸：
// 主题≠summer-rain / 桌面无 .active / 雨开关关 / prefers-reduced-motion / hidden。
// WebGL 不可用时 this.available=false，把雨交还 2D RainEngine 兜底（见 rain.js）。
//
// 可调参数集中在 GlassConfig（Chrome 实时预览陪作者一格格调）。

const GlassConfig = {
    THEME_NAME: 'summer-rain',     // 仅此主题启动
    TEX_URL: 'assets/textures/seascape-bg.webp',           // 清晰室外海景（折射 + 水珠透镜露它）
    BLUR_TEX_URL: 'assets/textures/seascape-bg-blur.webp', // 预模糊版（起雾态、雾区采它）

    // —— 性能 ——
    FPS_CAP: 30,                   // 帧率上限（雨不需要 60fps，省电）
    RENDER_SCALE: 0.8,             // 渲染分辨率系数（<1 降采样再由 CSS 拉伸，折射模糊看不出；邻格扫描后降一档省电）

    // —— 折射 / 雾 ——
    REFRACT_STRENGTH: 0.10,        // 折射强度（雨滴透镜偏移背景的量；越大水珠像放大镜。V4 风力版用 0.1）
    FOG_DENSITY: 0.86,             // 起雾浓度（雾区采模糊图的比例；0=全清晰 1=全糊。真模糊、非颜色冲淡）

    // —— 雨滴 ——
    DROP_DENSITY: 1.0,             // 雨滴密度总系数
    TRAIL_STRENGTH: 1.0,           // 雨滴拖痕明显度
    HIGHLIGHT_STRENGTH: 0.15,      // 玻璃高光（默认很低；雨滴的亮主要靠折射放大背景、不靠假白光）
    DISTANT_RAIN_STRENGTH: 0,      // 远处海面雨幕浓度（0=关）。作者定稿：去掉远景斜雨丝、只留玻璃窗水珠（平行斜线太规整不自然）。distantRain 代码留存，想要更自然的「海上雨」层次随时调回 0.05 起步

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
    texBlur: null,       // 模糊版纹理（真起雾：雾区采它；占位色兜底，加载完替换）
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
        'uniform sampler2D u_bg;',      // 清晰室外
        'uniform sampler2D u_bgBlur;',  // 预模糊（起雾态）
        'uniform vec2  u_res;',
        'uniform float u_time;',      // 秒
        'uniform float u_refract;',
        'uniform float u_fog;',
        'uniform float u_dropDensity;',
        'uniform float u_trail;',
        'uniform float u_highlight;',
        'uniform float u_distantRain;',
        'uniform float u_breathAmt;',
        'uniform float u_breathSpeed;',
        'uniform float u_glow;',      // CPU 端算好的天光脉冲 0..1
        'uniform float u_vignette;',
        // 通用 hash（Dave Hoskins 风格、被广泛使用的伪随机，非某作品独有）
        'float hash11(float p){ p=fract(p*0.1031); p*=p+33.33; p*=p+p; return fract(p); }',
        'vec3 hash31(float p){',
        '  vec3 p3=fract(vec3(p)*vec3(0.1031,0.11369,0.13787));',
        '  p3+=dot(p3,p3.yzx+19.19);',
        '  return fract(vec3((p3.x+p3.y)*p3.z,(p3.x+p3.z)*p3.y,(p3.y+p3.z)*p3.x));',
        '}',
        // 不对称缓动（停—冲—停）：大半时间近静止、末段加速下滑 = 表面张力克服后的「走停」感
        'float ease(float x){ return smoothstep(0.0,0.85,x)*smoothstep(1.0,0.85,x); }',
        // 静态水汽层：玻璃上凝结的细小水珠（缓慢淡入淡出），只提供细节、不主导清晰度
        'float staticField(vec2 uv, float t){',
        '  uv*=32.0;',
        '  vec2 id=floor(uv);',
        '  vec2 st=fract(uv)-0.5;',
        '  vec3 n=hash31(id.x*107.45+id.y*3543.654);',
        '  float rad=0.10+n.z*0.22;',                        // 每颗水汽珠随机大小（不再一刀切）
        '  float life=fract(t*0.45+n.x*7.3+n.y*3.1);',       // 慢生命周期、每格错相位
        '  float slip=step(0.72,n.z);',                      // 约 1/4 的珠子会「长大→滑落」
        '  float slide=slip*smoothstep(0.45,1.0,life)*0.85;',// 走停下滑量（前段凝结不动、末段才滑）
        '  vec2 ctr=vec2((n.x-0.5)*0.55, (n.y-0.5)*0.5-slide);',
        '  float drop=smoothstep(rad,rad*0.35,length(st-ctr));',
        '  float above=step(ctr.y,st.y)*step(st.y,ctr.y+slide+0.15);',
        '  float tr=slip*smoothstep(0.045,0.0,abs(st.x-ctr.x))*above*smoothstep(ctr.y+slide+0.15,ctr.y,st.y)*0.35;', // 滑落短拖痕
        '  float fade=ease(life);',
        '  return (drop+tr)*fade;',
        '}',
        // 远处海面雨幕：很淡的斜向细雨丝（远景大气、不是玻璃水珠、不参与折射）。
        //   只在海平线以下淡入，让「近处玻璃水珠 + 远处海上还在下雨」有层次。
        'float distantRain(vec2 uv, float t){',
        '  vec2 p=uv;',
        '  p.x+=p.y*0.25;',                       // 雨丝斜向
        '  p*=vec2(90.0,5.0);',                   // x 密集竖纹、y 拉长成丝
        '  float colId=floor(p.x);',
        '  p.y+=t+hash11(colId)*12.0;',           // 下落 + 每列错相位
        '  float line=1.0-smoothstep(0.0,0.08,abs(fract(p.x)-0.5));', // 窄竖线
        '  float fy=fract(p.y);',
        '  float seg=smoothstep(0.0,0.25,fy)*smoothstep(1.0,0.65,fy);', // 断续雨丝段
        '  return line*seg*(0.35+0.65*hash11(colId*1.7+3.1));',
        '}',
        // 一层下落雨滴标量场 → vec2(雨滴覆盖, 拖痕覆盖)。竖条网格(重力纵向拉伸)+每列随机相位
        //   +走停下落+蜿蜒横摆+拖痕残渣。★参考 Heartfelt 物理建模思路、本引擎自己实现：
        //   折射不在这里做(交给 main 用本场的「梯度法线」)、雾交给双图——这才是「像真玻璃」的关键。
        'vec2 dropField(vec2 uv, float t){',
        '  vec2 UV=uv;',
        '  uv.y+=t*0.75;',                       // 整体向下流（竖直、不整片横移＝避免像视频左右晃）
        '  vec2 cell=vec2(12.0,2.0);',           // 竖条 6:1（重力把雨滴纵向拉长）
        '  vec2 id=floor(uv*cell);',
        '  uv.y+=hash11(id.x);',                 // 每列随机相位错开
        '  id=floor(uv*cell);',
        '  vec2 st=fract(uv*cell)-vec2(0.5,0.0);',
        '  vec3 n=hash31(id.x*35.2+id.y*2376.1);',
        '  float x=n.x-0.5;',
        '  float yw=UV.y*20.0;',
        '  x+=(sin(yw)*0.6+sin(yw*1.7+1.0)*0.4)*(0.5-abs(x))*(n.z-0.5);', // 蜿蜒：多频正弦横摆、像小蛇
        '  x*=0.7;',
        '  float ti=fract(t+n.z);',
        '  float y=(ease(ti)-0.5)*0.9+0.5;',      // 走停下落
        '  vec2 p=vec2(x,y);',
        '  float rad=0.30+n.z*0.22;',             // 每滴随机大小（不再千篇一律）
        '  float drop=smoothstep(rad,0.0,length((st-p)*cell.yx*0.5));', // 主雨滴（cell.yx*0.5 修正长宽比成圆）
        '  float r=sqrt(smoothstep(1.0,y,st.y));',
        '  float front=smoothstep(-0.02,0.02,st.y-y);',
        '  float cd=abs(st.x-x);',
        '  float trail=smoothstep(0.23*r,0.15*r*r,cd)*front*r*r;', // 雨滴上方的水痕
        '  float my=fract(UV.y*10.0)+(st.y-0.5);',
        '  float micro=smoothstep(0.3,0.0,length(st-vec2(x,my)))*r*front;', // 拖痕里残留的小水渣
        '  return vec2((drop+micro)*u_dropDensity, trail*u_trail);',
        '}',
        'void main(){',
        '  vec2 uv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;', // 按 y 归一的中心坐标 = 长宽比正确、雨滴不斜拉
        '  vec2 UV=gl_FragCoord.xy/u_res;',               // 背景采样用 0..1
        '  float t=u_time*0.2;',
        '  vec2 dc=dropField(uv,t);',                     // x=雨滴覆盖, y=拖痕（竖直下落、无整片横移）
        '  float drop=dc.x;',
        // 法线 = 雨滴标量场的梯度（邻域差分、不依赖 derivative 扩展）→ 真玻璃折射的关键
        '  vec2 e=vec2(2.5/u_res.y, 0.0);',
        '  float dx=dropField(uv+e,t).x;',
        '  float dy=dropField(uv+e.yx,t).x;',
        '  vec2 nrm=vec2(dx-drop, dy-drop);',
        '  float st0=staticField(uv,t);',                 // 静态水汽（只加细节、不入法线）
        '  float cover=clamp(st0*1.5+drop, 0.0, 1.0);',
        // 双图雾：雾区采模糊图（玻璃先有雾），雨滴主体 + 拖痕「刮开」雾露出清晰
        '  float clearness=clamp(smoothstep(0.1,0.3,cover)+dc.y*0.6, 0.0, 1.0);',
        '  vec2 ruv=clamp(UV + nrm*u_refract, 0.001, 0.999);',
        '  vec3 sharpR=texture2D(u_bg, ruv).rgb;',          // 清晰图：被水珠法线折射（透镜凸起）
        '  vec3 sharpF=texture2D(u_bg, UV).rgb;',           // 清晰图：原位（雾基底的清晰成分）
        '  vec3 blurF=texture2D(u_bgBlur, UV).rgb;',        // 模糊图：原位、不折射（雾是平的、不该被扭）
        '  vec3 foggy=mix(sharpF, blurF, u_fog);',          // 雾基底（原位、浓度可调）
        '  float seaMask=smoothstep(0.62,0.40,UV.y);',      // 海平线(≈0.62)以下淡入远景雨幕
        '  float dRain=distantRain(uv,u_time*1.3)*seaMask;',
        '  foggy+=vec3(dRain*0.9,dRain*0.95,dRain)*u_distantRain;', // 远处雨幕叠在雾上（偏冷白、近处水珠盖其上）
        '  vec3 col=mix(foggy, sharpR, clearness);',        // 雾区显原位雾+远雨、水珠/拖痕区显折射清晰
        // 极淡玻璃高光（雨滴受光亮边、默认很低）
        '  float spec=clamp(nrm.y*3.0, 0.0, 1.0)*smoothstep(0.2,0.9,cover);',
        '  col+=vec3(spec*u_highlight);',
        // 冷色调：阴雨沉闷感
        '  float luma=dot(col, vec3(0.333));',
        '  col=mix(col, vec3(0.5,0.6,0.7)*luma, 0.20);',
        // 极淡冷暖呼吸 + 偶尔天光
        '  float breath=sin(u_time*u_breathSpeed)*0.5+0.5;',
        '  col*=mix(vec3(1.0), vec3(0.965,0.985,1.04), breath*u_breathAmt);',
        '  col+=u_glow*0.10;',
        // 暗角
        '  vec2 vc=UV-0.5;',
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
        this.uniforms.u_bgBlur      = gl.getUniformLocation(program, 'u_bgBlur');
        this.uniforms.u_res         = gl.getUniformLocation(program, 'u_res');
        this.uniforms.u_time        = gl.getUniformLocation(program, 'u_time');
        this.uniforms.u_refract     = gl.getUniformLocation(program, 'u_refract');
        this.uniforms.u_fog         = gl.getUniformLocation(program, 'u_fog');
        this.uniforms.u_dropDensity = gl.getUniformLocation(program, 'u_dropDensity');
        this.uniforms.u_trail       = gl.getUniformLocation(program, 'u_trail');
        this.uniforms.u_highlight   = gl.getUniformLocation(program, 'u_highlight');
        this.uniforms.u_distantRain = gl.getUniformLocation(program, 'u_distantRain');
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

        // —— 第二纹理：预模糊版（真起雾，雾区采它）。流程同上、加载完替换占位色，无需 ready 闸
        //    （清晰图好了就画；模糊图未到时雾区显淡蓝灰占位、平滑降级不黑屏）——
        this.texBlur = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texBlur);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                      new Uint8Array([150, 170, 195, 255]));
        const imgB = new Image();
        imgB.onload = () => {
            const g = this.gl; if (!g) return;
            g.bindTexture(g.TEXTURE_2D, this.texBlur);
            g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
            g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, imgB);
        };
        imgB.src = GlassConfig.BLUR_TEX_URL;

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
        // WebGL 就绪(available=true)后主动叫 2D RainEngine 重新评估 → 让位（根治两套雨共存）：
        // 若 2D 在本引擎 available 之前抢先 _start 跑起来，单靠 RainEngine 自己的监听不会回头停，
        // 这里 init 末尾通知它 evaluate → _shouldRun 见 Glass.available=true → stop。修 init 时序竞争。
        if (window.RainEngine && RainEngine.evaluate) RainEngine.evaluate();
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
        // 纹理：清晰图 → TEXTURE0，模糊图 → TEXTURE1
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.uniform1i(this.uniforms.u_bg, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.texBlur);
        gl.uniform1i(this.uniforms.u_bgBlur, 1);
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
        gl.uniform1f(this.uniforms.u_distantRain, C.DISTANT_RAIN_STRENGTH);
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
        const names = ['u_bg','u_bgBlur','u_res','u_time','u_refract','u_fog','u_dropDensity',
                       'u_trail','u_highlight','u_distantRain','u_breathAmt','u_breathSpeed','u_glow','u_vignette'];
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

        // 重建第二纹理（模糊版），同 init
        this.texBlur = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texBlur);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                      new Uint8Array([150, 170, 195, 255]));
        const imgB = new Image();
        imgB.onload = () => {
            const g = this.gl; if (!g) return;
            g.bindTexture(g.TEXTURE_2D, this.texBlur);
            g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
            g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, imgB);
        };
        imgB.src = GlassConfig.BLUR_TEX_URL;
        gl.clearColor(0, 0, 0, 0);
        this.available = true;
        if (window.RainEngine) RainEngine.evaluate(); // 2D 让位
        this.evaluate();                               // shader 重新接管
        console.warn('[GlassRain] WebGL context restored → 重建资源接管');
    },
};

window.GlassRainEngine = GlassRainEngine;
