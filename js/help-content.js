// Perigee OS 帮助中心内容
// 适配 v2.71.3 — 放送局架构 / MiniMax 声线克隆 / 日本同人圈生态打通（推特↔pixiv）/ 中文同人圈生态（微博 + 情报站汉化搬运）

const HelpContent = {
    sections: [
        // ==================== 快速上手 ====================
        {
            id: 'getting-started',
            title: '快速上手',
            type: 'group'
        },
        {
            id: 'welcome',
            parent: 'getting-started',
            title: '这是什么',
            body: `
                <p>Perigee OS 不是单一应用，而是一个<strong>虚拟手机操作系统</strong>。打开它你会看到主屏幕，上面排列着各种 app — 和真实手机一模一样。</p>

                <p>但这部"手机"的特别之处在于：所有 app 围绕你设定的<strong>同一个世界</strong>协作。你写下"我喜欢的角色 A 和 B 现在正在拍续作"这件事一次，从此：</p>
                <ul>
                    <li>论坛里的粉丝会讨论它</li>
                    <li>推特上有官方账号发情报，粉丝在评论区吵</li>
                    <li>Pixiv 上会出现这个 CP 的同人小说（推特上的「同人文手」NPC 会自己更新作品 + 在推特上自宣）</li>
                    <li>杂志会有专栏文章</li>
                    <li>同人展会上架相关周边、メルカリ 二手市场跟着炒价</li>
                    <li>ニコニコ会有 MAD 和弹幕</li>
                    <li><strong>微博（中文同人圈）</strong>有粉丝在拼团 / 代购 / 安利 / 情报站汉化日推日刊（v2.71.x 新加）</li>
                </ul>

                <p>你不需要在每个 app 里重复输入设定 — 它们读同一个数据源（v2.60 起这个数据源叫<strong>放送局</strong>）。同一个 CP 你只在放送局填一次、推特会聊它、Pixiv 同人作者写它、メロン 出本子、微博粉丝磕、ニコニコ 剪 MAD。</p>

                <div class="help-callout">
                    <strong>所有数据存在你自己设备的浏览器里，不上传服务器</strong>。我们只是把界面做出来，剩下的故事是你和 AI 一起写的。
                </div>
            `
        },
        {
            id: 'first-access',
            parent: 'getting-started',
            title: '第一步：访问与登录',
            body: `
                <p>本演示站采用邀请制，首次访问需要输入访问码（用户名 + 密码），用于防止滥用。</p>

                <h4>访问码的特点</h4>
                <ul>
                    <li><strong>一次性</strong> — 输入后自动激活并绑定当前浏览器</li>
                    <li>之后这台设备/浏览器永久授权，不需要再输</li>
                    <li>但是：重置整个数据 / 切换浏览器 / 换手机 都需要重新申请新的访问码</li>
                </ul>
            `
        },
        {
            id: 'install-pwa',
            parent: 'getting-started',
            title: '装到主屏幕（推荐）',
            body: `
                <p>Perigee OS 是 PWA，可以装到手机当原生 app 用。装上之后下次打开就是全屏 app，没有浏览器地址栏。</p>

                <h4>iPhone（必须用 Safari）</h4>
                <ol>
                    <li>用 Safari 打开本站</li>
                    <li>底部分享按钮（向上箭头方框）</li>
                    <li>滑到「添加到主屏幕」</li>
                    <li>编辑名字 → 添加</li>
                </ol>

                <h4>Android（Chrome）</h4>
                <ol>
                    <li>右上角三点菜单</li>
                    <li>「安装应用」或「添加到主屏幕」</li>
                    <li>确认</li>
                </ol>

                <h4>Mac（Chrome / Edge）</h4>
                <p>地址栏右侧出现「下载/安装」图标，点了即可装到 Dock。</p>

                <h4>装完之后</h4>
                <ul>
                    <li>从主屏幕图标启动，全屏运行</li>
                    <li>离线也能开（PWA 缓存了核心资源）</li>
                    <li>有新版本时会弹「新版本上线」窗口，里面有这次改了什么</li>
                </ul>
            `
        },
        {
            id: 'setup-api',
            parent: 'getting-started',
            title: '第二步：配置 LLM API（必备）',
            body: `
                <p>所有 AI 生成内容都需要 LLM API。<strong>没配 API 的话所有 AI 功能不可用，这一步绕不开</strong>。</p>

                <h4>在哪里填</h4>
                <p>设置 → <strong>API 接続</strong>，里面分三块：</p>
                <ul>
                    <li><strong>LLM API</strong> — 主力，所有文字生成都靠它（必填）</li>
                    <li><strong>生图 API</strong>（可选）— 推特 / Pixiv 配图用</li>
                    <li><strong>TTS API</strong>（可选）— 语音 / 广播剧用，见后面 MiniMax 章节</li>
                </ul>

                <h4>推荐 Gemini</h4>
                <p>免费额度大、多模态、长上下文。完整的 Perigee 体验（尤其语音、广播剧）<strong>十分推荐 Gemini</strong>。</p>
                <ul>
                    <li>API URL：<code>https://generativelanguage.googleapis.com/v1beta/openai</code>（自动填充）</li>
                    <li>API Key：在 <code>aistudio.google.com/app/apikey</code> 申请</li>
                    <li>模型：<code>gemini-2.5-flash</code> 或 <code>gemini-2.5-pro</code></li>
                </ul>

                <h4>其他兼容选项</h4>
                <ul>
                    <li><strong>Claude</strong>（Anthropic）— 中文文学性强，写小说强</li>
                    <li><strong>OpenAI</strong> — 老牌、稳定，<code>gpt-4o</code> 等</li>
                    <li><strong>DeepSeek</strong> — 国内可直连，便宜</li>
                    <li><strong>OpenRouter / 自定义 endpoint</strong> — 任何 OpenAI 协议兼容的服务都行</li>
                </ul>

                <h4>填完之后</h4>
                <p>选 mode → 填 API key → 填 model 名 → 保存。<strong>model 名要写完整 ID</strong>，不是「GPT-4」这种口语名。</p>

                <div class="help-callout">
                    <strong>关于隐私</strong>：所有 API key 只存在你浏览器的 localStorage / IndexedDB 里，<strong>不经过任何中间服务器</strong>。请求是浏览器直接发给 OpenAI / Google / 你填的 endpoint。
                </div>
            `
        },
        {
            id: 'desktop-basics',
            parent: 'getting-started',
            title: '桌面基础操作',
            body: `
                <p>启动后看到的就是桌面 — 多页可以左右滑动切换，下方有页码点。</p>

                <h4>点击图标</h4>
                <p>正常点击 = 进入对应 app。</p>

                <h4>编辑模式</h4>
                <p><strong>长按任意图标</strong> 进入编辑模式：</p>
                <ul>
                    <li>图标抖动，可以拖动到任意位置</li>
                    <li>可以跨页拖动（拖到屏幕边缘自动切页）</li>
                    <li>"自由模式" toggle 打开后图标可以放在任意像素位置（不锁网格）</li>
                    <li>"一键整理" 按网格重新排列</li>
                    <li>右上角"完成"退出编辑</li>
                </ul>

                <h4>Widget 小组件</h4>
                <p>编辑模式下点 + Widget：</p>
                <ul>
                    <li><strong>时钟</strong>（24/12 小时制）</li>
                    <li><strong>日历</strong>（含日历 app 的事件）</li>
                    <li><strong>待办</strong></li>
                    <li><strong>Now Playing</strong>（音乐 widget）</li>
                </ul>

                <h4>装饰</h4>
                <p>编辑模式 → + 装饰：贴纸 / 胶带 / 透明覆盖层叠加在桌面，叠在图标之间但不影响点击交互。</p>

                <h4>自定义图标</h4>
                <p>设置 → 美化设置 → 图标自定义：每个 app 可以单独换成你自己的图片。</p>
            `
        },

        // ==================== 核心层 ====================
        {
            id: 'core',
            title: '核心层（最先搭好）',
            type: 'group'
        },
        {
            id: 'broadcast',
            parent: 'core',
            title: '放送局（世界总控台）',
            body: `
                <p>主屏第一位的图标。把它当作整个 PerigeeOS 的"世界总控台"。</p>

                <p>放送局是 v2.60 引入的中央数据层。<strong>先在放送局把世界搭好，其他 app 才有得玩</strong>。它有 5 个 Tab：</p>

                <h4>世界 Tab</h4>
                <ul>
                    <li><strong>世界观描述</strong> — 自由文本。比如"目前在播《○○○》第 2 期，讲述原著人物若干年后的新故事"。这段会被注入论坛、推特、Pixiv、杂志、メロン 等所有 prompt</li>
                    <li><strong>绑定世界书</strong>（可多选）— 勾选你已经在「世界书」app 里建好的设定库。世界书条目带关键词触发，比纯文本更精确</li>
                    <li>改完点底部「保存世界设定」</li>
                </ul>

                <h4>剧情 Tab</h4>
                <p>时间线管理你设定的世界里发生了什么。</p>
                <ul>
                    <li><strong>添加剧情</strong> — 每个剧情节点 = 一集动画 / 一话漫画 / 一个事件。AI 会知道事件之间的先后顺序</li>
                    <li><strong>剧情草稿箱</strong> — 批量导入工具。一次塞 12 集草稿进来，每天发布 1 集，模拟动画连载节奏。支持 txt 和 json 格式（SillyTavern 聊天记录也可以）</li>
                </ul>

                <h4>情报 Tab</h4>
                <p>模拟"官方在更新" — 官方账号发什么、杂志写什么、访谈披露什么。</p>
                <ul>
                    <li><strong>类型</strong>：访谈 / 活动 / 周边 / 官方推特 / 设定集</li>
                    <li><strong>关联剧情</strong>：标注这条情报在第几集播出后才公开</li>
                    <li><strong>关联 NPC</strong>：是谁说的（监督？声優？官方账号？）</li>
                    <li><strong>预发售标记</strong>：用于周边类，发售日还没到但已经公开</li>
                </ul>
                <p>杂志写完文章 / 推特发完官方推 / 同人展上架新品时，可以一键保存进情报库，让其他 app 也跟着知道。</p>

                <h4>角色 Tab</h4>
                <p>官方相关的人 — 监督、声優、脚本家、原作者、官方推特账号、出版社编辑……</p>
                <ul>
                    <li>每个 NPC 含名字、@ handle、头像、角色定位（role）</li>
                    <li>role 含「声優 / 声优 / seiyuu / CV」会自动出现「<strong>关联角色</strong>」一栏，标这个声優给哪些角色配音</li>
                    <li>可以绑定 <strong>voiceId</strong>（MiniMax 语音）— 让这个 NPC 在 Space / 广播剧里用真人声音说话</li>
                </ul>
                <div class="help-callout">
                    <strong>官方 NPC 全模块共享</strong>：这里填的「声優 / 監督 / 制作公司 / 公式 Twitter」会自动出现在 LINE / 推特 / 微博 / 杂志 / Niconico / メルカリ 等所有模块。例如在推特 / 微博的「切换账号」菜单底部，能看到这些官方账号供你以官方身份发博 / 发推（v2.71.x 中文圈微博加官方账号支持后、跟推特一致）。
                </div>

                <h4>世界 Tab 末尾的 CP 设置（v2.69.0 新加）</h4>
                <p>之前 CP 数据分散在 pixiv / forum 设置里，现在统一到放送局世界 Tab 末尾的 <strong>CP 设置</strong> card：</p>
                <ul>
                    <li><strong>cpCharA / cpCharB</strong> — CP 的两位角色名（如「主役 A」「主役 B」）</li>
                    <li><strong>cpNickname</strong> — CP 简称（圈内昵称、可填可空）</li>
                    <li><strong>productionName</strong>（v2.71.0 新加）— 作品名，用于微博作品超话 + 中文圈 NPC prompt 注入</li>
                </ul>
                <p>这套 CP 设置被以下模块读取：pixiv 小说生成 / 剧情扩写 / 周边方案 / 咖啡店菜单 / mercari 行情 / 微博 NPC 内容 / 微博超话 / 热搜。<strong>论坛 / 推特 / 微博 NPC 模块永远不读 CP</strong> — 它们从 worldContext 自然推理 CP，保留猜测乐趣（核心玩法依赖）。</p>

                <h4>总结 Tab</h4>
                <p>世界设定一长，注入 prompt 的 token 会爆。总结是把"前 N 集 + 前 M 条情报"压缩成一段时间线摘要，节省后续 prompt 的长度。</p>
                <p>点「管理总结」打开 modal，选到第几集为止合并。AI 会生成一段紧凑的时间线总结，之后这段总结代替原始数据被注入。</p>

                <div class="help-callout">
                    <strong>v2.60 重要变化</strong>：世界观、剧情、官方情报、官方 NPC 已经从论坛设置搬到放送局集中维护。论坛设置里只剩论坛规则、传说 NPC、偏好、维护四张卡。
                </div>
            `
        },
        {
            id: 'worldbook',
            parent: 'core',
            title: '世界书（设定库）',
            body: `
                <p>世界书是<strong>跨模块共享的设定库</strong>。一份建好，论坛、推特、Pixiv、LINE 都能引用，AI 生成内容时会自动注入。</p>

                <h4>怎么建</h4>
                <p>桌面 →「世界書 / Worldbook」app →「+ 新世界书」起个名（比如「主角设定」「魔法体系」）→ 进去添加条目。</p>

                <h4>条目的三个字段</h4>
                <ul>
                    <li><strong>标题</strong> — 人/物/概念的名字，自己看的标识</li>
                    <li><strong>关键词</strong> — 触发条件，AI 看到对话里出现这些词就把内容塞进 prompt</li>
                    <li><strong>内容</strong> — 详细描述，自由发挥</li>
                </ul>

                <h4>关键词怎么写</h4>
                <p>多写变体覆盖不同写法：</p>
                <ul>
                    <li>汉字 + 假名 + 英文：<code>見月,Mitsuki,みつき</code></li>
                    <li>如果角色有<strong>代号 / 绰号 / 缩写</strong>，也推荐一起写进去（比如官方 ID、粉丝叫法），这样讨论里只要有人提到代号也能触发条目</li>
                    <li>专有名词比通用词稳（人名 / 地名 / 组织名最好用）</li>
                    <li>太宽泛的词（比如「魔法」）容易在不相关对话里也注入，谨慎用</li>
                </ul>

                <h4>内容推荐格式（角色）</h4>
                <pre><code>【外貌】
身高 165cm，齐腰黑长直发常以发带束在脑后。
眼睛是冷调的灰蓝色。

【性格】
表面冷静寡言，对感兴趣的事情会突然话很多。

【背景】
魔法学院二年级生，主修结界术。

【关系】
- 与XX是青梅竹马（暗恋中）
- 与YY有师徒关系</code></pre>

                <h4>注入逻辑</h4>
                <p>对话 / 帖子 / 推特里出现某条目的关键词 → 对应内容自动注入 prompt（用户看不到，AI 会按这些设定生成回复）。没出现关键词的条目不注入，避免 prompt 太长。</p>

                <h4>怎么绑定</h4>
                <ul>
                    <li><strong>放送局 → 世界 Tab</strong>：勾选要绑定的世界书，论坛/推特/Pixiv/杂志/メロン 都会读</li>
                    <li><strong>LINE 角色编辑</strong>：每个角色单独绑定</li>
                    <li><strong>Pixiv 设置</strong>：除了放送局绑定的，还可以叠加额外世界书</li>
                </ul>

                <div class="help-callout">
                    <strong>建议</strong>：先建一本「世界总览」装大设定（魔法体系/政治/地理），再为每个 OC 单独建条目。论坛和推特绑定一份就能跑。
                </div>
            `
        },

        // ==================== 社交模拟 ====================
        {
            id: 'social',
            title: '社交模拟',
            type: 'group'
        },
        {
            id: 'mod-line',
            parent: 'social',
            title: 'LINE 沉浸式聊天',
            body: `
                <p>完整还原 LINE App 的体验，1v1 和群聊。</p>

                <h4>底部四个 Tab</h4>
                <ul>
                    <li><strong>ホーム</strong> — 个人资料、商店、转账记录入口</li>
                    <li><strong>トーク</strong> — 聊天列表 + 群组创建 + 单聊视图</li>
                    <li><strong>VOOM</strong> — 朋友圈式动态广场，AI 角色会发动态</li>
                    <li><strong>ウォレット</strong> — 转账记录、钱包余额</li>
                </ul>

                <h4>创建角色（两条路）</h4>
                <p><strong>路径 1：自己建</strong> — トーク → 右上角「+」加角色：</p>
                <ul>
                    <li>名字、头像、个人资料、性格描述（system prompt）、首条消息</li>
                    <li>绑定世界书</li>
                    <li>绑定 voiceId（让角色用真人声音发语音消息）</li>
                </ul>
                <p><strong>路径 2：从推特加好友</strong> — 逛推特碰到有趣的 NPC，点头像 → 个人主页 → 「加为好友」，自动建立 LINE 联系，TA 的世界观和性格自动同步过来。这是<strong>发掘新角色的轻松方式</strong>。</p>

                <h4>多 persona 系统</h4>
                <p>设置 → 个人身份。可以建多个「我」（真名一份、笔名一份等），不同角色聊天时切换不同身份。</p>
                <p>支持「角色绑定 persona」 — 比如把「真名」绑定到角色 A，把「笔名」绑定到角色 B，切换聊天对象时身份自动跟着切。</p>

                <h4>对话特色</h4>
                <ul>
                    <li><strong>消息总结管理</strong> — 长对话自动总结，避免上下文超长</li>
                    <li><strong>贴纸系统</strong> — 导入自定义贴纸包</li>
                    <li><strong>语音消息</strong> — 角色配 voiceId 后会发语音</li>
                    <li><strong>图片</strong> — 附图、AI 生图</li>
                    <li><strong>转账</strong> — 模拟 LINE Pay，跨模块结算</li>
                </ul>

                <h4>群组</h4>
                <p>トーク → 创建群组 → 选择成员 → AI 自动多角色发言。</p>
            `
        },
        {
            id: 'mod-forum',
            parent: 'social',
            title: '论坛（5ch 風格匿名讨论区）',
            body: `
                <p>5ch 風格的匿名讨论区。AI 扮演粉丝在你设定的世界里讨论。</p>

                <h4>主屏</h4>
                <ul>
                    <li>「全部」Tab — 所有帖子按最后活动时间倒序</li>
                    <li>「收藏」Tab — 标记为收藏的帖子</li>
                    <li><strong>生成按钮</strong>（右上角 +）— AI 一次生成 N 个新帖。<strong>推荐 3-5 个，太多容易掉格式</strong></li>
                </ul>

                <h4>帖子详情页</h4>
                <ul>
                    <li>5ch 風格嵌套楼中楼</li>
                    <li>「加载更多回复」让 AI 继续往下接</li>
                    <li><strong>传说 NPC 标记</strong>（星形按钮）— 把这个楼主标记成"特别有名的发言者"，他的名字 + 简介会被注入 prompt，AI 后续会自然提到这个人</li>
                    <li>收藏、TTS 朗读、导出帖子（图片 / 文字）</li>
                </ul>

                <h4>论坛设置（v2.60 精简版）</h4>
                <ul>
                    <li><strong>论坛规则</strong> — 自由文本约束 AI 风格（"全程日语网络用语"、"禁止讨论某话题"等）</li>
                    <li><strong>传说 NPC 列表</strong> — 批量管理已标记的著名楼主</li>
                    <li><strong>偏好</strong> — 匿名模式开关、用户名、字号</li>
                    <li><strong>维护</strong> — 清空全部帖子</li>
                </ul>
                <p>世界观、剧情、官方情报、官方 NPC <strong>已搬到放送局</strong>，不在论坛设置里。</p>

                <h4>跨模块联动</h4>
                <p>论坛是 AI 粉丝讨论的核心入口。放送局里设的剧情和情报 → 论坛粉丝会自动讨论；推特一些推文也可以转为情报让论坛展开二次讨论。</p>
            `
        },
        {
            id: 'mod-twitter',
            parent: 'social',
            title: 'X（推特） + Space + DM',
            body: `
                <p>完整推特模拟。和论坛不同，推特是"明面公开发言" — 官方账号、声優、粉丝大V 都在这。</p>

                <h4>多账号身份</h4>
                <p>顶部头像 →「编辑个人主页」打开身份管理。可以建多个个人账号：</p>
                <ul>
                    <li><strong>真名号</strong> — AI 知道你本人身份</li>
                    <li><strong>匿名小号</strong> — AI 不知道你是谁，纯粹按 handle 互动</li>
                    <li><strong>CP 站号 / 团粉号</strong> — 自定义任意身份</li>
                </ul>
                <p>顶部下拉随时切换。每个账号独立有用户名、@handle、头像、bio、推文流。</p>

                <h4>时间线</h4>
                <ul>
                    <li>AI 生成的官方推 + 粉丝推混合</li>
                    <li>每条推可以点开看详情、嵌套评论互动链</li>
                    <li>点头像看个人主页（粉丝/关注数、banner、全部推文）</li>
                </ul>

                <h4>关注 → 加 LINE 好友</h4>
                <p>看到感兴趣的 NPC 可以先关注，然后邀请到 LINE（添加为好友），就可以和这位 NPC 继续聊感兴趣的事情。</p>
                <p>NPC 的属性是随机生成的。如果是<strong>"舅舅党"属性</strong>的 NPC，当你用<strong>官方身份</strong>和她聊天时，会触发"是否分享到论坛"的彩蛋 — NPC 会化身舅舅党去爆料。</p>

                <h4>Space（语音房）</h4>
                <ul>
                    <li>在发推编辑器里点 LIVE 按钮创建</li>
                    <li>NPC 主持人 + 用户参与</li>
                    <li>长按麦克风录音 → AI 听懂语音 → 多个 NPC 用文字回应 → 配了 voiceId 的 NPC 用 MiniMax 真人声合成</li>
                    <li>删除 Space 时音频自动清理</li>
                </ul>

                <h4>DM（私信）</h4>
                <ul>
                    <li>1v1 和角色私聊</li>
                    <li>与 LINE 的区别：推特 DM 是"公众人物"语境，LINE 是"亲友"语境</li>
                </ul>

                <h4>搜索 / 通知</h4>
                <ul>
                    <li>关键词搜索，点搜索结果里的推文进 thread，点头像看那个粉丝账号</li>
                    <li>通知：@提到、转推、收藏提醒</li>
                </ul>

                <h4>マシュマロ / Poipiku</h4>
                <p>模拟匿名提问箱和图片站，可从推特跳转。</p>

                <h4>同人作者打通 Pixiv（v2.70.0 新加）</h4>
                <p>推特 fanFriends 里如果是「同人文手（doujin_writer）」属性的 NPC，会跟 Pixiv 小说模块联动：</p>
                <ul>
                    <li>Pixiv 自动生成新小说时、有概率挑这位推特 NPC 作为「作者」、用她的 writingStyle 注入</li>
                    <li>该 NPC 会在推特按性格（promoteStyle: active / occasional / shy）<strong>延迟自然 mention 新作</strong> + 带 PIXIV_LINK 链接卡片</li>
                    <li>active = 必发自宣 / occasional = 30% 概率 / shy = 5% 概率 — 模拟真实同人作者的自宣习惯</li>
                </ul>

                <h4>同人作者编辑入口「彼女の好み」</h4>
                <p>推特 fanFriend profile 里的「同人文手」NPC、profile 内有<strong>「彼女の好み」折叠区</strong>（默认折叠）：</p>
                <ul>
                    <li>writingStyleId（文体）</li>
                    <li>contentTags（擅长主题 chips）</li>
                    <li>promoteStyle（自宣性格）</li>
                    <li>pixivHandle</li>
                </ul>
                <p>Pixiv 模块本身没有「同人作者管理」UI（沉浸感铁律：读小说的地方不是管理后台、作者像真实同人作者一样自然冒出来）。所有编辑都从推特 profile 进入。整池重置藏在「设置 → 数据管理 → 重置同人作者池」做 maintenance。</p>
            `
        },
        {
            id: 'mod-weibo',
            parent: 'social',
            title: '微博（中文同人圈生态）',
            body: `
                <p>v2.71.0 加入的<strong>中文同人圈生态</strong>。跟推特是「日推」对应，微博是「中文圈」— NPC 行为、生态文化、术语全部按真实中文同人圈来。</p>

                <h4>4 个 tab</h4>
                <ul>
                    <li><strong>首页</strong> — 关注 / 推荐 双流；右上刷新按钮（手动触发 NPC 发新博）</li>
                    <li><strong>发现</strong> — 热搜趋势 + 超话社区 + 热门、跟剧情推进同步更新</li>
                    <li><strong>消息</strong> — @提到 / 评论 / 转发 / 私信 4 子tab</li>
                    <li><strong>我的</strong> — IMG 真微博一级菜单（会员中心 / 设置 / 我的收藏 / 我的赞 / 主页访客 / 浏览记录 / 草稿箱）。点击「设置」才进二级菜单（账号 / 账号与安全 / 消息设置 / 推送 / 隐私 / 通用）</li>
                </ul>

                <h4>7 类中文圈 NPC 子类型</h4>
                <p>每类有独立 prompt 模板生成本土风格内容：</p>
                <ul>
                    <li><strong>同人文手</strong> — 在 lofter / 微博发同人文、自宣文案</li>
                    <li><strong>同人画手</strong> — 发图 / 练习帖</li>
                    <li><strong>拼团组织者</strong> — 周边盲盒拼团、单价 / 起团数 / 团长加价</li>
                    <li><strong>代购</strong> — 日本同人圈周边代购、现货 / 预定 / 即売会限定</li>
                    <li><strong>情报站</strong> — 客观搬运官方动向 / 周边发售 / 杂志专访（详见下方汉化搬运）</li>
                    <li><strong>日常粉</strong> — 70% 概率剧情 / CP 相关、30% 概率纯日常（午餐 / 加班 / 猫狗）</li>
                    <li><strong>CP 粉</strong> — 安利党、抓糖分析 / 新粉教学 / 推荐同人文</li>
                </ul>

                <h4>中文圈情报站汉化搬运（v2.71.2 + v2.71.3）</h4>
                <p>「情报站」类 NPC 有两大数据源、跟真实中文圈情报博主一致：</p>
                <ul>
                    <li><strong>① 汉化推特官方推文</strong>（v2.71.2）— 30% 概率从推特上 broadcast.officialNpcs 发的最近 14 天推文里挑一条、用 LLM 翻译成中文、带「【情报搬运】来自官方 Twitter @xxx」格式</li>
                    <li><strong>② 汉化杂志专访</strong>（v2.71.3）— 你在杂志阅读器点「存入放送局」按钮时静默触发、直接用已 AI 压缩好的中文 summary 套模板拼接（零 token）、带「【杂志汉化】专访 / 节选：xxx / 来源：杂志声優专访」格式</li>
                </ul>
                <p>这两条数据源不重复（同一推文 / 同一杂志文章只搬运一次）、静默触发不弹 toast、刷微博时自然看到。</p>

                <h4>账号管理（参考推特）</h4>
                <ul>
                    <li>默认账户 <strong>Perigee 用户</strong>（橙色 P 占位、不指向真实身份）</li>
                    <li>可新建多个个人账号</li>
                    <li>下拉切换发帖身份 <strong>个人 ⇄ 官方</strong></li>
                    <li><strong>官方账号</strong>来自放送局 → 制作 NPC（声優 / 監督 / 制作公司 / 工作室）、跟推特 / Mercari / Magazine / Niconico 共用同一池</li>
                    <li>用官方账号发博会触发<strong>粉丝 70% 高反应率</strong>（赞 / 评 / 转发即时来）</li>
                </ul>

                <h4>超话 + 热搜（沉浸感铁律：零 UI）</h4>
                <ul>
                    <li><strong>超话</strong>自动播种 — 根据 broadcast.cpSettings 静默生成主角超话 / CP 超话 / 作品超话、不需要手动建</li>
                    <li><strong>热搜</strong>动态生成 — 跟随剧情 + CP + 混入娱乐 / 社会 / 财经中性底噪反衡、4 类标签（hot / new / boom）</li>
                </ul>

                <h4>发微博 composer</h4>
                <p>仿真真微博发博页（IMG_1593 风格）：</p>
                <ul>
                    <li>左上 × / 中间账号头像 / 右上 → 发送</li>
                    <li>「写点什么...」textarea（带橙色光标线）</li>
                    <li>3x 图片网格 + 图片占位</li>
                    <li>「你在哪里？」+「公开」chips</li>
                    <li>底部工具栏 — @ 和 # 按钮真插入字符（@ 提到 / # 超话）、其他按钮装饰</li>
                    <li>「草稿」按钮 + 字数实时显示</li>
                </ul>

                <h4>深色模式</h4>
                <p>「我的」tab → 点击「深色」行右侧 iOS 风格 toggle 开关、整个微博 app 深色化（不影响其他模块）。状态持久化到 weiboData.darkMode。</p>

                <h4>中文同人圈独立 API（设置 → API 集成）</h4>
                <p>设置 → API 集成新「中文同人圈 API」section、跟全局 LLM API 独立：</p>
                <ul>
                    <li>4 preset 下拉：<strong>DeepSeek 默认</strong> / OpenAI / Gemini / Claude</li>
                    <li>选 preset 后 URL 自动填</li>
                    <li>点击「<strong>获取模型</strong>」按钮动态拉真实可用模型列表（future-proof、模型名升级不用改代码）</li>
                    <li>不启用时 fallback 走全局 LLM API</li>
                </ul>

                <h4>简体中文铁律</h4>
                <p>所有 LLM 生成内容（NPC bio / 微博 / 评论 / 私信 / 热搜 / 超话描述）<strong>强制简体中文输出</strong>。每个 prompt 末尾铁律「必须使用简体中文输出」。不做日中翻译折叠 — 中文圈本来就是中文平台、做了反而画蛇添足。</p>

                <h4>数据隔离</h4>
                <p>微博的 fanFriends 独立于推特的 fanFriends（中日圈彻底隔离）。未来 lofter 模块会跟微博共用 weiboData.fanFriends 中文圈共享池。</p>

                <div class="help-callout">
                    <strong>关键设计：沉浸感铁律</strong> — 微博模块不加管理 UI / 自动播种零 toast 零 modal、跟 pixiv 同人作者池一样。整池重置藏在「设置 → 数据管理 → 重置中文圈 NPC 池」做 maintenance。
                </div>
            `
        },
        {
            id: 'mod-lofter',
            parent: 'social',
            title: 'Lofter（中文同人圈创作主战场）',
            body: `
                <p>v2.73.0 加入的<strong>中文同人圈生态阶段 2</strong>。Lofter 是中文同人圈的<strong>创作主战场</strong> — 跟微博是「广场」对应、Lofter 是「沉淀创作」的地方：节奏更慢、内容更深、文 / 图为主。</p>

                <h4>跟微博 / Pixiv 的边界</h4>
                <ul>
                    <li><strong>跟 Pixiv 不同</strong>：Pixiv 是纯创作、不读官方情报；Lofter 读官方情报、糖点挖掘 / 剧情讨论 / 周边情报都基于已发生剧情</li>
                    <li><strong>跟微博不同</strong>：微博是广场、节奏快碎；Lofter 是创作、节奏慢深</li>
                    <li><strong>NPC 池共用</strong>：跟微博共用 weiboData.fanFriends 中文圈池、每个 NPC 加 lofter:{} 子字段（不动现有 fanFriends 任何字段）</li>
                    <li><strong>4 类活跃 NPC</strong>：fan_writer（写文）/ fan_artist（发图）/ cp_fan（抠糖）/ info_station（情报）。group_organizer / daigou / daily_fan 在 lofter 上静默过滤、不发文</li>
                </ul>

                <h4>4 个 tab</h4>
                <ul>
                    <li><strong>首页</strong> — 发现 / 广场 sub-tab + 子分类 chip（推荐 / 听书 Beta / 连载 / 视频 / 太太摆摊）+ 大 banner + 双栏瀑布流文章卡。右上刷新按钮（手动追加 6 篇）</li>
                    <li><strong>关注</strong> — 关注子tab（正在更新太太头像横滚 + 信息流）+ 订阅子tab（标签 / 合集 / 粮单 / 高级粉丝 4 chip）</li>
                    <li><strong>中间 + 凸起按钮</strong> — 发布作品（占位 toast：lofter 创作功能即将上线、目前只能浏览太太们的作品）</li>
                    <li><strong>网易乐谷</strong> — 占位 toast（不在仿真范围）</li>
                    <li><strong>我的</strong> — 4 数据（文章 / 热度 / 粉丝 / 关注）+ 4 入口（喜欢/收藏 / 我的订阅 / 我的足迹 / 稍后再看）+ 4 消息占位 + 创作者中心 note</li>
                </ul>

                <h4>文章生成机制</h4>
                <p>仿 Pixiv 模式但 <strong>不复用 Pixiv 代码字面量</strong>、纯中文 prompt 重写：</p>
                <ul>
                    <li><strong>短文批量</strong>（首页刷新触发）— 仿微博 batch 同款一次请求多段返回、---LOF--- 分隔解析。生态底色：lofter 不是微博（节奏更慢内容更深）、4 类 NPC type 画像、用语策略沿用 v2.72.3 哲学（给方向不给词）</li>
                    <li><strong>长篇章节</strong>（用户进合集页 chapterCount=0 / autoGen 触发）— 单次 LLM 生成 1500-3000 字章节、视角第三人称限制、滑动窗口 FULL_TEXT_WINDOW=3</li>
                    <li><strong>合集元数据</strong>（创建合集时）— LLM 生成名 + 描述 + 情绪标签（很甜 / 很虐 / 很真实 / 很治愈 / 很离谱）</li>
                    <li><strong>Plot Gate</strong> — 防剧透：糖点 / 剧情分析必须基于已发生剧情、不要捏造剧情节点之后的内容</li>
                </ul>

                <h4>核心交互闭环（作者强调的）</h4>
                <p>对喜欢的文章<strong>点喜欢 ♥ / 收藏 ☆ → 在「我的喜欢/收藏」里按月分组回看</strong>。这是 lofter 的灵魂体验、跟真平台一致。</p>
                <ul>
                    <li>♥ 喜欢 → myLikedArticleIds + 累积该 tag 陪伴值 +2</li>
                    <li>☆ 收藏 → myFavoritedArticleIds + 陪伴值 +3 + toast「可在我的收藏查看」</li>
                    <li>稍后再看 → myReadLaterArticleIds（详情页右下浮动 FAB）</li>
                    <li>浏览历史 → 自动记 myFootprintArticleIds（capped 200）</li>
                </ul>

                <h4>Tag 详情页（绿色渐变背景）</h4>
                <ul>
                    <li>大标题 + 浏览量 / 参与数 + 圈氛围 chip「评论友好」</li>
                    <li><strong>我的陪伴值 N</strong> — 进 tag 详情 +1、点 ♥ +2、点 ☆ +3、累积体感</li>
                    <li>我圈太太（关注作者中在此 tag 发过文的头像组）+ 合集粮单入口</li>
                    <li>4 子 tab：发现 / 最新 / 最热（默认）/ 动态</li>
                    <li>筛选 chip：全部 / 日榜 / 周榜 / 月榜（最热 sub-tab 下）</li>
                    <li>Lazy seed：进 tag + 该 tag articles < 5 → 自动调一次 LLM 生成 5 篇</li>
                </ul>

                <h4>合集页（长篇连载组织）</h4>
                <ul>
                    <li>合集封面 + 名 + 描述 + 订阅合集 button + 情绪标签「N 人觉得很甜」</li>
                    <li>正序 ↕ / 倒序 切换 + 列表 / 网格视图切换</li>
                    <li>章节列表（标题 + summary + 热度）</li>
                    <li><strong>当前在看</strong>高亮（从 myFootprintArticleIds 取最近一条属于本合集的章节）</li>
                    <li>进合集 + chapterCount === 0 → 自动生成第 1 章</li>
                </ul>

                <h4>文章详情页</h4>
                <ul>
                    <li>顶 bar：作者头像名 + 关注按钮 + 分享</li>
                    <li>标题 + summary（下划线样式）+ 段落正文</li>
                    <li>文末标签 chip + 编辑于 X · 地区 + 热度 + ☆ 收藏 button</li>
                    <li>合集悬浮卡（如属于合集）：合集名 + 情绪标签 +「上一篇 / 目录 / 下一篇」三件套</li>
                    <li>评论嵌套（仿微博 v2.72.6）+ 博主回复橙色徽章</li>
                    <li>浮动「稍后再看」FAB + 底部 sticky bar（评论框 + ♥ + 评论数）</li>
                </ul>

                <h4>微博联动</h4>
                <p>微博 fan_writer NPC 发的 <strong>long 类型博文</strong>（自宣 lofter 新作）点击「全文 → 网页链接」会跳到对应 Lofter 文章详情页。事件触发型反查 — 自动找该 NPC 最近 7 天的 lofter long article、不依赖 LLM prompt。如果该 NPC 在 lofter 没发文、保留原 toast 行为。</p>

                <h4>剧情更新自动生成</h4>
                <p>设置（顶 bar 右上设置 icon）→ 自动生成 section：</p>
                <ul>
                    <li>勾选「剧情更新时自动生成内容」</li>
                    <li>设置每次生成数量（1-5）</li>
                    <li>放送局新增剧情节点时、lofter 后台 fire-and-forget 自动生成 N 篇内容（仿 pixiv 同款独立开关）</li>
                    <li>策略：合集 < 2 时创建新合集 / 已有合集时续章 / 剩余配额做短文批量</li>
                </ul>

                <h4>不在仿真范围（占位）</h4>
                <p>用户发文 / 划线评（段落级评论）/ 24h 接力活动 / 粮单深度（订阅 + 创建）/ 网易乐谷 / 创作者中心数据统计 / 听书 / 视频 / 太太摆摊 / 评论真实提交 — 这些都点击 toast 占位、未来版本可能加入。</p>

                <div class="help-callout">
                    <strong>沉浸感铁律</strong> — Lofter 模块零管理 UI：用户不能主动创建合集、不能编辑文章、不能管理 NPC 池。合集 / 文章 / 章节都由 NPC 自动产生（init 时 + 剧情更新触发 + 用户进空合集触发）。这是作者的设计原则、跟 pixiv 同人作者池保持一致。
                </div>
            `
        },

        // ==================== 创作模块 ====================
        {
            id: 'creation',
            title: '创作模块',
            type: 'group'
        },
        {
            id: 'mod-pixiv',
            parent: 'creation',
            title: 'Pixiv（小说 + 插画）',
            body: `
                <h4>Pixiv 小说</h4>
                <p>AI 写同人小说，可以从论坛 / 推特讨论里"接梗"再创作。当 メロンブックス 生成了你感兴趣的同人志，可以一键推送到 Pixiv 写完整小说。</p>
                <ul>
                    <li>设置 CP / 自定义 prompt / 小说规则</li>
                    <li><strong>双语模式</strong> — 日中对照（每 3-5 段日语后跟一段中文翻译）</li>
                    <li>续写 / 重写 / 章节管理</li>
                    <li>收藏 / 导出</li>
                </ul>

                <h4>Pixiv 设置</h4>
                <ul>
                    <li><strong>论坛绑定</strong> — 自动用放送局世界设定 + 剧情时间线 + 绑定的世界书</li>
                    <li><strong>额外世界书</strong> — 在放送局绑定之外再叠加 Pixiv 专用的世界书</li>
                    <li><strong>CP 默认</strong> + <strong>CP 简称</strong></li>
                    <li><strong>写作规则</strong> — 文风、视角等约束</li>
                </ul>

                <h4>从メロン一键转小说</h4>
                <p>在 メロン 看到喜欢的本子简介 → 一键转 Pixiv 写完整小说。标题 / CP / tag / 简介自动带过来，你只需要点生成。</p>

                <h4>Pixiv 插画</h4>
                <p>接 NovelAI / DALL-E 等图片 API。基于 CP 设定 + 关联世界书提示词生成插画。先到 设置 → API 设置 → 图片 API 配好。</p>

                <h4>同人作者 NPC 池（v2.70.0 新加）</h4>
                <p>Pixiv 自动生成小说时、有概率从推特 fanFriends 里的「同人文手」NPC 池里挑一位当作者：</p>
                <ul>
                    <li>用该 NPC 的 writingStyleId 注入 prompt</li>
                    <li>小说卡片底部的 author 字段变成<strong>链接 → 点击跳推特 fanFriend profile</strong>、能看到该作者的简介 / 在推特上的活动 / 其他作品列表</li>
                    <li>该作者会在推特上按 promoteStyle 延迟自然 mention 新作（自宣推 + PIXIV_LINK 卡片）</li>
                </ul>
                <p>不需要任何管理 UI — 同人作者池在首次进 Pixiv 时<strong>后台静默播种 5 位 doujin_writer NPC</strong>（条件：worldContext + CP 双方都填了）。整池重置藏在「设置 → 数据管理 → 重置同人作者池」做 maintenance。</p>
                <p>编辑单个作者的喜好走<strong>推特 fanFriend profile 的「彼女の好み」折叠区</strong>（默认折叠，避免管理感扑面而来）。</p>
            `
        },
        {
            id: 'mod-magazine',
            parent: 'creation',
            title: '雑誌（含广播剧生成）',
            body: `
                <p>模拟动漫杂志（Newtype / アニメージュ 風）。AI 生成专题文章、声優访谈、新作介绍。</p>

                <h4>能生成的内容类型</h4>
                <ul>
                    <li><strong>角色访谈</strong> — 采访某个角色（用 in-character 的语气）</li>
                    <li><strong>声優访谈</strong> — 采访饰演角色的声優</li>
                    <li><strong>座谈会 / 对谈</strong> — 多人对谈</li>
                    <li><strong>专题特集</strong>、人气投票、相关图、读者来信、月度总结</li>
                </ul>

                <h4>一键生成广播剧（重点功能）</h4>
                <p>这是 Perigee OS 最特别的功能之一。条件是：</p>
                <ol>
                    <li>已配 TTS API（MiniMax，见后面章节）</li>
                    <li>放送局里有标记为「声優」role 的 NPC，并设了 voiceId</li>
                    <li>这些声優 NPC 关联了对应的角色（voicedCharacters）</li>
                </ol>
                <p>满足之后，杂志阅读器右上角出现 <strong>🎙️ 生成广播剧</strong> 按钮：</p>
                <ol>
                    <li>系统自动解析杂志台词，按发言人分段</li>
                    <li>找每个角色对应的声優和 voiceId</li>
                    <li>调 TTS 合成每段音频</li>
                    <li>结果自动发布到 ニコニコ動画，带分段播放器</li>
                </ol>

                <h4>当 AI 读不准角色名（当て字）</h4>
                <p>比如「月見里」AI 不知道读「ヤマナシ」。这种时候去 设置 → API → TTS → <strong>当て字読音対照表</strong> 加一行：<code>月見里 → ヤマナシ</code>，全局生效。排序按 from 长度倒序，避免短词吃长词。</p>

                <h4>跨模块联动</h4>
                <p>访谈完成后可一键转为放送局情报，让 NPC 在论坛展开二次讨论。期刊形式管理。</p>

                <h4>「存入放送局」会触发微博情报站汉化搬运（v2.71.3 新加）</h4>
                <p>点击「存入放送局」按钮、除了把文章压缩成中文摘要存进官方情报库、还会<strong>静默触发微博情报站汉化搬运</strong>：</p>
                <ul>
                    <li>微博的「同人圈情报搬运站」类 NPC 会自动生成一条搬运博文</li>
                    <li>内容是「【杂志汉化】专访：xxx / 节选：&lt;首段中文摘要&gt; / 来源：杂志专访」格式、模仿真实中文圈情报博主</li>
                    <li>零 token —— 直接用已经 AI 压缩好的中文 summary 作节选、不再调 LLM 翻译</li>
                    <li>用文章 id 去重、同一篇不会被重复搬运</li>
                    <li>沉浸感铁律：用户感觉不到「触发」这件事、刷微博时自然看到「咦这个情报站也搬运了」</li>
                </ul>
                <p><strong>触发点为什么是「存入放送局」而不是「翻译全文」</strong>：用户存入 = 已认可翻译质量 + 决定保留 = 该曝光。如果用户对翻译不满意删了文章、不影响已搬运的微博博文（独立存活、跟真实情报站推文一样）。</p>
            `
        },
        {
            id: 'mod-melon',
            parent: 'creation',
            title: 'メロンブックス（同人ショップ）',
            body: `
                <p>同人ショップ模拟。</p>

                <h4>能逛什么</h4>
                <ul>
                    <li><strong>商品列表</strong> — 带封面、社团、CP 标签</li>
                    <li><strong>商品详情</strong> + 加入购物车</li>
                    <li><strong>社团页</strong> — 特定社团的全部作品</li>
                    <li><strong>活动页</strong> — コミケ、サンクリ 等</li>
                    <li><strong>特集页</strong> — 限时主题</li>
                    <li>购物车结算</li>
                </ul>

                <h4>剧情联动</h4>
                <p>放送局剧情进度推进时，"预售"商品会自动转为"发售中"。</p>

                <h4>一键转 Pixiv 写完整小说（重点）</h4>
                <p>看到 AI 生成的有趣同人志简介，可以<strong>一键转到 Pixiv 进行 web 再录</strong> — 标题、CP、tag、简介自动带过去，你只需要点「生成」就能拿到全文。</p>
                <p>这个流程让"想到一个本子点子 → 真正写出来"变成一次点击的事。</p>
            `
        },
        {
            id: 'mod-mercari',
            parent: 'creation',
            title: 'メルカリ（二手市场）',
            body: `
                <p>二手市场模拟。看你在放送局发布的官方周边在一个拟真的二手市场上流通 — 被炒价、被求购、秒空，甚至被仿冒。</p>

                <h4>数据从哪来</h4>
                <p>メルカリ 里的出品全部来自<strong>放送局情报库里「贩售中」状态的周边</strong>。在放送局把周边情报标成贩售中，它就会出现在二手市场上。</p>

                <h4>行情怎么走</h4>
                <ul>
                    <li>出品按你创作的<strong>角色 / CP 聚合</strong>，可以一眼看到谁名下的周边最抢手</li>
                    <li><strong>价格随剧情自动波动</strong> — 在放送局写一段某角色的高光戏，他名下周边的二手价会跟着上涨</li>
                    <li>越贵越抢手的周边，越容易招来<strong>黄牛</strong>（挂天价）和<strong>假货</strong></li>
                </ul>

                <h4>黄牛与假货</h4>
                <p>假货会潜伏在普通出品里，靠卖家介绍和买家留言区的<strong>线索</strong>去看破。买之前多翻翻留言。</p>

                <h4>留言区是 AI 生成的</h4>
                <ul>
                    <li>卖家介绍和买家留言都由 AI 生成</li>
                    <li><strong>默认懒加载</strong> — 点进某个出品才生成它的留言区，不点的出品不消耗 API</li>
                    <li>可以在 メルカリ 设置里<strong>单独配一个 API</strong>，独立于全局 LLM API</li>
                </ul>

                <h4>跨模块联动</h4>
                <p>放送局 → 情报库标「贩售中」的周边 → メルカリ 自动上架并参与行情；剧情推进 → 角色名下周边价格波动。</p>
            `
        },
        {
            id: 'mod-niconico',
            parent: 'creation',
            title: 'ニコニコ動画',
            body: `
                <p>弹幕视频站，可以听广播剧、访谈。</p>

                <h4>视频来源</h4>
                <ul>
                    <li>手动添加（标题、封面、外链）</li>
                    <li><strong>杂志生成的广播剧自动发布到这里</strong>（标记为🎙️音频类型）</li>
                </ul>

                <h4>广播剧播放器</h4>
                <p>分段播放 + 当前发言人高亮 + 自动续播 + 进度条。可以重头听、跳段。</p>

                <h4>弹幕</h4>
                <p>所有视频 / 广播剧支持弹幕，AI 会自动生成代表观众反应的弹幕，从右往左滚动。</p>

                <h4>频道页</h4>
                <p>Youtuber / VTuber 风格频道首页。</p>
            `
        },
        {
            id: 'mod-lyric',
            parent: 'creation',
            title: '楽曲（Music Lab）',
            body: `
                <p>从剧情到歌词到音频的完整楽曲创作工坊。读取放送局的剧情和世界书做创作素材，调用 LLM 写歌词 + 写曲风提示，最后调 MiniMax 真出一首 mp3。</p>

                <h4>三段 pipeline（中间可暂停 / 重做）</h4>
                <ol>
                    <li><strong>① 写歌词</strong> — LLM 读放送局完整 arc + 选中世界书 + 你的指示，输出带 [Verse]/[Chorus] 段落标签的歌词</li>
                    <li><strong>歌詞確認待ち</strong>（用户确认环节） — 详情页可以「歌詞を書き直す」反复重写，直到满意了再点「この歌詞で楽曲を生成 →」</li>
                    <li><strong>② 写音乐风格 prompt</strong> — LLM 根据楽曲タイプ + 歌词内容，自动生成英文标签串（"Anime ED, J-Pop, Acoustic, Female Vocal..."）</li>
                    <li><strong>③ MiniMax 楽曲合成</strong> — 调 music-2.6 模型，30 秒 ~ 2 分钟出 mp3，hex 格式落到本地 IndexedDB（永久持有）</li>
                </ol>
                <p>每段完成都立刻保存。中间任何一段失败、UI 不满意，可以单段重做。</p>

                <h4>创建一首歌</h4>
                <ol>
                    <li>「+」按钮打开创建弹窗</li>
                    <li><strong>タイトル</strong>（任意 — 空着 LLM 自己起名字）</li>
                    <li><strong>楽曲タイプ</strong> — OP / ED / 挿入歌 / キャラソン / イメージソング / 純音楽（BGM）/ テーマソング / その他</li>
                    <li><strong>関連プロット</strong>（任意 — 「这首歌发售时所在的话数」语义，<u>不是「歌的内容素材」</u>。角色歌 / ED / 完结纪念曲应该综合整个 arc 写）</li>
                    <li><strong>具体的な指示</strong>（任意） — 例：「ヒロインが X の瞬間の心境」「戦闘高潮の挿入歌」「○○のキャラソン」</li>
                </ol>

                <h4>需要提前准备</h4>
                <ul>
                    <li>「设置 → API → TTS」配置 MiniMax（Provider = MiniMax + API Key）— 音乐和语音共用同一个 key</li>
                    <li>放送局至少一些素材（剧情 / 绑定的世界书）— 越完整 AI 写得越贴合</li>
                    <li>MiniMax 计费：要走 token plan 或者付费版才能用 music-2.6 模型</li>
                </ul>

                <h4>歌词写作小提示</h4>
                <ul>
                    <li>不要用「宇宙（そら）」这种汉字注音格式 — Suno 能识别，MiniMax 会把汉字和假名都唱出来。要让某个汉字读假名就直接写假名。<u>系统 prompt 里已经禁止这种格式了</u>，但万一 LLM 还是出现了你看到了可以「歌詞を書き直す」</li>
                    <li>纯音楽（BGM/サントラ）跳过歌词环节直接合成（[Instrumental] placeholder）</li>
                    <li>「キャラソン必填角色」这种校验已经没有 — 想为某个角色写歌直接在「具体的な指示」里说就行</li>
                </ul>
            `
        },

        // ==================== 辅助工具 ====================
        {
            id: 'tools',
            title: '辅助工具',
            type: 'group'
        },
        {
            id: 'mod-writer',
            parent: 'tools',
            title: '写作 & 邮件 / 词典 / 知识库',
            body: `
                <h4>写作环境（Mailbox）</h4>
                <p>当作"邮件式日记本"用，也可以让 AI 帮你校稿、润色、续写。</p>
                <ul>
                    <li>主题、内容、写作领域、素材类型</li>
                    <li>AI 校对、润色、续写</li>
                </ul>

                <h4>词典</h4>
                <p>任意页面选中文字 → 加进单词本。卡片式复习，AI 生成例句和释义。</p>

                <h4>知识库</h4>
                <p>自建参考资料库，写作时可以引用。</p>
            `
        },
        {
            id: 'mod-fortune',
            parent: 'tools',
            title: '占卜 & 塔罗',
            body: `
                <h4>Fortune（占卜）</h4>
                <ul>
                    <li>每日运势 / 每周运势</li>
                    <li>今日宜忌（黄历）</li>
                    <li>专题运势（恋爱 / 事业 / 财运）</li>
                </ul>

                <h4>Tarot（塔罗）</h4>
                <ul>
                    <li>单张抽牌</li>
                    <li>三牌阵（过去 / 现在 / 未来）</li>
                    <li>凯尔特十字（10 张）</li>
                    <li>AI 解读 + 牌意提示</li>
                </ul>
            `
        },
        {
            id: 'mod-travel',
            parent: 'tools',
            title: '旅行账本',
            body: `
                <p>出行 / 出差 / コミケ参战记账。</p>
                <ul>
                    <li>多币种（自动汇率）</li>
                    <li>同伴均摊</li>
                    <li>预算 vs 实际对比</li>
                    <li>分类（住宿 / 交通 / 餐饮 / 周边 / 杂项）</li>
                    <li>导出报销 PDF</li>
                </ul>
            `
        },
        {
            id: 'mod-learn',
            parent: 'tools',
            title: '学习工具（四合一）',
            body: `
                <h4>单词本（Dictionary）</h4>
                <p>任意页面选中文字 → 加入单词本。卡片式复习，AI 生成例句和释义。</p>

                <h4>AI 答疑（Tutor）</h4>
                <ul>
                    <li>提任何语言学习问题</li>
                    <li>自动语法分析、对话练习</li>
                </ul>

                <h4>题库（Quiz）</h4>
                <ul>
                    <li>N5 - N1 难度等级</li>
                    <li>AI 自动出题</li>
                    <li>错题本</li>
                </ul>

                <h4>对话润色（Dialogue Polish）</h4>
                <p>输入你写的句子 → AI 给出更地道的表达 + 解释为什么。</p>
            `
        },

        // ==================== 声音 / TTS ====================
        {
            id: 'audio',
            title: '声音 / 语音',
            type: 'group'
        },
        {
            id: 'minimax-setup',
            parent: 'audio',
            title: 'MiniMax TTS 注册与配置',
            body: `
                <p>Perigee OS 的语音功能（角色发语音、Space 配音、广播剧）目前主要支持 <strong>MiniMax T2A v2</strong>。</p>

                <h4>第 1 步：注册账号</h4>
                <p>MiniMax 分为<strong>中国站</strong>和<strong>海外站</strong>，先去对应站点注册登录：</p>
                <ul>
                    <li>中国站：<code>https://account.minimaxi.com/unified-login</code></li>
                    <li>海外站：<code>https://platform.minimax.io/login</code></li>
                </ul>

                <h4>第 2 步：拿 Group ID</h4>
                <p>注册后点击"查看团队信息"，复制好<strong>团队 id（group id）</strong>，填入 Perigee OS TTS 设置的 Group ID 字段。</p>
                <p>记住：</p>
                <ul>
                    <li>提供商选 <strong>MiniMax</strong></li>
                    <li>区域选你<strong>注册的那个区域</strong>（中国站选 China，海外站选 International）</li>
                </ul>

                <h4>第 3 步：拿 API Key</h4>
                <p>同样在 MiniMax 后台，点击"接口密钥" → 创建新的 API key → 复制后填入 Perigee OS 对应位置。</p>

                <h4>第 4 步：充值</h4>
                <p>克隆音色和调用语音都会收取费用，<strong>建议充值 5-10 美金</strong>起步。</p>

                <div class="help-callout">
                    <strong>填完之后</strong>：在杂志、Space、LINE 等带语音功能的地方就能用了。如果只想用预设音色（不做声线克隆），到此结束。继续往下是声线克隆教程。
                </div>
            `
        },
        {
            id: 'minimax-clone',
            parent: 'audio',
            title: 'MiniMax 声线克隆完整流程',
            body: `
                <p>把你喜欢的声優声音克隆成 MiniMax 可调用的 voice id，绑到放送局 NPC 上。</p>

                <h4>第 1 步：进入解决方案平台</h4>
                <p>克隆语音<strong>推荐使用 MiniMax 官方的解决方案平台</strong>：</p>
                <p><code>https://solutions.minimaxi.com/</code></p>
                <p>进去后点击右上角 API key，填入对应的 key（根据你账号区域选填）。</p>

                <h4>第 2 步：上传干音做克隆</h4>
                <p>左侧栏「音色管理列表」→ 点击「<strong>音色复刻</strong>」：</p>
                <ul>
                    <li><strong>上传文件</strong>：10 秒 - 5 分钟的高质量干音，不超过 20MB</li>
                    <li><strong>配置 voice id</strong>：用 MiniMax 默认给的即可</li>
                    <li><strong>语音增强</strong>：建议勾选「日语」（如果干音是日语的话）</li>
                    <li><strong>试听配置</strong>：建议输入一段话用于试听。<strong>会收取一定费用，但能确认克隆的声音是否符合预期</strong></li>
                </ul>
                <p>全部输入完后点「开始复刻」，会生成一段试听音频。</p>

                <h4>第 3 步：试听 + 复制 voice id</h4>
                <p>试听如果满意，<strong>复制好 voice id</strong>，进入下一步。不满意就重新上传更好的干音。</p>

                <h4>第 4 步：必须先调用一次（关键！）</h4>
                <p>到这里还没结束。<strong>MiniMax 官方要求生成的 voice id 必须经过一次调用 + 扣费才能正常使用</strong>。继续在解决方案平台操作：</p>
                <ol>
                    <li>点击调试台的「同步语音生成」</li>
                    <li>合成文本中输入一段文字</li>
                    <li>音色设置那边选「自定义输入」，填入刚刚满意的 voice id</li>
                    <li>点击「发送请求」</li>
                </ol>
                <p>最后查看「音色管理列表」的克隆音色，确定克隆已经成功保存。</p>

                <h4>第 5 步：绑到放送局 NPC</h4>
                <p>把得到的 voice id 填入<strong>放送局 → 角色 Tab → 编辑 NPC → voiceId 字段</strong>。</p>
                <p>之后这个 NPC 在广播剧、访谈、Space 配音生成时就会用这个克隆的声音。</p>

                <div class="help-callout">
                    <strong>声優中心的设计</strong>：Perigee OS 把 voiceId 绑在声優 NPC 而不是直接绑角色。一个声優关联多个角色，改一次 voiceId 所有他配音的角色都跟着换。
                </div>
            `
        },

        // ==================== 数据管理 ====================
        {
            id: 'data',
            title: '数据管理',
            type: 'group'
        },
        {
            id: 'data-backup',
            parent: 'data',
            title: '备份 / 导出 / 导入',
            body: `
                <p>设置 → 数据管理。</p>

                <div class="help-callout">
                    <strong>强烈建议每次大改前都备份</strong>。所有数据存在你浏览器的 IndexedDB 里，<strong>没有云端</strong>。清浏览器缓存 / 卸载 PWA / 换设备 都会丢。
                </div>

                <h4>三种导出方式</h4>
                <ul>
                    <li><strong>导出全部数据</strong> — 整个 AppState 序列化（含 API key、所有 module 数据、桌面布局、自定义图标）。最完整</li>
                    <li><strong>选择板块导出</strong> — 弹窗勾选 18 个 module 子集导出。适合"我只想分享世界书"或"备份这次会话"</li>
                    <li><strong>导入</strong> — 选 JSON 文件 → 自动识别文件含哪些 module → 你勾选要回填的 → <strong>只覆盖选中的</strong>，其他保持不变（不会因为旧备份缺字段就清空你的新数据）</li>
                </ul>

                <h4>18 个备份模块</h4>
                <p>LINE 聊天 / 放送局 / 论坛 / 推特 / Pixiv / 杂志 / メロン / ニコニコ / 写作邮件 / 歌词 / 占卜塔罗 / 旅行 / 学习 / 日历 / 桌面美化 / 个人身份 / 钱包 / 世界书 / 系统设置</p>

                <h4>清空全部</h4>
                <p>"清空全部数据" — 保留 API 设置、世界书、系统设置、桌面布局；其他全清。</p>

                <h4>存储用量</h4>
                <p>数据管理顶部有进度条。IndexedDB 限制约 50MB，到 85% 会变红警告，建议导出备份后清理。</p>

                <h4>跨设备</h4>
                <p>没有自动同步。手动流程：原设备导出 → 文件传到新设备（AirDrop / 邮件 / 网盘）→ 新设备导入。</p>

                <h4>建议频率</h4>
                <p>每周一次最稳，至少每月一次。</p>
            `
        },

        // ==================== FAQ ====================
        {
            id: 'faq',
            title: '常见问题',
            type: 'group'
        },
        {
            id: 'faq-broadcast-icon',
            parent: 'faq',
            title: '主屏看不到放送局图标？',
            body: `
                <p>老用户的桌面布局可能把图标自动放到第一个空位（不一定在第一页第一行）。</p>
                <ul>
                    <li>左右滑动主屏找一下</li>
                    <li>或长按桌面进入编辑模式手动调位置</li>
                    <li>实在找不到：设置 → 美化设置 → 重置桌面布局</li>
                </ul>
            `
        },
        {
            id: 'faq-upgrade-data',
            parent: 'faq',
            title: '升级到 v2.60 后旧数据还在吗？',
            body: `
                <p>在。v2.60 启动时会自动跑一次性迁移：</p>
                <ul>
                    <li>把 <code>forumData</code> 里的 worldSetting / plotProgress / officialInfo / officialNpcs / mergedSummaries 等搬到新的 <code>broadcast</code> 命名空间</li>
                    <li>砍掉的多板块功能：<strong>保留当前激活的板块</strong>作为唯一数据，其他板块的内容会丢</li>
                    <li>早期"AI 用官方名义在论坛发帖"功能：旧 officialPosts 数据合并进普通 threads，作为论坛帖保留</li>
                </ul>
                <p>迁移幂等，重启不会重复触发。</p>
                <p><strong>如果担心，升级前导出一次全量备份</strong>，万一不满意可以导回 v2.59-stable。</p>
            `
        },
        {
            id: 'faq-multi-board',
            parent: 'faq',
            title: '论坛多板块功能去哪了？',
            body: `
                <p>v2.60 砍掉了 — 之前几乎没人用。</p>
                <p>如果你之前确实在用多套板块，升级前请务必导出全量备份，迁移只保留当前激活的那套，其他会丢。</p>
            `
        },
        {
            id: 'faq-sw-cache',
            parent: 'faq',
            title: 'SW 缓存了旧版？',
            body: `
                <h4>方法 1（轻量）</h4>
                <p>等待 PWA 主页面下拉时弹出"有新版本"提示，点击更新即可。</p>

                <h4>方法 2（强制）</h4>
                <p>打开浏览器开发者工具：</p>
                <ul>
                    <li>Application → Service Workers → 找到 本站 的 SW → Unregister</li>
                    <li>Application → Storage → Clear site data（这会清你的所有数据，<strong>做之前先备份！</strong>）</li>
                </ul>
            `
        },
        {
            id: 'faq-api-error',
            parent: 'faq',
            title: 'API 报错怎么办',
            body: `
                <h4>401 Unauthorized / API key invalid</h4>
                <p>API key 填错了 — 检查有没有多余空格、是否复制完整。重新粘一次。</p>

                <h4>404 Not Found / Model not found</h4>
                <p>model 名错了。不同服务商命名不一样：</p>
                <ul>
                    <li>OpenAI：<code>gpt-4o</code> / <code>gpt-4-turbo</code></li>
                    <li>Gemini：<code>gemini-2.5-flash</code> / <code>gemini-2.5-pro</code></li>
                    <li>Claude：<code>claude-3-5-sonnet-20241022</code></li>
                    <li>DeepSeek：<code>deepseek-chat</code></li>
                </ul>
                <p>查官方文档拿到完整 ID 再填。</p>

                <h4>CORS / Failed to fetch</h4>
                <p>浏览器跨域被拦。可能原因：endpoint URL 错（少了 <code>/v1</code> 之类）/ 用的代理服务器没开 CORS / 网络问题（部分 LLM 国内要梯子）。</p>

                <h4>429 Rate limit</h4>
                <p>请求太快超额度。等一会儿再试，或换更高额度的 plan。</p>
            `
        },
        {
            id: 'faq-local-run',
            parent: 'faq',
            title: '能本地跑吗？',
            body: `
                <p>可以但有限制。</p>
                <ul>
                    <li><code>python3 -m http.server 8000</code> 启动后访问 <code>localhost:8000</code></li>
                    <li>大部分功能正常</li>
                    <li>但<strong>认证服务</strong>跑在独立的认证后端上，纯本地（file://）打开时连不上 — 所以本地直接打开会卡在认证页</li>
                </ul>
                <p>完整本地体验需要自己部署 Node.js 认证服务到 <code>127.0.0.1:3847</code>。</p>
            `
        },
        {
            id: 'faq-data-lost',
            parent: 'faq',
            title: '数据丢了怎么办？',
            body: `
                <p>只要还有备份 JSON：设置 → 数据管理 → 导入 → 选择文件。</p>
                <p>只要 IndexedDB 没被清：浏览器开发者工具 → Application → IndexedDB → PerigeeOS → 内容还在那。</p>
                <p>如果都没了 — 抱歉。下次养成<strong>定期"全量导出"习惯</strong>。</p>
            `
        },
        {
            id: 'faq-share',
            parent: 'faq',
            title: '推荐给朋友怎么操作？',
            body: `
                <p>Perigee OS 在线演示站采用<strong>邀请制</strong>，朋友需要访问码才能进入。</p>

                <h4>朋友第一次使用</h4>
                <ol>
                    <li>把本站链接发给朋友</li>
                    <li>用账号密码登录</li>
                    <li>登进去之后会自动看到本帮助中心的引导（首次启动）</li>
                    <li>按引导先配 API → 然后随意探索</li>
                </ol>

                <h4>分享你的角色 / 设定</h4>
                <p>设置 → 数据管理 → 选择板块导出 → 勾选要分享的（比如世界书、放送局、Pixiv）→ 朋友导入即可复用。</p>
            `
        }
    ],

    // 获取分组（type='group'）
    getGroups() {
        return this.sections.filter(s => s.type === 'group');
    },

    // 获取某分组下的子项
    getChildren(groupId) {
        return this.sections.filter(s => s.parent === groupId);
    },

    // 按 id 找
    find(id) {
        return this.sections.find(s => s.id === id);
    }
};
