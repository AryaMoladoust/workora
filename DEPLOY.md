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
خروجی باید `"ok": true` و فهرست همه‌ی collectionهای برنامه باشد (حدود ۱۸ مورد: users, workspaces, memberships, projects, tasks, comments, activities, notifications, conversations, chatmessages, conversationreads, ratelimits, notes, announcements, pushsubscriptions, pushconfigs, signupverifications, passwordresets). اگر خطا دیدید متن آن را برایم بفرستید.
(بعد از اتمام می‌توانید `SETUP_TOKEN` را از Vercel حذف کنید؛ آن‌وقت این آدرس غیرفعال می‌شود.)

## ۶) ساخت حساب مالک
1. `https://<نام-پروژه>.vercel.app/register` را باز کنید.
2. نام، ایمیل، نام Workspace، رمز و «کد دعوت» (`REGISTRATION_KEY`) را وارد کنید.
3. از این لحظه ساخت Workspace جدید **بسته** می‌شود. همکاران را به یکی از این دو روش اضافه کنید:
   - **کد دعوت (پیشنهادی):** در صفحه‌ی **اعضا** کارت «ثبت‌نام اعضا با کد دعوت» را ببینید → «ساخت کد دعوت و فعال‌سازی». کد (یا لینک ثبت‌نام) را به همکار بدهید؛ او در صفحه‌ی ورود روی «ثبت‌نام با کد دعوت» می‌زند و حساب عضو (بدون دسترسی مدیریتی) می‌سازد. هر وقت خواستید ثبت‌نام را غیرفعال یا کد را عوض کنید.
   - **ساخت دستی:** **اعضا → عضو جدید** و دادن ایمیل/رمز موقت.

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

## دیدن دیتابیس: MongoDB Compass یا خود Atlas

### روش ۱: Compass (برنامه‌ی دسکتاپ)
1. Compass را از mongodb.com/products/tools/compass (رایگان) دانلود و نصب کنید.
2. در Atlas: **Clusters → Connect → Compass** (یا همان رشته‌ی `MONGODB_URI` فایل env) و رشته‌ی اتصال `mongodb+srv://...` را کپی کنید. اگر `<db_password>` داشت، رمز واقعی را جایش بنویسید.
3. Compass را باز کنید → **Add new connection** → رشته را در URI بچسبانید → **Connect**.
4. در ستون چپ، دیتابیس **`workora`** را باز کنید. collectionها: `users`, `memberships`, `projects`, `tasks`, `notes` و ... با کلیک روی هر کدام، سندها را می‌بینید.
5. بالای فهرست سندها می‌توانید فیلتر بنویسید، مثلاً `{ "kind": "config" }` یا `{ "email": "a@b.com" }`.
6. فقط مشاهده کنید؛ ویرایش یا حذف دستی سندها می‌تواند برنامه را خراب کند. فیلد `passwordHash` رمز رمزنگاری‌شده است و رمز اصلی نیست.

اگر Compass وصل نشد (Timeout): آی‌پی فعلی شما باید در Atlas → Network Access باشد (`0.0.0.0/0` این را پوشش می‌دهد) و Compass از پروکسی/VPN سیستم استفاده نمی‌کند؛ VPN را در حالت TUN/سیستمی بگذارید.

### روش ۲: بدون نصب، داخل Atlas
Atlas → منوی چپ **Database → Data Explorer** (یا Clusters → Browse Collections) → دیتابیس `workora`. همان محتوا را داخل مرورگر می‌بینید و از VPN مرورگر استفاده می‌کند.

## بعد از به‌روزرسانی به این نسخه
1. `npm install` و push به GitHub (Vercel خودکار Deploy می‌کند).
2. یک بار `/api/setup?token=<SETUP_TOKEN>` را باز کنید تا collectionهای جدید (`notes`، `announcements`، `pushsubscriptions`، `pushconfigs`) ساخته شوند (اگر قبلاً حذفش کرده‌اید، موقتاً دوباره اضافه کنید و Redeploy کنید).
3. اعلان‌های دستگاه: راهنمای `PWA.md`؛ پیشنهاد می‌شود `npm run vapid` را اجرا و سه مقدار را در Vercel بگذارید.

## ایمیل «درخواست شما تایید شد»
1. در حساب Google بخش **Security** ← «2-Step Verification» را روشن کنید، بعد از همان‌جا **App passwords** یک رمز ۱۶ حرفی بسازید.
2. در Vercel ← Settings ← Environment Variables این‌ها را اضافه کنید:
   - `SMTP_USER` = آدرس Gmail فرستنده
   - `SMTP_PASS` = همان App Password (نه رمز اصلی Gmail)
   - `APP_URL` = آدرس سایت، مثل `https://your-project.vercel.app`
   - (اختیاری) `MAIL_FROM` = `Workora <آدرس-شما@gmail.com>`
3. یک‌بار Redeploy کنید. بدون این متغیرها ایمیلی ارسال نمی‌شود و فقط خود تایید انجام می‌شود.
