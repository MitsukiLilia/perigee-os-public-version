// Perigee OS - 主应用入口（模块化版本）
// 各功能模块已拆分到 js/ 文件夹中

// ===== 全局状态 =====
const AppState = {
    currentScreen: 'desktop',
    currentCharacter: null,
    data: {
        characters: [],
        groups: [],         // LINE グループ [{id, name, memberIds[], createdAt}]
        conversations: {},
        chatMeta: {},       // {charId or grp_groupId: {isPinned, isMuted, unreadCount, ...}}
        chatSettings: {     // LINE 聊天设置
            useLineGreen: true,
            bgColor: '#8cabd9',
            bgImageUrl: '',
            showRead: true,
            showTyping: true,
            fontSize: 'normal'
        },
        dictionary: [],

        // 新增：知识库
        knowledgeBase: [], // [{id, title, content}, ...]

        // 世界书
        worldBooks: [], // [{id, name, entries: [{id, title, keys: [], content}]}, ...]

        writerData: {
            title: '',
            content: '',
            // 新增：写作配置
            writingField: '', // 写作领域（如：法律、行政、技术等）
            materialType: ''  // 材料类型（如：合同、报告、通知等）
        },

        // 用户身份（文书专用）
        userProfile: {
            name: 'User',
            dept: '', // 部门
            role: '', // 职责
            bio: ''
        },

        // 多身份管理（可创建多个身份并绑定到不同角色）
        myPersonaPresets: [], // [{id, name, avatar, persona, bindings: {charId: {extraPersona, override}}}]
        activePersonaId: null, // 当前激活的身份ID（用于显示）

        // API 配置
        apiConfig: {
            mode: 'openai', // openai, google, claude, deepseek
            url: '', // 默认为空，由 fetch 逻辑处理
            key: '',
            model: 'gpt-3.5-turbo',
            temperature: 0.7
        },

        // 系统配置
        systemConfig: {
            language: 'zh', // zh, en, ja
            theme: 'winter-night', // winter-night, spring-day, summer-rain
            wallpaper: '' // 自定义壁纸URL
        },

        // 楽曲（v2.62.0 重构：放送局-centric，读 broadcast.plotProgress + worldBookIds，不再绑 CP）
        music: { songs: [] }, // songs: [{id, title, songType, plotId, userPrompt, lyrics, stylePrompt, audioId, stage, savedToForumId, createdAt}]

        // 论坛数据
        forumData: {
            forumRules: '',
            userName: '',
            isAnonymous: true,
            fontSize: 15,
            threads: [],
            favorites: [],
            legendNpcs: []
        },

        // 放送局：跨模块共享的世界元数据（worldSetting / 剧情 / 情报 / 官方NPC 等）
        broadcast: {
            worldSetting: '',
            worldBookId: '',
            worldBookIds: [],
            plotProgress: [],
            plotDrafts: [],
            officialInfo: [],
            officialNpcs: [],
            mergedSummaries: [],
            plotSummaries: [],
            officialSummaries: [],
            // v2.69.0: CP 配对设置（从 pixivData.settings 迁移过来）
            // v2.71.0: productionName 字段加入（微博作品超话用）
            cpSettings: { cpCharA: '', cpCharB: '', cpNickname: '', productionName: '' }
        },

        // 模拟X/推特数据
        // fanFriends schema（v2.70.0 扩展）:
        // {
        //   id, name, handle, type, avatarColor, bio, leakProne, createdAt, lineCharId,  // 现有字段（v2.69.0）
        //   // 以下字段 v2.70.0 新增、仅 type === 'doujin_writer' / 'doujin_artist' 使用
        //   pixivHandle: string,             // pixiv 上的 handle（default = handle）
        //   writingStyleId: string | null,   // 关联 settings.writingStyles 的某 style.id（仅 doujin_writer）
        //   contentTags: string[],           // 擅长的 CP / 主题
        //   promoteStyle: 'active' | 'occasional' | 'shy',  // 自宣性格
        //   melonbooksCircleId: string | null,  // 阶段 1 占位、未来手动绑圈
        //   hasUnlockableContent: boolean,      // 阶段 2.5 poipiku 占位
        // }
        twitterData: {
            userName: '公式アカウント',
            userHandle: 'official',
            userAvatarLetter: 'M',
            tweets: [],
            npcTweets: [],
            dms: {}
        },

        // 微博数据（中文同人圈生态、v2.71.0）
        // 与 twitterData 完全隔离、不共享 NPC
        // 详见 docs/superpowers/specs/2026-05-23-weibo-module-design.md
        weiboData: {
            accounts: [
                {
                    id: 'default',
                    name: 'Perigee 用户',
                    handle: 'perigee_user',
                    bio: '',
                    avatarLetter: 'P',
                    avatarColor: '#ff8200',
                    isVerified: false,
                    createdAt: Date.now()
                }
            ],
            currentAccountId: 'default',
            posts: [],
            fanFriends: [],
            topics: [],
            followedTopicIds: [],
            hotsearch: [],
            notifications: {
                mentions: [],
                comments: [],
                likes: [],
                dms: [],
                strangerDmIds: []
            },
            drafts: [],
            apiOverride: {
                enabled: false,
                mode: 'deepseek',
                baseUrl: 'https://api.deepseek.com',
                apiKey: '',
                model: '',
                sharedWithLofter: true
            },
            autoGenWeiboCount: 4,
            _seededInitial: false,
            _lastTopicSeedPlotId: null
        },

        // Pixiv小说数据
        pixivData: {
            settings: {
                cp: '',
                forumLinked: true,
                additionalWorldBookIds: [],
                customPrompt: '',
                novelRules: '',
                language: 'jp-cn',
                apiOverride: { enabled: false, baseUrl: '', apiKey: '', model: '' }
            },
            novels: [],
            favorites: [],
            illustrations: [],
            recentNovelAngles: []
        },

        // 跨模块事件总线
        recentEvents: [],
    },
    // 聊天状态
    pendingMessages: [],
    isProcessing: false
};

