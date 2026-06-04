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
        container.innerHTML = spacesHtml + followingNpcHtml + grouped.map(item => {
            if (item.type === 'thread') {
                return `<div class="tw-thread-group">${item.tweets.map(({ tweet: tw, isNpc, retweetedByName }, i) => {
                    const isLast = i === item.tweets.length - 1;
                    const card = this._renderTweetCard(tw, isNpc, false, retweetedByName);
                    return isLast ? card : card.replace('class="tw-card"', 'class="tw-card tw-thread-connected"');
                }).join('')}</div>`;
            }
            return this._renderTweetCard(item.tweet, item.isNpc, false, item.retweetedByName);
        }).join('');
        this._likedSet = null;

        // 生成済み画像をロード
        this._loadGeneratedImages(container);
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
            : `<div class="tw-image-card${tweet.image.type === 'art' && this._hasImageApi() ? ' tw-image-generating' : ''}" data-tweet-id="${tweet.id}" data-is-npc="${isNpcStr}" style="background:${tweet.image.gradient || 'linear-gradient(135deg,#667eea,#764ba2)'};">
                <span class="tw-image-emoji">${tweet.image.emoji || '🖼️'}</span>
                <span class="tw-image-desc">${this._esc(tweet.image.description || '')}</span>
               </div>`) : ''}
        ${this._renderQuotedTweetHtml(tweet)}
        ${tweet.poll ? this._renderPoll(tweet) : ''}
        ${tweet.pixivLink ? `<a class="tw-pixiv-link-card" href="${this._esc(tweet.pixivLink)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">
            <div class="tw-pixiv-link-icon">📕</div>
            <div class="tw-pixiv-link-text">${I18n.t('tw.profile_pixiv_link_card_title', 'pixiv で読む')}</div>
        </a>` : ''}
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
        const btn = document.getElementById('twRefreshBtn');
        if (btn) btn.classList.add('spinning');
        try {
            // 五つのジェネレーター並列（ツイート×2 + 同人イベント + トレンド + 通知）
            await Promise.all([
                this._generateNpcTweets(),
                this._generateFanTweets(),
                this._generateFandomEvent(),
                this._generateTrends(),
                this._generateNotifications()
            ]);
            this.renderTimeline();
            Utils.showToast(I18n.t('t.tw_timeline_updated', '✓ タイムラインを更新しました'));

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
            if (btn) btn.classList.remove('spinning');
        }
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
            const head = `・${n.role}：${n.name}（handle: ${this._getNpcHandle(n)}）`;
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
            shortIdMap.set(sid, { realId: q.tweetId, isNpc: q.isNpc });
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
- キャラクターの声で書くこと — 声優はカジュアルで温かく、監督は意味深で情熱的、キャラクターはキャラとして発言
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

        // 只保留最新 50 条 NPC 推文
        if (t.npcTweets.length > 50) {
            const removed = t.npcTweets.slice(0, t.npcTweets.length - 50);
            // いいね済みでない画像をIDBから削除
            const likedIds = new Set((t.likedTweetIds || []).map(l => l.id));
            removed.forEach(tw => {
                if (tw.image?.generatedImageId && !likedIds.has(tw.id)) {
                    IllustGallery.remove(tw.image.generatedImageId).catch(() => {});
                }
            });
            t.npcTweets = t.npcTweets.slice(-50);
        }
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
                if (lookup) {
                    // 引用元の発信者が自分自身の場合はスキップ（QUOTEを無効化してNEW扱い）
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
PIXIV_LINK: [pixiv URL、NPC 自宣推用、自宣でない場合 NONE]
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
                savedToForumId: null
            });
        });

        // fan 推文上限 60 条（fromSearch 单独管理，不计入此 60 的容量）
        const fanTweets = t.npcTweets.filter(tw => tw.source === 'fan' && !tw.fromSearch);
        if (fanTweets.length > 60) {
            const keepIds = new Set(fanTweets.slice(-60).map(tw => tw.id));
            // いいね済みでない画像をIDBから削除
            const likedIds = new Set((t.likedTweetIds || []).map(l => l.id));
            fanTweets.slice(0, fanTweets.length - 60).forEach(tw => {
                if (tw.image?.generatedImageId && !likedIds.has(tw.id)) {
                    IllustGallery.remove(tw.image.generatedImageId).catch(() => {});
                }
            });
            t.npcTweets = t.npcTweets.filter(tw => tw.source !== 'fan' || tw.fromSearch || keepIds.has(tw.id));
        }
        Utils.saveData();
    },

    // ===== AI 生成同人イベント（タグ企画）=====
    async _generateFandomEvent() {
        const t = this._ensureData();
        const forumData = AppState.data.forumData || {};
        const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');

        // フェーズに応じた生成確率: 前期10%、中期25%、後期30%
        const phase = this._getFandomPhase();
        const eventChance = phase === 'early' ? 0.1 : phase === 'mid' ? 0.25 : 0.3;
        if (Math.random() > eventChance) return;

        const noContextRule = !worldContext.trim() ? '\n⚠️ 作品設定が未入力です。キャラクター名・CP名を含む企画は生成しないこと。一般的な創作企画（ワンドロお題、深夜の創作クラスタ等）にとどめること。\n' : '';
        // 展会系企划（新刊サンプル公開祭り / 即売会サークル告知祭り）は即売会闸门で制御（剧情集数ではない）
        const eventGate = (typeof Melonbooks !== 'undefined' && Melonbooks.getEventTopicGate)
            ? Melonbooks.getEventTopicGate()
            : { open: false, stage: null, events: [], topics: [] };
        const eventGateRule = eventGate.open
            ? `\n【同人即売会の状況】現在「${eventGate.stage === 'open' ? '開催中' : eventGate.stage === 'preopen' ? '開催間近' : '終了直後'}」の同人即売会あり。即売会系の企画（新刊サンプル公開祭り、即売会サークル告知祭り）も選択可。`
            : '\n⚠️ 現在、開催中・開催間近の同人即売会は無い。即売会系の企画（新刊サンプル公開祭り、即売会サークル告知祭り）は選択禁止。ワンドロ・お題配布・深夜の創作クラスタ・記念日企画などの非即売会企画のみ生成すること。\n';

        const systemPrompt = `あなたはアニメファンダムのX（Twitter）同人イベント・タグ企画をシミュレーションしています。
日本の二次創作コミュニティでよくある「タグ企画」を1つ選び、それに参加する複数のファンのツイートを生成してください。
${noContextRule}${eventGateRule}

企画の例（1つ選択）:
- ワンドロ / ワンライ（1時間お絵描き / 1時間ライティング）：お題と参加ツイート
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

            // fan 推文上限 60 条（与 _generateFanTweets 共享上限；fromSearch 不计入）
            const fanTweets = t.npcTweets.filter(tw => tw.source === 'fan' && !tw.fromSearch);
            if (fanTweets.length > 60) {
                const keepIds = new Set(fanTweets.slice(-60).map(tw => tw.id));
                t.npcTweets = t.npcTweets.filter(tw => tw.source !== 'fan' || tw.fromSearch || keepIds.has(tw.id));
            }
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
            const threadParts = [];
            const partRe = /^THREAD_(\d+):\s*(.+)$/gm;
            let pm;
            while ((pm = partRe.exec(tb)) !== null) threadParts.push(pm[2].trim());
            if (threadParts.length >= 2) {
                const threadId = 'thread_' + Utils.generateId();
                threadParts.forEach((content, i) => {
                    threadTweets.push({ name: tName, handle: tHandle, type: tType, content, translation: i === 0 ? tTl : null, replies: [], image: null, quotedTweet: null, threadId, threadIndex: i, threadTotal: threadParts.length });
                });
            }
        }

        const blocks = text.split(/---\s*FANTWEET\s*---/i).map(s => s.trim()).filter(Boolean);
        const now = Date.now();
        const singleTweets = blocks.map(block => {
            const name = (block.match(/^NAME:\s*(.+)$/m) || [])[1]?.trim() || 'ファン';
            const handle = (block.match(/^HANDLE:\s*(.+)$/m) || [])[1]?.trim() || '@user';
            const rawType = (block.match(/^TYPE:\s*(.+)$/m) || [])[1]?.trim() || 'fan';
            const validTypes = ['fan', 'industry', 'media', 'doujin_writer', 'doujin_artist', 'cp_fan', 'organizer', 'event_promo', 'event_haul', 'event_repo', 'fanart_share', 'radio_drama'];
            const type = validTypes.includes(rawType) ? rawType : 'fan';
            // Content: stop before IMAGE_EMOJI, TRANSLATION or REPLY_
            const contentMatch = block.match(/CONTENT:[ \t]*\n?([\s\S]*?)(?=\nIMAGE_EMOJI:|\nQUOTE_AUTHOR:|\nTRANSLATION:|\nREPLY_\d|\s*$)/);
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
            // v2.70.0 PIXIV_LINK（NPC 自宣推用、optional）
            const pixivLinkRaw = (block.match(/^PIXIV_LINK:\s*(.+)$/m) || [])[1]?.trim();
            const pixivLink = (pixivLinkRaw && pixivLinkRaw !== 'NONE') ? pixivLinkRaw : null;
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
            return { name, handle, type, content, translation, replies, image, quotedTweet, poll, pixivLink };
        }).filter(r => r.content);
        return [...singleTweets, ...threadTweets];
    },

    // ===== 打开推文线程 =====
    openTweet(tweetId, isNpc = false) {
        this.currentTweetId = tweetId;
        this.currentTweetIsNpc = isNpc;
        Navigation.goTo('twitter-thread');
    },

    // ===== 渲染线程页 =====
    renderThread() {
        const t = this._ensureData();
        const arr = this.currentTweetIsNpc ? (t.npcTweets || []) : (t.tweets || []);
        const tweet = arr.find(tw => tw.id === this.currentTweetId);
        if (!tweet) { Navigation.goTo('twitter'); return; }

        const isNpc = this.currentTweetIsNpc;
        const identity = this._resolveTweetIdentity(tweet, isNpc);
        const { name, handle, avatarLetter, avatarColor } = identity;
        const isNpcStr = isNpc ? 'true' : 'false';

        const content = document.getElementById('twitterThreadContent');
        if (!content) return;

        // OP 推文
        const opTl = tweet.translation ? `<details class="tw-tl-block">
    <summary class="tw-tl-btn">${I18n.t('tw.action_translate', '訳')}</summary>
    <div class="tw-tl-content">${this._esc(tweet.translation).replace(/\n/g, '<br>')}</div>
</details>` : '';
        const opPnid = identity.profileNpcId ? this._esc(identity.profileNpcId) : '';
        const opProfileOnclick = opPnid ? ` onclick="Twitter.openNpcProfile('${opPnid}','twitter-thread')"` : '';
        const opAvatarCls = opPnid ? 'tw-card-avatar tw-avatar-large tw-avatar-link' : 'tw-card-avatar tw-avatar-large';
        const opNameCls = opPnid ? 'tw-name tw-name-link' : 'tw-name';
        const verifiedMark = identity.isStaff ? ` ${this._svg.verified}` : '';

        // OP 操作栏（合并 stats + actions 五按钮，每个带数字）
        const likesStr = this._fmtNum(tweet.likes || 0);
        const rtStr = this._fmtNum(tweet.retweets || 0);
        const replyCountAll = (tweet.replies || []).length;
        const replyCountStr = replyCountAll > 0 ? this._fmtNum(replyCountAll) : '';
        const isLiked = (t.likedTweetIds || []).some(l => l.id === tweet.id);
        const isRetweeted = this._isRetweetedByCurrentUser(tweet.id, isNpc);
        const tweetIdEsc = this._esc(tweet.id);

        let html = `<div class="tw-thread-op">
    <div class="tw-thread-op-header">
        <div class="${opAvatarCls}" style="background:${avatarColor};"${opProfileOnclick}>${this._esc(avatarLetter)}</div>
        <div>
            <div class="${opNameCls}"${opProfileOnclick}>${this._esc(name)}${verifiedMark}</div>
            <div class="tw-handle">${this._esc(handle)}</div>
        </div>
    </div>
    <div class="tw-thread-content">${this._linkifyContent(tweet.content)}</div>
    ${this._renderUserImage(tweet, isNpcStr)}
    ${this._renderUserAudio(tweet, isNpcStr)}
    ${tweet.image ? (tweet.image.generatedImageId
        ? `<div class="tw-image-card tw-image-generated" onclick="event.stopPropagation();Twitter._viewFullImage('${tweet.image.generatedImageId}')"><img src="" data-illust-id="${tweet.image.generatedImageId}" class="tw-generated-img" alt="${this._esc(tweet.image.description || '')}"></div>`
        : `<div class="tw-image-card" style="background:${tweet.image.gradient || 'linear-gradient(135deg,#667eea,#764ba2)'};">
            <span class="tw-image-emoji">${tweet.image.emoji || '🖼️'}</span>
            <span class="tw-image-desc">${this._esc(tweet.image.description || '')}</span>
           </div>`) : ''}
    ${this._renderQuotedTweetHtml(tweet)}
    ${opTl}
    <div class="tw-thread-time">${this._formatDate(tweet.timestamp)}</div>
    <div class="tw-thread-actions tw-thread-actions-v2">
        <button class="tw-action-btn tw-action-reply" onclick="Twitter.focusReplyComposer()" title="${I18n.t('tw.action_reply', 'リプライ')}">${this._svg.chat}<span>${replyCountStr}</span></button>
        <button class="tw-action-btn tw-action-rt${isRetweeted ? ' tw-retweeted' : ''}" onclick="Twitter.openRetweetMenu('${tweetIdEsc}',${isNpcStr})" title="${I18n.t('tw.action_repost', 'リポスト')}">${isRetweeted ? this._svg.retweetGreen : this._svg.retweet}<span>${rtStr !== '0' ? rtStr : ''}</span></button>
        <button class="tw-action-btn tw-action-like${isLiked ? ' tw-liked' : ''}" onclick="Twitter.toggleLike('${tweetIdEsc}',${isNpcStr},this)" title="${I18n.t('tw.action_like', 'いいね')}">${isLiked ? this._svg.heartFilled : this._svg.heart}<span>${likesStr !== '0' ? likesStr : ''}</span></button>
        <button class="tw-action-btn tw-action-bookmark" onclick="Twitter.openTranslateConfirm()" title="${I18n.t('tw.action_translate', '翻訳')}">${this._svg.bookmark}</button>
        <button class="tw-action-btn tw-action-share" onclick="Twitter.openShareMenu('${tweetIdEsc}',${isNpcStr})" title="${I18n.t('tw.action_share', '共有')}">${this._svg.share}</button>
    </div>
</div>`;

        // 回复列表（thread sort + 串线 + 每条 reply 4 按钮）
        const replies = tweet.replies || [];
        if (replies.length > 0) {
            html += `<div class="tw-replies-divider">${I18n.t('tw.reply_count_label', {n: replies.length})}</div>`;
            const sorted = this._sortRepliesByThread(replies);
            // 计算每条 reply 的 connectorTop / connectorBottom
            sorted.forEach((item, i) => {
                const prev = sorted[i - 1];
                const next = sorted[i + 1];
                item.connectorTop = false;
                item.connectorBottom = false;
                if (prev) {
                    if (prev.reply.id === item.reply.parentReplyId) item.connectorTop = true;
                    else if (prev.depth === item.depth &&
                             prev.reply.parentReplyId === item.reply.parentReplyId &&
                             prev.reply.author === item.reply.author) item.connectorTop = true;
                }
                if (next) {
                    if (next.reply.parentReplyId === item.reply.id) item.connectorBottom = true;
                    else if (next.depth === item.depth &&
                             next.reply.parentReplyId === item.reply.parentReplyId &&
                             next.reply.author === item.reply.author) item.connectorBottom = true;
                }
            });
            html += sorted.map(item => this._renderReply(item.reply, item.connectorTop, item.connectorBottom)).join('');
        } else {
            html += `<div style="text-align:center;padding:32px 0;color:var(--text-secondary);font-size:14px;">${I18n.t('tw.empty_no_replies', 'まだリプライがありません')}</div>`;
        }

        // 加载更多回复 + 关係者反応按钮（仅用户自己的推显示）
        const isOwnTweet = !this.currentTweetIsNpc && tweet && !tweet.postedAsNpcId;
        const staffBtn = isOwnTweet
            ? `<button class="glass-btn small" onclick="Twitter.triggerStaffReactions('${tweet.id}')" style="margin-left:8px;">${I18n.t('tw.gen_staff_reactions', '関係者の反応')}</button>`
            : '';
        html += `<div class="tw-load-more-wrap" id="twLoadMoreWrap">
    <button class="glass-btn small" id="twLoadMoreBtn" onclick="Twitter.generateMoreReplies()">${I18n.t('tw.gen_more_replies', '＋ リプライを読み込む')}</button>
    ${staffBtn}
</div>`;

        content.innerHTML = html;

        // 生成済み画像をロード
        this._loadGeneratedImages(content);

        // 同步 composer 头像（按当前身份）
        this._syncReplyComposerAvatar();
    },

    // ===== 查看引用推文（从统计栏点击进入）=====
    showQuoteTweets() {
        const t = this._ensureData();
        const arr = this.currentTweetIsNpc ? (t.npcTweets || []) : (t.tweets || []);
        const tweet = arr.find(tw => tw.id === this.currentTweetId);
        if (!tweet) return;
        const isNpc = this.currentTweetIsNpc;

        const quoteTweets = tweet.quoteTweets || [];
        const content = document.getElementById('twitterThreadContent');
        if (!content) return;

        let html = `<div style="padding:16px;border-bottom:1px solid var(--border);">
    <button class="tw-back-inline" onclick="Twitter.renderThread()">${I18n.t('tw.thread_back_to_thread', '← スレッドに戻る')}</button>
    <div style="font-weight:700;font-size:17px;margin-top:8px;">${I18n.t('tw.thread_quotes', '引用')}</div>
</div>`;

        if (quoteTweets.length > 0) {
            html += quoteTweets.map(qt => this._renderQtCard(qt, tweet)).join('');
        } else {
            html += `<div style="text-align:center;padding:40px 16px;color:var(--text-secondary);font-size:14px;">${I18n.t('tw.empty_no_quotes', 'まだ引用ツイートがありません')}</div>`;
        }
        html += `<div style="text-align:center;padding:12px 0 20px;">
    <button class="glass-btn small" id="twGenQtBtn" onclick="Twitter.generateQuoteTweets('${this._esc(tweet.id)}', ${isNpc})">${I18n.t('tw.gen_qts_btn', '引用ツイートを生成')}</button>
</div>`;

        content.innerHTML = html;
    },

    // ===== 发推弹窗 =====
    showPostModal() {
        const identity = this._getActiveIdentity();
        const avatarEl = document.getElementById('twPostAvatar');
        const nameEl = document.getElementById('twPostName');
        const handleEl = document.getElementById('twPostHandle');
        if (avatarEl) { avatarEl.textContent = identity.letter; avatarEl.style.background = identity.color; }
        if (nameEl) nameEl.textContent = identity.name;
        if (handleEl) handleEl.textContent = identity.handle;

        // 剧情节点
        const plotSel = document.getElementById('twitterAfterPlot');
        if (plotSel) {
            const plots = AppState.data.broadcast.plotProgress || [];
            plotSel.innerHTML = `<option value="">${I18n.t('tw.space_plot_none', '（時期不明）')}</option>` +
                plots.map(p => `<option value="${this._esc(p.id)}">${this._esc(p.title)}</option>`).join('');
            if (plots.length > 0) plotSel.value = plots[plots.length - 1].id;
        }

        const ta = document.getElementById('twitterPostContent');
        if (ta) ta.value = '';
        this.updateCharCount();
        document.getElementById('twitterPostModal')?.classList.add('active');
    },

    closePostModal() {
        document.getElementById('twitterPostModal')?.classList.remove('active');
        // 清除引用预览
        this._pendingQuotedTweet = null;
        const preview = document.getElementById('twPostQuotePreview');
        if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
        // 清除待发媒体（被丢弃的本地音频从 PerigeeAudio 删掉）
        if (this._pendingPostAudio && this._pendingPostAudio.type === 'local' && this._pendingPostAudio.audioId && typeof TTSEngine !== 'undefined') {
            TTSEngine.removeAudio(this._pendingPostAudio.audioId).catch(() => {});
        }
        this._pendingPostImage = null;
        this._pendingPostAudio = null;
        const mp = document.getElementById('twPostMediaPreview');
        if (mp) { mp.style.display = 'none'; mp.innerHTML = ''; }
    },

    updateCharCount() {
        const val = document.getElementById('twitterPostContent')?.value || '';
        const el = document.getElementById('twitterCharCount');
        if (el) el.textContent = `${val.length} / 280`;
    },

    // ===== 发推 =====
    async postTweet() {
        const content = document.getElementById('twitterPostContent')?.value.trim();
        if (!content) { Utils.showToast(I18n.t('t.tw_enter_tweet_content', 'ツイート内容を入力してください')); return; }
        if (content.length > 280) { Utils.showToast(I18n.t('t.tw_max_280', '280文字以内で入力してください')); return; }

        const afterPlotId = document.getElementById('twitterAfterPlot')?.value || null;
        const btn = document.getElementById('twitterPostBtn');
        if (btn) { btn.disabled = true; btn.textContent = I18n.t('tw.compose_posting', '投稿中...'); }

        const t = this._ensureData();
        const identity = this._getActiveIdentity();
        const tweet = {
            id: Utils.generateId(),
            content,
            // 新模型：发推身份用 accountId 标记
            postedAsAccountId: identity.accountId,
            // 旧字段保留写入，方便其他地方按旧字段判断（兼容期）
            postedAsIdentityType: identity.type,
            postedAsNpcId: identity.isNpc ? identity.npcId : null,
            afterPlotId: afterPlotId || null,
            timestamp: Date.now(),
            replies: [],
            savedToForumId: null
        };
        // 引用模式：附带 quotedTweet
        if (this._pendingQuotedTweet) {
            tweet.quotedTweet = { ...this._pendingQuotedTweet };
            this._pendingQuotedTweet = null;
        }
        // 用户附件：图片 + 音频
        if (this._pendingPostImage) {
            tweet.userImage = { ...this._pendingPostImage };
            this._pendingPostImage = null;
        }
        if (this._pendingPostAudio) {
            tweet.userAudio = { ...this._pendingPostAudio };
            this._pendingPostAudio = null;
        }

        t.tweets.push(tweet);
        // 粉丝自动增长
        this._grantFollowersToActive();
        Utils.saveData();

        this.closePostModal();
        if (btn) { btn.disabled = false; btn.textContent = I18n.t('tw.compose_post_btn', '投稿'); }

        // 跳转到线程并生成回复
        this.openTweet(tweet.id, false);
        Utils.showToast(I18n.t('t.tw_tweet_posted', '✓ ツイートを投稿しました'));
        await this._generateReplies(tweet.id, false, { initialBatch: true });

        // fire-and-forget: 生成通知 + 偶尔触发粉丝来信
        this._generateTweetNotifications(tweet.id).catch(e => console.warn('[Twitter Notif]', e));
        if (Math.random() < 0.3) {
            this._generateInboxDms(tweet.id).catch(e => console.warn('[Twitter Inbox]', e));
        }
        // M3 関係者反応：用户用官方/个人身份发的推 → staff 自动反应（NPC 代发不触发）
        if (!identity.isNpc) {
            // 延迟 30s 让反应感觉是"陆陆续续来"
            setTimeout(() => {
                this._generateStaffReactions(tweet.id).catch(e => console.warn('[Staff Reactions]', e));
            }, 30000);
        }
    },

    // ===== AI 生成回复 =====
    async _generateReplies(tweetId, isNpc, opts = {}) {
        const t = this._ensureData();
        const arr = isNpc ? t.npcTweets : t.tweets;
        const tweet = (arr || []).find(tw => tw.id === tweetId);
        if (!tweet) return;

        // 第一批（postTweet 直後）: 公式 NPC reply 上限 3 件（亲密圈のみ）
        // 追加バッチ（「リプライを読み込む」按钮）: 公式 NPC reply 全面禁止（路人潮）
        const isInitialBatch = !!opts.initialBatch;
        const maxNpcReplies = isInitialBatch ? 3 : 0;

        const btn = document.getElementById('twLoadMoreBtn');
        if (btn) { btn.disabled = true; btn.textContent = I18n.t('tw.gen_loading', '読み込み中…'); }
        // 在按钮上方插入 3 条骨架占位
        this._renderReplySkeletons(3);

        try {
            const forumData = AppState.data.forumData || {};
            const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
            const npcs = AppState.data.broadcast.officialNpcs || [];

            // 既存リプライから「すでに反応済みのNPC」を抽出（重複返信防止）
            const existingReplies = Array.isArray(tweet.replies) ? tweet.replies : [];
            const repliedNpcNames = new Set();
            existingReplies.forEach(r => {
                if (!r) return;
                if (r.authorRole === 'npc' && r.author) repliedNpcNames.add(r.author);
                else if (r.author && npcs.find(n => n.name === r.author || n.role === r.author)) repliedNpcNames.add(r.author);
            });
            const availableNpcs = npcs.filter(n => !repliedNpcNames.has(n.name) && !repliedNpcNames.has(n.role));
            const npcList = availableNpcs.length ? '\n公式NPCアカウント（返信可能）:\n' + availableNpcs.map(n => `・${n.name || n.role}`).join('\n') : '';
            const repliedList = repliedNpcNames.size ? `\n【すでにこのツイートに返信済みのNPC — 再度登場させないこと】\n${[...repliedNpcNames].map(n => `・${n}`).join('\n')}\n（同じNPCを繰り返し登場させると不自然になります。代わりに別のファンや他のNPCを使ってください）` : '';

            const tweetAuthorName = this._resolveTweetIdentity(tweet, isNpc).name;

            // 投稿者の実名/匿名コンテクスト（personal 账号 only）
            let identityContext = '';
            if (!isNpc && tweet.postedAsAccountId && tweet.postedAsAccountId.startsWith('personal:')) {
                const acc = this._getPersonalAccount(tweet.postedAsAccountId);
                if (acc) {
                    if (acc.isReal !== false) {
                        identityContext = `\n【投稿者の身元】このアカウント「${acc.name}（@${acc.handle}）」は実名アカウントです。NPCはこの人物の素性・背景を知っており、リプライではフレンドリー／親しみのあるトーンを取れます。`;
                    } else {
                        identityContext = `\n【投稿者の身元】このアカウント「${acc.name}（@${acc.handle}）」は匿名アカウントです。NPCは @${acc.handle} としてしか認識しておらず、実生活の素性・職業・人柄は知りません。リプライでは「あなたは誰？」的な距離感や、ハンドル名のみで反応してください。`;
                    }
                }
            }

            // 公式 NPC リプライ枠ルール（日本のSNS文化：親しい関係者のみ即レス、その他は引用で反応するため、リプライ欄は徐々に「路人潮」化する）
            const npcAllowanceRule = maxNpcReplies > 0
                ? `\n【公式NPCリプライの枠（最重要ルール）】\n- このバッチでは公式NPCアカウントからのリプライは最大 ${maxNpcReplies} 件まで（投稿者と親しい関係性のキャラ・スタッフのみ）\n- 残りの全リプライは fan / anti のみで構成すること\n- 公式NPC同士の「内輪ノリ」リプライは投稿者と直接関係ある場合のみ自然`
                : `\n【公式NPCリプライの枠（最重要ルール）】\n- このバッチは「追加リプライ／路人潮」段階。公式NPCアカウントからのリプライは完全に禁止 — ROLE: npc を1件たりとも出力しないこと\n- すべて fan / anti のみで構成すること（親しい関係者は最初のバッチですでに反応済みという前提）\n- 公式が後追いで反応する場合は引用ツイート（QT）で行うのが日本のSNS文化に沿うため、リプライ欄には登場させない`;

            const systemPrompt = `あなたはアニメファンコミュニティのX（Twitter）シミュレーションエンジンです。
公式アニメツイートへのリアルな日本語ファンリアクションをシミュレーションしてください。
リプライアカウントの種類: ファン、感情的なファン、ライトアンチ、他の公式NPCアカウント（声優・スタッフが軽く絡む程度）。

ルール:
- リプライは短く（1〜4行）— Twitterであり、エッセイではない
- タイプを混ぜること: 盛り上がるファン、感動リアクション、気になる質問、ニッチな言及、内輪ネタ・ミーム
- 自然なTwitterスラングを使うこと: 草 / やばい / 泣いた / 待って / 公式最高 等
- 絵文字・顔文字を自然に含めること（30〜40%）
- 以下の作品設定にないストーリーイベントを捏造しないこと

【厳禁ルール — リプライらしくない投稿は出力しない】
- 報道見出し風のリプライは禁止: 【話題】【速報】【公式】【お知らせ】等のタグから始まるもの
- 「トレンド入り」「○○がトレンド入り！」「ファン悶絶」「○○に注目」等のニュースサイト的見出しは禁止
- 第三者目線の客観的紹介文は禁止 — リプライは「投稿に対する個人の反応」だけ
- ニュース通信社・まとめサイト・公式アニメニュースアカウント風のアカウントは出さない
- メディアアカウントが反応する場合でも一人称・感想ベースで（「うちのライターも泣いてました」みたいな個人レベル）
${npcAllowanceRule}
${npcList}
${repliedList}
${identityContext}
作品設定:
${worldContext || '（未設定 — 具体的なキャラ名・CP・ストーリーを捏造しないこと）'}
${Utils.PROMPTS.infoAccessRule()}
出力フォーマット（厳守、リプライごとに1ブロック）:
---REPLY---
AUTHOR: [アカウント名]
HANDLE: [@handle]
ROLE: [fan / anti / npc]
CONTENT: [リプライ本文]
TRANSLATION: [CONTENTの中国語（簡体字）翻訳、1行]

5〜8件のリプライを生成すること。`;

            const messages = [{ role: 'user', content: `【投稿者】${tweetAuthorName}\n【ツイート内容】\n${tweet.content}\n\n上記のツイートへのリプライを生成してください。` }];
            const raw = await Utils.callChatAPI(messages, systemPrompt);
            let replies = this._parseReplies(raw).filter(r => !this._looksLikeNewsHeadline(r.content));

            // 後置フィルタ: AI が npc リプライ上限を守らなかった場合の保険
            let npcCount = 0;
            replies = replies.filter(r => {
                if (r.role === 'npc') {
                    if (npcCount >= maxNpcReplies) return false;
                    npcCount++;
                }
                return true;
            });

            if (replies.length === 0) {
                Utils.showToast(I18n.t('t.tw_gen_format_error', '生成形式エラー、もう一度試してください'));
                return;
            }

            const now = Date.now();
            replies.forEach((r, i) => {
                tweet.replies.push({
                    id: Utils.generateId(),
                    author: r.author || 'ファン',
                    handle: r.handle || '@user',
                    authorRole: r.role || 'fan',
                    content: r.content,
                    translation: r.translation || null,
                    timestamp: now + i * 15000
                });
            });

            tweet.lastReplyAt = Date.now();
            Utils.saveData();
            this.renderThread();
            Utils.showToast(I18n.t('t.tw_replies_generated', {n: replies.length}));
        } catch (e) {
            Utils.showToast(I18n.t('t.tw_gen_failed', '生成失敗：') + e.message);
            console.error('[Twitter Gen]', e);
            this._removeReplySkeletons();
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = I18n.t('tw.gen_more_replies', '＋ リプライを読み込む'); }
        }
    },

    // ===== 手动触发更多回复 =====
    generateMoreReplies() {
        if (!this.currentTweetId) return;
        this._generateReplies(this.currentTweetId, this.currentTweetIsNpc);
    },

    // ===== 骨架占位（加载中视觉反馈）=====
    _renderReplySkeletons(count = 3) {
        const wrap = document.getElementById('twLoadMoreWrap');
        if (!wrap) return;
        // 已经存在骨架就不重复插
        if (document.querySelector('.tw-reply-skeleton')) return;
        const html = Array.from({ length: count }).map(() => `<div class="tw-reply-skeleton">
    <div class="tw-rs-avatar"></div>
    <div class="tw-rs-body">
        <div class="tw-rs-line tw-rs-line-1"></div>
        <div class="tw-rs-line tw-rs-line-2"></div>
        <div class="tw-rs-line tw-rs-line-3"></div>
    </div>
</div>`).join('');
        wrap.insertAdjacentHTML('beforebegin', html);
    },
    _removeReplySkeletons() {
        document.querySelectorAll('.tw-reply-skeleton').forEach(el => el.remove());
    },

    // ===== 是否当前用户已转推 =====
    _isRetweetedByCurrentUser(tweetId, isNpc) {
        const t = this._ensureData();
        const myRetweets = t.myRetweets || [];
        const identity = this._getActiveIdentity();
        return myRetweets.some(r => r.tweetId === tweetId && r.isNpc === !!isNpc && r.accountId === identity.accountId);
    },

    // ===== 五按钮：评论 — 聚焦底部输入框 =====
    focusReplyComposer() {
        const ta = document.getElementById('twThreadReplyInput');
        if (!ta) return;
        ta.focus();
        ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    _autoResizeReplyInput(ta) {
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
        const submit = document.getElementById('twThreadReplySubmit');
        if (submit) submit.disabled = !ta.value.trim();
    },

    _syncReplyComposerAvatar() {
        const av = document.getElementById('twThreadComposerAvatar');
        if (!av) return;
        const identity = this._getActiveIdentity();
        // 重置 textarea
        const ta = document.getElementById('twThreadReplyInput');
        if (ta) { ta.value = ''; ta.style.height = 'auto'; }
        const submit = document.getElementById('twThreadReplySubmit');
        if (submit) submit.disabled = true;
        // 头像（图片 or 字母）
        if (identity.avatarImage) {
            av.style.background = `center/cover no-repeat url("${identity.avatarImage}")`;
            av.textContent = '';
        } else {
            av.style.background = identity.color || '#1d9bf0';
            av.textContent = identity.letter || 'M';
        }
    },

    // ===== 五按钮：评论 — 提交回复 =====
    async submitUserReply() {
        const ta = document.getElementById('twThreadReplyInput');
        if (!ta) return;
        const content = (ta.value || '').trim();
        if (!content) return;
        if (content.length > 280) { Utils.showToast(I18n.t('t.tw_max_280', '280文字以内で入力してください')); return; }
        if (!this.currentTweetId) return;

        const t = this._ensureData();
        const arr = this.currentTweetIsNpc ? (t.npcTweets || []) : (t.tweets || []);
        const tweet = arr.find(tw => tw.id === this.currentTweetId);
        if (!tweet) return;
        if (!Array.isArray(tweet.replies)) tweet.replies = [];

        const submit = document.getElementById('twThreadReplySubmit');
        if (submit) { submit.disabled = true; submit.textContent = I18n.t('tw.compose_posting', '投稿中…'); }

        const identity = this._getActiveIdentity();
        const newReply = {
            id: Utils.generateId(),
            author: identity.name,
            handle: identity.handle.startsWith('@') ? identity.handle : ('@' + identity.handle),
            authorRole: 'self',
            content,
            translation: null,
            timestamp: Date.now(),
            byUser: true
        };
        tweet.replies.push(newReply);
        tweet.lastReplyAt = Date.now();
        // 回复也涨粉
        this._grantFollowersToActive();
        Utils.saveData();

        if (submit) { submit.textContent = I18n.t('tw.compose_post_btn', '投稿'); }
        this.renderThread();
        Utils.showToast(I18n.t('t.tw_reply_posted', '✓ 返信を投稿しました'));
        // fire-and-forget AI 链反应（推主回应 + 粉丝跟评）
        this._generateReplyChain(this.currentTweetId, this.currentTweetIsNpc, newReply).catch(e => console.warn('[ReplyChain]', e));
    },

    // ===== 五按钮：転帖 — 转推菜单 =====
    openRetweetMenu(tweetId, isNpc) {
        const isRT = this._isRetweetedByCurrentUser(tweetId, isNpc);
        this._actionSheet([
            {
                label: isRT ? I18n.t('tw.action_remove_repost', 'リポストを取り消す') : I18n.t('tw.action_repost', 'リポスト'),
                icon: this._svg.retweet,
                onClick: () => this.toggleRetweet(tweetId, isNpc),
                danger: isRT
            },
            {
                label: I18n.t('tw.action_quote', '引用'),
                icon: this._svg.chat,
                onClick: () => this.openQuoteCompose(tweetId, isNpc)
            },
            {
                label: I18n.t('tw.action_view_engagements', '互動を見る'),
                icon: this._svg.share,
                onClick: () => this.showQuoteTweets()
            }
        ]);
    },

    toggleRetweet(tweetId, isNpc) {
        const t = this._ensureData();
        const arr = isNpc ? (t.npcTweets || []) : (t.tweets || []);
        const tweet = arr.find(tw => tw.id === tweetId);
        if (!tweet) return;
        if (!Array.isArray(t.myRetweets)) t.myRetweets = [];
        const identity = this._getActiveIdentity();
        const idx = t.myRetweets.findIndex(r => r.tweetId === tweetId && r.isNpc === !!isNpc && r.accountId === identity.accountId);
        if (idx >= 0) {
            t.myRetweets.splice(idx, 1);
            tweet.retweets = Math.max(0, (tweet.retweets || 0) - 1);
            Utils.showToast(I18n.t('t.tw_repost_removed', 'リポストを取り消しました'));
        } else {
            t.myRetweets.push({
                id: Utils.generateId(),
                tweetId, isNpc: !!isNpc,
                accountId: identity.accountId,
                retweetedAt: Date.now()
            });
            tweet.retweets = (tweet.retweets || 0) + 1;
            Utils.showToast(I18n.t('t.tw_reposted', 'リポストしました'));
        }
        Utils.saveData();
        // スレ詳細ページにいる時のみ renderThread（タイムラインから呼ばれた場合は
        // currentTweetId が別物なので renderThread すると意図せず画面遷移し得る）
        if (document.querySelector('.screen.active')?.id === 'twitter-thread') {
            this.renderThread();
        }
        this._refreshTwitterViews();
    },

    // ===== 五按钮：引用 — 打开发推编辑器（带原推预览）=====
    openQuoteCompose(tweetId, isNpc) {
        const t = this._ensureData();
        const arr = isNpc ? (t.npcTweets || []) : (t.tweets || []);
        const tweet = arr.find(tw => tw.id === tweetId);
        if (!tweet) return;
        const ident = this._resolveTweetIdentity(tweet, isNpc);
        this._pendingQuotedTweet = {
            authorName: ident.name,
            authorHandle: ident.handle,
            avatarColor: ident.avatarColor,
            content: tweet.content || ''
        };
        this.showPostModal();
        // 显示引用预览
        const preview = document.getElementById('twPostQuotePreview');
        if (preview) {
            preview.style.display = '';
            preview.innerHTML = `<div class="tw-inline-quote">
    <div class="tw-iq-header">
        <div class="tw-iq-avatar" style="background:${this._pendingQuotedTweet.avatarColor || '#888'};">${this._esc((this._pendingQuotedTweet.authorName || '？').charAt(0).toUpperCase())}</div>
        <span class="tw-name" style="font-size:13px;">${this._esc(this._pendingQuotedTweet.authorName)}</span>
        <span class="tw-handle" style="font-size:12px;">${this._esc(this._pendingQuotedTweet.authorHandle)}</span>
    </div>
    <div class="tw-iq-content">${this._esc(this._pendingQuotedTweet.content).replace(/\n/g, '<br>')}</div>
</div>`;
        }
    },

    // ===== 发推 — 图片附件 =====
    _openImageAttach() {
        this._actionSheet([
            { label: I18n.t('tw.action_upload_local_image', 'ローカル画像をアップロード'), icon: this._svg.bookmark, onClick: () => this._attachLocalImage() },
            { label: I18n.t('tw.action_paste_image_url', '外部 URL を貼り付け'), icon: this._svg.share, onClick: () => this._attachImageByUrl() }
        ], { title: I18n.t('tw.action_attach_image', '画像を添付') });
    },

    _attachLocalImage() {
        // 先问压缩 toggle
        this._actionSheet([
            {
                label: I18n.t('tw.action_compress_image', '圧縮する（推奨・800px / 80%）'),
                icon: this._svg.bookmark,
                onClick: () => this._pickLocalImage(true)
            },
            {
                label: I18n.t('tw.action_keep_original', 'オリジナルのまま（高画質・容量大）'),
                icon: this._svg.bookmark,
                onClick: () => this._pickLocalImage(false)
            }
        ], { title: I18n.t('tw.action_choose_save_method', '画像の保存方法を選択') });
    },

    _pickLocalImage(compress) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        input.onchange = async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
                let dataUrl;
                if (compress) {
                    dataUrl = await Utils.readImageFile(file, { maxSize: 800, quality: 0.8 });
                } else {
                    dataUrl = await new Promise((resolve, reject) => {
                        const r = new FileReader();
                        r.onload = () => resolve(r.result);
                        r.onerror = () => reject(new Error('読み込み失敗'));
                        r.readAsDataURL(file);
                    });
                }
                if (!dataUrl) return;
                this._pendingPostImage = { type: 'local', dataUrl, compressed: !!compress };
                this._renderPostMediaPreview();
            } catch (err) {
                Utils.showToast(I18n.t('t.tw_img_read_failed', '画像の読み込みに失敗：') + err.message, 4000);
            } finally {
                input.remove();
            }
        };
        document.body.appendChild(input);
        input.click();
    },

    _attachImageByUrl() {
        const url = prompt(I18n.t('tw.compose_url_image', '画像の URL を入力（http:// または https://）'));
        if (!url) return;
        const trimmed = url.trim();
        if (!/^https?:\/\//i.test(trimmed)) { Utils.showToast(I18n.t('t.tw_invalid_url', '有効な URL ではありません')); return; }
        this._pendingPostImage = { type: 'url', url: trimmed };
        this._renderPostMediaPreview();
    },

    // ===== 发推 — 音频附件 =====
    _openAudioAttach() {
        this._actionSheet([
            { label: I18n.t('tw.action_upload_local_audio', 'ローカル音声ファイルをアップロード'), icon: this._svg.bookmark, onClick: () => this._pickLocalAudio() },
            { label: I18n.t('tw.action_paste_audio_url', '外部 URL を貼り付け'), icon: this._svg.share, onClick: () => this._attachAudioByUrl() }
        ], { title: I18n.t('tw.action_attach_audio', '音声を添付') });
    },

    _pickLocalAudio() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.style.display = 'none';
        input.onchange = async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
                if (typeof TTSEngine === 'undefined' || !TTSEngine.storeAudio) {
                    Utils.showToast(I18n.t('t.tw_audio_store_init_failed', '音声ストアの初期化に失敗'), 4000);
                    return;
                }
                const audioId = 'tw_' + Utils.generateId();
                await TTSEngine.storeAudio(audioId, file);
                // 探测时长
                const duration = await this._probeAudioDuration(file).catch(() => 0);
                this._pendingPostAudio = {
                    type: 'local',
                    audioId,
                    filename: file.name || 'audio',
                    duration: duration || 0
                };
                this._renderPostMediaPreview();
            } catch (err) {
                Utils.showToast(I18n.t('t.tw_audio_save_failed_msg', '音声の保存に失敗：') + err.message, 4000);
            } finally {
                input.remove();
            }
        };
        document.body.appendChild(input);
        input.click();
    },

    _attachAudioByUrl() {
        const url = prompt(I18n.t('tw.compose_url_audio', '音声の URL を入力（mp3 / m4a / wav など）'));
        if (!url) return;
        const trimmed = url.trim();
        if (!/^https?:\/\//i.test(trimmed)) { Utils.showToast(I18n.t('t.tw_invalid_url', '有効な URL ではありません')); return; }
        this._pendingPostAudio = { type: 'url', url: trimmed, filename: this._urlFilename(trimmed) };
        this._renderPostMediaPreview();
    },

    _urlFilename(url) {
        try {
            const u = new URL(url);
            return decodeURIComponent(u.pathname.split('/').pop() || 'audio');
        } catch { return 'audio'; }
    },

    _probeAudioDuration(blobOrUrl) {
        return new Promise((resolve, reject) => {
            const audio = document.createElement('audio');
            const objUrl = blobOrUrl instanceof Blob ? URL.createObjectURL(blobOrUrl) : blobOrUrl;
            audio.preload = 'metadata';
            audio.src = objUrl;
            audio.onloadedmetadata = () => {
                const d = audio.duration;
                if (blobOrUrl instanceof Blob) URL.revokeObjectURL(objUrl);
                resolve(isFinite(d) ? d : 0);
            };
            audio.onerror = () => {
                if (blobOrUrl instanceof Blob) URL.revokeObjectURL(objUrl);
                reject(new Error('audio load failed'));
            };
            // 5s 超时
            setTimeout(() => { try { audio.src = ''; } catch {} resolve(0); }, 5000);
        });
    },

    _removePostImage() {
        this._pendingPostImage = null;
        this._renderPostMediaPreview();
    },
    _removePostAudio() {
        // 删除已存到 PerigeeAudio 的待发音频
        const pa = this._pendingPostAudio;
        if (pa && pa.type === 'local' && pa.audioId && typeof TTSEngine !== 'undefined') {
            TTSEngine.removeAudio(pa.audioId).catch(() => {});
        }
        this._pendingPostAudio = null;
        this._renderPostMediaPreview();
    },

    _renderPostMediaPreview() {
        const wrap = document.getElementById('twPostMediaPreview');
        if (!wrap) return;
        const img = this._pendingPostImage;
        const aud = this._pendingPostAudio;
        if (!img && !aud) {
            wrap.style.display = 'none';
            wrap.innerHTML = '';
            return;
        }
        let html = '';
        if (img) {
            const src = img.type === 'local' ? img.dataUrl : img.url;
            html += `<div class="tw-post-media-item">
    <img src="${Utils.escAttr(src)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'tw-post-media-broken',textContent:I18n.t('tw.compose_img_broken', '画像を読み込めません')}))">
    <button class="tw-post-media-remove" onclick="Twitter._removePostImage()" title="${I18n.t('tw.compose_remove', '削除')}">×</button>
</div>`;
        }
        if (aud) {
            const label = aud.filename || (aud.type === 'url' ? I18n.t('tw.compose_audio_url', 'URL 音声') : I18n.t('tw.compose_audio_default', '音声'));
            const dur = aud.duration ? this._fmtDuration(aud.duration) : '';
            html += `<div class="tw-post-media-item tw-post-media-audio">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
    <span class="tw-post-audio-name">${this._esc(label)}</span>
    ${dur ? `<span class="tw-post-audio-dur">${dur}</span>` : ''}
    <button class="tw-post-media-remove" onclick="Twitter._removePostAudio()" title="${I18n.t('tw.compose_remove', '削除')}">×</button>
</div>`;
        }
        wrap.innerHTML = html;
        wrap.style.display = '';
    },

    _fmtDuration(seconds) {
        const s = Math.floor(seconds || 0);
        const m = Math.floor(s / 60);
        const r = s % 60;
        return `${m}:${String(r).padStart(2, '0')}`;
    },

    // ===== Reply thread 排序（DFS preorder + 同作者连续聚合）=====
    _sortRepliesByThread(replies) {
        const childrenMap = new Map();
        replies.forEach(r => {
            const pid = r.parentReplyId || null;
            if (!childrenMap.has(pid)) childrenMap.set(pid, []);
            childrenMap.get(pid).push(r);
        });
        childrenMap.forEach(arr => arr.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)));
        const out = [];
        const visit = (parentId, depth) => {
            const list = childrenMap.get(parentId) || [];
            list.forEach(r => {
                out.push({ reply: r, depth });
                visit(r.id, depth + 1);
            });
        };
        visit(null, 0);
        return out;
    },

    // ===== 单条 Reply 渲染（5 按钮 + 串线 + inline composer 容器）=====
    _renderReply(r, connectorTop, connectorBottom) {
        const rAvatar = (r.author || '？').charAt(0).toUpperCase();
        const roleColor = this._roleColor(r.authorRole);
        const rTl = r.translation ? `<details class="tw-tl-block" onclick="event.stopPropagation()">
    <summary class="tw-tl-btn">${I18n.t('tw.action_translate', '訳')}</summary>
    <div class="tw-tl-content">${this._esc(r.translation)}</div>
</details>` : '';

        const t = this._ensureData();
        const isLiked = (r.likedByUser === true);
        const likeCount = r.likes || 0;
        const replyChildCount = (this.currentTweetId ? this._countDirectReplyChildren(r.id) : 0);

        const replyIdEsc = this._esc(r.id);
        const connectorClasses = [
            connectorTop ? 'tw-reply-conn-top' : '',
            connectorBottom ? 'tw-reply-conn-bot' : ''
        ].filter(Boolean).join(' ');

        return `<div class="tw-reply ${connectorClasses}" data-reply-id="${replyIdEsc}">
    <div class="tw-reply-avatar-col">
        <div class="tw-reply-avatar" style="background:${roleColor};">${this._esc(rAvatar)}</div>
    </div>
    <div class="tw-reply-body">
        <div class="tw-card-header">
            <span class="tw-name">${this._esc(r.author || 'ファン')}</span>
            <span class="tw-handle">${this._esc(r.handle || '@user')}</span>
            <span class="tw-time-sep">·</span>
            <span class="tw-time">${this._timeAgo(r.timestamp)}</span>
        </div>
        <div class="tw-content">${this._linkifyContent(r.content)}</div>
        ${rTl}
        <div class="tw-reply-actions">
            <button class="tw-reply-action" onclick="Twitter.openReplyInlineComposer('${replyIdEsc}')" title="${I18n.t('tw.action_reply', '返信')}">
                ${this._svg.chat}<span>${replyChildCount > 0 ? this._fmtNum(replyChildCount) : ''}</span>
            </button>
            <button class="tw-reply-action tw-reply-action-rt" title="${I18n.t('tw.action_repost', 'リポスト')}" onclick="event.preventDefault();">
                ${this._svg.retweet}
            </button>
            <button class="tw-reply-action tw-reply-action-like${isLiked ? ' tw-liked' : ''}" onclick="Twitter.toggleReplyLike('${replyIdEsc}', this)" title="${I18n.t('tw.action_like', 'いいね')}">
                ${isLiked ? this._svg.heartFilled : this._svg.heart}<span>${likeCount > 0 ? this._fmtNum(likeCount) : ''}</span>
            </button>
            <button class="tw-reply-action" onclick="Twitter.shareReply('${replyIdEsc}')" title="${I18n.t('tw.action_share', '共有')}">
                ${this._svg.share}
            </button>
        </div>
        <div class="tw-reply-inline-composer" id="twReplyInline_${replyIdEsc}" style="display:none;"></div>
    </div>
</div>`;
    },

    _countDirectReplyChildren(replyId) {
        const t = this._ensureData();
        const arr = this.currentTweetIsNpc ? (t.npcTweets || []) : (t.tweets || []);
        const tweet = arr.find(tw => tw.id === this.currentTweetId);
        if (!tweet || !tweet.replies) return 0;
        return tweet.replies.filter(r => r.parentReplyId === replyId).length;
    },

    // ===== Reply 喜欢（per-reply）=====
    toggleReplyLike(replyId, btn) {
        const t = this._ensureData();
        const arr = this.currentTweetIsNpc ? (t.npcTweets || []) : (t.tweets || []);
        const tweet = arr.find(tw => tw.id === this.currentTweetId);
        if (!tweet) return;
        const r = (tweet.replies || []).find(x => x.id === replyId);
        if (!r) return;
        if (r.likedByUser) {
            r.likedByUser = false;
            r.likes = Math.max(0, (r.likes || 0) - 1);
        } else {
            r.likedByUser = true;
            r.likes = (r.likes || 0) + 1;
        }
        Utils.saveData();
        // 局部更新（避免整页重渲）
        if (btn) {
            btn.classList.toggle('tw-liked', r.likedByUser);
            btn.innerHTML = `${r.likedByUser ? this._svg.heartFilled : this._svg.heart}<span>${r.likes > 0 ? this._fmtNum(r.likes) : ''}</span>`;
        }
    },

    // ===== Reply 分享（LINE）=====
    shareReply(replyId) {
        const t = this._ensureData();
        const arr = this.currentTweetIsNpc ? (t.npcTweets || []) : (t.tweets || []);
        const tweet = arr.find(tw => tw.id === this.currentTweetId);
        if (!tweet) return;
        const r = (tweet.replies || []).find(x => x.id === replyId);
        if (!r) return;
        this._actionSheet([
            {
                label: I18n.t('tw.action_share_to_line', 'LINEで共有'),
                icon: this._svg.chat,
                onClick: () => {
                    if (typeof LineTalk !== 'undefined') {
                        LineTalk.showShareCharSelect('tweet', {
                            authorName: r.author || 'ファン',
                            authorHandle: r.handle || '',
                            content: (r.content || '').slice(0, 100),
                            originalTweetId: tweet.id
                        });
                    }
                }
            }
        ]);
    },

    // ===== Inline 评论 composer 展开 =====
    openReplyInlineComposer(replyId) {
        const wrap = document.getElementById('twReplyInline_' + replyId);
        if (!wrap) return;
        // 关掉别的展开的
        document.querySelectorAll('.tw-reply-inline-composer').forEach(w => {
            if (w !== wrap) { w.style.display = 'none'; w.innerHTML = ''; }
        });
        if (wrap.style.display !== 'none' && wrap.innerHTML) {
            // 已开 → 关掉
            wrap.style.display = 'none';
            wrap.innerHTML = '';
            return;
        }
        const identity = this._getActiveIdentity();
        const avatarBg = identity.avatarImage
            ? `background:url("${Utils.escAttr(identity.avatarImage)}") center/cover no-repeat;`
            : `background:${identity.color || '#1d9bf0'};`;
        const avatarLetter = identity.avatarImage ? '' : this._esc(identity.letter || 'M');
        wrap.innerHTML = `<div class="tw-reply-inline-row">
    <div class="tw-reply-inline-avatar" style="${avatarBg}">${avatarLetter}</div>
    <textarea class="tw-reply-inline-input" id="twReplyInlineInput_${this._esc(replyId)}" rows="1" maxlength="280" placeholder="${I18n.t('tw.compose_reply_placeholder', '返信を投稿')}"
        oninput="Twitter._autoResizeInlineReply(this, '${this._esc(replyId)}')"></textarea>
    <button class="tw-reply-inline-submit" id="twReplyInlineSubmit_${this._esc(replyId)}" onclick="Twitter.submitInlineReply('${this._esc(replyId)}')" disabled>${I18n.t('tw.compose_post_btn', '投稿')}</button>
</div>`;
        wrap.style.display = '';
        const ta = document.getElementById('twReplyInlineInput_' + replyId);
        if (ta) { ta.focus(); }
    },

    _autoResizeInlineReply(ta, replyId) {
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 100) + 'px';
        const submit = document.getElementById('twReplyInlineSubmit_' + replyId);
        if (submit) submit.disabled = !ta.value.trim();
    },

    async submitInlineReply(parentReplyId) {
        const ta = document.getElementById('twReplyInlineInput_' + parentReplyId);
        if (!ta) return;
        const content = (ta.value || '').trim();
        if (!content) return;
        if (!this.currentTweetId) return;

        const t = this._ensureData();
        const arr = this.currentTweetIsNpc ? (t.npcTweets || []) : (t.tweets || []);
        const tweet = arr.find(tw => tw.id === this.currentTweetId);
        if (!tweet) return;
        if (!Array.isArray(tweet.replies)) tweet.replies = [];
        const parent = tweet.replies.find(x => x.id === parentReplyId);
        if (!parent) return;

        const submit = document.getElementById('twReplyInlineSubmit_' + parentReplyId);
        if (submit) { submit.disabled = true; submit.textContent = I18n.t('tw.compose_posting', '投稿中…'); }

        const identity = this._getActiveIdentity();
        const newReply = {
            id: Utils.generateId(),
            author: identity.name,
            handle: identity.handle.startsWith('@') ? identity.handle : ('@' + identity.handle),
            authorRole: 'self',
            content,
            translation: null,
            timestamp: Date.now(),
            byUser: true,
            parentReplyId
        };
        tweet.replies.push(newReply);
        tweet.lastReplyAt = Date.now();
        this._grantFollowersToActive();
        Utils.saveData();

        this.renderThread();
        Utils.showToast(I18n.t('t.tw_reply_posted', '✓ 返信を投稿しました'));
        // fire-and-forget AI 链反应
        this._generateReplyChain(this.currentTweetId, this.currentTweetIsNpc, newReply).catch(e => console.warn('[ReplyChain]', e));
    },

    // 顶级评论：用户对 OP 直接评论，触发反应链
    // submitUserReply 已经把推送 reply 完成，这里在那之后调
    async _maybeGenerateReactionsAfterUserReply(tweet, isNpc, newReply) {
        return this._generateReplyChain(tweet.id, isNpc, newReply);
    },

    // ===== 用户回复后 AI 链反应 =====
    // 生成 1) 被回复方的反应（如果是 NPC tweet 的 OP 或 reply 是 NPC/fan） + 2) 1〜2 条粉丝跟评
    async _generateReplyChain(tweetId, isNpc, userReply) {
        const t = this._ensureData();
        const arr = isNpc ? (t.npcTweets || []) : (t.tweets || []);
        const tweet = arr.find(tw => tw.id === tweetId);
        if (!tweet) return;

        const forumData = AppState.data.forumData || {};
        const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
        const npcs = AppState.data.broadcast.officialNpcs || [];
        const npcList = npcs.length ? '\n公式NPCアカウント（返信可能）:\n' + npcs.map(n => `・${n.name || n.role}`).join('\n') : '';

        // 推主信息（OP 作者）
        const opIdent = this._resolveTweetIdentity(tweet, isNpc);
        const opAuthor = opIdent.name;

        // 用户回复的对象（parent reply or OP）
        let target = null; // 被回复方
        let targetIsOP = false;
        if (userReply.parentReplyId) {
            const parent = (tweet.replies || []).find(x => x.id === userReply.parentReplyId);
            if (parent) {
                target = { name: parent.author, handle: parent.handle, role: parent.authorRole, content: parent.content };
            }
        } else {
            target = { name: opAuthor, handle: opIdent.handle, role: 'op', content: tweet.content };
            targetIsOP = true;
        }
        if (!target) return;

        // 跳过条件：用户给自己评论 → 不生成 AI 反应
        if (userReply.byUser && target.role === 'self') return;

        // 构建 thread 上下文（最多最近 8 条 reply）
        const recentReplies = (tweet.replies || []).slice(-8);

        const userIdent = this._getActiveIdentity();
        const systemPrompt = `あなたはX（Twitter）のリプライ欄のシミュレーションエンジンです。
以下のスレッドの文脈を踏まえ、ユーザーが書いた最新の返信に対する**自然な続きのリプライ**を生成してください。

ルール:
- 必ず日本語で
- 1〜4 行、Twitter らしい短さ
- 顔文字・絵文字・流行語は自然に（30%程度）
- 公式NPCアカウントが返信する場合は身分にふさわしい口調で
- ファンや一般ユーザーが返信する場合はカジュアルで盛り上がる感じで
- 元の作品設定にないキャラやストーリーは捏造しない

ターゲット情報:
- 元ツイート投稿者: ${opAuthor}
- ユーザー（${userIdent.name}）が返信した相手: ${target.name}（@${(target.handle || '').replace(/^@+/, '')}）
- ユーザーの返信内容: 「${userReply.content}」

${targetIsOP
    ? `生成内容（順番厳守）:
1. ${target.name}（推主）からユーザーへの返信（必ず）
2. 他のファン 1〜2 名による盛り上がり返信（オプション、0〜2 件）`
    : `生成内容（順番厳守）:
1. ${target.name}（被返信者）からユーザーへの返信（必ず）
2. 他のファン 0〜1 名のサイドコメント（オプション）`
}

${npcList}

世界設定:
${worldContext || '（未設定 — 具体的なキャラ名・CP・ストーリーを捏造しないこと）'}
${Utils.PROMPTS.infoAccessRule()}

出力フォーマット（厳守、各リプライごとに 1 ブロック、必ず ---REPLY--- で区切る）:
---REPLY---
AUTHOR: [アカウント名]
HANDLE: [@handle 半角英数_]
ROLE: [npc / op / fan / anti / media]
CONTENT: [本文]`;

        const threadCtx = recentReplies.map(r =>
            `- ${r.author}（${r.handle || '@user'}）: ${(r.content || '').slice(0, 200)}`
        ).join('\n');

        const messages = [{
            role: 'user',
            content: `【元ツイート】${opAuthor}: ${tweet.content}\n\n【最近のスレッド】\n${threadCtx || '（なし）'}\n\n【最新】${userIdent.name} → ${target.name}: ${userReply.content}\n\n上記の文脈を踏まえてリプライを生成してください。`
        }];

        try {
            const raw = await Utils.callChatAPI(messages, systemPrompt);
            const parsed = this._parseReplies(raw);
            if (parsed.length === 0) return;

            const now = Date.now();
            // 第一条直接挂在 userReply 下（被回复方对用户的回应）
            // 后续作为同级 sibling（也挂 userReply 下）模拟"旁观者跟评"
            parsed.forEach((p, i) => {
                tweet.replies.push({
                    id: Utils.generateId(),
                    author: p.author || target.name,
                    handle: p.handle || target.handle || '@user',
                    authorRole: p.role || 'fan',
                    content: p.content,
                    translation: p.translation || null,
                    timestamp: now + (i + 1) * 2500,
                    parentReplyId: userReply.id
                });
            });
            tweet.lastReplyAt = Date.now();
            Utils.saveData();
            this.renderThread();
        } catch (e) {
            console.warn('[ReplyChain] AI 失敗:', e);
        }
    },

    // ===== 渲染用户上传的图片 =====
    _renderUserImage(tweet, isNpcStr) {
        const ui = tweet.userImage;
        if (!ui) return '';
        const tweetIdEsc = this._esc(tweet.id);
        const src = ui.type === 'local' ? ui.dataUrl : (ui.url || '');
        if (!src) return '';
        const onerr = `Twitter._handleBrokenUserImage('${tweetIdEsc}',${isNpcStr})`;
        return `<div class="tw-user-image" onclick="event.stopPropagation();Twitter._viewUserImage('${tweetIdEsc}',${isNpcStr})">
    <img src="${Utils.escAttr(src)}" alt="" onerror="${onerr}">
</div>`;
    },

    // 图片加载失败 → 从推文删除（用户要求保持美观）
    _handleBrokenUserImage(tweetId, isNpc) {
        const t = this._ensureData();
        const arr = isNpc ? (t.npcTweets || []) : (t.tweets || []);
        const tweet = arr.find(tw => tw.id === tweetId);
        if (!tweet || !tweet.userImage) return;
        delete tweet.userImage;
        Utils.saveData();
        this._refreshTwitterViews();
    },

    // 全屏查看（仅查看，不实现编辑）
    _viewUserImage(tweetId, isNpc) {
        const t = this._ensureData();
        const arr = isNpc ? (t.npcTweets || []) : (t.tweets || []);
        const tweet = arr.find(tw => tw.id === tweetId);
        if (!tweet || !tweet.userImage) return;
        const src = tweet.userImage.type === 'local' ? tweet.userImage.dataUrl : tweet.userImage.url;
        if (!src) return;
        const overlay = document.createElement('div');
        overlay.className = 'tw-image-fullview';
        overlay.onclick = () => overlay.remove();
        overlay.innerHTML = `<img src="${Utils.escAttr(src)}" alt="">`;
        document.body.appendChild(overlay);
    },

    // ===== 渲染用户上传的音频（自定义播放器）=====
    _renderUserAudio(tweet, isNpcStr) {
        const ua = tweet.userAudio;
        if (!ua) return '';
        const tweetIdEsc = this._esc(tweet.id);
        const filename = this._esc(ua.filename || I18n.t('tw.audio_default_name', '音声'));
        const playerId = `twAudioP_${tweet.id}`;
        return `<div class="tw-user-audio" id="${playerId}" data-tweet-id="${tweetIdEsc}" data-is-npc="${isNpcStr}" onclick="event.stopPropagation()">
    <button class="tw-audio-play" onclick="Twitter._toggleAudioPlay('${tweetIdEsc}',${isNpcStr})" type="button">
        <svg class="tw-audio-icon-play" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        <svg class="tw-audio-icon-pause" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="display:none;"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
    </button>
    <div class="tw-audio-body">
        <div class="tw-audio-name">${filename}</div>
        <div class="tw-audio-progress" onclick="Twitter._seekAudio(event, '${tweetIdEsc}',${isNpcStr})">
            <div class="tw-audio-progress-fill"></div>
        </div>
    </div>
    <div class="tw-audio-time">--:--</div>
</div>`;
    },

    // 当前播放中的 tweet audio
    _activeTwAudioId: null,
    _activeTwAudio: null,

    async _toggleAudioPlay(tweetId, isNpc) {
        const t = this._ensureData();
        const arr = isNpc ? (t.npcTweets || []) : (t.tweets || []);
        const tweet = arr.find(tw => tw.id === tweetId);
        if (!tweet || !tweet.userAudio) return;

        // 同一条切换播/停
        if (this._activeTwAudioId === tweetId && this._activeTwAudio) {
            if (this._activeTwAudio.paused) {
                this._activeTwAudio.play();
            } else {
                this._activeTwAudio.pause();
            }
            this._updateAudioPlayerUI(tweetId);
            return;
        }

        // 切换到新的 → 停掉旧的（含 blob URL 回收）
        if (this._activeTwAudio) {
            try { this._activeTwAudio.pause(); } catch {}
            if (this._activeTwAudio._objUrl) URL.revokeObjectURL(this._activeTwAudio._objUrl);
            const oldId = this._activeTwAudioId;
            this._activeTwAudio = null;
            this._activeTwAudioId = null;
            if (oldId) this._updateAudioPlayerUI(oldId);
        }

        // 加载并播放
        let objUrl = null;
        try {
            let src;
            if (tweet.userAudio.type === 'local') {
                if (typeof TTSEngine === 'undefined') throw new Error('audioStore unavailable');
                const blob = await TTSEngine.getAudio(tweet.userAudio.audioId);
                if (!blob) throw new Error('audio not found');
                objUrl = URL.createObjectURL(blob);
                src = objUrl;
            } else {
                src = tweet.userAudio.url;
            }
            const audio = new Audio(src);
            audio._objUrl = objUrl;
            audio.preload = 'metadata';
            this._activeTwAudioId = tweetId;
            this._activeTwAudio = audio;
            audio.addEventListener('timeupdate', () => this._updateAudioPlayerUI(tweetId));
            audio.addEventListener('ended', () => {
                if (this._activeTwAudio !== audio) return;
                if (audio._objUrl) URL.revokeObjectURL(audio._objUrl);
                this._activeTwAudio = null;
                this._activeTwAudioId = null;
                this._updateAudioPlayerUI(tweetId);
            });
            audio.addEventListener('error', () => {
                // 旧 audio 残留事件不应该误删新数据
                if (this._activeTwAudio !== audio) return;
                if (audio._objUrl) URL.revokeObjectURL(audio._objUrl);
                Utils.showToast(I18n.t('t.tw_audio_load_failed', '音声を読み込めません'), 3000);
                this._handleBrokenUserAudio(tweetId, isNpc);
            });
            audio.addEventListener('loadedmetadata', () => this._updateAudioPlayerUI(tweetId));
            await audio.play();
            this._updateAudioPlayerUI(tweetId);
        } catch (e) {
            if (objUrl) URL.revokeObjectURL(objUrl);
            console.error('[Audio]', e);
            Utils.showToast(I18n.t('t.tw_audio_play_failed_msg', '音声を再生できません：') + e.message, 4000);
            this._handleBrokenUserAudio(tweetId, isNpc);
        }
    },

    _seekAudio(event, tweetId, isNpc) {
        if (this._activeTwAudioId !== tweetId || !this._activeTwAudio) return;
        const bar = event.currentTarget;
        const rect = bar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        const dur = this._activeTwAudio.duration;
        if (isFinite(dur)) this._activeTwAudio.currentTime = dur * ratio;
    },

    _updateAudioPlayerUI(tweetId) {
        const player = document.getElementById('twAudioP_' + tweetId);
        if (!player) return;
        const playIcon = player.querySelector('.tw-audio-icon-play');
        const pauseIcon = player.querySelector('.tw-audio-icon-pause');
        const fill = player.querySelector('.tw-audio-progress-fill');
        const timeEl = player.querySelector('.tw-audio-time');

        const isActive = this._activeTwAudioId === tweetId && this._activeTwAudio;
        const playing = isActive && !this._activeTwAudio.paused;

        if (playIcon) playIcon.style.display = playing ? 'none' : '';
        if (pauseIcon) pauseIcon.style.display = playing ? '' : 'none';

        if (isActive) {
            const cur = this._activeTwAudio.currentTime || 0;
            const dur = this._activeTwAudio.duration || 0;
            if (fill && isFinite(dur) && dur > 0) fill.style.width = (cur / dur * 100) + '%';
            if (timeEl) timeEl.textContent = `${this._fmtDuration(cur)} / ${this._fmtDuration(dur)}`;
        } else {
            if (fill) fill.style.width = '0%';
            if (timeEl) {
                // 显示总时长（如果数据里有）
                const t = this._ensureData();
                const isNpc = player.dataset.isNpc === 'true';
                const arr = isNpc ? (t.npcTweets || []) : (t.tweets || []);
                const tw = arr.find(x => x.id === tweetId);
                if (tw && tw.userAudio && tw.userAudio.duration) {
                    timeEl.textContent = this._fmtDuration(tw.userAudio.duration);
                } else {
                    timeEl.textContent = '--:--';
                }
            }
        }
    },

    _handleBrokenUserAudio(tweetId, isNpc) {
        const t = this._ensureData();
        const arr = isNpc ? (t.npcTweets || []) : (t.tweets || []);
        const tweet = arr.find(tw => tw.id === tweetId);
        if (!tweet || !tweet.userAudio) return;
        // 如果是本地存储的，顺手清掉 PerigeeAudio 里的 blob
        if (tweet.userAudio.type === 'local' && tweet.userAudio.audioId && typeof TTSEngine !== 'undefined') {
            TTSEngine.removeAudio(tweet.userAudio.audioId).catch(() => {});
        }
        delete tweet.userAudio;
        Utils.saveData();
        this._refreshTwitterViews();
    },

    // ===== 五按钮：翻译确认 =====
    openTranslateConfirm() {
        const t = this._ensureData();
        const arr = this.currentTweetIsNpc ? (t.npcTweets || []) : (t.tweets || []);
        const tweet = arr.find(tw => tw.id === this.currentTweetId);
        const alreadyTranslated = tweet && tweet.translation;
        this._actionSheet([
            {
                label: alreadyTranslated ? I18n.t('tw.action_translate_thread_again', '現在のスレッドを再翻訳') : I18n.t('tw.action_translate_thread', '現在のスレッドを一括翻訳'),
                icon: this._svg.bookmark,
                onClick: () => this.translateThread(this.currentTweetId, this.currentTweetIsNpc)
            }
        ], { title: I18n.t('tw.action_translate_confirm_title', 'このスレッドのリプライをすべて翻訳しますか？') });
    },

    // ===== 五按钮：分享菜单 =====
    openShareMenu(tweetId, isNpc) {
        const t = this._ensureData();
        const arr = isNpc ? (t.npcTweets || []) : (t.tweets || []);
        const tweet = arr.find(tw => tw.id === tweetId);
        if (!tweet) return;

        const items = [];
        // 总是有：分享给 LINE 好友
        items.push({
            label: I18n.t('tw.action_share_to_line', 'LINEで共有'),
            icon: this._svg.chat,
            onClick: () => {
                if (typeof LineTalk !== 'undefined') {
                    const ident = this._resolveTweetIdentity(tweet, isNpc);
                    LineTalk.showShareCharSelect('tweet', {
                        authorName: ident.name || '',
                        authorHandle: ident.handle || '',
                        content: (tweet.content || '').slice(0, 100),
                        originalTweetId: tweet.id
                    });
                }
            }
        });
        // 仅官方/NPC（非 personal）的推可转存到论坛官方情报
        const identityType = tweet.postedAsIdentityType || (isNpc ? 'npc' : 'official');
        if (identityType !== 'personal') {
            const saved = !!tweet.savedToForumId;
            items.push({
                label: saved ? I18n.t('tw.action_forwarded_to_official', '✓ 公式情報に転送済み') : I18n.t('tw.action_forward_to_official', '公式情報に転送'),
                icon: this._svg.share,
                onClick: () => { if (!saved) this.saveToForum(tweetId, isNpc); },
                disabled: saved
            });
        }
        this._actionSheet(items);
    },

    // ===== 右上 ... 菜单 =====
    openThreadDotsMenu() {
        if (!this.currentTweetId) return;
        this._actionSheet([
            {
                label: I18n.t('tw.action_delete', '削除'),
                icon: this._svg.share,
                onClick: () => this.deleteTweet(this.currentTweetId, this.currentTweetIsNpc),
                danger: true
            }
        ]);
    },

    // ===== 通用 Action Sheet =====
    _actionSheet(items, opts = {}) {
        const overlay = document.getElementById('twActionSheet');
        const wrap = document.getElementById('twActionSheetItems');
        if (!overlay || !wrap) return;
        const titleHtml = opts.title ? `<div class="tw-sheet-title">${this._esc(opts.title)}</div>` : '';
        const itemsHtml = items.map((it, i) => `<button class="tw-sheet-item${it.danger ? ' is-danger' : ''}${it.disabled ? ' is-disabled' : ''}" data-idx="${i}" ${it.disabled ? 'disabled' : ''}>
    <span class="tw-sheet-icon">${it.icon || ''}</span>
    <span class="tw-sheet-label">${this._esc(it.label)}</span>
</button>`).join('');
        wrap.innerHTML = titleHtml + itemsHtml;
        wrap.querySelectorAll('.tw-sheet-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx, 10);
                const item = items[idx];
                this._closeSheet();
                // 给关闭动画一点时间再触发
                setTimeout(() => { try { item && item.onClick && item.onClick(); } catch (e) { console.error('[Sheet]', e); } }, 180);
            });
        });
        overlay.classList.add('active');
    },
    _closeSheet() {
        document.getElementById('twActionSheet')?.classList.remove('active');
    },

    // ═══════════════════════════════════════════════════════════
    // M3 関係者反応：用户发推后，制作组成员（声優/監督/staff）按比例反应
    // - 75% 引用推（QUOTE）
    // - 20% 点赞（LIKE，仅记录）
    // - 5%  直接评论（REPLY）
    // 数据源：AppState.data.broadcast.officialNpcs，3-5 人随机选
    // ═══════════════════════════════════════════════════════════
    async _generateStaffReactions(tweetId, opts = {}) {
        const t = this._ensureData();
        const tweet = (t.tweets || []).find(tw => tw.id === tweetId);
        if (!tweet) return;
        if (tweet.staffReactionsGeneratedAt && !opts.force) return; // 已经生成过

        const forumData = AppState.data.forumData || {};
        const allNpcs = (AppState.data.broadcast.officialNpcs || [])
            .filter(n => n.id && (n.name || n.role))
            .filter(n => n.id !== tweet.postedAsNpcId); // 自己不会反应自己的推

        if (allNpcs.length === 0) {
            if (opts.manual) Utils.showToast(I18n.t('t.tw_add_staff_npc', '放送局にスタッフNPCを追加してください'));
            return;
        }

        // すでに反応済みの NPC を除外（force/manual で再生成時に重複を防ぐ）
        const reactedNpcIds = new Set();
        (t.npcTweets || []).forEach(nt => {
            if (nt.quotedTweetId === tweet.id && nt.npcId) reactedNpcIds.add(nt.npcId);
        });
        (tweet.replies || []).forEach(r => {
            if (r && r.authorRole === 'npc' && r.npcId) reactedNpcIds.add(r.npcId);
        });
        (tweet.likedByNpcs || []).forEach(id => reactedNpcIds.add(id));

        const candidates = allNpcs.filter(n => !reactedNpcIds.has(n.id));
        if (candidates.length === 0) {
            if (opts.manual) Utils.showToast(I18n.t('t.tw_all_reacted', '全員すでに反応済みです'));
            return;
        }

        // 1) 选 3-5 人（候補プールから）
        const k = Math.min(candidates.length, 3 + Math.floor(Math.random() * 3));
        const shuffled = [...candidates].sort(() => Math.random() - 0.5).slice(0, k);

        // 2) 分配反应类型（75/20/5）
        const buckets = { quote: [], reply: [], like: [] };
        shuffled.forEach(npc => {
            const roll = Math.random();
            if (roll < 0.75) buckets.quote.push(npc);
            else if (roll < 0.95) buckets.like.push(npc);
            else buckets.reply.push(npc);
        });

        // 3) 没有 quote/reply 的话不需要调 AI，只记 like
        const needsAI = buckets.quote.length > 0 || buckets.reply.length > 0;
        if (!needsAI) {
            this._applyLikes(tweet, buckets.like);
            tweet.staffReactionsGeneratedAt = Date.now();
            Utils.saveData();
            this._refreshTwitterViews();
            return;
        }

        if (opts.manual) Utils.showToast(I18n.t('t.tw_generating_reactions', '関係者の反応を生成中…'), 4000);

        // 4) 一次 AI 调用，批量返回所有 quote + reply 内容
        const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
        const userIdentity = this._resolveTweetIdentity(tweet, false);

        const npcDir = shuffled.map(n => `- @${this._getNpcHandle(n).replace(/^@/, '')} ／ ${n.role || ''} ／ ${n.name || n.role}${n.bio ? ' ／ ' + n.bio : ''}`).join('\n');

        const tasks = [];
        buckets.quote.forEach(n => tasks.push({ handle: this._getNpcHandle(n).replace(/^@/, ''), type: 'QUOTE' }));
        buckets.reply.forEach(n => tasks.push({ handle: this._getNpcHandle(n).replace(/^@/, ''), type: 'REPLY' }));

        const taskList = tasks.map(t => `- @${t.handle}: ${t.type}`).join('\n');

        const systemPrompt = `あなたはアニメ制作スタッフ／声優／関係者として、X（Twitter）でユーザーのツイートに反応するシミュレーターです。

【作品設定】
${worldContext || '（未設定）'}

${Utils.PROMPTS.infoAccessRule()}

【関係者プロフィール】
${npcDir}

【投稿者】${userIdentity.name}（${userIdentity.handle}）

【投稿者のツイート】
${tweet.content}

【あなたの仕事】
以下のリストに従い、各人物として反応文を生成してください。

${taskList}

【反応タイプ説明】
- QUOTE: 引用ツイート(60-120字)。投稿を引用しつつ、自分の感想・補足・現場エピソードを軽く加える
- REPLY: 短いリプライ(20-50字)。フランクに反応

【ルール】
- 各人物の職業・人格を活かした口調にすること（例：声優なら「演じてる側として〜」、監督なら「現場では〜」）
- 絵文字や顔文字を 30-50% で自然に
- 投稿に直接言及しすぎず、関連の情報や感想を上乗せする方が自然
- 同人 CP・未公開ストーリーは捏造禁止

【出力（JSON ONLY）】
{
  "reactions": [
    { "handle": "...", "type": "QUOTE", "content": "..." },
    { "handle": "...", "type": "REPLY", "content": "..." }
  ]
}`;

        let raw;
        try {
            raw = await Utils.callChatAPI([{ role: 'user', content: '上記の指示に従い、JSONのみを返してください。' }], systemPrompt);
        } catch (e) {
            console.warn('[Staff Reactions]', e);
            if (opts.manual) Utils.showToast(I18n.t('t.tw_reaction_gen_failed', '反応生成失敗：') + e.message);
            return;
        }

        // 5) 解析 JSON
        let parsed;
        try {
            const m = raw.match(/\{[\s\S]*\}/);
            parsed = JSON.parse(m ? m[0] : raw);
        } catch (e) {
            console.warn('[Staff Reactions] JSON parse fail', e, raw);
            if (opts.manual) Utils.showToast(I18n.t('t.tw_reaction_parse_failed', '反応の解析に失敗しました'));
            return;
        }

        const reactions = Array.isArray(parsed.reactions) ? parsed.reactions : [];
        const handleToNpc = new Map(shuffled.map(n => [this._getNpcHandle(n).replace(/^@/, '').toLowerCase(), n]));

        // 6) 应用反应
        let quoteCount = 0, replyCount = 0;
        const baseTime = Date.now();
        reactions.forEach((r, i) => {
            const handle = String(r.handle || '').replace(/^@/, '').toLowerCase();
            const npc = handleToNpc.get(handle);
            if (!npc || !r.content) return;
            const offset = (i + 1) * (30000 + Math.random() * 60000); // 30s-90s 错峰
            const timestamp = baseTime - offset;
            if (r.type === 'QUOTE') {
                t.npcTweets = t.npcTweets || [];
                t.npcTweets.push({
                    id: Utils.generateId(),
                    npcId: npc.id,
                    content: r.content,
                    quotedTweetId: tweet.id,
                    quotedTweetIsNpc: false,
                    timestamp,
                    likes: Math.floor(Math.random() * 50),
                    retweets: Math.floor(Math.random() * 10),
                    replies: []
                });
                // 通知
                this._pushNotif({ type: 'quote', npc, tweetId: tweet.id, content: r.content, timestamp });
                quoteCount++;
            } else if (r.type === 'REPLY') {
                tweet.replies = tweet.replies || [];
                tweet.replies.push({
                    id: Utils.generateId(),
                    author: npc.name || npc.role,
                    handle: this._getNpcHandle(npc),
                    authorRole: 'npc',
                    npcId: npc.id,
                    content: r.content,
                    timestamp
                });
                this._pushNotif({ type: 'reply', npc, tweetId: tweet.id, content: r.content, timestamp });
                replyCount++;
            }
        });

        // 7) 应用 like
        this._applyLikes(tweet, buckets.like);

        // 8) 标记完成 + 保存 + 刷新
        tweet.staffReactionsGeneratedAt = Date.now();
        Utils.saveData();
        this._updateBadges?.();
        this._refreshTwitterViews();

        if (opts.manual) {
            const summary = [];
            if (quoteCount) summary.push(`${quoteCount}件の引用`);
            if (replyCount) summary.push(`${replyCount}件のリプライ`);
            if (buckets.like.length) summary.push(`${buckets.like.length}件のいいね`);
            Utils.showToast(I18n.t('t.tw_staff_reactions', '✓ 関係者の反応：') + (summary.join(' / ') || I18n.t('t.tw_none', 'なし')));
        }
    },

    _applyLikes(tweet, npcs) {
        if (!npcs || npcs.length === 0) return;
        tweet.likedByNpcs = tweet.likedByNpcs || [];
        npcs.forEach(npc => {
            if (!tweet.likedByNpcs.includes(npc.id)) {
                tweet.likedByNpcs.push(npc.id);
            }
            // 通知（不带 content）
            this._pushNotif({ type: 'like', npc, tweetId: tweet.id, timestamp: Date.now() - Math.floor(Math.random() * 120000) });
        });
        tweet.likes = (tweet.likes || 0) + npcs.length;
    },

    // ===== 粉丝自动增长（用户发帖 / 回复时调）=====
    _grantFollowersToActive() {
        const t = this._ensureData();
        const id = t.activeAccountId;
        if (!id) return;
        const inc = 1 + Math.floor(Math.random() * 15); // 1〜15

        let leadName = this._genFanName();
        // 偶尔用真实存在的 fanFriend 当 lead，更有"圈内人follow你"的感觉
        const fans = t.fanFriends || [];
        if (fans.length > 0 && Math.random() < 0.4) {
            leadName = fans[Math.floor(Math.random() * fans.length)].name;
        }

        if (id.startsWith('npc:')) {
            const npc = this._getNpc(id.slice('npc:'.length));
            if (npc) {
                if (typeof npc.followerCount !== 'number') npc.followerCount = this._genFollowerCount(npc.id);
                npc.followerCount += inc;
            }
        } else {
            const acc = this._getPersonalAccount(id) || (t.personalAccounts || [])[0];
            if (acc) {
                acc.followerCount = (acc.followerCount || 0) + inc;
            }
        }

        // 通知：○○など N 名にフォローされました
        t.notifications = t.notifications || [];
        const fromLetter = leadName.charAt(0).toUpperCase();
        t.notifications.unshift({
            id: Utils.generateId(),
            type: 'follow',
            fromName: leadName,
            fromHandle: '',
            fromAvatarLetter: fromLetter,
            fromAvatarColor: '#1d9bf0',
            fromNpcId: null,
            targetTweetId: null,
            content: '',
            timestamp: Date.now(),
            isRead: false,
            followCount: inc
        });
        if (t.notifications.length > 100) t.notifications = t.notifications.slice(0, 100);
    },

    _pushNotif({ type, npc, tweetId, content, timestamp }) {
        const t = this._ensureData();
        t.notifications = t.notifications || [];
        t.notifications.unshift({
            id: Utils.generateId(),
            type,
            fromName: npc.name || npc.role,
            fromHandle: this._getNpcHandle(npc),
            fromAvatarLetter: (npc.name || npc.role || '?').charAt(0).toUpperCase(),
            fromAvatarColor: this._npcColor(npc.id),
            fromNpcId: npc.id,
            targetTweetId: tweetId,
            content: content || '',
            timestamp: timestamp || Date.now(),
            isRead: false
        });
        if (t.notifications.length > 100) t.notifications = t.notifications.slice(0, 100);
    },

    _refreshTwitterViews() {
        const active = document.querySelector('.screen.active')?.id;
        if (active === 'twitter') this.renderTimeline?.();
        if (active === 'twitter-thread') this.renderThread?.();
        if (active === 'twitter-notif') this.renderNotifications?.();
        if (active === 'twitter-user-profile') this.renderUserProfile?.();
    },

    // 手动触发：从某条用户推 → 立即生成关係者反応
    triggerStaffReactions(tweetId) {
        this._generateStaffReactions(tweetId, { manual: true, force: true })
            .catch(e => console.warn('[Staff Reactions]', e));
    },

    // ===== スレ全体を翻訳（OP + 全リプライ、1回のAPI呼び出し）=====
    async translateThread(tweetId, isNpc) {
        const t = this._ensureData();
        const arr = isNpc ? (t.npcTweets || []) : (t.tweets || []);
        const tweet = arr.find(tw => tw.id === tweetId);
        if (!tweet) return;

        Utils.showToast(I18n.t('t.tw_translating', '翻訳中…'), 4000);

        try {
            const replies = tweet.replies || [];
            // 一次打包：OP + 全部 reply
            const lines = [`OP: ${tweet.content}`];
            replies.forEach((r, i) => lines.push(`R${i + 1}: ${r.content}`));

            const systemPrompt = `あなたは日本語→中国語のSNS翻訳者です。
ラベル付きの各ツイートを自然で会話的な中国語（簡体字）に翻訳してください。
絵文字とハッシュタグはそのまま保持すること。原文のトーンに合わせたカジュアルな表現にすること。
翻訳のみを元のラベルと完全に同じ形式で1行ずつ出力すること。余計なテキストは不要。`;

            const messages = [{ role: 'user', content: lines.join('\n') }];
            const raw = await Utils.callChatAPI(messages, systemPrompt);

            // 解析输出（格式：OP: xxx / R1: xxx ...）
            const parsed = {};
            for (const line of raw.split('\n').map(l => l.trim()).filter(Boolean)) {
                const m = line.match(/^(OP|R\d+):\s*(.+)$/);
                if (m) parsed[m[1]] = m[2].trim();
            }

            if (parsed['OP']) tweet.translation = parsed['OP'];
            replies.forEach((r, i) => {
                if (parsed[`R${i + 1}`]) r.translation = parsed[`R${i + 1}`];
            });

            Utils.saveData();
            this.renderThread();
            Utils.showToast(I18n.t('t.tw_translate_done', {n: Object.keys(parsed).length}));
        } catch (e) {
            Utils.showToast(I18n.t('t.tw_translate_failed', '翻訳失敗：') + e.message);
        }
    },

    // ===== 保存到放送局 =====
    saveToForum(tweetId, isNpc) {
        const t = this._ensureData();
        const arr = isNpc ? t.npcTweets : t.tweets;
        const tweet = (arr || []).find(tw => tw.id === tweetId);
        if (!tweet || tweet.savedToForumId) return;

        // 个人账号推文不能保存为官方情报（v2 身份系统：postedAsAccountId 以 'personal:' 开头）
        if (tweet.postedAsAccountId?.startsWith('personal:')) {
            Utils.showToast(I18n.t('t.tw_personal_cannot_save', '個人アカウントのツイートは放送局に保存できません'));
            return;
        }

        const forumData = AppState.data.forumData;
        if (!forumData) { Utils.showToast(I18n.t('t.tw_broadcast_not_init', '放送局が初期化されていません')); return; }
        if (!AppState.data.broadcast.officialInfo) AppState.data.broadcast.officialInfo = [];

        const sourceNpcId = isNpc ? (tweet.npcId || null) : (tweet.postedAsNpcId || null);

        const officialInfo = {
            id: Utils.generateId(),
            category: 'twitter',
            title: tweet.content.slice(0, 40) + (tweet.content.length > 40 ? '…' : ''),
            content: tweet.content,
            afterPlotId: tweet.afterPlotId || null,
            timestamp: tweet.timestamp,
            sourceNpcId,
            sourceNpcIds: []
        };

        AppState.data.broadcast.officialInfo.push(officialInfo);
        tweet.savedToForumId = officialInfo.id;
        Utils.saveData();
        if (typeof Forum !== 'undefined') Forum.renderOfficialInfoList?.();

        Utils.showToast(I18n.t('t.tw_saved_to_broadcast', '✓ 放送局の公式情報に保存しました'));
        this.renderThread();
    },

    // ===== 删除推文 =====
    deleteTweet(tweetId, isNpc) {
        if (!confirm(I18n.t('tw.confirm_delete_tweet', 'このツイートを削除しますか？'))) return;
        const t = this._ensureData();
        const arr = isNpc ? (t.npcTweets || []) : (t.tweets || []);
        const tweet = arr.find(tw => tw.id === tweetId);
        // 顺手清掉本地音频 blob
        if (tweet && tweet.userAudio && tweet.userAudio.type === 'local' && tweet.userAudio.audioId && typeof TTSEngine !== 'undefined') {
            TTSEngine.removeAudio(tweet.userAudio.audioId).catch(() => {});
        }
        if (isNpc) {
            t.npcTweets = (t.npcTweets || []).filter(tw => tw.id !== tweetId);
        } else {
            t.tweets = (t.tweets || []).filter(tw => tw.id !== tweetId);
        }
        Utils.saveData();
        Utils.showToast(I18n.t('t.tw_deleted', '削除しました'));
        Navigation.goTo('twitter');
    },

    // ===== 身份设置弹窗（v2：单一表单 + 账号下拉 + 添加 + 实名 toggle） =====
    // _editingAccountId 临时持有当前编辑的账号 id（'personal:xxx' 或 'npc:xxx'）
    _editingAccountId: null,

    showIdentityModal() {
        this._ensureData();
        // 默认编辑当前激活账号
        this._editingAccountId = AppState.data.twitterData.activeAccountId;
        this._renderIdentityModal();
        document.getElementById('twitterIdentityModal')?.classList.add('active');
    },

    _renderIdentityModal() {
        const t = this._ensureData();
        const container = document.getElementById('twIdentityModalBody');
        if (!container) return;

        // 当前编辑账号（缺值则用 active）
        let editId = this._editingAccountId || t.activeAccountId;
        if (!this._isAccountIdValid(editId)) editId = t.activeAccountId;
        this._editingAccountId = editId;

        const npcs = AppState.data.broadcast.officialNpcs || [];

        // 下拉：个人账号 + 论坛 NPC
        const personalOpts = (t.personalAccounts || []).map(a => {
            const v = 'personal:' + a.id;
            return `<option value="${this._esc(v)}" ${v === editId ? 'selected' : ''}>${this._esc(a.name || I18n.t('tw.id_unnamed', '名前未設定'))} @${this._esc(a.handle || 'myaccount')}</option>`;
        }).join('');
        const npcOpts = npcs.map(n => {
            const v = 'npc:' + n.id;
            return `<option value="${this._esc(v)}" ${v === editId ? 'selected' : ''}>${this._esc(n.name || n.role)}${I18n.t('tw.id_label_npc_official', '（NPC・公式）')}</option>`;
        }).join('');
        const accountOptions = `
            <optgroup label="${I18n.t('tw.id_optgroup_personal', '個人アカウント')}">${personalOpts || `<option disabled>${I18n.t('tw.id_no_accounts', '（なし）')}</option>`}</optgroup>
            <optgroup label="${I18n.t('tw.id_optgroup_npc', '論壇 NPC')}">${npcOpts || `<option disabled>${I18n.t('tw.id_no_npcs', '（NPCがいません）')}</option>`}</optgroup>
        `;

        // 当前正在编辑的账号信息
        let formHtml;
        let saveBtnVisible = true;
        if (editId && editId.startsWith('npc:')) {
            const npc = this._getNpc(editId.slice('npc:'.length));
            saveBtnVisible = false;
            if (npc) {
                const handle = (this._getNpcHandle(npc) || '@npc').replace(/^@/, '');
                const letter = (npc.name || npc.role || 'N').charAt(0).toUpperCase();
                const color = this._npcColor(npc.id);
                const avatarHtml = npc.avatarImage
                    ? `<img class="tw-user-avatar-btn tw-avatar-xl tw-avatar-img" src="${Utils.escAttr(npc.avatarImage)}" alt="" style="flex-shrink:0;">`
                    : `<div class="tw-user-avatar-btn tw-avatar-xl" style="flex-shrink:0;background:${color};">${this._esc(letter)}</div>`;
                formHtml = `
<div class="tw-identity-readonly">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
        ${avatarHtml}
        <div style="flex:1;">
            <div style="font-weight:700;font-size:17px;">${this._esc(npc.name || npc.role)}</div>
            <div style="font-size:13px;color:var(--text-secondary);">@${this._esc(handle)}</div>
        </div>
    </div>
    ${npc.bio ? `<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;padding:10px 12px;background:var(--bg-secondary);border-radius:10px;margin-bottom:12px;white-space:pre-wrap;">${this._esc(npc.bio)}</div>` : ''}
    <div style="font-size:12px;color:var(--text-tertiary);background:var(--bg-secondary);border-radius:10px;padding:10px 12px;line-height:1.5;">
        ${I18n.t('tw.id_npc_readonly', 'このアカウントは公式 NPC です。プロフィールは「論壇の NPC 設定」で管理されており、ここでは編集できません。')}
    </div>
</div>`;
            } else {
                formHtml = `<div style="padding:20px;text-align:center;color:var(--text-secondary);">${I18n.t('tw.id_account_not_found', 'このアカウントは見つかりませんでした')}</div>`;
            }
        } else {
            // personal 账号编辑表单
            const acc = this._getPersonalAccount(editId) || (t.personalAccounts || [])[0];
            if (!acc) {
                formHtml = `<div style="padding:20px;text-align:center;color:var(--text-secondary);">${I18n.t('tw.id_no_account_hint', 'アカウントがありません。「+ 追加」から作成してください。')}</div>`;
                saveBtnVisible = false;
            } else {
                const isReal = acc.isReal !== false;
                const canDelete = (t.personalAccounts || []).length > 1;
                const avatarColor = acc.avatarColor || '#e0245e';
                const avatarLetter = acc.avatarLetter || (acc.name || I18n.t('tw.id_default_letter', '私')).charAt(0).toUpperCase();
                const avatarHtml = acc.avatarImage
                    ? `<img class="tw-user-avatar-btn tw-avatar-xl tw-avatar-img" id="twIdentityPreview" src="${Utils.escAttr(acc.avatarImage)}" alt="" style="flex-shrink:0;cursor:pointer;" onclick="Twitter._uploadActiveAccountAvatar()">`
                    : `<div class="tw-user-avatar-btn tw-avatar-xl" id="twIdentityPreview" style="flex-shrink:0;background:${avatarColor};cursor:pointer;" onclick="Twitter._uploadActiveAccountAvatar()">${this._esc(avatarLetter)}</div>`;
                formHtml = `
<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
    ${avatarHtml}
    <div style="flex:1;">
        <input type="text" id="twIdentityName" placeholder="${I18n.t('tw.id_display_name', '表示名')}" value="${this._esc(acc.name || '')}"
            style="font-weight:700;font-size:17px;border:none;background:none;outline:none;border-bottom:1px solid var(--border-light);width:100%;padding-bottom:4px;margin-bottom:6px;"
            oninput="Twitter.previewIdentity()">
        <div style="font-size:12px;color:var(--text-secondary);">${I18n.t('tw.id_tap_to_change_avatar', 'アバターをタップして画像を変更')}</div>
    </div>
</div>
<div style="margin-bottom:14px;">
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">${I18n.t('tw.id_avatar_color', 'アバターカラー')}</div>
    <div class="tw-color-swatches" id="twColorSwatches"></div>
</div>
<label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">${I18n.t('tw.id_handle_label', 'ハンドル（@ なし・半角英数 / アンダースコア）')}</label>
<input type="text" id="twIdentityHandle" placeholder="myaccount" value="${this._esc(acc.handle || '')}" maxlength="20" pattern="[a-zA-Z0-9_]+" style="width:100%;margin-bottom:12px;">
<label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">${I18n.t('tw.id_avatar_letter_label', 'アバター文字（1文字）')}</label>
<input type="text" id="twIdentityAvatar" maxlength="2" placeholder="M" value="${this._esc(avatarLetter)}" style="width:100%;margin-bottom:12px;" oninput="Twitter.previewIdentity()">
<label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">${I18n.t('tw.id_bio_label', '自己紹介')}</label>
<textarea id="twIdentityBio" rows="3" placeholder="${I18n.t('tw.id_bio_placeholder', 'どんなアカウントですか？')}" style="width:100%;margin-bottom:16px;resize:none;font-size:14px;">${this._esc(acc.bio || '')}</textarea>

<label class="tw-identity-toggle" style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--bg-secondary);border-radius:10px;cursor:pointer;margin-bottom:12px;">
    <input type="checkbox" id="twIdentityIsReal" ${isReal ? 'checked' : ''} style="margin-top:2px;flex-shrink:0;">
    <span style="flex:1;">
        <span style="font-size:14px;font-weight:600;color:var(--text-primary);display:block;">${I18n.t('tw.id_realname_post', '実名として投稿')}</span>
        <span style="font-size:11px;color:var(--text-secondary);display:block;margin-top:2px;line-height:1.4;">${I18n.t('tw.id_realname_hint', 'ON：NPCがあなたの素性を知っている前提でリプ／OFF：匿名アカウントとして扱われる')}</span>
    </span>
