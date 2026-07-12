#!/usr/bin/env python3
# 公开库 help-content.json 中性化（v2.198 同步起用，配套私有 v2.179 的帮助正文 JSON 化）。
# 输入=rsync 带进来的私有版 assets/help-content.json（原地改写）。
# 规则与 sync-public.sh 对 js 的既有中性化同源：删运营节 + 替换示例名/站点引用。
# fail-closed：处理后仍残留敏感词则 exit 1（同步脚本据此中止，喊小克人工核对新段落）。
import json, re, sys

PATH = sys.argv[1] if len(sys.argv) > 1 else 'assets/help-content.json'

# 整节删除：正式站运营内容（认证码/邀请制/线上认证服务），公开库=GitHub Pages 免认证直接玩，不适用
DROP_IDS = {'first-access', 'faq-local-run', 'faq-share'}

# 文本替换（顺序执行；键必须能在当前私有版找到，找不到不报错——将来私有版删了对应段落属正常）
REPLACES = [
    ('見月,Mitsuki,みつき', '星野,Hoshino,ほしの'),          # 世界书示例 handle（照 js 既有规则）
    ('「真名 mitsuki」', '「真名 ○○」'),                      # LINE persona 示例
    ('月月强调的', '作者强调的'),
    ('这是月月的设计原则', '这是本作的设计原则'),
    ('用 Safari 打开 <code>perigee-os.org</code>', '用 Safari 打开本站'),
    ('找到 perigee-os.org 的 SW', '找到本站的 SW'),
]

# 处理后不得残留（fail-closed 扫描闸）。注意：不禁「一次性」裸词（「一次性迁移」是合法技术用语）
FORBIDDEN = ['perigee-os.org', '认证码', '一次性码', 'mitsuki', 'Mitsuki',
             '見月,', 'みつき', '月月', '小克', '宝和']

data = json.load(open(PATH, encoding='utf-8'))
before = len(data['sections'])
data['sections'] = [s for s in data['sections'] if s.get('id') not in DROP_IDS]
dropped = before - len(data['sections'])

raw = json.dumps(data, ensure_ascii=False, indent=2)
for old, new in REPLACES:
    raw = raw.replace(json.dumps(old, ensure_ascii=False)[1:-1],
                      json.dumps(new, ensure_ascii=False)[1:-1])

leaks = [kw for kw in FORBIDDEN if kw in raw]
if leaks:
    print(f'⚠ help-content.json 中性化后仍残留敏感词: {leaks}', file=sys.stderr)
    print('  私有版新增了处理规则未覆盖的段落——人工核对后更新 tools/neutralize-help-json.py 的规则。', file=sys.stderr)
    sys.exit(1)

open(PATH, 'w', encoding='utf-8').write(raw)
print(f'✓ help-content.json 中性化完成（删 {dropped} 节、替换 {len(REPLACES)} 组、扫描闸通过）')
