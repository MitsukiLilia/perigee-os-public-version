// 放送局：跨模块共享的世界元数据中心
// 5 tabs：世界 / 剧情 / 情报 / 角色 / 总结
// 数据底层：AppState.data.broadcast（worldSetting / worldBookIds / plotProgress / plotDrafts / officialInfo / officialNpcs / mergedSummaries 等）
// CRUD 与渲染复用 forum.js 现有函数（Forum.renderPlotList / Forum.showPlotModal 等）

const Broadcast = {
    currentTab: 'world',

    init() {
        if (typeof Forum !== 'undefined' && Forum.applyFontSize) Forum.applyFontSize();
        this.switchTab(this.currentTab || 'world');
    },

    // v2.69.0: 统一 CP 数据访问入口，所有 CP 读取点走这里
    getCP() {
        const s = (AppState.data.broadcast && AppState.data.broadcast.cpSettings) || {};
        const cpCharA = s.cpCharA || '';
        const cpCharB = s.cpCharB || '';
        const cpNickname = s.cpNickname || '';
        return {
            cpCharA,
            cpCharB,
            cpNickname,
            cp: (cpCharA && cpCharB) ? `${cpCharA}×${cpCharB}` : '',
            hasCP: !!(cpCharA && cpCharB)
        };
    },

    switchTab(tabName) {
        this.currentTab = tabName;
        document.querySelectorAll('.broadcast-tab').forEach(b => {
            b.classList.toggle('active', b.dataset.tab === tabName);
        });
        document.querySelectorAll('.broadcast-tab-panel').forEach(p => {
            p.classList.toggle('active', p.dataset.tab === tabName);
        });
        switch (tabName) {
            case 'world':   this._initWorldTab(); break;
            case 'plot':    this._initPlotTab(); break;
            case 'info':    this._initInfoTab(); break;
            case 'npc':     this._initNpcTab(); break;
            case 'summary': this._initSummaryTab(); break;
        }
    },

    _initWorldTab() {
        const ws = document.getElementById('forumWorldSetting');
        if (ws) ws.value = AppState.data.broadcast.worldSetting || '';

        const wbContainer = document.getElementById('forumWorldBooks');
        if (!wbContainer) return;
        const currentWbIds = Utils.getActiveWorldBookIds();
        const allBooks = AppState.data.worldBooks || [];
        if (allBooks.length === 0) {
            wbContainer.innerHTML = `<span style="font-size:13px;color:var(--text-secondary);">${I18n.t('bc.no_worldbooks')}</span>`;
            return;
        }
        wbContainer.innerHTML = allBooks.map(b => {
            const enabledCount = (b.entries || []).filter(e => e.enabled !== false).length;
            const totalCount = (b.entries || []).length;
            const countHint = totalCount > 0 ? ` <span style="font-size:11px;color:var(--text-secondary);">(${enabledCount}/${totalCount})</span>` : '';
            return `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;cursor:pointer;">
    <input type="checkbox" class="forum-wb-check" data-wbid="${Utils.escHtml(b.id)}"
        ${currentWbIds.includes(b.id) ? 'checked' : ''} style="width:auto;accent-color:var(--accent);">
    <span>${Utils.escHtml(b.name)}${countHint}</span>
</label>`;
        }).join('');

        // v2.69.0: CP 设置回填 + 监听 input change 保存
        const cp = AppState.data.broadcast.cpSettings || { cpCharA: '', cpCharB: '', cpNickname: '' };
        const cpA = document.getElementById('broadcastCpCharA');
        const cpB = document.getElementById('broadcastCpCharB');
        const cpN = document.getElementById('broadcastCpNickname');
        if (cpA) {
            cpA.value = cp.cpCharA || '';
            cpA.oninput = () => {
                AppState.data.broadcast.cpSettings.cpCharA = cpA.value.trim();
                Utils.saveData();
            };
        }
        if (cpB) {
            cpB.value = cp.cpCharB || '';
            cpB.oninput = () => {
                AppState.data.broadcast.cpSettings.cpCharB = cpB.value.trim();
                Utils.saveData();
            };
        }
        if (cpN) {
            cpN.value = cp.cpNickname || '';
            cpN.oninput = () => {
                AppState.data.broadcast.cpSettings.cpNickname = cpN.value.trim();
                Utils.saveData();
            };
        }
        // v2.71.0: productionName 字段（微博作品超话用）
        const pn = document.getElementById('broadcastProductionName');
        if (pn) {
            pn.value = cp.productionName || '';
            pn.oninput = () => {
                AppState.data.broadcast.cpSettings.productionName = pn.value.trim();
                Utils.saveData();
            };
        }
    },

    _initPlotTab() {
        if (typeof Forum === 'undefined') return;
        if (Forum.renderPlotList) Forum.renderPlotList();
        if (Forum.renderPlotDraftList) Forum.renderPlotDraftList();
    },

    _initInfoTab() {
        if (typeof Forum !== 'undefined' && Forum.renderOfficialInfoList) Forum.renderOfficialInfoList();
    },

    _initNpcTab() {
        if (typeof Forum !== 'undefined' && Forum.renderNpcList) Forum.renderNpcList();
    },

    _initSummaryTab() {
        const stat = document.getElementById('broadcastSummaryStat');
        if (!stat) return;
        const merged = (AppState.data.broadcast.mergedSummaries || []).length;
        const plotSum = (AppState.data.broadcast.plotSummaries || []).length;
        const offSum = (AppState.data.broadcast.officialSummaries || []).length;
        const total = merged + plotSum + offSum;
        stat.textContent = total > 0
            ? I18n.t('bc.summary_stat', { total, merged, plot: plotSum, off: offSum })
            : I18n.t('bc.summary_empty');
    },

    saveWorldSettings() {
        const ws = document.getElementById('forumWorldSetting');
        if (ws) AppState.data.broadcast.worldSetting = ws.value.trim();
        AppState.data.broadcast.worldBookIds = [];
        document.querySelectorAll('.forum-wb-check:checked').forEach(cb => {
            AppState.data.broadcast.worldBookIds.push(cb.dataset.wbid);
        });
        AppState.data.broadcast.worldBookId = AppState.data.broadcast.worldBookIds[0] || '';
        Utils.saveData();
        Utils.showToast(I18n.t('t.bc_saved', '✓ 已保存'));
    }
};
