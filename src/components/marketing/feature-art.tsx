import type { ReactNode } from 'react';

/**
 * ═══════════ رسوم بطاقات «ما تحصل عليه» ═══════════
 *
 * ثمانية رسوم متجهية بلغة واحدة: أشكال هندسية، حدّ رفيع
 * موحّد، بلا تدرّجات ولا ظلال، ولون بؤري واحد في كل رسم.
 *
 * ★ لا قيمة HEX واحدة هنا — والسبب ليس أناقة الكود.
 *   لو كُتب `fill="#9E2226"` لتجمّد الرسم على أحمر RVIOS،
 *   بينما `fill-shop` تُكتب inline عند موضع الاستخدام (انظر
 *   تعليق `@theme inline` في globals.css) فتقرأ `--shop`
 *   المحقون. أي أن الرسوم تتبع لوحة كل تاجر تلقائياً — وهو
 *   بالضبط ما تدّعيه البطاقة الثالثة: «لونك يصبغ المتجر كله».
 *
 * والرسوم مخفيّة عن قارئ الشاشة لأن البطاقة تحمل عنوانها
 * ونصّها كاملين — وصفها صوتياً تكرار لا إفادة.
 */
function Frame({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 600 800" aria-hidden focusable="false" className="size-full">
      {children}
    </svg>
  );
}

/* ١ — رابط يخصّك وحدك: مسار واحد من شخص واحد إلى متجر واحد */
export function LinkArt() {
  return (
    <Frame>
      {/* فقاعتا محادثة خافتتان: الرابط يُشارَك، ولا تنافسان المسار */}
      <g className="fill-sand stroke-line" strokeWidth={2}>
        <path d="M 392 330 h 128 a 10 10 0 0 1 10 10 v 74 a 10 10 0 0 1 -10 10 h -84 l -30 30 v -30 h -14 a 10 10 0 0 1 -10 -10 v -74 a 10 10 0 0 1 10 -10 Z" />
        <path d="M 96 486 h 128 a 10 10 0 0 1 10 10 v 74 a 10 10 0 0 1 -10 10 h -14 v 30 l -30 -30 H 96 a 10 10 0 0 1 -10 -10 v -74 a 10 10 0 0 1 10 -10 Z" />
      </g>
      <g className="stroke-line" strokeWidth={2} strokeLinecap="round">
        <path d="M 414 360 h 84 M 414 386 h 56" />
        <path d="M 118 516 h 84 M 118 542 h 56" />
      </g>

      {/* الشريط: خطّ واحد متّصل، لا يتفرّع ولا ينقطع */}
      <path
        className="fill-none stroke-brass"
        strokeWidth={26}
        strokeLinecap="round"
        d="M 300 646 C 300 596 374 588 374 540 C 374 486 224 494 224 442 C 224 392 300 392 300 344"
      />

      {/* المتجر: واجهة بيضاء ومظلّة مموّجة هي اللون البؤري الوحيد */}
      <rect className="fill-cream stroke-line" strokeWidth={3} x={228} y={244} width={144} height={100} rx={10} />
      <path
        className="fill-shop stroke-line"
        strokeWidth={3}
        d="M 226 244 q 14.8 22 29.6 0 q 14.8 22 29.6 0 q 14.8 22 29.6 0 q 14.8 22 29.6 0 q 14.8 22 29.6 0 V 200 H 226 Z"
      />

      {/* صاحب المتجر: نقطة انطلاق واحدة */}
      <circle className="fill-ink" cx={300} cy={690} r={46} />
      <circle className="fill-cream" cx={300} cy={674} r={15} />
      <path className="fill-cream" d="M 274 714 a 26 26 0 0 1 52 0 a 46 46 0 0 1 -52 0 Z" />
    </Frame>
  );
}

