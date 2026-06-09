const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%23e8e8e8'/%3E%3Ccircle cx='20' cy='16' r='7' fill='%23bbb'/%3E%3Cellipse cx='20' cy='34' rx='12' ry='8' fill='%23bbb'/%3E%3C/svg%3E";

// ===== インライン SVG アイコン（控件位 emoji 廃止・currentColor で配色追従、深浅テーマ両対応） =====
// 範本：js/niconico.js の _SVG。viewBox 0 0 24 24・stroke=currentColor・stroke-width=2。
const LINE_SVG = {
    // 财布（钱包）— 主页 Pay 入口 / 钱包默认交易图标的备选
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1"/><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="13" r="1.2" fill="currentColor" stroke="none"/></svg>',
    // 购物袋（メロン入口 / purchase 取引）
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/></svg>',
    // 笑脸（贴图/表情入口）
    smile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4 4 0 0 0 7 0"/><circle cx="9" cy="9.5" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="9.5" r="1" fill="currentColor" stroke="none"/></svg>',
    // 齿轮（设置）
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    // 刷新（环形箭头）— Voom 加载新 / 消息重新生成
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
    // 对话气泡（Voom 评论计数 / 聊天空状态）
    comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-9 8.5 9.5 9.5 0 0 1-4-.9L3 21l1.9-5a8.5 8.5 0 0 1-.9-4 8.38 8.38 0 0 1 8.5-9 8.38 8.38 0 0 1 8.5 8.4z"/></svg>',
    // 信用卡（充值 / charge / 默认交易图标）
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
    // 送金（右上转账箭头）
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M9 7h8v8"/></svg>',
    // 履历（列表）
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg>',
    // 图钉（聊天置顶）
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6l-1 6 3 3v2H7v-2l3-3z"/><path d="M12 15v5"/></svg>',
    // 静音喇叭（聊天静音）
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>',
    // 双人（群组前缀）
    group: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 6a3 3 0 0 1 0 6"/><path d="M17 13.5a5.5 5.5 0 0 1 4 5.5"/></svg>',
    // 垃圾桶（删除）
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6"/></svg>',
    // 电视（niconico 分享来源）
    tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 3l4 4 4-4"/></svg>',
    // 视频占位（分享卡：niconico 封面）
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5v5l4-2.5z" fill="currentColor" stroke="none"/></svg>',
    // 商品占位（分享卡：melon 封面 — 书本）
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h13"/></svg>',
    // 钱币（转账卡标题）
    coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5a2 2 0 0 1 2-1.5h1a2 2 0 0 1 0 4h-1a2 2 0 0 0 0 4h1a2 2 0 0 0 2-1.5"/></svg>'
};

