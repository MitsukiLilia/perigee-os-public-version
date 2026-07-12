// 世界观上下文 — 全项目「平台 API」（v2.194.0 从 js/forum.js 抽出，架构报告 P1-⑦）
// 消费方：forum/twitter/weibo/lofter/magazine/melonbooks/niconico/pixiv-novel/mercari/wandoro/video-gen/line
// 兼容别名 Forum.getWorldContext() 永久保留（转发到这里）；新代码请直接调 WorldContext.get()
// 运行时依赖：AppState / Utils.getActiveWorldBookIds / Forum._getNpcLabel / OFFICIAL_CATEGORIES（forum.js 顶部 const，
// 跨脚本共享全局词法环境）——均为调用时才解引用，本文件虽先于 forum.js 加载亦安全（首次调用远在两者执行完之后）
const WorldContext = {
    get() {
        const data = AppState.data.forumData;
        let context = '';
        if (AppState.data.broadcast.worldSetting) context += `【世界观设定】\n${AppState.data.broadcast.worldSetting}\n\n`;
        const _wbIds = Utils.getActiveWorldBookIds();
        _wbIds.forEach(wbId => {
            const book = (AppState.data.worldBooks || []).find(b => b.id === wbId);
            if (book && book.entries) {
                context += `【世界书「${book.name}」】\n`;
                book.entries.filter(e => e.enabled !== false).forEach(e => { context += `[${e.title}] ${e.content}\n`; });
                context += '\n';
            }
        });
        if (data.forumRules) context += `【论坛规则】\n${data.forumRules}\n\n`;

        const plotProgress = AppState.data.broadcast.plotProgress || [];
        const officialInfo = AppState.data.broadcast.officialInfo || [];
        const mergedSummaries = AppState.data.broadcast.mergedSummaries || [];
        // 旧字段向前兼容
        const plotSummaries = AppState.data.broadcast.plotSummaries || [];
        const officialSummaries = AppState.data.broadcast.officialSummaries || [];

        if (!plotProgress.length && !officialInfo.length && !mergedSummaries.length && !plotSummaries.length && !officialSummaries.length) {
            return context;
        }

        // ── 合并时间线 ──────────────────────────────────────────────
        context += `【剧情与情报时间线（按事件顺序）】\n`;
        context += `⚠️ 重要说明：\n`;
        context += `- 时间线严格按顺序排列；官方情报标注了其发布节点（在某话之后）\n`;
        context += `- 若情报内容提及"即将播出X / 先行放送 / 预计发布"等，表示粉丝知道"X即将来临"，但X的具体内容尚不存在于时间线中，禁止捏造X的内容\n`;
        context += `- 官方情报（如贺图、周边、访谈）是在其标注的剧情节点之后才发布的，不能将其视为伏笔或提前知晓的信息\n\n`;

        // 已覆盖 ID 集合（合并总结 + 旧字段兼容）
        const plotCoveredSet = new Set([
            ...mergedSummaries.flatMap(s => s.coveredPlotIds || []),
            ...plotSummaries.flatMap(s => s.coveredIds || [])
        ]);
        const offCoveredSet = new Set([
            ...mergedSummaries.flatMap(s => s?.coveredInfoIds || []),
            ...officialSummaries.flatMap(s => s.coveredIds || [])
        ]);

        // 较早的历史内容——已压缩为总结
        const hasSummaries = mergedSummaries.length > 0 || plotSummaries.length > 0 || officialSummaries.length > 0;
        if (hasSummaries) {
            context += `── 早期内容总结（已压缩）──\n`;
            mergedSummaries.forEach((s, i) => {
                const titleList = (s.titleIndex || []).join('、') || `共${(s.coveredPlotIds || []).length}条剧情`;
                context += `[综合总结·第${i + 1}期（涵盖：${titleList}）]\n${s.content}\n\n`;
            });
            // 旧字段兼容输出
            plotSummaries.forEach((s, i) => {
                const titleList = (s.titleIndex || []).join('、') || `共${s.coveredIds.length}条`;
                context += `[剧情总结·第${i + 1}期（涵盖：${titleList}）]\n${s.content}\n\n`;
            });
            officialSummaries.forEach((s, i) => {
                const titleList = (s.titleIndex || []).join('、') || `共${s.coveredIds.length}条`;
                context += `[情报总结·第${i + 1}期（涵盖：${titleList}）]\n${s.content}\n\n`;
            });
            // ⚠️ 关键提示：总结内的所有事件均为已发生历史事实
            context += `⚠️ 【重要】上述总结所涵盖的全部剧情均为【已播出/已发生】的历史事实，所有官方情报均为【已公开发布】的真实内容。论坛NPC在讨论时必须将这些事件视为早已发生过的历史——禁止出现"期待播出""何时动画化""希望官方能做"等与已发生事件相矛盾的说法。\n\n`;
            context += `── 近期详细内容 ──\n\n`;
        }

        const remainingPlot = plotProgress.filter(p => !plotCoveredSet.has(p.id));
        const remainingOfficial = officialInfo.filter(e => !offCoveredSet.has(e.id));

        // 辅助：生成情报的来源标签（含 NPC 归属）
        const _entryLabel = (e) => {
            const cat = OFFICIAL_CATEGORIES[e.category] || { label: e.category };
            let npcPart = '';
            if (e.category === 'twitter' && e.sourceNpcId) {
                const lbl = Forum._getNpcLabel([e.sourceNpcId]);
                if (lbl) npcPart = `·${lbl}`;
            } else if (e.category === 'interview' && e.sourceNpcIds?.length) {
                const lbl = Forum._getNpcLabel(e.sourceNpcIds);
                if (lbl) npcPart = `·${lbl}`;
            }
            return `${cat.labelJa || cat.label}${npcPart}`;
        };

        // title 为空时用内容前 20 字代替
        const _entryTitle = (e) => e.title || (e.content.slice(0, 20) + (e.content.length > 20 ? '…' : ''));

        // 结构化周边：在 content 前多输出一行属性标签；旧式周边（无 goods 块）返回空串
        const _goodsAttrLine = (e) => {
            if (e.category !== 'goods' || !e.goods) return '';
            const g = e.goods;
            const parts = [`类型:${g.type}`];
            if (g.blindBox) {
                const n = (g.charNames || []).length;
                parts.push(`形式:盲盒(ブラインド・全${n}種ランダム、推し以外も混入)`);
                parts.push(`単価:¥${g.price}`);
                if (g.boxPrice) parts.push(`BOX:¥${g.boxPrice}`);
            } else {
                parts.push(`价格:¥${g.price}`);
            }
            parts.push(`稀缺度:${g.rarity}`, `状态:${g.status}`);
            if (g.source) parts.push(`来源:${g.source}`);
            return `   ${parts.join('｜')}\n`;
        };

        if (remainingPlot.length === 0 && !hasSummaries) {
            // 真的还没有任何剧情（预热期）：所有官方情报直接平铺
            remainingOfficial.forEach(e => {
                context += `[官方情报·${_entryLabel(e)}]《${_entryTitle(e)}》\n${_goodsAttrLine(e)}${e.content}\n\n`;
            });
        } else if (remainingPlot.length === 0 && hasSummaries) {
            // 全部剧情已总结，剩余情报紧接总结之后输出
            if (remainingOfficial.length > 0) {
                context += `── 总结后新增情报 ──\n`;
                remainingOfficial.forEach(e => {
                    context += `[官方情报·${_entryLabel(e)}]《${_entryTitle(e)}》\n${_goodsAttrLine(e)}${e.content}\n\n`;
                });
            }
        } else {
            // 剧情开始前的官方情报（afterPlotId 为空 = 时机不明/早期）
            const prePlot = remainingOfficial
                .filter(e => !e.afterPlotId)
                .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            if (prePlot.length > 0) {
                context += `── 剧情开始前 ──\n`;
                prePlot.forEach((e, idx) => {
                    const seqLabel = prePlot.length > 1 ? ` 第${idx + 1}弾` : '';
                    context += `[官方情报·${_entryLabel(e)}]《${_entryTitle(e)}》${seqLabel ? `（${seqLabel}）` : ''}\n${_goodsAttrLine(e)}${e.content}\n\n`;
                });
            }

            // 将剧情条目与其后的官方情报交织输出
            remainingPlot.forEach(plot => {
                context += `--- ${plot.title} ---\n${plot.content}\n\n`;
                // 按 timestamp 升序排列，确保 AI 知道先后顺序
                const afterThis = remainingOfficial
                    .filter(e => e.afterPlotId === plot.id)
                    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                afterThis.forEach((e, idx) => {
                    const seqLabel = afterThis.length > 1 ? ` 第${idx + 1}弾` : '';
                    context += `  ↳ [官方情报·${_entryLabel(e)}]《${_entryTitle(e)}》（${plot.title}播出後${seqLabel}）\n${_goodsAttrLine(e)}${e.content}\n\n`;
                });
            });

            // 孤儿情报兜底：afterPlotId 有值，但指向的剧情已被总结覆盖（不在 remainingPlot 中），
            // 既进不了「剧情开始前」也匹配不到任何交织节点，防止被静默丢弃
            const remainingPlotIds = new Set(remainingPlot.map(p => p.id));
            const orphanOfficial = remainingOfficial
                .filter(e => e.afterPlotId && !remainingPlotIds.has(e.afterPlotId))
                .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            if (orphanOfficial.length > 0) {
                context += `── 历史剧情节点之后新增情报 ──\n`;
                orphanOfficial.forEach((e, idx) => {
                    const seqLabel = orphanOfficial.length > 1 ? ` 第${idx + 1}弾` : '';
                    context += `[官方情报·${_entryLabel(e)}]《${_entryTitle(e)}》${seqLabel ? `（${seqLabel}）` : ''}\n${_goodsAttrLine(e)}${e.content}\n\n`;
                });
            }
        }

        context += `【当前讨论范围】请根据以上时间线内容生成讨论。NPC们应该：\n`;
        context += `- 只知道时间线中已明确记录的剧情与情报内容\n`;
        context += `- 各官方情报在其标注的剧情节点之后才被粉丝所知\n`;
        context += `- 若时间线末尾出现"预告/即将放送"类情报，NPC可以期待、猜测，但不能知道其实际内容\n`;
        context += `- ⚠️ 动画演出 ≠ 角色认知：剧情描述是面向观众的叙事（包含回忆画面、旁白、闪回、蒙太奇等演出手法）。角色只知道自己在故事中实际获得的信息——例如角色A看角色B的日记，观众看到了配合日记内容的过去影像回闪，但角色A只是在读日记文字，并没有"看到"那些过去的画面。讨论时必须区分"观众通过演出了解到的信息"和"角色本人实际知道的信息"\n`;
        context += `- ⚠️ 强弱/胜负/能力对比：时间线中明确记录的强弱关系、胜负结果是不可动摇的事实，讨论时必须按原文描述，禁止"平衡化"（如把"A轻松击败B"演绎成"势均力敌"），禁止基于角色性别、体型做任何强度预设\n\n`;

        return context;
    },
};
window.WorldContext = WorldContext;
