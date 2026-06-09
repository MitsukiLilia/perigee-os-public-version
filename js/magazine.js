// ========================================================
// 雑誌モジュール (Magazine) — AI 生成访谈 + 论坛联动
// ========================================================

const Magazine = {
    // 情報アクセス制限ルール → 见 Utils.PROMPTS.infoAccessRule()

    currentArticleId: null,

    // ===== 类型配置 =====
    get _TYPE_LABELS() {
        return {
            seiyuu: I18n.t('mag.type_seiyuu_short', '声優インタビュー'),
            staff: I18n.t('mag.type_staff_short', 'スタッフインタビュー'),
            roundtable: I18n.t('mag.type_roundtable_short', '円卓座談会'),
            poll: I18n.t('mag.type_poll_short', '人気投票'),
            feature: I18n.t('mag.type_feature_short', 'キャラクター企画'),
            column: I18n.t('mag.type_column_short', '制作コラム'),
            reader: I18n.t('mag.type_reader_short', '読者コーナー'),
            charatalk: I18n.t('mag.type_charatalk_short', 'キャラ対談'),
            chart: I18n.t('mag.type_chart_short', '相関図'),
            roundup: I18n.t('mag.type_roundup_short', '月間まとめ')
        };
    },
    _TYPE_COLORS: {
        seiyuu: '#5856d6',
        staff: '#ff9500',
        roundtable: '#34c759',
        poll: '#e0245e',
        feature: '#1d9bf0',
        column: '#8b5cf6',
        reader: '#f59e0b',
        charatalk: '#ec4899',
        chart: '#06b6d4',
        roundup: '#64748b'
    },
    // 模板标签复用 mag.tpl_* — 前置 emoji 由 _FEATURE_EMOJIS 单独负责，这里取去 emoji 后的纯文字
    get _FEATURE_LABELS() {
        const stripIcon = (s) => String(s || '').replace(/^[^\p{L}\p{N}]+\s*/u, '').trim();
        return {
            bag: stripIcon(I18n.t('mag.tpl_bag', 'カバンの中身')),
            wardrobe: stripIcon(I18n.t('mag.tpl_wardrobe', 'ワードローブ診断')),
            camp: stripIcon(I18n.t('mag.tpl_camp', '合宿で持ってくるもの')),
            food: stripIcon(I18n.t('mag.tpl_food', '食の好みと推しメシ')),
            room: stripIcon(I18n.t('mag.tpl_room', '部屋のインテリア妄想')),
            phone: stripIcon(I18n.t('mag.tpl_phone', 'スマホの中身（アプリ・SNS診断）')),
            playlist: stripIcon(I18n.t('mag.tpl_playlist', 'プレイリスト診断')),
            custom: stripIcon(I18n.t('mag.tpl_custom', 'カスタム'))
        };
    },

    // ===== 初始化 =====
    init() {
        if (!AppState.data.magazineData) {
            AppState.data.magazineData = { magazineName: 'Animage', articles: [] };
        }
        const nameEl = document.getElementById('magazineTitle');
        if (nameEl) nameEl.textContent = AppState.data.magazineData.magazineName || 'Animage';
        this.renderArticleList();
    },

    // ===== 列表页渲染 =====
    renderArticleList() {
        const container = document.getElementById('magazineList');
        if (!container) return;
        const data = AppState.data.magazineData;
        const articles = (data.articles || []).slice().reverse(); // 最新在前

        if (articles.length === 0) {
            container.innerHTML = `
                <div class="magazine-empty">
                    <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8z"/></svg></div>
                    <div class="empty-state-text">${I18n.t('mag.empty_no_articles', 'まだ記事がありません')}</div>
                    <div class="empty-state-hint">${I18n.t('mag.empty_hint', '右上の「+ 取材」から新規インタビューを生成できます')}</div>
                </div>`;
            return;
        }

        container.innerHTML = articles.map(a => {
            const npcNames = this._getNpcNames(a.npcIds || []);
            const color = this._TYPE_COLORS[a.type] || '#888';
            const label = this._TYPE_LABELS[a.type] || a.type;
            // 副标题：人气投票/企划显示 featureLabel 或主题摘要，访谈显示 NPC 名
            const subtitle = (a.type === 'poll' || a.type === 'feature')
                ? (a.featureLabel ? `[${this._escHtml(a.featureLabel)}] ` : '') + this._escHtml((a.theme || '').slice(0, 30))
                : this._escHtml(npcNames || '—');
            const saved = a.savedToForumId
                ? `<span class="magazine-card-saved">${I18n.t('mag.badge_saved_broadcast', '✓ 放送局に保存済み')}</span>`
                : '';
            return `
            <div class="magazine-card" style="--mag-stripe-color:${color}" onclick="Magazine.openArticle('${a.id}')">
                <div class="magazine-card-header">
                    <span class="magazine-card-type" style="background:${color}">${label}</span>
                    ${saved}
                </div>
                <div class="magazine-card-title">${this._escHtml(a.title || a.theme || I18n.t('mag.untitled', '（無題）'))}</div>
                <div class="magazine-card-npc">${subtitle}</div>
                <div class="magazine-card-meta">${this._timeAgo(a.createdAt)}</div>
            </div>`;
        }).join('');
    },

    // ===== 阅读器 =====
    openArticle(articleId) {
        this.currentArticleId = articleId;
        Navigation.goTo('magazine-reader');
    },

    renderReader() {
        const data = AppState.data.magazineData;
        const article = (data.articles || []).find(a => a.id === this.currentArticleId);
        if (!article) { Navigation.goTo('magazine'); return; }

        // 页头标题
        const titleEl = document.getElementById('magazineReaderTitle');
        if (titleEl) titleEl.textContent = data.magazineName || 'Animage';

        // 正文渲染（根据类型分发）
        const content = document.getElementById('magazineReaderContent');
        if (content) {
            const lines = (article.content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            let html = this._generateCoverHtml(article);
            html += `<div class="magazine-article-title">${this._escHtml(article.title || article.theme)}</div>`;
            // 副信息行
            const _isInterview = ['seiyuu', 'staff', 'roundtable'].includes(article.type);
            if (_isInterview) {
                const npcNames = this._getNpcNames(article.npcIds || []);
                if (npcNames) html += `<div class="magazine-article-npc">${this._escHtml(npcNames)}</div>`;
                html += `<div class="magazine-type-row">
                    <select class="magazine-type-select" onchange="Magazine.changeArticleType('${article.id}', this.value)">
                        <option value="seiyuu" data-i18n="mag.type_seiyuu_short"${article.type === 'seiyuu' ? ' selected' : ''}>声優インタビュー</option>
                        <option value="staff" data-i18n="mag.type_staff_short"${article.type === 'staff' ? ' selected' : ''}>スタッフインタビュー</option>
                        <option value="roundtable" data-i18n="mag.type_roundtable_short"${article.type === 'roundtable' ? ' selected' : ''}>円卓座談会</option>
                    </select>
                </div>`;
            } else if (article.type === 'column') {
                const npcNames = this._getNpcNames(article.npcIds || []);
                html += `<div class="magazine-article-npc" style="color:${this._TYPE_COLORS.column};">${I18n.t('mag.subtitle_column_label', '制作コラム')}${npcNames ? ' — ' + this._escHtml(npcNames) : ''}</div>`;
            } else {
                const badge = this._TYPE_LABELS[article.type] || '';
                const sub = article.featureLabel ? `[${this._escHtml(article.featureLabel)}]` : '';
                html += `<div class="magazine-article-npc" style="color:${this._TYPE_COLORS[article.type] || '#888'};">${badge}${sub ? ' ' + sub : ''}</div>`;
            }

            // 按类型渲染正文
            if (article.type === 'poll') {
                html += this._renderPollContent(lines);
            } else if (article.type === 'feature') {
                html += this._renderFeatureContent(lines, article.featureLabel, article.featureKey);
            } else if (article.type === 'reader') {
                html += this._renderReaderContent(lines);
            } else if (article.type === 'charatalk') {
                html += this._renderCharaTalkContent(lines);
            } else if (article.type === 'chart') {
                html += this._renderChartContent(lines);
            } else if (article.type === 'column') {
                // コラム：段落渲染（按空行分段）
                html += '<div class="magazine-qa-body">';
                lines.forEach(line => {
                    const trimmed = line.trim();
                    if (!trimmed) {
                        html += '<div class="magazine-qa-gap"></div>';
                    } else {
                        html += `<div class="magazine-qa-answer">${this._escHtml(this._stripMarkdown(trimmed))}</div>`;
                    }
                });
                html += '</div>';
            } else {
                // 访谈 Q&A 格式
                html += '<div class="magazine-qa-body">';
                lines.forEach(line => {
                    const trimmed = line.trim();
                    if (!trimmed) {
                        html += '<div class="magazine-qa-gap"></div>';
                    } else if (trimmed.startsWith('――') || trimmed.startsWith('——')) {
                        html += `<div class="magazine-qa-question">${this._escHtml(this._stripMarkdown(trimmed))}</div>`;
                    } else {
                        const match = trimmed.match(/^([^：:]+)[：:](.*)$/);
                        if (match) {
                            const cleanName = this._stripMarkdown(match[1]).trim();
                            const cleanAnswer = this._stripMarkdown(match[2]).trim();
                            html += `<div class="magazine-qa-answer"><span class="magazine-qa-name">${this._escHtml(cleanName)}：</span>${this._escHtml(cleanAnswer)}</div>`;
                        } else {
                            html += `<div class="magazine-qa-answer">${this._escHtml(this._stripMarkdown(trimmed))}</div>`;
                        }
                    }
                });
                html += '</div>';
            }

            // 翻译块（折叠，已翻译则直接展示）
            if (article.translation) {
                html += `<details class="magazine-tl-block" open>
                    <summary class="magazine-tl-btn">${I18n.t('mag.translate_toggle', '▼ 中文翻译')}</summary>
                    <div class="magazine-tl-content">${this._escHtml(this._stripMarkdown(article.translation))}</div>
                </details>`;
            } else {
                html += `<div style="text-align:center; padding:20px 0;">
                    <button id="magazineTranslateBtn" class="glass-btn" onclick="Magazine.translateArticle('${article.id}')">${I18n.t('mag.translate_full', '翻译全文')}</button>
                </div>`;
            }

            content.innerHTML = html;
        }

        // 底部操作栏按钮状态
        const saveBtn = document.getElementById('magazineSaveForumBtn');
        if (saveBtn) {
            if (article.savedToForumId) {
                saveBtn.textContent = I18n.t('mag.saved_to_broadcast_short', '✓ 放送局に保存済み');
                saveBtn.disabled = true;
            } else {
                saveBtn.textContent = I18n.t('magazine.save_to_broadcast', '放送局に保存');
                saveBtn.disabled = false;
            }
        }

        // オーディオドラマ生成按钮 — 仅 charatalk / 访谈系列显示
        const audioBtn = document.getElementById('magazineGenAudioBtn');
        if (audioBtn) {
            const eligible = ['charatalk', 'seiyuu', 'staff', 'roundtable'].includes(article.type);
            audioBtn.style.display = eligible ? '' : 'none';
            const _mic = audioBtn.querySelector('.mag-audio-mic');
            const _lbl = audioBtn.querySelector('.mag-audio-label');
            if (article.audioDramaId) {
                if (_mic) _mic.style.display = 'none';
                if (_lbl) _lbl.textContent = I18n.t('mag.dramatized', '✓ ドラマ済み'); else audioBtn.textContent = I18n.t('mag.dramatized', '✓ ドラマ済み');
                audioBtn.disabled = true;
            } else {
                if (_mic) _mic.style.display = '';
                if (_lbl) _lbl.textContent = I18n.t('mag.dramatize_btn', 'ドラマ化'); else audioBtn.textContent = I18n.t('mag.dramatize_btn', 'ドラマ化');
                audioBtn.disabled = false;
            }
        }
    },

    // ===== オーディオドラマ生成 =====
    _audioDramaState: null, // {articleId, segments, summary, missing}

    openAudioDramaPreview(articleId) {
        const article = (AppState.data.magazineData?.articles || []).find(a => a.id === articleId);
        if (!article) return;

        // TTS 配置检查
        const tts = AppState.data.ttsConfig || {};
        if (tts.provider !== 'minimax') {
            Utils.showToast(I18n.t('t.mag_tts_need_minimax', '请先在「设置 → API → TTS」选择 MiniMax 并填写 Key'));
            return;
        }
        if (!tts.apiKey || !tts.groupId) {
            Utils.showToast(I18n.t('t.mag_tts_no_key', 'MiniMax API Key / Group ID 未配置'));
            return;
        }

        // 解析对话
        let parsed;
        if (article.type === 'charatalk') {
            parsed = TTSEngine.parseCharaTalk(article.content);
        } else {
            parsed = TTSEngine.parseInterview(article.content);
        }
        if (parsed.length === 0) {
            Utils.showToast(I18n.t('t.mag_no_dialogue', '未能解析出对话片段'));
            return;
        }

        const { segments, missing, summary } = TTSEngine.resolveSegmentVoices(parsed);
        const playable = segments.filter(s => s.voiceId);
        this._audioDramaState = { articleId, segments, summary, missing };

        // 渲染预览
        const body = document.getElementById('audioDramaModalBody');
        if (body) {
            const _esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const summaryHtml = summary.map(s => {
                if (s.speaker === '__interviewer__') {
                    return `<li><span class="ad-check ad-ok">✓</span><b>${I18n.t('mag.ad_interviewer', 'インタビュアー')}</b> <span class="ad-meta">${I18n.t('mag.ad_count', { n: s.count })}</span></li>`;
                }
                if (s.hasVoice) {
                    return `<li><span class="ad-check ad-ok">✓</span><b>${_esc(s.speaker)}</b> → <span class="ad-cv">${_esc(s.npcName || '')}</span> <span class="ad-meta">${I18n.t('mag.ad_count', { n: s.count })}</span></li>`;
                }
                return `<li><span class="ad-check ad-miss">✗</span><b>${_esc(s.speaker)}</b> <span class="ad-meta ad-miss-text">${I18n.t('mag.ad_unbound_text', { n: s.count })}</span></li>`;
            }).join('');
            body.innerHTML = `
<div class="ad-preview">
    <div class="ad-info">
        ${I18n.t('mag.ad_segments_summary', { total: segments.length, playable: playable.length, skipped: segments.length - playable.length })}
    </div>
    <ul class="ad-summary">${summaryHtml}</ul>
    ${missing.length ? `<div class="ad-warn">${I18n.t('mag.ad_unbound_warn', '未绑定声音的角色将被跳过。可去论坛 NPC 设置补绑定。')}</div>` : ''}
</div>`;
        }

        const confirmBtn = document.getElementById('audioDramaConfirmBtn');
        if (confirmBtn) {
            confirmBtn.disabled = playable.length === 0;
            confirmBtn.textContent = I18n.t('magazine.gen_voice', '音声生成');
            confirmBtn.style.display = '';
        }
        document.getElementById('audioDramaModal')?.classList.add('active');
    },

    closeAudioDramaModal() {
        document.getElementById('audioDramaModal')?.classList.remove('active');
        this._audioDramaState = null;
    },

    async confirmAudioDramaGen() {
        const state = this._audioDramaState;
        if (!state) return;
        const article = (AppState.data.magazineData?.articles || []).find(a => a.id === state.articleId);
        if (!article) return;

        const confirmBtn = document.getElementById('audioDramaConfirmBtn');
        const body = document.getElementById('audioDramaModalBody');
        if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = I18n.t('magazine.generating', '生成中...'); }

        // 进度 UI
        if (body) {
            body.innerHTML = `
<div class="ad-progress">
    <div class="ad-progress-text" id="audioDramaProgressText">${I18n.t('mag.ad_preparing', '準備中...')}</div>
    <div class="ad-progress-bar"><div class="ad-progress-bar-inner" id="audioDramaProgressInner" style="width:0%"></div></div>
    <div class="ad-progress-detail" id="audioDramaProgressDetail" style="font-size:11px;color:var(--text-secondary);margin-top:8px;"></div>
</div>`;
        }

        const onProgress = (done, total, currentSeg, status) => {
            const pct = Math.round(done / total * 100);
            const inner = document.getElementById('audioDramaProgressInner');
            const text = document.getElementById('audioDramaProgressText');
            const detail = document.getElementById('audioDramaProgressDetail');
            if (inner) inner.style.width = pct + '%';
            if (text) text.textContent = I18n.t('mag.ad_segment_progress', { done, total, pct });
            if (detail) {
                const speaker = currentSeg.speaker === '__interviewer__' ? I18n.t('mag.ad_interviewer', 'インタビュアー') : currentSeg.speaker;
                const tag = status === 'skipped' ? I18n.t('mag.ad_status_skipped', '⏭️ 跳过') : status === 'error' ? I18n.t('mag.ad_status_error', '❌ 失败') : I18n.t('mag.ad_status_done', '✓ 完成');
                detail.textContent = `${tag} ${speaker}：${(currentSeg.text || '').slice(0, 28)}…`;
            }
        };

        try {
            const synthesized = await TTSEngine.synthesizeBatch(state.segments, { onProgress });
            const successful = synthesized.filter(s => s.audioId);
            if (successful.length === 0) {
                throw new Error(I18n.t('mag.ad_no_audio_generated', '未能生成任何音频段'));
            }

            // 投递到 niconicoData.videos
            const audioDramaId = await Niconico.publishAudioDrama({
                article,
                segments: synthesized
            });

            // 标记 article 已 dramatized
            article.audioDramaId = audioDramaId;
            Utils.saveData();

            if (body) {
                body.innerHTML = `
<div class="ad-done">
    <div style="text-align:center;margin-bottom:8px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:36px;height:36px;color:var(--accent-color);"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg></div>
    <div style="text-align:center;font-size:15px;font-weight:600;margin-bottom:4px;">${I18n.t('mag.ad_done_title', 'ドラマ化完了！')}</div>
    <div style="text-align:center;font-size:12px;color:var(--text-secondary);margin-bottom:14px;">
        ${I18n.t('mag.ad_done_subtitle', { n: successful.length })}
    </div>
    <button class="glass-btn primary" style="width:100%;" onclick="Magazine.jumpToAudioDrama('${audioDramaId}')">${I18n.t('mag.ad_done_play', '▶ ニコニコで再生')}</button>
</div>`;
            }
            const actions = document.getElementById('audioDramaModalActions');
            if (actions) actions.querySelector('.glass-btn').textContent = I18n.t('btn.close', '閉じる');
            if (confirmBtn) confirmBtn.style.display = 'none';

            // 刷新底部按钮
            this.renderReader();
        } catch (e) {
            console.error('[AudioDrama]', e);
            if (body) {
                body.innerHTML = `<div style="text-align:center;padding:20px 0;color:#d04a5e;">${I18n.t('magazine.gen_failed_prefix', '生成失敗：')}${this._escHtml(e.message || I18n.t('mag.ad_unknown_error', '不明なエラー'))}</div>`;
            }
            if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = I18n.t('magazine.retry', '再試行'); }
        }
    },

    jumpToAudioDrama(videoId) {
        this.closeAudioDramaModal();
        if (typeof Niconico !== 'undefined' && Niconico.openVideo) {
            Navigation.goTo('niconico');
            setTimeout(() => Niconico.openVideo(videoId), 100);
        } else {
            Navigation.goTo('niconico');
        }
    },

    // ===== 生成弹窗 =====
    showGenerateModal() {
        const modal = document.getElementById('magazineGenerateModal');
        if (!modal) return;

        // 渲染 NPC 多选列表
        const npcData = AppState.data.broadcast || {};
        const npcs = npcData.officialNpcs || [];
        const npcContainer = document.getElementById('magazineNpcSelect');
        if (npcContainer) {
            if (npcs.length === 0) {
                npcContainer.innerHTML = `<div style="color:var(--text-secondary); font-size:13px; padding:8px 0;">
                    ${I18n.t('mag.npc_section_hint_empty', '放送局でNPCを先に追加してください')}</div>`;
            } else {
                npcContainer.innerHTML = npcs.map(n => `
                    <label class="magazine-npc-option">
                        <input type="checkbox" value="${n.id}" class="magazine-npc-check">
                        <span class="official-cat-badge" style="background:#888; font-size:10px; margin:0 4px;">${this._escHtml(n.role)}</span>
                        <span>${this._escHtml(n.name || I18n.t('mag.npc_role_anonymous', '（匿名）'))}</span>
                    </label>`).join('');
            }
        }

        // 渲染剧情节点下拉（用于"在XX话后发布"）— 默认选最新剧情
        const plots = (npcData.plotProgress || []);
        const plotSelect = document.getElementById('magazineAfterPlot');
        if (plotSelect) {
            const lastPlotId = plots.length > 0 ? plots[plots.length - 1].id : '';
            plotSelect.innerHTML = `<option value="">${I18n.t('magazine.plot_none', '（不指定，作为早期情报）')}</option>` +
                plots.map(p => `<option value="${p.id}"${p.id === lastPlotId ? ' selected' : ''}>${this._escHtml(p.title)}</option>`).join('');
        }

        // 清空输入，重置类型
        const themeInput = document.getElementById('magazineThemeInput');
        if (themeInput) themeInput.value = '';
        const typeSelect = document.getElementById('magazineTypeSelect');
        if (typeSelect) typeSelect.value = 'seiyuu';
        this.onTypeChange('seiyuu');

        modal.classList.add('active');
    },

    closeGenerateModal() {
        const modal = document.getElementById('magazineGenerateModal');
        if (modal) modal.classList.remove('active');
    },

    // ===== 根据类型切换表单区域 =====
    onTypeChange(type) {
        const isInterview = ['seiyuu', 'staff', 'roundtable'].includes(type);
        const isColumn = type === 'column';
        const isPoll = type === 'poll';
        const isFeature = type === 'feature';

        // NPC 区域：访谈类 + コラム需要
        const npcSection = document.getElementById('magazineNpcSection');
        if (npcSection) npcSection.style.display = (isInterview || isColumn) ? '' : 'none';

        // 模板区域：仅企划类需要
        const featSection = document.getElementById('magazineFeatureSection');
        if (featSection) featSection.style.display = isFeature ? '' : 'none';

        // 主题输入框 placeholder + label 文字切换
        const themeInput = document.getElementById('magazineThemeInput');
        const themeLabel = document.getElementById('magazineThemeLabel');
        if (isPoll) {
            if (themeInput) themeInput.placeholder = I18n.t('mag.theme_poll_placeholder', '例：最強キャラ人気投票、推しキャラ総選挙、作画が最高だったシーン投票など');
            if (themeLabel) themeLabel.textContent = I18n.t('mag.theme_poll_label', '投票テーマ（必須）');
        } else if (isFeature) {
            if (themeInput) themeInput.placeholder = I18n.t('mag.theme_feature_placeholder', '（任意）追加の方向性や補足。テンプレートを選んで空欄でもOK');
            if (themeLabel) themeLabel.textContent = I18n.t('mag.theme_feature_label', '補足テーマ（任意）');
        } else if (isColumn) {
            if (themeInput) themeInput.placeholder = I18n.t('mag.theme_column_placeholder', '例：第X話の演出意図、キャラデザの裏話、削られたシーンの話など');
            if (themeLabel) themeLabel.textContent = I18n.t('mag.theme_column_label', 'コラムテーマ（必須）');
        } else if (type === 'reader') {
            if (themeInput) themeInput.placeholder = I18n.t('mag.theme_reader_placeholder', '例：恋愛関係について、戦闘シーンについてなど（空欄なら自由）');
            if (themeLabel) themeLabel.textContent = I18n.t('mag.theme_reader_label', '方向性（任意）');
        } else if (type === 'charatalk') {
            if (themeInput) themeInput.placeholder = I18n.t('mag.theme_charatalk_placeholder', '例：AとBの放課後トーク、修行仲間の本音対談、ライバル同士の休日など');
            if (themeLabel) themeLabel.textContent = I18n.t('mag.theme_charatalk_label', '対談テーマ（必須）');
        } else if (type === 'chart') {
            if (themeInput) themeInput.placeholder = I18n.t('mag.theme_chart_placeholder', '例：恋愛関係中心、敵味方の関係図、チーム内の力関係など');
            if (themeLabel) themeLabel.textContent = I18n.t('mag.theme_chart_label', '方向性（任意）');
        } else {
            if (themeInput) themeInput.placeholder = I18n.t('mag.theme_placeholder', '例：役作りのこだわり、現場の雰囲気、キャラへの思い入れなど');
            if (themeLabel) themeLabel.textContent = I18n.t('mag.theme_label', 'テーマ・方向性（必須）');
        }
    },

    _showMagazineSkeleton() {
        const container = document.getElementById('magazineList');
        if (!container) return;
        const skel = document.createElement('div');
        skel.id = 'magazineSkeletonBlock';
        skel.innerHTML = `
            <div class="skeleton-card" style="border-left:3px solid var(--border-light); border-radius:var(--radius-md); margin-bottom:12px; padding:16px;">
                <div class="skeleton-header"><div class="skeleton-line short"></div></div>
                <div class="skeleton-line long"></div>
                <div class="skeleton-line medium"></div>
            </div>`.repeat(2);
        container.prepend(skel);
    },

    _removeMagazineSkeleton() {
        document.getElementById('magazineSkeletonBlock')?.remove();
    },

    async generateArticle() {
        const type = document.getElementById('magazineTypeSelect')?.value || 'seiyuu';
        const btn = document.getElementById('magazineGenerateBtn');
        if (btn) { btn.textContent = I18n.t('mag.gen_btn_generating', '生成中...'); btn.disabled = true; }
        this._showMagazineSkeleton();
        try {
            if (type === 'poll') await this._generatePoll();
            else if (type === 'feature') await this._generateFeature();
            else if (type === 'column') await this._generateColumn();
            else if (type === 'reader') await this._generateReaderCorner();
            else if (type === 'charatalk') await this._generateCharaTalk();
            else if (type === 'chart') await this._generateRelationChart();
            else if (type === 'roundup') await this._generateRoundup();
            else await this._generateInterview(type);
        } catch (e) {
            Utils.showToast(I18n.t('t.mag_gen_failed', '生成失败：') + e.message);
            console.error('[Magazine Gen Error]', e);
        } finally {
            this._removeMagazineSkeleton();
            if (btn) { btn.textContent = I18n.t('mag.gen_btn_generate', '生成する'); btn.disabled = false; }
        }
    },

    // ===== 访谈生成 =====
    async _generateInterview(type) {
        const theme = document.getElementById('magazineThemeInput')?.value?.trim() || '';
        const afterPlotId = document.getElementById('magazineAfterPlot')?.value || '';
        const checked = document.querySelectorAll('.magazine-npc-check:checked');
        const npcIds = Array.from(checked).map(cb => cb.value);
        if (npcIds.length === 0) { Utils.showToast(I18n.t('t.mag_need_interviewee', '受访者を1人以上選んでください')); return; }
        if (!theme) { Utils.showToast(I18n.t('t.mag_need_interview_theme', 'インタビューテーマを入力してください')); return; }

        const forumData = AppState.data.forumData || {};
        const magazineData = AppState.data.magazineData;
        const npcs = AppState.data.broadcast.officialNpcs || [];
        const interviewees = npcIds.map(id => {
            const n = npcs.find(n => n.id === id);
            return n ? `${n.role}${n.name ? '・' + n.name : ''}` : id;
        });
        const typeLabelStr = {
            seiyuu: '声優インタビュー（アニメ雑誌掲載）',
            staff: 'スタッフインタビュー（制作側の視点）',
            roundtable: '円卓座談会（複数ゲスト対談形式）'
        }[type] || 'インタビュー';
        const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');

        const systemPrompt = `あなたはアニメ雑誌 ${magazineData.magazineName || 'Animage'} の専属ジャーナリストです。
リアルで没入感のある${typeLabelStr}を自然な日本語で生成してください。

INTERVIEWEES:
${interviewees.map(s => `- ${s}`).join('\n')}

INTERVIEW TYPE: ${typeLabelStr}
THEME: ${theme}

FORMAT RULES:
- 記者の質問は「――」（全角emダッシュ）で開始すること
- 回答は「[受訪者名]：[回答]」の形式で、上記リストの正確な名前を使用すること
- 座談会の場合：複数の受訪者が交互に発言し、自然なグループ対話にすること
- 合計6〜10組のQ&A（座談会の場合は最大12組まで可）
- 温かみのあるプロフェッショナルな雑誌トーン——実際に掲載されたインタビューのように感じられること
- 個人的なエピソード、制作裏話、作品への想いを含めること
- すべて日本語で執筆すること
- プレーンテキストのみ——Markdownフォーマットは一切禁止：**、*、_、#、箇条書き「* 」記号、その他一切のマークアップを使用しないこと

🚫 絶対禁止ルール（最優先）：
- ワールドコンテキストに明記されていないストーリー展開・キャラクターの変化・結末を一切捏造しないこと
- ユーザーがテーマで指定していない限り、今後の展開を予測・示唆・ネタバレしないこと
- 公式情報で発表されたが未公開のコンテンツについては「発表された事実」のみ言及可能。内容への言及は禁止

⚠️ インタビュー特別ルール：
- 受訪者が今後の展開・次の話数・シリーズの結末について具体的に言及することは禁止
- 「楽しみにしていてください」「次も頑張ります」のような一般的な前向きコメントのみ許可
- ユーザーがテーマで特定の展開への言及を指示した場合のみ、その範囲で言及可能

WORLD CONTEXT（この情報のみに基づいて回答すること）:
${worldContext || '（世界観未設定 — 記載にないキャラクター名・CP・ストーリーイベントを捏造しないこと。一般的なアニメ業界トークにとどめること）'}
${typeof Utils !== 'undefined' ? Utils.getEventContextPrompt(3) : ''}

OUTPUT FORMAT（厳守すること）:
TITLE: [日本語タイトル、例：「○○役・田中花子 単独インタビュー」]

（本文Q&Aをそのまま開始する。余計なタイトルや説明は不要）`;

        const messages = [{ role: 'user', content: 'インタビューを生成してください。' }];
        const response = await Utils.callChatAPI(messages, systemPrompt);
        const titleMatch = response.match(/^[\*\#\s]*TITLE:[\*\#\s]*(.+)/im);
        const title = titleMatch ? this._stripMarkdown(titleMatch[1].trim()) : theme;
        const articleContent = response.replace(/^[\*\#\s]*TITLE:[\*\#\s]*.+\n?/im, '').trim();

        const article = {
            id: Utils.generateId(), type, npcIds, theme,
            afterPlotId: afterPlotId || null, title, content: articleContent,
            createdAt: Date.now(), savedToForumId: null
        };
        if (!magazineData.articles) magazineData.articles = [];
        magazineData.articles.push(article);
        Utils.saveData();
        if (typeof Utils !== 'undefined' && Utils.emitEvent) {
            Utils.emitEvent('magazine_published', 'magazine', { title: article.title, summary: article.theme });
        }
        this.closeGenerateModal();
        Utils.showToast(I18n.t('t.mag_interview_done', '✓ インタビュー生成完了'));
        this.openArticle(article.id);
    },

    // ===== 人气投票生成 =====
    async _generatePoll() {
        const theme = document.getElementById('magazineThemeInput')?.value?.trim() || '';
        if (!theme) { Utils.showToast(I18n.t('t.mag_need_poll_theme', '投票テーマを入力してください')); return; }
        const afterPlotId = document.getElementById('magazineAfterPlot')?.value || '';
        const forumData = AppState.data.forumData || {};
        const magazineData = AppState.data.magazineData;
        const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');

        const systemPrompt = `あなたはアニメ雑誌 ${magazineData.magazineName || 'Animage'} のキャラクター人気投票結果記事を執筆しています。

FRANCHISE WORLD CONTEXT（ここに記載されたキャラクターのみ使用すること。架空のキャラクターを作らないこと）:
${worldContext || '（世界観未設定 — 記載にないキャラクター名・CP・ストーリーイベントを捏造しないこと。一般的なアニメ業界トークにとどめること）'}
${Utils.PROMPTS.infoAccessRule()}
POLL THEME: ${theme}

RULES:
- 作品のキャラクターから5〜8人のリアルな人気ランキングを生成すること
- 得票率はリアルに：1位は25〜40%、以降自然に減少し、合計約100%にすること
- 各キャラクターに2〜3件の熱のこもった読者コメントを「」で記載すること
- 読者コメントの内容：推しの理由、感動の声、カップリングへの言及、印象的なシーンへの言及などを混在させること
- ランキングはワールドコンテキストにおけるキャラクターの役割とファン人気に基づくこと
- すべて日本語で執筆すること
- プレーンテキストのみ——Markdownフォーマットは一切使用しないこと

🚫 絶対禁止ルール（最優先）：
- ワールドコンテキストに明記されていないストーリー展開・キャラクターの変化・結末を一切捏造しないこと
- ワールドコンテキストに存在しないキャラクターをランキングに含めないこと
- 読者コメントでも未公開の展開に言及しないこと

OUTPUT FORMAT（厳守すること）:
TITLE: [投票タイトル、例：「第1回キャラクター人気投票 結果発表！」]

1位　[キャラクター名]　XX%
「[読者コメント1]」
「[読者コメント2]」
「[読者コメント3]」

2位　[キャラクター名]　XX%
「[読者コメント1]」
「[読者コメント2]」

（以下同様に続ける）`;

        const messages = [{ role: 'user', content: '人気投票の結果記事を生成してください。' }];
        const response = await Utils.callChatAPI(messages, systemPrompt);
        const titleMatch = response.match(/^[\*\#\s]*TITLE:[\*\#\s]*(.+)/im);
        const title = titleMatch ? this._stripMarkdown(titleMatch[1].trim()) : theme;
        const articleContent = response.replace(/^[\*\#\s]*TITLE:[\*\#\s]*.+\n?/im, '').trim();

        const article = {
            id: Utils.generateId(), type: 'poll', npcIds: [], theme,
            afterPlotId: afterPlotId || null, title, content: articleContent,
            createdAt: Date.now(), savedToForumId: null
        };
        if (!magazineData.articles) magazineData.articles = [];
        magazineData.articles.push(article);
        Utils.saveData();
        this.closeGenerateModal();
        Utils.showToast(I18n.t('t.mag_poll_done', '✓ 人気投票生成完了'));
        this.openArticle(article.id);
    },

    // ===== 角色企划生成 =====
    async _generateFeature() {
        const template = document.getElementById('magazineFeatureTemplate')?.value || 'bag';
        const customTheme = document.getElementById('magazineThemeInput')?.value?.trim() || '';
        const afterPlotId = document.getElementById('magazineAfterPlot')?.value || '';
        const featureLabel = this._FEATURE_LABELS[template] || template;
        if (template === 'custom' && !customTheme) { Utils.showToast(I18n.t('t.mag_need_custom_theme', 'カスタムテーマを入力してください')); return; }
        const theme = template === 'custom' ? customTheme : featureLabel + (customTheme ? `（${customTheme}）` : '');

        const forumData = AppState.data.forumData || {};
        const magazineData = AppState.data.magazineData;
        const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');

        const systemPrompt = `あなたはアニメ雑誌 ${magazineData.magazineName || 'Animage'} の楽しいキャラクター企画記事を執筆しています。

FEATURE THEME: 「${theme}」

FRANCHISE WORLD CONTEXT（ここに記載されたキャラクターのみ使用すること）:
${worldContext || '（世界観未設定 — 記載にないキャラクター名・CP・ストーリーイベントを捏造しないこと。一般的なアニメ業界トークにとどめること）'}
${Utils.PROMPTS.infoAccessRule()}
RULES:
- 上記のFEATURE THEMEに特定のキャラクター名が指定されている場合、そのキャラクターのみについて書くこと——他のキャラクターを追加しないこと。これが最優先ルールである
- テーマにキャラクター指定がない場合、ワールドコンテキストのメインキャラクター（4〜7人）について書くこと
- 各セクションは ◆ [キャラクター名] で開始すること
- 内容はワールドコンテキストにおけるキャラクターの性格・習慣・口調・ストーリー設定に合致させること
- 想像力豊かに楽しく——これは雑誌のファンタジー企画であり、事実報道ではない
- 具体的なアイテム名・ブランド名・アプリ名は問題なし（各キャラに合うものを創作してよい）
- すべて自然で温かみのある日本語で執筆すること
- プレーンテキストのみ——Markdownフォーマットは一切使用しないこと

🚫 絶対禁止ルール（最優先）：
- ワールドコンテキストに明記されていないストーリー展開・キャラクターの変化を一切捏造しないこと
- キャラクターの性格・口調・関係性はワールドコンテキストに忠実であること

OUTPUT FORMAT（厳守すること）:
TITLE: [記事タイトル、例：「キャラ別・カバンの中身を大公開！」]

◆ [キャラクター名]
[そのキャラクターの内容 2〜4文]

◆ [キャラクター名]
[内容]

（テーマで指定されたキャラのみ。指定がなければメインキャラを網羅）`;

        const messages = [{ role: 'user', content: 'キャラクター企画記事を生成してください。' }];
        const response = await Utils.callChatAPI(messages, systemPrompt);
        const titleMatch = response.match(/^[\*\#\s]*TITLE:[\*\#\s]*(.+)/im);
        const title = titleMatch ? this._stripMarkdown(titleMatch[1].trim()) : theme;
        const articleContent = response.replace(/^[\*\#\s]*TITLE:[\*\#\s]*.+\n?/im, '').trim();

        const article = {
            id: Utils.generateId(), type: 'feature', npcIds: [], theme,
            featureKey: template, featureLabel, afterPlotId: afterPlotId || null, title, content: articleContent,
            createdAt: Date.now(), savedToForumId: null
        };
        if (!magazineData.articles) magazineData.articles = [];
        magazineData.articles.push(article);
        Utils.saveData();
        this.closeGenerateModal();
        Utils.showToast(I18n.t('t.mag_feature_done', '✓ キャラクター企画生成完了'));
        this.openArticle(article.id);
    },

    // ===== 制作コラム生成 =====
    async _generateColumn() {
        const theme = document.getElementById('magazineThemeInput')?.value?.trim() || '';
        const afterPlotId = document.getElementById('magazineAfterPlot')?.value || '';
        if (!theme) { Utils.showToast(I18n.t('t.mag_need_column_theme', 'コラムテーマを入力してください')); return; }
        const checked = document.querySelectorAll('.magazine-npc-check:checked');
        const npcIds = Array.from(checked).map(cb => cb.value);
        if (npcIds.length === 0) { Utils.showToast(I18n.t('t.mag_need_columnist', 'コラムニスト（筆者）を1人選んでください')); return; }

        const forumData = AppState.data.forumData || {};
        const magazineData = AppState.data.magazineData;
        const npcs = AppState.data.broadcast.officialNpcs || [];
        const authorNpc = npcs.find(n => n.id === npcIds[0]);
        const authorName = authorNpc ? `${authorNpc.role}${authorNpc.name ? '・' + authorNpc.name : ''}` : '制作スタッフ';
        const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');

        const systemPrompt = `あなたはアニメ雑誌 ${magazineData.magazineName || 'Animage'} の個人コラム/エッセイを執筆しています。
筆者は ${authorName} ——制作チームの一員として一人称で執筆すること。

COLUMN THEME: 「${theme}」

WORLD CONTEXT:
${worldContext || '（世界観未設定 — 記載にないキャラクター名・CP・ストーリーイベントを捏造しないこと。一般的なアニメ業界トークにとどめること）'}

RULES:
- 制作スタッフの視点から、一人称の個人的で内省的なエッセイを書くこと
- 温かく率直なトーン——連載コラムのように。フォーマルなインタビューではない
- テーマ例：制作裏話、演出意図、カットされたシーン、キャラクターデザインの決定過程、制作の苦労、キャラクターへの個人的な想い
- 800〜1200文字
- カジュアルなエピソード、ユーモア、感動的な場面を含めてよい
- すべて自然な日本語で執筆すること
- プレーンテキストのみ——Markdownフォーマットは一切使用しないこと

🚫 絶対禁止ルール（最優先）：
- ワールドコンテキストに明記されていないストーリー展開を一切捏造しないこと
- 今後の展開を予測・示唆しないこと（ユーザーがテーマで指定した場合のみ許可）
- 未公開の設定・キャラクター情報を捏造しないこと

OUTPUT FORMAT:
TITLE: [コラムタイトル、例：「第10話、あのシーンに込めた想い」]

（本文をそのまま書く。段落は空行で区切る）`;

        const messages = [{ role: 'user', content: '制作コラムを生成してください。' }];
        const response = await Utils.callChatAPI(messages, systemPrompt);
        const titleMatch = response.match(/^[\*\#\s]*TITLE:[\*\#\s]*(.+)/im);
        const title = titleMatch ? this._stripMarkdown(titleMatch[1].trim()) : theme;
        const articleContent = response.replace(/^[\*\#\s]*TITLE:[\*\#\s]*.+\n?/im, '').trim();

        const article = {
            id: Utils.generateId(), type: 'column', npcIds: [npcIds[0]], theme,
            afterPlotId: afterPlotId || null, title, content: articleContent,
            createdAt: Date.now(), savedToForumId: null
        };
        if (!magazineData.articles) magazineData.articles = [];
        magazineData.articles.push(article);
        Utils.saveData();
        this.closeGenerateModal();
        Utils.showToast(I18n.t('t.mag_column_done', '✓ 制作コラム生成完了'));
        this.openArticle(article.id);
    },

    // ===== 読者コーナー生成 =====
    async _generateReaderCorner() {
        const theme = document.getElementById('magazineThemeInput')?.value?.trim() || '';
        const afterPlotId = document.getElementById('magazineAfterPlot')?.value || '';

        const forumData = AppState.data.forumData || {};
        const magazineData = AppState.data.magazineData;
        const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');

        const systemPrompt = `あなたはアニメ雑誌 ${magazineData.magazineName || 'Animage'} の読者お便りコーナー（読者コーナー）を執筆しています。
雑誌に届いたファンレターと編集部の返信をシミュレーションすること。

${theme ? `DIRECTION: 「${theme}」` : '（特に指定なし——自然なバリエーションのファンレターを生成すること）'}

WORLD CONTEXT:
${worldContext || '（世界観未設定 — 記載にないキャラクター名・CP・ストーリーイベントを捏造しないこと。一般的なアニメ業界トークにとどめること）'}
${Utils.PROMPTS.infoAccessRule()}
RULES:
- 編集部の返信付きの読者レター5〜8通を生成すること
- 各レターにはペンネーム（PN）と都道府県を付けること
- レターのスタイルは多様にすること：深い考察の質問、CPについての探り（「○○と△△は付き合ってるんですか？」）、面白い苦情、感動の告白、子供の無邪気な質問、「なぜXが起きたのか」というストーリーへの質問
- 編集部の返信：真面目で丁寧なもの、ユーモアではぐらかすもの（「ノーコメントです（笑）」）、からかうもの、温かく感謝するものなどを混在させること
- すべて自然な日本語で執筆すること
- プレーンテキストのみ——Markdownフォーマットは一切使用しないこと

🚫 絶対禁止ルール（最優先）：
- ワールドコンテキストに明記されていないストーリー展開を一切捏造しないこと
- 編集部の返信で今後の展開をネタバレ・示唆しないこと
- 読者の手紙でも未公開の展開に言及しないこと

OUTPUT FORMAT（厳守すること）:
TITLE: [タイトル、例：「読者のお便りコーナー ～みんなの声、届いてます！～」]

📮 [PN名]（[都道府県]）
[読者の手紙内容 1-3文]

📝 編集部：
[編集部の返信 1-3文]

📮 [次のPN名]（[都道府県]）
[手紙内容]

📝 編集部：
[返信]

（以下同様に5-8通）`;

        const messages = [{ role: 'user', content: '読者コーナーを生成してください。' }];
        const response = await Utils.callChatAPI(messages, systemPrompt);
        const titleMatch = response.match(/^[\*\#\s]*TITLE:[\*\#\s]*(.+)/im);
        const title = titleMatch ? this._stripMarkdown(titleMatch[1].trim()) : '読者コーナー';
        const articleContent = response.replace(/^[\*\#\s]*TITLE:[\*\#\s]*.+\n?/im, '').trim();

        const article = {
            id: Utils.generateId(), type: 'reader', npcIds: [], theme: theme || '読者コーナー',
            afterPlotId: afterPlotId || null, title, content: articleContent,
            createdAt: Date.now(), savedToForumId: null
        };
        if (!magazineData.articles) magazineData.articles = [];
        magazineData.articles.push(article);
        Utils.saveData();
        this.closeGenerateModal();
        Utils.showToast(I18n.t('t.mag_reader_done', '✓ 読者コーナー生成完了'));
        this.openArticle(article.id);
    },

    // ===== キャラ対談生成 =====
    async _generateCharaTalk() {
        const theme = document.getElementById('magazineThemeInput')?.value?.trim() || '';
        const afterPlotId = document.getElementById('magazineAfterPlot')?.value || '';
        if (!theme) { Utils.showToast(I18n.t('t.mag_need_talk_theme', '対談テーマを入力してください')); return; }

        const forumData = AppState.data.forumData || {};
        const magazineData = AppState.data.magazineData;
        const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');

        const systemPrompt = `あなたはアニメ雑誌 ${magazineData.magazineName || 'Animage'} のキャラクター対談企画（キャラ対談）を執筆しています。
これはキャラクター本人による会話である——声優ではなくキャラクター自身が話していること。

TALK THEME: 「${theme}」

WORLD CONTEXT:
${worldContext || '（世界観未設定 — 記載にないキャラクター名・CP・ストーリーイベントを捏造しないこと。一般的なアニメ業界トークにとどめること）'}

⚠️ 対談の情報開示制限:
これは雑誌に掲載される対談であり、読者（視聴者）が読むものである。キャラクターは自分の設定を「知っている」が、以下の制約を守ること：
- 劇中で既に描写・公開済みの出来事のみ話題にすること
- 劇中未公開のバックストーリー・隠された関係性・未来の展開を自分から語り出さないこと
- 過去の出来事に触れる場合、劇中で既に視聴者に見せたシーンのみ言及可能
- 秘密や隠し事がある場合、対談中に自分から明かすのではなく、話題をそらしたり曖昧にしたりすること

RULES:
- テーマにキャラクター名が指定されている場合、そのキャラクターのみを使用すること。指定がない場合、ワールドコンテキストから興味深い関係性を持つ2〜3人を選ぶこと
- 対話形式：[キャラ名]「セリフ」
- 10〜18回の対話のやり取り——自然で流れるような会話にすること
- 各キャラクターの口調・性格・癖はワールドコンテキストと完全に一致させること
- 冒頭に短い編集部のイントロ（1〜2文でシーンを設定、ナレーション口調で「」なし）を入れてもよい
- テーマ例：日常の雑談、互いをからかう、過去の出来事を振り返る、本音を明かす
- キャラクターはワールドコンテキストの具体的なストーリーイベントに言及してよい
- 重要：キャラクターは物語世界の中に生きる人間である——出来事を自ら体験している。自分がアニメ/漫画の中にいることを知らない。絶対に第四の壁を破らないこと。出来事を自分の記憶・体験として語ること（例：「あの時は大変だったよね」であり「あのシーンは感動した」ではない）。ワールドコンテキストはあなたの参考用であり、キャラクターにとっては生きた現実として扱うこと
- 演出表現 ≠ キャラクターの知識：ワールドコンテキストは観客向けの映像技法（フラッシュバック、ナレーション、モンタージュ）でシーンを描写している。キャラクターは作中で実際に体験したことだけを知っている。例：キャラAがキャラBの日記を読み、その描写にBの過去のフラッシュバック映像が含まれている場合——Aは日記の文面を読んだだけであり、Bの過去を目撃してはいない。観客向けの映像演出として見せられたものを「見た」とキャラクターに言わせないこと
- すべて自然な日本語で執筆すること
- プレーンテキストのみ——Markdownフォーマットは一切使用しないこと

🚫 絶対禁止ルール（最優先）：
- ワールドコンテキストに明記されていないストーリー展開・キャラクターの変化を一切捏造しないこと
- キャラクターが未来の展開を予言・示唆するような発言をしないこと

OUTPUT FORMAT:
TITLE: [タイトル、例：「放課後クロストーク ～AとBの本音～」]

（短いナレーション導入、1-2文）

[キャラA]「セリフ」
[キャラB]「セリフ」
[キャラA]「セリフ」
...`;

        const messages = [{ role: 'user', content: 'キャラ対談を生成してください。' }];
        const response = await Utils.callChatAPI(messages, systemPrompt);
        const titleMatch = response.match(/^[\*\#\s]*TITLE:[\*\#\s]*(.+)/im);
        const title = titleMatch ? this._stripMarkdown(titleMatch[1].trim()) : theme;
        const articleContent = response.replace(/^[\*\#\s]*TITLE:[\*\#\s]*.+\n?/im, '').trim();

        const article = {
            id: Utils.generateId(), type: 'charatalk', npcIds: [], theme,
            afterPlotId: afterPlotId || null, title, content: articleContent,
            createdAt: Date.now(), savedToForumId: null
        };
        if (!magazineData.articles) magazineData.articles = [];
        magazineData.articles.push(article);
        Utils.saveData();
        this.closeGenerateModal();
        Utils.showToast(I18n.t('t.mag_charatalk_done', '✓ キャラ対談生成完了'));
        this.openArticle(article.id);
    },

    // ===== 相関図生成 =====
    async _generateRelationChart() {
        const theme = document.getElementById('magazineThemeInput')?.value?.trim() || '';
        const afterPlotId = document.getElementById('magazineAfterPlot')?.value || '';

        const forumData = AppState.data.forumData || {};
        const magazineData = AppState.data.magazineData;
        const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');

        const systemPrompt = `あなたはアニメ雑誌 ${magazineData.magazineName || 'Animage'} のキャラクター相関図企画（相関図）を作成しています。

${theme ? `FOCUS: 「${theme}」` : '（メインキャストを網羅する総合的な相関図を生成すること）'}

WORLD CONTEXT:
${worldContext || '（世界観未設定 — 記載にないキャラクター名・CP・ストーリーイベントを捏造しないこと。一般的なアニメ業界トークにとどめること）'}
${Utils.PROMPTS.infoAccessRule()}
RULES:
- フォーカス/テーマに特定のキャラクターが指定されている場合、そのキャラクターの関係性のみを含めること
- 5〜10組の関係ペアをリストアップすること
- 各ペア：ワールドコンテキストの具体的なシーン/イベントに言及しながら、1〜2文の生き生きとした描写で関係性を表現すること
- 矢印で関係の方向を示すこと
- 末尾に短い編集部コメント（1〜2文）を入れてもよい
- ワールドコンテキストに裏付けのないストーリーイベントや関係性を捏造しないこと
- すべて自然な日本語で執筆すること
- プレーンテキストのみ——Markdownフォーマットは一切使用しないこと

OUTPUT FORMAT（厳守すること）:
TITLE: [タイトル、例：「最新話までの人物相関図」]

◆ [キャラA] ⇔ [キャラB]：[双方向の関係を1-2文で描写]

◆ [キャラC] → [キャラD]：[片方向の関係（想い・憧れ・敵意など）を1-2文で描写]

◆ [キャラE] ⇔ [キャラF]：[関係描写]

（以下同様）

※編集部注：[短い補足コメント]`;

        const messages = [{ role: 'user', content: '相関図を生成してください。' }];
        const response = await Utils.callChatAPI(messages, systemPrompt);
        const titleMatch = response.match(/^[\*\#\s]*TITLE:[\*\#\s]*(.+)/im);
        const title = titleMatch ? this._stripMarkdown(titleMatch[1].trim()) : '相関図';
        const articleContent = response.replace(/^[\*\#\s]*TITLE:[\*\#\s]*.+\n?/im, '').trim();

        const article = {
            id: Utils.generateId(), type: 'chart', npcIds: [], theme: theme || '相関図',
            afterPlotId: afterPlotId || null, title, content: articleContent,
            createdAt: Date.now(), savedToForumId: null
        };
        if (!magazineData.articles) magazineData.articles = [];
        magazineData.articles.push(article);
        Utils.saveData();
        this.closeGenerateModal();
        Utils.showToast(I18n.t('t.mag_chart_done', '✓ 相関図生成完了'));
        this.openArticle(article.id);
    },

    // ===== 月間まとめ生成 =====
    async _generateRoundup() {
        const forumData = AppState.data.forumData || {};
        const magazineData = AppState.data.magazineData;
        const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');

        // Get recent events for roundup
        const recentEvents = (typeof Utils !== 'undefined') ? Utils.getRecentEvents({ limit: 15 }) : [];
        if (recentEvents.length === 0) {
            Utils.showToast(I18n.t('t.mag_no_recent_events', '最近のイベントがありません。先にコンテンツを生成してください'));
            return;
        }

        const TYPE_LABELS = {
            plot_published: '新話公開',
            goods_announced: 'グッズ情報',
            official_info_added: '公式情報',
            novel_published: '二次創作',
            tweet_event: 'SNS話題',
            magazine_published: '雑誌記事'
        };

        const eventSummary = recentEvents.map(e => {
            const label = TYPE_LABELS[e.type] || e.type;
            return `- [${label}] ${e.data.title || ''}${e.data.summary ? ': ' + e.data.summary : ''} (${new Date(e.timestamp).toLocaleDateString('ja-JP')})`;
        }).join('\n');

        const systemPrompt = `あなたはアニメ雑誌 ${magazineData.magazineName || 'Animage'} の月間まとめ特集記事を執筆しています。

以下の最近のコミュニティイベントを元に、ファンダムの1ヶ月の出来事を振り返る特集記事を生成してください。

【最近のイベント一覧】
${eventSummary}

FRANCHISE WORLD CONTEXT:
${worldContext || '（世界観未設定 — 記載にないキャラクター名・CP・ストーリーイベントを捏造しないこと。一般的なアニメ業界トークにとどめること）'}
${Utils.PROMPTS.infoAccessRule()}
RULES:
- 各イベントをセクション分けし、ファン目線で振り返る記事にすること
- 記者の解説と読者の声（コメント）を自然に混ぜること
- SNSでの反応、コミュニティの盛り上がりを活き活きと描写すること
- すべて日本語で執筆すること
- プレーンテキストのみ——Markdownフォーマットは一切使用しないこと

🚫 捏造禁止：上記のイベント一覧とワールドコンテキストに記載された情報のみ使用すること

OUTPUT FORMAT（厳守すること）:
TITLE: [記事タイトル、例：「今月のファンダム総まとめ！激動の1ヶ月を振り返る」]

（本文をそのまま開始する）`;

        const messages = [{ role: 'user', content: '月間まとめ特集記事を生成してください。' }];
        const response = await Utils.callChatAPI(messages, systemPrompt);
        const titleMatch = response.match(/^[\*\#\s]*TITLE:[\*\#\s]*(.+)/im);
        const title = titleMatch ? this._stripMarkdown(titleMatch[1].trim()) : '月間まとめ';
        const articleContent = response.replace(/^[\*\#\s]*TITLE:[\*\#\s]*.+\n?/im, '').trim();

        const article = {
            id: Utils.generateId(), type: 'roundup', npcIds: [], theme: '月間まとめ',
            afterPlotId: null, title, content: articleContent,
            createdAt: Date.now(), savedToForumId: null
        };
        if (!magazineData.articles) magazineData.articles = [];
        magazineData.articles.push(article);
        Utils.saveData();

        if (typeof Utils !== 'undefined' && Utils.emitEvent) {
            Utils.emitEvent('magazine_published', 'magazine', { title: title, summary: '月間まとめ特集' });
        }

        this.closeGenerateModal();
        Utils.showToast(I18n.t('t.mag_roundup_done', '✓ 月間まとめ生成完了'));
        this.openArticle(article.id);
    },

    // ===== 人气投票正文渲染 =====
    _POLL_MEDALS: { 1: '🥇', 2: '🥈', 3: '🥉' },

    _renderPollContent(lines) {
        let html = '<div class="magazine-poll-body">';
        let rankBlock = null;
        const flushBlock = () => {
            if (!rankBlock) return;
            const pct = parseInt(rankBlock.pct) || 0;
            const rankNum = parseInt(rankBlock.rank);
            const medal = this._POLL_MEDALS[rankNum] || '';
            const isTop3 = rankNum >= 1 && rankNum <= 3;
            html += `<div class="magazine-poll-card${isTop3 ? ' poll-top3' : ''}">
                <div class="magazine-poll-header">
                    ${medal ? `<span class="magazine-poll-medal">${medal}</span>` : ''}
                    <span class="magazine-poll-rank-num${isTop3 ? ' poll-rank-large' : ''}">${this._escHtml(rankBlock.rank)}${I18n.t('mag.poll_rank_unit', '位')}</span>
                    <span class="magazine-poll-char-name">${this._escHtml(rankBlock.name)}</span>
                    <span class="magazine-poll-pct">${this._escHtml(rankBlock.pct)}</span>
                </div>
                <div class="magazine-poll-bar-wrap"><div class="magazine-poll-bar" style="width:${Math.min(pct, 100)}%"></div></div>
                <div class="magazine-poll-comments">${rankBlock.comments.map(c => `<div class="magazine-poll-comment">「${this._escHtml(c)}」</div>`).join('')}</div>
            </div>`;
            rankBlock = null;
        };
        for (const line of lines) {
            const trimmed = this._stripMarkdown(line.trim());
            if (!trimmed) continue;
            // 匹配 "N位　名前　XX%" 格式（宽松匹配）
            const rankMatch = trimmed.match(/^(\d+)位[\s　]+(.+?)[\s　]+(\d+[\.\d]*%)/);
            if (rankMatch) {
                flushBlock();
                rankBlock = { rank: rankMatch[1], name: rankMatch[2].trim(), pct: rankMatch[3], comments: [] };
                continue;
            }
            // 读者评论：「...」格式
            const commentMatch = trimmed.match(/^「(.+)」$/);
            if (commentMatch && rankBlock) {
                rankBlock.comments.push(commentMatch[1]);
                continue;
            }
            // 其他文字行：如果没有当前 rankBlock，作为说明文放开头
            if (!rankBlock) {
                html += `<div class="magazine-qa-answer" style="color:var(--text-secondary);font-size:13px;margin-bottom:8px;">${this._escHtml(trimmed)}</div>`;
            }
        }
        flushBlock();
        html += '</div>';
        return html;
    },

    // ===== 角色企划正文渲染 =====
    _FEATURE_EMOJIS: { bag: '👜', wardrobe: '👗', camp: '🏕️', food: '🍽️', room: '🛋️', phone: '📱', playlist: '🎵', custom: '✨' },

    _renderFeatureContent(lines, featureLabel, featureKey) {
        // featureKey 优先（enum 不随语言切换）；老数据没 featureKey 时反查 featureLabel → key
        let emoji = featureKey ? this._FEATURE_EMOJIS[featureKey] : null;
        if (!emoji && featureLabel) {
            const reverseKey = Object.entries(this._FEATURE_LABELS).find(([k, v]) => v === featureLabel)?.[0];
            emoji = reverseKey ? this._FEATURE_EMOJIS[reverseKey] : null;
        }
        emoji = emoji || '✨';
        let html = '<div class="magazine-feature-body">';
        // 先把内容按角色分组
        const cards = [];
        let current = null;
        for (const line of lines) {
            const trimmed = this._stripMarkdown(line.trim());
            if (!trimmed) { if (current) current.lines.push(''); continue; }
            if (trimmed.startsWith('◆')) {
                if (current) cards.push(current);
                current = { name: trimmed.replace(/^◆\s*/, '').trim(), lines: [] };
            } else if (current) {
                current.lines.push(trimmed);
            } else {
                // 开头说明文
                html += `<div class="magazine-feature-line">${this._escHtml(trimmed)}</div>`;
            }
        }
        if (current) cards.push(current);

        for (const card of cards) {
            html += `<div class="magazine-feature-card">
                <div class="magazine-feature-card-header">
                    <span class="magazine-feature-card-emoji">${emoji}</span>
                    <span class="magazine-feature-card-name">${this._escHtml(card.name)}</span>
                </div>
                <div class="magazine-feature-card-body">
                    ${card.lines.filter(l => l).map(l => `<div class="magazine-feature-line">${this._escHtml(l)}</div>`).join('')}
                </div>
            </div>`;
        }
        html += '</div>';
        return html;
    },

    // ===== 読者コーナー渲染 =====
    _renderReaderContent(lines) {
        let html = '<div class="magazine-reader-corner">';
        let currentBlock = ''; // 'letter' | 'reply' | ''
        for (const line of lines) {
            const trimmed = this._stripMarkdown(line.trim());
            if (!trimmed) { html += '<div style="height:8px;"></div>'; continue; }
            if (trimmed.startsWith('📮')) {
                html += `<div class="magazine-reader-letter-header">${this._escHtml(trimmed)}</div>`;
                currentBlock = 'letter';
            } else if (trimmed.startsWith('📝')) {
                html += `<div class="magazine-reader-reply-header">${this._escHtml(trimmed)}</div>`;
                currentBlock = 'reply';
            } else if (currentBlock === 'letter') {
                html += `<div class="magazine-reader-letter">${this._escHtml(trimmed)}</div>`;
            } else if (currentBlock === 'reply') {
                html += `<div class="magazine-reader-reply">${this._escHtml(trimmed)}</div>`;
            } else {
                html += `<div class="magazine-feature-line">${this._escHtml(trimmed)}</div>`;
            }
        }
        html += '</div>';
        return html;
    },

    // ===== キャラ対談渲染 =====
    _renderCharaTalkContent(lines) {
        let html = '<div class="magazine-charatalk-body">';
        for (const line of lines) {
            const trimmed = this._stripMarkdown(line.trim());
            if (!trimmed) { html += '<div style="height:6px;"></div>'; continue; }
            // 匹配 [キャラ名]「台词」 或 キャラ名「台词」
            const talkMatch = trimmed.match(/^(?:\[([^\]]+)\]|([^「]+))「(.+)」?$/);
            if (talkMatch) {
                const name = (talkMatch[1] || talkMatch[2] || '').trim();
                const dialogue = (talkMatch[3] || '').replace(/」$/, '');
                html += `<div class="magazine-charatalk-line"><span class="magazine-charatalk-name">${this._escHtml(name)}</span>「${this._escHtml(dialogue)}」</div>`;
            } else {
                // 旁白/导入文
                html += `<div class="magazine-charatalk-narration">${this._escHtml(trimmed)}</div>`;
            }
        }
        html += '</div>';
        return html;
    },

    // ===== 相関図ビジュアル渲染 =====
    _CHART_COLORS: ['#E91E63', '#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#00BCD4', '#F44336', '#3F51B5', '#009688', '#FF5722'],

    _renderChartContent(lines) {
        // Parse relationships from text
        const charColorMap = {};
        let colorIdx = 0;
        const getColor = (name) => {
            if (!charColorMap[name]) {
                charColorMap[name] = this._CHART_COLORS[colorIdx % this._CHART_COLORS.length];
                colorIdx++;
            }
            return charColorMap[name];
        };

        const relationships = [];
        const editorialNotes = [];
        for (const line of lines) {
            const trimmed = this._stripMarkdown(line.trim());
            if (!trimmed) continue;
            if (trimmed.startsWith('◆')) {
                const relMatch = trimmed.match(/^◆\s*(.+?)\s*(⇔|→|←|↔)\s*(.+?)[：:](.+)$/);
                if (relMatch) {
                    const charA = relMatch[1].trim();
                    const charB = relMatch[3].trim();
                    getColor(charA);
                    getColor(charB);
                    relationships.push({
                        charA, charB,
                        arrow: relMatch[2],
                        desc: relMatch[4].trim()
                    });
                }
            } else if (trimmed.startsWith('※')) {
                editorialNotes.push(trimmed);
            }
        }

        const charNames = Object.keys(charColorMap);
        if (charNames.length === 0) return `<div class="magazine-chart-body"><div class="magazine-feature-line">${I18n.t('mag.no_data', 'No data')}</div></div>`;

        // ── SVG Layout ──
        const svgW = 360, svgH = Math.max(300, charNames.length * 50 + 60);
        const cx = svgW / 2, cy = svgH / 2;
        const radius = Math.min(svgW, svgH) * 0.35;

        // Position chars in a circle
        const positions = {};
        charNames.forEach((name, i) => {
            const angle = (2 * Math.PI * i / charNames.length) - Math.PI / 2;
            positions[name] = {
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle)
            };
        });

        // Build SVG
        let svg = `<svg viewBox="0 0 ${svgW} ${svgH}" class="mag-chart-svg" xmlns="http://www.w3.org/2000/svg">`;
        svg += `<defs>
            <marker id="mag-arrow-end" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="var(--text-secondary,#8391a3)"/></marker>
            <marker id="mag-arrow-start" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto"><polygon points="8 0, 0 3, 8 6" fill="var(--text-secondary,#8391a3)"/></marker>
        </defs>`;

        // Draw edges
        relationships.forEach((rel, idx) => {
            const pA = positions[rel.charA];
            const pB = positions[rel.charB];
            if (!pA || !pB) return;

            // Shorten line to not overlap nodes
            const dx = pB.x - pA.x, dy = pB.y - pA.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const nodeR = 22;
            const ux = dx / dist, uy = dy / dist;
            const x1 = pA.x + ux * nodeR, y1 = pA.y + uy * nodeR;
            const x2 = pB.x - ux * nodeR, y2 = pB.y - uy * nodeR;

            // Arrow markers
            let markerAttr = '';
            if (rel.arrow === '→') markerAttr = 'marker-end="url(#mag-arrow-end)"';
            else if (rel.arrow === '←') markerAttr = 'marker-start="url(#mag-arrow-start)"';
            else if (rel.arrow === '⇔' || rel.arrow === '↔') markerAttr = 'marker-start="url(#mag-arrow-start)" marker-end="url(#mag-arrow-end)"';

            svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--text-tertiary,#a8b4c0)" stroke-width="1.5" ${markerAttr}/>`;

            // Edge label
            const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
            // Offset label slightly perpendicular to line
            const perpX = -uy * 10, perpY = ux * 10;
            const shortDesc = rel.desc.length > 12 ? rel.desc.slice(0, 12) + '…' : rel.desc;
            svg += `<text x="${mx + perpX}" y="${my + perpY}" text-anchor="middle" dominant-baseline="central" font-size="10" fill="var(--text-secondary,#8391a3)" class="mag-chart-svg-label">${this._escHtml(shortDesc)}</text>`;
        });

        // Draw nodes
        charNames.forEach(name => {
            const pos = positions[name];
            const color = charColorMap[name];
            const letter = name.charAt(0);
            svg += `<circle cx="${pos.x}" cy="${pos.y}" r="20" fill="${color}" opacity="0.15" stroke="${color}" stroke-width="2"/>`;
            svg += `<text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="700" fill="${color}">${this._escHtml(letter)}</text>`;
            svg += `<text x="${pos.x}" y="${pos.y + 28}" text-anchor="middle" font-size="11" font-weight="600" fill="var(--text-primary,#3a4a5c)">${this._escHtml(name)}</text>`;
        });

        svg += `</svg>`;

        // Below SVG: detailed list (keep text fallback for full descriptions)
        let detailHtml = '<div class="mag-chart-detail-list">';
        relationships.forEach(rel => {
            const colorA = charColorMap[rel.charA];
            const colorB = charColorMap[rel.charB];
            detailHtml += `<div class="mag-chart-pair">
                <div class="mag-chart-node">
                    <div class="mag-chart-avatar" style="--node-color:${colorA};">${this._escHtml(rel.charA.charAt(0))}</div>
                    <div class="mag-chart-name">${this._escHtml(rel.charA)}</div>
                </div>
                <div class="mag-chart-edge">
                    <div class="mag-chart-arrow">${rel.arrow}</div>
                    <div class="mag-chart-desc">${this._escHtml(rel.desc)}</div>
                </div>
                <div class="mag-chart-node">
                    <div class="mag-chart-avatar" style="--node-color:${colorB};">${this._escHtml(rel.charB.charAt(0))}</div>
                    <div class="mag-chart-name">${this._escHtml(rel.charB)}</div>
                </div>
            </div>`;
        });
        detailHtml += '</div>';

        let editHtml = editorialNotes.map(n => `<div class="mag-chart-editorial">${this._escHtml(n)}</div>`).join('');

        return `<div class="magazine-chart-body">${svg}${detailHtml}${editHtml}</div>`;
    },

    // ===== 翻译全文 =====
    async translateArticle(articleId) {
        const data = AppState.data.magazineData;
        const article = (data.articles || []).find(a => a.id === articleId);
        if (!article) return;

        // 找到翻译按钮换成 loading
        const btn = document.getElementById('magazineTranslateBtn');
        if (btn) { btn.textContent = I18n.t('mag.translating', '翻译中...'); btn.disabled = true; }

        try {
            const _tlHints = {
                seiyuu: 'これは声優インタビュー（Q&A形式）です。質問行は――で始まります。「——質問内容」の形式で翻訳してください。Q&A構造を維持し、受訪者名は原文のまま残すこと。',
                staff: 'これは制作スタッフインタビュー（Q&A形式）です。質問行は――で始まります。「——質問内容」の形式で翻訳してください。Q&A構造を維持し、受訪者名は原文のまま残すこと。',
                roundtable: 'これは座談会（複数人対談Q&A形式）です。質問行は――で始まります。「——質問内容」の形式で翻訳してください。Q&A構造を維持し、発言者名は原文のまま残すこと。',
                column: 'これはプロデューサー/脚本家のコラムエッセイです。段落構造と一人称の語調を維持すること。',
                reader: 'これは雑誌の読者お便りコーナーです。📮で始まるのが読者の手紙、📝で始まるのが編集部の返信です。これらの記号を保持し、手紙/返信の語調の違いを維持すること。',
                charatalk: 'これはキャラクター対談企画（キャラクター本人の対話）です。「」の対話形式を維持し、キャラクター名は原文のまま残すこと。ナレーション/地の文も翻訳すること。',
                chart: 'これはキャラクター相関図です。◆と矢印（⇔/→）の形式を維持し、キャラクター名は原文のまま残すこと。関係性の描写と編集部注を翻訳すること。',
                poll: 'これはキャラクター人気投票結果です。ランキング形式（X位）を維持し、「」内の読者コメントを翻訳すること。',
                feature: 'これはキャラクター企画特集です。◆キャラクター名の形式を維持し、キャラクター名は原文のまま残すこと。',
            };
            const typeHint = _tlHints[article.type] || '原文の構造を維持すること。';
            const systemPrompt = `あなたはプロの日中アニメ翻訳者です。以下の日本語雑誌記事を完全に翻訳してください。
出力は中国語（簡体字）で書くこと。
タイプ別ヒント：${typeHint}
要件：
- 内容を一切省略せず、完全に翻訳すること
- 訳文は自然で口語的に、原文の雰囲気を保つこと
- 訳文のみを出力し、説明は一切不要`;

            const messages = [{ role: 'user', content: article.content }];
            const translation = await Utils.callChatAPI(messages, systemPrompt);

            article.translation = translation.trim();
            Utils.saveData();

            // 刷新阅读器（会自动展示翻译块）
            this.renderReader();
        } catch (e) {
            Utils.showToast(I18n.t('t.mag_translate_failed', '翻译失败：') + e.message);
            if (btn) { btn.textContent = I18n.t('mag.translate_full', '翻译全文'); btn.disabled = false; }
        }
    },

    // ===== 存入论坛（先 AI 压缩为 ~300 字摘要，再存为官方情报）=====
    async saveToForum(articleId) {
        const data = AppState.data.magazineData;
        const article = (data.articles || []).find(a => a.id === articleId);
        if (!article) return;
        if (article.savedToForumId) { Utils.showToast(I18n.t('t.mag_already_saved', 'すでに放送局に保存されています')); return; }

        const forumData = AppState.data.forumData;
        if (!forumData) { Utils.showToast(I18n.t('t.mag_forum_not_init', '放送局が初期化されていません')); return; }
        if (!AppState.data.broadcast.officialInfo) AppState.data.broadcast.officialInfo = [];

        const saveBtn = document.getElementById('magazineSaveForumBtn');
        if (saveBtn) { saveBtn.textContent = I18n.t('mag.summarizing', '要約中...'); saveBtn.disabled = true; }

        try {
            let summary, category, sourceNpcIds;

            if (article.type === 'poll' || article.type === 'reader' || article.type === 'chart') {
                // 结构化内容：保留原文前 600 字，不压缩
                summary = article.content.slice(0, 600);
                category = 'setting';
                sourceNpcIds = [];
            } else if (article.type === 'charatalk') {
                // キャラ対談：AI 压缩，保留「」对白格式 + 各角色立场
                const npcNames = this._getNpcNames(article.npcIds || []);
                const systemPrompt = `あなたはアニメ雑誌のキャラ対談整理アシスタントです。以下のキャラクター対談を約350字の要約に圧縮してください。フォーラムでファンが議論する際の参考資料として使用されます。
出力は中国語（簡体字）で書くこと。
要件：
- 冒頭の一文で対談の登場キャラクターとテーマを説明すること
- 各キャラクターの最も特徴的な発言・立場を「」付きで原文（日本語）のまま 1-2 句残すこと（キャラクターの口調を失わないため）
- 残りはキャラクター間のやり取りの流れ・対立点・笑いどころを中国語で要約すること
- 350字以内に厳守すること
- 要約本文のみを出力し、タイトルや説明は不要`;
                const messages = [{ role: 'user', content: `登場キャラ：${npcNames}\n主题：${article.theme}\n\n${article.content}` }];
                summary = (await Utils.callChatAPI(messages, systemPrompt)).trim();
                category = 'setting';
                sourceNpcIds = article.npcIds || [];
            } else if (article.type === 'feature') {
                // 角色企划：AI 压缩，保留人物关系/设定亮点
                const systemPrompt = `あなたはアニメ雑誌のキャラ企画整理アシスタントです。以下のキャラクター特集ページを約300字の要約に圧縮してください。フォーラムでファンが議論する際の参考資料として使用されます。
出力は中国語（簡体字）で書くこと。
要件：
- 冒頭の一文で企画テーマを説明すること
- 取り上げられたキャラクター・設定・関係性のハイライトを 2〜3 点抽出すること
- 日本語原文のニュアンスを保つこと（重要な固有名詞・キャッチコピーは原文のまま残してよい）
- 300字以内に厳守すること
- 要約本文のみを出力し、タイトルや説明は不要`;
                const messages = [{ role: 'user', content: `企画テーマ：${article.theme}\n\n${article.content}` }];
                summary = (await Utils.callChatAPI(messages, systemPrompt)).trim();
                category = 'setting';
                sourceNpcIds = [];
            } else if (article.type === 'column') {
                // コラム：AI 压缩摘要，保留作者 NPC
                const npcNames = this._getNpcNames(article.npcIds || []);
                const systemPrompt = `あなたはアニメ雑誌の整理アシスタントです。以下のプロデューサーコラムを約300字の要約に圧縮してください。フォーラムでファンが議論する際の参考資料として使用されます。
出力は中国語（簡体字）で書くこと。
要件：
- 冒頭の一文でコラムの筆者とテーマを説明すること
- 最も価値のある制作裏話や見解を2〜3点抽出すること
- 日本語原文のスタイルを保つこと
- 300字以内に厳守すること
- 要約本文のみを出力し、タイトルや説明は不要`;
                const messages = [{ role: 'user', content: `筆者：${npcNames}\n主题：${article.theme}\n\n${article.content}` }];
                summary = (await Utils.callChatAPI(messages, systemPrompt)).trim();
                category = 'interview';
                sourceNpcIds = article.npcIds || [];
            } else {
                // 访谈：AI 压缩摘要 ~300字
                const npcNames = this._getNpcNames(article.npcIds || []);
                const systemPrompt = `あなたはアニメ雑誌のインタビュー整理アシスタントです。以下のインタビューを約300字の要約に圧縮してください。フォーラムでファンが議論する際の参考資料として使用されます。
出力は中国語（簡体字）で書くこと。
要件：
- 冒頭の一文で受訪者とインタビューテーマを説明すること
- 最も価値のあるQ&Aのハイライトを2〜4点抽出すること（受訪者の発言の中で最も印象的な部分を残し、適宜短縮してよい）
- 日本語原文のスタイルを保つこと
- 300字以内に厳守すること
- 要約本文のみを出力し、タイトルや説明は不要`;
                const messages = [{ role: 'user', content: `受访者：${npcNames}\n主题：${article.theme}\n\n${article.content}` }];
                summary = (await Utils.callChatAPI(messages, systemPrompt)).trim();
                category = 'interview';
                sourceNpcIds = article.npcIds || [];
            }

            const officialInfo = {
                id: Utils.generateId(),
                category,
                title: article.title,
                content: summary,
                afterPlotId: article.afterPlotId || null,
                timestamp: Date.now(),
                sourceNpcIds,
                sourceNpcId: null
            };

            AppState.data.broadcast.officialInfo.push(officialInfo);
            article.savedToForumId = officialInfo.id;
            Utils.saveData();
            if (typeof Forum !== 'undefined') Forum.renderOfficialInfoList?.();

            // 中文圈情报站汉化搬运：用户存入放送局 = 认可翻译质量 = 该曝光
            // info_station 类 NPC 静默生成搬运博文（零 token 模板、池空跳过、同篇去重）
            if (typeof Weibo !== 'undefined' && Weibo._maybeBroadcastArticleAsWeibo) {
                Weibo._maybeBroadcastArticleAsWeibo(article, summary);
            }

            // 人气投票：保存后提示可去论坛生成讨论帖
            if (article.type === 'poll') {
                Utils.showToast(I18n.t('t.mag_saved_poll', '✓ 人気投票を放送局に保存しました。論壇でスレを生成すると投票結果への反応帖が現れます！'));
            } else {
                Utils.showToast(I18n.t('t.mag_saved_official', '✓ 放送局の公式情報に保存しました'));
            }
            if (saveBtn) { saveBtn.textContent = I18n.t('mag.saved_to_broadcast_short', '✓ 放送局に保存済み'); saveBtn.disabled = true; }
        } catch (e) {
            Utils.showToast(I18n.t('t.mag_save_failed', '保存失败：') + e.message);
            if (saveBtn) { saveBtn.textContent = I18n.t('magazine.save_to_broadcast', '放送局に保存'); saveBtn.disabled = false; }
        }
    },

    // ===== 修改分类 =====
    changeArticleType(articleId, newType) {
        const data = AppState.data.magazineData;
        const article = (data.articles || []).find(a => a.id === articleId);
        if (!article) return;
        article.type = newType;
        Utils.saveData();
        Utils.showToast(I18n.t('t.mag_type_changed', '✓ 種別を変更しました'));
    },

    // ===== 删除 =====
    deleteArticle(articleId) {
        if (!confirm(I18n.t('magazine.confirm_delete', 'この記事を削除しますか？'))) return;
        const data = AppState.data.magazineData;
        data.articles = (data.articles || []).filter(a => a.id !== articleId);
        Utils.saveData();
        Utils.showToast(I18n.t('t.mag_deleted', '削除しました'));
        Navigation.back('magazine');
    },

    // ===== 辅助方法 =====
    _getNpcNames(npcIds) {
        const npcs = AppState.data.broadcast.officialNpcs || [];
        return npcIds.map(id => {
            const n = npcs.find(n => n.id === id);
            return n ? `${n.role}${n.name ? '・' + n.name : ''}` : '';
        }).filter(Boolean).join(' × ');
    },

    _timeAgo(ts) {
        if (!ts) return '';
        const diff = Date.now() - ts;
        const m = Math.floor(diff / 60000);
        const h = Math.floor(diff / 3600000);
        const d = Math.floor(diff / 86400000);
        if (m < 1) return I18n.t('mag.timeago_now', 'たった今');
        if (m < 60) return I18n.t('mag.timeago_min', { n: m });
        if (h < 24) return I18n.t('mag.timeago_hour', { n: h });
        return I18n.t('mag.timeago_day', { n: d });
    },

    // 去除 AI 输出的 Markdown 格式符（**bold** / *italic* / `code` / 行首列表符）
    _stripMarkdown(str) {
        return String(str || '')
            .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')  // ***bold+italic***
            .replace(/\*\*([^*]+)\*\*/g, '$1')       // **bold**
            .replace(/\*([^*]+)\*/g, '$1')           // *italic*
            .replace(/`([^`]+)`/g, '$1')             // `code`
            .replace(/(^|\n)\*+\s+/g, '$1')          // 行首列表符 "* " 或 "** "
            .replace(/(^|\n)#{1,6}\s+/g, '$1')       // # ## ### 标题符
            .replace(/(^|\n)>\s*/g, '$1')            // > 引用块
            .replace(/(^|\n)\d+\.\s+/g, '$1');       // 有序列表 "1. "
    },

    // ===== 分享面板 =====
    showShareSheet(articleId) {
        const modal = document.getElementById('magazineShareModal');
        if (!modal) return;
        modal.dataset.articleId = articleId;
        modal.classList.add('active');
    },

    closeShareSheet() {
        const modal = document.getElementById('magazineShareModal');
        if (modal) modal.classList.remove('active');
    },

    // ===== 导出 TXT =====
    exportTxt(articleId) {
        const data = AppState.data.magazineData;
        const article = (data.articles || []).find(a => a.id === articleId);
        if (!article) return;

        const typeLabel = this._TYPE_LABELS;
        const magName = data.magazineName || 'Animage';
        const lines = [];
        lines.push(`【${magName}】${article.title || article.theme}`);
        lines.push(`${I18n.t('mag.txt_meta_genre', '種別')}：${typeLabel[article.type] || article.type}`);
        lines.push(`${I18n.t('mag.txt_meta_interviewee', '受訪者')}：${this._getNpcNames(article.npcIds || []) || '—'}`);
        lines.push('');
        lines.push('─'.repeat(30));
        lines.push('');
        lines.push(this._stripMarkdown(article.content || ''));
        if (article.translation) {
            lines.push('');
            lines.push('─'.repeat(30));
            lines.push(I18n.t('mag.txt_zh_translation_header', '【中文翻译】'));
            lines.push('');
            lines.push(this._stripMarkdown(article.translation));
        }

        const text = lines.join('\n');
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(article.title || article.theme || 'interview').slice(0, 30).replace(/[\\/:*?"<>|]/g, '_')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        this.closeShareSheet();
    },

    // ===== 导出长图 =====
    async exportImage(articleId) {
        this.closeShareSheet();
        const data = AppState.data.magazineData;
        const article = (data.articles || []).find(a => a.id === articleId);
        if (!article) return;

        Utils.showToast(I18n.t('t.mag_generating_image', '生成图片中...'));

        // 动态加载 html2canvas
        if (!window.html2canvas) {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
                s.onload = resolve;
                s.onerror = () => reject(new Error(I18n.t('mag.html2canvas_load_failed', 'html2canvas 加载失败，请检查网络')));
                document.head.appendChild(s);
            }).catch(e => { Utils.showToast(e.message); return; });
        }
        if (!window.html2canvas) return;

        const typeLabel = this._TYPE_LABELS;
        const magName = data.magazineName || 'Animage';
        const npcNames = this._getNpcNames(article.npcIds || []);

        // 创建离屏渲染容器
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:390px;background:#faf6f0;font-family:-apple-system,sans-serif;padding-bottom:24px;';

        // 杂志名 header
        const header = document.createElement('div');
        header.style.cssText = 'background:#8b6914;color:white;padding:12px 16px;font-size:18px;font-weight:700;letter-spacing:2px;';
        header.textContent = magName;
        wrap.appendChild(header);

        // 类型 badge + 标题
        const titleBlock = document.createElement('div');
        titleBlock.style.cssText = 'padding:16px 16px 8px;border-bottom:2px solid #8b6914;';
        const badge = document.createElement('span');
        badge.style.cssText = 'font-size:11px;background:#8b6914;color:white;padding:2px 8px;border-radius:4px;margin-bottom:8px;display:inline-block;';
        badge.textContent = typeLabel[article.type] || article.type;
        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'font-size:17px;font-weight:700;color:#3a2a0a;margin-top:6px;line-height:1.4;';
        titleEl.textContent = article.title || article.theme;
        const npcEl = document.createElement('div');
        npcEl.style.cssText = 'font-size:13px;color:#666;margin-top:4px;';
        npcEl.textContent = npcNames || '';
        titleBlock.appendChild(badge);
        titleBlock.appendChild(titleEl);
        if (npcNames) titleBlock.appendChild(npcEl);
        wrap.appendChild(titleBlock);

        // Q&A 正文
        const bodyEl = document.createElement('div');
        bodyEl.style.cssText = 'padding:12px 16px;';
        const lines = (article.content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        lines.forEach(line => {
            const trimmed = this._stripMarkdown(line.trim());
            if (!trimmed) { const gap = document.createElement('div'); gap.style.height = '8px'; bodyEl.appendChild(gap); return; }
            const p = document.createElement('div');
            if (trimmed.startsWith('――') || trimmed.startsWith('——')) {
                p.style.cssText = 'font-size:13px;color:#666;font-style:italic;margin:10px 0 3px;line-height:1.5;';
            } else {
                p.style.cssText = 'font-size:14px;color:#333;line-height:1.7;margin-bottom:4px;';
            }
            p.textContent = trimmed;
            bodyEl.appendChild(p);
        });
        wrap.appendChild(bodyEl);

        document.body.appendChild(wrap);
        try {
            const canvas = await html2canvas(wrap, { scale: 2, useCORS: true, backgroundColor: '#faf6f0' });
            const url = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(article.title || article.theme || 'interview').slice(0, 30).replace(/[\\/:*?"<>|]/g, '_')}.png`;
            a.click();
            Utils.showToast(I18n.t('t.mag_image_saved', '✓ 画像を保存しました'));
        } catch (e) {
            Utils.showToast(I18n.t('t.mag_image_failed', '画像生成失败：') + e.message);
            console.error('[Magazine Export]', e);
        } finally {
            document.body.removeChild(wrap);
        }
    },

    // ===== 封面视觉 =====
    _getVolNum(article) {
        const articles = (AppState.data.magazineData?.articles || []);
        const idx = articles.findIndex(a => a.id === article.id);
        return idx >= 0 ? idx + 1 : articles.length + 1;
    },

    _generateCoverHtml(article) {
        const magName = AppState.data.magazineData?.magazineName || 'Animage';
        const vol = this._getVolNum(article);
        const label = this._TYPE_LABELS[article.type] || article.type;
        const npcNames = this._getNpcNames(article.npcIds || []);
        const subtitle = npcNames || (article.featureLabel ? `[${this._escHtml(article.featureLabel)}]` : '');
        const d = new Date(article.createdAt);
        const dateStr = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
        return `
        <div class="magazine-cover" data-type="${article.type}">
            <div class="magazine-cover-header">
                <span class="magazine-cover-magname">${this._escHtml(magName)}</span>
                <span class="magazine-cover-vol">Vol.${vol}</span>
            </div>
            <span class="magazine-cover-badge">${this._escHtml(label)}</span>
            <div class="magazine-cover-title">${this._escHtml(article.title || article.theme || I18n.t('mag.untitled', '（無題）'))}</div>
            ${subtitle ? `<div class="magazine-cover-subtitle">${this._escHtml(subtitle)}</div>` : ''}
            <div class="magazine-cover-date">${dateStr}</div>
            <div class="magazine-cover-line"></div>
        </div>`;
    },

    // ===== 全杂志导出 =====
    showExportModal() {
        const modal = document.getElementById('magazineExportModal');
        if (modal) modal.classList.add('active');
    },

    exportAllTxt() {
        const data = AppState.data.magazineData;
        const articles = data.articles || [];
        if (articles.length === 0) { Utils.showToast(I18n.t('t.mag_no_articles', '記事がありません')); return; }
        const magName = data.magazineName || 'Animage';
        const lines = [];
        articles.forEach((a, idx) => {
            const vol = idx + 1;
            const label = this._TYPE_LABELS[a.type] || a.type;
            const npc = this._getNpcNames(a.npcIds || []) || '';
            lines.push(`【${magName} Vol.${vol}】`);
            lines.push(`${I18n.t('mag.txt_meta_genre', '種別')}：${label}`);
            lines.push(`${I18n.t('mag.txt_meta_title', '標題')}：${a.title || a.theme || I18n.t('mag.untitled', '（無題）')}`);
            if (npc) lines.push(`${I18n.t('mag.txt_meta_cast', '出演')}：${npc}`);
            lines.push('');
            lines.push('─'.repeat(30));
            lines.push('');
            lines.push(this._stripMarkdown(a.content || ''));
            lines.push('');
            lines.push('═'.repeat(30));
            lines.push('');
        });
        const text = lines.join('\n');
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${magName}_全記事.txt`;
        a.click();
        URL.revokeObjectURL(url);
        document.getElementById('magazineExportModal')?.classList.remove('active');
        Utils.showToast(I18n.t('t.mag_text_saved', '✓ テキストを保存しました'));
    },

    exportAllHtml() {
        const data = AppState.data.magazineData;
        const articles = data.articles || [];
        if (articles.length === 0) { Utils.showToast(I18n.t('t.mag_no_articles', '記事がありません')); return; }
        const magName = data.magazineName || 'Animage';

        // Build self-contained HTML
        let pagesHtml = '';
        articles.forEach((article, idx) => {
            pagesHtml += this._buildPrintableArticleHtml(article, idx + 1, magName);
        });

        // Table of contents
        let tocHtml = `<div class="print-page print-toc"><h2 style="text-align:center;margin-bottom:20px;">${I18n.t('mag.export_html_toc', '目次 ─ Contents')}</h2><table style="width:100%;border-collapse:collapse;">`;
        articles.forEach((a, idx) => {
            const label = this._TYPE_LABELS[a.type] || a.type;
            tocHtml += `<tr style="border-bottom:1px solid #ddd;"><td style="padding:8px 4px;font-size:13px;color:#888;width:50px;">Vol.${idx+1}</td><td style="padding:8px 4px;font-size:13px;">${this._escHtml(a.title || a.theme || I18n.t('mag.untitled', '（無題）'))}</td><td style="padding:8px 4px;font-size:11px;color:#aaa;text-align:right;white-space:nowrap;">${label}</td></tr>`;
        });
        tocHtml += '</table></div>';

        const fullHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${this._escHtml(magName)} — ${I18n.t('mag.export_html_doc_title', '全記事')}</title>
<style>
@page { size: A5; margin: 15mm 12mm; }
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .print-page { page-break-before: always; }
  .print-page:first-child { page-break-before: avoid; }
  .print-no-break { page-break-inside: avoid; }
}
body { font-family: 'Noto Serif JP', 'Noto Serif SC', 'Yu Mincho', 'Hiragino Mincho ProN', serif; color: #222; line-height: 1.8; margin: 0; padding: 0; background: #fff; }
.print-page { padding: 20px; max-width: 148mm; margin: 0 auto; }
/* cover */
.p-cover { position: relative; border-radius: 6px; overflow: hidden; padding: 30px 20px 20px; color: #fff; min-height: 180px; display: flex; flex-direction: column; justify-content: flex-end; margin-bottom: 24px; }
.p-cover::before, .p-cover::after { content: ''; position: absolute; border: 1px solid rgba(255,215,0,0.45); pointer-events: none; }
.p-cover::before { top: 10px; left: 10px; width: 30px; height: 30px; border-right: none; border-bottom: none; }
.p-cover::after { bottom: 10px; right: 10px; width: 30px; height: 30px; border-left: none; border-top: none; }
.p-cover-header { position: absolute; top: 0; left: 0; right: 0; padding: 10px 16px 8px; display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid rgba(255,215,0,0.3); }
.p-cover-magname { font-size: 16px; font-weight: 800; letter-spacing: 2px; color: #ffd700; text-transform: uppercase; font-style: italic; }
.p-cover-vol { font-size: 10px; color: rgba(255,255,255,0.8); font-weight: 600; }
.p-cover-badge { display: inline-block; font-size: 9px; font-weight: 700; letter-spacing: 1px; padding: 2px 8px; border-radius: 3px; background: rgba(255,215,0,0.25); border: 1px solid rgba(255,215,0,0.5); color: #ffd700; margin-bottom: 6px; }
.p-cover-title { font-size: 16px; font-weight: 800; line-height: 1.35; text-shadow: 0 1px 4px rgba(0,0,0,0.4); margin-bottom: 4px; }
.p-cover-subtitle { font-size: 11px; color: rgba(255,255,255,0.85); }
.p-cover-line { position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, rgba(255,215,0,0.6), transparent); }
/* type gradients */
.p-cover[data-type="seiyuu"]   { background: linear-gradient(145deg, #1a0a3e 0%, #2d1b69 40%, #4a2c8a 100%); }
.p-cover[data-type="staff"]    { background: linear-gradient(145deg, #1a2a0a 0%, #2b4a15 40%, #3d6b22 100%); }
.p-cover[data-type="roundtable"]{ background: linear-gradient(145deg, #0a1a2e 0%, #15355a 40%, #1e4f7a 100%); }
.p-cover[data-type="poll"]     { background: linear-gradient(145deg, #3a0a1a 0%, #6b1530 40%, #8a2040 100%); }
.p-cover[data-type="feature"]  { background: linear-gradient(145deg, #0a1a3e 0%, #152b69 40%, #1e3c8a 100%); }
.p-cover[data-type="column"]   { background: linear-gradient(145deg, #1a2a1a 0%, #2b4a2b 40%, #3d6b3d 100%); }
.p-cover[data-type="reader"]   { background: linear-gradient(145deg, #2a1a0a 0%, #4a3015 40%, #6b4520 100%); }
.p-cover[data-type="charatalk"]{ background: linear-gradient(145deg, #2a0a2a 0%, #4a154a 40%, #6b206b 100%); }
.p-cover[data-type="chart"]    { background: linear-gradient(145deg, #0a2a2a 0%, #154a4a 40%, #206b6b 100%); }
/* body text */
.p-body { font-size: 13px; line-height: 1.8; }
.p-body .q { color: #666; font-style: italic; margin: 14px 0 4px; }
.p-body .a { margin-bottom: 4px; }
.p-body .a .name { font-weight: 700; color: #4a3080; }
.p-body .gap { height: 10px; }
.p-body .rank { font-weight: 800; color: #8a2040; font-size: 15px; margin: 12px 0 4px; }
.p-body .comment { font-size: 11px; color: #666; margin-left: 8px; }
.p-body .section-head { font-weight: 700; color: #1e3c8a; margin: 12px 0 4px; }
.p-body .narrator { font-style: italic; color: #888; font-size: 12px; margin-bottom: 6px; }
.p-body .pair { background: #f5f5f5; border-radius: 6px; padding: 8px 10px; margin: 6px 0; font-size: 12px; }
/* page number */
.p-pagenum { text-align: center; font-size: 10px; color: #aaa; margin-top: 20px; letter-spacing: 2px; }
.print-toc h2 { font-size: 16px; letter-spacing: 2px; }
</style>
</head>
<body>
${pagesHtml}
${tocHtml}
</body>
</html>`;

        const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${magName}_印刷用.html`;
        a.click();
        URL.revokeObjectURL(url);
        document.getElementById('magazineExportModal')?.classList.remove('active');
        Utils.showToast(I18n.t('t.mag_html_saved', '✓ 印刷用HTMLを保存しました'));
    },

    _buildPrintableArticleHtml(article, volNum, magName) {
        const label = this._TYPE_LABELS[article.type] || article.type;
        const npcNames = this._getNpcNames(article.npcIds || []);
        const subtitle = npcNames || (article.featureLabel ? `[${this._escHtml(article.featureLabel)}]` : '');
        const d = new Date(article.createdAt);
        const dateStr = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;

        // Cover
        let html = `<div class="print-page">
        <div class="p-cover" data-type="${article.type}">
            <div class="p-cover-header">
                <span class="p-cover-magname">${this._escHtml(magName)}</span>
                <span class="p-cover-vol">Vol.${volNum} · ${dateStr}</span>
            </div>
            <span class="p-cover-badge">${this._escHtml(label)}</span>
            <div class="p-cover-title">${this._escHtml(article.title || article.theme || I18n.t('mag.untitled', '（無題）'))}</div>
            ${subtitle ? `<div class="p-cover-subtitle">${this._escHtml(subtitle)}</div>` : ''}
            <div class="p-cover-line"></div>
        </div>
        <div class="p-body">`;

        // Format body by type
        const lines = (article.content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        lines.forEach(line => {
            const trimmed = this._stripMarkdown(line.trim());
            if (!trimmed) { html += '<div class="gap"></div>'; return; }
            if (article.type === 'poll') {
                const rankMatch = trimmed.match(/^(\d+)位[\s　]+(.+?)[\s　]+(\d+[\.\d]*%)/);
                if (rankMatch) { html += `<div class="rank">${this._escHtml(rankMatch[1])}位　${this._escHtml(rankMatch[2])}　${this._escHtml(rankMatch[3])}</div>`; return; }
                const m = trimmed.match(/^「(.+?)」$/);
                if (m) { html += `<div class="comment">「${this._escHtml(m[1])}」</div>`; return; }
            }
            if (article.type === 'feature' && trimmed.startsWith('◆')) {
                html += `<div class="section-head">${this._escHtml(trimmed)}</div>`; return;
            }
            if (article.type === 'chart' && trimmed.startsWith('◆')) {
                html += `<div class="pair">${this._escHtml(trimmed)}</div>`; return;
            }
            if (article.type === 'charatalk') {
                const dlg = trimmed.match(/^\[?([^\]「]+?)\]?「(.+?)」$/);
                if (dlg) { html += `<div class="a"><span class="name">${this._escHtml(dlg[1])}：</span>「${this._escHtml(dlg[2])}」</div>`; return; }
                if (!trimmed.includes('「')) { html += `<div class="narrator">${this._escHtml(trimmed)}</div>`; return; }
            }
            if (trimmed.startsWith('――') || trimmed.startsWith('——')) {
                html += `<div class="q">${this._escHtml(trimmed)}</div>`; return;
            }
            const nameMatch = trimmed.match(/^([^：:]+)[：:](.*)$/);
            if (nameMatch) {
                html += `<div class="a"><span class="name">${this._escHtml(this._stripMarkdown(nameMatch[1]).trim())}：</span>${this._escHtml(this._stripMarkdown(nameMatch[2]).trim())}</div>`; return;
            }
            html += `<div class="a">${this._escHtml(trimmed)}</div>`;
        });

        html += `</div><div class="p-pagenum">${volNum}</div></div>`;
        return html;
    },

    _escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
};
