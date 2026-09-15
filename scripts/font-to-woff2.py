#!/usr/bin/env python
"""
تحويل خطّ (OTF/TTF) إلى WOFF2 — نفس المحارف، بترميز جدولٍ أحدث.

لماذا هنا لا في سجلّ جلسة: `next/font/local` يخدم الملفّ **كما هو**
بلا تحويل ولا تجزئة. فوجهٌ يدخل المشروع بـ.otf يصل الزائر بحجمه
كاملاً — و«ثمانية» بوزنيها كانت ٤٨٠ ك.ب على المسار الحرج، وهو ما
لا يُحتمل على شبكةٍ بُنيت بقيّةُ قرارات هذا المشروع لأجل بطئها.
التحويل يردّها إلى ١٥٧ ك.ب بلا فقدان محرف واحد.

فمن يضيف وجهاً جديداً لاحقاً يحوّله بهذا قبل تسجيله:

    python scripts/font-to-woff2.py public/fonts/NewFace.otf

ويحتاج: pip install fonttools brotli
"""
import os
import sys

from fontTools.ttLib import TTFont


def convert(src: str) -> str:
    if not os.path.exists(src):
        sys.exit(f'لا ملف: {src}')
    dst = os.path.splitext(src)[0] + '.woff2'
    font = TTFont(src)
    font.flavor = 'woff2'
    font.save(dst)
    a, b = os.path.getsize(src), os.path.getsize(dst)
    print(f'{os.path.basename(src)}  {a / 1024:.0f} ك.ب ← {b / 1024:.0f} ك.ب'
          f'  (أصغر بـ{100 - b * 100 // a:.0f}٪)')
    return dst


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for path in sys.argv[1:]:
        convert(path)
