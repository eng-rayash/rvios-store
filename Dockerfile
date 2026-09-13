# ═══════════════════════════════════════════════════════════
#  RVIOS Store — صورة واحدة، عمليتان
#
#  المشروع حزمة واحدة تقلع خادمين: Next على المنفذ العام،
#  والخادم القديم خلفه على منفذ داخلي (انظر scripts/start.mjs).
#
#  الخادم نفسه ما يزال على اعتمادية واحدة (`postgres`) — يحرس
#  ذلك `npm run check:server-deps` لا شجرةُ الاعتماديات، لأن
#  الشجرة صارت تضمّ Next وReact أيضاً بعد الدمج.
# ═══════════════════════════════════════════════════════════

# ── مرحلة البناء ─────────────────────────────────────────
# devDependencies ضرورية هنا (tailwind · typescript) ولا تدخل
# الصورة النهائية إلا عبر ما أنتجته: مجلّد .next وحده.
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY . .

# قيمة صوريّة: وحدة القاعدة ترمي عند الاستيراد إن غاب المتغيّر،
# ولا قاعدة أثناء بناء الصورة. القراءات نفسها تفشل فتُصيَّر
# الرئيسية بلا مشهد (انظر soft في src/lib/showcase.ts)، ويملؤه
# أوّل تجديد بعد الإقلاع. القيمة الحقيقية تصل وقت التشغيل.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?sslmode=disable

# ‏build يبدأ بـcheck-theme: نسختان متباعدتان من محرّك الألوان
# تُوقفان البناء هنا بدل أن تُنتجا متجراً بلونين حسب الصفحة.
RUN npm run build

# ── مرحلة التشغيل ────────────────────────────────────────
FROM node:24-alpine

# tini للإشارات · postgresql-client لـ pg_dump والاستعادة
RUN apk add --no-cache tini postgresql-client

WORKDIR /app

# ‏node_modules تأتي كاملةً من مرحلة البناء لا بـnpm ci --omit=dev:
# ‏`next start` يقرأ next.config.ts، وقراءة إعداد TypeScript
# تحتاج الحزمة نفسها. حذفها يوفّر عشرات الميغابايتات ويُسقط
# الإقلاع — والمقايضة ليست في صالحنا.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next

COPY package.json package-lock.json* next.config.ts tsconfig.json ./
COPY server/ ./server/
COPY public/ ./public/
COPY ops/ ./ops/
COPY scripts/ ./scripts/

# الصور المرفوعة والنسخ في حجم منفصل: الحاوية تُستبدل عند
# كل نشر، والصور يجب أن تنجو. القاعدة صارت خارجية (Postgres).
RUN mkdir -p /data && chown -R node:node /data /app
VOLUME ["/data"]
ENV DATA_DIR=/data

ENV NODE_ENV=production \
    PORT=3000 \
    LEGACY_PORT=3100 \
    HOST=0.0.0.0 \
    LOG_JSON=1 \
    BACKUP_ENABLED=1

# المنفذ العام واحد: Next. والخادم القديم على LEGACY_PORT لا
# يخرج من الحاوية — يصله الطلب مُمرَّراً من Next وحده.
EXPOSE 3000

# مستخدم غير جذر: ثغرة في التطبيق لا تعني ثغرة في المضيف
USER node

# فحص الحياة يستعلم القاعدة — لا يكتفي بأن المنفذ مفتوح.
# يمرّ عبر Next إلى /health في الخادم القديم، فيثبت أن الطريق
# بين العمليتين سالك أيضاً لا أن كلاً منهما حيّة وحدها.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>r.json()).then(j=>process.exit(j.ok?0:1)).catch(()=>process.exit(1))"

# tini يمرّر SIGTERM للعملية فيعمل الإيقاف الرشيد.
# بدونه تصبح Node هي PID 1 ولا تتلقّى الإشارة كما ينبغي.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "scripts/start.mjs"]