/* ٢ — طلباتك عبر واتساب: إيصال مرقّم يدخل محادثة */
export function ChatArt() {
  /* فقاعة وذيل في مسار واحد: لو رُسما شكلين لقطع حدّ الدائرة
     قاعدة الذيل وظهر الوصل خطّاً عارضاً في منتصف الشكل. */
  const bubble = 'M 270 587 A 170 170 0 1 0 153 505 L 120 660 Z';
  return (
    <Frame>
      {/* ثلاث نسخ من المسار نفسه تصنع حلقة: حبر خارجي، ثم كريمي، ثم التعبئة */}
      <path className="fill-none stroke-ink" strokeWidth={30} strokeLinejoin="round" d={bubble} />
      <path className="fill-shop stroke-cream" strokeWidth={22} strokeLinejoin="round" d={bubble} />

      {/* بطاقة الرقم المرجعي: نحاسية، تطلّ من خلف الإيصال */}
      <rect className="fill-brass" x={330} y={228} width={44} height={40} rx={8} />

      {/* الإيصال: حافة سفلية ممزّقة، وأسطر مجرّدة لا حروف */}
      <path
        className="fill-cream stroke-line"
        strokeWidth={3}
        strokeLinejoin="round"
        d="M 348 250 h 124 a 8 8 0 0 1 8 8 v 214 l -20 22 l -20 -22 l -20 22 l -20 -22 l -20 22 l -20 -22 l -20 22 V 258 a 8 8 0 0 1 8 -8 Z"
      />
      <g className="fill-soft">
        <rect x={368} y={318} width={92} height={16} rx={4} />
        <rect x={368} y={356} width={92} height={16} rx={4} />
        <rect x={368} y={394} width={58} height={16} rx={4} />
      </g>
    </Frame>
  );
}

/* ٣ — لونك يصبغ المتجر كله: قطرة واحدة تشتقّ لوحة */
export function ColorArt() {
  /* التدرّجات مشتقّة بالشفافية من اللون نفسه لا بألوان مكتوبة —
     فتبقى العائلة واحدة أياً كان لون التاجر. */
  const tints = ['fill-shop/85', 'fill-shop/58', 'fill-shop/36', 'fill-shop/20'];
  return (
    <Frame>
      <path
        className="fill-shop"
        d="M 300 178 c 42 50 66 80 66 108 a 66 66 0 0 1 -132 0 c 0 -28 24 -58 66 -108 Z"
      />

      {tints.map((tint, i) => (
        <rect
          key={tint}
          className={`${tint} stroke-line`}
          strokeWidth={2.5}
          x={172 - i * 10}
          y={336 + i * 44}
          width={212}
          height={206}
          rx={16}
        />
      ))}

      <g className="stroke-line" strokeWidth={2}>
        <rect className="fill-shop" x={428} y={352} width={44} height={44} rx={5} />
        <rect className="fill-shop/58" x={428} y={412} width={44} height={44} rx={5} />
        <rect className="fill-brass" x={428} y={472} width={44} height={44} rx={5} />
        <rect className="fill-shop/22" x={428} y={532} width={44} height={44} rx={5} />
      </g>
    </Frame>
  );
}

/* ٤ — خيارات لكل منتج: صفّان متاحان وثالث نفد */
export function VariantsArt() {
  return (
    <Frame>
      <path
        className="fill-sand stroke-line"
        strokeWidth={2.5}
        strokeLinejoin="round"
        d="M 190 236 q 0 -20 20 -25 l 56 -13 l 34 44 l 34 -44 l 56 13 q 20 5 20 25 v 200 q 0 14 -16 14 H 206 q -16 0 -16 -14 Z"
      />
      <path
        className="fill-sand stroke-line"
        strokeWidth={2.5}
        strokeLinejoin="round"
        d="M 206 330 h 152 v 84 L 206 386 Z"
      />

      {/* الصفّ المختار وحده أحمر، والصفّ الأخير مؤشّره مفرّغ:
          «مؤشر توفّر صادق» يعني أن يظهر النفاد لا أن يُخفى. */}
      <g strokeWidth={2.5}>
        <rect className="fill-cream stroke-line" x={112} y={486} width={376} height={78} rx={39} />
        <circle className="fill-sand stroke-line" cx={162} cy={525} r={26} />
        <rect className="fill-brass" x={212} y={516} width={158} height={18} rx={5} />
        <circle className="fill-ink" cx={438} cy={525} r={11} />

        <rect className="fill-cream stroke-shop" strokeWidth={4} x={112} y={578} width={376} height={78} rx={39} />
        <circle className="fill-shop" cx={162} cy={617} r={26} />
        <rect className="fill-brass" x={212} y={608} width={140} height={18} rx={5} />
        <circle className="fill-ink" cx={438} cy={617} r={11} />

        <rect className="fill-cream stroke-line" x={112} y={670} width={376} height={78} rx={39} />
        <circle className="fill-soft" cx={162} cy={709} r={26} />
        <rect className="fill-brass-deep" x={212} y={700} width={120} height={18} rx={5} />
        <circle className="fill-none stroke-line" cx={438} cy={709} r={11} />
      </g>
    </Frame>
  );
}

