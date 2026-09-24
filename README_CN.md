# Skybound Runner — iPhone 配置说明

这是一个原创横版平台游戏，玩法参考经典 2D 平台跳跃游戏，但没有使用任天堂角色、名称、贴图、音乐或关卡素材。

## 游戏操作

- 左下 ◀ / ▶：移动
- 右下 ↑：跳跃
- 可以踩扁棕色敌人
- 收集黄色星币
- 到地图最右侧旗帜处过关
- 右上角“重开”：重新开始
- 电脑测试时也可使用 A/D、方向键、W/空格

## 为什么不能直接点开 index.html 当 App

iPhone 可以查看本地 HTML，但 PWA 的离线缓存、主屏幕 App 模式等功能最好通过 HTTPS 网站运行。
因此最简单的方案是把这个文件夹部署到一个静态网站，然后在 Safari 中“添加到主屏幕”。

## 方案 A：GitHub Pages（免费，长期保存）

1. 在 Safari 打开 https://github.com 并登录/注册。
2. 新建一个 Public repository，例如 `skybound-runner`。
3. 把本项目中的文件全部上传到仓库根目录：
   - index.html
   - game.js
   - sw.js
   - manifest.webmanifest
   - icon-180.png
   - icon-512.png
4. 进入仓库 Settings → Pages。
5. “Build and deployment” 中选择 “Deploy from a branch”。
6. Branch 选 `main`，文件夹选 `/ (root)`，保存。
7. GitHub 会给出一个 `https://你的用户名.github.io/skybound-runner/` 地址。
8. 用 iPhone Safari 打开这个地址。
9. Safari → 分享 → 添加到主屏幕 → 打开“作为网页 App 打开” → 添加。

之后它就会像普通游戏 App 一样出现在主屏幕。

## 方案 B：任何 HTTPS 静态托管

Cloudflare Pages、Netlify、Vercel 等都可以。只要将整个文件夹原样部署即可。
核心要求只有：
- 必须能通过 HTTPS 访问；
- 文件相对路径不要改变。

## 更新游戏

以后修改 game.js / index.html 后重新上传即可。
如果主屏幕版本仍显示旧内容：
1. 先在 Safari 打开网页版并刷新；
2. 如仍未更新，可删除主屏幕 App 后重新添加。
本项目当前 service worker 缓存名为 `skybound-v1`。重大更新时可将 sw.js 第一行改成 `skybound-v2`。

## 文件结构

skybound_runner/
├── index.html
├── game.js
├── sw.js
├── manifest.webmanifest
├── icon-180.png
├── icon-512.png
└── README_CN.md
