// ===== Desktop Decorations =====
// 桌面装饰图层：washi 胶带 / 小贴纸 / 手绘 SVG，绝对定位叠加在桌面上
// 数据：AppState.data.decorations[] = [{ id, src, page, x%, y%, rotation, scale, zIndex }]
// src 可以是：内置 ID（如 'tape-pink'）、用户贴纸 ID（如 'user:s_xxx'）、或 dataURL

const Decorations = {
    // ── 内置贴纸库（手绘风 SVG） ──
    _BUILTIN_STICKERS: {
        'tape-pink': `<svg viewBox="0 0 120 32" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="tp1" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="0.6" fill="#c98aa0" opacity="0.6"/></pattern></defs><rect x="0" y="2" width="120" height="28" fill="#f4c8d4" opacity="0.85"/><rect x="0" y="2" width="120" height="28" fill="url(#tp1)"/><path d="M0 2 L120 4 M0 30 L120 28" stroke="#d8a3b3" stroke-width="0.6" opacity="0.6"/></svg>`,
        'tape-mint': `<svg viewBox="0 0 120 32" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="tp2" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 4 L4 0 M4 8 L8 4" stroke="#86b89a" stroke-width="0.5" opacity="0.5"/></pattern></defs><rect x="0" y="2" width="120" height="28" fill="#bedbc8" opacity="0.85"/><rect x="0" y="2" width="120" height="28" fill="url(#tp2)"/><path d="M0 2 L120 5 M0 30 L120 27" stroke="#79a78c" stroke-width="0.6" opacity="0.5"/></svg>`,
        'tape-cream': `<svg viewBox="0 0 120 32" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="2" width="120" height="28" fill="#f3e8c8" opacity="0.85"/><g opacity="0.4" fill="#c8a86c"><circle cx="14" cy="10" r="1.2"/><circle cx="38" cy="22" r="1"/><circle cx="62" cy="12" r="1.4"/><circle cx="86" cy="20" r="1.1"/><circle cx="106" cy="14" r="1.2"/></g><path d="M0 2 L120 3 M0 30 L120 29" stroke="#c8a86c" stroke-width="0.5" opacity="0.5"/></svg>`,
        'tape-stripe': `<svg viewBox="0 0 120 32" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="2" width="120" height="28" fill="#fff5e8" opacity="0.85"/><g opacity="0.55"><line x1="0" y1="6"  x2="120" y2="9"  stroke="#d4a774" stroke-width="1.2"/><line x1="0" y1="14" x2="120" y2="17" stroke="#d4a774" stroke-width="1.2"/><line x1="0" y1="22" x2="120" y2="25" stroke="#d4a774" stroke-width="1.2"/></g></svg>`,
        'ribbon': `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><g fill="#d8a8b3"><path d="M30 28 Q22 16 12 18 Q4 20 6 30 Q8 40 18 38 Q26 36 30 28 Z" opacity="0.85"/><path d="M30 28 Q38 16 48 18 Q56 20 54 30 Q52 40 42 38 Q34 36 30 28 Z" opacity="0.85"/><ellipse cx="30" cy="28" rx="4" ry="6" opacity="0.95"/><path d="M28 32 Q22 44 18 56" stroke="#d8a8b3" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M32 32 Q38 44 42 56" stroke="#d8a8b3" stroke-width="2.5" fill="none" stroke-linecap="round"/></g></svg>`,
        'star': `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 4 L19 13 L28 14 L21 20 L23 29 L16 24 L9 29 L11 20 L4 14 L13 13 Z" fill="#e8c87a" opacity="0.85"/><path d="M16 4 L19 13 L28 14 L21 20 L23 29 L16 24 L9 29 L11 20 L4 14 L13 13 Z" fill="none" stroke="#c8a04c" stroke-width="0.8" opacity="0.6"/></svg>`,
        'flower-sakura': `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><g transform="translate(20,20)"><g fill="#f4c4cc"><ellipse cx="0" cy="-10" rx="5" ry="8"/><ellipse cx="9.5" cy="-3" rx="5" ry="8" transform="rotate(72)"/><ellipse cx="5.9" cy="8.1" rx="5" ry="8" transform="rotate(144)"/><ellipse cx="-5.9" cy="8.1" rx="5" ry="8" transform="rotate(216)"/><ellipse cx="-9.5" cy="-3" rx="5" ry="8" transform="rotate(288)"/></g><circle r="3.5" fill="#e8c87a"/><g stroke="#d8a4ac" stroke-width="0.5" fill="none" opacity="0.6"><path d="M0 -8 L0 -2"/><path d="M7.6 -2.5 L1.9 -0.6" transform="rotate(72)"/></g></g></svg>`,
        'flower-white': `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><g transform="translate(16,16)"><g fill="#ffffff" stroke="#d8c8b8" stroke-width="0.8"><circle cx="0" cy="-7" r="4"/><circle cx="6.7" cy="-2.2" r="4" transform="rotate(72)"/><circle cx="4.1" cy="5.7" r="4" transform="rotate(144)"/><circle cx="-4.1" cy="5.7" r="4" transform="rotate(216)"/><circle cx="-6.7" cy="-2.2" r="4" transform="rotate(288)"/></g><circle r="2.5" fill="#e8c87a"/></g></svg>`,
        'leaf': `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 3 Q26 8 26 18 Q24 27 16 29 Q8 27 6 18 Q6 8 16 3 Z" fill="#a8c098" opacity="0.85"/><path d="M16 4 Q15 16 16 28" stroke="#7a9070" stroke-width="0.8" fill="none" opacity="0.6"/><path d="M16 10 L11 14 M16 14 L9 18 M16 18 L11 22 M16 14 L21 14 M16 18 L23 18 M16 22 L21 22" stroke="#7a9070" stroke-width="0.4" fill="none" opacity="0.5"/></svg>`,
        'cloud': `<svg viewBox="0 0 60 32" xmlns="http://www.w3.org/2000/svg"><g fill="#ffffff" stroke="#c8d8e0" stroke-width="1"><path d="M12 22 Q5 22 5 16 Q5 11 11 11 Q11 5 18 5 Q22 5 24 8 Q26 4 32 4 Q40 4 42 11 Q49 11 52 16 Q55 22 48 22 Z" opacity="0.95"/></g></svg>`,
        'moon': `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M22 4 Q12 6 8 16 Q12 26 22 28 Q14 22 14 16 Q14 10 22 4 Z" fill="#f4e8c8" opacity="0.9"/><circle cx="22" cy="4" r="2.5" fill="#e8c87a" opacity="0.7"/></svg>`,
        'heart': `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 26 Q4 18 6 11 Q8 5 14 7 Q15 8 16 10 Q17 8 18 7 Q24 5 26 11 Q28 18 16 26 Z" fill="#e8a4b0" opacity="0.85"/></svg>`,
        'sparkle': `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><g fill="#e8c87a" opacity="0.85"><path d="M20 4 Q21 16 32 18 Q21 20 20 32 Q19 20 8 18 Q19 16 20 4 Z"/><path d="M32 8 Q33 12 36 13 Q33 14 32 18 Q31 14 28 13 Q31 12 32 8 Z" opacity="0.7"/><path d="M8 28 Q9 32 12 33 Q9 34 8 38 Q7 34 4 33 Q7 32 8 28 Z" opacity="0.7"/></g></svg>`,
    },

    init() {
        if (!Array.isArray(AppState.data.decorations)) AppState.data.decorations = [];
        if (!Array.isArray(AppState.data.userStickers)) AppState.data.userStickers = [];
    },

    _genId(prefix = 'd_') {
        return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    },

    _save() {
        if (typeof Utils !== 'undefined') Utils.saveData();
    },

    // 解析 src 成可渲染 HTML（内置 SVG / 用户贴纸 dataURL）
    _resolveSrc(src) {
        if (!src) return '';
        if (src.startsWith('data:')) {
            return `<img src="${src}" alt="" draggable="false">`;
        }
        if (src.startsWith('user:')) {
            const id = src.slice(5);
            const userStickers = AppState.data.userStickers || [];
            const s = userStickers.find(x => x.id === id);
            if (s) {
                if (s.src.startsWith('<svg')) return s.src;
                return `<img src="${s.src}" alt="" draggable="false">`;
            }
            return '';
        }
        return this._BUILTIN_STICKERS[src] || '';
    },

    // ── 渲染：在每个 .app-grid 里塞一层 .deco-layer ──
    renderForPage(grid, pageIndex) {
        // 移除旧层
        const old = grid.querySelector(':scope > .deco-layer');
        if (old) old.remove();

        const layer = document.createElement('div');
        layer.className = 'deco-layer';
        layer.dataset.page = pageIndex;

        const items = (AppState.data.decorations || []).filter(d => (d.page || 0) === pageIndex);
        for (const d of items) {
            const el = this._renderItem(d);
            if (el) layer.appendChild(el);
        }
        grid.appendChild(layer);
    },

    _renderItem(d) {
        const html = this._resolveSrc(d.src);
        if (!html) return null;
        const el = document.createElement('div');
        el.className = 'deco-item';
        el.dataset.decoId = d.id;
        el.style.left = (d.x * 100) + '%';
        el.style.top = (d.y * 100) + '%';
        el.style.transform = `translate(-50%, -50%) rotate(${d.rotation || 0}deg) scale(${d.scale || 1})`;
        el.style.zIndex = d.zIndex || 1;
        el.innerHTML = html;
        // 编辑模式下的删除徽标（点一下即删，touch 在 initDragHandlers 里拦截）
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'deco-del-badge';
        del.textContent = '×';
        del.setAttribute('aria-label', I18n.t('btn.delete', '删除'));
        del.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeDecoration(d.id);
        });
        el.appendChild(del);
        return el;
    },

    // ── 添加贴纸（默认放页中央，让用户拖到想要的位置） ──
    addDecoration(src, pageIndex) {
        const deco = {
            id: this._genId(),
            src,
            page: pageIndex || 0,
            x: 0.5,
            y: 0.5,
            rotation: (Math.random() * 14 - 7), // -7° ~ 7°
            scale: 1,
            zIndex: 1
        };
        AppState.data.decorations.push(deco);
        this._save();
        if (typeof DesktopRenderer !== 'undefined') DesktopRenderer.render();
        // 进入编辑态，让用户立刻可拖
        if (typeof DesktopEdit !== 'undefined' && !DesktopEdit.active) DesktopEdit.enterEditMode();
    },

    removeDecoration(id) {
        AppState.data.decorations = AppState.data.decorations.filter(d => d.id !== id);
        this._save();
        if (typeof DesktopRenderer !== 'undefined') DesktopRenderer.render();
    },

    updateDecoration(id, patch) {
        const d = AppState.data.decorations.find(x => x.id === id);
        if (!d) return;
        Object.assign(d, patch);
        this._save();
    },

    // v2.223：贴纸入口从长按工具栏搬进 设置→外观→桌面贴纸，逻辑和小组件同款——跳桌面再开抽屉
    openFromSettings() {
        Navigation.goTo('desktop');
        this.openDrawer();
    },

    // ── 贴纸抽屉（编辑模式下的 + 按钮调出） ──
    openDrawer() {
        // 当前页
        const pageIndex = (typeof DesktopPager !== 'undefined') ? DesktopPager.currentPage : 0;

        const sheet = document.createElement('div');
        sheet.className = 'deco-drawer-overlay';
        sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };

        const builtinIds = Object.keys(this._BUILTIN_STICKERS);
        const userStickers = AppState.data.userStickers || [];

        const builtinHtml = builtinIds.map(id =>
            `<button class="deco-tile" data-src="${id}">${this._BUILTIN_STICKERS[id]}</button>`
        ).join('');

        const userHtml = userStickers.map(s => {
            const preview = s.src.startsWith('<svg') ? s.src : `<img src="${s.src}" alt="">`;
            return `<button class="deco-tile is-user" data-src="user:${s.id}">${preview}<span class="deco-tile-del" data-del-id="${s.id}" title="${I18n.t('btn.delete', '删除')}">×</span></button>`;
        }).join('');

        sheet.innerHTML = `
            <div class="deco-drawer">
                <div class="deco-drawer-handle"></div>
                <div class="deco-drawer-header">
                    <h3>${I18n.t('deco.drawer_title', '装饰贴纸')}</h3>
                    <button class="deco-drawer-close" type="button">${I18n.t('btn.done', '完成')}</button>
                </div>
                <div class="deco-drawer-section">
                    <div class="deco-drawer-section-title">${I18n.t('deco.builtin', '内置')}</div>
                    <div class="deco-drawer-grid">${builtinHtml}</div>
                </div>
                <div class="deco-drawer-section">
                    <div class="deco-drawer-section-title">
                        <span>${I18n.t('deco.custom', '自定义')}</span>
                        <button class="deco-upload-btn" type="button">${I18n.t('deco.upload', '＋ 上传')}</button>
                    </div>
                    <div class="deco-drawer-grid deco-user-grid">
                        ${userHtml || `<div class="deco-empty">${I18n.t('deco.empty', '点击右上角「上传」添加自己的贴纸（SVG/PNG/JPG）')}</div>`}
                    </div>
                </div>
                <p class="deco-drawer-hint">${I18n.t('deco.hint', '点击贴纸添加到当前页中央，编辑模式下可拖动 / 旋转 / 缩放')}</p>
            </div>`;
        document.body.appendChild(sheet);

        // 事件
        sheet.querySelector('.deco-drawer-close').onclick = () => sheet.remove();
        sheet.querySelector('.deco-upload-btn').onclick = () => this._pickAndUploadSticker(sheet);

        sheet.querySelectorAll('.deco-tile').forEach(tile => {
            tile.addEventListener('click', e => {
                // 删除按钮拦截
                if (e.target.closest('[data-del-id]')) {
                    const delId = e.target.closest('[data-del-id]').dataset.delId;
                    if (confirm(I18n.t('deco.confirm_delete_sticker', '删除这张贴纸？已经放在桌面上的会一起消失。'))) {
                        this._deleteUserSticker(delId);
                        sheet.remove();
                        this.openDrawer();
                    }
                    return;
                }
                const src = tile.dataset.src;
                this.addDecoration(src, pageIndex);
                sheet.remove();
            });
        });
    },

    // ── 上传自定义贴纸 ──
    _pickAndUploadSticker(sheet) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/svg+xml,image/png,image/jpeg,image/webp';
        input.onchange = async () => {
            const file = input.files && input.files[0];
            if (!file) return;
            try {
                let src;
                if (file.type === 'image/svg+xml') {
                    src = await file.text();
                    // 安全清理：去掉 <script> 与 onload 等
                    src = src.replace(/<script[\s\S]*?<\/script>/gi, '')
                             .replace(/\son\w+="[^"]*"/gi, '')
                             .replace(/\son\w+='[^']*'/gi, '');
                } else {
                    // PNG/JPG/WebP 走压缩
                    src = await Utils.readImageFile(file, { maxSize: 400, quality: 0.9 });
                }
                if (!src) return;
                const sticker = {
                    id: this._genId('s_'),
                    name: file.name.replace(/\.[^.]+$/, '').slice(0, 20),
                    src: src
                };
                AppState.data.userStickers.push(sticker);
                this._save();
                // 重开抽屉显示新贴纸
                if (sheet) sheet.remove();
                this.openDrawer();
            } catch (err) {
                console.error('Sticker upload failed', err);
                alert(I18n.t('deco.upload_failed_prefix', '贴纸上传失败：') + (err.message || '未知错误'));
            }
        };
        input.click();
    },

    _deleteUserSticker(stickerId) {
        // 删除贴纸定义
        AppState.data.userStickers = (AppState.data.userStickers || []).filter(s => s.id !== stickerId);
        // 删除引用了这张贴纸的所有 decorations
        const ref = 'user:' + stickerId;
        AppState.data.decorations = (AppState.data.decorations || []).filter(d => d.src !== ref);
        this._save();
        if (typeof DesktopRenderer !== 'undefined') DesktopRenderer.render();
    },

    // ── 长按浮出的迷你菜单：删除 / 移到第 N 屏 / 取消 ──
    _showContextMenu(decoId, anchorX, anchorY) {
        // 清除已有的 menu
        document.querySelectorAll('.deco-context-menu, .deco-context-menu-backdrop').forEach(n => n.remove());

        const decoration = (AppState.data.decorations || []).find(d => d.id === decoId);
        if (!decoration) return;

        const layout = AppState.data.desktopLayout;
        const totalPages = (layout && layout.pages) ? layout.pages.length : 1;
        const currentPage = decoration.page || 0;

        const backdrop = document.createElement('div');
        backdrop.className = 'deco-context-menu-backdrop';
        const closeMenu = () => {
            backdrop.remove();
            document.querySelectorAll('.deco-context-menu').forEach(n => n.remove());
        };
        backdrop.addEventListener('click', closeMenu);
        backdrop.addEventListener('touchstart', (e) => {
            if (e.target === backdrop) { e.preventDefault(); closeMenu(); }
        }, { passive: false });
        document.body.appendChild(backdrop);

        const menu = document.createElement('div');
        menu.className = 'deco-context-menu';

        const otherPages = [];
        for (let i = 0; i < totalPages; i++) {
            if (i !== currentPage) otherPages.push(i);
        }

        let html = `<button type="button" class="danger" data-action="delete">${I18n.t('deco.menu_delete', '删除装饰')}</button>`;
        if (otherPages.length > 0) {
            html += `<div class="deco-menu-divider"></div>`;
            html += `<div class="deco-menu-label">${I18n.t('deco.menu_move', '移到')}</div>`;
            for (const pi of otherPages) {
                html += `<button type="button" data-action="move" data-page="${pi}">${I18n.t('deco.menu_page', { n: pi + 1 })}</button>`;
            }
        }
        html += `<div class="deco-menu-divider"></div>`;
        html += `<button type="button" data-action="cancel">${I18n.t('deco.menu_cancel', '取消')}</button>`;
        menu.innerHTML = html;

        // 先插入再量尺寸定位（避免离屏）
        menu.style.visibility = 'hidden';
        document.body.appendChild(menu);
        const mw = menu.offsetWidth || 180;
        const mh = menu.offsetHeight || 200;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const px = Math.max(8, Math.min(vw - mw - 8, (anchorX || vw / 2) - mw / 2));
        const py = Math.max(8, Math.min(vh - mh - 8, (anchorY || vh / 2) + 14));
        menu.style.left = px + 'px';
        menu.style.top = py + 'px';
        menu.style.visibility = '';

        menu.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                if (action === 'delete') {
                    this.removeDecoration(decoId);
                } else if (action === 'move') {
                    const targetPage = parseInt(btn.dataset.page, 10);
                    if (!isNaN(targetPage)) {
                        this.updateDecoration(decoId, { page: targetPage });
                        if (typeof DesktopRenderer !== 'undefined') DesktopRenderer.render();
                    }
                }
                closeMenu();
            });
        });
    },

    // ── 拖拽 / 旋转 / 缩放（只在编辑模式生效） ──
    initDragHandlers() {
        const wrapper = document.querySelector('.desktop-pages-wrapper');
        if (!wrapper || wrapper._decoBound) return;
        wrapper._decoBound = true;

        let dragging = null; // { el, deco, startX, startY, baseX, baseY, gridRect }
        let pinching = null; // for two-finger rotate/scale
        let longPressTimer = null;

        const onTouchStart = (e) => {
            if (typeof DesktopEdit === 'undefined' || !DesktopEdit.active) return;
            // 删除徽标：点一下即删（touch 优先拦截，避免 preventDefault 吞掉 click）
            const delBadge = e.target.closest('.deco-del-badge');
            if (delBadge) {
                const host = delBadge.closest('.deco-item');
                e.stopPropagation();
                e.preventDefault();
                if (host) Decorations.removeDecoration(host.dataset.decoId);
                return;
            }
            const target = e.target.closest('.deco-item');
            if (!target) return;
            e.stopPropagation();

            const decoId = target.dataset.decoId;
            const deco = (AppState.data.decorations || []).find(d => d.id === decoId);
            if (!deco) return;

            const grid = target.closest('.app-grid');
            const gridRect = grid.getBoundingClientRect();

            // 双指：旋转 + 缩放
            if (e.touches.length === 2) {
                const t1 = e.touches[0], t2 = e.touches[1];
                pinching = {
                    el: target, deco, gridRect,
                    startDist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
                    startAngle: Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180 / Math.PI,
                    baseScale: deco.scale || 1,
                    baseRotation: deco.rotation || 0
                };
                if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
                e.preventDefault();
                return;
            }

            // 单指：拖动 + 长按弹菜单
            const t = e.touches[0];
            const lpX = t.clientX;
            const lpY = t.clientY;
            dragging = {
                el: target, deco, gridRect,
                startX: t.clientX, startY: t.clientY,
                baseX: deco.x, baseY: deco.y,
                moved: false
            };
            target.classList.add('is-dragging');

            longPressTimer = setTimeout(() => {
                if (dragging && !dragging.moved) {
                    if (dragging.el) dragging.el.classList.remove('is-dragging');
                    Decorations._showContextMenu(decoId, lpX, lpY);
                    dragging = null; // 取消拖动状态，避免 touchend 误触
                }
                longPressTimer = null;
            }, 600);
            e.preventDefault();
        };

        const onTouchMove = (e) => {
            if (pinching && e.touches.length === 2) {
                const t1 = e.touches[0], t2 = e.touches[1];
                const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180 / Math.PI;
                const scale = Math.max(0.3, Math.min(3, pinching.baseScale * (dist / pinching.startDist)));
                const rotation = pinching.baseRotation + (angle - pinching.startAngle);
                pinching.el.style.transform = `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`;
                pinching._curScale = scale;
                pinching._curRotation = rotation;
                e.preventDefault();
                return;
            }

            if (!dragging) return;
            const t = e.touches[0];
            const dx = t.clientX - dragging.startX;
            const dy = t.clientY - dragging.startY;
            if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
                dragging.moved = true;
                if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
            }
            const newX = Math.max(0, Math.min(1, dragging.baseX + dx / dragging.gridRect.width));
            const newY = Math.max(0, Math.min(1, dragging.baseY + dy / dragging.gridRect.height));
            dragging.el.style.left = (newX * 100) + '%';
            dragging.el.style.top = (newY * 100) + '%';
            dragging._curX = newX;
            dragging._curY = newY;
            e.preventDefault();
        };

        const onTouchEnd = (e) => {
            if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
            if (pinching) {
                Decorations.updateDecoration(pinching.deco.id, {
                    scale: pinching._curScale != null ? pinching._curScale : pinching.deco.scale,
                    rotation: pinching._curRotation != null ? pinching._curRotation : pinching.deco.rotation
                });
                pinching = null;
                return;
            }
            if (dragging) {
                if (dragging.moved) {
                    Decorations.updateDecoration(dragging.deco.id, {
                        x: dragging._curX != null ? dragging._curX : dragging.deco.x,
                        y: dragging._curY != null ? dragging._curY : dragging.deco.y
                    });
                }
                dragging.el.classList.remove('is-dragging');
                dragging = null;
            }
        };

        wrapper.addEventListener('touchstart', onTouchStart, { passive: false, capture: true });
        wrapper.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
        wrapper.addEventListener('touchend', onTouchEnd, { capture: true });
        wrapper.addEventListener('touchcancel', onTouchEnd, { capture: true });
    }
};
