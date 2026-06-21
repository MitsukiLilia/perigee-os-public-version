// Perigee OS — 夏雨主题真·液态玻璃折射（仅 Chromium 引擎；iPhone/WebKit、Firefox 自动退磨砂）
//
// 原理：backdrop-filter: url(#SVG feDisplacementMap) —— 把身后背景按一张灰度位移图折弯。
// 这是 Chromium 独占能力（Safari/WebKit、Firefox 不渲染位移）。仅以 rizroze/liquid-glass
// 为原理参考、代码全自写（同 rain-glass.js 自写 GLSL 的做法），MIT/AGPL 干净。
//
// 只动 #desktop 前景元素（Dock/widget/图标）、仿真 app 一律不碰。
// 支持检测通过 → <body> 加 lg-supported；CSS 仅在该 class + 夏雨主题下启用折射，
// 不支持的引擎没这个 class → CSS 自然走磨砂、零回归。
//
// 三种视觉配置（见 css/themes.css）：
//   高/auto-高端 = Dock+widget+图标全折射；auto-低端 = Dock+widget 折射 + 图标磨砂；
//   关/iPhone/不支持 = 全磨砂。
//
// 可调参数集中在 LGConfig（Chrome 实时预览微调，同 rain-glass GlassConfig）。

const LGConfig = {
    THEME_NAME: 'summer-rain',
    DISPLACE_SCALE: 45,     // feDisplacementMap scale（折射强度、px）
    BEVEL_FRAC: 0.7,        // 透镜带占元素半宽/半高的比例（边缘折射的「玻璃厚度」感；越大透镜越宽）
    // 代表性位移图尺寸（按形状；preserveAspectRatio=none 拉伸贴元素）
    MAP: {
        icon:  { w: 64,  h: 64,  r: 18 },   // 图标固定 64px、精确匹配
        dock:  { w: 240, h: 60,  r: 30 },   // Dock 药丸代表尺寸
        clock: { w: 160, h: 160, r: 16 },   // widget 卡片代表尺寸（含 clock/music）
    },
    // 自动降级设备分档阈值（任一不足即图标降级）
    MIN_MEMORY_GB: 4,
    MIN_CORES: 4,
    PROBE_MIN_FPS: 24,      // FPS 探针低于此 → 图标降级
};