/* ٥ — لوحة تحكّم كاملة: التخطيط نفسه مرّتين، لا منتجان */
export function DashboardArt() {
  return (
    <Frame>
      <g strokeWidth={2.5}>
        <rect className="fill-cream stroke-line" x={56} y={214} width={382} height={254} rx={14} />
        <rect className="fill-sand stroke-line" strokeWidth={2} x={78} y={238} width={338} height={24} rx={6} />
        {[280, 312, 344, 376, 408].map((y) => (
          <rect key={y} className="fill-sand stroke-line" strokeWidth={2} x={78} y={y} width={22} height={22} rx={5} />
        ))}
        {[[118, 280], [278, 280], [118, 366], [278, 366]].map(([x, y]) => (
          <rect
            key={`${x}-${y}`}
            className="fill-sand stroke-line"
            strokeWidth={2}
            x={x}
            y={y}
            width={140}
            height={76}
            rx={8}
          />
        ))}
      </g>

      <g strokeWidth={3}>
        <rect className="fill-cream stroke-line" x={326} y={306} width={196} height={372} rx={32} />
        <rect className="fill-sand stroke-line" strokeWidth={2} x={348} y={332} width={152} height={20} rx={5} />
        <rect className="fill-brass stroke-line" strokeWidth={1.5} x={348} y={368} width={18} height={18} rx={4} />
        {[396, 424, 452].map((y) => (
          <rect key={y} className="fill-sand stroke-line" strokeWidth={1.5} x={348} y={y} width={18} height={18} rx={4} />
        ))}
        {/* البلاطة النشطة وحدها ملوّنة */}
        <rect className="fill-shop stroke-line" strokeWidth={2} x={382} y={368} width={62} height={92} rx={8} />
        <rect className="fill-sand stroke-line" strokeWidth={2} x={454} y={368} width={62} height={92} rx={8} />
        <rect className="fill-sand stroke-line" strokeWidth={2} x={382} y={474} width={62} height={92} rx={8} />
        <rect className="fill-sand stroke-line" strokeWidth={2} x={454} y={474} width={62} height={92} rx={8} />
        <rect className="fill-line" stroke="none" x={388} y={646} width={72} height={5} rx={2.5} />
      </g>
    </Frame>
  );
}

/* ٦ — إحصائيات متجرك: الشكل وحده يحمل المعنى، بلا رقم واحد */
export function StatsArt() {
  const bars = [
    { x: 140, h: 78 },
    { x: 206, h: 122 },
    { x: 272, h: 166 },
    { x: 338, h: 214 },
  ];
  return (
    <Frame>
      <g transform="translate(300 246)">
        <circle className="fill-none stroke-soft" strokeWidth={16} strokeLinecap="round" r={70} />
        <circle
          className="fill-none stroke-brass"
          strokeWidth={16}
          strokeLinecap="round"
          r={70}
          strokeDasharray="132 440"
          strokeDashoffset={62}
          transform="rotate(-90)"
        />
      </g>

      <g strokeWidth={2.5}>
        {bars.map((b) => (
          <rect key={b.x} className="fill-sand stroke-line" x={b.x} y={636 - b.h} width={46} height={b.h} rx={12} />
        ))}
        <rect className="fill-shop stroke-line" x={404} y={368} width={46} height={268} rx={12} />
      </g>

      <path
        className="fill-none stroke-brass"
        strokeWidth={3}
        strokeLinecap="round"
        d="M 163 544 C 200 512 240 470 295 452 C 350 434 395 400 427 352"
      />
      <circle className="fill-brass" cx={427} cy={352} r={7} />
    </Frame>
  );
}

