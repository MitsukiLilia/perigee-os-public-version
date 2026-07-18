// twitter-thread.js — 从 js/twitter.js 纯搬运拆出（v2.197.0，架构报告 P1-⑥）。
// 内容零改动；加载顺序：twitter.js → thread → social → spaces → profile（见 index.html）。
Object.assign(Twitter, {
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
        ${this._renderAvatar({ image: identity.avatarImage, letter: avatarLetter, color: avatarColor, classes: opAvatarCls, onclick: opProfileOnclick })}
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
        : `<div class="tw-image-card tw-image-placeholder" style="background:${tweet.image.gradient || 'linear-gradient(135deg,#667eea,#764ba2)'};">
            <img src="${this._imgPlaceholder(tweet.id)}" class="tw-placeholder-img" alt="" loading="lazy">
            ${tweet.image.description ? `<span class="tw-image-desc tw-image-desc-overlay">${this._esc(tweet.image.description)}</span>` : ''}
           </div>`) : ''}
    ${this._renderQuotedTweetHtml(tweet)}
    ${tweet.poll ? this._renderPoll(tweet) : ''}
    ${this._renderPixivLinkCard(tweet)}
    ${this._renderNicoLinkCard(tweet)}
    ${(typeof Wandoro !== 'undefined') ? Wandoro._renderGatedLinkCard(tweet) : ''}
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
        this._loadNicoThumbs(content);

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
        } finally {
            this._removeReplySkeletons();
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
                clearTimeout(timer);
                const d = audio.duration;
                if (blobOrUrl instanceof Blob) URL.revokeObjectURL(objUrl);
                resolve(isFinite(d) ? d : 0);
            };
            audio.onerror = () => {
                clearTimeout(timer);
                if (blobOrUrl instanceof Blob) URL.revokeObjectURL(objUrl);
                reject(new Error('audio load failed'));
            };
            // 5s 超时
            const timer = setTimeout(() => {
                if (blobOrUrl instanceof Blob) URL.revokeObjectURL(objUrl);
                try { audio.src = ''; } catch {}
                resolve(0);
            }, 5000);
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
            // pop 动画挂一次性 class：只在「刚点赞」瞬间弹，重渲已点赞状态不弹
            btn.classList.toggle('tw-like-pop', r.likedByUser);
            if (r.likedByUser) btn.addEventListener('animationend', () => btn.classList.remove('tw-like-pop'), { once: true });
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

    // 图片加载失败：url 型外链多为离线等瞬时原因 → 仅提示不删数据；
    // local 型内嵌 dataURL 本身损坏才是确定性问题 → 走删除清理路径
    _handleBrokenUserImage(tweetId, isNpc) {
        const t = this._ensureData();
        const arr = isNpc ? (t.npcTweets || []) : (t.tweets || []);
        const tweet = arr.find(tw => tw.id === tweetId);
        if (!tweet || !tweet.userImage) return;
        if (tweet.userImage.type === 'url') {
            Utils.showToast(I18n.t('t.tw_image_load_failed', '画像を読み込めません'), 3000);
            return;
        }
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

        // 取音频源：本地型从 IDB 取 blob，确实取不到（确定性损坏）才走删除清理路径
        let objUrl = null;
        let src;
        if (tweet.userAudio.type === 'local') {
            let blob = null;
            try {
                if (typeof TTSEngine === 'undefined') throw new Error('audioStore unavailable');
                blob = await TTSEngine.getAudio(tweet.userAudio.audioId);
            } catch (e) {
                // IDB 读取抛错可能是瞬时故障（隐私模式/数据库被占用），不能当确定性损坏删数据
                console.error('[Audio]', e);
                Utils.showToast(I18n.t('t.tw_audio_play_failed_msg', '音声を再生できません：') + e.message, 4000);
                return;
            }
            if (!blob) {
                // IDB 干净地返回空 = blob 确实已丢失，才走删除清理路径
                Utils.showToast(I18n.t('t.tw_audio_load_failed', '音声を読み込めません'), 3000);
                this._handleBrokenUserAudio(tweetId, isNpc);
                return;
            }
            objUrl = URL.createObjectURL(blob);
            src = objUrl;
        } else {
            src = tweet.userAudio.url;
        }

        // 加载并播放：失败多为瞬时原因（解码不支持/离线加载/播放权限过期），仅提示不删数据
        try {
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
                this._activeTwAudio = null;
                this._activeTwAudioId = null;
                Utils.showToast(I18n.t('t.tw_audio_load_failed', '音声を読み込めません'), 3000);
                this._updateAudioPlayerUI(tweetId);
            });
            audio.addEventListener('loadedmetadata', () => this._updateAudioPlayerUI(tweetId));
            await audio.play();
            this._updateAudioPlayerUI(tweetId);
        } catch (e) {
            if (objUrl) URL.revokeObjectURL(objUrl);
            console.error('[Audio]', e);
            Utils.showToast(I18n.t('t.tw_audio_play_failed_msg', '音声を再生できません：') + e.message, 4000);
            if (this._activeTwAudioId === tweetId) {
                this._activeTwAudio = null;
                this._activeTwAudioId = null;
            }
            this._updateAudioPlayerUI(tweetId);
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

        const npcDir = shuffled.map(n => `- @${this._getNpcHandle(n).replace(/^@/, '')} ／ ${n.role || ''} ／ ${n.name || n.role}${n.bio ? ' ／ ' + n.bio : ''}${Utils.PROMPTS.npcPersonaInline(n)}`).join('\n');

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
- 各人物の職業・人格を活かした口調にすること（例：声優なら「演じてる側として〜」、監督なら「現場では〜」）。「└ 設定:」がある人物はその性格・発言スタイル（一人称・口癖・絵文字の癖など）を最優先で再現すること
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
            const timestamp = Math.max(tweet.timestamp + 1000, baseTime + offset);
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
        if (active === 'twitter-npc-profile') this.renderNpcProfile?.();
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
        // 顺手清掉生成图 blob（NPC art 推）
        if (tweet?.image?.generatedImageId && typeof IllustGallery !== 'undefined') {
            IllustGallery.remove(tweet.image.generatedImageId).catch(() => {});
        }
        // 顺手清掉 poipiku 揭示图 blob（v2.210.1：gated.contentId，公开版无 wandoro.js 时字段恒空、天然 no-op）
        if (tweet?.gated?.contentId && typeof IllustGallery !== 'undefined') {
            IllustGallery.remove(tweet.gated.contentId).catch(() => {});
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

});
