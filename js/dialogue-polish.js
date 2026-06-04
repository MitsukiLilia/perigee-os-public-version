// ===== 二创台词校正模块 / Dialogue Polish =====
const DialoguePolish = {
    _currentCharId: null,
    _lastResult: '',
    _messages: [],   // 保存本次会话 messages，用于换版本

    init() {
        this._populateCharSelect();
        const convertBtn = document.getElementById('dpConvertBtn');
        if (convertBtn) convertBtn.onclick = () => this.convert();
        const varBtn = document.getElementById('dpVariationBtn');
        if (varBtn) varBtn.onclick = () => this._getVariation();
        const copyBtn = document.getElementById('dpCopyBtn');
        if (copyBtn) copyBtn.onclick = () => this._copyResult();

        // 恢复选中的角色
        const sel = document.getElementById('dpCharSelect');
        if (sel && this._currentCharId) sel.value = this._currentCharId;

        // 隐藏结果卡（每次进入屏幕都重置）
        const card = document.getElementById('dpResultCard');
        if (card) card.style.display = 'none';
    },

    _populateCharSelect() {
        const sel = document.getElementById('dpCharSelect');
        if (!sel) return;
        const chars = AppState.data.characters || [];
        const books = AppState.data.worldBooks || [];

        sel.innerHTML = `<option value="">${I18n.t('dp.select_char')}</option>`;
        chars.forEach(c => {
            const book = books.find(b => b.id === c.worldBookId);
            const label = book ? `${c.name}  [${book.name}]` : c.name;
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = label;
            sel.appendChild(opt);
        });
        if (chars.length === 0) {
            sel.innerHTML = `<option value="">${I18n.t('dp.no_chars')}</option>`;
        }

        sel.onchange = () => {
            this._currentCharId = sel.value;
            this._loadRef(sel.value);
        };

        // 初始加载已保存的参考台词
        if (this._currentCharId) this._loadRef(this._currentCharId);
    },

    _loadRef(charId) {
        const refInput = document.getElementById('dpRefInput');
        if (!refInput) return;
        const saved = (AppState.data.dialogueRefs || {})[charId] || '';
        refInput.value = saved;

        // 有内容就自动展开
        if (saved) {
            const area = document.getElementById('dpRefArea');
            const btn = document.getElementById('dpRefToggleBtn');
            if (area) area.style.display = 'block';
            if (btn) btn.textContent = I18n.t('dp.collapse');
        }
    },

    _saveRef(charId, text) {
        if (!charId) return;
        if (!AppState.data.dialogueRefs) AppState.data.dialogueRefs = {};
        AppState.data.dialogueRefs[charId] = text;
        Utils.saveData();
    },

    _buildSystemPrompt(char, worldBook, sourceLang, refLines) {
        const langLabel = sourceLang === 'en' ? 'English' : '中文';

        let wb = '';
        if (worldBook) {
            wb = `\nWorld Book — ${worldBook.name}:\n`;
            (worldBook.entries || []).forEach(e => {
                wb += `【${e.title}】\n${e.content}\n\n`;
            });
        }

        let refSection = '';
        if (refLines && refLines.trim()) {
            refSection = `\n=== CANONICAL DIALOGUE SAMPLES (原作台词参考) ===
The following are actual lines spoken by ${char.name} in the original work.
Use these as the PRIMARY reference for speech pattern, rhythm, vocabulary, and verbal tics:

${refLines.trim()}

`;
        }

        return `You are an expert anime/manga dialogue specialist — your job is to transform fan-fiction dialogue into authentic Japanese lines that perfectly match a specific character's speech pattern.

Character: ${char.name}
Character Description:
${char.personality || '（无描述）'}
${wb}${refSection}=== YOUR TASK ===
The user has written fan-fiction dialogue for this character in ${langLabel}.
Transform it into Japanese dialogue that:
- Perfectly matches this character's speaking style, verbal tics, and personality${refLines?.trim() ? '\n- Pay close attention to the CANONICAL DIALOGUE SAMPLES above — mirror the same sentence rhythm, word choices, and signature expressions' : ''}
- Would feel natural in the original work
- Preserves the emotional core and meaning of the original
- Naturally incorporates the character's signature expressions / catchphrases where fitting
- DO NOT add translation or explanation of the Japanese — the output is for a native/studying reader

=== OUTPUT FORMAT (strictly follow, use these exact headers) ===
【日語台詞】
（The Japanese dialogue — this is the primary output）

【風格說明】
（2-3 sentences in Chinese: which stylistic choices were made, which verbal tics were used and why）

【別バージョン】
（A meaningfully different alternative — different phrasing, intensity or nuance, NOT just minor rewording）`;
    },

    async convert() {
        const sel = document.getElementById('dpCharSelect');
        const langSel = document.getElementById('dpSourceLang');
        const input = document.getElementById('dpInput');
        const refInput = document.getElementById('dpRefInput');

        const charId = sel?.value;
        const sourceLang = langSel?.value || 'zh';
        const text = input?.value?.trim();
        const refLines = refInput?.value?.trim() || '';

        if (!charId) { Utils.showToast(I18n.t('dp.toast_no_char')); return; }
        if (!text) { Utils.showToast(I18n.t('dp.toast_no_input')); return; }

        const char = (AppState.data.characters || []).find(c => c.id === charId);
        if (!char) { Utils.showToast(I18n.t('dp.toast_char_not_found')); return; }

        // 保存原作台词参考（按角色）
        this._saveRef(charId, refLines);

        const worldBook = char.worldBookId
            ? (AppState.data.worldBooks || []).find(b => b.id === char.worldBookId)
            : null;

        const btn = document.getElementById('dpConvertBtn');
        if (btn) { btn.textContent = I18n.t('dp.generating'); btn.disabled = true; }

        try {
            const systemPrompt = this._buildSystemPrompt(char, worldBook, sourceLang, refLines);
            this._messages = [{
                role: 'user',
                content: `请将以下台词转换为符合「${char.name}」说话风格的日语台词：\n\n${text}`
            }];

            const response = await Utils.callChatAPI(this._messages, systemPrompt);
            this._messages.push({ role: 'assistant', content: response });
            this._lastResult = response;
            this._renderResult(response);
        } catch (e) {
            Utils.showToast(I18n.t('t.dp_gen_failed', '生成失败：') + e.message);
            console.error('[DialoguePolish] convert error', e);
        } finally {
            if (btn) { btn.textContent = I18n.t('dp.convert_btn'); btn.disabled = false; }
        }
    },

    async _getVariation() {
        if (!this._messages.length) { Utils.showToast(I18n.t('dp.toast_convert_first')); return; }

        const btn = document.getElementById('dpVariationBtn');
        if (btn) { btn.textContent = I18n.t('dp.generating'); btn.disabled = true; }

        try {
            // 追加请求换版本的消息
            const newMessages = [
                ...this._messages,
                { role: 'user', content: '请给我一个完全不同风格或情感强度的版本，重新生成完整的三段输出格式。' }
            ];
            const sel = document.getElementById('dpCharSelect');
            const langSel = document.getElementById('dpSourceLang');
            const refInput = document.getElementById('dpRefInput');
            const charId = sel?.value;
            const char = (AppState.data.characters || []).find(c => c.id === charId);
            const worldBook = char?.worldBookId
                ? (AppState.data.worldBooks || []).find(b => b.id === char.worldBookId)
                : null;
            const systemPrompt = this._buildSystemPrompt(char, worldBook, langSel?.value || 'zh', refInput?.value?.trim() || '');

            const response = await Utils.callChatAPI(newMessages, systemPrompt);
            this._messages = newMessages;
            this._messages.push({ role: 'assistant', content: response });
            this._lastResult = response;
            this._renderResult(response);
        } catch (e) {
            Utils.showToast(I18n.t('t.dp_gen_failed', '生成失败：') + e.message);
        } finally {
            if (btn) { btn.textContent = I18n.t('dp.variation_btn'); btn.disabled = false; }
        }
    },

    _renderResult(text) {
        const card = document.getElementById('dpResultCard');
        const content = document.getElementById('dpResultContent');
        if (!card || !content) return;

        // 将 【...】 标题渲染为带样式的段落
        const html = text
            .replace(/【([^】]+)】/g, '<span class="dp-section-label">【$1】</span>')
            .replace(/\n/g, '<br>');

        content.innerHTML = html;
        card.style.display = 'block';
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    _copyResult() {
        if (!this._lastResult) return;
        // 只复制【日語台詞】部分
        const match = this._lastResult.match(/【日語台詞】\n?([\s\S]*?)(?=\n【|$)/);
        const toCopy = match ? match[1].trim() : this._lastResult;
        navigator.clipboard.writeText(toCopy).then(() => {
            Utils.showToast(I18n.t('dp.toast_copied'));
        }).catch(() => {
            // 降级方案
            const ta = document.createElement('textarea');
            ta.value = toCopy;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            Utils.showToast(I18n.t('dp.toast_copied'));
        });
    }
};
