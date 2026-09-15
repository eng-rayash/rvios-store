'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiError, messageOf } from '@/lib/api';
import { ar, cn } from '@/lib/utils';
import { Plaque } from '@/components/ui/plaque';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Sheet } from '@/components/ui/sheet';
import { Field, Input } from '@/components/ui/field';
import { useDash, useStore } from '@/components/dash/dash-context';

interface Zone { id: number; name: string; fee: number; free_over: number; sort: number }
interface ZonesRes { zones: Zone[]; fallback: { fee: number; freeOver: number } }

/** طرق الدفع كما يعرّفها الخادم — «عند الاستلام» لا تُنزع أبداً */
const PAY_METHODS = [
  { id: 'cod', label: 'عند الاستلام', note: 'لا يمكن إيقافها — متجرٌ بلا طريقة دفع لا يستقبل طلباً' },
  { id: 'wallet', label: 'محفظة إلكترونية', note: 'يرفع العميل إيصال التحويل مع طلبه' },
  { id: 'bank', label: 'تحويل بنكي', note: 'يرفع العميل إيصال التحويل مع طلبه' },
] as const;

/**
 * شاشة التوصيل والدفع.
 *
 * ★ الرسم العام مكتوبٌ بوصفه «ما يُطبَّق حين لا مناطق» — لا حقلاً
 * غامضاً بجوار المناطق. تعليق الخادم يسمّيه سقوطاً آمناً: متجرٌ
 * يحذف مناطقه كلها يجب أن يعود إلى رسمٍ واحد لا إلى توصيل
 * مجاني بالخطأ. والواجهة تقول أيّهما يعمل الآن.
 */
