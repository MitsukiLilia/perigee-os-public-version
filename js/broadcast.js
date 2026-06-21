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

    // v2.139.0: 取 CP 主角 A/B 的参考立绘 Blob[]（仅 gpt-image edits 生图用）。
    // 刻意独立于 getCP()——getCP() 给 pixiv 小说/lofter/mercari 等文本模块读名字，签名一字不改；生图取图走这里。
    async getCPRefImages() {
        const s = (AppState.data.broadcast && AppState.data.broadcast.cpSettings) || {};
        const ids = [s.cpCharARefId, s.cpCharBRefId].filter(Boolean);
        if (ids.length === 0 || typeof IllustGallery === 'undefined') return [];
        const blobs = await Promise.all(ids.map(id => IllustGallery.getBlob(id).catch(() => null)));
        return blobs.filter(Boolean);
    },

    switchTab(tabName) {
        // 离开世界 tab 时回收 CP 立绘预览的 ObjectURL，避免会话内常驻泄漏
        if (this.currentTab === 'world' && tabName !== 'world') this._revokeCpRefUrls();
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

        const wbContainer = document.getElementById('forumWorldBooks');
        if (!wbContainer) return;
        const currentWbIds = Utils.getActiveWorldBookIds();
        const allBooks = AppState.data.worldBooks || [];
        if (allBooks.length === 0) {
            wbContainer.innerHTML = `<span style="font-size:13px;color:var(--text-secondary);">${I18n.t('bc.no_worldbooks')}</span>`;
            return;
        }
        wbContainer.innerHTML = allBooks.map(b => {
            const enabledCount = (b.entries || []).filter(e => e.enabled !== false).length;
            const totalCount = (b.entries || []).length;
            const countHint = totalCount > 0 ? ` <span style="font-size:11px;color:var(--text-secondary);">(${enabledCount}/${totalCount})</span>` : '';
            return `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;cursor:pointer;">
    <input type="checkbox" class="forum-wb-check" data-wbid="${Utils.escHtml(b.id)}"
        ${currentWbIds.includes(b.id) ? 'checked' : ''} style="width:auto;accent-color:var(--accent);">
    <span>${Utils.escHtml(b.name)}${countHint}</span>
</label>`;
        }).join('');

        // v2.69.0: CP 设置回填 + 监听 input change 保存
        const cp = AppState.data.broadcast.cpSettings || { cpCharA: '', cpCharB: '', cpNickname: '' };
        const cpA = document.getElementById('broadcastCpCharA');
        const cpB = document.getElementById('broadcastCpCharB');
        const cpN = document.getElementById('broadcastCpNickname');
        if (cpA) {
            cpA.value = cp.cpCharA || '';
            cpA.oninput = () => {
                AppState.data.broadcast.cpSettings.cpCharA = cpA.value.trim();
                Utils.saveData();
            };
        }
        if (cpB) {
            cpB.value = cp.cpCharB || '';
            cpB.oninput = () => {
                AppState.data.broadcast.cpSettings.cpCharB = cpB.value.trim();
                Utils.saveData();
            };
        }
        if (cpN) {
            cpN.value = cp.cpNickname || '';
            cpN.oninput = () => {
                AppState.data.broadcast.cpSettings.cpNickname = cpN.value.trim();
                Utils.saveData();
            };
        }
        // v2.71.0: productionName 字段（微博作品超话用）
        const pn = document.getElementById('broadcastProductionName');
        if (pn) {
            pn.value = cp.productionName || '';
            pn.oninput = () => {
                AppState.data.broadcast.cpSettings.productionName = pn.value.trim();
                Utils.saveData();
            };
        }
        // v2.139.0: CP 参考立绘上传槽（仅 gpt-image-2 生图读取）
        this._initCpRefImages();
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
                if (id && typeof IllustGallery !== 'undefined') await IllustGallery.remove(id);
                if (AppState.data.broadcast.cpSettings) AppState.data.broadcast.cpSettings[refIdKey] = null;
                Utils.saveData();
                await refresh();
            };
        }

        refresh();
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

    saveWorldSettings() {
        const ws = document.getElementById('forumWorldSetting');
        if (ws) AppState.data.broadcast.worldSetting = ws.value.trim();
        AppState.data.broadcast.worldBookIds = [];
        document.querySelectorAll('.forum-wb-check:checked').forEach(cb => {
            AppState.data.broadcast.worldBookIds.push(cb.dataset.wbid);
        });
        AppState.data.broadcast.worldBookId = AppState.data.broadcast.worldBookIds[0] || '';
        Utils.saveData();
        Utils.showToast(I18n.t('t.bc_saved', '✓ 已保存'));
    }
};
