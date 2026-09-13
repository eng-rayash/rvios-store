'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BadgeCheck, Check, CreditCard, Receipt, Upload } from 'lucide-react';
import { api, ApiError, messageOf } from '@/lib/api';
import { readImageFile } from '@/lib/image';
import { when } from '@/lib/format';
import { ar, cn, plural } from '@/lib/utils';
import { Plaque } from '@/components/ui/plaque';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet } from '@/components/ui/sheet';
import { Field, Input } from '@/components/ui/field';
import { useDash, useStore } from '@/components/dash/dash-context';

interface ServerPlan {
  id: string;
  name: string;
  desc: string;
  products: number | null;
  price: number | null;
  features: string[];
  missing?: string[];
  design: { id: string; name: string; desc: string };
}

interface Addon { id: string; name: string; kind: string; desc: string }

interface PlanRes {
  current: ServerPlan;
  all: ServerPlan[];
  addons: Addon[];
  capacity: { used: number; label: string };
  verified: boolean;
}

interface Invoice {
  id: number;
  ref: string;
  kind: string;
  plan: string | null;
  months: number;
  amount: number;
  currency: string;
  status: 'unpaid' | 'under_review' | 'paid' | 'void';
  method: string | null;
  created_at: string;
}

interface PayMethod { id: string; name: string; scope: string; instructions: string }

interface BillingRes {
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: string | null;
    daysLeft: number | null;
    effectivePlan?: string;
    graceDays?: number;
  };
  methods: PayMethod[];
  yearlyMonthsFree: number;
  invoices: Invoice[];
  hidden: number;
  products: { used: number; limit: number | null };
}

const INVOICE_STATUS: Record<Invoice['status'], { label: string; tone: BadgeTone }> = {
  unpaid: { label: 'بانتظار التحويل', tone: 'wait' },
  under_review: { label: 'قيد المراجعة', tone: 'wait' },
  paid: { label: 'مدفوعة', tone: 'ok' },
  void: { label: 'ملغاة', tone: 'off' },
};

/**
 * شاشة الاشتراك والفوترة.
 *
 * ★ الفاتورة المفتوحة أوّل ما يُرى — لا آخر ما يُبحث عنه.
 * التاجر الذي رقّى باقته ثم أغلق اللوحة يعود بسؤال واحد: أين
 * أحوّل وبأي مرجع؟ فالفاتورة وتعليمات التحويل ومكان رفع الإيصال
 * في مكان واحد أعلى الشاشة، لا موزّعة على ثلاثة أقسام.
 *
 * ★ ولا بوابة دفع: المنصة تعطي مرجعاً وتعليمات، والتاجر يحوّل
 * بنفسه ويرفع الإيصال. وهذا قرار المنتج لا نقصٌ في التنفيذ —
 * السوق يعمل بالمحافظ والتحويل البنكي.
 */
