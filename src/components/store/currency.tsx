'use client';

import { createContext, useContext } from 'react';
import { symbolOf } from '@/lib/countries';

/**
 * رمز عملة المتجر المعروض.
 *
 * سياق لا خاصية مُمرَّرة: رمز العملة يظهر في ورقة المنتج
 * وبطاقته ودرج السلة وشريط الهيدر — وتمريره خاصيةً عبر أربع
 * طبقات يعني أن نسيان طبقة واحدة يترك «ر.ي» معروضاً في متجر
 * مصري بلا أن يكسر شيئاً ولا أن يحذّر أحد.
 *
 * والقيمة الافتراضية هي عملة الدولة الافتراضية، فمكوّن يُعرض
 * خارج المتجر (في معرض أو قصة) لا يظهر بلا عملة.
 */
const CurrencyContext = createContext<string>(symbolOf(null));

export function CurrencyProvider({ value, children }: {
  value: string;
  children: React.ReactNode;
}) {
  return (
    <CurrencyContext.Provider value={value || symbolOf(null)}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => useContext(CurrencyContext);
