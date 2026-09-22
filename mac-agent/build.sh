#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build
STAGING=$(mktemp -d /tmp/rush-hour-counter-build.XXXXXX)
APP="$STAGING/Rush Hour Counter.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
xcrun swiftc -swift-version 5 -O -target "$(uname -m)-apple-macosx14.0" \
  -module-cache-path "$PWD/build/ModuleCache" \
  Sources/*.swift -o "$APP/Contents/MacOS/RushHourCounter"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>RushHourCounter</string>
<key>CFBundleIdentifier</key><string>in.rushhour.counter</string>
<key>CFBundleName</key><string>Rush Hour Counter</string>
<key>CFBundleDisplayName</key><string>Rush Hour Counter</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.2.0</string>
<key>CFBundleVersion</key><string>2</string>
<key>LSMinimumSystemVersion</key><string>14.0</string>
<key>NSMicrophoneUsageDescription</key><string>Rush listens to counter orders and sends audio to Sarvam to calculate your bill. You control when listening starts and stops.</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
xattr -cr "$APP"
codesign --force --sign - "$APP"
ditto --norsrc --noextattr "$APP" "$PWD/build/Rush Hour Counter.app"
codesign --verify --verbose=1 "$PWD/build/Rush Hour Counter.app"
printf 'Built: %s\n' "$PWD/build/Rush Hour Counter.app"