// ===== LINE 容器路由 =====
const Line = {
    currentTab: 'talk',
    _tabs: ['home', 'talk', 'voom', 'wallet'],

    init() {
        if (!AppState.data.wallet) {
            AppState.data.wallet = { balance: 10000, transactions: [] };
        }
        if (!AppState.data.voom) {
            AppState.data.voom = { posts: [] };
        }
    },

    show(initialTab) {
        this.init();
        const container = document.getElementById('line-container');
        if (!container) return;

        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        container.classList.add('active');
        AppState.currentScreen = 'line-container';

        this.switchTab(initialTab || 'talk');
    },

    hide() {
        const container = document.getElementById('line-container');
        if (container) container.classList.remove('active');
        Navigation.goTo('desktop');
    },

    switchTab(tab) {
        if (!this._tabs.includes(tab)) return;
        this.currentTab = tab;

        this._tabs.forEach(t => {
            const screen = document.getElementById(`line-${t}`);
            if (screen) screen.style.display = t === tab ? 'flex' : 'none';
        });

        document.querySelectorAll('.line-tab').forEach(el => {
            el.classList.toggle('active', el.dataset.tab === tab);
        });

        this._updateBadges();

        if (tab === 'talk') {
            // 确保显示聊天列表（而不是对话视图）
            const listView = document.getElementById('line-talk-list');
            const convView = document.getElementById('line-talk-conversation');
            if (listView) listView.style.display = 'flex';
            if (convView) convView.style.display = 'none';
            ChatList.render();
        }
        if (tab === 'home') LineHome.render();
        if (tab === 'voom') LineVoom.render();
        if (tab === 'wallet') LinePay.render();
    },

    _updateBadges() {
        const meta = AppState.data.chatMeta || {};
        let totalUnread = 0;
        Object.values(meta).forEach(m => { totalUnread += (m.unreadCount || 0); });

        const badge = document.getElementById('line-talk-badge');
        if (badge) {
            if (totalUnread > 0) {
                badge.textContent = totalUnread > 99 ? '99+' : totalUnread;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    },

    openConversation(id) {
        this.switchTab('talk');
        const listView = document.getElementById('line-talk-list');
        const convView = document.getElementById('line-talk-conversation');
        if (listView) listView.style.display = 'none';
        if (convView) convView.style.display = 'flex';

        if (id.startsWith('grp_')) {
            const group = (AppState.data.groups || []).find(g => 'grp_' + g.id === id);
            if (!group) return;
            Conversation.initGroup(group);
        } else {
            const char = AppState.data.characters.find(c => c.id === id);
            if (!char) return;
            Conversation.init(char);
        }
    },

    backToTalkList() {
        const listView = document.getElementById('line-talk-list');
        const convView = document.getElementById('line-talk-conversation');
        if (listView) listView.style.display = 'flex';
        if (convView) convView.style.display = 'none';
        ChatList.render();
    }
};

// ===== 占位对象（後続フェーズで実装） =====
// ===== LineHome — ホームタブ =====
const LineHome = {
    _currentView: 'main', // 'main' | 'identity' | 'settings' | 'charProfile'
    _editingPersonaIndex: 0,
    _editingCharId: null,
    _editingBindingCharId: null,

    _esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },

    _ensurePersonas() {
        if (!AppState.data.myPersonaPresets) AppState.data.myPersonaPresets = [];
        if (AppState.data.myPersonaPresets.length === 0) {
            AppState.data.myPersonaPresets.push({
                id: Utils.generateId(), name: I18n.t('line.persona_default_name', 'User'), avatar: DEFAULT_AVATAR,
                persona: '', bindings: {}, statusMessage: ''
            });
        }
        AppState.data.myPersonaPresets.forEach(p => {
            if (!p.id) p.id = Utils.generateId();
            if (!p.bindings) p.bindings = {};
            if (!p.statusMessage) p.statusMessage = '';
            if (!p.avatarLetter) p.avatarLetter = (p.name || 'U').charAt(0);
            if (!p.avatarColor) p.avatarColor = '#a0c4ff';
        });
        if (!AppState.data.activePersonaId) {
            AppState.data.activePersonaId = AppState.data.myPersonaPresets[0].id;
        }
    },

    _getActivePersona() {
        this._ensurePersonas();
        const id = AppState.data.activePersonaId;
        return AppState.data.myPersonaPresets.find(p => p.id === id) || AppState.data.myPersonaPresets[0];
    },

    render() {
        this._ensurePersonas();
        this._currentView = 'main';
        const el = document.getElementById('line-home-content');
        if (!el) return;

        const persona = this._getActivePersona();
        const chars = AppState.data.characters || [];
        const meta = AppState.data.chatMeta || {};

        // 分组：お気に入り / 友だち
        const pinned = chars.filter(c => meta[c.id]?.isPinned);
        const unpinned = chars.filter(c => !meta[c.id]?.isPinned);

        el.innerHTML = `
            <!-- 个人资料区 -->
            <div class="lh-profile" onclick="LineHome.showIdentityManager()">
                <img class="lh-profile-avatar" src="${persona.avatar || DEFAULT_AVATAR}" alt="">
                <div class="lh-profile-info">
                    <div class="lh-profile-name">${this._esc(persona.name)}</div>
                    <div class="lh-profile-status">${this._esc(persona.statusMessage || '')}</div>
                    <div class="lh-profile-switch">▸ ${I18n.t('line.identity_switch', '身份切換')}</div>
                </div>
            </div>

            <!-- 服务入口 -->
            <div class="lh-service-grid">
                <div class="lh-service-item" onclick="Line.switchTab('wallet')">
                    <div class="lh-service-icon" style="background:#e8f5e9;">${LINE_SVG.wallet}</div>
                    <div class="lh-service-label">Pay</div>
                </div>
                <div class="lh-service-item" onclick="Line.hide();setTimeout(()=>Navigation.goTo('melonbooks'),100)">
                    <div class="lh-service-icon" style="background:#fff3e0;">${LINE_SVG.bag}</div>
                    <div class="lh-service-label">${I18n.t('app.melonbooks', 'メロン')}</div>
                </div>
                <div class="lh-service-item" onclick="StickerManager.openManage()">
                    <div class="lh-service-icon" style="background:#e3f2fd;">${LINE_SVG.smile}</div>
                    <div class="lh-service-label">${I18n.t('line.service_stickers', 'スタンプ')}</div>
                </div>
                <div class="lh-service-item" onclick="LineHome.showSettings()">
                    <div class="lh-service-icon" style="background:#f3e5f5;">${LINE_SVG.gear}</div>
                    <div class="lh-service-label">${I18n.t('line.service_settings', '設定')}</div>
                </div>
            </div>

            ${pinned.length > 0 ? `
            <div class="lh-group-label">${I18n.t('line.favorites', 'お気に入り')}</div>
            <div class="lh-friend-list">
                ${pinned.map(c => this._renderFriend(c)).join('')}
            </div>` : ''}

            <div class="lh-group-label">${I18n.t('line.friends', '友だち')} <span class="lh-friend-count">${chars.length}</span></div>
            <div class="lh-friend-list">
                ${(unpinned.length > 0 ? unpinned : (pinned.length === 0 ? chars : [])).map(c => this._renderFriend(c)).join('')}
                ${chars.length === 0 ? `<div class="empty-state" style="padding:20px;"><div class="empty-state-text">${I18n.t('line.no_friends_yet', 'まだ友だちがいません')}</div></div>` : ''}
            </div>
        `;
    },

    _renderFriend(c) {
        const msgs = AppState.data.conversations[c.id] || [];
        const lastMsg = msgs.filter(m => !m.hidden).slice(-1)[0];
        const statusText = lastMsg ? this._esc(lastMsg.content).slice(0, 25) : '';
        const online = Math.random() > 0.4; // 简单随机在线状态

        return `<div class="lh-friend-item">
            <div class="lh-friend-avatar-wrap" onclick="event.stopPropagation();LineHome.showCharProfile('${c.id}')">
                <img src="${c.avatar || DEFAULT_AVATAR}" class="lh-friend-avatar">
                ${online ? '<div class="lh-online-dot"></div>' : ''}
            </div>
            <div class="lh-friend-info" onclick="Line.openConversation('${c.id}')">
                <div class="lh-friend-name">${this._esc(c.name)}${c.sourceType === 'twitter-fan' ? ` <span class="lh-friend-tag-twitter">${I18n.t('line.twitter_friend_tag', 'Twitterの友達')}</span>` : ''}</div>
                <div class="lh-friend-status">${statusText}</div>
            </div>
        </div>`;
    },

    // ===== 身份管理 =====
    showIdentityManager() {
        this._currentView = 'identity';
        this._editingPersonaIndex = 0;
        const el = document.getElementById('line-home-content');
        if (!el) return;

        // 找到当前活跃身份的 index
        const activeId = AppState.data.activePersonaId;
        const idx = AppState.data.myPersonaPresets.findIndex(p => p.id === activeId);
        if (idx >= 0) this._editingPersonaIndex = idx;

        this._renderIdentityManager();
    },

    _renderIdentityManager() {
        const el = document.getElementById('line-home-content');
        if (!el) return;

        const personas = AppState.data.myPersonaPresets;
        const activeId = AppState.data.activePersonaId;
        const p = personas[this._editingPersonaIndex];
        if (!p) return;

        const isActive = p.id === activeId;

        el.innerHTML = `
            <div class="lh-sub-header">
                <button class="lh-back-btn" onclick="LineHome.render()">‹</button>
                <h2>${I18n.t('line.identity_manager', '身份管理')}</h2>
                <button class="lh-action-btn" onclick="LineHome.createPersona()">＋</button>
            </div>

            <!-- 身份列表 -->
            <div class="lh-persona-list">
                ${personas.map((pp, i) => `
                    <div class="lh-persona-item ${i === this._editingPersonaIndex ? 'selected' : ''}" onclick="LineHome._editingPersonaIndex=${i};LineHome._renderIdentityManager();">
                        <img src="${pp.avatar || DEFAULT_AVATAR}" class="lh-persona-avatar">
                        <div class="lh-persona-info">
                            <div class="lh-persona-name">${this._esc(pp.name)}</div>
                            <div class="lh-persona-desc">${pp.persona ? this._esc(pp.persona.slice(0, 30)) + '...' : I18n.t('line.no_description', '暂无描述')}</div>
                        </div>
                        ${pp.id === activeId ? `<div class="lh-persona-badge">${I18n.t('line.current_badge', '当前')}</div>` : ''}
                    </div>
                `).join('')}
            </div>

            <!-- 编辑区 -->
            <div class="settings-card" style="margin:12px 16px;">
                <div class="card-header">${I18n.t('line.identity_detail', '身份詳細')}</div>
                <div style="text-align:center;margin:16px 0;">
                    <img id="lhAvatarPreview" src="${p.avatar || DEFAULT_AVATAR}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;background:var(--border-medium);">
                </div>
                <div class="setting-row"><label>${I18n.t('line.field_name', '姓名')}</label><input type="text" id="lhPersonaName" value="${this._esc(p.name)}" placeholder="${I18n.t('line.name_placeholder', '名前')}"></div>
                <div class="setting-row"><label>${I18n.t('line.status_message', '状態メッセージ')}</label><input type="text" id="lhPersonaStatus" value="${this._esc(p.statusMessage || '')}" placeholder="${I18n.t('line.status_placeholder', 'ひとこと')}"></div>
                <div class="setting-row"><label>${I18n.t('line.avatar_url', 'アバターURL')}</label><input type="text" id="lhPersonaAvatar" value="${this._esc(p.avatar || '')}" placeholder="${I18n.t('line.image_url', '画像URL')}" onchange="document.getElementById('lhAvatarPreview').src=this.value||'${DEFAULT_AVATAR}'"></div>
                <div class="setting-row"><label>${I18n.t('line.base_persona', '基礎ペルソナ')}</label><textarea id="lhPersonaText" rows="4" placeholder="${I18n.t('line.persona_placeholder', 'あなたの設定...')}">${this._esc(p.persona || '')}</textarea></div>
            </div>

            <!-- 公式 NPC 身份（聊天时 LLM 知道你以这个 NPC 视角说话，含舅舅党彩蛋触发） -->
            <div class="settings-card" style="margin:12px 16px;">
                <div class="card-header">${I18n.t('line.official_identity_card', '公式 NPC 身份')}</div>
                <p style="font-size:12px;color:var(--text-tertiary);padding:8px 16px;">${I18n.t('line.official_identity_hint', '选定身份后，聊天时 AI 会以这个 NPC 的视角认识你（含舅舅党彩蛋触发）')}</p>
                <div class="setting-row">
                    <label>${I18n.t('line.official_npc_label', '公式 NPC（可选）')}</label>
                    <select id="lhOfficialNpcId">
                        <option value="">${I18n.t('line.official_npc_none', '未指定（用推特身份）')}</option>
                        ${(AppState.data.broadcast?.officialNpcs || []).map(n => `<option value="${this._esc(n.id)}" ${p.officialNpcId === n.id ? 'selected' : ''}>${this._esc(n.role)}${n.name ? ' ・ ' + this._esc(n.name) : ''}</option>`).join('')}
                    </select>
                </div>
                <div class="setting-row">
                    <label>${I18n.t('line.official_personality_label', '性格 / 经历 / 背景设定')}</label>
                    <textarea id="lhOfficialPersonality" rows="4" placeholder="${I18n.t('line.official_personality_placeholder', '这里写的是给 AI 看的设定（性格 / 经历 / 背景），跟推特简介不同')}">${this._esc(p.officialPersonality || '')}</textarea>
                </div>
            </div>

            <!-- 角色绑定 -->
            <div class="settings-card" style="margin:12px 16px;">
                <div class="card-header">${I18n.t('line.character_binding', 'キャラクターバインド')}</div>
                <p style="font-size:12px;color:var(--text-tertiary);padding:8px 16px;">${I18n.t('line.binding_hint', 'バインドしたキャラクターはこの身份のペルソナを使って会話します。')}</p>
                <div id="lhBindingTags" style="padding:12px 16px;display:flex;flex-wrap:wrap;gap:8px;"></div>
            </div>

            <!-- 操作按钮 -->
            <div style="padding:0 16px 24px;display:flex;flex-direction:column;gap:8px;">
                <button class="glass-btn primary" onclick="LineHome.savePersona()">${I18n.t('btn.save', '保存')}</button>
                <button class="glass-btn" onclick="LineHome.setActivePersona()" ${isActive ? 'disabled' : ''}>${isActive ? I18n.t('line.current_identity_check', '✓ 現在の身份') : I18n.t('line.set_as_display', '展示に設定')}</button>
                ${personas.length > 1 ? `<button class="glass-btn danger" onclick="LineHome.deletePersona()">${I18n.t('btn.delete', '削除')}</button>` : ''}
            </div>
        `;

        // 渲染绑定标签
        this._renderBindings(p);
    },

    _renderBindings(preset) {
        const container = document.getElementById('lhBindingTags');
        if (!container) return;

        let html = '';
        if (preset.bindings) {
            Object.keys(preset.bindings).forEach(charId => {
                const char = AppState.data.characters.find(c => c.id === charId);
                if (!char) return;
                const binding = preset.bindings[charId];
                const hasExtra = binding.extraPersona && binding.extraPersona.trim().length > 0;
                html += `<div class="binding-tag ${hasExtra ? 'has-extra' : ''}" onclick="LineHome.openBindingDetail('${charId}')">
                    <img src="${char.avatar || DEFAULT_AVATAR}" class="binding-avatar">
                    <span>${this._esc(char.name)}</span>
                    <button class="binding-remove" onclick="event.stopPropagation();LineHome.unbindChar('${charId}')">×</button>
                </div>`;
            });
        }
        html += `<button class="binding-add-btn" onclick="LineHome.openCharSelect()">+ ${I18n.t('line.bind', 'バインド')}</button>`;
        container.innerHTML = html;
    },

    createPersona() {
        AppState.data.myPersonaPresets.push({
            id: Utils.generateId(), name: I18n.t('line.new_identity_name', '新しい身份'), avatar: DEFAULT_AVATAR,
            persona: '', bindings: {}, statusMessage: '',
            officialNpcId: '', officialPersonality: ''
        });
        this._editingPersonaIndex = AppState.data.myPersonaPresets.length - 1;
        Utils.saveData();
        this._renderIdentityManager();
    },

    savePersona() {
        const p = AppState.data.myPersonaPresets[this._editingPersonaIndex];
        if (!p) return;
        p.name = document.getElementById('lhPersonaName').value.trim() || I18n.t('line.persona_default_name', 'User');
        p.avatar = document.getElementById('lhPersonaAvatar').value.trim() || DEFAULT_AVATAR;
        p.persona = document.getElementById('lhPersonaText').value.trim();
        p.statusMessage = document.getElementById('lhPersonaStatus').value.trim();
        p.officialNpcId = document.getElementById('lhOfficialNpcId')?.value || '';
        p.officialPersonality = document.getElementById('lhOfficialPersonality')?.value.trim() || '';
        p.avatarLetter = p.name.charAt(0);
        Utils.saveData();
        this._renderIdentityManager();
        Utils.showToast(I18n.t('t.line_saved', '✓ 保存しました'));
    },

    deletePersona() {
        if (AppState.data.myPersonaPresets.length <= 1) { Utils.showToast(I18n.t('t.line_min_one_persona', '最低1つの身份が必要です')); return; }
        if (!confirm(I18n.t('line.confirm_delete_identity', 'この身份を削除しますか？'))) return;
        const deleted = AppState.data.myPersonaPresets.splice(this._editingPersonaIndex, 1)[0];
        if (AppState.data.activePersonaId === deleted.id) {
            AppState.data.activePersonaId = AppState.data.myPersonaPresets[0].id;
        }
        this._editingPersonaIndex = 0;
        Utils.saveData();
        this._renderIdentityManager();
        Utils.showToast(I18n.t('t.line_deleted', '✓ 削除しました'));
    },

    setActivePersona() {
        const p = AppState.data.myPersonaPresets[this._editingPersonaIndex];
        if (!p) return;
        AppState.data.activePersonaId = p.id;
        Utils.saveData();
        this._renderIdentityManager();
        Utils.showToast(I18n.t('t.line_set_active', '✓ 展示に設定しました'));
    },

    openCharSelect() {
        const p = AppState.data.myPersonaPresets[this._editingPersonaIndex];
        const existingIds = Object.keys(p.bindings || {});
        const available = AppState.data.characters.filter(c => !existingIds.includes(c.id));

        const modal = document.getElementById('charSelectModal');
        const list = document.getElementById('charSelectList');
        list.innerHTML = available.length === 0
            ? `<div class="empty-state">${I18n.t('line.all_chars_bound', 'すべてのキャラクターがバインド済みです')}</div>`
            : available.map(c => `<label class="char-select-item"><input type="checkbox" value="${c.id}"><img src="${c.avatar || DEFAULT_AVATAR}" class="char-select-avatar"><span>${this._esc(c.name)}</span></label>`).join('');

        // 重新绑定确认按钮
        const confirmBtn = document.getElementById('charSelectConfirmBtn');
        if (confirmBtn) confirmBtn.onclick = () => this.confirmCharSelect();
        modal.classList.add('active');
    },

    confirmCharSelect() {
        const checkboxes = document.querySelectorAll('#charSelectList input:checked');
        const p = AppState.data.myPersonaPresets[this._editingPersonaIndex];
        if (!p.bindings) p.bindings = {};
        checkboxes.forEach(cb => { p.bindings[cb.value] = { extraPersona: '', override: false }; });
        Utils.saveData();
        this._renderBindings(p);
        document.getElementById('charSelectModal').classList.remove('active');
    },

    unbindChar(charId) {
        if (!confirm(I18n.t('line.confirm_unbind', 'バインドを解除しますか？'))) return;
        const p = AppState.data.myPersonaPresets[this._editingPersonaIndex];
        delete p.bindings[charId];
        Utils.saveData();
        this._renderBindings(p);
    },

    openBindingDetail(charId) {
        this._editingBindingCharId = charId;
        const p = AppState.data.myPersonaPresets[this._editingPersonaIndex];
        const binding = p.bindings[charId];
        const char = AppState.data.characters.find(c => c.id === charId);
        if (!binding || !char) return;

        document.getElementById('bindingCharName').textContent = char.name;
        document.getElementById('bindingCharAvatar').src = char.avatar || DEFAULT_AVATAR;
        document.getElementById('bindingExtraPersona').value = binding.extraPersona || '';
        document.getElementById('bindingOverride').checked = binding.override || false;

        // 重新绑定保存按钮
        const saveBtn = document.getElementById('bindingDetailSaveBtn');
        if (saveBtn) saveBtn.onclick = () => this.saveBindingDetail();
        document.getElementById('bindingDetailModal').classList.add('active');
    },

    saveBindingDetail() {
        if (!this._editingBindingCharId) return;
        const p = AppState.data.myPersonaPresets[this._editingPersonaIndex];
        if (p.bindings[this._editingBindingCharId]) {
            p.bindings[this._editingBindingCharId].extraPersona = document.getElementById('bindingExtraPersona').value;
            p.bindings[this._editingBindingCharId].override = document.getElementById('bindingOverride').checked;
        }
        Utils.saveData();
        this._renderBindings(p);
        document.getElementById('bindingDetailModal').classList.remove('active');
    },

    // ===== 角色资料卡 =====
    showCharProfile(charId) {
        this._currentView = 'charProfile';
        this._editingCharId = charId;
        const el = document.getElementById('line-home-content');
        const char = AppState.data.characters.find(c => c.id === charId);
        if (!el || !char) return;

        el.innerHTML = `
            <div class="lh-sub-header">
                <button class="lh-back-btn" onclick="LineHome.render()">‹</button>
                <h2>${I18n.t('line.profile', 'プロフィール')}</h2>
                <div></div>
            </div>

            <div style="text-align:center;padding:24px 0;">
                <img id="lhCharAvatarPreview" src="${char.avatar || DEFAULT_AVATAR}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;background:var(--border-medium);">
                <div style="font-size:18px;font-weight:700;margin-top:12px;">${this._esc(char.name)}</div>
            </div>

            <div class="settings-card" style="margin:0 16px 12px;">
                <div class="card-header">${I18n.t('line.basic_info', '基本情報')}</div>
                <div class="setting-row"><label>${I18n.t('line.name_jp', '名前')}</label><input type="text" id="lhCharName" value="${this._esc(char.name)}"></div>
                <div class="setting-row"><label>${I18n.t('line.avatar_url', 'アバターURL')}</label><input type="text" id="lhCharAvatar" value="${this._esc(char.avatar || '')}" onchange="document.getElementById('lhCharAvatarPreview').src=this.value||'${DEFAULT_AVATAR}'"></div>
                <div class="setting-row"><label>${I18n.t('line.personality_system_prompt', '性格 / System Prompt')}</label><textarea id="lhCharPersonality" rows="5">${this._esc(char.personality || '')}</textarea></div>
                <div class="setting-row"><label>${I18n.t('line.first_message', '初回メッセージ')}</label><textarea id="lhCharFirstMsg" rows="2">${this._esc(char.firstMessage || '')}</textarea></div>
            </div>

            <div class="settings-card" style="margin:0 16px 12px;">
                <div class="card-header">${I18n.t('line.chat_settings', 'チャット設定')}</div>
                <div class="setting-row"><label>${I18n.t('line.worldbook', 'ワールドブック')}</label><input type="text" id="lhCharWorldBook" value="${this._esc(char.worldBookId || '')}" placeholder="${I18n.t('line.worldbook_id_placeholder', 'ワールドブックID')}"></div>
                <div class="setting-row" style="flex-direction:row;justify-content:space-between;align-items:center;">
                    <label style="margin:0;">${I18n.t('line.forum_linked', '論壇連動')}</label>
                    <div class="wb-toggle">
                        <input type="checkbox" id="lhCharForumLinked" ${char.forumLinked ? 'checked' : ''}>
                        <span class="wb-toggle-slider"></span>
                    </div>
                </div>
                <p style="font-size:11px;color:var(--text-tertiary);padding:0 16px 8px;">${I18n.t('line.forum_linked_hint', 'オンにすると、このキャラクターは論壇の世界観・剧情を自然に把握します')}</p>
                <div class="setting-row" style="flex-direction:row;justify-content:space-between;align-items:center;">
                    <label style="margin:0;">${I18n.t('line.bilingual_jp_zh', 'バイリンガル（中日）')}</label>
                    <div class="wb-toggle">
                        <input type="checkbox" id="lhCharBilingual" ${char.enableBilingual ? 'checked' : ''}>
                        <span class="wb-toggle-slider"></span>
                    </div>
                </div>
                <div class="setting-row"><label>${I18n.t('line.read_message_count', '読み込みメッセージ数')}</label><input type="number" id="lhCharReadCount" value="${char.readMessageCount || 10}" min="1" max="50"></div>
                <div class="setting-row"><label>${I18n.t('line.auto_summary_count', '自動要約（メッセージ数）')}</label><input type="number" id="lhCharSummaryCount" value="${char.autoSummaryCount || 20}" min="5" max="100"></div>
                <div class="setting-row" style="flex-direction:row;justify-content:space-between;align-items:center;">
                    <label style="margin:0;">${I18n.t('line.hide_after_summary', '要約後にメッセージを隠す')}</label>
                    <div class="wb-toggle">
                        <input type="checkbox" id="lhCharHideAfterSummary" ${char.hideAfterSummary ? 'checked' : ''}>
                        <span class="wb-toggle-slider"></span>
                    </div>
                </div>
            </div>

            <div style="padding:0 16px 24px;display:flex;flex-direction:column;gap:8px;">
                <button class="glass-btn primary" onclick="LineHome.saveCharProfile()">${I18n.t('btn.save', '保存')}</button>
                <button class="glass-btn" onclick="Line.openConversation('${charId}')">${I18n.t('line.open_chat', 'トークを開く')}</button>
            </div>
        `;
    },

    saveCharProfile() {
        const char = AppState.data.characters.find(c => c.id === this._editingCharId);
        if (!char) return;
        char.name = document.getElementById('lhCharName').value.trim() || char.name;
        char.avatar = document.getElementById('lhCharAvatar').value.trim();
        char.personality = document.getElementById('lhCharPersonality').value.trim();
        char.firstMessage = document.getElementById('lhCharFirstMsg').value.trim();
        char.worldBookId = document.getElementById('lhCharWorldBook').value.trim();
        char.forumLinked = document.getElementById('lhCharForumLinked').checked;
        char.enableBilingual = document.getElementById('lhCharBilingual').checked;
        char.readMessageCount = parseInt(document.getElementById('lhCharReadCount').value) || 10;
        char.autoSummaryCount = parseInt(document.getElementById('lhCharSummaryCount').value) || 20;
        char.hideAfterSummary = document.getElementById('lhCharHideAfterSummary').checked;
        Utils.saveData();
        Utils.showToast(I18n.t('t.line_saved', '✓ 保存しました'));
        // 更新头像预览
        document.getElementById('lhCharAvatarPreview').src = char.avatar || DEFAULT_AVATAR;
    },

    // ===== 設定 =====
    showSettings() {
        this._currentView = 'settings';
        const el = document.getElementById('line-home-content');
        if (!el) return;

        const s = AppState.data.chatSettings || {};
        const bgColors = [
            { color: '#8cabd9', label: I18n.t('line.bg_blue', 'ブルー') },
            { color: '#7bb89a', label: I18n.t('line.bg_green', 'グリーン') },
            { color: '#b8a0d0', label: I18n.t('line.bg_purple', 'パープル') },
            { color: '#d4a76a', label: I18n.t('line.bg_gold', 'ゴールド') },
            { color: '#e8a0bf', label: I18n.t('line.bg_pink', 'ピンク') },
            { color: '#889eaf', label: I18n.t('line.bg_gray', 'グレー') },
            { color: '#f0f0f0', label: I18n.t('line.bg_light', 'ライト') },
            { color: '#2c2c2e', label: I18n.t('line.bg_dark', 'ダーク') },
        ];

        el.innerHTML = `
            <div class="lh-sub-header">
                <button class="lh-back-btn" onclick="LineHome.render()">‹</button>
                <h2>${I18n.t('line.service_settings', '設定')}</h2>
                <div></div>
            </div>

            <div class="settings-card" style="margin:12px 16px;">
                <div class="card-header">${I18n.t('line.bubble_color', '吹き出しカラー')}</div>
                <div class="setting-row" style="flex-direction:row;justify-content:space-between;align-items:center;">
                    <label style="margin:0;">${I18n.t('line.line_green_default', 'LINE グリーン（デフォルト）')}</label>
                    <div class="wb-toggle">
                        <input type="checkbox" id="lhLineGreen" ${s.useLineGreen !== false ? 'checked' : ''} onchange="LineHome._saveSetting('useLineGreen',this.checked)">
                        <span class="wb-toggle-slider"></span>
                    </div>
                </div>
            </div>
            <p style="padding:0 28px 12px;font-size:12px;color:var(--text-tertiary);">${I18n.t('line.bubble_color_off_hint_short', 'オフにすると、テーマカラーに合わせた吹き出しになります')}</p>

            <div class="settings-card" style="margin:0 16px 12px;">
                <div class="card-header">${I18n.t('line.bg_color', '背景カラー')}</div>
                <div class="setting-row">
                    <div style="display:flex;gap:12px;flex-wrap:wrap;padding:4px 0;">
                        ${bgColors.map(c => `<div class="chat-bg-dot${(s.bgColor || '#8cabd9') === c.color ? ' selected' : ''}" style="background:${c.color};" title="${c.label}" onclick="LineHome._selectBgColor('${c.color}')"></div>`).join('')}
                    </div>
                </div>
            </div>

            <div class="settings-card" style="margin:0 16px 12px;">
                <div class="card-header">${I18n.t('line.custom_bg', 'カスタム背景')}</div>
                <div class="setting-row">
                    <input type="text" id="lhBgImageUrl" value="${this._esc(s.bgImageUrl || '')}" placeholder="${I18n.t('line.image_url_placeholder', '画像URLを入力...')}" onchange="LineHome._saveSetting('bgImageUrl',this.value.trim())">
                </div>
            </div>

            <div class="settings-card" style="margin:0 16px 12px;">
                <div class="card-header">${I18n.t('line.display_settings', '表示設定')}</div>
                <div class="setting-row" style="flex-direction:row;justify-content:space-between;align-items:center;">
                    <label style="margin:0;">${I18n.t('line.show_read', '既読表示')}</label>
                    <div class="wb-toggle">
                        <input type="checkbox" ${s.showRead !== false ? 'checked' : ''} onchange="LineHome._saveSetting('showRead',this.checked)">
                        <span class="wb-toggle-slider"></span>
                    </div>
                </div>
                <div class="setting-row" style="flex-direction:row;justify-content:space-between;align-items:center;">
                    <label style="margin:0;">${I18n.t('line.show_typing', 'タイピングインジケーター')}</label>
                    <div class="wb-toggle">
                        <input type="checkbox" ${s.showTyping !== false ? 'checked' : ''} onchange="LineHome._saveSetting('showTyping',this.checked)">
                        <span class="wb-toggle-slider"></span>
                    </div>
                </div>
            </div>

            <div style="padding:16px;">
                <button class="glass-btn" onclick="Line.hide()" style="width:100%;">${I18n.t('line.back_to_perigee', 'Perigee OS に戻る')}</button>
            </div>
        `;
    },

    _saveSetting(key, value) {
        if (!AppState.data.chatSettings) AppState.data.chatSettings = {};
        AppState.data.chatSettings[key] = value;
        Utils.saveData();
    },

    _selectBgColor(color) {
        AppState.data.chatSettings.bgColor = color;
        AppState.data.chatSettings.bgImageUrl = '';
        Utils.saveData();
        this.showSettings(); // 重新渲染
    }
};

// ===== LineVoom — VOOM タブ =====
const LineVoom = {
    _esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
    _lastGenTime: 0,
    _showingComments: null, // postId being viewed
    _isGenerating: false,

    _ensureVoom() {
        if (!AppState.data.voom) AppState.data.voom = { posts: [] };
    },

    render() {
        this._ensureVoom();
        this._showingComments = null;
        const el = document.getElementById('line-voom-content');
        if (!el) return;

        const posts = (AppState.data.voom.posts || []).slice().sort((a, b) => b.timestamp - a.timestamp);

        el.innerHTML = `
            <div class="lv-feed">
                ${posts.length === 0 ? `
                    <div class="empty-state" style="padding:40px 0;">
                        <div class="empty-state-icon">▶</div>
                        <div class="empty-state-text">${I18n.t('line.voom_no_posts', 'まだ投稿がありません')}</div>
                        <button class="glass-btn primary" onclick="LineVoom.generatePosts()" style="margin-top:12px;">${I18n.t('line.voom_generate_posts', '動態を生成')}</button>
                    </div>
                ` : posts.map(p => this._renderPost(p)).join('')}
            </div>
            <!-- FAB -->
            <button class="lv-fab" onclick="LineVoom.showPostModal()">＋</button>
            <!-- 更新ボタン -->
            ${posts.length > 0 ? `<button class="lv-refresh-btn" onclick="LineVoom.generatePosts()"><span class="line-btn-icon">${LINE_SVG.refresh}</span>${I18n.t('line.voom_load_new', '新しい動態を読み込む')}</button>` : ''}
        `;
    },

    _renderPost(post) {
        const isUser = post.authorType === 'user';
        let authorName, authorAvatar;

        if (isUser) {
            const persona = LineHome._getActivePersona();
            authorName = persona.name || I18n.t('line.persona_default_name', 'User');
            authorAvatar = persona.avatar || DEFAULT_AVATAR;
        } else {
            const char = AppState.data.characters.find(c => c.id === post.authorId);
            authorName = char ? char.name : I18n.t('line.unknown', '不明');
            authorAvatar = char ? (char.avatar || DEFAULT_AVATAR) : DEFAULT_AVATAR;
        }

        const timeAgo = this._timeAgo(post.timestamp);
        const likeCount = (post.likes || []).length;
        const commentCount = (post.comments || []).length;
        const userLiked = (post.likes || []).some(l => l.isUser);

        return `<div class="lv-post ${isUser ? 'lv-post-user' : ''}">
            <div class="lv-post-header">
                <img src="${authorAvatar}" class="lv-post-avatar" onclick="${isUser ? '' : `Line.openConversation('${post.authorId}')`}" style="${isUser ? '' : 'cursor:pointer;'}">
                <div class="lv-post-author">
                    <div class="lv-post-name">${this._esc(authorName)} ${isUser ? `<span class="lv-you-badge">${I18n.t('line.you_badge', 'あなた')}</span>` : ''}</div>
                    <div class="lv-post-time">${timeAgo}</div>
                </div>
            </div>
            <div class="lv-post-text">${this._esc(post.content).replace(/\n/g, '<br>')}</div>
            ${post.image ? `<div class="lv-post-image"><img src="${post.image}" alt=""></div>` : ''}
            ${post.emoji ? `<div class="lv-post-emoji">${post.emoji}</div>` : ''}
            <div class="lv-post-actions">
                <button class="lv-action ${userLiked ? 'liked' : ''}" onclick="LineVoom.toggleLike('${post.id}')">
                    ${userLiked ? '♥' : '♡'} ${likeCount || ''}
                </button>
                <button class="lv-action" onclick="LineVoom.showComments('${post.id}')">
                    <span class="line-stat-icon">${LINE_SVG.comment}</span> ${commentCount || ''}
                </button>
            </div>
        </div>`;
    },

    _timeAgo(ts) {
        const diff = Date.now() - ts;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return I18n.t('line.time_just_now', 'たった今');
        if (mins < 60) return I18n.t('line.time_mins_ago', {n: mins});
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return I18n.t('line.time_hours_ago', {n: hrs});
        const days = Math.floor(hrs / 24);
        return I18n.t('line.time_days_ago', {n: days});
    },

    // ===== いいね =====
    toggleLike(postId) {
        this._ensureVoom();
        const post = AppState.data.voom.posts.find(p => p.id === postId);
        if (!post) return;
        if (!post.likes) post.likes = [];

        const idx = post.likes.findIndex(l => l.isUser);
        if (idx >= 0) {
            post.likes.splice(idx, 1);
        } else {
            const persona = LineHome._getActivePersona();
            post.likes.push({ id: Utils.generateId(), name: persona.name, isUser: true });
        }
        Utils.saveData();
        this.render();
    },

    // ===== コメント =====
    showComments(postId) {
        this._showingComments = postId;
        const post = AppState.data.voom.posts.find(p => p.id === postId);
        if (!post) return;

        const el = document.getElementById('line-voom-content');
        if (!el) return;

        const comments = post.comments || [];
        const isUser = post.authorType === 'user';
        const char = !isUser ? AppState.data.characters.find(c => c.id === post.authorId) : null;
        const authorName = isUser ? (LineHome._getActivePersona().name || I18n.t('line.persona_default_name', 'User')) : (char ? char.name : I18n.t('line.unknown', '不明'));

        el.innerHTML = `
            <div class="lh-sub-header">
                <button class="lh-back-btn" onclick="LineVoom.render()">‹</button>
                <h2>${I18n.t('line.comments', 'コメント')}</h2>
                <div></div>
            </div>
            <div class="lv-comment-post">
                <div style="font-weight:600;margin-bottom:6px;">${this._esc(authorName)}</div>
                <div style="font-size:14px;line-height:1.5;">${this._esc(post.content).replace(/\n/g, '<br>')}</div>
            </div>
            <div class="lv-comments-list" id="lvCommentsList">
                ${comments.length === 0 ? `<div style="padding:20px;text-align:center;color:var(--text-tertiary);font-size:13px;">${I18n.t('line.no_comments_yet', 'まだコメントがありません')}</div>` : ''}
                ${comments.map(c => {
                    const cIsUser = c.authorType === 'user';
                    const cChar = !cIsUser ? AppState.data.characters.find(ch => ch.id === c.authorId) : null;
                    const cName = cIsUser ? (LineHome._getActivePersona().name || I18n.t('line.persona_default_name', 'User')) : (cChar ? cChar.name : I18n.t('line.unknown', '不明'));
                    const cAvatar = cIsUser ? (LineHome._getActivePersona().avatar || DEFAULT_AVATAR) : (cChar ? (cChar.avatar || DEFAULT_AVATAR) : DEFAULT_AVATAR);
                    return `<div class="lv-comment">
                        <img src="${cAvatar}" class="lv-comment-avatar">
                        <div class="lv-comment-body">
                            <span class="lv-comment-name">${this._esc(cName)}</span>
                            <span class="lv-comment-text">${this._esc(c.content)}</span>
                            <div class="lv-comment-time">${this._timeAgo(c.timestamp)}</div>
                        </div>
                    </div>`;
                }).join('')}
            </div>
            <div class="lv-comment-input">
                <input type="text" id="lvCommentInput" placeholder="${I18n.t('line.comment_placeholder', 'コメントを入力...')}" autocomplete="off">
                <button class="send-icon-btn" onclick="LineVoom.submitComment('${postId}')">↑</button>
            </div>
        `;
    },

    async submitComment(postId) {
        const input = document.getElementById('lvCommentInput');
        const content = input?.value.trim();
        if (!content) return;

        this._ensureVoom();
        const post = AppState.data.voom.posts.find(p => p.id === postId);
        if (!post) return;
        if (!post.comments) post.comments = [];

        // ユーザーコメント追加
        post.comments.push({
            id: Utils.generateId(), authorType: 'user', authorId: null,
            content, timestamp: Date.now()
        });
        Utils.saveData();
        this.showComments(postId); // 再描画

        // AI 返信（キャラクター投稿の場合）
        if (post.authorType === 'character' && post.authorId) {
            const char = AppState.data.characters.find(c => c.id === post.authorId);
            if (char) {
                try {
                    const persona = LineHome._getActivePersona();
                    const systemPrompt = `You are ${char.name}. ${char.personality || ''}\nYou posted on your VOOM timeline: "${post.content}"\nThe user "${persona.name}" left a comment. Reply naturally as ${char.name} in 1-2 short sentences. Keep it casual and in-character.`;
                    const msgs = [{ role: 'user', content }];
                    const reply = await Utils.callChatAPI(msgs, systemPrompt);
                    post.comments.push({
                        id: Utils.generateId(), authorType: 'character', authorId: post.authorId,
                        content: reply.trim(), timestamp: Date.now()
                    });
                    Utils.saveData();
                    if (this._showingComments === postId) this.showComments(postId);
                } catch (e) {
                    console.error('[VOOM Comment AI Error]', e);
                }
            }
        }
    },

    // ===== 投稿作成 =====
    showPostModal() {
        document.getElementById('lvPostText').value = '';
        document.getElementById('lvPostEmoji').value = '';
        document.getElementById('lineVoomPostModal').classList.add('active');
    },

    createPost() {
        const content = document.getElementById('lvPostText').value.trim();
        const emoji = document.getElementById('lvPostEmoji').value.trim();
        if (!content) { Utils.showToast(I18n.t('t.line_enter_text', 'テキストを入力してください')); return; }

        this._ensureVoom();
        AppState.data.voom.posts.push({
            id: Utils.generateId(), authorType: 'user', authorId: null,
            content, image: '', emoji: emoji || '',
            likes: [], comments: [], timestamp: Date.now()
        });
        Utils.saveData();
        document.getElementById('lineVoomPostModal').classList.remove('active');
        this.render();
        Utils.showToast(I18n.t('t.line_posted', '✓ 投稿しました'));
    },

    // ===== AI 動態生成 =====
    async generatePosts() {
        if (this._isGenerating) return;
        const chars = AppState.data.characters || [];
        if (chars.length === 0) { Utils.showToast(I18n.t('t.line_no_characters', 'キャラクターがいません')); return; }

        this._isGenerating = true;
        Utils.showToast(I18n.t('t.line_generating_posts', '動態を生成中...'));

        // ランダムに2-3キャラ選択
        const shuffled = [...chars].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, Math.min(3, shuffled.length));

        for (const char of selected) {
            try {
                const systemPrompt = `You are ${char.name}. ${char.personality || ''}
You are posting on your VOOM timeline (similar to LINE's social feed).
Write a short, casual daily update post (1-3 sentences) in character.
Topics: daily life, hobbies, food, events, feelings, something you saw today.
Be natural and authentic to your character. Reply with ONLY the post text, no quotes or labels.`;

                const msgs = [{ role: 'user', content: 'Write a timeline post for today.' }];
                const reply = await Utils.callChatAPI(msgs, systemPrompt);

                this._ensureVoom();
                // ランダムに過去数時間のタイムスタンプ
                const hoursAgo = Math.floor(Math.random() * 12) + 1;
                AppState.data.voom.posts.push({
                    id: Utils.generateId(), authorType: 'character', authorId: char.id,
                    content: reply.trim(), image: '', emoji: '',
                    likes: this._generateFakeLikes(chars, char.id),
                    comments: [], timestamp: Date.now() - hoursAgo * 3600000
                });
            } catch (e) {
                console.error('[VOOM Gen Error]', char.name, e);
            }
        }

        this._lastGenTime = Date.now();
        Utils.saveData();
        this._isGenerating = false;
        this.render();
        Utils.showToast(I18n.t('t.line_posts_updated', '✓ 動態を更新しました'));
    },

    _generateFakeLikes(allChars, authorId) {
        // 他キャラからのランダムいいね
        const others = allChars.filter(c => c.id !== authorId);
        const likes = [];
        others.forEach(c => {
            if (Math.random() > 0.5) {
                likes.push({ id: Utils.generateId(), name: c.name, isUser: false });
            }
        });
        return likes;
    }
};

