import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { resolveStore, storeCatalogue, storeZones } from '@/lib/store';
import { paletteFor, paletteStyle, tierOf, skinOf, layoutOf } from '@/lib/theme';
import { Storefront } from '@/components/store/storefront';
import { ProShell } from '@/components/store/pro/pro-shell';
import { ProHome } from '@/components/store/pro/pro-home';
import { AtelierShell } from '@/components/store/atelier/atelier-shell';
import { AtelierHome } from '@/components/store/atelier/atelier-home';

/**
 * واجهة المتجر — `rviosstore.com/{slug}`.
 *
 * تُصيَّر على الخادم كاملةً، واللوحة اللونية تُحقن في نفس
 * التصيير. هذا ليس تحسيناً بل شرط: لو حُقن اللون بعد التحميل
 * لرأى العميل ومضة بألوان المنصة قبل ألوان المتجر — وهي أول
 * انطباع، وأسوأ ما يمكن أن يبدأ به متجرٌ يبيع هويته.
 *
 * ولأنها مُصيَّرة من الخادم، تقرأها معاينة واتساب ومحرّكات
 * البحث كاملةً — وهو ما يجعل مشاركة الرابط تعمل أصلاً.
 */
export const revalidate = 60;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const found = await resolveStore(decodeURIComponent(slug));
  if (found.kind !== 'ok') return { title: 'متجر غير موجود' };

  const s = found.store;
  const desc = s.tagline || s.about?.slice(0, 150) || `تسوّق من ${s.name} عبر RVIOS Store`;
  const image = s.showcase || s.banner || s.logo || undefined;

  return {
    title: { absolute: `${s.name} — متجر إلكتروني` },
    description: desc,
    openGraph: {
      type: 'website',
      title: s.name,
      description: desc,
      ...(image ? { images: [image] } : {}),
    },
    alternates: { canonical: `/${s.slug}` },
  };
}

export default async function StorePage({ params }: Params) {
  const { slug } = await params;
  const found = await resolveStore(decodeURIComponent(slug));

  // الرابط القديم يظل يعمل ويحوّل إلى الجديد — فلا يخسر التاجر
  // ما نشره في مئة محادثة حين يغيّر اسم متجره (§٣.٢)
  if (found.kind === 'moved') permanentRedirect(`/${found.to}`);
  if (found.kind === 'none') notFound();

  const store = found.store;
  const [{ products, categories, brands }, zones] = await Promise.all([
    storeCatalogue(store.id),
    storeZones(store.id),
  ]);

  const palette = paletteFor(store);
  const tier = tierOf(store.plan) as 'clean' | 'warm' | 'signature';
  const skin = skinOf(store.theme);
  // القالب مُنزَّل إلى «التوقيع» في resolveStore حين لا تسمح
  // الباقة، ودرجة «فاخر» أدناه قفلٌ ثانٍ بلا كلفة
  const layout = layoutOf(store.layout).id;

  return (
    <div style={paletteStyle(palette)} data-skin={skin.id} data-layout={layout}>
      {/*
        «فاخر» ليست الواجهة نفسها بلون آخر بل واجهةٌ أخرى: صفحة
        أولى تُقنع وصفحة متجرٍ تُتصفَّح، وشريط تنقّل يربطهما. وهذا
        ما تشتريه باقة برو — والدرجتان الأدنى تبقيان كما هما.

        وهي اليوم **قالبان** لا قالب: «التوقيع» متجرٌ عام،
        و«أتولييه» واجهة أزياء بصور طولية ومقاسات في الشبكة.
        البنية واحدة والسجلّ مختلف، والتاجر يبدّل بينهما من لوحته.
      */}
      {tier === 'signature' ? (
        layout === 'atelier' ? (
          <AtelierShell
            store={store} categories={categories} brands={brands} zones={zones} active="home"
          >
            <AtelierHome products={products} />
          </AtelierShell>
        ) : (
          <ProShell
            store={store} categories={categories} brands={brands} zones={zones} active="home"
          >
            <ProHome products={products} />
          </ProShell>
        )
      ) : (
        <Storefront store={store} products={products} categories={categories} zones={zones} tier={tier} />
      )}

      {/* Schema.org — يجعل نتيجة البحث تعرض المتجر لا رابطاً أصمّ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Store',
            name: store.name,
            description: store.tagline || store.about || undefined,
            image: store.logo || store.banner || undefined,
            // الرقم مخزَّن E.164 فلا يُسبق برمز دولة ثانٍ
            ...(store.whatsapp ? { telephone: `+${store.whatsapp}` } : {}),
            ...(store.city ? { address: { '@type': 'PostalAddress', addressLocality: store.city } } : {}),
          }),
        }}
      />
    </div>
  );
}
