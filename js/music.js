// ═══════════════════════════════════════════════════════════
// Music Lab — v2.62.0 重构（放送局-centric）
// ═══════════════════════════════════════════════════════════
// 数据模型：
//   AppState.data.music = { songs: [...] }
//   song = { id, title, songType, plotId, relatedNpcIds[], userPrompt,
//            lyrics, stylePrompt, audioId,
//            stage: 'lyrics-pending' | 'lyrics-done' | 'style-pending' | 'style-done' | 'audio-pending' | 'done' | 'error',
//            error, savedToForumId, createdAt }
//   音频走 TTSEngine._audioStore (PerigeeAudio localforage)，audioId 前缀 'music:'
// ═══════════════════════════════════════════════════════════

const Music = {
    currentSongId: null,

    // 楽曲タイプ枚举
    // labelKey = UI 显示（跟随系统语言）；label = 固定日文，仅喂 AI 写歌 prompt（不随语言漂移）；
    // styleHint = AI 功能参数（英文 tag，不翻译）
    SONG_TYPES: [
        { value: 'op',           labelKey: 'music.type_op',           label: 'OP（オープニング）',   styleHint: 'Anime OP, Energetic, J-Pop, Female Vocal' },
        { value: 'ed',           labelKey: 'music.type_ed',           label: 'ED（エンディング）',   styleHint: 'Anime ED, Melancholic, Acoustic, J-Pop' },
        { value: 'insert',       labelKey: 'music.type_insert',       label: '挿入歌',                 styleHint: 'Insert Song, Emotional, Cinematic' },
        { value: 'diegetic',     labelKey: 'music.type_diegetic',     label: '劇中歌',                 styleHint: 'Diegetic Song, Live Performance, Vocal-forward' },
        { value: 'character',    labelKey: 'music.type_character',    label: 'キャラクターソング',     styleHint: 'Character Song, J-Pop, Personal' },
        { value: 'image',        labelKey: 'music.type_image',        label: 'イメージソング',         styleHint: 'Image Song, Atmospheric, Ambient' },
        { value: 'instrumental', labelKey: 'music.type_instrumental', label: '純音楽（BGM/サントラ）', styleHint: 'Instrumental, OST, Cinematic', isInstrumental: true },
        { value: 'theme',        labelKey: 'music.type_theme',        label: 'テーマソング',           styleHint: 'Anime Theme, Heroic, Cinematic' },
        { value: 'other',        labelKey: 'music.type_other',        label: 'その他',                 styleHint: '' }
    ],

    // 生成方式：minimax = Perigee 内合成音频；suno = 只出歌词＋Suno 风格标签，用户复制到 Suno 使用。
    // 旧歌没有 engine 字段，一律按 minimax 处理。
    ENGINES: [
        { value: 'suno',    labelKey: 'music.engine_suno' },
        { value: 'minimax', labelKey: 'music.engine_minimax' }
    ],

    _engineOf(song) {
        return song && song.engine === 'suno' ? 'suno' : 'minimax';
    },

    // 写词方针（v2.279.0）：只讲手法、不放任何现成歌词当例子——例子会被模型原样搬进每首歌。
    // common 常驻注入；按 songType 再拼一段类型补充（instrumental / other 只用 common）。
    LYRIC_CRAFT: {
        common: [
            '[作詞の方針 — 物語を説明せず、体験させる]',
            '上の作品資料とタイムラインは「素材」であり、歌詞はその要約ではない。出来事を時系列に並べて歌うこと（あらすじの韻文化）はしない。',
            '1. 一点に絞る：タイムラインから、物語を貫く核の葛藤・関係・決定的な一瞬の感情を一つだけ選び、曲全体でそれを掘り下げる。',
            '2. 固有名詞・設定用語を出さない：キャラクター名、組織名、能力名、事件名、作中用語はそのまま書かない。日常の言葉、自然現象、身体感覚、身の回りの物に置き換え、作品を知る人だけが二重の意味に気づく程度にとどめる。',
            '3. 感情を名指ししない：「悲しい」「運命」「絆」「奇跡」のような抽象語を連呼しない。感情は手触り・温度・光・音・距離といった具体的な感覚や情景に託す。ごく小さな身体感覚と大きな風景を並べ、その落差で感情の大きさを伝えるのも有効。',
            '4. 本音は遅らせる：最初から本音を叫ばない。情景、強がり、建前、他者からの視線などから入り、曲が進むにつれて少しずつ崩し、最も切実な一行は終盤（Bridge や最後の Chorus の前後）まで取っておく。本音を言い切らず余韻で終える曲もあり得るので、作品と曲の性格に合わせて選ぶ。',
            '5. 繰り返しで意味を変える：Chorus のフレーズは繰り返してよいが、Bridge を経た最後の Chorus では、同じ言葉（または一語だけ変えた言葉）が違う重さ・違う意味に聞こえるように組み立てる。',
            '6. 歌われる言葉として書く：Chorus の頭や伸ばす音には、母音が開いて伸びやかに歌える言葉を置く。言葉を詰める部分と、極端に減らして息の余白を残す部分の緩急をつける。英語フレーズは飾りにせず、日本語では言いにくい本音や、主人公の主観と対立する別の声など、役割がある場合だけ使う。',
            '7. この作品だけの比喩を育てる：一曲で使う比喩・モチーフは少数に絞り、曲を通して変化させる。どの作品にも使える決まり文句は避け、この作品の世界と人物の質感から生まれたものにする。',
            '（セクションの対応：Verse＝Aメロ、Pre Chorus＝Bメロ、Chorus＝サビ、Bridge＝Cメロ）'
        ],
        op: [
            '[タイプ別：OP]',
            '- 立ち位置：物語の幕開けに鳴る曲。結末や具体的な展開は明かさず、作品世界のルール、熱量、中心にある問いを打ち出す。',
            '- 手法：主人公を取り巻く世界のノイズや視線、または困難に向かう姿勢から入る。Verse で状況、Pre Chorus で緊張を高め、Chorus で作品を象徴するフックを解き放つ。',
            '- 避けること：各話の出来事を順に歌うこと。OP が歌うのは「何が起きたか」ではなく「何のために生きるのか、戦うのか」。'
        ],
        ed: [
            '[タイプ別：ED]',
            '- 立ち位置：本編が終わった後に流れる曲。方向は二つあり、作品に合う方を選ぶ。(a) 余韻型：時間が過ぎた後や帰り道から、言えなかった言葉や季節の移ろいを静かに振り返る。(b) 表裏型：本編の表舞台の裏で進む執念、代償、逃れられない宿命を描く。',
            '- 手法：1番と2番の間で、時間の経過や関係の変化を描く。最後の一行には、聴き終えた後も残る問いや含みのある言葉を置く。',
            '- 避けること：「いろいろあったけれど大切なことに気づいた」式の総括や教訓。'
        ],
        insert: [
            '[タイプ別：挿入歌]',
            '- 立ち位置：物語のある決定的な場面の最中に、映像と重なって流れる曲。視点はその場面の中にいる人物の内側。',
            '- 手法：前後の経緯は説明しない。その瞬間に見えている景色、肌に触れている感覚、胸の中で起きた衝動だけを拡大して書く。静かな独白のような Verse から、感情が開く Chorus へつなぐ。',
            '- 避けること：画面で起きている動作を実況すること。歌うのは動作ではなく、その瞬間に心の中で鳴っているもの。'
        ],
        diegetic: [
            '[タイプ別：劇中歌]',
            '- 立ち位置：物語の世界に実在する曲。登場人物が自分の作品として、ステージや配信などで実際に歌う。BGM ではなく、作中の観客にも聴こえている歌。',
            '- 手法：歌い手であるその人物が「自分ならどんな歌を書くか」という視点で書く。作風、言葉の癖、聴き手との距離感はその人物のものにする。物語の出来事は、本人が自分の経験を歌に変えた形で入れ、ナレーションのように説明しない。',
            '- 二重の意味：作中の観客が聴き取る表の意味と、本人と物語を知る人だけが気づく裏の意味を重ねる。',
            '- 避けること：物語の出来事をそのまま歌詞に並べること。歌い手本人が人前で歌うには不自然な、内情の暴露や説明的な台詞。'
        ],
        theme: [
            '[タイプ別：テーマソング]',
            '- 立ち位置：物語全体の核心を結晶させる曲。最も深い葛藤を背負う中心人物、または中心となる関係の内側に深く潜る。',
            '- 手法：曲全体を貫く一つの比喩の体系を作り、その変化で人物の軌跡を表す。前半は抑制や偽装や反語、中盤で抑えきれなくなり、終盤ですべてを剥がした祈り・決意・告白へ向かう。',
            '- 避けること：最初から最後まで同じ強さで叫び続けること。抑えがなければ、最後に高まる余地がなくなる。'
        ],
        character: [
            '[タイプ別：キャラクターソング]',
            '- 立ち位置：本筋の騒ぎから一歩離れた場所で、その人物が一人で向き合う素顔。',
            '- 手法：その人物の口調、一人称、二人称を保つ。性格は説明せず、日常の小さな癖、身の回りの物、人や景色への接し方から浮かび上がらせる。人前で見せる顔と、ふと漏れる本音との差を描く。',
            '- 避けること：「私はこういう性格だ」という自己紹介や、設定の読み上げ。'
        ],
        image: [
            '[タイプ別：イメージソング]',
            '- 立ち位置：物語の因果から離れた、作品や人物の心象風景・色彩・空気感のスケッチ。',
            '- 手法：出来事や会話は追わない。色、光、温度、湿度、季節の匂いといった感覚的なイメージを重ねる。反復と余白を活かし、聴き手がその世界の空気を吸い込むような曲にする。',
            '- 避けること：因果関係のはっきりした具体的な出来事を入れること。'
        ]
    },

    // 卡片渐变色池（Spotify 风格）
    _gradients: [
        'linear-gradient(135deg, #1DB954, #191414)',
        'linear-gradient(135deg, #e0245e, #1a1a2e)',
        'linear-gradient(135deg, #6366f1, #0f172a)',
        'linear-gradient(135deg, #f59e0b, #451a03)',
        'linear-gradient(135deg, #06b6d4, #164e63)',
        'linear-gradient(135deg, #ec4899, #831843)',
        'linear-gradient(135deg, #8b5cf6, #1e1b4b)',
        'linear-gradient(135deg, #14b8a6, #134e4a)',
    ],

    init() {
        // 一次性砍旧数据（v2.62.0 重构：lyricProjects 不再使用）
        if (AppState.data.lyricProjects !== undefined) {
            delete AppState.data.lyricProjects;
            Utils.saveData();
        }
        if (!AppState.data.music) AppState.data.music = { songs: [] };
        if (!Array.isArray(AppState.data.music.songs)) AppState.data.music.songs = [];
        this.renderSongList();
    },

    _escHtml(s) {
        return Utils.escapeHtml(s); // 收口：转发权威实现（语义与原实现完全相同）
    },

    _getSongTypeLabel(value) {
        // UI 显示走 labelKey（跟随系统语言）；AI prompt 另用固定日文 label，互不影响
        const t = this.SONG_TYPES.find(t => t.value === value);
        return t ? I18n.t(t.labelKey, t.label) : (value || '');
    },

    _getStageBadge(stage) {
        const m = {
            'lyrics-pending': { key: 'music.stage_lyrics_pending', color: '#6366f1' },
            'lyrics-done':    { key: 'music.stage_lyrics_done',    color: '#0ea5e9' },
            'style-pending':  { key: 'music.stage_style_pending',  color: '#6366f1' },
            'style-done':     { key: 'music.stage_style_done',     color: '#0ea5e9' },
            'audio-pending':  { key: 'music.stage_audio_pending',  color: '#f59e0b' },
            'done':           { key: 'music.stage_done',           color: '#10b981' },
            'error':          { key: 'music.stage_error',          color: '#ef4444' }
        };
        const e = m[stage];
        return e ? { text: I18n.t(e.key), color: e.color } : { text: stage, color: '#666' };
    },

    // ─── 列表视图 ────────────────────────────────────────────
    renderSongList() {
        const container = document.getElementById('lyricContent');
        if (!container) return;
        const songs = AppState.data.music.songs || [];

        if (songs.length === 0) {
            container.innerHTML = `
                <div class="sp-empty" style="padding: 60px 20px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 16px;">♪</div>
                    <div style="font-size: 16px; color: #b3b3b3;">${I18n.t('music.empty_title')}</div>
                    <div style="font-size: 13px; color: #666; margin-top: 6px;">${I18n.t('music.empty_hint')}</div>
                </div>
            `;
            return;
        }

        // 时间倒序
        const sorted = [...songs].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        container.innerHTML = `
            <div style="padding: 16px;">
                <div class="sp-section-title" style="font-size: 14px; color: var(--text-secondary); margin-bottom: 12px;">${I18n.t('music.library')}</div>
                <div class="sp-playlist-grid">
                    ${sorted.map((song, i) => {
                        const grad = this._gradients[i % this._gradients.length];
                        const typeLabel = this._getSongTypeLabel(song.songType);
                        const badge = this._getStageBadge(song.stage);
                        const initial = (song.title || '?').slice(0, 2);
                        return `
                            <div class="sp-playlist-card" onclick="Music.openSong('${song.id}')" style="cursor: pointer;">
                                <div class="sp-playlist-cover" style="background: ${grad};">
                                    <span class="sp-cover-text">${this._escHtml(initial)}</span>
                                </div>
                                <div class="sp-playlist-name" style="font-size: 14px; font-weight: 600;">${this._escHtml(song.title || I18n.t('music.untitled'))}</div>
                                <div class="sp-playlist-meta" style="font-size: 11px; color: var(--text-secondary); opacity: 0.8;">${this._escHtml(typeLabel)}</div>
                                <div style="font-size: 10px; color: ${badge.color}; margin-top: 4px;">● ${badge.text}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    // ─── 创建弹窗 ────────────────────────────────────────────
    openCreateModal() {
        // 标题
        document.getElementById('musicTitle').value = '';
        // songType
        const typeSel = document.getElementById('musicSongType');
        typeSel.innerHTML = this.SONG_TYPES.map(t =>
            `<option value="${t.value}">${this._escHtml(this._getSongTypeLabel(t.value))}</option>`
        ).join('');
        // plotId
        const plotSel = document.getElementById('musicPlotId');
        const plots = AppState.data.broadcast?.plotProgress || [];
        plotSel.innerHTML = `<option value="">${this._escHtml(I18n.t('music.plot_none'))}</option>` + plots.map(p =>
            `<option value="${p.id}">${this._escHtml(p.title || I18n.t('music.untitled'))}</option>`
        ).join('');
        // 生成方式（记住上次的选择）
        const engineSel = document.getElementById('musicEngine');
        const lastEngine = AppState.data.music.lastEngine === 'minimax' ? 'minimax' : 'suno';
        engineSel.innerHTML = this.ENGINES.map(e =>
            `<option value="${e.value}"${e.value === lastEngine ? ' selected' : ''}>${this._escHtml(I18n.t(e.labelKey))}</option>`
        ).join('');
        engineSel.value = lastEngine;
        engineSel.onchange = () => this._updateEngineNote();
        this._updateEngineNote();
        // userPrompt
        document.getElementById('musicUserPrompt').value = '';
        document.getElementById('musicCreateModal').classList.add('active');
    },

    _updateEngineNote() {
        const sel = document.getElementById('musicEngine');
        const note = document.getElementById('musicGenStepsNote');
        if (!sel || !note) return;
        note.textContent = I18n.t(sel.value === 'suno' ? 'music.gen_steps_note_suno' : 'music.gen_steps_note');
    },

    closeCreateModal() {
        document.getElementById('musicCreateModal').classList.remove('active');
    },

    submitCreate() {
        const title = document.getElementById('musicTitle').value.trim();
        const songType = document.getElementById('musicSongType').value;
        const plotId = document.getElementById('musicPlotId').value || null;
        const userPrompt = document.getElementById('musicUserPrompt').value.trim();
        const engine = document.getElementById('musicEngine').value === 'minimax' ? 'minimax' : 'suno';
        AppState.data.music.lastEngine = engine;

        const song = {
            id: Utils.generateId(),
            title, // 空字符串表示等 LLM 自动命名
            songType,
            engine,
            plotId,
            userPrompt,
            lyrics: '',
            stylePrompt: '',
            audioId: null,
            stage: 'lyrics-pending',
            error: null,
            savedToForumId: null,
            createdAt: Date.now()
        };
        AppState.data.music.songs.push(song);
        Utils.saveData();
        this.closeCreateModal();
        this.renderSongList();
        // 启动 pipeline（异步，不 await — UI 立即返回列表）
        // 非纯音乐：歌词写完后停下来等用户确认；纯音乐没有歌词内容，直接连跑
        const typeMeta = this.SONG_TYPES.find(t => t.value === songType) || {};
        const stopAfter = typeMeta.isInstrumental ? null : 'lyrics';
        this._runPipeline(song.id, { stopAfter });
    },

    // ─── Pipeline ────────────────────────────────────────────
    async _runPipeline(songId, opts = {}) {
        const fromStage = opts.fromStage || 'lyrics';
        const song = AppState.data.music.songs.find(s => s.id === songId);
        // Suno 模式到曲风为止（音频在 Suno 那边做）
        const stopAfter = this._engineOf(song) === 'suno' && !opts.stopAfter ? 'style' : opts.stopAfter; // 'lyrics' | 'style' | null/undefined（跑到底）
        try {
            if (fromStage === 'lyrics') {
                await this._generateLyrics(songId);
                if (stopAfter === 'lyrics') return;
                await this._generateStylePrompt(songId);
                if (stopAfter === 'style') return;
                await this._generateAudio(songId);
            } else if (fromStage === 'style') {
                await this._generateStylePrompt(songId);
                if (stopAfter === 'style') return;
                await this._generateAudio(songId);
            } else if (fromStage === 'audio') {
                if (this._engineOf(song) === 'suno') return;
                await this._generateAudio(songId);
            }
        } catch (e) {
            console.error('[Music pipeline]', e);
            this._setStage(songId, 'error', { error: e.message || String(e) });
            Utils.showToast(I18n.t('t.music_gen_failed', '生成失败：') + (e.message || e));
        }
    },

    _setStage(songId, stage, patch = {}) {
        const song = AppState.data.music.songs.find(s => s.id === songId);
        if (!song) return null;
        song.stage = stage;
        Object.assign(song, patch);
        Utils.saveData();
        // 列表 + 详情页同时刷新（如果在显示）
        this.renderSongList();
        if (this.currentSongId === songId) this._renderSongDetail(songId);
        return song;
    },

    // ─── Sprint 2: LLM 写歌词 ─────────────────────────────────
    async _generateLyrics(songId) {
        const song = AppState.data.music.songs.find(s => s.id === songId);
        if (!song) throw new Error('song not found');
        this._setStage(songId, 'lyrics-pending');

        const broadcast = AppState.data.broadcast || {};
        const plot = song.plotId ? (broadcast.plotProgress || []).find(p => p.id === song.plotId) : null;
        const wbIds = broadcast.worldBookIds && broadcast.worldBookIds.length
            ? broadcast.worldBookIds
            : (broadcast.worldBookId ? [broadcast.worldBookId] : []);
        const wbContext = this._buildWorldBookContext(wbIds);
        const typeMeta = this.SONG_TYPES.find(t => t.value === song.songType) || {};
        const isInstrumental = typeMeta.isInstrumental;
        const titleEmpty = !song.title;

        if (isInstrumental) {
            // 纯音乐走 MiniMax is_instrumental，不需要歌词内容
            const lyrics = '[Instrumental]';
            const patch = { lyrics };
            if (titleEmpty) patch.title = song.userPrompt ? song.userPrompt.slice(0, 30) : (typeMeta.label || I18n.t('music.untitled'));
            this._setStage(songId, 'lyrics-done', patch);
            return;
        }

        const sysParts = [
            'You are a professional lyricist for anime/light novel original soundtrack songs.',
            'Output complete song lyrics with section labels — supported tags include:',
            '[Intro] [Verse] [Pre Chorus] [Chorus] [Bridge] [Outro] [Hook] [Interlude] [Build Up]',
            '(use brackets exactly as written, e.g. "[Pre Chorus]" with a space, not a hyphen)',
            'Each section followed by the actual lines (no extra explanation).',
            'Length target: 250-700 Japanese characters total. Hard cap 3000 characters.',
            '',
            'CRITICAL — MiniMax 音乐合成引擎限制：',
            '- 漢字に「（かな）」のような注音括弧を絶対つけないこと。合成エンジンは漢字と仮名の両方を読み上げてしまう。',
            '  例：×「宇宙（そら）」 ○「そら」（最初からひらがなで書く）',
            '- 当て字読みをさせたい場合：歌詞内では仮名で表記し、漢字を併記しない。',
            '- 同様に、ルビ・括弧注釈・原語併記（English (英语) など）も禁止。',
            ''
        ];

        if (titleEmpty) {
            sysParts.push('IMPORTANT — Output two parts in this exact format:');
            sysParts.push('Line 1: `TITLE: <自然な日本語の楽曲タイトル>`');
            sysParts.push('Line 2 onward: the lyrics with section tags.');
            sysParts.push('Pick a title that fits the song mood and content. Do NOT use placeholders.');
            sysParts.push('');
        }

        sysParts.push('[Work Context]');
        if (broadcast.worldSetting) sysParts.push(`World Setting: ${broadcast.worldSetting}`);
        if (wbContext) sysParts.push(wbContext);

        // 永远注入完整剧情时间线 — 让 AI 能综合整个 arc 写歌
        // （角色歌 / ED / 完结纪念曲不应只围绕单集；选了 plot 也只是"发售锚点"，不是"内容素材"）
        const timelineContext = this._buildStoryTimelineContext();
        if (timelineContext) sysParts.push(timelineContext);

        if (plot) {
            sysParts.push('');
            sysParts.push(`[Anchor Episode] This song emotionally anchors to: 「${plot.title || ''}」 — one episode within the timeline above.`);
            sysParts.push('The anchor episode marks WHERE the song belongs in the arc, NOT its content scope.');
            sysParts.push('For character songs, ED themes, image songs, or finale tributes: draw from the WHOLE arc and overall character impressions across all episodes — do NOT restrict yourself to the anchored episode.');
        } else {
            sysParts.push('');
            sysParts.push('[Compositional Note] No specific episode anchor. Compose drawing from the entire arc — character impressions and overall story progression integrated across all episodes.');
        }
        sysParts.push('');
        sysParts.push('[Song Specs]');
        if (!titleEmpty) sysParts.push(`Title: ${song.title}`);
        sysParts.push(`Type: ${typeMeta.label || song.songType}`);
        sysParts.push(`Default Style Hint (for tone reference, not output): ${typeMeta.styleHint || ''}`);
        sysParts.push('');
        sysParts.push(...this.LYRIC_CRAFT.common);
        const typeCraft = this.LYRIC_CRAFT[song.songType];
        if (typeCraft) {
            sysParts.push('');
            sysParts.push(...typeCraft);
        }
        if (song.userPrompt) {
            sysParts.push('');
            sysParts.push('[User Direction] (takes priority over the guidance above when they conflict)');
            sysParts.push(song.userPrompt);
        }
        sysParts.push('');
        sysParts.push('Write lyrics in Japanese (Chinese parenthetical hooks OK if natural). Section labels stay in English brackets. Output ONLY the requested format — no preface, no commentary.');

        const systemPrompt = sysParts.join('\n');
        const userMsg = titleEmpty
            ? `この楽曲タイプ（${typeMeta.label || song.songType}）にふさわしいタイトルと歌詞を書いてください。`
            : `タイトル「${song.title}」の歌詞を書いてください。`;
        const raw = (await Utils.callChatAPI([{ role: 'user', content: userMsg }], systemPrompt)).trim();
        if (!raw) throw new Error('歌词生成结果为空');

        // 解析 TITLE 行（仅当 title 为空时）
        const patch = {};
        let lyrics = raw;
        if (titleEmpty) {
            const m = raw.match(/^[\s*#]*TITLE\s*[:：]\s*(.+?)\s*$/im);
            if (m) {
                patch.title = m[1].replace(/^["'`「『]+|["'`」』]+$/g, '').trim().slice(0, 60);
                lyrics = raw.replace(/^[\s*#]*TITLE\s*[:：].+\n?/im, '').trim();
            } else {
                // LLM 没遵守格式：用 userPrompt 截断 / 类型 fallback
                patch.title = song.userPrompt ? song.userPrompt.slice(0, 30) : (typeMeta.label || I18n.t('music.untitled'));
            }
        }
        patch.lyrics = lyrics;
        patch.lyricsTranslation = '';
        this._setStage(songId, 'lyrics-done', patch);
    },

    _buildWorldBookContext(wbIds) {
        if (!wbIds || wbIds.length === 0) return '';
        const books = AppState.data.worldBooks || [];
        const lines = [];
        for (const id of wbIds) {
            const book = books.find(b => b.id === id);
            if (!book) continue;
            const entries = (book.entries || []).filter(e => e.enabled !== false).slice(0, 6);
            if (entries.length === 0) continue;
            lines.push(`[World Book — ${book.name}]`);
            entries.forEach(e => lines.push(`${e.title}: ${(e.content || '').slice(0, 300)}`));
        }
        return lines.join('\n');
    },

    // 完整剧情时间线 — 给 AI 看整个 arc 的素材池
    // 优先用 mergedSummaries / plotSummaries（已 LLM 压缩的旧剧情）+ 未被覆盖的 plotProgress 完整内容
    _buildStoryTimelineContext() {
        const broadcast = AppState.data.broadcast || {};
        const plots = broadcast.plotProgress || [];
        const mergedSums = broadcast.mergedSummaries || [];
        const plotSums = broadcast.plotSummaries || [];

        if (plots.length === 0 && mergedSums.length === 0 && plotSums.length === 0) return '';

        // 收集已被合并总结覆盖的 plot ID（避免与原文重复注入）
        const coveredPlotIds = new Set([
            ...mergedSums.flatMap(s => s.coveredPlotIds || []),
            ...plotSums.flatMap(s => s.coveredIds || [])
        ]);

        const lines = ['[Story Timeline — entire arc, all material available for the song]'];

        // 1. 旧剧情合并总结（按时间序）
        mergedSums.forEach(s => {
            if (s?.summary) {
                const titles = (s.titleIndex || []).slice(0, 5).join('、');
                lines.push(`[Earlier arc${titles ? ` — ${titles}` : ''}] ${String(s.summary).slice(0, 600)}`);
            }
        });
        // 2. 单条 plot 总结（不与 mergedSummaries 重复）
        const mergedCoveredPlotIds = new Set(mergedSums.flatMap(s => s.coveredPlotIds || []));
        plotSums.forEach(s => {
            if (!s?.summary) return;
            const ids = s.coveredIds || [];
            if (ids.some(id => mergedCoveredPlotIds.has(id))) return;
            lines.push(`[Plot summary] ${String(s.summary).slice(0, 400)}`);
        });
        // 3. 未被任何总结覆盖的 plot — 完整保留（截断到 500 字符）
        plots.forEach((p, i) => {
            if (coveredPlotIds.has(p.id)) return;
            const idx = i + 1;
            const title = p.title || '無題';
            const content = (p.content || '').slice(0, 500);
            lines.push(`[ep${idx}] ${title}${content ? ' — ' + content : ''}`);
        });

        return lines.join('\n');
    },

    // ─── Sprint 3: LLM 写 style prompt ───────────────────────
    async _generateStylePrompt(songId) {
        const song = AppState.data.music.songs.find(s => s.id === songId);
        if (!song) throw new Error('song not found');
        this._setStage(songId, 'style-pending');

        const typeMeta = this.SONG_TYPES.find(t => t.value === song.songType) || {};
        const broadcast = AppState.data.broadcast || {};
        const plot = song.plotId ? (broadcast.plotProgress || []).find(p => p.id === song.plotId) : null;

        const isSuno = this._engineOf(song) === 'suno';
        const systemPrompt = isSuno ? this._sunoStyleSystemPrompt() : `You are a music director who picks musical style tags for songs.
Your output is consumed by the MiniMax music_generation API as the "prompt" parameter.

OUTPUT FORMAT — strict:
- A single line of comma-separated English tags
- 5 to 10 tags total
- Order from broadest to most specific: genre, sub-genre, mood/era, instrumentation, vocal, tempo
- NO sentences, NO explanation, NO line breaks. ONLY the comma-separated tags.

EXAMPLES:
"Anime ED, J-Pop, Acoustic, Melancholic, Female Vocal, Mid-tempo, Piano-led"
"Anime OP, J-Rock, Energetic, Heroic, Male Vocal, Up-tempo, Electric Guitar, Drums"
"Character Song, City-pop, Nostalgic, Female Vocal, Saxophone, Mid-tempo"
"Instrumental OST, Orchestral, Cinematic, Tense, Strings, Brass, Slow"

Now produce tags based on the inputs below. Do NOT echo the inputs.`;

        const userParts = [
            `Song type: ${typeMeta.label || song.songType}`,
            `Default hint: ${typeMeta.styleHint || ''}`,
            `Title: ${song.title}`
        ];
        if (plot) userParts.push(`Linked plot tone: ${(plot.title || '')} — ${(plot.content || '').slice(0, 300)}`);
        if (song.userPrompt) userParts.push(`User direction: ${song.userPrompt}`);
        if (song.lyrics) userParts.push(`Lyrics excerpt:\n${song.lyrics.slice(0, 400)}`);

        const messages = [{ role: 'user', content: userParts.join('\n') }];
        let stylePrompt = (await Utils.callChatAPI(messages, systemPrompt)).trim();
        // 防御：如果模型不听话输出多行/句子，截断到第一行 + 去掉句号/引号
        stylePrompt = stylePrompt.split('\n')[0].replace(/^["'`「『]+|["'`」』]+$/g, '').trim();
        if (!stylePrompt) throw new Error('style prompt 生成结果为空');

        this._setStage(songId, 'style-done', { stylePrompt });
    },

    _sunoStyleSystemPrompt() {
        return `You are a sound designer writing the "Style of Music" field for Suno.

OUTPUT FORMAT — strict:
- A single line of comma-separated English descriptors, roughly 120-250 characters
- NO sentences, NO explanation, NO line breaks, NO artist or band names
- The examples below only show the level of detail; choose what fits THIS song

MUST COVER, in this order:
1. Main genre and fusion (e.g. "J-Pop, Electro-Swing fusion", "Symphonic Rock")
2. Vocal texture (e.g. "Breathy female vocals", "Raspy male vocals", "Airy falsetto")
3. Specific instruments (e.g. "Slap bass", "Glassy Rhodes", "Distorted 808", "Violin solo")
4. Atmosphere / foley (e.g. "Vinyl crackle", "Lo-fi tape hiss", "Distant crowd ambience")
5. Intro description (e.g. "Slow melodic piano intro", "Heavy drum fill intro")

Now produce the style line based on the inputs below. Do NOT echo the inputs.`;
    },

    // 歌词翻译：点了才生成，存在 song.lyricsTranslation；日文界面不提供
    _translationTarget() {
        const lang = (typeof I18n !== 'undefined' && I18n.currentLang) || 'zh';
        if (lang === 'ja') return null;
        return lang === 'en' ? 'English' : 'Simplified Chinese';
    },

    async translateLyrics(songId) {
        const song = AppState.data.music.songs.find(s => s.id === songId);
        const target = this._translationTarget();
        if (!song || !song.lyrics || !target) return;
        await Utils.withLock(`music-tl:${songId}`, async () => {
            if (this.currentSongId === songId) this._renderSongDetail(songId); // 按钮进入「翻译中」
            try {
                const systemPrompt = [
                    `Translate the Japanese song lyrics below into ${target}.`,
                    '- Keep every section tag such as [Verse] or [Chorus] unchanged on its own line.',
                    '- Keep the line breaks one-to-one with the original: one translated line per original line.',
                    '- Translate the meaning naturally as lyrics; keep English lines as they are.',
                    '- Output ONLY the translation, no preface, no notes.'
                ].join('\n');
                const tl = (await Utils.callChatAPI([{ role: 'user', content: song.lyrics }], systemPrompt)).trim();
                if (!tl) throw new Error('empty');
                song.lyricsTranslation = tl;
                this._tlOpenId = songId;
                Utils.saveData();
            } catch (e) {
                console.warn('[Music] translate failed', e);
                Utils.showToast(I18n.t('music.tl_failed'));
            }
        });
        if (this.currentSongId === songId) this._renderSongDetail(songId);
    },

    async copyForSuno(songId, field) {
        const song = AppState.data.music.songs.find(s => s.id === songId);
        if (!song) return;
        const text = field === 'style' ? song.stylePrompt : song.lyrics;
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            Utils.showToast(I18n.t('music.copied'));
        } catch (e) {
            Utils.showToast(I18n.t('music.copy_failed'));
        }
    },

    // ─── Sprint 4: MiniMax 音频生成 ──────────────────────────
    async _generateAudio(songId) {
        const song = AppState.data.music.songs.find(s => s.id === songId);
        if (!song) throw new Error('song not found');
        this._setStage(songId, 'audio-pending');

        const tts = AppState.data.ttsConfig || {};
        if (tts.provider !== 'minimax') {
            throw new Error(I18n.t('music.err_minimax_provider'));
        }
        if (!tts.apiKey) throw new Error('MiniMax API Key 未配置');
        const base = (typeof TTSSettings !== 'undefined')
            ? TTSSettings.getMinimaxBase(tts.minimaxRegion, tts.minimaxCustomBase)
            : 'https://api.minimaxi.com';

        const typeMeta = this.SONG_TYPES.find(t => t.value === song.songType) || {};
        const isInstrumental = !!typeMeta.isInstrumental;

        const body = {
            model: 'music-2.6',
            prompt: song.stylePrompt || typeMeta.styleHint || 'Anime, Cinematic',
            audio_setting: { sample_rate: 44100, bitrate: 256000, format: 'mp3' },
            output_format: 'hex'
        };
        if (isInstrumental) {
            body.is_instrumental = true;
        } else {
            // MiniMax music-2.6 lyrics 长度限制 [1, 3500]
            let lyrics = song.lyrics || '';
            if (!lyrics.trim()) throw new Error('歌词内容为空');
            if (lyrics.length > 3500) lyrics = lyrics.slice(0, 3500);
            body.lyrics = lyrics;
        }

        // 5 分钟 timeout
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5 * 60 * 1000);
        let res;
        try {
            res = await fetch(`${base}/v1/music_generation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tts.apiKey}`
                },
                body: JSON.stringify(body),
                signal: ctrl.signal
            });
        } catch (e) {
            if (e.name === 'AbortError') throw new Error(I18n.t('music.err_synth_timeout'));
            throw e;
        } finally {
            clearTimeout(timer);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const data = await res.json();
        if (data.base_resp && data.base_resp.status_code !== 0) {
            throw new Error(data.base_resp.status_msg || 'MiniMax 楽曲合成失败');
        }
        // 严格按 API schema：data.data.{audio, status}，status === 2 表示已完成（1=合成中）
        const musicData = data.data || {};
        if (musicData.status !== undefined && musicData.status !== 2) {
            throw new Error(`音乐合成未完成（status=${musicData.status}），请稍后从「楽曲のみ再生成」重试`);
        }
        const hex = musicData.audio;
        if (!hex || typeof hex !== 'string') throw new Error('音频数据为空（响应结构异常）');

        // hex → Uint8Array → Blob
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        const blob = new Blob([bytes], { type: 'audio/mp3' });

        // 落到 PerigeeAudio store（复用 TTSEngine）
        const audioId = `music:${song.id}`;
        if (typeof TTSEngine === 'undefined') throw new Error('TTSEngine 未加载');
        await TTSEngine.storeAudio(audioId, blob);

        this._setStage(songId, 'done', { audioId });
        Utils.showToast(I18n.t('t.music_generated', {title: song.title}));
    },

    // ─── 详情视图 ────────────────────────────────────────────
    openSong(songId) {
        this.currentSongId = songId;
        this._renderSongDetail(songId);
    },

    backToList() {
        this.currentSongId = null;
        this.renderSongList();
    },

    _renderSongDetail(songId) {
        const song = AppState.data.music.songs.find(s => s.id === songId);
        const container = document.getElementById('lyricContent');
        if (!song || !container) return;
        const typeLabel = this._getSongTypeLabel(song.songType);
        const badge = this._getStageBadge(song.stage);
        const broadcast = AppState.data.broadcast || {};
        const plot = song.plotId ? (broadcast.plotProgress || []).find(p => p.id === song.plotId) : null;
        const hasAudio = !!song.audioId && song.stage === 'done';
        // 阶段判定：歌词写完等用户确认（无 audioId）/ 已成品（done/error）/ 跑步中
        const isLyricsConfirmStage = song.stage === 'lyrics-done' && !song.audioId;
        const isSuno = this._engineOf(song) === 'suno';
        const isFinalStage = isSuno ? ['style-done', 'error'].includes(song.stage) : ['done', 'error'].includes(song.stage);
        const isInstrumental = !!(this.SONG_TYPES.find(t => t.value === song.songType) || {}).isInstrumental;
        const badgeText = isSuno && song.stage === 'style-done' ? I18n.t('music.stage_suno_ready') : badge.text;
        const tlTarget = this._translationTarget();
        const tlBusy = Utils.isLocked(`music-tl:${song.id}`);
        const tlOpen = this._tlOpenId === song.id;
        this._tlOpenId = null;

        container.innerHTML = `
            <div style="padding: 16px; max-width: 720px; margin: 0 auto;">
                <button onclick="Music.backToList()" class="glass-btn" style="margin-bottom: 14px; font-size: 13px;">‹ ${I18n.t('music.back')}</button>

                <div style="margin-bottom: 18px;">
                    <h2 style="margin: 0 0 6px 0; font-size: 22px;">${this._escHtml(song.title)}</h2>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 6px;">${this._escHtml(typeLabel)}${plot ? ' ・ ' + this._escHtml(plot.title || '') : ''}</div>
                    <div style="display: inline-block; font-size: 12px; padding: 3px 10px; border-radius: 12px; background: ${badge.color}1a; color: ${badge.color}; font-weight: 600;">${badgeText}</div>
                    ${song.error ? `<div style="margin-top: 8px; font-size: 12px; color: #ef4444;">${I18n.t('music.error_detail')}：${this._escHtml(song.error)}</div>` : ''}
                </div>

                ${hasAudio ? `
                    <div style="margin-bottom: 18px; padding: 14px; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-light);">
                        <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">${I18n.t('music.section_audio')}</div>
                        <audio id="musicAudioEl-${song.id}" controls style="width: 100%;" preload="none"></audio>
                    </div>
                ` : ''}

                ${song.stylePrompt ? `
                    <div style="margin-bottom: 16px;">
                        <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">${I18n.t('music.section_style')}</div>
                        <div style="padding: 10px 12px; background: var(--bg-card); border-radius: 8px; font-size: 13px; font-family: ui-monospace, monospace; line-height: 1.5;">${this._escHtml(song.stylePrompt)}</div>
                    </div>
                ` : ''}

                ${isSuno && isFinalStage && song.stylePrompt ? `
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;">
                        <button onclick="Music.copyForSuno('${song.id}', 'style')" class="glass-btn primary" style="font-size: 13px;">${I18n.t('music.btn_copy_style')}</button>
                        ${!isInstrumental && song.lyrics ? `<button onclick="Music.copyForSuno('${song.id}', 'lyrics')" class="glass-btn primary" style="font-size: 13px;">${I18n.t('music.btn_copy_lyrics')}</button>` : ''}
                    </div>
                ` : ''}

                ${song.lyrics ? `
                    <div style="margin-bottom: 16px;">
                        <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">${I18n.t('music.section_lyrics')}</div>
                        <pre style="white-space: pre-wrap; padding: 14px; background: var(--bg-card); border-radius: 10px; font-size: 13px; line-height: 1.7; font-family: inherit; margin: 0;">${this._escHtml(song.lyrics)}</pre>
                        ${!isInstrumental && tlTarget ? (song.lyricsTranslation ? `
                            <details${tlOpen ? ' open' : ''} style="margin-top: 8px;">
                                <summary style="font-size: 12px; color: var(--text-secondary); cursor: pointer;">${I18n.t('music.tl_show')}</summary>
                                <pre style="white-space: pre-wrap; padding: 14px; margin: 6px 0 0 0; background: var(--bg-card); border-radius: 10px; font-size: 13px; line-height: 1.7; font-family: inherit; color: var(--text-secondary);">${this._escHtml(song.lyricsTranslation)}</pre>
                            </details>
                        ` : `
                            <button onclick="Music.translateLyrics('${song.id}')" class="glass-btn" style="font-size: 12px; margin-top: 8px;"${tlBusy ? ' disabled' : ''}>${I18n.t(tlBusy ? 'music.tl_loading' : 'music.tl_show')}</button>
                        `) : ''}
                    </div>
                ` : ''}

                ${song.userPrompt ? `
                    <div style="margin-bottom: 16px; font-size: 12px; color: var(--text-secondary); opacity: 0.8;">
                        ${I18n.t('music.label_user_direction')}：${this._escHtml(song.userPrompt)}
                    </div>
                ` : ''}

                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 18px;">
                    ${isLyricsConfirmStage ? `
                        <button onclick="Music.confirmGenerate('${song.id}')" class="glass-btn primary" style="font-size: 13px;">${I18n.t(isSuno ? 'music.btn_confirm_gen_suno' : 'music.btn_confirm_gen')}</button>
                        <button onclick="Music.regenerateLyricsOnly('${song.id}')" class="glass-btn" style="font-size: 12px;">${I18n.t('music.btn_rewrite_lyrics')}</button>
                    ` : ''}
                    ${isFinalStage ? `
                        <button onclick="Music.regenerate('${song.id}', 'lyrics')" class="glass-btn" style="font-size: 12px;">${I18n.t('music.btn_regen_lyrics')}</button>
                        <button onclick="Music.regenerate('${song.id}', 'style')"  class="glass-btn" style="font-size: 12px;">${I18n.t(isSuno ? 'music.btn_regen_style_suno' : 'music.btn_regen_style')}</button>
                        ${isSuno ? '' : `<button onclick="Music.regenerate('${song.id}', 'audio')"  class="glass-btn" style="font-size: 12px;">${I18n.t('music.btn_regen_audio')}</button>`}
                    ` : ''}
                    <button onclick="Music.deleteSong('${song.id}')" class="glass-btn" style="font-size: 12px; color: #ef4444; border-color: #ef4444;">${I18n.t('music.btn_delete')}</button>
                </div>
            </div>
        `;

        if (hasAudio) this._attachAudio(song);
    },

    async _attachAudio(song) {
        if (typeof TTSEngine === 'undefined') return;
        try {
            const blob = await TTSEngine.getAudio(song.audioId);
            if (!blob) return;
            const el = document.getElementById(`musicAudioEl-${song.id}`);
            if (!el) return;
            const url = URL.createObjectURL(blob);
            el.src = url;
            // 加入全局音频协调（与 widget / 放送局 / TTS / LINE voice 互斥）
            if (window.AudioCoordinator) AudioCoordinator.register(el);
            // 释放策略：组件卸载时浏览器自动 GC，blob URL 不主动 revoke 以便重复播放
        } catch (e) {
            console.warn('[Music] attach audio failed', e);
        }
    },

    regenerate(songId, fromStage) {
        const song = AppState.data.music.songs.find(s => s.id === songId);
        if (!song) return;
        const confirmKey = fromStage === 'lyrics' ? 'music.confirm_regen_lyrics'
            : fromStage === 'style' ? 'music.confirm_regen_style'
            : 'music.confirm_regen_audio';
        if (!confirm(I18n.t(confirmKey, { title: song.title }))) return;
        this._runPipeline(songId, { fromStage });
    },

    // 首次确认歌词后启动 style+audio（无需 confirm 弹窗，按钮本身就是确认）
    confirmGenerate(songId) {
        this._runPipeline(songId, { fromStage: 'style' });
    },

    // 歌词阶段不满意，重写歌词、停在 lyrics-done 等下一次确认
    regenerateLyricsOnly(songId) {
        this._runPipeline(songId, { fromStage: 'lyrics', stopAfter: 'lyrics' });
    },

    async deleteSong(songId) {
        const song = AppState.data.music.songs.find(s => s.id === songId);
        if (!song) return;
        if (!confirm(I18n.t('music.confirm_delete', { title: song.title }))) return;
        // 删音频 blob
        if (song.audioId && typeof TTSEngine !== 'undefined') {
            try { await TTSEngine.removeAudio(song.audioId); } catch (e) { console.warn('[Music] remove audio failed', e); }
        }
        AppState.data.music.songs = AppState.data.music.songs.filter(s => s.id !== songId);
        Utils.saveData();
        this.backToList();
        Utils.showToast(I18n.t('t.music_deleted', '削除しました'));
    }
};
