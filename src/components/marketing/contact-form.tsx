'use client';

import { useState } from 'react';
import { COUNTRIES, DEFAULT_COUNTRY } from '@/lib/countries';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Check, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { z } from 'zod';
import { cn } from '@/lib/utils';

/**
 * نموذج طلب الخدمة.
 *
 * الحالات الأربع كلها معالَجة صراحةً — خامل، جارٍ الإرسال،
 * نجاح، فشل — لأن أسوأ ما يمكن أن يحدث لنموذج أن يبتلع ضغطة
 * التاجر بلا أثر فيرسل ثلاث مرات ثم ييأس.
 *
 * والتحقق يجري هنا **وفي الخادم**: هذا للسرعة والوضوح، وذاك
 * للأمان. لا يُغني أحدهما عن الآخر.
 */
const Schema = z.object({
  kind: z.enum(['build', 'domain', 'store', 'other']),
  // الدولة تُرسل مع الرقم: الإدارة تفتحه بـ`wa.me` مباشرةً، ورقم
  // بلا رمز دولة يعطي رابطاً لا يفتح شيئاً — فيضيع طلب خدمة بصمت
  country: z.enum(Object.keys(COUNTRIES) as [string, ...string[]]),
  contact: z
    .string()
    .trim()
    .min(9, 'أدخل رقم واتساب صحيحاً')
    .max(60)
    .regex(/^[0-9+\s-]+$/, 'الرقم يحتوي محارف غير مسموحة'),
  detail: z.string().trim().max(800, 'التفاصيل أطول من المسموح').optional(),
});

const KINDS = [
  { id: 'build', label: 'نُنشئ متجري بدلاً عني' },
  { id: 'domain', label: 'دومين مخصص' },
  { id: 'store', label: 'متجر إضافي' },
  { id: 'other', label: 'استفسار آخر' },
] as const;

type State = 'idle' | 'sending' | 'done' | 'error';

export function ContactForm() {
  const [kind, setKind] = useState<(typeof KINDS)[number]['id']>('build');
  const [contact, setContact] = useState('');
  const [country, setCountry] = useState<string>(DEFAULT_COUNTRY);
  const [detail, setDetail] = useState('');
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');
  const reduced = useReducedMotion();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const parsed = Schema.safeParse({ kind, country, contact, detail });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'تحقّق من البيانات');
      setState('error');
      return;
    }

    setState('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'تعذّر إرسال الطلب');
      setState('done');
    } catch (err) {
      // رسالة الخادم أدقّ من أي نصّ عام نخترعه هنا
      setError(err instanceof Error ? err.message : 'تعذّر إرسال الطلب — حاول مجدداً');
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl border border-ok/30 bg-ok/5 p-10 text-center"
      >
        <span className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-ok text-white">
          <Check className="size-7" />
        </span>
        <h2 className="mb-2 font-display text-3xl font-bold">وصلنا طلبك</h2>
        <p className="mb-7 text-sm text-soft">سنتواصل معك عبر واتساب قريباً — عادة خلال يوم عمل واحد.</p>
        <Link
          href="/"
          className="group inline-flex items-center gap-2 rounded-pill bg-ink px-7 py-3.5 text-sm font-bold text-cream"
        >
          العودة للرئيسية
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
        </Link>
      </motion.div>
    );
  }

  const busy = state === 'sending';

  return (
    <form onSubmit={submit} className="grid gap-6 rounded-xl border border-line bg-paper p-7">
      <fieldset disabled={busy} className="grid gap-6">
        <div className="grid gap-2.5">
          <span className="text-xs font-bold">نوع الطلب</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                aria-pressed={kind === k.id}
                className={cn(
                  'rounded-lg border px-4 py-3 text-start text-sm font-bold transition-colors',
                  kind === k.id
                    ? 'border-shop bg-shop-veil text-shop-text'
                    : 'border-line bg-cream hover:border-line-strong',
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        {/* ★ التسمية مربوطة بـ`htmlFor` لا ملفوفة حول الحقلين.
            كان `<label>` يلفّ `<div>` يحوي `<select>` و`<input>` معاً،
            والتسمية الضمنية تُنسب إلى **أول** عنصر تحكّم داخلها — أي
            أن «رقم واتساب» كانت تُعلَن لمنتقي الدولة، وحقلُ الرقم
            نفسه بلا اسم يُعلَن إطلاقاً. ومعها `aria-invalid` ورابط
            إلى نصّ الخطأ، وإلا سمع المستخدم «الرقم غير صحيح» في
            مكانٍ آخر من الصفحة ولا يعرف أنها عنه. */}
        <div className="grid gap-2.5">
          <label htmlFor="contact-phone" className="text-xs font-bold">رقم واتساب</label>
          <div className="flex items-center overflow-hidden rounded-lg border border-line bg-cream
                          focus-within:border-shop">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              aria-label="الدولة"
              dir="ltr"
              className="cursor-pointer appearance-none bg-transparent ps-4 pe-1 text-sm
                         font-bold text-soft outline-none"
            >
              {Object.values(COUNTRIES).map((c) => (
                <option key={c.code} value={c.code}>+{c.dial}</option>
              ))}
            </select>
            <input
              id="contact-phone"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              inputMode="tel"
              placeholder="٧٧٧ ١٢٣ ٤٥٦"
              aria-invalid={state === 'error' || undefined}
              aria-describedby={state === 'error' && error ? 'contact-error' : undefined}
              className="w-full bg-transparent px-3 py-3 text-md font-bold outline-none"
            />
          </div>
        </div>

        <label className="grid gap-2.5">
          <span className="text-xs font-bold">
            تفاصيل طلبك <span className="font-normal text-soft">اختياري</span>
          </span>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={4}
            maxLength={800}
            placeholder="صف نشاطك وما تحتاجه باختصار…"
            className="resize-y rounded-lg border border-line bg-cream px-4 py-3 text-sm
                       leading-relaxed outline-none focus:border-shop"
          />
        </label>
      </fieldset>

      <AnimatePresence>
        {state === 'error' && error && (
          <motion.p
            id="contact-error"
            role="alert"
            initial={reduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2.5 rounded-lg border border-danger/30 bg-danger/5
                       px-4 py-3 text-sm font-bold text-danger"
          >
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center justify-center gap-2.5 rounded-pill bg-ink px-7 py-4
                   text-md font-bold text-cream transition-transform active:scale-[.99]
                   disabled:cursor-not-allowed disabled:opacity-70"
      >
        {busy ? <><Loader2 className="size-4 animate-spin" />جارٍ الإرسال…</> : 'أرسل الطلب'}
      </button>

      <p className="text-center text-2xs text-soft">
        لا نرسل رسائل تسويقية. رقمك يُستخدم للردّ على هذا الطلب وحده.
      </p>
    </form>
  );
}