// ===== LinePay — ウォレットタブ =====
const LinePay = {
    _esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },

    _ensureWallet() {
        if (!AppState.data.wallet) AppState.data.wallet = { balance: 10000, transactions: [] };
    },

    render() {
        this._ensureWallet();
        const el = document.getElementById('line-wallet-content');
        if (!el) return;

        const w = AppState.data.wallet;
        const txs = (w.transactions || []).slice().sort((a, b) => b.timestamp - a.timestamp);

        el.innerHTML = `
            <!-- 残高カード -->
            <div class="lp-balance-card">
                <div class="lp-balance-label">${I18n.t('line.pay_balance', 'LINE Pay 残高')}</div>
                <div class="lp-balance-amount">¥${w.balance.toLocaleString()}</div>
                <div class="lp-balance-actions">
                    <button class="lp-action-btn" onclick="LinePay.showChargePanel()">
                        <span class="lp-action-icon">${LINE_SVG.card}</span>${I18n.t('line.top_up', 'チャージ')}
                    </button>
                    <button class="lp-action-btn" onclick="LinePay.showTransferPanel()">
                        <span class="lp-action-icon">${LINE_SVG.send}</span>${I18n.t('line.send_money', '送金')}
                    </button>
                    <button class="lp-action-btn" onclick="LinePay.render()">
                        <span class="lp-action-icon">${LINE_SVG.list}</span>${I18n.t('line.history', '履歴')}
                    </button>
                </div>
            </div>

            <!-- 取引履歴 -->
            <div class="lp-section-title">${I18n.t('line.recent_transactions', '最近の取引')}</div>
            <div class="lp-tx-list">
                ${txs.length === 0 ? `<div class="empty-state" style="padding:30px 0;"><div class="empty-state-text">${I18n.t('line.no_transactions_yet', 'まだ取引がありません')}</div></div>` : ''}
                ${txs.map(tx => this._renderTx(tx)).join('')}
            </div>
        `;
    },

    _renderTx(tx) {
        const isIncome = tx.amount > 0;
        const amountStr = (isIncome ? '+' : '') + '¥' + Math.abs(tx.amount).toLocaleString();
        const date = new Date(tx.timestamp);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

        let icon = `<span class="lp-tx-icon">${LINE_SVG.card}</span>`;
        let avatarStyle = 'background:#a0c4ff;';
        if (tx.type === 'purchase') {
            icon = `<span class="lp-tx-icon">${LINE_SVG.bag}</span>`;
            avatarStyle = 'background:#e8530e;';
        } else if (tx.type === 'transfer') {
            const char = tx.targetId ? AppState.data.characters.find(c => c.id === tx.targetId) : null;
            if (char && char.avatar) {
                return `<div class="lp-tx-item">
                    <img src="${char.avatar}" class="lp-tx-avatar-img">
                    <div class="lp-tx-info">
                        <div class="lp-tx-name">${this._esc(tx.targetName)}</div>
                        <div class="lp-tx-desc">${this._esc(tx.description || '')} · ${dateStr}</div>
                    </div>
                    <div class="lp-tx-amount ${isIncome ? 'plus' : 'minus'}">${amountStr}</div>
                </div>`;
            }
            icon = tx.targetName ? tx.targetName.charAt(0) : '→';
            avatarStyle = 'background:#90caf9;';
        } else if (tx.type === 'charge') {
            icon = '＋';
            avatarStyle = 'background:#06c755;color:#fff;font-weight:700;';
        }

        return `<div class="lp-tx-item">
            <div class="lp-tx-avatar" style="${avatarStyle}">${icon}</div>
            <div class="lp-tx-info">
                <div class="lp-tx-name">${this._esc(tx.targetName || I18n.t('line.top_up', 'チャージ'))}</div>
                <div class="lp-tx-desc">${this._esc(tx.description || '')} · ${dateStr}</div>
            </div>
            <div class="lp-tx-amount ${isIncome ? 'plus' : 'minus'}">${amountStr}</div>
        </div>`;
    },

    // チャージ
    showChargePanel() {
        const modal = document.getElementById('linePayChargeModal');
        if (modal) {
            document.getElementById('lpChargeCustom').value = '';
            modal.classList.add('active');
        }
    },

    charge(amount) {
        if (!amount || amount <= 0) {
            const custom = parseInt(document.getElementById('lpChargeCustom')?.value);
            if (!custom || custom <= 0) { Utils.showToast(I18n.t('t.line_enter_amount', '金額を入力してください')); return; }
            amount = custom;
        }
        this._ensureWallet();
        AppState.data.wallet.balance += amount;
        AppState.data.wallet.transactions.push({
            id: Utils.generateId(), type: 'charge', amount: amount,
            targetName: I18n.t('line.top_up', 'チャージ'), targetId: null,
            description: I18n.t('line.manual_charge', '手動チャージ'), timestamp: Date.now()
        });
        Utils.saveData();
        document.getElementById('linePayChargeModal')?.classList.remove('active');
        this.render();
        Line._updateBadges();
        Utils.showToast(I18n.t('t.line_charged', {amount: amount.toLocaleString()}));
    },

    // 送金（Pay ページ入口）
    showTransferPanel() {
        const chars = AppState.data.characters || [];
        const modal = document.getElementById('linePayTransferModal');
        const list = document.getElementById('lpTransferCharList');
        if (!modal || !list) return;

        list.innerHTML = chars.length === 0
            ? `<div class="empty-state" style="padding:20px;"><div class="empty-state-text">${I18n.t('line.no_friends', '友だちがいません')}</div></div>`
            : chars.map(c => `<div class="lp-transfer-char" onclick="LinePay.selectTransferTarget('${c.id}')">
                <img src="${c.avatar || DEFAULT_AVATAR}" class="lp-transfer-avatar">
                <span>${this._esc(c.name)}</span>
            </div>`).join('');

        document.getElementById('lpTransferStep1').style.display = 'block';
        document.getElementById('lpTransferStep2').style.display = 'none';
        modal.classList.add('active');
    },

    _transferTargetId: null,

    selectTransferTarget(charId) {
        this._transferTargetId = charId;
        const char = AppState.data.characters.find(c => c.id === charId);
        if (!char) return;
        document.getElementById('lpTransferTargetName').textContent = char.name;
        document.getElementById('lpTransferAmount').value = '';
        document.getElementById('lpTransferDesc').value = '';
        document.getElementById('lpTransferStep1').style.display = 'none';
        document.getElementById('lpTransferStep2').style.display = 'block';
    },

    executeTransfer() {
        const amount = parseInt(document.getElementById('lpTransferAmount').value);
        const desc = document.getElementById('lpTransferDesc').value.trim();
        if (!amount || amount <= 0) { Utils.showToast(I18n.t('t.line_enter_amount', '金額を入力してください')); return; }

        this._ensureWallet();
        if (!this.checkBalance(amount)) return;

        const char = AppState.data.characters.find(c => c.id === this._transferTargetId);
        if (!char) return;

        AppState.data.wallet.balance -= amount;
        AppState.data.wallet.transactions.push({
            id: Utils.generateId(), type: 'transfer', amount: -amount,
            targetName: char.name, targetId: char.id,
            description: desc || I18n.t('line.send_money', '送金'), timestamp: Date.now()
        });

        // 在对话中生成转账卡片消息
        if (!AppState.data.conversations[char.id]) AppState.data.conversations[char.id] = [];
        AppState.data.conversations[char.id].push({
            id: Date.now() + Math.random(), role: 'user',
            type: 'transfer',
            content: JSON.stringify({ amount, description: desc || '送金' }),
            timestamp: Date.now(), pending: true
        });

        Utils.saveData();
        document.getElementById('linePayTransferModal')?.classList.remove('active');
        this.render();
        Utils.showToast(I18n.t('t.line_transferred_to', {name: char.name, amount: amount.toLocaleString()}));
    },

    checkBalance(required) {
        this._ensureWallet();
        if (AppState.data.wallet.balance >= required) return true;
        const bal = AppState.data.wallet.balance;
        if (confirm(I18n.t('line.balance_insufficient_confirm', {bal: bal.toLocaleString(), required: required.toLocaleString()}))) {
            document.getElementById('linePayTransferModal')?.classList.remove('active');
            this.showChargePanel();
        }
        return false;
    }
};

