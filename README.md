# 未末音乐（qiuqiumusic）

未末音乐是一个 Node.js 在线音乐应用，提供歌曲搜索、榜单、歌手与歌单浏览、收藏和播放清单。网页端的收藏及播放清单保存在当前浏览器。

## 桌面版下载

桌面版提供 Windows 和 macOS 安装包。下载后按系统提示完成安装；桌面版支持系统托盘和黑胶悬浮球。手机和平板请直接访问[在线版](https://weimomusic.onrender.com/)，或按下方说明添加到主屏幕。

### v1.2.15（当前版本）

- 安卓端播放页真正铺到状态栏与底部导航栏后面，头尾不再有两条系统栏色块，时间和电量直接浮在封面上。
- 手机播放页的封面加大一半，外围磨砂光晕收小三分之一。
- 没有封面或封面加载失败的歌曲，统一用站点 Logo 填满圆形封面位。
- 手机首页的迷你播放条回到屏幕底部（仍在底部导航上方）；离开应用时由系统通知栏在顶部显示播放信息。

| 系统 | 下载 |
| --- | --- |
| macOS（Apple 芯片） | [未末音乐-1.2.15-mac-arm64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.15/未末音乐-1.2.15-mac-arm64.dmg) |
| macOS（Intel） | [未末音乐-1.2.15-mac-x64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.15/未末音乐-1.2.15-mac-x64.dmg) |
| Windows（64 位） | [未末音乐-1.2.15-windows-x64.exe](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.15/未末音乐-1.2.15-windows-x64.exe) |

### v1.2.14

- 手机端播放页的白色唱针会跟着播放状态动起来：暂停时绕转轴抬起、挪开唱片，播放时落回，过程带缓动动画。

| 系统 | 下载 |
| --- | --- |
| macOS（Apple 芯片） | [未末音乐-1.2.14-mac-arm64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.14/未末音乐-1.2.14-mac-arm64.dmg) |
| macOS（Intel） | [未末音乐-1.2.14-mac-x64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.14/未末音乐-1.2.14-mac-x64.dmg) |
| Windows（64 位） | [未末音乐-1.2.14-windows-x64.exe](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.14/未末音乐-1.2.14-windows-x64.exe) |

### v1.2.13

- 修复退出应用后重新打开出现白屏：本地服务异常不再让页面无限等待，安卓端会复用仍在运行的服务，空白页自动重载。
- 手机端迷你播放器改为顶部居中的灵动岛胶囊，只显示封面、歌名和一条细进度，点一下进入全屏播放页。
- 播放页真正铺满全屏，歌词区吃满可用高度，去掉头尾多余留白。
- 新增系统媒体控制：锁屏和下拉通知栏显示封面、进度与上一首/播放/下一首，蓝牙耳机线控可控制播放。
- 播放清单改为简洁的单行列表，去掉多余装饰与说明文字。
- 全站交互优化：页面切换、按压反馈和弹出面板更跟手。

| 系统 | 下载 |
| --- | --- |
| macOS（Apple 芯片） | [未末音乐-1.2.13-mac-arm64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.13/未末音乐-1.2.13-mac-arm64.dmg) |
| macOS（Intel） | [未末音乐-1.2.13-mac-x64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.13/未末音乐-1.2.13-mac-x64.dmg) |
| Windows（64 位） | [未末音乐-1.2.13-windows-x64.exe](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.13/未末音乐-1.2.13-windows-x64.exe) |

### v1.2.12

- 修复安卓端启动卡在「server timeout」：发行信息解析失败不再让本地服务进程退出。
- 安装包缺少或未同步 README 时自动回退到 package.json 版本，服务照常启动。

| 系统 | 下载 |
| --- | --- |
| macOS（Apple 芯片） | [未末音乐-1.2.12-mac-arm64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.12/未末音乐-1.2.12-mac-arm64.dmg) |
| macOS（Intel） | [未末音乐-1.2.12-mac-x64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.12/未末音乐-1.2.12-mac-x64.dmg) |
| Windows（64 位） | [未末音乐-1.2.12-windows-x64.exe](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.12/未末音乐-1.2.12-windows-x64.exe) |

### v1.2.11

- 右下角悬浮唱片改为显示播放清单里当前选中歌曲的封面，暂停时也保持显示，切歌立即换图。
- 播放清单没有当前选中歌曲时，悬浮唱片回到品牌 Logo 旋转；清空清单后立即恢复。
- 桌面端悬浮球与网页端使用同一套判断逻辑。

| 系统 | 下载 |
| --- | --- |
| macOS（Apple 芯片） | [未末音乐-1.2.11-mac-arm64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.11/未末音乐-1.2.11-mac-arm64.dmg) |
| macOS（Intel） | [未末音乐-1.2.11-mac-x64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.11/未末音乐-1.2.11-mac-x64.dmg) |
| Windows（64 位） | [未末音乐-1.2.11-windows-x64.exe](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.11/未末音乐-1.2.11-windows-x64.exe) |

### v1.2.10

- 手机播放页改为真正的全屏：隐藏底部导航，状态栏与导航栏随播放页变为深色白字。
- 播放页中央为按比例旋转的专辑封面黑胶，外圈新增缓慢旋转的彩色光晕；唱臂置于右上角。
- 点击歌词或「词」按钮，歌词整块替换黑胶区域，一屏约 7 行，当前句按 KTV 方式逐字点亮。
- 首页底部常驻播放条：没有播放时显示「未末音乐 · 今日推荐 / 点击开始播放」，点击即开始播放。
- 启动时不再显示「正在启动本地服务」，直接进入首页。
- 顶栏品牌「未末音乐」改为深绿胶囊托白字，在浅色与深色背景上都清晰可见。

| 系统 | 下载 |
| --- | --- |
| macOS（Apple 芯片） | [未末音乐-1.2.10-mac-arm64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.10/未末音乐-1.2.10-mac-arm64.dmg) |
| macOS（Intel） | [未末音乐-1.2.10-mac-x64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.10/未末音乐-1.2.10-mac-x64.dmg) |
| Windows（64 位） | [未末音乐-1.2.10-windows-x64.exe](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.10/未末音乐-1.2.10-windows-x64.exe) |

### v1.2.9

- 品牌更名为「未末音乐」，桌面端、安装包与全站图标同步启用全新标志。
- 网页端重做 7 套主题与播放栏配色，播放栏跟随皮肤换色；毛玻璃皮肤的页脚与播放栏改为半透明玻璃效果。
- 歌单面板提高文字对比度，新增多选、全选与「清除选中」；加入歌单后立即播放第一首。
- 搜索改为顶部细进度条的局部加载，不再遮罩整页；播放栏完整显示歌手名。
- 桌面端更换全新品牌图标；内置后端同步新版播放条、离线曲库封面与「最近更新」封面缓存。

| 系统 | 下载 |
| --- | --- |
| macOS（Apple 芯片） | [未末音乐-1.2.9-mac-arm64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.9/未末音乐-1.2.9-mac-arm64.dmg) |
| macOS（Intel） | [未末音乐-1.2.9-mac-x64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.9/未末音乐-1.2.9-mac-x64.dmg) |
| Windows（64 位） | [未末音乐-1.2.9-windows-x64.exe](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.9/未末音乐-1.2.9-windows-x64.exe) |

### v1.2.8

- 新版本发现由每 6 小时改为运行期间约每分钟检查，切回窗口、电脑唤醒或恢复网络时补查，无需重启应用。
- 顶部常驻“检查更新”按钮，可手动立即检查；检查失败会提示重试。
- 后台优先使用刷新缓存的官方发布清单，并限制 GitHub API 回退频率；更新检查不会覆盖正在安装的进度和错误提示。

| 系统 | 下载 |
| --- | --- |
| macOS（Apple 芯片） | [qiuqiumusic-1.2.8-macos-arm64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.8/qiuqiumusic-1.2.8-macos-arm64.dmg) |
| macOS（Intel） | [qiuqiumusic-1.2.8-macos-x64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.8/qiuqiumusic-1.2.8-macos-x64.dmg) |
| Windows（64 位） | [qiuqiumusic-1.2.8-windows-x64.exe](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.8/qiuqiumusic-1.2.8-windows-x64.exe) |

### v1.2.7

- 修复连续切歌后本地音频连接被占满，导致已缓存歌曲一直加载或超时的问题。
- 桌面音频使用独立的本地传输链路，并读完响应后释放连接；无需清理缓存、歌单或收藏。
- 新增尾部元数据 M4A 回归：连续切歌 60 次后验证播放、拖动进度、暂停恢复与零上游调用。

| 系统 | 下载 |
| --- | --- |
| macOS（Apple 芯片） | [qiuqiumusic-1.2.7-macos-arm64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.7/qiuqiumusic-1.2.7-macos-arm64.dmg) |
| macOS（Intel） | [qiuqiumusic-1.2.7-macos-x64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.7/qiuqiumusic-1.2.7-macos-x64.dmg) |
| Windows（64 位） | [qiuqiumusic-1.2.7-windows-x64.exe](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.7/qiuqiumusic-1.2.7-windows-x64.exe) |

### v1.2.6

- 新增播放快捷键：先按 Q，再在 2 秒内按空格（播放/暂停）、P（播放）、S（暂停）、←（上一首）、→（下一首）。
- 仅未末音乐窗口内生效，不注册全局热键；输入文字、输入法组字和弹窗期间不触发。
- 播放条新增键盘说明按钮；按 Esc、点击其他位置或切换窗口可取消待输入的快捷键。

| 系统 | 下载 |
| --- | --- |
| macOS（Apple 芯片） | [qiuqiumusic-1.2.6-macos-arm64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.6/qiuqiumusic-1.2.6-macos-arm64.dmg) |
| macOS（Intel） | [qiuqiumusic-1.2.6-macos-x64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.6/qiuqiumusic-1.2.6-macos-x64.dmg) |
| Windows（64 位） | [qiuqiumusic-1.2.6-windows-x64.exe](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.6/qiuqiumusic-1.2.6-windows-x64.exe) |

### v1.2.5

- 修复已缓存歌曲卡在“正在加载”、必须退出重启才能继续播放的问题。
- 加载或缓冲超时自动重载一次并保留进度；持续失败时提示手动重试，暂停与切歌会取消恢复任务。
- 桌面音频重试读取本地磁盘缓存，取消已放弃的传输请求。

| 系统 | 下载 |
| --- | --- |
| macOS（Apple 芯片） | [qiuqiumusic-1.2.5-macos-arm64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.5/qiuqiumusic-1.2.5-macos-arm64.dmg) |
| macOS（Intel） | [qiuqiumusic-1.2.5-macos-x64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.5/qiuqiumusic-1.2.5-macos-x64.dmg) |
| Windows（64 位） | [qiuqiumusic-1.2.5-windows-x64.exe](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.5/qiuqiumusic-1.2.5-windows-x64.exe) |

### v1.2.4

- “保存链接”恢复为安装到主屏幕/程序坞的系统安装引导（功能与更名前一致），文案保留“保存链接”。
- 按钮图标由下载箭头改为保存（软盘）图标，样式与“下载桌面版”一致：浅色底 + 主题色文字。
- 下载即安装包（DMG / EXE），不再需要解压 ZIP。

| 系统 | 下载 |
| --- | --- |
| macOS（Apple 芯片） | [qiuqiumusic-1.2.4-macos-arm64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.4/qiuqiumusic-1.2.4-macos-arm64.dmg) |
| macOS（Intel） | [qiuqiumusic-1.2.4-macos-x64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.4/qiuqiumusic-1.2.4-macos-x64.dmg) |
| Windows（64 位） | [qiuqiumusic-1.2.4-windows-x64.exe](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.4/qiuqiumusic-1.2.4-windows-x64.exe) |

### v1.2.3

- 播放清单打开时，点击面板与开关以外的任意位置自动收回。
- 桌面客户端内嵌站点同步 v1.2.2 全部清单与缓存改进。

安装包位于 `desktop/dist/1.2.3/`，下载即为对应系统的安装包，双击直接安装。

| 系统 | 下载 |
| --- | --- |
| macOS（Apple 芯片） | [qiuqiumusic-1.2.3-macos-arm64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.3/qiuqiumusic-1.2.3-macos-arm64.dmg) |
| macOS（Intel） | [qiuqiumusic-1.2.3-macos-x64.dmg](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.3/qiuqiumusic-1.2.3-macos-x64.dmg) |
| Windows（64 位） | [qiuqiumusic-1.2.3-windows-x64.exe](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.3/qiuqiumusic-1.2.3-windows-x64.exe) |

### v1.2.2

- 加入播放清单后自动从第一首开始播放，并在后台按顺序逐首缓存，切歌更快。
- 播放清单新增缓存进度条，颜色跟随当前皮肤；已缓存、缓存中、待缓存一眼可分。
- 清单按钮显示"当前曲目/总数"（如 3/20），点开后自动定位并高亮当前曲目。
- 音频缓存有效期调整为 1 周，一周未被播放的曲目自动清理，相关文案同步更新。
- 网页顶栏的"安装"入口更名为"保存链接"，点击即可复制站点链接；桌面客户端内隐藏该入口。

安装包位于 `desktop/dist/1.2.2/`，目录仅包含以下三个文件。ZIP 下载后先解压。

| 系统 | 下载 | ZIP 内的安装包 |
| --- | --- | --- |
| macOS（Apple 芯片） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.2/1.2.2-macos-arm64.zip) | 未末音乐-1.2.2-macos-arm64.dmg |
| macOS（Intel） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.2/1.2.2-macos-x64.zip) | 未末音乐-1.2.2-macos-x64.dmg |
| Windows（64 位） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.2/1.2.2-windows-x64.zip) | 未末音乐-1.2.2-windows-x64.exe |

