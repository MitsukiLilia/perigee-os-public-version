// twitter-profile.js — 从 js/twitter.js 纯搬运拆出（v2.197.0，架构报告 P1-⑥）。
// 内容零改动；加载顺序：twitter.js → thread → social → spaces → profile（见 index.html）。
Object.assign(Twitter, {
    // ===== ユーザープロフィール =====
    _userProfileTab: 'tweets',

    openUserProfile() {
        this._userProfileTab = 'tweets';
        Navigation.goTo('twitter-user-profile');
    },

    // ===== ブロックリスト管理（v2.216：action sheet 复用，点条目=解除）=====
    openBlockList() {
        const t = this._ensureData();
        const blocked = t.blockedUsers || [];
        const reported = t.reportedUsers || [];
        if (!blocked.length && !reported.length) {
            Utils.showToast(I18n.t('tw.blocklist_empty', 'ブロック中のアカウントはありません'));
            return;
        }
        const blockedItems = blocked.map(b => ({
            label: `${b.author || '？'}（${b.handle || '@?'}）`,
            icon: this._svg.ban,
            onClick: () => {
                if (!confirm(I18n.t('tw.confirm_unblock', {name: b.author || b.handle || '?'}))) return;
                t.blockedUsers = (t.blockedUsers || []).filter(x => x !== b);
                Utils.saveData();
                Utils.showToast(I18n.t('tw.toast_unblocked', 'ブロックを解除しました'));
                const profileEl = document.getElementById('twitter-user-profile');
                if (profileEl?.classList.contains('active')) this.renderUserProfile();
            }
        }));
        const reportedItems = reported.map(b => ({
            label: `${b.author || '？'}（${b.handle || '@?'}）・${I18n.t('tw.blocklist_reported_tag', '通報済み')}`,
            icon: this._svg.flag,
            onClick: () => {
                if (!confirm(I18n.t('tw.confirm_unreport', {name: b.author || b.handle || '?'}))) return;
                t.reportedUsers = (t.reportedUsers || []).filter(x => x !== b);
                Utils.saveData();
                Utils.showToast(I18n.t('tw.toast_unreported', '通報を取り消しました'));
                const profileEl = document.getElementById('twitter-user-profile');
                if (profileEl?.classList.contains('active')) this.renderUserProfile();
            }
        }));
        this._actionSheet([...blockedItems, ...reportedItems], { title: I18n.t('tw.blocklist_title', 'ブロック中のアカウント') });
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
        <button class="tw-service-btn" onclick="Navigation.goTo('twitter-poipiku')">${this._svg.palette} ${I18n.t('tw.title_poipiku', 'Poipiku')}</button>
        <button class="tw-service-btn" onclick="Twitter.openBlockList()">${this._svg.ban} ${I18n.t('tw.profile_blocklist', 'ブロック中')}${((t.blockedUsers || []).length + (t.reportedUsers || []).length) ? ` (${(t.blockedUsers || []).length + (t.reportedUsers || []).length})` : ''}</button>
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
役職：${npc.role}${(() => { const p = Utils.PROMPTS.npcPersonaOneLine(npc); return p ? `\n人物設定（口調・人柄・絵文字の癖はこれを最優先で再現すること）：${p}` : ''; })()}

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
    <div class="tw-profile-meta">${this._svg.calendar} ${I18n.t('tw.profile_using_x_since', {date: joinDate})}</div>
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

    // ===== v2.121.0 时间线推文の pixiv 小说リンクカード（app 内ジャンプ） =====
    // 旧実装は外部 URL(<a href target=_blank>)で必ず死リンク化していた（内部 id を真 pixiv の数字 id と勘違いした URL）。
    // 微博→lofter と同様に内部 novel id で app 内リーダーへ遷移する。id が実在する novel を指す時だけカードを表示（死カード防止）。
    _resolvePixivNovelId(tweet) {
        if (!tweet) return null;
        let id = tweet.pixivNovelId || null;
        // 後方互換: 旧 tweet は pixivLink(外部 URL)しか持たない → URL から id を抽出
        if (!id && tweet.pixivLink) {
            const m = String(tweet.pixivLink).match(/[?&]id=([^&\s]+)/);
            id = m ? decodeURIComponent(m[1]) : null;
        }
        if (!id) return null;
        // 実在チェック: app 内に該当 novel が無ければ（LLM の捏造 id 等）カードを出さない
        const exists = (AppState.data.pixivData?.novels || []).some(n => n.id === id);
        return exists ? id : null;
    },

    _renderPixivLinkCard(tweet) {
        const id = this._resolvePixivNovelId(tweet);
        const novels = (AppState.data.pixivData && AppState.data.pixivData.novels) || [];
        // 状态A：小说已存在 → 完整丰富卡（真推特风 pixiv embed）
        if (id) {
            const novel = novels.find(n => n.id === id);
            if (novel) {
                return this._pixivRichCard(novel, tweet, `Twitter._openPixivNovel('${this._esc(id)}')`, null);
            }
        }
        // 状态B：v2.122.0 链路B 自宣推但小说尚未生成 → teaser 卡（点击时懒生成、封面占位、简介取推文）
        if (tweet && tweet.pixivPromo && tweet.id) {
            return this._pixivRichCard(null, tweet, `Twitter._openPromoNovel('${this._esc(tweet.id)}', this)`, tweet.id);
        }
        return '';
    },

    // v2.124.0 真推特风 pixiv embed 丰富卡：左封面（标题+作者+R18角标）｜右简介/tags ｜底 pixiv.net 来源行
    // novel 为 null = 链路B 未生成的 teaser 卡（封面书图标占位、简介取推文）；promoTweetId 非空 = teaser（挂 data-promo-tweet 给懒生成 loading 复用）
    _pixivRichCard(novel, tweet, onclick, promoTweetId) {
        const strip = s => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        const isPromo = !!(tweet && tweet.pixivPromo);   // 链路B：用来源推文正文当简介
        const r18 = this._pixivIsR18(novel, tweet);
        const r18Badge = r18 ? `<span class="tw-pixiv-r18">R-18</span>` : '';
        // 封面：有 novel 用标题文字（复用米色书封观感）；teaser 用书 SVG 占位
        const coverInner = novel
            ? `<span class="tw-pixiv-cover-text">${this._esc(strip(novel.title))}</span>${novel.author ? `<span class="tw-pixiv-cover-author">${this._esc(strip(novel.author))}</span>` : ''}`
            : `<span class="tw-pixiv-cover-ph">${this._svg.book}</span>`;
        // 右侧：链路B（含 teaser）用推文正文当简介；Link A 已生成的用 tags 兜底、避免空白
        let bodyInner = '';
        if (isPromo && tweet && tweet.content) {
            bodyInner = `<div class="tw-pixiv-syn">${this._esc(strip(tweet.content).slice(0, 90))}</div>`;
        } else if (novel) {
            const tags = (novel.tags || []).slice(0, 3).map(t => `#${this._esc(strip(t).replace(/^#/, ''))}`).join(' ');
            bodyInner = tags
                ? `<div class="tw-pixiv-tags">${tags}</div>`
                : `<div class="tw-pixiv-syn">${this._esc(strip(novel.title))}</div>`;
        }
        const promoAttr = promoTweetId ? ` data-promo-tweet="${this._esc(promoTweetId)}"` : '';
        return `<div class="tw-pixiv-link-card tw-pixiv-rich"${promoAttr} onclick="event.stopPropagation();${onclick}" role="link" tabindex="0">
            <div class="tw-pixiv-main">
                <div class="tw-pixiv-cover">${r18Badge}${coverInner}</div>
                <div class="tw-pixiv-body">${bodyInner}</div>
            </div>
            <div class="tw-pixiv-source">${this._svg.book}<span>pixiv.net</span></div>
        </div>`;
    },

    // v2.124.0 R-18 判定：作者「真的才有」——检测 tags/标题/推文里的成人标记，命中才挂角标（小甜饼/日常不挂）
    _pixivIsR18(novel, tweet) {
        const re = /R-?18|18\s*禁|成人(?:向|済)|18\s*\+|全年齢対象外|ＮＳＦＷ|NSFW/i;
        const hay = [
            novel && novel.title,
            novel && (novel.tags || []).join(' '),
            tweet && tweet.content
        ].filter(Boolean).join(' ');
        return re.test(hay);
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

    // ===== v2.122.0 链路B: 自宣推 pixiv 小说懒生成（点击时现场生成） =====
    async _openPromoNovel(tweetId, cardEl) {
        const t = this._ensureData();
        const tweet = (t.npcTweets || []).find(tw => tw.id === tweetId);
        if (!tweet) return;
        // 既に生成済み（実在）→ そのまま開く
        if (tweet.pixivNovelId && (AppState.data.pixivData?.novels || []).some(n => n.id === tweet.pixivNovelId)) {
            this._openPixivNovel(tweet.pixivNovelId);
            return;
        }
        // 二重タップ防止（in-memory、データには書かない）
        this._generatingPromo = this._generatingPromo || new Set();
        if (this._generatingPromo.has(tweetId)) return;
        this._generatingPromo.add(tweetId);
        // カードを生成中表示に
        let card = null, origHtml = null;
        // 优先用被点击的卡片元素本身（同一推文可能在多个隐藏 screen 里都渲染了同 id 卡片）
        if (cardEl && cardEl.classList && cardEl.classList.contains('tw-pixiv-link-card')) card = cardEl;
        if (!card) { try { card = document.querySelector(`.tw-pixiv-link-card[data-promo-tweet="${CSS.escape(tweetId)}"]`); } catch (e) {} }
        if (card) {
            origHtml = card.innerHTML;
            card.classList.add('tw-pixiv-link-loading');
            card.innerHTML = `<div class="tw-pixiv-link-icon spinning">${this._svg.loader || this._svg.book}</div><div class="tw-pixiv-link-text">${I18n.t('tw.pixiv_promo_generating', '生成中…')}</div>`;
        }
        try {
            const novelId = (typeof PixivNovel !== 'undefined' && PixivNovel.generateFromTweet)
                ? await PixivNovel.generateFromTweet(tweet) : null;
            if (novelId) {
                tweet.pixivNovelId = novelId;
                Utils.saveData();
                this._openPixivNovel(novelId);
            } else {
                Utils.showToast(I18n.t('tw.pixiv_promo_failed', '作品の生成に失敗しました'));
                if (card && origHtml != null) { card.classList.remove('tw-pixiv-link-loading'); card.innerHTML = origHtml; }
            }
        } catch (e) {
            console.warn('[PromoNovel] generation failed:', e);
            Utils.showToast(I18n.t('tw.pixiv_promo_failed', '作品の生成に失敗しました'));
            if (card && origHtml != null) { card.classList.remove('tw-pixiv-link-loading'); card.innerHTML = origHtml; }
        } finally {
            this._generatingPromo.delete(tweetId);
        }
    },

    // ===== Seedance PV：官方宣传推文 + nico 链接卡片（app 内跳转） =====
    // VideoGen._onSucceeded から呼ばれる（tweetAccountId が null/'' の場合は呼び出し側で弾く）。
    // task.tweetAccountId: officialNpcs の npc.id | 'AUTO_CREATE'
    // pk: VideoGen.parsePackaging の結果 or _onSucceeded 側の占位フォールバック（tweetText/officialHandle/officialName は null あり得る）
    // video: Niconico.addRealVideo の返り値（id/title/videoBlobId 持ち）
    postOfficialPVTweet(task, pk, video) {
        const t = this._ensureData();
        if (!AppState.data.broadcast.officialNpcs) AppState.data.broadcast.officialNpcs = [];
        const npcs = AppState.data.broadcast.officialNpcs;

        let npc = null;
        if (task.tweetAccountId === 'AUTO_CREATE') {
            // 包装 LLM が起こした handle（無ければ既定値）で公式Twitter NPC を新規作成。
            // 条目形態は forum.saveNpc の公式Twitter 保存と同構：{id, role, name, handle}、name は空
            //（公式アカウントは中の人名を持たない — Task 6 の語義。表示は handle/role フォールバック）。
            // role は現在言語の「公式Twitter」i18n 値 — Forum._isOfficialTwitterRole は三語とも substring 命中。
            const handle = String(pk.officialHandle || '').replace(/^@+/, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 20) || 'anime_official';
            npc = { id: Utils.generateId(), role: I18n.t('forum.role_official_twitter'), name: '', handle };
            npcs.push(npc);
            task.tweetAccountId = npc.id;   // 回填：以後この task は実 NPC を指す
        } else {
            npc = npcs.find(n => n.id === task.tweetAccountId);
            if (!npc) return;   // NPC 已删 → 静默不发推（沉浸感铁律：不弹错误）
        }

        // 推文条目：官方推文の現場 schema = npcTweets + source:'staff' + npcId（_generateNpcTweets :1072 と同構）。
        // nicoVideoId が PV 宣伝カードの唯一フラグ（_renderNicoLinkCard が拾う）。
        const eng = this._genEngagement('staff');
        t.npcTweets = t.npcTweets || [];
        t.npcTweets.push({
            id: Utils.generateId(),
            source: 'staff',
            npcId: npc.id,
            content: pk.tweetText || (video.title + ' 公開！'),
            image: null,
            translation: null,
            mentionsNpcHandle: null,
            quotedTweetId: null,
            quotedTweetIsNpc: false,
            afterPlotId: null,
            nicoVideoId: video.id,   // ← nico リンクカード（横条卡+跳转）用
            timestamp: Date.now(),
            replies: [],
            likes: eng.likes,
            retweets: eng.retweets,
            savedToForumId: null
        });
        Utils.saveData();
        this._refreshTwitterViews();   // 推特前台时就地刷新（内部で active screen 判定、非前台は no-op）
    },

    // nico リンクカード：tweet.nicoVideoId が実在の niconico 動画を指す時だけ描画。
    // 動画已删 → カード自体不渲染（pixiv 小説カード _resolvePixivNovelId の存在性校验と同じ流儀、死卡防止）。
    // 横条卡 = 左サムネ（thumb blob 非同期充填、無ければ hash 色块）+ 右タイトル2行 + 灰字 nicovideo.jp
    _renderNicoLinkCard(tweet) {
        if (!tweet || !tweet.nicoVideoId) return '';
        const v = (AppState.data.niconicoData?.videos || []).find(x => x.id === tweet.nicoVideoId);
        if (!v) return '';
        // hash 色块（niconico._hashColor と同式）— サムネ到着前の背景 / 抽帧失败时的兜底
        let h = 0;
        const str = v.title || '';
        for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
        const bg = `hsl(${Math.abs(h) % 360}, 32%, 42%)`;
        const thumbImg = v.videoBlobId ? `<img src="" data-nico-thumb-id="${this._esc(v.videoBlobId)}" class="tw-nico-thumb-img" alt="">` : '';
        return `<div class="tw-nico-link-card" onclick="event.stopPropagation();Twitter._openNicoVideo('${this._esc(v.id)}')" role="link" tabindex="0">
            <div class="tw-nico-thumb" style="background:${bg};">${this._svg.tv}${thumbImg}</div>
            <div class="tw-nico-meta">
                <div class="tw-nico-title">${this._esc(v.title)}</div>
                <div class="tw-nico-domain">nicovideo.jp</div>
            </div>
        </div>`;
    },

    // サムネ非同期充填：data-nico-thumb-id 持ちの <img> に VideoGen の thumb blob URL を入れる
    //（thumb 無し = 抽帧失败は何もしない → hash 色块のまま。niconico._loadVideoThumbs と同じ流儀）
    async _loadNicoThumbs(container) {
        if (!container || typeof VideoGen === 'undefined') return;
        const imgs = container.querySelectorAll('img.tw-nico-thumb-img[data-nico-thumb-id]');
        for (const img of imgs) {
            const blobId = img.dataset.nicoThumbId;
            if (!blobId) continue;
            try {
                const url = await VideoGen.getUrl('thumb:' + blobId);
                if (url) img.src = url;
            } catch (e) { /* 読み込み失敗は無視、hash 色块のまま */ }
        }
    },

    // カード点击 → niconico 詳情（openVideo が currentVideoId 設定 + 各プレイヤー停止 + goTo('niconico-detail')）
    _openNicoVideo(videoId) {
        if (typeof Niconico === 'undefined' || !Niconico.openVideo) return;
        Niconico.openVideo(videoId);
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
    <div class="tw-profile-meta">${this._svg.calendar} ${I18n.t('tw.profile_using_x_since', {date: joinDate})}</div>
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
                    : `<span class="tw-space-archived-badge" style="margin-bottom:0;">${this._svg.radio}</span>`;
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
                <div style="margin-bottom:12px;">${this._svg.paletteLg}</div>
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
                            <button class="glass-btn" onclick="Twitter.generatePoipikuPost()" style="flex:1;">${this._svg.sparkles} ${I18n.t('tw.pp_ai_gen', 'AI生成')}</button>
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
});
