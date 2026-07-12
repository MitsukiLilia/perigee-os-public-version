// Perigee OS Changelog UI
// 负责两件事：
// 1. ChangelogPrompt — 用户更新到新版本后首次启动弹「这次改了什么」
// 2. ChangelogHistory — 渲染设置→关于→往期更新页

const ChangelogPrompt = {
    STORAGE_KEY: 'perigee_last_changelog_version',

    // 判断要不要弹 — 在 app 启动时调用
    checkAndShow() {
        if (typeof Changelog === 'undefined') return;
        const last = localStorage.getItem(this.STORAGE_KEY);
        const current = Changelog.CURRENT;
        if (last === current) return;

        // 全新用户（onboarding 还没完成）— 静默标记，让 onboarding 接管
        const onboarded = localStorage.getItem('perigee_onboarded') === 'true';
        if (!onboarded) {
            try { localStorage.setItem(this.STORAGE_KEY, current); } catch (e) {}
            return;
        }

        // 已有用户更新到新版 — 等桌面渲染稳定后弹
        setTimeout(() => this.show(), 600);
    },

    show() {
        if (typeof Changelog === 'undefined') return;
        const v = Changelog.getLatest();
        if (!v) return;

        // 防止重复弹
        if (document.getElementById('changelogModal')) return;

        const overlay = document.createElement('div');
        overlay.id = 'changelogModal';
        overlay.className = 'changelog-modal-overlay active';
        overlay.innerHTML = this._renderModalContent(v);
        document.body.appendChild(overlay);

        // 绑定按钮
        overlay.querySelector('.changelog-modal-refresh')?.addEventListener('click', () => {
            this._markSeen();
            // reload 前必须 flushSave：迁移推进的 _v 走防抖 saveData，本弹窗 600ms 后才弹出，
            // 用户看到就立点刷新可能抢在防抖窗口前丢那次落盘（flushSave 的 promise 永远 resolve，直接 then 即可）
            Utils.flushSave().then(() => location.reload());
        });
        overlay.querySelector('.changelog-modal-later')?.addEventListener('click', () => {
            this._markSeen();
            this._dismiss();
        });
        overlay.querySelector('.changelog-modal-history')?.addEventListener('click', () => {
            this._markSeen();
            this._dismiss();
            if (typeof ChangelogHistory !== 'undefined') ChangelogHistory.open();
        });
        overlay.querySelector('.changelog-modal-tutorial')?.addEventListener('click', () => {
            this._markSeen();
            this._dismiss();
            if (typeof Help !== 'undefined') Help.open();
        });
        // 点遮罩外关闭（不算「看过」，下次还会弹直到用户主动选）
        overlay.addEventListener('click', e => {
            if (e.target === overlay) this._dismiss();
        });
    },

    _markSeen() {
        try { localStorage.setItem(this.STORAGE_KEY, Changelog.CURRENT); } catch (e) {}
    },

    _dismiss() {
        const m = document.getElementById('changelogModal');
        if (m) m.remove();
    },

    _renderModalContent(v) {
        const highlights = (v.highlights || []).map(h => `<li>${this._esc(h)}</li>`).join('');
        const voice = this._esc(v.voiceFromKlaude || '').replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
        return `
            <div class="changelog-modal-card">
                <div class="changelog-modal-header">
                    <div class="changelog-modal-title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                        <span>新版本上线</span>
                    </div>
                    <div class="changelog-modal-version">v${this._esc(v.version)}</div>
                </div>
                <div class="changelog-modal-body">
                    <div class="changelog-section-label">这次改了什么</div>
                    <ul class="changelog-highlights">${highlights}</ul>
                    ${voice ? `
                        <div class="changelog-section-label">来自作者</div>
                        <div class="changelog-voice"><p>${voice}</p></div>
                    ` : ''}
                </div>
                <div class="changelog-modal-actions">
                    <div class="changelog-modal-actions-left">
                        <button class="changelog-modal-history">往期更新</button>
                        <button class="changelog-modal-tutorial">完整教程</button>
                    </div>
                    <div class="changelog-modal-actions-right">
                        <button class="changelog-modal-later">稍后</button>
                        <button class="changelog-modal-refresh primary">立即刷新使用</button>
                    </div>
                </div>
            </div>
        `;
    },

    // 收口：转发 Utils.escapeHtml（s||'' 保留原 falsy→'' 语义）
    _esc(s) { return Utils.escapeHtml(s || ''); }
};

