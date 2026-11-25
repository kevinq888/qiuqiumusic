package com.weimo.music;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.SharedPreferences;
import android.content.res.AssetManager;
import android.graphics.Bitmap;
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
import android.view.PixelCopy;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageView;
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
    private static final String PREFS = "weimo";
    private static final String PREF_COLOR = "pageColor";

    private final Handler ui = new Handler(Looper.getMainLooper());
    private WebView web;
    private FrameLayout root;
    private ImageView mask;
    private Bitmap lastFrame;
    private boolean capturing;
    private long maskSeq;
    private String pageColor = "#fdf7f6";
    private boolean playerMode;
    private TextView fallback;
    private PlaybackCenter playback;
    private boolean booted;
    private boolean ready;
    private boolean pageReady;
    private int blankChecks;
    private boolean healthChecking;
    private boolean resumedOnce;
    private int activePort = PORT;
    private int reloads;
    private int variant;
    private int probeRound;
    private String shownLog = "";
    private static MainActivity current;

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
        hideMaskNow();
        web.loadDataWithBaseURL(null,
                "<html><body style='margin:0;height:100vh;display:flex;align-items:center;"
                        + "justify-content:center;background:#fdf7f6;color:#3a2026;"
                        + "font-family:sans-serif;font-size:15px;text-align:center;padding:24px'>"
                        + text + "</body></html>",
                "text/html", "utf-8", null);
    }

    /** 从后台回到前台：先用上一帧/底色盖住 WebView，确认页面真的有内容再揭开。 */
    @Override
    protected void onResume() {
        super.onResume();
        String resumeUrl = web == null ? null : web.getUrl();
        boolean onRealPage = resumeUrl != null && resumeUrl.startsWith("http://127.0.0.1:");
        if (web != null && mask != null && (pageReady || onRealPage)) {
            showMask();
            web.invalidate();
            verifyPage();
        }
        if (!resumedOnce) {
            resumedOnce = true;
            return;
        }
        if (web == null) return;
        ui.postDelayed(() -> {
            if (web == null || isFinishing()) return;
            String url = web.getUrl();
            if (url != null && url.startsWith("http://127.0.0.1:")) return;
            // 暂停后重开仍停在启动页：重新走一遍服务探测，绝不把空白页留给用户
            BootLog.append("run: resume on blank page, restart boot");
            pageReady = false;
            ready = false;
            if (!booted) boot();
            else probe(0);
        }, 350);
    }

    /** 按下 Home/切换应用时最早的回调，比 onPause 更早拿到完整画面。 */
    @Override
    protected void onUserLeaveHint() {
        captureFrame();
        super.onUserLeaveHint();
    }

    /** 窗口失焦（切到别的 App、下拉通知栏）时先抓一帧，比 onPause 更早、画面一定还在。 */
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (!hasFocus) captureFrame();
    }

    @Override
    protected void onPause() {
        captureFrame();
        super.onPause();
    }

    /** 抓取当前窗口画面作为上一帧；遮罩可见时不抓，避免把遮罩自己截进去。 */
    private void captureFrame() {
        WebView view = web;
        if (view == null || !pageReady || isFinishing() || isDestroyed() || capturing) return;
        if (mask != null && mask.getVisibility() == View.VISIBLE) return;
        View decor = getWindow().getDecorView();
        int width = decor.getWidth();
        int height = decor.getHeight();
        if (width <= 0 || height <= 0) return;
        try {
            final Bitmap shot = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            capturing = true;
            PixelCopy.request(getWindow(), shot, result -> {
                capturing = false;
                if (result == PixelCopy.SUCCESS) {
                    if (lastFrame != null && lastFrame != shot) lastFrame.recycle();
                    lastFrame = shot;
                } else {
                    shot.recycle();
                }
            }, ui);
        } catch (Throwable error) {
            capturing = false;
            BootLog.append("java: capture frame failed: " + error);
        }
    }

    private void showMask() {
        if (mask == null) return;
        if (lastFrame != null) mask.setImageBitmap(lastFrame);
        else mask.setImageDrawable(null);
        mask.setAlpha(1f);
        mask.setVisibility(View.VISIBLE);
    }

    /**
     * 回到前台后的页面健康检查：页面被系统冻结、渲染进程挂掉或内容为空时，
     * 保持遮罩并重载，只有确认 main 有真实内容才揭开，彻底避免白屏。
     */
    private void verifyPage() {
        final WebView view = web;
        if (view == null) return;
        if (!pageReady) {
            scheduleReveal();
            return;
        }
        final long seq = ++maskSeq;
        healthChecking = true;
        view.evaluateJavascript(
                "(function(){try{var m=document.querySelector('main.main-content');"
                        + "var ok=document.readyState!=='loading'&&m&&m.textContent.trim().length>2;"
                        + "return ok&&document.documentElement.dataset.playerReady==='true'}catch(e){return false}})()",
                value -> ui.post(() -> {
                    if (seq != maskSeq || view != web) return;
                    healthChecking = false;
                    if ("true".equals(value) && pageReady) {
                        scheduleReveal();
                        return;
                    }
                    BootLog.append("run: resume check failed, reload");
                    pageReady = false;
                    reloads = 0;
                    loadPage();
                }));
        // 渲染进程没响应时 evaluate 不会回调，超时后直接重载，绝不把遮罩永久卡住
        ui.postDelayed(() -> {
            if (seq != maskSeq || view != web || !healthChecking) return;
            healthChecking = false;
            BootLog.append("run: resume check timeout, reload");
            pageReady = false;
            reloads = 0;
            loadPage();
        }, 1600);
    }

    /** 等 WebView 提交了新画面再揭开；页面还没就绪时保持遮罩，由 onPageChecked 接手。 */
    private void scheduleReveal() {
        final long seq = ++maskSeq;
        ui.postDelayed(() -> {
            if (seq != maskSeq || web == null) return;
            try {
                web.postVisualStateCallback(seq, new WebView.VisualStateCallback() {
                    @Override
                    public void onComplete(long requestId) {
                        ui.post(() -> {
                            if (seq == maskSeq) revealPage();
                        });
                    }
                });
            } catch (Throwable ignored) {
            }
        }, 260);
        // 兜底只揭“已确认就绪”的页面；页面未就绪时继续盖住，等 onPageChecked 再揭
        ui.postDelayed(() -> {
            if (seq == maskSeq && pageReady) revealPage();
        }, 1400);
    }

    /** 只有页面确认有内容时才揭开遮罩，避免露出白底或重新加载中的空页。 */
    private void revealPage() {
        if (!pageReady) return;
        final ImageView cover = mask;
        if (cover == null || cover.getVisibility() != View.VISIBLE) return;
        cover.animate().alpha(0f).setDuration(140).withEndAction(() -> {
            if (cover == mask) {
                cover.setVisibility(View.GONE);
                cover.setImageDrawable(null);
                cover.setAlpha(1f);
            }
        }).start();
    }

    /** 立刻收起遮罩（启动页/日志页这类主动展示的界面）。 */
    private void hideMaskNow() {
        maskSeq++;
        if (mask == null) return;
        mask.animate().cancel();
        mask.setAlpha(1f);
        mask.setVisibility(View.GONE);
    }

    /** 丢弃上一帧：先从 ImageView 摘掉引用再回收，避免绘制到已回收的 Bitmap。 */
    private void discardFrame() {
        hideMaskNow();
        if (mask != null) mask.setImageDrawable(null);
        if (lastFrame != null) {
            lastFrame.recycle();
            lastFrame = null;
        }
    }

    /** 渲染进程无响应：先保遮罩并重载，仍无响应会由 onRenderProcessGone 触发重建。 */
    private void onRenderUnresponsive() {
        ui.post(() -> {
            if (web == null || isFinishing() || isDestroyed()) return;
            BootLog.append("run: renderer unresponsive, reload");
            showMask();
            pageReady = false;
            reloads = 0;
            loadPage();
        });
    }

    /** WebView 渲染进程被系统回收：重建并立刻显示品牌启动页，避免白屏。 */
    void onRenderGone() {
        if (isFinishing() || isDestroyed()) return;
        BootLog.append("run: webview render process gone, rebuild");
        pageReady = false;
        ready = false;
        web = null;
        // 旧帧留在 ImageView 上：重建期间继续显示上一帧，等新页面真正就绪再淡出，
        // 这样即使渲染进程被系统强杀，用户也看不到中间的白底/启动页闪烁。
        if (playback != null) {
            playback.release();
            playback = null;
        }
        buildUi(false);
        showSplash();
        startNodeService();
        probe(0);
    }

    /** 通知卡片被左右滑掉时调用：确认页面暂停后结束任务，并杀干净进程。 */
    static void finishForExit() {
        MainActivity host = current;
        if (host == null) return;
        try {
            host.finishAndRemoveTask();
        } catch (Throwable ignored) {
            host.finish();
        }
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        current = this;
        BootLog.init(getFilesDir());
        BootLog.append("run: activity created");
        // 进程重建时先恢复上次的页面底色，窗口在网页加载前就不会闪浅色
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        pageColor = prefs.getString(PREF_COLOR, "#fdf7f6");
        // 窗口底色跟随上次的皮肤：进程重建到网页首帧之间不会露出系统白
        try {
            getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(Color.parseColor(pageColor)));
        } catch (Throwable ignored) {
        }

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
            // 根因修复：默认策略会在 WebView 不可见时放弃渲染进程优先级，退到后台就被系统回收，
            // 切回来只能重建 WebView → 白一下再恢复。这里让渲染进程常驻重要级。
            if (Build.VERSION.SDK_INT >= 26) {
                try {
                    view.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
                    BootLog.append("run: renderer priority important");
                } catch (Throwable error) {
                    BootLog.append("java: renderer policy failed: " + error);
                }
            }
            // 渲染进程卡死时主动重载，而不是让用户对着白屏等
            if (Build.VERSION.SDK_INT >= 29) {
                try {
                    view.setWebViewRenderProcessClient(new android.webkit.WebViewRenderProcessClient() {
                        @Override
                        public void onRenderProcessResponsive(WebView v, android.webkit.WebViewRenderProcess process) {
                        }

                        @Override
                        public void onRenderProcessUnresponsive(WebView v, android.webkit.WebViewRenderProcess process) {
                            onRenderUnresponsive();
                        }
                    });
                } catch (Throwable error) {
                    BootLog.append("java: renderer client failed: " + error);
                }
            }
            int background = Color.parseColor(pageColor);
            view.setBackgroundColor(background);
            view.setWebViewClient(new BootClient(this));
            view.setWebChromeClient(new WebChromeClient());
            view.addJavascriptInterface(new NativeBridge(this), "WeiMoNative");
            if (safeMode) {
                // 上次启动没完成，先退到软件渲染，排除 GPU/hwui 侧的问题。
                view.setLayerType(android.view.View.LAYER_TYPE_SOFTWARE, null);
                BootLog.append("run: webview software mode");
            }
            FrameLayout container = new FrameLayout(this);
            container.setBackgroundColor(background);
            container.addView(view, new ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            // 上一帧遮罩：切回前台时盖住 WebView 尚未重绘的空白底
            ImageView cover = new ImageView(this);
            cover.setScaleType(ImageView.ScaleType.FIT_XY);
            cover.setBackgroundColor(background);
            cover.setClickable(false);
            cover.setFocusable(false);
            if (lastFrame != null) {
                cover.setImageBitmap(lastFrame);
                cover.setVisibility(View.VISIBLE);
            } else {
                cover.setVisibility(View.GONE);
            }
            container.addView(cover, new ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            setContentView(container, new ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            root = container;
            mask = cover;
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
        root = null;
        mask = null;
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
            blankChecks = 0;
            healthChecking = false;
            if (!pageReady) {
                pageReady = true;
                resumedOnce = true;
                // 启动阶段的空白页/日志页会留在 WebView 历史里，左滑返回会退到白屏；
                // 页面就绪后清一次历史，返回键从首页直接退出应用，不会再出现空白页。
                if (web != null) web.clearHistory();
                BootLog.append("run: page ready");
                BootLog.finish();
                BootLog.setFailures(0);
            }
            // 页面确认有内容后，再等一帧把上一帧遮罩淡出
            ui.postDelayed(this::revealPage, 60);
            return;
        }
        if (pageReady) {
            // 页面已经可用时偶发一次空白（切后台恢复、渲染进程刚唤醒）先复查一次，
            // 确认真的空白才重载，避免把正常页面重载成白屏。
            if (blankChecks < 1) {
                blankChecks++;
                ui.postDelayed(() -> {
                    if (web != null && pageReady) onPageRendered(web.getUrl());
                }, 900);
                return;
            }
            blankChecks = 0;
            BootLog.append("run: page blank after restore, reload");
            pageReady = false;
            reloads = 0;
            loadPage();
            return;
        }
        blankChecks = 0;
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

        @Override
        public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
            // 渲染进程被系统回收时不要崩溃退出：重建 WebView 并重新加载
            try {
                if (view.getParent() instanceof ViewGroup) {
                    ((ViewGroup) view.getParent()).removeView(view);
                }
                view.destroy();
            } catch (Throwable ignored) {
            }
            host.onRenderGone();
            return true;
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

    /** 给网页调用：跟随当前皮肤同步窗口底色，避免暗色皮肤切回前台时露浅色。 */
    void setPageColorFromScript(String color) {
        if (color == null || !color.matches("#[0-9a-fA-F]{6}")) return;
        final String value = color.toLowerCase(java.util.Locale.ROOT);
        ui.post(() -> {
            if (value.equals(pageColor)) return;
            pageColor = value;
            try {
                getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(PREF_COLOR, value).apply();
            } catch (Throwable ignored) {
            }
            if (root != null) root.setBackgroundColor(Color.parseColor(pageColor));
            if (mask != null) mask.setBackgroundColor(Color.parseColor(pageColor));
            if (!playerMode) applyBarTheme(false);
            BootLog.append("run: page color " + value);
        });
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
        playerMode = player;
        android.view.Window window = getWindow();
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        // 首页与播放页都铺到系统栏后面：顶栏/底部 TabBar 自己延伸到状态栏与导航栏区域，
        // 不再出现两条系统栏色块。网页用 --safe-top / --safe-bottom 给内容留出安全区。
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        // Android 8.0 以下无法把导航栏图标改成深色，透明栏会让白色按键看不见，退回深绿底
        if (Build.VERSION.SDK_INT < 26) window.setNavigationBarColor(Color.parseColor("#0b3a31"));
        // 窗口和 WebView 的底色跟着播放页一起换：切到后台再回来时先绘制的是这层底色，
        // 保持深色就不会闪白，也能盖住屏幕圆角/系统栏边缘漏出的浅色。
        int background = player ? Color.parseColor("#0d0c11") : Color.parseColor(pageColor);
        window.getDecorView().setBackgroundColor(background);
        if (root != null) root.setBackgroundColor(background);
        if (mask != null) mask.setBackgroundColor(background);
        if (web != null) web.setBackgroundColor(background);
        if (Build.VERSION.SDK_INT >= 29) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
        int flags = window.getDecorView().getSystemUiVisibility()
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
        if (player) {
            // 播放页是深色底，状态栏图标用浅色
            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (Build.VERSION.SDK_INT >= 26) flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        } else {
            // 首页是浅色底，状态栏与导航栏图标用深色
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
        // 启动阶段显示品牌页而不是纯色空白页：任何时候用户看到的都是“未末音乐”
        web.loadDataWithBaseURL(null,
                "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head>"
                        + "<body style='margin:0;height:100vh;display:flex;align-items:center;justify-content:center;"
                        + "background:radial-gradient(120% 90% at 18% 8%,#fdeef0 0%,#fdf7f6 58%,#fbe7ea 100%);"
                        + "font-family:-apple-system,'PingFang SC','Noto Sans SC',sans-serif'>"
                        + "<div style='display:flex;flex-direction:column;align-items:center;gap:14px'>"
                        + "<div style='width:74px;height:74px;border-radius:22px;display:flex;align-items:center;"
                        + "justify-content:center;background:linear-gradient(150deg,#ffb2a4,#ff7c74 38%,#e0162e);"
                        + "box-shadow:0 16px 34px rgba(224,22,46,.26)'>"
                        + "<svg width='42' height='42' viewBox='0 0 96 96' fill='none'>"
                        + "<path d='M69 33c1-10-9-16-17.5-8-1 11 .8 22 1.5 32.5.5 6-2 11-7 14.5-9 6-18.5-1-17.5-9.5 1-8 10-11.5 17-8.5 4 1.8 7 5 7.5 9'"
                        + " stroke='#fff' stroke-width='9' stroke-linecap='round' stroke-linejoin='round'/></svg>"
                        + "</div><div style='font-size:17px;font-weight:700;letter-spacing:.14em;color:#3a2026'>未末音乐</div>"
                        + "<div style='font-size:12px;letter-spacing:.06em;color:#a98a90'>好音乐，马上就来</div></div>"
                        + "</body></html>",
                "text/html", "utf-8", null);
    }

    private void showLogPage(String title, String log) {
        shownLog = log;
        if (web == null) {
            if (fallback != null) fallback.setText(title + "\n\n" + log);
            return;
        }
        String safe = log.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
        hideMaskNow();
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
        if (web != null) {
            String url = web.getUrl();
            // 空白页/日志页不是应用页面：直接重新打开首页，避免退到白屏后无法恢复。
            if (url == null || !url.startsWith("http://127.0.0.1:")) {
                pageReady = false;
                loadPage();
                return;
            }
            if (web.canGoBack()) {
                web.goBack();
                return;
            }
        }
        moveTaskToBack(true);
    }

    @Override
    public void onConfigurationChanged(android.content.res.Configuration config) {
        super.onConfigurationChanged(config);
        // 尺寸变了，旧帧不能再用（FIT_XY 会拉伸），直接丢掉
        discardFrame();
    }

    @Override
    protected void onDestroy() {
        if (current == this) current = null;
        if (playback != null) {
            playback.release();
            playback = null;
        }
        discardFrame();
        if (web != null) {
            web.loadUrl("about:blank");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