### v1.2.1

- GitHub 匿名 API 限流时，使用官方仓库发布清单检查更新，无需用户登录 GitHub。
- 修复音源响应断线可能导致桌面进程退出的问题；播放失败会保留明确提示，点击播放可重新加载音源并重试。
- 调整应用图标唱片比例，与大唱片圆角图标参考保持一致。

- 桌面顶栏新增更新提醒：发现正式新版本后显示，点击一次自动匹配系统和芯片、下载、核对 SHA-256、保存播放记录、安装并重启。
- 下载期间可继续听歌；重启后恢复歌曲、进度及更新前的播放状态。页面切换不丢失更新进度，重复点击不会创建多次更新。
- 使用官方 GitHub Releases，不依赖 Render；校验失败不替换应用。Mac 新版启动失败会恢复备份。Windows 使用 NSIS 静默安装，失败保留恢复副本；系统要求的权限提示仍会显示。
- 1.1.0 及更早版本需先手动安装一次本版本，之后才具备一键更新能力。安装位置必须可写；Mac 请先将应用移入“应用程序”目录。

安装包位于 `desktop/dist/1.2.1/`，目录仅包含以下三个文件。ZIP 下载后先解压。

| 系统 | 下载 | ZIP 内的安装包 |
| --- | --- | --- |
| macOS（Apple 芯片） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.1/1.2.1-macos-arm64.zip) | 未末音乐-1.2.1-macos-arm64.dmg |
| macOS（Intel） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.1/1.2.1-macos-x64.zip) | 未末音乐-1.2.1-macos-x64.dmg |
| Windows（64 位） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.1/1.2.1-windows-x64.zip) | 未末音乐-1.2.1-windows-x64.exe |

