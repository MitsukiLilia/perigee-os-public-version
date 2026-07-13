// forum-plot.js — 从 js/forum.js 纯搬运拆出（v2.203.0）。
// 内容零改动；加载顺序：forum.js → generate → npc → goods → plot → tools（见 index.html）。
Object.assign(Forum, {
    // ===== 剧情进展 =====
    showPlotModal() {
        this.editingPlotId = null;
        document.getElementById('plotTitle').value = '';
        document.getElementById('plotContent').value = '';
        document.getElementById('plotModal').classList.add('active');
    },

    addPlotEntry() {
        const title = document.getElementById('plotTitle').value.trim();
        const content = document.getElementById('plotContent').value.trim();
        if (!title || !content) { Utils.showToast(I18n.t('t.forum_title_content_required', '标题和内容不能为空')); return; }

        const data = AppState.data.forumData;
        if (!AppState.data.broadcast.plotProgress) AppState.data.broadcast.plotProgress = [];

        if (this.editingPlotId) {
            // 编辑模式
            const plot = AppState.data.broadcast.plotProgress.find(p => p.id === this.editingPlotId);
            if (plot) {
                plot.title = title;
                plot.content = content;
            }
            this.editingPlotId = null;
            Utils.saveData();
            document.getElementById('plotModal').classList.remove('active');
            this.renderPlotList();
            Utils.showToast(I18n.t('t.forum_plot_updated', '✓ 剧情已更新'));
        } else {
            // 新增模式
            AppState.data.broadcast.plotProgress.push({
                id: Utils.generateId(),
                title: title,
                content: content,
                timestamp: Date.now()
            });

            // 周边预告自动发售：有 pendingRelease=true 的 goods 条目自动升级为发售状态
            const pendingGoods = (AppState.data.broadcast.officialInfo || []).filter(e => e.pendingRelease && e.category === 'goods');
            if (pendingGoods.length > 0) {
                const newPlot = AppState.data.broadcast.plotProgress[AppState.data.broadcast.plotProgress.length - 1];
                pendingGoods.forEach(goods => {
                    // 原「预告 / 受注中」条目保留，pendingRelease 置 false；其 goods.status 不变（历史记录）
                    goods.pendingRelease = false;
                    const releaseEntry = {
                        id: Utils.generateId(),
                        title: `【発売】${goods.title || goods.content.slice(0, 15)} `,
                        content: `${goods.content} \n（正式発売！商品の発送が始まっています。）`,
                        category: 'goods',
                        afterPlotId: newPlot.id,
                        sourceNpcId: goods.sourceNpcId || null,
                        sourceNpcIds: goods.sourceNpcIds || [],
                        timestamp: Date.now() + 1,
                        isGoodsRelease: true
                    };
                    // 结构化周边：発売条目继承原 goods 块，status 设为「贩售中」
                    // sourceGoodsId：关联原条目，让商品图在「预告/受注中 ↔ 発売副本」间同步（见 _generateGoodsImage / _linkedGoodsEntries）
                    if (goods.goods) {
                        releaseEntry.goods = { ...goods.goods, status: '贩售中', sourceGoodsId: goods.id };
                    }
                    AppState.data.broadcast.officialInfo.push(releaseEntry);

                    // 周边正式入市 → 上事件总线（v2.192 B3；source 用 mercari = 点击直达市场）
                    Utils.emitEvent('goods_announced', 'mercari', {
                        title: (releaseEntry.goods && releaseEntry.goods.name) || goods.title || '',
                        summary: '正式発売開始'
                    });
                });
            }

            Utils.saveData();
            Utils.emitEvent('plot_published', 'forum', { title: title, summary: content.slice(0, 80) });

            // メロンブックス商品ステータス連動
            const newPlotId = AppState.data.broadcast.plotProgress[AppState.data.broadcast.plotProgress.length - 1].id;
            if (typeof Melonbooks !== 'undefined' && Melonbooks.onPlotPublished) {
                Melonbooks.onPlotPublished(newPlotId);
            }
            if (typeof Mercari !== 'undefined' && Mercari.onPlotPublished) Mercari.onPlotPublished(newPlotId);
            if (typeof Wandoro !== 'undefined' && Wandoro.onPlotPublished) Wandoro.onPlotPublished(newPlotId);   // v2.129.0 完結前：一话起一轮 ワンドロ（抽到 wandoro.js、缺失则 no-op）

            document.getElementById('plotModal').classList.remove('active');
            this.renderPlotList();
            Utils.showToast(pendingGoods.length > 0
                ? I18n.t('t.forum_plot_added_goods', { n: pendingGoods.length })
                : I18n.t('t.forum_plot_added', '✓ 剧情已添加'));

            // 周边快速入口提示
            this._showGoodsQuickBanner();

            // 日本同人圈自动生成 — pixiv 独立开关（fire-and-forget，不阻塞论坛操作）
            if (AppState.data.pixivData?.settings?.autoGenOnNewPlot) {
                const genCount = Math.max(1, Math.min(5, AppState.data.pixivData.settings.autoGenCount || 1));
                setTimeout(async () => {
                    for (let _gi = 0; _gi < genCount; _gi++) {
                        await PixivNovel.autoGenerateNovel().catch(e => console.warn('[AutoGen]', e));
                    }
                }, 300);
            }

            // v2.73.6: 中文同人圈自动生成 — 微博 + lofter 共享 lofter 开关、跟 pixiv 完全解绑
            // 把本次新增剧情的 title + content 传给 weibo 作 recentPlotSummary（之前永远传空串）
            if (typeof Lofter !== 'undefined' && AppState.data.lofterData?.settings?.autoGenOnNewPlot) {
                const plotSummary = `${title} — ${content.slice(0, 120)}`;
                if (typeof Weibo !== 'undefined' && AppState.data.weiboData) {
                    const wbCount = AppState.data.weiboData.autoGenWeiboCount || 4;
                    setTimeout(() => {
                        Weibo._generateNpcWeibos(wbCount, plotSummary).catch(e => console.warn('[Weibo autoGen]', e));
                        Weibo._maybeSeedHotsearch(plotSummary).catch(e => console.warn('[Weibo hotsearch]', e));
                    }, 500);
                }
                const lofCount = Math.max(1, Math.min(5, AppState.data.lofterData.settings.autoGenCount || 2));
                setTimeout(() => Lofter._autoGenerateOnPlot(lofCount).catch(e => console.warn('[Lofter autoGen]', e)), 700);
            }
        }
    },

    editPlotEntry(plotId) {
        const data = AppState.data.forumData;
        const plot = (AppState.data.broadcast.plotProgress || []).find(p => p.id === plotId);
        if (!plot) return;

        this.editingPlotId = plotId;
        document.getElementById('plotTitle').value = plot.title;
        document.getElementById('plotContent').value = plot.content;
        document.getElementById('plotModal').classList.add('active');
    },

    deletePlotEntry(plotId) {
        const data = AppState.data.forumData;
        AppState.data.broadcast.plotProgress = (AppState.data.broadcast.plotProgress || []).filter(p => p.id !== plotId);
        Utils.saveData();
        this.renderPlotList();
    },

    renderPlotList() {
        const container = document.getElementById('plotProgressList');
        if (!container) return;
        const plots = AppState.data.broadcast.plotProgress || [];
        const mergedSummaries = AppState.data.broadcast.mergedSummaries || [];
        const plotSummaries = AppState.data.broadcast.plotSummaries || []; // 兼容旧数据
        const coveredSet = new Set([
            ...mergedSummaries.flatMap(s => s.coveredPlotIds || []),
            ...plotSummaries.flatMap(s => s.coveredIds || [])
        ]);

        if (plots.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-text">${I18n.t('bc.plot_empty')}</div><div class="empty-state-hint">${I18n.t('bc.plot_empty_hint')}</div></div>`;
            return;
        }

        const _esc = s => Utils.escapeHtml(s || '');
        const _ended = !!AppState.data.broadcast.seriesEnded;   // v2.126.0 完結フラグ（ワンドロ ペース切替）
        const _finaleRow = `<div class="plot-finale-row">
            <span class="plot-finale-label">${I18n.t('bc.series_finale', '完結済み')}</span>
            <button class="plot-finale-toggle${_ended ? ' on' : ''}" onclick="Forum.toggleSeriesEnded()" role="switch" aria-checked="${_ended}"><span class="plot-finale-knob"></span></button>
            <span class="plot-finale-hint">${_ended ? I18n.t('bc.series_finale_on_hint', '完結後ペース：ワンドロは時間で進行') : I18n.t('bc.series_finale_off_hint', '完結したらONに（ワンドロが時間ペースに）')}</span>
        </div>`;
        container.innerHTML = _finaleRow + plots.map((p, i) => {
            const preview = _esc(p.content.slice(0, 60));
            const isCovered = coveredSet.has(p.id);
            return `
    <div class="plot-entry${isCovered ? ' plot-entry-covered' : ''}">
                    <div class="plot-entry-header">
                        <span class="plot-entry-num">#${i + 1}</span>
                        ${isCovered ? `<span class="plot-summary-badge">${I18n.t('bc.plot_summarized')}</span>` : ''}
                        <span class="plot-entry-title">${_esc(p.title)}</span>
                        <button class="plot-entry-edit" onclick="event.stopPropagation(); Forum.editPlotEntry('${p.id}')">✎</button>
                        <button class="plot-entry-del" onclick="event.stopPropagation(); Forum.deletePlotEntry('${p.id}')">×</button>
                    </div>
                    <div class="plot-entry-preview">${preview}${p.content.length > 60 ? '...' : ''}</div>
                </div> `;
        }).join('');
    },

    // v2.126.0 完結トグル（放送局）：完結後 ワンドロ を時間ペースに切替（broadcast.seriesEnded）
    toggleSeriesEnded() {
        if (!AppState.data.broadcast) return;
        AppState.data.broadcast.seriesEnded = !AppState.data.broadcast.seriesEnded;
        Utils.saveData();
        this.renderPlotList();
        Utils.showToast(AppState.data.broadcast.seriesEnded
            ? I18n.t('bc.series_finale_set', '✓ 完結済みにしました')
            : I18n.t('bc.series_finale_unset', '✓ 連載中に戻しました'));
    },

    // ===== 合并总结管理 =====

    // v2.136.0: showSummaryModal / closeSummaryModal 已移除——总结管理从弹窗下放为放送局「总结」Tab 的一级内容，
    // 切 tab 即由 Broadcast._initSummaryTab() 重置 _summaryPreviewData 并调用 _renderSummaryModal() 直接渲染。

    // 计算下一期总结将覆盖的范围
    _calcNextSummaryScope(untilPlotId) {
        const data = AppState.data.forumData;
        const plots = AppState.data.broadcast.plotProgress || [];
        const infos = AppState.data.broadcast.officialInfo || [];
        const mergedSummaries = AppState.data.broadcast.mergedSummaries || [];
        const plotSummaries = AppState.data.broadcast.plotSummaries || [];

        const coveredPlotIds = new Set([
            ...mergedSummaries.flatMap(s => s.coveredPlotIds || []),
            ...plotSummaries.flatMap(s => s.coveredIds || [])
        ]);
        const coveredInfoIds = new Set([
            ...mergedSummaries.flatMap(s => s?.coveredInfoIds || []),
            ...(AppState.data.broadcast.officialSummaries || []).flatMap(s => s.coveredIds || [])
        ]);

        // 未总结的剧情列表（按原顺序）
        const uncoveredPlots = plots.filter(p => !coveredPlotIds.has(p.id));

        // 找到目标 plot 的位置（含）
        const targetIdx = uncoveredPlots.findIndex(p => p.id === untilPlotId);
        if (targetIdx < 0) return null;

        const toSummarizePlots = uncoveredPlots.slice(0, targetIdx + 1);
        const toSummarizePlotIds = new Set(toSummarizePlots.map(p => p.id));

        // 关联的官方情报：afterPlotId 在选中剧情中，且未总结
        const relatedInfos = infos.filter(e =>
            !coveredInfoIds.has(e.id) && e.afterPlotId && toSummarizePlotIds.has(e.afterPlotId)
        );
        // afterPlotId 为空 且未总结 且是第一批 → 纳入（方案A）
        const prePlotInfos = (mergedSummaries.length === 0 && plotSummaries.length === 0)
            ? infos.filter(e => !coveredInfoIds.has(e.id) && !e.afterPlotId)
            : [];

        return {
            plots: toSummarizePlots,
            infos: [...prePlotInfos, ...relatedInfos]
        };
    },

    // 动态渲染 modal 内容
    _renderSummaryModal() {
        const data = AppState.data.forumData;
        const mergedSummaries = AppState.data.broadcast.mergedSummaries || [];
        // 旧字段兼容展示
        const legacySummaries = [
            ...(AppState.data.broadcast.plotSummaries || []).map(s => ({ ...s, _legacy: 'plot' })),
            ...(AppState.data.broadcast.officialSummaries || []).map(s => ({ ...s, _legacy: 'official' }))
        ];

        const coveredPlotIds = new Set([
            ...mergedSummaries.flatMap(s => s.coveredPlotIds || []),
            ...(AppState.data.broadcast.plotSummaries || []).flatMap(s => s.coveredIds || [])
        ]);
        const uncoveredPlots = (AppState.data.broadcast.plotProgress || []).filter(p => !coveredPlotIds.has(p.id));

        const _esc = s => this._escapeHtml(s);

        let html = '';

        // ── 已有合并总结列表 ──
        const allSummaries = [...mergedSummaries, ...legacySummaries];
        if (allSummaries.length > 0) {
            allSummaries.forEach((s, i) => {
                const isLegacy = !!s._legacy;
                const titleList = (s.titleIndex || []).map(t => _esc(t)).join('、') ||
                    I18n.t('forum.summary_range_count', { n: (s.coveredPlotIds || s.coveredIds || []).length });
                const preview = _esc(s.content.slice(0, 60)) + (s.content.length > 60 ? '…' : '');
                const periodLabel = I18n.t('forum.summary_period_num', { n: i + 1 });
                const label = isLegacy
                    ? `${I18n.t('forum.summary_legacy_prefix', { kind: s._legacy === 'plot' ? I18n.t('forum.summary_legacy_plot', '剧情') : I18n.t('forum.summary_legacy_official', '情报') })} ${periodLabel}`
                    : periodLabel;
                html += `
                <div class="summary-list-item">
                    <div class="summary-list-header">
                        <span class="summary-list-label">${label}</span>
                        <span class="summary-list-range">${titleList}</span>
                        <div style="display:flex;gap:6px;flex-shrink:0;">
                            <button class="glass-btn small" onclick="Forum._toggleSummaryEdit('${s.id}')">${I18n.t('forum.summary_edit', '编辑')}</button>
                            <button class="glass-btn small danger" onclick="Forum._deleteSummaryItem('${s.id}','${s._legacy || ''}')">${I18n.t('forum.summary_delete', '删除')}</button>
                        </div>
                    </div>
                    <div id="summaryPreview_${s.id}" class="summary-list-preview">${preview}</div>
                    <div id="summaryEditArea_${s.id}" style="display:none; margin-top:6px;">
                        <textarea rows="6" id="summaryEditTA_${s.id}" style="width:100%;box-sizing:border-box;font-size:13px;resize:vertical;">${_esc(s.content)}</textarea>
                        <button class="glass-btn primary" style="width:100%;margin-top:6px;" onclick="Forum._saveSummaryItem('${s.id}','${s._legacy || ''}')">${I18n.t('forum.summary_save_changes', '保存修改')}</button>
                    </div>
                </div>`;
            });
            if (uncoveredPlots.length > 0) {
                html += `<div style="margin:12px 0 8px;border-top:1px solid var(--border-color);padding-top:10px;font-size:12px;color:var(--text-secondary);">${I18n.t('forum.summary_continue_next', '继续总结下一批：')}</div>`;
            }
        }

        // ── 生成新总结区 ──
        if (uncoveredPlots.length > 0 && !this._summaryPreviewData) {
            // 下拉选择"总结到哪集"
            const optHtml = uncoveredPlots.map(p =>
                `<option value="${p.id}">${_esc(p.title)}</option>`
            ).join('');
            html += `
            <div>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
                    <span style="font-size:14px;white-space:nowrap;">${I18n.t('forum.summary_until_label', '总结到')}</span>
                    <select id="summaryUntilSelect" style="flex:1;min-width:120px;" onchange="Forum._previewSummaryScope()">
                        ${optHtml}
                    </select>
                </div>
                <div id="summaryScopeHint" style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;"></div>
                <button id="summaryGenerateBtn" class="glass-btn primary" style="width:100%;display:inline-flex;align-items:center;justify-content:center;gap:6px;" onclick="Forum.doGenerateSummary()"><svg style="width:16px;height:16px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z"/></svg><span class="fch-svg-label">${I18n.t('forum.summary_gen_btn', { n: allSummaries.length + 1 })}</span></button>
            </div>`;
        } else if (uncoveredPlots.length === 0 && allSummaries.length > 0 && !this._summaryPreviewData) {
            html += `<p style="font-size:13px;color:var(--text-secondary);margin-top:8px;">${I18n.t('forum.summary_all_done', '✅ 所有剧情已总结完毕。')}</p>`;
        } else if ((AppState.data.broadcast.plotProgress || []).length === 0 && !this._summaryPreviewData) {
            html += `<p style="font-size:13px;color:var(--text-secondary);">${I18n.t('forum.summary_no_plot', '暂无剧情可总结。')}</p>`;
        }

        // ── AI生成预览区（待确认）──
        if (this._summaryPreviewData) {
            const pd = this._summaryPreviewData;
            const rangeHint = [
                pd.plotTitles.length ? I18n.t('forum.summary_plot_titles', { titles: pd.plotTitles.map(t => _esc(t)).join('、') }) : '',
                pd.infoTitles.length ? I18n.t('forum.summary_info_count', { n: pd.infoTitles.length }) : ''
            ].filter(Boolean).join('；');
            html += `
            <div style="border-top:1px solid var(--border-color);padding-top:12px;margin-top:4px;">
                <div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">${I18n.t('forum.summary_preview_hint', { n: allSummaries.length + 1 })}</div>
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">${rangeHint}</div>
                <textarea id="summaryPreviewContent" rows="8" style="width:100%;box-sizing:border-box;resize:vertical;font-size:13px;">${_esc(pd.content)}</textarea>
                <div style="display:flex;gap:8px;margin-top:8px;">
                    <button class="glass-btn" style="flex:1;" onclick="Forum.reGenerateSummary()">${I18n.t('forum.summary_regenerate', '重新生成')}</button>
                    <button class="glass-btn primary" style="flex:1;" onclick="Forum.confirmSaveSummary()">${I18n.t('forum.summary_confirm_save', '确认保存')}</button>
                </div>
            </div>`;
        }

        document.getElementById('summaryModalBody').innerHTML = html;

        // 初始化 scope hint
        if (uncoveredPlots.length > 0 && !this._summaryPreviewData) {
            this._previewSummaryScope();
        }
    },

    // 预览选中"总结到X集"时会覆盖哪些内容
    _previewSummaryScope() {
        const sel = document.getElementById('summaryUntilSelect');
        const hintEl = document.getElementById('summaryScopeHint');
        if (!sel || !hintEl) return;
        const scope = this._calcNextSummaryScope(sel.value);
        if (!scope) { hintEl.textContent = ''; return; }
        const parts = [I18n.t('forum.summary_plots_n', { n: scope.plots.length })];
        if (scope.infos.length > 0) parts.push(I18n.t('forum.summary_infos_n', { n: scope.infos.length }));
        hintEl.textContent = I18n.t('forum.summary_scope_hint', { parts: parts.join(' + ') });
    },

    async doGenerateSummary() {
        const sel = document.getElementById('summaryUntilSelect');
        if (!sel) return;
        const untilPlotId = sel.value;
        const scope = this._calcNextSummaryScope(untilPlotId);
        if (!scope || scope.plots.length === 0) { Utils.showToast(I18n.t('t.forum_select_summary_scope', '请选择总结范围')); return; }

        const btn = document.getElementById('summaryGenerateBtn');
        if (btn) { const _sumLbl = btn.querySelector('.fch-svg-label'); if (_sumLbl) _sumLbl.textContent = I18n.t('forum.summary_generating', '生成中...'); else btn.textContent = I18n.t('forum.summary_generating', '生成中...'); btn.disabled = true; }

        try {
            const data = AppState.data.forumData;

            // 基础世界观（不调用 getWorldContext 避免泄露全量内容）
            let baseContext = '';
            if (AppState.data.broadcast.worldSetting) baseContext += `【世界观设定】\n${AppState.data.broadcast.worldSetting}\n\n`;
            const _sumWbIds = Utils.getActiveWorldBookIds();
            _sumWbIds.forEach(wbId => {
                const book = (AppState.data.worldBooks || []).find(b => b.id === wbId);
                if (book && book.entries) {
                    baseContext += `【世界书「${book.name}」】\n`;
                    book.entries.filter(e => e.enabled !== false).forEach(e => { baseContext += `[${e.title}] ${e.content}\n`; });
                    baseContext += '\n';
                }
            });

            // 构建待总结内容（剧情 + 关联情报交织）
            let contentToSummarize = '';
            const plotTitles = [];
            const infoTitles = [];
            const infosByPlot = {};
            scope.infos.forEach(e => {
                const key = e.afterPlotId || '__pre__';
                if (!infosByPlot[key]) infosByPlot[key] = [];
                infosByPlot[key].push(e);
            });

            // 剧情开始前的情报
            if (infosByPlot['__pre__']) {
                contentToSummarize += `── 剧情开始前的官方情报 ──\n`;
                infosByPlot['__pre__'].forEach(e => {
                    const cat = OFFICIAL_CATEGORIES[e.category] || { label: e.category };
                    const title = e.title || e.content.slice(0, 20);
                    contentToSummarize += `[${cat.labelJa || cat.label}]《${title}》\n${e.content}\n\n`;
                    infoTitles.push(title);
                });
            }

            // 剧情条目 + 其后情报
            scope.plots.forEach((p, i) => {
                plotTitles.push(p.title);
                contentToSummarize += `【${p.title}】\n${p.content}\n\n`;
                if (infosByPlot[p.id]) {
                    infosByPlot[p.id].forEach(e => {
                        const cat = OFFICIAL_CATEGORIES[e.category] || { label: e.category };
                        const title = e.title || e.content.slice(0, 20);
                        contentToSummarize += `  ↳ [${cat.labelJa || cat.label}]《${title}》（${p.title}后发布）\n${e.content}\n\n`;
                        infoTitles.push(title);
                    });
                }
            });

            const systemPrompt = `你是一个动漫/游戏剧情整理助手。请将用户提供的剧情进展与官方情报记录，整合成一段连贯、完整的综合总结文字。
要求：
- 涵盖所有剧情节点、角色发展、关键事件，以及各剧情节点之后的官方情报（周边/访谈/活动等）
- 保持时间顺序，剧情与情报穿插呈现
- 【重要】必须在总结正文中保留各剧情条目的原始标题作为锚点（如"ep1では〜""第3話で〜"），确保能准确知道每段剧情发生在哪一话
- 官方情报以"〜之后发布了〜"的形式自然融入正文
- 保留可能被后续讨论引用的重要细节（伏笔、名台词、转折点）
- 使用简洁流畅的中文
- 篇幅500-1000字（视内容量调整）
- 【极重要】全文必须使用过去式，明确表达所有事件均已发生（"已播出""已公开""发布了"等），严禁使用"将播出""预计""期待"等未来语气描述已发生的事件
- 【极重要】总结结尾必须单独一行写：「截至本总结，最新已发生的剧情节点为：[最后一个剧情条目的原始标题]」，让读者清楚知道当前时间线进度
- 只输出总结正文，不要有额外标题或说明`;

            const messages = [{ role: 'user', content: `${baseContext}请将以下剧情进展与官方情报整合成综合总结：\n\n${contentToSummarize}` }];

            const summaryContent = await Utils.callChatAPI(messages, systemPrompt);
            this._summaryPreviewData = {
                content: summaryContent.trim(),
                coveredPlotIds: scope.plots.map(p => p.id),
                coveredInfoIds: scope.infos.map(e => e.id),
                titleIndex: plotTitles,
                plotTitles,
                infoTitles
            };
            this._renderSummaryModal();

        } catch (e) {
            Utils.showToast(I18n.t('t.forum_gen_failed', '生成失败：') + e.message);
            console.error('[Summary Gen Error]', e);
        } finally {
            // 兜底恢复按钮：成功时 _renderSummaryModal 会重建按钮、这里操作旧引用无害；万一渲染抛异常也保证不卡死在「生成中」
            if (btn) { const _sumErrLbl = btn.querySelector('.fch-svg-label'); if (_sumErrLbl) _sumErrLbl.textContent = I18n.t('forum.summary_gen_default_btn', 'AI 生成总结'); else btn.textContent = I18n.t('forum.summary_gen_default_btn', 'AI 生成总结'); btn.disabled = false; }
        }
    },

    confirmSaveSummary() {
        if (!this._summaryPreviewData) return;
        const content = document.getElementById('summaryPreviewContent').value.trim();
        if (!content) { Utils.showToast(I18n.t('t.forum_summary_content_required', '总结内容不能为空')); return; }

        const data = AppState.data.forumData;
        if (!AppState.data.broadcast.mergedSummaries) AppState.data.broadcast.mergedSummaries = [];

        const summary = {
            id: Utils.generateId(),
            createdAt: Date.now(),
            coveredPlotIds: this._summaryPreviewData.coveredPlotIds,
            coveredInfoIds: this._summaryPreviewData.coveredInfoIds,
            titleIndex: this._summaryPreviewData.titleIndex,
            content
        };
        AppState.data.broadcast.mergedSummaries.push(summary);

        this._summaryPreviewData = null;
        Utils.saveData();
        this.renderPlotList();
        this._renderSummaryModal();
        Utils.showToast(I18n.t('t.forum_summary_saved', '✓ 综合总结已保存'));
    },

    reGenerateSummary() {
        this._summaryPreviewData = null;
        this._renderSummaryModal();
    },

    _toggleSummaryEdit(summaryId) {
        const editArea = document.getElementById(`summaryEditArea_${summaryId}`);
        const preview = document.getElementById(`summaryPreview_${summaryId}`);
        if (!editArea) return;
        const isHidden = editArea.style.display === 'none';
        editArea.style.display = isHidden ? 'block' : 'none';
        if (preview) preview.style.display = isHidden ? 'none' : 'block';
    },

    _saveSummaryItem(summaryId, legacy) {
        const ta = document.getElementById(`summaryEditTA_${summaryId}`);
        if (!ta) return;
        const content = ta.value.trim();
        if (!content) { Utils.showToast(I18n.t('t.forum_summary_content_required', '总结内容不能为空')); return; }

        const data = AppState.data.forumData;
        let list;
        if (legacy === 'plot') list = AppState.data.broadcast.plotSummaries || [];
        else if (legacy === 'official') list = AppState.data.broadcast.officialSummaries || [];
        else list = AppState.data.broadcast.mergedSummaries || [];

        const item = list.find(s => s.id === summaryId);
        if (!item) return;
        item.content = content;
        Utils.saveData();
        this._renderSummaryModal();
        Utils.showToast(I18n.t('t.forum_summary_updated', '✓ 总结已更新'));
    },

    _deleteSummaryItem(summaryId, legacy) {
        if (!confirm(I18n.t('forum.confirm_delete_summary', '确定删除这期总结？原始条目不会丢失，但将恢复为未总结状态。'))) return;
        const data = AppState.data.forumData;
        if (legacy === 'plot') {
            AppState.data.broadcast.plotSummaries = (AppState.data.broadcast.plotSummaries || []).filter(s => s.id !== summaryId);
        } else if (legacy === 'official') {
            AppState.data.broadcast.officialSummaries = (AppState.data.broadcast.officialSummaries || []).filter(s => s.id !== summaryId);
        } else {
            AppState.data.broadcast.mergedSummaries = (AppState.data.broadcast.mergedSummaries || []).filter(s => s.id !== summaryId);
        }
        Utils.saveData();
        this.renderPlotList();
        this._renderSummaryModal();
        Utils.showToast(I18n.t('t.forum_summary_deleted', '✓ 总结已删除'));
    },

    // ===== 剧情草稿箱 =====
    showPlotImportModal() {
        document.getElementById('plotImportModal').classList.add('active');
        document.getElementById('plotImportFileInput').value = '';
        document.getElementById('plotImportPreview').innerHTML = '';
    },

    closePlotImportModal() {
        document.getElementById('plotImportModal').classList.remove('active');
    },

    handlePlotFileUpload(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            let rawText = e.target.result;
            // Try to detect and handle encoding issues
            if (rawText.includes('\ufffd') || rawText.includes('\u0000')) {
                // Likely wrong encoding, try Shift-JIS
                try {
                    const buffer = await file.arrayBuffer();
                    const decoder = new TextDecoder('shift-jis');
                    rawText = decoder.decode(buffer);
                } catch (err) {
                    console.warn('[PlotImport] Encoding fallback failed:', err);
                }
            }

            // Check if it's JSON
            try {
                const jsonData = JSON.parse(rawText);
                if (Array.isArray(jsonData)) {
                    this._importPlotsFromJson(jsonData);
                    return;
                }
            } catch (_) {
                // Not JSON, proceed as text
            }

            // For text files, use AI to extract episodes
            await this._extractPlotsFromText(rawText);
        };
        reader.readAsText(file);
    },

    _importPlotsFromJson(arr) {
        const data = AppState.data.forumData;
        if (!AppState.data.broadcast.plotDrafts) AppState.data.broadcast.plotDrafts = [];
        const existingNums = new Set(AppState.data.broadcast.plotDrafts.map(d => d.episodeNumber));

        let imported = 0;
        arr.forEach((item, i) => {
            const epNum = item.episodeNumber || item.episode || (i + 1);
            if (existingNums.has(epNum)) return; // skip duplicates
            AppState.data.broadcast.plotDrafts.push({
                id: Utils.generateId(),
                episodeNumber: epNum,
                title: item.title || `第${epNum}話`,
                summary: item.summary || item.content || '',
                isPublished: false,
                importedAt: Date.now(),
                publishedAt: null
            });
            imported++;
        });

        Utils.saveData();
        this.closePlotImportModal();
        this.renderPlotDraftList();
        Utils.showToast(I18n.t('t.forum_plots_imported', { n: imported }));
    },

    async _extractPlotsFromText(rawText) {
        const preview = document.getElementById('plotImportPreview');
        preview.innerHTML = '<div style="padding:12px;color:var(--text-secondary);font-size:13px;">AI解析中...</div>';

        try {
            const systemPrompt = `あなたはアニメ・漫画のストーリーテキストから各話の要約を抽出する専門家です。

以下のテキストから、各話/各章のタイトルとあらすじを抽出してJSON配列で出力してください。

ルール:
- 各要素は { "episodeNumber": 数字, "title": "話タイトル", "summary": "あらすじ要約（80字以内）" } の形式
- 元テキストの話番号がわかる場合はそれを使用
- わからない場合は連番
- summaryは元テキストの内容を忠実に要約すること（捏造禁止）
- 出力はJSON配列のみ（説明文なし）

例:
[{"episodeNumber":1,"title":"第1話 始まり","summary":"主人公が魔法学校に入学する。同級生のBと出会い..."},{"episodeNumber":2,"title":"第2話 試練","summary":"初めての戦闘訓練で..."}]`;

            const messages = [{ role: 'user', content: rawText.slice(0, 15000) }]; // Limit input size
            const response = await Utils.callChatAPI(messages, systemPrompt);

            // Extract JSON from response
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                Utils.showToast(I18n.t('t.forum_ai_parse_failed', 'AI解析に失敗しました。テキスト形式を確認してください'));
                preview.innerHTML = '';
                return;
            }

            const parsed = JSON.parse(jsonMatch[0]);
            if (!Array.isArray(parsed) || parsed.length === 0) {
                Utils.showToast(I18n.t('t.forum_no_plots_found', '話が見つかりませんでした'));
                preview.innerHTML = '';
                return;
            }

            // Show preview before importing
            const _esc = s => Utils.escapeHtml(s || '');
            preview.innerHTML = `
                <div style="padding:8px;font-size:13px;color:var(--text-secondary);">
                    ${parsed.length} 話を検出しました：
                </div>
                <div style="max-height:200px;overflow-y:auto;padding:0 8px;">
                    ${parsed.map(p => `
                        <div style="padding:6px 0;border-bottom:1px solid var(--border-light);font-size:12px;">
                            <strong>${_esc(p.title || `第${p.episodeNumber}話`)}</strong>
                            <div style="color:var(--text-secondary);margin-top:2px;">${_esc((p.summary || '').slice(0, 60))}...</div>
                        </div>
                    `).join('')}
                </div>
                <button class="glass-btn primary" style="width:100%;margin-top:8px;" onclick="Forum._confirmPlotImport()">
                    インポートする (${parsed.length}話)
                </button>`;

            // Store temporarily for confirmation
            this._pendingPlotImport = parsed;

        } catch (err) {
            Utils.showToast(I18n.t('t.forum_ai_parse_error', 'AI解析エラー: ') + err.message);
            preview.innerHTML = '';
            console.error('[PlotImport]', err);
        }
    },

    _confirmPlotImport() {
        if (!this._pendingPlotImport) return;
        this._importPlotsFromJson(this._pendingPlotImport);
        this._pendingPlotImport = null;
    },

    renderPlotDraftList() {
        const container = document.getElementById('plotDraftList');
        if (!container) return;

        const data = AppState.data.forumData;
        if (!AppState.data.broadcast.plotDrafts) AppState.data.broadcast.plotDrafts = [];
        const drafts = AppState.data.broadcast.plotDrafts;

        if (drafts.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-text">${I18n.t('bc.draft_empty')}</div><div class="empty-state-hint">${I18n.t('bc.draft_empty_hint')}</div></div>`;
            return;
        }

        const _esc = s => Utils.escapeHtml(s || '');
        container.innerHTML = drafts.map(d => {
            const statusClass = d.isPublished ? 'plot-draft-published' : 'plot-draft-pending';
            const statusLabel = d.isPublished ? I18n.t('bc.draft_published') : I18n.t('bc.draft_unpublished');
            const statusColor = d.isPublished ? '#34c759' : '#ff9500';
            return `
            <div class="plot-draft-item ${statusClass}" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border-light);">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor};flex-shrink:0;"></span>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:13px;font-weight:600;">${_esc(d.title)}</div>
                    <div style="font-size:11px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc((d.summary || '').slice(0, 50))}</div>
                </div>
                <span style="font-size:10px;color:${statusColor};white-space:nowrap;">${statusLabel}</span>
                ${d.isPublished ? '' : `
                    <button class="glass-btn mini" onclick="Forum.editPlotDraft('${d.id}')">${I18n.t('btn.edit')}</button>
                    <button class="glass-btn mini primary" onclick="Forum.publishPlotDraft('${d.id}')">${I18n.t('bc.draft_publish')}</button>
                `}
                <button class="glass-btn mini danger" onclick="Forum.deletePlotDraft('${d.id}')">×</button>
            </div>`;
        }).join('');
    },

    publishPlotDraft(draftId) {
        const data = AppState.data.forumData;
        if (!AppState.data.broadcast.plotDrafts) return;
        const draft = AppState.data.broadcast.plotDrafts.find(d => d.id === draftId);
        if (!draft || draft.isPublished) return;

        // Add to plotProgress (same as addPlotEntry logic)
        if (!AppState.data.broadcast.plotProgress) AppState.data.broadcast.plotProgress = [];
        AppState.data.broadcast.plotProgress.push({
            id: Utils.generateId(),
            title: draft.title,
            content: draft.summary,
            timestamp: Date.now()
        });

        // Mark draft as published
        draft.isPublished = true;
        draft.publishedAt = Date.now();

        // Handle pending goods release (same as addPlotEntry)
        const pendingGoods = (AppState.data.broadcast.officialInfo || []).filter(e => e.pendingRelease && e.category === 'goods');
        if (pendingGoods.length > 0) {
            const newPlot = AppState.data.broadcast.plotProgress[AppState.data.broadcast.plotProgress.length - 1];
            pendingGoods.forEach(goods => {
                // 原「预告 / 受注中」条目保留，pendingRelease 置 false；其 goods.status 不变（历史记录）
                goods.pendingRelease = false;
                const releaseEntry = {
                    id: Utils.generateId(),
                    title: `【発売】${goods.title || goods.content.slice(0, 15)} `,
                    content: `${goods.content} \n（正式発売！商品の発送が始まっています。）`,
                    category: 'goods',
                    afterPlotId: newPlot.id,
                    sourceNpcId: goods.sourceNpcId || null,
                    sourceNpcIds: goods.sourceNpcIds || [],
                    timestamp: Date.now() + 1,
                    isGoodsRelease: true
                };
                // 结构化周边：発売条目继承原 goods 块，status 设为「贩售中」
                // sourceGoodsId：关联原条目，让商品图在「预告/受注中 ↔ 発売副本」间同步（见 _generateGoodsImage / _linkedGoodsEntries）
                if (goods.goods) {
                    releaseEntry.goods = { ...goods.goods, status: '贩售中', sourceGoodsId: goods.id };
                }
                AppState.data.broadcast.officialInfo.push(releaseEntry);

                // 周边正式入市 → 上事件总线（v2.192 B3；source 用 mercari = 点击直达市场）
                Utils.emitEvent('goods_announced', 'mercari', {
                    title: (releaseEntry.goods && releaseEntry.goods.name) || goods.title || '',
                    summary: '正式発売開始'
                });
            });
        }

        Utils.saveData();

        // Emit event
        Utils.emitEvent('plot_published', 'forum', { title: draft.title, summary: draft.summary.slice(0, 80) });

        // メロンブックス商品ステータス連動
        const draftPlotId = AppState.data.broadcast.plotProgress[AppState.data.broadcast.plotProgress.length - 1]?.id;
        if (draftPlotId && typeof Melonbooks !== 'undefined' && Melonbooks.onPlotPublished) {
            Melonbooks.onPlotPublished(draftPlotId);
        }
        if (draftPlotId && typeof Mercari !== 'undefined' && Mercari.onPlotPublished) Mercari.onPlotPublished(draftPlotId);
        if (draftPlotId && typeof Wandoro !== 'undefined' && Wandoro.onPlotPublished) Wandoro.onPlotPublished(draftPlotId);   // v2.129.0 完結前：草稿发布也起一轮 ワンドロ（抽到 wandoro.js、缺失则 no-op）

        this.renderPlotDraftList();
        this.renderPlotList();
        Utils.showToast(I18n.t('t.forum_draft_published', { n: draft.title }));

        // Show goods quick banner
        this._showGoodsQuickBanner();

        // 日本同人圈自动生成 — pixiv 独立开关
        if (AppState.data.pixivData?.settings?.autoGenOnNewPlot) {
            const genCount = Math.max(1, Math.min(5, AppState.data.pixivData.settings.autoGenCount || 1));
            setTimeout(async () => {
                for (let _gi = 0; _gi < genCount; _gi++) {
                    await PixivNovel.autoGenerateNovel().catch(e => console.warn('[AutoGen]', e));
                }
            }, 300);
        }

        // v2.73.6: 中文同人圈自动生成 — 微博 + lofter 共享 lofter 开关、跟 pixiv 完全解绑
        // （之前 lofter hook 在草稿发布分支完全缺失、本次补齐 + recentPlotSummary 之前永远空串、本次传草稿 title + summary）
        if (typeof Lofter !== 'undefined' && AppState.data.lofterData?.settings?.autoGenOnNewPlot) {
            const plotSummary = `${draft.title} — ${(draft.summary || draft.content || '').slice(0, 120)}`;
            if (typeof Weibo !== 'undefined' && AppState.data.weiboData) {
                const wbCount = AppState.data.weiboData.autoGenWeiboCount || 4;
                setTimeout(() => {
                    Weibo._generateNpcWeibos(wbCount, plotSummary).catch(e => console.warn('[Weibo autoGen]', e));
                    Weibo._maybeSeedHotsearch(plotSummary).catch(e => console.warn('[Weibo hotsearch]', e));
                }, 500);
            }
            const lofCount = Math.max(1, Math.min(5, AppState.data.lofterData.settings.autoGenCount || 2));
            setTimeout(() => Lofter._autoGenerateOnPlot(lofCount).catch(e => console.warn('[Lofter autoGen]', e)), 700);
        }
    },

    editPlotDraft(draftId) {
        const data = AppState.data.forumData;
        if (!AppState.data.broadcast.plotDrafts) return;
        const draft = AppState.data.broadcast.plotDrafts.find(d => d.id === draftId);
        if (!draft || draft.isPublished) return;

        const newTitle = prompt(I18n.t('forum.draft_title_prompt', 'タイトル:'), draft.title);
        if (newTitle === null) return;
        const newSummary = prompt(I18n.t('forum.draft_summary_prompt', 'あらすじ:'), draft.summary);
        if (newSummary === null) return;

        draft.title = newTitle.trim() || draft.title;
        draft.summary = newSummary.trim() || draft.summary;
        Utils.saveData();
        this.renderPlotDraftList();
        Utils.showToast(I18n.t('t.forum_draft_updated', '✓ 草稿を更新しました'));
    },

    deletePlotDraft(draftId) {
        const data = AppState.data.forumData;
        if (!AppState.data.broadcast.plotDrafts) return;
        AppState.data.broadcast.plotDrafts = AppState.data.broadcast.plotDrafts.filter(d => d.id !== draftId);
        Utils.saveData();
        this.renderPlotDraftList();
    },

    // ===== 常驻讨論串 =====
    showCreatePersistentThreadModal() {
        document.getElementById('persistentThreadModal').classList.add('active');
        document.getElementById('persistentThreadTitle').value = '';
        document.getElementById('persistentThreadKeywords').value = '';
        document.getElementById('persistentThreadType').value = 'custom';
        this._updatePersistentPreset();
    },

    _updatePersistentPreset() {
        const type = document.getElementById('persistentThreadType').value;
        const titleEl = document.getElementById('persistentThreadTitle');
        const kwEl = document.getElementById('persistentThreadKeywords');
        const presets = {
            goods: { title: 'グッズ総合スレ', keywords: 'グッズ,周辺,物販,アクスタ,缶バッジ,ぬいぐるみ,goods' },
            cp: { title: 'CP総合スレ', keywords: 'カプ,推しカプ,CP,尊い,公式,関係' },
            analysis: { title: '考察総合スレ', keywords: '考察,伏線,考察班,深読み,仮説,理論' },
            custom: { title: '', keywords: '' }
        };
        const preset = presets[type] || presets.custom;
        if (type !== 'custom') {
            titleEl.value = preset.title;
            kwEl.value = preset.keywords;
        }
    },

    createPersistentThread() {
        const title = document.getElementById('persistentThreadTitle').value.trim();
        const keywordsRaw = document.getElementById('persistentThreadKeywords').value.trim();
        if (!title) { Utils.showToast(I18n.t('t.forum_title_required', 'タイトルを入力してください')); return; }

        const keywords = keywordsRaw.split(/[,，、\s]+/).filter(Boolean);
        const data = AppState.data.forumData;
        if (!data.threads) data.threads = [];

        const threadId = Utils.generateId();
        data.threads.unshift({
            id: threadId,
            title: `【総合】${title}`,
            content: `ここは ${title} です。関連する話題をまとめて語りましょう。`,
            author: '名無しさん',
            authorId: this.generateAnonId(),
            timestamp: Date.now(),
            threadType: 'persistent',
            isPersistent: true,
            keywords: keywords,
            replies: [],
            partNum: 1
        });

        Utils.saveData();
        document.getElementById('persistentThreadModal').classList.remove('active');
        this.renderThreadList();
        Utils.showToast(I18n.t('t.forum_persistent_thread_created', { n: title }));
    },

    _matchPersistentThread(content) {
        const data = AppState.data.forumData;
        const threads = (data.threads || []).filter(t => t.isPersistent && (t.replies || []).length < this.THREAD_REPLY_LIMIT);
        if (threads.length === 0) return null;

        const contentLower = (content || '').toLowerCase();
        for (const thread of threads) {
            const keywords = thread.keywords || [];
            const matchCount = keywords.filter(kw => contentLower.includes(kw.toLowerCase())).length;
            if (matchCount > 0) return thread;
        }
        return null;
    },

    _getPersistentThreadContext() {
        const data = AppState.data.forumData;
        const persistent = (data.threads || []).filter(t => t.isPersistent);
        if (persistent.length === 0) return '';

        return `\n【常驻ディスカッションスレ】
以下の常驻スレッドが存在します。生成したレスの内容がこれらのキーワードに強くマッチする場合、===PERSISTENT_REPLY===マーカーを使って該当する常驻スレへの新レスとして出力することができます（任意）:
${persistent.map(t => {
            const replyCount = (t.replies || []).length;
            const full = replyCount >= this.THREAD_REPLY_LIMIT;
            return `- 「${t.title}」(id: ${t.id}, keywords: ${(t.keywords || []).join('/')}, ${replyCount}レス${full ? ' ※満員' : ''})`;
        }).join('\n')}

常驻スレへのレスを出力する場合のフォーマット:
===PERSISTENT_REPLY===
THREAD_ID: [上記のid]
AUTHOR: 名無しさん
CONTENT:
（レス内容）
`;
    },

});
