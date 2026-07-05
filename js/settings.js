// 设置模块 - 包含API设置和系统配置功能

// 1. API 设置逻辑 (支持 OpenAI/Google/Claude/DeepSeek)
const APISettings = {
    init() {
        const config = AppState.data.apiConfig;

        // 填充 API 字段
        document.getElementById('apiMode').value = config.mode || 'openai';
        document.getElementById('apiUrl').value = config.url;
        document.getElementById('apiKey').value = config.key;
        document.getElementById('manualModel').value = config.model;
        document.getElementById('temperature').value = config.temperature;
        document.getElementById('tempValue').textContent = config.temperature;

        // 绑定事件
        document.getElementById('apiMode').onchange = this.onModeChange;
        document.getElementById('fetchModelsBtn').onclick = this.tryFetchModels;
        document.getElementById('temperature').oninput = (e) => document.getElementById('tempValue').textContent = e.target.value;
        document.querySelector('.save-api-btn').onclick = this.save;

        // 绑定预设事件
        document.getElementById('apiPresetSelect').onchange = this.applyPreset.bind(this);
        document.getElementById('saveApiPresetBtn').onclick = this.savePreset.bind(this);
        document.getElementById('deleteApiPresetBtn').onclick = this.deletePreset.bind(this);

        // 绑定生图模型获取事件
        document.getElementById('fetchImageModelsBtn').onclick = this.tryFetchImageModels.bind(this);

        // 加载预设
        this.loadPresets();

        // 初始化时根据模式设置UI
        this.updateUIForMode();
    },

    // 根据API模式更新UI和默认值
    // forceUrlReset: 手动切换 mode 时 true（强制预填该 provider 默认地址）；
    //   init 恢复已保存配置时 false（openrouter/pioneer 不覆盖用户改过的 URL）
    updateUIForMode(forceUrlReset = false) {
        const mode = document.getElementById('apiMode').value;
        const urlRow = document.getElementById('apiUrlRow');
        const urlInput = document.getElementById('apiUrl');
        const fetchBtn = document.getElementById('fetchModelsBtn');
        const keyInput = document.getElementById('apiKey');
        const modelInput = document.getElementById('manualModel');

        // 移除旧的提示（如果存在）
        const oldHint = urlRow.querySelector('.api-hint');
        if (oldHint) oldHint.remove();

        switch (mode) {
            case 'google':
                urlRow.style.display = ''; // 保持行可见
                urlInput.style.display = 'none'; // 只隐藏输入框
                urlInput.value = 'https://generativelanguage.googleapis.com';
                fetchBtn.style.display = '';
                fetchBtn.textContent = '获取模型';
                keyInput.placeholder = '输入 Google AI Studio API Key';
                modelInput.placeholder = 'gemini-1.5-pro / gemini-1.5-flash';

                // 添加提示
                const googleHint = document.createElement('p');
                googleHint.className = 'api-hint';
                googleHint.style.cssText = 'font-size:10px; color:#999; margin-top:4px; margin-bottom:0;';
                googleHint.textContent = '* 使用Google官方API，点击"获取模型"测试连接并加载可用模型';
                urlRow.appendChild(googleHint);
                break;

            case 'claude':
                urlRow.style.display = '';
                urlInput.style.display = 'none';
                urlInput.value = 'https://api.anthropic.com';
                fetchBtn.style.display = '';
                fetchBtn.textContent = '加载模型';
                keyInput.placeholder = '输入 Anthropic API Key';
                modelInput.placeholder = 'claude-3-5-sonnet-20241022';

                const claudeHint = document.createElement('p');
                claudeHint.className = 'api-hint';
                claudeHint.style.cssText = 'font-size:10px; color:#999; margin-top:4px; margin-bottom:0;';
                claudeHint.textContent = '* 使用Claude官方API，点击"加载模型"查看预设模型列表';
                urlRow.appendChild(claudeHint);
                break;

            case 'deepseek':
                urlRow.style.display = '';
                urlInput.style.display = 'none';
                urlInput.value = 'https://api.deepseek.com';
                fetchBtn.style.display = '';
                fetchBtn.textContent = '获取模型';
                keyInput.placeholder = '输入 DeepSeek API Key';
                modelInput.placeholder = '点击下方「获取模型」自动拉取';

                const deepseekHint = document.createElement('p');
                deepseekHint.className = 'api-hint';
                deepseekHint.style.cssText = 'font-size:10px; color:#999; margin-top:4px; margin-bottom:0;';
                deepseekHint.textContent = '* 使用 DeepSeek 官方 API、模型名升级时无需改代码、点击「获取模型」自动拉最新';
                urlRow.appendChild(deepseekHint);
                break;

            case 'openrouter':
                // OpenRouter 文字聚合站：OpenAI 兼容，URL 可见+预填，可微调
                urlRow.style.display = '';
                urlInput.style.display = '';
                if (forceUrlReset || !urlInput.value) urlInput.value = 'https://openrouter.ai/api/v1';
                fetchBtn.style.display = '';
                fetchBtn.textContent = '获取模型';
                keyInput.placeholder = '输入 OpenRouter API Key (sk-or-...)';
                modelInput.placeholder = '点击「获取模型」自动拉取';

                const orHint = document.createElement('p');
                orHint.className = 'api-hint';
                orHint.style.cssText = 'font-size:10px; color:#999; margin-top:4px; margin-bottom:0;';
                orHint.textContent = '* OpenRouter 文字模型聚合站、OpenAI 兼容，点「获取模型」自动拉取最新';
                urlRow.appendChild(orHint);
                break;

            case 'pioneer':
                // Pioneer 官方中转站：OpenAI 兼容，URL 可见+预填，可微调；鉴权双发 Bearer + X-API-Key
                urlRow.style.display = '';
                urlInput.style.display = '';
                if (forceUrlReset || !urlInput.value) urlInput.value = 'https://api.pioneer.ai/v1';
                fetchBtn.style.display = '';
                fetchBtn.textContent = '获取模型';
                keyInput.placeholder = '输入 Pioneer API Key';
                modelInput.placeholder = '点击「获取模型」自动拉取';

                const pioneerHint = document.createElement('p');
                pioneerHint.className = 'api-hint';
                pioneerHint.style.cssText = 'font-size:10px; color:#999; margin-top:4px; margin-bottom:0;';
                pioneerHint.textContent = '* Pioneer 官方中转站、OpenAI 兼容，点「获取模型」自动拉取最新';
                urlRow.appendChild(pioneerHint);
                break;

            case 'openai':
            default:
                urlRow.style.display = '';
                urlInput.style.display = '';
                fetchBtn.style.display = '';
                fetchBtn.textContent = 'Fetch';
                keyInput.placeholder = '输入 API Key (sk-...)';
                modelInput.placeholder = 'gpt-4o / gpt-3.5-turbo';
                break;
        }
    },

    onModeChange() {
        APISettings.updateUIForMode(true);
    },

    // 尝试拉取模型列表 (支持 OpenAI/Google/Claude/DeepSeek)
    async tryFetchModels() {
        let url = document.getElementById('apiUrl').value.trim();
        const key = document.getElementById('apiKey').value.trim();
        const mode = document.getElementById('apiMode').value;
        const btn = document.getElementById('fetchModelsBtn');
        const select = document.getElementById('modelSelect');
        const manualInput = document.getElementById('manualModel');

        if (!key) return alert('请先输入 API Key');

        // 自动清理 URL 末尾的斜杠
        while (url.endsWith('/')) url = url.slice(0, -1);

        // 保存当前选中的模型（用于恢复）
        const currentSelectedModel = select.value || manualInput.value;

        btn.textContent = '⏳';
        btn.disabled = true;
        btn.classList.add('loading');

        let success = false;
        let models = [];
        let correctBaseUrl = '';
        let lastError = null;

        try {
            if (mode === 'google') {
                // Google AI Studio API
                console.log('[API Test] Trying Google AI Studio API');
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);

                if (res.ok) {
                    const data = await res.json();
                    console.log('[API Test] Google Response:', data);

                    if (data.models && Array.isArray(data.models)) {
                        models = data.models
                            .filter(m => m.name && m.name.includes('gemini'))
                            .map(m => m.name.replace('models/', ''));
                        success = true;
                        correctBaseUrl = 'https://generativelanguage.googleapis.com';
                        console.log(`[API Test] ✓ Found ${models.length} Google models`);
                    }
                } else {
                    lastError = `HTTP ${res.status}`;
                }
            } else if (mode === 'claude') {
                // Claude API - 手动提供模型列表（Claude API不提供模型列表接口）
                console.log('[API Test] Using Claude predefined models');
                models = [
                    'claude-opus-4-5-20251101',
                    'claude-sonnet-4-5-20250929',
                    'claude-sonnet-3-5-20241022',
                    'claude-3-5-sonnet-20240620',
                    'claude-3-opus-20240229',
                    'claude-3-sonnet-20240229',
                    'claude-3-haiku-20240307'
                ];
                success = true;
                correctBaseUrl = url || 'https://api.anthropic.com';
                console.log('[API Test] ✓ Loaded Claude model list');
            } else {
                // OpenAI 兼容 API（包括 DeepSeek）
                if (!url) return alert('请先输入 API 地址');

                // 移除可能的 /chat/completions 或 /completions 后缀
                url = url.replace(/\/(chat\/)?completions?$/i, '');

                // 鉴权头：标准 Bearer；Pioneer 文档示例用 X-API-Key，双发兜底（服务器取其一）
                const fetchHeaders = {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json'
                };
                if (mode === 'pioneer') fetchHeaders['X-API-Key'] = key;

                // 尝试多种endpoint格式
                const endpointsToTry = [
                    { url: `${url}/v1/models`, base: `${url}/v1` },
                    { url: `${url}/models`, base: url },
                    { url: `${url.replace(/\/v1$/, '')}/v1/models`, base: `${url.replace(/\/v1$/, '')}/v1` },
                    { url: `${url}/api/v1/models`, base: `${url}/api/v1` }
                ];

                for (const endpoint of endpointsToTry) {
                    try {
                        console.log(`[API Test] Trying: ${endpoint.url}`);
                        const res = await fetch(endpoint.url, {
                            method: 'GET',
                            headers: fetchHeaders
                        });

                        if (res.ok) {
                            const data = await res.json();
                            console.log('[API Test] Response:', data);

                            if (data.data && Array.isArray(data.data)) {
                                models = data.data.map(m => typeof m === 'string' ? m : m.id).filter(Boolean);
                                success = true;
                                correctBaseUrl = endpoint.base;
                                console.log(`[API Test] ✓ Found ${models.length} models`);
                                break;
                            }
                        } else {
                            lastError = `HTTP ${res.status}`;
                        }
                    } catch (e) {
                        console.warn(`[API Test] Failed for ${endpoint.url}:`, e.message);
                        lastError = e.message;
                    }
                }
            }

        } catch (e) {
            console.error('[API Test] Error:', e);
            lastError = e.message;
        }

        btn.textContent = 'Fetch';
        btn.disabled = false;
        btn.classList.remove('loading');

        if (success && models.length > 0) {
            // 排序模型列表
            models.sort();

            // 填充下拉列表
            select.innerHTML = '';
            models.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m;
                select.appendChild(opt);
            });

            // 绑定选择事件
            select.onchange = () => {
                const selectedModel = select.value;
                manualInput.value = selectedModel;
            };

            // 智能恢复之前的选择
            if (currentSelectedModel && models.includes(currentSelectedModel)) {
                select.value = currentSelectedModel;
                manualInput.value = currentSelectedModel;
            } else if (AppState.data.apiConfig.model && models.includes(AppState.data.apiConfig.model)) {
                select.value = AppState.data.apiConfig.model;
                manualInput.value = AppState.data.apiConfig.model;
            } else if (models.length > 0) {
                select.value = models[0];
                manualInput.value = models[0];
            }

            // 更新URL（仅对非预定义列表）
            if (correctBaseUrl && mode !== 'claude') {
                document.getElementById('apiUrl').value = correctBaseUrl;
            }

            const modeNames = { 'google': 'Google', 'claude': 'Claude', 'openai': 'OpenAI', 'deepseek': 'DeepSeek', 'openrouter': 'OpenRouter', 'pioneer': 'Pioneer' };
            const modeName = modeNames[mode] || 'API';
            alert(`✓ 成功获取 ${models.length} 个 ${modeName} 模型！${correctBaseUrl && mode !== 'claude' ? `\n基础 URL 已自动更新为: ${correctBaseUrl}` : ''}\n\n请在下拉菜单选择模型，或手动输入模型 ID。`);
        } else {
            select.innerHTML = '<option value="">拉取失败</option>';

            let errorMsg = `✗ 获取失败\n\n`;
            if (lastError) {
                errorMsg += `错误信息: ${lastError}\n\n`;
            }
            errorMsg += `可能的原因：\n1. API Key 错误或已过期\n2. API 地址格式不正确（${mode === 'google' || mode === 'claude' ? '此模式可能不需要URL' : '需要完整URL'}）\n3. 网络连接问题\n4. API 服务暂时不可用\n\n建议：\n• 检查 API Key 是否正确\n• ${mode === 'google' ? 'Google AI Studio 会自动使用官方地址' : mode === 'claude' ? 'Claude API 会使用官方地址，可手动输入模型ID' : '确保 URL 格式为: https://api.xxx.com'}\n• 查看浏览器控制台获取详细错误信息\n• 或直接手动输入模型 ID`;

            alert(errorMsg);
        }
    },

    save() {
        // 保存 API
        let url = document.getElementById('apiUrl').value.trim();
        while (url.endsWith('/')) url = url.slice(0, -1);

        // 清理可能的 /chat/completions 后缀
        url = url.replace(/\/(chat\/)?completions?$/i, '');

        AppState.data.apiConfig = {
            mode: document.getElementById('apiMode').value,
            url: url,
            key: document.getElementById('apiKey').value.trim(),
            model: document.getElementById('manualModel').value.trim() || 'gpt-3.5-turbo',
            temperature: parseFloat(document.getElementById('temperature').value)
        };

        Utils.saveData();
        alert('✓ 配置已保存');
    },

    // ===== 2. API 预设管理 =====
    loadPresets() {
        const presets = AppState.data.apiPresets || [];
        const select = document.getElementById('apiPresetSelect');

        // 保留默认提示项
        select.innerHTML = '<option value="">-- 选择预设 --</option>';

        presets.forEach((p, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            opt.textContent = p.name;
            select.appendChild(opt);
        });
    },

    savePreset() {
        const name = prompt('请输入预设名称 (例如: DeepSeek)');
        if (!name) return;

        let url = document.getElementById('apiUrl').value.trim();
        while (url.endsWith('/')) url = url.slice(0, -1);
        url = url.replace(/\/(chat\/)?completions?$/i, '');

        const preset = {
            name: name,
            mode: document.getElementById('apiMode').value,
            url: url,
            key: document.getElementById('apiKey').value.trim(),
            model: document.getElementById('manualModel').value.trim() || 'gpt-3.5-turbo',
            temperature: parseFloat(document.getElementById('temperature').value)
        };

        if (!AppState.data.apiPresets) AppState.data.apiPresets = [];

        // 检查是否覆盖
        const existingIdx = AppState.data.apiPresets.findIndex(p => p.name === name);
        if (existingIdx >= 0) {
            if (!confirm(`预设 "${name}" 已存在，是否覆盖？`)) return;
            AppState.data.apiPresets[existingIdx] = preset;
        } else {
            AppState.data.apiPresets.push(preset);
        }

        Utils.saveData();
        this.loadPresets();
        // 选中刚保存的
        const newIdx = AppState.data.apiPresets.findIndex(p => p.name === name);
        document.getElementById('apiPresetSelect').value = newIdx;

        Utils.showToast(I18n.t('t.set_preset_saved', '预设已保存'));
    },

    deletePreset() {
        const select = document.getElementById('apiPresetSelect');
        const idx = select.value;

        if (idx === '') {
            return alert('请先选择一个预设');
        }

        if (!confirm('确定要删除此预设吗？')) return;

        AppState.data.apiPresets.splice(idx, 1);
        Utils.saveData();
        this.loadPresets();
        select.value = '';
        Utils.showToast(I18n.t('t.set_preset_deleted', '预设已删除'));
    },

    applyPreset() {
        const idx = document.getElementById('apiPresetSelect').value;
        if (idx === '') return;

        const preset = AppState.data.apiPresets[idx];
        if (!preset) return;

        document.getElementById('apiMode').value = preset.mode || 'openai';
        document.getElementById('apiUrl').value = preset.url || '';
        document.getElementById('apiKey').value = preset.key || '';
        document.getElementById('manualModel').value = preset.model || '';
        document.getElementById('temperature').value = Utils._num(preset.temperature, 0.7);
        document.getElementById('tempValue').textContent = Utils._num(preset.temperature, 0.7);

        this.updateUIForMode();
        Utils.showToast(I18n.t('t.set_preset_loaded', {name: preset.name}));
    },

    // ===== 3. 图片生成模型获取 =====
    async tryFetchImageModels() {
        const provider = document.getElementById('imageApiProvider').value;
        const key = document.getElementById('imageApiKey').value.trim();
        let url = document.getElementById('imageApiUrl').value.trim();
        const btn = document.getElementById('fetchImageModelsBtn');
        const select = document.getElementById('imageModelSelect');
        const input = document.getElementById('imageApiModel');

        if (!key) return alert('请先输入 API Key');

        // 仅OpenAI兼容接口支持标准模型列表拉取
        // Midjourney/Stability通常没有标准化列表接口，或者格式不同
        // 这里主要支持OpenAI和兼容OpenAI的生图服务

        if (provider === 'openai' || provider === 'gpt-image') {
            url = 'https://api.openai.com/v1'; // 强制官方地址
        } else if (provider === 'openrouter') {
            if (!url) url = 'https://openrouter.ai/api/v1'; // OpenRouter 官方地址兜底（用户没填时）
        } else if (!url) {
            return alert('请输入完整的 API URL');
        }

        // 清理URL
        while (url.endsWith('/')) url = url.slice(0, -1);
        // 移除 /images/generations 等后缀
        url = url.replace(/\/images\/generations?$/, '');
        // OpenRouter 等用户可能填完整 chat 端点，去掉后缀避免 Fetch 拼出 .../chat/completions/v1/models
        url = url.replace(/\/(chat\/)?completions$/i, '');
        // 移除 /v1 (如果Fetch会自动加上)
        // 但通常 /v1/models 是标准
        // 简单处理：尝试访问 ${url}/models 或 ${url}/v1/models

        btn.textContent = '⏳';
        btn.disabled = true;

        let models = [];
        let errorMsg = '';

        try {
            // 尝试直接访问 /models
            // OpenAI标准: GET /v1/models
            let fetchUrl = url.endsWith('/v1') ? `${url}/models` : `${url}/v1/models`;

            // 如果是自定义，可能用户已经填了完整路径
            if (provider === 'custom' && !url.includes('/v1')) {
                // 尝试猜测
                fetchUrl = `${url}/models`;
            }

            console.log('[Image API] Fetching models from:', fetchUrl);
            const res = await fetch(fetchUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${key}`
                }
            });

            if (res.ok) {
                const data = await res.json();
                if (data.data && Array.isArray(data.data)) {
                    // 过滤可能的生图模型 (通过id判断，或者全部列出)
                    // OpenAI也会返回gpt模型，这里简单全部列出，让用户选
                    models = data.data.map(m => m.id).sort();
                } else if (Array.isArray(data)) {
                    // 兼容某些非标接口
                    models = data.map(m => m.id || m).sort();
                }
            } else {
                errorMsg = `错误 ${res.status}`;
            }

        } catch (e) {
            console.error(e);
            errorMsg = e.message;
        }

        btn.textContent = 'Fetch';
        btn.disabled = false;

        if (models.length > 0) {
            // 填充自定义下拉 select（iOS 原生 datalist 弹不出，改用 select；点 input 右侧 ▼ 选）
            if (select) {
                select.innerHTML = '';
                const ph = document.createElement('option');
                ph.value = '';
                ph.textContent = `— 已拉取 ${models.length} 个，点选 —`;
                select.appendChild(ph);
                models.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m;
                    opt.textContent = m;
                    select.appendChild(opt);
                });
                // 回填当前 input 已有的模型（若在列表中），方便看到当前选中
                const prev = input.value.trim();
                if (prev && models.includes(prev)) select.value = prev;
            }
            alert(`✓ 成功获取 ${models.length} 个模型！\n点输入框右侧 ▼ 选择，或手动输入。`);
        } else {
            alert(`获取失败: ${errorMsg || '未找到兼容的模型列表'}\n\n请手动输入模型名称。`);
        }
    }
};

// 2. 系统配置模块
const SystemConfig = {
    THEMES: ['sakura', 'night-sky', 'summer-rain', 'journal', 'minimal', 'zelda', 'animal', 'strawberry', 'snow-country'],
    FONTS: ['cjk-serif', 'jp-mincho', 'sans', 'mono', 'system'],

    // 老 → 新主题映射（静默迁移）
    _LEGACY_THEME_MAP: {
        'winter-night': 'night-sky',
        'spring-day': 'sakura'
    },
    // 老 activePreset → 新主题映射
    _LEGACY_PRESET_MAP: {
        'collage': 'sakura',
        'journal': 'journal',
        'minimal': 'minimal'
    },

    init() {
        // 加载系统配置（默认主题改为 sakura，温暖系欢迎新用户）
        if (!AppState.data.systemConfig) {
            AppState.data.systemConfig = {
                language: 'zh',
                theme: 'sakura',
                fontFamily: 'sans',
                wallpaper: '',
                bgTexture: 'none',
                customTheme: '',
                rainEffect: true,
                starfieldEffect: true,
                snowEffect: true,
                glassQuality: 'auto'
            };
        }
        const cfg = AppState.data.systemConfig;

        // ── 数据迁移（一次性、静默） ──
        // 老 theme 名 → 新主题
        if (cfg.theme && this._LEGACY_THEME_MAP[cfg.theme]) {
            cfg.theme = this._LEGACY_THEME_MAP[cfg.theme];
        }
        // activePreset 升级到 theme（journal/minimal 直接收编，collage 映射到 sakura）
        if (cfg.activePreset) {
            const mapped = this._LEGACY_PRESET_MAP[cfg.activePreset];
            if (mapped) cfg.theme = mapped;
            // collage 是用注入 CSS 实现的，新版有原生对应，删掉旧注入
            if (cfg.activePreset === 'collage' || cfg.activePreset === 'journal' || cfg.activePreset === 'minimal') {
                cfg.customTheme = '';
            }
            delete cfg.activePreset;
        }
        // userThemes 数组废弃：保留最后一个 CSS 到 customTheme（如为空）
        if (Array.isArray(cfg.userThemes) && cfg.userThemes.length > 0) {
            if (!cfg.customTheme) {
                const last = cfg.userThemes[cfg.userThemes.length - 1];
                if (last && last.css) cfg.customTheme = last.css;
            }
            delete cfg.userThemes;
        }

        // 推荐字体从「中日明朝」改为「清爽黑体」：旧默认 cjk-serif 在 iPhone 上没装思源宋体、
        // 会退到ヒラギノ明朝渲染中文 → 粗细不一。一次性把仍停留在旧默认的用户迁到 sans。
        // 设标记后即使用户之后又手动选回明朝也不会被再次迁移。
        if (!cfg._fontRecMigrated) {
            if (cfg.fontFamily === 'cjk-serif') cfg.fontFamily = 'sans';
            cfg._fontRecMigrated = true;
        }

        // 字段兜底
        if (!cfg.theme || !this.THEMES.includes(cfg.theme)) cfg.theme = 'sakura';
        if (!cfg.fontFamily || !this.FONTS.includes(cfg.fontFamily)) cfg.fontFamily = 'sans';
        if (cfg.bgTexture === undefined) cfg.bgTexture = 'none';
        if (cfg.customTheme === undefined) cfg.customTheme = '';
        if (cfg.rainEffect === undefined) cfg.rainEffect = true;
        if (cfg.starfieldEffect === undefined) cfg.starfieldEffect = true;
        if (cfg.snowEffect === undefined) cfg.snowEffect = true;
        if (cfg.glassQuality === undefined) cfg.glassQuality = 'auto';
        if (cfg.showDockLabels === undefined) cfg.showDockLabels = true;
        if (!cfg.language) cfg.language = 'zh';

        // 应用所有视觉设定
        this.applyTheme(cfg.theme);
        this.applyFont(cfg.fontFamily);
        if (cfg.wallpaper) this.applyWallpaper(cfg.wallpaper);
        this.applyTexture(cfg.bgTexture);
        this.applyCustomTheme(cfg.customTheme);
        this.applyRainEffect(cfg.rainEffect);
        this.applyStarfieldEffect(cfg.starfieldEffect);
        this.applySnowEffect(cfg.snowEffect);
        this.applyGlassQuality(cfg.glassQuality);

        // 表单值
        const langSel = document.getElementById('systemLanguage');
        if (langSel) langSel.value = cfg.language;
        const wpIn = document.getElementById('systemWallpaper');
        if (wpIn) wpIn.value = cfg.wallpaper || '';
        // 动态特效开关：按当前主题显示对应开关 + 回填态（夏雨=雨 / 夜空=星空 / 其他主题=隐藏整行）
        this._updateThemeEffectRow();
        this._updateGlassQualityRow();
        const dockLabelsToggle = document.getElementById('dockLabelsToggle');
        if (dockLabelsToggle) dockLabelsToggle.checked = cfg.showDockLabels !== false;
        this._syncTexturePicker(cfg.bgTexture);
        this._syncThemeHighlight(cfg.theme);
        this._syncFontHighlight(cfg.fontFamily);

        // 自定义 CSS textarea
        const ta = document.getElementById('customThemeCss');
        if (ta) ta.value = cfg.customTheme || '';

        // 绑定交互
        this._bindThemeCards();
        this._bindFontCards();
        this._bindTexturePicker();
        this._bindCustomCssButtons();

        // 持久化迁移结果
        Utils.saveData();

        // 启动实时时间和电量更新
        this.startRealtimeUpdates();
    },

    _bindThemeCards() {
        const grid = document.getElementById('themeGrid');
        if (!grid || grid._bound) return;
        grid._bound = true;
        grid.addEventListener('click', e => {
            const card = e.target.closest('.theme-card');
            if (!card) return;
            const id = card.dataset.themeId;
            if (!id || !this.THEMES.includes(id)) return;
            this.applyTheme(id);
            AppState.data.systemConfig.theme = id;
            Utils.saveData();
            this._syncThemeHighlight(id);
        });
    },

    _bindFontCards() {
        const grid = document.getElementById('fontGrid');
        if (!grid || grid._bound) return;
        grid._bound = true;
        grid.addEventListener('click', e => {
            const card = e.target.closest('.font-card');
            if (!card) return;
            const id = card.dataset.fontId;
            if (!id || !this.FONTS.includes(id)) return;
            this.applyFont(id);
            AppState.data.systemConfig.fontFamily = id;
            Utils.saveData();
            this._syncFontHighlight(id);
        });
    },

    _bindCustomCssButtons() {
        const apply = document.getElementById('applyCustomCssBtn');
        if (apply && !apply._bound) { apply._bound = true; apply.onclick = () => this.applyCurrentCustomCss(); }
        const reset = document.getElementById('resetCustomCssBtn');
        if (reset && !reset._bound) { reset._bound = true; reset.onclick = () => this.resetCustomCss(); }
        const copy = document.getElementById('copyCssTemplateBtn');
        if (copy && !copy._bound) { copy._bound = true; copy.onclick = () => this.copyCssTemplate(); }
        // 切换语言下拉立即生效
        const langSel = document.getElementById('systemLanguage');
        if (langSel && !langSel._bound) {
            langSel._bound = true;
            langSel.onchange = () => {
                const lang = langSel.value;
                AppState.data.systemConfig.language = lang;
                if (typeof I18n !== 'undefined') I18n.setLanguage(lang);
                Utils.saveData();
            };
        }
    },

    _syncThemeHighlight(themeId) {
        document.querySelectorAll('#themeGrid .theme-card').forEach(c => {
            c.classList.toggle('is-active', c.dataset.themeId === themeId);
        });
    },

    _syncFontHighlight(fontId) {
        document.querySelectorAll('#fontGrid .font-card').forEach(c => {
            c.classList.toggle('is-active', c.dataset.fontId === fontId);
        });
    },

    // 纹理选择器：高亮当前 + 绑定点击切换
    _syncTexturePicker(texture) {
        const picker = document.getElementById('systemTexturePicker');
        if (!picker) return;
        picker.dataset.selected = texture || 'none';
        picker.querySelectorAll('.texture-tile').forEach(tile => {
            tile.classList.toggle('is-active', tile.dataset.texture === (texture || 'none'));
        });
    },
    _bindTexturePicker() {
        const picker = document.getElementById('systemTexturePicker');
        if (!picker || picker._bound) return;
        picker._bound = true;
        picker.addEventListener('click', e => {
            const tile = e.target.closest('.texture-tile');
            if (!tile) return;
            const tex = tile.dataset.texture || 'none';
            this._syncTexturePicker(tex);
            this.applyTexture(tex);
            AppState.data.systemConfig.bgTexture = tex;
            Utils.saveData();
        });
    },

    refreshClocks() {
        const now = new Date();

        // 状态栏时间（24小时制，iOS 风格固定）
        const statusTime = document.querySelector('.status-bar .time');
        if (statusTime) {
            statusTime.textContent = now.toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', hour12: false
            });
        }

        // 桌面时钟小组件（可能多个，按各自的 12/24 制刷新）
        const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const weekdayStr = now.toLocaleDateString('en-US', { weekday: 'long' });
        document.querySelectorAll('.widget-clock').forEach(card => {
            const f24 = card.dataset.clockFormat === '24';
            const timeEl = card.querySelector('[data-clock-time]');
            if (timeEl) {
                timeEl.textContent = now.toLocaleTimeString('en-US', {
                    hour: '2-digit', minute: '2-digit', hour12: !f24
                });
            }
            const dateEl = card.querySelector('[data-clock-date]');
            if (dateEl) dateEl.textContent = dateStr;
            const weekdayEl = card.querySelector('[data-clock-weekday]');
            if (weekdayEl) weekdayEl.textContent = weekdayStr;
        });
    },

    startRealtimeUpdates() {
        const updateTime = () => this.refreshClocks();

        // 更新电量显示
        const updateBattery = async () => {
            if ('getBattery' in navigator) {
                try {
                    const battery = await navigator.getBattery();
                    const batteryIcon = document.querySelector('.status-icons span:last-child');
                    if (batteryIcon) {
                        const level = Math.round(battery.level * 100);
                        batteryIcon.textContent = `${level}%`;
                    }

                    // 监听电量变化
                    battery.addEventListener('levelchange', () => {
                        const batteryIcon = document.querySelector('.status-icons span:last-child');
                        if (batteryIcon) {
                            const level = Math.round(battery.level * 100);
                            batteryIcon.textContent = `${level}%`;
                        }
                    });
                } catch (e) {
                    // Battery API not supported
                }
            }
        };

        // 立即更新一次
        updateTime();
        updateBattery();

        // 每秒更新时间
        setInterval(updateTime, 1000);
    },

    applyTheme(theme) {
        // 5 个主题都用 data-theme 属性（统一逻辑，no special cases）
        if (theme && this.THEMES.includes(theme)) {
            document.documentElement.setAttribute('data-theme', theme);
        } else {
            document.documentElement.setAttribute('data-theme', 'sakura');
        }
        // 主题专属图标（applyTheme 只改属性、不重渲染图标，这里主动刷新一次）
        if (typeof ConstellationIcons !== 'undefined') ConstellationIcons.apply();
        if (typeof JournalIcons !== 'undefined') JournalIcons.apply();
        if (typeof StrawberryIcons !== 'undefined') StrawberryIcons.apply();
        if (typeof SnowIcons !== 'undefined') SnowIcons.apply();
        // 切主题后更新「动态特效开关」行（按当前主题显示对应开关 / 隐藏）
        if (typeof this._updateThemeEffectRow === 'function') this._updateThemeEffectRow();
        if (typeof this._updateGlassQualityRow === 'function') this._updateGlassQualityRow();
    },

    applyFont(font) {
        // cjk-serif = :root 默认值，无需 attribute；其他设 data-font
        if (font && font !== 'cjk-serif' && this.FONTS.includes(font)) {
            document.documentElement.setAttribute('data-font', font);
        } else {
            document.documentElement.removeAttribute('data-font');
        }
    },

    applyWallpaper(wallpaperUrl) {
        const desktop = document.getElementById('desktop');
        if (wallpaperUrl) {
            // 使用自定义壁纸
            desktop.style.backgroundImage = `url('${wallpaperUrl}')`;
            desktop.style.backgroundSize = 'cover';
            desktop.style.backgroundPosition = 'center';
            desktop.classList.add('has-custom-wallpaper');
        } else {
            // 清除自定义样式，让CSS变量 --wallpaper-gradient 生效
            desktop.style.backgroundImage = '';
            desktop.style.background = '';
            desktop.classList.remove('has-custom-wallpaper');
        }
    },

    // 雨效果开关（仅夏雨主题有雨；关闭只去雨、背景图 + 玻璃质感保留）
    // body.rain-off 保留作 CSS 兜底；真雨由 canvas 引擎（RainEngine）画、它据此暂停
    applyRainEffect(enabled) {
        document.body.classList.toggle('rain-off', !enabled);
        if (window.RainEngine) RainEngine.setEnabled(enabled);
        if (window.GlassRainEngine) GlassRainEngine.setEnabled(enabled);
    },

    // 星空动态开关（仅夜空主题；关闭只去动画，背景图 + 玻璃质感 + 星座图标保留）
    applyStarfieldEffect(enabled) {
        document.body.classList.toggle('starfield-off', !enabled);
        if (window.StarfieldEngine) StarfieldEngine.setEnabled(enabled);
    },

    // 飘雪动态开关（仅雪国主题；关闭只去飘雪，背景图 + 冰磨砂图标保留）
    applySnowEffect(enabled) {
        document.body.classList.toggle('snow-off', !enabled);
        if (window.SnowEngine) SnowEngine.setEnabled(enabled);
        if (window.SnowEngine2D) SnowEngine2D.setEnabled(enabled);
    },

    // 玻璃质量（仅夏雨 + 支持折射时有意义）：'auto' | 'high' | 'off' → LiquidGlass.setQuality
    applyGlassQuality(level) {
        const lv = (level === 'high' || level === 'off') ? level : 'auto';
        if (typeof LiquidGlass !== 'undefined') LiquidGlass.setQuality(lv);
    },
    onGlassQualityChange(level) {
        const cfg = AppState.data.systemConfig || (AppState.data.systemConfig = {});
        cfg.glassQuality = (level === 'high' || level === 'off') ? level : 'auto';
        this.applyGlassQuality(cfg.glassQuality);
        Utils.saveData();
    },
    // 仅夏雨主题且引擎支持折射时显示；否则隐藏（iPhone 没真折射可调）
    _updateGlassQualityRow() {
        const row = document.getElementById('glassQualityRow');
        if (!row) return;
        const theme = document.documentElement.dataset.theme;
        const supported = (typeof LiquidGlass !== 'undefined') && LiquidGlass.supported;
        const show = theme === 'summer-rain' && supported;
        row.style.display = show ? 'flex' : 'none';
        if (show) {
            const cfg = AppState.data.systemConfig || {};
            const sel = document.getElementById('glassQualitySelect');
            if (sel) sel.value = cfg.glassQuality || 'auto';
        }
    },

    // ── 数据驱动「动态特效开关」：每个主题各自的动态特效，按当前主题显示对应开关 / 无动态则隐藏整行
    //    （顺手修了原雨开关无条件显示、切到别的主题也看得见的 bug） ──
    THEME_EFFECTS: {
        'summer-rain':  { key: 'rainEffect',      label: 'appr.rain_effect',      note: 'appr.rain_effect_note',      applyFn: 'applyRainEffect' },
        'night-sky':    { key: 'starfieldEffect', label: 'appr.starfield_effect', note: 'appr.starfield_effect_note', applyFn: 'applyStarfieldEffect' },
        'snow-country': { key: 'snowEffect',      label: 'appr.snow_effect',      note: 'appr.snow_effect_note',      applyFn: 'applySnowEffect' },
    },

    _updateThemeEffectRow() {
        const row = document.getElementById('themeEffectRow');
        const note = document.getElementById('themeEffectNote');
        if (!row) return;
        const theme = document.documentElement.dataset.theme;
        const eff = this.THEME_EFFECTS[theme];
        if (!eff) {
            // 当前主题没有动态特效 → 整行 + 说明都隐藏
            row.style.display = 'none';
            if (note) note.style.display = 'none';
            return;
        }
        row.style.display = '';
        if (note) note.style.display = '';
        const cfg = AppState.data.systemConfig || {};
        const toggle = document.getElementById('themeEffectToggle');
        if (toggle) toggle.checked = cfg[eff.key] !== false;
        const labelEl = row.querySelector('[data-effect-label]');
        if (labelEl && typeof I18n !== 'undefined') labelEl.textContent = I18n.t(eff.label);
        if (note && typeof I18n !== 'undefined') note.textContent = I18n.t(eff.note);
    },

    // 应用背景纹理（设置 CSS 变量 --bg-texture，#desktop::before 自动叠加）
    applyTexture(texture) {
        const root = document.documentElement;
        const map = {
            washi:      { url: './assets/textures/washi.svg',      size: '180px 180px', op: 0.55 },
            watercolor: { url: './assets/textures/watercolor.svg', size: '320px 320px', op: 0.5  },
            flowers:    { url: './assets/textures/flowers.svg',    size: '200px 200px', op: 0.6  },
            grid:       { url: './assets/textures/grid.svg',       size: '64px 64px',   op: 0.55 },
            frosted:    { url: './assets/textures/frosted.svg',    size: '180px 180px', op: 0.4  }
        };
        if (!texture || texture === 'none' || !map[texture]) {
            root.style.setProperty('--bg-texture', 'none');
            root.style.removeProperty('--bg-texture-size');
            root.style.removeProperty('--bg-texture-opacity');
            return;
        }
        const t = map[texture];
        root.style.setProperty('--bg-texture', `url('${t.url}')`);
        root.style.setProperty('--bg-texture-size', t.size);
        root.style.setProperty('--bg-texture-opacity', t.op);
    },

    // 应用自定义 CSS（注入到 <style id="user-custom-theme">）
    applyCustomTheme(css) {
        let styleEl = document.getElementById('user-custom-theme');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'user-custom-theme';
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = css || '';
    },

    // 应用 textarea 中的 CSS
    applyCurrentCustomCss() {
        const ta = document.getElementById('customThemeCss');
        if (!ta) return;
        const css = ta.value;
        this.applyCustomTheme(css);
        AppState.data.systemConfig.customTheme = css;
        Utils.saveData();
        this._showToast(css.trim() ? I18n.t('t.set_css_applied', '✓ 自定义 CSS 已应用') : I18n.t('t.set_css_cleared', '已清空自定义 CSS'));
    },

    // 清空自定义 CSS（不再 confirm，因为模板可以随时复制回来）
    resetCustomCss() {
        const ta = document.getElementById('customThemeCss');
        if (ta) ta.value = '';
        this.applyCustomTheme('');
        AppState.data.systemConfig.customTheme = '';
        Utils.saveData();
        this._showToast(I18n.t('t.set_cleared', '✓ 已清空'));
    },

    // 复制 CSS 模板到剪贴板（带完整变量列表 + 字体变量 + 注释）
    async copyCssTemplate() {
        const tpl = this._buildCssTemplate();
        try {
            await navigator.clipboard.writeText(tpl);
            this._showToast(I18n.t('t.set_template_copied', '✓ 模板已复制，粘贴到下方输入框开始编辑'));
        } catch (e) {
            // 降级：写入 textarea
            const ta = document.getElementById('customThemeCss');
            if (ta && !ta.value.trim()) {
                ta.value = tpl;
                this._showToast(I18n.t('t.set_template_filled', '✓ 模板已填入下方输入框'));
            } else {
                alert('剪贴板访问失败，模板：\n\n' + tpl);
            }
        }
    },

    _buildCssTemplate() {
        return `/* Perigee OS 自定义主题模板 ─ 改任意变量都行，删掉不想改的行就好 */

:root {
    /* ── 背景层 ── */
    --bg-base: #faf5f5;          /* 主背景 */
    --bg-secondary: #fdf8f8;     /* 次级背景（卡片背后等）*/
    --bg-elevated: #fefafa;      /* 浮起背景（输入框等）*/
    --bg-card: #ffffff;          /* 卡片底色 */

    /* ── 强调色 ── */
    --accent-color: #C4999D;     /* 主强调色（按钮、选中态、链接）*/
    --accent-soft: #E8C8CB;      /* 副强调色 */
    --accent-shadow: rgba(196, 153, 157, 0.3); /* 强调色阴影/光晕 */

    /* ── 文字层级 ── */
    --text-primary: #5a4245;     /* 主文字 */
    --text-secondary: #9a7e82;   /* 次要文字（说明、标签）*/
    --text-tertiary: #bfa5a8;    /* 弱化文字（提示、占位）*/

    /* ── 边框 ── */
    --border-light: #f0e4e5;     /* 浅边框（卡片分隔）*/
    --border-medium: #e8d8da;    /* 中等边框（输入框）*/

    /* ── 圆角层级 ── */
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;

    /* ── 字体（会覆盖字体设定）── */
    /* --font-serif: 'Hiragino Mincho ProN', serif; */
    /* --font-sans: 'PingFang SC', sans-serif; */
    /* --font-display: 'Bodoni 72', serif; */

    /* ── 桌面壁纸渐变（不设壁纸图片时生效）── */
    --wallpaper-gradient: linear-gradient(135deg, #e4cfd2 0%, #f0dde0 50%, #f8ecee 100%);

    /* ── 桌面文字 ── */
    --desktop-text: #5a4245;
}

/* ── App 图标 ── */
/*
.app-icon {
    border-radius: 22px;
}
.app-icon-img {
    filter: saturate(1.1);
}
*/

/* ── 卡片 ── */
/*
.settings-card {
    border-radius: 18px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
}
*/

/* ── 模态框 ── */
/*
.modal-window {
    border-radius: 20px;
}
*/

/* 备注：
   - 写错任何一行都不影响数据，最坏只是样式坏掉
   - 点上方「清空」可以一键回到默认
   - 这里写的会覆盖主题预设和字体设定
*/
`;
    },

    _showToast(msg) {
        document.querySelectorAll('.css-copy-toast').forEach(n => n.remove());
        const el = document.createElement('div');
        el.className = 'css-copy-toast';
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2200);
    },

    // v2.144.0 Dock 名称开关：即时写 systemConfig + 重渲 Dock（外观设置里 toggle 的 onchange）
    onDockLabelsChange(checked) {
        const cfg = AppState.data.systemConfig || (AppState.data.systemConfig = {});
        cfg.showDockLabels = !!checked;
        Utils.saveData();
        if (typeof DesktopRenderer !== 'undefined' && DesktopRenderer.render) DesktopRenderer.render();
    },

    // 保留 saveConfig 给「应用背景设置」按钮使用：保存壁纸 + 纹理 + 雨效果开关
    saveConfig() {
        const cfg = AppState.data.systemConfig || (AppState.data.systemConfig = {});
        const wpIn = document.getElementById('systemWallpaper');
        const wallpaper = wpIn ? wpIn.value.trim() : '';
        const picker = document.getElementById('systemTexturePicker');
        const bgTexture = (picker && picker.dataset.selected) || 'none';
        // 动态特效开关：按当前主题写对应字段（数据驱动；夏雨=rainEffect / 夜空=starfieldEffect）
        const effToggle = document.getElementById('themeEffectToggle');
        const curTheme = document.documentElement.dataset.theme;
        const eff = this.THEME_EFFECTS[curTheme];

        cfg.wallpaper = wallpaper;
        cfg.bgTexture = bgTexture;
        if (eff && effToggle) cfg[eff.key] = effToggle.checked;

        this.applyWallpaper(wallpaper);
        this.applyTexture(bgTexture);
        if (eff && effToggle) this[eff.applyFn](effToggle.checked);
        Utils.saveData();

        this._showToast(I18n.t('t.set_bg_applied', '✓ 背景设置已应用'));
    }
};

// 3. App图标自定义模块
const IconCustomizer = {
    // App 列表从 APP_REGISTRY 动态读取，新增 app 自动出现
    get apps() {
        if (typeof APP_REGISTRY === 'undefined') return [];
        return Object.entries(APP_REGISTRY).map(([id, meta]) => ({
            id,
            name: meta.label,
            i18nKey: meta.i18n
        }));
    },

    init() {
        // 初始化自定义图标数据
        if (!AppState.data.customIcons) {
            AppState.data.customIcons = {};
        }
        this.render();
        // 应用已保存的自定义图标
        this.applyCustomIcons();
    },

    render() {
        const container = document.getElementById('customIconsList');
        if (!container) return;

        container.innerHTML = this.apps.map(app => {
            const customIcon = AppState.data.customIcons[app.id];
            const hasCustom = !!customIcon;

            return `
                <div class="icon-config-item">
                    <div class="icon-preview">
                        ${hasCustom
                    ? `<img src="${customIcon}" alt="${app.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                               <div class="default-icon-preview" style="display:none;">${app.name[0]}</div>`
                    : `<div class="default-icon-preview">${app.name[0]}</div>`
                }
                    </div>
                    <div class="icon-config-info">
                        <div class="icon-app-name">${app.name}</div>
                        <div class="icon-config-inputs">
                            <input type="text"
                                id="iconUrl_${app.id}"
                                placeholder="${I18n.t('settings.icon_url_placeholder')}"
                                value="${customIcon || ''}"
                                class="icon-url-input">
                            <label class="icon-upload-btn" for="iconFile_${app.id}" title="${I18n.t('settings.upload_image_title')}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <polyline points="17 8 12 3 7 8"/>
                                    <line x1="12" y1="3" x2="12" y2="15"/>
                                </svg>
                            </label>
                            <input type="file"
                                id="iconFile_${app.id}"
                                accept="image/*"
                                style="display: none;"
                                onchange="IconCustomizer.handleFileUpload('${app.id}', this)">
                            <button class="icon-save-btn" onclick="IconCustomizer.saveIcon('${app.id}')" title="${I18n.t('settings.save_icon_title')}">
                                ✓
                            </button>
                            ${hasCustom ? `
                                <button class="icon-reset-btn" onclick="IconCustomizer.resetIcon('${app.id}')" title="${I18n.t('settings.reset_default_title')}">
                                    ↺
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    handleFileUpload(appId, input) {
        const file = input.files[0];
        if (!file || !file.type.startsWith('image/')) {
            alert(I18n.t('settings.alert_pick_image'));
            return;
        }

        // 检查文件大小（限制为2MB）
        if (file.size > 2 * 1024 * 1024) {
            alert(I18n.t('settings.alert_image_too_large'));
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const urlInput = document.getElementById(`iconUrl_${appId}`);
            urlInput.value = e.target.result; // base64
            this.saveIcon(appId);
        };
        reader.readAsDataURL(file);
    },

    saveIcon(appId) {
        const urlInput = document.getElementById(`iconUrl_${appId}`);
        const iconUrl = urlInput.value.trim();

        if (iconUrl) {
            AppState.data.customIcons[appId] = iconUrl;
        } else {
            delete AppState.data.customIcons[appId];
        }

        Utils.saveData();
        this.render();
        this.applyCustomIcons(); // 立即应用到桌面
        this._reapplyThemeIcons(); // 重铺当前主题图标，避免改图标后主题贴纸/星座丢失
        Utils.showToast(I18n.t('t.set_icon_saved', '✓ 图标已保存'));
    },

    resetIcon(appId) {
        delete AppState.data.customIcons[appId];
        const fileInput = document.getElementById(`iconFile_${appId}`);
        if (fileInput) fileInput.value = '';

        Utils.saveData();
        this.render();
        this.applyCustomIcons();
        this._reapplyThemeIcons(); // reset 后重贴当前主题图标，而非退回默认 SVG（修 pre-existing）
        Utils.showToast(I18n.t('t.set_icon_reset', '✓ 已恢复默认图标'));
    },

    // 应用自定义图标到所有app
    applyCustomIcons() {
        // 先恢复所有默认图标
        document.querySelectorAll('.app-icon[data-original-svg]').forEach(iconContainer => {
            iconContainer.innerHTML = iconContainer.dataset.originalSvg;
            delete iconContainer.dataset.originalSvg;
        });

        // 应用自定义图标
        Object.keys(AppState.data.customIcons || {}).forEach(appId => {
            const iconUrl = AppState.data.customIcons[appId];
            if (!iconUrl) return;

            const appElements = document.querySelectorAll(`[data-app="${appId}"]`);

            appElements.forEach(appEl => {
                const iconContainer = appEl.querySelector('.app-icon');
                if (!iconContainer) return;

                // 保存原始SVG（如果还没保存）
                if (!iconContainer.dataset.originalSvg) {
                    iconContainer.dataset.originalSvg = iconContainer.innerHTML;
                }

                // 替换为自定义图标
                iconContainer.innerHTML = `<img src="${iconUrl}" alt="" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;" onerror="this.parentElement.innerHTML = this.parentElement.dataset.originalSvg; delete this.parentElement.dataset.originalSvg;">`;
            });
        });
    },

    // 删/改自定义图标后重铺当前主题图标贴纸/星座(四方守卫对称、顺序同 DesktopRenderer.render)，
    // 否则被 reset 的 app 会退回默认 SVG 而非主题图标。自定义图标仍最高优先(applyCustomIcons 在此之前已跑)。
    _reapplyThemeIcons() {
        if (typeof ConstellationIcons !== 'undefined') ConstellationIcons.apply();
        if (typeof JournalIcons !== 'undefined') JournalIcons.apply();
        if (typeof StrawberryIcons !== 'undefined') StrawberryIcons.apply();
        if (typeof SnowIcons !== 'undefined') SnowIcons.apply();
    }
};

