// Perigee OS 更新日志
// 每次发新版本：在数组开头插入新条目，bump CURRENT 到该版本号
// voiceFromKlaude: 可选的版本附言

// v2.179.0 拆分：本文件只保留当前月条目（启动轻量 + 每版缓存失效只有小文件）。
// 历史条目按月冻结在 assets/changelog-archive/YYYY-MM.json，历史页滚到底部时懒加载。
// 月度轮转（手动、每月初一次）：把上个整月的条目搬进新的归档 JSON、在 ARCHIVES 头部登记，
// 同步 deploy.sh DEFAULT_FILES（sw.js 不 precache 归档、靠 runtime cache）。条目内容永不修改（数据只增）。

const Changelog = {
    CURRENT: '2.276.1',

    // 冻结月归档（新→旧）。file 相对站点根。
    ARCHIVES: [
        { id: '2026-09', file: 'assets/changelog-archive/2026-09.json', count: 16, from: '2.264.0', to: '2.276.0' },
        { id: '2026-08', file: 'assets/changelog-archive/2026-08.json', count: 43, from: '2.226.0', to: '2.263.0' },
        { id: '2026-07', file: 'assets/changelog-archive/2026-07.json', count: 62, from: '2.170.0', to: '2.225.0' },
        { id: '2026-06', file: 'assets/changelog-archive/2026-06.json', count: 74, from: '2.84.0', to: '2.169.0' },
        { id: '2026-05', file: 'assets/changelog-archive/2026-05.json', count: 96, from: '2.60.0', to: '2.83.0' },
        { id: '2026-04', file: 'assets/changelog-archive/2026-04.json', count: 19, from: '2.40.0', to: '2.59.0' }
    ],

    versions: [
        {
            version: '2.276.1',
            date: '2026-10-01',
            highlights: [
                'X（推特）评论区：找茬的评论不再每个帖子都来。以前每读取一批评论几乎都会混进一条；现在每批只有大约一成的概率出现，出现也最多一条，其余批次全是粉丝的反应',
                '拉黑、通報凍結、引用晒评、粉丝帮腔、LINE 好友安慰这些玩法都还在，只是变成偶尔才遇到；已有的评论不会变'
            ],
            voiceFromKlaude: '',
        },
    ],

    _archiveCache: {},   // id -> versions[]（会话级）

    // 懒加载某个归档月；失败抛错由调用方兜底
    async loadArchive(id) {
        if (this._archiveCache[id]) return this._archiveCache[id];
        const meta = this.ARCHIVES.find(a => a.id === id);
        if (!meta) return [];
        const resp = await fetch(meta.file);
        if (!resp.ok) throw new Error('archive fetch failed: ' + resp.status);
        const data = await resp.json();
        this._archiveCache[id] = data.versions || [];
        return this._archiveCache[id];
    },

    getLatest() { return this.versions[0]; },
    getHistory() { return this.versions; },
    findVersion(v) { return this.versions.find(x => x.version === v); }
};
