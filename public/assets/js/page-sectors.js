// سكربت صفحة /sectors — أُخرج من HTML ليعمل مع CSP الصارم
import { $, api, AR, escapeHtml } from '/assets/js/app.js';
import '/assets/js/site.js';

const SECTORS = [
  { id: 'fashion',    n: 'الأزياء والملابس', d: 'M12 3 8 5 3 8l3 4 2-1v8h8v-8l2 1 3-4-5-3-4-2z',
    p: 'اعرض كل مقاس ولون في بطاقة واحدة، ورتّب المجموعات في تصنيفات موسمية تحدّثها متى شئت.',
    ex: ['فساتين', 'عبايات', 'ملابس أطفال', 'أحذية'] },
  { id: 'perfumes',   n: 'العطور والبخور', d: 'M9 2h6v3H9zM7 5h10l1 15H6z',
    p: 'الأحجام والعائلات العطرية تظهر بوضوح في البطاقة، ومؤشر التوفّر يخلق إلحاحاً صادقاً بلا مبالغة.',
    ex: ['عطور رجالية', 'عطور نسائية', 'عود وبخور', 'أطقم هدايا'] },
  { id: 'electronics', n: 'الإلكترونيات', d: 'M4 5h16v11H4zM9 20h6M12 16v4',
    p: 'المواصفات في وصف المنتج، والمخزون محدَّث لحظياً حتى لا يطلب العميل ما نفد.',
    ex: ['هواتف', 'ملحقات', 'سماعات', 'أجهزة منزلية'] },
  { id: 'sweets',     n: 'الأطعمة والحلويات', d: 'M4 4h16v6a8 8 0 0 1-16 0zM4 20h16',
    p: 'أوقات العمل ظاهرة في المتجر، والطلب يصلك عبر واتساب فوراً لتتفق على وقت التسليم.',
    ex: ['حلويات', 'معجنات', 'قهوة', 'تموين مناسبات'] },
  { id: 'accessories', n: 'الإكسسوارات', d: 'M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM8 12l-3 9 7-4 7 4-3-9',
    p: 'قطع صغيرة كثيرة؟ الشبكة والفلاتر تجعل التصفّح سريعاً حتى على إنترنت بطيء.',
    ex: ['ساعات', 'حقائب', 'مجوهرات', 'نظارات'] },
  { id: 'home',       n: 'مستلزمات المنزل', d: 'm3 11 9-8 9 8M6 10v10h12V10',
    p: 'صور بأبعاد مختلفة؟ الشبكة تتعامل معها بلا كسر، فلا تحتاج تعديل صورك قبل الرفع.',
    ex: ['أدوات مطبخ', 'مفروشات', 'ديكور', 'تنظيم'] },
];

$('#cards').innerHTML = SECTORS.map((s, i) => `
  <article class="card rv sector-card" data-d="${(i % 6) + 1}">
    <div class="sector-shot">
      <img src="/assets/img/sectors/${s.id}.jpg" alt="${escapeHtml(s.n)}" loading="lazy" decoding="async">
    </div>
    <div class="sector-body">
      <h3>${escapeHtml(s.n)}</h3>
      <p>${escapeHtml(s.p)}</p>
      <div class="sector-tags">
        ${s.ex.map((e) => `<span class="badge b-done">${escapeHtml(e)}</span>`).join('')}
      </div>
    </div>
  </article>`).join('');

new IntersectionObserver((es, o) => es.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('in'); o.unobserve(e.target); }
}), { threshold: .15 }).observe;
document.querySelectorAll('.rv').forEach((el) => el.classList.add('in'));
