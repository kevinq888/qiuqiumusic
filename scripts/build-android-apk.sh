#!/usr/bin/env bash
# 构建安卓安装包：内置 Node 运行时（libnode）+ 本仓库服务端，产出 arm64-v8a APK。
# 依赖：JDK 17+、Android SDK build-tools/platform、Android NDK、libnode.so（nodejs-mobile 18.x）。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/android"
SDK="${ANDROID_SDK_ROOT:-/tmp/abuild/sdk}"
NDK="${ANDROID_NDK_HOME:-$SDK/ndk/26.1.10909125}"
JAVA_HOME="${JAVA_HOME:-/tmp/abuild/jdk-21}"
LIBROOT="${LIBROOT:-/tmp/njm/package/android/libnode}"
BUILD="$SRC/build"
OUT="${OUT:-$ROOT/dist/android}"
ABI="${ABI:-arm64-v8a}"
API_LEVEL=24
VERSION_CODE="${VERSION_CODE:-5}"
VERSION_NAME="${VERSION_NAME:-1.2.13}"
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
for file in seed.json covers.json live-covers.json live-lyrics.json play-stats.json; do
  [ -f "$ROOT/data/$file" ] && cp "$ROOT/data/$file" "$ASSETS/data/"
done

echo "==> 2/7 编译 JNI 桥接（${ABI}）"
case "$ABI" in
  arm64-v8a) TRIPLE="aarch64-linux-android" ;;
  x86_64) TRIPLE="x86_64-linux-android" ;;
  *) echo "不支持的 ABI: $ABI" >&2; exit 1 ;;
esac
CXX="$NDK/toolchains/llvm/prebuilt/darwin-x86_64/bin/${TRIPLE}${API_LEVEL}-clang++"
[ -x "$CXX" ] || { CXX="$NDK/toolchains/llvm/prebuilt/darwin-aarch64/bin/${TRIPLE}${API_LEVEL}-clang++"; }
"$CXX" -shared -fPIC -O2 -std=c++17 \
  -I "$LIBROOT/include/node" -I "$SRC/cpp" \
  "$SRC/cpp/native-lib.cpp" \
  -L "$LIBROOT/bin/$ABI" -lnode -llog \
  -Wl,--allow-shlib-undefined \
  -o "$BUILD/lib/$ABI/libqiunode.so"
cp "$LIBROOT/bin/$ABI/libnode.so" "$BUILD/lib/$ABI/libnode.so"
# libnode.so 依赖 NDK 的 libc++ 运行库，必须随包分发
cp "$NDK/toolchains/llvm/prebuilt/darwin-x86_64/sysroot/usr/lib/${TRIPLE}/libc++_shared.so" \
  "$BUILD/lib/$ABI/libc++_shared.so"

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
test -f "$BUILD/classes/com/qiuqiu/music/MainActivity.class"

echo "==> 5/7 生成 dex 并组装"
"$BT/d8" --lib "$AJAR" --min-api "$API_LEVEL" --output "$BUILD/dex" \
  $(find "$BUILD/classes" -name '*.class')
cp "$BUILD/base.apk" "$BUILD/app.apk"
(cd "$BUILD" && zip -q -j app.apk dex/classes.dex && zip -q -r app.apk "lib/$ABI")

echo "==> 6/7 对齐并签名"
"$BT/zipalign" -f -p 4 "$BUILD/app.apk" "$BUILD/aligned.apk"
KEYSTORE="$SRC/keystore/qiuqiu.jks"
if [ ! -f "$KEYSTORE" ]; then
  mkdir -p "$(dirname "$KEYSTORE")"
  keytool -genkeypair -keystore "$KEYSTORE" -storepass qiuqiu2026 -keypass qiuqiu2026 \
    -alias qiuqiu -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=QiuQiu Music, OU=Mobile, O=QiuQiu Music, L=Shanghai, C=CN" >/dev/null
fi
APK="$OUT/qiuqiu-music-${VERSION_NAME}-${ABI}.apk"
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-pass pass:qiuqiu2026 --key-pass pass:qiuqiu2026 \
  --ks-key-alias qiuqiu --out "$APK" "$BUILD/aligned.apk"

echo "==> 7/7 校验"
"$BT/apksigner" verify --print-certs "$APK" | head -4
ls -lh "$APK"
