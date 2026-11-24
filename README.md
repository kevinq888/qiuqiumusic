# 未末音乐（weimomusic）

未末音乐是一个 Node.js 在线音乐应用，提供歌曲搜索、榜单、歌手与歌单浏览、收藏和播放清单。网页端的收藏及播放清单保存在当前浏览器。

## 桌面版下载

桌面版提供 Windows 和 macOS 安装包。下载后按系统提示完成安装；桌面版支持系统托盘和黑胶悬浮球。手机和平板请直接访问[在线版](https://weimomusic.onrender.com/)，或按下方说明添加到主屏幕。

### v1.2.37（当前版本）

- 去掉导航时顶部那条会反复闪动的进度线；页面首屏直接以内联底色铺底（浅绯 / 暗夜 / 毛玻璃各自对应），切换页面和 App 时不再先白一下。
- 音效重做为 7 段均衡 + 限幅器，各预设提升到 5–8dB，手机外放也能明显听出「低音增强 / 高音增强 / 人声」的差别；网页版、桌面版、安卓版共用同一套。
- 默认皮肤改为「浅绯」：整体配色、背景、图标与 logo 参考网易云音乐那种浅红调；播放页背景也统一到绯红—酒红—珊瑚色系，不再出现墨绿/深蓝。
- 手机全屏播放页的「音效」按钮固定在右上角（收起 / 正在播放 / 词 / 音效 / 清单），底排不再出现音效入口，播放区域恢复原布局。
- 收藏后只有红心本身变浅红，按钮底色与其它控件保持原样；隐藏右侧系统滚动条。
- 手机版顶栏改为实色吸顶并带下投影，与页面背景清晰分层，滚动时不再与卡片糊在一起。
- 毛玻璃皮肤移除所有大面积 backdrop-filter，卡片边缘不再出现锯齿/毛刺，同时明显降低滚动与点击的掉帧。
- 桌面客户端卡片的圆角与阴影重绘收敛，边缘恢复干净。
- 安卓端切后台再回来继续沿用上一帧画面，避免渲染进程重建时的白屏。

| 系统 | 下载 |
| --- | --- |
| Android（arm64-v8a） | [未末音乐-1.2.37-android-arm64-v8a.apk](https://github.com/kevinq888/weimomusic/releases/download/v1.2.37/-1.2.37-android-arm64-v8a.apk) |
| iPhone / iPad（PWA） | [未末音乐-1.2.37-iphone.zip](https://github.com/kevinq888/weimomusic/releases/download/v1.2.37/-1.2.37-iphone.zip) |
| macOS（Apple 芯片） | [未末音乐-1.2.37-mac-arm64.dmg](https://github.com/kevinq888/weimomusic/releases/download/v1.2.37/-1.2.37-mac-arm64.dmg) |
| macOS（Intel） | [未末音乐-1.2.37-mac-x64.dmg](https://github.com/kevinq888/weimomusic/releases/download/v1.2.37/-1.2.37-mac-x64.dmg) |
| Windows（64 位） | [未末音乐-1.2.37-windows-x64.exe](https://github.com/kevinq888/weimomusic/releases/download/v1.2.37/-1.2.37-windows-x64.exe) |

历史版本说明见 [Releases](https://github.com/kevinq888/weimomusic/releases)。

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

## 仓库

GitHub：[kevinq888/weimomusic](https://github.com/kevinq888/weimomusic) · Codeup：[kevinq/qiuqiumusic](https://codeup.aliyun.com/6305f229e8ec152a05d73b41/kevinq/qiuqiumusic)。
