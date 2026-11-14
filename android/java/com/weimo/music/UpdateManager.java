package com.weimo.music;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 安卓安装包下载器：把文件切成多段并行下载（加速），每段进度落到 meta 文件，
 * 网络中断或应用被杀后再次点击「检查更新」会从已有进度继续，不会从头重下。
 */
final class UpdateManager {
    private static final String TAG = "WeiMoUpdate";
    private static final int SEGMENTS = 4;
    private static final int BUFFER = 64 * 1024;

    private static final Object LOCK = new Object();
    private static volatile String status = "idle";   // idle / downloading / done / error
    private static volatile String error = "";
    private static volatile long total = 0;
    private static volatile long speed = 0;
    private static volatile String fileName = "";
    private static volatile String version = "";
    private static volatile int generation = 0;
    private static volatile long[] segStart = new long[SEGMENTS];
    private static volatile long[] segEnd = new long[SEGMENTS];
    private static volatile long[] segDone = new long[SEGMENTS];
    private static volatile boolean ranged = true;
    private static volatile String source = "";
    private static volatile File metaFile;

    private UpdateManager() {
    }

    static File updatesDir(Context context) {
        File dir = context.getExternalFilesDir("updates");
        if (dir == null) dir = new File(context.getFilesDir(), "updates");
        if (!dir.exists() && !dir.mkdirs()) Log.w(TAG, "无法创建更新目录");
        return dir;
    }

    static String statusJson() {
        JSONObject json = new JSONObject();
        try {
            json.put("status", status);
            json.put("done", downloaded());
            json.put("total", total);
            json.put("speed", speed);
            json.put("error", error);
            json.put("file", fileName);
            json.put("version", version);
        } catch (Exception ignored) {
        }
        return json.toString();
    }

    private static long downloaded() {
        long sum = 0;
        for (int i = 0; i < SEGMENTS; i++) sum += segDone[i];
        return sum;
    }

    static boolean start(Context context, String url, String name, String ver) {
        if (url == null || url.isEmpty()) return false;
        synchronized (LOCK) {
            String safeName = name == null || name.isEmpty() ? "update.apk" : name.replaceAll("[\\\\/:*?\"<>|]", "_");
            if ("downloading".equals(status) && ver != null && ver.equals(version)) return true;
            final int gen = ++generation;
            status = "downloading";
            error = "";
            speed = 0;
            total = 0;
            version = ver == null ? "" : ver;
            fileName = safeName;
            source = url;
            for (int i = 0; i < SEGMENTS; i++) {
                segStart[i] = 0;
                segEnd[i] = -1;
                segDone[i] = 0;
            }
            final Context app = context.getApplicationContext();
            final File target = new File(updatesDir(app), safeName);
            metaFile = new File(target.getPath() + ".part.meta");
            new Thread(() -> run(gen, url, target), "update-download").start();
            return true;
        }
    }

    private static void run(int gen, String url, File target) {
        File part = new File(target.getPath() + ".part");
        try {
            Probe probe = probe(url);
            if (probe.total <= 0) throw new IOException("无法获取安装包大小");
            total = probe.total;
            ranged = probe.ranged;
            if (!ranged) {
                // 服务器不支持分段时只能单线程下载，仍然可以下载，只是无法加速/续传。
                deleteFile(part);
                deleteFile(metaFile);
                downloadWhole(gen, url, part, probe.total);
            } else {
                boolean fresh = !loadMeta(url, probe.total);
                if (fresh) {
                    deleteFile(part);
                    initSegments(probe.total);
                }
                saveMeta(url, probe.total);
                startTicker(gen);
                Thread[] workers = new Thread[SEGMENTS];
                for (int i = 0; i < SEGMENTS; i++) {
                    final int index = i;
                    workers[i] = new Thread(() -> downloadSegment(gen, url, part, index), "update-seg-" + i);
                    workers[i].start();
                }
                for (Thread worker : workers) worker.join();
                if (gen != generation) return;
                if (downloaded() < total) throw new IOException("下载未完成，请重试");
            }
            if (gen != generation) return;
            if (target.exists() && !target.delete()) throw new IOException("无法覆盖旧安装包");
            if (!part.renameTo(target)) throw new IOException("无法保存安装包");
            deleteFile(metaFile);
            speed = 0;
            status = "done";
            BootLog.append("update: downloaded " + target.getName() + " (" + target.length() + " bytes)");
        } catch (Throwable failure) {
            if (gen != generation) return;
            speed = 0;
            error = failure.getMessage() == null ? "下载失败，请重试" : failure.getMessage();
            status = "error";
            BootLog.append("update: failed " + error);
        }
    }

