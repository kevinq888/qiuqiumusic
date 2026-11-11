package com.weimo.music;

import android.webkit.JavascriptInterface;

/** 网页与原生之间的最小桥接：目前只有播放页系统栏配色切换。 */
final class NativeBridge {
    private final MainActivity host;

    NativeBridge(MainActivity host) {
        this.host = host;
    }

    @JavascriptInterface
    public void setPlayerMode(boolean playing) {
        host.setPlayerModeFromScript(playing);
    }
}
