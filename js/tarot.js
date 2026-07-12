// タロット占い機能モジュール
const Tarot = {
    // === 78枚タロットカードデータ ===
    MAJOR_ARCANA: [
        { id: 0, name: '愚者', nameJa: 'The Fool', emoji: '🃏', upright: '自由・冒険・無限の可能性', reversed: '無計画・軽率・現実逃避' },
        { id: 1, name: '魔術師', nameJa: 'The Magician', emoji: '🎩', upright: '創造力・才能・新たな始まり', reversed: '未熟・ごまかし・空回り' },
        { id: 2, name: '女教皇', nameJa: 'The High Priestess', emoji: '🌙', upright: '直感・神秘・内なる声', reversed: '秘密・閉鎖的・無関心' },
        { id: 3, name: '女帝', nameJa: 'The Empress', emoji: '👑', upright: '豊穣・母性・愛情', reversed: '過保護・虚栄・停滞' },
        { id: 4, name: '皇帝', nameJa: 'The Emperor', emoji: '🏛️', upright: '権威・安定・リーダーシップ', reversed: '支配的・頑固・暴走' },
        { id: 5, name: '教皇', nameJa: 'The Hierophant', emoji: '📿', upright: '伝統・教え・精神的導き', reversed: '形式主義・束縛・反抗' },
        { id: 6, name: '恋人', nameJa: 'The Lovers', emoji: '💕', upright: '愛・選択・調和', reversed: '迷い・不調和・誘惑' },
        { id: 7, name: '戦車', nameJa: 'The Chariot', emoji: '⚔️', upright: '勝利・前進・意志の力', reversed: '暴走・挫折・方向の喪失' },
        { id: 8, name: '力', nameJa: 'Strength', emoji: '🦁', upright: '内なる強さ・忍耐・勇気', reversed: '弱気・自信喪失・衝動' },
        { id: 9, name: '隠者', nameJa: 'The Hermit', emoji: '🏔️', upright: '内省・探求・知恵', reversed: '孤立・引きこもり・偏屈' },
        { id: 10, name: '運命の輪', nameJa: 'Wheel of Fortune', emoji: '🎡', upright: '転機・運命・チャンス', reversed: '不運・停滞・悪循環' },
        { id: 11, name: '正義', nameJa: 'Justice', emoji: '⚖️', upright: '公正・バランス・真実', reversed: '不公平・偏見・責任逃れ' },
        { id: 12, name: '吊るされた男', nameJa: 'The Hanged Man', emoji: '🔄', upright: '試練・犠牲・新しい視点', reversed: '無駄な犠牲・執着・停滞' },
        { id: 13, name: '死神', nameJa: 'Death', emoji: '🦋', upright: '変容・終わりと始まり・再生', reversed: '変化への抵抗・停滞・恐れ' },
        { id: 14, name: '節制', nameJa: 'Temperance', emoji: '🌊', upright: '調和・バランス・癒し', reversed: '不均衡・過剰・焦り' },
        { id: 15, name: '悪魔', nameJa: 'The Devil', emoji: '🔗', upright: '束縛・誘惑・物質主義', reversed: '解放・目覚め・脱却' },
        { id: 16, name: '塔', nameJa: 'The Tower', emoji: '⚡', upright: '崩壊・衝撃・気づき', reversed: '変化への恐れ・回避・小さな挫折' },
        { id: 17, name: '星', nameJa: 'The Star', emoji: '⭐', upright: '希望・インスピレーション・癒し', reversed: '絶望・自信喪失・見失う' },
        { id: 18, name: '月', nameJa: 'The Moon', emoji: '🌕', upright: '幻想・不安・潜在意識', reversed: '混乱の解消・真実・明晰' },
        { id: 19, name: '太陽', nameJa: 'The Sun', emoji: '☀️', upright: '成功・喜び・活力', reversed: '延期・自信過剰・不完全' },
        { id: 20, name: '審判', nameJa: 'Judgement', emoji: '📯', upright: '復活・覚醒・最終判断', reversed: '後悔・自己否定・決断できない' },
        { id: 21, name: '世界', nameJa: 'The World', emoji: '🌍', upright: '完成・達成・統合', reversed: '未完成・遅延・中途半端' }
    ],

    MINOR_SUITS: [
        { suit: 'wands', name: '杖', nameJa: 'Wands', emoji: '🪄', element: '火' },
        { suit: 'cups', name: '杯', nameJa: 'Cups', emoji: '🏆', element: '水' },
        { suit: 'swords', name: '剣', nameJa: 'Swords', emoji: '🗡️', element: '風' },
        { suit: 'pentacles', name: '金貨', nameJa: 'Pentacles', emoji: '🪙', element: '地' }
    ],

    MINOR_RANKS: [
        { rank: 1, name: 'エース', upright: '新しい始まり', reversed: '機会の逃し' },
        { rank: 2, name: '2', upright: '選択・バランス', reversed: '迷い・不均衡' },
        { rank: 3, name: '3', upright: '成長・発展', reversed: '停滞・孤立' },
        { rank: 4, name: '4', upright: '安定・基盤', reversed: '停滞・退屈' },
        { rank: 5, name: '5', upright: '試練・葛藤', reversed: '回復・和解' },
        { rank: 6, name: '6', upright: '調和・交流', reversed: '不調和・執着' },
        { rank: 7, name: '7', upright: '信念・挑戦', reversed: '不安・妥協' },
        { rank: 8, name: '8', upright: '行動・変化', reversed: '焦り・遅延' },
        { rank: 9, name: '9', upright: '達成・内省', reversed: '不安・孤独' },
        { rank: 10, name: '10', upright: '完成・結実', reversed: '崩壊・過負荷' },
        { rank: 11, name: '従者', upright: '学び・好奇心', reversed: '未熟・浅はか' },
        { rank: 12, name: '騎士', upright: '行動・情熱', reversed: '暴走・短気' },
        { rank: 13, name: '女王', upright: '成熟・育成', reversed: '依存・嫉妬' },
        { rank: 14, name: '王', upright: '支配・達人', reversed: '横暴・冷酷' }
    ],

    SPREADS: [
        { id: 'daily', name: '一日一占', nameJa: '今日の一枚', count: 1, emoji: '🔮',
          positions: ['今日のメッセージ'],
          description: '今日一天的指引' },
        { id: 'timeline', name: '时间之流', nameJa: '過去・現在・未来', count: 3, emoji: '🌊',
          positions: ['過去', '現在', '未来'],
          description: '过去、现在与未来的脉络' },
        { id: 'choice', name: '二择之路', nameJa: '二者択一', count: 2, emoji: '🔀',
          positions: ['選択肢A', '選択肢B'],
          description: '两个选择，哪个更适合你' },
        { id: 'celtic', name: '凯尔特十字', nameJa: 'ケルト十字', count: 10, emoji: '✝️',
          positions: ['現状', '障害', '目標', '基盤', '過去', '未来', '自分自身', '環境', '希望と恐れ', '最終結果'],
          description: '最经典的深度解析牌阵' }
    ],

    // === 状态 ===
    currentSpread: null,
    currentQuestion: '',
    drawnCards: [],
    revealedCount: 0,
    isGenerating: false,

    // === 获取全部78张牌 ===
    getAllCards() {
        const cards = [];
        // 大阿尔卡纳
        this.MAJOR_ARCANA.forEach(card => {
            cards.push({ ...card, type: 'major', fullName: card.name });
        });
        // 小阿尔卡纳
        this.MINOR_SUITS.forEach(suit => {
            this.MINOR_RANKS.forEach(rank => {
                cards.push({
                    id: `${suit.suit}_${rank.rank}`,
                    type: 'minor',
                    suit: suit.suit,
                    suitName: suit.name,
                    suitEmoji: suit.emoji,
                    rank: rank.rank,
                    rankName: rank.name,
                    fullName: `${suit.name}の${rank.name}`,
                    emoji: suit.emoji,
                    upright: `${rank.upright}（${suit.element}の力）`,
                    reversed: `${rank.reversed}（${suit.element}の力）`
                });
            });
        });
        return cards;
    },

    // === 抽牌 ===
    drawCards(count) {
        const allCards = this.getAllCards();
        const drawn = [];
        const used = new Set();
        while (drawn.length < count) {
            const idx = Math.floor(Math.random() * allCards.length);
            if (used.has(idx)) continue;
            used.add(idx);
            const card = { ...allCards[idx] };
            card.isReversed = Math.random() < 0.35; // 35%概率逆位
            drawn.push(card);
        }
        return drawn;
    },

    // === 初始化 ===
    init() {
        if (!AppState.data.tarotData) {
            AppState.data.tarotData = {
                history: [] // [{id, question, spread, cards, interpretation, timestamp}]
            };
        }
        this.renderMain();
    },

    // === 主界面渲染 ===
    renderMain() {
        const container = document.getElementById('tarotMainContent');
        if (!container) return;

        const history = AppState.data.tarotData?.history || [];

        // 牌阵选择
        let html = `
            <div class="settings-card">
                <div class="card-header">✨ 开始占卜</div>
                <div style="padding: 12px;">
                    <input type="text" id="tarotQuestion" placeholder="在心中默念你的问题……"
                        style="width: 100%; margin-bottom: 16px; font-size: 15px;">
                    <div class="card-header" style="margin-bottom: 8px; font-size: 13px;">选择牌阵</div>
                    <div class="tarot-spread-grid">
                        ${this.SPREADS.map(s => `
                            <div class="tarot-spread-card" onclick="Tarot.startReading('${s.id}')">
                                <div class="spread-emoji">${s.emoji}</div>
                                <div class="spread-name">${s.name}</div>
                                <div class="spread-count">${s.count} 张牌</div>
                                <div class="spread-desc">${s.description}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // 占卜历史
        if (history.length > 0) {
            html += `
                <div class="settings-card">
                    <div class="card-header">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>占卜记录</span>
                            <button class="glass-btn small" style="margin:0; font-size:12px;"
                                onclick="Tarot.clearHistory()">清空</button>
                        </div>
                    </div>
                    <div style="padding: 10px;">
                        ${history.slice().reverse().slice(0, 20).map(h => `
                            <div class="tarot-history-item" onclick="Tarot.viewReading('${h.id}')">
                                <div class="tarot-history-cards">${h.cards.map(c =>
                                    `<span class="${c.isReversed ? 'reversed-mini' : ''}">${c.emoji}</span>`
                                ).join('')}</div>
                                <div class="tarot-history-info">
                                    <div class="tarot-history-q">${this._escapeHtml(h.question || '无题')}</div>
                                    <div class="tarot-history-meta">
                                        ${this.SPREADS.find(s => s.id === h.spread)?.name || h.spread}
                                        · ${this._formatTime(h.timestamp)}
                                    </div>
                                </div>
                                <div style="color: var(--text-tertiary); font-size: 18px;">›</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    },

    // === 开始占卜 ===
    startReading(spreadId) {
        const spread = this.SPREADS.find(s => s.id === spreadId);
        if (!spread) return;

        const questionInput = document.getElementById('tarotQuestion');
        this.currentQuestion = questionInput?.value?.trim() || '';
        this.currentSpread = spread;
        this.drawnCards = this.drawCards(spread.count);
        this.revealedCount = 0;

        Navigation.goTo('tarot-reading');
    },

    // === 抽牌界面渲染 ===
    renderReading() {
        const title = document.getElementById('tarotReadingTitle');
        const container = document.getElementById('tarotReadingContent');
        if (!title || !container) return;

        title.textContent = this.currentSpread.name;

        let html = '';

        // 问题显示
        if (this.currentQuestion) {
            html += `<div class="tarot-question-display">「${this._escapeHtml(this.currentQuestion)}」</div>`;
        }

        // 牌阵布局
        if (this.currentSpread.id === 'celtic') {
            html += this._renderCelticLayout();
        } else {
            html += `<div class="tarot-cards-row">`;
            this.drawnCards.forEach((card, i) => {
                html += this._renderCardSlot(card, i);
            });
            html += `</div>`;
        }

        // 解读按钮（全部翻完后显示）
        html += `<div id="tarotInterpretBtn" class="tarot-interpret-section" style="display:none;">
            <button class="glass-btn primary" style="font-size: 16px; padding: 14px 40px;"
                onclick="Tarot.requestInterpretation()">🔮 AI 解读</button>
        </div>`;

        // AI 解读区域
        html += `<div id="tarotInterpretResult" class="tarot-interpret-result"></div>`;

        container.innerHTML = html;

        // 延迟后自动开始翻牌动画提示
        setTimeout(() => {
            const firstCard = container.querySelector('.tarot-card-slot:not(.revealed)');
            if (firstCard) firstCard.classList.add('hint-pulse');
        }, 500);
    },

    _renderCardSlot(card, index) {
        const pos = this.currentSpread.positions[index] || '';
        const isRevealed = index < this.revealedCount;

        return `
            <div class="tarot-card-slot ${isRevealed ? 'revealed' : ''} ${card.isReversed && isRevealed ? 'card-reversed' : ''}"
                 onclick="Tarot.revealCard(${index})" data-index="${index}">
                <div class="tarot-card-inner">
                    <div class="tarot-card-back">
                        <div class="card-back-pattern">✦</div>
                    </div>
                    <div class="tarot-card-front">
                        <div class="card-emoji">${card.emoji}</div>
                        <div class="card-name">${card.fullName}</div>
                        ${card.isReversed ? '<div class="card-reversed-label">逆位</div>' : '<div class="card-upright-label">正位</div>'}
                    </div>
                </div>
                <div class="card-position-label">${pos}</div>
            </div>
        `;
    },

    _renderCelticLayout() {
        // 凯尔特十字特殊布局
        let html = '<div class="tarot-celtic-grid">';
        this.drawnCards.forEach((card, i) => {
            const pos = this.currentSpread.positions[i];
            const isRevealed = i < this.revealedCount;
            html += `
                <div class="celtic-pos celtic-pos-${i} ${isRevealed ? 'revealed' : ''} ${card.isReversed && isRevealed ? 'card-reversed' : ''}"
                     onclick="Tarot.revealCard(${i})" data-index="${i}">
                    <div class="tarot-card-inner">
                        <div class="tarot-card-back">
                            <div class="card-back-pattern">✦</div>
                        </div>
                        <div class="tarot-card-front">
                            <div class="card-emoji">${card.emoji}</div>
                            <div class="card-name" style="font-size: 11px;">${card.fullName}</div>
                            ${card.isReversed ? '<div class="card-reversed-label">逆</div>' : ''}
                        </div>
                    </div>
                    <div class="card-position-label">${pos}</div>
                </div>
            `;
        });
        html += '</div>';
        return html;
    },

    // === 翻牌 ===
    revealCard(index) {
        if (index !== this.revealedCount) return; // 必须按顺序翻

        this.revealedCount++;

        const container = document.getElementById('tarotReadingContent');
        const slots = container.querySelectorAll('.tarot-card-slot, .celtic-pos');
        const slot = slots[index];

        if (slot) {
            slot.classList.add('revealed', 'flip-animate');
            if (this.drawnCards[index].isReversed) {
                slot.classList.add('card-reversed');
            }
            // 移除提示脉冲
            slot.classList.remove('hint-pulse');
        }

        // 下一张提示
        const nextSlot = slots[index + 1];
        if (nextSlot) {
            setTimeout(() => nextSlot.classList.add('hint-pulse'), 600);
        }

        // 全部翻完
        if (this.revealedCount >= this.drawnCards.length) {
            setTimeout(() => {
                const btn = document.getElementById('tarotInterpretBtn');
                if (btn) {
                    btn.style.display = 'block';
                    btn.classList.add('fade-in');
                }
            }, 800);
        }
    },

    // === AI 解读 ===
    async requestInterpretation() {
        if (this.isGenerating) return;
        this.isGenerating = true;

        const btn = document.querySelector('#tarotInterpretBtn button');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '🔮 解读中……';
        }

        const resultDiv = document.getElementById('tarotInterpretResult');
        if (resultDiv) {
            resultDiv.innerHTML = '<div class="tarot-loading"><div class="tarot-loading-dot"></div><div class="tarot-loading-dot"></div><div class="tarot-loading-dot"></div></div>';
            resultDiv.style.display = 'block';
        }

        try {
            const interpretation = await this._callAI();

            if (resultDiv) {
                resultDiv.innerHTML = `<div class="tarot-interpretation">${this._formatInterpretation(interpretation)}</div>`;
            }

            // 保存到历史
            this._saveToHistory(interpretation);

        } catch (e) {
            console.error('[Tarot] AI error:', e);
            if (resultDiv) {
                resultDiv.innerHTML = `<div style="color: var(--danger-color); padding: 16px; text-align: center;">解读失败：${e.message || '请检查 API 设置后重试'}</div>`;
            }
        } finally {
            this.isGenerating = false;
            if (btn) {
                btn.disabled = false;
                btn.textContent = '🔮 重新解读';
            }
        }
    },

    async _callAI() {
        const cardsDesc = this.drawnCards.map((card, i) => {
            const pos = this.currentSpread.positions[i];
            const orientation = card.isReversed ? '逆位' : '正位';
            const meaning = card.isReversed ? card.reversed : card.upright;
            return `【${pos}】${card.fullName}（${orientation}）— ${meaning}`;
        }).join('\n');

        const systemPrompt = `あなたは神秘的で洞察力に富むタロット占い師です。温かく詩的な口調で、相談者の質問に対してカードの解釈を行います。

ルール：
- 各カードの位置・正逆位を踏まえた具体的な解釈を行うこと
- 複数枚の場合はカード同士の関係性・物語を紡ぐこと
- 相談者の質問に直接答える形で解釈すること
- 最後に総合的なアドバイスを一言添えること
- 神秘的だが押しつけがましくない語り口で
- 出力は中国語（簡体字）で書くこと
- 見出しに適宜 emoji を使い、読みやすくフォーマットすること`;

        const userMsg = `问题：${this.currentQuestion || '（无特定问题，请给出综合指引）'}

牌阵：${this.currentSpread.name}（${this.currentSpread.nameJa}）

抽到的牌：
${cardsDesc}

请为我解读这些牌。`;

        const messages = [{ role: 'user', content: userMsg }];
        const result = await Utils.callChatAPI(messages, systemPrompt);
        return result;
    },

    _formatInterpretation(text) {
        if (!text) return '<em>无法获取解读结果</em>';
        // 简单 markdown 处理
        return text
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/^### (.+)$/gm, '<h4>$1</h4>')
            .replace(/^## (.+)$/gm, '<h3>$1</h3>')
            .replace(/\n/g, '<br>');
    },

    // === 保存历史 ===
    _saveToHistory(interpretation) {
        if (!AppState.data.tarotData) return;

        const record = {
            id: Utils.generateId(),
            question: this.currentQuestion,
            spread: this.currentSpread.id,
            cards: this.drawnCards.map(c => ({
                fullName: c.fullName,
                emoji: c.emoji,
                isReversed: c.isReversed,
                upright: c.upright,
                reversed: c.reversed,
                type: c.type
            })),
            interpretation: interpretation || '',
            timestamp: Date.now()
        };

        AppState.data.tarotData.history.push(record);
        // 最多保存30条
        if (AppState.data.tarotData.history.length > 30) {
            AppState.data.tarotData.history = AppState.data.tarotData.history.slice(-30);
        }
        Utils.saveData();
    },

    // === 查看历史记录 ===
    viewReading(readingId) {
        const record = (AppState.data.tarotData?.history || []).find(h => h.id === readingId);
        if (!record) return;

        const spread = this.SPREADS.find(s => s.id === record.spread);

        // 复原状态并跳转
        this.currentQuestion = record.question;
        this.currentSpread = spread || this.SPREADS[0];
        this.drawnCards = record.cards;
        this.revealedCount = record.cards.length; // 全部已翻

        Navigation.goTo('tarot-reading');

        // 渲染后直接显示解读
        setTimeout(() => {
            const btn = document.getElementById('tarotInterpretBtn');
            if (btn) btn.style.display = 'none';
            const resultDiv = document.getElementById('tarotInterpretResult');
            if (resultDiv && record.interpretation) {
                resultDiv.innerHTML = `<div class="tarot-interpretation">${this._formatInterpretation(record.interpretation)}</div>`;
                resultDiv.style.display = 'block';
            }
        }, 100);
    },

    // === 清空历史 ===
    clearHistory() {
        if (!confirm('确定要清空所有占卜记录吗？')) return;
        if (AppState.data.tarotData) {
            AppState.data.tarotData.history = [];
            Utils.saveData();
        }
        this.renderMain();
        Utils.showToast(I18n.t('t.tarot_cleared', '已清空'));
    },

    // === 工具函数 ===
    // 收口：转发 Utils.escapeHtml
    _escapeHtml(str) {
        return Utils.escapeHtml(str);
    },

    _formatTime(ts) {
        const d = new Date(ts);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = d.toDateString() === yesterday.toDateString();

        const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        if (isToday) return `今天 ${time}`;
        if (isYesterday) return `昨天 ${time}`;
        return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
    }
};
