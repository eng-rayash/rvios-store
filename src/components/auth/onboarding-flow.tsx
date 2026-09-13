'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Copy, ExternalLink, ImagePlus, Loader2 } from 'lucide-react';
import { api, ApiError, messageOf } from '@/lib/api';
import { readImageFile } from '@/lib/image';
import { COUNTRIES, DEFAULT_COUNTRY } from '@/lib/countries';
import { PICKABLE, DEFAULT_SECTOR } from '@/lib/sectors';
import { cn, initial } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { OtpInput, type OtpHandle } from '@/components/ui/otp-input';
import { FlowShell } from '@/components/auth/flow-shell';

/** ألوان مقترحة — والتاجر حرّ في أي لون آخر عبر المنتقي */
const COLORS: [string, string][] = [
  ['#9E2226', '#6E1519'], ['#2F5D50', '#1E3E35'], ['#1F4E79', '#143451'],
  ['#7A4B1E', '#513113'], ['#5B2A6E', '#3C1B49'], ['#A8641B', '#734512'],
  ['#2C2C2C', '#111111'], ['#8C1F4A', '#5E1432'], ['#0F766E', '#0A4F4A'],
  ['#B45309', '#7C3A06'],
];

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** الخطوات بترتيبها — الأخيرة ليست خطوةً تُقطع بل نتيجتها */
const STEPS = ['phone', 'code', 'profile', 'name', 'sector', 'brand', 'product', 'done'] as const;
type Step = (typeof STEPS)[number];

interface Draft {
  phone: string; country: string;
  name: string; slug: string; sector: string; city: string; tagline: string;
  logo: string; color: string; colorDeep: string;
  product: { name: string; price: string; qty: string; image: string };
}

interface Profile {
  fullName?: string; city?: string; address?: string; nationalId?: string;
  businessType?: string; email?: string; emailVerified?: boolean; complete?: boolean;
}

interface GoogleStatus { enabled: boolean; clientId?: string }

type SlugState = { checking: boolean; ok: boolean | null; message: string; suggestion?: string | null };

declare global {
  interface Window {
    google?: { accounts: { id: {
      initialize: (o: Record<string, unknown>) => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
    } } };
  }
}

/**
 * تدفّق إنشاء المتجر.
 *
 * ★ الحالة كلها في الذاكرة، ولا شيء يُكتب قبل الخطوة الأخيرة.
 * المتجر يُنشأ بنداء واحد في النهاية (`POST /api/stores`)، فلا
 * يبقى في القاعدة متجرٌ نصفُ مبنيٍّ لتاجرٍ أغلق الصفحة في
 * منتصف الطريق. والاستثناء الوحيد الملفّ الشخصي: يُحفظ عند
 * تجاوز خطوته لأنه يخصّ التاجر لا المتجر، ويُستأنف منه لاحقاً.
 *
 * ★ والمعاينة تقرأ المسوّدة حرفاً بحرف — وهي وعد صفحة الهبوط
 * نفسه: «المعاينة تتحدّث معك حرفاً بحرف».
 */