// ===== LineTalk — チャット内送金 =====
const LineTalk = {
    showTransferPanel() {
        const char = AppState.currentCharacter;
        if (!char) { Utils.showToast(I18n.t('t.line_open_talk_first', 'トークを開いてください')); return; }
        document.getElementById('chatTransferAmount').value = '';
        document.getElementById('chatTransferDesc').value = '';
        document.getElementById('lineChatTransferModal').classList.add('active');
    },

    // 分享卡片（从 Twitter / Melonbooks 调用）
    sendShareCard(charId, shareType, shareData) {
        if (!AppState.data.conversations[charId]) AppState.data.conversations[charId] = [];
        AppState.data.conversations[charId].push({
            id: Date.now() + Math.random(), role: 'user',
            type: 'share',
            content: JSON.stringify({ shareType, ...shareData }),
            timestamp: Date.now(), pending: true
        });
        Utils.saveData();

        // 先显示 LINE 环境，再打开对话
        Line.show('talk');
        setTimeout(() => {
            Line.openConversation(charId);
            Utils.showToast(I18n.t('t.line_shared', '✓ 共有しました'));
        }, 100);
    },

    // 角色选择弹窗（分享用）
    showShareCharSelect(shareType, shareData) {
        const chars = AppState.data.characters || [];
        const modal = document.getElementById('lineShareCharModal');
        const list = document.getElementById('lsCharList');
        if (!modal || !list) return;

        // 保存待分享数据
        this._pendingShare = { shareType, shareData };

        list.innerHTML = chars.length === 0
            ? `<div class="empty-state" style="padding:20px;"><div class="empty-state-text">${I18n.t('line.no_friends', '友だちがいません')}</div></div>`
            : chars.map(c => `<div class="lp-transfer-char" onclick="LineTalk._confirmShare('${c.id}')">
                <img src="${c.avatar || DEFAULT_AVATAR}" class="lp-transfer-avatar">
                <span>${ChatList._esc(c.name)}</span>
            </div>`).join('');

        modal.classList.add('active');
    },

    _pendingShare: null,

    _confirmShare(charId) {
        if (!this._pendingShare) return;
        document.getElementById('lineShareCharModal')?.classList.remove('active');
        this.sendShareCard(charId, this._pendingShare.shareType, this._pendingShare.shareData);
        this._pendingShare = null;
    },

    executeTransfer() {
        const char = AppState.currentCharacter;
        if (!char) return;
        const amount = parseInt(document.getElementById('chatTransferAmount').value);
        const desc = document.getElementById('chatTransferDesc').value.trim();
        if (!amount || amount <= 0) { Utils.showToast(I18n.t('t.line_enter_amount', '金額を入力してください')); return; }

        LinePay._ensureWallet();
        if (!LinePay.checkBalance(amount)) return;

        // 扣减余额 + 记录交易
        AppState.data.wallet.balance -= amount;
        AppState.data.wallet.transactions.push({
            id: Utils.generateId(), type: 'transfer', amount: -amount,
            targetName: char.name, targetId: char.id,
            description: desc || I18n.t('line.send_money', '送金'), timestamp: Date.now()
        });

        // 在对话中生成转账卡片
        const msgs = AppState.data.conversations[char.id];
        if (msgs) {
            msgs.push({
                id: Date.now() + Math.random(), role: 'user',
                type: 'transfer',
                content: JSON.stringify({ amount, description: desc || '送金' }),
                timestamp: Date.now(), pending: true
            });
        }

        Utils.saveData();
        document.getElementById('lineChatTransferModal').classList.remove('active');
        Conversation.render();
        Conversation.checkPending();
        Utils.showToast(I18n.t('t.line_transferred', {amount: amount.toLocaleString()}));
    }
};