const LiquidGlass = {
    supported: false,
    _inited: false,
    _quality: 'auto',       // 'auto' | 'high' | 'off'
    _autoTier: null,        // 'full' | 'degrade'（auto 解析结果）
    _probed: false,
    _probing: false,
    _reducedMQ: null,

    // —— 引擎探测：backdrop-filter:url(SVG) 是 Chromium 独占 ——
    // 主信号 navigator.userAgentData（Client Hints 结构化、非脆弱 UA 字符串）：
    //   安卓/桌面 Chrome 暴露且 brands 含 Chromium；iOS WebKit 与 Firefox 不暴露 → 挡掉。
    // 注意：CSS.supports('backdrop-filter','url(#x)') 在 Safari 对语法返回 true 但不渲染、不可用。
    isSupported() {
        const uaData = navigator.userAgentData;
        if (!uaData || !Array.isArray(uaData.brands)) return false;        // Safari/Firefox 无 userAgentData
        if (uaData.platform === 'iOS') return false;                       // iOS 上的 Chromium 壳仍是 WebKit
        const isBlink = uaData.brands.some(b => /Chromium|Google Chrome|Microsoft Edge/i.test(b.brand));
        if (!isBlink) return false;
        // 兜底：基础 backdrop-filter 也得支持
        return !!(window.CSS && CSS.supports && (CSS.supports('backdrop-filter', 'blur(1px)') ||
                CSS.supports('-webkit-backdrop-filter', 'blur(1px)')));
    },

    init() {
        if (this._inited) return;
        this._inited = true;
        this.supported = this.isSupported();
        if (!this.supported) return;             // 不支持：什么都不做，CSS 走磨砂
        document.documentElement.classList.add('lg-supported'); // 与 data-theme 同在 <html>、CSS 复合选择器才匹配
        this._injectFilters();
        this._applyEffectiveState();
        // 夏雨激活 / 回到前台 / 开雨 时跑一次 FPS 探针（设备分档是即时默认、探针事后校正）。
        // 监听这些变化 = 若首次不满足探针资格（后台/关雨/非夏雨），等条件恢复再自动重测，避免误判被永久缓存。
        this._reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
        const reprobe = () => this._maybeProbe();
        new MutationObserver(reprobe).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        const desktop = document.getElementById('desktop');
        if (desktop) new MutationObserver(reprobe).observe(desktop, { attributes: true, attributeFilter: ['class'] });
        new MutationObserver(reprobe).observe(document.body, { attributes: true, attributeFilter: ['class'] }); // rain-off 开关
        document.addEventListener('visibilitychange', reprobe);
        if (this._reducedMQ.addEventListener) this._reducedMQ.addEventListener('change', reprobe);
        else if (this._reducedMQ.addListener) this._reducedMQ.addListener(reprobe);
        this._maybeProbe();
    },

    // 生成一张灰度位移图：R=X 位移、G=Y 位移、128=中性(不动)。
    // 圆角矩形 SDF（d<0 内部、0 在边）→ 边缘 bevel 带内按 -法线 把背景往中心拉 = 边缘透镜。
    _makeMap(w, h, radius, bevel) {
        const cnv = document.createElement('canvas');
        cnv.width = w; cnv.height = h;
        const ctx = cnv.getContext('2d');
        const img = ctx.createImageData(w, h);
        const data = img.data;
        const bx = w / 2, by = h / 2;
        const sdf = (x, y) => {
            const qx = Math.abs(x - bx) - (bx - radius);
            const qy = Math.abs(y - by) - (by - radius);
            const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
            return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - radius;
        };
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const d  = sdf(x, y);
                const gx = sdf(x + 1, y) - sdf(x - 1, y);   // 法线（有限差分）
                const gy = sdf(x, y + 1) - sdf(x, y - 1);
                const len = Math.hypot(gx, gy) || 1;
                let amt = 0;
                if (d > -bevel && d < 0) { amt = 1 + d / bevel; amt *= amt; } // 带内 0→1、缓动
                const dx = -(gx / len) * amt;               // 往中心拉
                const dy = -(gy / len) * amt;
                const i = (y * w + x) * 4;
                data[i]     = Math.round(128 + dx * 127);
                data[i + 1] = Math.round(128 + dy * 127);
                data[i + 2] = 128;
                data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return cnv.toDataURL('image/png');
    },

    // 注入一个隐藏 SVG，含 3 个共享 filter。feImage 用 100%/preserveAspectRatio=none
    // 拉伸贴元素（Dock/widget 尺寸可变、靠拉伸贴四边；圆角轮廓略变、subtle 不可察）。
    // filter region 放宽到 -20%/140%，让边缘往外采到真实背景、避免黑边。
    // ★用 wrapper div 的 innerHTML 解析 <svg>（触发 HTML 解析器 foreign-content 模式、
    //   正确建 SVG 命名空间节点）；直接给 svg 元素 setAttribute/innerHTML 会落进 HTML 命名空间致 filter 失效。
    _injectFilters() {
        if (document.getElementById('lg-defs')) return;
        const M = LGConfig.MAP, s = LGConfig.DISPLACE_SCALE, bf = LGConfig.BEVEL_FRAC;
        const bevel = (m) => Math.min(m.w, m.h) / 2 * bf;   // 透镜带宽 = 半短边 × 比例
        const maps = {
            'lg-icon':  this._makeMap(M.icon.w,  M.icon.h,  M.icon.r,  bevel(M.icon)),
            'lg-dock':  this._makeMap(M.dock.w,  M.dock.h,  M.dock.r,  bevel(M.dock)),
            'lg-clock': this._makeMap(M.clock.w, M.clock.h, M.clock.r, bevel(M.clock)),
        };
        const filt = (id, href) =>
            `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">` +
              `<feImage href="${href}" xlink:href="${href}" x="0" y="0" width="100%" height="100%" ` +
                `preserveAspectRatio="none" result="map"/>` +
              `<feDisplacementMap in="SourceGraphic" in2="map" scale="${s}" ` +
                `xChannelSelector="R" yChannelSelector="G"/>` +
            `</filter>`;
        const html =
            `<svg id="lg-defs" width="0" height="0" aria-hidden="true" ` +
            `xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
            `style="position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;">` +
            `<defs>` + Object.entries(maps).map(([id, href]) => filt(id, href)).join('') + `</defs></svg>`;
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
        wrap.innerHTML = html;
        document.body.appendChild(wrap.firstChild);
    },

    // —— 质量分档 ——
    // 纯函数：设备/帧率信号 → 'full' | 'degrade'。任一信号偏低即图标降级。
    _classifyTier(sig) {
        if (sig.fps != null && sig.fps < LGConfig.PROBE_MIN_FPS) return 'degrade';
        if (sig.memory != null && sig.memory < LGConfig.MIN_MEMORY_GB) return 'degrade';
        if (sig.cores != null && sig.cores < LGConfig.MIN_CORES) return 'degrade';
        return 'full';
    },
    _deviceTierGuess() {
        return this._classifyTier({
            memory: navigator.deviceMemory != null ? navigator.deviceMemory : null,
            cores:  navigator.hardwareConcurrency != null ? navigator.hardwareConcurrency : null,
            fps:    null,
        });
    },
    _resolveAutoTier() {
        if (this._autoTier) return this._autoTier;            // 已有 FPS 探针结果（缓存）优先
        return this._deviceTierGuess();
    },
    // 把 _quality 落成 body class
    _applyEffectiveState() {
        const b = document.documentElement.classList; // lg-* 全挂 <html>（与 data-theme 同元素）
        b.remove('lg-quality-off', 'lg-degrade-icons');
        if (!this.supported) return;
        if (this._quality === 'off') { b.add('lg-quality-off'); return; }
        if (this._quality === 'high') return;                 // 全折射
        if (this._resolveAutoTier() === 'degrade') b.add('lg-degrade-icons'); // auto 低端
    },
    setQuality(level) {
        this._quality = (level === 'high' || level === 'off') ? level : 'auto';
        this._applyEffectiveState();
    },

    // —— 探针资格闸：复用 rain-glass 同款思路（主题 / 激活 / 可见 / 不减动 / 雨在跑）——
    // 后台 rAF 被节流到 ~1fps、关雨时背景静止空载 → 这两种场景测出的帧率不代表真实折射负载、
    // 误判会被永久缓存钉死，所以探针只在「夏雨 + 桌面激活 + 前台 + 未减动 + 雨开」时才采样。
    _probeEligible() {
        if (!this.supported) return false;
        if (this._quality !== 'auto') return false;
        if (document.documentElement.dataset.theme !== LGConfig.THEME_NAME) return false;
        const desktop = document.getElementById('desktop');
        if (!desktop || !desktop.classList.contains('active')) return false;
        if (document.hidden) return false;                                   // 后台 rAF 节流 → 帧率失真
        if (this._reducedMQ && this._reducedMQ.matches) return false;        // 减动 → 雨停、空载不代表
        if (document.body.classList.contains('rain-off')) return false;      // 关雨 → 背景静止空载不代表
        return true;
    },
    // —— 一次性 FPS 探针：资格满足 + auto + 未探过 → 采样 ~2s 校正分档 ——
    _maybeProbe() {
        if (this._probed || this._probing) return;
        if (!this._probeEligible()) return;
        // 读缓存：同一设备不重测
        const cached = (() => { try { return localStorage.getItem('lg_auto_tier'); } catch (e) { return null; } })();
        if (cached === 'full' || cached === 'degrade') {
            this._autoTier = cached; this._probed = true; this._applyEffectiveState(); return;
        }
        this._probeFps();
    },
    _probeFps() {
        this._probing = true;
        let frames = 0, start = 0;
        const DURATION = 2000;
        const tick = (ts) => {
            // 采样窗口内任一资格闸失守（切后台/切主题/关雨/减动/离开桌面）→ 放弃本次：
            // 不缓存、不锁 _probed，等条件再满足由监听重新触发一次干净探针
            if (!this._probeEligible()) { this._probing = false; return; }
            if (!start) start = ts;
            frames++;
            if (ts - start < DURATION) { requestAnimationFrame(tick); return; }
            const fps = frames / ((ts - start) / 1000);
            // 探针带上设备信号一起判（_classifyTier 任一低即 degrade）= 保守、不把低内存设备反升成 full
            this._autoTier = this._classifyTier({
                fps,
                memory: navigator.deviceMemory != null ? navigator.deviceMemory : null,
                cores:  navigator.hardwareConcurrency != null ? navigator.hardwareConcurrency : null,
            });
            this._probed = true; this._probing = false;
            try { localStorage.setItem('lg_auto_tier', this._autoTier); } catch (e) {}
            this._applyEffectiveState();
        };
        requestAnimationFrame(tick);
    },
};
