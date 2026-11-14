package com.weimo.music;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.system.Os;
import android.system.OsConstants;
import android.util.Log;
import android.util.TypedValue;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 未末音乐安卓端：内置 Node 运行时（独立 :node 进程）在本地 127.0.0.1 起服务，
 * WebView 加载同一个服务，页面、代理与音频缓存逻辑与网页版完全一致。
 * 启动过程写入 run.log；若上次启动没走到“服务就绪”，下次进入直接展示该日志。
 */
public class MainActivity extends Activity {
    private static final String TAG = "WeiMo";
    private static final int PORT = 43219;
    private static final String BACKEND_ASSET = "backend";
    private static final int MAX_ATTEMPTS = 150;

    private final Handler ui = new Handler(Looper.getMainLooper());
    private WebView web;
    private TextView fallback;
    private PlaybackCenter playback;
    private boolean booted;
    private boolean ready;
    private boolean pageReady;
    private int activePort = PORT;
    private int reloads;
    private int variant;
    private int probeRound;
    private String shownLog = "";

    /** 绑定 :node 进程，它一旦崩溃能立刻显示日志，而不是干等超时。 */
    private final ServiceConnection nodeConnection = new NodeConnection(this);

    /** 绑定 :node 进程，它一旦崩溃能立刻显示日志，而不是干等超时。 */
    private static final class NodeConnection implements ServiceConnection {
        private final MainActivity host;

        NodeConnection(MainActivity host) {
            this.host = host;
        }

        @Override
        public void onServiceConnected(ComponentName name, IBinder binder) {
            BootLog.append("service: node process up");
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            BootLog.append("service: node process died");
            if (host.ready) return;
            host.ui.post(new DiedPage(host));
        }
    }

    private static final class DiedPage implements Runnable {
        private final MainActivity host;

        DiedPage(MainActivity host) {
            this.host = host;
        }

        @Override
        public void run() {
            host.retry();
        }
    }

    /** Node 进程崩溃后自动换一种启动方案重试，全部失败才展示日志。 */
    private void retry() {
        variant++;
        if (variant <= 2) {
            BootLog.append("run: retry with variant=" + variant);
            showSplashText("本地服务启动失败，正在尝试第 " + (variant + 1) + " 种启动方式…");
            startNodeService();
            probe(0);
            return;
        }
        showLogPage("本地服务进程异常退出", BootLog.read());
    }

    private void showSplashText(String text) {
        if (web == null) {
            if (fallback != null) fallback.setText(text);
            return;
        }
        web.loadDataWithBaseURL(null,
                "<html><body style='margin:0;height:100vh;display:flex;align-items:center;"
                        + "justify-content:center;background:#f1f8f5;color:#173c36;"
                        + "font-family:sans-serif;font-size:15px;text-align:center;padding:24px'>"
                        + text + "</body></html>",
                "text/html", "utf-8", null);
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        BootLog.init(getFilesDir());
        BootLog.append("run: activity created");

        String previous = BootLog.takePending();
        int fails = BootLog.failures();
        if (previous != null) fails++;
        if (fails > 2) fails = 2;
        BootLog.setFailures(fails);
        BootLog.mark();

        if (Build.VERSION.SDK_INT >= 21) {
            applyBarTheme(false);
        }
        // Android 13 起通知需要运行时授权，否则锁屏/通知栏的播放控制不会出现
        if (Build.VERSION.SDK_INT >= 33) {
            requestPermissions(new String[] { "android.permission.POST_NOTIFICATIONS" }, 1);
        }
        buildUi(previous != null);

        if (fails >= 2) return;
        // 上次没走到“页面就绪”不代表这次一定失败：仍然正常启动，失败时再展示日志。
        // 之前这里直接停在日志页，用户看到的就是“退出后重开没有界面”。
        boot(previous != null ? "上次启动未完成，这次已重新启动" : null);
    }

