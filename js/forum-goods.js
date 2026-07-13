// forum-goods.js — 从 js/forum.js 纯搬运拆出（v2.203.0）。
// 内容零改动；加载顺序：forum.js → generate → npc → goods → plot → tools（见 index.html）。
Object.assign(Forum, {
    // ===== 官方情报管理 =====
    showOfficialInfoModal() {
        this.editingOfficialId = null;
        document.getElementById('officialInfoTitle').value = '';
        const contentEl = document.getElementById('officialInfoContent');
        contentEl.value = '';
        contentEl.style.height = '';
        contentEl.oninput = () => this._autoResizeTextarea(contentEl);
        document.getElementById('officialInfoCategory').value = 'interview';

        // 动态填充"发布时间点"下拉（从当前剧情列表生成）
        const plotProgress = AppState.data.broadcast.plotProgress || [];
        const sel = document.getElementById('officialInfoAfterPlot');
        if (sel) {
            sel.innerHTML = `<option value="">${I18n.t('forum.before_all_plots', '所有剧情之前 / 时机不明')}</option>`;
            plotProgress.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.title;
                sel.appendChild(opt);
            });
            // 默认选最新一集（大多数情报都是最近剧情之后的）
            if (plotProgress.length > 0) sel.value = plotProgress[plotProgress.length - 1].id;
        }

        // 初始化 NPC 选择器（新增时默认 interview，隐藏 NPC 区）
        this._updateNpcSelector('interview');

        // 周边结构化字段：清空 + 刷新来源 datalist
        this._fillGoodsBlock(null);
        this._refreshGoodsSourceList();

        document.getElementById('officialInfoModal').classList.add('active');
    },

    // 刷新周边来源 datalist（已填过的 source 复用）
    _refreshGoodsSourceList() {
        const dl = document.getElementById('goodsSourceList');
        if (!dl) return;
        const sources = [...new Set(
            (AppState.data.broadcast.officialInfo || [])
                .filter(e => e.goods && e.goods.source)
                .map(e => e.goods.source)
        )];
        const _esc = s => Utils.escapeHtml(s || '');
        dl.innerHTML = sources.map(s => `<option value="${_esc(s)}">`).join('');
    },

    // 把周边结构化字段回填到表单（编辑已有周边时用；无 goods 块则留空、状态默认「预告」）
    _fillGoodsBlock(goods) {
        const g = goods || {};
        document.getElementById('goodsName').value = g.name || '';
        document.getElementById('goodsType').value = g.type || 'アクスタ';
        // 盲抽：回填整盒价（boxPrice）；普通：回填单价（price）
        const blindEl = document.getElementById('goodsBlindBox');
        if (blindEl) blindEl.checked = !!g.blindBox;
        const priceVal = g.blindBox ? (g.boxPrice != null ? g.boxPrice : '') : (g.price != null ? g.price : '');
        document.getElementById('goodsPrice').value = priceVal;
        document.getElementById('goodsRarity').value = g.rarity || '通常';
        document.getElementById('goodsStatus').value = g.status || '预告';
        document.getElementById('goodsSource').value = g.source || '';

        // 关联角色：填充 datalist（= 声优角色清单）+ 回填编辑态 chips
        const charList = (typeof Mercari !== 'undefined') ? Mercari.characterList() : [];
        const dl = document.getElementById('goodsCharList');
        if (dl) {
            const _esc = s => this._escapeHtml(s);
            dl.innerHTML = charList.map(c => `<option value="${_esc(c)}">`).join('');
        }
        this._editingGoodsChars = (goods && Array.isArray(goods.charNames)) ? goods.charNames.slice() : [];
        const charInput = document.getElementById('goodsCharInput');
        if (charInput) charInput.value = '';
        this._renderGoodsCharsChips();

        // 追加按钮 + Enter 绑定一次（仿 voiced chars 加钮）
        const addBtn = document.getElementById('goodsCharAddBtn');
        if (addBtn && !addBtn._goodsBound) {
            addBtn._goodsBound = true;
            addBtn.addEventListener('click', () => this._addGoodsChar());
        }
        if (charInput && !charInput._goodsBound) {
            charInput._goodsBound = true;
            charInput.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this._addGoodsChar();
                }
            });
        }

        // 同步盲抽 UI（提醒 / 全选钮 / 整盒价 label / 单抽预览）到当前盲盒态
        this._toggleBlindBox();
    },

    // 从表单读取周边结构化字段块（仅 category==='goods' 时使用）
    _readGoodsBlock() {
        const blindBox = !!document.getElementById('goodsBlindBox')?.checked;
        const chars = this._editingGoodsChars.slice();
        const inputPrice = Number(document.getElementById('goodsPrice').value) || 0;
        const block = {
            name:   document.getElementById('goodsName').value.trim(),
            type:   document.getElementById('goodsType').value,
            price:  inputPrice,
            rarity: document.getElementById('goodsRarity').value,
            status: document.getElementById('goodsStatus').value,
            source: document.getElementById('goodsSource').value.trim(),
            charNames: chars
        };
        // 盲抽套组：用户填的是整盒价（boxPrice），下游一律读单抽价 price = 整盒价 ÷ 角色数
        if (blindBox) {
            block.blindBox = true;
            block.boxPrice = inputPrice;
            const n = chars.length || 1;
            block.price = Math.max(1, Math.round(inputPrice / n));
        }
        return block;
    },

    // 周边关联角色：编辑时临时持有 charNames 数组（仿 _editingVoicedChars 模式）
    _editingGoodsChars: [],

    _renderGoodsCharsChips() {
        const container = document.getElementById('goodsCharChips');
        if (!container) return;
        if (this._editingGoodsChars.length === 0) {
            container.innerHTML = `<span style="font-size:11px; color:var(--text-tertiary);">${I18n.t('forum.goods_chars_empty', '尚未添加')}</span>`;
            return;
        }
        const _esc = s => this._escapeHtml(s);
        const _ariaRemove = I18n.t('forum.chip_remove', '删除');
        container.innerHTML = this._editingGoodsChars.map(n =>
            `<span class="chip"><span class="chip-name">${_esc(n)}</span><button type="button" class="chip-x" data-name="${_esc(n)}" aria-label="${_ariaRemove}">×</button></span>`
        ).join('');
        container.querySelectorAll('.chip-x').forEach(btn => {
            btn.onclick = () => this._removeGoodsChar(btn.dataset.name);
        });
    },

    _addGoodsChar() {
        const input = document.getElementById('goodsCharInput');
        if (!input) return;
        const name = input.value.trim();
        if (!name) return;
        if (this._editingGoodsChars.includes(name)) {
            Utils.showToast(I18n.t('t.forum_char_already_added', '已添加过这个角色'));
            input.value = '';
            return;
        }
        this._editingGoodsChars.push(name);
        input.value = '';
        this._renderGoodsCharsChips();
        this._updateBlindPreview();
    },

    _removeGoodsChar(name) {
        this._editingGoodsChars = this._editingGoodsChars.filter(n => n !== name);
        this._renderGoodsCharsChips();
        this._updateBlindPreview();
    },

    // ── 盲抽套组（ブラインド/一番くじ）UI 联动 ──
    // 切换盲盒态：提醒 / 全选钮显隐 + 定价 label 切「整盒价」+ 刷新单抽预览
    _toggleBlindBox() {
        const on = !!document.getElementById('goodsBlindBox')?.checked;
        const hint = document.getElementById('goodsBlindHint');
        if (hint) hint.style.display = on ? 'block' : 'none';
        const selAll = document.getElementById('goodsCharSelectAll');
        if (selAll) selAll.style.display = on ? 'inline-block' : 'none';
        const lbl = document.getElementById('goodsPriceLabel');
        if (lbl) lbl.textContent = on
            ? I18n.t('forum.goods_boxprice_label', '整盒价 BOX（円）')
            : I18n.t('forum.goods_price_label', '定价（円）');
        this._updateBlindPreview();
    },

    // 单抽价实时预览（整盒价 ÷ 角色数）
    _updateBlindPreview() {
        const prev = document.getElementById('goodsBlindPreview');
        if (!prev) return;
        const on = !!document.getElementById('goodsBlindBox')?.checked;
        if (!on) { prev.style.display = 'none'; return; }
        const box = Number(document.getElementById('goodsPrice').value) || 0;
        const n = this._editingGoodsChars.length;
        if (box > 0 && n > 0) {
            const per = Math.max(1, Math.round(box / n));
            prev.textContent = I18n.t('forum.goods_blind_preview', { per: per.toLocaleString(), n: n });
            prev.style.display = 'block';
        } else if (box > 0) {
            prev.textContent = I18n.t('forum.goods_blind_preview_nochar', '先在下方添加盲盒角色：单抽价 = 整盒价 ÷ 角色数');
            prev.style.display = 'block';
        } else {
            prev.style.display = 'none';
        }
    },

    // 全选：把放送局声优已绑定的角色一键加入盲盒名单（冷门无声优角色仍可手动追加）
    _selectAllGoodsChars() {
        const all = (typeof Mercari !== 'undefined') ? Mercari.characterList() : [];
        if (!all.length) {
            Utils.showToast(I18n.t('t.forum_no_voiced_chars', '还没有声优绑定的角色，请手动输入追加'));
            return;
        }
        all.forEach(n => {
            const name = String(n || '').trim();
            if (name && !this._editingGoodsChars.includes(name)) this._editingGoodsChars.push(name);
        });
        this._renderGoodsCharsChips();
        this._updateBlindPreview();
    },

    addOfficialInfoEntry() {
        let title = document.getElementById('officialInfoTitle').value.trim();
        const content = document.getElementById('officialInfoContent').value.trim();
        const category = document.getElementById('officialInfoCategory').value;
        const afterPlotId = document.getElementById('officialInfoAfterPlot')?.value || null;
        // 周边：标题字段已隐藏，用「周边名」当标题；校验改为「需周边名」（柄图可空、生图缺它仅少视觉种子）
        if (category === 'goods') {
            const gName = document.getElementById('goodsName')?.value.trim();
            if (!gName) { Utils.showToast(I18n.t('forum.goods_name_required', '请填写周边名')); return; }
            title = gName;
        } else if (!content) {
            Utils.showToast(I18n.t('t.forum_content_required', '内容不能为空')); return;
        }

        // 读取 NPC 来源
        let sourceNpcId = null;
        let sourceNpcIds = [];
        if (category === 'twitter') {
            sourceNpcId = document.getElementById('officialInfoNpcSelect')?.value || null;
            if (!sourceNpcId) sourceNpcId = null;
        } else if (category === 'interview') {
            sourceNpcIds = [...(document.querySelectorAll('#officialInfoNpcCheckboxes input[name="npcCheck"]:checked') || [])].map(cb => cb.value);
        }

        const data = AppState.data.forumData;
        if (!AppState.data.broadcast.officialInfo) AppState.data.broadcast.officialInfo = [];

        if (this.editingOfficialId) {
            const entry = AppState.data.broadcast.officialInfo.find(e => e.id === this.editingOfficialId);
            if (entry) {
                entry.title = title;
                entry.content = content;
                entry.category = category;
                entry.afterPlotId = afterPlotId || null;
                entry.sourceNpcId = sourceNpcId;
                entry.sourceNpcIds = sourceNpcIds;
                if (category === 'goods') {
                    entry.goods = this._readGoodsBlock();
                    // pendingRelease 由 goods.status 派生：预告 / 受注中 → 待自动発売
                    entry.pendingRelease = (entry.goods.status === '预告' || entry.goods.status === '受注中');
                    // 発売副本：标题保留「【発売】」前缀（编辑时 title 取自无前缀的周边名，否则注入论坛 prompt 的发售标记会丢）
                    if (entry.isGoodsRelease && entry.goods.name && !entry.goods.name.startsWith('【発売】')) {
                        entry.title = '【発売】' + entry.goods.name;
                    }
                } else {
                    entry.pendingRelease = false;
                    delete entry.goods;
                }
            }
            this.editingOfficialId = null;
            Utils.showToast(I18n.t('t.forum_official_info_updated', '✓ 官方情报已更新'));
        } else {
            const entry = {
                id: Utils.generateId(),
                title,
                content,
                category,
                afterPlotId: afterPlotId || null,
                sourceNpcId,
                sourceNpcIds,
                timestamp: Date.now(),
                pendingRelease: false
            };
            if (category === 'goods') {
                entry.goods = this._readGoodsBlock();
                // pendingRelease 由 goods.status 派生：预告 / 受注中 → 待自动発売
                entry.pendingRelease = (entry.goods.status === '预告' || entry.goods.status === '受注中');
            }
            AppState.data.broadcast.officialInfo.push(entry);
            Utils.showToast(I18n.t('t.forum_official_info_added', '✓ 官方情报已添加'));
        }

        Utils.saveData();
        Utils.emitEvent('official_info_added', 'forum', { title: title, summary: (content || '').slice(0, 80) });
        document.getElementById('officialInfoModal').classList.remove('active');
        this.renderOfficialInfoList();
    },

    editOfficialInfoEntry(entryId) {
        const data = AppState.data.forumData;
        const entry = (AppState.data.broadcast.officialInfo || []).find(e => e.id === entryId);
        if (!entry) return;
        this.editingOfficialId = entryId;
        document.getElementById('officialInfoTitle').value = entry.title;
        const contentEl = document.getElementById('officialInfoContent');
        contentEl.value = entry.content;
        contentEl.oninput = () => this._autoResizeTextarea(contentEl);
        setTimeout(() => this._autoResizeTextarea(contentEl), 50);
        document.getElementById('officialInfoCategory').value = entry.category || 'interview';

        // 先填充下拉，再恢复已保存的选项
        const plotProgress = AppState.data.broadcast.plotProgress || [];
        const sel = document.getElementById('officialInfoAfterPlot');
        if (sel) {
            sel.innerHTML = `<option value="">${I18n.t('forum.before_all_plots', '所有剧情之前 / 时机不明')}</option>`;
            plotProgress.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.title;
                sel.appendChild(opt);
            });
            sel.value = entry.afterPlotId || '';
        }

        // 恢复 NPC 选择
        this._updateNpcSelector(entry.category || 'interview');
        if (entry.category === 'twitter' && entry.sourceNpcId) {
            const npcSel = document.getElementById('officialInfoNpcSelect');
            if (npcSel) npcSel.value = entry.sourceNpcId;
        } else if (entry.category === 'interview' && entry.sourceNpcIds?.length) {
            document.querySelectorAll('#officialInfoNpcCheckboxes input[name="npcCheck"]').forEach(cb => {
                cb.checked = (entry.sourceNpcIds || []).includes(cb.value);
            });
        }

        // 周边结构化字段：每次编辑都归一化表单——goods 用 entry.goods 回填，非 goods 一律清空
        // （防上一会话残值在「编辑非周边→下拉切到周边」时泄漏，被当成标题+整块 goods 数据写入）
        this._fillGoodsBlock(entry.category === 'goods' ? entry.goods : null);
        // 旧式周边（无 goods 块）：用原标题种 goodsName，避免标题被隐藏后丢失 / 卡在「请填周边名」
        if (entry.category === 'goods' && !entry.goods && entry.title) {
            const gn = document.getElementById('goodsName');
            if (gn && !gn.value) gn.value = entry.title;
        }
        this._refreshGoodsSourceList();

        document.getElementById('officialInfoModal').classList.add('active');
    },

    async deleteOfficialInfoEntry(entryId) {
        const list = AppState.data.broadcast.officialInfo || [];
        const entry = list.find(e => e.id === entryId);
        const gid = entry && entry.goods && entry.goods.generatedImageId;
        AppState.data.broadcast.officialInfo = list.filter(e => e.id !== entryId);
        // 商品图引用计数回收：仅当没有其他条目还引用这张图时才删 blob（発売副本与预告条目可能共享同一张）
        if (gid && typeof IllustGallery !== 'undefined') {
            const stillUsed = AppState.data.broadcast.officialInfo.some(o => o.goods && o.goods.generatedImageId === gid);
            if (!stillUsed) { try { await IllustGallery.remove(gid); } catch (e) {} }
        }
        Utils.saveData();
        this.renderOfficialInfoList();
    },

    // ===== 周边 AI 生成方案 =====
    async _aiGenerateGoods() {
        const btn = document.getElementById('goodsAiGenBtn');
        const container = document.getElementById('goodsAiCandidates');
        if (!btn || !container) return;

        btn.disabled = true;
        const _goodsLbl = btn.querySelector('.fch-svg-label');
        if (_goodsLbl) _goodsLbl.textContent = I18n.t('forum.goods_ai_generating', '生成中…');
        else btn.textContent = I18n.t('forum.goods_ai_generating', '生成中…');
        container.innerHTML = '';

        try {
            const data = AppState.data.forumData;
            // 取最近 5 条剧情作为创作依据
            const recentPlots = (AppState.data.broadcast.plotProgress || []).slice(-5);
            const plotText = recentPlots.length > 0
                ? recentPlots.map(p => `・${p.title}：${p.content.slice(0, 80)}`).join('\n')
                : '（暂无剧情信息）';
            const worldSetting = AppState.data.broadcast.worldSetting || '';
            const cpNickname = Broadcast.getCP().cpNickname || '';

            // 取最近 4 条官方情报作为额外灵感（twitter 贺图/活动等）
            const recentInfo = (AppState.data.broadcast.officialInfo || []).slice(-4);
            const infoText = recentInfo.length > 0
                ? recentInfo.map(e => `[${e.category}] ${e.title}：${(e.content || '').slice(0, 60)}`).join('\n')
                : '';

            // グッズ構成タイプ
            const poolType = document.getElementById('goodsPoolType')?.value || 'auto';
            const poolInstruction = poolType === 'single'
                ? '単キャラグッズに集中すること（1商品につき1キャラのみ）。'
                : poolType === 'set'
                    ? '複数キャラセットグッズに集中すること（例：バッジセット、テーマ別アクリルスタンドコレクション等）。'
                    : '単キャラ・複数キャラセットの両方を自然にミックスすること。';

            // 输出语言（用户可在 modal 选择，默认跟随 UI 语言）
            const lang = document.getElementById('goodsAiLang')?.value || 'auto';
            const langSuffix = this._buildLangSuffix(lang);

            const systemPrompt = `あなたは日本のアニメグッズ企画担当です。ストーリー、世界観、最近の公式発表をもとに、ファンが喜ぶグッズ企画を2〜3案生成してください。
感動的なシーン、キャラの象徴、印象的な場面、最近のアート/イベントとのタイアップに注目すること。
${poolInstruction}
架空のブランド名やコラボブランドを捏造しないこと。${langSuffix}

各案は以下のフィールドを必ず出力（フォーマット厳守、余分なテキストなし）：
===GOODS===
NAME: [商品名（簡潔に）]
TYPE: [次のいずれか1つだけ: アクスタ / 缶バッジ / ブロマイド / ぬいぐるみ / タペストリー / その他]
PRICE: [税込価格・日本円の整数のみ（例：1500）]
SOURCE: [コラボ/イベント等の出所。通常商品なら空欄]
PATTERN: [柄図：この商品に描かれる絵柄。キャラ・構図・服装・ポーズ・背景を1〜2文で具体的に]
===GOODS===
NAME: ...
TYPE: ...
PRICE: ...
SOURCE: ...
PATTERN: ...`;

            const userPrompt = `世界観・作品設定：
${worldSetting.slice(0, 300)}
${cpNickname ? `CP: ${cpNickname}` : ''}

最新剧情：
${plotText}
${infoText ? `\n最近の公式情報（ツイート・イベント等）：\n${infoText}` : ''}

上記をもとに、ファンが喜ぶグッズ企画を2〜3案出してください。${(document.getElementById('goodsAiHint')?.value.trim()) ? `\nユーザーの希望：${document.getElementById('goodsAiHint').value.trim()}` : ''}`;

            const raw = await Utils.callChatAPI([{ role: 'user', content: userPrompt }], systemPrompt);

            // Parse ===GOODS=== blocks
            const blocks = raw.split(/={3,}GOODS={3,}/).map(s => s.trim()).filter(Boolean);
            if (blocks.length === 0) throw new Error(I18n.t('forum.goods_ai_parse_failed', '解析失败'));

            const candidates = blocks.map(block => {
                // 单行字段只吃水平空白 [ \t]，不让 \s* 吞掉换行去抓下一行（SOURCE 为空时尤其重要）
                const f = re => { const m = block.match(re); return m ? m[1].trim() : ''; };
                return {
                    name:    f(/^NAME:[ \t]*(.+)$/m),
                    type:    f(/^TYPE:[ \t]*(.+)$/m),
                    price:   f(/^PRICE:[ \t]*(.+)$/m).replace(/[^0-9]/g, ''),
                    source:  f(/^SOURCE:[ \t]*(.*)$/m),
                    pattern: f(/^PATTERN:[ \t]*([\s\S]+)$/m),  // 柄图（图像种子）：^...$/m 锚点防前序字段含字面 PATTERN: 被误抓
                };
            }).filter(c => c.name || c.pattern);

            if (candidates.length === 0) throw new Error(I18n.t('forum.goods_ai_parse_failed', '解析失败'));

            // 存到实例上，供 _fillGoodsFromCandidate 通过索引查找
            this._goodsCandidates = candidates;
            const _esc = s => this._escapeHtml(s);
            const _applyHint = I18n.t('forum.goods_candidate_apply_hint', 'タップして反映 →');
            const _defaultType = I18n.t('forum.goods_candidate_default_type', 'グッズ');
            container.innerHTML = candidates.map((c, i) => `
<div class="goods-candidate-card" onclick="Forum._fillGoodsFromCandidate(${i})">
    <div class="goods-candidate-type">${_esc(c.type || _defaultType)}${c.price ? ' · ¥' + _esc(c.price) : ''}</div>
    <div class="goods-candidate-title">${_esc(c.name)}</div>
    <div class="goods-candidate-content">${_esc(c.pattern)}</div>
    <div class="goods-candidate-hint">${_applyHint}</div>
</div>`).join('');

        } catch (e) {
            container.innerHTML = `<div style="color:var(--danger-color); font-size:12px; padding:8px 0;">${I18n.t('forum.goods_ai_failed', '生成失败，请重试')}</div>`;
            console.error('[AI Goods]', e);
        } finally {
            btn.disabled = false;
            const _goodsRestoreLbl = btn.querySelector('.fch-svg-label');
            if (_goodsRestoreLbl) _goodsRestoreLbl.textContent = I18n.t('forum.goods_ai_gen_btn', 'AI生成方案');
            else btn.textContent = I18n.t('forum.goods_ai_gen_btn', 'AI生成方案');
        }
    },

    _autoResizeTextarea(el) {
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 400) + 'px';
    },

    // LLM 输出的类型文本 → 周边类型下拉的 6 个固定 key（先精确、再关键词、兜底その他）
    _mapGoodsType(raw) {
        const keys = ['アクスタ', '缶バッジ', 'ブロマイド', 'ぬいぐるみ', 'タペストリー', 'その他'];
        if (keys.includes(raw)) return raw;
        const t = String(raw || '');
        if (/アクスタ|アクリル|立牌|スタンド|acryl|stand/i.test(t)) return 'アクスタ';
        if (/缶|バッジ|徽章|badge|pin/i.test(t)) return '缶バッジ';
        if (/ブロマイド|相紙|相纸|写真|生写|bromide|photo/i.test(t)) return 'ブロマイド';
        if (/ぬい|ぐるみ|玩偶|公仔|マスコット|plush|mascot/i.test(t)) return 'ぬいぐるみ';
        if (/タペストリ|挂毯|掛け|wall ?scroll|tapestry|scroll/i.test(t)) return 'タペストリー';
        return 'その他';
    },

    // AI 方案 → 一键填入结构化字段（周边名/类型/定价/来源）+ 柄图（情报内容，也用于生图）
    _fillGoodsFromCandidate(idx) {
        const c = (this._goodsCandidates || [])[idx];
        if (!c) return;
        const setVal = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
        setVal('goodsName', c.name || '');
        const typeEl = document.getElementById('goodsType');
        if (typeEl && c.type) typeEl.value = this._mapGoodsType(c.type);
        if (c.price) setVal('goodsPrice', String(c.price).replace(/[^0-9]/g, ''));
        setVal('goodsSource', c.source || '');
        const contentEl = document.getElementById('officialInfoContent');
        if (contentEl) { contentEl.value = c.pattern || ''; this._autoResizeTextarea(contentEl); }
        // 高亮被选中的卡片
        document.querySelectorAll('.goods-candidate-card').forEach((card, i) => {
            card.classList.toggle('selected', i === idx);
        });
    },

    // ===== 周边商品图生成（手动按钮触发；复用 PixivIllust 生图链路 + CP 参考立绘保人物一致）=====

    // 是否可生成周边商品图：填了图片 API + 显式开启「官方周边」模块（默认关）
    _hasGoodsImageApi() {
        const config = AppState.data.imageApiConfig;
        const modules = AppState.data.imageGenModules || {};
        return !!(config && config.key && config.provider && modules.goods === true);
    },

    // 各周边类型 → 实物「产品形态」英文描述（周边图 ≠ 角色插画：要画成那件实物商品）
    _GOODS_IMG_FORMATS: {
        'アクスタ': 'a die-cut acrylic standee (acrylic stand figure): the character artwork printed on a clear glossy acrylic panel standing upright on a small transparent acrylic base',
        '缶バッジ': 'a round metal pin-back can badge: the character artwork inside a circular glossy tin button with a thin metallic rim',
        'ブロマイド': 'a glossy bromide photo print of the character, photographic glossy print finish with a thin white border',
        'ぬいぐるみ': 'a cute super-deformed (chibi) plush doll of the character: soft stuffed fabric toy, rounded SD proportions, visible stitching and an embroidered face',
        'タペストリー': 'a fabric wall tapestry (B2 tapestry / wall scroll) printed with the character artwork, a hanging cloth banner with a thin rod across the top',
        'その他': 'an official anime merchandise item featuring the character artwork, shown as a clean product photo'
    },

    // 周边商品 + 世界书外观 → 产品照英文 prompt（一框两用：视觉种子= 周边自己的名字 + 描述文案）
    async _buildGoodsImagePrompt(entry) {
        const g = entry.goods || {};
        const type = g.type || 'その他';
        const productFormat = this._GOODS_IMG_FORMATS[type] || this._GOODS_IMG_FORMATS['その他'];
        const name = g.name || entry.title || '';
        const concept = entry.content || '';
        const charNames = (g.charNames || []).filter(Boolean);

        // 世界书匹配角色外观（含非 CP 角色，用文字描述兜底；CP 角色另有参考立绘）
        // 预存外貌 tag 的角色条目（title 精确匹配）剔除——外貌由代码层拼接，省 token
        const storedChars = PixivIllust.getStoredCharTags();
        const storedNames = storedChars.map(c => c.name);
        const searchText = `${name} ${concept} ${charNames.join(' ')}`;
        const wbIds = Utils.getActiveWorldBookIds();
        let charAppearance = '';
        wbIds.forEach(wbId => {
            const book = (AppState.data.worldBooks || []).find(b => b.id === wbId);
            if (book && book.entries) {
                book.entries.filter(e => e.enabled !== false).forEach(e => {
                    if (storedNames.includes((e.title || '').trim())) return;
                    const titleMatch = e.title && searchText.includes(e.title);
                    const keyMatch = (e.keys || []).some(k => k && searchText.includes(k));
                    if (titleMatch || keyMatch) charAppearance += `【${e.title}】${e.content}\n`;
                });
            }
        });
        charAppearance = charAppearance.substring(0, 1200);

        const systemPrompt = `You are a prompt engineer for AI image generation of OFFICIAL ANIME MERCHANDISE product photos.
You will be given a merchandise item (type, name, design concept) and character appearance info.
Output an English image-generation prompt describing a clean PRODUCT PHOTO of this merchandise.

CRITICAL — this is a PHYSICAL MERCHANDISE PRODUCT PHOTO, not a plain character illustration.
The output MUST depict this exact physical product form:
${productFormat}

CRITICAL — Character Separation Format:
When the merchandise features MULTIPLE characters, output in this structured format:
[SCENE] the physical product form, composition, plain studio background, lighting
[CHAR1] first character's appearance (hair, eyes, outfit, gender)
[CHAR2] second character's appearance
When it features ONE or ZERO specific characters, output flat text (no [SCENE]/[CHAR] markers).

Rules:
- Always a clean official product shot: one single product, centered, plain white / light studio background, soft even product lighting.
- Render the character artwork ON / AS the product in the exact physical form described above.
- Extract each character's appearance from the provided character info; keep characters strictly separated in [CHAR] sections.
- Weave in the design concept (pose, outfit, theme) from the item description.
- For a plush (ぬいぐるみ) draw a chibi / SD plush toy, NOT a realistic figure.
- Do NOT put any text, logo, price tag, watermark or signature on the product.
- Natural concise descriptive English (works for gpt-image / Gemini); do NOT output negative-prompt content.${PixivIllust.fixedCharPromptSection(storedChars)}`;

        const userMsg = `Merchandise item:
Type: ${type} (product form: ${productFormat})
Name: ${name}
Design concept: ${concept || '(none)'}
Featured characters: ${charNames.length ? charNames.join(', ') : '(unspecified)'}
${charAppearance ? `\nCharacter appearance database:\n${charAppearance}` : ''}

Generate the product-photo prompt (use [SCENE]/[CHAR1]/[CHAR2] only if multiple characters):`;

        try {
            const raw = await Utils.callChatAPI([{ role: 'user', content: userMsg }], systemPrompt);
            const negative = 'text, watermark, signature, logo, price tag, cluttered background, multiple products, low quality, blurry';
            // [SCENE]/[CHAR] 解析 + 预存外貌 tag 合并（共用逻辑）
            const parsed = PixivIllust.parseTagPromptOutput(raw, storedChars);
            return { positive: parsed.positive, negative, charCaptions: parsed.charCaptions };
        } catch (e) {
            console.error('[Goods ImageGen] Prompt build failed:', e);
            return null;
        }
    },

    // 同源周边条目：自动発売保留原「预告/受注中」条目 + push 一条「贩售中」副本（副本 goods.sourceGoodsId 指回原条目 id）。
    // 商品图应在同源条目间共享，故按 rootId（原条目 id）聚合：原条目 + 所有 sourceGoodsId 指向它的発売副本。
    _linkedGoodsEntries(entry) {
        const all = (AppState.data.broadcast.officialInfo || []).filter(e => e.category === 'goods' && e.goods);
        const rootId = (entry.goods && entry.goods.sourceGoodsId) || entry.id;
        const group = all.filter(e => e.id === rootId || e.goods.sourceGoodsId === rootId);
        return group.length ? group : [entry];  // entry 一定在数组内，兜底防极端情况
    },

    // 手动生成某条周边的商品图
    async _generateGoodsImage(entryId) {
        if (!this._hasGoodsImageApi()) {
            Utils.showToast(I18n.t('forum.goods_img_no_api', '请先在「设置 → 图片生成模块」开启「官方周边」并填好 API'));
            return;
        }
        const entry = (AppState.data.broadcast.officialInfo || []).find(e => e.id === entryId);
        if (!entry || entry.category !== 'goods' || !entry.goods) return;

        // 防并发：同一周边正在生成时拦截（仿刷新锁，纯派生标记）
        if (!this._goodsImgGenerating) this._goodsImgGenerating = {};
        if (this._goodsImgGenerating[entryId]) return;
        this._goodsImgGenerating[entryId] = true;

        const btn = document.querySelector(`.goods-img-btn[data-id="${entryId}"]`);
        if (btn) { btn.disabled = true; btn.classList.add('generating'); }
        Utils.showToast(I18n.t('forum.goods_img_generating', '正在生成商品图…'));

        try {
            const config = AppState.data.imageApiConfig;
            const naiSettings = AppState.data.novelaiSettings || {};
            const prompt = await this._buildGoodsImagePrompt(entry);
            if (!prompt) throw new Error('prompt build failed');

            // 按类型定画幅：徽章 / 玩偶方形，其余竖图（OpenRouter 走 aspect_ratio，gpt-image 走 size）
            const type = entry.goods.type;
            const squareTypes = ['缶バッジ', 'ぬいぐるみ'];
            const imgSize = config.provider === 'novelai'
                ? (naiSettings.resolution || '1024x1024')
                : (squareTypes.includes(type) ? '1024x1024' : '768x1024');

            // 关联角色 → 参考立绘过滤（只取出现在名单里的 CP 主角立绘；空名单 → 不挂立绘，纯文字产品照）
            const refNames = (entry.goods.charNames || []).filter(Boolean);

            let blobs = [];
            switch (config.provider) {
                case 'openai':
                    blobs = await PixivIllust.generateWithOpenAI(prompt.positive, prompt.negative, imgSize, 1, config, prompt.charCaptions);
                    break;
                case 'gpt-image':
                    blobs = await PixivIllust._gptImage(prompt.positive, prompt.negative, imgSize, 1, config, prompt.charCaptions, refNames);
                    break;
                case 'openrouter':
                    blobs = await PixivIllust.generateWithOpenRouter(prompt.positive, prompt.negative, imgSize, 1, config, prompt.charCaptions, refNames);
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
                // 同源条目（预告/受注中 原条目 + 自动発売副本）共享同一张商品图：写到全部链接条目，
                // 这样在任一行点生成，放送局两行 + Mercari（只认贩售中副本）都拿到图，不依赖用户点对行。
                // 生成期间条目可能被删：只保留仍存活在 officialInfo 里的链接条目；整组都没了
                // （_linkedGoodsEntries 只剩兜底的孤儿引用）就丢弃这次生成结果，不写入 IndexedDB
                const liveInfo = AppState.data.broadcast.officialInfo || [];
                const linked = this._linkedGoodsEntries(entry).filter(e => liveInfo.includes(e));
                if (linked.length === 0) return;
                const oldIds = [...new Set(linked.map(e => e.goods.generatedImageId).filter(Boolean))];
                const id = 'goods_img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                await IllustGallery.save(id, blobs[0]);
                linked.forEach(e => { e.goods.generatedImageId = id; });
                Utils.saveData();
                // 引用计数回收旧图：仅当不再被任何条目引用时才删 blob（防共享图被误删致另一条目裂开）
                for (const oldId of oldIds) {
                    if (oldId === id) continue;
                    const stillUsed = (AppState.data.broadcast.officialInfo || []).some(o => o.goods && o.goods.generatedImageId === oldId);
                    if (!stillUsed) { try { await IllustGallery.remove(oldId); } catch (e) {} }
                }
                this.renderOfficialInfoList();
                Utils.showToast(I18n.t('forum.goods_img_done', '✓ 商品图已生成'));
            } else {
                throw new Error('no image returned');
            }
        } catch (e) {
            console.error('[Goods ImageGen]', e);
            Utils.showToast(I18n.t('forum.goods_img_failed', '商品图生成失败，请重试'));
        } finally {
            this._goodsImgGenerating[entryId] = false;
            const btn2 = document.querySelector(`.goods-img-btn[data-id="${entryId}"]`);
            if (btn2) { btn2.disabled = false; btn2.classList.remove('generating'); }
        }
    },

    // 渲染后回填已生成的周边商品图（懒填 src，仿 melonbooks._loadGeneratedCovers）
    async _loadGoodsImages(container) {
        const root = container || document.getElementById('officialInfoList');
        if (!root || typeof IllustGallery === 'undefined') return;
        const imgs = root.querySelectorAll('img[data-illust-id]');
        for (const img of imgs) {
            const id = img.dataset.illustId;
            if (id && !img.getAttribute('src')) {
                try { const url = await IllustGallery.getUrl(id); if (url) img.src = url; }
                catch (e) { console.error('[Goods] load image failed:', id, e); }
            }
        }
    },

    // 商品图全屏查看
    async _viewFullGoodsImage(illustId) {
        if (typeof IllustGallery === 'undefined') return;
        const url = await IllustGallery.getUrl(illustId);
        if (!url) return;
        const overlay = document.createElement('div');
        overlay.className = 'tw-fullimg-overlay';
        overlay.innerHTML = `<img src="${url}" class="tw-fullimg">`;
        overlay.onclick = () => overlay.remove();
        document.body.appendChild(overlay);
    },

    // ===== 剧情 AI 扩写（用户写大纲 → AI 扩成正文）=====
    async _aiGenerateExpandedPlot() {
        const outlineEl = document.getElementById('plotAiOutline');
        const btn = document.getElementById('plotAiExpandBtn');
        const titleEl = document.getElementById('plotTitle');
        const contentEl = document.getElementById('plotContent');
        if (!outlineEl || !btn || !contentEl) return;

        const outline = outlineEl.value.trim();
        if (!outline) {
            Utils.showToast(I18n.t('t.forum_plot_ai_outline_empty', '请先写一些剧情大纲'));
            return;
        }

        const length = document.getElementById('plotAiLength')?.value || 'mid';
        const lang = document.getElementById('plotAiLang')?.value || 'auto';
        const lengthSpec = length === 'short' ? '約300字' : length === 'long' ? '約1500字' : '約800字';

        btn.disabled = true;
        const _expandLbl = btn.querySelector('.fch-svg-label');
        const originalBtnText = _expandLbl ? _expandLbl.textContent : btn.textContent;
        if (_expandLbl) _expandLbl.textContent = I18n.t('forum.plot_ai_expanding', '扩写中…');
        else btn.textContent = I18n.t('forum.plot_ai_expanding', '扩写中…');

        try {
            const worldSetting = AppState.data.broadcast.worldSetting || '';
            const data = AppState.data.forumData || {};
            const cpNickname = Broadcast.getCP().cpNickname || '';
            const recentPlots = (AppState.data.broadcast.plotProgress || []).slice(-5);
            const plotText = recentPlots.length > 0
                ? recentPlots.map(p => `・${p.title}：${p.content.slice(0, 100)}`).join('\n')
                : '（这是第一话）';
            const charContext = (AppState.data.broadcast.officialNpcs || []).map(c => `${c.role}${c.name ? `（${c.name}）` : ''}`).join(' / ') || '（未设置）';

            const titleHint = (titleEl?.value || '').trim();
            const langSuffix = this._buildLangSuffix(lang);

            const systemPrompt = `あなたはアニメ作品の脚本家です。ユーザーの大綱をもとに、自然で読み応えのある剧情本文を執筆してください。

## 作品設定
${worldSetting.slice(0, 400)}
${cpNickname ? `\nCP: ${cpNickname}` : ''}

## 登場キャラ・スタッフ
${charContext}

## 直前の剧情（連続性のため）
${plotText}

## 執筆ルール
- 作品設定 / キャラ / 直前の剧情と矛盾しないこと、人物の語気と物語の連続性を保つこと
- 出力長さ：${lengthSpec}
- マークダウン不可、プレーンテキストのみ
- 章タイトルや見出しを付けず、剧情本文だけを書くこと${langSuffix}`;

            const userPrompt = `${titleHint ? `タイトル：${titleHint}\n` : ''}用户の剧情大綱：
${outline}

上記の大綱をもとに、剧情本文を執筆してください（長さ：${lengthSpec}）。`;

            const raw = await Utils.callChatAPI([{ role: 'user', content: userPrompt }], systemPrompt);
            contentEl.value = raw.trim();
            this._autoResizeTextarea(contentEl);
            Utils.showToast(I18n.t('t.forum_plot_ai_expanded', '✓ 扩写完成，可继续修改细节'));
        } catch (e) {
            console.error('[AI ExpandPlot]', e);
            Utils.showToast(I18n.t('t.forum_plot_ai_failed', '扩写失败：') + (e.message || e));
        } finally {
            btn.disabled = false;
            if (_expandLbl) _expandLbl.textContent = originalBtnText;
            else btn.textContent = originalBtnText;
        }
    },

    // ===== 联动咖啡厅 AI 生成 =====
    async _aiGenerateCafeMenu() {
        const btn = document.getElementById('cafeAiGenBtn');
        const resultDiv = document.getElementById('cafeAiResult');
        const actionsDiv = document.getElementById('cafeAiActions');
        if (!btn || !resultDiv) return;

        btn.disabled = true;
        const _cafeLbl = btn.querySelector('.fch-svg-label');
        if (_cafeLbl) _cafeLbl.textContent = I18n.t('forum.cafe_ai_generating', '生成中…');
        else btn.textContent = I18n.t('forum.cafe_ai_generating', '生成中…');
        resultDiv.style.display = 'none';
        if (actionsDiv) actionsDiv.style.display = 'none';

        try {
            const data = AppState.data.forumData;
            const worldSetting = AppState.data.broadcast.worldSetting || '';
            const cpNickname = Broadcast.getCP().cpNickname || '';
            const recentPlots = (AppState.data.broadcast.plotProgress || []).slice(-3);
            const plotText = recentPlots.map(p => `・${p.title}：${p.content.slice(0, 60)}`).join('\n') || '（暂无）';
            // 从输入框读取用户已填的活动标题/内容作为提示
            const titleHint = (document.getElementById('officialInfoTitle')?.value || '').trim();
            const contentHint = (document.getElementById('officialInfoContent')?.value || '').trim();

            // 输出语言（用户可在 modal 选择，默认跟随 UI 语言）
            const lang = document.getElementById('cafeAiLang')?.value || 'auto';
            const langSuffix = this._buildLangSuffix(lang);

            const systemPrompt = `あなたはクリエイティブな日本のアニメカフェイベント企画者です。イベントに合わせたリアルなコラボカフェメニューとテーマグッズを生成してください。

出力フォーマット（厳守）：
【メニュー】
（食べ物・ドリンクを5〜7品、各1〜2行で。キャラ名や印象的なシーンと結びつけて）

【特典・グッズ】
（ランチョンマット / ランダムコースター / ブロマイド / ファン証 等、3〜4品）

【開催概要（参考）】
（架空の開催期間・場所のイメージ、1〜2行）

プレーンテキストのみ。マークダウン不可。${langSuffix}`;

            const userPrompt = `作品設定：${worldSetting.slice(0, 200)}
${cpNickname ? `CP: ${cpNickname}` : ''}
最近の剧情：${plotText}
${titleHint ? `イベント名（ユーザー入力）：${titleHint}` : ''}
${contentHint ? `補足：${contentHint}` : ''}${(document.getElementById('cafeAiHint')?.value.trim()) ? `\nユーザーの希望：${document.getElementById('cafeAiHint').value.trim()}` : ''}

上記の世界観に合った、リアルなコラボカフェの企画内容を生成してください。`;

            const raw = await Utils.callChatAPI([{ role: 'user', content: userPrompt }], systemPrompt);
            this._cafeMenuText = raw.trim();

            resultDiv.textContent = this._cafeMenuText;
            resultDiv.style.display = 'block';
            if (actionsDiv) actionsDiv.style.display = 'block';
        } catch (e) {
            resultDiv.textContent = I18n.t('forum.cafe_ai_failed', '生成失败：') + e.message;
            resultDiv.style.display = 'block';
            console.error('[AI Cafe]', e);
        } finally {
            btn.disabled = false;
            const _cafeRestoreLbl = btn.querySelector('.fch-svg-label');
            if (_cafeRestoreLbl) _cafeRestoreLbl.textContent = I18n.t('forum.cafe_ai_gen_btn', 'カフェメニューを生成');
            else btn.textContent = I18n.t('forum.cafe_ai_gen_btn', 'カフェメニューを生成');
        }
    },

    _applyCafeMenuToContent() {
        if (!this._cafeMenuText) return;
        const contentEl = document.getElementById('officialInfoContent');
        if (contentEl) {
            contentEl.value = this._cafeMenuText;
            this._autoResizeTextarea(contentEl);
            Utils.showToast(I18n.t('t.forum_reflected_to_content', '✓ 内容欄に反映しました'));
        }
    },

    // ===== 录入剧情后周边快速入口 =====
    _showGoodsQuickBanner() {
        const existing = document.getElementById('goodsQuickBanner');
        if (existing) existing.remove();

        const banner = document.createElement('div');
        banner.id = 'goodsQuickBanner';
        banner.className = 'goods-quick-banner';
        banner.innerHTML = `
<span class="goods-quick-text" style="display:inline-flex;align-items:center;gap:6px;"><svg style="width:14px;height:14px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 9.4 7.5 4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>${I18n.t('forum.goods_banner_text', '顺手发个周边？')}</span>
<button class="glass-btn goods-quick-btn" onclick="Forum._quickOpenGoodsModal(); document.getElementById('goodsQuickBanner').remove()">${I18n.t('forum.goods_banner_btn', '快速发布')}</button>
<button class="goods-quick-close" onclick="document.getElementById('goodsQuickBanner').remove()">×</button>`;
        document.body.appendChild(banner);

        // 入场动画：下一帧加 show 类
        requestAnimationFrame(() => banner.classList.add('show'));

        // 5秒后自动消失
        const timer = setTimeout(() => {
            banner.classList.remove('show');
            setTimeout(() => banner.remove(), 300);
        }, 5000);
        banner.dataset.timer = timer;
    },

    _quickOpenGoodsModal() {
        this.showOfficialInfoModal();
        // 切换到 goods 分类并刷新 UI
        const catSel = document.getElementById('officialInfoCategory');
        if (catSel) {
            catSel.value = 'goods';
            this._updateNpcSelector('goods');
        }
    },

    // 根据情报分类切换 NPC 选择器 UI（twitter=单选，interview=多选，其他=隐藏）
    _updateNpcSelector(category) {
        const npcs = AppState.data.broadcast.officialNpcs || [];
        const section = document.getElementById('officialNpcSection');
        const singleDiv = document.getElementById('officialNpcSingle');
        const multiDiv = document.getElementById('officialNpcMulti');
        if (!section) return;
        const _esc = s => Utils.escapeHtml(s || '');

        if (category === 'twitter') {
            section.style.display = '';
            singleDiv.style.display = '';
            multiDiv.style.display = 'none';
            const sel = document.getElementById('officialInfoNpcSelect');
            sel.innerHTML = `<option value="">${I18n.t('forum.not_specified', '不指定')}</option>` +
                npcs.map(n => `<option value="${_esc(n.id)}">${_esc(n.role)}${n.name ? ' ' + _esc(n.name) : ''}</option>`).join('');
        } else if (category === 'interview') {
            section.style.display = '';
            singleDiv.style.display = 'none';
            multiDiv.style.display = '';
            const div = document.getElementById('officialInfoNpcCheckboxes');
            if (div) {
                div.innerHTML = npcs.length > 0
                    ? npcs.map(n => `
    <label class="npc-checkbox-item">
        <input type="checkbox" name="npcCheck" value="${_esc(n.id)}">
            ${_esc(n.role)}${n.name ? ' ' + _esc(n.name) : ''}
        </label>`).join('')
                    : `<span style="color:#999;font-size:12px;">${I18n.t('forum.npc_empty_hint', '暂无 NPC，请先在设置中添加')}</span>`;
            }
        } else {
            section.style.display = 'none';
        }
        // AI 生成方案区块：仅 goods 类别显示，切换时清空旧候选
        const goodsAiSection = document.getElementById('goodsAiSection');
        if (goodsAiSection) {
            goodsAiSection.style.display = category === 'goods' ? 'block' : 'none';
            if (category !== 'goods') {
                const candidates = document.getElementById('goodsAiCandidates');
                if (candidates) candidates.innerHTML = '';
            }
        }
        // 周边结构化字段区块：仅 goods 类别显示
        const goodsFieldsSection = document.getElementById('goodsFieldsSection');
        if (goodsFieldsSection) {
            goodsFieldsSection.style.display = category === 'goods' ? 'block' : 'none';
        }
        // 周边：隐藏「情报标题」（保存时用周边名当标题）、把「情报内容」切到「柄图·设计」语境（也用于生图）
        const isGoods = category === 'goods';
        const titleEl = document.getElementById('officialInfoTitle');
        if (titleEl) titleEl.style.display = isGoods ? 'none' : '';
        const goodsContentHeader = document.getElementById('goodsContentHeader');
        if (goodsContentHeader) goodsContentHeader.style.display = isGoods ? 'block' : 'none';
        const infoContentEl = document.getElementById('officialInfoContent');
        if (infoContentEl) infoContentEl.placeholder = isGoods
            ? I18n.t('forum.goods_pattern_placeholder', '柄图：这件周边画的是什么（角色 / 构图 / 服装 / 场景）…')
            : I18n.t('forum.info_content_placeholder', '情报内容（粘贴访谈摘要、活动公告、推特内容等）...');
        // カフェメニュー AI区块：仅 event 类别显示，切换时重置
        const cafeAiSection = document.getElementById('cafeAiSection');
        if (cafeAiSection) {
            cafeAiSection.style.display = category === 'event' ? 'block' : 'none';
            if (category !== 'event') {
                const cafeResult = document.getElementById('cafeAiResult');
                const cafeActions = document.getElementById('cafeAiActions');
                if (cafeResult) { cafeResult.textContent = ''; cafeResult.style.display = 'none'; }
                if (cafeActions) cafeActions.style.display = 'none';
            }
        }
    },

    // 官方情报 HTML 转义（收口：转发 Utils.escapeHtml）
    _escapeHtml(s) {
        return Utils.escapeHtml(s || '');
    },

    // 单条情报行渲染（周边以外的五类沿用此布局）
    _renderInfoRow(e, num, isCovered) {
        const _esc = s => this._escapeHtml(s);
        const preview = _esc(e.content.slice(0, 60));
        const displayTitle = _esc(e.title || e.content.slice(0, 25) + (e.content.length > 25 ? '…' : ''));
        // NPC 来源标注
        let npcLabel = null;
        if (e.category === 'twitter' && e.sourceNpcId) {
            npcLabel = this._getNpcLabel([e.sourceNpcId]);
        } else if (e.category === 'interview' && e.sourceNpcIds?.length) {
            npcLabel = this._getNpcLabel(e.sourceNpcIds);
        }
        const npcLabelSafe = npcLabel ? _esc(npcLabel) : null;
        return `
            <div class="plot-entry${isCovered ? ' plot-entry-covered' : ''}">
                    <div class="plot-entry-header">
                        <span class="plot-entry-num">#${num}</span>
                        ${isCovered ? `<span class="plot-summary-badge">${I18n.t('bc.plot_summarized')}</span>` : ''}
                        ${npcLabelSafe ? `<span style="font-size:10px; color:#888; margin-left:4px;">${npcLabelSafe}</span>` : ''}
                        <span class="plot-entry-title" style="margin-left:4px;">${displayTitle}</span>
                        <button class="plot-entry-edit" onclick="event.stopPropagation(); Forum.editOfficialInfoEntry('${e.id}')">✎</button>
                        <button class="plot-entry-del" onclick="event.stopPropagation(); Forum.deleteOfficialInfoEntry('${e.id}')">×</button>
                    </div>
                    <div class="plot-entry-preview">${preview}${e.content.length > 60 ? '...' : ''}</div>
                </div> `;
    },

    // 周边行渲染（行式,与其他五类统一;结构化周边显示属性 meta,旧式周边提示补全）
    _renderGoodsRow(e, num, isCovered) {
        const _esc = s => this._escapeHtml(s);
        const g = e.goods;
        const displayTitle = _esc((g && g.name) || e.title || (e.content || '').slice(0, 25));
        let metaLine;
        if (g) {
            const parts = [`¥${g.price}`, _esc(g.rarity), _esc(g.status)];
            if (g.source) parts.push(_esc(g.source));
            metaLine = parts.join(' ｜ ');
        } else {
            metaLine = I18n.t('forum.goods_meta_old', '旧式周边 · 点 ✎ 补全结构化字段');
        }
        // 商品图：手动生成按钮（仅开启「官方周边」图片生成时显示）+ 已生成缩略图（点开全屏）
        const canGen = !!g && this._hasGoodsImageApi();
        const hasImg = !!(g && g.generatedImageId);
        const _imgSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
        const _regenSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>';
        const genBtn = canGen
            ? `<button class="plot-entry-edit goods-img-btn" data-id="${e.id}" title="${I18n.t(hasImg ? 'forum.goods_img_regen' : 'forum.goods_img_gen', hasImg ? '重新生成商品图' : '生成商品图')}" onclick="event.stopPropagation(); Forum._generateGoodsImage('${e.id}')">${hasImg ? _regenSvg : _imgSvg}</button>`
            : '';
        const thumb = hasImg
            ? `<img class="goods-thumb" data-illust-id="${_esc(g.generatedImageId)}" src="" alt="${displayTitle}" onclick="event.stopPropagation(); Forum._viewFullGoodsImage('${_esc(g.generatedImageId)}')">`
            : '';
        return `
            <div class="plot-entry${isCovered ? ' plot-entry-covered' : ''}">
                    <div class="plot-entry-header">
                        <span class="plot-entry-num">#${num}</span>
                        ${isCovered ? `<span class="plot-summary-badge">${I18n.t('bc.plot_summarized')}</span>` : ''}
                        <span class="plot-entry-title" style="margin-left:4px;">${displayTitle}</span>
                        ${genBtn}
                        <button class="plot-entry-edit" onclick="event.stopPropagation(); Forum.editOfficialInfoEntry('${e.id}')">✎</button>
                        <button class="plot-entry-del" onclick="event.stopPropagation(); Forum.deleteOfficialInfoEntry('${e.id}')">×</button>
                    </div>
                    <div class="goods-row-body">
                        ${thumb}
                        <div class="plot-entry-preview">${metaLine}</div>
                    </div>
                </div> `;
    },

    renderOfficialInfoList() {
        const container = document.getElementById('officialInfoList');
        if (!container) return;
        const entries = AppState.data.broadcast.officialInfo || [];
        const officialSummaries = AppState.data.broadcast.officialSummaries || [];
        const mergedSummaries = AppState.data.broadcast.mergedSummaries || [];
        const coveredSet = new Set([
            ...officialSummaries.flatMap(s => s?.coveredIds || []),
            ...mergedSummaries.flatMap(s => s?.coveredInfoIds || []),
        ]);

        if (entries.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-text">${I18n.t('bc.info_empty')}</div><div class="empty-state-hint">${I18n.t('bc.info_empty_hint')}</div></div>`;
            return;
        }

        // 全局序号映射（按原数组顺序，分组后序号语义不变）
        const numMap = new Map(entries.map((e, i) => [e.id, i + 1]));

        const CAT_ORDER = ['goods', 'interview', 'twitter', 'event', 'setting', 'announcement'];
        let html = '';
        CAT_ORDER.forEach(cat => {
            const items = entries.filter(e => e.category === cat);
            if (!items.length) return;
            const label = (OFFICIAL_CATEGORIES[cat] || {}).display || cat;
            html += `<div class="info-group-title">${this._escapeHtml(label)} <span class="info-group-count">(${items.length})</span></div>`;
            if (cat === 'goods') {
                html += items.map(e => this._renderGoodsRow(e, numMap.get(e.id), coveredSet.has(e.id))).join('');
            } else {
                html += items.map(e => this._renderInfoRow(e, numMap.get(e.id), coveredSet.has(e.id))).join('');
            }
        });
        container.innerHTML = html;
        this._loadGoodsImages(container);  // 回填已生成的周边商品图缩略图
    },

});