// ===== 导航系统 =====
const Navigation = {
    goTo(screenId, data = null) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

        // LINE 特殊路由：data-app="chat" 对应 line-container
        if (screenId === 'chat') { Line.show('talk'); return; }

        const next = document.getElementById(screenId);
        if (next) {
            next.classList.add('active');
            AppState.currentScreen = screenId;
            if (screenId === 'conversation' && data) Conversation.init(data);
            if (screenId === 'characterEditor') CharEditor.init();
            // my-profile-screen removed — identity management is in LINE Home
            // settings 首页现在只是 4 个入口，初始化放到各子页面里
            if (screenId === 'settings-appearance') {
                if (typeof IconCustomizer !== 'undefined') IconCustomizer.init();
                if (typeof Widgets !== 'undefined') Widgets.renderSettingsList();
            }
            if (screenId === 'settings-api') {
                APISettings.init();
                if (typeof ImageAPISettings !== 'undefined') ImageAPISettings.init();
                if (typeof TTSSettings !== 'undefined') TTSSettings.init();
                if (typeof WeiboApiSettings !== 'undefined') WeiboApiSettings.init();
            }
            if (screenId === 'settings-about') {
                const v = document.getElementById('aboutVersion');
                if (v && typeof APP_VERSION !== 'undefined') v.textContent = 'Version ' + APP_VERSION;
                else if (v) {
                    // 从 sw.js 提取版本号
                    fetch('./sw.js').then(r => r.text()).then(t => {
                        const m = t.match(/VERSION\s*=\s*['"]([^'"]+)['"]/);
                        if (m) v.textContent = 'Version ' + m[1];
                    }).catch(() => {});
                }
            }
            if (screenId === 'writer') Mailbox.init();
            if (screenId === 'writer-settings') Mailbox.initSettings();
            if (screenId === 'worldbook') WorldBook.renderList();
            if (screenId === 'worldbookDetail') WorldBook.renderEntries();
            if (screenId === 'dictionary') Dictionary.render();
            if (screenId === 'quiz') Quiz.init();
            if (screenId === 'ai-tutor') AITutor.init();
            if (screenId === 'dialogue-polish') DialoguePolish.init();
            if (screenId === 'payment-tracker') PaymentTracker.init();
            if (screenId === 'lyric-lab') Music.init();
            if (screenId === 'fortune') Fortune.init();
            if (screenId === 'fortune-draw') Fortune.renderDrawScreen();
            if (screenId === 'summary-manager') SummaryManager.init();
            if (screenId === 'chat-settings') ChatSettingsUI.init();
            if (screenId === 'forum') Forum.init();
            if (screenId === 'forum-settings') Forum.initSettings();
            if (screenId === 'broadcast' && typeof Broadcast !== 'undefined') Broadcast.init();
            if (screenId === 'settings-data') {
                if (typeof Forum !== 'undefined') Forum.updateStorageBar();
                if (typeof GitHubBackup !== 'undefined') GitHubBackup.renderInto(document.getElementById('ghbCardBody'));
            }
            if (screenId === 'forum-thread') Forum.renderThread();
            if (screenId === 'pixiv-novel') PixivNovel.init();
            if (screenId === 'pixiv-novel-settings') PixivNovel.loadSettingsUI();
            if (screenId === 'pixiv-reader') PixivNovel.renderReader();
            if (screenId === 'travel-account' && typeof TravelAccount !== 'undefined') TravelAccount.init();
            if (screenId === 'twitter') Twitter.init();
            if (screenId === 'weibo' && typeof Weibo !== 'undefined') Weibo.init();
            if (screenId === 'lofter' && typeof Lofter !== 'undefined') Lofter.init();
            if (screenId === 'twitter-thread') Twitter.renderThread();
            if (screenId === 'twitter-dm') Twitter.renderDm();
            if (screenId === 'twitter-notif') Twitter.renderNotifications();
            if (screenId === 'twitter-dm-list') Twitter.renderDmList();
            if (screenId === 'twitter-search') Twitter.renderSearch();
            if (screenId === 'twitter-space') Twitter.renderSpaceDetail();
            if (screenId === 'twitter-user-profile') Twitter.renderUserProfile();
            if (screenId === 'twitter-npc-profile') Twitter.renderNpcProfile();
            if (screenId === 'twitter-marshmallow') Twitter.renderMarshmallow();
            if (screenId === 'twitter-poipiku') Twitter.renderPoipiku();
            if (screenId === 'magazine') Magazine.init();
            if (screenId === 'magazine-reader') Magazine.renderReader();
            if (screenId === 'melonbooks') Melonbooks.init();
            if (screenId === 'melonbooks-detail') Melonbooks.renderProductDetail();
            if (screenId === 'melonbooks-circle') Melonbooks.renderCirclePage();
            if (screenId === 'melonbooks-event') Melonbooks.renderEventPage();
            if (screenId === 'melonbooks-feature') Melonbooks.renderFeaturePage();
            if (screenId === 'melonbooks-cart') Melonbooks.renderCart();
            if (screenId === 'mercari') Mercari.init();
            if (screenId === 'tarot') Tarot.init();
            if (screenId === 'tarot-reading') Tarot.renderReading();
            if (screenId === 'niconico') Niconico.init();
            if (screenId === 'niconico-detail') Niconico.renderVideoDetail();
            if (screenId === 'niconico-channel') Niconico.renderChannelPage();
            if (screenId === 'niconico-search') Niconico.renderSearch();
        }
    },
    back(target) {
        // LINE 内部返回处理
        if (target === 'line-talk') {
            // 从 summary-manager / chat-settings 返回 LINE 对话
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            const container = document.getElementById('line-container');
            if (container) container.classList.add('active');
            AppState.currentScreen = 'line-container';
            // 确保对话视图显示
            const listView = document.getElementById('line-talk-list');
            const convView = document.getElementById('line-talk-conversation');
            if (listView) listView.style.display = 'none';
            if (convView) convView.style.display = 'flex';
            Line.switchTab('talk');
            // 重新初始化对话（标签切换会重置到列表，这里覆盖）
            if (AppState.currentCharacter) {
                if (listView) listView.style.display = 'none';
                if (convView) convView.style.display = 'flex';
            }
            return;
        }
        this.goTo(target || 'desktop');
    }
};

