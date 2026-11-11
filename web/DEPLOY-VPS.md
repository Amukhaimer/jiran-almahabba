# النقل من Railway إلى سيرفر jumanlady.com

السيرفر (`100.42.184.124`) يشغّل أصلاً nginx على المنفذين 80 و443 لموقع jumanlady.com، لذلك:

- التطبيق يعمل داخل Docker ويستمع فقط على `127.0.0.1:3100` (غير مكشوف للإنترنت).
- nginx الموجود يستقبل الدومين ويحوّله للتطبيق عبر ملف موقع **مستقل** — إعدادات jumanlady.com لا تُمسّ.
- خدمة `backup` تحفظ نسخة يومية من قاعدة البيانات في `storage/backups` لمدة 14 يوماً.

قاعدة البيانات على السيرفر: `/opt/jiran/web/storage/prod.db`.

## 0) فحص السيرفر قبل أي شيء

```bash
docker --version; nginx -v; ls /etc/nginx/sites-enabled /etc/nginx/conf.d; ss -ltnp | grep -E ':(3000|3100)\b'; free -m
```

- إن لم يكن Docker مثبّتاً: `curl -fsSL https://get.docker.com | sh` (لا يؤثر على nginx أو الموقع الحالي).
- إن كان المنفذ 3100 مستخدماً: اختر منفذاً آخر وضعه في `.env` (`APP_PORT=`) وفي سطر `proxy_pass`.
- بناء التطبيق يحتاج نحو 1.5GB ذاكرة حرة؛ إن كانت الذاكرة قليلة ابنِ في وقت هدوء الموقع الآخر أو أضف swap.
- إن كان nginx تديره لوحة تحكم (aaPanel, CloudPanel, Plesk...) فأضف الموقع كـ reverse proxy من اللوحة بدل الخطوة 4.

## 1) جلب الكود

```bash
git clone https://github.com/Amukhaimer/jiran-almahabba.git /opt/jiran && cd /opt/jiran/web
```

## 2) نقل البيانات من Railway

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
ssh root@100.42.184.124 "mkdir -p /opt/jiran/web/storage"
```

```bash
scp prod.db root@100.42.184.124:/opt/jiran/web/storage/prod.db
```

مهم: ارفع الملف **قبل** أول تشغيل. إن لم يوجد `storage/prod.db` سيبدأ التطبيق بقاعدة بيانات الإكسل الأولية.

## 3) تشغيل التطبيق

```bash
cd /opt/jiran/web && docker compose up -d --build
```

```bash
docker compose logs --tail 20 app; curl -sI http://127.0.0.1:3100 | head -1
```

يجب أن يرجع `200` وألا يظهر السطر `Initializing database from seed...` (ظهوره يعني أن ملف البيانات لم يُرفع في مكانه).

## 4) ربط الدومين عبر nginx

1. عند مزوّد الدومين: سجل `A` للدومين (أو الدومين الفرعي) يشير إلى `100.42.184.124`.
2. على السيرفر (استبدل `JIRAN_DOMAIN` بالدومين الحقيقي في الأمرين):

```bash
sed 's/JIRAN_DOMAIN/your-domain.com/' /opt/jiran/web/deploy/nginx-jiran.conf > /etc/nginx/sites-available/jiran
```

```bash
ln -s /etc/nginx/sites-available/jiran /etc/nginx/sites-enabled/jiran && nginx -t && systemctl reload nginx
```

`nginx -t` يفحص الإعدادات قبل إعادة التحميل؛ إن فشل لا يتأثر الموقع الآخر. (إن كان السيرفر يستخدم `conf.d` بدل `sites-enabled` ضع الملف في `/etc/nginx/conf.d/jiran.conf`.)

3. شهادة HTTPS:

```bash
certbot --nginx -d your-domain.com
```

4. افتح الموقع وطابق الأرقام (عدد الجيران، مجموع الدفعات، آخر سند) مع الموقع القديم.
5. بعد التأكد ويومين من العمل السليم: أوقف خدمة Railway ثم احذفها.

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
scp -r root@100.42.184.124:/opt/jiran/web/storage/backups ./jiran-backups
```
