# 未末音乐（weimomusic）

未末音乐是一个 Node.js 在线音乐应用，提供歌曲搜索、榜单、歌手与歌单浏览、收藏和播放清单。网页端的收藏及播放清单保存在当前浏览器。

## 桌面版下载

桌面版提供 Windows 和 macOS 安装包。下载后按系统提示完成安装；桌面版支持系统托盘和黑胶悬浮球。手机和平板请直接访问[在线版](https://weimomusic.onrender.com/)，或按下方说明添加到主屏幕。

### v1.2.39（当前版本）

- 修复手机端“点更新后仍反复提示有新版本”的循环：iPhone PWA 以线上部署版本为准，刷新一次后不再重复提示；安卓原生拉起安装器后按“安装中”处理；安卓浏览器下载安装包后同一版本不再反复催促。
- 安卓安装包内置 `package.json`，内置服务离线时也能正确判断当前版本，避免版本判断失真。
- 线上站点短暂落后于 GitHub 发布时不再误报更新，等部署完成后再提示。
- 延续 v1.2.38 的全部改进：皮肤/音效弹层不再遮挡顶栏、红白品牌图标、浅绯配色与安装包命名规范。

| 系统 | 下载 |
| --- | --- |
| Android（arm64-v8a） | [weimomusic-1.2.39-android-arm64-v8a.apk](https://github.com/kevinq888/weimomusic/releases/download/v1.2.39/weimomusic-1.2.39-android-arm64-v8a.apk) |
| iPhone / iPad（PWA） | [weimomusic-1.2.39-iphone.zip](https://github.com/kevinq888/weimomusic/releases/download/v1.2.39/weimomusic-1.2.39-iphone.zip) |
| macOS（Apple 芯片） | [weimomusic-1.2.39-mac-arm64.dmg](https://github.com/kevinq888/weimomusic/releases/download/v1.2.39/weimomusic-1.2.39-mac-arm64.dmg) |
| macOS（Intel） | [weimomusic-1.2.39-mac-x64.dmg](https://github.com/kevinq888/weimomusic/releases/download/v1.2.39/weimomusic-1.2.39-mac-x64.dmg) |
| Windows（64 位） | [weimomusic-1.2.39-windows-x64.exe](https://github.com/kevinq888/weimomusic/releases/download/v1.2.39/weimomusic-1.2.39-windows-x64.exe) |

## 本地运行

需要 Node.js 22 或更新版本。

```sh
npm start
```

打开 <http://localhost:3000>。可设置环境变量 `PORT` 更换端口。

## 安装到手机桌面

本站也是可安装的网页 App（PWA），安装后会在手机主屏幕显示“未末音乐”。安卓 Chrome 可点击站点顶栏的“安装”并确认系统提示；iPhone 请在 Safari 使用“分享”→“添加到主屏幕”。微信等内置浏览器通常不提供系统安装提示，请先选择“在浏览器打开”，再使用 Chrome 或 Safari 安装。安装需要由手机系统确认。

## 公开部署

完整的部署步骤、Render 配置、缓存说明和排障方法见[部署指南](docs/DEPLOYMENT.md)。在线地址：[weimomusic.onrender.com](https://weimomusic.onrender.com/)。

完整站点需要运行 Node.js 服务。GitHub Pages 只发布静态文件，无法执行实时榜单抓取、搜索和音频代理。若需自行部署，请将仓库连接到支持 Node.js 或 Docker 的托管平台，并使用以下配置：

- 构建命令：`node --check server.js`（仅做语法检查，无 npm 依赖）
- 启动命令：`npm start`
- 监听端口：平台提供的 `PORT` 环境变量，默认 3000
- Docker：仓库根目录的 `Dockerfile`

仓库根目录的 `render.yaml` 配置了 Render Web Service，可通过 Render Blueprint 连接 GitHub 仓库。线上服务从 GitHub `kevinq888/weimomusic` 的 `main` 分支部署；向仓库推送后，按 Render 服务的自动部署设置发布。Codeup 副本的提交不会更新 Render 服务。

免费实例闲置后可能休眠，首次访问需等待服务启动；实例重启或重新部署后，临时文件缓存可能需要重新抓取。若需跨重启保留缓存，可使用带持久化磁盘的服务计划。

站点从上游公开页面生成榜单和搜索结果。首次访问或六小时缓存过期后会重新获取，因此部署环境需要能访问上游站点。缓存写入 `data/cache/`；播放音频也依赖上游 CDN 可用。