export function OnboardingFlow() {
  const params = useSearchParams();
  const adding = params.get('new') === '1';

  const [step, setStep] = useState<Step>('phone');
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const [draft, setDraft] = useState<Draft>({
    phone: '', country: DEFAULT_COUNTRY,
    name: '', slug: '', sector: '', city: '', tagline: '',
    logo: '', color: '#9E2226', colorDeep: '#6E1519',
    product: { name: '', price: '', qty: '5', image: '' },
  });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const [profile, setProfile] = useState<Profile>({});
  const [bizTypes, setBizTypes] = useState<{ id: string; label: string }[]>([]);
  const [google, setGoogle] = useState<GoogleStatus>({ enabled: false });
  const [emailVerified, setEmailVerified] = useState(false);

  const [slug, setSlug] = useState<SlugState>({ checking: false, ok: null, message: '' });
  const [created, setCreated] = useState<{ slug: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const otp = useRef<OtpHandle>(null);

  /* ── اللون القادم من استوديو صفحة الباقات ──
     الزائر اختاره ورأى متجره مصبوغاً به قبل أن يضغط «أنشئ»؛
     وإسقاطه هنا يكسر الوعد الذي قطعته تلك الصفحة. */
  useEffect(() => {
    const c = params.get('color');
    if (c && HEX6.test(c)) {
      const deep = params.get('deep');
      setDraft((d) => ({ ...d, color: c, colorDeep: deep && HEX6.test(deep) ? deep : c }));
    }
  }, [params]);

  /* ── الإقلاع: أين يقف هذا الزائر من الطريق؟ ── */
  useEffect(() => {
    (async () => {
      try {
        const me = await api.get<{
          authenticated: boolean;
          merchant?: { phone: string };
          slots?: { free: number };
          hasStore?: boolean;
          profile?: Profile;
          google?: GoogleStatus;
        }>('/api/auth/me');

        if (!me.authenticated) return;            // زائر جديد — يبدأ من الجوال
        setDraft((d) => ({ ...d, phone: me.merchant?.phone ?? '' }));

        if (adding) {
          /* متجر إضافي: التاجر مسجّل، فتُتخطّى المصادقة والتعريف */
          if ((me.slots?.free ?? 0) > 0) { setStep('name'); return; }
          setError('لا توجد خانة متجر شاغرة — اشترِ خانة من قسم الاشتراك');
          window.setTimeout(() => { window.location.href = '/dashboard'; }, 1800);
          return;
        }

        if (me.hasStore) { window.location.href = '/dashboard'; return; }

        const g = me.google ?? { enabled: false };
        setGoogle(g);
        const needsProfile = !me.profile?.complete || (g.enabled && !me.profile?.emailVerified);
        setStep(needsProfile ? 'profile' : 'name');
      } catch {
        /* زائر جديد — يبدأ من الجوال */
      } finally {
        setBooting(false);
      }
    })();
  }, [adding]);

  /* الملفّ الشخصي يُجلب حين تُفتح خطوته لا قبلها */
  useEffect(() => {
    if (step !== 'profile') return;
    (async () => {
      try {
        const d = await api.get<{
          profile: Profile;
          businessTypes: { id: string; label: string }[];
          google: GoogleStatus;
        }>('/api/me/profile');
        setProfile(d.profile ?? {});
        setBizTypes(d.businessTypes ?? []);
        setGoogle(d.google ?? { enabled: false });
        setEmailVerified(!!d.profile?.emailVerified);
        if (d.profile?.city && !draft.city) set('city', d.profile.city);
      } catch { /* الحقول تبقى فارغة، والتحقّق عند الإرسال */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- يُجلب مرّة عند فتح الخطوة
  }, [step]);

  /* ── فحص الرابط، مؤجَّلاً ٣٢٠ms ── */
  const slugTimer = useRef<number | undefined>(undefined);
  const checkSlug = useCallback((raw: string) => {
    window.clearTimeout(slugTimer.current);
    if (!raw.trim()) { setSlug({ checking: false, ok: null, message: '' }); return; }
    setSlug({ checking: true, ok: null, message: '' });
    slugTimer.current = window.setTimeout(async () => {
      try {
        const res = await api.get<{ ok: boolean; reason: string; slug: string; suggestion?: string | null }>(
          `/api/slug/check?q=${encodeURIComponent(raw)}`,
        );
        setSlug({ checking: false, ok: res.ok, message: res.ok ? 'الرابط متاح' : res.reason, suggestion: res.suggestion });
      } catch (e) {
        setSlug({ checking: false, ok: false, message: messageOf(e) });
      }
    }, 320);
  }, []);

  /* ── زرّ جوجل: يُحمَّل عند الحاجة فقط ──
     سكربت جوجل ثقيل ويتصل بخوادمها، وتحميله في كل زيارة يُبطئ
     خطوةً لا تحتاجه — ويُسرّب زيارة كل من فتح الصفحة إلى جوجل. */
  const gBtn = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (step !== 'profile' || !google.enabled || emailVerified || !gBtn.current) return;

    const render = () => {
      if (!window.google?.accounts?.id || !gBtn.current) return;
      window.google.accounts.id.initialize({
        client_id: google.clientId,
        callback: async ({ credential }: { credential: string }) => {
          try {
            const r = await api.post<{ profile: Profile }>('/api/auth/google', { credential });
            setEmailVerified(true);
            setProfile((p) => ({ ...p, email: r.profile.email, fullName: p.fullName || r.profile.fullName }));
          } catch (e) { setError(messageOf(e)); }
        },
      });
      window.google.accounts.id.renderButton(gBtn.current, {
        theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', locale: 'ar', width: 240,
      });
    };

    if (window.google?.accounts?.id) { render(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = render;
    /* فشل التحميل لا يوقف الإعداد: البيانات وحدها تكفي لفتح
       المتجر، والبريد يبقى قابلاً للتوثيق من اللوحة لاحقاً */
    s.onerror = () => setGoogle({ enabled: false });
    document.head.appendChild(s);
  }, [step, google.enabled, google.clientId, emailVerified]);

  /* ───────── أفعال ───────── */

  async function requestCode() {
    setBusy(true); setError(null);
    try {
      const res = await api.post<{ phone: string; devCode?: string }>('/api/auth/request-code', {
        phone: draft.phone, country: draft.country,
      });
      setDraft((d) => ({ ...d, phone: res.phone }));
      setDevCode(res.devCode ?? null);
      setStep('code');
    } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  }

  async function verify(code: string) {
    setBusy(true); setError(null);
    try {
      const res = await api.post<{ hasStore: boolean }>('/api/auth/verify', { phone: draft.phone, code });
      if (res.hasStore) { window.location.href = '/dashboard'; return; }
      setStep('profile');
    } catch (e) {
      setError(messageOf(e));
      otp.current?.clear();
    } finally { setBusy(false); }
  }

  async function saveProfile() {
    setBusy(true); setError(null);
    try {
      const body = {
        fullName: profile.fullName ?? '',
        city: profile.city ?? '',
        address: profile.address ?? '',
        nationalId: profile.nationalId ?? '',
        businessType: profile.businessType ?? '',
      };
      /* فحصٌ محلي يوفّر رحلة شبكة ويضع الخطأ قرب الحقل — والخادم هو الحَكَم */
      if (body.fullName.trim().split(/\s+/).filter(Boolean).length < 2) throw new Error('اكتب اسمك الثنائي على الأقل');
      if (body.city.trim().length < 2) throw new Error('المدينة مطلوبة');
      if (!body.businessType) throw new Error('اختر نوع نشاطك');
      if (google.enabled && !emailVerified) throw new Error('وثّق بريدك عبر جوجل للمتابعة');

      await api.patch('/api/me/profile', body);
      /* مدينة التاجر تُرشَّح لمدينة المتجر: هما غالباً واحدة،
         وسؤاله مرّتين عن المدينة نفسها يبدو كأننا لم ننصت */
      if (!draft.city) set('city', body.city.trim());
      setStep('name');
    } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  }

  async function createStore(withProduct: boolean) {
    setBusy(true); setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: draft.name.trim(),
        slug: draft.slug,
        sector: draft.sector || DEFAULT_SECTOR,
        city: draft.city.trim(),
        tagline: draft.tagline.trim(),
        logo: draft.logo,
        color: draft.color,
        colorDeep: draft.colorDeep,
        whatsapp: draft.phone,
        /* الدولة تتبع المتجر لا التاجر: عملته وصيغة أرقامه منها،
           وتاجرٌ واحد قد يملك متجرين في بلدين */
        country: draft.country,
      };
      if (withProduct && draft.product.name.trim()) {
        payload.product = {
          name: draft.product.name.trim(),
          price: Number(draft.product.price) || 0,
          qty: Number(draft.product.qty) || 1,
          image: draft.product.image,
        };
      }
      const res = await api.post<{ slug: string }>('/api/stores', payload);
      setCreated({ slug: res.slug, url: `${window.location.origin}/${res.slug}` });
      setStep('done');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NO_STORE_SLOT') {
        setError(`${e.message}`);
      } else {
        setError(messageOf(e));
      }
    } finally { setBusy(false); }
  }

  async function pickImage(kind: 'logo' | 'product', file: File | undefined) {
    if (!file) return;
    try {
      const data = await readImageFile(file, 800);
      if (kind === 'logo') set('logo', data);
      else setDraft((d) => ({ ...d, product: { ...d.product, image: data } }));
    } catch (e) { setError(messageOf(e)); }
  }

  if (booting) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" aria-busy="true" aria-label="جارٍ التحميل">
        <Loader2 className="size-6 animate-spin text-soft" aria-hidden />
      </div>
    );
  }

  const at = STEPS.indexOf(step);

  /* ★ التدفّق يملك القشرة لا العكس.
     المعاينة تقرأ المسوّدة، والمسوّدة تعيش هنا — فلو وضعتها
     الصفحة في العمود الجانبي لعُرضت ساكنةً بلا اسم ولا لون. */
  return (
    <FlowShell
      aside={{
        label: adding ? 'متجرك الجديد' : 'ما تبنيه الآن',
        style: { '--shop': draft.color } as React.CSSProperties,
        plaque: (
          <StoreDraftPreview name={draft.name} tagline={draft.tagline} slug={draft.slug} logo={draft.logo} />
        ),
        note: 'كل ما تكتبه يظهر هنا فوراً — وهكذا سيراه عميلك.',
      }}
    >
      <StepBar at={at} />

      {error && (
        <p role="alert" className="mb-base rounded-sm bg-danger/10 px-base py-2.5 text-sm font-bold text-[#a11]">
          {error}
        </p>
      )}

      {step === 'phone' && (
        <Section kick={adding ? 'متجر إضافي' : 'الخطوة الأولى'} title="ابدأ برقم جوالك"
          lede="رمز تحقّق واحد وتدخل — بلا كلمة مرور وبلا بطاقة بنكية.">
          <Field label="رقم الجوال">
            {(a) => (
              <div dir="ltr" className="flex items-center overflow-hidden rounded-sm border-[1.5px] border-line bg-paper transition-colors focus-within:border-shop focus-within:ring-[3px] focus-within:ring-shop/20">
                <select
                  value={draft.country}
                  onChange={(e) => set('country', e.target.value)}
                  aria-label="رمز الدولة"
                  className="shrink-0 cursor-pointer border-0 bg-sand px-3 py-2.5 text-sm font-bold text-soft focus:outline-none"
                >
                  {Object.values(COUNTRIES).map((c) => <option key={c.code} value={c.code}>+{c.dial}</option>)}
                </select>
                <Input {...a} type="tel" inputMode="numeric" autoComplete="tel" placeholder="٧٧٧ ١٢٣ ٤٥٦"
                  value={draft.phone} onChange={(e) => set('phone', e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && draft.phone) void requestCode(); }}
                  className="rounded-none border-0 bg-transparent tabular focus-visible:ring-0" />
              </div>
            )}
          </Field>
          <Actions>
            <Button busy={busy} disabled={!draft.phone} onClick={requestCode} icon={<ArrowLeft className="size-4" />}>
              أرسل رمز التحقّق
            </Button>
            <a href="/login" className="text-sm font-bold text-soft underline underline-offset-[3px] hover:text-ink">
              لديّ متجر — سجّل دخولي
            </a>
          </Actions>
        </Section>
      )}

      {step === 'code' && (
        <Section kick="تحقّق" title="أدخل رمز التحقّق"
          lede={<>أرسلنا رمزاً من ٦ أرقام إلى <b dir="ltr" className="inline-block tabular text-ink">+{draft.phone}</b>.</>}>
          <OtpInput ref={otp} onComplete={verify} disabled={busy} />
          {devCode && (
            <p className="mt-3 text-xs font-bold text-ok">
              وضع التطوير — الرمز: <span dir="ltr" className="tabular">{devCode}</span>
            </p>
          )}
          <Actions>
            <Button tone="ghost" size="sm" disabled={busy} onClick={() => { setStep('phone'); setError(null); }}>
              تغيير الرقم
            </Button>
          </Actions>
        </Section>
      )}

      {step === 'profile' && (
        <Section kick="تعريف" title="عرِّفنا بنفسك"
          lede="المتجر يبيع باسمك، وهذه البيانات ما نحتكم إليه عند أي نزاع مع عميل.">
          {google.enabled && (
            <div className="mb-base flex flex-wrap items-center gap-base rounded-sm border-[1.5px] border-line bg-paper px-4 py-3.5">
              <div className="min-w-[150px] flex-1">
                <b className="block text-sm">توثيق البريد</b>
                <small className="text-2xs leading-body text-soft">يُسرّع منح شارة «موثَّق» لمتجرك.</small>
              </div>
              {emailVerified
                ? <span className="flex items-center gap-1.5 text-xs font-bold text-ok" dir="ltr">
                    <Check className="size-4" aria-hidden />{profile.email}
                  </span>
                : <div ref={gBtn} />}
            </div>
          )}

          <Field label="الاسم الكامل">
            {(a) => <Input {...a} autoComplete="name" placeholder="مثال: يزن أحمد الشرعبي"
              value={profile.fullName ?? ''} onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))} />}
          </Field>
          <div className="grid gap-x-base sm:grid-cols-2">
            <Field label="المدينة">
              {(a) => <Input {...a} autoComplete="address-level2" placeholder="مثال: صنعاء"
                value={profile.city ?? ''} onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))} />}
            </Field>
            <Field label="نوع النشاط">
              {(a) => (
                <Select {...a} value={profile.businessType ?? ''}
                  onChange={(e) => setProfile((p) => ({ ...p, businessType: e.target.value }))}>
                  <option value="">اختر…</option>
                  {bizTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </Select>
              )}
            </Field>
          </div>
          <Field label="العنوان" hint="الحي، الشارع، أقرب معلم">
            {(a) => <Input {...a} autoComplete="street-address"
              value={profile.address ?? ''} onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))} />}
          </Field>
          <Field label="رقم الهوية" hint="اختياري — يُسرّع منح شارة «موثَّق»">
            {(a) => <Input {...a} dir="ltr" spellCheck={false}
              value={profile.nationalId ?? ''} onChange={(e) => setProfile((p) => ({ ...p, nationalId: e.target.value }))} />}
          </Field>
          <Actions>
            <Button busy={busy} onClick={saveProfile} icon={<ArrowLeft className="size-4" />}>متابعة</Button>
          </Actions>
        </Section>
      )}

      {step === 'name' && (
        <Section kick="متجرك" title="ما اسم متجرك؟"
          lede="الاسم يظهر لعميلك، والرابط هو ما تشاركه — ويمكن تغييرهما لاحقاً.">
          <Field label="اسم المتجر">
            {(a) => (
              <Input {...a} autoComplete="organization" placeholder="مثال: متجر ذو يزن للعطور"
                value={draft.name}
                onChange={(e) => {
                  set('name', e.target.value);
                  if (!draft.slug) checkSlug(e.target.value);
                }} />
            )}
          </Field>
          <Field
            label="رابط المتجر"
            error={slug.ok === false ? slug.message : null}
            hint={slug.checking ? 'جارٍ الفحص…' : slug.ok ? 'الرابط متاح' : 'حروف لاتينية وأرقام وشرطات'}
          >
            {(a) => (
              <div dir="ltr" className="flex items-center overflow-hidden rounded-sm border-[1.5px] border-line bg-paper transition-colors focus-within:border-shop focus-within:ring-[3px] focus-within:ring-shop/20">
                <span className="shrink-0 bg-sand px-3 py-2.5 text-sm text-soft">rviosstore.com/</span>
                <Input {...a} spellCheck={false} placeholder="yazan" value={draft.slug}
                  onChange={(e) => { set('slug', e.target.value); checkSlug(e.target.value); }}
                  className="rounded-none border-0 bg-transparent focus-visible:ring-0" />
                {slug.checking && <Loader2 className="me-2 size-4 shrink-0 animate-spin text-soft" aria-hidden />}
              </div>
            )}
          </Field>
          {slug.suggestion && slug.ok === false && (
            <button type="button" onClick={() => { set('slug', slug.suggestion!); checkSlug(slug.suggestion!); }}
              className="-mt-2 mb-base text-xs font-bold text-shop-text underline underline-offset-2">
              جرّب «{slug.suggestion}»
            </button>
          )}
          <Actions>
            <Button disabled={!draft.name.trim() || slug.ok !== true} onClick={() => setStep('sector')}
              icon={<ArrowLeft className="size-4" />}>
              متابعة
            </Button>
          </Actions>
        </Section>
      )}

      {step === 'sector' && (
        <Section kick="نشاطك" title="ما نوع نشاطك؟" lede="يحدّد كيف يُعرض متجرك في صفحة القطاعات.">
          <ul className="mb-base grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {PICKABLE.map((s) => {
              const on = draft.sector === s.id;
              return (
                <li key={s.id}>
                  <button type="button" aria-pressed={on} onClick={() => set('sector', s.id)}
                    className={cn(
                      'w-full rounded-sm border-[1.5px] px-3 py-3 text-center text-sm font-bold transition-colors',
                      on ? 'border-shop bg-shop-veil text-shop-text' : 'border-line bg-paper hover:border-brass',
                    )}>
                    {s.name}
                  </button>
                </li>
              );
            })}
          </ul>
          <Field label="مدينة المتجر">
            {(a) => <Input {...a} placeholder="صنعاء" value={draft.city} onChange={(e) => set('city', e.target.value)} />}
          </Field>
          <Actions>
            <Button disabled={!draft.sector} onClick={() => setStep('brand')} icon={<ArrowLeft className="size-4" />}>
              متابعة
            </Button>
            <BackLink onClick={() => setStep('name')} />
          </Actions>
        </Section>
      )}

      {step === 'brand' && (
        <Section kick="الهوية" title="هوية متجرك"
          lede="اللون الواحد يُشتقّ منه المتجر كله — أسطحه وحدوده ونصوصه، لا أزراره وحدها.">
          <ImageDrop label="الشعار" hint="PNG أو JPG" value={draft.logo} onPick={(f) => pickImage('logo', f)} />

          <fieldset className="mb-base">
            <legend className="mb-1.5 text-xs font-bold">لون المتجر</legend>
            <ul className="flex flex-wrap gap-2.5">
              {COLORS.map(([c, deep]) => {
                const on = draft.color.toLowerCase() === c.toLowerCase();
                return (
                  <li key={c}>
                    <button type="button" aria-label={`اللون ${c}`} aria-pressed={on}
                      onClick={() => setDraft((d) => ({ ...d, color: c, colorDeep: deep }))}
                      style={{ background: c }}
                      className={cn('size-9 rounded-full outline-offset-2 transition-transform',
                        on ? 'scale-[1.08] outline-2 outline-ink' : 'outline-1 outline-line hover:scale-105')} />
                  </li>
                );
              })}
            </ul>
          </fieldset>

          <Field label="لون مخصّص">
            {(a) => (
              <div className="flex items-center gap-2.5">
                <input type="color" aria-label="منتقي اللون" value={draft.color}
                  onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value, colorDeep: e.target.value }))}
                  className="h-10 w-12 shrink-0 cursor-pointer rounded-sm border-[1.5px] border-line bg-paper p-0.5" />
                <Input {...a} dir="ltr" maxLength={7} value={draft.color}
                  onChange={(e) => set('color', e.target.value.replace(/^(?!#)/, '#'))}
                  className="font-en uppercase tracking-wider" />
              </div>
            )}
          </Field>

          <Field label="وصف مختصر" hint="سطرٌ يظهر تحت اسم متجرك">
            {(a) => <Input {...a} maxLength={120} placeholder="عطور شرقية وفرنسية أصلية"
              value={draft.tagline} onChange={(e) => set('tagline', e.target.value)} />}
          </Field>

          <Actions>
            <Button onClick={() => setStep('product')} icon={<ArrowLeft className="size-4" />}>متابعة</Button>
            <SkipLink onClick={() => setStep('product')}>تخطّي</SkipLink>
            <BackLink onClick={() => setStep('sector')} />
          </Actions>
        </Section>
      )}

      {step === 'product' && (
        <Section kick="أول منتج" title="أضف أول منتج"
          lede="يمكنك تخطّيها وإضافة منتجاتك من اللوحة — لكن متجراً بمنتج واحد جاهزٌ للمشاركة الآن.">
          <ImageDrop label="صورة المنتج" hint="يُفضّل صورة مربّعة" value={draft.product.image}
            onPick={(f) => pickImage('product', f)} />
          <Field label="اسم المنتج">
            {(a) => <Input {...a} placeholder="عطر عود رويال" value={draft.product.name}
              onChange={(e) => setDraft((d) => ({ ...d, product: { ...d.product, name: e.target.value } }))} />}
          </Field>
          <div className="grid gap-x-base sm:grid-cols-2">
            <Field label="السعر">
              {(a) => <Input {...a} type="number" inputMode="numeric" min={0} className="tabular" placeholder="25000"
                value={draft.product.price}
                onChange={(e) => setDraft((d) => ({ ...d, product: { ...d.product, price: e.target.value } }))} />}
            </Field>
            <Field label="الكمية">
              {(a) => <Input {...a} type="number" inputMode="numeric" min={0} className="tabular"
                value={draft.product.qty}
                onChange={(e) => setDraft((d) => ({ ...d, product: { ...d.product, qty: e.target.value } }))} />}
            </Field>
          </div>
          <Actions>
            <Button busy={busy} onClick={() => createStore(true)}>أنشئ متجري</Button>
            <SkipLink onClick={() => createStore(false)}>تخطّي وأنشئ المتجر</SkipLink>
            <BackLink onClick={() => setStep('brand')} />
          </Actions>
        </Section>
      )}

      {step === 'done' && created && (
        <Section kick="تمّ" title="متجرك جاهز" lede="شاركه في حالة واتساب أو وصف حسابك، وستصلك الطلبات هنا.">
          <div dir="ltr" className="mb-base flex flex-wrap items-center gap-snug rounded-sm border-[1.5px] border-line bg-paper px-4 py-3">
            <span className="flex-1 text-sm break-all">
              rviosstore.com/<b className="text-shop-text">{created.slug}</b>
            </span>
            <Button tone="line" size="sm" icon={<Copy className="size-3.5" />}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(created.url);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1800);
                } catch { /* الحافظة محجوبة — الرابط ظاهرٌ ليُنسخ يدوياً */ }
              }}>
              {copied ? 'نُسخ ✓' : 'نسخ'}
            </Button>
          </div>
          <span aria-live="polite" className="sr-only">{copied ? 'نُسخ رابط متجرك' : ''}</span>
          <Actions>
            <Button onClick={() => { window.location.href = '/dashboard'; }}>إلى لوحة التحكم</Button>
            <a href={`/${created.slug}`} target="_blank" rel="noopener"
              className="flex items-center gap-1.5 text-sm font-bold text-soft underline underline-offset-[3px] hover:text-ink">
              <ExternalLink className="size-3.5" aria-hidden />
              افتح متجرك
            </a>
          </Actions>
        </Section>
      )}
    </FlowShell>
  );
}

