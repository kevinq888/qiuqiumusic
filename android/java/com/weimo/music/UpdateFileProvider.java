package com.weimo.music;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * 只暴露更新目录里的安装包给系统安装器读取。
 * 不走 androidx，直接继承 ContentProvider，构建时无需额外依赖。
 */
public final class UpdateFileProvider extends ContentProvider {
    static final String AUTHORITY = "com.weimo.music.updates";

    static Uri uriFor(File file) {
        return new Uri.Builder().scheme("content").authority(AUTHORITY).appendPath(file.getName()).build();
    }

    private File resolve(Uri uri) {
        if (uri == null || getContext() == null) return null;
        String name = uri.getLastPathSegment();
        if (name == null || name.isEmpty()) return null;
        File file = new File(UpdateManager.updatesDir(getContext()), name);
        return file.exists() ? file : null;
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File file = resolve(uri);
        if (file == null) throw new FileNotFoundException(String.valueOf(uri));
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        File file = resolve(uri);
        if (file == null) return null;
        String[] columns = projection != null ? projection : new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE };
        MatrixCursor cursor = new MatrixCursor(columns, 1);
        Object[] row = new Object[columns.length];
        for (int i = 0; i < columns.length; i++) {
            if (OpenableColumns.DISPLAY_NAME.equals(columns[i])) row[i] = file.getName();
            else if (OpenableColumns.SIZE.equals(columns[i])) row[i] = file.length();
            else row[i] = null;
        }
        cursor.addRow(row);
        return cursor;
    }

    @Override
    public String getType(Uri uri) {
        return "application/vnd.android.package-archive";
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }
}
