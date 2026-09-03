// ===== Desktop Widgets System =====
// 主屏幕小组件：相册、日历、音乐、情报速報

// ── 全局音频协调器：widget / 放送局 / TTS / LINE voice 之间互斥 ──
// 任何 audio element 注册后，它的 'play' 事件会自动暂停其他在播的
(function () {
    if (window.AudioCoordinator) return;
    const Coord = {
        _current: null,
        register(audioEl) {
            if (!audioEl || audioEl.__audioCoordRegistered) return;
            audioEl.__audioCoordRegistered = true;
            audioEl.addEventListener('play', () => {
                if (Coord._current && Coord._current !== audioEl && !Coord._current.paused) {
                    try { Coord._current.pause(); } catch (e) {}
                }
                Coord._current = audioEl;
            });
            audioEl.addEventListener('pause', () => {
                if (Coord._current === audioEl) Coord._current = null;
            });
            audioEl.addEventListener('ended', () => {
                if (Coord._current === audioEl) Coord._current = null;
            });
        },
        pauseAll() {
            if (Coord._current && !Coord._current.paused) {
                try { Coord._current.pause(); } catch (e) {}
            }
            Coord._current = null;
        },
        getCurrent() { return Coord._current; }
    };
    window.AudioCoordinator = Coord;
})();