export function PlanScreen() {
  const { store } = useStore();
  const { reloadStore } = useDash();

  const [plans, setPlans] = useState<PlanRes | null>(null);
  const [billing, setBilling] = useState<BillingRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const [months, setMonths] = useState(1);
  const [proofFor, setProofFor] = useState<Invoice | null>(null);
  const [requesting, setRequesting] = useState<Addon | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, b] = await Promise.all([
        api.get<PlanRes>('/api/me/plan'),
        api.get<BillingRes>('/api/me/billing'),
      ]);
      setPlans(p);
      setBilling(b);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { window.location.href = '/login'; return; }
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(t);
  }, [notice]);

  async function upgrade(planId: string) {
    setBusy(planId);
    setError(null);
    try {
      await api.post('/api/me/billing/invoices', { kind: 'subscription', plan: planId, months });
      setNotice('أُنشئت فاتورتك — حوّل المبلغ وارفع الإيصال لتُفعَّل الباقة فوراً');
      await load();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(null);
    }
  }

  async function request(addon: Addon, detail: string) {
    setBusy(addon.id);
    setError(null);
    try {
      const res = await api.post<{ message: string }>('/api/me/requests', { kind: addon.id, detail });
      setNotice(res.message);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(null);
      setRequesting(null);
    }
  }

  async function requestVerify() {
    setBusy('verify');
    setError(null);
    try {
      const res = await api.post<{ message: string }>('/api/me/requests', { kind: 'verify', detail: '' });
      setNotice(res.message);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <PlanSkeleton />;
  if (!plans || !billing) {
    return (
      <p role="alert" className="rounded-sm bg-danger/10 px-base py-2.5 text-sm font-bold text-[#a11]">
        {error ?? 'تعذّر تحميل بيانات الاشتراك'}
      </p>
    );
  }

  const sub = billing.subscription;
  const open = billing.invoices.find((i) => i.status === 'unpaid' || i.status === 'under_review');
  const downgraded = sub.effectivePlan && sub.effectivePlan !== sub.plan;
  const cur = store.currency;

  return (
    <div className="space-y-base">
      <p role="status" className={cn(notice ? 'rounded-sm bg-ok/10 px-base py-2.5 text-sm leading-body font-bold text-[#1f6b40]' : 'sr-only')}>
        {notice}
      </p>
      {error && <p role="alert" className="rounded-sm bg-danger/10 px-base py-2.5 text-sm font-bold text-[#a11]">{error}</p>}

      {/* ── الباقة الحالية ── */}
      <Plaque as="section" aria-labelledby="cur-h" crest className="px-5 py-4">
        <h2 id="cur-h" className="text-md font-bold">باقتك الحالية</h2>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-base gap-y-1">
          <p className="text-stat leading-tight font-semibold">{plans.current.name}</p>
          <p className="text-sm text-soft">{plans.capacity.label}</p>
          {sub.daysLeft !== null && sub.plan !== 'basic' && (
            <p className={cn('text-sm', sub.daysLeft <= 7 ? 'font-bold text-warn' : 'text-soft')}>
              {sub.daysLeft > 0
                ? `تبقّى ${ar(sub.daysLeft)} ${plural(sub.daysLeft, ['يوم', 'يومان', 'أيام', 'يوماً'])}`
                : 'انتهت مدّة اشتراكك'}
            </p>
          )}
        </div>

        {downgraded && (
          <p className="mt-2.5 rounded-sm bg-warn/12 px-3.5 py-2.5 text-xs leading-loose text-[#8a5d05]">
            اشتراكك منتهٍ، ومتجرك يعمل الآن بحدود الباقة <b>{sub.effectivePlan}</b>.
            {billing.hidden > 0 && (
              <> و<b>{ar(billing.hidden)} {plural(billing.hidden, ['منتج مخفي', 'منتجان مخفيان', 'منتجات مخفيّة', 'منتجاً مخفياً'])}</b> بسبب الحدّ — تعود فور التجديد، ولم يُحذف شيء.</>
            )}
          </p>
        )}

        {!plans.verified && (
          <div className="mt-3 flex flex-wrap items-center gap-snug border-t border-line pt-3">
            <p className="flex-1 text-xs leading-loose text-soft">
              <b className="text-ink">شارة التوثيق</b> تُطمئن عميلاً لم يشترِ منك من قبل.
            </p>
            <Button tone="line" size="sm" busy={busy === 'verify'} onClick={requestVerify} icon={<BadgeCheck className="size-3.5" />}>
              اطلب التوثيق
            </Button>
          </div>
        )}
      </Plaque>

      {/* ── فاتورة مفتوحة ── */}
      {open && (
        <Plaque as="section" aria-labelledby="inv-h" rail className="mt-4 px-5 pt-5 pb-4">
          <div className="flex flex-wrap items-baseline gap-x-base gap-y-1">
            <h2 id="inv-h" className="text-md font-bold">فاتورة بانتظار التحويل</h2>
            <Badge tone={INVOICE_STATUS[open.status].tone}>{INVOICE_STATUS[open.status].label}</Badge>
            <p className="ms-auto text-stat leading-tight font-semibold tabular">
              {ar(open.amount)} <span className="text-xs font-normal text-soft">{open.currency}</span>
            </p>
          </div>

          <ol className="mt-base space-y-base">
            <Step n={1} title="حوّل المبلغ بإحدى هذه الوسائل">
              {billing.methods.length ? (
                <ul className="space-y-2">
                  {billing.methods.map((m) => (
                    <li key={m.id} className="rounded-sm border border-line bg-paper px-3.5 py-2.5">
                      <b className="block text-sm">{m.name}</b>
                      <p className="mt-0.5 text-xs leading-loose whitespace-pre-line text-soft">{m.instructions}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-soft">تواصل معنا عبر واتساب لنرسل لك تعليمات التحويل.</p>
              )}
            </Step>

            <Step n={2} title="اكتب هذا المرجع في ملاحظات التحويل">
              <CopyRow value={open.ref} />
            </Step>

            <Step n={3} title="ارفع صورة الإيصال">
              <Button size="sm" icon={<Upload className="size-3.5" />} onClick={() => setProofFor(open)}>
                ارفع الإيصال
              </Button>
              <p className="mt-1.5 text-2xs text-soft">تُفعَّل باقتك فور الرفع، ونراجع الإيصال خلال يوم عمل.</p>
            </Step>
          </ol>
        </Plaque>
      )}

      {/* ── الباقات ── */}
      <section aria-labelledby="plans-h" className="space-y-snug">
        <div className="flex flex-wrap items-center gap-snug">
          <h2 id="plans-h" className="flex-1 text-md font-bold">الباقات</h2>
          <div role="group" aria-label="مدّة الاشتراك" className="flex gap-2">
            {[{ m: 1, label: 'شهري' }, { m: 12, label: 'سنوي' }].map((o) => (
              <button
                key={o.m}
                type="button"
                aria-pressed={months === o.m}
                onClick={() => setMonths(o.m)}
                className={cn(
                  'rounded-pill border px-3.5 py-1.5 text-sm font-bold transition-colors',
                  months === o.m ? 'border-ink bg-ink text-cream' : 'border-line bg-paper text-soft hover:border-ink hover:text-ink',
                )}
              >
                {o.label}
                {o.m === 12 && billing.yearlyMonthsFree > 0 && (
                  <span className={cn('ms-1.5 text-2xs', months === o.m ? 'text-brass' : 'text-brass-deep')}>
                    {ar(billing.yearlyMonthsFree)} {plural(billing.yearlyMonthsFree, ['شهر', 'شهران', 'أشهر', 'شهراً'])} مجاناً
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-base lg:grid-cols-3">
          {plans.all.map((p) => {
            const on = p.id === plans.current.id;
            return (
              <Plaque key={p.id} as="article" crest={on} className={cn('flex flex-col px-5 py-4', on && 'lg:-my-1')}>
                <div className="flex items-baseline gap-snug">
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  {on && <Badge tone="brass" dot={false}>باقتك</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-soft">{p.desc}</p>

                <p className="mt-3 text-stat leading-tight font-semibold tabular">
                  {p.price === null
                    ? <span className="text-md font-normal text-soft">السعر عند الطلب</span>
                    : p.price === 0
                      ? 'مجاناً'
                      : <>{ar(p.price * (months === 12 ? 12 - billing.yearlyMonthsFree : 1))}{' '}
                          <span className="text-xs font-normal text-soft">{cur} / {months === 12 ? 'سنة' : 'شهر'}</span></>}
                </p>

                <ul className="mt-3 flex-1 space-y-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2 text-sm">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-ok" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>

                {!on && p.price !== 0 && (
                  <Button
                    block
                    className="mt-4"
                    busy={busy === p.id}
                    disabled={!!open}
                    title={open ? 'لديك فاتورة مفتوحة — أكملها أولاً' : undefined}
                    onClick={() => upgrade(p.id)}
                  >
                    رقِّ إلى {p.name}
                  </Button>
                )}
              </Plaque>
            );
          })}
        </div>
      </section>

      {/* ── خدمات إضافية ── */}
      <Plaque as="section" aria-labelledby="addons-h" className="overflow-hidden">
        <header className="border-b border-line px-5 py-3.5">
          <h2 id="addons-h" className="text-md font-bold">خدمات إضافية</h2>
          <p className="mt-0.5 text-xs text-soft">خارج الاشتراك — تُطلب مرّةً ونتواصل معك.</p>
        </header>
        <ul className="divide-y divide-line">
          {plans.addons.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-base gap-y-2 px-5 py-3.5">
              <span className="min-w-0 flex-1">
                <b className="block text-sm">{a.name}</b>
                <small className="block text-xs leading-body text-soft">{a.desc}</small>
              </span>
              <Badge tone="done" dot={false}>{a.kind}</Badge>
              <Button tone="line" size="sm" onClick={() => setRequesting(a)}>اطلبها</Button>
            </li>
          ))}
        </ul>
      </Plaque>

      {/* ── سجل الفواتير ── */}
      <Plaque as="section" aria-labelledby="hist-h" className="overflow-hidden">
        <header className="border-b border-line px-5 py-3.5">
          <h2 id="hist-h" className="text-md font-bold">سجل الفواتير</h2>
        </header>
        {billing.invoices.length ? (
          <ul className="divide-y divide-line">
            {billing.invoices.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-x-base gap-y-1.5 px-5 py-3">
                <bdi className="text-sm font-semibold tabular text-shop-text">{i.ref}</bdi>
                <span className="min-w-0 flex-1 text-xs text-soft">
                  {i.plan ? `اشتراك ${i.plan}` : i.kind}
                  {i.months > 1 && ` · ${ar(i.months)} ${plural(i.months, ['شهر', 'شهران', 'أشهر', 'شهراً'])}`}
                </span>
                <Badge tone={INVOICE_STATUS[i.status].tone}>{INVOICE_STATUS[i.status].label}</Badge>
                <span className="whitespace-nowrap text-sm font-semibold tabular">
                  {ar(i.amount)} <span className="text-2xs font-normal text-soft">{i.currency}</span>
                </span>
                <time dateTime={i.created_at} className="text-2xs text-soft">{when(i.created_at)}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-center text-sm text-soft">لا فواتير بعد.</p>
        )}
      </Plaque>

      <ProofSheet
        invoice={proofFor}
        methods={billing.methods}
        onClose={() => setProofFor(null)}
        onDone={async (message) => {
          setProofFor(null);
          setNotice(message);
          await Promise.all([load(), reloadStore()]);
        }}
      />

      <RequestSheet
        addon={requesting}
        busy={busy !== null}
        onClose={() => setRequesting(null)}
        onSend={(detail) => requesting && request(requesting, detail)}
      />
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
      <span className="grid size-7 place-items-center rounded-full bg-shop text-xs font-extrabold text-on-shop tabular">
        {ar(n)}
      </span>
      <div>
        <h3 className="mb-1.5 text-sm font-bold">{title}</h3>
        {children}
      </div>
    </li>
  );
}

/** صفٌّ يُنسخ بضغطة — التاجر يفتح تطبيق محفظته في نافذة أخرى */
function CopyRow({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-snug rounded-sm border border-line bg-sand px-3.5 py-2.5">
      <bdi className="flex-1 text-lg font-bold tabular">{value}</bdi>
      <Button
        tone="line"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          } catch { /* الحافظة محجوبة — المرجع ظاهرٌ ليُكتب يدوياً */ }
        }}
      >
        {copied ? 'نُسخ ✓' : 'انسخ'}
      </Button>
      <span aria-live="polite" className="sr-only">{copied ? 'نُسخ المرجع' : ''}</span>
    </div>
  );
}

function ProofSheet({
  invoice, methods, onClose, onDone,
}: {
  invoice: Invoice | null;
  methods: PayMethod[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [method, setMethod] = useState('');
  const [proof, setProof] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!invoice) return;
    setMethod(methods[0]?.id ?? '');
    setProof('');
    setError(null);
  }, [invoice, methods]);

  async function send() {
    if (!invoice) return;
    setBusy(true);
    setError(null);
    try {
      if (!proof) throw new Error('ارفع صورة الإيصال أولاً');
      const res = await api.post<{ message: string }>(
        `/api/me/billing/invoices/${invoice.id}/proof`,
        { method, proof },
      );
      onDone(res.message);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={invoice !== null}
      onClose={onClose}
      title="رفع إيصال التحويل"
      side="center"
      footer={
        <div className="flex flex-wrap gap-snug">
          <Button busy={busy} onClick={send}>أرسل الإيصال</Button>
          <Button tone="line" onClick={onClose} disabled={busy}>إلغاء</Button>
        </div>
      }
    >
      {error && <p role="alert" className="mb-base rounded-sm bg-danger/10 px-base py-2.5 text-sm font-bold text-[#a11]">{error}</p>}

      {methods.length > 0 && (
        <fieldset className="mb-base">
          <legend className="mb-1.5 text-xs font-bold">الوسيلة التي حوّلت بها</legend>
          <ul className="space-y-2">
            {methods.map((m) => (
              <li key={m.id}>
                <label className="flex items-center gap-2.5 rounded-sm border border-line bg-paper px-3.5 py-2.5 text-sm">
                  <input
                    type="radio"
                    name="pay-method"
                    value={m.id}
                    checked={method === m.id}
                    onChange={() => setMethod(m.id)}
                    className="size-4 accent-shop"
                  />
                  {m.name}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <p className="mb-1.5 text-xs font-bold">صورة الإيصال</p>
      {proof && (
        /* eslint-disable-next-line @next/next/no-img-element -- معاينة محلية قبل الرفع */
        <img src={proof} alt="" className="mb-2 max-h-48 rounded-sm border border-line object-contain" />
      )}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="flex w-full flex-col items-center gap-1 rounded-sm border-[1.5px] border-dashed border-line bg-paper px-base py-4 transition-colors hover:border-shop"
      >
        <Receipt className="size-5 text-soft" aria-hidden />
        <b className="text-sm">{proof ? 'غيّر الصورة' : 'اختر صورة الإيصال'}</b>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try { setProof(await readImageFile(file, 1400)); } catch (err) { setError(messageOf(err)); }
        }}
      />
    </Sheet>
  );
}

function RequestSheet({
  addon, busy, onClose, onSend,
}: { addon: Addon | null; busy: boolean; onClose: () => void; onSend: (detail: string) => void }) {
  const [detail, setDetail] = useState('');

  useEffect(() => { if (addon) setDetail(''); }, [addon]);

  return (
    <Sheet
      open={addon !== null}
      onClose={onClose}
      title={addon ? `طلب: ${addon.name}` : ''}
      side="center"
      footer={
        <div className="flex flex-wrap gap-snug">
          <Button busy={busy} onClick={() => onSend(detail.trim())}>أرسل الطلب</Button>
          <Button tone="line" onClick={onClose} disabled={busy}>إلغاء</Button>
        </div>
      }
    >
      {addon && (
        <>
          <p className="mb-base text-sm leading-loose text-soft">{addon.desc}</p>
          <Field label="تفاصيل تريد أن نعرفها" hint="اختياري — نتواصل معك على رقم واتساب متجرك">
            {(a) => <Input {...a} value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={500} />}
          </Field>
        </>
      )}
    </Sheet>
  );
}

function PlanSkeleton() {
  return (
    <div className="space-y-base" aria-busy="true" aria-label="جارٍ تحميل الاشتراك">
      <Skeleton className="h-28 rounded-lg" />
      <div className="grid gap-base lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-72 rounded-lg" />)}
      </div>
      <Skeleton className="h-40 rounded-lg" />
    </div>
  );
}
