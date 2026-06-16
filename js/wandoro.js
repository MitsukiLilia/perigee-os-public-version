// ===== ワンドロ（お題企画）/ privatter 外链揭示卡 模块【公開版 = 全年齢 SFW】 =====
// お題企画（お題ベースの参加企画）生成 + privatter 揭示卡 + 懒生成 SS + 翻訳。
// 公開版は全年齢のみ：R-18 機構（パスワードゲート / 成人内容生成 / R-18 バッジ）は一切含まない。
// 依赖：Twitter（_ensureData / _parseFanTweets / _genEngagement / _esc / _formatDate / _svg）+ 全局 Forum / Utils / I18n / AppState。
const Wandoro = {
    _wandoroGenerating: false,   // 企画生成并发锁（in-memory）
    _privCurrentId: null,        // 当前打开的 privatter 推文 id
    _privGenerating: null,       // SS 懒生成防重入 Set（lazy）
    _privTranslating: null,      // 翻译防重入 Set（lazy）

    // ===== ワンドロ 企画（真仪式）：お題 + 参加推（privatter 字書き、全年齢）=====
    // 完結前：onPlotPublished 一话起一轮（确定性）；完結後：refreshTimeline 按时间慢节奏（_maybeWandoroByTime）
    async _generateWandoro(opts = {}) {
        const t = Twitter._ensureData();
        const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast && AppState.data.broadcast.worldSetting || '');
        if (!worldContext || !worldContext.trim()) return;   // ワンドロ は CP/作品設定が前提
        if (this._wandoroGenerating) return;                 // 并发锁
        this._wandoroGenerating = true;
        try {
            if (!t.wandoro) t.wandoro = { round: 0, lastAdvancedAt: 0 };
            const round = (t.wandoro.round || 0) + 1;
            const seedPlot = opts.seedPlot;
            const seedPlotBit = seedPlot && seedPlot.title ? `\n直近の展開（お題のヒントにしてもよい。ただしネタバレ配慮）: ${String(seedPlot.title).slice(0, 40)}` : '';
            const systemPrompt = `あなたは日本の二次創作ファンダムの「ワンドロ（1時間お絵描き / 1時間ライティング）」企画をシミュレーションします。
ワンドロの本質 = 誰かが発起する「お題ベースの参加企画」。甘い日常・小ネタ・ほのぼのを全年齢で楽しむ。

作品設定（公開済み情報のみ参照、捏造しない）:
${worldContext}${seedPlotBit}
${typeof Utils !== 'undefined' && Utils.PROMPTS ? Utils.PROMPTS.infoAccessRule() : ''}

今回は第${round}回。お題を1つ決め、主催者の告知1件 + 参加者3〜5件を生成してください。

ルール:
- 1件目は主催者(organizer)。「#（CP/作品）ワンドロ 第${round}回 本日のお題は『（お題）』です！」と統一ハッシュタグでお題を告知
- 参加者は字書き(doujin_writer)中心（文が多数）。「お題『○○』で書きました」と privatter で作品を共有する
- 各参加ツイートに privatter カードを付ける（PRIVATTER: yes）。全て全年齢（甘い日常・ほのぼの・小ネタ）
- GATED_TITLE = privatter ページのタイトル（作品タイトル）。ODAI = 今回のお題（短い語）
- 参加者の反応は温かくポジティブに。自然なカジュアル日本語

出力フォーマット（厳守）:
---FANTWEET---
NAME: [主催者アカウント名]
HANDLE: [@handle]
TYPE: organizer
CONTENT: [#○○ワンドロ 第${round}回 お題告知]
TRANSLATION: [CONTENTの中国語訳1行]

---FANTWEET---
NAME: [参加者名]
HANDLE: [@handle]
TYPE: doujin_writer
CONTENT: [お題『○○』で書いた、という短い参加ツイート]
PRIVATTER: yes
GATED_TITLE: [作品タイトル]
ODAI: [今回のお題]
TRANSLATION: [CONTENTの中国語訳1行]

（参加ツイートを3〜5件。全部 PRIVATTER: yes、全て全年齢）`;
            const messages = [{ role: 'user', content: 'ワンドロのお題告知と参加ツイートを生成してください。' }];
            const raw = await Utils.callChatAPI(messages, systemPrompt);
            const parsed = Twitter._parseFanTweets(raw);
            if (parsed.length === 0) return;
            const now = Date.now();
            parsed.forEach((tw, i) => {
                const eng = Twitter._genEngagement('fan', tw.type);
                t.npcTweets.push({
                    id: Utils.generateId(),
                    source: 'fan',
                    npcId: null,
                    authorName: tw.name,
                    authorHandle: tw.handle,
                    authorType: tw.type,
                    content: tw.content,
                    translation: tw.translation || null,
                    timestamp: now + i * 2000,
                    replies: tw.replies || [],
                    likes: eng.likes,
                    retweets: eng.retweets,
                    savedToForumId: null,
                    gated: tw.gated || null
                });
            });
            // fan 推文上限 60（点赞推永不裁）
            const fanTweets = t.npcTweets.filter(tw => tw.source === 'fan' && !tw.fromSearch);
            if (fanTweets.length > 60) {
                const keepIds = new Set(fanTweets.slice(-60).map(tw => tw.id));
                const likedIds = new Set((t.likedTweetIds || []).map(l => l.id));
                t.npcTweets = t.npcTweets.filter(tw => tw.source !== 'fan' || tw.fromSearch || keepIds.has(tw.id) || likedIds.has(tw.id));
            }
            t.wandoro.round = round;
            t.wandoro.lastAdvancedAt = now;
            Utils.saveData();
            Utils.emitEvent('tweet_event', 'twitter', { title: `ワンドロ 第${round}回`, summary: (parsed[0] && parsed[0].content || '').slice(0, 40) });
        } catch (e) {
            console.warn('[Twitter Wandoro]', e);
        } finally {
            this._wandoroGenerating = false;
        }
    },

    // 完結前：新剧情发布 → 一话起一轮 ワンドロ（forum.addPlotEntry 调用、fire-and-forget 不阻塞论坛）
    onPlotPublished(plotId) {
        const b = AppState.data.broadcast || {};
        if (b.seriesEnded) return;   // 完結後は時間駆動（refreshTimeline）に任せる
        const plots = b.plotProgress || [];
        const plot = plots.find(p => p.id === plotId) || plots[plots.length - 1];
        Promise.resolve().then(() => this._generateWandoro({ seedPlot: plot })).catch(e => console.warn('[Wandoro onPlot]', e));
    },

    // 完結後：refreshTimeline で時間ベースに ワンドロ を回す（既定 ~1日に1回、可调）。完結前は null（onPlotPublished 駆動）
    _maybeWandoroByTime() {
        const b = AppState.data.broadcast || {};
        if (!b.seriesEnded) return Promise.resolve(null);
        const t = Twitter._ensureData();
        const last = (t.wandoro && t.wandoro.lastAdvancedAt) || 0;
        const INTERVAL = 24 * 60 * 60 * 1000;   // 完結後の ワンドロ 間隔（可调）
        if (Date.now() - last < INTERVAL) return Promise.resolve(null);
        return this._generateWandoro({});
    },

    // ワンドロ 外链揭示卡解析：privatter(文) / poipiku(绘·Phase2)。从 twitter.js _parseFanTweets 抽出。
    // 入参 = 单条 FANTWEET block 文本；返回 gated 对象或 null（无 PRIVATTER/POIPIKU 标记）。公開版は全年齢のみ。
    parseGated(block) {
        const _privRaw = (block.match(/^PRIVATTER:\s*(.+)$/m) || [])[1]?.trim();
        const _poipRaw = (block.match(/^POIPIKU:\s*(.+)$/m) || [])[1]?.trim();
        const _gSvc = (_privRaw && /^yes\b/i.test(_privRaw)) ? 'privatter'
            : (_poipRaw && /^yes\b/i.test(_poipRaw)) ? 'poipiku' : null;
        if (!_gSvc) return null;
        const _gT = (block.match(/^GATED_TITLE:\s*(.+)$/m) || [])[1]?.trim();
        const _gO = (block.match(/^ODAI:\s*(.+)$/m) || [])[1]?.trim();
        return {
            service: _gSvc,
            title: (_gT && _gT !== 'NONE') ? _gT : '',
            odai: (_gO && _gO !== 'NONE') ? _gO : '',
            r18: false,            // 公開版は全年齢固定（R-18 機構なし）
            password: null,
            passHint: null,
            revealed: false,
            contentText: null,
            charCount: null,
            contentId: null
        };
    },

    // ワンドロ 外链揭示卡（时间线上 = 朴素 OGP 链接卡，忠实真站；点卡跳页才揭示真内容）
    // privatter（文·Phase1）= 纯蓝 Privatter+ logo + 标题 + privatter.me。poipiku（绘）留 Phase 2。
    _renderGatedLinkCard(tweet) {
        const g = tweet && tweet.gated;
        if (!g || !g.service) return '';
        const clean = s => Twitter._esc(String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());
        if (g.service === 'privatter') {
            const title = clean(g.title || g.odai) || 'Privatter';
            return `<div class="tw-ext-card tw-ext-privatter" data-gated-tweet="${Twitter._esc(tweet.id)}" onclick="event.stopPropagation();Wandoro._openPrivatterPage('${Twitter._esc(tweet.id)}', this)" role="link" tabindex="0">
            <div class="tw-ext-thumb tw-ext-thumb-privatter">Privatter+</div>
            <div class="tw-ext-meta">
                <div class="tw-ext-title">${title} | Privatter+</div>
                <div class="tw-ext-domain">privatter.me</div>
            </div>
        </div>`;
        }
        // poipiku → Phase 2
        return '';
    },

    // ===== ワンドロ privatter 页：点卡跳页 → 懒生成 SS → 揭示（全年齢・無パスワードゲート）=====
    async _openPrivatterPage(tweetId, cardEl) {
        const t = Twitter._ensureData();
        const tweet = (t.npcTweets || []).find(tw => tw.id === tweetId);
        if (!tweet || !tweet.gated || tweet.gated.service !== 'privatter') return;
        this._privCurrentId = tweetId;
        let ov = document.getElementById('twPrivOverlay');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'twPrivOverlay';
            ov.className = 'tw-priv-overlay';
            ov.addEventListener('click', (e) => { if (e.target === ov) Wandoro._closePrivatterPage(); });
            document.body.appendChild(ov);
        }
        const g = tweet.gated;
        ov.innerHTML = this._privPageHtml(tweet, g.revealed ? 'content' : 'loading');
        ov.classList.add('active');
        document.body.classList.add('tw-priv-open');
        // 未生成 → 立即懒生成 SS
        if (!g.revealed) {
            const ok = await this._ensurePrivatterContent(tweet);
            if (this._privCurrentId === tweetId && ov.classList.contains('active')) {
                ov.innerHTML = this._privPageHtml(tweet, ok ? 'content' : 'error');
            }
        }
    },

    _closePrivatterPage() {
        const ov = document.getElementById('twPrivOverlay');
        if (ov) ov.classList.remove('active');
        document.body.classList.remove('tw-priv-open');
        this._privCurrentId = null;
    },

    // 懒生成 privatter SS（短篇二次创作、お題种子、全年齢）。生成一次后存 tweet.gated 复用、点赞推永不裁
    async _ensurePrivatterContent(tweet) {
        const g = tweet.gated;
        if (g.revealed && g.contentText) return true;
        this._privGenerating = this._privGenerating || new Set();
        if (this._privGenerating.has(tweet.id)) return !!g.contentText;
        this._privGenerating.add(tweet.id);
        try {
            const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast && AppState.data.broadcast.worldSetting || '');
            const odai = g.odai || g.title || '';
            const systemPrompt = `あなたは日本の二次創作同人「字書き」です。X（Twitter）のワンドロ（お題企画）に参加し、privatter に上げる短い二次創作SS（ショートストーリー）を書きます。
作品設定（公開済み情報のみ参照、捏造しない）:
${worldContext || '（未設定）'}
お題: ${odai}
参加ツイート本文（あなた自身の投稿。雰囲気・CP・シチュの種）: ${tweet.content || ''}
ルール:
・お題「${odai}」に沿った二次創作SSを書くこと
・全年齢（甘い日常／ほのぼの／小ネタ）。微笑ましい雰囲気のSS。
・400〜1200字程度の単発SS。タイトルや前書き・後書きは不要、本文のみ
・キャラの口調・関係性を設定通りに（原作改変は最小限）
・自然な日本語の地の文＋会話。privatter に上げる"書きたいところだけ"の濃度感で
本文のみを出力すること（メタ情報・見出し不要）。`;
            const raw = await Utils.callChatAPI([{ role: 'user', content: 'お題に沿った二次創作SSを書いてください。本文のみ。' }], systemPrompt);
            const body = String(raw || '').trim();
            if (!body) return false;
            g.contentText = body;
            g.charCount = [...body].length;
            g.revealed = true;
            Utils.saveData();
            return true;
        } catch (e) {
            console.warn('[PrivatterSS] generation failed:', e);
            return false;
        } finally {
            this._privGenerating.delete(tweet.id);
        }
    },

    // privatter 页 HTML（mode: loading / content / error）。忠实真站：顶栏/作者/时间戳/文字数/可见性徽章/标题/分隔线/正文。公開版は全年齢のみ。
    _privPageHtml(tweet, mode) {
        const g = tweet.gated || {};
        const esc = s => Twitter._esc(String(s == null ? '' : s));
        const clean = s => esc(String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());
        const username = clean(tweet.authorName) || 'user';
        const dateStr = Twitter._formatDate(tweet.timestamp);
        const title = clean(g.title || g.odai) || '無題';
        const badge = I18n.t('tw.priv_badge_public', 'Public');
        const charCount = (mode === 'content' && g.charCount) ? `<span class="tw-priv-chars">${g.charCount}${I18n.t('tw.priv_chars_unit', '文字')}</span>` : '';
        const svgClose = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        const svgPerson = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>`;
        let body = '';
        if (mode === 'loading') {
            body = `<div class="tw-priv-loading"><div class="tw-priv-spinner spinning">${Twitter._svg.loader || Twitter._svg.book}</div><span>${I18n.t('tw.priv_loading', '読み込み中…')}</span></div>`;
        } else if (mode === 'error') {
            body = `<div class="tw-priv-loading"><span>${I18n.t('tw.priv_failed', '読み込みに失敗しました')}</span></div>`;
        } else {
            const para = esc(g.contentText || '').replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
            body = `<div class="tw-priv-body-text"><p>${para}</p></div>
                <div class="tw-priv-translate-wrap">
                    <button class="tw-priv-translate-btn" onclick="event.stopPropagation();Wandoro._translatePrivatter('${esc(tweet.id)}', this)">${I18n.t('tw.priv_translate', '翻訳')}</button>
                    <div class="tw-priv-translated" id="twPrivTranslated"></div>
                </div>`;
        }
        return `<div class="tw-priv-page">
            <div class="tw-priv-topbar">
                <span class="tw-priv-logo">Privatter+</span>
                <button class="tw-priv-close" onclick="Wandoro._closePrivatterPage()" aria-label="close">${svgClose}</button>
            </div>
            <div class="tw-priv-scroll">
                <div class="tw-priv-card">
                    <div class="tw-priv-head">
                        <div class="tw-priv-author"><span class="tw-priv-avatar">${svgPerson}</span><span class="tw-priv-username">${username}</span></div>
                        <div class="tw-priv-meta"><span class="tw-priv-time">${esc(dateStr)}</span>${charCount}<span class="tw-priv-badge">${badge}</span></div>
                    </div>
                    <div class="tw-priv-share-row">${Twitter._svg.share}${Twitter._svg.bookmark}</div>
                    <div class="tw-priv-title">${title}</div>
                    <hr class="tw-priv-divider">
                    ${body}
                </div>
            </div>
        </div>`;
    },

    // v2.127.0 privatter SS 翻译（中文用户便利）：点击懒翻译 + 缓存 + 切换显隐，零影响其他功能
    async _translatePrivatter(tweetId, btn) {
        const t = Twitter._ensureData();
        const tweet = (t.npcTweets || []).find(tw => tw.id === tweetId);
        if (!tweet || !tweet.gated || !tweet.gated.contentText) return;
        const g = tweet.gated;
        const block = document.getElementById('twPrivTranslated');
        if (!block) return;
        // 已翻译过 → 纯切换显隐（不再调 API）
        if (g.translatedText) {
            if (!block.innerHTML) block.innerHTML = this._privTranslatedHtml(g.translatedText);
            const showing = block.classList.toggle('tw-priv-translated-show');
            if (btn) btn.textContent = showing ? I18n.t('tw.priv_hide_tl', '翻訳を隠す') : I18n.t('tw.priv_translate', '翻訳');
            return;
        }
        // 防重入
        this._privTranslating = this._privTranslating || new Set();
        if (this._privTranslating.has(tweetId)) return;
        this._privTranslating.add(tweetId);
        if (btn) { btn.disabled = true; btn.textContent = I18n.t('tw.priv_translating', '翻訳中…'); }
        try {
            const sys = '次の日本語の二次創作SSを自然な簡体字中国語に翻訳してください。本文の翻訳のみを出力し、説明・注釈・原文の再掲は不要です。';
            const raw = await Utils.callChatAPI([{ role: 'user', content: g.contentText }], sys);
            const tl = String(raw || '').trim();
            if (!tl) throw new Error('empty translation');
            g.translatedText = tl;
            Utils.saveData();
            // await 期间用户可能已关闭/切走 → 仅当 block 仍在 DOM 才写
            const live = document.getElementById('twPrivTranslated');
            if (live) { live.innerHTML = this._privTranslatedHtml(tl); live.classList.add('tw-priv-translated-show'); }
            if (btn) { btn.disabled = false; btn.textContent = I18n.t('tw.priv_hide_tl', '翻訳を隠す'); }
        } catch (e) {
            console.warn('[PrivatterTL]', e);
            Utils.showToast(I18n.t('tw.priv_tl_failed', '翻訳に失敗しました'));
            if (btn) { btn.disabled = false; btn.textContent = I18n.t('tw.priv_translate', '翻訳'); }
        } finally {
            this._privTranslating.delete(tweetId);
        }
    },

    _privTranslatedHtml(text) {
        const para = Twitter._esc(String(text || '')).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
        return `<div class="tw-priv-tl-divider"></div><p>${para}</p>`;
    }
};
