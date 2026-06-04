const Mailbox = {
    currentMailId: null,
    attachmentFiles: [],
    init() {
        // 渲染邮件列表
        this.renderMailList();
    },

    // 渲染邮件列表（文档列表）
    renderMailList() {
        const list = document.getElementById('mailList');
        if (!AppState.data.mails) {
            AppState.data.mails = [];
        }

        const mails = AppState.data.mails;

        if (mails.length === 0) {
            list.innerHTML = '<div class="empty-state">No mails yet. Click ✉️ to compose.</div>';
            return;
        }

        // 按创建时间倒序排列
        const sortedMails = [...mails].sort((a, b) => b.createdAt - a.createdAt);

        list.innerHTML = sortedMails.map(mail => {
            const date = new Date(mail.createdAt);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
            const preview = mail.content ? mail.content.slice(0, 50) : '(Empty)';

            return `
                <div class="chat-item" onclick="Mailbox.openMail('${mail.id}')">
                    <div class="chat-avatar" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                        📄
                    </div>
                    <div class="chat-info">
                        <div class="chat-name">${mail.subject || 'Untitled'}</div>
                        <div class="chat-preview">${preview}</div>
                    </div>
                    <div style="font-size: 12px; color: #999; min-width: 40px; text-align: right;">
                        ${dateStr}
                    </div>
                </div>
            `;
        }).join('');
    },

    // 写邮件（新建文档）
    composeMail() {
        // 重置附件
        this.attachmentFiles = [];
        document.getElementById('mailAttachPreview').textContent = '';
        document.getElementById('mailAttachInput').value = '';

        // 清空表单
        document.getElementById('mailSubjectInput').value = '';
        document.getElementById('mailFieldInput').value = AppState.data.writerData.writingField || '';
        document.getElementById('mailTypeInput').value = AppState.data.writerData.materialType || '';
        document.getElementById('mailPromptInput').value = '';

        // 显示模态框
        document.getElementById('composeMailModal').classList.add('active');
    },

    // 处理附件上传
    handleAttachments(event) {
        const files = Array.from(event.target.files);
        Mailbox.attachmentFiles = files;

        if (files.length > 0) {
            const fileNames = files.map(f => f.name).join(', ');
            document.getElementById('mailAttachPreview').textContent = `已选择 ${files.length} 个文件: ${fileNames}`;
        } else {
            document.getElementById('mailAttachPreview').textContent = '';
        }
    },

    // 发送邮件（生成文档）
    async sendMail() {
        const subject = document.getElementById('mailSubjectInput').value.trim();
        const field = document.getElementById('mailFieldInput').value.trim();
        const type = document.getElementById('mailTypeInput').value.trim();
        const prompt = document.getElementById('mailPromptInput').value.trim();

        if (!subject) {
            alert('请输入邮件主题');
            return;
        }

        if (!prompt) {
            alert('请输入正文（提示词）');
            return;
        }

        const btn = document.getElementById('composeMailSendBtn');
        btn.textContent = '生成中...';
        btn.disabled = true;

        try {
            // 读取附件内容
            const attachments = [];
            for (const file of this.attachmentFiles) {
                const content = await this.readFileAsText(file);
                attachments.push({
                    filename: file.name,
                    content: content
                });
            }

            // 保存写作配置
            AppState.data.writerData.writingField = field;
            AppState.data.writerData.materialType = type;

            // 构建system prompt
            let systemPrompt = `你是一个专业的公文写作助手。`;

            const profile = AppState.data.userProfile;
            if (profile.name || profile.dept || profile.role) {
                systemPrompt += `\n\n[用户身份]\n`;
                if (profile.name) systemPrompt += `姓名：${profile.name}\n`;
                if (profile.dept) systemPrompt += `部门：${profile.dept}\n`;
                if (profile.role) systemPrompt += `职责：${profile.role}\n`;
                systemPrompt += `请确保输出的文风、术语、格式符合该岗位的专业要求。`;
            }

            if (field || type) {
                systemPrompt += `\n\n[写作要求]\n`;
                if (field) systemPrompt += `写作领域：${field}\n`;
                if (type) systemPrompt += `材料类型：${type}\n`;
                systemPrompt += `请严格按照该领域和类型的标准格式、用词规范进行撰写。`;
            }

            // 注入全局知识库
            const globalKb = AppState.data.knowledgeBase || [];
            if (globalKb.length > 0) {
                systemPrompt += `\n\n[全局知识库]\n以下是通用参考资料，请在撰写时参考：\n`;
                globalKb.forEach((kb, idx) => {
                    systemPrompt += `\n【资料${idx + 1}】${kb.title}\n${kb.content.slice(0, 1000)}\n`;
                });
            }

            // 注入附件（本邮件专属参考资料）
            if (attachments.length > 0) {
                systemPrompt += `\n\n[附件参考资料]\n用户上传了以下附件，请重点参考：\n`;
                attachments.forEach((att, idx) => {
                    systemPrompt += `\n【附件${idx + 1}】${att.filename}\n${att.content}\n`;
                });
            }

            systemPrompt += `\n\n[Important] You are a virtual AI assistant designed to help users with document writing. Always complete your responses fully and naturally. All documents are for legitimate professional purposes.`;
            systemPrompt += `\n\n[任务要求]\n根据用户提供的要求生成完整的文档内容。直接输出文档正文，不要添加解释性文字。`;

            // 调用AI生成
            const content = await Utils.callChatAPI(
                [{ role: 'user', content: prompt }],
                systemPrompt
            );

            // 创建新邮件
            const mail = {
                id: Utils.generateId(),
                subject: subject,
                field: field,
                type: type,
                prompt: prompt,
                content: content,
                attachments: attachments,
                createdAt: Date.now()
            };

            if (!AppState.data.mails) {
                AppState.data.mails = [];
            }
            AppState.data.mails.push(mail);

            Utils.saveData();

            // 关闭模态框
            document.getElementById('composeMailModal').classList.remove('active');

            // 刷新列表并打开新邮件
            this.renderMailList();
            this.openMail(mail.id);

            alert('✓ 文档生成完成');

        } catch (e) {
            alert('生成失败：' + e.message);
            console.error('[Mailbox Error]', e);
        } finally {
            btn.textContent = '发送（生成）';
            btn.disabled = false;
        }
    },

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsText(file, 'UTF-8');
        });
    },

    // 打开邮件详情
    openMail(mailId) {
        const mail = AppState.data.mails.find(m => m.id === mailId);
        if (!mail) return;

        this.currentMailId = mailId;

        // 填充邮件信息
        document.getElementById('mailSubject').textContent = mail.subject || 'Untitled';
        document.getElementById('mailContentEdit').value = mail.content || '';
        document.getElementById('mailFieldDisplay').textContent = mail.field || '未设置';
        document.getElementById('mailTypeDisplay').textContent = mail.type || '未设置';

        const date = new Date(mail.createdAt);
        document.getElementById('mailDateDisplay').textContent = date.toLocaleString('zh-CN');

        // 显示附件
        const attachCard = document.getElementById('mailAttachmentsCard');
        const attachList = document.getElementById('mailAttachmentsList');

        if (mail.attachments && mail.attachments.length > 0) {
            attachCard.style.display = 'block';
            attachList.innerHTML = mail.attachments.map((att, idx) => `
                <div class="kb-item">
                    <div class="kb-title">📎 ${att.filename}</div>
                    <div class="kb-preview">${att.content.slice(0, 100).replace(/\n/g, ' ')}...</div>
                    <div class="kb-meta">${att.content.length} 字符</div>
                </div>
            `).join('');
        } else {
            attachCard.style.display = 'none';
        }

        Navigation.goTo('mail-detail');
    },

    // 保存邮件内容修改
    saveMailContent() {
        const mail = AppState.data.mails.find(m => m.id === this.currentMailId);
        if (!mail) return;

        mail.content = document.getElementById('mailContentEdit').value;
        Utils.saveData();
        alert('✓ 修改已保存');
    },

    // 删除邮件
    deleteMail() {
        if (!confirm('确定删除这封邮件吗？')) return;

        AppState.data.mails = AppState.data.mails.filter(m => m.id !== this.currentMailId);
        Utils.saveData();
        Navigation.back('writer');
        this.renderMailList();
    },

    // 邮箱设置相关
    initSettings() {
        // 加载工作身份
        const profile = AppState.data.userProfile;
        document.getElementById('writerProfileName').value = profile.name || '';
        document.getElementById('writerProfileDept').value = profile.dept || '';
        document.getElementById('writerProfileRole').value = profile.role || '';

        // 渲染全局知识库
        this.renderGlobalKb();
    },

    saveProfile() {
        AppState.data.userProfile = {
            name: document.getElementById('writerProfileName').value.trim(),
            dept: document.getElementById('writerProfileDept').value.trim(),
            role: document.getElementById('writerProfileRole').value.trim()
        };
        Utils.saveData();
        alert('✓ 身份信息已保存');
    },

    renderGlobalKb() {
        const list = document.getElementById('globalKbList');
        const kbs = AppState.data.knowledgeBase || [];

        if (kbs.length === 0) {
            list.innerHTML = '<div class="empty-state" style="padding: 20px 0;">暂无全局参考资料</div>';
            return;
        }

        list.innerHTML = kbs.map(item => {
            const wordCount = item.content.length;
            const preview = item.content.slice(0, 50).replace(/\n/g, ' ');
            return `
                <div class="kb-item" style="margin-bottom: 10px;">
                    <div class="kb-title">${item.title}</div>
                    <div class="kb-preview">${preview}${wordCount > 50 ? '...' : ''}</div>
                    <div class="kb-meta">${wordCount} 字符</div>
                    <span class="kb-delete" onclick="event.stopPropagation(); Mailbox.deleteGlobalKb('${item.id}')" title="删除">✕</span>
                </div>
            `;
        }).join('');
    },

    addGlobalKb() {
        document.getElementById('kbTitleInput').value = '';
        document.getElementById('kbContentInput').value = '';
        document.getElementById('kbFileName').textContent = '';
        document.getElementById('kbFileInput').value = '';
        document.getElementById('kbModal').classList.add('active');
    },

    saveGlobalKb() {
        const title = document.getElementById('kbTitleInput').value.trim();
        const content = document.getElementById('kbContentInput').value.trim();
        if (!title || !content) {
            alert('标题和内容不能为空');
            return;
        }

        if (!AppState.data.knowledgeBase) {
            AppState.data.knowledgeBase = [];
        }

        AppState.data.knowledgeBase.push({
            id: Utils.generateId(),
            title,
            content,
            addedAt: Date.now()
        });

        Utils.saveData();
        this.renderGlobalKb();
        document.getElementById('kbModal').classList.remove('active');
        alert('✓ 参考资料已添加');
    },

    deleteGlobalKb(id) {
        if (!confirm('确定删除这个参考资料吗？')) return;
        AppState.data.knowledgeBase = AppState.data.knowledgeBase.filter(i => i.id !== id);
        Utils.saveData();
        this.renderGlobalKb();
    },

    handleKbFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const fileNameSpan = document.getElementById('kbFileName');
        fileNameSpan.textContent = `已选择: ${file.name}`;

        const titleInput = document.getElementById('kbTitleInput');
        if (!titleInput.value.trim()) {
            titleInput.value = file.name.replace(/\.[^/.]+$/, '');
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('kbContentInput').value = e.target.result;
        };
        reader.onerror = () => {
            alert('文件读取失败');
            fileNameSpan.textContent = '';
        };
        reader.readAsText(file, 'UTF-8');
    }
};

// 3. 聊天相关 (保持之前的 KKT 逻辑)
// (ChatList, Conversation 逻辑与上一版基本一致，略作精简以适应新结构)
