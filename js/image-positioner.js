// ===== 通用图片定位器（v2.212 T1）=====
// 解决「传全身立绘只露出腿和腰」：所有相框类组件（相册/拍立得/立绘卡/圆相框/莫比乌斯）
// 共用的「框内拖动 + 捏合缩放」定位弹窗。不裁原图，只存参数。
//
// ── API 契约（T2/T8/T9 按此消费，agent T1 实装）──
// pos 参数形状：{ x, y, s }
//   x/y：图片中心相对框中心的偏移，单位＝框宽/高的百分比。
//        范围随 s 变化：clamp 到 ±50*(s-1)（零露底的紧致边界，s=4 时最大 ±150），见 _clampPos
//   s  ：缩放倍数，1 = object-fit:cover 刚好铺满框，范围 [1, 4]
//   缺省/null = 现状行为（center cover），老数据零迁移
//
// ImagePositioner.open({
//     src,                  // 图片 URL（dataURL / blob URL 均可；调用方管理生命周期）
//     shape: 'rect'|'circle',
//     aspect: 1,            // 框宽高比（rect 用；circle 恒 1）
//     pos: {x,y,s}|null,    // 当前参数（编辑时回填）
//     onApply(pos) {}       // 点确定后回调；调用方负责存 AppState + 重渲染
// })
//
// ImagePositioner.transformStyle(pos)
//   → 返回应用到 <img> 的内联 style 字符串（含 object-fit:cover 基底 + transform），
//     pos 为空时返回纯 cover 基底。渲染方统一用它，禁止各自手写 transform。
//
// 实现要求：pointer events 拖动平移、双指捏合缩放、桌面滚轮缩放 + 缩放滑杆兜底；
// 弹窗样式对齐现有 modal-overlay/modal-window 模式；无外部库。
//
// ── 实现笔记 ──
// transform 用 `translate(x%,y%) scale(s)`（顺序重要）：CSS 会先按 s 缩放、
// 再按「框尺寸的 x%/y%」平移，平移量因此与缩放倍数无关，正好对应契约里
// 「x/y 是框宽高的固定百分比偏移」的语义。
// clamp 核心：object-fit:cover 在 s=1 时已经零缝隙铺满框，此时不允许任何平移
// （否则必然露底）；缩放到 s 之后，图片相对框多出的可平移余量 = (s-1)/2 * 框边长，
// 换算成百分比就是 maxOffset = 50*(s-1)。x/y 永远 clamp 到 [-maxOffset, maxOffset]
// （同时也在契约的 [-50,50] 范围内，因为 s<=4 时 maxOffset<=150 但更紧的是这条），
// 这样无论传入什么参数，铺满框、无露底恒成立。