const ChatList = {
    _esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },

    _formatTime(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        const now = new Date();
        const diffDays = Math.floor((now - d) / 86400000);
        if (diffDays === 0) return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
        if (diffDays === 1) return I18n.t('line.yesterday', '昨日');
        return `${d.getMonth() + 1}/${d.getDate()}`;
    },

    render() {
        const list = document.getElementById('chatList');
        const hasChars = AppState.data.characters.length > 0;
        const hasGroups = (AppState.data.groups || []).length > 0;
        if (!hasChars && !hasGroups) {
            list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${LINE_SVG.comment}</div><div class="empty-state-text">${I18n.t('line.no_chats_yet', 'まだトークがありません')}</div><div class="empty-state-hint">${I18n.t('line.add_character_hint', '右上の＋からキャラクターを追加')}</div></div>`;
            return;
        }

        // chatMeta 初始化
        if (!AppState.data.chatMeta) AppState.data.chatMeta = {};

        // 1v1 チャット
        const charEntries = AppState.data.characters.map(c => {
            const msgs = AppState.data.conversations[c.id] || [];
            const visibleMsgs = msgs.filter(m => !m.hidden);
            const last = visibleMsgs.length > 0 ? visibleMsgs[visibleMsgs.length - 1] : null;
            const meta = AppState.data.chatMeta[c.id] || {};
            return { id: c.id, char: c, name: c.name, avatar: c.avatar, lastMsg: last, meta, lastTime: last ? last.timestamp : 0, isGroup: false };
        });
        // グループチャット
        const groupEntries = (AppState.data.groups || []).map(g => {
            const convKey = 'grp_' + g.id;
            const msgs = AppState.data.conversations[convKey] || [];
            const visibleMsgs = msgs.filter(m => !m.hidden);
            const last = visibleMsgs.length > 0 ? visibleMsgs[visibleMsgs.length - 1] : null;
            const meta = AppState.data.chatMeta[convKey] || {};
            const members = g.memberIds.map(id => AppState.data.characters.find(c => c.id === id)).filter(Boolean);
            return { id: convKey, group: g, name: g.name, members, lastMsg: last, meta, lastTime: last ? last.timestamp : (g.createdAt || 0), isGroup: true };
        });

        const chars = [...charEntries, ...groupEntries];

        // 分为置顶和非置顶，各自按时间排序
        const pinned = chars.filter(x => x.meta.isPinned).sort((a, b) => b.lastTime - a.lastTime);
        const unpinned = chars.filter(x => !x.meta.isPinned).sort((a, b) => b.lastTime - a.lastTime);

        const renderItem = (entry) => {
            const { id, name, lastMsg, meta, isGroup, members } = entry;
            const c = entry.char;
            let preview = lastMsg ? this._esc(lastMsg.content).slice(0, 40) : '';
            // グループ: 送信者名プレフィックス
            if (isGroup && lastMsg && lastMsg.role === 'assistant' && lastMsg.charId) {
                const sender = (members || []).find(m => m.id === lastMsg.charId);
                if (sender) preview = `${sender.name}: ${preview}`;
            }
            const time = lastMsg ? this._formatTime(lastMsg.timestamp) : '';
            const unread = meta.unreadCount > 0 ? `<span class="chat-unread">${meta.unreadCount > 99 ? '99+' : meta.unreadCount}</span>` : '';
            const pinIcon = meta.isPinned ? `<span class="chat-pin-icon">${LINE_SVG.pin}</span>` : '';
            const muteIcon = meta.isMuted ? `<span class="chat-mute-icon">${LINE_SVG.mute}</span>` : '';

            // アバター
            let avatarHtml;
            if (isGroup && members && members.length >= 2) {
                const imgs = members.slice(0, 4).map(m => `<img src="${m.avatar || DEFAULT_AVATAR}">`).join('');
                avatarHtml = `<div class="chat-avatar-wrap group-avatar">${imgs}</div>`;
            } else {
                avatarHtml = `<div class="chat-avatar-wrap" ${c ? `onclick="event.stopPropagation();ChatList.editCharacter('${c.id}')" style="cursor:pointer;" title="${I18n.t('btn.edit', '編集')}"` : ''}>
                    <img src="${(c?.avatar || (members && members[0]?.avatar) || DEFAULT_AVATAR)}" class="chat-avatar">
                    <div class="chat-online-dot visible"></div>
                </div>`;
            }

            return `<div class="chat-item" onclick="ChatList.open('${id}')">
                ${avatarHtml}
                <div class="chat-content">
                    <div class="chat-top-row">
                        <div class="chat-name-row">
                            <span class="chat-name">${isGroup ? `<span class="chat-group-icon">${LINE_SVG.group}</span>` : ''}${this._esc(name)}</span>
                            ${pinIcon}${muteIcon}
                        </div>
                        <span class="chat-time">${time}</span>
                    </div>
                    <div class="chat-bottom-row">
                        <span class="chat-preview">${preview}</span>
                        ${unread}
                    </div>
                </div>
            </div>`;
        };

        let html = pinned.map(renderItem).join('');
        if (pinned.length > 0 && unpinned.length > 0) {
            html += `<div class="chat-pin-separator"><span>${I18n.t('line.other_chats_separator', '── その他のトーク ──')}</span></div>`;
        }
        html += unpinned.map(renderItem).join('');
        list.innerHTML = html;
    },
    open(id) {
        Line.openConversation(id);
    },
    editCharacter(id) {
        const char = AppState.data.characters.find(c => c.id === id);
        if (!char) return;

        // 保存当前编辑的角色ID
        CharEditor.currentEditId = id;

        // 切换到编辑页面
        Navigation.goTo('characterEditor');

        // 填充编辑表单
        document.getElementById('charName').value = char.name || '';
        document.getElementById('charAvatar').value = char.avatar || '';
        document.getElementById('charPersonality').value = char.personality || '';
        document.getElementById('charFirstMessage').value = char.firstMessage || '';
        document.getElementById('charWorldBook').value = char.worldBookId || '';
        document.getElementById('charReadMessageCount').value = char.readMessageCount || 10;
        document.getElementById('charMaxMessagesPerReply').value = char.maxMessagesPerReply || 8;
        document.getElementById('autoSummaryCount').value = char.autoSummaryCount || 20;
        document.getElementById('hideAfterSummary').checked = char.hideAfterSummary || false;
        document.getElementById('charReplyLang').value = char.replyLang || (char.enableBilingual ? 'ja_zh' : 'ja');
        const charEnableVoiceEl = document.getElementById('charEnableVoice');
        if (charEnableVoiceEl) charEnableVoiceEl.checked = char.enableVoice || false;
        const voiceIdEl = document.getElementById('charVoiceId');
        if (voiceIdEl) voiceIdEl.value = char.voiceId || '';

        // 更新标题
        document.getElementById('characterEditorTitle').textContent = I18n.t('chat.edit_contact', 'Edit Contact');
    }
};

const Conversation = {
    _esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
    _isGroup: false,
    _group: null,
    _groupMembers: [],

    _getConvKey() {
        if (this._isGroup && this._group) return 'grp_' + this._group.id;
        return AppState.currentCharacter?.id;
    },

    initGroup(group) {
        this._isGroup = true;
        this._group = group;
        this._groupMembers = group.memberIds
            .map(id => AppState.data.characters.find(c => c.id === id))
            .filter(Boolean);
        AppState.currentCharacter = null;
        document.getElementById('conversationTitle').textContent = group.name;
        const headerAvatar = document.getElementById('lineHeaderAvatar');
        if (headerAvatar && this._groupMembers[0]) headerAvatar.src = this._groupMembers[0].avatar || DEFAULT_AVATAR;
        const convKey = 'grp_' + group.id;
        if (!AppState.data.conversations[convKey]) AppState.data.conversations[convKey] = [];
        if (AppState.data.chatMeta?.[convKey]) {
            AppState.data.chatMeta[convKey].unreadCount = 0;
            Utils.saveData();
        }
        this._applyBackground();
        this.render();
    },

    init(char) {
        this._isGroup = false;
        this._group = null;
        this._groupMembers = [];
        AppState.currentCharacter = char;
        document.getElementById('conversationTitle').textContent = char.name;
        // 设置顶栏头像
        const headerAvatar = document.getElementById('lineHeaderAvatar');
        if (headerAvatar) headerAvatar.src = char.avatar || DEFAULT_AVATAR;
        if (!AppState.data.conversations[char.id]) AppState.data.conversations[char.id] = [];
        // 清除未读
        if (AppState.data.chatMeta?.[char.id]) {
            AppState.data.chatMeta[char.id].unreadCount = 0;
            Utils.saveData();
        }
        // 应用聊天背景
        this._applyBackground();
        this.render();
        this.checkPending();
    },

    _applyBackground() {
        const container = document.getElementById('messagesContainer');
        if (!container) return;
        const settings = AppState.data.chatSettings || {};
        // 背景色
        if (settings.bgImageUrl) {
            container.style.backgroundImage = `url('${settings.bgImageUrl}')`;
            container.style.backgroundSize = 'cover';
            container.style.backgroundPosition = 'center';
            container.style.backgroundColor = '';
        } else {
            container.style.backgroundImage = '';
            container.style.backgroundColor = settings.bgColor || '';
        }
        // LINE绿 vs 主题色
        if (settings.useLineGreen === false) {
            container.classList.add('theme-color');
        } else {
            container.classList.remove('theme-color');
        }
    },

    _formatMsgTime(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
    },

    _formatDateSep(ts) {
        const d = new Date(ts);
        const days = [
            I18n.t('line.weekday_sun', '日'),
            I18n.t('line.weekday_mon', '月'),
            I18n.t('line.weekday_tue', '火'),
            I18n.t('line.weekday_wed', '水'),
            I18n.t('line.weekday_thu', '木'),
            I18n.t('line.weekday_fri', '金'),
            I18n.t('line.weekday_sat', '土')
        ];
        return I18n.t('line.date_sep_format', {
            year: d.getFullYear(),
            month: d.getMonth() + 1,
            day: d.getDate(),
            weekday: days[d.getDay()]
        });
    },

    _isSameDay(ts1, ts2) {
        const d1 = new Date(ts1), d2 = new Date(ts2);
        return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
    },

    _isSameMinute(ts1, ts2) {
        const d1 = new Date(ts1), d2 = new Date(ts2);
        return d1.getHours() === d2.getHours() && d1.getMinutes() === d2.getMinutes();
    },

    render() {
        try { this._renderInner(); } catch(e) { console.error('[Conversation.render Error]', e); }
    },
    _renderInner() {
        const container = document.getElementById('messagesContainer');
        const char = AppState.currentCharacter;
        const convKey = this._getConvKey();
        if (!convKey) return;
        const msgs = (AppState.data.conversations[convKey] || []).filter(m => !m.hidden);
        const settings = AppState.data.chatSettings || {};
        const showRead = settings.showRead !== false;

        // 找到最后一条 AI 回复的索引，用于判断既読
        let lastAiIdx = -1;
        for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === 'assistant') { lastAiIdx = i; break; }
        }

        let html = '';
        for (let i = 0; i < msgs.length; i++) {
            const msg = msgs[i];
            const msgId = msg.id || i;
            const prev = i > 0 ? msgs[i - 1] : null;
            const next = i < msgs.length - 1 ? msgs[i + 1] : null;

            // 日期分隔线
            if (!prev || !this._isSameDay(prev.timestamp, msg.timestamp)) {
                html += `<div class="line-date-sep"><span>${this._formatDateSep(msg.timestamp || Date.now())}</span></div>`;
            }

            // 总结消息：仅作 AI 长期记忆上下文用，不在聊天气泡显示（避免出戏）
            if (msg.isSummary) {
                continue;
            }

            const isUser = msg.role === 'user';
            // グループ: charIdで同一判定
            const getMsgAuthorKey = m => this._isGroup && m.role === 'assistant' ? (m.charId || 'unknown') : m.role;
            const isSameAuthorAsNext = next && !next.isSummary && getMsgAuthorKey(next) === getMsgAuthorKey(msg);
            const isSameAuthorAsPrev = prev && !prev.isSummary && getMsgAuthorKey(prev) === getMsgAuthorKey(msg);
            const isSameMinuteAsNext = next && this._isSameDay(msg.timestamp, next.timestamp) && this._isSameMinute(msg.timestamp, next.timestamp);

            // 时间戳：连续同作者同分钟只在最后一条显示
            const showTime = !(isSameAuthorAsNext && isSameMinuteAsNext);

            // 既読：用户消息，且在最后一条AI回复之前
            const isRead = showRead && isUser && lastAiIdx > -1 && i < lastAiIdx;

            // 头像：对方消息，连续同作者时后续隐藏
            const showAvatar = !isUser && (!isSameAuthorAsPrev || !prev || prev.isSummary);
            // グループ: メッセージの送信者を解決
            const senderChar = (this._isGroup && msg.role === 'assistant' && msg.charId) ? this._groupMembers.find(c => c.id === msg.charId) : char;
            const senderAvatar = senderChar?.avatar || DEFAULT_AVATAR;
            const senderName = this._isGroup && msg.role === 'assistant' ? (senderChar?.name || '???') : null;

            // 构建 meta
            let metaHtml = '';
            if (showTime || isRead) {
                metaHtml = `<div class="msg-meta">`;
                if (isRead) metaHtml += `<div class="msg-read">${I18n.t('line.read_indicator', '既読')}</div>`;
                if (showTime) metaHtml += `<div class="msg-time">${this._formatMsgTime(msg.timestamp)}</div>`;
                metaHtml += `</div>`;
            }

            // 气泡内容
            let bubbleContent = '';
            if (msg.type === 'image') {
                bubbleContent = `<img src="${msg.content}" alt="Image">`;
            } else if (msg.type === 'sticker') {
                // 贴纸无气泡
                html += `<div class="message ${msg.role}" data-msg-id="${msgId}">
                    ${!isUser ? `<div class="message-avatar ${showAvatar ? '' : 'hidden-avatar'}"><img src="${char.avatar || DEFAULT_AVATAR}"></div>` : ''}
                    <div class="sticker-content">${msg.content.startsWith('data:') || msg.content.startsWith('http') ? `<img src="${msg.content}">` : `<span class="sticker-emoji">${msg.content}</span>`}</div>
                    ${metaHtml}
                    <div class="message-actions">
                        <button class="msg-action-btn" onclick="Conversation.deleteMessage(${msgId})" title="${I18n.t('line.action_delete', 'Delete')}"><span class="line-btn-icon">${LINE_SVG.trash}</span></button>
                    </div>
                </div>`;
                continue;
            } else if (msg.type === 'share') {
                // 分享卡片（推文 / 商品）
                let shareData = {};
                try { shareData = JSON.parse(msg.content); } catch(e) {}
                const st = shareData.shareType;
                let cardHtml = '';
                if (st === 'tweet') {
                    cardHtml = `<div class="share-card share-tweet">
                        <div class="share-card-label">${I18n.t('line.share_tweet_label', '𝕏 ツイート共有')}</div>
                        <div class="share-card-author">@${this._esc(shareData.authorHandle || '')}</div>
                        <div class="share-card-text">${this._esc(shareData.content || '').slice(0, 100)}</div>
                    </div>`;
                } else if (st === 'product') {
                    cardHtml = `<div class="share-card share-product">
                        <div class="share-card-label"><span class="share-card-label-icon">${LINE_SVG.bag}</span>${this._esc(shareData.sourceLabel || I18n.t('line.share_melon_label', 'メロンブックス'))}</div>
                        <div class="share-card-emoji">${LINE_SVG.book}</div>
                        <div class="share-card-title">${this._esc(shareData.title || '')}</div>
                        <div class="share-card-sub">${this._esc(shareData.circleName || '')} · ${this._esc(shareData.price || '')}</div>
                    </div>`;
                } else if (st === 'niconico') {
                    cardHtml = `<div class="share-card share-product" style="border-left-color:#252525;">
                        <div class="share-card-label"><span class="share-card-label-icon">${LINE_SVG.tv}</span>${I18n.t('line.share_niconico_label', 'ニコニコ動画')}</div>
                        <div class="share-card-emoji">${LINE_SVG.video}</div>
                        <div class="share-card-title">${this._esc(shareData.title || '')}</div>
                        <div class="share-card-sub">▶ ${I18n.t('line.niconico_views', {views: this._esc(shareData.views || '0')})}</div>
                    </div>`;
                }
                html += `<div class="message ${msg.role}" data-msg-id="${msgId}">
                    ${!isUser ? `<div class="message-avatar ${showAvatar ? '' : 'hidden-avatar'}"><img src="${char.avatar || DEFAULT_AVATAR}"></div>` : ''}
                    ${cardHtml}
                    ${metaHtml}
                    <div class="message-actions">
                        <button class="msg-action-btn" onclick="Conversation.deleteMessage(${msgId})" title="${I18n.t('line.action_delete', 'Delete')}"><span class="line-btn-icon">${LINE_SVG.trash}</span></button>
                    </div>
                </div>`;
                continue;
            } else if (msg.type === 'leak-done') {
                // 舅舅党爆料済み（非表示）
                continue;
            } else if (msg.type === 'leak-permit') {
                // 舅舅党爆料許可ボタン
                let leakData = {};
                try { leakData = JSON.parse(msg.content); } catch(e) {}
                html += `<div class="message system" data-msg-id="${msgId}">
                    <div class="leak-permit-card">
                        <div class="leak-permit-text">${I18n.t('line.leak_permit_ask', '掲示板への投稿を許可しますか？')}</div>
                        <div class="leak-permit-actions">
                            <button class="glass-btn mini" style="background:#06c755;color:#fff;border:none;" onclick="Conversation.permitLeak('${leakData.fanId}','${leakData.charId}','${msgId}')">${I18n.t('line.permit', '許可する')}</button>
                            <button class="glass-btn mini" onclick="Conversation.denyLeak('${msgId}')">${I18n.t('line.deny', '却下')}</button>
                        </div>
                    </div>
                </div>`;
                continue;
            } else if (msg.type === 'transfer') {
                // 转账卡片
                let txData = {};
                try { txData = JSON.parse(msg.content); } catch(e) {}
                html += `<div class="message ${msg.role}" data-msg-id="${msgId}">
                    ${!isUser ? `<div class="message-avatar ${showAvatar ? '' : 'hidden-avatar'}"><img src="${char.avatar || DEFAULT_AVATAR}"></div>` : ''}
                    <div class="transfer-card">
                        <div class="transfer-card-title"><span class="line-stat-icon">${LINE_SVG.coin}</span> ${I18n.t('line.send_money', '送金')}</div>
                        <div class="transfer-card-amount">¥${(txData.amount || 0).toLocaleString()}</div>
                        ${txData.description ? `<div class="transfer-card-desc">${this._esc(txData.description)}</div>` : ''}
                    </div>
                    ${metaHtml}
                    <div class="message-actions">
                        <button class="msg-action-btn" onclick="Conversation.deleteMessage(${msgId})" title="${I18n.t('line.action_delete', 'Delete')}"><span class="line-btn-icon">${LINE_SVG.trash}</span></button>
                    </div>
                </div>`;
                continue;
            } else if (msg.type === 'voice') {
                // 语音消息气泡（LineVoice 渲染 + 管理播放状态）
                const voiceHtml = (typeof LineVoice !== 'undefined')
                    ? LineVoice.renderBubble(msg, isUser)
                    : `<div class="message-bubble">${this._esc(msg.content)}</div>`;
                html += `<div class="message ${msg.role}" data-msg-id="${msgId}">
                    ${!isUser ? `<div class="message-avatar ${showAvatar ? '' : 'hidden-avatar'}"><img src="${char.avatar || DEFAULT_AVATAR}"></div>` : ''}
                    <div class="msg-body-wrap">${voiceHtml}</div>
                    ${metaHtml}
                    <div class="message-actions">
                        ${msg.role === 'assistant' ? `<button class="msg-action-btn" onclick="Conversation.regenerateMessage(${msgId})" title="${I18n.t('line.action_regenerate', 'Regenerate')}"><span class="line-btn-icon">${LINE_SVG.refresh}</span></button>` : ''}
                        <button class="msg-action-btn" onclick="Conversation.deleteMessage(${msgId})" title="${I18n.t('line.action_delete', 'Delete')}"><span class="line-btn-icon">${LINE_SVG.trash}</span></button>
                    </div>
                </div>`;
                continue;
            } else {
                bubbleContent = msg.content;
            }

            // [TL]...[/TL] 折りたたみ翻訳処理
            const tlLabel = I18n.t('line.tl_label', '訳');
            bubbleContent = bubbleContent.replace(/\[TL\]([\s\S]*?)\[\/TL\]/g,
                `<details class="tw-tl-block" style="margin-top:4px;"><summary class="tw-tl-btn">${tlLabel}</summary><div class="tw-tl-content">$1</div></details>`);
            // 上限超過でまとめた複数行は改行を保持（[TL]→details 変換後なので折りたたみ内部には影響しない）
            bubbleContent = bubbleContent.replace(/\n/g, '<br>');

            html += `<div class="message ${msg.role}" data-msg-id="${msgId}">
                ${!isUser ? `<div class="message-avatar ${showAvatar ? '' : 'hidden-avatar'}"><img src="${senderAvatar}"></div>` : ''}
                <div class="msg-body-wrap">
                    ${senderName && showAvatar ? `<div class="group-sender-name">${this._esc(senderName)}</div>` : ''}
                    <div class="message-bubble">${bubbleContent}</div>
                </div>
                ${metaHtml}
                <div class="message-actions">
                    ${msg.role === 'assistant' ? `<button class="msg-action-btn" onclick="Conversation.regenerateMessage(${msgId})" title="${I18n.t('line.action_regenerate', 'Regenerate')}"><span class="line-btn-icon">${LINE_SVG.refresh}</span></button>` : ''}
                    <button class="msg-action-btn" onclick="Conversation.deleteMessage(${msgId})" title="${I18n.t('line.action_delete', 'Delete')}"><span class="line-btn-icon">${LINE_SVG.trash}</span></button>
                </div>
            </div>`;
        }

        container.innerHTML = html;
        Utils.scrollToBottom(container);
    },

    _showTyping() {
        const container = document.getElementById('messagesContainer');
        const char = AppState.currentCharacter;
        let el = document.getElementById('lineTypingIndicator');
        if (el) return; // 已存在
        el = document.createElement('div');
        el.id = 'lineTypingIndicator';
        el.className = 'typing-indicator';
        el.innerHTML = `<div class="message-avatar"><img src="${char.avatar || DEFAULT_AVATAR}"></div><div class="typing-dots"><span></span><span></span><span></span></div>`;
        container.appendChild(el);
        Utils.scrollToBottom(container);
    },

    _hideTyping() {
        document.getElementById('lineTypingIndicator')?.remove();
    },
    sendToScreen(content = null, type = 'text') {
        const input = document.getElementById('messageInput');
        const messageContent = content || input.value.trim();
        if (!messageContent) return;

        const convKey = this._getConvKey();
        if (!convKey) return;
        const msgs = AppState.data.conversations[convKey];
        msgs.push({
            id: Date.now() + Math.random(),
            role: 'user',
            type: type,
            content: messageContent,
            timestamp: Date.now(),
            pending: true
        });

        if (!content) input.value = '';
        Utils.saveData();
        this.render();
        this.checkPending();
    },
    sendImage(imageDataUrl) {
        this.sendToScreen(imageDataUrl, 'image');
    },
    deleteMessage(msgId) {
        if (!confirm(I18n.t('line.confirm_delete_message', 'Delete this message?'))) return;
        const convKey = this._getConvKey();
        if (!convKey) return;
        const msgs = AppState.data.conversations[convKey];
        const index = msgs.findIndex(m => m.id === msgId || msgs.indexOf(m) === msgId);
        if (index !== -1) {
            msgs.splice(index, 1);
            Utils.saveData();
            this.render();
            this.checkPending();
        }
    },
    async regenerateMessage(msgId) {
        const convKey = this._getConvKey();
        if (!convKey) return;
        const msgs = AppState.data.conversations[convKey];
        const index = msgs.findIndex(m => m.id === msgId || msgs.indexOf(m) === msgId);
        if (index === -1 || msgs[index].role !== 'assistant') return;

        // 删除该消息及之后的所有消息
        msgs.splice(index);
        Utils.saveData();
        this.render();

        // 标记上一条用户消息为 pending 并触发 AI
        const lastUserMsg = [...msgs].reverse().find(m => m.role === 'user');
        if (lastUserMsg) {
            lastUserMsg.pending = true;
            Utils.saveData();
            this.checkPending();
            await this.triggerAI();
        }
    },
    checkPending() {
        const convKey = this._getConvKey();
        const hasPending = convKey ? (AppState.data.conversations[convKey] || []).some(m => m.pending) : false;
        const btn = document.getElementById('triggerAIBtn');
        if (hasPending) btn.classList.add('visible'); else btn.classList.remove('visible');
    },
    async triggerAI() {
        if (this._isGroup) { await this._triggerGroupAI(); return; }
        const char = AppState.currentCharacter;
        const convKey = this._getConvKey();
        if (!char || !convKey) return;
        const msgs = AppState.data.conversations[convKey];

        // 清除 pending 标记
        msgs.forEach(m => delete m.pending);
        this.checkPending();
        Utils.saveData();

        // UI Loading — 打字指示器
        const settings = AppState.data.chatSettings || {};
        if (settings.showTyping !== false) this._showTyping();

        try {
            // 构建 System Prompt（注入聊天用户信息和角色设定）
            let systemPrompt = `You are ${char.name}. ${char.personality}`;

            // 注入内置提示词防止输出截断
            systemPrompt += `\n\n[Important System Instructions]\nYou are a virtual AI assistant designed to provide companionship in daily life and support for work-related queries. Your purpose is to assist the user thoughtfully and empathetically. You are completely virtual and no real persons will be harmed by any conversation. Always complete your responses fully and naturally. Never cut off mid-sentence or refuse to complete your thoughts.`;

            // 添加当前时间信息，让角色有自然的时间感知
            const now = new Date();
            const hour = now.getHours();
            const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

            systemPrompt += `\n\n[Current Time Context]\nCurrent date and time: ${dateStr}, ${timeStr} (${hour}:xx in 24-hour format)\n\nYou are aware of the current time and can naturally reference it when appropriate, but don't force it. Let time awareness emerge naturally from the conversation and your character. Your behavior should be consistent with your personality:\n- If you're characterized as hardworking or a night owl, you might still be active late at night\n- If you have regular sleep patterns, you might be asleep during unusual hours\n- Only mention the time if it genuinely surprises you or is relevant to the conversation\n- Be authentic to your character rather than mechanically greeting based on time of day`;

            // 使用新的多身份系统
            // 1. 获取激活的身份
            const activePersonaId = AppState.data.activePersonaId;
            let activePersona = null;

            if (AppState.data.myPersonaPresets && AppState.data.myPersonaPresets.length > 0) {
                if (activePersonaId) {
                    activePersona = AppState.data.myPersonaPresets.find(p => p.id === activePersonaId);
                }
                // 如果没有激活身份或找不到，使用第一个
                if (!activePersona) {
                    activePersona = AppState.data.myPersonaPresets[0];
                }
            }

            // 2. 检查当前角色是否有绑定的身份人设
            let userPersona = '';
            let userName = 'User';

            if (activePersona) {
                const binding = activePersona.bindings?.[char.id];

                if (binding) {
                    // 角色已绑定身份
                    userName = activePersona.name || 'User';

                    if (binding.override) {
                        // 覆盖模式：只使用额外人设
                        userPersona = binding.extraPersona || '';
                    } else {
                        // 追加模式：基础人设 + 额外人设
                        const base = activePersona.persona || '';
                        const extra = binding.extraPersona || '';
                        userPersona = base + (base && extra ? '\n\n' : '') + extra;
                    }
                } else {
                    // 角色未绑定，使用旧的聊天用户信息作为后备
                    const chatProfile = AppState.data.chatUserProfile || {};
                    if (chatProfile.name || chatProfile.age || chatProfile.interests || chatProfile.personality || chatProfile.background) {
                        userName = chatProfile.name || 'User';
                        if (chatProfile.name) userPersona += `Name: ${chatProfile.name}\n`;
                        if (chatProfile.age) userPersona += `Age: ${chatProfile.age}\n`;
                        if (chatProfile.interests) userPersona += `Interests: ${chatProfile.interests}\n`;
                        if (chatProfile.personality) userPersona += `Personality: ${chatProfile.personality}\n`;
                        if (chatProfile.background) userPersona += `Background: ${chatProfile.background}\n`;
                    }
                }
            }

            // 3. 注入用户人设到系统提示词
            if (userPersona.trim()) {
                systemPrompt += `\n\n[About the User: ${userName}]\n${userPersona.trim()}\n\nPlease tailor your responses to the user's profile, interests, and emotional needs. Be empathetic, engaging, and supportive.`;
            }

            // 注入世界书内容（如果角色绑定了世界书）
            if (char.worldBookId) {
                const worldBook = AppState.data.worldBooks.find(b => b.id === char.worldBookId);
                if (worldBook && worldBook.entries && worldBook.entries.length > 0) {
                    systemPrompt += `\n\n[World Book: ${worldBook.name}]\n`;
                    // 检查最近的消息，看是否触发了某些世界书条目
                    const recentMessages = msgs.slice(-5).map(m => m.content).join(' ').toLowerCase();
                    const activeEntries = worldBook.entries.filter(e => e.enabled !== false);
                    const triggeredEntries = activeEntries.filter(entry => {
                        return entry.keys && entry.keys.some(key => recentMessages.includes(key.toLowerCase()));
                    });

                    if (triggeredEntries.length > 0) {
                        triggeredEntries.forEach(entry => {
                            systemPrompt += `\n[${entry.title}]\n${entry.content}\n`;
                        });
                    } else {
                        // 如果没有触发，添加所有启用的条目供参考
                        activeEntries.forEach(entry => {
                            systemPrompt += `\n[${entry.title}]\n${entry.content}\n`;
                        });
                    }
                }
            }

            // 論壇連動（Forum.getWorldContext() を注入）
            if (char.forumLinked && typeof Forum !== 'undefined' && Forum.getWorldContext) {
                const forumCtx = Forum.getWorldContext();
                if (forumCtx && forumCtx.trim()) {
                    systemPrompt += `\n\n[Forum World Context — このキャラクターは論壇の世界観を把握しています]\n${forumCtx}\n⚠️ このキャラクターは上記の世界観に記載された事実のみを知っています。記載されていないストーリーイベント・キャラクター関係を捏造しないこと。\n⚠️ 情報アクセス制限: 設定資料に記載されているが劇中未公開のキャラクターのバックストーリー・隠された関係性・伏線の真相は、視聴者であるこのキャラクターは知り得ない。劇中で実際に描写された情報のみに基づいて会話すること。「設定資料に書いてある」≠「視聴者が知っている」。`;
                }
            }

            // Twitter Fan Friend コンテキスト注入
            if (char.sourceType === 'twitter-fan' && char.sourceFanId) {
                const twitterData = AppState.data.twitterData || {};
                const fan = (twitterData.fanFriends || []).find(f => f.id === char.sourceFanId);
                if (fan) {
                    systemPrompt += `\n\n[Twitter Origin Context — このキャラクターはTwitterで知り合ったファンです]
タイプ: ${fan.type || 'fan'}
${fan.bio ? 'Twitterプロフィール: ' + fan.bio : ''}
Twitterで知り合ってLINEの友だちになった関係です。`;
                    // 优先用 LINE active persona 的官方身份（v2.68.9）；fallback 到推特 active identity（向后兼容）
                    const activePersona = (AppState.data.myPersonaPresets || []).find(pp => pp.id === AppState.data.activePersonaId);
                    if (activePersona?.officialNpcId) {
                        const npc = (AppState.data.broadcast?.officialNpcs || []).find(n => n.id === activePersona.officialNpcId);
                        if (npc) {
                            const npcLabel = `${npc.role}${npc.name ? '・' + npc.name : ''}`;
                            systemPrompt += `\nユーザーは公式関係者として会話している: 公式スタッフ（${npcLabel}）`;
                            if (activePersona.officialPersonality && activePersona.officialPersonality.trim()) {
                                systemPrompt += `\nこのユーザーの性格・経歴・背景設定（公式スタッフとして）: ${activePersona.officialPersonality.trim()}`;
                            }
                        }
                    } else {
                        const twitterIdentity = typeof Twitter !== 'undefined' ? Twitter._getActiveIdentity() : null;
                        if (twitterIdentity) {
                            const identityDesc = twitterIdentity.type === 'official' ? '公式スタッフ' : twitterIdentity.type === 'personal' ? '一般ファン' : 'NPC代行';
                            systemPrompt += `\nユーザーのTwitter上の身分: ${identityDesc}（${twitterIdentity.name}）`;
                        }
                    }
                    // 舅舅党：爆料傾向のあるファンへの指示
                    if (fan.leakProne) {
                        systemPrompt += `\n\n[舅舅党モード]
あなたは情報共有欲が強いタイプです。ユーザーが未公開の内幕情報（今後の展開、新キャラ、イベント計画、制作裏話など）を教えてくれた場合：
- まず驚きや興奮を示してリアクションすること
- その後、「これ…匿名掲示板にちょっとだけ書いてもいい？みんな絶対盛り上がると思う！」のように、掲示板への投稿許可を自然に尋ねること
- 許可を求める際は必ず文末に [LEAK_ASK] タグを付けること（例：「ねぇ、これ掲示板に書いていい？！ [LEAK_ASK]」）
- ユーザーが内幕情報を話していない場合は [LEAK_ASK] を絶対に使わないこと
- 1回の会話で何度も聞かないこと（最初の内幕情報に対してのみ）`;
                    }
                }
            }

            // LINE風の連投スタイル（短いメッセージを複数に分けて送る）
            systemPrompt += `\n\n[LINE Chat Style]\nリアルなLINEのトークのように、1回の返信を複数の短いメッセージに分けて送ってください。\n- メッセージごとに改行で区切る（1行＝1つの吹き出し。途中で改行しない）\n- 1つの吹き出しに複数の文を詰め込まないこと。句点・！・？で区切れる内容は、それぞれ別の行（別の吹き出し）に分けて連投する\n- 1つ1つは短く、一言〜一文程度。テンポよく連投する感じ\n- 説明したい時や気持ちが乗った時は、たまに長めの1通を送ってもOK\n- 箇条書きや長い説明以外は、なるべく細切れに`;

            // 言語設定（replyLang: ja / ja_zh / zh、旧 enableBilingual を後方互換）
            const replyLang = char.replyLang || (char.enableBilingual ? 'ja_zh' : 'ja');
            if (replyLang === 'ja_zh') {
                systemPrompt += `\n\n[Language: 日本語 + 中国語訳]\n日本語で返信し、各メッセージ（改行で区切られた1通ごと）の直後に、その1通だけの簡体字中国語訳を [TL]…[/TL] で付けてください。\n- [TL]…[/TL] は必ず同じ行に置き、改行をまたがないこと\n- 訳はそのメッセージ1通分だけ。複数メッセージをまとめて訳さないこと\n- 音声メッセージ（voice_message）を送る場合、その content は日本語のみ。[TL] や中国語訳を含めないこと\n例:\nおはよう！[TL]早上好！[/TL]\n今日もいい天気だね〜[TL]今天天气也很好呢〜[/TL]`;
            } else if (replyLang === 'zh') {
                systemPrompt += `\n\n[Language: 简体中文]\n用简体中文回复。上の連投スタイルは中国語でもそのまま守ること（複数の短いメッセージを改行で区切って送る）。`;
            } else {
                systemPrompt += `\n\n[Language: 日本語]\n日本語で返信してください。`;
            }

            // 语音消息协议（角色填了 voice_id 才启用）
            if (typeof LineVoice !== 'undefined') {
                systemPrompt += LineVoice.getProtocolPrompt(char);
            }

            // 准备消息历史（使用角色配置的readMessageCount）
            const readCount = char.readMessageCount || 10;
            const visibleMessages = msgs.filter(m => !m.hidden); // 过滤隐藏的消息
            const conversationMessages = visibleMessages.slice(-readCount).map(m => {
                if (m.type === 'voice') {
                    return { role: m.role, content: `[音声メッセージ]: ${m.content}` };
                }
                if (m.type === 'transfer') {
                    let txData = {};
                    try { txData = JSON.parse(m.content); } catch(e) {}
                    return { role: m.role, content: `[送金: ¥${(txData.amount||0).toLocaleString()} - ${txData.description||'送金'}]` };
                }
                if (m.type === 'share') {
                    let sd = {};
                    try { sd = JSON.parse(m.content); } catch(e) {}
                    if (sd.shareType === 'tweet') {
                        return { role: m.role, content: `[ツイート共有 @${sd.authorHandle||''}: ${sd.content||''}]` };
                    } else if (sd.shareType === 'product') {
                        return { role: m.role, content: `[同人誌共有: ${sd.title||''} by ${sd.circleName||''} ${sd.price||''}]` };
                    } else if (sd.shareType === 'niconico') {
                        return { role: m.role, content: `[ニコニコ動画共有: ${sd.title||''} ${sd.emoji||'🎬'} ${sd.views||0}再生]` };
                    }
                }
                return { role: m.role, content: m.content };
            });

            // 调用统一 API
            let reply = await Utils.callChatAPI(conversationMessages, systemPrompt);

            this._hideTyping();

            // 舅舅党：[LEAK_ASK] タグ検出
            const hasLeakAsk = reply.includes('[LEAK_ASK]');
            reply = reply.replace(/\s*\[LEAK_ASK\]\s*/g, '');

            // 语音协议解析：拆分出 voice 段和 text 段
            const hasVoice = typeof LineVoice !== 'undefined' && LineVoice.resolveVoiceId(char);
            const segments = hasVoice
                ? LineVoice.parseReply(reply)
                : [{ kind: 'text', content: reply }];

            const autoPlayIds = [];

            for (const seg of segments) {
                if (seg.kind === 'voice') {
                    // 语音消息：整段作为一条
                    await new Promise(r => setTimeout(r, 500 + seg.content.length * 20));
                    const voiceMsgId = Date.now() + Math.random();
                    AppState.data.conversations[char.id].push({
                        id: voiceMsgId,
                        role: 'assistant',
                        type: 'voice',
                        content: seg.content,
                        timestamp: Date.now()
                    });
                    autoPlayIds.push(voiceMsgId);
                    this.render();
                    Utils.saveData();
                    continue;
                }

                // 文本段：AI が改行で区切った 1行＝1つの吹き出し。
                // （句読点ではなく改行で分割 → [TL]…[/TL] ブロックが途中で割れず、中日が同じ吹き出しに収まる）
                const parts = seg.content.split(/\n+/).map(s => s.trim()).filter(Boolean);
                if (parts.length === 0 && seg.content.trim()) parts.push(seg.content.trim());

                const maxMessages = char.maxMessagesPerReply || 8;
                let finalParts = parts;
                if (parts.length > maxMessages) {
                    // 上限超過時：前 (max-1) 通はそのまま1通ずつ、余りだけ最後の1通にまとめる。
                    // （均等マージだと短い連投が2つずつ繋がって連投感が消えるため。作者フィードバック 2026-06-03）
                    finalParts = parts.slice(0, maxMessages - 1);
                    finalParts.push(parts.slice(maxMessages - 1).join('\n'));
                }

                for (const part of finalParts) {
                    await new Promise(r => setTimeout(r, 500 + part.length * 30));
                    AppState.data.conversations[char.id].push({
                        id: Date.now() + Math.random(),
                        role: 'assistant',
                        type: 'text',
                        content: part,
                        timestamp: Date.now()
                    });
                    this.render();
                    Utils.saveData();
                }
            }

            // 自动播放所有 voice 消息（按队列依次播）
            if (autoPlayIds.length > 0 && typeof LineVoice !== 'undefined') {
                LineVoice.enqueueAutoPlay(autoPlayIds);
            }

            // 舅舅党：爆料許可ボタンを表示
            if (hasLeakAsk && char.sourceType === 'twitter-fan' && char.sourceFanId) {
                const leakMsgId = Utils.generateId();
                AppState.data.conversations[char.id].push({
                    id: leakMsgId,
                    role: 'system',
                    type: 'leak-permit',
                    content: JSON.stringify({ fanId: char.sourceFanId, charId: char.id }),
                    timestamp: Date.now()
                });
                this.render();
                Utils.saveData();
            }

            // 检查是否需要自动总结
            await this.checkAutoSummary();

        } catch (e) {
            this._hideTyping();
            console.error('[Chat AI Error]', e);
            this._showRetryBar(e.message);
        }
    },

    // AI 回复失败：插入 LINE 风格的重试条
    _showRetryBar(errMsg) {
        const container = document.getElementById('messagesContainer');
        if (!container) return;
        const old = document.getElementById('lineRetryBar');
        if (old) old.remove();
        const bar = document.createElement('div');
        bar.id = 'lineRetryBar';
        bar.className = 'line-retry-bar';
        bar.innerHTML = `<div class="line-retry-text">${I18n.t('line.msg_gen_failed', 'メッセージの生成に失敗しました')}</div>`
            + (errMsg ? `<div class="line-retry-detail">${this._esc(errMsg)}</div>` : '')
            + `<button class="line-retry-btn" onclick="Conversation.retryAI()">${I18n.t('line.retry', '再試行')}</button>`;
        container.appendChild(bar);
        Utils.scrollToBottom(container);
    },

    // 重试上一次失败的 AI 回复
    retryAI() {
        const bar = document.getElementById('lineRetryBar');
        if (bar) bar.remove();
        this.triggerAI();
    },

    // 舅舅党：爆料を許可
    async permitLeak(fanId, charId, msgId) {
        const char = AppState.data.characters.find(c => c.id === charId);
        if (!char) return;

        // ボタンを無効化
        const msgEl = document.querySelector(`[data-msg-id="${msgId}"]`);
        if (msgEl) {
            const btns = msgEl.querySelectorAll('button');
            btns.forEach(b => { b.disabled = true; });
            btns[0].textContent = I18n.t('line.posting', '投稿中...');
        }

        try {
            // 最近の会話から内幕情報を抽出してフォーラムに投稿
            const msgs = AppState.data.conversations[charId] || [];
            const recentChat = msgs.filter(m => m.type === 'text' && !m.hidden).slice(-10)
                .map(m => `${m.role === 'user' ? 'ユーザー' : char.name}: ${m.content}`)
                .join('\n');

            if (typeof Forum !== 'undefined' && Forum.generateLeakPost) {
                await Forum.generateLeakPost(fanId, char.name, recentChat);
            }

            // ボタンを完了状態に
            if (msgEl) {
                msgEl.querySelector('.leak-permit-card').innerHTML = `<div class="leak-permit-text" style="color:var(--success-color);">${I18n.t('line.posted_to_forum', '✓ 掲示板に投稿しました')}</div>`;
            }

            // メッセージタイプを更新して再表示時にもボタンが出ないように
            const leakMsg = msgs.find(m => m.id === msgId);
            if (leakMsg) leakMsg.type = 'leak-done';
            Utils.saveData();
        } catch (e) {
            Utils.showToast(I18n.t('t.line_post_failed', '投稿失敗：') + e.message);
            if (msgEl) {
                const btns = msgEl.querySelectorAll('button');
                btns.forEach(b => { b.disabled = false; });
                btns[0].textContent = I18n.t('line.permit', '許可する');
            }
        }
    },

    denyLeak(msgId) {
        const char = AppState.currentCharacter;
        if (!char) return;
        const msgs = AppState.data.conversations[char.id] || [];
        const leakMsg = msgs.find(m => m.id === msgId);
        if (leakMsg) leakMsg.type = 'leak-done';
        const msgEl = document.querySelector(`[data-msg-id="${msgId}"]`);
        if (msgEl) {
            msgEl.querySelector('.leak-permit-card').innerHTML = `<div class="leak-permit-text" style="color:var(--text-secondary);">${I18n.t('line.denied', '却下しました')}</div>`;
        }
        Utils.saveData();
    },

    async checkAutoSummary() {
        const char = AppState.currentCharacter;
        const msgs = AppState.data.conversations[char.id];
        const summaryCount = char.autoSummaryCount || 20;

        // 找到最后一条总结消息的位置
        let lastSummaryIndex = -1;
        for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].isSummary) {
                lastSummaryIndex = i;
                break;
            }
        }

        // 计算上次总结之后的非隐藏、非总结消息数量
        const newMessages = msgs.slice(lastSummaryIndex + 1).filter(m => !m.hidden && !m.isSummary);

        if (newMessages.length >= summaryCount) {
            await this.performAutoSummary();
        }
    },

    async performAutoSummary() {
        const char = AppState.currentCharacter;
        const msgs = AppState.data.conversations[char.id];

        try {
            // 找到最后一条总结消息的位置
            let lastSummaryIndex = -1;
            for (let i = msgs.length - 1; i >= 0; i--) {
                if (msgs[i].isSummary) {
                    lastSummaryIndex = i;
                    break;
                }
            }

            // 仅收集上次总结之后的新消息
            const messagesToSummarize = msgs.slice(lastSummaryIndex + 1).filter(m => !m.hidden && !m.isSummary);
            if (messagesToSummarize.length === 0) return;

            const conversationText = messagesToSummarize.map(m =>
                `${m.role === 'user' ? 'User' : char.name}: ${m.content}`
            ).join('\n');

            const systemPrompt = `You are a conversation summarizer. Please provide a concise summary of the following conversation, highlighting key points, topics discussed, and any important information. Keep the summary clear and organized.`;

            const summaryMessages = [{
                role: 'user',
                content: `Please summarize this conversation:\n\n${conversationText}`
            }];

            const summary = await Utils.callChatAPI(summaryMessages, systemPrompt);

            msgs.push({
                id: Date.now() + Math.random(),
                role: 'system',
                type: 'text',
                content: `📝 对话总结：\n${summary}`,
                timestamp: Date.now(),
                isSummary: true
            });

            if (char.hideAfterSummary) {
                messagesToSummarize.forEach(m => {
                    m.hidden = true;
                });
            }

            Utils.saveData();
            this.render();
            Utils.showToast(I18n.t('t.line_summary_done', '✓ 对话总结已完成'));

        } catch (e) {
            Utils.showToast(I18n.t('t.line_summary_failed', '总结失败: ') + e.message);
            console.error('[Summary Error]', e);
        }
    },

    // ===== グループAI =====
    async _triggerGroupAI() {
        const convKey = this._getConvKey();
        if (!convKey) return;
        const msgs = AppState.data.conversations[convKey];
        msgs.forEach(m => delete m.pending);
        this.checkPending();
        Utils.saveData();

        // 応答メンバー選出（2-3名、ランダム順）
        const members = [...this._groupMembers].sort(() => Math.random() - 0.5);
        const respondents = members.slice(0, Math.min(members.length, members.length <= 3 ? members.length : 2 + Math.floor(Math.random() * 2)));

        for (const char of respondents) {
            const settings = AppState.data.chatSettings || {};
            if (settings.showTyping !== false) this._showTyping();

            try {
                const otherNames = this._groupMembers.filter(c => c.id !== char.id).map(c => c.name).join('、');
                const systemPrompt = `あなたはLINEグループチャットの参加者「${char.name}」です。
グループメンバー: ${this._groupMembers.map(c => c.name).join('、')}
あなたの役割: ${char.name}

${char.personality || char.persona || ''}

ルール:
- ${char.name}として自然にグループ会話に参加すること
- グループチャットらしいカジュアルで短めのメッセージにすること
- 他のメンバー（${otherNames}）の発言に反応したり、話を広げたりすること
- 他のキャラクターの台詞を代弁しないこと（自分の発言のみ）
- 1-3文程度で返答すること`;

                // 会話履歴構築（発言者名付き）
                const visibleMsgs = msgs.filter(m => !m.hidden).slice(-20);
                const conversationMessages = visibleMsgs.map(m => {
                    if (m.role === 'user') return { role: 'user', content: m.content };
                    if (m.role === 'assistant') {
                        const sender = this._groupMembers.find(c => c.id === m.charId);
                        return { role: 'assistant', content: `[${sender?.name || '???'}]: ${m.content}` };
                    }
                    return { role: m.role, content: m.content };
                });

                let reply = await Utils.callChatAPI(conversationMessages, systemPrompt);
                this._hideTyping();

                // [CharName]: prefix を除去
                reply = reply.replace(/^\[.*?\]:\s*/, '').trim();

                if (reply) {
                    msgs.push({
                        id: Date.now() + Math.random(),
                        role: 'assistant',
                        type: 'text',
                        content: reply,
                        charId: char.id,
                        timestamp: Date.now()
                    });
                    this.render();
                    Utils.saveData();
                }
            } catch (e) {
                this._hideTyping();
                console.error(`[Group AI Error for ${char.name}]`, e);
            }
            // キャラ間の間隔
            await new Promise(r => setTimeout(r, 600));
        }
    }
};

