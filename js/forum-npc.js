// forum-npc.js — 从 js/forum.js 纯搬运拆出（v2.203.0）。
// 内容零改动；加载顺序：forum.js → generate → npc → goods → plot → tools（见 index.html）。
Object.assign(Forum, {
    // ===== 官方 NPC 管理 =====
    editingNpcId: null,
    _editingVoicedChars: [], // 编辑时临时持有 voicedCharacters 数组

    // 声優判定：role 包含「声優」/「声优」/「seiyuu」/「CV」其一
    _isSeiyuuRole(role) {
        if (!role) return false;
        const r = String(role).toLowerCase();
        return r.includes('声優') || r.includes('声优') || r.includes('seiyuu') || r.includes('cv');
    },

    // 公式Twitter 判定：role 包含「公式Twitter」/「官方推特」/「official twitter」其一
    _isOfficialTwitterRole(role) {
        if (!role) return false;
        const r = String(role).toLowerCase();
        return r.includes('公式twitter') || r.includes('官方推特') || r.includes('official twitter');
    },

    showNpcModal(npcId = null) {
        this.editingNpcId = npcId;
        const data = AppState.data.forumData;
        let npc = null;
        if (npcId) npc = (AppState.data.broadcast.officialNpcs || []).find(n => n.id === npcId);

        document.getElementById('npcRole').value = npc?.role || '';
        // 旧数据兼容：如果 name 字段本身就是 @xxx 风格、且未单独设置 handle，作为 handle 显示
        let displayName = npc?.name || '';
        let displayHandle = (npc?.handle || '').replace(/^@+/, '');
        if (!displayHandle && /^@[A-Za-z0-9_]+$/.test(displayName.trim())) {
            displayHandle = displayName.trim().slice(1);
            displayName = '';
        }
        document.getElementById('npcName').value = displayName;
        document.getElementById('npcHandle').value = displayHandle;
        document.getElementById('npcVoiceId').value = npc?.voiceId || '';
        const personaEl = document.getElementById('npcPersona');
        if (personaEl) personaEl.value = npc?.persona || '';
        this._editingVoicedChars = Array.isArray(npc?.voicedCharacters) ? [...npc.voicedCharacters] : [];

        const input = document.getElementById('npcVoicedCharsInput');
        if (input) input.value = '';

        this._renderVoicedCharsChips();
        this._toggleVoicedCharsSection();
        this._toggleOfficialTwitterFields();
        this._resetPersonaExtract(); // 提取区每次打开弹窗重置（收起+清空，不留上次的原推文）

        // 角色预置下拉（每次打开按当前语言重建、并确保关闭状态）
        this._buildRoleDropdown();
        const roleDd = document.getElementById('npcRoleDropdown');
        if (roleDd) roleDd.style.display = 'none';

        // 绑定一次 — role 变更时切换 voicedChars 区 / 公式Twitter 字段可见性
        const roleEl = document.getElementById('npcRole');
        if (roleEl && !roleEl._npcBound) {
            roleEl._npcBound = true;
            roleEl.addEventListener('input', () => { this._toggleVoicedCharsSection(); this._toggleOfficialTwitterFields(); });
            roleEl.addEventListener('change', () => { this._toggleVoicedCharsSection(); this._toggleOfficialTwitterFields(); });
        }
        // chips 添加按钮 + Enter
        const addBtn = document.getElementById('npcVoicedCharsAddBtn');
        if (addBtn && !addBtn._npcBound) {
            addBtn._npcBound = true;
            addBtn.addEventListener('click', () => this._addVoicedChar());
        }
        if (input && !input._npcBound) {
            input._npcBound = true;
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this._addVoicedChar();
                }
            });
        }
        document.getElementById('npcModal').classList.add('active');
    },

    _toggleVoicedCharsSection() {
        const role = document.getElementById('npcRole')?.value || '';
        const section = document.getElementById('npcVoicedCharsSection');
        if (section) section.style.display = this._isSeiyuuRole(role) ? 'block' : 'none';
    },

    // 公式Twitter 役職命中时隐藏「氏名」「MiniMax voice ID」字段行（含各自说明文字）；アカウント行始终保留
    _toggleOfficialTwitterFields() {
        const role = document.getElementById('npcRole')?.value || '';
        const hide = this._isOfficialTwitterRole(role);
        const disp = hide ? 'none' : '';
        const nameLabel = document.querySelector('label[data-i18n="forum.npc_name_label"]');
        const nameInput = document.getElementById('npcName');
        const voiceLabel = document.querySelector('label[data-i18n="forum.npc_voice_label"]');
        const voiceInput = document.getElementById('npcVoiceId');
        const voiceHint = document.querySelector('p[data-i18n="forum.npc_voice_hint"]');
        [nameLabel, nameInput, voiceLabel, voiceInput, voiceHint].forEach(el => { if (el) el.style.display = disp; });
    },

    // ===== 角色预置下拉（自定义，替代 iOS Safari 不弹的原生 datalist） =====
    // i18n 角色名 key（早已定义，原 datalist 用硬编码值而未用上）
    _ROLE_PRESET_KEYS: [
        'forum.role_producer', 'forum.role_series_constr', 'forum.role_director',
        'forum.role_writer', 'forum.role_seiyuu', 'forum.role_anim_director',
        'forum.role_storyboard', 'forum.role_official_twitter', 'forum.role_illustrator'
    ],

    _buildRoleDropdown() {
        const dd = document.getElementById('npcRoleDropdown');
        if (!dd) return;
        dd.innerHTML = '';
        this._ROLE_PRESET_KEYS.forEach(k => {
            const v = I18n.t(k);
            const el = document.createElement('div');
            el.className = 'npc-role-opt';
            el.textContent = v;
            el.onclick = (e) => { e.stopPropagation(); this._pickRolePreset(v); };
            dd.appendChild(el);
        });
    },

    _toggleRoleDropdown(e) {
        if (e) e.stopPropagation();
        const dd = document.getElementById('npcRoleDropdown');
        if (!dd) return;
        const willShow = dd.style.display === 'none' || !dd.style.display;
        dd.style.display = willShow ? 'block' : 'none';
        // 点击下拉以外区域关闭（绑定一次，幂等检查 display）
        if (willShow && !this._roleDropdownOutsideBound) {
            this._roleDropdownOutsideBound = true;
            // 箭头包裹保住 this（即便目前 _onRoleDropdownOutside 未用 this，防将来重构踩坑）
            document.addEventListener('click', e => this._onRoleDropdownOutside(e));
        }
    },

    _onRoleDropdownOutside(e) {
        const dd = document.getElementById('npcRoleDropdown');
        if (!dd || dd.style.display === 'none') return;
        const field = dd.closest('.npc-role-field');
        if (field && !field.contains(e.target)) dd.style.display = 'none';
    },

    _pickRolePreset(value) {
        const input = document.getElementById('npcRole');
        if (input) {
            input.value = value;
            // 选「声優」要展开配音角色区；选「公式Twitter」要隐藏氏名/voiceId
            this._toggleVoicedCharsSection();
            this._toggleOfficialTwitterFields();
        }
        const dd = document.getElementById('npcRoleDropdown');
        if (dd) dd.style.display = 'none';
    },

    _addVoicedChar() {
        const input = document.getElementById('npcVoicedCharsInput');
        if (!input) return;
        const name = input.value.trim();
        if (!name) return;
        if (this._editingVoicedChars.includes(name)) {
            Utils.showToast(I18n.t('t.forum_char_already_added', '已添加过这个角色'));
            input.value = '';
            return;
        }
        this._editingVoicedChars.push(name);
        input.value = '';
        this._renderVoicedCharsChips();
    },

    _removeVoicedChar(name) {
        this._editingVoicedChars = this._editingVoicedChars.filter(n => n !== name);
        this._renderVoicedCharsChips();
    },

    _renderVoicedCharsChips() {
        const container = document.getElementById('npcVoicedCharsChips');
        if (!container) return;
        if (this._editingVoicedChars.length === 0) {
            container.innerHTML = `<span style="font-size:11px; color:var(--text-tertiary);">${I18n.t('forum.npc_voiced_chars_empty', '尚未添加')}</span>`;
            return;
        }
        const _esc = s => Utils.escapeHtml(s || '');
        const _ariaRemove = I18n.t('forum.chip_remove', '删除');
        container.innerHTML = this._editingVoicedChars.map(n =>
            `<span class="chip"><span class="chip-name">${_esc(n)}</span><button type="button" class="chip-x" data-name="${_esc(n)}" aria-label="${_ariaRemove}">×</button></span>`
        ).join('');
        container.querySelectorAll('.chip-x').forEach(btn => {
            btn.onclick = () => this._removeVoicedChar(btn.dataset.name);
        });
    },

    saveNpc() {
        const role = document.getElementById('npcRole').value.trim();
        if (!role) { Utils.showToast(I18n.t('t.forum_role_required', '角色不能为空')); return; }
        const name = document.getElementById('npcName').value.trim();
        const handle = document.getElementById('npcHandle').value.trim().replace(/^@+/, '');
        const voiceId = document.getElementById('npcVoiceId').value.trim();
        const persona = (document.getElementById('npcPersona')?.value || '').trim();
        const isSeiyuu = this._isSeiyuuRole(role);
        const isOfficial = this._isOfficialTwitterRole(role);
        // 提醒：声優角色在配音角色输入框打了字却没点「追加」就保存 —— 提示别误丢
        // （不自动追加，保留「必须显式追加」的设计；让用户确认后再保存）
        if (isSeiyuu) {
            const vcInput = document.getElementById('npcVoicedCharsInput');
            if (vcInput && vcInput.value.trim()) {
                Utils.showToast(I18n.t('forum.npc_voiced_chars_pending', '「配音角色」还没点「追加」，确认后再保存哦'));
                vcInput.focus();
                return;
            }
        }
        const voicedCharacters = isSeiyuu ? [...this._editingVoicedChars] : [];

        const data = AppState.data.forumData;
        if (!AppState.data.broadcast.officialNpcs) AppState.data.broadcast.officialNpcs = [];
        if (this.editingNpcId) {
            const npc = AppState.data.broadcast.officialNpcs.find(n => n.id === this.editingNpcId);
            if (npc) {
                npc.role = role;
                npc.name = isOfficial ? '' : name;
                npc.handle = handle || undefined;
                npc.voiceId = isOfficial ? undefined : (voiceId || undefined);
                npc.voicedCharacters = voicedCharacters.length ? voicedCharacters : undefined;
                npc.persona = persona || undefined;
            }
            this.editingNpcId = null;
        } else {
            const newNpc = { id: Utils.generateId(), role, name: isOfficial ? '' : name };
            if (handle) newNpc.handle = handle;
            if (!isOfficial && voiceId) newNpc.voiceId = voiceId;
            if (voicedCharacters.length) newNpc.voicedCharacters = voicedCharacters;
            if (persona) newNpc.persona = persona;
            AppState.data.broadcast.officialNpcs.push(newNpc);
        }
        this._editingVoicedChars = [];
        Utils.saveData();
        document.getElementById('npcModal').classList.remove('active');
        this.renderNpcList();
    },

    deleteNpc(npcId) {
        if (!confirm(I18n.t('forum.confirm_delete_npc', '确定要删除此 NPC 吗？'))) return;
        const data = AppState.data.forumData;
        const npc = (AppState.data.broadcast.officialNpcs || []).find(n => n.id === npcId);
        if (npc) {
            // 已实体化的 LINE 好友（懒实体化三件套 lineCharId / sourceType / sourceNpcId）删除源 NPC 前先把人设拷回本地副本，
            // 否则角色会瞬间失忆变空壳——降级为普通好友但保留人格
            const chars = AppState.data.characters || [];
            const char = chars.find(c => c.id === npc.lineCharId) || chars.find(c => c.sourceType === 'official-npc' && c.sourceNpcId === npcId);
            if (char) {
                char.personality = char.personality || npc.persona || '';
                delete char.sourceNpcId;
                delete char.sourceType;
            }
            const officialPersonaPrefix = (typeof LineHome !== 'undefined' ? LineHome.OFFICIAL_PERSONA_PREFIX : 'officialnpc:');
            if (AppState.data.activePersonaId === officialPersonaPrefix + npcId) {
                AppState.data.activePersonaId = (AppState.data.myPersonaPresets || [])[0]?.id || null;
            }
        }
        AppState.data.broadcast.officialNpcs = (AppState.data.broadcast.officialNpcs || []).filter(n => n.id !== npcId);
        Utils.saveData();
        this.renderNpcList();
    },

    renderNpcList() {
        const container = document.getElementById('npcList');
        if (!container) return;
        const npcs = AppState.data.broadcast.officialNpcs || [];
        if (npcs.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-text">${I18n.t('bc.npc_empty')}</div><div class="empty-state-hint">${I18n.t('bc.npc_empty_hint')}</div></div>`;
            return;
        }
        const _esc = s => Utils.escapeHtml(s || '');
        container.innerHTML = npcs.map(n => {
            const handleStr = n.handle ? ` <span style="color:var(--text-tertiary); font-size:12px; font-weight:normal;">@${_esc(n.handle)}</span>` : '';
            return `
    <div class="plot-entry">
        <div class="plot-entry-header">
            <span class="official-cat-badge" style="background:#888; font-size:10px;">${_esc(n.role)}</span>
            <span class="plot-entry-title" style="margin-left:4px;">${_esc(n.name) || I18n.t('bc.npc_anon')}${handleStr}</span>
            <button class="plot-entry-edit" onclick="event.stopPropagation(); Forum.showNpcModal('${n.id}')">✎</button>
            <button class="plot-entry-del" onclick="event.stopPropagation(); Forum.deleteNpc('${n.id}')">×</button>
        </div>
    </div>
    `;
        }).join('');
    },

    // ===== 发言风格 AI 提取（v2.201.0）=====
    // 输入：粘贴的推文原文 和/或 截图（多模态，≤3张）。输出：风格描述文本，追加进人设 textarea（用户确认后保存才落库）。
    // 合规约定：只留提取结果，原推文/截图用完即弃、不落任何存储。
    _togglePersonaExtract() {
        const area = document.getElementById('npcExtractArea');
        if (!area) return;
        area.style.display = (area.style.display === 'none' || !area.style.display) ? 'block' : 'none';
    },

    _resetPersonaExtract() {
        const area = document.getElementById('npcExtractArea');
        if (area) area.style.display = 'none';
        const tEl = document.getElementById('npcExtractTweets');
        if (tEl) tEl.value = '';
        const sEl = document.getElementById('npcExtractShots');
        if (sEl) sEl.value = '';
    },

    async _extractPersonaFromTweets() {
        await Utils.withLock('npcPersonaExtract', async () => {
            const targetNpcId = this.editingNpcId; // 记住进入时正在编辑的 NPC（新建时为 null），防止 modal 切换后异步结果错位写入
            const text = (document.getElementById('npcExtractTweets')?.value || '').trim();
            const files = Array.from(document.getElementById('npcExtractShots')?.files || []).slice(0, 3);
            if (!text && files.length === 0) {
                Utils.showToast(I18n.t('forum.npc_extract_need_input', '先贴几条推文或选一张截图'));
                return;
            }
            const btn = document.getElementById('npcExtractRunBtn');
            if (btn) { btn.disabled = true; btn.textContent = I18n.t('forum.npc_extract_running', '抽出中…'); }
            try {
                const messages = [];
                for (const f of files) {
                    const dataUrl = await Utils.readImageFile(f, { maxSize: 1280, quality: 0.85 });
                    if (!dataUrl) continue;
                    const comma = dataUrl.indexOf(',');
                    const mimeType = (dataUrl.slice(5, dataUrl.indexOf(';')) || 'image/jpeg');
                    messages.push({ role: 'user', content: 'X（Twitter）投稿のスクリーンショットです。', image: { data: dataUrl.slice(comma + 1), mimeType } });
                }
                let finalMsg = text ? `以下は同一人物のX（Twitter）投稿の原文です:\n${text}\n\n` : '';
                finalMsg += '上記の投稿（テキスト／スクリーンショット）を分析し、この人物の発言スタイルを抽出してください。';
                messages.push({ role: 'user', content: finalMsg });

                const systemPrompt = `あなたはSNS発言スタイルのアナリストです。
与えられた投稿サンプルから、この人物の「発言スタイル」を抽出し、キャラクター設定として使える形にまとめてください。

抽出する観点（サンプルから読み取れるものだけ。無理に全項目埋めない）:
- 一人称・呼びかけ方
- 口調・語尾の癖（です・ます／タメ口／方言 など）
- 絵文字・記号・顔文字の使い方（種類・頻度）
- よく話す話題・興味関心
- 文の長さ・改行・ハッシュタグの癖
- テンション・人柄の印象（告知時と日常の使い分けがあればそれも）

ルール:
- 箇条書きで簡潔に、全体で100〜250字程度
- 投稿の引用や実在の固有名詞（人名・番組名・作品名）を出力に含めないこと——あくまで「スタイルの描述」だけを書く
- 説明・前置き・後書きは一切不要。スタイル描述のみを出力`;

                const raw = (await Utils.callChatAPI(messages, systemPrompt)).trim();
                if (!raw) throw new Error(I18n.t('forum.npc_extract_empty', '未能提取出内容'));
                // 异步期间用户可能关掉 modal 又编辑了另一个 NPC——校验编辑对象没变才写入，避免结果错位污染
                const modalStillActive = document.getElementById('npcModal')?.classList.contains('active');
                if (!modalStillActive || this.editingNpcId !== targetNpcId) {
                    Utils.showToast(I18n.t('forum.npc_extract_stale', '編集対象が変わったため、抽出結果を破棄しました'));
                    return;
                }
                const ta = document.getElementById('npcPersona');
                if (ta) ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + raw;
                this._resetPersonaExtract(); // 用完即弃：清空原推文/截图输入
                Utils.showToast(I18n.t('forum.npc_extract_done', '✓ 已填入人设——确认满意后记得保存'));
            } catch (e) {
                Utils.showToast(I18n.t('forum.npc_extract_failed', '提取失败：') + (e?.message || e));
            } finally {
                if (btn) { btn.disabled = false; btn.textContent = I18n.t('forum.npc_extract_run', 'AI 提取 → 填入人设'); }
            }
        }, () => Utils.showToast(I18n.t('forum.npc_extract_running', '抽出中…')));
    },

    // 根据 NPC id 数组生成可读标签（如「監督 田中一郎 × 声優 山田花子」）
    _getNpcLabel(ids) {
        if (!ids || ids.length === 0) return null;
        const npcs = AppState.data.broadcast.officialNpcs || [];
        return ids.map(id => {
            const npc = npcs.find(n => n.id === id);
            if (!npc) return null;
            return npc.name ? `${npc.role} ${npc.name} ` : npc.role;
        }).filter(Boolean).join(' × ') || null;
    },

    // ===== AI 通用 helper：输出语言后缀 =====
    // lang = 'auto'（跟随当前 i18n 语言）/ 'zh' / 'ja' / 'en'
    // 拼到 systemPrompt 末尾，告诉 LLM 用哪种语言输出
    _buildLangSuffix(lang) {
        let effectiveLang = lang;
        if (lang === 'auto' || !lang) {
            effectiveLang = (typeof I18n !== 'undefined' && I18n.currentLang) || 'ja';
        }
        switch (effectiveLang) {
            case 'zh': return '\n\n请用中文（简体）书写。';
            case 'en': return '\n\nWrite in natural English.';
            case 'ja':
            default: return '\n\n自然な日本語で書くこと。';
        }
    },

});
