// 工具模块 - 包含数据持久化和API调用功能

// ── Schema 迁移注册表 ──
// 记账字段：AppState.data._v（loadData 里由 Utils._runMigrations 按 v 升序执行所有 v > 当前 的条目，
// 与数组书写顺序无关——执行前会按 v 排序一份副本，未来 append 顺序不慎与 v 值错位也不会被静默跳过）
// 铁律：
//   ① 只 append 新条目、禁止修改/删除历史条目
//   ② 每个迁移的 run() 必须自带幂等守卫（检测数据形状/标志位）——四个导入路径
//      （Utils.importData / GithubBackup.handleRestore / DataExport._performImport / Forum.importForumData）
//      会把 _v 重置为 0 触发全量重跑：分板块导入可能往新 _v 的树里塞旧结构板块数据，
//      只有「全量重跑 + 各条幂等」才能兜住这种局部旧数据
//   ③ run() 里不要自行 Utils.saveData()，执行器跑完统一落盘一次
const MIGRATIONS = [
    {
        v: 1,
        desc: 'v2.60 放送局重构：slots 扁平化 + broadcast 抽离 + officialPosts 并入 threads',
        run(data) {
            // 幂等守卫：forumData 残留旧字段 或 forumSlotsMeta 存在（即 v2.59 及更早的数据形状）才动手
            const _fd = data.forumData || {};
            const _hasLegacy = (_fd.worldSetting !== undefined)
                || (_fd.plotProgress !== undefined)
                || (_fd.officialInfo !== undefined)
                || (_fd.officialNpcs !== undefined)
                || (_fd.officialPosts !== undefined)
                || (data.forumSlotsMeta !== undefined && data.forumSlotsMeta !== null);
            if (!_hasLegacy) return;

            // 1. 扁平化多板块：取 currentForumSlotId 对应的 archive 作为唯一 forumData
            if (data.forumSlotsArchive && data.currentForumSlotId) {
                const _active = data.forumSlotsArchive[data.currentForumSlotId];
                if (_active && typeof _active === 'object') {
                    data.forumData = _active;
                }
            }
            delete data.forumSlotsMeta;
            delete data.forumSlotsArchive;
            delete data.currentForumSlotId;

            const fd = data.forumData || (data.forumData = {});

            // 2. broadcast 字段抽离
            data.broadcast = {
                worldSetting: fd.worldSetting || '',
                worldBookId: fd.worldBookId || '',
                worldBookIds: Array.isArray(fd.worldBookIds) && fd.worldBookIds.length
                    ? fd.worldBookIds
                    : (fd.worldBookId ? [fd.worldBookId] : []),
                plotProgress: Array.isArray(fd.plotProgress) ? fd.plotProgress : [],
                plotDrafts: Array.isArray(fd.plotDrafts) ? fd.plotDrafts : [],
                officialInfo: Array.isArray(fd.officialInfo) ? fd.officialInfo : [],
                officialNpcs: Array.isArray(fd.officialNpcs) ? fd.officialNpcs : [],
                mergedSummaries: Array.isArray(fd.mergedSummaries) ? fd.mergedSummaries : [],
                plotSummaries: Array.isArray(fd.plotSummaries) ? fd.plotSummaries : [],
                officialSummaries: Array.isArray(fd.officialSummaries) ? fd.officialSummaries : [],
                seriesEnded: typeof fd.seriesEnded === 'boolean' ? fd.seriesEnded : false   // v2.126.0 完結フラグ（ワンドロ 完結後ペース切替；未定義は falsy=連載中）
            };

            // 3. 旧 officialPosts → 合并进 threads（按 timestamp 倒序）
            if (Array.isArray(fd.officialPosts) && fd.officialPosts.length > 0) {
                if (!Array.isArray(fd.threads)) fd.threads = [];
                fd.threads = [...fd.officialPosts, ...fd.threads]
                    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            }

            // 4. 从 forumData 删抽走的字段
            ['worldSetting', 'worldBookId', 'worldBookIds',
             'plotProgress', 'plotDrafts',
             'officialInfo', 'officialNpcs', 'officialPosts',
             'mergedSummaries', 'plotSummaries', 'officialSummaries']
                .forEach(k => delete fd[k]);
        }
    },
    {
        v: 2,
        desc: 'v2.128 一次性去重：修复链路A 历史重复自宣',
        run(data) {
            // 链路B 生成的小说曾漏进链路A 反查池被反复自宣 → 同一 pixivNovelId 出现多条 fan 推。
            // 清掉冗余：点赞过的全留（回味用），否则只留最早一条（含链路B 原始安利推）。只碰 source==='fan'，npc 推不动。
            const _twd = data.twitterData;
            if (!_twd || _twd._dedupePromoV128) return;   // 幂等守卫：无 twitterData 或已打标
            const _tws = Array.isArray(_twd.npcTweets) ? _twd.npcTweets : [];
            const _likedIds = new Set((_twd.likedTweetIds || []).map(l => l.id));
            const _byNovel = {};
            _tws.forEach(tw => {
                if (tw && tw.source === 'fan' && tw.pixivNovelId) {
                    (_byNovel[tw.pixivNovelId] = _byNovel[tw.pixivNovelId] || []).push(tw);
                }
            });
            const _dropIds = new Set();
            Object.keys(_byNovel).forEach(nid => {
                const group = _byNovel[nid];
                if (group.length <= 1) return;   // 没重复
                const _liked = group.filter(tw => _likedIds.has(tw.id));
                const _keep = _liked.length
                    ? _liked   // 点赞过的全留
                    : [group.slice().sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))[0]];   // 否则留最早一条
                const _keepSet = new Set(_keep.map(tw => tw.id));
                group.forEach(tw => { if (!_keepSet.has(tw.id)) _dropIds.add(tw.id); });
            });
            if (_dropIds.size) {
                _twd.npcTweets = _tws.filter(tw => !_dropIds.has(tw.id));
                console.log(`[Migration v2.128] 链路A 重复自宣去重：清掉 ${_dropIds.size} 条冗余推文`);
            }
            _twd._dedupePromoV128 = true;
        }
    },
    {
        v: 3,
        desc: 'v2.190 pixiv 章节点赞档C建模：存量 novel 补 heatBase/virtualFc + 逐章 hearts + novel.hearts 改最高章缓存',
        run(data) {
            // 裸标识符 + typeof 守卫：顶层 const 不上 window（v2.187 教训），
            // 浏览器里 loadData 晚于全部模块脚本执行、必然已定义；node 单载 utils.js 时安全跳过
            if (typeof PixivNovel === 'undefined' || typeof Twitter === 'undefined') return;
            const novels = (data.pixivData || {}).novels;
            if (!Array.isArray(novels)) return;
            for (const novel of novels) {
                // 幂等守卫（逐本）：分板块导入旧备份把 _v 重置 0 全量重跑时，已迁移本子不重抽
                if (typeof novel.heatBase === 'number') continue;
                PixivNovel._initNovelPopularity(novel, data.twitterData);
            }
        }
    },
    {
        v: 4,
        desc: 'v2.223 桌面全网格化：free 模式退役（按视觉序回网格）+ cols 落地（存量=3 列，新档走 _ensureLayout 默认 4 列）',
        run(data) {
            const layout = data.desktopLayout;
            if (!layout || !Array.isArray(layout.pages)) return;          // 无桌面档：新档由 _ensureLayout 建、自带 cols
            if (layout.cols !== undefined && !layout.freeMode) return;    // 幂等守卫
            const C = 3;   // 存量档一律钉 3 列（桌面不动像素；想 4 列去设置里切）
            const wasFree = !!layout.freeMode;
            if (wasFree) {
                // free 档按「当前视觉位置」排序（y 主序、半行阈值内看 x），用户看到的排列不乱
                const PITCH = 0.13, TOP = 0.145;   // 旧 _freeY/_freeX 推导公式，坐标缺失时兜底
                const yOf = it => (typeof it.y === 'number' && !isNaN(it.y)) ? it.y
                    : Math.max(0.04, Math.min(0.96, TOP + (it.row || 0) * PITCH));
                const xOf = it => (typeof it.x === 'number' && !isNaN(it.x)) ? it.x
                    : Math.max(0.06, Math.min(0.94, ((it.col || 0) + (it.colSpan || 1) / 2) / C));
                for (const page of layout.pages) {
                    if (!Array.isArray(page.items)) continue;
                    page.items.sort((a, b) => {
                        const dy = yOf(a) - yOf(b);
                        return Math.abs(dy) > 0.045 ? dy : xOf(a) - xOf(b);
                    });
                }
            }
            delete layout.freeMode;
            // x/y 残留统一清掉（老版本 free→grid 来回切过的网格档也会带着）
            for (const page of layout.pages) {
                if (!Array.isArray(page.items)) continue;
                for (const it of page.items) { delete it.x; delete it.y; }
            }
            // 只有 free 档需要重排落进网格；非 free 档 col/row 原样保留——网格渲染是显式
            // col/row 定位，dock 去重自愈留下的空洞本来就合法（数组序 ≠ 视觉序，按数组序
            // reflow 会压洞、挪动 _ensure*Icon 补在洞里的图标，违背「存量桌面不动像素」）
            if (wasFree) {
                const widgets = Array.isArray(data.widgets) ? data.widgets : [];
                const spanOf = it => {
                    if (it.type !== 'widget') return 1;
                    const w = widgets.find(x => x.id === it.widgetId);
                    if (w) return w.size === 'wide' ? C : w.size === 'medium' ? 2 : 1;
                    return Math.max(1, Math.min(it.colSpan || 1, C));
                };
                for (const page of layout.pages) {
                    if (!Array.isArray(page.items)) continue;
                    let row = 0, col = 0;
                    for (const it of page.items) {
                        const span = spanOf(it);
                        if (span > 1 && col > 0) { row++; col = 0; }
                        it.col = col; it.row = row;
                        col += span;
                        if (col >= C) { col = 0; row++; }
                    }
                }
            }
            if (layout.cols === undefined) layout.cols = 3;
        }
    },
    {
        v: 5,
        desc: 'v2.240 视频生成 API 多渠道预设化：videoApiConfig 补 provider 字段（存量=ark）+ 初始化 videoApiPresets（存量单配置自动生成一条 "Seedance" 预设）',
        run(data) {
            // 幂等守卫：videoApiPresets 已存在 && videoApiConfig.provider 已存在 → 本迁移已跑过，不重复生成预设
            // （否则重跑会在用户手动删掉自动生成的 "Seedance" 预设后、下次分板块导入触发全量重跑时把它复活）
            const presetsExist = Array.isArray(data.videoApiPresets);
            const cfg = data.videoApiConfig;
            const providerExists = !!(cfg && typeof cfg === 'object' && cfg.provider);
            if (presetsExist && providerExists) return;

            if (!presetsExist) data.videoApiPresets = [];

            if (cfg && typeof cfg === 'object' && !cfg.provider) {
                cfg.provider = 'ark';   // 存量数据迁移前只有火山方舟一家
            }

            // 旧配置已填好 workerUrl+key 且当前没有任何预设 → 顺手转存一条，免得升级后设置页突然空着
            if (cfg && cfg.workerUrl && cfg.key && data.videoApiPresets.length === 0) {
                data.videoApiPresets.push({
                    id: 'vidp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                    name: 'Seedance',
                    provider: cfg.provider || 'ark',
                    workerUrl: cfg.workerUrl,
                    key: cfg.key,
                    model: cfg.model || ''
                });
            }
        }
    },
    {
        v: 6,
        desc: 'v2.249 小组件尺寸体系对齐 iOS 图标格：拍立得/相册/双人框/便签 size 重映射 + 桌面布局按新 span 归一化（重算 colSpan、钳位、消解重叠）',
        run(data) {
            // ── ① size 重映射：逐 widget 幂等守卫（已带 _sizeV3:true 的跳过；处理完打标）──
            // 只搬 4 类会变的 widget：polaroid(medium/wide→small) / photo(circle→mini, medium→wide) /
            // duoframe(medium→wide) / note(small→medium)。其余类型（clock/calendar/music/moonphase/
            // weather/news/charcard/notifhub/mercari）size 语义不变，原样打标即可。
            const widgets = Array.isArray(data.widgets) ? data.widgets : [];
            for (const w of widgets) {
                if (!w || w._sizeV3) continue;
                if (w.type === 'polaroid') {
                    if (w.size === 'medium' || w.size === 'wide') w.size = 'small';
                } else if (w.type === 'photo') {
                    if (w.shape === 'circle') w.size = 'mini';
                    else if (w.size === 'medium') w.size = 'wide';
                } else if (w.type === 'duoframe') {
                    if (w.size === 'medium') w.size = 'wide';
                } else if (w.type === 'note') {
                    if (w.size === 'small') w.size = 'medium';
                }
                w._sizeV3 = true;
            }

            // ── ② 布局归一化：按新 span 映射重算 widget item 的 colSpan，钳位越界 col，消解重叠 ──
            const layout = data.desktopLayout;
            if (!layout || !Array.isArray(layout.pages)) return;   // 无桌面档：新档由 _ensureLayout 建，自带正确 span
            const cols = layout.cols || 3;
            // 迁移是冻结快照：内联复刻 span 映射字面量，不引用外部 _widgetSpan
            // （desktop-edit.js 里那个函数未来若再改动，不该悄悄改变这条历史迁移的既定行为）
            const spanOf = size => {
                if (size === 'mini') return 1;
                if (size === 'wide' || size === 'large') return cols;
                if (size === 'small' || size === 'medium') return Math.min(2, cols);
                return 1;
            };
            const widgetSpan = it => {
                if (!it || it.type !== 'widget') return 1;
                const w = widgets.find(x => x.id === it.widgetId);
                return w ? spanOf(w.size) : Math.max(1, Math.min(it.colSpan || 1, cols));
            };

            for (const page of layout.pages) {
                if (!page || !Array.isArray(page.items)) continue;

                // 先重算所有 widget item 的 colSpan 并写回；越界的 col 先钳位（不改行，只收窄列起点）
                for (const it of page.items) {
                    if (it.type !== 'widget') continue;
                    const span = widgetSpan(it);
                    it.colSpan = span;
                    if (it.col + span > cols) it.col = Math.max(0, cols - span);
                }

                // 检测重叠、消解冲突：图标格先占座、图标永不动。
                // 两遍走：① 图标（不分先后，谁的坑都归谁，互不检测——合法数据里图标之间本就不重叠）
                // ② widget 按 row,col 序重放，与「已占座的格子（含全部图标 + 更早处理的 widget）」冲突
                //   就用类似 _findEmptyCell 的逐行扫描找第一个能放下 span 的空位，页内放不下就落到
                //   maxRow+1 新行。图标必须先于 widget 整体占座——否则同一行里 col 更小的 widget
                //   会在被处理时抢到本该属于后面某个图标的格子（图标此时还没来得及登记），产生静默重叠。
                const occupied = new Set();
                const occupy = (row, col, span) => {
                    for (let c = col; c < col + span; c++) occupied.add(`${row},${c}`);
                };
                const isFree = (row, col, span) => {
                    for (let c = col; c < col + span; c++) {
                        if (occupied.has(`${row},${c}`)) return false;
                    }
                    return true;
                };
                const currentMaxRow = () => {
                    let m = -1;
                    occupied.forEach(key => {
                        const r = parseInt(key.split(',')[0], 10);
                        if (r > m) m = r;
                    });
                    return m;
                };
                const findEmptyCell = span => {
                    const limit = currentMaxRow() + 2;   // 现有最大行 +1 行余量，找不到就说明这页放不下
                    for (let row = 0; row <= limit; row++) {
                        for (let col = 0; col + span <= cols; col++) {
                            if (isFree(row, col, span)) return { row, col };
                        }
                    }
                    return null;
                };

                for (const it of page.items) {
                    if (it.type === 'icon') occupy(it.row, it.col, 1);
                }
                const widgetItems = page.items.filter(it => it.type === 'widget')
                    .sort((a, b) => (a.row - b.row) || (a.col - b.col));
                for (const it of widgetItems) {
                    const span = widgetSpan(it);
                    if (isFree(it.row, it.col, span)) {
                        occupy(it.row, it.col, span);
                        continue;
                    }
                    const cell = findEmptyCell(span) || { row: currentMaxRow() + 1, col: 0 };
                    it.row = cell.row;
                    it.col = cell.col;
                    occupy(cell.row, cell.col, span);
                }
            }
        }
    },
    {
        v: 7,
        desc: 'v2.251 桌面网格改行单位制：小组件按 rowSpan 占据真实行列区域（2×2 组件旁边能放下 4 个图标）、'
            + '拖拽落点换算配套修复——存量档全部 items 按新装箱规则重打 col/row',
        run(data) {
            const layout = data.desktopLayout;
            if (!layout || !Array.isArray(layout.pages)) return;   // 无桌面档：新档由 _ensureLayout 建，自带正确装箱
            const cols = layout.cols || 3;
            const widgets = Array.isArray(data.widgets) ? data.widgets : [];

            // 迁移是冻结快照：内联复刻 colSpan/rowSpan 映射字面量，不引用 desktop-edit.js 的
            // _itemSpan/_itemRowSpan（那两个函数未来若再改动，不该悄悄改变这条历史迁移的既定行为，
            // 同 v6 注释）。mini:1×1／small:2×2／medium:2×(item._noteRowSpan||2)（仅 note 用得到
            // medium，其余类型走静态表）／wide:整行×2（profile 例外整行×3；duoframe 虽矮条仍整行×2，
            // 不是例外）／large:整行×4。
            const colSpanOf = it => {
                if (it.type !== 'widget') return 1;
                const w = widgets.find(x => x.id === it.widgetId);
                if (!w) return Math.max(1, Math.min(it.colSpan || 1, cols));
                if (w.size === 'mini') return 1;
                if (w.size === 'wide' || w.size === 'large') return cols;
                if (w.size === 'small' || w.size === 'medium') return Math.min(2, cols);
                return 1;
            };
            const rowSpanOf = it => {
                if (it.type !== 'widget') return 1;
                const w = widgets.find(x => x.id === it.widgetId);
                if (!w) return Math.max(1, it.rowSpan || 1);
                if (w.type === 'note') return it._noteRowSpan || 2;
                if (w.size === 'mini') return 1;
                if (w.size === 'small') return 2;
                if (w.size === 'medium') return 2;
                if (w.size === 'wide') return (w.type === 'profile') ? 3 : 2;
                if (w.size === 'large') return 4;
                return 1;
            };

            // 装箱是「items 数组顺序 + colSpan/rowSpan 映射」的纯函数：同一输入任意次重跑都产出
            // 同一套 col/row——这就是本迁移的幂等守卫，不需要额外的已处理标志位（同 desc 里
            // 「重打 col/row」的语义，历史迁移体本身不变，行为天然幂等）。
            for (const page of layout.pages) {
                if (!page || !Array.isArray(page.items)) continue;
                const occupied = new Set();
                const canPlace = (row, col, colSpan, rowSpan) => {
                    for (let r = row; r < row + rowSpan; r++) {
                        for (let c = col; c < col + colSpan; c++) {
                            if (occupied.has(r + ',' + c)) return false;
                        }
                    }
                    return true;
                };
                const markPlaced = (row, col, colSpan, rowSpan) => {
                    for (let r = row; r < row + rowSpan; r++) {
                        for (let c = col; c < col + colSpan; c++) occupied.add(r + ',' + c);
                    }
                };
                for (const it of page.items) {
                    const colSpan = Math.min(colSpanOf(it), cols);
                    const rowSpan = rowSpanOf(it);
                    let placed = null;
                    for (let row = 0; row < 100000 && !placed; row++) {
                        for (let col = 0; col + colSpan <= cols; col++) {
                            if (canPlace(row, col, colSpan, rowSpan)) { placed = { row, col }; break; }
                        }
                    }
                    if (!placed) placed = { row: 0, col: 0 };   // 防御性兜底，colSpan 已钳位理论不可达
                    it.col = placed.col;
                    it.row = placed.row;
                    markPlaced(placed.row, placed.col, colSpan, rowSpan);
                }
            }
        }
    },
    // ↑ 新迁移只在这里 append（v 递增），并遵守顶部铁律 ①②③
];

