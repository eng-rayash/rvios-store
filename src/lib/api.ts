/**
 * عميل الـAPI — نسخة Next من `public/assets/js/app.js`.
 *
 * العقد نفسه حرفياً لأن الخادم لم يتغيّر: يردّ `{ error, code }`
 * عند الفشل، ويقبل ترويسة `x-store` لتحديد المتجر النشط. وأي
 * انحراف هنا يعني رسالة خطأ تظهر في الصفحة القديمة ولا تظهر في
 * الجديدة — وهو عيب لا يكسر شيئاً فيصعب تتبّعه.
 *
 * ★ لماذا لا يُستورد `app.js` مباشرةً؟
 * لنفس سبب `theme-core`: Turbopack لا يستورد من خارج جذر
 * التطبيق. والفرق أن هذا **ليس نسخة محروسة** — `check-theme`
 * يحرس محرّك الألوان وجدول الدول والقطاعات لأن انحرافها يُنتج
 * بيانات مختلفة. وهذا الملف طبقة نقل: انحرافه يظهر فوراً في
 * أول نداء فاشل، فلا يحتاج حارساً.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * المتجر النشط في هذا التبويب.
 * يُرسل ترويسةً مع كل نداء، فيعمل تبويبان على متجرين مختلفين بلا
 * تعارض — الجلسة تحفظ الاختيار، والترويسة تتجاوزه لهذا التبويب.
 */
let activeStore: string | null = null;
export const setApiStore = (slugOrId?: string | number | null) => {
  activeStore = slugOrId ? String(slugOrId) : null;
};
export const getApiStore = () => activeStore;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(activeStore ? { 'x-store': activeStore } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError('تعذّر الاتصال بالخادم — تحقق من اتصالك', 0, 'NETWORK');
  }

  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* ردّ غير JSON */ }

  if (!res.ok) {
    const err = data as { error?: string; code?: string } | null;
    throw new ApiError(err?.error ?? `خطأ ${res.status}`, res.status, err?.code ?? '');
  }
  return data as T;
}

export const api = {
  get:   <T>(p: string) => request<T>('GET', p),
  post:  <T>(p: string, b?: unknown) => request<T>('POST', p, b),
  patch: <T>(p: string, b?: unknown) => request<T>('PATCH', p, b),
  del:   <T>(p: string) => request<T>('DELETE', p),
};

/** رسالة الخطأ كما تُعرض للتاجر — ولا تُسرَّب تفاصيل غير مفهومة */
export const messageOf = (e: unknown) =>
  e instanceof ApiError ? e.message : 'حدث خطأ غير متوقّع — حاول مجدداً';