// 4. Image Generation API Settings
const ImageAPISettings = {
    init() {
        // Initialize image API config if not exists
        if (!AppState.data.imageApiConfig) {
            AppState.data.imageApiConfig = {
                provider: 'openai',
                url: 'https://api.openai.com',
                key: '',
                model: 'dall-e-3'
            };
        }

        const config = AppState.data.imageApiConfig;

        // Fill form fields
        document.getElementById('imageApiProvider').value = config.provider || 'openai';
        document.getElementById('imageApiUrl').value = config.url || '';
        document.getElementById('imageApiKey').value = config.key || '';
        document.getElementById('imageApiModel').value = config.model || '';

        // Bind events
        document.getElementById('imageApiProvider').onchange = this.onProviderChange.bind(this);
        document.getElementById('saveImageApiBtn').onclick = this.save.bind(this);

        // 模型下拉（透明 select 叠在 input 右侧 ▼）选中后回填 input —— iOS 原生 datalist 弹不出，改用 select
        const imageModelSelect = document.getElementById('imageModelSelect');
        if (imageModelSelect) {
            imageModelSelect.onchange = () => {
                if (imageModelSelect.value) document.getElementById('imageApiModel').value = imageModelSelect.value;
            };
        }

        // Restore NovelAI settings if saved
        const naiSettings = AppState.data.novelaiSettings;
        if (naiSettings) {
            if (document.getElementById('naiModel')) document.getElementById('naiModel').value = naiSettings.model || 'nai-diffusion-4-5-full';
            if (document.getElementById('naiProxyUrl')) document.getElementById('naiProxyUrl').value = naiSettings.proxyUrl || '';
            if (document.getElementById('naiResolution')) document.getElementById('naiResolution').value = naiSettings.resolution || '1024x1024';
            if (document.getElementById('naiSteps')) {
                document.getElementById('naiSteps').value = naiSettings.steps || 28;
                document.getElementById('naiStepsVal').textContent = naiSettings.steps || 28;
            }
            if (document.getElementById('naiCfgScale')) {
                document.getElementById('naiCfgScale').value = naiSettings.cfgScale || 5;
                document.getElementById('naiCfgVal').textContent = naiSettings.cfgScale || 5;
            }
            if (document.getElementById('naiSampler')) document.getElementById('naiSampler').value = naiSettings.sampler || 'k_euler_ancestral';
            if (document.getElementById('naiSeed')) document.getElementById('naiSeed').value = naiSettings.seed ?? -1;
            if (document.getElementById('naiDefaultPositive')) document.getElementById('naiDefaultPositive').value = naiSettings.defaultPositive || '';
            if (document.getElementById('naiDefaultNegative')) document.getElementById('naiDefaultNegative').value = naiSettings.defaultNegative || '';
        }

        // Restore per-module image gen settings
        const imgModules = AppState.data.imageGenModules;
        if (imgModules) {
            const twEl = document.getElementById('imageGenTwitter');
            if (twEl) twEl.checked = imgModules.twitter !== false;
            const mbEl = document.getElementById('imageGenMelonbooks');
            if (mbEl) mbEl.checked = imgModules.melonbooks !== false;
            const gdEl = document.getElementById('imageGenGoods');
            if (gdEl) gdEl.checked = imgModules.goods === true;  // 官方周边默认关
        }

        // Initial UI update
        this.updateUIForProvider();
    },

    onProviderChange() {
        this.updateUIForProvider();
    },

    updateUIForProvider() {
        const provider = document.getElementById('imageApiProvider').value;
        const urlInput = document.getElementById('imageApiUrl');
        const modelInput = document.getElementById('imageApiModel');
        const novelaiPanel = document.getElementById('novelaiSettingsPanel');
        const urlRow = document.getElementById('imageApiUrlRow');
        const modelRow = document.getElementById('imageApiModelRow');

        // Show/hide NovelAI panel
        if (novelaiPanel) novelaiPanel.style.display = provider === 'novelai' ? 'block' : 'none';

        // Show/hide standard URL/model fields (NovelAI has its own panel for these)
        const showStandard = provider !== 'novelai';
        if (urlRow) urlRow.style.display = showStandard ? '' : 'none';
        if (modelRow) modelRow.style.display = showStandard ? '' : 'none';

        switch (provider) {
            case 'openai':
                urlInput.value = 'https://api.openai.com';
                urlInput.placeholder = 'https://api.openai.com';
                modelInput.placeholder = 'dall-e-3 / dall-e-2';
                break;
            case 'gpt-image':
                urlInput.value = 'https://api.openai.com';
                urlInput.placeholder = 'https://api.openai.com';
                modelInput.placeholder = 'gpt-image-2';
                break;
            case 'openrouter':
                // 官方地址兜底；保留用户已填的自定义 base（仅当空或是上一个 provider 的默认值时才覆盖）
                if (!urlInput.value || /api\.openai\.com|api\.stability\.ai/.test(urlInput.value)) {
                    urlInput.value = 'https://openrouter.ai/api/v1';
                }
                urlInput.placeholder = 'https://openrouter.ai/api/v1';
                modelInput.placeholder = 'openai/gpt-5.4-image-2';
                break;
            case 'stabilityai':
                urlInput.value = 'https://api.stability.ai';
                urlInput.placeholder = 'https://api.stability.ai';
                modelInput.placeholder = 'stable-diffusion-xl-1024-v1-0';
                break;
            case 'midjourney':
                urlInput.value = '';
                urlInput.placeholder = '输入Midjourney兼容API地址';
                modelInput.placeholder = 'midjourney';
                break;
            case 'novelai':
                // NovelAI uses its own panel, no need for standard URL/model
                break;
            case 'custom':
                urlInput.value = '';
                urlInput.placeholder = '输入自定义API地址';
                modelInput.placeholder = '输入模型名称';
                break;
        }
    },

    save() {
        const provider = document.getElementById('imageApiProvider').value;
        let url = document.getElementById('imageApiUrl').value.trim();
        while (url.endsWith('/')) url = url.slice(0, -1);

        AppState.data.imageApiConfig = {
            provider: provider,
            url: url,
            key: document.getElementById('imageApiKey').value.trim(),
            model: document.getElementById('imageApiModel').value.trim()
        };

        // モジュール別画像生成設定
        AppState.data.imageGenModules = {
            twitter: document.getElementById('imageGenTwitter')?.checked ?? true,
            melonbooks: document.getElementById('imageGenMelonbooks')?.checked ?? true,
            goods: document.getElementById('imageGenGoods')?.checked ?? false  // 官方周边默认关
        };

        // Save NovelAI-specific settings
        if (provider === 'novelai') {
            AppState.data.novelaiSettings = {
                model: document.getElementById('naiModel').value,
                proxyUrl: (document.getElementById('naiProxyUrl')?.value || '').trim(),
                resolution: document.getElementById('naiResolution').value,
                steps: parseInt(document.getElementById('naiSteps').value) || 28,
                cfgScale: parseFloat(document.getElementById('naiCfgScale').value) || 5,
                sampler: document.getElementById('naiSampler').value,
                seed: parseInt(document.getElementById('naiSeed').value),
                defaultPositive: (document.getElementById('naiDefaultPositive')?.value || '').trim(),
                defaultNegative: (document.getElementById('naiDefaultNegative')?.value || '').trim()
            };
        }

        Utils.saveData();
        Utils.showToast(I18n.t('t.set_image_api_saved', '✓ Image API settings saved'));
    }
};

