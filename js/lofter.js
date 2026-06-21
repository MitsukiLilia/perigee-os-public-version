// Lofter 模块（中文同人圈创作主战场、v2.73.0）
// 共用 weiboData.fanFriends 池 + 每个 NPC 加 lofter:{} 子字段
// 参考 pixiv-novel.js 的长篇 / 短篇生成模式（不复制 pixiv 字面量）
// 沉浸感铁律：零管理 UI、用户不能发文（+ 按钮 toast 占位）

const Lofter = {
    // ========== State ==========
    currentTab: 'home',            // 'home' | 'follow' | 'me'
    _homeSubTab: 'discover',       // 'discover' | 'plaza'
    _followSubTab: 'following',    // 'following' | 'subscribed'
    _categoryChip: 'recommend',    // 'recommend' | 'serial' | 'audio'(toast) | 'video'(toast) | 'store'(toast)

    // ========== 内部锁（in-flight guard）==========
    _genLock: null,                // 短文批量生成锁
    _chapterLock: null,            // 长篇章节生成锁
    _lazyTagLock: {},              // 按 tag 的 lazy seed 锁
    _searchResults: null,          // 搜索结果池（不污染 articles）

    // ========== 4 类活跃 NPC type（其他 3 类静默过滤）==========
    LOFTER_ACTIVE_TYPES: ['fan_writer', 'fan_artist', 'cp_fan', 'info_station'],

    // ========== v2.82.0 短文「文章类型」预设（compose 二级菜单用、用户显式选形态）==========
    // preferType: 倾向挑的 NPC type（联动、有货优先、没货 fallback 全池）
    // baseType:   解析后强制覆盖 article.type（short / meta）
    // label/desc: 注入短文 prompt 的中文形态指令（lofter 中文圈、不走 i18n；UI 显示名走 i18n atype_*）
    LOFTER_ARTICLE_TYPES: [
        { id: 'random',   preferType: null,           baseType: null,    label: '随机',          desc: '' },
        { id: 'drabble',  preferType: 'fan_writer',   baseType: 'short', label: '同人短打',      desc: '一个剧情 / 日常小切片：有画面、有情绪、有具体场景对白、200-600 字。是"故事片段"不是感想。' },
        { id: 'analysis', preferType: 'fan_writer',   baseType: 'meta',  label: '角色分析 / 解读', desc: '对角色性格 / 关系动力 / 行为动机的深度解读：有观点有论据、引原作细节佐证。是"分析评论"不是写剧情。' },
        { id: 'note',     preferType: 'fan_writer',   baseType: 'meta',  label: '创作 note / 碎碎念', desc: '创作者随手碎碎念：拖稿心虚 / 卡文焦虑 / 灵感暴击 / 改三遍开头 / 摸鱼日记 / 收到糖。活人感、可以很短很丧。' },
        { id: 'sugar',    preferType: 'cp_fan',       baseType: 'short', label: '抠糖 / 安利',   desc: '逐句抠 CP 糖点 / 安利新粮 / 整理粮单 / 接力安利。激动但不像营销号、句子里有真情实感。' },
        { id: 'lore',     preferType: 'info_station', baseType: 'meta',  label: '设定考据 / 情报', desc: '客观陈述官方设定 / 情报整理 / 设定考据 / 杂志摘要。冷静陈述、不掺个人情绪、不写剧情。' }
    ],

    // ========== 初始化 ==========

    init() {
        this._ensureDataSchema();
        this._migrateExistingNpcs();
        this.applyDarkMode();
        this.bindEvents();
        this.render();
        // 首次进入 / articles 太少 → 自动 seed 一波（in-flight guard 防并发）
        setTimeout(async () => {
            await this._maybeSeedFirstTime();
            // 短文 seed 后再尝试自动创建合集（如果合集池空 + 有合格 writers）
            setTimeout(() => this._maybeAutoCreateCollection(), 1500);
        }, 200);
    },

    // 首次种子：articles < 5 时自动调一次 batch 生成 15 篇短文
    async _maybeSeedFirstTime() {
        const ld = AppState.data.lofterData;
        if (!ld) return;
        if ((ld.articles || []).length >= 5) return;     // 已有内容跳过
        if (this._genLock) return;                        // 正在生成跳过

        // NPC 池为空检查（避免无声失败）
        const npcs = this._pickLofterNpcs(15);
        if (npcs.length === 0) {
            // 静默跳过、不弹 toast 打扰首次进入用户（NPC 池要先在微博建立）
            console.log('[Lofter] first-time seed skipped: NPC pool empty');
            return;
        }

        Utils.showToast(I18n.t('lofter.toast_first_time_seeding', '正在加载首批 lofter 内容、请稍等 10-20 秒...'), 8000);
        const articles = await this._generateLofterShorts(15);
        if (articles.length > 0) {
            Utils.showToast(I18n.t('lofter.toast_seed_done', { n: articles.length }), 3000);
            if (this.currentTab === 'home') this.renderHome();
        }
    },

    // 手动刷新（顶 bar 按钮触发）：追加 6 篇短文
    async refreshDiscover() {
        if (this._genLock) {
            Utils.showToast(I18n.t('lofter.toast_gen_in_progress', '正在生成中、请稍候'));
            return;
        }
        const before = (AppState.data.lofterData?.articles || []).length;
        Utils.showToast(I18n.t('lofter.toast_refreshing', '加载中...'), 4000);
        // v2.144.0 刷新防呆：先拿 Promise（_generateLofterShorts 同步段已 set _genLock）再 renderTopBar，
        // 让刷新键立刻置灰转圈；按钮忙态是 _genLock 的纯派生、不引第二状态。
        const p = this._generateLofterShorts(6);
        this.renderTopBar();
        try {
            const articles = await p;
            if (articles.length > 0) {
                const after = (AppState.data.lofterData?.articles || []).length;
                Utils.showToast(I18n.t('lofter.toast_refresh_done', { n: after - before }), 2500);
                if (this.currentTab === 'home') this.renderHome();
            }
        } finally {
            this.renderTopBar();   // _genLock 已清、刷新键恢复可点
        }
    },

    applyDarkMode() {
        // 跟随系统全局 dark theme（沿用 [data-theme="night-sky"] selector）
        // 实际不做事、CSS 选择器已经处理
    },

    bindEvents() {
        // tab button click 已在 HTML 上 onclick 绑、这里给 dark/light 主题切换钩子（Phase 1+ 用）
    },

    // ========== 数据 schema 初始化 ==========

    _ensureDataSchema() {
        if (!AppState.data.lofterData) {
            AppState.data.lofterData = this._defaultLofterData();
            Utils.saveData();
            return;
        }
        // 字段补全（增量迁移、不动已有字段）
        const ld = AppState.data.lofterData;
        const defaults = this._defaultLofterData();
        for (const key of Object.keys(defaults)) {
            if (ld[key] === undefined) ld[key] = defaults[key];
        }
        // settings 子字段补全
        if (!ld.settings) ld.settings = defaults.settings;
        for (const sKey of Object.keys(defaults.settings)) {
            if (ld.settings[sKey] === undefined) ld.settings[sKey] = defaults.settings[sKey];
        }
        // notifications 子字段补全
        if (!ld.notifications) ld.notifications = defaults.notifications;
        for (const nKey of Object.keys(defaults.notifications)) {
            if (!Array.isArray(ld.notifications[nKey])) ld.notifications[nKey] = [];
        }
        Utils.saveData();
    },

    _defaultLofterData() {
        return {
            articles: [],
            collections: [],
            followedAuthorIds: [],
            subscribedTags: [],
            subscribedCollectionIds: [],
            myLikedArticleIds: [],
            myFavoritedArticleIds: [],
            myFootprintArticleIds: [],
            myReadLaterArticleIds: [],
            companionValues: {},
            hotTagInfo: {},
            notifications: { likes: [], comments: [], other: [] },
            settings: {
                defaultViewMode: 'grid',         // 'grid' | 'list'
                showInvalidArticles: true,
                autoGenOnNewPlot: false,         // 仿 pixiv 同款独立开关
                autoGenCount: 2,                 // 1-5、剧情更新触发时生成 N 篇
                writingStyles: this._getDefaultWritingStyles()  // v2.81.0 长篇合集文风预设（内置 5 款、lofter 独立、_ensureDataSchema 自动给老存档补全）
            }
        };
    },

    // ========== 长篇合集文风预设（v2.81.0、内置固定 5 款、仅长篇连载用）==========
    // lofter 独立一份、不复用 pixiv 字面量。rules 是真正喂进章节 prompt 的文风指令。
    // 内置不可编辑（轻量方案）；用户在 compose modal 开合集时下拉选、续章自动继承。
    _getDefaultWritingStyles() {
        return [
            {
                id: 'lof_style_tender',
                name: '细腻情感流',
                description: '治愈 / 日常向、慢火细炖',
                rules: '慢节奏推进、心理描写绵密、善用环境与细节烘托情绪、句子偏长但不拖沓、捕捉微妙的情感流动；少冲突多余韵、把日常写出温度。',
                enabled: true
            },
            {
                id: 'lof_style_knife',
                name: '刀子暴击',
                description: '虐 / be 美学、克制堆痛',
                rules: '情感浓烈但叙述克制、靠对比和留白堆积痛感而非直接煽情、关键处用短句收束、擅长遗憾 / 错位 / 不可挽回；结尾余痛悬置、不强行和解。',
                enabled: true
            },
            {
                id: 'lof_style_banter',
                name: '嘴炮欢脱',
                description: '沙雕 / 对话向、节奏明快',
                rules: '对话驱动剧情、语言活泼有网感、善用吐槽和反差萌、节奏明快多用短句、角色互动鲜活有梗；轻松但不油腻、笑点自然不硬凹。',
                enabled: true
            },
            {
                id: 'lof_style_drama',
                name: '沉浸正剧',
                description: '剧情向、情节紧凑',
                rules: '情节逻辑优先、描写精炼有力、少抒情多推进、对话承担信息量、结构严谨层次分明；张力靠处境和抉择撑起、不靠内心独白注水。',
                enabled: true
            },
            {
                id: 'lof_style_lyric',
                name: '文艺意识流',
                description: '诗意向、意象丰富',
                rules: '意象密集、叙事可跳跃、多用通感与比喻、重视语言韵律和氛围营造、心理与外景交融；情绪先于情节、允许留白和未尽之语。',
                enabled: true
            }
        ];
    },

    // 解析用户在下拉里的选择 → 文风对象（'random'/找不到 → 随机一个 enabled）
    _resolveWritingStyle(styleChoice) {
        const styles = (AppState.data.lofterData?.settings?.writingStyles || []).filter(s => s.enabled);
        if (styles.length === 0) return null;
        if (styleChoice && styleChoice !== 'random') {
            const found = styles.find(s => s.id === styleChoice);
            if (found) return found;
        }
        return styles[Math.floor(Math.random() * styles.length)];
    },

    // 合集已保存的 writingStyleId → 文风对象（续章保持一致用、找不到返回 null 不强配）
    _resolveCollectionStyle(collection) {
        if (!collection?.writingStyleId) return null;
        const styles = AppState.data.lofterData?.settings?.writingStyles || [];
        return styles.find(s => s.id === collection.writingStyleId) || null;
    },

    // 文风对象 → 注入章节 prompt 的指令块（无文风返回空串）
    _styleInstructionFor(style) {
        return style && style.rules
            ? `\n【文风要求（本合集统一文风、续章保持一致）】\n${style.rules}\n`
            : '';
    },

    // ========== 老存档 NPC 迁移：补 lofter:{} 子字段 ==========
    // 不动 weiboData.fanFriends 现有任何字段、只追加 lofter 子字段
    _migrateExistingNpcs() {
        const wd = AppState.data.weiboData;
        if (!wd || !Array.isArray(wd.fanFriends) || wd.fanFriends.length === 0) return;

        let changed = 0;
        wd.fanFriends.forEach(npc => {
            if (npc.lofter) return; // 已迁移、跳过
            const isActive = this.LOFTER_ACTIVE_TYPES.includes(npc.type);
            // v2.73.11: 去掉死字段 favoriteCpTags / avgArticleLength / activeIPs（schema 预留但全文从未读 / 写）
            npc.lofter = {
                enabled: isActive,
                articleCount: 0,
                collectionIds: []
            };
            changed++;
        });
        if (changed > 0) {
            Utils.saveData();
            if (typeof console !== 'undefined') console.log(`[Lofter] migrated ${changed} NPCs with lofter:{} subfield`);
        }
    },

    // v2.73.11: 删 _defaultArticleLengthByType — 唯一调用点（avgArticleLength 字段）已删

    // ========== Plot Gate（剧情闸门、防止剧透）==========
    // lofter 的「读官方情报」核心：糖点挖掘 / 剧情讨论必须基于已发生剧情
    // 不复用 _getMerchGate（那是周边闸门）、lofter 自己一套
    _getPlotGate() {
        const plots = AppState.data.broadcast?.plotProgress || [];
        const officialInfo = AppState.data.broadcast?.officialInfo || [];
        if (plots.length === 0) {
            return {
                hasPlot: false,
                latestPlot: null,
                latestNum: 0,
                recentPlotsText: '',
                officialInfoCount: officialInfo.length,
                promptGateText: `\n【剧情进度铁律 — 最高优先级、严守】
当前世界观**尚未填入任何剧情节点**（剧情节点数 = 0）。

✗ 严禁讨论 / 分析 / 预告 / 推测**任何**剧情、严禁写"ep1 预告""下集预告""据说后面有 XX"
✗ 严禁编造主角 / 配角的剧情进展、严禁说"主角刚经历 XX"
✗ 严禁引用"官方剧透""制作组放话""声优透露"等捏造的未来信息

✓ 围绕 worldSetting / cp 设定写日常 / 角色短打 / 设定考据 / 创作 note / 卡文吐槽 / 摸鱼日记 等**非剧情向**内容
✓ 衍生同人剧情可以写、但必须明确标"if 线 / paro / 二创"、不当成正剧
`
            };
        }
        const latestNum = plots.length;
        const recent = plots.slice(-3);
        return {
            hasPlot: true,
            latestPlot: plots[plots.length - 1],
            latestNum,
            recentPlotsText: recent.map((p, i) => `Event ${plots.length - recent.length + i + 1}: 【${p.title}】${p.content}`).join('\n\n'),
            officialInfoCount: officialInfo.length,
            promptGateText: `\n【剧情进度铁律 — 最高优先级、严守】
当前世界观已发生的剧情节点**总数 = ${latestNum} 条**。最新已发生剧情 = 上方【世界观】里「剧情与情报时间线」的最后一条已播出节点（节点 ${latestNum}）。

**严禁的行为**（粉丝看到会破防 / 显得不真实 / 像 AI 幻觉）：
✗ 讨论 / 分析 / 预告 / 推测剧情节点 ${latestNum + 1} 或之后的内容（**这些节点不存在**）
✗ 写"ep${latestNum + 1} 预告""下集预告""下集会有 XX""据说后面..."等任何未发生的剧情
✗ 编造"剧情新进展""新角色登场""主角发生 XX 事"等不在上方时间线里的内容
✗ 引用"官方剧透""制作组放话""声优透露"等捏造的未来信息
✗ 写"刚看完最新一集就...."暗示比节点 ${latestNum} 更新的内容

**允许的行为**：
✓ 讨论 / 分析 / 抠糖最新剧情（节点 ${latestNum}）及之前的内容
✓ 角色性格 / CP 关系基于已发生剧情的解读
✓ 设定考据（基于 worldSetting / officialInfo）
✓ 创作 note / 卡文吐槽 / 摸鱼日记 / 角色立绘等**非剧情向**内容
✓ 衍生同人剧情（明确标"if 线 / paro / 二创"、不当成正剧推测）

宁可写日常 / 短打 / 创作 note、也不要编造未发生剧情。
`
        };
    },

    // ========== Worldcontext ==========
    // v2.80.0: 改吃全站标准 Forum.getWorldContext()（含【绑定世界书全 entries】+【完整剧情时间线含早期压缩总结】+【官方情报全文含分类标签/NPC 归属/发布节点】）
    // —— 根治 NPC OOC。旧版 lofter 私有缩水版只给 worldSetting 纯文本 + CP、世界书与官方情报内容全丢、剧情只取最近 3 条、模型缺料必然 OOC。
    // 末尾补回 lofter 专属 CP / 作品信息（Forum context 不含）。
    _getWorldContext() {
        let context = '';

        if (typeof Forum !== 'undefined' && Forum.getWorldContext) {
            context = Forum.getWorldContext() || '';
        } else if (AppState.data.broadcast?.worldSetting) {
            // fallback：Forum 不可用时退回原作世界观纯文本
            context += `【原作世界观】\n${AppState.data.broadcast.worldSetting}\n\n`;
        }

        const cp = AppState.data.broadcast?.cpSettings || {};
        if (cp.productionName) {
            context += `【主要作品】《${cp.productionName}》\n`;
        }
        if (cp.cpCharA && cp.cpCharB) {
            const nick = cp.cpNickname ? `（${cp.cpNickname}）` : '';
            context += `【主要 CP】${cp.cpCharA} × ${cp.cpCharB}${nick}\n`;
        }
        return context;
    },

    // ========== _callLLM（共用微博中文圈 API override）==========
    // 不在 lofter 单独存 apiOverride、共用 weiboData.apiOverride
    // systemPrompt（v2.94.2 新增、可选）：短文路径把作者人设/世界观/规则放 system role
    //   （DS 对 system 的指令遵循显著强于 user message）；其他路径（tag/长篇/合集）不传 = null、
    //   行为完全不变（整段仍走 user message）。
    // temperature（v2.120.0 起用户可调）：读 apiOverride.temperature（中文圈 API 设置卡的滑块、
    //   与微博共用）；用户没设过则沿用保险值 1。只作用于 lofter 自身的生成路径、
    //   不影响其他板块（Weibo._callLLM 是另一个独立同名方法、各管各的）。
    async _callLLM(prompt, systemPrompt = null) {
        const override = AppState.data.weiboData?.apiOverride;
        const overrideConfig = (override?.enabled && override.apiKey && override.model)
            ? {
                enabled: true,
                baseUrl: override.baseUrl,
                apiKey: override.apiKey,
                model: override.model
            }
            : null;
        // 中文圈用户温度（设置卡可调、与微博共用 apiOverride.temperature）；未设则沿用保险值 1。
        const userTemp = override?.temperature;
        const temp = (typeof userTemp === 'number') ? userTemp : 1;
        return await Utils.callChatAPI(
            [{ role: 'user', content: prompt }],
            systemPrompt,
            overrideConfig,
            { temperature: temp }
        );
    },

    // ========== Phase 1b: 短文批量生成（核心内容引擎）==========
    // 仿微博 _buildBatchWeiboPrompt + _parseWeiboBatch、但用 ---LOF--- 分隔块
    // 哲学（v2.72.3 沉淀）：给方向不给词、活人化、避开过气营销词
    // 不复用微博 prompt 字面量（lofter 哲学不同：节奏更慢、内容更深、文/图为主）

    // v2.141.0 文手 type → 简短中文标签（compose 点名下拉 / 文手管理列表用）
    _writerTypeLabel(type) {
        const map = {
            fan_writer: I18n.t('lofter.wtype_fan_writer', '文手'),
            fan_artist: I18n.t('lofter.wtype_fan_artist', '画手'),
            cp_fan: I18n.t('lofter.wtype_cp_fan', 'CP粉'),
            info_station: I18n.t('lofter.wtype_info_station', '情报站')
        };
        return map[type] || type;
    },

    // v2.141.0 「由谁来写」下拉的 option 列表（随机 + 传入的 writer 池）
    _buildWriterOptions(writers) {
        let html = `<option value="random">${I18n.t('lofter.compose_writer_random', '随机（让系统挑）')}</option>`;
        html += writers.map(w => {
            const tags = (w.contentTags || []).slice(0, 3).join('、');
            const tail = tags ? `｜${this._escapeHtml(tags)}` : '';
            return `<option value="${w.id}">${this._escapeHtml(w.name)}｜${this._writerTypeLabel(w.type)}${tail}</option>`;
        }).join('');
        return html;
    },

    // 从共用 NPC 池挑活跃 lofter 作者
    _pickLofterNpcs(count, preferType = null) {
        const all = AppState.data.weiboData?.fanFriends || [];
        let candidates = all.filter(f =>
            f.lofter?.enabled !== false &&
            this.LOFTER_ACTIVE_TYPES.includes(f.type)
        );
        if (candidates.length === 0) return [];

        // v2.82.0 文章类型联动：倾向某 type 时、有货优先从该 type 挑、没货 fallback 全池
        if (preferType) {
            const preferred = candidates.filter(f => f.type === preferType);
            if (preferred.length > 0) candidates = preferred;
        }

        // 按 type 多样性 pick（仿 _pickDiverseNpcs 同款）
        const byType = new Map();
        candidates.forEach(npc => {
            if (!byType.has(npc.type)) byType.set(npc.type, []);
            byType.get(npc.type).push(npc);
        });
        const types = [...byType.keys()].sort(() => Math.random() - 0.5);
        const picked = [];
        while (picked.length < count && types.some(t => byType.get(t).length > 0)) {
            for (const t of types) {
                if (picked.length >= count) break;
                const pool = byType.get(t);
                if (pool.length === 0) continue;
                const idx = Math.floor(Math.random() * pool.length);
                picked.push(pool.splice(idx, 1)[0]);
            }
        }
        return picked;
    },

    // 构造短文批量 prompt
    // userPrompt: 可选、用户给主题方向（compose modal textarea 输入）
    _buildShortPrompt(npcs, userPrompt = null, typeInfo = null) {
        const worldCtx = this._getWorldContext();
        const plotGate = this._getPlotGate();
        const cp = AppState.data.broadcast?.cpSettings || {};
        const recentArticles = (AppState.data.lofterData?.articles || []).slice(0, 30);

        // 每个 NPC 最近发文 dedup（避免反复发同主题）
        const recentByNpc = new Map();
        recentArticles.forEach(a => {
            if (!a.authorNpcId || !a.content) return;
            if (Date.now() - (a.createdAt || 0) > 24 * 60 * 60 * 1000) return;
            const arr = recentByNpc.get(a.authorNpcId) || [];
            arr.push({ content: a.content.slice(0, 50) });
            recentByNpc.set(a.authorNpcId, arr.slice(0, 2));
        });

        const npcLines = npcs.map((n, i) => {
            const tag = `[N${i + 1}]`;
            const styleNote = n.writingStyle ? ` | 文风：${String(n.writingStyle).slice(0, 80)}` : '';
            const head = `${tag} ${n.name} (@${n.handle || 'user_' + i}) | type=${n.type} | 简介：${n.bio || '（无）'} | 偏好：${(n.contentTags || []).join('、') || '（无）'}${styleNote}`;
            const recent = recentByNpc.get(n.id);
            if (!recent || recent.length === 0) return head;
            return head + '\n' + recent.map(r => `    └ 最近发过：${r.content}`).join('\n');
        }).join('\n\n');

        const userPromptBlock = userPrompt
            ? `\n【用户给的主题方向（最高优先级、本次生成所有篇都按这个方向倾斜）】\n${userPrompt}\n↑ 各 NPC 仍按 type 画像写、但内容主题 / 情绪 / 氛围都向这个方向靠拢（如 "刀子文学" → 写虐 / 离别 / 误解 / 不可挽回；"病名为爱" → 写病态依恋 / 失控；"久别重逢" → 写重逢瞬间的复杂情绪 等）。\n`
            : '';

        // v2.82.0 用户显式指定文章类型（手动单篇 compose、批量 seed 不传 = 百花齐放）
        const articleTypeBlock = (typeInfo && typeInfo.id !== 'random')
            ? `\n【用户指定文章类型（本篇必须是这个形态、优先级高于 NPC 画像默认行为）：${typeInfo.label}】\n${typeInfo.desc}\n↑ 即便被挑中的 NPC 平时偏别的方向、这一篇也要按「${typeInfo.label}」来写、TYPE 字段相应填 ${typeInfo.baseType}。\n`
            : '';

        const system = `你是中国 lofter 平台的同人创作者，正在发布你的新作或创作动态。

【你的定位 — 先是作者，其次才是粉丝】
你的首要任务是**写出文笔在线、角色还原的好内容**。你首先是一个「会写东西的作者」，把注意力放在作品本身——把人物写活、把情绪写到位、把那个瞬间写得有质感、有呼吸感。粉丝式的日常情绪（拖稿、卡文、嗑到糖、半夜不睡）是给作品做包装的调味，不要喧宾夺主，更不要让一篇沦为纯粹的碎碎念。
动笔前，先在心里过一遍：这个角色是什么性格、此刻在什么情境、ta 会怎么想、会怎么说话——想清楚了再落笔。宁可慢，也要像。

【角色还原 — 最高优先级】
你笔下出现的角色（无论原作角色还是世界观里的原创角色），都必须符合 ta 在下方世界观 / 世界书里的设定：
- 性格、价值观、行为逻辑要对得上 ta 的人设，不要写成另一个人
- 说话的语气、用词、节奏、口癖要像 ta 本人，而不是「一个角色在念台词」
- 角色之间的关系、相处模式、称呼要符合设定里的关系
- 与原作设定冲突的「魔改」只允许出现在明确标注的 if 线 / paro / 二创里、且仍要保留角色的内核
写得不像，就是这篇文最大的失败——比文笔平庸更糟。

【世界观】
${worldCtx || '（未设定）'}
${plotGate.promptGateText}

【生态底色 — lofter 不是微博】
- lofter 是中文同人圈的创作主战场（不是广场）：节奏更慢、内容更深、文 / 图为主
- 创作者心态：写完一篇会糟糕又会兴奋、读者评论很重要、嗑到了会激动
- 允许活人情绪：拖稿心虚 / 卡文焦虑 / 灵感来了 / 收到糖暴击 / 创作低潮 / 摸鱼日记 / 半夜不睡
- 不是营销号 / 不是创作教程 / 不是 AI 总结、是真实创作者随手发

【按 NPC type 的内容画像】
- fan_writer  — **写文为主、这是重点**：尽量发出一段真正的同人正文 / 片段（有场景、有对白、有情绪推进、角色写得像 ta 本人），而不只是谈"我在写"。写作笔记 / 自宣（不必每次）/ 角色分析 / 改三遍开头碎碎念 / 卡文丧 / 灵感暴击可作点缀。允许长一些（300-800 字）、把角色写像与文笔写稳放在第一位
- fan_artist  — 发图为主：草稿心得 / 摸鱼日记 / 角色立绘 / 画废了 / 只放局部 / 配图描述。允许文字非常简短（几十字够了）
- cp_fan      — 短打抠糖 / 糖点逐句分析 / 新粉求补课 / 整理粮单 / 接力安利。允许激动但不像营销号、**允许极轻度阴阳对家 CP**（不指向具体真人、不超一两句）
- info_station — 情报整理 / 周边介绍 / 设定考据 / 翻译杂志摘要 / 官方放出的截图描述。客观陈述、不掺感情

【中文同人圈常见的"梗 / 题材"调调 — 给你一种参考画像、不是清单】
中文同人圈喜欢的题材有它独特的"调调"。比如**巧思系**会拿一个具体的物件 / 场景做切口（捡手机、共感娃娃、史密斯夫妇、掉马甲、变小、xx 喂养手册、26 字字母、好感度数字、亲朋好友眼里的他们）；**关系动力学**喜欢小切片把感情张力撑出来（CP 相性一百问、论坛体、观影体、杀青梗、吃醋、双向暗恋、为什么会爱上对方）；**AU / paro / 平行**爱把人放进新设定看反应（HP paro、校园 paro、abo、灵魂互换的两个 A、未来的孩子穿越回来、一方穿越到在一起之前、年龄操作）；**情境 / 虐系**靠一个外部条件挤压感情（不 xx 就不能出去的房间、花吐症、生长痛、吊桥效应）。

↑ 这些只是**底色参考**、让你抓到"哦原来是这种调调"的感觉。**绝对不要照单挑** — 不要每次都从上面选一个梗写、也不要在短文里直接说"我在写 XX 梗"。同人圈每天都在发明新梗、太太们的脑洞远不止上面这些。fan_writer 可以提及自己在写某种梗（最自然）、cp_fan 可以聊嗑到的糖正好踩了某种梗（自然）、fan_artist 偶尔配图主题点到梗（一句话）。**绝大多数短文应该是即兴 / 当下情绪 / 创作日常、不是"今天交作业写 XX 梗"**。

【用语策略】
- 鼓励中文同人圈黑话 >= 圈内梗 >= 普通网络用语
- 具体用什么词由你按时效性自行判断、避开已经过气 / 营销号感的词
- 同人女生态自然语感、不要刻意"接地气"
- 标点可以非常规（「。。。」「！！！」「......」「？？」、emoji 自然散落不刻意）

【底线】
- 不评判其他粉丝群体 / 不贬低其他作品（cp_fan 允许极轻度对家阴阳、但不指向具体 NPC 真名、不让首页变撕逼）
- 不主动提及现实政治 / 性别议题
- 各 NPC 选不同切入点、避免扎堆同一话题
- 同 NPC 不要跟上方 "最近发过" 重复主题

【铁律】必须使用简体中文输出。严禁繁体字、严禁日语 / 英语整句（OOC 等少数 ACG 缩写可保留）。

【严格输出格式】对每个 NPC 用 ---LOF--- 分隔、含正文 + 3-8 条评论：
---LOF---
TAG: [N1]
TYPE: [short]
TITLE: [可选、短文常没有、放空行即可]
SUMMARY: [可选、列表卡片用、80 字内]
TAGS: [#标签1 #标签2 #标签3]
CONTENT:
[正文。多行均可。]
HAS_IMAGES: [true / false]
IMAGE_COUNT: [0-9、HAS_IMAGES=false 时填 0]
CP_FLAG: [main / none / multi]
EDITED_AGO: ['刚刚' / '1小时前' / '4天前' 等模糊时间]
EDIT_LOCATION: [北京 / 上海 / 广东 / 江苏 等真实地区]
COMMENT_1: [评论者昵称]|[内容]
COMMENT_2: [评论者昵称]|[内容]
COMMENT_3: [评论者昵称]|[内容]
... (3-8 条不等)
---LOF---
TAG: [N2]
...

不要输出 JSON、不要 markdown 代码块、不要 prefix、不要其他说明文字。`;

        // user：本次具体任务（NPC 列表 + 用户方向 + 触发）—— 动态部分放 user message
        const user = `按下方 NPC 列表，为每个 NPC 各写 1 篇短文 / 杂谈，共 ${npcs.length} 篇。
${userPromptBlock}${articleTypeBlock}
【NPC 列表（按 TAG 顺序生成、每 NPC 1 篇）】
${npcLines}

请严格按 system 里规定的 ---LOF--- 格式输出这 ${npcs.length} 篇。记住：先把角色写像、把文笔写稳，再考虑粉丝氛围与配图。`;

        return { system, user };
    },

    // 解析 ---LOF--- 分隔块
    _parseLofterBatch(raw, npcs) {
        if (!raw) return [];
        const blocks = raw.split(/---\s*LOF\s*---/i).map(s => s.trim()).filter(Boolean);
        const result = [];
        for (const block of blocks) {
            const tagMatch = block.match(/TAG:\s*\[?N(\d+)\]?/i);
            if (!tagMatch) continue;
            const idx = parseInt(tagMatch[1], 10) - 1;
            const npc = npcs[idx];
            if (!npc) continue;

            const typeRaw = (block.match(/^TYPE:\s*(short|meta|long)/im) || [])[1]?.toLowerCase();
            const articleType = (typeRaw === 'meta' ? 'meta' : 'short'); // long 走单独路径、batch 阶段只 short / meta
            const title = (block.match(/^TITLE:\s*(.+)$/m) || [])[1]?.trim() || null;
            const summary = (block.match(/^SUMMARY:\s*([\s\S]*?)(?=\n[A-Z_]+:)/m) || [])[1]?.trim() || null;
            const tagsRaw = (block.match(/^TAGS:\s*(.+)$/m) || [])[1]?.trim() || '';
            const tags = tagsRaw.split(/\s+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean).slice(0, 6);
            const contentMatch = block.match(/CONTENT:\s*([\s\S]*?)(?=\nHAS_IMAGES:|\nCOMMENT_\d|\nIMAGE_COUNT:|\nCP_FLAG:|\nEDITED_AGO:|\nEDIT_LOCATION:|$)/i);
            const content = contentMatch ? contentMatch[1].trim() : '';
            if (!content || content.length < 5) continue;

            const hasImagesRaw = (block.match(/^HAS_IMAGES:\s*(true|false)/im) || [])[1]?.toLowerCase();
            const hasImages = hasImagesRaw === 'true' || npc.type === 'fan_artist';
            const imageCount = parseInt((block.match(/^IMAGE_COUNT:\s*(\d+)/im) || [])[1] || (hasImages ? '1' : '0'), 10);
            const cpFlagRaw = (block.match(/^CP_FLAG:\s*(main|none|multi)/im) || [])[1]?.toLowerCase();
            const cpFlag = cpFlagRaw || 'none';
            const editedAgo = (block.match(/^EDITED_AGO:\s*(.+)$/m) || [])[1]?.trim() || '刚刚';
            const editLocation = (block.match(/^EDIT_LOCATION:\s*(.+)$/m) || [])[1]?.trim() || '';

            // COMMENT_N 解析
            const comments = [];
            const commentRe = /^COMMENT_\d+:\s*(.+?)\|(.+)$/mg;
            let cm;
            while ((cm = commentRe.exec(block)) !== null) {
                const author = cm[1].trim();
                const text = cm[2].trim();
                if (!author || !text) continue;
                comments.push({ author, content: text });
            }

            result.push({
                npc,
                articleType,
                title,
                summary,
                tags,
                content,
                hasImages,
                imageCount: Math.max(0, Math.min(9, imageCount)),
                cpFlag,
                editedAgo,
                editLocation,
                comments
            });
        }
        return result;
    },

    // 拼 article 对象
    _buildArticleFromBlock(parsed) {
        const { npc, articleType, title, summary, tags, content, hasImages, imageCount, cpFlag, editedAgo, editLocation, comments } = parsed;
        const fc = npc.followerCount || 1000;
        const now = Date.now();
        const articleId = 'lof_' + this._uuid();

        // 评论拼装（仿微博 inline reply 同款模式）
        const commentsList = (comments || []).slice(0, 8).map((c, i) => ({
            id: 'lcm_' + this._uuid(),
            npcId: null,
            author: c.author,
            handle: null,
            content: c.content,
            createdAt: now + i * 800,
            likes: Math.floor(Math.random() * Math.max(2, fc * 0.001)),
            replyToCommentId: null,
            isOpReply: false
        }));

        return {
            id: articleId,
            type: articleType,
            title,
            summary,
            content,
            hasImages,
            imageCount,
            tags: tags || [],
            authorNpcId: npc.id,
            authorName: npc.name,
            collectionId: null,
            chapterNum: null,
            cpFlag,
            stats: {
                hearts: Math.floor(Math.random() * fc * 0.04),
                favorites: Math.floor(Math.random() * fc * 0.015),
                comments: commentsList.length
            },
            commentsList,
            editedAt: now,
            editedAgoDisplay: editedAgo,
            editLocation,
            createdAt: now,
            isInvalid: false
        };
    },

    // 批量生成入口（in-flight guard、共用 weibo apiOverride）
    // userPrompt: 可选、用户给 NPC 的主题方向（compose modal 输入、留空 = 自由发挥）
    async _generateLofterShorts(count = 6, userPrompt = null, articleType = null, writerId = null) {
        if (this._genLock) {
            Utils.showToast(I18n.t('lofter.toast_gen_in_progress', '正在生成中、请稍候'));
            return [];
        }
        const ld = AppState.data.lofterData;
        if (!ld) return [];

        // v2.82.0 用户显式文章类型 → 解析映射 + 联动挑 NPC（仅手动单篇传、批量路径不传）
        const typeInfo = articleType
            ? this.LOFTER_ARTICLE_TYPES.find(t => t.id === articleType && t.id !== 'random')
            : null;
        // v2.141.0 用户在 compose 点名指定文手 → 直接用 ta（绕过随机挑）；writerId 留空维持原随机逻辑
        let npcs;
        if (writerId) {
            const picked = (AppState.data.weiboData?.fanFriends || []).find(f => f.id === writerId);
            if (!picked) {
                Utils.showToast(I18n.t('lofter.toast_writer_gone', '该文手不存在或已被删除'), 3000);
                return [];
            }
            npcs = [picked];
        } else {
            npcs = this._pickLofterNpcs(count, typeInfo?.preferType || null);
        }
        if (npcs.length === 0) {
            Utils.showToast(I18n.t('lofter.toast_npc_empty', '中文圈 NPC 池为空、请先在微博 / 放送局填充 CP 设定后刷新一次'), 3000);
            return [];
        }

        this._genLock = Date.now();
        try {
            const { system, user } = this._buildShortPrompt(npcs, userPrompt, typeInfo);
            const raw = await this._callLLM(user, system);
            const parsedBlocks = this._parseLofterBatch(raw, npcs);
            if (parsedBlocks.length === 0) {
                Utils.showToast(I18n.t('lofter.toast_gen_format_error', '生成格式错误、请稍后重试'));
                return [];
            }
            const newArticles = parsedBlocks.map(b => this._buildArticleFromBlock(b));
            // 用户指定了文章类型时、强制覆盖 AI 自填的 short/meta（联动 + 形态已在 prompt 要求）
            if (typeInfo?.baseType) newArticles.forEach(a => { a.type = typeInfo.baseType; });
            // unshift 到 articles 池开头（按时间倒序）
            newArticles.forEach(a => ld.articles.unshift(a));
            // 更新 NPC 的 articleCount
            newArticles.forEach(a => {
                const npc = (AppState.data.weiboData?.fanFriends || []).find(f => f.id === a.authorNpcId);
                if (npc?.lofter) npc.lofter.articleCount = (npc.lofter.articleCount || 0) + 1;
            });
            Utils.saveData();
            return newArticles;
        } catch (e) {
            console.error('[Lofter shorts gen]', e);
            Utils.showToast(I18n.t('lofter.toast_gen_failed', '生成失败：') + (e.message || ''));
            return [];
        } finally {
            this._genLock = null;
        }
    },

    // ========== 工具方法 ==========

    _uuid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    },

    _escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    _formatTime(ts) {
        if (!ts) return '';
        const diff = Date.now() - ts;
        if (diff < 60_000) return I18n.t('lofter.time_just_now', '刚刚');
        if (diff < 3600_000) return Math.floor(diff / 60_000) + I18n.t('lofter.time_min_ago', '分钟前');
        if (diff < 86400_000) return Math.floor(diff / 3600_000) + I18n.t('lofter.time_hr_ago', '小时前');
        if (diff < 7 * 86400_000) return Math.floor(diff / 86400_000) + I18n.t('lofter.time_day_ago', '天前');
        const d = new Date(ts);
        return `${d.getMonth() + 1}-${d.getDate()}`;
    },

    _formatMonthYear(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        return I18n.t('lofter.month_year', { y: d.getFullYear(), m: d.getMonth() + 1 });
    },

    // ========== Tab 切换 ==========
    switchTab(tab) {
        // compose / store 是占位 button、不切 tab、走自己的 click handler
        if (tab === 'compose' || tab === 'store') return;
        this.currentTab = tab;
        // 高亮 active button
        document.querySelectorAll('#lofter .lof-nav-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.lofTab === tab);
        });
        this.render();
    },

    // 中间 + 按钮：弹 modal 让用户主动触发 NPC 生成新内容
    // 用户不能手写文章（lofter 沉浸感铁律：不像 pixiv 保留 textarea 入口）、
    // 但能主动让 NPC 写新短文 / 开新合集 / 续章
    handleComposeClick() {
        this.openComposeModal();
    },
    handleStoreClick() {
        Utils.showToast(I18n.t('lofter.toast_store_unavailable', '网易乐谷功能不在仿真范围内'), 2500);
    },

    openComposeModal() {
        const ld = AppState.data.lofterData;
        if (!ld) return;
        const fans = AppState.data.weiboData?.fanFriends || [];
        const eligibleWriters = fans.filter(f =>
            f.lofter?.enabled !== false && f.type === 'fan_writer' && (f.lofter?.articleCount || 0) >= 1
        );
        const npcPoolEmpty = (fans.filter(f =>
            f.lofter?.enabled !== false && this.LOFTER_ACTIVE_TYPES.includes(f.type)
        )).length === 0;
        const canCreateCollection = eligibleWriters.length > 0;

        // v2.81.0 合集文风下拉选项（内置 5 款 enabled、仅长篇连载用）
        const _enabledStyles = (AppState.data.lofterData?.settings?.writingStyles || []).filter(s => s.enabled);
        const styleOptionsHtml = `<option value="random">${I18n.t('lofter.compose_style_random', '随机（让作者自由发挥）')}</option>`
            + _enabledStyles.map(s => `<option value="${s.id}">${s.name}｜${s.description}</option>`).join('');

        // v2.82.0 两步式：第一层选「短文 / 合集」→ 进各自二级表单（短文=主题+文章类型、合集=主题+文风）
        const node = this._openSubScreen('lofComposeModal',
            `<div class="lof-compose-overlay"><div class="lof-compose-modal" id="lofComposeInner"></div></div>`);
        if (!node) return;
        const overlay = node.querySelector('.lof-compose-overlay');
        overlay.onclick = (e) => { if (e.target === overlay) this._closeSubScreen('lofComposeModal'); };
        const inner = node.querySelector('#lofComposeInner');
        const close = () => this._closeSubScreen('lofComposeModal');

        const themeLabel = I18n.t('lofter.compose_user_prompt_label', '主题方向（选填、留空让作者自由发挥）');
        const themePlaceholder = I18n.t('lofter.compose_user_prompt_placeholder', '例：刀子文学 / 病名为爱 / 久别重逢 / xx 的使用手册 / 想看 if 线 / 想看校园 paro...');
        const arrowSvg = `<svg class="lof-compose-opt-arrow" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

        // ===== 第一层：选创作类型 =====
        const renderStep1 = () => {
            inner.innerHTML = `
                <div class="lof-compose-bar">
                    <button class="lof-compose-close" id="lofComposeClose">×</button>
                    <div class="lof-compose-title">${I18n.t('lofter.compose_modal_title', '让太太们写点什么')}</div>
                </div>
                <div class="lof-compose-note">${I18n.t('lofter.compose_modal_note', 'Lofter 是创作主战场、用户不发文 — 但可以主动让 NPC 太太们写新内容')}</div>
                ${npcPoolEmpty ? `<div class="lof-compose-empty-warn">${I18n.t('lofter.compose_npc_pool_empty', '中文圈 NPC 池为空、请先在微博 / 放送局填充 CP 设定再来')}</div>` : ''}
                <div class="lof-compose-options ${npcPoolEmpty ? 'disabled' : ''}">
                    <button class="lof-compose-option" id="lofComposeShort" ${npcPoolEmpty ? 'disabled' : ''}>
                        <div class="lof-compose-opt-icon" style="background:#ffe0e8;color:#ff6b9d">
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
                        </div>
                        <div class="lof-compose-opt-body">
                            <div class="lof-compose-opt-title">${I18n.t('lofter.compose_short_title', '让 NPC 写一篇短文')}</div>
                            <div class="lof-compose-opt-desc">${I18n.t('lofter.compose_short_desc', '从活跃太太池随机挑 1 位、写一篇短文 / 创作 note / 角色分析等')}</div>
                        </div>
                        ${npcPoolEmpty ? '' : arrowSvg}
                    </button>
                    <button class="lof-compose-option" id="lofComposeCollection" ${(npcPoolEmpty || !canCreateCollection) ? 'disabled' : ''}>
                        <div class="lof-compose-opt-icon" style="background:#dceffd;color:#3b82f6">
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                        </div>
                        <div class="lof-compose-opt-body">
                            <div class="lof-compose-opt-title">${I18n.t('lofter.compose_collection_title', '让 NPC 开个新合集（长篇连载）')}</div>
                            <div class="lof-compose-opt-desc">${canCreateCollection
                                ? I18n.t('lofter.compose_collection_desc', '从同人文手 NPC 池挑 1 位、生成合集元数据 + 写第 1 章（1500-3000 字）')
                                : I18n.t('lofter.compose_collection_disabled', '需要至少 1 位发过文的同人文手 NPC、先用「短文」给文手们攒发文记录')
                            }</div>
                        </div>
                        ${(npcPoolEmpty || !canCreateCollection) ? '' : arrowSvg}
                    </button>
                </div>
                <div class="lof-compose-note" style="text-align:left; padding:0 16px 18px; color:#888;">
                    ${I18n.t('lofter.compose_continue_hint', '想给某个合集续写下一章？进合集页里点「续写下一章」按钮、可以填本章方向（仿 pixiv 同款）。')}
                </div>
            `;
            document.getElementById('lofComposeClose').onclick = close;
            const sBtn = document.getElementById('lofComposeShort');
            if (sBtn && !sBtn.disabled) sBtn.onclick = () => renderShortForm();
            const cBtn = document.getElementById('lofComposeCollection');
            if (cBtn && !cBtn.disabled) cBtn.onclick = () => renderCollectionForm();
        };

        // ===== 二级 A：短文表单（由谁来写 + 主题方向 + 文章类型）=====
        const renderShortForm = () => {
            const typeOpts = this.LOFTER_ARTICLE_TYPES.map((t, i) => {
                const label = t.id === 'random'
                    ? I18n.t('lofter.atype_random', '随机（作者自由发挥）')
                    : I18n.t('lofter.atype_' + t.id, t.label);
                return `<label class="lof-atype-opt">
                    <input type="radio" name="lofAtype" value="${t.id}" ${i === 0 ? 'checked' : ''}>
                    <span class="lof-atype-dot"></span>
                    <span class="lof-atype-name">${label}</span>
                </label>`;
            }).join('');
            // v2.141.0 点名：活跃 lofter 文手（含 cp_fan / 情报站、能点名让谁写）
            const shortWriters = (AppState.data.weiboData?.fanFriends || []).filter(f =>
                f.lofter?.enabled !== false && this.LOFTER_ACTIVE_TYPES.includes(f.type)
            );
            const shortWriterOpts = this._buildWriterOptions(shortWriters);
            inner.innerHTML = `
                <div class="lof-compose-bar">
                    <button class="lof-compose-back" id="lofComposeBack">‹</button>
                    <div class="lof-compose-title">${I18n.t('lofter.compose_short_step_title', '让 NPC 写短文')}</div>
                </div>
                <div class="lof-compose-hint-wrap">
                    <label class="lof-compose-hint-label">${I18n.t('lofter.compose_writer_label', '由谁来写')}</label>
                    <select id="lofShortWriter" class="lof-compose-style-select">${shortWriterOpts}</select>
                </div>
                <div class="lof-compose-hint-wrap">
                    <label class="lof-compose-hint-label">${themeLabel}</label>
                    <textarea id="lofShortHint" rows="3" class="lof-compose-hint-textarea" placeholder="${themePlaceholder}"></textarea>
                </div>
                <div class="lof-compose-hint-wrap">
                    <label class="lof-compose-hint-label">${I18n.t('lofter.compose_atype_label', '文章类型')}</label>
                    <div class="lof-atype-list">${typeOpts}</div>
                </div>
                <div class="lof-compose-submit-wrap">
                    <button class="lof-compose-submit" id="lofShortSubmit">${I18n.t('lofter.compose_start_short', '开始写')}</button>
                </div>
            `;
            document.getElementById('lofComposeBack').onclick = () => renderStep1();
            document.getElementById('lofShortSubmit').onclick = async () => {
                const userPrompt = (document.getElementById('lofShortHint')?.value || '').trim() || null;
                const atype = document.querySelector('input[name="lofAtype"]:checked')?.value || 'random';
                const wSel = document.getElementById('lofShortWriter')?.value || 'random';
                const writerId = wSel !== 'random' ? wSel : null;
                close();
                Utils.showToast(I18n.t('lofter.toast_generating_short', '正在让太太写新短文、请稍等 5-10 秒...'), 6000);
                const articles = await this._generateLofterShorts(1, userPrompt, atype, writerId);
                if (articles.length > 0) {
                    Utils.showToast(I18n.t('lofter.toast_short_done', '✓ 新短文已生成、首页可见'), 2500);
                    if (this.currentTab === 'home') this.renderHome();
                }
            };
        };

        // ===== 二级 B：合集表单（由谁来写 + 主题方向 + 文风）=====
        const renderCollectionForm = () => {
            // v2.141.0 点名：只列够格的同人文手（发过 ≥1 篇）
            const colWriterOpts = this._buildWriterOptions(eligibleWriters);
            inner.innerHTML = `
                <div class="lof-compose-bar">
                    <button class="lof-compose-back" id="lofComposeBack">‹</button>
                    <div class="lof-compose-title">${I18n.t('lofter.compose_col_step_title', '让 NPC 开新合集')}</div>
                </div>
                <div class="lof-compose-hint-wrap">
                    <label class="lof-compose-hint-label">${I18n.t('lofter.compose_writer_label', '由谁来写')}</label>
                    <select id="lofColWriter" class="lof-compose-style-select">${colWriterOpts}</select>
                </div>
                <div class="lof-compose-hint-wrap">
                    <label class="lof-compose-hint-label">${themeLabel}</label>
                    <textarea id="lofColHint" rows="3" class="lof-compose-hint-textarea" placeholder="${themePlaceholder}"></textarea>
                </div>
                <div class="lof-compose-hint-wrap">
                    <label class="lof-compose-hint-label">${I18n.t('lofter.compose_col_style_label', '文风（整本合集统一）')}</label>
                    <select id="lofColStyle" class="lof-compose-style-select">${styleOptionsHtml}</select>
                </div>
                <div class="lof-compose-submit-wrap">
                    <button class="lof-compose-submit" id="lofColSubmit">${I18n.t('lofter.compose_start_col', '开始连载')}</button>
                </div>
            `;
            document.getElementById('lofComposeBack').onclick = () => renderStep1();
            document.getElementById('lofColSubmit').onclick = async () => {
                const userPrompt = (document.getElementById('lofColHint')?.value || '').trim() || null;
                const styleChoice = document.getElementById('lofColStyle')?.value || 'random';
                const wSel = document.getElementById('lofColWriter')?.value || 'random';
                close();
                // 点名 → 用指定文手；随机 → 从够格池随机
                const picked = (wSel !== 'random' && eligibleWriters.find(w => w.id === wSel))
                    || eligibleWriters[Math.floor(Math.random() * eligibleWriters.length)];
                Utils.showToast(I18n.t('lofter.toast_generating_collection', { name: picked.name }), 10000);
                const collection = await this._generateLofterCollection(picked, null, userPrompt, styleChoice);
                if (collection) {
                    Utils.showToast(I18n.t('lofter.toast_collection_done', { name: collection.name }), 3500);
                    setTimeout(() => this.openCollectionPage(collection.id), 600);
                }
            };
        };

        renderStep1();
    },

    // ========== 续写下一章 modal（pixiv 同款 UX、合集页内部入口）==========

    showNextChapterModal(collectionId) {
        const ld = AppState.data.lofterData;
        if (!ld) return;
        const collection = (ld.collections || []).find(c => c.id === collectionId);
        if (!collection) return;
        const targetNum = (collection.chapterCount || 0) + 1;
        const author = (AppState.data.weiboData?.fanFriends || []).find(f => f.id === collection.authorNpcId);
        // v2.141.0 作者已删号退圈 → 无法续写（_generateNextLofterChapter 也会 return null）、提前拦下给明确提示
        if (!author) {
            Utils.showToast(I18n.t('lofter.next_ch_author_gone', '作者已注销、无法续写这个合集（旧章节仍保留）'), 3000);
            return;
        }

        const inner = `
            <div class="lof-compose-overlay">
                <div class="lof-compose-modal">
                    <div class="lof-compose-bar">
                        <button class="lof-compose-close" id="lofNextChClose">×</button>
                        <div class="lof-compose-title">${I18n.t('lofter.next_ch_title', { n: targetNum })}</div>
                    </div>
                    <div class="lof-compose-note">${I18n.t('lofter.next_ch_desc', { name: collection.name, author: author?.name || '?' })}</div>
                    <div class="lof-next-ch-form">
                        <label class="lof-next-ch-label">${I18n.t('lofter.next_ch_hint_label', '本章方向（选填、留空让作者自由续写）')}</label>
                        <textarea id="lofNextChHint" rows="4" placeholder="${I18n.t('lofter.next_ch_hint_placeholder', '例：A 在雨夜中意外找到了独自疗伤的 B、终于说出了一直藏在心底的话。')}" class="lof-next-ch-textarea"></textarea>
                    </div>
                    <div class="lof-next-ch-actions">
                        <button class="lof-next-ch-btn cancel" id="lofNextChCancel">${I18n.t('lofter.btn_cancel', '取消')}</button>
                        <button class="lof-next-ch-btn primary" id="lofNextChConfirm">${I18n.t('lofter.btn_generate', '生成')}</button>
                    </div>
                </div>
            </div>
        `;

        const node = this._openSubScreen('lofNextChapterModal', inner);
        if (!node) return;
        document.getElementById('lofNextChClose').onclick = () => this._closeSubScreen('lofNextChapterModal');
        document.getElementById('lofNextChCancel').onclick = () => this._closeSubScreen('lofNextChapterModal');
        node.querySelector('.lof-compose-overlay').onclick = (e) => {
            if (e.target.classList.contains('lof-compose-overlay')) {
                this._closeSubScreen('lofNextChapterModal');
            }
        };
        document.getElementById('lofNextChConfirm').onclick = async () => {
            const hint = (document.getElementById('lofNextChHint')?.value || '').trim();
            this._closeSubScreen('lofNextChapterModal');
            Utils.showToast(I18n.t('lofter.toast_generating_chapter_for', { name: collection.name }), 10000);
            const chapter = await this._generateNextLofterChapter(collectionId, hint);
            if (chapter) {
                Utils.showToast(I18n.t('lofter.toast_chapter_done', { n: chapter.chapterNum }), 3500);
                // 关闭旧合集页 + 重新打开（不嵌套）
                this._closeSubScreen('lofCollectionSubScreen');
                this.openCollectionPage(collectionId);
            }
        };
    },

    // ========== 顶部 bar + 主 render 分流 ==========
    render() {
        this.renderTopBar();
        if (this.currentTab === 'home') this.renderHome();
        else if (this.currentTab === 'follow') this.renderFollow();
        else if (this.currentTab === 'me') this.renderMe();
    },

    renderTopBar() {
        const center = document.getElementById('lofTopCenter');
        const right = document.getElementById('lofTopRight');
        if (!center || !right) return;

        if (this.currentTab === 'home') {
            // 顶 sub-tab：发现 / 广场
            center.innerHTML = `
                <button class="lof-top-tab ${this._homeSubTab === 'discover' ? 'active' : ''}" data-sub="discover">${I18n.t('lofter.subtab_discover', '发现')}</button>
                <button class="lof-top-tab ${this._homeSubTab === 'plaza' ? 'active' : ''}" data-sub="plaza">${I18n.t('lofter.subtab_plaza', '广场')}</button>
            `;
            right.innerHTML = `
                <button class="lof-top-icon ${this._genLock ? 'lof-refreshing' : ''}" onclick="Lofter.refreshDiscover()" aria-label="refresh" title="刷新" ${this._genLock ? 'disabled' : ''}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                </button>
                <button class="lof-top-icon" onclick="Utils.showToast(I18n.t('lofter.toast_search_coming_soon', '搜索功能 Phase 4 上线'))" aria-label="search">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </button>
            `;
            center.querySelectorAll('.lof-top-tab').forEach(btn => {
                btn.onclick = () => { this._homeSubTab = btn.dataset.sub; this.renderTopBar(); this.renderHome(); };
            });
        } else if (this.currentTab === 'follow') {
            center.innerHTML = `
                <button class="lof-top-tab ${this._followSubTab === 'following' ? 'active' : ''}" data-sub="following">${I18n.t('lofter.subtab_following', '关注')}</button>
                <button class="lof-top-tab ${this._followSubTab === 'subscribed' ? 'active' : ''}" data-sub="subscribed">${I18n.t('lofter.subtab_subscribed', '订阅')}</button>
            `;
            right.innerHTML = '';
            center.querySelectorAll('.lof-top-tab').forEach(btn => {
                btn.onclick = () => { this._followSubTab = btn.dataset.sub; this.renderTopBar(); this.renderFollow(); };
            });
        } else if (this.currentTab === 'me') {
            center.innerHTML = `<div class="lof-top-title">${I18n.t('lofter.top_me', '我的')}</div>`;
            right.innerHTML = `
                <button class="lof-top-icon" onclick="Lofter.openSettingsSubScreen()" aria-label="settings">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                </button>
            `;
        }
    },

    // ========== 首页（home tab）==========
    renderHome() {
        const body = document.getElementById('lofter-body');
        if (!body) return;

        // 子分类 chip 横滚 + 大 banner + 双栏瀑布流
        const chipsHTML = this._renderCategoryChips();
        const bannerHTML = this._renderHomeBanner();
        const feedHTML = this._renderDiscoverFeed();

        body.innerHTML = `
            <div class="lof-chips-row">${chipsHTML}</div>
            ${bannerHTML}
            <div class="lof-feed-wrap">${feedHTML}</div>
        `;

        // 绑 chip click
        body.querySelectorAll('.lof-cat-chip').forEach(chip => {
            chip.onclick = () => this._handleCategoryChipClick(chip.dataset.cat);
        });
        // 绑卡片点击 → 详情页
        body.querySelectorAll('.lof-card').forEach(card => {
            card.onclick = (e) => {
                if (e.target.closest('button, a')) return;
                const articleId = card.dataset.articleId;
                if (articleId) this.openArticleDetail(articleId);
            };
        });
    },

    _renderCategoryChips() {
        const cats = [
            { id: 'recommend', label: I18n.t('lofter.chip_recommend', '推荐'), real: true },
            { id: 'audio', label: I18n.t('lofter.chip_audio', '听书'), beta: true },
            { id: 'serial', label: I18n.t('lofter.chip_serial', '连载'), real: true },
            { id: 'video', label: I18n.t('lofter.chip_video', '视频'), placeholder: true },
            { id: 'store', label: I18n.t('lofter.chip_store', '太太摆摊'), placeholder: true }
        ];
        return cats.map(c => {
            const isActive = c.id === this._categoryChip;
            const betaBadge = c.beta ? '<span class="lof-chip-beta">Beta</span>' : '';
            return `<button class="lof-cat-chip ${isActive ? 'active' : ''}" data-cat="${c.id}">${this._escapeHtml(c.label)}${betaBadge}</button>`;
        }).join('');
    },

    _handleCategoryChipClick(catId) {
        if (catId === 'audio' || catId === 'video' || catId === 'store') {
            Utils.showToast(I18n.t('lofter.toast_category_placeholder', '该分类暂不在仿真范围、即将上线'), 2000);
            return;
        }
        this._categoryChip = catId;
        this.renderHome();
    },

    _renderHomeBanner() {
        // Phase 0b 占位 banner（点击 toast）
        return `
            <div class="lof-banner" onclick="Utils.showToast(I18n.t('lofter.toast_event_placeholder', '同人谷活动暂不在仿真范围'), 2000)">
                <div class="lof-banner-text">
                    <div class="lof-banner-title">${I18n.t('lofter.banner_event_title', '同人谷限时售卖')}</div>
                    <div class="lof-banner-sub">${I18n.t('lofter.banner_event_sub', '太太摆摊・好物推荐中')}</div>
                </div>
                <div class="lof-banner-decor">
                    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                </div>
            </div>
        `;
    },

    // ========== 双栏瀑布流 feed ==========
    _renderDiscoverFeed() {
        const articles = this._getDiscoverArticles();
        if (articles.length === 0) {
            return `
                <div class="lof-empty">
                    <div class="lof-empty-text">${I18n.t('lofter.empty_discover', '下拉刷新或等待 NPC 太太们发新文')}</div>
                    <button class="lof-refresh-btn" onclick="Lofter.refreshDiscover()">
                        ${I18n.t('lofter.btn_refresh', '刷新一下')}
                    </button>
                </div>
            `;
        }
        // 双栏瀑布流：奇数索引进左、偶数进右、自然错位
        const left = [];
        const right = [];
        articles.forEach((a, i) => {
            (i % 2 === 0 ? left : right).push(a);
        });
        return `
            <div class="lof-feed">
                <div class="lof-col">${left.map(a => this._renderArticleCard(a)).join('')}</div>
                <div class="lof-col">${right.map(a => this._renderArticleCard(a)).join('')}</div>
            </div>
        `;
    },

    _getDiscoverArticles() {
        const all = AppState.data.lofterData?.articles || [];
        let filtered = all.slice();
        if (this._categoryChip === 'serial') {
            filtered = filtered.filter(a => a.type === 'long');
        }
        // 按热度（hearts + favorites）weighted + createdAt 时间因素混排
        filtered.sort((a, b) => {
            const hotA = (a.stats?.hearts || 0) + (a.stats?.favorites || 0) * 1.5;
            const hotB = (b.stats?.hearts || 0) + (b.stats?.favorites || 0) * 1.5;
            const recencyA = a.createdAt || 0;
            const recencyB = b.createdAt || 0;
            return (hotB + recencyB / 100000) - (hotA + recencyA / 100000);
        });
        return filtered.slice(0, 40);
    },

    _renderArticleCard(article) {
        const author = this._resolveAuthorDisplay(article);
        const tagBadge = this._renderArticleTopBadge(article);
        const hearts = article.stats?.hearts || 0;
        const heartsLiked = (AppState.data.lofterData?.myLikedArticleIds || []).includes(article.id);
        const imgBlock = this._renderArticleCardImage(article);
        const titleBlock = article.title
            ? `<div class="lof-card-title">${this._escapeHtml(article.title)}</div>`
            : '';
        // long 类型卡片不显示 summary（LLM 内部章节摘要、用户不可见）；用 content 摘要兜底
        const cardSummary = article.type === 'long'
            ? (article.content || '').slice(0, 120)
            : (article.summary || article.content || '').slice(0, 120);
        const summaryBlock = cardSummary
            ? `<div class="lof-card-summary">${this._escapeHtml(cardSummary)}</div>`
            : '';
        const tagsBlock = (article.tags || []).length > 0
            ? `<div class="lof-card-tags">${article.tags.slice(0, 3).map(t => `<span class="lof-card-tag-chip">#${this._escapeHtml(t)}</span>`).join('')}</div>`
            : '';

        return `
            <div class="lof-card ${article.type === 'long' ? 'lof-card-long' : ''}" data-article-id="${article.id}">
                ${tagBadge}
                ${imgBlock}
                <div class="lof-card-body">
                    ${titleBlock}
                    ${summaryBlock}
                    ${tagsBlock}
                    <div class="lof-card-foot">
                        <div class="lof-card-author">
                            <div class="lof-card-avatar" style="background:${author.avatarColor}">${author.avatarLetter}</div>
                            <span class="lof-card-author-name">${this._escapeHtml(author.name)}</span>
                        </div>
                        <div class="lof-card-stats">
                            <span class="lof-act-like ${heartsLiked ? 'liked' : ''}">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="${heartsLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                                <span>${hearts}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    _renderArticleTopBadge(article) {
        // 顶部 chip：「订阅热文」/「已关注 NPC 名」/「封设」类型 / collection 关联
        const npc = (AppState.data.weiboData?.fanFriends || []).find(f => f.id === article.authorNpcId);
        const followed = npc && (AppState.data.lofterData?.followedAuthorIds || []).includes(npc.id);
        if (followed) {
            return `<div class="lof-card-top-badge lof-badge-followed">${I18n.t('lofter.badge_followed', '已关注')} ${this._escapeHtml(npc.name || '')}</div>`;
        }
        if (article.collectionId) {
            return `<div class="lof-card-top-badge lof-badge-subscribed">${I18n.t('lofter.badge_subscribed', '订阅热文')}</div>`;
        }
        return '';
    },

    _renderArticleCardImage(article) {
        if (!article.hasImages || article.imageCount === 0) return '';
        const count = article.imageCount || 1;
        const angleHash = (article.id || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
        const colorBg = ['#ffd6e0', '#d6e8ff', '#e3d6ff', '#fff0d6', '#d6ffe6', '#ffeaa7'][angleHash % 6];
        const multiBadge = count > 1
            ? `<div class="lof-card-img-multi-badge">${count}</div>`
            : '';
        return `
            <div class="lof-card-img" style="background:${colorBg}">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.35"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                ${multiBadge}
            </div>
        `;
    },

    _resolveAuthorDisplay(article) {
        const npc = (AppState.data.weiboData?.fanFriends || []).find(f => f.id === article.authorNpcId);
        if (npc) {
            return {
                name: npc.name || article.authorName || '匿名',
                avatarColor: npc.avatarColor || '#1abc9c',
                avatarLetter: ((npc.name || article.authorName || 'A') + '')[0]
            };
        }
        // v2.141.0 作者已删号退圈：不再显示原名、统一「已注销作者」+ 灰头像
        return {
            name: I18n.t('lofter.deleted_author', '已注销作者'),
            avatarColor: '#bcbcc4',
            avatarLetter: '—'
        };
    },

    // ========== Phase 1c: 文章详情页 ==========

    openArticleDetail(articleId) {
        const ld = AppState.data.lofterData;
        if (!ld) return;
        const article = (ld.articles || []).find(a => a.id === articleId);
        if (!article) {
            Utils.showToast(I18n.t('lofter.toast_article_not_found', '文章不存在或已失效'));
            return;
        }

        // 进入详情：footprint 更新（去重 + 最近优先 + capped 200）
        this._recordFootprint(articleId);

        const author = this._resolveAuthorDisplay(article);
        const npc = (AppState.data.weiboData?.fanFriends || []).find(f => f.id === article.authorNpcId);
        const isFollowed = npc && (ld.followedAuthorIds || []).includes(npc.id);
        const isLiked = (ld.myLikedArticleIds || []).includes(articleId);
        const isFavorited = (ld.myFavoritedArticleIds || []).includes(articleId);
        const isReadLater = (ld.myReadLaterArticleIds || []).includes(articleId);

        // 评论树
        const allComments = (article.commentsList || []).map(c => ({
            id: c.id,
            fromNpcId: c.npcId,
            author: c.author,
            content: c.content,
            createdAt: c.createdAt,
            likes: c.likes || 0,
            replyToCommentId: c.replyToCommentId || null,
            isOpReply: !!c.isOpReply
        }));
        const commentTreeHtml = allComments.length > 0
            ? this._renderCommentTree(allComments, 'time')
            : `<div class="lof-detail-empty">${I18n.t('lofter.detail_no_comments', '还没有评论、来抢沙发吧')}</div>`;

        // 标签 chip
        const tagsHtml = (article.tags || []).map(t =>
            `<span class="lof-detail-tag-chip" data-tag="${this._escapeHtml(t)}">#${this._escapeHtml(t)}</span>`
        ).join('');

        // 合集悬浮卡
        const collection = article.collectionId
            ? (ld.collections || []).find(c => c.id === article.collectionId)
            : null;
        const collectionCardHtml = collection
            ? this._renderCollectionCardForDetail(collection, article)
            : '';

        // 正文段落
        const contentParagraphs = (article.content || '').split(/\n+/).filter(Boolean).map(p =>
            `<p class="lof-detail-paragraph">${this._escapeHtml(p)}</p>`
        ).join('');

        // long 类型不显示 summary（LLM 内部章节摘要、用户不可见、pixiv 同款）
        const summaryHtml = (article.summary && article.type !== 'long')
            ? `<div class="lof-detail-summary">${this._escapeHtml(article.summary)}</div>`
            : '';

        const titleHtml = article.title
            ? `<div class="lof-detail-title">${this._escapeHtml(article.title)}</div>`
            : '';

        const followBtnLabel = isFollowed
            ? I18n.t('lofter.btn_followed', '已关注')
            : I18n.t('lofter.btn_follow', '关注');

        const inner = `
            <div class="lof-detail-bar">
                <button class="lof-detail-back" id="lofDetailBack">‹</button>
                <div class="lof-detail-author-head">
                    <div class="lof-detail-author-avatar" style="background:${author.avatarColor}">${author.avatarLetter}</div>
                    <span class="lof-detail-author-name">${this._escapeHtml(author.name)}</span>
                </div>
                ${npc ? `<button class="lof-detail-follow-btn ${isFollowed ? 'followed' : ''}" data-npc-id="${npc.id}">${followBtnLabel}</button>` : ''}
                <button class="lof-detail-share-btn" aria-label="share">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                </button>
            </div>
            <div class="lof-detail-body">
                ${titleHtml}
                ${summaryHtml}
                <div class="lof-detail-content">${contentParagraphs}</div>
                ${tagsHtml ? `<div class="lof-detail-tags">${tagsHtml}</div>` : ''}
                <div class="lof-detail-edit-meta">
                    <span class="lof-detail-edit-time">${I18n.t('lofter.edited_at', '编辑于')} ${this._escapeHtml(article.editedAgoDisplay || '')}${article.editLocation ? ' · ' + this._escapeHtml(article.editLocation) : ''}</span>
                    <span class="lof-detail-edit-spacer"></span>
                    <span class="lof-detail-heat">${I18n.t('lofter.heat', '热度')} ${article.stats?.hearts || 0}</span>
                    <button class="lof-detail-fav-btn ${isFavorited ? 'favorited' : ''}" id="lofDetailFav">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="${isFavorited ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        <span>${isFavorited ? I18n.t('lofter.btn_favorited', '已收藏') : I18n.t('lofter.btn_favorite', '收藏')}</span>
                    </button>
                </div>
                ${collectionCardHtml}
                <div class="lof-detail-comment-section">
                    <div class="lof-detail-section-title">${I18n.t('lofter.detail_comments_title', '最新评论')} <span class="lof-detail-comment-count">(${allComments.length})</span></div>
                    <div class="lof-detail-comment-input-wrap">
                        <div class="lof-detail-comment-input-mock">${I18n.t('lofter.comment_placeholder', '来写评论~')}</div>
                    </div>
                    ${commentTreeHtml}
                </div>
            </div>
            <button class="lof-detail-readlater-fab ${isReadLater ? 'active' : ''}" id="lofDetailReadLater" aria-label="read later">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="${isReadLater ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                <span>${I18n.t('lofter.btn_read_later', '稍后再看')}</span>
            </button>
            <div class="lof-detail-bottom-bar">
                <button class="lof-detail-bottom-input">
                    <span>${I18n.t('lofter.comment_placeholder', '来写评论~')}</span>
                </button>
                <button class="lof-detail-bottom-act ${isLiked ? 'liked' : ''}" id="lofDetailLikeBtn">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    <span>${article.stats?.hearts || 0}</span>
                </button>
                <button class="lof-detail-bottom-act" id="lofDetailCommentBtn">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <span>${allComments.length}</span>
                </button>
            </div>
        `;

        const node = this._openSubScreen('lofArticleDetailSubScreen', inner);
        if (!node) return;
        // 绑定事件
        document.getElementById('lofDetailBack').onclick = () => this._closeSubScreen('lofArticleDetailSubScreen');
        const followEl = node.querySelector('.lof-detail-follow-btn');
        if (followEl) {
            followEl.onclick = () => {
                this._toggleFollowAuthor(followEl.dataset.npcId);
                this._closeSubScreen('lofArticleDetailSubScreen');
                this.openArticleDetail(articleId);
            };
        }
        const favBtn = document.getElementById('lofDetailFav');
        if (favBtn) favBtn.onclick = () => this._handleArticleFavorite(articleId);
        const likeBtn = document.getElementById('lofDetailLikeBtn');
        if (likeBtn) likeBtn.onclick = () => this._handleArticleLike(articleId);
        const commentBtn = document.getElementById('lofDetailCommentBtn');
        if (commentBtn) commentBtn.onclick = () => {
            const sec = node.querySelector('.lof-detail-comment-section');
            if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        const readLaterBtn = document.getElementById('lofDetailReadLater');
        if (readLaterBtn) readLaterBtn.onclick = () => this._handleAddToReadLater(articleId);
        // 评论输入框点击 toast 占位
        node.querySelectorAll('.lof-detail-comment-input-mock, .lof-detail-bottom-input').forEach(el => {
            el.onclick = () => Utils.showToast(I18n.t('lofter.toast_comment_coming_soon', 'lofter 评论功能即将上线'), 2000);
        });
        // tag chip click → 跳 tag 详情页（Phase 3b 已实装）
        node.querySelectorAll('.lof-detail-tag-chip').forEach(el => {
            el.onclick = () => {
                const tag = el.dataset.tag;
                if (tag) {
                    this._closeSubScreen('lofArticleDetailSubScreen');
                    this.openTagDetail(tag);
                }
            };
        });
    },

    // ========== 评论嵌套树渲染（仿微博 v2.72.6）==========

    _renderCommentTree(comments, sortBy = 'time') {
        const byId = new Map();
        const tops = [];
        comments.forEach(c => byId.set(c.id, Object.assign({}, c, { children: [] })));
        comments.forEach(c => {
            const node = byId.get(c.id);
            if (c.replyToCommentId && byId.has(c.replyToCommentId)) {
                byId.get(c.replyToCommentId).children.push(node);
            } else {
                tops.push(node);
            }
        });
        if (sortBy === 'hot') {
            tops.sort((a, b) => (b.likes || 0) - (a.likes || 0) || (b.createdAt || 0) - (a.createdAt || 0));
        } else {
            tops.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        }
        tops.forEach(t => t.children.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)));
        return tops.map(t => this._renderCommentNode(t, 0)).join('');
    },

    _renderCommentNode(node, depth) {
        const row = this._renderCommentRow(node, depth);
        if (!node.children || node.children.length === 0) return row;
        const childrenHtml = node.children.map(ch => this._renderCommentNode(ch, depth + 1)).join('');
        return row + `<div class="lof-comment-children">${childrenHtml}</div>`;
    },

    _renderCommentRow(comment, depth) {
        const fan = comment.fromNpcId
            ? (AppState.data.weiboData?.fanFriends || []).find(f => f.id === comment.fromNpcId)
            : null;
        const name = fan?.name || comment.author || I18n.t('lofter.deleted_user', '已注销用户');
        const colorBg = fan?.avatarColor || this._colorFromString(name);
        const opBadge = comment.isOpReply
            ? `<span class="lof-comment-op-badge">${I18n.t('lofter.comment_op_badge', '博主')}</span>`
            : '';
        return `
            <div class="lof-comment-row" data-depth="${depth}">
                <div class="lof-comment-avatar" style="background:${colorBg}">${(name || '?')[0]}</div>
                <div class="lof-comment-body">
                    <div class="lof-comment-head">
                        <span class="lof-comment-name">${this._escapeHtml(name)}</span>
                        ${opBadge}
                    </div>
                    <div class="lof-comment-text">${this._escapeHtml(comment.content)}</div>
                    <div class="lof-comment-foot">
                        <span class="lof-comment-time">${this._formatTime(comment.createdAt)}</span>
                        <span class="lof-comment-like">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                            ${comment.likes > 0 ? `<span>${comment.likes}</span>` : ''}
                        </span>
                    </div>
                </div>
            </div>
        `;
    },

    _colorFromString(s) {
        const palette = ['#1abc9c', '#ff8e7c', '#5dd5c4', '#a78bfa', '#ff6b9d', '#62b6cb', '#f6c89f', '#b899f0'];
        let h = 0;
        for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return palette[h % palette.length];
    },

    // ========== 合集悬浮卡（详情页用、Phase 3 collection schema 落地）==========

    _renderCollectionCardForDetail(collection, currentArticle) {
        // Phase 1c 时还没正式实现合集页（Phase 3）、这里先做骨架
        const ld = AppState.data.lofterData;
        const allInCol = (ld.articles || []).filter(a => a.collectionId === collection.id).sort((a, b) => (a.chapterNum || 0) - (b.chapterNum || 0));
        const totalCh = collection.chapterCount || allInCol.length;
        const curIdx = allInCol.findIndex(a => a.id === currentArticle.id);
        const prev = curIdx > 0 ? allInCol[curIdx - 1] : null;
        const next = curIdx >= 0 && curIdx < allInCol.length - 1 ? allInCol[curIdx + 1] : null;
        const emojiTagHtml = collection.emojiTag && collection.emojiTagCount
            ? `<span class="lof-collection-emoji-tag">${collection.emojiTagCount} ${I18n.t('lofter.emoji_tag_prefix', '人觉得')}${this._escapeHtml(collection.emojiTag)}</span>`
            : '';
        const isSubscribed = (ld.subscribedCollectionIds || []).includes(collection.id);

        return `
            <div class="lof-detail-collection-card">
                <div class="lof-collection-head">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18M5 7v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7"/><path d="M9 3h6v4H9z"/></svg>
                    <span class="lof-collection-name">${this._escapeHtml(collection.name)}</span>
                    ${emojiTagHtml}
                    <button class="lof-collection-sub-btn ${isSubscribed ? 'subscribed' : ''}" onclick="Lofter._toggleSubscribeCollection('${collection.id}')">${isSubscribed ? I18n.t('lofter.btn_subscribed', '已订阅') : I18n.t('lofter.btn_subscribe_collection', '订阅合集')}</button>
                </div>
                <div class="lof-collection-nav">
                    <button class="lof-collection-prev" ${prev ? '' : 'disabled'} onclick="${prev ? `Lofter._closeSubScreen('lofArticleDetailSubScreen');Lofter.openArticleDetail('${prev.id}')` : ''}">${I18n.t('lofter.btn_prev_chapter', '上一篇')}</button>
                    <button class="lof-collection-toc" onclick="Lofter._closeSubScreen('lofArticleDetailSubScreen');Lofter.openCollectionPage('${collection.id}')">${I18n.t('lofter.btn_toc', '目录')} ${curIdx + 1}/${totalCh}</button>
                    <button class="lof-collection-next" ${next ? '' : 'disabled'} onclick="${next ? `Lofter._closeSubScreen('lofArticleDetailSubScreen');Lofter.openArticleDetail('${next.id}')` : ''}">${next ? I18n.t('lofter.btn_next_chapter', '下一篇') : I18n.t('lofter.btn_last_chapter', '已在末篇')}</button>
                </div>
            </div>
        `;
    },

    // ========== 互动 handlers ==========

    _recordFootprint(articleId) {
        const ld = AppState.data.lofterData;
        if (!ld) return;
        ld.myFootprintArticleIds = (ld.myFootprintArticleIds || []).filter(id => id !== articleId);
        ld.myFootprintArticleIds.unshift(articleId);
        if (ld.myFootprintArticleIds.length > 200) ld.myFootprintArticleIds = ld.myFootprintArticleIds.slice(0, 200);
        Utils.saveData();
    },

    _handleArticleLike(articleId) {
        const ld = AppState.data.lofterData;
        if (!ld) return;
        ld.myLikedArticleIds = ld.myLikedArticleIds || [];
        const article = (ld.articles || []).find(a => a.id === articleId);
        if (!article) return;
        article.stats = article.stats || { hearts: 0, favorites: 0, comments: 0 };
        const idx = ld.myLikedArticleIds.indexOf(articleId);
        if (idx >= 0) {
            ld.myLikedArticleIds.splice(idx, 1);
            article.stats.hearts = Math.max(0, article.stats.hearts - 1);
        } else {
            ld.myLikedArticleIds.push(articleId);
            article.stats.hearts++;
            // 累计陪伴值（用户对 tag 互动）
            (article.tags || []).forEach(t => {
                ld.companionValues[t] = (ld.companionValues[t] || 0) + 2;
            });
        }
        Utils.saveData();
        // 重渲染详情页
        this._closeSubScreen('lofArticleDetailSubScreen');
        this.openArticleDetail(articleId);
    },

    _handleArticleFavorite(articleId) {
        const ld = AppState.data.lofterData;
        if (!ld) return;
        ld.myFavoritedArticleIds = ld.myFavoritedArticleIds || [];
        const article = (ld.articles || []).find(a => a.id === articleId);
        if (!article) return;
        article.stats = article.stats || { hearts: 0, favorites: 0, comments: 0 };
        const idx = ld.myFavoritedArticleIds.indexOf(articleId);
        if (idx >= 0) {
            ld.myFavoritedArticleIds.splice(idx, 1);
            article.stats.favorites = Math.max(0, article.stats.favorites - 1);
            Utils.showToast(I18n.t('lofter.toast_unfavorited', '已取消收藏'));
        } else {
            ld.myFavoritedArticleIds.push(articleId);
            article.stats.favorites++;
            (article.tags || []).forEach(t => {
                ld.companionValues[t] = (ld.companionValues[t] || 0) + 3;
            });
            Utils.showToast(I18n.t('lofter.toast_favorited', '✓ 已收藏、可在「我的收藏」查看'));
        }
        Utils.saveData();
        this._closeSubScreen('lofArticleDetailSubScreen');
        this.openArticleDetail(articleId);
    },

    _handleAddToReadLater(articleId) {
        const ld = AppState.data.lofterData;
        if (!ld) return;
        ld.myReadLaterArticleIds = ld.myReadLaterArticleIds || [];
        const idx = ld.myReadLaterArticleIds.indexOf(articleId);
        if (idx >= 0) {
            ld.myReadLaterArticleIds.splice(idx, 1);
            Utils.showToast(I18n.t('lofter.toast_unreadlater', '已从稍后再看移除'));
        } else {
            ld.myReadLaterArticleIds.push(articleId);
            Utils.showToast(I18n.t('lofter.toast_readlater', '✓ 已加入稍后再看'));
        }
        Utils.saveData();
        this._closeSubScreen('lofArticleDetailSubScreen');
        this.openArticleDetail(articleId);
    },

    _toggleFollowAuthor(npcId) {
        const ld = AppState.data.lofterData;
        if (!ld) return;
        ld.followedAuthorIds = ld.followedAuthorIds || [];
        const idx = ld.followedAuthorIds.indexOf(npcId);
        if (idx >= 0) {
            ld.followedAuthorIds.splice(idx, 1);
            Utils.showToast(I18n.t('lofter.toast_unfollowed_author', '已取消关注'));
        } else {
            ld.followedAuthorIds.push(npcId);
            Utils.showToast(I18n.t('lofter.toast_followed_author', '✓ 已关注'));
        }
        Utils.saveData();
    },

    _toggleSubscribeCollection(collectionId) {
        const ld = AppState.data.lofterData;
        if (!ld) return;
        ld.subscribedCollectionIds = ld.subscribedCollectionIds || [];
        const idx = ld.subscribedCollectionIds.indexOf(collectionId);
        if (idx >= 0) {
            ld.subscribedCollectionIds.splice(idx, 1);
            Utils.showToast(I18n.t('lofter.toast_unsubscribed_collection', '已取消订阅合集'));
        } else {
            ld.subscribedCollectionIds.push(collectionId);
            Utils.showToast(I18n.t('lofter.toast_subscribed_collection', '✓ 已订阅合集'));
        }
        Utils.saveData();
    },

    // ========== Phase 1+ 占位（renderFollow / renderMe）==========
    // ========== 关注 tab（Phase 3a）==========
    renderFollow() {
        const body = document.getElementById('lofter-body');
        if (!body) return;
        const sub = this._followSubTab || 'following';
        if (sub === 'following') body.innerHTML = this._renderFollowingFeed();
        else body.innerHTML = this._renderSubscribedList();

        // 绑定卡片点击进详情
        body.querySelectorAll('.lof-card').forEach(card => {
            card.onclick = (e) => {
                if (e.target.closest('button, a')) return;
                const articleId = card.dataset.articleId;
                if (articleId) this.openArticleDetail(articleId);
            };
        });
        // 绑定 tag chip 进 tag 详情（Phase 3b 实现）
        body.querySelectorAll('.lof-sub-tag-row').forEach(row => {
            row.onclick = () => {
                const tag = row.dataset.tag;
                if (tag) this.openTagDetail(tag);
            };
        });
        // 绑定合集 click（Phase 3c）
        body.querySelectorAll('.lof-sub-col-row').forEach(row => {
            row.onclick = () => {
                const id = row.dataset.colId;
                if (id) this.openCollectionPage(id);
            };
        });
        // 头像 click → openTagDetail 暂不直接进、Phase 3b 加 author profile
        body.querySelectorAll('.lof-update-avatar').forEach(av => {
            av.onclick = () => {
                Utils.showToast(I18n.t('lofter.toast_author_profile_coming_soon', '作者主页 Phase 4 上线'));
            };
        });
        // 筛选 chip 切换
        body.querySelectorAll('.lof-sub-filter-chip').forEach(c => {
            c.onclick = () => {
                const sel = c.dataset.filter;
                if (sel === 'food' || sel === 'super') {
                    Utils.showToast(I18n.t('lofter.toast_filter_coming_soon', '该筛选 Phase 4 上线'));
                    return;
                }
                if (sel === 'all') {
                    Utils.showToast(I18n.t('lofter.toast_all_tags_coming_soon', '全部标签页 Phase 4 上线'));
                    return;
                }
                this._subscribedFilter = sel;
                this.renderFollow();
            };
        });
    },

    // 关注子 tab：正在更新头像横滚 + 信息流
    _renderFollowingFeed() {
        const ld = AppState.data.lofterData;
        const followedIds = ld?.followedAuthorIds || [];
        const allFans = AppState.data.weiboData?.fanFriends || [];
        const followedAuthors = followedIds
            .map(id => allFans.find(f => f.id === id))
            .filter(Boolean);

        if (followedAuthors.length === 0) {
            return `
                <div class="lof-empty">
                    <div class="lof-empty-text">${I18n.t('lofter.follow_empty', '还没有关注任何太太、去发现页找你喜欢的')}</div>
                    <button class="lof-refresh-btn" onclick="Lofter.switchTab('home')">${I18n.t('lofter.btn_go_discover', '去发现')}</button>
                </div>
            `;
        }

        // 头像 row：按各 author 最近发文时间排（近 7 天有发文的、带粉红更新点）
        const articleByAuthor = new Map();
        (ld.articles || []).forEach(a => {
            if (!a.authorNpcId) return;
            const arr = articleByAuthor.get(a.authorNpcId) || [];
            arr.push(a);
            articleByAuthor.set(a.authorNpcId, arr);
        });
        const sevenDaysAgo = Date.now() - 7 * 86400_000;
        const sortedAuthors = followedAuthors.slice().sort((a, b) => {
            const aLatest = (articleByAuthor.get(a.id) || [])[0]?.createdAt || 0;
            const bLatest = (articleByAuthor.get(b.id) || [])[0]?.createdAt || 0;
            return bLatest - aLatest;
        });

        const avatarRow = `
            <div class="lof-update-row">
                ${sortedAuthors.map(a => {
                    const latest = (articleByAuthor.get(a.id) || [])[0];
                    const hasUpdate = latest && (latest.createdAt || 0) > sevenDaysAgo;
                    return `
                        <div class="lof-update-avatar-wrap">
                            <div class="lof-update-avatar" style="background:${a.avatarColor || '#1abc9c'}" data-npc-id="${a.id}">
                                ${this._escapeHtml((a.name || '?')[0])}
                                ${hasUpdate ? '<span class="lof-update-dot"></span>' : ''}
                            </div>
                            <div class="lof-update-name">${this._escapeHtml((a.name || '').slice(0, 4))}${(a.name || '').length > 4 ? '…' : ''}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        // 信息流：followedAuthors 的最近 articles（聚合、按 createdAt desc）
        const articles = followedAuthors
            .flatMap(a => articleByAuthor.get(a.id) || [])
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .slice(0, 30);

        const feedHtml = articles.length > 0
            ? `<div class="lof-follow-feed">${articles.map(a => this._renderArticleCard(a)).join('')}</div>`
            : `<div class="lof-empty"><div class="lof-empty-text">${I18n.t('lofter.follow_no_recent', '关注的太太们最近没发文')}</div></div>`;

        return avatarRow + feedHtml;
    },

    // 订阅子 tab：标签 / 合集 / 粮单 / 高级粉丝 / 全部标签
    _renderSubscribedList() {
        const ld = AppState.data.lofterData;
        const filter = this._subscribedFilter || 'tags';
        const collectionCount = (ld?.subscribedCollectionIds || []).length;

        const chipsHtml = `
            <div class="lof-sub-filters">
                <button class="lof-sub-filter-chip ${filter === 'tags' ? 'active' : ''}" data-filter="tags">${I18n.t('lofter.filter_tags', '标签')}</button>
                <button class="lof-sub-filter-chip ${filter === 'collections' ? 'active' : ''}" data-filter="collections">${I18n.t('lofter.filter_collections', '合集')}${collectionCount > 0 ? `<span class="lof-chip-num-badge">${collectionCount}</span>` : ''}</button>
                <button class="lof-sub-filter-chip" data-filter="food">${I18n.t('lofter.filter_food_list', '粮单')}</button>
                <button class="lof-sub-filter-chip" data-filter="super">${I18n.t('lofter.filter_super_fan', '高级粉丝')}</button>
                <button class="lof-sub-filter-chip" data-filter="all">${I18n.t('lofter.filter_all_tags', '全部标签')} ›</button>
            </div>
        `;

        let listHtml = '';
        if (filter === 'tags') {
            const tags = ld?.subscribedTags || [];
            if (tags.length === 0) {
                listHtml = `<div class="lof-empty"><div class="lof-empty-text">${I18n.t('lofter.sub_tags_empty', '还没有订阅标签、在 tag 详情页点订阅')}</div></div>`;
            } else {
                listHtml = `<div class="lof-sub-list">${tags.map(t => this._renderSubscribedTagRow(t)).join('')}</div>`;
            }
        } else if (filter === 'collections') {
            const colIds = ld?.subscribedCollectionIds || [];
            const cols = colIds.map(id => (ld.collections || []).find(c => c.id === id)).filter(Boolean);
            if (cols.length === 0) {
                listHtml = `<div class="lof-empty"><div class="lof-empty-text">${I18n.t('lofter.sub_cols_empty', '还没有订阅合集、在合集页点订阅')}</div></div>`;
            } else {
                listHtml = `<div class="lof-sub-list">${cols.map(c => this._renderSubscribedColRow(c)).join('')}</div>`;
            }
        }

        return chipsHtml + listHtml;
    },

    // v2.73.8: tag 信息统一缓存 helper —— 订阅卡 / tag 详情页 / 任何 render 入口共用同一份缓存
    // 之前 _renderSubscribedTagRow 和 renderTagDetail 各自走 Math.random、订阅卡显示一个数、点进去显示另一个数
    // 现在统一走 hotTagInfo：首次访问就写入并 saveData、后续 render 直接读
    _ensureTagInfo(tagName) {
        const ld = AppState.data.lofterData;
        if (!ld.hotTagInfo) ld.hotTagInfo = {};
        if (!ld.hotTagInfo[tagName]) {
            ld.hotTagInfo[tagName] = {
                browseCount: Math.floor(50000 + Math.random() * 200000),
                participation: Math.floor(1000 + Math.random() * 10000),
                atmosphere: '评论友好' // v2.73.8: i18n 黑名单 — 不走 I18n.t（存储字段永远存中文字面量）
            };
            Utils.saveData();
        }
        return ld.hotTagInfo[tagName];
    },

    _renderSubscribedTagRow(tagName) {
        const ld = AppState.data.lofterData;
        // 找该 tag 下热度最高的一条 article 作为代表
        const articles = (ld?.articles || []).filter(a => (a.tags || []).includes(tagName));
        const top = articles.sort((a, b) => (b.stats?.hearts || 0) - (a.stats?.hearts || 0))[0];
        // v2.73.8: 走统一缓存 helper、避免订阅卡 vs tag 详情页两次 Math.random 数字不一致
        const tagInfo = this._ensureTagInfo(tagName);
        const browseStr = tagInfo.browseCount >= 10000
            ? Math.round(tagInfo.browseCount / 1000) / 10 + '万'
            : tagInfo.browseCount;

        return `
            <div class="lof-sub-tag-row" data-tag="${this._escapeHtml(tagName)}">
                <div class="lof-sub-tag-head">
                    <span class="lof-sub-tag-name"># ${this._escapeHtml(tagName)}</span>
                    <span class="lof-sub-tag-count">+${browseStr}</span>
                    <span class="lof-sub-tag-arrow">›</span>
                </div>
                ${top ? `
                    <div class="lof-sub-tag-preview">
                        <div class="lof-sub-tag-preview-title">${this._escapeHtml(top.title || (top.content || '').slice(0, 40))}</div>
                        <div class="lof-sub-tag-preview-meta">
                            <span class="lof-sub-tag-trend">${I18n.t('lofter.tag_subscription_rising', '订阅数飙升')}</span>
                            <span>${top.stats?.hearts || 0} ${I18n.t('lofter.heat', '热度')}</span>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    },

    _renderSubscribedColRow(collection) {
        return `
            <div class="lof-sub-col-row" data-col-id="${collection.id}">
                <div class="lof-sub-col-cover" style="background:${collection.coverColor || '#1abc9c'}">${this._escapeHtml((collection.name || '?')[0])}</div>
                <div class="lof-sub-col-meta">
                    <div class="lof-sub-col-name">${this._escapeHtml(collection.name || '')}</div>
                    <div class="lof-sub-col-stats">${I18n.t('lofter.collection_n_chapters', { n: collection.chapterCount || 0 })}${collection.emojiTag ? ' · ' + this._escapeHtml(collection.emojiTag) : ''}</div>
                </div>
                <div class="lof-sub-tag-arrow">›</div>
            </div>
        `;
    },

    _toggleSubscribeTag(tagName) {
        const ld = AppState.data.lofterData;
        if (!ld) return;
        ld.subscribedTags = ld.subscribedTags || [];
        const idx = ld.subscribedTags.indexOf(tagName);
        if (idx >= 0) {
            ld.subscribedTags.splice(idx, 1);
            Utils.showToast(I18n.t('lofter.toast_unsubscribed_tag', '已取消订阅标签'));
        } else {
            ld.subscribedTags.push(tagName);
            Utils.showToast(I18n.t('lofter.toast_subscribed_tag', '✓ 已订阅标签'));
        }
        Utils.saveData();
    },

    // ========== Phase 3b: Tag 详情页 ==========

    openTagDetail(tagName) {
        if (!tagName) return;
        this._currentTag = tagName;
        this._tagDetailSubTab = this._tagDetailSubTab || 'hot';
        this._tagDetailFilter = this._tagDetailFilter || 'weekly';

        const ld = AppState.data.lofterData;
        if (!ld) return;

        // 累计陪伴值（每次进入 +1）
        ld.companionValues = ld.companionValues || {};
        ld.companionValues[tagName] = (ld.companionValues[tagName] || 0) + 1;
        Utils.saveData();

        this._renderTagDetail(tagName);

        // 首次进入 + 该 tag articles < 5 → lazy seed
        const articlesInTag = (ld.articles || []).filter(a => (a.tags || []).includes(tagName));
        if (articlesInTag.length < 5 && !this._lazyTagLock[tagName]) {
            this._lazySeedTagArticles(tagName, 5);
        }
    },

    _renderTagDetail(tagName) {
        const ld = AppState.data.lofterData;
        if (!ld) return;
        const subTab = this._tagDetailSubTab || 'hot';
        const filter = this._tagDetailFilter || 'weekly';
        // v2.73.8: 走统一缓存 helper（订阅卡 / tag 详情 / 任何 render 入口共用同一份缓存）
        const tagInfo = this._ensureTagInfo(tagName);
        const browseCount = tagInfo.browseCount;
        const participation = tagInfo.participation;
        const atmosphere = tagInfo.atmosphere;
        const isSubscribed = (ld.subscribedTags || []).includes(tagName);
        const companion = ld.companionValues[tagName] || 0;

        // 我圈太太：关注的作者中、在此 tag 发过文的
        const fans = AppState.data.weiboData?.fanFriends || [];
        const followedSet = new Set(ld.followedAuthorIds || []);
        const myAuthorsInTag = (ld.articles || [])
            .filter(a => (a.tags || []).includes(tagName) && followedSet.has(a.authorNpcId))
            .map(a => fans.find(f => f.id === a.authorNpcId))
            .filter(Boolean);
        const myAuthorsUniq = [...new Map(myAuthorsInTag.map(a => [a.id, a])).values()].slice(0, 4);
        const myAuthorsBlock = myAuthorsUniq.length > 0
            ? `<div class="lof-tag-my-authors">
                <div class="lof-tag-my-authors-avatars">
                    ${myAuthorsUniq.map(a => `<div class="lof-tag-author-mini" style="background:${a.avatarColor || '#1abc9c'}">${this._escapeHtml((a.name || '?')[0])}</div>`).join('')}
                </div>
                <div class="lof-tag-my-authors-label">${I18n.t('lofter.tag_my_authors', '我圈太太')}</div>
            </div>`
            : `<div class="lof-tag-my-authors lof-tag-no-authors">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"><circle cx="12" cy="8" r="4"/><path d="M4 22c0-4 4-6 8-6s8 2 8 6"/></svg>
                <div class="lof-tag-my-authors-label">${I18n.t('lofter.tag_my_authors', '我圈太太')}</div>
            </div>`;

        // 合集粮单入口（lofter MVP 占位、点击 toast）
        const colCount = (ld.collections || []).filter(c => {
            return (ld.articles || []).some(a => a.collectionId === c.id && (a.tags || []).includes(tagName));
        }).length;

        // 子 tab 内容
        const subTabHtml = `
            <div class="lof-tag-subtabs">
                <button class="lof-tag-subtab ${subTab === 'discover' ? 'active' : ''}" data-sub="discover">${I18n.t('lofter.tagsub_discover', '发现')}</button>
                <button class="lof-tag-subtab ${subTab === 'newest' ? 'active' : ''}" data-sub="newest">${I18n.t('lofter.tagsub_newest', '最新')}</button>
                <button class="lof-tag-subtab ${subTab === 'hot' ? 'active' : ''}" data-sub="hot">${I18n.t('lofter.tagsub_hot', '最热')}</button>
                <button class="lof-tag-subtab ${subTab === 'dynamic' ? 'active' : ''}" data-sub="dynamic">${I18n.t('lofter.tagsub_dynamic', '动态')}</button>
            </div>
        `;

        const filterChipsHtml = subTab === 'hot'
            ? `<div class="lof-tag-filters">
                <button class="lof-tag-filter-chip ${filter === 'all' ? 'active' : ''}" data-filter="all">${I18n.t('lofter.filter_all', '全部')}</button>
                <button class="lof-tag-filter-chip ${filter === 'daily' ? 'active' : ''}" data-filter="daily">${I18n.t('lofter.filter_daily', '日榜')}</button>
                <button class="lof-tag-filter-chip ${filter === 'weekly' ? 'active' : ''}" data-filter="weekly">${I18n.t('lofter.filter_weekly', '周榜')}</button>
                <button class="lof-tag-filter-chip ${filter === 'monthly' ? 'active' : ''}" data-filter="monthly">${I18n.t('lofter.filter_monthly', '月榜')}</button>
                <button class="lof-tag-filter-chip lof-tag-filter-icon" data-filter="more">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                </button>
            </div>`
            : subTab === 'newest'
            ? `<div class="lof-tag-filters">
                <button class="lof-tag-filter-chip active">${I18n.t('lofter.filter_newest_release', '最新发布')} ▼</button>
                <button class="lof-tag-filter-chip">${I18n.t('lofter.filter_img_text', '图/文')} ▼</button>
                <button class="lof-tag-filter-chip">${I18n.t('lofter.filter_time', '时间')} ▼</button>
                <button class="lof-tag-filter-chip">${I18n.t('lofter.filter_read_history', '阅读记录')} ▼</button>
            </div>`
            : '';

        // 文章列表：按 subTab 排序
        const filteredArticles = this._getTagDetailArticles(tagName, subTab, filter);
        let listHtml;
        if (filteredArticles.length === 0) {
            listHtml = `<div class="lof-empty">
                <div class="lof-empty-text">${I18n.t('lofter.tag_empty', '该 tag 暂无内容、即将加载')}</div>
            </div>`;
        } else {
            const left = [];
            const right = [];
            filteredArticles.forEach((a, i) => (i % 2 === 0 ? left : right).push(a));
            listHtml = `<div class="lof-feed lof-tag-feed">
                <div class="lof-col">${left.map(a => this._renderArticleCard(a)).join('')}</div>
                <div class="lof-col">${right.map(a => this._renderArticleCard(a)).join('')}</div>
            </div>`;
        }

        const inner = `
            <div class="lof-tag-bar">
                <button class="lof-sub-back" id="lofTagBack">‹</button>
                <div class="lof-tag-search-mock">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <span>${I18n.t('lofter.tag_search_placeholder', '圈内搜 | 搜作品、搜合集、搜...')}</span>
                </div>
                <button class="lof-tag-sub-btn ${isSubscribed ? 'subscribed' : ''}" id="lofTagSubBtn">${isSubscribed ? I18n.t('lofter.btn_subscribed', '已订阅') : I18n.t('lofter.btn_subscribe_tag', '订阅')}</button>
                <button class="lof-tag-share" aria-label="share">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                </button>
            </div>
            <div class="lof-tag-head">
                <div class="lof-tag-head-row">
                    <div class="lof-tag-title-wrap">
                        <div class="lof-tag-title"># ${this._escapeHtml(tagName)}</div>
                        <div class="lof-tag-stats">${this._formatNumber(browseCount)} ${I18n.t('lofter.tag_browses', '浏览量')} · ${this._formatNumber(participation)} ${I18n.t('lofter.tag_participation', '参与')}</div>
                        <div class="lof-tag-atmosphere"><span class="lof-tag-atmos-chip"><svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" style="margin-right:3px;"><circle cx="12" cy="12" r="10"/></svg>${this._escapeHtml(atmosphere)}</span></div>
                    </div>
                    <div class="lof-tag-companion">
                        <div class="lof-tag-companion-num">${companion}</div>
                        <div class="lof-tag-companion-label">${I18n.t('lofter.tag_my_companion', '我的陪伴值')}</div>
                    </div>
                </div>
                <div class="lof-tag-entries">
                    ${myAuthorsBlock}
                    <button class="lof-tag-col-entry" onclick="Utils.showToast(I18n.t('lofter.toast_food_list_coming_soon', '合集粮单 Phase 4 上线'))">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="#36b8d8"><rect x="3" y="5" width="18" height="14" rx="2"/></svg>
                        <div class="lof-tag-col-entry-label">${I18n.t('lofter.tag_collection_food_list', '合集粮单')}</div>
                    </button>
                </div>
            </div>
            ${subTabHtml}
            ${filterChipsHtml}
            <div class="lof-tag-body">
                ${listHtml}
            </div>
        `;

        const node = this._openSubScreen('lofTagDetailSubScreen', inner);
        if (!node) return;
        document.getElementById('lofTagBack').onclick = () => this._closeSubScreen('lofTagDetailSubScreen');
        document.getElementById('lofTagSubBtn').onclick = () => {
            this._toggleSubscribeTag(tagName);
            this._closeSubScreen('lofTagDetailSubScreen');
            this.openTagDetail(tagName);
        };
        node.querySelectorAll('.lof-tag-subtab').forEach(btn => {
            btn.onclick = () => {
                this._tagDetailSubTab = btn.dataset.sub;
                this._closeSubScreen('lofTagDetailSubScreen');
                this._renderTagDetail(tagName);
            };
        });
        node.querySelectorAll('.lof-tag-filter-chip').forEach(btn => {
            btn.onclick = () => {
                const f = btn.dataset.filter;
                if (f === 'more') {
                    Utils.showToast(I18n.t('lofter.toast_filter_coming_soon', '该筛选 Phase 4 上线'));
                    return;
                }
                this._tagDetailFilter = f;
                this._closeSubScreen('lofTagDetailSubScreen');
                this._renderTagDetail(tagName);
            };
        });
        node.querySelectorAll('.lof-card').forEach(card => {
            card.onclick = (e) => {
                if (e.target.closest('button, a')) return;
                const id = card.dataset.articleId;
                if (id) this.openArticleDetail(id);
            };
        });
        node.querySelector('.lof-tag-search-mock')?.addEventListener('click', () => {
            Utils.showToast(I18n.t('lofter.toast_search_coming_soon', '搜索功能 Phase 4 上线'));
        });
    },

    _getTagDetailArticles(tagName, subTab, filter) {
        const ld = AppState.data.lofterData;
        const all = (ld?.articles || []).filter(a => (a.tags || []).includes(tagName));
        if (subTab === 'newest') {
            return all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 40);
        }
        if (subTab === 'dynamic') {
            // 动态：按关注作者优先 + 时间排
            const followed = new Set(ld.followedAuthorIds || []);
            return all
                .sort((a, b) => {
                    const aFol = followed.has(a.authorNpcId) ? 1 : 0;
                    const bFol = followed.has(b.authorNpcId) ? 1 : 0;
                    if (aFol !== bFol) return bFol - aFol;
                    return (b.createdAt || 0) - (a.createdAt || 0);
                })
                .slice(0, 40);
        }
        if (subTab === 'discover') {
            // 发现：算法混排（小热度 / 多样性）
            return all.sort(() => Math.random() - 0.5).slice(0, 40);
        }
        // 最热（默认）：按热度（hearts + favorites*1.5）+ filter 时间窗
        const now = Date.now();
        let windowMs = Infinity;
        if (filter === 'daily') windowMs = 86400_000;
        else if (filter === 'weekly') windowMs = 7 * 86400_000;
        else if (filter === 'monthly') windowMs = 30 * 86400_000;
        const inWindow = filter === 'all'
            ? all
            : all.filter(a => (now - (a.createdAt || 0)) < windowMs);
        return inWindow
            .sort((a, b) => {
                const hotA = (a.stats?.hearts || 0) + (a.stats?.favorites || 0) * 1.5;
                const hotB = (b.stats?.hearts || 0) + (b.stats?.favorites || 0) * 1.5;
                return hotB - hotA;
            })
            .slice(0, 40);
    },

    // Lazy seed: 进 tag 详情时 articles < 5 → 调一次 LLM 生成 5 篇该 tag 文章
    async _lazySeedTagArticles(tagName, count = 5) {
        if (this._lazyTagLock[tagName]) return;
        this._lazyTagLock[tagName] = true;

        try {
            const npcs = this._pickLofterNpcs(count);
            if (npcs.length === 0) return;

            // 强制 NPC 倾向写这个 tag 的内容
            const worldCtx = this._getWorldContext();
            const plotGate = this._getPlotGate();

            const npcLines = npcs.map((n, i) =>
                `[N${i + 1}] ${n.name} (@${n.handle || 'user_' + i}) | type=${n.type} | 简介：${n.bio || '（无）'}`
            ).join('\n');

            const prompt = `你在模拟中国 lofter 平台 #${tagName}# 这个 tag 内部的发文流、生成 ${count} 篇围绕该 tag 主题的短文。

【世界观】
${worldCtx || '（未设定）'}
${plotGate.promptGateText}

【NPC 列表】
${npcLines}

【内容要求】
- 每篇文章必须围绕 tag「${tagName}」展开、写跟该 tag 主题相关的内容
- 每篇 TAGS 字段必须包含 "${tagName}" 作为第一个 tag
- 形式按 NPC type 多样：fan_writer 写文片段 / fan_artist 草稿 / cp_fan 抠糖 / info_station 情报
- 风格沿用 lofter 活人化（卡文 / 摸鱼 / 灵感 / 拖稿 / 嗑到 / 创作低潮）

【铁律】必须使用简体中文输出。严禁繁体字、严禁日语整句。

【输出格式】对每个 NPC 用 ---LOF--- 分隔（同首页 batch 格式）：
---LOF---
TAG: [N1]
TYPE: [short]
TITLE: [可选]
SUMMARY: [可选]
TAGS: [#${tagName} #其他]
CONTENT: [正文]
HAS_IMAGES: [true / false]
IMAGE_COUNT: [0-9]
CP_FLAG: [main / none / multi]
EDITED_AGO: [时间]
EDIT_LOCATION: [地区]
COMMENT_1: [昵称]|[内容]
... (3-6 条评论)
---LOF---
...

不要 JSON / markdown / 多余说明。`;

            const raw = await this._callLLM(prompt);
            const parsed = this._parseLofterBatch(raw, npcs);
            if (parsed.length === 0) return;

            const ld = AppState.data.lofterData;
            const articles = parsed.map(b => {
                const article = this._buildArticleFromBlock(b);
                // 兜底 inject tag（防 LLM 漏 tag）
                if (!article.tags.includes(tagName)) article.tags.unshift(tagName);
                return article;
            });
            articles.forEach(a => ld.articles.unshift(a));
            articles.forEach(a => {
                const npc = (AppState.data.weiboData?.fanFriends || []).find(f => f.id === a.authorNpcId);
                if (npc?.lofter) npc.lofter.articleCount = (npc.lofter.articleCount || 0) + 1;
            });
            Utils.saveData();
            // 重渲染 tag 详情页
            if (document.getElementById('lofTagDetailSubScreen')) {
                this._closeSubScreen('lofTagDetailSubScreen');
                this._renderTagDetail(tagName);
            }
        } catch (e) {
            console.warn('[Lofter lazy tag seed]', e);
        } finally {
            this._lazyTagLock[tagName] = false;
        }
    },

    _formatNumber(n) {
        if (n >= 10000) return (Math.round(n / 1000) / 10) + '万';
        if (n >= 1000) return (Math.round(n / 100) / 10) + 'k';
        return String(n);
    },

    // ========== Phase 3c: 合集页 ==========

    openCollectionPage(collectionId) {
        const ld = AppState.data.lofterData;
        if (!ld) return;
        const collection = (ld.collections || []).find(c => c.id === collectionId);
        if (!collection) {
            Utils.showToast(I18n.t('lofter.toast_collection_not_found', '合集不存在'));
            return;
        }
        this._collectionSort = this._collectionSort || 'asc';     // 'asc' | 'desc'
        this._collectionView = this._collectionView || 'list';    // 'list' | 'grid'
        this._renderCollectionPage(collection);

        // 合集没章节时自动触发第 1 章生成（Phase 3d）
        const articles = (ld.articles || []).filter(a => a.collectionId === collection.id);
        if (articles.length === 0 && !this._chapterLock) {
            const npc = (AppState.data.weiboData?.fanFriends || []).find(f => f.id === collection.authorNpcId);
            if (npc) {
                Utils.showToast(I18n.t('lofter.toast_generating_chapter', '正在生成首章、请稍等...'), 6000);
                setTimeout(async () => {
                    const ch = await this._generateLofterChapterImpl(npc, collection, 1);
                    if (ch) {
                        collection.chapterCount = 1;
                        collection.updatedAt = Date.now();
                        AppState.data.lofterData.articles.unshift(ch);
                        if (npc.lofter) npc.lofter.articleCount = (npc.lofter.articleCount || 0) + 1;
                        Utils.saveData();
                        if (document.getElementById('lofCollectionSubScreen')) {
                            this._closeSubScreen('lofCollectionSubScreen');
                            this.openCollectionPage(collection.id);
                        }
                    }
                }, 100);
            }
        }
    },

    _renderCollectionPage(collection) {
        const ld = AppState.data.lofterData;
        const fans = AppState.data.weiboData?.fanFriends || [];
        const author = fans.find(f => f.id === collection.authorNpcId);
        const authorName = author?.name || I18n.t('lofter.deleted_author', '已注销作者');
        const isFollowed = author && (ld.followedAuthorIds || []).includes(author.id);
        const isSubscribed = (ld.subscribedCollectionIds || []).includes(collection.id);

        const articles = (ld.articles || [])
            .filter(a => a.collectionId === collection.id)
            .sort((a, b) => {
                const cna = a.chapterNum || 0;
                const cnb = b.chapterNum || 0;
                return this._collectionSort === 'asc' ? cna - cnb : cnb - cna;
            });
        const total = articles.length;

        // 「当前在看」= myFootprintArticleIds 里最近一条属于此合集的 article
        const footprint = ld.myFootprintArticleIds || [];
        const currentReadingId = footprint.find(id => articles.some(a => a.id === id));

        const sortIcon = this._collectionSort === 'asc'
            ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>'
            : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>';

        const inner = `
            <div class="lof-sub-bar">
                <button class="lof-sub-back" id="lofColBack">‹</button>
                <div class="lof-sub-author-head">
                    <div class="lof-sub-author-avatar" style="background:${author?.avatarColor || '#1abc9c'}">${this._escapeHtml((authorName + '')[0])}</div>
                    <span class="lof-sub-author-name">${this._escapeHtml(authorName)}</span>
                </div>
                ${author ? `<button class="lof-detail-follow-btn ${isFollowed ? 'followed' : ''}" id="lofColFollow">${isFollowed ? I18n.t('lofter.btn_followed', '已关注') : I18n.t('lofter.btn_follow', '关注')}</button>` : ''}
                <button class="lof-detail-share-btn" aria-label="share">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                </button>
            </div>
            <div class="lof-col-head">
                <div class="lof-col-cover-big" style="background:${collection.coverColor || '#1abc9c'}">
                    <span class="lof-col-cover-text">${this._escapeHtml((collection.name || '?')[0])}</span>
                </div>
                <div class="lof-col-info">
                    <div class="lof-col-name-big">${this._escapeHtml(collection.name)} <span class="lof-col-total">(${total})</span></div>
                    <div class="lof-col-desc">${this._escapeHtml(collection.description || '')}</div>
                    <button class="lof-col-sub-btn-big ${isSubscribed ? 'subscribed' : ''}" id="lofColSubBtn">${isSubscribed ? I18n.t('lofter.btn_subscribed', '已订阅') : I18n.t('lofter.btn_subscribe_collection', '订阅合集')}</button>
                </div>
            </div>
            <div class="lof-col-toolbar">
                <button class="lof-col-sort-btn" id="lofColSortBtn">
                    ${sortIcon}
                    <span>${this._collectionSort === 'asc' ? I18n.t('lofter.sort_asc', '正序') : I18n.t('lofter.sort_desc', '倒序')}</span>
                </button>
                <div class="lof-col-toolbar-right">
                    <button class="lof-col-write-btn" id="lofColWriteBtn">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
                        <span>${I18n.t('lofter.btn_write_next_chapter', '续写下一章')}</span>
                    </button>
                    <button class="lof-view-toggle" id="lofColViewToggle" aria-label="toggle view">
                        ${this._viewToggleIcon(this._collectionView)}
                    </button>
                </div>
            </div>
            <div class="lof-col-body">
                ${articles.length === 0
                    ? `<div class="lof-empty"><div class="lof-empty-text">${I18n.t('lofter.col_empty', '合集还没有任何章节')}</div></div>`
                    : articles.map(a => this._renderCollectionChapterRow(a, currentReadingId, this._collectionView)).join('')
                }
                <div class="lof-col-end">${I18n.t('lofter.col_end', '没有更多内容了哦')}</div>
            </div>
        `;

        const node = this._openSubScreen('lofCollectionSubScreen', inner);
        if (!node) return;
        document.getElementById('lofColBack').onclick = () => this._closeSubScreen('lofCollectionSubScreen');
        // v2.73.10: 4 处去掉多余的 _closeSubScreen —— _renderCollectionPage 内部已 _openSubScreen（见 existed 自己 remove + append）、之前先 close 再 render 是无害但多余的双关闭
        const followBtn = document.getElementById('lofColFollow');
        if (followBtn && author) {
            followBtn.onclick = () => {
                this._toggleFollowAuthor(author.id);
                this._renderCollectionPage(collection);
            };
        }
        document.getElementById('lofColSubBtn').onclick = () => {
            this._toggleSubscribeCollection(collection.id);
            this._renderCollectionPage(collection);
        };
        document.getElementById('lofColSortBtn').onclick = () => {
            this._collectionSort = this._collectionSort === 'asc' ? 'desc' : 'asc';
            this._renderCollectionPage(collection);
        };
        document.getElementById('lofColViewToggle').onclick = () => {
            this._collectionView = this._collectionView === 'list' ? 'grid' : 'list';
            this._renderCollectionPage(collection);
        };
        document.getElementById('lofColWriteBtn').onclick = () => this.showNextChapterModal(collection.id);
        node.querySelectorAll('.lof-col-chapter-row').forEach(row => {
            row.onclick = () => {
                const id = row.dataset.articleId;
                if (id) this.openArticleDetail(id);
            };
        });
    },

    // ========== Phase 3d: 长篇章节生成（仿 pixiv 模式、纯中文重写、不动 pixiv 字面量）==========

    // 创建一个新合集 + 生成第 1 章
    // userPrompt：用户在 compose modal 填的「主题方向」（影响合集名 / 简介 / 第 1 章；仅初创时适用、不延续到后续章节）
    async _generateLofterCollection(npc, ip = null, userPrompt = null, styleChoice = 'random') {
        if (this._chapterLock) {
            Utils.showToast(I18n.t('lofter.toast_chapter_in_progress', '章节生成中、请稍候'));
            return null;
        }
        if (!npc || !npc.lofter?.enabled || npc.type !== 'fan_writer') {
            console.warn('[Lofter collection] invalid npc:', npc?.name);
            return null;
        }
        const ld = AppState.data.lofterData;
        if (!ld) return null;

        this._chapterLock = npc.id;
        try {
            // v2.81.0 文风：解析用户选的文风（或随机）、整本合集统一、续章继承
            // v2.144.0 用户没显式选合集文风（random）且作者设了个人文风 → 不盖合集文风、
            // 让整本合集走作者个人文风（章节 prompt 分层：无合集文风时才注入 npc.writingStyle）。
            // 作者没个人文风时维持原状（random 仍随机选一款、保证合集有文风）。
            const selectedStyle = (styleChoice === 'random' && npc.writingStyle)
                ? null
                : this._resolveWritingStyle(styleChoice);
            const styleInstruction = this._styleInstructionFor(selectedStyle);

            // 1. 创建 collection 元数据（先 LLM 生成 名 + 描述、再生成第 1 章）
            const collectionMeta = await this._generateCollectionMeta(npc, ip, userPrompt, styleInstruction);
            if (!collectionMeta) return null;

            const collection = {
                id: 'col_' + this._uuid(),
                name: collectionMeta.name,
                description: collectionMeta.description,
                authorNpcId: npc.id,
                coverPattern: 'solid', // v2.73.11: 之前写 'gradient' 但 CSS 渲染只用 coverColor 纯色（无渐变铁律）、字面量改成 solid 避免未来读者误以为该用渐变
                coverColor: this._randomCollectionCoverColor(),
                emojiTag: collectionMeta.emojiTag || null,
                emojiTagCount: collectionMeta.emojiTagCount || 0,
                chapterCount: 0,
                subscribers: Math.floor(Math.random() * Math.max(20, (npc.followerCount || 1000) * 0.05)),
                hearts: 0,
                isUserSubscribed: false,
                writingStyleId: selectedStyle ? selectedStyle.id : null,  // v2.81.0 本合集文风、续章读它保持一致
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            ld.collections.push(collection);
            if (npc.lofter) {
                npc.lofter.collectionIds = npc.lofter.collectionIds || [];
                npc.lofter.collectionIds.push(collection.id);
            }
            Utils.saveData();

            // 2. 生成第 1 章（userPrompt 透传到第 1 章作为本章方向、styleInstruction 透传统一文风）
            const ch1 = await this._generateLofterChapterImpl(npc, collection, 1, ip, userPrompt, styleInstruction);
            if (ch1) {
                collection.chapterCount = 1;
                collection.updatedAt = Date.now();
                ld.articles.unshift(ch1);
                if (npc.lofter) npc.lofter.articleCount = (npc.lofter.articleCount || 0) + 1;
                Utils.saveData();
            }
            return collection;
        } finally {
            this._chapterLock = null;
        }
    },

    // 续章（chapterCount + 1）+ 可选 userHint（仿 pixiv 同款）
    async _generateNextLofterChapter(collectionId, userHint = null) {
        if (this._chapterLock) return null;
        const ld = AppState.data.lofterData;
        const collection = (ld?.collections || []).find(c => c.id === collectionId);
        if (!collection) return null;
        const npc = (AppState.data.weiboData?.fanFriends || []).find(f => f.id === collection.authorNpcId);
        if (!npc) return null;

        this._chapterLock = collectionId;
        try {
            const nextNum = (collection.chapterCount || 0) + 1;
            const chapter = await this._generateLofterChapterImpl(npc, collection, nextNum, null, userHint);
            if (chapter) {
                collection.chapterCount = nextNum;
                collection.updatedAt = Date.now();
                ld.articles.unshift(chapter);
                if (npc.lofter) npc.lofter.articleCount = (npc.lofter.articleCount || 0) + 1;
                Utils.saveData();
            }
            return chapter;
        } finally {
            this._chapterLock = null;
        }
    },

    // 实际单章生成 (仿 pixiv generateNovel 流程、纯中文 prompt 重写)
    // userHint: 用户给本章方向（仅本章适用、不延续到后续章节、pixiv 同款）
    // styleInstruction: v2.81.0 本合集统一文风指令块；不传（null）则从 collection.writingStyleId 推导（续章 / 自动首章路径走这条）
    async _generateLofterChapterImpl(npc, collection, chapterNum, ip = null, userHint = null, styleInstruction = null) {
        const ld = AppState.data.lofterData;
        const worldCtx = this._getWorldContext();
        const plotGate = this._getPlotGate();
        const cp = AppState.data.broadcast?.cpSettings || {};
        if (styleInstruction === null) styleInstruction = this._styleInstructionFor(this._resolveCollectionStyle(collection));

        // 前序章节滑动窗口（FULL_TEXT_WINDOW = 3）
        const FULL_TEXT_WINDOW = 3;
        const prevChapters = (ld.articles || [])
            .filter(a => a.collectionId === collection.id)
            .sort((a, b) => (a.chapterNum || 0) - (b.chapterNum || 0));
        const fromIdx = Math.max(0, prevChapters.length - FULL_TEXT_WINDOW);
        const prevContext = prevChapters.map((ch, i) => {
            if (i >= fromIdx) {
                return `【第 ${ch.chapterNum || (i + 1)} 章「${ch.title || ''}」— 全文】\n${ch.content || ''}`;
            }
            const synopsis = ch.summary || (ch.content || '').replace(/\s+/g, ' ').slice(0, 200) + '…';
            return `【第 ${ch.chapterNum || (i + 1)} 章「${ch.title || ''}」— 摘要】\n${synopsis}`;
        }).join('\n\n');

        const positionNote = chapterNum === 1
            ? '你在写第 1 章 — 这是**长篇连载的开篇**、不是一篇 oneshot。你的任务是：建立基调、引入角色、抛出一个能撑起后续章节的核心张力（一个未解的关系状态 / 一个悬而未决的处境 / 一个刚被点燃的情绪），让读者读完想追下一章。**不要在第 1 章里把故事讲完** — 一切情节都是"刚开始"。'
            : `你在写第 ${chapterNum} 章。前序章节见上方（最近 ${FULL_TEXT_WINDOW} 章给全文、更早章节给摘要）。第 ${chapterNum - 1} 章是故事当前到达的位置。新一章从那个状态后**自然推进** — 不要重述前一章结尾、不要复述已发生的对话。`;

        // userHint block（pixiv 同款独立性原则：仅本章适用、不延续）
        const userHintBlock = userHint
            ? `\n【作者给本章的方向（最高优先级、仅本章适用）】\n${userHint}\n↑ 请按此方向写。**不要把这个方向延续到后续章节** — 每章方向独立、未来续章会有新的方向（或没有方向自由发挥）。\n`
            : `\n【本章方向独立】\n用户没给本章具体方向。前序章节的方向**不要假设延续到本章** — 自由探索一个自然延续剧情的新视角 / 新场景 / 新转折。\n`;

        const cpInfo = cp.cpCharA && cp.cpCharB
            ? `\n【CP】主要 CP: ${cp.cpCharA} × ${cp.cpCharB}${cp.cpNickname ? `（${cp.cpNickname}）` : ''}\n`
            : '';

        const ipNote = ip ? `\n【IP / Tag 倾向】围绕 #${ip}# 这个圈层 / 作品展开。\n` : '';

        const prompt = `你是中文 lofter 平台资深同人作者、正在写一篇**长篇连载小说**的章节（不是单篇 oneshot）。基于以下世界观和合集背景写本章 1500-3000 字。

【连载创作铁律 — 不可妥协】
1. **连贯推进**：第 1 章建立可以撑起后续章节的张力；续章从前一章结束的状态自然推进、不重述、不复述对话。
2. **节奏自然**：按角色和情境的真实速度发展、不快进、不跳过情感铺垫、不在本章解决新抛出的事件。
3. **不重复**：前序章节里已发生的事件、对话、情感拐点都不要再写一遍。
4. **角色忠实**：严格按世界观和角色既定性格、OOC 绝对禁止。
5. **原作尊重**：不违背已设定的剧情时间线和世界观铁律。
6. **章节独立性**：前序章节的"作者方向"只是事实记录、不是后续主题约束。本章方向只对本章生效、不要假设延续到下一章。

【世界观】
${worldCtx || '（未设定、围绕 CP 和合集主题写）'}
${cpInfo}
${ipNote}
${plotGate.promptGateText}

【作者身份】
你是同人作家「${npc.name}」（@${npc.handle || 'user'}）。${npc.bio || ''}
你偏好的创作主题：${(npc.contentTags || []).join('、') || '同人创作'}。${(!styleInstruction && npc.writingStyle) ? '\n你的个人文风：' + npc.writingStyle + '（请贯穿全文）。' : ''}

【合集】
- 合集名：${collection.name}
- 合集介绍：${collection.description || ''}
- 当前正在写：第 ${chapterNum} 章

${prevContext ? `【故事到目前为止 — 前序章节】\n（最近 ${FULL_TEXT_WINDOW} 章给全文、让你能看到具体的开头和结尾；更早章节给摘要、作为事实记录。）\n${prevContext}` : ''}

【本章定位】
${positionNote}
${userHintBlock}${styleInstruction}
【创作要求】
- 视角：第三人称限制（默认）—— 全角括号（）包裹内心独白
- 长度：1500-3000 字、一个完整的场景或紧凑的双场景
- 文风：若上方有【文风要求】则严格以其为准；无则自然有节制、对白具体、心理细腻
- 不要"流水账"、不要"快进剧情"
- **章节末态**：停在本章张力的最高点 — 让当前处境余韵悬置。**不要在本章里发明并解决全新事件**、不要给一个完结感的结尾、不要"今天就到这里"式收束。读者读完应该想"然后呢？"。

【底线】
- 不评判其他粉丝群体 / 不贬低其他作品 CP
- 不主动提及现实政治 / 性别议题
- OOC 是禁止的、严格按角色既定性格写

【铁律】简体中文输出。严禁繁体字。严禁日语整句（OOC 等少数 ACG 圈缩写可保留）。

【输出格式】严格按以下标签输出、不要 JSON、不要 markdown 代码块：
<TITLE>章节标题</TITLE>
<SUMMARY>1-2 句章节摘要、合集列表用、80 字内</SUMMARY>
<CONTENT>
章节正文 ...
</CONTENT>`;

        try {
            const raw = await this._callLLM(prompt);
            const title = (raw.match(/<TITLE>([\s\S]*?)<\/TITLE>/) || [])[1]?.trim();
            const summary = (raw.match(/<SUMMARY>([\s\S]*?)<\/SUMMARY>/) || [])[1]?.trim();
            const content = (raw.match(/<CONTENT>([\s\S]*?)<\/CONTENT>/) || [])[1]?.trim();
            if (!content || content.length < 300) {
                console.warn('[Lofter chapter] content too short or missing', { title, summaryLen: summary?.length, contentLen: content?.length });
                Utils.showToast(I18n.t('lofter.toast_chapter_gen_failed', '章节生成失败、请稍后重试'));
                return null;
            }
            const fc = npc.followerCount || 1000;
            const now = Date.now();
            const article = {
                id: 'lof_' + this._uuid(),
                type: 'long',
                title: title || `第 ${chapterNum} 章`,
                summary: summary || (content.slice(0, 80) + '...'),
                content,
                hasImages: false,
                imageCount: 0,
                // v2.73.9: tags 加合集名 + CP 名 / 主作品名 — 之前只有 npc.contentTags + ip、tag 详情页 / 订阅 tag 找不到长篇章节
                tags: (() => {
                    const baseTags = [];
                    if (collection?.name) baseTags.push(collection.name);
                    if (cp.cpNickname) baseTags.push(cp.cpNickname);
                    else if (cp.cpCharA && cp.cpCharB) baseTags.push(`${cp.cpCharA}×${cp.cpCharB}`);
                    if (cp.productionName) baseTags.push(cp.productionName);
                    baseTags.push(...(npc.contentTags || []).slice(0, 2));
                    if (ip) baseTags.push(ip);
                    // dedup + 上限 6
                    return [...new Set(baseTags.filter(Boolean))].slice(0, 6);
                })(),
                authorNpcId: npc.id,
                authorName: npc.name,
                collectionId: collection.id,
                chapterNum,
                cpFlag: (cp.cpCharA && cp.cpCharB) ? 'main' : 'none',
                stats: {
                    hearts: Math.floor(Math.random() * fc * 0.06),
                    favorites: Math.floor(Math.random() * fc * 0.02),
                    comments: 0
                },
                commentsList: [],   // 长篇章节默认没自带评论（用户进详情页可触发再生成、Phase 4）
                userHint: userHint || null,    // 仅本章适用、pixiv 同款（便于将来 reroll）
                editedAt: now,
                editedAgoDisplay: '刚刚', // v2.73.8: i18n 黑名单 — 不存 I18n.t 输出（切语言后字段不会跟着变、且会喂回某些上下文）
                editLocation: this._randomEditLocation(),
                createdAt: now,
                isInvalid: false
            };
            return article;
        } catch (e) {
            console.error('[Lofter chapter gen]', e);
            Utils.showToast(I18n.t('lofter.toast_chapter_gen_failed', '章节生成失败：') + (e.message || ''));
            return null;
        }
    },

    // 合集元数据生成（名 + 描述、不算章节内容、独立轻量 LLM 调用）
    // userPrompt：用户给的合集主题方向（最高优先级、影响合集名 + 简介 + 情绪标签的取舍）
    async _generateCollectionMeta(npc, ip = null, userPrompt = null, styleInstruction = '') {
        const cp = AppState.data.broadcast?.cpSettings || {};
        const worldCtx = this._getWorldContext();
        const plotGate = this._getPlotGate(); // v2.73.11: 接 plotGate — 合集名 / 简介虽然不涉及具体剧情、但仍可能 LLM 自由发挥时暗示未发生剧情、加 gate 一致性更好
        const cpStr = cp.cpCharA && cp.cpCharB ? `${cp.cpCharA} × ${cp.cpCharB}` : '';
        const userPromptBlock = userPrompt
            ? `\n【作者给这个合集的方向（最高优先级）】\n${userPrompt}\n↑ 合集名 + 简介 + 情绪标签都应该围绕这个方向。但不要直接把方向当合集名照抄、而是写出一个有记忆点的"作者本人会取的名字"。\n`
            : '';
        const prompt = `你是中文 lofter 平台同人作者「${npc.name}」、即将开一个新的连载合集。

【世界观】
${worldCtx || '（未设定）'}
${cpStr ? `【CP】${cpStr}` : ''}
${ip ? `【tag】#${ip}#` : ''}
${plotGate.promptGateText}
${userPromptBlock}${styleInstruction ? `${styleInstruction}↑ 合集名 / 简介 / 情绪标签的气质应贴合这个文风基调。\n` : ''}
你偏好：${(npc.contentTags || []).join('、') || '同人创作'}
合集情绪标签（可选）：很甜 / 很虐 / 很真实 / 很治愈 / 很离谱

【中文同人圈适合开长篇连载的题材调调 — 参考画像、不是清单】
长篇合集常见的设定方向：**AU / paro** 系列（HP paro、校园 paro、abo、灵魂互换的两个 A、未来的孩子穿越回来、一方穿越到在一起之前、年龄操作）、**情境 / 虐系**（不 xx 就不能出去的房间、花吐症、生长痛、吊桥效应）、**关系动力学**长线推进（双向暗恋、为什么会爱上对方、亲朋好友眼里的他们这种旁观视角连作）、或者一个**单一巧思**铺成长篇（掉马甲、xx 喂养手册）。

↑ **绝对不要照单挑梗当合集名** —「捡手机」「花吐症」这种直接当合集名太露骨、像作业题。真实合集名是把这种调调消化成一个**作者本人会取的、有诗意 / 有钩子 / 有记忆点的名字**（比如花吐症调调可能叫「夏末花期」、灵魂互换可能叫「另一个我的春天」、校园 paro 可能叫「十六岁的雨季」）。同人圈每天都在发明新方向、不要被上方画像限制。

【输出格式】
<NAME>合集名（短而有记忆点、4-12 字）</NAME>
<DESC>合集介绍（1-2 句、不超过 40 字、写"专门吃 XX 的小号""不知道为什么就开了这个坑"等真实创作者的随手语气）</DESC>
<EMOJI_TAG>合集情绪标签、只能从上方 5 个里选一个、不要其他</EMOJI_TAG>

【铁律】简体中文输出。不要 JSON / markdown。`;

        try {
            const raw = await this._callLLM(prompt);
            const name = (raw.match(/<NAME>([\s\S]*?)<\/NAME>/) || [])[1]?.trim();
            const description = (raw.match(/<DESC>([\s\S]*?)<\/DESC>/) || [])[1]?.trim();
            const emojiTag = (raw.match(/<EMOJI_TAG>([\s\S]*?)<\/EMOJI_TAG>/) || [])[1]?.trim();
            if (!name) return null;
            return {
                name,
                description: description || '',
                emojiTag: ['很甜', '很虐', '很真实', '很治愈', '很离谱'].includes(emojiTag) ? emojiTag : null,
                emojiTagCount: emojiTag ? Math.floor(20 + Math.random() * 100) : 0
            };
        } catch (e) {
            console.warn('[Lofter collection meta gen]', e);
            return null;
        }
    },

    _randomCollectionCoverColor() {
        const palette = ['#1abc9c', '#ff8e7c', '#a78bfa', '#62b6cb', '#f5b800', '#ff6b9d', '#36b8d8', '#9b59b6'];
        return palette[Math.floor(Math.random() * palette.length)];
    },

    _randomEditLocation() {
        const cities = ['北京', '上海', '广东', '江苏', '浙江', '四川', '湖北', '湖南', '陕西', '辽宁', '海外', '台湾'];
        return cities[Math.floor(Math.random() * cities.length)];
    },

    // ========== Phase 4b: 设置 sub-screen ==========

    openSettingsSubScreen() {
        const ld = AppState.data.lofterData;
        if (!ld) return;
        const s = ld.settings;

        const inner = `
            <div class="lof-sub-bar">
                <button class="lof-sub-back" id="lofSettingsBack">‹</button>
                <div class="lof-sub-title">${I18n.t('lofter.settings_title', '设置')}</div>
                <span></span>
            </div>
            <div class="lof-settings-body">
                <div class="lof-settings-section">
                    <div class="lof-settings-section-title">${I18n.t('lofter.settings_section_autogen', '自动生成')}</div>
                    <label class="lof-settings-row">
                        <span class="lof-settings-row-label">${I18n.t('lofter.settings_auto_gen_enabled', '剧情更新时自动生成内容')}</span>
                        <input type="checkbox" id="lofSettingsAutoGen" ${s.autoGenOnNewPlot ? 'checked' : ''}>
                    </label>
                    <div class="lof-settings-hint">${I18n.t('lofter.settings_auto_gen_hint', '与 Pixiv 同款机制：放送局新增剧情节点时、自动后台生成对应数量的 lofter 短文 / 长篇内容')}</div>
                    <label class="lof-settings-row">
                        <span class="lof-settings-row-label">${I18n.t('lofter.settings_auto_gen_count', '每次触发生成数量')}</span>
                        <input type="number" id="lofSettingsAutoGenCount" min="1" max="5" value="${s.autoGenCount || 2}" class="lof-settings-number">
                    </label>
                </div>
                <div class="lof-settings-section">
                    <div class="lof-settings-section-title">${I18n.t('lofter.settings_section_display', '显示')}</div>
                    <label class="lof-settings-row">
                        <span class="lof-settings-row-label">${I18n.t('lofter.settings_show_invalid', '显示已失效的文章')}</span>
                        <input type="checkbox" id="lofSettingsShowInvalid" ${s.showInvalidArticles ? 'checked' : ''}>
                    </label>
                    <div class="lof-settings-hint">${I18n.t('lofter.settings_show_invalid_hint', '关闭后我的喜欢 / 收藏中已被作者删除的文章占位卡片不再显示')}</div>
                    <label class="lof-settings-row">
                        <span class="lof-settings-row-label">${I18n.t('lofter.settings_default_view', '默认视图')}</span>
                        <select id="lofSettingsDefaultView" class="lof-settings-select">
                            <option value="grid" ${s.defaultViewMode === 'grid' ? 'selected' : ''}>${I18n.t('lofter.view_grid', '网格')}</option>
                            <option value="list" ${s.defaultViewMode === 'list' ? 'selected' : ''}>${I18n.t('lofter.view_list', '列表')}</option>
                        </select>
                    </label>
                </div>
                <div class="lof-settings-section">
                    <div class="lof-settings-section-title">${I18n.t('lofter.settings_section_writers', '文手 · NPC 管理')}</div>
                    <button class="lof-settings-entry-btn" id="lofWriterMgrBtn">
                        <span>${I18n.t('lofter.settings_writer_mgr', '管理文手 / NPC（偏好 · 文风 · 启用停用 · 删除）')}</span>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                    <div class="lof-settings-hint">${I18n.t('lofter.settings_writer_mgr_hint', '改偏好 / 文风、停用不想看的（自动刷新与随机点名都不再选到 ta）、或删号退圈。这里管的是全部中文圈 NPC（文手 / 画手 / CP 粉 / 情报站）、与微博共用、改动两边同步。')}</div>
                </div>
                <div class="lof-settings-section">
                    <button class="lof-settings-save-btn" id="lofSettingsSave">${I18n.t('lofter.settings_save', '保存设置')}</button>
                </div>
            </div>
        `;

        const node = this._openSubScreen('lofSettingsSubScreen', inner);
        if (!node) return;
        document.getElementById('lofSettingsBack').onclick = () => this._closeSubScreen('lofSettingsSubScreen');
        document.getElementById('lofSettingsSave').onclick = () => this._saveSettings();
        document.getElementById('lofWriterMgrBtn').onclick = () => this.openWriterManager();
    },

    // ========== v2.141.0 文手管理（设置页入口）==========
    // 列出所有活跃 lofter 文手：编辑偏好/简介/昵称、启用停用(lofter.enabled)、删除(删号退圈、保留旧作)
    // NPC 与微博共用 weiboData.fanFriends，所有改动两边同步

    openWriterManager() {
        const node = this._openSubScreen('lofWriterMgrSubScreen', `
            <div class="lof-sub-bar">
                <button class="lof-sub-back" id="lofWMgrBack">‹</button>
                <div class="lof-sub-title">${I18n.t('lofter.writer_mgr_title', '文手 · NPC 管理')}</div>
                <span></span>
            </div>
            <div class="lof-writer-mgr-body" id="lofWMgrBody"></div>
        `);
        if (!node) return;
        document.getElementById('lofWMgrBack').onclick = () => this._closeSubScreen('lofWriterMgrSubScreen');
        this._renderWriterMgrList();
    },

    _renderWriterMgrList() {
        const body = document.getElementById('lofWMgrBody');
        if (!body) return;
        const writers = (AppState.data.weiboData?.fanFriends || []).filter(f =>
            this.LOFTER_ACTIVE_TYPES.includes(f.type)
        );
        if (writers.length === 0) {
            body.innerHTML = `<div class="lof-writer-mgr-empty">${I18n.t('lofter.writer_mgr_empty', '还没有中文圈文手。先在微博 / 放送局填充 CP 设定、刷新一次微博生成 NPC。')}</div>`;
            return;
        }
        const intro = `<div class="lof-writer-mgr-intro">${I18n.t('lofter.writer_mgr_intro', '这里是中文圈（微博 / Lofter 共用）的全部 NPC —— 文手、画手、CP 粉、情报站都在。改偏好 / 文风、启用停用、删号退圈，微博那边同步生效。')}</div>`;
        body.innerHTML = intro + writers.map(w => {
            const enabled = w.lofter?.enabled !== false;
            const tags = (w.contentTags || []).slice(0, 4).join('、') || I18n.t('lofter.writer_mgr_no_tags', '（无偏好标签）');
            const count = w.lofter?.articleCount || 0;
            return `
                <div class="lof-writer-row ${enabled ? '' : 'disabled'}" data-writer-id="${w.id}">
                    <div class="lof-writer-avatar" style="background:${w.avatarColor || '#1abc9c'}">${this._escapeHtml((w.name || '?')[0])}</div>
                    <div class="lof-writer-main">
                        <div class="lof-writer-name-row">
                            <span class="lof-writer-name">${this._escapeHtml(w.name || '?')}</span>
                            <span class="lof-writer-type">${this._writerTypeLabel(w.type)}</span>
                            <span class="lof-writer-count">${I18n.t('lofter.writer_mgr_count', { n: count })}</span>
                        </div>
                        <div class="lof-writer-tags">${this._escapeHtml(tags)}</div>
                        <div class="lof-writer-actions">
                            <label class="lof-writer-toggle">
                                <input type="checkbox" class="lof-writer-enable" ${enabled ? 'checked' : ''}>
                                <span>${I18n.t('lofter.writer_mgr_enable', '参与生成')}</span>
                            </label>
                            <button class="lof-writer-btn lof-writer-edit">${I18n.t('lofter.writer_mgr_edit', '编辑')}</button>
                            <button class="lof-writer-btn lof-writer-del">${I18n.t('lofter.writer_mgr_del', '删除')}</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        // 绑定事件（事件委托到每行）
        body.querySelectorAll('.lof-writer-row').forEach(row => {
            const id = row.dataset.writerId;
            const toggle = row.querySelector('.lof-writer-enable');
            if (toggle) toggle.onchange = () => this._toggleWriterEnabled(id, toggle.checked);
            const editBtn = row.querySelector('.lof-writer-edit');
            if (editBtn) editBtn.onclick = () => this.openWriterEdit(id);
            const delBtn = row.querySelector('.lof-writer-del');
            if (delBtn) delBtn.onclick = () => this._confirmDeleteWriter(id);
        });
    },

    _toggleWriterEnabled(npcId, enabled) {
        const npc = (AppState.data.weiboData?.fanFriends || []).find(f => f.id === npcId);
        if (!npc) return;
        if (!npc.lofter) npc.lofter = {};
        npc.lofter.enabled = enabled;
        Utils.saveData();
        // 行变灰/恢复，不整列重渲染（保留 toggle 焦点）
        const row = document.querySelector(`.lof-writer-row[data-writer-id="${npcId}"]`);
        if (row) row.classList.toggle('disabled', !enabled);
        Utils.showToast(enabled
            ? I18n.t('lofter.writer_mgr_toast_enabled', '✓ 已启用、ta 会重新参与生成')
            : I18n.t('lofter.writer_mgr_toast_disabled', '✓ 已停用、自动刷新与随机点名不再选到 ta'), 2500);
    },

    openWriterEdit(npcId) {
        const npc = (AppState.data.weiboData?.fanFriends || []).find(f => f.id === npcId);
        if (!npc) return;
        const tagsStr = (npc.contentTags || []).join('、');
        const node = this._openSubScreen('lofWriterEditSubScreen', `
            <div class="lof-sub-bar">
                <button class="lof-sub-back" id="lofWEditBack">‹</button>
                <div class="lof-sub-title">${I18n.t('lofter.writer_edit_title', '编辑文手')}</div>
                <span></span>
            </div>
            <div class="lof-writer-edit-body">
                <div class="lof-compose-hint-wrap">
                    <label class="lof-compose-hint-label">${I18n.t('lofter.writer_edit_name', '昵称')}</label>
                    <input type="text" id="lofWEditName" class="lof-writer-edit-input" value="${this._escapeHtml(npc.name || '')}">
                </div>
                <div class="lof-compose-hint-wrap">
                    <label class="lof-compose-hint-label">${I18n.t('lofter.writer_edit_bio', '简介')}</label>
                    <textarea id="lofWEditBio" rows="2" class="lof-compose-hint-textarea">${this._escapeHtml(npc.bio || '')}</textarea>
                </div>
                <div class="lof-compose-hint-wrap">
                    <label class="lof-compose-hint-label">${I18n.t('lofter.writer_edit_tags', '偏好（CP / 主题，顿号或逗号分隔）')}</label>
                    <textarea id="lofWEditTags" rows="2" class="lof-compose-hint-textarea" placeholder="${I18n.t('lofter.writer_edit_tags_ph', '例：A×B、校园paro、HE')}">${this._escapeHtml(tagsStr)}</textarea>
                    <div class="lof-settings-hint">${I18n.t('lofter.writer_edit_tags_hint', '这就是 ta 写文时的 CP / 题材倾向。雷拉郎配在这里改掉就行、改完立刻生效（微博那边也同步）。')}</div>
                </div>
                <div class="lof-compose-hint-wrap">
                    <label class="lof-compose-hint-label">${I18n.t('lofter.writer_edit_style', '文风（可选）')}</label>
                    <textarea id="lofWEditStyle" rows="3" class="lof-compose-hint-textarea" placeholder="${I18n.t('lofter.writer_edit_style_ph', '想指定文风就写 / 复制一段进来，例：细腻克制、多用短句、心理描写细致、对白生活化')}">${this._escapeHtml(npc.writingStyle || '')}</textarea>
                    <div class="lof-settings-hint">${I18n.t('lofter.writer_edit_style_hint', '一两句话描述 ta 的笔触就行、设了就在 ta 写文时生效。长篇合集若另选了合集文风、则以合集文风为准。')}</div>
                </div>
                <div class="lof-compose-submit-wrap">
                    <button class="lof-compose-submit" id="lofWEditSave">${I18n.t('lofter.writer_edit_save', '保存')}</button>
                </div>
            </div>
        `);
        if (!node) return;
        document.getElementById('lofWEditBack').onclick = () => this._closeSubScreen('lofWriterEditSubScreen');
        document.getElementById('lofWEditSave').onclick = () => {
            const name = (document.getElementById('lofWEditName')?.value || '').trim();
            const bio = (document.getElementById('lofWEditBio')?.value || '').trim();
            const tagsRaw = (document.getElementById('lofWEditTags')?.value || '').trim();
            if (!name) {
                Utils.showToast(I18n.t('lofter.writer_edit_name_required', '昵称不能为空'), 2500);
                return;
            }
            npc.name = name;
            npc.bio = bio;
            npc.contentTags = tagsRaw
                ? tagsRaw.split(/[、，,]/).map(s => s.trim()).filter(Boolean)
                : [];
            npc.writingStyle = (document.getElementById('lofWEditStyle')?.value || '').trim();
            Utils.saveData();
            this._closeSubScreen('lofWriterEditSubScreen');
            this._renderWriterMgrList();
            Utils.showToast(I18n.t('lofter.writer_edit_saved', '✓ 已保存'), 2000);
        };
    },

    _confirmDeleteWriter(npcId) {
        const npc = (AppState.data.weiboData?.fanFriends || []).find(f => f.id === npcId);
        if (!npc) return;
        const msg = I18n.t('lofter.writer_del_confirm', { name: npc.name || '?' });
        if (!confirm(msg)) return;
        // 删号退圈（②）：从共用名册移除（微博一起消失）；ta 名下的文章/合集保留、作者位显示「已注销作者」
        const wd = AppState.data.weiboData;
        if (wd && Array.isArray(wd.fanFriends)) {
            wd.fanFriends = wd.fanFriends.filter(f => f.id !== npcId);
        }
        const ld = AppState.data.lofterData;
        if (ld && Array.isArray(ld.followedAuthorIds)) {
            ld.followedAuthorIds = ld.followedAuthorIds.filter(id => id !== npcId);
        }
        Utils.saveData();
        this._renderWriterMgrList();
        Utils.showToast(I18n.t('lofter.writer_del_done', '✓ 已删号退圈、旧作仍保留（作者显示「已注销作者」）'), 3000);
    },

    _saveSettings() {
        const ld = AppState.data.lofterData;
        if (!ld) return;
        const autoGenEl = document.getElementById('lofSettingsAutoGen');
        const autoGenCountEl = document.getElementById('lofSettingsAutoGenCount');
        const showInvalidEl = document.getElementById('lofSettingsShowInvalid');
        const defaultViewEl = document.getElementById('lofSettingsDefaultView');
        if (autoGenEl) ld.settings.autoGenOnNewPlot = autoGenEl.checked;
        if (autoGenCountEl) ld.settings.autoGenCount = Math.max(1, Math.min(5, parseInt(autoGenCountEl.value) || 2));
        if (showInvalidEl) ld.settings.showInvalidArticles = showInvalidEl.checked;
        if (defaultViewEl) ld.settings.defaultViewMode = defaultViewEl.value;
        Utils.saveData();
        Utils.showToast(I18n.t('lofter.toast_settings_saved', '✓ 设置已保存'));
        this._closeSubScreen('lofSettingsSubScreen');
    },

    // ========== 剧情更新自动生成（forum.js 的 hook 调用此函数）==========
    async _autoGenerateOnPlot(count = 2) {
        const ld = AppState.data.lofterData;
        if (!ld) return;
        if (this._genLock || this._chapterLock) return;

        try {
            const collections = ld.collections || [];
            const writers = (AppState.data.weiboData?.fanFriends || []).filter(f =>
                f.lofter?.enabled !== false && f.type === 'fan_writer'
            );
            // 策略：① 合集池 < 2 + 有合格 writer → 创建新合集（占 1 次配额）
            //       ② 已有合集 → 给 1 个旧合集续章（占 1 次配额）
            //       ③ 剩余配额做短文批量生成
            let remaining = count;

            // ① 新合集
            if (remaining > 0 && collections.length < 2 && writers.length > 0) {
                const eligible = writers.filter(w => (w.lofter?.articleCount || 0) >= 1);
                if (eligible.length > 0) {
                    const picked = eligible[Math.floor(Math.random() * eligible.length)];
                    await this._generateLofterCollection(picked);
                    remaining--;
                }
            }

            // ② 续章（v2.141.0 只续作者还在的合集、跳过已删号作者的旧合集、避免白占配额）
            if (remaining > 0 && collections.length > 0) {
                const liveCollections = collections.filter(c =>
                    (AppState.data.weiboData?.fanFriends || []).some(f => f.id === c.authorNpcId)
                );
                if (liveCollections.length > 0) {
                    const target = liveCollections[Math.floor(Math.random() * liveCollections.length)];
                    if ((target.chapterCount || 0) < 10) {  // v2.73.9: 防 undefined（老存档合集没 chapterCount 字段、undefined < 10 是 false → 永远跳过续章）
                        await this._generateNextLofterChapter(target.id);
                        remaining--;
                    }
                }
            }

            // ③ 短文
            if (remaining > 0) {
                await this._generateLofterShorts(Math.max(3, remaining * 2));
            }
        } catch (e) {
            console.warn('[Lofter autoGen on plot]', e);
        }
    },

    // ========== 合集自动创建机制 ==========
    // 触发时机：① init 时 fan_writers 多 + 合集池空 → 随机创建 1 个；② Phase 4 autoGen
    async _maybeAutoCreateCollection() {
        if (this._chapterLock) return;
        const ld = AppState.data.lofterData;
        if (!ld) return;
        const existingCount = (ld.collections || []).length;
        // 已经有 >= 3 个合集就不再自动创建（避免堆太多）
        if (existingCount >= 3) return;

        const writers = (AppState.data.weiboData?.fanFriends || []).filter(f =>
            f.lofter?.enabled !== false && f.type === 'fan_writer'
        );
        if (writers.length === 0) return;

        // 挑一个 articleCount > 1 的 writer（保证有"基础粉丝"再开连载）
        const eligible = writers.filter(w => (w.lofter?.articleCount || 0) >= 1);
        if (eligible.length === 0) return;
        const picked = eligible[Math.floor(Math.random() * eligible.length)];
        await this._generateLofterCollection(picked);
    },

    _renderCollectionChapterRow(article, currentReadingId, viewMode) {
        const isCurrent = article.id === currentReadingId;
        const currentBadge = isCurrent
            ? `<span class="lof-col-current-badge">${I18n.t('lofter.col_currently_reading', '当前在看')}</span>`
            : '';
        if (viewMode === 'grid') {
            return `
                <div class="lof-col-chapter-row lof-col-grid-card ${isCurrent ? 'current' : ''}" data-article-id="${article.id}">
                    ${currentBadge}
                    <div class="lof-col-grid-num">${article.chapterNum || ''}</div>
                    <div class="lof-col-grid-title">${this._escapeHtml(article.title || '（无标题）')}</div>
                </div>
            `;
        }
        // long 类型不显示 summary（summary 是 LLM 内部章节摘要、用户不可见、pixiv 同款）
        return `
            <div class="lof-col-chapter-row ${isCurrent ? 'current' : ''}" data-article-id="${article.id}">
                ${currentBadge}
                <div class="lof-col-chapter-title">${this._escapeHtml(article.title || '（无标题）')}</div>
                <div class="lof-col-chapter-meta">${article.stats?.hearts || 0} ${I18n.t('lofter.heat', '热度')}</div>
            </div>
        `;
    },

    // ========== 我的 tab（Phase 2a）==========
    renderMe() {
        const body = document.getElementById('lofter-body');
        if (!body) return;
        const ld = AppState.data.lofterData;
        if (!ld) return;

        const userProfile = AppState.data.userProfile || {};
        // 默认占位昵称（隐私铁律：不用用户真名）
        const nickname = userProfile.nickname || I18n.t('lofter.default_user_name', 'Perigee 用户');
        const avatarLetter = (nickname + '')[0] || 'P';
        // 4 数据
        const articleCount = 0;  // 用户没发文（沉浸感铁律：lofter 用户不发文 in MVP）
        const heatCount = 0;     // 没文章自然没热度
        const followerCount = 0; // 没文章没人关注
        const followingCount = (ld.followedAuthorIds || []).length;
        // 4 快捷入口
        const likesCount = (ld.myLikedArticleIds || []).length + (ld.myFavoritedArticleIds || []).length;
        const subscribedCount = (ld.subscribedTags || []).length + (ld.subscribedCollectionIds || []).length;
        const footprintCount = (ld.myFootprintArticleIds || []).length;
        const readLaterCount = (ld.myReadLaterArticleIds || []).length;
        // 最近订阅更新（如果有 collection 更新）
        const latestUpdateNotif = this._getLatestUpdateNotif();

        body.innerHTML = `
            <div class="lof-me">
                <div class="lof-me-head">
                    <div class="lof-me-avatar" style="background:#1abc9c">${this._escapeHtml(avatarLetter)}</div>
                    <div class="lof-me-meta">
                        <div class="lof-me-name">${this._escapeHtml(nickname)}</div>
                    </div>
                    <button class="lof-me-edit" onclick="Utils.showToast(I18n.t('lofter.toast_edit_profile_coming_soon', '编辑资料即将上线'))" aria-label="edit">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                </div>
                <div class="lof-me-stats">
                    <div class="lof-me-stat">
                        <div class="lof-me-stat-num">${articleCount}</div>
                        <div class="lof-me-stat-label">${I18n.t('lofter.stat_articles', '文章')}</div>
                    </div>
                    <div class="lof-me-stat">
                        <div class="lof-me-stat-num">${heatCount}</div>
                        <div class="lof-me-stat-label">${I18n.t('lofter.stat_heat', '热度')}</div>
                    </div>
                    <div class="lof-me-stat">
                        <div class="lof-me-stat-num">${followerCount}</div>
                        <div class="lof-me-stat-label">${I18n.t('lofter.stat_followers', '粉丝')}</div>
                    </div>
                    <div class="lof-me-stat">
                        <div class="lof-me-stat-num">${followingCount}</div>
                        <div class="lof-me-stat-label">${I18n.t('lofter.stat_following', '关注')}</div>
                    </div>
                </div>
                <div class="lof-me-entries">
                    <button class="lof-me-entry" onclick="Lofter.openLikesSubScreen()">
                        <div class="lof-me-entry-icon lof-entry-heart">
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 21l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.18z"/></svg>
                        </div>
                        <div class="lof-me-entry-label">${I18n.t('lofter.entry_likes', '喜欢/收藏')}</div>
                        ${likesCount > 0 ? `<div class="lof-me-entry-badge">+${likesCount}</div>` : ''}
                    </button>
                    <button class="lof-me-entry" onclick="Lofter.switchTab('follow'); Lofter._followSubTab='subscribed'; Lofter.renderTopBar(); Lofter.renderFollow();">
                        <div class="lof-me-entry-icon lof-entry-bookmark">
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                        </div>
                        <div class="lof-me-entry-label">${I18n.t('lofter.entry_subscriptions', '我的订阅')}</div>
                        ${subscribedCount > 0 ? `<div class="lof-me-entry-badge">+${subscribedCount}</div>` : ''}
                    </button>
                    <button class="lof-me-entry" onclick="Lofter.openFootprintSubScreen()">
                        <div class="lof-me-entry-icon lof-entry-foot">
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </div>
                        <div class="lof-me-entry-label">${I18n.t('lofter.entry_footprint', '我的足迹')}</div>
                    </button>
                    <button class="lof-me-entry" onclick="Lofter.openReadLaterSubScreen()">
                        <div class="lof-me-entry-icon lof-entry-readlater">
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8" fill="none" stroke="white" stroke-width="2"/></svg>
                        </div>
                        <div class="lof-me-entry-label">${I18n.t('lofter.entry_read_later', '稍后再看')}</div>
                        ${readLaterCount > 0 ? `<div class="lof-me-entry-badge">${readLaterCount}</div>` : ''}
                    </button>
                </div>
                ${latestUpdateNotif ? `
                    <div class="lof-me-update-banner" data-article-id="${this._escapeHtml(latestUpdateNotif.articleId)}">
                        <div class="lof-me-update-avatar" style="background:${latestUpdateNotif.color}">${latestUpdateNotif.letter}</div>
                        <div class="lof-me-update-text">${this._escapeHtml(latestUpdateNotif.text)}</div>
                        <div class="lof-me-update-arrow">›</div>
                    </div>
                ` : ''}
                <div class="lof-me-section">
                    <div class="lof-me-section-title">${I18n.t('lofter.me_section_messages', '我的消息')}</div>
                    <div class="lof-me-msg-grid">
                        ${this._renderMeMsgItem('heart', '收到的喜欢', 'lofter.msg_received_likes')}
                        ${this._renderMeMsgItem('chat-bubble', '评论', 'lofter.msg_comments')}
                        ${this._renderMeMsgItem('chat', '聊天', 'lofter.msg_chats')}
                        ${this._renderMeMsgItem('bell', '通知', 'lofter.msg_notifications')}
                    </div>
                </div>
                <div class="lof-me-section">
                    <div class="lof-me-section-title">${I18n.t('lofter.me_section_creator', '创作者中心')}</div>
                    <div class="lof-me-creator-note">${I18n.t('lofter.creator_center_note', '创作者中心不在仿真范围内、若想发表创作请使用真实 lofter 平台')}</div>
                </div>
            </div>
        `;

        // v2.73.9: update banner 走 addEventListener + data-attr，避免 inline onclick 拼字符串
        const updateBanner = body.querySelector('.lof-me-update-banner');
        if (updateBanner) {
            updateBanner.onclick = () => {
                const id = updateBanner.dataset.articleId;
                if (id) this.openArticleDetail(id);
            };
        }
    },

    _renderMeMsgItem(iconKey, fallbackLabel, i18nKey) {
        const icons = {
            heart: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
            'chat-bubble': '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
            chat: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
            bell: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
        };
        return `
            <button class="lof-me-msg-item" onclick="Utils.showToast(I18n.t('lofter.toast_msg_coming_soon', '消息功能 Phase 4 上线'))">
                <div class="lof-me-msg-icon">${icons[iconKey] || ''}</div>
                <div class="lof-me-msg-label">${I18n.t(i18nKey, fallbackLabel)}</div>
            </button>
        `;
    },

    // 最近订阅更新横幅（找最新订阅合集的最新章节）
    _getLatestUpdateNotif() {
        const ld = AppState.data.lofterData;
        if (!ld) return null;
        const subColIds = ld.subscribedCollectionIds || [];
        if (subColIds.length === 0) return null;

        let latestArticle = null;
        let latestCollection = null;
        (ld.articles || []).forEach(a => {
            if (!a.collectionId || !subColIds.includes(a.collectionId)) return;
            if (!latestArticle || (a.createdAt || 0) > (latestArticle.createdAt || 0)) {
                latestArticle = a;
                latestCollection = (ld.collections || []).find(c => c.id === a.collectionId);
            }
        });
        if (!latestArticle || !latestCollection) return null;
        return {
            text: I18n.t('lofter.update_notif_text', { name: latestCollection.name }),
            color: latestCollection.coverColor || '#1abc9c',
            letter: ((latestCollection.name || '')[0] || 'C'),
            articleId: latestArticle.id  // v2.73.9: 不再返回拼好的 onclick 字符串、由 render 入口绑 addEventListener
        };
    },

    // ========== Phase 2b: 喜欢/收藏 / 足迹 / 稍后再看 sub-screens ==========

    openLikesSubScreen(initTab = 'liked') {
        this._likesSubTab = initTab;
        this._renderLikesSubScreen();
    },

    _renderLikesSubScreen() {
        const ld = AppState.data.lofterData;
        if (!ld) return;
        const tab = this._likesSubTab || 'liked';
        const ids = tab === 'liked'
            ? (ld.myLikedArticleIds || [])
            : (ld.myFavoritedArticleIds || []);
        const viewMode = ld.settings?.defaultViewMode || 'grid';

        const inner = `
            <div class="lof-sub-bar">
                <button class="lof-sub-back" id="lofLikesBack">‹</button>
                <div class="lof-sub-tabs">
                    <button class="lof-sub-tab ${tab === 'liked' ? 'active' : ''}" data-tab="liked">${I18n.t('lofter.my_liked', '我的喜欢')}</button>
                    <button class="lof-sub-tab ${tab === 'favorited' ? 'active' : ''}" data-tab="favorited">${I18n.t('lofter.my_favorited', '我的收藏')}</button>
                </div>
                <button class="lof-sub-search" onclick="Utils.showToast(I18n.t('lofter.toast_search_coming_soon', '搜索功能 Phase 4 上线'))" aria-label="search">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </button>
            </div>
            <div class="lof-sub-meta">
                <span class="lof-sub-count">${I18n.t('lofter.article_count', { n: ids.length })}</span>
                <button class="lof-view-toggle" id="lofLikesViewToggle" aria-label="toggle view">
                    ${this._viewToggleIcon(viewMode)}
                </button>
            </div>
            <div class="lof-sub-body" id="lofLikesBody">
                ${this._renderArticleListByMonth(ids, viewMode)}
            </div>
        `;

        const node = this._openSubScreen('lofLikesSubScreen', inner);
        if (!node) return;
        document.getElementById('lofLikesBack').onclick = () => this._closeSubScreen('lofLikesSubScreen');
        node.querySelectorAll('.lof-sub-tab').forEach(btn => {
            btn.onclick = () => {
                this._likesSubTab = btn.dataset.tab;
                this._closeSubScreen('lofLikesSubScreen');
                this._renderLikesSubScreen();
            };
        });
        document.getElementById('lofLikesViewToggle').onclick = () => this._toggleViewMode('lofLikesSubScreen');
        node.querySelectorAll('.lof-article-thumb, .lof-article-list-row').forEach(el => {
            el.onclick = () => {
                const id = el.dataset.articleId;
                if (id) this.openArticleDetail(id);
            };
        });
    },

    openFootprintSubScreen() {
        const ld = AppState.data.lofterData;
        if (!ld) return;
        const ids = ld.myFootprintArticleIds || [];
        const viewMode = ld.settings?.defaultViewMode || 'list';

        const inner = `
            <div class="lof-sub-bar">
                <button class="lof-sub-back" id="lofFootBack">‹</button>
                <div class="lof-sub-title">${I18n.t('lofter.entry_footprint', '我的足迹')}</div>
                <button class="lof-sub-clear" id="lofFootClear">${I18n.t('lofter.btn_clear', '清空')}</button>
            </div>
            <div class="lof-sub-meta">
                <span class="lof-sub-count">${I18n.t('lofter.article_count', { n: ids.length })}</span>
                <button class="lof-view-toggle" id="lofFootViewToggle" aria-label="toggle view">
                    ${this._viewToggleIcon(viewMode)}
                </button>
            </div>
            <div class="lof-sub-body" id="lofFootBody">
                ${this._renderArticleListByMonth(ids, viewMode, /* preserveOrder */ true)}
            </div>
        `;

        const node = this._openSubScreen('lofFootprintSubScreen', inner);
        if (!node) return;
        document.getElementById('lofFootBack').onclick = () => this._closeSubScreen('lofFootprintSubScreen');
        document.getElementById('lofFootClear').onclick = () => {
            if (confirm(I18n.t('lofter.confirm_clear_footprint', '确定要清空浏览记录吗？'))) {
                ld.myFootprintArticleIds = [];
                Utils.saveData();
                this._closeSubScreen('lofFootprintSubScreen');
                this.openFootprintSubScreen();
            }
        };
        document.getElementById('lofFootViewToggle').onclick = () => this._toggleViewMode('lofFootprintSubScreen');
        node.querySelectorAll('.lof-article-thumb, .lof-article-list-row').forEach(el => {
            el.onclick = () => {
                const id = el.dataset.articleId;
                if (id) this.openArticleDetail(id);
            };
        });
    },

    openReadLaterSubScreen() {
        const ld = AppState.data.lofterData;
        if (!ld) return;
        const ids = ld.myReadLaterArticleIds || [];
        const viewMode = ld.settings?.defaultViewMode || 'list';

        const inner = `
            <div class="lof-sub-bar">
                <button class="lof-sub-back" id="lofRLBack">‹</button>
                <div class="lof-sub-title">${I18n.t('lofter.entry_read_later', '稍后再看')}</div>
                <span></span>
            </div>
            <div class="lof-sub-meta">
                <span class="lof-sub-count">${I18n.t('lofter.article_count', { n: ids.length })}</span>
                <button class="lof-view-toggle" id="lofRLViewToggle" aria-label="toggle view">
                    ${this._viewToggleIcon(viewMode)}
                </button>
            </div>
            <div class="lof-sub-body" id="lofRLBody">
                ${this._renderArticleListByMonth(ids, viewMode, /* preserveOrder */ true)}
            </div>
        `;

        const node = this._openSubScreen('lofReadLaterSubScreen', inner);
        if (!node) return;
        document.getElementById('lofRLBack').onclick = () => this._closeSubScreen('lofReadLaterSubScreen');
        document.getElementById('lofRLViewToggle').onclick = () => this._toggleViewMode('lofReadLaterSubScreen');
        node.querySelectorAll('.lof-article-thumb, .lof-article-list-row').forEach(el => {
            el.onclick = () => {
                const id = el.dataset.articleId;
                if (id) this.openArticleDetail(id);
            };
        });
    },

    _viewToggleIcon(mode) {
        // 当前是 grid → 显示 list icon；当前是 list → 显示 grid icon
        if (mode === 'grid') {
            return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>';
        }
        return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>';
    },

    _toggleViewMode(subScreenId) {
        const ld = AppState.data.lofterData;
        if (!ld?.settings) return;
        ld.settings.defaultViewMode = ld.settings.defaultViewMode === 'grid' ? 'list' : 'grid';
        Utils.saveData();
        // 重新打开对应的 sub-screen
        this._closeSubScreen(subScreenId);
        if (subScreenId === 'lofLikesSubScreen') this._renderLikesSubScreen();
        else if (subScreenId === 'lofFootprintSubScreen') this.openFootprintSubScreen();
        else if (subScreenId === 'lofReadLaterSubScreen') this.openReadLaterSubScreen();
    },

    // 共用：按月分组渲染文章列表
    // preserveOrder: 浏览历史 / 稍后再看 保持 ids 数组顺序；喜欢/收藏按 createdAt desc 排
    _renderArticleListByMonth(ids, viewMode = 'grid', preserveOrder = false) {
        const ld = AppState.data.lofterData;
        if (!ld || ids.length === 0) {
            return `<div class="lof-sub-empty">${I18n.t('lofter.sub_empty', '空空如也、快去刷文吧')}</div>`;
        }

        // 把 ids 转成 article 对象、丢失的 fallback 成"已失效"占位
        const items = ids.map(id => {
            const a = (ld.articles || []).find(x => x.id === id);
            if (!a) {
                return { id, isInvalid: true, _resolvedAt: Date.now() };
            }
            return a;
        });

        // 排序
        let sortedItems;
        if (preserveOrder) {
            sortedItems = items;
        } else {
            sortedItems = items.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        }

        // 按月分组（用 createdAt、失效卡用 _resolvedAt 兜底）
        const groups = new Map();
        sortedItems.forEach(item => {
            const ts = item.createdAt || item._resolvedAt || Date.now();
            const d = new Date(ts);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!groups.has(key)) groups.set(key, { ts, items: [] });
            groups.get(key).items.push(item);
        });

        const groupKeys = [...groups.keys()].sort((a, b) => b.localeCompare(a));
        return groupKeys.map(key => {
            const g = groups.get(key);
            const ymLabel = this._formatMonthYear(g.ts);
            const cards = viewMode === 'grid'
                ? `<div class="lof-grid">${g.items.map(it => this._renderArticleThumb(it)).join('')}</div>`
                : `<div class="lof-list">${g.items.map(it => this._renderArticleListRow(it)).join('')}</div>`;
            return `
                <div class="lof-month-group">
                    <div class="lof-month-head">
                        <span class="lof-month-label">${this._escapeHtml(ymLabel)}</span>
                        <span class="lof-month-count">${I18n.t('lofter.month_n_articles', { n: g.items.length })}</span>
                    </div>
                    ${cards}
                </div>
            `;
        }).join('');
    },

    _renderArticleThumb(item) {
        if (item.isInvalid) {
            return `
                <div class="lof-article-thumb lof-article-invalid">
                    <div class="lof-article-invalid-text">${I18n.t('lofter.article_invalid', '该文章已失效')}</div>
                </div>
            `;
        }
        const angleHash = (item.id || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
        const colorBg = ['#ffd6e0', '#d6e8ff', '#e3d6ff', '#fff0d6', '#d6ffe6', '#ffeaa7'][angleHash % 6];
        // 有图卡 / 无图文字卡 两套
        if (item.hasImages) {
            return `
                <div class="lof-article-thumb lof-article-thumb-img" data-article-id="${item.id}" style="background:${colorBg}">
                    ${item.imageCount > 1 ? `<div class="lof-thumb-multi-badge">${item.imageCount}</div>` : ''}
                </div>
            `;
        }
        return `
            <div class="lof-article-thumb lof-article-thumb-text" data-article-id="${item.id}">
                <div class="lof-thumb-text-title">${this._escapeHtml(item.title || (item.content || '').slice(0, 30) || '（无标题）')}</div>
            </div>
        `;
    },

    _renderArticleListRow(item) {
        if (item.isInvalid) {
            return `
                <div class="lof-article-list-row lof-article-invalid">
                    <div class="lof-article-invalid-text">${I18n.t('lofter.article_invalid', '该文章已失效')}</div>
                </div>
            `;
        }
        const title = item.title || (item.content || '').slice(0, 50) || '（无标题）';
        const summary = item.summary || (item.content || '').slice(0, 80);
        return `
            <div class="lof-article-list-row" data-article-id="${item.id}">
                <div class="lof-list-row-title">${this._escapeHtml(title)}</div>
                ${summary ? `<div class="lof-list-row-summary">${this._escapeHtml(summary)}</div>` : ''}
            </div>
        `;
    },

    // ========== 子页面切换（仿 Weibo._openSubScreen 同款模式、Phase 0b 启用）==========
    _openSubScreen(id, innerHtml) {
        const lofter = document.getElementById('lofter');
        if (!lofter) return null;
        const existed = document.getElementById(id);
        if (existed) existed.remove();
        const node = document.createElement('div');
        node.id = id;
        node.className = 'lof-sub-screen';
        node.innerHTML = innerHtml;
        lofter.appendChild(node);
        return node;
    },

    _closeSubScreen(id) {
        const n = document.getElementById(id);
        if (n) n.remove();
    }
};
