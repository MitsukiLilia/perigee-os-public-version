// 骰子/抽签功能模块
const Fortune = {
    currentTheme: null,
    options: [],
    history: [], // 抽签历史
    editingThemeId: null, // 正在编辑的主题ID

    init() {
        // 初始化抽签数据
        if (!AppState.data.fortuneData) {
            AppState.data.fortuneData = {
                themes: [], // [{id, name, options: []}]
                history: [] // [{id, theme, result, timestamp}]
            };
        }

        this.renderThemeList();
        this.renderHistory();
    },

    // 渲染主题列表
    renderThemeList() {
        const list = document.getElementById('fortuneThemeList');
        if (!list) return;

        const themes = AppState.data.fortuneData.themes || [];

        if (themes.length === 0) {
            list.innerHTML = `<div class="empty-state">${I18n.t('fortune.no_themes', '暂无主题，点击下方创建新主题')}</div>`;
            return;
        }

        list.innerHTML = themes.map(theme => `
            <div class="fortune-theme-item" onclick="Fortune.selectTheme('${theme.id}')">
                <div class="theme-name">${theme.name}</div>
                <div class="theme-count">${I18n.t('fortune.option_count', { n: theme.options.length })}</div>
                <div class="theme-actions">
                    <button class="theme-edit-btn" onclick="Fortune.openEditModal('${theme.id}'); event.stopPropagation();" title="编辑">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="theme-delete-btn" onclick="Fortune.deleteTheme('${theme.id}'); event.stopPropagation();" title="删除">×</button>
                </div>
            </div>
        `).join('');
    },

    // 选择主题
    selectTheme(themeId) {
        const theme = AppState.data.fortuneData.themes.find(t => t.id === themeId);
        if (!theme || !theme.options || theme.options.length === 0) {
            alert(I18n.t('fortune.no_options_alert', '该主题没有选项，请先添加选项'));
            return;
        }

        this.currentTheme = theme;
        Navigation.goTo('fortune-draw');
        this.renderDrawScreen();
    },

    // 渲染抽签界面
    renderDrawScreen() {
        if (!this.currentTheme) return;

        document.getElementById('fortuneDrawTitle').textContent = this.currentTheme.name;
        document.getElementById('fortuneResult').textContent = '?';
        document.getElementById('fortuneResult').className = 'fortune-result';

        // 显示所有选项
        const optionsList = document.getElementById('fortuneOptionsList');
        optionsList.innerHTML = this.currentTheme.options.map((opt, idx) => `
            <div class="fortune-option-chip">${opt}</div>
        `).join('');
    },

    // 抽签动画
    async draw() {
        if (!this.currentTheme || this.currentTheme.options.length === 0) return;

        const resultEl = document.getElementById('fortuneResult');
        const btn = document.getElementById('drawBtn');

        btn.disabled = true;
        resultEl.className = 'fortune-result spinning';
        resultEl.textContent = '🎲';

        // 动画效果：快速切换选项
        const options = this.currentTheme.options;
        let count = 0;
        const maxCount = 20;

        const interval = setInterval(() => {
            const randomIndex = Math.floor(Math.random() * options.length);
            resultEl.textContent = options[randomIndex];
            count++;

            if (count >= maxCount) {
                clearInterval(interval);
                // 最终结果
                const finalIndex = Math.floor(Math.random() * options.length);
                const result = options[finalIndex];

                setTimeout(() => {
                    resultEl.textContent = result;
                    resultEl.className = 'fortune-result revealed';
                    btn.disabled = false;

                    // 保存到历史
                    this.saveToHistory(result);
                }, 100);
            }
        }, 80);
    },

    // 保存到历史
    saveToHistory(result) {
        const historyItem = {
            id: Utils.generateId(),
            theme: this.currentTheme.name,
            result: result,
            timestamp: Date.now()
        };

        AppState.data.fortuneData.history.unshift(historyItem);

        // 只保留最近 50 条
        if (AppState.data.fortuneData.history.length > 50) {
            AppState.data.fortuneData.history = AppState.data.fortuneData.history.slice(0, 50);
        }

        Utils.saveData();
    },

    // 渲染历史记录
    renderHistory() {
        const list = document.getElementById('fortuneHistoryList');
        if (!list) return;

        const history = AppState.data.fortuneData.history || [];

        if (history.length === 0) {
            list.innerHTML = `<div class="empty-state">${I18n.t('fortune.no_history', '暂无抽签记录')}</div>`;
            return;
        }

        list.innerHTML = history.slice(0, 20).map(item => {
            const date = new Date(item.timestamp);
            const timeStr = date.toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div class="history-item">
                    <div class="history-theme">${item.theme}</div>
                    <div class="history-result">${item.result}</div>
                    <div class="history-time">${timeStr}</div>
                </div>
            `;
        }).join('');
    },

    // 打开创建主题模态框
    openCreateModal() {
        this.editingThemeId = null; // 重置编辑状态

        document.getElementById('fortuneThemeName').value = '';
        document.getElementById('fortuneOptionsInput').value = '';

        // 恢复模态框标题和按钮文字
        const modalTitle = document.querySelector('#fortuneThemeModal h3');
        const createBtn = document.getElementById('fortuneThemeCreateBtn');

        if (modalTitle) {
            modalTitle.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <path d="M8 12h.01" /><path d="M12 12h.01" /><path d="M16 12h.01" />
                </svg>
                创建抽签主题
            `;
        }

        if (createBtn) createBtn.textContent = '创建';

        document.getElementById('fortuneThemeModal').classList.add('active');
    },

    // 打开编辑主题模态框
    openEditModal(themeId) {
        const theme = AppState.data.fortuneData.themes.find(t => t.id === themeId);
        if (!theme) return;

        this.editingThemeId = themeId;

        // 填充现有数据
        document.getElementById('fortuneThemeName').value = theme.name;
        document.getElementById('fortuneOptionsInput').value = theme.options.join('\n');

        // 修改模态框标题和按钮文字
        const modalTitle = document.querySelector('#fortuneThemeModal h3');
        const createBtn = document.getElementById('fortuneThemeCreateBtn');

        if (modalTitle) {
            modalTitle.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                编辑主题
            `;
        }

        if (createBtn) createBtn.textContent = '保存';

        document.getElementById('fortuneThemeModal').classList.add('active');
    },

    // 保存主题（创建或编辑）
    createTheme() {
        const name = document.getElementById('fortuneThemeName').value.trim();
        const optionsText = document.getElementById('fortuneOptionsInput').value.trim();

        if (!name) {
            alert('请输入主题名称');
            return;
        }

        if (!optionsText) {
            alert('请输入选项内容');
            return;
        }

        // 解析选项（支持换行或逗号分隔）
        const options = optionsText
            .split(/[\n,，]/)
            .map(opt => opt.trim())
            .filter(opt => opt.length > 0);

        if (options.length < 2) {
            alert('至少需要2个选项');
            return;
        }

        if (this.editingThemeId) {
            // 编辑模式
            const theme = AppState.data.fortuneData.themes.find(t => t.id === this.editingThemeId);
            if (theme) {
                theme.name = name;
                theme.options = options;
                Utils.saveData();
                this.renderThemeList();
                document.getElementById('fortuneThemeModal').classList.remove('active');
                Utils.showToast(I18n.t('t.fortune_theme_updated', {name}));
            }
        } else {
            // 创建模式
            const theme = {
                id: Utils.generateId(),
                name: name,
                options: options
            };

            AppState.data.fortuneData.themes.push(theme);
            Utils.saveData();
            this.renderThemeList();
            document.getElementById('fortuneThemeModal').classList.remove('active');
            Utils.showToast(I18n.t('t.fortune_theme_created', {name, n: options.length}));
        }

        this.editingThemeId = null;
    },

    // 删除主题
    deleteTheme(themeId) {
        if (!confirm('确定删除这个主题吗？')) return;

        const index = AppState.data.fortuneData.themes.findIndex(t => t.id === themeId);
        if (index !== -1) {
            AppState.data.fortuneData.themes.splice(index, 1);
            Utils.saveData();
            this.renderThemeList();
        }
    },

    // 清空历史
    clearHistory() {
        if (!confirm('确定清空所有抽签记录吗？')) return;

        AppState.data.fortuneData.history = [];
        Utils.saveData();
        this.renderHistory();
    }
};
