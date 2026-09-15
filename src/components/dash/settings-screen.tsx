'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BadgeCheck, ImagePlus, Loader2 } from 'lucide-react';
import { api, ApiError, messageOf } from '@/lib/api';
import { readImageFile } from '@/lib/image';
import { COUNTRIES } from '@/lib/countries';
import { PICKABLE } from '@/lib/sectors';
import { paletteFor, paletteStyle, tierOf, type Layout, type Skin } from '@/lib/theme';
import { cn, initial } from '@/lib/utils';
import { Plaque } from '@/components/ui/plaque';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Field, Input, Select } from '@/components/ui/field';
import { useDash, useStore, type Store } from '@/components/dash/dash-context';

/** ألوان مقترحة — والتاجر حرّ في أي لون آخر عبر المنتقي */
const COLORS: [string, string][] = [
  ['#9E2226', '#6E1519'], ['#2F5D50', '#1E3E35'], ['#1F4E79', '#143451'],
  ['#7A4B1E', '#513113'], ['#5B2A6E', '#3C1B49'], ['#A8641B', '#734512'],
  ['#2C2C2C', '#111111'], ['#8C1F4A', '#5E1432'], ['#0F766E', '#0A4F4A'],
  ['#B45309', '#7C3A06'],
];

const HEX6 = /^#[0-9A-Fa-f]{6}$/;
const TIER_NAME: Record<string, string> = { clean: 'نقي', warm: 'دافئ', signature: 'فاخر' };

interface StoreRes {
  store: Store;
  plan: { id: string; name: string; extraThemes?: boolean };
  skins: Skin[];
  layouts: Layout[];
}

type SlugState = { checking: boolean; ok: boolean | null; message: string; suggestion?: string | null };

/**
 * شاشة إعدادات المتجر.
 *
 * ★ المعاينة تقرأ **المسوّدة** لا المحفوظ.
 * التاجر يغيّر لونه فيرى متجره يتغيّر قبل أن يحفظ — وهذا وحده ما
 * يجعل اختيار اللون قراراً لا مقامرة. والمعاينة تُصبغ بلوحة
 * التاجر كاملةً (`paletteFor`)، بينما تبقى بقيّة اللوحة على هوية
 * RVIOS — فالصبغ محصور في العنصر المُعايَن وحده.
 *
 * ★ ولا يُرسَل إلى الخادم إلا ما تغيّر فعلاً.
 * `PATCH` يتعامل مع كل مفتاح موجود، وإرسال الحقول كلها في كل حفظ
 * يعني إعادة رفع الشعار والغلاف وصورة العرض بلا سبب — ميجابايتات
 * على شبكة يمنية، ومعالجة صور في الخادم لصورة لم تتغيّر.
 */
