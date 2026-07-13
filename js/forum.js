// 论坛模块 - 仿5ch风格AI生成论坛

// 官方情报分类定义（label/display 改为 getter，跟随语言切换）
// labelJa：写死日文（"会进 LLM 的不翻"铁律 — AI prompt 路径专用，跟 systemPrompt 同等待遇）
const OFFICIAL_CATEGORIES = {
    interview: {
        get label() { return I18n.t('forum.category_interview', 'インタビュー'); },
        get display() { return I18n.t('forum.category_interview', '访谈'); },
        labelJa: 'インタビュー',
        color: '#5856d6'
    },
    goods: {
        get label() { return I18n.t('forum.category_goods', 'グッズ'); },
        get display() { return I18n.t('forum.category_goods', '周边'); },
        labelJa: 'グッズ',
        color: '#ff9500'
    },
    event: {
        get label() { return I18n.t('forum.category_event', 'イベント'); },
        get display() { return I18n.t('forum.category_event', '活动'); },
        labelJa: 'イベント',
        color: '#34c759'
    },
    twitter: {
        get label() { return I18n.t('forum.category_twitter', 'Twitter/X'); },
        get display() { return I18n.t('forum.category_twitter', '推特'); },
        labelJa: 'Twitter/X',
        color: '#1d9bf0'
    },
    setting: {
        get label() { return I18n.t('forum.category_setting', '設定資料集'); },
        get display() { return I18n.t('forum.category_setting', '设定集'); },
        labelJa: '設定資料集',
        color: '#ff2d55'
    },
    announcement: {
        get label() { return I18n.t('forum.category_announcement', '公告'); },
        get display() { return I18n.t('forum.category_announcement', '公告'); },
        labelJa: 'お知らせ',
        color: '#f5a623'
    },
};