</label>

${canDelete ? `<button type="button" class="tw-identity-delete" onclick="Twitter.deleteActiveAccount()">${I18n.t('tw.id_delete_account', 'このアカウントを削除')}</button>` : ''}`;

                setTimeout(() => {
                    this._renderColorSwatches(avatarColor);
                    this._selectedColor = avatarColor;
                }, 0);
            }
        }

        container.innerHTML = `
<div style="margin-bottom:14px;">
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;font-weight:600;">${I18n.t('tw.id_account_label', '発信アカウント')}</div>
    <div style="display:flex;gap:8px;">
        <select id="twActiveAccountSelect" style="flex:1;font-size:15px;font-weight:600;padding:10px 12px;border-radius:10px;border:1.5px solid var(--border-medium);background:var(--bg-secondary);color:var(--text-primary);" onchange="Twitter._onAccountSelectChange(this.value)">
            ${accountOptions}
        </select>
        <button type="button" class="tw-identity-add" onclick="Twitter.addPersonalAccount()" title="${I18n.t('tw.id_add_account', '個人アカウント追加')}">＋</button>
    </div>
    <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">${I18n.t('tw.id_account_hint', '下のフォームは選択中のアカウントを編集します')}</div>
</div>
<hr style="border:none;border-top:1px solid var(--border-light);margin-bottom:14px;">
${formHtml}`;

        // 保存按钮的可见性（NPC 时隐藏）
        const saveBtn = document.querySelector('#twitterIdentityModal [data-identity-save]');
        if (saveBtn) saveBtn.style.display = saveBtnVisible ? '' : 'none';
    },

    // 切换发信账号 + 同步表单（不立即写入 active，待用户保存或显式确认）
    // 但实际产品体验：选了就生效（更直觉）。所以这里立即写入 active。
    _onAccountSelectChange(value) {
        if (!this._isAccountIdValid(value)) return;
        const t = this._ensureData();
        t.activeAccountId = value;
        // 同时同步旧字段，避免没迁移的代码读到错的值
        if (value.startsWith('npc:')) {
            t.activeIdentityType = 'npc';
            t.activeNpcId = value.slice('npc:'.length);
        } else {
            t.activeIdentityType = 'personal';
            t.activeNpcId = null;
        }
        Utils.saveData();
        this._updateUserAvatar();
        this._editingAccountId = value;
        this._renderIdentityModal();
        const identity = this._getActiveIdentity();
        Utils.showToast(I18n.t('t.tw_posting_as', {name: identity.name}));
    },

    // ＋ 添加新 personal 账号
    addPersonalAccount() {
        const t = this._ensureData();
        const newAcc = {
            id: 'pa_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            name: I18n.t('tw.id_new_name', '新しいアカウント'),
            handle: 'newaccount' + (t.personalAccounts.length + 1),
            avatarLetter: I18n.t('tw.id_new_letter', '新'),
            avatarColor: '#1d9bf0',
            avatarImage: null,
            bio: '',
            isReal: true,
            joinDate: ''
        };
        t.personalAccounts.push(newAcc);
        Utils.saveData();
        this._editingAccountId = 'personal:' + newAcc.id;
        this._renderIdentityModal();
        Utils.showToast(I18n.t('t.tw_account_created', '新しいアカウントを作成しました'));
    },

    // 删除当前编辑中的 personal 账号（含其所有历史推文）
    deleteActiveAccount() {
        const t = this._ensureData();
        const editId = this._editingAccountId;
        if (!editId || !editId.startsWith('personal:')) return;
        if (t.personalAccounts.length <= 1) {
            Utils.showToast(I18n.t('t.tw_cannot_delete_last_account', '最後のアカウントは削除できません'));
            return;
        }
        const acc = this._getPersonalAccount(editId);
        if (!acc) return;
        const tweetCount = (t.tweets || []).filter(tw => tw.postedAsAccountId === editId).length;
        const msg = tweetCount > 0
            ? I18n.t('tw.id_confirm_delete_with_tweets', {name: acc.name, n: tweetCount})
            : I18n.t('tw.id_confirm_delete', {name: acc.name});
        if (!confirm(msg)) return;

        // 删账号 + 关联推文
        t.personalAccounts = t.personalAccounts.filter(a => a.id !== acc.id);
        t.tweets = (t.tweets || []).filter(tw => tw.postedAsAccountId !== editId);

        // 如果当前 active 也被删，回退到第一个
        if (t.activeAccountId === editId) {
            t.activeAccountId = 'personal:' + t.personalAccounts[0].id;
            t.activeIdentityType = 'personal';
            t.activeNpcId = null;
        }
        Utils.saveData();
        this._editingAccountId = t.activeAccountId;
        this._updateUserAvatar();
        this._renderIdentityModal();
        // 如果用户主页可见，刷新
        const userProfileEl = document.getElementById('twitter-user-profile');
        if (userProfileEl?.classList.contains('active')) this.renderUserProfile();
        this.renderTimeline?.();
        Utils.showToast(I18n.t('t.tw_deleted_check', '✓ 削除しました'));
    },

    // 头像上传：写入正在编辑的账号
    _uploadActiveAccountAvatar() {
        const editId = this._editingAccountId;
        if (!editId || !editId.startsWith('personal:')) return;
        const id = editId.slice('personal:'.length);
        this._pickAvatarFile('account:' + id);
    },

    closeIdentityModal() {
        document.getElementById('twitterIdentityModal')?.classList.remove('active');
        // 如果从用户主页打开的，刷新主页
        const userProfileEl = document.getElementById('twitter-user-profile');
        if (userProfileEl?.classList.contains('active')) this.renderUserProfile();
    },

    _renderColorSwatches(selectedColor) {
        const container = document.getElementById('twColorSwatches');
        if (!container) return;
        container.innerHTML = this._AVATAR_COLORS.map(c => {
            const active = c === selectedColor ? ' tw-swatch-active' : '';
            return `<button class="tw-color-swatch${active}" style="background:${c};" onclick="Twitter._selectColor('${c}')" title="${c}"></button>`;
        }).join('');
    },

    _selectColor(color) {
        document.querySelectorAll('.tw-color-swatch').forEach(s => s.classList.remove('tw-swatch-active'));
        const btn = [...document.querySelectorAll('.tw-color-swatch')].find(s => s.style.background === color || s.style.backgroundColor === color);
        if (btn) btn.classList.add('tw-swatch-active');
        const preview = document.getElementById('twIdentityPreview');
        if (preview) preview.style.background = color;
        this._selectedColor = color;
    },

    previewIdentity() {
        const nameVal = document.getElementById('twIdentityName')?.value || '';
        const avatarVal = document.getElementById('twIdentityAvatar')?.value || nameVal.charAt(0) || 'M';
        const preview = document.getElementById('twIdentityPreview');
        if (preview) preview.textContent = avatarVal.charAt(0).toUpperCase() || 'M';
    },

    // 处理 handle：去 @、只保留半角英数+下划线、限长 20
    _sanitizeHandle(raw, fallback) {
        const cleaned = String(raw || '')
            .replace(/^@+/, '')
            .replace(/[^a-zA-Z0-9_]/g, '')
            .slice(0, 20);
        return cleaned || fallback;
    },

    saveIdentity() {
        const t = this._ensureData();
        const editId = this._editingAccountId;
        // NPC 不在此编辑
        if (!editId || !editId.startsWith('personal:')) {
            this.closeIdentityModal();
            return;
        }
        const acc = this._getPersonalAccount(editId);
        if (!acc) { this.closeIdentityModal(); return; }

        const nameEl = document.getElementById('twIdentityName');
        const handleEl = document.getElementById('twIdentityHandle');
        const avatarEl = document.getElementById('twIdentityAvatar');
        const bioEl = document.getElementById('twIdentityBio');
        const isRealEl = document.getElementById('twIdentityIsReal');

        acc.name = nameEl?.value.trim() || acc.name || I18n.t('tw.id_default_name', '私のアカウント');
        acc.handle = this._sanitizeHandle(handleEl?.value, 'myaccount');
        acc.avatarLetter = (avatarEl?.value.trim().charAt(0) || acc.name.charAt(0) || '?').toUpperCase();
        acc.avatarColor = this._selectedColor || acc.avatarColor || '#e0245e';
        acc.bio = bioEl?.value.trim() || '';
        acc.isReal = isRealEl ? !!isRealEl.checked : (acc.isReal !== false);
        if (!acc.joinDate) acc.joinDate = I18n.t('tw.time_year_month', {year: new Date().getFullYear(), month: new Date().getMonth() + 1});

        Utils.saveData();
        this.closeIdentityModal();
        this._updateUserAvatar();
        // 顶时间线/profile 都重渲，handle/name 改了要同步
        this.renderTimeline?.();
        const userProfileEl = document.getElementById('twitter-user-profile');
        if (userProfileEl?.classList.contains('active')) this.renderUserProfile();
        Utils.showToast(I18n.t('t.tw_saved', '✓ 保存しました'));
    },

    // ===== DM 功能 =====
    showDmList() {
        Navigation.goTo('twitter-dm-list');
    },

    openDm(npcId) {
        this.currentDmNpcId = npcId;
        Navigation.goTo('twitter-dm');
    },

    // ===== 解析回复文本 =====
    _parseReplies(text) {
        const blocks = text.split(/---\s*REPLY\s*---/i).map(s => s.trim()).filter(Boolean);
        return blocks.map(block => {
            const author = (block.match(/^AUTHOR:\s*(.+)$/m) || [])[1]?.trim() || 'ファン';
            const handle = (block.match(/^HANDLE:\s*(.+)$/m) || [])[1]?.trim() || '@user';
            const role = (block.match(/^ROLE:\s*(.+)$/m) || [])[1]?.trim() || 'fan';
            const contentMatch = block.match(/^CONTENT:[ \t]*(.+)$/m);
            const content = contentMatch ? contentMatch[1].trim() : '';
            const translation = (block.match(/^TRANSLATION:[ \t]*(.+)$/m) || [])[1]?.trim() || null;
            return { author, handle, role, content, translation };
        }).filter(r => r.content);
    },

    // ニュース見出し風のリプライをフィルタリング（リプ欄に出現すべきではない）
    _looksLikeNewsHeadline(content) {
        if (!content) return false;
        const c = String(content);
        // ニュース通信社風の角括弧タグから始まる
        if (/^[【\[](話題|速報|お知らせ|公式|トレンド|注目|発表|配信開始|放送開始|新情報|解禁|報道)[】\]]/.test(c)) return true;
        // ニュース定型句
        if (/トレンド入り[！!]|公式ピックアップ|公式が公開/.test(c)) return true;
        // 客観的紹介の典型的な締め
        if (/に注目です。?$|放送開始しました！?$/.test(c)) return true;
        return false;
    },

    // ===== 辅助方法 =====
    _getNpc(npcId) {
        if (!npcId) return null;
        return (AppState.data.broadcast.officialNpcs || []).find(n => n.id === npcId) || null;
    },

    _getNpcHandle(npc) {
        if (!npc) return '@npc';
        // 1) \u663e\u5f0f\u8bbe\u4e86 handle \u4f18\u5148\u7528
        if (npc.handle) {
            const h = String(npc.handle).replace(/^@+/, '').trim();
            if (h) return '@' + h;
        }
        // 2) ID \u662f ASCII \u98ce\u683c\uff08\u5982 cv_misaki / staff_tanaka\uff09\uff0c\u76f4\u63a5\u7528
        const id = String(npc.id || '');
        if (/^[a-zA-Z0-9_]+$/.test(id) && id.length > 0) {
            return '@' + id.toLowerCase().slice(0, 20);
        }
        // 3) \u540d\u5b57\u91cc\u62a0 ASCII \u90e8\u5206\uff08\u7f57\u9a6c\u5b57\u6635\u79f0\u3001\u82f1\u6587\u540d\uff09
        const ascii = (npc.name || npc.role || '')
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '')
            .slice(0, 15);
        if (ascii.length >= 2) return '@' + ascii;
        // 4) fallback\uff1astaff_<id \u54c8\u5e0c>\uff0c\u4e0d\u518d\u8fd4\u56de\u4e2d\u65e5\u6587 handle
        let hash = 0;
        for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffff;
        return '@staff_' + hash.toString(36).slice(0, 5);
    },

    _npcColor(npcId) {
        // 根据 npcId 生成稳定颜色
        const colors = ['#1d9bf0', '#17bf63', '#794bc4', '#f4900c', '#e0245e', '#2b7be9', '#00ba7c'];
        if (!npcId) return colors[0];
        let hash = 0;
        for (let i = 0; i < npcId.length; i++) hash = (hash * 31 + npcId.charCodeAt(i)) & 0xffff;
        return colors[hash % colors.length];
    },

    _roleColor(role) {
        const map = { fan: '#1d9bf0', anti: '#e0245e', media: '#17bf63', npc: '#794bc4', doujin_writer: '#f4900c', doujin_artist: '#9b59b6', cp_fan: '#e0245e', organizer: '#1d9bf0' };
        return map[role] || '#888';
    },

    _fanTypeColor(type) {
        const map = {
            fan: '#888',         // 一般ファン→グレー
            industry: '#794bc4', // 業界→パープル
            media: '#17bf63',    // メディア→グリーン
            doujin_writer: '#f4900c',   // 文手→オレンジ
            doujin_artist: '#9b59b6',   // 絵師→パープル
            cp_fan: '#e0245e',   // CP厨→ピンク
            organizer: '#1d9bf0' // 企画主→ブルー
        };
        return map[type] || '#888';
    },

    // ===== Fan Friend 辅助方法 =====
    _getFanFriend(id) {
        return (this._ensureData().fanFriends || []).find(f => f.id === id) || null;
    },

    _getFanByHandle(handle) {
        if (!handle) return null;
        return (this._ensureData().fanFriends || []).find(f => f.handle === handle) || null;
    },

    _fanTypeLabel(type) {
        const map = {
            fan: I18n.t('tw.fan_type_fan', '一般ファン'),
            industry: I18n.t('tw.fan_type_industry', '業界関係者'),
            media: I18n.t('tw.fan_type_media', 'メディア'),
            doujin_writer: I18n.t('tw.fan_type_doujin_writer', '文手'),
            doujin_artist: I18n.t('tw.fan_type_doujin_artist', '絵師（同人作家）'),
            cp_fan: I18n.t('tw.fan_type_cp_fan', 'CP厨'),
            organizer: I18n.t('tw.fan_type_organizer', '企画主'),
            event_promo: I18n.t('tw.fan_type_event_promo', 'イベント告知'),
            event_haul: I18n.t('tw.fan_type_event_haul', '戦利品報告'),
            event_repo: I18n.t('tw.fan_type_event_repo', 'イベントレポ'),
            fanart_share: I18n.t('tw.fan_type_fanart_share', '絵師'),
            radio_drama: I18n.t('tw.fan_type_radio_drama', 'ドラマCD勢')
        };
        return map[type] || I18n.t('tw.fan_type_default', 'ファン');
    },

    _buildFanFriendsPrompt() {
        const t = this._ensureData();
        const friends = t.fanFriends || [];
        if (friends.length === 0) return '';
        const list = friends.map(f =>
            `- ${f.name}（${f.handle}）タイプ: ${f.type}${f.bio ? '、' + f.bio.replace(/\n/g, ' ').slice(0, 60) : ''}`
        ).join('\n');
        return `\n既存のフォロワー（必ず1〜2名のツイートを含めること）:\n${list}\n上記のフォロワーのNAMEとHANDLEは正確に一致させること。\n`;
    },

    // ===== v2.70.0 doujin_writer 最近 pixiv 新作 prompt 注入 =====
    _buildDoujinWriterNewWorksPrompt() {
        const t = this._ensureData();
        const writers = (t.fanFriends || []).filter(f => f.type === 'doujin_writer');
        if (writers.length === 0) return '';

        const novels = (AppState.data.pixivData?.novels || []);
        // 找出最近 3 天内 / author_npc_id 非空的新作（按 createdAt 降序）
        const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
        const recentWorks = novels
            .filter(n => n.author_npc_id && n.createdAt && n.createdAt > threeDaysAgo)
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .slice(0, 10);  // timeline 注入上限 10 篇、避免 prompt 爆炸

        if (recentWorks.length === 0) return '';

        const lines = recentWorks.map(n => {
            const writer = writers.find(w => w.id === n.author_npc_id);
            if (!writer) return null;
            const tagsStr = (n.tags || []).slice(0, 5).join(', ');
            return `- NPC: ${writer.name}（${writer.handle}, promoteStyle: ${writer.promoteStyle || 'occasional'}）\n  最近の新作: 「${n.title}」（pixiv ID: ${n.id}, tags: ${tagsStr}）`;
        }).filter(Boolean).join('\n\n');

        if (!lines) return '';

        return `\n\n【pixiv 新作情報 — 自宣ツイート判定用】