/* ٧ — صور تُرفع مضغوطة: الصورة نفسها تخفّ، لا صورتان */
export function ImagesArt() {
  return (
    <Frame>
      <path
        className="fill-none stroke-line"
        strokeWidth={3}
        strokeLinecap="round"
        d="M 150 452 L 248 300 M 450 452 L 352 300"
      />

      <g className="stroke-sand" strokeWidth={8} strokeLinecap="round">
        <path d="M 132 214 h 46 M 116 250 h 62 M 140 286 h 38" />
      </g>

      <rect className="fill-cream stroke-brass" strokeWidth={3.5} x={244} y={196} width={112} height={88} rx={10} />
      <circle className="fill-sand" cx={272} cy={222} r={9} />
      <path className="fill-sand" d="M 254 272 l 26 -32 l 18 21 l 12 -14 l 28 25 Z" />

      <path
        className="fill-none stroke-shop"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M 428 296 V 208 M 408 228 l 20 -20 l 20 20"
      />

      <rect className="fill-cream stroke-line" strokeWidth={3} x={150} y={468} width={300} height={232} rx={18} />
      <circle className="fill-sand" cx={226} cy={532} r={24} />
      <path className="fill-sand" d="M 172 664 l 74 -88 l 50 58 l 32 -37 l 76 67 Z" />
    </Frame>
  );
}

/* ٨ — أمان ونسخ احتياطي: نسخ متطابقة، وثلاث باقات بوزن واحد */
export function SecurityArt() {
  const shield = 'M -70 -75 C -70 -75, 0 -85, 70 -75 C 70 0, 65 50, 0 85 C -65 50, -70 0, -70 -75 Z';
  return (
    <Frame>
      <defs>
        <marker id="rv-cycle-head" markerWidth={8} markerHeight={8} refX={5} refY={4} orient="auto">
          <path className="fill-shop" d="M 1 1 L 7 4 L 1 7 Z" />
        </marker>
      </defs>

      <g transform="translate(300 350) scale(1.5)">
        <path
          className="fill-none stroke-shop"
          strokeWidth={2.5}
          strokeLinecap="round"
          markerEnd="url(#rv-cycle-head)"
          d="M -110 115 A 160 160 0 1 1 125 98"
        />

        <path
          className="fill-sand stroke-line"
          strokeWidth={2}
          strokeLinejoin="round"
          transform="translate(-24 -26)"
          d={shield}
        />
        <path
          className="fill-sand stroke-line"
          strokeWidth={2}
          strokeLinejoin="round"
          transform="translate(-12 -13)"
          d={shield}
        />
        <path className="fill-cream stroke-ink" strokeWidth={2.5} strokeLinejoin="round" d={shield} />

        <g transform="translate(0 5)">
          <path
            className="fill-none stroke-brass"
            strokeWidth={3.5}
            strokeLinecap="round"
            d="M -13 -4 V -17 A 13 13 0 0 1 13 -17 V -4"
          />
          <rect className="fill-brass" x={-18} y={-4} width={36} height={28} rx={5} />
          <circle className="fill-brass-deep" cx={0} cy={7} r={2.5} />
          <path className="fill-brass-deep" d="M -1.2 7.5 L 1.2 7.5 L 0.8 15 L -0.8 15 Z" />
        </g>

        {/* الباقات الثلاث: مقاس واحد ووزن واحد — لا واحدة تبدو أعلى */}
        <g className="fill-sand stroke-line" strokeWidth={2} transform="translate(0 160)">
          <rect x={-72} y={0} width={36} height={36} rx={8} />
          <rect x={-18} y={0} width={36} height={36} rx={8} />
          <rect x={36} y={0} width={36} height={36} rx={8} />
        </g>
      </g>
    </Frame>
  );
}

