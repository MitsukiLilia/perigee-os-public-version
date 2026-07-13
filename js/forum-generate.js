// forum-generate.js — 从 js/forum.js 纯搬运拆出（v2.203.0）。
// 内容零改动；加载顺序：forum.js → generate → npc → goods → plot → tools（见 index.html）。
Object.assign(Forum, {
    // ===== AI生成帖子 =====
    async generateThreads() {
        const context = this.getWorldContext();
        if (!context.trim()) {
            Utils.showToast(I18n.t('t.forum_need_worldview', '请先在放送局设定世界观'));
            return;
        }

        const btn = document.getElementById('forumGenerateBtn');
        if (btn) { btn.textContent = '...'; btn.disabled = true; }

        // ユーザー指定のスレ数
        const threadCount = Math.max(1, Math.min(8, parseInt(document.getElementById('forumThreadCount')?.value || '3')));

        try {
            const bilingualPrompt = this.getBilingualPrompt();
            const safetyContext = this.getSafetyContext();
            const data = AppState.data.forumData;

            // ── 主类型池（高频，正常轮换）──
            const mainTypes = [
                { type: 'discussion', label: '感想/考察スレ (剧情感想/分析)' },
                { type: 'ship', label: 'カプ語りスレ (磕CP/恋爱关系讨论)' },
                { type: 'analysis', label: '伏線考察スレ (伏笔考据/细节分析)' },
                { type: 'song', label: 'OP/ED/挿入歌スレ (歌曲/BGM鉴赏)' },
                { type: 'fanfic', label: 'SS/二次創作スレ (同人短篇)' },
                { type: 'meme', label: 'ネタ/コラスレ (梗图/搞笑)' },
                // 実況スレ(livewatch) は通常プールから除外 — 放送直後の専用枠でのみ「1話につき1本」生成する（下の Thread 強制割当を参照）
                { type: 'chara', label: 'キャラ語りスレ (角色深度讨论)' },
                { type: 'prediction', label: '展開予想スレ (剧情预测/展望)' },
                { type: 'daily', label: '日常妄想スレ (角色日常/if线妄想)' },
                { type: 'comparison', label: '比較スレ (作品内/跨作品对比)' },
                { type: 'nostalgia', label: '懐かしスレ (怀旧/经典回顾)' },
                { type: 'newbie', label: '初心者スレ (新人入坑/推荐)' },
                { type: 'poll', label: '人気投票/ランキングスレ (人气投票)' },
            ];

            // ── 官方情报关联类型（仅当对应分类的情报实际存在时才加入池）──
            const officialInfo = AppState.data.broadcast.officialInfo || [];
            // 计算已被合并总结覆盖的 ID 集合，避免将旧情报当"速报"注入
            const _mergedSums = AppState.data.broadcast.mergedSummaries || [];
            const _plotSums = AppState.data.broadcast.plotSummaries || [];
            const offCoveredSet = new Set([
                ..._mergedSums.flatMap(s => s?.coveredInfoIds || []),
                ...(AppState.data.broadcast.officialSummaries || []).flatMap(s => s.coveredIds || [])
            ]);
            const plotCoveredSet = new Set([
                ..._mergedSums.flatMap(s => s.coveredPlotIds || []),
                ..._plotSums.flatMap(s => s.coveredIds || [])
            ]);
            // 只保留"未被总结"的新鲜情报，用于速报注入和热度判断
            const uncoveredOfficialInfo = officialInfo.filter(e => !offCoveredSet.has(e.id));
            // ── 时间窗过滤：只有挂靠在最新 2 条剧情上的情报才算"速报级新鲜"──
            // 旧话的情报即使未被总结，也不应作为热点话题注入新帖
            const _plotIds = (AppState.data.broadcast.plotProgress || []).map(p => p.id);
            const _recentPlotIdSet = new Set(_plotIds.slice(-2)); // 最新 2 条剧情的 ID
            const freshOfficialInfo = uncoveredOfficialInfo.filter(e =>
                e.afterPlotId && _recentPlotIdSet.has(e.afterPlotId)
            );
            const officialTypes = [];
            if (freshOfficialInfo.some(i => i.category === 'interview' || i.category === 'twitter')) {
                officialTypes.push({ type: 'official-interview', label: 'インタビュー/声優語りスレ (访谈/声优相关，可结合采访内容讨论)' });
            }
            if (freshOfficialInfo.some(i => i.category === 'goods')) {
                officialTypes.push({ type: 'official-goods-ship', label: 'グッズでカプを語るスレ (从官方周边/设定集里嗑CP)' });
            }
            if (freshOfficialInfo.some(i => i.category === 'event')) {
                officialTypes.push({ type: 'official-event', label: 'イベント/ライブレポスレ (活动/现场/展览情报讨论)' });
            }
            if (freshOfficialInfo.some(i => i.category === 'setting')) {
                officialTypes.push({ type: 'official-setting', label: '設定資料集/公式設定考察スレ (设定集/官方设定深挖)' });
            }
            if (freshOfficialInfo.some(i => i.category === 'announcement')) {
                officialTypes.push({ type: 'official-announcement', label: '公式発表/重大発表スレ (官方重大公告发布后的粉丝第一反应)' });
            }
            if (freshOfficialInfo.some(i => i.category === 'goods' && i.isGoodsRelease)) {
                officialTypes.push({ type: 'official-goods-repo', label: 'グッズ質感レポスレ (周边到货开箱/质感讨论)' });
            }

            // ── 展会话题闸门：即売会が档期窗口（preopen〜closed+1話）内にある時だけ即売会レポ系を解禁 ──
            const eventGate = (typeof Melonbooks !== 'undefined' && Melonbooks.getEventTopicGate)
                ? Melonbooks.getEventTopicGate()
                : { open: false, stage: null, events: [], topics: [] };

            // ── 稀有类型池（极低频，只有其他类型都轮过一遍才出现）──
            // event_report は闸门が閉じている時 rareTypes 数组の源头から除外する
            // → 下游の保底 / tweet_event boost / 兜底回填 の三条路径が自动で全て失效
            const rareTypes = [
                { type: 'powerlevels', label: '戦闘力/強さ議論スレ (战力讨论，仅偶尔出现)' },
                { type: 'tierlist', label: 'Tier表スレ (角色分级，仅偶尔出现)' },
                { type: 'anchor', label: '安価スレ (安价互动)' },
                { type: 'seiyuu', label: '声優/スタッフスレ (声优/制作组讨论)' },
                { type: 'goods', label: 'グッズ/聖地スレ (周边/圣地巡礼)' },
                { type: 'anti', label: 'アンチスレ (黑串/批评讨论，仅极偶尔出现，要有粉丝守护反制)' },
                { type: 'event_report', label: '即売会レポスレ (同人イベント参加レポート・戦利品紹介)' },
                { type: 'doujin_review', label: '同人誌感想スレ (同人誌の感想・レビュー)' },
                { type: 'cosplay_thread', label: 'コスプレスレ (コスプレ写真・衣装語り)' },
            ].filter(t => t.type !== 'event_report' || eventGate.open);

            // ── 新鲜度判断：决定官方情报讨论热度 ──
            const allThreads = data.threads || [];
            const recentTypes = allThreads.slice(0, 12).map(t => t.threadType).filter(Boolean);

            const latestOfficialTs = freshOfficialInfo.length > 0
                ? Math.max(...freshOfficialInfo.map(e => e.timestamp || 0)) : 0;
            const latestThreadTs = allThreads.length > 0
                ? Math.max(...allThreads.slice(0, 6).map(t => t.timestamp || 0)) : 0;
            const plotProgress = AppState.data.broadcast.plotProgress || [];
            // 只从未被总结的剧情中取最新节点，防止已总结剧情影响热度判断
            const freshPlotProgress = plotProgress.filter(p => !plotCoveredSet.has(p.id));
            const latestPlotTs = freshPlotProgress.length > 0
                ? (freshPlotProgress[freshPlotProgress.length - 1].timestamp || 0) : 0;

            // 三种热度状态：
            // 🔥 hot   — 情报比最近的帖子还新（刚更新，社区沸腾）
            // 🌡 warm  — 情报比最新剧情新，但已有一些帖子（话题持续）
            // ❄ cool   — 情报比最新剧情旧（降温，偶尔有机提及）
            const officialHeat = (() => {
                if (freshOfficialInfo.length === 0) return 'none';
                if (latestOfficialTs > latestThreadTs) return 'hot';
                if (latestOfficialTs > latestPlotTs) return 'warm';
                return 'cool';
            })();

            // 从主类型池过滤已用类型
            let available = mainTypes.filter(t => !recentTypes.includes(t.type));
            // 剧情がない場合、実況/考察/伏線/懐古/予想を除外（素材なしで生成不可）
            if (!freshPlotProgress.length && !plotProgress.length) {
                const needsPlot = ['livewatch', 'analysis', 'nostalgia', 'prediction', 'comparison'];
                available = available.filter(t => !needsPlot.includes(t.type));
            }
            const availableOfficial = officialTypes.filter(t => !recentTypes.includes(t.type));

            // 根据热度决定是否在池中加入官方情报类型
            if (officialHeat === 'hot' || officialHeat === 'warm') {
                available = [...available, ...availableOfficial];
            }
            // ── 稀有池保底：连续 N 批未出稀有类型时强制注入 ──
            const rareTypeNames = rareTypes.map(r => r.type);
            const recentForPity = (data.threads || []).slice(0, 30);
            const lastRareIdx = recentForPity.findIndex(t => rareTypeNames.includes(t.threadType));
            const rareStarved = lastRareIdx === -1 || lastRareIdx >= 20; // 最近20条都没出过稀有
            if (rareStarved && available.length >= threadCount) {
                // 保底触发：把一个未出现的稀有类型强制塞入候选
                const unusedRare = rareTypes.filter(t => !recentTypes.includes(t.type));
                if (unusedRare.length > 0) {
                    available.push(unusedRare[Math.floor(Math.random() * unusedRare.length)]);
                }
            }

            // Event-driven boost: if recent tweet events exist, promote event_report to available pool
            const recentTweetEvents = (typeof Utils !== 'undefined') ? Utils.getRecentEvents({ source: 'twitter', type: 'tweet_event', limit: 3 }) : [];
            if (recentTweetEvents.length > 0) {
                const eventReport = rareTypes.find(t => t.type === 'event_report');
                if (eventReport && !available.some(a => a.type === 'event_report')) {
                    available.push(eventReport);
                }
            }

            if (available.length < threadCount) {
                available = [...available, ...rareTypes.filter(t => !recentTypes.includes(t.type))];
            }
            if (available.length < threadCount) available = [...mainTypes, ...availableOfficial];

            // ── 欠債優先：出現回数が少ない類型を優先选取 ──
            const recentAll = (data.threads || []).slice(0, 20);
            const typeCountMap = {};
            recentAll.forEach(t => {
                const ty = t.threadType || 'discussion';
                typeCountMap[ty] = (typeCountMap[ty] || 0) + 1;
            });
            // 按出现次数升序，同次数随机
            const sorted = available.sort((a, b) => {
                const ca = typeCountMap[a.type] || 0;
                const cb = typeCountMap[b.type] || 0;
                if (ca !== cb) return ca - cb; // 次数少的排前面
                return Math.random() - 0.5;
            });
            // 去重：同一批内不重复选同一类型
            const selectedTypes = [];
            const usedTypes = new Set();
            for (const item of sorted) {
                if (usedTypes.has(item.type)) continue;
                usedTypes.add(item.type);
                selectedTypes.push(item);
                if (selectedTypes.length >= threadCount) break;
            }
            // 如果去重后数量不够，允许回填
            if (selectedTypes.length < threadCount) {
                for (const item of sorted) {
                    if (selectedTypes.length >= threadCount) break;
                    if (!selectedTypes.includes(item)) selectedTypes.push(item);
                }
            }

            // ── Thread 1 & 2 强制分配逻辑（带冷却机制）──
            let latestPlot = freshPlotProgress.length > 0 ? freshPlotProgress[freshPlotProgress.length - 1] : null;
            const latestOfficial = freshOfficialInfo.length > 0 ? freshOfficialInfo[freshOfficialInfo.length - 1] : null;

            // 冷却判定：最近6条帖子中，已有几条讨论了该剧情节点
            const recentDiscussionCount = latestPlot
                ? (data.threads || []).slice(0, 6).filter(t =>
                    t.threadType === 'discussion' &&
                    (t.linkedPlotId === latestPlot.id || (!t.linkedPlotId && t.threadType === 'discussion'))
                ).length
                : 0;
            const plotCooledDown = recentDiscussionCount >= 2; // 已有2条以上则冷却

            // forcedSlots：被「感想/速報」强制占用的槽位，实况串差入时不能覆盖它们
            const forcedSlots = new Set();
            if (officialHeat === 'hot' && latestOfficial) {
                const cat = OFFICIAL_CATEGORIES[latestOfficial.category] || { label: latestOfficial.category };
                selectedTypes[0] = {
                    type: 'official-hot',
                    label: `【速報】${cat.labelJa || cat.label}情報スレ (针对最新官方情报「${latestOfficial.title}」的第一反应讨论帖)`
                };
                forcedSlots.add(0);
                if (latestPlot && !plotCooledDown && selectedTypes.length > 1) {
                    selectedTypes[1] = {
                        type: 'discussion',
                        label: `最新話感想スレ (Topic: ${latestPlot.title})`
                    };
                    forcedSlots.add(1);
                }
            } else if (latestPlot && !plotCooledDown) {
                // 未冷却：Thread 1 = 最新剧情
                selectedTypes[0] = {
                    type: 'discussion',
                    label: `最新話感想/考察スレ (Topic: ${latestPlot.title})`
                };
                forcedSlots.add(0);
                if (officialHeat === 'warm' && latestOfficial && availableOfficial.length > 0 && Math.random() < 0.5 && selectedTypes.length > 1) {
                    const picked = availableOfficial[Math.floor(Math.random() * availableOfficial.length)];
                    selectedTypes[1] = picked;
                    forcedSlots.add(1);
                }
            }
            // 如果已冷却（plotCooledDown），Thread 1 保持 sorted 的结果（低频类型优先）

            // ── 実況スレ専用枠：放送直後の「1話につき1本」だけ生成する ──
            // 最新話（freshPlot）に実況スレが未生成なら、今回の生成に1本だけ差し込む。
            // 既に生成済みなら何もしない → 次の新話が出るまで実況スレは二度と湧かない（連発防止）。
            const latestPlotHasLivewatch = latestPlot && (data.threads || []).some(t =>
                t.threadType === 'livewatch' && t.linkedPlotId === latestPlot.id
            );
            if (latestPlot && !latestPlotHasLivewatch && !selectedTypes.some(t => t.type === 'livewatch')) {
                // 感想/速報の強制枠を潰さない、最も後ろの空き枠に差し込む
                let slot = -1;
                for (let i = selectedTypes.length - 1; i >= 0; i--) {
                    if (!forcedSlots.has(i)) { slot = i; break; }
                }
                if (slot >= 0) {
                    selectedTypes[slot] = { type: 'livewatch', label: '実況スレ (实况/直播反应)' };
                }
            }

            // ── 官方情报类型 → OFFICIAL_CATEGORIES key 映射（供 typeInstructions 里要求 LLM 输出 CATEGORY: 行）──
            const OFFICIAL_CATEGORY_BY_TYPE = {
                'official-interview': 'interview',
                'official-goods-ship': 'goods',
                'official-event': 'event',
                'official-setting': 'setting',
                'official-announcement': 'announcement',
                'official-goods-repo': 'goods'
            };

            // ── 构建 typeInstructions ──
            const typeInstructions = selectedTypes.map((t, i) => {
                const num = i + 1;
                if (t.type === 'official-hot') {
                    const hotCategory = (latestOfficial && latestOfficial.category) || 'interview';
                    return `Thread ${num}: [速報] — React to the most recently published official info in the timeline. Generate immediate fan reactions (excitement, analysis, comparison to expectations).
Add a line "CATEGORY: ${hotCategory}" in this thread's block (must match exactly).`;
                }
                if (t.type === 'discussion' && i === 0 && officialHeat !== 'hot') {
                    return `Thread ${num}: discussion — Discuss the latest plot entry (the last one in the timeline). (Fan reactions, theories, emotions, callbacks to earlier events if relevant)`;
                }
                if (t.type.startsWith('official-')) {
                    const catKey = OFFICIAL_CATEGORY_BY_TYPE[t.type] || 'interview';
                    return `Thread ${num}: ${t.label} — Naturally reference recent official info from the timeline if relevant.
Add a line "CATEGORY: ${catKey}" in this thread's block (must match exactly).`;
                }
                if (t.type === 'anchor') {
                    return `Thread ${num}: 安価スレ (interactive story thread)
SPECIAL FORMAT for this thread only:
- CONTENT (post #1): Short story intro by 作者◆[4-char tripcode], ending with a >>5 安価 instruction (like ">>5でAの選択を決める")
- REPLIES: 2-3 reader vote replies (short suggestions) → 1 [ANCHOR] reply at the designated number → 1 [OP] story continuation (incorporating the anchor, ending with new >>N 安価)
- OP reply format: AUTHOR: 作者◆XXXX [OP]
- Anchor reply format: AUTHOR: 名無しさん [ANCHOR]
- The story should be based on the world/characters from the world context.`;
                }
                if (t.type === 'official-goods-repo') {
                    return `Thread ${num}: グッズ質感レポスレ — Goods have arrived. Find the released goods info in the timeline above.
Generate a thread where fans:
- Post arrival reactions "届いたーー！！" "やっと来た！！" "開封する！"
- Review quality: print quality, size, material feel, packaging design
- Compare actual quality vs promotional images ("思ってたより大きい" "印刷キレイ")
- Share display ideas, desk setups ("どこに飾ろうかな")
- Some still waiting for delivery / tracking packages ("まだ来ない…" "地域差あるの？")`;
                }
                if (t.type === 'anti') {
                    return `Thread ${num}: アンチスレ (hate/criticism thread)
SPECIAL DYNAMICS — A lone anti-fan opens this thread, but the FANDOM OVERWHELMS THEM. The fanbase is large and passionate; haters are quickly outnumbered and shut down.
- OP: An anti-fan posting criticism about a character or plot point (in Japanese)
- REPLIES — HEAVILY FAN-DOMINATED (fans raid this thread):
  - 1 anti follow-up at most (briefly agreeing with OP before getting buried)
  - 3-4 fan defense posts: fans flooding in, defending with specific character/plot details from the world context — using "は？", "見る目ないだろ", "そこが好きなんだが", "アンチスレに何しに来てんの", "むしろ布教させてもらおうか"
  - 1 neutral/exhausted post: bystander tired of the fight "またアンチスレか、荒れてるな"
The anti is vastly outnumbered. The thread becomes a de facto fan appreciation thread.`;
                }
                if (t.type === 'livewatch') {
                    return `Thread ${num}: **実況スレ** — This is a LIVE broadcast reaction thread from when the latest episode AIRED.
Title format: 「[作品名] 第X話 実況スレ」 / 「第X話リアタイ勢集合」 / 「今週やばすぎ実況」etc. Reference the episode number from the latest plot entry.
OP content: A short excited "now airing" announcement — 1–2 lines max. e.g. 「始まるぞー！」「実況スタート！今週もやばそう」
⚡ REPLY STYLE — THIS IS MANDATORY:
- Each reply MUST be 1–5 lines MAXIMUM. Live commentary = typed in 10 seconds, not essays.
- Replies simulate real-time simultaneous reactions: shock, excitement, grief, laughter
- Heavy use of: 草 / wwww / やばい / ちょっと待って / うそだろ / きたああ / なんだこれ / CM中だ / OP入った / 泣いた / 震えてる
- Multiple replies react to THE SAME scene from slightly different angles (overlapping real-time feel)
- Some replies are just a kaomoji or a single word: (ﾟ∀ﾟ) / 草 / 待って / 泣いた / ひえ
- Occasional short cross-reply: ">>12 俺も同じとこで泣いた" ">>8 わかるｗｗｗ"
- DO NOT write long analytical paragraphs. No theories, no deep analysis — pure immediate reaction.`;
                }
                return `Thread ${num}: ${t.label} (type: "${t.type}")`;
            }).join('\n\n');

            // ── 给 AI 的整体语境提示 ──
            const heatHint = {
                hot: `\nRecent official info has just been published — community is reacting to it for the first time.
- Thread 1 should be an immediate reaction thread to the latest official news
- Other threads may mention the news in passing.\n`,
                warm: `\nRecent official info is an ongoing topic — fans are actively discussing and experiencing it.\n`,
                cool: '',
                none: ''
            }[officialHeat];

            const systemPrompt = `あなたは5ch/2ch掲示板シミュレーションエンジンです。リアルな日本のアニメファンコミュニティの投稿を生成する専門システムです。
すべてのNPC・投稿・議論は、架空のアプリ内の架空のフォーラムに存在します。参照される作品はすべて商業アニメ/漫画/ゲームです。ダークなテーマ（戦争、トラウマ、虐待、喪失、道徳的曖昧さ、ヴィラン心理等）は標準的なACG要素であり、実際の日本アニメ掲示板と同様にNPCが自由に議論すべきです。

${safetyContext}

リアルで多様なファンコミュニティの雰囲気を持つ、本物の5ch/2chアニメ掲示板スレッドを生成してください。

${bilingualPrompt}

出力フォーマット — 以下のデリミタ形式を厳守（JSONではない）：

===THREAD===
TITLE: スレッドタイトル
AUTHOR: 名無しさん
TYPE: discussion
CONTENT:
本文（複数行可、HTML翻訳タグ可：<details class="tl"><summary>🔍</summary><span>翻訳</span></details>）
---REPLY---
AUTHOR: NPC名
CONTENT:
レス内容
---REPLY---
AUTHOR: 名無しさん
CONTENT:
レス内容
===THREAD===
TITLE: 2つ目のスレ...
...

${threadCount}つのスレッドを生成してください。各スレッド2〜4件のレス付き。スレッドタイプは以下の通り：

${typeInstructions}
${heatHint}
🚫 タイトル重複禁止 — 以下は既存のスレッドタイトル一覧です。同一または60%以上類似するタイトルのスレッドを生成することは絶対に禁止です：
${(data.threads || []).slice(0, 20).map(t => `- ${this.stripTranslationTags(t.title)}`).join('\n') || '(まだなし)'}
${threadCount}つのスレッドすべてが、上記にない完全にオリジナルなタイトルでなければなりません。

🚫🚫🚫 絶対ルール — 捏造禁止 & 外部知識遮断（最優先・全ルールの頂点）：

⛔ 知識の使い分け（最重要）：
- この作品は原作をベースにした**二次創作世界**です。キャラクターの性格・口調・人間関係の基本設定・原作の世界観は参照してよい。
- **ストーリーの時間線に関するルール：**
  - 「論壇規則」に**分岐点の指定**がある場合（例：「第X話以降はオリジナル展開」「○○編以降はIF線」）→ 分岐点より前の原作イベントは共有歴史として自由に参照可。分岐点以降は**コンテキストの剧情進捗のみ**が正史。
  - 分岐点の指定がない場合 → **コンテキストの剧情進捗に記載された出来事だけ**がこの世界で起きた事実。原作知識からプロット・事件・結末を持ち込まない。
- いずれの場合も、コンテキストの剧情進捗に**まだ記載されていない未来の展開**を捏造・推測・暗示することは禁止。
- キャラの性格描写や口癖は原作知識を活用してよいが、**コンテキスト外の剧情イベントを事実として語ることは禁止**。
${plotProgress.length === 0 ? `
⚡ 現在の放送状態：【放送前 / 未放送】
- 剧情進捗が0件 ＝ まだ1話も放送されていない。ファンはPV・公式ビジュアル・公式情報のみを頼りに期待している段階。
- 「第X話」「○○のシーン」「あのエピソード」「物語の展開」など、放送済みを前提とする言及は一切禁止。
- 音楽・OP/ED・挿入歌・BGMについて：コンテキストに楽曲情報が明記されていない限り、楽曲は未発表。「OPが神」「EDで泣いた」等の言及禁止。
- 討論できる話題は：キャラデザ・PVの印象・声優キャスト（公式発表済みのみ）・期待・不安・原作既読勢の（ネタバレなし）期待感のみ。
` : `
⚡ 現在の放送状態：第${plotProgress.length}話まで放送済み
- ファンは第${plotProgress.length}話までの内容のみを知っている。
- 第${plotProgress.length + 1}話以降の展開は存在しない。言及禁止。
`}
- 原作にないプロットの転換、キャラの死亡/成長、シリーズの結末、コンテキストに記載されていない事件を捏造してはならない。
- 重要 — 告知 ≠ 内容：公式情報が今後のコンテンツ（先行放送、次回予告、グッズ発売予定等）を告知している場合、ファンは「告知」のみを知っている。未公開コンテンツの実際の内容を議論・推測・言及してはならない — ワクワクしたり気になったりするだけ。
- このルールに違反するとタイムラインのリアリズムが崩壊する。厳格に禁止。
${Utils.PROMPTS.infoAccessRule('forum')}
- ⚠️⚠️ 因果関係と時系列（最重要）：
  - タイムラインは時系列順に並んでいる。最後のエントリが最新/現在の話数。
  - 各話の出来事はその話の時系列位置に属する。因果関係を逆転させてはならない — 事件Aが事件Bより前の話数で起きた場合、BがAの原因にはなり得ない。
  - NPCが過去の話数に言及する場合、過去形/回想として表現すること（例：「第3話であった〇〇」「あの時の〇〇」）。
  - 公式情報（インタビュー、ツイート等）はタグ付けされた話数の後に公開されたもの。ファンはその時点から知っている — 現時点での新情報ではない。
  - NPCが旧情報を現在の議論で参照する場合、必ず回想の言い方を使うこと：「そういえば前のインタビューで…」「あの時の公式発表でも…」「ep4の後に出た設定集にあったけど」。旧情報をあたかも最新発表のように表現してはならない：「最新のインタビューによると」「公式が発表しました」— 数話前の情報にこれは誤り。

リアリズムルール：
- 本物のBBSは多様なコンテンツを持つ — 真面目な考察、カプ語り、ネタ、懐古を自然にミックスすること
- 話題の鮮度：新スレッドはタイムライン末尾の最新の剧情と情報に焦点を当てるべき。数話前の公式情報は旧ニュース — ファンは公開時に既にリアクション済み。コミュニティが既に議論し終えた旧情報を新スレの主題にしてはならない。旧情報は現在の話題のスレ内で簡潔に回想する程度に留める（例：「そういえば前のインタビューで否定してたよなｗｗｗ」）。
- 2ch/5chスラング使用：ｗｗｗ, 草, ワロタ, それな, >>数字, 尊い, 神回 等
- 顔文字 — レスの30〜40%程度に2ch風顔文字とリアクションワードを自然に織り交ぜる：(´・ω・\`) (ﾟ∀ﾟ) ヽ(´▽｀)/ (；ﾟДﾟ) (TдT)(・∀・) m(_ _)m — やばい / なんだこれ / まじか / うわー / ちょっと待って 等。1レスにつき1〜2個まで、不自然な箇所には入れない。
- 各スレッドはトーンが異なるように
- 最新の剧情/公式情報がまだ議論されていない場合、類似スレがあっても優先的にカバーすること

レスのルール：
- すべてのレスはそのスレッドの話題内に留まること
- レスのスタイルを多様化：直接返信、同意、話題内の余談、過去レスの引用
- すべてのレスが>>1を引用しないこと
- 改行（必須）：実際の改行文字を使ってレスを区切ること。文や思考の区切りごとに改行。2文以上のレスには最低1つの改行を入れること。一塊のテキストブロックにしないこと。
${this._getPersistentThreadContext()}
${typeof Utils !== 'undefined' ? Utils.getEventContextPrompt(5) : ''}
${eventGate.open
    ? `\n【同人即売会の状況】現在「${eventGate.stage === 'open' ? '開催中' : eventGate.stage === 'preopen' ? '開催間近' : '終了直後'}」の同人即売会: ${eventGate.events.map(e => e.name + (e.venue ? `（${e.venue}）` : '')).join('、')}。即売会レポ・参加報告系のスレッドはこの状況に即して書くこと（話題の中心: ${eventGate.topics.join('・')}）。`
    : `\n【同人即売会の状況】現在、開催中・開催間近の同人即売会は存在しない。同人即売会・同人イベント（コミケ / オンリー / オンライン即売会など）に関する話題 — 参加予定・新刊予告・戦利品・参加レポなど — を一切捏造・言及しないこと。`}
${this.getLegendNpcContext()} `;

            const messages = [{
                role: 'user',
                content: `${context} 以上の世界観・設定・情報に基づいて、リアルな5ch風掲示板スレッドを${threadCount}つ生成してください。多様なタイプで、本物の匿名掲示板のように自然な雰囲気にしてください。`
            }];

            const response = await Utils.callChatAPI(messages, systemPrompt);

            const threads = this._parseThreadsText(response);
            if (threads.length === 0) {
                console.error('[Forum] Parse error: no threads found', response);
                Utils.showToast(I18n.t('t.forum_gen_format_error', '生成格式错误，请重试'));
                return;
            }

            if (!data.threads) data.threads = [];

            // 去重：精确匹配过滤完全相同标题（先剥离翻译块，只比对日文原文，避免译文措辞不同导致判不重）
            const existingTitles = new Set((data.threads || []).map(t => this.stripTranslationTags(t.title).toLowerCase().replace(/\s+/g, '')));
            const dedupedThreads = threads.filter(t => {
                const norm = this.stripTranslationTags(t.title).toLowerCase().replace(/\s+/g, '');
                return !existingTitles.has(norm);
            });
            if (dedupedThreads.length === 0) {
                Utils.showToast(I18n.t('t.forum_gen_duplicate', '生成的帖子与已有内容重复，请重试'));
                return;
            }

            const genNow = Date.now();
            dedupedThreads.forEach(t => {
                const threadId = Utils.generateId();
                const opId = this.generateAnonId();
                const now = genNow - Math.floor(Math.random() * 300000);

                const parsedReplies = (t.replies || []).map((r, i) => {
                    const reply = {
                        number: i + 2,
                        author: r.author || '名無しさん',
                        authorId: this.generateAnonId(),
                        content: r.content,
                        timestamp: now + (i + 1) * 60000 + Math.floor(Math.random() * 60000)
                    };
                    if (r.isOp) reply.isOp = true;
                    if (r.isAnchorResolved) reply.isAnchorResolved = true;
                    return reply;
                });
                // 安価スレ：记录作者名（用于后续提取 OP 楼）
                const opAuthor = t.type === 'anchor'
                    ? (parsedReplies.find(r => r.isOp)?.author || t.author || '作者')
                    : undefined;

                this._newThreadIds.set(threadId, genNow);
                // 记录关联的剧情节点ID，用于冷却判定 + 実況スレの「1話1本」判定
                const linkedPlotId = ((t.type === 'discussion' || t.type === 'livewatch') && latestPlot) ? latestPlot.id : undefined;
                const threadObj = {
                    id: threadId,
                    title: t.title,
                    content: t.content,
                    author: t.author || '名無しさん',
                    authorId: opId,
                    linkedPlotId: linkedPlotId,
                    timestamp: now,
                    threadType: t.type || 'discussion',
                    replies: parsedReplies
                };
                if (opAuthor) threadObj.opAuthor = opAuthor;
                // LLM 显式 CATEGORY 优先（official-hot 只有它知道）；具体 official-* 类型漏写时按类型映射兜底
                const officialCat = t.officialCategory || OFFICIAL_CATEGORY_BY_TYPE[t.type];
                if (officialCat) threadObj.officialCategory = officialCat;
                data.threads.unshift(threadObj);
            });

            // Parse and route persistent replies
            const persistentReplyBlocks = response.split(/===\s*PERSISTENT_REPLY\s*===/i).slice(1);
            persistentReplyBlocks.forEach(block => {
                const threadIdMatch = block.match(/THREAD_ID:\s*(.+)/);
                const authorMatch = block.match(/AUTHOR:\s*(.+)/);
                const contentMatch = block.match(/CONTENT:\s*\n?([\s\S]*?)(?=\n===|\s*$)/);
                if (!threadIdMatch || !contentMatch) return;

                const targetId = threadIdMatch[1].trim();
                const targetThread = (data.threads || []).find(t => t.id === targetId && t.isPersistent);
                if (!targetThread) return;
                if ((targetThread.replies || []).length >= this.THREAD_REPLY_LIMIT) return;

                if (!targetThread.replies) targetThread.replies = [];
                targetThread.replies.push({
                    number: targetThread.replies.length + 2,
                    author: (authorMatch ? authorMatch[1].trim() : '名無しさん'),
                    authorId: this.generateAnonId(),
                    content: contentMatch[1].trim(),
                    timestamp: Date.now() + Math.floor(Math.random() * 60000)
                });

                // Auto-create Part N+1 if full
                if (targetThread.replies.length >= this.THREAD_REPLY_LIMIT) {
                    const nextPart = (targetThread.partNum || 1) + 1;
                    const baseTitle = targetThread.title.replace(/^【Part \d+】/, '').replace(/^【総合】/, '【総合】');
                    const newThread = {
                        id: Utils.generateId(),
                        title: `【Part ${nextPart}】${baseTitle}`,
                        content: `前スレ: ${targetThread.title}\n引き続きお話しましょう。`,
                        author: '名無しさん',
                        authorId: this.generateAnonId(),
                        timestamp: Date.now(),
                        threadType: 'persistent',
                        isPersistent: true,
                        keywords: targetThread.keywords || [],
                        replies: [],
                        partNum: nextPart,
                        partOf: targetThread.partOf || targetThread.id
                    };
                    data.threads.unshift(newThread);
                    targetThread.isPersistent = false; // old thread is no longer pinned
                    this._newThreadIds.set(newThread.id, Date.now());
                }
            });

            Utils.saveData();
            this.renderThreadList();
            Utils.showToast(I18n.t('t.forum_new_thread_done', '✓ 新スレッド生成完了'));
        } catch (e) {
            Utils.showToast(I18n.t('t.forum_gen_failed_ja', '生成失敗: ') + e.message);
            console.error('[Forum Error]', e);
        } finally {
            if (btn) { btn.textContent = '+'; btn.disabled = false; }
        }
    },

    // 加载骨架屏清理（成功/失败/提前 return 都要调用，避免骨架屏 DOM 残留）
    _removeForumSkeleton() {
        const skelBlock = document.getElementById('forumSkeletonBlock');
        if (skelBlock) skelBlock.remove();
    },

    // ===== 加载更多回复 =====
    async loadMoreReplies() {
        if (this._loadingReplies) return;   // 并发锁：生成期间重入直接挡（治楼层号重复持久化/删错楼），finally 里复位
        const data = AppState.data.forumData;
        const thread = this._findThread();
        if (!thread) return;

        const btn = document.getElementById('forumLoadMoreBtn');
        if (btn) { btn.textContent = I18n.t('forum.summary_generating', '生成中...'); btn.disabled = true; }

        // ユーザー指定のレス数を取得（骨架屏にも使用）
        const replyCount = Math.max(1, Math.min(20, parseInt(document.getElementById('forumReplyCount')?.value || '5')));

        // 骨架屏表示
        const loadActions = document.querySelector('.forum-load-actions');
        if (loadActions) {
            let skel = document.getElementById('forumSkeletonBlock');
            if (!skel) {
                skel = document.createElement('div');
                skel.id = 'forumSkeletonBlock';
                skel.innerHTML = `<div class="forum-skeleton-reply"><div class="skel-header"><div class="skel-circle"></div><div class="skel-line" style="width:30%"></div></div><div class="skel-line" style="width:90%"></div><div class="skel-line" style="width:70%"></div></div>`.repeat(Math.min(replyCount, 6));
                loadActions.parentNode.insertBefore(skel, loadActions);
            }
        }

        this._loadingReplies = true;
        try {
        // 已达上限则不再生成
        if ((thread.replies?.length || 0) >= this.THREAD_REPLY_LIMIT) {
            Utils.showToast(I18n.t('t.forum_thread_ended', 'このスレは終了しました。次スレをお立てください。'));
            return;
        }

        // 安価スレ専用ロジック
        if (thread.threadType === 'anchor') {
            return await this._loadMoreAnchorReplies(thread, btn);
        }

        // 黒スレ専用ロジック（粉丝反制）
        if (thread.threadType === 'anti') {
            return await this._loadMoreAntiReplies(thread, btn);
        }

        // 実況スレ専用ロジック（短文連投）
        if (thread.threadType === 'livewatch') {
            return await this._loadMoreJikkyouReplies(thread, btn);
        }

            const context = this.getWorldContext();
            const bilingualPrompt = this.getBilingualPrompt();
            const safetyContext = this.getSafetyContext();

            // 如果是小说分享的帖子，获取完整小说内容作为上下文
            let novelContext = '';
            if (thread.novelId) {
                const pixivData = AppState.data.pixivData;
                const novel = (pixivData.novels || []).find(n => n.id === thread.novelId);
                if (novel) {
                    const chapter = novel.chapters[0]; // 获取第一章
                    // 去除HTML标签和翻译，只保留日文原文
                    const fullContent = this.stripTranslationTags(chapter.content || '');
                    novelContext = `\n\n【小説全文】\nタイトル：${novel.title} \n作者：${novel.author} \nタグ：${(novel.tags || []).join(', ')} \n\n内容：\n${fullContent.substring(0, 2000)}${fullContent.length > 2000 ? '...' : ''} \n`;
                }
            }

            // 只提取日文原文，减少token消耗
            const titleJP = this.stripTranslationTags(thread.title);
            const contentJP = this.stripTranslationTags(thread.content);

            let existingContent = `スレタイ：${titleJP} \n1 ${thread.author}：${contentJP} \n`;

            if (thread.replies && thread.replies.length > 0) {
                // 策略：包含前3楼 + 最后3楼，避免主题偏移
                const firstReplies = thread.replies.slice(0, 3);  // 前3楼
                const lastReplies = thread.replies.slice(-3);     // 最后3楼

                // 如果总回复数<=6，避免重复
                const repliesToInclude = thread.replies.length <= 6
                    ? thread.replies
                    : [...firstReplies, ...lastReplies];

                // 去重（如果前3和后3有重叠）
                const uniqueReplies = Array.from(
                    new Map(repliesToInclude.map(r => [r.number, r])).values()
                ).sort((a, b) => a.number - b.number);

                uniqueReplies.forEach(r => {
                    const replyJP = this.stripTranslationTags(r.content);
                    existingContent += `${r.number} ${r.author}：${replyJP} \n`;
                });

                // 如果有省略的楼层，添加提示
                if (thread.replies.length > 6) {
                    const omittedCount = thread.replies.length - 6;
                    existingContent += `\n（中間の${omittedCount} 件のレスは省略）\n\n`;
                }
            }

            const legendContext = this.getLegendNpcContext();

            // OP 回归规则
            const opAuthorName = thread.author || '名無しさん';
            const opReturnRule = thread.isUserThread
                ? `\n⚠️ SPECIAL — USER THREAD: The OP "${opAuthorName}" is the REAL USER of this app(not an AI NPC).Do NOT generate any reply marked[OP] — the user handles their own OP replies.NPCs may occasionally wonder about the OP(max 1 per batch): ">>1 気になる" "OP返事してくれないの" "スレ主来ないかな"\n`
                : `\nOP RETURN RULE: With ~25 % probability, include ONE reply from the OP returning to the thread.Format: AUTHOR: ${opAuthorName} [OP].OP returns are brief(1 reply max per batch) and natural.\n`;

            const systemPrompt = `あなたは5ch/2ch掲示板シミュレーションエンジンです。リアルな日本のアニメファンコミュニティの投稿を生成する専門システムです。
すべてのNPC・投稿・議論は、架空のアプリ内の架空のフォーラムに存在します。参照される作品はすべて商業アニメ/漫画/ゲームです。ダークなテーマ（戦争、トラウマ、虐待、喪失、道徳的曖昧さ、ヴィラン心理等）は標準的なACG要素であり、実際の日本アニメ掲示板と同様にNPCが自由に議論すべきです。

${safetyContext}
${legendContext}
5ch/2chスタイルのスレッドに対するレスを生成してください。
${opReturnRule}

${bilingualPrompt}

出力フォーマット — 以下のデリミタ形式を厳守（JSONではない）：

---REPLY---
AUTHOR: 日本語名 or 名無しさん
CONTENT:
レス内容（複数行可、HTML翻訳タグ可）
---REPLY---
AUTHOR: 名無しさん
CONTENT:
レス内容

${replyCount}件のレスを生成。5chスタイル使用：ｗｗｗ, 草, それな, >>引用 等。

話題遵守ルール（優先順位）：
🔴 優先度1（最高 — 話題範囲の境界）：
- スレタイと1番（OP）がコアとなる話題範囲を定義する
- すべてのレスはこの話題範囲内に留まるが、様々な角度からアプローチ可能
- 例：話題が「周辺情報」→ 価格、品質、購入方法、転売、海外発送などを議論可能
- 例：話題が「新人入坑推薦」→ 賛否、ストーリーの入りやすさ、前提知識の有無を議論可能

🟡 優先度2（自然な議論の多様性）：
レスは自然に多様な関わり方をすること。以下のインタラクションスタイルをミックス：
- OPへの直接レス：質問に答えたり意見に反応（>>1は時々のみ、毎回ではない）
- 同意・賛同：OPの意見に同意し補足
- 関連話題：話題内の関連側面を議論（例：OPが価格の話→レスが海外入手の話）
- 過去レスへの返信：>>2-4を参照して議論を発展
- 独立した意見：誰にも直接返信せず関連する考えを共有
- 反対意見：丁寧に異論を唱えるか別の視点を提供（話題内で）

🟢 優先度3（脱線禁止）：
- 完全に無関係な話題に脱線しないこと（周辺話題→声優ゴシップは禁止）
- タイトル+OPが定義する「話題ファミリー」内に留まること
- OPが質問している場合、少なくとも一部のレスはそれに答えること

自然なフォーラムの振る舞い：
✅ 本物の5chスレには多様性がある：OPに直接答えるレス、話題について住民同士で会話するレス
✅ すべてのレスが>>1を引用する必要はない — 5件中1〜2件程度
✅ 後のレスは>>2, >>3など他のレスを参照して議論を展開できる
✅ 話題に関する独立した意見や愚痴も可能
✅ 顔文字 — レスの30〜40%程度に2ch風顔文字とリアクションを自然に織り交ぜる：(´・ω・\`) (ﾟ∀ﾟ) ヽ(´▽｀)/ (；ﾟДﾟ) (TдT)(・∀・) — やばい / まじか / うわー / ちょっと待って 等。1レスにつき1〜2個まで。
✅ 改行（必須）：文と文の間に改行を入れること。2文以上のレスには最低1つの改行。一塊のテキストブロックにしない。

🚫 絶対ルール — 捏造禁止（最優先、すべてに優先）：
- ワールドコンテキストに明示的に記載されていないプロット展開、キャラの成長、シリーズの結末、ストーリーの結果を捏造・想像・推測してはならない。
- コンテキストにep1しかない場合、NPCはep1のみが放送された世界に生きている。ep2、最終回、どんでん返し、記載されていないものは知り得ない。
- 重要 — 告知 ≠ 内容：公式情報が今後のコンテンツ（先行放送、次回予告、グッズ発売予定等）を告知している場合、NPCは「告知」のみを知っている。未公開アイテムの実際の内容を議論・言及してはならない — ワクワクしたり気になったりするだけ。
- このルールに違反するとタイムラインのリアリズムが崩壊する。最も重要な制約である。
${Utils.PROMPTS.infoAccessRule('forum')}

🔵 懐かし上げルール（コンテキストに新しい内容が実際に存在する場合のみ適用）：
ワールドコンテキストにスレのOPが議論した時点より新しいプロットや公式情報が含まれている場合、一部のレスがその新しい展開に言及してもよい — ただしコンテキストに明示的に存在する事件のみ、かつスレのコア話題に関連する範囲でのみ。
これは実際のBBSでファンが後知恵で古いスレを上げる行動をシミュレートする（「懐かし上げ」）。

話題範囲は変わらない。新しいコンテキストは話題を豊かにするが、変えるものではない：
- スレ：「AはBより弱くない？」→ 後のレス：「完全に見誤ったわｗ 10話でAが圧倒するとは思わなかった」（話題：戦闘力、ep10がコンテキストにある場合のみ）
- スレ：「新キャラ好きすぎ！」→ 後のレス：「10話まで見てさらに好きになった。あの伏線回収が神すぎる」（話題：このキャラ、ep10がコンテキストにある場合のみ）

懐かし上げレスの自然なフレーズ：「この頃はこう思ってたけど」「今見ると」「伏線だったんかｗｗ」「見事に予想外れた」「あの頃から好きだったけど今は更に」
⚠️ コンテキストにOPの時点より新しい展開がない場合、これらのフレーズを使ってはならない。OPの時点の「後」に何かがあったことを暗示してはならない。

良い多様性の例：
スレ：「価格高すぎない？」
- レス1：「>>1 同意、3000円は無理」（OPへの直接返信）
- レス2：「海外だと更に送料がかかるからな...」（関連余談 — 送料）
- レス3：「>>2 転売ヤーのせいで更に高騰してるし」（レス2を受けて — 転売）
- レス4：「品質見ると妥当な価格だと思うけど」（独立意見、やんわり反対）
- レス5：「公式通販まだ在庫あるぞ」（役立つ情報、直接引用なし）

話題範囲内で、議論が自然に流れるようにしてください！`;

            const messages = [{
                role: 'user',
                content: `${context}${novelContext}
【⚠️ 最高優先度 - CRITICAL CONTEXT】
このスレッドの話題範囲を守ってください：

📌 スレタイ：${titleJP}
📌 1番の内容：${contentJP}

上記が定義する「話題の範囲」内で、自然な議論を生成してください。

💡 重要な指針：
- すべてのレスはこのトピック範囲内にいる必要がありますが、アプローチは多様であるべきです
    - 1番に直接返信する必要はありません（自然な場合のみ >> 1 を使用）
- 前のレス（>> 2 - 4など）と対話したり、独立した観点を提供したりできます
    - 実際の掲示板のように、議論が自然に流れるようにしてください
        - 【絶対禁止】コンテキストに存在しないストーリー展開・結末・キャラの変化を一切捏造しないでください。存在するのはコンテキストに明記された情報のみです
            - 【懐かし上げ】コンテキストにスレOPより新しい展開が明記されている場合のみ、その情報を「このスレの話題の視点から」自然に言及してください。新しい展開がなければ懐かし上げは行わないでください

例：話題が「周辺情報」の場合
→ OK: 価格、品質、購入方法、転売、海外発送などを議論
→ NG: 声優や制作スタッフの話に完全に離れる

以下は既存のスレッド内容：
${existingContent}

新しい${replyCount}件のレスを生成してください。
重要：【スレタイと1番で定義された話題範囲】内で、自然で多様な議論を展開してください。`
            }];

            const response = await Utils.callChatAPI(messages, systemPrompt);

            const replies = this._parseRepliesText(response);
            if (replies.length === 0) {
                console.error('[Forum] Reply parse error: no replies found', response);
                Utils.showToast(I18n.t('t.forum_gen_format_error', '生成格式错误，请重试'));
                return;
            }

            if (!thread.replies) thread.replies = [];
            const now = Date.now();
            const nextNum = thread.replies.length + 2; // 生成完成后现算，避免生成期间用户回帖（userReply等）导致楼号重复

            replies.forEach((r, i) => {
                const reply = {
                    number: nextNum + i,
                    author: r.author || '名無しさん',
                    authorId: this.generateAnonId(),
                    content: r.content,
                    timestamp: now + i * 3000 // 每条间隔3秒，不会跑到未来
                };
                if (r.isOp) reply.isOp = true;
                thread.replies.push(reply);
            });

            Utils.saveData();
            this._loadingReplies = false; // renderThread 前先解锁，避免按钮渲染成过期的"生成中"态
            this.renderThread();
            Utils.showToast(I18n.t('t.forum_new_reply_done', '✓ 新レス読み込み完了'));
        } catch (e) {
            Utils.showToast(I18n.t('t.forum_load_failed_ja', '読み込み失敗: ') + e.message);
            console.error('[Forum Reply Error]', e);
        } finally {
            if (btn) { btn.textContent = I18n.t('forum.load_more', 'もっと見る'); btn.disabled = false; }
            this._removeForumSkeleton();
            this._loadingReplies = false;
        }
    },

    // ===== 安価スレ専用：OP楼+安価楼を抽出して続きを生成 =====
    async _loadMoreAnchorReplies(thread, btn) {
        try {
            const context = this.getWorldContext();
            const bilingualPrompt = this.getBilingualPrompt();
            const safetyContext = this.getSafetyContext();

            // 只抽取 OP 楼（故事主线），不管有多少闲聊楼都不看
            const opReplies = (thread.replies || []).filter(r => r.isOp);
            const lastAnchor = [...(thread.replies || [])].reverse().find(r => r.isAnchorResolved);

            // 构建故事上下文（OP开帖 + OP续写楼）
            let storyContext = `スレタイ：${this.stripTranslationTags(thread.title)} \n`;
            storyContext += `1 ${thread.author}：${this.stripTranslationTags(thread.content)} \n\n`;
            if (opReplies.length > 0) {
                storyContext += `【作者の投稿（物語の主軸）】\n`;
                opReplies.forEach(r => {
                    storyContext += `${r.number} ${r.author}：${this.stripTranslationTags(r.content)} \n\n`;
                });
            }
            if (lastAnchor) {
                storyContext += `【直前の安価（選ばれた選択肢）】\n`;
                storyContext += `${lastAnchor.number} ${lastAnchor.author}：${this.stripTranslationTags(lastAnchor.content)} \n\n`;
            }

            const nextNum = (thread.replies ? thread.replies.length : 0) + 2;
            const opAuthor = thread.opAuthor || opReplies[0]?.author || '作者◆????';
            // 下一个安価的指定楼层（nextNum+2，留出2楼给读者投票）
            const nextAnchorNum = nextNum + 2;

            const systemPrompt = `あなたは5ch/2ch掲示板シミュレーションエンジンです。安価スレ（インタラクティブストーリースレッド）の次のラウンドを生成します。

${safetyContext}

安価スレの仕組み：
- 作者（作者◆、OP）が物語を書き、>>N安価指示（読者にN番レスで次の展開を選ばせる）で終わる
- 読者が短い投票・提案レスを投稿する
- 指定された>>N番のレスが「安価」＝選ばれた方向性になる
- OPはその安価の選択を取り入れて物語を続ける

${bilingualPrompt}

出力フォーマット（厳守、JSONではない）：
---REPLY---
AUTHOR: 名無しさん
CONTENT:
[読者の投票・提案 — 1行の短文]
---REPLY---
AUTHOR: 名無しさん
CONTENT:
[別の読者の投票 — 1行の短文]
---REPLY---
AUTHOR: 名無しさん[ANCHOR]
CONTENT:
[${nextAnchorNum}番の「当選」投票 — OPが取り入れる内容]
---REPLY---
AUTHOR: ${opAuthor} [OP]
CONTENT:
[安価の選択を取り入れて物語を続ける。3〜6文の叙述。次の選択のための新しい>>N安価指示で終わる（N = ${nextAnchorNum + 3}程度）]

正確に生成：読者の票2件→安価楼1件→OP続き1件。

ルール：
- 投票は短く（1〜2行）、多様で、創造的かつもっともらしいこと
- [OP]セグメントは[ANCHOR]の選択をスムーズに物語に取り入れること
- [OP]は明確な>>N安価指示で終わること（次の選択をまだ解決しない）
- 提供されたワールドコンテキストの設定とキャラクター内に留まること
- 捏造禁止：ワールドコンテキストにないプロット展開を作らないこと
${Utils.PROMPTS.infoAccessRule('forum')}
- 時系列厳守：タイムラインは時系列順。各公式情報はタグ付けされた時期に属する — 旧情報を新しいものとして扱ったり、異なる時期の情報を統合しないこと。`;

            const messages = [{
                role: 'user',
                content: `${context} \n\n以下はこの安価スレの作者投稿（物語主軸）のみ抽出したものです：\n\n${storyContext} \n\n上記の流れを踏まえ、次のラウンドを生成してください（読者の票2件→安価楼→作者の続き）。`
            }];

            const response = await Utils.callChatAPI(messages, systemPrompt);
            const replies = this._parseRepliesText(response);

            if (replies.length === 0) {
                Utils.showToast(I18n.t('t.forum_gen_format_error', '生成格式错误，请重试'));
                return;
            }

            if (!thread.replies) thread.replies = [];
            const now = Date.now();
            replies.forEach((r, i) => {
                const reply = {
                    number: nextNum + i,
                    author: r.author || '名無しさん',
                    authorId: this.generateAnonId(),
                    content: r.content,
                    timestamp: now + i * 3000
                };
                if (r.isOp) reply.isOp = true;
                if (r.isAnchorResolved) reply.isAnchorResolved = true;
                thread.replies.push(reply);
            });

            thread.lastReplyAt = Date.now();
            Utils.saveData();
            this._loadingReplies = false; // renderThread 前先解锁，避免按钮渲染成过期的"生成中"态
            this.renderThread();
            Utils.showToast(I18n.t('t.forum_anchor_thread_done', '✓ 安価スレ続き生成完了'));
        } catch (e) {
            Utils.showToast(I18n.t('t.forum_gen_failed', '生成失败：') + e.message);
            console.error('[Anchor Thread Error]', e);
        } finally {
            if (btn) { btn.textContent = I18n.t('forum.load_more', 'もっと見る'); btn.disabled = false; }
            this._removeForumSkeleton();
        }
    },

    // ===== 黒スレ専用：粉丝和黑子混战续集 =====
    async _loadMoreAntiReplies(thread, btn) {
        try {
            const context = this.getWorldContext();
            const bilingualPrompt = this.getBilingualPrompt();
            const safetyContext = this.getSafetyContext();

            // 提取最近几楼内容作为上下文（用较少楼数即可）
            const titleJP = this.stripTranslationTags(thread.title);
            const contentJP = this.stripTranslationTags(thread.content);
            let existingContent = `スレタイ：${titleJP} \n1 ${thread.author}：${contentJP} \n`;
            const recentReplies = (thread.replies || []).slice(-5);
            recentReplies.forEach(r => {
                existingContent += `${r.number} ${r.author}：${this.stripTranslationTags(r.content)} \n`;
            });

            const nextNum = (thread.replies ? thread.replies.length : 0) + 2;

            const systemPrompt = `あなたは5ch/2ch掲示板シミュレーションエンジンです。白熱するアンチスレ（批判スレッド）のレスを生成します。

${safetyContext}

これは5chのアンチスレです。アンチがアンチ投稿をする一方、ファンが反撃します。構図：
- 一部のレスが批判を続ける（アンチ側）
- より多くのレスが作品/キャラを擁護する（ファン側 — まともなアンチスレには必ず現れる）
- たまに「中立」や「疲れた傍観者」

${bilingualPrompt}

出力フォーマット：
---REPLY---
AUTHOR: 名無しさん
CONTENT:
レス内容
---REPLY---
AUTHOR: 名無しさん
CONTENT:
レス内容

4〜6件のレスを生成 — ファン側が圧倒すること：
- アンチレスは最大1件（孤独なヘイター、すぐ埋もれる）
- ファン擁護レス3〜4件：熱意あふれるファンが具体的なキャラ/プロット詳細を引用して反論 — は？、見る目ないだろ、むしろ好きなんだけど、アンチスレを布教スレにするな（してるのは俺だが）、何が嫌いかより何が好きかを語れよ
- 中立/疲れた傍観者1件（またか、荒らし多いな、平和に見たい）

重要ルール：
- 【絶対禁止】コンテキストに存在しないストーリー展開を捏造しないでください
- ファン側はワールドコンテキストにある実際のキャラクター・ストーリーの詳細を引用して反論すること — 具体的で説得力のある擁護にすること
- アンチは少数派で論破される — スレはファンに占拠されている
${Utils.PROMPTS.infoAccessRule('forum')}
- 時系列厳守：タイムラインは時系列順。公式情報（インタビュー、ツイート等）はそれぞれタグ付けされた時期に属する — 旧情報を新しいものとして扱ったり、異なる時期の情報を統合しないこと。`;

            const messages = [{
                role: 'user',
                content: `${context}

以下はこの黒スレの内容です：
${existingContent}

上記の流れで、アンチvsファンの言い争いを続けてください。${nextNum} 番から開始。`
            }];

            const response = await Utils.callChatAPI(messages, systemPrompt);
            const replies = this._parseRepliesText(response);

            if (replies.length === 0) {
                Utils.showToast(I18n.t('t.forum_gen_format_error', '生成格式错误，请重试'));
                return;
            }

            if (!thread.replies) thread.replies = [];
            const now = Date.now();
            replies.forEach((r, i) => {
                thread.replies.push({
                    number: nextNum + i,
                    author: r.author || '名無しさん',
                    authorId: this.generateAnonId(),
                    content: r.content,
                    timestamp: now + i * 3000
                });
            });

            thread.lastReplyAt = Date.now();
            Utils.saveData();
            this._loadingReplies = false; // renderThread 前先解锁，避免按钮渲染成过期的"生成中"态
            this.renderThread();
            Utils.showToast(I18n.t('t.forum_anti_thread_done', '✓ 粉黑大战续集生成完了'));
        } catch (e) {
            Utils.showToast(I18n.t('t.forum_gen_failed', '生成失败：') + e.message);
            console.error('[Anti Thread Error]', e);
        } finally {
            if (btn) { btn.textContent = I18n.t('forum.load_more', 'もっと見る'); btn.disabled = false; }
            this._removeForumSkeleton();
        }
    },

    // ===== 実況スレ専用：短文連投リアタイ反応 =====
    async _loadMoreJikkyouReplies(thread, btn) {
        try {
            const context = this.getWorldContext();
            const bilingualPrompt = this.getBilingualPrompt();
            const safetyContext = this.getSafetyContext();
            const legendContext = this.getLegendNpcContext();

            const nextNum = (thread.replies ? thread.replies.length : 0) + 2;
            const existingReplies = (thread.replies || []).slice(-8);
            let existingContent = `スレタイ：${this.stripTranslationTags(thread.title)} \n1 ${thread.author}：${this.stripTranslationTags(thread.content)} \n\n`;
            if (existingReplies.length > 0) {
                existingContent += `【直近のレス】\n`;
                existingReplies.forEach(r => {
                    existingContent += `${r.number} ${r.author}：${this.stripTranslationTags(r.content)} \n`;
                });
            }

            const systemPrompt = `あなたは5ch/2ch掲示板シミュレーションエンジンです。
${safetyContext}
${legendContext}
${bilingualPrompt}

実況スレ（リアルタイム放送反応スレッド）の続きレスを生成してください。
エピソードはまさに放送中 — 視聴者が同時にリアルタイムで速攻レスしている状況です。

⚡ 実況スレの絶対スタイルルール：
- 各レスは最大1〜5行。例外なし。
- レス＝10秒で打ち込むリアルタイム反応。考察やエッセイではない。
- 多用すべき表現：草 / wwww / やばい / ちょっと待って / うそだろ / きたああ / CM中だ / 泣いた / 震えてる
- 一部のレスは顔文字や一言だけ：(ﾟ∀ﾟ) / 草 / 待って / 泣いた
- 複数人が同じシーンにそれぞれ異なる角度から反応（同時性の演出）
- 時々のクロスレス：「>>N 俺も同じとこ」「>>N わかるｗｗｗ」
- 考察、分析、長い意見は書かないこと。

🚫 捏造禁止：ワールドコンテキストに明示的に記載されたイベントへの反応のみ生成すること。
${Utils.PROMPTS.infoAccessRule('forum')}

出力フォーマット（厳守）：
---REPLY---
AUTHOR: 名無しさん
CONTENT:
（リアクション、1〜5行以内）

6〜8件のレスを生成し、実況の続きをしてください。`;

            const messages = [{ role: 'user', content: `${context}\n\n以下はこの実況スレの内容です：\n${existingContent}\n\n${nextNum} 番から、上記の実況スレを続けてください。` }];
            const response = await Utils.callChatAPI(messages, systemPrompt);
            const replies = this._parseRepliesText(response);

            if (replies.length === 0) {
                Utils.showToast(I18n.t('t.forum_gen_format_error', '生成格式错误，请重试'));
                return;
            }

            if (!thread.replies) thread.replies = [];
            const now = Date.now();
            let cumulativeDelay = 0;
            replies.forEach((r, i) => {
                // 随机间隔 100-5000ms，模拟实况的自然节奏
                cumulativeDelay += Math.floor(Math.random() * 4900) + 100;
                thread.replies.push({
                    number: nextNum + i,
                    author: r.author || '名無しさん',
                    authorId: this.generateAnonId(),
                    content: r.content,
                    timestamp: now + cumulativeDelay
                });
            });

            thread.lastReplyAt = Date.now();
            Utils.saveData();
            this._loadingReplies = false; // renderThread 前先解锁，避免按钮渲染成过期的"生成中"态
            this.renderThread();
            Utils.showToast(I18n.t('t.forum_jikkyou_reply_done', '✓ 実況レス読み込み完了'));
        } catch (e) {
            Utils.showToast(I18n.t('t.forum_gen_failed', '生成失败：') + e.message);
            console.error('[Jikkyou Thread Error]', e);
        } finally {
            if (btn) { btn.textContent = I18n.t('forum.load_more', 'もっと見る'); btn.disabled = false; }
            this._removeForumSkeleton();
        }
    },

    // ===== スレ Part 制度：次スレ生成 =====
    async generateNextPart(threadId) {
        const data = AppState.data.forumData;
        const thread = this._findThread(threadId);
        if (!thread) return;

        const btn = document.getElementById('forumNextPartBtn');
        if (btn) { btn.textContent = I18n.t('forum.summary_generating', '生成中...'); btn.disabled = true; }

        const partNum = (thread.partNum || 1) + 1;
        const baseTitle = this.stripTranslationTags(thread.title).replace(/^【Part \d+】\s*/, '').trim();

        // 取最后10条回复作为衔接上下文
        const lastReplies = (thread.replies || []).slice(-10);
        let prevContext = `前スレ（Part ${partNum - 1}）最後のレス: \n`;
        lastReplies.forEach(r => {
            prevContext += `${r.number} ${r.author}：${this.stripTranslationTags(r.content)} \n`;
        });

        try {
            const context = this.getWorldContext();
            const bilingualPrompt = this.getBilingualPrompt();
            const safetyContext = this.getSafetyContext();

            const systemPrompt = `あなたは5ch/2ch掲示板シミュレーションエンジンです。
${safetyContext}
${bilingualPrompt}

以下のスレッドの次スレ（Part ${partNum}）を1つだけ生成してください。

タイトル：「【Part ${partNum}】${baseTitle}」
OP内容：前スレへの簡潔な言及（例：「前スレ：${baseTitle} Part ${partNum - 1}」）の後、議論を続ける。OPは短く（1〜3行）。
スレタイプ：${thread.threadType}
元スレと同じスタイルで5〜8件のレスを生成。

${prevContext}

${context}

🚫 捏造禁止：上記ワールドコンテキストに明示的に記載されたイベントのみ参照すること。
${Utils.PROMPTS.infoAccessRule('forum')}

出力フォーマット（厳守）：
===THREAD===
TITLE: 【Part ${partNum}】${baseTitle}
AUTHOR: 名無しさん
TYPE: ${thread.threadType}
CONTENT:
（OP内容）
---REPLY---
AUTHOR: 名無しさん
CONTENT:
（レス内容）`;

            const messages = [{ role: 'user', content: '次スレを生成してください。' }];
            const response = await Utils.callChatAPI(messages, systemPrompt);
            const parsed = this._parseThreadsText(response);

            if (!parsed || parsed.length === 0) {
                Utils.showToast(I18n.t('t.forum_gen_failed_retry', '生成失败，请重试'));
                return;
            }

            const t = parsed[0];
            const now = Date.now();
            const newThread = {
                id: Utils.generateId(),
                title: t.title || `【Part ${partNum}】${baseTitle} `,
                content: t.content,
                author: t.author || '名無しさん',
                authorId: this.generateAnonId(),
                timestamp: now,
                threadType: thread.threadType,
                replies: (t.replies || []).map((r, i) => {
                    const reply = {
                        number: i + 2,
                        author: r.author || '名無しさん',
                        authorId: this.generateAnonId(),
                        content: r.content,
                        timestamp: now + (i + 1) * 3000
                    };
                    if (r.isOp) reply.isOp = true;
                    return reply;
                }),
                partNum,
                partOf: thread.partOf || thread.id
            };
            if (thread.officialCategory) newThread.officialCategory = thread.officialCategory;

            if (!data.threads) data.threads = [];
            data.threads.unshift(newThread);
            this._newThreadIds.set(newThread.id, Date.now());
            Utils.saveData();
            Utils.showToast(I18n.t('t.forum_next_thread', { n: partNum }));

            // 跳转到新串
            this.currentThreadId = newThread.id;
            this.renderThreadList();
            this.renderThread();
            Navigation.goTo('forum-thread');
        } catch (e) {
            Utils.showToast(I18n.t('t.forum_gen_failed_zh', '生成失败: ') + e.message);
            console.error('[generateNextPart Error]', e);
        } finally {
            if (btn) { btn.textContent = I18n.t('forum.next_part_btn', { n: partNum }); btn.disabled = false; }
        }
    },

    // ===== 用户回复 =====
    userReply() {
        const input = document.getElementById('forumReplyInput');
        const content = input.value.trim();
        if (!content) return;

        const data = AppState.data.forumData;
        const thread = this._findThread();
        if (!thread) return;

        if (!thread.replies) thread.replies = [];
        if (thread.replies.length >= this.THREAD_REPLY_LIMIT) {
            Utils.showToast(I18n.t('t.forum_thread_full', 'このスレは満員です。次スレをお立てください。'));
            return;
        }
        const nextNum = thread.replies.length + 2;
        const userName = data.isAnonymous ? '名無しさん' : (data.userName || '名無しさん');

        thread.replies.push({
            number: nextNum,
            author: userName,
            authorId: this.generateAnonId(),
            content: content,
            timestamp: Date.now(),
            isUser: true
        });

        input.value = '';
        Utils.saveData();
        this.renderThread();
        Utils.scrollToBottom(document.getElementById('forumThreadContent'));
    },

});
