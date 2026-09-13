import { ar } from '@/lib/utils';

/**
 * الوقت النسبي — «قبل ساعتين» لا «2026-09-11T08:14».
 *
 * منقولة حرفياً من `public/assets/js/app.js`: التاجر اعتاد هذه
 * الصياغة في اللوحة القديمة، وتغييرها أثناء الترحيل يُقرأ خللاً
 * لا تحسيناً. وبعد شهرٍ يصير التاريخ مطلقاً — «قبل ٤٧ يوماً»
 * رقمٌ يُحسب ولا يُقرأ.
 */
export function when(iso: string) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `قبل ${ar(mins)} دقيقة`;
  if (mins < 1440) return `قبل ${ar(Math.round(mins / 60))} ساعة`;
  const days = Math.round(mins / 1440);
  if (days === 1) return 'أمس';
  if (days < 30) return `قبل ${ar(days)} يوم`;
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

export type PayMethod = 'cod' | 'wallet' | 'bank';
export type PayStatus = 'none' | 'await' | 'pending' | 'paid';

/** منقولة عن `PAY_METHODS` في server/orders.js */
export const PAY_METHOD_LABEL: Record<PayMethod, string> = {
  cod: 'عند الاستلام',
  wallet: 'محفظة إلكترونية',
  bank: 'تحويل بنكي',
};

/**
 * حالات الدفع.
 *
 * ★ `await` و`pending` مختلفتان — والفرق هو كلّ الفائدة.
 * الأولى: ننتظر العميل أن يحوّل. والثانية: **العميل حوّل ورفع
 * إيصاله، والكرة عند التاجر**. وتعليق الخادم يسمّيها حرفياً
 * «إيصال بانتظار مراجعتك».
 *
 * واللوحة القديمة لم تكن تعرض هذه الحالة في أي موضع — لا شارةً
 * ولا زرّاً — رغم أن نقطة التأكيد موجودة في الخادم. فكان عميلٌ
 * يحوّل ويرفع إيصاله، ولا يعلم التاجر من لوحته شيئاً.
 */
export const PAY_STATE_LABEL: Record<PayStatus, string> = {
  none: 'عند الاستلام',
  await: 'بانتظار التحويل',
  pending: 'إيصال بانتظار مراجعتك',
  paid: 'مدفوع',
};

/** هل تنتظر هذه الحالة فعلاً من التاجر؟ */
export const needsReview = (s?: PayStatus) => s === 'pending';

export type OrderStatus = 'wait' | 'ok' | 'done' | 'off';

/**
 * حالات الطلب كما يراها التاجر.
 *
 * ★ الانتقالات هنا **للعرض فقط** — الخادم هو الحَكَم.
 * `advance()` في `server/orders.js` يرفض أي انتقال غير مسموح
 * بـ٤٠٩، فزرٌّ يظهر خطأً هنا لا يُفسد طلباً بل يُرجع رسالة. لكن
 * زرٌّ يَعِد بما سيُرفض يُقرأ عطلاً، فالقائمة تطابق الخادم.
 */
export const ORDER_STATES: Record<OrderStatus, {
  label: string;
  /** الفعل التالي الطبيعي — زرّ واحد بارز لا قائمة خيارات */
  next?: { to: OrderStatus; label: string };
  /** هل يُعرض زرّ الإلغاء */
  cancellable: boolean;
}> = {
  wait: { label: 'قيد التأكيد', next: { to: 'ok', label: 'تأكيد الطلب' }, cancellable: true },
  ok:   { label: 'مؤكد',        next: { to: 'done', label: 'إتمام الطلب' }, cancellable: true },
  done: { label: 'مكتمل', cancellable: false },
  off:  { label: 'ملغى',  cancellable: false },
};
