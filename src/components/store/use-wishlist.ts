'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * قائمة الرغبات.
 *
 * محلية على الجهاز عمداً: المتجر لا يطلب حساباً قبل الشراء
 * (الطلب يمرّ بواتساب)، وطلب تسجيل دخول لحفظ قلبٍ واحد يطرد
 * أكثر ممّا يحفظ. ولذلك القائمة تعيش في المتصفح، ولا تُرسل إلى
 * أي مكان، ولا تُبنى منها سِيرةُ زائر.
 *
 * والمفتاح يحمل رابط المتجر — كما في السلة — فلا تختلط رغبات
 * متجرين على الجهاز نفسه.
 */
const keyFor = (slug: string) => `rvios.wish.${slug}`;

export function useWishlist(slug: string) {
  const [ids, setIds] = useState<number[]>([]);
  const [ready, setReady] = useState(false);

  // بعد التركيب لا أثناء التصيير — الخادم لا يرى localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(keyFor(slug));
      if (raw) setIds(JSON.parse(raw));
    } catch { /* تخزين معطّل أو تالف */ }
    setReady(true);
  }, [slug]);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(keyFor(slug), JSON.stringify(ids)); } catch { /* ممتلئ أو محظور */ }
  }, [ids, ready, slug]);

  const toggle = useCallback((id: number) => {
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const has = useCallback((id: number) => ids.includes(id), [ids]);

  return { ids, toggle, has, count: ids.length, ready };
}