/* ٩ — تقييمات عملائك: رأيٌ موثَّق، وردٌّ تحته */
export function ReviewsArt() {
  /* نجمة خماسية بنصف قطر ٢٢ ونسبة داخلية ٠٫٣٨٢ — النسبة الذهبية
     للنجمة المنتظمة. حسابها مرّة هنا أوضح من عشر إحداثيات مكرّرة،
     والتكبير يأتي من `scale` عند الاستعمال لا من عشرة أرقام أخرى. */
  const star =
    'M 0 -22 L 4.94 -6.8 L 20.92 -6.8 L 7.99 2.6 L 12.94 17.8 '
    + 'L 0 8.4 L -12.94 17.8 L -7.99 2.6 L -20.92 -6.8 L -4.94 -6.8 Z';

  return (
    <Frame>
      {/* بطاقة التقييم */}
      <rect className="fill-cream stroke-line" strokeWidth={3} x={60} y={170} width={480} height={290} rx={20} />
      <circle className="fill-sand stroke-line" strokeWidth={2.5} cx={124} cy={240} r={34} />
      <rect className="fill-soft" x={180} y={220} width={170} height={20} rx={5} />
      <rect className="fill-line" x={180} y={254} width={110} height={15} rx={4} />

      {/* أربع نجوم مملوءة وخامسة مفرّغة: التقييم رأيٌ لا امتداح.
          ولو مُلئت الخمس كلها لصار الرسم إعلاناً لا واجهة. */}
      <g transform="translate(0 332)">
        {[0, 1, 2, 3].map((i) => (
          <path key={i} className="fill-brass" transform={`translate(${112 + i * 66} 0) scale(1.2)`} d={star} />
        ))}
        <path className="fill-none stroke-line" strokeWidth={2.6} transform="translate(376 0) scale(1.2)" d={star} />
      </g>

      <g className="fill-sand">
        <rect x={96} y={392} width={408} height={18} rx={4} />
        <rect x={96} y={424} width={262} height={18} rx={4} />
      </g>

      {/* شارة «مشترٍ موثَّق» — اللون البؤري الوحيد. تُحسب من طلب
          حقيقي في قاعدة البيانات، لا يمنحها التاجر لمن يجامله. */}
      <circle className="fill-shop stroke-cream" strokeWidth={7} cx={514} cy={176} r={44} />
      <path
        className="fill-none stroke-cream"
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M 493 176 l 14 15 l 28 -31"
      />

      {/* سهم يهبط من التقييم إلى الردّ.
          كان خيطاً بلون الحدّ ينتهي عند زاوية البطاقة المدوّرة —
          فابتلعته الزاوية واختفى المعنى. صار سهماً بلون النصّ
          الخافت يشير إلى البطاقة من خارجها: الردّ **تحت**
          التقييم وموجَّهٌ إليه، فيُقرأ تابعاً لا تقييماً ثانياً. */}
      <g className="stroke-soft">
        <path
          className="fill-none"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M 505 462 v 30 a 18 18 0 0 1 -18 18 h -14"
        />
        <path className="fill-soft" stroke="none" d="M 477 501 l -15 9 l 15 9 Z" />
      </g>

      {/* ردّ التاجر */}
      <rect className="fill-sand stroke-line" strokeWidth={2.5} x={60} y={506} width={390} height={210} rx={18} />
      <rect className="fill-brass" x={92} y={538} width={52} height={52} rx={13} />
      <rect className="fill-soft" x={162} y={552} width={130} height={18} rx={4} />
      <g className="fill-line">
        <rect x={92} y={628} width={326} height={15} rx={4} />
        <rect x={92} y={660} width={214} height={15} rx={4} />
      </g>
    </Frame>
  );
}