// ===== 桌面分页 =====
const DesktopPager = {
    currentPage: 0,
    totalPages: 2,
    startX: 0,
    goToPage(index) {
        if (index < 0 || index >= this.totalPages) return;
        this.currentPage = index;
        const pages = document.getElementById('desktopPages');
        pages.style.transform = `translateX(-${index * 100}%)`;
        document.querySelectorAll('.page-dots .dot').forEach((d, i) => {
            d.classList.toggle('active', i === index);
        });
        // 第1页以外はウィジェットと時計を隠す
        const topArea = document.querySelector('.desktop-widget');
        if (topArea) topArea.style.visibility = index === 0 ? '' : 'hidden';
    },
    initSwipe() {
        const wrapper = document.querySelector('.desktop-pages-wrapper');
        if (!wrapper) return;
        wrapper.addEventListener('touchstart', (e) => {
            this.startX = e.touches[0].clientX;
        }, { passive: true });
        wrapper.addEventListener('touchend', (e) => {
            if (this._locked) return;
            const diff = this.startX - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) this.goToPage(this.currentPage + 1);
                else this.goToPage(this.currentPage - 1);
            }
        }, { passive: true });
    }
};

// ===== 应用初始化 =====
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Core System & Data
    try {
        await Utils.loadData();
        // v2.69.0 数据迁移：CP 字段从 pixivData.settings + forumData.cpNickname 统一到 broadcast.cpSettings
        // 幂等检查：broadcast.cpSettings 已存在 = 已迁移、跳过
        if (AppState.data.broadcast && !AppState.data.broadcast.cpSettings) {
            const pixivCP = (AppState.data.pixivData && AppState.data.pixivData.settings) || {};
            const forumNickname = (AppState.data.forumData && AppState.data.forumData.cpNickname) || '';
            AppState.data.broadcast.cpSettings = {
                cpCharA: pixivCP.cpCharA || '',
                cpCharB: pixivCP.cpCharB || '',
                cpNickname: pixivCP.cpNickname || forumNickname || ''
            };
            // 清掉 forumData.cpNickname（修隐性 bug + 单一数据源）
            if (AppState.data.forumData && AppState.data.forumData.cpNickname !== undefined) {
                delete AppState.data.forumData.cpNickname;
            }
            Utils.saveData();
            console.log('[Migration v2.69.0] CP settings → broadcast.cpSettings', AppState.data.broadcast.cpSettings);
        }
        // v2.70.0 一次性迁移：doujin → doujin_writer + fanFriend schema 扩展
        if (!AppState.data._doujinTypeMigratedV2) {
            const fanFriends = (AppState.data.twitterData && AppState.data.twitterData.fanFriends) || [];
            let migratedCount = 0;
            fanFriends.forEach(f => {
                if (f.type === 'doujin') {
                    f.type = 'doujin_writer';
                    migratedCount++;
                }
                // 给所有 doujin_writer / doujin_artist 类型补默认字段（含本次刚迁移的 + 之前手动设置过的）
                if (f.type === 'doujin_writer' || f.type === 'doujin_artist') {
                    if (f.pixivHandle === undefined) f.pixivHandle = f.handle;
                    if (f.writingStyleId === undefined) f.writingStyleId = null;
                    if (f.contentTags === undefined) f.contentTags = [];
                    if (f.promoteStyle === undefined) f.promoteStyle = 'occasional';
                    if (f.melonbooksCircleId === undefined) f.melonbooksCircleId = null;
                    if (f.hasUnlockableContent === undefined) f.hasUnlockableContent = false;
                }
            });
            AppState.data._doujinTypeMigratedV2 = true;
            Utils.saveData();
            console.log(`[Migration v2.70.0] doujin → doujin_writer + schema 扩展、迁移 ${migratedCount} 个 fanFriend`);
        }
        // v2.71.0: weiboData 初始化（旧存档兼容）
        if (!AppState.data.weiboData) {
            AppState.data.weiboData = {
                accounts: [{
                    id: 'default',
                    name: 'Perigee 用户',
                    handle: 'perigee_user',
                    bio: '',
                    avatarLetter: 'P',
                    avatarColor: '#ff8200',
                    isVerified: false,
                    createdAt: Date.now()
                }],
                currentAccountId: 'default',
                posts: [],
                fanFriends: [],
                topics: [],
                followedTopicIds: [],
                hotsearch: [],
                notifications: { mentions: [], comments: [], likes: [], dms: [], strangerDmIds: [] },
                drafts: [],
                apiOverride: { enabled: false, mode: 'deepseek', baseUrl: 'https://api.deepseek.com', apiKey: '', model: '', sharedWithLofter: true },
                autoGenWeiboCount: 4,
                _seededInitial: false,
                _lastTopicSeedPlotId: null
            };
            Utils.saveData();
            console.log('[Migration v2.71.0] weiboData initialized');
        }
        // v2.71.0: productionName 字段补丁
        if (AppState.data.broadcast?.cpSettings && AppState.data.broadcast.cpSettings.productionName === undefined) {
            AppState.data.broadcast.cpSettings.productionName = '';
            Utils.saveData();
            console.log('[Migration v2.71.0] productionName field added');
        }
        // v2.71.0 hotfix: myLikedPostIds 字段补丁（旧存档没这个字段、点赞 toggle 会 push 到 undefined）
        if (AppState.data.weiboData && !Array.isArray(AppState.data.weiboData.myLikedPostIds)) {
            AppState.data.weiboData.myLikedPostIds = [];
            Utils.saveData();
        }
        SystemConfig.init();
        if (typeof RainEngine !== 'undefined') RainEngine.init(); // 夏雨 canvas 真雨（自管生命周期）
        if (typeof GlassRainEngine !== 'undefined') GlassRainEngine.init(); // 夏雨 WebGL 折射玻璃（主力，自管生命周期）
        if (typeof StarfieldEngine !== 'undefined') StarfieldEngine.init(); // 夜空 canvas 星空（自管生命周期）
        if (typeof IconCustomizer !== 'undefined') IconCustomizer.init();
        if (typeof Widgets !== 'undefined') Widgets.init();
        if (typeof Decorations !== 'undefined') Decorations.init();
        if (typeof DesktopRenderer !== 'undefined') DesktopRenderer.render();
        if (typeof DesktopEdit !== 'undefined') DesktopEdit.init();
        if (typeof Decorations !== 'undefined') Decorations.initDragHandlers();
        DesktopPager.initSwipe();
        if (typeof I18n !== 'undefined' && AppState.data.systemConfig.language) {
            I18n.setLanguage(AppState.data.systemConfig.language);
        }
        if (typeof Onboarding !== 'undefined') Onboarding.checkAndShow();
        if (typeof ChangelogPrompt !== 'undefined') ChangelogPrompt.checkAndShow();
    } catch (e) { console.error('[Init Error] Core System:', e); }

    // 2. Service Worker (PWA)
    try {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('[PWA] Service Worker 注册成功:', registration.scope);
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                showUpdateNotification();
                            }
                        });
                    });
                    setInterval(() => registration.update(), 60 * 60 * 1000);
                })
                .catch(err => console.log('[PWA] Service Worker 注册失败:', err));
            // SW 更新事件 — 不弹小条幅，next reload 时由 ChangelogPrompt 统一展示「新版本上线」弹窗
            navigator.serviceWorker.addEventListener('message', event => {
                if (event.data && event.data.type === 'SW_UPDATED') {
                    console.log('[SW] new version cached, will surface on next reload');
                }
            });
        }
    } catch (e) { console.error('[Init Error] PWA:', e); }

    // 3. Navigation
    try {
        // Event delegation for dynamically rendered app icons
        document.getElementById('desktopPages')?.addEventListener('click', (e) => {
            if (typeof DesktopEdit !== 'undefined' && DesktopEdit.active) return;
            const item = e.target.closest('.app-item');
            if (item && item.dataset.app) Navigation.goTo(item.dataset.app);
            // Widget click
            const widget = e.target.closest('.desktop-grid-widget');
            if (widget && widget.dataset.widgetId) {
                const w = (AppState.data.widgets || []).find(x => x.id === widget.dataset.widgetId);
                if (w) {
                    if (w.type === 'photo') Widgets.editPhoto(w.id);
                    else if (w.type === 'calendar') Widgets.editCalendar(w.id);
                    else if (w.type === 'music') Widgets.editMusic(w.id);
                    else if (w.type === 'news') Widgets._openForum();
                }
            }
        });
        document.querySelectorAll('.back-btn').forEach(b => {
            // 跳过已有 onclick 的按钮（如 LINE 内部导航按钮）
            if (b.getAttribute('onclick')) return;
            b.onclick = () => Navigation.back(b.dataset.back);
        });
    } catch (e) { console.error('[Init Error] Navigation:', e); }

    // 4. Message & Character
    try {
        const addCharBtn = document.querySelector('.add-character-btn');
        if (addCharBtn) addCharBtn.onclick = () => {
            CharEditor.currentEditId = null;
            Navigation.goTo('characterEditor');
        };
        const saveCharBtn = document.querySelector('.save-character-btn');
        if (saveCharBtn) saveCharBtn.onclick = CharEditor.save;

        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn) sendBtn.onclick = () => Conversation.sendToScreen();

        const triggerAIBtn = document.getElementById('triggerAIBtn');
        if (triggerAIBtn) triggerAIBtn.onclick = () => Conversation.triggerAI();

        const menuBtn = document.querySelector('#conversation .menu-btn');
        if (menuBtn) menuBtn.onclick = (e) => { e.stopPropagation(); ConversationMenu.toggle(); };

        const summaryMgrBtn = document.getElementById('menuSummaryManager');
        if (summaryMgrBtn) summaryMgrBtn.onclick = () => { ConversationMenu.close(); Navigation.goTo('summary-manager'); };

        const manualSummaryBtn = document.getElementById('menuManualSummary');
        if (manualSummaryBtn) manualSummaryBtn.onclick = () => { ConversationMenu.close(); if (AppState.currentCharacter) Conversation.performAutoSummary(); };

        // 置顶/静音
        const togglePinBtn = document.getElementById('menuTogglePin');
        if (togglePinBtn) togglePinBtn.onclick = () => {
            ConversationMenu.close();
            const c = AppState.currentCharacter; if (!c) return;
            if (!AppState.data.chatMeta[c.id]) AppState.data.chatMeta[c.id] = {};
            const meta = AppState.data.chatMeta[c.id];
            meta.isPinned = !meta.isPinned;
            Utils.saveData();
            Utils.showToast(meta.isPinned ? '📌 ピン留めしました' : 'ピン留め解除');
        };
        const toggleMuteBtn = document.getElementById('menuToggleMute');
        if (toggleMuteBtn) toggleMuteBtn.onclick = () => {
            ConversationMenu.close();
            const c = AppState.currentCharacter; if (!c) return;
            if (!AppState.data.chatMeta[c.id]) AppState.data.chatMeta[c.id] = {};
            const meta = AppState.data.chatMeta[c.id];
            meta.isMuted = !meta.isMuted;
            Utils.saveData();
            Utils.showToast(meta.isMuted ? '🔇 ミュートしました' : 'ミュート解除');
        };

        document.addEventListener('click', () => { if (typeof ConversationMenu !== 'undefined') ConversationMenu.close(); });

        const summaryCancel = document.getElementById('summaryEditCancelBtn');
        if (summaryCancel) summaryCancel.onclick = () => document.getElementById('summaryEditModal').classList.remove('active');
        const summarySave = document.getElementById('summaryEditSaveBtn');
        if (summarySave) summarySave.onclick = () => SummaryManager.saveEdit();

        const stickerBtn = document.getElementById('stickerBtn');
        if (stickerBtn) stickerBtn.onclick = (e) => { e.stopPropagation(); StickerManager.toggle(); };

        const attachBtn = document.getElementById('attachImageBtn');
        if (attachBtn) attachBtn.onclick = () => document.getElementById('imageInput').click();

        const imgInput = document.getElementById('imageInput');
        if (imgInput) imgInput.onchange = (e) => {
            if (e.target.files[0]) {
                ChatHelpers.handleImageUpload(e.target.files[0]);
                e.target.value = '';
            }
        };

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#stickerPanel') && !e.target.closest('#stickerBtn')) StickerManager.close();
        });

        const msgInput = document.getElementById('messageInput');
        if (msgInput) msgInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); Conversation.sendToScreen(); }
        });
    } catch (e) { console.error('[Init Error] Chat Module:', e); }

    // 5. World Book
    try {
        const newBookBtn = document.getElementById('newWorldBookBtn');
        if (newBookBtn) newBookBtn.onclick = () => WorldBook.createBook();
        const addEntryBtn = document.getElementById('addEntryBtn');
        if (addEntryBtn) addEntryBtn.onclick = () => WorldBook.addEntry();
        const saveEntryBtn = document.getElementById('saveEntryBtn');
        if (saveEntryBtn) saveEntryBtn.onclick = () => WorldBook.saveEntry();
    } catch (e) { console.error('[Init Error] WorldBook:', e); }

    // 6. Language & Tools
    try {
        document.querySelectorAll('.grid-card').forEach(c => c.onclick = () => Navigation.goTo(c.dataset.lang));

        // Dictionary
        const addWordBtn = document.getElementById('addWordBtn');
        if (addWordBtn) addWordBtn.onclick = () => Dictionary.addWord();
        const importDictBtn = document.getElementById('importDictBtn');
        if (importDictBtn) importDictBtn.onclick = () => Dictionary.importDictionary();
        const dictFileForImp = document.getElementById('dictFileInput');
        if (dictFileForImp) dictFileForImp.onchange = (e) => { if (e.target.files[0]) { Dictionary.handleDictImport(e.target.files[0]); e.target.value = ''; } };

        // ... (Other dictionary buttons safely wrapped)
        ['wordCancelBtn', 'wordSaveBtn', 'wordDetailCloseBtn', 'wordAskAIBtn', 'wordPlayBtn', 'wordDeleteBtn'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                if (id === 'wordCancelBtn') btn.onclick = () => document.getElementById('wordModal').classList.remove('active');
                if (id === 'wordSaveBtn') btn.onclick = () => Dictionary.saveWord();
                if (id === 'wordDetailCloseBtn') btn.onclick = () => document.getElementById('wordDetailModal').classList.remove('active');
                if (id === 'wordAskAIBtn') btn.onclick = () => Dictionary.explainWithAI();
                if (id === 'wordPlayBtn') btn.onclick = () => Dictionary.playTTS();
                if (id === 'wordDeleteBtn') btn.onclick = () => Dictionary.deleteWord();
            }
        });

        // Quiz & Tutor
        const genQuizBtn = document.getElementById('generateQuizBtn');
        if (genQuizBtn) genQuizBtn.onclick = () => Quiz.generateQuiz();

        const tutorSend = document.getElementById('tutorSendBtn');
        if (tutorSend) tutorSend.onclick = () => AITutor.sendMessage();
        const tutorInput = document.getElementById('tutorInput');
        if (tutorInput) tutorInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); AITutor.sendMessage(); } });
        const tutorMenu = document.getElementById('tutorMenuBtn');
        if (tutorMenu) tutorMenu.onclick = () => AITutor.showMenu();

        // Translator
        const transBtn = document.getElementById('translateNovelBtn');
        if (transBtn) transBtn.onclick = () => NovelTranslator.translateNovel();
        const clearNovelBtn = document.getElementById('clearNovelBtn');
        if (clearNovelBtn) clearNovelBtn.onclick = () => NovelTranslator.clearNovel();
        const copyTransBtn = document.getElementById('copyTranslationBtn');
        if (copyTransBtn) copyTransBtn.onclick = () => NovelTranslator.copyTranslation();
        const upNovelBtn = document.getElementById('uploadNovelBtn');
        if (upNovelBtn) upNovelBtn.onclick = () => document.getElementById('novelFileInput').click();
        const novelFileIn = document.getElementById('novelFileInput');
        if (novelFileIn) novelFileIn.onchange = (e) => { if (e.target.files[0]) { NovelTranslator.uploadFile(e.target.files[0]); e.target.value = ''; } };
    } catch (e) { console.error('[Init Error] Language Tools:', e); }

    // 7. Payment Tracker
    try {
        const addPayBtn = document.getElementById('addPaymentBtn');
        if (addPayBtn) addPayBtn.onclick = () => PaymentTracker.addPayment();
        const savePayBtn = document.getElementById('savePaymentBtn');
        if (savePayBtn) savePayBtn.onclick = () => PaymentTracker.savePayment();
        const delPayBtn = document.getElementById('deletePaymentBtn');
        if (delPayBtn) delPayBtn.onclick = () => PaymentTracker.deletePayment();

        const payDep = document.getElementById('paymentDeposit');
        if (payDep) payDep.oninput = () => PaymentTracker.updateTotal();
        const payBal = document.getElementById('paymentBalance');
        if (payBal) payBal.oninput = () => PaymentTracker.updateTotal();

        PaymentTracker.checkReminders();
        if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    } catch (e) { console.error('[Init Error] Payment:', e); }

    // 8. Music Lab
    try {
        const addSongBtn = document.getElementById('addMusicSongBtn');
        if (addSongBtn) addSongBtn.onclick = () => Music.openCreateModal();
        const cancelBtn = document.getElementById('musicCreateCancelBtn');
        if (cancelBtn) cancelBtn.onclick = () => Music.closeCreateModal();
        const submitBtn = document.getElementById('musicCreateSubmitBtn');
        if (submitBtn) submitBtn.onclick = () => Music.submitCreate();
    } catch (e) { console.error('[Init Error] Music:', e); }

    // 9. Fortune
    try {
        const createThmBtn = document.getElementById('createFortuneThemeBtn');
        if (createThmBtn) createThmBtn.onclick = () => Fortune.openCreateModal();
        const clrHistBtn = document.getElementById('clearFortuneHistoryBtn');
        if (clrHistBtn) clrHistBtn.onclick = () => Fortune.clearHistory();
        const thmCancelBtn = document.getElementById('fortuneThemeCancelBtn');
        if (thmCancelBtn) thmCancelBtn.onclick = () => document.getElementById('fortuneThemeModal').classList.remove('active');
        const thmCreateBtn = document.getElementById('fortuneThemeCreateBtn');
        if (thmCreateBtn) thmCreateBtn.onclick = () => Fortune.createTheme();
    } catch (e) { console.error('[Init Error] Fortune:', e); }

    // 10. Persona modals (charSelect & bindingDetail — reused by LineHome)
    try {
        const charSelCncl = document.getElementById('charSelectCancelBtn');
        if (charSelCncl) charSelCncl.onclick = () => document.getElementById('charSelectModal').classList.remove('active');

        const bindDetCncl = document.getElementById('bindingDetailCancelBtn');
        if (bindDetCncl) bindDetCncl.onclick = () => document.getElementById('bindingDetailModal').classList.remove('active');

        // Managing chars
        const clrCharHist = document.getElementById('clearCharHistoryBtn');
        if (clrCharHist) clrCharHist.onclick = () => { if (CharEditor.currentEditId) CharacterManager.clearChatHistory(CharEditor.currentEditId); };
        const delCharBtn = document.getElementById('deleteCharacterBtn');
        if (delCharBtn) delCharBtn.onclick = () => { if (CharEditor.currentEditId) CharacterManager.deleteCharacter(CharEditor.currentEditId); };
    } catch (e) { console.error('[Init Error] Profile:', e); }

    // 11. Mailbox / Writer
    try {
        const compMailBtn = document.getElementById('composeMailBtn');
        if (compMailBtn) compMailBtn.onclick = () => Mailbox.composeMail();
        const writerSetBtn = document.getElementById('writerSettingsBtn');
        if (writerSetBtn) writerSetBtn.onclick = () => Navigation.goTo('writer-settings');
        const compMaiCncl = document.getElementById('composeMailCancelBtn');
        if (compMaiCncl) compMaiCncl.onclick = () => document.getElementById('composeMailModal').classList.remove('active');
        const compMailSnd = document.getElementById('composeMailSendBtn');
        if (compMailSnd) compMailSnd.onclick = () => Mailbox.sendMail();
        const mailAttIn = document.getElementById('mailAttachInput');
        if (mailAttIn) mailAttIn.onchange = (e) => Mailbox.handleAttachments(e);
        const saveMailBtn = document.getElementById('saveMailContentBtn');
        if (saveMailBtn) saveMailBtn.onclick = () => Mailbox.saveMailContent();
        const delMailBtn = document.getElementById('deleteMailBtn');
        if (delMailBtn) delMailBtn.onclick = () => Mailbox.deleteMail();
        const saveWritProf = document.getElementById('saveWriterProfileBtn');
        if (saveWritProf) saveWritProf.onclick = () => Mailbox.saveProfile();
        const addGlobKb = document.getElementById('addGlobalKbBtn');
        if (addGlobKb) addGlobKb.onclick = () => Mailbox.addGlobalKb();
        const kbCncl = document.getElementById('kbCancelBtn');
        if (kbCncl) kbCncl.onclick = () => document.getElementById('kbModal').classList.remove('active');
        const kbSave = document.getElementById('kbSaveBtn');
        if (kbSave) kbSave.onclick = () => Mailbox.saveGlobalKb();
        const kbFileIn = document.getElementById('kbFileInput');
        if (kbFileIn) kbFileIn.onchange = (e) => Mailbox.handleKbFileUpload(e);
    } catch (e) { console.error('[Init Error] Mailbox:', e); }

    // 12. Forum (Likely Error Source)
    try {
        const forumSetBtn = document.getElementById('forumSettingsBtn');
        if (forumSetBtn) forumSetBtn.onclick = () => Navigation.goTo('forum-settings');
        const forumGenBtn = document.getElementById('forumGenerateBtn');
        if (forumGenBtn) forumGenBtn.onclick = () => Forum.generateThreads();
        const forumEdBtn = document.getElementById('forumEditBtn');
        if (forumEdBtn) forumEdBtn.onclick = () => Forum.toggleEditMode();
        const forumClrBtn = document.getElementById('forumClearAllBtn');
        if (forumClrBtn) forumClrBtn.onclick = () => Forum.clearAllThreads();
        const dataImportBtn = document.getElementById('dataImportBtn');
        if (dataImportBtn) dataImportBtn.onclick = () => document.getElementById('dataImportInput').click();
        const dataImportIn = document.getElementById('dataImportInput');
        if (dataImportIn) dataImportIn.onchange = (e) => {
            if (e.target.files[0]) DataExport.handleImportFile(e.target.files[0]);
            e.target.value = '';
        };
        const clearModBtn = document.getElementById('clearModuleDataBtn');
        if (clearModBtn) clearModBtn.onclick = () => Utils.resetAllData();
        const forumNewBtn = document.getElementById('forumNewThreadBtn');
        if (forumNewBtn) forumNewBtn.onclick = () => Forum.showNewThreadModal();
        const forumDelSel = document.getElementById('forumDeleteSelectedBtn');
        if (forumDelSel) forumDelSel.onclick = () => Forum.deleteSelected();
        const saveForSet = document.getElementById('saveForumSettingsBtn');
        if (saveForSet) saveForSet.onclick = () => Forum.saveSettings();
        const forumExportBtn = document.getElementById('forumExportBtn');
        if (forumExportBtn) forumExportBtn.onclick = () => Forum.exportThread();
        const forumFav = document.getElementById('forumFavBtn');
        if (forumFav) forumFav.onclick = () => Forum.toggleFavorite();
        const forumRepSnd = document.getElementById('forumReplySendBtn');
        if (forumRepSnd) forumRepSnd.onclick = () => Forum.userReply();
        const forumRepIn = document.getElementById('forumReplyInput');
        if (forumRepIn) forumRepIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); Forum.userReply(); } });

        const newThrdCncl = document.getElementById('newThreadCancelBtn');
        if (newThrdCncl) newThrdCncl.onclick = () => document.getElementById('newThreadModal').classList.remove('active');
        const newThrdSub = document.getElementById('newThreadSubmitBtn');
        if (newThrdSub) newThrdSub.onclick = () => Forum.submitNewThread();

        const addPltBtn = document.getElementById('addPlotBtn');
        if (addPltBtn) addPltBtn.onclick = () => Forum.showPlotModal();
        const plotCncl = document.getElementById('plotCancelBtn');
        if (plotCncl) plotCncl.onclick = () => document.getElementById('plotModal').classList.remove('active');
        const plotSave = document.getElementById('plotSaveBtn');
        if (plotSave) plotSave.onclick = () => Forum.addPlotEntry();

        const addOfficialBtn = document.getElementById('addOfficialInfoBtn');
        if (addOfficialBtn) addOfficialBtn.onclick = () => Forum.showOfficialInfoModal();
        const officialCncl = document.getElementById('officialInfoCancelBtn');
        if (officialCncl) officialCncl.onclick = () => document.getElementById('officialInfoModal').classList.remove('active');
        const officialSave = document.getElementById('officialInfoSaveBtn');
        if (officialSave) officialSave.onclick = () => Forum.addOfficialInfoEntry();

        const addNpcBtn = document.getElementById('addNpcBtn');
        if (addNpcBtn) addNpcBtn.onclick = () => Forum.showNpcModal();
        const npcCncl = document.getElementById('npcCancelBtn');
        if (npcCncl) npcCncl.onclick = () => document.getElementById('npcModal').classList.remove('active');
        const npcSave = document.getElementById('npcSaveBtn');
        if (npcSave) npcSave.onclick = () => Forum.saveNpc();

        // 总结管理（合并总结，入口只保留剧情卡片按钮）
        const plotSumBtn = document.getElementById('plotSummaryBtn');
        if (plotSumBtn) plotSumBtn.onclick = () => Forum.showSummaryModal();
        const sumClose = document.getElementById('summaryCloseBtn');
        if (sumClose) sumClose.onclick = () => Forum.closeSummaryModal();
    } catch (e) { console.error('[Init Error] Forum:', e); }

    // 13. Pixiv Novel (Likely Error Source)
    try {
        const pixNovSetBtn = document.getElementById('pixivNovelSettingsBtn');
        if (pixNovSetBtn) pixNovSetBtn.onclick = () => Navigation.goTo('pixiv-novel-settings');

        const pixIllGenBtn = document.getElementById('pixivIllustGenerateBtn');
        if (pixIllGenBtn) pixIllGenBtn.onclick = () => PixivIllust.showGenerateModal();

        const pixSearchBtn = document.getElementById('pixivSearchBtn');
        if (pixSearchBtn) pixSearchBtn.onclick = () => PixivNovel.search(document.getElementById('pixivSearchInput').value);
        const pixSearchIn = document.getElementById('pixivSearchInput');
        if (pixSearchIn) pixSearchIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); PixivNovel.search(e.target.value); } });

        ['pixivMainTabIllust', 'pixivMainTabNovel', 'pixivMainTabUser'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.onclick = () => PixivNovel.switchMainTab(id.replace('pixivMainTab', '').toLowerCase());
        });

        const pixTabAll = document.getElementById('pixivTabAll'); if (pixTabAll) pixTabAll.onclick = () => PixivNovel.switchTab('all');
        const pixTabFav = document.getElementById('pixivTabFav'); if (pixTabFav) pixTabFav.onclick = () => PixivNovel.switchTab('favorites');
        const pixTabSer = document.getElementById('pixivTabSerial'); if (pixTabSer) pixTabSer.onclick = () => PixivNovel.switchTab('serial');

        const savePixSet = document.getElementById('savePixivSettingsBtn'); if (savePixSet) savePixSet.onclick = () => PixivNovel.saveSettings();
        const pixForLink = document.getElementById('pixivForumLinked'); if (pixForLink) pixForLink.onchange = (e) => PixivNovel.toggleForumLink(e.target.checked);

        const pixGenCncl = document.getElementById('pixivGenCancelBtn'); if (pixGenCncl) pixGenCncl.onclick = () => document.getElementById('pixivGenerateModal').classList.remove('active');
        const pixGenSub = document.getElementById('pixivGenSubmitBtn'); if (pixGenSub) pixGenSub.onclick = () => PixivNovel.generateNovel();
    } catch (e) { console.error('[Init Error] Pixiv:', e); }

    // 14. System & Data (MUST RUN)
    try {
        const saveSys = document.getElementById('saveSystemConfigBtn');
        if (saveSys) saveSys.onclick = () => SystemConfig.saveConfig();

        // 雨效果开关：即时生效 + 持久化（夏雨主题）
        const rainToggle = document.getElementById('rainEffectToggle');
        if (rainToggle) rainToggle.onchange = () => {
            const cfg = AppState.data.systemConfig || (AppState.data.systemConfig = {});
            cfg.rainEffect = rainToggle.checked;
            SystemConfig.applyRainEffect(rainToggle.checked);
            Utils.saveData();
        };

        const clearData = document.getElementById('clearDataBtn');
        if (clearData) clearData.onclick = async () => {
            if (confirm('Reset App 会清空所有数据并重置应用。无法恢复，确认继续？')) {
                await localforage.clear();
                localStorage.clear();
                location.reload();
            }
        };
    } catch (e) { console.error('[Init Error] Data Management:', e); }
});
