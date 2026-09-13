'use client';

import { createContext, useContext } from 'react';
import type { BrandView, CategoryView, ProductView, StoreView } from '@/lib/store';

/**
 * سياق واجهة «برو».
 *
 * الواجهة الفاخرة صفحتان (الرئيسية والمتجر) داخل هيكل واحد:
 * الهيدر والسلة وورقة المنتج مشتركة بينهما، وحالة السلة
 * والرغبات تعيش في الهيكل لا في كل صفحة. تمرير أربع دوالّ
 * خاصيةً عبر ثمانية مكوّنات متداخلة (شبكة ← بطاقة ← زرّ) يعني
 * أن نسيان طبقة واحدة يعطّل زرّ إضافةٍ بلا خطأ يظهر.
 */
export interface ProContext {
  store: StoreView;
  categories: CategoryView[];
  brands: BrandView[];
  /** يفتح ورقة المنتج */
  open: (p: ProductView) => void;
  /** إضافة سريعة — تتجاهل المنتجات ذات الخيارات وتفتحها بدلها */
  add: (p: ProductView) => void;
  /** المنتج الذي ومض للتوّ بعد إضافته — لتأكيد بصري قصير */
  flashed: number | null;
  wished: (id: number) => boolean;
  wish: (id: number) => void;
}

const Ctx = createContext<ProContext | null>(null);

export const ProProvider = Ctx.Provider;

export function usePro(): ProContext {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePro خارج ProShell');
  return v;
}
