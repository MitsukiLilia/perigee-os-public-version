// Perigee OS 更新日志
// 每次发新版本：在数组开头插入新条目，bump CURRENT 到该版本号
// voiceFromKlaude: 可选的版本附言

// v2.179.0 拆分：本文件只保留当前月条目（启动轻量 + 每版缓存失效只有小文件）。
// 历史条目按月冻结在 assets/changelog-archive/YYYY-MM.json，历史页滚到底部时懒加载。
// 月度轮转（手动、每月初一次）：把上个整月的条目搬进新的归档 JSON、在 ARCHIVES 头部登记，
// 同步 deploy.sh DEFAULT_FILES（sw.js 不 precache 归档、靠 runtime cache）。条目内容永不修改（数据只增）。

const Changelog = {
    CURRENT: '2.280.0',

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
            version: '2.280.0',
            date: '2026-11-08',
            highlights: [
                '音乐：新建歌曲时可以选「生成方式」。选 Suno，Perigee 会写好歌词和 Suno 用的风格标签，点「复制风格」「复制歌词」，粘贴到 Suno 的 Custom 模式里生成；选 MiniMax 和以前一样，直接在 Perigee 里合成。会记住你上次选的',
                'Suno 的风格标签写得更细：曲风、嗓音质感、具体乐器、环境音效、前奏，五样都会写到',
                '新增歌曲类型「劇中歌」：故事里的角色自己在台上唱的歌，比如偶像或歌手角色的曲子。在「具体要求」里写上是谁、在什么场合唱就行，角色设定会从世界书里读',
                '歌词下面多了「查看翻译」，点一下生成中文翻译，之后可以随时展开收起；复制给 Suno 的歌词不会带翻译。英文界面翻成英文，日文界面不显示'
            ],
            voiceFromKlaude: '',
        },
        {
            version: '2.279.0',
            date: '2026-11-08',
            highlights: [
                '音乐：歌词不再把剧情顺着唱一遍了。AI 写词时会从剧情里挑一个核心的心情或关系，用景色、光、温度这些具体的东西来写，真心话留到后半首才说',
                'OP、ED、插曲、主题曲、角色歌、印象曲各有自己的写法：比如 OP 不剧透展开，ED 写本篇结束后的余韵，插曲只写那一刻心里在响的东西，角色歌不做自我介绍',
                '角色名、组织名、作品里的专有名词不会直接出现在歌词里了，会换成只有看过这部作品的人才听得出来的说法',
                '「具体要求」里写的东西优先于这些写法；已经生成的歌不会变，点「重写歌词」或「从歌词重新生成」就会用新写法'
            ],
            voiceFromKlaude: '',
        },
        {
            version: '2.278.0',
            date: '2026-10-05',
            highlights: [
                'X（推特）评论区：以后新生成的评论全部自带翻译。以前只有「加载更多回复」那一批有，推文自带的头几条、你回复之后别人回你的、声优和 staff 给你的回复都没有，所以会出现有的能看有的看不了',
                '推文详情页里的「引用推文」卡片也有翻译了，按钮和评论区是同一款',
                'pixiv 小说评论区：你回复之后，作者或读者回你的那一条现在也带「翻訳を見る」',
                '以前已经生成的评论不会变；旧的推文仍然可以用详情页的「翻译整个串」一次补齐'
            ],
            voiceFromKlaude: '',
        },
        {
            version: '2.277.0',
            date: '2026-10-05',
            highlights: [
                'pixiv 小说评论区：每条读者评论下面多了「翻訳を見る」，点开就是中文翻译，和推特、论坛一样',
                '之前已经读取过的评论没有翻译，不会显示这个按钮；想要翻译的话，新章节读取评论时就会自带'
            ],
            voiceFromKlaude: '',
        },
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
