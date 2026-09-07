// ═══════════════════════════════════════════════════════════
//  تدفق الطلب (§٤.١)
//
//  الطلب يُسجَّل في قاعدة البيانات برقم مرجعي **قبل** فتح
//  واتساب. هذه بالضبط النقطة التي رفضت §٤.٢ لأجلها بديل
//  «رابط واتساب مباشر بلا تسجيل»: بدون التسجيل لا إحصائيات
//  ولا تتبع ولا سجل للتاجر.
//
//  §٨ خطر ٥: طبقة الطلبات مستقلة عن القناة — واتساب مجرد
//  ناقل للتأكيد، ويمكن استبداله لاحقاً بالدفع الإلكتروني
//  دون لمس منطق الطلب.
// ═══════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import { db, now } from './db.js';
import { scope } from './tenancy.js';
import { intlPhone } from './auth.js';
import { pickVariant, variantLabel, variantPrice, recalcStock } from './variants.js';

export const ORDER_STATES = {
  wait: { id: 'wait', label: 'قيد التأكيد', next: ['ok', 'off'] },
  ok:   { id: 'ok',   label: 'مؤكد',        next: ['done', 'off'] },
  done: { id: 'done', label: 'مكتمل',       next: [] },
  off:  { id: 'off',  label: 'ملغى',        next: [] },
};

const REF_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // بلا محارف ملتبسة

export function makeRef() {
  let out = '';
  const bytes = crypto.randomBytes(5);
  for (const b of bytes) out += REF_ALPHABET[b % REF_ALPHABET.length];
  return `RS-${out}`;
}

async function uniqueRef() {
  for (let i = 0; i < 12; i++) {
    const ref = makeRef();
    if (!await db.prepare('SELECT 1 FROM orders WHERE ref = ?').get(ref)) return ref;
  }
  throw new Error('تعذّر توليد رقم مرجعي فريد');
}

/** رسوم التوصيل حسب إعدادات المتجر */
export function deliveryFor(store, subtotal) {
  const fee = Number(store.delivery_fee) || 0;
  const freeOver = Number(store.delivery_free_over) || 0;
  if (!fee) return 0;
  if (freeOver && subtotal >= freeOver) return 0;
  return fee;
}

/**
 * ينشئ طلباً من سلة العميل.
 *
 * الأسعار تُقرأ من قاعدة البيانات لا من العميل — لا يمكن
 * التلاعب بالسعر من المتصفح.
 *
 * المخزون **يُحجز هنا** لا عند التأكيد: لو انتظرنا تأكيد
 * التاجر، لأمكن لعميلين أن يطلبا آخر قطعة وينجح كلاهما.
 * الحجز والقراءة داخل معاملة واحدة لمنع السباق.
 */
export async function placeOrder(storeId, store, { lines, name, phone, note, address }) {
  const s = scope(storeId);

  if (!Array.isArray(lines) || !lines.length) {
    const e = new Error('السلة فارغة'); e.status = 400; throw e;
  }

  // دمج الأسطر المكرّرة قبل فحص المخزون. المفتاح يشمل الخيار:
  // «قميص مقاس M» و«قميص مقاس L» سطران مستقلان لا سطر واحد.
  const wanted = new Map();
  for (const line of lines.slice(0, 50)) {
    const id = Number(line.id);
    const variantId = Number(line.variantId) || 0;
    const qty = Math.max(1, Math.min(99, Number(line.qty) || 1));
    const key = `${id}|${variantId}`;
    const prev = wanted.get(key);
    wanted.set(key, { id, variantId, qty: (prev?.qty ?? 0) + qty });
  }

  /**
   * معاملة على اتصال محجوز، والصفوف تُقفل بـ FOR UPDATE.
   * SQLite كان يسلسل الكتابات كلها بـ BEGIN IMMEDIATE. Postgres
   * يسمح بالتزامن، فالقفل هو ما يمنع بيع القطعة الأخيرة مرتين.
   */
  return db.transaction(async (tx) => {
    const s = scope(storeId, tx);
    const priced = [];
    for (const { id, variantId, qty } of wanted.values()) {
      const product = await s.get('products', { id, live: 1 }, { forUpdate: true });
      if (!product) {
        const e = new Error('منتج غير متاح في هذا المتجر'); e.status = 400; throw e;
      }

      // حين يملك المنتج خيارات فالمخزون والسعر يخصّان الخيار،
      // لا المنتج — وproducts.qty مجرد مجموع لا يُخصم منه هنا.
      const variant = await pickVariant(s, product, variantId, { forUpdate: true });
      const stock = variant ? variant.qty : product.qty;
      const label = variant ? variantLabel(product, variant) : product.variant;
      const named = variant ? `«${product.name}» (${label})` : `«${product.name}»`;

      if (stock <= 0) {
        const e = new Error(`${named} نفد من المخزون`); e.status = 409; throw e;
      }
      if (stock < qty) {
        const e = new Error(`لا يتوفر من ${named} سوى ${stock.toLocaleString('ar-EG')}`);
        e.status = 409; throw e;
      }

      priced.push({
        product_id: product.id,
        variant_id: variant ? variant.id : null,
        name: product.name,
        variant: label,
        price: variant ? variantPrice(product, variant) : product.price,
        qty,
      });
    }

    const subtotal = priced.reduce((a, l) => a + l.price * l.qty, 0);
    const delivery = deliveryFor(store, subtotal);
    const total = subtotal + delivery;
    const ref = await uniqueRef();

    const orderId = await s.insert('orders', {
      ref,
      cust_name:    name    ?? '',
      cust_phone:   phone   ?? '',
      cust_address: address ?? '',
      note:         note    ?? '',
      subtotal,
      delivery_fee: delivery,
      total,
      status: 'wait',
      created_at: now(),
    });

    const touched = new Set();
    for (const l of priced) {
      await s.insert('order_items', { order_id: orderId, ...l });

      // حجز الكمية فوراً — على الخيار إن وُجد، وإلا على المنتج
      if (l.variant_id) {
        const v = await s.get('product_variants', { id: l.variant_id }, { forUpdate: true });
        await s.update('product_variants', l.variant_id, { qty: Math.max(0, v.qty - l.qty) });
        touched.add(l.product_id);
      } else {
        const p = await s.get('products', { id: l.product_id }, { forUpdate: true });
        await s.update('products', l.product_id, { qty: Math.max(0, p.qty - l.qty) });
      }
    }
    // مجموع المنتج يُعاد حسابه مرة واحدة بعد كل خياراته
    for (const productId of touched) await recalcStock(s, productId);

    // لا COMMIT يدوي: sql.begin تُثبّت عند النجاح وتُرجِع عند الرمي
    return { id: orderId, ref, subtotal, delivery, total, items: priced };
  });
}

