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
