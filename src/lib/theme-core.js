// ═══════════════════════════════════════════════════════════
//  محرّك الهوية اللونية — §٣.٦
//
//  التاجر يختار **لوناً واحداً**، ومن هذا اللون تُشتق لوحة
//  كاملة: الأسطح، الحدود، النصوص، الظلال، الوهج، لون التباين.
//  فلا يبقى في المتجر عنصر واحد بلون «المنصة» بينما بقية
//  الصفحة بلون التاجر — الموقع كله يتحوّل إلى هويته.
//
//  الحساب يجري في فضاء OKLab لا HSL: تفتيح الأحمر في HSL
//  يعطي وردياً باهتاً، وتغميق الأصفر يعطي طيناً. OKLab يحفظ
//  الإحساس البصري بالإضاءة، فتخرج التدرجات نظيفة لأي لون
//  يختاره التاجر مهما كان.
//
//  الملف **نقي**: لا DOM ولا متصفح. يستورده الخادم (render.js)
//  ليحقن اللوحة في HTML قبل تحميل JS، وتستورده الواجهة.
//  مصدر حقيقة واحد للّون في الطرفين.
// ═══════════════════════════════════════════════════════════

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const clamp01 = (n) => clamp(n, 0, 1);

// ── sRGB ⇄ OKLab ─────────────────────────────────────────
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma  = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

export function hexToRgb(hex) {
  const h = String(hex || '').trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = Number.parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(n) || full.length < 6) return [0.62, 0.13, 0.15];   // العنابي الافتراضي
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
}

export function rgbToHex([r, g, b]) {
  const p = (v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
  return `#${p(r)}${p(g)}${p(b)}`;
}

function rgbToOklab([r, g, b]) {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  ].map(clamp01);
}

/** hex → {L, C, h}  (h بالدرجات) */
export function hexToLch(hex) {
  const [L, a, b] = rgbToOklab(hexToRgb(hex));
  return {
    L,
    C: Math.hypot(a, b),
    h: (Math.atan2(b, a) * 180) / Math.PI,
  };
}

/** {L, C, h} → hex */
export function lch(L, C, h) {
  const rad = (h * Math.PI) / 180;
  return rgbToHex(oklabToRgb([clamp(L, 0, 1), Math.max(0, C) * Math.cos(rad), Math.max(0, C) * Math.sin(rad)]));
}

/** إضاءة WCAG — لاختيار لون النص فوق خلفية ملوّنة */
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/**
 * لون النص فوق خلفية: نجرّب الأبيض ثم حبراً داكناً من نفس
 * العائلة، ونأخذ الأعلى تبايناً. لا نفترض «الأبيض دائماً» —
 * متجر بلون أصفر أو ليموني يصبح نصه غير مقروء (§٧.١ الوصولية).
 */
export function onColor(hex, dark) {
  return contrast(hex, '#FFFFFF') >= contrast(hex, dark) ? '#FFFFFF' : dark;
}

/**
 * درجة من لون التاجر **صالحة للقراءة كنص** فوق سطح معيّن.
 *
 * ضرورية لا تجميلية: متجر يختار أصفر ليمونياً يجعل الأسعار
 * غير مقروءة لو استُخدم اللون نفسه نصاً (تباين ١٫٧:١). هنا
 * نُغمق أو نُفتّح الدرجة خطوةً خطوة حتى تبلغ ٤٫٥:١، مع
 * الحفاظ على الدرجة اللونية — فالهوية باقية والنص مقروء.
 */
export function readable(hex, bg, target = 4.5) {
  const { L, C, h } = hexToLch(hex);
  const darken = luminance(bg) > 0.4;            // سطح فاتح ⇒ نُغمق النص
  let out = hex;
  for (let step = 0; step <= 24; step++) {
    out = lch(clamp(L + (darken ? -1 : 1) * step * 0.03, 0.06, 0.98), C, h);
    if (contrast(out, bg) >= target) break;
  }
  return out;
}

const rgbTriplet = (hex) => hexToRgb(hex).map((v) => Math.round(v * 255)).join(',');

// ═══ اللوحة ══════════════════════════════════════════════
/**
 * يشتق لوحة CSS كاملة من لون واحد.
 *
 * @param {string} color      لون التاجر (#RRGGBB)
 * @param {object} [opts]
 * @param {string} [opts.deep]  الدرجة الغامقة المحفوظة — تُحترم إن وُجدت
 * @param {boolean} [opts.dark] سطح داكن (سكِن «منتصف الليل» — برو)
 * @returns {Record<string,string>} أسماء متغيّرات CSS وقيمها
 */
