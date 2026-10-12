# استقرار Workora روی Vercel + MongoDB Atlas

> هیچ‌وقت فایل `.env` یا رمز دیتابیس را داخل گیت، زیپ یا چت نگذارید. مقدارها فقط داخل پنل Vercel وارد می‌شوند.

## ۰) چند نکته‌ی مهم قبل از شروع
- **WebSocket روی Vercel کار نمی‌کند** (Vercel سرورِ همیشه‌روشن ندارد). برای همین روی Vercel متغیر `NEXT_PUBLIC_REALTIME=polling` می‌گذاریم و چت و اعلان‌ها با polling کوتاه (هر ۴ تا ۱۵ ثانیه) به‌روز می‌شوند. اگر روزی WebSocket واقعی خواستید: برنامه را روی یک سرور/VPS با `npm start` اجرا کنید (همین کد، بدون تغییر).
- فایل `atlas-credentials.env` که از Atlas گرفتید ساختارش درست است. فقط **`MONGODB_URI`** از آن لازم است (نام‌کاربری و رمز جداگانه لازم نیست). آدرس شما اسم دیتابیس ندارد؛ برنامه خودکار از دیتابیس **`workora`** استفاده می‌کند (`MONGODB_DB`).
- چون محتوای آن فایل در چت فرستاده شد، بعد از اتمام راه‌اندازی رمز کاربر دیتابیس را در Atlas عوض کنید (Database Access → Edit → Edit Password) و مقدار جدید را در Vercel جایگزین کنید.

## ۱) آماده‌سازی Atlas
1. **Network Access** → Add IP Address → `0.0.0.0/0` (Allow access from anywhere). Vercel آی‌پی ثابت ندارد؛ امنیت با رمز قوی و کاربر کم‌دسترسی تأمین می‌شود.
2. **Database Access**: کاربر برنامه فقط نقش `readWrite` روی دیتابیس `workora` داشته باشد (نه Atlas admin).
3. **Region**: ببینید کلاستر شما کجاست (Cluster → region). در Vercel همان نزدیک‌ترین Region را برای Functions انتخاب می‌کنید (مرحله ۴).

## ۲) رمز و کلیدهای برنامه
در ترمینال این را بزنید و خروجی را به‌عنوان `AUTH_SECRET` نگه دارید:
```
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```
یک بار دیگر هم برای `SETUP_TOKEN` و یک کد دلخواه کوتاه برای `REGISTRATION_KEY` (کد دعوت ثبت‌نام اول) بسازید.

## ۳) گذاشتن کد روی GitHub
1. یک مخزن **Private** در GitHub بسازید.
2. محتویات پوشه‌ی `workora` را در آن قرار دهید (خود پوشه نه؛ فایل `package.json` باید در ریشه‌ی مخزن باشد).
3. مطمئن شوید `.env.local` داخل مخزن نیست (`.gitignore` جلوی آن را می‌گیرد).

## ۴) ساخت پروژه در Vercel
1. Vercel → **Add New → Project** → مخزن را Import کنید. Framework: **Next.js** (خودکار).
2. قبل از Deploy، **Environment Variables** را وارد کنید (برای Production، Preview و Development):

| نام | مقدار |
|---|---|
| `MONGODB_URI` | رشته‌ی اتصال Atlas (همان خط فایل env) |
| `MONGODB_DB` | `workora` |
| `AUTH_SECRET` | مقدار تولیدشده در مرحله ۲ |
| `REGISTRATION_KEY` | کد دعوت دلخواه |
| `SETUP_TOKEN` | توکن تولیدشده در مرحله ۲ |
| `NEXT_PUBLIC_REALTIME` | `polling` |
| `NEXT_PUBLIC_APP_TIMEZONE` | `Asia/Tehran` |
| `APP_TIMEZONE` | `Asia/Tehran` |

3. Settings → **Functions → Function Region** را نزدیک Region کلاستر Atlas بگذارید (مثلاً کلاستر در فرانکفورت → `fra1`). این تنظیم روی سرعت اثر زیادی دارد.
4. **Deploy** را بزنید. `NEXT_PUBLIC_*` موقع Build داخل برنامه قرار می‌گیرد؛ اگر بعداً تغییرشان دادید باید Redeploy کنید.

## ۵) ساخت جدول‌ها (Collection + Index)
بعد از اولین Deploy موفق، این آدرس را در مرورگر باز کنید:
```
https://<نام-پروژه>.vercel.app/api/setup?token=<SETUP_TOKEN>
```
خروجی باید `"ok": true` و فهرست ۱۲ collection باشد: `users, workspaces, memberships, projects, tasks, comments, activities, notifications, conversations, chatmessages, conversationreads, ratelimits`. اگر خطا دیدید متن آن را برایم بفرستید.
(بعد از اتمام می‌توانید `SETUP_TOKEN` را از Vercel حذف کنید؛ آن‌وقت این آدرس غیرفعال می‌شود.)

## ۶) ساخت حساب مالک
1. `https://<نام-پروژه>.vercel.app/register` را باز کنید.
2. نام، ایمیل، نام Workspace، رمز و «کد دعوت» (`REGISTRATION_KEY`) را وارد کنید.
3. از این لحظه ثبت‌نام عمومی **بسته** می‌شود. بقیه‌ی همکاران را از بخش **اعضا → عضو جدید** بسازید و ایمیل/رمز موقت را به خودشان بدهید.

## ۷) اجرای لوکال روی همان Atlas (اختیاری)
فایل `.env.local` را بر اساس `.env.example` پر کنید (بدون `NEXT_PUBLIC_REALTIME`) و `npm install` و `npm run dev` بزنید؛ لوکال با WebSocket کار می‌کند و به همان دیتابیس Atlas وصل است. اگر دیتابیس جدا برای تست می‌خواهید `MONGODB_DB=workora_dev` بگذارید.

## ۸) دامنه‌ی اختصاصی
Vercel → Project → Settings → Domains → دامنه را اضافه و رکوردهای DNS را همان‌طور که نشان می‌دهد تنظیم کنید. HTTPS خودکار است.

## عیب‌یابی سریع
| علامت | دلیل محتمل |
|---|---|
| ثبت‌نام: «اتصال به پایگاه‌داده برقرار نشد» | `MONGODB_URI` اشتباه یا Network Access در Atlas باز نیست |
| ورود می‌شود ولی بعد از رفرش خروج | `AUTH_SECRET` کمتر از ۳۲ کاراکتر یا بین Deployها فرق دارد |
| چت دیر به‌روز می‌شود | طبیعی در حالت polling (۴ ثانیه)؛ برای لحظه‌ای واقعی به سرور اختصاصی بروید |
| کند بودن کل برنامه | Region توابع Vercel با Region کلاستر Atlas فاصله دارد |
| ۴۰۴ در `/api/setup` | `SETUP_TOKEN` در Vercel تنظیم نشده یا Redeploy نکرده‌اید |