    /** WebView 不可用时（部分 ROM 会禁用或缺少 WebView）退回纯文本，至少能看到日志。 */
    private void buildUi(boolean safeMode) {
        int fails = BootLog.failures();
        if (fails >= 2) {
            buildTextUi();
            return;
        }
        try {
            WebView view = new WebView(this);
            WebSettings settings = view.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setAllowFileAccess(false);
            settings.setAllowContentAccess(false);
            settings.setLoadWithOverviewMode(true);
            settings.setUseWideViewPort(true);
            view.setBackgroundColor(Color.parseColor("#f1f8f5"));
            view.setWebViewClient(new BootClient(this));
            view.setWebChromeClient(new WebChromeClient());
            view.addJavascriptInterface(new NativeBridge(this), "WeiMoNative");
            if (safeMode) {
                // 上次启动没完成，先退到软件渲染，排除 GPU/hwui 侧的问题。
                view.setLayerType(android.view.View.LAYER_TYPE_SOFTWARE, null);
                BootLog.append("run: webview software mode");
            }
            setContentView(view, new ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            web = view;
            playback = new PlaybackCenter(this, this::runRemoteCommand);
            BootLog.append("run: webview ready");
        } catch (Throwable error) {
            BootLog.append("java: webview failed: " + Log.getStackTraceString(error));
            buildTextUi();
        }
    }

    /** 兜底界面：完全不依赖 WebView，至少能看到日志并重试。 */
    private void buildTextUi() {
        TextView text = new TextView(this);
        text.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f);
        text.setTextColor(0xFF111111);
        text.setTextIsSelectable(true);
        text.setPadding(48, 48, 48, 24);
        text.setText("系统 WebView 连续启动失败，已切换到诊断界面。\n\n" + BootLog.read());

        android.widget.Button retryButton = new android.widget.Button(this);
        retryButton.setText("重试正常模式");
        retryButton.setOnClickListener(new RetryClick(this));

        android.widget.LinearLayout box = new android.widget.LinearLayout(this);
        box.setOrientation(android.widget.LinearLayout.VERTICAL);
        box.addView(text, new android.widget.LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        box.addView(retryButton);
        ScrollView scroll = new ScrollView(this);
        scroll.addView(box, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(scroll);
        fallback = text;
    }

    private static final class RetryClick implements android.view.View.OnClickListener {
        private final MainActivity host;

        RetryClick(MainActivity host) {
            this.host = host;
        }

        @Override
        public void onClick(android.view.View view) {
            BootLog.setFailures(0);
            host.recreate();
        }
    }

    /** 启动内置服务；由启动页、日志页的按钮或首次进入触发。 */
    private void boot() {
        boot(null);
    }

    private void boot(String note) {
        if (booted) return;
        booted = true;
        BootLog.reset();
        BootLog.append("run: version=" + appVersion() + " sdk=" + Build.VERSION.SDK_INT
                + " abis=" + joinAbis() + " pageSize=" + pageSize());
        if (note != null) BootLog.append("run: " + note);
        showSplash();

        String base = new File(getFilesDir(), "app").getAbsolutePath();
        try {
            copyBackend(base, appVersion());
            BootLog.append("run: backend extracted to " + base);
        } catch (Throwable error) {
            BootLog.append("java: extract failed: " + Log.getStackTraceString(error));
        }

        variant = 0;
        reloads = 0;
        pageReady = false;
        // 保留上次的端口记录：如果之前的 :node 进程还活着，直接复用它的服务，
        // 删除记录会让探测永远找不到实际端口，表现为启动超时/空白页。
        startNodeService();
        probe(0);
    }

    /**
     * 服务端可能因为系统限制换用别的端口（部分 ROM 拒绝绑定固定端口），
     * 实际端口写在 userdata/port，这里读不到就退回默认端口。
     */
    private int currentPort() {
        File file = new File(getFilesDir(), "userdata/port");
        if (!file.exists()) return PORT;
        try {
            FileInputStream in = new FileInputStream(file);
            byte[] buffer = new byte[16];
            int read;
            try {
                read = in.read(buffer);
            } finally {
                in.close();
            }
            String text = read > 0 ? new String(buffer, 0, read, "UTF-8").trim() : "";
            return text.isEmpty() ? PORT : Integer.parseInt(text);
        } catch (Exception ignored) {
            return PORT;
        }
    }

    private void startNodeService() {
        try {
            Intent intent = new Intent(this, NodeService.class);
            intent.putExtra(NodeService.EXTRA_VARIANT, variant);
            startService(intent);
            bindService(intent, nodeConnection, Context.BIND_AUTO_CREATE);
            BootLog.append("run: node service requested variant=" + variant);
        } catch (Throwable error) {
            BootLog.append("java: service start failed: " + Log.getStackTraceString(error));
        }
    }

    private void probe(int attempt) {
        int round = ++probeRound;
        ui.post(new ServerProbe(this, round, attempt));
    }

    /** 服务就绪后加载首页；每次重试带一个查询参数，绕开 WebView 的旧页面缓存。 */
    private void loadApp(int port) {
        activePort = port;
        if (!pageReady) loadPage();
    }

    private void loadPage() {
        if (web == null) return;
        String query = reloads == 0 ? "" : "?r=" + reloads;
        web.loadUrl("http://127.0.0.1:" + activePort + "/" + query);
    }

    /** 页面加载完成：确认 main 里确实有内容，白屏就主动重载，而不是停在那里。 */
    void onPageRendered(String url) {
        if (web == null || url == null || !url.contains("127.0.0.1")) return;
        WebView view = web;
        view.evaluateJavascript(
                "(function(){var m=document.querySelector('main.main-content');"
                        + "return !!(m&&m.textContent.trim().length>2)})()",
                new PageCheck(this));
    }

    private static final class PageCheck implements ValueCallback<String> {
        private final MainActivity host;

        PageCheck(MainActivity host) {
            this.host = host;
        }

        @Override
        public void onReceiveValue(String value) {
            host.onPageChecked("true".equals(value));
        }
    }

    private void onPageChecked(boolean ok) {
        if (ok) {
            if (!pageReady) {
                pageReady = true;
                BootLog.append("run: page ready");
                BootLog.finish();
                BootLog.setFailures(0);
            }
            return;
        }
        if (pageReady) return;
        if (reloads >= 3) {
            BootLog.append("run: page stays blank");
            showLogPage("页面加载失败", BootLog.read());
            return;
        }
        reloads++;
        BootLog.append("run: blank page, reload " + reloads);
        loadPage();
    }

    /** 主文档加载失败：服务可能还在启动或换了端口，重新探测并重试。 */
    void onPageError() {
        if (web == null) return;
        pageReady = false;
        ready = false;
        BootLog.append("run: page load error");
        if (reloads >= 3) {
            showLogPage("本地页面打开失败", BootLog.read());
            return;
        }
        reloads++;
        probe(0);
    }

    /** 拦截日志页上的按钮：重新启动 / 复制日志 / 分享日志。 */
    private static final class BootClient extends WebViewClient {
        private final MainActivity host;

        BootClient(MainActivity host) {
            this.host = host;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            if (url == null) return false;
            if (url.startsWith("qiuqiu://boot")) {
                host.boot();
                return true;
            }
            if (url.startsWith("qiuqiu://copy")) {
                host.copyLog();
                return true;
            }
            if (url.startsWith("qiuqiu://share")) {
                host.shareLog();
                return true;
            }
            return false;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            host.onPageRendered(url);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request != null && request.isForMainFrame()) host.onPageError();
        }

        @Override
        @SuppressWarnings("deprecation")
        public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
            // API 23 以下只会回调这个版本，只处理首页主文档失败，避免封面等子资源误报
            if (failingUrl == null) return;
            if (failingUrl.split("\\?")[0].matches("http://127\\.0\\.0\\.1:\\d+/")) host.onPageError();
        }
    }

