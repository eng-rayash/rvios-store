'use client';

import { useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X, Minus, Plus, Loader2, AlertCircle, ShoppingBag, Check } from 'lucide-react';
import type { StoreView, ZoneView } from '@/lib/store';
import type { CartLine } from './use-cart';
import { ar, cn } from '@/lib/utils';

/**
 * درج السلة وإتمام الطلب.
 *
 * القرار المعماري الأهم (§٤.١): **الطلب يُسجَّل في القاعدة أولاً
 * ثم يُفتح واتساب.** لو انعكس الترتيب لضاع كل طلب أغلق فيه
 * العميل هاتفه في منتصف الطريق — ولما وُجد رقم مرجعي يتتبّعه.
 * فواتساب ناقل تأكيد، لا بديل عن نظام الطلبات.
 */
interface Props {
  store: StoreView;
  zones: ZoneView[];
  lines: CartLine[];
  open: boolean;
  onClose: () => void;
  onQty: (id: number, variantId: number, qty: number) => void;
  onRemove: (id: number, variantId: number) => void;
  onDone: () => void;
  subtotal: number;
}

type Stage = 'cart' | 'form' | 'sending' | 'done';

const PAY_LABEL: Record<string, string> = {
  cod: 'عند الاستلام',
  wallet: 'محفظة إلكترونية',
  bank: 'تحويل بنكي',
};

