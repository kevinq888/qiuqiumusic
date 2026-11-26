# 未末音乐（weimomusic）

未末音乐是一个 Node.js 在线音乐应用，提供歌曲搜索、榜单、歌手与歌单浏览、收藏和播放清单。网页端的收藏及播放清单保存在当前浏览器。

## 桌面版下载

桌面版提供 Windows 和 macOS 安装包。下载后按系统提示完成安装；桌面版支持系统托盘和黑胶悬浮球。手机和平板请直接访问[在线版](https://weimomusic.onrender.com/)，或按下方说明添加到主屏幕。

### v1.2.44（当前版本）

- 按设计稿新 logo 重新抠图：桌面图标、安卓图标、浏览器 favicon、PWA 图标、启动页与菜单栏图标全部统一为新版「末」字标，四周无白边、无锯齿。
- 手机 App 顶栏与底部播放条、标签栏使用同一块 82% 白磨砂（暗夜黑为深色磨砂），不再出现“全透明”观感；8 套皮肤逐一校验。
- 切到其他 App 再返回时，若上一帧不可用则显示品牌占位页而不是空白底；新增恢复健康检查、超时重载与淡出后看门狗，避免白屏。
- 检查更新：本地服务优先返回版本信息，手动点击一定重新检查并有“正在检查 / 已是最新 / 失败”的明确反馈；下载中点按会保持浮层并提示下载完成后自动安装。

| 系统 | 下载 |
| --- | --- |
| Android（arm64-v8a） | [weimomusic-1.2.44-android-arm64-v8a.apk](https://github.com/kevinq888/weimomusic/releases/download/v1.2.44/weimomusic-1.2.44-android-arm64-v8a.apk) |
| iPhone / iPad（PWA） | [weimomusic-1.2.44-iphone.zip](https://github.com/kevinq888/weimomusic/releases/download/v1.2.44/weimomusic-1.2.44-iphone.zip) |
| macOS（Apple 芯片） | [weimomusic-1.2.44-mac-arm64.dmg](https://github.com/kevinq888/weimomusic/releases/download/v1.2.44/weimomusic-1.2.44-mac-arm64.dmg) |
| macOS（Intel） | [weimomusic-1.2.44-mac-x64.dmg](https://github.com/kevinq888/weimomusic/releases/download/v1.2.44/weimomusic-1.2.44-mac-x64.dmg) |
| Windows（64 位） | [weimomusic-1.2.44-windows-x64.exe](https://github.com/kevinq888/weimomusic/releases/download/v1.2.44/weimomusic-1.2.44-windows-x64.exe) |

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
