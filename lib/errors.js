// Turns low-level server errors into a safe, helpful message for the UI (no secrets).
export function sanitize(text) {
  return String(text || "")
    .replace(/(mongodb(?:\+srv)?:\/\/)[^@\s]+@/gi, "$1***@")
    .slice(0, 300);
}

export function describeServerError(error) {
  const message = String(error?.message || "");
  const name = String(error?.name || "");

  if (message.includes("AUTH_SECRET")) {
    return { status: 503, message: "تنظیمات سرور ناقص است: متغیر AUTH_SECRET در Vercel وجود ندارد یا کمتر از ۳۲ کاراکتر است. (بعد از اصلاح، Redeploy کنید)" };
  }
  if (message.includes("MONGODB_URI is not defined")) {
    return { status: 503, message: "تنظیمات سرور ناقص است: متغیر MONGODB_URI در Vercel تنظیم نشده است. (بعد از اصلاح، Redeploy کنید)" };
  }
  if (/bad auth|authentication failed|AuthenticationFailed/i.test(message) || error?.code === 18 || error?.code === 8000) {
    return { status: 503, message: "نام‌کاربری یا رمز دیتابیس اشتباه است (MONGODB_URI). رمز را در Atlas → Database Access بررسی کنید." };
  }
  if (name === "MongooseServerSelectionError" || name === "MongoServerSelectionError" || name === "MongoNetworkError" || error?.code === "ECONNREFUSED") {
    return { status: 503, message: "اتصال به پایگاه‌داده برقرار نشد. Network Access در Atlas (0.0.0.0/0) و درست بودن MONGODB_URI را بررسی کنید." };
  }
  if (/ENOTFOUND|querySrv/i.test(message)) {
    return { status: 503, message: "آدرس کلاستر در MONGODB_URI پیدا نشد. رشته‌ی اتصال را دوباره از Atlas کپی کنید." };
  }
  if (/not authorized|unauthorized/i.test(message) || error?.code === 13) {
    return { status: 503, message: "کاربر دیتابیس اجازه‌ی نوشتن ندارد. نقش او را در Atlas روی «Read and write to any database» بگذارید." };
  }
  return { status: 500, message: `خطای سرور (${name || "Error"}): ${sanitize(message)}` };
}
