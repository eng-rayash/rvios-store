'use client';

import { useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { COUNTRIES, DEFAULT_COUNTRY } from '@/lib/countries';
import { api, messageOf } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { OtpInput, type OtpHandle } from '@/components/ui/otp-input';

type Sent = { phone: string; devCode?: string };
type Verified = { hasStore: boolean };

/**
 * نموذج الدخول — خطوتان: الرقم ثم الرمز.
 *
 * ★ لماذا خطوتان في مكوّن واحد لا صفحتين؟
 * لأن الرقم يعيش بين الخطوتين. صفحتان تعنيان حمله في الرابط
 * (فيُقرأ رقم التاجر في سجلّ المتصفّح والخادم الوسيط) أو في
 * التخزين المحلي (فيبقى بعد إغلاق التبويب). وحالةٌ في الذاكرة
 * تموت مع الصفحة — وهو ما نريده لرقمٍ لم يُتحقّق منه بعد.
 */
export function LoginForm() {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState<Sent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const otp = useRef<OtpHandle>(null);

  async function requestCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<Sent>('/api/auth/request-code', { phone, country });
      setSent(res);
      setStep('code');
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify(code: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<Verified>('/api/auth/verify', { phone: sent!.phone, code });
      /* ★ انتقالٌ كامل لا `router.push`: اللوحة ما زالت يخدمها
         الخادم القديم، وتوجيه Next إليها يُبقي حالة العميل
         المرتبطة بصفحة دخولٍ لم تعد قائمة. */
      window.location.href = res.hasStore ? '/dashboard' : '/onboarding';
    } catch (e) {
      setError(messageOf(e));
      otp.current?.clear();
      setBusy(false);
    }
  }

  if (step === 'code') {
    return (
      <section>
        <p className="mb-2 text-xs font-bold tracking-[.6px] text-brass-deep">خطوة أخيرة</p>
        <h1 className="font-display text-h1 leading-tight font-bold">أدخل رمز التحقّق</h1>
        <p className="mt-2.5 mb-6 text-md leading-loose text-soft">
          أرسلنا رمزاً إلى{' '}
          <b dir="ltr" className="inline-block tabular text-ink">+{sent?.phone}</b>.
        </p>

        <OtpInput ref={otp} onComplete={verify} disabled={busy} />

        {error && (
          <p role="alert" className="mt-3 text-xs font-bold text-danger">{error}</p>
        )}

        {/* وضع التطوير وحده — الخادم لا يرسل هذا في الإنتاج */}
        {sent?.devCode && (
          <p className="mt-3 text-xs font-bold text-ok">
            وضع التطوير — الرمز: <span dir="ltr" className="tabular">{sent.devCode}</span>
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <Button
            tone="ghost"
            size="sm"
            onClick={() => { setStep('phone'); setError(null); }}
            disabled={busy}
          >
            تغيير الرقم
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section>
      {/* «أهلاً بعودتك» يقولها اللوح في العمود المجاور — وتكرارها
          هنا يجعل الشاشة تُقرأ مسوّدةً لا تصميماً */}
      <p className="mb-2 text-xs font-bold tracking-[.6px] text-brass-deep">دخول التجّار</p>
      <h1 className="font-display text-h1 leading-tight font-bold">تسجيل الدخول</h1>
      <p className="mt-2.5 mb-6 text-md leading-loose text-soft">
        أدخل رقم جوالك المسجّل، ونرسل لك رمز تحقّق.
      </p>

      <Field label="رقم الجوال" error={error}>
        {(a11y) => (
          /* ★ الحقل المركّب: بادئة الدولة وصندوق الرقم يُقرآن
             حقلاً واحداً. الحدّ على الغلاف لا على أجزائه، و
             `focus-within` ينقل حالة التركيز إليه — فيضيء الحقل
             كلّه أينما وقع التركيز داخله. */
          <div
            dir="ltr"
            className={cnBox(!!error)}
          >
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              aria-label="رمز الدولة"
              className="shrink-0 cursor-pointer border-0 bg-sand py-2.5 ps-3 pe-3 text-sm font-bold text-soft focus:outline-none"
            >
              {Object.values(COUNTRIES).map((c) => (
                <option key={c.code} value={c.code}>+{c.dial}</option>
              ))}
            </select>
            <Input
              {...a11y}
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="٧٧٧ ١٢٣ ٤٥٦"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && phone) requestCode(); }}
              className="rounded-none border-0 bg-transparent tabular focus-visible:ring-0"
            />
          </div>
        )}
      </Field>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={requestCode} busy={busy} disabled={!phone} icon={<ArrowLeft className="size-4" />}>
          أرسل رمز التحقّق
        </Button>
        <a
          href="/onboarding"
          className="text-sm font-bold text-soft underline underline-offset-[3px] hover:text-ink"
        >
          ليس لدي متجر بعد
        </a>
      </div>
    </section>
  );
}

/**
 * غلاف الحقل المركّب — يُبقي سلسلة الأصناف خارج JSX المزدحم.
 *
 * ★ حالتا التركيز منفصلتان بحسب الخطأ، لا حالةٌ واحدة تُضاف
 * فوقها. كانت `focus-within:border-shop` تُطبَّق دائماً، و
 * متغيّرات Tailwind تُكتب بعد الأصناف الأساسية فتغلبها — فحين
 * يعود التاجر إلى حقلٍ خاطئ ليصحّحه، **ينطفئ الحدّ الأحمر في
 * اللحظة ذاتها** ويحلّ محلّه لون العلامة. أي أن مؤشّر الخطأ
 * كان يختفي تحديداً وهو يُحتاج إليه. والخطأ الآن يبقى أحمر
 * مركَّزاً كان أم لا، ويخفت حين يُزال لا حين يُلمَس.
 */
const cnBox = (invalid: boolean) =>
  [
    'flex items-center overflow-hidden rounded-sm border-[1.5px] bg-paper',
    'transition-colors duration-200 focus-within:ring-[3px]',
    invalid
      ? 'border-danger focus-within:ring-danger/20'
      : 'border-line focus-within:border-shop focus-within:ring-shop/20',
  ].join(' ');