### v1.1.0

桌面版将界面、后端、基础曲库和静态资源全部打包，本地运行，不再依赖 Render 网站。首页断网可打开，已缓存音频可离线播放；在线搜索、榜单更新及未缓存音频仍需连接外部音源。首次升级自动迁移旧桌面版的歌单、收藏、主题和播放进度。架构、数据位置及缓存限制见[桌面端说明](desktop/README.md)。

安装包位于 `desktop/dist/1.1.0/`，目录只保留 macOS Apple / Intel DMG 及 Windows x64 EXE。

| 系统 | 下载 | ZIP 内的安装包 |
| --- | --- | --- |
| macOS（Apple 芯片） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.1.0/1.1.0-macos-arm64.zip) | 未末音乐-1.1.0-macos-arm64.dmg |
| macOS（Intel） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.1.0/1.1.0-macos-x64.zip) | 未末音乐-1.1.0-macos-x64.dmg |
| Windows（64 位） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.1.0/1.1.0-windows-x64.zip) | 未末音乐-1.1.0-windows-x64.exe |


### v1.0.10

- 悬浮窗口不抢系统焦点；清除点击高亮及快捷按钮背景模糊合成，保持圆周外透明。
- 电脑网页顶栏新增“下载桌面版”：Windows 直接匹配，Mac 能识别芯片时直接匹配，无法识别时可选 Apple / Intel 包。手机和平板及原生客户端隐藏此入口。
- 网页下载入口自动读取 GitHub 最新正式版，暂时不可用时回退到 README 当前版本链接；下载 ZIP 后请先解压。

