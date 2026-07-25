// 放送局：跨模块共享的世界元数据中心
// 5 tabs：世界 / 剧情 / 情报 / 角色 / 总结
// 数据底层：AppState.data.broadcast（worldSetting / worldBookIds / plotProgress / plotDrafts / officialInfo / officialNpcs / mergedSummaries 等）
// CRUD 与渲染复用 forum.js 现有函数（Forum.renderPlotList / Forum.showPlotModal 等）

const Broadcast = {
    currentTab: 'world',

    init() {
        if (typeof Forum !== 'undefined' && Forum.applyFontSize) Forum.applyFontSize();
        this.switchTab(this.currentTab || 'world');
    },

    // v2.69.0: 统一 CP 数据访问入口，所有 CP 读取点走这里
    getCP() {
        const s = (AppState.data.broadcast && AppState.data.broadcast.cpSettings) || {};
        const cpCharA = s.cpCharA || '';
        const cpCharB = s.cpCharB || '';
        const cpNickname = s.cpNickname || '';
        return {
            cpCharA,
            cpCharB,
            cpNickname,
            cp: (cpCharA && cpCharB) ? `${cpCharA}×${cpCharB}` : '',
            hasCP: !!(cpCharA && cpCharB)
        };
    },

    // v2.139.0: 取 CP 主角 A/B 的参考立绘 Blob[]（仅 gpt-image edits / OpenRouter 生图用）。
    // 刻意独立于 getCP()——getCP() 给 pixiv 小说/lofter/mercari 等文本模块读名字，签名一字不改；生图取图走这里。
    // v2.146.0: 可选 charNames 过滤。不传（pixiv/twitter/melon 旧调用）→ 返回全部 CP 立绘，行为一字不变；
    //          传数组（周边商品生图）→ 只取「出现在关联角色名单里」的 CP 主角立绘，避免单人周边被塞进另一位。
    //          匹配用 trim 后精确相等，不做子串模糊匹配（防 ユウ↔ユウキ 这类误匹配）。
    async getCPRefImages(charNames) {
        const s = (AppState.data.broadcast && AppState.data.broadcast.cpSettings) || {};
        let ids;
        if (Array.isArray(charNames)) {
            const wanted = charNames.map(n => String(n || '').trim()).filter(Boolean);
            const match = cpName => { const c = String(cpName || '').trim(); return !!c && wanted.includes(c); };
            ids = [
                match(s.cpCharA) ? s.cpCharARefId : null,
                match(s.cpCharB) ? s.cpCharBRefId : null
            ].filter(Boolean);
        } else {
            ids = [s.cpCharARefId, s.cpCharBRefId].filter(Boolean);
        }
        if (ids.length === 0 || typeof IllustGallery === 'undefined') return [];
        const blobs = await Promise.all(ids.map(id => IllustGallery.getBlob(id).catch(() => null)));
        return blobs.filter(Boolean);
    },

    // v2.173.0: 预存外貌 tag 访问器（NovelAI 系生图读取）。只返回「角色名与 tag 都非空」的条目；
    // 生图模块经 PixivIllust.getStoredCharTags() 间接调用，未配置时返回 [] → 各模块走世界书检索老路
    getCPAppearanceTags() {
        const s = (AppState.data.broadcast && AppState.data.broadcast.cpSettings) || {};
        return [
            { name: (s.cpCharA || '').trim(), tags: (s.cpCharATags || '').trim() },
            { name: (s.cpCharB || '').trim(), tags: (s.cpCharBTags || '').trim() }
        ].filter(c => c.name && c.tags);
    },

    // ===== 动态角色立绘注册表（2026-07-06 计划：PV 参考图两来源）=====
    // charRefs = [{id, name, tags}]；blob 存 IllustGallery，id 恒等推导 'charref_'+entry.id（同 id 覆盖上传）。
    // CP A/B 固定槽刻意不并入（getCP()/生图消费方零改动），读取端用 getAllCharRefs() 做 union。
    // tags 字段本期只存不消费（生图接 union 为后置阶段），与 cpCharATags 同语义（NovelAI danbooru tag）。
    _ensureCharRefs() {
        if (!AppState.data.broadcast) AppState.data.broadcast = {};
        if (!Array.isArray(AppState.data.broadcast.charRefs)) AppState.data.broadcast.charRefs = [];
        return AppState.data.broadcast.charRefs;
    },
    charRefBlobId(entryId) { return 'charref_' + entryId; },
    // union 候选列表（同步纯数据，不查 blob 存在性——消费方 getUrl 为 null 时自行过滤，
    // 这样跨设备导入 blob 丢失时也能正确隐藏）。CP 在前保持「主角优先」直觉。
    getAllCharRefs() {
        const s = (AppState.data.broadcast && AppState.data.broadcast.cpSettings) || {};
        const out = [];
        if (s.cpCharARefId) out.push({ name: (s.cpCharA || '').trim(), blobId: s.cpCharARefId, source: 'cp' });
        if (s.cpCharBRefId) out.push({ name: (s.cpCharB || '').trim(), blobId: s.cpCharBRefId, source: 'cp' });
        for (const e of ((AppState.data.broadcast || {}).charRefs || [])) {
            out.push({ name: (e.name || '').trim(), blobId: this.charRefBlobId(e.id), source: 'extra' });
        }
        return out;
    },

    _charRefCardUrls: {},   // entryId → ObjectURL（重渲染/删除前 revoke 防泄漏）

    _initCharRefCards() {
        const addBtn = document.getElementById('broadcastCharRefAdd');
        if (addBtn) addBtn.onclick = () => {
            const list = this._ensureCharRefs();
            list.push({ id: Utils.generateId(), name: '', tags: '' });
            Utils.saveData();
            this._renderCharRefCards();
        };
        this._renderCharRefCards();
    },

    _renderCharRefCards() {
        const wrap = document.getElementById('broadcastCharRefsList');
        if (!wrap) return;
        // 全量重渲染前 revoke 全部旧 URL
        Object.values(this._charRefCardUrls).forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} });
        this._charRefCardUrls = {};
        const list = this._ensureCharRefs();
        const esc = s => Utils.escapeHtml(s || '');
        // 动态 innerHTML 的文案照项目惯例内联 I18n.t（语言切换 → applyTranslations 中央化重渲染时取当前语言）；
        // data-i18n 属性保留，供全局 applyTranslations 扫静态存量 DOM 时同步。
        wrap.innerHTML = list.map(e => `
            <div class="bc-charref-card" data-entry-id="${esc(e.id)}" style="border:1px solid var(--border-medium);border-radius:8px;padding:10px;margin-bottom:10px;">
                <div style="display:flex;gap:10px;">
                    <div style="position:relative;width:84px;height:112px;flex:none;border:1px solid var(--border-medium);border-radius:6px;overflow:hidden;background:var(--bg-secondary);">
                        <img class="bc-charref-preview" alt="" style="display:none;width:100%;height:100%;object-fit:cover;">
                        <div class="bc-charref-placeholder" style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;gap:4px;color:var(--text-tertiary);font-size:11px;cursor:pointer;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                            <span data-i18n="broadcast.char_refs_upload">${esc(I18n.t('broadcast.char_refs_upload', '上传立绘'))}</span>
                        </div>
                        <button type="button" class="bc-charref-remove-img" title="删除立绘" style="display:none;position:absolute;top:4px;right:4px;width:20px;height:20px;border:none;border-radius:50%;background:rgba(0,0,0,0.55);color:#fff;align-items:center;justify-content:center;cursor:pointer;padding:0;line-height:1;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" style="width:10px;height:10px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                        <input type="file" accept="image/*" class="bc-charref-file" style="display:none;">
                    </div>
                    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;">
                        <input type="text" class="bc-charref-name" value="${esc(e.name)}" placeholder="${esc(I18n.t('broadcast.char_refs_name_ph', '角色名'))}" data-i18n-placeholder="broadcast.char_refs_name_ph" style="width:100%;padding:7px 8px;border:1px solid var(--border-medium);border-radius:6px;background:var(--bg-secondary);color:var(--text-primary);font-size:12px;box-sizing:border-box;outline:none;font-family:inherit;">
                        <textarea class="bc-charref-tags" rows="2" placeholder="${esc(I18n.t('broadcast.cp_tags_placeholder', '外貌 tag，如：1boy, black hair, red eyes…'))}" data-i18n-placeholder="broadcast.cp_tags_placeholder" style="width:100%;padding:7px 8px;border:1px solid var(--border-medium);border-radius:6px;background:var(--bg-secondary);color:var(--text-primary);font-size:12px;line-height:1.5;resize:vertical;box-sizing:border-box;font-family:inherit;outline:none;">${esc(e.tags)}</textarea>
                        <div style="display:flex;gap:6px;">
                            <button type="button" class="bc-charref-tags-gen" style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;font-size:12px;padding:6px 0;border:1px solid var(--border-medium);border-radius:6px;cursor:pointer;color:var(--text-secondary);background:transparent;">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z"/></svg>
                                <span data-i18n="broadcast.cp_tags_gen">${esc(I18n.t('broadcast.cp_tags_gen', 'AI 生成外貌 tag'))}</span>
                            </button>
                            <button type="button" class="bc-charref-delete" style="display:flex;align-items:center;justify-content:center;gap:4px;font-size:12px;padding:6px 10px;border:1px solid var(--border-medium);border-radius:6px;cursor:pointer;color:var(--text-tertiary);background:transparent;">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                <span data-i18n="broadcast.char_refs_delete">${esc(I18n.t('broadcast.char_refs_delete', '删除角色'))}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>`).join('');
        wrap.querySelectorAll('.bc-charref-card').forEach(card => this._bindCharRefCard(card));
    },

    _bindCharRefCard(card) {
        const entryId = card.dataset.entryId;
        const entry = this._ensureCharRefs().find(e => e.id === entryId);
        if (!entry) return;
        const blobId = this.charRefBlobId(entryId);
        const img = card.querySelector('.bc-charref-preview');
        const placeholder = card.querySelector('.bc-charref-placeholder');
        const removeImgBtn = card.querySelector('.bc-charref-remove-img');
        const fileInput = card.querySelector('.bc-charref-file');
        const nameInput = card.querySelector('.bc-charref-name');
        const tagsArea = card.querySelector('.bc-charref-tags');
        const genBtn = card.querySelector('.bc-charref-tags-gen');
        const delBtn = card.querySelector('.bc-charref-delete');

        const refresh = async () => {
            const blob = (typeof IllustGallery !== 'undefined')
                ? await IllustGallery.getBlob(blobId).catch(() => null) : null;
            if (this._charRefCardUrls[entryId]) { URL.revokeObjectURL(this._charRefCardUrls[entryId]); delete this._charRefCardUrls[entryId]; }
            const has = !!blob;
            if (has) {
                const url = URL.createObjectURL(blob);
                this._charRefCardUrls[entryId] = url;
                img.src = url;
            } else {
                img.removeAttribute('src');
            }
            img.style.display = has ? 'block' : 'none';
            placeholder.style.display = has ? 'none' : 'flex';
            removeImgBtn.style.display = has ? 'flex' : 'none';
        };

        placeholder.onclick = () => fileInput.click();
        img.onclick = () => fileInput.click();
        fileInput.onchange = async () => {
            const file = fileInput.files && fileInput.files[0];
            fileInput.value = '';
            if (!file) return;
            if (!file.type || file.type.indexOf('image/') !== 0) {
                Utils.showToast(I18n.t('bc.cp_ref_not_image', '请选择图片文件')); return;
            }
            if (file.size > 25 * 1024 * 1024) {
                Utils.showToast(I18n.t('bc.cp_ref_too_large', '图片过大（上限 25MB）')); return;
            }
            let blobToSave = file;
            if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
                try { blobToSave = await this._reencodeToPng(file); }
                catch (e) { Utils.showToast(I18n.t('bc.cp_ref_bad_format', '无法处理该图片格式，请换 PNG 或 JPG')); return; }
            }
            await IllustGallery.save(blobId, blobToSave);
            Utils.saveData();
            await refresh();
            Utils.showToast(I18n.t('bc.cp_ref_saved', '参考立绘已保存'));
        };
        removeImgBtn.onclick = async () => {
            try { await IllustGallery.remove(blobId); } catch (e) {}
            await refresh();
        };
        nameInput.oninput = () => { entry.name = nameInput.value.trim(); Utils.saveData(); };
        tagsArea.oninput = () => { entry.tags = tagsArea.value.trim(); Utils.saveData(); };
        genBtn.onclick = async () => {
            const blob = await IllustGallery.getBlob(blobId).catch(() => null);
            if (!blob) { Utils.showToast(I18n.t('bc.cp_tags_no_ref', '请先上传该角色的立绘')); return; }
            await this._generateTagsForBlob(blob, (entry.name || '').trim(), tagsArea, genBtn, (tags) => {
                entry.tags = tags; Utils.saveData();
            });
        };
        delBtn.onclick = async () => {
            if (!confirm(I18n.t('bc.char_refs_delete_confirm', '删除该角色及其立绘？'))) return;
            try { await IllustGallery.remove(blobId); } catch (e) {}
            const list = this._ensureCharRefs();
            const idx = list.findIndex(e => e.id === entryId);
            if (idx >= 0) list.splice(idx, 1);
            Utils.saveData();
            this._renderCharRefCards();
        };

        refresh();
    },

    switchTab(tabName) {
        // 离开世界 tab 时回收 CP 立绘 + 动态角色立绘卡预览的 ObjectURL，避免会话内常驻泄漏（单张最大 25MB）
        if (this.currentTab === 'world' && tabName !== 'world') {
            this._revokeCpRefUrls();
            this._revokeCharRefCardUrls();
        }
        this.currentTab = tabName;
        document.querySelectorAll('.broadcast-tab').forEach(b => {
            b.classList.toggle('active', b.dataset.tab === tabName);
        });
        document.querySelectorAll('.broadcast-tab-panel').forEach(p => {
            p.classList.toggle('active', p.dataset.tab === tabName);
        });
        switch (tabName) {
            case 'world':   this._initWorldTab(); break;
            case 'plot':    this._initPlotTab(); break;
            case 'info':    this._initInfoTab(); break;
            case 'npc':     this._initNpcTab(); break;
            case 'summary': this._initSummaryTab(); break;
        }
    },

    _initWorldTab() {
        const ws = document.getElementById('forumWorldSetting');
        if (ws) ws.value = AppState.data.broadcast.worldSetting || '';

        // v2.222: CP 区先于世界书列表、且无条件执行（顺序即防线，别再挪到守卫后面）
        this._initCpFields();

        const wbContainer = document.getElementById('forumWorldBooks');
        if (!wbContainer) return;
        const currentWbIds = Utils.getActiveWorldBookIds();
        const allBooks = AppState.data.worldBooks || [];
        // v2.222: 空集合只换文案、不再 early return（此前的 return 会把后面整个 CP 区跳过）
        wbContainer.innerHTML = allBooks.length ? allBooks.map(b => {
            const enabledCount = (b.entries || []).filter(e => e.enabled !== false).length;
            const totalCount = (b.entries || []).length;
            const countHint = totalCount > 0 ? ` <span style="font-size:11px;color:var(--text-secondary);">(${enabledCount}/${totalCount})</span>` : '';
            return `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;cursor:pointer;">
    <input type="checkbox" class="forum-wb-check" data-wbid="${Utils.escHtml(b.id)}"
        ${currentWbIds.includes(b.id) ? 'checked' : ''} style="width:auto;accent-color:var(--accent);">
    <span>${Utils.escHtml(b.name)}${countHint}</span>
</label>`;
        }).join('') : `<span style="font-size:13px;color:var(--text-secondary);">${I18n.t('bc.no_worldbooks')}</span>`;
    },

    // v2.222: CP 区回填 + 绑定（从 _initWorldTab 抽出，逻辑一字未改）。
    // ⚠️ 必须无条件执行、绝不能与世界书列表渲染共存亡——这就是 CP 丢失悬案的病根：
    // 此前 CP 整区排在 `if (!wbContainer) return;` 和「0 本世界书 → 提示后 return」之后，
    // 一本世界书都没有的用户打开世界 tab 时四个 CP 框全被跳过回填（显示为空，数据其实还在库里），
    // 而 saveWorldSettings 是从 DOM 现读的 → 一按保存就用空值覆盖真数据。
    // 对照组 worldSetting 从来没丢过，正因为它的回填排在所有 return 之前。
    _initCpFields() {
        // v2.69.0: CP 设置回填 + 监听 input change 保存
        const cp = AppState.data.broadcast.cpSettings || { cpCharA: '', cpCharB: '', cpNickname: '' };
        const cpA = document.getElementById('broadcastCpCharA');
        const cpB = document.getElementById('broadcastCpCharB');
        const cpN = document.getElementById('broadcastCpNickname');
        // v2.221: 每个 handler 先兜 cpSettings 存在（任何形态的旧数据都不该让 oninput 抛错静默失效）
        const ensureCp = () => AppState.data.broadcast.cpSettings || (AppState.data.broadcast.cpSettings = {});
        if (cpA) {
            cpA.value = cp.cpCharA || '';
            cpA.oninput = () => {
                ensureCp().cpCharA = cpA.value.trim();
                Utils.saveData();
            };
        }
        if (cpB) {
            cpB.value = cp.cpCharB || '';
            cpB.oninput = () => {
                ensureCp().cpCharB = cpB.value.trim();
                Utils.saveData();
            };
        }
        if (cpN) {
            cpN.value = cp.cpNickname || '';
            cpN.oninput = () => {
                ensureCp().cpNickname = cpN.value.trim();
                Utils.saveData();
            };
        }
        // v2.71.0: productionName 字段（微博作品超话用）
        const pn = document.getElementById('broadcastProductionName');
        if (pn) {
            pn.value = cp.productionName || '';
            pn.oninput = () => {
                ensureCp().productionName = pn.value.trim();
                Utils.saveData();
            };
        }
        // v2.139.0: CP 参考立绘上传槽（仅 gpt-image-2 生图读取）
        this._initCpRefImages();
        // v2.173.0: 外貌 tag 输入框 + AI 生成按钮
        this._initCpTagsFields();
        // 2026-07-06: 动态角色立绘注册表卡列表
        this._initCharRefCards();
    },

    // v2.139.0: 参考立绘预览的 ObjectURL（重渲染前 revoke 防泄漏）
    _cpRefUrls: { a: null, b: null },

    _initCpRefImages() {
        if (!AppState.data.broadcast.cpSettings) AppState.data.broadcast.cpSettings = {};
        this._setupCpRefSlot('a', 'cpCharARefId', 'cpref_charA');
        this._setupCpRefSlot('b', 'cpCharBRefId', 'cpref_charB');
    },

    // slot='a'|'b'；refIdKey=cpSettings 上的字段名；blobId=IllustGallery 固定 id（同 id 上传即覆盖，不留垃圾）
    _setupCpRefSlot(slot, refIdKey, blobId) {
        const cap = slot.toUpperCase();
        const fileInput = document.getElementById(`broadcastCpRef${cap}Input`);
        const previewImg = document.getElementById(`broadcastCpRef${cap}Preview`);
        const placeholder = document.getElementById(`broadcastCpRef${cap}Placeholder`);
        const removeBtn = document.getElementById(`broadcastCpRef${cap}Remove`);
        if (!fileInput) return;

        const refresh = async () => {
            const id = (AppState.data.broadcast.cpSettings || {})[refIdKey];
            let blob = null;
            if (id && typeof IllustGallery !== 'undefined') {
                blob = await IllustGallery.getBlob(id);
                if (!blob && AppState.data.broadcast.cpSettings) {
                    // 引用在但 Blob 没了（如跨设备导入）→ 自愈清脏 id，否则删除按钮被隐藏后界面无法清除该引用
                    AppState.data.broadcast.cpSettings[refIdKey] = null;
                    Utils.saveData();
                }
            }
            // revoke 旧→建新→赋值 放在 await 之后同步完成，避免并发 refresh(连点/切 tab) 提前 revoke 正在显示的 url 或泄漏孤儿
            if (this._cpRefUrls[slot]) { URL.revokeObjectURL(this._cpRefUrls[slot]); this._cpRefUrls[slot] = null; }
            const has = !!blob;
            if (has) {
                const url = URL.createObjectURL(blob);
                this._cpRefUrls[slot] = url;
                if (previewImg) previewImg.src = url;
            } else if (previewImg) {
                previewImg.removeAttribute('src');
            }
            if (previewImg) previewImg.style.display = has ? 'block' : 'none';
            if (placeholder) placeholder.style.display = has ? 'none' : 'flex';
            if (removeBtn) removeBtn.style.display = has ? 'flex' : 'none';
        };

        fileInput.onchange = async () => {
            const file = fileInput.files && fileInput.files[0];
            fileInput.value = '';  // 清空以允许重选同一文件
            if (!file) return;
            if (!file.type || file.type.indexOf('image/') !== 0) {
                Utils.showToast(I18n.t('bc.cp_ref_not_image', '请选择图片文件'));
                return;
            }
            if (file.size > 25 * 1024 * 1024) {
                Utils.showToast(I18n.t('bc.cp_ref_too_large', '图片过大（上限 25MB）'));
                return;
            }
            // gpt-image edits 端点只可靠接受 png/jpeg/webp。把非 png/jpeg（webp/heic/gif/bmp/avif 等，
            // 尤其 iPhone 常见 heic）统一 canvas 重编码为 png，保证字节与扩展名一致、edits 必接受。
            let blobToSave = file;
            if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
                try {
                    blobToSave = await this._reencodeToPng(file);
                } catch (e) {
                    Utils.showToast(I18n.t('bc.cp_ref_bad_format', '无法处理该图片格式，请换 PNG 或 JPG'));
                    return;
                }
            }
            if (!AppState.data.broadcast.cpSettings) AppState.data.broadcast.cpSettings = {};
            await IllustGallery.save(blobId, blobToSave);
            AppState.data.broadcast.cpSettings[refIdKey] = blobId;
            Utils.saveData();
            await refresh();
            Utils.showToast(I18n.t('bc.cp_ref_saved', '参考立绘已保存'));
        };

        if (removeBtn) {
            removeBtn.onclick = async () => {
                const id = (AppState.data.broadcast.cpSettings || {})[refIdKey];
                if (id && typeof IllustGallery !== 'undefined') { try { await IllustGallery.remove(id); } catch (e) {} }
                if (AppState.data.broadcast.cpSettings) AppState.data.broadcast.cpSettings[refIdKey] = null;
                Utils.saveData();
                await refresh();
            };
        }

        refresh();
    },

    // ===== v2.173.0: 外貌 tag（NovelAI 生图用）=====
    // 预存后生图时由代码层直接拼进 char_caption：外貌字节级固定（跨图一致）+ 不再每次发世界书原文（省 token）。
    // 上传立绘 + 多模态文字模型 → 「AI 生成」一键识别；也可全手动填写/微调。

    _initCpTagsFields() {
        this._setupCpTagsField('a', 'cpCharATags', 'cpCharARefId');
        this._setupCpTagsField('b', 'cpCharBTags', 'cpCharBRefId');
    },

    _setupCpTagsField(slot, tagsKey, refIdKey) {
        const cap = slot.toUpperCase();
        const area = document.getElementById(`broadcastCpTags${cap}`);
        const genBtn = document.getElementById(`broadcastCpTags${cap}Gen`);
        if (!area) return;
        const s = AppState.data.broadcast.cpSettings || {};
        area.value = s[tagsKey] || '';
        area.oninput = () => {
            if (!AppState.data.broadcast.cpSettings) AppState.data.broadcast.cpSettings = {};
            AppState.data.broadcast.cpSettings[tagsKey] = area.value.trim();
            Utils.saveData();
        };
        if (genBtn) genBtn.onclick = () => this._generateCpTags(slot, tagsKey, refIdKey, area, genBtn);
    },

    // tag 生成公共体（CP 槽与动态角色卡共用）：blob+名字 → 多模态识别 danbooru tag → area 回显 + saveFn 落库
    async _generateTagsForBlob(blob, charName, area, btn, saveFn) {
        const label = btn ? btn.querySelector('span') : null;
        const origText = label ? label.textContent : '';
        if (btn) btn.disabled = true;
        if (label) label.textContent = I18n.t('bc.cp_tags_generating', '识别中…');
        try {
            const img = await this._blobToInlineImage(blob);
            const systemPrompt = `You are a prompt engineer for anime image generation (NovelAI V4.5).
Look at the character in the provided image and output ONLY their appearance as English Danbooru-style tags.

Rules:
- Output a single comma-separated tag line and nothing else — no markers, no explanations, no line breaks
- The FIRST tag must be the gender tag (1girl or 1boy)
- If you recognize this character from a well-known anime/manga/game, include their name tag right after the gender tag: character_name (series_name)
- Then describe: hair (color, length, style), eyes (color), notable physical features, and the outfit shown in this image
- Appearance ONLY — no pose, no expression, no background, no composition, no quality tags
- Keep it under 40 words`;
            const userMsg = `${charName ? `Character name: ${charName}\n` : ''}Generate appearance tags for this character:`;
            const raw = await Utils.callChatAPI(
                [{ role: 'user', content: userMsg, image: img }],
                systemPrompt
            );
            const tags = (raw || '').trim().replace(/\n+/g, ', ');
            if (!tags) throw new Error('empty result');
            area.value = tags;
            saveFn(tags);
            Utils.showToast(I18n.t('bc.cp_tags_done', '外貌 tag 已生成，可手动微调'));
        } catch (e) {
            console.error('[Broadcast] tags generation failed:', e);
            Utils.showToast(I18n.t('bc.cp_tags_failed', '生成失败：请确认当前文字模型支持图片输入'));
        } finally {
            if (btn) btn.disabled = false;
            if (label) label.textContent = origText;
        }
    },

    async _generateCpTags(slot, tagsKey, refIdKey, area, btn) {
        const s = AppState.data.broadcast.cpSettings || {};
        const refId = s[refIdKey];
        const blob = (refId && typeof IllustGallery !== 'undefined')
            ? await IllustGallery.getBlob(refId).catch(() => null)
            : null;
        if (!blob) {
            Utils.showToast(I18n.t('bc.cp_tags_no_ref', '请先上传该角色的立绘'));
            return;
        }
        const charName = ((slot === 'a' ? s.cpCharA : s.cpCharB) || '').trim();
        await this._generateTagsForBlob(blob, charName, area, btn, (tags) => {
            if (!AppState.data.broadcast.cpSettings) AppState.data.broadcast.cpSettings = {};
            AppState.data.broadcast.cpSettings[tagsKey] = tags;
            Utils.saveData();
        });
    },

    // 立绘 Blob → 最长边缩到 1024 的 JPEG base64（原图直发容易超请求体积上限）
    async _blobToInlineImage(blob) {
        const bmp = await createImageBitmap(blob);
        try {
            const MAX = 1024;
            const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
            const w = Math.max(1, Math.round(bmp.width * scale));
            const h = Math.max(1, Math.round(bmp.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';  // JPEG 无 alpha，透明底铺白避免变黑
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(bmp, 0, 0, w, h);
            const jpeg = await new Promise((resolve, reject) => {
                canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', 0.9);
            });
            const dataUrl = await new Promise((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result);
                r.onerror = () => reject(new Error('read failed'));
                r.readAsDataURL(jpeg);
            });
            return { data: String(dataUrl).split(',')[1], mimeType: 'image/jpeg' };
        } finally {
            if (bmp.close) bmp.close();
        }
    },

    // 把任意可解码图片重编码为 PNG Blob（统一 edits 端点输入格式；iPhone heic 在 Safari 可解码转码）
    async _reencodeToPng(blob) {
        const bmp = await createImageBitmap(blob);
        try {
            const canvas = document.createElement('canvas');
            canvas.width = bmp.width;
            canvas.height = bmp.height;
            canvas.getContext('2d').drawImage(bmp, 0, 0);
            return await new Promise((resolve, reject) => {
                canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
            });
        } finally {
            if (bmp.close) bmp.close();
        }
    },

    // 回收 CP 立绘预览的 ObjectURL（离开世界 tab 时调用，避免会话内常驻泄漏）
    _revokeCpRefUrls() {
        ['a', 'b'].forEach(k => {
            if (this._cpRefUrls[k]) { URL.revokeObjectURL(this._cpRefUrls[k]); this._cpRefUrls[k] = null; }
        });
    },

    // 回收动态角色立绘卡预览的 ObjectURL（离开世界 tab 时调用；写法同 _renderCharRefCards 里的全量重渲染 revoke 循环）
    _revokeCharRefCardUrls() {
        Object.values(this._charRefCardUrls).forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} });
        this._charRefCardUrls = {};
    },

    _initPlotTab() {
        if (typeof Forum === 'undefined') return;
        if (Forum.renderPlotList) Forum.renderPlotList();
        if (Forum.renderPlotDraftList) Forum.renderPlotDraftList();
    },

    _initInfoTab() {
        if (typeof Forum !== 'undefined' && Forum.renderOfficialInfoList) Forum.renderOfficialInfoList();
    },

    _initNpcTab() {
        if (typeof Forum !== 'undefined' && Forum.renderNpcList) Forum.renderNpcList();
    },

    _initSummaryTab() {
        const stat = document.getElementById('broadcastSummaryStat');
        if (stat) {
            const merged = (AppState.data.broadcast.mergedSummaries || []).length;
            const plotSum = (AppState.data.broadcast.plotSummaries || []).length;
            const offSum = (AppState.data.broadcast.officialSummaries || []).length;
            const total = merged + plotSum + offSum;
            stat.textContent = total > 0
                ? I18n.t('bc.summary_stat', { total, merged, plot: plotSum, off: offSum })
                : I18n.t('bc.summary_empty');
        }
        // v2.136.0: 总结管理下放为一级——切到本 tab 直接渲染原弹窗内容（去掉「管理总结」二级入口）
        // v2.136.1: 不在此清空 _summaryPreviewData——它是「AI 生成后待确认的预览」，只应由用户
        //           确认保存(confirmSaveSummary) / 重新生成(reGenerateSummary) 来结束。若在此无条件
        //           清空，会在 doGenerateSummary 的 await（十几秒 LLM 等待）期间切走 tab 再切回时，
        //           把刚生成好、尚未确认的预览覆盖丢失（复审抓到的竞速；preview 为 null 是常态，渲染照常）。
        if (typeof Forum !== 'undefined' && Forum._renderSummaryModal) {
            Forum._renderSummaryModal();
        }
    },

    // v2.215：toast 改在真实落盘之后——此前 saveData() 只是排 300ms 防抖、toast 同步先弹，
    // 「已保存」说的是进了内存而非进了盘；OPPO 用户 CP 丢失悬案后改为 await flushSave()，
    // 写失败时 _saveNow 已弹「⚠️ 保存失败」，这里不再报喜（等于给写入失败装了现形探针）
    async saveWorldSettings() {
        const ws = document.getElementById('forumWorldSetting');
        if (ws) AppState.data.broadcast.worldSetting = ws.value.trim();
        AppState.data.broadcast.worldBookIds = [];
        document.querySelectorAll('.forum-wb-check:checked').forEach(cb => {
            AppState.data.broadcast.worldBookIds.push(cb.dataset.wbid);
        });
        AppState.data.broadcast.worldBookId = AppState.data.broadcast.worldBookIds[0] || '';
        // v2.221: CP 四字段改为保存时从输入框现场取值（与 worldSetting 同一条路）——
        // 此前 CP 只靠 oninput 时点写进内存，是全项目唯一「保存按钮不现读 DOM」的字段；
        // 任何设备上 input 事件失灵/中途抛错，就会出现「世界观保住了、CP 静默丢失、toast 照样报喜」，
        // 与悬案用户描述逐字吻合。现读之后 oninput 只是锦上添花，不再是唯一防线
        const s = AppState.data.broadcast.cpSettings || (AppState.data.broadcast.cpSettings = {});
        const cpFieldIds = {
            broadcastCpCharA: 'cpCharA', broadcastCpCharB: 'cpCharB',
            broadcastCpNickname: 'cpNickname', broadcastProductionName: 'productionName'
        };
        for (const [elId, key] of Object.entries(cpFieldIds)) {
            const el = document.getElementById(elId);
            if (el) s[key] = el.value.trim();
        }
        const ok = await Utils.flushSave();
        if (!ok) return;
        // v2.221 探针：写后回读 IndexedDB 校验 CP 三字段。写入报成功但回读不一致 = 存储层在说谎，
        // 当场弹警告让用户带证据回来（只在显式点保存时多读一次，成本可忽略）
        let verified = true;
        try {
            const disk = await localforage.getItem('PerigeeOS');
            const d = (disk && disk.broadcast && disk.broadcast.cpSettings) || {};
            verified = ['cpCharA', 'cpCharB', 'cpNickname'].every(k => (d[k] || '') === (s[k] || ''));
        } catch (e) { /* 回读失败只影响探针，不拦报喜 */ }
        if (verified) Utils.showToast(I18n.t('t.bc_saved', '✓ 已保存'));
        else Utils.showToast(I18n.t('t.bc_save_verify_failed', '⚠️ 保存校验异常：写入后回读与输入不一致，请截图反馈'), 8000);
    }
};
