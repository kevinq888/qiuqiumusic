#!/usr/bin/env bash
# 构建安卓安装包：内置 Node 运行时（libnode）+ 本仓库服务端，产出 arm64-v8a APK。
# 依赖：JDK 17+、Android SDK build-tools/platform、Android NDK、libnode.so（nodejs-mobile 18.x）。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/android"
SDK="${ANDROID_SDK_ROOT:-/tmp/abuild/sdk}"
NDK="${ANDROID_NDK_HOME:-$SDK/ndk/26.1.10909125}"
# macOS 版 JDK 的 bin 目录在 Contents/Home 下
JAVA_HOME="${JAVA_HOME:-/tmp/abuild/jdk-21.0.13+9/Contents/Home}"
LIBROOT="${LIBROOT:-/tmp/njm/package/android/libnode}"
BUILD="$SRC/build"
# 版本号与桌面端保持一致；输出按版本/平台分层：dist/<版本>/android/
VERSION_NAME="${VERSION_NAME:-$(node -p "require('$ROOT/desktop/package.json').version")}"
# versionCode 以 AndroidManifest.xml 为准，避免升级安装时被系统当成低版本拒绝
VERSION_CODE="${VERSION_CODE:-$(node -p "((require('fs').readFileSync('$ROOT/android/AndroidManifest.xml','utf8').match(/versionCode=\"(\\d+)\"/)||[])[1]||10)")}"
OUT="${OUT:-$ROOT/dist/$VERSION_NAME/android}"
ABI="${ABI:-arm64-v8a}"
API_LEVEL=24
BT="$SDK/build-tools/34.0.0"
AJAR="$SDK/platforms/android-34/android.jar"
PATH="$JAVA_HOME/bin:$PATH"
export JAVA_HOME PATH

rm -rf "$BUILD"
mkdir -p "$BUILD/gen" "$BUILD/classes" "$BUILD/dex" "$BUILD/lib/$ABI" "$OUT"

echo "==> 1/7 收集服务端资源"
ASSETS="$SRC/assets/backend"
rm -rf "$SRC/assets"
mkdir -p "$ASSETS/data"
cp "$ROOT/server.js" "$ROOT/README.md" "$ASSETS/"
cp "$SRC/mobile-boot.js" "$ASSETS/"
cp -R "$ROOT/src" "$ASSETS/"
cp -R "$ROOT/public" "$ASSETS/"
for file in seed.json extra.json covers.json live-covers.json live-lyrics.json play-stats.json; do
  [ -f "$ROOT/data/$file" ] && cp "$ROOT/data/$file" "$ASSETS/data/"
done

echo "==> 2/7 准备原生库（${ABI}）"
case "$ABI" in
  arm64-v8a) TRIPLE="aarch64-linux-android" ;;
  x86_64) TRIPLE="x86_64-linux-android" ;;
  *) echo "不支持的 ABI: $ABI" >&2; exit 1 ;;
esac
CXX="$NDK/toolchains/llvm/prebuilt/darwin-x86_64/bin/${TRIPLE}${API_LEVEL}-clang++"
[ -x "$CXX" ] || { CXX="$NDK/toolchains/llvm/prebuilt/darwin-aarch64/bin/${TRIPLE}${API_LEVEL}-clang++"; }
NDK_SYSROOT="$NDK/toolchains/llvm/prebuilt/darwin-x86_64/sysroot"
# 工具链被清理过（缺 unistd.h 等系统头）时不再尝试编译，直接复用上一版 APK 里的原生库。
# JNI 源码没有改动时这样产出的安装包与重新编译等价。
PREV_APK="$(ls -t "$ROOT"/dist/*/android/*"${ABI}"*.apk 2>/dev/null | grep -v "/$VERSION_NAME/" | head -1 || true)"
if [ -f "$NDK_SYSROOT/usr/include/unistd.h" ] && [ -f "$LIBROOT/include/node/v8.h" ]; then
  # 部分精简版 NDK 缺少 clang 内置头文件（stdarg.h 等），回退到系统 clang 的同名目录
  RESOURCE_FLAG=()
  if [ ! -f "$(dirname "$CXX")/../lib/clang/17/include/stdarg.h" ] && [ ! -f "$(dirname "$CXX")/../lib/clang/17.0.2/include/stdarg.h" ]; then
    SYS_STDARG="$(ls -d /Library/Developer/CommandLineTools/usr/lib/clang/*/include/stdarg.h 2>/dev/null | head -1)"
    if [ -n "$SYS_STDARG" ]; then
      RESOURCE_FLAG=(-resource-dir "$(dirname "$(dirname "$SYS_STDARG")")")
    fi
  fi
  "$CXX" -shared -fPIC -O2 -std=c++17 ${RESOURCE_FLAG[@]+"${RESOURCE_FLAG[@]}"} \
    -I "$LIBROOT/include/node" -I "$SRC/cpp" \
    "$SRC/cpp/native-lib.cpp" \
    -L "$LIBROOT/bin/$ABI" -lnode -llog \
    -Wl,--allow-shlib-undefined \
    -o "$BUILD/lib/$ABI/libqiunode.so"
  cp "$LIBROOT/bin/$ABI/libnode.so" "$BUILD/lib/$ABI/libnode.so"
  # libnode.so 依赖 NDK 的 libc++ 运行库，必须随包分发
  cp "$NDK_SYSROOT/usr/lib/${TRIPLE}/libc++_shared.so" "$BUILD/lib/$ABI/libc++_shared.so"