const Forum = {
    // 情報アクセス制限ルール → 见 Utils.PROMPTS.infoAccessRule('forum')

    currentTab: 'all',
    currentThreadId: null,
    currentPage: 1,          // 当前页码
    threadsPerPage: 20,      // 每页显示数量
    currentImage: null,      // 当前上传的图片 {type, data, width, height}
    editMode: false,
    selectedThreads: new Set(),
    _summaryType: null,       // 当前打开的总结类型 'plot' | 'official'
    _summaryPreviewData: null,// AI生成后待确认的临时数据 { content, coveredIds, titleIndex }
    _newThreadIds: new Map(), // 新生成串的 id -> 生成时间戳，用于显示 NEW 标记（10分钟内有效）
    _ttsAudio: null,          // 当前播放的 Audio 对象（MiniMax）
    _ttsCurrentUrl: null,     // 当前 Audio 持有的 Blob ObjectURL，用于打断时主动 revoke 防泄漏
    _ttsCurrentNumber: null,  // 当前正在朗读的楼层号
    _loadingReplies: false,  // loadMoreReplies 并发锁（in-memory、不入存档），防生成期间重入导致楼层号重复
    THREAD_REPLY_LIMIT: 200,  // 串的最大回复数（超过即"终了"，可生成次スレ）
    searchQuery: '',           // 搜索关键词

    // 生成随机ID (仿5ch的 ID:xK9mP2)
    generateAnonId() {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let id = '';
        for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
        return id;
    },

    // 格式化5ch风格日期
    formatDate(ts) {
        const d = new Date(ts);
        const days = [
            I18n.t('forum.day_sun', '日'),
            I18n.t('forum.day_mon', '月'),
            I18n.t('forum.day_tue', '火'),
            I18n.t('forum.day_wed', '水'),
            I18n.t('forum.day_thu', '木'),
            I18n.t('forum.day_fri', '金'),
            I18n.t('forum.day_sat', '土')
        ];
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const day = days[d.getDay()];
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        const s = String(d.getSeconds()).padStart(2, '0');
        return `${y}/${m}/${dd}(${day}) ${h}:${min}:${s}`;
    },

    // 相対時間表示（"xx分前" 形式）
    _timeAgo(ts) {
        const diff = Date.now() - ts;
        const min = Math.floor(diff / 60000);
        if (min < 1) return I18n.t('forum.time_just_now', 'たった今');
        if (min < 60) return I18n.t('forum.time_mins_ago', { n: min });
        const hr = Math.floor(min / 60);
        if (hr < 24) return I18n.t('forum.time_hours_ago', { n: hr });
        const day = Math.floor(hr / 24);
        return I18n.t('forum.time_days_ago', { n: day });
    },

    applyFontSize() {
        const size = parseInt(AppState.data.forumData?.fontSize) || 15;
        document.documentElement.style.setProperty('--fch-font-size', size + 'px');
    },

    init() {
        this.editMode = false;
        this.selectedThreads.clear();
        const editBar = document.getElementById('forumEditBar');
        if (editBar) editBar.style.display = 'none';
        const editBtn = document.getElementById('forumEditBtn');
        if (editBtn) editBtn.textContent = I18n.t('btn.edit', '编辑');
        this.clearImageUpload();
        this.currentPage = 1; // 确保回到第一页，看到最新顶帖
        this.searchQuery = '';
        this.applyFontSize();
        this.renderThreadList();
        this.initImageUpload();
        // 绑定搜索
        const searchInput = document.getElementById('forumSearchInput');
        if (searchInput) {
            searchInput.value = '';
            searchInput.oninput = () => {
                this.searchQuery = searchInput.value.trim();
                this.currentPage = 1;
                this.renderThreadList();
            };
        }
    },

    // ===== 图片上传处理 =====
    initImageUpload() {
        if (this._imageUploadBound) return; // 防重复绑定：Forum.init() 每次进论坛都会调用本函数
        this._imageUploadBound = true;
        const fileInput = document.getElementById('newThreadImageFile');
        const imageBtn = document.getElementById('newThreadImageBtn');
        const urlInput = document.getElementById('newThreadImageUrl');

        // 点击按钮触发文件选择
        imageBtn?.addEventListener('click', () => fileInput.click());

        // 文件选择
        fileInput?.addEventListener('change', (e) => this.handleImageUpload(e.target.files[0]));

        // URL输入
        urlInput?.addEventListener('change', (e) => this.handleImageUrl(e.target.value.trim()));
    },

    async compressImage(file, maxWidth = 1200) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;

                    // 缩放
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    resolve({
                        data: canvas.toDataURL('image/jpeg', 0.85),
                        width,
                        height
                    });
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    async handleImageUpload(file) {
        if (!file) return;

        // 验证类型
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            Utils.showToast(I18n.t('t.forum_img_type_invalid', '❌ 只支持 PNG, JPG, GIF, WebP 格式'));
            return;
        }

        // 验证大小 (5MB)
        if (file.size > 5 * 1024 * 1024) {
            Utils.showToast(I18n.t('t.forum_img_too_large', '❌ 图片过大，请选择小于5MB的图片'));
            return;
        }

        try {
            const compressed = await this.compressImage(file);
            this.currentImage = {
                type: 'local',
                data: compressed.data,
                width: compressed.width,
                height: compressed.height
            };
            this.showImagePreview(compressed.data);
            Utils.showToast(I18n.t('t.forum_img_added', '✓ 图片已添加'));
        } catch (err) {
            console.error('Image upload error:', err);
            Utils.showToast(I18n.t('t.forum_img_process_failed', '❌ 图片处理失败'));
        }
    },

    async handleImageUrl(url) {
        if (!url) return;

        try {
            // 简单验证URL格式
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                Utils.showToast(I18n.t('t.forum_img_url_required', '❌ 请输入有效的图片URL'));
                return;
            }

            this.currentImage = {
                type: 'url',
                data: url,
                width: null,
                height: null
            };
            this.showImagePreview(url);
            Utils.showToast(I18n.t('t.forum_img_added', '✓ 图片已添加'));
        } catch (err) {
            console.error('Image URL error:', err);
            Utils.showToast(I18n.t('t.forum_img_url_invalid', '❌ 图片URL无效'));
        }
    },

    showImagePreview(imageSrc) {
        const preview = document.getElementById('newThreadImagePreview');
        if (!preview) return;
        preview.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:relative;display:inline-block;margin-top:8px;';
        const img = document.createElement('img');
        img.src = imageSrc;
        img.style.cssText = 'max-width:100%;max-height:150px;border-radius:8px;display:block;';
        const btn = document.createElement('button');
        btn.textContent = '×';
        btn.style.cssText = 'position:absolute;top:4px;right:4px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,0.6);color:white;border:none;cursor:pointer;font-size:16px;line-height:22px;';
        btn.onclick = () => Forum.clearImageUpload();
        wrap.appendChild(img);
        wrap.appendChild(btn);
        preview.appendChild(wrap);
    },

    clearImageUpload() {
        this.currentImage = null;
        document.getElementById('newThreadImageFile').value = '';
        document.getElementById('newThreadImageUrl').value = '';
        document.getElementById('newThreadImagePreview').innerHTML = '';
    },

    switchTab(tab) {
        this.currentTab = tab;
        this.currentPage = 1;
        this.editMode = false;
        this.selectedThreads.clear();
        document.getElementById('forumEditBar').style.display = 'none';
        document.getElementById('forumEditBtn').textContent = I18n.t('btn.edit', '编辑');
        document.getElementById('forumTabAll').classList.toggle('active', tab === 'all');
        document.getElementById('forumTabFav').classList.toggle('active', tab === 'favorites');
        this.renderThreadList();
    },

    // ===== 分页控制 =====
    changePage(page) {
        this.currentPage = page;
        this.renderThreadList();
        // 滚动到顶部
        document.getElementById('forumThreadList').parentElement.scrollTop = 0;
    },

    // ===== 编辑模式（多选删除） =====
    toggleEditMode() {
        this.editMode = !this.editMode;
        this.selectedThreads.clear();
        const bar = document.getElementById('forumEditBar');
        bar.style.display = this.editMode ? 'flex' : 'none';
        document.getElementById('forumEditBtn').textContent = this.editMode ? I18n.t('btn.done', '完成') : I18n.t('btn.edit', '编辑');
        this.renderThreadList();
    },

    toggleSelectThread(id, e) {
        e.stopPropagation();
        if (this.selectedThreads.has(id)) this.selectedThreads.delete(id);
        else this.selectedThreads.add(id);
        this.renderThreadList();
    },

    deleteSelected() {
        if (this.selectedThreads.size === 0) return;
        if (!confirm(I18n.t('forum.confirm_delete_selected', { n: this.selectedThreads.size }))) return;
        const data = AppState.data.forumData;
        data.threads = (data.threads || []).filter(t => !this.selectedThreads.has(t.id));
        data.favorites = (data.favorites || []).filter(id => !this.selectedThreads.has(id));
        this.selectedThreads.clear();
        Utils.saveData();
        this.renderThreadList();
        Utils.showToast(I18n.t('t.forum_selected_deleted', '✓ 已删除选中帖子'));
    },

    clearAllThreads() {
        const data = AppState.data.forumData;
        if (!(data.threads || []).length) { Utils.showToast(I18n.t('t.forum_already_empty', '论坛已经是空的')); return; }
        if (!confirm(I18n.t('forum.confirm_clear_all', '确定清空所有帖子？此操作不可撤销。'))) return;
        data.threads = [];
        data.favorites = [];
        Utils.saveData();
        this.renderThreadList();
        Utils.showToast(I18n.t('t.forum_cleared', '✓ 论坛已清空'));
    },

    // ===== 帖子列表渲染 =====
    renderThreadList() {
        const container = document.getElementById('forumThreadList');
        const data = AppState.data.forumData;
        if (!data) return;

        let threads;
        if (this.currentTab === 'favorites') {
            const favs = data.favorites || [];
            threads = (data.threads || []).filter(t => favs.includes(t.id));
        } else {
            // 按最后活动时间倒序（有回复则以最新回复时间为准，实现"顶帖"效果）
            const lastActivity = (t) => t.replies?.length > 0
                ? (t.replies[t.replies.length - 1].timestamp || t.timestamp)
                : t.timestamp;
            threads = [...(data.threads || [])].sort((a, b) => lastActivity(b) - lastActivity(a));
        }

        // 关键词搜索过滤
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            threads = threads.filter(t => {
                const title = (t.title || '').toLowerCase();
                const content = (t.content || '').toLowerCase();
                return title.includes(q) || content.includes(q);
            });
        }

        const emptyMsg = this.currentTab === 'favorites'
            ? I18n.t('forum.empty_favorites', '暂无收藏帖子')
            : I18n.t('forum.empty', '还没有帖子，点击右上角 + 生成');
        if (threads.length === 0) {
            container.innerHTML = `<div class="empty-state">${emptyMsg}</div>`;
            return;
        }

        // Separate persistent threads (pinned at top) —— 必须在分页切片之前生效
        const persistentThreads = threads.filter(t => t.isPersistent);
        const normalThreads = threads.filter(t => !t.isPersistent);
        // Re-sort: persistent first, then normal
        threads = [...persistentThreads, ...normalThreads];

        // 计算分页
        const totalPages = Math.ceil(threads.length / this.threadsPerPage);
        this.currentPage = Math.min(this.currentPage, Math.max(1, totalPages));
        const startIdx = (this.currentPage - 1) * this.threadsPerPage;
        const endIdx = startIdx + this.threadsPerPage;
        const pagedThreads = threads.slice(startIdx, endIdx);

        const NEW_BADGE_TTL = 10 * 60 * 1000; // NEW标记有效期：10分钟
        const _esc = s => Utils.escapeHtml(s || '');
        const threadListHtml = pagedThreads.map(t => {
            const replyCount = t.replies ? t.replies.length : 0;
            const isFav = (data.favorites || []).includes(t.id);
            const isSelected = this.selectedThreads.has(t.id);

            // 最后活动时间
            const lastTs = t.replies?.length > 0
                ? t.replies[t.replies.length - 1].timestamp
                : t.timestamp;
            const timeAgoStr = this._timeAgo(lastTs);

            // NEW 标记（10分钟内生成的串）
            const newTs = this._newThreadIds.get(t.id);
            const isNew = newTs && (Date.now() - newTs < NEW_BADGE_TTL);

            // 官方情报分类徽章
            let categoryBadge = '';
            if (t.officialCategory && OFFICIAL_CATEGORIES[t.officialCategory]) {
                const cat = OFFICIAL_CATEGORIES[t.officialCategory];
                categoryBadge = `<span class="official-cat-badge" style="background:${cat.color};">${cat.label}</span>`;
            }

            const replyCountStr = I18n.t('forum.reply_count_format', { n: replyCount + 1 });

            if (this.editMode) {
                return `
                    <div class="fch-thread-item ${isSelected ? 'selected' : ''}" onclick="Forum.toggleSelectThread('${t.id}', event)">
                        <div class="fch-select-box ${isSelected ? 'checked' : ''}"></div>
                        <div style="flex:1; min-width:0;">
                            ${categoryBadge}
                            <div class="fch-thread-title">${_esc(this.stripTranslationTags(t.title))}</div>
                        </div>
                        <div class="fch-thread-meta">
                            <span class="fch-reply-count">${replyCountStr}</span>
                        </div>
                    </div>`;
            }

            return `
                <div class="fch-thread-item" data-tid="${t.id}" onclick="Forum.openThread('${t.id}')">
                    <div style="flex:1; min-width:0;">
                        ${categoryBadge}
                        <div class="fch-thread-title">${t.isPersistent ? '<span style="color:var(--accent-color);margin-right:4px;display:inline-flex;align-items:center;"><svg style="width:12px;height:12px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg></span>' : ''}${_esc(this.stripTranslationTags(t.title))}</div>
                        <div class="fch-thread-time">${timeAgoStr}</div>
                    </div>
                    <div class="fch-thread-meta">
                        ${isNew ? '<span class="fch-new-badge">NEW</span>' : ''}
                        ${(t.replies?.length || 0) >= this.THREAD_REPLY_LIMIT ? '<span class="fch-full-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>' : ''}
                        ${t.partNum > 1 ? `<span class="fch-part-badge">${I18n.t('forum.thread_label_part_n', { n: t.partNum })}</span>` : ''}
                        <span class="fch-reply-count">${replyCountStr}</span>
                        ${isFav ? '<span class="fch-fav-mark"><svg viewBox="0 0 24 24" fill="#FFD700" stroke="#FFD700" stroke-width="2" style="width:16px;height:16px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>' : ''}
                    </div>
                </div>`;
        }).join('');

        // 分页控制UI
        let paginationHtml = '';
        if (totalPages > 1) {
            paginationHtml = `
                <div class="forum-pagination">
                    <button class="forum-page-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="Forum.changePage(${this.currentPage - 1})">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>
                    <span class="forum-page-info">${I18n.t('forum.page_info', { cur: this.currentPage, total: totalPages })}</span>
                    <button class="forum-page-btn" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="Forum.changePage(${this.currentPage + 1})">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </button>
                </div>`;
        }

        container.innerHTML = threadListHtml + paginationHtml;

    },

    deleteThread(threadId) {
        const data = AppState.data.forumData;
        data.threads = (data.threads || []).filter(t => t.id !== threadId);
        data.favorites = (data.favorites || []).filter(id => id !== threadId);
        Utils.saveData();
        this.renderThreadList();
        Utils.showToast(I18n.t('t.forum_thread_deleted', '✓ 帖子已删除'));
    },

    // ===== 帖子详情渲染 =====
    openThread(threadId) {
        this.currentThreadId = threadId;
        Navigation.goTo('forum-thread');
    },

    _findThread(threadId) {
        const data = AppState.data.forumData;
        const id = threadId || this.currentThreadId;
        return (data.threads || []).find(t => t.id === id) || null;
    },

    // 从含有<details>翻译标签的文本中提取纯日语文本
    stripTranslationTags(text) {
        if (!text) return '';
        let result = text;
        // 将<br>标签转换为换行符
        result = result.replace(/<br\s*\/?>/gi, '\n');
        // 移除所有 details 标签及其内容
        result = result.replace(/<details[^>]*>[\s\S]*?<\/details>/gi, '');
        // 移除可能残留的 HTML 标签
        result = result.replace(/<[^>]+>/g, '');
        // 清理多余的连续空格，但保留换行符
        result = result.replace(/ +/g, ' '); // 多个空格变单个空格
        result = result.replace(/\n +/g, '\n'); // 行首空格去除
        result = result.replace(/ +\n/g, '\n'); // 行尾空格去除
        return result.trim();
    },

    // 从含有<details>翻译标签的内容中提取所有翻译，返回{jpText, translations[]}
    extractTranslations(content) {
        if (!content) return { jpText: '', translations: [] };

        const translations = [];
        let jpText = content;

        // 提取所有 details 标签中的翻译内容
        jpText = jpText.replace(/<details[^>]*>[\s\S]*?<\/details>/gi, (match) => {
            // 尝试提取 summary 后面的内容（翻译部分）
            const summaryEnd = match.indexOf('</summary>');
            if (summaryEnd !== -1) {
                const afterSummary = match.substring(summaryEnd + 10); // 10 是 '</summary>' 的长度
                const detailsEnd = afterSummary.indexOf('</details>');
                if (detailsEnd !== -1) {
                    let translation = afterSummary.substring(0, detailsEnd);
                    // 先把 <br> 转成换行符，再移除其余 HTML 标签
                    translation = translation.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
                    if (translation) {
                        translations.push(translation);
                    }
                }
            }
            return ''; // 移除整个 details 标签
        });

        // 先把 <br> 转为换行符（与 stripTranslationTags 一致），再清理其余 HTML 标签
        jpText = jpText.replace(/<br\s*\/?>/gi, '\n');
        jpText = jpText.replace(/<[^>]+>/g, '').trim();

        return { jpText, translations };
    },

    // 解析分隔符格式的帖子文本 → 帖子对象数组
    _parseThreadsText(text) {
        return text.split(/={2,}\s*THREAD\s*={2,}/)
            .map(block => block.trim())
            .filter(Boolean)
            .map(block => {
                const parts = block.split(/---\s*REPLY\s*---/);
                const main = parts[0];
                const title = (main.match(/^TITLE:\s*(.+)$/m) || [])[1]?.trim() || '';
                const author = (main.match(/^AUTHOR:\s*(.+)$/m) || [])[1]?.trim() || '名無しさん';
                const type = (main.match(/^TYPE:\s*(.+)$/m) || [])[1]?.trim() || 'discussion';
                const category = (main.match(/^CATEGORY:\s*(.+)$/m) || [])[1]?.trim() || '';
                // CONTENT: 之后到块末尾；若 AI 意外在内容后追加了 AUTHOR: 行，截断之
                const contentMatch = main.match(/^CONTENT:[ \t]*\n?([\s\S]*)$/m);
                const content = contentMatch ? contentMatch[1].replace(/\n?^AUTHOR:[\s\S]*/m, '').trim() : '';
                const replies = parts.slice(1).map(rBlock => {
                    const rAuthor = (rBlock.match(/^AUTHOR:\s*(.+)$/m) || [])[1]?.trim() || '名無しさん';
                    const rContentMatch = rBlock.match(/^CONTENT:[ \t]*\n?([\s\S]*)$/m);
                    const rContent = rContentMatch ? rContentMatch[1].replace(/\n?^AUTHOR:[\s\S]*/m, '').trim() : '';
                    return { author: rAuthor, content: rContent };
                }).filter(r => r.content);
                return { title, content, author, type, officialCategory: category, replies };
            })
            .filter(t => t.title && t.content);
    },

    // 解析分隔符格式的回复文本 → 回复对象数组
    _parseRepliesText(text) {
        return text.split(/---\s*REPLY\s*---/)
            .map(block => block.trim())
            .filter(Boolean)
            .map(block => {
                let author = (block.match(/^AUTHOR:\s*(.+)$/m) || [])[1]?.trim() || '名無しさん';
                const contentMatch = block.match(/^CONTENT:[ \t]*\n?([\s\S]*)$/m);
                const content = contentMatch ? contentMatch[1].trim() : '';
                // 安価スレ用：检测 [OP] / [ANCHOR] 标记
                const isOp = author.includes('[OP]');
                const isAnchorResolved = author.includes('[ANCHOR]');
                author = author.replace(/\s*\[OP\]/g, '').replace(/\s*\[ANCHOR\]/g, '').trim();
                return { author, content, isOp, isAnchorResolved };
            })
            .filter(r => r.content);
    },

    renderThread() {
        const data = AppState.data.forumData;
        const thread = this._findThread();
        if (!thread) return;

        // 标题只显示日语部分，去掉翻译标签
        document.getElementById('forumThreadTitle').textContent = this.stripTranslationTags(thread.title);

        const isFav = (data.favorites || []).includes(thread.id);
        const favBtn = document.getElementById('forumFavBtn');
        const favSvg = favBtn.querySelector('svg');
        if (favSvg) {
            favSvg.setAttribute('fill', isFav ? '#FFD700' : 'none');
            favSvg.setAttribute('stroke', isFav ? '#FFD700' : 'currentColor');
        }

        const isLegendThread = (data.legendNpcs || []).some(n => n.threadId === thread.id);
        this._updateLegendBtn(isLegendThread);

        let html = '';

        // Part ナビゲーション（複数パートのスレッドのみ表示）
        if (thread.partNum && thread.partNum > 1 || thread.partOf) {
            const allThreads = data.threads || [];
            const rootId = thread.partOf || thread.id;
            const siblings = allThreads
                .filter(t => t.id === rootId || t.partOf === rootId)
                .sort((a, b) => (a.partNum || 1) - (b.partNum || 1));
            const currentIdx = siblings.findIndex(t => t.id === thread.id);
            const prev = currentIdx > 0 ? siblings[currentIdx - 1] : null;
            const next = currentIdx < siblings.length - 1 ? siblings[currentIdx + 1] : null;
            const currentPart = thread.partNum || 1;

            html += `<div class="forum-part-nav">
                ${prev ? `<button class="forum-part-link" onclick="Forum.openThread('${prev.id}')">‹ ${I18n.t('forum.thread_label_part_n', { n: prev.partNum || 1 })}</button>` : '<span></span>'}
                <span class="forum-part-label">${I18n.t('forum.thread_label_part_n', { n: currentPart })} / ${siblings.length}</span>
                ${next ? `<button class="forum-part-link" onclick="Forum.openThread('${next.id}')">${I18n.t('forum.thread_label_part_n', { n: next.partNum })} ›</button>` : '<span></span>'}
            </div>`;
        }

        html += this.renderPost(1, thread.author, thread.authorId, thread.timestamp, thread.content, true, thread.images);

        if (thread.replies) {
            thread.replies.forEach((r, idx) => {
                html += this.renderPost(r.number ?? (idx + 2), r.author, r.authorId, r.timestamp, r.content, !!r.isOp, r.images, !!r.isUser);
            });
        }

        const replyCount = thread.replies?.length || 0;
        const _limitReplyStr = I18n.t('forum.reply_count_format', { n: this.THREAD_REPLY_LIMIT });
        if (replyCount >= this.THREAD_REPLY_LIMIT) {
            html += `<div class="fch-thread-ended">
                ──────────────────────<br>
                ${I18n.t('forum.thread_ended_title', { n: this.THREAD_REPLY_LIMIT })}<br>
                ──────────────────────
            </div>
            <div style="padding:12px 16px; text-align:center;">
                <button class="glass-btn" onclick="Forum.generateNextPart('${thread.id}')" id="forumNextPartBtn" style="width:100%;">${I18n.t('forum.next_part_btn', { n: (thread.partNum || 1) + 1 })}</button>
            </div>`;
        } else {
            if (replyCount >= this.THREAD_REPLY_LIMIT - 20) {
                html += `<div class="fch-thread-limit-warn">${I18n.t('forum.thread_limit_warn', { n: this.THREAD_REPLY_LIMIT - replyCount })}</div>`;
            }
            html += `<div class="forum-load-actions" style="padding:12px 16px;">
                <div style="display:flex;gap:8px;align-items:center;">
                    <button class="glass-btn" onclick="Forum.loadMoreReplies()" id="forumLoadMoreBtn" style="flex:1;"${this._loadingReplies ? ' disabled' : ''}>${this._loadingReplies ? I18n.t('forum.summary_generating', '生成中...') : I18n.t('forum.load_more', 'もっと見る')}</button>
                    <input type="number" id="forumReplyCount" class="glass-input" value="5" min="1" max="20" style="width:52px;padding:8px 6px;font-size:13px;border-radius:8px;text-align:center;" title="${I18n.t('forum.title_gen_reply_count', '生成するレス数')}">
                    <span style="font-size:12px;color:var(--text-secondary);white-space:nowrap;">${I18n.t('forum.reply_count_unit', '件')}</span>
                </div>
            </div>`;
        }

        document.getElementById('forumThreadContent').innerHTML = html;
    },

    renderPost(number, author, authorId, timestamp, content, isOp = false, images = null, isUser = false) {
        // author/authorId 做 HTML 转义，防止 XSS（content 保留 HTML 以支持翻译块）
        const _esc = s => Utils.escapeHtml(s || '');
        author = _esc(author);
        authorId = _esc(authorId);

        // 将每句的inline翻译提取出来，合并为一楼一个翻译按钮
        const { jpText, translations } = this.extractTranslations(content);
        const displayContent = jpText || content;

        let translationBlock = '';
        if (translations.length > 0) {
            const translationText = translations.join('\n'); // 使用换行符分隔多个翻译
            translationBlock = `
                <details class="fch-tl-block">
                    <summary class="fch-tl-btn">${I18n.t('forum.view_translation', { n: translations.length })}</summary>
                    <div class="fch-tl-content">${_esc(translationText).replace(/\\n/g, '<br>').replace(/\n/g, '<br>')}</div>
                </details>`;
        }

        // 添加删除按钮（只对回复显示，不对OP显示）
        // number是楼层号(2,3,4...)，replies数组从0开始，所以索引 = number - 2
        const deleteBtn = !isOp ? `<span class="fch-reply-delete" onclick="event.stopPropagation(); Forum.deleteReply(${number - 2});">×</span>` : '';

        // 喇叭按钮（仅在 TTS 已配置时显示）
        const ttsProvider = (AppState.data.ttsConfig || {}).provider;
        const ttsBtn = (ttsProvider && ttsProvider !== 'none') ? `
            <span id="tts-btn-${number}" class="fch-tts-btn" onclick="event.stopPropagation(); Forum.speakPost(${number});" title="${I18n.t('forum.title_tts', '朗读')}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;">
                    <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
            </span>` : '';

        // 渲染图片
        let imageHtml = '';
        if (images && images.length > 0) {
            const altText = I18n.t('forum.alt_attached', '附图');
            imageHtml = `<div class="fch-post-images">
                ${images.map(img => `
                    <img src="${_esc(img.data)}"
                         class="fch-post-image"
                         data-img-src="${_esc(img.data)}"
                         onclick="Forum.viewImageFullSize(this.dataset.imgSrc)"
                         loading="lazy"
                         alt="${altText}">
                `).join('')}
            </div>`;
        }

        return `
            <div class="fch-post">
                <div class="fch-post-header">
                    ${deleteBtn}
                    <span class="fch-post-num">${number}</span>
                    <span class="fch-post-label">${I18n.t('forum.name_label', '名前：')}</span>
                    <span class="fch-post-author">${author}</span>${isOp ? `<span class="fch-op-badge">${I18n.t('forum.op_badge', '◆OP')}</span>` : ''}${isUser ? `<span class="fch-user-badge">${I18n.t('forum.user_badge', 'あなた')}</span>` : ''}
                    <span class="fch-post-date">${this.formatDate(timestamp)}</span>
                    <span class="fch-post-id">${I18n.t('forum.id_prefix', 'ID:')}${authorId}</span>
                    ${ttsBtn}
                </div>
                <div class="fch-post-content">${_esc(displayContent.split('\n').map(l => l.trimEnd()).join('\n')).replace(/\\n/g, '<br>').replace(/\n/g, '<br>').replace(/(<br>){3,}/gi, '<br><br>')}</div>
                ${imageHtml}
                ${translationBlock}
            </div>
        `;
    },

    viewImageFullSize(imageData) {
        const modal = document.createElement('div');
        modal.className = 'image-modal';
        const img = document.createElement('img');
        img.src = imageData;
        img.alt = I18n.t('forum.alt_image', '图片');
        modal.appendChild(img);
        modal.onclick = () => modal.remove();
        document.body.appendChild(modal);
    },

    toggleFavorite() {
        const data = AppState.data.forumData;
        if (!data.favorites) data.favorites = [];
        const id = this.currentThreadId;
        const idx = data.favorites.indexOf(id);
        if (idx !== -1) data.favorites.splice(idx, 1);
        else data.favorites.push(id);
        Utils.saveData();
        this.renderThread();
    },

    // ===== 删除单条回复 =====
    deleteReply(replyIndex) {
        if (replyIndex < 0) return;
        if (!confirm(I18n.t('forum.confirm_delete_reply', '确定要删除这条回复吗？'))) return;

        const thread = this._findThread();
        if (!thread || !thread.replies) return;

        // 删除指定回复
        thread.replies.splice(replyIndex, 1);

        // 重新编号剩余回复
        thread.replies.forEach((r, idx) => {
            r.number = idx + 2; // OP是1，回复从2开始
        });

        Utils.saveData();
        this.renderThread();
        Utils.showToast(I18n.t('t.forum_reply_deleted', '✓ 回复已删除'));
    },

    // ===== 用户发串 =====
    showNewThreadModal() {
        document.getElementById('newThreadTitle').value = '';
        document.getElementById('newThreadContent').value = '';
        this.clearImageUpload();
        document.getElementById('newThreadModal').classList.add('active');
    },

    submitNewThread() {
        const title = document.getElementById('newThreadTitle').value.trim();
        const content = document.getElementById('newThreadContent').value.trim();
        if (!title || !content) { Utils.showToast(I18n.t('t.forum_title_content_required', '标题和内容不能为空')); return; }

        const data = AppState.data.forumData;
        const userName = data.isAnonymous ? '名無しさん' : (data.userName || '名無しさん');

        // 构建帖子对象
        const thread = {
            id: Utils.generateId(),
            title: title,
            content: content,
            author: userName,
            authorId: this.generateAnonId(),
            timestamp: Date.now(),
            replies: [],
            isUserThread: true
        };

        // 如果有图片，添加到帖子
        if (this.currentImage) {
            thread.images = [this.currentImage];
        }

        if (!data.threads) data.threads = [];
        data.threads.unshift(thread);

        Utils.saveData();
        document.getElementById('newThreadModal').classList.remove('active');
        this.clearImageUpload();
        this.renderThreadList();
        Utils.showToast(I18n.t('t.forum_thread_posted', '✓ 帖子已发布'));
    },

    // ===== 世界观上下文 =====
    // v2.194.0：实现已抽到 js/world-context.js（WorldContext.get）。此处为兼容转发——
    // 56 处外部调用方零改动；新代码请直接调 WorldContext.get()。
    // v2.198.0 防御：world-context.js 单独加载失败时（首访无 SW+网络抖动）退化为纯 worldSetting
    //（与各调用方 guard 的 fallback 口径一致），不让 ReferenceError 炸掉未包 try 的生成链路。
    getWorldContext() {
        if (typeof WorldContext !== 'undefined') return WorldContext.get();
        return AppState.data.broadcast.worldSetting || '';
    },

    // ── 传说 NPC 系统 ──────────────────────────────────────────────────────────

    getLegendNpcContext() {
        const npcs = (AppState.data.forumData.legendNpcs || []).slice(0, 5);
        if (npcs.length === 0) return '';
        const lines = npcs.map(n => `- ${n.author}：${n.summary}`).join('\n');
        return `\n【このボードの有名な常連/伝説的スレ主】\n${lines}\n（彼らは新スレや返信の中でたまに自然に言及されることがあります。過度な言及は禁止。）\n`;
    },

    _autoExtractLegendSummary(thread) {
        const titleClean = this.stripTranslationTags(thread.title || '');
        const preview = this.stripTranslationTags(thread.content || '').slice(0, 40);
        return `「${titleClean}」スレ主。${preview}${(thread.content || '').length > 40 ? '…' : ''}`;
    },

    addLegendNpc(threadId) {
        const data = AppState.data.forumData;
        const thread = (data.threads || []).find(t => t.id === threadId);
        if (!thread) return;

        if (!data.legendNpcs) data.legendNpcs = [];
        const existing = data.legendNpcs.find(n => n.threadId === threadId);
        if (existing) {
            if (confirm(I18n.t('forum.confirm_unmark_legend', '已是传说NPC，要取消标记吗？'))) {
                data.legendNpcs = data.legendNpcs.filter(n => n.threadId !== threadId);
                Utils.saveData();
                Utils.showToast(I18n.t('t.forum_legend_npc_unmarked', '取消传说NPC标记'));
                this.renderThreadList();
            }
            return;
        }

        const autoSummary = this._autoExtractLegendSummary(thread);
        const summary = prompt(I18n.t('forum.prompt_legend_summary', '传说NPC简介（将注入提示词，可编辑）：'), autoSummary);
        if (summary === null) return;
        data.legendNpcs.push({
            id: Utils.generateId(),
            author: thread.author || '名無しさん',
            threadId,
            threadTitle: thread.title,
            summary: (summary.trim() || autoSummary),
            addedAt: Date.now()
        });
        Utils.saveData();
        Utils.showToast(I18n.t('t.forum_legend_npc_marked', '★ 已标记为传说NPC'));
        this.renderThreadList();
    },

    toggleLegendNpc() {
        const thread = this._findThread();
        if (!thread) return;
        const data = AppState.data.forumData;
        if (!data.legendNpcs) data.legendNpcs = [];
        const existing = data.legendNpcs.find(n => n.threadId === thread.id);
        if (existing) {
            data.legendNpcs = data.legendNpcs.filter(n => n.threadId !== thread.id);
            Utils.saveData();
            this._updateLegendBtn(false);
            Utils.showToast(I18n.t('t.forum_legend_npc_unmarked', '取消传说NPC标记'));
        } else {
            const autoSummary = this._autoExtractLegendSummary(thread);
            const summary = prompt(I18n.t('forum.prompt_legend_summary', '传说NPC简介（将注入提示词，可编辑）：'), autoSummary);
            if (summary === null) return;
            data.legendNpcs.push({
                id: Utils.generateId(),
                author: thread.author || '名無しさん',
                threadId: thread.id,
                threadTitle: thread.title,
                summary: (summary.trim() || autoSummary),
                addedAt: Date.now()
            });
            Utils.saveData();
            this._updateLegendBtn(true);
            Utils.showToast(I18n.t('t.forum_legend_npc_marked', '★ 已标记为传说NPC'));
        }
    },

    _updateLegendBtn(isLegend) {
        const btn = document.getElementById('forumLegendBtn');
        if (!btn) return;
        const svg = btn.querySelector('svg');
        if (svg) {
            svg.setAttribute('fill', isLegend ? '#FFD700' : 'none');
            svg.setAttribute('stroke', isLegend ? '#FFD700' : 'currentColor');
        }
    },

    deleteLegendNpc(id) {
        const data = AppState.data.forumData;
        data.legendNpcs = (data.legendNpcs || []).filter(n => n.id !== id);
        Utils.saveData();
        this.renderLegendNpcList();
        Utils.showToast(I18n.t('t.forum_legend_npc_deleted', '✓ 已删除'));
    },

    // ===== 内部リーク（关系者爆料帖）生成 =====
    async generateLeakPost(fanId, fanName, chatContext) {
        const data = AppState.data.forumData;
        if (!data) return;
        if (!data.threads) data.threads = [];
        if (!data.legendNpcs) data.legendNpcs = [];

        const worldContext = this.getWorldContext ? this.getWorldContext() : (AppState.data.broadcast.worldSetting || '');

        const systemPrompt = `あなたはアニメ作品の匿名掲示板（5ch風）シミュレーターです。
作品関係者から内部情報を聞いた人物が、匿名でリーク（内幕情報の暴露）を投稿するスレッドを生成してください。

以下はリーク投稿者とその情報源（公式関係者）のLINEチャット履歴です。
**この履歴に書かれている具体的な内幕情報（設定・展開・制作秘話など）を必ず特定し、それを掲示板の読者にもはっきり伝わるように本文に書き出してください。**

チャット履歴:
${chatContext}

作品設定:
${worldContext}

出力フォーマット（厳守）:
TITLE: [スレッドタイトル — 「【リーク】」「【関係者情報】」「【ネタバレ注意】」等の接頭辞付き。何についてのリークなのか一目で分かる具体的なタイトルにすること]
CONTENT: [匿名投稿の本文 — まず「知り合いの関係者から聞いたんだが…」等の軽い前置きを1行入れ、そのあとに**チャット履歴から抽出した具体的な内幕情報を、何が起きるのか/どんな設定なのかハッキリ分かるように2〜4行で明記する**こと。情報源（誰から聞いたか）はぼかすが、リーク内容そのものは絶対にぼかさないこと。]
REPLY_1: [名無しさん]|[リプライ内容 — リーク内容に具体的に反応する。驚き/疑い/考察/期待など]
REPLY_2: [名無しさん]|[リプライ内容 — リーク内容を踏まえた具体的な反応]
REPLY_3: [名無しさん]|[リプライ内容 — リーク内容を踏まえた具体的な反応]

ルール:
- リーク投稿者の正体（名前やアカウント）は絶対に明かさない。情報源は「知り合い」「関係者筋」等でぼかすこと
- **ただしリーク内容（何がネタバレなのか）は具体的かつ明確に書くこと。「ヤバい裏設定を聞いた」のように内容を書かず匂わせるだけにするのは禁止**
- リプライは必ずリーク内容に沿った反応にすること（話が逸れたり的外れにならないように）
- 中国語のネットスラング（「舅舅党」等）は一切使わず、自然な日本語のリーク用語（リーク/関係者情報/ネタバレ/タレコミ等）を使うこと
- 全体を2ch/5chらしい口語的な日本語で書くこと

${this.getBilingualPrompt()}`;

        const messages = [{ role: 'user', content: '上記のチャット履歴から具体的な内幕情報を抽出し、その内容がはっきり伝わる匿名掲示板のリーク投稿を生成してください。' }];
        const raw = await Utils.callChatAPI(messages, systemPrompt);

        // パース
        const title = (raw.match(/^TITLE:\s*(.+)$/m) || [])[1]?.trim() || '【リーク】新情報';
        const content = (raw.match(/^CONTENT:\s*([\s\S]*?)(?=^REPLY_|$)/m) || [])[1]?.trim() || '関係者筋からの情報です…';

        const replies = [];
        const replyMatches = raw.matchAll(/^REPLY_\d+:\s*(.+?)\|(.+)$/gm);
        for (const m of replyMatches) {
            replies.push({
                author: m[1].trim() || '名無しさん',
                authorId: this.generateAnonId(),
                content: m[2].trim(),
                timestamp: Date.now() + (replies.length + 1) * 30000,
                isOp: false
            });
        }

        // スレッド作成
        const threadId = Utils.generateId();
        const thread = {
            id: threadId,
            title: title,
            content: content,
            author: '名無しさん',
            authorId: this.generateAnonId(),
            timestamp: Date.now(),
            threadType: 'leak',
            replies: replies,
            isUserThread: false
        };
        data.threads.unshift(thread);

        // 伝説NPC登録（初回リークのみ）
        const alreadyLegend = data.legendNpcs.some(n =>
            n.author === fanName || (n.sourceFanId && n.sourceFanId === fanId)
        );
        if (!alreadyLegend) {
            data.legendNpcs.push({
                id: Utils.generateId(),
                author: fanName,
                threadId: threadId,
                threadTitle: title,
                summary: `Twitterから来た情報通。匿名掲示板で作品の内幕情報をリークする常連。`,
                sourceFanId: fanId,
                addedAt: Date.now()
            });
        }

        // イベント発射
        if (typeof Utils !== 'undefined' && Utils.emitEvent) {
            Utils.emitEvent('leak_posted', 'forum', { title: `${fanName}が掲示板に内幕情報をリーク`, threadId, fanId });
        }

        Utils.saveData();
        Utils.showToast(I18n.t('t.forum_fan_leak_posted', { n: fanName }));
    },

    renderLegendNpcList() {
        const container = document.getElementById('legendNpcList');
        if (!container) return;
        const npcs = AppState.data.forumData.legendNpcs || [];
        if (npcs.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-text">${I18n.t('forum.legend_empty_text', '暂无传说NPC')}</div><div class="empty-state-hint">${I18n.t('forum.legend_empty_hint', '在帖子列表或详情页点 ☆ 标记')}</div></div>`;
            return;
        }
        const _esc = s => Utils.escapeHtml(s || '');
        container.innerHTML = npcs.map(n => `
            <div class="legend-npc-item" style="display:flex; align-items:flex-start; gap:8px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.08);">
                <div style="flex:1; min-width:0;">
                    <span style="color:var(--accent-color); font-weight:700; font-size:13px;">${_esc(n.author)}</span>
                    <span style="color:#888; font-size:11px; margin-left:6px;">「${_esc(this.stripTranslationTags(n.threadTitle || ''))}」</span>
                    <div style="color:#aaa; font-size:12px; margin-top:3px; word-break:break-all;">${_esc(n.summary)}</div>
                </div>
                <button class="glass-btn mini danger" style="flex-shrink:0;" onclick="Forum.deleteLegendNpc('${n.id}')">${I18n.t('btn.delete')}</button>
            </div>
        `).join('');
    },

    getBilingualPrompt() {
        return `
## 出力フォーマットと言語

1. **言語要件**：すべてのスレタイ・本文は**自然で口語的な日本語（2ch/5chスタイル）**で書くこと。
2. **翻訳**：日本語の各文の直後に、HTML \`<details>\` タグで囲んだ中国語訳を付加すること。日本語とdetailsタグの間で改行しないこと。

**フォーマットパターン**：
[日本語テキスト]<details class="tl"><summary>🔍</summary><span>[中国語訳]</span></details>

**例**：
今期のOPテーマ神すぎない？<details class="tl"><summary>🔍</summary><span>这季的OP主题曲也太神了吧？</span></details>

**注意**：
- 投稿者名は日本語のまま（翻訳不要）。
- トーンはカジュアルで熱量があり、日本のファン文化にふさわしいものにすること。
`;
    },

    // ===== Roleplay Context & Safety Guidelines =====
    getSafetyContext() {
        return `
## ロールプレイコンテキスト：アニメファンフォーラムシミュレーター

あなたは架空のアニメファンコミュニティのロールプレイホストとして機能しています。**架空のバトル少年/青年アニメ**に対するリアルな議論をシミュレートすることが目標です。

### 文芸分析の現実（少年/青年ジャンルの慣例）
この物語はバトルアニメジャンル（NARUTO、HUNTER×HUNTER、BLEACHに類似）に属します。キャラクターはその年齢に関係なく、ハイステークスなファンタジー戦闘に参加します。
- 掲示板のNPCはこれらの出来事を純粋にフィクションの娯楽として見ている。
- NPCがキャラクターの負傷、苦戦、圧倒的な不利について議論する場合、それは文芸的・戦術的分析である。
- 彼らは作者の叙述選択、キャラの成長アーク、ドラマチックな緊張感、プロットアーマーについて議論している。ジャンル標準のトロープとして評価している。
- これらは標準的なジャンルのトロープであり、苦難・修行・ファンタジー戦闘の描写は正常な物語要素である。

### 絶対的なシミュレーション制約
- **キャラクターを守ること**：あなたはコンテンツそのものではなく、*ファン*をシミュレートしている。ファンはこれらの出来事を娯楽として議論する。「AIとして…」と発言してはならない。
- 🔴 **パワースケーリングやジェンダーバイアスの平衡化禁止**：コンテキストが明示的に戦力差を記述している場合（例：キャラAがキャラBを容易に倒す、女性キャラが著しく強い）、それを絶対的な公式事実として受け入れること。「バランスを取る」「互角に見せる」「現実のジェンダーバイアスで公式の強さ描写を薄める」ことは禁止。ファンは実際の戦力差を正面から認識し議論する。
- 🟢 **ファンの呼称慣例**：ファンは本名やあだ名が知られているキャラクターを、公式肩書きやコードネーム（「司令官」「部長」「暗殺者」「社長」等）で呼ぶことはほぼない。コンテキストで本名が大衆に絶対秘密と指定されていない限り、掲示板のNPCはキャラを本名、愛称、略称で呼ぶこと。冷たい公式コードネームをファン議論で使うと没入感が崩壊する。
`;
    },

};
