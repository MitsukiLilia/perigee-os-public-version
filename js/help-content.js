// Perigee OS 帮助中心内容 — 懒加载器
// v2.179.0 拆分：正文（41 节、约 70KB）搬到 assets/help-content.json，打开帮助中心时才 fetch。
// 启动不再解析这份大文本；JSON 在 sw.js precache 里（离线/onboarding 首次引导也能打开）。
// 更新帮助内容：直接改 assets/help-content.json（结构不变：{ sections: [...] }）。

const HelpContent = {
    sections: null,          // 未加载时为 null；load() 后为数组
    _loading: null,          // 进行中的 fetch（防并发重复请求）

    // 幂等加载；失败会抛错（由 Help.open 兜底提示）
    async load() {
        if (this.sections) return this.sections;
        if (this._loading) return this._loading;
        this._loading = fetch('assets/help-content.json')
            .then(r => {
                if (!r.ok) throw new Error('help content fetch failed: ' + r.status);
                return r.json();
            })
            .then(data => {
                this.sections = data.sections || [];
                return this.sections;
            })
            .finally(() => { this._loading = null; });
        return this._loading;
    },

    // 获取分组（type='group'）
    getGroups() {
        return (this.sections || []).filter(s => s.type === 'group');
    },

    // 获取某分组下的子项
    getChildren(groupId) {
        return (this.sections || []).filter(s => s.parent === groupId);
    },

    // 按 id 找
    find(id) {
        return (this.sections || []).find(s => s.id === id);
    }
};
