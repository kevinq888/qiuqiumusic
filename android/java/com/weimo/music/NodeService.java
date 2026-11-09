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
    private Thread worker;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        BootLog.init(getFilesDir());
        int variant = intent != null ? intent.getIntExtra(EXTRA_VARIANT, 0) : 0;
        BootLog.append("service: start requested variant=" + variant);
        if (worker == null) {
            String base = new File(getFilesDir(), "app").getAbsolutePath();
            String data = new File(getFilesDir(), "userdata").getAbsolutePath();
            worker = new Thread(null, new Starter(base, data, BootLog.path(), variant),
                    "weimo-node", 16 * 1024 * 1024);
            worker.start();
        }
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
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
