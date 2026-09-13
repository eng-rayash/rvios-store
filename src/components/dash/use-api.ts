'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, messageOf } from '@/lib/api';

/**
 * جلب بيانات شاشة من اللوحة.
 *
 * ★ لماذا جلبٌ من العميل لا مكوّنات خادم؟
 * لأن الـAPI ما زال في الخادم القديم، والجلسة كعكةٌ على نطاق
 * الصفحة. مكوّن خادم يحتاج أن يمرّر الكعكة يدوياً إلى خادمٍ آخر
 * ويعيد بناء ترويسة `x-store` التي تحدّد المتجر النشط **لهذا
 * التبويب** — وهي معلومة لا يعرفها الخادم أصلاً. والجلب من
 * العميل يرث الاثنين مجّاناً كما في اللوحة القديمة. وحين يُرحَّل
 * الـAPI نفسه يصير الخادم هو المكان الطبيعي — لا قبل ذلك.
 *
 * ★ عدّاد التسلسل يمنع الردّ المتأخّر من الكتابة فوق الأحدث.
 * تاجرٌ يضغط «مؤكّد» ثم «الكل» بسرعة يُطلق طلبين؛ وإن وصل
 * الأوّل ثانياً عُرضت قائمة التبويب الخاطئ تحت التبويب الصحيح.
 */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (path === null) return;
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<T>(path);
      if (id === seq.current) setData(res);
    } catch (e) {
      if (id !== seq.current) return;
      /* الجلسة انتهت أثناء العمل — إلى الدخول لا رسالة خطأ غامضة */
      if (e instanceof ApiError && e.status === 401) {
        window.location.href = '/login';
        return;
      }
      setError(messageOf(e));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => { void load(); }, [load]);

  return { data, error, loading, reload: load, setData };
}
