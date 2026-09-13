// نسخة احتياطية فورية —  npm run backup
import { backupNow } from '../server/backup.js';
import { db } from '../server/pg.js';

try {
  const info = await backupNow('manual');

  if (info.dbSkipped) {
    console.log('\n  ⚠ pg_dump غير متاح — نُسخت الصور وحدها');
    console.log(`    ${info.images} صورة جديدة`);
    console.log('\n  ثبّت postgresql-client لتُنسخ القاعدة أيضاً.\n');
  } else {
    console.log(`\n  ✓ ${info.file}`);
    console.log(`    ${info.kb}KB · ${info.stores} متجر · ${info.orders} طلب · ${info.images} صورة جديدة`);
    if (info.removed) console.log(`    حُذفت ${info.removed} نسخة قديمة`);
    console.log('\n  للعرض والاستعادة:  npm run backup:list\n');
  }
} catch (err) {
  console.error(`\n  ✖ ${err.message}\n`);
  process.exitCode = 1;
} finally {
  await db.close();
}
