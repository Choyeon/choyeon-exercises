#!/usr/bin/env bash
# 重拍 README 界面预览截图（Android 模拟器，1080x1920）
# 用法: ./scripts/capture_screenshots.sh [light|dark]
set -u

MODE="${1:-light}"
PKG="com.choyeon.gym"
SCHEME="choyeon-gym"
OUT="docs/screenshots"
TMP=".tmp-shots"
mkdir -p "$TMP"

if [ "$MODE" = "dark" ]; then
  NIGHT="yes"; PREFIX="dark-"
else
  NIGHT="no";  PREFIX=""
fi

MSYS_NO_PATHCONV=1 adb shell cmd uimode night "$NIGHT" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 adb shell am force-stop "$PKG" >/dev/null 2>&1
sleep 1
MSYS_NO_PATHCONV=1 adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER >/dev/null 2>&1
sleep 8

# 路由 -> 文件名
ROUTES=(
  "|01-home"
  "library|02-library"
  "workout|03-workout"
  "stats|04-stats"
  "body|05-body"
  "templates|06-templates"
  "warmup|07-warmup"
  "exercise/0007|08-exercise"
  "profile|09-profile"
)

for entry in "${ROUTES[@]}"; do
  route="${entry%%|*}"
  name="${entry##*|}"
  target="$OUT/${PREFIX}${name}.png"

  MSYS_NO_PATHCONV=1 adb shell am start -a android.intent.action.VIEW \
    -d "${SCHEME}://${route}" >/dev/null 2>&1
  sleep 5
  MSYS_NO_PATHCONV=1 adb shell screencap -p /sdcard/__shot.png >/dev/null 2>&1
  MSYS_NO_PATHCONV=1 adb pull /sdcard/__shot.png "$TMP/__shot.png" >/dev/null 2>&1
  if [ -f "$TMP/__shot.png" ]; then
    cp "$TMP/__shot.png" "$target"
    echo "  ok  $target"
  else
    echo "  FAIL $target"
  fi
done
