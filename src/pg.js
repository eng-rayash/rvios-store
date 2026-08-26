// ═══════════════════════════════════════════════════════════
//  جسر PostgreSQL
//
//  الغرض: إبقاء **شكل النداء** كما هو في بقية المشروع
//      db.prepare(sql).all(...) · .get(...) · .run(...)
//  مع تحويل التنفيذ إلى غير متزامن. بذلك تبقى ٣٧١ موضع نداء
//  على حالها ويُضاف إليها `await` فقط، بدل إعادة كتابة كل
//  استعلام بصياغة العميل الجديد.
//
//  العميل: postgres (porsager) — حزمة واحدة بلا اعتماديات
//  متعدّية، فتبقى شجرة الاعتماديات قابلة للتدقيق بنظرة.
// ═══════════════════════════════════════════════════════════
import postgres from 'postgres';

/**
 * SQLite يستعمل `?` وPostgres يستعمل `$1`.
 * نحوّل هنا مرة واحدة بدل تعديل كل جملة في المشروع.
 *
 * الحذر الوحيد: علامة استفهام داخل نصّ حرفي أو تعليق ليست
 * معامِلاً. لذلك نتخطّى ما بين علامتَي اقتباس وما بعد `--`.
 */
export function toPg(text) {
  let out = '';
  let i = 0;
  let n = 0;
  while (i < text.length) {
    const c = text[i];

    if (c === "'" || c === '"') {                 // نصّ حرفي أو مُعرّف مقتبس
      const quote = c;
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === quote && text[j + 1] === quote) { j += 2; continue; }
        if (text[j] === quote) { j++; break; }
        j++;
      }
      out += text.slice(i, j);
      i = j;
      continue;
    }

    if (c === '-' && text[i + 1] === '-') {       // تعليق حتى آخر السطر
      const j = text.indexOf('\n', i);
      const end = j === -1 ? text.length : j;
      out += text.slice(i, end);
      i = end;
      continue;
    }

    if (c === '?') { out += '$' + (++n); i++; continue; }

    out += c;
    i++;
  }
  return out;
}

/** هل الجملة إدراج بلا RETURNING؟ عندها نحتاج المُعرّف المولّد */
const needsReturning = (s) => /^\s*INSERT\s/i.test(s) && !/\bRETURNING\b/i.test(s);

/**
 * الأعداد الكبيرة والعشرية تصل من Postgres كنصوص.
 * `COUNT(*) n` كان يعيد رقماً في SQLite ويعيد "5" هنا، فتنكسر
 * كل مقارنة حسابية بصمت. نُجبر التحويل عند الحدّ لا في كل
 * موضع استدعاء.
 */
const numericTypes = {
  int8:    { to: 20,   from: [20],   serialize: String, parse: Number },
  numeric: { to: 1700, from: [1700], serialize: String, parse: Number },
};

let sql = null;

export function connect(url, { max = 10, idleTimeout = 20, connectTimeout = 15 } = {}) {
  if (sql) return sql;
  sql = postgres(url, {
    max,
    idle_timeout: idleTimeout,
    connect_timeout: connectTimeout,
    types: numericTypes,
    // الاتصالات المُدارة (Supabase · Neon · Render) تفرض TLS،
    // وشهاداتها موقّعة من جذر لا يحمله Node دائماً.
    ssl: /\bsslmode=disable\b/.test(url) ? false : 'require',
    onnotice: () => {},                  // إشعارات NOTICE ليست أخطاء
  });
  return sql;
}

export const raw = () => {
  if (!sql) throw new Error('قاعدة البيانات غير متصلة — استدعِ connect() أولاً');
  return sql;
};

/**
 * الواجهة المتوافقة مع node:sqlite.
 * كل دالة تعيد وعداً، وما عداه مطابق لما كان.
 */
export const db = {
  prepare(text) {
    const q = toPg(text);
    const query = needsReturning(q) ? `${q} RETURNING id` : q;

    return {
      async all(...params) {
        return [...await raw().unsafe(query, params)];
      },
      async get(...params) {
        const rows = await raw().unsafe(query, params);
        return rows[0] ?? null;
      },
      async run(...params) {
        const rows = await raw().unsafe(query, params);
        return {
          changes: rows.count ?? 0,
          lastInsertRowid: rows[0]?.id ?? 0,
        };
      },
    };
  },

  /** جمل بلا معامِلات — إنشاء الجداول والمعاملات */
  async exec(text) {
    await raw().unsafe(text);
  },

  /**
   * معاملة على اتصال **محجوز**.
   *
   * ‏`db.exec('BEGIN')` كان يعمل مع SQLite لأن الاتصال واحد.
   * هنا مجمّع اتصالات: BEGIN قد يقع على اتصال وCOMMIT على
   * آخر، فتبقى المعاملة مفتوحة إلى الأبد ولا يُحجز المخزون.
   * لذلك تُمرَّر الدالة إلى sql.begin فتُنفَّذ كلها على اتصال واحد،
   * ويُرجَع تلقائياً عند رمي أي استثناء.
   */
  async transaction(fn) {
    return raw().begin(async (tx) => {
      const scoped = {
        prepare(text) {
          const q = toPg(text);
          const query = needsReturning(q) ? `${q} RETURNING id` : q;
          return {
            async all(...p) { return [...await tx.unsafe(query, p)]; },
            async get(...p) { const r = await tx.unsafe(query, p); return r[0] ?? null; },
            async run(...p) {
              const r = await tx.unsafe(query, p);
              return { changes: r.count ?? 0, lastInsertRowid: r[0]?.id ?? 0 };
            },
          };
        },
        async exec(text) { await tx.unsafe(text); },
      };
      return fn(scoped);
    });
  },

  async close() {
    if (!sql) return;
    await sql.end({ timeout: 5 });
    sql = null;
  },
};
