import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'قيد النقل' };

/**
 * ★ مؤقّت — يُحذف حين تكتمل شاشات اللوحة الثماني.
 *
 * لماذا يوجد: `/dashboard` خرج من الخادم القديم، لكن الشاشات
 * الأخرى تُبنى واحدةً بعد أخرى. وبدون هذا المسار الجامع يسقط
 * `/dashboard/orders` على إعادة الكتابة الاحتياطية إلى الخادم
 * القديم — فتُعرض صفحة ٤٠٤ القديمة **وتحت CSP الجديد** الذي يحجب
 * سكربتها. أي صفحة معطوبة بلا تفسير.
 *
 * ولا يحتاج أن يُتذكَّر: المسار المحدَّد (`orders/page.tsx`) يغلب
 * المسار الجامع في Next، فكل شاشة تُبنى تسحب مسارها منه تلقائياً.
 */
export default function PendingScreen() {
  return (
    <EmptyState
      icon={<Sparkles className="size-6" aria-hidden />}
      title="هذه الشاشة تُنقل إلى اللوحة الجديدة"
      action={
        <Link href="/dashboard" className={cn(buttonVariants({ tone: 'line', size: 'sm' }))}>
          <ArrowLeft className="size-3.5" aria-hidden />
          إلى النظرة العامة
        </Link>
      }
    >
      نعيد بناءها بالتصميم الجديد، وستظهر هنا حين تكتمل.
    </EmptyState>
  );
}