    private String joinAbis() {
        StringBuilder text = new StringBuilder();
        for (String abi : Build.SUPPORTED_ABIS) {
            if (text.length() > 0) text.append(',');
            text.append(abi);
        }
        return text.toString();
    }

    private String pageSize() {
        try {
            return String.valueOf(Os.sysconf(OsConstants._SC_PAGESIZE));
        } catch (Throwable error) {
            return "unknown";
        }
    }

    /** 给网页调用：全屏播放器打开时系统栏切成深色白字，关闭时回到浅色深字。 */
    void setPlayerModeFromScript(boolean playing) {
        ui.post(new PlayerModeTask(this, playing));
    }

    /** 给网页调用：同步当前曲目，锁屏与通知栏据此显示封面、进度和控制按钮。 */
    void setNowPlayingFromScript(String json) {
        final String payload = json == null ? "" : json;
        ui.post(() -> {
            if (playback == null) return;
            playback.update(payload);
        });
    }

    /** 通知栏/锁屏上的按钮点下后，回到网页里执行同一套播放命令。 */
    private void runRemoteCommand(String command) {
        if (web == null || command == null) return;
        String safe = command.replace("\\", "").replace("'", "");
        web.evaluateJavascript("window.qiuqiuRemote&&window.qiuqiuRemote('" + safe + "')", null);
    }