/**
 * رسالة واتساب المنسّقة.
 *
 * قرار مقصود — الأرقام لاتينية هنا بينما الواجهة عربية-هندية:
 * التاجر ينسخ هذه الرسالة ويحسب عليها ويعيد إرسالها، والأرقام
 * اللاتينية أسلم في النسخ والحساب واللصق عبر التطبيقات.
 * الاتساق البصري مكانه الواجهة، لا رسالة تشغيلية.
 */
export function orderMessage(store, order) {
  const money = (n) => Number(n || 0).toLocaleString('en-US');
  const lines = order.items
    .map((l) => `• ${l.name}${l.variant ? ` (${l.variant})` : ''} × ${l.qty} — ${money(l.price * l.qty)} ر.ي`)
    .join('\n');

  const parts = [
    `مرحباً، أود تأكيد طلبي من ${store.name}`,
    '',
    `رقم الطلب: ${order.ref}`,
    '',
    lines,
    '',
  ];

  // يُفصَّل التوصيل فقط حين يكون له رسوم، وإلا فسطر الإجمالي يكفي
  if (order.delivery_fee > 0) {
    parts.push(`المجموع: ${money(order.subtotal)} ر.ي`);
    parts.push(`التوصيل: ${money(order.delivery_fee)} ر.ي`);
  }
  parts.push(`الإجمالي: ${money(order.total)} ر.ي`);

  if (order.cust_address) parts.push('', `العنوان: ${order.cust_address}`);
  if (order.note) parts.push('', `ملاحظة: ${order.note}`);
  parts.push('', '(طلب مسجّل عبر RVIOS Store)');

  return parts.join('\n');
}

export function waLink(store, order) {
  const to = store.whatsapp ? intlPhone(store.whatsapp) : '';
  return `https://wa.me/${to}?text=${encodeURIComponent(orderMessage(store, order))}`;
}

/** رابط استفسار عن منتج واحد */
export function waAsk(store, product) {
  const to = store.whatsapp ? intlPhone(store.whatsapp) : '';
  const text = `مرحباً، أود الاستفسار عن: ${product.name}${product.variant ? ` (${product.variant})` : ''}`;
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

export async function withItems(storeId, order) {
  const s = scope(storeId);
  return { ...order, items: await s.all('order_items', { order_id: order.id }) };
}

/** تغيير الحالة مع احترام الانتقالات المسموحة */
export async function advance(storeId, orderId, to) {
  const s = scope(storeId);
  const order = await s.get('orders', { id: orderId });
  if (!order) { const e = new Error('الطلب غير موجود'); e.status = 404; throw e; }

  const state = ORDER_STATES[order.status];
  if (!state || !state.next.includes(to)) {
    const e = new Error(`لا يمكن الانتقال من «${state?.label ?? order.status}» إلى هذه الحالة`);
    e.status = 409; throw e;
  }

  // المخزون حُجز وقت الطلب، فالإلغاء يعيده — والتأكيد لا يخصم ثانية
  if (to === 'off') {
    const touched = new Set();
    for (const item of await s.all('order_items', { order_id: orderId })) {
      if (!item.product_id) continue;
      if (item.variant_id) {
        // الخيار قد يكون حُذف بعد الطلب؛ حينها لا مكان تُعاد إليه
        const v = await s.get('product_variants', { id: item.variant_id });
        if (v) {
          await s.update('product_variants', v.id, { qty: v.qty + item.qty });
          touched.add(item.product_id);
        }
        continue;
      }
      const p = await s.get('products', { id: item.product_id });
      if (p) await s.update('products', p.id, { qty: p.qty + item.qty });
    }
    for (const productId of touched) await recalcStock(s, productId);
  }

  await s.update('orders', orderId, { status: to });
  return await s.get('orders', { id: orderId });
}
