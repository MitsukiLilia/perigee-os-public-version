const WorldBook = {
    currentBookId: null,
    currentEntryId: null,

    // 渲染世界书列表
    renderList() {
        const list = document.getElementById('worldBookList');
        const books = AppState.data.worldBooks || [];

        if (books.length === 0) {
            list.innerHTML = '<div class="empty-state">点击右上角 New 创建世界书</div>';
            return;
        }

        list.innerHTML = books.map(book => {
            const entryCount = book.entries ? book.entries.length : 0;
            const enabledCount = book.entries ? book.entries.filter(e => e.enabled !== false).length : 0;
            const countLabel = entryCount === enabledCount ? `${entryCount} 个条目` : `${enabledCount}/${entryCount} 已启用`;
            return `
                <div class="chat-item" onclick="WorldBook.openBook('${book.id}')">
                    <div class="chat-avatar" style="background: var(--accent-color); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 24px; height: 24px;">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                        </svg>
                    </div>
                    <div class="chat-info">
                        <div class="chat-name">${this._escapeHtml(book.name)}</div>
                        <div class="chat-preview">${countLabel}</div>
                    </div>
                </div>
            `;
        }).join('');
    },

    // 创建新世界书
    createBook() {
        const name = prompt('请输入世界书名称：', 'My World Book');
        if (!name) return;

        if (!AppState.data.worldBooks) AppState.data.worldBooks = [];

        const newBook = {
            id: Utils.generateId(),
            name: name,
            entries: []
        };

        AppState.data.worldBooks.push(newBook);
        Utils.saveData();
        this.renderList();
    },

    // 重命名当前世界书
    renameBook() {
        const book = AppState.data.worldBooks.find(b => b.id === this.currentBookId);
        if (!book) return;

        const name = prompt(I18n.t('t.wb_rename_prompt'), book.name);
        if (name === null) return;          // 用户取消
        const trimmed = name.trim();
        if (!trimmed) return alert(I18n.t('t.wb_name_empty'));

        book.name = trimmed;
        Utils.saveData();
        document.getElementById('worldBookTitle').textContent = trimmed;
        this.renderList();
    },

    // 删除当前整本世界书
    deleteBook() {
        const book = AppState.data.worldBooks.find(b => b.id === this.currentBookId);
        if (!book) return;

        const count = book.entries ? book.entries.length : 0;
        if (!confirm(I18n.t('t.wb_delete_confirm', { name: book.name, count: count }))) return;

        const deletedId = this.currentBookId;
        AppState.data.worldBooks = (AppState.data.worldBooks || []).filter(b => b.id !== deletedId);
        // v2.178.0 P3 3-6: 世界书删除后清理 lofter 合集里的悬空引用，避免续章静默拿不到世界观
        (AppState.data.lofterData?.collections || []).forEach(c => {
            if (Array.isArray(c.worldBookIds) && c.worldBookIds.includes(deletedId)) {
                c.worldBookIds = c.worldBookIds.filter(id => id !== deletedId);
            }
        });
        this.currentBookId = null;
        Utils.saveData();
        Navigation.goTo('worldbook');
        this.renderList();
    },

    // 打开世界书详情
    openBook(bookId) {
        this.currentBookId = bookId;
        const book = AppState.data.worldBooks.find(b => b.id === bookId);
        if (!book) return;

        document.getElementById('worldBookTitle').textContent = book.name;
        Navigation.goTo('worldbookDetail');
        this.renderEntries();
    },

    // 渲染条目列表
    renderEntries() {
        const book = AppState.data.worldBooks.find(b => b.id === this.currentBookId);
        if (!book) return;

        const container = document.getElementById('worldBookEntriesList');
        const entries = book.entries || [];

        if (entries.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无条目<br>点击右上角 + 添加</div>';
            return;
        }

        container.innerHTML = entries.map(entry => {
            const isEnabled = entry.enabled !== false;
            const keysPreview = entry.keys ? entry.keys.slice(0, 3).join(', ') : '';
            const contentPreview = (entry.content || '').slice(0, 50).replace(/\n/g, ' ');
            const dimStyle = isEnabled ? '' : 'opacity:0.4;';
            return `
                <div class="settings-card" style="margin-bottom:12px;">
                    <div style="padding:12px 16px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:10px;">
                            <div style="font-weight:600;font-size:15px;${isEnabled ? '' : 'text-decoration:line-through;opacity:0.45;'}cursor:pointer;"
                                onclick="WorldBook.openEntry('${entry.id}')">${this._escapeHtml(entry.title)}</div>
                            <label class="wb-toggle" title="${isEnabled ? '点击关闭' : '点击开启'}">
                                <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="WorldBook.toggleEntry('${entry.id}',this.checked)">
                                <span class="wb-toggle-slider"></span>
                            </label>
                        </div>
                        <div style="font-size:12px;color:#666;margin-bottom:6px;${dimStyle}cursor:pointer;" onclick="WorldBook.openEntry('${entry.id}')">
                            <strong>关键词：</strong>${this._escapeHtml(keysPreview) || '无'}
                        </div>
                        <div style="font-size:13px;color:#888;${dimStyle}cursor:pointer;" onclick="WorldBook.openEntry('${entry.id}')">
                            ${this._escapeHtml(contentPreview)}${(entry.content || '').length > 50 ? '...' : ''}
                        </div>
                        <button class="glass-btn danger" style="margin-top:10px;padding:6px 12px;font-size:12px;" onclick="event.stopPropagation();WorldBook.deleteEntry('${entry.id}')">删除条目</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    // 添加新条目
    addEntry() {
        this.currentEntryId = null;
        document.getElementById('entryTitle').value = '';
        document.getElementById('entryKeys').value = '';
        document.getElementById('entryContent').value = '';
        Navigation.goTo('entryEditor');
    },

    // 打开条目编辑
    openEntry(entryId) {
        const book = AppState.data.worldBooks.find(b => b.id === this.currentBookId);
        if (!book) return;

        const entry = book.entries.find(e => e.id === entryId);
        if (!entry) return;

        this.currentEntryId = entryId;
        document.getElementById('entryTitle').value = entry.title;
        document.getElementById('entryKeys').value = entry.keys ? entry.keys.join(', ') : '';
        document.getElementById('entryContent').value = entry.content;
        Navigation.goTo('entryEditor');
    },

    // 保存条目
    saveEntry() {
        const title = document.getElementById('entryTitle').value.trim();
        const keysStr = document.getElementById('entryKeys').value.trim();
        const content = document.getElementById('entryContent').value.trim();

        if (!title || !content) {
            return alert('标题和内容不能为空');
        }

        const keys = keysStr.split(',').map(k => k.trim()).filter(k => k);

        const book = AppState.data.worldBooks.find(b => b.id === this.currentBookId);
        if (!book) return;

        if (!book.entries) book.entries = [];

        if (this.currentEntryId) {
            // 更新现有条目
            const entry = book.entries.find(e => e.id === this.currentEntryId);
            if (entry) {
                entry.title = title;
                entry.keys = keys;
                entry.content = content;
            }
        } else {
            // 创建新条目
            book.entries.push({
                id: Utils.generateId(),
                title: title,
                keys: keys,
                content: content
            });
        }

        Utils.saveData();
        Navigation.goTo('worldbookDetail');
        this.renderEntries();
        Utils.showToast('条目已保存');
    },

    // 切换条目启用/禁用
    toggleEntry(entryId, enabled) {
        const book = AppState.data.worldBooks.find(b => b.id === this.currentBookId);
        if (!book) return;
        const entry = book.entries.find(e => e.id === entryId);
        if (!entry) return;
        entry.enabled = enabled;
        Utils.saveData();
        // 更新列表显示（不重绘整个列表，只更新样式）
        this.renderEntries();
    },

    // 删除条目
    deleteEntry(entryId) {
        if (!confirm('确定删除此条目？')) return;

        const book = AppState.data.worldBooks.find(b => b.id === this.currentBookId);
        if (!book) return;

        book.entries = book.entries.filter(e => e.id !== entryId);
        Utils.saveData();
        this.renderEntries();
    },

    // ===== 导入/导出：字段映射纯函数 =====

    // SillyTavern 条目 → Perigee 条目
    _stEntryToPerigee(st) {
        const keys = Array.isArray(st && st.key)
            ? st.key.filter(k => typeof k === 'string' && k.trim())
            : [];
        let title = (st && typeof st.comment === 'string' && st.comment.trim())
            ? st.comment.trim() : '';
        if (!title) title = keys[0] || '未命名条目';
        return {
            id: Utils.generateId(),
            title: title,
            keys: keys,
            content: (st && typeof st.content === 'string') ? st.content : '',
            enabled: !(st && st.disable === true)
        };
    },

    // Perigee 条目 → SillyTavern 条目（补齐 ST 默认字段）
    _perigeeEntryToST(entry, index) {
        return {
            uid: index,
            key: Array.isArray(entry.keys) ? entry.keys.slice() : [],
            keysecondary: [],
            comment: entry.title || '',
            content: entry.content || '',
            constant: false,
            vectorized: false,
            selective: true,
            selectiveLogic: 0,
            addMemo: true,
            order: 100,
            position: 0,
            disable: entry.enabled === false,
            excludeRecursion: false,
            preventRecursion: false,
            delayUntilRecursion: false,
            probability: 100,
            useProbability: true,
            depth: 4,
            group: '',
            groupOverride: false,
            groupWeight: 100,
            scanDepth: null,
            caseSensitive: null,
            matchWholeWords: null,
            useGroupScoring: null,
            automationId: '',
            role: null,
            sticky: 0,
            cooldown: 0,
            delay: 0,
            displayIndex: index
        };
    },

    // 书名 → 安全文件名
    _sanitizeFilename(name) {
        const cleaned = String(name || '').replace(/[\/\\:*?"<>|]/g, '_').trim();
        return cleaned || 'worldbook';
    },

    // 解析导入文件文本 → {ok, book?, advancedCount?, error?}
    _parseImportedJSON(text, fileName) {
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            return { ok: false, error: '这不是有效的 JSON 文件' };
        }
        if (!data || typeof data !== 'object' || Array.isArray(data) ||
            !data.entries || typeof data.entries !== 'object' || Array.isArray(data.entries)) {
            return { ok: false, error: '这不像一个世界书文件' };
        }
        let name = (typeof data.name === 'string' && data.name.trim())
            ? data.name.trim() : '';
        if (!name) {
            name = String(fileName || '').replace(/\.json$/i, '').trim() || '未命名世界书';
        }
        const stEntries = Object.values(data.entries);
        const entries = stEntries.map(st => this._stEntryToPerigee(st));
        const advancedCount = stEntries.filter(st => st && (
            st.constant === true ||
            st.excludeRecursion === true ||
            st.preventRecursion === true ||
            st.delayUntilRecursion === true
        )).length;
        return {
            ok: true,
            book: { id: Utils.generateId(), name: name, entries: entries },
            advancedCount: advancedCount
        };
    },

    // 导出一本世界书为 SillyTavern 格式 .json
    exportBook(bookId) {
        const book = (AppState.data.worldBooks || []).find(b => b.id === bookId);
        if (!book) {
            Utils.showToast(I18n.t('t.wb_export_not_found', '找不到要导出的世界书'), 3000);
            return;
        }
        const stData = { name: book.name, entries: {} };
        (book.entries || []).forEach((entry, i) => {
            stData.entries[String(i)] = this._perigeeEntryToST(entry, i);
        });
        const blob = new Blob([JSON.stringify(stData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this._sanitizeFilename(book.name) + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        Utils.showToast(I18n.t('t.wb_exported', {name: book.name}), 3000);
    },

    // ===== 导入：辅助 =====

    // HTML 转义（收口：转发 Utils.escapeHtml）
    _escapeHtml(str) {
        return Utils.escapeHtml(str);
    },

    // 生成不与现有世界书重名的名字
    _uniqueName(base) {
        const taken = new Set((AppState.data.worldBooks || []).map(b => b.name));
        let candidate = base + ' (导入)';
        if (!taken.has(candidate)) return candidate;
        let n = 2;
        while (taken.has(base + ' (导入 ' + n + ')')) n++;
        return base + ' (导入 ' + n + ')';
    },

    // 导入完成 toast（带高级字段提示）
    _importToast(verb, name, advancedCount, entryCount) {
        // verb 传入的是中文字面量（已导入/已覆盖），翻成本地化动词
        const verbKey = verb === '已覆盖' ? 't.wb_verb_overwritten' : 't.wb_verb_imported';
        const verbText = I18n.t(verbKey, verb);
        let msg = I18n.t('t.wb_imported', { verb: verbText, name, count: entryCount });
        if (advancedCount > 0) {
            msg += I18n.t('t.wb_imported_advanced', { n: advancedCount });
        }
        Utils.showToast(msg, advancedCount > 0 ? 5000 : 3000);
    },

    // 把解析结果落地到 worldBooks（含同名分支）
    _applyImportedBook(result) {
        if (!AppState.data.worldBooks) AppState.data.worldBooks = [];
        const books = AppState.data.worldBooks;
        const existing = books.find(b => b.name === result.book.name);
        if (!existing) {
            books.push(result.book);
            Utils.saveData();
            this.renderList();
            this._importToast('已导入', result.book.name,
                result.advancedCount, result.book.entries.length);
            return;
        }
        this._showImportConflictModal(result, existing);
    },

    // 同名弹窗
    _showImportConflictModal(result, existing) {
        this._pendingImport = { result: result, existingId: existing.id };
        const safeName = this._escapeHtml(result.book.name);
        const html = `
        <div class="wb-modal-overlay" id="wbImportConflictModal" onclick="if(event.target===this)WorldBook._cancelImportConflict()">
            <div class="wb-modal">
                <div class="wb-modal-title">已存在世界书《${safeName}》</div>
                <div class="wb-modal-desc">要怎么处理这次导入？</div>
                <div class="wb-modal-buttons">
                    <button class="glass-btn" onclick="WorldBook._resolveImportConflict('overwrite')">覆盖那本</button>
                    <button class="glass-btn" onclick="WorldBook._resolveImportConflict('new')">另存为新书</button>
                </div>
                <button class="glass-btn wb-modal-cancel" onclick="WorldBook._cancelImportConflict()">取消</button>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    _closeImportConflictModal() {
        document.getElementById('wbImportConflictModal')?.remove();
    },

    _cancelImportConflict() {
        this._pendingImport = null;
        this._closeImportConflictModal();
    },

    _resolveImportConflict(mode) {
        const pending = this._pendingImport;
        if (!pending) { this._closeImportConflictModal(); return; }
        const books = AppState.data.worldBooks;
        const result = pending.result;
        if (mode === 'overwrite') {
            const target = books.find(b => b.id === pending.existingId);
            if (target) target.entries = result.book.entries;
            this._importToast('已覆盖', target ? target.name : result.book.name,
                result.advancedCount, result.book.entries.length);
        } else {
            const book = result.book;
            book.name = this._uniqueName(book.name);
            books.push(book);
            this._importToast('已导入', book.name,
                result.advancedCount, book.entries.length);
        }
        this._pendingImport = null;
        this._closeImportConflictModal();
        Utils.saveData();
        this.renderList();
    },

    // 点「导入世界书」→ 选文件 → 解析 → 落地
    importBook() {
        let input = document.getElementById('worldBookImportInput');
        if (!input) {
            input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';
            input.id = 'worldBookImportInput';
            input.style.display = 'none';
            document.body.appendChild(input);
        }
        input.value = '';
        input.onchange = () => {
            const file = input.files && input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                const result = this._parseImportedJSON(reader.result, file.name);
                if (!result.ok) { alert(result.error); return; }
                this._applyImportedBook(result);
            };
            reader.onerror = () => alert('读取文件失败');
            reader.readAsText(file);
        };
        input.click();
    }
};

// 歌词创作模块（完全隔离的提示词系统）
