// 国际化模块 - Internationalization Module
const I18n = {
    currentLang: 'zh',

    // 翻译字典
    translations: {},

    // 获取翻译文本
    // 第二参数：字符串 = 回退文案（无翻译时用）；对象 = 插值参数（如 { n: 3 } 把文案里的 {n} 替换为 3）
    t(key, fallbackOrParams = null) {
        const lang = this.currentLang || 'zh';

        // 区分第二参数：对象按插值参数处理，否则当回退文案
        let fallback = null, params = null;
        if (fallbackOrParams && typeof fallbackOrParams === 'object') {
            params = fallbackOrParams;
        } else {
            fallback = fallbackOrParams;
        }

        // 查找翻译：当前语言 → 英文 → 中文 → 回退文案 → key 本身
        let translation = this.translations[lang]?.[key];
        if (!translation && lang !== 'en') translation = this.translations.en?.[key];
        if (!translation && lang !== 'zh') translation = this.translations.zh?.[key];
        if (!translation) translation = fallback || key;

        // 占位符插值：文案里的 {name} 替换为 params.name
        if (params) {
            translation = translation.replace(/\{(\w+)\}/g, (m, k) =>
                params[k] !== undefined ? String(params[k]) : m);
        }

        return translation;
    },

    // 应用翻译到DOM
    applyTranslations() {
        // 更新所有带 data-i18n 属性的元素
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.t(key);

            // 根据元素类型更新内容
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                if (el.placeholder) {
                    el.placeholder = translation;
                }
            } else {
                el.textContent = translation;
            }
        });

        // 更新带 data-i18n-placeholder 属性的输入框
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = this.t(key);
        });

        // 更新带 data-i18n-title 属性的元素（hover 提示）
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.title = this.t(key);
        });

        // 更新带 data-i18n-html 属性的元素（含 <code>/<strong> 等子元素的说明）
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            const key = el.getAttribute('data-i18n-html');
            el.innerHTML = this.t(key);
        });

        // 更新带 data-i18n-label 属性的元素（<optgroup> label 属性等）
        document.querySelectorAll('[data-i18n-label]').forEach(el => {
            const key = el.getAttribute('data-i18n-label');
            el.label = this.t(key);
        });

        // 更新页面标题
        document.title = this.t('pwa.name');

        // 触发自定义事件，允许其他模块响应语言变化
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: this.currentLang } }));

        // 中央化重渲：让动态 innerHTML 渲染的卡片/列表跟随语言切换立即刷新
        // 防御性 try/catch：模块未加载或当前不可见时静默吞掉
        const _tryRerender = (obj) => {
            if (!obj) return;
            try {
                if (typeof obj.switchTab === 'function' && obj.currentTab) obj.switchTab(obj.currentTab);
                else if (typeof obj.renderArticleList === 'function') obj.renderArticleList();
                else if (typeof obj.renderThreadList === 'function') obj.renderThreadList();
                else if (typeof obj.renderTimeline === 'function') obj.renderTimeline();
                else if (typeof obj.render === 'function') obj.render();
            } catch (e) { /* 静默 */ }
        };
        ['Forum', 'Twitter', 'Magazine', 'Melonbooks', 'Niconico', 'Broadcast', 'Line', 'PixivNovel', 'PixivIllust', 'Mercari', 'LineHome', 'Conversation', 'ChatList', 'LineVoom', 'LinePay'].forEach(name => {
            _tryRerender(window[name]);
        });
    },

    // 设置语言。v2.196.0 起字典懒加载：目标字典未加载则先经 Utils.loadScriptOnce 补载
    //（async；调用方均为 fire-and-forget，字典已在内存时与旧版同步时序完全一致——
    // async 函数在首个 await 前同步执行）。镜像键 perigee_lang_mirror 供 index.html
    // 解析期同步选字典（真身仍在 systemConfig.language，镜像只是启动加速缓存）。
    async setLanguage(lang) {
        if (lang !== 'zh' && lang !== 'ja' && lang !== 'en') {
            console.warn(`Language ${lang} not found, falling back to zh`);
            lang = 'zh';
        }
        if (!this.translations[lang]) {
            try {
                await Utils.loadScriptOnce(`js/i18n-${lang}.js`);
            } catch (e) {
                console.warn(`i18n 字典加载失败: ${lang}`, e);
            }
            if (!this.translations[lang]) {
                // v2.198.0 复检修复：回落 zh 前确保 zh 字典真在内存——启动按镜像预载的可能是
                // 别的语言，此时裸赋值 'zh' 会让整站 t() 三层回退全落空（裸 key）。双失败则保持
                // 现状语言，t() 走 fallback 文案，不写坏镜像。
                lang = 'zh';
                if (!this.translations.zh) {
                    try { await Utils.loadScriptOnce('js/i18n-zh.js'); } catch (e) { /* 双失败，见上 */ }
                }
            }
        }
        this.currentLang = lang;
        // 镜像只记录字典真实可用的语言，避免把损坏状态持久化进下次启动的解析期选择
        if (this.translations[lang]) {
            try { localStorage.setItem('perigee_lang_mirror', lang); } catch (e) {}
        }
        this.applyTranslations();

        this.updateManifest(lang);
    },

    // ⚠️ 刻意 no-op（v2.192.1）：运行时替换 manifest link 会让 Chrome 判
    // `manifest-location-changed`，安卓 WebAPK 铸造直接判死——PWA 永远降级成
    // 带角标的快捷方式（长按只有「移除」没有「卸载」）。manifest 恒用 manifest.json，
    // 三份语言 manifest 保留在仓库但不再引用（作者拍板方案 A：日语安装名让位给真安装）。
    // manifest link 的 href 在页面生命周期内一个字都不能变。
    updateManifest(lang) {
    }
};
