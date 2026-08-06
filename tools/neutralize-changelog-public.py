#!/usr/bin/env python3
# 公开版 changelog 中性化（sync-public.sh [2.2/5] 调用、fail-closed）
# 背景（2026-07-18 发现）：私有 v2.179 起历史条目冻结在 assets/changelog-archive/*.json、
# 随 [1/5] rsync assets 直通公开库，而清独白的 perl 只认 js/changelog.js、隐私闸门
# --include 也没有 *.json —— 归档独白连「月月/宝」原样公开了两次同步（v2.198/v2.204）。
# 本脚本三件事：
#   ① 归档 JSON：voiceFromKlaude 全部清空 + 身份词中性化（与 sync 脚本 js 侧同规则）
#   ② 未公开功能条目中性化：poipiku 绘向（公开版 wandoro = SFW override、无此功能），
#      v2.209 整条改「内部功能迭代」、v2.210 修复轮句删 poipiku 片段、六月归档 i18n 句去字样
#      —— 防公开玩家按更新日志找功能找不到来问
#   ③ 自检 fail-closed：归档残留身份词/非空独白、或 changelog 面残留 poipiku ⇒ 退出码 1
# ⚠️ 私有 changelog 条目「数据只增、内容永不修改」⇒ 下方精确锚点是安全的。
#    月度轮转后 v2.209/v2.210 条目会从 js/changelog.js 搬进 assets/changelog-archive/2026-07.json，
#    届时锚点匹配不上会 fail-closed 中止 —— 把 ② 的替换对挪进 ① 的归档处理即可。
import glob
import json
import re
import sys

fails = []

# ---- ① 归档 JSON：独白清空 + 身份词/未公开功能字样中性化 ----
REPLACES = [
    ('宝和小克一起做的每一版', '作者一路记录的每一版'),
    ('月月', '作者'), ('宝的', '作者的'), ('宝就', '作者就'),
    ('小克', '作者'), ('宝和作者', '作者'),
    # 六月归档 i18n 条目顺带提及 poipiku（公开版无此功能）
    ('Space 直播 / 存档、poipiku 等文案', 'Space 直播 / 存档等文案'),
    # 五六月归档提及的「Poipiku 分享推文」flavor（公开版有该 flavor、但统一零残留防连锁提问）
    ('マシュマロ回答+Poipiku 分享三处', 'マシュマロ回答+外部分享三处'),
    ('DM / Marshmallow / Poipiku / 通知', 'DM / Marshmallow / 通知'),
    ('「回答并发推」/ Poipiku 共享', '「回答并发推」/ 外部共享'),
    # 开发来源痕迹（镜像 sync 脚本 [2.5/5] 的 js 侧规则）
    ('借鉴写预设的经验：', '改用滑动窗口记忆：'),
    ('借鉴写预设的经验', '改用滑动窗口记忆'),
    ('借鉴预设的滑动窗口', '滑动窗口记忆策略'),
    ('Kitty 机', '既有方案'),
]
# poipiku 条目（2026-07 月度轮转后从 js 搬进 2026-07.json——2026-08-06 按头注预案挪来对象层处理）
V210_SENT_OLD = '当日两版的 review 修复轮：六路对抗审查确认 6 处小问题全修——开屏淡出瞬间不再吞你的第一下点击；poipiku 生成中途关页重开会如实显示「読み込み中…」；删除已揭示的 poipiku 推会顺手清掉图片存储；开屏画不再挤占每次更新的下载流量（挪进持久缓存，发版零重拉）'
V210_SENT_NEW = '当日两版的 review 修复轮：六路对抗审查确认多处小问题全修——开屏淡出瞬间不再吞你的第一下点击；开屏画不再挤占每次更新的下载流量（挪进持久缓存，发版零重拉）'
seen209 = seen210 = False
for f in sorted(glob.glob('assets/changelog-archive/*.json')):
    with open(f) as fh:
        d = json.load(fh)
    for e in d.get('versions', []):
        if e.get('voiceFromKlaude'):
            e['voiceFromKlaude'] = ''
        if e.get('version') == '2.209.0' and any('poipiku' in h.lower() for h in e.get('highlights', [])):
            e['highlights'] = ['内部功能迭代与稳定性修复']
            seen209 = True
        if e.get('version') == '2.210.1':
            hl = e.get('highlights', [])
            if V210_SENT_OLD in hl:
                e['highlights'] = [V210_SENT_NEW if h == V210_SENT_OLD else h for h in hl]
                seen210 = True
    s = json.dumps(d, ensure_ascii=False, indent=1) + '\n'
    for old, new in REPLACES:
        s = s.replace(old, new)
    with open(f, 'w') as fh:
        fh.write(s)
if not seen209:
    fails.append('v2.209 poipiku 条目在归档中没找到（版本号/结构变了？人工核）')
if not seen210:
    fails.append('v2.210.1 修复轮句在归档中没找到（句子变了？人工核）')

# ---- ② js 锚点替换已退役（2026-08-06：条目随 7 月轮转进归档、①段对象层接管；③自检继续把关 js 零 poipiku） ----

# ---- ③ 自检（fail-closed） ----
ARCH_PAT = re.compile(r'月月|小克|宝和|宝的|宝就|poipiku|ポイピク', re.I)
for f in sorted(glob.glob('assets/changelog-archive/*.json')):
    with open(f) as fh:
        d = json.load(fh)
    for e in d.get('versions', []):
        if e.get('voiceFromKlaude'):
            fails.append(f'{f}: v{e.get("version")} 独白未清空')
    with open(f) as fh:
        for i, line in enumerate(fh, 1):
            if ARCH_PAT.search(line):
                fails.append(f'{f}:{i}: {line.strip()[:80]}')
POIP_PAT = re.compile(r'poipiku|ポイピク', re.I)
with open('js/changelog.js') as fh:
    for i, line in enumerate(fh, 1):
        if POIP_PAT.search(line):
            fails.append(f'js/changelog.js:{i}: {line.strip()[:80]}')

if fails:
    print('⚠ changelog 中性化未通过：')
    for x in fails:
        print('  ' + x)
    sys.exit(1)
print('  ✓ changelog 归档独白清空 + 身份词 + 未公开功能条目中性化通过')