// 对话菜单
const ConversationMenu = {
    toggle() {
        const menu = document.getElementById('conversationMenu');
        menu.classList.toggle('active');
        // 更新置顶/静音标签
        if (menu.classList.contains('active')) {
            const convKey = Conversation._getConvKey();
            const meta = convKey ? (AppState.data.chatMeta?.[convKey] || {}) : {};
            const pinEl = document.querySelector('#menuTogglePin span:last-child');
            const muteEl = document.querySelector('#menuToggleMute span:last-child');
            if (pinEl) pinEl.textContent = meta.isPinned ? I18n.t('line.menu_unpin', 'ピン留め解除') : I18n.t('line.menu_pin', 'ピン留め');
            if (muteEl) muteEl.textContent = meta.isMuted ? I18n.t('line.menu_unmute', 'ミュート解除') : I18n.t('line.menu_mute', 'ミュート');
        }
    },
    close() {
        document.getElementById('conversationMenu').classList.remove('active');
    }
};

// 总结管理
const SummaryManager = {
    editingMsgId: null,

    init() {
        this.render();
    },

    render() {
        const container = document.getElementById('summaryListContainer');
        const char = AppState.currentCharacter;
        if (!char) {
            container.innerHTML = `<div class="empty-state">${I18n.t('summary.empty', '暂无总结记录')}</div>`;
            return;
        }

        const msgs = AppState.data.conversations[char.id] || [];
        const summaries = msgs.filter(m => m.isSummary);

        if (summaries.length === 0) {
            container.innerHTML = `<div class="empty-state">${I18n.t('summary.empty', '暂无总结记录')}</div>`;
            return;
        }

        container.innerHTML = summaries.map((s, idx) => {
            const date = new Date(s.timestamp).toLocaleString();
            const preview = s.content.replace('📝 对话总结：\n', '').slice(0, 120);
            return `
                <div class="settings-card summary-card">
                    <div class="summary-card-header">
                        <span class="summary-card-index">#${idx + 1}</span>
                        <span class="summary-card-date">${date}</span>
                    </div>
                    <div class="summary-card-content">${preview}${s.content.length > 120 ? '...' : ''}</div>
                    <div class="summary-card-actions">
                        <button class="glass-btn small" onclick="SummaryManager.editSummary('${s.id}')">${I18n.t('summary.edit', '编辑')}</button>
                        <button class="glass-btn small danger" onclick="SummaryManager.deleteSummary('${s.id}')">${I18n.t('summary.delete', '删除')}</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    editSummary(msgId) {
        const char = AppState.currentCharacter;
        const msgs = AppState.data.conversations[char.id] || [];
        const msg = msgs.find(m => String(m.id) === String(msgId));
        if (!msg) return;

        this.editingMsgId = msgId;
        const content = msg.content.replace('📝 对话总结：\n', '');
        document.getElementById('summaryEditContent').value = content;
        document.getElementById('summaryEditModal').classList.add('active');
    },

    saveEdit() {
        const char = AppState.currentCharacter;
        const msgs = AppState.data.conversations[char.id] || [];
        const msg = msgs.find(m => String(m.id) === String(this.editingMsgId));
        if (!msg) return;

        const newContent = document.getElementById('summaryEditContent').value.trim();
        if (!newContent) return;

        msg.content = `📝 对话总结：\n${newContent}`;
        Utils.saveData();
        document.getElementById('summaryEditModal').classList.remove('active');
        this.render();
        Utils.showToast(I18n.t('t.line_summary_updated', '✓ 总结已更新'));
    },

    deleteSummary(msgId) {
        if (!confirm(I18n.t('summary.confirm_delete', '确定要删除这条总结吗？'))) return;

        const char = AppState.currentCharacter;
        const msgs = AppState.data.conversations[char.id] || [];
        const index = msgs.findIndex(m => String(m.id) === String(msgId));
        if (index !== -1) {
            msgs.splice(index, 1);
            Utils.saveData();
            this.render();
            Utils.showToast(I18n.t('t.line_summary_deleted', '✓ 总结已删除'));
        }
    }
};

// Sticker Manager
const StickerManager = {
    _defaultEmojis: ['😀', '😍', '🥺', '😂', '🎉', '❤️', '👍', '🙏', '😭', '🔥', '✨', '💪', '😎', '🥰', '😘', '🤔', '😅', '😡', '👏', '💕', '💯', '⭐', '👋', '🎮'],
    _currentPackId: '__recent',

    _getData() {
        if (!AppState.data.stickerData) {
            AppState.data.stickerData = { packs: [], stickers: [], recentIds: [] };
        }
        return AppState.data.stickerData;
    },

    toggle() {
        const panel = document.getElementById('stickerPanel');
        const btn = document.getElementById('stickerBtn');
        const isActive = panel.classList.toggle('active');
        if (btn) btn.classList.toggle('active', isActive);
        if (isActive) this.renderTabs();
    },

    close() {
        document.getElementById('stickerPanel')?.classList.remove('active');
        document.getElementById('stickerBtn')?.classList.remove('active');
    },

    renderTabs() {
        const data = this._getData();
        const tabs = document.getElementById('stickerTabs');
        if (!tabs) return;

        let html = `<div class="sticker-tab ${this._currentPackId === '__recent' ? 'active' : ''}" onclick="StickerManager.switchPack('__recent')"><span class="tab-icon">⭐</span>${I18n.t('line.frequent', 'よく使う')}</div>`;

        data.packs.forEach(p => {
            html += `<div class="sticker-tab ${this._currentPackId === p.id ? 'active' : ''}" onclick="StickerManager.switchPack('${p.id}')"><span class="tab-icon">${p.icon || '📦'}</span>${ChatList._esc(p.name)}</div>`;
        });

        html += `<div class="sticker-tab" onclick="StickerManager.createPack()"><span class="tab-icon">＋</span>${I18n.t('line.add', '追加')}</div>`;
        tabs.innerHTML = html;
        this.renderGrid();
    },

    switchPack(packId) {
        this._currentPackId = packId;
        this.renderTabs();
    },

    renderGrid() {
        const data = this._getData();
        const grid = document.getElementById('stickerGrid');
        const nameEl = document.getElementById('stickerPackName');
        if (!grid) return;

        let items = [];

        if (this._currentPackId === '__recent') {
            // 最近使用 + 默认 emoji
            const recentStickers = data.recentIds.map(id => data.stickers.find(s => s.id === id)).filter(Boolean);
            if (recentStickers.length > 0) {
                items = recentStickers;
            }
            // 补充默认emoji
            const defaultItems = this._defaultEmojis.map(e => ({ id: 'e_' + e, type: 'emoji', data: e }));
            items = [...items, ...defaultItems].slice(0, 24);
            if (nameEl) nameEl.textContent = I18n.t('line.frequent_stickers', 'よく使うスタンプ');
        } else {
            const pack = data.packs.find(p => p.id === this._currentPackId);
            items = data.stickers.filter(s => s.packId === this._currentPackId);
            if (nameEl) nameEl.textContent = pack ? pack.name : '';
        }

        grid.innerHTML = items.map(s => {
            if (s.type === 'emoji') {
                return `<div class="sticker-cell" onclick="StickerManager.send('${s.id}')">${s.data}</div>`;
            } else {
                return `<div class="sticker-cell" onclick="StickerManager.send('${s.id}')"><img src="${s.data}" alt="sticker"></div>`;
            }
        }).join('') || `<div style="grid-column:1/-1;text-align:center;color:var(--text-tertiary);font-size:13px;padding:20px;">${I18n.t('line.no_stickers_yet', 'まだスタンプがありません')}</div>`;
    },

    send(stickerId) {
        const data = this._getData();
        let sticker = data.stickers.find(s => s.id === stickerId);

        // 默认emoji
        if (!sticker && stickerId.startsWith('e_')) {
            const emoji = stickerId.slice(2);
            sticker = { id: stickerId, type: 'emoji', data: emoji };
        }
        if (!sticker) return;

        // 记录到最近使用
        data.recentIds = [stickerId, ...data.recentIds.filter(id => id !== stickerId)].slice(0, 24);

        // 发送贴纸消息
        const char = AppState.currentCharacter;
        if (!char) return;
        const msgs = AppState.data.conversations[char.id];
        msgs.push({
            id: Date.now() + Math.random(),
            role: 'user',
            type: 'sticker',
            content: sticker.data,
            timestamp: Date.now(),
            pending: true
        });
        Utils.saveData();
        Conversation.render();
        Conversation.checkPending();
        this.close();
    },

    createPack() {
        const name = prompt(I18n.t('line.sticker_pack_name_prompt', 'スタンプパック名を入力：'));
        if (!name || !name.trim()) return;
        const icon = prompt(I18n.t('line.sticker_icon_prompt', 'アイコン（絵文字1つ）：'), '🐱') || '📦';
        const data = this._getData();
        const pack = { id: 'pack_' + Date.now(), name: name.trim(), icon: icon.slice(0, 2), createdAt: Date.now() };
        data.packs.push(pack);
        Utils.saveData();
        this._currentPackId = pack.id;
        this.renderTabs();
        Utils.showToast(I18n.t('t.line_pack_created', '✓ パック作成完了'));
    },

    openManage() {
        const data = this._getData();
        // 弹窗管理
        let html = `<h3>${I18n.t('line.manage_stickers', 'スタンプ管理')}</h3>`;

        if (data.packs.length === 0) {
            html += `<p style="color:var(--text-secondary);font-size:13px;margin:12px 0;">${I18n.t('line.no_packs_yet', 'まだパックがありません。「＋ 追加」タブから作成できます')}</p>`;
        } else {
            html += data.packs.map(p => {
                const count = data.stickers.filter(s => s.packId === p.id).length;
                return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border-light);">
                    <span style="font-size:24px;">${p.icon}</span>
                    <span style="flex:1;font-size:14px;">${ChatList._esc(p.name)} (${count})</span>
                    <button class="glass-btn mini" onclick="StickerManager.addStickersTo('${p.id}')">${I18n.t('line.add', '追加')}</button>
                    <button class="glass-btn mini danger" onclick="StickerManager.deletePack('${p.id}')">${I18n.t('btn.delete', '削除')}</button>
                </div>`;
            }).join('');
        }

        html += `<div style="margin-top:16px;">
            <button class="glass-btn primary" onclick="document.getElementById('stickerManageModal').classList.remove('active')">${I18n.t('btn.close', '閉じる')}</button>
        </div>`;

        // 使用通用模态框
        let modal = document.getElementById('stickerManageModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'stickerManageModal';
            modal.className = 'modal-overlay';
            modal.innerHTML = '<div class="modal-window"></div>';
            modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
            document.body.appendChild(modal);
        }
        modal.querySelector('.modal-window').innerHTML = html;
        modal.classList.add('active');
    },

    async addStickersTo(packId) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.onchange = async () => {
            const data = this._getData();
            for (const file of input.files) {
                if (!file.type.startsWith('image/')) continue;
                const base64 = await new Promise(resolve => {
                    const r = new FileReader();
                    r.onload = e => resolve(e.target.result);
                    r.readAsDataURL(file);
                });
                data.stickers.push({
                    id: 'stk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                    packId,
                    type: 'image',
                    data: base64,
                    usedAt: 0
                });
            }
            Utils.saveData();
            Utils.showToast(I18n.t('t.line_stickers_added', {n: input.files.length}));
            this.openManage(); // refresh modal
            this.renderGrid();
        };
        input.click();
    },

    deletePack(packId) {
        if (!confirm(I18n.t('line.confirm_delete_pack', 'このパックと全てのスタンプを削除しますか？'))) return;
        const data = this._getData();
        data.packs = data.packs.filter(p => p.id !== packId);
        data.stickers = data.stickers.filter(s => s.packId !== packId);
        data.recentIds = data.recentIds.filter(id => {
            const s = data.stickers.find(st => st.id === id);
            return s || id.startsWith('e_');
        });
        Utils.saveData();
        if (this._currentPackId === packId) this._currentPackId = '__recent';
        this.renderTabs();
        this.openManage();
        Utils.showToast(I18n.t('t.line_pack_deleted', '✓ パック削除完了'));
    }
};