/* ───────────────────────────────────────────────────────── */

/** شريط الخطوات — يقول «أين أنا ومتى ينتهي هذا» */
function StepBar({ at }: { at: number }) {
  const total = STEPS.length - 1;   // «تمّ» نتيجة لا خطوة
  if (at >= total) return null;
  return (
    <div className="mb-8 flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={total}
      aria-valuenow={at + 1} aria-label={`الخطوة ${at + 1} من ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} aria-hidden
          className={cn('h-[3px] flex-1 rounded-sm transition-colors duration-500',
            i <= at ? 'bg-shop' : 'bg-line')} />
      ))}
    </div>
  );
}

function Section({ kick, title, lede, children }: {
  kick: string; title: string; lede?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section>
      <p className="mb-2 text-xs font-bold tracking-[.6px] text-brass-deep">{kick}</p>
      <h1 className="font-display text-h1 leading-tight font-bold">{title}</h1>
      {lede && <p className="mt-2.5 mb-6 text-md leading-loose text-soft">{lede}</p>}
      {children}
    </section>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex flex-wrap items-center gap-3">{children}</div>;
}

function SkipLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="text-sm font-bold text-soft underline underline-offset-[3px] hover:text-ink">
      {children}
    </button>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-sm text-soft hover:text-ink">
      رجوع
    </button>
  );
}

function ImageDrop({ label, hint, value, onPick }: {
  label: string; hint: string; value?: string; onPick: (f: File | undefined) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="mb-base">
      <p className="mb-1.5 text-xs font-bold">{label}</p>
      <button type="button" onClick={() => ref.current?.click()}
        className="flex w-full flex-col items-center gap-1.5 rounded-sm border-[1.5px] border-dashed border-line bg-paper px-base py-4 transition-colors hover:border-shop">
        {value
          /* eslint-disable-next-line @next/next/no-img-element -- dataURL محلية قبل الرفع */
          ? <img src={value} alt="" className="max-h-20 rounded-sm object-contain" />
          : <ImagePlus className="size-5 text-soft" aria-hidden />}
        <small className="text-2xs text-soft">{value ? 'غيّرها' : hint}</small>
      </button>
      <input ref={ref} type="file" accept="image/*" hidden
        onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}

/**
 * اللوح المعلّق — يعرض المتجر وهو يُبنى.
 *
 * يُصدَّر ليضعه `page.tsx` في عمود `FlowShell` الجانبي. ولأن
 * المسوّدة تعيش في هذا المكوّن، تُمرَّر القيم إليه من الأب.
 */
export function StoreDraftPreview({ name, tagline, slug, logo }: {
  name: string; tagline: string; slug: string; logo: string;
}) {
  return (
    <>
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-shop font-display text-lg text-on-shop">
          {logo
            /* eslint-disable-next-line @next/next/no-img-element -- dataURL محلية */
            ? <img src={logo} alt="" className="size-full object-cover" />
            : initial(name || 'متجرك')}
        </span>
        <span className="min-w-0">
          <b className="block truncate font-display text-xl">{name || 'اسم متجرك'}</b>
          {tagline && <small className="block truncate text-xs text-soft">{tagline}</small>}
        </span>
      </div>
      <hr className="my-3.5 border-0 border-t border-line" />
      <p dir="ltr" className="truncate text-start text-xs text-soft">
        rviosstore.com/<b className="font-bold text-shop-text">{slug || '…'}</b>
      </p>
    </>
  );
}