正式安装包位于 `desktop/dist/1.0.10/`，仅保留以下三个文件。

| 系统 | 下载 | ZIP 内的安装包 |
| --- | --- | --- |
| macOS（Apple 芯片） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.10/1.0.10-macos-arm64.zip) | 未末音乐-1.0.10-macos-arm64.dmg |
| macOS（Intel） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.10/1.0.10-macos-x64.zip) | 未末音乐-1.0.10-macos-x64.dmg |
| Windows（64 位） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.10/1.0.10-windows-x64.zip) | 未末音乐-1.0.10-windows-x64.exe |

### v1.0.9

悬浮播放器移除外圈进度底色，仅显示已播放的珊瑚色弧线；加粗弧线，0% 时完全隐藏。已验证深浅背景和 0%、25%、50%、100% 的透明像素表现。

正式安装包位于 `desktop/dist/1.0.9/`，目录仅保留以下三个文件。下载 ZIP 后解压安装。

| 系统 | 下载 | ZIP 内的安装包 |
| --- | --- | --- |
| macOS（Apple 芯片） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.9/1.0.9-macos-arm64.zip) | 未末音乐-1.0.9-macos-arm64.dmg |
| macOS（Intel） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.9/1.0.9-macos-x64.zip) | 未末音乐-1.0.9-macos-x64.dmg |
| Windows（64 位） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.9/1.0.9-windows-x64.zip) | 未末音乐-1.0.9-windows-x64.exe |

