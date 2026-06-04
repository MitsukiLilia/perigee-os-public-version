// Perigee OS 首次启动引导
// 4 步：欢迎 → API 指路 → 板块速览 → 完成
// 完成或跳过后写 localStorage 标记，下次不再弹

const Onboarding = {
    STORAGE_KEY: 'perigee_onboarded',
    _step: 0,
    _total: 4,

    // 入口：app 启动时调用
    checkAndShow() {
        try {
            const done = localStorage.getItem(this.STORAGE_KEY);
            if (done === 'true') return;
            // 微小延迟，让桌面先渲染出来
            setTimeout(() => this.show(), 400);
        } catch (e) {
            console.warn('[Onboarding] localStorage unavailable', e);
        }
    },

    show() {
        this._step = 0;
        const overlay = document.getElementById('onboardingOverlay');
        if (!overlay) return;
        overlay.classList.add('active');
        this.render();
    },

    skip() {
        this._finish();
    },

    next() {
        if (this._step < this._total - 1) {
            this._step++;
            this.render();
        } else {
            this._finish(true);
        }
    },

    prev() {
        if (this._step > 0) {
            this._step--;
            this.render();
        }
    },

    _finish(openHelp = false) {
        try { localStorage.setItem(this.STORAGE_KEY, 'true'); } catch (e) {}
        const overlay = document.getElementById('onboardingOverlay');
        if (overlay) overlay.classList.remove('active');
        if (openHelp && typeof Help !== 'undefined') {
            // 完成走完最后一步 → 自动打开使用指南
            setTimeout(() => Help.open(), 200);
        }
    },

    render() {
        // 进度点
        document.querySelectorAll('.onboarding-step-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === this._step);
        });

        // 内容
        const content = document.getElementById('onboardingContent');
        if (!content) return;
        content.innerHTML = this._stepHtml(this._step);

        // 按钮
        const prevBtn = document.querySelector('.onboarding-prev');
        const nextBtn = document.querySelector('.onboarding-next');
        const skipBtn = document.querySelector('.onboarding-skip');

        if (prevBtn) prevBtn.style.display = this._step > 0 ? '' : 'none';
        if (nextBtn) {
            nextBtn.textContent = this._step === this._total - 1 ? '查看完整指南' : '下一步';
        }
        if (skipBtn) {
            skipBtn.style.display = this._step === this._total - 1 ? 'none' : '';
        }
    },

    _stepHtml(step) {
        switch (step) {
            case 0:
                return `
                    <div class="onboarding-illust">
                        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="32" cy="32" r="22"/>
                            <path d="M32 14a30 30 0 0 1 8 18 30 30 0 0 1-8 18 30 30 0 0 1-8-18 30 30 0 0 1 8-18z"/>
                            <line x1="10" y1="32" x2="54" y2="32"/>
                        </svg>
                    </div>
                    <h2 class="onboarding-step-title">欢迎来到 Perigee OS</h2>
                    <p class="onboarding-step-desc">
                        这是为同人创作者打造的拟真社交模拟 PWA — 你可以在里面跟自己的角色 LINE 聊天、逛模拟论坛、发推、写小说、做杂志访谈、听 AI 生成的广播剧。
                    </p>
                    <p class="onboarding-step-desc">
                        所有数据存在你设备上，<strong>不会上传到任何服务器</strong>。这是个属于你一个人的小宇宙。
                    </p>
                `;
            case 1:
                return `
                    <div class="onboarding-illust">
                        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="10" y="20" width="44" height="32" rx="4"/>
                            <path d="M10 28h44"/>
                            <circle cx="18" cy="24" r="1.5" fill="currentColor"/>
                            <circle cx="24" cy="24" r="1.5" fill="currentColor"/>
                            <path d="M22 38h20M22 44h12"/>
                        </svg>
                    </div>
                    <h2 class="onboarding-step-title">第一步：配置 API</h2>
                    <p class="onboarding-step-desc">
                        所有 AI 生成内容（聊天、回帖、推特、小说...）都需要 LLM API。<strong>没配 API 的话 AI 部分不会动</strong>，所以这是绕不开的第一步。
                    </p>
                    <p class="onboarding-step-desc">
                        进入<strong>设置 → API 接続</strong>，支持：
                    </p>
                    <ul style="font-size:13px; color:var(--text-secondary); line-height:1.8; padding-left:20px; margin:0;">
                        <li>Google Gemini（推荐新手，免费额度大）</li>
                        <li>OpenAI / Claude / DeepSeek</li>
                        <li>OpenRouter / 任何 OpenAI 兼容 endpoint</li>
                    </ul>
                    <div class="onboarding-tip">
                        API key 只存在你浏览器，<strong>不经过中间服务器</strong>。请求由浏览器直接发给你选的服务商。
                    </div>
                `;
            case 2:
                return `
                    <h2 class="onboarding-step-title">这里有什么</h2>
                    <p class="onboarding-step-desc">
                        Perigee OS 是一整套同人创作工具集，每个图标都是一个独立的小世界：
                    </p>
                    <div class="onboarding-modules">
                        <div class="onboarding-module-card">
                            <div class="onboarding-module-card-title">LINE</div>
                            <div class="onboarding-module-card-desc">沉浸式聊天 + 群聊 + 语音</div>
                        </div>
                        <div class="onboarding-module-card">
                            <div class="onboarding-module-card-title">论坛</div>
                            <div class="onboarding-module-card-desc">5ch 风格、AI NPC 互怼</div>
                        </div>
                        <div class="onboarding-module-card">
                            <div class="onboarding-module-card-title">推特</div>
                            <div class="onboarding-module-card-desc">多账号、发推、生图</div>
                        </div>
                        <div class="onboarding-module-card">
                            <div class="onboarding-module-card-title">Pixiv</div>
                            <div class="onboarding-module-card-desc">写小说、连载、续写</div>
                        </div>
                        <div class="onboarding-module-card">
                            <div class="onboarding-module-card-title">杂志</div>
                            <div class="onboarding-module-card-desc">访谈 + 一键广播剧</div>
                        </div>
                        <div class="onboarding-module-card">
                            <div class="onboarding-module-card-title">Niconico</div>
                            <div class="onboarding-module-card-desc">视频 / 广播剧 + 弹幕</div>
                        </div>
                        <div class="onboarding-module-card">
                            <div class="onboarding-module-card-title">メロン</div>
                            <div class="onboarding-module-card-desc">同人商店上架</div>
                        </div>
                        <div class="onboarding-module-card">
                            <div class="onboarding-module-card-title">桌面</div>
                            <div class="onboarding-module-card-desc">长按编辑、widget、贴纸</div>
                        </div>
                    </div>
                `;
            case 3:
                return `
                    <div class="onboarding-illust">
                        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="32" cy="32" r="22"/>
                            <polyline points="22 32 30 40 44 24"/>
                        </svg>
                    </div>
                    <h2 class="onboarding-step-title">准备好了</h2>
                    <p class="onboarding-step-desc">
                        每个板块还有更多细节 — 多账号系统、声優语音绑定、当て字読音表、自定义 CSS、数据导出导入...
                    </p>
                    <p class="onboarding-step-desc">
                        都写在<strong>使用指南</strong>里，随时可以从<strong>设置 → 使用指南</strong>翻回来看。
                    </p>
                    <div class="onboarding-tip">
                        点下方按钮直接打开完整指南，或点跳过开始用。指南任何时候都能从设置里再找到。
                    </div>
                `;
        }
        return '';
    }
};