const Widgets = {
    // ── 初期化 ──
    init() {
        if (!AppState.data.widgets) {
            AppState.data.widgets = [];
        }
        // 尺寸系统 v2 迁移：旧 medium = 整行条（占 3 列），重命名为 wide
        // 新语义：small(1)/medium(2)/wide(3)
        AppState.data.widgets.forEach(w => {
            if (!w._sizeV2 && w.size === 'medium') w.size = 'wide';
            w._sizeV2 = true;
        });

        // 静态时钟 HTML → 可移动小组件（一次性迁移）
        // 老用户：layout 已存在，把时钟塞到 page 0 顶部
        // 新用户：layout 不存在，由 _ensureLayout 自行添加
        const layoutExists = AppState.data.desktopLayout?.pages?.length > 0;
        if (layoutExists && !AppState.data._clockWidgetMigrated) {
            const hasClock = AppState.data.widgets.some(w => w.type === 'clock');
            if (!hasClock) {
                const clock = {
                    id: this._genId(),
                    type: 'clock',
                    size: 'wide',
                    _sizeV2: true,
                    data: { format24: true }
                };
                AppState.data.widgets.unshift(clock);
                AppState.data.desktopLayout.pages[0].items.unshift({
                    id: 'di_clk_' + Date.now().toString(36),
                    type: 'widget', widgetId: clock.id,
                    col: 0, row: 0, colSpan: 3, rowSpan: 1
                });
                if (typeof DesktopRenderer !== 'undefined') DesktopRenderer.reflow(0);
            }
            AppState.data._clockWidgetMigrated = true;
            if (typeof Utils !== 'undefined') Utils.saveData();
        } else if (!layoutExists) {
            AppState.data._clockWidgetMigrated = true;
        }

        // B2：启动先抽好轮播图。注意真实顺序：SystemConfig.init→applyTheme 已在本函数之前
        // 触发过一次 DesktopRenderer.render()（那次抽不到图），靠 app.js 里 Widgets.init 之后的
        // 第二次 render() 覆盖成正确首帧——那次调用不可删（app.js 处有对应注释）
        this._rotateAllPicks({ rerender: false });
    },

    // ── 装饰素材（主题色自动适配，继承父元素 color）──
    _bowSvg(cls = 'widget-bow') {
        return `<svg class="${cls}" viewBox="0 0 80 32" aria-hidden="true">
            <path d="M40 18 Q30 6 18 8 Q8 10 10 18 Q12 26 22 26 Q32 26 40 18 Z" fill="currentColor" opacity="0.22"/>
            <path d="M40 18 Q50 6 62 8 Q72 10 70 18 Q68 26 58 26 Q48 26 40 18 Z" fill="currentColor" opacity="0.22"/>
            <path d="M40 18 Q30 6 18 8 Q8 10 10 18 Q12 26 22 26 Q32 26 40 18 Z" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.85"/>
            <path d="M40 18 Q50 6 62 8 Q72 10 70 18 Q68 26 58 26 Q48 26 40 18 Z" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.85"/>
            <ellipse cx="40" cy="18" rx="4" ry="5" fill="currentColor" opacity="0.55"/>
            <path d="M38 22 Q34 28 32 32" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.7"/>
            <path d="M42 22 Q46 28 48 32" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.7"/>
        </svg>`;
    },
    _sparkSvg(cls = 'widget-spark') {
        return `<svg class="${cls}" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z" fill="currentColor"/></svg>`;
    },
    _heartSvg(cls = 'widget-heart') {
        return `<svg class="${cls}" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 10 Q0 6 2 3 Q4 0 6 3 Q8 0 10 3 Q12 6 6 10 Z" fill="currentColor" opacity="0.7"/></svg>`;
    },
    // v2.250：Profile Card の chips アイコン三択（星/月/心）用に追加。三日月＝大円から
    // 小円をずらして重ねる古典的な作図（Feather Icons moon と同じ式、12x12 に縮尺）。
    _moonSvg(cls = 'widget-moon-mini') {
        return `<svg class="${cls}" viewBox="0 0 12 12" aria-hidden="true"><path d="M10.5 6.395A4.5 4.5 0 115.605 1.5a3.5 3.5 0 004.895 4.895z" fill="currentColor"/></svg>`;
    },

    // ── 設定画面のウィジェット一覧を描画 ──
    renderSettingsList() {
        const container = document.getElementById('widgetSettingsList');
        if (!container) return;

        const widgets = this._getWidgets();
        if (widgets.length === 0) {
            container.innerHTML = `<div style="text-align:center;color:var(--text-tertiary);font-size:13px;padding:12px 0">${I18n.t('widgets.none_yet')}</div>`;
            return;
        }

        const typeLabels = {
            clock: I18n.t('widgets.type_clock'),
            photo: I18n.t('widgets.type_photo'),
            polaroid: I18n.t('widgets.type_polaroid'),
            calendar: I18n.t('widgets.type_calendar'),
            music: I18n.t('widgets.type_music'),
            news: I18n.t('widgets.type_news'),
            charcard: I18n.t('widgets.type_charcard', '立绘卡'),
            notifhub: I18n.t('widgets.type_notifhub', '通知センター'),
            mercari: I18n.t('widgets.type_mercari', 'メルカリ新着'),
            note: I18n.t('widgets.type_note', 'テキスト'),
            moonphase: I18n.t('widgets.type_moonphase', '月相'),
            weather: I18n.t('widgets.type_weather', '天気'),
            duoframe: I18n.t('widgets.type_duoframe', 'ふたりフレーム'),
            profile: I18n.t('widgets.type_profile', 'プロフィールカード')
        };
        const sizeLabels = {
            small: I18n.t('widgets.size_small'),
            medium: I18n.t('widgets.size_medium'),
            wide: I18n.t('widgets.size_wide'),
            large: I18n.t('widgets.size_large', '大'),
            mini: I18n.t('widgets.size_mini', '迷你圆'),
            circle: I18n.t('widgets.size_circle', '圆形')
        };

        container.innerHTML = widgets.map(w =>
            `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light)">
                <div>
                    <span style="font-size:14px">${typeLabels[w.type] || w.type}</span>
                    <span style="font-size:11px;color:var(--text-tertiary);margin-left:8px">${w.shape === 'circle' ? sizeLabels.circle : (sizeLabels[w.size] || w.size)}</span>
                </div>
                <button onclick="Widgets.deleteWidget('${w.id}')"
                        style="background:none;border:1px solid var(--border-medium);border-radius:8px;color:var(--text-secondary);font-size:12px;padding:4px 12px;cursor:pointer;min-height:32px">${I18n.t('btn.delete')}</button>
            </div>`
        ).join('');
    },

    // ── データ helpers ──
    _getWidgets() {
        return AppState.data.widgets || [];
    },

    _save() {
        Utils.saveData();
    },

    // 通用图片定位器入口（T1）：相册 photo / 拍立得 polaroid 共用。
    // w.imgPos = {x,y,s}|undefined，由 ImagePositioner 契约定义；渲染统一走 ImagePositioner.transformStyle。
    _openImagePositioner(id) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w || !w.imageUrl || !w.imageUrl.trim()) return;
        if (typeof ImagePositioner === 'undefined') return;
        // review 修复（A1）：预览框比例必须匹配真机图框——wide 档是 ~3:1 窄条，方形预览里
        // 摆好的构图放进窄条会完全走样（恰好复现「只露腿和腰」）。组件此刻就渲染在桌面上，
        // 直接量现场 DOM 的图框比例，免维护硬编码比例表；量不到（异常态/0 尺寸）退回 1。
        let aspect = 1;
        if (w.shape !== 'circle') {
            const cell = document.querySelector(`.desktop-grid-widget[data-widget-id="${id}"]`);
            // v2.249：相册重做为满版纯图（.widget-photo-clean），卡片本身就是图框，量卡不用再量内层小盒；
            // .polaroid-image-wide/.polaroid-image 是相册旧结构遗留，拍立得 .pj-image 仍在用，一并保留兜底
            const box = cell && cell.querySelector('.widget-photo-clean, .polaroid-image-wide, .pj-image, .polaroid-image');
            const r = box && box.getBoundingClientRect();
            if (r && r.width > 4 && r.height > 4) aspect = r.width / r.height;
        }
        ImagePositioner.open({
            src: w.imageUrl,
            shape: w.shape === 'circle' ? 'circle' : 'rect',
            aspect,
            pos: w.imgPos || null,
            onApply: (pos) => {
                w.imgPos = pos;
                this._save();
                this.render();
            }
        });
    },

    _genId() {
        return 'w_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    },

    // ── 全体レンダリング（デスクトップは DesktopRenderer が担当、ここは設定用） ──
    render() {
        // Desktop rendering is now handled by DesktopRenderer
        if (typeof DesktopRenderer !== 'undefined') DesktopRenderer.render();
    },

    _renderWidget(w) {
        // shape='circle' 与 size 正交：圆形组件恒为 1 列（size small），叠 .widget-circle 变圆
        const sizeClass = `widget-${w.size || 'small'}${w.shape === 'circle' ? ' widget-circle' : ''}`;
        switch (w.type) {
            case 'clock': return this._renderClock(w, sizeClass);
            case 'photo': return this._renderPhoto(w, sizeClass);
            case 'polaroid': return this._renderPolaroidJ(w, sizeClass);
            case 'calendar': return this._renderCalendar(w, sizeClass);
            case 'music': return this._renderMusic(w, sizeClass);
            case 'news': return this._renderNews(w, sizeClass);
            case 'charcard': return this._renderCharCard(w, sizeClass);
            case 'notifhub': return this._renderNotifhub(w, sizeClass);
            case 'mercari': return this._renderMercariW(w, sizeClass);
            case 'note': return this._renderNote(w, sizeClass);
            case 'moonphase': return this._renderMoonphase(w, sizeClass);
            case 'weather': return this._renderWeatherBadge(w, sizeClass);
            case 'duoframe': return this._renderDuoframe(w, sizeClass);
            case 'profile': return this._renderProfile(w, sizeClass);
            default: return '';
        }
    },

    // ══════════════════════════════════════
    //  📷 拍立得（手帐风：白边 + 微旋转 + 手写体 caption）
    // ══════════════════════════════════════
    _renderPolaroidJ(w, sizeClass) {
        // tilt 在创建时确定，渲染时不重新随机
        if (w.tilt === undefined) {
            w.tilt = (Math.random() * 4 - 2); // -2° ~ 2°
            // 异步保存（不阻塞渲染）
            setTimeout(() => this._save(), 0);
        }
        const rotActive = !!(w.rotation && w.rotation.enabled && w._rotPick);
        if (rotActive) this._queueRotationHydration(w.id);
        const caption = (w.caption || '').slice(0, 40);
        const hasImage = w.imageUrl && w.imageUrl.trim();
        const photoBox = rotActive
            ? `<div style="width:100%;height:100%" data-rot-widget="${w.id}"></div>`
            : hasImage
                ? `<img src="${this._escAttr(w.imageUrl)}" alt="" style="${ImagePositioner.transformStyle(w.imgPos)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                   <div class="pj-empty" style="display:none">＋</div>`
                : `<div class="pj-empty">＋</div>`;
        // 轮播抽中立绘 → caption 显示角色名（水合时替换）；抽中收藏 → 保留用户 caption
        const rotRefCap = rotActive && w._rotPick.kind === 'ref';
        const captionHtml = rotRefCap
            ? `<div class="pj-caption">${this._esc(w._rotPick.label || '')}</div>`
            : caption
                ? `<div class="pj-caption">${this._esc(caption)}</div>`
                : `<div class="pj-caption pj-caption-placeholder">タップして文字を…</div>`;
        // 全局规则（2026-08-03 作者拍板）：拍立得不贴胶带——各主题已有自己的质感语言，
        // washi 胶带的拼贴感违和。勿在任何主题恢复 .pj-tape。
        return `<div class="widget-card ${sizeClass} widget-polaroid-j"
                     style="transform:rotate(${w.tilt.toFixed(2)}deg)"
                     onclick="Widgets.editPolaroidJ('${w.id}')">
            <div class="pj-frame">
                <div class="pj-image">${photoBox}</div>
                ${captionHtml}
            </div>
        </div>`;
    },

    editPolaroidJ(id) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
        modal.onclick = e => { if (e.target === modal) modal.remove(); };
        modal.innerHTML = `
            <div class="modal-window" style="gap:14px">
                <h3 style="margin:0;font-size:17px;font-weight:600;font-family:var(--font-serif)">拍立得编辑</h3>
                <label style="font-size:12px;color:var(--text-secondary)">图片 URL</label>
                <input type="text" id="pjUrl" placeholder="粘贴图片URL…"
                       value="${this._escAttr(w.imageUrl || '')}"
                       style="width:100%;padding:10px 12px;border:1px solid var(--border-medium);border-radius:8px;font-size:14px;background:var(--bg-base);color:var(--text-primary)">
                <label class="widget-upload-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;vertical-align:-2px"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg> 从相册选择
                    <input type="file" accept="image/*" style="display:none"
                           onchange="Widgets._handlePolaroidUpload('${id}', this.files[0], this.closest('.modal-overlay'))">
                </label>
                <label style="font-size:12px;color:var(--text-secondary);margin-top:4px">手写体 caption（最多 40 字）</label>
                <input type="text" id="pjCaption" placeholder="今日のお気に入り…" maxlength="40"
                       value="${this._escAttr(w.caption || '')}"
                       style="width:100%;padding:10px 12px;border:1px solid var(--border-medium);border-radius:8px;font-family:var(--font-handwriting);font-size:16px;background:var(--bg-base);color:var(--text-primary)">
                ${(() => {
                    const rot = w.rotation || {};
                    const refs = (typeof Broadcast !== 'undefined' && Broadcast.getAllCharRefs) ? Broadcast.getAllCharRefs() : [];
                    const names = [...new Set(refs.map(r => (r.name || '').trim()).filter(Boolean))];
                    return `<div style="border-top:1px solid var(--border-light);padding-top:10px;display:flex;flex-direction:column;gap:8px">
                    <label style="display:flex;align-items:center;justify-content:space-between;font-size:14px;color:var(--text-primary)">
                        <span>${I18n.t('widgets.rot_enable', 'ランダム表示')}</span>
                        <input type="checkbox" id="rotEnable" ${rot.enabled ? 'checked' : ''}
                               onchange="document.getElementById('rotOpts').style.display=this.checked?'flex':'none'"
                               style="width:18px;height:18px;cursor:pointer">
                    </label>
                    <div id="rotOpts" style="display:${rot.enabled ? 'flex' : 'none'};flex-direction:column;gap:6px">
                        <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary)">
                            <input type="checkbox" id="rotSrcFav" ${rot.srcFav !== false ? 'checked' : ''}>${I18n.t('widgets.rot_src_fav', 'pixivブックマーク')}
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary)">
                            <input type="checkbox" id="rotSrcRefs" ${rot.srcRefs !== false ? 'checked' : ''}
                                   onchange="var f=document.getElementById('rotCharFilter');if(f)f.style.display=this.checked?'flex':'none'">${I18n.t('widgets.rot_src_refs', '立絵レジストリ')}
                        </label>
                        ${names.length ? `<div id="rotCharFilter" style="display:${rot.srcRefs !== false ? 'flex' : 'none'};flex-wrap:wrap;gap:6px;padding-left:24px">
                            ${names.map(n => `<label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text-secondary)"><input type="checkbox" class="rotChar" value="${this._escAttr(n)}" ${(!rot.charNames || !rot.charNames.length || rot.charNames.includes(n)) ? 'checked' : ''}>${Utils.escapeHtml(n)}</label>`).join('')}
                        </div>` : ''}
                    </div>
                </div>`;
                })()}
                ${(w.imageUrl && w.imageUrl.trim() && !(w.rotation && w.rotation.enabled)) ? `
                <div style="display:flex;gap:8px;margin-top:4px">
                    <button onclick="Widgets._openImagePositioner('${id}')"
                            style="flex:1;padding:8px;border:1px solid var(--border-light);border-radius:8px;background:none;color:var(--text-secondary);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
                        ${Utils.escapeHtml(I18n.t('widgets.imgpos_open_btn', '位置を調整'))}
                    </button>
                </div>` : ''}
                <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
                    <span style="font-size:12px;color:var(--text-secondary);white-space:nowrap">${I18n.t('widgets.tilt_label', '倾斜角度')}</span>
                    <input type="range" id="pjTilt" min="-6" max="6" step="0.5" value="${(w.tilt || 0).toFixed(1)}"
                           oninput="Widgets._setPolaroidTilt('${id}', this.value)"
                           onchange="Widgets._setPolaroidTilt('${id}', this.value, true)"
                           style="flex:1;accent-color:var(--accent-color);cursor:pointer">
                    <span id="pjTiltVal" style="font-size:12px;color:var(--text-secondary);min-width:42px;text-align:right;font-variant-numeric:tabular-nums">${(w.tilt || 0).toFixed(1)}°</span>
                </div>
                <div style="display:flex;gap:8px;margin-top:4px">
                    <button onclick="this.closest('.modal-overlay').remove()"
                            style="flex:1;padding:10px;border:1px solid var(--border-medium);border-radius:8px;background:none;color:var(--text-primary);font-size:14px;cursor:pointer">取消</button>
                    <button onclick="Widgets._savePolaroidJ('${id}', this.closest('.modal-overlay'))"
                            style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--accent-color);color:#fff;font-size:14px;font-weight:600;cursor:pointer">保存</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    },

    _savePolaroidJ(id, modal) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) return;
        const url = modal.querySelector('#pjUrl').value.trim();
        const caption = modal.querySelector('#pjCaption').value.trim();
        if (url && url !== w.imageUrl) w.imageUrl = url;
        w.caption = caption;
        const rotEnable = modal.querySelector('#rotEnable');
        if (rotEnable) {
            const boxes = Array.from(modal.querySelectorAll('.rotChar'));
            const picked = boxes.filter(c => c.checked).map(c => c.value);
            w.rotation = {
                enabled: rotEnable.checked,
                srcFav: modal.querySelector('#rotSrcFav').checked,
                srcRefs: modal.querySelector('#rotSrcRefs').checked,
                charNames: (boxes.length && picked.length === boxes.length) ? [] : picked   // 全选 = 不过滤
            };
            if (w.rotation.enabled) {
                this._rotateAllPicks();   // 保存即抽第一张
            } else {
                // 关闭轮播后不会再有任何水合排队，_rotationUrls[id] 里最后一个 ObjectURL
                // 否则要等 deleteWidget/刷新页面才释放——立即 revoke（v2.193 修）
                if (this._rotationUrls[id]) {
                    this._rotationUrls[id].forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} });
                    delete this._rotationUrls[id];
                }
                w._rotPick = null;
            }
        }
        this._save();
        this.render();
        modal.remove();
    },

    _handlePolaroidUpload(id, file, modal) {
        if (!file || !file.type.startsWith('image/')) return;
        // 复用 Utils.readImageFile 压缩链
        if (typeof Utils === 'undefined' || !Utils.readImageFile) {
            // 降级：直接 readAsDataURL（不压缩）
            const reader = new FileReader();
            reader.onload = e => {
                const w = this._getWidgets().find(x => x.id === id);
                if (w) { w.imageUrl = e.target.result; this._save(); this.render(); }
                if (modal) modal.remove();
            };
            reader.readAsDataURL(file);
            return;
        }
        Utils.readImageFile(file, { maxSize: 800, quality: 0.85 }).then(dataUrl => {
            const w = this._getWidgets().find(x => x.id === id);
            if (w && dataUrl) { w.imageUrl = dataUrl; this._save(); this.render(); }
            if (modal) modal.remove();
        });
    },

    // 倾角滑杆（2026-08-03 作者提议：随机换角度 → 用户自己定）。
    // oninput 只更新 DOM（滑动才顺滑），onchange 才落盘；tiltManual 标记手调过，
    // 轮播换相纸时不再重随机角度覆盖用户的选择。
    _setPolaroidTilt(id, val, commit) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) return;
        const deg = Math.max(-6, Math.min(6, parseFloat(val) || 0));
        w.tilt = deg;
        const label = document.getElementById('pjTiltVal');
        if (label) label.textContent = deg.toFixed(1) + '°';
        const card = document.querySelector(`.desktop-grid-widget[data-widget-id="${id}"] .widget-card`);
        if (card) card.style.transform = `rotate(${deg.toFixed(2)}deg)`;
        if (commit) {
            w.tiltManual = true;
            this._save();
        }
    },

    // ══════════════════════════════════════
    //  ⏰ 时钟组件（小方/宽条两档）
    //  ─ 时间/日期由 SystemConfig.startRealtimeUpdates 每秒刷新
    // ══════════════════════════════════════
    _renderClock(w, sizeClass) {
        const d = w.data || {};
        const f24 = d.format24 !== false; // default 24h

        if (w.shape === 'circle') {
            // 圆表盘：12 刻度（4 主实+8 副虚）+ 时/分针。指针角度渲染时算一次；
            // 之后每分钟由 SystemConfig.refreshClocks（settings.js）按 data-clock-hourhand/minhand
            // 直改 <g transform>，不重渲染整个组件（秒针不做，省电）
            const now = new Date();
            const hourAngle = ((now.getHours() % 12) + now.getMinutes() / 60) * 30;
            const minAngle = now.getMinutes() * 6;
            return `<div class="widget-card ${sizeClass} widget-clock widget-clockface-circle"
                         onclick="Widgets.editClock('${w.id}')">
                <svg class="clockface-svg" viewBox="0 0 72 72" aria-hidden="true">
                    <g stroke="var(--desktop-text)" opacity="0.35" stroke-width="1.5" stroke-linecap="round">
                        <path d="M36 8 v5"/><path d="M36 59 v5"/><path d="M8 36 h5"/><path d="M59 36 h5"/>
                    </g>
                    <g stroke="var(--desktop-text)" opacity="0.18" stroke-width="1" stroke-linecap="round">
                        <path d="M50 11.8 l-2.5 4.3"/><path d="M60.2 22 l-4.3 2.5"/><path d="M60.2 50 l-4.3 -2.5"/><path d="M50 60.2 l-2.5 -4.3"/>
                        <path d="M22 60.2 l2.5 -4.3"/><path d="M11.8 50 l4.3 -2.5"/><path d="M11.8 22 l4.3 2.5"/><path d="M22 11.8 l2.5 4.3"/>
                    </g>
                    <g data-clock-hourhand transform="rotate(${hourAngle.toFixed(2)} 36 36)">
                        <path d="M36 36 L36 23" stroke="var(--desktop-text)" stroke-width="3" stroke-linecap="round" opacity="0.85"/>
                    </g>
                    <g data-clock-minhand transform="rotate(${minAngle.toFixed(2)} 36 36)">
                        <path d="M36 36 L36 19" stroke="var(--desktop-text)" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
                    </g>
                    <circle cx="36" cy="36" r="2.4" fill="var(--accent-color)"/>
                </svg>
            </div>`;
        }

        if (w.size === 'wide') {
            return `<div class="widget-card ${sizeClass} widget-clock clock-wide"
                         onclick="Widgets.editClock('${w.id}')"
                         data-clock-format="${f24 ? '24' : '12'}">
                <div class="clock-time clock-time-wide" data-clock-time>--:--</div>
                <div class="clock-meta">
                    <div class="clock-weekday" data-clock-weekday>--</div>
                    <div class="clock-date" data-clock-date>--</div>
                </div>
                ${this._sparkSvg('clock-spark spark-a')}
                ${this._sparkSvg('clock-spark spark-b')}
            </div>`;
        }

        // small：方形，居中大时间 + 下方日期
        return `<div class="widget-card ${sizeClass} widget-clock clock-square"
                     onclick="Widgets.editClock('${w.id}')"
                     data-clock-format="${f24 ? '24' : '12'}">
            ${this._sparkSvg('clock-spark spark-a')}
            <div class="clock-time clock-time-small" data-clock-time>--:--</div>
            <div class="clock-meta">
                <div class="clock-weekday" data-clock-weekday>--</div>
                <div class="clock-date" data-clock-date>--</div>
            </div>
            ${this._sparkSvg('clock-spark spark-b')}
        </div>`;
    },

    editClock(id) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) return;
        const d = w.data || {};
        const f24 = d.format24 !== false;

        // 尺寸切换按钮文案：小方形 → 宽横条 → 圆表盘 → 小方形 三档循环，显示「当前 → 下一档」（同 _toggleMusicSize 模式）
        const clockSizeNames = {
            small: I18n.t('widgets.clk_size_small', '小さい四角'),
            wide: I18n.t('widgets.clk_size_wide', '横長バー'),
            circle: I18n.t('widgets.clk_size_circle', '丸い文字盤')
        };
        const clockCurSizeKey = w.shape === 'circle' ? 'circle' : (w.size === 'wide' ? 'wide' : 'small');
        const clockNextSizeKey = clockCurSizeKey === 'small' ? 'wide' : (clockCurSizeKey === 'wide' ? 'circle' : 'small');
        const clockSizeSwitchLabel = I18n.t('widgets.clk_size_switch_prefix', 'サイズ切替（現在：')
            + clockSizeNames[clockCurSizeKey] + ' → ' + clockSizeNames[clockNextSizeKey] + '）';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
        modal.onclick = e => { if (e.target === modal) modal.remove(); };
        modal.innerHTML = `
            <div class="modal-window" style="gap:14px">
                <h3 style="margin:0;font-size:17px;font-weight:600">⏰ 时钟设置</h3>
                <label style="display:flex;align-items:center;justify-content:space-between;font-size:14px;color:var(--text-primary)">
                    <span>24 小时制</span>
                    <input type="checkbox" id="clkFmt24" ${f24 ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer">
                </label>
                <div style="display:flex;gap:8px">
                    <button onclick="Widgets._toggleClockSize('${id}', this.closest('.modal-overlay'))"
                            style="flex:1;padding:8px;border:1px solid var(--border-light);border-radius:8px;background:none;color:var(--text-secondary);font-size:12px;cursor:pointer">
                        ${this._esc(clockSizeSwitchLabel)}
                    </button>
                </div>
                <div style="display:flex;gap:8px;margin-top:4px">
                    <button onclick="this.closest('.modal-overlay').remove()"
                            style="flex:1;padding:10px;border:1px solid var(--border-medium);border-radius:8px;background:none;color:var(--text-primary);font-size:14px;cursor:pointer">取消</button>
                    <button onclick="Widgets._saveClock('${id}', this.closest('.modal-overlay'))"
                            style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--accent-color);color:#fff;font-size:14px;font-weight:600;cursor:pointer">保存</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    },

    _saveClock(id, modal) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) return;
        w.data = {
            ...(w.data || {}),
            format24: modal.querySelector('#clkFmt24').checked
        };
        this._save();
        this.render();
        modal.remove();
    },

    _toggleClockSize(id, modal) {
        const w = this._getWidgets().find(x => x.id === id);
        if (w) {
            // 三档循环：小方形 → 宽横条 → 圆表盘 → 小方形
            // 圆表盘＝shape:'circle'+size:'small'（同 _toggleMusicSize 模式，圆形组件恒 1 列不入 wide 环）
            if (w.shape === 'circle') {
                delete w.shape;
                w.size = 'small';
            } else if (w.size === 'wide') {
                w.size = 'small';
                w.shape = 'circle';
            } else {
                w.size = 'wide';
            }
            this._save();
            // w.size 此时恒为 'small' 或 'wide'（circle 档下沿也是 'small'），不会把 'circle' 传给尺寸→colSpan 映射
            if (typeof DesktopRenderer !== 'undefined') {
                this._syncLayoutSpan(w.id, w.size);
            }
            this.render();
        }
        if (modal) modal.remove();
    },

    // ══════════════════════════════════════
    //  📸 相册组件（v2.249 重做，仿 iOS 照片小组件）
    //  small/wide/large 三档＝满版纯图（object-fit cover，圆角由 .widget-card 承担，无任何装饰）；
    //  mini＝1×1 迷你圆贴纸（沿用既有 .widget-photoframe-circle 白边圆框）。
    //  故意不用 .widget-polaroid 类名——各主题的相框皮肤 background 会叠到满版照片上；
    //  那些皮肤规则在 css/themes.css 里保留不删，只是不再被这个新结构匹配（休眠）。
    // ══════════════════════════════════════
    _renderPhoto(w, sizeClass) {
        const rotActive = !!(w.rotation && w.rotation.enabled && w._rotPick);
        if (rotActive) this._queueRotationHydration(w.id);
        const hasImage = w.imageUrl && w.imageUrl.trim();
        const emptyHint = I18n.t('widgets.ph_empty_hint', '更换照片');
        const photoBox = rotActive
            ? `<div style="width:100%;height:100%" data-rot-widget="${w.id}"></div>`
            : hasImage
                ? `<img src="${this._escAttr(w.imageUrl)}" alt="" style="${ImagePositioner.transformStyle(w.imgPos)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                   <div class="widget-photo-empty" style="display:none"><span class="widget-photo-plus">+</span><span>${this._esc(emptyHint)}</span></div>`
                : `<div class="widget-photo-empty"><span class="widget-photo-plus">+</span><span>${this._esc(emptyHint)}</span></div>`;

        if (w.shape === 'circle') {
            // 迷你圆（mini，1×1）：贴纸白边圆框（borderWidth/背景由 .widget-photoframe-circle 覆盖 .widget-circle 底座），
            // 内部只铺照片（ランダム表示轮播/空态占位都走既有 photoBox，图片定位走 ImagePositioner，形状无关零改动）
            return `<div class="widget-card ${sizeClass} widget-photoframe-circle"
                         onclick="Widgets.editPhoto('${w.id}')">${photoBox}</div>`;
        }

        // 矩形三档（small/wide/large）：满版纯图，形状差异全部交给 CSS 的 aspect-ratio 锁定
        return `<div class="widget-card ${sizeClass} widget-photo-clean"
                     onclick="Widgets.editPhoto('${w.id}')">${photoBox}</div>`;
    },

    editPhoto(id) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) return;

        // 尺寸切换按钮文案：small → wide → large → mini(迷你圆) → small 四档循环，显示「当前 → 下一档」
        const photoSizeNames = {
            small: I18n.t('widgets.ph_size_small', '小さい四角'),
            wide: I18n.t('widgets.ph_size_wide', '横長バー'),
            large: I18n.t('widgets.ph_size_large', '大きい四角'),
            mini: I18n.t('widgets.ph_size_mini', '丸いミニ')
        };
        const photoSizeOrder = ['small', 'wide', 'large', 'mini'];
        const photoCurSizeKey = (w.shape === 'circle' && w.size === 'mini') ? 'mini' : (w.size || 'small');
        const photoNextSizeKey = photoSizeOrder[(photoSizeOrder.indexOf(photoCurSizeKey) + 1) % photoSizeOrder.length];
        const photoSizeSwitchLabel = I18n.t('widgets.ph_size_switch_prefix', 'サイズ切替（現在：')
            + photoSizeNames[photoCurSizeKey] + ' → ' + photoSizeNames[photoNextSizeKey] + '）';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
        modal.onclick = e => { if (e.target === modal) modal.remove(); };
        modal.innerHTML = `
            <div class="modal-window" style="gap:16px">
                <h3 style="margin:0;font-size:17px;font-weight:600">编辑相册</h3>
                <div style="font-size:13px;color:var(--text-secondary)">选择图片来源</div>
                <input type="text" id="widgetPhotoUrl" placeholder="粘贴图片URL…"
                       value="${this._escAttr(w.imageUrl || '')}"
                       style="width:100%;padding:10px 12px;border:1px solid var(--border-medium);border-radius:8px;font-size:14px;background:var(--bg-base);color:var(--text-primary)">
                <div style="text-align:center;font-size:12px;color:var(--text-tertiary)">— 或 —</div>
                <label class="widget-upload-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;vertical-align:-2px"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg> 从相册选择
                    <input type="file" accept="image/*" style="display:none"
                           onchange="Widgets._handlePhotoUpload('${id}', this.files[0], this.closest('.modal-overlay'))">
                </label>
                <div style="display:flex;gap:8px;margin-top:4px">
                    <button onclick="this.closest('.modal-overlay').remove()"
                            style="flex:1;padding:10px;border:1px solid var(--border-medium);border-radius:8px;background:none;color:var(--text-primary);font-size:14px;cursor:pointer">取消</button>
                    <button onclick="Widgets._savePhotoUrl('${id}', this.closest('.modal-overlay'))"
                            style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--accent-color);color:#fff;font-size:14px;font-weight:600;cursor:pointer">确定</button>
                </div>
                ${(() => {
                    const rot = w.rotation || {};
                    const refs = (typeof Broadcast !== 'undefined' && Broadcast.getAllCharRefs) ? Broadcast.getAllCharRefs() : [];
                    const names = [...new Set(refs.map(r => (r.name || '').trim()).filter(Boolean))];
                    return `<div style="border-top:1px solid var(--border-light);padding-top:10px;display:flex;flex-direction:column;gap:8px">
                    <label style="display:flex;align-items:center;justify-content:space-between;font-size:14px;color:var(--text-primary)">
                        <span>${I18n.t('widgets.rot_enable', 'ランダム表示')}</span>
                        <input type="checkbox" id="rotEnable" ${rot.enabled ? 'checked' : ''}
                               onchange="document.getElementById('rotOpts').style.display=this.checked?'flex':'none'"
                               style="width:18px;height:18px;cursor:pointer">
                    </label>
                    <div id="rotOpts" style="display:${rot.enabled ? 'flex' : 'none'};flex-direction:column;gap:6px">
                        <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary)">
                            <input type="checkbox" id="rotSrcFav" ${rot.srcFav !== false ? 'checked' : ''}>${I18n.t('widgets.rot_src_fav', 'pixivブックマーク')}
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary)">
                            <input type="checkbox" id="rotSrcRefs" ${rot.srcRefs !== false ? 'checked' : ''}
                                   onchange="var f=document.getElementById('rotCharFilter');if(f)f.style.display=this.checked?'flex':'none'">${I18n.t('widgets.rot_src_refs', '立絵レジストリ')}
                        </label>
                        ${names.length ? `<div id="rotCharFilter" style="display:${rot.srcRefs !== false ? 'flex' : 'none'};flex-wrap:wrap;gap:6px;padding-left:24px">
                            ${names.map(n => `<label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text-secondary)"><input type="checkbox" class="rotChar" value="${this._escAttr(n)}" ${(!rot.charNames || !rot.charNames.length || rot.charNames.includes(n)) ? 'checked' : ''}>${Utils.escapeHtml(n)}</label>`).join('')}
                        </div>` : ''}
                    </div>
                </div>`;
                })()}
                ${(w.imageUrl && w.imageUrl.trim() && !(w.rotation && w.rotation.enabled)) ? `
                <div style="display:flex;gap:8px">
                    <button onclick="Widgets._openImagePositioner('${id}')"
                            style="flex:1;padding:8px;border:1px solid var(--border-light);border-radius:8px;background:none;color:var(--text-secondary);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
                        ${Utils.escapeHtml(I18n.t('widgets.imgpos_open_btn', '位置を調整'))}
                    </button>
                </div>` : ''}
                <div style="display:flex;gap:8px">
                    <button onclick="Widgets._togglePhotoSize('${id}', this.closest('.modal-overlay'))"
                            style="flex:1;padding:8px;border:1px solid var(--border-light);border-radius:8px;background:none;color:var(--text-secondary);font-size:12px;cursor:pointer">
                        ${this._esc(photoSizeSwitchLabel)}
                    </button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    },

    _savePhotoUrl(id, modal) {
        const url = modal.querySelector('#widgetPhotoUrl').value.trim();
        const w = this._getWidgets().find(x => x.id === id);
        if (w) {
            w.imageUrl = url;
            const rotEnable = modal.querySelector('#rotEnable');
            if (rotEnable) {
                const boxes = Array.from(modal.querySelectorAll('.rotChar'));
                const picked = boxes.filter(c => c.checked).map(c => c.value);
                w.rotation = {
                    enabled: rotEnable.checked,
                    srcFav: modal.querySelector('#rotSrcFav').checked,
                    srcRefs: modal.querySelector('#rotSrcRefs').checked,
                    charNames: (boxes.length && picked.length === boxes.length) ? [] : picked   // 全选 = 不过滤
                };
                if (w.rotation.enabled) {
                    this._rotateAllPicks();   // 保存即抽第一张
                } else {
                    // 关闭轮播后不会再有任何水合排队，_rotationUrls[id] 里最后一个 ObjectURL
                    // 否则要等 deleteWidget/刷新页面才释放——立即 revoke（v2.193 修）
                    if (this._rotationUrls[id]) {
                        this._rotationUrls[id].forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} });
                        delete this._rotationUrls[id];
                    }
                    w._rotPick = null;
                }
            }
            this._save();
            this.render();
        }
        modal.remove();
    },

    _handlePhotoUpload(id, file, modal) {
        if (!file || !file.type.startsWith('image/')) return;
        // 压缩大图
        const maxSize = 800;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > maxSize || height > maxSize) {
                    const ratio = Math.min(maxSize / width, maxSize / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

                const w = this._getWidgets().find(x => x.id === id);
                if (w) {
                    w.imageUrl = dataUrl;
                    this._save();
                    this.render();
                }
                if (modal) modal.remove();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    _togglePhotoSize(id, modal) {
        const w = this._getWidgets().find(x => x.id === id);
        if (w) {
            // 四档循环：small → wide → large → mini(迷你圆) → small
            // mini＝shape:'circle'+size:'mini'（1 列迷你圆，全系统仅相册专属，见 _renderWidget sizeClass 组装）
            const order = ['small', 'wide', 'large', 'mini'];
            const curKey = (w.shape === 'circle' && w.size === 'mini') ? 'mini' : (w.size || 'small');
            const nextKey = order[(order.indexOf(curKey) + 1) % order.length];
            if (nextKey === 'mini') {
                w.shape = 'circle';
                w.size = 'mini';
            } else {
                delete w.shape;
                w.size = nextKey;
            }
            this._save();
            // 布局里的 colSpan 也要同步更新；w.size 此时恒为 small/wide/large/mini 之一
            if (typeof DesktopRenderer !== 'undefined') {
                this._syncLayoutSpan(w.id, w.size);
            }
            this.render();
        }
        if (modal) modal.remove();
    },

    // 同步 desktopLayout 里对应 widget 的 colSpan（尺寸切换后使用）
    // v2.223：span 换算跟随桌面列数（3/4 列），裸标识符 + typeof 守卫——本文件在 index.html 里比
    // desktop-edit.js 先加载，但这个方法只在用户点击尺寸切换按钮时才会真正执行，那时两个脚本都已
    // 跑完，_widgetSpan 必然存在；守卫只是兜底（node 测试等场景下单独加载 widgets.js）。
    _syncLayoutSpan(widgetId, size) {
        const layout = AppState.data.desktopLayout;
        if (!layout) return;
        const span = (typeof _widgetSpan === 'function')
            ? _widgetSpan(size)
            : (({ mini: 1, small: 2, medium: 2, wide: 3, large: 3 })[size] || 1);
        for (const page of layout.pages) {
            for (const item of page.items) {
                if (item.type === 'widget' && item.widgetId === widgetId) {
                    item.colSpan = span;
                }
            }
        }
        layout.pages.forEach((_, i) => DesktopRenderer.reflow(i));
        Utils.saveData();
    },

    // ══════════════════════════════════════
    //  📅 日历组件
    // ══════════════════════════════════════
    _renderCalendar(w, sizeClass) {
        if (w.size === 'wide') return this._renderCalendarWide(w, sizeClass);
        return this._renderCalendarMini(w, sizeClass);
    },

    // small 档 v2（v2.249 重做，iOS 同款整月迷你格）：上方月份标签（accent 色）+ 今日「N日(曜)」，
    // 下方复用 _renderCalendarGrid（今日圈圈/纪念日色点自带）。原「大日期+予定」卡片渲染退役
    // （旧版 widget-cal-day/widget-cal-events 相关 CSS 未删，small 档不再产出这些 class，休眠即可）。
    // 独立类名 .widget-cal-mini，不复用 .widget-calendar——2×2 密度和 wide 档差很多，各自定制。
    // 日期用「N日(曜)」的日式记法（曜=汉字周几），与 _renderCalendarGrid 的曜日表头/_renderCalendarWide
    // 的 ja-JP 长曜日同一套约定，不接 I18n（本组件的日期记法本就固定，不是翻译缺口）。
    _renderCalendarMini(w, sizeClass) {
        const now = new Date();
        const month = now.toLocaleDateString('ja-JP', { month: 'short' });
        const day = now.getDate();
        const weekday = now.toLocaleDateString('ja-JP', { weekday: 'short' });

        return `<div class="widget-card ${sizeClass} widget-cal-mini"
                     onclick="Widgets.editCalendar('${w.id}')"
>
            <div class="wcm-header">
                <span class="wcm-month">${month}</span>
                <span class="wcm-today">${day}日(${weekday})</span>
            </div>
            <div class="wcm-grid">${this._renderCalendarGrid(now)}</div>
        </div>`;
    },

    // wide 档：左「今日」+ 右「整月网格」，small 档渲染路径完全不动（见上方早退分支）
    _renderCalendarWide(w, sizeClass) {
        const now = new Date();
        const month = now.toLocaleDateString('ja-JP', { month: 'short' });
        const day = now.getDate();
        const weekdayLong = now.toLocaleDateString('ja-JP', { weekday: 'long' });

        const events = this._getUpcomingEvents();
        const eventHtml = events.length > 0
            ? events.slice(0, 2).map(ev =>
                `<div class="wcw-event">
                    <span class="wcw-event-dot" style="background:${this._escAttr(ev.color)}"></span>
                    <span>${ev.label}</span>
                </div>`).join('')
            : `<div class="wcw-event" style="opacity:0.5">${I18n.t('widgets.cal_no_events', '予定なし')}</div>`;

        return `<div class="widget-card ${sizeClass} widget-calendar-wide"
                     onclick="Widgets.editCalendar('${w.id}')"
>
            <div class="wcw-left">
                <div class="wcw-month">${month}</div>
                <div class="wcw-day">${day}</div>
                <div class="wcw-weekday">${weekdayLong}</div>
                <div class="wcw-events">${eventHtml}</div>
            </div>
            <div class="wcw-grid">${this._renderCalendarGrid(now)}</div>
        </div>`;
    },

    // 当月网格：纯 Date 数学生成（日曜起）。跨月边界＝首尾留空格不显示邻月日期数字；
    // 闰年靠 new Date(y, m+1, 0).getDate() 原生取当月天数，2 月闰年自动拿到 29，无需特判。
    // 周六开局的 31 天月会把表撑到 6 个星期行（如 2026-08）——这种月份 <table> 加 class
    // wcw-r6，供 style.css 在 wide 档（.wcw-grid 限定）压窄行高；mini 档富余够大不受影响。
    _renderCalendarGrid(now) {
        const year = now.getFullYear();
        const monthIdx = now.getMonth();              // 0-based
        const monthNum = monthIdx + 1;                 // 1-based，对齐 calendarEvents 的 "月/日"
        const todayDate = now.getDate();
        const firstWeekday = new Date(year, monthIdx, 1).getDay();       // 0=日曜
        const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

        // 当月纪念日按「日」分桶，同日最多留 2 个色点（多出的丢弃，不做溢出提示）
        const dayDots = {};
        (AppState.data.calendarEvents || []).forEach(ev => {
            const [m, d] = (ev.date || '').split('/').map(Number);
            if (m === monthNum && d >= 1 && d <= daysInMonth) {
                if (!dayDots[d]) dayDots[d] = [];
                if (dayDots[d].length < 2) dayDots[d].push(ev.color || '#5856d6');
            }
        });

        const cells = [];
        for (let i = 0; i < firstWeekday; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
        while (cells.length % 7 !== 0) cells.push(null);

        const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];
        const headHtml = weekdayLabels.map((wd, i) =>
            `<th class="${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${wd}</th>`).join('');

        let rowsHtml = '';
        for (let i = 0; i < cells.length; i += 7) {
            const week = cells.slice(i, i + 7);
            rowsHtml += `<tr>${week.map(d => {
                if (d === null) return `<td class="dim"></td>`;
                const isToday = d === todayDate;
                const dots = dayDots[d] || [];
                const dotsHtml = dots.length
                    ? `<span class="wcw-evdots">${dots.map(c => `<span class="wcw-evdot" style="background:${this._escAttr(c)}"></span>`).join('')}</span>`
                    : '';
                return `<td class="${isToday ? 'today' : ''}">${isToday ? '<span class="wcw-blob"></span>' : ''}${d}${dotsHtml}</td>`;
            }).join('')}</tr>`;
        }

        const r6Class = cells.length === 42 ? ' class="wcw-r6"' : '';
        return `<table${r6Class}><tr>${headHtml}</tr>${rowsHtml}</table>`;
    },

    _getUpcomingEvents() {
        const events = AppState.data.calendarEvents || [];
        const now = new Date();
        const thisMonth = now.getMonth() + 1;
        const thisDay = now.getDate();

        return events
            .map(ev => {
                const [m, d] = (ev.date || '').split('/').map(Number);
                let daysUntil = 0;
                if (m === thisMonth) daysUntil = d - thisDay;
                else if (m > thisMonth) daysUntil = (m - thisMonth) * 30 + d - thisDay;
                else daysUntil = (12 - thisMonth + m) * 30 + d - thisDay;
                return { ...ev, daysUntil };
            })
            .filter(ev => ev.daysUntil >= 0 && ev.daysUntil <= 30)
            .sort((a, b) => a.daysUntil - b.daysUntil)
            .map(ev => ({
                label: ev.daysUntil === 0
                    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="width:11px;height:11px;vertical-align:-1px"><path d="M6 21V4l12 4-12 4"/></svg> ${Utils.escapeHtml(ev.name)}`
                    : `${Utils.escapeHtml(ev.name)} (${ev.daysUntil}日後)`,
                color: ev.color || '#5856d6'
            }));
    },

    editCalendar(id) {
        if (!AppState.data.calendarEvents) AppState.data.calendarEvents = [];
        const events = AppState.data.calendarEvents;
        const w = this._getWidgets().find(x => x.id === id);   // 尺寸切换按钮要读 w.size

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
        modal.onclick = e => { if (e.target === modal) modal.remove(); };

        const listHtml = events.map((ev, i) =>
            `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border-light)">
                <span style="width:8px;height:8px;border-radius:50%;background:${ev.color || '#5856d6'};flex-shrink:0"></span>
                <span style="flex:1;font-size:14px">${Utils.escapeHtml(ev.date)} ${Utils.escapeHtml(ev.name)}</span>
                <button onclick="Widgets._deleteEvent(${i}, this.closest('.modal-overlay'))"
                        style="background:none;border:none;color:var(--accent-color);font-size:16px;cursor:pointer;padding:10px;min-width:44px;min-height:44px">✕</button>
            </div>`
        ).join('');

        modal.innerHTML = `
            <div class="modal-window" style="gap:12px">
                <h3 style="margin:0;font-size:17px;font-weight:600;display:flex;align-items:center;gap:6px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="width:16px;height:16px"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>纪念日管理</h3>
                <div style="max-height:200px;overflow-y:auto">${listHtml || '<div style="font-size:13px;color:var(--text-tertiary);text-align:center;padding:16px">还没有纪念日</div>'}</div>
                ${(() => {
                    // v2.207.1: 生日下拉要的是「名字」，不再走 getAllCharRefs()——那个 API 只收录
                    // 传过立绘参考图的角色（cpCharARefId 存在才算，契约是给生图 blob 消费方的）。
                    // 手机端没传参考图 → 名单空 → 下拉整个消失（記念日按钮不要求图所以还在）。
                    const cp = (AppState.data.broadcast && AppState.data.broadcast.cpSettings) || {};
                    const cpA = (cp.cpCharA || '').trim(), cpB = (cp.cpCharB || '').trim();
                    const extraNames = ((AppState.data.broadcast || {}).charRefs || []).map(e => (e.name || '').trim());
                    const names = [...new Set([cpA, cpB, ...extraNames].filter(Boolean))];
                    if (!names.length) return '';   // 一个名字都没有 → 快捷行整体隐藏，回到纯手填
                    return `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                        <span style="font-size:12px;color:var(--text-secondary)">${I18n.t('widgets.cal_quick', 'クイック追加')}</span>
                        ${names.length ? `<select onchange="Widgets._quickFillBirthday(this)"
                                style="flex:1;min-width:110px;padding:8px;border:1px solid var(--border-medium);border-radius:8px;font-size:13px;background:var(--bg-base);color:var(--text-primary)">
                            <option value="">${I18n.t('widgets.cal_quick_bday', '誕生日…')}</option>
                            ${names.map(n => `<option value="${this._escAttr(n)}">${Utils.escapeHtml(n)}</option>`).join('')}
                        </select>` : ''}
                        ${(cpA && cpB) ? `<button onclick="Widgets._quickFillAnniversary(this)" data-a="${this._escAttr(cpA)}" data-b="${this._escAttr(cpB)}"
                                style="padding:8px 12px;border:1px solid var(--border-medium);border-radius:8px;background:none;color:var(--text-secondary);font-size:13px;cursor:pointer">${I18n.t('widgets.cal_quick_anniv', '記念日')}</button>` : ''}
                    </div>`;
                })()}
                <div style="display:flex;gap:8px">
                    <button onclick="Widgets._toggleCalendarSize('${id}', this.closest('.modal-overlay'))"
                            style="flex:1;padding:8px;border:1px solid var(--border-light);border-radius:8px;background:none;color:var(--text-secondary);font-size:12px;cursor:pointer">
                        ${w && w.size === 'wide' ? I18n.t('widgets.cal_toggle_wide_to_small', 'ワイド → 小に切替') : I18n.t('widgets.cal_toggle_small_to_wide', '小 → ワイドに切替')}
                    </button>
                </div>
                <div style="display:flex;gap:8px;align-items:center">
                    <input id="calEventDate" placeholder="月/日 (如 7/3)" style="width:80px;padding:8px;border:1px solid var(--border-medium);border-radius:8px;font-size:13px;background:var(--bg-base);color:var(--text-primary)">
                    <input id="calEventName" placeholder="名称 (例：キャラの誕生日 / 放送開始日)" style="flex:1;padding:8px;border:1px solid var(--border-medium);border-radius:8px;font-size:13px;background:var(--bg-base);color:var(--text-primary)">
                </div>
                <div style="display:flex;gap:8px">
                    <button onclick="this.closest('.modal-overlay').remove()"
                            style="flex:1;padding:10px;border:1px solid var(--border-medium);border-radius:8px;background:none;color:var(--text-primary);font-size:14px;cursor:pointer">关闭</button>
                    <button onclick="Widgets._addEvent(this.closest('.modal-overlay'))"
                            style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--accent-color);color:#fff;font-size:14px;font-weight:600;cursor:pointer">添加</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    },

    // B7 快捷模板：选角色 → 自动填名称+定色，日期仍手填（focus 过去等输入）
    _quickFillBirthday(sel) {
        if (!sel.value) return;
        const modal = sel.closest('.modal-overlay');
        modal.querySelector('#calEventName').value = I18n.t('widgets.cal_bday_fmt', { name: sel.value });
        modal.dataset.quickColor = '#ff9500';
        modal.querySelector('#calEventDate').focus();
        sel.value = '';
    },

    _quickFillAnniversary(btn) {
        const modal = btn.closest('.modal-overlay');
        modal.querySelector('#calEventName').value = `${btn.dataset.a}×${btn.dataset.b} ${I18n.t('widgets.cal_quick_anniv', '記念日')}`;
        modal.dataset.quickColor = '#ff2d55';
        modal.querySelector('#calEventDate').focus();
    },

    _addEvent(modal) {
        const date = modal.querySelector('#calEventDate').value.trim();
        const name = modal.querySelector('#calEventName').value.trim();
        if (!date || !name) return;
        const parts = date.split('/').map(Number);
        if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1]) || parts[0] < 1 || parts[0] > 12 || parts[1] < 1 || parts[1] > 31) {
            alert('日期格式：月/日（如 7/3）');
            return;
        }
        if (!AppState.data.calendarEvents) AppState.data.calendarEvents = [];
        const colors = ['#5856d6', '#ff9500', '#ff2d55', '#34c759', '#007aff', '#af52de'];
        AppState.data.calendarEvents.push({
            date, name,
            color: modal.dataset.quickColor || colors[AppState.data.calendarEvents.length % colors.length]
        });
        this._save();
        this.render();
        modal.remove();
    },

    _deleteEvent(index, modal) {
        if (!AppState.data.calendarEvents) return;
        AppState.data.calendarEvents.splice(index, 1);
        this._save();
        this.render();
        modal.remove();
    },

    // small ↔ wide 两档互切（照 _toggleClockSize 的模式，日历不需要 medium 档）
    _toggleCalendarSize(id, modal) {
        const w = this._getWidgets().find(x => x.id === id);
        if (w) {
            w.size = w.size === 'wide' ? 'small' : 'wide';
            this._save();
            if (typeof DesktopRenderer !== 'undefined') {
                this._syncLayoutSpan(w.id, w.size);
            }
            this.render();
        }
        if (modal) modal.remove();
    },

    // ══════════════════════════════════════
    //  🎵 音乐组件（小/中方形+宽横条，蝴蝶结+黑胶+进度条+控件）
    // ══════════════════════════════════════
    _renderMusic(w, sizeClass) {
        const d = w.data || {};
        const hasCover = d.coverUrl && d.coverUrl.trim();
        // 圆档默认用 accent-soft 贴深盘更柔和；用户若自选过颜色仍尊重其选择
        const accentColor = d.color || (w.shape === 'circle' ? 'var(--accent-soft)' : 'var(--accent-color)');
        const hasAudio = !!(d.audioSongId || d.audioUrl);
        const audio = this._musicAudios?.[w.id];
        const isPlaying = !!(audio && !audio.paused);
        const playClass = isPlaying ? ' is-playing' : '';

        const disc = `<div class="vinyl-disc" style="--vinyl-accent:${accentColor}">
            <div class="vinyl-grooves"></div>
            <div class="vinyl-label">
                ${hasCover
                    ? `<img src="${this._escAttr(d.coverUrl)}" alt="" onerror="this.parentElement.classList.add('no-cover')">`
                    : ''}
            </div>
            <div class="vinyl-hole"></div>
        </div>`;

        // 播放/暂停 SVG（按钮样式跟随播放状态）
        const playPauseInner = isPlaying
            ? '<circle cx="12" cy="12" r="10"/><path d="M10 9v6M14 9v6" stroke-linecap="round"/>'
            : '<circle cx="12" cy="12" r="10"/><path d="M10 8.5l5.5 3.5-5.5 3.5z" fill="currentColor" stroke="none"/>';
        // 上下首仅当有音频源时启用，否则视觉淡化
        const navOpacity = hasAudio ? '' : 'style="opacity:0.35;pointer-events:none"';
        const playOnclick = hasAudio
            ? `onclick="event.stopPropagation();Widgets.toggleMusicPlay('${w.id}')"`
            : '';
        const playCursor = hasAudio ? 'cursor:pointer' : 'cursor:default';

        const controls = `<div class="vinyl-controls-group">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" ${navOpacity}><path d="M6 6h2v12H6zM9.5 12l8.5 6V6z"/></svg>
            <svg class="vinyl-play" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" style="${playCursor}" ${playOnclick}>${playPauseInner}</svg>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" ${navOpacity}><path d="M16 6h2v12h-2zM6 6l8.5 6L6 18z"/></svg>
        </div>`;

        // 进度条 width 由 _updateMusicProgress 动态写入；初始 0%（无音频）或当前百分比
        let progressPct = 0;
        if (audio && audio.duration > 0) {
            progressPct = Math.min(100, (audio.currentTime / audio.duration) * 100);
        }
        const progress = `<div class="vinyl-progress"><span class="vinyl-progress-fill" style="width:${progressPct}%"></span></div>`;

        if (w.shape === 'circle') {
            // 圆盘档：黑胶为主角居上，下弧 prev/play/next 三控件；不放标题/进度条（圆形组件内容中心收拢）
            return `<div class="widget-card ${sizeClass} widget-vinyl vinyl-circle${playClass}"
                         data-widget-id="${w.id}"
                         onclick="Widgets.editMusic('${w.id}')">
                <div class="vinyl-disc-wrap vinyl-circle-disc-wrap">
                    ${disc}
                    <svg class="vinyl-tonearm" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M21 3L13 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="21" cy="3" r="2.3" fill="currentColor"/>
                    </svg>
                </div>
                ${controls}
            </div>`;
        }

        if (w.size === 'wide') {
            // 横条：左小黑胶 + 中文字 + 右按钮
            return `<div class="widget-card ${sizeClass} widget-vinyl vinyl-wide${playClass}"
                         data-widget-id="${w.id}"
                         onclick="Widgets.editMusic('${w.id}')">
                ${this._bowSvg('vinyl-bow-corner')}
                <div class="vinyl-disc-wrap">${disc}</div>
                <div class="vinyl-info-wide">
                    <div class="vinyl-title">${this._esc(d.title || 'Dreamy Afternoon')}</div>
                    <div class="vinyl-artist">${this._esc(d.artist || 'Soft Indie')}</div>
                    ${controls}
                </div>
                ${this._heartSvg('vinyl-heart')}
            </div>`;
        }

        // small / medium：方形，顶部蝴蝶结，中央黑胶，底部进度条+控件
        return `<div class="widget-card ${sizeClass} widget-vinyl vinyl-square${playClass}"
                     data-widget-id="${w.id}"
                     onclick="Widgets.editMusic('${w.id}')">
            ${this._bowSvg('vinyl-bow-top')}
            <div class="vinyl-disc-wrap">${disc}</div>
            ${progress}
            ${controls}
            ${this._sparkSvg('vinyl-spark spark-a')}
            ${this._sparkSvg('vinyl-spark spark-b')}
        </div>`;
    },

    // ── Music widget 真实播放：B 方案 ──
    async toggleMusicPlay(id) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) return;
        const d = w.data || {};
        if (!d.audioSongId && !d.audioUrl) {
            Utils.showToast(I18n.t('t.wg_no_audio', '请先选择内置歌曲或填写音频 URL'));
            return this.editMusic(id);
        }

        this._musicAudios = this._musicAudios || {};
        let audio = this._musicAudios[id];
        // dataKey 优先取连播 runtime 态（_musicNowPlaying），否则退回配置曲目；
        // 不然 B6 连播切歌后 __perigeeKey 已变成 song:<下一首> 而这里恒按配置曲算，
        // 必然判定「换源」→ 暂停键被当成换源误销毁重建、从头重播配置曲（v2.193 修）
        const nowPlayingId = this._musicNowPlaying[id];
        const dataKey = nowPlayingId ? `song:${nowPlayingId}` : (d.audioSongId ? `song:${d.audioSongId}` : `url:${d.audioUrl}`);

        // 如果换了音频源，销毁旧 audio
        if (audio && audio.__perigeeKey !== dataKey) {
            try { audio.pause(); } catch (e) {}
            if (audio.src && audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src);
            delete this._musicAudios[id];
            audio = null;
        }

        if (!audio) {
            audio = new Audio();
            audio.__perigeeKey = dataKey;
            if (window.AudioCoordinator) AudioCoordinator.register(audio);
            audio.addEventListener('play', () => this._updateMusicPlayState(id, true));
            audio.addEventListener('pause', () => this._updateMusicPlayState(id, false));
            audio.addEventListener('ended', () => { this._updateMusicPlayState(id, false); this._onMusicEnded(id); });
            audio.addEventListener('timeupdate', () => this._updateMusicProgress(id, audio));
            this._musicAudios[id] = audio;
        }

        if (!audio.paused) {
            audio.pause();
            return;
        }

        // 准备 src（仅在第一次或源变更时设置）
        if (!audio.src) {
            try {
                if (d.audioSongId) {
                    if (typeof TTSEngine === 'undefined' || !TTSEngine.getAudio) {
                        throw new Error('TTSEngine 未就绪');
                    }
                    const blob = await TTSEngine.getAudio(`music:${d.audioSongId}`);
                    if (!blob) throw new Error('内置音频未找到');
                    audio.src = URL.createObjectURL(blob);
                } else {
                    audio.src = d.audioUrl;
                }
            } catch (e) {
                Utils.showToast(I18n.t('t.wg_play_prep_failed', '播放准备失败：') + e.message);
                return;
            }
        }

        try {
            await audio.play();
        } catch (e) {
            Utils.showToast(I18n.t('t.wg_play_failed', '播放失败：') + e.message);
        }
    },

    _updateMusicPlayState(id, isPlaying) {
        const widget = document.querySelector(`.widget-vinyl[data-widget-id="${id}"]`);
        if (!widget) return;
        widget.classList.toggle('is-playing', isPlaying);
        const playSvg = widget.querySelector('.vinyl-play');
        if (playSvg) {
            playSvg.innerHTML = isPlaying
                ? '<circle cx="12" cy="12" r="10"/><path d="M10 9v6M14 9v6" stroke-linecap="round"/>'
                : '<circle cx="12" cy="12" r="10"/><path d="M10 8.5l5.5 3.5-5.5 3.5z" fill="currentColor" stroke="none"/>';
        }
        if (!isPlaying) {
            // 暂停 / 结束时进度条留在当前位置（不重置）；仅 ended 时回到 0
            const audio = this._musicAudios?.[id];
            if (audio && audio.ended) this._updateMusicProgress(id, audio, true);
        }
    },

    _updateMusicProgress(id, audio, force) {
        const widget = document.querySelector(`.widget-vinyl[data-widget-id="${id}"]`);
        if (!widget) return;
        const fill = widget.querySelector('.vinyl-progress-fill');
        if (!fill) return;
        let pct = 0;
        if (audio.duration > 0 && !audio.ended) {
            pct = Math.min(100, (audio.currentTime / audio.duration) * 100);
        }
        fill.style.width = pct + '%';
    },

    _musicNowPlaying: {},   // widgetId → 当前实际在播的 songId（连播 runtime 态，不落盘、不偷改 w.data.audioSongId）

    // B6 连播：ended 后按模式取下一首。blob 丢失跳过继续找（上限=池子大小次）；
    // 外链 audioUrl / 纯装饰模式不连播；卡面只换歌名（.vinyl-title 仅 wide 布局有，square 无歌名不用动）。
    async _onMusicEnded(id) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) return;
        const d = w.data || {};
        if (!d.audioSongId) return;
        const audio = this._musicAudios && this._musicAudios[id];
        if (!audio) return;
        const mode = d.playMode || 'seq';
        if (mode === 'single') {
            audio.currentTime = 0;
            audio.play().catch(() => {});
            return;
        }
        const songs = (AppState.data.music || {}).songs || [];
        let currentId = this._musicNowPlaying[id] || d.audioSongId;
        const poolSize = songs.filter(s => s && s.stage === 'done' && s.audioId).length;
        let tries = 0;
        while (tries < Math.max(1, poolSize)) {
            const nextId = this._pickNextSong(songs, currentId, mode);
            if (!nextId) return;
            const blob = await TTSEngine.getAudio(`music:${nextId}`).catch(() => null);
            // await 期间可能被 deleteWidget/_saveMusic 脱管（pause+revoke+delete），
            // 复核归属再动 audio，否则会给已脱管的元素重新设 ObjectURL 并 play（僵尸播放，v2.193 修）
            if (!this._musicAudios || this._musicAudios[id] !== audio) return;
            if (blob) {
                if (audio.src && audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src);
                audio.src = URL.createObjectURL(blob);
                audio.__perigeeKey = `song:${nextId}`;
                this._musicNowPlaying[id] = nextId;
                const song = songs.find(s => s.id === nextId);
                const titleEl = document.querySelector(`.widget-vinyl[data-widget-id="${id}"] .vinyl-title`);
                if (titleEl && song) titleEl.textContent = song.title || '';
                audio.play().catch(() => {});
                return;
            }
            currentId = nextId;   // blob 丢失 → 从它继续往后找
            tries++;
        }
    },

    editMusic(id) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) return;
        const d = w.data || {};

        // 列出内置歌曲（仅 stage='done' 且有 audioId 的）
        const songs = (AppState.data.music?.songs || []).filter(s => s.stage === 'done' && s.audioId);
        const songOptions = songs.map(s => {
            const label = (s.title || '未命名').slice(0, 30);
            const sub = s.songType ? ` · ${s.songType}` : '';
            return `<option value="${this._escAttr(s.id)}" ${s.id === d.audioSongId ? 'selected' : ''}>${this._esc(label + sub)}</option>`;
        }).join('');

        // 尺寸切换按钮文案：small → wide → circle → small 三档循环，显示「当前 → 下一档」
        const musicSizeNames = {
            small: I18n.t('widgets.mu_size_small', '小さい四角'),
            wide: I18n.t('widgets.mu_size_wide', '横長バー'),
            circle: I18n.t('widgets.mu_size_circle', 'レコード盤')
        };
        const musicCurSizeKey = w.shape === 'circle' ? 'circle' : (w.size === 'wide' ? 'wide' : 'small');
        const musicNextSizeKey = musicCurSizeKey === 'small' ? 'wide' : (musicCurSizeKey === 'wide' ? 'circle' : 'small');
        const musicSizeSwitchLabel = I18n.t('widgets.mu_size_switch_prefix', 'サイズ切替（現在：')
            + musicSizeNames[musicCurSizeKey] + ' → ' + musicSizeNames[musicNextSizeKey] + '）';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
        modal.onclick = e => { if (e.target === modal) modal.remove(); };
        modal.innerHTML = `
            <div class="modal-window" style="gap:12px">
                <h3 style="margin:0;font-size:17px;font-weight:600;display:flex;align-items:center;gap:6px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>正在播放</h3>
                <input id="musicTitle" placeholder="曲名" value="${this._escAttr(d.title || '')}"
                       style="width:100%;padding:10px 12px;border:1px solid var(--border-medium);border-radius:8px;font-size:14px;background:var(--bg-base);color:var(--text-primary)">
                <input id="musicArtist" placeholder="アーティスト" value="${this._escAttr(d.artist || '')}"
                       style="width:100%;padding:10px 12px;border:1px solid var(--border-medium);border-radius:8px;font-size:14px;background:var(--bg-base);color:var(--text-primary)">
                <input id="musicCover" placeholder="封面图URL" value="${this._escAttr(d.coverUrl || '')}"
                       style="width:100%;padding:10px 12px;border:1px solid var(--border-medium);border-radius:8px;font-size:14px;background:var(--bg-base);color:var(--text-primary)">
                <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-size:13px;color:var(--text-secondary);white-space:nowrap">唱片颜色</span>
                    <div id="musicColorPicker" style="display:flex;gap:6px;flex-wrap:wrap">
                        ${['var(--accent-color)', '#1a1a2e', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#e91e63', '#00bcd4'].map(c =>
                            `<span onclick="this.parentElement.querySelectorAll('span').forEach(s=>s.style.outline='');this.style.outline='2px solid var(--text-primary)';this.dataset.selected='1'"
                                   data-color="${c}" ${c === (d.color || 'var(--accent-color)') ? 'data-selected="1" style="width:24px;height:24px;border-radius:50%;background:' + c + ';cursor:pointer;outline:2px solid var(--text-primary)"' : `style="width:24px;height:24px;border-radius:50%;background:${c};cursor:pointer"`}></span>`
                        ).join('')}
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--border-light);padding-top:10px;margin-top:2px">
                    <span style="font-size:12px;color:var(--text-secondary);font-weight:600">音频源（选一个，或都不选保持装饰）</span>
                    <select id="musicBuiltinSong"
                            style="width:100%;padding:10px 12px;border:1px solid var(--border-medium);border-radius:8px;font-size:14px;background:var(--bg-base);color:var(--text-primary)">
                        <option value="">—— 不绑定（仅装饰）</option>
                        ${songOptions || '<option value="" disabled>（内置歌单为空，先去 Music Lab 生成）</option>'}
                    </select>
                    <input id="musicAudioUrl" placeholder="或填外链音频 URL（选了内置则忽略）" value="${this._escAttr(d.audioUrl || '')}"
                           style="width:100%;padding:10px 12px;border:1px solid var(--border-medium);border-radius:8px;font-size:14px;background:var(--bg-base);color:var(--text-primary)">
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-size:13px;color:var(--text-secondary);white-space:nowrap">${I18n.t('widgets.mu_playmode', '再生モード')}</span>
                    <select id="musicPlayMode" style="flex:1;padding:8px;border:1px solid var(--border-medium);border-radius:8px;font-size:13px;background:var(--bg-base);color:var(--text-primary)">
                        <option value="seq" ${(d.playMode || 'seq') === 'seq' ? 'selected' : ''}>${I18n.t('widgets.mu_mode_seq', '順番に再生')}</option>
                        <option value="single" ${d.playMode === 'single' ? 'selected' : ''}>${I18n.t('widgets.mu_mode_single', '単曲リピート')}</option>
                        <option value="shuffle" ${d.playMode === 'shuffle' ? 'selected' : ''}>${I18n.t('widgets.mu_mode_shuffle', 'シャッフル')}</option>
                    </select>
                </div>
                <div style="display:flex;gap:8px">
                    <button onclick="this.closest('.modal-overlay').remove()"
                            style="flex:1;padding:10px;border:1px solid var(--border-medium);border-radius:8px;background:none;color:var(--text-primary);font-size:14px;cursor:pointer">取消</button>
                    <button onclick="Widgets._saveMusic('${id}', this.closest('.modal-overlay'))"
                            style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--accent-color);color:#fff;font-size:14px;font-weight:600;cursor:pointer">保存</button>
                </div>
                <div style="display:flex;gap:8px">
                    <button onclick="Widgets._toggleMusicSize('${id}', this.closest('.modal-overlay'))"
                            style="flex:1;padding:8px;border:1px solid var(--border-light);border-radius:8px;background:none;color:var(--text-secondary);font-size:12px;cursor:pointer">
                        ${this._esc(musicSizeSwitchLabel)}
                    </button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    },

    _toggleMusicSize(id, modal) {
        const w = this._getWidgets().find(x => x.id === id);
        if (w) {
            // 三档循环：小方形 → 宽横条 → 圆盘 → 小方形
            // 圆盘＝shape:'circle'+size:'small'（中尺寸的 2:1 矩形放不下圆形黑胶，不入环）
            if (w.shape === 'circle') {
                delete w.shape;
                w.size = 'small';
            } else if (w.size === 'wide') {
                w.size = 'small';
                w.shape = 'circle';
            } else {
                w.size = 'wide';
            }
            this._save();
            if (typeof DesktopRenderer !== 'undefined') {
                // w.size 此时恒为 'small' 或 'wide'（circle 档下沿也是 'small'），不会把 'circle' 传给尺寸→colSpan 映射
                this._syncLayoutSpan(w.id, w.size);
            }
            this.render();
        }
        if (modal) modal.remove();
    },

    _saveMusic(id, modal) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) return;
        const selectedColor = modal.querySelector('#musicColorPicker [data-selected="1"]');
        const audioSongId = modal.querySelector('#musicBuiltinSong').value;
        const audioUrl = modal.querySelector('#musicAudioUrl').value.trim();

        let title = modal.querySelector('#musicTitle').value.trim();
        let artist = modal.querySelector('#musicArtist').value.trim();
        // 选了内置歌曲且 title/artist 留空则从 song 自动填
        if (audioSongId) {
            const song = (AppState.data.music?.songs || []).find(s => s.id === audioSongId);
            if (song) {
                if (!title) title = song.title || '内置楽曲';
                if (!artist) artist = song.songType || 'Perigee OS';
            }
        }

        w.data = {
            title,
            artist,
            coverUrl: modal.querySelector('#musicCover').value.trim(),
            color: selectedColor ? selectedColor.dataset.color : 'var(--accent-color)',
            audioSongId,
            audioUrl: audioSongId ? '' : audioUrl,  // 选了内置就清空 URL
            playMode: modal.querySelector('#musicPlayMode').value
        };

        // 音频源变了：销毁旧 audio 实例，下次 play 会重建
        if (this._musicAudios?.[id]) {
            const oldAudio = this._musicAudios[id];
            try { oldAudio.pause(); } catch (e) {}
            if (oldAudio.src && oldAudio.src.startsWith('blob:')) URL.revokeObjectURL(oldAudio.src);
            delete this._musicAudios[id];
            delete this._musicNowPlaying[id];
        }

        this._save();
        this.render();
        modal.remove();
    },

    // ══════════════════════════════════════
    //  📢 情報速報組件
    // ══════════════════════════════════════
    _renderNews(w, sizeClass) {
        const events = Utils.getRecentEvents ? Utils.getRecentEvents({ limit: 3 }) : [];
        const threads = (AppState.data.forumData || {}).threads || [];
        const items = this._composeNewsItems(events, threads);
        const d = w.data || {};
        const newestTs = events.length ? (events[0].timestamp || 0) : 0;
        const hasNew = newestTs > (d.lastSeenTs || 0);   // 根治 v2.191 前 _lastCount 恒亮 bug
        const labelFor = type => I18n.t('widgets.ev_' + type, (Utils.EVENT_TYPE_LABELS || {})[type] || type);

        const listHtml = items.length > 0
            ? items.map(it => it.kind === 'event'
                ? `<div class="widget-news-item" onclick="event.stopPropagation();Widgets._openNewsSource('${w.id}','${it.source}')">
                        <span class="widget-news-dot ${hasNew ? 'is-new' : ''}"></span>
                        <span class="widget-news-tag">${labelFor(it.type)}</span>
                        <span class="widget-news-title">${this._esc(this._truncate(it.title, 14))}</span>
                    </div>`
                : `<div class="widget-news-item" onclick="event.stopPropagation();Widgets._openNewsSource('${w.id}','forum')">
                        <span class="widget-news-dot"></span>
                        <span class="widget-news-title">${this._esc(this._truncate(it.title, 20))}</span>
                        <span class="widget-news-count">${it.replies}</span>
                    </div>`).join('')
            : `<div class="widget-news-empty">${I18n.t('widgets.news_empty', 'まだ情報がありません')}</div>`;

        return `<div class="widget-card widget-wide widget-news"
                     onclick="Widgets._openNewsSource('${w.id}','forum')"
