import type { Metadata } from 'next';
import { Header } from '@/components/site/header';
import { Footer } from '@/components/site/footer';
import { Reveal } from '@/components/ui/reveal';
import { ContactForm } from '@/components/marketing/contact-form';

export const metadata: Metadata = {
  title: 'تواصل معنا',
  description: 'اترك رقم واتساب ونوع طلبك، ونتواصل معك — عادة خلال يوم عمل واحد.',
};

const SERVICES = [
  {
    title: 'نُنشئ متجرك بدلاً عنك',
    body: 'يتولى فريقنا رفع منتجاتك وكتابة أوصافها وضبط هويتك البصرية كاملة، وتستلم متجراً جاهزاً للمشاركة.',
  },
  {
    title: 'دومين مخصص',
    body: 'اربط نطاقك الخاص بمتجرك بدل الرابط الفرعي — متاح مع باقة برو أو كإضافة منفصلة.',
  },
  {
    title: 'متجر إضافي',
    body: 'لمن لديه أكثر من نشاط تجاري ويريد فصلها تحت الحساب نفسه برابط مستقل لكل واحد.',
  },
];

export default function ContactPage() {
  return (
    <>
      <Header />
      <main className="pt-28">
        <section className="bay bg-cream pt-10">
          <div className="wrap">
            <Reveal className="mx-auto mb-12 max-w-2xl text-center">
              <p className="mb-3.5 text-xs font-extrabold tracking-[.2em] text-brass-deep">تواصل معنا</p>
              <h1 className="mb-4 font-display text-h1 leading-snug font-bold text-balance">
                كيف نساعدك؟
              </h1>
              <p className="text-md leading-loose text-soft text-pretty">
                اترك رقم واتساب ونوع طلبك، ونتواصل معك. عادة خلال يوم عمل واحد.
              </p>
            </Reveal>

            <div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
              <Reveal>
                <ContactForm />
              </Reveal>

              <Reveal delay={0.1} className="grid content-start gap-4">
                {SERVICES.map((s) => (
                  <article key={s.title} className="rounded-xl border border-line bg-paper p-6">
                    <h2 className="mb-2 font-display text-h3 font-bold">{s.title}</h2>
                    <p className="text-sm leading-loose text-soft text-pretty">{s.body}</p>
                  </article>
                ))}

                <div className="rounded-xl border border-line bg-cream p-6">
                  <h2 className="mb-2 font-display text-xl font-bold">هل تحتاج مساعدة سريعة؟</h2>
                  <p className="text-sm leading-loose text-soft text-pretty">
                    إن كان سؤالك عن الباقات أو الحدود، فالأرجح أن جوابه موجود في{' '}
                    <a href="/pricing#faq" className="border-b border-line font-bold text-shop-text">
                      الأسئلة الشائعة
                    </a>{' '}
                    — أسرع من انتظار الرد.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
