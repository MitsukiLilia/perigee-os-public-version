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
            location.reload();
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

    _esc(s) {
        const d = document.createElement('div');
        d.textContent = String(s || '');
        return d.innerHTML;
    }
};

// 历史更新页（设置→关于→往期更新）
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
        scroll.innerHTML = `
            <div class="changelog-history-intro">
                <div class="changelog-history-title">往期更新</div>
                <div class="changelog-history-sub">从开始到现在，作者一路记录的每一版。</div>
            </div>
            ${versions.map((v, i) => this._renderEntry(v, i === 0)).join('')}
        `;
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

    _esc(s) {
        const d = document.createElement('div');
        d.textContent = String(s || '');
        return d.innerHTML;
    }
};
