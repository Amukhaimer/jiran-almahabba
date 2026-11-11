# النقل من Railway إلى VPS خاص

المكوّنات على السيرفر الجديد (`docker-compose.yml`):

- **app** — التطبيق نفسه (نفس الـ Dockerfile الحالي).
- **caddy** — HTTPS تلقائي على الدومين (شهادة Let's Encrypt تتجدد وحدها).
- **backup** — نسخة يومية من قاعدة البيانات في `storage/backups` تُحفظ 14 يوماً.

قاعدة البيانات على السيرفر: `web/storage/prod.db`.

## 1) تجهيز السيرفر (مرة واحدة)

سيرفر Ubuntu 22.04 أو أحدث، يكفي 1 vCPU و 2GB RAM (البناء يحتاج ذاكرة؛ مع 1GB أضف swap).

```bash
curl -fsSL https://get.docker.com | sh
```

```bash
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

## 2) جلب الكود

```bash
git clone https://github.com/Amukhaimer/jiran-almahabba.git /opt/jiran && cd /opt/jiran/web
```

```bash
cp .env.example .env && nano .env
```

ضع الدومين الحقيقي في `DOMAIN=`.

## 3) نقل البيانات من Railway

> أوقف إدخال البيانات على الموقع القديم من هذه اللحظة حتى نهاية النقل، حتى لا تُفقد أي دفعة.

على جهازك (بعد `npm i -g @railway/cli` ثم `railway login` و `railway link`):

```bash
railway ssh "base64 -w0 /data/prod.db" > prod.db.b64
```

```bash
base64 -d prod.db.b64 > prod.db
```

(إن اختلفت صيغة الأمر في نسختك راجع `railway ssh --help` — المطلوب فقط الحصول على الملف `/data/prod.db`.)

تحقّق أن الملف سليم قبل رفعه (يجب أن يطبع `ok`):

```bash
sqlite3 prod.db "PRAGMA integrity_check;"
```

ثم ارفعه إلى السيرفر:

```bash
ssh root@SERVER_IP "mkdir -p /opt/jiran/web/storage"
```

```bash
scp prod.db root@SERVER_IP:/opt/jiran/web/storage/prod.db
```

مهم: ارفع الملف **قبل** أول تشغيل. إن لم يوجد `storage/prod.db` سيبدأ التطبيق بقاعدة بيانات الإكسل الأولية.

## 4) التشغيل

```bash
cd /opt/jiran/web && docker compose up -d --build
```

```bash
docker compose logs -f app
```

يجب ألا يظهر السطر `Initializing database from seed...` (ظهوره يعني أن ملف البيانات لم يُرفع في مكانه).

## 5) تحويل الدومين

1. عند مزوّد الدومين: سجل `A` للدومين يشير إلى IP السيرفر.
2. بعد انتشار الـ DNS يصدر Caddy الشهادة تلقائياً (`docker compose logs caddy`).
3. افتح الموقع وطابق الأرقام (عدد الجيران، مجموع الدفعات، آخر سند) مع الموقع القديم.
4. بعد التأكد ويومين من العمل السليم: أوقف خدمة Railway ثم احذفها.

## التحديث لاحقاً

```bash
cd /opt/jiran/web && git pull && docker compose up -d --build
```

## استرجاع نسخة احتياطية

```bash
cd /opt/jiran/web && docker compose stop app && cp storage/backups/prod-YYYY-MM-DD.db storage/prod.db && docker compose start app
```

النسخ الاحتياطية موجودة على نفس السيرفر؛ يُنصح بسحب نسخة دورية إلى جهازك:

```bash
scp -r root@SERVER_IP:/opt/jiran/web/storage/backups ./jiran-backups
```
