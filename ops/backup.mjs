// نسخة احتياطية فورية —  npm run backup
import { backupNow } from '../src/backup.js';

try {
  const info = backupNow('manual');
  console.log(`\n  ✓ ${info.file}`);
  console.log(`    ${info.kb}KB · ${info.stores} متجر · ${info.orders} طلب · ${info.images} صورة جديدة`);
  if (info.removed) console.log(`    حُذفت ${info.removed} نسخة قديمة`);
  console.log('\n  للعرض والاستعادة:  npm run backup:list\n');
} catch (err) {
  console.error(`\n  ✖ ${err.message}\n`);
  process.exitCode = 1;
}
