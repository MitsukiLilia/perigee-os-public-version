// Perigee OS - 微博模块（中文同人圈生态、v2.71.0）
// 详见 docs/superpowers/specs/2026-05-23-weibo-module-design.md
// 详见 docs/superpowers/plans/2026-05-23-weibo-module-plan.md
//
// 铁律（重申）：
// 1. 所有 LLM 生成内容（NPC bio / 微博 / 评论 / 私信 / 热搜 / 超话描述）强制简体中文
// 2. 默认账户使用通用占位「Perigee 用户」、不指向真实账号
// 3. 沉浸感铁律 — 不加 NPC 管理 UI、自动播种零 toast/modal

const Weibo = {
    currentTab: 'home',
    _homeSubTab: 'follow',
    _discoverSubTab: 'trend',
    _notifSubTab: 'mention',

    // ========== 初始化 + 导航 ==========

    init() {
        this.render();
        this.bindEvents();
        this.applyDarkMode();
        setTimeout(() => this._maybeSeedWeiboNpcs(), 200);
        // 进入微博时扫一遍 broadcast.officialInfo (category=twitter)、零 token 搬运到 info_station NPC
        setTimeout(() => this._scanForBroadcastTweetTranslations(), 300);
    },

    render() {
        this.renderTopBar();
        this.renderHome();
        this.renderDiscover();
        this.renderNotif();
        this.renderProfile();
    },

    bindEvents() {
        const navBtns = document.querySelectorAll('#weibo .wb-nav-btn');
        navBtns.forEach(btn => {
            btn.onclick = () => this.switchTab(btn.dataset.tab);
        });
    },

    // 子页面统一切换（仿真真微博的全屏页面跳转、覆盖底部 nav）
    _openSubScreen(id, innerHtml) {
        const weibo = document.getElementById('weibo');
        if (!weibo) return null;
        // 同 id 已存在就先移除（避免重复）
        const existed = document.getElementById(id);
        if (existed) existed.remove();
        const node = document.createElement('div');
        node.id = id;
        node.className = 'wb-sub-screen';
        node.innerHTML = innerHtml;
        weibo.appendChild(node);
        return node;
    },

    _closeSubScreen(id) {
        const n = document.getElementById(id);
        if (n) n.remove();
    },

    switchTab(tab) {
        this.currentTab = tab;
        document.querySelectorAll('#weibo .wb-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        document.querySelectorAll('#weibo .weibo-tab-screen').forEach(s => s.style.display = s.dataset.tab === tab ? 'block' : 'none');
        this.renderTopBar();
        if (tab === 'home') this.renderHome();
        if (tab === 'discover') this.renderDiscover();
        if (tab === 'notif') this.renderNotif();
        if (tab === 'profile') this.renderProfile();
    },

    renderTopBar() {
        const bar = document.getElementById('weiboTopBar');
        if (!bar) return;
        const titles = {
            home: I18n.t('weibo.top_home', '首页'),
            discover: I18n.t('weibo.top_discover', '发现'),
            notif: I18n.t('weibo.top_notif', '消息'),
            profile: I18n.t('weibo.top_profile', '设置')
        };
        const refreshBtn = this.currentTab === 'home'
            ? `<button class="wb-top-action" id="wbTopRefresh" aria-label="refresh">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            </button>`
            : '';
        // 发微博按钮（铅笔图标）— 所有 tab 都显示、点击进 composer
        const composeBtn = `<button class="wb-top-action" id="wbTopCompose" aria-label="compose">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>`;
        // 返回键纳入顶栏三段流（左）— 整条 top-bar padding-top 已含灵动岛安全区
        const backBtn = `<button class="wb-back-home" id="wbBackHome" aria-label="back">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5L8 12l7 7"/></svg>
        </button>`;
        bar.innerHTML = `${backBtn}<div class="wb-top-title">${titles[this.currentTab] || ''}</div><div class="wb-top-actions">${refreshBtn}${composeBtn}</div>`;
        const bb = document.getElementById('wbBackHome');
        if (bb) bb.onclick = () => Navigation.goTo('desktop');
        const rb = document.getElementById('wbTopRefresh');
        if (rb) rb.onclick = () => this.refreshHome();
        const cb = document.getElementById('wbTopCompose');
        if (cb) cb.onclick = () => this.openComposer();
    },

    refreshHome() {
        // 并发刷新保护 —— 用户在 LLM 请求未回来时再次点刷新会触发竞态种子 / 重复生成 / 数据写花
        if (this._refreshing) {
            Utils.showToast(I18n.t('weibo.refresh_in_progress', '正在刷新中、请稍候片刻'), 2200);
            return;
        }

        // 先扫一遍放送局新转存的推特官情报、零 token 搬运成 info_station 微博（在刷新主流程之前）
        this._scanForBroadcastTweetTranslations();

        const wd = AppState.data.weiboData || {};
        const npcCount = (wd.fanFriends || []).length;
        const cp = AppState.data.broadcast?.cpSettings || {};
        const cpReady = !!(cp.cpCharA || cp.cpCharB || cp.productionName);
        const count = wd.autoGenWeiboCount || 4;

        // NPC 池空：先尝试种子、否则提示用户先去放送局填 CP
        if (npcCount === 0) {
            if (!cpReady) {
                Utils.showToast(I18n.t('weibo.refresh_need_cp', '请先在放送局填写 CP 角色或作品名、用于生成中文圈 NPC'), 4000);
                return;
            }
            this._refreshing = true;
            Utils.showToast(I18n.t('weibo.seeding_npcs', '正在初始化中文圈 NPC、请稍等 10-20 秒...'), 8000);
            this._maybeSeedWeiboNpcs().then(() => {
                return this._generateNpcWeibos(count, '');
            }).then(() => {
                if (this.currentTab === 'home') this.renderHome();
            }).catch(e => {
                console.warn('[Weibo refresh] seed/gen failed', e);
                Utils.showToast(I18n.t('weibo.refresh_failed', '刷新失败：') + (e?.message || 'API 调用出错'), 5000);
            }).finally(() => {
                this._refreshing = false;
            });
            this._maybeSeedHotsearch('').catch(() => {});
            return;
        }

        this._refreshing = true;
        Utils.showToast(I18n.t('weibo.refreshing', '刷新中...'));
        this._generateNpcWeibos(count, '').then(() => {
            if (this.currentTab === 'home') this.renderHome();
        }).catch(e => {
            console.warn('[Weibo refresh]', e);
            Utils.showToast(I18n.t('weibo.refresh_failed', '刷新失败：') + (e?.message || 'API 调用出错'), 5000);
        }).finally(() => {
            this._refreshing = false;
        });
        this._maybeSeedHotsearch('').catch(() => {});
    },

    // ========== Tab 1: 首页（关注 / 推荐 双流） ==========

    renderHome() {
        const screen = document.getElementById('weiboTabHome');
        if (!screen) return;
        const sub = this._homeSubTab || 'follow';
        const followed = this._getFollowedNpcIds();
        const posts = (AppState.data.weiboData?.posts || []);

        // v2.73.9: 排除从搜索结果迁移过来的 post（_fromSearch=true）— 这些只在「我的赞」可见、不污染主 feed
        const visiblePosts = posts.filter(p => !p._fromSearch);
        let list;
        if (sub === 'follow') {
            list = visiblePosts.filter(p => p.npcId === null || followed.includes(p.npcId));
        } else {
            list = [...visiblePosts].sort((a, b) => {
                const verifiedBonus = (this._npcVerified(b.npcId) ? 10 : 0) - (this._npcVerified(a.npcId) ? 10 : 0);
                const likeWeight = ((b.stats?.likes || 0) - (a.stats?.likes || 0)) / 100;
                return (b.createdAt - a.createdAt) + verifiedBonus + likeWeight;
            });
        }

        const subTabs = `
            <div class="wb-home-subtabs">
                <button class="wb-subtab ${sub === 'follow' ? 'active' : ''}" data-sub="follow">${I18n.t('weibo.home_follow', '关注')}</button>
                <button class="wb-subtab ${sub === 'recommend' ? 'active' : ''}" data-sub="recommend">${I18n.t('weibo.home_recommend', '推荐')}</button>
            </div>
        `;

        const empty = sub === 'follow' && list.length === 0
            ? `<div class="wb-home-empty"><span>${I18n.t('weibo.home_empty_follow', '刷光了，去看看更多热门内容吧 →')}</span></div>`
            : '';

        const cards = list.map(p => this._renderPostCard(p)).join('');

        screen.innerHTML = subTabs + empty + `<div class="wb-feed">${cards || ''}</div>`;

        screen.querySelectorAll('.wb-subtab').forEach(btn => {
            btn.onclick = () => {
                this._homeSubTab = btn.dataset.sub;
                this.renderHome();
            };
        });
        this._bindCardActions(screen);
    },

    _getFollowedNpcIds() {
        return (AppState.data.weiboData?.fanFriends || []).filter(f => f.followed).map(f => f.id);
    },

    _npcVerified(npcId) {
        if (!npcId) return false;
        const npc = (AppState.data.weiboData?.fanFriends || []).find(f => f.id === npcId);
        return npc?.verified === true;
    },

    _renderPostCard(post) {
        const account = this._getPostAuthor(post);
        if (!account) return '';

        const time = this._formatTime(post.createdAt);
        const verifiedBadge = (account.verified || account.isVerified) ? '<span class="wb-v-badge">V</span>' : '';
        const sourceText = post.source || I18n.t('weibo.source_web', '微博网页版');

        const typeBadge = this._typeBadge(post.type);
        const body = this._renderPostBody(post);
        const stats = post.stats || { likes: 0, comments: 0, reposts: 0 };

        const followBtnHtml = (post.npcId && !this._isFollowed(post.npcId))
            ? `<button class="wb-follow-btn" data-npc-id="${post.npcId}">${I18n.t('weibo.btn_follow', '关注')}</button>`
            : '';

        return `
            <div class="wb-post-card" data-post-id="${post.id}" data-type="${post.type}">
                <div class="wb-post-head">
                    <div class="wb-avatar" style="background:${account.avatarColor || '#888'}">${(account.avatarLetter || account.name || '?')[0]}</div>
                    <div class="wb-post-meta">
                        <div class="wb-post-name">${this._escapeHtml(account.name)} ${verifiedBadge}</div>
                        <div class="wb-post-sub">${time} · ${this._escapeHtml(sourceText)}</div>
                    </div>
                    ${followBtnHtml}
                </div>
                ${typeBadge}
                <div class="wb-post-body">${body}</div>
                <div class="wb-post-actions">
                    <button class="wb-act wb-act-like ${this._isLikedByMe(post.id) ? 'wb-act-liked' : ''}" data-act="like">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                        <span>${stats.likes || ''}</span>
                    </button>
                    <button class="wb-act wb-act-comment" data-act="comment">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        <span>${stats.comments || ''}</span>
                    </button>
                    <button class="wb-act wb-act-repost" data-act="repost">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                        <span>${stats.reposts || ''}</span>
                    </button>
                    <button class="wb-act wb-act-share" data-act="share">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                    </button>
                </div>
            </div>
        `;
    },

    _getPostAuthor(post) {
        if (post.npcId) {
            return (AppState.data.weiboData?.fanFriends || []).find(f => f.id === post.npcId);
        }
        // 个人账号（wd.accounts）→ fan_friend（wd.fanFriends）→ 放送局官方 NPC（broadcast.officialNpcs）
        // 用户用官方账号发博时 accountId 指向 broadcast.officialNpcs、之前漏了这个 fallback 导致主页空白
        const acc = (AppState.data.weiboData?.accounts || []).find(a => a.id === post.accountId);
        if (acc) return acc;
        const fan = (AppState.data.weiboData?.fanFriends || []).find(f => f.id === post.accountId);
        if (fan) return fan;
        const offNpc = (AppState.data.broadcast?.officialNpcs || []).find(n => n.id === post.accountId);
        if (offNpc) {
            // 返回 acc-like 对象，跟 _getCurrentAccount 内的 official_broadcast 分支保持一致
            return {
                id: offNpc.id,
                name: offNpc.name || offNpc.role || '官方',
                handle: offNpc.handle || ('official_' + (offNpc.id || '').slice(0, 6)),
                avatarLetter: ((offNpc.name || offNpc.role || 'O') + '')[0],
                avatarColor: '#ff8200',
                isVerified: true,
                verified: true,
                officialRole: offNpc.role
            };
        }
        // 搜索结果博文（_searchResults 池）/ 已点赞迁移到 wd.posts 的搜索结果（_fromSearch=true）
        // 这类博文没有 npcId / accountId，只有 authorName / authorHandle，合成 acc-like 对象
        if (post.authorName) {
            return {
                id: 'virtual-' + (post.id || ''),
                name: post.authorName,
                handle: post.authorHandle || ('user_' + String(post.id || '').slice(-4)),
                avatarLetter: (post.authorName + '')[0],
                avatarColor: this._colorFromString(post.authorName),
                isVerified: false,
                verified: false,
                followerCount: post.authorFollowerCount || 0
            };
        }
        return null;
    },

    _isFollowed(npcId) {
        return this._getFollowedNpcIds().includes(npcId);
    },

    _typeBadge(type) {
        // 微博平台无 type badge — 真实代购 / 拼团靠作品 tag (#作品名#) 宣传、不靠平台徽章
        // 情报 / 拼团 / 代购都由内容前缀 / hashtag 自然区分、保留函数空壳兼容老调用点
        return '';
    },

    _renderPostBody(post) {
        let content = this._escapeHtml(post.content || '');
        content = content.replace(/#([^#\n]+)#/g, '<span class="wb-topic-link">#$1#</span>');
        content = content.replace(/@(\S+)/g, '<span class="wb-mention">@$1</span>');

        let extras = '';
        if (post.type === 'long' && post.longContent) {
            // v2.73.0 lofter 联动：if linkedLofterArticleId 有值、点击跳 lofter 详情
            const lofterSlug = post.linkedLofterArticleId
                ? ` data-lofter-id="${post.linkedLofterArticleId}"`
                : '';
            extras += `<div class="wb-long-link"${lofterSlug}><span>${I18n.t('weibo.long_full_text', '全文')} →</span> <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> <span>${I18n.t('weibo.long_web_link', '网页链接')}</span></div>`;
        }
        if (post.type === 'image' && post.images?.length) {
            const grid = post.images.slice(0, 9).map(_ => '<div class="wb-img-placeholder"></div>').join('');
            extras += `<div class="wb-img-grid wb-img-grid-${Math.min(post.images.length, 9)}">${grid}</div>`;
        }
        // v2.72.7: 转发链渲染（支持三种 quote 来源、可叠加中间链）
        // ① post.repostId 指向 wd.posts 里的真原博（用户主动转发或老数据）
        // ② post.repostQuote { author, content } 虚拟原博（LLM 生成、原博不在 wd.posts）
        // ③ post.repostChain [{author, content}] 中间转发者快照（按倒序：最新在前最早在后）
        if (post.type === 'repost') {
            const chainHtml = (post.repostChain || []).map(c =>
                `<div class="wb-repost-chain-item">//@${this._escapeHtml(c.author || '?')}: ${this._escapeHtml(c.content || '')}</div>`
            ).join('');
            let originHtml = '';
            if (post.repostId) {
                const orig = (AppState.data.weiboData?.posts || []).find(p => p.id === post.repostId);
                if (orig) {
                    const origAuthor = this._getPostAuthor(orig);
                    originHtml = `<div class="wb-repost-origin"><span class="wb-repost-origin-author">@${this._escapeHtml(origAuthor?.name || '?')}</span>: ${this._escapeHtml(orig.content)}</div>`;
                }
            } else if (post.repostQuote && post.repostQuote.author) {
                originHtml = `<div class="wb-repost-origin"><span class="wb-repost-origin-author">@${this._escapeHtml(post.repostQuote.author)}</span>: ${this._escapeHtml(post.repostQuote.content || '')}</div>`;
            }
            if (chainHtml || originHtml) {
                extras += `<div class="wb-repost-quote">${chainHtml}${originHtml}</div>`;
            }
        }
        return content + extras;
    },

    _escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    _formatTime(ts) {
        if (!ts) return '';
        const diff = Date.now() - ts;
        if (diff < 60_000) return I18n.t('weibo.time_just_now', '刚刚');
        if (diff < 3600_000) return Math.floor(diff / 60_000) + I18n.t('weibo.time_min_ago', '分钟前');
        if (diff < 86400_000) return Math.floor(diff / 3600_000) + I18n.t('weibo.time_hr_ago', '小时前');
        const d = new Date(ts);
        return `${d.getMonth() + 1}-${d.getDate()}`;
    },

    _bindCardActions(scope) {
        if (!scope) return;
        scope.querySelectorAll('.wb-act-like').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const card = e.target.closest('.wb-post-card');
                const postId = card?.dataset.postId;
                this._handleLike(postId);
            };
        });
        scope.querySelectorAll('.wb-follow-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const npcId = btn.dataset.npcId;
                this._toggleFollow(npcId);
            };
        });
        scope.querySelectorAll('.wb-long-link').forEach(el => {
            el.onclick = (e) => {
                e.stopPropagation();
                // v2.73.0 lofter 联动：data-lofter-id 有值 → 真跳 lofter 详情；否则 toast 占位
                const lofterId = el.dataset.lofterId;
                if (lofterId && typeof Lofter !== 'undefined') {
                    Navigation.goTo('lofter');
                    setTimeout(() => Lofter.openArticleDetail(lofterId), 100);
                } else {
                    Utils.showToast(I18n.t('weibo.toast_lofter_coming_soon', 'lofter 模块即将上线、敬请期待'));
                }
            };
        });
        // 卡片本体点击 → 进详情页（act / follow / long-link 按钮已 stopPropagation 不会触发）
        scope.querySelectorAll('.wb-post-card').forEach(card => {
            card.onclick = (e) => {
                // 兜底：万一某个内部 a/button 没 stopPropagation、跳过
                if (e.target.closest('button, a, .wb-topic-link')) return;
                const postId = card.dataset.postId;
                if (postId) this.openPostDetail(postId);
            };
        });
        // 评论 / 转发 / 分享按钮也跳详情（comment 是最常见入口）
        scope.querySelectorAll('.wb-act-comment, .wb-act-repost').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const card = e.target.closest('.wb-post-card');
                const postId = card?.dataset.postId;
                if (postId) this.openPostDetail(postId);
            };
        });
    },

    // ========== 微博详情页（仿真真微博点开博文看完整内容 + 评论）==========
    // 数据流：notifications.comments[] 按 postId 过滤即可、NPC 反应评论已经入这个数组
    // 新增字段：post.replies 存批量生成时附带的 reply（NPC 发博时同步带 2-3 条评论、仿真感）

    openPostDetail(postId, sortBy = 'hot') {
        const wd = AppState.data.weiboData;
        if (!wd) return;
        // 先在主时间线找、找不到去搜索结果池找（搜索结果点赞前的 transient post）
        let post = (wd.posts || []).find(p => p.id === postId);
        let isSearchResult = false;
        if (!post) {
            post = (this._searchResults || []).find(p => p.id === postId);
            isSearchResult = !!post;
        }
        if (!post) return;

        const author = this._getPostAuthor(post);
        if (!author) return;

        const time = this._formatTime(post.createdAt);
        const verifiedBadge = (author.verified || author.isVerified) ? '<span class="wb-v-badge">V</span>' : '';
        const body = this._renderPostBody(post);
        const stats = post.stats || { likes: 0, comments: 0, reposts: 0 };

        // 评论数据：① post.replies（批量生成时附带、含 likes 字段）② notifications.comments 里 postId 关联的（NPC 反应触发、likes 随机派生）
        const inlineReplies = (post.replies || []).map(r => ({
            id: r.id,
            fromNpcId: r.npcId,
            author: r.author,
            content: r.content,
            createdAt: r.createdAt || post.createdAt,
            likes: r.likes || 0,
            replyToCommentId: r.replyToCommentId || null,
            isOpReply: !!r.isOpReply,
            source: 'inline'
        }));
        const reactionComments = (wd.notifications?.comments || [])
            .filter(c => c.postId === postId)
            .map(c => ({
                id: c.id,
                fromNpcId: c.fromNpcId,
                content: c.content,
                createdAt: c.createdAt,
                likes: c.likes !== undefined ? c.likes : Math.floor(Math.random() * 8),
                replyToCommentId: c.replyToCommentId || null,
                isOpReply: !!c.isOpReply,
                source: 'reaction'
            }));
        // v2.73.10: 按 (fromNpcId, content) 去重 — 同 NPC 在 inlineReply 和 reactionComment 都产生同款评论时（边缘情况）不重复显示
        const all = [...inlineReplies, ...reactionComments];
        const seen = new Set();
        const dedupedAll = all.filter(c => {
            const key = `${c.fromNpcId || ''}|${(c.content || '').slice(0, 40)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        const commentList = dedupedAll.length > 0
            ? this._renderCommentTree(dedupedAll, sortBy)
            : `<div class="wb-detail-empty">${I18n.t('weibo.detail_no_comments', '还没有评论、来抢沙发吧')}</div>`;
        const totalCommentCount = dedupedAll.length;

        const followBtn = (post.npcId && !this._isFollowed(post.npcId))
            ? `<button class="wb-follow-btn" data-npc-id="${post.npcId}">${I18n.t('weibo.btn_follow', '关注')}</button>`
            : '';

        const inner = `
            <div class="wb-modal-bar">
                <button class="wb-modal-close" id="wbDetailBack">‹</button>
                <div class="wb-modal-title">${I18n.t('weibo.detail_title', '微博正文')}</div>
                <span></span>
            </div>
            <div class="wb-modal-body wb-detail-body">
                <div class="wb-detail-head">
                    <div class="wb-avatar wb-avatar-lg" style="background:${author.avatarColor || '#888'}">${(author.avatarLetter || author.name || '?')[0]}</div>
                    <div class="wb-detail-meta">
                        <div class="wb-detail-name">${this._escapeHtml(author.name)} ${verifiedBadge}</div>
                        <div class="wb-detail-sub">${time}</div>
                    </div>
                    ${followBtn}
                </div>
                <div class="wb-detail-content">${body}</div>
                <div class="wb-detail-stats-bar">
                    <span>${I18n.t('weibo.detail_likes', '赞')} ${stats.likes || 0}</span>
                    <span>${I18n.t('weibo.detail_comments', '评论')} ${totalCommentCount}</span>
                    <span>${I18n.t('weibo.detail_reposts', '转发')} ${stats.reposts || 0}</span>
                </div>
                <div class="wb-detail-comment-section">
                    <div class="wb-detail-comment-head">
                        <div class="wb-detail-section-title">${I18n.t('weibo.detail_comment_section', '评论')}</div>
                        <div class="wb-detail-sort-tabs">
                            <button class="wb-detail-sort ${sortBy === 'hot' ? 'active' : ''}" data-sort="hot">${I18n.t('weibo.detail_sort_hot', '按热度')}</button>
                            <button class="wb-detail-sort ${sortBy === 'time' ? 'active' : ''}" data-sort="time">${I18n.t('weibo.detail_sort_time', '按时间')}</button>
                        </div>
                    </div>
                    ${commentList}
                    <div class="wb-detail-more-wrap">
                        <button class="wb-detail-more-btn" id="wbDetailMoreCommentsBtn">${I18n.t('weibo.detail_more_comments', '＋ 加载更多评论')}</button>
                    </div>
                </div>
            </div>
        `;

        const node = this._openSubScreen('wbPostDetailSubScreen', inner);
        if (!node) return;
        document.getElementById('wbDetailBack').onclick = () => this._closeSubScreen('wbPostDetailSubScreen');
        const followEl = node.querySelector('.wb-follow-btn');
        if (followEl) {
            followEl.onclick = (e) => {
                e.stopPropagation();
                this._toggleFollow(followEl.dataset.npcId);
                this._closeSubScreen('wbPostDetailSubScreen');
                this.openPostDetail(postId, sortBy);
            };
        }
        node.querySelectorAll('.wb-detail-sort').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const newSort = btn.dataset.sort;
                if (newSort === sortBy) return;
                this._closeSubScreen('wbPostDetailSubScreen');
                this.openPostDetail(postId, newSort);
            };
        });
        const moreBtn = document.getElementById('wbDetailMoreCommentsBtn');
        if (moreBtn) moreBtn.onclick = () => this._generateMoreCommentsForPost(postId, sortBy);
        node.querySelectorAll('.wb-long-link').forEach(el => {
            el.onclick = () => {
                // v2.73.0 lofter 联动：data-lofter-id 有值 → 真跳；否则 toast 占位
                const lofterId = el.dataset.lofterId;
                if (lofterId && typeof Lofter !== 'undefined') {
                    this._closeSubScreen('wbPostDetailSubScreen');
                    Navigation.goTo('lofter');
                    setTimeout(() => Lofter.openArticleDetail(lofterId), 100);
                } else {
                    Utils.showToast(I18n.t('weibo.toast_lofter_coming_soon', 'lofter 模块即将上线、敬请期待'));
                }
            };
        });

        // 搜索结果博文首次打开：自动触发一次评论生成（如果还没有 replies）
        // 用 setTimeout 让渲染先完成、提示和按钮状态能正确展示
        if (isSearchResult && (!post.replies || post.replies.length === 0)) {
            setTimeout(() => this._generateMoreCommentsForPost(postId, sortBy), 80);
        }
    },

    // 评论树渲染：顶层评论按 sortBy（热度 / 时间）排序、嵌套子评论按 createdAt asc 排
    // v2.73.7: cycle 防御 — LLM 偶尔会让 A 回复 B、B 又回复 A、形成环、不防的话 _renderCommentNode 会无限递归栈溢出
    _renderCommentTree(comments, sortBy = 'hot') {
        const byId = new Map();
        const tops = [];
        const orphans = [];
        // 先建表（每条加 children 数组）
        comments.forEach(c => byId.set(c.id, Object.assign({}, c, { children: [] })));

        // cycle 检测 helper：算 targetId 的祖先链（顺着 replyToCommentId 一路向上）
        const ancestorsOf = (targetId) => {
            const seen = new Set();
            let cur = byId.get(targetId);
            while (cur && cur.replyToCommentId) {
                if (seen.has(cur.id)) break; // safety：祖先链上自己又出现、断
                seen.add(cur.id);
                cur = byId.get(cur.replyToCommentId);
            }
            return seen;
        };

        // 第二遍挂载：有 replyToCommentId 且能找到的进 children、否则作为顶层
        comments.forEach(c => {
            const node = byId.get(c.id);
            if (c.replyToCommentId && byId.has(c.replyToCommentId)) {
                // cycle 防御：本节点 c.id 不能已是 target 的祖先（否则挂载会形成环）
                if (ancestorsOf(c.replyToCommentId).has(c.id)) {
                    orphans.push(node);
                } else {
                    byId.get(c.replyToCommentId).children.push(node);
                }
            } else if (c.replyToCommentId) {
                // 孤儿（parent 不在当前评论池）：当顶层处理
                orphans.push(node);
            } else {
                tops.push(node);
            }
        });
        const allTops = [...tops, ...orphans];
        if (sortBy === 'hot') {
            allTops.sort((a, b) => (b.likes || 0) - (a.likes || 0) || (b.createdAt || 0) - (a.createdAt || 0));
        } else {
            allTops.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        }
        // 嵌套子评论按时间升序（按楼层先后）
        allTops.forEach(t => t.children.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)));
        return allTops.map(t => this._renderCommentNode(t, 0)).join('');
    },

    // v2.73.7: depth 上限作为 safety net — 即使 cycle 检测漏掉边界情况、也不会无限递归
    _renderCommentNode(node, depth) {
        const row = this._renderCommentRow(node, depth);
        if (depth >= 6) return row;
        if (!node.children || node.children.length === 0) return row;
        const childrenHtml = node.children.map(ch => this._renderCommentNode(ch, depth + 1)).join('');
        return row + `<div class="wb-comment-children">${childrenHtml}</div>`;
    },

    _renderCommentRow(comment, depth = 0) {
        const fan = comment.fromNpcId
            ? (AppState.data.weiboData?.fanFriends || []).find(f => f.id === comment.fromNpcId)
            : null;
        // 优先级：fanFriend → comment.author（批量 inline reply 自带的随机昵称）→ 已注销
        const name = fan?.name || comment.author || I18n.t('weibo.comment_unknown_user', '已注销用户');
        const colorBg = fan?.avatarColor || this._colorFromString(name);
        const time = this._formatTime(comment.createdAt);
        const likes = comment.likes || 0;
        const likesHtml = likes > 0
            ? `<span class="wb-comment-likes"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg> ${likes}</span>`
            : '';
        const opBadge = comment.isOpReply
            ? `<span class="wb-comment-op-badge">${I18n.t('weibo.comment_op_badge', '博主')}</span>`
            : '';
        return `
            <div class="wb-comment-row" data-depth="${depth}">
                <div class="wb-avatar wb-avatar-sm" style="background:${colorBg}">${(name || '?')[0]}</div>
                <div class="wb-comment-content">
                    <div class="wb-comment-name">${this._escapeHtml(name)} ${opBadge}</div>
                    <div class="wb-comment-text">${this._escapeHtml(comment.content)}</div>
                    <div class="wb-comment-foot">
                        <span class="wb-comment-time">${time}</span>
                        ${likesHtml}
                    </div>
                </div>
            </div>
        `;
    },

    // ========== 搜索（v2.72.0 → v2.72.1 重写）==========
    // 推特同款模式：输入关键词 + 回车 → 调 1 次 LLM 生成 5-7 条与该词相关的虚拟微博
    // 结果存 this._searchResults（不污染 wd.posts、独立池）
    // 顶部显示「相关超话」入口（如果命中现有 topics）+ 下方显示生成的搜索结果微博
    // 关键词触发点：① 直接输入回车 ② 点击推荐热搜 ③ 点击发现 tab 的热搜 item

    openSearch(initialQuery = '') {
        const inner = `
            <div class="wb-search-bar">
                <button class="wb-modal-close" id="wbSearchBack">‹</button>
                <div class="wb-search-input-wrap">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
                    <input id="wbSearchInput" class="wb-search-input" placeholder="${I18n.t('weibo.search_placeholder', '搜索关键词、回车开始搜索')}" value="${this._escapeHtml(initialQuery)}">
                    <button id="wbSearchClear" class="wb-search-clear" aria-label="clear" style="display:${initialQuery ? 'flex' : 'none'}">✕</button>
                </div>
                <button class="wb-search-go" id="wbSearchGo">${I18n.t('weibo.search_go', '搜索')}</button>
            </div>
            <div class="wb-modal-body wb-search-body" id="wbSearchResults"></div>
        `;
        const node = this._openSubScreen('wbSearchSubScreen', inner);
        if (!node) return;

        const input = document.getElementById('wbSearchInput');
        const clearBtn = document.getElementById('wbSearchClear');
        const goBtn = document.getElementById('wbSearchGo');

        document.getElementById('wbSearchBack').onclick = () => this._closeSubScreen('wbSearchSubScreen');
        clearBtn.onclick = () => {
            input.value = '';
            clearBtn.style.display = 'none';
            this._searchResults = null;
            this._searchQuery = '';
            this._renderSearchLanding();
            input.focus();
        };
        input.oninput = () => {
            clearBtn.style.display = input.value.trim() ? 'flex' : 'none';
        };
        input.onkeydown = (e) => {
            if (e.key === 'Enter') this._doSearch(input.value.trim());
        };
        goBtn.onclick = () => this._doSearch(input.value.trim());

        if (initialQuery) {
            // 带初始关键词进来（点击热搜 / 推荐超话）→ 立刻搜
            this._doSearch(initialQuery);
        } else {
            this._renderSearchLanding();
            setTimeout(() => input.focus(), 50);
        }
    },

    // 空 query 落地页：显示推荐热搜 + 热门超话作为发现入口
    _renderSearchLanding() {
        const container = document.getElementById('wbSearchResults');
        if (!container) return;
        const wd = AppState.data.weiboData;
        const hot = (wd.hotsearch || []).slice(0, 10);
        const topics = (wd.topics || []).slice(0, 8);
        container.innerHTML = `
            <div class="wb-search-section">
                <div class="wb-search-section-title">${I18n.t('weibo.search_recommend_hot', '推荐热搜')}</div>
                ${hot.length === 0
                    ? `<div class="wb-search-empty">${I18n.t('weibo.search_no_hot', '暂无热搜')}</div>`
                    : hot.map((h, i) => `
                        <div class="wb-search-hot-row" data-hot-title="${this._escapeHtml(h.title)}">
                            <span class="wb-hot-rank ${i < 3 ? 'top' : ''}">${i + 1}</span>
                            <span class="wb-hot-title">${this._escapeHtml(h.title)}</span>
                            ${h.tag ? `<span class="wb-hot-tag wb-hot-tag-${h.tag}">${h.tag === 'hot' ? I18n.t('weibo.hot_tag_hot', '热') : h.tag === 'new' ? I18n.t('weibo.hot_tag_new', '新') : I18n.t('weibo.hot_tag_boom', '爆')}</span>` : ''}
                        </div>
                    `).join('')}
            </div>
            <div class="wb-search-section">
                <div class="wb-search-section-title">${I18n.t('weibo.search_recommend_topic', '热门超话')}</div>
                ${topics.length === 0
                    ? `<div class="wb-search-empty">${I18n.t('weibo.search_no_topic', '暂无超话')}</div>`
                    : topics.map(t => this._renderSearchTopicRow(t)).join('')}
            </div>
        `;
        container.querySelectorAll('.wb-search-hot-row').forEach(el => {
            el.onclick = () => this._doSearch(el.dataset.hotTitle);
        });
        container.querySelectorAll('.wb-search-topic-row').forEach(el => {
            el.onclick = () => {
                this._closeSubScreen('wbSearchSubScreen');
                this.openTopic(el.dataset.topicId);
            };
        });
    },

    // 触发搜索：调 LLM 生成 5-7 条与关键词相关的虚拟微博
    async _doSearch(query) {
        const q = (query || '').trim();
        if (!q) return;
        const input = document.getElementById('wbSearchInput');
        if (input && input.value !== q) input.value = q;
        const clearBtn = document.getElementById('wbSearchClear');
        if (clearBtn) clearBtn.style.display = 'flex';

        this._searchQuery = q;
        const container = document.getElementById('wbSearchResults');
        if (!container) return;

        // in-flight guard 防双击触发并发 LLM
        if (this._searching) {
            Utils.showToast(I18n.t('weibo.search_in_progress', '正在搜索中、请稍候'), 1800);
            return;
        }
        this._searching = true;

        container.innerHTML = `
            <div class="wb-search-loading">
                <div class="wb-spinner"></div>
                <div class="wb-search-loading-text">${I18n.t('weibo.search_loading', '正在搜索「{q}」相关微博...').replace('{q}', this._escapeHtml(q))}</div>
            </div>
        `;

        try {
            this._searchResults = await this._generateSearchPosts(q);
            this._renderSearchResultsBody(q);
        } catch (err) {
            console.warn('[Weibo search] failed', err);
            container.innerHTML = `<div class="wb-search-empty">${I18n.t('weibo.search_failed', '搜索失败：')}${err?.message || ''}</div>`;
        } finally {
            this._searching = false;
        }
    },

    // LLM 生成搜索结果微博（推特 _generateSearchTweets 同款模式、改为中文圈语境）
    async _generateSearchPosts(query) {
        const cp = AppState.data.broadcast?.cpSettings || {};
        const worldCtx = this._getWorldContext();
        const merchGate = this._getMerchGate();
        const prompt = `你在模拟中国微博的搜索结果页、用户搜索关键词：「${query}」
请生成 5-7 条与该关键词相关的虚拟微博（来自中文同人圈的不同类型用户）。

【世界观背景】
${worldCtx}
${cp.productionName ? `主要作品：《${cp.productionName}》` : ''}
${cp.cpNickname ? `主要 CP：${cp.cpNickname}` : ''}

【内容要求】
- 所有微博必须与关键词「${query}」明确相关（内容里直接提到、或者围绕该词的话题展开）
- 作者身份混合：同人文手（卡文 / 放片段 / 自宣不必每次）/ 同人画手（草稿 / 局部 / 摆烂）/ CP 粉（抠糖 / 复健 / 整理粮单）/ 普通日常粉（30% 跑题日常）/ 情报站（客观陈述）${merchGate.hasAnyGoods ? ' / 拼团团长（疲惫公事公办）/ 代购（一半代购一半生活）' : ''}
- 包含 1-2 个 #关键词# 或 #相关话题# 超话引用
${merchGate.promptGateText}

【生态底色】
- 中国微博、不是日本推特：半公开广场感、更吵、更碎、更快、情绪更外露、爆发性更强
- 不是营销号、不是 AI 总结、不是宣传文案 — 是真实用户随手发
- 允许活人情绪：累 / 急 / 嘴硬 / 激动 / 犯懒 / 突然破防 / 选择性活跃
- 长度由你按内容自主判断、短帖也是 baseline、不要每条都长

【用语策略】
- 鼓励中文同人圈黑话 >= 圈内梗 >= 普通网络用语、具体用什么词由你按时效性自行判断、避开过气营销词
- 标点可以非常规（「。。。」「！！！」「......」「？？」、emoji 自然散落不刻意）

【底线】
- 不评判其他粉丝群体 / 不贬低其他作品（cp_fan 允许低浓度阴阳对家 CP、但不指向具体 NPC 真名、不要让结果变成撕逼）
- 不主动提及现实政治 / 性别议题

【铁律】必须使用简体中文输出。严禁繁体字、严禁日语整句、严禁英语整句。

【严格输出格式】对每条微博用 ---SWEIBO--- 分隔：
---SWEIBO---
NAME: [作者昵称、中文圈风格、带表情符 / 萌系后缀 / 拼音 / 数字]
HANDLE: [拼音或英文短词、不要 @ 前缀]
TYPE: [fan_writer / fan_artist / cp_fan / daily_fan / info_station / group_organizer / daigou 之一]
FOLLOWER: [粉丝数、500-50000 之间]
CONTENT:
[微博正文、多行均可、必含 #${query}# 或相关超话引用]
LIKES: [点赞数、与粉丝数和内容相关性匹配]
COMMENTS: [评论数]
REPOSTS: [转发数]

输出 5-7 条。不要输出 JSON、不要 markdown 代码块、不要 prefix、不要其他说明文字。`;

        const raw = await this._callLLM(prompt);
        return this._parseSearchPosts(raw);
    },

    _parseSearchPosts(text) {
        if (!text) return [];
        const blocks = text.split(/---\s*SWEIBO\s*---/i).map(s => s.trim()).filter(Boolean);
        const now = Date.now();
        return blocks.map((block, i) => {
            const name = (block.match(/^NAME:\s*(.+)$/m) || [])[1]?.trim() || '匿名用户';
            const handle = (block.match(/^HANDLE:\s*(.+)$/m) || [])[1]?.trim().replace(/^@/, '') || 'user_' + i;
            const rawType = (block.match(/^TYPE:\s*(.+)$/m) || [])[1]?.trim() || 'daily_fan';
            const type = ['fan_writer', 'fan_artist', 'cp_fan', 'daily_fan', 'info_station', 'group_organizer', 'daigou'].includes(rawType) ? rawType : 'daily_fan';
            const fcRaw = parseInt((block.match(/^FOLLOWER:\s*(\d+)/m) || [])[1] || '1000', 10);
            const fc = Math.max(100, Math.min(100000, fcRaw || 1000)); // v2.73.10: 上下限校验、防 LLM 输出 99999999 或 0 等异常值导致 stats 计算炸
            const contentMatch = block.match(/CONTENT:\s*([\s\S]*?)(?=\nLIKES:|$)/i);
            const content = contentMatch ? contentMatch[1].trim() : '';
            if (!content || content.length < 5) return null;
            const likes = parseInt((block.match(/^LIKES:\s*(\d+)/m) || [])[1] || String(Math.floor(fc * 0.03)), 10);
            const comments = parseInt((block.match(/^COMMENTS:\s*(\d+)/m) || [])[1] || String(Math.floor(fc * 0.01)), 10);
            const reposts = parseInt((block.match(/^REPOSTS:\s*(\d+)/m) || [])[1] || String(Math.floor(fc * 0.005)), 10);
            return {
                id: 's_' + this._uuid(),
                source: 'search',
                authorName: name,
                authorHandle: handle,
                authorType: type,
                authorFollowerCount: fc,
                content,
                topicIds: this._extractTopicIds(content),
                createdAt: now - i * 3600000,
                stats: { likes, comments, reposts }
            };
        }).filter(Boolean);
    },

    // 渲染搜索结果：顶部「相关超话」入口 + 下方搜索结果微博卡片
    _renderSearchResultsBody(query) {
        const container = document.getElementById('wbSearchResults');
        if (!container) return;
        const wd = AppState.data.weiboData;
        const qLower = query.toLowerCase();

        // 命中现有超话作为「相关超话」入口
        const matchedTopics = (wd.topics || []).filter(t =>
            (t.name || '').toLowerCase().includes(qLower) ||
            (t.description || '').toLowerCase().includes(qLower)
        ).slice(0, 3);

        const topicSection = matchedTopics.length > 0
            ? `
                <div class="wb-search-section">
                    <div class="wb-search-section-title">${I18n.t('weibo.search_related_topic', '相关超话')}</div>
                    ${matchedTopics.map(t => this._renderSearchTopicRow(t)).join('')}
                </div>
            ` : '';

        const results = this._searchResults || [];
        const resultsSection = results.length > 0
            ? `
                <div class="wb-search-section">
                    <div class="wb-search-section-title">${I18n.t('weibo.search_results_for', '「{q}」的相关微博').replace('{q}', this._escapeHtml(query))}</div>
                    <div class="wb-feed">${results.map(p => this._renderSearchResultCard(p)).join('')}</div>
                </div>
            `
            : `<div class="wb-search-empty">${I18n.t('weibo.search_no_result', '没有找到相关内容')}</div>`;

        container.innerHTML = topicSection + resultsSection;

        container.querySelectorAll('.wb-search-topic-row').forEach(el => {
            el.onclick = () => {
                this._closeSubScreen('wbSearchSubScreen');
                this.openTopic(el.dataset.topicId);
            };
        });
        // 统一走 _bindCardActions：绑定 like / follow / long-link + 卡片整体点击进详情页
        // _handleLike 内部跨池查找（wd.posts → _searchResults 迁移）、所以搜索结果卡片的 like 也自动 work
        this._bindCardActions(container);
    },

    // 搜索结果卡片（独立 schema、不复用 _renderPostCard 因为没有 npcId）
    _renderSearchResultCard(post) {
        const time = this._formatTime(post.createdAt);
        const colorBg = this._colorFromString(post.authorName || 'X');
        const body = this._renderPostBody(post);
        const stats = post.stats || { likes: 0, comments: 0, reposts: 0 };
        const liked = this._isLikedByMe(post.id);
        const fcStr = post.authorFollowerCount >= 10000
            ? Math.round(post.authorFollowerCount / 1000) / 10 + 'w'
            : post.authorFollowerCount;

        return `
            <div class="wb-post-card wb-search-result-card" data-post-id="${post.id}">
                <div class="wb-post-head">
                    <div class="wb-avatar" style="background:${colorBg}">${(post.authorName || '?')[0]}</div>
                    <div class="wb-post-meta">
                        <div class="wb-post-name">${this._escapeHtml(post.authorName)}</div>
                        <div class="wb-post-sub">${fcStr} ${I18n.t('weibo.profile_followers', '粉丝')} · ${time}</div>
                    </div>
                </div>
                <div class="wb-post-body">${body}</div>
                <div class="wb-post-actions">
                    <button class="wb-act wb-act-like ${liked ? 'wb-act-liked' : ''}" data-act="like">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                        <span>${stats.likes || ''}</span>
                    </button>
                    <button class="wb-act" data-act="comment">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        <span>${stats.comments || ''}</span>
                    </button>
                    <button class="wb-act" data-act="repost">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                        <span>${stats.reposts || ''}</span>
                    </button>
                </div>
            </div>
        `;
    },

    _renderSearchTopicRow(topic) {
        const iconChar = topic.type === 'production' ? '《》' : topic.type === 'cp' ? '✕' : '★';
        return `
            <div class="wb-search-topic-row" data-topic-id="${topic.id}">
                <div class="wb-topic-cover" style="background:${topic.coverColor || '#ff8200'}">${iconChar}</div>
                <div class="wb-search-topic-meta">
                    <div class="wb-search-topic-name">#${this._escapeHtml(topic.name)}#</div>
                    <div class="wb-search-topic-stats">${topic.memberCount || 0} ${I18n.t('weibo.topic_members', '成员')} · ${topic.postCount || 0} ${I18n.t('weibo.topic_posts', '帖子')}</div>
                </div>
            </div>
        `;
    },

    // 给 inline reply 的临时 commenter 名字生成稳定的头像底色（同名同色）
    _colorFromString(s) {
        const palette = ['#ff8200', '#ffb142', '#ff6b9d', '#a78bfa', '#5dd5c4', '#62b6cb', '#f6c89f', '#b899f0'];
        let h = 0;
        for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return palette[h % palette.length];
    },

    // 点赞统一入口（主时间线卡片 / 搜索结果卡片 / 我的赞列表 都走这里）
    // 跨池查找：先 wd.posts、找不到去 _searchResults 找 → 迁移到 wd.posts（加 _fromSearch 标记）
    _handleLike(postId) {
        const wd = AppState.data.weiboData;
        if (!wd) return;
        wd.myLikedPostIds = wd.myLikedPostIds || [];
        wd.posts = wd.posts || [];

        let post = wd.posts.find(p => p.id === postId);
        let migratedFromSearch = false;
        if (!post) {
            const sr = (this._searchResults || []).find(p => p.id === postId);
            if (!sr) return;
            // 搜索结果首次点赞：迁移到主时间线、加 _fromSearch 标志便于未来识别来源
            post = Object.assign({}, sr, {
                _fromSearch: true,
                replies: sr.replies || []
            });
            wd.posts.push(post);
            migratedFromSearch = true;
        }
        post.stats = post.stats || { likes: 0, comments: 0, reposts: 0 };
        const idx = wd.myLikedPostIds.indexOf(postId);
        if (idx >= 0) {
            wd.myLikedPostIds.splice(idx, 1);
            post.stats.likes = Math.max(0, post.stats.likes - 1);
        } else {
            wd.myLikedPostIds.push(postId);
            post.stats.likes++;
            if (migratedFromSearch) {
                Utils.showToast(I18n.t('weibo.detail_liked_from_search', '✓ 已点赞、可在「我的赞」查看'));
            }
        }
        Utils.saveData();
        if (this.currentTab === 'home') this.renderHome();
        // v2.73.9: 搜索 sub-screen 重渲染条件改成 element 存在性（之前查 wb-active class、但 _openSubScreen 只设 wb-sub-screen 永远没加 wb-active、搜索结果点赞 UI 永远不刷新）
        if (document.getElementById('wbSearchSubScreen')) {
            const input = document.getElementById('wbSearchInput');
            if (input && input.value) this._renderSearchResultsBody(input.value);
        }
        // v2.73.10: 同步刷新其他打开的 sub-screen（之前只刷 home + search、topic / personal / myLikes 子屏点赞后 UI 不更新、要关闭重开才看到 ❤️ 高亮）
        if (document.getElementById('wbTopicSubScreen') && this._currentTopicId) {
            this.openTopic(this._currentTopicId);
        }
        if (document.getElementById('wbPersonalModal')) {
            this._closeSubScreen('wbPersonalModal');
            this.openPersonalPage();
        }
        if (document.getElementById('wbMyLikesModal')) {
            this._closeSubScreen('wbMyLikesModal');
            this.openMyLikes();
        }
    },

    _isLikedByMe(postId) {
        return (AppState.data.weiboData?.myLikedPostIds || []).includes(postId);
    },

    // 周边闸门：参考 forum.js 1249 / melonbooks.getEventTopicGate 的设计
    // 没有官方周边时不该出现代购 / 拼团 / 周边讨论；只有预告时不该出现到货 / 开箱 / 跑单等
    _getMerchGate() {
        const officialInfo = AppState.data.broadcast?.officialInfo || [];
        const goodsEntries = officialInfo.filter(e => e.category === 'goods');
        const releasedGoods = goodsEntries.filter(e => e.isGoodsRelease);
        return {
            hasAnyGoods: goodsEntries.length > 0,
            hasReleasedGoods: releasedGoods.length > 0,
            // 注入到 prompt 的状态描述（无周边时显式禁止讨论代购 / 拼团等）
            promptGateText: goodsEntries.length === 0
                ? '\n【官方周边状态 — 严守】当前世界观里官方尚未发布任何周边、不要在博文 / 评论里讨论代购 / 拼团 / 周边购买 / 开箱 / 排单 / 跑单 / 限购 / 团长收款等话题（这些话题只在官方有周边发布之后才合理出现）'
                : releasedGoods.length === 0
                ? '\n【官方周边状态】官方已发布周边预告但尚未正式发售、可以蹲货 / 等开团 / 讨论预告、但不要写已经收到货 / 开箱 / 到货反馈 / 跑单已发生等需要货到才存在的话题'
                : ''
        };
    },

    // 详情页「+ 加载更多评论」：调用一次 LLM、生成 5-8 条不同粉丝的中文评论挂到 post.replies
    // 跨池工作：能处理 wd.posts 里的普通博文 + _searchResults 里的搜索结果博文
    async _generateMoreCommentsForPost(postId, sortBy = 'hot') {
        if (this._genMoreCommentsLock) {
            Utils.showToast(I18n.t('weibo.detail_gen_in_progress', '正在生成评论中、请稍候'));
            return;
        }
        const wd = AppState.data.weiboData;
        if (!wd) return;

        let post = (wd.posts || []).find(p => p.id === postId);
        let isSearchResult = false;
        if (!post) {
            post = (this._searchResults || []).find(p => p.id === postId);
            isSearchResult = !!post;
        }
        if (!post) return;
        post.replies = post.replies || [];

        this._genMoreCommentsLock = postId;
        const btn = document.getElementById('wbDetailMoreCommentsBtn');
        if (btn) { btn.disabled = true; btn.textContent = I18n.t('weibo.detail_loading_more', '生成中…'); }

        try {
            const existingNames = new Set();
            post.replies.forEach(r => { if (r.author) existingNames.add(r.author); });
            (wd.notifications?.comments || []).filter(c => c.postId === postId).forEach(c => {
                const fan = (wd.fanFriends || []).find(f => f.id === c.fromNpcId);
                if (fan?.name) existingNames.add(fan.name);
            });

            // 从 fanFriends 池里挑没评论过的、shuffle 后取前 8 个
            const candidates = (wd.fanFriends || [])
                .filter(f => !existingNames.has(f.name))
                .sort(() => Math.random() - 0.5)
                .slice(0, 8);

            if (candidates.length === 0) {
                Utils.showToast(I18n.t('weibo.detail_no_npc_available', '已经没有更多粉丝可以生成评论了'));
                return;
            }

            const worldContext = this._getWorldContext();
            const merchGate = this._getMerchGate();
            const authorObj = this._getPostAuthor(post);
            const authorName = authorObj?.name || '匿名';
            const npcList = candidates.map(f =>
                `・${f.name}（@${f.handle || 'user'}、${f.type || 'daily_fan'}、粉丝 ${f.followerCount || 0}）`
            ).join('\n');
            const dedupList = existingNames.size > 0
                ? `\n【已经评论过的人 — 严禁再次以同名身份出现（但 IS_OP=true 的博主回复除外）】\n${[...existingNames].map(n => '・' + n).join('\n')}\n`
                : '';
            // 已有评论 NAME 列表给 LLM 看（用于 REPLY_TO 嵌套博主回复时引用）
            const existingCommentNames = post.replies.map(r => r.author).filter(Boolean);
            const replyToPool = existingCommentNames.length > 0
                ? `\n【可被博主回复的旧评论 NAME 池】（IS_OP=true 时、REPLY_TO 可指向这里的任一 NAME）\n${existingCommentNames.map(n => '・' + n).join('\n')}\n`
                : '';

            const prompt = `你在模拟中国微博平台同人圈用户的评论行为。给定一条微博、生成 5-8 条不同粉丝/路人的中文评论。

【世界设定】
${worldContext || '（未设定）'}

【博主】${authorName}
【博文】
${post.content || ''}

【可选评论者池】（请从这里挑、每条评论用不同人）
${npcList}
${dedupList}${replyToPool}
【博主嵌套回复（偶尔出现）】
- 偶尔（0-2 条、不每次必出）让博主「${authorName}」回复某条**旧评论**或本批次更早的评论
- 标记方式：IS_OP: true + REPLY_TO: [被回复的评论的 NAME]
- 博主回复一般简短（"嘿嘿"/"刚画完"/"接住了"/"明天发"/"谢谢" 之类）、自然口语
- IS_OP=true 的评论不计入"每条用不同人"限制（博主就是博主）
- 博主回复**只能**回复旧评论池或本批次更早出现的评论、不能回复后面还没出现的

【生态底色】
- 中国微博、不是日本推特：半公开广场感、更吵、更碎、更快、情绪更外露
- 不要营销号 / AI 总结 / 宣传文案口吻、是真实用户随手评论
- 不要每条都认真回应博文 — 真实评论区结构（你自行混合）：
  · ~30% 表情式 / 反应式（情绪外露的短反应）
  · ~30% 跑题 / 抠糖 / 反转（"刚发现 XX 头像换了" 这种）
  · ~30% 问 / 求 / 催 / 嘲（短问句 / 蹲链接 / 催更 / 轻吐槽）
  · ~10% 认真回应博文内容
- 允许叠楼（连续 2-3 条相近情绪的短评）
- 长度跨度大：2-3 字（"蹲" / "+1" / "啊？"）到 15-30 字感想都可以、由你自主判断
- 不要每条都夸博主、不要每条都喊老师、不要每条都跟主题强相关
- 用什么具体口语词 / 网络词 / 梗 — 鼓励中文同人圈黑话 >= 圈内梗 >= 普通网络用语、追求时效性、避开过气营销词、不要刻意"接地气"
- 标点可以非常规（「。。。」「！！！」「......」「？？」、emoji 自然散落）

【底线】
- 简体中文输出、严禁繁体 / 日语 / 英语整句（OOC 等少数 ACG 缩写可保留）
- 不要新闻播报口吻、不要标题党、不要 [话题] [速报] 这种标签
- 不要捏造世界观外的剧情
- LIKES 字段根据评论者粉丝量 + 内容感染力给一个合理整数（0-30）
${merchGate.promptGateText}

输出格式（严格、每条一段、严禁 JSON / markdown / 多余说明）：
---COMMENT---
NAME: [评论者昵称、IS_OP=false 时必须来自评论者池；IS_OP=true 时填博主名「${authorName}」]
HANDLE: [@handle]
LIKES: [整数]
IS_OP: [可选、true 表示这是博主对某条评论的回复；省略 / false 表示普通粉丝评论]
REPLY_TO: [可选、IS_OP=true 时填被回复的评论 NAME；普通评论可省略]
CONTENT: [评论本文]

输出 5-8 条（含 0-2 条博主嵌套回复）。`;

            const raw = await this._callLLM(prompt);
            const blocks = raw.split(/---\s*COMMENT\s*---/i).map(s => s.trim()).filter(Boolean);
            const now = Date.now();
            // 第一遍：建评论对象、记录 nameToId map（这批 + 旧 replies 都算）
            const nameToCommentId = new Map();
            post.replies.forEach(r => { if (r.author) nameToCommentId.set(r.author, r.id); });

            const parsed = blocks.map((b, i) => {
                const name = (b.match(/^NAME:\s*(.+)$/m) || [])[1]?.trim();
                if (!name) return null;
                const handle = (b.match(/^HANDLE:\s*(.+)$/m) || [])[1]?.trim().replace(/^@/, '') || '';
                const likes = parseInt((b.match(/^LIKES:\s*(\d+)/m) || [])[1] || '0', 10);
                const isOpRaw = (b.match(/^IS_OP:\s*(.+)$/m) || [])[1]?.trim().toLowerCase();
                const isOp = isOpRaw === 'true' || isOpRaw === 'yes';
                const replyToName = (b.match(/^REPLY_TO:\s*(.+)$/m) || [])[1]?.trim();
                const contentMatch = b.match(/CONTENT:\s*([\s\S]+?)(?=\n[A-Z_]+:|$)/);
                const content = contentMatch ? contentMatch[1].trim() : '';
                if (!content || content.length < 2) return null;
                const fan = (wd.fanFriends || []).find(f => f.name === name);
                const commentId = this._uuid();
                if (name) nameToCommentId.set(name, commentId);
                return {
                    id: commentId,
                    npcId: fan?.id || null,
                    author: name,
                    handle,
                    content,
                    createdAt: now + i * 1500,
                    likes: Math.max(0, Math.min(likes, 999)),
                    isOpReply: isOp,
                    _replyToName: replyToName || null
                };
            }).filter(Boolean);

            // 第二遍：reply_to name → comment id（找到的设、找不到的当顶层）
            const newComments = parsed.map(c => {
                let replyToCommentId = null;
                if (c._replyToName && nameToCommentId.has(c._replyToName)) {
                    const tgt = nameToCommentId.get(c._replyToName);
                    if (tgt !== c.id) replyToCommentId = tgt; // 防止指向自己
                }
                delete c._replyToName;
                c.replyToCommentId = replyToCommentId;
                return c;
            });

            if (newComments.length === 0) {
                Utils.showToast(I18n.t('weibo.detail_gen_failed', '评论生成失败、请稍后重试'));
                return;
            }

            post.replies.push(...newComments);
            post.stats = post.stats || { likes: 0, comments: 0, reposts: 0 };
            post.stats.comments = (post.stats.comments || 0) + newComments.length;
            if (!isSearchResult) Utils.saveData();

            Utils.showToast(I18n.t('weibo.detail_gen_ok', { n: newComments.length }));
            this._closeSubScreen('wbPostDetailSubScreen');
            this.openPostDetail(postId, sortBy);
        } catch (e) {
            console.error('[Weibo MoreComments]', e);
            Utils.showToast(I18n.t('weibo.detail_gen_failed', '评论生成失败、请稍后重试') + (e.message || ''));
        } finally {
            this._genMoreCommentsLock = null;
            const btnReset = document.getElementById('wbDetailMoreCommentsBtn');
            if (btnReset) { btnReset.disabled = false; btnReset.textContent = I18n.t('weibo.detail_more_comments', '＋ 加载更多评论'); }
        }
    },

    _toggleFollow(npcId) {
        const npc = (AppState.data.weiboData?.fanFriends || []).find(f => f.id === npcId);
        if (!npc) return;
        npc.followed = !npc.followed;
        Utils.saveData();
        if (this.currentTab === 'home') this.renderHome();
        Utils.showToast(npc.followed ? I18n.t('weibo.toast_followed', '已关注') : I18n.t('weibo.toast_unfollowed', '已取消关注'));
    },

    // ========== Tab 4: 我的（仿真真实微博 IMG_1579 一级菜单）==========

    renderProfile() {
        const screen = document.getElementById('weiboTabProfile');
        if (!screen) return;
        const wd = AppState.data.weiboData;
        if (!wd) return;
        const acc = this._getCurrentAccount();
        if (!acc) return;

        screen.innerHTML = `
            <div class="wb-settings-list">
                <div class="wb-me-header" id="wbMeHeader">
                    <div class="wb-avatar wb-avatar-large wb-me-avatar" style="background:${acc.avatarColor}">${(acc.avatarLetter || acc.name || '?')[0]}</div>
                    <div class="wb-me-meta">
                        <div class="wb-me-name">${this._escapeHtml(acc.name)}</div>
                        <div class="wb-me-sub">
                            <span class="wb-renew-badge">${I18n.t('weibo.section_renew', '续费')}</span>
                            ${I18n.t('weibo.section_fans', '{n} 粉丝').replace('{n}', 14)}
                        </div>
                    </div>
                    <span class="wb-chevron">›</span>
                </div>

                <div class="wb-settings-group"></div>

                <div class="wb-settings-row wb-me-row" data-me="member">
                    <span class="wb-me-icon">${this._iconCrown()}</span>
                    <span class="wb-settings-label">${I18n.t('weibo.section_member_center', '会员中心')}</span>
                    <div class="wb-settings-trail">
                        <span class="wb-dot-red"></span>
                        <span class="wb-settings-trail-text">${I18n.t('weibo.section_member_discount', '天天享折扣')}</span>
                    </div>
                </div>
                <div class="wb-settings-row wb-me-row" data-me="settings">
                    <span class="wb-me-icon">${this._iconGear()}</span>
                    <span class="wb-settings-label">${I18n.t('weibo.section_setting', '设置')}</span>
                    <span class="wb-chevron">›</span>
                </div>
                <div class="wb-settings-row wb-me-row" data-me="decorative">
                    <span class="wb-me-icon">${this._iconCrown()}</span>
                    <span class="wb-settings-label">${I18n.t('weibo.section_member_premium', '会员专属设置')}</span>
                </div>
                <div class="wb-settings-row wb-me-row" data-me="dark_mode">
                    <span class="wb-me-icon">${this._iconMoon()}</span>
                    <span class="wb-settings-label">${I18n.t('weibo.section_dark_mode', '深色模式')}</span>
                    <span class="wb-toggle ${wd?.darkMode ? 'on' : ''}"><span class="wb-toggle-knob"></span></span>
                </div>
                <div class="wb-settings-row wb-me-row" data-me="decorative">
                    <span class="wb-me-icon">${this._iconStar()}</span>
                    <span class="wb-settings-label">${I18n.t('weibo.section_my_favorites', '我的收藏')}</span>
                </div>
                <div class="wb-settings-row wb-me-row" data-me="likes">
                    <span class="wb-me-icon">${this._iconThumb()}</span>
                    <span class="wb-settings-label">${I18n.t('weibo.section_my_likes', '我的赞')}</span>
                    <span class="wb-chevron">›</span>
                </div>
                <div class="wb-settings-row wb-me-row" data-me="decorative">
                    <span class="wb-me-icon">${this._iconUser()}</span>
                    <span class="wb-settings-label">${I18n.t('weibo.section_visitors', '主页访客')}</span>
                    <span class="wb-settings-trail-text">${I18n.t('weibo.section_visitors_count', '近期来访 {n}').replace('{n}', 0)}</span>
                </div>
                <div class="wb-settings-row wb-me-row" data-me="decorative">
                    <span class="wb-me-icon">${this._iconClock()}</span>
                    <span class="wb-settings-label">${I18n.t('weibo.section_history', '浏览记录')}</span>
                </div>

                <div class="wb-settings-group"></div>

                <div class="wb-settings-row wb-me-row" data-me="decorative">
                    <span class="wb-me-icon">${this._iconHeadphones()}</span>
                    <span class="wb-settings-label">${I18n.t('weibo.section_support', '客服中心')}</span>
                </div>
                <div class="wb-settings-row wb-me-row" data-me="drafts">
                    <span class="wb-me-icon">${this._iconDoc()}</span>
                    <span class="wb-settings-label">${I18n.t('weibo.section_drafts', '草稿箱')}</span>
                </div>
            </div>
        `;

        // 头像 / 名 row → 个人主页
        document.getElementById('wbMeHeader').onclick = () => this.openPersonalPage();

        // 一级菜单各 row 分发
        screen.querySelectorAll('.wb-me-row').forEach(row => {
            row.onclick = () => {
                const target = row.dataset.me;
                if (target === 'settings') this.openSettingsSubPage();
                else if (target === 'likes') this.openMyLikes();
                else if (target === 'drafts') this.openDrafts();
                else if (target === 'dark_mode') this.toggleDarkMode();
                else Utils.showToast(I18n.t('weibo.toast_decorative', '仿真按钮'));
            };
        });
    },

    // 深色模式 toggle —— 持久化到 weiboData.darkMode、应用到 #weibo 容器
    toggleDarkMode() {
        const wd = AppState.data.weiboData;
        if (!wd) return;
        wd.darkMode = !wd.darkMode;
        Utils.saveData();
        this.applyDarkMode();
        this.renderProfile();
        Utils.showToast(wd.darkMode
            ? I18n.t('weibo.toast_dark_on', '已开启深色模式')
            : I18n.t('weibo.toast_dark_off', '已关闭深色模式'));
    },

    applyDarkMode() {
        const wd = AppState.data.weiboData;
        const weibo = document.getElementById('weibo');
        if (!weibo) return;
        if (wd?.darkMode) weibo.classList.add('wb-dark');
        else weibo.classList.remove('wb-dark');
    },

    // 当前账号查询：支持 personal / fanFriend / broadcast.officialNpcs 三类
    // 返回值统一格式：{id, name, handle, bio, avatarLetter, avatarColor, isVerified, officialRole?, kind}
    _getCurrentAccount() {
        const wd = AppState.data.weiboData;
        if (!wd) return null;
        const accId = wd.currentAccountId;
        if (!accId) return wd.accounts?.[0] ? { ...wd.accounts[0], kind: 'personal' } : null;

        const personal = (wd.accounts || []).find(a => a.id === accId);
        if (personal) return { ...personal, kind: 'personal' };

        const fan = (wd.fanFriends || []).find(f => f.id === accId);
        if (fan) return { ...fan, kind: 'fan' };

        // 放送局制作 NPC（声優 / 制作公司 / 工作室）—— 跨模块共享
        const offNpc = (AppState.data.broadcast?.officialNpcs || []).find(n => n.id === accId);
        if (offNpc) {
            return {
                id: offNpc.id,
                name: offNpc.name || offNpc.role || '官方',
                handle: offNpc.handle || ('official_' + (offNpc.id || '').slice(0, 6)),
                bio: (offNpc.role || '官方') + (offNpc.voicedCharacters?.length ? ' · CV: ' + offNpc.voicedCharacters.join('、') : ''),
                avatarLetter: ((offNpc.name || offNpc.role || 'O') + '')[0],
                avatarColor: '#ff8200',
                isVerified: true,
                verified: true,
                officialRole: offNpc.role,
                kind: 'official_broadcast',
            };
        }

        // fallback
        return wd.accounts?.[0] ? { ...wd.accounts[0], kind: 'personal' } : null;
    },

    // SVG icon helpers（IMG_1579 风格、灰色描边）
    _iconCrown() { return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l4 6 5-9 5 9 4-6v11H3z"/></svg>'; },
    _iconGear() { return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'; },
    _iconMoon() { return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'; },
    _iconStar() { return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'; },
    _iconThumb() { return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>'; },
    _iconUser() { return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'; },
    _iconClock() { return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'; },
    _iconHeadphones() { return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/></svg>'; },
    _iconDoc() { return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'; },

    // ========== 设置二级子页面（点「设置」row 后 modal、IMG_1583 风格）==========

    openSettingsSubPage() {
        const wd = AppState.data.weiboData;
        const acc = this._getCurrentAccount();
        if (!acc) return;
        const draftCount = (wd.drafts || []).length;

        const html = `
                <div class="wb-modal-bar">
                    <button class="wb-modal-close" id="wbSettingsSubBack">‹</button>
                    <div class="wb-modal-title">${I18n.t('weibo.settings_sub_title', '设置')}</div>
                    <span style="width:28px;"></span>
                </div>
                <div class="wb-modal-body wb-settings-sub-body">
                    <div class="wb-settings-row" id="wbSubAccount">
                        <span class="wb-settings-label">${I18n.t('weibo.settings_account', '账号')}</span>
                        <div class="wb-settings-trail">
                            <div class="wb-avatar wb-avatar-tiny" style="background:${acc.avatarColor}">${(acc.avatarLetter || acc.name || '?')[0]}</div>
                            <span class="wb-settings-trail-text">${this._escapeHtml(acc.name)}</span>
                            <span class="wb-chevron">›</span>
                        </div>
                    </div>
                    <div class="wb-settings-row" data-sub="account-security">
                        <span class="wb-settings-label">${I18n.t('weibo.settings_account_security', '账号与安全')}</span>
                        <span class="wb-chevron">›</span>
                    </div>

                    <div class="wb-settings-group"></div>

                    <div class="wb-settings-row" data-sub="api">
                        <span class="wb-settings-label">${I18n.t('weibo.settings_msg', '消息设置')}</span>
                        <span class="wb-chevron">›</span>
                    </div>
                    <div class="wb-settings-row" data-sub="api">
                        <span class="wb-settings-label">${I18n.t('weibo.settings_push', '推送设置')}</span>
                        <span class="wb-chevron">›</span>
                    </div>
                    <div class="wb-settings-row" data-sub="api">
                        <span class="wb-settings-label">${I18n.t('weibo.settings_privacy', '隐私')}</span>
                        <span class="wb-chevron">›</span>
                    </div>
                    <div class="wb-settings-row" data-sub="api">
                        <span class="wb-settings-label">${I18n.t('weibo.settings_general', '通用')}</span>
                        <span class="wb-chevron">›</span>
                    </div>

                    <div class="wb-settings-group"></div>

                    <div class="wb-settings-row" data-sub="drafts">
                        <span class="wb-settings-label">${I18n.t('weibo.btn_drafts', '草稿箱')}</span>
                        <div class="wb-settings-trail">
                            ${draftCount > 0 ? `<span class="wb-settings-trail-text">${draftCount}</span>` : ''}
                            <span class="wb-chevron">›</span>
                        </div>
                    </div>
                    <div class="wb-settings-row" data-sub="reset-pool">
                        <span class="wb-settings-label">${I18n.t('weibo.settings_reset_npc', '重置中文圈 NPC 池')}</span>
                        <span class="wb-chevron">›</span>
                    </div>
                    <div class="wb-settings-row" data-sub="api">
                        <span class="wb-settings-label">${I18n.t('weibo.settings_recommend', '推荐给好友')}</span>
                    </div>
                    <div class="wb-settings-row" data-sub="api">
                        <span class="wb-settings-label">${I18n.t('weibo.settings_rating', '评分鼓励')}</span>
                        <span class="wb-chevron">›</span>
                    </div>
                    <div class="wb-settings-row" data-sub="api">
                        <span class="wb-settings-label">${I18n.t('weibo.settings_about', '关于我们')}</span>
                        <div class="wb-settings-trail">
                            <span class="wb-settings-trail-text">v${typeof Changelog !== 'undefined' && Changelog.CURRENT ? Changelog.CURRENT : '2.73'}</span>
                            <span class="wb-chevron">›</span>
                        </div>
                    </div>

                    <div class="wb-settings-group"></div>

                    <div class="wb-settings-logout">${I18n.t('weibo.settings_logout', '登出当前账号')}</div>
                </div>
        `;
        this._openSubScreen('wbSettingsSubModal', html);

        document.getElementById('wbSettingsSubBack').onclick = () => this._closeSubScreen('wbSettingsSubModal');
        document.getElementById('wbSubAccount').onclick = () => this.openPersonalPage();
        document.querySelectorAll('#wbSettingsSubModal .wb-settings-row[data-sub]').forEach(row => {
            row.onclick = () => {
                const target = row.dataset.sub;
                if (target === 'account-security') this.openAccountManagement();
                else if (target === 'drafts') this.openDrafts();
                else if (target === 'reset-pool') this._confirmResetWeiboPool();
                else this.openApiSettings();
            };
        });
        const logout = document.querySelector('#wbSettingsSubModal .wb-settings-logout');
        if (logout) logout.onclick = () => Utils.showToast(I18n.t('weibo.toast_logout_placeholder', '仿真按钮、不可实际登出'));
    },

    // ========== 我的赞（仿真 IMG_1586 风格）==========

    openMyLikes() {
        const wd = AppState.data.weiboData;
        const likedIds = wd.myLikedPostIds || [];
        const sub = this._myLikesSubTab || 'post';
        const likedPosts = likedIds
            .map(id => (wd.posts || []).find(p => p.id === id))
            .filter(Boolean)
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        const html = `
                <div class="wb-modal-bar">
                    <button class="wb-modal-close" id="wbMyLikesBack">‹</button>
                    <div class="wb-modal-title">${I18n.t('weibo.my_likes_title', '我的赞')}</div>
                    <span style="width:28px;"></span>
                </div>
                <div class="wb-likes-subtabs">
                    <button class="wb-subtab ${sub === 'post' ? 'active' : ''}" data-sub="post">${I18n.t('weibo.my_likes_tab_post', '微博')}</button>
                    <button class="wb-subtab ${sub === 'comment' ? 'active' : ''}" data-sub="comment">${I18n.t('weibo.my_likes_tab_comment', '评论')}</button>
                </div>
                <div class="wb-modal-body" style="padding:0; background:#f5f5f5;">
                    ${sub === 'post'
                        ? (likedPosts.length > 0
                            ? `<div class="wb-feed">${likedPosts.map(p => this._renderPostCard(p)).join('')}</div>`
                            : `<div class="wb-empty">${I18n.t('weibo.my_likes_empty_post', '还没有点赞过微博')}</div>`)
                        : `<div class="wb-empty">${I18n.t('weibo.my_likes_empty_comment', '还没有点赞过评论')}</div>`
                    }
                </div>
        `;
        this._openSubScreen('wbMyLikesModal', html);

        document.getElementById('wbMyLikesBack').onclick = () => this._closeSubScreen('wbMyLikesModal');
        document.querySelectorAll('#wbMyLikesModal .wb-subtab').forEach(btn => {
            btn.onclick = () => {
                this._myLikesSubTab = btn.dataset.sub;
                this._closeSubScreen('wbMyLikesModal');
                this.openMyLikes();
            };
        });
        this._bindCardActions(document.getElementById('wbMyLikesModal'));
    },

    openApiSettings() {
        Navigation.goTo('settings-api');
        setTimeout(() => {
            if (typeof WeiboApiSettings !== 'undefined') WeiboApiSettings.init();
            const card = document.getElementById('weiboApiCard');
            if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
    },

    _confirmResetWeiboPool() {
        if (typeof DataExport !== 'undefined' && DataExport.resetWeiboNpcPool) {
            DataExport.resetWeiboNpcPool();
            this.renderProfile();
            this.renderHome();
        }
    },

    // ========== 个人主页（仿真真实微博、IMG_1582 风格）==========

    openPersonalPage() {
        const wd = AppState.data.weiboData;
        const acc = this._getCurrentAccount();
        if (!acc) return;
        const myPosts = (wd.posts || []).filter(p => p.accountId === acc.id && !p.isDraft);
        const isOfficial = !!acc.officialRole;

        const html = `
                <div class="wb-personal-banner">
                    <button class="wb-personal-back" id="wbPersonalBack" aria-label="back">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5L8 12l7 7"/></svg>
                    </button>
                    <div class="wb-personal-banner-actions">
                        <button class="wb-personal-icon-btn" id="wbPersonalSearch" aria-label="search">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
                        </button>
                        <button class="wb-personal-icon-btn" id="wbPersonalCompose" aria-label="post">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        </button>
                    </div>
                </div>
                <div class="wb-personal-info">
                    <div class="wb-avatar wb-avatar-large wb-personal-avatar" style="background:${acc.avatarColor}">${(acc.avatarLetter || acc.name || '?')[0]}</div>
                    <div class="wb-personal-action-row">
                        <button class="wb-circle-btn" id="wbPersonalCalendar" aria-label="calendar">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        </button>
                        <button class="wb-circle-btn" id="wbPersonalQrcode" aria-label="qr">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="14" y2="21"/><line x1="14" y1="17" x2="17" y2="17"/><line x1="17" y1="21" x2="21" y2="21"/></svg>
                        </button>
                        <button class="wb-circle-btn" id="wbPersonalEditProfile" aria-label="edit profile">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M18 13l4-4"/></svg>
                        </button>
                    </div>
                </div>
                <div class="wb-personal-body">
                    <div class="wb-personal-name">${this._escapeHtml(acc.name)} ${(acc.isVerified || acc.verified) ? '<span class="wb-v-badge">V</span>' : ''}${isOfficial ? ` <span class="wb-official-tag">${this._escapeHtml(acc.officialRole)}</span>` : ''}</div>
                    <div class="wb-personal-bio">${I18n.t('weibo.personal_bio_prefix', '简介：')}${this._escapeHtml(acc.bio || I18n.t('weibo.personal_bio_empty', '这个人很懒、什么都没写'))}</div>
                    <div class="wb-personal-stats">
                        <div class="wb-personal-stat"><b>27</b> <span>${I18n.t('weibo.profile_following', '关注')}</span></div>
                        <div class="wb-personal-stat"><b>14</b> <span>${I18n.t('weibo.profile_followers', '粉丝')}</span></div>
                        <div class="wb-personal-stat"><b>${myPosts.reduce((n, p) => n + (p.stats?.likes || 0), 0)}</b> <span>${I18n.t('weibo.profile_likes', '赞')}</span></div>
                    </div>
                </div>
                <div class="wb-personal-posts-header">
                    <span>${I18n.t('weibo.profile_my_posts', '微博')} ${myPosts.length}</span>
                </div>
                <div class="wb-personal-feed">
                    ${myPosts.map(p => this._renderPostCard(p)).join('') || `<div class="wb-empty">${I18n.t('weibo.profile_empty', '还没有发过微博')}</div>`}
                </div>
        `;
        this._openSubScreen('wbPersonalModal', html);
        const wrapper = document.getElementById('wbPersonalModal');
        if (wrapper) wrapper.classList.add('wb-personal-modal');

        document.getElementById('wbPersonalBack').onclick = () => this._closeSubScreen('wbPersonalModal');
        document.getElementById('wbPersonalCompose').onclick = () => this.openComposer();
        document.getElementById('wbPersonalSearch').onclick = () => this._searchMyPosts();
        document.getElementById('wbPersonalEditProfile').onclick = () => this.openEditProfile();
        document.getElementById('wbPersonalCalendar').onclick = () => Utils.showToast(I18n.t('weibo.toast_decorative', '仿真按钮'));
        document.getElementById('wbPersonalQrcode').onclick = () => Utils.showToast(I18n.t('weibo.toast_decorative', '仿真按钮'));

        this._bindCardActions(document.getElementById('wbPersonalModal'));
    },

    _searchMyPosts() {
        const kw = prompt(I18n.t('weibo.search_my_prompt', '搜索我的微博：'));
        if (!kw) return;
        const wd = AppState.data.weiboData;
        const accId = wd.currentAccountId;
        const results = (wd.posts || []).filter(p =>
            p.accountId === accId && !p.isDraft &&
            (p.content || '').toLowerCase().includes(kw.toLowerCase())
        );
        Utils.showToast(I18n.t('weibo.search_result_count', '找到 {n} 条').replace('{n}', results.length));
    },

    // ========== 编辑个人资料（仿真表单页、IMG_1588 风格）==========

    openEditProfile() {
        const wd = AppState.data.weiboData;
        const accId = wd.currentAccountId;
        const acc = (wd.accounts || []).find(a => a.id === accId);
        if (!acc) {
            Utils.showToast(I18n.t('weibo.edit_official_not_allowed', '官方账号信息不可编辑'));
            return;
        }

        const html = `
                <div class="wb-modal-bar">
                    <button class="wb-modal-close" id="wbEditProfileBack">‹</button>
                    <div class="wb-modal-title">${I18n.t('weibo.edit_profile_title', '编辑个人资料')}</div>
                    <span style="width:28px;"></span>
                </div>
                <div class="wb-modal-body wb-edit-profile-body">
                    <div class="wb-edit-avatar-section">
                        <div class="wb-avatar wb-avatar-xl" style="background:${acc.avatarColor}">${(acc.avatarLetter || acc.name || '?')[0]}</div>
                    </div>
                    <div class="wb-edit-row" data-field="name">
                        <span class="wb-edit-label">${I18n.t('weibo.edit_field_name', '昵称')}</span>
                        <span class="wb-edit-value">${this._escapeHtml(acc.name)}</span>
                        <span class="wb-chevron">›</span>
                    </div>
                    <div class="wb-edit-row" data-field="bio">
                        <span class="wb-edit-label">${I18n.t('weibo.edit_field_bio', '简介')}</span>
                        <span class="wb-edit-value">${this._escapeHtml(acc.bio || I18n.t('weibo.personal_bio_empty', '这个人很懒、什么都没写'))}</span>
                        <span class="wb-chevron">›</span>
                    </div>
                    <div class="wb-settings-group"></div>
                    <div class="wb-edit-row wb-edit-row-decorative">
                        <span class="wb-edit-label">${I18n.t('weibo.edit_field_gender', '性别')}</span>
                        <span class="wb-edit-value">${this._escapeHtml(acc.gender || I18n.t('weibo.edit_unset', '未设置'))}</span>
                        <span class="wb-chevron">›</span>
                    </div>
                    <div class="wb-edit-row wb-edit-row-decorative">
                        <span class="wb-edit-label">${I18n.t('weibo.edit_field_birthday', '生日')}</span>
                        <span class="wb-edit-value">${this._escapeHtml(acc.birthday || I18n.t('weibo.edit_unset', '未设置'))}</span>
                        <span class="wb-chevron">›</span>
                    </div>
                    <div class="wb-edit-row wb-edit-row-decorative">
                        <span class="wb-edit-label">${I18n.t('weibo.edit_field_hometown', '家乡')}</span>
                        <span class="wb-edit-value">${this._escapeHtml(acc.hometown || I18n.t('weibo.edit_other', '其他'))}</span>
                        <span class="wb-chevron">›</span>
                    </div>
                    <div class="wb-edit-row wb-edit-row-decorative">
                        <span class="wb-edit-label">${I18n.t('weibo.edit_field_relation', '感情状态')}</span>
                        <span class="wb-edit-value">${this._escapeHtml(acc.relationStatus || I18n.t('weibo.edit_unset', '不选'))}</span>
                        <span class="wb-chevron">›</span>
                    </div>
                    <div class="wb-settings-group"></div>
                    <div class="wb-edit-row wb-edit-row-decorative">
                        <span class="wb-edit-label">${I18n.t('weibo.edit_field_register', '注册时间')}</span>
                        <span class="wb-edit-value">${new Date(acc.createdAt).toISOString().slice(0, 10)}</span>
                    </div>
                </div>
        `;
        this._openSubScreen('wbEditProfileModal', html);

        document.getElementById('wbEditProfileBack').onclick = () => this._closeSubScreen('wbEditProfileModal');

        document.querySelectorAll('#wbEditProfileModal .wb-edit-row[data-field]').forEach(row => {
            row.onclick = () => {
                const field = row.dataset.field;
                if (field === 'name') {
                    const v = prompt(I18n.t('weibo.edit_prompt_name', '请输入账号名'), acc.name);
                    if (v === null) return;
                    const t = v.trim();
                    if (t) { acc.name = t; acc.avatarLetter = t[0] || 'P'; }
                } else if (field === 'bio') {
                    const v = prompt(I18n.t('weibo.edit_prompt_bio', '请输入简介（可选）'), acc.bio || '');
                    if (v === null) return;
                    acc.bio = v;
                }
                Utils.saveData();
                this._closeSubScreen('wbEditProfileModal');
                this.openEditProfile();
                // 同步刷新底层 profile / personal page
                this.renderProfile();
                if (document.getElementById('wbPersonalModal')) {
                    this._closeSubScreen('wbPersonalModal');
                    this.openPersonalPage();
                }
            };
        });

        document.querySelectorAll('#wbEditProfileModal .wb-edit-row-decorative').forEach(row => {
            row.onclick = () => Utils.showToast(I18n.t('weibo.toast_decorative', '仿真字段、暂不可编辑'));
        });
    },

    // 兼容旧 alias（向后兼容、避免外部其他调用）
    openAccountManagement() {
        this.openAccountSwitcher();
    },

    // ========== Composer + 草稿箱 ==========

    openComposer(editId = null) {
        const wd = AppState.data.weiboData;
        const acc = this._getCurrentAccount();
        if (!acc) return;
        const editing = editId ? (wd.drafts || []).find(d => d.id === editId) : null;

        // 仿真真微博 composer 全屏页面（IMG_1593 风格）
        const initialText = editing ? this._escapeHtml(editing.content) : '';
        const html = `
                <div class="wb-comp-bar">
                    <button class="wb-comp-bar-x" id="wbCompCancel" aria-label="cancel">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                    <div class="wb-comp-bar-avatar-wrap">
                        <div class="wb-avatar wb-avatar-comp" style="background:${acc.avatarColor}">${(acc.avatarLetter || acc.name || '?')[0]}</div>
                    </div>
                    <button class="wb-comp-bar-send" id="wbCompSubmit" aria-label="send">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                </div>
                <div class="wb-comp-area">
                    <textarea id="wbCompText" class="wb-comp-textarea" placeholder="${I18n.t('weibo.compose_placeholder', '写点什么...')}">${initialText}</textarea>
                    <div class="wb-comp-image-grid">
                        <div class="wb-comp-image-plus">
                            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#bbb" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </div>
                    </div>
                    <div class="wb-comp-chips">
                        <div class="wb-comp-chip">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            <span>${I18n.t('weibo.compose_location', '你在哪里？')}</span>
                        </div>
                        <div class="wb-comp-chip">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07M8.46 8.46a5 5 0 0 0 0 7.07M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
                            <span>${I18n.t('weibo.compose_visibility_public', '公开')}</span>
                        </div>
                    </div>
                </div>
                <div class="wb-comp-toolbar-bottom">
                    <button class="wb-comp-tool" data-tool="image" aria-label="image">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    </button>
                    <button class="wb-comp-tool" data-tool="grid" aria-label="grid">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                    </button>
                    <button class="wb-comp-tool" data-tool="mention" aria-label="mention">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>
                    </button>
                    <button class="wb-comp-tool" data-tool="topic" aria-label="topic">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
                    </button>
                    <button class="wb-comp-tool" data-tool="emoji" aria-label="emoji">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                    </button>
                    <div class="wb-comp-toolbar-spacer"></div>
                    <span class="wb-comp-count" id="wbCompCount">0</span>
                    <input type="hidden" id="wbCompType" value="${editing?.type || 'text'}">
                    <button class="wb-comp-draft-btn" id="wbCompDraft" aria-label="save draft">${I18n.t('weibo.compose_save_draft_short', '草稿')}</button>
                </div>
        `;
        this._openSubScreen('wbComposer', html);

        const textarea = document.getElementById('wbCompText');
        const countEl = document.getElementById('wbCompCount');
        const updateCount = () => { if (countEl) countEl.textContent = (textarea?.value || '').length; };
        if (textarea) {
            textarea.oninput = updateCount;
            updateCount();
            setTimeout(() => textarea.focus(), 80);
        }

        document.getElementById('wbCompCancel').onclick = () => this._closeComposer();
        document.getElementById('wbCompSubmit').onclick = () => this._submitPost(editId);
        document.getElementById('wbCompDraft').onclick = () => this._saveDraft(editId);

        // 仿真工具按钮（图片 / 九宫格 / @ / # / 表情）— 暂占位
        document.querySelectorAll('#wbComposer .wb-comp-tool').forEach(btn => {
            btn.onclick = () => {
                const t = btn.dataset.tool;
                if (t === 'topic') {
                    // 插入「##」让用户继续写超话名
                    if (textarea) {
                        const v = textarea.value;
                        const pos = textarea.selectionStart ?? v.length;
                        textarea.value = v.slice(0, pos) + '##' + v.slice(pos);
                        textarea.focus();
                        textarea.setSelectionRange(pos + 1, pos + 1);
                        updateCount();
                    }
                } else if (t === 'mention') {
                    if (textarea) {
                        const v = textarea.value;
                        const pos = textarea.selectionStart ?? v.length;
                        textarea.value = v.slice(0, pos) + '@' + v.slice(pos);
                        textarea.focus();
                        textarea.setSelectionRange(pos + 1, pos + 1);
                        updateCount();
                    }
                } else {
                    Utils.showToast(I18n.t('weibo.toast_decorative', '仿真按钮'));
                }
            };
        });
    },

    _closeComposer() {
        this._closeSubScreen('wbComposer');
    },

    _submitPost(editId = null) {
        const text = document.getElementById('wbCompText').value.trim();
        if (!text) { Utils.showToast(I18n.t('weibo.compose_empty', '内容不能为空')); return; }
        const type = document.getElementById('wbCompType').value;
        const wd = AppState.data.weiboData;
        const accId = wd.currentAccountId;

        const post = {
            id: 'w_' + this._uuid(),
            accountId: accId,
            npcId: null,
            content: text,
            images: [],
            type,
            longContent: type === 'long' ? text : null,
            lofterLinkSlug: type === 'long' ? this._genShortSlug() : null,
            repostId: null,
            repostQuote: null,
            topicIds: this._extractTopicIds(text),
            mentionedAccountIds: [],
            stats: { likes: 0, comments: 0, reposts: 0 },
            source: I18n.t('weibo.source_app', '微博 i.OS 客户端'),
            isDraft: false,
            createdAt: Date.now()
        };

        wd.posts.unshift(post);

        if (editId) {
            wd.drafts = (wd.drafts || []).filter(d => d.id !== editId);
        }

        Utils.saveData();
        this._closeComposer();
        Utils.showToast(I18n.t('weibo.compose_published', '已发布'));
        this.renderProfile();
        this.renderHome();

        // 触发 NPC 互动反应 —— 用户手动切到官方账号发博触发粉丝高反应（70%）、普通账号正常互动
        const acc = this._getCurrentAccount();
        if (acc?.kind === 'official_broadcast') {
            this._triggerOfficialReactions(post);
        } else {
            this._triggerInteractionsForUserPost(post);
        }
    },

    _saveDraft(editId = null) {
        const text = document.getElementById('wbCompText').value.trim();
        if (!text) { Utils.showToast(I18n.t('weibo.compose_empty', '内容不能为空')); return; }
        const type = document.getElementById('wbCompType').value;
        const wd = AppState.data.weiboData;

        if (editId) {
            const existing = (wd.drafts || []).find(d => d.id === editId);
            if (existing) {
                existing.content = text;
                existing.type = type;
                existing.updatedAt = Date.now();
            }
        } else {
            wd.drafts = wd.drafts || [];
            wd.drafts.push({
                id: 'wd_' + this._uuid(),
                content: text,
                type,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
        }

        Utils.saveData();
        this._closeComposer();
        Utils.showToast(I18n.t('weibo.draft_saved', '草稿已保存'));
        this.renderProfile();
    },

    _extractTopicIds(text) {
        const matches = text.match(/#([^#\n]+)#/g) || [];
        return matches.map(m => m.slice(1, -1));
    },

    _genShortSlug() {
        return 't.cn/' + Math.random().toString(36).slice(2, 8);
    },

    _uuid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    },

    openDrafts() {
        const wd = AppState.data.weiboData;
        const drafts = wd.drafts || [];
        if (drafts.length === 0) {
            Utils.showToast(I18n.t('weibo.drafts_empty', '草稿箱是空的'));
            return;
        }
        const html = `
            <div class="wb-modal" id="wbDraftsModal">
                <div class="wb-modal-bar">
                    <button class="wb-modal-close" id="wbDraftsClose">×</button>
                    <div class="wb-modal-title">${I18n.t('weibo.drafts_title', '草稿箱')}</div>
                    <span></span>
                </div>
                <div class="wb-modal-body">
                    ${drafts.map(d => `
                        <div class="wb-draft-item" data-draft-id="${d.id}">
                            <div class="wb-draft-content">${this._escapeHtml((d.content || '').slice(0, 80))}</div>
                            <div class="wb-draft-meta">
                                <span>${this._formatTime(d.updatedAt || d.createdAt)}</span>
                                <button class="wb-draft-delete" data-draft-id="${d.id}">${I18n.t('weibo.drafts_delete', '删除')}</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);

        document.getElementById('wbDraftsClose').onclick = () => document.getElementById('wbDraftsModal').remove();
        document.querySelectorAll('#wbDraftsModal .wb-draft-item').forEach(el => {
            el.onclick = (e) => {
                if (e.target.classList.contains('wb-draft-delete')) return;
                const id = el.dataset.draftId;
                document.getElementById('wbDraftsModal').remove();
                this.openComposer(id);
            };
        });
        document.querySelectorAll('#wbDraftsModal .wb-draft-delete').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = btn.dataset.draftId;
                AppState.data.weiboData.drafts = AppState.data.weiboData.drafts.filter(d => d.id !== id);
                Utils.saveData();
                document.getElementById('wbDraftsModal').remove();
                this.openDrafts();
            };
        });
    },

    // ========== 账号切换 ==========

    openAccountSwitcher() {
        const wd = AppState.data.weiboData;
        // 官方账号合并源：① broadcast.officialNpcs（放送局共享官方人员）+ ② fanFriends.type='official'（兼容旧数据）
        const broadcastOfficials = (AppState.data.broadcast?.officialNpcs || []).map(n => ({
            id: n.id,
            name: n.name || n.role || '官方',
            handle: n.handle || ('official_' + (n.id || '').slice(0, 6)),
            role: n.role || '官方',
            voicedCharacters: n.voicedCharacters || [],
            source: 'broadcast',
        }));
        const fanFriendOfficials = (wd.fanFriends || []).filter(f => f.type === 'official').map(f => ({
            id: f.id,
            name: f.name,
            handle: f.handle,
            role: f.officialRole || '官方',
            avatarColor: f.avatarColor,
            source: 'fan',
        }));
        const officials = [...broadcastOfficials, ...fanFriendOfficials];

        const html = `
                <div class="wb-modal-bar">
                    <button class="wb-modal-close" id="wbAccClose">‹</button>
                    <div class="wb-modal-title">${I18n.t('weibo.account_title', '账号管理')}</div>
                    <span style="width:28px;"></span>
                </div>
                <div class="wb-modal-body" style="padding:0; background:#f5f5f5;">
                    <div class="wb-acc-section-title">${I18n.t('weibo.account_personal', '个人账户')}</div>
                    ${(wd.accounts || []).map(a => `
                        <div class="wb-acc-item ${a.id === wd.currentAccountId ? 'active' : ''}" data-acc-id="${a.id}">
                            <div class="wb-avatar" style="background:${a.avatarColor}">${(a.avatarLetter || a.name)[0]}</div>
                            <div class="wb-acc-name">${this._escapeHtml(a.name)}<small>@${this._escapeHtml(a.handle)}</small></div>
                            ${a.id === wd.currentAccountId ? '<span class="wb-acc-active">✓</span>' : ''}
                        </div>
                    `).join('')}
                    <button class="wb-acc-add" id="wbAccAdd">+ ${I18n.t('weibo.account_add', '添加新账号')}</button>

                    ${officials.length > 0 ? `
                        <div class="wb-acc-section-title">${I18n.t('weibo.account_official', '官方账号')}</div>
                        ${officials.map(o => `
                            <div class="wb-acc-item wb-acc-official ${o.id === wd.currentAccountId ? 'active' : ''}" data-acc-id="${o.id}">
                                <div class="wb-avatar" style="background:${o.avatarColor || '#ff8200'}">${((o.name || o.role || 'O') + '')[0]}</div>
                                <div class="wb-acc-name">${this._escapeHtml(o.name)} <span class="wb-v-badge">V</span><small>@${this._escapeHtml(o.handle)} · ${this._escapeHtml(o.role || '')}</small></div>
                                ${o.id === wd.currentAccountId ? '<span class="wb-acc-active">✓</span>' : ''}
                            </div>
                        `).join('')}
                        <div class="wb-acc-section-hint">${I18n.t('weibo.account_official_hint', '官方账号来自放送局 → 制作 NPC、所有模块共享')}</div>
                    ` : `
                        <div class="wb-acc-section-title">${I18n.t('weibo.account_official', '官方账号')}</div>
                        <div class="wb-acc-empty">${I18n.t('weibo.account_official_empty', '还没有官方账号、可在放送局 → 制作 NPC 添加')}</div>
                    `}
                </div>
        `;
        this._openSubScreen('wbAccountModal', html);

        document.getElementById('wbAccClose').onclick = () => this._closeSubScreen('wbAccountModal');

        document.querySelectorAll('#wbAccountModal .wb-acc-item').forEach(el => {
            el.onclick = () => {
                const id = el.dataset.accId;
                AppState.data.weiboData.currentAccountId = id;
                Utils.saveData();
                this._closeSubScreen('wbAccountModal');
                this.renderProfile();
                Utils.showToast(I18n.t('weibo.account_switched', '已切换账号'));
            };
        });

        document.getElementById('wbAccAdd').onclick = () => {
            const name = prompt(I18n.t('weibo.account_prompt_name', '请输入账号名'));
            if (!name) return;
            const handle = prompt(I18n.t('weibo.account_prompt_handle', '请输入 @ 名（不含 @）'));
            if (!handle) return;
            const newAcc = {
                id: 'acc_' + this._uuid(),
                name: name.trim(),
                handle: handle.trim().replace(/^@/, ''),
                bio: '',
                avatarLetter: name[0],
                avatarColor: this._randomAccountColor(),
                isVerified: false,
                createdAt: Date.now()
            };
            AppState.data.weiboData.accounts.push(newAcc);
            AppState.data.weiboData.currentAccountId = newAcc.id;
            Utils.saveData();
            this._closeSubScreen('wbAccountModal');
            this.renderProfile();
            Utils.showToast(I18n.t('weibo.account_created', '账号已创建并切换'));
        };
    },

    _randomAccountColor() {
        const colors = ['#ff8200', '#ff5544', '#2196f3', '#4caf50', '#9c27b0', '#ff6b9d', '#00bcd4'];
        return colors[Math.floor(Math.random() * colors.length)];
    },

    // ========== Tab 2: 发现（热搜 + 超话 + 热门） ==========

    renderDiscover() {
        const screen = document.getElementById('weiboTabDiscover');
        if (!screen) return;
        const sub = this._discoverSubTab || 'trend';
        const wd = AppState.data.weiboData;

        screen.innerHTML = `
            <div class="wb-discover-search">
                <div class="wb-search-box" id="wbDiscoverSearchEntry">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
                    <span class="wb-search-placeholder">${I18n.t('weibo.discover_search_placeholder', '热搜：搜索关键词')}</span>
                </div>
            </div>
            <div class="wb-discover-subtabs">
                <button class="wb-subtab ${sub === 'trend' ? 'active' : ''}" data-sub="trend">${I18n.t('weibo.discover_trend', '趋势')}</button>
                <button class="wb-subtab ${sub === 'topic' ? 'active' : ''}" data-sub="topic">${I18n.t('weibo.discover_topic', '超话')}</button>
                <button class="wb-subtab ${sub === 'popular' ? 'active' : ''}" data-sub="popular">${I18n.t('weibo.discover_popular', '热门')}</button>
            </div>
            <div class="wb-discover-content" id="wbDiscoverContent"></div>
        `;
        screen.querySelectorAll('.wb-subtab').forEach(btn => {
            btn.onclick = () => {
                this._discoverSubTab = btn.dataset.sub;
                this.renderDiscover();
            };
        });
        const entry = document.getElementById('wbDiscoverSearchEntry');
        if (entry) entry.onclick = () => this.openSearch();
        this._renderDiscoverContent(sub);

        if ((wd.hotsearch || []).length === 0 && sub === 'trend') {
            setTimeout(() => this._maybeSeedHotsearch(), 500);
        }
        if (sub === 'topic') {
            this._maybeSeedTopics();
            this._renderTopicList(document.getElementById('wbDiscoverContent'));
        }
    },

    _renderDiscoverContent(sub) {
        const container = document.getElementById('wbDiscoverContent');
        if (!container) return;
        const wd = AppState.data.weiboData;

        if (sub === 'trend') {
            const hot = wd.hotsearch || [];
            const entries = `
                <div class="wb-quick-entries">
                    <div class="wb-quick-circle">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                        <span>${I18n.t('weibo.entry_ranking', '榜单')}</span>
                    </div>
                    <div class="wb-quick-circle">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <span>${I18n.t('weibo.entry_city', '同城')}</span>
                    </div>
                    <div class="wb-quick-circle">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        <span>${I18n.t('weibo.entry_topic_plaza', '超话社区')}</span>
                    </div>
                </div>
            `;
            const hotsearchHtml = hot.length === 0
                ? `<div class="wb-empty">${I18n.t('weibo.hotsearch_empty', '暂无热搜、剧情更新后会自动生成')}</div>`
                : `
                    <div class="wb-hot-header">
                        <span>${I18n.t('weibo.hotsearch_title', '微博热搜')}</span>
                        <span class="wb-hot-all">${I18n.t('weibo.hotsearch_all', '全部')} ›</span>
                    </div>
                    <div class="wb-hot-list">
                        ${hot.slice(0, 10).map((h, i) => `
                            <div class="wb-hot-item" data-hot-title="${this._escapeHtml(h.title)}">
                                <span class="wb-hot-rank ${i < 3 ? 'top' : ''}">${i + 1}</span>
                                <span class="wb-hot-title">${this._escapeHtml(h.title)}</span>
                                ${h.tag ? `<span class="wb-hot-tag wb-hot-tag-${h.tag}">${h.tag === 'hot' ? I18n.t('weibo.hot_tag_hot', '热') : h.tag === 'new' ? I18n.t('weibo.hot_tag_new', '新') : I18n.t('weibo.hot_tag_boom', '爆')}</span>` : ''}
                            </div>
                        `).join('')}
                    </div>
                `;
            container.innerHTML = entries + hotsearchHtml;
            container.querySelectorAll('.wb-hot-item').forEach(el => {
                el.onclick = () => this.openSearch(el.dataset.hotTitle);
            });
        } else if (sub === 'popular') {
            const posts = (wd.posts || []).slice().sort((a, b) => (b.stats?.likes || 0) - (a.stats?.likes || 0));
            container.innerHTML = posts.length === 0
                ? `<div class="wb-empty">${I18n.t('weibo.popular_empty', '暂无热门、剧情更新后会自动生成')}</div>`
                : `<div class="wb-feed">${posts.slice(0, 20).map(p => this._renderPostCard(p)).join('')}</div>`;
            this._bindCardActions(container);
        }
        // topic 分支由 renderDiscover 调用 _renderTopicList
    },

    _renderTopicList(container) {
        if (!container) return;
        const wd = AppState.data.weiboData;
        const topics = wd.topics || [];
        const followed = wd.followedTopicIds || [];
        if (topics.length === 0) {
            container.innerHTML = `<div class="wb-empty">${I18n.t('weibo.topic_empty', '暂无超话、剧情中加入作品/CP 后会自动生成')}</div>`;
            return;
        }

        const followedTopics = topics.filter(t => followed.includes(t.id));
        const recommendedTopics = topics.filter(t => !followed.includes(t.id));

        container.innerHTML = `
            ${followedTopics.length > 0 ? `
                <div class="wb-topic-section-title">${I18n.t('weibo.topic_followed', '我关注的超话')}</div>
                ${followedTopics.map(t => this._renderTopicCard(t, true)).join('')}
            ` : ''}
            ${recommendedTopics.length > 0 ? `
                <div class="wb-topic-section-title">${I18n.t('weibo.topic_recommended', '推荐超话')}</div>
                ${recommendedTopics.map(t => this._renderTopicCard(t, false)).join('')}
            ` : ''}
        `;
        container.querySelectorAll('.wb-topic-card').forEach(el => {
            el.onclick = (e) => {
                if (e.target.classList.contains('wb-topic-follow')) return;
                this.openTopic(el.dataset.topicId);
            };
        });
        container.querySelectorAll('.wb-topic-follow').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this._toggleTopicFollow(btn.dataset.topicId);
            };
        });
    },

    _renderTopicCard(topic, isFollowed) {
        const typeIcon = topic.type === 'production' ? '《》' : topic.type === 'cp' ? '✕' : '★';
        return `
            <div class="wb-topic-card" data-topic-id="${topic.id}">
                <div class="wb-topic-cover" style="background:${topic.coverColor || '#ff8200'}">${typeIcon}</div>
                <div class="wb-topic-meta">
                    <div class="wb-topic-name">${this._escapeHtml(topic.name)}</div>
                    <div class="wb-topic-stats">
                        <span>${topic.memberCount || 0} ${I18n.t('weibo.topic_members', '成员')}</span>
                        <span>${topic.postCount || 0} ${I18n.t('weibo.topic_posts', '帖子')}</span>
                    </div>
                </div>
                <button class="wb-topic-follow" data-topic-id="${topic.id}">${isFollowed ? '✓' : I18n.t('weibo.btn_follow', '关注')}</button>
            </div>
        `;
    },

    _toggleTopicFollow(topicId) {
        const wd = AppState.data.weiboData;
        const followed = wd.followedTopicIds || [];
        const idx = followed.indexOf(topicId);
        if (idx >= 0) followed.splice(idx, 1);
        else followed.push(topicId);
        wd.followedTopicIds = followed;
        Utils.saveData();
        this._renderTopicList(document.getElementById('wbDiscoverContent'));
    },

    openTopic(topicId) {
        const wd = AppState.data.weiboData;
        const topic = (wd.topics || []).find(t => t.id === topicId);
        if (!topic) return;
        this._currentTopicId = topicId; // v2.73.10: 记录当前打开的 topic、_handleLike 可用来重渲
        const posts = (wd.posts || []).filter(p => (p.topicIds || []).includes(topic.name) || (p.topicIds || []).includes(topicId));
        const isFollowed = (wd.followedTopicIds || []).includes(topicId);

        const emptyHtml = `<div class="wb-empty wb-topic-empty-state" id="wbTopicEmptyState">${I18n.t('weibo.topic_seeding', '正在加载该超话内容...')}</div>`;
        const feedHtml = posts.length > 0
            ? posts.map(p => this._renderPostCard(p)).join('')
            : emptyHtml;

        const inner = `
            <div class="wb-modal-bar">
                <button class="wb-modal-close" id="wbTopicBack">‹</button>
                <div class="wb-modal-title">#${this._escapeHtml(topic.name)}#</div>
                <button class="wb-topic-follow-big" data-topic-id="${topicId}">${isFollowed ? '✓ ' + I18n.t('weibo.topic_already_followed', '已关注') : I18n.t('weibo.btn_follow', '关注')}</button>
            </div>
            <div class="wb-modal-body">
                <div class="wb-topic-header">
                    <div class="wb-topic-cover wb-topic-cover-big" style="background:${topic.coverColor || '#ff8200'}">
                        ${topic.type === 'production' ? '《》' : topic.type === 'cp' ? '✕' : '★'}
                    </div>
                    <div class="wb-topic-info">
                        <div class="wb-topic-name-big">${this._escapeHtml(topic.name)}</div>
                        <div class="wb-topic-desc">${this._escapeHtml(topic.description || '')}</div>
                        <div class="wb-topic-stats">
                            <span>${topic.memberCount || 0} ${I18n.t('weibo.topic_members', '成员')}</span>
                            <span id="wbTopicPostCount">${posts.length} ${I18n.t('weibo.topic_posts', '帖子')}</span>
                        </div>
                    </div>
                </div>
                <div class="wb-feed" id="wbTopicFeed">${feedHtml}</div>
            </div>
        `;
        // 用 sub-screen 模式覆盖底部 nav（仿真真微博的全屏跳转）— 替代旧的 body insertAdjacentHTML modal
        const node = this._openSubScreen('wbTopicSubScreen', inner);
        if (!node) return;

        document.getElementById('wbTopicBack').onclick = () => this._closeSubScreen('wbTopicSubScreen');
        node.querySelector('.wb-topic-follow-big').onclick = () => {
            this._toggleTopicFollow(topicId);
            this._closeSubScreen('wbTopicSubScreen');
            this.openTopic(topicId);
        };
        this._bindCardActions(node);

        // lazy seed：帖子数 < 3 时单 LLM 请求拿一批该超话内的博文（NPC 池有 + 没在 lazy seeding 中）
        if (posts.length < 3 && (wd.fanFriends || []).length > 0 && !this._lazySeedingTopics?.[topicId]) {
            this._lazySeedTopicPosts(topicId);
        } else if (posts.length === 0) {
            // 没 NPC 池就显示常规 empty
            const empty = document.getElementById('wbTopicEmptyState');
            if (empty) empty.textContent = I18n.t('weibo.topic_empty_posts', '该超话还没有微博');
        }
    },

    // 超话内 lazy seed：用户点进去时按需拉一批该话题的博文（in-flight guard 防重复触发）
    // 单 LLM 请求拿 3-5 条博文、复用批量 prompt 同款 ---WEIBO--- 分隔 + REPLY、prompt 强制 topicIds 含该 topic
    async _lazySeedTopicPosts(topicId) {
        this._lazySeedingTopics = this._lazySeedingTopics || {};
        if (this._lazySeedingTopics[topicId]) return;
        this._lazySeedingTopics[topicId] = true;

        try {
            const wd = AppState.data.weiboData;
            const topic = (wd.topics || []).find(t => t.id === topicId);
            if (!topic) return;
            const allNpcs = (wd.fanFriends || []).filter(f => f.type !== 'official');
            if (allNpcs.length === 0) return;

            // 按 topic.type 偏向挑 NPC：CP 超话偏 cp_fan / fan_writer、作品超话偏 daily_fan / info_station / fan_artist、角色超话偏 cp_fan / fan_writer / daily_fan
            const preferredByType = {
                cp: ['cp_fan', 'fan_writer', 'daily_fan'],
                production: ['daily_fan', 'info_station', 'fan_artist', 'cp_fan'],
                character: ['cp_fan', 'fan_writer', 'daily_fan']
            };
            const preferred = preferredByType[topic.type] || ['daily_fan', 'cp_fan', 'fan_writer'];
            const weighted = allNpcs.filter(n => preferred.includes(n.type));
            const pool = weighted.length >= 3 ? weighted : allNpcs;

            const picks = this._pickDiverseNpcs(pool, 4);
            if (picks.length === 0) return;

            const prompt = this._buildTopicLazySeedPrompt(picks, topic);
            const raw = await this._callLLM(prompt);
            const blocks = this._parseWeiboBatch(raw, picks);
            if (blocks.length === 0) return;

            const posts = blocks.map(b => {
                const post = this._buildPostFromBlock(b);
                // 强制 topicIds 含该 topic（兜底、避免 LLM 漏写 #name#）
                if (!post.topicIds.includes(topic.name) && !post.topicIds.includes(topicId)) {
                    post.topicIds.push(topic.name);
                }
                return post;
            });
            posts.forEach(p => wd.posts.unshift(p));
            Utils.saveData();

            // 重渲染当前打开的超话页（如果用户还在该超话）
            const feedEl = document.getElementById('wbTopicFeed');
            if (feedEl && document.getElementById('wbTopicSubScreen')) {
                const allPostsForTopic = (wd.posts || []).filter(p =>
                    (p.topicIds || []).includes(topic.name) || (p.topicIds || []).includes(topicId)
                );
                feedEl.innerHTML = allPostsForTopic.map(p => this._renderPostCard(p)).join('')
                    || `<div class="wb-empty">${I18n.t('weibo.topic_empty_posts', '该超话还没有微博')}</div>`;
                const countEl = document.getElementById('wbTopicPostCount');
                if (countEl) countEl.textContent = `${allPostsForTopic.length} ${I18n.t('weibo.topic_posts', '帖子')}`;
                this._bindCardActions(feedEl);
            }
        } catch (err) {
            console.warn('[Weibo lazy seed topic] failed', err);
            const empty = document.getElementById('wbTopicEmptyState');
            if (empty) empty.textContent = I18n.t('weibo.topic_empty_posts', '该超话还没有微博');
        } finally {
            delete this._lazySeedingTopics[topicId]; // v2.73.10: 释放 key、之前用 false 标记每个进过的 topic 都留 key、字典随访问量累积
        }
    },

    _buildTopicLazySeedPrompt(npcs, topic) {
        const cp = AppState.data.broadcast?.cpSettings || {};
        const worldCtx = this._getWorldContext();
        const topicTypeLabel = topic.type === 'cp' ? 'CP 超话' : topic.type === 'production' ? '作品超话' : '角色超话';
        const merchGate = this._getMerchGate();

        const npcLines = npcs.map((n, i) => {
            const fc = n.followerCount || 0;
            const replyCount = fc >= 10000 ? 6 : fc >= 3000 ? 5 : 4;
            return `[N${i + 1}] ${n.name} (@${n.handle}) | type=${n.type} | 简介：${n.bio} | 偏好：${(n.contentTags || []).join('、')} | 期望评论数：${replyCount}`;
        }).join('\n');

        return `你在模拟中国微博「${topic.name}」超话（${topicTypeLabel}）内部的讨论流、按下方 NPC 列表生成 ${npcs.length} 条聚焦于该超话主题的博文。

【超话信息】
- 名称：${topic.name}
- 简介：${topic.description || '（未填）'}
- 类型：${topicTypeLabel}

【世界观】
${worldCtx}
${cp.productionName ? `主要作品：《${cp.productionName}》` : ''}
${cp.cpNickname ? `主要 CP：${cp.cpNickname}` : ''}

【NPC 列表】
${npcLines}

【内容要求】
- 每条微博必须聚焦在「${topic.name}」这个超话的主题上、跟该超话相关（不要发跟超话无关的日常）
- 每条博文必须带 #${topic.name}# 这个超话引用（作为 hashtag 形式出现在正文中）
- 内容形式按 NPC type 多样：CP 粉抠糖 / 文手卡文或放片段 / 画手草稿或局部 / 日常粉随手感想 / 情报站客观搬运 等
${merchGate.promptGateText}

【生态底色】
- 中国微博、不是日本推特：半公开广场感、更吵、更碎、更快、情绪更外露
- 不是营销号 / AI 总结 / 宣传文案 — 真实用户随手发
- 允许活人情绪、各 NPC 选不同切入点、避免扎堆同一情绪
- 长度由你按内容自主判断、短帖也是 baseline

【用语策略】
- 鼓励中文同人圈黑话 >= 圈内梗 >= 普通网络用语、具体用什么词由你按时效性自行判断、避开过气营销词
- 标点可以非常规（「。。。」「！！！」「......」「？？」、emoji 自然散落不刻意）

【底线】
- 不评判其他粉丝群体 / 不贬低其他作品（cp_fan 允许低浓度阴阳对家 CP、但不指向具体 NPC 真名）
- 不主动提及现实政治 / 性别议题

【铁律】必须使用简体中文输出、严禁繁体字 / 日语 / 英语整句。

【严格输出格式】对每个 NPC 用 ---WEIBO--- 分隔、含正文 + 按"期望评论数"生成的评论：
---WEIBO---
TAG: [N1]
CONTENT:
[微博正文、必含 #${topic.name}# 引用]
REPLY_1: [评论者昵称]|[评论]
REPLY_2: [评论者昵称]|[评论]
... (按 N1 的期望评论数生成)
---WEIBO---
TAG: [N2]
...

不要输出 JSON、不要 markdown 代码块、不要 prefix、不要其他说明文字。`;
    },

    // ========== Tab 3: 消息（@/评论/赞/私信） ==========

    renderNotif() {
        const screen = document.getElementById('weiboTabNotif');
        if (!screen) return;
        const sub = this._notifSubTab || 'mention';
        const notif = AppState.data.weiboData?.notifications || {};
        const dmUnread = (notif.dms || []).reduce((n, d) => n + ((d.messages || []).filter(m => m.from !== 'me' && m.createdAt > (d.lastReadAt || 0)).length), 0);

        screen.innerHTML = `
            <div class="wb-notif-subtabs">
                <button class="wb-notif-tab ${sub === 'mention' ? 'active' : ''}" data-sub="mention">@${I18n.t('weibo.notif_mention', '我的')}</button>
                <button class="wb-notif-tab ${sub === 'comment' ? 'active' : ''}" data-sub="comment">${I18n.t('weibo.notif_comment', '评论')}</button>
                <button class="wb-notif-tab ${sub === 'like' ? 'active' : ''}" data-sub="like">${I18n.t('weibo.notif_like', '赞')}</button>
                <button class="wb-notif-tab ${sub === 'dm' ? 'active' : ''}" data-sub="dm">${I18n.t('weibo.notif_dm', '私信')} ${dmUnread > 0 ? `<span class="wb-badge">${dmUnread}</span>` : ''}</button>
            </div>
            <div class="wb-notif-content" id="wbNotifContent"></div>
        `;
        screen.querySelectorAll('.wb-notif-tab').forEach(btn => {
            btn.onclick = () => {
                this._notifSubTab = btn.dataset.sub;
                this.renderNotif();
            };
        });
        this._renderNotifContent(sub);
    },

    _renderNotifContent(sub) {
        const container = document.getElementById('wbNotifContent');
        if (!container) return;
        const notif = AppState.data.weiboData?.notifications || {};

        if (sub === 'mention') {
            const items = notif.mentions || [];
            container.innerHTML = items.length === 0
                ? `<div class="wb-empty">${I18n.t('weibo.notif_empty_mention', '还没有人 @ 你')}</div>`
                : items.map(m => this._renderNotifItem(m, 'mention')).join('');
        } else if (sub === 'comment') {
            const items = notif.comments || [];
            container.innerHTML = items.length === 0
                ? `<div class="wb-empty">${I18n.t('weibo.notif_empty_comment', '还没有人评论你')}</div>`
                : items.map(c => this._renderNotifItem(c, 'comment')).join('');
        } else if (sub === 'like') {
            const items = notif.likes || [];
            container.innerHTML = items.length === 0
                ? `<div class="wb-empty">${I18n.t('weibo.notif_empty_like', '还没有人点赞')}</div>`
                : `<div class="wb-like-header">${I18n.t('weibo.notif_like_count', '共 {n} 人赞了你').replace('{n}', items.length)}</div>`
                  + items.map(l => this._renderLikeItem(l)).join('');
        } else if (sub === 'dm') {
            const followed = this._getFollowedNpcIds();
            const dms = notif.dms || [];
            const knownDms = dms.filter(d => followed.includes(d.npcId));
            const strangerDms = dms.filter(d => !followed.includes(d.npcId));

            container.innerHTML = `
                ${strangerDms.length > 0 ? `
                    <div class="wb-stranger-entry" id="wbStrangerEntry">
                        <span>${I18n.t('weibo.notif_stranger_dms', '陌生人私信')} (${strangerDms.length})</span>
                        <span>›</span>
                    </div>
                ` : ''}
                ${knownDms.length > 0
                    ? knownDms.map(d => this._renderDmItem(d)).join('')
                    : `<div class="wb-empty">${I18n.t('weibo.notif_empty_dm', '还没有私信')}</div>`
                }
            `;
            const stranger = document.getElementById('wbStrangerEntry');
            if (stranger) stranger.onclick = () => this._showStrangerDms(strangerDms);
        }
    },

    _renderNotifItem(item, kind) {
        const npc = (AppState.data.weiboData.fanFriends || []).find(f => f.id === item.fromNpcId);
        if (!npc) return '';
        const post = (AppState.data.weiboData.posts || []).find(p => p.id === item.postId);
        return `
            <div class="wb-notif-item" data-id="${item.id}">
                <div class="wb-avatar" style="background:${npc.avatarColor}">${npc.name[0]}</div>
                <div class="wb-notif-body">
                    <div class="wb-notif-head">
                        <span class="wb-notif-name">${this._escapeHtml(npc.name)}</span>
                        <span class="wb-notif-time">${this._formatTime(item.createdAt)}</span>
                    </div>
                    <div class="wb-notif-text">${kind === 'mention' ? '@你 ' : ''}${this._escapeHtml(item.content || '')}</div>
                    ${post ? `<div class="wb-notif-quote">${this._escapeHtml((post.content || '').slice(0, 60))}</div>` : ''}
                </div>
            </div>
        `;
    },

    _renderLikeItem(like) {
        const npc = (AppState.data.weiboData.fanFriends || []).find(f => f.id === like.fromNpcId);
        if (!npc) return '';
        const post = (AppState.data.weiboData.posts || []).find(p => p.id === like.postId);
        return `
            <div class="wb-like-item">
                <div class="wb-avatar" style="background:${npc.avatarColor}">${npc.name[0]}</div>
                <div class="wb-like-body">
                    <div class="wb-notif-head">
                        <span class="wb-notif-name">${this._escapeHtml(npc.name)}</span>
                        <span class="wb-notif-time">${this._formatTime(like.createdAt)}</span>
                    </div>
                    <div class="wb-notif-text">${I18n.t('weibo.notif_like_label', '赞了你的微博')}</div>
                    ${post ? `<div class="wb-notif-quote">${this._escapeHtml((post.content || '').slice(0, 60))}</div>` : `<div class="wb-notif-quote">${I18n.t('weibo.notif_post_deleted', '微博已被删除')}</div>`}
                    <button class="wb-notif-thanks">${I18n.t('weibo.notif_thanks', '感谢 Ta')}</button>
                </div>
            </div>
        `;
    },

    _renderDmItem(d) {
        const npc = (AppState.data.weiboData.fanFriends || []).find(f => f.id === d.npcId);
        if (!npc) return '';
        const last = (d.messages || []).slice(-1)[0];
        return `
            <div class="wb-dm-item" data-dm-id="${d.id}">
                <div class="wb-avatar" style="background:${npc.avatarColor}">${npc.name[0]}</div>
                <div class="wb-dm-body">
                    <div class="wb-notif-head">
                        <span class="wb-notif-name">${this._escapeHtml(npc.name)}</span>
                        <span class="wb-notif-time">${this._formatTime(last?.createdAt || d.lastReadAt || Date.now())}</span>
                    </div>
                    <div class="wb-dm-preview">${this._escapeHtml((last?.content || '').slice(0, 50))}</div>
                </div>
            </div>
        `;
    },

    _showStrangerDms(strangerDms) {
        const html = `
            <div class="wb-modal" id="wbStrangerModal">
                <div class="wb-modal-bar">
                    <button class="wb-modal-close" id="wbStrangerClose">‹</button>
                    <div class="wb-modal-title">${I18n.t('weibo.stranger_dms_title', '陌生人私信')}</div>
                    <span></span>
                </div>
                <div class="wb-modal-body">
                    ${strangerDms.map(d => this._renderDmItem(d)).join('')}
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        document.getElementById('wbStrangerClose').onclick = () => document.getElementById('wbStrangerModal').remove();
    },

    // ========== Phase 2: NPC 池 + 种子播种 ==========

    _getWorldContext() {
        if (typeof Forum !== 'undefined' && Forum.getWorldContext) {
            return Forum.getWorldContext() || '';
        }
        return AppState.data.broadcast?.worldSetting || '';
    },

    async _maybeSeedWeiboNpcs() {
        const wd = AppState.data.weiboData;
        if (!wd) return;
        // 并发种子保护 —— init / refreshHome / 其他入口可能并发触发
        if (this._seedingNpcs) return;
        // 池非空 → 标记 flag 后跳过
        if ((wd.fanFriends || []).length > 0) {
            wd._seededInitial = true;
            Utils.saveData();
            return;
        }
        // 池空但 flag 已 true → 说明上次种子失败、清掉 flag 让本次重试
        if (wd._seededInitial) wd._seededInitial = false;
        const worldCtx = this._getWorldContext();
        if (!worldCtx) {
            throw new Error(I18n.t('weibo.seed_missing_world', '请先在放送局填写世界观设定'));
        }

        this._seedingNpcs = true;
        try {
            await this._seedWeiboNpcs(8);
            wd._seededInitial = true;
            Utils.saveData();
            const actualCount = (wd.fanFriends || []).length;
            // 种子成功明确反馈、避免用户在「等还是不等」之间反复点刷新
            Utils.showToast(I18n.t('weibo.seed_done', '中文圈 NPC 已准备就绪、{n} 位粉丝入驻').replace('{n}', actualCount), 3500);
            if (this.currentTab === 'home') this.renderHome();
        } finally {
            this._seedingNpcs = false;
        }
    },

    async _seedWeiboNpcs(count = 8) {
        const cp = AppState.data.broadcast?.cpSettings || {};
        const worldCtx = this._getWorldContext();

        const prompt = `请生成 ${count} 个中国微博平台的同人圈用户（NPC）、覆盖以下 7 类（每类至少 1 个、最多 2 个）：

1. fan_writer（同人文手）— 在 lofter / 微博上发同人文
2. fan_artist（同人画手）— 占位、生成 1 个即可
3. group_organizer（拼团组织者）— 开周边盲盒拼团
4. daigou（代购）— 日本同人圈周边代购
5. info_station（情报站）— 搬运官方动向 / 周边发售
6. daily_fan（日常粉）— 普通粉丝、话题广泛
7. cp_fan（CP 粉丝）— 安利党

世界观背景：${worldCtx}
${cp.productionName ? `主要作品：《${cp.productionName}》` : ''}
${cp.cpNickname ? `主要 CP：${cp.cpNickname}` : ''}

要求：
- 微博昵称带中文特色（可含表情符号 / 下划线 / 数字 / 萌系后缀）
- handle 格式：拼音 / 英文短词
- bio 一句话（10-30 字、温和友好、聚焦同人圈兴趣）
- contentTags 数组、3-5 个 CP / 主题词
- followerCount 粉丝数（fan_writer 1000-50000 / cp_fan 500-30000 / daily_fan 100-5000 / 其他类似）

输出严格 JSON 数组、每个元素：
{
  "name": "昵称",
  "handle": "拼音或英文短词",
  "type": "fan_writer",
  "bio": "简介",
  "contentTags": ["..."],
  "followerCount": 12000
}

【铁律】bio / contentTags 必须使用简体中文。严禁繁体字、严禁日语、严禁英语整句。
只输出 JSON 数组、不要任何其他文字、不要 markdown 代码块标记。`;

        const response = await this._callLLM(prompt);
        const npcs = this._parseNpcsJson(response);

        npcs.forEach(n => {
            if (!n.name || !n.type) return;
            AppState.data.weiboData.fanFriends.push({
                id: 'wfan_' + this._uuid(),
                name: n.name,
                handle: n.handle || ('user_' + this._uuid().slice(0, 6)),
                bio: n.bio || '',
                avatarColor: this._randomAccountColor(),
                type: n.type,
                contentTags: n.contentTags || [],
                followed: false,
                verified: false,
                followerCount: n.followerCount || 1000,
                lofterHandle: n.type === 'fan_writer' ? n.handle : null,
                writingStyleId: null,
                officialRole: null,
                officialCharId: null,
                officialCharName: null,
                createdAt: Date.now()
            });
        });
        Utils.saveData();
        // v2.73.10: 跨模块 P1 — 新 NPC push 后让 lofter 自己补 lofter:{} 子字段（idempotent）
        // 之前 weibo 中途新增 NPC、用户不切回 lofter tab 时、Lofter.init 不重跑 _migrateExistingNpcs、新 NPC 的 articleCount 永远不增、永远成不了合集作者
        if (typeof Lofter !== 'undefined' && Lofter._migrateExistingNpcs) {
            Lofter._migrateExistingNpcs();
        }
        console.log(`[Weibo seed] created ${npcs.length} NPCs`);
    },

    _parseNpcsJson(text) {
        if (!text) return [];
        let s = text.trim();
        const m1 = s.match(/```json\s*([\s\S]*?)```/) || s.match(/```\s*([\s\S]*?)```/);
        if (m1) s = m1[1].trim();
        const m2 = s.match(/\[[\s\S]*\]/);
        if (m2) s = m2[0];
        try {
            const arr = JSON.parse(s);
            return Array.isArray(arr) ? arr : [];
        } catch (err) {
            console.warn('[Weibo] parse NPCs JSON failed', err);
            return [];
        }
    },

    // 委托 Utils.callChatAPI：独立 API 启用时走 override，否则 fallback 到全局 apiConfig
    // 全局 apiConfig 支持 openai / deepseek / google / claude 各种 mode，Utils 内部已处理
    // v2.73.7: options 第 2 参（{ temperature, maxTokens }）真正透传到 Utils.callChatAPI（之前签名只接 1 参、caller 传的 options 被静默丢）
    async _callLLM(prompt, options = null) {
        const override = AppState.data.weiboData?.apiOverride;
        const overrideConfig = (override?.enabled && override.apiKey && override.model)
            ? {
                enabled: true,
                baseUrl: override.baseUrl,
                apiKey: override.apiKey,
                model: override.model
            }
            : null;
        return await Utils.callChatAPI(
            [{ role: 'user', content: prompt }],
            null,
            overrideConfig,
            options
        );
    },

    // ========== Phase 2: NPC 微博生成 ==========
    // 批量模式 helpers 见下方 _pickDiverseNpcs / _buildBatchWeiboPrompt / _parseWeiboBatch / _buildPostFromBlock
    // _generateNpcWeibos 入口在文件后段（搜索 "Phase 2: NPC 池 + 种子播种"）

    _mapNpcTypeToPostType(npcType, isLong) {
        const map = {
            fan_writer: isLong ? 'long' : 'text',
            fan_artist: 'image',
            group_organizer: 'group_buy',
            daigou: 'daigou',
            info_station: 'info',
            daily_fan: 'daily',
            cp_fan: 'text',
            official: 'text'
        };
        return map[npcType] || 'text';
    },

    // ========== 批量生成 helpers（一次 LLM 请求多段返回、仿 twitter._generateNpcTweets 同款模式）==========

    // 多样性挑选：尽量每 type 不重复、最多 count 个
    _pickDiverseNpcs(all, count) {
        if (all.length === 0) return [];
        const byType = new Map();
        all.forEach(npc => {
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

    // 批量 prompt 构造：列出 N 个 NPC + 每个最近 24h 投稿摘要（去重锚点）+ 7 类 typeSpec 分块指令
    _buildBatchWeiboPrompt(npcs, recentPlotSummary = '', merchGate = null) {
        merchGate = merchGate || this._getMerchGate();
        const cp = AppState.data.broadcast?.cpSettings || {};
        const worldCtx = this._getWorldContext();
        const posts = AppState.data.weiboData?.posts || [];

        // 每个 NPC 最近 24h 投稿摘要（去重锚点、仿 twitter line 808-828）
        const RECENT_WINDOW = 24 * 60 * 60 * 1000;
        const nowTs = Date.now();
        const recentMap = new Map();
        posts.forEach(p => {
            if (!p.npcId || !p.content) return;
            if ((nowTs - (p.createdAt || 0)) > RECENT_WINDOW) return;
            const arr = recentMap.get(p.npcId) || [];
            arr.push({ ts: p.createdAt, content: p.content });
            recentMap.set(p.npcId, arr);
        });
        recentMap.forEach((arr, k) => {
            arr.sort((a, b) => b.ts - a.ts);
            recentMap.set(k, arr.slice(0, 3));
        });

        const typeSpec = {
            fan_writer: '同人文手 — 卡文碎碎念 / 深夜放片段 / 被原作一句台词创到 / 说自己改了三遍开头 / 发更新但很心虚 / 偶尔自宣 lofter 新作（不必每次）。允许短、允许只放一句、允许很丧',
            fan_artist: '同人画手 — 草稿、色块、手癖、赶稿、画不出脸、只放局部、说晚点发、画废了开始摆烂。允许很短甚至几个字',
            group_organizer: '拼团团长 — 价格、截止日、余量、排单、补款、评论区蹲、报名截止、催补款。语气允许疲惫或公事公办、允许偶尔骂跑单的或者混进来的黄牛。不要永远客客气气',
            daigou: '代购 — 一半时间发代购消息（库存、汇率、到货、截单、邮费、瑕疵说明、不热情、像真在做单子）；剩下混自己的生活（日本好吃的 / 好玩的展子 / 自己看的番剧 / 偶尔骂插队黄牛 / 吐槽日本官方限购 / 抱怨跑单的）。【必须】带 1-2 个 #作品名# 或 #角色名# 超话引用（真实代购就这样宣传）',
            info_station: '同人圈情报搬运站 — 客观陈述、【情报】或【官方】前缀、含来源（「来自官方推特 / 制作公司公告 / 杂志专访」）、信息密度大、不掺感情、提 1-2 个具体细节',
            daily_fan: '普通粉丝 — 生活和作品混在一起：上班路上刷到 / 吃饭突然想起 / 下课看一眼 / 地铁信号差才看到。30% 允许完全跑题（午餐 / 加班 / 猫狗 / 工作小确幸 / 突然破防）、不带 CP / 角色',
            cp_fan: 'CP 粉 — 抠糖 / 新粉求补课 / 老粉复健 / 突然被某个动作击中 / 整理粮单。**允许低浓度阴阳对家 CP**（用 CP 名 / 作品名抽象层级、不指向具体真人、不要每条都阴阳）。可以激动但别像营销号'
        };

        // 按 follower 决定每条博文期望的评论数量（高粉丝 = 热门博文 = 评论多）
        // < 3000 → 4 条、3000-10000 → 5-6 条、10000+ → 7-9 条
        const npcLines = npcs.map((n, i) => {
            const tag = `[N${i + 1}]`;
            const fc = n.followerCount || 0;
            const replyCount = fc >= 10000 ? (7 + Math.floor(Math.random() * 3))
                : fc >= 3000 ? (5 + Math.floor(Math.random() * 2))
                : 4;
            // v2.73.10: 删 n._batchReplyCount = replyCount —— 之前挂临时字段到持久 NPC 对象上、序列化进存档污染 schema、且解析时根本没用（replyCount 通过 prompt 提示传给 LLM、不需要数据层）
            const head = `${tag} ${n.name} (@${n.handle}) | type=${n.type} | 简介：${n.bio} | 偏好：${(n.contentTags || []).join('、')} | 期望评论数：${replyCount}`;
            const recent = recentMap.get(n.id);
            if (!recent || !recent.length) return head;
            const recentLines = recent.map(r => `    └ 最近发过：${r.content.replace(/\n/g, ' ').slice(0, 60)}${r.content.length > 60 ? '…' : ''}`).join('\n');
            return `${head}\n${recentLines}`;
        }).join('\n\n');

        const dedupRule = [...recentMap.values()].some(arr => arr.length > 0) ? `
【严守规则 — 不要跟"最近发过"列表里的内容重复】
- 同 NPC 不要再发同样的主题 / CP 节点 / 事件 / 周边
- 不同 NPC 之间也不要扎堆在同一个话题上（必须各发各的角度）
- 必须选「还没说过的切入点」` : '';

        const typeSpecLines = [...new Set(npcs.map(n => n.type))]
            .map(t => `- ${t}: ${typeSpec[t] || typeSpec.daily_fan}`)
            .join('\n');

        return `你在模拟中国微博平台上同人圈用户的发博行为、要按下方 NPC 列表生成 ${npcs.length} 条微博、每个 NPC 各 1 条、顺序与列表对应。

世界观背景：${worldCtx}
${cp.productionName ? `主要作品：《${cp.productionName}》` : ''}
${cp.cpNickname ? `主要 CP：${cp.cpNickname}` : ''}
${cp.cpCharA && cp.cpCharB ? `CP 双方：${cp.cpCharA} × ${cp.cpCharB}` : ''}
${recentPlotSummary ? `最近剧情：${recentPlotSummary}` : ''}

【NPC 列表】
${npcLines}

【按 NPC type 的内容规范】
${typeSpecLines}
${merchGate.promptGateText}

【生态底色 — 中国微博、不是日本推特】
- 半公开广场感：比日本推特更吵、更碎、更快、情绪更外露、爆发性更强
- 不是营销号、不是 AI 总结、不是宣传文案、不是官方公告 — 是真实用户随手发
- 允许各种活人情绪：累 / 急 / 嘴硬 / 激动 / 犯懒 / 阴暗爬行 / 突然幸福 / 突然破防 / 选择性活跃
- 每个 NPC 在心里给 ta 一个具体生活状态（上班族刷一眼 / 学生党拖延 / 自由职业生物钟乱 / 时差党 / 画手赶稿 / 团长排单中 / 任意你认为合理的）作为语调底色、不必每条博文都明示
- 长度由你按内容自主判断、短帖（一句感想 / 一个表情包描述）也是 baseline、不要每条都长

【用语策略】
- 鼓励使用中文同人圈黑话 >= 圈内梗 >= 普通网络用语
- 具体用什么词由你自行判断、追求时效性、避开已经显得过气 / 营销号感的词
- 同人女生态自然语感、不要刻意"接地气"
- 标点可以非常规（「。。。」「！！！」「......」「？？」、emoji 自然散落不刻意）

【底线】
- 不评判其他粉丝群体 / 不贬低其他作品（cp_fan 允许在 CP 抠糖范围内对家 CP 低浓度阴阳、但不指向具体 NPC 真名 / 不进行人身攻击 / 不要让首页变成撕逼）
- 不主动提及现实政治 / 性别议题
- 语气混合：糖 / 吐槽 / 日常 / 安利混着出、各 NPC 选不同切入点、避免扎堆
${dedupRule}

【铁律】必须使用简体中文输出。严禁繁体字、严禁日语、严禁英语整句（极少数 ACG 圈通用缩写如 OOC 可保留）。

【转发链（偶尔出现 — 不强制、不每次必出）】
- 0-1 个 NPC 可以选 TYPE=repost 转发一个虚拟原博、加自己的转发评论
- TYPE 默认 normal（普通发博）、想转发就标 TYPE=repost
- TYPE=repost 时需输出 REPOST_ORIGIN（被转发的虚拟原博、不在主时间线、是 NPC 心目中转发的来源）
- TYPE=repost 时可选输出 REPOST_CHAIN（中间转发者快照、最多 2 级、每行一个）
- 一般场景：高粉文手/画手/情报站发的博文被路人 NPC 转发；CP 粉转发抓糖；普通粉丝看到好笑的转发
- 转发不是每次都有链 — 大部分直接转发原博（无中间链）、偶尔有 1-2 级链

【严格输出格式】对每个 NPC 用 ---WEIBO--- 分隔、每块包含正文 + 按"期望评论数"生成的粉丝评论：
---WEIBO---
TAG: [N1]
TYPE: [normal / repost、默认 normal、可省略]
REPOST_ORIGIN: [仅 TYPE=repost 时必填、格式：原博主名|原博内容]
REPOST_CHAIN: [仅 TYPE=repost 且有中间链时填、每行一个、格式：//@中间转发者: 评论、最早的在最后]
CONTENT:
[微博正文。多行均可。TYPE=repost 时这里是"我的转发评论"]
REPLY_1: [评论者昵称]|[5-25 字简体中文评论、贴合该 NPC 微博的主题]
REPLY_2: [评论者昵称]|[简体中文评论]
REPLY_3: [评论者昵称]|[简体中文评论]
... (按上方 NPC 列表里的"期望评论数"生成对应数量、热门博文可以更多)
---WEIBO---
TAG: [N2]
CONTENT:
[微博正文。]
REPLY_1: [评论者昵称]|[评论]
...

【评论生态 — 真实评论区不会每条都认真回应博文】
- 评论数量按上方 NPC 列表里的"期望评论数"生成（4-9 条不等、热门博文评论多、信息少的代购 / 拼团也至少 4 条）
- 评论分布参考真实评论区结构（你自行混合、不必精确卡比例）：
  · ~30% 表情式 / 反应式（情绪外露的短反应、由你选词）
  · ~30% 跑题 / 抠糖 / 反转（"刚发现 XX 头像换了" / "等等楼上是我朋友"那种）
  · ~30% 问 / 求 / 催 / 嘲（短问句 / 蹲链接 / 催更 / 轻吐槽）
  · ~10% 认真回应博文内容
- 允许叠楼：连续 2-3 条相近情绪的短评而不是每条独立思考
- 评论长度跨度大：从 2-3 字（"蹲" / "+1" / "啊？"）到一两句（15-30 字感想）
- 不要每条都夸博主、不要每条都喊老师、不要每条都跟主题强相关
- 评论者昵称由你按中文圈风格随机起、不要复用上面 NPC 名
- 用什么具体口语词 / 网络词 / 梗 — 由你按时效性自行判断、不要钉死
- 不要输出 JSON、不要 markdown 代码块、不要 prefix、不要其他说明文字。`;
    },

    // 解析 ---WEIBO--- 分隔块、按 TAG 反查 NPC、抽出 CONTENT + REPLY_1/2/3 评论
    _parseWeiboBatch(raw, npcs) {
        if (!raw) return [];
        const blocks = raw.split(/---\s*WEIBO\s*---/i).map(s => s.trim()).filter(Boolean);
        const result = [];
        for (const block of blocks) {
            const tagMatch = block.match(/TAG:\s*\[?N(\d+)\]?/i);
            if (!tagMatch) continue;
            const idx = parseInt(tagMatch[1], 10) - 1;
            const npc = npcs[idx];
            if (!npc) continue;
            // CONTENT 抽到第一个 REPLY_ 之前（或 block 结尾）
            const contentMatch = block.match(/CONTENT:\s*([\s\S]*?)(?=\nREPLY_\d|$)/i);
            const content = contentMatch ? contentMatch[1].trim() : '';
            if (!content || content.length < 5) continue;

            // v2.72.7: 转发链解析
            // TYPE: repost / normal（默认 normal）
            // REPOST_ORIGIN: 原博主 NAME|原博内容
            // REPOST_CHAIN: 多行、每行 //@中间转发者: 评论（按倒序最早在最后）
            const typeRaw = (block.match(/^TYPE:\s*\[?(repost|normal)\]?/im) || [])[1]?.toLowerCase(); // v2.73.11: 容忍 LLM 输出 TYPE: [normal] 带方括号
            let repostQuote = null;
            let repostChain = [];
            if (typeRaw === 'repost') {
                const originMatch = block.match(/^REPOST_ORIGIN:\s*(.+?)\|([\s\S]+?)(?=\n[A-Z_]+:|$)/m);
                if (originMatch) {
                    const author = originMatch[1].trim();
                    const origContent = originMatch[2].trim();
                    if (author && origContent) {
                        repostQuote = { author, content: origContent };
                    }
                }
                // REPOST_CHAIN 多行格式、每行一个 //@xxx:xxx
                const chainMatch = block.match(/^REPOST_CHAIN:\s*([\s\S]+?)(?=\n[A-Z_]+:|$)/m);
                if (chainMatch) {
                    const lines = chainMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
                    const chainRe = /^\/\/@([^:：]+)[:：]\s*(.+)$/;
                    lines.forEach(l => {
                        const cm = l.match(chainRe);
                        if (cm) repostChain.push({ author: cm[1].trim(), content: cm[2].trim() });
                    });
                }
            }
            // 如果 TYPE=repost 但 REPOST_ORIGIN 完全缺失 / 解析不出来、降级为 normal（防止显示空白 quote）
            const isRepost = typeRaw === 'repost' && (repostQuote || repostChain.length > 0);

            // REPLY_n: 昵称|内容
            const replies = [];
            const replyRe = /^REPLY_\d+:\s*(.+?)\|(.+)$/mg;
            let rm;
            while ((rm = replyRe.exec(block)) !== null) {
                const author = rm[1].trim();
                const text = rm[2].trim();
                if (!author || !text) continue;
                replies.push({ author, content: text });
            }
            result.push({ npc, content, replies, isRepost, repostQuote, repostChain });
        }
        return result;
    },

    // 把解析出的块拼成 post 对象（含 inline replies）
    // v2.73.11: 接 batchIdx 第 2 参错开 createdAt（batch 同时生成的 N 条不再共用同一 now、feed 排序更自然）
    _buildPostFromBlock({ npc, content, replies = [], isRepost = false, repostQuote = null, repostChain = [] }, batchIdx = 0) {
        const topicIds = this._extractTopicIds(content);
        const isLong = npc.type === 'fan_writer' && content.length > 150;
        const fc = npc.followerCount || 1000;
        const sources = [
            I18n.t('weibo.source_web', '微博网页版'),
            I18n.t('weibo.source_app', '微博 i.OS 客户端'),
            I18n.t('weibo.source_lite', '微博轻享版')
        ];

        const now = Date.now();
        // 评论用临时 commenter id（不挂到 fanFriends、避免污染 NPC 池）；npcId=null 时详情页 fallback 显示 author 名
        // 评论 likes 字段用于详情页"按热度"排序、likes 越高排越前；按 fc 派生 + 随机扰动
        const postId = 'w_' + this._uuid();
        const postReplies = replies.slice(0, 12).map((r, i) => ({
            id: 'cm_' + this._uuid(),
            author: r.author,
            content: r.content,
            createdAt: now + i * 1000,
            npcId: null,
            likes: Math.floor(Math.random() * Math.max(3, fc * 0.002))
        }));

        // v2.72.7: 转发链 → post.type = 'repost' 优先；否则按 NPC type 映射
        const postType = isRepost ? 'repost' : this._mapNpcTypeToPostType(npc.type, isLong);

        // v2.73.0 lofter 联动：long 类型博文如果 author 在 lofter 有最近 long article、自动关联
        // 实现思路（不增加 LLM prompt 复杂度）：事件触发型反查、找该 NPC 最近 7 天的 lofter long article
        let linkedLofterArticleId = null;
        if (!isRepost && isLong && npc.type === 'fan_writer') {
            const lofterArticles = AppState.data.lofterData?.articles || [];
            const recent = lofterArticles
                .filter(a => a.authorNpcId === npc.id && a.type === 'long' && (Date.now() - (a.createdAt || 0)) < 7 * 86400_000)
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
            if (recent) linkedLofterArticleId = recent.id;
        }

        return {
            id: postId,
            accountId: npc.id,
            npcId: npc.id,
            content,
            images: !isRepost && npc.type === 'fan_artist' ? ['placeholder'] : [],
            type: postType,
            longContent: !isRepost && isLong ? content : null,
            lofterLinkSlug: !isRepost && isLong ? this._genShortSlug() : null,
            linkedLofterArticleId,
            repostId: null,
            repostQuote: isRepost ? repostQuote : null,
            repostChain: isRepost ? repostChain : [],
            topicIds,
            mentionedAccountIds: [],
            replies: postReplies,
            stats: {
                likes: Math.floor(Math.random() * fc * 0.05),
                comments: postReplies.length + Math.floor(Math.random() * fc * 0.01),
                reposts: Math.floor(Math.random() * fc * 0.005)
            },
            source: sources[Math.floor(Math.random() * sources.length)],
            isDraft: false,
            createdAt: now - batchIdx * 1500 // v2.73.11: 错开 1.5 秒、避免 batch 同时生成的 N 条 createdAt 相同导致 feed 排序混乱
        };
    },

    // ========== 零 token 推特官推搬运（仿 _maybeBroadcastArticleAsWeibo 杂志路径）==========
    //
    // 触发点：① refreshHome 开头扫描 ② init 时也扫一次
    // 数据流：用户在推特点「转存到放送局」→ broadcast.officialInfo 加一条 category='twitter'
    //         → 微博下次刷新/进入扫描到 → 反查 twitterData 拿 translation → 模板拼接、零 token
    // 也兼容用户在放送局手动新增 type=twitter 的 officialInfo（没 translation 时用原 content）

    _scanForBroadcastTweetTranslations() {
        try {
            const wd = AppState.data.weiboData;
            if (!wd) return;
            const officialInfos = AppState.data.broadcast?.officialInfo || [];
            const tweetInfos = officialInfos.filter(o => o.category === 'twitter');
            if (tweetInfos.length === 0) return;

            const already = new Set(
                (wd.posts || [])
                    .filter(p => p.translatedFromOfficialInfoId)
                    .map(p => p.translatedFromOfficialInfoId)
            );
            const fresh = tweetInfos.filter(o => !already.has(o.id));
            if (fresh.length === 0) return;

            for (const info of fresh) {
                this._maybeBroadcastTweetAsWeibo(info);
            }
        } catch (err) {
            console.warn('[Weibo] scan broadcast tweets failed', err);
        }
    },

    _maybeBroadcastTweetAsWeibo(officialInfo) {
        try {
            const wd = AppState.data.weiboData;
            if (!wd || !officialInfo) return;

            const already = (wd.posts || []).some(p => p.translatedFromOfficialInfoId === officialInfo.id);
            if (already) return;

            const stations = (wd.fanFriends || []).filter(f => f.type === 'info_station');
            if (stations.length === 0) return;
            const npc = stations[Math.floor(Math.random() * stations.length)];

            // 反查 twitter 原 tweet 拿 translation —— 用 content 精确匹配（saveToForum 时整段 push 进 officialInfo.content）
            const tweetsAll = [
                ...(AppState.data.twitterData?.tweets || []),
                ...(AppState.data.twitterData?.npcTweets || [])
            ];
            const sourceTweet = tweetsAll.find(tw => tw.content === officialInfo.content);
            const translation = (sourceTweet?.translation || '').trim();

            const officialNpcs = AppState.data.broadcast?.officialNpcs || [];
            const official = officialNpcs.find(o => o.id === officialInfo.sourceNpcId);
            const officialRole = official?.role || '官方';
            const officialName = official?.name || '';
            const officialHandle = official?.handle ? `@${official.handle}` : '';
            const sourceLabel = officialName
                ? `${officialRole}・${officialName}${officialHandle ? '（' + officialHandle + '）' : ''}`
                : `${officialRole}${officialHandle ? '（' + officialHandle + '）' : ''}`;

            const intros = ['【官推汉化】', '【情报搬运】', '【今日官推】', '【日推速报】'];
            const outros = [
                '* 个人翻译、等官方简中确认',
                '* 个人翻译、有误请指正',
                '* 不代表官方立场、仅供参考',
                '* 仅个人翻译、请支持原推'
            ];
            const intro = intros[Math.floor(Math.random() * intros.length)];
            const outro = outros[Math.floor(Math.random() * outros.length)];

            // 优先用 translation（推特刷到转存路径）；没有则用 content 原文（放送局手动新增路径）
            const body = translation || (officialInfo.content || '').trim();
            if (body.length < 10) return;
            const trimmedBody = body.length > 220 ? body.slice(0, 220) + '...' : body;

            const content = `${intro}\n来自 ${sourceLabel}\n\n${trimmedBody}\n\n${outro}`;

            const fc = npc.followerCount || 1000;
            const post = {
                id: 'w_' + this._uuid(),
                accountId: npc.id,
                npcId: npc.id,
                content,
                images: [],
                type: 'info',
                longContent: null,
                lofterLinkSlug: null,
                repostId: null,
                repostQuote: null,
                topicIds: this._extractTopicIds(content),
                mentionedAccountIds: [],
                translatedFromOfficialInfoId: officialInfo.id,
                translatedFromTweetId: sourceTweet?.id || null,
                translatedSourceModule: 'twitter',
                stats: {
                    likes: Math.floor(Math.random() * fc * 0.08) + 10,
                    comments: Math.floor(Math.random() * fc * 0.02) + 2,
                    reposts: Math.floor(Math.random() * fc * 0.015) + 1
                },
                source: I18n.t('weibo.source_web', '微博网页版'),
                isDraft: false,
                createdAt: Date.now()
            };

            wd.posts.unshift(post);
            Utils.saveData();
            if (this.currentTab === 'home') this.renderHome();
        } catch (err) {
            console.warn('[Weibo] broadcast tweet failed', err);
        }
    },

    // 中文圈情报站杂志专访汉化搬运 —— magazine 点「存入放送局」时触发、零 token 纯模板拼接
    // 触发点选「存入放送局」的合理性：用户已认可翻译质量 + 决定保留 = 该曝光、删除文章不影响已搬运博文
    // 同一篇文章不重复搬运（translatedFromArticleId 去重）；info_station NPC 池空则静默跳过（沉浸感铁律）
    _maybeBroadcastArticleAsWeibo(article, summary) {
        try {
            const wd = AppState.data.weiboData;
            if (!wd || !article || !summary) return;

            // 去重：同一篇文章只搬运一次
            const already = (wd.posts || []).some(p => p.translatedFromArticleId === article.id);
            if (already) return;

            // 找 info_station 类 NPC（中文圈情报站）
            const stations = (wd.fanFriends || []).filter(f => f.type === 'info_station');
            if (stations.length === 0) return;  // 池空、静默跳过

            const npc = stations[Math.floor(Math.random() * stations.length)];

            // 文章类型 → 中文显示名 + 来源描述
            const typeMap = {
                seiyuu:    { label: '声優专访',     source: '杂志声優专访'  },
                interview: { label: '专访',         source: '杂志访谈'      },
                feature:   { label: '角色企划',     source: '杂志角色企划'  },
                column:    { label: '制作专栏',     source: '杂志制作专栏'  },
                charatalk: { label: '角色对谈',     source: '杂志角色对谈'  },
                poll:      { label: '人气投票',     source: '杂志人气投票'  },
                reader:    { label: '读者来信',     source: '杂志读者来信'  },
                chart:     { label: '排行榜',       source: '杂志排行榜'    },
            };
            const typeInfo = typeMap[article.type] || { label: '杂志文章', source: '杂志' };

            // 涉及 NPC（从 broadcast.officialNpcs 查）
            const officialNpcs = AppState.data.broadcast?.officialNpcs || [];
            const involvedNames = (article.npcIds || [])
                .map(id => {
                    const n = officialNpcs.find(o => o.id === id);
                    return n ? `${n.role}${n.name ? '・' + n.name : ''}` : '';
                })
                .filter(Boolean)
                .join(' × ');

            // 节选：summary 是已翻译过的中文压缩、首段 100-150 字
            const trimmed = (summary || '').trim();
            const excerpt = trimmed.length > 150 ? trimmed.slice(0, 150) + '...' : trimmed;
            if (excerpt.length < 20) return;  // 太短没意思、跳过

            // 模板池（随机挑、避免每条都一模一样）
            const intros = ['【杂志情报搬运】', '【杂志汉化】', '【日刊速报】', '【杂志专访汉化】'];
            const outros = [
                '* 个人翻译、欢迎指正',
                '* 部分译文整理、原文请支持正版杂志',
                '* 仅个人翻译、不代表官方立场',
                '* 译文摘要、完整版请购买杂志支持作者'
            ];
            const intro = intros[Math.floor(Math.random() * intros.length)];
            const outro = outros[Math.floor(Math.random() * outros.length)];

            const subjectLine = involvedNames ? `· ${involvedNames}\n` : '';
            const themeLine = article.theme ? `· 主题：${article.theme}\n` : '';
            const content = `${intro}${typeInfo.label}：${article.title || ''}\n${subjectLine}${themeLine}\n节选：${excerpt}\n\n来源：${typeInfo.source}\n${outro}`;

            const fc = npc.followerCount || 1000;
            const post = {
                id: 'w_' + this._uuid(),
                accountId: npc.id,
                npcId: npc.id,
                content,
                images: [],
                type: 'info',
                longContent: null,
                lofterLinkSlug: null,
                repostId: null,
                repostQuote: null,
                topicIds: this._extractTopicIds(content),
                mentionedAccountIds: [],
                translatedFromArticleId: article.id,
                translatedSourceModule: 'magazine',
                stats: {
                    likes: Math.floor(Math.random() * fc * 0.08) + 10,
                    comments: Math.floor(Math.random() * fc * 0.02) + 2,
                    reposts: Math.floor(Math.random() * fc * 0.015) + 1
                },
                source: I18n.t('weibo.source_web', '微博网页版'),
                isDraft: false,
                createdAt: Date.now()
            };

            wd.posts.unshift(post);
            Utils.saveData();
            if (this.currentTab === 'home') this.renderHome();
        } catch (err) {
            console.warn('[Weibo] broadcast magazine article failed', err);
        }
    },

    // 自动生成微博 —— 批量模式：单 LLM 请求生成 count 条、---WEIBO--- 分隔块返回
    // 参考 twitter._generateNpcTweets / forum.generateLeakPost 同款模式（一次请求多段返回）
    // 官方账号走用户手动切换发博、不自动生成；推特官推汉化搬运是事件驱动（用户转存到放送局）→ _scanForBroadcastTweetTranslations
    async _generateNpcWeibos(count, recentPlotSummary = '') {
        let all = (AppState.data.weiboData.fanFriends || []).filter(f => f.type !== 'official');
        if (all.length === 0) return [];

        // 周边闸门：官方未发布任何周边时、跳过 group_organizer / daigou 类型 NPC
        // 他们没业务可发、否则会产生"凭空开团 / 凭空代购"的虚假信息
        const merchGate = this._getMerchGate();
        if (!merchGate.hasAnyGoods) {
            all = all.filter(f => f.type !== 'group_organizer' && f.type !== 'daigou');
            if (all.length === 0) return [];
        }

        const picks = this._pickDiverseNpcs(all, count);
        if (picks.length === 0) return [];

        let raw;
        try {
            const prompt = this._buildBatchWeiboPrompt(picks, recentPlotSummary, merchGate);
            raw = await this._callLLM(prompt);
        } catch (err) {
            console.warn('[Weibo batch] LLM failed', err);
            return [];
        }

        const blocks = this._parseWeiboBatch(raw, picks);
        if (blocks.length === 0) {
            console.warn('[Weibo batch] parsed 0 blocks from LLM response');
            return [];
        }

        const posts = blocks.map((b, i) => this._buildPostFromBlock(b, i));
        posts.forEach(p => AppState.data.weiboData.posts.unshift(p));
        Utils.saveData();

        if (this.currentTab === 'home') this.renderHome();
        return posts;
    },

    // ========== Phase 2: 互动触发 ==========

    _triggerInteractionsForUserPost(post) {
        const followed = (AppState.data.weiboData.fanFriends || []).filter(f => f.followed);
        if (followed.length === 0) return;

        setTimeout(() => this._tickInteraction(post, followed), 800 + Math.random() * 1500);
        setTimeout(() => this._tickInteraction(post, followed), 2500 + Math.random() * 2000);
        setTimeout(() => this._tickInteraction(post, followed), 5000 + Math.random() * 3000);
    },

    async _tickInteraction(post, followedNpcs) {
        if (!followedNpcs.length) return;
        const npc = followedNpcs[Math.floor(Math.random() * followedNpcs.length)];
        const dice = Math.random();
        post.stats = post.stats || { likes: 0, comments: 0, reposts: 0 };

        if (dice < 0.5) {
            post.stats.likes++;
            AppState.data.weiboData.notifications.likes.unshift({
                id: 'lk_' + this._uuid(),
                fromNpcId: npc.id,
                postId: post.id,
                createdAt: Date.now(),
                read: false
            });
        } else if (dice < 0.8) {
            const commentText = await this._generateNpcComment(npc, post).catch(() => null);
            if (commentText) {
                post.stats.comments++;
                AppState.data.weiboData.notifications.comments.unshift({
                    id: 'cm_' + this._uuid(),
                    fromNpcId: npc.id,
                    postId: post.id,
                    content: commentText,
                    createdAt: Date.now(),
                    read: false
                });
            }
        } else if (dice < 0.95) {
            AppState.data.weiboData.notifications.mentions.unshift({
                id: 'at_' + this._uuid(),
                fromNpcId: npc.id,
                postId: post.id,
                content: I18n.t('weibo.mention_placeholder', '回复了你的微博'),
                createdAt: Date.now(),
                read: false
            });
        } else {
            const dms = AppState.data.weiboData.notifications.dms = AppState.data.weiboData.notifications.dms || [];
            const existing = dms.find(d => d.npcId === npc.id);
            const msg = { from: npc.id, content: I18n.t('weibo.dm_placeholder', '看了你的微博、想聊一下'), createdAt: Date.now() };
            if (existing) {
                existing.messages.push(msg);
            } else {
                dms.unshift({
                    id: 'dm_' + this._uuid(),
                    npcId: npc.id,
                    messages: [msg],
                    lastReadAt: 0
                });
            }
        }

        Utils.saveData();
        if (this.currentTab === 'home') this.renderHome();
        if (this.currentTab === 'notif') this.renderNotif();
    },

    async _generateNpcComment(npc, post) {
        const prompt = `你是中国微博用户「${npc.name}」(@${npc.handle})、简介：${npc.bio}。
你看到了一条微博、内容是：「${post.content.slice(0, 200)}」
请生成一句 5-30 字的简短评论、风格温和、贴合你的人设。
【铁律】必须使用简体中文输出。严禁繁体字、严禁日语、严禁英语整句。
直接输出评论文字、不要引号、不要 prefix。`;
        return await this._callLLM(prompt, { temperature: 0.9, maxTokens: 200 });
    },

    _triggerOfficialReactions(post) {
        const all = AppState.data.weiboData.fanFriends || [];
        const fans = all.filter(f =>
            ['fan_writer', 'cp_fan', 'daily_fan', 'fan_artist'].includes(f.type)
        );
        if (!fans.length) return;
        const reactingFans = fans.filter(() => Math.random() < 0.7);
        reactingFans.forEach((fan, i) => {
            setTimeout(() => this._tickFanReactionToOfficial(post, fan), 500 + i * 800 + Math.random() * 1500);
        });
    },

    _tickFanReactionToOfficial(post, fan) {
        const dice = Math.random();
        post.stats = post.stats || { likes: 0, comments: 0, reposts: 0 };
        if (dice < 0.6) post.stats.likes++;
        else if (dice < 0.9) post.stats.comments++;
        else post.stats.reposts++;
        Utils.saveData();
        if (this.currentTab === 'home') this.renderHome();
    },

    // ========== Phase 3: 超话自动播种 ==========

    _maybeSeedTopics() {
        const wd = AppState.data.weiboData;
        const cp = AppState.data.broadcast?.cpSettings || {};
        const currentPlotId = AppState.data.recentEvents?.[0]?.id || null;

        if ((wd.topics || []).length > 0 && wd._lastTopicSeedPlotId === currentPlotId) return;
        if (!cp.cpCharA && !cp.cpCharB && !cp.productionName) return;

        const newTopics = [];

        if (cp.productionName) {
            const exists = (wd.topics || []).some(t => t.type === 'production' && t.name.includes(cp.productionName));
            if (!exists) {
                newTopics.push({
                    id: 'tp_' + this._uuid(),
                    name: `《${cp.productionName}》`,
                    type: 'production',
                    description: `${cp.productionName}同人创作交流`, // v2.73.8: i18n 黑名单 — 不走 I18n.t，避免存进 topic 后喂回 LLM 时混入非简中字符串
                    coverColor: '#ff5544',
                    memberCount: 2000 + Math.floor(Math.random() * 8000),
                    postCount: 0,
                    createdAt: Date.now()
                });
            }
        }
        if (cp.cpNickname || (cp.cpCharA && cp.cpCharB)) {
            const cpName = cp.cpNickname || `${cp.cpCharA}×${cp.cpCharB}`;
            const exists = (wd.topics || []).some(t => t.type === 'cp' && t.name === cpName);
            if (!exists) {
                newTopics.push({
                    id: 'tp_' + this._uuid(),
                    name: cpName,
                    type: 'cp',
                    description: `${cpName} CP 主题讨论`, // v2.73.8: i18n 黑名单
                    coverColor: '#9c27b0',
                    memberCount: 500 + Math.floor(Math.random() * 3000),
                    postCount: 0,
                    createdAt: Date.now()
                });
            }
        }
        [cp.cpCharA, cp.cpCharB].forEach(charName => {
            if (!charName) return;
            const exists = (wd.topics || []).some(t => t.type === 'character' && t.name === charName);
            if (exists) return;
            newTopics.push({
                id: 'tp_' + this._uuid(),
                name: charName,
                type: 'character',
                description: `${charName}角色超话`, // v2.73.8: i18n 黑名单
                coverColor: '#2196f3',
                memberCount: 300 + Math.floor(Math.random() * 1500),
                postCount: 0,
                createdAt: Date.now()
            });
        });

        if (newTopics.length > 0) {
            wd.topics = (wd.topics || []).concat(newTopics);
            wd._lastTopicSeedPlotId = currentPlotId;
            Utils.saveData();
            console.log(`[Weibo topics] seeded ${newTopics.length} topics`);
        }
    },

    // ========== Phase 3: 热搜动态生成 ==========

    async _maybeSeedHotsearch(recentPlotSummary = '') {
        // v2.73.10: in-flight guard — 防快速连点刷新触发并发 hotsearch LLM 调用（_refreshing 锁不覆盖 fire-and-forget 的 hotsearch）
        if (this._hotsearchSeeding) return;
        const cp = AppState.data.broadcast?.cpSettings || {};
        const worldCtx = this._getWorldContext();
        if (!worldCtx) return;
        this._hotsearchSeeding = true;

        const prompt = `生成 10 条中国微博热搜词、风格仿真：
- 世界观：${worldCtx}
- 主要 CP：${cp.cpNickname || '无'}
- 作品：${cp.productionName ? `《${cp.productionName}》` : '无'}
- 最近剧情：${recentPlotSummary || '无'}

要求：
- 每条热搜 6-15 字、简短抓眼球
- 类型分布：
  - 3 条剧情/作品相关（type='plot'）
  - 2 条 CP 相关（type='cp'）
  - 4 条娱乐/社会/财经中性底噪（type='noise'、如「xx 演员官宣」「xx 城市暴雨」等通用词、跟当前剧情无关）
  - 1 条平台推广位（type='platform'、如「微博会员 9 折」「少年说」）
- 标签：约 2 条「hot」、1 条「boom」、2 条「new」、其余 null

输出严格 JSON 数组、每个元素：
{ "title": "热搜词", "type": "plot", "tag": "hot" }

【铁律】title 字段必须使用简体中文。严禁繁体字、严禁日语、严禁英语整句（个别专有名词如品牌名可保留英文）。
只输出 JSON、不要 markdown 代码块标记、不要其他文字。`;

        try {
            const response = await this._callLLM(prompt, { temperature: 0.9, maxTokens: 1500 });
            const items = this._parseHotsearchJson(response);
            if (items.length > 0) {
                AppState.data.weiboData.hotsearch = items.map((h, i) => ({
                    id: 'hot_' + this._uuid(),
                    title: h.title,
                    rank: i + 1,
                    type: h.type || 'noise',
                    tag: h.tag || null,
                    topicId: null,
                    createdAt: Date.now()
                }));
                Utils.saveData();
                if (this.currentTab === 'discover' && (this._discoverSubTab || 'trend') === 'trend') {
                    this._renderDiscoverContent('trend');
                }
            }
        } catch (err) {
            console.warn('[Weibo hotsearch]', err);
        } finally {
            this._hotsearchSeeding = false;
        }
    },

    _parseHotsearchJson(text) {
        if (!text) return [];
        let s = text.trim();
        const m1 = s.match(/```json\s*([\s\S]*?)```/) || s.match(/```\s*([\s\S]*?)```/);
        if (m1) s = m1[1].trim();
        const m2 = s.match(/\[[\s\S]*\]/);
        if (m2) s = m2[0];
        try {
            const arr = JSON.parse(s);
            return Array.isArray(arr) ? arr : [];
        } catch (err) {
            return [];
        }
    }
};

// ========== WeiboApiSettings 子模块（独立 API 设置）==========

const WeiboApiSettings = {
    PRESETS: {
        deepseek: { url: 'https://api.deepseek.com', hint: '使用 DeepSeek 官方 API。中文场景推荐、价格便宜（v4-flash 量大用 / v4-pro 文笔好）' },
        openai:   { url: 'https://api.openai.com', hint: '使用 OpenAI 官方 API' },
        google:   { url: 'https://generativelanguage.googleapis.com', hint: '使用 Google Gemini API' },
        claude:   { url: 'https://api.anthropic.com', hint: '使用 Claude 官方 API' }
    },

    init() {
        const o = AppState.data.weiboData?.apiOverride || {};
        const enabled = document.getElementById('wbApiEnabled');
        const mode = document.getElementById('wbApiMode');
        const url = document.getElementById('wbApiUrl');
        const key = document.getElementById('wbApiKey');
        const model = document.getElementById('wbApiModel');
        const fetchBtn = document.getElementById('wbApiFetchModels');
        const saveBtn = document.getElementById('wbApiSave');
        if (!enabled || !mode || !url || !key || !model) return;

        enabled.checked = !!o.enabled;
        mode.value = o.mode || 'deepseek';
        url.value = o.baseUrl || this.PRESETS[mode.value].url;
        key.value = o.apiKey || '';
        model.value = o.model || '';

        this._showHint(mode.value);

        mode.onchange = () => {
            url.value = this.PRESETS[mode.value].url;
            model.value = '';
            this._showHint(mode.value);
        };

        fetchBtn.onclick = () => this._fetchModels(mode.value, url.value, key.value, model);
        saveBtn.onclick = () => this._save(enabled.checked, mode.value, url.value, key.value, model.value);
    },

    _showHint(modeVal) {
        const card = document.getElementById('weiboApiCard');
        if (!card) return;
        const oldHint = card.querySelector('.wb-api-hint');
        if (oldHint) oldHint.remove();
        const hint = document.createElement('p');
        hint.className = 'wb-api-hint';
        hint.style.cssText = 'font-size:11px; color:#999; padding:0 16px 8px; margin:0;';
        hint.textContent = '* ' + (this.PRESETS[modeVal]?.hint || '');
        const card_header = card.querySelector('.card-header');
        if (card_header) card_header.insertAdjacentElement('afterend', hint);
    },

    async _fetchModels(mode, baseUrl, apiKey, modelInput) {
        if (!apiKey) { Utils.showToast(I18n.t('settings.weibo_api_key_required', '请先填写 API Key')); return; }
        let url = baseUrl.replace(/\/$/, '');
        const listEl = document.getElementById('wbApiModelsList');
        if (listEl) listEl.innerHTML = `<div style="font-size:13px; color:#999;">${I18n.t('settings.weibo_api_fetching', '获取模型中...')}</div>`;

        try {
            let models = [];
            if (mode === 'google') {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                models = (data.models || []).filter(m => m.name?.includes('gemini')).map(m => m.name.replace('models/', ''));
            } else if (mode === 'claude') {
                models = [
                    'claude-opus-4-5-20251101',
                    'claude-sonnet-4-5-20250929',
                    'claude-sonnet-3-5-20241022',
                    'claude-3-5-sonnet-20240620',
                    'claude-3-haiku-20240307'
                ];
            } else {
                // OpenAI 兼容（含 DeepSeek）
                const res = await fetch(url + '/v1/models', {
                    headers: { 'Authorization': 'Bearer ' + apiKey }
                });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                models = (data.data || data.models || []).map(m => m.id || m.name || m);
            }

            if (models.length === 0) {
                if (listEl) listEl.innerHTML = `<div style="font-size:13px; color:#999;">${I18n.t('settings.weibo_api_no_models', '未获取到模型列表')}</div>`;
                return;
            }

            if (listEl) {
                listEl.innerHTML = '<div style="font-size:12px; color:#666; margin-bottom:6px;">' + I18n.t('settings.weibo_api_pick_model', '点击选择模型：') + '</div>' +
                    models.map(m => `<button class="wb-model-pick-btn" data-model="${m}">${m}</button>`).join('');
                listEl.querySelectorAll('.wb-model-pick-btn').forEach(btn => {
                    btn.onclick = () => {
                        modelInput.value = btn.dataset.model;
                        Utils.showToast(I18n.t('settings.weibo_api_model_selected', '已选择：') + btn.dataset.model);
                    };
                });
            }
        } catch (err) {
            console.warn('[WeiboApiSettings] fetch failed', err);
            if (listEl) listEl.innerHTML = `<div style="font-size:13px; color:#ff5544;">${I18n.t('settings.weibo_api_fetch_failed', '获取失败：') + err.message}</div>`;
        }
    },

    _save(enabled, mode, baseUrl, apiKey, model) {
        AppState.data.weiboData.apiOverride = {
            enabled,
            mode,
            baseUrl: baseUrl.trim(),
            apiKey: apiKey.trim(),
            model: model.trim(),
            sharedWithLofter: true
        };
        Utils.saveData();
        Utils.showToast(I18n.t('settings.weibo_api_saved', '中文同人圈 API 已保存'));
    }
};
