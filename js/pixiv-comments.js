// ===================================================================
// Pixiv 小说评论区（v2.207.0）
// 章节级评论：真 pixiv 把连载每一话当独立作品，评论挂在 chapter 上
//（与 v2.190 点赞 ch.isLiked/likeBoost 同级；重写章节时整个 chapter
//  对象被替换 novel.chapters[i] = newChapterData，评论随之自然清零——
//  与点赞重置行为一致，这里不需要任何清理代码）
// 生成完全独立于正文管线：单独的 callChatAPI 调用 + 单独 prompt，
// 触发伪装成「コメントを読み込む」加载动作（按需、一次性、落盘持久）
// ===================================================================

const PixivComments = {
    _replyTarget: null,      // { id, author } 玩家点了某条评论的「返信」（有效性由 _validReplyTarget 按数据校验）
    _expanded: new Set(),    // 展开的「返信を見る」父评论 id（会话级、不落盘）

    // ===== 数据访问 =====
    _getChapter(novelId, chIdx) {
        const novel = (AppState.data.pixivData?.novels || []).find(n => n.id === novelId);
        if (!novel || !novel.chapters || !novel.chapters[chIdx]) return { novel: null, ch: null };
        return { novel, ch: novel.chapters[chIdx] };
    },
    // 并发锁 key（Utils.withLock/isLocked，CLAUDE.md「生成类按钮并发防呆」铁律）
    _genLockKey(novelId, chIdx) { return `pxc:gen:${novelId}:${chIdx}`; },
    _submitLockKey(novelId, chIdx) { return `pxc:submit:${novelId}:${chIdx}`; },

    // ===== 当前评论区上下文：直接读 PixivNovel 的唯一真相源。
    // 不留影子拷贝——渲染方喂状态的旧方案在 early-return 重渲路径会留下过期 ctx，
    // 评论会写错章节（2026-07-15 review 高度角发现，见修复台账）=====
    _currentCtx() {
        if (typeof PixivNovel === 'undefined' || !PixivNovel.currentNovelId) return null;
        return { novelId: PixivNovel.currentNovelId, chIdx: PixivNovel.currentChapterIdx ?? 0 };
    },

    // ===== 「我」的身份：跟推特侧走（pixiv 全模块「me」现有读法、与 _resolveAuthorAvatar 一致）=====
    _myIdentity() {
        const t = AppState.data.twitterData || {};
        return {
            name: t.userName || 'User',
            avatarImage: t.userAvatarImage || null,
            avatarColor: t.userAvatarColor || '#1d9bf0',
            letter: (t.userAvatarLetter || (t.userName || 'M')).charAt(0).toUpperCase()
        };
    },

    // ===== 日期：pixiv 评论格式 YYYY-MM-DD HH:mm（与章节列表 pixiv-novel.js:1031 同款）=====
    _formatDate(ts) {
        const d = ts ? new Date(ts) : null;
        if (!d || isNaN(d)) return '';
        const p = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    },

    // ===== LLM 输出解析：---COMMENT--- 分隔块 + 逐行字段（项目主流、同 fanFriends/_parseReplies 风格）=====
    // 返回 [{ author, content, replyToIdx|null }]；上限 15 条、author 截 40 字、content 截 300 字。
    // CONTENT 允许多行（收集到下一个 FIELD: 行为止），全角/半角冒号都认。
    _parseComments(raw) {
        if (!raw) return [];
        const blocks = String(raw).split(/---\s*COMMENT\s*---/i);
        const out = [];
        for (const block of blocks) {
            if (out.length >= 15) break;
            const fields = {};
            let cur = null;
            for (const line of block.split('\n')) {
                // 只认已知字段名——评论正文里「BGM: 〜」这类行不能被当成字段吃掉
                const m = line.match(/^(AUTHOR|CONTENT|REPLY_TO)[:：]\s*(.*)$/);
                if (m) { cur = m[1]; fields[cur] = m[2]; }
                else if (cur === 'CONTENT' && line.trim()) fields.CONTENT += '\n' + line.trim();
            }
            const author = (fields.AUTHOR || '').trim();
            const content = (fields.CONTENT || '').trim();
            if (!author || !content) continue;
            const replyN = parseInt(fields.REPLY_TO, 10);
            out.push({
                author: author.slice(0, 40),
                content: content.slice(0, 300),
                replyToIdx: Number.isInteger(replyN) && replyN > 0 ? replyN : null
            });
        }
        return out;
    },

    // ===== 解析结果 → 评论对象（形状与 lofter article.commentsList 同构）=====
    // createdAt 在 [max(章节发布, 3天前), 现在] 之间升序铺开（子评论自然晚于父评论）；
    // likes 低值偏斜随机（顶层 0-24、回复 0-5）；作者名撞上同人作家池时挂 npcId（头像色跟随本人）。
    // REPLY_TO 是 1-based、只认「更早的评论」：越界/自引/前向引用一律按顶层处理。
    _assembleComments(parsed, chapter, fanFriends) {
        const now = Date.now();
        const start = Math.max(chapter.createdAt || 0, now - 3 * 24 * 3600 * 1000);
        const span = Math.max(now - start, 60000);
        const list = [];
        parsed.forEach((p, i) => {
            let replyToCommentId = null;
            if (p.replyToIdx && p.replyToIdx <= i) {
                replyToCommentId = list[p.replyToIdx - 1].id;
            }
            const fan = (fanFriends || []).find(f => f.name === p.author) || null;
            list.push({
                id: 'pxc_' + Utils.generateId(),
                npcId: fan ? fan.id : null,
                author: p.author,
                content: p.content,
                createdAt: Math.floor(start + span * ((i + 1) / (parsed.length + 1))),
                likes: replyToCommentId
                    ? Math.floor(Math.random() * 6)
                    : Math.floor(Math.random() * Math.random() * 25),
                replyToCommentId,
                isOpReply: false,
                from: null
            });
        });
        return list;
    },

    // ===== 原始 commentsList → 渲染用列表（含遗留 loading 占位清扫，逻辑同 lofter v2.181）=====
    // 生成中途关 App 会把 _loading 占位落盘；重开后 pending 锁已空 → 孤儿占位在此静默移除
    _buildRenderList(novelId, chIdx, ch) {
        if (Array.isArray(ch.commentsList)
            && ch.commentsList.some(c => c._loading)
            && !Utils.isLocked(this._submitLockKey(novelId, chIdx))) {
            ch.commentsList = ch.commentsList.filter(c => !c._loading);
            Utils.saveData();
        }
        return ch.commentsList || [];
    },

    // ===== 顶层祖先 id（玩家发嵌套回复后自动展开所在线程用）=====
    _topAncestorId(ch, comment) {
        let cur = comment;
        const list = ch.commentsList || [];
        for (let guard = 0; cur && cur.replyToCommentId && guard < 50; guard++) {
            const parent = list.find(c => c.id === cur.replyToCommentId);
            if (!parent) break;
            cur = parent;
        }
        return cur ? cur.id : comment.id;
    },

    // ===== 评论树：顶层新→旧（真 pixiv 序），子孙拍平后旧→新（对话序）=====
    _buildTree(comments) {
        const byId = new Map();
        const tops = [];
        comments.forEach(c => byId.set(c.id, Object.assign({}, c, { children: [] })));
        comments.forEach(c => {
            const node = byId.get(c.id);
            if (c.replyToCommentId && byId.has(c.replyToCommentId)) {
                byId.get(c.replyToCommentId).children.push(node);
            } else {
                tops.push(node);
            }
        });
        tops.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return tops;
    },

    _flattenDescendants(node) {
        const out = [];
        const walk = n => (n.children || []).forEach(c => { out.push(c); walk(c); });
        walk(node);
        out.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        return out;
    },

    // ═══════════════ 渲染层 ═══════════════

    // ===== 评论区 HTML（renderChapterContent 模板末尾拼接、跟随章节重渲整体重建）=====
    buildSectionHtml(novel, chIdx) {
        const ch = novel && novel.chapters && novel.chapters[chIdx];
        if (!ch) return '';
        const _esc = s => Utils.escapeHtml(s || '');
        const me = this._myIdentity();
        const meAvatar = me.avatarImage
            ? `<div class="pixiv-comment-avatar"><img src="${_esc(me.avatarImage)}" alt=""></div>`
            : `<div class="pixiv-comment-avatar" style="background:${_esc(me.avatarColor)}">${_esc(me.letter)}</div>`;
        const comments = this._buildRenderList(novel.id, chIdx, ch);
        const treeHtml = this._buildTree(comments).map(t => this._renderTopComment(t)).join('');
        // 未加载过 → 显示「読み込む」入口（生成在途时显示 loading 态 + 骨架，切走再切回也不丢状态）
        let loadAreaHtml = '';
        if (!ch.commentsLoaded) {
            const loading = Utils.isLocked(this._genLockKey(novel.id, chIdx));
            loadAreaHtml = (loading ? this._skeletonsHtml() : '')
                + `<button class="pixiv-comment-load-btn" id="pixivCommentLoadBtn"${loading ? ' disabled' : ''} onclick="PixivComments.loadComments()">`
                + (loading ? I18n.t('pixiv.comments_loading', '読み込み中…') : I18n.t('pixiv.comments_load_btn', 'コメントを読み込む'))
                + `</button>`;
        }
        return `<div class="pixiv-comments-section" id="pixivCommentsSection">
            <div class="pixiv-comments-title">${I18n.t('pixiv.comments_title', 'コメント')}</div>
            <div class="pixiv-comment-composer">
                ${meAvatar}
                <input type="text" class="pixiv-comment-input" id="pixivCommentInput" maxlength="300"
                    placeholder="${_esc(this._composerPlaceholder(ch))}">
                <button class="pixiv-comment-send" id="pixivCommentSendBtn" onclick="PixivComments.submit()"
                    aria-label="${_esc(I18n.t('pixiv.comment_send_aria', '送信'))}">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
            </div>
            <div class="pixiv-comment-tree" id="pixivCommentTree">${treeHtml}</div>
            ${loadAreaHtml}
        </div>`;
    },

    _skeletonsHtml() {
        return '<div class="pixiv-comment-skeletons">'
            + Array.from({ length: 3 }, () =>
                '<div class="pixiv-comment-skeleton"><div class="pixiv-comment-skeleton-avatar"></div><div class="pixiv-comment-skeleton-lines"><div></div><div></div></div></div>'
            ).join('')
            + '</div>';
    },

    // ===== 回复目标跨局部刷新存活：placeholder 由数据推导；目标已不在本章列表时自动失效 =====
    _composerPlaceholder(ch) {
        const t = this._validReplyTarget(ch);
        return t
            ? I18n.t('pixiv.comment_reply_placeholder', { name: t.author })
            : I18n.t('pixiv.comment_placeholder', 'コメントを追加...');
    },
    _validReplyTarget(ch) {
        if (!this._replyTarget) return null;
        if (!ch || !(ch.commentsList || []).some(c => c.id === this._replyTarget.id)) {
            this._replyTarget = null;   // 切章/目标评论已消失 → 自动退出回复模式
            return null;
        }
        return this._replyTarget;
    },

    // ===== 顶层评论 + 「返信を見る」折叠区（真 pixiv：回复默认收起在灰胶囊后面）=====
    _renderTopComment(node) {
        const replies = this._flattenDescendants(node);
        let extraHtml = '';
        if (replies.length > 0) {
            const expanded = this._expanded.has(node.id);
            const label = expanded
                ? I18n.t('pixiv.comment_hide_replies', '返信を隠す')
                : I18n.t('pixiv.comment_view_replies', '返信を見る');
            extraHtml = `
                <button class="pixiv-comment-view-replies" id="pxcToggle_${node.id}" onclick="PixivComments.toggleReplies('${node.id}')">${label}</button>
                <div class="pixiv-comment-children${expanded ? ' open' : ''}" id="pxcChildren_${node.id}">${replies.map(r => this._renderRow(r)).join('')}</div>`;
        }
        return this._renderRow(node, extraHtml);
    },

    _renderRow(comment, extraHtml = '') {
        const _esc = s => Utils.escapeHtml(s || '');
        const isMine = comment.from === 'me';
        const me = isMine ? this._myIdentity() : null;
        const fan = (!isMine && comment.npcId)
            ? (AppState.data.twitterData?.fanFriends || []).find(f => f.id === comment.npcId)
            : null;
        const name = isMine ? me.name : (comment.author || '');
        let avatarHtml;
        if (isMine && me.avatarImage) {
            avatarHtml = `<div class="pixiv-comment-avatar"><img src="${_esc(me.avatarImage)}" alt=""></div>`;
        } else {
            const bg = isMine ? me.avatarColor : (fan?.avatarColor || PixivNovel._hashColor(name));
            avatarHtml = `<div class="pixiv-comment-avatar" style="background:${_esc(bg)}">${_esc((name || '?')[0].toUpperCase())}</div>`;
        }
        const isLoading = !!comment._loading;
        const footHtml = isLoading ? '' : `
                <div class="pixiv-comment-foot">
                    <span>${this._formatDate(comment.createdAt)}</span>
                    <button class="pixiv-comment-reply-link" onclick="PixivComments.setReplyTarget('${comment.id}')">${I18n.t('pixiv.comment_reply_link', '返信')}</button>
                </div>`;
        return `<div class="pixiv-comment-row${isLoading ? ' pixiv-comment-row-loading' : ''}">
            ${avatarHtml}
            <div class="pixiv-comment-body">
                <div class="pixiv-comment-name">${_esc(name)}</div>
                <div class="pixiv-comment-text">${_esc(comment.content)}</div>
                ${footHtml}
                ${extraHtml}
            </div>
        </div>`;
    },

    // ===== 章节重渲后接线（pixiv-novel.js renderChapterContent 末尾调用）=====
    onSectionRendered(novelId, chIdx) {
        const input = document.getElementById('pixivCommentInput');
        if (input) {
            // !e.isComposing：日文 IME 组字中按 Enter 是确认候选词、不是发送
            input.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); this.submit(); } };
        }
        // NPC 回复还在途（用户切走又切回同一章）→ 恢复输入区禁用态
        if (Utils.isLocked(this._submitLockKey(novelId, chIdx))) this._setComposerPending(novelId, chIdx, true);
    },

    // ===== 局部刷新：只重建评论区、不动正文（滚动位置不丢）=====
    _refreshSection() {
        const ctx = this._currentCtx();
        if (!ctx) return;
        const { novelId, chIdx } = ctx;
        const section = document.getElementById('pixivCommentsSection');
        if (!section) return;   // 阅读器已关/已切页面，静默跳过
        const { novel } = this._getChapter(novelId, chIdx);
        if (!novel) return;
        // 重建前保住输入框草稿/焦点——异步回调落地时用户可能正在打字，不许吹掉
        const oldInput = document.getElementById('pixivCommentInput');
        const draft = oldInput ? oldInput.value : '';
        const hadFocus = !!oldInput && document.activeElement === oldInput;
        section.outerHTML = this.buildSectionHtml(novel, chIdx);
        this.onSectionRendered(novelId, chIdx);
        const newInput = document.getElementById('pixivCommentInput');
        if (newInput && draft) newInput.value = draft;
        if (newInput && hadFocus) newInput.focus();
    },

    // 纯 DOM 切换、不整段重建（保输入草稿/焦点/IME 组字状态）；_expanded 供下次整段重渲还原
    toggleReplies(commentId) {
        const open = !this._expanded.has(commentId);
        if (open) this._expanded.add(commentId);
        else this._expanded.delete(commentId);
        const children = document.getElementById('pxcChildren_' + commentId);
        const btn = document.getElementById('pxcToggle_' + commentId);
        if (children) children.classList.toggle('open', open);
        if (btn) btn.textContent = open
            ? I18n.t('pixiv.comment_hide_replies', '返信を隠す')
            : I18n.t('pixiv.comment_view_replies', '返信を見る');
    },

    // ===== 详情 modal「コメント」行 → 关 modal、滚到评论区 =====
    jumpFromDetail() {
        document.getElementById('pixivDetailModal')?.classList.remove('active');
        const el = document.getElementById('pixivCommentsSection');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // melon 无章节小说：评论区未渲染——给反馈而不是静默死按钮（旧占位 toast 的行为契约）
        else Utils.showToast(I18n.t('pixiv.no_chapters_yet', 'まだ章がありません。最初の章を生成しましょう。'));
    },

    // ===== 输入区禁用态（keyed：异步回调回来时用户可能已切章，不能误开/误关别章的输入区）=====
    _setComposerPending(novelId, chIdx, pending) {
        const ctx = this._currentCtx();
        if (!ctx || ctx.novelId !== novelId || ctx.chIdx !== chIdx) return;
        const input = document.getElementById('pixivCommentInput');
        const btn = document.getElementById('pixivCommentSendBtn');
        if (input) input.disabled = pending;
        if (btn) btn.disabled = pending;
    },

    // ═══════════════ 生成层（完全独立于正文管线——作者铁律）═══════════════

    // ===== system prompt：世界观（含 v2.205 生贺自动继承）+ 防剧透 + 官方NPC禁令 + 输出格式 =====
    _buildGenSystemPrompt(novel) {
        const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext)
            ? Forum.getWorldContext()
            : (AppState.data.broadcast?.worldSetting || '');
        // 同人作家池的名字可以偶尔出现在评论里（世界的连续感）；作者本人不算——作者只在回复里出现
        const doujinNames = (AppState.data.twitterData?.fanFriends || [])
            .filter(f => f.type === 'doujin_writer' && f.name && f.name !== novel.author)
            .slice(0, 5).map(f => f.name);
        return `あなたはpixivの小説コメント欄シミュレーションエンジンです。
日本の同人小説読者たちのリアルなコメント欄を生成してください。
${worldContext ? `\n【作品世界の文脈】\n${worldContext}\n` : ''}
${Utils.PROMPTS.infoAccessRule()}
【コメント欄のルール（最重要）】
- コメントするのは一般の読者・同人ファンのみ。公式関係者・公式NPC・声優・スタッフはpixivのコメント欄には一切登場しない（ここはファンの空間）
- 1件は短め（5〜60字が中心、最長でも3行）。悲鳴・感想・尊さの叫び・軽い考察・次話待ち・作者への感謝など、テンションも長さもばらけさせる
- 口調・言い回し・絵文字の癖を1件ごとに変えること。今のpixivコメント欄の空気で自然に——特定のスラングを機械的に繰り返さない
- 本文の展開に触れるのはOK。ただし未公開設定の暗示は禁止（上の情報アクセス制限に従う）
${doujinNames.length ? `- 以下の既存の同人書き手が最大2件までコメントに現れてもよい（それ以外は新しい読者のハンドルネームを作る）: ${doujinNames.join('、')}` : ''}

【出力形式（厳守・各コメントをこの区切りで始める）】
---COMMENT---
AUTHOR: 読者のハンドルネーム
CONTENT: コメント本文
REPLY_TO: 2   ←任意。このコメントが上からN番目のコメントへの返信である場合のみ付ける

合計8〜12件。うち0〜3件はREPLY_TO付きの返信にすること。出力は日本語のみ。`;
    },

    _buildGenUserMsg(novel, ch, chIdx) {
        const plain = (typeof PixivNovel !== 'undefined' && PixivNovel._chapterPlainText)
            ? PixivNovel._chapterPlainText(ch.content)
            : String(ch.content || '').replace(/<[^>]*>/g, '');
        const tags = (novel.tags || []).join('、');
        return `【作品情報】
シリーズ「${novel.title}」 第${chIdx + 1}話「${ch.title || ''}」 作者: ${novel.author || '匿名'}
タグ: ${tags || 'なし'}
♡ ${ch.hearts || 0}
${ch.synopsis ? `あらすじ: ${ch.synopsis}` : ''}

【この話の本文】
${plain.slice(0, 6000)}

上記の話のコメント欄を生成してください。`;
    },

    // ===== 「コメントを読み込む」：伪装成加载动作的按需生成（一次性、落盘持久）=====
    async loadComments() {
        const ctx = this._currentCtx();
        if (!ctx) return;
        const { novelId, chIdx } = ctx;
        // withLock：同 key 在途直接跳过（防连点），finally 自动放锁（CLAUDE.md 生成类按钮铁律）
        await Utils.withLock(this._genLockKey(novelId, chIdx), async () => {
            const { novel, ch } = this._getChapter(novelId, chIdx);
            if (!novel || !ch || ch.commentsLoaded) return;
            this._refreshSection();   // 按钮转 loading 态 + 骨架屏（buildSectionHtml 按 isLocked 渲染）
            try {
                const _overrideCfg = AppState.data.pixivData?.settings?.apiOverride;
                const raw = await Utils.callChatAPI(
                    [{ role: 'user', content: this._buildGenUserMsg(novel, ch, chIdx) }],
                    this._buildGenSystemPrompt(novel),
                    _overrideCfg?.enabled ? _overrideCfg : null,
                    { temperature: 1.0 }
                );
                const parsed = this._parseComments(raw);
                if (parsed.length === 0) throw new Error('no comments parsed');
                // 生成期间章节可能被重写（chapter 对象整个被换掉）→ 重新取、写到新对象上
                const fresh = this._getChapter(novelId, chIdx);
                if (!fresh.ch) return;
                const fanFriends = AppState.data.twitterData?.fanFriends || [];
                fresh.ch.commentsList = (fresh.ch.commentsList || [])
                    .concat(this._assembleComments(parsed, fresh.ch, fanFriends));
                fresh.ch.commentsLoaded = true;
                Utils.saveData();
            } catch (e) {
                console.warn('[PixivComments] load failed:', e);
                Utils.showToast(I18n.t('pixiv.comments_load_failed', 'コメントの読み込みに失敗しました'));
            }
        });
        this._refreshSection();   // 放锁后重建：loading 态退场 / 新评论落位
    },

    // ═══════════════ 玩家评论 + NPC 异步回复（模式同 lofter v2.181）═══════════════

    // ===== 点某条评论的「返信」：设定回复目标、placeholder 提示；再点同一条 = 取消 =====
    setReplyTarget(commentId) {
        const ctx = this._currentCtx();
        if (!ctx) return;
        const { ch } = this._getChapter(ctx.novelId, ctx.chIdx);
        const target = ch && (ch.commentsList || []).find(c => c.id === commentId);
        if (!target) return;
        const input = document.getElementById('pixivCommentInput');
        if (this._replyTarget && this._replyTarget.id === commentId) {
            this._replyTarget = null;
            if (input) input.placeholder = I18n.t('pixiv.comment_placeholder', 'コメントを追加...');
            return;
        }
        const name = target.from === 'me' ? this._myIdentity().name : (target.author || '');
        this._replyTarget = { id: target.id, author: name };
        if (input) {
            input.placeholder = I18n.t('pixiv.comment_reply_placeholder', { name });
            input.focus();
        }
    },

    // ===== 玩家提交评论：同步 push + 落盘 + 局部刷新，然后异步触发一条 NPC 回复。
    // withLock 按 novelId:chIdx 隔离（全程含等待回复都算在锁内，同 lofter 惯例·防连点双发）=====
    async submit() {
        const ctx = this._currentCtx();
        if (!ctx) return;
        const { novelId, chIdx } = ctx;
        await Utils.withLock(this._submitLockKey(novelId, chIdx), async () => {
            const { novel, ch } = this._getChapter(novelId, chIdx);
            if (!novel || !ch) return;
            const input = document.getElementById('pixivCommentInput');
            const text = (input && input.value || '').trim();
            if (!text) return;
            const replyTarget = this._validReplyTarget(ch);
            this._setComposerPending(novelId, chIdx, true);
            try {
                const myComment = {
                    id: 'pxc_' + Utils.generateId(),
                    npcId: null,
                    author: this._myIdentity().name,
                    content: text.slice(0, 300),
                    createdAt: Date.now(),
                    likes: 0,
                    replyToCommentId: replyTarget ? replyTarget.id : null,
                    isOpReply: false,
                    from: 'me'
                };
                ch.commentsList = ch.commentsList || [];
                ch.commentsList.push(myComment);
                if (replyTarget) this._expanded.add(this._topAncestorId(ch, myComment));
                this._replyTarget = null;
                if (input) input.value = '';
                Utils.saveData();
                this._refreshSection();
                await this._triggerNpcReply(novelId, chIdx, myComment);
            } finally {
                this._setComposerPending(novelId, chIdx, false);
            }
        });
    },

    // ===== 一条轻量异步回复：loading 占位 → 单次 LLM → 成功替换/失败静默移除。
    // 回复者：回的是 NPC 的评论 → 那位评论者本人；否则 → 作品作者。
    // 作者就是玩家自己（isUserCreated）或无作者名时不回——不能替玩家发言。=====
    async _triggerNpcReply(novelId, chIdx, myComment) {
        const { novel, ch } = this._getChapter(novelId, chIdx);
        if (!novel || !ch) return;
        const target = myComment.replyToCommentId
            ? (ch.commentsList || []).find(c => c.id === myComment.replyToCommentId)
            : null;
        let responder;   // { name, npcId, isAuthor }
        if (target && target.from !== 'me' && target.author) {
            responder = { name: target.author, npcId: target.npcId || null, isAuthor: false };
        } else if (!novel.isUserCreated && novel.author) {
            responder = { name: novel.author, npcId: novel.author_npc_id || null, isAuthor: true };
        } else {
            return;
        }
        const loadingReply = {
            id: 'pxc_' + Utils.generateId(),
            npcId: responder.npcId,
            author: responder.name,
            content: '……',
            createdAt: Date.now(),
            likes: 0,
            replyToCommentId: myComment.id,
            isOpReply: responder.isAuthor,
            _loading: true
        };
        ch.commentsList.push(loadingReply);
        this._expanded.add(this._topAncestorId(ch, loadingReply));
        Utils.saveData();
        this._refreshSection();

        const replyText = await this._generateReply(novel, ch, chIdx, responder, myComment.content).catch(() => null);

        // 生成期间数据可能已变化（章节被重写=chapter 对象整个换掉）→ 重新取
        const fresh = this._getChapter(novelId, chIdx);
        if (!fresh.ch || !Array.isArray(fresh.ch.commentsList)) return;
        const idx = fresh.ch.commentsList.indexOf(loadingReply);
        if (idx === -1) return;   // 占位已不在（数据已变化），静默放弃
        if (replyText) {
            fresh.ch.commentsList[idx] = {
                id: loadingReply.id,
                npcId: loadingReply.npcId,
                author: loadingReply.author,
                content: String(replyText).trim().slice(0, 300),
                createdAt: Date.now(),
                likes: 0,
                replyToCommentId: loadingReply.replyToCommentId,
                isOpReply: loadingReply.isOpReply,
                from: null
            };
        } else {
            fresh.ch.commentsList.splice(idx, 1);
        }
        Utils.saveData();
        this._refreshSection();
    },

    // ===== 回复 prompt：短小、不塞梗词清单（给方向不给词——lofter 先例）=====
    _generateReply(novel, ch, chIdx, responder, playerText) {
        const fan = responder.npcId
            ? (AppState.data.twitterData?.fanFriends || []).find(f => f.id === responder.npcId)
            : null;
        const whoDesc = responder.isAuthor
            ? `あなたはpixivで同人小説を投稿している書き手「${responder.name}」です。${fan?.bio ? `プロフィール: ${fan.bio}。` : ''}これはあなたの作品「${novel.title}」第${chIdx + 1}話「${ch.title || ''}」のコメント欄です。`
            : `あなたはpixivの読者「${responder.name}」です。${fan?.bio ? `プロフィール: ${fan.bio}。` : ''}「${novel.title}」第${chIdx + 1}話のコメント欄で、あなたのコメントに返信が付きました。`;
        const prompt = `${whoDesc}
相手のコメント:「${(playerText || '').slice(0, 200)}」
pixivのコメント欄らしい自然な日本語で、5〜60字の返信を1件だけ書いてください。
${responder.isAuthor ? '同人書き手が読者のコメントに返信する、親しみのある口調で。' : '読者同士の気軽な口調で。'}
【鉄則】出力は日本語のみ。返信本文だけを出力（引用符・名前・プレフィックス不要）。`;
        const _overrideCfg = AppState.data.pixivData?.settings?.apiOverride;
        return Utils.callChatAPI(
            [{ role: 'user', content: prompt }],
            null,
            _overrideCfg?.enabled ? _overrideCfg : null,
            { temperature: 1.0, maxTokens: 1000 }
        );
    }
};
