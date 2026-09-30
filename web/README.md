# جيران المحبة — إدارة خدمات البناية

## تشغيل محلي

```bash
cd web
npm install
npx prisma db push
npm run db:seed
npm run dev
```

افتح: http://localhost:3000

## الرفع أونلاين (Railway)

1. ارفع مجلد المشروع على GitHub (محتوى `web` هو التطبيق)
2. على [railway.app](https://railway.app): New Project → Deploy from GitHub
3. Root Directory: `web`
4. أضف **Volume** على المسار `/data`
5. Variables:
   - `DATABASE_URL=file:/data/prod.db`
   - `HOSTNAME=0.0.0.0`
6. Generate Domain من Settings

أول تشغيل ينسخ قاعدة بيانات فيها بيانات الإكسل تلقائياً.
