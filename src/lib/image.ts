/**
 * قراءة صورة من جهاز التاجر وتصغيرها قبل الرفع.
 *
 * منقولة عن `readImage` في `public/assets/js/dashboard.js` بقيمها
 * نفسها — ٩٠٠ بكسل للضلع الأطول، وجودة ٠٫٨٢، وحدّ خمسة ميجابايت.
 *
 * ★ الضغط في المتصفّح لا في الخادم، وهذا قرارٌ يخصّ السوق:
 * تاجرٌ يصوّر منتجه بهاتفه يرفع ملفاً بأربعة ميجابايت على شبكة
 * بطيئة. والتصغير قبل الرفع يحوّله إلى عشرات الكيلوبايتات —
 * فيرفع عشر صور في زمن صورةٍ واحدة، ولا ينتظر الخادم شيئاً.
 * ولهذا يقول تعليق `next.config.ts` إن الصور «تُرفع مضغوطة أصلاً».
 */
export async function readImageFile(file: File, maxSide = 900): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('الملف ليس صورة');
  if (file.size > 5 * 1024 * 1024) throw new Error('الصورة أكبر من ٥ ميجابايت');

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('تعذّرت قراءة الصورة'));
      el.src = url;
    });

    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    /* ★ في `finally` لا بعد النجاح: الصورة المعطوبة كانت تترك
       عنوان الكائن معلّقاً في الذاكرة حتى إغلاق التبويب. */
    URL.revokeObjectURL(url);
  }
}
