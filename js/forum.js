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
        this.currentImage = null;
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
        const startIdx = (this.currentPage - 1) * this.threadsPerPage;
        const endIdx = startIdx + this.threadsPerPage;
        const pagedThreads = threads.slice(startIdx, endIdx);

        const NEW_BADGE_TTL = 10 * 60 * 1000; // NEW标记有效期：10分钟
        const _esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
                    <button class="glass-btn" onclick="Forum.loadMoreReplies()" id="forumLoadMoreBtn" style="flex:1;">${I18n.t('forum.load_more', 'もっと見る')}</button>
                    <input type="number" id="forumReplyCount" class="glass-input" value="5" min="1" max="20" style="width:52px;padding:8px 6px;font-size:13px;border-radius:8px;text-align:center;" title="${I18n.t('forum.title_gen_reply_count', '生成するレス数')}">
                    <span style="font-size:12px;color:var(--text-secondary);white-space:nowrap;">${I18n.t('forum.reply_count_unit', '件')}</span>
                </div>
            </div>`;
        }

        document.getElementById('forumThreadContent').innerHTML = html;
    },

    renderPost(number, author, authorId, timestamp, content, isOp = false, images = null, isUser = false) {
        // author/authorId 做 HTML 转义，防止 XSS（content 保留 HTML 以支持翻译块）
        const _esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    getWorldContext() {
        const data = AppState.data.forumData;
        let context = '';
        if (AppState.data.broadcast.worldSetting) context += `【世界观设定】\n${AppState.data.broadcast.worldSetting}\n\n`;
        const _wbIds = Utils.getActiveWorldBookIds();
        _wbIds.forEach(wbId => {
            const book = (AppState.data.worldBooks || []).find(b => b.id === wbId);
            if (book && book.entries) {
                context += `【世界书「${book.name}」】\n`;
                book.entries.filter(e => e.enabled !== false).forEach(e => { context += `[${e.title}] ${e.content}\n`; });
                context += '\n';
            }
        });
        if (data.forumRules) context += `【论坛规则】\n${data.forumRules}\n\n`;

        const plotProgress = AppState.data.broadcast.plotProgress || [];
        const officialInfo = AppState.data.broadcast.officialInfo || [];
        const mergedSummaries = AppState.data.broadcast.mergedSummaries || [];
        // 旧字段向前兼容
        const plotSummaries = AppState.data.broadcast.plotSummaries || [];
        const officialSummaries = AppState.data.broadcast.officialSummaries || [];

        if (!plotProgress.length && !officialInfo.length && !mergedSummaries.length && !plotSummaries.length && !officialSummaries.length) {
            return context;
        }

        // ── 合并时间线 ──────────────────────────────────────────────
        context += `【剧情与情报时间线（按事件顺序）】\n`;
        context += `⚠️ 重要说明：\n`;
        context += `- 时间线严格按顺序排列；官方情报标注了其发布节点（在某话之后）\n`;
        context += `- 若情报内容提及"即将播出X / 先行放送 / 预计发布"等，表示粉丝知道"X即将来临"，但X的具体内容尚不存在于时间线中，禁止捏造X的内容\n`;
        context += `- 官方情报（如贺图、周边、访谈）是在其标注的剧情节点之后才发布的，不能将其视为伏笔或提前知晓的信息\n\n`;

        // 已覆盖 ID 集合（合并总结 + 旧字段兼容）
        const plotCoveredSet = new Set([
            ...mergedSummaries.flatMap(s => s.coveredPlotIds || []),
            ...plotSummaries.flatMap(s => s.coveredIds || [])
        ]);
        const offCoveredSet = new Set([
            ...mergedSummaries.flatMap(s => s?.coveredInfoIds || []),
            ...officialSummaries.flatMap(s => s.coveredIds || [])
        ]);

        // 较早的历史内容——已压缩为总结
        const hasSummaries = mergedSummaries.length > 0 || plotSummaries.length > 0 || officialSummaries.length > 0;
        if (hasSummaries) {
            context += `── 早期内容总结（已压缩）──\n`;
            mergedSummaries.forEach((s, i) => {
                const titleList = (s.titleIndex || []).join('、') || `共${(s.coveredPlotIds || []).length}条剧情`;
                context += `[综合总结·第${i + 1}期（涵盖：${titleList}）]\n${s.content}\n\n`;
            });
            // 旧字段兼容输出
            plotSummaries.forEach((s, i) => {
                const titleList = (s.titleIndex || []).join('、') || `共${s.coveredIds.length}条`;
                context += `[剧情总结·第${i + 1}期（涵盖：${titleList}）]\n${s.content}\n\n`;
            });
            officialSummaries.forEach((s, i) => {
                const titleList = (s.titleIndex || []).join('、') || `共${s.coveredIds.length}条`;
                context += `[情报总结·第${i + 1}期（涵盖：${titleList}）]\n${s.content}\n\n`;
            });
            // ⚠️ 关键提示：总结内的所有事件均为已发生历史事实
            context += `⚠️ 【重要】上述总结所涵盖的全部剧情均为【已播出/已发生】的历史事实，所有官方情报均为【已公开发布】的真实内容。论坛NPC在讨论时必须将这些事件视为早已发生过的历史——禁止出现"期待播出""何时动画化""希望官方能做"等与已发生事件相矛盾的说法。\n\n`;
            context += `── 近期详细内容 ──\n\n`;
        }

        const remainingPlot = plotProgress.filter(p => !plotCoveredSet.has(p.id));
        const remainingOfficial = officialInfo.filter(e => !offCoveredSet.has(e.id));

        // 辅助：生成情报的来源标签（含 NPC 归属）
        const _entryLabel = (e) => {
            const cat = OFFICIAL_CATEGORIES[e.category] || { label: e.category };
            let npcPart = '';
            if (e.category === 'twitter' && e.sourceNpcId) {
                const lbl = this._getNpcLabel([e.sourceNpcId]);
                if (lbl) npcPart = `·${lbl}`;
            } else if (e.category === 'interview' && e.sourceNpcIds?.length) {
                const lbl = this._getNpcLabel(e.sourceNpcIds);
                if (lbl) npcPart = `·${lbl}`;
            }
            return `${cat.labelJa || cat.label}${npcPart}`;
        };

        // title 为空时用内容前 20 字代替
        const _entryTitle = (e) => e.title || (e.content.slice(0, 20) + (e.content.length > 20 ? '…' : ''));

        // 结构化周边：在 content 前多输出一行属性标签；旧式周边（无 goods 块）返回空串
        const _goodsAttrLine = (e) => {
            if (e.category !== 'goods' || !e.goods) return '';
            const g = e.goods;
            const parts = [`类型:${g.type}`, `价格:¥${g.price}`, `稀缺度:${g.rarity}`, `状态:${g.status}`];
            if (g.source) parts.push(`来源:${g.source}`);
            return `   ${parts.join('｜')}\n`;
        };

        if (remainingPlot.length === 0 && !hasSummaries) {
            // 真的还没有任何剧情（预热期）：所有官方情报直接平铺
            remainingOfficial.forEach(e => {
                context += `[官方情报·${_entryLabel(e)}]《${_entryTitle(e)}》\n${_goodsAttrLine(e)}${e.content}\n\n`;
            });
        } else if (remainingPlot.length === 0 && hasSummaries) {
            // 全部剧情已总结，剩余情报紧接总结之后输出
            if (remainingOfficial.length > 0) {
                context += `── 总结后新增情报 ──\n`;
                remainingOfficial.forEach(e => {
                    context += `[官方情报·${_entryLabel(e)}]《${_entryTitle(e)}》\n${_goodsAttrLine(e)}${e.content}\n\n`;
                });
            }
        } else {
            // 剧情开始前的官方情报（afterPlotId 为空 = 时机不明/早期）
            const prePlot = remainingOfficial
                .filter(e => !e.afterPlotId)
                .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            if (prePlot.length > 0) {
                context += `── 剧情开始前 ──\n`;
                prePlot.forEach((e, idx) => {
                    const seqLabel = prePlot.length > 1 ? ` 第${idx + 1}弾` : '';
                    context += `[官方情报·${_entryLabel(e)}]《${_entryTitle(e)}》${seqLabel ? `（${seqLabel}）` : ''}\n${_goodsAttrLine(e)}${e.content}\n\n`;
                });
            }

            // 将剧情条目与其后的官方情报交织输出
            remainingPlot.forEach(plot => {
                context += `--- ${plot.title} ---\n${plot.content}\n\n`;
                // 按 timestamp 升序排列，确保 AI 知道先后顺序
                const afterThis = remainingOfficial
                    .filter(e => e.afterPlotId === plot.id)
                    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                afterThis.forEach((e, idx) => {
                    const seqLabel = afterThis.length > 1 ? ` 第${idx + 1}弾` : '';
                    context += `  ↳ [官方情报·${_entryLabel(e)}]《${_entryTitle(e)}》（${plot.title}播出後${seqLabel}）\n${_goodsAttrLine(e)}${e.content}\n\n`;
                });
            });
        }

        context += `【当前讨论范围】请根据以上时间线内容生成讨论。NPC们应该：\n`;
        context += `- 只知道时间线中已明确记录的剧情与情报内容\n`;
        context += `- 各官方情报在其标注的剧情节点之后才被粉丝所知\n`;
        context += `- 若时间线末尾出现"预告/即将放送"类情报，NPC可以期待、猜测，但不能知道其实际内容\n`;
        context += `- ⚠️ 动画演出 ≠ 角色认知：剧情描述是面向观众的叙事（包含回忆画面、旁白、闪回、蒙太奇等演出手法）。角色只知道自己在故事中实际获得的信息——例如角色A看角色B的日记，观众看到了配合日记内容的过去影像回闪，但角色A只是在读日记文字，并没有"看到"那些过去的画面。讨论时必须区分"观众通过演出了解到的信息"和"角色本人实际知道的信息"\n`;
        context += `- ⚠️ 强弱/胜负/能力对比：时间线中明确记录的强弱关系、胜负结果是不可动摇的事实，讨论时必须按原文描述，禁止"平衡化"（如把"A轻松击败B"演绎成"势均力敌"），禁止基于角色性别、体型做任何强度预设\n\n`;

        return context;
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
            Utils.emitEvent('forum', 'leak_posted', `${fanName}が掲示板に内幕情報をリーク`, { threadId, fanId });
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
        const _esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

    // ===== AI生成帖子 =====
    async generateThreads() {
        const context = this.getWorldContext();
        if (!context.trim()) {
            Utils.showToast(I18n.t('t.forum_need_worldview', '请先在放送局设定世界观'));
            return;
        }

        const btn = document.getElementById('forumGenerateBtn');
        if (btn) { btn.textContent = '...'; btn.disabled = true; }

        // ユーザー指定のスレ数
        const threadCount = Math.max(1, Math.min(8, parseInt(document.getElementById('forumThreadCount')?.value || '3')));

        try {
            const bilingualPrompt = this.getBilingualPrompt();
            const safetyContext = this.getSafetyContext();
            const data = AppState.data.forumData;

            // ── 主类型池（高频，正常轮换）──
            const mainTypes = [
                { type: 'discussion', label: '感想/考察スレ (剧情感想/分析)' },
                { type: 'ship', label: 'カプ語りスレ (磕CP/恋爱关系讨论)' },
                { type: 'analysis', label: '伏線考察スレ (伏笔考据/细节分析)' },
                { type: 'song', label: 'OP/ED/挿入歌スレ (歌曲/BGM鉴赏)' },
                { type: 'fanfic', label: 'SS/二次創作スレ (同人短篇)' },
                { type: 'meme', label: 'ネタ/コラスレ (梗图/搞笑)' },
                { type: 'livewatch', label: '実況スレ (实况/直播反应)' },
                { type: 'chara', label: 'キャラ語りスレ (角色深度讨论)' },
                { type: 'prediction', label: '展開予想スレ (剧情预测/展望)' },
                { type: 'daily', label: '日常妄想スレ (角色日常/if线妄想)' },
                { type: 'comparison', label: '比較スレ (作品内/跨作品对比)' },
                { type: 'nostalgia', label: '懐かしスレ (怀旧/经典回顾)' },
                { type: 'newbie', label: '初心者スレ (新人入坑/推荐)' },
                { type: 'poll', label: '人気投票/ランキングスレ (人气投票)' },
            ];

            // ── 官方情报关联类型（仅当对应分类的情报实际存在时才加入池）──
            const officialInfo = AppState.data.broadcast.officialInfo || [];
            // 计算已被合并总结覆盖的 ID 集合，避免将旧情报当"速报"注入
            const _mergedSums = AppState.data.broadcast.mergedSummaries || [];
            const _plotSums = AppState.data.broadcast.plotSummaries || [];
            const offCoveredSet = new Set([
                ..._mergedSums.flatMap(s => s?.coveredInfoIds || []),
                ...(AppState.data.broadcast.officialSummaries || []).flatMap(s => s.coveredIds || [])
            ]);
            const plotCoveredSet = new Set([
                ..._mergedSums.flatMap(s => s.coveredPlotIds || []),
                ..._plotSums.flatMap(s => s.coveredIds || [])
            ]);
            // 只保留"未被总结"的新鲜情报，用于速报注入和热度判断
            const uncoveredOfficialInfo = officialInfo.filter(e => !offCoveredSet.has(e.id));
            // ── 时间窗过滤：只有挂靠在最新 2 条剧情上的情报才算"速报级新鲜"──
            // 旧话的情报即使未被总结，也不应作为热点话题注入新帖
            const _plotIds = (AppState.data.broadcast.plotProgress || []).map(p => p.id);
            const _recentPlotIdSet = new Set(_plotIds.slice(-2)); // 最新 2 条剧情的 ID
            const freshOfficialInfo = uncoveredOfficialInfo.filter(e =>
                e.afterPlotId && _recentPlotIdSet.has(e.afterPlotId)
            );
            const officialTypes = [];
            if (freshOfficialInfo.some(i => i.category === 'interview' || i.category === 'twitter')) {
                officialTypes.push({ type: 'official-interview', label: 'インタビュー/声優語りスレ (访谈/声优相关，可结合采访内容讨论)' });
            }
            if (freshOfficialInfo.some(i => i.category === 'goods')) {
                officialTypes.push({ type: 'official-goods-ship', label: 'グッズでカプを語るスレ (从官方周边/设定集里嗑CP)' });
            }
            if (freshOfficialInfo.some(i => i.category === 'event')) {
                officialTypes.push({ type: 'official-event', label: 'イベント/ライブレポスレ (活动/现场/展览情报讨论)' });
            }
            if (freshOfficialInfo.some(i => i.category === 'setting')) {
                officialTypes.push({ type: 'official-setting', label: '設定資料集/公式設定考察スレ (设定集/官方设定深挖)' });
            }
            if (freshOfficialInfo.some(i => i.category === 'announcement')) {
                officialTypes.push({ type: 'official-announcement', label: '公式発表/重大発表スレ (官方重大公告发布后的粉丝第一反应)' });
            }
            if (freshOfficialInfo.some(i => i.category === 'goods' && i.isGoodsRelease)) {
                officialTypes.push({ type: 'official-goods-repo', label: 'グッズ質感レポスレ (周边到货开箱/质感讨论)' });
            }

            // ── 展会话题闸门：即売会が档期窗口（preopen〜closed+1話）内にある時だけ即売会レポ系を解禁 ──
            const eventGate = (typeof Melonbooks !== 'undefined' && Melonbooks.getEventTopicGate)
                ? Melonbooks.getEventTopicGate()
                : { open: false, stage: null, events: [], topics: [] };

            // ── 稀有类型池（极低频，只有其他类型都轮过一遍才出现）──
            // event_report は闸门が閉じている時 rareTypes 数组の源头から除外する
            // → 下游の保底 / tweet_event boost / 兜底回填 の三条路径が自动で全て失效
            const rareTypes = [
                { type: 'powerlevels', label: '戦闘力/強さ議論スレ (战力讨论，仅偶尔出现)' },
                { type: 'tierlist', label: 'Tier表スレ (角色分级，仅偶尔出现)' },
                { type: 'anchor', label: '安価スレ (安价互动)' },
                { type: 'seiyuu', label: '声優/スタッフスレ (声优/制作组讨论)' },
                { type: 'goods', label: 'グッズ/聖地スレ (周边/圣地巡礼)' },
                { type: 'anti', label: 'アンチスレ (黑串/批评讨论，仅极偶尔出现，要有粉丝守护反制)' },
                { type: 'event_report', label: '即売会レポスレ (同人イベント参加レポート・戦利品紹介)' },
                { type: 'doujin_review', label: '同人誌感想スレ (同人誌の感想・レビュー)' },
                { type: 'cosplay_thread', label: 'コスプレスレ (コスプレ写真・衣装語り)' },
            ].filter(t => t.type !== 'event_report' || eventGate.open);

            // ── 新鲜度判断：决定官方情报讨论热度 ──
            const allThreads = data.threads || [];
            const recentTypes = allThreads.slice(0, 12).map(t => t.threadType).filter(Boolean);

            const latestOfficialTs = freshOfficialInfo.length > 0
                ? Math.max(...freshOfficialInfo.map(e => e.timestamp || 0)) : 0;
            const latestThreadTs = allThreads.length > 0
                ? Math.max(...allThreads.slice(0, 6).map(t => t.timestamp || 0)) : 0;
            const plotProgress = AppState.data.broadcast.plotProgress || [];
            // 只从未被总结的剧情中取最新节点，防止已总结剧情影响热度判断
            const freshPlotProgress = plotProgress.filter(p => !plotCoveredSet.has(p.id));
            const latestPlotTs = freshPlotProgress.length > 0
                ? (freshPlotProgress[freshPlotProgress.length - 1].timestamp || 0) : 0;

            // 三种热度状态：
            // 🔥 hot   — 情报比最近的帖子还新（刚更新，社区沸腾）
            // 🌡 warm  — 情报比最新剧情新，但已有一些帖子（话题持续）
            // ❄ cool   — 情报比最新剧情旧（降温，偶尔有机提及）
            const officialHeat = (() => {
                if (freshOfficialInfo.length === 0) return 'none';
                if (latestOfficialTs > latestThreadTs) return 'hot';
                if (latestOfficialTs > latestPlotTs) return 'warm';
                return 'cool';
            })();

            // 从主类型池过滤已用类型
            let available = mainTypes.filter(t => !recentTypes.includes(t.type));
            // 剧情がない場合、実況/考察/伏線/懐古/予想を除外（素材なしで生成不可）
            if (!freshPlotProgress.length && !plotProgress.length) {
                const needsPlot = ['livewatch', 'analysis', 'nostalgia', 'prediction', 'comparison'];
                available = available.filter(t => !needsPlot.includes(t.type));
            }
            const availableOfficial = officialTypes.filter(t => !recentTypes.includes(t.type));

            // 根据热度决定是否在池中加入官方情报类型
            if (officialHeat === 'hot' || officialHeat === 'warm') {
                available = [...available, ...availableOfficial];
            }
            // ── 稀有池保底：连续 N 批未出稀有类型时强制注入 ──
            const rareTypeNames = rareTypes.map(r => r.type);
            const recentForPity = (data.threads || []).slice(0, 30);
            const lastRareIdx = recentForPity.findIndex(t => rareTypeNames.includes(t.threadType));
            const rareStarved = lastRareIdx === -1 || lastRareIdx >= 20; // 最近20条都没出过稀有
            if (rareStarved && available.length >= threadCount) {
                // 保底触发：把一个未出现的稀有类型强制塞入候选
                const unusedRare = rareTypes.filter(t => !recentTypes.includes(t.type));
                if (unusedRare.length > 0) {
                    available.push(unusedRare[Math.floor(Math.random() * unusedRare.length)]);
                }
            }

            // Event-driven boost: if recent tweet events exist, promote event_report to available pool
            const recentTweetEvents = (typeof Utils !== 'undefined') ? Utils.getRecentEvents({ source: 'twitter', type: 'tweet_event', limit: 3 }) : [];
            if (recentTweetEvents.length > 0) {
                const eventReport = rareTypes.find(t => t.type === 'event_report');
                if (eventReport && !available.some(a => a.type === 'event_report')) {
                    available.push(eventReport);
                }
            }

            if (available.length < threadCount) {
                available = [...available, ...rareTypes.filter(t => !recentTypes.includes(t.type))];
            }
            if (available.length < threadCount) available = [...mainTypes, ...availableOfficial];

            // ── 欠債優先：出現回数が少ない類型を優先选取 ──
            const recentAll = (data.threads || []).slice(0, 20);
            const typeCountMap = {};
            recentAll.forEach(t => {
                const ty = t.threadType || 'discussion';
                typeCountMap[ty] = (typeCountMap[ty] || 0) + 1;
            });
            // 按出现次数升序，同次数随机
            const sorted = available.sort((a, b) => {
                const ca = typeCountMap[a.type] || 0;
                const cb = typeCountMap[b.type] || 0;
                if (ca !== cb) return ca - cb; // 次数少的排前面
                return Math.random() - 0.5;
            });
            // 去重：同一批内不重复选同一类型
            const selectedTypes = [];
            const usedTypes = new Set();
            for (const item of sorted) {
                if (usedTypes.has(item.type)) continue;
                usedTypes.add(item.type);
                selectedTypes.push(item);
                if (selectedTypes.length >= threadCount) break;
            }
            // 如果去重后数量不够，允许回填
            if (selectedTypes.length < threadCount) {
                for (const item of sorted) {
                    if (selectedTypes.length >= threadCount) break;
                    if (!selectedTypes.includes(item)) selectedTypes.push(item);
                }
            }

            // ── Thread 1 & 2 强制分配逻辑（带冷却机制）──
            let latestPlot = freshPlotProgress.length > 0 ? freshPlotProgress[freshPlotProgress.length - 1] : null;
            const latestOfficial = freshOfficialInfo.length > 0 ? freshOfficialInfo[freshOfficialInfo.length - 1] : null;

            // 冷却判定：最近6条帖子中，已有几条讨论了该剧情节点
            const recentDiscussionCount = latestPlot
                ? (data.threads || []).slice(0, 6).filter(t =>
                    t.threadType === 'discussion' &&
                    (t.linkedPlotId === latestPlot.id || (!t.linkedPlotId && t.threadType === 'discussion'))
                ).length
                : 0;
            const plotCooledDown = recentDiscussionCount >= 2; // 已有2条以上则冷却

            if (officialHeat === 'hot' && latestOfficial) {
                const cat = OFFICIAL_CATEGORIES[latestOfficial.category] || { label: latestOfficial.category };
                selectedTypes[0] = {
                    type: 'official-hot',
                    label: `【速報】${cat.labelJa || cat.label}情報スレ (针对最新官方情报「${latestOfficial.title}」的第一反应讨论帖)`
                };
                if (latestPlot && !plotCooledDown && selectedTypes.length > 1) {
                    selectedTypes[1] = {
                        type: 'discussion',
                        label: `最新話感想スレ (Topic: ${latestPlot.title})`
                    };
                }
            } else if (latestPlot && !plotCooledDown) {
                // 未冷却：Thread 1 = 最新剧情
                selectedTypes[0] = {
                    type: 'discussion',
                    label: `最新話感想/考察スレ (Topic: ${latestPlot.title})`
                };
                if (officialHeat === 'warm' && latestOfficial && availableOfficial.length > 0 && Math.random() < 0.5 && selectedTypes.length > 1) {
                    const picked = availableOfficial[Math.floor(Math.random() * availableOfficial.length)];
                    selectedTypes[1] = picked;
                }
            }
            // 如果已冷却（plotCooledDown），Thread 1 保持 sorted 的结果（低频类型优先）

            // ── 构建 typeInstructions ──
            const typeInstructions = selectedTypes.map((t, i) => {
                const num = i + 1;
                if (t.type === 'official-hot') {
                    return `Thread ${num}: [速報] — React to the most recently published official info in the timeline. Generate immediate fan reactions (excitement, analysis, comparison to expectations).`;
                }
                if (t.type === 'discussion' && i === 0 && officialHeat !== 'hot') {
                    return `Thread ${num}: discussion — Discuss the latest plot entry (the last one in the timeline). (Fan reactions, theories, emotions, callbacks to earlier events if relevant)`;
                }
                if (t.type.startsWith('official-')) {
                    return `Thread ${num}: ${t.label} — Naturally reference recent official info from the timeline if relevant.`;
                }
                if (t.type === 'anchor') {
                    return `Thread ${num}: 安価スレ (interactive story thread)