### v1.0.8

修复 macOS 点击悬浮窗口 × 后未完全退出、随后播放控制失效的问题；已验证关闭/重开主界面，以及连续暂停、恢复后的真实音频进度。正式站点恢复为 <https://qiuqiumusic.onrender.com/>。

正式安装包位于 `desktop/dist/1.0.8/`，仅保留以下三个文件。下载 ZIP 后解压安装。

| 系统 | 下载 | ZIP 内的安装包 |
| --- | --- | --- |
| macOS（Apple 芯片） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.8/1.0.8-macos-arm64.zip) | 未末音乐-1.0.8-macos-arm64.dmg |
| macOS（Intel） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.8/1.0.8-macos-x64.zip) | 未末音乐-1.0.8-macos-x64.dmg |
| Windows（64 位） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.8/1.0.8-windows-x64.zip) | 未末音乐-1.0.8-windows-x64.exe |

### v1.0.7

正式安装包位于 `desktop/dist/1.0.7/`，目录只保留两个 macOS DMG 和一个 Windows EXE。GitHub 下载使用 ZIP 保存中文名安装包，请先解压再安装。

| 系统 | 下载 | ZIP 内的安装包 |
| --- | --- | --- |
| macOS（Apple 芯片） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.7/1.0.7-macos-arm64.zip) | 未末音乐-1.0.7-macos-arm64.dmg |
| macOS（Intel） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.7/1.0.7-macos-x64.zip) | 未末音乐-1.0.7-macos-x64.dmg |
| Windows（64 位） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.7/1.0.7-windows-x64.zip) | 未末音乐-1.0.7-windows-x64.exe |

程序坞图标按 QQ、微信的图形占比调整，启动时刷新当前图标；菜单栏改为带音符的单色图标。悬停面板去掉整块底色，标题宽度随内容变化，文字描边和独立按钮底保证清晰可见。

### v1.0.6

本地正式安装包位于 `desktop/dist/1.0.6/`，该目录只保留两个 macOS DMG 和一个 Windows EXE；后续版本使用各自的版本号目录。

