const Quiz = {
    currentQuiz: null,
    currentIndex: 0,
    score: 0,

    // 日语词汇库（示例数据，按等级分类）
    vocabularyBank: {
        N5: [
            { word: '私', reading: 'わたし', meaning: '我' },
            { word: '行く', reading: 'いく', meaning: '去' },
            { word: '食べる', reading: 'たべる', meaning: '吃' },
            { word: '見る', reading: 'みる', meaning: '看' },
            { word: '書く', reading: 'かく', meaning: '写' }
        ],
        N4: [
            { word: '会社', reading: 'かいしゃ', meaning: '公司' },
            { word: '勉強', reading: 'べんきょう', meaning: '学习' },
            { word: '電話', reading: 'でんわ', meaning: '电话' },
            { word: '写真', reading: 'しゃしん', meaning: '照片' },
            { word: '時間', reading: 'じかん', meaning: '时间' }
        ],
        N3: [
            { word: '説明', reading: 'せつめい', meaning: '说明' },
            { word: '意見', reading: 'いけん', meaning: '意见' },
            { word: '環境', reading: 'かんきょう', meaning: '环境' },
            { word: '経験', reading: 'けいけん', meaning: '经验' },
            { word: '機会', reading: 'きかい', meaning: '机会' }
        ],
        N2: [
            { word: '傾向', reading: 'けいこう', meaning: '倾向' },
            { word: '基準', reading: 'きじゅん', meaning: '基准' },
            { word: '効率', reading: 'こうりつ', meaning: '效率' },
            { word: '存在', reading: 'そんざい', meaning: '存在' },
            { word: '発展', reading: 'はってん', meaning: '发展' }
        ],
        N1: [
            { word: '概念', reading: 'がいねん', meaning: '概念' },
            { word: '顕著', reading: 'けんちょ', meaning: '显著' },
            { word: '妥当', reading: 'だとう', meaning: '妥当' },
            { word: '曖昧', reading: 'あいまい', meaning: '暧昧' },
            { word: '抽象', reading: 'ちゅうしょう', meaning: '抽象' }
        ]
    },

    init() {
        document.getElementById('quizDisplay').innerHTML = '';
    },

    async generateQuiz() {
        const level = document.getElementById('quizLevel').value;
        const type = document.getElementById('quizType').value;
        const count = parseInt(document.getElementById('quizCount').value) || 10;

        const btn = document.getElementById('generateQuizBtn');
        btn.textContent = '生成中...';
        btn.disabled = true;
        Utils.showToast(I18n.t('t.quiz_generating', 'AI 正在出题，请稍候...'));

        try {
            const systemPrompt = `You are a Japanese language teacher. Generate quiz questions based on the specified level and type. Return the questions in JSON format.`;

            const vocabSample = this.vocabularyBank[level] || this.vocabularyBank.N5;
            const vocabList = vocabSample.map(v => `${v.word}(${v.reading}): ${v.meaning}`).join(', ');

            let typeInstruction = '';
            if (type === 'choice') {
                typeInstruction = '生成选择题，每题有4个选项，只有1个正确答案';
            } else if (type === 'judge') {
                typeInstruction = '生成判断题，判断句子或翻译是否正确，answer字段只填"正确"或"错误"';
            } else if (type === 'short') {
                typeInstruction = '生成简答题，要求翻译或填空';
            } else {
                typeInstruction = '生成混合题型，包括选择题、判断题和简答题';
            }

            const messages = [{
                role: 'user',
                content: `请生成${count}道日语${level}等级的练习题。\n\n题型要求：${typeInstruction}\n\n参考词汇：${vocabList}\n\n请以JSON数组格式返回，每个题目包含：\n- type: "choice"/"judge"/"short"\n- question: 题目文本\n- options: 选项数组(仅选择题需要)\n- answer: 正确答案\n- explanation: 答案解释\n\n示例格式：\n[{"type":"choice","question":"「行く」的读音是？","options":["いく","ゆく","あく","こく"],"answer":"いく","explanation":"行く的标准读音是いく"}]`
            }];

            const response = await Utils.callChatAPI(messages, systemPrompt);

            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                this.currentQuiz = JSON.parse(jsonMatch[0]);
                this.currentIndex = 0;
                this.score = 0;
                Utils.showToast(I18n.t('t.quiz_generated', {n: this.currentQuiz.length}));
                this.showQuestion();
            } else {
                throw new Error('AI返回格式错误');
            }

        } catch (e) {
            Utils.showToast(I18n.t('t.quiz_gen_failed', '生成失败，已切换为示例题目：') + e.message);
            this.generateSampleQuiz(level, type, count);
        } finally {
            btn.textContent = '开始练习';
            btn.disabled = false;
        }
    },

    generateSampleQuiz(level, type, count) {
        const vocab = this.vocabularyBank[level] || this.vocabularyBank.N5;
        this.currentQuiz = [];

        for (let i = 0; i < Math.min(count, vocab.length); i++) {
            const word = vocab[i];
            if (type === 'choice' || type === 'mixed') {
                const others = vocab.filter((_, j) => j !== i);
                const wrongs = others.sort(() => Math.random() - 0.5).slice(0, 3).map(w => w.meaning);
                this.currentQuiz.push({
                    type: 'choice',
                    question: `「${word.word}」的中文意思是？`,
                    options: [word.meaning, ...wrongs].sort(() => Math.random() - 0.5),
                    answer: word.meaning,
                    explanation: `${word.word}(${word.reading})的意思是${word.meaning}`
                });
            } else if (type === 'judge') {
                const isCorrect = Math.random() > 0.5;
                const otherWord = vocab.filter((_, j) => j !== i)[Math.floor(Math.random() * (vocab.length - 1))];
                const meaning = isCorrect ? word.meaning : otherWord.meaning;
                this.currentQuiz.push({
                    type: 'judge',
                    question: `「${word.word}」的意思是"${meaning}"，对吗？`,
                    answer: isCorrect ? '正确' : '错误',
                    explanation: `${word.word}(${word.reading})的正确意思是${word.meaning}`
                });
            } else if (type === 'short') {
                this.currentQuiz.push({
                    type: 'short',
                    question: `请写出「${word.word}」的中文意思：`,
                    answer: word.meaning,
                    explanation: `${word.word}(${word.reading})的意思是${word.meaning}`
                });
            }
        }

        if (this.currentQuiz.length === 0) {
            Utils.showToast(I18n.t('t.quiz_vocab_short', '当前等级词库不足，请换个等级试试'));
            return;
        }
        this.currentIndex = 0;
        this.score = 0;
        this.showQuestion();
    },

    showQuestion() {
        if (this.currentIndex >= this.currentQuiz.length) {
            this.showResults();
            return;
        }

        const q = this.currentQuiz[this.currentIndex];
        const display = document.getElementById('quizDisplay');

        let html = `
            <div class="quiz-card">
                <div class="quiz-progress">题目 ${this.currentIndex + 1} / ${this.currentQuiz.length}</div>
                <div class="quiz-question">${q.question}</div>
        `;

        if (q.type === 'choice') {
            html += '<div class="quiz-options">';
            q.options.forEach((opt, idx) => {
                html += `<button class="quiz-option" onclick="Quiz.checkAnswer('${opt}')">${opt}</button>`;
            });
            html += '</div>';
        } else if (q.type === 'judge') {
            html += `
                <div class="quiz-options">
                    <button class="quiz-option" onclick="Quiz.checkAnswer('正确')">正确</button>
                    <button class="quiz-option" onclick="Quiz.checkAnswer('错误')">错误</button>
                </div>
            `;
        } else if (q.type === 'short') {
            html += `
                <input type="text" id="quizInput" class="quiz-input" placeholder="输入答案">
                <button class="glass-btn primary" onclick="Quiz.checkAnswer(document.getElementById('quizInput').value)">提交</button>
            `;
        }

        html += '</div>';
        display.innerHTML = html;
    },

    checkAnswer(userAnswer) {
        const q = this.currentQuiz[this.currentIndex];
        const correct = userAnswer.trim() === q.answer.trim();
        const display = document.getElementById('quizDisplay');

        // 在题目区域内显示答题结果，不用 alert
        const resultDiv = document.createElement('div');
        resultDiv.style.cssText = `
            margin-top: 12px; padding: 12px 14px; border-radius: 10px;
            font-size: 14px; line-height: 1.6;
            background: ${correct ? '#d4edda' : '#f8d7da'};
            color: ${correct ? '#155724' : '#721c24'};
        `;
        resultDiv.innerHTML = `
            <div style="font-weight:700;margin-bottom:4px;">${correct ? '✓ 正确！' : `✗ 错误　正确答案：${q.answer}`}</div>
            <div>${q.explanation}</div>
            <button class="glass-btn primary" style="margin-top:10px;width:100%;" onclick="Quiz._nextQuestion()">下一题</button>
        `;

        // 禁用所有选项按钮，防止重复点击
        display.querySelectorAll('.quiz-option, .quiz-input, button.glass-btn.primary').forEach(el => el.disabled = true);
        display.querySelector('.quiz-card').appendChild(resultDiv);

        if (correct) this.score++;
    },

    _nextQuestion() {
        this.currentIndex++;
        this.showQuestion();
    },

    showResults() {
        const display = document.getElementById('quizDisplay');
        const percentage = (this.score / this.currentQuiz.length * 100).toFixed(0);

        display.innerHTML = `
            <div class="quiz-card">
                <h2>练习完成！</h2>
                <div class="quiz-score">
                    <div style="font-size: 48px; font-weight: bold; color: var(--accent-color);">${this.score}</div>
                    <div style="font-size: 18px; color: #666;">/ ${this.currentQuiz.length}</div>
                </div>
                <div style="font-size: 24px; margin: 20px 0;">正确率：${percentage}%</div>
                <button class="glass-btn primary" onclick="Quiz.init(); document.getElementById('quizDisplay').innerHTML = '';">再来一次</button>
            </div>
        `;
    }
};

// AI答疑（Tutor）模块 - 完全独立的对话系统
