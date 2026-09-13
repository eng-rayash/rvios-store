import {
  House, ShoppingCart, Package, ListTree, Users, Star, Truck, Settings, CreditCard,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** يُطابَق حرفياً — «نظرة عامة» لا تُضاء تحت كل مسار يبدأ بـ/dashboard */
  exact?: boolean;
  /** عدّادٌ يُعرض بجوار الرابط */
  badge?: 'pending';
}

/**
 * خريطة اللوحة — مصدرٌ واحد للشريط الجانبي والشريط السفلي و«المزيد».
 *
 * كانت الأزرار مكتوبة في `dashboard.html` بأيقوناتها كـSVG خام،
 * وأي شاشة تُضاف تعني تعديلها في موضعين على الأقلّ.
 */
export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'المتجر',
    items: [
      { href: '/dashboard', label: 'نظرة عامة', icon: House, exact: true },
      { href: '/dashboard/orders', label: 'الطلبات', icon: ShoppingCart, badge: 'pending' },
      { href: '/dashboard/products', label: 'المنتجات', icon: Package },
      { href: '/dashboard/categories', label: 'التصنيفات', icon: ListTree },
      { href: '/dashboard/customers', label: 'العملاء', icon: Users },
      { href: '/dashboard/reviews', label: 'التقييمات', icon: Star },
    ],
  },
  {
    group: 'الإعدادات',
    items: [
      { href: '/dashboard/delivery', label: 'التوصيل والدفع', icon: Truck },
      { href: '/dashboard/settings', label: 'إعدادات المتجر', icon: Settings },
      { href: '/dashboard/plan', label: 'الاشتراك', icon: CreditCard },
    ],
  },
];

export const ALL = NAV.flatMap((g) => g.items);

/**
 * ★ على الهاتف ثلاث وجهات في الشريط السفلي والبقية خلف «المزيد».
 * ثلاث لأنها ما يفتحه تاجر واتساب عشرات المرّات يومياً: هل وصل
 * طلب؟ ما حاله؟ هل المنتج متوفّر؟ أمّا لون المتجر ومناطق التوصيل
 * فتُضبط مرّة في الشهر — ولا تستحقّ مكاناً تحت إبهامه دائماً.
 */
export const PRIMARY = ['/dashboard', '/dashboard/orders', '/dashboard/products'];

export const isActive = (pathname: string, item: NavItem) =>
  item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

export const titleOf = (pathname: string) =>
  ALL.find((i) => isActive(pathname, i))?.label ?? 'لوحة التحكم';