// ===== 视频生成 API（Seedance PV，js/video-gen.js 消费 workerUrl/key/model） =====
const VideoAPISettings = {
    init() {
        // 懒创建配置对象（照 ImageAPISettings.init 的姿势）
        if (!AppState.data.videoApiConfig) {
            AppState.data.videoApiConfig = { workerUrl: '', key: '', model: (typeof VideoGen !== 'undefined' && VideoGen.MODELS?.[0]?.id) || '' };
        }
        const config = AppState.data.videoApiConfig;

        document.getElementById('videoApiWorkerUrl').value = config.workerUrl || '';
        document.getElementById('videoApiKey').value = config.key || '';
        this.populateModels(config.model);

        document.getElementById('videoApiFetchModelsBtn').onclick = this.tryFetchVideoModels.bind(this);
        document.getElementById('saveVideoApiBtn').onclick = this.save.bind(this);
    },

    // 用 VideoGen.MODELS 填 select（value=id，text=label）
    populateModels(selected) {
        const select = document.getElementById('videoApiModel');
        if (!select) return;
        const models = (typeof VideoGen !== 'undefined' && VideoGen.MODELS) ? VideoGen.MODELS : [];
        select.innerHTML = '';
        models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.label;
            select.appendChild(opt);
        });
        if (selected && models.some(m => m.id === selected)) {
            select.value = selected;
        } else if (models.length) {
            select.value = models[0].id;
        }
    },

    save() {
        let workerUrl = document.getElementById('videoApiWorkerUrl').value.trim();
        while (workerUrl.endsWith('/')) workerUrl = workerUrl.slice(0, -1);

        AppState.data.videoApiConfig = {
            workerUrl,
            key: document.getElementById('videoApiKey').value.trim(),
            model: document.getElementById('videoApiModel').value
        };

        Utils.saveData();
        Utils.showToast(I18n.t('settings.video_api_saved', '✓ 视频生成 API 已保存'));
    },

    // GET {workerUrl}/ark/api/v3/models（Bearer）→ 过滤 id 含 seedance 的项替换 select；
    // 保留当前选中值（不在新列表里也追加一项防丢配置）；任何失败/空结果都不动内置列表，只 toast。
    // 容错风格照 APISettings.tryFetchModels（js/settings.js:153）/ WeiboApiSettings._fetchModels。
    async tryFetchVideoModels() {
        const workerUrl = document.getElementById('videoApiWorkerUrl').value.trim().replace(/\/+$/, '');
        const key = document.getElementById('videoApiKey').value.trim();
        const select = document.getElementById('videoApiModel');
        const btn = document.getElementById('videoApiFetchModelsBtn');
        const prevSelected = select ? select.value : '';

        if (!workerUrl || !key) {
            Utils.showToast(I18n.t('settings.video_api_url_key_required', '请先填写 Worker URL 和 API Key'));
            return;
        }

        if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
        try {
            const res = await fetch(`${workerUrl}/ark/api/v3/models`, {
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + key }
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            if (!data || !Array.isArray(data.data)) throw new Error('bad response shape');

            const seedanceIds = data.data
                .map(m => (typeof m === 'string' ? m : m.id))
                .filter(id => id && id.toLowerCase().includes('seedance'));
            if (!seedanceIds.length) throw new Error('no seedance models in response');

            // 内置列表里有同 id 的沿用其 label；拉到的新 id 没有内置 label 时用 id 本身兜底显示
            const builtins = (typeof VideoGen !== 'undefined' && VideoGen.MODELS) ? VideoGen.MODELS : [];
            const merged = seedanceIds.map(id => builtins.find(m => m.id === id) || { id, label: id });

            // 当前选中值不在新列表里也保留为一个选项，防止丢配置
            if (prevSelected && !merged.some(m => m.id === prevSelected)) {
                merged.push(builtins.find(m => m.id === prevSelected) || { id: prevSelected, label: prevSelected });
            }

            select.innerHTML = '';
            merged.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.label;
                select.appendChild(opt);
            });
            select.value = prevSelected && merged.some(m => m.id === prevSelected) ? prevSelected : merged[0].id;

            Utils.showToast(I18n.t('settings.video_api_fetched', '模型列表已更新'));
        } catch (err) {
            console.warn('[VideoAPISettings] fetch failed', err);
            Utils.showToast(I18n.t('settings.video_api_fetch_failed', '拉取失败，使用内置列表'));
            // 内置列表未被触碰（上面校验失败会在替换 select 之前 throw）
        } finally {
            if (btn) { btn.textContent = I18n.t('settings.video_api_fetch_models', '拉取模型列表'); btn.disabled = false; }
        }
    }
};