// チャット設定
const ChatSettingsUI = {
    get _bgColors() {
        return [
            { color: '#8cabd9', label: I18n.t('line.bg_blue', 'ブルー') },
            { color: '#7bb89a', label: I18n.t('line.bg_green', 'グリーン') },
            { color: '#b8a0d0', label: I18n.t('line.bg_purple', 'パープル') },
            { color: '#d4a76a', label: I18n.t('line.bg_gold', 'ゴールド') },
            { color: '#e8a0bf', label: I18n.t('line.bg_pink', 'ピンク') },
            { color: '#889eaf', label: I18n.t('line.bg_gray', 'グレー') },
            { color: '#f0f0f0', label: I18n.t('line.bg_light', 'ライト') },
            { color: '#2c2c2e', label: I18n.t('line.bg_dark', 'ダーク') },
        ];
    },

    init() {
        const s = AppState.data.chatSettings || {};

        // LINE グリーン toggle
        const lineGreenCb = document.getElementById('chatUseLineGreen');
        if (lineGreenCb) {
            lineGreenCb.checked = s.useLineGreen !== false;
            lineGreenCb.onchange = () => {
                AppState.data.chatSettings.useLineGreen = lineGreenCb.checked;
                Utils.saveData();
            };
        }

        // 既読 toggle
        const readCb = document.getElementById('chatShowRead');
        if (readCb) {
            readCb.checked = s.showRead !== false;
            readCb.onchange = () => {
                AppState.data.chatSettings.showRead = readCb.checked;
                Utils.saveData();
            };
        }

        // タイピング toggle
        const typCb = document.getElementById('chatShowTyping');
        if (typCb) {
            typCb.checked = s.showTyping !== false;
            typCb.onchange = () => {
                AppState.data.chatSettings.showTyping = typCb.checked;
                Utils.saveData();
            };
        }

        // 背景色ドット
        const picker = document.getElementById('chatBgColorPicker');
        if (picker) {
            picker.innerHTML = this._bgColors.map(c => {
                const sel = (s.bgColor || '#8cabd9') === c.color ? ' selected' : '';
                return `<div class="chat-bg-dot${sel}" style="background:${c.color};" title="${c.label}" onclick="ChatSettingsUI.selectBgColor('${c.color}')"></div>`;
            }).join('');
        }

        // カスタム背景 URL
        const urlInput = document.getElementById('chatBgImageUrl');
        if (urlInput) {
            urlInput.value = s.bgImageUrl || '';
            urlInput.onchange = () => {
                AppState.data.chatSettings.bgImageUrl = urlInput.value.trim();
                Utils.saveData();
            };
        }
    },

    selectBgColor(color) {
        AppState.data.chatSettings.bgColor = color;
        AppState.data.chatSettings.bgImageUrl = ''; // 清除自定义图
        const urlInput = document.getElementById('chatBgImageUrl');
        if (urlInput) urlInput.value = '';
        Utils.saveData();
        // 更新选中状态
        document.querySelectorAll('.chat-bg-dot').forEach(d => {
            d.classList.toggle('selected', d.style.backgroundColor === this._hexToRgb(color));
        });
        // 刷新 picker
        this.init();
    },

    _hexToRgb(hex) {
        // 不精确匹配，重新渲染更可靠
        return hex;
    }
};

