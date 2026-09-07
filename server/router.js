// ═══════════════════════════════════════════════════════════
//  موجّه بسيط: /api/products/:id  →  params.id
// ═══════════════════════════════════════════════════════════

function compile(pattern) {
  const names = [];
  const source = pattern
    .replace(/[.+*?^${}()|[\]\\]/g, '\\$&')
    .replace(/:([A-Za-z_]\w*)/g, (_, n) => { names.push(n); return '([^/]+)'; });
  return { regex: new RegExp(`^${source}$`), names };
}

export function createRouter() {
  const routes = [];
  const add = (method, pattern, handler) => {
    routes.push({ method, handler, ...compile(pattern) });
  };

  return {
    get:    (p, h) => add('GET', p, h),
    post:   (p, h) => add('POST', p, h),
    patch:  (p, h) => add('PATCH', p, h),
    put:    (p, h) => add('PUT', p, h),
    delete: (p, h) => add('DELETE', p, h),

    match(method, pathname) {
      for (const r of routes) {
        if (r.method !== method) continue;
        const m = r.regex.exec(pathname);
        if (!m) continue;
        const params = {};
        r.names.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
        return { handler: r.handler, params };
      }
      return null;
    },

    /** هل يوجد مسار بهذا الشكل بطريقة أخرى؟ (لردّ 405 بدل 404) */
    allowed(pathname) {
      return routes.filter((r) => r.regex.test(pathname)).map((r) => r.method);
    },
  };
}
