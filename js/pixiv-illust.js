// Pixiv Illustration Generation Module
const PixivIllust = {
    async init() {
        if (!AppState.data.pixivData.illustrations) {
            AppState.data.pixivData.illustrations = [];
        }
        await this._migrateLegacy();
        await this.render();
    },

    async render() {
        IllustGallery.revokeAll();  // 释放上一次会话的 ObjectURL
        const grid = document.getElementById('pixivIllustGrid');
        const illustrations = AppState.data.pixivData.illustrations || [];

        if (illustrations.length === 0) {
            grid.innerHTML = `
                <div class="pixiv-illust-placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5"
                        style="width:48px;height:48px;opacity:0.4;">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <div style="margin-top:12px;color:var(--text-secondary);font-size:13px;">${I18n.t('pixiv_illust.empty_no_images', '暂无插画')}</div>
                    <div style="color:var(--text-tertiary);font-size:12px;margin-top:4px;">${I18n.t('pixiv_illust.empty_hint', '点击右上角 + 开始生成')}</div>
                </div>
            `;
            return;
        }

        // 并发加载所有 ObjectURL
        const urlMap = {};
        await Promise.all(illustrations.map(async img => {
            urlMap[img.id] = await IllustGallery.getUrl(img.id);
        }));

        const trashIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>`;

        grid.innerHTML = illustrations.map((img, idx) => `
            <div class="pixiv-illust-card${img.isFavorite ? ' is-favorite' : ''}" onclick="PixivIllust.viewImage(${idx})">
                <img src="${urlMap[img.id] || ''}" alt="${Utils.escHtml(img.prompt || 'Generated image')}">
                <div class="pixiv-illust-overlay">
                    <button class="pixiv-illust-fav-btn${img.isFavorite ? ' active' : ''}"
                        onclick="event.stopPropagation(); PixivIllust.toggleFavorite(${idx})"
                        title="${img.isFavorite ? I18n.t('pixiv_illust.unfav_title', '取消收藏') : I18n.t('pixiv_illust.fav_title', '收藏')}">
                        ${img.isFavorite ? '★' : '☆'}
                    </button>
                    <button class="pixiv-illust-delete-btn" onclick="event.stopPropagation(); PixivIllust.deleteImage(${idx})">
                        ${trashIcon}
                    </button>
                </div>
            </div>
        `).join('');
    },

    _illustMode: 'manual', // 'manual' | 'ai'

    _switchMode(mode) {
        this._illustMode = mode;
        const manualDiv = document.getElementById('pixivIllustManualMode');
        const aiDiv = document.getElementById('pixivIllustAIMode');
        const manualBtn = document.getElementById('pixivIllustModeManual');
        const aiBtn = document.getElementById('pixivIllustModeAI');
        if (manualDiv) manualDiv.style.display = mode === 'manual' ? '' : 'none';
        if (aiDiv) aiDiv.style.display = mode === 'ai' ? '' : 'none';
        if (manualBtn) manualBtn.classList.toggle('active', mode === 'manual');
        if (aiBtn) aiBtn.classList.toggle('active', mode === 'ai');

        // AI モードではサイズ・数量・負面を隠す
        const negRow = document.getElementById('pixivIllustNegativeRow');
        const sizeRow = document.getElementById('pixivIllustSizeRow');
        const countRow = document.getElementById('pixivIllustCountRow');
        if (mode === 'ai') {
            if (negRow) negRow.style.display = 'none';
            if (sizeRow) sizeRow.style.display = 'none';
            if (countRow) countRow.style.display = 'none';
        }
    },

    showGenerateModal() {
        document.getElementById('pixivIllustGenerateModal').classList.add('active');
        document.getElementById('pixivIllustPositivePrompt').value = '';
        document.getElementById('pixivIllustNegativePrompt').value = '';
        document.getElementById('pixivIllustImageSize').value = '1024x1024';
        document.getElementById('pixivIllustImageCount').value = '1';
        const aiDesc = document.getElementById('pixivIllustAIDesc');
        if (aiDesc) aiDesc.value = '';

        this._switchMode('manual');

        // D4（2026-08-07 阶段3）：弹窗形态按 pixiv 板块绑定的生效 provider 走，不再只看全局——
        // pixiv 绑了 NAI 预设时也要按 NAI 形态显示（隐藏尺寸/数量行）；未绑定时与全局逐字节一致。
        const isNovelAI = this.resolveModuleConfig('pixiv').provider === 'novelai';
        const negRow = document.getElementById('pixivIllustNegativeRow');
        const sizeRow = document.getElementById('pixivIllustSizeRow');
        const countRow = document.getElementById('pixivIllustCountRow');
        if (negRow) negRow.style.display = '';
        if (sizeRow) sizeRow.style.display = isNovelAI ? 'none' : '';
        if (countRow) countRow.style.display = isNovelAI ? 'none' : '';

        const promptArea = document.getElementById('pixivIllustPositivePrompt');
        const negArea = document.getElementById('pixivIllustNegativePrompt');
        if (isNovelAI) {
            promptArea.placeholder = I18n.t('pixiv_illust.placeholder_pos_novelai', '可选 — 输入额外的正向提示词，会追加到设置中的默认提示词后');
            if (negArea) negArea.placeholder = I18n.t('pixiv_illust.placeholder_neg_novelai', '可选 — 输入额外的负向提示词，留空则使用设置中的默认值');
        } else {
            promptArea.placeholder = I18n.t('pixiv_illust.placeholder_pos', '输入想要生成的内容描述，如：beautiful anime girl, detailed eyes, cherry blossoms...');
            if (negArea) negArea.placeholder = I18n.t('pixiv_illust.placeholder_neg', '输入不想要的内容，如：low quality, blurry, bad anatomy...');
        }
    },

    // ===== v2.173.0: 预存外貌 tag（放送局立绘下方维护）——四个生图模块共用逻辑 =====
    // 有预存 tag 的角色，LLM 的 [CHAR] 段只写姿势/表情/情绪，外貌 tag 由代码层拼接（字节级固定，跨图一致 + 省 token）

    // 取预存角色列表 [{name, tags}]；未配置 / Broadcast 未加载 → []（各消费点走老路，行为不变）
    getStoredCharTags() {
        if (typeof Broadcast === 'undefined' || !Broadcast.getCPAppearanceTags) return [];
        return Broadcast.getCPAppearanceTags();
    },

    // system prompt 附加段：声明固定外貌角色名单 + [CHARn|名前] 标记规则
    fixedCharPromptSection(storedChars) {
        if (!storedChars || storedChars.length === 0) return '';
        const names = storedChars.map(c => `- ${c.name}`).join('\n');
        return `

FIXED-APPEARANCE CHARACTERS:
The following characters have pre-approved appearance tags managed OUTSIDE this prompt (prepended to their section automatically after you answer):
${names}

Special rules for these characters ONLY (override the general rules above):
- If ANY of them appears in the image, ALWAYS use the structured [SCENE]/[CHAR] format — even when there is only ONE character
- Write their marker as [CHAR1|name], with the character's name EXACTLY as listed above (e.g. [CHAR1|${storedChars[0].name}])
- In their [CHAR] section output ONLY: pose, expression, emotion, gaze direction, and scene-specific clothing (only when the scene clearly requires an outfit different from their usual one)
- Do NOT output their gender / hair / eyes / base appearance tags — those are prepended automatically
- Characters NOT in the list follow the general rules (full appearance tags)`;
    },

    // LLM 出力の [SCENE]/[CHAR1|名前] 解析 + 预存 tag 合并；旧格式 [CHAR1]（无名字）兼容。
    // 名字 trim 后精确匹配（不做子串模糊匹配，防 ユウ↔ユウキ 误匹配，同 getCPRefImages 约定）
    parseTagPromptOutput(raw, storedChars) {
        const result = (raw || '').trim();
        const sceneMatch = result.match(/\[SCENE\]\s*(.+?)(?=\[CHAR|\n*$)/s);
        const charMatches = [...result.matchAll(/\[CHAR\d*(?:\s*[|:：]\s*([^\]]*))?\]\s*(.+?)(?=\[CHAR|\n*$)/gs)];
        if (!sceneMatch || charMatches.length === 0) {
            return { positive: result, charCaptions: [] };
        }
        const scene = sceneMatch[1].trim().replace(/\n/g, ', ');
        const list = storedChars || [];
        const chars = charMatches.map(m => {
            const name = (m[1] || '').trim();
            const content = (m[2] || '').trim().replace(/\n/g, ', ');
            const stored = name ? list.find(c => c.name === name) : null;
            return stored ? [stored.tags, content].filter(Boolean).join(', ') : content;
        });
        return { positive: scene, charCaptions: chars };
    },

    // 世界書からキャラ外見抽出（推特と同じロジック）
    // excludeNames: 已有预存外貌 tag 的角色名 —— 其外貌条目（title 精确匹配）不再塞给 LLM，省 token
    _extractCharacterAppearance(desc, excludeNames) {
        const wbIds = Utils.getActiveWorldBookIds();
        if (wbIds.length === 0) return '';
        const excluded = excludeNames || [];
        const matched = [];
        wbIds.forEach(wbId => {
            const book = (AppState.data.worldBooks || []).find(b => b.id === wbId);
            if (book && book.entries) {
                book.entries.filter(e => e.enabled !== false).forEach(e => {
                    if (excluded.includes((e.title || '').trim())) return;
                    if (e.title && desc.includes(e.title)) {
                        matched.push(`【${e.title}】${e.content}`);
                    }
                });
            }
        });
        return matched.join('\n').substring(0, 1200);
    },

    // AI辅助：自然言語 → 生図プロンプト変換
    async _buildAIPrompt(desc) {
        const storedChars = this.getStoredCharTags();
        const charAppearance = this._extractCharacterAppearance(desc, storedChars.map(c => c.name));

        const systemPrompt = `You are a prompt engineer for anime image generation (NovelAI V4.5).
Convert the user's natural language description into English Danbooru-style tags.

CRITICAL — Character Separation Format:
When the image has MULTIPLE characters, you MUST output in this structured format:

[SCENE] scene tags, composition, quality tags
[CHAR1] first character's appearance tags (gender tag first, then hair, eyes, clothing)
[CHAR2] second character's appearance tags

When the image has only ONE character, output flat tags (no [SCENE]/[CHAR] markers).

Rules:
- Each [CHAR] section MUST start with the character's gender tag (1girl or 1boy)
- Extract character appearance from the provided character info — STRICTLY separate each character
- If the description specifies clothing that differs from character info, use the description's version
- For well-known anime/manga/game characters, include: character_name (series_name)
- For original characters, use only visual descriptors
- Include composition, scene, emotion, and quality tags (masterpiece, best quality, amazing quality)
- Do NOT include negative prompt tags
- Keep each section under 40 words${this.fixedCharPromptSection(storedChars)}`;

        const userMsg = `Description: ${desc}
${charAppearance ? `\nCharacter appearance database:\n${charAppearance}` : ''}

Generate image tags:`;

        try {
            const raw = await Utils.callChatAPI([{ role: 'user', content: userMsg }], systemPrompt);
            const parsed = this.parseTagPromptOutput(raw, storedChars);
            return { positive: parsed.positive, negative: '', charCaptions: parsed.charCaptions };
        } catch (e) {
            console.error('[PixivIllust AI] Prompt build failed:', e);
            return null;
        }
    },

    async generateImage() {
        const config = AppState.data.imageApiConfig;
        // 大review A2/C1 修（2026-08-07）：闸门按板块生效配置判断——纯预设用户（全局不填 key、只给 pixiv
        // 绑预设）不再被拦；未绑定时解析结果就是全局 config，行为与改前一致
        const gateCfg = this.resolveModuleConfig('pixiv').config;
        if (!gateCfg || !gateCfg.key) {
            Utils.showToast(I18n.t('t.pi_no_api', '⚠️ 请先在设置中配置图片生成API'));
            return;
        }

        // D4（2026-08-07 阶段3）：pixiv 板块绑定的预设生效 provider/nai——未绑定时与上面的全局 config 逐字节一致。
        // 尺寸计算 + 手动模式的「正向提示词是否必填」判断都要跟着这个生效 provider 走，而不是全局 config.provider，
        // 否则 pixiv 绑了 NAI 预设时，弹窗（showGenerateModal 已按此 provider 显示 NAI 形态）跟实际生成判断会对不上。
        const { provider: pixivProvider, nai: pixivNai } = this.resolveModuleConfig('pixiv');

        // D5（2026-08-07 阶段4）：并发防呆（CLAUDE.md 铁律）——同一时间只允许一次插画生成在途，
        // 锁被占时不排队、直接 toast 提示（onBusy），finally 自动放锁。
        await Utils.withLock('pixiv_illust_gen', async () => {
            // AI辅助モード
            if (this._illustMode === 'ai') {
                const aiDesc = document.getElementById('pixivIllustAIDesc')?.value?.trim();
                if (!aiDesc) {
                    Utils.showToast(I18n.t('t.pi_need_desc', '⚠️ 请输入描述内容'));
                    return;
                }
                document.getElementById('pixivIllustGenerateModal').classList.remove('active');
                Utils.showToast(I18n.t('t.pi_translating', '🎨 AI翻译提示词中...'));

                try {
                    const prompt = await this._buildAIPrompt(aiDesc);
                    if (!prompt) { Utils.showToast(I18n.t('t.pi_prompt_failed', '❌ 提示词生成失败')); return; }

                    Utils.showToast(I18n.t('t.pi_img_generating', '🎨 正在生成图片...'));
                    // 大review C2 修（2026-08-07）：_buildAIPrompt 的等待窗口里板块绑定可能被改——尺寸计算
                    // 重新解析一次，与 dispatchGenerate 内部的解析时点对齐（手动模式无 await 窗口，不需要）
                    const { provider: liveProvider, nai: liveNai } = this.resolveModuleConfig('pixiv');
                    const imgSize = liveProvider === 'novelai' ? (liveNai.resolution || '1024x1024') : '1024x1024';

                    const blobs = await this.dispatchGenerate({
                        positivePrompt: prompt.positive, negativePrompt: prompt.negative,
                        size: imgSize, count: 1, config, charCaptions: prompt.charCaptions, moduleKey: 'pixiv'
                    });
                    await this._saveAndRenderBlobs(blobs, prompt.positive, '', imgSize, pixivProvider);
                } catch (error) {
                    console.error('AI Image generation error:', error);
                    Utils.showToast(I18n.t('t.pi_gen_failed', '❌ 生成失败: ') + error.message);
                }
                return;
            }

            // 手動モード
            const positivePrompt = document.getElementById('pixivIllustPositivePrompt').value.trim();
            if (!positivePrompt && pixivProvider !== 'novelai') {
                Utils.showToast(I18n.t('t.pi_need_positive', '⚠️ 请输入正向提示词'));
                return;
            }

            const negativePrompt = document.getElementById('pixivIllustNegativePrompt').value.trim();
            // D5（2026-08-07 阶段4）：provider=novelai 时手动模式 UI 隐藏了尺寸选择行（showGenerateModal 已隐藏），
            // DOM 里的值是残留值——改成与 AI 辅助模式同款三元，让设置里的 NAI 分辨率继续说了算。
            const rawImageSize = document.getElementById('pixivIllustImageSize').value;
            const imageSize = pixivProvider === 'novelai' ? (pixivNai.resolution || '1024x1024') : rawImageSize;
            const imageCount = parseInt(document.getElementById('pixivIllustImageCount').value) || 1;

            document.getElementById('pixivIllustGenerateModal').classList.remove('active');
            Utils.showToast(I18n.t('t.pi_img_generating', '🎨 正在生成图片...'));

            try {
                const blobs = await this.dispatchGenerate({
                    positivePrompt, negativePrompt, size: imageSize, count: imageCount,
                    config, strictProvider: true, moduleKey: 'pixiv'
                });

                await this._saveAndRenderBlobs(blobs, positivePrompt, negativePrompt, imageSize, pixivProvider);
            } catch (error) {
                console.error('Image generation error:', error);
                Utils.showToast(I18n.t('t.pi_gen_failed', '❌ 生成失败: ') + error.message);
            }
        }, () => Utils.showToast(I18n.t('t.pi_gen_busy', '⏳ 已有图片正在生成，请稍候…')));
    },

    // provider（可选，D5 2026-08-07 阶段4）：调用方已解析好的生效 provider（resolveModuleConfig('pixiv').provider）；
    // 未传时回落全局 AppState.data.imageApiConfig.provider——pixiv 绑了预设时插画元数据记录的 provider 要跟着
    // 生效配置走，不能一律记全局（否则绑了 NAI 预设时元数据显示会错）。
    async _saveAndRenderBlobs(blobs, prompt, negPrompt, size, provider) {
        if (!blobs || blobs.length === 0) return;
        const config = AppState.data.imageApiConfig;
        const effProvider = provider || config.provider;
        if (!AppState.data.pixivData.illustrations) AppState.data.pixivData.illustrations = [];

        const newIllustrations = [];
        for (let i = 0; i < blobs.length; i++) {
            const id = 'illust_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            await IllustGallery.save(id, blobs[i]);
            newIllustrations.push({
                id, prompt, negativePrompt: negPrompt || '', size: size || '',
                provider: effProvider, createdAt: new Date().toISOString(), isFavorite: false
            });
        }
        AppState.data.pixivData.illustrations.unshift(...newIllustrations);

        const MAX_NON_FAV = 30;
        const favs = AppState.data.pixivData.illustrations.filter(i => i.isFavorite);
        const nonFavs = AppState.data.pixivData.illustrations.filter(i => !i.isFavorite);
        if (nonFavs.length > MAX_NON_FAV) {
            for (const item of nonFavs.slice(MAX_NON_FAV)) {
                await IllustGallery.remove(item.id);
            }
            AppState.data.pixivData.illustrations = [...favs, ...nonFavs.slice(0, MAX_NON_FAV)];
        }

        Utils.saveData();
        await this.render();
        Utils.showToast(I18n.t('t.pi_gen_success', {n: blobs.length}));
    },

    // ===== D4 分板块指定 API 预设（2026-08-07 阶段3）=====

    /**
     * 按 moduleKey 解析生效的生图配置：查 AppState.data.imageModulePresets 绑定 → 命中且预设仍存在 →
     * 从预设组出 config（provider=novelai 时额外给出 preset.novelai 快照作为 nai）；否则（未绑定 /
     * moduleKey 未传 / 绑定的预设已被删除）一律回落全局 imageApiConfig + novelaiSettings —— 这条 fallback
     * 分支必须与分板块绑定功能上线前（v2.236）逐字节一致，是本功能的回归基线。放在 PixivIllust 上，
     * 供 dispatchGenerate 和设置面板 UI（ImageAPISettings）共用。
     *
     * @param {string} [moduleKey] - 'pixiv' | 'twitter' | 'melonbooks' | 'goods'（ワンドロ 复用 'twitter'，
     *   与其现状共用开关一致，不另立键）；未知/未传 → 视同未绑定，走 fallback
     * @returns {{config: Object, nai: Object, provider: string, fromPreset: boolean}}
     */
    resolveModuleConfig(moduleKey) {
        const presetId = moduleKey ? (AppState.data.imageModulePresets || {})[moduleKey] : '';
        const preset = presetId ? (AppState.data.imageApiPresets || []).find(p => p.id === presetId) : null;

        if (preset) {
            const config = {
                provider: preset.provider,
                url: preset.url || '',
                key: preset.key || '',
                model: preset.model || '',
                defaultPositive: preset.defaultPositive || '',
                defaultNegative: preset.defaultNegative || ''
            };
            // NAI 快照隔离：provider=novelai 的预设里，顶层 url/model 是 NAI 面板隐藏标准 URL/Model 行时的
            // 陈旧残留值（面板切到 NAI 分支后这两行不显示也不再被同步），不能拿来当 nai.proxyUrl/nai.model 的
            // 兜底——只认 preset.novelai 这份专属快照；快照理论上不该缺失（savePreset 保存 NAI 预设时必带），
            // 缺失时防御性回落全局 novelaiSettings。
            const nai = (preset.provider === 'novelai')
                ? (preset.novelai || AppState.data.novelaiSettings || {})
                : (AppState.data.novelaiSettings || {});
            return { config, nai, provider: preset.provider, fromPreset: true };
        }

        // 未绑定 / moduleKey 未传 / 绑定的预设 id 已失效 —— 回落全局，与分板块绑定上线前行为逐字节一致
        const config = AppState.data.imageApiConfig;
        const nai = AppState.data.novelaiSettings || {};
        return { config, nai, provider: config?.provider, fromPreset: false };
    },

    // ===== 共享 provider 分发（全站 6 处生图入口共用，2026-08-07 阶段0 收敛） =====

    /**
     * 生图 provider 分发：按 opts.config.provider 路由到对应 generateWithXxx()，统一返回 Blob[]。
     * 全站 6 处生图入口（pixiv 插画手动/AI辅助、周边商品图、melon 封面、推特配图、ワンドロ）共用此方法，
     * 取代此前逐处复制的 switch。零行为变更收敛——不改任何 provider 分支的请求参数或返回值处理。
     *
     * @param {Object} opts
     * @param {string} opts.positivePrompt
     * @param {string} opts.negativePrompt
     * @param {string} opts.size - 像素尺寸串 'WxH'；由调用方按自己的业务规则算好传入（如是否 NovelAI/画幅类型），dispatch 不做尺寸推导
     * @param {number} opts.count - 生成张数
     * @param {Object} opts.config - AppState.data.imageApiConfig，调用方已读好传入；provider 从 opts.config.provider 取，dispatch 不自行读取全局状态。opts.moduleKey 存在时本字段会被 resolveModuleConfig 的结果覆盖
     * @param {string[]} [opts.charCaptions] - AI辅助/结构化输出的多角色外观描述，合回 prompt 用
     * @param {string[]} [opts.refCharNames] - 仅 gpt-image / openrouter / openai-compat 分支消费（按角色名过滤 CP 参考立绘）；其余 provider 分支的 generateWithXxx 本就没有这个形参，传了也不会被读取
     * @param {boolean} [opts.strictProvider] - true 时对未匹配任何 case 的 provider 抛出 Error('Unsupported API provider')（仅 pixiv 手动模式原有行为）；默认/未传 = 静默返回 []（其余 5 处原有行为，不视为错误）
     * @param {string} [opts.moduleKey] - D4（2026-08-07 阶段3）：板块标识（'pixiv'/'twitter'/'melonbooks'/'goods'）。存在时用 resolveModuleConfig(moduleKey) 的结果覆盖 opts.config，并把解析出的 nai 透传给 novelai 分支；未传 = 阶段0 行为（直接用 opts.config，novelai 分支自读全局）
     * @returns {Promise<Blob[]>}
     */
    async dispatchGenerate(opts) {
        let { positivePrompt, negativePrompt, size, count, config, charCaptions, refCharNames, strictProvider, moduleKey } = opts;

        // D4 分板块绑定（2026-08-07 阶段3）：moduleKey 存在时用解析结果覆盖调用方传入的全局 config——
        // 调用方传的 opts.config 作废。未绑定/预设已删时 resolveModuleConfig 本就回落全局 imageApiConfig，
        // 覆盖后与不传 moduleKey 时等价，不影响任何现有调用点在「未绑定」状态下的行为。
        let nai;
        if (moduleKey) {
            const resolved = this.resolveModuleConfig(moduleKey);
            config = resolved.config;
            nai = resolved.nai;
        }

        // D2 常驻附加提示词（2026-08-07）：非 NovelAI provider 才注入——NAI 走自己的 novelaiSettings.defaultPositive/
        // defaultNegative（generateWithNovelAI 内部已拼过一次），这里若也注入会双重追加。字段为空时 filter(Boolean)
        // 会把它剔除，join 结果与注入前完全一致——不影响任何已有行为。
        if (config.provider !== 'novelai') {
            positivePrompt = [positivePrompt, config.defaultPositive].filter(Boolean).join(', ');
            negativePrompt = [negativePrompt, config.defaultNegative].filter(Boolean).join(', ');
        }

        let blobs = [];
        switch (config.provider) {
            case 'openai':
                blobs = await this.generateWithOpenAI(positivePrompt, negativePrompt, size, count, config, charCaptions);
                break;
            case 'gpt-image':
                blobs = await this._gptImage(positivePrompt, negativePrompt, size, count, config, charCaptions, refCharNames);
                break;
            case 'openrouter':
                blobs = await this.generateWithOpenRouter(positivePrompt, negativePrompt, size, count, config, charCaptions, refCharNames);
                break;
            case 'openai-compat':
                blobs = await this._openaiCompat(positivePrompt, negativePrompt, size, count, config, charCaptions, refCharNames);
                break;
            case 'stabilityai':
                blobs = await this.generateWithStabilityAI(positivePrompt, negativePrompt, size, count, config, charCaptions);
                break;
            case 'novelai':
                blobs = await this.generateWithNovelAI(positivePrompt, negativePrompt, size, count, config, charCaptions, nai);
                break;
            case 'midjourney':
            case 'custom':
                blobs = await this.generateWithCustomAPI(positivePrompt, negativePrompt, size, count, config, charCaptions);
                break;
            default:
                if (strictProvider) throw new Error('Unsupported API provider');
                break;
        }
        return blobs;
    },

    // ===== 各提供商：统一返回 Blob[] =====

    // charCaptions 合回 positive（OpenAI/gpt-image/StabilityAI/Custom 无原生 char caption 通道，格式同 generateWithOpenRouter 的 charSection）
    _mergeCharCaptions(positivePrompt, charCaptions) {
        if (!charCaptions || charCaptions.length === 0) return positivePrompt;
        const charSection = charCaptions.map((c, i) => `Character ${i + 1}: ${c}`).join('\n');
        return `${positivePrompt}\n\nThis image MUST include all ${charCaptions.length} of these characters together in the same scene:\n${charSection}`;
    },

    async generateWithOpenAI(positivePrompt, negativePrompt, imageSize, imageCount, config, charCaptions) {
        const scenePrompt = this._mergeCharCaptions(positivePrompt, charCaptions);
        const finalPrompt = negativePrompt ?
            `${scenePrompt} (avoid: ${negativePrompt})` :
            scenePrompt;
        // D5（2026-08-07 阶段4）：尺寸按 provider 合法枚举收口——dall-e-2 固定方图，dall-e-3 按比例就近三档
        const effModel = config.model || 'dall-e-3';
        const size = this._snapSizeForProvider(imageSize, 'openai', effModel);

        const response = await Utils._fetchWithTimeout(`${config.url}/v1/images/generations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.key}`
            },
            body: JSON.stringify({
                model: effModel,
                prompt: finalPrompt,
                n: imageCount,
                size,
                quality: 'standard'
            })
        }, 600000);

        if (!response.ok) {
            // 反代/网关超时可能返回非 JSON 错误页（HTML 502 等），裸 .json() 会把真实错误吞成 SyntaxError
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        // 立即 fetch CDN URL → Blob（CDN URL 约 1 小时后过期，必须在此刻获取）
        return Promise.all(data.data.map(img => fetch(img.url).then(r => r.blob())));
    },

    // GPT Image（gpt-image-2 等）：与 DALL-E 是两套格式，故独立成函数。
    // 关键差异：① 不发 quality（'standard' 是 DALL-E 专属值，gpt-image 只认 low/medium/high/auto，发了会报错）
    //          ② 返回 b64_json（gpt-image 不返回 CDN url），直接转 Blob，无需二次 fetch CDN（也就绕开了 CDN 跨域）
    //          ③ 不发 response_format / background（gpt-image 不支持这两个参数）
    async generateWithGptImage(positivePrompt, negativePrompt, imageSize, imageCount, config, charCaptions) {
        const scenePrompt = this._mergeCharCaptions(positivePrompt, charCaptions);
        const finalPrompt = negativePrompt ?
            `${scenePrompt} (avoid: ${negativePrompt})` :
            scenePrompt;
        // D5（2026-08-07 阶段4）：尺寸按 provider 合法枚举收口（gpt-image 三档，同 openai-compat 现有 snap）
        const size = this._snapSizeForProvider(imageSize, 'gpt-image', config.model);

        const response = await Utils._fetchWithTimeout(`${config.url}/v1/images/generations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.key}`
            },
            body: JSON.stringify({
                model: config.model || 'gpt-image-2',
                prompt: finalPrompt,
                n: imageCount,
                size
            })
        }, 600000);

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || 'GPT Image request failed');
        }

        const data = await response.json();
        if (!data.data || data.data.length === 0) {
            throw new Error(I18n.t('t.pi_gen_no_image', '未返回图片，请重试或调整提示词'));
        }
        // gpt-image 正常返回 b64_json；留 url 兜底以兼容个别第三方反代
        return Promise.all(data.data.map(img =>
            img.b64_json
                ? this.base64ToBlob(img.b64_json, 'image/png')
                : fetch(img.url).then(r => r.blob())
        ));
    },

    // GPT Image edits（gpt-image-2 参考图 → 人物一致性）：传入参考立绘 Blob[]，走 /v1/images/edits（multipart）。
    // 仅当 CP 设置了参考立绘且 provider=gpt-image 时走这里；NAI / DALL-E / 纯文生图路径一律不碰。
    // 关键差异：① multipart/form-data，参考图字段名 image[]（可多张）；② 不要手设 Content-Type，让浏览器自动带 boundary
    //          ③ 不发 input_fidelity（gpt-image-2 对输入图自动高保真，发了会报错）④ size 按 gpt-image 三档 snap（阶段4 D5，
    //          与 generations 端点同枚举，收敛非法尺寸风险）⑤ 返回同 generations：data[].b64_json → Blob（复用 base64ToBlob），下游零改
    async generateWithGptImageEdits(positivePrompt, negativePrompt, imageSize, imageCount, config, refBlobs, charCaptions) {
        const scenePrompt = this._mergeCharCaptions(positivePrompt, charCaptions);
        const finalPrompt = negativePrompt ?
            `${scenePrompt} (avoid: ${negativePrompt})` :
            scenePrompt;
        const size = this._snapSizeForProvider(imageSize, 'gpt-image', config.model);

        const fd = new FormData();
        fd.append('model', config.model || 'gpt-image-2');
        fd.append('prompt', finalPrompt);
        fd.append('n', String(imageCount));
        fd.append('size', size);
        refBlobs.forEach((blob, i) => {
            const ext = (blob.type && blob.type.indexOf('jpeg') !== -1) ? 'jpg' : 'png';
            fd.append('image[]', blob, `ref${i}.${ext}`);
        });

        const response = await Utils._fetchWithTimeout(`${config.url}/v1/images/edits`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${config.key}` },  // 不设 Content-Type：multipart boundary 交给浏览器
            body: fd
        }, 600000);

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || 'GPT Image edits request failed');
        }

        const data = await response.json();
        if (!data.data || data.data.length === 0) {
            throw new Error(I18n.t('t.pi_gen_no_image', '未返回图片，请重试或调整提示词'));
        }
        return Promise.all(data.data.map(img =>
            img.b64_json
                ? this.base64ToBlob(img.b64_json, 'image/png')
                : fetch(img.url).then(r => r.blob())
        ));
    },

    // gpt-image 分流：CP 设了参考立绘 → edits 端点（保人物一致）；否则 → 现有纯文生图 generations。
    // 四个生图入口（pixiv AI/手动、twitter、melon）的 case 'gpt-image' 都走这里，逻辑单一来源。
    // charCaptions（可选）: AI 辅助モード结构化输出的人物描述，转发给下游合回 positive（同 generateWithOpenRouter 处理）。
    // refCharNames（可选）: 周边商品生图按关联角色过滤 CP 立绘；其余入口不传 → 取全部（行为不变）。
    async _gptImage(positivePrompt, negativePrompt, imageSize, imageCount, config, charCaptions, refCharNames) {
        let refBlobs = [];
        try {
            if (typeof Broadcast !== 'undefined' && Broadcast.getCPRefImages) {
                refBlobs = await Broadcast.getCPRefImages(refCharNames);
            }
        } catch (e) {
            refBlobs = [];
        }
        return (refBlobs && refBlobs.length > 0)
            ? this.generateWithGptImageEdits(positivePrompt, negativePrompt, imageSize, imageCount, config, refBlobs, charCaptions)
            : this.generateWithGptImage(positivePrompt, negativePrompt, imageSize, imageCount, config, charCaptions);
    },

    // ===== OpenAI 兼容 / 聚合站（provider='openai-compat'，D1 2026-08-07）=====
    // 与官方 openai/gpt-image 两个 provider 的关键区别：URL 完全由用户自填（settings.js updateUIForProvider
    // 对它绝不覆盖 urlInput.value），故生成前必须先把 base 归一化，再拼标准 OpenAI Images API 路径。
    // 尺寸固定走 gpt-image 三档 snap（聚合站大多只认这三档，不像 NAI/Stability 能吃任意像素）。
    // 响应双兼容 b64_json / url（各家聚合站落地实现不统一，同 generateWithGptImage 的处理姿势）。
    // body 只带 model/prompt/n/size，不带 quality/response_format——聚合站兼容性优先，这两个字段各家支持不一。

    // URL 归一化：去尾斜杠 → 去误填的 /images/generations 或 /images/edits 或 /chat/completions 后缀 → 去尾部 /v1。
    // 与 settings.js:tryFetchImageModels 的清理逻辑同源但独立实现（那边为拉模型列表保留 /v1 好拼 /v1/models；
    // 这里要的是不含 /v1 的干净 base，好统一拼 /v1/images/generations 或 /v1/images/edits）。
    _normalizeCompatBase(url) {
        let u = (url || '').trim();
        while (u.endsWith('/')) u = u.slice(0, -1);
        u = u.replace(/\/images\/(generations|edits)$/i, '');
        u = u.replace(/\/(chat\/)?completions$/i, '');
        while (u.endsWith('/')) u = u.slice(0, -1);
        u = u.replace(/\/v1$/i, '');
        while (u.endsWith('/')) u = u.slice(0, -1);
        return u;
    },

    // 共享的「按宽高比就近映射」小工具（阶段4 D5 从 _snapSizeGptImage 抽出，供 _snapSizeForProvider 复用）。
    // size 解析失败 / 未传 → ratio 兜底 1（方图），与抽出前 _snapSizeGptImage 的行为逐字节一致。
    // candidates: [{key:'WxH', ratio:Number}, ...]；找不到更近的就停在数组首项（Infinity 起跳）。
    _snapByRatio(size, candidates) {
        let ratio = 1;
        if (size && typeof size === 'string' && size.indexOf('x') !== -1) {
            const parts = size.split('x').map(Number);
            if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) ratio = parts[0] / parts[1];
        }
        let best = candidates[0].key, bestDiff = Infinity;
        for (const c of candidates) {
            const diff = Math.abs(ratio - c.ratio);
            if (diff < bestDiff) { bestDiff = diff; best = c.key; }
        }
        return best;
    },

    // 像素尺寸串（'WxH'）→ gpt-image 法定三档枚举（方/横/竖），按宽高比就近映射。
    // openai-compat 现有调用点（generateWithOpenAICompat/Edits）继续直接调用本函数，行为不变；
    // _snapSizeForProvider 的 gpt-image/openai-compat 分支也委托到这里，两条路径结果始终一致。
    _snapSizeGptImage(size) {
        return this._snapByRatio(size, [
            { key: '1024x1024', ratio: 1 },        // 方
            { key: '1536x1024', ratio: 1.5 },      // 横
            { key: '1024x1536', ratio: 1 / 1.5 }   // 竖
        ]);
    },

    // 像素尺寸串（'WxH'）→ 各 provider 的合法枚举，按宽高比就近映射（阶段4 D5，2026-08-07）。
    // 侦察结论：melon 768x1024 / 推特 1024x768 / 周边 768x1024 这类调用方自定尺寸，在 openai/gpt-image/
    // stability 三路都不是法定枚举，大概率一直静默 400；NAI 也有自己的固定面板枚举。这里统一收口。
    //   openai：dall-e-2 固定方图；dall-e-3 按比例就近三档（方/横/竖）
    //   gpt-image / openai-compat：复用 _snapSizeGptImage 现有三档，行为不变
    //   stabilityai：SDXL 九档枚举就近
    //   novelai：NAI 设置面板八档枚举就近（与 index.html #naiResolution 的 <option> 完全对应）
    //   openrouter（自有 aspect_ratio 映射）/ midjourney / custom（协议未知）：原样返回，不 snap
    _snapSizeForProvider(size, provider, model) {
        if (provider === 'openai') {
            if (model && /dall-e-2/i.test(model)) return '1024x1024';
            return this._snapByRatio(size, [
                { key: '1024x1024', ratio: 1 },
                { key: '1792x1024', ratio: 1792 / 1024 },
                { key: '1024x1792', ratio: 1024 / 1792 }
            ]);
        }
        if (provider === 'gpt-image' || provider === 'openai-compat') {
            return this._snapSizeGptImage(size);
        }
        if (provider === 'stabilityai') {
            return this._snapByRatio(size, [
                '1024x1024', '1152x896', '896x1152', '1216x832', '832x1216',
                '1344x768', '768x1344', '1536x640', '640x1536'
            ].map(k => { const [w, h] = k.split('x').map(Number); return { key: k, ratio: w / h }; }));
        }
        if (provider === 'novelai') {
            return this._snapByRatio(size, [
                '832x1216', '1216x832', '1024x1024', '512x768', '768x512', '640x640', '1088x1920', '1920x1088'
            ].map(k => { const [w, h] = k.split('x').map(Number); return { key: k, ratio: w / h }; }));
        }
        // openrouter / midjourney / custom：原样返回不 snap
        return size;
    },

    // 纯文生图：POST {base}/v1/images/generations。新链路直接用 Utils._fetchWithTimeout（600s），不重蹈
    // 现有 6 处生图裸 fetch 零超时的债。600s 是实测定的：聚合站 edits 带参考图实测跑过 298s，300s 会误杀。
    async generateWithOpenAICompat(positivePrompt, negativePrompt, imageSize, imageCount, config, charCaptions) {
        const scenePrompt = this._mergeCharCaptions(positivePrompt, charCaptions);
        const finalPrompt = negativePrompt ?
            `${scenePrompt} (avoid: ${negativePrompt})` :
            scenePrompt;
        const base = this._normalizeCompatBase(config.url);
        const size = this._snapSizeGptImage(imageSize);

        const response = await Utils._fetchWithTimeout(`${base}/v1/images/generations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.key}`
            },
            body: JSON.stringify({
                model: config.model || 'gpt-image-2',
                prompt: finalPrompt,
                n: imageCount,
                size
            })
        }, 600000);

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!data.data || data.data.length === 0) {
            throw new Error(I18n.t('t.pi_gen_no_image', '未返回图片，请重试或调整提示词'));
        }
        // 响应双兼容：b64_json（多数聚合站的 gpt-image-2 落地）或 url（个别反代走 CDN 直链）
        return Promise.all(data.data.map(img =>
            img.b64_json
                ? this.base64ToBlob(img.b64_json, 'image/png')
                : fetch(img.url).then(r => r.blob())
        ));
    },

    // 参考图编辑：POST {base}/v1/images/edits，multipart。结构照抄 generateWithGptImageEdits，仅 base 换成归一化后的。
    async generateWithOpenAICompatEdits(positivePrompt, negativePrompt, imageSize, imageCount, config, refBlobs, charCaptions) {
        const scenePrompt = this._mergeCharCaptions(positivePrompt, charCaptions);
        const finalPrompt = negativePrompt ?
            `${scenePrompt} (avoid: ${negativePrompt})` :
            scenePrompt;
        const base = this._normalizeCompatBase(config.url);
        const size = this._snapSizeGptImage(imageSize);

        const fd = new FormData();
        fd.append('model', config.model || 'gpt-image-2');
        fd.append('prompt', finalPrompt);
        fd.append('n', String(imageCount));
        fd.append('size', size);
        refBlobs.forEach((blob, i) => {
            const ext = (blob.type && blob.type.indexOf('jpeg') !== -1) ? 'jpg' : 'png';
            fd.append('image[]', blob, `ref${i}.${ext}`);
        });

        const response = await Utils._fetchWithTimeout(`${base}/v1/images/edits`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${config.key}` },  // 不设 Content-Type：multipart boundary 交给浏览器
            body: fd
        }, 600000);

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || 'OpenAI-compat images edits request failed');
        }

        const data = await response.json();
        if (!data.data || data.data.length === 0) {
            throw new Error(I18n.t('t.pi_gen_no_image', '未返回图片，请重试或调整提示词'));
        }
        return Promise.all(data.data.map(img =>
            img.b64_json
                ? this.base64ToBlob(img.b64_json, 'image/png')
                : fetch(img.url).then(r => r.blob())
        ));
    },

    // 分流器：CP 设了参考立绘 → edits 端点（保人物一致）；否则 → 纯文生图 generations。同 _gptImage 的姿势，
    // 复用同一来源 Broadcast.getCPRefImages。
    // refCharNames（可选）: 周边商品生图按关联角色过滤 CP 立绘；其余入口不传 → 取全部（行为同 gpt-image/openrouter）。
    async _openaiCompat(positivePrompt, negativePrompt, imageSize, imageCount, config, charCaptions, refCharNames) {
        let refBlobs = [];
        try {
            if (typeof Broadcast !== 'undefined' && Broadcast.getCPRefImages) {
                refBlobs = await Broadcast.getCPRefImages(refCharNames);
            }
        } catch (e) {
            refBlobs = [];
        }
        return (refBlobs && refBlobs.length > 0)
            ? this.generateWithOpenAICompatEdits(positivePrompt, negativePrompt, imageSize, imageCount, config, refBlobs, charCaptions)
            : this.generateWithOpenAICompat(positivePrompt, negativePrompt, imageSize, imageCount, config, charCaptions);
    },

    // OpenRouter 生图：与 OpenAI Images API 是两套完全不同的协议，故独立成函数（绝不碰 NAI / DALL-E / gpt-image）。
    // 关键差异：① 走 chat completions（/chat/completions）+ modalities:['image','text']，不是 /v1/images/*
    //          ② CP 参考立绘作为多模态输入：messages content 里加 image_url（base64 data URL），不是 multipart image[]
    //          ③ 尺寸走 image_config.aspect_ratio（由像素 size 映射成最接近的受支持比例），不是像素串 size
    //          ④ 返回在 choices[0].message.images[].image_url.url（base64 data URL）→ 解析成 Blob
    //          ⑤ chat completions 无 n 参数 → imageCount>1 时并发多次请求各取首图
    // 默认模型 openai/gpt-5.4-image-2（OpenRouter 路由的 GPT Image 2，作者要的参考图人物一致性）；用户可在设置改任意 OpenRouter 生图模型（Gemini nano banana 等）。
    // refCharNames（可选）: 周边商品生图按关联角色过滤 CP 立绘；其余入口不传 → 取全部（行为不变）。
    async generateWithOpenRouter(positivePrompt, negativePrompt, imageSize, imageCount, config, charCaptions, refCharNames) {
        // AI 辅助多角色时 positivePrompt 只剩 [SCENE] 场景、各角色外观在 charCaptions（同 NovelAI 处理）。
        // 必须把角色描述合回 prompt + 明确「这 N 个角色都要同时出现」，否则 OpenRouter 只收到场景、易塌成单角色。
        let scenePrompt = positivePrompt;
        if (charCaptions && charCaptions.length > 0) {
            const charSection = charCaptions.map((c, i) => `Character ${i + 1}: ${c}`).join('\n');
            scenePrompt = `${positivePrompt}\n\nThis image MUST include all ${charCaptions.length} of these characters together in the same scene:\n${charSection}`;
        }
        const finalPrompt = negativePrompt ?
            `${scenePrompt} (avoid: ${negativePrompt})` :
            scenePrompt;

        // CP 参考立绘（与 gpt-image 同一来源 getCPRefImages）→ base64 data URL 塞进多模态输入
        let refDataUrls = [];
        try {
            if (typeof Broadcast !== 'undefined' && Broadcast.getCPRefImages) {
                const refBlobs = await Broadcast.getCPRefImages(refCharNames);
                if (refBlobs && refBlobs.length > 0) {
                    // 单张失败只丢该张（对齐 broadcast.getCPRefImages 的 .catch(()=>null) 风格），不整组丢
                    refDataUrls = (await Promise.all(refBlobs.map(b => this.blobToDataUrl(b).catch(() => null)))).filter(Boolean);
                }
            }
        } catch (e) {
            refDataUrls = [];
        }

        // OpenRouter 建议文本在前、图片在后。多张参考立绘要逐张标注「不同角色、都要画进同一张」，
        // 否则模型易只聚焦其中一张（作者实测：传 A+B 只画了 B）。
        const content = [{ type: 'text', text: finalPrompt }];
        if (refDataUrls.length === 1) {
            content.push({ type: 'text', text: 'Reference image below — keep the character visually consistent with it:' });
            content.push({ type: 'image_url', image_url: { url: refDataUrls[0] } });
        } else if (refDataUrls.length > 1) {
            content.push({ type: 'text', text: `Below are ${refDataUrls.length} reference images, each showing a DIFFERENT character. ALL of these characters must appear together in the generated image, each visually matching their own reference:` });
            refDataUrls.forEach((url, i) => {
                content.push({ type: 'text', text: `Reference for character ${i + 1}:` });
                content.push({ type: 'image_url', image_url: { url } });
            });
        }

        // 纯图模型（Flux / SD 等）只认 modalities:['image']；文+图模型（gpt-image-2 / Gemini）用 ['image','text']。
        // 判据宁松勿误伤默认的 gpt-image-2 / Gemini（它们不含下列任一关键词，恒走 ['image','text']）。
        const model = config.model || 'openai/gpt-5.4-image-2';
        const isImageOnly = /flux|black-forest-labs|sourceful|riverflow|stable-?diffusion|sdxl/i.test(model);
        const body = {
            model,
            messages: [{ role: 'user', content }],
            modalities: isImageOnly ? ['image'] : ['image', 'text']
        };
        const aspect = this._pxToAspectRatio(imageSize);
        if (aspect) body.image_config = { aspect_ratio: aspect };

        const endpoint = this._openRouterEndpoint(config.url);
        const n = Math.max(1, imageCount || 1);

        // chat completions 没有 n 参数 → 要多张就并发多次请求各取返回的图
        const requests = [];
        for (let i = 0; i < n; i++) {
            requests.push(this._openRouterRequest(endpoint, config.key, body));
        }
        const results = await Promise.all(requests);
        const blobs = results.flat();
        if (blobs.length === 0) {
            throw new Error(I18n.t('t.pi_gen_no_image', '未返回图片，请重试或调整提示词'));
        }
        return blobs;
    },

    async _openRouterRequest(endpoint, key, body) {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        };
        // OpenRouter 可选归因 header（不影响功能，仅用于其排行榜署名）
        try {
            if (typeof location !== 'undefined' && location.origin && location.origin.indexOf('http') === 0) {
                headers['HTTP-Referer'] = location.origin;
            }
        } catch (e) { /* noop */ }
        headers['X-Title'] = 'Perigee OS';

        // D5（2026-08-07 阶段4）：generateWithOpenRouter 的实际请求出口——套 600s 超时天花板
        const response = await Utils._fetchWithTimeout(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        }, 600000);
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || 'OpenRouter image request failed');
        }
        const data = await response.json();
        const msg = data.choices && data.choices[0] && data.choices[0].message;
        const images = (msg && msg.images) || [];
        const blobs = [];
        for (const img of images) {
            const url = img && img.image_url && img.image_url.url;
            const blob = url ? this._dataUrlToBlob(url) : null;
            if (blob) blobs.push(blob);
        }
        return blobs;
    },

    // 像素尺寸串（'WxH'）→ OpenRouter image_config.aspect_ratio（取最接近的受支持比例）
    _pxToAspectRatio(imageSize) {
        if (!imageSize || typeof imageSize !== 'string' || imageSize.indexOf('x') === -1) return null;
        const parts = imageSize.split('x').map(Number);
        if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
        const ratio = parts[0] / parts[1];
        const candidates = [
            ['1:1', 1], ['2:3', 2 / 3], ['3:2', 3 / 2], ['3:4', 3 / 4], ['4:3', 4 / 3],
            ['4:5', 4 / 5], ['5:4', 5 / 4], ['9:16', 9 / 16], ['16:9', 16 / 9], ['21:9', 21 / 9]
        ];
        let bestLabel = '1:1', bestDiff = Infinity;
        for (const [label, val] of candidates) {
            const diff = Math.abs(val - ratio);
            if (diff < bestDiff) { bestDiff = diff; bestLabel = label; }
        }
        return bestLabel;
    },

    // OpenRouter chat completions 端点容错拼接（用户填 base，自动补 /chat/completions）
    _openRouterEndpoint(url) {
        let u = (url || 'https://openrouter.ai/api/v1').trim();
        while (u.endsWith('/')) u = u.slice(0, -1);
        if (/\/chat\/completions$/.test(u)) return u;
        if (/\/v1$/.test(u)) return `${u}/chat/completions`;
        return `${u}/v1/chat/completions`;
    },

    // base64 data URL → Blob（OpenRouter 返回的 message.images[].image_url.url 是 data URL）
    _dataUrlToBlob(dataUrl) {
        if (!dataUrl || typeof dataUrl !== 'string') return null;
        const m = /^data:([^;,]+)(;base64)?,(.*)$/i.exec(dataUrl);
        if (!m) return null;
        const mime = m[1] || 'image/png';
        const isBase64 = !!m[2];
        const dataPart = m[3];
        if (isBase64) {
            try {
                return this.base64ToBlob(dataPart, mime);
            } catch (e) {
                return null;
            }
        }
        try {
            return new Blob([decodeURIComponent(dataPart)], { type: mime });
        } catch (e) {
            return null;
        }
    },

    // Blob → base64 data URL（OpenRouter 参考图输入用；含完整 data:...;base64, 前缀）
    blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    },

    async generateWithStabilityAI(positivePrompt, negativePrompt, imageSize, imageCount, config, charCaptions) {
        const scenePrompt = this._mergeCharCaptions(positivePrompt, charCaptions);
        // D5（2026-08-07 阶段4）：尺寸按 provider 合法枚举收口——SDXL 九档就近映射
        const snappedSize = this._snapSizeForProvider(imageSize, 'stabilityai', config.model);
        const [width, height] = snappedSize.split('x').map(Number);

        const results = [];
        for (let i = 0; i < imageCount; i++) {
            const response = await Utils._fetchWithTimeout(`${config.url}/v1/generation/${config.model}/text-to-image`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.key}`
                },
                body: JSON.stringify({
                    text_prompts: [
                        { text: scenePrompt, weight: 1 },
                        ...(negativePrompt ? [{ text: negativePrompt, weight: -1 }] : [])
                    ],
                    cfg_scale: 7,
                    height,
                    width,
                    samples: 1,
                    steps: 30
                })
            }, 600000);

            if (!response.ok) {
                // 反代/网关超时可能返回非 JSON 错误页（HTML 502 等），裸 .json() 会把真实错误吞成 SyntaxError
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            if (data.artifacts && data.artifacts[0]) {
                results.push(this.base64ToBlob(data.artifacts[0].base64, 'image/png'));
            }
        }

        return results;
    },

    async generateWithCustomAPI(positivePrompt, negativePrompt, imageSize, imageCount, config, charCaptions) {
        const scenePrompt = this._mergeCharCaptions(positivePrompt, charCaptions);
        const response = await Utils._fetchWithTimeout(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.key}`
            },
            body: JSON.stringify({
                prompt: scenePrompt,
                negative_prompt: negativePrompt,
                size: imageSize,
                n: imageCount,
                model: config.model
            })
        }, 600000);

        if (!response.ok) {
            throw new Error('Custom API request failed');
        }

        const data = await response.json();
        const urls = data.images || data.data?.map(img => img.url) || [];
        return Promise.all(urls.map(url => fetch(url).then(r => r.blob())));
    },

    base64ToBlob(base64, mimeType) {
        const binary = atob(base64);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
        }
        return new Blob([array], { type: mimeType });
    },

    // ===== NovelAI V4.5 =====
    // naiOverride（D4 2026-08-07 阶段3）：dispatchGenerate 解析出的板块绑定 NAI 快照；未传时退回自读全局
    // novelaiSettings，与传参化改造前逐字节一致——直接调用本函数（不经 dispatch）的旧路径不受影响。
    async generateWithNovelAI(positivePrompt, negativePrompt, imageSize, imageCount, config, charCaptions, naiOverride) {
        const nai = naiOverride || AppState.data.novelaiSettings || {};
        const apiKey = config.key;

        if (!apiKey) {
            throw new Error(I18n.t('pixiv_illust.err_no_nai_key', '请先配置 NovelAI API Key'));
        }

        const model = nai.model || 'nai-diffusion-4-5-full';
        // D5（2026-08-07 阶段4）：NAI 按板块分炉——调用方传了 imageSize（各板块的固定画幅/用户手选尺寸）就 snap 到
        // NAI 面板法定枚举（不再是 nai.resolution 一分辨率打天下）；未传 imageSize 时才回落 nai.resolution 兜底。
        const resolution = imageSize ? this._snapSizeForProvider(imageSize, 'novelai') : (nai.resolution || '1024x1024');
        const [width, height] = resolution.split('x').map(Number);
        const steps = nai.steps || 28;
        const cfgScale = nai.cfgScale || 5;
        const sampler = nai.sampler || 'k_euler_ancestral';
        const seed = (nai.seed != null && nai.seed !== -1) ? nai.seed : Math.floor(Math.random() * 9999999999);

        const defaultPositive = nai.defaultPositive || '';
        const defaultNegative = nai.defaultNegative || '';

        // charCaptions がある場合、各キャラの外見を改行区切りで base_caption に統合
        let charSection = '';
        if (charCaptions && charCaptions.length > 0) {
            charSection = charCaptions.map(c => `[${c}]`).join('\n');
        }
        const finalPositive = [positivePrompt, charSection, defaultPositive].filter(Boolean).join(', ');
        const finalNegative = [negativePrompt, defaultNegative].filter(Boolean).join(', ');

        const requestBody = {
            input: finalPositive,
            model,
            action: 'generate',
            parameters: {
                params_version: 3,
                width,
                height,
                scale: cfgScale,
                sampler,
                steps,
                seed,
                n_samples: 1,
                ucPreset: 1,
                qualityToggle: true,
                autoSmea: false,
                dynamic_thresholding: false,
                controlnet_strength: 1,
                legacy: false,
                add_original_image: true,
                cfg_rescale: 0,
                noise_schedule: 'karras',
                legacy_v3_extend: false,
                skip_cfg_above_sigma: null,
                use_coords: false,
                legacy_uc: false,
                normalize_reference_strength_multiple: true,
                inpaintImg2ImgStrength: 1,
                characterPrompts: [],
                v4_prompt: {
                    caption: {
                        base_caption: finalPositive,
                        char_captions: []
                    },
                    use_coords: false,
                    use_order: true
                },
                v4_negative_prompt: {
                    caption: { base_caption: finalNegative, char_captions: [] },
                    legacy_uc: false
                },
                negative_prompt: finalNegative,
                deliberate_euler_ancestral_bug: false,
                prefer_brownian: true
            }
        };

        let proxyUrl = (nai.proxyUrl || '').replace(/\/+$/, '');
        if (!proxyUrl) {
            throw new Error(I18n.t('pixiv_illust.err_no_nai_proxy', '请先在设置中配置 NovelAI 反代地址'));
        }
        const apiUrl = proxyUrl + '/ai/generate-image-stream';

        const results = [];
        const count = Math.min(imageCount, 4);

        for (let i = 0; i < count; i++) {
            if (i > 0) {
                requestBody.parameters.seed = Math.floor(Math.random() * 9999999999);
            }

            // D5（2026-08-07 阶段4）：600s 超时天花板——注意这只保证「拿到响应头」不超时，
            // NAI 走 SSE（text/event-stream）时 headers 到达通常远早于生成完成，真正的 body（下方
            // response.text()）读取不再受这个 AbortController 保护，详见任务报告的确认结果。
            const response = await Utils._fetchWithTimeout(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiKey
                },
                body: JSON.stringify(requestBody)
            }, 600000);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(I18n.t('pixiv_illust.err_nai_api', {status: response.status, text: errorText}));
            }

            const contentType = response.headers.get('content-type') || '';
            let imageBlob = null;

            // D5 补充（作者 review 2026-08-07）：SSE 的响应头远早于生成完成到达，_fetchWithTimeout 的
            // 计时器在拿到头时已清除——body 读取（真正的生成等待段）需要自己的超时护栏，否则反代卡流时永久挂起。
            // Promise.race 超时后 fetch 流会被放弃引用（无显式 abort），UI 侧走 catch 正常恢复。
            const readBody = (p) => {
                // 大review C5 修（2026-08-07）：成功路径即时清理计时器（此前会白挂最长 10 分钟才自然过期）
                let timer;
                const guard = new Promise((_, reject) => { timer = setTimeout(() =>
                    reject(new Error(I18n.t('pixiv_illust.err_nai_body_timeout', 'NovelAI 响应读取超时（10 分钟）'))), 600000); });
                return Promise.race([p, guard]).finally(() => clearTimeout(timer));
            };

            if (contentType.includes('text/event-stream')) {
                const text = await readBody(response.text());
                const lines = text.trim().split('\n');
                let base64Data = null;

                for (let j = lines.length - 1; j >= 0; j--) {
                    const line = lines[j].trim();
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        const dataContent = line.substring(6);
                        try {
                            const jsonData = JSON.parse(dataContent);
                            if (jsonData.event_type === 'final' && jsonData.image) {
                                base64Data = jsonData.image; break;
                            }
                            if (jsonData.data) { base64Data = jsonData.data; break; }
                            if (jsonData.image) { base64Data = jsonData.image; break; }
                        } catch (e) {
                            base64Data = dataContent; break;
                        }
                    }
                }

                if (!base64Data) {
                    throw new Error(I18n.t('pixiv_illust.err_nai_no_image', '无法从 NovelAI 响应中提取图片数据'));
                }

                const isPNG = base64Data.startsWith('iVBORw0KGgo');
                const isJPEG = base64Data.startsWith('/9j/');

                if (isPNG || isJPEG) {
                    imageBlob = this.base64ToBlob(base64Data, isPNG ? 'image/png' : 'image/jpeg');
                } else {
                    const zipBlob = this.base64ToBlob(base64Data, 'application/zip');
                    imageBlob = await this._extractImageFromZip(zipBlob);
                }
            } else {
                const zipBlob = await readBody(response.blob());
                imageBlob = await this._extractImageFromZip(zipBlob);
            }

            if (imageBlob) {
                results.push(imageBlob);
            }
        }

        return results;
    },

    async _extractImageFromZip(zipBlob) {
        // 按需注入本地 JSZip（不随启动加载，见 js/vendor/）
        try {
            await Utils.loadScriptOnce('js/vendor/jszip.min.js');
        } catch (e) { /* 加载失败走下方兜底 */ }
        if (typeof JSZip === 'undefined') {
            throw new Error(I18n.t('pixiv_illust.err_jszip_not_loaded', 'JSZip 库未加载，请重试'));
        }

        const zip = await JSZip.loadAsync(zipBlob);
        for (const filename in zip.files) {
            if (filename.match(/\.(png|jpg|jpeg|webp)$/i)) {
                return zip.files[filename].async('blob');
            }
        }

        if (zipBlob.type && zipBlob.type.startsWith('image/')) {
            return zipBlob;
        }

        throw new Error(I18n.t('pixiv_illust.err_no_image_in_zip', 'ZIP 文件中未找到图片'));
    },

    // ===== 收藏 =====
    async toggleFavorite(index) {
        const illustrations = AppState.data.pixivData.illustrations || [];
        if (!illustrations[index]) return;
        illustrations[index].isFavorite = !illustrations[index].isFavorite;
        Utils.saveData();
        Utils.showToast(illustrations[index].isFavorite ? I18n.t('t.pi_faved', '★ 已收藏') : I18n.t('t.pi_unfaved', '已取消收藏'));
        await this.render();
    },

    // ===== 查看 =====
    async viewImage(index) {
        const illustrations = AppState.data.pixivData.illustrations || [];
        const img = illustrations[index];
        if (!img) return;

        // 直接从 IDB 读 Blob 创建独立 ObjectURL（不经过 _urlCache），
        // 这样 render() 调用 revokeAll() 时不会撤销弹窗里正在显示的 URL
        const blob = await IllustGallery._getStore().getItem(img.id);
        if (!blob) { Utils.showToast(I18n.t('t.pi_no_image_data', '图片数据不存在')); return; }
        const modalUrl = URL.createObjectURL(blob);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active pixiv-illust-viewer';
        modal.style.zIndex = '10000';
        modal.innerHTML = `
            <div class="modal-window" style="max-width:90vw; max-height:90vh; padding:0; background:transparent; position:relative;">
                <img src="${modalUrl}" style="max-width:100%; max-height:80vh; border-radius:8px; display:block;" alt="Generated image">
                <div style="display:flex; gap:8px; padding:10px 0 0; justify-content:center;">
                    <button onclick="PixivIllust._shareIllustToForum('${img.id}')"
                        style="background:rgba(0,0,0,0.6); color:white; border:none; border-radius:20px; padding:6px 16px; font-size:13px; cursor:pointer;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1em;height:1em;vertical-align:-0.15em;margin-right:4px;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>${I18n.t('pixiv_illust.btn_share_forum', '分享到论坛')}
                    </button>
                </div>
                <button class="pixiv-illust-viewer-close" onclick="this.closest('.modal-overlay').remove()"
                    style="position:absolute; top:10px; right:10px; background:rgba(0,0,0,0.6); color:white; border:none; border-radius:50%; width:36px; height:36px; font-size:20px; cursor:pointer;">✕</button>
            </div>
        `;
        // 关闭时释放这个独立 URL
        const cleanup = () => URL.revokeObjectURL(modalUrl);
        modal._cleanup = cleanup; // 供分享流程关闭本查看器时复用，避免漏 revoke
        // 精确绑到 ✕ 关闭按钮：querySelector('button:last-child') 会按文档序命中
        // 「分享」按钮（它是其父 <div> 的唯一/最后子元素，且排在 ✕ 之前），导致点 ✕ 关闭时
        // 不触发 revoke → Blob 泄漏。用唯一 class 精确选 ✕ 按钮。
        modal.querySelector('.pixiv-illust-viewer-close').addEventListener('click', cleanup);
        modal.onclick = (e) => { if (e.target === modal) { cleanup(); modal.remove(); } };
        document.body.appendChild(modal);
    },

    // ===== 分享插画到论坛 =====
    // 按 id 而非数组下标查找：viewImage 弹窗打开期间若有后台生图完成，
    // 新图会 unshift 到数组头部导致下标漂移，改用 id 避免分享错图（与 IllustGallery 本就以 id 为键一致）
    async _shareIllustToForum(id) {
        const illustrations = AppState.data.pixivData.illustrations || [];
        const img = illustrations.find(i => i.id === id);
        if (!img) return;

        try {
            // 获取 Blob → base64 data URL（嵌入帖子 images 字段）
            const blob = await IllustGallery._getStore().getItem(img.id);
            if (!blob) { Utils.showToast(I18n.t('t.pi_no_image_data_cleared', '图片数据不存在，可能已被清理')); return; }

            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

            const forumData = AppState.data.forumData;
            if (!forumData.threads) forumData.threads = [];

            const prompt = img.prompt ? img.prompt.slice(0, 80) : '';
            const threadTitle = `【イラスト】${prompt || 'AI 生成イラスト'}`;

            forumData.threads.unshift({
                id: Utils.generateId(),
                title: threadTitle,
                content: `AI 生成イラスト\nプロンプト：${prompt || '（なし）'}\nProvider：${img.provider || '？'}\nSize：${img.size || '？'}`,
                author: '名無しさん',
                authorId: (typeof Forum !== 'undefined' && Forum.generateAnonId) ? Forum.generateAnonId() : Math.random().toString(36).substr(2, 8).toUpperCase(),
                timestamp: Date.now(),
                threadType: 'fan-art',
                replies: [],
                isUserThread: false,
                images: [{ data: dataUrl }]
            });

            Utils.saveData();
            // 只关闭插画查看器自己的 modal，不能用全局 querySelector('.modal-overlay')
            // ——index.html 里有 40+ 个静态 .modal-overlay（#summaryEditModal 等），
            // 全局选第一个会误删静态弹窗并永久销毁 DOM。
            const viewer = document.querySelector('.pixiv-illust-viewer');
            if (viewer) {
                if (typeof viewer._cleanup === 'function') viewer._cleanup();
                viewer.remove();
            }
            Utils.showToast(I18n.t('t.pi_shared_forum', '✓ 插画已分享到论坛'));
        } catch (e) {
            console.error('[PixivIllust] Share to forum failed:', e);
            Utils.showToast(I18n.t('t.pi_share_failed', '分享失败：') + e.message);
        }
    },

    // ===== 删除 =====
    async deleteImage(index) {
        if (!confirm(I18n.t('pixiv_illust.confirm_delete', '确定要删除这张插画吗？'))) return;
        const illustrations = AppState.data.pixivData.illustrations || [];
        const item = illustrations[index];
        if (item) await IllustGallery.remove(item.id);
        illustrations.splice(index, 1);
        Utils.saveData();
        await this.render();
        Utils.showToast(I18n.t('t.pi_deleted', '✓ 已删除'));
    },

    // ===== 旧数据迁移（base64 data URL → IDB Blob）=====
    async _migrateLegacy() {
        const illustrations = AppState.data.pixivData.illustrations || [];
        let changed = false;
        for (const img of illustrations) {
            if (img.url) {
                let migrated = false;
                try {
                    const res = await fetch(img.url);
                    const blob = await res.blob();
                    await IllustGallery.save(img.id, blob);
                    migrated = true;
                } catch (e) {
                    // URL 已失效（CDN URL 过期 / blob: URL 在新会话无效），跳过迁移保留 url 字段
                    console.warn('[PixivIllust] Legacy migration failed for', img.id, e.message);
                }
                // 只有成功迁移到 IDB 后才删除旧 url 字段，防止数据丢失
                if (migrated) {
                    delete img.url;
                    changed = true;
                }
            }
        }
        if (changed) Utils.saveData();
    }
};