    private static final class Probe {
        final long total;
        final boolean ranged;

        Probe(long total, boolean ranged) {
            this.total = total;
            this.ranged = ranged;
        }
    }

    private static Probe probe(String url) throws IOException {
        HttpURLConnection connection = open(url, "bytes=0-0");
        try {
            int code = connection.getResponseCode();
            if (code == 206) {
                String range = connection.getHeaderField("Content-Range");
                long size = parseTotal(range);
                if (size > 0) return new Probe(size, true);
            }
            if (code == 200) {
                long size = connection.getContentLength();
                if (size > 0) return new Probe(size, false);
            }
            throw new IOException("HTTP " + code);
        } finally {
            connection.disconnect();
        }
    }

    private static long parseTotal(String contentRange) {
        if (contentRange == null) return 0;
        int slash = contentRange.lastIndexOf('/');
        if (slash < 0) return 0;
        try {
            return Long.parseLong(contentRange.substring(slash + 1).trim());
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private static void initSegments(long size) {
        long chunk = size / SEGMENTS;
        for (int i = 0; i < SEGMENTS; i++) {
            segStart[i] = chunk * i;
            segEnd[i] = i == SEGMENTS - 1 ? size - 1 : chunk * (i + 1) - 1;
            segDone[i] = 0;
        }
    }

    private static void downloadSegment(int gen, String url, File part, int index) {
        int attempts = 0;
        while (gen == generation && attempts < 6) {
            long start = segStart[index];
            long end = segEnd[index];
            long offset = segDone[index];
            if (end < start || offset >= end - start + 1) return;
            long from = start + offset;
            HttpURLConnection connection = null;
            RandomAccessFile out = null;
            try {
                connection = open(url, "bytes=" + from + "-" + end);
                int code = connection.getResponseCode();
                if (code != 206) throw new IOException("HTTP " + code);
                InputStream in = connection.getInputStream();
                out = new RandomAccessFile(part, "rw");
                out.seek(from);
                byte[] buffer = new byte[BUFFER];
                long written = offset;
                long limit = end - start + 1;
                long lastSave = System.currentTimeMillis();
                int read;
                while (gen == generation && (read = in.read(buffer)) != -1) {
                    if (written >= limit) break;
                    int allowed = (int) Math.min(read, limit - written);
                    out.write(buffer, 0, allowed);
                    written += allowed;
                    segDone[index] = written;
                    if (System.currentTimeMillis() - lastSave > 1200) {
                        saveMeta(url, total);
                        lastSave = System.currentTimeMillis();
                    }
                }
                if (written >= limit) {
                    saveMeta(url, total);
                    return;
                }
                attempts++;
            } catch (Throwable failure) {
                attempts++;
                if (gen != generation) return;
                Log.w(TAG, "segment " + index + " retry " + attempts, failure);
                sleep(600L * attempts);
            } finally {
                if (out != null) try { out.close(); } catch (IOException ignored) { }
                if (connection != null) connection.disconnect();
            }
        }
        if (gen == generation) throw new IllegalStateException("网络不稳定，下载中断");
    }

    private static void downloadWhole(int gen, String url, File part, long size) throws IOException {
        HttpURLConnection connection = open(url, null);
        try {
            int code = connection.getResponseCode();
            if (code != 200) throw new IOException("HTTP " + code);
            startTicker(gen);
            InputStream in = connection.getInputStream();
            FileOutputStream out = new FileOutputStream(part);
            try {
                byte[] buffer = new byte[BUFFER];
                long written = 0;
                int read;
                while (gen == generation && (read = in.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                    written += read;
                    segDone[0] = written;
                    total = size;
                }
                if (written < size) throw new IOException("下载未完成，请重试");
            } finally {
                out.close();
            }
        } finally {
            connection.disconnect();
        }
    }

    private static void startTicker(int gen) {
        new Thread(() -> {
            long last = downloaded();
            long lastAt = System.currentTimeMillis();
            while (gen == generation && "downloading".equals(status)) {
                sleep(800);
                long now = downloaded();
                long at = System.currentTimeMillis();
                long span = Math.max(1, at - lastAt);
                speed = Math.max(0, (now - last) * 1000 / span);
                last = now;
                lastAt = at;
            }
            if (gen == generation) speed = 0;
        }, "update-speed").start();
    }

    private static boolean loadMeta(String url, long size) {
        File meta = metaFile;
        if (meta == null || !meta.exists()) return false;
        try {
            String text = readText(meta);
            JSONObject json = new JSONObject(text);
            if (!url.equals(json.optString("url"))) return false;
            if (size != json.optLong("total")) return false;
            JSONArray segs = json.optJSONArray("segs");
            if (segs == null || segs.length() != SEGMENTS) return false;
            File part = new File(meta.getPath().replace(".meta", ""));
            if (!part.exists()) return false;
            for (int i = 0; i < SEGMENTS; i++) {
                JSONObject seg = segs.getJSONObject(i);
                segStart[i] = seg.optLong("start");
                segEnd[i] = seg.optLong("end");
                segDone[i] = Math.min(seg.optLong("done"), segEnd[i] - segStart[i] + 1);
            }
            return true;
        } catch (Throwable error) {
            Log.w(TAG, "meta unreadable", error);
            return false;
        }
    }

    // 多个分片线程会同时保存进度，串行化避免写坏同一个临时文件。
    private static synchronized void saveMeta(String url, long size) {
        File meta = metaFile;
        if (meta == null) return;
        try {
            JSONObject json = new JSONObject();
            json.put("url", url);
            json.put("total", size);
            json.put("version", version);
            JSONArray segs = new JSONArray();
            for (int i = 0; i < SEGMENTS; i++) {
                JSONObject seg = new JSONObject();
                seg.put("start", segStart[i]);
                seg.put("end", segEnd[i]);
                seg.put("done", segDone[i]);
                segs.put(seg);
            }
            json.put("segs", segs);
            File tmp = new File(meta.getPath() + ".tmp");
            FileOutputStream out = new FileOutputStream(tmp);
            try {
                out.write(json.toString().getBytes("UTF-8"));
            } finally {
                out.close();
            }
            if (!tmp.renameTo(meta)) deleteFile(tmp);
        } catch (Throwable error) {
            Log.w(TAG, "meta save failed", error);
        }
    }

    private static String readText(File file) throws IOException {
        java.io.FileInputStream in = new java.io.FileInputStream(file);
        try {
            byte[] buffer = new byte[(int) Math.min(file.length(), 64 * 1024)];
            int read = in.read(buffer);
            return new String(buffer, 0, Math.max(0, read), "UTF-8");
        } finally {
            in.close();
        }
    }

    static String install(Activity activity) {
        File target = new File(updatesDir(activity), fileName);
        if (!target.exists()) return "missing";
        // JS 桥接线程不是 UI 线程，startActivity 必须切回主线程。
        if (Build.VERSION.SDK_INT >= 26 && !activity.getPackageManager().canRequestPackageInstalls()) {
            final Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + activity.getPackageName()));
            activity.runOnUiThread(() -> {
                try {
                    activity.startActivity(settings);
                } catch (Throwable error) {
                    Log.w(TAG, "permission page failed", error);
                }
            });
            return "permission";
        }
        final Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(UpdateFileProvider.uriFor(target), "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.runOnUiThread(() -> {
            try {
                activity.startActivity(intent);
            } catch (Throwable error) {
                Log.w(TAG, "install failed", error);
            }
        });
        return "ok";
    }

    private static HttpURLConnection open(String url, String range) throws IOException {
        String current = url;
        for (int hop = 0; hop < 6; hop++) {
            HttpURLConnection connection = (HttpURLConnection) new URL(current).openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            connection.setRequestProperty("User-Agent", "WeiMoMusic-Android");
            if (range != null) connection.setRequestProperty("Range", range);
            int code = connection.getResponseCode();
            if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                if (location == null) throw new IOException("重定向缺少地址");
                current = new URL(new URL(current), location).toString();
                continue;
            }
            return connection;
        }
        throw new IOException("重定向次数过多");
    }

    private static void deleteFile(File file) {
        if (file != null && file.exists() && !file.delete()) Log.w(TAG, "delete failed " + file);
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
    }
}
