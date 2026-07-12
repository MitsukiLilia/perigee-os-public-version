// twitter-social.js — 从 js/twitter.js 纯搬运拆出（v2.197.0，架构报告 P1-⑥）。
// 内容零改动；加载顺序：twitter.js → thread → social → spaces → profile（见 index.html）。
Object.assign(Twitter, {
    // ===== 身份设置弹窗（v2：单一表单 + 账号下拉 + 添加 + 实名 toggle） =====
    // _editingAccountId 临时持有当前编辑的账号 id（'personal:xxx' 或 'npc:xxx'）
    _editingAccountId: null,

    showIdentityModal() {
        this._ensureData();
        // 默认编辑当前激活账号
        this._editingAccountId = AppState.data.twitterData.activeAccountId;
        this._renderIdentityModal();
        document.getElementById('twitterIdentityModal')?.classList.add('active');
    },

    _renderIdentityModal() {
        const t = this._ensureData();
        const container = document.getElementById('twIdentityModalBody');
        if (!container) return;

        // 当前编辑账号（缺值则用 active）
        let editId = this._editingAccountId || t.activeAccountId;
        if (!this._isAccountIdValid(editId)) editId = t.activeAccountId;
        this._editingAccountId = editId;

        const npcs = AppState.data.broadcast.officialNpcs || [];

        // 下拉：个人账号 + 论坛 NPC
        const personalOpts = (t.personalAccounts || []).map(a => {
            const v = 'personal:' + a.id;
            return `<option value="${this._esc(v)}" ${v === editId ? 'selected' : ''}>${this._esc(a.name || I18n.t('tw.id_unnamed', '名前未設定'))} @${this._esc(a.handle || 'myaccount')}</option>`;
        }).join('');
        const npcOpts = npcs.map(n => {
            const v = 'npc:' + n.id;
            return `<option value="${this._esc(v)}" ${v === editId ? 'selected' : ''}>${this._esc(n.name || n.role)}${I18n.t('tw.id_label_npc_official', '（NPC・公式）')}</option>`;
        }).join('');
        const accountOptions = `
            <optgroup label="${I18n.t('tw.id_optgroup_personal', '個人アカウント')}">${personalOpts || `<option disabled>${I18n.t('tw.id_no_accounts', '（なし）')}</option>`}</optgroup>
            <optgroup label="${I18n.t('tw.id_optgroup_npc', '論壇 NPC')}">${npcOpts || `<option disabled>${I18n.t('tw.id_no_npcs', '（NPCがいません）')}</option>`}</optgroup>
        `;

        // 当前正在编辑的账号信息
        let formHtml;
        let saveBtnVisible = true;
        if (editId && editId.startsWith('npc:')) {
            const npc = this._getNpc(editId.slice('npc:'.length));
            saveBtnVisible = false;
            if (npc) {
                const handle = (this._getNpcHandle(npc) || '@npc').replace(/^@/, '');
                const letter = (npc.name || npc.role || 'N').charAt(0).toUpperCase();
                const color = this._npcColor(npc.id);
                const avatarHtml = npc.avatarImage
                    ? `<img class="tw-user-avatar-btn tw-avatar-xl tw-avatar-img" src="${Utils.escAttr(npc.avatarImage)}" alt="" style="flex-shrink:0;">`
                    : `<div class="tw-user-avatar-btn tw-avatar-xl" style="flex-shrink:0;background:${color};">${this._esc(letter)}</div>`;
                formHtml = `
<div class="tw-identity-readonly">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
        ${avatarHtml}
        <div style="flex:1;">
            <div style="font-weight:700;font-size:17px;">${this._esc(npc.name || npc.role)}</div>
            <div style="font-size:13px;color:var(--text-secondary);">@${this._esc(handle)}</div>
        </div>
    </div>
    ${npc.bio ? `<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;padding:10px 12px;background:var(--bg-secondary);border-radius:10px;margin-bottom:12px;white-space:pre-wrap;">${this._esc(npc.bio)}</div>` : ''}
    <div style="font-size:12px;color:var(--text-tertiary);background:var(--bg-secondary);border-radius:10px;padding:10px 12px;line-height:1.5;">
        ${I18n.t('tw.id_npc_readonly', 'このアカウントは公式 NPC です。プロフィールは「論壇の NPC 設定」で管理されており、ここでは編集できません。')}
    </div>
</div>`;
            } else {
                formHtml = `<div style="padding:20px;text-align:center;color:var(--text-secondary);">${I18n.t('tw.id_account_not_found', 'このアカウントは見つかりませんでした')}</div>`;
            }
        } else {
            // personal 账号编辑表单
            const acc = this._getPersonalAccount(editId) || (t.personalAccounts || [])[0];
            if (!acc) {
                formHtml = `<div style="padding:20px;text-align:center;color:var(--text-secondary);">${I18n.t('tw.id_no_account_hint', 'アカウントがありません。「+ 追加」から作成してください。')}</div>`;
                saveBtnVisible = false;
            } else {
                const isReal = acc.isReal !== false;
                const canDelete = (t.personalAccounts || []).length > 1;
                const avatarColor = acc.avatarColor || '#e0245e';
                const avatarLetter = acc.avatarLetter || (acc.name || I18n.t('tw.id_default_letter', '私')).charAt(0).toUpperCase();
                const avatarHtml = acc.avatarImage
                    ? `<img class="tw-user-avatar-btn tw-avatar-xl tw-avatar-img" id="twIdentityPreview" src="${Utils.escAttr(acc.avatarImage)}" alt="" style="flex-shrink:0;cursor:pointer;" onclick="Twitter._uploadActiveAccountAvatar()">`
                    : `<div class="tw-user-avatar-btn tw-avatar-xl" id="twIdentityPreview" style="flex-shrink:0;background:${avatarColor};cursor:pointer;" onclick="Twitter._uploadActiveAccountAvatar()">${this._esc(avatarLetter)}</div>`;
                formHtml = `
<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
    ${avatarHtml}
    <div style="flex:1;">
        <input type="text" id="twIdentityName" placeholder="${I18n.t('tw.id_display_name', '表示名')}" value="${this._esc(acc.name || '')}"
            style="font-weight:700;font-size:17px;border:none;background:none;outline:none;border-bottom:1px solid var(--border-light);width:100%;padding-bottom:4px;margin-bottom:6px;"
            oninput="Twitter.previewIdentity()">
        <div style="font-size:12px;color:var(--text-secondary);">${I18n.t('tw.id_tap_to_change_avatar', 'アバターをタップして画像を変更')}</div>
    </div>
</div>
<div style="margin-bottom:14px;">
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">${I18n.t('tw.id_avatar_color', 'アバターカラー')}</div>
    <div class="tw-color-swatches" id="twColorSwatches"></div>
</div>
<label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">${I18n.t('tw.id_handle_label', 'ハンドル（@ なし・半角英数 / アンダースコア）')}</label>
<input type="text" id="twIdentityHandle" placeholder="myaccount" value="${this._esc(acc.handle || '')}" maxlength="20" pattern="[a-zA-Z0-9_]+" style="width:100%;margin-bottom:12px;">
<label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">${I18n.t('tw.id_avatar_letter_label', 'アバター文字（1文字）')}</label>
<input type="text" id="twIdentityAvatar" maxlength="2" placeholder="M" value="${this._esc(avatarLetter)}" style="width:100%;margin-bottom:12px;" oninput="Twitter.previewIdentity()">
<label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;">${I18n.t('tw.id_bio_label', '自己紹介')}</label>
<textarea id="twIdentityBio" rows="3" placeholder="${I18n.t('tw.id_bio_placeholder', 'どんなアカウントですか？')}" style="width:100%;margin-bottom:16px;resize:none;font-size:14px;">${this._esc(acc.bio || '')}</textarea>

<label class="tw-identity-toggle" style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--bg-secondary);border-radius:10px;cursor:pointer;margin-bottom:12px;">
    <input type="checkbox" id="twIdentityIsReal" ${isReal ? 'checked' : ''} style="margin-top:2px;flex-shrink:0;">
    <span style="flex:1;">
        <span style="font-size:14px;font-weight:600;color:var(--text-primary);display:block;">${I18n.t('tw.id_realname_post', '実名として投稿')}</span>
        <span style="font-size:11px;color:var(--text-secondary);display:block;margin-top:2px;line-height:1.4;">${I18n.t('tw.id_realname_hint', 'ON：NPCがあなたの素性を知っている前提でリプ／OFF：匿名アカウントとして扱われる')}</span>
    </span>
</label>

${canDelete ? `<button type="button" class="tw-identity-delete" onclick="Twitter.deleteActiveAccount()">${I18n.t('tw.id_delete_account', 'このアカウントを削除')}</button>` : ''}`;

                setTimeout(() => {
                    this._renderColorSwatches(avatarColor);
                    this._selectedColor = avatarColor;
                }, 0);
            }
        }

        container.innerHTML = `
<div style="margin-bottom:14px;">
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;font-weight:600;">${I18n.t('tw.id_account_label', '発信アカウント')}</div>
    <div style="display:flex;gap:8px;">
        <select id="twActiveAccountSelect" style="flex:1;font-size:15px;font-weight:600;padding:10px 12px;border-radius:10px;border:1.5px solid var(--border-medium);background:var(--bg-secondary);color:var(--text-primary);" onchange="Twitter._onAccountSelectChange(this.value)">
            ${accountOptions}
        </select>
        <button type="button" class="tw-identity-add" onclick="Twitter.addPersonalAccount()" title="${I18n.t('tw.id_add_account', '個人アカウント追加')}">＋</button>
    </div>
    <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">${I18n.t('tw.id_account_hint', '下のフォームは選択中のアカウントを編集します')}</div>
</div>
<hr style="border:none;border-top:1px solid var(--border-light);margin-bottom:14px;">
${formHtml}`;

        // 保存按钮的可见性（NPC 时隐藏）
        const saveBtn = document.querySelector('#twitterIdentityModal [data-identity-save]');
        if (saveBtn) saveBtn.style.display = saveBtnVisible ? '' : 'none';
    },

    // 切换发信账号 + 同步表单（不立即写入 active，待用户保存或显式确认）
    // 但实际产品体验：选了就生效（更直觉）。所以这里立即写入 active。
    _onAccountSelectChange(value) {
        if (!this._isAccountIdValid(value)) return;
        const t = this._ensureData();
        t.activeAccountId = value;
        // 同时同步旧字段，避免没迁移的代码读到错的值
        if (value.startsWith('npc:')) {
            t.activeIdentityType = 'npc';
            t.activeNpcId = value.slice('npc:'.length);
        } else {
            t.activeIdentityType = 'personal';
            t.activeNpcId = null;
        }
        Utils.saveData();
        this._updateUserAvatar();
        this._editingAccountId = value;
        this._renderIdentityModal();
        const identity = this._getActiveIdentity();
        Utils.showToast(I18n.t('t.tw_posting_as', {name: identity.name}));
    },

    // ＋ 添加新 personal 账号
    addPersonalAccount() {
        const t = this._ensureData();
        const newAcc = {
            id: 'pa_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            name: I18n.t('tw.id_new_name', '新しいアカウント'),
            handle: 'newaccount' + (t.personalAccounts.length + 1),
            avatarLetter: I18n.t('tw.id_new_letter', '新'),
            avatarColor: '#1d9bf0',
            avatarImage: null,
            bio: '',
            isReal: true,
            joinDate: ''
        };
        t.personalAccounts.push(newAcc);
        Utils.saveData();
        this._editingAccountId = 'personal:' + newAcc.id;
        this._renderIdentityModal();
        Utils.showToast(I18n.t('t.tw_account_created', '新しいアカウントを作成しました'));
    },

    // 删除当前编辑中的 personal 账号（含其所有历史推文）
    deleteActiveAccount() {
        const t = this._ensureData();
        const editId = this._editingAccountId;
        if (!editId || !editId.startsWith('personal:')) return;
        if (t.personalAccounts.length <= 1) {
            Utils.showToast(I18n.t('t.tw_cannot_delete_last_account', '最後のアカウントは削除できません'));
            return;
        }
        const acc = this._getPersonalAccount(editId);
        if (!acc) return;
        const tweetCount = (t.tweets || []).filter(tw => tw.postedAsAccountId === editId).length;
        const msg = tweetCount > 0
            ? I18n.t('tw.id_confirm_delete_with_tweets', {name: acc.name, n: tweetCount})
            : I18n.t('tw.id_confirm_delete', {name: acc.name});
        if (!confirm(msg)) return;

        // 删账号 + 关联推文
        t.personalAccounts = t.personalAccounts.filter(a => a.id !== acc.id);
        // 顺手清掉这批被删推文里的本地音频 blob（否则批量删账号会留下孤儿 blob）
        if (typeof TTSEngine !== 'undefined') {
            (t.tweets || []).forEach(tw => {
                if (tw.postedAsAccountId === editId && tw.userAudio?.type === 'local' && tw.userAudio.audioId) {
                    TTSEngine.removeAudio(tw.userAudio.audioId).catch(() => {});
                }
            });
        }
        t.tweets = (t.tweets || []).filter(tw => tw.postedAsAccountId !== editId);

        // 如果当前 active 也被删，回退到第一个
        if (t.activeAccountId === editId) {
            t.activeAccountId = 'personal:' + t.personalAccounts[0].id;
            t.activeIdentityType = 'personal';
            t.activeNpcId = null;
        }
        Utils.saveData();
        this._editingAccountId = t.activeAccountId;
        this._updateUserAvatar();
        this._renderIdentityModal();
        // 如果用户主页可见，刷新
        const userProfileEl = document.getElementById('twitter-user-profile');
        if (userProfileEl?.classList.contains('active')) this.renderUserProfile();
        this.renderTimeline?.();
        Utils.showToast(I18n.t('t.tw_deleted_check', '✓ 削除しました'));
    },

    // 头像上传：写入正在编辑的账号
    _uploadActiveAccountAvatar() {
        const editId = this._editingAccountId;
        if (!editId || !editId.startsWith('personal:')) return;
        const id = editId.slice('personal:'.length);
        this._pickAvatarFile('account:' + id);
    },

    closeIdentityModal() {
        document.getElementById('twitterIdentityModal')?.classList.remove('active');
        // 如果从用户主页打开的，刷新主页
        const userProfileEl = document.getElementById('twitter-user-profile');
        if (userProfileEl?.classList.contains('active')) this.renderUserProfile();
    },

    _renderColorSwatches(selectedColor) {
        const container = document.getElementById('twColorSwatches');
        if (!container) return;
        container.innerHTML = this._AVATAR_COLORS.map(c => {
            const active = c === selectedColor ? ' tw-swatch-active' : '';
            return `<button class="tw-color-swatch${active}" style="background:${c};" onclick="Twitter._selectColor('${c}')" title="${c}"></button>`;
        }).join('');
    },

    _selectColor(color) {
        document.querySelectorAll('.tw-color-swatch').forEach(s => s.classList.remove('tw-swatch-active'));
        const btn = [...document.querySelectorAll('.tw-color-swatch')].find(s => s.style.background === color || s.style.backgroundColor === color);
        if (btn) btn.classList.add('tw-swatch-active');
        const preview = document.getElementById('twIdentityPreview');
        if (preview) preview.style.background = color;
        this._selectedColor = color;
    },

    previewIdentity() {
        const nameVal = document.getElementById('twIdentityName')?.value || '';
        const avatarVal = document.getElementById('twIdentityAvatar')?.value || nameVal.charAt(0) || 'M';
        const preview = document.getElementById('twIdentityPreview');
        if (preview) preview.textContent = avatarVal.charAt(0).toUpperCase() || 'M';
    },

    // 处理 handle：去 @、只保留半角英数+下划线、限长 20
    _sanitizeHandle(raw, fallback) {
        const cleaned = String(raw || '')
            .replace(/^@+/, '')
            .replace(/[^a-zA-Z0-9_]/g, '')
            .slice(0, 20);
        return cleaned || fallback;
    },

    saveIdentity() {
        const t = this._ensureData();
        const editId = this._editingAccountId;
        // NPC 不在此编辑
        if (!editId || !editId.startsWith('personal:')) {
            this.closeIdentityModal();
            return;
        }
        const acc = this._getPersonalAccount(editId);
        if (!acc) { this.closeIdentityModal(); return; }

        const nameEl = document.getElementById('twIdentityName');
        const handleEl = document.getElementById('twIdentityHandle');
        const avatarEl = document.getElementById('twIdentityAvatar');
        const bioEl = document.getElementById('twIdentityBio');
        const isRealEl = document.getElementById('twIdentityIsReal');

        acc.name = nameEl?.value.trim() || acc.name || I18n.t('tw.id_default_name', '私のアカウント');
        acc.handle = this._sanitizeHandle(handleEl?.value, 'myaccount');
        acc.avatarLetter = (avatarEl?.value.trim().charAt(0) || acc.name.charAt(0) || '?').toUpperCase();
        acc.avatarColor = this._selectedColor || acc.avatarColor || '#e0245e';
        acc.bio = bioEl?.value.trim() || '';
        acc.isReal = isRealEl ? !!isRealEl.checked : (acc.isReal !== false);
        if (!acc.joinDate) acc.joinDate = I18n.t('tw.time_year_month', {year: new Date().getFullYear(), month: new Date().getMonth() + 1});

        Utils.saveData();
        this.closeIdentityModal();
        this._updateUserAvatar();
        // 顶时间线/profile 都重渲，handle/name 改了要同步
        this.renderTimeline?.();
        const userProfileEl = document.getElementById('twitter-user-profile');
        if (userProfileEl?.classList.contains('active')) this.renderUserProfile();
        Utils.showToast(I18n.t('t.tw_saved', '✓ 保存しました'));
    },

    // ===== DM 功能 =====
    showDmList() {
        Navigation.goTo('twitter-dm-list');
    },

    openDm(npcId) {
        this.currentDmNpcId = npcId;
        this.currentDmMode = 'npc';
        this.currentInboxDmId = null;
        Navigation.goTo('twitter-dm');
    },

    // ===== 解析回复文本 =====
    _parseReplies(text) {
        const blocks = text.split(/---\s*REPLY\s*---/i).map(s => s.trim()).filter(Boolean);
        return blocks.map(block => {
            const author = (block.match(/^AUTHOR:\s*(.+)$/m) || [])[1]?.trim() || 'ファン';
            const handle = (block.match(/^HANDLE:\s*(.+)$/m) || [])[1]?.trim() || '@user';
            const role = (block.match(/^ROLE:\s*(.+)$/m) || [])[1]?.trim() || 'fan';
            // CONTENT 可能多行（AI 回复换行）→ 捕获到下一个字段标记或块尾，不再被 (.+) 截到第一行
            const contentMatch = block.match(/(?:^|\n)CONTENT:[ \t]*([\s\S]*?)(?=\n[ \t]*(?:TRANSLATION|AUTHOR|HANDLE|ROLE)[ \t]*:|$)/);
            const content = contentMatch ? contentMatch[1].trim() : '';
            const translation = (block.match(/^TRANSLATION:[ \t]*(.+)$/m) || [])[1]?.trim() || null;
            return { author, handle, role, content, translation };
        }).filter(r => r.content);
    },

    // ニュース見出し風のリプライをフィルタリング（リプ欄に出現すべきではない）
    _looksLikeNewsHeadline(content) {
        if (!content) return false;
        const c = String(content);
        // ニュース通信社風の角括弧タグから始まる
        if (/^[【\[](話題|速報|お知らせ|公式|トレンド|注目|発表|配信開始|放送開始|新情報|解禁|報道)[】\]]/.test(c)) return true;
        // ニュース定型句
        if (/トレンド入り[！!]|公式ピックアップ|公式が公開/.test(c)) return true;
        // 客観的紹介の典型的な締め
        if (/に注目です。?$|放送開始しました！?$/.test(c)) return true;
        return false;
    },

    // ===== 辅助方法 =====
    _getNpc(npcId) {
        if (!npcId) return null;
        return (AppState.data.broadcast.officialNpcs || []).find(n => n.id === npcId) || null;
    },

    _getNpcHandle(npc) {
        if (!npc) return '@npc';
        // 1) \u663e\u5f0f\u8bbe\u4e86 handle \u4f18\u5148\u7528
        if (npc.handle) {
            const h = String(npc.handle).replace(/^@+/, '').trim();
            if (h) return '@' + h;
        }
        // 2) ID \u662f ASCII \u98ce\u683c\uff08\u5982 cv_misaki / staff_tanaka\uff09\uff0c\u76f4\u63a5\u7528
        const id = String(npc.id || '');
        if (/^[a-zA-Z0-9_]+$/.test(id) && id.length > 0) {
            return '@' + id.toLowerCase().slice(0, 20);
        }
        // 3) \u540d\u5b57\u91cc\u62a0 ASCII \u90e8\u5206\uff08\u7f57\u9a6c\u5b57\u6635\u79f0\u3001\u82f1\u6587\u540d\uff09
        const ascii = (npc.name || npc.role || '')
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '')
            .slice(0, 15);
        if (ascii.length >= 2) return '@' + ascii;
        // 4) fallback\uff1astaff_<id \u54c8\u5e0c>\uff0c\u4e0d\u518d\u8fd4\u56de\u4e2d\u65e5\u6587 handle
        let hash = 0;
        for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffff;
        return '@staff_' + hash.toString(36).slice(0, 5);
    },

    _npcColor(npcId) {
        // 根据 npcId 生成稳定颜色
        const colors = ['#1d9bf0', '#17bf63', '#794bc4', '#f4900c', '#e0245e', '#2b7be9', '#00ba7c'];
        if (!npcId) return colors[0];
        let hash = 0;
        for (let i = 0; i < npcId.length; i++) hash = (hash * 31 + npcId.charCodeAt(i)) & 0xffff;
        return colors[hash % colors.length];
    },

    _roleColor(role) {
        const map = { fan: '#1d9bf0', anti: '#e0245e', media: '#17bf63', npc: '#794bc4', doujin_writer: '#f4900c', doujin_artist: '#9b59b6', cp_fan: '#e0245e', organizer: '#1d9bf0' };
        return map[role] || '#888';
    },

    _fanTypeColor(type) {
        const map = {
            fan: '#888',         // 一般ファン→グレー
            industry: '#794bc4', // 業界→パープル
            media: '#17bf63',    // メディア→グリーン
            doujin_writer: '#f4900c',   // 文手→オレンジ
            doujin_artist: '#9b59b6',   // 絵師→パープル
            cp_fan: '#e0245e',   // CP厨→ピンク
            organizer: '#1d9bf0' // 企画主→ブルー
        };
        return map[type] || '#888';
    },

    // ===== Fan Friend 辅助方法 =====
    _getFanFriend(id) {
        return (this._ensureData().fanFriends || []).find(f => f.id === id) || null;
    },

    _getFanByHandle(handle) {
        if (!handle) return null;
        return (this._ensureData().fanFriends || []).find(f => f.handle === handle) || null;
    },

    _fanTypeLabel(type) {
        const map = {
            fan: I18n.t('tw.fan_type_fan', '一般ファン'),
            industry: I18n.t('tw.fan_type_industry', '業界関係者'),
            media: I18n.t('tw.fan_type_media', 'メディア'),
            doujin_writer: I18n.t('tw.fan_type_doujin_writer', '文手'),
            doujin_artist: I18n.t('tw.fan_type_doujin_artist', '絵師（同人作家）'),
            cp_fan: I18n.t('tw.fan_type_cp_fan', 'CP厨'),
            organizer: I18n.t('tw.fan_type_organizer', '企画主'),
            event_promo: I18n.t('tw.fan_type_event_promo', 'イベント告知'),
            event_haul: I18n.t('tw.fan_type_event_haul', '戦利品報告'),
            event_repo: I18n.t('tw.fan_type_event_repo', 'イベントレポ'),
            fanart_share: I18n.t('tw.fan_type_fanart_share', '絵師'),
            radio_drama: I18n.t('tw.fan_type_radio_drama', 'ドラマCD勢')
        };
        return map[type] || I18n.t('tw.fan_type_default', 'ファン');
    },

    _buildFanFriendsPrompt() {
        const t = this._ensureData();
        const friends = t.fanFriends || [];
        if (friends.length === 0) return '';
        const list = friends.map(f =>
            `- ${f.name}（${f.handle}）タイプ: ${f.type}${f.bio ? '、' + f.bio.replace(/\n/g, ' ').slice(0, 60) : ''}`
        ).join('\n');
        return `\n既存のフォロワー（必ず1〜2名のツイートを含めること）:\n${list}\n上記のフォロワーのNAMEとHANDLEは正確に一致させること。\n`;
    },

    // ===== v2.70.0 doujin_writer 最近 pixiv 新作 prompt 注入 =====
    _buildDoujinWriterNewWorksPrompt() {
        const t = this._ensureData();
        const writers = (t.fanFriends || []).filter(f => f.type === 'doujin_writer');
        if (writers.length === 0) return '';

        const novels = (AppState.data.pixivData?.novels || []);
        // v2.140.0 反查信号自愈：已被任意推链接过的小说 id（含链路A 历次自宣、链路B 点击回填）
        const linkedIds = new Set((t.npcTweets || []).map(x => x.pixivNovelId).filter(Boolean));
        // 找出尚可自宣的新作：作者非空 / 非链路B出身 / 未宣传过 / 未被链接过 / 3天内（按 createdAt 降序）
        // ★筛选必须与 _generateFanTweets 代码反查严格对齐，否则 prompt 仍把已宣传作品喂给 LLM → LLM 反复写自宣 → 重复卡
        const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
        const recentWorks = novels
            .filter(n => n.author_npc_id && !n.fromTweetId && !n.promotedOnTwitter && !linkedIds.has(n.id) && n.createdAt && n.createdAt > threeDaysAgo)
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .slice(0, 10);  // timeline 注入上限 10 篇、避免 prompt 爆炸

        if (recentWorks.length === 0) return '';

        const lines = recentWorks.map(n => {
            const writer = writers.find(w => w.id === n.author_npc_id);
            if (!writer) return null;
            const tagsStr = (n.tags || []).slice(0, 5).join(', ');
            return `- NPC: ${writer.name}（${writer.handle}, promoteStyle: ${writer.promoteStyle || 'occasional'}）\n  最近の新作: 「${n.title}」（pixiv ID: ${n.id}, tags: ${tagsStr}）`;
        }).filter(Boolean).join('\n\n');

        if (!lines) return '';

        return `\n\n【pixiv 新作情報 — 自宣ツイート判定用】
以下のフォロワーは最近 pixiv で新作を発表しました。彼女たちの promoteStyle に従って timeline で自然に言及するかどうか決めてください：
- active: 必ず自宣ツイートを生成（PIXIV_LINK 付き、嬉しそうに / 創作の喜びを語る）
- occasional: 30% 確率で自宣（時々まとめて告知、控えめに）
- shy: 5% 確率（基本発信しない、たまに「pixiv 更新しました」程度の短文のみ）

自宣ツイートには PIXIV_NOVEL_ID フィールドに上記の「pixiv ID」をそのまま記入すること（URL は生成しないこと、ID 以外の文字を含めないこと）。アプリ内の pixiv リーダーへ直接ジャンプするために使われます。

${lines}
`;
    },

    _timeAgo(ts) {
        if (!ts) return '';
        const diff = Date.now() - ts;
        const m = Math.floor(diff / 60000);
        if (m < 1) return I18n.t('tw.time_just_now', 'たった今');
        if (m < 60) return I18n.t('tw.time_minutes', {n: m});
        const h = Math.floor(m / 60);
        if (h < 24) return I18n.t('tw.time_hours', {n: h});
        const d = Math.floor(h / 24);
        return I18n.t('tw.time_days', {n: d});
    },

    _formatDate(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        // 注意：tw.time_full key 在 zh 中是 {year}年{month}月{day}日 {hh}:{mm}（按当前 zh 文案保留日式格式）
        return I18n.t('tw.time_full', {year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hh, mm}) ||
            `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
    },

    // ⚠️ 保留独立实现，勿收编 Utils.escapeHtml（那边会把 ' 转成 &#39;）：
    // ① 下方 _escJsAttr 依赖本函数不转义单引号（原因见其注释）；
    // ② 模块内有先转义后 .substring() 截断的调用点，实体膨胀会挪动截断点
    _esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    // 用于拼进单引号 onclick JS 字符串字面量（如 onclick="Foo('${...}')"）的值。
    // 仅靠 _esc 的 HTML 实体转义不够：浏览器解析 onclick 属性时先做 HTML 实体解码、
    // 再把解码后的文本当 JS 源码解析，所以单引号若编码成 &#39; 会在解码后变回裸 '
    // 重新击穿 JS 字符串边界；必须写成字面 \\ 和 \' 才能在两层解析后仍保持转义。
    _escJsAttr(s) {
        return this._esc(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    },

    // ===== 角标更新 =====
    _updateBadges() {
        const t = this._ensureData();
        const unreadNotif = (t.notifications || []).filter(n => !n.isRead).length;
        const unreadDm = (t.inboxDms || []).filter(d => !d.isRead).length;
        const notifBadge = document.getElementById('twNavNotifBadge');
        const dmBadge = document.getElementById('twNavDmBadge');
        if (notifBadge) { notifBadge.textContent = unreadNotif > 9 ? '9+' : (unreadNotif || ''); notifBadge.style.display = unreadNotif ? '' : 'none'; }
        if (dmBadge) { dmBadge.textContent = unreadDm > 9 ? '9+' : (unreadDm || ''); dmBadge.style.display = unreadDm ? '' : 'none'; }
    },

    // ===== 通知系统 =====
    async _generateTweetNotifications(tweetId) {
        const t = this._ensureData();
        const arr = t.tweets || [];
        const tweet = arr.find(tw => tw.id === tweetId);
        if (!tweet) return;

        const forumData = AppState.data.forumData || {};
        const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
        const identity = this._getActiveIdentity();

        const accountDesc = identity.type === 'personal' ? 'ファンアカウント' : '公式アニメアカウント';
        const systemPrompt = `あなたは${accountDesc}のX（Twitter）通知リアクションをシミュレーションしています。
${accountDesc}が投稿したツイートへのリアルなファン・メディアの反応を生成してください。

アカウント: ${this._esc(identity.name)} (${this._esc(identity.handle)})
作品設定（以下の内容を超えて捏造しないこと）:
${worldContext || '（未設定 — 具体的なキャラ名・CP・ストーリーを捏造しないこと）'}
${Utils.PROMPTS.infoAccessRule()}
通知タイプ: reply (💬) / quote (🔁) / mention (💬) / like (❤️)

出力フォーマット（厳守）:
---NOTIF---
TYPE: reply
FROM_NAME: [ファン名]
FROM_HANDLE: [@handle]
FROM_TYPE: [fan/industry/media]
CONTENT: [日本語のリプライ・引用・メンション、1-3行]
TRANSLATION: [中国語翻訳、1行]

3〜5件の通知を生成すること。タイプを自然に混ぜること。`;

        const messages = [{ role: 'user', content: `官方推文内容：\n${tweet.content}\n\n上記のツイートへの通知（リプライ・引用・いいね等）を生成してください。` }];
        const raw = await Utils.callChatAPI(messages, systemPrompt);

        const blocks = raw.split(/---\s*NOTIF\s*---/i).map(s => s.trim()).filter(Boolean);
        const now = Date.now();
        let added = 0;
        for (const block of blocks) {
            const typeRaw = (block.match(/^TYPE:\s*(.+)$/m) || [])[1]?.trim() || 'reply';
            const type = ['reply', 'quote', 'mention', 'like'].includes(typeRaw) ? typeRaw : 'reply';
            const fromName = (block.match(/^FROM_NAME:\s*(.+)$/m) || [])[1]?.trim() || 'ファン';
            const fromHandle = (block.match(/^FROM_HANDLE:\s*(.+)$/m) || [])[1]?.trim() || '@user';
            const fromTypeRaw = (block.match(/^FROM_TYPE:\s*(.+)$/m) || [])[1]?.trim() || 'fan';
            const fromType = ['fan', 'industry', 'media'].includes(fromTypeRaw) ? fromTypeRaw : 'fan';
            const contentMatch = block.match(/CONTENT:[ \t]*\n?([\s\S]*?)(?=\nTRANSLATION:|\s*$)/);
            const content = contentMatch ? contentMatch[1].trim() : '';
            const tlMatch = block.match(/^TRANSLATION:[ \t]*(.+)$/m);
            const translation = tlMatch ? tlMatch[1].trim() : null;
            if (!content) continue;
            t.notifications.unshift({
                id: Utils.generateId(),
                type, fromName, fromHandle, fromType,
                content, translation,
                targetTweetId: tweetId,
                timestamp: now - added * 3000,
                isRead: false
            });
            added++;
        }

        // 通知最多保留 100 条
        if (t.notifications.length > 100) t.notifications = t.notifications.slice(0, 100);
        Utils.saveData();
        this._updateBadges();
    },

    _notifTab: 'all', // 'all' | 'mention'

    renderNotifications() {
        const t = this._ensureData();
        const container = document.getElementById('twitterNotifContent');
        if (!container) return;

        const allNotifs = t.notifications || [];
        const tab = this._notifTab || 'all';
        const notifs = tab === 'mention'
            ? allNotifs.filter(n => n.type === 'reply' || n.type === 'mention' || n.type === 'quote')
            : allNotifs;

        const tabBar = `<div class="tw-tabs-bar tw-notif-tabs">
            <button class="tw-tab-btn${tab === 'all' ? ' active' : ''}" onclick="Twitter._notifTab='all';Twitter.renderNotifications()">${I18n.t('tw.notif_tab_all', '全て')}</button>
            <button class="tw-tab-btn${tab === 'mention' ? ' active' : ''}" onclick="Twitter._notifTab='mention';Twitter.renderNotifications()">${I18n.t('tw.notif_tab_mention', '@ あなた宛')}</button>
        </div>`;

        if (notifs.length === 0) {
            container.innerHTML = tabBar + `<div class="empty-state" style="padding-top:60px;"><div style="margin-bottom:12px;color:var(--text-secondary);">${this._svg.bellLg}</div><div>${I18n.t('tw.empty_no_notifications', 'まだ通知がありません')}</div><div style="font-size:13px;color:var(--text-secondary);margin-top:6px;">${I18n.t('tw.empty_hint_notif', 'ツイートを投稿すると通知が届きます')}</div></div>`;
            return;
        }

        // 大彩色图标（左侧，类似真推紫星标位）
        const typeIcon = {
            reply: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#1d9bf0"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
            quote: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#00ba7c"><path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
            mention: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#1d9bf0"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>`,
            like: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#f91880"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
            retweet: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#00ba7c"><path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
            follow: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#1d9bf0"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`,
            event: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#f91880"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg>`
        };

        const actionLabel = {
            reply: I18n.t('tw.notif_replied', 'がリプライしました'),
            quote: I18n.t('tw.notif_quoted', 'があなたのツイートを引用しました'),
            mention: I18n.t('tw.notif_mentioned', 'があなたをメンションしました'),
            like: I18n.t('tw.notif_liked', 'があなたのツイートをいいねしました'),
            retweet: I18n.t('tw.notif_retweeted', 'があなたのツイートをリツイートしました'),
            follow: I18n.t('tw.notif_followed', 'があなたをフォローしました'),
            event: I18n.t('tw.notif_event', 'からのお知らせ')
        };

        container.innerHTML = tabBar + notifs.map(n => {
            const unreadClass = n.isRead ? '' : ' tw-notif-unread';
            const icon = typeIcon[n.type] || typeIcon.reply;
            const tlBlock = n.translation ? `<details class="tw-tl-block" onclick="event.stopPropagation()">
    <summary class="tw-tl-btn">${I18n.t('tw.action_translate', '訳')}</summary>
    <div class="tw-tl-content">${this._esc(n.translation)}</div>
</details>` : '';
            const displayName = n.fromName || n.senderName || I18n.t('tw.notif_user_default', 'ユーザー');
            const displayHandle = n.fromHandle || n.senderHandle || '';
            const avatarLetter = (n.fromAvatarLetter || displayName.charAt(0) || '?').toUpperCase();
            const avatarColor = n.fromAvatarColor || this._npcColor(n.fromNpcId || displayName);
            // follow 类型支持 followCount > 1：「○○など N 名にフォローされました」
            let action = actionLabel[n.type] || '';
            if (n.type === 'follow' && n.followCount && n.followCount > 1) {
                action = I18n.t('tw.notif_followed_count', {n: n.followCount});
            }
            const clickAction = n.targetTweetId ? `Twitter.openTweet('${this._esc(n.targetTweetId)}', false)` : '';
            const previewText = (n.content || '').slice(0, 80);

            return `<div class="tw-notif-item${unreadClass}" onclick="${clickAction}">
    <div class="tw-notif-icon">${icon}</div>
    <div class="tw-notif-body">
        <div class="tw-notif-avatar" style="background:${avatarColor}">${this._esc(avatarLetter)}</div>
        <div class="tw-notif-text">
            <div class="tw-notif-line"><span class="tw-notif-name">${this._esc(displayName)}</span>${displayHandle ? ` <span class="tw-notif-handle">${this._esc(displayHandle)}</span>` : ''}<span class="tw-notif-time">${this._timeAgo(n.timestamp)}</span></div>
            <div class="tw-notif-action">${action}</div>
            ${previewText ? `<div class="tw-notif-content">${this._esc(previewText)}</div>` : ''}
            ${tlBlock}
        </div>
    </div>
</div>`;
        }).join('');
    },

    markNotificationsRead() {
        const t = this._ensureData();
        (t.notifications || []).forEach(n => { n.isRead = true; });
        Utils.saveData();
        this._updateBadges();
        this.renderNotifications();
        Utils.showToast(I18n.t('t.tw_all_marked_read', '✓ 全て既読にしました'));
    },

    // ===== 私信列表页 =====
    renderDmList() {
        const t = this._ensureData();
        const container = document.getElementById('twitterDmListContent');
        if (!container) return;

        const npcs = AppState.data.broadcast.officialNpcs || [];
        const inboxDms = t.inboxDms || [];
        const unreadInbox = inboxDms.filter(d => !d.isRead).length;

        // 来信请求入口
        const inboxBtn = `<div class="tw-dm-inbox-btn" onclick="Twitter.renderInboxList()">
    <div style="display:flex;align-items:center;gap:10px;">
        <span style="color:var(--accent);">${this._svg.mailMd}</span>
        <div>
            <div style="font-weight:600;font-size:14px;">${I18n.t('tw.dm_msg_request', 'メッセージリクエスト')}</div>
            <div style="font-size:12px;color:var(--text-secondary);">${I18n.t('tw.dm_request_desc', 'ファン・合作からの来信')}</div>
        </div>
    </div>
    ${unreadInbox > 0 ? `<span class="tw-dm-inbox-count">${unreadInbox}</span>` : '<span style="color:var(--text-secondary);font-size:18px;">›</span>'}
</div>`;

        if (npcs.length === 0) {
            container.innerHTML = inboxBtn + `<div style="text-align:center;padding:30px 20px;color:var(--text-secondary);">${I18n.t('tw.dm_add_npc_in_broadcast', '放送局でNPCを追加すると<br>DMを送れます')}</div>`;
            return;
        }

        // NPC 对话列表（按最新消息时间排序）
        const npcItems = npcs.map(n => {
            const msgs = (t.dms[n.id] || []);
            const lastMsg = msgs[msgs.length - 1];
            const preview = lastMsg ? lastMsg.content.slice(0, 30) + (lastMsg.content.length > 30 ? '…' : '') : I18n.t('tw.dm_send_hint', 'DMを送ってみましょう');
            const avatar = (n.name || n.role || '？').charAt(0).toUpperCase();
            const color = this._npcColor(n.id);
            return {
                timestamp: lastMsg?.timestamp || 0,
                html: `<div class="tw-dm-list-item" onclick="Twitter.openDm('${this._esc(n.id)}')">
    ${n.avatarImage
        ? `<img class="tw-card-avatar tw-avatar-img" src="${Utils.escAttr(n.avatarImage)}" alt="" style="flex-shrink:0">`
        : `<div class="tw-card-avatar" style="background:${color};flex-shrink:0;">${this._esc(avatar)}</div>`}
    <div class="tw-dm-list-body">
        <div class="tw-dm-list-name">${this._esc(n.name || n.role)}</div>
        <div class="tw-dm-list-preview">「${this._esc(preview)}」</div>
    </div>
    <div style="font-size:12px;color:var(--text-secondary);flex-shrink:0;">${this._timeAgo(lastMsg?.timestamp)}</div>
</div>`
            };
        }).sort((a, b) => b.timestamp - a.timestamp).map(item => item.html);

        container.innerHTML = inboxBtn + npcItems.join('');
    },

    renderInboxList() {
        const t = this._ensureData();
        const container = document.getElementById('twitterDmListContent');
        if (!container) return;

        const inboxDms = t.inboxDms || [];

        const backBtn = `<div class="tw-dm-list-item" onclick="Twitter.renderDmList()" style="border-bottom:2px solid var(--border);padding:10px 16px;">
    <span style="font-size:18px;">‹</span>
    <span style="font-weight:600;font-size:14px;margin-left:8px;">${I18n.t('tw.dm_msg_request', 'メッセージリクエスト')}</span>
</div>`;

        if (inboxDms.length === 0) {
            container.innerHTML = backBtn + `<div class="empty-state" style="padding-top:40px;"><div style="margin-bottom:10px;color:var(--text-secondary);">${this._svg.mailLg}</div><div>${I18n.t('tw.empty_no_inbox', 'まだ来信がありません')}</div></div>`;
            return;
        }

        const items = [...inboxDms].sort((a, b) => b.timestamp - a.timestamp).map(dm => {
            const lastMsg = dm.messages[dm.messages.length - 1];
            const preview = lastMsg ? lastMsg.content.slice(0, 35) + (lastMsg.content.length > 35 ? '…' : '') : '';
            const avatarColor = dm.senderType === 'collab' ? '#794bc4' : '#888';
            const avatar = (dm.senderName || '？').charAt(0).toUpperCase();
            const unreadDot = !dm.isRead ? `<span class="tw-dm-unread-dot"></span>` : '';
            return `<div class="tw-dm-list-item" onclick="Twitter.openInboxDm('${this._esc(dm.id)}')">
    <div class="tw-card-avatar" style="background:${avatarColor};flex-shrink:0;">${this._esc(avatar)}</div>
    <div class="tw-dm-list-body">
        <div class="tw-dm-list-name">${this._esc(dm.senderName)} <span style="font-size:12px;color:var(--text-secondary);">${this._esc(dm.senderHandle)}</span></div>
        <div class="tw-dm-list-preview">${this._esc(preview)}</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
        <span style="font-size:12px;color:var(--text-secondary);">${this._timeAgo(dm.timestamp)}</span>
        ${unreadDot}
    </div>
</div>`;
        });

        container.innerHTML = backBtn + items.join('');
    },

    openInboxDm(dmId) {
        const t = this._ensureData();
        const dm = (t.inboxDms || []).find(d => d.id === dmId);
        if (!dm) return;

        dm.isRead = true;
        Utils.saveData();
        this._updateBadges();

        this.currentDmNpcId = null;
        this.currentInboxDmId = dmId;
        this.currentDmMode = 'inbox';
        Navigation.goTo('twitter-dm');
    },

    // 复用 renderDm() 但支持 inbox 模式
    renderDm() {
        const t = this._ensureData();

        if (this.currentDmMode === 'inbox') {
            const dm = (t.inboxDms || []).find(d => d.id === this.currentInboxDmId);
            if (!dm) { Navigation.goTo('twitter-dm-list'); return; }

            const avatarEl = document.getElementById('twDmAvatar');
            const nameEl = document.getElementById('twDmName');
            const handleEl = document.getElementById('twDmHandle');
            const avatarColor = dm.senderType === 'collab' ? '#794bc4' : '#888';
            if (avatarEl) { avatarEl.textContent = (dm.senderName || '？').charAt(0).toUpperCase(); avatarEl.style.background = avatarColor; }
            if (nameEl) nameEl.textContent = dm.senderName || I18n.t('tw.dm_msg_request', '来信');
            if (handleEl) handleEl.textContent = dm.senderHandle || '@user';

            this._renderInboxDmMessages(dm);
            return;
        }

        // Fan Friend DM
        const fan = this._getFanFriend(this.currentDmNpcId);
        if (fan) {
            this.currentDmMode = 'fan';
            const avatarEl = document.getElementById('twDmAvatar');
            const nameEl = document.getElementById('twDmName');
            const handleEl = document.getElementById('twDmHandle');
            if (avatarEl) { avatarEl.textContent = fan.name.charAt(0).toUpperCase(); avatarEl.style.background = fan.avatarColor; }
            if (nameEl) nameEl.textContent = fan.name;
            if (handleEl) handleEl.textContent = fan.handle;
            this._renderDmMessages();
            return;
        }

        // 原 NPC DM 逻辑
        this.currentDmMode = 'npc';
        if (!this.currentDmNpcId) { Navigation.goTo('twitter'); return; }
        const npc = this._getNpc(this.currentDmNpcId);
        if (!npc) { Navigation.goTo('twitter'); return; }

        const avatarEl = document.getElementById('twDmAvatar');
        const nameEl = document.getElementById('twDmName');
        const handleEl = document.getElementById('twDmHandle');
        const npcName = npc.name || npc.role;
        const color = this._npcColor(npc.id);
        if (avatarEl) { avatarEl.textContent = npcName.charAt(0).toUpperCase(); avatarEl.style.background = color; }
        if (nameEl) nameEl.textContent = npcName;
        if (handleEl) handleEl.textContent = this._getNpcHandle(npc);

        this._renderDmMessages();
    },

    // NPC DM 消息渲染
    _renderDmMessages() {
        const t = this._ensureData();
        const container = document.getElementById('twitterDmMessages');
        if (!container || !this.currentDmNpcId) return;

        const msgs = t.dms[this.currentDmNpcId] || [];
        if (msgs.length === 0) {
            const npc = this._getNpc(this.currentDmNpcId);
            const fan = !npc ? this._getFanFriend(this.currentDmNpcId) : null;
            const displayName = npc ? (npc.name || npc.role) : (fan ? fan.name : 'NPC');
            container.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--text-secondary);font-size:14px;">${I18n.t('tw.empty_dm_send', {name: this._esc(displayName)})}</div>`;
        } else {
            container.innerHTML = msgs.map(m => {
                const isUser = m.role === 'user';
                return `<div class="tw-dm-msg ${isUser ? 'tw-dm-msg-user' : 'tw-dm-msg-npc'}">
    <div class="tw-dm-bubble">${this._esc(m.content).replace(/\n/g, '<br>')}</div>
    <div class="tw-dm-time">${this._timeAgo(m.timestamp)}</div>
</div>`;
            }).join('');
        }
        container.scrollTop = container.scrollHeight;
    },

    _renderInboxDmMessages(dm) {
        const container = document.getElementById('twitterDmMessages');
        if (!container) return;

        const msgs = dm.messages || [];
        if (msgs.length === 0) {
            container.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--text-secondary);font-size:14px;">${I18n.t('tw.empty_inbox_msg_from', {name: this._esc(dm.senderName)})}</div>`;
        } else {
            container.innerHTML = msgs.map(m => {
                const isUser = m.role === 'user';
                return `<div class="tw-dm-msg ${isUser ? 'tw-dm-msg-user' : 'tw-dm-msg-npc'}">
    <div class="tw-dm-bubble">${this._esc(m.content).replace(/\n/g, '<br>')}</div>
    <div class="tw-dm-time">${this._timeAgo(m.timestamp)}</div>
</div>`;
            }).join('');
        }
        container.scrollTop = container.scrollHeight;
    },

    // sendDm 路由到正确处理器
    async sendDm() {
        if (this.currentDmMode === 'inbox') {
            await this._sendInboxDmReply();
            return;
        }
        if (this.currentDmMode === 'fan') {
            await this._sendFanDmReply();
            return;
        }
        // 原 NPC DM 逻辑
        const input = document.getElementById('twitterDmInput');
        const content = input?.value.trim();
        if (!content || !this.currentDmNpcId) return;

        const t = this._ensureData();
        if (!t.dms[this.currentDmNpcId]) t.dms[this.currentDmNpcId] = [];

        t.dms[this.currentDmNpcId].push({
            id: Utils.generateId(),
            role: 'user',
            content,
            timestamp: Date.now()
        });
        if (input) { input.value = ''; input.style.height = 'auto'; }
        this._renderDmMessages();

        const sendBtn = document.querySelector('.tw-dm-send-btn');
        if (sendBtn) sendBtn.disabled = true;

        try {
            const npc = this._getNpc(this.currentDmNpcId);
            const npcName = npc ? (npc.name || npc.role) : 'NPC';
            const forumData = AppState.data.forumData || {};
            const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
            const history = t.dms[this.currentDmNpcId].slice(-10);

            const systemPrompt = `あなたはアニメ作品の${npcName}（${npc?.role || '公式NPC'}）としてロールプレイしています。
X（Twitter）のDMでファンとチャットしています。

キャラクター設定:
${worldContext || '（未設定 — 具体的なキャラ名・CP・ストーリーを捏造しないこと）'}

⚠️ 情報開示の制限: キャラクターとして設定を「知っている」が、ファンとのカジュアルなDMで自分から過去や秘密を語り出さないこと。相手から具体的に聞かれた場合のみ、キャラクターらしくはぐらかすか、軽く触れる程度にすること。

ルール:
- ${npcName}としてキャラクターを維持すること
- キャラクターの口調や話し方に合わせて自然な日本語で返信すること
- DM返信は簡潔に（最大1〜5行）
- 上記の設定にないストーリーイベントを捏造しないこと
- 温かく、本物らしく、魅力的な対話にすること
- 動画演出（フラッシュバック・ナレーション・モンタージュ等）は観客向けの映像技法であり、キャラクターが実際に目撃したものではない`;

            const messages = history.map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content
            }));

            const raw = await Utils.callChatAPI(messages, systemPrompt);
            t.dms[this.currentDmNpcId].push({
                id: Utils.generateId(),
                role: 'npc',
                content: raw.trim(),
                timestamp: Date.now()
            });

            Utils.saveData();
            this._renderDmMessages();
        } catch (e) {
            Utils.showToast(I18n.t('t.tw_send_failed', '送信失敗：') + e.message);
        } finally {
            if (sendBtn) sendBtn.disabled = false;
        }
    },

    async _sendInboxDmReply() {
        const input = document.getElementById('twitterDmInput');
        const content = input?.value.trim();
        if (!content || !this.currentInboxDmId) return;

        const t = this._ensureData();
        const dm = (t.inboxDms || []).find(d => d.id === this.currentInboxDmId);
        if (!dm) return;

        dm.messages.push({ id: Utils.generateId(), role: 'user', content, timestamp: Date.now() });
        if (input) { input.value = ''; input.style.height = 'auto'; }
        this._renderInboxDmMessages(dm);

        const sendBtn = document.querySelector('.tw-dm-send-btn');
        if (sendBtn) sendBtn.disabled = true;

        try {
            const forumData = AppState.data.forumData || {};
            const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
            const history = dm.messages.slice(-8);
            const senderDesc = dm.senderType === 'collab' ? 'コラボを求める企業・クリエイター' : '熱心なファン';

            const systemPrompt = `あなたは${dm.senderName}（${dm.senderHandle}）としてロールプレイしています。${senderDesc}として、X（Twitter）のDMで公式アニメアカウントとチャットしています。

作品設定（以下の内容を超えて捏造しないこと）:
${worldContext || '（未設定 — 具体的なキャラ名・CP・ストーリーを捏造しないこと）'}
${Utils.PROMPTS.infoAccessRule()}
ルール:
- ペルソナに合わせて自然な日本語で返信すること
- 最大1〜4行
- 上記の設定にないストーリーイベントを捏造しないこと`;

            const messages = history.map(m => ({
                role: m.role === 'user' ? 'assistant' : 'user',
                content: m.content
            }));

            const raw = await Utils.callChatAPI(messages, systemPrompt);
            dm.messages.push({ id: Utils.generateId(), role: 'sender', content: raw.trim(), timestamp: Date.now() });
            dm.timestamp = Date.now();

            Utils.saveData();
            this._renderInboxDmMessages(dm);
        } catch (e) {
            Utils.showToast(I18n.t('t.tw_send_failed', '送信失敗：') + e.message);
        } finally {
            if (sendBtn) sendBtn.disabled = false;
        }
    },

    async _sendFanDmReply() {
        const input = document.getElementById('twitterDmInput');
        const content = input?.value.trim();
        if (!content || !this.currentDmNpcId) return;

        const t = this._ensureData();
        const fan = this._getFanFriend(this.currentDmNpcId);
        if (!fan) return;

        if (!t.dms[fan.id]) t.dms[fan.id] = [];
        t.dms[fan.id].push({ id: Utils.generateId(), role: 'user', content, timestamp: Date.now() });
        if (input) { input.value = ''; input.style.height = 'auto'; }
        this._renderDmMessages();

        const sendBtn = document.querySelector('.tw-dm-send-btn');
        if (sendBtn) sendBtn.disabled = true;

        try {
            const forumData = AppState.data.forumData || {};
            const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
            const identity = this._getActiveIdentity();
            const history = t.dms[fan.id].slice(-10);

            // ユーザーの身分に応じて反応を変える
            let identityContext;
            if (identity.type === 'official') {
                identityContext = `相手は「${identity.name}」（${identity.handle}）という公式スタッフアカウントです。
あなたは公式の人からDMをもらって驚いています。敬意と緊張感を持ちつつ、嬉しさを隠せない感じで対応してください。`;
            } else if (identity.type === 'npc') {
                identityContext = `相手は「${identity.name}」（${identity.handle}）という作品関係者アカウントです。
業界の人からのDMに少し緊張しつつ対応してください。`;
            } else {
                identityContext = `相手は「${identity.name}」（${identity.handle}）という一般ファンアカウントです。
同じファン仲間として気軽に、楽しく対応してください。`;
            }

            const systemPrompt = `あなたは${fan.name}（${fan.handle}）としてロールプレイしています。
タイプ: ${this._fanTypeLabel(fan.type)}
${fan.bio ? 'プロフィール: ' + fan.bio : ''}

X（Twitter）のDMで会話しています。

${identityContext}

作品設定（以下の内容を超えて捏造しないこと）:
${worldContext || '（未設定 — 具体的なキャラ名・CP・ストーリーを捏造しないこと）'}
${Utils.PROMPTS.infoAccessRule()}
ルール:
- ${fan.name}として自然な日本語で返信すること
- タイプに合った口調と話題で会話すること（同人作家なら創作の話、CP厨なら推しカプの話など）
- DM返信は簡潔に（1〜5行）
- 上記の設定にないストーリーイベントを捏造しないこと
- 温かく、リアルな対話にすること`;

            const messages = history.map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content
            }));

            const raw = await Utils.callChatAPI(messages, systemPrompt);
            t.dms[fan.id].push({ id: Utils.generateId(), role: 'npc', content: raw.trim(), timestamp: Date.now() });

            Utils.saveData();
            this._renderDmMessages();
        } catch (e) {
            Utils.showToast(I18n.t('t.tw_send_failed', '送信失敗：') + e.message);
        } finally {
            if (sendBtn) sendBtn.disabled = false;
        }
    },

    async _generateInboxDms(tweetId) {
        const t = this._ensureData();
        const tweet = (t.tweets || []).find(tw => tw.id === tweetId);
        if (!tweet) return;

        const forumData = AppState.data.forumData || {};
        const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
        const identity = this._getActiveIdentity();

        const systemPrompt = `あなたは公式アニメアカウントへの受信X（Twitter）DMをシミュレーションしています。
ファンやコラボ希望者からのリアルな受信DM1〜2件を生成してください。

アカウント: ${this._esc(identity.name)} (${this._esc(identity.handle)})
作品設定（以下の内容を超えて捏造しないこと）:
${worldContext || '（未設定 — 具体的なキャラ名・CP・ストーリーを捏造しないこと）'}
${Utils.PROMPTS.infoAccessRule()}
送信者タイプ:
- fan: 熱心なファン（カジュアルな日本語、個人的なトーン）
- collab: コラボを求める企業・クリエイター（丁寧な日本語）

出力フォーマット（厳守）:
---INBOXDM---
SENDER_NAME: [名前]
SENDER_HANDLE: [@handle]
SENDER_TYPE: [fan/collab]
CONTENT: [DMテキスト、自然な日本語で2〜4文]

1〜2件のDMを生成すること。`;

        const messages = [{ role: 'user', content: `官方ツイート：${tweet.content}\n\nこれに触発されたDMを生成してください。` }];
        const raw = await Utils.callChatAPI(messages, systemPrompt);

        const blocks = raw.split(/---\s*INBOXDM\s*---/i).map(s => s.trim()).filter(Boolean);
        const now = Date.now();
        for (const block of blocks) {
            const senderName = (block.match(/^SENDER_NAME:\s*(.+)$/m) || [])[1]?.trim() || 'ファン';
            const senderHandle = (block.match(/^SENDER_HANDLE:\s*(.+)$/m) || [])[1]?.trim() || '@user';
            const senderTypeRaw = (block.match(/^SENDER_TYPE:\s*(.+)$/m) || [])[1]?.trim() || 'fan';
            const senderType = ['fan', 'collab'].includes(senderTypeRaw) ? senderTypeRaw : 'fan';
            const contentMatch = block.match(/CONTENT:[ \t]*\n?([\s\S]*?)(?=\nSENDER_|\s*$)/);
            const content = contentMatch ? contentMatch[1].trim() : '';
            if (!content) continue;

            t.inboxDms.unshift({
                id: Utils.generateId(),
                senderName, senderHandle, senderType,
                messages: [{ id: Utils.generateId(), role: 'sender', content, timestamp: now }],
                isRead: false,
                timestamp: now
            });
        }

        // 来信最多保留 50 条
        if (t.inboxDms.length > 50) t.inboxDms = t.inboxDms.slice(0, 50);
        Utils.saveData();
        this._updateBadges();
    },

    // ===== いいね =====
    toggleLike(tweetId, isNpc, btn) {
        const t = this._ensureData();
        const tweet = [...(t.npcTweets || []), ...(t.tweets || [])].find(tw => tw.id === tweetId);
        const idx = (t.likedTweetIds || []).findIndex(l => l.id === tweetId);
        const liking = idx < 0;
        if (!liking) {
            t.likedTweetIds.splice(idx, 1);
            if (tweet) tweet.likes = Math.max(0, (tweet.likes || 0) - 1);
        } else {
            if (!t.likedTweetIds) t.likedTweetIds = [];
            t.likedTweetIds.push({ id: tweetId, isNpc, timestamp: Date.now() });
            // 上限 200
            if (t.likedTweetIds.length > 200) t.likedTweetIds = t.likedTweetIds.slice(-200);
            if (tweet) tweet.likes = (tweet.likes || 0) + 1;
        }
        if (btn) {
            btn.classList.toggle('tw-liked', liking);
            // pop 动画挂一次性 class：只在「刚点赞」瞬间弹，列表重渲已点赞状态不弹
            btn.classList.toggle('tw-like-pop', liking);
            if (liking) btn.addEventListener('animationend', () => btn.classList.remove('tw-like-pop'), { once: true });
            const icon = liking ? this._svg.heartFilled : this._svg.heart;
            if (tweet) {
                // 找到推文：同步更新点赞数显示（修复「图标变红但数字不变」）
                btn.innerHTML = `${icon}<span>${tweet.likes > 0 ? this._fmtNum(tweet.likes) : ''}</span>`;
            } else {
                // 边界：找不到推文对象时退回原行为（只换图标、保留原计数）
                btn.querySelector('svg')?.replaceWith(Object.assign(document.createElement('span'), { innerHTML: icon }).firstChild);
            }
        }
        Utils.saveData();
    },

    // ===== 検索ページ =====
    renderSearch() {
        const container = document.getElementById('twitterSearchContent');
        if (!container) return;
        const qVal = this._esc(this._searchQuery);
        const searchIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
        container.innerHTML = `
<div class="tw-search-bar-wrap">
    <span class="tw-search-bar-icon">${searchIcon}</span>
    <input type="text" class="tw-search-input" id="twSearchInput" placeholder="${I18n.t('tw.search_placeholder', 'キーワードで検索')}" value="${qVal}" onkeydown="if(event.key==='Enter')Twitter._doSearch()">
    ${this._searchQuery ? `<button class="tw-search-clear" onclick="Twitter._clearSearch()" title="${I18n.t('tw.search_clear', 'クリア')}">×</button>` : ''}
</div>
<div id="twSearchBody"></div>`;
        this._renderSearchBody();

        // 从热搜/通知跳转过来时自动执行搜索
        if (this._pendingSearchTag) {
            const input = document.getElementById('twSearchInput');
            if (input) input.value = this._pendingSearchTag;
            this._pendingSearchTag = null;
            this._doSearch();
        }
    },

    _clearSearch() {
        this._searchQuery = '';
        this._searchResults = [];
        this.renderSearch();
    },

    _renderSearchBody() {
        const body = document.getElementById('twSearchBody');
        if (!body) return;
        if (this._searchQuery && this._searchResults.length > 0) {
            body.innerHTML = `<div class="tw-search-results-label">${I18n.t('tw.search_results_for', {q: this._esc(this._searchQuery)})}</div>` +
                this._searchResults.map(tw => this._renderSearchTweetCard(tw)).join('');
            return;
        }
        // Live Spaces 发现区（顶部）
        const liveSpacesHtml = this._renderLiveSpacesDiscover();
        this._renderSearchTrends(body);
        if (liveSpacesHtml) body.insertAdjacentHTML('afterbegin', liveSpacesHtml);
    },

    _renderLiveSpacesDiscover() {
        const t = this._ensureData();
        const live = (t.spaces || []).filter(s => s.status === 'live');
        if (live.length === 0) return '';
        const cards = live.slice(0, 5).map(s => {
            const npc = this._getNpc(s.hostNpcId);
            const hostName = npc ? (npc.name || npc.role) : I18n.t('tw.space_host_default', 'ホスト');
            const listenerStr = s.listenerCount ? `${this._svg.headphones} ${this._fmtNum(s.listenerCount)}` : '';
            return `<div class="tw-discover-space" onclick="Twitter.openSpace('${this._esc(s.id)}')">
    <div class="tw-discover-space-live"><span class="tw-space-live-dot"></span>${I18n.t('tw.space_live_now', 'ライブ中')}</div>
    <div class="tw-discover-space-title">${this._esc(s.title)}</div>
    <div class="tw-discover-space-meta">${this._esc(hostName)}${listenerStr ? ' · ' + listenerStr : ''}</div>
</div>`;
        }).join('');
        return `<div class="tw-discover-section">
    <div class="tw-discover-header">
        <span>${this._svg.radio} ${I18n.t('tw.space_live_section_title', 'ライブ中のスペース')}</span>
        <span class="tw-discover-more" onclick="Twitter.showAllSpaces()">${I18n.t('tw.space_view_all', 'すべて ›')}</span>
    </div>
    <div class="tw-discover-spaces-row">${cards}</div>
</div>`;
    },

    _renderSearchTrends(body) {
        const t = this._ensureData();
        const trends = t.trends || [];
        if (trends.length === 0) {
            body.innerHTML = `
<div class="tw-trends-empty-rich">
    <div class="tw-trends-empty-icon">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-secondary);opacity:.4">
            <line x1="12" y1="20" x2="12" y2="10"/>
            <line x1="18" y1="20" x2="18" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="16"/>
        </svg>
    </div>
    <div class="tw-trends-empty-title">${I18n.t('tw.empty_trends_title', 'トレンドはまだありません')}</div>
    <div class="tw-trends-empty-desc">${I18n.t('tw.empty_trends_desc', 'ホーム画面の 🔄 でタイムラインを更新すると、業界・ファン中で話題のトレンドが自動生成されます。')}</div>
    <button class="tw-trends-empty-btn" onclick="Navigation.goTo('twitter');setTimeout(()=>Twitter.refreshTimeline(),300)">${I18n.t('tw.empty_trends_btn', 'タイムラインへ移動')}</button>
</div>`;
            return;
        }
        body.innerHTML = `<div class="tw-search-section-title">${I18n.t('tw.search_current_trends', 'いまトレンド')}</div>` +
            trends.map((tr, i) => `<div class="tw-trend-item tw-trend-clickable" onclick="Twitter._searchFromTrend('${this._escJsAttr(tr.tag)}')">
    <div class="tw-trend-rank">${i + 1}</div>
    <div class="tw-trend-info">
        <div class="tw-trend-tag">${this._esc(tr.tag)}</div>
        <div class="tw-trend-count">${I18n.t('tw.search_trend_count', {n: this._esc(tr.count)})}</div>
    </div>
    <div style="color:var(--text-secondary);font-size:20px;padding-right:4px;">›</div>
</div>`).join('');
    },


    async _doSearch() {
        const input = document.getElementById('twSearchInput');
        const query = input?.value.trim();
        if (!query) return;
        this._searchQuery = query;
        const body = document.getElementById('twSearchBody');
        if (body) body.innerHTML = `<div style="padding:40px 16px;text-align:center;"><div class="spinner" style="margin:0 auto 12px;"></div><div style="color:var(--text-secondary);font-size:14px;">${I18n.t('tw.search_searching', {q: this._esc(query)})}</div></div>`;
        try {
            this._searchResults = await this._generateSearchTweets(query);
            this._renderSearchBody();
        } catch (e) {
            Utils.showToast(I18n.t('t.tw_search_failed', '検索失敗：') + e.message);
        }
    },

    async _generateSearchTweets(query) {
        const forumData = AppState.data.forumData || {};
        const worldContext = typeof Forum !== 'undefined' ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
        const systemPrompt = `あなたは日本語アニメX（Twitter）の検索結果ページをシミュレーションしています。
ユーザーの検索ワード: 「${query}」
この検索キーワードに関連するファン、メディアアカウント、業界関係者からのリアルなツイートを5〜7件生成してください。

作品設定（以下の事実のみ使用し、捏造しないこと）:
${worldContext || '（未設定 — 具体的なキャラ名・CP・ストーリーを捏造しないこと）'}
${Utils.PROMPTS.infoAccessRule()}
ルール:
- すべてのツイートが検索キーワードと明確に関連していること
- 混ぜること: ファン (fan) / 業界 (industry) / メディア (media)
- 自然な日本語Twitter: 絵文字、ハッシュタグ、カジュアルなトーン
- 未公開のストーリーイベントを捏造しないこと

出力フォーマット（厳守）:
---STWEET---
NAME: [アカウント名]
HANDLE: [@handle]
TYPE: [fan/industry/media]
CONTENT: [日本語のツイート本文、1-4行]
TRANSLATION: [中国語（簡体字）翻訳、1行]

5〜7件の結果を生成すること。`;

        const messages = [{ role: 'user', content: `「${query}」で検索してください。` }];
        const raw = await Utils.callChatAPI(messages, systemPrompt);
        return this._parseSearchTweets(raw);
    },

    _parseSearchTweets(text) {
        const blocks = text.split(/---\s*STWEET\s*---/i).map(s => s.trim()).filter(Boolean);
        const now = Date.now();
        return blocks.map((block, i) => {
            const name = (block.match(/^NAME:\s*(.+)$/m) || [])[1]?.trim() || 'ファン';
            const handle = (block.match(/^HANDLE:\s*(.+)$/m) || [])[1]?.trim() || '@user';
            const rawType = (block.match(/^TYPE:\s*(.+)$/m) || [])[1]?.trim() || 'fan';
            const type = ['fan', 'industry', 'media'].includes(rawType) ? rawType : 'fan';
            const contentMatch = block.match(/CONTENT:[ \t]*\n?([\s\S]*?)(?=\nTRANSLATION:|\s*$)/);
            const content = contentMatch ? contentMatch[1].trim() : '';
            const tlMatch = block.match(/^TRANSLATION:[ \t]*(.+)$/m);
            const translation = tlMatch ? tlMatch[1].trim() : null;
            if (!content) return null;
            const eng = this._genEngagement('fan', type);
            return {
                id: Utils.generateId(),
                source: 'search',
                authorName: name,
                authorHandle: handle,
                authorType: type,
                content,
                translation,
                timestamp: now - i * 3600000,
                replies: [],
                likes: eng.likes,
                retweets: eng.retweets,
                savedToForumId: null
            };
        }).filter(Boolean);
    },

    _searchFromTrend(tag) {
        this._searchQuery = tag;
        this._pendingSearchTag = tag;
        Navigation.goTo('twitter-search');
    },

    _renderSearchTweetCard(tw) {
        const t = this._ensureData();
        const name = tw.authorName || 'ファン';
        const handle = tw.authorHandle || '@user';
        const avatarLetter = name.charAt(0).toUpperCase();
        const avatarColor = this._fanTypeColor(tw.authorType);
        const likesStr = this._fmtNum(tw.likes || 0);
        const rtStr = this._fmtNum(tw.retweets || 0);
        const tweetIdEsc = this._esc(tw.id);
        const isLiked = (t.likedTweetIds || []).some(l => l.id === tw.id);
        const tlBlock = tw.translation ? `<details class="tw-tl-block" onclick="event.stopPropagation()">
    <summary class="tw-tl-btn">${I18n.t('tw.action_translate', '訳')}</summary>
    <div class="tw-tl-content">${this._esc(tw.translation)}</div>
</details>` : '';
        return `<div class="tw-card" onclick="Twitter._openSearchTweet('${tweetIdEsc}')">
    <div class="tw-card-avatar tw-avatar-link" style="background:${avatarColor};" onclick="event.stopPropagation();Twitter._openSearchProfile('${tweetIdEsc}')">${this._esc(avatarLetter)}</div>
    <div class="tw-card-body">
        <div class="tw-card-header">
            <span class="tw-name tw-name-link" onclick="event.stopPropagation();Twitter._openSearchProfile('${tweetIdEsc}')">${this._esc(name)}</span>
            <span class="tw-handle">${this._esc(handle)}</span>
            <span class="tw-time">${this._timeAgo(tw.timestamp)}</span>
        </div>
        <div class="tw-content">${this._linkifyContent(tw.content)}</div>
        ${tlBlock}
        <div class="tw-card-footer">
            <span class="tw-engage-count">${this._svg.retweet} ${rtStr}</span>
            <button class="tw-engage-count tw-search-like${isLiked ? ' tw-liked' : ''}" onclick="event.stopPropagation();Twitter._toggleSearchLike('${tweetIdEsc}', this)" title="${I18n.t('tw.action_like', 'いいね')}">${isLiked ? this._svg.heartFilled : this._svg.heart}<span>${likesStr}</span></button>
        </div>
    </div>
</div>`;
    },

    // ===== 检索ツイート → npcTweets 注入（懒持久化）=====
    _injectSearchTweet(id) {
        const t = this._ensureData();
        const stw = (this._searchResults || []).find(tw => tw.id === id);
        if (!stw) return null;
        t.npcTweets = t.npcTweets || [];
        let existing = t.npcTweets.find(tw => tw.id === id);
        if (!existing) {
            existing = {
                id: stw.id,
                source: 'fan',
                fromSearch: true,
                authorName: stw.authorName,
                authorHandle: stw.authorHandle,
                authorType: stw.authorType,
                content: stw.content,
                translation: stw.translation,
                timestamp: stw.timestamp,
                replies: stw.replies || [],
                likes: stw.likes || 0,
                retweets: stw.retweets || 0
            };
            t.npcTweets.push(existing);
            // 検索注入の上限 30 件
            const fromSearchTweets = t.npcTweets.filter(tw => tw.fromSearch);
            if (fromSearchTweets.length > 30) {
                const keepIds = new Set(fromSearchTweets.slice(-30).map(tw => tw.id));
                t.npcTweets = t.npcTweets.filter(tw => !tw.fromSearch || keepIds.has(tw.id));
            }
            Utils.saveData();
        }
        return existing;
    },

    _openSearchTweet(id) {
        if (!this._injectSearchTweet(id)) return;
        this.currentTweetId = id;
        this.currentTweetIsNpc = true;
        Navigation.goTo('twitter-thread');
    },

    _openSearchProfile(id) {
        if (!this._injectSearchTweet(id)) return;
        this.openFanPreview(id);
    },

    _toggleSearchLike(id, btn) {
        if (!this._injectSearchTweet(id)) return;
        this.toggleLike(id, true, btn);
    },

});
