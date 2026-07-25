// Perigee OS 数据导出/导入
// 全局备份 + 板块选择性备份；导入按板块勾选回填，缺失字段保留当前值
// 备份格式：扁平 AppState 字段（与旧版兼容，无 envelope）

const DataExport = {
    MODULES: [
        { key: 'line', label: 'LINE 聊天', i18nKey: 'data_export.line', fields: ['characters', 'groups', 'conversations', 'chatMeta', 'chatSettings', 'chatUserProfile', 'userStickers', 'stickerData', 'dialogueRefs', 'voom'] },
        { key: 'broadcast', label: '放送局（世界设定 / 剧情 / 情报 / 角色）', i18nKey: 'data_export.broadcast', fields: ['broadcast'] },
        { key: 'forum', label: '论坛', i18nKey: 'data_export.forum', fields: ['forumData'] },
        { key: 'twitter', label: '推特', i18nKey: 'data_export.twitter', fields: ['twitterData'] },
        { key: 'weibo', label: '微博', i18nKey: 'data_export.weibo', fields: ['weiboData'] },
        { key: 'lofter', label: 'Lofter', i18nKey: 'data_export.lofter', fields: ['lofterData'] },
        { key: 'pixiv', label: 'Pixiv', i18nKey: 'data_export.pixiv', fields: ['pixivData'] },
        { key: 'magazine', label: '杂志', i18nKey: 'data_export.magazine', fields: ['magazineData'] },
        { key: 'melonbooks', label: 'メロンブックス', i18nKey: 'data_export.melonbooks', fields: ['melonbooksData'] },
        { key: 'niconico', label: 'ニコニコ動画', i18nKey: 'data_export.niconico', fields: ['niconicoData'] },
        { key: 'writer', label: '写作 & 邮件', i18nKey: 'data_export.writer_mail', fields: ['writerData', 'mails'] },
        { key: 'music', label: '楽曲', i18nKey: 'data_export.music', fields: ['music'] },
        { key: 'fortune', label: '占卜 & 塔罗', i18nKey: 'data_export.fortune_tarot', fields: ['fortuneData', 'tarotData'] },
        { key: 'travel', label: '旅行账本', i18nKey: 'data_export.travel', fields: ['travelData'] },
        { key: 'learn', label: '学习工具', i18nKey: 'data_export.learn', fields: ['dictionary', 'tutorMessages', 'knowledgeBase'] },
        { key: 'calendar', label: '日历', i18nKey: 'data_export.calendar', fields: ['calendarEvents'] },
        { key: 'desktop', label: '桌面美化', i18nKey: 'data_export.desktop', fields: ['widgets', 'decorations', 'desktopLayout', 'customIcons'] },
        { key: 'persona', label: '个人身份资料', i18nKey: 'data_export.persona', fields: ['userProfile', 'myPersonaPresets', 'activePersonaId'] },
        { key: 'wallet', label: '支付 & 钱包', i18nKey: 'data_export.wallet', fields: ['wallet', 'payments'] },
        { key: 'worldbook', label: '世界书', i18nKey: 'data_export.worldbook', fields: ['worldBooks'] },
        { key: 'system', label: 'API 与系统设置', i18nKey: 'data_export.system', fields: ['apiConfig', 'imageApiConfig', 'novelaiSettings', 'ttsConfig', 'systemConfig', 'apiPresets', 'imageGenModules'] }
    ],

    // 跨模块共享依赖：key 模块的数据引用了 needs 模块的实体（lofter 文手存微博 NPC 池 / 月读书引用世界书 /
    // persona 的官方 NPC 虚拟身份[activePersonaId='officialnpc:<npcId>']与 line 的官方 NPC 实体化好友
    // [characters[].sourceType='official-npc' + sourceNpcId] 都指向 broadcast.officialNpcs），
    // 单独导出 key 不带 needs，换设备导入后会断链。勾了 key 没勾 needs 时弹提示建议一并勾选。
    // 注：本表是数组不是以 key 为键的映射，同一 key 允许出现多条（对应多个不同 needs）——目前不需要，先备注机制形状。
    DEPENDENCIES: [
        { key: 'lofter', needs: 'weibo', i18nKey: 'data_export.dep_hint_lofter' },
        { key: 'persona', needs: 'broadcast', i18nKey: 'data_export.dep_hint_persona_broadcast' },
        { key: 'line', needs: 'broadcast', i18nKey: 'data_export.dep_hint_line_broadcast' }
    ],

    _selected: new Set(),
    _mode: null,           // 'export' | 'import'
    _pendingImport: null,  // 待导入的解析后 JSON

    // ===== 全部导出 =====
    exportAll() {
        const dataStr = JSON.stringify(AppState.data, null, 2);
        this._download(dataStr, 'perigee-os-full');
        Utils.showToast(I18n.t('t.dx_all_exported', '✓ 全部数据已导出'));
    },

    // ===== 选择性导出 =====
    openSelectiveExport() {
        this._mode = 'export';
        this._pendingImport = null;
        this._selected = new Set(this.MODULES.map(m => m.key));
        this._renderModal({ title: I18n.t('data_export.modal_title_export', '选择要导出的板块'), confirmLabel: I18n.t('data_export.confirm_export', '导出') });
    },

    // ===== 导入 =====
    handleImportFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            let data;
            try {
                data = JSON.parse(e.target.result);
            } catch (err) {
                Utils.showToast(I18n.t('t.dx_invalid_json', '文件格式错误：不是合法 JSON'), 4000);
                return;
            }
            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                Utils.showToast(I18n.t('t.dx_root_not_object', '文件格式错误：根节点应是对象'), 4000);
                return;
            }
            const presentModuleKeys = this._modulesPresentIn(data);
            if (presentModuleKeys.size === 0) {
                Utils.showToast(I18n.t('t.dx_no_module_data', '文件不含可识别的板块数据'), 4000);
                return;
            }
            this._mode = 'import';
            this._pendingImport = data;
            this._selected = new Set(presentModuleKeys);
            this._renderModal({ title: I18n.t('data_export.modal_title_import', '选择要导入的板块'), confirmLabel: I18n.t('data_export.confirm_import', '导入') });
        };
        reader.readAsText(file);
    },

    // ===== Modal 操作 =====
    confirmModal() {
        if (this._mode === 'export') this._performSelectiveExport();
        else if (this._mode === 'import') this._performImport();
    },

    closeModal() {
        const m = document.getElementById('dataModuleModal');
        if (m) m.classList.remove('active');
        const hint = document.getElementById('dataModuleDepHint');
        if (hint) { hint.style.display = 'none'; hint.innerHTML = ''; }
        this._mode = null;
        this._pendingImport = null;
    },

    toggleAll(checked) {
        const presentInImport = this._mode === 'import' ? this._modulesPresentIn(this._pendingImport) : null;
        document.querySelectorAll('#dataModuleList input[type="checkbox"]').forEach(cb => {
            const key = cb.dataset.modKey;
            if (presentInImport && !presentInImport.has(key)) return;
            cb.checked = checked;
            if (checked) this._selected.add(key);
            else this._selected.delete(key);
        });
        this._updateDepHint();
    },

    _onCheckChange(event) {
        const key = event.target.dataset.modKey;
        if (event.target.checked) this._selected.add(key);
        else this._selected.delete(key);
        this._updateDepHint();
    },

    // 勾了某模块却漏勾它依赖的共享模块时，弹一条建议（导入时仅当文件里确实含被依赖模块才提示）
    _updateDepHint() {
        const box = document.getElementById('dataModuleDepHint');
        if (!box) return;
        const selectable = this._mode === 'import' ? this._modulesPresentIn(this._pendingImport) : null;
        const msgs = [];
        for (const d of this.DEPENDENCIES) {
            if (this._selected.has(d.key) && !this._selected.has(d.needs) &&
                (!selectable || selectable.has(d.needs))) {
                msgs.push(I18n.t(d.i18nKey));
            }
        }
        if (msgs.length) {
            box.innerHTML = msgs.map(m => `<div>${m}</div>`).join('');
            box.style.display = 'block';
        } else {
            box.style.display = 'none';
            box.innerHTML = '';
        }
    },

    // ===== 内部 =====
    _label(m) {
        return m.i18nKey ? I18n.t(m.i18nKey, m.label) : m.label;
    },

    _modulesPresentIn(data) {
        const set = new Set();
        for (const m of this.MODULES) {
            if (m.fields.some(f => Object.prototype.hasOwnProperty.call(data, f))) {
                set.add(m.key);
            }
        }
        return set;
    },

    _renderModal({ title, confirmLabel }) {
        const modal = document.getElementById('dataModuleModal');
        if (!modal) return;
        document.getElementById('dataModuleModalTitle').textContent = title;
        document.getElementById('dataModuleConfirmBtn').textContent = confirmLabel;
        const list = document.getElementById('dataModuleList');
        const presentInImport = this._mode === 'import' ? this._modulesPresentIn(this._pendingImport) : null;

        list.innerHTML = this.MODULES.map(m => {
            const inFile = !presentInImport || presentInImport.has(m.key);
            const checked = inFile && this._selected.has(m.key) ? 'checked' : '';
            const disabled = !inFile ? 'disabled' : '';
            const opacity = !inFile ? 'opacity:0.4;' : '';
            const hint = !inFile ? ' <span style="color:var(--text-tertiary);font-size:11px;">（文件中不含）</span>' : '';
            return `<label style="display:flex;align-items:center;gap:10px;padding:8px 4px;cursor:pointer;${opacity}">
                <input type="checkbox" data-mod-key="${m.key}" ${checked} ${disabled} onchange="DataExport._onCheckChange(event)">
                <span style="flex:1;font-size:14px;">${this._label(m)}${hint}</span>
            </label>`;
        }).join('');
        modal.classList.add('active');
        this._updateDepHint();
    },

    _performSelectiveExport() {
        const out = {};
        const labels = [];
        for (const m of this.MODULES) {
            if (!this._selected.has(m.key)) continue;
            let any = false;
            for (const f of m.fields) {
                if (Object.prototype.hasOwnProperty.call(AppState.data, f)) {
                    out[f] = AppState.data[f];
                    any = true;
                }
            }
            if (any) labels.push(this._label(m));
        }
        if (Object.keys(out).length === 0) {
            Utils.showToast(I18n.t('t.dx_no_module_selected', '未选择任何板块'), 3000);
            return;
        }
        const dataStr = JSON.stringify(out, null, 2);
        this._download(dataStr, 'perigee-os-partial');
        Utils.showToast(I18n.t('t.dx_modules_exported', {n: labels.length}));
        this.closeModal();
    },

    _performImport() {
        const data = this._pendingImport;
        if (!data) { this.closeModal(); return; }

        const labels = [];
        const planFields = [];
        for (const m of this.MODULES) {
            if (!this._selected.has(m.key)) continue;
            const matched = m.fields.filter(f => Object.prototype.hasOwnProperty.call(data, f));
            if (matched.length === 0) continue;
            labels.push(this._label(m));
            planFields.push(...matched);
        }
        if (labels.length === 0) {
            Utils.showToast(I18n.t('t.dx_no_module_selected', '未选择任何板块'), 3000);
            return;
        }
        if (!confirm(`将导入 ${labels.length} 个板块的数据：\n${labels.join('、')}\n\n当前对应内容会被覆盖（其它板块保持不变）。继续？`)) return;

        for (const f of planFields) AppState.data[f] = data[f];
        AppState.data._v = 0;   // 分板块导入可能往新 _v 的树里塞旧结构板块数据：重置 _v，reload 后全量重跑迁移（各条自带幂等守卫，重跑无害）
        // v2.198.0 复检修复：导入可能改写 systemConfig.language，语言镜像跟上再 reload，
        // 否则重启先按旧镜像预载错语言、boot 后才自愈闪一下（i18n 懒加载 v2.196 起）。
        try {
            const _lang = AppState.data.systemConfig && AppState.data.systemConfig.language;
            if (_lang === 'zh' || _lang === 'ja' || _lang === 'en') localStorage.setItem('perigee_lang_mirror', _lang);
        } catch (e) { /* 存储不可用则镜像自愈兜底 */ }
        Utils.showToast(I18n.t('t.dx_import_success', '✓ 导入成功，即将刷新'));
        this.closeModal();
        // 落盘完成后再刷新，防 reload 掉防抖窗口内的导入数据
        Utils.flushSave().then(() => setTimeout(() => location.reload(), 1000));
    },

    _download(content, prefix) {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `${prefix}-${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // ===== v2.70.0 重置同人作者池 =====
    resetDoujinWritersPool() {
        const fanFriends = (AppState.data.twitterData && AppState.data.twitterData.fanFriends) || [];
        const writers = fanFriends.filter(f => f.type === 'doujin_writer');
        const count = writers.length;

        if (count === 0) {
            Utils.showToast(I18n.t('t.settings_writers_pool_empty', '当前没有虚构作者、跳过'));
            return;
        }

        // 二次确认
        const confirmMsgTemplate = I18n.t('settings.confirm_reset_writers_pool', { n: count });
        const confirmMsg = (typeof confirmMsgTemplate === 'string' && confirmMsgTemplate.includes('{n}'))
            ? confirmMsgTemplate.replace('{n}', count)
            : confirmMsgTemplate;
        if (!confirm(confirmMsg)) return;

        // 删除 doujin_writer 类型 fanFriend
        AppState.data.twitterData.fanFriends = fanFriends.filter(f => f.type !== 'doujin_writer');

        // 关联 novel 的 author_npc_id 清零（保留作品内容 + 字符串 author）
        const writerIds = new Set(writers.map(w => w.id));
        const novels = AppState.data.pixivData?.novels || [];
        novels.forEach(n => {
            if (n.author_npc_id && writerIds.has(n.author_npc_id)) {
                n.author_npc_id = null;
            }
        });

        Utils.saveData();
        const successTemplate = I18n.t('t.settings_writers_pool_reset', { n: count });
        const successMsg = (typeof successTemplate === 'string' && successTemplate.includes('{n}'))
            ? successTemplate.replace('{n}', count)
            : successTemplate;
        Utils.showToast(successMsg);
    },

    // ===== v2.71.0 重置中文同人圈 NPC 池（微博 / lofter 共享）=====
    resetWeiboNpcPool() {
        const wd = AppState.data.weiboData;
        if (!wd) return;
        const fans = wd.fanFriends || [];
        const count = fans.length;
        if (count === 0) {
            Utils.showToast(I18n.t('t.settings_weibo_pool_empty', '中文圈 NPC 池为空、跳过'));
            return;
        }
        const confirmMsg = (I18n.t('settings.confirm_reset_weibo_pool', '确定要清空中文同人圈 NPC 池吗？这会移除所有 NPC 及他们发的微博、但保留你自己的微博和账号。当前有 {n} 个 NPC') || '').replace('{n}', count);
        if (!confirm(confirmMsg)) return;

        wd.fanFriends = [];
        wd.posts = (wd.posts || []).filter(p => p.npcId === null);
        wd.notifications = { mentions: [], comments: [], likes: [], dms: [], strangerDmIds: [] };
        wd.topics = [];
        wd.followedTopicIds = [];
        wd.hotsearch = [];
        wd._seededInitial = false;
        wd._lastTopicSeedPlotId = null;
        Utils.saveData();
        Utils.showToast((I18n.t('t.settings_weibo_pool_reset', '已重置、清空 {n} 个 NPC') || '').replace('{n}', count));
    }
};
