'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * سلة المتجر.
 *
 * تحفظ **لقطة** من المنتج لا مرجعاً إليه: العميل قد يغادر إلى
 * واتساب ويعود، والسلة يجب أن تبقى مقروءة حتى لو تغيّرت الصفحة
 * أو تبدّل الترشيح. والمفتاح يحمل رابط المتجر، فلا تختلط سلة
 * متجر بسلة آخر على الجهاز نفسه.
 *
 * والسعر هنا للعرض فقط — الخادم يعيد تسعير كل سطر من القاعدة
 * عند إنشاء الطلب، فلا يُتلاعب بالسعر من المتصفح.
 */
export interface CartLine {
  id: number;
  variantId: number;
  name: string;
  variant: string;
  price: number;
  image: string;
  qty: number;
  max: number;
}

const keyFor = (slug: string) => `rvios.cart.${slug}`;

export function useCart(slug: string) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  // القراءة بعد التركيب لا أثناء التصيير — الخادم لا يرى localStorage،
  // وقراءتها في التصيير الأول تُفشل الترطيب.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(keyFor(slug));
      if (raw) setLines(JSON.parse(raw));
    } catch { /* تخزين معطّل أو تالف — نبدأ بسلة فارغة */ }
    setReady(true);
  }, [slug]);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(keyFor(slug), JSON.stringify(lines)); } catch { /* ممتلئ أو محظور */ }
  }, [lines, ready, slug]);

  const add = useCallback((line: Omit<CartLine, 'qty'>) => {
    setLines((prev) => {
      const at = prev.findIndex((l) => l.id === line.id && l.variantId === line.variantId);
      if (at >= 0) {
        if (prev[at].qty >= prev[at].max) return prev;   // لا نتجاوز المتاح
        const next = [...prev];
        next[at] = { ...next[at], qty: next[at].qty + 1 };
        return next;
      }
      return [...prev, { ...line, qty: 1 }];
    });
  }, []);

  const setQty = useCallback((id: number, variantId: number, qty: number) => {
    setLines((prev) => prev.flatMap((l) => {
      if (l.id !== id || l.variantId !== variantId) return [l];
      const next = Math.max(0, Math.min(qty, l.max));
      return next === 0 ? [] : [{ ...l, qty: next }];
    }));
  }, []);

  const remove = useCallback((id: number, variantId: number) => {
    setLines((prev) => prev.filter((l) => !(l.id === id && l.variantId === variantId)));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const count = lines.reduce((n, l) => n + l.qty, 0);
  const subtotal = lines.reduce((n, l) => n + l.price * l.qty, 0);

  return { lines, add, setQty, remove, clear, count, subtotal, ready };
}
