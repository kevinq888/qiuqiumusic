package com.weimo.music;

import android.app.ActivityManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** 通知栏/锁屏按钮的落地点：转给当前活动进程里的播放中心，再执行网页里的播放命令。 */
public class PlaybackReceiver extends BroadcastReceiver {
    static final String ACTION = "com.weimo.music.playback";
    /** 通知卡片被左右滑掉：暂停播放并彻底退出应用。 */
    static final String ACTION_EXIT = "com.weimo.music.exit";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        if (ACTION_EXIT.equals(intent.getAction())) {
            exitApp(context);
            return;
        }
        PlaybackCenter center = PlaybackCenter.active;
        if (center == null) return;
        if (ACTION.equals(intent.getAction())) center.handleCommand(intent.getStringExtra("cmd"));
    }

    private void exitApp(Context context) {
        PlaybackCenter center = PlaybackCenter.active;
        if (center != null) {
            // 先让网页暂停，避免退出瞬间还有声音
            center.handleCommand("pause");
            center.dismiss();
        }
        MainActivity.finishForExit();
        // :node 是独立进程，必须单独通知它自行结束
        try {
            Intent node = new Intent(context, NodeService.class).setAction(NodeService.ACTION_EXIT);
            context.startService(node);
        } catch (Throwable ignored) {
        }
        try {
            context.stopService(new Intent(context, NodeService.class));
        } catch (Throwable ignored) {
        }
        try {
            ActivityManager manager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
            if (manager != null) manager.killBackgroundProcesses(context.getPackageName());
        } catch (Throwable ignored) {
        }
        android.os.Process.killProcess(android.os.Process.myPid());
    }
}
