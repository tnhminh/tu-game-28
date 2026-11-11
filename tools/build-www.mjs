#!/usr/bin/env node
/**
 * Tủ Game 28 — tạo thư mục www/ (webDir của Capacitor + bản PWA).
 *
 *   node tools/build-www.mjs            # build
 *   node tools/build-www.mjs --icons    # vẽ lại icon PNG từ hub/assets/*.svg (cần Playwright, tuỳ chọn)
 *
 * Chỉ dùng module có sẵn của Node (fs, path, crypto). Icon PNG đã vẽ sẵn nằm trong hub/assets/icons/;
 * nếu thiếu, script thử dùng Playwright (nếu máy có) để vẽ từ SVG gốc.
 *
 * Đầu ra:
 *   www/index.html, hub.css, js/, assets/      ← hub/
 *   www/js/catalog-data.js                      ← mảng GENRES trong /index.html
 *   www/games/<genre>/gameN.html                ← game đã xử lý (bỏ khối RIO-GREET, chặn link "← Danh sách game")
 *   www/manifest.webmanifest, sw.js, icons/, privacy.html
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HUB = path.join(ROOT, 'hub');
const OUT = path.join(ROOT, 'www');
const GENRE_DIRS = ['arcade', 'puzzle', 'board', 'action', 'strategy', 'casual', 'multiplayer'];
const args = new Set(process.argv.slice(2));

const log = (...a) => console.log('[build-www]', ...a);
const rel = (p) => path.relative(OUT, p).split(path.sep).join('/');

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function mkdirp(p) { fs.mkdirSync(p, { recursive: true }); }
function copyDir(src, dst, filter = () => true) {
  mkdirp(dst);
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (!filter(s, e)) continue;
    if (e.isDirectory()) copyDir(s, d, filter);
    else fs.copyFileSync(s, d);
  }
}
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out;
}

/* ---------- 1. Danh mục từ /index.html ---------- */
function extractGenres() {
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const start = src.indexOf('const GENRES');
  if (start < 0) throw new Error('Không tìm thấy GENRES trong index.html');
  const open = src.indexOf('[', start);
  // tìm dấu ] khớp (bỏ qua chuỗi)
  let depth = 0, i = open, q = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) break; }
  }
  const literal = src.slice(open, i + 1);
  // Mảng chỉ chứa literal (chuỗi, số, object) — đánh giá trong hàm cô lập
  const genres = new Function('"use strict"; return (' + literal + ');')();
  if (!Array.isArray(genres) || genres.length !== 7) throw new Error('GENRES không hợp lệ');
  return genres.map((g) => ({ id: g.id, name: g.name, note: g.note, color: g.color, games: g.games }));
}

/* ---------- 2. Xử lý game ---------- */
const CLOSE_INTERCEPTOR =
  '<script>/* tg28: link "← Danh sách game" → đóng game trong hub */(function(){var inHub=false;' +
  'try{inHub=window.parent&&window.parent!==window}catch(e){}' +
  'document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;if(!a)return;' +
  'var h=a.getAttribute("href")||"";if(!/^(\\.\\.\\/)+index\\.html(#.*)?$/.test(h))return;' +
  'if(inHub){e.preventDefault();e.stopImmediatePropagation();try{window.parent.postMessage({tg28:"close"},"*")}catch(_){}}},true);' +
  '})();</script>';