elif [ -n "$PREV_APK" ]; then
  echo "    工具链不完整，复用 $(basename "$PREV_APK") 中的原生库"
  unzip -o -q "$PREV_APK" "lib/$ABI/*" -d "$BUILD/native"
  cp "$BUILD/native/lib/$ABI/"*.so "$BUILD/lib/$ABI/"
  rm -rf "$BUILD/native"
else
  echo "缺少完整 NDK 与可复用的历史安装包，无法准备原生库" >&2
  exit 1
fi

echo "==> 3/7 生成资源与清单"
"$BT/aapt2" compile --dir "$SRC/res" -o "$BUILD/res.zip"
"$BT/aapt2" link -o "$BUILD/base.apk" \
  -I "$AJAR" \
  --manifest "$SRC/AndroidManifest.xml" \
  -R "$BUILD/res.zip" \
  -A "$SRC/assets" \
  --java "$BUILD/gen" \
  --min-sdk-version "$API_LEVEL" \
  --target-sdk-version 34 \
  --version-code "$VERSION_CODE" \
  --version-name "$VERSION_NAME" \
  --auto-add-overlay

echo "==> 4/7 编译 Java"
find "$SRC/java" -name '*.java' > "$BUILD/sources.txt"
find "$BUILD/gen" -name '*.java' >> "$BUILD/sources.txt"
javac -nowarn -encoding UTF-8 --release 8 -classpath "$AJAR" \
  -d "$BUILD/classes" @"$BUILD/sources.txt"
test -f "$BUILD/classes/com/weimo/music/MainActivity.class"

echo "==> 5/7 生成 dex 并组装"
# build-tools 被系统清理过时 lib/d8.jar、lib/apksigner.jar 会缺失，允许用独立 jar 运行
find_jar() { for jar in "$@"; do [ -f "$jar" ] && { printf '%s\n' "$jar"; return 0; }; done; return 1; }
D8_JAR="$(find_jar "$BT/lib/d8.jar" "${QIUQIU_TOOLS:-/tmp/qiuqiu-tools}/d8.jar" || true)"
if [ -f "$BT/lib/d8.jar" ]; then
  "$BT/d8" --lib "$AJAR" --min-api "$API_LEVEL" --output "$BUILD/dex" \
    $(find "$BUILD/classes" -name '*.class')
else
  [ -n "$D8_JAR" ] || { echo "缺少 d8.jar，无法生成 dex" >&2; exit 1; }
  java -cp "$D8_JAR" com.android.tools.r8.D8 --lib "$AJAR" --min-api "$API_LEVEL" \
    --output "$BUILD/dex" $(find "$BUILD/classes" -name '*.class')
fi
cp "$BUILD/base.apk" "$BUILD/app.apk"
(cd "$BUILD" && zip -q -j app.apk dex/classes.dex && zip -q -r app.apk "lib/$ABI")

echo "==> 6/7 对齐并签名"
"$BT/zipalign" -f -p 4 "$BUILD/app.apk" "$BUILD/aligned.apk"
KEYSTORE="$SRC/keystore/qiuqiu.jks"
if [ ! -f "$KEYSTORE" ]; then
  mkdir -p "$(dirname "$KEYSTORE")"
  keytool -genkeypair -keystore "$KEYSTORE" -storepass qiuqiu2026 -keypass qiuqiu2026 \
    -alias qiuqiu -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=WeiMo Music, OU=Mobile, O=WeiMo Music, L=Shanghai, C=CN" >/dev/null
fi
APK="$OUT/未末音乐-${VERSION_NAME}-android-${ABI}.apk"
SIGNER=(java -jar "$BT/lib/apksigner.jar")
if [ ! -f "$BT/lib/apksigner.jar" ]; then
  APKSIGNER_JAR="$(find_jar "${QIUQIU_TOOLS:-/tmp/qiuqiu-tools}/apksigner.jar" || true)"
  [ -n "$APKSIGNER_JAR" ] || { echo "缺少 apksigner.jar，无法签名" >&2; exit 1; }
  SIGNER=(java -jar "$APKSIGNER_JAR")
fi
"${SIGNER[@]}" sign --ks "$KEYSTORE" --ks-pass pass:qiuqiu2026 --key-pass pass:qiuqiu2026 \
  --ks-key-alias qiuqiu --out "$APK" "$BUILD/aligned.apk"

echo "==> 7/7 校验"
"${SIGNER[@]}" verify --print-certs "$APK" | head -4
ls -lh "$APK"
# 中间产物不留在仓库里，下次构建会重新生成
rm -rf "$BUILD" "$ASSETS"
