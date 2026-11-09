package com.qiuqiu.music;

import android.util.Log;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;

/** 启动日志：主进程与 :node 进程都可追加写，主进程据此展示诊断页。 */
final class BootLog {
    private static final String TAG = "QiuQiu";
    private static File logFile;
    private static File marker;
    private static File failsFile;

    private BootLog() {}

    static synchronized void init(File dir) {
        if (logFile == null) {
            logFile = new File(dir, "run.log");
            marker = new File(dir, ".running");
            failsFile = new File(dir, ".fails");
        }
    }

    /** 连续启动失败的次数，用于逐级降级（软件渲染 → 纯文本页）。 */
    static synchronized int failures() {
        if (failsFile == null || !failsFile.exists()) return 0;
        InputStream in = null;
        try {
            in = new FileInputStream(failsFile);
            byte[] buffer = new byte[8];
            int read = in.read(buffer);
            if (read <= 0) return 0;
            return Integer.parseInt(new String(buffer, 0, read, "UTF-8").trim());
        } catch (Exception ignored) {
            return 0;
        } finally {
            if (in != null) try { in.close(); } catch (IOException ignored) { }
        }
    }

    static synchronized void setFailures(int count) {
        if (failsFile == null) return;
        if (count <= 0) {
            //noinspection ResultOfMethodCallIgnored
            failsFile.delete();
            return;
        }
        try {
            FileOutputStream out = new FileOutputStream(failsFile);
            try {
                out.write(String.valueOf(count).getBytes("UTF-8"));
            } finally {
                out.close();
            }
        } catch (IOException ignored) {
        }
    }

    /** 原生层需要日志的绝对路径。 */
    static synchronized String path() {
        return logFile != null ? logFile.getAbsolutePath() : "";
    }

    /** 标记“本次启动开始”，只要没走到服务就绪，下次启动就会展示日志。 */
    static synchronized void mark() {
        if (marker == null || marker.exists()) return;
        try {
            if (!marker.createNewFile()) Log.w(TAG, "无法写入运行标记");
        } catch (IOException error) {
            Log.w(TAG, "写运行标记失败", error);
        }
    }

    static synchronized boolean pending() {
        return marker != null && marker.exists();
    }

    /** 服务就绪后清除标记。 */
    static synchronized void finish() {
        if (marker != null && marker.exists() && !marker.delete()) Log.w(TAG, "无法清理运行标记");
    }

    static synchronized void reset() {
        if (logFile != null && logFile.exists() && !logFile.delete()) Log.w(TAG, "无法清理旧日志");
        if (marker != null) mark();
    }

    /** 读取上次未完成的日志并清除标记；没有未完成记录时返回 null。 */
    static synchronized String takePending() {
        if (!pending()) return null;
        String text = read();
        finish();
        return text;
    }

    static synchronized String read() {
        if (logFile == null) return "";
        StringBuilder text = new StringBuilder();
        InputStream in = null;
        try {
            in = new FileInputStream(logFile);
            byte[] buffer = new byte[8192];
            int size;
            while ((size = in.read(buffer)) != -1) {
                text.append(new String(buffer, 0, size, "UTF-8"));
            }
        } catch (IOException ignored) {
        } finally {
            if (in != null) try { in.close(); } catch (IOException ignored) { }
        }
        return text.toString();
    }

    static synchronized void append(String text) {
        if (logFile == null) return;
        try {
            FileOutputStream out = new FileOutputStream(logFile, true);
            try {
                out.write((text + "\n").getBytes("UTF-8"));
            } finally {
                out.close();
            }
        } catch (IOException ignored) {
        }
    }
}
