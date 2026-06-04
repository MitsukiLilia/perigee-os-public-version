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
            news: I18n.t('widgets.type_news')
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
        const caption = (w.caption || '').slice(0, 40);
        const hasImage = w.imageUrl && w.imageUrl.trim();
        const photoBox = hasImage
            ? `<img src="${this._escAttr(w.imageUrl)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
               <div class="pj-empty" style="display:none">＋</div>`
            : `<div class="pj-empty">＋</div>`;
        const captionHtml = caption
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
                    📁 从相册选择
                    <input type="file" accept="image/*" style="display:none"
                           onchange="Widgets._handlePolaroidUpload('${id}', this.files[0], this.closest('.modal-overlay'))">
                </label>
                <label style="font-size:12px;color:var(--text-secondary);margin-top:4px">手写体 caption（最多 40 字）</label>
                <input type="text" id="pjCaption" placeholder="今日のお気に入り…" maxlength="40"
                       value="${this._escAttr(w.caption || '')}"
                       style="width:100%;padding:10px 12px;border:1px solid var(--border-medium);border-radius:8px;font-family:var(--font-handwriting);font-size:16px;background:var(--bg-base);color:var(--text-primary)">
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
        const hasImage = w.imageUrl && w.imageUrl.trim();
        const photoBox = hasImage
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
                    📁 从相册选择
                    <input type="file" accept="image/*" style="display:none"
                           onchange="Widgets._handlePhotoUpload('${id}', this.files[0], this.closest('.modal-overlay'))">
                </label>
                <div style="display:flex;gap:8px;margin-top:4px">
                    <button onclick="this.closest('.modal-overlay').remove()"
                            style="flex:1;padding:10px;border:1px solid var(--border-medium);border-radius:8px;background:none;color:var(--text-primary);font-size:14px;cursor:pointer">取消</button>
                    <button onclick="Widgets._savePhotoUrl('${id}', this.closest('.modal-overlay'))"
                            style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--accent-color);color:#fff;font-size:14px;font-weight:600;cursor:pointer">确定</button>
                </div>
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
                label: ev.daysUntil === 0 ? `🎉 ${ev.name}` : `${ev.name} (${ev.daysUntil}日後)`,
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
                <span style="flex:1;font-size:14px">${ev.date} ${ev.name}</span>
                <button onclick="Widgets._deleteEvent(${i}, this.closest('.modal-overlay'))"
                        style="background:none;border:none;color:var(--accent-color);font-size:16px;cursor:pointer;padding:10px;min-width:44px;min-height:44px">✕</button>
            </div>`
        ).join('');

        modal.innerHTML = `
            <div class="modal-window" style="gap:12px">
                <h3 style="margin:0;font-size:17px;font-weight:600">📅 纪念日管理</h3>
                <div style="max-height:200px;overflow-y:auto">${listHtml || '<div style="font-size:13px;color:var(--text-tertiary);text-align:center;padding:16px">还没有纪念日</div>'}</div>
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
            color: colors[AppState.data.calendarEvents.length % colors.length]
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
        const dataKey = d.audioSongId ? `song:${d.audioSongId}` : `url:${d.audioUrl}`;

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
            audio.addEventListener('ended', () => this._updateMusicPlayState(id, false));
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
                <h3 style="margin:0;font-size:17px;font-weight:600">🎵 正在播放</h3>
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
            audioUrl: audioSongId ? '' : audioUrl  // 选了内置就清空 URL
        };

        // 音频源变了：销毁旧 audio 实例，下次 play 会重建
        if (this._musicAudios?.[id]) {
            const oldAudio = this._musicAudios[id];
            try { oldAudio.pause(); } catch (e) {}
            if (oldAudio.src && oldAudio.src.startsWith('blob:')) URL.revokeObjectURL(oldAudio.src);
            delete this._musicAudios[id];
        }

        this._save();
        this.render();
        modal.remove();
    },

    // ══════════════════════════════════════
    //  📢 情報速報組件
    // ══════════════════════════════════════
    _renderNews(w, sizeClass) {
        const forum = AppState.data.forumData || {};
        const threads = forum.threads || [];
        const latest = threads.slice(0, 3);
        const hasNew = threads.length > (w._lastCount || 0);

        const listHtml = latest.length > 0
            ? latest.map(t =>
                `<div class="widget-news-item">
                    <span class="widget-news-dot ${hasNew ? 'is-new' : ''}"></span>
                    <span class="widget-news-title">${this._esc(this._truncate(t.title || '', 20))}</span>
                    <span class="widget-news-count">${t.replies?.length || 0}</span>
                </div>`).join('')
            : `<div class="widget-news-empty">まだスレッドがありません</div>`;

        return `<div class="widget-card widget-medium widget-news"
                     onclick="Widgets._openForum()"
>
            <div class="widget-news-header">
                <span>📢</span>
                <span class="widget-news-label">掲示板速報</span>
                ${hasNew ? '<span class="widget-news-badge">NEW</span>' : ''}
            </div>
            <div class="widget-news-list">${listHtml}</div>
        </div>`;
    },

    _openForum() {
        Navigation.goTo('forum');
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
                        <div class="widget-menu-icon">⏰</div>
                        <div class="widget-menu-name">时钟</div>
                        <div class="widget-menu-desc">时间・日期・星期</div>
                    </div>
                    <div class="widget-menu-item" onclick="Widgets.addWidget('photo', this.closest('.modal-overlay'))">
                        <div class="widget-menu-icon">📸</div>
                        <div class="widget-menu-name">相册</div>
                        <div class="widget-menu-desc">展示喜欢的图片</div>
                    </div>
                    <div class="widget-menu-item" onclick="Widgets.addWidget('polaroid', this.closest('.modal-overlay'))">
                        <div class="widget-menu-icon">📷</div>
                        <div class="widget-menu-name">拍立得</div>
                        <div class="widget-menu-desc">微旋转 + 手写 caption</div>
                    </div>
                    <div class="widget-menu-item" onclick="Widgets.addWidget('calendar', this.closest('.modal-overlay'))">
                        <div class="widget-menu-icon">📅</div>
                        <div class="widget-menu-name">日历</div>
                        <div class="widget-menu-desc">角色纪念日</div>
                    </div>
                    <div class="widget-menu-item" onclick="Widgets.addWidget('music', this.closest('.modal-overlay'))">
                        <div class="widget-menu-icon">🎵</div>
                        <div class="widget-menu-name">音乐</div>
                        <div class="widget-menu-desc">正在播放</div>
                    </div>
                    <div class="widget-menu-item" onclick="Widgets.addWidget('news', this.closest('.modal-overlay'))">
                        <div class="widget-menu-icon">📢</div>
                        <div class="widget-menu-name">情报</div>
                        <div class="widget-menu-desc">论坛速報</div>
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
            this._save();
            // Remove from desktop layout
            if (typeof DesktopRenderer !== 'undefined') {
                DesktopRenderer.removeWidgetFromLayout(id);
            }
            this.renderSettingsList();
        }
    },

    // ── Utils ──
    _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },
    _escAttr(s) { return String(s || '').replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
    _truncate(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }
};