export function derivePalette(color, { deep = '', dark = false } = {}) {
  const base = /^#[0-9a-fA-F]{6}$/.test(String(color)) ? color : '#9E2226';
  const { L, C, h } = hexToLch(base);

  // كروما الأسطح تتناسب مع كروما اللون: لون رمادي لا يصبغ
  // الصفحة، ولون مشبع يصبغها بلمسة محسوسة لا صارخة.
  const tint = (mult, cap) => Math.min(C * mult, cap);

  /**
   * اللون المساعد (دور «النحاس» في هوية RVIOS).
   * لا نُدير الدرجة بمقدار ثابت — ذلك يعطي بنفسجياً لأزرق
   * وسماوياً لأخضر. بل ننطلق من نطاق الذهب (٧٨°) ونشدّه
   * ثلث المسافة نحو لون التاجر: يبقى دافئاً متبايناً، ويظل
   * منتمياً لهويته. اللون شبه الرمادي لا درجة له، فيُثبَّت.
   */
  const GOLD = 78;
  const arc = ((h - GOLD + 540) % 360) - 180;     // أقصر قوس بين الدرجتين
  const accentHue = C < 0.015 ? GOLD : GOLD + arc * 0.3;

  const shop     = base;
  const shopDeep = /^#[0-9a-fA-F]{6}$/.test(String(deep)) ? deep : lch(Math.max(0.24, L * 0.74), C * 0.96, h);
  const shopLift = lch(Math.min(0.80, L + 0.15), C * 0.86, h);   // درجة أفتح للأسطح الداكنة
  const accent   = lch(dark ? 0.80 : 0.745, Math.max(0.055, Math.min(0.115, C * 0.72)), accentHue);

  const surfaces = dark
    ? {
        cream: lch(0.205, tint(0.30, 0.030), h),
        paper: lch(0.253, tint(0.34, 0.034), h),
        sand:  lch(0.315, tint(0.40, 0.042), h),
        line:  lch(0.385, tint(0.45, 0.050), h),
        ink:   lch(0.960, tint(0.16, 0.018), h),
        soft:  lch(0.760, tint(0.22, 0.026), h),
        veil:  lch(0.300, tint(0.55, 0.060), h),
        edge:  lch(0.440, tint(0.60, 0.070), h),
      }
    : {
        cream: lch(0.973, tint(0.16, 0.022), h),
        paper: lch(0.992, tint(0.09, 0.013), h),
        sand:  lch(0.928, tint(0.26, 0.042), h),
        line:  lch(0.878, tint(0.30, 0.052), h),
        ink:   lch(0.245, tint(0.34, 0.048), h),
        soft:  lch(0.520, tint(0.24, 0.038), h),
        veil:  lch(0.955, tint(0.34, 0.055), h),
        edge:  lch(0.845, tint(0.55, 0.080), h),
      };

  const rgb = rgbTriplet(shop);

  /**
   * لون النص فوق التعبئة يُقارَن دائماً بحبر داكن، لا بحبر
   * السكِن. في السكِن الداكن يكون الحبر شبه أبيض، فلو قارنّاه
   * به لاختير الأبيض فوق زر أصفر — وهذا نص غير مقروء.
   */
  const contrastInk = lch(0.22, Math.min(C * 0.34, 0.048), h);

  return {
    '--shop': shop,
    '--shop-deep': shopDeep,
    '--shop-lift': shopLift,
    '--shop-rgb': rgb,
    '--on-shop': onColor(shop, contrastInk),
    '--on-shop-deep': onColor(shopDeep, contrastInk),
    // اللون حين يكون **نصاً** فوق الورق — مقروء دائماً
    '--shop-text': readable(shop, surfaces.paper),

    // أسطح مصبوغة بدرجة اللون — هنا يتحوّل «الموقع كله»
    '--cream': surfaces.cream,
    '--paper': surfaces.paper,
    '--sand':  surfaces.sand,
    '--line':  surfaces.line,
    '--ink':   surfaces.ink,
    '--soft':  surfaces.soft,
    '--shop-veil': surfaces.veil,
    '--shop-edge': surfaces.edge,

    // لون مساعد يحل محل «النحاس» الثابت في هوية المنصة
    '--brass': accent,
    '--brass-deep': lch(dark ? 0.62 : 0.475, Math.max(0.05, Math.min(0.10, C * 0.62)), accentHue),

    // وهج وظلال مشتقة من اللون لا رمادية ميتة
    '--glow': `rgba(${rgb},${dark ? '.30' : '.16'})`,
    '--glow-soft': `rgba(${rgb},${dark ? '.16' : '.07'})`,
    '--shadow': dark
      ? `0 1px 2px rgba(0,0,0,.35), 0 18px 46px -22px rgba(${rgb},.55)`
      : `0 1px 2px rgba(${rgb},.06), 0 18px 40px -20px rgba(${rgb},.30)`,
    '--shadow-lift': dark
      ? `0 24px 60px -22px rgba(0,0,0,.75), 0 0 0 1px rgba(${rgb},.22)`
      : `0 26px 60px -26px rgba(${rgb},.45), 0 2px 6px rgba(${rgb},.08)`,

    '--scheme': dark ? 'dark' : 'light',
  };
}