function processGame(html, id) {
  let out = html;
  const before = out.length;
  out = out.replace(/[ \t]*<!--RIO-GREET-BEGIN-->[\s\S]*?<!--RIO-GREET-END-->[ \t]*\r?\n?/g, '');
  const stripped = out.length !== before;
  // link về danh sách: ../index.html (thư mục gốc) → ../../index.html (www/games/<genre>/ → www/)
  let links = 0;
  out = out.replace(/href=(["'])\.\.\/index\.html\1/g, (m, q) => { links++; return `href=${q}../../index.html${q}`; });
  const head = out.match(/<head[^>]*>/i);
  if (head) out = out.replace(head[0], head[0] + '\n' + CLOSE_INTERCEPTOR);
  else out = CLOSE_INTERCEPTOR + out;
  if (!links) log(`  ! ${id}: không thấy link ../index.html`);
  return { html: out, stripped, links };
}

/* ---------- 3. Icon ---------- */
const ICON_SIZES = [48, 72, 96, 128, 144, 152, 192, 256, 384, 512];
const MASK_SIZES = [48, 72, 96, 128, 192, 384, 512];
function iconJobs() {
  const jobs = [];
  for (const s of ICON_SIZES) jobs.push({ svg: 'logo.svg', size: s, file: `icon-${s}.png`, transparent: true });
  for (const s of MASK_SIZES) jobs.push({ svg: 'icon-maskable.svg', size: s, file: `maskable-${s}.png` });
  jobs.push({ svg: 'icon-full.svg', size: 180, file: 'apple-touch-icon.png' });
  jobs.push({ svg: 'logo.svg', size: 32, file: 'favicon-32.png', transparent: true });
  jobs.push({ svg: 'icon-full.svg', size: 512, file: 'store-icon-512.png' });
  return jobs;
}
async function renderIcons(dir) {
  let pw;
  try { pw = createRequire(import.meta.url)('playwright'); }
  catch (e) { log('  ! Không có Playwright — bỏ qua vẽ icon'); return false; }
  mkdirp(dir);
  const browser = await pw.chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    for (const j of iconJobs()) {
      const svg = fs.readFileSync(path.join(HUB, 'assets', j.svg));
      await page.setViewportSize({ width: j.size, height: j.size });
      await page.setContent(`<html><body style="margin:0;background:${j.transparent ? 'transparent' : '#0b0920'}">` +
        `<img src="data:image/svg+xml;base64,${svg.toString('base64')}" width="${j.size}" height="${j.size}" style="display:block"></body></html>`);
      await page.waitForFunction(() => document.images[0].complete);
      await page.screenshot({ path: path.join(dir, j.file), omitBackground: !!j.transparent, clip: { x: 0, y: 0, width: j.size, height: j.size } });
    }
  } finally { await browser.close(); }
  log(`  vẽ ${iconJobs().length} icon PNG từ SVG`);
  return true;
}

/* ---------- 4. Chính sách bảo mật ---------- */
function privacyHTML(email, appName, version) {
  const today = new Date().toISOString().slice(0, 10);
  const mail = `<a href="mailto:${email}">${email}</a> <mark class="todo">(địa chỉ tạm — thay trước khi phát hành / placeholder — replace before release)</mark>`;
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>Chính sách bảo mật — ${appName}</title>
<style>
:root{color-scheme:dark;--bg:#0b0920;--ink:#f1efff;--muted:#aaa6d6;--line:rgba(255,255,255,.1);--a:#4ad8ff}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
 padding:24px max(18px,env(safe-area-inset-right)) calc(40px + env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left))}
main{max-width:720px;margin:0 auto}
h1{font-size:26px;line-height:1.2;margin:0 0 4px}
h2{font-size:19px;margin:28px 0 6px;color:#ffe08a}
h3{font-size:16px;margin:18px 0 4px}
p,li{color:#dcd8f5}
.meta{color:var(--muted);font-size:14px}
nav{display:flex;gap:8px;margin:14px 0 8px;flex-wrap:wrap}
nav a{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid var(--line);color:var(--ink);text-decoration:none;font-weight:600}
a{color:var(--a)}
mark.todo{background:#ffd84a;color:#3a2a00;border-radius:6px;padding:1px 6px;font-size:13px;font-weight:700}
section{border-top:1px solid var(--line);margin-top:28px;padding-top:8px}
ul{padding-left:20px}
</style>
</head>
<body>
<main>
<h1>Chính sách bảo mật</h1>
<p class="meta">${appName} · phiên bản ${version} · cập nhật ${today}</p>
<nav><a href="#vi">Tiếng Việt</a><a href="#en">English</a></nav>

<section id="vi" lang="vi">
<h2>Tiếng Việt</h2>
<p>${appName} là bộ sưu tập trò chơi dành cho mọi lứa tuổi, kể cả trẻ em. Chúng tôi tôn trọng quyền riêng tư của bạn và của con bạn.</p>
<h3>1. Chúng tôi không thu thập dữ liệu cá nhân</h3>
<p>Ứng dụng không yêu cầu tạo tài khoản, không thu thập họ tên, email, số điện thoại, vị trí, danh bạ, ảnh hay mã định danh quảng cáo cho mục đích riêng của chúng tôi. Tên người chơi bạn nhập chỉ dùng để hiển thị lời chào trong ứng dụng.</p>
<h3>2. Dữ liệu lưu trên thiết bị</h3>
<p>Mọi tiến trình (tên người chơi, hình đại diện, cấp độ, xu, điểm cao, nhiệm vụ, thành tựu, cài đặt phụ huynh) được lưu cục bộ trên thiết bị bằng bộ nhớ của trình duyệt/ứng dụng. Dữ liệu này không được gửi về máy chủ nào. Gỡ ứng dụng hoặc dùng mục "Xoá tiến trình" trong Cài đặt sẽ xoá dữ liệu.</p>
<h3>3. Quảng cáo</h3>
<p>Trong ứng dụng Android/iOS, quảng cáo được cung cấp bởi Google AdMob và luôn ở chế độ <b>không cá nhân hoá</b>, được đánh dấu là nội dung hướng tới trẻ em (tag for child-directed treatment) và người dưới độ tuổi đồng ý, giới hạn nội dung ở mức phù hợp mọi lứa tuổi (G). Google có thể xử lý một số thông tin kỹ thuật (ví dụ loại thiết bị, địa chỉ IP ở dạng tổng quát) để phân phối quảng cáo và chống gian lận theo <a href="https://policies.google.com/privacy">Chính sách quyền riêng tư của Google</a>. Quảng cáo có thưởng luôn là tuỳ chọn. Người dùng VIP hoặc đã mua "Gỡ quảng cáo" không thấy quảng cáo xen kẽ. Bản web (PWA) không hiển thị quảng cáo thật.</p>
<h3>4. Mua trong ứng dụng</h3>
<p>Các giao dịch (Gỡ quảng cáo, VIP trọn đời, gói xu) được xử lý hoàn toàn bởi Google Play hoặc App Store. Chúng tôi không nhận và không lưu thông tin thanh toán của bạn. Mỗi lần mua đều có câu hỏi dành cho phụ huynh trước khi mở hộp thoại thanh toán.</p>
<h3>5. Trẻ em</h3>
<p>Ứng dụng có cổng phụ huynh trước khi mua hàng, mở liên kết ra ngoài và thay đổi cài đặt phụ huynh; có nhắc nghỉ mắt sau mỗi 30 phút chơi và tuỳ chọn giới hạn thời gian chơi mỗi ngày.</p>
<h3>6. Chia sẻ dữ liệu</h3>
<p>Chúng tôi không bán, không chia sẻ dữ liệu cá nhân với bên thứ ba vì chúng tôi không thu thập dữ liệu đó.</p>
<h3>7. Liên hệ</h3>
<p>Mọi câu hỏi về quyền riêng tư, vui lòng gửi email: ${mail}</p>
<h3>8. Thay đổi chính sách</h3>
<p>Khi chính sách thay đổi, chúng tôi sẽ cập nhật trang này và ngày cập nhật ở đầu trang.</p>
</section>

<section id="en" lang="en">
<h2>English</h2>
<p>${appName} is a collection of games for all ages, including children. We respect your privacy and your child's privacy.</p>
<h3>1. We do not collect personal data</h3>
<p>The app requires no account and does not collect names, email addresses, phone numbers, location, contacts, photos or advertising identifiers for our own purposes. The player name you enter is only used to show a greeting inside the app.</p>
<h3>2. Data stored on your device</h3>
<p>All progress (player name, avatar, level, coins, high scores, missions, achievements, parental settings) is stored locally on your device in the app/browser storage. It is never sent to any server. Uninstalling the app or using "Reset progress" in Settings deletes it.</p>
<h3>3. Advertising</h3>
<p>In the Android/iOS app, ads are served by Google AdMob and are always <b>non-personalized</b>, tagged for child-directed treatment and for users under the age of consent, with the maximum ad content rating set to General (G). Google may process limited technical information (such as device type and coarse IP address) to deliver ads and prevent fraud, as described in the <a href="https://policies.google.com/privacy">Google Privacy Policy</a>. Rewarded ads are always optional. VIP users and users who purchased "Remove ads" see no interstitial ads. The web (PWA) version shows no real ads.</p>
<h3>4. In-app purchases</h3>
<p>Purchases (Remove ads, VIP lifetime, coin packs) are processed entirely by Google Play or the App Store. We never receive or store your payment information. Every purchase is preceded by a parental gate question.</p>
<h3>5. Children</h3>
<p>A parental gate protects purchases, external links and parental settings. The app reminds players to rest their eyes every 30 minutes and offers an optional daily play-time limit.</p>
<h3>6. Data sharing</h3>
<p>We do not sell or share personal data with third parties, because we do not collect it.</p>
<h3>7. Contact</h3>
<p>For any privacy question, email: ${mail}</p>
<h3>8. Changes</h3>
<p>If this policy changes we will update this page and the date at the top.</p>
</section>
</main>
</body>
</html>
`;
}

/* ---------- 5. Service worker ---------- */
function swJS(version, files) {
  return `/* Tủ Game 28 — service worker (sinh bởi tools/build-www.mjs). Lưu offline toàn bộ app, có phiên bản. */
const VERSION = ${JSON.stringify(version)};
const CACHE = 'tg28-' + VERSION;
const ASSETS = ${JSON.stringify(files, null, 0)};

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tg28-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') {
        const shell = await cache.match('index.html');
        if (shell) return shell;
      }
      return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
`;
}

/* ---------- main ---------- */
async function main() {
  const t0 = Date.now();
  const cfgSrc = fs.readFileSync(path.join(HUB, 'js', 'config.js'), 'utf8');
  const email = (cfgSrc.match(/CONTACT_EMAIL:\s*'([^']+)'/) || [])[1] || 'lienhe@example.com';
  const version = (cfgSrc.match(/APP_VERSION:\s*'([^']+)'/) || [])[1] || '1.0.0';
  const appName = 'Tủ Game 28';

  rmrf(OUT); mkdirp(OUT);

  // hub
  for (const f of ['index.html', 'hub.css']) fs.copyFileSync(path.join(HUB, f), path.join(OUT, f));
  copyDir(path.join(HUB, 'js'), path.join(OUT, 'js'));
  copyDir(path.join(HUB, 'assets'), path.join(OUT, 'assets'), (s) => !s.startsWith(path.join(HUB, 'assets', 'icons')));

  // games
  const genres = extractGenres();
  let nGames = 0, nStripped = 0;
  for (const g of GENRE_DIRS) {
    const srcDir = path.join(ROOT, g);
    if (!fs.existsSync(srcDir)) throw new Error('Thiếu thư mục ' + g);
    const dstDir = path.join(OUT, 'games', g); mkdirp(dstDir);
    for (const f of fs.readdirSync(srcDir).sort()) {
      const s = path.join(srcDir, f);
      if (fs.statSync(s).isDirectory()) { copyDir(s, path.join(dstDir, f)); continue; } // vd. sprites/
      if (/^game\d+\.html$/.test(f)) {
        const r = processGame(fs.readFileSync(s, 'utf8'), `${g}/${f}`);
        fs.writeFileSync(path.join(dstDir, f), r.html);
        nGames++; if (r.stripped) nStripped++;
      } else fs.copyFileSync(s, path.join(dstDir, f)); // tài nguyên phụ (nếu có)
    }
  }
  const expected = genres.reduce((n, g) => n + g.games.length, 0);
  if (nGames !== expected) log(`  ! số game (${nGames}) khác danh mục (${expected})`);

  // icons
  const iconSrc = path.join(HUB, 'assets', 'icons');
  const missing = iconJobs().some((j) => !fs.existsSync(path.join(iconSrc, j.file)));
  if (args.has('--icons') || missing) await renderIcons(iconSrc);
  mkdirp(path.join(OUT, 'icons'));
  for (const j of iconJobs()) {
    const p = path.join(iconSrc, j.file);
    if (fs.existsSync(p)) fs.copyFileSync(p, path.join(OUT, 'icons', j.file));
    else log('  ! thiếu icon ' + j.file);
  }

  // manifest
  const manifest = {
    name: appName, short_name: appName, id: './', lang: 'vi', dir: 'ltr',
    description: '28 game tiếng Việt, 7 thể loại — chơi được cả khi không có mạng.',
    start_url: './index.html', scope: './', display: 'standalone', orientation: 'any',
    background_color: '#0b0920', theme_color: '#0b0920', categories: ['games', 'kids', 'entertainment'],
    icons: [
      ...ICON_SIZES.map((s) => ({ src: `icons/icon-${s}.png`, sizes: `${s}x${s}`, type: 'image/png', purpose: 'any' })),
      ...MASK_SIZES.map((s) => ({ src: `icons/maskable-${s}.png`, sizes: `${s}x${s}`, type: 'image/png', purpose: 'maskable' }))
    ]
  };
  fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT, 'privacy.html'), privacyHTML(email, appName, version));

  // catalog-data.js (cần tính trước hash) — build id phụ thuộc nội dung
  const hashFiles = () => {
    const h = crypto.createHash('sha256');
    for (const f of walk(OUT).sort()) { if (f.endsWith('sw.js') || f.endsWith('catalog-data.js')) continue; h.update(rel(f)); h.update(fs.readFileSync(f)); }
    h.update(JSON.stringify(genres));
    return h.digest('hex').slice(0, 10);
  };
  const buildId = hashFiles();
  fs.writeFileSync(path.join(OUT, 'js', 'catalog-data.js'),
    '/* Sinh tự động bởi tools/build-www.mjs từ GENRES trong /index.html — đừng sửa tay. */\n' +
    'window.TG_BUILD = ' + JSON.stringify(buildId) + ';\n' +
    'window.TG_GENRES = ' + JSON.stringify(genres, null, 1) + ';\n');

  // sw.js — danh sách mọi tệp
  const files = ['./', ...walk(OUT).map(rel).filter((p) => p !== 'sw.js').sort()];
  fs.writeFileSync(path.join(OUT, 'sw.js'), swJS(version + '-' + buildId, files));

  const size = walk(OUT).reduce((n, f) => n + fs.statSync(f).size, 0);
  log(`xong: ${nGames} game (${nStripped} bỏ khối RIO-GREET), ${files.length} tệp trong cache, ${(size / 1024 / 1024).toFixed(2)} MB, build ${buildId}, ${Date.now() - t0} ms`);
}

main().catch((e) => { console.error('[build-www] LỖI:', e && e.stack || e); process.exit(1); });
