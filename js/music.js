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
        { value: 'character',    labelKey: 'music.type_character',    label: 'キャラクターソング',     styleHint: 'Character Song, J-Pop, Personal' },
        { value: 'image',        labelKey: 'music.type_image',        label: 'イメージソング',         styleHint: 'Image Song, Atmospheric, Ambient' },
        { value: 'instrumental', labelKey: 'music.type_instrumental', label: '純音楽（BGM/サントラ）', styleHint: 'Instrumental, OST, Cinematic', isInstrumental: true },
        { value: 'theme',        labelKey: 'music.type_theme',        label: 'テーマソング',           styleHint: 'Anime Theme, Heroic, Cinematic' },
        { value: 'other',        labelKey: 'music.type_other',        label: 'その他',                 styleHint: '' }
    ],

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
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
        // userPrompt
        document.getElementById('musicUserPrompt').value = '';
        document.getElementById('musicCreateModal').classList.add('active');
    },

    closeCreateModal() {
        document.getElementById('musicCreateModal').classList.remove('active');
    },

    submitCreate() {
        const title = document.getElementById('musicTitle').value.trim();
        const songType = document.getElementById('musicSongType').value;
        const plotId = document.getElementById('musicPlotId').value || null;
        const userPrompt = document.getElementById('musicUserPrompt').value.trim();

        const song = {
            id: Utils.generateId(),
            title, // 空字符串表示等 LLM 自动命名
            songType,
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
        const stopAfter = opts.stopAfter; // 'lyrics' | 'style' | null/undefined（跑到底）
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
        if (song.userPrompt) {
            sysParts.push('');
            sysParts.push('[User Direction]');
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

        const systemPrompt = `You are a music director who picks musical style tags for songs.
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
        const isFinalStage = ['done', 'error'].includes(song.stage);

        container.innerHTML = `
            <div style="padding: 16px; max-width: 720px; margin: 0 auto;">
                <button onclick="Music.backToList()" class="glass-btn" style="margin-bottom: 14px; font-size: 13px;">‹ ${I18n.t('music.back')}</button>

                <div style="margin-bottom: 18px;">
                    <h2 style="margin: 0 0 6px 0; font-size: 22px;">${this._escHtml(song.title)}</h2>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 6px;">${this._escHtml(typeLabel)}${plot ? ' ・ ' + this._escHtml(plot.title || '') : ''}</div>
                    <div style="display: inline-block; font-size: 12px; padding: 3px 10px; border-radius: 12px; background: ${badge.color}1a; color: ${badge.color}; font-weight: 600;">${badge.text}</div>
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

                ${song.lyrics ? `
                    <div style="margin-bottom: 16px;">
                        <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">${I18n.t('music.section_lyrics')}</div>
                        <pre style="white-space: pre-wrap; padding: 14px; background: var(--bg-card); border-radius: 10px; font-size: 13px; line-height: 1.7; font-family: inherit; margin: 0;">${this._escHtml(song.lyrics)}</pre>
                    </div>
                ` : ''}

                ${song.userPrompt ? `
                    <div style="margin-bottom: 16px; font-size: 12px; color: var(--text-secondary); opacity: 0.8;">
                        ${I18n.t('music.label_user_direction')}：${this._escHtml(song.userPrompt)}
                    </div>
                ` : ''}

                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 18px;">
                    ${isLyricsConfirmStage ? `
                        <button onclick="Music.confirmGenerate('${song.id}')" class="glass-btn primary" style="font-size: 13px;">${I18n.t('music.btn_confirm_gen')}</button>
                        <button onclick="Music.regenerateLyricsOnly('${song.id}')" class="glass-btn" style="font-size: 12px;">${I18n.t('music.btn_rewrite_lyrics')}</button>
                    ` : ''}
                    ${isFinalStage ? `
                        <button onclick="Music.regenerate('${song.id}', 'lyrics')" class="glass-btn" style="font-size: 12px;">${I18n.t('music.btn_regen_lyrics')}</button>
                        <button onclick="Music.regenerate('${song.id}', 'style')"  class="glass-btn" style="font-size: 12px;">${I18n.t('music.btn_regen_style')}</button>
                        <button onclick="Music.regenerate('${song.id}', 'audio')"  class="glass-btn" style="font-size: 12px;">${I18n.t('music.btn_regen_audio')}</button>
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
