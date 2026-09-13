import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Plaque } from '@/components/ui/plaque';

/**
 * حالة الفراغ — أوّل ما يراه تاجرٌ جديد في كل شاشة.
 *
 * ★ لماذا لوحٌ معلّق صغير حول الأيقونة؟
 * لأن الفراغ هو اللحظة الأكثر تكراراً في حياة متجر جديد: لا
 * طلبات، لا عملاء، لا تقييمات — كلها فارغة في الأسبوع الأول.
 * ولو كانت أيقونةً رمادية عامّة لقُرئت اللوحة كلها «قالباً لم
 * يُملأ». واللوح نفسه الذي في صفحة ٤٠٤ وعمود الدخول يقول هنا:
 * هذا مكانٌ ينتظر لوحته، لا شاشةٌ معطّلة.
 *
 * وكانت أربع نسخ مختلفة من حالة الفراغ في المتجر وحده — أيقونة
 * بمقاسين، مؤطّرة وغير مؤطّرة، بخطاب مذكّر ومؤنّث. هذه واحدة.
 */
export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  /** السطر الذي يقول **ماذا يفعل** التاجر لا ماذا ينقصه */
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-roomy py-12 text-center', className)}>
      {/* `pt-4` متّسع القضيب النحاسي فوق اللوح */}
      <div className="pt-4">
        <Plaque rail className="grid size-16 place-items-center text-soft">
          {icon}
        </Plaque>
      </div>
      <p className="mt-roomy text-md font-bold text-ink">{title}</p>
      {children && (
        <p className="mt-1.5 max-w-sm text-sm leading-loose text-soft">{children}</p>
      )}
      {action && <div className="mt-roomy">{action}</div>}
    </div>
  );
}
