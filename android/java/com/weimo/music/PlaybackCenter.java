package com.weimo.music;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.drawable.Icon;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;

import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 把网页里的播放状态同步给系统媒体会话。
 * 这样锁屏、下拉通知栏、蓝牙耳机/线控都能看到封面、进度和上一首/播放/下一首按钮。
 */
final class PlaybackCenter {
    private static final String CHANNEL = "playback";
    private static final int NOTIFICATION_ID = 41;

    interface Remote {
        void run(String command);
    }

    /** 通知按钮通过广播回到这里，进程内只有一个活动的播放中心。 */
    static PlaybackCenter active;

    private final Context context;
    private final Remote remote;
    private final NotificationManager manager;
    private final MediaSession session;
    private final ExecutorService artLoader = Executors.newSingleThreadExecutor();
    private final Handler ui = new Handler(Looper.getMainLooper());

    private String title = "";
    private String artist = "";
    private String cover = "";
    private boolean playing;
    private long duration;
    private long position;
    private Bitmap art;
    private String artUrl = "";

    PlaybackCenter(Context context, Remote remote) {
        this.context = context.getApplicationContext();
        this.remote = remote;
        this.manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        this.session = new MediaSession(context, "WeiMoMusic");
        active = this;
        createChannel();
        session.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS
                | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
        session.setSessionActivity(openApp());
        session.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                send("play");
            }

            @Override
            public void onPause() {
                send("pause");
            }

            @Override
            public void onStop() {
                send("pause");
            }

            @Override
            public void onSkipToNext() {
                send("next");
            }

            @Override
            public void onSkipToPrevious() {
                send("prev");
            }

            @Override
            public void onSeekTo(long pos) {
                send("seek:" + Math.round(pos / 1000.0));
            }
        });
        session.setActive(true);
    }

    /** 网页每次换歌/暂停/拖进度都会调用；json 为空表示清单里没有当前曲目。 */
    void update(String json) {
        if (json == null || json.isEmpty()) {
            title = "";
            artist = "";
            cover = "";
            playing = false;
            art = null;
            artUrl = "";
            cancel();
            return;
        }
        try {
            JSONObject data = new JSONObject(json);
            title = data.optString("title", "");
            artist = data.optString("artist", "");
            String nextCover = data.optString("cover", "");
            playing = data.optBoolean("playing", false);
            duration = data.optLong("duration", 0);
            long reported = data.optLong("position", 0);
            if (reported > 0 || !playing) position = reported;
            if (!nextCover.equals(cover)) {
                cover = nextCover;
                loadArt(cover);
            }
            push();
        } catch (Exception ignored) {
        }
    }

    void handleCommand(String command) {
        if (command != null) send(command);
    }

    void release() {
        session.setActive(false);
        session.release();
        artLoader.shutdownNow();
        cancel();
        if (active == this) active = null;
    }

    private void send(String command) {
        ui.post(() -> remote.run(command));
    }

    private void push() {
        if (title.isEmpty()) {
            cancel();
            return;
        }
        long now = SystemClock.elapsedRealtime();
        session.setMetadata(new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, title)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
                .putLong(MediaMetadata.METADATA_KEY_DURATION, duration * 1000L)
                .putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, art)
                .build());
        session.setPlaybackState(new PlaybackState.Builder()
                .setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE
                        | PlaybackState.ACTION_PLAY_PAUSE | PlaybackState.ACTION_SKIP_TO_NEXT
                        | PlaybackState.ACTION_SKIP_TO_PREVIOUS | PlaybackState.ACTION_SEEK_TO
                        | PlaybackState.ACTION_STOP)
                .setState(playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED,
                        position * 1000L, playing ? 1f : 0f, now)
                .build());

        Notification.Action prev = action(R.drawable.ic_prev, "上一首", "prev");
        Notification.Action toggle = action(playing ? R.drawable.ic_pause : R.drawable.ic_play,
                playing ? "暂停" : "播放", playing ? "pause" : "play");
        Notification.Action next = action(R.drawable.ic_next, "下一首", "next");
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(context, CHANNEL)
                : new Notification.Builder(context);
        builder.setSmallIcon(R.drawable.ic_stat_music)
                .setContentTitle(title)
                .setContentText(artist)
                .setContentIntent(openApp())
                .setCategory(Notification.CATEGORY_TRANSPORT)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setShowWhen(false)
                .setOnlyAlertOnce(true)
                .setOngoing(playing)
                .setDeleteIntent(null)
                .addAction(prev)
                .addAction(toggle)
                .addAction(next)
                .setStyle(new Notification.MediaStyle()
                        .setMediaSession(session.getSessionToken())
                        .setShowActionsInCompactView(0, 1, 2));
        if (duration > 0) {
            builder.setProgress(1000, (int) Math.min(1000, position * 1000L / Math.max(1, duration)), false);
        }
        if (art != null) builder.setLargeIcon(art);
        try {
            manager.notify(NOTIFICATION_ID, builder.build());
        } catch (Throwable error) {
            BootLog.append("java: notify failed: " + error);
        }
    }

    private Notification.Action action(int icon, String label, String command) {
        Intent intent = new Intent(context, PlaybackReceiver.class)
                .setAction(PlaybackReceiver.ACTION)
                .putExtra("cmd", command);
        PendingIntent pending = PendingIntent.getBroadcast(context, command.hashCode(), intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Action.Builder(Icon.createWithResource(context, icon), label, pending).build();
    }

    private PendingIntent openApp() {
        Intent intent = new Intent(context, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void cancel() {
        try {
            manager.cancel(NOTIFICATION_ID);
        } catch (Throwable ignored) {
        }
    }

    private void loadArt(String url) {
        if (url == null || url.isEmpty() || url.equals(artUrl)) return;
        artUrl = url;
        art = null;
        try {
            artLoader.execute(() -> {
                Bitmap bitmap = null;
                try {
                    HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
                    connection.setConnectTimeout(4000);
                    connection.setReadTimeout(6000);
                    try (InputStream input = connection.getInputStream()) {
                        bitmap = BitmapFactory.decodeStream(input);
                    }
                } catch (Throwable ignored) {
                }
                Bitmap loaded = bitmap;
                if (loaded == null) return;
                ui.post(() -> {
                    if (!url.equals(artUrl)) return;
                    art = loaded;
                    push();
                });
            });
        } catch (Throwable ignored) {
            // 线程池已关闭时忽略
        }
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL, "正在播放",
                NotificationManager.IMPORTANCE_LOW);
        channel.setShowBadge(false);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);
    }
}
