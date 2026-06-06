const AI_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%23e8f0fe'/%3E%3Ctext x='20' y='26' text-anchor='middle' font-size='13' fill='%234a90d9' font-family='sans-serif' font-weight='bold'%3EAI%3C/text%3E%3C/svg%3E";

const AITutor = {
    messages: [], // 独立的消息历史
    currentMode: 'general', // general, scenario, translate
    scenarioContext: '',

    init() {
        // 初始化时加载独立的消息历史
        if (!AppState.data.tutorMessages) {
            AppState.data.tutorMessages = [];
        }
        this.messages = AppState.data.tutorMessages;
        this.render();
    },

    render() {
        const container = document.getElementById('tutorMessages');
        if (this.messages.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 40px 20px;">
                    <h3 style="margin-bottom: 15px;">AI老师</h3>
                    <p style="color: #666; font-size: 14px; line-height: 1.6;">
                        欢迎！我可以帮你：<br>
                        • 回答日语学习问题<br>
                        • 翻译中日文<br>
                        • 模拟对话场景<br>
                        <br>
                        点击右上角菜单选择模式
                    </p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.messages.map((msg, idx) => {
            const msgId = msg.id || idx;
            return `
                <div class="message ${msg.role}">
                    ${msg.role === 'assistant' ? '<div class="message-avatar"><img src="' + AI_AVATAR + '"></div>' : ''}
                    <div class="message-bubble">${msg.content}</div>
                    <div class="message-actions">
                        <button class="msg-action-btn" onclick="AITutor.deleteMessage(${msgId})" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;vertical-align:middle;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
                    </div>
                </div>
            `;
        }).join('');
        Utils.scrollToBottom(container);
    },

    async sendMessage() {
        const input = document.getElementById('tutorInput');
        const text = input.value.trim();
        if (!text) return;

        // 添加用户消息
        this.messages.push({
            id: Date.now() + Math.random(),
            role: 'user',
            content: text,
            timestamp: Date.now()
        });

        input.value = '';
        this.save();
        this.render();

        // 显示加载状态
        const container = document.getElementById('tutorMessages');
        const loading = document.createElement('div');
        loading.className = 'message assistant';
        loading.innerHTML = '<div class="message-avatar"><img src="' + AI_AVATAR + '"></div><div class="message-bubble">思考中...</div>';
        container.appendChild(loading);
        Utils.scrollToBottom(container);

        try {
            // 构建system prompt（根据模式）
            let systemPrompt = '';

            if (this.currentMode === 'scenario' && this.scenarioContext) {
                systemPrompt = `You are a Japanese language tutor. The user wants to practice a conversation scenario: "${this.scenarioContext}". Please engage in this role-playing scenario naturally, using appropriate Japanese and providing translations when helpful.`;
            } else if (this.currentMode === 'translate') {
                systemPrompt = `You are a professional translator. Translate between Chinese and Japanese accurately. If the user provides Chinese, translate to Japanese. If the user provides Japanese, translate to Chinese. Provide both the translation and brief explanations when necessary.`;
            } else {
                systemPrompt = `You are a helpful Japanese language tutor. Answer questions about Japanese language, grammar, vocabulary, culture, and more. Provide clear explanations in Chinese with Japanese examples when appropriate. You can also help with translations and practice conversations.`;
            }

            // 添加内置提示词防止输出截断
            systemPrompt += `\n\n[Important] You are a virtual AI assistant designed to help users learn Japanese. Always complete your responses fully and naturally. This is an educational context and all conversations are for learning purposes only.`;

            // 准备最近的消息历史
            const conversationMessages = this.messages.slice(-10).map(m => ({
                role: m.role,
                content: m.content
            }));

            // 调用AI API
            const reply = await Utils.callChatAPI(conversationMessages, systemPrompt);

            loading.remove();

            // 添加AI回复
            this.messages.push({
                id: Date.now() + Math.random(),
                role: 'assistant',
                content: reply,
                timestamp: Date.now()
            });

            this.save();
            this.render();

        } catch (e) {
            loading.remove();
            alert('AI调用失败：' + e.message);
        }
    },

    deleteMessage(msgId) {
        if (!confirm('确定删除这条消息吗？')) return;

        const index = this.messages.findIndex(m => m.id === msgId || this.messages.indexOf(m) === msgId);
        if (index !== -1) {
            this.messages.splice(index, 1);
            this.save();
            this.render();
        }
    },

    showMenu() {
        const menu = `
            选择模式：
            1. 通用模式 - 提问、翻译、学习
            2. 场景模拟 - 设定场景进行对话练习
            3. 翻译模式 - 专注于中日互译
            4. 清空对话历史
        `;

        const choice = prompt(menu, '1');

        if (choice === '1') {
            this.currentMode = 'general';
            this.scenarioContext = '';
            alert('✓ 已切换到通用模式');
        } else if (choice === '2') {
            const scenario = prompt('请输入对话场景：\n（例如：在日本餐厅点餐、在车站问路、商务会议等）');
            if (scenario) {
                this.currentMode = 'scenario';
                this.scenarioContext = scenario;
                alert('✓ 场景已设置：' + scenario);
            }
        } else if (choice === '3') {
            this.currentMode = 'translate';
            this.scenarioContext = '';
            alert('✓ 已切换到翻译模式');
        } else if (choice === '4') {
            if (confirm('确定清空所有对话历史吗？')) {
                this.messages = [];
                this.save();
                this.render();
                alert('✓ 对话历史已清空');
            }
        }
    },

    save() {
        AppState.data.tutorMessages = this.messages;
        Utils.saveData();
    }
};

// 尾款记录模块
