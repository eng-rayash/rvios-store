'use client';

import { createContext, useContext } from 'react';
import type { BrandView, CategoryView, OptionAxis, ProductView, StoreView } from '@/lib/store';

/**
 * سياق قالب «أتولييه».
 *
 * سياقٌ مستقلّ عن `pro/context.tsx` وإن تشابه اليوم: القالبان
 * محوران يجب أن يفترقا بحرّية — أوّل حاجة يخصّ بها أحدهما نفسه
 * تصير في سياقٍ مشترك عبئاً على الآخر، والفصل الآن أرخص من
 * الفكّ لاحقاً.
 *
 * والفرق الحاضر أصلاً: `open` هنا تقبل **خياراً مبدئياً**، لأن
 * الزائر في متجر أزياء ينقر مقاساً في الشبكة لا اسم المنتج.
 */
export interface AtelierContext {
  store: StoreView;
  categories: CategoryView[];
  brands: BrandView[];
  /**
   * يفتح ورقة المنتج، وربما على خيار مختار مسبقاً (مقاس نُقر
   * في الشبكة) وصورة اللون الذي كان معروضاً على البطاقة.
   */
  open: (p: ProductView, preset?: { v1?: string; v2?: string; cover?: string }) => void;
  /** إضافة سريعة — القطعة ذات الخيارات تُفتح ورقتها بدل تخمين مقاس */
  add: (p: ProductView) => void;
  /** المنتج الذي ومض للتوّ بعد إضافته — تأكيد بصري قصير */
  flashed: number | null;
  wished: (id: number) => boolean;
  wish: (id: number) => void;
}

const Ctx = createContext<AtelierContext | null>(null);

export const AtelierProvider = Ctx.Provider;

export function useAtelier(): AtelierContext {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAtelier خارج AtelierShell');
  return v;
}

/**
 * محورا الخيارات كما يقرؤهما هذا القالب: أيّهما يُعرض بالصورة
 * وأيّهما بالنصّ.
 *
 * **لا نخمّن من الاسم**: التاجر قد يكتب «اللون» أو «الدرجة» أو
 * «الخامة»، وقائمةُ كلماتٍ نطابقها تفشل عند أول تاجر يكتب
 * غيرها.
 *
 * ولا يكفي «المحور الذي لقيمه صور»: الصورة تُحفظ على صفّ
 * الخيار (مقاس × لون)، فكل مقاس يرث صورة أول لون — ويبدو
 * المحوران مصوَّرين معاً.
 *
 * الدليل الصادق هو **تنوّع** الصور: محور اللون تختلف صورة كل
 * قيمة فيه، ومحور المقاس تتكرّر فيه الصورة نفسها. فنقيس عدد
 * الصور المتمايزة، ونرجّح الأكثر تنوّعاً، ثم الأقلّ قيماً عند
 * التساوي (الألوان أقلّ من المقاسات عادةً).
 *
 * ومحورٌ وحيد لا يصير عيّنات ألوان إلا إذا صُوِّرت قيمه فعلاً
 * بصور مختلفة — وإلا فهو مقاسٌ يُعرض نصّاً.
 */
export function splitAxes(p: ProductView) {
  const variety = (a: OptionAxis) =>
    new Set(a.values.map((v) => v.image).filter(Boolean)).size;

  const shot = p.axes.filter((a) => variety(a) > 0);
  const ranked = [...shot].sort(
    (a, b) => variety(b) - variety(a) || a.values.length - b.values.length,
  );

  const visual = p.axes.length === 1
    ? (variety(p.axes[0]) >= 2 ? p.axes[0] : null)
    : (ranked[0] ?? null);

  const plain = p.axes.find((a) => a !== visual) ?? null;
  return { visual, plain };
}
