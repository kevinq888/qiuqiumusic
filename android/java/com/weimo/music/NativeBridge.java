package com.weimo.music;

import android.webkit.JavascriptInterface;

/** 网页与原生之间的最小桥接：播放页系统栏配色 + 锁屏/通知栏媒体信息。 */
final class NativeBridge {
    private final MainActivity host;

    NativeBridge(MainActivity host) {
        this.host = host;
    }

    @JavascriptInterface
    public void setPlayerMode(boolean playing) {
        host.setPlayerModeFromScript(playing);
    }

    @JavascriptInterface
    public void setNowPlaying(String json) {
        host.setNowPlayingFromScript(json);
    }

    /** 状态栏/导航栏占位，返回 "top,bottom"（CSS px）；播放页据此留出安全区。 */
    @JavascriptInterface
    public String safeInsets() {
        return host.safeInsets();
    }

    /** 已安装的版本号，更新检查以此为准（内置服务里的版本与安装包一致，无法判断是否有新版本）。 */
    @JavascriptInterface
    public String appVersion() {
        return host.appVersionForScript();
    }

    /** 当前系统，例如 "Android 14"。 */
    @JavascriptInterface
    public String platform() {
        return host.platformForScript();
    }

    /** 启动多线程下载（支持断点续传）。 */
    @JavascriptInterface
    public boolean startUpdateDownload(String url, String fileName, String version) {
        return host.startUpdateDownload(url, fileName, version);
    }

    /** 下载进度 JSON：{status,done,total,speed,error,version}。 */
    @JavascriptInterface
    public String updateDownloadStatus() {
        return UpdateManager.statusJson();
    }

    /** 安装已下载的安装包；返回 ok / permission / missing / error。 */
    @JavascriptInterface
    public String installUpdateDownloaded() {
        return host.installUpdate();
    }
}
