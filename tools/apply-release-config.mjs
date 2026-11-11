#!/usr/bin/env node
// Điền mã thật (AdMob, sản phẩm, email, phiên bản) vào mọi nơi cần thiết.
// Dùng: node tools/apply-release-config.mjs [đường-dẫn-config.json]
//       node tools/apply-release-config.mjs --check   (chỉ kiểm tra, không sửa)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const cfgPath = path.resolve(args.find(a => !a.startsWith('--')) || path.join(ROOT, 'tools/release.config.json'));

const FILES = {
  config: 'hub/js/config.js',
  manifest: 'android/app/src/main/AndroidManifest.xml',
  gradle: 'android/app/build.gradle',
  plist: 'ios/App/App/Info.plist',
  pbx: 'ios/App/App.xcodeproj/project.pbxproj',
};
const TEST_PUB = 'ca-app-pub-3940256099942544';
const APP_ID_RE = /^ca-app-pub-\d{16}~\d{10}$/;
const UNIT_RE = /^ca-app-pub-\d{16}\/\d{10}$/;
const PRODUCT_RE = /^[a-z0-9][a-z0-9._]{0,98}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

// ---------- Chế độ --check: báo những chỗ còn là giá trị thử / giả ----------
function check() {
  const problems = [];
  const c = read(FILES.config);
  if (/units:[\s\S]*?ca-app-pub-3940256099942544/.test(c)) problems.push(`${FILES.config}: còn mã quảng cáo THỬ NGHIỆM của Google`);
  if (/testing:\s*true/.test(c)) problems.push(`${FILES.config}: ADS.testing đang là true`);
  if (/CONTACT_EMAIL:\s*'[^']*example\.com'/.test(c)) problems.push(`${FILES.config}: email liên hệ còn là lienhe@example.com`);
  if (read(FILES.manifest).includes(TEST_PUB)) problems.push(`${FILES.manifest}: AdMob App ID còn là mã thử`);
  if (fs.existsSync(path.join(ROOT, FILES.plist)) && read(FILES.plist).includes(TEST_PUB)) problems.push(`${FILES.plist}: AdMob App ID còn là mã thử`);
  if (problems.length) { console.log('CHƯA SẴN SÀNG phát hành:\n - ' + problems.join('\n - ')); process.exit(1); }
  console.log('Sẵn sàng: không còn mã thử hay email giả.');
}
if (CHECK) { check(); process.exit(0); }

// ---------- Đọc và kiểm tra cấu hình ----------
if (!fs.existsSync(cfgPath)) {
  console.error(`Không thấy ${cfgPath}.\nChép tools/release.config.example.json thành tools/release.config.json rồi điền giá trị thật.`);
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const errors = [];
const prod = cfg.production !== false;
const ad = cfg.admob || {};
const need = (cond, msg) => { if (!cond) errors.push(msg); };

need(EMAIL_RE.test(cfg.contactEmail || '') && !/example\.com|vidu\.com$/.test(cfg.contactEmail), 'contactEmail: cần email liên hệ thật');
need(/^\d+\.\d+\.\d+$/.test(cfg.version?.name || ''), 'version.name: dạng 1.0.0');
need(Number.isInteger(cfg.version?.code) && cfg.version.code >= 1, 'version.code: số nguyên ≥ 1, phải tăng mỗi lần tải lên Play');
for (const [k, v] of Object.entries({ androidAppId: ad.androidAppId, iosAppId: ad.iosAppId })) {
  need(APP_ID_RE.test(v || ''), `admob.${k}: dạng ca-app-pub-<16 số>~<10 số>`);
}
for (const os of ['android', 'ios']) for (const t of ['interstitial', 'rewarded']) {
  need(UNIT_RE.test(ad[os]?.[t] || ''), `admob.${os}.${t}: dạng ca-app-pub-<16 số>/<10 số>`);
}
if (prod) {
  const all = JSON.stringify(ad);
  need(!all.includes(TEST_PUB), 'production=true nhưng còn mã quảng cáo thử nghiệm của Google');
}
for (const k of ['remove_ads', 'vip_lifetime', 'coins_small', 'coins_large']) {
  need(PRODUCT_RE.test(cfg.products?.[k] || ''), `products.${k}: chữ thường, số, dấu . hoặc _`);
}
if (errors.length) { console.error('Cấu hình chưa hợp lệ:\n - ' + errors.join('\n - ')); process.exit(1); }

// ---------- Ghi vào từng file ----------
const changed = [];
function patch(rel, fn) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { console.warn(`(bỏ qua, không có) ${rel}`); return; }
  const before = fs.readFileSync(p, 'utf8');
  const after = fn(before);
  if (after !== before) { fs.writeFileSync(p, after); changed.push(rel); }
}
function sub(src, re, val, label) {
  if (!re.test(src)) throw new Error(`Không tìm thấy chỗ cần thay: ${label}`);
  return src.replace(re, val);
}

patch(FILES.config, s => {
  s = sub(s, /CONTACT_EMAIL:\s*'[^']*'/, `CONTACT_EMAIL: '${cfg.contactEmail}'`, 'CONTACT_EMAIL');
  s = sub(s, /APP_VERSION:\s*'[^']*'/, `APP_VERSION: '${cfg.version.name}'`, 'APP_VERSION');
  s = sub(s, /testing:\s*(true|false)/, `testing: ${!prod}`, 'ADS.testing');
  s = sub(s, /(android:\s*\{\s*interstitial:\s*)'[^']*'(,\s*rewarded:\s*)'[^']*'/, `$1'${ad.android.interstitial}'$2'${ad.android.rewarded}'`, 'ADS.units.android');
  s = sub(s, /(ios:\s*\{\s*interstitial:\s*)'[^']*'(,\s*rewarded:\s*)'[^']*'/, `$1'${ad.ios.interstitial}'$2'${ad.ios.rewarded}'`, 'ADS.units.ios');
  for (const k of ['remove_ads', 'vip_lifetime', 'coins_small', 'coins_large']) {
    s = sub(s, new RegExp(`(${k}:\\s*\\{\\s*id:\\s*)'[^']*'`), `$1'${cfg.products[k]}'`, `IAP.products.${k}`);
  }
  return s;
});
patch(FILES.manifest, s => sub(s,
  /(android:name="com\.google\.android\.gms\.ads\.APPLICATION_ID"\s*android:value=")[^"]*"/,
  `$1${ad.androidAppId}"`, 'AdMob APPLICATION_ID'));
patch(FILES.gradle, s => {
  s = sub(s, /versionCode\s+\d+/, `versionCode ${cfg.version.code}`, 'versionCode');
  return sub(s, /versionName\s+"[^"]*"/, `versionName "${cfg.version.name}"`, 'versionName');
});
patch(FILES.plist, s => sub(s,
  /(<key>GADApplicationIdentifier<\/key>\s*<string>)[^<]*(<\/string>)/,
  `$1${ad.iosAppId}$2`, 'GADApplicationIdentifier'));
patch(FILES.pbx, s => s
  .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${cfg.version.name};`)
  .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${cfg.version.code};`));

console.log(changed.length ? 'Đã cập nhật:\n - ' + changed.join('\n - ') : 'Không có gì thay đổi.');
console.log(`Chế độ: ${prod ? 'PHÁT HÀNH (quảng cáo thật)' : 'thử nghiệm'} · phiên bản ${cfg.version.name} (${cfg.version.code})`);
console.log('Bước tiếp theo: bash tools/build-android.sh');
