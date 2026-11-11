# Tủ Game 28 — building the native apps (Android / iOS)

The app is a [Capacitor 8](https://capacitorjs.com) shell around the web build in `www/`
(produced by `node tools/build-www.mjs`, see `docs/ARCHITECTURE.md`).

| Item | Value |
|---|---|
| App id (package / bundle id) | `vn.tugame28.app` — **placeholder, change before first upload** (see below) |
| App name | Tủ Game 28 |
| Version | `1.0.0` (Android versionCode `1`, iOS build `1`) |
| Capacitor | core/cli/android/ios `8.6.0` (exact pins in `package.json`) |
| Plugins | @capacitor/app 8.1.2, splash-screen 8.0.2, status-bar 8.0.4, local-notifications 8.3.1, haptics 8.0.2, @capacitor-community/admob 8.3.0 (play-services-ads 25.4.0), cordova-plugin-purchase 13.20.0 (Play Billing 9.0.0) |
| Android | compileSdk **36**, targetSdk **36**, minSdk 24 (Capacitor 8 default), AGP 8.13.0, Gradle 8.14.3, Java 21 |
| iOS | deployment target 15.0, Swift Package Manager (no CocoaPods) |

## Why targetSdk 36

Google Play requires new apps and updates to target an API level within one year of the
latest major Android release. Since 31 Aug 2025 that was API 35 (Android 15); since
31 Aug 2026 it is **API 36 (Android 16)**. Capacitor 8 defaults to compile/target 36, so the
project uses 36. When Play raises the bar again (expected Aug 2027 → API 37) bump
`compileSdkVersion`/`targetSdkVersion` in `android/variables.gradle` (usually together with a
Capacitor major upgrade) and install `platforms;android-37`.

## Android

### One-time machine setup
- Java 21 (JDK), Node 22+, Python 3 with Pillow (icon generator).
- Android SDK in `/opt/android-sdk` (the build script exports `ANDROID_HOME`/`ANDROID_SDK_ROOT`;
  override by exporting your own):
  ```sh
  # command-line tools from https://dl.google.com/android/repository/commandlinetools-linux-*_latest.zip
  # unpacked to /opt/android-sdk/cmdline-tools/latest, then:
  yes | sdkmanager --sdk_root=/opt/android-sdk --licenses
  sdkmanager --sdk_root=/opt/android-sdk "platform-tools" "platforms;android-36" "build-tools;36.1.0" "build-tools;35.0.0"
  ```
- `npm ci` in the repo root.
- Build host note: `repo.maven.apache.org` answered HTTP 429 on the original build machine, so
  `~/.gradle/init.d/maven-central-mirror.gradle` (machine-local, not in the repo) adds Google's
  Maven Central mirror `https://maven-central.storage-download.googleapis.com/maven2/`.
  Copy it if you hit the same rate limiting.

### Build
```sh
bash tools/build-android.sh          # or: npm run build:android
```
It runs `node tools/build-www.mjs` (if present) → `android/scripts/gen-icons.py` →
`npx cap sync android` → `./gradlew clean bundleRelease assembleRelease assembleDebug`, then copies:

- `dist/tu-game-28-1.0.0.aab` — **upload this to Google Play**
- `dist/tu-game-28-1.0.0.apk` — release-signed universal APK (side-loading / testing)
- `dist/tu-game-28-1.0.0-debug.apk` — debug build (debuggable, WebView inspectable via chrome://inspect, debug key)

Env switches: `SKIP_WWW=1` (keep current `www/`), `SKIP_ICONS=1` (keep current icons).
Open in Android Studio: `npx cap open android`.

### Verify an AAB/APK
```sh
BT=/opt/android-sdk/build-tools/36.1.0
java -jar bundletool-all.jar validate --bundle=dist/tu-game-28-1.0.0.aab   # or the /opt/bundletool/bundletool wrapper
java -jar bundletool-all.jar dump manifest --bundle=dist/tu-game-28-1.0.0.aab
java -jar bundletool-all.jar build-apks [--aapt2=$BT/aapt2] --bundle=dist/tu-game-28-1.0.0.aab --output=/tmp/t.apks \
     --ks=/home/user/release-keys/upload-keystore.jks --ks-key-alias=upload --ks-pass=file:<pwfile>
$BT/aapt2 dump badging dist/tu-game-28-1.0.0.apk
$BT/apksigner verify --print-certs -v dist/tu-game-28-1.0.0.apk
jarsigner -verify dist/tu-game-28-1.0.0.aab
```

### Signing / keystore
- Upload key: `/home/user/release-keys/upload-keystore.jks` (outside the repo), alias `upload`.
  Passwords, fingerprints and the loss warning: `/home/user/release-keys/README.txt`.
  **Back that folder up.** Use **Play App Signing** (Google keeps the app-signing key; a lost
  upload key can then be reset via Play Console). Without it, losing the key = no more updates.
- `android/app/build.gradle` finds the credentials in this order:
  1. env `TG28_KEYSTORE_PROPERTIES=/path/keystore.properties`
  2. `android/keystore.properties` (git-ignored), containing
     `keystorePropertiesFile=/home/user/release-keys/keystore.properties`
  3. env `TG28_STORE_FILE`, `TG28_STORE_PASSWORD`, `TG28_KEY_ALIAS`, `TG28_KEY_PASSWORD` (CI)

  The properties file has `storeFile`, `storePassword`, `keyAlias`, `keyPassword`.
  Without any of these, release outputs are built **unsigned** and a warning is printed.
- `.gitignore` excludes `*.jks`, `*.keystore`, `keystore.properties`, `dist/`, `www/`,
  `node_modules/`, Android build dirs and `local.properties`. Never commit secrets.

### Icons & splash
`android/scripts/gen-icons.py` (Pillow) produces legacy + adaptive (foreground / background /
monochrome-themed) launcher icons for mdpi…xxxhdpi, the notification icon `ic_stat_notify`
(white silhouette), the Android 12+ splash icon, legacy portrait/landscape splash PNGs, the iOS
1024 App Store icon + 2732 splash, and the Play hi-res icon `android/store-icon-512.png`.

Source priority: `--source PATH` → `hub/assets/icons/maskable-512.png` →
`hub/assets/icons/icon-512.png` → `www/icons/maskable-512.png` → `www/icons/icon-512.png` →
a built-in original joystick mark (gold `#ffc94a` on `#12131c`). It prints the source used and
the build script reruns it every build. **Current build: the hub's
`hub/assets/icons/maskable-512.png`** (full-bleed art scaled so its maskable safe circle equals
the 72dp visible launcher area; monochrome + notification icons are a brightness silhouette of
it; splash screens show it as a rounded tile on `#12131c`). Higher-res source art (1024 px)
would give crisper xxxhdpi / iOS icons — drop it in as `--source` or replace maskable-512.
(`@capacitor/assets` was not used: it needs the native `sharp` binary; Pillow is simpler.)

### Edge-to-edge / system bars
targetSdk 35+ forces edge-to-edge on Android 15+. `capacitor.config.json` sets
`SystemBars.insetsHandling: "css"` + `initialViewportFitValueHint: "cover"` and
`StatusBar.overlaysWebView: true`, so the WebView is always full-screen and the hub's
`env(safe-area-inset-*)` padding (it uses `viewport-fit=cover`) keeps content clear of the bars.

### Manifest decisions (android/app/src/main/AndroidManifest.xml)
- **AdMob App ID** meta-data = Google's official **test** id `ca-app-pub-3940256099942544~3347511713`.
  Replace with your real one before release (the app crashes on start without the meta-data).
- **`com.google.android.gms.permission.AD_ID` removed** (`tools:node="remove"`): the app is
  child-directed; Families policy forbids transmitting the advertising ID from apps for children.
  Ads are non-personalised anyway. Play Console → App content → Advertising ID: answer "No".
- **`ACCESS_ADSERVICES_AD_ID / _ATTRIBUTION / _TOPICS` removed**: Privacy-Sandbox interest/
  attribution signals, not appropriate for a children's app.
- **`SCHEDULE_EXACT_ALARM` removed** (added by local-notifications): reminders don't need exact
  timing; the plugin falls back to inexact alarms. Delete that line to restore exact alarms.
- `com.android.vending.BILLING` declared (cordova-plugin-purchase also adds it).
- Orientation unrestricted (portrait + landscape), hardware acceleration on, no cleartext
  traffic, `allowMixedContent: false`. The back button is delivered to the web layer
  (`@capacitor/app` `backButton` listener in the hub); no native override.
- Remaining merged permissions: INTERNET, ACCESS_NETWORK_STATE, BILLING, VIBRATE,
  RECEIVE_BOOT_COMPLETED, WAKE_LOCK, POST_NOTIFICATIONS (runtime prompt on Android 13+),
  FOREGROUND_SERVICE (from WorkManager inside play-services-ads; no typed foreground service is
  declared, so no Play FGS declaration is needed), `<appId>.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`
  (AndroidX internal).
- The web layer (`hub/js/ads.js`) initialises AdMob with `tagForChildDirectedTreatment`,
  `tagForUnderAgeOfConsent`, `maxAdContentRating: 'General'` and requests ads with `npa: true`.

## iOS (needs a Mac with Xcode 16+)
The project in `ios/` was generated on Linux with `npx cap add ios` (SPM based); it cannot be
built here.
1. `npm ci && node tools/build-www.mjs && npx cap sync ios`
2. `npx cap open ios` → Xcode opens `ios/App/App.xcodeproj` (packages resolve automatically).
3. Target **App → Signing & Capabilities**: choose your Team, keep/adjust bundle id, add the
   **In-App Purchase** capability. (Push isn't needed: local notifications only.)
4. `ios/App/App/Info.plist`: replace `GADApplicationIdentifier` (currently Google's iOS **test**
   id `ca-app-pub-3940256099942544~1458002511`); add Google's full `SKAdNetworkItems` list if
   you serve ads (only Google's `cstr6suwn9` is listed). `ITSAppUsesNonExemptEncryption=false`.
   Do **not** add App Tracking Transparency for a children's app.
5. Version: target → General → Version (`MARKETING_VERSION`, 1.0.0) and Build
   (`CURRENT_PROJECT_VERSION`, increment every upload).
6. Product → Archive → Distribute App → App Store Connect. In App Store Connect create the app
   with the same bundle id, create the IAP products (below), fill App Privacy, age rating.
   Note: Apple's **Kids Category** restricts third-party ads/analytics — if you list the app in
   Kids, AdMob ads must be child-safe and human-reviewed, or ship iOS without ads.

## Changing things

### App id (do this before the first store upload — it is permanent afterwards)
1. `capacitor.config.json` → `appId`.
2. `android/app/build.gradle` → `namespace` and `applicationId`.
3. Move `android/app/src/main/java/vn/tugame28/app/MainActivity.java` to the new package path
   and update its `package` line.
4. `android/app/src/main/res/values/strings.xml` → `package_name`, `custom_url_scheme`.
5. iOS: Xcode → target → Bundle Identifier (`PRODUCT_BUNDLE_IDENTIFIER` in project.pbxproj).
6. `npx cap sync`.

### AdMob IDs
- App IDs: Android `AndroidManifest.xml` meta-data `com.google.android.gms.ads.APPLICATION_ID`;
  iOS `Info.plist` `GADApplicationIdentifier`.
- Ad-unit IDs (interstitial, rewarded): `hub/js/config.js` → `ADS.units.*` (currently Google's
  official test units). Rebuild www and the app after changing them.

### In-app product IDs
`remove_ads`, `vip_lifetime` (non-consumable), `coins_small`, `coins_large` (consumable) are
registered in the hub's purchase provider (cordova-plugin-purchase / `CdvPurchase.store.register`).
Create products with **exactly the same IDs** in Play Console (Monetize → Products → In-app
products) and App Store Connect. Play needs an uploaded build with BILLING (any track) before
products can be created.

### Version bumps
- Android: `android/app/build.gradle` → `versionCode` (+1 for every upload) and `versionName`
  (the build script names the outputs after `versionName`).
- iOS: `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` in Xcode.
- Optionally `package.json` `version`.

### Upgrading Capacitor / plugins
`npm install --save-exact @capacitor/core@X @capacitor/cli@X @capacitor/android@X @capacitor/ios@X …`,
then `npx cap sync`; read the Capacitor upgrade guide for template changes in `android/`/`ios/`.

## Điền mã thật trước khi phát hành (một lệnh)
1. `cp tools/release.config.example.json tools/release.config.json`
2. Điền: email liên hệ, AdMob App ID (Android/iOS), 4 ad unit ID, product ID (giữ nguyên nếu tạo đúng tên trên store), số phiên bản (`version.code` phải tăng mỗi lần tải lên Play).
3. `node tools/apply-release-config.mjs` — kiểm tra định dạng, từ chối mã thử của Google khi `production: true`, rồi ghi vào `hub/js/config.js`, `AndroidManifest.xml`, `build.gradle`, `Info.plist`, `project.pbxproj`.
4. `node tools/apply-release-config.mjs --check` — báo còn chỗ nào là mã thử / email giả (thoát mã 1 nếu chưa sẵn sàng).
5. `bash tools/build-android.sh` → `dist/tu-game-28-<phiên bản>.aab`.
