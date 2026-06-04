const NovelTranslator = {
    async translateNovel() {
        const original = document.getElementById('novelOriginal').value.trim();
        if (!original) {
            alert('请先粘贴要翻译的日语文本');
            return;
        }

        const translateBtn = document.getElementById('translateNovelBtn');
        const progress = document.getElementById('translateProgress');
        const translationCard = document.getElementById('novelTranslationCard');
        const translationDiv = document.getElementById('novelTranslation');

        translateBtn.disabled = true;
        translateBtn.textContent = '翻译中...';
        progress.style.display = 'block';
        translationCard.style.display = 'none';

        try {
            // 将文本分段（每段约500字符，避免API限制）
            const segments = this.splitText(original, 500);
            const translations = [];

            for (let i = 0; i < segments.length; i++) {
                const segment = segments[i];
                document.getElementById('progressText').textContent =
                    `${Math.round((i / segments.length) * 100)}% (${i + 1}/${segments.length})`;

                // 调用AI翻译
                const systemPrompt = `You are a professional Japanese to Chinese translator. Translate the following Japanese text to natural, fluent Chinese. Maintain the original style and tone. Only provide the translation without any additional explanation or comments.`;

                const messages = [{
                    role: 'user',
                    content: segment
                }];

                const translation = await Utils.callChatAPI(messages, systemPrompt);
                translations.push(translation);

                // 稍微延迟避免API速率限制
                if (i < segments.length - 1) {
                    await new Promise(r => setTimeout(r, 500));
                }
            }

            // 显示翻译结果
            const fullTranslation = translations.join('\n\n');
            translationDiv.textContent = fullTranslation;
            translationCard.style.display = 'block';
            progress.style.display = 'none';
            translateBtn.disabled = false;
            translateBtn.textContent = '开始翻译';

            // 滚动到译文
            translationCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

        } catch (e) {
            alert('翻译失败：' + e.message);
            progress.style.display = 'none';
            translateBtn.disabled = false;
            translateBtn.textContent = '开始翻译';
        }
    },

    splitText(text, maxLength) {
        // 按段落或句子分割文本
        const paragraphs = text.split(/\n+/);
        const segments = [];
        let currentSegment = '';

        for (const para of paragraphs) {
            if (currentSegment.length + para.length <= maxLength) {
                currentSegment += (currentSegment ? '\n' : '') + para;
            } else {
                if (currentSegment) segments.push(currentSegment);
                // 如果单个段落太长，按句子分割
                if (para.length > maxLength) {
                    const sentences = para.split(/([。！？\n]+)/);
                    let sentenceSegment = '';
                    for (const sentence of sentences) {
                        if (sentenceSegment.length + sentence.length <= maxLength) {
                            sentenceSegment += sentence;
                        } else {
                            if (sentenceSegment) segments.push(sentenceSegment);
                            sentenceSegment = sentence;
                        }
                    }
                    if (sentenceSegment) currentSegment = sentenceSegment;
                } else {
                    currentSegment = para;
                }
            }
        }
        if (currentSegment) segments.push(currentSegment);

        return segments;
    },

    clearNovel() {
        if (confirm('确定清空内容吗？')) {
            document.getElementById('novelOriginal').value = '';
            document.getElementById('novelTranslation').textContent = '';
            document.getElementById('novelTranslationCard').style.display = 'none';
        }
    },

    copyTranslation() {
        const translation = document.getElementById('novelTranslation').textContent;
        if (!translation) return;

        navigator.clipboard.writeText(translation).then(() => {
            alert('✓ 译文已复制到剪贴板');
        }).catch(() => {
            alert('复制失败，请手动选择复制');
        });
    },

    uploadFile(file) {
        if (!file) return;

        // 检查文件类型
        if (!file.name.endsWith('.txt')) {
            alert('请上传txt格式的文件');
            return;
        }

        // 读取文件内容
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            document.getElementById('novelOriginal').value = content;
            alert('✓ 文件上传成功');
        };
        reader.onerror = () => {
            alert('文件读取失败，请重试');
        };
        reader.readAsText(file, 'UTF-8');
    }
};

// 系统配置模块
