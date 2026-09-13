import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  ORDER_STATES, PAY_STATE_LABEL, when,
  type OrderStatus, type PayMethod, type PayStatus,
} from '@/lib/format';
import { ar, cn, items } from '@/lib/utils';

export interface OrderItem { name: string; qty: number; price: number; variant?: string }

export interface Order {
  id: number;
  ref: string;
  cust_name: string;
  cust_phone: string;
  total: number;
  status: OrderStatus;
  created_at: string;
  items?: OrderItem[];
  /** رابط محادثة واتساب جاهز — يولّده الخادم */
  wa?: string;
  pay_method?: PayMethod;
  pay_status?: PayStatus;
  /** رابط صورة الإيصال الذي رفعه العميل */
  pay_proof?: string;
}

/**
 * صفّ طلب — مُصمَّم للهاتف أوّلاً لا مضغوطاً إليه.
 *
 * ★ مساحتا شبكة مختلفتان لا تخطيطٌ واحد يلتفّ.
 * النسخة القديمة كانت `flex-wrap`: على الهاتف تتدحرج العناصر
 * إلى السطر التالي حيث تسقط، فيقف المبلغ أحياناً تحت اسم العميل
 * وأحياناً تحت الشارة، حسب طول الاسم. هنا لكلّ مقاسٍ ترتيبه:
 *
 *   الهاتف:   المرجع ........ المبلغ     ← ما يبحث عنه التاجر
 *             العميل والوقت .. الحالة
 *   المكتب:   المرجع · العميل · الحالة · المبلغ · الأفعال
 *
 * المبلغ على الهاتف في السطر الأول لأنه أوّل ما يُسأل عنه.
 * وعلى المكتب في آخره لأن العين تمسح الصفّ من بدايته.
 *
 * ★ `<bdi>` حول المرجع: المرجع لاتيني (`A7K2Q`) داخل سطرٍ عربي،
 * وبلا عزلٍ ثنائي الاتجاه تلتصق به الفاصلة أو الرقم المجاور
 * فيُقرأ مقلوباً.
 */
export function OrderRow({
  order,
  currency,
  actions,
  showItems = false,
}: {
  order: Order;
  currency: string;
  /** أزرار الأفعال — تُعرض في شاشة الطلبات لا في النظرة العامة */
  actions?: ReactNode;
  showItems?: boolean;
}) {
  const state = ORDER_STATES[order.status];
  const count = order.items?.length ?? 0;
  const full = !!actions || showItems;
  const line = order.items
    ?.map((i) => `${i.name}${i.variant ? ` (${i.variant})` : ''} ×${ar(i.qty)}`)
    .join(' · ');

  return (
    <article
      className={cn(
        'grid items-center gap-x-base gap-y-1.5 px-5 py-4 transition-colors hover:bg-cream',
        full
          ? [
              'grid-cols-[minmax(0,1fr)_auto]',
              '[grid-template-areas:"ref_total""cust_badge""items_items""acts_acts"]',
              'md:grid-cols-[6.5rem_minmax(0,1fr)_auto_auto_auto] md:gap-y-1',
              'md:[grid-template-areas:"ref_cust_badge_total_acts""._items_items_items_items"]',
            ]
          : [
              'grid-cols-[minmax(0,1fr)_auto]',
              '[grid-template-areas:"ref_total""cust_badge"]',
              'md:grid-cols-[6.5rem_minmax(0,1fr)_auto_auto]',
              'md:[grid-template-areas:"ref_cust_badge_total"]',
            ],
      )}
    >
      <p className="[grid-area:ref] text-md font-semibold text-shop-text">
        <bdi className="tabular">{order.ref}</bdi>
      </p>

      <div className="[grid-area:cust] min-w-0">
        <p className="truncate text-sm font-bold">{order.cust_name || 'عميل'}</p>
        <p className="text-xs text-soft">
          {when(order.created_at)} · {items(count)}
        </p>
      </div>

      {/* ★ شارتان لا واحدة: حالة الطلب وحالة الدفع شيئان مختلفان.
          طلبٌ «مؤكد» قد يكون مدفوعاً أو بانتظار تحويل، ودمجهما في
          شارة واحدة يُخفي أيّهما ينتظر التاجر. وشارة الدفع لا
          تظهر في «عند الاستلام» — لا شيء يُنتظر فيها. */}
      <div className="[grid-area:badge] flex flex-wrap justify-end gap-1.5 md:justify-start">
        <Badge tone={order.status}>{state.label}</Badge>
        {order.pay_method && order.pay_method !== 'cod' && order.pay_status && order.pay_status !== 'none' && (
          <Badge tone={order.pay_status === 'paid' ? 'ok' : order.pay_status === 'pending' ? 'wait' : 'done'}>
            {PAY_STATE_LABEL[order.pay_status]}
          </Badge>
        )}
      </div>

      <p className="[grid-area:total] justify-self-end whitespace-nowrap text-md font-semibold tabular">
        {ar(order.total)} <span className="text-2xs font-normal text-soft">{currency}</span>
      </p>

      {showItems && line && (
        <p className="[grid-area:items] text-xs leading-body text-soft">{line}</p>
      )}

      {actions && (
        <div className="[grid-area:acts] flex flex-wrap gap-2 pt-1 md:justify-end md:pt-0">
          {actions}
        </div>
      )}
    </article>
  );
}
