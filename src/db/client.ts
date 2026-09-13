/**
 * اتصال قاعدة البيانات.
 *
 * القاعدة **مشتركة** مع الخادم القديم أثناء الترحيل: النظامان
 * يقرآن ويكتبان الجداول نفسها في الوقت نفسه. ولذلك:
 *   · لا `drizzle-kit push` ولا هجرات من هنا — البنية تُغيَّر
 *     في `ops/sql/schema.pg.sql` وحده (انظر التعليق في schema.ts).
 *   · حوض اتصالات صغير: القاعدة خلف مجمّع Supabase، وفتح حوض
 *     كبير من كل عملية Next.js يستنزف حصّة الاتصالات ويُسقط
 *     الخادم القديم معه.
 *
 * في التطوير يُخزَّن الاتصال على globalThis، وإلا فتح كل إعادة
 * تحميل ساخنة حوضاً جديداً حتى ينفد رصيد الاتصالات.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL غير مضبوط — انسخه من .env في جذر المشروع');
}

const globalForDb = globalThis as unknown as { rvSql?: ReturnType<typeof postgres> };

const sql = globalForDb.rvSql ?? postgres(url, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 15,
  // المجمّع لا يدعم العبارات المُحضَّرة
  prepare: false,
});

if (process.env.NODE_ENV !== 'production') globalForDb.rvSql = sql;

export const db = drizzle(sql, { schema });
export { sql };
