// 生贺系统 — 纪念日窗口相位计算 + WorldContext 注入段（v2.205.0 可玩性A档）
// 唯一权威源：日历条目（AppState.data.calendarEvents）的「圈内过节」相位判定都从这里出。
// 消费方：WorldContext.get()（全模块渗透注入）、Twitter._generateFandomEvent()（企画闸门）。
// 与 Widgets._getUpcomingEvents() 的月×30 近似算法刻意独立——那边是 30 天列表展示用途，
// 这边是 ±3 日精确相位，精度要求不同，不合并、不动它。
// 设计正本：docs/superpowers/specs/2026-07-14-anniversary-system-design.md
const Anniversary = {
    // "月/日" → 距最近一次出现的有符号天数差（过去为负、未来为正）。null = 日期非法。
    // 2/29 在平年按 2/28 庆祝（圈内惯例）。6/31 这类溢出日期视为非法。
    _daysUntilNearest(dateStr, now) {
        const parts = String(dateStr || '').split('/').map(Number);
        if (parts.length !== 2 || !Number.isInteger(parts[0]) || !Number.isInteger(parts[1])) return null;
        const m = parts[0], d = parts[1];
        if (m < 1 || m > 12 || d < 1 || d > 31) return null;
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const candidates = [];
        for (const yOff of [-1, 0, 1]) {
            const y = today.getFullYear() + yOff;
            const dd = (m === 2 && d === 29 && !this._isLeap(y)) ? 28 : d;
            const t = new Date(y, m - 1, dd);
            if (t.getMonth() !== m - 1) return null; // 日期溢出到下月 → 整条非法
            candidates.push(Math.round((t - today) / 86400000));
        }
        return candidates.reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a));
    },

    _isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; },

    // 窗口内事件：[{name, date, daysUntil, phase}]
    // phase: 'preheat'（1-3日前）| 'day'（当天）| 'afterglow'（昨天）；窗外/非法不返回。
    // 排序：|daysUntil| 升序（day 最前，prompt 里主次分明），同值保持输入序（稳定排序）。
    getActive(now = new Date()) {
        const out = [];
        (AppState.data.calendarEvents || []).forEach(ev => {
            const du = this._daysUntilNearest(ev.date, now);
            if (du === null) return;
            let phase = null;
            if (du === 0) phase = 'day';
            else if (du >= 1 && du <= 3) phase = 'preheat';
            else if (du === -1) phase = 'afterglow';
            if (phase) out.push({ name: ev.name, date: ev.date, daysUntil: du, phase });
        });
        return out.sort((a, b) => Math.abs(a.daysUntil) - Math.abs(b.daysUntil));
    },

    // WorldContext 注入段（日文 prompt，与全项目 prompt 语言一致）。
    // 无窗口内事件 → ''（零 prompt 开销）。真实性分寸写死在话术里：誕生日官方也下场、
    // CP 記念日纯同人自发（官方一切不言及）、作品周年两边都动——类型判断交给 LLM 从条目名理解。
    getContextSection(now = new Date()) {
        const active = this.getActive(now);
        if (!active.length) return '';
        let s = '【本日・近日の記念日】\n';
        active.forEach(ev => {
            if (ev.phase === 'day') {
                s += `- 本日は【${ev.name}】当日。SNS・掲示板・二次創作コミュニティはお祝いムードが最高潮（ただし通常の話題も混在し、全投稿がお祝い一色にはならない）。\n`;
            } else if (ev.phase === 'preheat') {
                s += `- 【${ev.name}】まであと${ev.daysUntil}日。ファンの間では企画告知やカウントダウンが始まっている。\n`;
            } else {
                s += `- 昨日は【${ev.name}】だった。タグまとめ・余韻・見逃した組の反応が見られる。\n`;
            }
        });
        s += '記念日の種類による振る舞いの違い（重要）:\n';
        s += '- キャラの誕生日 → 公式も動く（公式生誕イラスト・キャストの祝いツイート等）+ ファンの生誕祭タグ\n';
        s += '- カップリング（CP）記念日 → ファン発の文化。公式は一切言及しない（公式がCPを公認することはない）\n';
        s += '- 作品の周年・放送開始日 → 公式・ファン両方が祝う\n\n';
        return s;
    },
};
window.Anniversary = Anniversary;