    private static final class PlayerModeTask implements Runnable {
        private final MainActivity host;
        private final boolean playing;

        PlayerModeTask(MainActivity host, boolean playing) {
            this.host = host;
            this.playing = playing;
        }

        @Override
        public void run() {
            host.applyBarTheme(playing);
        }
    }

    private void applyBarTheme(boolean player) {
        if (Build.VERSION.SDK_INT < 21) return;
        android.view.Window window = getWindow();
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        // 播放页让网页铺到状态栏、导航栏后面，头尾不再出现两条系统栏色块；
        // 回到首页时系统栏重新不透明，网页内容不会被状态栏压住。
        window.setStatusBarColor(player ? Color.TRANSPARENT : Color.parseColor("#f1f8f5"));
        window.setNavigationBarColor(player ? Color.TRANSPARENT : Color.parseColor("#f1f8f5"));
        if (Build.VERSION.SDK_INT >= 29) {
            window.setStatusBarContrastEnforced(!player);
            window.setNavigationBarContrastEnforced(!player);
        }
        int flags = window.getDecorView().getSystemUiVisibility() | View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
        if (player) {
            flags |= View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (Build.VERSION.SDK_INT >= 26) flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        } else {
            flags &= ~(View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
            flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (Build.VERSION.SDK_INT >= 26) flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        window.getDecorView().setSystemUiVisibility(flags);
        window.getDecorView().requestApplyInsets();
        pushSafeInsets();
    }

    /** 系统栏实际占位（CSS px，即 dp），网页据此给播放页留出安全区。 */
    String safeInsets() {
        if (Build.VERSION.SDK_INT < 21) return "0,0";
        try {
            android.view.WindowInsets insets = getWindow().getDecorView().getRootWindowInsets();
            if (insets == null) return "0,0";
            int top;
            int bottom;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars());
                top = bars.top;
                bottom = bars.bottom;
            } else {
                top = insets.getSystemWindowInsetTop();
                bottom = insets.getSystemWindowInsetBottom();
            }
            float density = getResources().getDisplayMetrics().density;
            return Math.round(top / density) + "," + Math.round(bottom / density);
        } catch (Throwable error) {
            return "0,0";
        }
    }

    /** 系统栏切换后布局还没重算，等一帧再让网页重新读取安全区。 */
    private void pushSafeInsets() {
        final WebView view = web;
        if (view == null) return;
        ui.postDelayed(() -> {
            if (view == web) view.evaluateJavascript("window.qiuqiuSafeInsets&&window.qiuqiuSafeInsets()", null);
        }, 80);
    }

