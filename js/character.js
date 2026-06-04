const CharEditor = {
    currentEditId: null, // 当前编辑的角色ID，null表示新建

    init() {
        // 加载世界书列表到下拉框
        const worldBookSelect = document.getElementById('charWorldBook');
        worldBookSelect.innerHTML = '<option value="">无</option>';
        AppState.data.worldBooks.forEach(book => {
            const option = document.createElement('option');
            option.value = book.id;
            option.textContent = book.name;
            worldBookSelect.appendChild(option);
        });

        // 显示/隐藏角色管理卡片
        const managementCard = document.getElementById('charManagementCard');
        if (this.currentEditId === null) {
            document.getElementById('characterEditorTitle').textContent = 'New Contact';
            managementCard.style.display = 'none';
            this.clearForm();
        } else {
            document.getElementById('characterEditorTitle').textContent = 'Edit Contact';
            managementCard.style.display = 'block';
        }
    },

    clearForm() {
        document.getElementById('charName').value = '';
        document.getElementById('charAvatar').value = '';
        document.getElementById('charPersonality').value = '';
        document.getElementById('charFirstMessage').value = '';
        document.getElementById('charWorldBook').value = '';
        document.getElementById('charReadMessageCount').value = '10';
        document.getElementById('charMaxMessagesPerReply').value = '8';
        document.getElementById('autoSummaryCount').value = '20';
        document.getElementById('hideAfterSummary').checked = false;
        document.getElementById('charReplyLang').value = 'ja';
        const enableVoiceEl = document.getElementById('charEnableVoice');
        if (enableVoiceEl) enableVoiceEl.checked = false;
        const voiceIdEl = document.getElementById('charVoiceId');
        if (voiceIdEl) voiceIdEl.value = '';
    },

    save() {
        const name = document.getElementById('charName').value.trim();
        if (!name) return alert('Name required');

        const charData = {
            name,
            avatar: document.getElementById('charAvatar').value.trim(),
            personality: document.getElementById('charPersonality').value.trim(),
            firstMessage: document.getElementById('charFirstMessage').value.trim(),
            worldBookId: document.getElementById('charWorldBook').value || null,
            readMessageCount: parseInt(document.getElementById('charReadMessageCount').value) || 10,
            maxMessagesPerReply: parseInt(document.getElementById('charMaxMessagesPerReply').value) || 8,
            autoSummaryCount: parseInt(document.getElementById('autoSummaryCount').value) || 20,
            hideAfterSummary: document.getElementById('hideAfterSummary').checked,
            replyLang: document.getElementById('charReplyLang')?.value || 'ja',
            enableVoice: document.getElementById('charEnableVoice')?.checked || false,
            voiceId: (document.getElementById('charVoiceId')?.value || '').trim()
        };

        if (CharEditor.currentEditId) {
            // 编辑现有角色
            const char = AppState.data.characters.find(c => c.id === CharEditor.currentEditId);
            if (char) {
                Object.assign(char, charData);
            }
        } else {
            // 新建角色
            AppState.data.characters.push({
                id: Utils.generateId(),
                ...charData
            });
        }

        Utils.saveData();
        CharEditor.currentEditId = null;
        Navigation.back('chat');
        ChatList.render();
    }
};
// 角色删除和历史管理
const CharacterManager = {
    // 删除角色（包括所有相关数据）
    deleteCharacter(charId) {
        if (!confirm(I18n.t('char.confirm_delete', '确定要删除这个角色吗？这将删除角色及其所有聊天记录，且无法恢复。'))) {
            return;
        }

        // 查找角色
        const charIndex = AppState.data.characters.findIndex(c => c.id === charId);
        if (charIndex === -1) {
            alert(I18n.t('char.not_found', '角色不存在'));
            return;
        }

        // 删除角色
        AppState.data.characters.splice(charIndex, 1);

        // 删除对话记录
        delete AppState.data.conversations[charId];

        // 从所有身份的绑定中移除
        if (AppState.data.myPersonaPresets) {
            AppState.data.myPersonaPresets.forEach(persona => {
                if (persona.bindings && persona.bindings[charId]) {
                    delete persona.bindings[charId];
                }
            });
        }

        Utils.saveData();
        alert(I18n.t('char.deleted_ok', '✓ 角色已删除'));
        Navigation.back('chat');
        ChatList.render();
    },

    // 清空聊天记录（保留角色）
    clearChatHistory(charId) {
        if (!confirm(I18n.t('char.confirm_clear', '确定要清空该角色的所有聊天记录吗？此操作无法恢复。'))) {
            return;
        }

        // 清空对话记录
        if (AppState.data.conversations[charId]) {
            AppState.data.conversations[charId] = [];
        }

        Utils.saveData();
        alert(I18n.t('char.cleared_ok', '✓ 聊天记录已清空'));

        // 如果当前在对话页面，刷新显示
        if (AppState.currentScreen === 'conversation' && AppState.currentCharacter?.id === charId) {
            Conversation.render();
        }
    }
};