>
            <div class="widget-news-header">
                <span style="display:inline-flex"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M4 10v4h3l6 4V6l-6 4H4z"/><path d="M17 9a4 4 0 010 6"/></svg></span>
                <span class="widget-news-label">${I18n.t('widgets.news_label', '情報速報')}</span>
                ${hasNew ? '<span class="widget-news-badge">NEW</span>' : ''}
            </div>
            <div class="widget-news-list">${listHtml}</div>
        </div>`;
    },

    // 事件 source → 直达 screenId（app.js goTo 的 if 链里都有对应分支）
    _NEWS_SOURCE_SCREEN: { forum: 'forum', twitter: 'twitter', pixiv: 'pixiv-novel', magazine: 'magazine', melonbooks: 'melonbooks', niconico: 'niconico', mercari: 'mercari' },

    _openNewsSource(widgetId, source) {
        const w = this._getWidgets().find(x => x.id === widgetId);
        if (w) {
            const latest = Utils.getRecentEvents ? Utils.getRecentEvents({ limit: 1 }) : [];
            w.data = w.data || {};
            w.data.lastSeenTs = latest.length ? (latest[0].timestamp || 0) : (w.data.lastSeenTs || 0);
            this._save();
        }
        Navigation.goTo(this._NEWS_SOURCE_SCREEN[source] || 'forum');
    },

    // ══════════════════════════════════════
    //  角色立绘卡（v2.191 B1）：消费放送局立绘注册表
    //  立绘 blob 存 IllustGallery，异步水合 ObjectURL；
    //  _charCardUrls 缓存，重渲染前/删除时 revoke（照 broadcast._charRefCardUrls 防泄漏模式）
    // ══════════════════════════════════════
    _charCardUrls: {},   // widgetId → [ObjectURL]

    _ccSilhouetteSvg() {
        return `<svg viewBox="0 0 24 24" fill="currentColor" opacity="0.35" style="width:22px;height:22px"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg>`;
    },

    _renderCharCard(w, sizeClass) {
        const d = w.data || {};
        const esc = s => Utils.escapeHtml(s || '');
        const placeholder = `<div class="cc-placeholder">${this._ccSilhouetteSvg()}<span>${I18n.t('widgets.cc_no_ref', '立絵未登録')}</span></div>`;
        this._queueCharCardHydration(w.id);
        if (d.mode === 'duo' && d.refB) {
            return `<div class="widget-card ${sizeClass} widget-charcard cc-duo" data-cc-widget="${w.id}"
                         onclick="Widgets.editCharCard('${w.id}')">
                <div class="cc-fig-wrap cc-fig-a" data-cc-slot="a">${placeholder}</div>
                <div class="cc-duo-name">${esc(d.refA && d.refA.name)} <span class="cc-x">×</span> ${esc(d.refB && d.refB.name)}</div>
                <div class="cc-fig-wrap cc-fig-b" data-cc-slot="b">${placeholder}</div>
            </div>`;
        }
        return `<div class="widget-card ${sizeClass} widget-charcard" data-cc-widget="${w.id}"
                     onclick="Widgets.editCharCard('${w.id}')">
            <div class="cc-fig-wrap cc-fig-a" data-cc-slot="a">${placeholder}</div>
            <div class="cc-info">
                <div class="cc-name">${esc(d.refA && d.refA.name)}</div>
                <div class="cc-rule"></div>
                ${d.line ? `<div class="cc-line">${esc(d.line)}</div>` : ''}
            </div>
        </div>`;
    },

    // 渲染返回 HTML 字符串、挂载由 DesktopRenderer 完成 → 水合排到挂载后（setTimeout 0）。
    // 重渲染会再次排水合，旧 URL 在 _hydrateCharCard 开头统一 revoke，最终状态一致。
    _queueCharCardHydration(id) {
        setTimeout(() => this._hydrateCharCard(id), 0);
    },

    async _hydrateCharCard(id) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w || w.type !== 'charcard') return;
        (this._charCardUrls[id] || []).forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} });
        this._charCardUrls[id] = [];
        const d = w.data || {};
        const slots = [['a', d.refA], ['b', d.mode === 'duo' ? d.refB : null]];
        for (const [slot, ref] of slots) {
            if (!ref || !ref.blobId) continue;
            const blob = await IllustGallery.getBlob(ref.blobId).catch(() => null);
            if (!blob) continue;   // blob 丢失（跨设备导入）→ 占位「立絵未登録」保留
            const el = document.querySelector(`[data-cc-widget="${id}"] [data-cc-slot="${slot}"]`);
            if (!el) continue;     // widget 已删/桌面已翻页重渲染 → 不建 URL 不泄漏
            const url = URL.createObjectURL(blob);
            this._charCardUrls[id].push(url);
            // T2：pos 可选（{x,y,s}|undefined）——老数据/纯 cover 恒等变换时 transformStyle 只回退到基底 cover 样式，
            // 零迁移零视觉变化。
            // review 修复（D1）：cc-fig-b 的 CSS 镜像（.cc-fig-b img{transform:scaleX(-1)}）会被内联
            // transform 整体覆盖。B 槽有自定义定位时，把 scaleX(-1) 前置进内联变换——语义＝
            // 「先按用户在定位器里的取景裁好、再把成品整体镜像」，取景内容不变、面对面构图保留。
            // 恒等/无 pos 时 transformStyle 不输出 transform，CSS 类规则照常生效，两条路径镜像一致。
            let posStyle = ImagePositioner.transformStyle(ref.pos);
            const isMirroredSlot = slot === 'b' && d.mode === 'duo';
            if (isMirroredSlot && posStyle.includes('transform:')) {
                posStyle = posStyle.replace('transform:', 'transform:scaleX(-1) ');
            }
            el.innerHTML = `<img src="${url}" alt="" style="${posStyle}">`;
        }
    },

    // 配置弹窗：点卡片本体打开（对齐 editPhoto 交互）。模式/角色A/角色B/台词/相册上传/立绘定位（T2）。
    editCharCard(id) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) return;
        const refs = (typeof Broadcast !== 'undefined' && Broadcast.getAllCharRefs) ? Broadcast.getAllCharRefs() : [];
        const d = w.data || {};
        const esc = s => this._escAttr(s || '');
        const isDuo = d.mode === 'duo';
        const rowStyle = 'width:100%;padding:10px 12px;border:1px solid var(--border-medium);border-radius:8px;font-size:14px;background:var(--bg-base);color:var(--text-primary)';
        // 双人模式首次开启时，B 槽沿用旧行为自动建议第二个注册表角色（未存则不影响单人流程）
        const refBInit = d.refB || (refs[1] ? { blobId: refs[1].blobId, name: refs[1].name } : null);
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
        modal.onclick = e => { if (e.target === modal) modal.remove(); };
        modal.innerHTML = `
            <div class="modal-window" style="gap:12px;max-height:85vh;overflow-y:auto">
                <h3 style="margin:0;font-size:17px;font-weight:600">${I18n.t('widgets.cc_edit_title', '编辑立绘卡')}</h3>
                <select id="ccMode" style="${rowStyle}"
                        onchange="document.getElementById('ccRefBRow').style.display=this.value==='duo'?'block':'none';document.getElementById('ccLineRow').style.display=this.value==='duo'?'none':'block'">
                    <option value="single" ${isDuo ? '' : 'selected'}>${I18n.t('widgets.cc_mode_single', '单人')}</option>
                    <option value="duo" ${isDuo ? 'selected' : ''}>${I18n.t('widgets.cc_mode_duo', '双人')}</option>
                </select>
                ${this._ccSlotHtml(w.id, 'a', d.refA, refs, rowStyle)}
                <div id="ccRefBRow" style="display:${isDuo ? 'block' : 'none'}">
                    ${this._ccSlotHtml(w.id, 'b', refBInit, refs, rowStyle)}
                </div>
                <div id="ccLineRow" style="display:${isDuo ? 'none' : 'block'}">
                    <input type="text" id="ccLine" maxlength="30" placeholder="${I18n.t('widgets.cc_line_ph', '一句台词（可空）')}"
                           value="${esc(d.line)}" style="${rowStyle}">
                </div>
                <div style="display:flex;gap:8px;margin-top:4px">
                    <button onclick="Widgets._ccCancelCharCard('${w.id}', this.closest('.modal-overlay'))"
                            style="flex:1;padding:10px;border:1px solid var(--border-medium);border-radius:8px;background:none;color:var(--text-primary);font-size:14px;cursor:pointer">${I18n.t('btn.cancel', '取消')}</button>
                    <button onclick="Widgets._saveCharCard('${w.id}', this.closest('.modal-overlay'))"
                            style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--accent-color);color:#fff;font-size:14px;font-weight:600;cursor:pointer">${I18n.t('btn.confirm', '确定')}</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    },

    // T2：立绘卡单槽位（A/B 共用）的下拉+上传+名字+定位按钮 HTML。
    // 容器 #ccSlot(A|B) 的 data-blobid / data-pos 是该槽位在弹窗打开期间的唯一真相源；
    // _ccOnRefSelect / _handleCharCardUpload / _openCharCardPositioner 只读写这两个 dataset，
    // _saveCharCard 收尾时统一读出落盘——避免下拉 value 域和「刚上传还没进注册表」的图片来源打架。
    _ccSlotHtml(widgetId, slot, ref, refs, rowStyle) {
        const cap = slot.toUpperCase();
        const blobId = (ref && ref.blobId) || '';
        const optionsHtml = refs.map(r =>
            `<option value="${this._escAttr(r.blobId)}" ${r.blobId === blobId ? 'selected' : ''}>${Utils.escapeHtml(r.name || '?')}</option>`).join('');
        const placeholderTxt = I18n.t('widgets.cc_ref_upload_placeholder', 'アップロード画像 / 未選択');
        const uploadTitle = I18n.t('widgets.cc_upload_btn', 'アルバムからアップロード');
        const namePh = I18n.t('widgets.cc_name_ph', 'キャラ名');
        const posLabel = I18n.t('widgets.imgpos_open_btn', '位置を調整');
        const posAttr = (ref && ref.pos) ? ` data-pos="${this._escAttr(JSON.stringify(ref.pos))}"` : '';
        return `
            <div id="ccSlot${cap}" data-blobid="${this._escAttr(blobId)}"${posAttr} style="display:flex;flex-direction:column;gap:6px">
                <div style="display:flex;gap:6px">
                    <select id="ccRef${cap}" style="flex:1;min-width:0;${rowStyle}" onchange="Widgets._ccOnRefSelect(this.closest('.modal-overlay'),'${slot}')">
                        <option value="">${Utils.escapeHtml(placeholderTxt)}</option>
                        ${optionsHtml}
                    </select>
                    <label class="widget-upload-btn" title="${this._escAttr(uploadTitle)}"
                           style="flex:none;display:flex;align-items:center;justify-content:center;width:40px;padding:0;cursor:pointer">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px" aria-hidden="true"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>
                        <input type="file" accept="image/*" style="display:none"
                               onchange="Widgets._handleCharCardUpload('${widgetId}','${slot}',this.files[0],this.closest('.modal-overlay'));this.value=''">
                    </label>
                </div>
                <input type="text" id="ccName${cap}" maxlength="20" placeholder="${this._escAttr(namePh)}"
                       value="${this._escAttr(ref && ref.name)}" style="${rowStyle}">
                <button type="button" id="ccPosBtn${cap}" onclick="Widgets._openCharCardPositioner('${widgetId}','${slot}',this.closest('.modal-overlay'))"
                        style="display:${blobId ? 'flex' : 'none'};align-items:center;justify-content:center;gap:6px;padding:8px;border:1px solid var(--border-light);border-radius:8px;background:none;color:var(--text-secondary);font-size:12px;cursor:pointer">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
                    ${Utils.escapeHtml(posLabel)}
                </button>
            </div>`;
    },

    // 下拉选中放送局注册表立绘 → 写入槽位 dataset + 自动填名字（仍可改）；
    // 选占位项（未选择/沿用已上传图）value 为空，不改动当前 dataset。
    _ccOnRefSelect(modal, slot) {
        if (!modal) return;
        const cap = slot.toUpperCase();
        const sel = modal.querySelector(`#ccRef${cap}`);
        const slotEl = modal.querySelector(`#ccSlot${cap}`);
        const nameInput = modal.querySelector(`#ccName${cap}`);
        if (!sel || !slotEl || !sel.value) return;
        slotEl.dataset.blobid = sel.value;
        slotEl.removeAttribute('data-pos'); // 换了来源图，旧定位参数不再适用
        const refs = (typeof Broadcast !== 'undefined' && Broadcast.getAllCharRefs) ? Broadcast.getAllCharRefs() : [];
        const picked = refs.find(r => r.blobId === sel.value);
        if (nameInput && picked) nameInput.value = picked.name || '';
        this._ccRefreshPosBtn(modal, slot);
    },

    // File → Utils.readImageFile 压缩成 dataURL → Blob → IllustGallery。
    // blobId 与 widget+槽位一一对应（cc_up_<widgetId>_<slot>），重传即覆盖，不留孤儿 blob。
    async _handleCharCardUpload(id, slot, file, modal) {
        if (!file || !file.type || file.type.indexOf('image/') !== 0 || !modal) return;
        if (typeof IllustGallery === 'undefined') return;
        let dataUrl;
        try {
            dataUrl = await Utils.readImageFile(file);
        } catch (e) {
            Utils.showToast(I18n.t('widgets.cc_upload_fail', '画像の読み込みに失敗しました'));
            return;
        }
        if (!dataUrl) return;
        let blob;
        try {
            blob = await fetch(dataUrl).then(r => r.blob());
        } catch (e) {
            Utils.showToast(I18n.t('widgets.cc_upload_fail', '画像の読み込みに失敗しました'));
            return;
        }
        const blobId = `cc_up_${id}_${slot}`;
        await IllustGallery.save(blobId, blob);
        const cap = slot.toUpperCase();
        const slotEl = modal.querySelector(`#ccSlot${cap}`);
        if (!slotEl) return;   // 弹窗已在等待期间关闭
        slotEl.dataset.blobid = blobId;
        slotEl.removeAttribute('data-pos'); // 换图后旧定位参数不再适用
        const sel = modal.querySelector(`#ccRef${cap}`);
        if (sel) sel.value = ''; // 上传图不在注册表选项里，下拉回落占位项
        this._ccRefreshPosBtn(modal, slot);
        Utils.showToast(I18n.t('widgets.cc_upload_done', '画像をアップロードしました'));
    },

    _ccRefreshPosBtn(modal, slot) {
        const cap = slot.toUpperCase();
        const slotEl = modal.querySelector(`#ccSlot${cap}`);
        const btn = modal.querySelector(`#ccPosBtn${cap}`);
        if (!slotEl || !btn) return;
        btn.style.display = slotEl.dataset.blobid ? 'flex' : 'none';
    },

    // T2：立绘定位（接 T1 ImagePositioner）。临时 blob URL 按 scope 登记（Utils.trackBlobUrl），
    // 同槽位再次打开定位器/整个编辑弹窗关闭（取消或确定）时统一 revoke（Utils.revokeBlobScope）。
    async _openCharCardPositioner(id, slot, modal) {
        if (!modal || typeof ImagePositioner === 'undefined' || typeof IllustGallery === 'undefined') return;
        // review 修复（C3）：无锁时双击/双触会并发两次，第二次开头的 revokeBlobScope 会收掉
        // 第一个还开着的定位器正在显示的 URL（同 scope 竞态）→ withLock 串行化，忙时静默忽略。
        return Utils.withLock(`cc-imgpos-open-${id}-${slot}`, async () => {
        const cap = slot.toUpperCase();
        const slotEl = modal.querySelector(`#ccSlot${cap}`);
        const blobId = slotEl && slotEl.dataset.blobid;
        if (!blobId) return;
        const blob = await IllustGallery.getBlob(blobId).catch(() => null);
        if (!blob) { Utils.showToast(I18n.t('widgets.cc_pos_missing', '画像が見つかりません')); return; }
        const scope = `cc-imgpos-${id}-${slot}`;
        Utils.revokeBlobScope(scope); // 同槽位再次打开：先收前一次的临时 URL，避免累积
        const url = Utils.trackBlobUrl(URL.createObjectURL(blob), scope);
        let pos = null;
        if (slotEl.dataset.pos) { try { pos = JSON.parse(slotEl.dataset.pos); } catch (e) { pos = null; } }
        // review 修复（A1 同源）：立绘框是竖长条不是正方形，预览比例量现场 DOM，量不到退 1
        let aspect = 1;
        const fig = document.querySelector(`[data-cc-widget="${id}"] [data-cc-slot="${slot}"]`);
        const fr = fig && fig.getBoundingClientRect();
        if (fr && fr.width > 4 && fr.height > 4) aspect = fr.width / fr.height;
        ImagePositioner.open({
            src: url,
            shape: 'rect',
            aspect,
            pos,
            onApply: p => {
                if (p) slotEl.dataset.pos = JSON.stringify(p);
                else slotEl.removeAttribute('data-pos');
            }
        });
        });   // withLock（C3）
    },

    _saveCharCard(id, modal) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) { modal.remove(); return; }
        const mode = modal.querySelector('#ccMode').value;
        const buildRef = slot => {
            const cap = slot.toUpperCase();
            const slotEl = modal.querySelector(`#ccSlot${cap}`);
            const blobId = slotEl && slotEl.dataset.blobid;
            if (!blobId) return null;
            const nameInput = modal.querySelector(`#ccName${cap}`);
            const name = ((nameInput && nameInput.value) || '').trim().slice(0, 20);
            let pos = null;
            if (slotEl.dataset.pos) { try { pos = JSON.parse(slotEl.dataset.pos); } catch (e) { pos = null; } }
            const ref = { blobId, name };
            if (pos) ref.pos = pos;
            return ref;
        };
        const refA = buildRef('a');
        const refB = mode === 'duo' ? buildRef('b') : null;
        const line = (modal.querySelector('#ccLine').value || '').trim().slice(0, 30);
        w.data = { mode: (mode === 'duo' && refB) ? 'duo' : 'single', refA, refB, line };
        Utils.revokeBlobScope(`cc-imgpos-${id}-a`);
        Utils.revokeBlobScope(`cc-imgpos-${id}-b`);
        this._save();
        this._ccCleanupOrphanUploads(id);
        this.render();
        modal.remove();
    },

    // review 修复（C2/D2）：charcard「アルバムからアップロード」在选图瞬间就 IllustGallery.save
    // 落库（确定性键 cc_up_<widgetId>_<slot>）。编辑会话结束（保存/取消）或组件删除时，把最终
    // data 没引用的 cc_up_ 键就地回收，堵住取消后上传图、换回立绘后旧上传图、删组件后全部
    // 上传图三条孤儿路径。remove 对不存在的键是安全 no-op。
    _ccCleanupOrphanUploads(id) {
        if (typeof IllustGallery === 'undefined' || !IllustGallery.remove) return;
        const w = this._getWidgets().find(x => x.id === id);
        const kept = new Set();
        if (w && w.data) {
            if (w.data.refA && w.data.refA.blobId) kept.add(w.data.refA.blobId);
            if (w.data.refB && w.data.refB.blobId) kept.add(w.data.refB.blobId);
        }
        ['a', 'b'].forEach(slot => {
            const key = `cc_up_${id}_${slot}`;
            if (!kept.has(key)) IllustGallery.remove(key).catch(() => {});
        });
    },

    // review 修复（C2 配套）：取消也走统一出口——收定位器临时 URL + 清本次会话遗留的孤儿上传
    _ccCancelCharCard(id, modal) {
        Utils.revokeBlobScope(`cc-imgpos-${id}-a`);
        Utils.revokeBlobScope(`cc-imgpos-${id}-b`);
        this._ccCleanupOrphanUploads(id);
        if (modal) modal.remove();
    },

    // ══════════════════════════════════════════════════════════
    //  v2.212 新组件企划 stub 区（docs/2026-07-16-新小组件企划-任务拆解.md）
    //  每个 stub 由对应 task 的 agent 整体替换，禁止跨区修改
    // ══════════════════════════════════════════════════════════

    // ── T4 文本框（无底/便签底·横竖排·高度自适应）── agent T4 实装 ──
    _renderNote(w, sizeClass) {
        const d = w.data || (w.data = { text: '', style: 'plain', vertical: false, fontSize: 'm' });
        const style = d.style === 'paper' ? 'paper' : 'plain';
        const vertical = !!d.vertical;
        const fontSize = ['s', 'm', 'l'].includes(d.fontSize) ? d.fontSize : 'm';
        const text = d.text || '';
        const hasText = text.trim().length > 0;
        // 转义链：先 escapeHtml 再替换换行，顺序不能反（防 <br> 被自己转义掉）
        const bodyHtml = hasText
            ? this._esc(text).replace(/\n/g, '<br>')
            : `<span class="widget-note-empty">${I18n.t('widgets.note_placeholder', 'タップして書く')}</span>`;
        const textHtml = `<div class="widget-note-text fs-${fontSize}">${bodyHtml}</div>`;
        const cls = `widget-note widget-note-${style}${vertical ? ' widget-note-v' : ''}`;
        return `<div class="widget-card ${sizeClass} ${cls}" onclick="Widgets.editNote('${w.id}')">
            ${textHtml}
        </div>`;
    },

    editNote(id) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) return;
        const d = w.data || (w.data = { text: '', style: 'plain', vertical: false, fontSize: 'm' });
        const style = d.style === 'paper' ? 'paper' : 'plain';
        const vertical = !!d.vertical;
        const fontSize = ['s', 'm', 'l'].includes(d.fontSize) ? d.fontSize : 'm';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
        modal.onclick = e => { if (e.target === modal) modal.remove(); };

        const chip = (val, label, active) =>
            `<button type="button" class="widget-note-chip${active ? ' active' : ''}" data-val="${val}" onclick="Widgets._noteChipPick(this)">${label}</button>`;
        const sizeLabel = ({ medium: I18n.t('widgets.size_medium'), wide: I18n.t('widgets.size_wide') })[w.size] || w.size;

        modal.innerHTML = `
            <div class="modal-window" style="gap:12px">
                <h3 style="margin:0;font-size:17px;font-weight:600;display:flex;align-items:center;gap:6px">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M4 5h16M4 12h16M4 19h10"/></svg>
                    ${I18n.t('widgets.note_edit_title', 'テキストを編集')}
                </h3>
                <textarea id="noteText" maxlength="300" placeholder="${I18n.t('widgets.note_placeholder', 'タップして書く')}"
                          style="width:100%;min-height:90px;padding:10px 12px;border:1px solid var(--border-medium);border-radius:8px;font-size:14px;line-height:1.7;background:var(--bg-base);color:var(--text-primary);resize:vertical;font-family:inherit">${this._esc(d.text || '')}</textarea>

                <div>
                    <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:6px">${I18n.t('widgets.note_style_label', '見た目')}</label>
                    <div id="noteStyleGroup" style="display:flex;gap:8px">
                        ${chip('plain', I18n.t('widgets.note_style_plain', '無地'), style === 'plain')}
                        ${chip('paper', I18n.t('widgets.note_style_paper', '付箋'), style === 'paper')}
                    </div>
                </div>

                <div>
                    <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:6px">${I18n.t('widgets.note_dir_label', '書く向き')}</label>
                    <div id="noteDirGroup" style="display:flex;gap:8px">
                        ${chip('h', I18n.t('widgets.note_dir_h', '横書き'), !vertical)}
                        ${chip('v', I18n.t('widgets.note_dir_v', '縦書き'), vertical)}
                    </div>
                </div>

                <div>
                    <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:6px">${I18n.t('widgets.note_size_label', '文字サイズ')}</label>
                    <div id="noteFsGroup" style="display:flex;gap:8px">
                        ${chip('s', I18n.t('widgets.note_size_s', '小'), fontSize === 's')}
                        ${chip('m', I18n.t('widgets.note_size_m', '中'), fontSize === 'm')}
                        ${chip('l', I18n.t('widgets.note_size_l', '大'), fontSize === 'l')}
                    </div>
                </div>

                <button onclick="Widgets._toggleNoteSize('${id}', this.closest('.modal-overlay'))"
                        style="padding:8px;border:1px solid var(--border-light);border-radius:8px;background:none;color:var(--text-secondary);font-size:12px;cursor:pointer">
                    ${I18n.t('widgets.note_size_toggle', '幅を切り替え')}（${sizeLabel} → ${I18n.t('widgets.note_size_next', '次のサイズへ')}）
                </button>

                <div style="display:flex;gap:8px;margin-top:4px">
                    <button onclick="this.closest('.modal-overlay').remove()"
                            style="flex:1;padding:10px;border:1px solid var(--border-medium);border-radius:8px;background:none;color:var(--text-primary);font-size:14px;cursor:pointer">${I18n.t('btn.cancel')}</button>
                    <button onclick="Widgets._saveNote('${id}', this.closest('.modal-overlay'))"
                            style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--accent-color);color:#fff;font-size:14px;font-weight:600;cursor:pointer">${I18n.t('btn.save')}</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    },

    // 通用 chip 单选：同组内互斥高亮（style/横竖/字号三组共用）
    _noteChipPick(btn) {
        const group = btn.parentElement;
        if (!group) return;
        Array.from(group.children).forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
    },

    // 宽度档两档循环（medium→wide→medium）：v2.249 起 small≡medium 都是 2 列，去重后便签只剩这两档
    _toggleNoteSize(id, modal) {
        const w = this._getWidgets().find(x => x.id === id);
        if (w) {
            const order = ['medium', 'wide'];
            const idx = order.indexOf(w.size);
            w.size = order[(idx + 1) % order.length];
            this._save();
            if (typeof DesktopRenderer !== 'undefined') this._syncLayoutSpan(w.id, w.size);
            this.render();
        }
        if (modal) modal.remove();
    },

    _saveNote(id, modal) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) return;
        const textEl = modal.querySelector('#noteText');
        const text = (textEl ? textEl.value : '').slice(0, 300);
        const styleActive = modal.querySelector('#noteStyleGroup .active');
        const dirActive = modal.querySelector('#noteDirGroup .active');
        const fsActive = modal.querySelector('#noteFsGroup .active');
        w.data = {
            text,
            style: (styleActive && styleActive.dataset.val === 'paper') ? 'paper' : 'plain',
            vertical: !!(dirActive && dirActive.dataset.val === 'v'),
            fontSize: (fsActive && ['s', 'm', 'l'].includes(fsActive.dataset.val)) ? fsActive.dataset.val : 'm'
        };
        this._save();
        this.render();
        modal.remove();
    },
    // ── T4 end ──

    // ── T6 月相（圆形·纯数学月龄·满月光晕）── agent T6 实装 ──
    // 验算（node 单跑，2026-07-16 12:00 UTC）：age≈1.71 日・illum≈3.3%・盈（waxing）・距满月约13日
    //   →同日 00:00 UTC age≈1.21 日・illum≈1.6%（<2% 阈值）→ 判定「新月」；说明新月/非新月的界线在同一天内
    //   会随具体时刻浮动（新月是时间点不是整天），符合「纯数学、不查表」的预期，方向未接反（新月刚过→盈月增长中）。
    _moonAge(date) {
        const SYNODIC = 29.530588853; // 朔望月
        const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0); // 历元新月 2000-01-06 18:14 UTC
        const days = (date.getTime() - KNOWN_NEW_MOON) / 86400000;
        let age = days % SYNODIC;
        if (age < 0) age += SYNODIC;
        return age; // [0, SYNODIC)
    },

    _moonPhaseInfo(date) {
        const SYNODIC = 29.530588853;
        const age = this._moonAge(date);
        const ageFrac = age / SYNODIC;
        const theta = 2 * Math.PI * ageFrac;
        const illum = (1 - Math.cos(theta)) / 2; // 0=新月 1=满月
        const waxing = ageFrac < 0.5;             // 盈：月龄前半程
        const fullAge = SYNODIC / 2;
        const daysToFull = waxing ? (fullAge - age) : (SYNODIC * 1.5 - age);
        // review 修复（B1）：只用月龄 ±0.5 天判定＝「当天」单日窗口。原先的 illum 阈值分支
        // （>=0.98 / <=0.02）窗口宽达 ~2.7 天，会连续三晚显示「今夜は満月」，与设计意图不符，
        // 且代数上完全吞掉月龄分支（|age-fullAge|<=0.5 ⇒ illum>=0.997），故整条移除。
        const isFull = Math.abs(age - fullAge) <= 0.5;
        const isNew = age <= 0.5 || age >= SYNODIC - 0.5;
        return { age, illum, waxing, theta, isFull, isNew, daysToFull: Math.max(1, Math.round(daysToFull)) };
    },

    _renderMoonphase(w, sizeClass) {
        const info = this._moonPhaseInfo(new Date());
        const cx = 26, cy = 26, r = 19;
        const clipId = `moonLitClip-${w.id}`;
        const haloId = `moonHalo-${w.id}`;
        let inner, label;

        if (info.isFull) {
            // 满月：满圆 + feGaussianBlur 光晕
            inner = `
                <defs><filter id="${haloId}"><feGaussianBlur stdDeviation="4"/></filter></defs>
                <circle cx="${cx}" cy="${cy}" r="21" fill="#f2e8c8" opacity="0.35" filter="url(#${haloId})"/>
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="#f5ecce"/>
                <circle cx="31" cy="20" r="3.2" fill="#dccfa8" opacity="0.6"/>
                <circle cx="21" cy="29" r="2.2" fill="#dccfa8" opacity="0.5"/>
                <circle cx="28" cy="33" r="1.5" fill="#dccfa8" opacity="0.4"/>
            `;
            label = I18n.t('widgets.moonphase_full', '今夜は満月');
        } else if (info.isNew) {
            // 新月：暗侧底色圆 + 极淡描边示意存在
            inner = `
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="#5a6f88" opacity="0.35"/>
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#8a97a8" stroke-width="0.6" opacity="0.4"/>
            `;
            label = I18n.t('widgets.moonphase_new', '今夜は新月');
        } else {
            // 盈凸/亏凸/眉月通用：外弧=月缘半圆，内弧=terminator 椭圆弧
            // rx 随 |cos(2π·age/29.53)| 变化；盈=亮面在右，亏=亮面在左（北半球习惯）
            const rx = r * Math.abs(Math.cos(info.theta));
            const litRight = info.waxing;
            const isGibbous = info.illum > 0.5;
            const outerSweep = litRight ? 1 : 0;
            const innerSweep = litRight ? (isGibbous ? 1 : 0) : (isGibbous ? 0 : 1);
            const path = `M${cx} ${cy - r} A${r} ${r} 0 0 ${outerSweep} ${cx} ${cy + r} A${rx.toFixed(2)} ${r} 0 0 ${innerSweep} ${cx} ${cy - r} Z`;
            const craterX1 = litRight ? cx + 5 : cx - 5;
            const craterX2 = litRight ? cx - 1 : cx + 1;
            inner = `
                <defs><clipPath id="${clipId}"><path d="${path}"/></clipPath></defs>
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="#5a6f88" opacity="0.35"/>
                <path d="${path}" fill="#f2e8c8"/>
                <g clip-path="url(#${clipId})">
                    <circle cx="${craterX1}" cy="20" r="3.2" fill="#d9cba4" opacity="0.55"/>
                    <circle cx="${craterX2}" cy="31" r="2.1" fill="#d9cba4" opacity="0.45"/>
                </g>
            `;
            label = I18n.t('widgets.moonphase_days_to_full', { n: info.daysToFull });
        }

        return `<div class="widget-card ${sizeClass} widget-moonphase">
            <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">${inner}</svg>
            <div class="moon-label">${label}</div>
        </div>`;
    },
    // ── T6 end ──

    // ── T7 天气徽章（圆形·主题联动氛围）── agent T7 实装 ──
    // 主题 → 天气映射表：纯氛围展示、无真实 API。temp 为基准值，渲染时按当日做 ±2° 确定性抖动。
    // kind 为设计定稿的「英文小字」（天気徽章企划明示英文标签，非漏翻，不进 i18n）
    _WEATHER_THEME_MAP: {
        'snow-country': { icon: 'snow',          kind: 'SNOW',   temp: -3 }, // 雪国：北海道雪景
        'night-sky':    { icon: 'moon-stars',    kind: 'STARRY', temp: 8 },  // 夜空：晴夜満天星
        'sakura':       { icon: 'hazy-sun',      kind: 'HAZY',   temp: 15 }, // 梦之芭蕾（樱）：晴/花曇り
        'summer-rain':  { icon: 'rain',          kind: 'RAIN',   temp: 26 }, // 夏雨：梅雨阵雨
        'journal':      { icon: 'cloud',         kind: 'CLOUDY', temp: 18 }, // 手帐拼贴：柔和阴天
        'minimal':      { icon: 'mist',          kind: 'MIST',   temp: 16 }, // 利休鼠：石庭青苔薄雾
        'animal':       { icon: 'sun',           kind: 'CLEAR',  temp: 24 }, // 动森海岛：晴朗
        'strawberry':   { icon: 'partly-cloudy', kind: 'FAIR',   temp: 20 }, // 草莓蛋糕：晴时多云
        'taro-choco':   { icon: 'hazy-sun',      kind: 'DOUX',   temp: 17 }, // 香芋巧克力：巴黎午后柔光（doux=法语「温柔」）
        'mint-choco':   { icon: 'mist',          kind: 'MINT',   temp: 18 }  // 薄荷巧克力：清晨薄荷雾
    },
    _WEATHER_DEFAULT: { icon: 'sun', kind: 'CLEAR', temp: 20 }, // 未知主题兜底＝晴

    // 天气图标：线条风格对齐预览页雪云（stroke 1.6 / 无填充为主 / var(--desktop-text)）
    _weatherIcon(kind) {
        const S = 'stroke="var(--desktop-text)" stroke-width="1.6" fill="none"';
        const box = 'width="40" height="26" viewBox="0 0 40 26" aria-hidden="true"';
        const cloud = (opacity) =>
            `<path d="M10 17 A6.5 6.5 0 0 1 12 5.5 A8 8 0 0 1 27 7 A5.5 5.5 0 0 1 30 17 Z" ${S} stroke-linejoin="round" opacity="${opacity}"/>`;
        switch (kind) {
            case 'snow':
                return `<svg ${box}>
                    ${cloud(0.85)}
                    <circle cx="14" cy="21.5" r="1.2" fill="var(--desktop-text)" opacity="0.6"/>
                    <circle cx="20" cy="24" r="1.2" fill="var(--desktop-text)" opacity="0.6"/>
                    <circle cx="26" cy="21.5" r="1.2" fill="var(--desktop-text)" opacity="0.6"/>
                </svg>`;
            case 'rain':
                return `<svg ${box}>
                    ${cloud(0.85)}
                    <path d="M14 20 L12.5 24.5" ${S} stroke-linecap="round" opacity="0.6"/>
                    <path d="M20 20 L18.5 24.5" ${S} stroke-linecap="round" opacity="0.6"/>
                    <path d="M26 20 L24.5 24.5" ${S} stroke-linecap="round" opacity="0.6"/>
                </svg>`;
            case 'cloud':
                return `<svg ${box}>
                    <g opacity="0.35" transform="translate(-2,3) scale(0.82)">${cloud(1)}</g>
                    ${cloud(0.85)}
                </svg>`;
            case 'mist':
                return `<svg ${box}>
                    <path d="M6 8 Q11 5.5 16 8 Q21 10.5 26 8 Q31 5.5 34 8" ${S} stroke-linecap="round" opacity="0.8"/>
                    <path d="M8 14 Q13 11.5 18 14 Q23 16.5 28 14 Q33 11.5 34 14" ${S} stroke-linecap="round" opacity="0.6"/>
                    <path d="M6 20 Q11 17.5 16 20 Q21 22.5 26 20 Q31 17.5 34 20" ${S} stroke-linecap="round" opacity="0.4"/>
                </svg>`;
            case 'sun':
                return `<svg ${box}>
                    <circle cx="20" cy="13" r="6" ${S} opacity="0.85"/>
                    <path d="M27.5 13 L30.5 13" ${S} stroke-linecap="round" opacity="0.7"/>
                    <path d="M20 5.5 L20 2.5" ${S} stroke-linecap="round" opacity="0.7"/>
                    <path d="M12.5 13 L9.5 13" ${S} stroke-linecap="round" opacity="0.7"/>
                    <path d="M20 20.5 L20 23.5" ${S} stroke-linecap="round" opacity="0.7"/>
                    <path d="M25.3 7.7 L27.4 5.6" ${S} stroke-linecap="round" opacity="0.45"/>
                    <path d="M14.7 7.7 L12.6 5.6" ${S} stroke-linecap="round" opacity="0.45"/>
                    <path d="M14.7 18.3 L12.6 20.4" ${S} stroke-linecap="round" opacity="0.45"/>
                    <path d="M25.3 18.3 L27.4 20.4" ${S} stroke-linecap="round" opacity="0.45"/>
                </svg>`;
            case 'hazy-sun':
                return `<svg ${box}>
                    <circle cx="20" cy="12" r="6" ${S} opacity="0.7"/>
                    <path d="M20 3.5 L20 5.5" ${S} stroke-linecap="round" opacity="0.5"/>
                    <path d="M11.5 6.5 L13 8" ${S} stroke-linecap="round" opacity="0.5"/>
                    <path d="M28.5 6.5 L27 8" ${S} stroke-linecap="round" opacity="0.5"/>
                    <path d="M6 15 Q13 12.5 20 15 Q27 17.5 34 15" ${S} stroke-linecap="round" opacity="0.8"/>
                    <path d="M8 19.5 Q15 17 22 19.5 Q29 22 32 19.5" ${S} stroke-linecap="round" opacity="0.55"/>
                </svg>`;
            case 'partly-cloudy':
                return `<svg ${box}>
                    <circle cx="29" cy="7" r="4" ${S} opacity="0.8"/>
                    <path d="M29 2.3 L29 0.3" ${S} stroke-linecap="round" opacity="0.6"/>
                    <path d="M34.3 7 L36.3 7" ${S} stroke-linecap="round" opacity="0.6"/>
                    <path d="M32.5 3.8 L34 2.3" ${S} stroke-linecap="round" opacity="0.6"/>
                    <path d="M6 22 A5 5 0 0 1 8 13 A6.5 6.5 0 0 1 20 14 A4.5 4.5 0 0 1 23 22 Z" ${S} stroke-linejoin="round" opacity="0.85"/>
                </svg>`;
            case 'moon-stars':
                return `<svg ${box}>
                    <path d="M29 13.79 A9 9 0 1 1 19.21 4 A7 7 0 0 0 29 13.79 Z" ${S} stroke-linejoin="round" opacity="0.85"/>
                    <path d="M9 4.2 L9.6 5.4 L10.8 6 L9.6 6.6 L9 7.8 L8.4 6.6 L7.2 6 L8.4 5.4 Z" fill="var(--desktop-text)" opacity="0.55"/>
                    <path d="M34 7.2 L34.6 8.4 L35.8 9 L34.6 9.6 L34 10.8 L33.4 9.6 L32.2 9 L33.4 8.4 Z" fill="var(--desktop-text)" opacity="0.5"/>
                </svg>`;
            default:
                return `<svg ${box}><circle cx="20" cy="13" r="6" ${S} opacity="0.85"/></svg>`;
        }
    },

    // 温度：日期做种子的确定性伪随机 ±2° 抖动（禁止 Math.random，同一天重渲染不跳数）
    _weatherTempToday(base) {
        const now = new Date();
        const seed = now.getFullYear() * 372 + (now.getMonth() + 1) * 31 + now.getDate();
        const jitter = (seed % 5) - 2; // -2 ~ +2
        return base + jitter;
    },

    _renderWeatherBadge(w, sizeClass) {
        const theme = document.documentElement.dataset.theme;
        const wx = this._WEATHER_THEME_MAP[theme] || this._WEATHER_DEFAULT;
        const temp = this._weatherTempToday(wx.temp);
        return `<div class="widget-card ${sizeClass} widget-weather">
            ${this._weatherIcon(wx.icon)}
            <div class="wx-temp">${temp}°</div>
            <div class="wx-kind">${wx.kind}</div>
        </div>`;
    },
    // ── T7 end ──

    // ══════════════════════════════════════
    //  ∞ 莫比乌斯星环双人相册（v2.212 T9）：die-cut 贴纸样式，无卡底
    //  照片渲染＝SVG <image>+clipPath 手算 transform（非 foreignObject，理由见任务报告）。
    //  槽数据形状：{kind:'url',url}（相册上传）或 {kind:'ref',blobId,name}（放送局立绘），
    //  可选 pos:{x,y,s}（js/image-positioner.js 契约）。kind:'ref' 槽走 _duoframeUrls 异步
    //  blob 水合（照 _charCardUrls 模式：重渲染/删除前统一 revoke 旧 URL）。
    // ══════════════════════════════════════
    _duoframeUrls: {},   // widgetId → [ObjectURL]

    // 手算 ImagePositioner 契约（js/image-positioner.js 头部注释）：clamp 逻辑与其
    // _clampPos 完全一致，本地复刻一份而不是伸手进 T1 的私有方法，保持 T9 区自包含。
    _dfClampPos(pos) {
        let s = (pos && typeof pos.s === 'number' && isFinite(pos.s)) ? pos.s : 1;
        s = Math.min(4, Math.max(1, s));
        const maxOff = 50 * (s - 1);
        let x = (pos && typeof pos.x === 'number' && isFinite(pos.x)) ? pos.x : 0;
        let y = (pos && typeof pos.y === 'number' && isFinite(pos.y)) ? pos.y : 0;
        x = Math.min(maxOff, Math.max(-maxOff, x));
        y = Math.min(maxOff, Math.max(-maxOff, y));
        return { x, y, s };
    },

    // {x,y,s} → SVG <image> 的 transform 属性字符串。image 本身画在以 (cx,cy) 为中心、
    // 边长 box 的正方形里，preserveAspectRatio="xMidYMid slice" 已经做好 s=1 时的居中
    // cover；这里叠加「绕框中心缩放 s、再按 x%/y% 平移」，与 ImagePositioner.transformStyle
    // 对 HTML img 用 transform-origin:50% 50% 的语义完全对应（矩阵：p' = s*p + (A,B)，
    // A = cx*(1-s)+tx，B = cy*(1-s)+ty）。
    _dfImgTransform(cx, cy, box, pos) {
        const { x, y, s } = this._dfClampPos(pos);
        const tx = x / 100 * box;
        const ty = y / 100 * box;
        const A = cx * (1 - s) + tx;
        const B = cy * (1 - s) + ty;
        return `translate(${A.toFixed(3)},${B.toFixed(3)}) scale(${s.toFixed(3)})`;
    },

    // 头+肩剪影：ref 槽水合完成前/blob 丢失时的兜底底层（照 charcard 的 _ccSilhouetteSvg 精神）
    _dfSilhouetteSvg(cx, cy) {
        const s = 1.5, w = 24 * s, half = w / 2;
        return `<g transform="translate(${(cx - half).toFixed(2)},${(cy - half).toFixed(2)}) scale(${s})" opacity="0.32">
            <circle cx="12" cy="8" r="4" fill="currentColor"/>
            <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" fill="currentColor"/>
        </g>`;
    },

    // 空槽：虚线圆 + 加号
    _dfEmptySlotSvg(cx) {
        // 几何跟主题走（v2.225）：生图框档虚线圈省略（画框本身就是框），只留 + 提示
        const g = this._dfGeom();
        const dash = g.art ? '' : `<circle cx="${cx}" cy="${g.cy}" r="${g.r}" fill="none" stroke="var(--sticker-edge, rgba(255,255,255,0.7))" stroke-width="2.5" stroke-dasharray="5 5" opacity="0.9"/>
            `;
        return `${dash}<path d="M${cx - 9} ${g.cy} H${cx + 9} M${cx} ${g.cy - 9} V${g.cy + 9}" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity="0.55"/>`;
    },

    _dfSlotSvg(w, slot, ref, cx) {
        if (!ref) return this._dfEmptySlotSvg(cx);
        const g = this._dfGeom();
        const half = g.r, box = half * 2, cy = g.cy;
        const clipId = `dfclip-${slot}-${w.id}`;
        const isRef = ref.kind === 'ref' && ref.blobId;
        const t = this._dfImgTransform(cx, cy, box, ref.pos);
        const href = (!isRef && ref.kind === 'url' && ref.url) ? Utils.escapeHtml(ref.url) : '';
        // data-df-slot 只标在 ref 槽上：_hydrateDuoframe 靠它定位要写入 href 的 <image>
        const dataAttr = isRef ? ` data-df-widget="${Utils.escapeHtml(w.id)}" data-df-slot="${slot}"` : '';
        return `<g clip-path="url(#${clipId})">
            ${isRef ? this._dfSilhouetteSvg(cx, cy) : ''}
            <image${dataAttr} href="${href}" xlink:href="${href}" x="${cx - half}" y="${cy - half}" width="${box}" height="${box}"
                  preserveAspectRatio="xMidYMid slice" transform="${t}"/>
        </g>`;
    },

    // 照预览页骨架：viewBox 240x130、两圆 r44@(83,65)/(157,65)、星轨 ellipse rx106 ry32
    // rotate(-7)、后层全环 opacity .4、前层 pathLength=440 dasharray"110 110" dashoffset110
    // 露左下+右上两段做穿插、三颗四角星。唯一偏离预览页处：前层 casing 描边从假壁纸色
    // var(--wall) 改成贴纸描边语义 var(--sticker-edge, rgba(255,255,255,0.7))（真机没有
    // 单一壁纸纯色可依赖）；同一 token 也顺手垫进两圆白贴纸边的 fill，T10 落地 --sticker-edge
    // 之前用内联 fallback 兜底，避免变量未定义时 fill 失效。
    // ── 双人相框几何解析（v2.225）──
    // 默认=莫比乌斯星环 SVG 手绘（viewBox 240x130·窗位 83/157/65 r39）。
    // 法式芭蕾(sakura)=生图双联珍珠浮雕框（assets/widgets/sakura/duoframe.webp 1536x1024
    // 真透明资产·CSS 背景），SVG 只剩照片槽：窗位按画中实测（1536 坐标系
    // cxA≈435 cxB≈1092 cy≈545 r≈230）×(240/1536) 换算进 viewBox 240x160。
    // 换资产必须重测窗位；主题切换时 SystemConfig.applyTheme 会重渲染桌面取新几何。
    _dfGeom() {
        const theme = (typeof document !== 'undefined')
            ? document.documentElement.getAttribute('data-theme') : '';
        if (theme === 'sakura') {
            return { vw: 240, vh: 160, cxA: 68, cxB: 170.5, cy: 85, r: 34, art: true };
        }
        if (theme === 'taro-choco') {
            // 香芋巧克力：cameo 浮雕双椭圆窗生图（assets/widgets/taro-choco/duoframe.webp）
            // 画布本身已是 240/130 比例（不需要像 sakura 那样另外覆写 aspect-ratio），
            // 窗位按画中实测（983x533 坐标系 cxA≈302.5 cxB≈680.5 cy≈301.5 rx≈155.5）
            // ×(240/983) 换算进 viewBox 240x130；r 取窗洞较窄的水平半径（椭圆窗，圆形裁切
            // 取小值保证圆完全落在窗洞内，不越过金属窗框）。
            return { vw: 240, vh: 130, cxA: 74, cxB: 166, cy: 73, r: 36, art: true };
        }
        // v2.256 老皮肤补漏：五套老主题一次补齐双人相框，窗位均按各自画布实测换算
        // （vw 固定 240，vh/cx/cy/r 由 tools/skin-audit 的量窗脚本输出；
        //  对应的 aspect-ratio 覆写在 css/themes.css 各主题块里，两处必须同时改）。
        const DF_ART = {
            'summer-rain':  { vw: 240, vh: 97,  cxA: 73, cxB: 166, cy: 49, r: 33, art: true },
            'strawberry':   { vw: 240, vh: 126, cxA: 68, cxB: 172, cy: 57, r: 42, art: true },
            'snow-country': { vw: 240, vh: 93,  cxA: 71, cxB: 170, cy: 48, r: 34, art: true },
            'animal':       { vw: 240, vh: 101, cxA: 69, cxB: 173, cy: 51, r: 33, art: true },
            'journal':      { vw: 240, vh: 101, cxA: 79, cxB: 162, cy: 51, r: 26, art: true },
        };
        if (DF_ART[theme]) return DF_ART[theme];
        if (theme === 'mint-choco') {
            // 薄荷巧克力：奶油波点卡挖两个薄荷圆窗生图（assets/widgets/mint-choco/duoframe.webp）
            // 画布实测 1515x682（2.221:1）≠ 默认 240/130，themes.css 里已把 aspect-ratio
            // 覆写成 240/108 对齐；窗位按画中实测（1515x682 坐标系 cxA≈456 cxB≈1052.5
            // cy≈327.5 r≈202.5）×(240/1515) 换算进 viewBox 240x108。
            return { vw: 240, vh: 108, cxA: 72, cxB: 167, cy: 52, r: 32, art: true };
        }
        return { vw: 240, vh: 130, cxA: 83, cxB: 157, cy: 65, r: 39, art: false };
    },

    _renderDuoframe(w, sizeClass) {
        const d = w.data || (w.data = { refA: null, refB: null });
        this._queueDuoframeHydration(w.id);
        const g = this._dfGeom();
        const edge = 'var(--sticker-edge, rgba(255,255,255,0.7))';
        const clipA = `dfclip-a-${Utils.escapeHtml(w.id)}`, clipB = `dfclip-b-${Utils.escapeHtml(w.id)}`;
        if (g.art) {
            // 生图框：装饰整层来自 CSS 背景资产，SVG 只保留照片槽（clip 圆按画中窗位）+空槽提示
            return `<div class="${sizeClass} widget-duoframe widget-duoframe-art" onclick="Widgets.editDuoframe('${w.id}')">
                <svg class="df-svg" viewBox="0 0 ${g.vw} ${g.vh}" style="color:var(--df-slot-hint, var(--accent-soft))" aria-hidden="true">
                    <defs>
                        <clipPath id="${clipA}"><circle cx="${g.cxA}" cy="${g.cy}" r="${g.r}"/></clipPath>
                        <clipPath id="${clipB}"><circle cx="${g.cxB}" cy="${g.cy}" r="${g.r}"/></clipPath>
                    </defs>
                    ${this._dfSlotSvg(w, 'a', d.refA, g.cxA)}
                    ${this._dfSlotSvg(w, 'b', d.refB, g.cxB)}
                </svg>
            </div>`;
        }
        return `<div class="${sizeClass} widget-duoframe" onclick="Widgets.editDuoframe('${w.id}')">
            <svg class="df-svg" viewBox="0 0 240 130" style="color:var(--df-slot-hint, var(--accent-soft))" aria-hidden="true">
                <ellipse cx="120" cy="65" rx="106" ry="32" transform="rotate(-7 120 65)"
                         fill="none" stroke="currentColor" stroke-width="3" opacity="0.4"/>
                <circle cx="83" cy="65" r="44" fill="${edge}"/>
                <defs>
                    <clipPath id="${clipA}"><circle cx="83" cy="65" r="39"/></clipPath>
                    <clipPath id="${clipB}"><circle cx="157" cy="65" r="39"/></clipPath>
                </defs>
                ${this._dfSlotSvg(w, 'a', d.refA, 83)}
                <circle cx="157" cy="65" r="44" fill="${edge}"/>
                ${this._dfSlotSvg(w, 'b', d.refB, 157)}
                <!-- review 加固（E-A）：WebKit 对 <ellipse> 上的 pathLength 归一化历史支持不稳，
                     穿插效果全靠 dash 相位——前层换成起点/走向与 <ellipse> 完全一致的等价 <path>
                     （右中点起、顺时针两段大弧），pathLength 在 <path> 上全平台稳定，dash 相位不变 -->
                <path d="M226 65 A106 32 0 1 1 14 65 A106 32 0 1 1 226 65 Z" transform="rotate(-7 120 65)"
                      fill="none" stroke="${edge}" stroke-width="7" opacity="0.9"
                      pathLength="440" stroke-dasharray="110 110" stroke-dashoffset="110"/>
                <path d="M226 65 A106 32 0 1 1 14 65 A106 32 0 1 1 226 65 Z" transform="rotate(-7 120 65)"
                      fill="none" stroke="currentColor" stroke-width="3.2"
                      pathLength="440" stroke-dasharray="110 110" stroke-dashoffset="110"/>
                <path d="M28 38 L30 44 L36 46 L30 48 L28 54 L26 48 L20 46 L26 44 Z" fill="currentColor" opacity="0.9"/>
                <path d="M212 84 L213.6 88.5 L218 90 L213.6 91.5 L212 96 L210.4 91.5 L206 90 L210.4 88.5 Z" fill="currentColor" opacity="0.75"/>
                <path d="M196 22 L197.2 25.5 L200.5 26.6 L197.2 27.7 L196 31 L194.8 27.7 L191.5 26.6 L194.8 25.5 Z" fill="currentColor" opacity="0.6"/>
            </svg>
        </div>`;
    },

    // 渲染返回 HTML 字符串、挂载由 DesktopRenderer 完成 → 水合排到挂载后（setTimeout 0）。
    // 重渲染会再次排水合，旧 URL 在 _hydrateDuoframe 开头统一 revoke，最终状态一致（照 charcard）。
    _queueDuoframeHydration(id) {
        setTimeout(() => this._hydrateDuoframe(id), 0);
    },

    async _hydrateDuoframe(id) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w || w.type !== 'duoframe') return;
        (this._duoframeUrls[id] || []).forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} });
        this._duoframeUrls[id] = [];
        if (typeof IllustGallery === 'undefined' || !IllustGallery.getBlob) return;
        const d = w.data || {};
        const slots = [['a', d.refA], ['b', d.refB]];
        for (const [slot, ref] of slots) {
            if (!ref || ref.kind !== 'ref' || !ref.blobId) continue;
            const blob = await IllustGallery.getBlob(ref.blobId).catch(() => null);
            if (!blob) continue;   // blob 丢失（跨设备导入）→ 剪影占位保留
            // widget 已删/桌面翻页重渲染期间 await 完成 → 元素不在了，不建 URL 不泄漏
            if (!this._getWidgets().some(x => x.id === id)) return;
            const el = document.querySelector(`[data-df-widget="${id}"][data-df-slot="${slot}"]`);
            if (!el) continue;
            const url = URL.createObjectURL(blob);
            this._duoframeUrls[id].push(url);
            el.setAttribute('href', url);
            el.setAttribute('xlink:href', url);   // 兼容只认 xlink:href 的旧内核
        }
    },

    // ── 编辑弹窗：槽 A/槽 B 各自「アルバムからアップロード」/「立ち絵から選ぶ」/「位置を調整」──
    // 每个动作即时落盘+即时渲染桌面（照 _handlePolaroidUpload 的即时提交模式），
    // 弹窗本体不设「保存」按钮、只在动作后原地刷新自己 + 一个「閉じる」收尾。
    _dfSlotEditBlock(id, slot, ref, refs) {
        const labelTxt = slot === 'a' ? I18n.t('widgets.df_slot_a', '写真A') : I18n.t('widgets.df_slot_b', '写真B');
        const uploadTxt = I18n.t('widgets.df_upload_btn', 'アルバムからアップロード');
        const pickLabelTxt = I18n.t('widgets.df_pick_label', '立ち絵から選ぶ');
        const pickNoneTxt = I18n.t('widgets.df_pick_none', '未設定');
        const posBtnTxt = I18n.t('widgets.imgpos_open_btn', '位置を調整');
        const selectedBlobId = (ref && ref.kind === 'ref') ? ref.blobId : '';
        const options = `<option value="">${Utils.escapeHtml(pickNoneTxt)}</option>` +
            refs.map(r => `<option value="${this._escAttr(r.blobId)}" ${r.blobId === selectedBlobId ? 'selected' : ''}>${Utils.escapeHtml(r.name || '?')}</option>`).join('');
        return `
        <div class="df-edit-slot">
            <div class="df-edit-slot-label">${Utils.escapeHtml(labelTxt)}</div>
            <label class="widget-upload-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px" aria-hidden="true"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>${Utils.escapeHtml(uploadTxt)}
                <input type="file" accept="image/*" style="display:none" onchange="Widgets._handleDuoframeUpload('${id}','${slot}', this.files[0])">
            </label>
            ${refs.length ? `<label style="font-size:11px;color:var(--text-tertiary);display:block;margin:4px 0 -4px">${Utils.escapeHtml(pickLabelTxt)}</label>
            <select onchange="Widgets._pickDuoframeRef('${id}','${slot}', this.value)">${options}</select>` : ''}
            ${ref ? `<button type="button" onclick="Widgets._openDuoframePositioner('${id}','${slot}')"
                    style="padding:8px;border:1px solid var(--border-light);border-radius:8px;background:none;color:var(--text-secondary);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
                ${Utils.escapeHtml(posBtnTxt)}
            </button>` : ''}
        </div>`;
    },

    _dfModalBody(id) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) return '';
        const d = w.data || (w.data = { refA: null, refB: null });
        const refs = (typeof Broadcast !== 'undefined' && Broadcast.getAllCharRefs) ? Broadcast.getAllCharRefs() : [];
        return `
            <h3 style="margin:0;font-size:17px;font-weight:600">${Utils.escapeHtml(I18n.t('widgets.df_edit_title', 'ふたりフレームを編集'))}</h3>
            <div class="df-edit-grid">
                ${this._dfSlotEditBlock(id, 'a', d.refA, refs)}
                ${this._dfSlotEditBlock(id, 'b', d.refB, refs)}
            </div>
            <button type="button" onclick="Widgets._closeDuoframeModal(this.closest('.modal-overlay'), '${id}')"
                    style="width:100%;padding:10px;border:1px solid var(--border-medium);border-radius:8px;background:none;color:var(--text-primary);font-size:14px;cursor:pointer">${Utils.escapeHtml(I18n.t('widgets.df_close_btn', '閉じる'))}</button>`;
    },

    editDuoframe(id) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) return;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
        modal.onclick = e => { if (e.target === modal) Widgets._closeDuoframeModal(modal, id); };
        modal.innerHTML = `<div class="modal-window df-edit-window">${this._dfModalBody(id)}</div>`;
        document.body.appendChild(modal);
    },

    // 每个槽动作后原地重绘弹窗内容（不关闭），让第二个槽还能接着编辑
    _refreshDuoframeModal(id) {
        const win = document.querySelector('.modal-overlay.active .df-edit-window');
        if (win) win.innerHTML = this._dfModalBody(id);
    },

    _handleDuoframeUpload(id, slot, file) {
        if (!file || !file.type.startsWith('image/')) return;
        if (typeof Utils === 'undefined' || !Utils.readImageFile) return;
        Utils.readImageFile(file, { maxSize: 800, quality: 0.85 }).then(dataUrl => {
            const w = this._getWidgets().find(x => x.id === id);
            if (!w || !dataUrl) return;
            const d = w.data || (w.data = { refA: null, refB: null });
            d[slot === 'a' ? 'refA' : 'refB'] = { kind: 'url', url: dataUrl };
            this._save();
            this.render();
            this._refreshDuoframeModal(id);
        });
    },

    _pickDuoframeRef(id, slot, blobId) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) return;
        const d = w.data || (w.data = { refA: null, refB: null });
        const key = slot === 'a' ? 'refA' : 'refB';
        if (!blobId) {
            d[key] = null;
        } else {
            const refs = (typeof Broadcast !== 'undefined' && Broadcast.getAllCharRefs) ? Broadcast.getAllCharRefs() : [];
            const r = refs.find(x => x.blobId === blobId);
            d[key] = r ? { kind: 'ref', blobId: r.blobId, name: r.name } : null;
        }
        this._save();
        this.render();
        this._refreshDuoframeModal(id);
    },

    _openDuoframePositioner(id, slot) {
        if (typeof ImagePositioner === 'undefined') return;
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) return;
        const d = w.data || {};
        const key = slot === 'a' ? 'refA' : 'refB';
        const ref = d[key];
        if (!ref) return;
        const applyPos = (pos) => {
            const w2 = this._getWidgets().find(x => x.id === id);
            if (!w2 || !w2.data || !w2.data[key]) return;
            w2.data[key].pos = pos;
            this._save();
            this.render();
        };
        if (ref.kind === 'url' && ref.url) {
            ImagePositioner.open({ src: ref.url, shape: 'circle', pos: ref.pos || null, onApply: applyPos });
            return;
        }
        if (ref.kind === 'ref' && ref.blobId && typeof IllustGallery !== 'undefined' && IllustGallery.getBlob) {
            // review 修复（C1/A3）：原实现裸 createObjectURL + MutationObserver 盯 body.lastElementChild
            // 推断定位器关闭——违反 trackBlobUrl 铁律，且依赖 ImagePositioner.open() 的内部 DOM 细节。
            // 改走 charcard 同款 scope 模式：同槽重开先收旧 URL；外层编辑弹窗关闭时
            // （_closeDuoframeModal）统一 revokeBlobScope 兜底。withLock 挡双触并发（C3 同源）。
            Utils.withLock(`df-imgpos-open-${id}-${slot}`, async () => {
                const blob = await IllustGallery.getBlob(ref.blobId).catch(() => null);
                if (!blob) return;
                const scope = `df-imgpos-${id}-${slot}`;
                Utils.revokeBlobScope(scope);
                const url = Utils.trackBlobUrl(URL.createObjectURL(blob), scope);
                ImagePositioner.open({ src: url, shape: 'circle', pos: ref.pos || null, onApply: applyPos });
            });
        }
    },

    // review 修复（C1 配套）：duoframe 编辑弹窗的统一关闭出口——回收两个槽位定位器的临时
    // blob URL scope 再移除弹窗。背景点击与閉じる按钮都走这里。
    _closeDuoframeModal(modal, id) {
        Utils.revokeBlobScope(`df-imgpos-${id}-a`);
        Utils.revokeBlobScope(`df-imgpos-${id}-b`);
        if (modal) modal.remove();
    },
    // ── T9 end ──

    // ══════════════════════════════════════
    //  🪪 Profile Card（v2.250 個人カード：頭像+名前+一言+生活写真）
    //  永久豁免生图皮肤产线（2026-08-10 拍板）：素白卡设计全靠主题 token 自适应浅深色，
    //  百搭到不需要为每套主题单独烧图——CSS 里不套任何 css/themes.css 皮肤覆写，勿加。
    //
    //  size=small → 唯一布局 classic；size=wide → w.data.layoutWide ∈ duo|info|overlay 三选一。
    //  avatar/photoA/photoB 统一形状 {blobId?, url?, pos?}（blobId＝放送局立絵 or 自前アップロード
    //  pf_up_<id>_<slot> キー、url＝直接貼り付け——踏襲 charcard の ref 形状，无 kind 字段，
    //  blobId/url 二択で来源を判定）。photoA/B は「アップロード＋URL」二経路のみ（放送局選択なし）、
    //  avatar だけ放送局ドロップダウンも足した三経路——スロット HTML は showRefDropdown で分岐。
    //  blob 水合は charcard 方式を踏襲（_pfUrls 水合キャッシュ・data-pf-widget/data-pf-slot 属性）。
    // ══════════════════════════════════════
    _pfUrls: {},   // widgetId → [ObjectURL]

    _pfDefaultData() {
        return { name: '', sig: '', avatar: null, photoA: null, photoB: null, chips: [], layoutWide: 'banner' };
    },

    // 頭像空状態の頭+肩シルエット（charcard の _ccSilhouetteSvg と同じ絵柄だが、複数サイズの
    // 円（classic/duo/info/overlay で直径が違う）に流用するため固定 inline サイズを持たせず、
    // CSS 側で「親コンテナの45%」に統一する——単一 helper を全レイアウトで共有できる）
    _pfPersonSvg(cls) {
        return `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg>`;
    },

    // アバター/写真スロットの共通ボックス：img（url 来源は同期描画）or 空プレースホルダ
    // （blobId 来源は水合待ちの間も同じプレースホルダ→_hydrateProfile が非同期で <img> に差し替え）。
    // data-pf-widget/data-pf-slot は charcard の data-cc-widget/data-cc-slot と同じ役割。
    // v2.251：photo スロット（isAvatar=false）の空状態を「+」から月夜の絵に差し替え（用户点单：
    // 「名片卡不该是+空态」）。avatar スロットの人形シルエットは変えない。
    _pfSlotBox(w, slot, ref, isAvatar, cls) {
        const inner = (ref && ref.url)
            ? `<img src="${this._escAttr(ref.url)}" alt="" style="${ImagePositioner.transformStyle(ref.pos)}" onerror="this.style.display='none'">`
            : (isAvatar ? this._pfPersonSvg('pf-empty-icon')
                : `<img src="${this._escAttr(this._pfDefaultPhotoSrc(w.id, slot))}" alt="" onerror="Widgets._pfDefaultImgFallback(this)">`);
        return `<div class="${cls}" data-pf-widget="${w.id}" data-pf-slot="${slot}">${inner}</div>`;
    },

    // v2.253 预置风景照（她点单「烧几张漂亮风景图，看起来高级点」）：海/云/窗边雏菊/暮月四张
    // 生图产线（assets/widgets/universal/pf-default-1..4.webp，各 4~19KB）。widgetId+槽位做
    // 确定性轮换——同一张卡稳定不跳变，duo 的 a/b 两槽错开必然拿到不同的两张。
    _PF_DEFAULT_COUNT: 4,
    _pfDefaultPhotoSrc(widgetId, slot) {
        let h = slot === 'b' ? 1 : 0;   // b 槽错位，保证与 a 槽不同张
        for (let i = 0; i < widgetId.length; i++) h = (h + widgetId.charCodeAt(i)) % this._PF_DEFAULT_COUNT;
        return `assets/widgets/universal/pf-default-${h + 1}.webp`;
    },

    // 预置图加载失败（极端离线首跑等）→ 退回 SVG 月夜占位，卡面不空
    _pfDefaultImgFallback(img) {
        const box = img.parentElement;
        if (box) box.innerHTML = this._pfPhotoDefaultSvg('pf-photo-default');
    },

    // 写真スロットのデフォルト絵「月夜」：--accent-soft 地に currentColor（=--accent-color）の
    // 三日月＋小さな星二つ＋柔らかい山丘のシルエット二層。線の言語は _moonSvg/_sparkSvg と同じ
    // シンプルな作図を流用（新規アセットは増やさない——生图产线はこの組件を永久豁免、2026-08-10 拍板）。
    // viewBox は横長基準、preserveAspectRatio=slice でどのスロット比率（classic の横帯／duo の
    // 縦長並び／overlay の満版）でも中央基準にクロップされ、object-fit:cover 相当の見た目になる。
    _pfPhotoDefaultSvg(cls) {
        return `<svg class="${cls}" viewBox="0 0 200 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <rect width="200" height="140" fill="var(--accent-soft, var(--bg-secondary))"/>
            <g transform="translate(104,10) scale(3)"><path d="M10.5 6.395A4.5 4.5 0 115.605 1.5a3.5 3.5 0 004.895 4.895z" fill="currentColor" opacity="0.85"/></g>
            <g transform="translate(64,32) scale(1.3)" opacity="0.5"><path d="M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z" fill="currentColor"/></g>
            <g transform="translate(150,56) scale(0.85)" opacity="0.35"><path d="M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z" fill="currentColor"/></g>
            <path d="M0 108 Q50 84 100 102 T200 92 V140 H0 Z" fill="currentColor" opacity="0.16"/>
            <path d="M0 126 Q60 100 130 120 T200 112 V140 H0 Z" fill="currentColor" opacity="0.26"/>
        </svg>`;
    },

    _renderProfile(w, sizeClass) {
        const d = w.data || (w.data = this._pfDefaultData());
        this._queueProfileHydration(w.id);
        const isWide = w.size === 'wide';
        const layout = isWide ? (['banner', 'duo', 'info', 'overlay'].includes(d.layoutWide) ? d.layoutWide : 'banner') : 'classic';
        if (layout === 'duo') return this._pfRenderDuo(w, sizeClass, d);
        if (layout === 'info') return this._pfRenderInfo(w, sizeClass, d);
        if (layout === 'overlay') return this._pfRenderOverlay(w, sizeClass, d);
        // classic（small 唯一布局）与 banner（wide 経典簡約横版·2026-08-10 追加）同构：
        // 頭像+名前+署名の上段 ＋ 下段写真ストリップ。DOM 完全共用、比例差全部交给容器 class 的 CSS
        return this._pfRenderClassic(w, sizeClass, d, layout === 'banner');
    },

    // small 唯一布局（+wide banner 同构）：円頭像+名前+ハート（上段）／署名／横写真（下段いっぱい）
    // 設計図 01 の頭像縁のハートバッジと点線は不採用（她拍板：爱心角标和虚线都去掉）
    _pfRenderClassic(w, sizeClass, d, isBanner) {
        const name = (d.name || '').trim();
        const sig = (d.sig || '').trim();
        const nameHtml = name
            ? `<span class="pf-name">${this._esc(name)}</span>`
            : `<span class="pf-name pf-name-placeholder">${this._esc(I18n.t('widgets.pf_name_placeholder', 'タップして名前を…'))}</span>`;
        return `<div class="widget-card ${sizeClass} widget-profile widget-profile-classic${isBanner ? ' widget-profile-banner' : ''}" onclick="Widgets.editProfile('${w.id}')">
            <div class="pf-top">
                ${this._pfSlotBox(w, 'avatar', d.avatar, true, 'pf-avatar')}
                <div class="pf-top-text">
                    <div class="pf-name-row">
                        ${nameHtml}
                        ${this._heartSvg('pf-heart-icon')}
                    </div>
                    ${sig ? `<div class="pf-sig">${this._esc(sig)}</div>` : ''}
                </div>
            </div>
            ${this._pfSlotBox(w, 'a', d.photoA, false, 'pf-photo')}
        </div>`;
    },

    // wide duo：写真A/B左右並べ、円頭像が中線をまたいで下寄りに重なる、下部に署名+星
    _pfRenderDuo(w, sizeClass, d) {
        const sig = (d.sig || '').trim();
        return `<div class="widget-card ${sizeClass} widget-profile widget-profile-duo" onclick="Widgets.editProfile('${w.id}')">
            <div class="pf-duo-photos">
                ${this._pfSlotBox(w, 'a', d.photoA, false, 'pf-duo-photo')}
                ${this._pfSlotBox(w, 'b', d.photoB, false, 'pf-duo-photo')}
                ${this._pfSlotBox(w, 'avatar', d.avatar, true, 'pf-duo-avatar')}
            </div>
            <div class="pf-duo-sig"><span class="pf-duo-sig-text">${sig ? this._esc(sig) : `<span class="pf-sig-ph">${this._esc(I18n.t('widgets.pf_sig_ph', 'タップして一言を…'))}</span>`}</span>${sig ? this._sparkSvg('pf-duo-star-icon') : ''}</div>
        </div>`;
    },

    // wide info：左に縦写真、右に頭像+名前・署名2行・chips最大3枚
    _pfRenderInfo(w, sizeClass, d) {
        const name = (d.name || '').trim();
        const sig = (d.sig || '').trim();
        const chips = (d.chips || []).filter(c => c && c.text).slice(0, 3);
        const chipIcon = icon => icon === 'moon' ? this._moonSvg('pf-chip-icon') : icon === 'heart' ? this._heartSvg('pf-chip-icon') : this._sparkSvg('pf-chip-icon');
        const chipsHtml = chips.map(c => `<span class="pf-chip">${chipIcon(c.icon)}<span>${this._esc(c.text)}</span></span>`).join('');
        return `<div class="widget-card ${sizeClass} widget-profile widget-profile-info" onclick="Widgets.editProfile('${w.id}')">
            ${this._pfSlotBox(w, 'a', d.photoA, false, 'pf-info-photo')}
            <div class="pf-info-body">
                <div class="pf-info-head">
                    ${this._pfSlotBox(w, 'avatar', d.avatar, true, 'pf-info-avatar')}
                    ${name ? `<span class="pf-info-name">${this._esc(name)}</span>` : `<span class="pf-info-name pf-sig-ph">${this._esc(I18n.t('widgets.pf_name_placeholder', 'タップして名前を…'))}</span>`}
                </div>
                <div class="pf-info-detail">
                    ${sig ? `<div class="pf-info-sig">${this._esc(sig)}</div>` : ''}
                    ${chipsHtml ? `<div class="pf-info-chips">${chipsHtml}</div>` : ''}
                </div>
            </div>
        </div>`;
    },

    // wide overlay：満版写真+左上角頭像+下部署名（名前は出さない、spec 明記）
    _pfRenderOverlay(w, sizeClass, d) {
        const sig = (d.sig || '').trim();
        return `<div class="widget-card ${sizeClass} widget-profile widget-profile-overlay" onclick="Widgets.editProfile('${w.id}')">
            ${this._pfSlotBox(w, 'a', d.photoA, false, 'pf-overlay-photo')}
            ${this._pfSlotBox(w, 'avatar', d.avatar, true, 'pf-overlay-avatar')}
            <div class="pf-overlay-sig">${sig ? this._esc(sig) : `<span class="pf-sig-ph">${this._esc(I18n.t('widgets.pf_sig_ph', 'タップして一言を…'))}</span>`}</div>
        </div>`;
    },

    // 渲染返回 HTML 字符串、挂载由 DesktopRenderer 完成 → 水合排到挂载后（照 charcard）
    _queueProfileHydration(id) {
        setTimeout(() => this._hydrateProfile(id), 0);
    },

    async _hydrateProfile(id) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w || w.type !== 'profile') return;
        (this._pfUrls[id] || []).forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} });
        this._pfUrls[id] = [];
        if (typeof IllustGallery === 'undefined' || !IllustGallery.getBlob) return;
        const d = w.data || {};
        const slots = [['avatar', d.avatar], ['a', d.photoA], ['b', d.photoB]];
        for (const [slot, ref] of slots) {
            if (!ref || !ref.blobId) continue;   // url 来源已在渲染时同步内联，无需水合
            const blob = await IllustGallery.getBlob(ref.blobId).catch(() => null);
            if (!blob) continue;   // blob 丢失（跨设备导入）→ 占位保留
            if (!this._getWidgets().some(x => x.id === id)) return;   // 等待期间组件已删/翻页
            const el = document.querySelector(`[data-pf-widget="${id}"][data-pf-slot="${slot}"]`);
            if (!el) continue;
            const url = URL.createObjectURL(blob);
            this._pfUrls[id].push(url);
            el.innerHTML = `<img src="${url}" alt="" style="${ImagePositioner.transformStyle(ref.pos)}">`;
        }
    },

    // 配置弹窗：点卡片本体打开（对齐 editPhoto/editCharCard 交互）
    editProfile(id) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) return;
        const d = w.data || (w.data = this._pfDefaultData());
        const refs = (typeof Broadcast !== 'undefined' && Broadcast.getAllCharRefs) ? Broadcast.getAllCharRefs() : [];
        const rowStyle = 'width:100%;padding:10px 12px;border:1px solid var(--border-medium);border-radius:8px;font-size:14px;background:var(--bg-base);color:var(--text-primary)';
        const isWide = w.size === 'wide';
        const layoutWide = ['banner', 'duo', 'info', 'overlay'].includes(d.layoutWide) ? d.layoutWide : 'banner';

        const sizeNames = {
            small: I18n.t('widgets.pf_size_small', '小方・クラシック'),
            wide: I18n.t('widgets.pf_size_wide', '横長・3レイアウト')
        };
        const curKey = isWide ? 'wide' : 'small';
        const nextKey = isWide ? 'small' : 'wide';
        const sizeSwitchLabel = I18n.t('widgets.pf_size_switch_prefix', 'サイズ切替（現在：')
            + sizeNames[curKey] + ' → ' + sizeNames[nextKey] + '）';

        const layoutOpt = (val, title, desc) => `
            <button type="button" class="pf-layout-opt${layoutWide === val ? ' active' : ''}" data-val="${val}" onclick="Widgets._pfLayoutPick(this)">
                <span class="pf-layout-opt-title">${Utils.escapeHtml(title)}</span>
                <span class="pf-layout-opt-desc">${Utils.escapeHtml(desc)}</span>
            </button>`;

        const chipRow = i => {
            const c = (d.chips && d.chips[i]) || {};
            const icon = ['star', 'moon', 'heart'].includes(c.icon) ? c.icon : 'star';
            const iconBtn = (val, svg) => `<button type="button" class="pf-chip-icon-btn${icon === val ? ' active' : ''}" data-val="${val}" onclick="Widgets._noteChipPick(this)">${svg}</button>`;
            return `<div class="pf-chip-edit-row">
                <div class="pf-chip-icon-group">
                    ${iconBtn('star', this._sparkSvg())}
                    ${iconBtn('moon', this._moonSvg())}
                    ${iconBtn('heart', this._heartSvg())}
                </div>
                <input type="text" id="pfChipText${i}" maxlength="10" placeholder="${this._escAttr(I18n.t('widgets.pf_chip_text_ph', 'タグの文字'))}"
                       value="${this._escAttr(c.text || '')}" style="flex:1;min-width:0;${rowStyle}">
            </div>`;
        };

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
        modal.onclick = e => { if (e.target === modal) Widgets._pfCloseModal(modal, id); };
        modal.innerHTML = `
            <div class="modal-window" style="gap:12px;max-height:85vh;overflow-y:auto">
                <h3 style="margin:0;font-size:17px;font-weight:600">${I18n.t('widgets.pf_edit_title', 'プロフィールカードを編集')}</h3>

                <input type="text" id="pfName" maxlength="20" placeholder="${this._escAttr(I18n.t('widgets.pf_name_ph', '名前'))}"
                       value="${this._escAttr(d.name)}" style="${rowStyle}">
                <input type="text" id="pfSig" maxlength="40" placeholder="${this._escAttr(I18n.t('widgets.pf_sig_ph', 'ひとこと'))}"
                       value="${this._escAttr(d.sig)}" style="${rowStyle}">

                <div>
                    <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:6px">${I18n.t('widgets.pf_avatar_label', 'アバター')}</label>
                    ${this._pfSlotHtml(w.id, 'avatar', d.avatar, refs, rowStyle, true)}
                </div>

                <div>
                    <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:6px">${I18n.t('widgets.pf_photo_a_label', '写真')}</label>
                    ${this._pfSlotHtml(w.id, 'a', d.photoA, refs, rowStyle, false)}
                </div>

                ${isWide ? `
                <div id="pfSlotBRow" style="display:${layoutWide === 'duo' ? 'block' : 'none'}">
                    <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:6px">${I18n.t('widgets.pf_photo_b_label', '写真B')}</label>
                    ${this._pfSlotHtml(w.id, 'b', d.photoB, refs, rowStyle, false)}
                </div>

                <div>
                    <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:6px">${I18n.t('widgets.pf_layout_label', '横長レイアウト')}</label>
                    <div class="pf-layout-group">
                        ${layoutOpt('banner', I18n.t('widgets.pf_layout_banner', 'クラシック横長'), I18n.t('widgets.pf_layout_banner_desc', '頭像と名前の下に横長写真'))}
                        ${layoutOpt('duo', I18n.t('widgets.pf_layout_duo', '写真2枚コラージュ'), I18n.t('widgets.pf_layout_duo_desc', '写真を左右に並べ、頭像が継ぎ目にまたがる'))}
                        ${layoutOpt('info', I18n.t('widgets.pf_layout_info', '写真＋情報欄'), I18n.t('widgets.pf_layout_info_desc', '縦写真の横に名前・ひとこと・タグ'))}
                        ${layoutOpt('overlay', I18n.t('widgets.pf_layout_overlay', '満版写真＋重ね'), I18n.t('widgets.pf_layout_overlay_desc', '満版写真に頭像とひとことを重ねる'))}
                    </div>
                </div>

                <div id="pfChipsRow" style="display:${layoutWide === 'info' ? 'flex' : 'none'};flex-direction:column;gap:6px">
                    <label style="font-size:12px;color:var(--text-secondary)">${I18n.t('widgets.pf_chips_label', 'タグ（最大3つ）')}</label>
                    ${chipRow(0)}${chipRow(1)}${chipRow(2)}
                </div>
                ` : ''}

                <button type="button" onclick="Widgets._togglePfSize('${id}', this.closest('.modal-overlay'))"
                        style="padding:8px;border:1px solid var(--border-light);border-radius:8px;background:none;color:var(--text-secondary);font-size:12px;cursor:pointer">
                    ${this._esc(sizeSwitchLabel)}
                </button>

                <div style="display:flex;gap:8px;margin-top:4px">
                    <button onclick="Widgets._pfCloseModal(this.closest('.modal-overlay'), '${id}')"
                            style="flex:1;padding:10px;border:1px solid var(--border-medium);border-radius:8px;background:none;color:var(--text-primary);font-size:14px;cursor:pointer">${I18n.t('btn.cancel', '取消')}</button>
                    <button onclick="Widgets._saveProfile('${id}', this.closest('.modal-overlay'))"
                            style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--accent-color);color:#fff;font-size:14px;font-weight:600;cursor:pointer">${I18n.t('btn.confirm', '确定')}</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    },

    // アバター/写真スロットの共通フォーム片：showRefDropdown=true のときだけ放送局立絵の
    // <select> を足す（avatar 専用の第三経路——photoA/B は「アップロード＋URL」二経路のみ）。
    // #pfSlot<Cap> の data-blobid/data-url/data-pos が唯一の真相源（照 charcard の _ccSlotHtml）。
    _pfSlotHtml(widgetId, slot, ref, refs, rowStyle, showRefDropdown) {
        const capId = slot.charAt(0).toUpperCase() + slot.slice(1);
        const blobId = (ref && ref.blobId) || '';
        const url = (ref && ref.url) || '';
        const posAttr = (ref && ref.pos) ? ` data-pos="${this._escAttr(JSON.stringify(ref.pos))}"` : '';
        const urlAttr = url ? ` data-url="${this._escAttr(url)}"` : '';
        const hasAny = !!(blobId || url);
        const uploadTitle = I18n.t('widgets.pf_upload_btn', 'アルバムからアップロード');
        const urlPh = I18n.t('widgets.pf_url_ph', '画像URLを貼り付け…');
        const posLabel = I18n.t('widgets.imgpos_open_btn', '位置を調整');
        const refSelectHtml = showRefDropdown ? (() => {
            const placeholderTxt = I18n.t('widgets.pf_ref_placeholder', 'アップロード画像 / 未選択');
            const optionsHtml = refs.map(r => `<option value="${this._escAttr(r.blobId)}" ${r.blobId === blobId ? 'selected' : ''}>${Utils.escapeHtml(r.name || '?')}</option>`).join('');
            return `<select id="pfRef${capId}" style="${rowStyle}" onchange="Widgets._pfOnRefSelect(this.closest('.modal-overlay'),'${slot}')">
                <option value="">${Utils.escapeHtml(placeholderTxt)}</option>
                ${optionsHtml}
            </select>`;
        })() : '';
        return `
            <div id="pfSlot${capId}" data-blobid="${this._escAttr(blobId)}"${urlAttr}${posAttr} style="display:flex;flex-direction:column;gap:6px">
                ${refSelectHtml}
                <div style="display:flex;gap:6px">
                    <input type="text" id="pfUrl${capId}" placeholder="${this._escAttr(urlPh)}" value="${this._escAttr(url)}"
                           style="flex:1;min-width:0;${rowStyle}" onchange="Widgets._pfOnUrlInput(this.closest('.modal-overlay'),'${slot}',this.value)">
                    <label class="widget-upload-btn" title="${this._escAttr(uploadTitle)}"
                           style="flex:none;display:flex;align-items:center;justify-content:center;width:40px;padding:0;cursor:pointer">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px" aria-hidden="true"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>
                        <input type="file" accept="image/*" style="display:none"
                               onchange="Widgets._pfHandleUpload('${widgetId}','${slot}',this.files[0],this.closest('.modal-overlay'));this.value=''">
                    </label>
                </div>
                <button type="button" id="pfPosBtn${capId}" onclick="Widgets._pfOpenPositioner('${widgetId}','${slot}',this.closest('.modal-overlay'))"
                        style="display:${hasAny ? 'flex' : 'none'};align-items:center;justify-content:center;gap:6px;padding:8px;border:1px solid var(--border-light);border-radius:8px;background:none;color:var(--text-secondary);font-size:12px;cursor:pointer">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
                    ${Utils.escapeHtml(posLabel)}
                </button>
            </div>`;
    },

    // 放送局登録簿から選択（avatar のみ）→ data-blobid に書き込み、data-url/data-pos をクリア
    _pfOnRefSelect(modal, slot) {
        if (!modal) return;
        const capId = slot.charAt(0).toUpperCase() + slot.slice(1);
        const sel = modal.querySelector(`#pfRef${capId}`);
        const slotEl = modal.querySelector(`#pfSlot${capId}`);
        if (!sel || !slotEl || !sel.value) return;
        slotEl.dataset.blobid = sel.value;
        slotEl.removeAttribute('data-url');
        slotEl.removeAttribute('data-pos');
        const urlInput = modal.querySelector(`#pfUrl${capId}`);
        if (urlInput) urlInput.value = '';
        this._pfRefreshPosBtn(modal, slot);
    },

    // URL 入力欄が変わった → data-url に書き込み、data-blobid/data-pos をクリア（空にしたら解除）
    _pfOnUrlInput(modal, slot, value) {
        if (!modal) return;
        const capId = slot.charAt(0).toUpperCase() + slot.slice(1);
        const slotEl = modal.querySelector(`#pfSlot${capId}`);
        if (!slotEl) return;
        const v = (value || '').trim();
        if (v) {
            slotEl.dataset.url = v;
            slotEl.removeAttribute('data-blobid');
            slotEl.removeAttribute('data-pos');
            const sel = modal.querySelector(`#pfRef${capId}`);
            if (sel) sel.value = '';
        } else {
            slotEl.removeAttribute('data-url');
        }
        this._pfRefreshPosBtn(modal, slot);
    },

    // File → Utils.readImageFile 压缩成 dataURL → Blob → IllustGallery（照 _handleCharCardUpload）。
    // blobId 与 widget+槽位一一对应（pf_up_<widgetId>_<slot>），重传即覆盖，不留孤儿 blob。
    async _pfHandleUpload(id, slot, file, modal) {
        if (!file || !file.type || file.type.indexOf('image/') !== 0 || !modal) return;
        if (typeof IllustGallery === 'undefined') return;
        let dataUrl;
        try {
            dataUrl = await Utils.readImageFile(file);
        } catch (e) {
            Utils.showToast(I18n.t('widgets.pf_upload_fail', '画像の読み込みに失敗しました'));
            return;
        }
        if (!dataUrl) return;
        let blob;
        try {
            blob = await fetch(dataUrl).then(r => r.blob());
        } catch (e) {
            Utils.showToast(I18n.t('widgets.pf_upload_fail', '画像の読み込みに失敗しました'));
            return;
        }
        const blobId = `pf_up_${id}_${slot}`;
        await IllustGallery.save(blobId, blob);
        const capId = slot.charAt(0).toUpperCase() + slot.slice(1);
        const slotEl = modal.querySelector(`#pfSlot${capId}`);
        if (!slotEl) return;   // 弹窗已在等待期间关闭
        slotEl.dataset.blobid = blobId;
        slotEl.removeAttribute('data-url');
        slotEl.removeAttribute('data-pos');
        const sel = modal.querySelector(`#pfRef${capId}`);
        if (sel) sel.value = '';
        const urlInput = modal.querySelector(`#pfUrl${capId}`);
        if (urlInput) urlInput.value = '';
        this._pfRefreshPosBtn(modal, slot);
        Utils.showToast(I18n.t('widgets.pf_upload_done', '画像をアップロードしました'));
    },

    _pfRefreshPosBtn(modal, slot) {
        const capId = slot.charAt(0).toUpperCase() + slot.slice(1);
        const slotEl = modal.querySelector(`#pfSlot${capId}`);
        const btn = modal.querySelector(`#pfPosBtn${capId}`);
        if (!slotEl || !btn) return;
        btn.style.display = (slotEl.dataset.blobid || slotEl.dataset.url) ? 'flex' : 'none';
    },

    // 位置定位（接 ImagePositioner）：avatar shape:'circle'、photoA/B shape:'rect'。
    // 临时 blob URL 按 scope 登记（Utils.trackBlobUrl），关闭弹窗时统一 revoke（照 charcard T2）。
    async _pfOpenPositioner(id, slot, modal) {
        if (!modal || typeof ImagePositioner === 'undefined') return;
        return Utils.withLock(`pf-imgpos-open-${id}-${slot}`, async () => {
            const capId = slot.charAt(0).toUpperCase() + slot.slice(1);
            const slotEl = modal.querySelector(`#pfSlot${capId}`);
            if (!slotEl) return;
            const blobId = slotEl.dataset.blobid;
            const url = slotEl.dataset.url;
            const scope = `pf-imgpos-${id}-${slot}`;
            let src = '';
            if (blobId) {
                if (typeof IllustGallery === 'undefined') return;
                const blob = await IllustGallery.getBlob(blobId).catch(() => null);
                if (!blob) { Utils.showToast(I18n.t('widgets.pf_pos_missing', '画像が見つかりません')); return; }
                Utils.revokeBlobScope(scope);
                src = Utils.trackBlobUrl(URL.createObjectURL(blob), scope);
            } else if (url) {
                src = url;
            } else {
                return;
            }
            let pos = null;
            if (slotEl.dataset.pos) { try { pos = JSON.parse(slotEl.dataset.pos); } catch (e) { pos = null; } }
            const shape = slot === 'avatar' ? 'circle' : 'rect';
            // review 修复系（A1 同源）：预览框比例量现场桌面 DOM（当前渲染态的真实图框），量不到退 1
            let aspect = 1;
            if (shape !== 'circle') {
                const fig = document.querySelector(`[data-pf-widget="${id}"][data-pf-slot="${slot}"]`);
                const fr = fig && fig.getBoundingClientRect();
                if (fr && fr.width > 4 && fr.height > 4) aspect = fr.width / fr.height;
            }
            ImagePositioner.open({
                src, shape, aspect, pos,
                onApply: p => {
                    if (p) slotEl.dataset.pos = JSON.stringify(p);
                    else slotEl.removeAttribute('data-pos');
                }
            });
        });
    },

    // 横長レイアウト単選：同組内互斥高亮（复用 _noteChipPick 通用逻辑）+ 联动显隐照片B区/chips区
    _pfLayoutPick(btn) {
        this._noteChipPick(btn);
        const modal = btn.closest('.modal-overlay');
        if (!modal) return;
        const val = btn.dataset.val;
        const bRow = modal.querySelector('#pfSlotBRow');
        const chipsRow = modal.querySelector('#pfChipsRow');
        if (bRow) bRow.style.display = val === 'duo' ? 'block' : 'none';
        if (chipsRow) chipsRow.style.display = val === 'info' ? 'flex' : 'none';
    },

    _saveProfile(id, modal) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) { modal.remove(); return; }
        const name = (modal.querySelector('#pfName').value || '').trim().slice(0, 20);
        const sig = (modal.querySelector('#pfSig').value || '').trim().slice(0, 40);
        const buildRef = slot => {
            const capId = slot.charAt(0).toUpperCase() + slot.slice(1);
            const slotEl = modal.querySelector(`#pfSlot${capId}`);
            if (!slotEl) return null;
            const blobId = slotEl.dataset.blobid;
            const url = slotEl.dataset.url;
            if (!blobId && !url) return null;
            let pos = null;
            if (slotEl.dataset.pos) { try { pos = JSON.parse(slotEl.dataset.pos); } catch (e) { pos = null; } }
            const ref = blobId ? { blobId } : { url };
            if (pos) ref.pos = pos;
            return ref;
        };
        const avatar = buildRef('avatar');
        const photoA = buildRef('a');
        // 各字段「弹窗里有对应控件才从 DOM 收，否则沿用旧值」：small 弹窗没有 B/chips/布局区，
        // wide 弹窗三区常驻 DOM（layout 联动只切 display、隐藏时输入值仍在）——这样小方档下
        // 保存不会抹掉横条档已配好的照片B/chips/布局，切布局保存也不丢另一布局的配置
        const prev = w.data || this._pfDefaultData();
        const layoutActive = modal.querySelector('.pf-layout-opt.active');
        const layoutWide = (layoutActive && ['banner', 'duo', 'info', 'overlay'].includes(layoutActive.dataset.val))
            ? layoutActive.dataset.val
            : (['banner', 'duo', 'info', 'overlay'].includes(prev.layoutWide) ? prev.layoutWide : 'banner');
        const photoB = modal.querySelector('#pfSlotB') ? buildRef('b') : (prev.photoB || null);
        let chips = Array.isArray(prev.chips) ? prev.chips : [];
        if (modal.querySelector('#pfChipText0')) {
            chips = [];
            for (let i = 0; i < 3; i++) {
                const group = modal.querySelectorAll('.pf-chip-icon-group')[i];
                const activeBtn = group && group.querySelector('.pf-chip-icon-btn.active');
                const icon = (activeBtn && activeBtn.dataset.val) || 'star';
                const textEl = modal.querySelector(`#pfChipText${i}`);
                const text = ((textEl && textEl.value) || '').trim().slice(0, 10);
                if (text) chips.push({ icon, text });
            }
        }
        w.data = { name, sig, avatar, photoA, photoB, chips, layoutWide };
        Utils.revokeBlobScope(`pf-imgpos-${id}-avatar`);
        Utils.revokeBlobScope(`pf-imgpos-${id}-a`);
        Utils.revokeBlobScope(`pf-imgpos-${id}-b`);
        this._save();
        this._pfCleanupOrphanUploads(id);
        this.render();
        modal.remove();
    },

    // review 修复系配套（照 charcard C2/D2）：editProfile 会话内新上传但最终未被 data 引用的
    // pf_up_<id>_<slot> 键——取消/保存都走这里回收，堵住三条孤儿路径（换图/取消/删组件）。
    _pfCleanupOrphanUploads(id) {
        if (typeof IllustGallery === 'undefined' || !IllustGallery.remove) return;
        const w = this._getWidgets().find(x => x.id === id);
        const kept = new Set();
        if (w && w.data) {
            ['avatar', 'photoA', 'photoB'].forEach(k => { if (w.data[k] && w.data[k].blobId) kept.add(w.data[k].blobId); });
        }
        ['avatar', 'a', 'b'].forEach(slot => {
            const key = `pf_up_${id}_${slot}`;
            if (!kept.has(key)) IllustGallery.remove(key).catch(() => {});
        });
    },

    // 统一关闭出口（背景点击/取消按钮都走这里）：回收三个槽位定位器的临时 blob URL + 清孤儿上传
    _pfCloseModal(modal, id) {
        Utils.revokeBlobScope(`pf-imgpos-${id}-avatar`);
        Utils.revokeBlobScope(`pf-imgpos-${id}-a`);
        Utils.revokeBlobScope(`pf-imgpos-${id}-b`);
        this._pfCleanupOrphanUploads(id);
        if (modal) modal.remove();
    },

    // small ↔ wide 两档循环（照 _toggleNoteSize）：切换后关闭弹窗、需重新打开才能编辑新档专属字段
    _togglePfSize(id, modal) {
        const w = this._getWidgets().find(x => x.id === id);
        if (w) {
            w.size = (w.size === 'wide') ? 'small' : 'wide';
            this._save();
            if (typeof DesktopRenderer !== 'undefined') this._syncLayoutSpan(w.id, w.size);
            this.render();
        }
        if (modal) modal.remove();
    },
    // ── Profile Card end ──

    // ══════════════════════════════════════
    //  追加・削除メニュー
    // ══════════════════════════════════════
    showAddMenu() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
        modal.onclick = e => { if (e.target === modal) modal.remove(); };
        modal.innerHTML = `
            <div class="modal-window" style="gap:12px">
                <h3 style="margin:0;font-size:17px;font-weight:600">添加小组件</h3>
                <div class="widget-menu-grid">
                    <div class="widget-menu-item" onclick="Widgets.addWidget('clock', this.closest('.modal-overlay'))">
                        <div class="widget-menu-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="width:22px;height:22px"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg></div>
                        <div class="widget-menu-name">时钟</div>
                        <div class="widget-menu-desc">时间・日期・星期</div>
                    </div>
                    <div class="widget-menu-item" onclick="Widgets.addWidget('photo', this.closest('.modal-overlay'))">
                        <div class="widget-menu-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 15l-5-5-9 9"/></svg></div>
                        <div class="widget-menu-name">相册</div>
                        <div class="widget-menu-desc">展示喜欢的图片</div>
                    </div>
                    <div class="widget-menu-item" onclick="Widgets.addWidget('polaroid', this.closest('.modal-overlay'))">
                        <div class="widget-menu-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="12" cy="12.5" r="3.4"/><path d="M8 6l1.5-2h5L16 6"/></svg></div>
                        <div class="widget-menu-name">拍立得</div>
                        <div class="widget-menu-desc">微旋转 + 手写 caption</div>
                    </div>
                    <div class="widget-menu-item" onclick="Widgets.addWidget('calendar', this.closest('.modal-overlay'))">
                        <div class="widget-menu-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="width:22px;height:22px"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg></div>
                        <div class="widget-menu-name">日历</div>
                        <div class="widget-menu-desc">角色纪念日</div>
                    </div>
                    <div class="widget-menu-item" onclick="Widgets.addWidget('music', this.closest('.modal-overlay'))">
                        <div class="widget-menu-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg></div>
                        <div class="widget-menu-name">音乐</div>
                        <div class="widget-menu-desc">正在播放</div>
                    </div>
                    <div class="widget-menu-item" onclick="Widgets.addWidget('news', this.closest('.modal-overlay'))">
                        <div class="widget-menu-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><path d="M4 10v4h3l6 4V6l-6 4H4z"/><path d="M17 9a4 4 0 010 6M19.5 6.5a8 8 0 010 11"/></svg></div>
                        <div class="widget-menu-name">${I18n.t('widgets.type_news', '情報')}</div>
                        <div class="widget-menu-desc">${I18n.t('widgets.news_menu_desc', 'イベント・スレ速報')}</div>
                    </div>
                    <div class="widget-menu-item" onclick="Widgets.addWidget('charcard', this.closest('.modal-overlay'))">
                        <div class="widget-menu-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="10" cy="11" r="2.6"/><path d="M5.5 20c.8-3 2.5-4.5 4.5-4.5s3.7 1.5 4.5 4.5"/><path d="M16 9h3M16 13h3"/></svg></div>
                        <div class="widget-menu-name">${I18n.t('widgets.type_charcard', '立绘卡')}</div>
                        <div class="widget-menu-desc">${I18n.t('widgets.cc_menu_desc', '角色立绘・名前')}</div>
                    </div>
                    <div class="widget-menu-item" onclick="Widgets.addWidget('notifhub', this.closest('.modal-overlay'))">
                        <div class="widget-menu-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M10 20a2 2 0 004 0"/></svg></div>
                        <div class="widget-menu-name">${I18n.t('widgets.type_notifhub', '通知センター')}</div>
                        <div class="widget-menu-desc">${I18n.t('widgets.nh_menu_desc', '4プラットフォーム未読')}</div>
                    </div>
                    <div class="widget-menu-item" onclick="Widgets.addWidget('mercari', this.closest('.modal-overlay'))">
                        <div class="widget-menu-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><path d="M5 8h14l-1.5 12h-11L5 8z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg></div>
                        <div class="widget-menu-name">${I18n.t('widgets.type_mercari', 'メルカリ新着')}</div>
                        <div class="widget-menu-desc">${I18n.t('widgets.mc_menu_desc', '新着出品をお知らせ')}</div>
                    </div>
                    <div class="widget-menu-item" onclick="Widgets.addWidget('note', this.closest('.modal-overlay'))">
                        <div class="widget-menu-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><path d="M4 5h16M4 12h16M4 19h10"/></svg></div>
                        <div class="widget-menu-name">${I18n.t('widgets.type_note', 'テキスト')}</div>
                        <div class="widget-menu-desc">${I18n.t('widgets.note_menu_desc', '壁紙に書く手帳メモ')}</div>
                    </div>
                    <div class="widget-menu-item" onclick="Widgets.addWidget('moonphase', this.closest('.modal-overlay'))">
                        <div class="widget-menu-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="width:22px;height:22px"><path d="M12 3a9 9 0 100 18 9 9 0 010-18z"/><path d="M12 3a9 9 0 010 18"/></svg></div>
                        <div class="widget-menu-name">${I18n.t('widgets.type_moonphase', '月相')}</div>
                        <div class="widget-menu-desc">${I18n.t('widgets.mp_menu_desc', '今夜の月・満月まで')}</div>
                    </div>
                    <div class="widget-menu-item" onclick="Widgets.addWidget('weather', this.closest('.modal-overlay'))">
                        <div class="widget-menu-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><path d="M7 17a4.5 4.5 0 01-.9-8.9A5.5 5.5 0 0117 6.6 4 4 0 0117 17H7z"/></svg></div>
                        <div class="widget-menu-name">${I18n.t('widgets.type_weather', '天気')}</div>
                        <div class="widget-menu-desc">${I18n.t('widgets.wx_menu_desc', 'テーマ連動の空模様')}</div>
                    </div>
                    <div class="widget-menu-item" onclick="Widgets.addWidget('duoframe', this.closest('.modal-overlay'))">
                        <div class="widget-menu-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="width:22px;height:22px"><circle cx="8.5" cy="12" r="4.5"/><circle cx="15.5" cy="12" r="4.5"/></svg></div>
                        <div class="widget-menu-name">${I18n.t('widgets.type_duoframe', 'ふたりフレーム')}</div>
                        <div class="widget-menu-desc">${I18n.t('widgets.df_menu_desc', '星の軌道でつなぐ2枚')}</div>
                    </div>
                    <div class="widget-menu-item" onclick="Widgets.addWidget('profile', this.closest('.modal-overlay'))">
                        <div class="widget-menu-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.3 18.3c1.1-2.7 3-4.1 5.7-4.1s4.6 1.4 5.7 4.1"/></svg></div>
                        <div class="widget-menu-name">${I18n.t('widgets.type_profile', 'プロフィールカード')}</div>
                        <div class="widget-menu-desc">${I18n.t('widgets.pf_menu_desc', '頭像・名前・ひとこと・生活写真')}</div>
                    </div>
                </div>
                <button onclick="this.closest('.modal-overlay').remove()"
                        style="width:100%;padding:10px;border:1px solid var(--border-medium);border-radius:8px;background:none;color:var(--text-primary);font-size:14px;cursor:pointer">取消</button>
            </div>`;
        document.body.appendChild(modal);
    },

    addWidget(type, modal) {
        if (!AppState.data.widgets) AppState.data.widgets = [];
        // 默认尺寸：clock 走 wide（横条更具表现力），photo/music/polaroid 走 small 方形（少女纸艺感），calendar/news 走 wide 条形（信息量大）
        // v2.212：moonphase/weather 恒为圆形（size 仍是 'small'，2×2 圆）；note 走 medium 两列
        // v2.249：duoframe 改走 wide 整行（原 medium 两列已随桌面网格重构退役），其余不变
        // v2.250：profile 走 small（经典布局默认；wide 三布局需用户手动切档，见 spec）
        const defaultSize = (type === 'photo' || type === 'music' || type === 'polaroid'
            || type === 'moonphase' || type === 'weather' || type === 'profile') ? 'small'
            : (type === 'note') ? 'medium' : 'wide';
        const w = {
            id: this._genId(),
            type,
            size: defaultSize,
            _sizeV2: true
        };
        if (type === 'moonphase' || type === 'weather') w.shape = 'circle';
        if (type === 'note') w.data = { text: '', style: 'plain', vertical: false, fontSize: 'm' };
        if (type === 'duoframe') w.data = { refA: null, refB: null };
        if (type === 'profile') w.data = this._pfDefaultData();
        if (type === 'music') w.data = { title: '', artist: '', coverUrl: '', audioSongId: '', audioUrl: '' };
        if (type === 'clock') w.data = { format24: true };
        if (type === 'polaroid') {
            w.tilt = (Math.random() * 4 - 2);
            w.caption = '';
        }
        if (type === 'charcard') {
            // T2：放宽——没有放送局立绘也允许添加，进编辑弹窗走「从相册上传」路径（refA 允许 null，
            // _renderCharCard 对 refA=null 已有占位「立絵未登録」，不 crash）
            const refs = (typeof Broadcast !== 'undefined' && Broadcast.getAllCharRefs) ? Broadcast.getAllCharRefs() : [];
            w.data = { mode: 'single', refA: refs.length ? { blobId: refs[0].blobId, name: refs[0].name } : null, refB: null, line: '' };
        }
        if (AppState.data.widgets.length >= 8) {
            alert('最多添加8个组件');
            if (modal) modal.remove();
            return;
        }
        AppState.data.widgets.push(w);
        this._save();
        // Add to desktop layout
        if (typeof DesktopRenderer !== 'undefined') {
            DesktopRenderer.addWidgetToLayout(w.id, w.size);
        }
        this.renderSettingsList();
        if (modal) modal.remove();
        if (type === 'charcard') this.editCharCard(w.id);   // 添加后立即开配置（spec 拍板）
    },

    deleteWidget(id) {
        if (!confirm('删除此组件？')) return;
        const arr = this._getWidgets();
        const idx = arr.findIndex(x => x.id === id);
        if (idx >= 0) {
            const wType = arr[idx].type;
            arr.splice(idx, 1);
            // review 修复（C2/D2）：charcard 自由上传的 blob 随组件删除从 IndexedDB 一并回收。
            // 组件已从数组移除 → kept 集为空 → 两个槽位键无条件清掉。
            if (wType === 'charcard') this._ccCleanupOrphanUploads(id);
            // profile card 自由上传的 blob 随组件删除一并回收（照 charcard 同一模式）
            if (wType === 'profile') this._pfCleanupOrphanUploads(id);
            // 清理 music widget 的 audio 实例（避免删除后还在后台播）
            if (this._musicAudios?.[id]) {
                const a = this._musicAudios[id];
                try { a.pause(); } catch (e) {}
                if (a.src && a.src.startsWith('blob:')) URL.revokeObjectURL(a.src);
                delete this._musicAudios[id];
            }
            if (this._musicNowPlaying) delete this._musicNowPlaying[id];
            // 清理 charcard 的 ObjectURL（避免删除后泄漏）
            if (this._charCardUrls[id]) {
                this._charCardUrls[id].forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} });
                delete this._charCardUrls[id];
            }
            // 清理莫比乌斯双人相册的 ObjectURL（T9，避免删除后泄漏）
            if (this._duoframeUrls[id]) {
                this._duoframeUrls[id].forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} });
                delete this._duoframeUrls[id];
            }
            // 清理 profile card 的 ObjectURL（避免删除后泄漏，照 charcard/duoframe 同一模式）
            if (this._pfUrls[id]) {
                this._pfUrls[id].forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} });
                delete this._pfUrls[id];
            }
            // 清理轮播 ObjectURL（B2）
            if (this._rotationUrls[id]) {
                this._rotationUrls[id].forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} });
                delete this._rotationUrls[id];
            }
            this._save();
            // Remove from desktop layout
            if (typeof DesktopRenderer !== 'undefined') {
                DesktopRenderer.removeWidgetFromLayout(id);
            }
            this.renderSettingsList();
        }
    },

    // ══════════════════════════════════════
    //  功能版 v2.192 共通地基 + 纯逻辑函数
    //  （_buildRotationPool / _pickRotation / _composeNewsItems /
    //    _pickNextSong / _latestListing / _collectUnreads 为纯函数，
    //    不碰 DOM / AppState，node tests/widgets-functional.test.js 直测）
    // ══════════════════════════════════════

    // B2：构建轮播池。illustrations = pixivData.illustrations、charRefs = Broadcast.getAllCharRefs() 形状
    _buildRotationPool(illustrations, charRefs, rotation) {
        const pool = [];
        if (!rotation || !rotation.enabled) return pool;
        if (rotation.srcFav) {
            (illustrations || []).filter(i => i && i.isFavorite).forEach(i =>
                pool.push({ kind: 'fav', blobKey: i.id, label: null }));
        }
        if (rotation.srcRefs) {
            const names = rotation.charNames || [];
            (charRefs || [])
                .filter(r => r && r.blobId && (!names.length || names.includes(r.name)))
                .forEach(r => pool.push({ kind: 'ref', blobKey: r.blobId, label: r.name }));
        }
        return pool;
    },

    // B3：情报列表合成——事件为主（调用方保证最新在前），不足 3 条用论坛帖补位
    _composeNewsItems(events, threads) {
        const items = (events || []).slice(0, 3).map(e => ({
            kind: 'event', type: e.type, source: e.source,
            title: (e.data && e.data.title) || '', ts: e.timestamp || 0
        }));
        for (const t of (threads || [])) {
            if (items.length >= 3) break;
            items.push({ kind: 'thread', title: (t && t.title) || '', replies: ((t && t.replies) || []).length });
        }
        return items;
    },

    // B2：抽一张。池 >1 时避开上一张（lastKey）；rand ∈ [0,1) 注入便于测试
    _pickRotation(pool, lastKey, rand) {
        if (!pool || !pool.length) return null;
        let candidates = pool;
        if (pool.length > 1 && lastKey) {
            const rest = pool.filter(p => p.blobKey !== lastKey);
            if (rest.length) candidates = rest;
        }
        const r = (rand !== undefined) ? rand : Math.random();
        return candidates[Math.min(candidates.length - 1, Math.floor(r * candidates.length))];
    },

    // B6：连播选下一首。songs = AppState.data.music.songs 形状；mode ∈ single|seq|shuffle；
    // 候选池 = stage done 且有 audioId（对齐 editMusic 下拉口径），createdAt 升序。返回 songId 或 null。
    _pickNextSong(songs, currentId, mode, rand) {
        const pool = (songs || []).filter(s => s && s.stage === 'done' && s.audioId)
            .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        if (!pool.length) return null;
        if (mode === 'single') return pool.some(s => s.id === currentId) ? currentId : pool[0].id;
        if (mode === 'shuffle') {
            if (pool.length === 1) return pool[0].id;
            const rest = pool.filter(s => s.id !== currentId);
            const r = (rand !== undefined) ? rand : Math.random();
            return rest[Math.min(rest.length - 1, Math.floor(r * rest.length))].id;
        }
        const idx = pool.findIndex(s => s.id === currentId);   // seq：找不到当前（-1）→ 从头
        return pool[(idx + 1) % pool.length].id;
    },

    // 定点重渲染单个 widget（不整桌面重建；壳由 desktop-edit.js _renderWidgetInGrid 创建）
    _rerenderWidgetInPlace(id) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) return;
        const cell = document.querySelector(`.desktop-grid-widget[data-widget-id="${id}"]`);
        if (!cell) return;
        cell.innerHTML = this._renderWidget(w);
    },

    // 回桌面时要刷数据的 widget 类型（B3/B4/B5 各任务往里 append）
    _REFRESH_ON_RETURN: ['news', 'notifhub', 'mercari', 'moonphase', 'weather'],

    // 回桌面钩子：app.js goTo('desktop') 时调。编辑模式中不动（拖图标不乱跳）
    onDesktopReturn() {
        if (typeof DesktopEdit !== 'undefined' && DesktopEdit.active) return;
        this._rotateAllPicks();
        this._getWidgets().forEach(w => {
            if (this._REFRESH_ON_RETURN.includes(w.type)) this._rerenderWidgetInPlace(w.id);
        });
    },

    // B2：给所有开启轮播的 photo/polaroid 抽新图。opts.rerender=false 时只抽不渲（init 首渲前用）
    _rotateAllPicks(opts) {
        this._getWidgets().forEach(w => {
            if ((w.type !== 'photo' && w.type !== 'polaroid') || !w.rotation || !w.rotation.enabled) return;
            const pool = this._buildRotationPool(
                (AppState.data.pixivData || {}).illustrations,
                (typeof Broadcast !== 'undefined' && Broadcast.getAllCharRefs) ? Broadcast.getAllCharRefs() : [],
                w.rotation
            );
            const pick = this._pickRotation(pool, w._rotPick && w._rotPick.blobKey);
            w._rotPick = pick;   // 随 saveData 落盘无害；blobKey 失效由水合兜底
            if (pick && w.type === 'polaroid' && !w.tiltManual) w.tilt = (Math.random() * 4 - 2);   // 换相纸重随机角度（用户手调过则不动）
            if (!opts || opts.rerender !== false) this._rerenderWidgetInPlace(w.id);
        });
    },

    _rotationUrls: {},   // widgetId → [ObjectURL]（重渲染前/删除时 revoke，防泄漏）

    _queueRotationHydration(id) {
        setTimeout(() => this._hydrateRotation(id), 0);
    },

    // 轮播水合：getBlob→createObjectURL→塞 img。blob 丢失（跨设备导入）→ 换一张重试，
    // 池子耗尽 → 回落手动 imageUrl，再没有 → 保留空态占位。
    // 注意：统一走 getBlob+revoke，不用 IllustGallery.getUrl（会话级缓存不 revoke，频繁换图会泄漏）。
    async _hydrateRotation(id) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) return;
        // revoke 旧 URL 放在 enabled 早退之前：轮播刚被禁用/池子刚清空时的残留调用
        // 也能把上一次水合的 ObjectURL 释放掉，不留到 deleteWidget/刷新页面才清（v2.193 修）
        (this._rotationUrls[id] || []).forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} });
        this._rotationUrls[id] = [];
        if (!w.rotation || !w.rotation.enabled) return;
        const pool = this._buildRotationPool(
            (AppState.data.pixivData || {}).illustrations,
            (typeof Broadcast !== 'undefined' && Broadcast.getAllCharRefs) ? Broadcast.getAllCharRefs() : [],
            w.rotation
        );
        let pick = w._rotPick;
        let remaining = pool.filter(p => pick && p.blobKey !== pick.blobKey);
        let tries = 0;
        while (pick && tries <= pool.length) {
            const blob = await IllustGallery.getBlob(pick.blobKey).catch(() => null);
            if (blob) {
                const el = document.querySelector(`[data-rot-widget="${id}"]`);
                if (!el) return;   // widget 已删/桌面已重渲染 → 不建 URL 不泄漏
                const url = URL.createObjectURL(blob);
                this._rotationUrls[id].push(url);
                el.innerHTML = `<img src="${url}" alt="">`;
                // 拍立得：抽中立绘时手写字换成角色名
                if (w.type === 'polaroid' && pick.kind === 'ref' && pick.label) {
                    const cap = el.closest('.widget-polaroid-j')?.querySelector('.pj-caption');
                    if (cap) { cap.textContent = pick.label; cap.classList.remove('pj-caption-placeholder'); }
                }
                return;
            }
            tries++;
            pick = this._pickRotation(remaining, pick && pick.blobKey);
            if (pick) { w._rotPick = pick; remaining = remaining.filter(p => p.blobKey !== pick.blobKey); }
        }
        // 池子全空/全丢 → 回落手动图
        const el = document.querySelector(`[data-rot-widget="${id}"]`);
        if (el && w.imageUrl && w.imageUrl.trim()) el.innerHTML = `<img src="${this._escAttr(w.imageUrl)}" alt="">`;
    },

    // B4：四平台未读汇总。data = AppState.data 形状的纯数据
    _collectUnreads(data) {
        data = data || {};
        const line = Object.values(data.chatMeta || {}).reduce((s, m) => s + ((m && m.unreadCount) || 0), 0);
        const t = data.twitterData || {};
        const twitter = (t.notifications || []).filter(n => n && !n.isRead).length
            + (t.inboxDms || []).filter(x => x && !x.isRead).length
            + (t.marshmallows || []).filter(m => m && !m.isRead).length;
        const dms = ((data.weiboData || {}).notifications || {}).dms || [];
        // !m._loading：排除微博 NPC 回复生成中的占位气泡（与 weibo.js renderNotif 的
        // _sweepDmLoadingOrphans 语义对齐），否则在途/落盘孤儿占位会计出幻影未读角标
        const weibo = dms.reduce((n, d) => n + ((d.messages || []).filter(m => m && !m._loading && m.from !== 'me' && (m.createdAt || 0) > (d.lastReadAt || 0)).length), 0);
        const ld = data.lofterData || {};
        const sevenDaysAgo = Date.now() - 7 * 86400000;
        const updatedAuthors = (ld.followedAuthorIds || []).filter(id =>
            (ld.articles || []).some(a => a && a.authorNpcId === id && (a.createdAt || 0) > sevenDaysAgo)).length;
        const lofter = (ld.myReadLaterArticleIds || []).length + updatedAuthors;
        return { line, twitter, weibo, lofter };
    },

    // ══════════════════════════════════════
    //  通知中心（v2.192 B4）：四平台未读横排图标，零配置，wide 恒定
    //  图标复用 APP_REGISTRY（desktop-edit.js 顶层 const 全局可见）；
    //  不带 data-app 属性 → customIcons 不覆盖（保平台辨识度，刻意为之）
    // ══════════════════════════════════════
    _renderNotifhub(w, sizeClass) {
        const u = this._collectUnreads(AppState.data);
        const reg = (typeof APP_REGISTRY !== 'undefined') ? APP_REGISTRY : {};
        const cell = (appId, platform, count) => {
            const app = reg[appId] || {};
            const badge = count > 0 ? `<span class="nh-badge">${count > 99 ? '99+' : count}</span>` : '';
            return `<div class="nh-icon" onclick="event.stopPropagation();Widgets._openUnread('${platform}')">
                <div class="app-icon ${app.iconClass || ''}">${app.svg || ''}</div>${badge}
            </div>`;
        };
        return `<div class="widget-card widget-wide widget-notifhub">
            ${cell('chat', 'line', u.line)}
            ${cell('twitter', 'twitter', u.twitter)}
            ${cell('weibo', 'weibo', u.weibo)}
            ${cell('lofter', 'lofter', u.lofter)}
        </div>`;
    },

    _openUnread(platform) {
        if (platform === 'line') { Line.show('talk'); return; }
        if (platform === 'twitter') { Navigation.goTo('twitter-notif'); return; }
        if (platform === 'weibo') { Weibo.openDmTab(); return; }
        if (platform === 'lofter') {
            Navigation.goTo('lofter');
            const ids = (AppState.data.lofterData || {}).myReadLaterArticleIds || [];
            if (ids.length && typeof Lofter !== 'undefined' && Lofter.openReadLaterSubScreen) Lofter.openReadLaterSubScreen();
        }
    },

    // B5：最新在售 listing——createdAtPlotId 最大者，并列取数组靠后（mercari 全程 push 追加，尾 = 新）
    _latestListing(listings) {
        let best = null;
        (listings || []).forEach(l => {
            if (!l || l.status !== 'on_sale') return;
            if (!best || (l.createdAtPlotId || 0) >= (best.createdAtPlotId || 0)) best = l;
        });
        return best;
    },

    // ══════════════════════════════════════
    //  メルカリ新着（v2.192 B5）：最新一件单条聚焦，wide 恒定。
    //  黄牛/假货照播不区分（真 mercari 不帮你鉴货——作者拍板）；listing 无 wall-clock 时间戳，不显示时间。
    //  已知可接受边界：被看过的最新件售罄退出在售池后，次新件顶上会再亮一次 NEW（市场状态变了，不算误报）。
    // ══════════════════════════════════════
    _renderMercariW(w, sizeClass) {
        const l = this._latestListing((AppState.data.mercariData || {}).listings);
        const d = w.data || {};
        const isNew = !!(l && l.id !== d.lastSeenListingId);
        const head = `<div class="mcw-head">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M5 8h14l-1.5 12h-11L5 8z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg>
            <span class="mcw-label">${I18n.t('widgets.mc_title', 'メルカリ新着')}</span>
            ${isNew ? '<span class="mcw-new">NEW</span>' : ''}
        </div>`;
        if (!l) {
            return `<div class="widget-card widget-wide widget-mercari" onclick="Widgets._openMercari('${w.id}')">
                ${head}<div class="mcw-empty">${I18n.t('widgets.mc_empty', '新着なし')}</div>
            </div>`;
        }
        const ge = (typeof Mercari !== 'undefined' && Mercari._goodsById) ? Mercari._goodsById(l.goodsEntryId) : null;
        const gname = (ge && ge.goods && ge.goods.name) || '';
        const variant = l.variantChar ? `（${l.variantChar}）` : '';
        const rating = l.sellerRating ? ' ' + I18n.t('mc.seller_rating_format', { stars: l.sellerRating.stars, count: l.sellerRating.count }) : '';
        return `<div class="widget-card widget-wide widget-mercari" onclick="Widgets._openMercari('${w.id}')">
            ${head}
            <div class="mcw-name">${this._esc(this._truncate(gname + variant, 22))}</div>
            <div class="mcw-row">
                <span class="mcw-price">¥${Number(l.price || 0).toLocaleString()}</span>
                <span class="mcw-seller">${this._esc(this._truncate(l.sellerName || '', 12))}${rating}</span>
            </div>
        </div>`;
    },

    _openMercari(widgetId) {
        const w = this._getWidgets().find(x => x.id === widgetId);
        if (w) {
            const l = this._latestListing((AppState.data.mercariData || {}).listings);
            w.data = w.data || {};
            if (l) w.data.lastSeenListingId = l.id;   // 高水位：点进去 = 看过了
            this._save();
        }
        Navigation.goTo('mercari');
    },

    // ── Utils ──
    // 收口：均转发 Utils.escapeHtml
    _esc(s) { return Utils.escapeHtml(s); },
    _escAttr(s) { return Utils.escapeHtml(s || ''); },
    _truncate(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }
};