    private void showSplash() {
        if (web == null) {
            if (fallback != null) fallback.setText("");
            return;
        }
        // 启动阶段只铺一层与首页一致的底色，不再显示“正在启动服务”之类提示
        web.loadDataWithBaseURL(null,
                "<html><body style='margin:0;height:100vh;background:#f1f8f5'></body></html>",
                "text/html", "utf-8", null);
    }

    private void showLogPage(String title, String log) {
        shownLog = log;
        if (web == null) {
            if (fallback != null) fallback.setText(title + "\n\n" + log);
            return;
        }
        String safe = log.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
        web.loadDataWithBaseURL(null,
                "<html><head><meta name='viewport' content='width=device-width'></head>"
                        + "<body style='margin:0;padding:16px;background:#111;color:#eee;"
                        + "font-family:monospace;font-size:12px'>"
                        + "<h3 style='font-family:sans-serif;color:#ffb27a'>" + title + "</h3>"
                        + "<p style='font-family:sans-serif;color:#9aa'>把这段内容分享或复制发给我即可定位问题。</p>"
                        + "<pre style='white-space:pre-wrap;word-break:break-all'>" + safe + "</pre>"
                        + "<p><a href='qiuqiu://share' style='display:inline-block;padding:10px 16px;"
                        + "background:#ffb27a;color:#111;border-radius:8px;text-decoration:none;"
                        + "font-family:sans-serif;font-size:14px;margin-right:10px'>分享日志</a>"
                        + "<a href='qiuqiu://copy' style='display:inline-block;padding:10px 16px;"
                        + "background:#2b4d45;color:#fff;border-radius:8px;text-decoration:none;"
                        + "font-family:sans-serif;font-size:14px;margin-right:10px'>复制日志</a>"
                        + "<a href='qiuqiu://boot' style='display:inline-block;padding:10px 16px;"
                        + "background:#173c36;color:#fff;border-radius:8px;text-decoration:none;"
                        + "font-family:sans-serif;font-size:14px'>重新启动</a></p>"
                        + "</body></html>",
                "text/html", "utf-8", null);
    }

    private void copyLog() {
        try {
            ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            clipboard.setPrimaryClip(ClipData.newPlainText("weimo-log", shownLog));
            Toast.makeText(this, "日志已复制，可直接粘贴发送", Toast.LENGTH_SHORT).show();
        } catch (Throwable error) {
            Log.w(TAG, "复制日志失败", error);
        }
    }

    private void shareLog() {
        try {
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("text/plain");
            send.putExtra(Intent.EXTRA_SUBJECT, "未末音乐启动日志");
            send.putExtra(Intent.EXTRA_TEXT, shownLog);
            startActivity(Intent.createChooser(send, "分享日志"));
        } catch (Throwable error) {
            Log.w(TAG, "分享日志失败", error);
        }
    }

    /** 轮询本地服务是否已就绪。 */
    private static final class ServerProbe implements Runnable {
        private final MainActivity host;
        private final int round;
        private final int attempt;

        ServerProbe(MainActivity host, int round, int attempt) {
            this.host = host;
            this.round = round;
            this.attempt = attempt;
        }

        @Override
        public void run() {
            Thread worker = new Thread(new ProbeRequest(host, round, attempt));
            worker.start();
        }
    }

    private static final class ProbeRequest implements Runnable {
        private final MainActivity host;
        private final int round;
        private final int attempt;

        ProbeRequest(MainActivity host, int round, int attempt) {
            this.host = host;
            this.round = round;
            this.attempt = attempt;
        }

