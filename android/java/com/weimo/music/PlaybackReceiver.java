package com.weimo.music;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** 通知栏/锁屏按钮的落地点：转给当前活动进程里的播放中心，再执行网页里的播放命令。 */
public class PlaybackReceiver extends BroadcastReceiver {
    static final String ACTION = "com.weimo.music.playback";

    @Override
    public void onReceive(Context context, Intent intent) {
        PlaybackCenter center = PlaybackCenter.active;
        if (center == null || intent == null) return;
        if (ACTION.equals(intent.getAction())) center.handleCommand(intent.getStringExtra("cmd"));
    }
}
