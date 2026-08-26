# ═══════════════════════════════════════════════════════════
#  RVIOS Store
#  اعتمادية واحدة: عميل postgres (بلا اعتماديات متعدّية).
#  الشجرة تبقى قابلة للتدقيق بنظرة واحدة: npm ls --all
# ═══════════════════════════════════════════════════════════
FROM node:24-alpine

# tini للإشارات · postgresql-client لـ pg_dump والاستعادة
RUN apk add --no-cache tini postgresql-client

WORKDIR /app

# الاعتماديات في طبقة منفصلة: لا يُعاد تنزيلها ما لم يتغيّر القفل
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

# المصدر فقط — انظر .dockerignore
COPY src/ ./src/
COPY public/ ./public/
COPY ops/ ./ops/

# الصور المرفوعة والنسخ في حجم منفصل: الحاوية تُستبدل عند
# كل نشر، والصور يجب أن تنجو. القاعدة صارت خارجية (Postgres).
RUN mkdir -p /data && chown -R node:node /data /app
VOLUME ["/data"]
ENV DATA_DIR=/data

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    LOG_JSON=1 \
    BACKUP_ENABLED=1

EXPOSE 3000

# مستخدم غير جذر: ثغرة في التطبيق لا تعني ثغرة في المضيف
USER node

# فحص الحياة يستعلم القاعدة — لا يكتفي بأن المنفذ مفتوح
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>r.json()).then(j=>process.exit(j.ok?0:1)).catch(()=>process.exit(1))"

# tini يمرّر SIGTERM للعملية فيعمل الإيقاف الرشيد.
# بدونه تصبح Node هي PID 1 ولا تتلقّى الإشارة كما ينبغي.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--no-warnings", "src/server.js"]