        @Override
        public void run() {
            boolean ready = false;
            int port = host.currentPort();
            try {
                HttpURLConnection connection = (HttpURLConnection)
                        new URL("http://127.0.0.1:" + port + "/healthz").openConnection();
                connection.setConnectTimeout(500);
                connection.setReadTimeout(500);
                ready = connection.getResponseCode() == 200;
                connection.disconnect();
            } catch (Exception ignored) {
            }
            host.ui.post(new ServerReady(host, round, attempt, ready, port));
        }
    }

    private static final class ServerReady implements Runnable {
        private final MainActivity host;
        private final int round;
        private final int attempt;
        private final boolean ready;
        private final int port;

        ServerReady(MainActivity host, int round, int attempt, boolean ready, int port) {
            this.host = host;
            this.round = round;
            this.attempt = attempt;
            this.ready = ready;
            this.port = port;
        }

        @Override
        public void run() {
            if (round != host.probeRound) return;
            if (ready) {
                host.ready = true;
                BootLog.append("run: server ready port=" + port);
                BootLog.finish();
                BootLog.setFailures(0);
                if (host.web != null) host.loadApp(port);
                return;
            }
            if (attempt >= MAX_ATTEMPTS) {
                BootLog.append("run: server timeout");
                host.showLogPage("本地服务启动超时", BootLog.read());
                return;
            }
            host.ui.postDelayed(new ServerProbe(host, round, attempt + 1), 200);
        }
    }

    private String appVersion() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception ignored) {
            return "0";
        }
    }

    /** 网页更新入口取当前安装包版本与系统版本。 */
    String appVersionForScript() {
        return appVersion();
    }

    String platformForScript() {
        return "Android " + Build.VERSION.RELEASE;
    }

    boolean startUpdateDownload(String url, String fileName, String version) {
        return UpdateManager.start(this, url, fileName, version);
    }

    String installUpdate() {
        return UpdateManager.install(this);
    }

    /** 首次启动或 App 升级后把打包内置的后端解到私有目录。 */
    private void copyBackend(String target, String version) throws IOException {
        File marker = new File(target, ".ready");
        if (marker.exists() && version.equals(readMarker(marker))) return;
        File root = new File(target);
        deleteTree(root);
        copyAssetTree(BACKEND_ASSET, root);
        BootLog.append("run: backend copied");
        OutputStream out = new FileOutputStream(marker);
        try {
            out.write(version.getBytes("UTF-8"));
        } finally {
            out.close();
        }
    }

    private static String readMarker(File marker) {
        InputStream in = null;
        try {
            in = new FileInputStream(marker);
            byte[] buffer = new byte[64];
            int read = in.read(buffer);
            return read > 0 ? new String(buffer, 0, read, "UTF-8") : "";
        } catch (IOException ignored) {
            return "";
        } finally {
            if (in != null) try { in.close(); } catch (IOException ignored) { }
        }
    }

    private void copyAssetTree(String path, File target) throws IOException {
        AssetManager assets = getAssets();
        String[] children = assets.list(path);
        if (children == null || children.length == 0) {
            File parent = target.getParentFile();
            if (parent != null && !parent.exists() && !parent.mkdirs()) throw new IOException("无法创建目录 " + parent);
            InputStream in = assets.open(path);
            try {
                OutputStream out = new FileOutputStream(target);
                try {
                    byte[] buffer = new byte[64 * 1024];
                    int read;
                    while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
                } finally {
                    out.close();
                }
            } finally {
                in.close();
            }
            return;
        }
        if (!target.exists() && !target.mkdirs()) throw new IOException("无法创建目录 " + target);
        for (String child : children) copyAssetTree(path + "/" + child, new File(target, child));
    }

    private static void deleteTree(File file) {
        File[] children = file.listFiles();
        if (children != null) for (File child : children) deleteTree(child);
        //noinspection ResultOfMethodCallIgnored
        file.delete();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else moveTaskToBack(true);
    }

    @Override
    protected void onDestroy() {
        if (playback != null) {
            playback.release();
            playback = null;
        }
        if (web != null) {
            web.loadUrl("about:blank");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
