package com.qiuqiu.music;

import android.app.Application;
import android.os.Build;
import android.util.Log;

/**
 * 进程入口：在 Activity 之前就装好崩溃捕获并写日志，
 * 这样即使启动早期（WebView/类加载）崩溃，下次打开也能看到原因。
 */
public class QiuQiuApp extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        BootLog.init(getFilesDir());
        String process = processName();
        BootLog.append("app: process=" + process + " pid=" + android.os.Process.myPid()
                + " sdk=" + Build.VERSION.SDK_INT + " abis=" + join(Build.SUPPORTED_ABIS)
                + " pageSize=" + pageSize());
        BootLog.append("device: brand=" + Build.BRAND + " model=" + Build.MODEL
                + " android=" + Build.VERSION.RELEASE);

        Thread.setDefaultUncaughtExceptionHandler(new CrashLogger(
                Thread.getDefaultUncaughtExceptionHandler()));
    }

    private static String join(String[] values) {
        if (values == null) return "";
        StringBuilder text = new StringBuilder();
        for (String value : values) {
            if (text.length() > 0) text.append(',');
            text.append(value);
        }
        return text.toString();
    }

    private static String pageSize() {
        try {
            return String.valueOf(android.system.Os.sysconf(android.system.OsConstants._SC_PAGESIZE));
        } catch (Throwable error) {
            return "unknown";
        }
    }

    private String processName() {
        if (Build.VERSION.SDK_INT >= 28) {
            try {
                String name = getProcessName();
                if (name != null) return name;
            } catch (Throwable ignored) {
            }
        }
        // API 28 以下没有公开接口，退化为包名（子进程会误判为主进程，只影响标记文件，可接受）。
        return getPackageName();
    }

    private static final class CrashLogger implements Thread.UncaughtExceptionHandler {
        private final Thread.UncaughtExceptionHandler fallback;

        CrashLogger(Thread.UncaughtExceptionHandler fallback) {
            this.fallback = fallback;
        }

        @Override
        public void uncaughtException(Thread thread, Throwable error) {
            BootLog.append("java: uncaught in " + thread.getName() + ": "
                    + Log.getStackTraceString(error));
            if (fallback != null) fallback.uncaughtException(thread, error);
        }
    }
}