安装包统一命名为“未末音乐-版本号-系统-架构”。[GitHub 会过滤上传文件名中的中文](https://docs.github.com/en/rest/releases/assets)，因此此版本提供 ZIP 下载；请解压后运行其中的中文名安装包。

| 系统 | 下载 | ZIP 内的安装包 |
| --- | --- | --- |
| macOS（Apple 芯片） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.6/1.0.6-macos-arm64.zip) | 未末音乐-1.0.6-macos-arm64.dmg |
| macOS（Intel） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.6/1.0.6-macos-x64.zip) | 未末音乐-1.0.6-macos-x64.dmg |
| Windows（64 位） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.6/1.0.6-windows-x64.zip) | 未末音乐-1.0.6-windows-x64.exe |

### v1.0.5

| 系统 | 安装包 | 架构 |
| --- | --- | --- |
| macOS（Apple 芯片） | [下载 DMG](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.5/qiuqiumusic-1.0.5-macos-arm64.dmg) | arm64 |
| macOS（Intel） | [下载 DMG](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.5/qiuqiumusic-1.0.5-macos-x64.dmg) | x64 |
| Windows（64 位） | [下载安装程序](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.5/qiuqiumusic-1.0.5-windows-x64.exe) | x64 |

菜单栏使用独立的小尺寸单色图标，程序坞使用正常大小的圆角图标。悬浮播放器支持悬停快捷切歌和播放/暂停，进度环采用珊瑚色；固定窗口尺寸减少悬停闪烁。

### v1.0.4

| 系统 | 安装包 | 架构 |
| --- | --- | --- |
| macOS（Apple 芯片，M1/M2/M3/M4） | [下载 DMG](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.4/qiuqiumusic-1.0.4-macos-arm64.dmg) | arm64 |
| macOS（Intel） | [下载 DMG](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.4/qiuqiumusic-1.0.4-macos-x64.dmg) | x64 |
| Windows（64 位） | [下载安装程序](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.4/qiuqiumusic-1.0.4-windows-x64.exe) | x64 |

本版本进一步缩小系统 Dock/任务栏图标；悬浮播放器的歌曲名改为半透明青绿色磨砂底，长标题会自动滚动显示。

### v1.0.3

| 系统 | 安装包 | 架构 |
| --- | --- | --- |
| macOS（Apple 芯片，M1/M2/M3/M4） | [下载 DMG](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.3/qiuqiumusic-1.0.3-macos-arm64.dmg) | arm64 |
| macOS（Intel） | [下载 DMG](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.3/qiuqiumusic-1.0.3-macos-x64.dmg) | x64 |
| Windows（64 位） | [下载安装程序](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.3/qiuqiumusic-1.0.3-windows-x64.exe) | x64 |

### v1.0.2

| 系统 | 安装包 | 架构 |
| --- | --- | --- |
| macOS（Apple 芯片，M1/M2/M3/M4） | [下载 DMG](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.2/qiuqiumusic-1.0.2-macos-arm64.dmg) | arm64 |
| macOS（Intel） | [下载 DMG](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.2/qiuqiumusic-1.0.2-macos-x64.dmg) | x64 |
| Windows（64 位） | [下载安装程序](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.2/qiuqiumusic-1.0.2-windows-x64.exe) | x64 |

全部版本的更新记录和安装包见 [GitHub Releases](https://github.com/kevinq888/qiuqiumusic/releases)。macOS 安装包尚未进行 Developer ID 签名和公证；首次打开时若系统拦截，请在“系统设置 → 隐私与安全性”中允许打开。

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

仓库根目录的 `render.yaml` 配置了 Render Web Service，可通过 Render Blueprint 连接 GitHub 仓库。线上服务从 GitHub `kevinq888/qiuqiumusic` 的 `main` 分支部署；向仓库推送后，按 Render 服务的自动部署设置发布。Codeup 副本的提交不会更新 Render 服务。

免费实例闲置后可能休眠，首次访问需等待服务启动；实例重启或重新部署后，临时文件缓存可能需要重新抓取。若需跨重启保留缓存，可使用带持久化磁盘的服务计划。

站点从上游公开页面生成榜单和搜索结果。首次访问或六小时缓存过期后会重新获取，因此部署环境需要能访问上游站点。缓存写入 `data/cache/`；播放音频也依赖上游 CDN 可用。

## 仓库

GitHub：[kevinq888/qiuqiumusic](https://github.com/kevinq888/qiuqiumusic) · Codeup：[kevinq/qiuqiumusic](https://codeup.aliyun.com/6305f229e8ec152a05d73b41/kevinq/qiuqiumusic)。
