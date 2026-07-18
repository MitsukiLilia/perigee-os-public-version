// Pixiv小说模块 - AI生成小说，与揭示板联动
const PixivNovel = {
    currentMainTab: 'novel',
    currentTab: 'all',
    currentNovelId: null,
    currentChapterIdx: 0,
    sortBy: 'newest',
    searchQuery: '',
    filterTag: '',
    _pendingNextChapterNovelId: null,  // deprecated, kept for compat
    _pendingChapterAction: null,       // { type:'next'|'reroll', novelId, chapterIdx? }
    _isGeneratingChapter: false,       // 并发锁：续章/重写生成中、防双击重复生成

    // ── 章节点赞档C建模（v2.190）─────────────────────────────
    // 公式定稿见 docs/superpowers/specs/2026-07-09-pixiv-hearts-model-design.md
    // twitterData 一律显式传参：迁移执行时 AppState.data 尚未赋值，禁止在这组函数里读 AppState

    _rollVirtualFc() {
        return 3000 + Math.floor(Math.random() * 17001);   // 3,000〜20,000
    },

    _resolveAuthorFc(novel, twitterData) {
        if (novel.author_npc_id) {
            const fan = ((twitterData || {}).fanFriends || []).find(f => f.id === novel.author_npc_id);
            if (fan) return Twitter._npcFollowerCount(fan);
            return Twitter._genFollowerCount(novel.author_npc_id);
        }
        if (typeof novel.virtualFc !== 'number') novel.virtualFc = this._rollVirtualFc();
        return novel.virtualFc;
    },

    _rollHeatBase(fc) {
        const r = Math.random();
        let m = 1;                                          // 70% 无加成
        if (r >= 0.98) m = 8 + Math.random() * 6;           // 2% 大爆 ×8〜14
        else if (r >= 0.90) m = 4 + Math.random() * 3;      // 8% 中爆 ×4〜7
        else if (r >= 0.70) m = 1.8 + Math.random() * 1.2;  // 20% 小爆 ×1.8〜3
        return Math.min(30000, Math.round(fc * (0.01 + Math.random() * 0.02) * m));
    },

    _rollChapterHearts(heatBase) {
        return Math.max(3, Math.round((heatBase || 0) * (0.75 + Math.random() * 0.5)));
    },

    // novel.hearts = 最高章 hearts 缓存（不含 likeBoost：玩家点赞不改变 popular 排序）
    _recalcNovelHearts(novel) {
        novel.hearts = (novel.chapters || []).reduce((mx, ch) => Math.max(mx, ch.hearts || 0), 0);
    },

    // 创建路径/迁移共用的一站式初始化；只填缺失章的 hearts（幂等友好）
    _initNovelPopularity(novel, twitterData) {
        const fc = this._resolveAuthorFc(novel, twitterData);
        novel.heatBase = this._rollHeatBase(fc);
        (novel.chapters || []).forEach(ch => {
            if (typeof ch.hearts !== 'number') ch.hearts = this._rollChapterHearts(novel.heatBase);
        });
        this._recalcNovelHearts(novel);
    },

    _seedingDoujin: false,             // v2.123.0 并发锁：doujin_writer 种子播种中、防并发重复种

    // ===== 初始化 =====
    init() {
        // v2.76.3: 清理上次残留的 subScreen（用户从子页点小说进 reader、返回时 init 重跑、否则旧子页 z-index 盖在首页上）
        this._cleanupSubScreens();
        const d = AppState.data;
        if (!d.pixivData) {
            d.pixivData = {
                settings: { cp: '', forumLinked: true, additionalWorldBookIds: [], customPrompt: '', novelRules: '', language: 'jp-cn', writingStyles: [] },
                novels: [], favorites: []
            };
        }

        // 确保有默认文风预设（v2.123.0 抽到 _ensureWritingStyles 复用：推特预热种子也走它、不依赖打开 pixiv tab）
        const settings = this._ensureWritingStyles();

        // 应用保存的字体大小
        this.applyFontSize(settings.fontSize || 16);

        this.currentTab = 'all';
        this.searchQuery = '';
        this.filterTag = '';
        document.getElementById('pixivSearchInput').value = '';
        this.switchMainTab(this.currentMainTab || 'novel');
        this.updateTabs();
        this.renderTagBar();
        this.renderNovelList();

        // 绑定事件
        document.getElementById('pixivMainTabIllust').onclick = () => this.switchMainTab('illust');
        document.getElementById('pixivMainTabNovel').onclick = () => this.switchMainTab('novel');
        document.getElementById('pixivMainTabUser').onclick = () => this.switchMainTab('user');

        document.getElementById('pixivTabAll').onclick = () => this.switchTab('all');
        // v2.76.0 Phase 4: 收藏 sub-tab 移除 — 通过个人首页 → 收藏 row 进入
        document.getElementById('pixivTabSerial').onclick = () => this.switchTab('serial');

        // v2.76.2: ➕ 直接弹 AI 生成（手动创作入口移到个人首页「投稿作品」）
        const novelGenBtn = document.getElementById('pixivNovelGenerateBtn');
        if (novelGenBtn) {
            novelGenBtn.onclick = () => this.showGenerateModal();
        }

        // 绑定搜索回车
        const searchInput = document.getElementById('pixivSearchInput');
        if (searchInput) {
            searchInput.onkeyup = (e) => {
                if (e.key === 'Enter') this.search(e.target.value);
            };
        }
        const searchBtn = document.getElementById('pixivSearchBtn');
        if (searchBtn) {
            searchBtn.onclick = () => this.search(document.getElementById('pixivSearchInput').value);
        }

        // 绑定设置保存
        const saveBtn = document.getElementById('savePixivSettingsBtn');
        if (saveBtn) saveBtn.onclick = () => this.saveSettings();

        // 绑定联动复选框
        const linkCheckbox = document.getElementById('pixivForumLinked');
        if (linkCheckbox) {
            linkCheckbox.onchange = (e) => this.toggleForumLink(e.target.checked);
        }

        // v2.76.4: creation menu 已移除（➕ 直接弹 AI 生成、手动创作走个人首页「投稿作品」）

        // 绑定生成弹窗按钮
        const genSubmitBtn = document.getElementById('pixivGenSubmitBtn');
        if (genSubmitBtn) {
            genSubmitBtn.onclick = () => this.generateNovel();
        }
        const genCancelBtn = document.getElementById('pixivGenCancelBtn');
        if (genCancelBtn) {
            genCancelBtn.onclick = () => {
                document.getElementById('pixivGenerateModal').classList.remove('active');
            };
        }

        // 初始化设置UI
        if (this.loadSettingsUI) {
            this.loadSettingsUI();
        } else if (this.initSettings) {
            this.initSettings();
        }

        // v2.70.0 后台 idempotent 种子播种（沉浸感铁律：无 UI）
        // 延迟一拍触发、不阻塞 init / 渲染
        setTimeout(() => this._maybeSeedDoujinWriters(), 100);
    },

    // v2.123.0：确保 pixivData + 默认文风就绪（init 和推特预热种子共用、种子不再依赖打开 pixiv tab）
    _ensureWritingStyles() {
        const d = AppState.data;
        if (!d.pixivData) {
            d.pixivData = {
                settings: { cp: '', forumLinked: true, additionalWorldBookIds: [], customPrompt: '', novelRules: '', language: 'jp-cn', writingStyles: [] },
                novels: [], favorites: []
            };
        }
        const settings = d.pixivData.settings;
        if (!settings.writingStyles) settings.writingStyles = [];
        if (settings.writingStyles.length === 0) {
            settings.writingStyles = this.getDefaultWritingStyles();
            Utils.saveData();
        }
        return settings;
    },

    // ===== v2.70.0 后台 idempotent 种子播种检测（v2.123.0 修幂等判据 + 加并发锁）=====
    async _maybeSeedDoujinWriters() {
        if (this._seedingDoujin) return;                 // v2.123.0 并发锁（init / 推特预热 / 刷新可能并发触发）
        const fanFriends = (AppState.data.twitterData && AppState.data.twitterData.fanFriends) || [];

        // v2.123.0 幂等：只认「种子产的」writer（_seeded），手动加的好友不算、也不会把池子锁死
        const seededWriters = fanFriends.filter(f => f.type === 'doujin_writer' && f._seeded);
        if (seededWriters.length > 0) return;

        // 没填 worldContext 或没 CP → 静默跳过、不报错
        const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext)
            ? Forum.getWorldContext()
            : (AppState.data.broadcast?.worldSetting || '');
        if (!worldContext || !worldContext.trim()) return;

        const cpInfo = (typeof Broadcast !== 'undefined' && Broadcast.getCP) ? Broadcast.getCP() : {};
        if (!cpInfo.hasCP) return;

        // 条件满足 → 静默后台播种（加锁、防并发重复种）
        this._seedingDoujin = true;
        try {
            await this._seedDoujinWriters(5);
        } catch (e) {
            console.warn('[Seed v2.70.0] 播种失败、下次再试:', e);
        } finally {
            this._seedingDoujin = false;
        }
    },

    // ===== v2.70.0 LLM 种子播种（无 UI、无 toast）=====
    async _seedDoujinWriters(count = 5) {
        // twitterData 默认结构里没有 fanFriends（只在进推特页的 Twitter._ensureData() 里补建）
        // pixiv 页不保证 Twitter 已初始化，这里就地兜底，避免裸访问导致每次白烧一次 LLM 调用
        if (!AppState.data.twitterData) AppState.data.twitterData = {};
        if (!AppState.data.twitterData.fanFriends) AppState.data.twitterData.fanFriends = [];

        const settings = this._ensureWritingStyles();  // v2.123.0：确保 pixivData + 默认文风就绪（推特预热可能早于 pixiv.init）
        const styles = (settings.writingStyles || []).filter(s => s.enabled);
        if (styles.length === 0) return;  // 没有可用 style、跳过

        const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext)
            ? Forum.getWorldContext()
            : '';
        const cpInfo = (typeof Broadcast !== 'undefined' && Broadcast.getCP) ? Broadcast.getCP() : {};

        const stylesList = styles.map(s => `- ${s.id}: ${s.name}（${s.description}）`).join('\n');
        const cpHint = cpInfo.hasCP ? `${cpInfo.cpCharA}×${cpInfo.cpCharB}（${cpInfo.cpNickname || ''}）` : '（CP 未设定）';

        const systemPrompt = `あなたは虚構の同人作家 NPC を生成するアシスタントです。
以下の世界観と CP 設定に基づき、${count}人の虚構の pixiv 同人作家 NPC を生成してください。

要求：
- 多様化された日式 handle（@xxx_zz、@yorukami_03、@illustr_mimi 等のような）
- 名前は日式昵称・平仮名・片仮名・ローマ字混搭で多様化
- 文風は以下のリストから割り当て（${count}人で分布を均等に）
- contentTags は世界観の主要 CP / キャラクター名から 1-3 個選んで偏好として設定
- promoteStyle は分布: active 30% / occasional 50% / shy 20%
- bio は 1-2 文の日式 self-intro（例：「${cpInfo.cp || 'XX'}沼って数年、たまに短編書きます」）

世界観：
${worldContext}

CP 設定: ${cpHint}

利用可能な文風 style.id 一覧：
${stylesList}

出力フォーマット（厳守、---NPC--- 区切り）：
---NPC---
NAME: [日式名]
HANDLE: [@xxx 形式]
PIXIV_HANDLE: [@xxx 形式、handle と同じでも違ってもよい]
BIO: [1-2文 self-intro]
WRITING_STYLE_ID: [上記一覧のいずれか]
CONTENT_TAGS: [tag1, tag2, ...]
PROMOTE_STYLE: [active/occasional/shy]

${count}人分繰り返してください。`;

        const messages = [{ role: 'user', content: `${count}人の同人作家 NPC を生成してください。` }];
        const raw = await Utils.callChatAPI(messages, systemPrompt);

        // parse ---NPC--- 区块
        const blocks = raw.split(/---NPC---/i).slice(1).map(b => b.trim()).filter(Boolean);
        let added = 0;
        const existingHandles = new Set(AppState.data.twitterData.fanFriends.map(f => f.handle));
        for (const block of blocks) {
            const fields = {};
            block.split('\n').forEach(line => {
                const m = line.match(/^([A-Z_]+):\s*(.+)$/);
                if (m) fields[m[1]] = m[2].trim();
            });

            if (!fields.NAME || !fields.HANDLE) continue;  // 必填字段缺失、跳过

            // 重 handle 检测（含已添加的 + 同批次的）
            if (existingHandles.has(fields.HANDLE)) continue;

            // writingStyleId 校验、fallback random
            let styleId = fields.WRITING_STYLE_ID;
            if (!styles.find(s => s.id === styleId)) {
                styleId = styles[Math.floor(Math.random() * styles.length)].id;
            }

            // promoteStyle 校验
            const validStyles = ['active', 'occasional', 'shy'];
            const promoteStyle = validStyles.includes(fields.PROMOTE_STYLE) ? fields.PROMOTE_STYLE : 'occasional';

            // contentTags parse
            const contentTags = (fields.CONTENT_TAGS || '')
                .split(/[,，、]/).map(t => t.trim()).filter(Boolean);

            // 上限检测（不超 20）
            if (AppState.data.twitterData.fanFriends.length >= 20) break;

            AppState.data.twitterData.fanFriends.push({
                id: Utils.generateId(),
                name: fields.NAME,
                handle: fields.HANDLE,
                pixivHandle: fields.PIXIV_HANDLE || fields.HANDLE,
                type: 'doujin_writer',
                _seeded: true,  // v2.123.0 种子标记：幂等判据只认它，手动加的好友不影响补种
                avatarColor: this._randomAvatarColor(),
                bio: fields.BIO || null,
                leakProne: Math.random() > 0.3,  // doujin 默认偏 leakProne
                createdAt: Date.now(),
                lineCharId: null,
                writingStyleId: styleId,
                contentTags: contentTags,
                promoteStyle: promoteStyle,
                melonbooksCircleId: null,
                hasUnlockableContent: false,
            });
            existingHandles.add(fields.HANDLE);
            added++;
        }

        if (added > 0) {
            Utils.saveData();
            console.log(`[Seed v2.70.0] 后台播种 ${added} 位 doujin_writer`);
        } else {
            console.warn('[Seed v2.70.0] 解析 0 个、下次进 pixiv 重试');
        }
    },

    _randomAvatarColor() {
        const palette = ['#e0245e', '#1da1f2', '#ff7f50', '#9b59b6', '#27ae60', '#f1c40f', '#e67e22', '#16a085'];
        return palette[Math.floor(Math.random() * palette.length)];
    },

    // ===== 主Tab切换 (插画·漫画 / 小说 / 用户) =====
    switchMainTab(tab) {
        this.currentMainTab = tab;
        // 更新tab按钮
        document.getElementById('pixivMainTabIllust').classList.toggle('active', tab === 'illust');
        document.getElementById('pixivMainTabNovel').classList.toggle('active', tab === 'novel');
        document.getElementById('pixivMainTabUser').classList.toggle('active', tab === 'user');
        // 显示/隐藏页面
        document.getElementById('pixivPageIllust').style.display = tab === 'illust' ? '' : 'none';
        document.getElementById('pixivPageNovel').style.display = tab === 'novel' ? '' : 'none';
        document.getElementById('pixivPageUser').style.display = tab === 'user' ? '' : 'none';

        // 按钮显示控制
        const novelBtn = document.getElementById('pixivNovelGenerateBtn');
        const illustBtn = document.getElementById('pixivIllustGenerateBtn');

        if (novelBtn) novelBtn.style.display = tab === 'novel' ? '' : 'none';
        if (illustBtn) illustBtn.style.display = tab === 'illust' ? '' : 'none';

        // 如果切换到插画tab，初始化插画模块
        if (tab === 'illust' && typeof PixivIllust !== 'undefined') {
            PixivIllust.init();
        }
        // v2.76.0 Phase 4: 切到「我」时刷新个人首页 hero
        if (tab === 'user' && this.renderProfileHome) {
            this.renderProfileHome();
        }
    },

    // ===== Tab切换 =====
    switchTab(tab) {
        this.currentTab = tab;
        this.updateTabs();
        this.renderNovelList();
    },

    updateTabs() {
        document.getElementById('pixivTabAll').classList.toggle('active', this.currentTab === 'all');
        // v2.76.0 Phase 4: pixivTabFav 已移除（个人首页 → 收藏 row 进入）
        document.getElementById('pixivTabSerial').classList.toggle('active', this.currentTab === 'serial');
    },

    // ===== 排序 =====
    setSort(sortBy) {
        this.sortBy = sortBy;
        // 更新排序按钮UI
        const newestBtn = document.getElementById('pixivSortNewest');
        const popularBtn = document.getElementById('pixivSortPopular');
        if (newestBtn && popularBtn) {
            newestBtn.classList.toggle('active', sortBy === 'newest');
            popularBtn.classList.toggle('active', sortBy === 'popular');
        }
        this.renderNovelList();
    },

    // ===== 搜索 =====
    search(query) {
        this.searchQuery = (query || '').trim().toLowerCase();
        this.filterTag = '';
        this.renderTagBar();
        this.renderNovelList();
    },

    // ===== 标签栏 =====
    getAllTags() {
        const data = AppState.data.pixivData;
        const tagMap = {};
        (data.novels || []).forEach(n => {
            (n.tags || []).forEach(t => {
                tagMap[t] = (tagMap[t] || 0) + 1;
            });
        });
        return Object.entries(tagMap).sort((a, b) => b[1] - a[1]).map(e => e[0]);
    },

    renderTagBar() {
        const row = document.getElementById('pixivTagRow');
        const tags = this.getAllTags();
        if (tags.length === 0) {
            row.style.display = 'none';
            return;
        }
        row.style.display = 'flex';
        // ⚠️ 保留独立实现，勿收编 Utils.escapeHtml（那边会把 ' 转成 &#39;）：
        // 下方 _jsAttrEsc 依赖本函数不转义单引号，先转义会击穿 onclick 字符串（原因见其注释）
        const _esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        // onclick 参数需在 HTML 属性转义之外，再做 JS 字符串层转义（反斜杠先于单引号）：
        // 浏览器解析 onclick 属性值时会先做 HTML 实体解码，再把解码后的文本当 JS 源码解析，
        // 所以单引号必须写成字面 \' 而不是 &#39;，否则解码后又变回裸引号击穿字符串
        const _jsAttrEsc = s => _esc(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        row.innerHTML = tags.slice(0, 15).map(t =>
            `<span class="pixiv-tag-chip${this.filterTag === t ? ' active' : ''}" onclick="PixivNovel.toggleTag('${_jsAttrEsc(t)}')">#${_esc(t.replace(/^#/, ''))}</span>`
        ).join('');
    },

    toggleTag(tag) {
        this.filterTag = this.filterTag === tag ? '' : tag;
        this.searchQuery = '';
        document.getElementById('pixivSearchInput').value = '';
        this.renderTagBar();
        this.renderNovelList();
    },

    // ===== 小说列表渲染 =====
    renderNovelList() {
        const data = AppState.data.pixivData;
        let novels = [...(data.novels || [])];

        // Tab过滤
        if (this.currentTab === 'favorites') {
            novels = novels.filter(n => (data.favorites || []).includes(n.id));
        } else if (this.currentTab === 'serial') {
            novels = novels.filter(n => n.isSerial);
        }

        // 搜索过滤
        if (this.searchQuery) {
            novels = novels.filter(n =>
                (n.title || '').toLowerCase().includes(this.searchQuery) ||
                (n.author || '').toLowerCase().includes(this.searchQuery) ||
                (n.tags || []).some(t => t.toLowerCase().includes(this.searchQuery))
            );
        }

        // 标签过滤
        if (this.filterTag) {
            novels = novels.filter(n => (n.tags || []).includes(this.filterTag));
        }

        // 排序
        if (this.sortBy === 'newest') {
            novels.sort((a, b) => (b.updatedAt || b.timestamp) - (a.updatedAt || a.timestamp));
        } else if (this.sortBy === 'popular') {
            novels.sort((a, b) => (b.hearts || 0) - (a.hearts || 0));
        } else if (this.sortBy === 'wordcount') {
            const wc = n => (n.chapters || []).reduce((s, c) => s + (c.wordCount || 0), 0);
            novels.sort((a, b) => wc(b) - wc(a));
        }

        const container = document.getElementById('pixivNovelList');
        if (novels.length === 0) {
            container.innerHTML = `<div class="empty-state" data-i18n="pixiv.empty">${I18n.t('pixiv.empty', '暂无小说，点击 + 生成')}</div>`;
            return;
        }

        container.innerHTML = `<div class="pixiv-novel-list">${novels.map(n => this.renderNovelCard(n)).join('')}</div>`;
    },

    renderNovelCard(novel) {
        const data = AppState.data.pixivData;
        const isFav = (data.favorites || []).includes(novel.id);
        const totalWords = (novel.chapters || []).reduce((s, c) => s + (c.wordCount || 0), 0);
        const chapterCount = (novel.chapters || []).length;
        const _esc = s => Utils.escapeHtml(s || '');
        const titleDisplay = _esc(this.stripHtml(novel.title || ''));
        const timeAgo = this._timeAgo(novel.updatedAt || novel.timestamp);

        return `<div class="pixiv-novel-card" onclick="PixivNovel.openNovel('${novel.id}')">
            <div class="pixiv-card-cover">
                ${novel.isSerial ? `<span class="pixiv-cover-serial-badge">${chapterCount}${I18n.t('pixiv.ch_unit', 'ch')}</span>` : ''}
                ${novel.completed ? `<span class="pixiv-cover-serial-badge" style="background:var(--success-color);">${I18n.t('pixiv.badge_completed', '完結')}</span>` : ''}
                ${novel.isUserCreated ? `<span class="pixiv-cover-user-badge">✎</span>` : ''}
                <span class="pixiv-cover-text">${titleDisplay}</span>
            </div>
            <div class="pixiv-card-content">
                <div class="pixiv-card-title">${titleDisplay}</div>
                <div class="pixiv-card-author">by ${novel.author_npc_id ? `<a class="pixiv-novel-author-link" onclick="event.stopPropagation();Twitter.openFanProfile('${_esc(novel.author_npc_id)}')">${_esc(novel.author || I18n.t('pixiv.anonymous', '匿名'))}</a>` : _esc(novel.author || I18n.t('pixiv.anonymous', '匿名'))}${novel.isUserCreated ? ' ✓' : ''}</div>
                <div class="pixiv-card-info">
                    <span>${I18n.t('pixiv.word_count_format', {n: totalWords.toLocaleString()})}</span>
                    ${(novel.tags || []).slice(0, 3).map(t => `<span class="pixiv-card-tag">#${_esc(t.replace(/^#/, ''))}</span>`).join(' ')}
                </div>
                <div class="pixiv-card-bottom">
                    <span class="pixiv-card-hearts">♡ ${novel.hearts || 0}</span>
                    <span style="font-size:11px;color:var(--text-secondary);">${timeAgo}</span>
                    <span class="pixiv-card-bookmark">${isFav ? '★' : '☆'}</span>
                </div>
            </div>
        </div>`;
    },

    // 时间显示辅助
    _timeAgo(ts) {
        if (!ts) return '';
        const diff = Date.now() - ts;
        const m = Math.floor(diff / 60000);
        if (m < 1) return I18n.t('pixiv.time_just_now', 'たった今');
        if (m < 60) return I18n.t('pixiv.time_mins_ago', {n: m});
        const h = Math.floor(m / 60);
        if (h < 24) return I18n.t('pixiv.time_hours_ago', {n: h});
        const d = Math.floor(h / 24);
        if (d < 30) return I18n.t('pixiv.time_days_ago', {n: d});
        return I18n.t('pixiv.time_months_ago', {n: Math.floor(d / 30)});
    },

    // ===== 打开小说 =====
    openNovel(novelId) {
        this.currentNovelId = novelId;
        const novel = (AppState.data.pixivData.novels || []).find(n => n.id === novelId);
        this.currentChapterIdx = (novel && novel.lastReadChapterIdx != null)
            ? Math.min(novel.lastReadChapterIdx, (novel.chapters || []).length - 1)
            : 0;
        // v2.76.0 Phase 4：记录最近阅读时间（供「浏览记录」页排序）
        if (novel) {
            novel.lastReadAt = Date.now();
            Utils.saveData();
        }
        Navigation.goTo('pixiv-reader');
        // 等 DOM 渲染后启用沉浸滚动
        setTimeout(() => this._setupImmersiveScroll(), 100);
    },

    // ===== 阅读器渲染 =====
    renderReader() {
        const data = AppState.data.pixivData;
        const novel = (data.novels || []).find(n => n.id === this.currentNovelId);
        if (!novel) { Navigation.goTo('pixiv-novel'); return; }

        const isFav = (data.favorites || []).includes(novel.id);

        // 标题
        document.getElementById('pixivReaderTitle').textContent = this.stripHtml(novel.title || 'Novel');

        // mini header: 作者头像
        this._updateReaderAuthorAvatar(novel);

        // 进入/切章/重渲时复原沉浸显示（防上次退出时卡在隐藏状态）
        this._setImmersive(false);

        // Phase 5：阅读器返回按钮接 closeReader（teardown 沉浸监听器、避免泄漏；
        // 覆盖 app.js 的全局 .back-btn → Navigation.back 绑定）
        const backBtn = document.querySelector('#pixivReaderHeader .back-btn');
        if (backBtn) backBtn.onclick = () => PixivNovel.closeReader();

        // 编辑按钮（仅用户创建的小说显示）

        // 编辑按钮（仅用户创建的小说显示）
        const editNovelBtn = document.getElementById('pixivEditNovelInfoBtn');
        const editChapterBtn = document.getElementById('pixivEditChapterContentBtn');
        if (novel.isUserCreated) {
            editNovelBtn.style.display = 'block';
            editChapterBtn.style.display = 'block';
        } else {
            editNovelBtn.style.display = 'none';
            editChapterBtn.style.display = 'none';
        }

        // 小说信息
        const totalWords = (novel.chapters || []).reduce((s, c) => s + (c.wordCount || 0), 0);
        const infoDiv = document.getElementById('pixivNovelInfo');

        const _esc = s => Utils.escapeHtml(s || '');
        const coverColor = this._hashColor(novel.title || '');
        const coverHtml = `<div class="pixiv-novel-cover" style="background:${coverColor}"><div class="pixiv-novel-cover-title">${_esc(novel.title || '')}</div></div>`;
        const synopsisRaw = novel.synopsis || novel.description || '';
        const synopsisExcerpt = synopsisRaw.slice(0, 140);
        const synopsisHasMore = synopsisRaw.length > 140;
        const synopsisHtml = synopsisRaw
            ? `<div class="pixiv-novel-synopsis">${_esc(synopsisExcerpt).replace(/\n/g, ' ')}${synopsisHasMore ? '…' : ''}${synopsisHasMore ? ` <button class="pixiv-synopsis-more" onclick="PixivNovel.showNovelDetail()">${I18n.t('pixiv.show_more', '显示更多')}</button>` : ''}</div>`
            : '';
        const authorLink = novel.author_npc_id
            ? `<a class="pixiv-novel-author-link" onclick="event.stopPropagation();Twitter.openFanProfile('${_esc(novel.author_npc_id)}')">${_esc(novel.author || I18n.t('pixiv.anonymous', '匿名'))}</a>`
            : _esc(novel.author || I18n.t('pixiv.anonymous', '匿名'));
        const originalTag = novel.isUserCreated
            ? ` <span style="color:var(--accent-color); font-size:0.8em;">(✓ ${I18n.t('pixiv.original_tag', '原创')})</span>`
            : '';
        const tagsHtml = `<div class="novel-tags">${(novel.tags || []).map(t => `<span class="pixiv-card-tag">#${_esc(t.replace(/^#/, ''))}</span>`).join('')}</div>`;

        if (novel.isSerial) {
            // 连载：Pixiv 风格 — 系列名 + 系列入口 + 当前章节标题
            const currentChapter = novel.chapters[this.currentChapterIdx] || {};
            const chapterNum = this.currentChapterIdx + 1;
            const chapterWords = (currentChapter.wordCount || 0).toLocaleString();
            infoDiv.innerHTML = `
                ${coverHtml}
                <div class="pixiv-novel-info-text">
                    <div class="pixiv-series-row">
                        <span class="pixiv-series-name">${_esc(novel.title)}</span>
                        <button class="pixiv-series-link" onclick="PixivNovel.showSeriesToc('${novel.id}')">${I18n.t('pixiv.series_entry', '系列 ›')}</button>
                    </div>
                    <div class="novel-title pixiv-chapter-main-title">#${chapterNum} ${_esc(currentChapter.title)}</div>
                    <div class="novel-author">by ${authorLink}${originalTag}</div>
                    <div class="novel-meta">
                        <span>♡ ${novel.hearts || 0}</span>
                        <span>${I18n.t('pixiv.word_count_format', {n: chapterWords})}</span>
                    </div>
                    ${tagsHtml}
                    ${synopsisHtml}
                </div>
            `;
        } else {
            // 短篇（Phase 2：加封面 + 系列入口占位 + 简介）
            infoDiv.innerHTML = `
                ${coverHtml}
                <div class="pixiv-novel-info-text">
                    <div class="pixiv-series-row">
                        <span class="pixiv-series-name">${_esc(novel.title)}</span>
                        <button class="pixiv-series-link" onclick="PixivNovel.showStandaloneToast()">${I18n.t('pixiv.series_entry', '系列 ›')}</button>
                    </div>
                    <div class="novel-title">${_esc(novel.title)}</div>
                    <div class="novel-author">by ${authorLink}${originalTag}</div>
                    <div class="novel-meta">
                        <span>♡ ${novel.hearts || 0}</span>
                        <span>${I18n.t('pixiv.word_count_format', {n: totalWords.toLocaleString()})}</span>
                    </div>
                    ${tagsHtml}
                    ${synopsisHtml}
                </div>
            `;
        }

        // 章节 tab 栏：改用 TOC Modal，始终隐藏
        document.getElementById('pixivChapterList').style.display = 'none';

        // 正文
        this.renderChapterContent(novel);

        // Phase 5：刷新浮动点赞 fab 状态
        this._updateReaderLikeFab();

        // 底部操作栏（始终显示）
        const actionBar = document.getElementById('pixivActionBar');
        if (actionBar) {
            actionBar.style.display = 'flex';
            actionBar.className = 'pixiv-reader-bar';

            const isFav = (data.favorites || []).includes(novel.id);

            actionBar.innerHTML = `
                <button class="pixiv-reader-btn" onclick="PixivNovel.toggleTextSettings()" aria-label="${I18n.t('pixiv.reader_font', '字体')}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M4 7V4h16v3M9 20h6M12 4v16" />
                    </svg>
                    <span>${I18n.t('pixiv.reader_font', '字体')}</span>
                </button>
                <button class="pixiv-reader-btn ${isFav ? 'active' : ''}" onclick="PixivNovel.toggleFavorite('${novel.id}')" aria-label="${I18n.t('pixiv.reader_bookmark', '收藏')}">
                    <svg viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                    <span>${I18n.t('pixiv.reader_bookmark', '收藏')}</span>
                </button>
                <button class="pixiv-reader-btn" onclick="${novel.isSerial ? `PixivNovel.showSeriesToc('${novel.id}')` : 'PixivNovel.showStandaloneToast()'}" aria-label="${I18n.t('pixiv.reader_toc', '目录')}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <line x1="4" y1="6" x2="20" y2="6" />
                        <line x1="4" y1="12" x2="20" y2="12" />
                        <line x1="4" y1="18" x2="20" y2="18" />
                    </svg>
                    <span>${I18n.t('pixiv.reader_toc', '目录')}</span>
                </button>
                <button class="pixiv-reader-btn" onclick="PixivNovel.toggleReaderMoreSheet()" aria-label="${I18n.t('pixiv.reader_more', '更多')}">
                    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <circle cx="5" cy="12" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="19" cy="12" r="2" />
                    </svg>
                    <span>${I18n.t('pixiv.reader_more', '更多')}</span>
                </button>
            `;
        }
    },

    closeReader() {
        this.closeReaderMoreSheet();
        this._teardownImmersiveScroll();
        Navigation.goTo('pixiv-novel');
    },

    // ===== Phase 5：更多 sheet（分享/TXT/长图/删除） =====
    toggleReaderMoreSheet() {
        const sheet = document.getElementById('pixivReaderMoreSheet');
        const backdrop = document.getElementById('pixivReaderMoreBackdrop');
        if (!sheet || !backdrop) return;
        if (sheet.classList.contains('open')) { this.closeReaderMoreSheet(); return; }

        const novel = (AppState.data.pixivData.novels || []).find(n => n.id === this.currentNovelId);
        if (!novel) return;
        const id = novel.id;
        const deleteLabel = (novel.isSerial && this.currentChapterIdx > 0)
            ? I18n.t('pixiv.reader_delete_chapter', '删本章')
            : I18n.t('pixiv.reader_delete', '删除');

        sheet.innerHTML = `
            <div class="pixiv-reader-more-grip"></div>
            <button class="pixiv-reader-more-item" onclick="PixivNovel.closeReaderMoreSheet();PixivNovel.shareToForum('${id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                <span>${I18n.t('pixiv.reader_share', '分享')}</span>
            </button>
            <button class="pixiv-reader-more-item" onclick="PixivNovel.closeReaderMoreSheet();PixivNovel.exportNovelText('${id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                <span>${I18n.t('pixiv.reader_txt', 'TXT')}</span>
            </button>
            <button class="pixiv-reader-more-item" onclick="PixivNovel.closeReaderMoreSheet();PixivNovel.exportNovelImage('${id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>${I18n.t('pixiv.reader_longimg', '长图')}</span>
            </button>
            <button class="pixiv-reader-more-item danger" onclick="PixivNovel.closeReaderMoreSheet();PixivNovel.deleteNovelOrChapter('${id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <span>${deleteLabel}</span>
            </button>
        `;
        backdrop.classList.add('open');
        sheet.classList.add('open');
    },

    closeReaderMoreSheet() {
        const sheet = document.getElementById('pixivReaderMoreSheet');
        const backdrop = document.getElementById('pixivReaderMoreBackdrop');
        if (sheet) sheet.classList.remove('open');
        if (backdrop) backdrop.classList.remove('open');
    },

    // ===== 作者头像数据解析（Phase 2 抽公共方法、mini header + detail modal 复用）=====
    _resolveAuthorAvatar(novel) {
        let avatarImage = null;
        let avatarColor = '#bbb';
        let letter = (novel.author || '匿').charAt(0).toUpperCase();

        if (novel.author_npc_id) {
            const fan = (AppState.data.twitterData?.fanFriends || [])
                .find(f => f.id === novel.author_npc_id);
            if (fan) {
                avatarColor = fan.avatarColor || avatarColor;
                letter = (fan.name || letter).charAt(0).toUpperCase();
            }
        } else if (novel.isUserCreated) {
            const t = AppState.data.twitterData;
            if (t) {
                avatarImage = t.userAvatarImage || null;
                avatarColor = t.userAvatarColor || '#1d9bf0';
                letter = (t.userAvatarLetter || (t.userName || 'M')).charAt(0).toUpperCase();
            }
        }
        return { avatarImage, avatarColor, letter };
    },

    // ===== mini header 作者头像（用 DOM 操作直接渲染、保留 Phase 1 行为）=====
    _updateReaderAuthorAvatar(novel) {
        const el = document.getElementById('pixivReaderAuthorAvatar');
        if (!el) return;
        const { avatarImage, avatarColor, letter } = this._resolveAuthorAvatar(novel);
        const _esc = s => Utils.escapeHtml(s || '');
        if (avatarImage) {
            el.innerHTML = `<img src="${_esc(avatarImage)}" alt="" onerror="this.parentNode.style.background='${_esc(avatarColor)}';this.parentNode.textContent='${_esc(letter)}'">`;
            el.style.background = '';
            el.style.color = '';
        } else {
            el.innerHTML = '';
            el.textContent = letter;
            el.style.background = avatarColor;
            el.style.color = '#fff';
        }
    },

    // ===== 作者头像 HTML（detail modal 用、不操作 DOM）=====
    _buildAuthorAvatarHtml(novel, sizeClass) {
        const { avatarImage, avatarColor, letter } = this._resolveAuthorAvatar(novel);
        const _esc = s => Utils.escapeHtml(s || '');
        const cls = `pixiv-reader-author-avatar ${sizeClass || ''}`.trim();
        if (avatarImage) {
            return `<div class="${cls}"><img src="${_esc(avatarImage)}" alt=""></div>`;
        }
        return `<div class="${cls}" style="background:${_esc(avatarColor)};color:#fff;">${_esc(letter)}</div>`;
    },

    // ===== 封面 hash 色（基于 title char code 求和、稳定）=====
    _hashColor(s) {
        let h = 0;
        for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
        const hue = Math.abs(h) % 360;
        return `hsl(${hue}, 35%, 55%)`;
    },

    // ===== 作品详情 modal（v2.74.3：当前章节详情、跟真 pixiv 一致每章一个简介）=====
    showNovelDetail() {
        const data = AppState.data.pixivData;
        const novel = (data.novels || []).find(n => n.id === this.currentNovelId);
        if (!novel) return;

        const _esc = s => Utils.escapeHtml(s || '');
        const isSerial = novel.isSerial;
        const currentChapter = isSerial && novel.chapters ? novel.chapters[this.currentChapterIdx] : null;

        // v2.74.3 改：日期/简介 都基于「当前章节」（短篇 fallback novel）
        const refDate = (currentChapter && currentChapter.createdAt) || novel.createdAt;
        const dateStr = refDate
            ? new Date(refDate).toLocaleDateString(I18n.currentLang === 'ja' ? 'ja-JP' : (I18n.currentLang === 'en' ? 'en-US' : 'zh-CN'), { year: 'numeric', month: '2-digit', day: '2-digit' })
            : '';
        const hearts = novel.hearts || 0;
        const reads = novel.reads || Math.round(hearts * 30);

        // v2.74.3 改：简介 = 当前章节摘要（长篇）/ novel.synopsis（短篇）
        const synopsisText = isSerial
            ? (currentChapter?.synopsis || '')
            : (novel.synopsis || novel.description || '');

        const titleStr = isSerial && currentChapter
            ? `${_esc(novel.title)}${this.currentChapterIdx > 0 || (novel.chapters || []).length > 1 ? ` ー${_esc(currentChapter.title || '')}ー` : ''}`
            : _esc(novel.title);

        const authorAvatarHtml = this._buildAuthorAvatarHtml(novel, 'pixiv-detail-author-avatar');
        // v2.181.0 関注作者接线：author_npc_id 为空时（玩家自建/无名册作者）不显示关注按钮
        const authorNpcId = novel.author_npc_id || '';
        const isAuthorFollowed = this._isAuthorFollowed(authorNpcId);
        const followBtnHtml = authorNpcId
            ? `<button class="pixiv-detail-follow-btn${isAuthorFollowed ? ' active' : ''}" onclick="PixivNovel.toggleAuthorFollow('${_esc(authorNpcId)}')">${isAuthorFollowed ? I18n.t('pixiv.detail_following_btn', 'フォロー中') : I18n.t('pixiv.detail_follow_btn', '+ 关注')}</button>`
            : '';

        const seriesRowHtml = isSerial
            ? `<div class="pixiv-detail-series-row"><span class="pixiv-detail-series-name">${_esc(novel.title)}</span><button class="pixiv-detail-series-chip" onclick="document.getElementById('pixivDetailModal').classList.remove('active');PixivNovel.showSeriesToc('${novel.id}');">${I18n.t('pixiv.series_list_chip', '系列列表 ›')}</button></div>`
            : '';

        const tagsHtml = (novel.tags || [])
            .map(t => `<span class="pixiv-card-tag">#${_esc(t.replace(/^#/, ''))}</span>`)
            .join('');

        // v2.74.3 新增：同系列其他章节缩略图网格（仅长篇）
        let siblingChaptersHtml = '';
        if (isSerial && (novel.chapters || []).length > 1) {
            const siblings = novel.chapters
                .map((ch, i) => ({ ch, i }))
                .filter(({ i }) => i !== this.currentChapterIdx)
                .sort((a, b) => b.i - a.i)
                .slice(0, 6);
            if (siblings.length > 0) {
                siblingChaptersHtml = `
                    <div class="pixiv-detail-author-row">
                        ${authorAvatarHtml}
                        <div class="pixiv-detail-author-info">
                            <div class="pixiv-detail-author-name">${_esc(novel.author || I18n.t('pixiv.anonymous', '匿名'))}</div>
                        </div>
                        ${followBtnHtml}
                    </div>
                    <div class="pixiv-detail-sibling-grid">
                        ${siblings.map(({ ch, i }) => `
                            <button class="pixiv-detail-sibling-card" onclick="document.getElementById('pixivDetailModal').classList.remove('active');PixivNovel.switchChapter(${i});">
                                <div class="pixiv-detail-sibling-cover" style="background:${this._hashColor(ch.title || ('#' + (i+1)))}">
                                    <div class="pixiv-detail-sibling-title">${_esc(novel.title)} ${i + 1}${ch.title ? '　ー' + _esc(ch.title) + 'ー' : ''}</div>
                                </div>
                            </button>
                        `).join('')}
                    </div>
                `;
            }
        }
        // 短篇 + 长篇无其他章节时仍显示作者卡（带关注按钮）
        const authorCardHtml = siblingChaptersHtml
            ? ''
            : `<div class="pixiv-detail-author-card">
                ${authorAvatarHtml}
                <div class="pixiv-detail-author-info">
                    <div class="pixiv-detail-author-name">${_esc(novel.author || I18n.t('pixiv.anonymous', '匿名'))}</div>
                </div>
                ${followBtnHtml}
            </div>`;

        document.getElementById('pixivDetailContent').innerHTML = `
            <div class="pixiv-detail-header">
                <button class="pixiv-detail-close" onclick="document.getElementById('pixivDetailModal').classList.remove('active')">✕</button>
                <span class="pixiv-detail-title-label">${I18n.t('pixiv.detail_modal_title', '作品详情')}</span>
            </div>
            <div class="pixiv-detail-body">
                <div class="pixiv-detail-meta">${dateStr ? dateStr + ' · ' : ''}${I18n.t('pixiv.reads_count', { n: reads.toLocaleString() })} · ♡ ${hearts}</div>
                ${seriesRowHtml}
                <h2 class="pixiv-detail-title">${titleStr}</h2>
                ${tagsHtml ? `<div class="pixiv-detail-tags">${tagsHtml}</div>` : ''}
                ${synopsisText ? `<div class="pixiv-detail-synopsis">${_esc(synopsisText).replace(/\n/g, '<br>')}</div>` : ''}
                ${authorCardHtml}
                ${siblingChaptersHtml}
                <button class="pixiv-detail-comment-row" onclick="PixivComments.jumpFromDetail()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <span>${I18n.t('pixiv.detail_comment_row', '评论')}</span>
                </button>
            </div>
        `;
        document.getElementById('pixivDetailModal').classList.add('active');
    },

    // ===== 关注作者接线（v2.181.0）：novel.author_npc_id 指向 Twitter/微博共享的粉丝NPC池，
    // 状态存在 AppState.data.twitterData.followedNpcIds（全局、跟 NPC id 走、不分模块）——
    // 直接复用 Twitter._toggleFollow 写同一份状态，Twitter 侧的粉丝主页会自动同步显示「フォロー中」。 =====
    _isAuthorFollowed(npcId) {
        if (!npcId) return false;
        return (AppState.data.twitterData?.followedNpcIds || []).includes(npcId);
    },
    toggleAuthorFollow(npcId) {
        if (!npcId || typeof Twitter === 'undefined' || typeof Twitter._toggleFollow !== 'function') return;
        Twitter._toggleFollow(npcId);
        this._refreshAuthorFollowUI();
    },
    // 关注态变了之后，把当前正打开的界面（详情modal/目录页/阅读器末尾卡）重渲一遍刷新按钮文字
    _refreshAuthorFollowUI() {
        if (document.getElementById('pixivDetailModal')?.classList.contains('active')) {
            this.showNovelDetail();
        }
        if (document.getElementById('pixivTocModal')?.classList.contains('active')) {
            this.showSeriesToc(this.currentNovelId);
        }
        const novel = (AppState.data.pixivData.novels || []).find(n => n.id === this.currentNovelId);
        if (novel && document.getElementById('pixivChapterBody')) {
            this.renderChapterContent(novel);
        }
    },
    showStandaloneToast() {
        Utils.showToast(I18n.t('pixiv.standalone_novel_toast', '这是单篇作品'));
    },

    // ===== 兼容 v2.74.0 占位入口（HTML onclick 仍调这个名字、Phase 2 起跳真 modal）=====
    showDetailPlaceholder() {
        this.showNovelDetail();
    },

    // ===== 沉浸式滚动 =====
    _immersiveLastScroll: 0,
    _immersiveHidden: false,
    _immersiveHandler: null,
    _immersiveClickHandler: null,

    _setupImmersiveScroll() {
        this._teardownImmersiveScroll(); // 防双绑

        const content = document.getElementById('pixivReaderContent');
        if (!content) return;

        this._immersiveLastScroll = 0;
        this._immersiveHidden = false;

        this._immersiveHandler = () => {
            const st = content.scrollTop;
            const delta = st - this._immersiveLastScroll;
            if (Math.abs(delta) < 5) { return; }
            if (delta > 0 && st > 50 && !this._immersiveHidden) {
                this._setImmersive(true);
            } else if (delta < 0 && this._immersiveHidden) {
                this._setImmersive(false);
            }
            this._immersiveLastScroll = st;
        };
        content.addEventListener('scroll', this._immersiveHandler, { passive: true });

        // 点击正文区切换显示
        this._immersiveClickHandler = (e) => {
            if (e.target.closest('button, a, details, summary, .pixiv-chapter-controls, .pixiv-chapter-nav, .pixiv-next-chapter-wrap, .pixiv-toc-item, input, textarea, select, .pixiv-series-row, .pixiv-novel-author-link')) return;
            this._setImmersive(!this._immersiveHidden);
        };
        content.addEventListener('click', this._immersiveClickHandler);
    },

    _setImmersive(hidden) {
        this._immersiveHidden = hidden;
        const header = document.getElementById('pixivReaderHeader');
        const bar = document.getElementById('pixivActionBar');
        const fab = document.getElementById('pixivReaderLikeFab');
        if (header) header.classList.toggle('immersive-hidden', hidden);
        if (bar) bar.classList.toggle('immersive-hidden', hidden);
        if (fab) fab.classList.toggle('immersive-hidden', hidden);
        if (hidden) this.closeReaderMoreSheet();
    },

    _teardownImmersiveScroll() {
        const content = document.getElementById('pixivReaderContent');
        if (content) {
            if (this._immersiveHandler) content.removeEventListener('scroll', this._immersiveHandler);
            if (this._immersiveClickHandler) content.removeEventListener('click', this._immersiveClickHandler);
        }
        this._setImmersive(false);
        this._immersiveHandler = null;
        this._immersiveClickHandler = null;
    },

    // ===== 系列目录 Modal（v2.75.0 Phase 3：参考真 pixiv 长篇章节列表页重做）=====
    showSeriesToc(novelId) {
        const data = AppState.data.pixivData;
        const novel = (data.novels || []).find(n => n.id === novelId);
        if (!novel) return;

        const _esc = s => Utils.escapeHtml(s || '');
        const chapters = novel.chapters || [];
        const totalWords = chapters.reduce((s, c) => s + (c.wordCount || 0), 0);
        // 500 字/分钟（中文阅读速度、跟真 pixiv 同字数估算时长对齐）
        const mins = Math.max(1, Math.ceil(totalWords / 500));
        const readingTime = mins >= 60
            ? I18n.t('pixiv.reading_time_hr_min', {h: Math.floor(mins / 60), m: mins % 60 ? I18n.t('pixiv.reading_time_min_fragment', {n: mins % 60}) : ''})
            : I18n.t('pixiv.reading_time_min', {n: mins});

        // 作者头部
        const authorAvatarHtml = this._buildAuthorAvatarHtml(novel, 'pixiv-toc-author-avatar');
        const authorName = _esc(novel.author || I18n.t('pixiv.anonymous', '匿名'));
        // v2.181.0 関注作者接线：author_npc_id 为空时（玩家自建/无名册作者）不显示关注按钮
        const authorNpcId = novel.author_npc_id || '';
        const isAuthorFollowed = this._isAuthorFollowed(authorNpcId);
        const authorFollowBtnHtml = authorNpcId
            ? `<button class="pixiv-toc-follow-author${isAuthorFollowed ? ' active' : ''}" onclick="PixivNovel.toggleAuthorFollow('${_esc(authorNpcId)}')">${isAuthorFollowed ? I18n.t('pixiv.detail_following_btn', 'フォロー中') : I18n.t('pixiv.detail_follow_btn', '加关注')}</button>`
            : '';

        // 简介（短/全文都不截断、CSS 控两行省略）
        const synopsisText = _esc(novel.synopsis || novel.description || '');

        // 追更状态
        const isFollowing = !!novel.isFollowing;
        const latestIdx = Math.max(0, chapters.length - 1);

        // tag chip（章节列表中各章共用 novel.tags）
        const tagChipsHtml = (novel.tags || [])
            .map(t => `<span class="pixiv-toc-item-tag">#${_esc(t.replace(/^#/, ''))}</span>`)
            .join('');

        const chaptersHtml = chapters.map((ch, i) => {
            const d = ch.createdAt ? new Date(ch.createdAt) : null;
            // YYYY-MM-DD HH:mm（跟真 pixiv 格式一致）
            const dateStr = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
            const isActive = i === this.currentChapterIdx;
            const isLiked = !!ch.isLiked;
            // 章 hearts 创建/迁移时按档C落盘（v2.190），likeBoost 为玩家点赞增量
            const chapterHearts = (ch.hearts || 0) + (ch.likeBoost || 0);
            const itemTitle = `${_esc(novel.title)} ${i + 1}${ch.title ? '　ー' + _esc(ch.title) + 'ー' : ''}`;
            const heartIcon = isLiked
                ? `<svg viewBox="0 0 24 24" fill="#e74c3c" stroke="none" style="width:22px;height:22px;"><path d="M12 21s-7-4.5-9.5-9C.8 8 3 4 7 4c2 0 3.5 1.2 5 3 1.5-1.8 3-3 5-3 4 0 6.2 4 4.5 8-2.5 4.5-9.5 9-9.5 9z"/></svg>`
                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:22px;height:22px;"><path d="M12 21s-7-4.5-9.5-9C.8 8 3 4 7 4c2 0 3.5 1.2 5 3 1.5-1.8 3-3 5-3 4 0 6.2 4 4.5 8-2.5 4.5-9.5 9-9.5 9z"/></svg>`;
            return `
                <div class="pixiv-toc-item${isActive ? ' active' : ''}">
                    <div class="pixiv-toc-item-main" onclick="PixivNovel.goToChapterFromToc(${i})">
                        <div class="pixiv-toc-item-title-row">
                            <span class="pixiv-toc-num">#${i + 1}</span>
                            <span class="pixiv-toc-item-title">${itemTitle}</span>
                        </div>
                        <div class="pixiv-toc-item-meta">
                            ${dateStr ? `<span>${dateStr}</span>` : ''}
                            <span>${I18n.t('pixiv.word_count_format', {n: (ch.wordCount || 0).toLocaleString()})}</span>
                            <span class="pixiv-toc-item-hearts">♥ ${chapterHearts}</span>
                        </div>
                        ${tagChipsHtml ? `<div class="pixiv-toc-item-tags">${tagChipsHtml}</div>` : ''}
                    </div>
                    <button class="pixiv-toc-item-like${isLiked ? ' liked' : ''}" onclick="event.stopPropagation();PixivNovel.toggleChapterLike('${novel.id}', ${i})" aria-label="${I18n.t('pixiv.toc_chapter_like', '点赞')}">${heartIcon}</button>
                </div>`;
        }).join('');

        document.getElementById('pixivTocContent').innerHTML = `
            <div class="pixiv-toc-author-bar">
                <button class="pixiv-toc-back" onclick="document.getElementById('pixivTocModal').classList.remove('active')" aria-label="${I18n.t('pixiv.btn_back', '返回')}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:22px;height:22px;"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                ${authorAvatarHtml}
                <span class="pixiv-toc-author-name">${authorName}</span>
                ${authorFollowBtnHtml}
                <button class="pixiv-toc-more" aria-label="${I18n.t('pixiv.toc_more', '更多')}">⋯</button>
            </div>
            <div class="pixiv-toc-series-section">
                <h2 class="pixiv-toc-series-title">${_esc(novel.title)}</h2>
                <div class="pixiv-toc-stats">${I18n.t('pixiv.toc_stats', {count: chapters.length, words: totalWords.toLocaleString(), time: readingTime})}</div>
                ${synopsisText ? `<div class="pixiv-toc-synopsis">${synopsisText.replace(/\n/g, '<br>')}</div>` : ''}
                <button class="pixiv-toc-cta-follow${isFollowing ? ' active' : ''}" onclick="PixivNovel.toggleNovelFollow('${novel.id}')">
                    ${isFollowing ? I18n.t('pixiv.toc_following', '已追更') : I18n.t('pixiv.toc_add_to_follow', '加入追更列表')}
                </button>
                ${chapters.length > 0 ? `<button class="pixiv-toc-cta-latest" onclick="PixivNovel.goToChapterFromToc(${latestIdx})">${I18n.t('pixiv.toc_read_latest', {n: chapters.length})}</button>` : ''}
            </div>
            <div class="pixiv-toc-list">${chaptersHtml}</div>
        `;
        document.getElementById('pixivTocModal').classList.add('active');
    },

    // ===== 每章独立点赞切换（v2.75.0 Phase 3）=====
    toggleChapterLike(novelId, chIdx) {
        const data = AppState.data.pixivData;
        const novel = (data.novels || []).find(n => n.id === novelId);
        if (!novel || !novel.chapters || !novel.chapters[chIdx]) return;
        const ch = novel.chapters[chIdx];
        ch.isLiked = !ch.isLiked;
        ch.likeBoost = (ch.likeBoost || 0) + (ch.isLiked ? 1 : -1);
        if (ch.likeBoost < 0) ch.likeBoost = 0;
        Utils.saveData();
        // 重新渲染章节列表（不关 modal）
        this.showSeriesToc(novelId);
    },

    // ===== Phase 5：阅读器浮动点赞（toggle 当前章节、不重渲 TOC、只刷 fab） =====
    toggleReaderLike() {
        const novel = (AppState.data.pixivData.novels || []).find(n => n.id === this.currentNovelId);
        if (!novel || !novel.chapters || !novel.chapters[this.currentChapterIdx]) return;
        const ch = novel.chapters[this.currentChapterIdx];
        ch.isLiked = !ch.isLiked;
        ch.likeBoost = (ch.likeBoost || 0) + (ch.isLiked ? 1 : -1);
        if (ch.likeBoost < 0) ch.likeBoost = 0;
        Utils.saveData();
        this._updateReaderLikeFab();
    },

    _updateReaderLikeFab() {
        const fab = document.getElementById('pixivReaderLikeFab');
        if (!fab) return;
        const novel = (AppState.data.pixivData.novels || []).find(n => n.id === this.currentNovelId);
        const ch = novel && novel.chapters ? novel.chapters[this.currentChapterIdx] : null;
        fab.classList.toggle('liked', !!(ch && ch.isLiked));
    },

    // ===== 系列追更切换（v2.75.0 Phase 3、占位 toast + 真状态切换）=====
    toggleNovelFollow(novelId) {
        const data = AppState.data.pixivData;
        const novel = (data.novels || []).find(n => n.id === novelId);
        if (!novel) return;
        novel.isFollowing = !novel.isFollowing;
        Utils.saveData();
        Utils.showToast(novel.isFollowing
            ? I18n.t('pixiv.toc_followed_toast', '已加入追更列表')
            : I18n.t('pixiv.toc_unfollowed_toast', '已取消追更'));
        // 重新渲染（更新按钮文字/状态）
        if (document.getElementById('pixivTocModal').classList.contains('active')) {
            this.showSeriesToc(novelId);
        }
    },

    goToChapterFromToc(idx) {
        document.getElementById('pixivTocModal').classList.remove('active');
        this.switchChapter(idx);
    },

    // ============================================================
    // v2.76.0 Phase 4：个人首页 + 子页（收藏/追更/浏览记录/设置）
    // ============================================================

    // ===== subScreen helper（参考 weibo._openSubScreen 同款模式）=====
    _openSubScreen(id, innerHtml) {
        const host = document.getElementById('pixiv-novel');
        if (!host) return null;
        const existed = document.getElementById(id);
        if (existed) existed.remove();
        const node = document.createElement('div');
        node.id = id;
        node.className = 'pixiv-sub-screen';
        node.innerHTML = innerHtml;
        host.appendChild(node);
        return node;
    },
    _closeSubScreen(id) {
        const n = document.getElementById(id);
        if (n) n.remove();
    },

    // v2.76.3: 把设置内容节点搬回 pixivPageUser（防止被 subScreen remove 连带删除、binding 丢失）
    _restoreSettingsContent() {
        const sc = document.getElementById('pixivSettingsContent');
        const up = document.getElementById('pixivPageUser');
        if (sc && up && !up.contains(sc)) {
            sc.style.display = 'none';
            up.appendChild(sc);
        }
    },

    // v2.76.3: 清理所有残留 subScreen（先搬回设置节点、再清子页）
    _cleanupSubScreens() {
        this._restoreSettingsContent();
        document.querySelectorAll('#pixiv-novel .pixiv-sub-screen').forEach(n => n.remove());
    },

    // ===== 个人首页 hero 渲染（每次切到 user 页时调用）=====
    renderProfileHome() {
        const t = AppState.data.twitterData || {};
        const userName = t.userName || 'Perigee 用户';
        const userAvatarImage = t.userAvatarImage || null;
        const userAvatarColor = t.userAvatarColor || '#9c8cf6';
        const userAvatarLetter = (t.userAvatarLetter || userName || 'P').charAt(0).toUpperCase();

        const avatarEl = document.getElementById('pixivProfileAvatar');
        const nameEl = document.getElementById('pixivProfileName');
        if (!avatarEl || !nameEl) return;
        const _esc = s => Utils.escapeHtml(s || '');
        if (userAvatarImage) {
            avatarEl.innerHTML = `<img src="${_esc(userAvatarImage)}" alt="">`;
            avatarEl.style.background = '';
        } else {
            avatarEl.innerHTML = '';
            avatarEl.textContent = userAvatarLetter;
            avatarEl.style.background = userAvatarColor;
        }
        nameEl.textContent = userName;
    },

    // ===== 通用：subScreen 标题栏 HTML =====
    _subScreenHeaderHtml(titleKey, fallback, closeFn) {
        const title = I18n.t(titleKey, fallback);
        return `<div class="pixiv-sub-header">
            <button class="pixiv-sub-back" onclick="${closeFn}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:22px;height:22px;"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <h2 class="pixiv-sub-title">${title}</h2>
        </div>`;
    },

    // ===== 收藏独立页 =====
    openFavoritesPage() {
        const data = AppState.data.pixivData;
        const favIds = data.favorites || [];
        const favNovels = (data.novels || []).filter(n => favIds.includes(n.id));
        const header = this._subScreenHeaderHtml('pixiv.profile_favorites', '收藏', "PixivNovel._closeSubScreen('pixivFavSubScreen')");
        const subTabs = `<div class="pixiv-sub-tab-row">
            <button class="pixiv-sub-tab" onclick="PixivNovel.showProfilePlaceholder('illust_tab')">${I18n.t('pixiv.sub_tab_illust', '插画·漫画')}</button>
            <button class="pixiv-sub-tab active">${I18n.t('pixiv.sub_tab_novel', '小说')}</button>
        </div>`;
        const listHtml = favNovels.length === 0
            ? `<div class="pixiv-sub-empty">${I18n.t('pixiv.empty_favorites', '尚无收藏')}</div>`
            : `<div class="pixiv-sub-list">${favNovels.map(n => this._renderProfileNovelRow(n)).join('')}</div>`;
        this._openSubScreen('pixivFavSubScreen', header + subTabs + listHtml);
    },

    // ===== 追更中独立页 =====
    openFollowingPage() {
        const data = AppState.data.pixivData;
        const followingNovels = (data.novels || []).filter(n => n.isFollowing);
        const header = this._subScreenHeaderHtml('pixiv.profile_following', '追更中', "PixivNovel._closeSubScreen('pixivFollowingSubScreen')");
        const listHtml = followingNovels.length === 0
            ? `<div class="pixiv-sub-empty">${I18n.t('pixiv.empty_following', '尚未追更任何系列')}</div>`
            : `<div class="pixiv-sub-list">${followingNovels.map(n => this._renderProfileNovelRow(n)).join('')}</div>`;
        this._openSubScreen('pixivFollowingSubScreen', header + listHtml);
    },

    // ===== 浏览记录独立页 =====
    openRecentReadsPage() {
        const data = AppState.data.pixivData;
        const recentNovels = (data.novels || [])
            .filter(n => n.lastReadAt)
            .sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0));
        const header = this._subScreenHeaderHtml('pixiv.profile_history', '浏览记录', "PixivNovel._closeSubScreen('pixivHistorySubScreen')");
        const listHtml = recentNovels.length === 0
            ? `<div class="pixiv-sub-empty">${I18n.t('pixiv.empty_history', '尚无浏览记录')}</div>`
            : `<div class="pixiv-sub-list">${recentNovels.map(n => this._renderProfileNovelRow(n)).join('')}</div>`;
        this._openSubScreen('pixivHistorySubScreen', header + listHtml);
    },

    // ===== 设置二级页（把 pixivSettingsContent 整块移过去、关闭时移回）=====
    openSettingsPage() {
        // v2.76.3 防御：先确保 settingsContent 在原位（防止重复打开时被 _openSubScreen 的 remove 连带删除）
        this._restoreSettingsContent();
        const header = this._subScreenHeaderHtml('pixiv.profile_settings', '设置', 'PixivNovel.closeSettingsPage()');
        const node = this._openSubScreen('pixivSettingsSubScreen', header + '<div id="pixivSettingsSubBody"></div>');
        if (!node) return;
        const body = node.querySelector('#pixivSettingsSubBody');
        const settingsContent = document.getElementById('pixivSettingsContent');
        if (body && settingsContent) {
            settingsContent.style.display = '';
            body.appendChild(settingsContent);
        }
        // settingsContent 内 data-i18n 在页面 init 时已翻译（textContent 已是译文）、搬运不改变、无需重翻
    },
    closeSettingsPage() {
        this._restoreSettingsContent();
        this._closeSubScreen('pixivSettingsSubScreen');
    },

    // ===== 「作品管理」row → subScreen 列用户手动投稿的作品（v2.76.2）=====
    openMyWorks() {
        const data = AppState.data.pixivData;
        const myNovels = (data.novels || []).filter(n => n.isUserCreated);
        const header = this._subScreenHeaderHtml('pixiv.profile_my_works', '作品管理', "PixivNovel._closeSubScreen('pixivMyWorksSubScreen')");
        const listHtml = myNovels.length === 0
            ? `<div class="pixiv-sub-empty">${I18n.t('pixiv.empty_my_works', '还没有投稿作品，点个人首页「投稿作品」开始创作')}</div>`
            : `<div class="pixiv-sub-list">${myNovels.map(n => this._renderProfileNovelRow(n)).join('')}</div>`;
        this._openSubScreen('pixivMyWorksSubScreen', header + listHtml);
    },

    // ===== 占位 toast =====
    showProfilePlaceholder(type) {
        const map = {
            bookmark: I18n.t('pixiv.placeholder_bookmark', '书签功能即将上线'),
            follow: I18n.t('pixiv.placeholder_follow', '关注功能即将上线'),
            follower: I18n.t('pixiv.placeholder_follower', '粉丝功能即将上线'),
            p_friend: I18n.t('pixiv.placeholder_p_friend', '好P友功能即将上线'),
            block: I18n.t('pixiv.placeholder_block', '屏蔽设定即将上线'),
            help: I18n.t('pixiv.placeholder_help', '帮助与反馈即将上线'),
            about: I18n.t('pixiv.placeholder_about', 'Perigee OS — Pixiv 仿真模块'),
            illust_tab: I18n.t('pixiv.placeholder_illust_tab', '插画·漫画功能即将上线')
        };
        Utils.showToast(map[type] || I18n.t('pixiv.placeholder_generic', '功能即将上线'));
    },

    // ===== 子页通用：novel row 渲染（参考真 pixiv 收藏页样式）=====
    _renderProfileNovelRow(novel) {
        const _esc = s => Utils.escapeHtml(s || '');
        const coverColor = this._hashColor(novel.title || '');
        const wordCount = (novel.chapters || []).reduce((s, c) => s + (c.wordCount || 0), 0)
            || (novel.content ? novel.content.length : 0);
        const wordsStr = wordCount > 0 ? I18n.t('pixiv.word_count_format', {n: wordCount.toLocaleString()}) : '';
        const author = _esc(novel.author || I18n.t('pixiv.anonymous', '匿名'));
        const tags = (novel.tags || []).slice(0, 4)
            .map(t => `<span class="pixiv-sub-novel-tag">#${_esc(t.replace(/^#/, ''))}</span>`).join(' ');
        const hearts = novel.hearts || 0;
        const isFav = (AppState.data.pixivData.favorites || []).includes(novel.id);
        return `<button class="pixiv-sub-novel-row" onclick="PixivNovel.openNovel('${novel.id}')">
            <div class="pixiv-sub-novel-cover" style="background:${coverColor}"></div>
            <div class="pixiv-sub-novel-main">
                <div class="pixiv-sub-novel-title">${_esc(novel.title)}</div>
                <div class="pixiv-sub-novel-by">by ${author}</div>
                <div class="pixiv-sub-novel-meta">
                    ${wordsStr ? `<span>${wordsStr}</span>` : ''}
                    ${tags ? `<span class="pixiv-sub-novel-tags">${tags}</span>` : ''}
                </div>
                ${hearts > 0 ? `<div class="pixiv-sub-novel-hearts">♥ ${hearts}</div>` : ''}
            </div>
            <span class="pixiv-sub-novel-favicon${isFav ? ' active' : ''}">
                <svg viewBox="0 0 24 24" fill="${isFav ? '#e74c3c' : 'none'}" stroke="${isFav ? 'none' : 'currentColor'}" stroke-width="2" style="width:22px;height:22px;"><path d="M12 21s-7-4.5-9.5-9C.8 8 3 4 7 4c2 0 3.5 1.2 5 3 1.5-1.8 3-3 5-3 4 0 6.2 4 4.5 8-2.5 4.5-9.5 9-9.5 9z"/></svg>
            </span>
        </button>`;
    },

    switchChapter(idx) {
        this.currentChapterIdx = idx;
        // 保存阅读进度
        const novel = (AppState.data.pixivData.novels || []).find(n => n.id === this.currentNovelId);
        if (novel) {
            novel.lastReadChapterIdx = idx;
            Utils.saveData();
        }
        // renderReader() 会同时更新 infoDiv（连载标题 #N）和正文
        this.renderReader();
        // 切章后滚到顶部
        const readerContent = document.getElementById('pixivReaderContent');
        if (readerContent) readerContent.scrollTop = 0;
        const readerPage = document.querySelector('.page[data-page="pixiv-reader"]');
        if (readerPage) readerPage.scrollTop = 0;
        // 切章后复原沉浸状态（防止卡在隐藏）
        this._setImmersive(false);
        this._immersiveLastScroll = 0;
    },

    renderChapterContent(novel) {
        if (!novel.chapters || novel.chapters.length === 0) {
            // メロンから作成された小説で章がまだない場合
            // v2.74.1: 写 chapterBody（不动 pixivReaderContent 滚动容器自身、保留 infoDiv 兄弟节点）
            const content = document.getElementById('pixivChapterBody');
            if (content) {
                const _esc = s => Utils.escapeHtml(s || '');
                const synopsisText = novel.synopsis ? `<div class="melon-sample-text" style="margin-bottom:16px;padding:12px;background:var(--bg-secondary);border-radius:8px;font-size:13px;color:var(--text-secondary);line-height:1.6;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1em;height:1em;vertical-align:-0.15em;margin-right:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>${I18n.t('pixiv.synopsis_label', 'あらすじ')}：${_esc(novel.synopsis).replace(/\n/g, '<br>')}</div>` : '';
                content.innerHTML = `
                    <div style="text-align:center;padding:40px 20px;">
                        ${synopsisText}
                        <div style="color:var(--text-secondary);margin-bottom:16px;">${I18n.t('pixiv.no_chapters_yet', 'まだ章がありません。最初の章を生成しましょう。')}</div>
                        <button class="glass-btn pixiv-next-chapter-btn" onclick="PixivNovel.showChapterModal('${novel.id}', 'next')">${I18n.t('pixiv.generate_first_chapter', '✦ 第1話を生成')}</button>
                    </div>`;
            }
            return;
        }
        if (this.currentChapterIdx >= novel.chapters.length) this.currentChapterIdx = 0;
        const chapter = novel.chapters[this.currentChapterIdx];
        if (!chapter) return;

        // ⚠️ 保留独立实现，勿收编 Utils.escapeHtml（那边会把 ' 转成 &#39;）：
        // 下方 _sanitizeDetailsBlock 的还原正则用 [^&] 匹配已转义标签内容，
        // 多转义 ' 产生的 &#39; 会让带单引号属性的白名单标签不再还原
        const _esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        // <details> 译文折叠块白名单清洗：LLM 正文属不可信输入，格式漂移/幻觉可能在块内夹带 img/onerror 等标签。
        // 先整体转义（起点变成纯文本），再只把 details/summary/span/br 这四个折叠机制自用的标签换回真实标签——
        // 未列入白名单的标签、以及白名单标签上的任何属性（除 details 自带的 class="tl" 折叠样式钩子）一律保持转义原样显示。
        const _sanitizeDetailsBlock = html => {
            const ALLOWED_TAGS = new Set(['details', 'summary', 'span', 'br']);
            return _esc(html).replace(/&lt;(\/?)([a-zA-Z][a-zA-Z0-9]*)([^&]*)&gt;/g, (full, slash, name, attrs) => {
                const tag = name.toLowerCase();
                if (!ALLOWED_TAGS.has(tag)) return full; // 非白名单标签：保持转义文本，不被解析成 HTML
                if (slash) return `</${tag}>`;
                if (tag === 'details') return /class\s*=\s*['"]?tl['"]?/i.test(attrs) ? `<details class="tl">` : `<details>`;
                return `<${tag}>`;
            });
        };
        // v2.74.1: 写 chapterBody（不动 pixivReaderContent 滚动容器自身、保留 infoDiv 兄弟节点）
        const content = document.getElementById('pixivChapterBody');
        const text = chapter.content || '';

        // 把 <details> 块内的实际换行符转成字面 \n（防 AI 多行输出把 split 拆碎，同时保留译文段落分隔）
        const normalized = text.replace(/<details[\s\S]*?<\/details>/gi,
            m => m.replace(/\n/g, '\\n'));
        // 将字面 \n（AI 用于分隔译文段落）转为 <br>
        const displayText = normalized.replace(/\\n/g, '<br>');
        const paragraphs = displayText.split(/\n\n|\n/).filter(p => p.trim());
        const isLastChapter = novel.isSerial && this.currentChapterIdx === novel.chapters.length - 1;
        const isCompleted = novel.completed;
        const isSerialAI = novel.isSerial && !novel.isUserCreated;
        // v2.74.2 Phase 2: 章节 AI 摘要从阅读器正文移除（chapter.synopsis 数据字段保留、AI 续章仍读）
        // 用户可通过顶部 📄 文档 icon 在「作品详情」modal 内查看各章摘要
        // 完結後メロン書籍化ボタン（書籍化済みなら頒布ページへ誘導・重複生成を防ぐ）
        const bookedProduct = (isCompleted && novel.isSerial && novel.melonbooksProductId)
            ? ((AppState.data.melonbooksData && AppState.data.melonbooksData.products) || []).find(p => p.id === novel.melonbooksProductId)
            : null;
        const melonBtn = (isCompleted && novel.isSerial)
            ? `<button class="glass-btn" onclick="PixivNovel.publishToMelonbooks('${novel.id}')" style="background:#e8530e;color:#fff;">${bookedProduct ? I18n.t('pixiv.btn_view_melon', 'メロンの頒布ページへ') : I18n.t('pixiv.btn_publish_melon', 'メロンで書籍化')}</button>`
            : '';
        // 完結ボタン（連載の最終話 & 未完結時のみ）
        const completeBtn = (isLastChapter && !isCompleted && novel.isSerial && novel.chapters.length >= 2)
            ? `<button class="glass-btn" onclick="PixivNovel.completeNovel('${novel.id}')" style="border-color:var(--success-color);color:var(--success-color);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1em;height:1em;vertical-align:-0.15em;margin-right:4px;"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>${I18n.t('pixiv.btn_complete', '完結する')}</button>`
            : '';
        // 完結取り消しボタン（誤操作からの復帰用・完結済みの連載で表示）
        const reopenBtn = (isCompleted && novel.isSerial)
            ? `<button class="glass-btn" onclick="PixivNovel.uncompleteNovel('${novel.id}')" style="border-color:var(--accent-color);color:var(--accent-color);">${I18n.t('pixiv.btn_reopen_serial', '↺ 連載を再開')}</button>`
            : '';
        // v2.75.0 Phase 3：续きを生成 按钮已挪进「下一话」卡内（chapterEndCard）
        // 保留 重写 / 完结 / 重启 / 出版 等管理按钮
        const chapterControls = isSerialAI
            ? `<div class="pixiv-chapter-controls">
                ${!isCompleted ? `<button class="glass-btn" onclick="PixivNovel.showChapterModal('${novel.id}', 'reroll', ${this.currentChapterIdx})">${I18n.t('pixiv.btn_rewrite', '↺ 書き直す')}</button>` : ''}
                ${completeBtn}
                ${reopenBtn}
                ${melonBtn}
               </div>`
            : ((isLastChapter || isCompleted) && (completeBtn || reopenBtn || melonBtn)
                ? `<div class="pixiv-next-chapter-wrap">
                    ${completeBtn}
                    ${reopenBtn}
                    ${melonBtn}
                   </div>`
                : '');

        // v2.75.0 Phase 3：章节末「下一话」卡（替换原 chapterNav 横向 prev/next）
        const hasNext = novel.isSerial && this.currentChapterIdx < novel.chapters.length - 1;
        const nextCh = hasNext ? novel.chapters[this.currentChapterIdx + 1] : null;
        const isFollowing = !!novel.isFollowing;
        let chapterEndCard = '';
        if (novel.isSerial) {
            let nextActionHtml = '';
            if (hasNext) {
                const nextNum = this.currentChapterIdx + 2;
                const nextTitle = `${_esc(novel.title)} ${nextNum}${nextCh.title ? '　ー' + _esc(nextCh.title) + 'ー' : ''}`;
                nextActionHtml = `<button class="pixiv-end-next-pill" onclick="PixivNovel.switchChapter(${this.currentChapterIdx + 1})"><span class="pixiv-end-next-prefix">${I18n.t('pixiv.end_next_chapter_label', '下一话')}</span> <span class="pixiv-end-next-title">#${nextNum}　${nextTitle}</span></button>`;
            } else if (isLastChapter && !isCompleted) {
                // 末章未完结 → 続きを生成 入口（替代原 chapterControls 中重复的「続きを生成」）
                nextActionHtml = `<button class="pixiv-end-next-pill pixiv-end-next-generate" id="pixivNextChapterBtn" onclick="PixivNovel.showChapterModal('${novel.id}', 'next')">${I18n.t('pixiv.btn_generate_next', '✦ 続きを生成')}</button>`;
            }
            chapterEndCard = `<div class="pixiv-end-card">
                <div class="pixiv-end-series-label">${I18n.t('pixiv.end_series_label', '系列')}</div>
                <div class="pixiv-end-series-name">${_esc(novel.title)}</div>
                ${nextActionHtml}
                <button class="pixiv-end-follow-btn${isFollowing ? ' active' : ''}" onclick="PixivNovel.toggleNovelFollow('${novel.id}')">${isFollowing ? I18n.t('pixiv.toc_following', '已追更') : I18n.t('pixiv.toc_add_to_follow', '加入追更列表')}</button>
            </div>`;
        }

        // v2.75.0 Phase 3：作者卡 + 同系列缩略图横排（仅 serial 且 >= 2 章）
        let siblingsCard = '';
        if (novel.isSerial && (novel.chapters || []).length >= 2) {
            const siblingIdxs = [];
            for (let i = 0; i < novel.chapters.length; i++) {
                if (i !== this.currentChapterIdx) siblingIdxs.push(i);
            }
            // 优先显示「下一话之外」的章节、最多 3 张
            const visible = siblingIdxs.slice(0, 3);
            const siblingsThumbs = visible.map(i => {
                const ch = novel.chapters[i];
                return `<button class="pixiv-end-sibling-card" onclick="PixivNovel.switchChapter(${i})">
                    <div class="pixiv-end-sibling-cover" style="background:${this._hashColor(ch.title || ('#' + (i+1)))}">
                        <div class="pixiv-end-sibling-title">${_esc(novel.title)} ${i + 1}${ch.title ? '　ー' + _esc(ch.title) + 'ー' : ''}</div>
                    </div>
                </button>`;
            }).join('');
            const endAuthorAvatarHtml = this._buildAuthorAvatarHtml(novel, 'pixiv-end-author-avatar');
            const endAuthorName = _esc(novel.author || I18n.t('pixiv.anonymous', '匿名'));
            // v2.181.0 関注作者接线：author_npc_id 为空时（玩家自建/无名册作者）不显示关注按钮/个人资料入口
            const authorNpcId = novel.author_npc_id || '';
            const isAuthorFollowed = this._isAuthorFollowed(authorNpcId);
            const endFollowBtnHtml = authorNpcId
                ? `<button class="pixiv-end-author-follow${isAuthorFollowed ? ' active' : ''}" onclick="PixivNovel.toggleAuthorFollow('${_esc(authorNpcId)}')">${isAuthorFollowed ? I18n.t('pixiv.detail_following_btn', 'フォロー中') : I18n.t('pixiv.detail_follow_btn', '加关注')}</button>`
                : '';
            const endProfileLinkHtml = authorNpcId
                ? `<button class="pixiv-end-profile-link" onclick="Twitter.openFanProfile('${_esc(authorNpcId)}')">${I18n.t('pixiv.end_view_profile', '查看个人资料')}</button>`
                : '';
            siblingsCard = `<div class="pixiv-end-author-card">
                <div class="pixiv-end-author-row">
                    ${endAuthorAvatarHtml}
                    <span class="pixiv-end-author-name">${endAuthorName}</span>
                    ${endFollowBtnHtml}
                </div>
                <div class="pixiv-end-sibling-grid">${siblingsThumbs}</div>
                ${endProfileLinkHtml}
            </div>`;
        }

        // v2.207.0 章节评论区（逻辑全部在 pixiv-comments.js、这里只拼挂点）
        const commentsSection = (typeof PixivComments !== 'undefined')
            ? PixivComments.buildSectionHtml(novel, this.currentChapterIdx)
            : '';

        // 标题已在 infoDiv 显示（短篇=novel.title，连载=#N chapterTitle），正文区域不重复
        content.innerHTML = `
            <div class="pixiv-chapter-text">
                ${paragraphs.map(p => {
            if (p.trimStart().startsWith('<details')) return `<p>${_sanitizeDetailsBlock(p)}</p>`;
            // 先按 <br> 拆段，分别转义文本，再拼回 <br>（保留段内换行）
            return `<p>${p.split('<br>').map(seg => _esc(seg)).join('<br>')}</p>`;
        }).join('')}
            </div>
            ${chapterEndCard}
            ${siblingsCard}
            ${chapterControls}
            ${commentsSection}
        `;
        if (typeof PixivComments !== 'undefined') PixivComments.onSectionRendered(novel.id, this.currentChapterIdx);
    },

    // ===== 显示章节弹窗（续章 / 重写）=====
    showChapterModal(novelId, mode, chapterIdx) {
        const data = AppState.data.pixivData;
        const novel = (data.novels || []).find(n => n.id === novelId);
        if (!novel) return;
        this._pendingChapterAction = { type: mode, novelId, chapterIdx };
        const targetNum = mode === 'next' ? novel.chapters.length + 1 : (chapterIdx + 1);
        const titleEl = document.getElementById('pixivNextChapterModalTitle');
        if (titleEl) titleEl.textContent = mode === 'next'
            ? I18n.t('pixiv.next_ch_title_next', {n: targetNum})
            : I18n.t('pixiv.next_ch_title_reroll', {n: targetNum});
        const descEl = document.getElementById('pixivNextChapterModalDesc');
        if (descEl) descEl.textContent = mode === 'next'
            ? I18n.t('pixiv.next_ch_desc_next', '续章将自动参考：世界书 · 原作时间线 · 所有已有章节摘要')
            : I18n.t('pixiv.next_ch_desc_reroll', '将用AI重新生成本章内容。前面各章摘要将作为上下文。');
        const hintEl = document.getElementById('pixivNextChapterHint');
        if (hintEl) hintEl.value = '';
        document.getElementById('pixivNextChapterModal').classList.add('active');
    },

    // ===== 兼容旧调用 =====
    showNextChapterModal(novelId) { this.showChapterModal(novelId, 'next'); },

    // ===== 确认执行章节生成/重写 =====
    confirmChapterAction() {
        const hint = (document.getElementById('pixivNextChapterHint')?.value || '').trim();
        document.getElementById('pixivNextChapterModal').classList.remove('active');
        const action = this._pendingChapterAction;
        if (!action) return;
        this._pendingChapterAction = null;
        this.generateNextSerialChapter(action.novelId, hint, action.type === 'reroll' ? action.chapterIdx : null);
    },

    // ===== 兼容旧调用 =====
    confirmGenerateNextChapter() { this.confirmChapterAction(); },

    // ===== AI 生成连载下一章节 =====
    async generateNextSerialChapter(novelId, userHint, rerollIdx) {
        const data = AppState.data.pixivData;
        const novel = (data.novels || []).find(n => n.id === novelId);
        if (!novel || !novel.isSerial) return;
        if (this._isGeneratingChapter) return;  // 并发锁：生成中直接忽略重复触发
        this._isGeneratingChapter = true;

        const btn = document.getElementById('pixivNextChapterBtn');
        if (btn) { btn.textContent = I18n.t('pixiv.btn_generating', '...生成中...'); btn.disabled = true; }

        try {
            const settings = data.settings;
            const cpInfo = Broadcast.getCP();
            const cp = cpInfo.cp;
            const cpNickname = cpInfo.cpNickname;
            const hasCP = cpInfo.hasCP;
            const worldContext = this.getNovelContext();
            const langInstruction = this.getLanguageInstruction();

            // 视角指令（复用已保存的设置）
            const perspective = settings.perspective || 'third';
            const focusChar = settings.focusChar || '';
            let perspectiveInstruction = '';
            if (perspective === 'third') {
                perspectiveInstruction = `⚠️ ABSOLUTE PERSPECTIVE RULE — THIRD PERSON ONLY:
You MUST write EXCLUSIVELY in the **Third-Person Perspective** (三人称). This is a hard requirement with NO exceptions.
STRICTLY PROHIBITED: Using first-person pronouns (I / me / my / 私 / 俺 / 僕 / あたし / 僕は / 俺は, etc.) as the narrative voice.
Internal monologues MUST be enclosed in full-width parentheses （）.`;
                if (focusChar) {
                    perspectiveInstruction += `\nFocus Character: Use Third-Person Limited strictly from 【${focusChar}】's perspective.`;
                }
            } else if (perspective === 'first') {
                perspectiveInstruction = `You MUST write in the **First-Person Perspective**.`;
            } else if (perspective === 'second') {
                perspectiveInstruction = `You MUST write in the **Second-Person Perspective**, using "you" as the main character.`;
            }

            // ── rerollIdx: null = 续写新章，number = 重写该索引的章节 ──
            const isReroll = rerollIdx !== null && rerollIdx !== undefined;
            // 目标章节编号（续写=新章，重写=替换该章）
            const chapterNum = isReroll ? rerollIdx + 1 : novel.chapters.length + 1;
            // 参考范围：取目标章节之前的所有章节摘要
            const contextChapters = isReroll ? novel.chapters.slice(0, rerollIdx) : novel.chapters;

            // ── 章节记忆：最近 5 章喂全文，更早的喂摘要（滑动窗口记忆策略）──
            // 只喂摘要时 AI 看不到上一章实际怎么收尾，新章开头容易与上一章结尾重复。
            const FULL_TEXT_WINDOW = 5;
            const fullTextFromIdx = Math.max(0, contextChapters.length - FULL_TEXT_WINDOW);
            const chapterSynopses = contextChapters.map((ch, i) => {
                const hintNote = ch.userHint
                    ? `\n[Note: This chapter's author direction was: "${ch.userHint}". This was for THIS chapter only — do NOT carry it forward.]`
                    : '';
                if (i >= fullTextFromIdx) {
                    // 最近章节：喂纯日语全文（剥掉中文翻译块），让 AI 精确衔接、不重述开头结尾
                    const fullText = this._chapterPlainText(ch.content) || '（本章正文为空）';
                    return `【Ch.${i + 1}「${ch.title || ''}」— 全文 FULL TEXT】\n${fullText}${hintNote}`;
                }
                // 较早章节：喂摘要节省篇幅
                const synopsis = ch.synopsis
                    ? ch.synopsis.trim()
                    : this._chapterPlainText(ch.content).replace(/\s+/g, ' ').slice(0, 200) + '…';
                return `【Ch.${i + 1}「${ch.title || ''}」— 摘要 SYNOPSIS】\n${synopsis}${hintNote}`;
            }).join('\n\n');

            // 使用小说保存的文风ID（保持同一作者风格），找不到再随机
            let selectedStyle = null;
            if (novel.writingStyleId) {
                selectedStyle = (settings.writingStyles || []).find(s => s.id === novel.writingStyleId);
            }
            if (!selectedStyle) {
                selectedStyle = this.getRandomWritingStyle();
                if (selectedStyle) novel.writingStyleId = selectedStyle.id;
            }
            const styleInstruction = selectedStyle ? `\n[Writing Style Requirements]\n${selectedStyle.rules}\n` : '';
            const recentAnglesHint = this._getRecentAnglesPrompt();

            const userHintBlock = userHint
                ? `\n[⚠️ HIGHEST PRIORITY — Author's Direction for THIS Chapter ONLY]\n${userHint}\n↑ Follow this directive. Do NOT continue or assume the thematic direction of previous chapters — each chapter's author direction applies only to that chapter.\n`
                : `\n[Chapter Thematic Independence]\nNo specific direction was given for this chapter. Do NOT assume that previous chapters' themes or directions should continue. Explore a fresh angle that naturally follows the plot.\n`;

            let positionNote;
            if (isReroll && chapterNum === 1) {
                positionNote = `You are REWRITING Chapter 1 — the opening chapter. Establish the premise, introduce characters, and set the story in motion.`;
            } else if (isReroll) {
                positionNote = `You are REWRITING Chapter ${chapterNum}. The chapters before it are already finalized (their full text is provided below). Make this chapter fit naturally after Chapter ${chapterNum - 1}, and do NOT duplicate how Chapter ${chapterNum - 1} ended.`;
            } else if (chapterNum === 1) {
                positionNote = `You are writing Chapter 1 — the opening chapter. Establish the premise, introduce characters, and set the story in motion.`;
            } else {
                positionNote = `You are writing the NEW Chapter ${chapterNum}. The full text of the preceding chapters is provided below — Chapter ${chapterNum - 1} is where the story currently stands. Open Chapter ${chapterNum} with a FRESH beat that picks up AFTER that ending. Do NOT rewrite, recap, or restate how Chapter ${chapterNum - 1} concluded — the reader has just read it.`;
            }

            const systemPrompt = `You are a top-tier fanfiction author working on a long-running serial novel.

[SAFETY & LITERARY CONTEXT]
This is fictional action/battle/romance ACG literature for a general audience. Dramatic tension and injuries are standard literary devices for character growth. Keep all content age-appropriate (SFW): portray romance through emotional connection only, and fade to black before any explicit or sexual content.

CRITICAL CONTINUITY RULES (non-negotiable):
1. **${isReroll ? 'Rewrite Fit' : 'Seamless Continuation'}**: ${positionNote}
2. **No Fast-Forwarding**: Develop scenes at a natural pace. Do NOT jump ahead, resolve unearned tensions, or skip character development.
3. **No Repetition**: Do NOT re-tread events, dialogue, or emotional beats already covered in the prior chapters below. In particular, do NOT restate or re-narrate the ending scene of the previous chapter.
4. **Character Authenticity**: Strictly adhere to World Book character profiles. OOC behavior is absolutely forbidden.
5. **Canon Respect**: Do NOT contradict any events in the official Story Timeline.
6. **Chapter Independence**: The prior chapters below record *what happened* (facts), NOT thematic mandates. Each chapter's "author direction" note applies ONLY to that chapter. Do NOT assume a previous chapter's theme, tone, or premise should carry into subsequent chapters unless the plot itself demands it.

[World Context — Canon Setting, Timeline & Characters]
${worldContext}
${styleInstruction}
${langInstruction}
${recentAnglesHint}
${userHintBlock}
${novel.synopsis ? `[Original Synopsis — from Melonbooks doujinshi]\n${novel.synopsis}\n↑ Use this as the story's backbone/outline. Develop chapters that follow this premise.\n` : ''}
[The Story So Far — Prior Chapters]
(The most recent ${FULL_TEXT_WINDOW} chapters are provided as FULL TEXT — read their actual opening and ending so you can continue seamlessly without repeating them. Earlier chapters are provided as SYNOPSIS, a factual record of what happened.)
${chapterSynopses || '（This is Chapter 1 — no prior chapters.）'}

[Perspective]
${perspectiveInstruction}

[Chapter Requirements]
- Serial: "${this.stripHtml(novel.title)}"${hasCP ? ` — ${cp}${cpNickname ? ` (${cpNickname})` : ''}` : ''}
- Writing Chapter ${chapterNum}${isReroll ? ' (rewrite)' : ''}.
- Pace: neither rushed nor stalling — one coherent scene or short scene-pair.
- Target length: 1500–3000 words.
- ${isReroll ? 'End in a way that logically bridges to subsequent chapters.' : 'Pause the chapter at its highest tension point — let the current situation resonate. Do NOT invent new events beyond what has been established.'}

Output ONLY in this format (no JSON, no preamble):
<CHAPTER>Chapter ${chapterNum} title (pure text ONLY)</CHAPTER>
<SYNOPSIS>
A precise ~300 word synopsis of THIS chapter for future continuity reference.
Cover: ① setting (time/place), ② key events in order, ③ character emotional states and turning points, ④ 1–2 verbatim significant lines of dialogue.
Write in the same language as the story. Be specific — this will be read by AI later.
</SYNOPSIS>
<CONTENT>
Full chapter text. Do NOT repeat the title. Start immediately.
</CONTENT>`;

            Utils.showToast(isReroll ? I18n.t('t.pixiv_rewriting_chapter', {n: chapterNum}) : I18n.t('t.pixiv_generating_chapter', {n: chapterNum}));
            const messages = [{ role: 'user', content: `${isReroll ? 'Rewrite' : 'Write'} Chapter ${chapterNum} of the serial novel.` }];
            const _overrideCfg = settings?.apiOverride;
            const response = await Utils.callChatAPI(messages, systemPrompt, _overrideCfg?.enabled ? _overrideCfg : null);

            const extractTag = (tag) => {
                const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
                const m = response.match(regex);
                return m ? m[1].trim() : '';
            };
            const stripHtmlFn = (text) => text.replace(/<details[^>]*>[\s\S]*?<\/details>/gi, '').replace(/<[^>]*>/g, '').trim();

            const chapterTitle = stripHtmlFn(extractTag('CHAPTER')) || `第${chapterNum}章`;
            const synopsis = extractTag('SYNOPSIS');
            const content = extractTag('CONTENT');

            if (!content) {
                Utils.showToast(I18n.t('t.pixiv_no_content', '生成失败：未找到正文，请重试'));
                return;
            }

            const wordCount = content.replace(/<[^>]*>/g, '').length;
            // 兜底：极端情况下（导入未迁移旧包后 _v 已对齐）老连载缺 heatBase
            if (typeof novel.heatBase !== 'number') this._initNovelPopularity(novel, AppState.data.twitterData);
            const newChapterData = {
                id: Utils.generateId(),
                chapterNum,
                title: chapterTitle,
                content,
                synopsis: synopsis || '',
                userHint: userHint || '',
                wordCount,
                hearts: this._rollChapterHearts(novel.heatBase),
                createdAt: Date.now()
            };

            // 生成期间用户可能已切到别的小说：novelId 是发起时捕获的目标小说，
            // this.currentNovelId 是当前屏幕正在看的小说，两者不一致时跳过 UI 尾巴（下标/重渲），只落盘+提示
            const stillOnThisNovel = novelId === this.currentNovelId;
            if (isReroll) {
                // 保留原章节 id 和创建时间，只替换内容
                if (rerollIdx >= novel.chapters.length) throw new Error('章节索引越界，请重试');
                newChapterData.id = novel.chapters[rerollIdx].id;
                newChapterData.createdAt = novel.chapters[rerollIdx].createdAt;
                novel.chapters[rerollIdx] = newChapterData;
                if (stillOnThisNovel) this.currentChapterIdx = rerollIdx;
            } else {
                novel.chapters.push(newChapterData);
                if (stillOnThisNovel) this.currentChapterIdx = novel.chapters.length - 1;
            }
            this._recalcNovelHearts(novel);

            novel.updatedAt = Date.now();
            this._recordNovelAngle({ title: chapterTitle, tags: novel.tags || [] });
            Utils.saveData();
            if (stillOnThisNovel) this.renderReader();
            Utils.showToast(isReroll ? I18n.t('t.pixiv_rewrite_done', {n: chapterNum}) : I18n.t('t.pixiv_chapter_done', {n: chapterNum}));
        } catch (e) {
            Utils.showToast(I18n.t('t.pixiv_gen_failed', '生成失败: ') + e.message);
            console.error('[PixivNovel] generateNextSerialChapter error:', e);
        } finally {
            this._isGeneratingChapter = false;
            const b = document.getElementById('pixivNextChapterBtn');
            if (b) { b.textContent = I18n.t('pixiv.btn_generate_next', '✦ 続きを生成'); b.disabled = false; }
        }
    },

    // ===== 删除章节：级联截断（同酒馆 truncate）=====
    // 删第 N 章 = 删第 N 章及其后所有章节（含各自摘要）。后续章节是接着本章写的，
    // 单删中间章会让剧情断裂，所以连同其后一起截掉。删前 confirm 明确告知会连带几章。
    deleteChapter(novelId, chapterIdx) {
        const data = AppState.data.pixivData;
        const novel = (data.novels || []).find(n => n.id === novelId);
        if (!novel || !novel.chapters || novel.chapters.length === 0) return;
        if (chapterIdx < 0 || chapterIdx >= novel.chapters.length) return;
        const chapterTitle = novel.chapters[chapterIdx]?.title || I18n.t('pixiv.chapter_n', {n: chapterIdx + 1});
        const after = novel.chapters.length - chapterIdx - 1;   // 其后还有几章会被连带删除
        const msg = after > 0
            ? I18n.t('pixiv.confirm_truncate_chapter', {title: chapterTitle, n: after})
            : I18n.t('pixiv.confirm_delete_chapter', {title: chapterTitle});
        if (!confirm(msg)) return;
        novel.chapters = novel.chapters.slice(0, chapterIdx);   // 截断：本章及其后全部移除（含摘要）
        novel.chapters.forEach((ch, i) => { ch.chapterNum = i + 1; });   // 重排（前段不变，保险）
        this._recalcNovelHearts(novel);   // 被截掉的章若是最高章，novel.hearts 缓存需随之重算，否则热度滞留旧最大值
        // 截断必然把结局章一并删掉，若原为完结状态则回退到连载中，否则续写/重写/完结按钮被 !completed 挡死
        if (novel.completed) { novel.completed = false; novel.completedAt = null; }
        novel.updatedAt = Date.now();
        // 当前章越界 → 跳到最后保留的一章
        if (this.currentChapterIdx >= novel.chapters.length) {
            this.currentChapterIdx = Math.max(0, novel.chapters.length - 1);
        }
        Utils.saveData();
        this.renderReader();
        Utils.showToast(I18n.t('t.pixiv_chapter_deleted', {title: chapterTitle}));
    },

    // ===== 收藏 =====
    toggleFavorite(novelId) {
        if (!novelId) return;
        const data = AppState.data.pixivData;
        if (!data.favorites) data.favorites = [];

        const idx = data.favorites.indexOf(novelId);
        if (idx !== -1) {
            data.favorites.splice(idx, 1);
        } else {
            data.favorites.push(novelId);
        }

        Utils.saveData();
        if (AppState.currentScreen === 'pixiv-reader') {
            this.renderReader();
        } else {
            this.renderNovelList();
        }
    },

    // ===== 生成弹窗 =====
    showGenerateModal() {
        const modal = document.getElementById('pixivGenerateModal');

        // 清空表单
        document.getElementById('pixivGenTitle').value = '';
        document.getElementById('pixivGenTags').value = '';
        document.getElementById('pixivGenType').value = 'oneshot';
        document.getElementById('pixivGenPrompt').value = '';

        // 填充文风下拉
        this._populateStyleDropdown();

        modal.classList.add('active');
    },

    _populateStyleDropdown() {
        const select = document.getElementById('pixivGenStyle');
        if (!select) return;
        const settings = AppState.data.pixivData.settings;
        const enabledStyles = (settings.writingStyles || []).filter(s => s.enabled);
        select.innerHTML = `<option value="random">${I18n.t('pixiv.style_random', 'ランダム（自動選択）')}</option>`;
        enabledStyles.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            select.appendChild(opt);
        });
    },

    // ===== 用户手动创建小说弹窗 =====
    showCreateNovelModal() {
        const modal = document.getElementById('pixivCreateNovelModal');
        // 清空表单
        document.getElementById('pixivCreateTitle').value = '';
        document.getElementById('pixivCreateAuthor').value = '';
        document.getElementById('pixivCreateTags').value = '';
        document.getElementById('pixivCreateType').value = 'oneshot';
        document.getElementById('pixivCreateContent').value = '';
        document.getElementById('pixivCreateChapterTitle').value = '';

        // 显示/隐藏章节标题字段
        this.toggleCreateChapterTitle();

        modal.classList.add('active');
    },

    toggleCreateChapterTitle() {
        const type = document.getElementById('pixivCreateType').value;
        const chapterTitleRow = document.getElementById('pixivCreateChapterTitleRow');
        if (type === 'serial') {
            chapterTitleRow.style.display = 'block';
        } else {
            chapterTitleRow.style.display = 'none';
        }
    },

    // ===== 提交用户创建的小说 =====
    submitUserNovel() {
        const title = document.getElementById('pixivCreateTitle').value.trim();
        const author = document.getElementById('pixivCreateAuthor').value.trim();
        const tagsInput = document.getElementById('pixivCreateTags').value.trim();
        const type = document.getElementById('pixivCreateType').value;
        const content = document.getElementById('pixivCreateContent').value.trim();
        const chapterTitle = document.getElementById('pixivCreateChapterTitle').value.trim();

        // 验证必填字段
        if (!title) {
            Utils.showToast(I18n.t('pixiv.title_required', '请输入标题'));
            return;
        }
        if (!content) {
            Utils.showToast(I18n.t('pixiv.content_required', '请输入小说正文'));
            return;
        }

        // 解析标签
        const tags = tagsInput ? tagsInput.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];

        // 计算字数
        const wordCount = content.replace(/<[^>]*>/g, '').length;

        // 创建小说对象
        const novel = {
            id: Utils.generateId(),
            title: title,
            author: author || '匿名',
            tags: tags,
            coverGradient: this.generateCoverGradient(),
            chapters: [{
                id: Utils.generateId(),
                chapterNum: 1,
                title: type === 'serial' ? (chapterTitle || '第1章') : title,
                content: content,
                wordCount: wordCount,
                createdAt: Date.now()
            }],
            isSerial: type === 'serial',
            isUserCreated: true,  // 标记为用户创建
            hearts: 0,   // 档C：随后 _initNovelPopularity 统一 roll（最高章缓存）
            timestamp: Date.now(),
            updatedAt: Date.now()
        };
        this._initNovelPopularity(novel, AppState.data.twitterData);

        const data = AppState.data.pixivData;
        data.novels.unshift(novel);
        Utils.saveData();

        // 关闭弹窗
        document.getElementById('pixivCreateNovelModal').classList.remove('active');

        this.renderTagBar();
        this.renderNovelList();
        Utils.showToast(I18n.t('pixiv.novel_created', '✓ 小说创建完成'));
    },

    // ===== 编辑小说弹窗 =====
    showEditNovelModal(novelId) {
        const data = AppState.data.pixivData;
        const novel = (data.novels || []).find(n => n.id === (novelId || this.currentNovelId));

        if (!novel) return;

        // 只允许编辑用户创建的小说
        if (!novel.isUserCreated) {
            Utils.showToast(I18n.t('pixiv.cannot_edit_ai', 'AI生成的小说不支持编辑'));
            return;
        }

        const modal = document.getElementById('pixivEditNovelModal');

        // 填充表单
        document.getElementById('pixivEditTitle').value = novel.title || '';
        document.getElementById('pixivEditAuthor').value = novel.author || '';
        document.getElementById('pixivEditTags').value = (novel.tags || []).join(', ');

        // 保存当前编辑的小说ID
        this.editingNovelId = novel.id;

        modal.classList.add('active');
    },

    // ===== 保存编辑的小说 =====
    saveEditedNovel() {
        const data = AppState.data.pixivData;
        const novel = (data.novels || []).find(n => n.id === this.editingNovelId);

        if (!novel || !novel.isUserCreated) return;

        const title = document.getElementById('pixivEditTitle').value.trim();
        const author = document.getElementById('pixivEditAuthor').value.trim();
        const tagsInput = document.getElementById('pixivEditTags').value.trim();

        if (!title) {
            Utils.showToast(I18n.t('pixiv.title_required', '请输入标题'));
            return;
        }

        // 更新小说信息
        novel.title = title;
        novel.author = author || '匿名';
        novel.tags = tagsInput ? tagsInput.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];
        novel.updatedAt = Date.now();

        Utils.saveData();

        // 关闭弹窗
        document.getElementById('pixivEditNovelModal').classList.remove('active');

        // 刷新界面
        if (AppState.currentScreen === 'pixiv-reader') {
            this.renderReader();
        } else {
            this.renderTagBar();
            this.renderNovelList();
        }

        Utils.showToast(I18n.t('pixiv.novel_updated', '✓ 小说信息已更新'));
    },

    // ===== 编辑章节弹窗 =====
    showEditChapterModal(novelId, chapterIdx) {
        const data = AppState.data.pixivData;
        const novel = (data.novels || []).find(n => n.id === (novelId || this.currentNovelId));

        if (!novel || !novel.isUserCreated) {
            Utils.showToast(I18n.t('pixiv.cannot_edit_ai', 'AI生成的小说不支持编辑'));
            return;
        }

        const chapter = novel.chapters[chapterIdx !== undefined ? chapterIdx : this.currentChapterIdx];
        if (!chapter) return;

        const modal = document.getElementById('pixivEditChapterModal');

        // 填充表单
        document.getElementById('pixivEditChapterTitle').value = chapter.title || '';
        document.getElementById('pixivEditChapterContent').value = chapter.content || '';

        // 保存编辑信息
        this.editingChapterNovelId = novel.id;
        this.editingChapterIdx = chapterIdx !== undefined ? chapterIdx : this.currentChapterIdx;

        modal.classList.add('active');
    },

    // ===== 保存编辑的章节 =====
    saveEditedChapter() {
        const data = AppState.data.pixivData;
        const novel = (data.novels || []).find(n => n.id === this.editingChapterNovelId);

        if (!novel || !novel.isUserCreated) return;

        const chapter = novel.chapters[this.editingChapterIdx];
        if (!chapter) return;

        const title = document.getElementById('pixivEditChapterTitle').value.trim();
        const content = document.getElementById('pixivEditChapterContent').value.trim();

        if (!content) {
            Utils.showToast(I18n.t('pixiv.content_required', '请输入章节内容'));
            return;
        }

        // 更新章节信息
        chapter.title = title || `第${chapter.chapterNum} 章`;
        chapter.content = content;
        chapter.wordCount = content.replace(/<[^>]*>/g, '').length;

        novel.updatedAt = Date.now();

        Utils.saveData();

        // 关闭弹窗
        document.getElementById('pixivEditChapterModal').classList.remove('active');

        // 刷新阅读器
        if (AppState.currentScreen === 'pixiv-reader') {
            this.renderReader();
        }

        Utils.showToast(I18n.t('pixiv.chapter_updated', '✓ 章节已更新'));
    },

    // ===== 添加新章节（用户创建的连载小说） =====
    showAddChapterModal(novelId) {
        const data = AppState.data.pixivData;
        const novel = (data.novels || []).find(n => n.id === (novelId || this.currentNovelId));

        if (!novel || !novel.isUserCreated || !novel.isSerial) {
            Utils.showToast(I18n.t('pixiv.cannot_add_chapter', '只能为用户创建的连载小说添加章节'));
            return;
        }

        const modal = document.getElementById('pixivAddChapterModal');

        // 清空表单
        const nextChapterNum = novel.chapters.length + 1;
        document.getElementById('pixivAddChapterTitle').value = `第${nextChapterNum} 章`;
        document.getElementById('pixivAddChapterContent').value = '';

        this.addingChapterNovelId = novel.id;

        modal.classList.add('active');
    },

    // ===== 提交新章节 =====
    submitAddChapter() {
        const data = AppState.data.pixivData;
        const novel = (data.novels || []).find(n => n.id === this.addingChapterNovelId);

        if (!novel || !novel.isUserCreated) return;

        const title = document.getElementById('pixivAddChapterTitle').value.trim();
        const content = document.getElementById('pixivAddChapterContent').value.trim();

        if (!content) {
            Utils.showToast(I18n.t('pixiv.content_required', '请输入章节内容'));
            return;
        }

        const chapterNum = novel.chapters.length + 1;
        const wordCount = content.replace(/<[^>]*>/g, '').length;
        if (typeof novel.heatBase !== 'number') this._initNovelPopularity(novel, AppState.data.twitterData);

        // 添加新章节
        novel.chapters.push({
            id: Utils.generateId(),
            chapterNum: chapterNum,
            title: title || `第${chapterNum} 章`,
            content: content,
            wordCount: wordCount,
            hearts: this._rollChapterHearts(novel.heatBase),
            createdAt: Date.now()
        });
        this._recalcNovelHearts(novel);

        novel.updatedAt = Date.now();
        Utils.saveData();

        // 关闭弹窗
        document.getElementById('pixivAddChapterModal').classList.remove('active');

        // 跳到新章节
        this.currentChapterIdx = novel.chapters.length - 1;

        // 刷新阅读器
        if (AppState.currentScreen === 'pixiv-reader') {
            this.renderReader();
        }

        Utils.showToast(I18n.t('t.pixiv_chapter_added', {n: chapterNum}));
    },

    // ===== 默认文风预设 =====
    getDefaultWritingStyles() {
        return [
            {
                id: Utils.generateId(),
                name: '清新治愈系',
                description: '温暖细腻，注重情感流动',
                rules: '使用温柔的语气，细腻的心理描写，多用环境渲染情绪，句子偏长但不拖沓，善于捕捉细节和微妙情感',
                enabled: true
            },
            {
                id: Utils.generateId(),
                name: '刀子文学',
                description: '虐文风格，情感浓烈',
                rules: '善用对比和反转，情感描写浓烈，擅长刻画痛苦和遗憾，短句营造紧张感，多用情感冲击强烈的场景',
                enabled: true
            },
            {
                id: Utils.generateId(),
                name: '轻松搞笑',
                description: '幽默诙谐，对话灵动',
                rules: '对话为主，语言活泼，善用网络梗和吐槽，节奏明快，多用短句，角色互动有趣生动',
                enabled: true
            },
            {
                id: Utils.generateId(),
                name: '正剧严肃',
                description: '剧情向，情节紧凑',
                rules: '重视情节逻辑，描写精简有力，少用抒情，对话推动剧情，结构严谨，叙事层次分明',
                enabled: true
            },
            {
                id: Utils.generateId(),
                name: '诗意抒情',
                description: '文艺风，意象丰富',
                rules: '多用比喻和意象，语言优美，重视韵律感，善于营造氛围，可适当加入诗句或文学性表达',
                enabled: true
            }
        ];
    },

    // ===== 随机选择文风 =====
    getRandomWritingStyle() {
        const settings = AppState.data.pixivData.settings;
        const enabledStyles = (settings.writingStyles || []).filter(s => s.enabled);

        if (enabledStyles.length === 0) {
            // 如果没有启用的预设，使用旧的novelRules
            if (settings.novelRules) {
                return { rules: settings.novelRules };
            }
            return null;
        }

        // 随机选择一个
        const randomIndex = Math.floor(Math.random() * enabledStyles.length);
        return enabledStyles[randomIndex];
    },

    // ===== 世界观上下文 & 剧情整合 (核心优化) =====
    getNovelContext() {
        const settings = AppState.data.pixivData.settings;
        const cpInfo = Broadcast.getCP();
        const cp = cpInfo.cp;
        const cpNickname = cpInfo.cpNickname;
        const hasCP = cpInfo.hasCP;
        const forumData = AppState.data.forumData || {};
        let context = '';

        if (settings.forumLinked) {
            // 1. 基础世界观 (来自论坛设置)
            if (AppState.data.broadcast.worldSetting) {
                context += `【原作世界观 World Setting】\n${AppState.data.broadcast.worldSetting}\n\n`;
            }

            // 2. 剧情时间线 (来自论坛剧情进展)
            // 获取所有剧情，按时间顺序排列
            const plots = AppState.data.broadcast.plotProgress || [];
            if (plots.length > 0) {
                context += `【原作剧情时间线 Official Story Timeline】\n(请严格遵守以下原作发生过的剧情事件)\n`;
                plots.forEach((p, index) => {
                    context += `Event ${index + 1}: [${p.title}]\n${p.content}\n\n`;
                });
            }

            // 3. 世界书整合 (论坛绑定的 + Pixiv额外绑定的)
            let worldBooksContent = '';
            const allBooks = AppState.data.worldBooks || [];
            const bookIds = new Set();

            // 添加放送局绑定的世界书（多选）
            Utils.getActiveWorldBookIds().forEach(id => bookIds.add(id));

            // 添加Pixiv设置中额外的世界书
            if (settings.additionalWorldBookIds) {
                settings.additionalWorldBookIds.forEach(id => bookIds.add(id));
            }

            if (bookIds.size > 0) {
                worldBooksContent += `【世界书/设定集 World Books】\n(以下是原作的详细设定资料)\n`;
                bookIds.forEach(id => {
                    const book = allBooks.find(b => b.id === id);
                    if (book && book.entries) {
                        worldBooksContent += `--- Book: ${book.name} ---\n`;
                        book.entries.filter(e => e.enabled !== false).forEach(e => {
                            worldBooksContent += `[${e.title}]: ${e.content}\n`;
                        });
                        worldBooksContent += '\n';
                    }
                });
            }
            context += worldBooksContent;

        } else {
            // 未联动论坛，仅使用自定义设定
            if (settings.customPrompt) {
                context += `【世界观设定】\n${settings.customPrompt}\n\n`;
            }
        }

        // CP设定
        if (cp) {
            const nickname = cpNickname ? `（简称：${cpNickname}）` : '';
            context += `【CP设定】\n主要CP: ${cp}${nickname}\n在同人社区中，这对CP也被称为"${cpNickname || cp}"\n\n`;
        }

        // 写作规则
        if (settings.novelRules) {
            context += `【写作风格规则】\n${settings.novelRules}\n\n`;
        }

        return context;
    },

    // ===== 语言提示 =====
    getLanguageInstruction() {
        const lang = (AppState.data.pixivData.settings || {}).language || 'jp-cn';
        // 指令语言 ≠ 正文语言：用户的输入可能是中文，但不能原样漏进日语正文
        const purityRule = `\n\n【重要・指令语言 ≠ 正文语言】用户填写的标题、标签、追加指示、续章方向，以及前文章节里可能夹带的内容，都可能用中文或其他语言书写。那些只是给你的创作指令或参考信息，绝不是要照抄进正文的原句。请理解其意图后，用地道的母语级日语重新创作——严禁把指令中的中文词句、语序或表达习惯原样搬进日语正文，对话与叙述必须完全符合日语母语者的自然语感。`;
        if (lang === 'jp-cn') {
            return `小说正文使用日语书写。为了更好的阅读体验，请【以 3-5 个段落为一组】集中给出一次中文翻译，不要每一段都单独放翻译标签。
示例排版：
日语段落1
日语段落2
日语段落3
<details class='tl'><summary>🔍译</summary><span>中文段落1\\n中文段落2\\n中文段落3</span></details>
日语段落4...` + purityRule;
        } else if (lang === 'cn-only') {
            return '小说正文完全使用中文书写。';
        }
        return '小说正文完全使用日语书写。' + purityRule;
    },

    // ===== AI生成小说 =====
    async generateNovel() {
        const title = document.getElementById('pixivGenTitle').value.trim();
        const tagsInput = document.getElementById('pixivGenTags').value.trim();
        const type = document.getElementById('pixivGenType').value;
        const styleChoice = (document.getElementById('pixivGenStyle')?.value) || 'random';

        const extraPrompt = document.getElementById('pixivGenPrompt').value.trim();
        // 「最少字数」专用字段（避免用户在 extraPrompt 里手写字数指令污染 systemPrompt 与 default Target length 冲突）
        const minWordsInput = document.getElementById('pixivGenMinWords')?.value.trim();
        const minWords = minWordsInput ? Math.max(100, Math.min(20000, parseInt(minWordsInput, 10) || 0)) : 0;
        const targetLengthLine = minWords > 0
            ? `Target length: at least ${minWords} words. Aim for ${minWords} - ${Math.round(minWords * 1.4)} words. Do NOT output any meta-information about word count (e.g. "Word count: xxx") — only the story content.`
            : 'Target length: 1500 - 3000 words.';

        const worldContext = this.getNovelContext();
        if (!worldContext.trim() && !title && !tagsInput && !extraPrompt) {
            Utils.showToast(I18n.t('pixiv.need_context', '请先设置世界观或填写生成内容'));
            return;
        }

        // 关闭弹窗，显示loading
        document.getElementById('pixivGenerateModal').classList.remove('active');
        Utils.showToast(I18n.t('pixiv.generating', '正在生成小说...'));

        const btn = document.getElementById('pixivNovelGenerateBtn');
        btn.textContent = I18n.t('pixiv.btn_loading_dots', '...');
        btn.disabled = true;

        // 显示骨架屏
        const listContainer = document.getElementById('pixivNovelList');
        if (listContainer) {
            const skel = document.createElement('div');
            skel.id = 'pixivSkeletonBlock';
            skel.innerHTML = `<div class="skeleton-card" style="border-radius:var(--radius-sm); margin-bottom:10px;">
                <div class="skeleton-line long"></div>
                <div class="skeleton-line medium"></div>
                <div class="skeleton-line short"></div>
            </div>`;
            listContainer.prepend(skel);
        }

        try {
            const langInstruction = this.getLanguageInstruction();

            // 获取视角设置
            const perspectiveSelect = document.getElementById('pixivGenPerspective');
            const perspective = perspectiveSelect ? perspectiveSelect.value : 'third';
            const focusCharInput = document.getElementById('pixivGenFocusChar');
            const focusChar = focusCharInput ? focusCharInput.value.trim() : '';

            // 保存视角到 settings，供 autoGenerateNovel 使用
            const settings2 = AppState.data.pixivData.settings;
            settings2.perspective = perspective;
            settings2.focusChar = focusChar;

            // 视角指令
            let perspectiveInstruction = '';
            if (perspective === 'third') {
                perspectiveInstruction = `⚠️ ABSOLUTE PERSPECTIVE RULE — THIRD PERSON ONLY:
You MUST write EXCLUSIVELY in the **Third-Person Perspective** (三人称). This is a hard requirement with NO exceptions.
STRICTLY PROHIBITED: Using first-person pronouns (I / me / my / 私 / 俺 / 僕 / あたし / 僕は / 俺は, etc.) as the narrative voice at any point in the story.
- ✅ CORRECT: "She looked down. （Could he really mean that?）"
- ❌ WRONG: "I looked down. I thought he might mean it."
Internal monologues and psychological descriptions MUST be enclosed in full-width parentheses （）to distinguish them from objective narration.`;
                if (focusChar) {
                    perspectiveInstruction += `\nFocus Character constraint: Because the user specified [ ${focusChar} ] as the focal character, use **Third-Person Limited** strictly from [ ${focusChar} ]'s perspective. The "camera" never leaves [ ${focusChar} ]. Never write the inner thoughts of other characters.`;
                }
            } else if (perspective === 'second') {
                perspectiveInstruction = `You MUST write in the **Second-Person Perspective**, using "you" as the main character to create an immersive, reader-insert experience.`;
            } else if (perspective === 'first') {
                perspectiveInstruction = `You MUST write in the **First-Person Perspective**, using "I" as the main viewpoint character.`;
            }

            // 判断是否设置了CP
            const settings = AppState.data.pixivData.settings;
            const cpInfo = Broadcast.getCP();
            const cp = cpInfo.cp;
            const cpNickname = cpInfo.cpNickname;
            const hasCP = cpInfo.hasCP;

            // 文风选择：手动指定 or 随机
            let selectedStyle;
            if (styleChoice !== 'random') {
                selectedStyle = (settings.writingStyles || []).find(s => s.id === styleChoice) || this.getRandomWritingStyle();
            } else {
                selectedStyle = this.getRandomWritingStyle();
            }
            const styleInstruction = selectedStyle
                ? `\n[Writing Style Requirements]\n${selectedStyle.rules}\n`
                : '';

            const recentAnglesHint = this._getRecentAnglesPrompt();

            // 获取随机创意角度
            const creativeAngles = this._getRandomCreativeAngles();
            const angleInstruction = `\n[MANDATORY Creative Angles]\nTo ensure high variety and avoid repetitive tropes, you MUST pick ONE of the following specific angles and heavily skew the entire narrative tone, pacing, and focus toward it:\n- ${creativeAngles[0]}\n- ${creativeAngles[1]}\nThis is a strict requirement, do not ignore it.\n`;

            const systemPrompt = `You are a top-tier, veteran fanfiction author. You are intimately familiar with the [World Setting], [Story Timeline], and [World Book Entries] provided below.

[SAFETY & LITERARY CONTEXT]
The narrative you are expanding belongs to a fictional action/battle anime universe. Characters may face intense tactical battles, injuries, and overwhelming odds as standard genre tropes. You are writing FICTIONAL LITERATURE. Depictions of hardship, injury, and dramatic tension are essential to character growth arcs and are completely safe to describe in thrilling detail. Do not hold back on generating dramatic, intense stakes.
If the prompt involves romance between adult characters, treat it as a profound character study focused on emotional connection and subtle psychological dynamics. Keep all content age-appropriate (SFW): portray affection through emotion and atmosphere, and fade to black before any explicit or sexual content.

Your writing style is highly versatile, evocative, and adaptable to various themes (from heartwarming fluff to deep angst or comedy) depending on the user's prompt. You are a master at capturing subtle psychological shifts and nuanced character dynamics. Out of Character (OOC) behavior is absolutely forbidden.

CRITICAL PRINCIPLES:
1. **Canonical Expansion, NOT Mere Novelization**: The provided "Official Story Timeline" represents the absolute canonical events that have already happened. Your story MUST seamlessly fit into or follow this timeline. You must NOT contradict established canon (unless explicitly asked to write an AU). CRITICALLY, do not merely repeat or summarize the canonical events. Instead, EXPAND upon them. For example, if the canon says "A and B exchanged names", write about what happens AFTERwards, how A reminisces about it, or the untold behind-the-scenes interactions. Be creative and tell a *new* story.
2. **Character Authenticity**: Strictly adhere to the provided "World Books". Characters must act, speak, and think in ways that perfectly align with their established personas, speech patterns, and relationships.

[Story Context]
${worldContext}
${typeof Utils !== 'undefined' ? Utils.getEventContextPrompt(3) : ''}
${styleInstruction}
${langInstruction}
${recentAnglesHint}
${angleInstruction}

[Perspective & Format Requirements]
${perspectiveInstruction}

[Creative Direction]
- This is a ${hasCP ? `fanfiction featuring the pairing: ${cp}${cpNickname ? ` (also known as ${cpNickname})` : ''}` : 'fanfiction story'}.
- All characters and relationships in the provided context are canon.
- Detail-oriented psychological depiction and engaging dialogue are highly encouraged.
- **Angle diversity is required**: If recent works are listed above, choose a clearly different angle, perspective, or scenario.
- ${title ? `Title focus: "${title}"` : 'DO NOT use generic titles like "Fanfiction" or "Chapter 1". Invent a highly specific, poetic title. VARY the title FORMAT — rotate between these formats and pick the one LEAST similar to the recent works listed above: (1) Ultra-short evocative「溶ける春」「君の声」「夜半の鐘」, (2) Scene-descriptive「深夜の台所で」「雨の帰り道」「春を待つ窓辺」, (3) Character-POV「○○の知らない△△」「彼女が笑う理由」, (4) Poetic-philosophical「三度死んで、また会おう」「散る前に花となれ」「忘れた頃に降る雪」, (5) Inner-voice「伝わらない想いの果てに」「言えなかった夜の続き」. Choose the format most different from recent works.'}
- ${tagsInput ? `Theme/Tags to incorporate: ${tagsInput}` : ''}
- ${targetLengthLine}
- Format: ${type === 'serial' ? 'Chapter 1 of a serial. Pause at the highest tension point — do NOT invent new events beyond established canon. Let the moment resonate.' : 'A standalone one-shot with a complete, satisfying ending.'}
${extraPrompt ? `- Additional Instructions: ${extraPrompt}` : ''}

[Strict Tagging Rules]
- Never generate tags related to Yume (e.g., dream novel, OC, self-insert) unless the user specifically asked for it in the extra prompt. The characters mentioned are strictly canon.

Output your response ONLY in the following structured format. Do NOT use JSON. Use these exact tags to delimit your content:
<TITLE>Story Title (in the target language, pure text ONLY, NO translation tags)</TITLE>
<CHAPTER>${type === 'serial' ? 'Chapter Title (pure text ONLY)' : ''}</CHAPTER>
<TAGS>tag1, tag2, pairing name, character name (pure text ONLY)</TAGS>
<AUTHOR>A creative Japanese internet pen-name</AUTHOR>
${type === 'serial' ? `<SYNOPSIS>
A precise ~300 word chapter synopsis for internal continuity tracking. Cover: ① Setting (time/place), ② key plot events in order, ③ character emotional states and turning points, ④ 1-2 significant lines of dialogue (verbatim). Write in the same language as the story. This synopsis will be read by AI in future chapters — be specific and complete, not vague.
</SYNOPSIS>
` : ''}<CONTENT>
The full story text goes here. Do NOT repeat or include the title at the beginning of the text here. Start the story immediately.
Make sure to include line breaks and dialogue as normal.
</CONTENT>`;

            const messages = [{ role: 'user', content: `Please write a ${type === 'serial' ? 'serial chapter' : 'one-shot'} fanfiction based on the provided guidelines.` }];
            const _overrideCfg = AppState.data.pixivData?.settings?.apiOverride;
            const response = await Utils.callChatAPI(messages, systemPrompt, _overrideCfg?.enabled ? _overrideCfg : null);

            // 解析结构化文本
            let result = {};
            try {
                // 预清理：剥掉 LLM 偶尔多包的 markdown 代码围栏
                const resp = response.replace(/```[a-zA-Z]*/g, '');

                const extractTag = (tag) => {
                    const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
                    const match = resp.match(regex);
                    return match ? match[1].trim() : '';
                };

                const stripHtml = (text) => text.replace(/<details[^>]*>[\s\S]*?<\/details>/gi, '').replace(/<[^>]*>/g, '').trim();

                result.title = stripHtml(extractTag('TITLE'));
                result.chapterTitle = stripHtml(extractTag('CHAPTER'));
                const rawTags = stripHtml(extractTag('TAGS'));
                result.tags = rawTags ? rawTags.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];
                result.author = extractTag('AUTHOR');
                result.synopsis = type === 'serial' ? extractTag('SYNOPSIS') : '';
                result.content = extractTag('CONTENT');

                // 兜底①：<CONTENT> 开了但没闭合（生成被截断）→ 取到结尾
                if (!result.content) {
                    const m = resp.match(/<CONTENT>/i);
                    if (m) result.content = resp.slice(m.index + m[0].length).replace(/<\/?CONTENT>/gi, '').trim();
                }
                // 兜底②：整段连结构标签都没有 → 整段正文当 content，不丢弃整次生成
                if (!result.content) {
                    const stripped = resp.replace(/<\/?[A-Za-z]+>/g, '').trim();
                    if (stripped) {
                        result.content = stripped;
                        if (!result.title) result.title = (tagsInput || '').split(/[,，]/)[0].trim() || '無題';
                    }
                }

                if (!result.content) {
                    throw new Error("Missing <CONTENT> tag in response");
                }
            } catch (parseErr) {
                console.error('[PixivNovel] Parse error:', parseErr);
                Utils.showToast(I18n.t('pixiv.parse_error', '生成格式解析失败，请重试'));
                return;
            }

            const content = result.content;
            const wordCount = content.replace(/<[^>]*>/g, '').length;

            // 过滤梦小说相关tag
            const dreamNovelKeywords = ['梦', '夢', '梦小说', '夢主', '梦向', '原创角色', 'OC', '自创', '梦女主', '女主'];
            let filteredTags = (result.tags || []).filter(tag => {
                const tagLower = tag.toLowerCase();
                return !dreamNovelKeywords.some(keyword =>
                    tag.includes(keyword) || tagLower.includes(keyword.toLowerCase())
                );
            });

            // 如果没有tags或被过滤光了，使用用户输入的tags
            if (filteredTags.length === 0 && tagsInput) {
                filteredTags = tagsInput.split(/[,，]/).map(t => t.trim()).filter(Boolean);
            }

            // 如果有CP设定，确保添加CP tag（全称 + 简称）
            if (hasCP && !filteredTags.some(t => t.includes(cp))) {
                filteredTags.unshift(cp);
            }
            if (cpNickname && !filteredTags.some(t => t.includes(cpNickname))) {
                filteredTags.splice(1, 0, cpNickname);
            }

            // 创建小说对象
            const novel = {
                id: Utils.generateId(),
                title: result.title || title || '无题',
                author: result.author || this.generatePenName(),
                tags: filteredTags,
                coverGradient: this.generateCoverGradient(),
                writingStyleId: selectedStyle ? selectedStyle.id : null, // 保存文风ID
                chapters: [{
                    id: Utils.generateId(),
                    chapterNum: 1,
                    title: (type === 'serial' && result.chapterTitle && result.chapterTitle !== 'One-shot') ? result.chapterTitle : (result.title || ''),
                    content: content,
                    synopsis: result.synopsis || '',
                    userHint: extraPrompt || '',
                    plotProgressId: null,
                    wordCount: wordCount,
                    createdAt: Date.now()
                }],
                isSerial: type === 'serial',
                hearts: 0,   // 档C：随后 _initNovelPopularity 统一 roll（最高章缓存）
                timestamp: Date.now(),
                updatedAt: Date.now()
            };
            this._initNovelPopularity(novel, AppState.data.twitterData);

            const data = AppState.data.pixivData;
            data.novels.unshift(novel);
            this._recordNovelAngle(novel);
            Utils.saveData();
            if (typeof Utils !== 'undefined' && Utils.emitEvent) {
                Utils.emitEvent('novel_published', 'pixiv', { title: novel.title || title, summary: (novel.tags || []).join(', ') });
            }
            this.renderTagBar();
            this.renderNovelList();
            Utils.showToast(I18n.t('pixiv.generated', '✓ 小说生成完成'));

        } catch (e) {
            console.error('[PixivNovel Error]', e);
            this._showGenerateError(e);
        } finally {
            document.getElementById('pixivSkeletonBlock')?.remove();
            btn.textContent = '+';
            btn.disabled = false;
        }
    },

    // v2.68.10 生成失败友好提示：区分 timeout / network / api / safety / parse，给重试入口
    _showGenerateError(err) {
        const esc = s => Utils.escapeHtml(s || '');
        const listContainer = document.getElementById('pixivNovelList');
        if (!listContainer) {
            Utils.showToast((err && err.message) || I18n.t('pixiv.err_unknown_title', '生成失败'));
            return;
        }
        // 先移除旧的失败卡，避免叠加
        document.getElementById('pixivGenerateErrorBanner')?.remove();

        const code = err && err.code;
        let title, hint;
        if (code === 'timeout') {
            title = I18n.t('pixiv.err_timeout_title', '生成超时');
            hint = I18n.t('pixiv.err_timeout_hint', '生成时间超过 10 分钟，可能是文章太长或网络波动。可尝试减少字数后重试');
        } else if (code === 'network') {
            title = I18n.t('pixiv.err_network_title', '网络错误');
            hint = I18n.t('pixiv.err_network_hint', '请检查网络连接，或换个时段重试');
        } else if (code === 'api') {
            title = I18n.t('pixiv.err_api_title', 'API 错误');
            hint = (err && err.message) || I18n.t('pixiv.err_api_hint', 'API 返回错误，请检查 key / 额度 / 模型设置');
        } else if (code === 'safety') {
            title = I18n.t('pixiv.err_safety_title', '内容被安全策略拦截');
            hint = I18n.t('pixiv.err_safety_hint', '尝试调整提示词或换个角度');
        } else if (code === 'parse') {
            title = I18n.t('pixiv.err_parse_title', '响应解析失败');
            hint = (err && err.message) || I18n.t('pixiv.err_parse_hint', '请稍后重试');
        } else if (code === 'truncated') {
            title = I18n.t('pixiv.err_truncated_title', '生成被截断');
            hint = (err && err.message) || I18n.t('pixiv.err_truncated_hint', '生成内容过长被截断，可尝试缩短字数要求');
        } else {
            title = I18n.t('pixiv.err_unknown_title', '生成失败');
            hint = (err && err.message) || I18n.t('pixiv.err_unknown_hint', '请稍后重试');
        }

        const banner = document.createElement('div');
        banner.id = 'pixivGenerateErrorBanner';
        banner.style.cssText = 'background:var(--surface,#fff);border:1px solid var(--border,#e5e5e5);border-left:3px solid #d97757;border-radius:var(--radius-sm,8px);padding:14px 16px;margin-bottom:12px;display:flex;flex-direction:column;gap:10px;';
        banner.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97757" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <strong style="color:var(--text-primary,#333);font-size:14px;">${esc(title)}</strong>
                <button id="pixivGenerateErrorClose" type="button" style="margin-left:auto;background:none;border:none;cursor:pointer;color:var(--text-tertiary,#999);font-size:18px;line-height:1;padding:0 4px;" aria-label="${I18n.t('pixiv.err_close', '关闭')}">×</button>
            </div>
            <div style="font-size:12px;color:var(--text-secondary,#666);line-height:1.6;word-break:break-word;">${esc(hint)}</div>
            <div style="display:flex;gap:8px;">
                <button id="pixivGenerateErrorRetry" type="button" class="glass-btn primary" style="font-size:13px;">${I18n.t('pixiv.retry_now', '立即重试')}</button>
                <button id="pixivGenerateErrorEdit" type="button" class="glass-btn" style="font-size:13px;">${I18n.t('pixiv.retry_edit', '修改后重试')}</button>
            </div>
        `;
        listContainer.prepend(banner);

        const removeBanner = () => banner.remove();
        document.getElementById('pixivGenerateErrorClose').onclick = removeBanner;
        document.getElementById('pixivGenerateErrorRetry').onclick = () => {
            removeBanner();
            this.generateNovel();
        };
        document.getElementById('pixivGenerateErrorEdit').onclick = () => {
            removeBanner();
            document.getElementById('pixivGenerateModal').classList.add('active');
        };
    },

    // ===== 新剧情后台自动生成（不依赖弹窗 DOM，静默运行）=====
    async autoGenerateNovel() {
        const worldContext = this.getNovelContext();
        if (!worldContext.trim()) return; // 没有世界观就跳过

        try {
            const settings = AppState.data.pixivData.settings;
            const cpInfo = Broadcast.getCP();
            const cp = cpInfo.cp;
            const cpNickname = cpInfo.cpNickname;
            const hasCP = cpInfo.hasCP;
            const langInstruction = this.getLanguageInstruction();

            // === v2.70.0 NPC 化升级：从 doujin_writer 池 pick 作者 + 文风固定 ===
            const fanFriends = (AppState.data.twitterData && AppState.data.twitterData.fanFriends) || [];
            const writers = fanFriends.filter(f => f.type === 'doujin_writer');
            let pickedNpc = null;
            let npcStyle = null;
            if (writers.length > 0) {
                pickedNpc = this._pickWriterWeighted(writers);
                if (pickedNpc && pickedNpc.writingStyleId) {
                    npcStyle = (settings.writingStyles || []).find(s => s.id === pickedNpc.writingStyleId) || null;
                }
            }

            const selectedStyle = npcStyle || this.getRandomWritingStyle();
            const styleInstruction = selectedStyle
                ? `\n【文风要求 Writing Style】\n${selectedStyle.rules}\n`
                : '';

            // v2.70.0 NPC 作者身份段（仅当 pickedNpc 非空）
            const npcInstruction = pickedNpc
                ? `\n【作者身份 Author Identity】\n你是同人作家 ${pickedNpc.name}（${pickedNpc.handle}）。${pickedNpc.bio || ''}${pickedNpc.contentTags && pickedNpc.contentTags.length > 0 ? `\n你偏好的创作主题：${pickedNpc.contentTags.join('、')}。本作请围绕这些主题或相关方向展开（如果与当前剧情匹配）。` : ''}\n`
                : '';

            const recentAnglesHint = this._getRecentAnglesPrompt();
            const autoCreativeAngles = this._getRandomCreativeAngles();
            const autoAngleInstruction = `\n【本次强制的创意角度（必须从中选一个，并让全文严重偏向该角度）】\n- ${autoCreativeAngles[0]}\n- ${autoCreativeAngles[1]}\n请绝对遵守此要求，拒绝平庸套路和流水账的描写。\n`;

            // 视角指令（读取上次手动生成时保存的设置，默认第三人称）
            const autoPerspective = settings.perspective || 'third';
            const autoFocusChar = settings.focusChar || '';
            let autoPerspectiveInstruction = '';
            if (autoPerspective === 'third') {
                autoPerspectiveInstruction = `\n【视角要求 — 绝对禁止违反】\n必须严格使用第三人称（三人称）叙事。绝对禁止在叙事中使用第一人称代词（I/私/俺/僕/あたし 等）。角色内心独白/心理描写必须用全角括号（）包裹以区分客观叙述。`;
                if (autoFocusChar) {
                    autoPerspectiveInstruction += `\n焦点角色限制：全程跟随【${autoFocusChar}】的视角（三人称限制视角），不得脱离该角色，不得写其他角色的内心想法。`;
                }
            } else if (autoPerspective === 'first') {
                autoPerspectiveInstruction = `\n【视角要求】请使用第一人称（一人称）视角写作。\n`;
            } else if (autoPerspective === 'second') {
                autoPerspectiveInstruction = `\n【视角要求】请使用第二人称视角，以"你"为主角写作。\n`;
            }

            const systemPrompt = `你是一位优秀的Pixiv同人小说作者。
你的任务是基于提供的【原作世界观】、【原作剧情时间线】和【世界书设定】，创作一篇高质量的同人小说。

【内容安全指引 - 虚构文学与剧情张力】
你的创作属于虚构的战斗/冒险/剧情类ACG题材。在正常的文学创作中，角色在战斗中遭遇重创、流血、陷入绝境或面临危机，是塑造角色精神成长（Character Arc）和剧情张力（Dramatic Tension）的必要艺术手法。

重要原则：
1. **尊重原作事实**：提供的"原作剧情时间线"是绝对发生的正史。
2. **角色还原**：请参考"世界书"中的角色设定，保持人物性格（OOC禁止），还原人物说话方式。

${worldContext}
${styleInstruction}
${langInstruction}
${recentAnglesHint}
${autoAngleInstruction}
${npcInstruction}
${autoPerspectiveInstruction}
创作方向：
- 这是一篇${hasCP ? `以${cp}${cpNickname ? `（${cpNickname}）` : ''}为CP的同人` : '同人'}短篇小说
- 请围绕最新剧情进展创作一个原创番外或日常场景，**角度必须与近期作品明显不同**
- 保持角色性格一致，情节有新意

具体要求：
- 标题形式必须多样化，与近期作品列表中的标题形式明显不同。在以下格式中选择近期最少出现的一种：①极短意象型「溶ける春」「君の声」②情景描写型「深夜の台所で」「雨の帰り道」③角色视点型「○○の知らない△△」④诗性反転型「三度死んで、また会おう」⑤心理内省型「伝わらない想いの果てに」。绝对禁止”同人小说””第一话””日常”等敷衍通用标题。
- 写出1500-2500字短篇小说，完整结局
- 细腻心理描写和对话

绝对禁止的tags：
- 不要生成任何包含「梦」「夢」「梦小说」「夢主」「梦向」的标签
- 不要生成「原创角色」「OC」「自创」等标签

请严格使用以下标签格式输出小说，不要使用JSON：
<TITLE>标题 (纯日文格式文本，绝对不要包含翻译标签)</TITLE>
<TAGS>作品, CP, 角色, 主题 (纯文本，不要包含翻译标签)</TAGS>
<AUTHOR>日式网名</AUTHOR>
<CONTENT>
小说正文内容...
请直接开始正文，千万不要在正文开头重复标题！
</CONTENT>`;

            const messages = [{ role: 'user', content: '请根据以上设定创作一篇短篇同人小说。' }];
            const _overrideCfg = AppState.data.pixivData?.settings?.apiOverride;
            const response = await Utils.callChatAPI(messages, systemPrompt, _overrideCfg?.enabled ? _overrideCfg : null);

            let result = {};
            try {
                const extractTag = (tag) => {
                    const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
                    const match = response.match(regex);
                    return match ? match[1].trim() : '';
                };

                const stripHtml = (text) => text.replace(/<details[^>]*>[\s\S]*?<\/details>/gi, '').replace(/<[^>]*>/g, '').trim();

                result.title = stripHtml(extractTag('TITLE'));
                const rawTags = stripHtml(extractTag('TAGS'));
                result.tags = rawTags ? rawTags.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];
                result.author = extractTag('AUTHOR');
                result.content = extractTag('CONTENT');

                // v2.70.0: author 强制覆盖（仅当 pickedNpc 非空）
                // v2.124.0: 用日文笔名（NPC name = 推特显示名，作者要的）；handle 仅作兜底
                if (pickedNpc) {
                    result.author = pickedNpc.name || (pickedNpc.pixivHandle || pickedNpc.handle || '').replace(/^@+/, '');
                }

                if (!result.content) {
                    throw new Error("Missing <CONTENT> tag in response");
                }
            } catch (e) {
                console.warn('[AutoGen] Parse failed:', e);
                return;
            }

            const content = result.content;
            const wordCount = content.replace(/<[^>]*>/g, '').length;

            const dreamNovelKeywords = ['梦', '夢', '梦小说', '夢主', '梦向', '原创角色', 'OC', '自创', '梦女主', '女主'];
            let filteredTags = (result.tags || []).filter(tag =>
                !dreamNovelKeywords.some(kw => tag.includes(kw))
            );
            if (hasCP && !filteredTags.some(t => t.includes(cp))) filteredTags.unshift(cp);
            if (cpNickname && !filteredTags.some(t => t.includes(cpNickname))) filteredTags.splice(1, 0, cpNickname);

            const novel = {
                id: Utils.generateId(),
                title: result.title || '（自動生成）',
                author: result.author || this.generatePenName(),
                author_npc_id: pickedNpc ? pickedNpc.id : null,  // v2.70.0 关联推特 fanFriend
                tags: filteredTags,
                coverGradient: this.generateCoverGradient(),
                writingStyleId: selectedStyle ? selectedStyle.id : null,
                chapters: [{
                    id: Utils.generateId(),
                    chapterNum: 1,
                    title: result.title || '',
                    content,
                    plotProgressId: null,
                    wordCount,
                    createdAt: Date.now()
                }],
                isSerial: false,
                hearts: 0,   // 档C：随后 _initNovelPopularity 统一 roll（最高章缓存）
                timestamp: Date.now(),
                updatedAt: Date.now(),
                createdAt: Date.now()  // v2.70.0 显式 createdAt（推特延迟 mention 用 3 天窗口）
            };
            this._initNovelPopularity(novel, AppState.data.twitterData);

            AppState.data.pixivData.novels.unshift(novel);
            this._recordNovelAngle(novel);
            Utils.saveData();
            // 如果用户正好在 Pixiv 小说页面，刷新列表
            const pixivScreen = document.getElementById('pixiv-novel');
            if (pixivScreen && pixivScreen.classList.contains('active')) {
                this.renderTagBar();
                this.renderNovelList();
            }
            Utils.showToast(I18n.t('t.pixiv_auto_generated', '✓ 同人小说已自动生成'));
        } catch (e) {
            console.warn('[AutoGen] Novel generation failed:', e.message);
            // 静默失败，不打扰用户
        }
    },

    // ===== v2.122.0 链路B：从推特自宣推懒生成对应小说（点击时现场生成）=====
    // 入参：推文对象（authorName / authorHandle / content / id）
    // 返回：成功 → 新 novel.id 字符串；失败 → null（不向外 throw）
    async generateFromTweet(tweet) {
        try {
            if (!tweet || !tweet.content || !String(tweet.content).trim()) return null;

            const worldContext = this.getNovelContext();
            if (!worldContext.trim()) return null; // 没有世界观就跳过

            const settings = AppState.data.pixivData.settings;
            const cpInfo = Broadcast.getCP();
            const cp = cpInfo.cp;
            const cpNickname = cpInfo.cpNickname;
            const hasCP = cpInfo.hasCP;
            const langInstruction = this.getLanguageInstruction();

            // === 作者命中：用 authorHandle 在 fanFriends 里找匹配的 doujin_writer ===
            const fanFriends = (AppState.data.twitterData && AppState.data.twitterData.fanFriends) || [];
            const handle = tweet.authorHandle;
            let pickedNpc = fanFriends.find(f => f.type === 'doujin_writer' && (f.handle === handle || f.pixivHandle === handle)) || null;
            let npcStyle = (pickedNpc && pickedNpc.writingStyleId)
                ? (settings.writingStyles || []).find(s => s.id === pickedNpc.writingStyleId) || null
                : null;

            const selectedStyle = npcStyle || this.getRandomWritingStyle();
            const styleInstruction = selectedStyle
                ? `\n【文风要求 Writing Style】\n${selectedStyle.rules}\n`
                : '';

            // NPC 作者身份段（仅当 pickedNpc 非空）
            const npcInstruction = pickedNpc
                ? `\n【作者身份 Author Identity】\n你是同人作家 ${pickedNpc.name}（${pickedNpc.handle}）。${pickedNpc.bio || ''}${pickedNpc.contentTags && pickedNpc.contentTags.length > 0 ? `\n你偏好的创作主题：${pickedNpc.contentTags.join('、')}。本作请围绕这些主题或相关方向展开（如果与当前剧情匹配）。` : ''}\n`
                : '';

            // 视角指令（读取上次保存的设置，默认第三人称）
            const autoPerspective = settings.perspective || 'third';
            const autoFocusChar = settings.focusChar || '';
            let autoPerspectiveInstruction = '';
            if (autoPerspective === 'third') {
                autoPerspectiveInstruction = `\n【视角要求 — 绝对禁止违反】\n必须严格使用第三人称（三人称）叙事。绝对禁止在叙事中使用第一人称代词（I/私/俺/僕/あたし 等）。角色内心独白/心理描写必须用全角括号（）包裹以区分客观叙述。`;
                if (autoFocusChar) {
                    autoPerspectiveInstruction += `\n焦点角色限制：全程跟随【${autoFocusChar}】的视角（三人称限制视角），不得脱离该角色，不得写其他角色的内心想法。`;
                }
            } else if (autoPerspective === 'first') {
                autoPerspectiveInstruction = `\n【视角要求】请使用第一人称（一人称）视角写作。\n`;
            } else if (autoPerspective === 'second') {
                autoPerspectiveInstruction = `\n【视角要求】请使用第二人称视角，以"你"为主角写作。\n`;
            }

            // === 种子段（核心）：把推文正文当「梗」放进最优先位置 ===
            const seedAuthorName = tweet.authorName || (handle || '').replace(/^@/, '') || '同人作家';
            const seedHandle = handle || '';
            const tweetSeedInstruction = `\n【このツイートで予告された作品を実際に書き起こす — 最優先】\n同人作家「${seedAuthorName}」（${seedHandle}）は X(Twitter) でこうツイートした：\n「${String(tweet.content).trim()}」\nこのツイートで言及・予告されている作品（CP・シチュエーション・ネタ・キャラの関係性）を、忠実に実際の小説本文として書き起こすこと。ツイートのネタと矛盾しないこと。ツイートに書かれた具体的な要素（例：特定のシーン、設定、キャラの状態）は必ず本文に反映すること。ツイート内の #ハッシュタグ や @メンション はノイズとして無視せず、作者の意図として汲み取ること。\n`;

            const systemPrompt = `你是一位优秀的Pixiv同人小说作者。
你的任务是基于提供的【原作世界观】、【原作剧情时间线】和【世界书设定】，并且严格依照下面这条推特预告的内容，创作一篇高质量的同人小说。

【内容安全指引 - 虚构文学与剧情张力】
你的创作属于虚构的战斗/冒险/剧情类ACG题材。在正常的文学创作中，角色在战斗中遭遇重创、流血、陷入绝境或面临危机，是塑造角色精神成长（Character Arc）和剧情张力（Dramatic Tension）的必要艺术手法。

重要原则：
1. **尊重原作事实**：提供的"原作剧情时间线"是绝对发生的正史。
2. **角色还原**：请参考"世界书"中的角色设定，保持人物性格（OOC禁止），还原人物说话方式。
${tweetSeedInstruction}
${worldContext}
${styleInstruction}
${langInstruction}
${npcInstruction}
${autoPerspectiveInstruction}
创作方向：
- 这是一篇${hasCP ? `以${cp}${cpNickname ? `（${cpNickname}）` : ''}为CP的同人` : '同人'}短篇小说
- **必须严格按照上面那条推特预告的内容来写**，把推文里预告的作品忠实地写成完整正文，不要另起炉灶写无关的角度
- 保持角色性格一致，情节贴合推文预告

具体要求：
- 标题形式必须多样化。在以下格式中选择最贴合推文预告的一种：①极短意象型「溶ける春」「君の声」②情景描写型「深夜の台所で」「雨の帰り道」③角色视点型「○○の知らない△△」④诗性反転型「三度死んで、また会おう」⑤心理内省型「伝わらない想いの果てに」。绝对禁止”同人小说””第一话””日常”等敷衍通用标题。
- 写出1500-2500字短篇小说，完整结局
- 细腻心理描写和对话

绝对禁止的tags：
- 不要生成任何包含「梦」「夢」「梦小说」「夢主」「梦向」的标签
- 不要生成「原创角色」「OC」「自创」等标签

请严格使用以下标签格式输出小说，不要使用JSON：
<TITLE>标题 (纯日文格式文本，绝对不要包含翻译标签)</TITLE>
<TAGS>作品, CP, 角色, 主题 (纯文本，不要包含翻译标签)</TAGS>
<AUTHOR>日式网名</AUTHOR>
<CONTENT>
小说正文内容...
请直接开始正文，千万不要在正文开头重复标题！
</CONTENT>`;

            const messages = [{ role: 'user', content: '请根据以上设定和推特预告，把这条推预告的作品写成完整短篇。' }];
            const _overrideCfg = AppState.data.pixivData?.settings?.apiOverride;
            const response = await Utils.callChatAPI(messages, systemPrompt, _overrideCfg?.enabled ? _overrideCfg : null);

            let result = {};
            const extractTag = (tag) => {
                const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
                const match = response.match(regex);
                return match ? match[1].trim() : '';
            };
            const stripHtml = (text) => text.replace(/<details[^>]*>[\s\S]*?<\/details>/gi, '').replace(/<[^>]*>/g, '').trim();

            result.title = stripHtml(extractTag('TITLE'));
            const rawTags = stripHtml(extractTag('TAGS'));
            result.tags = rawTags ? rawTags.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];
            result.author = extractTag('AUTHOR');
            result.content = extractTag('CONTENT');

            if (!result.content) return null; // 解析失败 → null

            // 作者覆盖：命中 NPC 用其日文笔名（name = 推特显示名，作者要的）；handle 仅作兜底
            if (pickedNpc) {
                result.author = pickedNpc.name || (pickedNpc.pixivHandle || pickedNpc.handle || '').replace(/^@+/, '');
            } else {
                result.author = tweet.authorName || (handle || '').replace(/^@/, '') || this.generatePenName();
            }

            const content = result.content;
            const wordCount = content.replace(/<[^>]*>/g, '').length;

            const dreamNovelKeywords = ['梦', '夢', '梦小说', '夢主', '梦向', '原创角色', 'OC', '自创', '梦女主', '女主'];
            let filteredTags = (result.tags || []).filter(tag =>
                !dreamNovelKeywords.some(kw => tag.includes(kw))
            );
            if (hasCP && !filteredTags.some(t => t.includes(cp))) filteredTags.unshift(cp);
            if (cpNickname && !filteredTags.some(t => t.includes(cpNickname))) filteredTags.splice(1, 0, cpNickname);

            const novel = {
                id: Utils.generateId(),
                title: result.title || '（自動生成）',
                author: result.author || this.generatePenName(),
                author_npc_id: pickedNpc ? pickedNpc.id : null,
                fromTweetId: tweet.id,  // v2.122.0 链路B：标记来源推文
                tags: filteredTags,
                coverGradient: this.generateCoverGradient(),
                writingStyleId: selectedStyle ? selectedStyle.id : null,
                chapters: [{
                    id: Utils.generateId(),
                    chapterNum: 1,
                    title: result.title || '',
                    content,
                    plotProgressId: null,
                    wordCount,
                    createdAt: Date.now()
                }],
                isSerial: false,
                hearts: 0,   // 档C：随后 _initNovelPopularity 统一 roll（最高章缓存）
                timestamp: Date.now(),
                updatedAt: Date.now(),
                createdAt: Date.now()
            };
            this._initNovelPopularity(novel, AppState.data.twitterData);

            AppState.data.pixivData.novels.unshift(novel);
            this._recordNovelAngle(novel);
            Utils.saveData();
            // 如果用户正好在 Pixiv 小说页面，刷新列表
            const pixivScreen = document.getElementById('pixiv-novel');
            if (pixivScreen && pixivScreen.classList.contains('active')) {
                this.renderTagBar();
                this.renderNovelList();
            }

            return novel.id;
        } catch (e) {
            console.warn('[GenFromTweet]', e);
            return null;
        }
    },

    // ===== v2.70.0 NPC 作者权重选择 =====
    _pickWriterWeighted(writers) {
        if (!writers || writers.length === 0) return null;

        // 收集当前剧情/CP 的 tags 用于匹配
        const cpInfo = (typeof Broadcast !== 'undefined' && Broadcast.getCP) ? Broadcast.getCP() : {};
        const currentTags = [];
        if (cpInfo.cp) currentTags.push(cpInfo.cp);
        if (cpInfo.cpNickname) currentTags.push(cpInfo.cpNickname);
        if (cpInfo.cpCharA) currentTags.push(cpInfo.cpCharA);
        if (cpInfo.cpCharB) currentTags.push(cpInfo.cpCharB);
        // 最近 5 篇剧情的 title 关键词也加入
        const recentPlots = (AppState.data.broadcast?.plotProgress || []).slice(-5);
        recentPlots.forEach(p => {
            if (p.title) currentTags.push(p.title);
        });

        // 找出最近被 pick 过的 NPC（用于 least-recently-picked bonus）
        const recentlyPicked = new Set(
            ((AppState.data.pixivData?.novels || []).slice(0, 5))  // unshift 在头部、最近 5 篇是 [0..4]
                .map(n => n.author_npc_id)
                .filter(Boolean)
        );

        // 计算权重
        const weighted = writers.map(w => {
            const tagMatches = (w.contentTags || []).filter(tag =>
                currentTags.some(ct => ct && (String(ct).includes(tag) || tag.includes(String(ct))))
            ).length;
            const lrpBonus = recentlyPicked.has(w.id) ? 0 : 0.5;
            const weight = 1 + tagMatches + lrpBonus;
            return { writer: w, weight };
        });

        // 权重随机
        const totalWeight = weighted.reduce((s, x) => s + x.weight, 0);
        let rand = Math.random() * totalWeight;
        for (const item of weighted) {
            rand -= item.weight;
            if (rand <= 0) return item.writer;
        }
        return weighted[weighted.length - 1].writer;  // fallback
    },

    // ===== 分享到揭示板 =====
    shareToForum(novelId) {
        const data = AppState.data.pixivData;
        const novel = (data.novels || []).find(n => n.id === (novelId || this.currentNovelId));
        if (!novel) return;

        const forumData = AppState.data.forumData;
        if (!forumData.threads) forumData.threads = [];

        const chapter = novel.chapters[this.currentChapterIdx || 0];
        // 去除翻译标签，但保留换行
        let content = chapter?.content || '';
        // 将<br>标签转换为换行符
        content = content.replace(/<br\s*\/?>/gi, '\n');
        // 移除所有 details 标签及其内容（翻译）
        content = content.replace(/<details[^>]*>[\s\S]*?<\/details>/gi, '');
        // 移除其他HTML标签
        content = content.replace(/<[^>]+>/g, '');
        // 清理多余的连续空格，但保留换行符
        content = content.replace(/ +/g, ' '); // 多个空格变单个空格
        content = content.replace(/\n +/g, '\n'); // 行首空格去除
        content = content.replace(/ +\n/g, '\n'); // 行尾空格去除
        content = content.trim();
        const preview = content.substring(0, 500);

        forumData.threads.unshift({
            id: Utils.generateId(),
            title: `【SS】${this.stripHtml(novel.title)} `,
            content: `${preview}...\n\n-- -\nTags: ${(novel.tags || []).join(', ')} \nAuthor: ${novel.author || '匿名'} `,
            author: novel.author || '名無しさん',
            authorId: Forum.generateAnonId ? Forum.generateAnonId() : this.randomId(),
            timestamp: Date.now(),
            threadType: 'fanfic',
            replies: [],
            isUserThread: false,
            novelId: novel.id
        });

        Utils.saveData();
        Utils.showToast(I18n.t('pixiv.shared_to_forum', '✓ 已分享到揭示板'));
    },

    // ===== 智能删除：连载第2章及以后=删本章，其余=删作品 =====
    deleteNovelOrChapter(novelId) {
        const data = AppState.data.pixivData;
        const novel = (data.novels || []).find(n => n.id === novelId);
        if (!novel) return;
        if (novel.isSerial && this.currentChapterIdx > 0) {
            this.deleteChapter(novelId, this.currentChapterIdx);
        } else {
            this.deleteNovel(novelId);
        }
    },

    // ===== 删除小说 =====
    deleteNovel(novelId) {
        if (!confirm(I18n.t('pixiv.confirm_delete', '确定要删除这篇小说吗？'))) return;

        const data = AppState.data.pixivData;
        data.novels = (data.novels || []).filter(n => n.id !== novelId);
        data.favorites = (data.favorites || []).filter(id => id !== novelId);
        Utils.saveData();

        Navigation.goTo('pixiv-novel');
        Utils.showToast(I18n.t('pixiv.deleted', '已删除'));
    },

    // ===== 文风预设UI管理 =====
    renderStylePresets() {
        const settings = AppState.data.pixivData.settings;
        const styles = settings.writingStyles || [];
        const container = document.getElementById('pixivStylePresetsList');

        if (!container) return; // 如果容器不存在，跳过渲染

        if (styles.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-text">${I18n.t('pixiv.empty_no_styles', '暂无文风预设')}</div></div>`;
            return;
        }

        const _esc = s => Utils.escapeHtml(s || '');
        container.innerHTML = styles.map(style => `
            <div class="pixiv-style-preset ${style.enabled ? '' : 'disabled'}" data-style-id="${style.id}">
                <div class="preset-header">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex: 1;">
                        <input type="checkbox"
                               ${style.enabled ? 'checked' : ''}
                               onchange="PixivNovel.toggleStyleEnabled('${style.id}')"
                               style="width: auto;">
                        <strong style="font-size: 14px;">${_esc(style.name)}</strong>
                    </label>
                    <div class="preset-actions" style="display: flex; gap: 6px;">
                        <button onclick="PixivNovel.editStyle('${style.id}')"
                                class="glass-btn mini" style="margin: 0;">${I18n.t('btn.edit', '编辑')}</button>
                        <button onclick="PixivNovel.deleteStyle('${style.id}')"
                                class="glass-btn mini danger" style="margin: 0;">${I18n.t('btn.delete', '删除')}</button>
                    </div>
                </div>
                <p class="preset-desc" style="font-size: 13px; color: #666; margin: 5px 0 5px 24px;">${_esc(style.description)}</p>
                <details style="margin-left: 24px; margin-top: 5px;">
                    <summary style="font-size: 12px; color: #999; cursor: pointer;">${I18n.t('pixiv.view_rules', '查看规则')}</summary>
                    <pre style="font-size: 12px; color: #666; margin: 5px 0; white-space: pre-wrap; line-height: 1.4;">${_esc(style.rules)}</pre>
                </details>
            </div>
        `).join('');
    },

    showAddStyleModal() {
        const modal = document.getElementById('pixivStyleModal');
        if (!modal) return;

        document.getElementById('pixivStyleModalTitle').textContent = I18n.t('pixiv.add_style_h3', '添加文风预设');
        document.getElementById('pixivStyleName').value = '';
        document.getElementById('pixivStyleDesc').value = '';
        document.getElementById('pixivStyleRules').value = '';

        this.editingStyleId = null;
        modal.classList.add('active');
    },

    editStyle(styleId) {
        const settings = AppState.data.pixivData.settings;
        const style = settings.writingStyles.find(s => s.id === styleId);
        if (!style) return;

        const modal = document.getElementById('pixivStyleModal');
        if (!modal) return;

        document.getElementById('pixivStyleModalTitle').textContent = I18n.t('pixiv.edit_style_h3', '编辑文风预设');
        document.getElementById('pixivStyleName').value = style.name;
        document.getElementById('pixivStyleDesc').value = style.description || '';
        document.getElementById('pixivStyleRules').value = style.rules;

        this.editingStyleId = styleId;
        modal.classList.add('active');
    },

    saveStyle() {
        const name = document.getElementById('pixivStyleName').value.trim();
        const description = document.getElementById('pixivStyleDesc').value.trim();
        const rules = document.getElementById('pixivStyleRules').value.trim();

        if (!name || !rules) {
            Utils.showToast(I18n.t('t.pixiv_style_required', '请填写名称和规则'));
            return;
        }

        const settings = AppState.data.pixivData.settings;
        if (!settings.writingStyles) settings.writingStyles = [];

        if (this.editingStyleId) {
            // 编辑现有预设
            const style = settings.writingStyles.find(s => s.id === this.editingStyleId);
            if (style) {
                style.name = name;
                style.description = description;
                style.rules = rules;
            }
        } else {
            // 添加新预设
            settings.writingStyles.push({
                id: Utils.generateId(),
                name,
                description,
                rules,
                enabled: true
            });
        }

        Utils.saveData();
        this.renderStylePresets();
        document.getElementById('pixivStyleModal').classList.remove('active');
        Utils.showToast(this.editingStyleId ? I18n.t('t.pixiv_style_updated', '✓ 文风预设已更新') : I18n.t('t.pixiv_style_added', '✓ 文风预设已添加'));
    },

    deleteStyle(styleId) {
        if (!confirm(I18n.t('pixiv.confirm_delete_style', '确定要删除这个文风预设吗？'))) return;

        const settings = AppState.data.pixivData.settings;
        settings.writingStyles = settings.writingStyles.filter(s => s.id !== styleId);

        Utils.saveData();
        this.renderStylePresets();
        Utils.showToast(I18n.t('t.pixiv_style_deleted', '✓ 文风预设已删除'));
    },

    toggleStyleEnabled(styleId) {
        const settings = AppState.data.pixivData.settings;
        const style = settings.writingStyles.find(s => s.id === styleId);
        if (style) {
            style.enabled = !style.enabled;
            Utils.saveData();
            this.renderStylePresets();
        }
    },

    // ===== 随机创意角度生成器 =====
    _getRandomCreativeAngles() {
        const angles = [
            "Slice of Life / Fluff: A cozy, everyday interaction focusing on a small, heartwarming detail or mild friction between them.",
            "Outsider's POV: The story is told through the eyes of a friend, subordinate, or enemy, observing how the main character has changed because of their partner.",
            "Memory/Prequel vibes: Reminiscing about their individual loneliness before they met, or the subtle signs of their destined intersection.",
            "External Crisis: Their silent, undeniable synergy when facing a sudden minor crisis or external challenge together.",
            "Introspective/Monologue: Deep dive into the character's internal thoughts, exploring the contradiction between their outer strength and inner vulnerability.",
            "Enemy's Evaluation: How the opposing faction views this pair's bond and power, told with tension and respect.",
            "Seasonal/Festive: Using a specific season, weather (rain, snow), or festival as the emotional catalyst for their interaction.",
            "Role Reversal/Vulnerability: The traditionally stronger or dominant partner suddenly showing a moment of extreme vulnerability, exhaustion, or dependency.",
            "Epistolary format: The story presented through diary entries, mission reports, or unsent letters."
        ];
        // 随机打乱数组
        for (let i = angles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [angles[i], angles[j]] = [angles[j], angles[i]];
        }
        return [angles[0], angles[1]];
    },

    // ===== 设置页 =====
    loadSettingsUI() { // Renamed from initSettings to loadSettingsUI
        const settings = AppState.data.pixivData.settings;

        // v2.69.0: CP 字段已迁移到放送局（Broadcast.getCP），此处不再读取/填充
        document.getElementById('pixivForumLinked').checked = settings.forumLinked !== false;
        const autoGenEl = document.getElementById('pixivAutoGenOnNewPlot');
        if (autoGenEl) autoGenEl.checked = settings.autoGenOnNewPlot === true;
        const autoGenCountEl = document.getElementById('pixivAutoGenCount');
        if (autoGenCountEl) autoGenCountEl.value = settings.autoGenCount || 1;
        document.getElementById('pixivCustomPrompt').value = settings.customPrompt || '';
        document.getElementById('pixivNovelRules').value = settings.novelRules || '';
        document.getElementById('pixivNovelLanguage').value = settings.language || 'jp-cn';

        // 独立 API 配置
        const override = settings.apiOverride || {};
        const overrideEnabledEl = document.getElementById('pixivApiOverrideEnabled');
        if (overrideEnabledEl) {
            overrideEnabledEl.checked = override.enabled === true;
            const overrideFields = document.getElementById('pixivApiOverrideFields');
            if (overrideFields) overrideFields.style.display = override.enabled ? '' : 'none';
            overrideEnabledEl.onchange = (e) => {
                if (overrideFields) overrideFields.style.display = e.target.checked ? '' : 'none';
            };
            const urlEl = document.getElementById('pixivApiOverrideUrl');
            const keyEl = document.getElementById('pixivApiOverrideKey');
            const modelEl = document.getElementById('pixivApiOverrideModel');
            if (urlEl) urlEl.value = override.baseUrl || '';
            if (keyEl) keyEl.value = override.apiKey || '';
            if (modelEl) modelEl.value = override.model || '';
            // 绑定 Fetch 按钮
            const fetchBtn = document.getElementById('pixivOverrideFetchBtn');
            if (fetchBtn) fetchBtn.onclick = () => this.fetchPixivOverrideModels();
            // 绑定 select 下拉选择同步到输入框
            const overrideSelect = document.getElementById('pixivOverrideModelSelect');
            if (overrideSelect && modelEl) {
                overrideSelect.onchange = () => { modelEl.value = overrideSelect.value; };
            }
        }

        // 字体大小滑块
        const fontSize = settings.fontSize || 16;
        const slider = document.getElementById('pixivFontSize');
        const label = document.getElementById('pixivFontSizeLabel');
        if (slider) {
            slider.value = fontSize;
            slider.oninput = () => {
                if (label) label.textContent = I18n.t('pixiv.font_size_label', {n: slider.value});
                this.applyFontSize(parseInt(slider.value));
            };
        }
        if (label) label.textContent = I18n.t('pixiv.font_size_label', {n: fontSize});

        this.toggleForumLink(settings.forumLinked !== false);
        this.renderWorldBookCheckboxes();
        this.renderStylePresets(); // 渲染文风预设列表
    },

    toggleForumLink(linked) {
        document.getElementById('pixivExtraWorldBookRow').style.display = linked ? 'flex' : 'none';
        document.getElementById('pixivCustomPromptCard').style.display = linked ? 'none' : 'block';
    },

    toggleTextSettings() {
        // 循环切换字体：小(13) → 标准(16) → 大(18) → 小
        const settings = AppState.data.pixivData.settings;
        const cur = settings.fontSize || 16;
        const next = cur <= 13 ? 16 : cur <= 16 ? 18 : 13;
        settings.fontSize = next;
        Utils.saveData();
        this.applyFontSize(next);
        Utils.showToast(I18n.t('t.pixiv_font_size', {n: next}));
    },

    applyFontSize(size) {
        document.documentElement.style.setProperty('--pixiv-font-size', `${size}px`);
    },

    renderWorldBookCheckboxes() {
        const container = document.getElementById('pixivExtraWorldBooks');
        const books = AppState.data.worldBooks || [];
        const selected = AppState.data.pixivData.settings.additionalWorldBookIds || [];
        // 排除放送局已绑定的世界书（全部，不只是第一个）
        const broadcastBookIds = new Set(Utils.getActiveWorldBookIds());

        if (books.length === 0) {
            container.innerHTML = `<p style="font-size:12px; color:#999;">${I18n.t('pixiv.no_worldbooks', '暂无世界书')}</p>`;
            return;
        }

        container.innerHTML = books.map(b => {
            const isForumBook = broadcastBookIds.has(b.id);
            return `<label style="display:flex; align-items:center; gap:8px; padding:4px 0; font-size:13px;">
    <input type="checkbox" class="pixiv-wb-check" data-wbid="${b.id}"
        ${selected.includes(b.id) ? 'checked' : ''} style="width:auto;">
        <span>${b.name}${isForumBook ? ` ${I18n.t('pixiv.forum_bound_tag', '(揭示板已绑定)')}` : ''}</span>
    </label>`;
        }).join('');
    },

    saveSettings() {
        const settings = AppState.data.pixivData.settings;

        // v2.69.0: CP 字段已迁移到放送局（Broadcast.getCP），此处不再保存
        settings.forumLinked = document.getElementById('pixivForumLinked').checked;
        const autoGenEl2 = document.getElementById('pixivAutoGenOnNewPlot');
        if (autoGenEl2) settings.autoGenOnNewPlot = autoGenEl2.checked;
        const autoGenCountEl2 = document.getElementById('pixivAutoGenCount');
        if (autoGenCountEl2) settings.autoGenCount = Math.max(1, Math.min(5, parseInt(autoGenCountEl2.value) || 1));
        settings.customPrompt = document.getElementById('pixivCustomPrompt').value.trim();
        settings.novelRules = document.getElementById('pixivNovelRules').value.trim();
        settings.language = document.getElementById('pixivNovelLanguage').value;

        // 独立 API 配置
        const overrideEnabledEl2 = document.getElementById('pixivApiOverrideEnabled');
        if (overrideEnabledEl2) {
            settings.apiOverride = {
                enabled: overrideEnabledEl2.checked,
                baseUrl: document.getElementById('pixivApiOverrideUrl')?.value.trim() || '',
                apiKey: document.getElementById('pixivApiOverrideKey')?.value.trim() || '',
                model: document.getElementById('pixivApiOverrideModel')?.value.trim() || ''
            };
        }

        // 字体大小
        const slider = document.getElementById('pixivFontSize');
        if (slider) {
            settings.fontSize = parseInt(slider.value) || 16;
            this.applyFontSize(settings.fontSize);
        }

        // 收集额外世界书
        settings.additionalWorldBookIds = [];
        document.querySelectorAll('.pixiv-wb-check:checked').forEach(cb => {
            settings.additionalWorldBookIds.push(cb.dataset.wbid);
        });

        Utils.saveData();
        Utils.showToast(I18n.t('pixiv.settings_saved', '✓ 设置已保存')); // Reverted to original I18n.t call
    },

    // 拉取独立 API 模型列表
    async fetchPixivOverrideModels() {
        let url = (document.getElementById('pixivApiOverrideUrl')?.value || '').trim();
        const key = (document.getElementById('pixivApiOverrideKey')?.value || '').trim();
        const modelEl = document.getElementById('pixivApiOverrideModel');
        const select = document.getElementById('pixivOverrideModelSelect');
        const btn = document.getElementById('pixivOverrideFetchBtn');

        if (!url) return alert(I18n.t('pixiv.alert_need_url', '请先输入 API 地址'));
        if (!key) return alert(I18n.t('pixiv.alert_need_key', '请先输入 API Key'));

        while (url.endsWith('/')) url = url.slice(0, -1);
        url = url.replace(/\/(chat\/)?completions?$/i, '');

        const currentModel = modelEl?.value || '';
        btn.textContent = I18n.t('pixiv.btn_fetching', '⏳');
        btn.disabled = true;

        let models = [];
        let correctBaseUrl = '';
        let lastError = null;

        const endpointsToTry = [
            { url: `${url}/v1/models`, base: `${url}/v1` },
            { url: `${url}/models`, base: url },
            { url: `${url.replace(/\/v1$/, '')}/v1/models`, base: `${url.replace(/\/v1$/, '')}/v1` },
            { url: `${url}/api/v1/models`, base: `${url}/api/v1` }
        ];

        for (const ep of endpointsToTry) {
            try {
                const res = await fetch(ep.url, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.data && Array.isArray(data.data)) {
                        models = data.data.map(m => typeof m === 'string' ? m : m.id).filter(Boolean);
                        correctBaseUrl = ep.base;
                        break;
                    }
                } else { lastError = `HTTP ${res.status}`; }
            } catch (e) { lastError = e.message; }
        }

        btn.textContent = I18n.t('pixiv.btn_fetch', 'Fetch');
        btn.disabled = false;

        if (models.length > 0) {
            models.sort();
            select.innerHTML = '';
            models.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m; opt.textContent = m;
                select.appendChild(opt);
            });
            // 恢复之前的选择
            if (currentModel && models.includes(currentModel)) {
                select.value = currentModel;
            } else {
                select.value = models[0];
                if (modelEl) modelEl.value = models[0];
            }
            // 自动回填 URL（如找到更精确的 base）
            if (correctBaseUrl) {
                const urlEl = document.getElementById('pixivApiOverrideUrl');
                if (urlEl) urlEl.value = correctBaseUrl;
            }
            Utils.showToast(I18n.t('t.pixiv_models_fetched', {n: models.length}));
        } else {
            alert(I18n.t('pixiv.alert_fetch_failed', {err: lastError ? '\n' + lastError : ''}));
        }
    },

    // ===== 辅助方法 =====
    generateCoverGradient() {
        const gradients = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
            'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
            'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
            'linear-gradient(135deg, #f5576c 0%, #ff6a88 100%)',
            'linear-gradient(135deg, #667eea 0%, #43e97b 100%)',
            'linear-gradient(135deg, #c471f5 0%, #fa71cd 100%)',
            'linear-gradient(135deg, #48c6ef 0%, #6f86d6 100%)',
        ];
        return gradients[Math.floor(Math.random() * gradients.length)];
    },

    generatePenName() {
        // 组合式生成：前缀+后缀，产生大量不重复的名字
        const patterns = [
            // 模式1: 食物/甜品风
            () => {
                const a = ['りんご', 'みかん', 'いちご', 'もも', 'ぶどう', 'レモン', 'メロン', 'すいか', 'バナナ', 'キウイ', 'さくらんぼ', 'マンゴー', 'パイン', 'ゆず', 'あんず', 'かき'];
                const b = ['飴', '餅', 'ジャム', 'タルト', 'パフェ', 'ゼリー', 'ケーキ', 'プリン', 'シロップ', 'ソーダ', 'あめ', 'だんご'];
                return a[Math.floor(Math.random() * a.length)] + b[Math.floor(Math.random() * b.length)];
            },
            // 模式2: 自然+时间风
            () => {
                const a = ['月', '星', '雪', '雨', '風', '空', '海', '森', '花', '霧', '虹', '霞', '朝', '夕', '夜', '春', '夏', '秋', '冬', '雷', '露', '氷', '炎', '影'];
                const b = ['のしずく', 'うさぎ', 'ねこ', 'のこども', 'あかり', 'かぜ', 'つき', 'ほたる', 'とんぼ', 'ひかり', 'のうた', 'まつり', 'さんぽ', 'だより', 'もよう', 'がたり', 'わたり'];
                return a[Math.floor(Math.random() * a.length)] + b[Math.floor(Math.random() * b.length)];
            },
            // 模式3: 动物+修饰风
            () => {
                const a = ['ねこ', 'いぬ', 'うさぎ', 'きつね', 'たぬき', 'くま', 'ペンギン', 'ハムスター', 'カピバラ', 'パンダ', 'あひる', 'ふくろう', 'コアラ', 'リス', 'シカ', 'カメ'];
                const b = ['まんじゅう', 'のおやつ', 'せんせい', 'のひるね', 'まるまる', 'ぱんち', 'のて', 'ぐるみ', 'カフェ', 'ラボ', 'のきもち', 'ごはん', 'べんとう'];
                return a[Math.floor(Math.random() * a.length)] + b[Math.floor(Math.random() * b.length)];
            },
            // 模式4: 饮品风
            () => {
                const a = ['抹茶', 'ミルク', 'ココア', 'カフェ', 'ほうじ茶', '紅茶', '緑茶', 'チャイ', 'ジャスミン', 'カモミール', 'ラベンダー', 'ローズ', 'ハニー', 'バニラ'];
                const b = ['ラテ', 'オレ', 'ティー', 'ミルク', 'フロート', 'スムージー', 'ソーダ', 'モカ', 'シェイク'];
                return a[Math.floor(Math.random() * a.length)] + b[Math.floor(Math.random() * b.length)];
            },
            // 模式5: 纯假名昵称风
            () => {
                const names = [
                    'こんぺいとう', 'しゃぼんだま', 'たんぽぽ', 'ひまわり', 'なでしこ',
                    'あじさい', 'すみれ', 'つくし', 'わたがし', 'かざぐるま',
                    'シャボン', 'クローバー', 'マーガレット', 'カーネーション', 'ミモザ',
                    'ラナンキュラス', 'アネモネ', 'ダリア', 'コスモス', 'カンナ',
                    'まんまるもち', 'ふわふわ雲', 'きらきら星', 'ぽかぽか日和',
                    'そよかぜ', 'こもれび', 'ゆうやけ', 'あまぐも', 'にじいろ',
                    'しろつめくさ', 'おひさま', 'ゆめみるひつじ'
                ];
                return names[Math.floor(Math.random() * names.length)];
            },
            // 模式6: 数字/英文混合风（pixiv常见）
            () => {
                const a = ['noir', 'blanc', 'rouge', 'azure', 'stella', 'luna', 'sol', 'miel', 'ciel', 'fleur', 'nuit', 'aube', 'pluie', 'neige', 'reve', 'ange', 'fée'];
                const b = ['_' + Math.floor(Math.random() * 999), '@' + ['sky', 'moon', 'star', 'rain', 'snow', 'wind', 'sun', 'dream'][Math.floor(Math.random() * 8)], '', '.' + Math.floor(Math.random() * 99)];
                return a[Math.floor(Math.random() * a.length)] + b[Math.floor(Math.random() * b.length)];
            },
            // 模式7: 和风名字风
            () => {
                const a = ['桜', '椿', '藤', '楓', '柊', '菫', '薊', '蓮', '梔子', '撫子', '桔梗', '葵', '萩', '杏', '柚', '梅', '桃'];
                const b = ['丸', 'まる', 'のもり', 'つかい', '野', '川', '山', '原', '庭', '園', '堂', '屋', '亭'];
                return a[Math.floor(Math.random() * a.length)] + b[Math.floor(Math.random() * b.length)];
            },
        ];
        const pattern = patterns[Math.floor(Math.random() * patterns.length)];
        return pattern();
    },

    randomId() {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let id = '';
        for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
        return id;
    },

    // ===== 近期角度去重（避免小说主题重复）=====
    _recordNovelAngle(novel) {
        const pixivData = AppState.data.pixivData;
        if (!pixivData.recentNovelAngles) pixivData.recentNovelAngles = [];
        const entry = {
            title: novel.title || '',
            tags: (novel.tags || []).slice(0, 6).join('、')
        };
        pixivData.recentNovelAngles.unshift(entry);
        // 只保留最近 6 篇
        if (pixivData.recentNovelAngles.length > 6) {
            pixivData.recentNovelAngles = pixivData.recentNovelAngles.slice(0, 6);
        }
        // 不单独 saveData，由调用方的 saveData 一起保存
    },

    _getRecentAnglesPrompt() {
        const angles = (AppState.data.pixivData.recentNovelAngles || []);
        if (angles.length === 0) return '';
        const list = angles.map((a, i) => `  ${i + 1}. 《${a.title}》（标签：${a.tags || '无'}）`).join('\n');
        return `\n⚠️ 近期已生成作品（主题角度和标题形式都必须与以下作品明显不同）：\n${list}\n`;
    },

    stripHtml(str) {
        return (str || '').replace(/<[^>]*>/g, '');
    },

    // 章节正文 → 纯日语正文：剥掉中文翻译折叠块和所有 HTML 标签
    // 用于把已有章节喂回 AI 时，避免中文译文污染日语生成
    _chapterPlainText(str) {
        return (str || '')
            .replace(/<details[^>]*>[\s\S]*?<\/details>/gi, '')
            .replace(/<[^>]*>/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    },

    // ===== 小说导出：TXT =====
    exportNovelText(novelId) {
        const data = AppState.data.pixivData;
        const novel = (data.novels || []).find(n => n.id === (novelId || this.currentNovelId));
        if (!novel) return;

        const chapters = novel.chapters || [];
        const isSerial = novel.isSerial && chapters.length > 1;

        if (!isSerial) {
            return this._exportNovelTextSingle(novel);
        }
        // 长篇连载：弹 modal 让用户选「本章 / 整本」
        this._showExportChooseDialog(novel);
    },

    _showExportChooseDialog(novel) {
        const idx = this.currentChapterIdx || 0;
        const chapTitleRaw = novel.chapters[idx]?.title || I18n.t('pixiv.chapter_n', {n: idx + 1});
        const chapTitle = this.stripHtml(chapTitleRaw);
        const chapCount = (novel.chapters || []).length;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
        modal.onclick = e => { if (e.target === modal) modal.remove(); };
        modal.innerHTML = `
            <div class="modal-window" style="gap:10px;padding:20px;max-width:280px;width:85vw;display:flex;flex-direction:column">
                <h3 style="margin:0 0 4px;font-size:16px;font-weight:600">${I18n.t('pixiv.export_txt_title', '导出 TXT')}</h3>
                <button data-mode="single"
                        style="padding:12px 14px;border:1px solid var(--border-medium);border-radius:10px;background:var(--bg-base);color:var(--text-primary);font-size:14px;cursor:pointer;text-align:left">
                    <div style="font-weight:600;margin-bottom:3px">${I18n.t('pixiv.export_this_chapter', '本章')}</div>
                    <div style="font-size:12px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this.stripHtml(chapTitle)}</div>
                </button>
                <button data-mode="all"
                        style="padding:12px 14px;border:none;border-radius:10px;background:var(--accent-color);color:#fff;font-size:14px;cursor:pointer;text-align:left">
                    <div style="font-weight:600;margin-bottom:3px">${I18n.t('pixiv.export_full_book', '整本')}</div>
                    <div style="font-size:12px;opacity:0.85">${I18n.t('pixiv.export_n_chapters_merged', {n: chapCount})}</div>
                </button>
                <button data-mode="cancel"
                        style="margin-top:4px;padding:8px;border:1px solid var(--border-light);border-radius:8px;background:none;color:var(--text-secondary);font-size:13px;cursor:pointer">${I18n.t('btn.cancel', '取消')}</button>
            </div>`;
        const novelId = novel.id;
        modal.querySelectorAll('button[data-mode]').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                modal.remove();
                if (mode === 'cancel') return;
                const n = (AppState.data.pixivData.novels || []).find(x => x.id === novelId);
                if (!n) return;
                if (mode === 'single') this._exportNovelTextSingle(n);
                else if (mode === 'all') this._exportNovelTextAll(n);
            });
        });
        document.body.appendChild(modal);
    },

    _cleanChapterContent(raw) {
        let c = raw || '';
        c = c.replace(/<br\s*\/?>/gi, '\n');
        c = c.replace(/<details[^>]*>[\s\S]*?<\/details>/gi, '');
        c = c.replace(/<[^>]+>/g, '');
        c = c.replace(/\\n/g, '\n').trim();
        return c;
    },

    _exportNovelTextSingle(novel) {
        const chapter = novel.chapters[this.currentChapterIdx || 0];
        const content = this._cleanChapterContent(chapter?.content);
        const title = this.stripHtml(novel.title);
        const author = novel.author || I18n.t('pixiv.anonymous', '匿名');
        const tags = (novel.tags || []).join(' / ');
        const fullText = `${title}\n${I18n.t('pixiv.export_author_label', '作者')}：${author}\n${I18n.t('pixiv.export_tags_label', 'タグ')}：${tags}\n${'─'.repeat(40)}\n\n${content}`;
        this._downloadTxt(fullText, `${title.slice(0, 30)}.txt`);
    },

    _exportNovelTextAll(novel) {
        const title = this.stripHtml(novel.title);
        const sep = '\n\n' + '─'.repeat(40) + '\n\n';
        const parts = (novel.chapters || []).map((ch, idx) => {
            const chTitle = this.stripHtml(ch.title || I18n.t('pixiv.chapter_n', {n: idx + 1}));
            const body = this._cleanChapterContent(ch.content);
            return `${chTitle}\n\n${body}`;
        });
        const fullText = parts.join(sep);
        this._downloadTxt(fullText, `${title.slice(0, 30)}_${I18n.t('pixiv.export_full_book_suffix', '全集')}.txt`);
    },

    _downloadTxt(text, filename) {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        Utils.showToast(I18n.t('t.pixiv_txt_saved', '✓ 已保存为 TXT'));
    },

    // ===== 小说导出：长图 =====
    async exportNovelImage(novelId) {
        const data = AppState.data.pixivData;
        const novel = (data.novels || []).find(n => n.id === (novelId || this.currentNovelId));
        if (!novel) return;

        Utils.showToast(I18n.t('t.pixiv_img_generating', '生成图片中...'));

        if (!window.html2canvas) {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
                s.onload = resolve;
                s.onerror = () => reject(new Error(I18n.t('pixiv.html2canvas_load_failed', 'html2canvas 加载失败，请检查网络')));
                document.head.appendChild(s);
            }).catch(e => { Utils.showToast(e.message); throw e; });
        }

        const chapter = novel.chapters[this.currentChapterIdx || 0];
        let content = chapter?.content || '';
        content = content.replace(/<br\s*\/?>/gi, '\n');
        content = content.replace(/<details[^>]*>[\s\S]*?<\/details>/gi, '');
        content = content.replace(/<[^>]+>/g, '');
        content = content.replace(/\\n/g, '\n').trim();

        const title = this.stripHtml(novel.title);
        const author = novel.author || I18n.t('pixiv.anonymous', '匿名');
        const fontSize = (AppState.data.pixivData.settings?.fontSize || 16);

        const wrap = document.createElement('div');
        wrap.style.cssText = `position:fixed;left:-9999px;top:0;width:390px;background:#f5efe6;font-family:-apple-system,sans-serif;padding:0 0 32px 0;`;

        const header = document.createElement('div');
        header.style.cssText = `background:#c8a882;color:#fff;padding:20px 20px 16px;`;
        header.innerHTML = `<div style="font-size:18px;font-weight:700;margin-bottom:6px;">${title}</div><div style="font-size:13px;opacity:0.85;">${I18n.t('pixiv.export_author_label', '作者')}：${author}</div>`;
        wrap.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = `padding:20px 20px 0;font-size:${fontSize}px;line-height:1.8;color:#3d2b1f;white-space:pre-wrap;word-break:break-word;`;
        body.textContent = content;
        wrap.appendChild(body);

        document.body.appendChild(wrap);

        try {
            const canvas = await html2canvas(wrap, { scale: 2, useCORS: true, backgroundColor: '#f5efe6' });
            const url = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = url;
            const safeTitle = title.replace(/[^\w\u4e00-\u9fa5\u3040-\u30ff]/g, '_').slice(0, 30);
            a.download = `${safeTitle}.png`;
            a.click();
            Utils.showToast(I18n.t('t.pixiv_longimg_saved', '✓ 长图已保存'));
        } finally {
            document.body.removeChild(wrap);
        }
    },

    // ===== 完結機能 =====
    completeNovel(novelId) {
        const data = AppState.data.pixivData;
        const novel = (data.novels || []).find(n => n.id === novelId);
        if (!novel) return;
        // 误触防止：二次确认（あとから取り消せることも明示して安心させる）
        if (!confirm(I18n.t('pixiv.confirm_complete_novel', {title: this.stripHtml(novel.title || '')}))) return;
        novel.completed = true;
        novel.completedAt = Date.now();
        novel.updatedAt = Date.now();
        Utils.saveData();
        if (typeof Utils !== 'undefined' && Utils.emitEvent) {
            Utils.emitEvent('novel_completed', 'pixiv', { title: novel.title, summary: `全${novel.chapters.length}話` });
        }
        Utils.showToast(I18n.t('t.pixiv_completed', '🏁 完結しました！'));
        this.renderReader();
    },

    // ===== 完結取り消し（連載再開）=====
    uncompleteNovel(novelId) {
        const data = AppState.data.pixivData;
        const novel = (data.novels || []).find(n => n.id === novelId);
        if (!novel || !novel.completed) return;
        if (!confirm(I18n.t('pixiv.confirm_reopen_novel', {title: this.stripHtml(novel.title || '')}))) return;
        novel.completed = false;
        novel.completedAt = null;
        novel.updatedAt = Date.now();
        Utils.saveData();
        Utils.showToast(I18n.t('t.pixiv_serial_resumed', '連載を再開しました'));
        this.renderReader();
    },

    // ===== Pixiv→メロン書籍化 =====
    publishToMelonbooks(novelId) {
        const data = AppState.data.pixivData;
        const novel = (data.novels || []).find(n => n.id === novelId);
        if (!novel) return;
        if (typeof Melonbooks === 'undefined') { Utils.showToast(I18n.t('t.pixiv_melon_unavailable', 'メロンブックスが利用できません')); return; }

        const m = Melonbooks._ensureData();

        // 既に書籍化済みなら、その頒布ページへ移動（重複生成を防ぐ）
        if (novel.melonbooksProductId) {
            const existingProduct = (m.products || []).find(p => p.id === novel.melonbooksProductId);
            if (existingProduct) {
                Utils.showToast(I18n.t('t.pixiv_already_booked', '既にメロンブックスで書籍化されています'));
                Melonbooks.currentProductId = existingProduct.id;
                Navigation.goTo('melonbooks-detail');
                return;
            }
            // 紐付け先の商品が削除済み → リセットして再生成を許可
            novel.melonbooksProductId = null;
        }

        const totalWords = (novel.chapters || []).reduce((s, c) => s + (c.wordCount || 0), 0);
        const pageCount = Math.max(1, Math.round(totalWords / 800));

        const product = {
            id: Utils.generateId(),
            circleId: (m.circles || []).length > 0 ? m.circles[0].id : null,
            title: novel.title || '無題',
            type: 'novel',
            price: `¥${(Math.ceil(pageCount * 30 / 100) * 100)}`,
            pageCount: pageCount,
            size: 'A5',
            rating: 'all',
            tags: (novel.tags || []).slice(0, 5),
            sampleText: (novel.chapters[0]?.content || '').replace(/<[^>]*>/g, '').slice(0, 300),
            sampleTextTl: null,
            coverEmoji: '📖',
            isNew: true,
            status: 'on_sale',
            statusPlotId: null,
            eventId: null,
            pixivNovelId: novel.id,
            createdAt: Date.now()
        };
        m.products.push(product);
        novel.melonbooksProductId = product.id;
        Utils.saveData();
        if (typeof Utils !== 'undefined' && Utils.emitEvent) {
            Utils.emitEvent('doujin_published', 'melonbooks', { title: `書籍化「${novel.title}」`, summary: `全${novel.chapters.length}話・${totalWords.toLocaleString()}文字` });
        }
        Utils.showToast(I18n.t('t.pixiv_melon_registered', {title: novel.title}));
        Melonbooks.currentProductId = product.id;
        Navigation.goTo('melonbooks-detail');
    },

    // ===== メロン→Pixiv小説化 =====
    createFromProduct(productId) {
        if (typeof Melonbooks === 'undefined') return;
        const m = Melonbooks._ensureData();
        const product = (m.products || []).find(p => p.id === productId);
        if (!product) return;

        const data = AppState.data.pixivData;
        if (!data.novels) data.novels = [];

        // 既に小説化済みなら、その連載へ移動（重複生成を防ぐ）
        if (product.pixivNovelId) {
            const existingNovel = data.novels.find(n => n.id === product.pixivNovelId);
            if (existingNovel) {
                Utils.showToast(I18n.t('t.melon_already_novelized', '既にPixivで連載化されています'));
                this.currentNovelId = existingNovel.id;
                this.currentChapterIdx = 0;
                Navigation.goTo('pixiv-reader');
                return;
            }
            // 紐付け先の連載が削除済み → 関連付けをリセットして再生成を許可
            product.pixivNovelId = null;
        }

        const circle = (m.circles || []).find(c => c.id === product.circleId);

        const novel = {
            id: Utils.generateId(),
            title: product.title || '無題',
            author: circle ? (circle.author || circle.name) : '匿名',
            tags: (product.tags || []).slice(0, 5),
            coverGradient: this.generateCoverGradient(),
            writingStyleId: null,
            chapters: [],
            isSerial: true,
            hearts: 0,   // 档C：随后 _initNovelPopularity 统一 roll（最高章缓存）
            timestamp: Date.now(),
            updatedAt: Date.now(),
            melonbooksProductId: product.id,
            synopsis: product.sampleText || ''
        };
        this._initNovelPopularity(novel, AppState.data.twitterData);

        data.novels.unshift(novel);
        product.pixivNovelId = novel.id;
        Utils.saveData();

        Utils.showToast(I18n.t('t.pixiv_created_from_melon', {title: novel.title}));
        this.currentNovelId = novel.id;
        this.currentChapterIdx = 0;
        Navigation.goTo('pixiv-reader');
    }
};
