# ═══════════════════════════════════════════════════════════
#  RVIOS Store
#  بلا اعتماديات خارجية — الصورة هي Node وحدها والمصدر.
#  لا npm install، لا node_modules، لا شجرة اعتماديات تُدقَّق.
# ═══════════════════════════════════════════════════════════
FROM node:24-alpine

# node:sqlite تحتاج libstdc++ على alpine
RUN apk add --no-cache libstdc++ tini

WORKDIR /app

# المصدر فقط — انظر .dockerignore
COPY package.json ./
COPY src/ ./src/
COPY public/ ./public/
COPY ops/ ./ops/

# البيانات في حجم منفصل: الحاوية تُستبدل عند كل نشر،
# والقاعدة والصور يجب أن تنجو من الاستبدال.
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