以下のフォロワーは最近 pixiv で新作を発表しました。彼女たちの promoteStyle に従って timeline で自然に言及するかどうか決めてください：
- active: 必ず自宣ツイートを生成（PIXIV_LINK 付き、嬉しそうに / 創作の喜びを語る）
- occasional: 30% 確率で自宣（時々まとめて告知、控えめに）
- shy: 5% 確率（基本発信しない、たまに「pixiv 更新しました」程度の短文のみ）

自宣ツイートには PIXIV_LINK フィールドを含めること（pixiv ID から URL 生成: https://www.pixiv.net/novel/show.php?id=<pixiv ID>）。

${lines}
`;
    },

    _timeAgo(ts) {
        if (!ts) return '';
        const diff = Date.now() - ts;
        const m = Math.floor(diff / 60000);
        if (m < 1) return I18n.t('tw.time_just_now', 'たった今');
        if (m < 60) return I18n.t('tw.time_minutes', {n: m});
        const h = Math.floor(m / 60);
        if (h < 24) return I18n.t('tw.time_hours', {n: h});
        const d = Math.floor(h / 24);
        return I18n.t('tw.time_days', {n: d});
    },

    _formatDate(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        // 注意：tw.time_full key 在 zh 中是 {year}年{month}月{day}日 {hh}:{mm}（按当前 zh 文案保留日式格式）
        return I18n.t('tw.time_full', {year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hh, mm}) ||
            `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
    },

    _esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    // ===== 角标更新 =====
    _updateBadges() {
        const t = this._ensureData();
        const unreadNotif = (t.notifications || []).filter(n => !n.isRead).length;
        const unreadDm = (t.inboxDms || []).filter(d => !d.isRead).length;
        const notifBadge = document.getElementById('twNavNotifBadge');
        const dmBadge = document.getElementById('twNavDmBadge');
        if (notifBadge) { notifBadge.textContent = unreadNotif > 9 ? '9+' : (unreadNotif || ''); notifBadge.style.display = unreadNotif ? '' : 'none'; }
        if (dmBadge) { dmBadge.textContent = unreadDm > 9 ? '9+' : (unreadDm || ''); dmBadge.style.display = unreadDm ? '' : 'none'; }
    },

    // ===== 通知系统 =====
    async _generateTweetNotifications(tweetId) {
        const t = this._ensureData();
        const arr = t.tweets || [];
        const tweet = arr.find(tw => tw.id === tweetId);
        if (!tweet) return;

        const forumData = AppState.data.forumData || {};
        const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
        const identity = this._getActiveIdentity();

        const accountDesc = identity.type === 'personal' ? 'ファンアカウント' : '公式アニメアカウント';
        const systemPrompt = `あなたは${accountDesc}のX（Twitter）通知リアクションをシミュレーションしています。
${accountDesc}が投稿したツイートへのリアルなファン・メディアの反応を生成してください。

アカウント: ${this._esc(identity.name)} (${this._esc(identity.handle)})
作品設定（以下の内容を超えて捏造しないこと）:
${worldContext || '（未設定 — 具体的なキャラ名・CP・ストーリーを捏造しないこと）'}
${Utils.PROMPTS.infoAccessRule()}
通知タイプ: reply (💬) / quote (🔁) / mention (💬) / like (❤️)

出力フォーマット（厳守）:
---NOTIF---
TYPE: reply
FROM_NAME: [ファン名]
FROM_HANDLE: [@handle]
FROM_TYPE: [fan/industry/media]
CONTENT: [日本語のリプライ・引用・メンション、1-3行]
TRANSLATION: [中国語翻訳、1行]

3〜5件の通知を生成すること。タイプを自然に混ぜること。`;

        const messages = [{ role: 'user', content: `官方推文内容：\n${tweet.content}\n\n上記のツイートへの通知（リプライ・引用・いいね等）を生成してください。` }];
        const raw = await Utils.callChatAPI(messages, systemPrompt);

        const blocks = raw.split(/---\s*NOTIF\s*---/i).map(s => s.trim()).filter(Boolean);
        const now = Date.now();
        let added = 0;
        for (const block of blocks) {
            const typeRaw = (block.match(/^TYPE:\s*(.+)$/m) || [])[1]?.trim() || 'reply';
            const type = ['reply', 'quote', 'mention', 'like'].includes(typeRaw) ? typeRaw : 'reply';
            const fromName = (block.match(/^FROM_NAME:\s*(.+)$/m) || [])[1]?.trim() || 'ファン';
            const fromHandle = (block.match(/^FROM_HANDLE:\s*(.+)$/m) || [])[1]?.trim() || '@user';
            const fromTypeRaw = (block.match(/^FROM_TYPE:\s*(.+)$/m) || [])[1]?.trim() || 'fan';
            const fromType = ['fan', 'industry', 'media'].includes(fromTypeRaw) ? fromTypeRaw : 'fan';
            const contentMatch = block.match(/CONTENT:[ \t]*\n?([\s\S]*?)(?=\nTRANSLATION:|\s*$)/);
            const content = contentMatch ? contentMatch[1].trim() : '';
            const tlMatch = block.match(/^TRANSLATION:[ \t]*(.+)$/m);
            const translation = tlMatch ? tlMatch[1].trim() : null;
            if (!content) continue;
            t.notifications.unshift({
                id: Utils.generateId(),
                type, fromName, fromHandle, fromType,
                content, translation,
                targetTweetId: tweetId,
                timestamp: now - added * 3000,
                isRead: false
            });
            added++;
        }

        // 通知最多保留 100 条
        if (t.notifications.length > 100) t.notifications = t.notifications.slice(0, 100);
        Utils.saveData();
        this._updateBadges();
    },

    _notifTab: 'all', // 'all' | 'mention'

    renderNotifications() {
        const t = this._ensureData();
        const container = document.getElementById('twitterNotifContent');
        if (!container) return;

        const allNotifs = t.notifications || [];
        const tab = this._notifTab || 'all';
        const notifs = tab === 'mention'
            ? allNotifs.filter(n => n.type === 'reply' || n.type === 'mention' || n.type === 'quote')
            : allNotifs;

        const tabBar = `<div class="tw-tabs-bar tw-notif-tabs">
            <button class="tw-tab-btn${tab === 'all' ? ' active' : ''}" onclick="Twitter._notifTab='all';Twitter.renderNotifications()">${I18n.t('tw.notif_tab_all', '全て')}</button>
            <button class="tw-tab-btn${tab === 'mention' ? ' active' : ''}" onclick="Twitter._notifTab='mention';Twitter.renderNotifications()">${I18n.t('tw.notif_tab_mention', '@ あなた宛')}</button>
        </div>`;

        if (notifs.length === 0) {
            container.innerHTML = tabBar + `<div class="empty-state" style="padding-top:60px;"><div style="margin-bottom:12px;color:var(--text-secondary);">${this._svg.bellLg}</div><div>${I18n.t('tw.empty_no_notifications', 'まだ通知がありません')}</div><div style="font-size:13px;color:var(--text-secondary);margin-top:6px;">${I18n.t('tw.empty_hint_notif', 'ツイートを投稿すると通知が届きます')}</div></div>`;
            return;
        }

        // 大彩色图标（左侧，类似真推紫星标位）
        const typeIcon = {
            reply: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#1d9bf0"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
            quote: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#00ba7c"><path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
            mention: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#1d9bf0"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>`,
            like: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#f91880"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
            retweet: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#00ba7c"><path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
            follow: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#1d9bf0"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`,
            event: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#f91880"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg>`
        };

        const actionLabel = {
            reply: I18n.t('tw.notif_replied', 'がリプライしました'),
            quote: I18n.t('tw.notif_quoted', 'があなたのツイートを引用しました'),
            mention: I18n.t('tw.notif_mentioned', 'があなたをメンションしました'),
            like: I18n.t('tw.notif_liked', 'があなたのツイートをいいねしました'),
            retweet: I18n.t('tw.notif_retweeted', 'があなたのツイートをリツイートしました'),
            follow: I18n.t('tw.notif_followed', 'があなたをフォローしました'),
            event: I18n.t('tw.notif_event', 'からのお知らせ')
        };

        container.innerHTML = tabBar + notifs.map(n => {
            const unreadClass = n.isRead ? '' : ' tw-notif-unread';
            const icon = typeIcon[n.type] || typeIcon.reply;
            const tlBlock = n.translation ? `<details class="tw-tl-block" onclick="event.stopPropagation()">
    <summary class="tw-tl-btn">${I18n.t('tw.action_translate', '訳')}</summary>
    <div class="tw-tl-content">${this._esc(n.translation)}</div>
</details>` : '';
            const displayName = n.fromName || n.senderName || I18n.t('tw.notif_user_default', 'ユーザー');
            const displayHandle = n.fromHandle || n.senderHandle || '';
            const avatarLetter = (n.fromAvatarLetter || displayName.charAt(0) || '?').toUpperCase();
            const avatarColor = n.fromAvatarColor || this._npcColor(n.fromNpcId || displayName);
            // follow 类型支持 followCount > 1：「○○など N 名にフォローされました」
            let action = actionLabel[n.type] || '';
            if (n.type === 'follow' && n.followCount && n.followCount > 1) {
                action = I18n.t('tw.notif_followed_count', {n: n.followCount});
            }
            const clickAction = n.targetTweetId ? `Twitter.openTweet('${this._esc(n.targetTweetId)}', false)` : '';
            const previewText = (n.content || '').slice(0, 80);

            return `<div class="tw-notif-item${unreadClass}" onclick="${clickAction}">
    <div class="tw-notif-icon">${icon}</div>
    <div class="tw-notif-body">
        <div class="tw-notif-avatar" style="background:${avatarColor}">${this._esc(avatarLetter)}</div>
        <div class="tw-notif-text">
            <div class="tw-notif-line"><span class="tw-notif-name">${this._esc(displayName)}</span>${displayHandle ? ` <span class="tw-notif-handle">${this._esc(displayHandle)}</span>` : ''}<span class="tw-notif-time">${this._timeAgo(n.timestamp)}</span></div>
            <div class="tw-notif-action">${action}</div>
            ${previewText ? `<div class="tw-notif-content">${this._esc(previewText)}</div>` : ''}
            ${tlBlock}
        </div>
    </div>
</div>`;
        }).join('');
    },

    markNotificationsRead() {
        const t = this._ensureData();
        (t.notifications || []).forEach(n => { n.isRead = true; });
        Utils.saveData();
        this._updateBadges();
        this.renderNotifications();
        Utils.showToast(I18n.t('t.tw_all_marked_read', '✓ 全て既読にしました'));
    },

    // ===== 私信列表页 =====
    renderDmList() {
        const t = this._ensureData();
        const container = document.getElementById('twitterDmListContent');
        if (!container) return;

        const npcs = AppState.data.broadcast.officialNpcs || [];
        const inboxDms = t.inboxDms || [];
        const unreadInbox = inboxDms.filter(d => !d.isRead).length;

        // 来信请求入口
        const inboxBtn = `<div class="tw-dm-inbox-btn" onclick="Twitter.renderInboxList()">
    <div style="display:flex;align-items:center;gap:10px;">
        <span style="color:var(--accent);">${this._svg.mailMd}</span>
        <div>
            <div style="font-weight:600;font-size:14px;">${I18n.t('tw.dm_msg_request', 'メッセージリクエスト')}</div>
            <div style="font-size:12px;color:var(--text-secondary);">${I18n.t('tw.dm_request_desc', 'ファン・合作からの来信')}</div>
        </div>
    </div>
    ${unreadInbox > 0 ? `<span class="tw-dm-inbox-count">${unreadInbox}</span>` : '<span style="color:var(--text-secondary);font-size:18px;">›</span>'}
</div>`;

        if (npcs.length === 0) {
            container.innerHTML = inboxBtn + `<div style="text-align:center;padding:30px 20px;color:var(--text-secondary);">${I18n.t('tw.dm_add_npc_in_broadcast', '放送局でNPCを追加すると<br>DMを送れます')}</div>`;
            return;
        }

        // NPC 对话列表（按最新消息时间排序）
        const npcItems = npcs.map(n => {
            const msgs = (t.dms[n.id] || []);
            const lastMsg = msgs[msgs.length - 1];
            const preview = lastMsg ? lastMsg.content.slice(0, 30) + (lastMsg.content.length > 30 ? '…' : '') : I18n.t('tw.dm_send_hint', 'DMを送ってみましょう');
            const avatar = (n.name || n.role || '？').charAt(0).toUpperCase();
            const color = this._npcColor(n.id);
            return {
                timestamp: lastMsg?.timestamp || 0,
                html: `<div class="tw-dm-list-item" onclick="Twitter.openDm('${this._esc(n.id)}')">
    ${n.avatarImage
        ? `<img class="tw-card-avatar tw-avatar-img" src="${Utils.escAttr(n.avatarImage)}" alt="" style="flex-shrink:0">`
        : `<div class="tw-card-avatar" style="background:${color};flex-shrink:0;">${this._esc(avatar)}</div>`}
    <div class="tw-dm-list-body">
        <div class="tw-dm-list-name">${this._esc(n.name || n.role)}</div>
        <div class="tw-dm-list-preview">「${this._esc(preview)}」</div>
    </div>
    <div style="font-size:12px;color:var(--text-secondary);flex-shrink:0;">${this._timeAgo(lastMsg?.timestamp)}</div>
</div>`
            };
        }).sort((a, b) => b.timestamp - a.timestamp).map(item => item.html);

        container.innerHTML = inboxBtn + npcItems.join('');
    },

    renderInboxList() {
        const t = this._ensureData();
        const container = document.getElementById('twitterDmListContent');
        if (!container) return;

        const inboxDms = t.inboxDms || [];

        const backBtn = `<div class="tw-dm-list-item" onclick="Twitter.renderDmList()" style="border-bottom:2px solid var(--border);padding:10px 16px;">
    <span style="font-size:18px;">‹</span>
    <span style="font-weight:600;font-size:14px;margin-left:8px;">${I18n.t('tw.dm_msg_request', 'メッセージリクエスト')}</span>
</div>`;

        if (inboxDms.length === 0) {
            container.innerHTML = backBtn + `<div class="empty-state" style="padding-top:40px;"><div style="margin-bottom:10px;color:var(--text-secondary);">${this._svg.mailLg}</div><div>${I18n.t('tw.empty_no_inbox', 'まだ来信がありません')}</div></div>`;
            return;
        }

        const items = [...inboxDms].sort((a, b) => b.timestamp - a.timestamp).map(dm => {
            const lastMsg = dm.messages[dm.messages.length - 1];
            const preview = lastMsg ? lastMsg.content.slice(0, 35) + (lastMsg.content.length > 35 ? '…' : '') : '';
            const avatarColor = dm.senderType === 'collab' ? '#794bc4' : '#888';
            const avatar = (dm.senderName || '？').charAt(0).toUpperCase();
            const unreadDot = !dm.isRead ? `<span class="tw-dm-unread-dot"></span>` : '';
            return `<div class="tw-dm-list-item" onclick="Twitter.openInboxDm('${this._esc(dm.id)}')">
    <div class="tw-card-avatar" style="background:${avatarColor};flex-shrink:0;">${this._esc(avatar)}</div>
    <div class="tw-dm-list-body">
        <div class="tw-dm-list-name">${this._esc(dm.senderName)} <span style="font-size:12px;color:var(--text-secondary);">${this._esc(dm.senderHandle)}</span></div>
        <div class="tw-dm-list-preview">${this._esc(preview)}</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
        <span style="font-size:12px;color:var(--text-secondary);">${this._timeAgo(dm.timestamp)}</span>
        ${unreadDot}
    </div>
</div>`;
        });

        container.innerHTML = backBtn + items.join('');
    },

    openInboxDm(dmId) {
        const t = this._ensureData();
        const dm = (t.inboxDms || []).find(d => d.id === dmId);
        if (!dm) return;

        dm.isRead = true;
        Utils.saveData();
        this._updateBadges();

        this.currentDmNpcId = null;
        this.currentInboxDmId = dmId;
        this.currentDmMode = 'inbox';
        Navigation.goTo('twitter-dm');
    },

    // 复用 renderDm() 但支持 inbox 模式
    renderDm() {
        const t = this._ensureData();

        if (this.currentDmMode === 'inbox') {
            const dm = (t.inboxDms || []).find(d => d.id === this.currentInboxDmId);
            if (!dm) { Navigation.goTo('twitter-dm-list'); return; }

            const avatarEl = document.getElementById('twDmAvatar');
            const nameEl = document.getElementById('twDmName');
            const handleEl = document.getElementById('twDmHandle');
            const avatarColor = dm.senderType === 'collab' ? '#794bc4' : '#888';
            if (avatarEl) { avatarEl.textContent = (dm.senderName || '？').charAt(0).toUpperCase(); avatarEl.style.background = avatarColor; }
            if (nameEl) nameEl.textContent = dm.senderName || I18n.t('tw.dm_msg_request', '来信');
            if (handleEl) handleEl.textContent = dm.senderHandle || '@user';

            this._renderInboxDmMessages(dm);
            return;
        }

        // Fan Friend DM
        const fan = this._getFanFriend(this.currentDmNpcId);
        if (fan) {
            this.currentDmMode = 'fan';
            const avatarEl = document.getElementById('twDmAvatar');
            const nameEl = document.getElementById('twDmName');
            const handleEl = document.getElementById('twDmHandle');
            if (avatarEl) { avatarEl.textContent = fan.name.charAt(0).toUpperCase(); avatarEl.style.background = fan.avatarColor; }
            if (nameEl) nameEl.textContent = fan.name;
            if (handleEl) handleEl.textContent = fan.handle;
            this._renderDmMessages();
            return;
        }

        // 原 NPC DM 逻辑
        this.currentDmMode = 'npc';
        if (!this.currentDmNpcId) { Navigation.goTo('twitter'); return; }
        const npc = this._getNpc(this.currentDmNpcId);
        if (!npc) { Navigation.goTo('twitter'); return; }

        const avatarEl = document.getElementById('twDmAvatar');
        const nameEl = document.getElementById('twDmName');
        const handleEl = document.getElementById('twDmHandle');
        const npcName = npc.name || npc.role;
        const color = this._npcColor(npc.id);
        if (avatarEl) { avatarEl.textContent = npcName.charAt(0).toUpperCase(); avatarEl.style.background = color; }
        if (nameEl) nameEl.textContent = npcName;
        if (handleEl) handleEl.textContent = this._getNpcHandle(npc);

        this._renderDmMessages();
    },

    // NPC DM 消息渲染
    _renderDmMessages() {
        const t = this._ensureData();
        const container = document.getElementById('twitterDmMessages');
        if (!container || !this.currentDmNpcId) return;

        const msgs = t.dms[this.currentDmNpcId] || [];
        if (msgs.length === 0) {
            const npc = this._getNpc(this.currentDmNpcId);
            const fan = !npc ? this._getFanFriend(this.currentDmNpcId) : null;
            const displayName = npc ? (npc.name || npc.role) : (fan ? fan.name : 'NPC');
            container.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--text-secondary);font-size:14px;">${I18n.t('tw.empty_dm_send', {name: this._esc(displayName)})}</div>`;
        } else {
            container.innerHTML = msgs.map(m => {
                const isUser = m.role === 'user';
                return `<div class="tw-dm-msg ${isUser ? 'tw-dm-msg-user' : 'tw-dm-msg-npc'}">
    <div class="tw-dm-bubble">${this._esc(m.content).replace(/\n/g, '<br>')}</div>
    <div class="tw-dm-time">${this._timeAgo(m.timestamp)}</div>
</div>`;
            }).join('');
        }
        container.scrollTop = container.scrollHeight;
    },

    _renderInboxDmMessages(dm) {
        const container = document.getElementById('twitterDmMessages');
        if (!container) return;

        const msgs = dm.messages || [];
        if (msgs.length === 0) {
            container.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--text-secondary);font-size:14px;">${I18n.t('tw.empty_inbox_msg_from', {name: this._esc(dm.senderName)})}</div>`;
        } else {
            container.innerHTML = msgs.map(m => {
                const isUser = m.role === 'user';
                return `<div class="tw-dm-msg ${isUser ? 'tw-dm-msg-user' : 'tw-dm-msg-npc'}">
    <div class="tw-dm-bubble">${this._esc(m.content).replace(/\n/g, '<br>')}</div>
    <div class="tw-dm-time">${this._timeAgo(m.timestamp)}</div>
</div>`;
            }).join('');
        }
        container.scrollTop = container.scrollHeight;
    },

    // sendDm 路由到正确处理器
    async sendDm() {
        if (this.currentDmMode === 'inbox') {
            await this._sendInboxDmReply();
            return;
        }
        if (this.currentDmMode === 'fan') {
            await this._sendFanDmReply();
            return;
        }
        // 原 NPC DM 逻辑
        const input = document.getElementById('twitterDmInput');
        const content = input?.value.trim();
        if (!content || !this.currentDmNpcId) return;

        const t = this._ensureData();
        if (!t.dms[this.currentDmNpcId]) t.dms[this.currentDmNpcId] = [];

        t.dms[this.currentDmNpcId].push({
            id: Utils.generateId(),
            role: 'user',
            content,
            timestamp: Date.now()
        });
        if (input) { input.value = ''; input.style.height = 'auto'; }
        this._renderDmMessages();

        const sendBtn = document.querySelector('.tw-dm-send-btn');
        if (sendBtn) sendBtn.disabled = true;

        try {
            const npc = this._getNpc(this.currentDmNpcId);
            const npcName = npc ? (npc.name || npc.role) : 'NPC';
            const forumData = AppState.data.forumData || {};
            const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
            const history = t.dms[this.currentDmNpcId].slice(-10);

            const systemPrompt = `あなたはアニメ作品の${npcName}（${npc?.role || '公式NPC'}）としてロールプレイしています。
X（Twitter）のDMでファンとチャットしています。

キャラクター設定:
${worldContext || '（未設定 — 具体的なキャラ名・CP・ストーリーを捏造しないこと）'}

⚠️ 情報開示の制限: キャラクターとして設定を「知っている」が、ファンとのカジュアルなDMで自分から過去や秘密を語り出さないこと。相手から具体的に聞かれた場合のみ、キャラクターらしくはぐらかすか、軽く触れる程度にすること。

ルール:
- ${npcName}としてキャラクターを維持すること
- キャラクターの口調や話し方に合わせて自然な日本語で返信すること
- DM返信は簡潔に（最大1〜5行）
- 上記の設定にないストーリーイベントを捏造しないこと
- 温かく、本物らしく、魅力的な対話にすること
- 動画演出（フラッシュバック・ナレーション・モンタージュ等）は観客向けの映像技法であり、キャラクターが実際に目撃したものではない`;

            const messages = history.map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content
            }));

            const raw = await Utils.callChatAPI(messages, systemPrompt);
            t.dms[this.currentDmNpcId].push({
                id: Utils.generateId(),
                role: 'npc',
                content: raw.trim(),
                timestamp: Date.now()
            });

            Utils.saveData();
            this._renderDmMessages();
        } catch (e) {
            Utils.showToast(I18n.t('t.tw_send_failed', '送信失敗：') + e.message);
        } finally {
            if (sendBtn) sendBtn.disabled = false;
        }
    },

    async _sendInboxDmReply() {
        const input = document.getElementById('twitterDmInput');
        const content = input?.value.trim();
        if (!content || !this.currentInboxDmId) return;

        const t = this._ensureData();
        const dm = (t.inboxDms || []).find(d => d.id === this.currentInboxDmId);
        if (!dm) return;

        dm.messages.push({ id: Utils.generateId(), role: 'user', content, timestamp: Date.now() });
        if (input) { input.value = ''; input.style.height = 'auto'; }
        this._renderInboxDmMessages(dm);

        const sendBtn = document.querySelector('.tw-dm-send-btn');
        if (sendBtn) sendBtn.disabled = true;

        try {
            const forumData = AppState.data.forumData || {};
            const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
            const history = dm.messages.slice(-8);
            const senderDesc = dm.senderType === 'collab' ? 'コラボを求める企業・クリエイター' : '熱心なファン';

            const systemPrompt = `あなたは${dm.senderName}（${dm.senderHandle}）としてロールプレイしています。${senderDesc}として、X（Twitter）のDMで公式アニメアカウントとチャットしています。

作品設定（以下の内容を超えて捏造しないこと）:
${worldContext || '（未設定 — 具体的なキャラ名・CP・ストーリーを捏造しないこと）'}
${Utils.PROMPTS.infoAccessRule()}
ルール:
- ペルソナに合わせて自然な日本語で返信すること
- 最大1〜4行
- 上記の設定にないストーリーイベントを捏造しないこと`;

            const messages = history.map(m => ({
                role: m.role === 'user' ? 'assistant' : 'user',
                content: m.content
            }));

            const raw = await Utils.callChatAPI(messages, systemPrompt);
            dm.messages.push({ id: Utils.generateId(), role: 'sender', content: raw.trim(), timestamp: Date.now() });
            dm.timestamp = Date.now();

            Utils.saveData();
            this._renderInboxDmMessages(dm);
        } catch (e) {
            Utils.showToast(I18n.t('t.tw_send_failed', '送信失敗：') + e.message);
        } finally {
            if (sendBtn) sendBtn.disabled = false;
        }
    },

    async _sendFanDmReply() {
        const input = document.getElementById('twitterDmInput');
        const content = input?.value.trim();
        if (!content || !this.currentDmNpcId) return;

        const t = this._ensureData();
        const fan = this._getFanFriend(this.currentDmNpcId);
        if (!fan) return;

        if (!t.dms[fan.id]) t.dms[fan.id] = [];
        t.dms[fan.id].push({ id: Utils.generateId(), role: 'user', content, timestamp: Date.now() });
        if (input) { input.value = ''; input.style.height = 'auto'; }
        this._renderDmMessages();

        const sendBtn = document.querySelector('.tw-dm-send-btn');
        if (sendBtn) sendBtn.disabled = true;

        try {
            const forumData = AppState.data.forumData || {};
            const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
            const identity = this._getActiveIdentity();
            const history = t.dms[fan.id].slice(-10);

            // ユーザーの身分に応じて反応を変える
            let identityContext;
            if (identity.type === 'official') {
                identityContext = `相手は「${identity.name}」（${identity.handle}）という公式スタッフアカウントです。
あなたは公式の人からDMをもらって驚いています。敬意と緊張感を持ちつつ、嬉しさを隠せない感じで対応してください。`;
            } else if (identity.type === 'npc') {
                identityContext = `相手は「${identity.name}」（${identity.handle}）という作品関係者アカウントです。
業界の人からのDMに少し緊張しつつ対応してください。`;
            } else {
                identityContext = `相手は「${identity.name}」（${identity.handle}）という一般ファンアカウントです。
同じファン仲間として気軽に、楽しく対応してください。`;
            }

            const systemPrompt = `あなたは${fan.name}（${fan.handle}）としてロールプレイしています。
タイプ: ${this._fanTypeLabel(fan.type)}
${fan.bio ? 'プロフィール: ' + fan.bio : ''}

X（Twitter）のDMで会話しています。

${identityContext}

作品設定（以下の内容を超えて捏造しないこと）:
${worldContext || '（未設定 — 具体的なキャラ名・CP・ストーリーを捏造しないこと）'}
${Utils.PROMPTS.infoAccessRule()}
ルール:
- ${fan.name}として自然な日本語で返信すること
- タイプに合った口調と話題で会話すること（同人作家なら創作の話、CP厨なら推しカプの話など）
- DM返信は簡潔に（1〜5行）
- 上記の設定にないストーリーイベントを捏造しないこと
- 温かく、リアルな対話にすること`;

            const messages = history.map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content
            }));

            const raw = await Utils.callChatAPI(messages, systemPrompt);
            t.dms[fan.id].push({ id: Utils.generateId(), role: 'npc', content: raw.trim(), timestamp: Date.now() });

            Utils.saveData();
            this._renderDmMessages();
        } catch (e) {
            Utils.showToast(I18n.t('t.tw_send_failed', '送信失敗：') + e.message);
        } finally {
            if (sendBtn) sendBtn.disabled = false;
        }
    },

    async _generateInboxDms(tweetId) {
        const t = this._ensureData();
        const tweet = (t.tweets || []).find(tw => tw.id === tweetId);
        if (!tweet) return;

        const forumData = AppState.data.forumData || {};
        const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
        const identity = this._getActiveIdentity();

        const systemPrompt = `あなたは公式アニメアカウントへの受信X（Twitter）DMをシミュレーションしています。
ファンやコラボ希望者からのリアルな受信DM1〜2件を生成してください。

アカウント: ${this._esc(identity.name)} (${this._esc(identity.handle)})
作品設定（以下の内容を超えて捏造しないこと）:
${worldContext || '（未設定 — 具体的なキャラ名・CP・ストーリーを捏造しないこと）'}
${Utils.PROMPTS.infoAccessRule()}
送信者タイプ:
- fan: 熱心なファン（カジュアルな日本語、個人的なトーン）
- collab: コラボを求める企業・クリエイター（丁寧な日本語）

出力フォーマット（厳守）:
---INBOXDM---
SENDER_NAME: [名前]
SENDER_HANDLE: [@handle]
SENDER_TYPE: [fan/collab]
CONTENT: [DMテキスト、自然な日本語で2〜4文]

1〜2件のDMを生成すること。`;

        const messages = [{ role: 'user', content: `官方ツイート：${tweet.content}\n\nこれに触発されたDMを生成してください。` }];
        const raw = await Utils.callChatAPI(messages, systemPrompt);

        const blocks = raw.split(/---\s*INBOXDM\s*---/i).map(s => s.trim()).filter(Boolean);
        const now = Date.now();
        for (const block of blocks) {
            const senderName = (block.match(/^SENDER_NAME:\s*(.+)$/m) || [])[1]?.trim() || 'ファン';
            const senderHandle = (block.match(/^SENDER_HANDLE:\s*(.+)$/m) || [])[1]?.trim() || '@user';
            const senderTypeRaw = (block.match(/^SENDER_TYPE:\s*(.+)$/m) || [])[1]?.trim() || 'fan';
            const senderType = ['fan', 'collab'].includes(senderTypeRaw) ? senderTypeRaw : 'fan';
            const contentMatch = block.match(/CONTENT:[ \t]*\n?([\s\S]*?)(?=\nSENDER_|\s*$)/);
            const content = contentMatch ? contentMatch[1].trim() : '';
            if (!content) continue;

            t.inboxDms.unshift({
                id: Utils.generateId(),
                senderName, senderHandle, senderType,
                messages: [{ id: Utils.generateId(), role: 'sender', content, timestamp: now }],
                isRead: false,
                timestamp: now
            });
        }

        // 来信最多保留 50 条
        if (t.inboxDms.length > 50) t.inboxDms = t.inboxDms.slice(0, 50);
        Utils.saveData();
        this._updateBadges();
    },

    // ===== いいね =====
    toggleLike(tweetId, isNpc, btn) {
        const t = this._ensureData();
        const idx = (t.likedTweetIds || []).findIndex(l => l.id === tweetId);
        if (idx >= 0) {
            t.likedTweetIds.splice(idx, 1);
            if (btn) {
                btn.classList.remove('tw-liked');
                btn.querySelector('svg')?.replaceWith(Object.assign(document.createElement('span'), { innerHTML: this._svg.heart }).firstChild);
            }
        } else {
            if (!t.likedTweetIds) t.likedTweetIds = [];
            t.likedTweetIds.push({ id: tweetId, isNpc, timestamp: Date.now() });
            // 上限 200
            if (t.likedTweetIds.length > 200) t.likedTweetIds = t.likedTweetIds.slice(-200);
            if (btn) {
                btn.classList.add('tw-liked');
                btn.querySelector('svg')?.replaceWith(Object.assign(document.createElement('span'), { innerHTML: this._svg.heartFilled }).firstChild);
            }
        }
        Utils.saveData();
    },

    // ===== 検索ページ =====
    renderSearch() {
        const container = document.getElementById('twitterSearchContent');
        if (!container) return;
        const qVal = this._esc(this._searchQuery);
        const searchIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
        container.innerHTML = `
<div class="tw-search-bar-wrap">
    <span class="tw-search-bar-icon">${searchIcon}</span>
    <input type="text" class="tw-search-input" id="twSearchInput" placeholder="${I18n.t('tw.search_placeholder', 'キーワードで検索')}" value="${qVal}" onkeydown="if(event.key==='Enter')Twitter._doSearch()">
    ${this._searchQuery ? `<button class="tw-search-clear" onclick="Twitter._clearSearch()" title="${I18n.t('tw.search_clear', 'クリア')}">×</button>` : ''}
</div>
<div id="twSearchBody"></div>`;
        this._renderSearchBody();

        // 从热搜/通知跳转过来时自动执行搜索
        if (this._pendingSearchTag) {
            const input = document.getElementById('twSearchInput');
            if (input) input.value = this._pendingSearchTag;
            this._pendingSearchTag = null;
            this._doSearch();
        }
    },

    _clearSearch() {
        this._searchQuery = '';
        this._searchResults = [];
        this.renderSearch();
    },

    _renderSearchBody() {
        const body = document.getElementById('twSearchBody');
        if (!body) return;
        if (this._searchQuery && this._searchResults.length > 0) {
            body.innerHTML = `<div class="tw-search-results-label">${I18n.t('tw.search_results_for', {q: this._esc(this._searchQuery)})}</div>` +
                this._searchResults.map(tw => this._renderSearchTweetCard(tw)).join('');
            return;
        }
        // Live Spaces 发现区（顶部）
        const liveSpacesHtml = this._renderLiveSpacesDiscover();
        this._renderSearchTrends(body);
        if (liveSpacesHtml) body.insertAdjacentHTML('afterbegin', liveSpacesHtml);
    },

    _renderLiveSpacesDiscover() {
        const t = this._ensureData();
        const live = (t.spaces || []).filter(s => s.status === 'live');
        if (live.length === 0) return '';
        const cards = live.slice(0, 5).map(s => {
            const npc = this._getNpc(s.hostNpcId);
            const hostName = npc ? (npc.name || npc.role) : I18n.t('tw.space_host_default', 'ホスト');
            const listenerStr = s.listenerCount ? `🎧 ${this._fmtNum(s.listenerCount)}` : '';
            return `<div class="tw-discover-space" onclick="Twitter.openSpace('${this._esc(s.id)}')">
    <div class="tw-discover-space-live"><span class="tw-space-live-dot"></span>${I18n.t('tw.space_live_now', 'ライブ中')}</div>
    <div class="tw-discover-space-title">${this._esc(s.title)}</div>
    <div class="tw-discover-space-meta">${this._esc(hostName)}${listenerStr ? ' · ' + listenerStr : ''}</div>
</div>`;
        }).join('');
        return `<div class="tw-discover-section">
    <div class="tw-discover-header">
        <span>${I18n.t('tw.space_live_section_title', '📻 ライブ中のスペース')}</span>
        <span class="tw-discover-more" onclick="Twitter.showAllSpaces()">${I18n.t('tw.space_view_all', 'すべて ›')}</span>
    </div>
    <div class="tw-discover-spaces-row">${cards}</div>
</div>`;
    },

    _renderSearchTrends(body) {
        const t = this._ensureData();
        const trends = t.trends || [];
        if (trends.length === 0) {
            body.innerHTML = `
<div class="tw-trends-empty-rich">
    <div class="tw-trends-empty-icon">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-secondary);opacity:.4">
            <line x1="12" y1="20" x2="12" y2="10"/>
            <line x1="18" y1="20" x2="18" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="16"/>
        </svg>
    </div>
    <div class="tw-trends-empty-title">${I18n.t('tw.empty_trends_title', 'トレンドはまだありません')}</div>
    <div class="tw-trends-empty-desc">${I18n.t('tw.empty_trends_desc', 'ホーム画面の 🔄 でタイムラインを更新すると、業界・ファン中で話題のトレンドが自動生成されます。')}</div>
    <button class="tw-trends-empty-btn" onclick="Navigation.goTo('twitter');setTimeout(()=>Twitter.refreshTimeline(),300)">${I18n.t('tw.empty_trends_btn', 'タイムラインへ移動')}</button>
</div>`;
            return;
        }
        body.innerHTML = `<div class="tw-search-section-title">${I18n.t('tw.search_current_trends', 'いまトレンド')}</div>` +
            trends.map((tr, i) => `<div class="tw-trend-item tw-trend-clickable" onclick="Twitter._searchFromTrend('${this._esc(tr.tag)}')">
    <div class="tw-trend-rank">${i + 1}</div>
    <div class="tw-trend-info">
        <div class="tw-trend-tag">${this._esc(tr.tag)}</div>
        <div class="tw-trend-count">${I18n.t('tw.search_trend_count', {n: this._esc(tr.count)})}</div>
    </div>
    <div style="color:var(--text-secondary);font-size:20px;padding-right:4px;">›</div>
</div>`).join('');
    },


    async _doSearch() {
        const input = document.getElementById('twSearchInput');
        const query = input?.value.trim();
        if (!query) return;
        this._searchQuery = query;
        const body = document.getElementById('twSearchBody');
        if (body) body.innerHTML = `<div style="padding:40px 16px;text-align:center;"><div class="spinner" style="margin:0 auto 12px;"></div><div style="color:var(--text-secondary);font-size:14px;">${I18n.t('tw.search_searching', {q: this._esc(query)})}</div></div>`;
        try {
            this._searchResults = await this._generateSearchTweets(query);
            this._renderSearchBody();
        } catch (e) {
            Utils.showToast(I18n.t('t.tw_search_failed', '検索失敗：') + e.message);
        }
    },

    async _generateSearchTweets(query) {
        const forumData = AppState.data.forumData || {};
        const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
        const systemPrompt = `あなたは日本語アニメX（Twitter）の検索結果ページをシミュレーションしています。
ユーザーの検索ワード: 「${query}」
この検索キーワードに関連するファン、メディアアカウント、業界関係者からのリアルなツイートを5〜7件生成してください。

作品設定（以下の事実のみ使用し、捏造しないこと）:
${worldContext || '（未設定 — 具体的なキャラ名・CP・ストーリーを捏造しないこと）'}
${Utils.PROMPTS.infoAccessRule()}
ルール:
- すべてのツイートが検索キーワードと明確に関連していること
- 混ぜること: ファン (fan) / 業界 (industry) / メディア (media)
- 自然な日本語Twitter: 絵文字、ハッシュタグ、カジュアルなトーン
- 未公開のストーリーイベントを捏造しないこと

出力フォーマット（厳守）:
---STWEET---
NAME: [アカウント名]
HANDLE: [@handle]
TYPE: [fan/industry/media]
CONTENT: [日本語のツイート本文、1-4行]
TRANSLATION: [中国語（簡体字）翻訳、1行]

5〜7件の結果を生成すること。`;

        const messages = [{ role: 'user', content: `「${query}」で検索してください。` }];
        const raw = await Utils.callChatAPI(messages, systemPrompt);
        return this._parseSearchTweets(raw);
    },

    _parseSearchTweets(text) {
        const blocks = text.split(/---\s*STWEET\s*---/i).map(s => s.trim()).filter(Boolean);
        const now = Date.now();
        return blocks.map((block, i) => {
            const name = (block.match(/^NAME:\s*(.+)$/m) || [])[1]?.trim() || 'ファン';
            const handle = (block.match(/^HANDLE:\s*(.+)$/m) || [])[1]?.trim() || '@user';
            const rawType = (block.match(/^TYPE:\s*(.+)$/m) || [])[1]?.trim() || 'fan';
            const type = ['fan', 'industry', 'media'].includes(rawType) ? rawType : 'fan';
            const contentMatch = block.match(/CONTENT:[ \t]*\n?([\s\S]*?)(?=\nTRANSLATION:|\s*$)/);
            const content = contentMatch ? contentMatch[1].trim() : '';
            const tlMatch = block.match(/^TRANSLATION:[ \t]*(.+)$/m);
            const translation = tlMatch ? tlMatch[1].trim() : null;
            if (!content) return null;
            const eng = this._genEngagement('fan', type);
            return {
                id: Utils.generateId(),
                source: 'search',
                authorName: name,
                authorHandle: handle,
                authorType: type,
                content,
                translation,
                timestamp: now - i * 3600000,
                replies: [],
                likes: eng.likes,
                retweets: eng.retweets,
                savedToForumId: null
            };
        }).filter(Boolean);
    },

    _searchFromTrend(tag) {
        this._searchQuery = tag;
        this._pendingSearchTag = tag;
        Navigation.goTo('twitter-search');
    },

    _renderSearchTweetCard(tw) {
        const t = this._ensureData();
        const name = tw.authorName || 'ファン';
        const handle = tw.authorHandle || '@user';
        const avatarLetter = name.charAt(0).toUpperCase();
        const avatarColor = this._fanTypeColor(tw.authorType);
        const likesStr = this._fmtNum(tw.likes || 0);
        const rtStr = this._fmtNum(tw.retweets || 0);
        const tweetIdEsc = this._esc(tw.id);
        const isLiked = (t.likedTweetIds || []).some(l => l.id === tw.id);
        const tlBlock = tw.translation ? `<details class="tw-tl-block" onclick="event.stopPropagation()">
    <summary class="tw-tl-btn">${I18n.t('tw.action_translate', '訳')}</summary>
    <div class="tw-tl-content">${this._esc(tw.translation)}</div>
</details>` : '';
        return `<div class="tw-card" onclick="Twitter._openSearchTweet('${tweetIdEsc}')">
    <div class="tw-card-avatar tw-avatar-link" style="background:${avatarColor};" onclick="event.stopPropagation();Twitter._openSearchProfile('${tweetIdEsc}')">${this._esc(avatarLetter)}</div>
    <div class="tw-card-body">
        <div class="tw-card-header">
            <span class="tw-name tw-name-link" onclick="event.stopPropagation();Twitter._openSearchProfile('${tweetIdEsc}')">${this._esc(name)}</span>
            <span class="tw-handle">${this._esc(handle)}</span>
            <span class="tw-time">${this._timeAgo(tw.timestamp)}</span>
        </div>
        <div class="tw-content">${this._linkifyContent(tw.content)}</div>
        ${tlBlock}
        <div class="tw-card-footer">
            <span class="tw-engage-count">${this._svg.retweet} ${rtStr}</span>
            <button class="tw-engage-count tw-search-like${isLiked ? ' tw-liked' : ''}" onclick="event.stopPropagation();Twitter._toggleSearchLike('${tweetIdEsc}', this)" title="${I18n.t('tw.action_like', 'いいね')}">${isLiked ? this._svg.heartFilled : this._svg.heart}<span>${likesStr}</span></button>
        </div>
    </div>
</div>`;
    },

    // ===== 检索ツイート → npcTweets 注入（懒持久化）=====
    _injectSearchTweet(id) {
        const t = this._ensureData();
        const stw = (this._searchResults || []).find(tw => tw.id === id);
        if (!stw) return null;
        t.npcTweets = t.npcTweets || [];
        let existing = t.npcTweets.find(tw => tw.id === id);
        if (!existing) {
            existing = {
                id: stw.id,
                source: 'fan',
                fromSearch: true,
                authorName: stw.authorName,
                authorHandle: stw.authorHandle,
                authorType: stw.authorType,
                content: stw.content,
                translation: stw.translation,
                timestamp: stw.timestamp,
                replies: stw.replies || [],
                likes: stw.likes || 0,
                retweets: stw.retweets || 0
            };
            t.npcTweets.push(existing);
            // 検索注入の上限 30 件
            const fromSearchTweets = t.npcTweets.filter(tw => tw.fromSearch);
            if (fromSearchTweets.length > 30) {
                const keepIds = new Set(fromSearchTweets.slice(-30).map(tw => tw.id));
                t.npcTweets = t.npcTweets.filter(tw => !tw.fromSearch || keepIds.has(tw.id));
            }
            Utils.saveData();
        }
        return existing;
    },

    _openSearchTweet(id) {
        if (!this._injectSearchTweet(id)) return;
        this.currentTweetId = id;
        this.currentTweetIsNpc = true;
        Navigation.goTo('twitter-thread');
    },

    _openSearchProfile(id) {
        if (!this._injectSearchTweet(id)) return;
        this.openFanPreview(id);
    },

    _toggleSearchLike(id, btn) {
        if (!this._injectSearchTweet(id)) return;
        this.toggleLike(id, true, btn);
    },

    // ===== 互動数字（程序生成，不耗 API）=====
    _genEngagement(source, authorType) {
        const r = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
        if (source === 'staff') return { likes: r(800, 28000), retweets: r(150, 7000) };
        if (source === 'fan') {
            if (authorType === 'media') return { likes: r(200, 6000), retweets: r(50, 1800) };
            if (authorType === 'industry') return { likes: r(40, 2500), retweets: r(8, 600) };
            if (authorType === 'doujin_writer' || authorType === 'doujin_artist') return { likes: r(50, 3000), retweets: r(10, 800) };
            if (authorType === 'cp_fan') return { likes: r(20, 1500), retweets: r(5, 400) };
            if (authorType === 'organizer') return { likes: r(100, 4000), retweets: r(80, 2000) };
            return { likes: r(3, 480), retweets: r(0, 90) };
        }
        // user tweets
        return { likes: r(20, 600), retweets: r(3, 150) };
    },

    // 投票レンダリング
    _renderPoll(tweet) {
        const p = tweet.poll;
        if (!p || !p.options) return '';
        const voted = p.userVoteIndex != null;
        const total = p.totalVotes || p.options.reduce((s, o) => s + (o.votes || 0), 0);
        return `<div class="tw-poll" onclick="event.stopPropagation();">
            ${p.options.map((opt, i) => {
                const pct = total > 0 ? Math.round((opt.votes || 0) / total * 100) : 0;
                const isWinner = voted && pct === Math.max(...p.options.map(o => total > 0 ? Math.round((o.votes||0)/total*100) : 0));
                const isMyVote = p.userVoteIndex === i;
                if (voted) {
                    return `<div class="tw-poll-option tw-poll-voted ${isWinner ? 'tw-poll-winner' : ''}">
                        <div class="tw-poll-bar" style="width:${pct}%;"></div>
                        <span class="tw-poll-text">${isMyVote ? '✓ ' : ''}${this._esc(opt.text)}</span>
                        <span class="tw-poll-pct">${pct}%</span>
                    </div>`;
                }
                return `<div class="tw-poll-option tw-poll-clickable" onclick="Twitter.votePoll('${this._esc(tweet.id)}',${i})">
                    <span class="tw-poll-text">${this._esc(opt.text)}</span>
                </div>`;
            }).join('')}
            <div class="tw-poll-total">${total.toLocaleString()}票</div>
        </div>`;
    },

    votePoll(tweetId, optIdx) {
        const t = this._ensureData();
        const tweet = [...(t.npcTweets || []), ...(t.tweets || [])].find(tw => tw.id === tweetId);
        if (!tweet || !tweet.poll || tweet.poll.userVoteIndex != null) return;
        tweet.poll.userVoteIndex = optIdx;
        tweet.poll.options[optIdx].votes = (tweet.poll.options[optIdx].votes || 0) + 1;
        tweet.poll.totalVotes = tweet.poll.options.reduce((s, o) => s + (o.votes || 0), 0);
        Utils.saveData();
        this.renderTimeline();
    },

    // スレッドグルーピング（タイムライン表示用）
    _groupTweetsForTimeline(tweets) {
        const result = [];
        const threadMap = new Map(); // threadId → index in result
        for (const item of tweets) {
            const tid = item.tweet.threadId;
            if (tid) {
                if (threadMap.has(tid)) {
                    result[threadMap.get(tid)].tweets.push(item);
                } else {
                    threadMap.set(tid, result.length);
                    result.push({ type: 'thread', tweets: [item] });
                }
            } else {
                result.push({ type: 'single', tweet: item.tweet, isNpc: item.isNpc });
            }
        }
        // スレッド内をthreadIndexでソート
        for (const item of result) {
            if (item.type === 'thread') {
                item.tweets.sort((a, b) => (a.tweet.threadIndex || 0) - (b.tweet.threadIndex || 0));
            }
        }
        return result;
    },

    // 画像グラデーション生成
    _imageGradient(type) {
        const pool = {
            photo: ['linear-gradient(135deg,#f5af19,#f12711)', 'linear-gradient(135deg,#fda085,#f6d365)', 'linear-gradient(135deg,#a8edea,#fed6e3)'],
            art: ['linear-gradient(135deg,#667eea,#764ba2)', 'linear-gradient(135deg,#a18cd1,#fbc2eb)', 'linear-gradient(135deg,#f093fb,#f5576c)'],
            screenshot: ['linear-gradient(135deg,#4facfe,#00f2fe)', 'linear-gradient(135deg,#43e97b,#38f9d7)', 'linear-gradient(135deg,#0ba360,#3cba92)'],
            behind_the_scenes: ['linear-gradient(135deg,#c2e59c,#64b3f4)', 'linear-gradient(135deg,#d4fc79,#96e6a1)', 'linear-gradient(135deg,#cfd9df,#e2ebf0)'],
        };
        const list = pool[type] || [...pool.photo, ...pool.art, ...pool.screenshot];
        return list[Math.floor(Math.random() * list.length)];
    },

    // ===== 画像生成API連携 =====

    _hasImageApi() {
        const config = AppState.data.imageApiConfig;
        const modules = AppState.data.imageGenModules || {};
        return !!(config && config.key && config.provider && modules.twitter !== false);
    },

    // 世界書からキャラクター外見情報を抽出（推文全文 + IMAGE_DESC で照合）
    _extractCharacterAppearance(tweetContent, imageDesc) {
        const wbIds = Utils.getActiveWorldBookIds();
        if (wbIds.length === 0) return '';

        const allEntries = [];
        wbIds.forEach(wbId => {
            const book = (AppState.data.worldBooks || []).find(b => b.id === wbId);
            if (book && book.entries) {
                book.entries.filter(e => e.enabled !== false).forEach(e => {
                    allEntries.push({ title: e.title, keys: e.keys || [], content: e.content });
                });
            }
        });

        // 推文全文 + IMAGE_DESC 両方でエントリタイトル＋キーワードをマッチング
        const searchText = (tweetContent || '') + ' ' + (imageDesc || '');
        const matched = [];
        for (const entry of allEntries) {
            const titleMatch = entry.title && searchText.includes(entry.title);
            const keyMatch = entry.keys.some(k => k && searchText.includes(k));
            if (titleMatch || keyMatch) {
                matched.push(`【${entry.title}】${entry.content}`);
            }
        }
        return matched.join('\n').substring(0, 1200);
    },

    // 推文内容 + IMAGE_DESC + キャラ外見 → 英語プロンプト生成
    async _buildImagePrompt(tweetContent, imageDesc) {
        const charAppearance = this._extractCharacterAppearance(tweetContent, imageDesc);

        const systemPrompt = `You are a prompt engineer for anime image generation (NovelAI V4.5).
Convert the given tweet content and image description into English Danbooru-style tags.

CRITICAL — Character Separation Format:
When the image has MULTIPLE characters, you MUST output in this structured format:

[SCENE] scene tags, composition, quality tags
[CHAR1] first character's appearance tags (hair, eyes, clothing, gender tag)
[CHAR2] second character's appearance tags

When the image has only ONE character, output flat tags (no [SCENE]/[CHAR] markers).

Rules:
- Determine the number and gender of characters from the tweet
- Each [CHAR] section MUST include the character's gender tag (1girl or 1boy) as the FIRST tag
- Extract character appearance (hair color, eye color, clothing) from the provided character info
- IMPORTANT: Each character's appearance must be STRICTLY separated — never mix character A's hair color into character B's section
- If the tweet describes specific clothing/outfit that differs from the character info, use the tweet's description
- [SCENE] should include: quality tags (masterpiece, best quality, amazing quality), composition, background, action, mood
- For well-known anime/manga/game characters, include their name tag: character_name (series_name)
- For original characters, use only visual descriptors
- IMPORTANT: If characters are mentioned in the tweet or character database, they MUST appear prominently in the illustration — never generate background-only/scenery-only images when characters are referenced
- Do NOT include negative prompt tags
- Keep each section under 40 words`;

        const userMsg = `Tweet content (for context): ${tweetContent || imageDesc}
Image description: ${imageDesc}
${charAppearance ? `\nCharacter appearance database:\n${charAppearance}` : ''}

Generate image tags (use [SCENE]/[CHAR1]/[CHAR2] format if multiple characters):`;

        try {
            const raw = await Utils.callChatAPI([{ role: 'user', content: userMsg }], systemPrompt);
            const result = raw.trim();

            // [SCENE]/[CHAR] 構造化フォーマットを解析
            const sceneMatch = result.match(/\[SCENE\]\s*(.+?)(?=\[CHAR|\n*$)/s);
            const charMatches = [...result.matchAll(/\[CHAR\d*\]\s*(.+?)(?=\[CHAR|\n*$)/gs)];

            if (sceneMatch && charMatches.length > 0) {
                // 複数キャラ：char_captions を使用
                const scene = sceneMatch[1].trim().replace(/\n/g, ', ');
                const chars = charMatches.map(m => m[1].trim().replace(/\n/g, ', '));
                console.log(`[Twitter ImageGen] Multi-char prompt: scene="${scene.substring(0,50)}..." chars=${chars.length}`);
                return { positive: scene, negative: '', charCaptions: chars };
            }

            // 単一キャラ：フラットタグ
            return { positive: result, negative: '', charCaptions: [] };
        } catch (e) {
            console.error('[Twitter ImageGen] Prompt build failed:', e);
            return null;
        }
    },

    // 非同期でツイート画像を生成（fire-and-forget）
    async _generateTweetImages(tweets, isNpc) {
        if (!this._hasImageApi()) {
            console.log('[Twitter ImageGen] No image API configured, skipping');
            return;
        }

        const config = AppState.data.imageApiConfig;
        const naiSettings = AppState.data.novelaiSettings || {};
        const artTweets = tweets.filter(tw => tw.image && tw.image.type === 'art' && !tw.image.generatedImageId);
        console.log(`[Twitter ImageGen] Found ${artTweets.length} art tweets out of ${tweets.length} total (types: ${tweets.map(tw => tw.image?.type || 'none').join(', ')})`);
        if (artTweets.length === 0) return;

        // 画像サイズ（横長、ツイートカード向け）
        const imgSize = config.provider === 'novelai'
            ? (naiSettings.resolution || '1024x1024')
            : '1024x768';

        for (const tweet of artTweets) {
            try {
                const prompt = await this._buildImagePrompt(tweet.content, tweet.image.description);
                if (!prompt) continue;

                let blobs = [];
                switch (config.provider) {
                    case 'openai':
                        blobs = await PixivIllust.generateWithOpenAI(prompt.positive, prompt.negative, imgSize, 1, config);
                        break;
                    case 'stabilityai':
                        blobs = await PixivIllust.generateWithStabilityAI(prompt.positive, prompt.negative, imgSize, 1, config);
                        break;
                    case 'novelai':
                        blobs = await PixivIllust.generateWithNovelAI(prompt.positive, prompt.negative, imgSize, 1, config, prompt.charCaptions);
                        break;
                    case 'midjourney':
                    case 'custom':
                        blobs = await PixivIllust.generateWithCustomAPI(prompt.positive, prompt.negative, imgSize, 1, config);
                        break;
                }

                if (blobs && blobs.length > 0) {
                    const id = 'tw_illust_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    await IllustGallery.save(id, blobs[0]);
                    tweet.image.generatedImageId = id;
                    Utils.saveData();

                    // DOM 上の対応するカードを差し替え
                    const card = document.querySelector(`.tw-image-card[data-tweet-id="${tweet.id}"]`);
                    if (card) {
                        const url = await IllustGallery.getUrl(id);
                        if (url) {
                            card.className = 'tw-image-card tw-image-generated';
                            card.style.background = '';
                            card.innerHTML = `<img src="${url}" class="tw-generated-img" alt="${this._esc(tweet.image.description || '')}">`;
                        }
                    }
                }
            } catch (e) {
                console.error('[Twitter ImageGen] Failed for tweet:', tweet.id, e);
            }
        }
    },

    // レンダリング後に生成済み画像をロード（IDB 並列読み込み）
    async _loadGeneratedImages(container) {
        if (!container) return;
        const imgs = [...container.querySelectorAll('img[data-illust-id]')]
            .filter(img => img.dataset.illustId && !img.getAttribute('src'));
        await Promise.all(imgs.map(async img => {
            const id = img.dataset.illustId;
            try {
                const url = await IllustGallery.getUrl(id);
                if (url) {
                    img.src = url;
                } else {
                    const card = img.closest('.tw-image-card');
                    if (card) {
                        card.className = 'tw-image-card';
                        card.style.background = this._imageGradient('art');
                        card.innerHTML = '<span class="tw-image-emoji">🎨</span>';
                    }
                }
            } catch (e) {
                console.error('[Twitter] Failed to load generated image:', id, e);
            }
        }));
    },

    // 生成画像のフルスクリーン表示
    async _viewFullImage(illustId) {
        const url = await IllustGallery.getUrl(illustId);
        if (!url) return;

        const overlay = document.createElement('div');
        overlay.className = 'tw-fullimg-overlay';
        overlay.innerHTML = `<img src="${url}" class="tw-fullimg">`;
        overlay.onclick = () => overlay.remove();
        document.body.appendChild(overlay);
    },

    // 数字格式化（1.2万 / 3.4k / 89）
    _fmtNum(n) {
        if (!n) return '0';
        if (n >= 10000) return (n / 10000).toFixed(n >= 100000 ? 0 : 1) + '万';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
        return String(n);
    },

    // 完整逗号分隔（用于主页 follower/following 显示，更真实）
    _fmtNumComma(n) {
        return Number(n || 0).toLocaleString('en-US');
    },

    // 随机粉丝名（用于"○○など N 名にフォローされました"通知）
    _FAN_NAME_POOL: [
        '田中', '佐藤', '鈴木', '高橋', '渡辺', '伊藤', '中村', '小林', '加藤', '吉田',
        '山田', '佐々木', '山本', '松本', '井上', '木村', '林', '清水', '山崎', '森',
        'みお', 'ゆい', 'あおい', 'ひかり', 'なつき', 'さくら', 'ことり', 'みなみ', 'ゆめ', 'りん',
        'ふぁんあかうんと', 'アニメ垢', '雑多垢', '推し活'
    ],
    _genFanName() {
        const pool = this._FAN_NAME_POOL;
        return pool[Math.floor(Math.random() * pool.length)];
    },

    // ===== トレンド生成 =====
    async _generateTrends() {
        const forumData = AppState.data.forumData || {};
        const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');

        const systemPrompt = `あなたはアニメ作品ファンダムの日本語X（Twitter）トレンドトピックリストをシミュレーションしています。
以下の作品・ストーリー設定に基づき、ファンが今まさに話題にしているリアルなトレンドハッシュタグを正確に5つ生成してください。
盛り上がり度順に並べること（最も高いものが最初）。

作品設定（以下の事実のみ使用すること）:
${worldContext || '（未設定 — 具体的なキャラ名・CP・ストーリーを捏造しないこと）'}
${Utils.PROMPTS.infoAccessRule()}
出力フォーマット（厳守、5ブロック）:
---TREND---
TAG: #ハッシュタグ
COUNT: [例: 15.2万件 / 8,341件 / 2.1万件]
CATEGORY: [episode/character/goods/event/fandom]

正確に5つのトレンドを生成すること。`;

        const messages = [{ role: 'user', content: 'トレンドを生成してください。' }];
        const raw = await Utils.callChatAPI(messages, systemPrompt);

        const t = this._ensureData();
        const blocks = raw.split(/---\s*TREND\s*---/i).map(s => s.trim()).filter(Boolean);
        t.trends = blocks.slice(0, 5).map(block => {
            const tag = (block.match(/^TAG:\s*(.+)$/m) || [])[1]?.trim() || '#アニメ';
            const count = (block.match(/^COUNT:\s*(.+)$/m) || [])[1]?.trim() || '1万件';
            const cat = (block.match(/^CATEGORY:\s*(.+)$/m) || [])[1]?.trim() || 'fandom';
            return { tag, count, category: cat, timestamp: Date.now() };
        }).filter(tr => tr.tag);
        Utils.saveData();
    },

    // ===== トレンドカード描画（時間線の先頭に挿入）=====
    _renderTrendsCard() {
        const t = this._ensureData();
        const trends = t.trends || [];
        const refreshBtn = `<button class="tw-trends-refresh" onclick="event.preventDefault();event.stopPropagation();Twitter._refreshTrends(this)">更新</button>`;

        if (trends.length === 0) {
            return `<details class="tw-trends-block">
<summary class="tw-trends-header"><span>いまトレンド</span>${refreshBtn}</summary>
<div class="tw-trends-empty">「更新」ボタンでトレンドを生成します</div>
</details>`;
        }

        const catIcon = { episode: '📺', character: '✨', goods: '🛍️', event: '🎪', fandom: '💬' };
        const items = trends.map((tr, i) => `<div class="tw-trend-item tw-trend-clickable" onclick="Twitter._searchFromTrend('${this._esc(tr.tag)}')">
    <div class="tw-trend-rank">${i + 1}</div>
    <div class="tw-trend-info">
        <div class="tw-trend-tag">${this._esc(tr.tag)}</div>
        <div class="tw-trend-count">${catIcon[tr.category] || '💬'} ${this._esc(tr.count)}</div>
    </div>
    <div style="color:var(--text-secondary);font-size:20px;padding-right:4px;">›</div>
</div>`).join('');

        return `<details class="tw-trends-block" open>
<summary class="tw-trends-header"><span>${I18n.t('tw.search_current_trends', 'いまトレンド')}</span>${refreshBtn}</summary>
${items}
</details>`;
    },

    async _refreshTrends(btn) {
        if (btn) { btn.textContent = '…'; btn.disabled = true; }
        try {
            await this._generateTrends();
            this.renderTimeline();
            Utils.showToast(I18n.t('t.tw_trends_updated', '✓ トレンドを更新しました'));
        } catch (e) {
            Utils.showToast(I18n.t('t.tw_refresh_failed', '更新失敗：') + e.message);
        } finally {
            if (btn) { btn.textContent = I18n.t('tw.search_trend_refresh', '更新'); btn.disabled = false; }
        }
    },

    // ===== スペース（Twitter Spaces）=====

    _renderSpacesSection() {
        const t = this._ensureData();
        const allSpaces = (t.spaces || []).slice().sort((a, b) => {
            if (a.status === 'live' && b.status !== 'live') return -1;
            if (b.status === 'live' && a.status !== 'live') return 1;
            return (b.startTime || 0) - (a.startTime || 0);
        });
        // 横向显示：全部LIVE + 最新2个 archived
        const liveSpaces = allSpaces.filter(s => s.status === 'live');
        const archivedSpaces = allSpaces.filter(s => s.status !== 'live');
        const shownSpaces = [...liveSpaces, ...archivedSpaces.slice(0, 2)];
        const hiddenCount = archivedSpaces.length - 2;
        const pills = shownSpaces.map(s => this._renderSpacePill(s)).join('');
        const morePill = hiddenCount > 0
            ? `<div class="tw-space-more-pill" onclick="Twitter.showAllSpaces()">${I18n.t('tw.space_more_count', {n: hiddenCount})}</div>`
            : '';
        const createBtn = `<div class="tw-space-create-pill" onclick="Twitter.showCreateSpaceModal()">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    <span>${I18n.t('tw.space_section_name', 'スペース')}</span>
</div>`;
        return `<div class="tw-spaces-section">
    <div class="tw-spaces-header"><span>${I18n.t('tw.space_section_name', 'スペース')}</span>${allSpaces.length > 0 ? `<span class="tw-spaces-manage-link" onclick="Twitter.showAllSpaces()">${I18n.t('tw.space_manage_link', '管理 ›')}</span>` : ''}</div>
    <div class="tw-spaces-row">${createBtn}${pills}${morePill}</div>
</div>`;
    },

    _renderSpacePill(space) {
        const isLive = space.status === 'live';
        const pillClass = isLive ? 'tw-space-pill tw-space-pill-live' : 'tw-space-pill';
        const badge = isLive
            ? `<div class="tw-space-live-badge"><span class="tw-space-live-dot"></span>${I18n.t('tw.space_live_now', 'ライブ中')}</div>`
            : `<div class="tw-space-archived-badge">${I18n.t('tw.space_archived', '📻 アーカイブ')}</div>`;
        const npc = this._getNpc(space.hostNpcId);
        const hostName = npc ? (npc.name || npc.role) : I18n.t('tw.space_host_default', 'ホスト');
        const otherCount = (space.speakerNpcIds || []).length - 1;
        const hostsStr = otherCount > 0 ? I18n.t('tw.space_others_count', {name: this._esc(hostName), n: otherCount}) : this._esc(hostName);
        const listenerStr = isLive ? `🎧 ${this._fmtNum(space.listenerCount || 0)}人` : '';
        return `<div class="${pillClass}" onclick="Twitter.openSpace('${this._esc(space.id)}')">
    ${badge}
    <div class="tw-space-pill-title">${this._esc(space.title)}</div>
    <div class="tw-space-pill-hosts">${hostsStr}</div>
    ${listenerStr ? `<div class="tw-space-pill-stats">${listenerStr}</div>` : ''}
</div>`;
    },

    openSpace(spaceId) {
        this.currentSpaceId = spaceId;
        Navigation.goTo('twitter-space');
    },

    renderSpaceDetail() {
        const t = this._ensureData();
        const container = document.getElementById('twSpaceContent');
        if (!container) return;
        const space = (t.spaces || []).find(s => s.id === this.currentSpaceId);
        if (!space) { container.innerHTML = `<div class="empty-state" style="padding-top:60px;">${I18n.t('tw.empty_space_notfound', 'スペースが見つかりません')}</div>`; return; }

        const titleEl = document.getElementById('twSpaceTitle');
        if (titleEl) titleEl.textContent = space.title;

        const isLive = space.status === 'live';
        const statusBar = isLive
            ? `<div class="tw-space-status-bar"><div class="tw-space-status-live"><span class="tw-space-live-dot"></span>${I18n.t('tw.space_live_now', 'ライブ中')}</div><div class="tw-space-listeners">${I18n.t('tw.space_listeners', {n: this._fmtNum(space.listenerCount || 0)})}</div></div>`
            : `<div class="tw-space-status-bar"><div class="tw-space-status-archived">${I18n.t('tw.space_archived', '📻 アーカイブ')}</div><div class="tw-space-listeners">${this._formatDate(space.endTime || space.startTime)}</div></div>`;

        const npcs = AppState.data.broadcast.officialNpcs || [];
        const speakerChips = (space.speakerNpcIds || []).map(npcId => {
            const npc = this._getNpc(npcId);
            const name = npc ? (npc.name || npc.role) : npcId;
            const isHost = npcId === space.hostNpcId;
            const color = this._npcColor(npcId);
            return `<div class="tw-space-speaker-chip">
    <div class="tw-card-avatar" style="background:${color};width:28px;height:28px;font-size:12px;flex-shrink:0;">${this._esc(name.charAt(0).toUpperCase())}</div>
    <div><div style="font-size:12px;font-weight:600;">${this._esc(name)}</div>${isHost ? `<div class="tw-space-speaker-host">${I18n.t('tw.space_label_host', 'ホスト')}</div>` : ''}</div>
</div>`;
        }).join('');

        const messages = (space.messages || []).map(msg => this._renderSpaceMsg(msg)).join('');

        // 用户身份感知：是不是这个 space 的 speaker？
        const userIdent = this._getActiveIdentity();
        const isUserSpeaker = userIdent.type === 'npc' && (space.speakerNpcIds || []).includes(userIdent.npcId);

        const micBtnHtml = (isLive && isUserSpeaker)
            ? `<button class="tw-space-mic-btn" id="twSpaceMicBtn"
                onmousedown="Twitter._startRecording(event)" onmouseup="Twitter._stopRecording()" onmouseleave="Twitter._cancelRecording()"
                ontouchstart="Twitter._startRecording(event)" ontouchend="Twitter._stopRecording()" ontouchcancel="Twitter._cancelRecording()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                <span class="tw-space-mic-label">${I18n.t('tw.space_record_hint', '長押しで話す')}</span>
            </button>`
            : '';

        const actionsHtml = `<div class="tw-space-actions">
    ${micBtnHtml}
    <button class="glass-btn" style="flex:1;" id="twSpaceLoadMoreBtn" onclick="Twitter._loadMoreSpaceMessages('${this._esc(space.id)}')">${I18n.t('tw.space_more_listen', 'もっと聴く')}</button>
    ${isLive ? `<button class="glass-btn danger-text" onclick="Twitter.endSpace('${this._esc(space.id)}')">${I18n.t('tw.space_end', '終了')}</button>` : ''}
    <button class="glass-btn" onclick="Twitter.deleteSpace('${this._esc(space.id)}')">${I18n.t('tw.space_delete', '削除')}</button>
</div>`;

        container.innerHTML = statusBar +
            `<div class="tw-space-speakers-bar"><div class="tw-space-speakers-label">${I18n.t('tw.space_speakers', 'スピーカー')}</div><div class="tw-space-speakers-row">${speakerChips}</div></div>` +
            `<div class="tw-space-messages" id="twSpaceMessages">${messages || `<div style="padding:20px 16px;color:var(--text-secondary);">${I18n.t('tw.empty_msg_loading', '発言を読み込み中…')}</div>`}</div>` +
            actionsHtml;
    },

    // 12 段波形 HTML — 渲染时不变，提到模块顶上避免每条消息重新拼接
    _SPACE_VOICE_WAVE_HTML: Array.from({length: 12}).map((_, i) => `<span style="animation-delay:${i*0.08}s"></span>`).join(''),

    // 单条 space 消息渲染（区分 text / voice / TTS）
    _renderSpaceMsg(msg) {
        const color = msg.speakerId ? this._npcColor(msg.speakerId) : '#888';
        const avatar = `<div class="tw-space-msg-avatar" style="background:${color};">${this._esc((msg.speakerName || '？').charAt(0).toUpperCase())}</div>`;
        const header = `<div class="tw-space-msg-header">
            <span class="tw-space-msg-name">${this._esc(msg.speakerName || '？')}</span>
            <span class="tw-space-msg-elapsed">${this._esc(msg.elapsed || '')}</span>
        </div>`;
        const dataId = this._esc(msg.id || ('ts_' + (msg.timestamp || 0)));

        // 用户语音消息：保留原始录音播放
        if (msg.kind === 'voice' && msg.userAudioId) {
            const dur = msg.duration ? `${Math.ceil(msg.duration)}″` : '';
            const voiceMsgText = I18n.t('tw.space_voice_message', '（音声メッセージ）');
            return `<div class="tw-space-msg" data-msg-id="${dataId}">
    ${avatar}
    <div class="tw-space-msg-body">
        ${header}
        <div class="tw-space-voice-bubble" onclick="Twitter._playSpaceVoice('${this._esc(msg.userAudioId)}', this)">
            <div class="tw-space-voice-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M8 5v14l11-7z"/></svg>
            </div>
            <div class="tw-space-voice-wave">${this._SPACE_VOICE_WAVE_HTML}</div>
            <div class="tw-space-voice-dur">${dur}</div>
        </div>
        ${msg.content && msg.content !== voiceMsgText && msg.content !== '（音声メッセージ）' ? `<div class="tw-space-voice-text">${this._esc(msg.content).replace(/\n/g, '<br>')}</div>` : ''}
    </div>
</div>`;
        }

        // NPC 文字 + TTS 合成中 / 已合成
        let ttsBubble = '';
        if (msg.ttsAudioId) {
            ttsBubble = `<div class="tw-space-voice-bubble tw-space-tts-bubble" onclick="Twitter._playSpaceVoice('${this._esc(msg.ttsAudioId)}', this)">
        <div class="tw-space-voice-icon">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M8 5v14l11-7z"/></svg>
        </div>
        <div class="tw-space-voice-wave">${this._SPACE_VOICE_WAVE_HTML}</div>
        <span class="tw-space-voice-dur">${I18n.t('tw.space_listen', '聞く')}</span>
    </div>`;
        } else if (msg.ttsPending) {
            ttsBubble = `<div class="tw-space-voice-bubble tw-space-tts-pending">
        <div class="tw-space-voice-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><circle cx="12" cy="12" r="10" stroke-dasharray="50" stroke-dashoffset="20"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></circle></svg></div>
        <span class="tw-space-voice-dur" style="opacity:.7;">${I18n.t('tw.space_synthesizing', '音声合成中…')}</span>
    </div>`;
        }

        return `<div class="tw-space-msg" data-msg-id="${dataId}">
    ${avatar}
    <div class="tw-space-msg-body">
        ${header}
        <div class="tw-space-msg-content">${this._esc(msg.content).replace(/\n/g, '<br>')}</div>
        ${ttsBubble}
    </div>
</div>`;
    },

    // 局部更新某条消息（TTS 完成后用，避免整页 re-render 打断用户）
    _refreshSpaceMsgUi(msg) {
        const wrap = document.getElementById('twSpaceMessages');
        if (!wrap) return;
        const dataId = msg.id || ('ts_' + (msg.timestamp || 0));
        const el = wrap.querySelector(`[data-msg-id="${dataId}"]`);
        if (!el) return;
        const tmp = document.createElement('div');
        tmp.innerHTML = this._renderSpaceMsg(msg);
        if (tmp.firstElementChild) el.replaceWith(tmp.firstElementChild);
    },

    // ===== Space TTS：异步合成 NPC 文字 =====
    // 静默跳过：TTS 没配置 / NPC 没绑 voiceId / 单条失败
    async _synthesizeSpaceMessagesAsync(spaceId, msgs) {
        if (typeof TTSEngine === 'undefined') return;
        const tts = AppState.data.ttsConfig || {};
        if (tts.provider !== 'minimax' || !tts.apiKey || !tts.groupId) return;

        const npcs = AppState.data.broadcast.officialNpcs || [];

        // 先把所有要合成的标记 ttsPending 然后局部刷新（用户能看到"音声合成中"）
        const t = this._ensureData();
        const space = (t.spaces || []).find(s => s.id === spaceId);
        if (!space) return;
        msgs.forEach(m => {
            const npc = npcs.find(n => n.id === m.speakerId);
            if (!npc || !npc.voiceId) return;
            const target = (space.messages || []).find(x => x.id === m.id);
            if (target) {
                target.ttsPending = true;
                if (this.currentSpaceId === spaceId) this._refreshSpaceMsgUi(target);
            }
        });

        // 串行合成（避免 burst 撞 rate limit）；批量持久化（每条单独 saveData 太重）
        let dirty = false;
        for (const m of msgs) {
            const npc = npcs.find(n => n.id === m.speakerId);
            if (!npc || !npc.voiceId) continue;
            try {
                const blob = await TTSEngine.synthesize(m.content, npc.voiceId);
                const audioId = 'space_tts_' + Utils.generateId();
                await TTSEngine.storeAudio(audioId, blob);

                const sp = (this._ensureData().spaces || []).find(s => s.id === spaceId);
                if (!sp) {
                    // Space 已被删除：刚 store 的 blob 是孤儿，直接清掉
                    TTSEngine.removeAudio?.(audioId).catch(() => {});
                    if (dirty) Utils.saveData();
                    return;
                }
                const target = (sp.messages || []).find(x => x.id === m.id);
                if (target) {
                    target.ttsAudioId = audioId;
                    target.ttsVoiceId = npc.voiceId;
                    delete target.ttsPending;
                    dirty = true;
                    if (this.currentSpaceId === spaceId) this._refreshSpaceMsgUi(target);
                } else {
                    // 消息已被删除（罕见）：清孤儿
                    TTSEngine.removeAudio?.(audioId).catch(() => {});
                }
            } catch (e) {
                console.warn('[Space TTS]', npc.name, e);
                const sp = (this._ensureData().spaces || []).find(s => s.id === spaceId);
                if (sp) {
                    const target = (sp.messages || []).find(x => x.id === m.id);
                    if (target) {
                        delete target.ttsPending;
                        target.ttsError = e.message;
                        dirty = true;
                        if (this.currentSpaceId === spaceId) this._refreshSpaceMsgUi(target);
                    }
                }
            }
        }
        if (dirty) Utils.saveData();
    },

    // ===== Space 录音 + 多模态 LLM =====
    _recState: { recorder: null, chunks: [], stream: null, started: 0, mimeType: '' },

    async _startRecording(event) {
        if (event && event.preventDefault) event.preventDefault();
        if (this._recState.recorder) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            Utils.showToast(I18n.t('t.tw_no_recording_support', 'このブラウザは録音をサポートしていません'), 4000);
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
            const mimeType = candidates.find(m => MediaRecorder.isTypeSupported(m)) || '';
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
            const chunks = [];
            recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
            recorder.start();
            this._recState = { recorder, chunks, stream, started: Date.now(), mimeType: recorder.mimeType || mimeType || 'audio/webm', cancelled: false };
            const btn = document.getElementById('twSpaceMicBtn');
            if (btn) {
                btn.classList.add('tw-recording');
                const lbl = btn.querySelector('.tw-space-mic-label');
                if (lbl) lbl.textContent = I18n.t('tw.space_recording', '録音中… 離して送信');
            }
        } catch (e) {
            Utils.showToast(I18n.t('t.tw_mic_denied', 'マイクへのアクセスが拒否されました'), 4000);
            console.warn('[Space Rec]', e);
        }
    },

    _cancelRecording() {
        const s = this._recState;
        if (!s.recorder) return;
        s.cancelled = true;
        try { s.recorder.stop(); } catch {}
        try { s.stream?.getTracks().forEach(t => t.stop()); } catch {}
        this._recState = { recorder: null, chunks: [], stream: null, started: 0, mimeType: '', cancelled: false };
        const btn = document.getElementById('twSpaceMicBtn');
        if (btn) {
            btn.classList.remove('tw-recording');
            const lbl = btn.querySelector('.tw-space-mic-label');
            if (lbl) lbl.textContent = I18n.t('tw.space_record_hint', '長押しで話す');
        }
    },

    async _stopRecording() {
        const s = this._recState;
        if (!s.recorder) return;
        const recorder = s.recorder;
        const chunks = s.chunks;
        const stream = s.stream;
        const mimeType = s.mimeType || 'audio/webm';
        const duration = (Date.now() - s.started) / 1000;
        const cancelled = !!s.cancelled;
        this._recState = { recorder: null, chunks: [], stream: null, started: 0, mimeType: '' };

        const btn = document.getElementById('twSpaceMicBtn');
        if (btn) {
            btn.classList.remove('tw-recording');
            const lbl = btn.querySelector('.tw-space-mic-label');
            if (lbl) lbl.textContent = I18n.t('tw.space_record_hint', '長押しで話す');
        }

        await new Promise(resolve => {
            recorder.onstop = () => resolve();
            try { recorder.stop(); } catch { resolve(); }
        });
        try { stream.getTracks().forEach(t => t.stop()); } catch {}

        if (cancelled) return;
        const blob = new Blob(chunks, { type: mimeType });
        if (duration < 0.4 || blob.size < 1000) {
            Utils.showToast(I18n.t('t.tw_speak_longer', 'もう少し長く話してください'), 3000);
            return;
        }
        await this._sendVoiceToSpace(blob, mimeType, duration);
    },

    async _sendVoiceToSpace(blob, mimeType, duration) {
        const t = this._ensureData();
        const space = (t.spaces || []).find(s => s.id === this.currentSpaceId);
        if (!space) return;

        // 1. 用户语音存到 PerigeeAudio
        const audioId = 'space_v_' + Utils.generateId();
        try {
            if (typeof TTSEngine !== 'undefined') await TTSEngine.storeAudio(audioId, blob);
        } catch (e) {
            Utils.showToast(I18n.t('t.tw_audio_save_failed', '音声の保存に失敗'), 3000);
            return;
        }

        // 2. 添加用户语音消息到 space
        const userIdent = this._getActiveIdentity();
        const userMsg = {
            id: Utils.generateId(),
            speakerName: userIdent.name,
            speakerId: userIdent.npcId,
            kind: 'voice',
            userAudioId: audioId,
            duration,
            content: '（音声メッセージ）',
            elapsed: this._calcNextSpaceElapsed(space),
            timestamp: Date.now(),
            byUser: true
        };
        space.messages = [...(space.messages || []), userMsg];
        Utils.saveData();
        this.renderSpaceDetail();

        // 3. 显示「反応生成中」骨架占位
        this._appendSpaceTypingHint();

        try {
            // 4. blob → base64
            const base64 = await this._blobToBase64(blob);

            // 5. 构建 prompt（多角色反应）
            const npcs = AppState.data.broadcast.officialNpcs || [];
            const otherSpeakers = (space.speakerNpcIds || [])
                .filter(id => id !== userIdent.npcId)
                .map(id => { const n = this._getNpc(id); return n ? { id, name: n.name || n.role, role: n.role || '' } : null; })
                .filter(Boolean);
            const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
            const recentCtx = (space.messages || []).slice(-7, -1).map(m => `${m.speakerName}: ${m.content}`).join('\n');

            const systemPrompt = `あなたは日本語Xスペース（ライブ音声会話）のシミュレーターです。
ユーザー（${userIdent.name}）の音声を聴いて、その場にいる他のスピーカーの自然な反応を生成してください。

スペース設定:
- タイトル: 「${space.title}」
- 他のスピーカー: ${otherSpeakers.map(s => `${s.name}（${s.role || ''}）`).join('、') || '（なし）'}

作品設定:
${worldContext || '（未設定 — 具体的なキャラ名・CP・ストーリーを捏造しないこと）'}
${Utils.PROMPTS.infoAccessRule()}

ルール:
- ユーザーが何語で話しても、必ず日本語で応答すること
- 他のスピーカーから 1〜3 名が順番に反応（1人は必ず）
- 各反応は 1〜3 文、自然な会話口調（「そうですね」「えーと」など含めて OK）
- ${userIdent.name} の発言内容を踏まえること
- 元の作品にないキャラ・ストーリーを捏造しない

直近の会話:
${recentCtx || '（始まったばかり）'}

出力フォーマット（厳守、各反応ごとに 1 ブロック、必ず ---SMSG--- で区切る）:
---SMSG---
SPEAKER: [名前]
CONTENT: [発言内容]
ELAPSED: [+HH:MM:SS、直前から 30 秒〜2 分後]`;

            const messages = [{
                role: 'user',
                content: 'ユーザーの音声を聴いて、他のスピーカーが反応してください。',
                audio: { data: base64, mimeType }
            }];
            const raw = await Utils.callChatAPI(messages, systemPrompt);
            this._removeSpaceTypingHint();

            const newMsgs = this._parseSpaceMessages(raw, npcs, space.speakerNpcIds || []);
            // 过滤掉 AI 误把用户当 speaker 的情况
            const filtered = newMsgs.filter(m => m.speakerId !== userIdent.npcId);
            if (filtered.length === 0) {
                Utils.showToast(I18n.t('t.tw_reaction_gen_failed_plain', '反応の生成に失敗しました'), 3000);
                return;
            }
            // 追加 timestamp 偏移让顺序自然
            const baseTs = Date.now();
            filtered.forEach((m, i) => { m.timestamp = baseTs + i * 1500; m.kind = 'text'; });
            space.messages = [...(space.messages || []), ...filtered];
            Utils.saveData();
            this.renderSpaceDetail();
            // fire-and-forget：TTS 合成（用户参与的 space 才合成）
            this._synthesizeSpaceMessagesAsync(space.id, filtered).catch(e => console.warn('[Space TTS chain]', e));
        } catch (e) {
            this._removeSpaceTypingHint();
            console.error('[Space LLM]', e);
            Utils.showToast(I18n.t('t.tw_reaction_gen_failed', '反応生成失敗：') + e.message, 4000);
        }
    },

    _appendSpaceTypingHint() {
        const wrap = document.getElementById('twSpaceMessages');
        if (!wrap) return;
        if (document.getElementById('twSpaceTypingHint')) return;
        wrap.insertAdjacentHTML('beforeend', `<div id="twSpaceTypingHint" class="tw-space-msg tw-space-typing">
    <div class="tw-space-msg-avatar" style="background:#aaa;">…</div>
    <div class="tw-space-msg-body">
        <div class="tw-space-msg-header"><span class="tw-space-msg-name">${I18n.t('tw.space_others_responding', '他のスピーカーが応答中')}</span></div>
        <div class="tw-space-typing-dots"><span></span><span></span><span></span></div>
    </div>
</div>`);
    },

    _removeSpaceTypingHint() {
        document.getElementById('twSpaceTypingHint')?.remove();
    },

    _calcNextSpaceElapsed(space) {
        const msgs = space.messages || [];
        const last = msgs[msgs.length - 1];
        if (!last || !last.elapsed) return '+00:00:30';
        const m = String(last.elapsed).match(/(\d+):(\d+):(\d+)/);
        if (!m) return '+00:01:00';
        let h = parseInt(m[1], 10), min = parseInt(m[2], 10), s = parseInt(m[3], 10);
        s += 45 + Math.floor(Math.random() * 30);
        if (s >= 60) { min += Math.floor(s / 60); s %= 60; }
        if (min >= 60) { h += Math.floor(min / 60); min %= 60; }
        return `+${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    },

    _blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = String(reader.result || '');
                resolve(result.split(',')[1] || '');
            };
            reader.onerror = () => reject(new Error('ファイル読み込み失敗'));
            reader.readAsDataURL(blob);
        });
    },

    // ===== Space 用户语音消息播放 =====
    _activeSpaceVoice: null,
    _activeSpaceVoiceBubble: null,

    async _playSpaceVoice(audioId, bubble) {
        if (this._activeSpaceVoiceBubble) this._activeSpaceVoiceBubble.classList.remove('tw-voice-playing');
        if (this._activeSpaceVoice) {
            try { this._activeSpaceVoice.pause(); } catch {}
            // 切换/暂停时回收旧的 blob URL（仿 _activeTwAudio 的 _objUrl 模式）
            if (this._activeSpaceVoice._objUrl) URL.revokeObjectURL(this._activeSpaceVoice._objUrl);
            const wasSame = this._activeSpaceVoiceBubble === bubble;
            this._activeSpaceVoice = null;
            this._activeSpaceVoiceBubble = null;
            if (wasSame) return; // 二次点击 → 暂停
        }
        let url = null;
        let audio = null;
        try {
            if (typeof TTSEngine === 'undefined') return;
            const blob = await TTSEngine.getAudio(audioId);
            if (!blob) { Utils.showToast(I18n.t('t.tw_audio_not_found', '音声が見つかりません'), 3000); return; }
            url = URL.createObjectURL(blob);
            audio = new Audio(url);
            audio._objUrl = url;
            this._activeSpaceVoice = audio;
            this._activeSpaceVoiceBubble = bubble;
            bubble.classList.add('tw-voice-playing');
            audio.onended = () => {
                // 旧 audio 残留事件不应误清新数据
                if (this._activeSpaceVoice !== audio) return;
                bubble.classList.remove('tw-voice-playing');
                this._activeSpaceVoice = null;
                this._activeSpaceVoiceBubble = null;
                if (audio._objUrl) URL.revokeObjectURL(audio._objUrl);
            };
            audio.onerror = () => {
                if (this._activeSpaceVoice !== audio) return;
                bubble.classList.remove('tw-voice-playing');
                this._activeSpaceVoice = null;
                this._activeSpaceVoiceBubble = null;
                if (audio._objUrl) URL.revokeObjectURL(audio._objUrl);
                Utils.showToast(I18n.t('t.tw_audio_play_failed', '音声を再生できません'), 3000);
            };
            await audio.play();
        } catch (e) {
            if (url) URL.revokeObjectURL(url);
            // 仅清理本次请求自己的 audio，别误删另一条正在播放的语音状态
            if (audio && this._activeSpaceVoice === audio) {
                bubble.classList.remove('tw-voice-playing');
                this._activeSpaceVoice = null;
                this._activeSpaceVoiceBubble = null;
            }
            console.warn('[Space Voice Play]', e);
            Utils.showToast(I18n.t('t.tw_playback_failed', '再生失敗'), 3000);
        }
    },

    showCreateSpaceModal() {
        // 必须 NPC 身份才能创建
        const identity = this._getActiveIdentity();
        if (identity.type !== 'npc') {
            Utils.showToast(I18n.t('t.tw_space_npc_only', 'スペース開始は公式 NPC アカウントから'), 4000);
            this.showIdentityModal();
            return;
        }
        const npcs = AppState.data.broadcast.officialNpcs || [];
        if (npcs.length === 0) {
            Utils.showToast(I18n.t('t.tw_add_npc_before_space', '放送局でNPCを追加してからスペースを開始できます'));
            return;
        }
        // 关掉列表 modal（如果是从那里开过来的）
        document.getElementById('twitterSpaceListModal')?.classList.remove('active');
        const modal = document.getElementById('twitterSpaceModal');
        if (!modal) return;
        const npcOptions = npcs.map(n => `<option value="${this._esc(n.id)}" ${n.id === identity.npcId ? 'selected' : ''}>${this._esc(n.name || n.role)}</option>`).join('');
        // 当前用户身份默认勾选；其他 NPC 也都勾选（默认聚集）
        const npcChecks = npcs.map(n => `<label class="tw-space-speaker-row"><input type="checkbox" class="twSpaceSpeakerCheck" value="${this._esc(n.id)}" checked><span class="tw-space-speaker-name">${this._esc(n.name || n.role)}${n.id === identity.npcId ? I18n.t('tw.space_label_you', '（あなた）') : ''}</span></label>`).join('');
        const plots = AppState.data.broadcast.plotProgress || [];
        const plotOptions = `<option value="">${I18n.t('tw.space_no_plot', '（なし）')}</option>` + plots.map(p => `<option value="${this._esc(p.id)}">${this._esc(p.title)}</option>`).join('');
        const hostSel = document.getElementById('twSpaceHostSel');
        const spkDiv = document.getElementById('twSpaceSpeakers');
        const plotSel = document.getElementById('twSpacePlotSel');
        const titleInput = document.getElementById('twSpaceTitleInput');
        if (hostSel) hostSel.innerHTML = npcOptions;
        if (spkDiv) spkDiv.innerHTML = npcChecks;
        if (plotSel) { plotSel.innerHTML = plotOptions; if (plots.length > 0) plotSel.value = plots[plots.length - 1].id; }
        if (titleInput) titleInput.value = '';
        modal.classList.add('active');
    },

    async _generateSpace(btn) {
        const title = document.getElementById('twSpaceTitleInput')?.value.trim();
        const hostNpcId = document.getElementById('twSpaceHostSel')?.value;
        const speakerChecks = document.querySelectorAll('.twSpaceSpeakerCheck:checked');
        const speakerNpcIds = [...speakerChecks].map(cb => cb.value);
        const relatedPlotId = document.getElementById('twSpacePlotSel')?.value || null;
        if (!title) { Utils.showToast(I18n.t('t.tw_enter_title', 'タイトルを入力してください')); return; }
        if (speakerNpcIds.length === 0) { Utils.showToast(I18n.t('t.tw_select_speaker', 'スピーカーを1人以上選択してください')); return; }
        if (btn) { btn.disabled = true; btn.textContent = I18n.t('tw.space_generating', '生成中…'); }
        try {
            const t = this._ensureData();
            const npcs = AppState.data.broadcast.officialNpcs || [];
            const plots = AppState.data.broadcast.plotProgress || [];
            const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
            const allSpeakerIds = [...new Set([hostNpcId, ...speakerNpcIds].filter(Boolean))];
            const speakerNames = allSpeakerIds.map(id => { const n = npcs.find(x => x.id === id); return n ? (n.name || n.role) : id; });
            let plotContext = '';
            if (relatedPlotId) {
                const plot = plots.find(p => p.id === relatedPlotId);
                if (plot) plotContext = `\n関連エピソード：${plot.title}\n${plot.content || ''}`;
            }
            const systemPrompt = `あなたは日本語X（Twitter）スペース — ライブ音声ディスカッションをシミュレーションしています。
スピーカー: ${speakerNames.join('、')}
スペースタイトル: 「${title}」${plotContext}

作品設定（以下の事実のみ使用し、捏造しないこと）:
${worldContext || '（未設定 — 具体的なキャラ名・CP・ストーリーを捏造しないこと）'}
${Utils.PROMPTS.infoAccessRule()}
ルール:
- 8〜12件のメッセージを生成すること
- カジュアルで自発的な音声会話スタイル（ツイートより短く、自然な話し言葉の日本語）
- スピーカー同士がリアクションし合い、思い出や裏話を共有すること
- ストーリーイベントの捏造禁止
- 動画演出（フラッシュバック・ナレーション・モンタージュ等）は観客向けの映像技法であり、スピーカーが実際に目撃したものではない。作中で実際に体験したことだけを語ること
- ELAPSEDフォーマット: +HH:MM:SS、+00:01:00から開始、メッセージごとに1〜4分ずつ増加

出力フォーマット（厳守）:
---SMSG---
SPEAKER: [上記リストの名前と完全一致]
CONTENT: [発言内容、1〜3文]
ELAPSED: [+HH:MM:SS]`;
            const response = await Utils.callChatAPI([{ role: 'user', content: 'スペースの会話を生成してください。' }], systemPrompt, null, 2048);
            const messages = this._parseSpaceMessages(response, npcs, allSpeakerIds);
            const space = {
                id: Date.now().toString(),
                title,
                hostNpcId: hostNpcId || allSpeakerIds[0],
                speakerNpcIds: allSpeakerIds,
                status: 'live',
                listenerCount: Math.floor(800 + Math.random() * 7200),
                startTime: Date.now(),
                endTime: null,
                messages,
                relatedPlotId: relatedPlotId || null,
            };
            if (!t.spaces) t.spaces = [];
            t.spaces.unshift(space);
            Utils.saveData();
            document.getElementById('twitterSpaceModal')?.classList.remove('active');
            this.switchTab('following', true);
            Utils.showToast(I18n.t('t.tw_space_started', '✓ スペースを開始しました'));
        } catch (e) {
            Utils.showToast(I18n.t('t.tw_gen_failed', '生成失敗：') + e.message);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = I18n.t('tw.start_space', '✦ スペースを開始'); }
        }
    },

    _parseSpaceMessages(text, npcs, speakerIds) {
        const blocks = text.split(/---\s*SMSG\s*---/i).filter(b => b.trim());
        return blocks.map(block => {
            const speakerM = block.match(/^SPEAKER:\s*(.+)$/m);
            const contentM = block.match(/^CONTENT:\s*([\s\S]*?)(?=\nELAPSED:|\n---SMSG|$)/m);
            const elapsedM = block.match(/^ELAPSED:\s*(.+)$/m);
            const speakerName = speakerM ? speakerM[1].trim() : '';
            const content = contentM ? contentM[1].trim() : '';
            const elapsed = elapsedM ? elapsedM[1].trim() : '';
            if (!content || !speakerName) return null;
            const npc = (npcs || []).find(n => {
                const name = (n.name || n.role || '').toLowerCase();
                return speakerName.toLowerCase().includes(name) || name.includes(speakerName.toLowerCase());
            });
            const speakerId = npc ? npc.id : (speakerIds[0] || null);
            return { id: Utils.generateId(), speakerId, speakerName, content, elapsed, timestamp: Date.now() };
        }).filter(Boolean);
    },

    async _loadMoreSpaceMessages(spaceId) {
        const t = this._ensureData();
        const space = (t.spaces || []).find(s => s.id === spaceId);
        if (!space) return;
        const btn = document.getElementById('twSpaceLoadMoreBtn');
        if (btn) { btn.disabled = true; btn.textContent = I18n.t('tw.space_loading_more', '読み込み中…'); }
        try {
            const npcs = AppState.data.broadcast.officialNpcs || [];
            const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
            const speakerNames = space.speakerNpcIds.map(id => { const n = npcs.find(x => x.id === id); return n ? (n.name || n.role) : id; });
            const existingMsgs = (space.messages || []).slice(-6).map(m => `${m.speakerName} [${m.elapsed}]: ${m.content}`).join('\n');
            const lastElapsed = space.messages?.length > 0 ? (space.messages[space.messages.length - 1].elapsed || '+00:10:00') : '+00:10:00';
            const systemPrompt = `あなたは日本語Xスペースの音声ディスカッションを続けています。
スピーカー: ${speakerNames.join('、')}
スペースタイトル: 「${space.title}」

作品設定:
${worldContext || '（未設定 — 具体的なキャラ名・CP・ストーリーを捏造しないこと）'}
${Utils.PROMPTS.infoAccessRule()}
直近の会話:
${existingMsgs}

自然に続けること。最後の経過時間: ${lastElapsed} — 1〜4分ずつ増加を続けること。
5〜7件の追加メッセージを生成すること。日本語のみ。イベントの捏造禁止。
動画演出（フラッシュバック・ナレーション等）は観客向け映像技法であり、スピーカーが実際に目撃したものではない。

出力フォーマット:
---SMSG---
SPEAKER: [名前]
CONTENT: [発言内容、1〜3文]
ELAPSED: [+HH:MM:SS]`;
            const response = await Utils.callChatAPI([{ role: 'user', content: '続きを生成してください。' }], systemPrompt, null, 1536);
            const newMsgs = this._parseSpaceMessages(response, npcs, space.speakerNpcIds);
            newMsgs.forEach(m => m.kind = 'text');
            space.messages = [...(space.messages || []), ...newMsgs];
            Utils.saveData();
            this.renderSpaceDetail();
            // 用户参与的 space 才合成 TTS（personal 听众进别人 space → 跳过）
            const userIdent = this._getActiveIdentity();
            const isUserSpeaker = userIdent.type === 'npc' && (space.speakerNpcIds || []).includes(userIdent.npcId);
            if (isUserSpeaker) {
                this._synthesizeSpaceMessagesAsync(space.id, newMsgs).catch(e => console.warn('[Space TTS chain]', e));
            }
        } catch (e) {
            Utils.showToast(I18n.t('t.tw_load_failed', '読み込み失敗：') + e.message);
            if (btn) { btn.disabled = false; btn.textContent = I18n.t('tw.space_more_listen', 'もっと聴く'); }
        }
    },

    endSpace(spaceId) {
        const t = this._ensureData();
        const space = (t.spaces || []).find(s => s.id === spaceId);
        if (!space) return;
        space.status = 'ended';
        space.endTime = Date.now();
        Utils.saveData();
        this.renderSpaceDetail();
        Utils.showToast(I18n.t('t.tw_space_ended', 'スペースを終了しました'));
    },

    deleteSpace(spaceId) {
        const t = this._ensureData();
        const space = (t.spaces || []).find(s => s.id === spaceId);
        // 顺手清掉 PerigeeAudio 里的 blob（用户语音 + TTS 合成）
        if (space && typeof TTSEngine !== 'undefined') {
            const ids = [];
            (space.messages || []).forEach(m => {
                if (m.userAudioId) ids.push(m.userAudioId);
                if (m.ttsAudioId) ids.push(m.ttsAudioId);
            });
            if (ids.length) TTSEngine.removeAudios(ids).catch(() => {});
        }
        t.spaces = (t.spaces || []).filter(s => s.id !== spaceId);
        Utils.saveData();
        // 如果在详情页则返回；如果在管理列表则刷新
        const listModal = document.getElementById('twitterSpaceListModal');
        if (listModal && listModal.classList.contains('active')) {
            this.showAllSpaces();
        } else {
            Navigation.goTo('twitter');
        }
        Utils.showToast(I18n.t('t.tw_deleted', '削除しました'));
    },

    // ===== ユーザープロフィール =====
    _userProfileTab: 'tweets',

    openUserProfile() {
        this._userProfileTab = 'tweets';
        Navigation.goTo('twitter-user-profile');
    },

    renderUserProfile() {
        const t = this._ensureData();
        const content = document.getElementById('twUserProfileContent');
        if (!content) return;

        // 当前激活账号 = profile 显示的对象
        const identity = this._getActiveIdentity();
        const activeAccountId = t.activeAccountId;
        const isPersonal = identity.type === 'personal';
        const acc = isPersonal ? this._getPersonalAccount(activeAccountId) : null;
        const name = identity.name;
        const handle = identity.handle;
        const letter = identity.letter;
        const color = identity.color;
        const bio = identity.bio || (acc?.bio || '');
        const joinDate = (acc?.joinDate) || I18n.t('tw.profile_default_joindate', '2024年1月');

        // 当前账号自己发的推文（按 postedAsAccountId 过滤）
        const userTweets = (t.tweets || [])
            .filter(tw => tw.postedAsAccountId === activeAccountId)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        // 点赞的推文（用户级共享，不区分账号）
        const allTweets = [...(t.npcTweets || []), ...(t.tweets || [])];
        const likedTweets = (t.likedTweetIds || [])
            .slice().reverse()
            .map(l => {
                const tw = allTweets.find(tw => tw.id === l.id);
                if (!tw) return null;
                return { tweet: tw, isNpc: l.isNpc };
            })
            .filter(Boolean);

        const tweetCount = userTweets.length;
        const likeCount = likedTweets.length;

        // 粉丝/关注数（personal: stored，NPC: stored or generated）
        let followerCountUser = 0;
        let followingCountUser = 0;
        if (isPersonal) {
            followerCountUser = this._accountFollowerCount(acc);
            followingCountUser = this._accountFollowingCount(acc);
        } else if (identity.npcId) {
            const npc = this._getNpc(identity.npcId);
            if (npc) {
                followerCountUser = this._npcFollowerCount(npc);
                followingCountUser = this._npcFollowingCount(npc);
            }
        }

        // Banner — 优先 banner 图，否则纯色
        const bannerImage = isPersonal ? (acc?.bannerImage || null) : (identity.npcId ? (this._getNpc(identity.npcId)?.bannerImage || null) : null);
        const bannerStyle = bannerImage
            ? `background:url("${Utils.escAttr(bannerImage)}") center/cover no-repeat;`
            : `background:${color};`;

        // Tab
        const tabTweets = this._userProfileTab === 'tweets' ? ' tw-profile-tab-active' : '';
        const tabLikes = this._userProfileTab === 'likes' ? ' tw-profile-tab-active' : '';

        // Tab 内容
        let tabContent;
        if (this._userProfileTab === 'likes') {
            tabContent = likeCount === 0
                ? `<div style="text-align:center;padding:40px 0;color:var(--text-secondary);font-size:14px;">${I18n.t('tw.empty_no_search_likes', 'まだいいねがありません')}</div>`
                : likedTweets.map(l => this._renderTweetCard(l.tweet, l.isNpc, true)).join('');
        } else {
            tabContent = tweetCount === 0
                ? `<div style="text-align:center;padding:40px 0;color:var(--text-secondary);font-size:14px;">${I18n.t('tw.empty_no_tweets', 'まだツイートがありません')}</div>`
                : userTweets.map(tw => this._renderTweetCard(tw, false, true)).join('');
        }

        // 位置/链接（统一从 personal 账号读，NPC 时取 npc 的字段）
        const userLocation = isPersonal ? (acc?.location || '') : '';
        const userLink = isPersonal ? (acc?.link || '') : '';
        const calendarSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.18em;margin-right:4px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
        const pinSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.18em;margin-right:4px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
        const linkSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.18em;margin-right:4px"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;

        // 头像图片
        const userAvatarImage = identity.avatarImage || null;
        const avatarInner = userAvatarImage
            ? `<img class="tw-profile-avatar tw-avatar-img" src="${Utils.escAttr(userAvatarImage)}" alt="">`
            : `<div class="tw-profile-avatar" style="background:${color};">${this._esc(letter)}</div>`;

        // 实名状态（仅 personal 账号显示）
        const isReal = isPersonal && (identity.isReal !== false);
        const realnessHint = isPersonal
            ? (isReal ? I18n.t('tw.profile_bio_realname', '実名アカウント · NPCはあなたの素性を知っている') : I18n.t('tw.profile_bio_anon', {handle: acc?.handle || 'myaccount'}))
            : '';

        content.innerHTML = `<div class="tw-profile-banner" style="${bannerStyle}">
    <button class="tw-profile-banner-edit" onclick="Twitter._uploadActiveBanner()" title="${I18n.t('tw.profile_change_banner', 'バナーを変更')}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
    </button>
</div>
<div class="tw-profile-info">
    <div class="tw-profile-avatar-row">
        <div class="tw-profile-avatar-wrap" onclick="Twitter._uploadUserAvatar()" title="${I18n.t('tw.profile_change_avatar', 'クリックでアバターを変更')}" style="cursor:pointer">
            ${avatarInner}
        </div>
        <button class="tw-profile-follow-btn" onclick="Twitter.showIdentityModal()" style="font-size:13px;">${I18n.t('tw.profile_edit', 'プロフィールを編集')}</button>
    </div>
    <div class="tw-profile-name">${this._esc(name)} ${this._svg.verified}</div>
    <div class="tw-profile-handle">${this._esc(handle)}</div>
    ${bio ? `<div class="tw-profile-bio">${this._esc(bio).replace(/\n/g, '<br>')}</div>` : ''}
    ${realnessHint ? `<div class="tw-profile-realness">${this._esc(realnessHint)}</div>` : ''}
    <div class="tw-profile-meta">
        ${userLocation ? `<span style="margin-right:14px">${pinSvg}${this._esc(userLocation)}</span>` : ''}
        ${userLink ? `<a href="${Utils.escAttr(userLink)}" target="_blank" rel="noopener" style="color:#1d9bf0;text-decoration:none;margin-right:14px">${linkSvg}${this._esc(userLink.replace(/^https?:\/\//, ''))}</a>` : ''}
        <span>${calendarSvg}${I18n.t('tw.profile_joined', {date: joinDate})}</span>
    </div>
    <div class="tw-profile-counts">
        <span><strong>${this._fmtNumComma(followingCountUser)}</strong> ${I18n.t('tw.profile_following', 'フォロー中')}</span>
        <span><strong>${this._fmtNumComma(followerCountUser)}</strong> ${I18n.t('tw.profile_followers', 'フォロワー')}</span>
        <span><strong>${tweetCount}</strong> ${I18n.t('tw.profile_tweets_count', 'ツイート')}</span>
        <span><strong>${likeCount}</strong> ${I18n.t('tw.profile_likes_count', 'いいね')}</span>
    </div>
    <div class="tw-profile-services">
        <button class="tw-service-btn" onclick="Navigation.goTo('twitter-marshmallow')">${I18n.t('tw.title_marshmallow', '🍡 マシュマロ')}${t.marshmallows.filter(m => !m.isRead).length ? ` <span class="tw-service-badge">${t.marshmallows.filter(m => !m.isRead).length}</span>` : ''}</button>
        <button class="tw-service-btn" onclick="Navigation.goTo('twitter-poipiku')">${I18n.t('tw.title_poipiku', '🎨 Poipiku')}</button>
    </div>
</div>
<div class="tw-profile-tabs">
    <div class="tw-profile-tab${tabTweets}" onclick="Twitter._userProfileTab='tweets';Twitter.renderUserProfile()">${I18n.t('tw.profile_tab_tweets', 'ツイート')}</div>
    <div class="tw-profile-tab${tabLikes}" onclick="Twitter._userProfileTab='likes';Twitter.renderUserProfile()">${I18n.t('tw.profile_tab_likes', 'いいね')}</div>
</div>
${tabContent}`;
    },

    // ===== NPC プロフィール =====
    _npcProfileTab: 'tweets',

    openNpcProfile(npcId, fromScreen) {
        this._profileMode = 'npc';
        this.currentNpcProfileId = npcId;
        this._npcProfileFromScreen = fromScreen || 'twitter';
        this._npcProfileTab = 'tweets';
        Navigation.goTo('twitter-npc-profile');
    },

    closeNpcProfile() {
        Navigation.goTo(this._npcProfileFromScreen || 'twitter');
    },

    // ===== Fan Friend Profile =====
    openFanProfile(fanId) {
        this._profileMode = 'fan';
        this.currentFanProfileId = fanId;
        this.currentNpcProfileId = null;
        this._fanPreviewData = null;
        this._npcProfileFromScreen = this._npcProfileFromScreen || 'twitter';
        this._fanProfileTab = 'tweets';
        Navigation.goTo('twitter-npc-profile');
    },

    openFanPreview(tweetId) {
        const t = this._ensureData();
        const tweet = (t.npcTweets || []).find(tw => tw.id === tweetId);
        if (!tweet) return;
        // 临时存储预览数据
        this._fanPreviewData = {
            name: tweet.authorName || 'ファン',
            handle: tweet.authorHandle || '@user',
            type: tweet.authorType || 'fan',
            avatarColor: this._fanTypeColor(tweet.authorType),
            tweetId: tweetId
        };
        this._profileMode = 'fan-preview';
        this._npcProfileFromScreen = this._npcProfileFromScreen || 'twitter';
        this._fanProfileTab = 'tweets';
        Navigation.goTo('twitter-npc-profile');
    },

    saveFanFriend(tweetOrPreview) {
        const t = this._ensureData();
        if (t.fanFriends.length >= 20) {
            Utils.showToast(I18n.t('t.tw_friend_limit', '友だちの上限（20人）に達しています'));
            return null;
        }
        const handle = tweetOrPreview.handle || tweetOrPreview.authorHandle;
        const existing = this._getFanByHandle(handle);
        if (existing) {
            Utils.showToast(I18n.t('t.tw_already_friend', 'すでに友だちに追加済みです'));
            return existing;
        }
        const type = tweetOrPreview.type || tweetOrPreview.authorType || 'fan';
        // 爆料傾向：同人作家/CP厨/企画主/イベント勢は口が軽い傾向、業界/メディアは慎重
        const leakProneTypes = ['doujin_writer', 'doujin_artist', 'cp_fan', 'organizer', 'event_haul', 'event_repo', 'fanart_share'];
        const leakProne = leakProneTypes.includes(type) ? Math.random() > 0.3 : Math.random() > 0.8;
        const friend = {
            id: Utils.generateId(),
            name: tweetOrPreview.name || tweetOrPreview.authorName || 'ファン',
            handle: handle || '@user',
            type: type,
            avatarColor: tweetOrPreview.avatarColor || this._fanTypeColor(type),
            bio: null,
            leakProne: leakProne,
            createdAt: Date.now(),
            lineCharId: null
        };
        t.fanFriends.push(friend);
        Utils.saveData();
        Utils.showToast(I18n.t('t.tw_friend_added', {name: friend.name}));
        return friend;
    },

    renderNpcProfile() {
        // Fan profile 路由
        if (this._profileMode === 'fan') { this.renderFanProfile(); return; }
        if (this._profileMode === 'fan-preview') { this._renderFanPreview(); return; }

        const t = this._ensureData();
        const npcId = this.currentNpcProfileId;
        if (!npcId) { Navigation.goTo('twitter'); return; }
        const npc = this._getNpc(npcId);
        if (!npc) { Navigation.goTo('twitter'); return; }

        const name = npc.name || npc.role;
        const handle = this._getNpcHandle(npc);
        const color = this._npcColor(npcId);
        const letter = name.charAt(0).toUpperCase();
        const followerCount = this._npcFollowerCount(npc);
        const followingCount = this._npcFollowingCount(npc);
        const joinDate = this._genJoinDate(npcId);
        const isFollowed = (t.followedNpcIds || []).includes(npcId);

        // このNPCの全ツイート — AI自動生成（npcTweets）+ ユーザーが NPC 身份で投稿したもの（tweets）を統合
        const aiNpcTweets = (t.npcTweets || [])
            .filter(tw => tw.npcId === npcId)
            .map(tw => ({ tw, isNpc: true }));
        const userAuthoredAsNpc = (t.tweets || [])
            .filter(tw => {
                const acc = tw.postedAsAccountId || '';
                return (acc === 'npc:' + npcId) || tw.postedAsNpcId === npcId;
            })
            .map(tw => ({ tw, isNpc: false }));
        const npcTweets = [...aiNpcTweets, ...userAuthoredAsNpc]
            .sort((a, b) => (b.tw.timestamp || 0) - (a.tw.timestamp || 0));
        const tweetCount = npcTweets.length;

        // このNPCが他のツイートにリプライした数
        const allTweets = [...(t.npcTweets || []), ...(t.tweets || [])];
        const npcReplies = [];
        allTweets.forEach(tw => {
            (tw.replies || []).forEach(r => {
                if (r.authorRole === 'npc' && r.handle === handle) {
                    npcReplies.push({ reply: r, parentTweet: tw });
                }
            });
        });
        const replyCount = npcReplies.length;

        // いいね数（推定）
        const totalLikes = npcTweets.reduce((sum, item) => sum + (item.tw.likes || 0), 0);

        const titleEl = document.getElementById('twNpcProfileTitle');
        if (titleEl) titleEl.textContent = name;

        const content = document.getElementById('twNpcProfileContent');
        if (!content) return;

        // Bio
        const bioHtml = npc.bio
            ? `<div class="tw-profile-bio">${this._esc(npc.bio).replace(/\n/g, '<br>')}</div>`
            : `<div class="tw-profile-bio-gen"><button class="glass-btn mini" onclick="Twitter.generateNpcBio('${this._esc(npcId)}')">${I18n.t('tw.profile_gen_bio', 'プロフィールを生成')}</button></div>`;

        // フォローボタン
        const followBtnCls = isFollowed ? 'tw-profile-follow-btn tw-profile-followed' : 'tw-profile-follow-btn';
        const followBtnText = isFollowed ? I18n.t('tw.profile_following', 'フォロー中') : I18n.t('tw.profile_follow', 'フォローする');

        // タブ
        const tab = this._npcProfileTab;
        const tabTweets = tab === 'tweets' ? ' tw-profile-tab-active' : '';
        const tabReplies = tab === 'replies' ? ' tw-profile-tab-active' : '';
        const tabLikes = tab === 'likes' ? ' tw-profile-tab-active' : '';

        let tabContent;
        if (tab === 'replies') {
            if (npcReplies.length === 0) {
                tabContent = `<div style="text-align:center;padding:40px 0;color:var(--text-secondary);font-size:14px;">${I18n.t('tw.profile_empty_replies', 'まだ返信がありません')}</div>`;
            } else {
                tabContent = npcReplies.slice(0, 30).map(({ reply: r, parentTweet: tw }) => {
                    const parentIdentity = this._resolveTweetIdentity(tw, true);
                    return `<div class="tw-npc-reply-card">
    <div class="tw-npc-reply-context">
        <span style="color:var(--text-secondary);font-size:12px;">${I18n.t('tw.profile_reply_context', {name: this._esc(parentIdentity.name)})}</span>
    </div>
    <div class="tw-reply" style="border:none;padding-top:4px;">
        <div class="tw-reply-avatar" style="background:${color};">${this._esc(letter)}</div>
        <div class="tw-reply-body">
            <div class="tw-card-header">
                <span class="tw-name">${this._esc(name)} ${this._svg.verified}</span>
                <span class="tw-handle">${this._esc(handle)}</span>
                <span class="tw-time-sep">·</span>
                <span class="tw-time">${this._timeAgo(r.timestamp)}</span>
            </div>
            <div class="tw-content">${this._linkifyContent(r.content)}</div>
        </div>
    </div>
</div>`;
                }).join('');
            }
        } else if (tab === 'likes') {
            // NPC がいいねしたツイートは追跡していないので、推定表示
            tabContent = `<div style="text-align:center;padding:40px 0;color:var(--text-secondary);font-size:14px;">
    <div style="font-size:32px;margin-bottom:8px;">${this._svg.heart}</div>
    ${I18n.t('tw.profile_likes_received', {name: this._esc(name), n: this._fmtNum(totalLikes)})}
</div>`;
        } else {
            tabContent = tweetCount === 0
                ? `<div style="text-align:center;padding:40px 0;color:var(--text-secondary);font-size:14px;">${I18n.t('tw.empty_no_tweets', 'まだツイートがありません')}</div>`
                : npcTweets.map(({ tw, isNpc }) => this._renderTweetCard(tw, isNpc, true)).join('');
        }

        // バナー — 优先 banner 图，否则纯色
        const bannerStyle = npc.bannerImage
            ? `background:url("${Utils.escAttr(npc.bannerImage)}") center/cover no-repeat;`
            : `background:${color};`;
        const esc = (id) => this._esc(id);

        content.innerHTML = `<div class="tw-profile-banner" style="${bannerStyle}">
    <div class="tw-profile-banner-role">${this._esc(npc.role || '')}</div>
    <button class="tw-profile-banner-edit" onclick="Twitter._uploadNpcBanner('${esc(npcId)}')" title="${I18n.t('tw.profile_change_banner', 'バナーを変更')}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
    </button>
</div>
<div class="tw-profile-info">
    <div class="tw-profile-avatar-row">
        <div class="tw-profile-avatar-wrap" onclick="Twitter._uploadNpcAvatar('${esc(npcId)}')" title="${I18n.t('tw.profile_change_avatar', 'クリックでアバターを変更')}" style="cursor:pointer">
            ${npc.avatarImage
                ? `<img class="tw-profile-avatar tw-avatar-img" src="${Utils.escAttr(npc.avatarImage)}" alt="">`
                : `<div class="tw-profile-avatar" style="background:${color};">${this._esc(letter)}</div>`}
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
            <button class="tw-profile-dm-btn" onclick="event.stopPropagation();Twitter.openDm('${esc(npcId)}')" title="DM">
                ${this._svg.mailMd}
            </button>
            <button class="${followBtnCls}" onclick="Twitter.toggleFollowNpc('${esc(npcId)}')">${followBtnText}</button>
        </div>
    </div>
    <div class="tw-profile-name">${this._esc(name)} ${this._svg.verified}</div>
    <span class="tw-profile-verified-pill">${I18n.t('tw.profile_verified', '通过认证')}</span>
    <div class="tw-profile-handle" onclick="Twitter._editNpcHandle('${esc(npcId)}')" title="${I18n.t('tw.profile_edit_handle', 'クリックで @ハンドルを編集')}" style="cursor:pointer">${this._esc(handle)}</div>
    ${bioHtml}
    <div class="tw-profile-meta">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.18em;margin-right:4px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${I18n.t('tw.profile_using_x_since', {date: joinDate})}
    </div>
    <div class="tw-profile-counts">
        <span><strong>${this._fmtNumComma(followingCount)}</strong> ${I18n.t('tw.profile_following', 'フォロー中')}</span>
        <span><strong>${this._fmtNumComma(followerCount)}</strong> ${I18n.t('tw.profile_followers', 'フォロワー')}</span>
    </div>
</div>
<div class="tw-profile-tabs">
    <div class="tw-profile-tab${tabTweets}" onclick="Twitter._npcProfileTab='tweets';Twitter.renderNpcProfile()">${I18n.t('tw.profile_tab_tweets', 'ツイート')}</div>
    <div class="tw-profile-tab${tabReplies}" onclick="Twitter._npcProfileTab='replies';Twitter.renderNpcProfile()">${I18n.t('tw.profile_tab_replies', '返信')}</div>
    <div class="tw-profile-tab${tabLikes}" onclick="Twitter._npcProfileTab='likes';Twitter.renderNpcProfile()">${I18n.t('tw.profile_tab_likes', 'いいね')}</div>
</div>
${tabContent}`;
    },

    // 已弃用 — 改为返回数字（不格式化），可被存储值覆盖
    _genFollowerCount(npcId) {
        let hash = 0;
        for (let i = 0; i < npcId.length; i++) hash = (hash * 31 + npcId.charCodeAt(i)) & 0xffff;
        // 公众账号粉丝：1000 - 99000 范围
        return 1000 + (hash % 990) * 100;
    },

    _genFollowingCount(npcId) {
        let hash = 0;
        for (let i = 0; i < npcId.length; i++) hash = (hash * 17 + npcId.charCodeAt(i)) & 0xffff;
        return 30 + (hash % 70);
    },

    // NPC 当前粉丝数：优先用存储的，否则生成
    _npcFollowerCount(npc) {
        if (typeof npc.followerCount === 'number') return npc.followerCount;
        return this._genFollowerCount(npc.id);
    },
    _npcFollowingCount(npc) {
        if (typeof npc.followingCount === 'number') return npc.followingCount;
        return this._genFollowingCount(npc.id);
    },

    // 个人账号粉丝数（默认 0，靠自动增长）
    _accountFollowerCount(acc) {
        return acc?.followerCount || 0;
    },
    _accountFollowingCount(acc) {
        return acc?.followingCount || 0;
    },

    _genJoinDate(npcId) {
        let hash = 0;
        for (let i = 0; i < npcId.length; i++) hash = (hash * 31 + npcId.charCodeAt(i)) & 0xffff;
        const year = 2019 + (hash % 4);
        const month = 1 + (hash >> 3) % 12;
        return I18n.t('tw.time_year_month', {year, month});
    },

    async generateNpcBio(npcId) {
        const npc = this._getNpc(npcId);
        if (!npc) return;
        const forumData = AppState.data.forumData || {};
        const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
        const btn = document.querySelector(`button[onclick*="generateNpcBio"]`);
        if (btn) { btn.disabled = true; btn.textContent = I18n.t('tw.profile_generating', '生成中...'); }
        try {
            const systemPrompt = `あなたはアニメ関係者のX（Twitter）プロフィール文を書くライターです。
与えられたキャラクター情報をもとに、自然な日本語のプロフィール文（bio）を書いてください。

世界設定：
${worldContext || '（未設定 — 具体的なキャラ名・CP・ストーリーを捏造しないこと）'}

⚠️ プロフィールには公式に公開されている情報のみ記載すること。劇中未公開のバックストーリーや隠された関係性は含めないこと。

キャラクター：
名前：${npc.name || npc.role}
役職：${npc.role}

ルール：
- 本人が書いたように自然な口調で（一人称）
- 2〜4文、80文字程度
- 役職・仕事・キャラクターらしい趣味・姿勢などを含める
- ハッシュタグ不要
- フィクション内の情報のみ使用

プロフィール文のみ出力（余計な説明なし）：`;
            const messages = [{ role: 'user', content: 'プロフィール文を書いてください。' }];
            const bio = (await Utils.callChatAPI(messages, systemPrompt)).trim();
            const npcs = AppState.data.broadcast.officialNpcs || [];
            const idx = npcs.findIndex(n => n.id === npcId);
            if (idx >= 0) { npcs[idx].bio = bio; Utils.saveData(); }
            this.renderNpcProfile();
            Utils.showToast(I18n.t('t.tw_profile_generated', '✓ プロフィールを生成しました'));
        } catch (e) {
            Utils.showToast(I18n.t('t.tw_gen_failed', '生成失敗：') + e.message);
            if (btn) { btn.disabled = false; btn.textContent = I18n.t('tw.profile_gen_bio', 'プロフィールを生成'); }
        }
    },

    // ===== Fan Profile 渲染 =====
    renderFanProfile() {
        const t = this._ensureData();
        const fan = this._getFanFriend(this.currentFanProfileId);
        if (!fan) { Navigation.goTo('twitter'); return; }

        const name = fan.name;
        const handle = fan.handle;
        const color = fan.avatarColor;
        const letter = name.charAt(0).toUpperCase();
        const typeLabel = this._fanTypeLabel(fan.type);
        const isFollowed = (t.followedNpcIds || []).includes(fan.id);

        // このfanの全ツイート
        const fanTweets = (t.npcTweets || [])
            .filter(tw => tw.source === 'fan' && tw.authorHandle === fan.handle)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const tweetCount = fanTweets.length;

        // リプライ
        const allTweets = [...(t.npcTweets || []), ...(t.tweets || [])];
        const fanReplies = [];
        allTweets.forEach(tw => {
            (tw.replies || []).forEach(r => {
                if (r.handle === fan.handle || r.author === fan.name) {
                    fanReplies.push({ reply: r, parentTweet: tw });
                }
            });
        });

        const titleEl = document.getElementById('twNpcProfileTitle');
        if (titleEl) titleEl.textContent = name;

        const content = document.getElementById('twNpcProfileContent');
        if (!content) return;

        // Bio
        const bioHtml = fan.bio
            ? `<div class="tw-profile-bio">${this._esc(fan.bio).replace(/\n/g, '<br>')}</div>`
            : `<div class="tw-profile-bio-gen"><button class="glass-btn mini" onclick="Twitter.generateFanBio('${this._esc(fan.id)}',this)">${I18n.t('tw.profile_gen_bio', 'プロフィールを生成')}</button></div>`;

        // フォローボタン
        const followBtnCls = isFollowed ? 'tw-profile-follow-btn tw-profile-followed' : 'tw-profile-follow-btn';
        const followBtnText = isFollowed ? I18n.t('tw.profile_following', 'フォロー中') : I18n.t('tw.profile_follow', 'フォローする');

        // LINE招待ボタン
        const lineInvited = !!fan.lineCharId;
        const lineBtnHtml = lineInvited
            ? `<button class="tw-profile-line-btn" disabled>${I18n.t('tw.profile_invited_to_line', 'LINE招待済み')}</button>`
            : `<button class="tw-profile-line-btn" onclick="Twitter.inviteFanToLine('${this._esc(fan.id)}')">${I18n.t('tw.profile_invite_to_line', 'LINEに招待')}</button>`;

        // タブ
        const tab = this._fanProfileTab || 'tweets';
        const tabTweets = tab === 'tweets' ? ' tw-profile-tab-active' : '';
        const tabReplies = tab === 'replies' ? ' tw-profile-tab-active' : '';
        const tabLikes = tab === 'likes' ? ' tw-profile-tab-active' : '';

        let tabContent;
        if (tab === 'replies') {
            tabContent = fanReplies.length === 0
                ? `<div style="text-align:center;padding:40px 0;color:var(--text-secondary);font-size:14px;">${I18n.t('tw.profile_empty_replies', 'まだ返信がありません')}</div>`
                : fanReplies.slice(0, 30).map(({ reply: r, parentTweet: tw }) => {
                    const parentIdentity = this._resolveTweetIdentity(tw, true);
                    return `<div class="tw-npc-reply-card">
    <div class="tw-npc-reply-context"><span style="color:var(--text-secondary);font-size:12px;">${I18n.t('tw.profile_reply_context', {name: this._esc(parentIdentity.name)})}</span></div>
    <div class="tw-reply" style="border:none;padding-top:4px;">
        <div class="tw-reply-avatar" style="background:${color};">${this._esc(letter)}</div>
        <div class="tw-reply-body">
            <div class="tw-card-header">
                <span class="tw-name">${this._esc(name)}</span>
                <span class="tw-handle">${this._esc(handle)}</span>
                <span class="tw-time-sep">·</span>
                <span class="tw-time">${this._timeAgo(r.timestamp)}</span>
            </div>
            <div class="tw-content">${this._linkifyContent(r.content)}</div>
        </div>
    </div>
</div>`;
                }).join('');
        } else if (tab === 'likes') {
            tabContent = `<div style="text-align:center;padding:40px 0;color:var(--text-secondary);font-size:14px;">
    <div style="font-size:32px;margin-bottom:8px;">${this._svg.heart}</div>
    ${I18n.t('tw.empty_no_search_likes', 'いいね情報は非公開です')}
</div>`;
        } else {
            tabContent = tweetCount === 0
                ? `<div style="text-align:center;padding:40px 0;color:var(--text-secondary);font-size:14px;">${I18n.t('tw.empty_no_tweets', 'まだツイートがありません')}</div>`
                : fanTweets.map(tw => this._renderTweetCard(tw, true, true)).join('');
        }

        // フォロワー数（ハッシュ生成）
        const followerCount = this._genFollowerCount(fan.id);
        const followingCount = this._genFollowingCount(fan.id);
        const joinDate = this._genJoinDate(fan.id);
        const bannerGrad = color;
        const esc = (s) => this._esc(s);

        // === v2.70.0 doujin_writer 作者信息卡 + pixiv works + 「她的偏好」折叠区 ===
        const isWriter = fan.type === 'doujin_writer';
        let writerInfoHtml = '';
        let pixivWorksHtml = '';
        let preferencesHtml = '';

        if (isWriter) {
            const styles = AppState.data.pixivData?.settings?.writingStyles || [];
            const styleName = (styles.find(s => s.id === fan.writingStyleId) || {}).name || '';

            const promoteLabels = {
                'active': I18n.t('tw.profile_promote_style_active', '営業型'),
                'occasional': I18n.t('tw.profile_promote_style_occasional', 'たまに'),
                'shy': I18n.t('tw.profile_promote_style_shy', '控えめ'),
            };
            const promoteLabel = promoteLabels[fan.promoteStyle] || promoteLabels.occasional;

            const tagsHtml = (fan.contentTags || []).map(tg =>
                `<span class="tw-tag-chip">${esc(tg)}</span>`
            ).join('');

            writerInfoHtml = `
<div class="tw-writer-info-card">
    <div class="tw-writer-row">
        <span class="tw-writer-label">${I18n.t('tw.profile_doujin_writer_label', '文手')}</span>
        ${fan.pixivHandle && fan.pixivHandle !== fan.handle ? `<span class="tw-writer-pixiv">pixiv: ${esc(fan.pixivHandle)}</span>` : ''}
    </div>
    ${styleName ? `<div class="tw-writer-row"><span class="tw-writer-meta-label">${I18n.t('tw.profile_writing_style_label', '文体')}:</span> <span>${esc(styleName)}</span></div>` : ''}
    ${tagsHtml ? `<div class="tw-writer-row"><span class="tw-writer-meta-label">${I18n.t('tw.profile_content_tags_label', '得意ジャンル')}:</span> ${tagsHtml}</div>` : ''}
    <div class="tw-writer-row"><span class="tw-writer-meta-label">${I18n.t('tw.profile_promote_style_label', '性格')}:</span> <span class="tw-promote-chip tw-promote-${fan.promoteStyle || 'occasional'}">${promoteLabel}</span></div>
</div>
            `;

            // pixiv works section
            const novels = (AppState.data.pixivData?.novels || [])
                .filter(n => n.author_npc_id === fan.id)
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

            pixivWorksHtml = `
<div class="tw-pixiv-works-section">
    <div class="tw-pixiv-works-title">${I18n.t('tw.profile_pixiv_works_section', 'pixivの作品')}（${novels.length}）</div>
    ${novels.length === 0 ? `<div class="tw-pixiv-works-empty">${I18n.t('tw.profile_pixiv_works_empty', 'まだ作品がありません')}</div>` :
        novels.slice(0, 10).map(n => `
        <div class="tw-pixiv-work-item" onclick="Twitter._openPixivNovel('${esc(n.id)}')">
            <div class="tw-pixiv-work-title">${esc(n.title)}</div>
            <div class="tw-pixiv-work-meta">${(n.tags || []).slice(0, 3).map(tg => esc(tg)).join(' · ')}</div>
        </div>`).join('')
    }
</div>
            `;

            // 「彼女の好み」折叠区
            const stylesOptions = styles.map(s =>
                `<option value="${esc(s.id)}" ${s.id === fan.writingStyleId ? 'selected' : ''}>${esc(s.name)}</option>`
            ).join('');
            const promoteRadios = ['active', 'occasional', 'shy'].map(p =>
                `<label class="tw-radio-label">
                    <input type="radio" name="prefPromote_${esc(fan.id)}" value="${p}" ${p === fan.promoteStyle ? 'checked' : ''}>
                    ${promoteLabels[p]}
                </label>`
            ).join(' ');

            preferencesHtml = `
<details class="tw-preferences-collapsible">
    <summary class="tw-preferences-summary">${I18n.t('tw.profile_her_preferences', '彼女の好み')}</summary>
    <div class="tw-preferences-body">
        <div class="tw-pref-row">
            <label>${I18n.t('tw.profile_writing_style_label', '文体')}</label>
            <select id="prefStyle_${esc(fan.id)}">
                <option value="">--</option>
                ${stylesOptions}
            </select>
        </div>
        <div class="tw-pref-row">
            <label>${I18n.t('tw.profile_content_tags_label', '得意ジャンル')}</label>
            <input type="text" id="prefTags_${esc(fan.id)}" value="${esc((fan.contentTags || []).join(', '))}" placeholder="comma separated">
        </div>
        <div class="tw-pref-row">
            <label>${I18n.t('tw.profile_promote_style_label', '性格')}</label>
            <div class="tw-radio-group">${promoteRadios}</div>
        </div>
        <div class="tw-pref-row">
            <label>pixiv Handle</label>
            <input type="text" id="prefPixivHandle_${esc(fan.id)}" value="${esc(fan.pixivHandle || '')}" placeholder="@handle">
        </div>
        <div class="tw-pref-row">
            <label>Bio</label>
            <textarea id="prefBio_${esc(fan.id)}" rows="2">${esc(fan.bio || '')}</textarea>
        </div>
        <button class="glass-btn primary" onclick="Twitter.saveFanPreferences('${esc(fan.id)}')">${I18n.t('common.save', '保存')}</button>
    </div>
</details>
            `;
        }

        content.innerHTML = `<div class="tw-profile-banner" style="background:${bannerGrad};">
    <div class="tw-profile-banner-role"></div>
</div>
<div class="tw-profile-info">
    <div class="tw-profile-avatar-row">
        <div class="tw-profile-avatar-wrap" onclick="Twitter._uploadFanAvatar('${esc(fan.id)}')" title="${I18n.t('tw.profile_change_avatar', 'クリックでアバターを変更')}" style="cursor:pointer">
            ${fan.avatarImage
                ? `<img class="tw-profile-avatar tw-avatar-img" src="${Utils.escAttr(fan.avatarImage)}" alt="">`
                : `<div class="tw-profile-avatar" style="background:${color};">${esc(letter)}</div>`}
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
            <button class="tw-profile-dm-btn" onclick="event.stopPropagation();Twitter.openFanDm('${esc(fan.id)}')" title="DM">
                ${this._svg.mailMd}
            </button>
            <button class="${followBtnCls}" onclick="Twitter.toggleFollowFan('${esc(fan.id)}')">${followBtnText}</button>
        </div>
    </div>
    <div class="tw-profile-name">${esc(name)}</div>
    <div class="tw-profile-handle">${esc(handle)}</div>
    <div class="tw-fan-type-badge" style="color:${color};border-color:${color}33;background:${color}11;">${esc(typeLabel)}</div>
    ${bioHtml}
    <div class="tw-profile-meta">📅 ${I18n.t('tw.profile_using_x_since', {date: joinDate})}</div>
    <div class="tw-profile-counts">
        <span><strong>${this._fmtNumComma(followingCount)}</strong> ${I18n.t('tw.profile_following', 'フォロー中')}</span>
        <span><strong>${this._fmtNumComma(followerCount)}</strong> ${I18n.t('tw.profile_followers', 'フォロワー')}</span>
    </div>
    <div style="margin-top:8px;">${lineBtnHtml}</div>
    ${writerInfoHtml}
    ${pixivWorksHtml}
    ${preferencesHtml}
</div>
<div class="tw-profile-tabs">
    <div class="tw-profile-tab${tabTweets}" onclick="Twitter._fanProfileTab='tweets';Twitter.renderFanProfile()">${I18n.t('tw.profile_tab_tweets', 'ツイート')}</div>
    <div class="tw-profile-tab${tabReplies}" onclick="Twitter._fanProfileTab='replies';Twitter.renderFanProfile()">${I18n.t('tw.profile_tab_replies', '返信')}</div>
    <div class="tw-profile-tab${tabLikes}" onclick="Twitter._fanProfileTab='likes';Twitter.renderFanProfile()">${I18n.t('tw.profile_tab_likes', 'いいね')}</div>
</div>
${tabContent}`;
    },

    // ===== v2.70.0 保存「彼女の好み」=====
    saveFanPreferences(fanId) {
        const t = this._ensureData();
        const fan = (t.fanFriends || []).find(f => f.id === fanId);
        if (!fan) return;

        const styleEl = document.getElementById('prefStyle_' + fanId);
        const tagsEl = document.getElementById('prefTags_' + fanId);
        const pixivHandleEl = document.getElementById('prefPixivHandle_' + fanId);
        const bioEl = document.getElementById('prefBio_' + fanId);
        const promoteEl = document.querySelector(`input[name="prefPromote_${fanId}"]:checked`);

        if (styleEl) fan.writingStyleId = styleEl.value || null;
        if (tagsEl) fan.contentTags = tagsEl.value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
        if (pixivHandleEl) fan.pixivHandle = pixivHandleEl.value.trim() || fan.handle;
        if (bioEl) fan.bio = bioEl.value.trim() || null;
        if (promoteEl) fan.promoteStyle = promoteEl.value;

        Utils.saveData();
        Utils.showToast(I18n.t('t.tw_preferences_saved', '✓ 保存しました'));
        this.renderFanProfile();
    },

    // ===== v2.70.0 跳 pixiv 小说阅读器 =====
    _openPixivNovel(novelId) {
        if (typeof PixivNovel !== 'undefined' && PixivNovel.openNovel) {
            PixivNovel.openNovel(novelId);
            return;
        }
        // fallback: set state + navigate
        if (typeof PixivNovel !== 'undefined') {
            PixivNovel.currentNovelId = novelId;
            PixivNovel.currentChapterIdx = 0;
        }
        Navigation.goTo('pixiv-reader');
    },

    _renderFanPreview() {
        const data = this._fanPreviewData;
        if (!data) { Navigation.goTo('twitter'); return; }

        const t = this._ensureData();
        const name = data.name;
        const handle = data.handle;
        const color = data.avatarColor;
        const letter = name.charAt(0).toUpperCase();
        const typeLabel = this._fanTypeLabel(data.type);

        // このfanの全ツイート
        const fanTweets = (t.npcTweets || [])
            .filter(tw => tw.source === 'fan' && tw.authorHandle === data.handle)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        const titleEl = document.getElementById('twNpcProfileTitle');
        if (titleEl) titleEl.textContent = name;

        const content = document.getElementById('twNpcProfileContent');
        if (!content) return;

        const bannerGrad = color;
        const esc = (s) => this._esc(s);
        const followerCount = this._genFollowerCount(data.handle);
        const followingCount = this._genFollowingCount(data.handle);
        const joinDate = this._genJoinDate(data.handle);

        const tweetListHtml = fanTweets.length === 0
            ? `<div style="text-align:center;padding:40px 0;color:var(--text-secondary);font-size:14px;">${I18n.t('tw.empty_no_tweets', 'まだツイートがありません')}</div>`
            : fanTweets.map(tw => this._renderTweetCard(tw, true, true)).join('');

        content.innerHTML = `<div class="tw-profile-banner" style="background:${bannerGrad};"></div>
<div class="tw-profile-info">
    <div class="tw-profile-avatar-row">
        <div class="tw-profile-avatar-wrap">
            <div class="tw-profile-avatar" style="background:${color};border:3px solid var(--bg-primary);">${esc(letter)}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
            <button class="tw-profile-follow-btn" onclick="Twitter._saveFanFromPreview()">${I18n.t('tw.profile_add_friend', '友だちに追加')}</button>
        </div>
    </div>
    <div class="tw-profile-name">${esc(name)}</div>
    <div class="tw-profile-handle">${esc(handle)}</div>
    <div class="tw-fan-type-badge" style="color:${color};border-color:${color}33;background:${color}11;">${esc(typeLabel)}</div>
    <div class="tw-profile-meta">📅 ${I18n.t('tw.profile_using_x_since', {date: joinDate})}</div>
    <div class="tw-profile-counts">
        <span><strong>${this._fmtNumComma(followingCount)}</strong> ${I18n.t('tw.profile_following', 'フォロー中')}</span>
        <span><strong>${this._fmtNumComma(followerCount)}</strong> ${I18n.t('tw.profile_followers', 'フォロワー')}</span>
    </div>
</div>
<div class="tw-profile-tabs">
    <div class="tw-profile-tab tw-profile-tab-active">${I18n.t('tw.profile_tab_tweets', 'ツイート')}</div>
</div>
${tweetListHtml}`;
    },

    _saveFanFromPreview() {
        const data = this._fanPreviewData;
        if (!data) return;
        const friend = this.saveFanFriend(data);
        if (friend) {
            // 切换到完整 profile
            this.openFanProfile(friend.id);
        }
    },

    async generateFanBio(fanId, btn) {
        const t = this._ensureData();
        const fan = this._getFanFriend(fanId);
        if (!fan) return;
        if (btn) { btn.disabled = true; btn.textContent = I18n.t('tw.profile_generating', '生成中...'); }

        try {
            const forumData = AppState.data.forumData || {};
            const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');

            // このfanの過去ツイートを収集
            const fanTweets = (t.npcTweets || [])
                .filter(tw => tw.source === 'fan' && tw.authorHandle === fan.handle)
                .slice(-10)
                .map(tw => tw.content)
                .join('\n');

            const systemPrompt = `あなたはX（Twitter）のユーザープロフィール生成器です。
以下のファンアカウントの自然なプロフィールを日本語で生成してください。

アカウント名: ${fan.name}
ハンドル: ${fan.handle}
タイプ: ${this._fanTypeLabel(fan.type)}

${fanTweets ? '過去のツイート:\n' + fanTweets : ''}

${worldContext ? '関連作品設定:\n' + worldContext : ''}
${Utils.PROMPTS.infoAccessRule()}
ルール:
- 1〜3行の自然なプロフィール文を書くこと
- タイプに合った趣味・活動を含むこと（同人作家なら創作活動、CP厨なら推しカプなど）
- 絵文字を1〜3個自然に含むこと
- 出力はプロフィール文のみ（説明文や前置き不要）`;

            const messages = [{ role: 'user', content: 'このアカウントのプロフィールを生成してください。' }];
            const raw = await Utils.callChatAPI(messages, systemPrompt);
            fan.bio = raw.trim();
            Utils.saveData();
            this.renderFanProfile();
        } catch (e) {
            Utils.showToast(I18n.t('t.tw_gen_failed', '生成失敗：') + e.message);
            if (btn) { btn.disabled = false; btn.textContent = I18n.t('tw.profile_gen_bio', 'プロフィールを生成'); }
        }
    },

    async inviteFanToLine(fanId) {
        const t = this._ensureData();
        const fan = this._getFanFriend(fanId);
        if (!fan || fan.lineCharId) return;

        Utils.showToast(I18n.t('t.tw_inviting_to_line', {name: fan.name}));

        try {
            const personality = await this._generateFanPersonality(fan);
            const charId = Utils.generateId();
            AppState.data.characters.push({
                id: charId,
                name: fan.name,
                avatar: '',
                personality: personality,
                firstMessage: '',
                worldBookId: null,
                readMessageCount: 10,
                maxMessagesPerReply: 4,
                autoSummaryCount: 20,
                hideAfterSummary: false,
                enableBilingual: false,
                forumLinked: true,
                sourceType: 'twitter-fan',
                sourceFanId: fanId
            });
            fan.lineCharId = charId;
            Utils.saveData();
            Utils.showToast(I18n.t('t.tw_invited_to_line', {name: fan.name}));
            this.renderFanProfile();
        } catch (e) {
            Utils.showToast(I18n.t('t.tw_invite_failed', '招待失敗：') + e.message);
        }
    },

    async _generateFanPersonality(fan) {
        const forumData = AppState.data.forumData || {};
        const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
        const t = this._ensureData();

        // DM履歴があれば人格の参考に
        const dmHistory = (t.dms[fan.id] || []).slice(-10).map(m =>
            `${m.role === 'user' ? 'ユーザー' : fan.name}: ${m.content}`
        ).join('\n');

        // 過去のツイート
        const fanTweets = (t.npcTweets || [])
            .filter(tw => tw.source === 'fan' && tw.authorHandle === fan.handle)
            .slice(-8)
            .map(tw => tw.content)
            .join('\n');

        const identity = this._getActiveIdentity();

        const systemPrompt = `以下のTwitterファンアカウントの情報をもとに、LINEチャット用のキャラクター設定プロンプトを日本語で生成してください。

ファン情報:
- 名前: ${fan.name}
- ハンドル: ${fan.handle}
- タイプ: ${this._fanTypeLabel(fan.type)}
${fan.bio ? '- プロフィール: ' + fan.bio : ''}

${fanTweets ? '過去のツイート:\n' + fanTweets : ''}

${dmHistory ? 'DM履歴:\n' + dmHistory : ''}

ユーザーとの関係:
- ユーザーのTwitter上の身分: ${identity.type === 'official' ? '公式スタッフ（' + identity.name + '）' : identity.type === 'personal' ? '一般ファン（' + identity.name + '）' : 'NPC代行（' + identity.name + '）'}
- TwitterのDMを通じて知り合い、LINEで友だちになった

作品設定:
${worldContext || '（未設定 — 具体的なキャラ名・CP・ストーリーを捏造しないこと）'}
${Utils.PROMPTS.infoAccessRule()}
出力ルール:
- 2〜4段落のキャラクター設定プロンプトを書くこと
- 性格、口調、趣味、話し方の特徴を含むこと
- タイプに合った特徴を強調すること（同人作家なら創作活動の話が多い、CP厨なら推しカプへの情熱など）
- ユーザーとの関係性を自然に反映すること
${fan.leakProne ? '- このキャラクターは情報共有欲が強く、内幕情報を聞くと匿名掲示板で共有したがる「舅舅党」タイプです。この性格特徴を自然に設定に含めてください。' : '- このキャラクターは口が堅く、秘密を守るタイプです。'}
- 出力は設定プロンプトのみ（説明や前置き不要）`;

        const messages = [{ role: 'user', content: 'このファンのLINEチャット用キャラクター設定を生成してください。' }];
        return (await Utils.callChatAPI(messages, systemPrompt)).trim();
    },

    _toggleFollow(id) {
        const t = this._ensureData();
        const idx = (t.followedNpcIds || []).indexOf(id);
        if (idx >= 0) {
            t.followedNpcIds.splice(idx, 1);
            Utils.showToast(I18n.t('t.tw_unfollowed', 'フォローを解除しました'));
        } else {
            t.followedNpcIds.push(id);
            Utils.showToast(I18n.t('t.tw_followed', 'フォローしました ✓'));
        }
        Utils.saveData();
    },

    toggleFollowNpc(npcId) {
        this._toggleFollow(npcId);
        this.renderNpcProfile();
    },

    toggleFollowFan(fanId) {
        this._toggleFollow(fanId);
        this.renderFanProfile();
    },

    openFanDm(fanId) {
        this.currentDmNpcId = fanId;
        this.currentDmMode = 'fan';
        Navigation.goTo('twitter-dm');
    },

    _renderFollowingNpcSection() {
        const t = this._ensureData();
        const followedIds = t.followedNpcIds || [];
        if (followedIds.length === 0) return '';
        const chips = followedIds.map(npcId => {
            const npc = this._getNpc(npcId);
            if (!npc) return '';
            const name = npc.name || npc.role;
            const color = this._npcColor(npcId);
            const letter = name.charAt(0).toUpperCase();
            const pnid = this._esc(npcId);
            return `<div class="tw-following-npc-chip" onclick="Twitter.openNpcProfile('${pnid}','twitter')">
    <div class="tw-card-avatar" style="background:${color};width:40px;height:40px;font-size:16px;flex-shrink:0;margin:0 auto;">${this._esc(letter)}</div>
    <div class="tw-following-npc-name">${this._esc(name)}</div>
</div>`;
        }).filter(Boolean).join('');
        if (!chips) return '';
        return `<div class="tw-following-npc-section">
    <div class="tw-spaces-row">${chips}</div>
</div>`;
    },

    // ===== 引用ツイート =====
    _renderQtCard(qt, originalTweet) {
        const authorColor = qt.authorType === 'industry' ? '#794bc4' : (qt.authorType === 'media' ? '#17bf63' : '#888');
        const letter = (qt.authorName || '？').charAt(0).toUpperCase();
        const previewText = (originalTweet.content || '').slice(0, 55) + ((originalTweet.content || '').length > 55 ? '…' : '');
        const likesStr = this._fmtNum(qt.likes || 0);
        return `<div class="tw-qt-card">
    <div class="tw-qt-author">
        <div class="tw-card-avatar" style="background:${authorColor};width:28px;height:28px;font-size:12px;flex-shrink:0;">${this._esc(letter)}</div>
        <span class="tw-name" style="font-size:13px;">${this._esc(qt.authorName || 'ファン')}</span>
        <span class="tw-handle" style="font-size:12px;">${this._esc(qt.authorHandle || '@user')}</span>
    </div>
    <div class="tw-content" style="font-size:14px;margin:6px 0 4px;">${this._linkifyContent(qt.content)}</div>
    <div class="tw-qt-original">
        <div class="tw-qt-preview">${this._esc(previewText)}</div>
    </div>
    <div style="font-size:12px;color:var(--text-secondary);margin-top:6px;">${this._svg.heart} ${likesStr}</div>
</div>`;
    },

    async generateQuoteTweets(tweetId, isNpc) {
        const t = this._ensureData();
        const arr = isNpc ? (t.npcTweets || []) : (t.tweets || []);
        const tweet = arr.find(tw => tw.id === tweetId);
        if (!tweet) return;

        const forumData = AppState.data.forumData || {};
        const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');

        const systemPrompt = `あなたはアニメ作品の日本語Twitter引用ツイート（QT）をシミュレーションしています。
公式ツイートに反応するファン、メディアアカウント、業界関係者からのリアルなQTを生成してください。

作品設定:
${worldContext || '（未設定 — 具体的なキャラ名・CP・ストーリーを捏造しないこと）'}
${Utils.PROMPTS.infoAccessRule()}
元ツイート:
${tweet.content}

ルール:
- 自然なTwitterスタイルの日本語で書くこと
- QTは1-3行、絵文字・顔文字を自然に含めて良い
- ファンリアクション、分析、メディア報道、業界同僚の反応を混ぜること
- 作品設定にないストーリーイベントを捏造しないこと
- 合計3-5件のQTを生成すること

出力フォーマット（厳守、QTごとに1ブロック）:
---QT---
NAME: [発信者名]
HANDLE: [@handle]
TYPE: [fan/media/industry]
CONTENT: [引用コメント]
LIKES: [数字]`;

        const btn = document.getElementById('twGenQtBtn');
        if (btn) { btn.disabled = true; btn.textContent = I18n.t('tw.profile_generating', '生成中...'); }

        try {
            const messages = [{ role: 'user', content: '引用ツイートを生成してください。' }];
            const raw = await Utils.callChatAPI(messages, systemPrompt);
            const blocks = raw.split(/---\s*QT\s*---/i).map(s => s.trim()).filter(Boolean);
            const qts = [];
            for (const block of blocks) {
                const getF = (f) => { const m = block.match(new RegExp(`^${f}:\\s*(.+)`, 'mi')); return m ? m[1].trim() : ''; };
                const name = getF('NAME');
                const handle = getF('HANDLE');
                const type = getF('TYPE') || 'fan';
                const content = getF('CONTENT');
                const likes = parseInt(getF('LIKES')) || Math.floor(50 + Math.random() * 5000);
                if (!content) continue;
                qts.push({ id: Utils.generateId(), authorName: name || 'ファン', authorHandle: handle || '@user', authorType: type, content, likes, timestamp: Date.now() });
            }
            if (qts.length > 0) {
                if (!tweet.quoteTweets) tweet.quoteTweets = [];
                tweet.quoteTweets.push(...qts);
                Utils.saveData();
                this.renderThread();
                Utils.showToast(I18n.t('t.tw_quotes_generated', {n: qts.length}));
            } else {
                Utils.showToast(I18n.t('t.tw_gen_failed_retry', '生成失敗：リトライしてください'));
                if (btn) { btn.disabled = false; btn.textContent = I18n.t('tw.gen_qts_btn', '引用ツイートを生成'); }
            }
        } catch (e) {
            Utils.showToast(I18n.t('t.tw_gen_failed', '生成失敗：') + e.message);
            if (btn) { btn.disabled = false; btn.textContent = I18n.t('tw.gen_qts_btn', '引用ツイートを生成'); }
        }
    },

    // 发推 modal 里的 LIVE 按钮 → 关掉发推弹窗，打开创建 Space
    _openSpaceFromCompose() {
        this.closePostModal();
        this.showCreateSpaceModal();
    },

    showAllSpaces() {
        const t = this._ensureData();
        const modal = document.getElementById('twitterSpaceListModal');
        if (!modal) return;
        const spaces = (t.spaces || []).slice().sort((a, b) => {
            if (a.status === 'live' && b.status !== 'live') return -1;
            if (b.status === 'live' && a.status !== 'live') return 1;
            return (b.startTime || 0) - (a.startTime || 0);
        });
        const listEl = document.getElementById('twSpaceListContent');
        if (!listEl) return;

        // 头部：根据当前身份显示创建按钮 / 引导切换
        const identity = this._getActiveIdentity();
        const isNpc = identity.type === 'npc';
        const headerHtml = isNpc
            ? `<button class="glass-btn primary" style="width:100%;padding:10px;margin-bottom:12px;font-weight:600;" onclick="Twitter.showCreateSpaceModal()">${I18n.t('tw.space_new', '✦ 新しいスペースを開始')}</button>`
            : `<div style="padding:10px 12px;margin-bottom:12px;background:var(--bg-secondary);border-radius:10px;font-size:12px;color:var(--text-secondary);line-height:1.5;">${I18n.t('tw.space_switch_account_hint', 'スペースを開始するには公式 NPC アカウントへ切り替えてください。')}<button onclick="document.getElementById('twitterSpaceListModal').classList.remove('active');Twitter.showIdentityModal();" style="background:none;border:none;color:var(--accent-color);padding:0;margin-left:4px;cursor:pointer;font-size:12px;">${I18n.t('tw.space_switch_account_btn', 'アカウント切替 ›')}</button></div>`;

        if (spaces.length === 0) {
            listEl.innerHTML = headerHtml + `<div style="padding:30px 16px;text-align:center;color:var(--text-secondary);font-size:14px;">${I18n.t('tw.empty_no_spaces', 'スペースはまだありません')}</div>`;
        } else {
            listEl.innerHTML = headerHtml + spaces.map(s => {
                const isLive = s.status === 'live';
                const badge = isLive
                    ? `<span class="tw-space-live-badge" style="margin-bottom:0;"><span class="tw-space-live-dot"></span>${I18n.t('tw.space_live_now', 'ライブ中')}</span>`
                    : `<span class="tw-space-archived-badge" style="margin-bottom:0;">📻</span>`;
                const npc = this._getNpc(s.hostNpcId);
                const hostName = npc ? (npc.name || npc.role) : I18n.t('tw.space_host_default', 'ホスト');
                return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
    <div style="flex:1;min-width:0;cursor:pointer;" onclick="document.getElementById('twitterSpaceListModal').classList.remove('active');Twitter.openSpace('${this._esc(s.id)}')">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">${badge}<span style="font-size:13px;font-weight:600;">${this._esc(s.title)}</span></div>
        <div style="font-size:11px;color:var(--text-secondary);">${this._esc(hostName)} · ${this._formatDate(s.startTime)}</div>
    </div>
    <button class="glass-btn danger-text" style="padding:4px 10px;font-size:12px;flex-shrink:0;" onclick="Twitter.deleteSpace('${this._esc(s.id)}')">${I18n.t('tw.space_delete', '削除')}</button>
</div>`;
            }).join('');
        }
        modal.classList.add('active');
    },

    // ===== 通知（一般タイムライン更新用） =====
    async _generateNotifications() {
        const t = this._ensureData();
        const forumData = AppState.data.forumData || {};
        const identity = this._getActiveIdentity();
        const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
        if (!worldContext) return;

        const systemPrompt = `あなたはX（Twitter）通知システムをシミュレートしています。
アニメ公式アカウントへの通知を生成してください。

アカウント情報: ${identity.name} (${identity.handle})

ワールドコンテキスト（事実のみ使用、捏造禁止）:
${worldContext || '（未設定 — 具体的なキャラ名・CP・ストーリーを捏造しないこと）'}
${Utils.PROMPTS.infoAccessRule()}
ルール：
- 4〜6件の通知を生成
- タイプを混在させる：follow, like, retweet, quote, mention, event
- 送信者名は自然な日本語のハンドル名（ファン・業界人・メディア）
- ワールドコンテキストに存在しないストーリー展開を捏造しないこと
- 日本語で書くこと

出力フォーマット（厳守）:
---NOTIF---
TYPE: [follow/like/retweet/quote/mention/event]
SENDER: [名前]
HANDLE: [@handle]
CONTENT: [通知テキスト、1-2行]
---NOTIF---
TYPE: ...
...`;

        try {
            const messages = [{ role: 'user', content: '通知を生成してください。' }];
            const response = await Utils.callChatAPI(messages, systemPrompt);

            const blocks = response.split(/---NOTIF---/).filter(b => b.trim());
            if (!t.notifications) t.notifications = [];
            const now = Date.now();

            // 推文关联型通知（like/retweet/quote/mention）绑定到最近的推文
            const tweetPool = (t.tweets || []).slice(-10);
            const tweetTypes = new Set(['like', 'retweet', 'quote', 'mention']);

            blocks.forEach((block, i) => {
                const typeMatch = block.match(/TYPE:\s*(.+)/i);
                const senderMatch = block.match(/SENDER:\s*(.+)/i);
                const handleMatch = block.match(/HANDLE:\s*(.+)/i);
                const contentMatch = block.match(/CONTENT:\s*([\s\S]*?)$/im);
                if (!typeMatch || !contentMatch) return;

                const type = typeMatch[1].trim().toLowerCase();
                if (!['follow', 'like', 'retweet', 'quote', 'mention', 'event'].includes(type)) return;

                const targetTweetId = (tweetTypes.has(type) && tweetPool.length > 0)
                    ? tweetPool[Math.floor(Math.random() * tweetPool.length)].id
                    : undefined;

                t.notifications.unshift({
                    id: Utils.generateId(),
                    type,
                    senderName: senderMatch ? senderMatch[1].trim() : I18n.t('tw.notif_user_default', 'ユーザー'),
                    senderHandle: handleMatch ? handleMatch[1].trim() : '@user',
                    content: contentMatch[1].trim().split('\n')[0], // first line only
                    targetTweetId,
                    timestamp: now - i * 60000, // stagger by 1 min
                    isRead: false
                });
            });

            // 最大100件まで保持
            if (t.notifications.length > 100) t.notifications = t.notifications.slice(0, 100);
            this._updateBadges();
            Utils.saveData();
        } catch (e) {
            console.warn('[Twitter Notif]', e);
        }
    },

    // ========================================================
    //  マシュマロ（匿名質問箱）
    // ========================================================

    renderMarshmallow() {
        const t = this._ensureData();
        const content = document.getElementById('twMarshmallowContent');
        if (!content) return;
        const items = (t.marshmallows || []).slice().reverse();

        content.innerHTML = items.length === 0
            ? `<div style="text-align:center;padding:60px 20px;">
                <div style="font-size:48px;margin-bottom:12px;">🍡</div>
                <div style="font-size:15px;color:var(--text-secondary);">${I18n.t('tw.empty_no_marshmallow', 'まだマシュマロが届いていません')}</div>
                <div style="font-size:13px;color:#999;margin-top:6px;">${I18n.t('tw.empty_marshmallow_hint', '「＋」から匿名メッセージを生成できます')}</div>
               </div>`
            : `<div style="padding:12px;">${items.map(m => `
                <div class="tw-marshmallow-card${m.isRead ? '' : ' tw-marshmallow-unread'}" onclick="Twitter.openMarshmallow('${m.id}')">
                    <div class="tw-marshmallow-icon">🍡</div>
                    <div class="tw-marshmallow-body">
                        <div class="tw-marshmallow-q">${this._esc(m.question).substring(0, 80)}${m.question.length > 80 ? '…' : ''}${m.translation ? `<details class="tw-tl-block"><summary class="tw-tl-btn">${I18n.t('tw.action_translate', '訳')}</summary><div class="tw-tl-content">${this._esc(m.translation)}</div></details>` : ''}</div>
                        <div class="tw-marshmallow-meta">${m.answer ? I18n.t('tw.ma_answered', '✅ 回答済み') : I18n.t('tw.ma_unanswered', '💬 未回答')} · ${this._timeAgo(m.timestamp)}</div>
                    </div>
                </div>
            `).join('')}</div>`;
    },

    openMarshmallow(id) {
        const t = this._ensureData();
        const m = t.marshmallows.find(x => x.id === id);
        if (!m) return;
        m.isRead = true;
        Utils.saveData();

        const content = document.getElementById('twMarshmallowContent');
        content.innerHTML = `
            <div style="padding:16px;">
                <button class="tw-service-btn" onclick="Twitter.renderMarshmallow()" style="margin-bottom:16px;">${I18n.t('tw.ma_back', '‹ 戻る')}</button>
                <div class="tw-marshmallow-detail">
                    <div style="font-size:32px;text-align:center;margin-bottom:12px;">🍡</div>
                    <div class="tw-marshmallow-detail-q">${this._esc(m.question)}
                    ${m.translation ? `<details class="tw-tl-block" style="margin-top:8px;"><summary class="tw-tl-btn">${I18n.t('tw.action_translate', '訳')}</summary><div class="tw-tl-content">${this._esc(m.translation)}</div></details>` : ''}
                    </div>
                    <div style="font-size:12px;color:#999;margin-top:6px;">${new Date(m.timestamp).toLocaleString()} · ${I18n.t('tw.ma_anonymous', '匿名')}</div>
                </div>
                ${m.answer
                    ? `<div class="tw-marshmallow-answer">
                        <div style="font-size:12px;color:var(--accent-color);font-weight:600;margin-bottom:6px;">${I18n.t('tw.ma_your_answer', 'あなたの回答')}</div>
                        <div style="line-height:1.7;">${this._esc(m.answer).replace(/\n/g, '<br>')}</div>
                       </div>`
                    : `<div style="margin-top:16px;">
                        <textarea id="marshmallowAnswer" rows="4" placeholder="${I18n.t('tw.ma_answer_placeholder', '回答を入力...')}" style="width:100%;padding:10px;border:1px solid var(--border-medium);border-radius:8px;font-size:14px;resize:vertical;font-family:inherit;"></textarea>
                        <div style="display:flex;gap:8px;margin-top:8px;">
                            <button class="glass-btn primary" onclick="Twitter.answerMarshmallow('${m.id}')" style="flex:1;">${I18n.t('tw.ma_answer_btn', '回答する')}</button>
                            <button class="glass-btn" onclick="Twitter.answerAndTweet('${m.id}')" style="flex:1;">${I18n.t('tw.ma_answer_and_tweet', '回答＆ツイート')}</button>
                        </div>
                       </div>`
                }
            </div>`;
    },

    answerMarshmallow(id) {
        const t = this._ensureData();
        const m = t.marshmallows.find(x => x.id === id);
        if (!m) return;
        const answer = document.getElementById('marshmallowAnswer')?.value?.trim();
        if (!answer) { Utils.showToast(I18n.t('t.tw_enter_answer', '回答を入力してください')); return; }
        m.answer = answer;
        Utils.saveData();
        Utils.showToast(I18n.t('t.tw_answered', '✓ 回答しました'));
        this.openMarshmallow(id);
    },

    answerAndTweet(id) {
        const t = this._ensureData();
        const m = t.marshmallows.find(x => x.id === id);
        if (!m) return;
        const answer = document.getElementById('marshmallowAnswer')?.value?.trim();
        if (!answer) { Utils.showToast(I18n.t('t.tw_enter_answer', '回答を入力してください')); return; }
        m.answer = answer;
        // ツイートとして投稿
        const identity = this._getActiveIdentity();
        t.tweets.unshift({
            id: Utils.generateId(),
            content: `🍡 マシュマロに回答しました\n\nQ: ${m.question}\n\nA: ${answer}`,
            timestamp: Date.now(),
            likes: 0, retweets: 0, replies: [],
            postedAsAccountId: identity.accountId,
            postedAsIdentityType: identity.type,
            postedAsNpcId: identity.type === 'npc' ? identity.npcId : null
        });
        Utils.saveData();
        Utils.showToast(I18n.t('t.tw_answered_and_tweeted', '✓ 回答＆ツイートしました'));
        this.openMarshmallow(id);
    },

    async generateMarshmallows() {
        const t = this._ensureData();
        Utils.showToast(I18n.t('t.tw_marshmallow_generating', '⏳ マシュマロ生成中...'));
        try {
            const forumData = AppState.data.forumData || {};
            const worldCtx = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
            const identity = this._getActiveIdentity();

            const systemPrompt = `あなたはアニメ・同人コミュニティのマシュマロ（匿名質問箱）シミュレーターです。
ファンからの匿名メッセージを3〜5件生成してください。

宛先アカウント: ${identity.name}（@${identity.handle}）
アカウント種別: ${identity.type === 'official' ? '公式アカウント' : '同人ファン'}

${worldCtx ? `作品世界観:\n${worldCtx}\n` : ''}
${Utils.PROMPTS.infoAccessRule()}
${typeof Utils !== 'undefined' ? Utils.getEventContextPrompt(3) : ''}

マシュマロの種類をバランスよく混ぜること：
- 作品への感想・質問（「○○のシーンが好きです！あの時○○はどんな気持ちだったんですか？」）
- 推しへの告白・応援（「○○推しです。毎日元気をもらっています」）
- 創作に関する質問（「どうやって○○を描いているんですか？」「新作の予定は？」）
- 軽い雑談・お悩み相談（「最近ハマった作品ありますか？」）
- たまに変な質問（「○○と○○が戦ったらどっちが勝つ？」）

ルール:
- 設定にないストーリーを捏造しないこと
- 自然な日本語で、匿名ならではの率直さ・親しみやすさを出すこと
- 各メッセージは1〜3文

出力フォーマット（厳守）:
---MARSHMALLOW---
QUESTION: [質問/メッセージ本文]
TRANSLATION: [QUESTIONの中国語（簡体字）翻訳、1行]
`;
            const messages = [{ role: 'user', content: 'マシュマロを生成してください。' }];
            const raw = await Utils.callChatAPI(messages, systemPrompt);

            const blocks = raw.split(/---MARSHMALLOW---/i).filter(b => b.trim());
            let count = 0;
            for (const block of blocks) {
                const qMatch = block.match(/QUESTION:\s*(.+)/i);
                if (!qMatch) continue;
                const tlMatch = block.match(/TRANSLATION:\s*(.+)/i);
                t.marshmallows.push({
                    id: Utils.generateId(),
                    question: qMatch[1].trim(),
                    translation: tlMatch ? tlMatch[1].trim() : null,
                    answer: null,
                    isRead: false,
                    timestamp: Date.now() - Math.floor(Math.random() * 3600000)
                });
                count++;
            }
            if (t.marshmallows.length > 100) t.marshmallows = t.marshmallows.slice(-100);
            Utils.saveData();
            Utils.showToast(I18n.t('t.tw_marshmallow_received', {n: count}));
            this.renderMarshmallow();
        } catch (e) {
            Utils.showToast(I18n.t('t.tw_gen_failed', '生成失敗: ') + e.message);
        }
    },

    // ========================================================
    //  Poipiku（軽量創作共有）
    // ========================================================

    renderPoipiku() {
        const t = this._ensureData();
        const content = document.getElementById('twPoipikuContent');
        if (!content) return;
        const posts = (t.poipikuPosts || []).slice().reverse();

        content.innerHTML = posts.length === 0
            ? `<div style="text-align:center;padding:60px 20px;">
                <div style="font-size:48px;margin-bottom:12px;">🎨</div>
                <div style="font-size:15px;color:var(--text-secondary);">${I18n.t('tw.empty_no_poipiku', 'まだ投稿がありません')}</div>
                <div style="font-size:13px;color:#999;margin-top:6px;">${I18n.t('tw.empty_poipiku_hint', '「＋」から創作を投稿しましょう')}</div>
               </div>`
            : `<div class="tw-poipiku-grid">${posts.map(p => `
                <div class="tw-poipiku-card" onclick="Twitter.openPoipikuPost('${p.id}')">
                    <div class="tw-poipiku-thumb" style="background:${p.coverGradient || 'linear-gradient(135deg,#667eea,#764ba2)'};">
                        <span style="font-size:28px;">${p.emoji || '✏️'}</span>
                    </div>
                    <div class="tw-poipiku-info">
                        <div class="tw-poipiku-title">${this._esc(p.title)}</div>
                        <div class="tw-poipiku-meta">❤️ ${p.likes || 0} · ${this._timeAgo(p.createdAt)}</div>
                    </div>
                </div>
            `).join('')}</div>`;
    },

    openPoipikuPost(id) {
        const t = this._ensureData();
        const post = t.poipikuPosts.find(p => p.id === id);
        if (!post) return;

        const content = document.getElementById('twPoipikuContent');
        content.innerHTML = `
            <div style="padding:16px;">
                <button class="tw-service-btn" onclick="Twitter.renderPoipiku()" style="margin-bottom:16px;">${I18n.t('tw.ma_back', '‹ 戻る')}</button>
                <div class="tw-poipiku-detail-cover" style="background:${post.coverGradient || 'linear-gradient(135deg,#667eea,#764ba2)'};">
                    <span style="font-size:48px;">${post.emoji || '✏️'}</span>
                </div>
                <div style="font-size:18px;font-weight:700;margin:12px 0 4px;">${this._esc(post.title)}</div>
                <div style="font-size:12px;color:#999;margin-bottom:16px;">
                    ${post.type === 'writing' ? I18n.t('tw.pp_type_text_short', '📝 テキスト') : I18n.t('tw.pp_type_art_short', '🎨 イラスト')} · ❤️ ${post.likes || 0} · ${new Date(post.createdAt).toLocaleDateString()}
                </div>
                <div class="tw-poipiku-content">${this._esc(post.content).replace(/\n/g, '<br>')}</div>
                ${post.tags && post.tags.length ? `<div class="tw-poipiku-tags">${post.tags.map(tag => `<span class="tw-poipiku-tag">#${this._esc(tag)}</span>`).join(' ')}</div>` : ''}
                <div style="display:flex;gap:8px;margin-top:16px;">
                    <button class="glass-btn" onclick="Twitter.sharePoipikuToTweet('${post.id}')" style="flex:1;">${I18n.t('tw.pp_share_x', 'Xで共有')}</button>
                    <button class="glass-btn danger" onclick="Twitter.deletePoipikuPost('${post.id}')" style="flex:0;">${I18n.t('tw.pp_delete', '削除')}</button>
                </div>
            </div>`;
    },

    showPoipikuCreateModal() {
        const content = document.getElementById('twPoipikuContent');
        const existingModal = document.querySelector('.tw-poipiku-modal-overlay');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', `
            <div class="tw-poipiku-modal-overlay" onclick="if(event.target===this)this.remove()">
                <div class="modal-window" style="max-width:400px;">
                    <div style="padding:20px;">
                        <div style="font-size:16px;font-weight:700;margin-bottom:16px;">${I18n.t('tw.pp_post', 'Poipiku に投稿')}</div>
                        <input id="poipikuTitle" type="text" placeholder="${I18n.t('tw.pp_title_label', 'タイトル')}" style="width:100%;padding:10px;border:1px solid var(--border-medium);border-radius:8px;font-size:14px;margin-bottom:10px;">
                        <select id="poipikuType" style="width:100%;padding:10px;border:1px solid var(--border-medium);border-radius:8px;font-size:14px;margin-bottom:10px;">
                            <option value="writing">${I18n.t('tw.pp_type_writing', '📝 テキスト（小説断片・ポエム）')}</option>
                            <option value="art">${I18n.t('tw.pp_type_art', '🎨 イラスト（説明文で表現）')}</option>
                        </select>
                        <textarea id="poipikuContent" rows="6" placeholder="${I18n.t('tw.pp_content_placeholder', '本文（創作内容、イラストの説明など）')}" style="width:100%;padding:10px;border:1px solid var(--border-medium);border-radius:8px;font-size:14px;resize:vertical;font-family:inherit;"></textarea>
                        <input id="poipikuTags" type="text" placeholder="${I18n.t('tw.pp_tags_placeholder', 'タグ（スペース区切り）')}" style="width:100%;padding:10px;border:1px solid var(--border-medium);border-radius:8px;font-size:14px;margin-top:10px;">
                        <div style="display:flex;gap:8px;margin-top:12px;">
                            <button class="glass-btn primary" onclick="Twitter.savePoipikuPost()" style="flex:1;">${I18n.t('tw.pp_publish', '投稿')}</button>
                            <button class="glass-btn" onclick="Twitter.generatePoipikuPost()" style="flex:1;">${I18n.t('tw.pp_ai_gen', '🤖 AI生成')}</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
    },

    savePoipikuPost() {
        const title = document.getElementById('poipikuTitle')?.value?.trim();
        const type = document.getElementById('poipikuType')?.value || 'writing';
        const postContent = document.getElementById('poipikuContent')?.value?.trim();
        const tagsRaw = document.getElementById('poipikuTags')?.value?.trim();
        if (!title || !postContent) { Utils.showToast(I18n.t('t.tw_enter_title_and_body', 'タイトルと本文を入力してください')); return; }

        const t = this._ensureData();
        const gradients = [
            'linear-gradient(135deg,#667eea,#764ba2)',
            'linear-gradient(135deg,#f093fb,#f5576c)',
            'linear-gradient(135deg,#4facfe,#00f2fe)',
            'linear-gradient(135deg,#43e97b,#38f9d7)',
            'linear-gradient(135deg,#fa709a,#fee140)',
            'linear-gradient(135deg,#a18cd1,#fbc2eb)',
        ];
        const emojis = type === 'writing' ? ['✏️','📝','📖','💭','🌙'] : ['🎨','🖌️','✨','🌸','💫'];

        t.poipikuPosts.push({
            id: Utils.generateId(),
            title,
            content: postContent,
            type,
            tags: tagsRaw ? tagsRaw.split(/\s+/).filter(Boolean) : [],
            emoji: emojis[Math.floor(Math.random() * emojis.length)],
            coverGradient: gradients[Math.floor(Math.random() * gradients.length)],
            likes: Math.floor(Math.random() * 30) + 5,
            createdAt: Date.now()
        });
        if (t.poipikuPosts.length > 50) t.poipikuPosts = t.poipikuPosts.slice(-50);
        Utils.saveData();
        document.querySelector('.tw-poipiku-modal-overlay')?.remove();
        Utils.showToast(I18n.t('t.tw_posted', '✓ 投稿しました'));
        this.renderPoipiku();
    },

    async generatePoipikuPost() {
        const t = this._ensureData();
        const title = document.getElementById('poipikuTitle')?.value?.trim() || '';
        const type = document.getElementById('poipikuType')?.value || 'writing';
        Utils.showToast(I18n.t('t.tw_ai_generating', '⏳ AI生成中...'));

        try {
            const forumData = AppState.data.forumData || {};
            const worldCtx = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');

            const systemPrompt = `あなたは同人創作者のPoipiku投稿を生成します。
${type === 'writing' ? '短い小説断片・SS・ポエムを書いてください。200〜400字程度。' : 'イラストの説明文（画面構図・色彩・雰囲気を文章で描写）を書いてください。100〜200字程度。'}

${worldCtx ? `作品世界観:\n${worldCtx}\n` : ''}
${Utils.PROMPTS.infoAccessRule()}
${title ? `テーマ/タイトル: ${title}` : '自由テーマ'}

ルール:
- 設定にないストーリーを捏造しないこと
- 日本語で出力（Poipikuは日本のサービス）
- Markdownフォーマットは禁止、プレーンテキストのみ
- ハッシュタグは別途生成不要（本文のみ）

出力フォーマット:
TITLE: [タイトル]
CONTENT: [本文]
TAGS: [タグ1 タグ2 タグ3]`;

            const messages = [{ role: 'user', content: 'Poipiku投稿を生成してください。' }];
            const raw = await Utils.callChatAPI(messages, systemPrompt);

            const titleMatch = raw.match(/TITLE:\s*(.+)/i);
            const contentMatch = raw.match(/CONTENT:\s*([\s\S]+?)(?=TAGS:|$)/i);
            const tagsMatch = raw.match(/TAGS:\s*(.+)/i);

            if (titleMatch) document.getElementById('poipikuTitle').value = titleMatch[1].trim();
            if (contentMatch) document.getElementById('poipikuContent').value = contentMatch[1].trim();
            if (tagsMatch) document.getElementById('poipikuTags').value = tagsMatch[1].trim();

            Utils.showToast(I18n.t('t.tw_gen_done_check', '✓ 生成完了 — 内容を確認して投稿してください'));
        } catch (e) {
            Utils.showToast(I18n.t('t.tw_gen_failed', '生成失敗: ') + e.message);
        }
    },

    sharePoipikuToTweet(postId) {
        const t = this._ensureData();
        const post = t.poipikuPosts.find(p => p.id === postId);
        if (!post) return;
        const identity = this._getActiveIdentity();
        const tags = post.tags && post.tags.length ? '\n' + post.tags.map(t => '#' + t).join(' ') : '';
        t.tweets.unshift({
            id: Utils.generateId(),
            content: `${post.type === 'writing' ? '📝' : '🎨'} Poipikuに投稿しました → 「${post.title}」` + tags,
            timestamp: Date.now(),
            likes: 0, retweets: 0, replies: [],
            postedAsAccountId: identity.accountId,
            postedAsIdentityType: identity.type,
            postedAsNpcId: identity.type === 'npc' ? identity.npcId : null
        });
        Utils.saveData();
        Utils.showToast(I18n.t('t.tw_tweeted', '✓ ツイートしました'));
    },

    deletePoipikuPost(postId) {
        if (!confirm(I18n.t('tw.pp_confirm_delete', 'この投稿を削除しますか？'))) return;
        const t = this._ensureData();
        t.poipikuPosts = t.poipikuPosts.filter(p => p.id !== postId);
        Utils.saveData();
        Utils.showToast(I18n.t('t.tw_deleted_check', '✓ 削除しました'));
        this.renderPoipiku();
    },
};
