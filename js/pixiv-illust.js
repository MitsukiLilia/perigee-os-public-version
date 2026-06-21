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
                <img src="${urlMap[img.id] || ''}" alt="${img.prompt || 'Generated image'}">
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

        const isNovelAI = AppState.data.imageApiConfig?.provider === 'novelai';
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

    // 世界書からキャラ外見抽出（推特と同じロジック）
    _extractCharacterAppearance(desc) {
        const wbIds = Utils.getActiveWorldBookIds();
        if (wbIds.length === 0) return '';
        const matched = [];
        wbIds.forEach(wbId => {
            const book = (AppState.data.worldBooks || []).find(b => b.id === wbId);
            if (book && book.entries) {
                book.entries.filter(e => e.enabled !== false).forEach(e => {
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
        const charAppearance = this._extractCharacterAppearance(desc);

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
- Keep each section under 40 words`;

        const userMsg = `Description: ${desc}
${charAppearance ? `\nCharacter appearance database:\n${charAppearance}` : ''}

Generate image tags:`;

        try {
            const raw = await Utils.callChatAPI([{ role: 'user', content: userMsg }], systemPrompt);
            const result = raw.trim();

            const sceneMatch = result.match(/\[SCENE\]\s*(.+?)(?=\[CHAR|\n*$)/s);
            const charMatches = [...result.matchAll(/\[CHAR\d*\]\s*(.+?)(?=\[CHAR|\n*$)/gs)];

            if (sceneMatch && charMatches.length > 0) {
                const scene = sceneMatch[1].trim().replace(/\n/g, ', ');
                const chars = charMatches.map(m => m[1].trim().replace(/\n/g, ', '));
                return { positive: scene, negative: '', charCaptions: chars };
            }
            return { positive: result, negative: '', charCaptions: [] };
        } catch (e) {
            console.error('[PixivIllust AI] Prompt build failed:', e);
            return null;
        }
    },

    async generateImage() {
        const config = AppState.data.imageApiConfig;
        if (!config || !config.key) {
            Utils.showToast(I18n.t('t.pi_no_api', '⚠️ 请先在设置中配置图片生成API'));
            return;
        }

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
                const naiSettings = AppState.data.novelaiSettings || {};
                const imgSize = config.provider === 'novelai' ? (naiSettings.resolution || '1024x1024') : '1024x1024';

                let blobs = [];
                switch (config.provider) {
                    case 'openai':
                        blobs = await this.generateWithOpenAI(prompt.positive, prompt.negative, imgSize, 1, config);
                        break;
                    case 'gpt-image':
                        blobs = await this._gptImage(prompt.positive, prompt.negative, imgSize, 1, config);
                        break;
                    case 'openrouter':
                        blobs = await this.generateWithOpenRouter(prompt.positive, prompt.negative, imgSize, 1, config, prompt.charCaptions);
                        break;
                    case 'stabilityai':
                        blobs = await this.generateWithStabilityAI(prompt.positive, prompt.negative, imgSize, 1, config);
                        break;
                    case 'novelai':
                        blobs = await this.generateWithNovelAI(prompt.positive, prompt.negative, imgSize, 1, config, prompt.charCaptions);
                        break;
                    case 'midjourney':
                    case 'custom':
                        blobs = await this.generateWithCustomAPI(prompt.positive, prompt.negative, imgSize, 1, config);
                        break;
                }
                await this._saveAndRenderBlobs(blobs, prompt.positive, '', imgSize);
            } catch (error) {
                console.error('AI Image generation error:', error);
                Utils.showToast(I18n.t('t.pi_gen_failed', '❌ 生成失败: ') + error.message);
            }
            return;
        }

        // 手動モード
        const positivePrompt = document.getElementById('pixivIllustPositivePrompt').value.trim();
        if (!positivePrompt && config.provider !== 'novelai') {
            Utils.showToast(I18n.t('t.pi_need_positive', '⚠️ 请输入正向提示词'));
            return;
        }

        const negativePrompt = document.getElementById('pixivIllustNegativePrompt').value.trim();
        const imageSize = document.getElementById('pixivIllustImageSize').value;
        const imageCount = parseInt(document.getElementById('pixivIllustImageCount').value) || 1;

        document.getElementById('pixivIllustGenerateModal').classList.remove('active');
        Utils.showToast(I18n.t('t.pi_img_generating', '🎨 正在生成图片...'));

        try {
            let blobs = [];

            switch (config.provider) {
                case 'openai':
                    blobs = await this.generateWithOpenAI(positivePrompt, negativePrompt, imageSize, imageCount, config);
                    break;
                case 'gpt-image':
                    blobs = await this._gptImage(positivePrompt, negativePrompt, imageSize, imageCount, config);
                    break;
                case 'openrouter':
                    blobs = await this.generateWithOpenRouter(positivePrompt, negativePrompt, imageSize, imageCount, config);
                    break;
                case 'stabilityai':
                    blobs = await this.generateWithStabilityAI(positivePrompt, negativePrompt, imageSize, imageCount, config);
                    break;
                case 'novelai':
                    blobs = await this.generateWithNovelAI(positivePrompt, negativePrompt, imageSize, imageCount, config);
                    break;
                case 'midjourney':
                case 'custom':
                    blobs = await this.generateWithCustomAPI(positivePrompt, negativePrompt, imageSize, imageCount, config);
                    break;
                default:
                    throw new Error('Unsupported API provider');
            }

            await this._saveAndRenderBlobs(blobs, positivePrompt, negativePrompt, imageSize);
        } catch (error) {
            console.error('Image generation error:', error);
            Utils.showToast(I18n.t('t.pi_gen_failed', '❌ 生成失败: ') + error.message);
        }
    },

    async _saveAndRenderBlobs(blobs, prompt, negPrompt, size) {
        if (!blobs || blobs.length === 0) return;
        const config = AppState.data.imageApiConfig;
        if (!AppState.data.pixivData.illustrations) AppState.data.pixivData.illustrations = [];

        const newIllustrations = [];
        for (let i = 0; i < blobs.length; i++) {
            const id = 'illust_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            await IllustGallery.save(id, blobs[i]);
            newIllustrations.push({
                id, prompt, negativePrompt: negPrompt || '', size: size || '',
                provider: config.provider, createdAt: new Date().toISOString(), isFavorite: false
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

    // ===== 各提供商：统一返回 Blob[] =====

    async generateWithOpenAI(positivePrompt, negativePrompt, imageSize, imageCount, config) {
        const finalPrompt = negativePrompt ?
            `${positivePrompt} (avoid: ${negativePrompt})` :
            positivePrompt;

        const response = await fetch(`${config.url}/v1/images/generations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.key}`
            },
            body: JSON.stringify({
                model: config.model || 'dall-e-3',
                prompt: finalPrompt,
                n: imageCount,
                size: imageSize,
                quality: 'standard'
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API request failed');
        }

        const data = await response.json();
        // 立即 fetch CDN URL → Blob（CDN URL 约 1 小时后过期，必须在此刻获取）
        return Promise.all(data.data.map(img => fetch(img.url).then(r => r.blob())));
    },

    // GPT Image（gpt-image-2 等）：与 DALL-E 是两套格式，故独立成函数。
    // 关键差异：① 不发 quality（'standard' 是 DALL-E 专属值，gpt-image 只认 low/medium/high/auto，发了会报错）
    //          ② 返回 b64_json（gpt-image 不返回 CDN url），直接转 Blob，无需二次 fetch CDN（也就绕开了 CDN 跨域）
    //          ③ 不发 response_format / background（gpt-image 不支持这两个参数）
    async generateWithGptImage(positivePrompt, negativePrompt, imageSize, imageCount, config) {
        const finalPrompt = negativePrompt ?
            `${positivePrompt} (avoid: ${negativePrompt})` :
            positivePrompt;

        const response = await fetch(`${config.url}/v1/images/generations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.key}`
            },
            body: JSON.stringify({
                model: config.model || 'gpt-image-2',
                prompt: finalPrompt,
                n: imageCount,
                size: imageSize
            })
        });

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
    //          ③ 不发 input_fidelity（gpt-image-2 对输入图自动高保真，发了会报错）④ size 沿用各入口原值（gpt-image-2 接受任意满足约束的尺寸）
    //          ⑤ 返回同 generations：data[].b64_json → Blob（复用 base64ToBlob），下游零改
    async generateWithGptImageEdits(positivePrompt, negativePrompt, imageSize, imageCount, config, refBlobs) {
        const finalPrompt = negativePrompt ?
            `${positivePrompt} (avoid: ${negativePrompt})` :
            positivePrompt;

        const fd = new FormData();
        fd.append('model', config.model || 'gpt-image-2');
        fd.append('prompt', finalPrompt);
        fd.append('n', String(imageCount));
        fd.append('size', imageSize);
        refBlobs.forEach((blob, i) => {
            const ext = (blob.type && blob.type.indexOf('jpeg') !== -1) ? 'jpg' : 'png';
            fd.append('image[]', blob, `ref${i}.${ext}`);
        });

        const response = await fetch(`${config.url}/v1/images/edits`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${config.key}` },  // 不设 Content-Type：multipart boundary 交给浏览器
            body: fd
        });

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
    async _gptImage(positivePrompt, negativePrompt, imageSize, imageCount, config) {
        let refBlobs = [];
        try {
            if (typeof Broadcast !== 'undefined' && Broadcast.getCPRefImages) {
                refBlobs = await Broadcast.getCPRefImages();
            }
        } catch (e) {
            refBlobs = [];
        }
        return (refBlobs && refBlobs.length > 0)
            ? this.generateWithGptImageEdits(positivePrompt, negativePrompt, imageSize, imageCount, config, refBlobs)
            : this.generateWithGptImage(positivePrompt, negativePrompt, imageSize, imageCount, config);
    },

    // OpenRouter 生图：与 OpenAI Images API 是两套完全不同的协议，故独立成函数（绝不碰 NAI / DALL-E / gpt-image）。
    // 关键差异：① 走 chat completions（/chat/completions）+ modalities:['image','text']，不是 /v1/images/*
    //          ② CP 参考立绘作为多模态输入：messages content 里加 image_url（base64 data URL），不是 multipart image[]
    //          ③ 尺寸走 image_config.aspect_ratio（由像素 size 映射成最接近的受支持比例），不是像素串 size
    //          ④ 返回在 choices[0].message.images[].image_url.url（base64 data URL）→ 解析成 Blob
    //          ⑤ chat completions 无 n 参数 → imageCount>1 时并发多次请求各取首图
    // 默认模型 openai/gpt-5.4-image-2（OpenRouter 路由的 GPT Image 2，作者要的参考图人物一致性）；用户可在设置改任意 OpenRouter 生图模型（Gemini nano banana 等）。
    async generateWithOpenRouter(positivePrompt, negativePrompt, imageSize, imageCount, config, charCaptions) {
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
                const refBlobs = await Broadcast.getCPRefImages();
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

        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });
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

    async generateWithStabilityAI(positivePrompt, negativePrompt, imageSize, imageCount, config) {
        const [width, height] = imageSize.split('x').map(Number);

        const results = [];
        for (let i = 0; i < imageCount; i++) {
            const response = await fetch(`${config.url}/v1/generation/${config.model}/text-to-image`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.key}`
                },
                body: JSON.stringify({
                    text_prompts: [
                        { text: positivePrompt, weight: 1 },
                        ...(negativePrompt ? [{ text: negativePrompt, weight: -1 }] : [])
                    ],
                    cfg_scale: 7,
                    height,
                    width,
                    samples: 1,
                    steps: 30
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Stability AI request failed');
            }

            const data = await response.json();
            if (data.artifacts && data.artifacts[0]) {
                results.push(this.base64ToBlob(data.artifacts[0].base64, 'image/png'));
            }
        }

        return results;
    },

    async generateWithCustomAPI(positivePrompt, negativePrompt, imageSize, imageCount, config) {
        const response = await fetch(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.key}`
            },
            body: JSON.stringify({
                prompt: positivePrompt,
                negative_prompt: negativePrompt,
                size: imageSize,
                n: imageCount,
                model: config.model
            })
        });

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
    async generateWithNovelAI(positivePrompt, negativePrompt, imageSize, imageCount, config, charCaptions) {
        const nai = AppState.data.novelaiSettings || {};
        const apiKey = config.key;

        if (!apiKey) {
            throw new Error(I18n.t('pixiv_illust.err_no_nai_key', '请先配置 NovelAI API Key'));
        }

        const model = nai.model || 'nai-diffusion-4-5-full';
        const resolution = nai.resolution || imageSize || '1024x1024';
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

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiKey
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(I18n.t('pixiv_illust.err_nai_api', {status: response.status, text: errorText}));
            }

            const contentType = response.headers.get('content-type') || '';
            let imageBlob = null;

            if (contentType.includes('text/event-stream')) {
                const text = await response.text();
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
                const zipBlob = await response.blob();
                imageBlob = await this._extractImageFromZip(zipBlob);
            }

            if (imageBlob) {
                results.push(imageBlob);
            }
        }

        return results;
    },

    async _extractImageFromZip(zipBlob) {
        if (typeof JSZip === 'undefined') {
            throw new Error(I18n.t('pixiv_illust.err_jszip_not_loaded', 'JSZip 库未加载，请刷新页面重试'));
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
                    <button onclick="PixivIllust._shareIllustToForum(${index})"
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
    async _shareIllustToForum(index) {
        const illustrations = AppState.data.pixivData.illustrations || [];
        const img = illustrations[index];
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
