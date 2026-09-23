// niconico-pv-storyboard.js — 从 js/niconico.js 纯搬运拆出（v2.270.0）：分镜提示词（演出类型·氛围卡·画风锚数据 + AI 帮写 + 推敲检品）。
// 内容零改动；加载顺序：niconico.js → pv-form → pv-media → pv-storyboard → pv-submit → pv-frames（见 index.html）。
Object.assign(Niconico, {

    // ===== AIにおまかせ：演出タイプ×ムード 二軸カード（v2.243） =====
    // 定番演出語彙は自前で攢めたもの——タイプ選択時は persona も差し替える（音楽PV演出監督／シリーズ構成）、
    // ムードは色調・運鏡のトーンだけを足す。「指定なし」時は _pvAiWrite 側で一切参照されない
    _PV_STYLE_CARDS: {
        op: {
            persona: '音乐PV演出导演',
            text: '这是一段动画OP风格的影像。可将OP的惯用演出语汇用于判断：充满疾走感的起跑／角色回眸·望向镜头／主要角色依次登场的介绍镜头／全员集合的拉远画面／副歌前一瞬的静止（蓄势）／最后以一张定格决胜画收尾。注意乐曲的能量曲线（主歌=铺垫、副歌=最高潮），据此分配镜头密度。'
        },
        ed: {
            persona: '音乐PV演出导演',
            // カット数の具体的な数字は二期で cutRange（duration 連動）に一元化——ここに数字を残すと
            // cutRange の指示と食い違った時に二重指示の矛盾が生まれるため、方向性の言及だけ残す
            text: '这是一段动画ED风格的影像。可运用ED的惯用语汇：定机位或缓慢移动的长镜头／背影·远景·剪影／带着日常余韵的小动作／沉稳统一的色调／最后缓缓拉远、或如静静闭眼般收束。镜头数可以偏少。'
        },
        insert: {
            persona: '音乐PV演出导演',
            text: '这是一段插入歌场景风格的影像。要意识到“乐曲与故事情感最高潮重叠”的演出：插入回忆闪回／现在与过去的对比镜头／向高潮层层推进的蒙太奇／让乐曲的高涨与情感的顶点重合。故事改编向的语汇也可选用：表现流言·群体压力·抽象的威胁时，可以用一个核心象征物、或剪影·局部来代替具体配角；台词的情绪与画面里的真相相反时，可以让画面加入不安的元素形成反差；复杂的羁绊可以用简化的图形（分裂·重组·破碎再缝合）做转场暗示；群体性的嫉妒·恐慌也可以用大字排版·高频闪烁的纯文字画面替代人物表演；需要交代但不必深入刻画的反派·旁观者，也可以处理成剪影或只露出局部，不必给到清晰的正脸。'
        },
        yokoku: {
            persona: '系列构成（宣传担当）',
            text: '这是一段下集预告风格的影像。可运用预告的惯用语汇：短促摘要镜头的连续堆叠／一两句引人遐想的台词「」／点到为止、不亮出核心／最后以黑场或定格画制造对下一集的期待。可以基于既有设定·伏笔暗示下一集篇幅的展开，但不得明示重大转折或结局。'
        },
        highlight: {
            persona: '系列构成（宣传担当）',
            text: '这是一段本季高光（总集篇PV）风格的影像。从已播出的事件中挑选名场面进行蒙太奇：把情感起伏排成波浪／需要时可加入体现关系变化的对比（初遇时→现在）／最后以象征整个故事的一张画收尾。'
        },
        // バトル（三期）：B文書（社区参考プロンプト）の骨架を踏襲——空間提示→動作の一方向エスカレーション→
        // クライマックス直前の静止→最大の一撃→決め画。styleMenuRule が後段に必ず付くので、ここでは
        // 「〜すること」を連発せず highlight カードと同じ「〜してもよい」緩和句式に寄せる（引き出し口調の護り）
        battle: {
            persona: '动作戏演出导演',
            text: '这是一段战斗场景风格的影像。可运用战斗演出的惯用语汇：先交代作为战场的空间／动作无论徒手·武器·异能，都单向地逐级升温（挑衅→首击→交锋→逼入绝境，等）／高潮前可插入一瞬静止（蓄势·半秒的静默）／随后向最重的一击层层压上／最后以定格决胜画收尾（若能回收开头展示过的武器·架势·背景等要素更佳）。斩击轨迹·冲击波·残影·瓦砾碎片飞散·撞击火花·速度线式的速度感——这些语汇也可作为演出工具选用。时长较短时，不要害怕短镜头的连续堆叠。'
        },
        // MV（六期，2026-09-18）：来自一支原创MV实战三版对比的结论——图形动画/意识流蒙太奇/文字排版类镜头
        // 是「像不像MV」的分水岭，同 styleMenuRule 的抽屉口吻（引き出し），不义务化任何一样语汇
        mv: {
            persona: '音乐MV演出导演',
            text: '这是一段音乐MV风格的影像。镜头切换可以卡在歌词的行与行分界处；也不妨用意识流式的蒙太奇推进——不追求连续叙事，靠意象接续（例如上一镜是手部的特写，下一镜接水面的涟漪）；象征物的特写也可以替代直白的叙事表演；图形动画镜头（线条·色块·粒子·剪影构成的转场）是MV的常见语汇，可以酌情使用；UI界面·复古CRT屏幕·数字故障·扫描线这类语汇也可以酌情加入；转场节奏可以更快、更图形化。文字排版类的镜头只出留白底板或抽象的几何排版图形，画面里绝不出现可读的文字。整体节奏不妨随歌曲的段落走：主歌是铺垫，副歌是爆发，间奏可以给一口呼吸。'
        }
    },
    _PV_MOOD_CARDS: {
        iyashi: '基调是「治愈」：柔和的光·暖色·舒缓的运镜。镜头偏长，动作是微风、光尘般轻柔的东西。表现久远的回忆·传说时，可以在画面边缘加一层环境画框（绘本边缘·遮幅）拉开“在时间长河中远观”的距离；强烈的思念·时间流逝，比起直接刻画痛苦的表情，可以交给一两个带轻微动态的大全景空镜（风吹过的旷野·云影掠过山谷）让环境替角色说话；物是人非，可以用同一处场景（同一张长椅·同一棵树）保持不变、只换其中的人物来表现。',
        setsunai: '基调是「揪心」：黄昏·雨·逆光·偏蓝的色调。运用体现错过与距离感的构图，善用舒缓的留白。',
        moeru: '基调是「燃」：快速的镜头切换·仰角或倾斜的构图·突进疾驰等有气势的单向动作。对比强烈的色彩。高潮前也可以先给一个明显更长更安静的镜头蓄力，高潮本身不一定要切得比前面更快。',
        kibou: '基调是「希望」：朝阳·不断上升的运镜·开阔的远景。营造画面从阴影走向光的变化。',
        shukufuku: '基调是「祝福」：光尘与花瓣·温暖的白·聚拢的人群。用柔和的推近捕捉表情。'
    },

    // 画风锚（六期，2026-09-18）：来自一支原创MV实战三版对比的结论——最便宜的一条改动，一句画风锚句
    // 放进出图与视频两处就能明显压制3D感。每一条都带显式的「不要」，防止模型按训练偏好漂移回默认画风。
    // '' (不指定) 不在此表内——查表取不到值即视为未指定，_pvAiWrite/_pvApplyArtStyle 两处都据此跳过注入
    _PV_ART_STYLES: {
        cel: '日本动画原画・赛璐璐画风：平涂色块、干净线稿、简洁阴影分层，绝对不要2.5D或3D渲染，不要写实材质与体积光',
        flat: '平涂插画画风：单色块着色、极简或无阴影分层、干净的矢量感边缘，不要照片级写实材质，不要精细的笔触肌理',
        painterly: '厚涂·水彩画风：可见的笔触与颜料肌理、柔和的色彩过渡，不要赛璐璐式的平涂色块，不要锐利干净的矢量边缘',
        realistic: '写实·3D CG画风：真实材质与体积光、符合物理规律的阴影与反光，不要赛璐璐式的平涂色块，不要2D手绘线稿感'
    },

    // AIにおまかせ・seedText 三態のしきい値（二期）：400字は「この尺（15秒PV基準）では原作全文を
    // 映像化しきれない」水準の目安（丁寧に描けるのはワンシーン程度）であり、同時に「方向性」用途の
    // 短文にも十分な余地を残すために選んだ境界値。この値未満は加筆で尺を満たす方向性、以上は選段の対象
    _PV_EXCERPT_THRESHOLD: 400,

    // 台词·旁白语言（2026-08-23）：分镜描述恒中文（目标视频模型均为中文模型），
    // 「」内要朗读的文字跟用户选择走。pace 是台词字数/秒的换算（检品⑨同源）
    _PV_DIALOGUE_LANGS: {
        ja: { name: '日语', pace: '按日语计每秒6个字左右' },
        zh: { name: '中文', pace: '按中文计每秒4个字左右' },
        en: { name: '英语', pace: '按英语计每秒2〜3个单词' }
    },

    // 内联浮层（そのまま生成／推敲つき生成）：npc-role-dropdown と同じ姿勢——position:relative の wrap + 外部クリックで閉じる
    _pvAiWriteToggleMenu(e) {
        if (e) e.stopPropagation();
        const menu = document.getElementById('nicoPvAiMenu');
        if (!menu) return;
        const willShow = menu.style.display === 'none' || !menu.style.display;
        menu.style.display = willShow ? 'block' : 'none';
        if (willShow && !this._pvAiMenuOutsideBound) {
            this._pvAiMenuOutsideBound = true;
            document.addEventListener('click', e => this._pvAiWriteMenuOutsideClick(e));
        }
    },

    _pvAiWriteMenuOutsideClick(e) {
        const menu = document.getElementById('nicoPvAiMenu');
        if (!menu || menu.style.display === 'none') return;
        const wrap = menu.closest('.nico-pv-ai-wrap');
        if (wrap && !wrap.contains(e.target)) menu.style.display = 'none';
    },

    _pvAiWriteChoose(polish) {
        const menu = document.getElementById('nicoPvAiMenu');
        if (menu) menu.style.display = 'none';
        this._pvAiWrite(polish);
    },

    // ===== AIにおまかせ：世界観から絵コンテ（複数カットの演出台本）を書く（_generateVideos と同じ注入三件套） =====
    // 五期（2026-09-15）：三支真实 MV 逐镜头分析（子代理看画面 + 同事按剧情对撞）的综合结论落地——固定机位合法化
    // （真片六七成是固定机位，运动感靠画面内部元素）、单镜头内景别渐变、人物局部/小比例仍算主体、一个动作可拆多镜、
    // 连续无台词合法、看点含身体局部特写；工具箱补硬切默认+转场分工；新增「节奏结构」抽屉（第三维度）；检品②同步放宽
    // 選択済みの参考図/参考音声/歌詞をそのまま演出素材として認識させる——参考図は容姿参照であって構図の指定ではない
    // （冒頭カットが必ず正面立ち絵になるとは限らない）。並発防呆は Utils.withLock（CLAUDE.md 铁律）
    // polish（v2.243、任意）：true なら生成後に「制作進行」人格で一回だけ検品パスを追加する
    async _pvAiWrite(polish) {
        const textarea = document.getElementById('nicoPvPrompt');
        if (!textarea) return;
        const btn = document.getElementById('nicoPvAiWriteBtn');
        const label = document.getElementById('nicoPvAiWriteLabel');

        await Utils.withLock('nicoPvAiWrite', async () => {
            if (btn) btn.disabled = true;
            if (label) label.textContent = I18n.t('nico.pv_ai_writing', '生成中…');

            try {
                const worldContext = (typeof Forum !== 'undefined' && Forum.getWorldContext) ? Forum.getWorldContext() : (AppState.data.broadcast.worldSetting || '');
                const seedText = (textarea.value || '').trim();

                // 台词·旁白语言（2026-08-23）：分镜描述恒中文，「」内跟这个走
                const dialogueLang = document.getElementById('nicoPvDialogueLang')?.value || this._ensureData().pvDialogueLang || 'ja';
                const langInfo = this._PV_DIALOGUE_LANGS[dialogueLang] || this._PV_DIALOGUE_LANGS.ja;

                // 画风锚（六期）：_pvGetArtStyleKey 已处理 ''（不指定）不兜底的边界；查不到表则 anchor 为空，
                // 后面所有画风相关的注入分支（概述/整体氛围行要求、## 规则、检品）都靠 artStyleAnchor 的真值来开关
                const artStyleKey = this._pvGetArtStyleKey();
                const artStyleAnchor = this._PV_ART_STYLES[artStyleKey] || '';

                // 演出タイプ×ムード（v2.243）：どちらも「指定なし」なら以下は全部空になり、通用演出監督の prompt と一字一句同じまま
                const styleType = document.getElementById('nicoPvStyleType')?.value || '';
                const styleMood = document.getElementById('nicoPvStyleMood')?.value || '';
                // v2.246 review（A3）：予告/ハイライトはフィールド自体を隠しているだけで this._pvRefAudio や
                // textarea の値はまだ残っている（_pvUpdateAudioLyricsVisibility は表示切替のみで値は消さない）。
                // 隠れている間の AI 生成にその残留値を読ませない——底の値そのものは触らない、この回の生成でだけ無視する
                const hideForType = (styleType === 'yokoku' || styleType === 'highlight');
                const typeCard = this._PV_STYLE_CARDS[styleType] || null;
                const moodCardText = this._PV_MOOD_CARDS[styleMood] || '';
                const directorIdentity = typeCard ? typeCard.persona : '操刀官方PV的演出导演';
                const duration = parseInt(document.getElementById('nicoPvDuration')?.value, 10) || 10;
                // カット数は尺（duration）に比例させる（二期）：下限は「4秒に1カットは切れる」目安、
                // 上限は ED は「少なめ」の演出意図をそのまま反映して下限+1に詰め、それ以外は
                // 「2.5秒に1カットまで詰めてよい」目安。ED カードが「少なめ」を明言するので出力形式の
                // 指示もそちらに合わせる（二重指示の矛盾を残さない）
                const cutMin = Math.max(2, Math.ceil(duration / 4));
                const cutMax = (styleType === 'ed') ? cutMin + 1 : Math.max(cutMin + 1, Math.floor(duration / 2.5));
                const cutRange = `${cutMin}〜${cutMax}`;
                // 字数上限随尺缩放（2026-08-23 中文化重标定）：中文信息密度高于日语假名混写，
                // 30秒按官方 2.5 指南的长例约 900 字级封顶；「中文500字以内」是 1.x 时代旧文档的警告，不再适用
                const charBudget = Math.min(900, Math.max(300, duration * 35));
                const styleCardTexts = [typeCard ? typeCard.text : '', moodCardText].filter(Boolean);
                // v2.246.1：定番語彙は引き出しでありチェックリストではない——総則を必ず添える。
                // カードの「〜すること」口調がユーザーの seedText（軟性区画）より強く読まれ、
                // 「ただ踊るだけの片段」にも対比フラッシュバックが毎回挿入される実測があった
                const styleMenuRule = '以上惯用语汇是演出的工具抽屉，没有全部塞进片子的义务。用户的方向性足够具体时以它为最优先，不合适的语汇不要用。';
                const styleSection = styleCardTexts.length ? `\n## 演出风格\n${styleCardTexts.join('\n\n')}\n\n${styleMenuRule}\n` : '';
                const eventLimit = (styleType === 'highlight') ? 8 : 3;   // ハイライトは名場面の材料を厚めに

                // 撮影の引き出し：既存の「カメラワーク（寄り・引き・パンなど）」一文だけだと
                // 運鏡の語彙がその数語に寄りがち（2026-08-18 社区プロンプト対比で判明した弱点）——
                // 景別・運鏡・つなぎの定番術語を常時注入して選択肢を広げる。styleMenuRule と同じ理由で、
                // 末尾の護りの一文は必須（語彙表を「全部使うべきチェックリスト」と誤読させない）
                const cinematographySection = `\n## 拍摄手法工具箱\n景别·构图：特写／半身近景／远景（拉开的画面）／俯拍／仰拍／过肩镜头／剪影／主观视角\n运镜：固定机位＋画面内容自身的变化（表情·光效·衣摆发丝·剪影转实体·叠化）／推镜·拉镜／横移（跟踪）／上升·下降（升降镜头）／环绕／手持晃动感／移焦（焦点从前景平滑转到背景）／单镜头内的景别渐变（同一镜头从远景推进到特写、从虚焦到实焦）\n镜头衔接：硬切（默认）／匹配剪辑（可以靠同一色相·同一道具·同一自然元素延续，不必是同一动作）／叠化（用于同一素材的状态转变、或视觉不同但情绪相通的两个画面）／闪白·黑场·淡入淡出（留给一两个真正的段落·情绪档位切换点）／动作衔接\n\n以上术语是演出的工具抽屉，没有全部用上的义务。只挑选符合各镜头演出意图的手法，写成具体的运动或变化。\n`;

                // 节奏结构（2026-09-15 五期）：来自三支真实 MV 逐镜头分析的综合结论——「类型×情绪」两轴回答的是
                // 场合与基调，没有回答「密度曲线怎么走」。这里补的是与两轴正交的第三维度，仍以抽屉口吻给出。
                // 按时长分档注入（review f 项）：4〜10 秒的 2〜4 镜短片装不下这些结构装置、注入即噪音（styleMenuRule
                // 那次「软句式仍被硬插」的教训）；15 秒给核心三条；30 秒（仅 Seedance 2.5）才给两次高潮/色温分段这类长尺条目
                const rhythmItems = [];
                if (duration >= 15) {
                    rhythmItems.push('- 情绪高点前也不妨先蓄力：可以先给1〜2个明显更长的凝视·空镜·静止镜头（约全片平均镜头长度的2〜3倍），再用一个克制的动作（闭眼·黑场·握拳）当引爆点，而不一定要靠切得更碎来抢强度（战斗类型的短镜堆叠是另一种合法手法，不受此条约束）；最密的碎切也可以放在高潮前的铺垫，而不一定是高潮本身');
                    rhythmItems.push('- 高潮段的景别可以走两个极端（大远景与特写并用），少用中景过渡');
                    rhythmItems.push('- 可以选定一个小物件·色彩·构图作为母题，在开头与结尾或几个关键节点重复出现，并让它的状态随情绪变化（从完好到受伤、从模糊到清晰）');
                }
                if (duration >= 30) {
                    rhythmItems.push('- 全片的镜头密度也不必是一条平线：不妨安排一段明显更疏的呼吸区、一段明显更密的峰值区');
                    rhythmItems.push('- 如果设计了两次高潮，第二次不必重复第一次：可以换景别配比，或干脆用一段放慢的静默长镜头把情绪落地');
                    rhythmItems.push('- 跨越较长时间时，可以让一个场景·静物保持不变，只改变其中人物的年龄·状态；跨越多个情绪阶段时，可以按阶段分配不同的色温·影调，让色彩本身标记段落');
                }
                const rhythmSection = rhythmItems.length
                    ? `\n## 节奏结构\n${rhythmItems.join('\n')}\n\n以上同样是抽屉：只在与时长和演出意图相称时取用。\n`
                    : '';

                // 素材リスト（図N）：createTask が content 配列に積む順番は refImgIds 配列の順番そのまま
                // （画廊選択器は url 解決できない項目をすでに選択肢から弾いている——欠番は基本起きない想定）。
                // modelInfo.ref が false（Seedance 1.x 系）の時は createTask 側も画像を一切送らないので、ここも空扱いにする
                const modelSel = document.getElementById('nicoPvModel');
                const modelInfo = this._pvModelInfo(modelSel ? modelSel.value : '');
                const refImgIds = modelInfo.ref ? (this._pvRefImgIds || []) : [];
                const charRefs = (typeof Broadcast !== 'undefined' && Broadcast.getAllCharRefs) ? Broadcast.getAllCharRefs() : [];
                const assetLines = this._pvBuildAssetLines(refImgIds, charRefs);   // 六期：抽成纯函数，_pvSubmit 复用同一份文案
                const hasAssets = assetLines.length > 0;
                const assetSection = hasAssets ? `\n## 素材列表\n${assetLines.join('\n')}\n` : '';

                // 参考音声＋歌詞：時長は _pvRefAudio.duration（秒）。歌詞は台詞ではないので「」規則の対象外（下のルールで明示禁止）
                // hideForType 時は null/空扱い（A3）——フィールドが隠れている演出タイプでは音声・歌詞を無視する
                const refAudio = hideForType ? null : this._pvRefAudio;
                const lyrics = hideForType ? '' : (document.getElementById('nicoPvLyrics')?.value || '').trim();
                const hasLyrics = !!(refAudio && lyrics);
                // 歌词字幕（六期 P2）：带时间戳时把歌词行换成「秒数+正文」喂给提示词，让镜头切换有台账可对；
                // 不带时间戳（或没歌词/没参考音声）时 lyricsPromptText 就是原始 lyrics，systemPrompt 与改动前逐字一致
                let lyricsPromptText = lyrics;
                let lyricsTimedRuleExtra = '';
                if (hasLyrics && this._pvParseLyricCues) {
                    const lyricOffset = parseFloat(document.getElementById('nicoPvLyricOffset')?.value) || 0;
                    const parsedLyrics = this._pvParseLyricCues(lyrics, { offset: lyricOffset, duration });
                    if (parsedLyrics.timed && parsedLyrics.cues.length > 0) {
                        lyricsPromptText = parsedLyrics.cues.map(c => `${c.t.toFixed(1)}秒 ${c.text}`).join('\n');
                        lyricsTimedRuleExtra = '，歌词行前的秒数是这一句在本片中开始演唱的时刻，镜头切换尽量落在这些时刻上';
                    } else if (parsedLyrics.timed) {
                        // 有时间戳、但按当前偏移没有一句落在成片时长内（偏移填错了之类）：不给秒数，也不把 [00:12.34]
                        // 这种原始标记喂进提示词
                        lyricsPromptText = this._pvLyricsPlainText(lyrics);
                    }
                }
                let audioSection = '';
                if (refAudio) {
                    audioSection = `\n参考音声（BGM）：约${Math.round(refAudio.duration)}秒的乐曲区间\n`;
                    if (lyrics) audioSection += `歌词:\n${lyricsPromptText}\n`;
                }

                const materialBullet = hasAssets ? '- 使用的素材（图N。只引用上方素材列表里存在的素材，不涉及的镜头省略此项）\n' : '';
                // 参考図なし版は「外見的特徴で示すこと」だけだと多カット間の容姿一貫性を何も
                // 保証していない——冒頭カットで容姿を確立し全カットで一貫させる要求を同じ文に流し込む
                // （図N機制がある版は既にそれで一貫性が担保されているため一字も変えない）
                const characterRefRule = hasAssets
                    ? '- 影像描述中不要直接写角色名。指代人物时用“图N的人物”或外貌特征来表示\n'
                    : '- 影像描述中不要直接写角色名。指代人物时用外貌特征表示，并在开头的镜头里确立其外貌（发型·服装的要点），此后所有镜头保持同一外貌\n';
                const compositionFreedomRule = hasAssets
                    ? '- 参考图只是外貌的参照，构图可按演出意图自由决定。开头镜头不必是立绘式的正面构图——侧脸·背影·远景·局部特写等，选那一瞬间演出效果最好的构图\n'
                    : '';
                // 時間配分は「## 尺」に一元化（参考音声の時長と duration 選択が食い違う場合に矛盾指示を出さない）
                const lyricsRule = hasLyrics
                    ? `- 歌词不是台词，绝对不要放进「」。镜头切换尽量对齐歌词行与行的分界，每个镜头的画面呼应对应歌词的意象（具体或隐喻均可）。时间分配遵循上方的时长${lyricsTimedRuleExtra}\n`
                    : '';
                // 見せ場の骨架意識：「必ず入れるべきカット」として義務化せず引き出しとして添える——
                // 演出タイプ卡（OP/ED/挿入歌など）やユーザーの seedText と矛盾する場合はそちらが優先
                const showcaseRule = '- 注意PV应有的看点（人物面孔清晰可见的镜头、或眼睛·手·脚等身体局部的情绪特写、定格的决胜画）。与演出类型或用户方向性不合时，以后者优先\n';
                // 画风锚（六期）：'' (不指定) 或未知 key 时 artStyleAnchor 为空，下面四个变量全部落空字符串，
                // systemPrompt 与改动前一字不差。cel（默认）等已知画风时，概述/整体氛围两行都要求带锚句原文，
                // ## 规则也补一条硬性要求（检品 _pvPolishStoryboard 同步加一项校验）
                const artStyleOverviewSuffix = artStyleAnchor ? `，句末必须附上这句画风锚句原文：${artStyleAnchor}` : '';
                const artStyleMoodSuffix = artStyleAnchor ? `，句末必须附上同一句画风锚句原文：${artStyleAnchor}` : '';
                const artStyleRule = artStyleAnchor ? `- 整体氛围一行必须写明画风锚句：${artStyleAnchor}\n` : '';
                // 手部精细交互/大幅度连贯动作容易变形（真实MV实战观察）——常驻规则、不依赖任何卡片或选项，
                // 与 styleMenuRule 同型的缓和句式（可以…也不妨…），不强制拆镜，只给出口
                const handInteractionRule = '- 复杂的手部精细交互、大幅度的连贯动作容易变形，可以拆成更短的镜头，或改为定格+镜头推进、局部特写\n';
                // 音響設計：modelInfo.audio は _pvModelInfo() が具体的な model id で判定済み
                // （ark は 1.0系のみ無声、H3 は恒有声、minimax_v1 は全系無声）——有声モデルにだけ注入し、
                // 無声モデルではプロンプトが改修前と一字一句変わらないようにする
                const soundSection = modelInfo.audio
                    ? '\n## 声音设计\n- 每个镜头末尾视需要补一句环境音·动作音效\n- 注意音乐性的起伏：高潮镜头做足声势，高潮前的一瞬静默与结尾的余韵也是演出手段\n'
                    : '';

                // 4刀：seedText の三態（空／短中=方向性のヒント／長文=原作選段モード）。
                // isExcerptMode は _pvPolishStoryboard 側にも ctx で渡し、検品 checklist の①判定を分岐させる
                const isExcerptMode = seedText.length >= this._PV_EXCERPT_THRESHOLD;
                let seedSection = '';
                if (seedText && isExcerptMode) {
                    // 長文（原作選段モード）：全文を通読させ、尺に合う一場面だけを選ばせる。
                    // 選定結果は絵コンテ本文の前に「選定場面：〜」一行だけ許可する（出力形式側にも例外を反映）
                    seedSection = `\n## 原作文本（从中选取一个场面）\n${seedText}\n把全文在${duration}秒内全部影像化是不够的。请先通读全文，按「有视觉上的动感／有情感的高峰／在单一地点·时间内完结／不需要前后文说明也能看懂」的标准，选出最能出效果的一个场面。在分镜正文之前单独写一行“选定场面：〜”，只把这个场面分镜化。原作中的台词尽量使用原文原句（保持原文的语言，此规则优先于台词语言设定）。\n`;
                } else if (seedText) {
                    // 短中文：方向性の意図を核に、設定と矛盾しない範囲でディテールを補って尺を満たす（捏造とは別軸の要求）
                    seedSection = `\n## 用户已想好的方向性\n${seedText}\n用户的方向性较短时，以其意图为核心，在不与作品世界矛盾的范围内，把场面细节（地点·时间段·光线·小道具·人物举止）具体化以填满时长。不得发明设定中不存在的事件·角色·关系。\n`;
                }
                const outputFormatIntro = isExcerptMode
                    ? '不要添加说明文或标题，只输出分镜正文（第一行“选定场面：〜”、第二行“概述：〜”与结尾的“整体氛围：〜”一行是格式的一部分，必须保留）。'
                    : '不要添加说明文或标题，只输出分镜正文（开头的“概述：〜”一行与结尾的“整体氛围：〜”一行是格式的一部分，必须保留）。';

                const systemPrompt = `你是这部番剧的${directorIdentity}。你不是撰写提示词的助手，而是基于以下作品世界、实际负责画面判断的主创。请为视频生成AI撰写分镜（多个镜头的演出台本）。分镜的画面·动作·运镜描述一律用中文书写；「」内的台词·旁白一律用${langInfo.name}书写。

## 作品世界信息
${worldContext || '（世界观未设定——不得捏造角色名·CP·故事事件等具体作品信息。按一般的动画PV来构成）'}
${Utils.PROMPTS.infoAccessRule()}
${typeof Utils !== 'undefined' && Utils.getEventContextPrompt ? Utils.getEventContextPrompt(eventLimit) : ''}
${assetSection}${audioSection}${seedSection}
## 时长
总计 ${duration} 秒

## 输出格式（严格遵守）
${outputFormatIntro}按「镜头1（0-4秒）」「镜头2（4-8秒）」的格式，起止秒数连续、总和为${duration}秒，分成${cutRange}个镜头。正文第一行写“概述：〜”——用一句话概括整体（主体+地点+事件+风格）${artStyleOverviewSuffix}；正文最后一行写“整体氛围：〜”——贯穿全片的画风·色调·光线·画质${artStyleMoodSuffix}。每个镜头按下列四项撰写：
${materialBullet}- ①主体外观指代：${hasAssets ? '图N 的人物' : '用外貌特征指代的人物'}在这一镜穿什么·拿什么·道具在哪只手（没有道具时省略道具部分）
- ②2〜3个单向推进的动作，按秒落在该镜头的时间区间内，与相邻镜头首尾相接、区间连续不留空当（一个完整动作也可以拆到相邻的几个镜头（如3〜4个）里各给一个局部·景别——脚→手→脸，或局部特写→象征物→全景反应——不必每镜自成一次完整表演）
- ③摄影机运动或固定机位，二选一：固定机位时写清画面内部靠什么在变化（表情·光效·衣摆发丝·叠化·剪影转实体等）；摄影机运动（推·拉·摇·移·跟等）优先留给情绪转折·顶点·揭示的瞬间
- ④光线·色调·环境细节
- 镜末补一句“最后姿态定格：〜”，写清这一镜结束时人物的姿态，方便接续下一镜
- 只有台词·旁白才放进「」（钩括号）——音声生成模型只朗读「」内的文字，一律用${langInfo.name}书写
- 台词长度要与该镜头的秒数相称（${langInfo.pace}）
每镜密度参考：约100〜140字；全篇仍不超过下方的字数总上限。
${cinematographySection}${rhythmSection}${styleSection}${soundSection}
## 规则
- 不要写“静止”“保持原样”这类什么都不发生的镜头。固定机位是合法的默认选择，但画面里必须有在变化的东西（表情·光·衣摆发丝·内容的渐变）；真正的摄影机运动优先安排在情绪转折·顶点·揭示的瞬间，而不是每镜都动
- 单个镜头内部可以发生景别或构图的渐变·剧变（同一镜头从远景推进到特写、从虚焦到实焦），这是不切镜头也能制造推进感的手法
- 动作必须单向推进。不要写“迈出一步又收回”这类往复·回退的动作
- 情绪要通过身体动作·表情·画面营造来呈现。不要直接写“悲伤”“开心”等抽象情感词
- 场景中按剧情应有人物时，不得用纯道具·空镜代替人物；群像场面用概括性的群体动作描写（例：一群少女随乐声起舞、衣袖翻飞）。人物只以局部（眼睛·手·脚）入镜、或被压到画面很小的比例，仍算保留了主体；群像可以短暂处理成静止的背影·剪影作为氛围过渡，但那不是群像的默认呈现方式。空镜只在有明确演出意图时使用（段落开头定调、段落间呼吸、新场景·新道具登场、高潮前的蓄力凝视等），不打断叙事高潮的中段
- 允许连续几个镜头完全没有「」台词，只靠画面推进情绪；不必为了不留白而每镜塞一句
${characterRefRule}${compositionFreedomRule}${lyricsRule}${artStyleRule}- 全篇以${charBudget}字以内为准
${showcaseRule}${handInteractionRule}- 🚫 不得捏造设定中不存在的角色·故事`;

                const messages = [{ role: 'user', content: '请写分镜。' }];
                let raw = (await Utils.callChatAPI(messages, systemPrompt) || '').trim();

                if (polish) {
                    if (label) label.textContent = I18n.t('nico.pv_ai_polishing', '推敲中…');
                    raw = await this._pvPolishStoryboard(raw, { duration, hasAssets, assetLines, hasLyrics, lyrics: lyricsPromptText, charBudget, isExcerptMode, seedText, langInfo, artStyleAnchor });
                }

                textarea.value = raw;
                // 分镜图「生成」按钮の可否を再判定（六期 P1）：value を直接書き込むだけだと input イベントが
                // 発火しないので、textarea の oninput ハンドラだけに頼るとここが漏れる
                if (this._pvUpdateFramesBtnState) this._pvUpdateFramesBtnState();
            } catch (e) {
                console.error('[Niconico] PV AI write error:', e);
                Utils.showToast(I18n.t('t.nico_gen_error', '⚠️ 生成エラー: ') + e.message, 4000);
            } finally {
                if (btn) btn.disabled = false;
                if (label) label.textContent = I18n.t('nico.pv_ai_write_btn', 'AIにおまかせ');
            }
        }, () => Utils.showToast(I18n.t('nico.pv_ai_writing', '生成中…')));
    },

    // 推敲：分镜生成后的可选检品通道。用「制作进行」这一干净人格只修正违规之处——不传世界观全文
    // （检品不需要，节省 token）。ctx 沿用 _pvAiWrite 已经拼好的值。2026-08-23 中文化：产出与检品 prompt
    // 均改中文书写，新增⑩对照用户方向性抓主体丢失（对症カット2 事故：群像被压缩成静物道具）
    async _pvPolishStoryboard(storyboard, ctx) {
        const { duration, hasAssets, assetLines, hasLyrics, lyrics, charBudget, isExcerptMode, seedText, langInfo, artStyleAnchor } = ctx;
        const assetSection = hasAssets ? `\n## 素材列表\n${assetLines.join('\n')}\n` : '';
        const lyricsSection = hasLyrics ? `\n歌词:\n${lyrics}\n` : '';
        const item5 = hasAssets ? '没有直写角色名（只用图N·外貌特征指代）' : '没有直写角色名（用外貌特征指代）';
        const item7 = hasAssets ? '没有添加素材列表之外的人物·明显突兀的专有名词' : '没有添加对作品而言明显突兀的专有名词';
        // ⑩（2026-08-23）：只在「方向性」形态且有 seedText 时启用——对照用户构想抓主体丢失
        //（群像被简化成静物一类）。选段模式不传全文（token 考量），⑩不出现
        const hasSeedCheck = !!(seedText && !isExcerptMode);
        const item10 = hasSeedCheck ? ' ⑩对照下方用户的方向性，关键的画面主体·事件没有丢失、没有被道具或空镜替代（群像短暂处理成静止背影·剪影作为氛围过渡不算丢失，但不能通篇如此）' : '';
        const seedSectionForPolish = hasSeedCheck ? `\n## 用户的方向性（⑩的对照基准）\n${seedText}\n` : '';
        // ⑪⑫⑬（六期，2026-09-18）：来自一支原创MV实战三版对比——动作按秒落位、手部道具关系、
        // 人物形态不超出参考图范畴，三条均常驻（不依赖任何选项）。⑬按有无参考图分两套措辞，同 item5/item7 的姿势
        const item11 = '⑪每个镜头都有按秒落位的动作，秒数区间连续无空当';
        const item12 = '⑫手与道具的关系明确、同一镜头内没有互相矛盾的动作；复杂的手部精细交互或大幅度连贯动作已拆解为定格+镜头推进或局部特写';
        const item13 = hasAssets
            ? '⑬人物的年龄·发型·服装没有超出图N的范畴，超出的形态已改为不露脸的手·背影·剪影，或拉回立绘'
            : '⑬外貌已在开头镜头确立并全程一致';
        // ⑭（六期）：只在选了具体画风锚时启用，同 item10 的姿势——字符串自带前导空格，空值时不留多余空格
        const item14 = artStyleAnchor ? ` ⑭整体氛围一行写明了画风锚句原文：${artStyleAnchor}` : '';
        const excerptNote = isExcerptMode
            ? '※第一行“选定场面：〜”也是格式的一部分，不得删除，①的秒数检查同样不包含该行。'
            : '';

        const systemPrompt = `你是这部番剧的制作进行。请对照检查清单检验以下分镜，只对违规之处做最小限度的修正，输出修正后的完成稿。没有问题就原样输出。只输出分镜正文。

## 检查清单
①秒数连续且总和与时长一致 ②每个镜头的画面里都有在变化的东西（固定机位时是画面内部的变化，运动镜头时是明确的摄影机运动），没有“静止·保持原样”的死镜头 ③动作单向推进 ④没有直写抽象情感词 ⑤${item5} ⑥歌词没有被放进「」 ⑦${item7} ⑧全篇${charBudget}字以内 ⑨台词长度与镜头秒数相称（${langInfo.pace}）${item10} ${item11} ${item12} ${item13}${item14}
※开头的“概述：〜”一行与结尾的“整体氛围：〜”一行是格式的一部分，不得删除；①的秒数检查不包含这些行。${excerptNote}

## 时长
总计 ${duration} 秒
${assetSection}${lyricsSection}${seedSectionForPolish}
## 待检分镜
${storyboard}`;

        const messages = [{ role: 'user', content: '请检品。' }];
        const raw = await Utils.callChatAPI(messages, systemPrompt);
        return (raw || '').trim() || storyboard;   // 空应答保底不变
    },
});
