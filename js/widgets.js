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

        // B2：启动先抽好轮播图，app.js 随后的 DesktopRenderer.render() 首渲直接用
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
            mercari: I18n.t('widgets.type_mercari', 'メルカリ新着')
        };
        const sizeLabels = {
            small: I18n.t('widgets.size_small'),
            medium: I18n.t('widgets.size_medium'),
            wide: I18n.t('widgets.size_wide')
        };

        container.innerHTML = widgets.map(w =>
            `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light)">
                <div>
                    <span style="font-size:14px">${typeLabels[w.type] || w.type}</span>
                    <span style="font-size:11px;color:var(--text-tertiary);margin-left:8px">${sizeLabels[w.size] || w.size}</span>
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

    _genId() {
        return 'w_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    },

    // ── 全体レンダリング（デスクトップは DesktopRenderer が担当、ここは設定用） ──
    render() {
        // Desktop rendering is now handled by DesktopRenderer
        if (typeof DesktopRenderer !== 'undefined') DesktopRenderer.render();
    },

    _renderWidget(w) {
        const sizeClass = `widget-${w.size || 'small'}`;
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
                ? `<img src="${this._escAttr(w.imageUrl)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                   <div class="pj-empty" style="display:none">＋</div>`
                : `<div class="pj-empty">＋</div>`;
        // 轮播抽中立绘 → caption 显示角色名（水合时替换）；抽中收藏 → 保留用户 caption
        const rotRefCap = rotActive && w._rotPick.kind === 'ref';
        const captionHtml = rotRefCap
            ? `<div class="pj-caption">${this._esc(w._rotPick.label || '')}</div>`
            : caption
                ? `<div class="pj-caption">${this._esc(caption)}</div>`
                : `<div class="pj-caption pj-caption-placeholder">タップして文字を…</div>`;
        // 顶部 washi 胶带装饰
        const tape = `<span class="pj-tape" aria-hidden="true"></span>`;
        return `<div class="widget-card ${sizeClass} widget-polaroid-j"
                     style="transform:rotate(${w.tilt.toFixed(2)}deg)"
                     onclick="Widgets.editPolaroidJ('${w.id}')">
            ${tape}
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
                <div style="display:flex;gap:8px;margin-top:4px">
                    <button onclick="Widgets._togglePolaroidJSize('${id}', this.closest('.modal-overlay'))"
                            style="flex:1;padding:8px;border:1px solid var(--border-light);border-radius:8px;background:none;color:var(--text-secondary);font-size:12px;cursor:pointer">
                        切换尺寸（当前：${ { small: '小', medium: '中', wide: '宽' }[w.size] || '小' } → 下一档）
                    </button>
                    <button onclick="Widgets._reshufflePolaroidTilt('${id}', this.closest('.modal-overlay'))"
                            style="flex:1;padding:8px;border:1px solid var(--border-light);border-radius:8px;background:none;color:var(--text-secondary);font-size:12px;cursor:pointer">
                        换个角度
                    </button>
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

    _togglePolaroidJSize(id, modal) {
        const w = this._getWidgets().find(x => x.id === id);
        if (w) {
            const order = ['small', 'medium', 'wide'];
            const idx = order.indexOf(w.size);
            w.size = order[(idx + 1) % order.length];
            this._save();
            if (typeof DesktopRenderer !== 'undefined') this._syncLayoutSpan(w.id, w.size);
            this.render();
        }
        if (modal) modal.remove();
    },

    _reshufflePolaroidTilt(id, modal) {
        const w = this._getWidgets().find(x => x.id === id);
        if (w) {
            w.tilt = (Math.random() * 6 - 3); // 换角度幅度大一些 -3° ~ 3°
            this._save();
            this.render();
        }
        // 不关闭 modal，让用户继续编辑
    },

    // ══════════════════════════════════════
    //  ⏰ 时钟组件（小方/宽条两档）
    //  ─ 时间/日期由 SystemConfig.startRealtimeUpdates 每秒刷新
    // ══════════════════════════════════════
    _renderClock(w, sizeClass) {
        const d = w.data || {};
        const f24 = d.format24 !== false; // default 24h

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
                        切换尺寸（当前：${w.size === 'wide' ? '宽横条 → 小方形' : '小方形 → 宽横条'}）
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
    //  📸 相册组件（小/中/宽三档，蝴蝶结装饰）
    // ══════════════════════════════════════
    _renderPhoto(w, sizeClass) {
        const rotActive = !!(w.rotation && w.rotation.enabled && w._rotPick);
        if (rotActive) this._queueRotationHydration(w.id);
        const hasImage = w.imageUrl && w.imageUrl.trim();
        const photoBox = rotActive
            ? `<div style="width:100%;height:100%" data-rot-widget="${w.id}"></div>`
            : hasImage
                ? `<img src="${this._escAttr(w.imageUrl)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                   <div class="polaroid-empty" style="display:none"><span>更换照片</span><span class="polaroid-plus">+</span></div>`
                : `<div class="polaroid-empty"><span>更换照片</span><span class="polaroid-plus">+</span></div>`;

        if (w.size === 'wide') {
            // 横向条：左蝴蝶结 + 中央照片按钮 + 右装饰
            return `<div class="widget-card ${sizeClass} widget-polaroid polaroid-wide"
                         onclick="Widgets.editPhoto('${w.id}')">
                ${this._bowSvg('polaroid-bow-deco')}
                <div class="polaroid-frame-wide">
                    <div class="polaroid-image polaroid-image-wide">${photoBox}</div>
                </div>
                ${this._sparkSvg('polaroid-spark spark-a')}
                ${this._sparkSvg('polaroid-spark spark-b')}
            </div>`;
        }

        if (w.size === 'medium') {
            // 中尺寸：2 列矩形，左照片右"记录美好 每一天"
            return `<div class="widget-card ${sizeClass} widget-polaroid polaroid-medium"
                         onclick="Widgets.editPhoto('${w.id}')">
                ${this._bowSvg('polaroid-bow-corner')}
                <div class="polaroid-frame">
                    <div class="polaroid-image">${photoBox}</div>
                </div>
                <div class="polaroid-tagline">
                    <span>记录美好</span>
                    <span>每一天</span>
                    ${this._heartSvg('polaroid-heart')}
                </div>
                ${this._sparkSvg('polaroid-spark spark-a')}
            </div>`;
        }

        // small：正方形，顶部蝴蝶结，中央照片
        return `<div class="widget-card ${sizeClass} widget-polaroid polaroid-small"
                     onclick="Widgets.editPhoto('${w.id}')">
            ${this._bowSvg('polaroid-bow-top')}
            <div class="polaroid-frame">
                <div class="polaroid-image">${photoBox}</div>
            </div>
            ${this._sparkSvg('polaroid-spark spark-a')}
            ${this._sparkSvg('polaroid-spark spark-b')}
        </div>`;
    },

    editPhoto(id) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) return;

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
                <div style="display:flex;gap:8px">
                    <button onclick="Widgets._togglePhotoSize('${id}', this.closest('.modal-overlay'))"
                            style="flex:1;padding:8px;border:1px solid var(--border-light);border-radius:8px;background:none;color:var(--text-secondary);font-size:12px;cursor:pointer">
                        切换尺寸（当前：${ { small: '小', medium: '中', wide: '宽' }[w.size] || '小' } → 下一档）
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
            // small → medium → wide → small 循环
            const order = ['small', 'medium', 'wide'];
            const idx = order.indexOf(w.size);
            w.size = order[(idx + 1) % order.length];
            this._save();
            // 布局里的 colSpan 也要同步更新
            if (typeof DesktopRenderer !== 'undefined') {
                this._syncLayoutSpan(w.id, w.size);
            }
            this.render();
        }
        if (modal) modal.remove();
    },

    // 同步 desktopLayout 里对应 widget 的 colSpan（尺寸切换后使用）
    _syncLayoutSpan(widgetId, size) {
        const layout = AppState.data.desktopLayout;
        if (!layout) return;
        const span = ({ small: 1, medium: 2, wide: 3 })[size] || 1;
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
        const now = new Date();
        const month = now.toLocaleDateString('ja-JP', { month: 'short' });
        const day = now.getDate();
        const weekday = now.toLocaleDateString('ja-JP', { weekday: 'short' });

        // 查找角色纪念日
        const events = this._getUpcomingEvents();
        const eventHtml = events.length > 0
            ? events.slice(0, 2).map(ev =>
                `<div class="widget-cal-event">
                    <span class="widget-cal-dot" style="background:${ev.color}"></span>
                    <span>${ev.label}</span>
                </div>`).join('')
            : `<div class="widget-cal-event" style="opacity:0.5">予定なし</div>`;

        return `<div class="widget-card ${sizeClass} widget-calendar"
                     onclick="Widgets.editCalendar('${w.id}')"
>
            <div class="widget-cal-header">
                <div class="widget-cal-month">${month}</div>
                <div class="widget-cal-weekday">${weekday}</div>
            </div>
            <div class="widget-cal-day">${day}</div>
            <div class="widget-cal-events">${eventHtml}</div>
        </div>`;
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
                    const refs = (typeof Broadcast !== 'undefined' && Broadcast.getAllCharRefs) ? Broadcast.getAllCharRefs() : [];
                    const names = [...new Set(refs.map(r => (r.name || '').trim()).filter(Boolean))];
                    const cp = (AppState.data.broadcast && AppState.data.broadcast.cpSettings) || {};
                    const cpA = (cp.cpCharA || '').trim(), cpB = (cp.cpCharB || '').trim();
                    if (!names.length && !(cpA && cpB)) return '';   // 注册表空 → 快捷行整体隐藏，回到纯手填
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

    // ══════════════════════════════════════
    //  🎵 音乐组件（小/中方形+宽横条，蝴蝶结+黑胶+进度条+控件）
    // ══════════════════════════════════════
    _renderMusic(w, sizeClass) {
        const d = w.data || {};
        const hasCover = d.coverUrl && d.coverUrl.trim();
        const accentColor = d.color || 'var(--accent-color)';
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
                        切换尺寸（当前：${w.size === 'wide' ? '宽横条 → 小方形' : '小方形 → 宽横条'}）
                    </button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    },

    _toggleMusicSize(id, modal) {
        const w = this._getWidgets().find(x => x.id === id);
        if (w) {
            // 黑胶只在小方形 ↔ 宽横条之间切换（中尺寸的 2:1 矩形放不下圆形黑胶）
            w.size = w.size === 'wide' ? 'small' : 'wide';
            this._save();
            if (typeof DesktopRenderer !== 'undefined') {
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

        return `<div class="widget-card widget-medium widget-news"
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
            el.innerHTML = `<img src="${url}" alt="">`;
        }
    },

    // 配置弹窗：点卡片本体打开（对齐 editPhoto 交互）。模式/角色A/角色B/台词。
    editCharCard(id) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) return;
        const refs = (typeof Broadcast !== 'undefined' && Broadcast.getAllCharRefs) ? Broadcast.getAllCharRefs() : [];
        const d = w.data || {};
        const esc = s => this._escAttr(s || '');
        const optionsHtml = sel => refs.map(r =>
            `<option value="${esc(r.blobId)}" ${r.blobId === sel ? 'selected' : ''}>${Utils.escapeHtml(r.name || '?')}</option>`).join('');
        const isDuo = d.mode === 'duo';
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
        modal.onclick = e => { if (e.target === modal) modal.remove(); };
        const rowStyle = 'width:100%;padding:10px 12px;border:1px solid var(--border-medium);border-radius:8px;font-size:14px;background:var(--bg-base);color:var(--text-primary)';
        modal.innerHTML = `
            <div class="modal-window" style="gap:12px">
                <h3 style="margin:0;font-size:17px;font-weight:600">${I18n.t('widgets.cc_edit_title', '编辑立绘卡')}</h3>
                <select id="ccMode" style="${rowStyle}"
                        onchange="document.getElementById('ccRefBRow').style.display=this.value==='duo'?'block':'none';document.getElementById('ccLineRow').style.display=this.value==='duo'?'none':'block'">
                    <option value="single" ${isDuo ? '' : 'selected'}>${I18n.t('widgets.cc_mode_single', '单人')}</option>
                    <option value="duo" ${isDuo ? 'selected' : ''}>${I18n.t('widgets.cc_mode_duo', '双人')}</option>
                </select>
                <select id="ccRefA" style="${rowStyle}">${optionsHtml(d.refA && d.refA.blobId)}</select>
                <div id="ccRefBRow" style="display:${isDuo ? 'block' : 'none'}">
                    <select id="ccRefB" style="${rowStyle}">${optionsHtml((d.refB && d.refB.blobId) || (refs[1] && refs[1].blobId))}</select>
                </div>
                <div id="ccLineRow" style="display:${isDuo ? 'none' : 'block'}">
                    <input type="text" id="ccLine" maxlength="30" placeholder="${I18n.t('widgets.cc_line_ph', '一句台词（可空）')}"
                           value="${esc(d.line)}" style="${rowStyle}">
                </div>
                <div style="display:flex;gap:8px;margin-top:4px">
                    <button onclick="this.closest('.modal-overlay').remove()"
                            style="flex:1;padding:10px;border:1px solid var(--border-medium);border-radius:8px;background:none;color:var(--text-primary);font-size:14px;cursor:pointer">${I18n.t('btn.cancel', '取消')}</button>
                    <button onclick="Widgets._saveCharCard('${w.id}', this.closest('.modal-overlay'))"
                            style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--accent-color);color:#fff;font-size:14px;font-weight:600;cursor:pointer">${I18n.t('btn.confirm', '确定')}</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    },

    _saveCharCard(id, modal) {
        const w = this._getWidgets().find(x => x.id === id);
        if (!w) { modal.remove(); return; }
        const refs = (typeof Broadcast !== 'undefined' && Broadcast.getAllCharRefs) ? Broadcast.getAllCharRefs() : [];
        const pick = blobId => {
            const r = refs.find(x => x.blobId === blobId);
            return r ? { blobId: r.blobId, name: r.name } : null;
        };
        const mode = modal.querySelector('#ccMode').value;
        const refA = pick(modal.querySelector('#ccRefA').value) || (w.data && w.data.refA);
        const refB = mode === 'duo' ? pick(modal.querySelector('#ccRefB').value) : null;
        const line = (modal.querySelector('#ccLine').value || '').trim().slice(0, 30);
        w.data = { mode: (mode === 'duo' && refB) ? 'duo' : 'single', refA, refB, line };
        this._save();
        this.render();
        modal.remove();
    },

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
                </div>
                <button onclick="this.closest('.modal-overlay').remove()"
                        style="width:100%;padding:10px;border:1px solid var(--border-medium);border-radius:8px;background:none;color:var(--text-primary);font-size:14px;cursor:pointer">取消</button>
            </div>`;
        document.body.appendChild(modal);
    },

    addWidget(type, modal) {
        if (!AppState.data.widgets) AppState.data.widgets = [];
        // 默认尺寸：clock 走 wide（横条更具表现力），photo/music/polaroid 走 small 方形（少女纸艺感），calendar/news 走 wide 条形（信息量大）
        const defaultSize = (type === 'photo' || type === 'music' || type === 'polaroid') ? 'small' : 'wide';
        const w = {
            id: this._genId(),
            type,
            size: defaultSize,
            _sizeV2: true
        };
        if (type === 'music') w.data = { title: '', artist: '', coverUrl: '', audioSongId: '', audioUrl: '' };
        if (type === 'clock') w.data = { format24: true };
        if (type === 'polaroid') {
            w.tilt = (Math.random() * 4 - 2);
            w.caption = '';
        }
        if (type === 'charcard') {
            const refs = (typeof Broadcast !== 'undefined' && Broadcast.getAllCharRefs) ? Broadcast.getAllCharRefs() : [];
            if (!refs.length) {
                Utils.showToast(I18n.t('widgets.cc_need_refs', '先去放送局登记角色立绘'));
                if (modal) modal.remove();
                return;
            }
            w.data = { mode: 'single', refA: { blobId: refs[0].blobId, name: refs[0].name }, refB: null, line: '' };
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
            arr.splice(idx, 1);
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
    _REFRESH_ON_RETURN: ['news', 'notifhub', 'mercari'],

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
            if (pick && w.type === 'polaroid') w.tilt = (Math.random() * 4 - 2);   // 换相纸重随机角度
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