export function CartDrawer({
  store, zones, lines, open, onClose, onQty, onRemove, onDone, subtotal,
}: Props) {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState<Stage>('cart');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [placed, setPlaced] = useState<{ ref: string; wa: string; payNote: string } | null>(null);
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [pay, setPay] = useState(store.payMethods[0] ?? 'cod');

  /**
   * الرسم يتبع المنطقة المختارة، ويسقط على رسم المتجر العام حين
   * لا مناطق. وهذا **عرض فقط** — الخادم يعيد الحساب من القاعدة
   * عند التسجيل، فلا يُتلاعب بالرسم من المتصفح.
   */
  const zone = zones.find((z) => z.id === zoneId) ?? null;
  const fee = zone ? zone.fee : store.deliveryFee;
  const freeOver = zone ? zone.freeOver : store.deliveryFreeOver;
  const delivery = fee && !(freeOver && subtotal >= freeOver) ? fee : 0;
  const total = subtotal + delivery;
  const needsZone = zones.length > 0 && zoneId === null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('اكتب اسمك');
    if (!phone.trim()) return setError('اكتب رقم تواصلك');
    if (needsZone) return setError('اختر منطقة التوصيل');

    setStage('sending');
    try {
      const res = await fetch(`/api/shop/${encodeURIComponent(store.slug)}/orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lines: lines.map((l) => ({ id: l.id, variantId: l.variantId || 0, qty: l.qty })),
          name: name.trim(), phone: phone.trim(), address: address.trim(), note: note.trim(),
          zoneId: zoneId ?? 0, payMethod: pay,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'تعذّر إتمام الطلب');
      setPlaced({ ref: data.ref, wa: data.wa, payNote: data.payNote ?? '' });
      setStage('done');
      onDone();
    } catch (err) {
      // رسالة الخادم أدقّ — قد تقول «نفد المخزون» تحديداً
      setError(err instanceof Error ? err.message : 'تعذّر إتمام الطلب');
      setStage('form');
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink/45 backdrop-blur-[2px]"
          />
          <motion.aside
            role="dialog" aria-modal="true" aria-label="سلة التسوّق"
            initial={reduced ? false : { x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="fixed inset-y-0 start-0 z-50 flex w-[min(28rem,100%)] flex-col
                       border-e border-line bg-cream"
          >
            <header className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="font-display text-2xl font-bold">
                {stage === 'done' ? 'تم تسجيل طلبك' : stage === 'form' ? 'بيانات التوصيل' : 'سلتك'}
              </h2>
              <button type="button" onClick={onClose} aria-label="إغلاق"
                      className="grid size-9 place-items-center rounded-full hover:bg-sand">
                <X className="size-5" />
              </button>
            </header>

            {/* ── تم ── */}
            {stage === 'done' && placed ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
                <span className="grid size-16 place-items-center rounded-full bg-ok text-white">
                  <Check className="size-8" />
                </span>
                <div>
                  <p className="mb-1.5 text-sm text-soft">رقمك المرجعي</p>
                  <p dir="ltr" className="font-display text-4xl font-bold tabular">
                    {placed.ref}
                  </p>
                </div>
                <p className="text-sm leading-relaxed text-soft">
                  طلبك مسجّل عندنا. أكّده مع المتجر عبر واتساب — واحتفظ بالرقم لتتبّعه.
                </p>
                {placed.payNote && (
                  <div className="w-full rounded-xl border border-line bg-paper p-4 text-start">
                    <p className="mb-1.5 text-xs font-extrabold">تعليمات التحويل</p>
                    <p className="text-xs leading-relaxed text-soft">{placed.payNote}</p>
                  </div>
                )}
                <a href={placed.wa} target="_blank" rel="noopener"
                   className="w-full rounded-full bg-shop py-4 text-center font-bold text-on-shop">
                  أكّد عبر واتساب
                </a>
                <a href={`/track?ref=${encodeURIComponent(placed.ref)}`}
                   className="text-xs font-bold text-soft underline underline-offset-4">
                  تتبّع الطلب لاحقاً
                </a>
              </div>
            ) : lines.length === 0 ? (
              /* ── فارغة ── */
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                <ShoppingBag className="size-12 text-line" strokeWidth={1.2} />
                <p className="text-sm leading-relaxed text-soft">
                  سلتك فارغة.<br />تصفّح المنتجات وأضف ما يعجبك.
                </p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  {stage === 'form' || stage === 'sending' ? (
                    <form id="checkout" onSubmit={submit} className="grid gap-4">
                      <Field label="الاسم" value={name} onChange={setName} placeholder="اسمك الكامل" />
                      <Field label="رقم التواصل" value={phone} onChange={setPhone}
                             placeholder="٧٧٧ ١٢٣ ٤٥٦" mode="tel" />
                      {zones.length > 0 && (
                        <div className="grid gap-2">
                          <span className="text-xs font-bold">منطقة التوصيل</span>
                          <div className="grid gap-2">
                            {zones.map((z) => (
                              <button
                                key={z.id} type="button" onClick={() => setZoneId(z.id)}
                                aria-pressed={zoneId === z.id}
                                className={cn(
                                  'flex items-center justify-between rounded-xl border px-4 py-3 text-start transition-colors',
                                  zoneId === z.id ? 'border-shop bg-shop/5' : 'border-line bg-paper hover:border-shop',
                                )}
                              >
                                <span className="text-sm font-bold">{z.name}</span>
                                <span className="text-xs tabular text-soft">
                                  {z.fee ? `${ar(z.fee)} ${store.currency}` : 'مجاني'}
                                  {z.freeOver ? ` · مجاني فوق ${ar(z.freeOver)}` : ''}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <Field label="العنوان" value={address} onChange={setAddress}
                             placeholder="المدينة والحي وأقرب معلم" optional />

                      {store.payMethods.length > 1 && (
                        <div className="grid gap-2">
                          <span className="text-xs font-bold">طريقة الدفع</span>
                          <div className="grid gap-2">
                            {store.payMethods.map((m) => (
                              <button
                                key={m} type="button" onClick={() => setPay(m)}
                                aria-pressed={pay === m}
                                className={cn(
                                  'rounded-xl border px-4 py-3 text-start text-sm font-bold transition-colors',
                                  pay === m ? 'border-shop bg-shop/5' : 'border-line bg-paper hover:border-shop',
                                )}
                              >
                                {PAY_LABEL[m] ?? m}
                              </button>
                            ))}
                          </div>
                          {pay !== 'cod' && store.payNote && (
                            <p className="rounded-xl border border-line bg-paper px-4 py-3 text-xs leading-relaxed text-soft">
                              {store.payNote}
                            </p>
                          )}
                        </div>
                      )}
                      <label className="grid gap-1.5">
                        <span className="text-xs font-bold">ملاحظة <span className="font-normal text-soft">اختياري</span></span>
                        <textarea
                          value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300}
                          className="resize-none rounded-xl border border-line bg-paper px-4 py-3
                                     text-sm outline-none focus:border-shop"
                        />
                      </label>
                      {error && (
                        <p role="alert" className="flex items-center gap-2 rounded-xl border border-danger/30
                                                   bg-danger/5 px-4 py-3 text-xs font-bold text-danger">
                          <AlertCircle className="size-4 shrink-0" />{error}
                        </p>
                      )}
                    </form>
                  ) : (
                    <ul className="grid gap-4">
                      {lines.map((l) => (
                        <li key={`${l.id}-${l.variantId}`} className="flex gap-3.5">
                          <span className="size-20 shrink-0 overflow-hidden rounded-xl bg-sand">
                            {l.image && <Image src={l.image} alt="" width={80} height={80}
                                               className="size-full object-cover" />}
                          </span>
                          <div className="flex flex-1 flex-col">
                            <p className="text-sm font-bold leading-snug">{l.name}</p>
                            {l.variant && <p className="text-[11px] text-soft">{l.variant}</p>}
                            <p className="mt-0.5 text-sm font-extrabold tabular text-shop-text">
                              {ar(l.price)} <span className="text-[10px] font-normal text-soft">{store.currency}</span>
                            </p>
                            <div className="mt-auto flex items-center gap-1.5 pt-1.5">
                              <Step onClick={() => onQty(l.id, l.variantId, l.qty - 1)} aria-label="إنقاص">
                                <Minus className="size-3" />
                              </Step>
                              <span className="w-7 text-center text-sm font-bold tabular">{ar(l.qty)}</span>
                              <Step onClick={() => onQty(l.id, l.variantId, l.qty + 1)}
                                    disabled={l.qty >= l.max} aria-label="زيادة">
                                <Plus className="size-3" />
                              </Step>
                              <button type="button" onClick={() => onRemove(l.id, l.variantId)}
                                      className="ms-auto text-[11px] font-bold text-soft hover:text-danger">
                                إزالة
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <footer className="border-t border-line bg-paper px-5 py-4">
                  <dl className="mb-3 grid gap-1.5 text-sm">
                    <Row label="المجموع" value={`${ar(subtotal)} ${store.currency}`} />
                    <Row label="التوصيل" value={delivery ? `${ar(delivery)} ${store.currency}` : 'مجاني'}
                         tone={delivery ? undefined : 'ok'} />
                    <Row label="الإجمالي" value={`${ar(total)} ${store.currency}`} strong />
                  </dl>

                  {store.deliveryNote && stage === 'cart' && (
                    <p className="mb-3 text-[11px] leading-relaxed text-soft">{store.deliveryNote}</p>
                  )}

                  {stage === 'cart' ? (
                    <button type="button" onClick={() => setStage('form')}
                            className="w-full rounded-full bg-shop py-4 font-bold text-on-shop
                                       transition-[filter,transform] hover:brightness-110 active:scale-[.99]">
                      متابعة الطلب
                    </button>
                  ) : (
                    <button type="submit" form="checkout" disabled={stage === 'sending'}
                            className="flex w-full items-center justify-center gap-2.5 rounded-full bg-shop
                                       py-4 font-bold text-on-shop disabled:opacity-70">
                      {stage === 'sending'
                        ? <><Loader2 className="size-4 animate-spin" />جارٍ التسجيل…</>
                        : 'سجّل الطلب'}
                    </button>
                  )}
                </footer>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({ label, value, onChange, placeholder, mode, optional }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; mode?: 'tel'; optional?: boolean;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-bold">
        {label} {optional && <span className="font-normal text-soft">اختياري</span>}
      </span>
      <input
        value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} inputMode={mode}
        className="rounded-xl border border-line bg-paper px-4 py-3 text-sm
                   outline-none focus:border-shop"
      />
    </label>
  );
}

function Step({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...rest}
            className="grid size-7 place-items-center rounded-full border border-line
                       transition-colors hover:border-shop disabled:opacity-35">
      {children}
    </button>
  );
}

function Row({ label, value, strong, tone }: {
  label: string; value: string; strong?: boolean; tone?: 'ok';
}) {
  return (
    <div className={cn('flex items-center justify-between', strong && 'border-t border-line pt-2')}>
      <dt className={cn('text-soft', strong && 'font-bold text-ink')}>{label}</dt>
      <dd className={cn('tabular', strong ? 'text-lg font-extrabold' : 'font-bold',
        tone === 'ok' && 'text-ok')}>{value}</dd>
    </div>
  );
}
