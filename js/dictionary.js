const Dictionary = {
    currentWord: null,

    render() {
        const list = document.getElementById('dictList');
        if (!AppState.data.dictionary || AppState.data.dictionary.length === 0) {
            list.innerHTML = '<div class="empty-state">No words yet. Click + to add.</div>';
            return;
        }

        list.innerHTML = AppState.data.dictionary.map((word, idx) => `
            <div class="word-item" onclick="Dictionary.viewWord(${idx})">
                <div class="word-main">
                    <div class="word-text">${word.word}</div>
                    <div class="word-reading">${word.reading || ''}</div>
                </div>
                <div class="word-meaning">${word.meaning || '...'}</div>
            </div>
        `).join('');
    },

    addWord() {
        document.getElementById('wordModal').classList.add('active');
        document.getElementById('wordInput').value = '';
        document.getElementById('wordReadingInput').value = '';
        document.getElementById('wordMeaningInput').value = '';
    },

    async saveWord() {
        const word = document.getElementById('wordInput').value.trim();
        const reading = document.getElementById('wordReadingInput').value.trim();
        let meaning = document.getElementById('wordMeaningInput').value.trim();

        if (!word) {
            alert(I18n.t('dict.input_word', '请输入单词'));
            return;
        }

        // 如果没有提供释义，使用AI生成
        if (!meaning) {
            try {
                const systemPrompt = 'You are a Japanese language expert. Provide clear and concise Chinese explanations for Japanese words.';
                const messages = [{
                    role: 'user',
                    content: `请解释这个日语单词：${word}${reading ? ` (${reading})` : ''}\n请提供：1. 中文意思 2. 词性 3. 简单例句`
                }];

                meaning = await Utils.callChatAPI(messages, systemPrompt);
            } catch (e) {
                alert(I18n.t('dict.ai_failed', 'AI解释生成失败，请手动输入释义'));
                return;
            }
        }

        if (!AppState.data.dictionary) {
            AppState.data.dictionary = [];
        }

        AppState.data.dictionary.push({
            id: Utils.generateId(),
            word,
            reading,
            meaning,
            addedAt: Date.now()
        });

        Utils.saveData();
        document.getElementById('wordModal').classList.remove('active');
        this.render();
    },

    viewWord(index) {
        const word = AppState.data.dictionary[index];
        if (!word) return;

        this.currentWord = word;

        document.getElementById('wordDetailTitle').textContent = word.word;
        document.getElementById('wordDetailReading').textContent = word.reading || '';
        document.getElementById('wordDetailMeaning').textContent = word.meaning || '无释义';
        document.getElementById('wordDetailAI').style.display = 'none';
        document.getElementById('wordDetailModal').classList.add('active');
    },

    async explainWithAI() {
        if (!this.currentWord) return;

        const aiSection = document.getElementById('wordDetailAI');
        aiSection.style.display = 'block';
        aiSection.textContent = '正在生成AI详解...';

        try {
            const systemPrompt = 'You are a Japanese language expert. Provide detailed explanations in Chinese for Japanese words, including etymology, usage notes, and example sentences.';
            const messages = [{
                role: 'user',
                content: `请详细解释这个日语单词：${this.currentWord.word}${this.currentWord.reading ? ` (${this.currentWord.reading})` : ''}\n请包括：\n1. 详细中文意思\n2. 词性和用法\n3. 常见搭配\n4. 例句（日文+中文翻译）\n5. 注意事项`
            }];

            const explanation = await Utils.callChatAPI(messages, systemPrompt);
            aiSection.textContent = explanation;
        } catch (e) {
            aiSection.textContent = 'AI详解生成失败：' + e.message;
        }
    },

    playTTS() {
        if (!this.currentWord) return;

        // 使用 Web Speech API 播放TTS
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(this.currentWord.word);
            utterance.lang = 'ja-JP';
            utterance.rate = 0.8;
            window.speechSynthesis.speak(utterance);
        } else {
            alert(I18n.t('dict.tts_unsupported', '您的浏览器不支持语音播放功能'));
        }
    },

    deleteWord() {
        if (!this.currentWord) return;

        if (confirm(I18n.t('dict.confirm_delete', '确定删除这个单词吗？'))) {
            AppState.data.dictionary = AppState.data.dictionary.filter(w => w.id !== this.currentWord.id);
            Utils.saveData();
            document.getElementById('wordDetailModal').classList.remove('active');
            this.render();
        }
    },

    importDictionary() {
        document.getElementById('dictFileInput').click();
    },

    handleDictImport(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                let words = [];

                // 尝试解析JSON格式
                if (file.name.endsWith('.json')) {
                    words = JSON.parse(content);
                } else {
                    // 尝试解析CSV/TXT格式（每行格式：单词,读音,释义）
                    const lines = content.split('\n');
                    words = lines.map(line => {
                        const parts = line.split(/[,\t]/);
                        if (parts.length >= 2) {
                            return {
                                id: Utils.generateId(),
                                word: parts[0].trim(),
                                reading: parts[1].trim(),
                                meaning: parts[2] ? parts[2].trim() : '',
                                addedAt: Date.now()
                            };
                        }
                        return null;
                    }).filter(Boolean);
                }

                if (words.length > 0) {
                    if (!AppState.data.dictionary) {
                        AppState.data.dictionary = [];
                    }
                    AppState.data.dictionary.push(...words);
                    Utils.saveData();
                    this.render();
                    alert(`✓ 成功导入 ${words.length} 个单词`);
                } else {
                    alert('文件格式错误或没有有效数据');
                }
            } catch (e) {
                alert('导入失败：' + e.message);
            }
        };
        reader.readAsText(file);
    }
};