// ===== TTS 语音朗读设置 =====
const TTSSettings = {
    // MiniMax 区域 → API endpoint 映射（两个站账号不互通；参考 既有方案 2026.1 版）
    MINIMAX_ENDPOINTS: {
        global: 'https://api.minimax.io',
        china:  'https://api.minimaxi.com'
    },
    getMinimaxBase(region, customBase) {
        if (customBase && customBase.trim()) return customBase.trim().replace(/\/+$/, '');
        return this.MINIMAX_ENDPOINTS[region] || this.MINIMAX_ENDPOINTS.global;
    },

    init() {
        const tts = AppState.data.ttsConfig || {};
        const providerEl = document.getElementById('ttsProvider');
        if (!providerEl) return;

        providerEl.value = tts.provider || 'none';
        this._providerChange(tts.provider || 'none');
        providerEl.onchange = () => this._providerChange(providerEl.value);

        // MiniMax fields
        const regionEl = document.getElementById('ttsMinimaxRegion');
        if (regionEl) regionEl.value = tts.minimaxRegion || 'global';
        const customBaseEl = document.getElementById('ttsMinimaxCustomBase');
        if (customBaseEl) customBaseEl.value = tts.minimaxCustomBase || '';
        const groupIdEl = document.getElementById('ttsGroupId');
        if (groupIdEl) groupIdEl.value = tts.groupId || '';
        const apiKeyEl = document.getElementById('ttsApiKey');
        if (apiKeyEl) apiKeyEl.value = tts.apiKey || '';
        const speechModelEl = document.getElementById('ttsSpeechModel');
        if (speechModelEl) {
            // 如果保存的值不在预设里（比如 MiniMax 出了新模型），插入一个保留 option
            const saved = tts.speechModel || 'speech-2.8-hd';
            const has = Array.from(speechModelEl.options).some(o => o.value === saved);
            if (!has) {
                const opt = document.createElement('option');
                opt.value = saved;
                opt.textContent = saved;
                speechModelEl.insertBefore(opt, speechModelEl.firstChild);
            }
            speechModelEl.value = saved;
        }
        const voiceEl = document.getElementById('ttsVoiceId');
        if (voiceEl) voiceEl.value = tts.voiceId || 'Japanese_HikaruMale_Calm';
        const interviewerVoiceEl = document.getElementById('ttsInterviewerVoiceId');
        if (interviewerVoiceEl) interviewerVoiceEl.value = tts.interviewerVoiceId || '';

        // 読音対照表 list + add button
        this._renderReadingMap();
        this._bindReadingMapControls();
        const speedEl = document.getElementById('ttsSpeed');
        if (speedEl) {
            speedEl.value = tts.speed != null ? tts.speed : 1.0;
            const v = document.getElementById('ttsSpeedValue');
            if (v) v.textContent = Number(speedEl.value).toFixed(1);
            speedEl.oninput = () => {
                if (v) v.textContent = Number(speedEl.value).toFixed(1);
            };
        }
        const boostEl = document.getElementById('ttsLanguageBoost');
        if (boostEl) boostEl.value = tts.languageBoost || '';

        // Custom fields
        const customUrlEl = document.getElementById('ttsCustomUrl');
        if (customUrlEl) customUrlEl.value = tts.customUrl || '';
        const customKeyEl = document.getElementById('ttsCustomApiKey');
        if (customKeyEl) customKeyEl.value = tts.customApiKey || '';
        const customModelEl = document.getElementById('ttsCustomModel');
        if (customModelEl) customModelEl.value = tts.customModel || '';
        const customVoiceEl = document.getElementById('ttsCustomVoice');
        if (customVoiceEl) customVoiceEl.value = tts.customVoice || '';

        // Save button
        const saveBtn = document.getElementById('saveTtsBtn');
        if (saveBtn) saveBtn.onclick = () => this.save();
    },

    _providerChange(provider) {
        const mm = document.getElementById('ttsMinimaxConfig');
        const ws = document.getElementById('ttsWebSpeechConfig');
        const cu = document.getElementById('ttsCustomConfig');
        if (mm) mm.style.display = provider === 'minimax' ? 'block' : 'none';
        if (ws) ws.style.display = provider === 'webspeech' ? 'block' : 'none';
        if (cu) cu.style.display = provider === 'custom' ? 'block' : 'none';
    },

    save() {
        const provider = document.getElementById('ttsProvider').value;
        AppState.data.ttsConfig = {
            provider,
            // MiniMax
            minimaxRegion: document.getElementById('ttsMinimaxRegion')?.value || 'global',
            minimaxCustomBase: (document.getElementById('ttsMinimaxCustomBase')?.value || '').trim(),
            groupId: (document.getElementById('ttsGroupId')?.value || '').trim(),
            apiKey: (document.getElementById('ttsApiKey')?.value || '').trim(),
            speechModel: (document.getElementById('ttsSpeechModel')?.value || 'speech-2.8-hd').trim(),
            voiceId: (document.getElementById('ttsVoiceId')?.value || 'Japanese_HikaruMale_Calm').trim(),
            interviewerVoiceId: (document.getElementById('ttsInterviewerVoiceId')?.value || '').trim(),
            readingMap: Array.isArray(AppState.data.ttsConfig?.readingMap) ? [...AppState.data.ttsConfig.readingMap] : [],
            speed: parseFloat(document.getElementById('ttsSpeed')?.value || '1.0'),
            languageBoost: document.getElementById('ttsLanguageBoost')?.value || '',
            // WebSpeech
            webSpeechVoice: document.getElementById('ttsWebSpeechVoice')?.value || '',
            // Custom
            customUrl: (document.getElementById('ttsCustomUrl')?.value || '').trim(),
            customApiKey: (document.getElementById('ttsCustomApiKey')?.value || '').trim(),
            customModel: (document.getElementById('ttsCustomModel')?.value || '').trim(),
            customVoice: (document.getElementById('ttsCustomVoice')?.value || '').trim()
        };
        Utils.saveData();
        Utils.showToast(I18n.t('t.set_tts_saved', '✓ TTS 设置已保存'));
    },

    // ─── 読音対照表 ───────────────────────────────────────────
    _renderReadingMap() {
        const container = document.getElementById('ttsReadingMapList');
        if (!container) return;
        const map = AppState.data.ttsConfig?.readingMap || [];
        if (map.length === 0) {
            container.innerHTML = '<div class="reading-map-empty">尚未追加</div>';
            return;
        }
        const _esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        container.innerHTML = map.map((m, i) => `
            <div class="reading-map-row">
                <span class="reading-map-from">${_esc(m.from)}</span>
                <span class="reading-map-arrow-static">→</span>
                <span class="reading-map-to">${_esc(m.to)}</span>
                <button type="button" class="reading-map-del" data-idx="${i}" aria-label="削除">×</button>
            </div>`).join('');
        container.querySelectorAll('.reading-map-del').forEach(btn => {
            btn.onclick = () => this._removeReadingMapEntry(parseInt(btn.dataset.idx, 10));
        });
    },

    _bindReadingMapControls() {
        const addBtn = document.getElementById('ttsReadingMapAddBtn');
        const fromEl = document.getElementById('ttsReadingMapFrom');
        const toEl = document.getElementById('ttsReadingMapTo');
        if (addBtn && !addBtn._bound) {
            addBtn._bound = true;
            addBtn.onclick = () => this._addReadingMapEntry();
        }
        const handleEnter = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._addReadingMapEntry();
            }
        };
        if (fromEl && !fromEl._bound) { fromEl._bound = true; fromEl.addEventListener('keydown', handleEnter); }
        if (toEl && !toEl._bound) { toEl._bound = true; toEl.addEventListener('keydown', handleEnter); }
    },

    _addReadingMapEntry() {
        const fromEl = document.getElementById('ttsReadingMapFrom');
        const toEl = document.getElementById('ttsReadingMapTo');
        const from = (fromEl?.value || '').trim();
        const to = (toEl?.value || '').trim();
        if (!from || !to) {
            Utils.showToast(I18n.t('t.set_reading_map_fields', '漢字と読音、両方とも入力してください'));
            return;
        }
        if (!AppState.data.ttsConfig) AppState.data.ttsConfig = {};
        if (!Array.isArray(AppState.data.ttsConfig.readingMap)) AppState.data.ttsConfig.readingMap = [];
        const map = AppState.data.ttsConfig.readingMap;
        // 重复检测
        const dup = map.findIndex(m => m.from === from);
        if (dup >= 0) {
            map[dup].to = to;
            Utils.showToast(I18n.t('t.set_reading_map_updated', '既存項目を更新しました'));
        } else {
            map.push({ from, to });
        }
        Utils.saveData();
        if (fromEl) fromEl.value = '';
        if (toEl) toEl.value = '';
        this._renderReadingMap();
    },

    _removeReadingMapEntry(idx) {
        if (!AppState.data.ttsConfig?.readingMap) return;
        AppState.data.ttsConfig.readingMap.splice(idx, 1);
        Utils.saveData();
        this._renderReadingMap();
    },

    async fetchVoices() {
        const provider = document.getElementById('ttsProvider').value;

        if (provider === 'webspeech') {
            if (!('speechSynthesis' in window)) {
                Utils.showToast(I18n.t('t.set_no_speech_synth', '该设备不支持语音合成'));
                return;
            }
            let voices = speechSynthesis.getVoices();
            if (!voices.length) {
                await new Promise(r => { speechSynthesis.onvoiceschanged = r; setTimeout(r, 1000); });
                voices = speechSynthesis.getVoices();
            }
            const jpVoices = voices.filter(v => v.lang.startsWith('ja'));
            const row = document.getElementById('ttsWebSpeechVoiceRow');
            const sel = document.getElementById('ttsWebSpeechVoice');
            if (jpVoices.length > 0 && sel) {
                sel.innerHTML = jpVoices.map(v => `<option value="${v.name}">${v.name} (${v.lang})</option>`).join('');
                if (row) row.style.display = 'flex';
                Utils.showToast(I18n.t('t.set_voices_found', {n: jpVoices.length}));
            } else {
                Utils.showToast(I18n.t('t.set_no_jp_voices', '未找到日语音色，请确认设备已安装日语语音包'));
            }
            return;
        }

        if (provider === 'custom') {
            const url = (document.getElementById('ttsCustomUrl')?.value || '').trim();
            const apiKey = (document.getElementById('ttsCustomApiKey')?.value || '').trim();
            const model = (document.getElementById('ttsCustomModel')?.value || '').trim();
            const voice = (document.getElementById('ttsCustomVoice')?.value || '').trim() || 'alloy';
            if (!url) { Utils.showToast(I18n.t('t.set_fill_base_url', '请先填写 API Base URL')); return; }

            const btn = document.getElementById('ttsCustomTestBtn');
            if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
            try {
                let endpoint = url;
                while (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
                if (!endpoint.endsWith('/v1/audio/speech')) {
                    endpoint = endpoint.endsWith('/v1') ? `${endpoint}/audio/speech` : `${endpoint}/v1/audio/speech`;
                }
                const headers = { 'Content-Type': 'application/json' };
                if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ model: model || 'tts-1', input: 'テスト', voice })
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
                const blob = await res.blob();
                if (blob.size < 100) throw new Error('返回音频数据过小');
                Utils.showToast(I18n.t('t.set_tts_conn_ok', '✓ 自定义 TTS 连接正常'));
            } catch (e) {
                Utils.showToast(I18n.t('t.set_conn_failed', '✗ 连接失败：') + e.message);
            } finally {
                if (btn) { btn.textContent = '测试连接'; btn.disabled = false; }
            }
            return;
        }

        // MiniMax（从 MiniMax 的 fetch 按钮 onclick 已移除，此分支保留给 WebSpeech/Custom 之外的兜底）
    },

    // 获取/同步 MiniMax 语音模型：测试连接 + 刷新预设列表
    // MiniMax TTS 没有标准列模型 API，沿用 既有方案做法 —— 预设 + 测试
    async fetchSpeechModels() {
        const region = document.getElementById('ttsMinimaxRegion')?.value || 'global';
        const customBase = (document.getElementById('ttsMinimaxCustomBase')?.value || '').trim();
        const groupId = (document.getElementById('ttsGroupId')?.value || '').trim();
        const apiKey = (document.getElementById('ttsApiKey')?.value || '').trim();
        const select = document.getElementById('ttsSpeechModel');
        const currentModel = select?.value || 'speech-2.8-hd';
        const voiceId = (document.getElementById('ttsVoiceId')?.value || '').trim() || 'Japanese_HikaruMale_Calm';
        const speed = parseFloat(document.getElementById('ttsSpeed')?.value || '1.0');
        const languageBoost = document.getElementById('ttsLanguageBoost')?.value || '';
        if (!groupId || !apiKey) { Utils.showToast(I18n.t('t.set_fill_groupid_key', '请先填写 GroupId 和 API Key')); return; }

        const btn = document.getElementById('ttsFetchSpeechModelsBtn');
        if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
        try {
            const base = this.getMinimaxBase(region, customBase);
            const body = {
                model: currentModel, text: 'テスト', stream: false,
                voice_setting: { voice_id: voiceId, speed, vol: 1.0, pitch: 0 },
                audio_setting: { audio_sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 }
            };
            if (languageBoost) body.language_boost = languageBoost;
            const res = await fetch(`${base}/v1/t2a_v2?GroupId=${groupId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify(body)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data.base_resp && data.base_resp.status_code !== 0) throw new Error(data.base_resp.status_msg);

            // 连接成功 → 刷新预设模型列表（2026-04 更新，MiniMax 官方最新型号）
            const presets = [
                { value: 'speech-2.8-hd',    label: 'speech-2.8-HD（情绪渲染·最新）' },
                { value: 'speech-2.8-turbo', label: 'speech-2.8-Turbo（极速·最新）' },
                { value: 'speech-2.6-hd',    label: 'speech-2.6-HD（极致音质）' },
                { value: 'speech-2.6-turbo', label: 'speech-2.6-Turbo（超低时延）' },
                { value: 'speech-02-hd',     label: 'speech-02-HD（稳定克隆）' },
                { value: 'speech-02-turbo',  label: 'speech-02-Turbo（小语种强化）' }
            ];
            if (select) {
                select.innerHTML = presets.map(p => `<option value="${p.value}">${p.label}</option>`).join('');
                // 保留当前选中（若不在预设里则插入顶部）
                if (!presets.some(p => p.value === currentModel)) {
                    const opt = document.createElement('option');
                    opt.value = currentModel;
                    opt.textContent = currentModel + '（自定义）';
                    select.insertBefore(opt, select.firstChild);
                }
                select.value = currentModel;
            }
            Utils.showToast(I18n.t('t.set_conn_ok_models', '✓ 连接成功，模型已更新'));
        } catch (e) {
            Utils.showToast(I18n.t('t.set_conn_failed', '✗ 连接失败：') + e.message);
        } finally {
            if (btn) { btn.textContent = 'Fetch'; btn.disabled = false; }
        }
    }
};
