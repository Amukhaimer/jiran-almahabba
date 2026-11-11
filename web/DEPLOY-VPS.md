# النشر على سيرفر متين — https://jiran.jumanlady.com

السيرفر: `100.42.184.124` (AlmaLinux + CWP، SSH على المنفذ `1989`)، وهو نفس سيرفر jumanlady.com.

## كيف يعمل

- الكود على السيرفر: `/home/mateen/jiran` (git clone من GitHub)، والتطبيق في `/home/mateen/jiran/web`.
- التطبيق يعمل داخل Docker (مشروع compose اسمه `jiran`) ويستمع فقط على `127.0.0.1:3100`.
- nginx على السيرفر يحوّل `jiran.jumanlady.com` إلى المنفذ 3100 عبر ملفين مستقلين:
  `/etc/nginx/conf.d/vhosts/jiran.jumanlady.com.conf` و `jiran.jumanlady.com.ssl.conf`
  (نسخة مرجعية منهما في `deploy/nginx-jiran.conf`).
- شهادة SSL من Let's Encrypt عبر `acme.sh` وتتجدد تلقائياً.
- قاعدة البيانات: `/home/mateen/jiran/web/storage/prod.db`.
- خدمة `backup` تحفظ نسخة يومية في `storage/backups` لمدة 14 يوماً.

## تحديث الموقع بعد تعديل الكود

بعد `git push` إلى `master`، على السيرفر:

```bash
cd /home/mateen/jiran && git pull && cd web && docker compose up -d --build
```

البيانات في `storage/` لا تتأثر بالتحديث.

## فحص الحالة

```bash
cd /home/mateen/jiran/web && docker compose ps && docker compose logs --tail 20 app
```

## استبدال قاعدة البيانات (مثلاً ببيانات Railway القديمة)

```bash
cd /home/mateen/jiran/web && docker compose stop app && cp storage/prod.db storage/prod.before-replace.db && cp /path/to/new-prod.db storage/prod.db && docker compose start app
```

قبل الاستبدال تحقق من سلامة الملف (يجب أن يطبع `ok`):

```bash
sqlite3 /path/to/new-prod.db "PRAGMA integrity_check;"
```

## استرجاع نسخة احتياطية

```bash
cd /home/mateen/jiran/web && docker compose stop app && cp storage/backups/prod-YYYY-MM-DD.db storage/prod.db && docker compose start app
```

النسخ الاحتياطية موجودة على نفس السيرفر؛ يُنصح بسحب نسخة دورية إلى جهازك.

## تسجيل الدخول (مستخدم + كلمة مرور + تحقق بخطوتين)

- كل الصفحات محمية؛ الدخول باسم المستخدم وكلمة المرور ورمز من تطبيق المصادقة (TOTP).
- الحساب يُنشأ مرة واحدة من `https://jiran.jumanlady.com/setup` باستخدام `SETUP_TOKEN` الموجود في `web/.env` على السيرفر. بعد إنشاء الحساب تتعطل صفحة الإعداد.
- `SESSION_SECRET` في `web/.env` يوقّع الجلسات (مدة الجلسة 7 أيام). تغييره يُخرج الجميع.
- 5 محاولات خاطئة تقفل الدخول 15 دقيقة.

**نسيت كلمة المرور أو فقدت الهاتف؟** احذف الحساب من السيرفر ثم أنشئه من جديد عبر `/setup` (بيانات الدفعات لا تتأثر):

```bash
cd /home/mateen/jiran/web && sqlite3 storage/prod.db 'DELETE FROM "User";' && grep SETUP_TOKEN .env
```

## ملاحظات

- إن أعادت لوحة CWP كتابة إعدادات nginx واختفى الموقع، أعد إنشاء الملفين من `deploy/nginx-jiran.conf` ثم `nginx -t && systemctl reload nginx`.
- المنافذ المستخدمة على السيرفر من تطبيقات أخرى: 3011، 3030، 3040، 3055. لتغيير منفذ هذا التطبيق ضع `APP_PORT=` في `web/.env` وعدّل `proxy_pass`.
