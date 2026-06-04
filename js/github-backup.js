// Perigee OS GitHub 云备份
// 把 AppState.data 推到 GitHub 私有仓库的 backup.json，可随时拉回
// 配置（含 PAT）独立存 localStorage，不进 AppState 避免被"导出全部数据"包含

const GitHubBackup = {
    CONFIG_KEY: 'perigee_github_backup_config',
    FILE_PATH: 'backup.json',
    SOFT_WARN_BYTES: 50 * 1024 * 1024,   // 50 MB — 给提示但允许继续
    HARD_LIMIT_BYTES: 100 * 1024 * 1024, // 100 MB — GitHub Contents API 单文件上限

    // ===== 配置存取 =====
    loadConfig() {
        try {
            const raw = localStorage.getItem(this.CONFIG_KEY);
            return raw ? JSON.parse(raw) : { username: '', repo: '', pat: '', lastPushedAt: null };
        } catch (e) {
            return { username: '', repo: '', pat: '', lastPushedAt: null };
        }
    },

    saveConfig(partial) {
        const current = this.loadConfig();
        const next = { ...current, ...partial };
        try {
            localStorage.setItem(this.CONFIG_KEY, JSON.stringify(next));
            return true;
        } catch (e) {
            Utils.showToast(I18n.t('t.ghb_config_save_failed', '配置保存失败：') + e.message, 4000);
            return false;
        }
    },

    // ===== UI 渲染 =====
    renderInto(containerEl) {
        if (!containerEl) return;
        const c = this.loadConfig();
        const lastStr = c.lastPushedAt
            ? new Date(c.lastPushedAt).toLocaleString('zh-CN', { hour12: false })
            : I18n.t('ghb.never_pushed');
        containerEl.innerHTML = `
            <div style="padding:12px 16px; display:flex; flex-direction:column; gap:8px;">
                <label style="font-size:12px;color:var(--text-secondary);">${I18n.t('ghb.username')}</label>
                <input id="ghbUsername" type="text" autocomplete="off" spellcheck="false" value="${this._esc(c.username)}"
                    style="padding:8px 10px;border:1px solid var(--border-light);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);font-size:13px;">

                <label style="font-size:12px;color:var(--text-secondary);">${I18n.t('ghb.repo')}</label>
                <input id="ghbRepo" type="text" autocomplete="off" spellcheck="false" value="${this._esc(c.repo)}"
                    style="padding:8px 10px;border:1px solid var(--border-light);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);font-size:13px;">

                <label style="font-size:12px;color:var(--text-secondary);">${I18n.t('ghb.pat_label')}</label>
                <input id="ghbPat" type="password" autocomplete="off" spellcheck="false" value="${this._esc(c.pat)}"
                    style="padding:8px 10px;border:1px solid var(--border-light);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);font-size:13px;font-family:monospace;">

                <button class="glass-btn" style="width:100%;margin-top:4px;" onclick="GitHubBackup.handleSaveConfig()">${I18n.t('ghb.save_config')}</button>

                <div style="height:1px;background:var(--border-light);margin:8px 0;"></div>

                <button class="glass-btn" style="width:100%;" onclick="GitHubBackup.handlePush()">${I18n.t('ghb.push_now')}</button>
                <button class="glass-btn" style="width:100%;" onclick="GitHubBackup.handleRestore()">${I18n.t('ghb.restore_now')}</button>

                <p id="ghbLastPushed" style="font-size:11px;color:var(--text-secondary);margin:4px 0 0;">${I18n.t('ghb.last_pushed', { time: lastStr })}</p>
                <p style="font-size:11px;color:var(--text-secondary);margin:6px 0 0;line-height:1.5;">${I18n.t('ghb.security_note_html')}</p>
            </div>
        `;
    },

    // ===== 按钮处理 =====
    handleSaveConfig() {
        const username = (document.getElementById('ghbUsername')?.value || '').trim();
        const repo = (document.getElementById('ghbRepo')?.value || '').trim();
        const pat = (document.getElementById('ghbPat')?.value || '').trim();

        if (!username || !repo || !pat) {
            Utils.showToast(I18n.t('t.ghb_fill_fields', '请填写用户名、仓库名和 PAT'), 3000);
            return;
        }
        if (this.saveConfig({ username, repo, pat })) {
            Utils.showToast(I18n.t('t.ghb_config_saved', '✓ 云备份配置已保存'));
        }
    },

    async handlePush() {
        const c = this.loadConfig();
        if (!c.username || !c.repo || !c.pat) {
            Utils.showToast(I18n.t('t.ghb_save_config_first', '请先保存云备份配置'), 3000);
            return;
        }

        const dataStr = JSON.stringify(AppState.data);
        const sizeBytes = new Blob([dataStr]).size;

        if (sizeBytes > this.HARD_LIMIT_BYTES) {
            const mb = (sizeBytes / 1024 / 1024).toFixed(1);
            Utils.showToast(I18n.t('t.ghb_size_over_limit', {mb}), 5000);
            return;
        }
        if (sizeBytes > this.SOFT_WARN_BYTES) {
            const mb = (sizeBytes / 1024 / 1024).toFixed(1);
            if (!confirm(I18n.t('ghb.confirm_push', { mb }))) return;
        }

        Utils.showToast(I18n.t('t.ghb_pushing', '正在推送，请稍候…'), 2000);
        try {
            const sha = await this._getFileSha(c);
            const b64 = this._toBase64(dataStr);
            const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
            const body = {
                message: `Perigee OS backup ${ts}`,
                content: b64,
                ...(sha ? { sha } : {})
            };
            await this._apiCall(c, 'PUT', body);
            this.saveConfig({ lastPushedAt: Date.now() });
            const el = document.getElementById('ghbLastPushed');
            if (el) el.textContent = I18n.t('ghb.last_pushed', { time: new Date().toLocaleString('zh-CN', { hour12: false }) });
            Utils.showToast(I18n.t('t.ghb_pushed', '✓ 已推送到云端'));
        } catch (e) {
            Utils.showToast(I18n.t('t.ghb_push_failed', '推送失败：') + e.message, 5000);
        }
    },

    async handleRestore() {
        const c = this.loadConfig();
        if (!c.username || !c.repo || !c.pat) {
            Utils.showToast(I18n.t('t.ghb_save_config_first', '请先保存云备份配置'), 3000);
            return;
        }

        if (!confirm(I18n.t('ghb.confirm_restore', '从云端恢复会用云端数据覆盖当前所有数据。\n\n建议先点"导出全部数据"留一份本地备份，然后再恢复。\n\n确认继续？'))) return;

        Utils.showToast(I18n.t('t.ghb_pulling', '正在拉取云端数据…'), 2000);
        try {
            const resp = await this._apiCall(c, 'GET');
            if (!resp.content) throw new Error('云端文件为空或格式错误');
            const dataStr = this._fromBase64(resp.content.replace(/\n/g, ''));
            const data = JSON.parse(dataStr);
            if (!data || typeof data !== 'object') throw new Error('文件不是合法 JSON 对象');

            // 整库替换：直接赋值整个 AppState.data
            for (const k of Object.keys(AppState.data)) delete AppState.data[k];
            Object.assign(AppState.data, data);
            await Utils.saveData();
            Utils.showToast(I18n.t('t.ghb_restored', '✓ 已从云端恢复，即将刷新'));
            setTimeout(() => location.reload(), 1200);
        } catch (e) {
            Utils.showToast(I18n.t('t.ghb_restore_failed', '恢复失败：') + e.message, 5000);
        }
    },

    // ===== GitHub API 封装 =====
    async _apiCall(c, method, body) {
        const url = `https://api.github.com/repos/${encodeURIComponent(c.username)}/${encodeURIComponent(c.repo)}/contents/${this.FILE_PATH}`;
        const opts = {
            method,
            headers: {
                'Authorization': `Bearer ${c.pat}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            }
        };
        if (body) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        const r = await fetch(url, opts);
        if (!r.ok) {
            let msg = `HTTP ${r.status}`;
            try {
                const j = await r.json();
                if (j.message) msg = `${r.status} ${j.message}`;
            } catch (e) {}
            throw new Error(msg);
        }
        return r.json();
    },

    async _getFileSha(c) {
        try {
            const resp = await this._apiCall(c, 'GET');
            return resp.sha || null;
        } catch (e) {
            // 404 = 文件不存在，第一次推送
            if (e.message.startsWith('404')) return null;
            throw e;
        }
    },

    // ===== Base64 工具（处理 UTF-8 + 大字符串） =====
    _toBase64(str) {
        const bytes = new TextEncoder().encode(str);
        const chunkSize = 32768;
        let binary = '';
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, chunk);
        }
        return btoa(binary);
    },

    _fromBase64(b64) {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new TextDecoder().decode(bytes);
    },

    _esc(s) {
        const d = document.createElement('div');
        d.textContent = String(s || '');
        return d.innerHTML;
    }
};