// ═══ الطبقة والسكِن ══════════════════════════════════════
/**
 * درجة التصميم حسب الباقة (§٢.١).
 * الباقة لا تشتري «عدداً أكبر» فقط بل **مستوى تصميم أعلى**:
 *   نقي   — واجهة صافية صادقة، بلا زخرفة.
 *   دافئ  — تدرّجات، ظلال، ظهور تدريجي، شريط تصنيفات.
 *   فاخر  — وهج محيط، زجاجية، تدرّج على العنوان، وسكِنات.
 */
export const TIERS = {
  basic: { id: 'clean',     name: 'نقي' },
  plus:  { id: 'warm',      name: 'دافئ' },
  pro:   { id: 'signature', name: 'فاخر' },
};

export function tierOf(plan) {
  return TIERS[plan]?.id ?? TIERS.basic.id;
}

/** السكِنات المتاحة — الاختيار حكرٌ على برو (extraThemes) */
export const SKINS = {
  signature: { id: 'signature', name: 'التوقيع',      dark: false, desc: 'اللون على ورق فاتح — الافتراضي الأنيق' },
  editorial: { id: 'editorial', name: 'تحريري',       dark: false, desc: 'مساحات بيضاء واسعة وعناوين كبيرة' },
  midnight:  { id: 'midnight',  name: 'منتصف الليل',  dark: true,  desc: 'أسطح داكنة مصبوغة بلونك مع وهج' },
};

export const skinOf = (theme) => SKINS[theme] ?? SKINS.signature;

/**
 * قوالب الواجهة — بنية الصفحة لا لونها (برو، extraThemes).
 *
 * السكِن يغيّر اللوحة، والقالب يغيّر ما يُعرض وكيف: «التوقيع»
 * واجهة متجر شاملة بشبكة مربّعة، و«أتولييه» واجهة أزياء بصور
 * طولية على عارضات ومقاسات وألوان في الشبكة نفسها. والمحوران
 * مستقلّان: متجر عبايات يختار «أتولييه» ويبقى حراً في سكِنه.
 *
 * ولذلك لا يدخل القالب في paletteFor — قالبٌ يغيّر لوناً واحداً
 * يجعل المحورين محوراً واحداً بأسماء اثنين.
 *
 * الكلمة في الشيفرة layout وفي واجهة التاجر «قالب» — كما أن
 * SKINS معرّفاتها لاتينية وأسماؤها عربية.
 */
export const LAYOUTS = {
  signature: { id: 'signature', name: 'التوقيع', desc: 'واجهة متجر شاملة: هيرو متحرّك وأقسام وعروض وشبكة مربّعة' },
  atelier:   { id: 'atelier',   name: 'أتولييه', desc: 'واجهة أزياء: صور طولية على عارضات، ومقاسات وألوان في الشبكة' },
};

export const layoutOf = (layout) => LAYOUTS[layout] ?? LAYOUTS.signature;

/** اللوحة النهائية لمتجر: تراعي لونه وباقته وسكِنه */
export function paletteFor(store) {
  return derivePalette(store?.color, {
    deep: store?.colorDeep ?? store?.color_deep ?? '',
    dark: skinOf(store?.theme).dark,
  });
}

/** نص CSS جاهز للحقن داخل <style> */
export function paletteCss(palette, selector = ':root') {
  return `${selector}{${Object.entries(palette).map(([k, v]) => `${k}:${v}`).join(';')}}`;
}
