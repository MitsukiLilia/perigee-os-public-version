# Perigee OS

A simulated smartphone for fan-fiction creators — a pure front-end PWA. Build your own fictional work here, then watch it grow a fandom across a full set of simulated platforms: forums, Twitter, Pixiv, magazines and more.

面向同人创作者的拟真手机系统 —— 一个纯前端 PWA。你在这里构建自己的作品世界，然后看它在论坛、推特、Pixiv、杂志等一整套拟真平台上，长出属于它的粉丝生态。

---

## ⚠️ Disclaimer / 免责声明

**EN:** Perigee OS is a front-end tool only. It does **not** provide any AI service, model, or API key — users connect their own third-party API credentials. All content generated through this software is produced by the user's chosen AI provider at the user's direction, and the user is **solely responsible** for that content and for complying with all applicable laws and the terms of their AI provider. The authors provide this software "AS IS" under the MIT License and accept **no liability** for any use, content, or consequence arising from it.

**中文：** Perigee OS 仅为前端工具，**不提供**任何 AI 服务、模型或 API 密钥，用户需自行接入第三方 API。经本软件生成的一切内容，均由用户自行选择的 AI 服务商按用户指令产生，内容及其合法性、是否遵守所在地法律与 AI 服务商条款，**由用户自行承担全部责任**。本软件依 MIT 许可证以"现状"提供，作者对任何使用、内容或由此产生的后果**不承担任何责任**。

---

## What is this / 这是什么

Perigee OS simulates a phone loaded with a whole ecosystem of fandom apps. The core loop:

1. Build your work in the **Broadcast Hub** — worldview, plot progress, official info (merch / interviews / events / official tweets / artbooks), official NPCs (director, voice actors, scriptwriters).
2. These settings feed a shared **world context** into every simulated platform.
3. Forums, Twitter, niconico, magazines, Melonbooks, etc. use AI to generate fan discussion, derivative works, news and goods — as if your work had really aired and stirred the net.

It is not a chatbot, but an immersive tool for **creating and observing the echoes of your work**.

在「放送局」搭建作品 → 设定通过共享「世界上下文」喂给各拟真平台 → 论坛 / 推特 / 杂志等基于剧情用 AI 生成粉丝讨论、二创、报道、商品，像作品真的播出、在网络激起回响。它不是聊天机器人，而是「创作 + 观察作品回响」的沉浸式工具。

## Main modules / 主要模块

- **Broadcast Hub 放送局** — work core: worldview / plot / official info / official NPCs / timeline summaries
- **LINE-style chat** — talk to custom AI characters, with character-card import, world-book binding, voice
- **Forum** — simulated anonymous boards; NPCs generate threads based on plot progress
- **Twitter / X** — timeline, tweets, fan interaction, official accounts
- **Pixiv** — novels (short / serialized) and illustrations
- **Magazine** — interviews, panels, columns in print-media form
- **niconico** — danmaku-style discussion and radio dramas
- **Melonbooks** — doujin storefront + event schedules
- **Mercari** — simulated resale market where merch of your characters / ships gets priced, sought, and counterfeited
- **Music Lab** — lyrics + style prompt + synthesized tracks
- **World Book** — settings library interoperable with SillyTavern format
- Plus tarot, translation, language-learning tools, and more

## Tech stack / 技术栈

- Pure HTML + CSS + JavaScript, no framework, no build step
- PWA: Service Worker offline cache + installable to home screen
- Persistence: localforage / IndexedDB, everything stored locally
- AI: OpenAI-compatible APIs (Gemini / Claude, etc.)

## Online demo & self-hosting / 在线演示与自部署

A live demo is hosted on **GitHub Pages**: https://mitsukililia.github.io/perigee-os-public-version/

Access is gated by a lightweight login backed by an independent serverless auth service, to prevent abuse and scraping. That auth service is **not** part of this repository; self-hosting requires providing your own. The app itself runs entirely client-side.

在线演示托管在 **GitHub Pages**：https://mitsukililia.github.io/perigee-os-public-version/ —— 访问需通过一道轻量登录（由独立的 serverless 认证服务校验），用于防止滥用与爬虫。该认证服务**不包含在本仓库内**；自行部署需自备。应用本身完全在客户端运行。

## Local run / 本地运行

Serve the project root with any static server, e.g.：

```
python3 -m http.server 8080
```

Then open `http://localhost:8080`. Configure your API in Settings on first launch.
（关于登录页，见上一节。）

## Data & privacy / 数据与隐私

- All data (characters / works / chats / settings) lives only in your browser
- API keys are stored only on your local device, never uploaded to any server
- Supports data export / import backup, and GitHub cloud backup (with your own token)

## License

[MIT](./LICENSE) © 2026 MitsukiLilia