const ImagePositioner = {
    _MIN_SCALE: 1,
    _MAX_SCALE: 4,

    // 归一化 + clamp：任何输入（含 null/越界/非法值）都产出安全可渲染的 {x,y,s}
    _clampPos(pos) {
        let s = (pos && typeof pos.s === 'number' && isFinite(pos.s)) ? pos.s : 1;
        s = Math.min(this._MAX_SCALE, Math.max(this._MIN_SCALE, s));
        const maxOff = 50 * (s - 1); // s=1 时为 0：铺满框、零露底的核心保证
        let x = (pos && typeof pos.x === 'number' && isFinite(pos.x)) ? pos.x : 0;
        let y = (pos && typeof pos.y === 'number' && isFinite(pos.y)) ? pos.y : 0;
        x = Math.min(maxOff, Math.max(-maxOff, x));
        y = Math.min(maxOff, Math.max(-maxOff, y));
        return { x, y, s };
    },

    // 全项目唯一的定位渲染入口
    transformStyle(pos) {
        const base = 'width:100%;height:100%;object-fit:cover';
        if (!pos) return base;
        const { x, y, s } = this._clampPos(pos);
        if (x === 0 && y === 0 && s === 1) return base; // 恒等变换，视觉上与 null 完全一致
        return `${base};transform-origin:50% 50%;transform:translate(${x.toFixed(2)}%,${y.toFixed(2)}%) scale(${s.toFixed(3)})`;
    },

    open(opts) {
        opts = opts || {};
        const src = opts.src || '';
        const shape = opts.shape === 'circle' ? 'circle' : 'rect';
        const aspect = (typeof opts.aspect === 'number' && opts.aspect > 0) ? opts.aspect : 1;
        const onApply = typeof opts.onApply === 'function' ? opts.onApply : () => {};
        let draft = this._clampPos(opts.pos || null);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active imgpos-overlay';
        modal.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
        modal.onclick = e => { if (e.target === modal) modal.remove(); };

        const titleTxt = I18n.t('widgets.imgpos_title', '位置を調整');
        const hintTxt = I18n.t('widgets.imgpos_hint', 'ドラッグで移動・ピンチ/ホイールで拡大縮小');
        const resetTxt = I18n.t('widgets.imgpos_reset', 'リセット');
        const cancelTxt = I18n.t('widgets.imgpos_cancel', 'キャンセル');
        const confirmTxt = I18n.t('widgets.imgpos_confirm', '確定');

        modal.innerHTML = `
            <div class="modal-window imgpos-window" style="gap:14px" onclick="event.stopPropagation()">
                <h3 class="imgpos-title">${Utils.escapeHtml(titleTxt)}</h3>
                <div class="imgpos-stage imgpos-${shape}" style="aspect-ratio:${shape === 'circle' ? '1' : aspect}">
                    <img src="${Utils.escapeHtml(src)}" alt="" draggable="false">
                </div>
                <p class="imgpos-hint">${Utils.escapeHtml(hintTxt)}</p>
                <div class="imgpos-zoomrow">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="M21 21l-4.8-4.8M7.2 10h5.6"/></svg>
                    <input type="range" class="imgpos-slider" min="${this._MIN_SCALE}" max="${this._MAX_SCALE}" step="0.01" value="${draft.s}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="M21 21l-4.8-4.8M10 7.2v5.6M7.2 10h5.6"/></svg>
                </div>
                <div class="imgpos-actions">
                    <button type="button" class="imgpos-btn-reset">${Utils.escapeHtml(resetTxt)}</button>
                    <button type="button" class="imgpos-btn-cancel">${Utils.escapeHtml(cancelTxt)}</button>
                    <button type="button" class="imgpos-btn-confirm">${Utils.escapeHtml(confirmTxt)}</button>
                </div>
            </div>`;
        document.body.appendChild(modal);

        const stage = modal.querySelector('.imgpos-stage');
        const img = stage.querySelector('img');
        const slider = modal.querySelector('.imgpos-slider');

        const renderPreview = () => {
            img.style.cssText = this.transformStyle(draft);
            if (Math.abs(parseFloat(slider.value) - draft.s) > 0.001) slider.value = draft.s;
        };
        const setDraft = next => { draft = this._clampPos(next); renderPreview(); };

        // ── pointer events：拖动平移 + 双指捏合缩放 ──
        const pointers = new Map();
        let gesture = null;
        const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
        const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

        const startGesture = () => {
            const pts = Array.from(pointers.values());
            const rect = stage.getBoundingClientRect();
            if (pts.length === 1) {
                gesture = { mode: 'pan', rect, start: pts[0], origX: draft.x, origY: draft.y };
            } else if (pts.length === 2) {
                gesture = {
                    mode: 'pinch', rect,
                    startDist: dist(pts[0], pts[1]) || 1,
                    startMid: mid(pts[0], pts[1]),
                    origX: draft.x, origY: draft.y, origS: draft.s
                };
            }
        };

        stage.addEventListener('pointerdown', e => {
            e.preventDefault();
            try { stage.setPointerCapture(e.pointerId); } catch (err) { /* 部分浏览器/已失效指针忽略 */ }
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            stage.classList.add('dragging');
            startGesture();
        });

        stage.addEventListener('pointermove', e => {
            if (!pointers.has(e.pointerId)) return;
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (!gesture) return;
            const pts = Array.from(pointers.values());
            if (gesture.mode === 'pan' && pts.length === 1) {
                const dx = pts[0].x - gesture.start.x;
                const dy = pts[0].y - gesture.start.y;
                setDraft({
                    x: gesture.origX + (dx / gesture.rect.width) * 100,
                    y: gesture.origY + (dy / gesture.rect.height) * 100,
                    s: draft.s
                });
            } else if (gesture.mode === 'pinch' && pts.length === 2) {
                const curDist = dist(pts[0], pts[1]);
                const curMid = mid(pts[0], pts[1]);
                const scaleFactor = curDist / gesture.startDist;
                const dx = curMid.x - gesture.startMid.x;
                const dy = curMid.y - gesture.startMid.y;
                setDraft({
                    x: gesture.origX + (dx / gesture.rect.width) * 100,
                    y: gesture.origY + (dy / gesture.rect.height) * 100,
                    s: gesture.origS * scaleFactor
                });
            }
        });

        const endPointer = e => {
            if (!pointers.has(e.pointerId)) return;
            pointers.delete(e.pointerId);
            if (pointers.size === 0) {
                stage.classList.remove('dragging');
                gesture = null;
            } else {
                startGesture(); // 残留 1 指：以当前状态重新起手，避免跳变
            }
        };
        stage.addEventListener('pointerup', endPointer);
        stage.addEventListener('pointercancel', endPointer);
        stage.addEventListener('pointerleave', e => { if (pointers.size <= 1) endPointer(e); });

        // ── 桌面滚轮缩放 ──
        stage.addEventListener('wheel', e => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.08 : (1 / 1.08);
            setDraft({ x: draft.x, y: draft.y, s: draft.s * factor });
        }, { passive: false });

        // ── 缩放滑杆兜底 ──
        slider.addEventListener('input', () => {
            setDraft({ x: draft.x, y: draft.y, s: parseFloat(slider.value) || 1 });
        });

        // ── 按钮 ──
        modal.querySelector('.imgpos-btn-reset').addEventListener('click', () => {
            setDraft({ x: 0, y: 0, s: 1 });
        });
        modal.querySelector('.imgpos-btn-cancel').addEventListener('click', () => modal.remove());
        modal.querySelector('.imgpos-btn-confirm').addEventListener('click', () => {
            const final = this._clampPos(draft);
            const isIdentity = final.x === 0 && final.y === 0 && final.s === 1;
            onApply(isIdentity ? null : final); // 恒等变换存 null，保持数据干净、零迁移
            modal.remove();
        });

        renderPreview();
    }
};