export function SettingsScreen() {
  const { store: saved, plan } = useStore();
  const { reloadStore } = useDash();

  const [meta, setMeta] = useState<{ skins: Skin[]; layouts: Layout[]; extraThemes: boolean } | null>(null);
  const [draft, setDraft] = useState<Partial<Store>>({});
  const [images, setImages] = useState<{ logo?: string; banner?: string; showcase?: string }>({});
  const [slug, setSlug] = useState<SlugState>({ checking: false, ok: null, message: '' });
  const [busy, setBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  /** القيمة المعروضة: المسوّدة إن مُسّت، وإلا المحفوظ */
  const v = <K extends keyof Store>(k: K): Store[K] => (k in draft ? (draft[k] as Store[K]) : saved[k]);
  const set = <K extends keyof Store>(k: K, value: Store[K]) => setDraft((d) => ({ ...d, [k]: value }));

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<StoreRes>('/api/me/store');
        setMeta({
          skins: res.skins ?? [],
          layouts: res.layouts ?? [],
          extraThemes: !!res.plan?.extraThemes,
        });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) { window.location.href = '/login'; return; }
        setError(messageOf(e));
      }
    })();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  /* ★ فحص الرابط مؤجَّل ٣٢٠ms: كل ضغطة مفتاح نداءٌ للخادم بلا
     تأجيل، و«mystore» وحدها سبعة نداءات لجواب واحد. */
  const slugTimer = useRef<number | undefined>(undefined);
  const checkSlug = useCallback((raw: string) => {
    window.clearTimeout(slugTimer.current);
    if (!raw.trim() || raw === saved.slug) {
      setSlug({ checking: false, ok: null, message: '' });
      return;
    }
    setSlug({ checking: true, ok: null, message: 'جارٍ الفحص…' });
    slugTimer.current = window.setTimeout(async () => {
      try {
        const res = await api.get<{ ok: boolean; reason: string; suggestion?: string | null }>(
          `/api/slug/check?q=${encodeURIComponent(raw)}`,
        );
        setSlug({ checking: false, ok: res.ok, message: res.ok ? 'الرابط متاح' : res.reason, suggestion: res.suggestion });
      } catch (e) {
        setSlug({ checking: false, ok: false, message: messageOf(e) });
      }
    }, 320);
  }, [saved.slug]);

  async function pickImage(kind: 'logo' | 'banner' | 'showcase', file: File | undefined) {
    if (!file) return;
    const maxSide = kind === 'logo' ? 400 : kind === 'banner' ? 1600 : 1400;
    try {
      /* ★ القراءة أوّلاً ثم التحديث: `setImages` تأخذ دالّةً
         متزامنة، و`await` داخلها ليست انتظاراً بل خطأ صياغة. */
      const data = await readImageFile(file, maxSide);
      setImages((p) => ({ ...p, [kind]: data }));
    } catch (e) {
      setError(messageOf(e));
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { ...draft, ...images };
      /* اللون العميق يُشتقّ مع اللون — الخادم يقبلهما معاً */
      if (draft.color && !draft.colorDeep) {
        payload.colorDeep = COLORS.find(([c]) => c === draft.color)?.[1] ?? draft.color;
      }
      if (!Object.keys(payload).length) { setNotice('لا تغييرات لتُحفظ'); return; }
      if (payload.slug && slug.ok === false) throw new Error(slug.message);

      await api.patch('/api/me/store', payload);
      setDraft({});
      setImages({});
      setSlug({ checking: false, ok: null, message: '' });
      setNotice('حُفظت التغييرات');
      await reloadStore();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  async function requestVerify() {
    setVerifyBusy(true);
    setError(null);
    try {
      const res = await api.post<{ message: string }>('/api/me/requests', { kind: 'verify', detail: '' });
      setNotice(res.message);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setVerifyBusy(false);
    }
  }

  const dirty = Object.keys(draft).length > 0 || Object.keys(images).length > 0;
  const tier = tierOf(saved.plan);

  /* لوحة المعاينة من المسوّدة — لا من المحفوظ */
  const preview = paletteFor({
    color: v('color'),
    colorDeep: v('colorDeep'),
    plan: saved.plan,
    theme: v('theme'),
    layout: v('layout'),
  });

  return (
    <div className="space-y-base pb-24">
      <p role="status" className={cn(notice ? 'rounded-sm bg-ok/10 px-base py-2.5 text-sm font-bold text-[#1f6b40]' : 'sr-only')}>
        {notice}
      </p>
      {error && <p role="alert" className="rounded-sm bg-danger/10 px-base py-2.5 text-sm font-bold text-[#a11]">{error}</p>}

      <div className="grid items-start gap-base lg:grid-cols-2">
        {/* ═══ العمود الأول ═══ */}
        <div className="space-y-base">
          <Section title="هوية المتجر">
            <Field label="اسم المتجر">
              {(a) => <Input {...a} value={v('name') ?? ''} onChange={(e) => set('name', e.target.value)} maxLength={60} />}
            </Field>

            <Field label="وصف مختصر" hint="سطرٌ يظهر تحت اسم متجرك">
              {(a) => <Input {...a} value={v('tagline') ?? ''} onChange={(e) => set('tagline', e.target.value)} maxLength={120} />}
            </Field>

            <Field label="نبذة عن المتجر" hint="تظهر في قسم «قصة المتجر»">
              {(a) => (
                <textarea
                  {...a}
                  value={v('about') ?? ''}
                  onChange={(e) => set('about', e.target.value)}
                  maxLength={600}
                  rows={3}
                  className="w-full resize-y rounded-sm border-[1.5px] border-line bg-paper px-3 py-2.5 leading-body transition-colors focus-visible:border-shop focus-visible:ring-[3px] focus-visible:ring-shop/20 focus-visible:outline-none"
                />
              )}
            </Field>

            <Field label="القطاع" hint="يحدّد كيف يُعرض متجرك في صفحة القطاعات">
              {(a) => (
                <Select {...a} value={v('sector') ?? ''} onChange={(e) => set('sector', e.target.value)}>
                  <option value="">— اختر —</option>
                  {PICKABLE.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              )}
            </Field>

            <Field
              label="رابط المتجر"
              error={slug.ok === false ? slug.message : null}
              hint={
                slug.checking ? 'جارٍ الفحص…'
                  : slug.ok ? 'الرابط متاح'
                    : 'تغييره يُبقي الرابط القديم يعمل بتحويل تلقائي'
              }
            >
              {(a) => (
                <div dir="ltr" className="flex items-center overflow-hidden rounded-sm border-[1.5px] border-line bg-paper transition-colors focus-within:border-shop focus-within:ring-[3px] focus-within:ring-shop/20">
                  <span className="shrink-0 bg-sand px-3 py-2.5 text-sm text-soft">rviosstore.com/</span>
                  <Input
                    {...a}
                    value={v('slug') ?? ''}
                    onChange={(e) => { set('slug', e.target.value); checkSlug(e.target.value); }}
                    className="rounded-none border-0 bg-transparent focus-visible:ring-0"
                  />
                  {slug.checking && <Loader2 className="me-2 size-4 shrink-0 animate-spin text-soft" aria-hidden />}
                </div>
              )}
            </Field>

            {slug.suggestion && slug.ok === false && (
              <button
                type="button"
                onClick={() => { set('slug', slug.suggestion!); checkSlug(slug.suggestion!); }}
                className="-mt-2 mb-base text-xs font-bold text-shop-text underline underline-offset-2"
              >
                جرّب «{slug.suggestion}»
              </button>
            )}

            <div className="grid gap-base sm:grid-cols-3">
              <ImageField label="الشعار" hint="PNG أو JPG" value={images.logo ?? saved.logo} onPick={(f) => pickImage('logo', f)} />
              <ImageField label="صورة الغلاف" hint="يُفضّل ١٤٠٠×٣٥٠" value={images.banner ?? saved.banner} onPick={(f) => pickImage('banner', f)} />
              <ImageField label="صورة العرض" hint="تظهر في «قصة المتجر»" value={images.showcase ?? saved.showcase} onPick={(f) => pickImage('showcase', f)} />
            </div>
          </Section>

          <Section title="الهوية البصرية" aside={<Badge tone="brass" dot={false}>درجة {TIER_NAME[tier] ?? tier}</Badge>}>
            <fieldset className="mb-base">
              <legend className="mb-1.5 text-xs font-bold">اللون الأساسي</legend>
              <p className="mb-2.5 text-2xs leading-body text-soft">
                اللون الواحد يُشتقّ منه المتجر كله — الأسطح والحدود والنصوص والظلال، لا الأزرار وحدها.
              </p>
              <ul className="flex flex-wrap gap-2.5">
                {COLORS.map(([c, deep]) => {
                  const on = (v('color') ?? '').toLowerCase() === c.toLowerCase();
                  return (
                    <li key={c}>
                      <button
                        type="button"
                        onClick={() => { set('color', c); set('colorDeep', deep); }}
                        aria-label={`اللون ${c}`}
                        aria-pressed={on}
                        style={{ background: c }}
                        className={cn(
                          'size-9 rounded-full outline-offset-2 transition-transform',
                          on ? 'outline-2 outline-ink scale-[1.08]' : 'outline-1 outline-line hover:scale-105',
                        )}
                      />
                    </li>
                  );
                })}
              </ul>
            </fieldset>

            <Field label="لون مخصّص" hint="الدرجة الغامقة تُشتقّ تلقائياً">
              {(a) => (
                <div className="flex items-center gap-2.5">
                  <input
                    type="color"
                    aria-label="منتقي اللون"
                    value={v('color') ?? '#9E2226'}
                    onChange={(e) => set('color', e.target.value)}
                    className="h-10 w-12 shrink-0 cursor-pointer rounded-sm border-[1.5px] border-line bg-paper p-0.5"
                  />
                  <Input
                    {...a}
                    dir="ltr"
                    value={v('color') ?? ''}
                    maxLength={7}
                    onChange={(e) => {
                      const t = e.target.value.replace(/^(?!#)/, '#');
                      set('color', t);
                    }}
                    onBlur={(e) => { if (!HEX6.test(e.target.value)) set('color', saved.color); }}
                    className="font-en uppercase tracking-wider"
                  />
                </div>
              )}
            </Field>

            {meta && meta.skins.length > 0 && (
              <ChoiceGrid
                label="سكِن الواجهة"
                locked={!meta.extraThemes}
                lockedHint="السكِنات الإضافية متاحة في باقة برو"
                options={meta.skins.map((s) => ({ id: s.id, name: s.name, desc: s.dark ? 'أسطح داكنة' : 'أسطح فاتحة' }))}
                value={v('savedTheme') ?? v('theme') ?? 'signature'}
                onChange={(id) => set('theme', id)}
              />
            )}

            {meta && meta.layouts.length > 0 && (
              <ChoiceGrid
                label="قالب الواجهة"
                locked={!meta.extraThemes}
                lockedHint="القوالب الإضافية متاحة في باقة برو"
                options={meta.layouts.map((l) => ({ id: l.id, name: l.name, desc: l.desc }))}
                value={v('savedLayout') ?? v('layout') ?? 'signature'}
                onChange={(id) => set('layout', id)}
              />
            )}
          </Section>
        </div>

        {/* ═══ العمود الثاني ═══ */}
        <div className="space-y-base">
          <Section title="معاينة حيّة">
            <StorePreview
              palette={preview}
              name={v('name') ?? saved.name}
              tagline={v('tagline') ?? ''}
              slug={v('slug') ?? saved.slug}
              logo={images.logo ?? saved.logo}
              banner={images.banner ?? saved.banner}
            />
          </Section>

          <Section title="التواصل والاستلام">
            <Field label="الدولة" hint="تحدّد عملة الأسعار وصيغة أرقام الجوال">
              {(a) => (
                <Select {...a} value={v('country') ?? ''} onChange={(e) => set('country', e.target.value)}>
                  {Object.values(COUNTRIES).map((c) => (
                    <option key={c.code} value={c.code}>{c.name} (+{c.dial})</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="رقم واتساب المتجر">
              {(a) => <Input {...a} dir="ltr" type="tel" className="tabular" value={v('whatsapp') ?? ''} onChange={(e) => set('whatsapp', e.target.value)} />}
            </Field>
            <Field label="المدينة">
              {(a) => <Input {...a} value={v('city') ?? ''} onChange={(e) => set('city', e.target.value)} maxLength={40} />}
            </Field>
            <Field label="العنوان">
              {(a) => <Input {...a} value={v('address') ?? ''} onChange={(e) => set('address', e.target.value)} maxLength={120} />}
            </Field>
            <Field label="أوقات العمل">
              {(a) => <Input {...a} placeholder="السبت – الخميس: ٩ص – ٩م" value={v('hours') ?? ''} onChange={(e) => set('hours', e.target.value)} maxLength={120} />}
            </Field>
          </Section>

          <Section title="توثيق المتجر" aside={saved.verified ? <Badge tone="ok">موثَّق</Badge> : <Badge tone="done">غير موثَّق</Badge>}>
            {saved.verified ? (
              <p className="text-sm leading-loose text-soft">
                متجرك موثَّق — تظهر الشارة بجوار اسمه في المتجر وفي صفحة المنصة.
              </p>
            ) : (
              <>
                <p className="mb-base text-sm leading-loose text-soft">
                  الشارة تُطمئن عميلاً لم يشترِ منك من قبل. نراجع طلبك ونتواصل معك على رقم واتساب متجرك.
                </p>
                <Button tone="line" busy={verifyBusy} onClick={requestVerify} icon={<BadgeCheck className="size-4" />}>
                  اطلب التوثيق
                </Button>
              </>
            )}
          </Section>
        </div>
      </div>

      {/* ★ شريط حفظ لاصق: النموذج أطول من الشاشة، وزرٌّ في أسفله
          يعني أن التاجر يمرّر شاشتين ليحفظ تغييراً في أوّل حقل. */}
      <div className="fixed inset-x-0 bottom-0 z-[var(--z-header)] border-t border-line bg-cream/95 px-base py-3 backdrop-blur-md lg:pb-3 lg:ps-[264px]">
        <div className="mx-auto flex max-w-[min(1180px,100%)] items-center gap-snug pb-[max(0px,env(safe-area-inset-bottom))] max-lg:mb-16">
          <p className="flex-1 text-xs text-soft">
            {dirty ? 'لديك تغييرات غير محفوظة' : 'كل شيء محفوظ'}
          </p>
          <Button busy={busy} disabled={!dirty} onClick={save}>حفظ التغييرات</Button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────── */

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Plaque as="section" className="overflow-hidden">
      <header className="flex items-center gap-snug border-b border-line px-5 py-3.5">
        <h2 className="font-heading flex-1 text-md font-bold">{title}</h2>
        {aside}
      </header>
      <div className="px-5 py-4">{children}</div>
    </Plaque>
  );
}

function ImageField({
  label, hint, value, onPick,
}: { label: string; hint: string; value?: string | null; onPick: (f: File | undefined) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="mb-base">
      <p className="mb-1.5 text-xs font-bold">{label}</p>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex w-full flex-col items-center gap-1.5 rounded-sm border-[1.5px] border-dashed border-line bg-paper px-3 py-3 transition-colors hover:border-shop"
      >
        {value
          /* eslint-disable-next-line @next/next/no-img-element -- قد تكون dataURL قبل الرفع */
          ? <img src={value} alt="" className="max-h-16 rounded-sm object-contain" />
          : <ImagePlus className="size-5 text-soft" aria-hidden />}
        <small className="text-2xs text-soft">{value ? 'غيّرها' : hint}</small>
      </button>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}

function ChoiceGrid({
  label, options, value, onChange, locked, lockedHint,
}: {
  label: string;
  options: { id: string; name: string; desc: string }[];
  value: string;
  onChange: (id: string) => void;
  locked: boolean;
  lockedHint: string;
}) {
  return (
    <fieldset className="mb-base">
      <legend className="mb-1.5 text-xs font-bold">{label}</legend>
      <ul className="grid gap-2 sm:grid-cols-3">
        {options.map((o) => {
          const on = value === o.id;
          const disabled = locked && o.id !== 'signature';
          return (
            <li key={o.id}>
              <button
                type="button"
                disabled={disabled}
                aria-pressed={on}
                onClick={() => onChange(o.id)}
                className={cn(
                  'w-full rounded-sm border-[1.5px] px-3 py-2.5 text-start transition-colors',
                  on ? 'border-shop bg-shop-veil' : 'border-line bg-paper enabled:hover:border-brass',
                  disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <b className="block text-sm">{o.name}</b>
                <small className="block text-2xs leading-body text-soft">{o.desc}</small>
              </button>
            </li>
          );
        })}
      </ul>
      {locked && <p className="mt-1.5 text-2xs text-soft">{lockedHint}</p>}
    </fieldset>
  );
}

/**
 * واجهة متجر مصغّرة تُصبغ بلوحة التاجر وحدها.
 *
 * ★ ليست لقطةً للمتجر بل **إعلانُ ما نَعِد به**: هيدر واسم وهيرو
 * وبطاقتان وزرّ. ولا ترسم ما لا يُنفَّذ — فالتاجر لا يُفاجأ حين
 * يفتح متجره الحقيقي.
 */
function StorePreview({
  palette, name, tagline, slug, logo, banner,
}: {
  palette: Record<string, string>;
  name: string;
  tagline: string;
  slug: string;
  logo?: string | null;
  banner?: string | null;
}) {
  return (
    <div
      style={paletteStyle(palette)}
      className="overflow-hidden rounded-lg border border-line"
    >
      <div className="flex items-center gap-2.5 border-b border-line bg-cream px-3 py-2.5">
        <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-sm bg-shop font-display text-md text-on-shop">
          {logo
            /* eslint-disable-next-line @next/next/no-img-element -- معاينة محلية */
            ? <img src={logo} alt="" className="size-full object-cover" />
            : initial(name)}
        </span>
        <b className="min-w-0 flex-1 truncate font-display text-lg text-ink">{name}</b>
        <span className="size-5 rounded-sm border border-line" aria-hidden />
      </div>

      <div className="relative grid h-24 place-items-center overflow-hidden bg-gradient-to-b from-sand to-cream">
        {banner && (
          /* eslint-disable-next-line @next/next/no-img-element -- معاينة محلية */
          <img src={banner} alt="" className="absolute inset-0 size-full object-cover" />
        )}
        <div className="relative z-1 px-3 text-center">
          <p className="font-display text-xl leading-tight text-ink">{name}</p>
          {tagline && <p className="mt-0.5 text-2xs text-soft">{tagline}</p>}
        </div>
      </div>

      <div className="bg-cream px-3 py-3">
        <div className="mb-2.5 flex gap-1.5" aria-hidden>
          <i className="h-4 flex-1 rounded-pill bg-shop" />
          <i className="h-4 flex-1 rounded-pill border border-line bg-paper" />
          <i className="h-4 flex-1 rounded-pill border border-line bg-paper" />
        </div>
        <div className="grid grid-cols-2 gap-2" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="rounded-sm border border-line bg-paper p-1.5 text-center">
              <span className="mb-1.5 block h-10 rounded-sm bg-sand" />
              <small className="block text-[9px] text-soft">منتج</small>
              <b className="block font-display text-sm text-shop-text">١٢٬٥٠٠</b>
            </div>
          ))}
        </div>
        <div className="mt-2.5 rounded-sm bg-shop py-2 text-center text-2xs font-bold text-on-shop">أضف للسلة</div>
      </div>

      <div dir="ltr" className="bg-ink px-3 py-2 text-center text-[10px] text-cream/80">
        rviosstore.com/<b className="text-brass">{slug}</b>
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="grid gap-base lg:grid-cols-2" aria-busy="true" aria-label="جارٍ التحميل">
      <Skeleton className="h-96 rounded-lg" />
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}
