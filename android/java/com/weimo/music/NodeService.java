package com.weimo.music;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

/** 内置 Node 跑在独立 :node 进程里：哪怕它原生崩溃，界面进程也能活着显示原因。 */
public class NodeService extends Service {
    private static final int PORT = 43219;
    static final String EXTRA_VARIANT = "variant";
    /** 应用退出：让 :node 进程自行结束，主进程随后一并退出。 */
    static final String ACTION_EXIT = "com.weimo.music.node.exit";
    private Thread worker;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        BootLog.init(getFilesDir());
        if (intent != null && ACTION_EXIT.equals(intent.getAction())) {
            BootLog.append("service: exit requested");
            stopSelf();
            new Thread(() -> {
                try {
                    Thread.sleep(120);
                } catch (InterruptedException ignored) {
                }
                android.os.Process.killProcess(android.os.Process.myPid());
            }).start();
            return START_NOT_STICKY;
        }
        int variant = intent != null ? intent.getIntExtra(EXTRA_VARIANT, 0) : 0;
        BootLog.append("service: start requested variant=" + variant);
        if (worker == null) {
            String base = new File(getFilesDir(), "app").getAbsolutePath();
            String data = new File(getFilesDir(), "userdata").getAbsolutePath();
            worker = new Thread(null, new Starter(base, data, BootLog.path(), variant),
                    "weimo-node", 16 * 1024 * 1024);
            worker.start();
        }
        // 被系统在后台回收后自动重启内置 Node，避免切回 App 时本地服务已死导致白屏
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // 用户从最近任务里划掉 App：停止服务并结束 :node 进程，
        // 避免 START_STICKY 在后台把内置服务重新拉起形成僵尸进程。
        BootLog.append("service: task removed, stop");
        stopSelf();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        // 服务被停止意味着应用真的退出了：内置 Node 跑在本进程里，必须连同进程一起结束
        BootLog.append("service: destroyed, exit node process");
        new Thread(() -> {
            try {
                Thread.sleep(150);
            } catch (InterruptedException ignored) {
            }
            android.os.Process.killProcess(android.os.Process.myPid());
        }).start();
    }

    /** 在独立线程里阻塞运行内置 Node。 */
    private static final class Starter implements Runnable {
        private final String base;
        private final String data;
        private final String logPath;
        private final int variant;

        Starter(String base, String data, String logPath, int variant) {
            this.base = base;
            this.data = data;
            this.logPath = logPath;
            this.variant = variant;
        }

        @Override
        public void run() {
            try {
                NodeRunner.startNode(base + "/mobile-boot.js", base, String.valueOf(PORT), data,
                        logPath, variant);
            } catch (Throwable error) {
                append(logPath, "java: node start failed: " + Log.getStackTraceString(error));
            }
        }
    }

    private static void append(String path, String text) {
        try {
            FileOutputStream out = new FileOutputStream(path, true);
            try {
                out.write((text + "\n").getBytes("UTF-8"));
            } finally {
                out.close();
            }
        } catch (IOException ignored) {
        }
    }
}
