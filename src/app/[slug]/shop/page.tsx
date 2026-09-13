import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { resolveStore, storeCatalogue, storeZones } from '@/lib/store';
import { paletteFor, paletteStyle, tierOf, skinOf, layoutOf } from '@/lib/theme';
import { ProShell } from '@/components/store/pro/pro-shell';
import { ProShop, type ShopQuery } from '@/components/store/pro/pro-shop';
import { AtelierShell } from '@/components/store/atelier/atelier-shell';
import { AtelierShop, type AtelierQuery } from '@/components/store/atelier/atelier-shop';

/**
 * صفحة المتجر — `rviosstore.com/{slug}/shop`.
 *
 * حكرٌ على درجة «فاخر»: المتاجر الأدنى تعرض كل منتجاتها في صفحة
 * واحدة أصلاً، وصفحة ترشيحٍ لخمسة عشر منتجاً زينةٌ لا فائدة.
 * والطلب على هذا المسار في متجر أدنى يُحوَّل إلى واجهته بدل أن
 * يُقابَل بـ٤٠٤ — الرابط قد يكون مشاركاً من متجرٍ خُفِّضت باقته.
 *
 * الترشيح يُقرأ من الرابط على الخادم لتُصيَّر أول شبكة مرشَّحة
 * فعلاً: رابطٌ مشارَك لفئة معيّنة يجب أن يفتح على تلك الفئة، لا
 * أن يعرض كل شيء ثم يقفز.
 */
export const revalidate = 60;

type Params = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const found = await resolveStore(decodeURIComponent(slug));
  if (found.kind !== 'ok') return { title: 'متجر غير موجود' };

  const s = found.store;
  return {
    title: { absolute: `المتجر — ${s.name}` },
    description: s.tagline || `تصفّح كل منتجات ${s.name}`,
    alternates: { canonical: `/${s.slug}/shop` },
  };
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
const num = (v: string | string[] | undefined) => {
  const n = Number(one(v));
  return one(v) !== '' && Number.isFinite(n) ? n : null;
};

export default async function ShopPage({ params, searchParams }: Params) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const found = await resolveStore(decodeURIComponent(slug));

  if (found.kind === 'moved') permanentRedirect(`/${found.to}/shop`);
  if (found.kind === 'none') notFound();

  const store = found.store;
  const tier = tierOf(store.plan);
  if (tier !== 'signature') redirect(`/${store.slug}`);

  const [{ products, categories, brands }, zones] = await Promise.all([
    storeCatalogue(store.id),
    storeZones(store.id),
  ]);

  const sorts = ['new', 'cheap', 'dear', 'rated', 'off'] as const;
  const asked = one(sp.sort);

  // مرشّحٌ في الرابط لم يعد موجوداً في الكتالوج (فئة حُذفت أو
  // ماركة لم تعد تُباع) يُهمَل بصمت — أفضل من شبكة فارغة بمرشّح
  // لا يعرف الزائر كيف يزيله لأنه لا يظهر له اسم
  const askedCat = num(sp.cat);

  const layout = layoutOf(store.layout).id;

  /**
   * المقاس واللون يُقرآن من الرابط كما هما، ويُصفّيهما المكوّن
   * على ما يوجد في الكتالوج فعلاً — بالقاعدة نفسها التي تُهمل
   * فئةً حُذفت: مرشّحٌ بلا مصدر يسقط بصمت بدل شبكة فارغة.
   */
  if (layout === 'atelier') {
    const wanted: AtelierQuery = {
      q: one(sp.q),
      cat: categories.some((c) => c.id === askedCat) ? askedCat : null,
      sizes: many(sp.size),
      colors: many(sp.color),
      min: num(sp.min),
      max: num(sp.max),
      deals: one(sp.deals) === '1',
      wish: one(sp.wish) === '1',
      sort: (['new', 'cheap', 'dear', 'off'] as readonly string[]).includes(asked)
        ? (asked as AtelierQuery['sort'])
        : 'new',
    };

    return (
      <div style={paletteStyle(paletteFor(store))} data-skin={skinOf(store.theme).id} data-layout={layout}>
        <AtelierShell
          store={store} categories={categories} brands={brands} zones={zones} active="shop"
        >
          <AtelierShop products={products} initial={wanted} />
        </AtelierShell>
      </div>
    );
  }

  const initial: ShopQuery = {
    q: one(sp.q),
    cat: categories.some((c) => c.id === askedCat) ? askedCat : null,
    brands: many(sp.brand).filter((b) => brands.some((x) => x.name === b)),
    min: num(sp.min),
    max: num(sp.max),
    rating: Math.min(5, Math.max(0, num(sp.rating) ?? 0)),
    deals: one(sp.deals) === '1',
    wish: one(sp.wish) === '1',
    sort: (sorts as readonly string[]).includes(asked)
      ? (asked as ShopQuery['sort'])
      : 'new',
  };

  return (
    <div style={paletteStyle(paletteFor(store))} data-skin={skinOf(store.theme).id} data-layout={layout}>
      <ProShell
        store={store} categories={categories} brands={brands} zones={zones} active="shop"
      >
        <ProShop products={products} initial={initial} />
      </ProShell>
    </div>
  );
}
