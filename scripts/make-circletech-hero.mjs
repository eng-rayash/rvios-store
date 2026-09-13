/**
 * يبني لافتة «سيركل تك» من موادّ المتجر نفسها.
 *
 * مجلّد المتجر الذي سلّمه التاجر فيه قطعٌ مقصوصة وشعار، ولا
 * لافتة فيه — والطبقة الفاخرة تعرض `showcase` خلفيةً ممتدّة
 * (object-cover) في رأس الصفحة وفي شريحة الغلاف. صورةُ منتجٍ
 * على أبيض في ذلك الموضع تُنتج مستطيلاً أبيض تحت نصٍّ فاتح.
 *
 * فبُنيت اللافتة هنا بدل أن تُجلب من خارج: تدرّجٌ من سماويّ
 * الشعار إلى حبرٍ داكن، وعليه أربع قطع من الكتالوج. اليمين
 * يُترك داكناً خالياً لأن النصّ يقع هناك في التخطيط العربي.
 *
 * التوليد بالبرنامج لا باليد كي تُعاد اللافتة إن تغيّر الشعار
 * أو استُبدلت القطع، وكي يُعرف من أين جاءت.
 *
 *   node scripts/make-circletech-hero.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..', 'public', 'stores', 'circletech');
const out = path.join(dir, 'hero.png');

const W = 1376;
const H = 768;

/* ألوان الشعار نفسها — أُخذت من بكسلاته لا من التخمين */
const CYAN = '#38C0D8';
const TEAL = '#2890C0';

const background = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ground" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0"    stop-color="#041018"/>
      <stop offset="0.55" stop-color="#0A2B3A"/>
      <stop offset="1"    stop-color="#10465C"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.32" cy="0.42" r="0.55">
      <stop offset="0"   stop-color="${CYAN}" stop-opacity="0.42"/>
      <stop offset="0.6" stop-color="${TEAL}" stop-opacity="0.12"/>
      <stop offset="1"   stop-color="${TEAL}" stop-opacity="0"/>
    </radialGradient>
    <!-- تعتيم اليمين: النصّ العربي يبدأ من هناك -->
    <linearGradient id="veil" x1="1" y1="0" x2="0" y2="0">
      <stop offset="0"    stop-color="#04121A" stop-opacity="0.88"/>
      <stop offset="0.42" stop-color="#04121A" stop-opacity="0.28"/>
      <stop offset="1"    stop-color="#04121A" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#ground)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <!-- دائرتا الشعار خلف القطع -->
  <circle cx="340" cy="400" r="270" fill="none" stroke="${CYAN}" stroke-opacity="0.22" stroke-width="2"/>
  <circle cx="340" cy="400" r="390" fill="none" stroke="${CYAN}" stroke-opacity="0.11" stroke-width="2"/>
  <rect width="${W}" height="${H}" fill="url(#veil)"/>
</svg>`);

/** القطع المعروضة: [الملف، العرض، س، ص] — الأكبر أولاً ليقع خلف ما بعده */
const PIECES = [
  ['laptop-ultrabook.png', 640, -40, 170],
  ['camera-mirrorless-silver.png', 300, 285, 405],
  ['headphones-anc-black.png', 350, 520, 300],
];

const layers = [{ input: background, top: 0, left: 0 }];

for (const [file, size, left, top] of PIECES) {
  layers.push({
    input: await sharp(path.join(dir, file)).resize(size, size, { fit: 'inside' }).toBuffer(),
    left,
    top,
  });
}

await sharp({ create: { width: W, height: H, channels: 4, background: '#041018' } })
  .composite(layers)
  .png({ compressionLevel: 9 })
  .toFile(out);

console.log(`تمّت اللافتة: ${path.relative(path.join(here, '..'), out)} (${W}×${H})`);
