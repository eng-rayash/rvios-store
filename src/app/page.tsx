import { showcaseStores } from '@/lib/showcase';
import { Header } from '@/components/site/header';
import { Footer } from '@/components/site/footer';
import { LandingChrome } from '@/components/site/landing-chrome';
import { Hero } from '@/components/marketing/hero';
import { ParallaxSeam } from '@/components/marketing/parallax-seam';
import {
  StoresStrip, Steps, Features, Devices, Sectors,
  Pricing, Comparison, Addons, FaqSection, ClosingCta,
} from '@/components/marketing/sections';

/**
 * الصفحة الرئيسية — صفحة هبوط واحدة مكتملة.
 *
 * القرار: كل ما يحتاجه التاجر ليقرّر موجود هنا بالترتيب الذي
 * يقرّر به فعلاً — يرى المنصة تعمل، يفهم كيف يبدأ، يرى ما
 * سيحصل عليه، ثم يرى السعر وقد أُجيب عن أسئلته قبله. والصفحات
 * المنفصلة (الباقات، القطاعات، عن المنصة) تبقى للتعمّق ولمن
 * يصل إليها من بحث أو رابط مباشر — لا لأن الرئيسية ناقصة.
 *
 * وتُصيَّر على الخادم ببيانات حقيقية: المتاجر في المشهد متاجر
 * تعمل على المنصة الآن، ومنتجاتها منتجاتها. هذا ليس تفصيلاً
 * تقنياً بل هو الحجّة نفسها — منافسونا يعرضون معاينات لأنظمة
 * اشتروها من غيرهم، ونحن نعرض ما بنيناه وهو يعمل.
 */
export const revalidate = 300;   // خمس دقائق تكفي: المتاجر لا تتبدّل بالثانية

export default async function HomePage() {
  const stores = await showcaseStores(8);

  // متجر واحد يكفي الآن: المشهد صار مجسّماً، ولم يبقَ للمتجر
  // المتصدّر إلا أن يُسمّي بطاقات الإشعار الطائرة فوقه بعملته
  // الصحيحة. واستعلاما المنتجات اللذان كانا يغذّيان الجهازين
  // حُذفا — استعلامان أقل عند كل إعادة تصيير.
  const lead = stores.find((s) => s.verified) ?? stores[0] ?? null;

  return (
    <>
      <LandingChrome />
      <Header />

      <main>
        {/* ١ · المشهد: المنتج نفسه قبل أي جملة عنه */}
        <Hero stores={stores} lead={lead} />

        {/* وصلة: عمق يفصل المشهد عن برهانه بلا قسم جديد يُقرأ */}
        <ParallaxSeam />

        {/* ٢ · برهان: متاجر حقيقية تعمل الآن */}
        <StoresStrip stores={stores} />

        {/* ٣ · الطريق: ثلاث محطّات لا أكثر */}
        <Steps />

        {/* ٤ · ما يحتويه المتجر فعلاً */}
        <Features />

        {/* ٥ · وأنه يعمل من الجهاز الذي بيده الآن */}
        <Devices />

        {/* ٦ · أياً كان مجاله */}
        <Sectors />

        {/* ٧ · السعر، ثم المقارنة لمن يوازن، ثم ما هو خارج الاشتراك */}
        <Pricing />
        <Comparison />
        <Addons />

        {/* ٨ · آخر اعتراض، ثم الدعوة */}
        <FaqSection />
        <ClosingCta />
      </main>

      <Footer />
    </>
  );
}
