'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import { api, messageOf, setApiStore } from '@/lib/api';
import type { Capacity } from '@/components/dash/capacity-meter';
import type { ChartDay } from '@/components/dash/visits-chart';
import type { Order } from '@/components/dash/order-row';

/* ── عقود الخادم — تطابق ردود server/routes/*.js حرفياً ── */

/** عنصر من `stores` في `/api/auth/me` — `storeSummary` المحلية في routes/auth.js */
export interface StoreLite {
  id: number; slug: string; name: string; logo: string | null;
  color: string; plan: string; status: string; url: string;
}

export interface Me {
  authenticated: true;
  merchant: { id: number; phone: string; name: string };
  stores: StoreLite[];
  slots: { owned: number; slots: number; free: number };
  hasStore: boolean;
}

/**
 * `publicStore()` في routes/merchant.js — **بكامل حقوله**.
 *
 * ★ النوع يطابق الدالّة حقلاً بحقل لا «ما تحتاجه الشاشة الحالية».
 * نوعٌ ناقص لا يُنتج خطأً عند القراءة من الخادم — الحقل يصل
 * ويعمل — بل عند أوّل شاشةٍ تستعمله، فيبدو الخطأ في الشاشة
 * الجديدة بينما أصله هنا. و`savedTheme`/`savedLayout` مهمّان:
 * `theme` هو **الفعّال** بعد قيد الباقة، و`savedTheme` هو ما
 * اختاره التاجر فعلاً — واللوحة تعرض اختياره لا ما سقط إليه.
 */
export interface Store {
  id: number; slug: string; name: string; sector: string;
  tagline: string; about: string; city: string; address: string;
  whatsapp: string; hours: string;
  logo: string | null; banner: string | null; showcase: string;
  color: string; colorDeep: string | null;
  plan: string;
  theme: string; savedTheme: string;
  layout: string; savedLayout: string;
  verified: boolean; status: string; createdAt: string;
  country: string; currency: string; url: string;
  deliveryFee: number; deliveryFreeOver: number; deliveryNote: string;
  /** قائمة مفصولة بفواصل: `cod,wallet` */
  payMethods: string; payNote: string;
}

export interface Plan { id: string; name: string }

export interface Overview {
  kpis: { pending: number; visits: number; products: number; confirmed: number };
  chart: ChartDay[];
  capacity: Capacity;
  recent: Order[];
}

type Session =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; me: Me; store: Store; plan: Plan };

interface DashValue {
  session: Session;
  /** النظرة العامة — تحملها القشرة لأن شارة «الطلبات المعلّقة» منها */
  overview: { data: Overview | null; error: string | null };
  reloadOverview: () => Promise<void>;
  /**
   * يُعيد قراءة المتجر بعد حفظ الإعدادات.
   *
   * ★ لا يمرّ بـ`loading`: شاشة الإعدادات تحفظ ثم تبقى مكانها،
   * ولو أعدنا الإقلاع كاملاً لاختفى النموذج تحت هيكلٍ عظمي
   * وعاد فارغاً — فيظنّ التاجر أن حفظه ضاع. الاسم والشعار واللون
   * في القشرة تتبدّل هنا وحدها.
   */
  reloadStore: () => Promise<void>;
  retry: () => void;
  switchStore: (slug: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<DashValue | null>(null);

/**
 * حالة اللوحة المشتركة: من التاجر، وأي متجر نشط، وبأي باقة.
 *
 * ★ تسلسل الإقلاع منقول من `dashboard.js` بترتيبه، والترتيب هو
 * العقد: الجلسة أولاً (وإلا فإلى الدخول)، ثم وجود متجر (وإلا
 * فإلى الإعداد)، ثم المتجر نفسه — و**بعده** تُضبط ترويسة
 * `x-store`. لو جُلبت شاشةٌ قبل ضبطها لأخذت متجر الجلسة لا متجر
 * هذا التبويب، فيرى تاجرٌ فتح متجرين في تبويبين طلبات الأوّل
 * تحت اسم الثاني. ولهذا لا تُصيَّر الشاشات قبل `ready`.
 */
export function DashProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ phase: 'loading' });
  const [overview, setOverview] = useState<DashValue['overview']>({ data: null, error: null });

  const boot = useCallback(async () => {
    setSession({ phase: 'loading' });
    try {
      const me = await api.get<Me | { authenticated: false }>('/api/auth/me');
      if (!me.authenticated) { window.location.href = '/login'; return; }
      if (!me.hasStore) { window.location.href = '/onboarding'; return; }

      const { store, plan } = await api.get<{ store: Store; plan: Plan }>('/api/me/store');
      setApiStore(store.slug);
      setSession({ phase: 'ready', me, store, plan });
    } catch (e) {
      setSession({ phase: 'error', message: messageOf(e) });
    }
  }, []);

  const reloadOverview = useCallback(async () => {
    try {
      setOverview({ data: await api.get<Overview>('/api/me/overview'), error: null });
    } catch (e) {
      setOverview((o) => ({ data: o.data, error: messageOf(e) }));
    }
  }, []);

  useEffect(() => { void boot(); }, [boot]);

  const ready = session.phase === 'ready';
  useEffect(() => { if (ready) void reloadOverview(); }, [ready, reloadOverview]);

  /**
   * ★ تبديل المتجر يُعيد تحميل الصفحة كاملة.
   * اللوحة القديمة كانت تُعيد استدعاء ستّة محمّلات يدوياً — وأي
   * شاشة تُضاف لاحقاً وتُنسى في تلك القائمة تبقى تعرض بيانات
   * المتجر السابق. وإعادة التحميل لا تنسى شيئاً: الخادم حفظ
   * المتجر النشط في الجلسة، فكل شاشة تبدأ منه من جديد.
   */
  const switchStore = useCallback(async (slug: string) => {
    await api.post('/api/me/active-store', { store: slug });
    window.location.reload();
  }, []);

  /* إلى الرئيسية كما في اللوحة القديمة — لا إلى الدخول: من خرج
     للتوّ لا يريد أن يُعرض عليه الدخول ثانيةً */
  const logout = useCallback(async () => {
    try { await api.post('/api/auth/logout'); } finally {
      window.location.href = '/';
    }
  }, []);

  const reloadStore = useCallback(async () => {
    const { store, plan } = await api.get<{ store: Store; plan: Plan }>('/api/me/store');
    setSession((s) => (s.phase === 'ready' ? { ...s, store, plan } : s));
  }, []);

  const value = useMemo<DashValue>(() => ({
    session, overview, reloadOverview, reloadStore, retry: boot, switchStore, logout,
  }), [session, overview, reloadOverview, reloadStore, boot, switchStore, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDash() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDash يُستدعى داخل DashProvider وحده');
  return v;
}

/**
 * للشاشات: المتجر مضمون الوجود.
 * القشرة لا تُصيّر الشاشات قبل `ready`، فالرمي هنا يعني خطأ
 * تركيبٍ في الشجرة لا حالةَ تحميل يجب معالجتها.
 */
export function useStore() {
  const { session } = useDash();
  if (session.phase !== 'ready') throw new Error('useStore قبل اكتمال الإقلاع');
  return session;
}
