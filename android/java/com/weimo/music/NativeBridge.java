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
}
