import { cn } from '@/lib/utils';

/**
 * الهيكل العظمي — شكل المحتوى قبل وصوله.
 *
 * التطبيق كلّه لم يكن فيه واحدٌ منها ولا ملف `loading.tsx` واحد.
 * فالانتقال بين الشاشات على شبكة يمنية بطيئة كان صفحةً بيضاء
 * ثم قفزة — والتاجر لا يعرف هل ضغط أم لم يضغط.
 *
 * ★ النبض لا اللمعان المنزلق.
 * كان `tokens.css` يحرّك تدرّجاً عبر السطح. وهو جميل في عنصر
 * واحد وصاخب في شبكة من عشرين: عشرون ضوءاً ينزلق كلٌّ في
 * طوره. والنبض يخفت ويعود معاً فيُقرأ الشاشة كلها «تنتظر» لا
 * عشرين شيئاً يتحرّك. ويسقط كاملاً مع تفضيل السكون.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'block rounded-sm bg-sand animate-pulse motion-reduce:animate-none',
        className,
      )}
    />
  );
}