SPECIAL FORMAT for this thread only:
- CONTENT (post #1): Short story intro by 作者◆[4-char tripcode], ending with a >>5 安価 instruction (like ">>5でAの選択を決める")
- REPLIES: 2-3 reader vote replies (short suggestions) → 1 [ANCHOR] reply at the designated number → 1 [OP] story continuation (incorporating the anchor, ending with new >>N 安価)
- OP reply format: AUTHOR: 作者◆XXXX [OP]
- Anchor reply format: AUTHOR: 名無しさん [ANCHOR]
- The story should be based on the world/characters from the world context.`;
                }
                if (t.type === 'official-goods-repo') {
                    return `Thread ${num}: グッズ質感レポスレ — Goods have arrived. Find the released goods info in the timeline above.
Generate a thread where fans:
- Post arrival reactions "届いたーー！！" "やっと来た！！" "開封する！"
- Review quality: print quality, size, material feel, packaging design
- Compare actual quality vs promotional images ("思ってたより大きい" "印刷キレイ")
- Share display ideas, desk setups ("どこに飾ろうかな")
- Some still waiting for delivery / tracking packages ("まだ来ない…" "地域差あるの？")`;
                }
                if (t.type === 'anti') {
                    return `Thread ${num}: アンチスレ (hate/criticism thread)
SPECIAL DYNAMICS — A lone anti-fan opens this thread, but the FANDOM OVERWHELMS THEM. The fanbase is large and passionate; haters are quickly outnumbered and shut down.
- OP: An anti-fan posting criticism about a character or plot point (in Japanese)
- REPLIES — HEAVILY FAN-DOMINATED (fans raid this thread):
  - 1 anti follow-up at most (briefly agreeing with OP before getting buried)
  - 3-4 fan defense posts: fans flooding in, defending with specific character/plot details from the world context — using "は？", "見る目ないだろ", "そこが好きなんだが", "アンチスレに何しに来てんの", "むしろ布教させてもらおうか"
  - 1 neutral/exhausted post: bystander tired of the fight "またアンチスレか、荒れてるな"
The anti is vastly outnumbered. The thread becomes a de facto fan appreciation thread.`;
                }
                if (t.type === 'livewatch') {
                    return `Thread ${num}: **実況スレ** — This is a LIVE broadcast reaction thread from when the latest episode AIRED.
Title format: 「[作品名] 第X話 実況スレ」 / 「第X話リアタイ勢集合」 / 「今週やばすぎ実況」etc. Reference the episode number from the latest plot entry.
OP content: A short excited "now airing" announcement — 1–2 lines max. e.g. 「始まるぞー！」「実況スタート！今週もやばそう」
⚡ REPLY STYLE — THIS IS MANDATORY:
- Each reply MUST be 1–5 lines MAXIMUM. Live commentary = typed in 10 seconds, not essays.
- Replies simulate real-time simultaneous reactions: shock, excitement, grief, laughter
- Heavy use of: 草 / wwww / やばい / ちょっと待って / うそだろ / きたああ / なんだこれ / CM中だ / OP入った / 泣いた / 震えてる
- Multiple replies react to THE SAME scene from slightly different angles (overlapping real-time feel)
- Some replies are just a kaomoji or a single word: (ﾟ∀ﾟ) / 草 / 待って / 泣いた / ひえ
- Occasional short cross-reply: ">>12 俺も同じとこで泣いた" ">>8 わかるｗｗｗ"
- DO NOT write long analytical paragraphs. No theories, no deep analysis — pure immediate reaction.`;
                }
                return `Thread ${num}: ${t.label} (type: "${t.type}")`;
            }).join('\n\n');

            // ── 给 AI 的整体语境提示 ──
            const heatHint = {
                hot: `\nRecent official info has just been published — community is reacting to it for the first time.
- Thread 1 should be an immediate reaction thread to the latest official news
- Other threads may mention the news in passing.\n`,
                warm: `\nRecent official info is an ongoing topic — fans are actively discussing and experiencing it.\n`,
                cool: '',
                none: ''
            }[officialHeat];

            const systemPrompt = `あなたは5ch/2ch掲示板シミュレーションエンジンです。リアルな日本のアニメファンコミュニティの投稿を生成する専門システムです。
すべてのNPC・投稿・議論は、架空のアプリ内の架空のフォーラムに存在します。参照される作品はすべて商業アニメ/漫画/ゲームです。ダークなテーマ（戦争、トラウマ、虐待、喪失、道徳的曖昧さ、ヴィラン心理等）は標準的なACG要素であり、実際の日本アニメ掲示板と同様にNPCが自由に議論すべきです。

${safetyContext}

リアルで多様なファンコミュニティの雰囲気を持つ、本物の5ch/2chアニメ掲示板スレッドを生成してください。

${bilingualPrompt}

出力フォーマット — 以下のデリミタ形式を厳守（JSONではない）：

===THREAD===
TITLE: スレッドタイトル
AUTHOR: 名無しさん
TYPE: discussion
CONTENT:
本文（複数行可、HTML翻訳タグ可：<details class="tl"><summary>🔍</summary><span>翻訳</span></details>）
---REPLY---
AUTHOR: NPC名
CONTENT:
レス内容
---REPLY---
AUTHOR: 名無しさん
CONTENT:
レス内容
===THREAD===
TITLE: 2つ目のスレ...
...

${threadCount}つのスレッドを生成してください。各スレッド2〜4件のレス付き。スレッドタイプは以下の通り：

${typeInstructions}
${heatHint}
🚫 タイトル重複禁止 — 以下は既存のスレッドタイトル一覧です。同一または60%以上類似するタイトルのスレッドを生成することは絶対に禁止です：
${(data.threads || []).slice(0, 20).map(t => `- ${t.title}`).join('\n') || '(まだなし)'}
${threadCount}つのスレッドすべてが、上記にない完全にオリジナルなタイトルでなければなりません。

🚫🚫🚫 絶対ルール — 捏造禁止 & 外部知識遮断（最優先・全ルールの頂点）：

⛔ 知識の使い分け（最重要）：
- この作品は原作をベースにした**二次創作世界**です。キャラクターの性格・口調・人間関係の基本設定・原作の世界観は参照してよい。
- **ストーリーの時間線に関するルール：**
  - 「論壇規則」に**分岐点の指定**がある場合（例：「第X話以降はオリジナル展開」「○○編以降はIF線」）→ 分岐点より前の原作イベントは共有歴史として自由に参照可。分岐点以降は**コンテキストの剧情進捗のみ**が正史。
  - 分岐点の指定がない場合 → **コンテキストの剧情進捗に記載された出来事だけ**がこの世界で起きた事実。原作知識からプロット・事件・結末を持ち込まない。
- いずれの場合も、コンテキストの剧情進捗に**まだ記載されていない未来の展開**を捏造・推測・暗示することは禁止。
- キャラの性格描写や口癖は原作知識を活用してよいが、**コンテキスト外の剧情イベントを事実として語ることは禁止**。
${plotProgress.length === 0 ? `
⚡ 現在の放送状態：【放送前 / 未放送】
- 剧情進捗が0件 ＝ まだ1話も放送されていない。ファンはPV・公式ビジュアル・公式情報のみを頼りに期待している段階。
- 「第X話」「○○のシーン」「あのエピソード」「物語の展開」など、放送済みを前提とする言及は一切禁止。
- 音楽・OP/ED・挿入歌・BGMについて：コンテキストに楽曲情報が明記されていない限り、楽曲は未発表。「OPが神」「EDで泣いた」等の言及禁止。
- 討論できる話題は：キャラデザ・PVの印象・声優キャスト（公式発表済みのみ）・期待・不安・原作既読勢の（ネタバレなし）期待感のみ。
` : `
⚡ 現在の放送状態：第${plotProgress.length}話まで放送済み
- ファンは第${plotProgress.length}話までの内容のみを知っている。
- 第${plotProgress.length + 1}話以降の展開は存在しない。言及禁止。
`}
- 原作にないプロットの転換、キャラの死亡/成長、シリーズの結末、コンテキストに記載されていない事件を捏造してはならない。
- 重要 — 告知 ≠ 内容：公式情報が今後のコンテンツ（先行放送、次回予告、グッズ発売予定等）を告知している場合、ファンは「告知」のみを知っている。未公開コンテンツの実際の内容を議論・推測・言及してはならない — ワクワクしたり気になったりするだけ。
- このルールに違反するとタイムラインのリアリズムが崩壊する。厳格に禁止。
${Utils.PROMPTS.infoAccessRule('forum')}
- ⚠️⚠️ 因果関係と時系列（最重要）：
  - タイムラインは時系列順に並んでいる。最後のエントリが最新/現在の話数。
  - 各話の出来事はその話の時系列位置に属する。因果関係を逆転させてはならない — 事件Aが事件Bより前の話数で起きた場合、BがAの原因にはなり得ない。
  - NPCが過去の話数に言及する場合、過去形/回想として表現すること（例：「第3話であった〇〇」「あの時の〇〇」）。
  - 公式情報（インタビュー、ツイート等）はタグ付けされた話数の後に公開されたもの。ファンはその時点から知っている — 現時点での新情報ではない。
  - NPCが旧情報を現在の議論で参照する場合、必ず回想の言い方を使うこと：「そういえば前のインタビューで…」「あの時の公式発表でも…」「ep4の後に出た設定集にあったけど」。旧情報をあたかも最新発表のように表現してはならない：「最新のインタビューによると」「公式が発表しました」— 数話前の情報にこれは誤り。

リアリズムルール：
- 本物のBBSは多様なコンテンツを持つ — 真面目な考察、カプ語り、ネタ、懐古を自然にミックスすること
- 話題の鮮度：新スレッドはタイムライン末尾の最新の剧情と情報に焦点を当てるべき。数話前の公式情報は旧ニュース — ファンは公開時に既にリアクション済み。コミュニティが既に議論し終えた旧情報を新スレの主題にしてはならない。旧情報は現在の話題のスレ内で簡潔に回想する程度に留める（例：「そういえば前のインタビューで否定してたよなｗｗｗ」）。
- 2ch/5chスラング使用：ｗｗｗ, 草, ワロタ, それな, >>数字, 尊い, 神回 等
- 顔文字 — レスの30〜40%程度に2ch風顔文字とリアクションワードを自然に織り交ぜる：(´・ω・\`) (ﾟ∀ﾟ) ヽ(´▽｀)/ (；ﾟДﾟ) (TдT)(・∀・) m(_ _)m — やばい / なんだこれ / まじか / うわー / ちょっと待って 等。1レスにつき1〜2個まで、不自然な箇所には入れない。
- 各スレッドはトーンが異なるように
- 最新の剧情/公式情報がまだ議論されていない場合、類似スレがあっても優先的にカバーすること

レスのルール：
- すべてのレスはそのスレッドの話題内に留まること
- レスのスタイルを多様化：直接返信、同意、話題内の余談、過去レスの引用
- すべてのレスが>>1を引用しないこと
- 改行（必須）：実際の改行文字を使ってレスを区切ること。文や思考の区切りごとに改行。2文以上のレスには最低1つの改行を入れること。一塊のテキストブロックにしないこと。
${this._getPersistentThreadContext()}
${typeof Utils !== 'undefined' ? Utils.getEventContextPrompt(5) : ''}
${eventGate.open
    ? `\n【同人即売会の状況】現在「${eventGate.stage === 'open' ? '開催中' : eventGate.stage === 'preopen' ? '開催間近' : '終了直後'}」の同人即売会: ${eventGate.events.map(e => e.name + (e.venue ? `（${e.venue}）` : '')).join('、')}。即売会レポ・参加報告系のスレッドはこの状況に即して書くこと（話題の中心: ${eventGate.topics.join('・')}）。`
    : `\n【同人即売会の状況】現在、開催中・開催間近の同人即売会は存在しない。同人即売会・同人イベント（コミケ / オンリー / オンライン即売会など）に関する話題 — 参加予定・新刊予告・戦利品・参加レポなど — を一切捏造・言及しないこと。`}
${this.getLegendNpcContext()} `;

            const messages = [{
                role: 'user',
                content: `${context} 以上の世界観・設定・情報に基づいて、リアルな5ch風掲示板スレッドを${threadCount}つ生成してください。多様なタイプで、本物の匿名掲示板のように自然な雰囲気にしてください。`
            }];

            const response = await Utils.callChatAPI(messages, systemPrompt);

            const threads = this._parseThreadsText(response);
            if (threads.length === 0) {
                console.error('[Forum] Parse error: no threads found', response);
                Utils.showToast(I18n.t('t.forum_gen_format_error', '生成格式错误，请重试'));
                return;
            }

            if (!data.threads) data.threads = [];

            // 去重：精确匹配过滤完全相同标题
            const existingTitles = new Set((data.threads || []).map(t => t.title.toLowerCase().replace(/\s+/g, '')));
            const dedupedThreads = threads.filter(t => {
                const norm = t.title.toLowerCase().replace(/\s+/g, '');
                return !existingTitles.has(norm);
            });
            if (dedupedThreads.length === 0) {
                Utils.showToast(I18n.t('t.forum_gen_duplicate', '生成的帖子与已有内容重复，请重试'));
                return;
            }

            const genNow = Date.now();
            dedupedThreads.forEach(t => {
                const threadId = Utils.generateId();
                const opId = this.generateAnonId();
                const now = genNow - Math.floor(Math.random() * 300000);

                const parsedReplies = (t.replies || []).map((r, i) => {
                    const reply = {
                        number: i + 2,
                        author: r.author || '名無しさん',
                        authorId: this.generateAnonId(),
                        content: r.content,
                        timestamp: now + (i + 1) * 60000 + Math.floor(Math.random() * 60000)
                    };
                    if (r.isOp) reply.isOp = true;
                    if (r.isAnchorResolved) reply.isAnchorResolved = true;
                    return reply;
                });
                // 安価スレ：记录作者名（用于后续提取 OP 楼）
                const opAuthor = t.type === 'anchor'
                    ? (parsedReplies.find(r => r.isOp)?.author || t.author || '作者')
                    : undefined;

                this._newThreadIds.set(threadId, genNow);
                // 记录关联的剧情节点ID，用于冷却判定
                const linkedPlotId = (t.type === 'discussion' && latestPlot) ? latestPlot.id : undefined;
                const threadObj = {
                    id: threadId,
                    title: t.title,
                    content: t.content,
                    author: t.author || '名無しさん',
                    authorId: opId,
                    linkedPlotId: linkedPlotId,
                    timestamp: now,
                    threadType: t.type || 'discussion',
                    replies: parsedReplies
                };
                if (opAuthor) threadObj.opAuthor = opAuthor;
                data.threads.unshift(threadObj);
            });

            // Parse and route persistent replies
            const persistentReplyBlocks = response.split(/===\s*PERSISTENT_REPLY\s*===/i).slice(1);
            persistentReplyBlocks.forEach(block => {
                const threadIdMatch = block.match(/THREAD_ID:\s*(.+)/);
                const authorMatch = block.match(/AUTHOR:\s*(.+)/);
                const contentMatch = block.match(/CONTENT:\s*\n?([\s\S]*?)(?=\n===|\s*$)/);
                if (!threadIdMatch || !contentMatch) return;

                const targetId = threadIdMatch[1].trim();
                const targetThread = (data.threads || []).find(t => t.id === targetId && t.isPersistent);
                if (!targetThread) return;
                if ((targetThread.replies || []).length >= this.THREAD_REPLY_LIMIT) return;

                if (!targetThread.replies) targetThread.replies = [];
                targetThread.replies.push({
                    number: targetThread.replies.length + 2,
                    author: (authorMatch ? authorMatch[1].trim() : '名無しさん'),
                    authorId: this.generateAnonId(),
                    content: contentMatch[1].trim(),
                    timestamp: Date.now() + Math.floor(Math.random() * 60000)
                });

                // Auto-create Part N+1 if full
                if (targetThread.replies.length >= this.THREAD_REPLY_LIMIT) {
                    const nextPart = (targetThread.partNum || 1) + 1;
                    const baseTitle = targetThread.title.replace(/^【Part \d+】/, '').replace(/^【総合】/, '【総合】');
                    const newThread = {
                        id: Utils.generateId(),
                        title: `【Part ${nextPart}】${baseTitle}`,
                        content: `前スレ: ${targetThread.title}\n引き続きお話しましょう。`,
                        author: '名無しさん',
                        authorId: this.generateAnonId(),
                        timestamp: Date.now(),
                        threadType: 'persistent',
                        isPersistent: true,
                        keywords: targetThread.keywords || [],
                        replies: [],
                        partNum: nextPart,
                        partOf: targetThread.partOf || targetThread.id
                    };
                    data.threads.unshift(newThread);
                    targetThread.isPersistent = false; // old thread is no longer pinned
                    this._newThreadIds.set(newThread.id, Date.now());
                }
            });

            Utils.saveData();
            this.renderThreadList();
            Utils.showToast(I18n.t('t.forum_new_thread_done', '✓ 新スレッド生成完了'));
        } catch (e) {
            Utils.showToast(I18n.t('t.forum_gen_failed_ja', '生成失敗: ') + e.message);
            console.error('[Forum Error]', e);
        } finally {
            if (btn) { btn.textContent = '+'; btn.disabled = false; }
        }
    },

    // 加载骨架屏清理（成功/失败/提前 return 都要调用，避免骨架屏 DOM 残留）
    _removeForumSkeleton() {
        const skelBlock = document.getElementById('forumSkeletonBlock');
        if (skelBlock) skelBlock.remove();
    },

    // ===== 加载更多回复 =====
    async loadMoreReplies() {
        const data = AppState.data.forumData;
        const thread = this._findThread();
        if (!thread) return;

        const btn = document.getElementById('forumLoadMoreBtn');
        if (btn) { btn.textContent = I18n.t('forum.summary_generating', '生成中...'); btn.disabled = true; }

        // ユーザー指定のレス数を取得（骨架屏にも使用）
        const replyCount = Math.max(1, Math.min(20, parseInt(document.getElementById('forumReplyCount')?.value || '5')));

        // 骨架屏表示
        const loadActions = document.querySelector('.forum-load-actions');
        if (loadActions) {
            let skel = document.getElementById('forumSkeletonBlock');
            if (!skel) {
                skel = document.createElement('div');
                skel.id = 'forumSkeletonBlock';
                skel.innerHTML = `<div class="forum-skeleton-reply"><div class="skel-header"><div class="skel-circle"></div><div class="skel-line" style="width:30%"></div></div><div class="skel-line" style="width:90%"></div><div class="skel-line" style="width:70%"></div></div>`.repeat(Math.min(replyCount, 6));
                loadActions.parentNode.insertBefore(skel, loadActions);
            }
        }

        // 已达上限则不再生成
        if ((thread.replies?.length || 0) >= this.THREAD_REPLY_LIMIT) {
            Utils.showToast(I18n.t('t.forum_thread_ended', 'このスレは終了しました。次スレをお立てください。'));
            if (btn) { btn.textContent = I18n.t('forum.load_more', 'もっと見る'); btn.disabled = false; }
            this._removeForumSkeleton();
            return;
        }

        // 安価スレ専用ロジック
        if (thread.threadType === 'anchor') {
            return this._loadMoreAnchorReplies(thread, btn);
        }

        // 黒スレ専用ロジック（粉丝反制）
        if (thread.threadType === 'anti') {
            return this._loadMoreAntiReplies(thread, btn);
        }

        // 実況スレ専用ロジック（短文連投）
        if (thread.threadType === 'livewatch') {
            return this._loadMoreJikkyouReplies(thread, btn);
        }

        try {
            const context = this.getWorldContext();
            const bilingualPrompt = this.getBilingualPrompt();
            const safetyContext = this.getSafetyContext();

            // 如果是小说分享的帖子，获取完整小说内容作为上下文
            let novelContext = '';
            if (thread.novelId) {
                const pixivData = AppState.data.pixivData;
                const novel = (pixivData.novels || []).find(n => n.id === thread.novelId);
                if (novel) {
                    const chapter = novel.chapters[0]; // 获取第一章
                    // 去除HTML标签和翻译，只保留日文原文
                    const fullContent = this.stripTranslationTags(chapter.content || '');
                    novelContext = `\n\n【小説全文】\nタイトル：${novel.title} \n作者：${novel.author} \nタグ：${(novel.tags || []).join(', ')} \n\n内容：\n${fullContent.substring(0, 2000)}${fullContent.length > 2000 ? '...' : ''} \n`;
                }
            }

            // 只提取日文原文，减少token消耗
            const titleJP = this.stripTranslationTags(thread.title);
            const contentJP = this.stripTranslationTags(thread.content);

            let existingContent = `スレタイ：${titleJP} \n1 ${thread.author}：${contentJP} \n`;

            if (thread.replies && thread.replies.length > 0) {
                // 策略：包含前3楼 + 最后3楼，避免主题偏移
                const firstReplies = thread.replies.slice(0, 3);  // 前3楼
                const lastReplies = thread.replies.slice(-3);     // 最后3楼

                // 如果总回复数<=6，避免重复
                const repliesToInclude = thread.replies.length <= 6
                    ? thread.replies
                    : [...firstReplies, ...lastReplies];

                // 去重（如果前3和后3有重叠）
                const uniqueReplies = Array.from(
                    new Map(repliesToInclude.map(r => [r.number, r])).values()
                ).sort((a, b) => a.number - b.number);

                uniqueReplies.forEach(r => {
                    const replyJP = this.stripTranslationTags(r.content);
                    existingContent += `${r.number} ${r.author}：${replyJP} \n`;
                });

                // 如果有省略的楼层，添加提示
                if (thread.replies.length > 6) {
                    const omittedCount = thread.replies.length - 6;
                    existingContent += `\n（中間の${omittedCount} 件のレスは省略）\n\n`;
                }
            }

            const nextNum = (thread.replies ? thread.replies.length : 0) + 2;

            const legendContext = this.getLegendNpcContext();

            // OP 回归规则
            const opAuthorName = thread.author || '名無しさん';
            const opReturnRule = thread.isUserThread
                ? `\n⚠️ SPECIAL — USER THREAD: The OP "${opAuthorName}" is the REAL USER of this app(not an AI NPC).Do NOT generate any reply marked[OP] — the user handles their own OP replies.NPCs may occasionally wonder about the OP(max 1 per batch): ">>1 気になる" "OP返事してくれないの" "スレ主来ないかな"\n`
                : `\nOP RETURN RULE: With ~25 % probability, include ONE reply from the OP returning to the thread.Format: AUTHOR: ${opAuthorName} [OP].OP returns are brief(1 reply max per batch) and natural.\n`;

            const systemPrompt = `あなたは5ch/2ch掲示板シミュレーションエンジンです。リアルな日本のアニメファンコミュニティの投稿を生成する専門システムです。
すべてのNPC・投稿・議論は、架空のアプリ内の架空のフォーラムに存在します。参照される作品はすべて商業アニメ/漫画/ゲームです。ダークなテーマ（戦争、トラウマ、虐待、喪失、道徳的曖昧さ、ヴィラン心理等）は標準的なACG要素であり、実際の日本アニメ掲示板と同様にNPCが自由に議論すべきです。

${safetyContext}
${legendContext}
5ch/2chスタイルのスレッドに対するレスを生成してください。
${opReturnRule}

${bilingualPrompt}

出力フォーマット — 以下のデリミタ形式を厳守（JSONではない）：

---REPLY---
AUTHOR: 日本語名 or 名無しさん
CONTENT:
レス内容（複数行可、HTML翻訳タグ可）
---REPLY---
AUTHOR: 名無しさん
CONTENT:
レス内容

${replyCount}件のレスを生成。5chスタイル使用：ｗｗｗ, 草, それな, >>引用 等。

話題遵守ルール（優先順位）：
🔴 優先度1（最高 — 話題範囲の境界）：
- スレタイと1番（OP）がコアとなる話題範囲を定義する
- すべてのレスはこの話題範囲内に留まるが、様々な角度からアプローチ可能
- 例：話題が「周辺情報」→ 価格、品質、購入方法、転売、海外発送などを議論可能
- 例：話題が「新人入坑推薦」→ 賛否、ストーリーの入りやすさ、前提知識の有無を議論可能

🟡 優先度2（自然な議論の多様性）：
レスは自然に多様な関わり方をすること。以下のインタラクションスタイルをミックス：
- OPへの直接レス：質問に答えたり意見に反応（>>1は時々のみ、毎回ではない）
- 同意・賛同：OPの意見に同意し補足
- 関連話題：話題内の関連側面を議論（例：OPが価格の話→レスが海外入手の話）
- 過去レスへの返信：>>2-4を参照して議論を発展
- 独立した意見：誰にも直接返信せず関連する考えを共有
- 反対意見：丁寧に異論を唱えるか別の視点を提供（話題内で）

🟢 優先度3（脱線禁止）：
- 完全に無関係な話題に脱線しないこと（周辺話題→声優ゴシップは禁止）
- タイトル+OPが定義する「話題ファミリー」内に留まること
- OPが質問している場合、少なくとも一部のレスはそれに答えること

自然なフォーラムの振る舞い：
✅ 本物の5chスレには多様性がある：OPに直接答えるレス、話題について住民同士で会話するレス
✅ すべてのレスが>>1を引用する必要はない — 5件中1〜2件程度
✅ 後のレスは>>2, >>3など他のレスを参照して議論を展開できる
✅ 話題に関する独立した意見や愚痴も可能
✅ 顔文字 — レスの30〜40%程度に2ch風顔文字とリアクションを自然に織り交ぜる：(´・ω・\`) (ﾟ∀ﾟ) ヽ(´▽｀)/ (；ﾟДﾟ) (TдT)(・∀・) — やばい / まじか / うわー / ちょっと待って 等。1レスにつき1〜2個まで。
✅ 改行（必須）：文と文の間に改行を入れること。2文以上のレスには最低1つの改行。一塊のテキストブロックにしない。

🚫 絶対ルール — 捏造禁止（最優先、すべてに優先）：
- ワールドコンテキストに明示的に記載されていないプロット展開、キャラの成長、シリーズの結末、ストーリーの結果を捏造・想像・推測してはならない。
- コンテキストにep1しかない場合、NPCはep1のみが放送された世界に生きている。ep2、最終回、どんでん返し、記載されていないものは知り得ない。
- 重要 — 告知 ≠ 内容：公式情報が今後のコンテンツ（先行放送、次回予告、グッズ発売予定等）を告知している場合、NPCは「告知」のみを知っている。未公開アイテムの実際の内容を議論・言及してはならない — ワクワクしたり気になったりするだけ。
- このルールに違反するとタイムラインのリアリズムが崩壊する。最も重要な制約である。
${Utils.PROMPTS.infoAccessRule('forum')}

🔵 懐かし上げルール（コンテキストに新しい内容が実際に存在する場合のみ適用）：
ワールドコンテキストにスレのOPが議論した時点より新しいプロットや公式情報が含まれている場合、一部のレスがその新しい展開に言及してもよい — ただしコンテキストに明示的に存在する事件のみ、かつスレのコア話題に関連する範囲でのみ。
これは実際のBBSでファンが後知恵で古いスレを上げる行動をシミュレートする（「懐かし上げ」）。

話題範囲は変わらない。新しいコンテキストは話題を豊かにするが、変えるものではない：
- スレ：「AはBより弱くない？」→ 後のレス：「完全に見誤ったわｗ 10話でAが圧倒するとは思わなかった」（話題：戦闘力、ep10がコンテキストにある場合のみ）
- スレ：「新キャラ好きすぎ！」→ 後のレス：「10話まで見てさらに好きになった。あの伏線回収が神すぎる」（話題：このキャラ、ep10がコンテキストにある場合のみ）

懐かし上げレスの自然なフレーズ：「この頃はこう思ってたけど」「今見ると」「伏線だったんかｗｗ」「見事に予想外れた」「あの頃から好きだったけど今は更に」
⚠️ コンテキストにOPの時点より新しい展開がない場合、これらのフレーズを使ってはならない。OPの時点の「後」に何かがあったことを暗示してはならない。

良い多様性の例：
スレ：「価格高すぎない？」
- レス1：「>>1 同意、3000円は無理」（OPへの直接返信）
- レス2：「海外だと更に送料がかかるからな...」（関連余談 — 送料）
- レス3：「>>2 転売ヤーのせいで更に高騰してるし」（レス2を受けて — 転売）
- レス4：「品質見ると妥当な価格だと思うけど」（独立意見、やんわり反対）
- レス5：「公式通販まだ在庫あるぞ」（役立つ情報、直接引用なし）

話題範囲内で、議論が自然に流れるようにしてください！`;

            const messages = [{
                role: 'user',
                content: `${context}${novelContext}
【⚠️ 最高優先度 - CRITICAL CONTEXT】
このスレッドの話題範囲を守ってください：

📌 スレタイ：${titleJP}
📌 1番の内容：${contentJP}

上記が定義する「話題の範囲」内で、自然な議論を生成してください。

💡 重要な指針：
- すべてのレスはこのトピック範囲内にいる必要がありますが、アプローチは多様であるべきです
    - 1番に直接返信する必要はありません（自然な場合のみ >> 1 を使用）
- 前のレス（>> 2 - 4など）と対話したり、独立した観点を提供したりできます
    - 実際の掲示板のように、議論が自然に流れるようにしてください
        - 【絶対禁止】コンテキストに存在しないストーリー展開・結末・キャラの変化を一切捏造しないでください。存在するのはコンテキストに明記された情報のみです
            - 【懐かし上げ】コンテキストにスレOPより新しい展開が明記されている場合のみ、その情報を「このスレの話題の視点から」自然に言及してください。新しい展開がなければ懐かし上げは行わないでください

例：話題が「周辺情報」の場合
→ OK: 価格、品質、購入方法、転売、海外発送などを議論
→ NG: 声優や制作スタッフの話に完全に離れる

以下は既存のスレッド内容：
${existingContent}

新しい${replyCount}件のレスを生成してください。
重要：【スレタイと1番で定義された話題範囲】内で、自然で多様な議論を展開してください。`
            }];

            const response = await Utils.callChatAPI(messages, systemPrompt);

            const replies = this._parseRepliesText(response);
            if (replies.length === 0) {
                console.error('[Forum] Reply parse error: no replies found', response);
                Utils.showToast(I18n.t('t.forum_gen_format_error', '生成格式错误，请重试'));
                return;
            }

            if (!thread.replies) thread.replies = [];
            const now = Date.now();

            replies.forEach((r, i) => {
                const reply = {
                    number: nextNum + i,
                    author: r.author || '名無しさん',
                    authorId: this.generateAnonId(),
                    content: r.content,
                    timestamp: now + i * 3000 // 每条间隔3秒，不会跑到未来
                };
                if (r.isOp) reply.isOp = true;
                thread.replies.push(reply);
            });

            Utils.saveData();
            this.renderThread();
            Utils.showToast(I18n.t('t.forum_new_reply_done', '✓ 新レス読み込み完了'));
        } catch (e) {
            Utils.showToast(I18n.t('t.forum_load_failed_ja', '読み込み失敗: ') + e.message);
            console.error('[Forum Reply Error]', e);
        } finally {
            if (btn) { btn.textContent = I18n.t('forum.load_more', 'もっと見る'); btn.disabled = false; }
            this._removeForumSkeleton();
        }
    },

    // ===== 安価スレ専用：OP楼+安価楼を抽出して続きを生成 =====
    async _loadMoreAnchorReplies(thread, btn) {
        try {
            const context = this.getWorldContext();
            const bilingualPrompt = this.getBilingualPrompt();
            const safetyContext = this.getSafetyContext();

            // 只抽取 OP 楼（故事主线），不管有多少闲聊楼都不看
            const opReplies = (thread.replies || []).filter(r => r.isOp);
            const lastAnchor = [...(thread.replies || [])].reverse().find(r => r.isAnchorResolved);

            // 构建故事上下文（OP开帖 + OP续写楼）
            let storyContext = `スレタイ：${this.stripTranslationTags(thread.title)} \n`;
            storyContext += `1 ${thread.author}：${this.stripTranslationTags(thread.content)} \n\n`;
            if (opReplies.length > 0) {
                storyContext += `【作者の投稿（物語の主軸）】\n`;
                opReplies.forEach(r => {
                    storyContext += `${r.number} ${r.author}：${this.stripTranslationTags(r.content)} \n\n`;
                });
            }
            if (lastAnchor) {
                storyContext += `【直前の安価（選ばれた選択肢）】\n`;
                storyContext += `${lastAnchor.number} ${lastAnchor.author}：${this.stripTranslationTags(lastAnchor.content)} \n\n`;
            }

            const nextNum = (thread.replies ? thread.replies.length : 0) + 2;
            const opAuthor = thread.opAuthor || opReplies[0]?.author || '作者◆????';
            // 下一个安価的指定楼层（nextNum+2，留出2楼给读者投票）
            const nextAnchorNum = nextNum + 2;

            const systemPrompt = `あなたは5ch/2ch掲示板シミュレーションエンジンです。安価スレ（インタラクティブストーリースレッド）の次のラウンドを生成します。

${safetyContext}

安価スレの仕組み：
- 作者（作者◆、OP）が物語を書き、>>N安価指示（読者にN番レスで次の展開を選ばせる）で終わる
- 読者が短い投票・提案レスを投稿する
- 指定された>>N番のレスが「安価」＝選ばれた方向性になる
- OPはその安価の選択を取り入れて物語を続ける

${bilingualPrompt}

出力フォーマット（厳守、JSONではない）：
---REPLY---
AUTHOR: 名無しさん
CONTENT:
[読者の投票・提案 — 1行の短文]
---REPLY---
AUTHOR: 名無しさん
CONTENT:
[別の読者の投票 — 1行の短文]
---REPLY---
AUTHOR: 名無しさん[ANCHOR]
CONTENT:
[${nextAnchorNum}番の「当選」投票 — OPが取り入れる内容]
---REPLY---
AUTHOR: ${opAuthor} [OP]
CONTENT:
[安価の選択を取り入れて物語を続ける。3〜6文の叙述。次の選択のための新しい>>N安価指示で終わる（N = ${nextAnchorNum + 3}程度）]

正確に生成：読者の票2件→安価楼1件→OP続き1件。

ルール：
- 投票は短く（1〜2行）、多様で、創造的かつもっともらしいこと
- [OP]セグメントは[ANCHOR]の選択をスムーズに物語に取り入れること
- [OP]は明確な>>N安価指示で終わること（次の選択をまだ解決しない）
- 提供されたワールドコンテキストの設定とキャラクター内に留まること
- 捏造禁止：ワールドコンテキストにないプロット展開を作らないこと
${Utils.PROMPTS.infoAccessRule('forum')}
- 時系列厳守：タイムラインは時系列順。各公式情報はタグ付けされた時期に属する — 旧情報を新しいものとして扱ったり、異なる時期の情報を統合しないこと。`;

            const messages = [{
                role: 'user',
                content: `${context} \n\n以下はこの安価スレの作者投稿（物語主軸）のみ抽出したものです：\n\n${storyContext} \n\n上記の流れを踏まえ、次のラウンドを生成してください（読者の票2件→安価楼→作者の続き）。`
            }];

            const response = await Utils.callChatAPI(messages, systemPrompt);
            const replies = this._parseRepliesText(response);

            if (replies.length === 0) {
                Utils.showToast(I18n.t('t.forum_gen_format_error', '生成格式错误，请重试'));
                return;
            }

            if (!thread.replies) thread.replies = [];
            const now = Date.now();
            replies.forEach((r, i) => {
                const reply = {
                    number: nextNum + i,
                    author: r.author || '名無しさん',
                    authorId: this.generateAnonId(),
                    content: r.content,
                    timestamp: now + i * 3000
                };
                if (r.isOp) reply.isOp = true;
                if (r.isAnchorResolved) reply.isAnchorResolved = true;
                thread.replies.push(reply);
            });

            thread.lastReplyAt = Date.now();
            Utils.saveData();
            this.renderThread();
            Utils.showToast(I18n.t('t.forum_anchor_thread_done', '✓ 安価スレ続き生成完了'));
        } catch (e) {
            Utils.showToast(I18n.t('t.forum_gen_failed', '生成失败：') + e.message);
            console.error('[Anchor Thread Error]', e);
        } finally {
            if (btn) { btn.textContent = I18n.t('forum.load_more', 'もっと見る'); btn.disabled = false; }
            this._removeForumSkeleton();
        }
    },

    // ===== 黒スレ専用：粉丝和黑子混战续集 =====
    async _loadMoreAntiReplies(thread, btn) {
        try {
            const context = this.getWorldContext();
            const bilingualPrompt = this.getBilingualPrompt();
            const safetyContext = this.getSafetyContext();

            // 提取最近几楼内容作为上下文（用较少楼数即可）
            const titleJP = this.stripTranslationTags(thread.title);
            const contentJP = this.stripTranslationTags(thread.content);
            let existingContent = `スレタイ：${titleJP} \n1 ${thread.author}：${contentJP} \n`;
            const recentReplies = (thread.replies || []).slice(-5);
            recentReplies.forEach(r => {
                existingContent += `${r.number} ${r.author}：${this.stripTranslationTags(r.content)} \n`;
            });

            const nextNum = (thread.replies ? thread.replies.length : 0) + 2;

            const systemPrompt = `あなたは5ch/2ch掲示板シミュレーションエンジンです。白熱するアンチスレ（批判スレッド）のレスを生成します。

${safetyContext}

これは5chのアンチスレです。アンチがアンチ投稿をする一方、ファンが反撃します。構図：
- 一部のレスが批判を続ける（アンチ側）
- より多くのレスが作品/キャラを擁護する（ファン側 — まともなアンチスレには必ず現れる）
- たまに「中立」や「疲れた傍観者」

${bilingualPrompt}

出力フォーマット：
---REPLY---
AUTHOR: 名無しさん
CONTENT:
レス内容
---REPLY---
AUTHOR: 名無しさん
CONTENT:
レス内容

4〜6件のレスを生成 — ファン側が圧倒すること：
- アンチレスは最大1件（孤独なヘイター、すぐ埋もれる）
- ファン擁護レス3〜4件：熱意あふれるファンが具体的なキャラ/プロット詳細を引用して反論 — は？、見る目ないだろ、むしろ好きなんだけど、アンチスレを布教スレにするな（してるのは俺だが）、何が嫌いかより何が好きかを語れよ
- 中立/疲れた傍観者1件（またか、荒らし多いな、平和に見たい）

重要ルール：
- 【絶対禁止】コンテキストに存在しないストーリー展開を捏造しないでください
- ファン側はワールドコンテキストにある実際のキャラクター・ストーリーの詳細を引用して反論すること — 具体的で説得力のある擁護にすること
- アンチは少数派で論破される — スレはファンに占拠されている
${Utils.PROMPTS.infoAccessRule('forum')}
- 時系列厳守：タイムラインは時系列順。公式情報（インタビュー、ツイート等）はそれぞれタグ付けされた時期に属する — 旧情報を新しいものとして扱ったり、異なる時期の情報を統合しないこと。`;

            const messages = [{
                role: 'user',
                content: `${context}

以下はこの黒スレの内容です：
${existingContent}

上記の流れで、アンチvsファンの言い争いを続けてください。${nextNum} 番から開始。`
            }];

            const response = await Utils.callChatAPI(messages, systemPrompt);
            const replies = this._parseRepliesText(response);

            if (replies.length === 0) {
                Utils.showToast(I18n.t('t.forum_gen_format_error', '生成格式错误，请重试'));
                return;
            }

            if (!thread.replies) thread.replies = [];
            const now = Date.now();
            replies.forEach((r, i) => {
                thread.replies.push({
                    number: nextNum + i,
                    author: r.author || '名無しさん',
                    authorId: this.generateAnonId(),
                    content: r.content,
                    timestamp: now + i * 3000
                });
            });

            thread.lastReplyAt = Date.now();
            Utils.saveData();
            this.renderThread();
            Utils.showToast(I18n.t('t.forum_anti_thread_done', '✓ 粉黑大战续集生成完了'));
        } catch (e) {
            Utils.showToast(I18n.t('t.forum_gen_failed', '生成失败：') + e.message);
            console.error('[Anti Thread Error]', e);
        } finally {
            if (btn) { btn.textContent = I18n.t('forum.load_more', 'もっと見る'); btn.disabled = false; }
            this._removeForumSkeleton();
        }
    },

    // ===== 実況スレ専用：短文連投リアタイ反応 =====
    async _loadMoreJikkyouReplies(thread, btn) {
        try {
            const context = this.getWorldContext();
            const bilingualPrompt = this.getBilingualPrompt();
            const safetyContext = this.getSafetyContext();
            const legendContext = this.getLegendNpcContext();

            const nextNum = (thread.replies ? thread.replies.length : 0) + 2;
            const existingReplies = (thread.replies || []).slice(-8);
            let existingContent = `スレタイ：${this.stripTranslationTags(thread.title)} \n1 ${thread.author}：${this.stripTranslationTags(thread.content)} \n\n`;
            if (existingReplies.length > 0) {
                existingContent += `【直近のレス】\n`;
                existingReplies.forEach(r => {
                    existingContent += `${r.number} ${r.author}：${this.stripTranslationTags(r.content)} \n`;
                });
            }

            const systemPrompt = `あなたは5ch/2ch掲示板シミュレーションエンジンです。
${safetyContext}
${legendContext}
${bilingualPrompt}

実況スレ（リアルタイム放送反応スレッド）の続きレスを生成してください。
エピソードはまさに放送中 — 視聴者が同時にリアルタイムで速攻レスしている状況です。

⚡ 実況スレの絶対スタイルルール：
- 各レスは最大1〜5行。例外なし。
- レス＝10秒で打ち込むリアルタイム反応。考察やエッセイではない。
- 多用すべき表現：草 / wwww / やばい / ちょっと待って / うそだろ / きたああ / CM中だ / 泣いた / 震えてる
- 一部のレスは顔文字や一言だけ：(ﾟ∀ﾟ) / 草 / 待って / 泣いた
- 複数人が同じシーンにそれぞれ異なる角度から反応（同時性の演出）
- 時々のクロスレス：「>>N 俺も同じとこ」「>>N わかるｗｗｗ」
- 考察、分析、長い意見は書かないこと。

🚫 捏造禁止：ワールドコンテキストに明示的に記載されたイベントへの反応のみ生成すること。
${Utils.PROMPTS.infoAccessRule('forum')}

出力フォーマット（厳守）：
---REPLY---
AUTHOR: 名無しさん
CONTENT:
（リアクション、1〜5行以内）

6〜8件のレスを生成し、実況の続きをしてください。`;

            const messages = [{ role: 'user', content: `${context}\n\n以下はこの実況スレの内容です：\n${existingContent}\n\n${nextNum} 番から、上記の実況スレを続けてください。` }];
            const response = await Utils.callChatAPI(messages, systemPrompt);
            const replies = this._parseRepliesText(response);

            if (replies.length === 0) {
                Utils.showToast(I18n.t('t.forum_gen_format_error', '生成格式错误，请重试'));
                return;
            }

            if (!thread.replies) thread.replies = [];
            const now = Date.now();
            let cumulativeDelay = 0;
            replies.forEach((r, i) => {
                // 随机间隔 100-5000ms，模拟实况的自然节奏
                cumulativeDelay += Math.floor(Math.random() * 4900) + 100;
                thread.replies.push({
                    number: nextNum + i,
                    author: r.author || '名無しさん',
                    authorId: this.generateAnonId(),
                    content: r.content,
                    timestamp: now + cumulativeDelay
                });
            });

            thread.lastReplyAt = Date.now();
            Utils.saveData();
            this.renderThread();
            Utils.showToast(I18n.t('t.forum_jikkyou_reply_done', '✓ 実況レス読み込み完了'));
        } catch (e) {
            Utils.showToast(I18n.t('t.forum_gen_failed', '生成失败：') + e.message);
            console.error('[Jikkyou Thread Error]', e);
        } finally {
            if (btn) { btn.textContent = I18n.t('forum.load_more', 'もっと見る'); btn.disabled = false; }
            this._removeForumSkeleton();
        }
    },

    // ===== スレ Part 制度：次スレ生成 =====
    async generateNextPart(threadId) {
        const data = AppState.data.forumData;
        const thread = this._findThread(threadId);
        if (!thread) return;

        const btn = document.getElementById('forumNextPartBtn');
        if (btn) { btn.textContent = I18n.t('forum.summary_generating', '生成中...'); btn.disabled = true; }

        const partNum = (thread.partNum || 1) + 1;
        const baseTitle = this.stripTranslationTags(thread.title).replace(/^【Part \d+】\s*/, '').trim();

        // 取最后10条回复作为衔接上下文
        const lastReplies = (thread.replies || []).slice(-10);
        let prevContext = `前スレ（Part ${partNum - 1}）最後のレス: \n`;
        lastReplies.forEach(r => {
            prevContext += `${r.number} ${r.author}：${this.stripTranslationTags(r.content)} \n`;
        });

        try {
            const context = this.getWorldContext();
            const bilingualPrompt = this.getBilingualPrompt();
            const safetyContext = this.getSafetyContext();

            const systemPrompt = `あなたは5ch/2ch掲示板シミュレーションエンジンです。
${safetyContext}
${bilingualPrompt}

以下のスレッドの次スレ（Part ${partNum}）を1つだけ生成してください。

タイトル：「【Part ${partNum}】${baseTitle}」
OP内容：前スレへの簡潔な言及（例：「前スレ：${baseTitle} Part ${partNum - 1}」）の後、議論を続ける。OPは短く（1〜3行）。
スレタイプ：${thread.threadType}
元スレと同じスタイルで5〜8件のレスを生成。

${prevContext}

${context}

🚫 捏造禁止：上記ワールドコンテキストに明示的に記載されたイベントのみ参照すること。
${Utils.PROMPTS.infoAccessRule('forum')}

出力フォーマット（厳守）：
===THREAD===
TITLE: 【Part ${partNum}】${baseTitle}
AUTHOR: 名無しさん
TYPE: ${thread.threadType}
CONTENT:
（OP内容）
---REPLY---
AUTHOR: 名無しさん
CONTENT:
（レス内容）`;

            const messages = [{ role: 'user', content: '次スレを生成してください。' }];
            const response = await Utils.callChatAPI(messages, systemPrompt);
            const parsed = this._parseThreadsText(response);

            if (!parsed || parsed.length === 0) {
                Utils.showToast(I18n.t('t.forum_gen_failed_retry', '生成失败，请重试'));
                return;
            }

            const t = parsed[0];
            const now = Date.now();
            const newThread = {
                id: Utils.generateId(),
                title: t.title || `【Part ${partNum}】${baseTitle} `,
                content: t.content,
                author: t.author || '名無しさん',
                authorId: this.generateAnonId(),
                timestamp: now,
                threadType: thread.threadType,
                replies: (t.replies || []).map((r, i) => {
                    const reply = {
                        number: i + 2,
                        author: r.author || '名無しさん',
                        authorId: this.generateAnonId(),
                        content: r.content,
                        timestamp: now + (i + 1) * 3000
                    };
                    if (r.isOp) reply.isOp = true;
                    return reply;
                }),
                partNum,
                partOf: thread.partOf || thread.id
            };

            if (!data.threads) data.threads = [];
            data.threads.unshift(newThread);
            this._newThreadIds.set(newThread.id, Date.now());
            Utils.saveData();
            Utils.showToast(I18n.t('t.forum_next_thread', { n: partNum }));

            // 跳转到新串
            this.currentThreadId = newThread.id;
            this.renderThreadList();
            this.renderThread();
            Navigation.goTo('forum-thread');
        } catch (e) {
            Utils.showToast(I18n.t('t.forum_gen_failed_zh', '生成失败: ') + e.message);
            console.error('[generateNextPart Error]', e);
        } finally {
            if (btn) { btn.textContent = I18n.t('forum.next_part_btn', { n: partNum }); btn.disabled = false; }
        }
    },

    // ===== 用户回复 =====
    userReply() {
        const input = document.getElementById('forumReplyInput');
        const content = input.value.trim();
        if (!content) return;

        const data = AppState.data.forumData;
        const thread = this._findThread();
        if (!thread) return;

        if (!thread.replies) thread.replies = [];
        if (thread.replies.length >= this.THREAD_REPLY_LIMIT) {
            Utils.showToast(I18n.t('t.forum_thread_full', 'このスレは満員です。次スレをお立てください。'));
            return;
        }
        const nextNum = thread.replies.length + 2;
        const userName = data.isAnonymous ? '名無しさん' : (data.userName || '名無しさん');

        thread.replies.push({
            number: nextNum,
            author: userName,
            authorId: this.generateAnonId(),
            content: content,
            timestamp: Date.now(),
            isUser: true
        });

        input.value = '';
        Utils.saveData();
        this.renderThread();
        Utils.scrollToBottom(document.getElementById('forumThreadContent'));
    },

    // ===== 剧情进展 =====
    showPlotModal() {
        this.editingPlotId = null;
        document.getElementById('plotTitle').value = '';
        document.getElementById('plotContent').value = '';
        document.getElementById('plotModal').classList.add('active');
    },

    addPlotEntry() {
        const title = document.getElementById('plotTitle').value.trim();
        const content = document.getElementById('plotContent').value.trim();
        if (!title || !content) { Utils.showToast(I18n.t('t.forum_title_content_required', '标题和内容不能为空')); return; }

        const data = AppState.data.forumData;
        if (!AppState.data.broadcast.plotProgress) AppState.data.broadcast.plotProgress = [];

        if (this.editingPlotId) {
            // 编辑模式
            const plot = AppState.data.broadcast.plotProgress.find(p => p.id === this.editingPlotId);
            if (plot) {
                plot.title = title;
                plot.content = content;
            }
            this.editingPlotId = null;
            Utils.saveData();
            document.getElementById('plotModal').classList.remove('active');
            this.renderPlotList();
            Utils.showToast(I18n.t('t.forum_plot_updated', '✓ 剧情已更新'));
        } else {
            // 新增模式
            AppState.data.broadcast.plotProgress.push({
                id: Utils.generateId(),
                title: title,
                content: content,
                timestamp: Date.now()
            });

            // 周边预告自动发售：有 pendingRelease=true 的 goods 条目自动升级为发售状态
            const pendingGoods = (AppState.data.broadcast.officialInfo || []).filter(e => e.pendingRelease && e.category === 'goods');
            if (pendingGoods.length > 0) {
                const newPlot = AppState.data.broadcast.plotProgress[AppState.data.broadcast.plotProgress.length - 1];
                pendingGoods.forEach(goods => {
                    // 原「预告 / 受注中」条目保留，pendingRelease 置 false；其 goods.status 不变（历史记录）
                    goods.pendingRelease = false;
                    const releaseEntry = {
                        id: Utils.generateId(),
                        title: `【発売】${goods.title || goods.content.slice(0, 15)} `,
                        content: `${goods.content} \n（正式発売！商品の発送が始まっています。）`,
                        category: 'goods',
                        afterPlotId: newPlot.id,
                        sourceNpcId: goods.sourceNpcId || null,
                        sourceNpcIds: goods.sourceNpcIds || [],
                        timestamp: Date.now() + 1,
                        isGoodsRelease: true
                    };
                    // 结构化周边：発売条目继承原 goods 块，status 设为「贩售中」
                    if (goods.goods) {
                        releaseEntry.goods = { ...goods.goods, status: '贩售中' };
                    }
                    AppState.data.broadcast.officialInfo.push(releaseEntry);
                });
            }

            Utils.saveData();
            Utils.emitEvent('plot_published', 'forum', { title: title, summary: content.slice(0, 80) });

            // メロンブックス商品ステータス連動
            const newPlotId = AppState.data.broadcast.plotProgress[AppState.data.broadcast.plotProgress.length - 1].id;
            if (typeof Melonbooks !== 'undefined' && Melonbooks.onPlotPublished) {
                Melonbooks.onPlotPublished(newPlotId);
            }
            if (typeof Mercari !== 'undefined' && Mercari.onPlotPublished) Mercari.onPlotPublished(newPlotId);
            if (typeof Wandoro !== 'undefined' && Wandoro.onPlotPublished) Wandoro.onPlotPublished(newPlotId);   // v2.129.0 完結前：一话起一轮 ワンドロ（抽到 wandoro.js、缺失则 no-op）

            document.getElementById('plotModal').classList.remove('active');
            this.renderPlotList();
            Utils.showToast(pendingGoods.length > 0
                ? I18n.t('t.forum_plot_added_goods', { n: pendingGoods.length })
                : I18n.t('t.forum_plot_added', '✓ 剧情已添加'));

            // 周边快速入口提示
            this._showGoodsQuickBanner();

            // 日本同人圈自动生成 — pixiv 独立开关（fire-and-forget，不阻塞论坛操作）
            if (AppState.data.pixivData?.settings?.autoGenOnNewPlot) {
                const genCount = Math.max(1, Math.min(5, AppState.data.pixivData.settings.autoGenCount || 1));
                setTimeout(async () => {
                    for (let _gi = 0; _gi < genCount; _gi++) {
                        await PixivNovel.autoGenerateNovel().catch(e => console.warn('[AutoGen]', e));
                    }
                }, 300);
            }

            // v2.73.6: 中文同人圈自动生成 — 微博 + lofter 共享 lofter 开关、跟 pixiv 完全解绑
            // 把本次新增剧情的 title + content 传给 weibo 作 recentPlotSummary（之前永远传空串）
            if (typeof Lofter !== 'undefined' && AppState.data.lofterData?.settings?.autoGenOnNewPlot) {
                const plotSummary = `${title} — ${content.slice(0, 120)}`;
                if (typeof Weibo !== 'undefined' && AppState.data.weiboData) {
                    const wbCount = AppState.data.weiboData.autoGenWeiboCount || 4;
                    setTimeout(() => {
                        Weibo._generateNpcWeibos(wbCount, plotSummary).catch(e => console.warn('[Weibo autoGen]', e));
                        Weibo._maybeSeedHotsearch(plotSummary).catch(e => console.warn('[Weibo hotsearch]', e));
                    }, 500);
                }
                const lofCount = Math.max(1, Math.min(5, AppState.data.lofterData.settings.autoGenCount || 2));
                setTimeout(() => Lofter._autoGenerateOnPlot(lofCount).catch(e => console.warn('[Lofter autoGen]', e)), 700);
            }
        }
    },

    editPlotEntry(plotId) {
        const data = AppState.data.forumData;
        const plot = (AppState.data.broadcast.plotProgress || []).find(p => p.id === plotId);
        if (!plot) return;

        this.editingPlotId = plotId;
        document.getElementById('plotTitle').value = plot.title;
        document.getElementById('plotContent').value = plot.content;
        document.getElementById('plotModal').classList.add('active');
    },

    deletePlotEntry(plotId) {
        const data = AppState.data.forumData;
        AppState.data.broadcast.plotProgress = (AppState.data.broadcast.plotProgress || []).filter(p => p.id !== plotId);
        Utils.saveData();
        this.renderPlotList();
    },

    renderPlotList() {
        const container = document.getElementById('plotProgressList');
        if (!container) return;
        const plots = AppState.data.broadcast.plotProgress || [];
        const mergedSummaries = AppState.data.broadcast.mergedSummaries || [];
        const plotSummaries = AppState.data.broadcast.plotSummaries || []; // 兼容旧数据
        const coveredSet = new Set([
            ...mergedSummaries.flatMap(s => s.coveredPlotIds || []),
            ...plotSummaries.flatMap(s => s.coveredIds || [])
        ]);

        if (plots.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-text">${I18n.t('bc.plot_empty')}</div><div class="empty-state-hint">${I18n.t('bc.plot_empty_hint')}</div></div>`;
            return;
        }

        const _esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const _ended = !!AppState.data.broadcast.seriesEnded;   // v2.126.0 完結フラグ（ワンドロ ペース切替）
        const _finaleRow = `<div class="plot-finale-row">
            <span class="plot-finale-label">${I18n.t('bc.series_finale', '完結済み')}</span>
            <button class="plot-finale-toggle${_ended ? ' on' : ''}" onclick="Forum.toggleSeriesEnded()" role="switch" aria-checked="${_ended}"><span class="plot-finale-knob"></span></button>
            <span class="plot-finale-hint">${_ended ? I18n.t('bc.series_finale_on_hint', '完結後ペース：ワンドロは時間で進行') : I18n.t('bc.series_finale_off_hint', '完結したらONに（ワンドロが時間ペースに）')}</span>
        </div>`;
        container.innerHTML = _finaleRow + plots.map((p, i) => {
            const preview = _esc(p.content.slice(0, 60));
            const isCovered = coveredSet.has(p.id);
            return `
    <div class="plot-entry${isCovered ? ' plot-entry-covered' : ''}">
                    <div class="plot-entry-header">
                        <span class="plot-entry-num">#${i + 1}</span>
                        ${isCovered ? `<span class="plot-summary-badge">${I18n.t('bc.plot_summarized')}</span>` : ''}
                        <span class="plot-entry-title">${_esc(p.title)}</span>
                        <button class="plot-entry-edit" onclick="event.stopPropagation(); Forum.editPlotEntry('${p.id}')">✎</button>
                        <button class="plot-entry-del" onclick="event.stopPropagation(); Forum.deletePlotEntry('${p.id}')">×</button>
                    </div>
                    <div class="plot-entry-preview">${preview}${p.content.length > 60 ? '...' : ''}</div>
                </div> `;
        }).join('');
    },

    // v2.126.0 完結トグル（放送局）：完結後 ワンドロ を時間ペースに切替（broadcast.seriesEnded）
    toggleSeriesEnded() {
        if (!AppState.data.broadcast) return;
        AppState.data.broadcast.seriesEnded = !AppState.data.broadcast.seriesEnded;
        Utils.saveData();
        this.renderPlotList();
        Utils.showToast(AppState.data.broadcast.seriesEnded
            ? I18n.t('bc.series_finale_set', '✓ 完結済みにしました')
            : I18n.t('bc.series_finale_unset', '✓ 連載中に戻しました'));
    },

    // ===== 官方情报管理 =====
    showOfficialInfoModal() {
        this.editingOfficialId = null;
        document.getElementById('officialInfoTitle').value = '';
        const contentEl = document.getElementById('officialInfoContent');
        contentEl.value = '';
        contentEl.style.height = '';
        contentEl.oninput = () => this._autoResizeTextarea(contentEl);
        document.getElementById('officialInfoCategory').value = 'interview';

        // 动态填充"发布时间点"下拉（从当前剧情列表生成）
        const plotProgress = AppState.data.broadcast.plotProgress || [];
        const sel = document.getElementById('officialInfoAfterPlot');
        if (sel) {
            sel.innerHTML = `<option value="">${I18n.t('forum.before_all_plots', '所有剧情之前 / 时机不明')}</option>`;
            plotProgress.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.title;
                sel.appendChild(opt);
            });
            // 默认选最新一集（大多数情报都是最近剧情之后的）
            if (plotProgress.length > 0) sel.value = plotProgress[plotProgress.length - 1].id;
        }

        // 初始化 NPC 选择器（新增时默认 interview，隐藏 NPC 区）
        this._updateNpcSelector('interview');

        // 周边结构化字段：清空 + 刷新来源 datalist
        this._fillGoodsBlock(null);
        this._refreshGoodsSourceList();

        document.getElementById('officialInfoModal').classList.add('active');
    },

    // 刷新周边来源 datalist（已填过的 source 复用）
    _refreshGoodsSourceList() {
        const dl = document.getElementById('goodsSourceList');
        if (!dl) return;
        const sources = [...new Set(
            (AppState.data.broadcast.officialInfo || [])
                .filter(e => e.goods && e.goods.source)
                .map(e => e.goods.source)
        )];
        const _esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        dl.innerHTML = sources.map(s => `<option value="${_esc(s)}">`).join('');
    },

    // 把周边结构化字段回填到表单（编辑已有周边时用；无 goods 块则留空、状态默认「预告」）
    _fillGoodsBlock(goods) {
        const g = goods || {};
        document.getElementById('goodsName').value = g.name || '';
        document.getElementById('goodsType').value = g.type || 'アクスタ';
        document.getElementById('goodsPrice').value = g.price != null ? g.price : '';
        document.getElementById('goodsRarity').value = g.rarity || '通常';
        document.getElementById('goodsStatus').value = g.status || '预告';
        document.getElementById('goodsSource').value = g.source || '';

        // 关联角色：填充 datalist（= 声优角色清单）+ 回填编辑态 chips
        const charList = (typeof Mercari !== 'undefined') ? Mercari.characterList() : [];
        const dl = document.getElementById('goodsCharList');
        if (dl) {
            const _esc = s => this._escapeHtml(s);
            dl.innerHTML = charList.map(c => `<option value="${_esc(c)}">`).join('');
        }
        this._editingGoodsChars = (goods && Array.isArray(goods.charNames)) ? goods.charNames.slice() : [];
        const charInput = document.getElementById('goodsCharInput');
        if (charInput) charInput.value = '';
        this._renderGoodsCharsChips();

        // 追加按钮 + Enter 绑定一次（仿 voiced chars 加钮）
        const addBtn = document.getElementById('goodsCharAddBtn');
        if (addBtn && !addBtn._goodsBound) {
            addBtn._goodsBound = true;
            addBtn.addEventListener('click', () => this._addGoodsChar());
        }
        if (charInput && !charInput._goodsBound) {
            charInput._goodsBound = true;
            charInput.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this._addGoodsChar();
                }
            });
        }
    },

    // 从表单读取周边结构化字段块（仅 category==='goods' 时使用）
    _readGoodsBlock() {
        return {
            name:   document.getElementById('goodsName').value.trim(),
            type:   document.getElementById('goodsType').value,
            price:  Number(document.getElementById('goodsPrice').value) || 0,
            rarity: document.getElementById('goodsRarity').value,
            status: document.getElementById('goodsStatus').value,
            source: document.getElementById('goodsSource').value.trim(),
            charNames: this._editingGoodsChars.slice()
        };
    },

    // 周边关联角色：编辑时临时持有 charNames 数组（仿 _editingVoicedChars 模式）
    _editingGoodsChars: [],

    _renderGoodsCharsChips() {
        const container = document.getElementById('goodsCharChips');
        if (!container) return;
        if (this._editingGoodsChars.length === 0) {
            container.innerHTML = `<span style="font-size:11px; color:var(--text-tertiary);">${I18n.t('forum.goods_chars_empty', '尚未添加')}</span>`;
            return;
        }
        const _esc = s => this._escapeHtml(s);
        const _ariaRemove = I18n.t('forum.chip_remove', '删除');
        container.innerHTML = this._editingGoodsChars.map(n =>
            `<span class="chip"><span class="chip-name">${_esc(n)}</span><button type="button" class="chip-x" data-name="${_esc(n)}" aria-label="${_ariaRemove}">×</button></span>`
        ).join('');
        container.querySelectorAll('.chip-x').forEach(btn => {
            btn.onclick = () => this._removeGoodsChar(btn.dataset.name);
        });
    },

    _addGoodsChar() {
        const input = document.getElementById('goodsCharInput');
        if (!input) return;
        const name = input.value.trim();
        if (!name) return;
        if (this._editingGoodsChars.includes(name)) {
            Utils.showToast(I18n.t('t.forum_char_already_added', '已添加过这个角色'));
            input.value = '';
            return;
        }
        this._editingGoodsChars.push(name);
        input.value = '';
        this._renderGoodsCharsChips();
    },

    _removeGoodsChar(name) {
        this._editingGoodsChars = this._editingGoodsChars.filter(n => n !== name);
        this._renderGoodsCharsChips();
    },

    addOfficialInfoEntry() {
        const title = document.getElementById('officialInfoTitle').value.trim();
        const content = document.getElementById('officialInfoContent').value.trim();
        const category = document.getElementById('officialInfoCategory').value;
        const afterPlotId = document.getElementById('officialInfoAfterPlot')?.value || null;
        if (!content) { Utils.showToast(I18n.t('t.forum_content_required', '内容不能为空')); return; }

        // 读取 NPC 来源
        let sourceNpcId = null;
        let sourceNpcIds = [];
        if (category === 'twitter') {
            sourceNpcId = document.getElementById('officialInfoNpcSelect')?.value || null;
            if (!sourceNpcId) sourceNpcId = null;
        } else if (category === 'interview') {
            sourceNpcIds = [...(document.querySelectorAll('#officialInfoNpcCheckboxes input[name="npcCheck"]:checked') || [])].map(cb => cb.value);
        }

        const data = AppState.data.forumData;
        if (!AppState.data.broadcast.officialInfo) AppState.data.broadcast.officialInfo = [];

        if (this.editingOfficialId) {
            const entry = AppState.data.broadcast.officialInfo.find(e => e.id === this.editingOfficialId);
            if (entry) {
                entry.title = title;
                entry.content = content;
                entry.category = category;
                entry.afterPlotId = afterPlotId || null;
                entry.sourceNpcId = sourceNpcId;
                entry.sourceNpcIds = sourceNpcIds;
                if (category === 'goods') {
                    entry.goods = this._readGoodsBlock();
                    // pendingRelease 由 goods.status 派生：预告 / 受注中 → 待自动発売
                    entry.pendingRelease = (entry.goods.status === '预告' || entry.goods.status === '受注中');
                } else {
                    entry.pendingRelease = false;
                    delete entry.goods;
                }
            }
            this.editingOfficialId = null;
            Utils.showToast(I18n.t('t.forum_official_info_updated', '✓ 官方情报已更新'));
        } else {
            const entry = {
                id: Utils.generateId(),
                title,
                content,
                category,
                afterPlotId: afterPlotId || null,
                sourceNpcId,
                sourceNpcIds,
                timestamp: Date.now(),
                pendingRelease: false
            };
            if (category === 'goods') {
                entry.goods = this._readGoodsBlock();
                // pendingRelease 由 goods.status 派生：预告 / 受注中 → 待自动発売
                entry.pendingRelease = (entry.goods.status === '预告' || entry.goods.status === '受注中');
            }
            AppState.data.broadcast.officialInfo.push(entry);
            Utils.showToast(I18n.t('t.forum_official_info_added', '✓ 官方情报已添加'));
        }

        Utils.saveData();
        Utils.emitEvent('official_info_added', 'forum', { title: title, summary: (content || '').slice(0, 80) });
        document.getElementById('officialInfoModal').classList.remove('active');
        this.renderOfficialInfoList();
    },

    editOfficialInfoEntry(entryId) {
        const data = AppState.data.forumData;
        const entry = (AppState.data.broadcast.officialInfo || []).find(e => e.id === entryId);
        if (!entry) return;
        this.editingOfficialId = entryId;
        document.getElementById('officialInfoTitle').value = entry.title;
        const contentEl = document.getElementById('officialInfoContent');
        contentEl.value = entry.content;
        contentEl.oninput = () => this._autoResizeTextarea(contentEl);
        setTimeout(() => this._autoResizeTextarea(contentEl), 50);
        document.getElementById('officialInfoCategory').value = entry.category || 'interview';

        // 先填充下拉，再恢复已保存的选项
        const plotProgress = AppState.data.broadcast.plotProgress || [];
        const sel = document.getElementById('officialInfoAfterPlot');
        if (sel) {
            sel.innerHTML = `<option value="">${I18n.t('forum.before_all_plots', '所有剧情之前 / 时机不明')}</option>`;
            plotProgress.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.title;
                sel.appendChild(opt);
            });
            sel.value = entry.afterPlotId || '';
        }

        // 恢复 NPC 选择
        this._updateNpcSelector(entry.category || 'interview');
        if (entry.category === 'twitter' && entry.sourceNpcId) {
            const npcSel = document.getElementById('officialInfoNpcSelect');
            if (npcSel) npcSel.value = entry.sourceNpcId;
        } else if (entry.category === 'interview' && entry.sourceNpcIds?.length) {
            document.querySelectorAll('#officialInfoNpcCheckboxes input[name="npcCheck"]').forEach(cb => {
                cb.checked = (entry.sourceNpcIds || []).includes(cb.value);
            });
        }

        // 周边结构化字段：回填（无 goods 块的旧式周边则全部留空、状态默认「预告」）
        if (entry.category === 'goods') this._fillGoodsBlock(entry.goods);
        this._refreshGoodsSourceList();

        document.getElementById('officialInfoModal').classList.add('active');
    },

    deleteOfficialInfoEntry(entryId) {
        const data = AppState.data.forumData;
        AppState.data.broadcast.officialInfo = (AppState.data.broadcast.officialInfo || []).filter(e => e.id !== entryId);
        Utils.saveData();
        this.renderOfficialInfoList();
    },

    // ===== 官方 NPC 管理 =====
    editingNpcId: null,
    _editingVoicedChars: [], // 编辑时临时持有 voicedCharacters 数组

    // 声優判定：role 包含「声優」/「声优」/「seiyuu」/「CV」其一
    _isSeiyuuRole(role) {
        if (!role) return false;
        const r = String(role).toLowerCase();
        return r.includes('声優') || r.includes('声优') || r.includes('seiyuu') || r.includes('cv');
    },

    showNpcModal(npcId = null) {
        this.editingNpcId = npcId;
        const data = AppState.data.forumData;
        let npc = null;
        if (npcId) npc = (AppState.data.broadcast.officialNpcs || []).find(n => n.id === npcId);

        document.getElementById('npcRole').value = npc?.role || '';
        // 旧数据兼容：如果 name 字段本身就是 @xxx 风格、且未单独设置 handle，作为 handle 显示
        let displayName = npc?.name || '';
        let displayHandle = (npc?.handle || '').replace(/^@+/, '');
        if (!displayHandle && /^@[A-Za-z0-9_]+$/.test(displayName.trim())) {
            displayHandle = displayName.trim().slice(1);
            displayName = '';
        }
        document.getElementById('npcName').value = displayName;
        document.getElementById('npcHandle').value = displayHandle;
        document.getElementById('npcVoiceId').value = npc?.voiceId || '';
        this._editingVoicedChars = Array.isArray(npc?.voicedCharacters) ? [...npc.voicedCharacters] : [];

        const input = document.getElementById('npcVoicedCharsInput');
        if (input) input.value = '';

        this._renderVoicedCharsChips();
        this._toggleVoicedCharsSection();

        // 角色预置下拉（每次打开按当前语言重建、并确保关闭状态）
        this._buildRoleDropdown();
        const roleDd = document.getElementById('npcRoleDropdown');
        if (roleDd) roleDd.style.display = 'none';

        // 绑定一次 — role 变更时切换 voicedChars 区可见性
        const roleEl = document.getElementById('npcRole');
        if (roleEl && !roleEl._npcBound) {
            roleEl._npcBound = true;
            roleEl.addEventListener('input', () => this._toggleVoicedCharsSection());
            roleEl.addEventListener('change', () => this._toggleVoicedCharsSection());
        }
        // chips 添加按钮 + Enter
        const addBtn = document.getElementById('npcVoicedCharsAddBtn');
        if (addBtn && !addBtn._npcBound) {
            addBtn._npcBound = true;
            addBtn.addEventListener('click', () => this._addVoicedChar());
        }
        if (input && !input._npcBound) {
            input._npcBound = true;
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this._addVoicedChar();
                }
            });
        }
        document.getElementById('npcModal').classList.add('active');
    },

    _toggleVoicedCharsSection() {
        const role = document.getElementById('npcRole')?.value || '';
        const section = document.getElementById('npcVoicedCharsSection');
        if (section) section.style.display = this._isSeiyuuRole(role) ? 'block' : 'none';
    },

    // ===== 角色预置下拉（自定义，替代 iOS Safari 不弹的原生 datalist） =====
    // i18n 角色名 key（早已定义，原 datalist 用硬编码值而未用上）
    _ROLE_PRESET_KEYS: [
        'forum.role_producer', 'forum.role_series_constr', 'forum.role_director',
        'forum.role_writer', 'forum.role_seiyuu', 'forum.role_anim_director',
        'forum.role_storyboard', 'forum.role_official_twitter', 'forum.role_illustrator'
    ],

    _buildRoleDropdown() {
        const dd = document.getElementById('npcRoleDropdown');
        if (!dd) return;
        dd.innerHTML = '';
        this._ROLE_PRESET_KEYS.forEach(k => {
            const v = I18n.t(k);
            const el = document.createElement('div');
            el.className = 'npc-role-opt';
            el.textContent = v;
            el.onclick = (e) => { e.stopPropagation(); this._pickRolePreset(v); };
            dd.appendChild(el);
        });
    },

    _toggleRoleDropdown(e) {
        if (e) e.stopPropagation();
        const dd = document.getElementById('npcRoleDropdown');
        if (!dd) return;
        const willShow = dd.style.display === 'none' || !dd.style.display;
        dd.style.display = willShow ? 'block' : 'none';
        // 点击下拉以外区域关闭（绑定一次，幂等检查 display）
        if (willShow && !this._roleDropdownOutsideBound) {
            this._roleDropdownOutsideBound = true;
            // 箭头包裹保住 this（即便目前 _onRoleDropdownOutside 未用 this，防将来重构踩坑）
            document.addEventListener('click', e => this._onRoleDropdownOutside(e));
        }
    },

    _onRoleDropdownOutside(e) {
        const dd = document.getElementById('npcRoleDropdown');
        if (!dd || dd.style.display === 'none') return;
        const field = dd.closest('.npc-role-field');
        if (field && !field.contains(e.target)) dd.style.display = 'none';
    },

    _pickRolePreset(value) {
        const input = document.getElementById('npcRole');
        if (input) {
            input.value = value;
            // 选「声優」要展开配音角色区
            this._toggleVoicedCharsSection();
        }
        const dd = document.getElementById('npcRoleDropdown');
        if (dd) dd.style.display = 'none';
    },

    _addVoicedChar() {
        const input = document.getElementById('npcVoicedCharsInput');
        if (!input) return;
        const name = input.value.trim();
        if (!name) return;
        if (this._editingVoicedChars.includes(name)) {
            Utils.showToast(I18n.t('t.forum_char_already_added', '已添加过这个角色'));
            input.value = '';
            return;
        }
        this._editingVoicedChars.push(name);
        input.value = '';
        this._renderVoicedCharsChips();
    },

    _removeVoicedChar(name) {
        this._editingVoicedChars = this._editingVoicedChars.filter(n => n !== name);
        this._renderVoicedCharsChips();
    },

    _renderVoicedCharsChips() {
        const container = document.getElementById('npcVoicedCharsChips');
        if (!container) return;
        if (this._editingVoicedChars.length === 0) {
            container.innerHTML = `<span style="font-size:11px; color:var(--text-tertiary);">${I18n.t('forum.npc_voiced_chars_empty', '尚未添加')}</span>`;
            return;
        }
        const _esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const _ariaRemove = I18n.t('forum.chip_remove', '删除');
        container.innerHTML = this._editingVoicedChars.map(n =>
            `<span class="chip"><span class="chip-name">${_esc(n)}</span><button type="button" class="chip-x" data-name="${_esc(n)}" aria-label="${_ariaRemove}">×</button></span>`
        ).join('');
        container.querySelectorAll('.chip-x').forEach(btn => {
            btn.onclick = () => this._removeVoicedChar(btn.dataset.name);
        });
    },

    saveNpc() {
        const role = document.getElementById('npcRole').value.trim();
        if (!role) { Utils.showToast(I18n.t('t.forum_role_required', '角色不能为空')); return; }
        const name = document.getElementById('npcName').value.trim();
        const handle = document.getElementById('npcHandle').value.trim().replace(/^@+/, '');
        const voiceId = document.getElementById('npcVoiceId').value.trim();
        const isSeiyuu = this._isSeiyuuRole(role);
        // 提醒：声優角色在配音角色输入框打了字却没点「追加」就保存 —— 提示别误丢
        // （不自动追加，保留「必须显式追加」的设计；让用户确认后再保存）
        if (isSeiyuu) {
            const vcInput = document.getElementById('npcVoicedCharsInput');
            if (vcInput && vcInput.value.trim()) {
                Utils.showToast(I18n.t('forum.npc_voiced_chars_pending', '「配音角色」还没点「追加」，确认后再保存哦'));
                vcInput.focus();
                return;
            }
        }
        const voicedCharacters = isSeiyuu ? [...this._editingVoicedChars] : [];

        const data = AppState.data.forumData;
        if (!AppState.data.broadcast.officialNpcs) AppState.data.broadcast.officialNpcs = [];
        if (this.editingNpcId) {
            const npc = AppState.data.broadcast.officialNpcs.find(n => n.id === this.editingNpcId);
            if (npc) {
                npc.role = role;
                npc.name = name;
                npc.handle = handle || undefined;
                npc.voiceId = voiceId || undefined;
                npc.voicedCharacters = voicedCharacters.length ? voicedCharacters : undefined;
            }
            this.editingNpcId = null;
        } else {
            const newNpc = { id: Utils.generateId(), role, name };
            if (handle) newNpc.handle = handle;
            if (voiceId) newNpc.voiceId = voiceId;
            if (voicedCharacters.length) newNpc.voicedCharacters = voicedCharacters;
            AppState.data.broadcast.officialNpcs.push(newNpc);
        }
        this._editingVoicedChars = [];
        Utils.saveData();
        document.getElementById('npcModal').classList.remove('active');
        this.renderNpcList();
    },

    deleteNpc(npcId) {
        if (!confirm(I18n.t('forum.confirm_delete_npc', '确定要删除此 NPC 吗？'))) return;
        const data = AppState.data.forumData;
        AppState.data.broadcast.officialNpcs = (AppState.data.broadcast.officialNpcs || []).filter(n => n.id !== npcId);
        Utils.saveData();
        this.renderNpcList();
    },

    renderNpcList() {
        const container = document.getElementById('npcList');
        if (!container) return;
        const npcs = AppState.data.broadcast.officialNpcs || [];
        if (npcs.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-text">${I18n.t('bc.npc_empty')}</div><div class="empty-state-hint">${I18n.t('bc.npc_empty_hint')}</div></div>`;
            return;
        }
        const _esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        container.innerHTML = npcs.map(n => {
            const handleStr = n.handle ? ` <span style="color:var(--text-tertiary); font-size:12px; font-weight:normal;">@${_esc(n.handle)}</span>` : '';
            return `
    <div class="plot-entry">
        <div class="plot-entry-header">
            <span class="official-cat-badge" style="background:#888; font-size:10px;">${_esc(n.role)}</span>
            <span class="plot-entry-title" style="margin-left:4px;">${_esc(n.name) || I18n.t('bc.npc_anon')}${handleStr}</span>
            <button class="plot-entry-edit" onclick="event.stopPropagation(); Forum.showNpcModal('${n.id}')">✎</button>
            <button class="plot-entry-del" onclick="event.stopPropagation(); Forum.deleteNpc('${n.id}')">×</button>
        </div>
    </div>
    `;
        }).join('');
    },

    // 根据 NPC id 数组生成可读标签（如「監督 田中一郎 × 声優 山田花子」）
    _getNpcLabel(ids) {
        if (!ids || ids.length === 0) return null;
        const npcs = AppState.data.broadcast.officialNpcs || [];
        return ids.map(id => {
            const npc = npcs.find(n => n.id === id);
            if (!npc) return null;
            return npc.name ? `${npc.role} ${npc.name} ` : npc.role;
        }).filter(Boolean).join(' × ') || null;
    },

    // ===== AI 通用 helper：输出语言后缀 =====
    // lang = 'auto'（跟随当前 i18n 语言）/ 'zh' / 'ja' / 'en'
    // 拼到 systemPrompt 末尾，告诉 LLM 用哪种语言输出
    _buildLangSuffix(lang) {
        let effectiveLang = lang;
        if (lang === 'auto' || !lang) {
            effectiveLang = (typeof I18n !== 'undefined' && I18n.currentLang) || 'ja';
        }
        switch (effectiveLang) {
            case 'zh': return '\n\n请用中文（简体）书写。';
            case 'en': return '\n\nWrite in natural English.';
            case 'ja':
            default: return '\n\n自然な日本語で書くこと。';
        }
    },

    // ===== 周边 AI 生成方案 =====
    async _aiGenerateGoods() {
        const btn = document.getElementById('goodsAiGenBtn');
        const container = document.getElementById('goodsAiCandidates');
        if (!btn || !container) return;

        btn.disabled = true;
        const _goodsLbl = btn.querySelector('.fch-svg-label');
        if (_goodsLbl) _goodsLbl.textContent = I18n.t('forum.goods_ai_generating', '生成中…');
        else btn.textContent = I18n.t('forum.goods_ai_generating', '生成中…');
        container.innerHTML = '';

        try {
            const data = AppState.data.forumData;
            // 取最近 5 条剧情作为创作依据
            const recentPlots = (AppState.data.broadcast.plotProgress || []).slice(-5);
            const plotText = recentPlots.length > 0
                ? recentPlots.map(p => `・${p.title}：${p.content.slice(0, 80)}`).join('\n')
                : '（暂无剧情信息）';
            const worldSetting = AppState.data.broadcast.worldSetting || '';
            const cpNickname = Broadcast.getCP().cpNickname || '';

            // 取最近 4 条官方情报作为额外灵感（twitter 贺图/活动等）
            const recentInfo = (AppState.data.broadcast.officialInfo || []).slice(-4);
            const infoText = recentInfo.length > 0
                ? recentInfo.map(e => `[${e.category}] ${e.title}：${(e.content || '').slice(0, 60)}`).join('\n')
                : '';

            // グッズ構成タイプ
            const poolType = document.getElementById('goodsPoolType')?.value || 'auto';
            const poolInstruction = poolType === 'single'
                ? '単キャラグッズに集中すること（1商品につき1キャラのみ）。'
                : poolType === 'set'
                    ? '複数キャラセットグッズに集中すること（例：バッジセット、テーマ別アクリルスタンドコレクション等）。'
                    : '単キャラ・複数キャラセットの両方を自然にミックスすること。';

            // 输出语言（用户可在 modal 选择，默认跟随 UI 语言）
            const lang = document.getElementById('goodsAiLang')?.value || 'auto';
            const langSuffix = this._buildLangSuffix(lang);

            const systemPrompt = `あなたは日本のアニメグッズ企画担当です。ストーリー、世界観、最近の公式発表をもとに、ファンが喜ぶグッズ企画を2〜3案生成してください。
感動的なシーン、キャラの象徴、印象的な場面、最近のアート/イベントとのタイアップに注目すること。
${poolInstruction}
架空のブランド名やコラボブランドを捏造しないこと。${langSuffix}

出力フォーマット（厳守、余分なテキストなし）：
===GOODS===
TYPE: [商品種類 例：アクリルスタンド / Tシャツ / キャンバスアート / ブランケット / マグカップ / バッジセット / ランダムグッズ]
TITLE: [商品タイトル（簡潔に）]
CONTENT: [2〜3文で設計コンセプトと仕様のポイント]
===GOODS===
TYPE: ...
TITLE: ...
CONTENT: ...`;

            const userPrompt = `世界観・作品設定：
${worldSetting.slice(0, 300)}
${cpNickname ? `CP: ${cpNickname}` : ''}

最新剧情：
${plotText}
${infoText ? `\n最近の公式情報（ツイート・イベント等）：\n${infoText}` : ''}

上記をもとに、ファンが喜ぶグッズ企画を2〜3案出してください。${(document.getElementById('goodsAiHint')?.value.trim()) ? `\nユーザーの希望：${document.getElementById('goodsAiHint').value.trim()}` : ''}`;

            const raw = await Utils.callChatAPI([{ role: 'user', content: userPrompt }], systemPrompt);

            // Parse ===GOODS=== blocks
            const blocks = raw.split(/={3,}GOODS={3,}/).map(s => s.trim()).filter(Boolean);
            if (blocks.length === 0) throw new Error(I18n.t('forum.goods_ai_parse_failed', '解析失败'));

            const candidates = blocks.map(block => {
                const typeMatch = block.match(/^TYPE:\s*(.+)$/m);
                const titleMatch = block.match(/^TITLE:\s*(.+)$/m);
                const contentMatch = block.match(/^CONTENT:\s*([\s\S]+)$/m);
                return {
                    type: typeMatch ? typeMatch[1].trim() : '',
                    title: titleMatch ? titleMatch[1].trim() : '',
                    content: contentMatch ? contentMatch[1].trim() : '',
                };
            }).filter(c => c.content);

            if (candidates.length === 0) throw new Error(I18n.t('forum.goods_ai_parse_failed', '解析失败'));

            // 存到实例上，供 _fillGoodsFromCandidate 通过索引查找
            this._goodsCandidates = candidates;
            const _applyHint = I18n.t('forum.goods_candidate_apply_hint', 'タップして反映 →');
            const _defaultType = I18n.t('forum.goods_candidate_default_type', 'グッズ');
            container.innerHTML = candidates.map((c, i) => `
<div class="goods-candidate-card" onclick="Forum._fillGoodsFromCandidate(${i})">
    <div class="goods-candidate-type">${c.type || _defaultType}</div>
    <div class="goods-candidate-title">${c.title}</div>
    <div class="goods-candidate-content">${c.content}</div>
    <div class="goods-candidate-hint">${_applyHint}</div>
</div>`).join('');

        } catch (e) {
            container.innerHTML = `<div style="color:var(--danger-color); font-size:12px; padding:8px 0;">${I18n.t('forum.goods_ai_failed', '生成失败，请重试')}</div>`;
            console.error('[AI Goods]', e);
        } finally {
            btn.disabled = false;
            const _goodsRestoreLbl = btn.querySelector('.fch-svg-label');
            if (_goodsRestoreLbl) _goodsRestoreLbl.textContent = I18n.t('forum.goods_ai_gen_btn', 'AI生成方案');
            else btn.textContent = I18n.t('forum.goods_ai_gen_btn', 'AI生成方案');
        }
    },

    _autoResizeTextarea(el) {
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 400) + 'px';
    },

    _fillGoodsFromCandidate(idx) {
        const c = (this._goodsCandidates || [])[idx];
        if (!c) return;
        const titleEl = document.getElementById('officialInfoTitle');
        const contentEl = document.getElementById('officialInfoContent');
        if (titleEl) titleEl.value = c.title;
        if (contentEl) { contentEl.value = c.content; this._autoResizeTextarea(contentEl); }
        // 高亮被选中的卡片
        document.querySelectorAll('.goods-candidate-card').forEach((card, i) => {
            card.classList.toggle('selected', i === idx);
        });
    },

    // ===== 剧情 AI 扩写（用户写大纲 → AI 扩成正文）=====
    async _aiGenerateExpandedPlot() {
        const outlineEl = document.getElementById('plotAiOutline');
        const btn = document.getElementById('plotAiExpandBtn');
        const titleEl = document.getElementById('plotTitle');
        const contentEl = document.getElementById('plotContent');
        if (!outlineEl || !btn || !contentEl) return;

        const outline = outlineEl.value.trim();
        if (!outline) {
            Utils.showToast(I18n.t('t.forum_plot_ai_outline_empty', '请先写一些剧情大纲'));
            return;
        }

        const length = document.getElementById('plotAiLength')?.value || 'mid';
        const lang = document.getElementById('plotAiLang')?.value || 'auto';
        const lengthSpec = length === 'short' ? '約300字' : length === 'long' ? '約1500字' : '約800字';

        btn.disabled = true;
        const _expandLbl = btn.querySelector('.fch-svg-label');
        const originalBtnText = _expandLbl ? _expandLbl.textContent : btn.textContent;
        if (_expandLbl) _expandLbl.textContent = I18n.t('forum.plot_ai_expanding', '扩写中…');
        else btn.textContent = I18n.t('forum.plot_ai_expanding', '扩写中…');

        try {
            const worldSetting = AppState.data.broadcast.worldSetting || '';
            const data = AppState.data.forumData || {};
            const cpNickname = Broadcast.getCP().cpNickname || '';
            const recentPlots = (AppState.data.broadcast.plotProgress || []).slice(-5);
            const plotText = recentPlots.length > 0
                ? recentPlots.map(p => `・${p.title}：${p.content.slice(0, 100)}`).join('\n')
                : '（这是第一话）';
            const charContext = (AppState.data.broadcast.officialNpcs || []).map(c => `${c.role}${c.name ? `（${c.name}）` : ''}`).join(' / ') || '（未设置）';

            const titleHint = (titleEl?.value || '').trim();
            const langSuffix = this._buildLangSuffix(lang);

            const systemPrompt = `あなたはアニメ作品の脚本家です。ユーザーの大綱をもとに、自然で読み応えのある剧情本文を執筆してください。

## 作品設定
${worldSetting.slice(0, 400)}
${cpNickname ? `\nCP: ${cpNickname}` : ''}

## 登場キャラ・スタッフ
${charContext}

## 直前の剧情（連続性のため）
${plotText}

## 執筆ルール
- 作品設定 / キャラ / 直前の剧情と矛盾しないこと、人物の語気と物語の連続性を保つこと
- 出力長さ：${lengthSpec}
- マークダウン不可、プレーンテキストのみ
- 章タイトルや見出しを付けず、剧情本文だけを書くこと${langSuffix}`;

            const userPrompt = `${titleHint ? `タイトル：${titleHint}\n` : ''}用户の剧情大綱：
${outline}

上記の大綱をもとに、剧情本文を執筆してください（長さ：${lengthSpec}）。`;

            const raw = await Utils.callChatAPI([{ role: 'user', content: userPrompt }], systemPrompt);
            contentEl.value = raw.trim();
            this._autoResizeTextarea(contentEl);
            Utils.showToast(I18n.t('t.forum_plot_ai_expanded', '✓ 扩写完成，可继续修改细节'));
        } catch (e) {
            console.error('[AI ExpandPlot]', e);
            Utils.showToast(I18n.t('t.forum_plot_ai_failed', '扩写失败：') + (e.message || e));
        } finally {
            btn.disabled = false;
            if (_expandLbl) _expandLbl.textContent = originalBtnText;
            else btn.textContent = originalBtnText;
        }
    },

    // ===== 联动咖啡厅 AI 生成 =====
    async _aiGenerateCafeMenu() {
        const btn = document.getElementById('cafeAiGenBtn');
        const resultDiv = document.getElementById('cafeAiResult');
        const actionsDiv = document.getElementById('cafeAiActions');
        if (!btn || !resultDiv) return;

        btn.disabled = true;
        const _cafeLbl = btn.querySelector('.fch-svg-label');
        if (_cafeLbl) _cafeLbl.textContent = I18n.t('forum.cafe_ai_generating', '生成中…');
        else btn.textContent = I18n.t('forum.cafe_ai_generating', '生成中…');
        resultDiv.style.display = 'none';
        if (actionsDiv) actionsDiv.style.display = 'none';

        try {
            const data = AppState.data.forumData;
            const worldSetting = AppState.data.broadcast.worldSetting || '';
            const cpNickname = Broadcast.getCP().cpNickname || '';
            const recentPlots = (AppState.data.broadcast.plotProgress || []).slice(-3);
            const plotText = recentPlots.map(p => `・${p.title}：${p.content.slice(0, 60)}`).join('\n') || '（暂无）';
            // 从输入框读取用户已填的活动标题/内容作为提示
            const titleHint = (document.getElementById('officialInfoTitle')?.value || '').trim();
            const contentHint = (document.getElementById('officialInfoContent')?.value || '').trim();

            // 输出语言（用户可在 modal 选择，默认跟随 UI 语言）
            const lang = document.getElementById('cafeAiLang')?.value || 'auto';
            const langSuffix = this._buildLangSuffix(lang);

            const systemPrompt = `あなたはクリエイティブな日本のアニメカフェイベント企画者です。イベントに合わせたリアルなコラボカフェメニューとテーマグッズを生成してください。

出力フォーマット（厳守）：
【メニュー】
（食べ物・ドリンクを5〜7品、各1〜2行で。キャラ名や印象的なシーンと結びつけて）

【特典・グッズ】
（ランチョンマット / ランダムコースター / ブロマイド / ファン証 等、3〜4品）

【開催概要（参考）】
（架空の開催期間・場所のイメージ、1〜2行）

プレーンテキストのみ。マークダウン不可。${langSuffix}`;

            const userPrompt = `作品設定：${worldSetting.slice(0, 200)}
${cpNickname ? `CP: ${cpNickname}` : ''}
最近の剧情：${plotText}
${titleHint ? `イベント名（ユーザー入力）：${titleHint}` : ''}
${contentHint ? `補足：${contentHint}` : ''}${(document.getElementById('cafeAiHint')?.value.trim()) ? `\nユーザーの希望：${document.getElementById('cafeAiHint').value.trim()}` : ''}

上記の世界観に合った、リアルなコラボカフェの企画内容を生成してください。`;

            const raw = await Utils.callChatAPI([{ role: 'user', content: userPrompt }], systemPrompt);
            this._cafeMenuText = raw.trim();

            resultDiv.textContent = this._cafeMenuText;
            resultDiv.style.display = 'block';
            if (actionsDiv) actionsDiv.style.display = 'block';
        } catch (e) {
            resultDiv.textContent = I18n.t('forum.cafe_ai_failed', '生成失败：') + e.message;
            resultDiv.style.display = 'block';
            console.error('[AI Cafe]', e);
        } finally {
            btn.disabled = false;
            const _cafeRestoreLbl = btn.querySelector('.fch-svg-label');
            if (_cafeRestoreLbl) _cafeRestoreLbl.textContent = I18n.t('forum.cafe_ai_gen_btn', 'カフェメニューを生成');
            else btn.textContent = I18n.t('forum.cafe_ai_gen_btn', 'カフェメニューを生成');
        }
    },

    _applyCafeMenuToContent() {
        if (!this._cafeMenuText) return;
        const contentEl = document.getElementById('officialInfoContent');
        if (contentEl) {
            contentEl.value = this._cafeMenuText;
            this._autoResizeTextarea(contentEl);
            Utils.showToast(I18n.t('t.forum_reflected_to_content', '✓ 内容欄に反映しました'));
        }
    },

    // ===== 录入剧情后周边快速入口 =====
    _showGoodsQuickBanner() {
        const existing = document.getElementById('goodsQuickBanner');
        if (existing) existing.remove();

        const banner = document.createElement('div');
        banner.id = 'goodsQuickBanner';
        banner.className = 'goods-quick-banner';
        banner.innerHTML = `
<span class="goods-quick-text" style="display:inline-flex;align-items:center;gap:6px;"><svg style="width:14px;height:14px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 9.4 7.5 4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>${I18n.t('forum.goods_banner_text', '顺手发个周边？')}</span>
<button class="glass-btn goods-quick-btn" onclick="Forum._quickOpenGoodsModal(); document.getElementById('goodsQuickBanner').remove()">${I18n.t('forum.goods_banner_btn', '快速发布')}</button>
<button class="goods-quick-close" onclick="document.getElementById('goodsQuickBanner').remove()">×</button>`;
        document.body.appendChild(banner);

        // 入场动画：下一帧加 show 类
        requestAnimationFrame(() => banner.classList.add('show'));

        // 5秒后自动消失
        const timer = setTimeout(() => {
            banner.classList.remove('show');
            setTimeout(() => banner.remove(), 300);
        }, 5000);
        banner.dataset.timer = timer;
    },

    _quickOpenGoodsModal() {
        this.showOfficialInfoModal();
        // 切换到 goods 分类并刷新 UI
        const catSel = document.getElementById('officialInfoCategory');
        if (catSel) {
            catSel.value = 'goods';
            this._updateNpcSelector('goods');
        }
    },

    // 根据情报分类切换 NPC 选择器 UI（twitter=单选，interview=多选，其他=隐藏）
    _updateNpcSelector(category) {
        const npcs = AppState.data.broadcast.officialNpcs || [];
        const section = document.getElementById('officialNpcSection');
        const singleDiv = document.getElementById('officialNpcSingle');
        const multiDiv = document.getElementById('officialNpcMulti');
        if (!section) return;
        const _esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        if (category === 'twitter') {
            section.style.display = '';
            singleDiv.style.display = '';
            multiDiv.style.display = 'none';
            const sel = document.getElementById('officialInfoNpcSelect');
            sel.innerHTML = `<option value="">${I18n.t('forum.not_specified', '不指定')}</option>` +
                npcs.map(n => `<option value="${_esc(n.id)}">${_esc(n.role)}${n.name ? ' ' + _esc(n.name) : ''}</option>`).join('');
        } else if (category === 'interview') {
            section.style.display = '';
            singleDiv.style.display = 'none';
            multiDiv.style.display = '';
            const div = document.getElementById('officialInfoNpcCheckboxes');
            if (div) {
                div.innerHTML = npcs.length > 0
                    ? npcs.map(n => `
    <label class="npc-checkbox-item">
        <input type="checkbox" name="npcCheck" value="${_esc(n.id)}">
            ${_esc(n.role)}${n.name ? ' ' + _esc(n.name) : ''}
        </label>`).join('')
                    : `<span style="color:#999;font-size:12px;">${I18n.t('forum.npc_empty_hint', '暂无 NPC，请先在设置中添加')}</span>`;
            }
        } else {
            section.style.display = 'none';
        }
        // AI 生成方案区块：仅 goods 类别显示，切换时清空旧候选
        const goodsAiSection = document.getElementById('goodsAiSection');
        if (goodsAiSection) {
            goodsAiSection.style.display = category === 'goods' ? 'block' : 'none';
            if (category !== 'goods') {
                const candidates = document.getElementById('goodsAiCandidates');
                if (candidates) candidates.innerHTML = '';
            }
        }
        // 周边结构化字段区块：仅 goods 类别显示
        const goodsFieldsSection = document.getElementById('goodsFieldsSection');
        if (goodsFieldsSection) {
            goodsFieldsSection.style.display = category === 'goods' ? 'block' : 'none';
        }
        // カフェメニュー AI区块：仅 event 类别显示，切换时重置
        const cafeAiSection = document.getElementById('cafeAiSection');
        if (cafeAiSection) {
            cafeAiSection.style.display = category === 'event' ? 'block' : 'none';
            if (category !== 'event') {
                const cafeResult = document.getElementById('cafeAiResult');
                const cafeActions = document.getElementById('cafeAiActions');
                if (cafeResult) { cafeResult.textContent = ''; cafeResult.style.display = 'none'; }
                if (cafeActions) cafeActions.style.display = 'none';
            }
        }
    },

    // 官方情报 HTML 转义（私有 helper）
    _escapeHtml(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    // 单条情报行渲染（周边以外的五类沿用此布局）
    _renderInfoRow(e, num, isCovered) {
        const _esc = s => this._escapeHtml(s);
        const preview = _esc(e.content.slice(0, 60));
        const displayTitle = _esc(e.title || e.content.slice(0, 25) + (e.content.length > 25 ? '…' : ''));
        // NPC 来源标注
        let npcLabel = null;
        if (e.category === 'twitter' && e.sourceNpcId) {
            npcLabel = this._getNpcLabel([e.sourceNpcId]);
        } else if (e.category === 'interview' && e.sourceNpcIds?.length) {
            npcLabel = this._getNpcLabel(e.sourceNpcIds);
        }
        const npcLabelSafe = npcLabel ? _esc(npcLabel) : null;
        return `
            <div class="plot-entry${isCovered ? ' plot-entry-covered' : ''}">
                    <div class="plot-entry-header">
                        <span class="plot-entry-num">#${num}</span>
                        ${isCovered ? `<span class="plot-summary-badge">${I18n.t('bc.plot_summarized')}</span>` : ''}
                        ${npcLabelSafe ? `<span style="font-size:10px; color:#888; margin-left:4px;">${npcLabelSafe}</span>` : ''}
                        <span class="plot-entry-title" style="margin-left:4px;">${displayTitle}</span>
                        <button class="plot-entry-edit" onclick="event.stopPropagation(); Forum.editOfficialInfoEntry('${e.id}')">✎</button>
                        <button class="plot-entry-del" onclick="event.stopPropagation(); Forum.deleteOfficialInfoEntry('${e.id}')">×</button>
                    </div>
                    <div class="plot-entry-preview">${preview}${e.content.length > 60 ? '...' : ''}</div>
                </div> `;
    },

    // 周边行渲染（行式,与其他五类统一;结构化周边显示属性 meta,旧式周边提示补全）
    _renderGoodsRow(e, num, isCovered) {
        const _esc = s => this._escapeHtml(s);
        const g = e.goods;
        const displayTitle = _esc((g && g.name) || e.title || (e.content || '').slice(0, 25));
        let metaLine;
        if (g) {
            const parts = [`¥${g.price}`, _esc(g.rarity), _esc(g.status)];
            if (g.source) parts.push(_esc(g.source));
            metaLine = parts.join(' ｜ ');
        } else {
            metaLine = I18n.t('forum.goods_meta_old', '旧式周边 · 点 ✎ 补全结构化字段');
        }
        return `
            <div class="plot-entry${isCovered ? ' plot-entry-covered' : ''}">
                    <div class="plot-entry-header">
                        <span class="plot-entry-num">#${num}</span>
                        ${isCovered ? `<span class="plot-summary-badge">${I18n.t('bc.plot_summarized')}</span>` : ''}
                        <span class="plot-entry-title" style="margin-left:4px;">${displayTitle}</span>
                        <button class="plot-entry-edit" onclick="event.stopPropagation(); Forum.editOfficialInfoEntry('${e.id}')">✎</button>
                        <button class="plot-entry-del" onclick="event.stopPropagation(); Forum.deleteOfficialInfoEntry('${e.id}')">×</button>
                    </div>
                    <div class="plot-entry-preview">${metaLine}</div>
                </div> `;
    },

    renderOfficialInfoList() {
        const container = document.getElementById('officialInfoList');
        if (!container) return;
        const entries = AppState.data.broadcast.officialInfo || [];
        const officialSummaries = AppState.data.broadcast.officialSummaries || [];
        const mergedSummaries = AppState.data.broadcast.mergedSummaries || [];
        const coveredSet = new Set([
            ...officialSummaries.flatMap(s => s?.coveredIds || []),
            ...mergedSummaries.flatMap(s => s?.coveredInfoIds || []),
        ]);

        if (entries.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-text">${I18n.t('bc.info_empty')}</div><div class="empty-state-hint">${I18n.t('bc.info_empty_hint')}</div></div>`;
            return;
        }

        // 全局序号映射（按原数组顺序，分组后序号语义不变）
        const numMap = new Map(entries.map((e, i) => [e.id, i + 1]));

        const CAT_ORDER = ['goods', 'interview', 'twitter', 'event', 'setting', 'announcement'];
        let html = '';
        CAT_ORDER.forEach(cat => {
            const items = entries.filter(e => e.category === cat);
            if (!items.length) return;
            const label = (OFFICIAL_CATEGORIES[cat] || {}).display || cat;
            html += `<div class="info-group-title">${this._escapeHtml(label)} <span class="info-group-count">(${items.length})</span></div>`;
            if (cat === 'goods') {
                html += items.map(e => this._renderGoodsRow(e, numMap.get(e.id), coveredSet.has(e.id))).join('');
            } else {
                html += items.map(e => this._renderInfoRow(e, numMap.get(e.id), coveredSet.has(e.id))).join('');
            }
        });
        container.innerHTML = html;
    },

    // ===== 论坛设置 =====
    initSettings() {
        const data = AppState.data.forumData;
        document.getElementById('forumRules').value = data.forumRules || '';
        document.getElementById('forumAnonymous').checked = data.isAnonymous !== false;
        document.getElementById('forumUserName').value = data.userName || '';
        document.getElementById('forumUserName').disabled = data.isAnonymous !== false;

        document.getElementById('forumAnonymous').onchange = (e) => {
            document.getElementById('forumUserName').disabled = e.target.checked;
        };

        const fontSlider = document.getElementById('forumFontSize');
        const fontLabel = document.getElementById('forumFontSizeLabel');
        const savedSize = parseInt(data.fontSize) || 15;
        fontSlider.value = savedSize;
        fontLabel.textContent = I18n.t('forum.font_size_current', { n: savedSize });
        fontSlider.oninput = () => {
            fontLabel.textContent = I18n.t('forum.font_size_current', { n: fontSlider.value });
            document.documentElement.style.setProperty('--fch-font-size', fontSlider.value + 'px');
        };

        this.renderLegendNpcList();
        this.updateStorageBar();
    },

    // 从楼层 HTML 内容中提取纯日语文本（去掉 <details> 翻译块）
    _extractJapanese(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        tmp.querySelectorAll('details.tl, details[class*="tl"]').forEach(el => el.remove());
        return tmp.textContent.replace(/\s+/g, ' ').trim();
    },

    // ===== TTS 语音朗读 =====
    speakPost(number) {
        const tts = AppState.data.ttsConfig || {};
        if (!tts.provider || tts.provider === 'none') {
            Utils.showToast(I18n.t('t.forum_tts_not_configured', '请先在设置中配置语音朗读'));
            return;
        }
        // 再次点击同一楼层 → 停止
        if (this._ttsCurrentNumber === number) {
            this._stopTTS();
            return;
        }
        this._stopTTS();

        const thread = this._findThread();
        if (!thread) return;
        const rawContent = number === 1
            ? thread.content
            : (thread.replies[number - 2] || {}).content || '';
        const text = this._extractJapanese(rawContent);
        if (!text) return;

        this._ttsCurrentNumber = number;
        this._updateTtsBtn(number, 'playing');

        if (tts.provider === 'minimax') {
            this._callMinimaxTTS(text, number);
        } else if (tts.provider === 'webspeech') {
            this._callWebSpeechTTS(text, number);
        } else if (tts.provider === 'custom') {
            this._callCustomTTS(text, number);
        }
    },

    async _callMinimaxTTS(text, number) {
        const tts = AppState.data.ttsConfig || {};
        try {
            const base = (typeof TTSSettings !== 'undefined')
                ? TTSSettings.getMinimaxBase(tts.minimaxRegion, tts.minimaxCustomBase)
                : 'https://api.minimax.io';
            // 当て字读音替换（与广播剧使用同一张表）
            const finalText = (typeof TTSEngine !== 'undefined' && TTSEngine.applyReadingMap)
                ? TTSEngine.applyReadingMap(text)
                : text;
            const body = {
                model: tts.speechModel || 'speech-2.8-hd',
                text: finalText,
                stream: false,
                voice_setting: { voice_id: tts.voiceId || 'Japanese_HikaruMale_Calm', speed: tts.speed || 1.0, vol: 1.0, pitch: 0 },
                audio_setting: { audio_sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 }
            };
            if (tts.languageBoost) body.language_boost = tts.languageBoost;
            const res = await fetch(`${base}/v1/t2a_v2?GroupId=${tts.groupId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tts.apiKey}`
                },
                body: JSON.stringify(body)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data.base_resp && data.base_resp.status_code !== 0) throw new Error(data.base_resp.status_msg || '请求失败');

            // hex → Uint8Array → Blob → Audio
            const hex = data.data?.audio;
            if (!hex) throw new Error('TTS 响应格式错误：audio 数据为空');
            const bytes = new Uint8Array(hex.length / 2);
            for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
            const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mp3' }));

            // 异步竞态：fetch 期间用户已切换/停止朗读，这是个孤儿请求 → 直接释放并退出，别覆盖现役播放
            if (this._ttsCurrentNumber !== number) { URL.revokeObjectURL(url); return; }
            // 防御：若上一个 url 未释放，先 revoke 再记录新的
            this._revokeTtsUrl();
            this._ttsCurrentUrl = url;
            this._ttsAudio = new Audio(url);
            this._ttsAudio.onended = () => { this._revokeTtsUrl(); this._ttsCurrentNumber = null; this._updateTtsBtn(number, 'idle'); };
            this._ttsAudio.onerror = () => { this._revokeTtsUrl(); this._ttsCurrentNumber = null; this._updateTtsBtn(number, 'idle'); };
            this._ttsAudio.play();
        } catch (e) {
            Utils.showToast(I18n.t('t.forum_tts_failed', 'TTS 失败：') + e.message);
            this._ttsCurrentNumber = null;
            this._updateTtsBtn(number, 'idle');
        }
    },

    _callWebSpeechTTS(text, number) {
        if (!('speechSynthesis' in window)) {
            Utils.showToast(I18n.t('t.forum_tts_unsupported', '该设备不支持语音合成'));
            this._ttsCurrentNumber = null;
            this._updateTtsBtn(number, 'idle');
            return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ja-JP';
        utterance.rate = 0.9;
        const tts = AppState.data.ttsConfig || {};
        const voices = speechSynthesis.getVoices();
        const voice = tts.webSpeechVoice
            ? voices.find(v => v.name === tts.webSpeechVoice)
            : voices.find(v => v.lang.startsWith('ja'));
        if (voice) utterance.voice = voice;
        utterance.onend = () => { this._ttsCurrentNumber = null; this._updateTtsBtn(number, 'idle'); };
        utterance.onerror = () => { this._ttsCurrentNumber = null; this._updateTtsBtn(number, 'idle'); };
        speechSynthesis.speak(utterance);
    },

    async _callCustomTTS(text, number) {
        const tts = AppState.data.ttsConfig || {};
        try {
            let endpoint = (tts.customUrl || '').trim();
            if (!endpoint) throw new Error('未配置 TTS API URL');
            while (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
            if (!endpoint.endsWith('/v1/audio/speech')) {
                endpoint = endpoint.endsWith('/v1') ? `${endpoint}/audio/speech` : `${endpoint}/v1/audio/speech`;
            }
            const headers = { 'Content-Type': 'application/json' };
            if (tts.customApiKey) headers['Authorization'] = `Bearer ${tts.customApiKey}`;
            const res = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: tts.customModel || 'tts-1',
                    input: text,
                    voice: tts.customVoice || 'alloy'
                })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            // 异步竞态：fetch 期间用户已切换/停止朗读，这是个孤儿请求 → 直接释放并退出，别覆盖现役播放
            if (this._ttsCurrentNumber !== number) { URL.revokeObjectURL(url); return; }
            // 防御：若上一个 url 未释放，先 revoke 再记录新的
            this._revokeTtsUrl();
            this._ttsCurrentUrl = url;
            this._ttsAudio = new Audio(url);
            this._ttsAudio.onended = () => { this._revokeTtsUrl(); this._ttsCurrentNumber = null; this._updateTtsBtn(number, 'idle'); };
            this._ttsAudio.onerror = () => { this._revokeTtsUrl(); this._ttsCurrentNumber = null; this._updateTtsBtn(number, 'idle'); };
            this._ttsAudio.play();
        } catch (e) {
            Utils.showToast(I18n.t('t.forum_tts_failed', 'TTS 失败：') + e.message);
            this._ttsCurrentNumber = null;
            this._updateTtsBtn(number, 'idle');
        }
    },

    // 释放当前 Audio 持有的 Blob ObjectURL（幂等：重复调用是 no-op）
    _revokeTtsUrl() {
        if (this._ttsCurrentUrl) {
            URL.revokeObjectURL(this._ttsCurrentUrl);
            this._ttsCurrentUrl = null;
        }
    },

    _stopTTS() {
        const prev = this._ttsCurrentNumber;
        if (this._ttsAudio) { this._ttsAudio.pause(); this._ttsAudio = null; }
        this._revokeTtsUrl();
        if ('speechSynthesis' in window) speechSynthesis.cancel();
        this._ttsCurrentNumber = null;
        if (prev) this._updateTtsBtn(prev, 'idle');
    },

    _updateTtsBtn(number, state) {
        const btn = document.getElementById(`tts-btn-${number}`);
        if (!btn) return;
        if (state === 'playing') {
            btn.style.color = 'var(--accent-color)';
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" style="width:13px;height:13px;"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
        } else {
            btn.style.color = '';
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
        }
    },

    // ===== 导出帖子 =====

    exportThread() {
        document.getElementById('exportModal').style.display = 'flex';
    },

    _exportText() {
        document.getElementById('exportModal').style.display = 'none';
        const thread = this._findThread();
        if (!thread) return;

        const title = this.stripTranslationTags(thread.title);
        let lines = [];
        lines.push(`■ ${title}`);
        lines.push(`${'─'.repeat(40)}`);

        const allPosts = [
            { number: 1, author: thread.author, authorId: thread.authorId, timestamp: thread.timestamp, content: thread.content },
            ...(thread.replies || [])
        ];

        const _nameLabel = I18n.t('forum.export_field_name', '名前：');
        const _idPrefix = I18n.t('forum.id_prefix', 'ID:');
        allPosts.forEach(p => {
            const dateStr = this.formatDate(p.timestamp);
            lines.push(`${p.number} ${_nameLabel}${p.author} ${dateStr} ${_idPrefix}${p.authorId}`);
            // 去除翻译标签，只保留日语原文
            const { jpText } = this.extractTranslations(p.content);
            lines.push((jpText || p.content).trim());
            lines.push('');
        });

        const text = lines.join('\n');
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.slice(0, 30)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    },

    async _exportImage() {
        document.getElementById('exportModal').style.display = 'none';
        const thread = this._findThread();
        if (!thread) return;

        Utils.showToast(I18n.t('t.forum_generating_image', '生成图片中...'));

        // 动态加载 html2canvas
        if (!window.html2canvas) {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
                s.onload = resolve;
                s.onerror = () => reject(new Error('html2canvas 加载失败，请检查网络'));
                document.head.appendChild(s);
            }).catch(e => { Utils.showToast(e.message); throw e; });
        }

        // 创建离屏渲染容器
        const wrap = document.createElement('div');
        wrap.style.cssText = `
            position:fixed; left:-9999px; top:0;
            width:390px; background:#efefef;
            font-family:-apple-system,sans-serif;
            padding-bottom:16px;
        `;

        // 标题栏
        const titleBar = document.createElement('div');
        titleBar.style.cssText = 'background:#789922;color:white;padding:10px 14px;font-size:14px;font-weight:700;';
        titleBar.textContent = this.stripTranslationTags(thread.title);
        wrap.appendChild(titleBar);

        // 各帖
        const allPosts = [
            { number: 1, author: thread.author, authorId: thread.authorId, timestamp: thread.timestamp, content: thread.content },
            ...(thread.replies || [])
        ];
        allPosts.forEach(p => {
            const post = document.createElement('div');
            post.style.cssText = 'padding:10px 14px;border-bottom:1px solid #ddd;background:#efefef;';

            const header = document.createElement('div');
            header.style.cssText = 'font-size:12px;color:#666;margin-bottom:4px;';
            const _escH = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const _nameLabelH = I18n.t('forum.export_field_name', '名前：');
            const _idPrefixH = I18n.t('forum.id_prefix', 'ID:');
            header.innerHTML = `<b style="color:#000">${p.number}</b> ${_nameLabelH}<span style="color:#008000;font-weight:700;">${_escH(p.author)}</span> ${this.formatDate(p.timestamp)} <span style="color:#999">${_idPrefixH}${_escH(p.authorId)}</span>`;
            post.appendChild(header);

            const body = document.createElement('div');
            body.style.cssText = `font-size:14px;line-height:1.65;color:#333;padding-left:8px;white-space:pre-wrap;word-break:break-word;`;
            const { jpText } = this.extractTranslations(p.content);
            body.textContent = (jpText || p.content).trim();
            post.appendChild(body);
            wrap.appendChild(post);
        });

        document.body.appendChild(wrap);

        try {
            const canvas = await html2canvas(wrap, { scale: 2, useCORS: true, backgroundColor: '#efefef' });
            const url = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = url;
            const safeTitle = this.stripTranslationTags(thread.title).slice(0, 30).replace(/[\\/:*?"<>|]/g, '_');
            a.download = `${safeTitle}.png`;
            a.click();
            Utils.showToast(I18n.t('t.forum_image_downloaded', '✓ 图片已下载'));
        } catch (e) {
            Utils.showToast(I18n.t('t.forum_image_gen_failed', '图片生成失败：') + e.message);
        } finally {
            wrap.remove();
        }
    },

    // ===== 论坛 + Pixiv 专项备份 =====

    exportForumData() {
        const payload = {
            _type: 'perigee-all-modules-backup',
            _version: 2,
            _exportedAt: new Date().toISOString(),
            forumData: AppState.data.forumData || {},
            pixivData: AppState.data.pixivData || {},
            magazineData: AppState.data.magazineData || {},
            twitterData: AppState.data.twitterData || {}
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `perigee-backup-${date}.json`;
        a.click();
        URL.revokeObjectURL(url);
        Utils.showToast(I18n.t('t.forum_data_exported', '✓ 论坛+Pixiv+杂志+推特 数据已导出'));
    },

    importForumData(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                // 兼容旧版 v1 和新版 v2
                if (parsed._type !== 'perigee-forum-pixiv-backup' && parsed._type !== 'perigee-all-modules-backup') {
                    Utils.showToast(I18n.t('t.forum_invalid_backup_file', '文件格式不正确，请选择备份文件'));
                    return;
                }
                const modules = [];
                if (parsed.forumData) modules.push(I18n.t('data_export.forum', '论坛'));
                if (parsed.pixivData) modules.push(I18n.t('data_export.pixiv', 'Pixiv'));
                if (parsed.magazineData) modules.push(I18n.t('data_export.magazine', '杂志'));
                if (parsed.twitterData) modules.push(I18n.t('data_export.twitter', '推特'));
                if (!confirm(I18n.t('forum.confirm_import_modules', { modules: modules.join('+') }))) return;
                if (parsed.forumData) AppState.data.forumData = parsed.forumData;
                if (parsed.pixivData) AppState.data.pixivData = parsed.pixivData;
                if (parsed.magazineData) AppState.data.magazineData = parsed.magazineData;
                if (parsed.twitterData) AppState.data.twitterData = parsed.twitterData;
                Utils.saveData();
                Utils.showToast(I18n.t('t.forum_import_success', '✓ 导入成功，即将刷新'));
                setTimeout(() => location.reload(), 1000);
            } catch (err) {
                Utils.showToast(I18n.t('t.forum_import_failed', '导入失败：文件格式错误'));
            }
        };
        reader.readAsText(file);
    },

    // 全データクリア → 已迁移到 Utils.resetAllData()，此处保留薄壳供旧调用点使用
    clearAllModuleData() {
        return Utils.resetAllData();
    },

    updateStorageBar() {
        const bar = document.getElementById('storageBar');
        const text = document.getElementById('storageText');
        if (!bar || !text) return;

        // 迁移到 IndexedDB 后，直接估算 AppState.data 序列化大小
        let totalBytes = 0;
        try {
            totalBytes = JSON.stringify(AppState.data).length * 2; // UTF-16: 2 bytes/char
        } catch (e) { return; }

        const usedKB = (totalBytes / 1024).toFixed(1);
        const usedMB = (totalBytes / 1024 / 1024).toFixed(2);
        const LIMIT_MB = 50; // IndexedDB 可用容量保守估计 50MB
        const pct = Math.min((totalBytes / 1024 / 1024 / LIMIT_MB) * 100, 100);

        bar.style.width = pct + '%';
        const rs = getComputedStyle(document.documentElement);
        if (pct < 60) {
            bar.style.background = rs.getPropertyValue('--success-color').trim() || '#34c759';
        } else if (pct < 85) {
            bar.style.background = rs.getPropertyValue('--warning-color').trim() || '#ff9500';
        } else {
            bar.style.background = rs.getPropertyValue('--danger-color').trim() || '#ff3b30';
        }

        const warning = pct >= 85 ? I18n.t('data.storage_warning') : '';
        text.textContent = I18n.t('data.storage_used', {
            usedMB,
            limitMB: LIMIT_MB,
            pct: pct.toFixed(1),
            usedKB,
            warning
        });
    },

    saveSettings() {
        const data = AppState.data.forumData;
        data.forumRules = document.getElementById('forumRules').value.trim();
        data.isAnonymous = document.getElementById('forumAnonymous').checked;
        data.userName = document.getElementById('forumUserName').value.trim();
        data.fontSize = parseInt(document.getElementById('forumFontSize').value) || 15;
        this.applyFontSize();

        Utils.saveData();
        Utils.showToast(I18n.t('t.forum_settings_saved', '✓ 论坛设置已保存'));
    },

    // ===== 合并总结管理 =====

    // v2.136.0: showSummaryModal / closeSummaryModal 已移除——总结管理从弹窗下放为放送局「总结」Tab 的一级内容，
    // 切 tab 即由 Broadcast._initSummaryTab() 重置 _summaryPreviewData 并调用 _renderSummaryModal() 直接渲染。

    // 计算下一期总结将覆盖的范围
    _calcNextSummaryScope(untilPlotId) {
        const data = AppState.data.forumData;
        const plots = AppState.data.broadcast.plotProgress || [];
        const infos = AppState.data.broadcast.officialInfo || [];
        const mergedSummaries = AppState.data.broadcast.mergedSummaries || [];
        const plotSummaries = AppState.data.broadcast.plotSummaries || [];

        const coveredPlotIds = new Set([
            ...mergedSummaries.flatMap(s => s.coveredPlotIds || []),
            ...plotSummaries.flatMap(s => s.coveredIds || [])
        ]);
        const coveredInfoIds = new Set([
            ...mergedSummaries.flatMap(s => s?.coveredInfoIds || []),
            ...(AppState.data.broadcast.officialSummaries || []).flatMap(s => s.coveredIds || [])
        ]);

        // 未总结的剧情列表（按原顺序）
        const uncoveredPlots = plots.filter(p => !coveredPlotIds.has(p.id));

        // 找到目标 plot 的位置（含）
        const targetIdx = uncoveredPlots.findIndex(p => p.id === untilPlotId);
        if (targetIdx < 0) return null;

        const toSummarizePlots = uncoveredPlots.slice(0, targetIdx + 1);
        const toSummarizePlotIds = new Set(toSummarizePlots.map(p => p.id));

        // 关联的官方情报：afterPlotId 在选中剧情中，且未总结
        const relatedInfos = infos.filter(e =>
            !coveredInfoIds.has(e.id) && e.afterPlotId && toSummarizePlotIds.has(e.afterPlotId)
        );
        // afterPlotId 为空 且未总结 且是第一批 → 纳入（方案A）
        const prePlotInfos = (mergedSummaries.length === 0 && plotSummaries.length === 0)
            ? infos.filter(e => !coveredInfoIds.has(e.id) && !e.afterPlotId)
            : [];

        return {
            plots: toSummarizePlots,
            infos: [...prePlotInfos, ...relatedInfos]
        };
    },

    // 动态渲染 modal 内容
    _renderSummaryModal() {
        const data = AppState.data.forumData;
        const mergedSummaries = AppState.data.broadcast.mergedSummaries || [];
        // 旧字段兼容展示
        const legacySummaries = [
            ...(AppState.data.broadcast.plotSummaries || []).map(s => ({ ...s, _legacy: 'plot' })),
            ...(AppState.data.broadcast.officialSummaries || []).map(s => ({ ...s, _legacy: 'official' }))
        ];

        const coveredPlotIds = new Set([
            ...mergedSummaries.flatMap(s => s.coveredPlotIds || []),
            ...(AppState.data.broadcast.plotSummaries || []).flatMap(s => s.coveredIds || [])
        ]);
        const uncoveredPlots = (AppState.data.broadcast.plotProgress || []).filter(p => !coveredPlotIds.has(p.id));

        let html = '';

        // ── 已有合并总结列表 ──
        const allSummaries = [...mergedSummaries, ...legacySummaries];
        if (allSummaries.length > 0) {
            allSummaries.forEach((s, i) => {
                const isLegacy = !!s._legacy;
                const titleList = (s.titleIndex || []).join('、') ||
                    I18n.t('forum.summary_range_count', { n: (s.coveredPlotIds || s.coveredIds || []).length });
                const preview = s.content.slice(0, 60) + (s.content.length > 60 ? '…' : '');
                const periodLabel = I18n.t('forum.summary_period_num', { n: i + 1 });
                const label = isLegacy
                    ? `${I18n.t('forum.summary_legacy_prefix', { kind: s._legacy === 'plot' ? I18n.t('forum.summary_legacy_plot', '剧情') : I18n.t('forum.summary_legacy_official', '情报') })} ${periodLabel}`
                    : periodLabel;
                html += `
                <div class="summary-list-item">
                    <div class="summary-list-header">
                        <span class="summary-list-label">${label}</span>
                        <span class="summary-list-range">${titleList}</span>
                        <div style="display:flex;gap:6px;flex-shrink:0;">
                            <button class="glass-btn small" onclick="Forum._toggleSummaryEdit('${s.id}')">${I18n.t('forum.summary_edit', '编辑')}</button>
                            <button class="glass-btn small danger" onclick="Forum._deleteSummaryItem('${s.id}','${s._legacy || ''}')">${I18n.t('forum.summary_delete', '删除')}</button>
                        </div>
                    </div>
                    <div id="summaryPreview_${s.id}" class="summary-list-preview">${preview}</div>
                    <div id="summaryEditArea_${s.id}" style="display:none; margin-top:6px;">
                        <textarea rows="6" id="summaryEditTA_${s.id}" style="width:100%;box-sizing:border-box;font-size:13px;resize:vertical;">${s.content}</textarea>
                        <button class="glass-btn primary" style="width:100%;margin-top:6px;" onclick="Forum._saveSummaryItem('${s.id}','${s._legacy || ''}')">${I18n.t('forum.summary_save_changes', '保存修改')}</button>
                    </div>
                </div>`;
            });
            if (uncoveredPlots.length > 0) {
                html += `<div style="margin:12px 0 8px;border-top:1px solid var(--border-color);padding-top:10px;font-size:12px;color:var(--text-secondary);">${I18n.t('forum.summary_continue_next', '继续总结下一批：')}</div>`;
            }
        }

        // ── 生成新总结区 ──
        if (uncoveredPlots.length > 0 && !this._summaryPreviewData) {
            // 下拉选择"总结到哪集"
            const optHtml = uncoveredPlots.map(p =>
                `<option value="${p.id}">${p.title}</option>`
            ).join('');
            html += `
            <div>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
                    <span style="font-size:14px;white-space:nowrap;">${I18n.t('forum.summary_until_label', '总结到')}</span>
                    <select id="summaryUntilSelect" style="flex:1;min-width:120px;" onchange="Forum._previewSummaryScope()">
                        ${optHtml}
                    </select>
                </div>
                <div id="summaryScopeHint" style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;"></div>
                <button id="summaryGenerateBtn" class="glass-btn primary" style="width:100%;display:inline-flex;align-items:center;justify-content:center;gap:6px;" onclick="Forum.doGenerateSummary()"><svg style="width:16px;height:16px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z"/></svg><span class="fch-svg-label">${I18n.t('forum.summary_gen_btn', { n: allSummaries.length + 1 })}</span></button>
            </div>`;
        } else if (uncoveredPlots.length === 0 && allSummaries.length > 0 && !this._summaryPreviewData) {
            html += `<p style="font-size:13px;color:var(--text-secondary);margin-top:8px;">${I18n.t('forum.summary_all_done', '✅ 所有剧情已总结完毕。')}</p>`;
        } else if ((AppState.data.broadcast.plotProgress || []).length === 0 && !this._summaryPreviewData) {
            html += `<p style="font-size:13px;color:var(--text-secondary);">${I18n.t('forum.summary_no_plot', '暂无剧情可总结。')}</p>`;
        }

        // ── AI生成预览区（待确认）──
        if (this._summaryPreviewData) {
            const pd = this._summaryPreviewData;
            const rangeHint = [
                pd.plotTitles.length ? I18n.t('forum.summary_plot_titles', { titles: pd.plotTitles.join('、') }) : '',
                pd.infoTitles.length ? I18n.t('forum.summary_info_count', { n: pd.infoTitles.length }) : ''
            ].filter(Boolean).join('；');
            html += `
            <div style="border-top:1px solid var(--border-color);padding-top:12px;margin-top:4px;">
                <div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">${I18n.t('forum.summary_preview_hint', { n: allSummaries.length + 1 })}</div>
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">${rangeHint}</div>
                <textarea id="summaryPreviewContent" rows="8" style="width:100%;box-sizing:border-box;resize:vertical;font-size:13px;">${pd.content}</textarea>
                <div style="display:flex;gap:8px;margin-top:8px;">
                    <button class="glass-btn" style="flex:1;" onclick="Forum.reGenerateSummary()">${I18n.t('forum.summary_regenerate', '重新生成')}</button>
                    <button class="glass-btn primary" style="flex:1;" onclick="Forum.confirmSaveSummary()">${I18n.t('forum.summary_confirm_save', '确认保存')}</button>
                </div>
            </div>`;
        }

        document.getElementById('summaryModalBody').innerHTML = html;

        // 初始化 scope hint
        if (uncoveredPlots.length > 0 && !this._summaryPreviewData) {
            this._previewSummaryScope();
        }
    },

    // 预览选中"总结到X集"时会覆盖哪些内容
    _previewSummaryScope() {
        const sel = document.getElementById('summaryUntilSelect');
        const hintEl = document.getElementById('summaryScopeHint');
        if (!sel || !hintEl) return;
        const scope = this._calcNextSummaryScope(sel.value);
        if (!scope) { hintEl.textContent = ''; return; }
        const parts = [I18n.t('forum.summary_plots_n', { n: scope.plots.length })];
        if (scope.infos.length > 0) parts.push(I18n.t('forum.summary_infos_n', { n: scope.infos.length }));
        hintEl.textContent = I18n.t('forum.summary_scope_hint', { parts: parts.join(' + ') });
    },

    async doGenerateSummary() {
        const sel = document.getElementById('summaryUntilSelect');
        if (!sel) return;
        const untilPlotId = sel.value;
        const scope = this._calcNextSummaryScope(untilPlotId);
        if (!scope || scope.plots.length === 0) { Utils.showToast(I18n.t('t.forum_select_summary_scope', '请选择总结范围')); return; }

        const btn = document.getElementById('summaryGenerateBtn');
        if (btn) { const _sumLbl = btn.querySelector('.fch-svg-label'); if (_sumLbl) _sumLbl.textContent = I18n.t('forum.summary_generating', '生成中...'); else btn.textContent = I18n.t('forum.summary_generating', '生成中...'); btn.disabled = true; }

        try {
            const data = AppState.data.forumData;

            // 基础世界观（不调用 getWorldContext 避免泄露全量内容）
            let baseContext = '';
            if (AppState.data.broadcast.worldSetting) baseContext += `【世界观设定】\n${AppState.data.broadcast.worldSetting}\n\n`;
            const _sumWbIds = Utils.getActiveWorldBookIds();
            _sumWbIds.forEach(wbId => {
                const book = (AppState.data.worldBooks || []).find(b => b.id === wbId);
                if (book && book.entries) {
                    baseContext += `【世界书「${book.name}」】\n`;
                    book.entries.filter(e => e.enabled !== false).forEach(e => { baseContext += `[${e.title}] ${e.content}\n`; });
                    baseContext += '\n';
                }
            });

            // 构建待总结内容（剧情 + 关联情报交织）
            let contentToSummarize = '';
            const plotTitles = [];
            const infoTitles = [];
            const infosByPlot = {};
            scope.infos.forEach(e => {
                const key = e.afterPlotId || '__pre__';
                if (!infosByPlot[key]) infosByPlot[key] = [];
                infosByPlot[key].push(e);
            });

            // 剧情开始前的情报
            if (infosByPlot['__pre__']) {
                contentToSummarize += `── 剧情开始前的官方情报 ──\n`;
                infosByPlot['__pre__'].forEach(e => {
                    const cat = OFFICIAL_CATEGORIES[e.category] || { label: e.category };
                    const title = e.title || e.content.slice(0, 20);
                    contentToSummarize += `[${cat.labelJa || cat.label}]《${title}》\n${e.content}\n\n`;
                    infoTitles.push(title);
                });
            }

            // 剧情条目 + 其后情报
            scope.plots.forEach((p, i) => {
                plotTitles.push(p.title);
                contentToSummarize += `【${p.title}】\n${p.content}\n\n`;
                if (infosByPlot[p.id]) {
                    infosByPlot[p.id].forEach(e => {
                        const cat = OFFICIAL_CATEGORIES[e.category] || { label: e.category };
                        const title = e.title || e.content.slice(0, 20);
                        contentToSummarize += `  ↳ [${cat.labelJa || cat.label}]《${title}》（${p.title}后发布）\n${e.content}\n\n`;
                        infoTitles.push(title);
                    });
                }
            });

            const systemPrompt = `你是一个动漫/游戏剧情整理助手。请将用户提供的剧情进展与官方情报记录，整合成一段连贯、完整的综合总结文字。
要求：
- 涵盖所有剧情节点、角色发展、关键事件，以及各剧情节点之后的官方情报（周边/访谈/活动等）
- 保持时间顺序，剧情与情报穿插呈现
- 【重要】必须在总结正文中保留各剧情条目的原始标题作为锚点（如"ep1では〜""第3話で〜"），确保能准确知道每段剧情发生在哪一话
- 官方情报以"〜之后发布了〜"的形式自然融入正文
- 保留可能被后续讨论引用的重要细节（伏笔、名台词、转折点）
- 使用简洁流畅的中文
- 篇幅500-1000字（视内容量调整）
- 【极重要】全文必须使用过去式，明确表达所有事件均已发生（"已播出""已公开""发布了"等），严禁使用"将播出""预计""期待"等未来语气描述已发生的事件
- 【极重要】总结结尾必须单独一行写：「截至本总结，最新已发生的剧情节点为：[最后一个剧情条目的原始标题]」，让读者清楚知道当前时间线进度
- 只输出总结正文，不要有额外标题或说明`;

            const messages = [{ role: 'user', content: `${baseContext}请将以下剧情进展与官方情报整合成综合总结：\n\n${contentToSummarize}` }];

            const summaryContent = await Utils.callChatAPI(messages, systemPrompt);
            this._summaryPreviewData = {
                content: summaryContent.trim(),
                coveredPlotIds: scope.plots.map(p => p.id),
                coveredInfoIds: scope.infos.map(e => e.id),
                titleIndex: plotTitles,
                plotTitles,
                infoTitles
            };
            this._renderSummaryModal();

        } catch (e) {
            Utils.showToast(I18n.t('t.forum_gen_failed', '生成失败：') + e.message);
            console.error('[Summary Gen Error]', e);
        } finally {
            // 兜底恢复按钮：成功时 _renderSummaryModal 会重建按钮、这里操作旧引用无害；万一渲染抛异常也保证不卡死在「生成中」
            if (btn) { const _sumErrLbl = btn.querySelector('.fch-svg-label'); if (_sumErrLbl) _sumErrLbl.textContent = I18n.t('forum.summary_gen_default_btn', 'AI 生成总结'); else btn.textContent = I18n.t('forum.summary_gen_default_btn', 'AI 生成总结'); btn.disabled = false; }
        }
    },

    confirmSaveSummary() {
        if (!this._summaryPreviewData) return;
        const content = document.getElementById('summaryPreviewContent').value.trim();
        if (!content) { Utils.showToast(I18n.t('t.forum_summary_content_required', '总结内容不能为空')); return; }

        const data = AppState.data.forumData;
        if (!AppState.data.broadcast.mergedSummaries) AppState.data.broadcast.mergedSummaries = [];

        const summary = {
            id: Utils.generateId(),
            createdAt: Date.now(),
            coveredPlotIds: this._summaryPreviewData.coveredPlotIds,
            coveredInfoIds: this._summaryPreviewData.coveredInfoIds,
            titleIndex: this._summaryPreviewData.titleIndex,
            content
        };
        AppState.data.broadcast.mergedSummaries.push(summary);

        this._summaryPreviewData = null;
        Utils.saveData();
        this.renderPlotList();
        this._renderSummaryModal();
        Utils.showToast(I18n.t('t.forum_summary_saved', '✓ 综合总结已保存'));
    },

    reGenerateSummary() {
        this._summaryPreviewData = null;
        this._renderSummaryModal();
    },

    _toggleSummaryEdit(summaryId) {
        const editArea = document.getElementById(`summaryEditArea_${summaryId}`);
        const preview = document.getElementById(`summaryPreview_${summaryId}`);
        if (!editArea) return;
        const isHidden = editArea.style.display === 'none';
        editArea.style.display = isHidden ? 'block' : 'none';
        if (preview) preview.style.display = isHidden ? 'none' : 'block';
    },

    _saveSummaryItem(summaryId, legacy) {
        const ta = document.getElementById(`summaryEditTA_${summaryId}`);
        if (!ta) return;
        const content = ta.value.trim();
        if (!content) { Utils.showToast(I18n.t('t.forum_summary_content_required', '总结内容不能为空')); return; }

        const data = AppState.data.forumData;
        let list;
        if (legacy === 'plot') list = AppState.data.broadcast.plotSummaries || [];
        else if (legacy === 'official') list = AppState.data.broadcast.officialSummaries || [];
        else list = AppState.data.broadcast.mergedSummaries || [];

        const item = list.find(s => s.id === summaryId);
        if (!item) return;
        item.content = content;
        Utils.saveData();
        this._renderSummaryModal();
        Utils.showToast(I18n.t('t.forum_summary_updated', '✓ 总结已更新'));
    },

    _deleteSummaryItem(summaryId, legacy) {
        if (!confirm(I18n.t('forum.confirm_delete_summary', '确定删除这期总结？原始条目不会丢失，但将恢复为未总结状态。'))) return;
        const data = AppState.data.forumData;
        if (legacy === 'plot') {
            AppState.data.broadcast.plotSummaries = (AppState.data.broadcast.plotSummaries || []).filter(s => s.id !== summaryId);
        } else if (legacy === 'official') {
            AppState.data.broadcast.officialSummaries = (AppState.data.broadcast.officialSummaries || []).filter(s => s.id !== summaryId);
        } else {
            AppState.data.broadcast.mergedSummaries = (AppState.data.broadcast.mergedSummaries || []).filter(s => s.id !== summaryId);
        }
        Utils.saveData();
        this.renderPlotList();
        this._renderSummaryModal();
        Utils.showToast(I18n.t('t.forum_summary_deleted', '✓ 总结已删除'));
    },

    // ===== 剧情草稿箱 =====
    showPlotImportModal() {
        document.getElementById('plotImportModal').classList.add('active');
        document.getElementById('plotImportFileInput').value = '';
        document.getElementById('plotImportPreview').innerHTML = '';
    },

    closePlotImportModal() {
        document.getElementById('plotImportModal').classList.remove('active');
    },

    handlePlotFileUpload(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            let rawText = e.target.result;
            // Try to detect and handle encoding issues
            if (rawText.includes('\ufffd') || rawText.includes('\u0000')) {
                // Likely wrong encoding, try Shift-JIS
                try {
                    const buffer = await file.arrayBuffer();
                    const decoder = new TextDecoder('shift-jis');
                    rawText = decoder.decode(buffer);
                } catch (err) {
                    console.warn('[PlotImport] Encoding fallback failed:', err);
                }
            }

            // Check if it's JSON
            try {
                const jsonData = JSON.parse(rawText);
                if (Array.isArray(jsonData)) {
                    this._importPlotsFromJson(jsonData);
                    return;
                }
            } catch (_) {
                // Not JSON, proceed as text
            }

            // For text files, use AI to extract episodes
            await this._extractPlotsFromText(rawText);
        };
        reader.readAsText(file);
    },

    _importPlotsFromJson(arr) {
        const data = AppState.data.forumData;
        if (!AppState.data.broadcast.plotDrafts) AppState.data.broadcast.plotDrafts = [];
        const existingNums = new Set(AppState.data.broadcast.plotDrafts.map(d => d.episodeNumber));

        let imported = 0;
        arr.forEach((item, i) => {
            const epNum = item.episodeNumber || item.episode || (i + 1);
            if (existingNums.has(epNum)) return; // skip duplicates
            AppState.data.broadcast.plotDrafts.push({
                id: Utils.generateId(),
                episodeNumber: epNum,
                title: item.title || `第${epNum}話`,
                summary: item.summary || item.content || '',
                isPublished: false,
                importedAt: Date.now(),
                publishedAt: null
            });
            imported++;
        });

        Utils.saveData();
        this.closePlotImportModal();
        this.renderPlotDraftList();
        Utils.showToast(I18n.t('t.forum_plots_imported', { n: imported }));
    },

    async _extractPlotsFromText(rawText) {
        const preview = document.getElementById('plotImportPreview');
        preview.innerHTML = '<div style="padding:12px;color:var(--text-secondary);font-size:13px;">AI解析中...</div>';

        try {
            const systemPrompt = `あなたはアニメ・漫画のストーリーテキストから各話の要約を抽出する専門家です。

以下のテキストから、各話/各章のタイトルとあらすじを抽出してJSON配列で出力してください。

ルール:
- 各要素は { "episodeNumber": 数字, "title": "話タイトル", "summary": "あらすじ要約（80字以内）" } の形式
- 元テキストの話番号がわかる場合はそれを使用
- わからない場合は連番
- summaryは元テキストの内容を忠実に要約すること（捏造禁止）
- 出力はJSON配列のみ（説明文なし）

例:
[{"episodeNumber":1,"title":"第1話 始まり","summary":"主人公が魔法学校に入学する。同級生のBと出会い..."},{"episodeNumber":2,"title":"第2話 試練","summary":"初めての戦闘訓練で..."}]`;

            const messages = [{ role: 'user', content: rawText.slice(0, 15000) }]; // Limit input size
            const response = await Utils.callChatAPI(messages, systemPrompt);

            // Extract JSON from response
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                Utils.showToast(I18n.t('t.forum_ai_parse_failed', 'AI解析に失敗しました。テキスト形式を確認してください'));
                preview.innerHTML = '';
                return;
            }

            const parsed = JSON.parse(jsonMatch[0]);
            if (!Array.isArray(parsed) || parsed.length === 0) {
                Utils.showToast(I18n.t('t.forum_no_plots_found', '話が見つかりませんでした'));
                preview.innerHTML = '';
                return;
            }

            // Show preview before importing
            const _esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            preview.innerHTML = `
                <div style="padding:8px;font-size:13px;color:var(--text-secondary);">
                    ${parsed.length} 話を検出しました：
                </div>
                <div style="max-height:200px;overflow-y:auto;padding:0 8px;">
                    ${parsed.map(p => `
                        <div style="padding:6px 0;border-bottom:1px solid var(--border-light);font-size:12px;">
                            <strong>${_esc(p.title || `第${p.episodeNumber}話`)}</strong>
                            <div style="color:var(--text-secondary);margin-top:2px;">${_esc((p.summary || '').slice(0, 60))}...</div>
                        </div>
                    `).join('')}
                </div>
                <button class="glass-btn primary" style="width:100%;margin-top:8px;" onclick="Forum._confirmPlotImport()">
                    インポートする (${parsed.length}話)
                </button>`;

            // Store temporarily for confirmation
            this._pendingPlotImport = parsed;

        } catch (err) {
            Utils.showToast(I18n.t('t.forum_ai_parse_error', 'AI解析エラー: ') + err.message);
            preview.innerHTML = '';
            console.error('[PlotImport]', err);
        }
    },

    _confirmPlotImport() {
        if (!this._pendingPlotImport) return;
        this._importPlotsFromJson(this._pendingPlotImport);
        this._pendingPlotImport = null;
    },

    renderPlotDraftList() {
        const container = document.getElementById('plotDraftList');
        if (!container) return;

        const data = AppState.data.forumData;
        if (!AppState.data.broadcast.plotDrafts) AppState.data.broadcast.plotDrafts = [];
        const drafts = AppState.data.broadcast.plotDrafts;

        if (drafts.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-text">${I18n.t('bc.draft_empty')}</div><div class="empty-state-hint">${I18n.t('bc.draft_empty_hint')}</div></div>`;
            return;
        }

        const _esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        container.innerHTML = drafts.map(d => {
            const statusClass = d.isPublished ? 'plot-draft-published' : 'plot-draft-pending';
            const statusLabel = d.isPublished ? I18n.t('bc.draft_published') : I18n.t('bc.draft_unpublished');
            const statusColor = d.isPublished ? '#34c759' : '#ff9500';
            return `
            <div class="plot-draft-item ${statusClass}" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border-light);">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor};flex-shrink:0;"></span>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:13px;font-weight:600;">${_esc(d.title)}</div>
                    <div style="font-size:11px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc((d.summary || '').slice(0, 50))}</div>
                </div>
                <span style="font-size:10px;color:${statusColor};white-space:nowrap;">${statusLabel}</span>
                ${d.isPublished ? '' : `
                    <button class="glass-btn mini" onclick="Forum.editPlotDraft('${d.id}')">${I18n.t('btn.edit')}</button>
                    <button class="glass-btn mini primary" onclick="Forum.publishPlotDraft('${d.id}')">${I18n.t('bc.draft_publish')}</button>
                `}
                <button class="glass-btn mini danger" onclick="Forum.deletePlotDraft('${d.id}')">×</button>
            </div>`;
        }).join('');
    },

    publishPlotDraft(draftId) {
        const data = AppState.data.forumData;
        if (!AppState.data.broadcast.plotDrafts) return;
        const draft = AppState.data.broadcast.plotDrafts.find(d => d.id === draftId);
        if (!draft || draft.isPublished) return;

        // Add to plotProgress (same as addPlotEntry logic)
        if (!AppState.data.broadcast.plotProgress) AppState.data.broadcast.plotProgress = [];
        AppState.data.broadcast.plotProgress.push({
            id: Utils.generateId(),
            title: draft.title,
            content: draft.summary,
            timestamp: Date.now()
        });

        // Mark draft as published
        draft.isPublished = true;
        draft.publishedAt = Date.now();

        // Handle pending goods release (same as addPlotEntry)
        const pendingGoods = (AppState.data.broadcast.officialInfo || []).filter(e => e.pendingRelease && e.category === 'goods');
        if (pendingGoods.length > 0) {
            const newPlot = AppState.data.broadcast.plotProgress[AppState.data.broadcast.plotProgress.length - 1];
            pendingGoods.forEach(goods => {
                // 原「预告 / 受注中」条目保留，pendingRelease 置 false；其 goods.status 不变（历史记录）
                goods.pendingRelease = false;
                const releaseEntry = {
                    id: Utils.generateId(),
                    title: `【発売】${goods.title || goods.content.slice(0, 15)} `,
                    content: `${goods.content} \n（正式発売！商品の発送が始まっています。）`,
                    category: 'goods',
                    afterPlotId: newPlot.id,
                    sourceNpcId: goods.sourceNpcId || null,
                    sourceNpcIds: goods.sourceNpcIds || [],
                    timestamp: Date.now() + 1,
                    isGoodsRelease: true
                };
                // 结构化周边：発売条目继承原 goods 块，status 设为「贩售中」
                if (goods.goods) {
                    releaseEntry.goods = { ...goods.goods, status: '贩售中' };
                }
                AppState.data.broadcast.officialInfo.push(releaseEntry);
            });
        }

        Utils.saveData();

        // Emit event
        Utils.emitEvent('plot_published', 'forum', { title: draft.title, summary: draft.summary.slice(0, 80) });

        // メロンブックス商品ステータス連動
        const draftPlotId = AppState.data.broadcast.plotProgress[AppState.data.broadcast.plotProgress.length - 1]?.id;
        if (draftPlotId && typeof Melonbooks !== 'undefined' && Melonbooks.onPlotPublished) {
            Melonbooks.onPlotPublished(draftPlotId);
        }
        if (draftPlotId && typeof Mercari !== 'undefined' && Mercari.onPlotPublished) Mercari.onPlotPublished(draftPlotId);
        if (draftPlotId && typeof Wandoro !== 'undefined' && Wandoro.onPlotPublished) Wandoro.onPlotPublished(draftPlotId);   // v2.129.0 完結前：草稿发布也起一轮 ワンドロ（抽到 wandoro.js、缺失则 no-op）

        this.renderPlotDraftList();
        this.renderPlotList();
        Utils.showToast(I18n.t('t.forum_draft_published', { n: draft.title }));

        // Show goods quick banner
        this._showGoodsQuickBanner();

        // 日本同人圈自动生成 — pixiv 独立开关
        if (AppState.data.pixivData?.settings?.autoGenOnNewPlot) {
            const genCount = Math.max(1, Math.min(5, AppState.data.pixivData.settings.autoGenCount || 1));
            setTimeout(async () => {
                for (let _gi = 0; _gi < genCount; _gi++) {
                    await PixivNovel.autoGenerateNovel().catch(e => console.warn('[AutoGen]', e));
                }
            }, 300);
        }

        // v2.73.6: 中文同人圈自动生成 — 微博 + lofter 共享 lofter 开关、跟 pixiv 完全解绑
        // （之前 lofter hook 在草稿发布分支完全缺失、本次补齐 + recentPlotSummary 之前永远空串、本次传草稿 title + summary）
        if (typeof Lofter !== 'undefined' && AppState.data.lofterData?.settings?.autoGenOnNewPlot) {
            const plotSummary = `${draft.title} — ${(draft.summary || draft.content || '').slice(0, 120)}`;
            if (typeof Weibo !== 'undefined' && AppState.data.weiboData) {
                const wbCount = AppState.data.weiboData.autoGenWeiboCount || 4;
                setTimeout(() => {
                    Weibo._generateNpcWeibos(wbCount, plotSummary).catch(e => console.warn('[Weibo autoGen]', e));
                    Weibo._maybeSeedHotsearch(plotSummary).catch(e => console.warn('[Weibo hotsearch]', e));
                }, 500);
            }
            const lofCount = Math.max(1, Math.min(5, AppState.data.lofterData.settings.autoGenCount || 2));
            setTimeout(() => Lofter._autoGenerateOnPlot(lofCount).catch(e => console.warn('[Lofter autoGen]', e)), 700);
        }
    },

    editPlotDraft(draftId) {
        const data = AppState.data.forumData;
        if (!AppState.data.broadcast.plotDrafts) return;
        const draft = AppState.data.broadcast.plotDrafts.find(d => d.id === draftId);
        if (!draft || draft.isPublished) return;

        const newTitle = prompt(I18n.t('forum.draft_title_prompt', 'タイトル:'), draft.title);
        if (newTitle === null) return;
        const newSummary = prompt(I18n.t('forum.draft_summary_prompt', 'あらすじ:'), draft.summary);
        if (newSummary === null) return;

        draft.title = newTitle.trim() || draft.title;
        draft.summary = newSummary.trim() || draft.summary;
        Utils.saveData();
        this.renderPlotDraftList();
        Utils.showToast(I18n.t('t.forum_draft_updated', '✓ 草稿を更新しました'));
    },

    deletePlotDraft(draftId) {
        const data = AppState.data.forumData;
        if (!AppState.data.broadcast.plotDrafts) return;
        AppState.data.broadcast.plotDrafts = AppState.data.broadcast.plotDrafts.filter(d => d.id !== draftId);
        Utils.saveData();
        this.renderPlotDraftList();
    },

    // ===== 常驻讨論串 =====
    showCreatePersistentThreadModal() {
        document.getElementById('persistentThreadModal').classList.add('active');
        document.getElementById('persistentThreadTitle').value = '';
        document.getElementById('persistentThreadKeywords').value = '';
        document.getElementById('persistentThreadType').value = 'custom';
        this._updatePersistentPreset();
    },

    _updatePersistentPreset() {
        const type = document.getElementById('persistentThreadType').value;
        const titleEl = document.getElementById('persistentThreadTitle');
        const kwEl = document.getElementById('persistentThreadKeywords');
        const presets = {
            goods: { title: 'グッズ総合スレ', keywords: 'グッズ,周辺,物販,アクスタ,缶バッジ,ぬいぐるみ,goods' },
            cp: { title: 'CP総合スレ', keywords: 'カプ,推しカプ,CP,尊い,公式,関係' },
            analysis: { title: '考察総合スレ', keywords: '考察,伏線,考察班,深読み,仮説,理論' },
            custom: { title: '', keywords: '' }
        };
        const preset = presets[type] || presets.custom;
        if (type !== 'custom') {
            titleEl.value = preset.title;
            kwEl.value = preset.keywords;
        }
    },

    createPersistentThread() {
        const title = document.getElementById('persistentThreadTitle').value.trim();
        const keywordsRaw = document.getElementById('persistentThreadKeywords').value.trim();
        if (!title) { Utils.showToast(I18n.t('t.forum_title_required', 'タイトルを入力してください')); return; }

        const keywords = keywordsRaw.split(/[,，、\s]+/).filter(Boolean);
        const data = AppState.data.forumData;
        if (!data.threads) data.threads = [];

        const threadId = Utils.generateId();
        data.threads.unshift({
            id: threadId,
            title: `【総合】${title}`,
            content: `ここは ${title} です。関連する話題をまとめて語りましょう。`,
            author: '名無しさん',
            authorId: this.generateAnonId(),
            timestamp: Date.now(),
            threadType: 'persistent',
            isPersistent: true,
            keywords: keywords,
            replies: [],
            partNum: 1
        });

        Utils.saveData();
        document.getElementById('persistentThreadModal').classList.remove('active');
        this.renderThreadList();
        Utils.showToast(I18n.t('t.forum_persistent_thread_created', { n: title }));
    },

    _matchPersistentThread(content) {
        const data = AppState.data.forumData;
        const threads = (data.threads || []).filter(t => t.isPersistent && (t.replies || []).length < this.THREAD_REPLY_LIMIT);
        if (threads.length === 0) return null;

        const contentLower = (content || '').toLowerCase();
        for (const thread of threads) {
            const keywords = thread.keywords || [];
            const matchCount = keywords.filter(kw => contentLower.includes(kw.toLowerCase())).length;
            if (matchCount > 0) return thread;
        }
        return null;
    },

    _getPersistentThreadContext() {
        const data = AppState.data.forumData;
        const persistent = (data.threads || []).filter(t => t.isPersistent);
        if (persistent.length === 0) return '';

        return `\n【常驻ディスカッションスレ】
以下の常驻スレッドが存在します。生成したレスの内容がこれらのキーワードに強くマッチする場合、===PERSISTENT_REPLY===マーカーを使って該当する常驻スレへの新レスとして出力することができます（任意）:
${persistent.map(t => {
            const replyCount = (t.replies || []).length;
            const full = replyCount >= this.THREAD_REPLY_LIMIT;
            return `- 「${t.title}」(id: ${t.id}, keywords: ${(t.keywords || []).join('/')}, ${replyCount}レス${full ? ' ※満員' : ''})`;
        }).join('\n')}

常驻スレへのレスを出力する場合のフォーマット:
===PERSISTENT_REPLY===
THREAD_ID: [上記のid]
AUTHOR: 名無しさん
CONTENT:
（レス内容）
`;
    },

};