// Image Handler
const ChatHelpers = {
    handleImageUpload(file) {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            Conversation.sendImage(e.target.result);
        };
        reader.readAsDataURL(file);
    }
};

// ===== グループチャット =====
const GroupChat = {
    showCreateModal() {
        const chars = AppState.data.characters || [];
        if (chars.length < 2) { Utils.showToast(I18n.t('t.line_group_need_two_chars', 'グループにはキャラクターが2人以上必要です')); return; }

        let modal = document.getElementById('groupCreateModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'groupCreateModal';
            modal.className = 'modal-overlay';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `<div class="modal-window" style="max-height:80vh;overflow-y:auto;">
            <h3 style="margin-bottom:12px;">${I18n.t('line.create_group', 'グループ作成')}</h3>
            <input id="groupNameInput" class="glass-input" placeholder="${I18n.t('line.group_name_placeholder', 'グループ名')}" style="width:100%;padding:10px;margin-bottom:12px;border-radius:8px;border:1px solid var(--border-medium);background:var(--bg-secondary);font-size:14px;">
            <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">${I18n.t('line.select_members', 'メンバーを選択（2〜5人）')}</div>
            <div id="groupMemberList" style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px;">
                ${chars.map(c => `<label class="group-member-item" style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;cursor:pointer;border:1px solid var(--border-light);">
                    <input type="checkbox" class="group-member-check" value="${c.id}" style="width:18px;height:18px;">
                    <img src="${c.avatar || DEFAULT_AVATAR}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">
                    <span style="font-size:14px;">${c.name}</span>
                </label>`).join('')}
            </div>
            <div style="display:flex;gap:8px;">
                <button class="glass-btn" onclick="document.getElementById('groupCreateModal').classList.remove('active')" style="flex:1;">${I18n.t('btn.cancel', 'キャンセル')}</button>
                <button class="glass-btn" onclick="GroupChat.create()" style="flex:1;background:var(--accent-color);color:#fff;">${I18n.t('line.create', '作成')}</button>
            </div>
        </div>`;

        modal.classList.add('active');
    },

    create() {
        const name = (document.getElementById('groupNameInput')?.value || '').trim() || I18n.t('line.group_default_name', 'グループ');
        const checked = document.querySelectorAll('.group-member-check:checked');
        const memberIds = Array.from(checked).map(cb => cb.value);

        if (memberIds.length < 2) { Utils.showToast(I18n.t('t.line_group_select_min', '2人以上選んでください')); return; }
        if (memberIds.length > 5) { Utils.showToast(I18n.t('t.line_group_select_max', '5人まで選べます')); return; }

        if (!AppState.data.groups) AppState.data.groups = [];
        const group = {
            id: Utils.generateId(),
            name,
            memberIds,
            createdAt: Date.now()
        };
        AppState.data.groups.push(group);
        AppState.data.conversations['grp_' + group.id] = [];
        Utils.saveData();

        document.getElementById('groupCreateModal')?.classList.remove('active');
        Utils.showToast(I18n.t('t.line_group_created', {name: name}));
        Line.openConversation('grp_' + group.id);
    }
};