const Utils = {
    generateId: () => Date.now().toString(36) + Math.random().toString(36).substr(2),
    // parseFloat + 有限性兜底：v 解析为有限数则用之，否则 fallback（修「temperature 显式 0 被 || 吞成 0.7」）
    _num(v, fallback) { const n = parseFloat(v); return Number.isFinite(n) ? n : fallback; },
    // fire-and-forget：400+处调用无需改动
    // 300ms trailing debounce：连环调用只在末次 300ms 后真正落盘一次（序列化也推迟到落盘时，省掉中间几次全量 clone）
    _saveTimer: null,
    saveData() {
        clearTimeout(Utils._saveTimer);
        Utils._saveTimer = setTimeout(() => {
            Utils._saveTimer = null;
            Utils._saveNow();
        }, 300);
    },
    // 真正落盘：全量序列化 + 写 IndexedDB；返回的 promise 永远 resolve，值为 true/false 表示写入成败
    // （失败已内部 console + toast；显式保存按钮可据返回值决定要不要报「已保存」——别在写失败时报喜）
    _saveNow() {
        return localforage.setItem('PerigeeOS', JSON.parse(JSON.stringify(AppState.data)))
            .then(() => true)
            .catch(e => { console.error('[Save Error]', e); Utils.showToast('⚠️ 保存失败：' + e.message, 6000); return false; });
    },
    // 立即落盘（取消 pending 防抖，没有 pending 也照样写一次）
    // reload / 跳转前必须 await Utils.flushSave()，否则防抖窗口内的数据只在内存里
    flushSave() {
        if (Utils._saveTimer) { clearTimeout(Utils._saveTimer); Utils._saveTimer = null; }
        return Utils._saveNow();
    },
    // ── Schema 迁移执行器：按 data._v（缺省 0）顺序执行 MIGRATIONS 里所有 v > 当前 的条目 ──
    // 单条抛错：_v 停在上一条不推进、console.error、不阻断 loadData 其余流程；有推进才落盘（防抖版）
    _runMigrations() {
        const data = AppState.data;
        if (typeof data._v !== 'number' || !Number.isFinite(data._v)) data._v = 0;
        const from = data._v;
        // 按 v 升序执行，不依赖数组声明顺序：只排序副本，不改 MIGRATIONS 原数组本身
        const ordered = [...MIGRATIONS].sort((a, b) => a.v - b.v);
        for (const m of ordered) {
            if (m.v <= data._v) continue;
            try {
                m.run(data);
                data._v = m.v;
                console.log(`[Migration v${m.v}] ${m.desc} — 完成`);
            } catch (e) {
                console.error(`[Migration v${m.v}] ${m.desc} — 失败，_v 停在 ${data._v}`, e);
                break;
            }
        }
        if (data._v !== from) Utils.saveData();
    },
    // async：在 app.js DOMContentLoaded 里 await 一次
    async loadData() {
        try {
            // ── 数据迁移：localStorage → IndexedDB（只执行一次）──
            const legacy = localStorage.getItem('PerigeeOS');
            if (legacy) {
                const legacyData = JSON.parse(legacy);
                await localforage.setItem('PerigeeOS', legacyData);
                localStorage.removeItem('PerigeeOS');
                console.log('[Migration] localStorage → IndexedDB 完成，旧数据已清除');
            }
            // ── 从 localforage 加载 ──
            const saved = await localforage.getItem('PerigeeOS');
            if (saved) AppState.data = { ...AppState.data, ...saved };

            // ── Schema 迁移：按 _v 顺序执行注册表（条目见文件顶部 MIGRATIONS，含原 v2.60 / v2.128 两条）──
            Utils._runMigrations();
        } catch (e) {
            console.error('[Load Error]', e);
            // fallback：迁移失败时保底从 localStorage 读取
            try {
                const fallback = localStorage.getItem('PerigeeOS');
                if (fallback) {
                    AppState.data = { ...AppState.data, ...JSON.parse(fallback) };
                    setTimeout(() => Utils.showToast('⚠️ データベース読み込み失敗。旧バックアップから復元しました。'), 1000);
                } else {
                    setTimeout(() => Utils.showToast('⚠️ データ読み込みに失敗しました。設定からバックアップを確認してください。', 5000), 1000);
                }
            } catch (e2) {
                console.error('[Fallback Load Error]', e2);
                setTimeout(() => Utils.showToast('⚠️ データ読み込みに失敗しました。設定からバックアップを確認してください。', 5000), 1000);
            }
        }
    },
    scrollToBottom: (el) => setTimeout(() => el.scrollTop = el.scrollHeight, 50),

    // 动态注入 script（按需加载大库用，如 js/vendor/ 下的 xlsx/jszip）；同 src 并发/重复调用共享同一个 Promise
    _scriptPromises: {},
    loadScriptOnce(src) {
        if (!Utils._scriptPromises[src]) {
            Utils._scriptPromises[src] = new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = src;
                s.onload = () => resolve();
                s.onerror = () => {
                    // 失败清掉缓存，允许下次调用重试
                    delete Utils._scriptPromises[src];
                    s.remove();
                    reject(new Error(`脚本加载失败: ${src}`));
                };
                document.head.appendChild(s);
            });
        }
        return Utils._scriptPromises[src];
    },

    // ===== 并发锁 / ObjectURL 生命周期（v2.195.0，架构报告 P1-⑧）=====
    // withLock：同 key 异步任务互斥。锁被占时不排队、直接跳过并调 onBusy（对应「防连点」语义，
    // 与项目「刷新防呆通用解」一致：入口 guard + 按钮 disabled 用 isLocked 投影视觉态）。
    // finally 自动放锁——根治「_xxxRefreshing 忘复位」类 bug。返回 { ran, value }。
    _locks: new Set(),
    isLocked(key) { return Utils._locks.has(key); },
    async withLock(key, fn, onBusy) {
        if (Utils._locks.has(key)) {
            if (typeof onBusy === 'function') onBusy();
            return { ran: false };
        }
        Utils._locks.add(key);
        try {
            return { ran: true, value: await fn() };
        } finally {
            Utils._locks.delete(key);
        }
    },

    // trackBlobUrl / revokeBlobScope：ObjectURL 按 scope 登记、随视图关闭统一回收。
    // 用法：img.src = Utils.trackBlobUrl(URL.createObjectURL(blob), 'pv-preview');
    //       关闭弹窗时 Utils.revokeBlobScope('pv-preview')。
    _blobScopes: {},
    trackBlobUrl(url, scope) {
        if (!url) return url;
        if (!Utils._blobScopes[scope]) Utils._blobScopes[scope] = new Set();
        Utils._blobScopes[scope].add(url);
        return url;
    },
    revokeBlobScope(scope) {
        const set = Utils._blobScopes[scope];
        if (!set) return 0;
        let n = 0;
        set.forEach(url => { try { URL.revokeObjectURL(url); n++; } catch (e) { /* 已失效等，静默 */ } });
        delete Utils._blobScopes[scope];
        return n;
    },

    // 导出数据
    exportData() {
        const dataStr = JSON.stringify(AppState.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `perigee-os-backup-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('✓ Data exported successfully');
    },

    // 导入数据
    importData(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (confirm('This will replace all current data. Continue?')) {
                    AppState.data = { ...AppState.data, ...importedData };
                    AppState.data._v = 0;   // 导入可能带入旧结构数据：重置 _v，reload 后全量重跑迁移（各条自带幂等守卫，重跑无害）
                    await Utils.flushSave();   // 立即落盘（同时取消 pending 防抖）再刷新
                    alert('✓ Data imported successfully. Refreshing...');
                    location.reload();
                }
            } catch (err) {
                alert('✗ Import failed: Invalid file format');
                console.error('Import error:', err);
            }
        };
        reader.readAsText(file);
    },

    // 统一的 API 调用方法（确保 endpoint 正确）
    buildChatEndpoint(baseUrl) {
        let url = baseUrl.trim();
        while (url.endsWith('/')) url = url.slice(0, -1);

        // 如果已经包含 /chat/completions，直接返回
        if (url.endsWith('/chat/completions')) return url;

        // 如果包含 /v1，在后面加 /chat/completions
        if (url.endsWith('/v1')) return `${url}/chat/completions`;

        // 否则加 /v1/chat/completions
        return `${url}/v1/chat/completions`;
    },

    // SSE 流式响应兜底解析（v2.245·真机实锤 bug）：OpenAI 兼容两条路径（callChatAPI override / callOpenAICompatibleAPI）
    // 请求体已带 stream:false，但部分 API 服务对长生成仍会无视此项、强制按 `data: {...}\n\n` 分块吐 SSE，直接 res.json() 会
    // SyntaxError 崩溃。这里先按普通 JSON 解析；失败且文本形如 SSE 时逐行拼 delta，拼出与非流式响应同形状的
    // { choices: [{ message: { content } }] }，下游既有的 data.error / data.choices[0] 校验原样工作、不用改调用侧
    _parseChatCompletionResponse(text) {
        try {
            return JSON.parse(text);
        } catch (e) {
            if (!/^\s*data:/m.test(text || '')) {
                const err = new Error(`API 返回格式错误：${(text || '').slice(0, 120)}`);
                err.code = 'parse';
                throw err;
            }
            let content = '';
            const lines = (text || '').split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const payload = trimmed.slice(5).trim();
                if (!payload || payload === '[DONE]') continue;
                let chunk;
                try {
                    chunk = JSON.parse(payload);
                } catch (e2) {
                    continue; // 单块解析失败跳过，不因个别坏块整体炸掉
                }
                if (chunk.error) {
                    const err = new Error(chunk.error.message || JSON.stringify(chunk.error));
                    err.code = 'api';
                    throw err;
                }
                const choice = chunk.choices && chunk.choices[0];
                if (choice) {
                    content += choice.delta?.content ?? choice.message?.content ?? '';
                }
            }
            // v2.246 review（A4/B1）：全部块都解析失败/都没贡献内容时不许悄悄返回空壳成功——
            // 与非 SSE 分支同款报错（同一 code:'parse'、同样摘录响应前 120 字符），让上游 !data.choices[0] 校验
            // 之外多一层兜底，防止调用方把「空字符串」误当成「模型真的什么都没说」而不重试/不提示
            if (content === '') {
                const err = new Error(`API 返回格式错误：${(text || '').slice(0, 120)}`);
                err.code = 'parse';
                throw err;
            }
            return { choices: [{ message: { content } }] };
        }
    },

    // 调用不同模式的 Chat API
    // overrideConfig: { enabled, baseUrl, apiKey, model } — Pixiv 等模块的独立 API 配置
    // options（v2.73.7 新增、可选）：{ temperature, maxTokens } — caller 想要覆盖默认值时传入
    //   不传 options 或字段缺失时、各 API 函数走原有 fallback（全局 config.temperature → 0.7、max_tokens → 50000）
    async callChatAPI(messages, systemPrompt = null, overrideConfig = null, options = null) {
        // 若传入有效的独立配置，直接走 OpenAI 兼容路径
        if (overrideConfig && overrideConfig.enabled && overrideConfig.apiKey && overrideConfig.model) {
            const endpoint = this.buildChatEndpoint(overrideConfig.baseUrl || '');
            const res = await this._fetchWithTimeout(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${overrideConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: overrideConfig.model,
                    messages: systemPrompt
                        ? [{ role: 'system', content: systemPrompt }, ...messages]
                        : messages,
                    temperature: options?.temperature ?? 0.7,
                    max_tokens: options?.maxTokens ?? 50000,
                    stream: false   // v2.245：部分 API 服务对长生成会无视此项仍强制走 SSE，_parseChatCompletionResponse 兜底解析
                })
            });
            if (!res.ok) {
                const errorText = await res.text();
                const err = new Error(`API 请求失败 (${res.status}): ${errorText}`);
                err.code = 'api';
                err.status = res.status;
                throw err;
            }
            const data = this._parseChatCompletionResponse(await res.text());
            if (data.error) { const err = new Error(data.error.message || JSON.stringify(data.error)); err.code = 'api'; throw err; }
            if (!data.choices || !data.choices[0]) { const err = new Error('API 返回格式错误'); err.code = 'parse'; throw err; }
            return data.choices[0].message.content;
        }

        // 否则走全局配置
        const config = AppState.data.apiConfig;
        if (!config.key) throw new Error('请先在设置中配置 API Key');
        if (!config.model) throw new Error('请先在设置中选择模型');

        const mode = config.mode || 'openai';

        switch(mode) {
            case 'google':
                return await this.callGoogleAPI(messages, systemPrompt, options);
            case 'claude':
                return await this.callClaudeAPI(messages, systemPrompt, options);
            case 'deepseek':
            case 'openrouter':  // OpenRouter 文字聚合站，OpenAI 兼容
            case 'pioneer':     // Pioneer 官方中转站，OpenAI 兼容（callOpenAICompatibleAPI 内对 pioneer 双发 X-API-Key）
            case 'openai':
            default:
                return await this.callOpenAICompatibleAPI(messages, systemPrompt, options);
        }
    },

    // OpenAI 兼容 API (包括 DeepSeek)
    async callOpenAICompatibleAPI(messages, systemPrompt = null, options = null) {
        const config = AppState.data.apiConfig;
        const endpoint = this.buildChatEndpoint(config.url);

        // console.log('[API Call] Endpoint:', endpoint);
        // console.log('[API Call] Model:', config.model);

        // 支持 message.audio = { data: base64, mimeType }（OpenAI 兼容多模态格式）
        // 支持 message.image = { data: base64, mimeType }（data URI 形式的 image_url）
        const transformed = messages.map(m => {
            if (m.audio) {
                return {
                    role: m.role,
                    content: [
                        { type: 'text', text: m.content || '' },
                        { type: 'input_audio', input_audio: { data: m.audio.data, format: this._audioFormatFromMime(m.audio.mimeType) } }
                    ]
                };
            }
            if (m.image && m.image.data) {
                return {
                    role: m.role,
                    content: [
                        { type: 'text', text: m.content || '' },
                        { type: 'image_url', image_url: { url: `data:${m.image.mimeType || 'image/png'};base64,${m.image.data}` } }
                    ]
                };
            }
            return { role: m.role, content: m.content };
        });

        const requestBody = {
            model: config.model,
            messages: systemPrompt
                ? [{ role: 'system', content: systemPrompt }, ...transformed]
                : transformed,
            max_tokens: options?.maxTokens ?? 50000,
            stream: false   // v2.245：部分 API 服务对长生成会无视此项仍强制走 SSE，_parseChatCompletionResponse 兜底解析
        };
        // Pioneer 中转对部分上游模型（尤其 Claude）不接受采样参数，带 temperature 会报 upstream provider error
        // → Pioneer 模式省略 temperature（用模型默认采样）；其它 provider 照旧发
        if (config.mode !== 'pioneer') {
            requestBody.temperature = options?.temperature ?? Utils._num(config.temperature, 0.7);
        }

        // 鉴权头：标准 Bearer；Pioneer 中转站文档示例用 X-API-Key，双发兜底（服务器取其一）
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.key}`
        };
        if (config.mode === 'pioneer') headers['X-API-Key'] = config.key;

        const res = await this._fetchWithTimeout(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('[API Call] Error Response:', errorText);
            const err = new Error(`API 请求失败 (${res.status}): ${errorText}`);
            err.code = 'api';
            err.status = res.status;
            throw err;
        }

        const data = this._parseChatCompletionResponse(await res.text());
        console.log('[API Call] Response:', data);

        if (data.error) { const err = new Error(data.error.message || JSON.stringify(data.error)); err.code = 'api'; throw err; }
        if (!data.choices || !data.choices[0]) { const err = new Error('API 返回格式错误'); err.code = 'parse'; throw err; }

        return data.choices[0].message.content;
    },

    // mimeType → format string for OpenAI input_audio (audio/mp4 → mp4; audio/webm;codecs=opus → webm)
    _audioFormatFromMime(mime) {
        const m = String(mime || '').toLowerCase();
        if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'mp4';
        if (m.includes('mp3') || m.includes('mpeg')) return 'mp3';
        if (m.includes('wav')) return 'wav';
        if (m.includes('webm')) return 'webm';
        if (m.includes('ogg')) return 'ogg';
        if (m.includes('flac')) return 'flac';
        return 'webm';
    },

    // v2.68.10 长生成 timeout 友好处理：浏览器默认 5 min 抛 load failed，长篇 pixiv 需要更长窗口
    LLM_FETCH_TIMEOUT_MS: 600000, // 10 min
    async _fetchWithTimeout(url, options = {}, timeoutMs = null) {
        const ms = timeoutMs || Utils.LLM_FETCH_TIMEOUT_MS;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ms);
        try {
            const res = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            return res;
        } catch (e) {
            clearTimeout(timeoutId);
            if (e.name === 'AbortError') {
                const err = new Error(`Request timed out after ${Math.round(ms / 1000)}s`);
                err.code = 'timeout';
                throw err;
            }
            // fetch 抛 TypeError(load failed) → 网络层错误
            const err = new Error(e.message || 'Network error');
            err.code = 'network';
            throw err;
        }
    },

    // Google AI Studio API
    async callGoogleAPI(messages, systemPrompt = null, options = null) {
        const config = AppState.data.apiConfig;
        const endpoint = `${config.url}/v1beta/models/${config.model}:generateContent?key=${config.key}`;

        // 转换消息格式
        let contents = [];
        if (systemPrompt) {
            contents.push({
                role: 'user',
                parts: [{ text: `[System Instructions]\n${systemPrompt}\n\n[Start of Conversation]` }]
            });
        }

        messages.forEach(msg => {
            const parts = [];
            if (msg.content) parts.push({ text: msg.content });
            if (msg.audio && msg.audio.data) {
                parts.push({ inline_data: { mime_type: msg.audio.mimeType || 'audio/webm', data: msg.audio.data } });
            }
            if (msg.image && msg.image.data) {
                parts.push({ inline_data: { mime_type: msg.image.mimeType || 'image/png', data: msg.image.data } });
            }
            if (parts.length === 0) parts.push({ text: '' });
            contents.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts
            });
        });

        const requestBody = {
            contents: contents,
            generationConfig: {
                temperature: options?.temperature ?? Utils._num(config.temperature, 0.7),
                maxOutputTokens: options?.maxTokens ?? 50000
            }
        };

        // 不打印 endpoint（含 ?key=）与 requestBody，避免明文 key / 用户内容进控制台
        const res = await this._fetchWithTimeout(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('[Google API Error]', errorText);
            const err = new Error(`Google API 请求失败 (${res.status}): ${errorText}`);
            err.code = 'api';
            err.status = res.status;
            throw err;
        }

        const data = await res.json();
        console.log('[Google API Response]', data);

        const cand = data.candidates && data.candidates[0];
        const text = cand && cand.content && cand.content.parts && cand.content.parts[0] && cand.content.parts[0].text;
        if (!text) {
            const reason = cand && cand.finishReason;
            if (reason === 'MAX_TOKENS') { const err = new Error('Google API 返回被截断（生成内容过长）'); err.code = 'truncated'; throw err; }
            if (reason === 'SAFETY' || (data.promptFeedback && data.promptFeedback.blockReason)) { const err = new Error('Google API 内容被安全策略拦截'); err.code = 'safety'; throw err; }
            const err = new Error('Google API 返回格式错误'); err.code = 'parse'; throw err;
        }
        return text;
    },

    // Toast 轻量提示
    showToast(message, duration = 3000) {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = 'toast-item';
        toast.textContent = message;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    // Claude API
    async callClaudeAPI(messages, systemPrompt = null, options = null) {
        const config = AppState.data.apiConfig;
        const endpoint = `${config.url}/v1/messages`;

        // 支持 message.image = { data: base64, mimeType }（Anthropic base64 图片格式）
        const transformed = messages.map(m => {
            if (m.image && m.image.data) {
                return {
                    role: m.role,
                    content: [
                        { type: 'image', source: { type: 'base64', media_type: m.image.mimeType || 'image/png', data: m.image.data } },
                        { type: 'text', text: m.content || '' }
                    ]
                };
            }
            return m;
        });

        const requestBody = {
            model: config.model,
            max_tokens: options?.maxTokens ?? 50000,
            messages: transformed,
            temperature: options?.temperature ?? Utils._num(config.temperature, 0.7)
        };

        if (systemPrompt) {
            requestBody.system = systemPrompt;
        }

        console.log('[Claude API Call]', endpoint, requestBody);

        const res = await this._fetchWithTimeout(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.key,
                // 鉴权双发：官方 API 认 x-api-key；Claude Code 风格反代常只认 Authorization Bearer，双发兜底（服务器取其一）
                'Authorization': `Bearer ${config.key}`,
                'anthropic-version': '2023-06-01',
                // 浏览器直连 api.anthropic.com 的 CORS 必需头，对反代无害
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify(requestBody)
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('[Claude API Error]', errorText);
            const err = new Error(`Claude API 请求失败 (${res.status}): ${errorText}`);
            err.code = 'api';
            err.status = res.status;
            throw err;
        }

        const data = await res.json();
        console.log('[Claude API Response]', data);

        if (!data.content || !data.content[0]) {
            const err = new Error('Claude API 返回格式错误'); err.code = 'parse'; throw err;
        }

        return data.content[0].text;
    },

    // ===== 事件总线 =====
    emitEvent(type, source, data) {
        if (!AppState.data.recentEvents) AppState.data.recentEvents = [];
        const event = {
            id: Utils.generateId(),
            type,        // 'plot_published' | 'goods_announced' | 'official_info_added' | 'novel_published' | 'tweet_event' | 'magazine_published'
            timestamp: Date.now(),
            source,      // 'forum' | 'twitter' | 'pixiv' | 'magazine'
            data: data || {}
        };
        AppState.data.recentEvents.unshift(event);
        this.pruneEvents();
        this.saveData();
        console.log(`[EventBus] ${type} from ${source}:`, data?.title || '');
    },

    getRecentEvents({ source, type, since, limit } = {}) {
        const events = AppState.data.recentEvents || [];
        let filtered = events;
        if (source) filtered = filtered.filter(e => e.source === source);
        if (type) filtered = filtered.filter(e => e.type === type);
        if (since) filtered = filtered.filter(e => e.timestamp >= since);
        if (limit) filtered = filtered.slice(0, limit);
        return filtered;
    },

    pruneEvents() {
        if (!AppState.data.recentEvents) return;
        const TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
        const MAX = 20;
        const cutoff = Date.now() - TTL;
        AppState.data.recentEvents = AppState.data.recentEvents
            .filter(e => e.timestamp >= cutoff)
            .slice(0, MAX);
    },

    // 事件类型→表示ラベル 权威表（getEventContextPrompt / magazine 月間まとめ / 情报速報 widget 共用）
    EVENT_TYPE_LABELS: {
        plot_published: '新話公開',
        goods_announced: 'グッズ情報',
        official_info_added: '公式情報',
        novel_published: '二次創作',
        novel_completed: '完結記念',
        tweet_event: 'SNS話題',
        magazine_published: '雑誌記事',
        doujin_published: '同人誌新刊',
        doujin_event: '即売会情報',
        nico_video_published: 'ニコ動投稿',
        nico_trending: 'ニコ動話題',
        leak_posted: 'リーク情報'
    },

    // 跨模块联动 prompt 片段
    getEventContextPrompt(limit = 5) {
        const events = this.getRecentEvents({ limit });
        if (events.length === 0) return '';
        const TYPE_LABELS = this.EVENT_TYPE_LABELS;
        const lines = events.map(e => {
            const label = TYPE_LABELS[e.type] || e.type;
            return `- [${label}] ${e.data.title || ''}${e.data.summary ? ': ' + e.data.summary : ''}`;
        });
        return `\n【最近のコミュニティ動向】\n${lines.join('\n')}\n`;
    },

    // ═══════════════════════════════════════════════════════
    // 共享 AI prompt 片段（避免在 6 个仿真模块里重复定义）
    // ═══════════════════════════════════════════════════════
    PROMPTS: {
        // 情報アクセス制限（厳守）— 防止 AI 引用未公开设定资料
        // 用法：${Utils.PROMPTS.infoAccessRule()} 或 ${Utils.PROMPTS.infoAccessRule('forum')}
        infoAccessRule(mode) {
            const intro = mode === 'forum'
                ? '掲示板のNPCは「作品の視聴者・ファン」です。'
                : 'あなたは「作品の視聴者・ファン」の視点です。';
            return `
⚠️ 情報アクセス制限（厳守）:
${intro}以下の情報階層を厳守すること。

【参照してよい情報】
- キャラクターの外見（容姿・服装・髪型など、PVや公式ビジュアルで確認できるもの）
- キャラクターの性別・年齢層・公式プロフィールに記載の基本情報
- 公式情報・スタッフインタビュー・PVで言及された内容
- 劇中で実際に描写・放送済みのシーンやイベント
- 上記に基づく合理的な推測や感想

【絶対に参照・言及・暗示してはならない情報】
- 設定資料に記載されているが劇中未公開のバックストーリーや過去
- キャラクター間の隠された関係性（劇中で明示されていないもの）
- 今後の展開・伏線の真相・隠された能力や正体
- 設定上のみ存在し、まだ物語で描写されていない情報全般

原則: 「設定資料に書いてある」≠「視聴者が知っている」。劇中で実際に描写されたかどうかだけが判断基準。
`;
        },

        // ===== 官方 NPC 人设注入（v2.199.0）=====
        // npc.persona = 放送局 NPC 编辑弹窗「人设・发言风格」自由文本。未设置一律返回空串（各消费方行为与从前完全一致）。
        // 三种形态按拼接语境选：
        //   npcPersonaOneLine(npc) — 折叠成单行的原始文本（多行 → ' ／ '），用于自己拼列表行
        //   npcPersonaInline(npc)  — 带缩进的「└ 設定:」子行，直接接在 NPC 名册行末尾
        //   npcPersonaBlock(npc)   — 单 NPC system prompt 用的完整段落（带最优先指示）
        npcPersonaOneLine(npc) {
            const p = ((npc && npc.persona) || '').trim();
            if (!p) return '';
            return p.replace(/\s*\n\s*/g, ' ／ ');
        },
        npcPersonaInline(npc) {
            const p = this.npcPersonaOneLine(npc);
            if (!p) return '';
            return `\n    └ 設定: ${p}`;
        },
        npcPersonaBlock(npc) {
            const p = ((npc && npc.persona) || '').trim();
            if (!p) return '';
            const who = (npc.name || npc.role || '').trim();
            return `\n${who ? who + 'の' : ''}人物設定（性格・発言スタイル。口調・語彙・絵文字の癖はこれを最優先で再現すること）:\n${p}\n`;
        },
        // 多 NPC 列表段落收口（v2.200 review）— entries=[{label, persona}]，persona 为原始文本内部走 npcPersonaOneLine 折叠。
        // 全员未設定なら空串（従来挙動と同じ）。opts.title 允许调用方保留场景化标题（デフォルト「人物設定」）。
        npcPersonaListSection(entries, opts) {
            const lines = (entries || [])
                .map(e => {
                    const oneLine = this.npcPersonaOneLine({ persona: e && e.persona });
                    return oneLine ? `- ${e.label}: ${oneLine}` : null;
                })
                .filter(Boolean);
            if (lines.length === 0) return '';
            const title = (opts && opts.title) || '人物設定';
            return `\n${title}（性格・発言スタイル。口調・一人称・口癖・絵文字の癖はこれを最優先で再現すること）:\n${lines.join('\n')}\n`;
        }
    },

    // ═══════════════════════════════════════════════════════
    // HTML 转义唯一权威实现（2026-07 P0 收口，规则见项目 CLAUDE.md）
    // 任何 AI 生成文本/用户输入拼 HTML 必须过这里；禁止新写独立转义
    // null/undefined → ''，其余 String()；转义 & < > " '
    // ═══════════════════════════════════════════════════════
    escapeHtml(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    // 旧别名：转发权威实现，历史调用点无需改
    escHtml(s) { return Utils.escapeHtml(s); },

    // 放送局当前激活的世界书 ID 数组（兼容旧 worldBookId 单字段）
    getActiveWorldBookIds() {
        const bc = AppState.data.broadcast || {};
        if (Array.isArray(bc.worldBookIds) && bc.worldBookIds.length > 0) return bc.worldBookIds;
        return bc.worldBookId ? [bc.worldBookId] : [];
    },

    // 旧别名：与 escapeHtml 完全同义，转发权威实现
    escAttr(s) { return Utils.escapeHtml(s); },

    // 读取并压缩图片文件（File → dataURL）
    // opts: { maxSize: 边长上限px, quality: JPEG 质量 0~1 }
    async readImageFile(file, opts = {}) {
        if (!file || !file.type.startsWith('image/')) return null;
        const maxSize = opts.maxSize || 800;
        const quality = opts.quality ?? 0.85;
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let { width, height } = img;
                    if (width > maxSize || height > maxSize) {
                        const ratio = Math.min(maxSize / width, maxSize / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = () => reject(new Error('画像の読み込みに失敗'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('ファイル読み込み失敗'));
            reader.readAsDataURL(file);
        });
    },

    // 时间格式化（默认日式 'X分前'，opts 支持 short=去掉「前」，nowText=覆盖「たった今」，months=>30 日改ヶ月前）
    timeAgo(ts, opts = {}) {
        if (!ts) return '';
        const diff = Date.now() - ts;
        const m = Math.floor(diff / 60000);
        const h = Math.floor(diff / 3600000);
        const d = Math.floor(diff / 86400000);
        const suffix = opts.short ? '' : '前';
        const nowText = opts.nowText || 'たった今';
        if (m < 1) return nowText;
        if (m < 60) return `${m}分${suffix}`;
        if (h < 24) return `${h}時間${suffix}`;
        if (opts.months && d >= 30) return `${Math.floor(d / 30)}ヶ月${suffix}`;
        return `${d}日${suffix}`;
    },

    // ═══════════════════════════════════════════════════════
    // 全データクリア — 之前藏在 forum.js 里，移过来集中维护
    // 加新模块时只在下方 _DATA_DEFAULTS 里补一行即可
    // ═══════════════════════════════════════════════════════

    // 重置时**保留**的字段（API/系统配置/世界书/桌面布局/外部API/TTS）
    _PRESERVED_KEYS: ['apiConfig', 'apiPresets', 'systemConfig', 'worldBooks', 'desktopLayout', 'widgets', 'imageApiConfig', 'imageApiPresets', 'imageModulePresets', 'novelaiSettings', 'ttsConfig', '_clockWidgetMigrated', 'videoApiConfig', 'videoApiPresets'],
    // ↑ 2026-08-07 大review B1 修：确认框承诺「API設定以外すべて」清除——聊天/生图预设、分板块绑定、
    //   NAI 面板参数都属于 API 设定，此前不在清单里会被静默清掉（承诺与行为的缝隙）。
    // ↑ 2026-08-09 videoApiPresets 补入：videoApiConfig 出现的清单都要跟着带上它的预设数组，否则清空全部数据时
    //   视频生成的多渠道预设会被静默清掉，而同源的 imageApiPresets 却被保留——不对称。

    // 各模块的"出厂默认"。新增模块时在这里补一行就够。
    _DATA_DEFAULTS() {
        return {
            characters: [],
            groups: [],
            conversations: {},
            chatMeta: {},
            chatSettings: { useLineGreen: true, bgColor: '#8cabd9', bgImageUrl: '', showRead: true, showTyping: true, fontSize: 'normal' },
            dictionary: [],
            knowledgeBase: [],
            writerData: { title: '', content: '', writingField: '', materialType: '' },
            userProfile: { name: 'User', dept: '', role: '', bio: '' },
            myPersonaPresets: [],
            activePersonaId: null,
            music: { songs: [] },
            wallet: null,
            voom: null,
            stickers: null,
            forumData: {
                forumRules: '', userName: '', isAnonymous: true, fontSize: 15,
                threads: [], favorites: [], legendNpcs: []
            },
            broadcast: {
                worldSetting: '', worldBookId: '', worldBookIds: [],
                plotProgress: [], plotDrafts: [],
                officialInfo: [], officialNpcs: [],
                mergedSummaries: [], plotSummaries: [], officialSummaries: [], seriesEnded: false
            },
            twitterData: {
                userName: '公式アカウント', userHandle: 'official', userAvatarLetter: 'M',
                tweets: [], npcTweets: [], dms: {}
            },
            pixivData: {
                settings: { cp: '', forumLinked: true, additionalWorldBookIds: [], customPrompt: '', novelRules: '', language: 'jp-cn', apiOverride: { enabled: false, baseUrl: '', apiKey: '', model: '' } },
                novels: [], favorites: [], illustrations: [], recentNovelAngles: []
            },
            magazineData: null,
            melonbooksData: null,
            niconicoData: null,
            videoGenTasks: [],
            tarotData: null,
            fortuneData: null,
            travelData: null,
            paymentData: null,
            calendarEvents: [],
            recentEvents: [],
            pendingComfortEvents: []
        };
    },

    // 论坛模块要保留绑定（世界书/规则/官方 NPC 等），传进来覆盖到 fresh 上
    resetAllData(opts = {}) {
        if (!confirm('⚠️ 全データをクリアしますか？\n（API設定・世界書・システム設定・デスクトップレイアウト以外すべて）\nこの操作は取り消せません。')) return false;
        if (!confirm('最終確認：本当にすべてのデータを消去しますか？')) return false;

        // 1. 备份要保留的全局配置
        const keep = {};
        for (const k of this._PRESERVED_KEYS) {
            if (AppState.data[k] !== undefined) {
                keep[k] = JSON.parse(JSON.stringify(AppState.data[k]));
            }
        }

        // 2. 论坛偏好字段保留（规则、用户名、匿名、字号）
        const forumKeep = {
            forumRules: AppState.data.forumData?.forumRules || '',
            userName: AppState.data.forumData?.userName || '',
            isAnonymous: AppState.data.forumData?.isAnonymous ?? true,
            fontSize: AppState.data.forumData?.fontSize
        };

        // 2.5 放送局整体保留（世界设定、世界书、剧情、情报、官方NPC、总结全部）
        const broadcastKeep = AppState.data.broadcast
            ? JSON.parse(JSON.stringify(AppState.data.broadcast))
            : null;

        // 3. 构建出厂默认 + 覆盖保留项
        const fresh = this._DATA_DEFAULTS();
        Object.assign(fresh, keep);
        fresh.forumData = { ...fresh.forumData, ...forumKeep };
        if (broadcastKeep) fresh.broadcast = { ...fresh.broadcast, ...broadcastKeep };
        if (opts.extraKeep) Object.assign(fresh, opts.extraKeep);

        // 4. 替换整个 data 对象
        Object.keys(AppState.data).forEach(k => delete AppState.data[k]);
        Object.assign(AppState.data, fresh);

        Utils.showToast('✓ 全データをクリアしました（API・世界書・設定は保持）');
        // 落盘完成后再刷新，防 reload 打断 IndexedDB 写事务
        Utils.flushSave().then(() => setTimeout(() => location.reload(), 800));
        return true;
    },
};

// ── 页面退出兜底：防抖窗口内切后台/离开页面立刻落盘 ──
// iOS PWA 切后台后可能直接被杀进程、pagehide 不保证触发，visibilitychange(hidden) 是主兜底
document.addEventListener('visibilitychange', () => {
    if (document.hidden && Utils._saveTimer) Utils.flushSave();
});
window.addEventListener('pagehide', () => {
    if (Utils._saveTimer) Utils.flushSave();
});