export function DeliveryScreen() {
  const { store } = useStore();
  const { reloadStore } = useDash();

  const [data, setData] = useState<ZonesRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const [editing, setEditing] = useState<Zone | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Zone | null>(null);
  const [busy, setBusy] = useState(false);

  /* إعدادات المتجر — رسمٌ عام وطرق دفع وتعليمات تحويل */
  const [fee, setFee] = useState('');
  const [freeOver, setFreeOver] = useState('');
  const [note, setNote] = useState('');
  const [methods, setMethods] = useState<string[]>([]);
  const [payNote, setPayNote] = useState('');
  const [savingStore, setSavingStore] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.get<ZonesRes>('/api/me/zones'));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { window.location.href = '/login'; return; }
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /* تُملأ من المتجر المحمَّل في السياق — ومع كل حفظٍ يعيده */
  useEffect(() => {
    setFee(String(store.deliveryFee ?? 0));
    setFreeOver(String(store.deliveryFreeOver ?? 0));
    setNote(store.deliveryNote ?? '');
    setMethods((store.payMethods ?? 'cod').split(',').filter(Boolean));
    setPayNote(store.payNote ?? '');
  }, [store]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  async function saveStore() {
    setSavingStore(true);
    setError(null);
    try {
      await api.patch('/api/me/store', {
        deliveryFee: Number(fee) || 0,
        deliveryFreeOver: Number(freeOver) || 0,
        deliveryNote: note.trim(),
        payMethods: methods.length ? methods : ['cod'],
        payNote: payNote.trim(),
      });
      await reloadStore();
      setNotice('حُفظت الإعدادات');
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setSavingStore(false);
    }
  }

  async function removeZone(z: Zone) {
    setBusy(true);
    try {
      await api.del(`/api/me/zones/${z.id}`);
      setNotice(`حُذفت منطقة «${z.name}»`);
      await load();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  }

  const zones = data?.zones ?? [];
  const cur = store.currency;

  return (
    <div className="space-y-base">
      <p role="status" className={cn(notice ? 'rounded-sm bg-ok/10 px-base py-2.5 text-sm font-bold text-[#1f6b40]' : 'sr-only')}>
        {notice}
      </p>
      {error && <p role="alert" className="rounded-sm bg-danger/10 px-base py-2.5 text-sm font-bold text-[#a11]">{error}</p>}

      <div className="grid items-start gap-base lg:grid-cols-2">
        {/* ── المناطق ── */}
        <Plaque as="section" aria-labelledby="zones-h" className="overflow-hidden">
          <header className="flex items-center gap-snug border-b border-line px-5 py-3.5">
            <h2 id="zones-h" className="font-heading flex-1 text-md font-bold">مناطق التوصيل</h2>
            <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => { setEditing(null); setFormOpen(true); }}>
              أضف منطقة
            </Button>
          </header>

          <p className="px-5 py-3 text-xs leading-loose text-soft">
            {zones.length
              ? 'يختار العميل منطقته عند الطلب فيُحسب رسمها.'
              : 'بلا مناطق، يُطبَّق الرسم العام أدناه على كل الطلبات.'}
          </p>

          {loading ? (
            <div className="divide-y divide-line">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex items-center gap-base px-5 py-3.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="ms-auto h-3 w-16" />
                </div>
              ))}
            </div>
          ) : zones.length ? (
            <ul className="divide-y divide-line border-t border-line">
              {zones.map((z) => (
                <li key={z.id} className="flex flex-wrap items-center gap-x-base gap-y-1 px-5 py-3 transition-colors hover:bg-cream">
                  <b className="min-w-0 flex-1 truncate text-sm">{z.name}</b>
                  <span className="text-sm tabular">
                    {z.fee ? `${ar(z.fee)} ${cur}` : <span className="text-ok">مجاني</span>}
                  </span>
                  {z.free_over > 0 && (
                    <span className="text-2xs text-soft">مجاني فوق {ar(z.free_over)}</span>
                  )}
                  <span className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setEditing(z); setFormOpen(true); }}
                      aria-label={`عدّل «${z.name}»`}
                      className="grid size-8 place-items-center rounded-sm border border-line bg-paper text-soft transition-colors hover:border-ink hover:text-ink"
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(z)}
                      aria-label={`احذف «${z.name}»`}
                      className="grid size-8 place-items-center rounded-sm border border-line bg-paper text-soft transition-colors hover:border-danger hover:bg-danger/5 hover:text-danger"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<MapPin className="size-6" aria-hidden />} title="لا مناطق محدّدة">
              أضف مناطق مدينتك ليعرف العميل رسمه قبل أن يطلب.
            </EmptyState>
          )}
        </Plaque>

        {/* ── الرسم العام وطرق الدفع ── */}
        <div className="space-y-base">
          <Plaque as="section" aria-labelledby="fallback-h" className="px-5 py-4">
            <h2 id="fallback-h" className="font-heading mb-snug text-md font-bold">الرسم العام</h2>
            <p className="mb-base text-xs leading-loose text-soft">
              {zones.length
                ? 'يُطبَّق حين لا يختار العميل منطقة، وحين تُحذف المناطق كلها.'
                : 'هو المطبَّق الآن على كل الطلبات.'}
            </p>

            <div className="grid gap-x-base sm:grid-cols-2">
              <Field label={`رسوم التوصيل (${cur})`} hint="صفر يعني مجاني">
                {(a) => (
                  <Input {...a} type="number" min={0} inputMode="numeric" className="tabular"
                    value={fee} onChange={(e) => setFee(e.target.value)} />
                )}
              </Field>
              <Field label={`مجاني فوق (${cur})`} hint="صفر يعني بلا حدّ">
                {(a) => (
                  <Input {...a} type="number" min={0} inputMode="numeric" className="tabular"
                    value={freeOver} onChange={(e) => setFreeOver(e.target.value)} />
                )}
              </Field>
            </div>

            <Field label="ملاحظة التوصيل" hint="تظهر للعميل عند الطلب">
              {(a) => (
                <Input {...a} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200}
                  placeholder="داخل صنعاء خلال ٢٤ ساعة" />
              )}
            </Field>
          </Plaque>

          <Plaque as="section" aria-labelledby="pay-h" className="px-5 py-4">
            <h2 id="pay-h" className="font-heading mb-snug text-md font-bold">طرق الدفع</h2>
            <p className="mb-base text-xs leading-loose text-soft">
              المنصة لا تلمس أموال مبيعاتك ولا تضمنها. <b className="text-ink">تأكيد الدفع قرارك وحدك.</b>
            </p>

            <ul className="mb-base space-y-2">
              {PAY_METHODS.map((m) => {
                const on = methods.includes(m.id);
                const locked = m.id === 'cod';
                return (
                  <li key={m.id}>
                    <label className={cn('flex gap-2.5 rounded-sm border border-line bg-paper px-3.5 py-2.5', locked && 'opacity-70')}>
                      <input
                        type="checkbox"
                        checked={on || locked}
                        disabled={locked}
                        onChange={(e) => setMethods((p) => (e.target.checked ? [...p, m.id] : p.filter((x) => x !== m.id)))}
                        className="mt-0.5 size-4 accent-shop"
                      />
                      <span>
                        <b className="block text-sm">{m.label}</b>
                        <small className="block text-2xs leading-body text-soft">{m.note}</small>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <label htmlFor="pay-note" className="mb-1.5 block text-xs font-bold">تعليمات التحويل</label>
            <textarea
              id="pay-note"
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
              maxLength={400}
              rows={3}
              placeholder="مثال: حوّل إلى محفظة الكريمي ٧٧٧١٢٣٤٥٦ باسم…، وأرفق صورة الإيصال."
              className="w-full resize-y rounded-sm border-[1.5px] border-line bg-paper px-3 py-2.5 leading-body transition-colors focus-visible:border-shop focus-visible:ring-[3px] focus-visible:ring-shop/20 focus-visible:outline-none"
            />
            <small className="mt-1.5 block text-2xs text-soft">
              تظهر للعميل بعد اختياره طريقة تحويل، وفي صفحة تأكيد الطلب.
            </small>
          </Plaque>

          <Button busy={savingStore} onClick={saveStore}>حفظ التوصيل والدفع</Button>
        </div>
      </div>

      <ZoneForm
        open={formOpen}
        zone={editing}
        currency={cur}
        onClose={() => setFormOpen(false)}
        onSaved={async (message) => { setFormOpen(false); setNotice(message); await load(); }}
      />

      <Sheet open={deleting !== null} onClose={() => setDeleting(null)} title="حذف المنطقة؟" side="center">
        {deleting && (
          <>
            <p className="text-sm leading-loose text-soft">
              ستُحذف منطقة <b className="text-ink">«{deleting.name}»</b>، و
              <b className="text-ink">تحتفظ الطلبات السابقة برسمها كما هو</b>.
            </p>
            <div className="mt-roomy flex flex-wrap gap-snug">
              <Button busy={busy} onClick={() => removeZone(deleting)} className="bg-danger text-white enabled:hover:bg-[#a11]">
                احذف المنطقة
              </Button>
              <Button tone="line" onClick={() => setDeleting(null)} disabled={busy}>تراجع</Button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}

function ZoneForm({
  open, zone, currency, onClose, onSaved,
}: {
  open: boolean;
  zone: Zone | null;
  currency: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState('');
  const [fee, setFee] = useState('');
  const [freeOver, setFreeOver] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(zone?.name ?? '');
    setFee(String(zone?.fee ?? 0));
    setFreeOver(String(zone?.free_over ?? 0));
    setError(null);
  }, [open, zone]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = { name: name.trim(), fee: Number(fee) || 0, freeOver: Number(freeOver) || 0 };
      if (!payload.name) throw new Error('اسم المنطقة مطلوب');
      if (zone) await api.patch(`/api/me/zones/${zone.id}`, payload);
      else await api.post('/api/me/zones', payload);
      onSaved(zone ? 'حُدّثت المنطقة' : 'أُضيفت المنطقة');
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={zone ? 'تعديل المنطقة' : 'منطقة جديدة'}
      side="center"
      footer={
        <div className="flex flex-wrap gap-snug">
          <Button busy={busy} onClick={save}>حفظ</Button>
          <Button tone="line" onClick={onClose} disabled={busy}>إلغاء</Button>
        </div>
      }
    >
      {error && <p role="alert" className="mb-base rounded-sm bg-danger/10 px-base py-2.5 text-sm font-bold text-[#a11]">{error}</p>}
      <Field label="اسم المنطقة">
        {(a) => <Input {...a} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="حدّة" />}
      </Field>
      <div className="grid gap-x-base sm:grid-cols-2">
        <Field label={`الرسم (${currency})`} hint="صفر يعني مجاني">
          {(a) => (
            <Input {...a} type="number" min={0} inputMode="numeric" className="tabular"
              value={fee} onChange={(e) => setFee(e.target.value)} />
          )}
        </Field>
        <Field label={`مجاني فوق (${currency})`} hint="صفر يعني بلا حدّ">
          {(a) => (
            <Input {...a} type="number" min={0} inputMode="numeric" className="tabular"
              value={freeOver} onChange={(e) => setFreeOver(e.target.value)} />
          )}
        </Field>
      </div>
    </Sheet>
  );
}