// 历史更新页（设置→关于→往期更新）
// v2.179.0：条目按月冻结在归档 JSON（见 changelog.js 头注释），本页先渲染当前月，
// 底部「加载更早」按钮逐月懒加载。已加载过的月缓存在 Changelog._archiveCache，重进页面不重复请求。
const ChangelogHistory = {
    open() {
        if (typeof Navigation !== 'undefined') {
            Navigation.goTo('changelog-history');
        }
        this.render();
    },

    render() {
        const scroll = document.getElementById('changelogHistoryScroll');
        if (!scroll || typeof Changelog === 'undefined') return;
        const versions = Changelog.getHistory();
        // 已缓存的归档月（连续前缀）直接一起渲染，避免重进页面后"已加载的又缩回去"
        let archived = [];
        let nextIdx = 0;
        const archives = Changelog.ARCHIVES || [];
        while (nextIdx < archives.length && Changelog._archiveCache[archives[nextIdx].id]) {
            archived = archived.concat(Changelog._archiveCache[archives[nextIdx].id]);
            nextIdx++;
        }
        scroll.innerHTML = `
            <div class="changelog-history-intro">
                <div class="changelog-history-title">往期更新</div>
                <div class="changelog-history-sub">从开始到现在，作者一路记录的每一版。</div>
            </div>
            <div id="changelogEntries">
                ${versions.map((v, i) => this._renderEntry(v, i === 0)).join('')}
                ${archived.map(v => this._renderEntry(v, false)).join('')}
            </div>
            <div id="changelogLoadMoreWrap">${this._renderLoadMore(nextIdx)}</div>
        `;
        this._bindLoadMore(nextIdx);
    },

    // nextIdx = 下一个待加载的归档下标；到头了显示收尾语
    _renderLoadMore(nextIdx) {
        const archives = (typeof Changelog !== 'undefined' && Changelog.ARCHIVES) || [];
        if (nextIdx >= archives.length) {
            return archives.length ? `<div class="changelog-history-end">已经到最开始的地方了。</div>` : '';
        }
        const a = archives[nextIdx];
        const label = `${a.id.slice(0, 4)} 年 ${parseInt(a.id.slice(5), 10)} 月`;
        return `<button class="changelog-load-more" data-next="${nextIdx}">加载 ${label}的更新（${a.count} 版）</button>`;
    },

    _bindLoadMore(nextIdx) {
        const btn = document.querySelector('#changelogLoadMoreWrap .changelog-load-more');
        if (!btn) return;
        btn.onclick = async () => {
            const idx = parseInt(btn.dataset.next, 10);
            const a = Changelog.ARCHIVES[idx];
            if (!a) return;
            btn.disabled = true;
            btn.textContent = '加载中…';
            try {
                const entries = await Changelog.loadArchive(a.id);
                const container = document.getElementById('changelogEntries');
                if (container) container.insertAdjacentHTML('beforeend', entries.map(v => this._renderEntry(v, false)).join(''));
                const wrap = document.getElementById('changelogLoadMoreWrap');
                if (wrap) {
                    wrap.innerHTML = this._renderLoadMore(idx + 1);
                    this._bindLoadMore(idx + 1);
                }
            } catch (e) {
                btn.disabled = false;
                btn.textContent = '加载失败、点击重试';
            }
        };
    },

    _renderEntry(v, isLatest) {
        const highlights = (v.highlights || []).map(h => `<li>${this._esc(h)}</li>`).join('');
        const voice = this._esc(v.voiceFromKlaude || '').replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
        return `
            <div class="changelog-entry ${isLatest ? 'is-latest' : ''}">
                <div class="changelog-entry-header">
                    <div class="changelog-entry-version">v${this._esc(v.version)}</div>
                    <div class="changelog-entry-date">${this._esc(v.date || '')}</div>
                </div>
                <ul class="changelog-highlights">${highlights}</ul>
                ${voice ? `
                    <div class="changelog-entry-voice"><p>${voice}</p></div>
                ` : ''}
            </div>
        `;
    },

    // 收口：转发 Utils.escapeHtml（s||'' 保留原 falsy→'' 语义）
    _esc(s) { return Utils.escapeHtml(s || ''); }
};
