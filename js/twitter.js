// ===== 模拟X/推特模块 =====
const Twitter = {
    currentTweetId: null,
    currentTweetIsNpc: false,
    currentDmNpcId: null,
    currentSpaceId: null,
    currentNpcProfileId: null,
    _npcProfileFromScreen: 'twitter',
    _currentTab: 'foryou',
    _selectedColor: null,
    _searchResults: [],
    _searchQuery: '',
    currentInboxDmId: null,
    currentDmMode: 'npc',
    _refreshing: false,   // v2.123.0 刷新并发锁（in-memory、不入存档）

    // 头像颜色预设
    _AVATAR_COLORS: ['#1d9bf0', '#17bf63', '#794bc4', '#f4900c', '#e0245e', '#2b7be9', '#00ba7c', '#ff6b35', '#8e44ad', '#16a085'],

    // ===== SVG 图标集（替代 emoji，与主题色统一）=====
    _svg: {
        chat: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
        retweet: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
        retweetActive: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="#17bf63" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
        heart: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
        heartFilled: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="#e0245e" stroke="#e0245e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
        share: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>`,
        bookmark: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
        retweetGreen: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="#00ba7c" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
        verified: `<svg width="1.1em" height="1.1em" viewBox="0 0 24 24" fill="#1d9bf0" style="vertical-align:-0.15em" aria-label="認証済み"><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z"/></svg>`,
        bellLg: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
        mailLg: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
        mailMd: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
        pin: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="vertical-align:-1px"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>`,
        birdLg: `<svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
        book: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
        loader: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="vertical-align:-0.15em"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
        palette: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,
        paletteLg: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,
        tv: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>`,
        sparkles: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/><path d="M5 16l.6 1.4L7 18l-1.4.6L5 20l-.6-1.4L3 18l1.4-.6z"/></svg>`,
        shopping: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
        tent: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em"><path d="M3.5 21 14 3"/><path d="M20.5 21 10 3"/><path d="M15.5 21 12 15l-3.5 6"/><path d="M2 21h20"/></svg>`,
        radio: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/></svg>`,
        headphones: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>`,
        calendar: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    },

    // 情報アクセス制限ルール → 见 Utils.PROMPTS.infoAccessRule()

    // 推内容高亮：URL/#hashtag/@mention 蓝色显示
    _linkifyContent(rawText) {
        const escaped = this._esc(rawText || '');
        return escaped
            .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" class="tw-link-url">$1</a>')
            .replace(/(^|[^\w])(#[^\s#@<]+)/g, '$1<span class="tw-link-tag">$2</span>')
            .replace(/(^|[^\w])(@[\w_]+)/g, '$1<span class="tw-link-mention">$2</span>')
            .replace(/\n/g, '<br>');
    },

    // ===== 初始化数据结构 =====
    _ensureData() {
        const d = AppState.data;
        if (!d.twitterData) d.twitterData = {};
        const t = d.twitterData;
        // 官方账号（保持向后兼容）
        if (!t.userName) t.userName = '公式アカウント';
        if (!t.userHandle) t.userHandle = 'official';
        if (!t.userAvatarLetter) t.userAvatarLetter = 'M';
        if (!t.userAvatarColor) t.userAvatarColor = '#1d9bf0';
        if (!t.userBio) t.userBio = '';
        // 个人账号（同人女身份）
        if (!t.personalAccount) t.personalAccount = {
            name: '', handle: '', avatarLetter: '', avatarColor: '#e0245e', bio: '', joinDate: ''
        };
        // 身份系统：'personal' | 'official' | 'npc'
        if (!t.activeIdentityType) t.activeIdentityType = 'official';
        if (!t.activeNpcId) t.activeNpcId = null;

        // ===== 新身份系统（v2）：personalAccounts[] + activeAccountId =====
        // - personalAccounts[i] = {id, name, handle, avatarLetter, avatarColor, avatarImage, bio, isReal, joinDate}
        // - activeAccountId = 'personal:<id>' | 'npc:<npcId>'
        // - 论坛 NPC 账号资料直接 reference AppState.data.broadcast.officialNpcs，不在此存
        if (!Array.isArray(t.personalAccounts)) t.personalAccounts = [];
        if (t.activeAccountId === undefined) t.activeAccountId = null;

        // 一次性迁移：把旧 official + personalAccount + activeIdentityType 转成新模型
        if (!t._accountsMigratedV2) {
            const migrated = []; // {kind: 'official'|'personal', account}
            // 旧 official → personal 账号
            if (t.userName) {
                migrated.push({
                    kind: 'official',
                    account: {
                        id: 'pa_off_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
                        name: t.userName,
                        handle: t.userHandle || 'official',
                        avatarLetter: t.userAvatarLetter || (t.userName || 'M').charAt(0).toUpperCase(),
                        avatarColor: t.userAvatarColor || '#1d9bf0',
                        avatarImage: t.userAvatarImage || null,
                        bio: t.userBio || '',
                        isReal: true,
                        joinDate: ''
                    }
                });
            }
            // 旧 personalAccount → 另一个 personal 账号
            if (t.personalAccount && t.personalAccount.name) {
                migrated.push({
                    kind: 'personal',
                    account: {
                        id: 'pa_per_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
                        name: t.personalAccount.name,
                        handle: t.personalAccount.handle || 'myaccount',
                        avatarLetter: t.personalAccount.avatarLetter || t.personalAccount.name.charAt(0).toUpperCase(),
                        avatarColor: t.personalAccount.avatarColor || '#e0245e',
                        avatarImage: t.personalAccount.avatarImage || null,
                        bio: t.personalAccount.bio || '',
                        isReal: true,
                        joinDate: t.personalAccount.joinDate || ''
                    }
                });
            }
            t.personalAccounts = migrated.map(m => m.account);

            // 决定 activeAccountId
            if (t.activeIdentityType === 'npc' && t.activeNpcId) {
                t.activeAccountId = 'npc:' + t.activeNpcId;
            } else if (t.activeIdentityType === 'personal') {
                const m = migrated.find(x => x.kind === 'personal') || migrated[0];
                t.activeAccountId = m ? 'personal:' + m.account.id : null;
            } else {
                const m = migrated.find(x => x.kind === 'official') || migrated[0];
                t.activeAccountId = m ? 'personal:' + m.account.id : null;
            }

            // 历史 tweet：postedAsIdentityType + postedAsNpcId → postedAsAccountId
            const officialAcct = migrated.find(x => x.kind === 'official');
            const personalAcct = migrated.find(x => x.kind === 'personal');
            (t.tweets || []).forEach(tw => {
                if (tw.postedAsAccountId) return;
                if (tw.postedAsNpcId) {
                    tw.postedAsAccountId = 'npc:' + tw.postedAsNpcId;
                } else if (tw.postedAsIdentityType === 'personal' && personalAcct) {
                    tw.postedAsAccountId = 'personal:' + personalAcct.account.id;
                } else if (officialAcct) {
                    tw.postedAsAccountId = 'personal:' + officialAcct.account.id;
                } else if (personalAcct) {
                    tw.postedAsAccountId = 'personal:' + personalAcct.account.id;
                }
            });
            t._accountsMigratedV2 = true;
        }

        // v2.68.8 一次性修：v1 时代 t.userName 默认值 '公式アカウント' 被迁进 personalAccount.name，rename 成中性默认
        // 公式账号在放送局 NPC 池里管理、推特账号切换列表里不应该出现「公式アカウント」当 personal 账号
        if (!t._renamedOfficialDefaultV2_68_8) {
            t.personalAccounts.forEach(acc => {
                if (acc.isReal && acc.name === '公式アカウント') {
                    acc.name = I18n.t('tw.id_default_name', '私のアカウント');
                    if (acc.handle === 'official') acc.handle = 'myaccount';
                }
            });
            t._renamedOfficialDefaultV2_68_8 = true;
        }

        // 兜底：personalAccounts 为空时自动建一个默认账号（新用户首次进入）
        if (t.personalAccounts.length === 0) {
            const def = {
                id: 'pa_default_' + Date.now().toString(36),
                name: I18n.t('tw.id_default_name', '私のアカウント'),
                handle: 'myaccount',
                avatarLetter: I18n.t('tw.id_default_letter', '私'),
                avatarColor: '#e0245e',
                avatarImage: null,
                bio: '',
                isReal: true,
                joinDate: ''
            };
            t.personalAccounts.push(def);
            if (!t.activeAccountId) t.activeAccountId = 'personal:' + def.id;
        }

        // activeAccountId 校验：如果指向不存在的账号，回落到第一个 personal
        if (t.activeAccountId) {
            const valid = this._isAccountIdValid(t.activeAccountId);
            if (!valid) t.activeAccountId = 'personal:' + t.personalAccounts[0].id;
        } else {
            t.activeAccountId = 'personal:' + t.personalAccounts[0].id;
        }

        // 点赞追踪
        if (!t.likedTweetIds) t.likedTweetIds = [];
        // 其他数据
        if (!t.tweets) t.tweets = [];
        if (!t.npcTweets) t.npcTweets = [];
        if (!t.dms) t.dms = {};
        if (!t.notifications) t.notifications = [];
        if (!t.inboxDms) t.inboxDms = [];
        if (!t.trends) t.trends = [];
        // ブックマーク → いいね マイグレーション（一度だけ実行）
        if (t.bookmarks && t.bookmarks.length > 0 && !t._bookmarksMigrated) {
            t.bookmarks.forEach(b => {
                if (!t.likedTweetIds.some(l => l.id === b.id)) {
                    t.likedTweetIds.push({ id: b.id, isNpc: b.isNpc !== false, timestamp: Date.now() });
                }
            });
            t.bookmarks = [];
            t._bookmarksMigrated = true;
        }
        if (!t.spaces) t.spaces = [];
        if (!t.followedNpcIds) t.followedNpcIds = [];
        if (!t.fanFriends) t.fanFriends = [];
        // マシュマロ（匿名質問箱）
        if (!t.marshmallows) t.marshmallows = [];
        // Poipiku（軽量創作共有）
        if (!t.poipikuPosts) t.poipikuPosts = [];
        return t;
    },

    // ===== 初始化（进入 twitter screen 时调用）=====
    init() {
        this._ensureData();
        this._updateUserAvatar();
        this.switchTab(this._currentTab, false);
        this.renderTimeline();
        this._updateBadges();
        // v2.123.0 链路A：进推特页就后台预热 doujin_writer 种子池（沉浸感铁律：无 UI、加锁兜底并发）
        setTimeout(() => {
            if (typeof PixivNovel !== 'undefined' && PixivNovel._maybeSeedDoujinWriters) {
                PixivNovel._maybeSeedDoujinWriters().catch(e => console.warn('[Twitter seed prewarm]', e));
            }
        }, 200);
    },

    _updateUserAvatar() {
        const identity = this._getActiveIdentity();
        const avatarBtn = document.getElementById('twUserAvatar');
        if (!avatarBtn) return;
        const image = identity.avatarImage || null;
        if (image) {
            avatarBtn.textContent = '';
            avatarBtn.style.background = `center/cover url("${image.replace(/"/g, '\\"')}")`;
            avatarBtn.style.backgroundColor = '';
        } else {
            avatarBtn.textContent = identity.letter;
            avatarBtn.style.background = identity.color;
        }
    },

    // 校验 activeAccountId 指向的账号是否存在
    _isAccountIdValid(accountId) {
        if (!accountId || typeof accountId !== 'string') return false;
        const d = AppState.data;
        const t = d.twitterData;
        if (accountId.startsWith('personal:')) {
            const id = accountId.slice('personal:'.length);
            return (t.personalAccounts || []).some(a => a.id === id);
        }
        if (accountId.startsWith('npc:')) {
            const npcId = accountId.slice('npc:'.length);
            return !!(AppState.data.broadcast?.officialNpcs || []).find(n => n.id === npcId);
        }
        return false;
    },

    // 根据 accountId 查 personal 账号对象（仅 personal: 前缀生效）
    _getPersonalAccount(accountId) {
        const t = this._ensureData();
        if (!accountId || !accountId.startsWith('personal:')) return null;
        const id = accountId.slice('personal:'.length);
        return (t.personalAccounts || []).find(a => a.id === id) || null;
    },

    // accountId → 显示名（用于"〇〇さんがリポスト"头）
    _getAccountDisplayNameById(accountId) {
        if (!accountId) return I18n.t('tw.you_label', 'あなた');
        if (accountId.startsWith('npc:')) {
            const npc = this._getNpc(accountId.slice('npc:'.length));
            return npc ? (npc.name || npc.role || 'NPC') : 'NPC';
        }
        const acc = this._getPersonalAccount(accountId);
        return acc ? (acc.name || I18n.t('tw.id_default_name', '私のアカウント')) : I18n.t('tw.you_label', 'あなた');
    },

    // 获取当前激活账号的身份信息（统一接口）
    // 返回 { type: 'personal'|'npc', accountId, name, handle, letter, color, avatarImage, isNpc, npcId, isReal, bio }
    _getActiveIdentity() {
        const t = this._ensureData();
        const id = t.activeAccountId;
        if (id && id.startsWith('npc:')) {
            const npcId = id.slice('npc:'.length);
            const npc = this._getNpc(npcId);
            if (npc) {
                return {
                    type: 'npc',
                    accountId: id,
                    name: npc.name || npc.role,
                    handle: this._getNpcHandle(npc),
                    letter: (npc.name || npc.role || 'N').charAt(0).toUpperCase(),
                    color: this._npcColor(npc.id),
                    avatarImage: npc.avatarImage || null,
                    isNpc: true,
                    npcId: npc.id,
                    isReal: true, // NPC 的本体身份对其他 NPC 是已知的
                    bio: npc.bio || ''
                };
            }
            // NPC 找不到（可能被论坛删了），落回到第一个 personal
        }
        const acc = this._getPersonalAccount(id) || (t.personalAccounts || [])[0];
        if (acc) {
            return {
                type: 'personal',
                accountId: 'personal:' + acc.id,
                name: acc.name || I18n.t('tw.id_default_name', '私のアカウント'),
                handle: '@' + (acc.handle || 'myaccount'),
                letter: acc.avatarLetter || (acc.name || I18n.t('tw.id_default_letter', '私')).charAt(0).toUpperCase(),
                color: acc.avatarColor || '#e0245e',
                avatarImage: acc.avatarImage || null,
                isNpc: false,
                npcId: null,
                isReal: acc.isReal !== false, // default true
                bio: acc.bio || ''
            };
        }
        // 极端兜底（理论上 _ensureData 会保证至少有一个 personal）
        return {
            type: 'personal',
            accountId: null,
            name: I18n.t('tw.id_unnamed', '未設定'),
            handle: '@unset',
            letter: '?',
            color: '#888',
            avatarImage: null,
            isNpc: false,
            npcId: null,
            isReal: true,
            bio: ''
        };
    },

    // ===== 切换标签 =====
    switchTab(tab, rerender = true) {
        this._currentTab = tab;
        this._timelineLimit = null;  // 切 tab 回到最近一屏，分页从头
        document.getElementById('twTabForyou')?.classList.toggle('active', tab === 'foryou');
        document.getElementById('twTabFollowing')?.classList.toggle('active', tab === 'following');
        document.getElementById('twNavHome')?.classList.toggle('active', true);
        if (rerender) this.renderTimeline();
    },

    // ===== 时间线渲染 =====
    renderTimeline() {
        const t = this._ensureData();
        const container = document.getElementById('twitterTimeline');
        if (!container) return;

        // 构建查找 Set（避免每张卡片做线性扫描）
        this._likedSet = new Set((t.likedTweetIds || []).map(l => l.id));

        let tweets; // [{tweet, isNpc, retweetedByName?, sortTs}]
        if (this._currentTab === 'following') {
            const staffTweets = (t.npcTweets || [])
                .filter(tw => tw.source !== 'fan')
                .map(tw => ({ tweet: tw, isNpc: true, sortTs: tw.timestamp || 0 }));
            const userTweets = (t.tweets || []).map(tw => ({ tweet: tw, isNpc: false, sortTs: tw.timestamp || 0 }));
            tweets = [...staffTweets, ...userTweets];

            // 用户转推：把对应原推插入时间线，按 retweetedAt 排序
            const myRT = t.myRetweets || [];
            myRT.forEach(rt => {
                const arr = rt.isNpc ? (t.npcTweets || []) : (t.tweets || []);
                const orig = arr.find(tw => tw.id === rt.tweetId);
                if (!orig) return;
                // 同账号既发了又转推自己的话避免重复
                if (!rt.isNpc && tweets.some(x => x.tweet.id === orig.id && !x.retweetedByName)) {
                    // 已经在自己时间线里了，仍允许加 RT 头版本时跳过
                    return;
                }
                const rtName = this._getAccountDisplayNameById(rt.accountId);
                tweets.push({ tweet: orig, isNpc: !!rt.isNpc, retweetedByName: rtName, sortTs: rt.retweetedAt || orig.timestamp || 0 });
            });
        } else {
            tweets = (t.npcTweets || [])
                .filter(tw => tw.source === 'fan' && !tw.fromSearch)
                .map(tw => ({ tweet: tw, isNpc: true, sortTs: tw.timestamp || 0 }));
        }

        tweets.sort((a, b) => (b.sortTs || 0) - (a.sortTs || 0));

        // Spaces 不再显示在主时间线（真推没有这种卡片，移到搜索页/profile 入口）
        const spacesHtml = '';
        const followingNpcHtml = this._currentTab === 'following' ? this._renderFollowingNpcSection() : '';

        if (tweets.length === 0) {
            const hint = this._currentTab === 'following'
                ? I18n.t('tw.empty_hint_following', '右上の 🔄 でスタッフのツイートを生成、または ✏️ で自分が投稿しましょう')
                : I18n.t('tw.empty_hint_foryou', '右上の 🔄 でファン・業界人のタイムラインを更新しましょう');
            container.innerHTML = spacesHtml + followingNpcHtml + `<div class="empty-state" style="padding-top:60px;"><div style="margin-bottom:12px;color:var(--text-secondary);">${this._svg.birdLg}</div><div>${I18n.t('tw.empty_no_tweets', 'まだツイートがありません')}</div><div style="font-size:13px;color:var(--text-secondary);margin-top:6px;">${hint}</div></div>`;
            return;
        }

        // スレッドグルーピング
        const grouped = this._groupTweetsForTimeline(tweets);

        // 渲染窗口：文字推永不裁、数据全保留，但只渲染最近 _timelineLimit 个时间线项
        //（线程算 1 项，不切断线程半截），避免历史累积后每次全量建 DOM 变卡。
        // 底部「以前のツイートを見る」按钮按 PAGE 增量加载更早的。
        const PAGE = 50;
        if (typeof this._timelineLimit !== 'number') this._timelineLimit = PAGE;
        const visible = grouped.slice(0, this._timelineLimit);
        const hasMore = grouped.length > visible.length;

        container.innerHTML = spacesHtml + followingNpcHtml + visible.map(item => {
            if (item.type === 'thread') {
                return `<div class="tw-thread-group">${item.tweets.map(({ tweet: tw, isNpc, retweetedByName }, i) => {
                    const isLast = i === item.tweets.length - 1;
                    const card = this._renderTweetCard(tw, isNpc, false, retweetedByName);
                    return isLast ? card : card.replace('class="tw-card"', 'class="tw-card tw-thread-connected"');
                }).join('')}</div>`;
            }
            return this._renderTweetCard(item.tweet, item.isNpc, false, item.retweetedByName);
        }).join('') + (hasMore ? `<button class="tw-load-earlier" onclick="Twitter.showMoreTimeline()">${I18n.t('tw.show_earlier', '以前のツイートを見る')}</button>` : '');
        this._likedSet = null;

        // 生成済み画像をロード
        this._loadGeneratedImages(container);
        this._loadNicoThumbs(container);
    },

    // 「以前のツイートを見る」：扩大渲染窗口、增量渲染更早的时间线项（数据本就全在）
    showMoreTimeline() {
        this._timelineLimit = (this._timelineLimit || 50) + 50;
        this.renderTimeline();
    },

    // 头像渲染辅助：有图就 <img>，没图就 letter+color
    // opts: { image, letter, color, classes, onclick, title }
    _renderAvatar(opts) {
        const cls = opts.classes || 'tw-card-avatar';
        const click = opts.onclick || '';
        if (opts.image) {
            return `<img class="${cls} tw-avatar-img" src="${Utils.escAttr(opts.image)}" alt=""${click}>`;
        }
        return `<div class="${cls}" style="background:${opts.color || '#1d9bf0'};"${click}>${this._esc(opts.letter || '?')}</div>`;
    },

    // 通用图片选择器：avatar 与 banner 公用，差别只在压缩参数和保存回调
    _pickImageFile({ maxSize, quality, save }) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        input.onchange = async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
                const dataUrl = await Utils.readImageFile(file, { maxSize, quality });
                if (!dataUrl) return;
                save(dataUrl);
            } catch (err) {
                Utils.showToast(I18n.t('t.tw_img_load_failed', '画像読み込み失敗：') + err.message, 4000);
            } finally {
                input.remove();
            }
        };
        document.body.appendChild(input);
        input.click();
    },

    // 头像上传 — mode: 'user' (official) | 'personal' | 'npc:<npcId>' | 'fan:<fanId>' | 'account:<id>'
    _pickAvatarFile(mode) {
        // 头像压到 200x200，足够清晰、文件够小
        this._pickImageFile({ maxSize: 200, quality: 0.85, save: dataUrl => this._saveAvatarImage(mode, dataUrl) });
    },

    _saveAvatarImage(mode, dataUrl) {
        const t = this._ensureData();
        // 新模型：account:<personalAccountId>
        if (mode.startsWith('account:')) {
            const id = mode.slice('account:'.length);
            const acc = (t.personalAccounts || []).find(a => a.id === id);
            if (acc) acc.avatarImage = dataUrl;
        } else if (mode === 'user') {
            t.userAvatarImage = dataUrl;
            // 同步到 _accountsMigratedV2 之前的 official 账号迁移产物（若仍存在）
            const off = (t.personalAccounts || []).find(a => a.handle === (t.userHandle || 'official'));
            if (off) off.avatarImage = dataUrl;
        } else if (mode === 'personal') {
            if (!t.personalAccount) t.personalAccount = {};
            t.personalAccount.avatarImage = dataUrl;
            const per = (t.personalAccounts || []).find(a => a.handle === (t.personalAccount.handle || 'myaccount'));
            if (per) per.avatarImage = dataUrl;
        } else if (mode.startsWith('npc:')) {
            const npcId = mode.slice(4);
            const npc = (AppState.data.broadcast.officialNpcs || []).find(n => n.id === npcId);
            if (npc) npc.avatarImage = dataUrl;
        } else if (mode.startsWith('fan:')) {
            const fanId = mode.slice(4);
            const fan = (t.fanFriends || []).find(f => f.id === fanId);
            if (fan) fan.avatarImage = dataUrl;
        }
        Utils.saveData();
        Utils.showToast(I18n.t('t.tw_avatar_updated', '✓ アバターを更新しました'));
        // 触发当前页重渲
        const active = document.querySelector('.screen.active')?.id;
        if (active === 'twitter') this.renderTimeline?.();
        if (active === 'twitter-user-profile') this.renderUserProfile();
        if (active === 'twitter-npc-profile') this.renderNpcProfile();
        if (active === 'twitter-dm-list') this.renderDmList();
        if (active === 'twitter-dm') this.renderDmConversation?.();
    },

    _uploadUserAvatar() {
        const identity = this._getActiveIdentity();
        if (identity.accountId && identity.accountId.startsWith('personal:')) {
            const id = identity.accountId.slice('personal:'.length);
            this._pickAvatarFile('account:' + id);
        } else if (identity.accountId && identity.accountId.startsWith('npc:')) {
            const npcId = identity.accountId.slice('npc:'.length);
            this._pickAvatarFile('npc:' + npcId);
        }
    },

    _uploadNpcAvatar(npcId) {
        this._pickAvatarFile('npc:' + npcId);
    },

    _uploadFanAvatar(fanId) {
        this._pickAvatarFile('fan:' + fanId);
    },

    // ===== Banner 上传（个人账号 / NPC）=====
    _uploadActiveBanner() {
        const identity = this._getActiveIdentity();
        if (identity.accountId && identity.accountId.startsWith('personal:')) {
            const id = identity.accountId.slice('personal:'.length);
            this._pickBannerFile('account:' + id);
        } else if (identity.accountId && identity.accountId.startsWith('npc:')) {
            const npcId = identity.accountId.slice('npc:'.length);
            this._pickBannerFile('npc:' + npcId);
        }
    },
    _uploadNpcBanner(npcId) {
        this._pickBannerFile('npc:' + npcId);
    },

    // banner 横向，1200 宽足够
    _pickBannerFile(mode) {
        this._pickImageFile({ maxSize: 1200, quality: 0.82, save: dataUrl => this._saveBannerImage(mode, dataUrl) });
    },

    _saveBannerImage(mode, dataUrl) {
        const t = this._ensureData();
        if (mode.startsWith('account:')) {
            const id = mode.slice('account:'.length);
            const acc = (t.personalAccounts || []).find(a => a.id === id);
            if (acc) acc.bannerImage = dataUrl;
        } else if (mode.startsWith('npc:')) {
            const npcId = mode.slice('npc:'.length);
            const npc = (AppState.data.broadcast.officialNpcs || []).find(n => n.id === npcId);
            if (npc) npc.bannerImage = dataUrl;
        }
        Utils.saveData();
        Utils.showToast(I18n.t('t.tw_banner_updated', '✓ バナーを更新しました'));
        const active = document.querySelector('.screen.active')?.id;
        if (active === 'twitter-user-profile') this.renderUserProfile();
        if (active === 'twitter-npc-profile') this.renderNpcProfile();
    },

    // NPC @ハンドル編集（罗马字 / 英文昵称）
    _editNpcHandle(npcId) {
        const npc = this._getNpc(npcId);
        if (!npc) return;
        const current = (npc.handle || '').replace(/^@+/, '');
        const placeholder = npcId && /^[a-z0-9_]+$/i.test(npcId) ? npcId : 'cv_misaki';
        const input = prompt(
            I18n.t('tw.npc_handle_edit_prompt', {example: placeholder}),
            current
        );
        if (input === null) return;
        const cleaned = input.replace(/^@+/, '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
        if (!cleaned) {
            // 清空 → 用回 fallback
            delete npc.handle;
        } else {
            npc.handle = cleaned;
        }
        Utils.saveData();
        Utils.showToast(I18n.t('t.tw_handle_updated', '✓ ハンドルを更新しました'));
        this.renderNpcProfile?.();
        // 时间线/通知里也都会用新 handle，下次渲染自动同步
    },

    // ===== 推文身份解析（抽取公共逻辑）=====
    _resolveTweetIdentity(tweet, isNpc) {
        const t = this._ensureData();
        if (tweet.source === 'fan') {
            const friend = this._getFanByHandle(tweet.authorHandle);
            return {
                name: tweet.authorName || 'ファン',
                handle: tweet.authorHandle || '@user',
                avatarLetter: (tweet.authorName || 'ファン').charAt(0).toUpperCase(),
                avatarColor: friend ? friend.avatarColor : this._fanTypeColor(tweet.authorType),
                avatarImage: friend?.avatarImage || null,
                isStaff: false, profileNpcId: null,
                fanFriendId: friend ? friend.id : null,
                fanTweetId: tweet.id
            };
        }
        if (isNpc) {
            const npc = this._getNpc(tweet.npcId);
            return {
                name: npc ? (npc.name || npc.role) : 'NPC',
                handle: npc ? this._getNpcHandle(npc) : '@npc',
                avatarLetter: ((npc && (npc.name || npc.role)) || 'N').charAt(0).toUpperCase(),
                avatarColor: this._npcColor(tweet.npcId),
                avatarImage: npc?.avatarImage || null,
                isStaff: true, profileNpcId: tweet.npcId
            };
        }
        // 新模型：postedAsAccountId
        if (tweet.postedAsAccountId) {
            if (tweet.postedAsAccountId.startsWith('npc:')) {
                const npcId = tweet.postedAsAccountId.slice('npc:'.length);
                const npc = this._getNpc(npcId);
                if (npc) {
                    return {
                        name: npc.name || npc.role,
                        handle: this._getNpcHandle(npc),
                        avatarLetter: (npc.name || npc.role || 'N').charAt(0).toUpperCase(),
                        avatarColor: this._npcColor(npcId),
                        avatarImage: npc.avatarImage || null,
                        isStaff: true, profileNpcId: npcId
                    };
                }
                // NPC 不在了，标为已删除
                return {
                    name: '（削除されたアカウント）', handle: '@unknown',
                    avatarLetter: '?', avatarColor: '#888', avatarImage: null,
                    isStaff: false, profileNpcId: null
                };
            }
            if (tweet.postedAsAccountId.startsWith('personal:')) {
                const acc = this._getPersonalAccount(tweet.postedAsAccountId);
                if (acc) {
                    return {
                        name: acc.name, handle: '@' + (acc.handle || 'myaccount'),
                        avatarLetter: acc.avatarLetter || (acc.name || '私').charAt(0).toUpperCase(),
                        avatarColor: acc.avatarColor || '#e0245e',
                        avatarImage: acc.avatarImage || null,
                        isStaff: false, profileNpcId: null, isPersonal: true
                    };
                }
                return {
                    name: '（削除されたアカウント）', handle: '@unknown',
                    avatarLetter: '?', avatarColor: '#888', avatarImage: null,
                    isStaff: false, profileNpcId: null
                };
            }
        }
        // 旧模型 fallback（迁移漏网的极少量数据）
        if (tweet.postedAsNpcId) {
            const npc = this._getNpc(tweet.postedAsNpcId);
            return {
                name: npc ? (npc.name || npc.role) : (t.userName || '公式アカウント'),
                handle: npc ? this._getNpcHandle(npc) : '@' + (t.userHandle || 'official'),
                avatarLetter: ((npc ? (npc.name || npc.role) : (t.userName || 'M')) || 'M').charAt(0).toUpperCase(),
                avatarColor: npc ? this._npcColor(tweet.postedAsNpcId) : (t.userAvatarColor || '#1d9bf0'),
                avatarImage: npc?.avatarImage || (npc ? null : t.userAvatarImage) || null,
                isStaff: !!npc, profileNpcId: tweet.postedAsNpcId
            };
        }
        // 兜底：用第一个 personal 账号渲染
        const fallback = (t.personalAccounts || [])[0];
        if (fallback) {
            return {
                name: fallback.name, handle: '@' + (fallback.handle || 'myaccount'),
                avatarLetter: fallback.avatarLetter || (fallback.name || '私').charAt(0).toUpperCase(),
                avatarColor: fallback.avatarColor || '#e0245e',
                avatarImage: fallback.avatarImage || null,
                isStaff: false, profileNpcId: null, isPersonal: true
            };
        }
        return {
            name: t.userName || '公式アカウント',
            handle: '@' + (t.userHandle || 'official'),
            avatarLetter: t.userAvatarLetter || (t.userName || 'M').charAt(0).toUpperCase(),
            avatarColor: t.userAvatarColor || '#1d9bf0',
            avatarImage: t.userAvatarImage || null,
            isStaff: false, profileNpcId: null
        };
    },

    // ===== 解析被引用推文（兼容内联 quotedTweet 对象 与 quotedTweetId 引用）=====
    // 返回 { authorName, authorHandle, avatarColor, content } 或 null（无引用 / 被引推已删）
    _resolveQuotedTweet(tweet) {
        if (!tweet) return null;
        // ① 用户自己发的引用推：内联对象
        if (tweet.quotedTweet) return tweet.quotedTweet;
        // ② NPC 引用推：只存了 quotedTweetId（+ quotedTweetIsNpc），按 ID 实时查找原推
        if (tweet.quotedTweetId) {
            const t = this._ensureData();
            const arr = tweet.quotedTweetIsNpc ? (t.npcTweets || []) : (t.tweets || []);
            const orig = arr.find(tw => tw.id === tweet.quotedTweetId);
            if (!orig) return { unavailable: true };
            const ident = this._resolveTweetIdentity(orig, !!tweet.quotedTweetIsNpc);
            return {
                authorName: ident.name,
                authorHandle: ident.handle,
                avatarColor: ident.avatarColor,
                content: orig.content || ''
            };
        }
        return null;
    },

    // ===== 渲染被引用推文内联卡片（时间线 / 线程页共用）=====
    _renderQuotedTweetHtml(tweet) {
        const q = this._resolveQuotedTweet(tweet);
        if (!q) return '';
        if (q.unavailable) {
            return `<div class="tw-inline-quote tw-inline-quote-unavailable" onclick="event.stopPropagation();">
            <div class="tw-iq-content" style="color:var(--text-secondary,#888);">${I18n.t('tw.quote_unavailable', 'このツイートは表示できません')}</div>
        </div>`;
        }
        return `<div class="tw-inline-quote" onclick="event.stopPropagation();">
            <div class="tw-iq-header">
                <div class="tw-iq-avatar" style="background:${q.avatarColor || '#888'};">${(q.authorName || '？').charAt(0).toUpperCase()}</div>
                <span class="tw-name" style="font-size:13px;">${this._esc(q.authorName || '')}</span>
                <span class="tw-handle" style="font-size:12px;">${this._esc(q.authorHandle || '')}</span>
            </div>
            <div class="tw-iq-content">${this._esc(q.content || '').replace(/\n/g, '<br>')}</div>
        </div>`;
    },

    // ===== 渲染单条推文卡片 =====
    _renderTweetCard(tweet, isNpc, suppressProfileLink = false, retweetedByName = null) {
        const t = this._ensureData();
        const identity = this._resolveTweetIdentity(tweet, isNpc);
        const { name, handle, avatarLetter, avatarColor } = identity;

        const replyCount = (tweet.replies || []).length;
        const isNpcStr = isNpc ? 'true' : 'false';

        // 认证标记（官方NPC显示✓）
        const verifiedMark = identity.isStaff ? ` ${this._svg.verified}` : '';

        // プロフィールリンク
        const pnid = (!suppressProfileLink && identity.profileNpcId) ? this._esc(identity.profileNpcId) : '';
        const profileOnclick = pnid ? ` onclick="event.stopPropagation();Twitter.openNpcProfile('${pnid}','twitter')"` : '';
        const profileAvatarCls = pnid ? 'tw-card-avatar tw-avatar-link' : 'tw-card-avatar';
        const profileNameCls = pnid ? 'tw-name tw-name-link' : 'tw-name';

        // Fan プロフィールリンク
        const ffid = (!suppressProfileLink && identity.fanFriendId) ? this._esc(identity.fanFriendId) : '';
        const fanTweetId = (!suppressProfileLink && !ffid && identity.fanTweetId) ? this._esc(identity.fanTweetId) : '';
        const fanProfileOnclick = ffid
            ? ` onclick="event.stopPropagation();Twitter.openFanProfile('${ffid}')"`
            : fanTweetId
                ? ` onclick="event.stopPropagation();Twitter.openFanPreview('${fanTweetId}')"`
                : '';

        // 用户自己的推文点击头像打开用户主页
        const isOwnTweet = !isNpc && !tweet.postedAsNpcId;
        const ownProfileClick = (!suppressProfileLink && isOwnTweet) ? ` onclick="event.stopPropagation();Twitter.openUserProfile()"` : '';
        const hasFanLink = !!(ffid || fanTweetId);
        const finalAvatarCls = (pnid || isOwnTweet || hasFanLink) ? 'tw-card-avatar tw-avatar-link' : 'tw-card-avatar';
        const finalAvatarOnclick = pnid ? profileOnclick : (hasFanLink ? fanProfileOnclick : ownProfileClick);

        // ↩ NPC互@ ヘッダー
        const mentionHeader = tweet.mentionsNpcHandle
            ? `<div class="tw-mention-header">${I18n.t('tw.npc_mention_to', {handle: this._esc(tweet.mentionsNpcHandle)})}</div>`
            : '';

        // 🔁 リポスト ヘッダー（用户转推时显示）
        const rtHeader = retweetedByName
            ? `<div class="tw-rt-header">${this._svg.retweet} ${I18n.t('tw.rt_header', {name: this._esc(retweetedByName)})}</div>`
            : '';

        // 数字
        const likesStr = this._fmtNum(tweet.likes || 0);
        const rtStr = this._fmtNum(tweet.retweets || 0);

        // いいね状態（Set があれば O(1)、なければ O(n) フォールバック）
        const isLiked = this._likedSet ? this._likedSet.has(tweet.id) : (t.likedTweetIds || []).some(l => l.id === tweet.id);
        const heartIcon = isLiked ? this._svg.heartFilled : this._svg.heart;
        const likeClass = isLiked ? 'tw-action-btn tw-liked' : 'tw-action-btn';

        // リポスト状態（スレ詳細ページと同じロジック）
        const tweetIdEsc = this._esc(tweet.id);
        const isRetweeted = this._isRetweetedByCurrentUser(tweet.id, isNpc);

        const tlBlock = tweet.translation ? `<details class="tw-tl-block" onclick="event.stopPropagation()">
    <summary class="tw-tl-btn">訳</summary>
    <div class="tw-tl-content">${this._esc(tweet.translation)}</div>
</details>` : '';

        return `<div class="tw-card" onclick="Twitter.openTweet('${this._esc(tweet.id)}', ${isNpcStr})">
    ${this._renderAvatar({ image: identity.avatarImage, letter: avatarLetter, color: avatarColor, classes: finalAvatarCls, onclick: finalAvatarOnclick })}
    <div class="tw-card-body">
        ${rtHeader}
        ${mentionHeader}
        <div class="tw-card-header">
            <span class="${profileNameCls}"${profileOnclick}>${this._esc(name)}${verifiedMark}</span>
            <span class="tw-handle">${this._esc(handle)}</span>
            <span class="tw-time-sep">·</span>
            <span class="tw-time">${this._timeAgo(tweet.timestamp)}</span>
        </div>
        <div class="tw-content">${this._linkifyContent(tweet.content)}</div>
        ${this._renderUserImage(tweet, isNpcStr)}
        ${this._renderUserAudio(tweet, isNpcStr)}
        ${tweet.image ? (tweet.image.generatedImageId
            ? `<div class="tw-image-card tw-image-generated" data-tweet-id="${tweet.id}" data-is-npc="${isNpcStr}" onclick="event.stopPropagation();Twitter._viewFullImage('${tweet.image.generatedImageId}')">
                <img src="" data-illust-id="${tweet.image.generatedImageId}" class="tw-generated-img" alt="${this._esc(tweet.image.description || '')}">
               </div>`
            : `<div class="tw-image-card tw-image-placeholder${tweet.image.type === 'art' && this._hasImageApi() ? ' tw-image-generating' : ''}" data-tweet-id="${tweet.id}" data-is-npc="${isNpcStr}" style="background:${tweet.image.gradient || 'linear-gradient(135deg,#667eea,#764ba2)'};">
                <img src="${this._imgPlaceholder(tweet.id)}" class="tw-placeholder-img" alt="" loading="lazy">
                ${tweet.image.description ? `<span class="tw-image-desc tw-image-desc-overlay">${this._esc(tweet.image.description)}</span>` : ''}
               </div>`) : ''}
        ${this._renderQuotedTweetHtml(tweet)}
        ${tweet.poll ? this._renderPoll(tweet) : ''}
        ${this._renderPixivLinkCard(tweet)}
        ${this._renderNicoLinkCard(tweet)}
        ${(typeof Wandoro !== 'undefined') ? Wandoro._renderGatedLinkCard(tweet) : ''}
        ${tlBlock}
        <div class="tw-card-footer">
            <button class="tw-action-btn tw-action-reply" onclick="event.stopPropagation();Twitter.openTweet('${this._esc(tweet.id)}',${isNpcStr})" title="${I18n.t('tw.action_reply', 'リプライ')}">${this._svg.chat}<span>${replyCount || ''}</span></button>
            <button class="tw-action-btn tw-action-rt${isRetweeted ? ' tw-retweeted' : ''}" onclick="event.stopPropagation();Twitter.openRetweetMenu('${tweetIdEsc}',${isNpcStr})" title="${I18n.t('tw.action_repost', 'リポスト')}">${isRetweeted ? this._svg.retweetGreen : this._svg.retweet}<span>${rtStr !== '0' ? rtStr : ''}</span></button>
            <button class="${likeClass} tw-action-like" onclick="event.stopPropagation();Twitter.toggleLike('${this._esc(tweet.id)}',${isNpcStr},this)" title="${I18n.t('tw.action_like', 'いいね')}">${heartIcon}<span>${likesStr !== '0' ? likesStr : ''}</span></button>
            <button class="tw-action-btn tw-action-share" title="${I18n.t('tw.action_share', '共有')}">${this._svg.share}</button>
        </div>
    </div>
</div>`;
    },

    // ===== 刷新时间线（两个 Tab 同时更新）=====
    async refreshTimeline() {
        if (this._refreshing) {                                    // v2.123.0 并发锁：刷新中再点直接挡（根治狂点并发 push+saveData 写花数据）
            Utils.showToast(I18n.t('tw.refresh_in_progress', '更新中です…'));
            return;
        }
        this._refreshing = true;
        const btn = document.getElementById('twRefreshBtn');
        if (btn) btn.classList.add('spinning');
        try {
            // 五つのジェネレーター並列（ツイート×2 + 同人イベント + トレンド + 通知）
            // allSettled：一部が失敗（API超限/タイムアウト等）しても成功分は反映し続ける。
            // 旧 Promise.all は1つでも失敗すると全体が「更新失敗」になり、"刷新报错但内容正常" の原因だった。
            const _genLabels = ['npcTweets', 'fanTweets', 'fandomEvent', 'trends', 'notifications', 'wandoro'];
            const _results = await Promise.allSettled([
                this._generateNpcTweets(),
                this._generateFanTweets(),
                this._generateFandomEvent(),
                this._generateTrends(),
                this._generateNotifications(),
                ((typeof Wandoro !== 'undefined') ? Wandoro._maybeWandoroByTime() : Promise.resolve(null))   // v2.129.0 完結後の ワンドロ 時間駆動 → wandoro.js（缺失则 no-op）
            ]);
            _results.forEach((r, i) => {
                if (r.status === 'rejected') console.warn(`[Twitter refresh] ${_genLabels[i]} failed:`, r.reason);
            });
            this.renderTimeline();
            // fandomEvent/notifications/wandoro は内部で try/catch して恒に fulfilled になる（reject しない）ため、
            // 失敗判定は実際に reject し得る npcTweets/fanTweets/trends の3枠だけで見る。全6枠で見ると
            // 常に非rejected枠が残り「全滅」に到達できず、真の全滅時でも成功トーストが出てしまっていた。
            const _realGenIdx = [0, 1, 3];
            const _realFailed = _realGenIdx.map(i => _results[i]).filter(r => r.status === 'rejected');
            if (_realFailed.length === _realGenIdx.length) {
                // 全ジェネレーター失敗 = APIキー失効/ネット全断など本当の異常のみ通知
                const _firstErr = _realFailed[0]?.reason;
                Utils.showToast(I18n.t('t.tw_refresh_failed', '更新失敗：') + (_firstErr?.message || ''));
            } else {
                Utils.showToast(I18n.t('t.tw_timeline_updated', '✓ タイムラインを更新しました'));
            }

            // renderTimeline() 完了後、art 画像の非同期生成を開始
            const t = this._ensureData();
            const allNpcTweets = t.npcTweets || [];
            const artTweets = allNpcTweets.filter(tw => tw.image && tw.image.type === 'art' && !tw.image.generatedImageId);
            if (artTweets.length > 0) {
                this._generateTweetImages(artTweets, true);
            }
        } catch (e) {
            Utils.showToast(I18n.t('t.tw_refresh_failed', '更新失敗：') + e.message);
        } finally {
            this._refreshing = false;
            if (btn) btn.classList.remove('spinning');
        }
    },

    // ===== v2.140.0 推文裁剪：文字推永不裁，只裁图片推 =====
    // 文字推全保留（时间线历史 + 链路A 反查信号自愈，存储走 IndexedDB 不怕涨）；
    // 图片推仍按上限「最近 limit 张 + 点赞」裁剪（省 IDB 图片空间），被裁的删 IDB 图。
    // scope: 'all'（_generateNpcTweets，作用于全部 npcTweets）| 'fan'（fan 生成路径，仅 source==='fan' && !fromSearch）
    _pruneTweets(scope, limit) {
        const t = this._ensureData();
        const inScope = tw => scope === 'all' ? true : (tw.source === 'fan' && !tw.fromSearch);
        const likedIds = new Set((t.likedTweetIds || []).map(l => l.id));
        const imageInScope = t.npcTweets.filter(tw => inScope(tw) && tw.image);
        if (imageInScope.length <= limit) return;
        const keepImageIds = new Set(imageInScope.slice(-limit).map(tw => tw.id));
        // 被裁的图片推（既非最近 limit、也未点赞）→ 删 IDB 生成图
        imageInScope.slice(0, imageInScope.length - limit).forEach(tw => {
            if (tw.image?.generatedImageId && !likedIds.has(tw.id) && !keepImageIds.has(tw.id)) {
                IllustGallery.remove(tw.image.generatedImageId).catch(() => {});
            }
        });
        // 保留：scope 外的、所有文字推、最近 limit 张图、点赞过的
        t.npcTweets = t.npcTweets.filter(tw => {
            if (!inScope(tw)) return true;
            if (!tw.image) return true;                            // 文字推永不裁
            return keepImageIds.has(tw.id) || likedIds.has(tw.id); // 图片推：最近 limit 或点赞
        });
    },

    // ===== AI 生成 NPC 推文 =====
    async _generateNpcTweets() {
        const t = this._ensureData();
        const forumData = AppState.data.forumData || {};
        const npcs = AppState.data.broadcast.officialNpcs || [];
        if (npcs.length === 0) {
            Utils.showToast(I18n.t('t.tw_add_npc_in_broadcast', '放送局でNPCを追加してください'));
            return;
        }

        const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
        const noContextRule = !worldContext.trim() ? '\n⚠️ 作品設定が未入力です。キャラクター関係・CP・主題歌・ストーリーイベントなど具体的な情報は一切言及しないこと。開播前の期待・スタッフの意気込み・制作進捗報告など一般的な内容にとどめること。\n' : '';

        // 各 NPC の最近の投稿（24h 以内、ユーザーが NPC として投稿したもの + AI 生成の NPC 投稿の合算）を集約 — 重複トピック防止
        const RECENT_WINDOW = 24 * 60 * 60 * 1000;
        const nowTs = Date.now();
        const npcRecent = new Map(); // npcId → [{ts, content}]
        const collect = (tw, npcId) => {
            if (!npcId || !tw.content) return;
            if ((nowTs - (tw.timestamp || 0)) > RECENT_WINDOW) return;
            const arr = npcRecent.get(npcId) || [];
            arr.push({ ts: tw.timestamp, content: tw.content });
            npcRecent.set(npcId, arr);
        };
        (t.tweets || []).forEach(tw => {
            const acc = tw.postedAsAccountId || '';
            if (acc.startsWith('npc:')) collect(tw, acc.slice(4));
            else if (tw.postedAsNpcId) collect(tw, tw.postedAsNpcId);
        });
        (t.npcTweets || []).forEach(tw => collect(tw, tw.npcId));
        npcRecent.forEach((arr, k) => {
            arr.sort((a, b) => b.ts - a.ts);
            npcRecent.set(k, arr.slice(0, 3));
        });

        const npcList = npcs.map(n => {
            const head = `・${n.role}：${n.name}（handle: ${this._getNpcHandle(n)}）${Utils.PROMPTS.npcPersonaInline(n)}`;
            const recent = npcRecent.get(n.id);
            if (!recent || !recent.length) return head;
            const lines = recent.map(r => {
                const snippet = r.content.replace(/\n/g, ' ').slice(0, 80);
                const more = r.content.length > 80 ? '…' : '';
                return `    └ ${Utils.timeAgo(r.ts)}: ${snippet}${more}`;
            }).join('\n');
            return `${head}\n  ▼ 直近24時間の投稿:\n${lines}`;
        }).join('\n');

        const dedupRule = npcRecent.size > 0 ? `
【厳守ルール — 直近の投稿との重複禁止】
- 上記「直近24時間の投稿」と同じトピック・同じイベント（イラスト感謝・特定話放送ありがとう・特定告知の言及など）を別のNPCに重複させないこと
- 同じNPCが既に発信した話題を再度蒸し返さないこと
- すでに投稿された画像・告知・ハッシュタグを別の文面で焼き直さないこと
- 必ず「まだ言及されていない切り口・別のトピック」を選ぶこと
` : '';

        // 引用候補プール — 直近 24h 内の NPC 視点ツイート（ユーザーが NPC 身份で投稿したもの + AI 生成 staff ツイート）
        // 同じ tweet が 2 回以上引用されないようカウント
        const quotedCount = new Map();
        (t.npcTweets || []).forEach(nt => {
            if (nt.quotedTweetId) quotedCount.set(nt.quotedTweetId, (quotedCount.get(nt.quotedTweetId) || 0) + 1);
        });

        const quotePool = []; // [{ tweetId, isNpc, npcName, npcRole, content, ts, isUserAuthored }]
        const addToPool = (tw, isNpc, npcId, isUserAuthored) => {
            if (!tw.id || !tw.content) return;
            if ((nowTs - (tw.timestamp || 0)) > RECENT_WINDOW) return;
            if ((quotedCount.get(tw.id) || 0) >= 2) return;
            const npc = npcs.find(n => n.id === npcId);
            if (!npc) return;
            quotePool.push({
                tweetId: tw.id, isNpc,
                npcId: npc.id,
                npcName: npc.name || npc.role,
                npcRole: npc.role || '',
                content: tw.content,
                ts: tw.timestamp || 0,
                isUserAuthored
            });
        };
        (t.tweets || []).forEach(tw => {
            const acc = tw.postedAsAccountId || '';
            if (acc.startsWith('npc:')) addToPool(tw, false, acc.slice(4), true);
            else if (tw.postedAsNpcId) addToPool(tw, false, tw.postedAsNpcId, true);
        });
        (t.npcTweets || []).forEach(tw => {
            if (tw.source === 'fan') return;
            if (tw.quotedTweetId) return; // 引用ツイート自身は再引用候補に入れない
            addToPool(tw, true, tw.npcId, false);
        });
        quotePool.sort((a, b) => b.ts - a.ts);
        const quoteCandidates = quotePool.slice(0, 10);

        // ショートID マップ（[T01], [T02]... → { realId, isNpc }）
        const shortIdMap = new Map();
        const quoteListLines = quoteCandidates.map((q, i) => {
            const sid = `T${(i + 1).toString().padStart(2, '0')}`;
            shortIdMap.set(sid, { realId: q.tweetId, isNpc: q.isNpc, npcId: q.npcId });
            const tag = q.isUserAuthored ? '【ユーザー投稿】' : '';
            const snippet = q.content.replace(/\n/g, ' ').slice(0, 80) + (q.content.length > 80 ? '…' : '');
            return `[${sid}] ${Utils.timeAgo(q.ts)}｜${q.npcName}（${q.npcRole}）${tag}: ${snippet}`;
        }).join('\n');

        const quoteSection = quoteCandidates.length > 0 ? `
【引用候補ツイート（直近24時間 / 自然な反応として一部はこれを引用すること）】
${quoteListLines}

【ユーザー投稿】タグ付きはユーザーが NPC 身份で実際に投稿したツイートです — 別のNPCがこれに反応して引用するのは特に自然です。
` : '';

        const systemPrompt = `あなたはアニメ作品のSNSシミュレーターです。
公式キャラクター・スタッフアカウントがX（Twitter）に投稿するリアルな日本語ツイートを生成してください。
最新エピソードへの反応、制作裏話のヒント、ファンへの感謝、キャラクターの声など、自然な内容にすること。
${noContextRule}
作品設定（以下の事実のみ使用し、捏造しないこと）:
${worldContext || '（未設定）'}
${Utils.PROMPTS.infoAccessRule()}
公式NPCアカウント:
${npcList}
${dedupRule}
${quoteSection}
ルール:
- キャラクターの声で書くこと — 「└ 設定:」があるNPCはその性格・発言スタイル（一人称・口癖・絵文字の癖など）を最優先で再現すること。設定のないNPCのみ職業から推測: 声優はカジュアルで温かく、監督は意味深で情熱的、キャラクターはキャラとして発言
- 自然な日本語Twitterの慣習を使うこと: ハッシュタグ（#アニメ名）、絵文字、短文
- 設定にない剧情イベントを捏造しないこと
- トーンを混ぜること: 盛り上がり、感謝、ミステリアス、遊び心
- 合計4〜6ツイート、NPCごとに1つ（同じNPCを繰り返さない）
- 内訳目安：約70%は新主題ツイート（ACTION: NEW）、約30%は既存ツイートへの引用（ACTION: QUOTE）。引用候補が0件の場合は全部 NEW で構わない
- QUOTE は引用元の発信者と同じNPCにさせないこと（自分が自分の投稿を引用しない）

出力フォーマット（厳守、全フィールド必須）:
---TWEET---
NPC_NAME: [上記リストの名前と完全一致]
ACTION: [NEW か QUOTE のいずれか]
QUOTE_TWEET_ID: [QUOTE時のみ、引用候補の[Txx]ID。NEW時は NONE]
MENTIONS_NPC: [返信先NPCの@handle、なければ空欄]
CONTENT: [ツイート本文。NEWは1-4行、QUOTEは60-120字で引用元への感想・補足・現場視点]
IMAGE_EMOJI: [画像を表すemoji1つ、画像なしの場合NONE。QUOTEは基本NONE]
IMAGE_DESC: [画像の簡潔な説明10字以内、画像なしの場合NONE]
IMAGE_TYPE: [photo/art/screenshot/behind_the_scenes/NONE]
TRANSLATION: [CONTENTの中国語（簡体字）翻訳、1行]
REPLY_1: [ファン名]|[@handle]|[fan/industry/media]|[日本語のリプライ]
REPLY_2: [ファン名]|[@handle]|[fan/industry/media]|[日本語のリプライ]
REPLY_3: [ファン名]|[@handle]|[fan/industry/media]|[日本語のリプライ]

- NEW ツイートの30〜40%に画像を添付すること（behind_the_scenesタイプの写真が自然）
- NEWは3-4件、QUOTEは2-3件のファンリプライを生成すること。自然な会話のために、1-2件はNPC同士の返信にすること（MENTIONS_NPCにそのNPCのhandleを記入）。リプライには絵文字・顔文字を自然に使うこと。
${typeof Utils !== 'undefined' ? Utils.getEventContextPrompt(3) : ''}`;

        const messages = [{ role: 'user', content: 'タイムラインを更新してください。最新の状況に基づいてNPCアカウントのツイートを生成してください。' }];
        const raw = await Utils.callChatAPI(messages, systemPrompt);
        const parsed = this._parseTweets(raw, npcs, shortIdMap);

        if (parsed.length === 0) return;

        const now = Date.now();
        parsed.forEach((tw, i) => {
            const eng = this._genEngagement('staff');
            t.npcTweets.push({
                id: Utils.generateId(),
                source: 'staff',
                npcId: tw.npcId,
                content: tw.content,
                image: tw.image || null,
                translation: tw.translation || null,
                mentionsNpcHandle: tw.mentionsNpcHandle || null,
                quotedTweetId: tw.quotedTweetId || null,
                quotedTweetIsNpc: tw.quotedTweetIsNpc || false,
                afterPlotId: null,
                timestamp: now + i * 5000,
                replies: tw.replies || [],
                likes: eng.likes,
                retweets: eng.retweets,
                savedToForumId: null
            });
        });

        // v2.140.0 文字推永不裁、只裁图片推（最近 50 张 + 点赞）；文字时间线历史全保留
        this._pruneTweets('all', 50);
        Utils.saveData();
    },

    // ===== 解析 NPC 推文文本 =====
    _parseTweets(text, npcs, shortIdMap) {
        const blocks = text.split(/---\s*TWEET\s*---/i).map(s => s.trim()).filter(Boolean);
        const result = [];
        const now = Date.now();
        const IGNORE_MENTIONS = new Set(['blank', 'empty', 'none', '-', 'na', 'n/a', '']);
        for (const block of blocks) {
            const nameMatch = block.match(/^NPC_NAME:\s*(.+)$/m);
            if (!nameMatch) continue;
            const rawName = nameMatch[1].trim();
            // MENTIONS_NPC: optional reply-to
            const mentionsRaw = (block.match(/^MENTIONS_NPC:\s*(.*)$/m) || [])[1]?.trim() || '';
            const mentionsNpcHandle = !IGNORE_MENTIONS.has(mentionsRaw.toLowerCase()) ? mentionsRaw : null;
            // Content: stop before IMAGE_EMOJI, TRANSLATION or REPLY_
            const contentMatch = block.match(/CONTENT:[ \t]*\n?([\s\S]*?)(?=\nIMAGE_EMOJI:|\nTRANSLATION:|\nREPLY_\d|\s*$)/);
            const content = contentMatch ? contentMatch[1].trim() : '';
            if (!content) continue;
            // Translation (optional)
            const tlMatch = block.match(/^TRANSLATION:[ \t]*(.+)$/m);
            const translation = tlMatch ? tlMatch[1].trim() : null;
            // REPLY_n lines: 名前|@handle|type|content
            const replies = [];
            const replyRe = /^REPLY_\d+:\s*(.+)$/mg;
            let rm;
            while ((rm = replyRe.exec(block)) !== null) {
                const parts = rm[1].split('|');
                if (parts.length >= 4) {
                    const rType = parts[2].trim();
                    replies.push({
                        id: Utils.generateId(),
                        author: parts[0].trim(),
                        handle: parts[1].trim(),
                        authorRole: ['fan', 'industry', 'media', 'npc'].includes(rType) ? rType : 'fan',
                        content: parts.slice(3).join('|').trim(),
                        timestamp: now + replies.length * 15000
                    });
                }
            }
            // 匹配 NPC
            const npc = npcs.find(n =>
                n.name === rawName || n.role === rawName ||
                rawName.includes(n.name) || rawName.includes(n.role)
            );
            if (!npc) continue;

            // ACTION + QUOTE_TWEET_ID（v2.61.3 引入）
            const actionRaw = (block.match(/^ACTION:\s*(.+)$/m) || [])[1]?.trim().toUpperCase() || 'NEW';
            const quoteIdRaw = (block.match(/^QUOTE_TWEET_ID:\s*(.+)$/m) || [])[1]?.trim() || '';
            let quotedTweetId = null;
            let quotedTweetIsNpc = false;
            if (actionRaw === 'QUOTE' && shortIdMap && quoteIdRaw && quoteIdRaw.toUpperCase() !== 'NONE') {
                const sidMatch = quoteIdRaw.match(/T\d+/i);
                const sid = sidMatch ? sidMatch[0].toUpperCase() : '';
                const lookup = shortIdMap.get(sid);
                // 引用元の発信者が自分自身の場合はスキップ（QUOTEを無効化してNEW扱い）
                if (lookup && lookup.npcId !== npc.id) {
                    quotedTweetId = lookup.realId;
                    quotedTweetIsNpc = !!lookup.isNpc;
                }
            }

            // 画像（オプション）— QUOTEには基本付かない
            const imgEmoji = (block.match(/^IMAGE_EMOJI:\s*(.+)$/m) || [])[1]?.trim();
            const imgDesc = (block.match(/^IMAGE_DESC:\s*(.+)$/m) || [])[1]?.trim();
            const imgType = (block.match(/^IMAGE_TYPE:\s*(.+)$/m) || [])[1]?.trim();
            const image = (!quotedTweetId && imgEmoji && imgEmoji !== 'NONE')
                ? { emoji: imgEmoji, description: imgDesc || '', gradient: this._imageGradient(imgType), type: imgType || '' }
                : null;
            result.push({ npcId: npc.id, content, translation, replies, mentionsNpcHandle, image, quotedTweetId, quotedTweetIsNpc });
        }
        return result;
    },

    // ===== AI 生成路人/业界人推文（おすすめタブ用）=====
    _getFandomPhase() {
        const plots = AppState.data.broadcast.plotProgress || [];
        const count = plots.length;
        if (count <= 3) return 'early';   // 前期：開播前〜序盤
        if (count <= 8) return 'mid';     // 中期：物語が動き始めた
        return 'late';                    // 後期：ファンダム成熟
    },

    _getPhaseTypeRule() {
        const phase = this._getFandomPhase();
        const gate = (typeof Melonbooks !== 'undefined' && Melonbooks.getEventTopicGate)
            ? Melonbooks.getEventTopicGate()
            : { open: false, stage: null, events: [], topics: [] };

        // ── 展会三类型（event_promo/haul/repo）の解禁は即売会闸门が決める（剧情集数では決めない）──
        let eventRule;
        if (!gate.open) {
            eventRule = 'event_promo / event_haul / event_repo は使用禁止（現在、開催中・開催間近の同人即売会が無いため）。';
        } else if (gate.stage === 'preopen') {
            eventRule = 'event_promo のみ使用可（即売会が開催間近 — 参加告知・新刊予告）。event_haul / event_repo はまだ禁止。';
        } else if (gate.stage === 'open') {
            eventRule = 'event_promo / event_haul / event_repo すべて使用可（即売会開催中）。';
        } else { // closed
            eventRule = 'event_haul / event_repo のみ使用可（即売会が終了直後 — 戦利品・参加レポ）。event_promo は禁止。';
        }

        // ── cp_fan / organizer / radio_drama は従来通りファンダム段階（剧情集数）で制御 ──
        let phasePart;
        if (phase === 'early') {
            phasePart = 'ファンダム初期段階（開播前〜序盤）。cp_fan / organizer / radio_drama は使用禁止（まだファンダムが成熟していないため）。使用可: fan, doujin_writer, doujin_artist, fanart_share, industry, media。';
        } else if (phase === 'mid') {
            phasePart = 'ファンダム中期段階。cp_fan / organizer は使用可。radio_drama はまだ禁止（ドラマCDはファンダム後期に登場）。';
        } else {
            phasePart = 'ファンダム後期段階。cp_fan / organizer / radio_drama すべて使用可。';
        }

        return `\n⚠️ タイプ制限:\n- ${phasePart}\n- ${eventRule}\n`;
    },

    async _generateFanTweets() {
        const t = this._ensureData();
        const forumData = AppState.data.forumData || {};
        const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
        const noContextRule = !worldContext.trim() ? '\n⚠️ 作品設定が未入力です。キャラクター名・CP・主題歌・ストーリーイベント・ドラマCDなど具体的な作品情報は一切言及しないこと。開播前の期待・新作アニメへの一般的な反応・同人活動の日常トークにとどめること。cp_fanタイプは生成しないこと。\n' : '';
        const phaseRule = this._getPhaseTypeRule();
        // 展会闸门：doujin_writer / doujin_artist 类型の即売会引导 + 全局禁令 / 即売会情報の注入に使う
        const eventGate = (typeof Melonbooks !== 'undefined' && Melonbooks.getEventTopicGate)
            ? Melonbooks.getEventTopicGate()
            : { open: false, stage: null, events: [], topics: [] };
        const doujinEventBit = eventGate.open ? '、同人誌即売会の話題' : '';
        const eventGatePrompt = eventGate.open
            ? `\n【同人即売会の状況】現在「${eventGate.stage === 'open' ? '開催中' : eventGate.stage === 'preopen' ? '開催間近' : '終了直後'}」の同人即売会: ${eventGate.events.map(e => e.name + (e.venue ? `（${e.venue}）` : '')).join('、')}。即売会関連のツイートはこの状況に即すること（話題の中心: ${eventGate.topics.join('・')}）。`
            : `\n⚠️【同人即売会の禁止事項】現在、開催中・開催間近の同人即売会は存在しない。すべてのツイートタイプにおいて、同人即売会・同人イベント（コミケ / オンリー / オンライン即売会など）に関する話題 — 参加予定・新刊予告・戦利品・参加レポなど — を一切捏造・言及しないこと。`;

        const systemPrompt = `あなたはアニメ・メディア作品のX（Twitter）「おすすめ」タイムラインをシミュレーションしています。
ランダムなファンや業界関係者からのツイートを生成してください — 公式スタッフアカウントではありません。
${noContextRule}${phaseRule}
混ぜるべきペルソナの種類:
- ファン (fan): 一般視聴者、普通のハンドルネームのファン（例: @yoru_anime_09, @sakura_zuki）
- 文手 (doujin_writer): 二次創作の文章を書く同人作家。新刊告知、WIP共有、pixivリンク、執筆進捗、スランプ、校正地獄${doujinEventBit}など（例: @yorukami_fic, @pen_name_yoru）
- 絵師 (doujin_artist): 二次創作の絵を描く同人作家。ファンアート共有、コマ漫画、ラフ・落書き投稿など（例: @illustr_mimi, @sakura_art_05）
- CP厨 (cp_fan): 推しカプ特化アカウント。カプ解釈、妄想、尊い瞬間の叫び、カプ名ハッシュタグ、CP考察、組み合わせ議論など（例: @AB推し_forever, @axb_is_canon）
- 企画主 (organizer): ファンダム企画の主催者。お題企画、ワンドロ（1時間お絵描き）、○○版深夜の創作クラスタ、推しカプ○選、記念日企画など（例: @anime_odai, @fandom_matsuri）
- イベント告知 (event_promo): 即売会前のサークル参加告知・新刊予告。「○○に参加します！スペースはX-00」「新刊サンプルはこちら→」
- 戦利品報告 (event_haul): 即売会後の戦利品報告。「今日の戦利品！」「完売してた…」「戦利品が多すぎて鞄が重い」
- イベントレポ (event_repo): 即売会の参加感想。「会場の雰囲気最高だった」「完売ありがとうございました」
- ファンアート (fanart_share): 二次創作イラスト共有。「描きました！」「落書きですが」「ラフですが見てください」
- ドラマCD感想 (radio_drama): ドラマCD・ラジオ・キャラソン感想。「ドラマCD聴いた…やばい」「キャラソンの歌詞がエモい」
- 業界 (industry): 他作品の声優、イラストレーター、雑誌編集者、たまたま視聴したクリエイター
- メディア (media): アニメニュースアカウント、ランキングブログ、レビューサイト

作品設定（公開済み情報のみ参照し、捏造しないこと）:
${worldContext || '（未設定）'}
${Utils.PROMPTS.infoAccessRule()}
ルール:
- 公開済み情報のみ知っている外部の人物であること
- 自然なカジュアル日本語で書くこと: 草 / やば / 覇権 / 泣いた / 刺さった / 沼った / 待ってこれ / 尊い / 無理 / しんどい 等
- ハッシュタグと絵文字を自然に含めること
- 文手 (doujin_writer) は創作活動の日常を投稿すること（「新刊の表紙できた！」「pixivに短編上げました」「原稿が進まない…」）
- doujin_writer が「pixivに〜を上げた/投稿した/公開した」と自作小説を告知するツイートで、その作品が上記「pixiv 新作情報」に存在しない場合は、PIXIV_NOVEL_ID は NONE のまま PIXIV_PROMO: yes を付けること。読者がカードをタップした瞬間にアプリ内でその作品を生成して読めるようにするため。その場合ツイート本文には作品のCP・シチュエーション・ネタが具体的に伝わるように書くこと（後で小説本文を生成する種になる）。
- 絵師 (doujin_artist) はラフ・落書き・進捗イラストを投稿すること（「描きました！」「ラフですが見てください」）
- CP厨は推しカプへの感情を全力で表現すること（「あのシーンのAB解釈が天才すぎる」「今日もABが尊い」）
- 企画主は参加型のツイートをすること（「#○○ワンドロ 本日のお題は『再会』です！」「推しカプ5選タグやりませんか」）
- 未公開のストーリーイベントを捏造しないこと
- 反応のバリエーション: 盛り上がり、感動、創作報告、CP語り、企画告知、分析的、カジュアル
- 全タイプが均等に混ざるように — 特にdoujin_writer/doujin_artist/cp_fan/organizerを必ず含めること（上記のフェーズ制限に従うこと）

${typeof Utils !== 'undefined' ? Utils.getEventContextPrompt(3) : ''}${eventGatePrompt}
${this._buildFanFriendsPrompt()}
${this._buildDoujinWriterNewWorksPrompt()}
出力フォーマット（厳守、全フィールド必須）:
---FANTWEET---
NAME: [アカウント名]
HANDLE: [@handle]
TYPE: [fan/industry/media/doujin_writer/doujin_artist/cp_fan/organizer/event_promo/event_haul/event_repo/fanart_share/radio_drama]
CONTENT: [ツイート本文]
IMAGE_EMOJI: [画像を表すemoji1つ、画像なしの場合NONE]
IMAGE_DESC: [画像の簡潔な説明10字以内、画像なしの場合NONE]
IMAGE_TYPE: [photo/art/screenshot/NONE]
QUOTE_AUTHOR: [引用元の発信者名、引用ツイートでない場合NONE]
QUOTE_HANDLE: [引用元の@handle、NONEの場合省略可]
QUOTE_CONTENT: [引用元ツイートの内容1-2行、NONEの場合省略可]
PIXIV_NOVEL_ID: [上記「pixiv 新作情報」の pixiv ID をそのまま記入、NPC 自宣推用、自宣でない場合 NONE]
PIXIV_PROMO: [このツイートが「自分の新作pixiv小説を投稿/告知」する自宣ツイートで、かつ PIXIV_NOVEL_ID が NONE（上記「pixiv 新作情報」に該当作品が無い）の場合のみ yes。それ以外（単なるpixivへの言及・感想・他人の作品の話題、または告知でない場合）は NONE]
TRANSLATION: [CONTENTの中国語（簡体字）翻訳、1行]
REPLY_1: [名前]|[@handle]|[fan/industry/media/doujin_writer/doujin_artist/cp_fan]|[日本語のリプライ]
REPLY_2: [名前]|[@handle]|[fan/industry/media/doujin_writer/doujin_artist/cp_fan]|[日本語のリプライ]

6〜8ツイート（うち1件はスレッド）、各2-3リプライを生成すること。doujin_writer、doujin_artist、cp_fan、organizerのタイプを合計3件以上含めること（フェーズ制限で禁止されていない場合）。fanart_share等の創作系タイプも適度に混ぜること。
- ツイートの30〜40%に画像を添付すること（doujin_artist/fanart_shareタイプには必ず画像をつけること）
- 8ツイートのうち1-2件を引用ツイート（QUOTE_*フィールド使用）として生成すること
- 1件はスレッド形式（---FANTHREAD---）で生成すること。考察・レビュー・イベントレポなど長文向きの内容に使う:
---FANTHREAD---
NAME: [アカウント名]
HANDLE: [@handle]
TYPE: [fan/doujin_writer/doujin_artist/cp_fan等]
PIXIV_PROMO: [このスレッドが「自分の新作pixiv小説を投稿/告知」する自宣スレッドで、かつ該当作品が上記「pixiv 新作情報」に無い場合のみ yes。それ以外は NONE]
THREAD_1: [1/n ツイート本文]
THREAD_2: [2/n ツイート本文]
THREAD_3: [3/n ツイート本文]
TRANSLATION: [全体の中国語翻訳1-2行]
- 1件は投票ツイートにすること。FANTWEETフォーマットでCONTENTの後にPOLL行を追加:
POLL: [選択肢1]|[票数]||[選択肢2]|[票数]||[選択肢3]|[票数]||[選択肢4]|[票数]
（票数は100〜5000のリアルな数字。選択肢は2-4個）`;

        const messages = [{ role: 'user', content: '最新情報をもとに、ファンや業界関係者のリアルなツイートを生成してください。' }];
        const raw = await Utils.callChatAPI(messages, systemPrompt);
        const parsed = this._parseFanTweets(raw);

        if (parsed.length === 0) return;

        // fan friend のhandle一致性を保証
        const friends = t.fanFriends || [];
        parsed.forEach(tw => {
            const friend = friends.find(f => f.handle === tw.handle);
            if (friend) { tw.name = friend.name; }
        });

        // v2.123.0 链路A：对文手推代码确定性反查作者近期未宣传新作 → 挂 pixivNovelId（不靠 LLM 填，学微博 linkedLofterArticleId）
        const _promotedWriters = new Set();   // 节制④：同一作者本次刷新最多挂一篇（防长帖/同人多条重复挂卡）
        // v2.128.0 修复链路A重复自宣链路B小说：已被任意推文链接过的小说 id（含链路B点击回填、A 历次自宣）→ A 永不二次宣传。
        // 用「出生即定」的判据（fromTweetId / 已链接 id）替代仅靠运行时设 promotedOnTwitter（并行 generator + 快速连刷下时序不可靠）。
        const _linkedNovelIds = new Set((t.npcTweets || []).map(x => x.pixivNovelId).filter(Boolean));
        parsed.forEach(tw => {
            if (tw.type !== 'doujin_writer') { tw.pixivNovelId = null; return; }   // v2.140.0(B)：pixiv 小说卡只允许出现在文手自宣推，清掉 LLM 给其它类型误填的 ID
            tw.pixivNovelId = null;                                     // v2.140.0(B)：文手推的卡也完全由下方代码反查决定，先清 LLM 填值（防 LLM 重复指认已宣传作品 → 重复卡）
            if (tw.threadIndex != null && tw.threadIndex > 0) return;   // 节制⑤：长帖只有首条(i===0)带 pixiv 卡，与解析期约束一致
            const writer = friends.find(f => f.type === 'doujin_writer' && (f.handle === tw.handle || f.pixivHandle === tw.handle));
            if (!writer) return;
            if (_promotedWriters.has(writer.id)) return;                 // 节制④：同作者本刷已挂过、不再挂第二篇
            const promote = writer.promoteStyle || 'occasional';
            const chance = promote === 'active' ? 1.0 : (promote === 'shy' ? 0.05 : 0.3);
            if (Math.random() > chance) return;                          // 节制②：promoteStyle 个性闸（保留作者性格、代码可靠执行非 LLM 掷骰）
            const novels = (AppState.data.pixivData && AppState.data.pixivData.novels) || [];
            const recent = novels
                .filter(n => n.author_npc_id === writer.id && !n.fromTweetId && !n.promotedOnTwitter && !_linkedNovelIds.has(n.id) && n.createdAt && (Date.now() - n.createdAt) < 3 * 86400000)
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];   // 取最新一篇
            if (!recent) return;                                         // 节制③：必须真有近期未宣传新作（链路B 出身 fromTweetId 的不算、已被任意推文链接过的不算）
            tw.pixivNovelId = recent.id;                                 // 代码确定性挂、覆盖 LLM 填值
            tw.pixivPromo = false;                                       // 有真作品、不走链路B 懒生成
            recent.promotedOnTwitter = true;                            // 已宣传标记（快路径；真正的去重靠 fromTweetId + _linkedNovelIds）
            _linkedNovelIds.add(recent.id);                            // v2.128.0 本刷内立即登记、防同批次/后续刷新重复挂同一篇
            _promotedWriters.add(writer.id);
        });
        // promotedOnTwitter 的持久化由本函数尾部 Utils.saveData()（push loop 后必跑）统一落盘，避免一次刷新重复全量写

        const now = Date.now();
        parsed.forEach((tw, i) => {
            const eng = this._genEngagement('fan', tw.type);
            t.npcTweets.push({
                id: Utils.generateId(),
                source: 'fan',
                npcId: null,
                authorName: tw.name,
                authorHandle: tw.handle,
                authorType: tw.type,
                content: tw.content,
                image: tw.image || null,
                quotedTweet: tw.quotedTweet || null,
                poll: tw.poll || null,
                threadId: tw.threadId || null,
                threadIndex: tw.threadIndex != null ? tw.threadIndex : null,
                translation: tw.translation || null,
                timestamp: now + i * (tw.threadId ? 1000 : 7000),
                replies: tw.replies || [],
                likes: eng.likes,
                retweets: eng.retweets,
                savedToForumId: null,
                pixivNovelId: tw.pixivNovelId || null,  // v2.121.0 doujin_writer 自宣推 → app 内 pixiv 小说关联(修复历史漏字段)
                pixivPromo: tw.pixivPromo || false,  // v2.122.0 链路B: 自宣推待生成标记（懒生成小说用）
                gated: tw.gated || null  // v2.126.0 ワンドロ privatter/poipiku 外链揭示卡（门后懒生成）
            });
        });

        // v2.140.0 fan 文字推永不裁（含自宣推→链路A 反查信号自愈）、只裁 fan 图片推（最近 60 张 + 点赞）
        this._pruneTweets('fan', 60);
        Utils.saveData();
    },

    // ===== AI 生成同人イベント（タグ企画）=====
    async _generateFandomEvent() {
        const t = this._ensureData();
        const forumData = AppState.data.forumData || {};
        const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');

        // 生贺系统（v2.205.0）：纪念日当日首刷强制出生贺祭り（当日戳防重，防一天多刷撞车企画）；
        // preheat/afterglow 只影响下方 annivRule 选题倾向，不迂回确率闸门
        const annivActive = (typeof Anniversary !== 'undefined') ? Anniversary.getActive() : [];
        const annivToday = annivActive.filter(ev => ev.phase === 'day');
        const _n = new Date();
        const annivStamp = `${_n.getMonth() + 1}/${_n.getDate()}|${annivToday.map(ev => ev.name).join('、')}`;
        const annivForce = annivToday.length > 0 && t.anniversaryKikakuDone !== annivStamp;

        // フェーズに応じた生成確率: 前期10%、中期25%、後期30%（記念日当日の初回は迂回）
        const phase = this._getFandomPhase();
        const eventChance = phase === 'early' ? 0.1 : phase === 'mid' ? 0.25 : 0.3;
        if (!annivForce && Math.random() > eventChance) return;

        const noContextRule = !worldContext.trim() ? '\n⚠️ 作品設定が未入力です。キャラクター名・CP名を含む企画は生成しないこと。一般的な創作企画（ワンドロお題、深夜の創作クラスタ等）にとどめること。\n' : '';
        // 展会系企划（新刊サンプル公開祭り / 即売会サークル告知祭り）は即売会闸门で制御（剧情集数ではない）
        const eventGate = (typeof Melonbooks !== 'undefined' && Melonbooks.getEventTopicGate)
            ? Melonbooks.getEventTopicGate()
            : { open: false, stage: null, events: [], topics: [] };
        const eventGateRule = eventGate.open
            ? `\n【同人即売会の状況】現在「${eventGate.stage === 'open' ? '開催中' : eventGate.stage === 'preopen' ? '開催間近' : '終了直後'}」の同人即売会あり。即売会系の企画（新刊サンプル公開祭り、即売会サークル告知祭り）も選択可。`
            : '\n⚠️ 現在、開催中・開催間近の同人即売会は無い。即売会系の企画（新刊サンプル公開祭り、即売会サークル告知祭り）は選択禁止。ワンドロ・お題配布・深夜の創作クラスタ・記念日企画などの非即売会企画のみ生成すること。\n';

        // 生贺相位选题：day 首刷=强制記念日企画（事件名来自用户日历=用户数据，最優先指示
        // 覆盖 noContextRule 的「不含角色名」限制——名字是给定的、非 LLM 捏造）；
        // preheat=告知/倒数优先；afterglow=感想/まとめ可选。day 非首刷走 worldContext 渗透即可。
        let annivRule = '';
        if (annivForce) {
            annivRule = `\n【本日の記念日（最優先指示）】本日は${annivToday.map(ev => `【${ev.name}】`).join('・')}当日。企画は必ず「記念日企画」を選び、これを祝うタグ企画にすること（記念日の名前は上記をそのまま使うこと）。\n`;
        } else {
            const pre = annivActive.filter(ev => ev.phase === 'preheat');
            const after = annivActive.filter(ev => ev.phase === 'afterglow');
            if (pre.length) annivRule += `\n【近日の記念日】${pre.map(ev => `【${ev.name}】まであと${ev.daysUntil}日`).join('、')}。企画を生成する場合、記念日の告知・カウントダウン企画を優先的に検討すること。\n`;
            if (after.length) annivRule += `\n【昨日の記念日】昨日は${after.map(ev => `【${ev.name}】`).join('・')}だった。昨日の記念日タグの感想・まとめ企画も選択可。\n`;
        }

        const systemPrompt = `あなたはアニメファンダムのX（Twitter）同人イベント・タグ企画をシミュレーションしています。
日本の二次創作コミュニティでよくある「タグ企画」を1つ選び、それに参加する複数のファンのツイートを生成してください。
${noContextRule}${eventGateRule}${annivRule}

企画の例（1つ選択）:
- 推しカプ○選：好きなシーンやモーメントをリストアップ
- ○○版深夜の創作クラスタ：深夜にゆるく語り合う
- 記念日企画：キャラの誕生日や作品の記念日を祝う
- お題配布：「#○○お題」でSS・イラストネタを配る
- 新刊サンプル公開祭り：同人誌のサンプルを投稿するイベント
- 即売会サークル告知祭り：「○○に参加します！」をみんなで投稿
- ドラマCD感想会：新作ドラマCDの感想を語り合う

作品設定（公開済み情報のみ参照し、捏造しないこと）:
${worldContext || '（未設定）'}
${Utils.PROMPTS.infoAccessRule()}
ルール:
- 1つの企画テーマに統一されたハッシュタグを使うこと
- 主催者の告知ツイート1件 + 参加者のツイート2-3件を生成
- 自然なカジュアル日本語で書くこと
- 同人創作の雰囲気を大切に: WIP報告、感想、参加表明、成果物の説明など
- 未公開のストーリーイベントを捏造しないこと
- 参加者の反応は温かくポジティブなものにすること

出力フォーマット（厳守）:
---FANTWEET---
NAME: [アカウント名]
HANDLE: [@handle]
TYPE: [organizer/doujin_writer/doujin_artist/cp_fan/fan]
CONTENT: [ツイート本文]
TRANSLATION: [CONTENTの中国語（簡体字）翻訳、1行]

3〜4ツイートを生成すること。最初の1件は必ず企画主催者(organizer)のツイートにすること。`;

        try {
            const messages = [{ role: 'user', content: '同人イベント・タグ企画のツイートを生成してください。' }];
            const raw = await Utils.callChatAPI(messages, systemPrompt);
            const parsed = this._parseFanTweets(raw);

            if (parsed.length === 0) return;

            const now = Date.now();
            // イベント推文は近い時刻に集中させる（コミュニティ感）
            parsed.forEach((tw, i) => {
                const eng = this._genEngagement('fan', tw.type);
                t.npcTweets.push({
                    id: Utils.generateId(),
                    source: 'fan',
                    npcId: null,
                    authorName: tw.name,
                    authorHandle: tw.handle,
                    authorType: tw.type,
                    content: tw.content,
                    translation: tw.translation || null,
                    timestamp: now + i * 2000, // 短い間隔（イベント感）
                    replies: tw.replies || [],
                    likes: eng.likes,
                    retweets: eng.retweets,
                    savedToForumId: null
                });
            });

            if (annivForce) t.anniversaryKikakuDone = annivStamp; // 当日祭り已出，再刷回归随机闸门（跨日戳失配自动失效）

            // v2.140.0 fan 文字推永不裁、只裁 fan 图片推（最近 60 张 + 点赞）
            this._pruneTweets('fan', 60);
            Utils.saveData();
            Utils.emitEvent('tweet_event', 'twitter', { title: parsed[0]?.content?.slice(0, 40) || 'ファンダムイベント', summary: `${parsed.length}件のイベントツイート` });
        } catch (e) {
            console.warn('[Twitter FandomEvent]', e);
        }
    },

    // ===== 解析路人推文格式 =====
    _parseFanTweets(text) {
        // スレッドブロックを先に抽出してFANTWEETに変換
        const threadRe = /---\s*FANTHREAD\s*---\s*\n([\s\S]*?)(?=---\s*FAN(?:TWEET|THREAD)\s*---|$)/gi;
        let threadMatch;
        const threadTweets = [];
        while ((threadMatch = threadRe.exec(text)) !== null) {
            const tb = threadMatch[1].trim();
            const tName = (tb.match(/^NAME:\s*(.+)$/m) || [])[1]?.trim() || 'ファン';
            const tHandle = (tb.match(/^HANDLE:\s*(.+)$/m) || [])[1]?.trim() || '@user';
            const tType = (tb.match(/^TYPE:\s*(.+)$/m) || [])[1]?.trim() || 'fan';
            const tTl = (tb.match(/^TRANSLATION:\s*(.+)$/m) || [])[1]?.trim() || null;
            const tPromoRaw = (tb.match(/^PIXIV_PROMO:\s*(.+)$/m) || [])[1]?.trim();
            const tPixivPromo = !!(tPromoRaw && /^yes\b/i.test(tPromoRaw));
            let tPixivNovelId = (tb.match(/^PIXIV_NOVEL_ID:\s*(.+)$/m) || [])[1]?.trim();
            if (!tPixivNovelId || tPixivNovelId === 'NONE') tPixivNovelId = null;
            const threadParts = [];
            const partRe = /^THREAD_(\d+):\s*(.+)$/gm;
            let pm;
            while ((pm = partRe.exec(tb)) !== null) threadParts.push(pm[2].trim());
            if (threadParts.length >= 2) {
                const threadId = 'thread_' + Utils.generateId();
                threadParts.forEach((content, i) => {
                    threadTweets.push({ name: tName, handle: tHandle, type: tType, content, translation: i === 0 ? tTl : null, replies: [], image: null, quotedTweet: null, threadId, threadIndex: i, threadTotal: threadParts.length, pixivPromo: i === 0 ? tPixivPromo : false, pixivNovelId: i === 0 ? tPixivNovelId : null });
                });
            }
        }

        // v2.122.0 single 解析前先剥掉 FANTHREAD 块（threadRe 已先抽取完毕、不受影响）；
        // 否则 thread 块会黏在前一条 single 的 block 末尾、其 PIXIV_PROMO 等字段污染该 single
        const textNoThreads = text.replace(/---\s*FANTHREAD\s*---\s*\n[\s\S]*?(?=---\s*FAN(?:TWEET|THREAD)\s*---|$)/gi, '');
        const blocks = textNoThreads.split(/---\s*FANTWEET\s*---/i).map(s => s.trim()).filter(Boolean);
        const now = Date.now();
        const singleTweets = blocks.map(block => {
            const name = (block.match(/^NAME:\s*(.+)$/m) || [])[1]?.trim() || 'ファン';
            const handle = (block.match(/^HANDLE:\s*(.+)$/m) || [])[1]?.trim() || '@user';
            const rawType = (block.match(/^TYPE:\s*(.+)$/m) || [])[1]?.trim() || 'fan';
            const validTypes = ['fan', 'industry', 'media', 'doujin_writer', 'doujin_artist', 'cp_fan', 'organizer', 'event_promo', 'event_haul', 'event_repo', 'fanart_share', 'radio_drama'];
            const type = validTypes.includes(rawType) ? rawType : 'fan';
            // Content: stop before 任何结构化字段（v2.125.0：补全 POLL/PIXIV_*/IMAGE_DESC 等边界，
            // 否则 LLM 把 POLL 行紧跟 CONTENT 后时会被吞进正文当文字显示——作者真机发现的投票推 bug）
            const contentMatch = block.match(/CONTENT:[ \t]*\n?([\s\S]*?)(?=\nIMAGE_EMOJI:|\nIMAGE_DESC:|\nIMAGE_TYPE:|\nQUOTE_AUTHOR:|\nQUOTE_HANDLE:|\nQUOTE_CONTENT:|\nPIXIV_NOVEL_ID:|\nPIXIV_PROMO:|\nPIXIV_LINK:|\nPRIVATTER:|\nPOIPIKU:|\nGATED_TITLE:|\nODAI:|\nR18:|\nPASS:|\nPASS_HINT:|\nPOIP_CAT:|\nPOLL:|\nTRANSLATION:|\nREPLY_\d|\s*$)/);
            const content = contentMatch ? contentMatch[1].trim() : '';
            // 画像（オプション）
            const imgEmoji = (block.match(/^IMAGE_EMOJI:\s*(.+)$/m) || [])[1]?.trim();
            const imgDesc = (block.match(/^IMAGE_DESC:\s*(.+)$/m) || [])[1]?.trim();
            const imgType = (block.match(/^IMAGE_TYPE:\s*(.+)$/m) || [])[1]?.trim();
            const image = (imgEmoji && imgEmoji !== 'NONE') ? { emoji: imgEmoji, description: imgDesc || '', gradient: this._imageGradient(imgType), type: imgType || '' } : null;
            // 引用ツイート（オプション）
            const qtAuthor = (block.match(/^QUOTE_AUTHOR:\s*(.+)$/m) || [])[1]?.trim();
            const qtHandle = (block.match(/^QUOTE_HANDLE:\s*(.+)$/m) || [])[1]?.trim();
            const qtContent = (block.match(/^QUOTE_CONTENT:\s*(.+)$/m) || [])[1]?.trim();
            const quotedTweet = (qtAuthor && qtAuthor !== 'NONE') ? { authorName: qtAuthor, authorHandle: qtHandle || '@user', content: qtContent || '', avatarColor: '#888' } : null;
            // v2.121.0 PIXIV_NOVEL_ID（NPC 自宣推用、app 内 pixiv 小说 id、optional）
            // LLM は内部 novel id をそのまま返す。旧フォーマット(PIXIV_LINK の外部 URL)も後方互換で id を抽出
            let pixivNovelId = (block.match(/^PIXIV_NOVEL_ID:\s*(.+)$/m) || [])[1]?.trim();
            if (!pixivNovelId || pixivNovelId === 'NONE') {
                const legacyLink = (block.match(/^PIXIV_LINK:\s*(.+)$/m) || [])[1]?.trim();
                const m = (legacyLink && legacyLink !== 'NONE') ? legacyLink.match(/[?&]id=([^&\s]+)/) : null;
                pixivNovelId = m ? m[1] : null;
            }
            // v2.122.0 PIXIV_PROMO（自宣推だが小説未生成 → 懒生成カード表示用）
            const pixivPromoRaw = (block.match(/^PIXIV_PROMO:\s*(.+)$/m) || [])[1]?.trim();
            const pixivPromo = !!(pixivPromoRaw && /^yes\b/i.test(pixivPromoRaw));
            // v2.129.0 ワンドロ privatter/poipiku 外链揭示卡解析 → 抽到 wandoro.js（公开版 omit 文件即无 R-18 脚手架）
            const gated = (typeof Wandoro !== 'undefined' && Wandoro.parseGated) ? Wandoro.parseGated(block) : null;
            // 投票（オプション）
            const pollRaw = (block.match(/^POLL:\s*(.+)$/m) || [])[1]?.trim();
            let poll = null;
            if (pollRaw) {
                const opts = pollRaw.split('||').map(p => { const [text, votes] = p.split('|').map(s => s.trim()); return { text: text || '', votes: parseInt(votes) || 0 }; }).filter(o => o.text);
                if (opts.length >= 2) { poll = { options: opts, totalVotes: opts.reduce((s, o) => s + o.votes, 0), userVoteIndex: null }; }
            }
            // Translation
            const tlMatch = block.match(/^TRANSLATION:[ \t]*(.+)$/m);
            const translation = tlMatch ? tlMatch[1].trim() : null;
            // REPLY_n
            const replies = [];
            const replyRe = /^REPLY_\d+:\s*(.+)$/mg;
            let rm;
            while ((rm = replyRe.exec(block)) !== null) {
                const parts = rm[1].split('|');
                if (parts.length >= 4) {
                    const rType = parts[2].trim();
                    replies.push({
                        id: Utils.generateId(),
                        author: parts[0].trim(),
                        handle: parts[1].trim(),
                        authorRole: [...validTypes, 'npc'].includes(rType) ? rType : 'fan',
                        content: parts.slice(3).join('|').trim(),
                        timestamp: now + replies.length * 15000
                    });
                }
            }
            return { name, handle, type, content, translation, replies, image, quotedTweet, poll, pixivNovelId, pixivPromo, gated };
        }).filter(r => r.content);
        return [...singleTweets, ...threadTweets];
    },

};
