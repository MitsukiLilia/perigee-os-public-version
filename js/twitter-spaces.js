// twitter-spaces.js — 从 js/twitter.js 纯搬运拆出（v2.197.0，架构报告 P1-⑥）。
// 内容零改动；加载顺序：twitter.js → thread → social → spaces → profile（见 index.html）。
Object.assign(Twitter, {
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
        this._refreshTwitterViews();
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

    // 画像プレースホルダー：AI画像未生成時、汎用webp×5を tweet.id で安定ローテーション（同じ投稿は常に同じ絵柄）
    _imgPlaceholders: [
        './assets/textures/tw-placeholder/1.webp',
        './assets/textures/tw-placeholder/2.webp',
        './assets/textures/tw-placeholder/3.webp',
        './assets/textures/tw-placeholder/4.webp',
        './assets/textures/tw-placeholder/5.webp',
    ],
    _imgPlaceholder(seed) {
        const list = this._imgPlaceholders;
        const s = String(seed || '');
        let h = 0;
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return list[h % list.length];
    },

    // ===== 画像生成API連携 =====

    _hasImageApi() {
        const config = AppState.data.imageApiConfig;
        const modules = AppState.data.imageGenModules || {};
        return !!(config && config.key && config.provider && modules.twitter !== false);
    },

    // 世界書からキャラクター外見情報を抽出（推文全文 + IMAGE_DESC で照合）
    // excludeNames: 已有预存外貌 tag 的角色名 —— 其条目（title 精确匹配）不再塞给 LLM，省 token
    _extractCharacterAppearance(tweetContent, imageDesc, excludeNames) {
        const wbIds = Utils.getActiveWorldBookIds();
        if (wbIds.length === 0) return '';
        const excluded = excludeNames || [];

        const allEntries = [];
        wbIds.forEach(wbId => {
            const book = (AppState.data.worldBooks || []).find(b => b.id === wbId);
            if (book && book.entries) {
                book.entries.filter(e => e.enabled !== false).forEach(e => {
                    if (excluded.includes((e.title || '').trim())) return;
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
        const storedChars = PixivIllust.getStoredCharTags();
        const charAppearance = this._extractCharacterAppearance(tweetContent, imageDesc, storedChars.map(c => c.name));

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
- Keep each section under 40 words${PixivIllust.fixedCharPromptSection(storedChars)}`;

        const userMsg = `Tweet content (for context): ${tweetContent || imageDesc}
Image description: ${imageDesc}
${charAppearance ? `\nCharacter appearance database:\n${charAppearance}` : ''}

Generate image tags (use [SCENE]/[CHAR1]/[CHAR2] format if multiple characters):`;

        try {
            const raw = await Utils.callChatAPI([{ role: 'user', content: userMsg }], systemPrompt);
            // [SCENE]/[CHAR] 解析 + 预存外貌 tag 合并（共用逻辑）
            const parsed = PixivIllust.parseTagPromptOutput(raw, storedChars);
            if (parsed.charCaptions.length > 0) {
                console.log(`[Twitter ImageGen] Multi-char prompt: scene="${parsed.positive.substring(0,50)}..." chars=${parsed.charCaptions.length}`);
            }
            return { positive: parsed.positive, negative: '', charCaptions: parsed.charCaptions };
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
        this._generatingTweetImages = this._generatingTweetImages || new Set();   // per-tweet 在途标记（in-memory、不入存档），防连续刷新对同一批推重复发起生图
        const artTweets = tweets.filter(tw => tw.image && tw.image.type === 'art' && !tw.image.generatedImageId && !this._generatingTweetImages.has(tw.id));
        console.log(`[Twitter ImageGen] Found ${artTweets.length} art tweets out of ${tweets.length} total (types: ${tweets.map(tw => tw.image?.type || 'none').join(', ')})`);
        if (artTweets.length === 0) return;

        // 画像サイズ（横長、ツイートカード向け）
        const imgSize = config.provider === 'novelai'
            ? (naiSettings.resolution || '1024x1024')
            : '1024x768';

        for (const tweet of artTweets) {
            this._generatingTweetImages.add(tweet.id);
            try {
                const prompt = await this._buildImagePrompt(tweet.content, tweet.image.description);
                if (!prompt) continue;

                let blobs = [];
                switch (config.provider) {
                    case 'openai':
                        blobs = await PixivIllust.generateWithOpenAI(prompt.positive, prompt.negative, imgSize, 1, config, prompt.charCaptions);
                        break;
                    case 'gpt-image':
                        blobs = await PixivIllust._gptImage(prompt.positive, prompt.negative, imgSize, 1, config, prompt.charCaptions);
                        break;
                    case 'openrouter':
                        blobs = await PixivIllust.generateWithOpenRouter(prompt.positive, prompt.negative, imgSize, 1, config, prompt.charCaptions);
                        break;
                    case 'stabilityai':
                        blobs = await PixivIllust.generateWithStabilityAI(prompt.positive, prompt.negative, imgSize, 1, config, prompt.charCaptions);
                        break;
                    case 'novelai':
                        blobs = await PixivIllust.generateWithNovelAI(prompt.positive, prompt.negative, imgSize, 1, config, prompt.charCaptions);
                        break;
                    case 'midjourney':
                    case 'custom':
                        blobs = await PixivIllust.generateWithCustomAPI(prompt.positive, prompt.negative, imgSize, 1, config, prompt.charCaptions);
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
            } finally {
                this._generatingTweetImages.delete(tweet.id);
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
                        card.className = 'tw-image-card tw-image-placeholder';
                        card.style.background = this._imageGradient('art');
                        card.innerHTML = `<img src="${this._imgPlaceholder(id)}" class="tw-placeholder-img" alt="">`;
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

        const catIcon = { episode: this._svg.tv, character: this._svg.sparkles, goods: this._svg.shopping, event: this._svg.tent, fandom: this._svg.chat };
        const items = trends.map((tr, i) => `<div class="tw-trend-item tw-trend-clickable" onclick="Twitter._searchFromTrend('${this._escJsAttr(tr.tag)}')">
    <div class="tw-trend-rank">${i + 1}</div>
    <div class="tw-trend-info">
        <div class="tw-trend-tag">${this._esc(tr.tag)}</div>
        <div class="tw-trend-count">${catIcon[tr.category] || this._svg.chat} ${this._esc(tr.count)}</div>
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
            : `<div class="tw-space-archived-badge">${this._svg.radio} ${I18n.t('tw.space_archived', 'アーカイブ')}</div>`;
        const npc = this._getNpc(space.hostNpcId);
        const hostName = npc ? (npc.name || npc.role) : I18n.t('tw.space_host_default', 'ホスト');
        const otherCount = (space.speakerNpcIds || []).length - 1;
        const hostsStr = otherCount > 0 ? I18n.t('tw.space_others_count', {name: this._esc(hostName), n: otherCount}) : this._esc(hostName);
        const listenerStr = isLive ? `${this._svg.headphones} ${this._fmtNum(space.listenerCount || 0)}人` : '';
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
            : `<div class="tw-space-status-bar"><div class="tw-space-status-archived">${this._svg.radio} ${I18n.t('tw.space_archived', 'アーカイブ')}</div><div class="tw-space-listeners">${this._formatDate(space.endTime || space.startTime)}</div></div>`;

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
                .map(id => { const n = this._getNpc(id); return n ? { id, name: n.name || n.role, role: n.role || '', persona: Utils.PROMPTS.npcPersonaOneLine(n) } : null; })
                .filter(Boolean);
            const speakerPersonaSection = this._buildSpeakerPersonaSection(otherSpeakers.map(s => ({ name: s.name, persona: s.persona })));
            const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
            const recentCtx = (space.messages || []).slice(-7, -1).map(m => `${m.speakerName}: ${m.content}`).join('\n');

            const systemPrompt = `あなたは日本語Xスペース（ライブ音声会話）のシミュレーターです。
ユーザー（${userIdent.name}）の音声を聴いて、その場にいる他のスピーカーの自然な反応を生成してください。

スペース設定:
- タイトル: 「${space.title}」
- 他のスピーカー: ${otherSpeakers.map(s => `${s.name}（${s.role || ''}）`).join('、') || '（なし）'}
${speakerPersonaSection}
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
            const speakerPersonaSection = this._buildSpeakerPersonaSection(allSpeakerIds.map(id => { const n = npcs.find(x => x.id === id); return n ? { name: n.name || n.role, persona: Utils.PROMPTS.npcPersonaOneLine(n) } : null; }));
            let plotContext = '';
            if (relatedPlotId) {
                const plot = plots.find(p => p.id === relatedPlotId);
                if (plot) plotContext = `\n関連エピソード：${plot.title}\n${plot.content || ''}`;
            }
            const systemPrompt = `あなたは日本語X（Twitter）スペース — ライブ音声ディスカッションをシミュレーションしています。
スピーカー: ${speakerNames.join('、')}
スペースタイトル: 「${title}」${plotContext}
${speakerPersonaSection}
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

    // スピーカー人物設定セクション（v2.199.0）— [{name, persona}] → prompt 段落。全員未設定なら空串（従来挙動）
    _buildSpeakerPersonaSection(speakers) {
        return Utils.PROMPTS.npcPersonaListSection((speakers || []).filter(Boolean).map(s => ({ label: s.name, persona: s.persona })), { title: 'スピーカー人物設定' });
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
            const speakerPersonaSection = this._buildSpeakerPersonaSection(space.speakerNpcIds.map(id => { const n = npcs.find(x => x.id === id); return n ? { name: n.name || n.role, persona: Utils.PROMPTS.npcPersonaOneLine(n) } : null; }));
            const existingMsgs = (space.messages || []).slice(-6).map(m => `${m.speakerName} [${m.elapsed}]: ${m.content}`).join('\n');
            const lastElapsed = space.messages?.length > 0 ? (space.messages[space.messages.length - 1].elapsed || '+00:10:00') : '+00:10:00';
            const systemPrompt = `あなたは日本語Xスペースの音声ディスカッションを続けています。
スピーカー: ${speakerNames.join('、')}
スペースタイトル: 「${space.title}」
${speakerPersonaSection}
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

});
