// E-mail sending through any SMTP server (Gmail with an App Password works out of the box).
//   SMTP_USER   – the sender address / login, e.g. yourname@gmail.com
//   SMTP_PASS   – the App Password (NOT the normal Gmail password)
//   SMTP_HOST   – default smtp.gmail.com        SMTP_PORT – default 465 (SSL)
//   MAIL_FROM   – optional display sender, default  Workora <SMTP_USER>
let transporter = null;

export function mailConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function getTransporter() {
  if (transporter) return transporter;
  const nodemailer = (await import("nodemailer")).default;
  const port = Number(process.env.SMTP_PORT || 465);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
  return transporter;
}

export async function sendMail({ to, subject, html, text }) {
  const transport = await getTransporter();
  await transport.sendMail({
    from: process.env.MAIL_FROM || `Workora <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    text,
  });
}

const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// "Your request was approved – you can log in now."  (the password is never e-mailed: only a hash is stored)
export async function sendApprovalEmail({ to, name, loginUrl }) {
  const subject = "درخواست شما در Workora تایید شد";
  const text = `سلام ${name}،\nدرخواست ثبت‌نام شما در Workora تایید شد و حالا می‌توانید وارد شوید.\n\nایمیل ورود: ${to}\nرمز عبور: همان رمزی که هنگام ثبت‌نام انتخاب کردید\n\nورود: ${loginUrl}\n\nWorkora`;
  const html = `<!doctype html><html lang="fa" dir="rtl"><body style="margin:0;padding:24px;background:#f4f6fb;font-family:Tahoma,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px;line-height:2;color:#1a2233;">
    <h2 style="margin:0 0 8px;font-size:20px;">درخواست شما تایید شد ✅</h2>
    <p style="margin:0 0 6px;">سلام ${esc(name)}،</p>
    <p style="margin:0 0 16px;">درخواست ثبت‌نام شما در Workora تایید شد و حالا می‌توانید وارد شوید.</p>
    <div style="margin:0 0 20px;padding:14px 16px;border-radius:12px;background:#f1f5ff;border:1px solid #dbe5ff;">
      <div style="margin:0 0 6px;"><strong>ایمیل ورود:</strong> <span dir="ltr" style="unicode-bidi:embed;">${esc(to)}</span></div>
      <div><strong>رمز عبور:</strong> همان رمزی که هنگام ثبت‌نام انتخاب کردید</div>
    </div>
    <p style="margin:0 0 22px;"><a href="${esc(loginUrl)}" style="display:inline-block;padding:12px 24px;border-radius:12px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;">ورود به Workora</a></p>
    <p style="margin:0;color:#6b7690;font-size:13px;">اگر دکمه کار نکرد این آدرس را در مرورگر باز کنید:<br><span dir="ltr">${esc(loginUrl)}</span></p>
  </div></body></html>`;
  await sendMail({ to, subject, html, text });
}

// 4-digit verification code for a new sign-up request.
export async function sendOtpEmail({ to, name, code }) {
  const subject = `کد تایید Workora: ${code}`;
  const text = `سلام ${name}،\nکد تایید ایمیل شما در Workora: ${code}\nاین کد ۱۰ دقیقه معتبر است. اگر شما درخواست نداده‌اید این ایمیل را نادیده بگیرید.`;
  const box = (d) => `<td style="padding:0 5px;"><div style="width:52px;height:60px;line-height:60px;text-align:center;font-size:30px;font-weight:bold;border:2px solid #c7d2fe;border-radius:14px;background:#f5f7ff;color:#1e1b4b;font-family:Arial,sans-serif;">${d}</div></td>`;
  const html = `<!doctype html><html lang="fa" dir="rtl"><body style="margin:0;padding:24px;background:#f4f6fb;font-family:Tahoma,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px;line-height:2;color:#1a2233;text-align:center;">
    <h2 style="margin:0 0 6px;font-size:20px;">کد تایید ایمیل</h2>
    <p style="margin:0 0 18px;">سلام ${esc(name)}، این کد را در صفحه‌ی ثبت‌نام Workora وارد کنید:</p>
    <table role="presentation" align="center" dir="ltr" style="margin:0 auto 18px;border-collapse:separate;"><tr>${String(code).split("").map(box).join("")}</tr></table>
    <p style="margin:0 0 4px;color:#6b7690;font-size:13px;">این کد ۱۰ دقیقه معتبر است و فقط یک‌بار قابل استفاده است.</p>
    <p style="margin:0;color:#6b7690;font-size:13px;">اگر شما درخواست نداده‌اید، این ایمیل را نادیده بگیرید.</p>
  </div></body></html>`;
  await sendMail({ to, subject, html, text });
}

// Password-reset code (6 digits).
export async function sendResetCodeEmail({ to, name, code }) {
  const subject = `کد بازیابی رمز عبور Workora: ${code}`;
  const text = `سلام ${name}،\nکد بازیابی رمز عبور شما در Workora: ${code}\nاین کد ۱۰ دقیقه معتبر است. اگر شما درخواست نداده‌اید این ایمیل را نادیده بگیرید؛ رمز شما تغییر نمی‌کند.`;
  const size = String(code).length > 4 ? { w: 42, h: 54, f: 24 } : { w: 52, h: 60, f: 30 };
  const box = (d) => `<td style="padding:0 4px;"><div style="width:${size.w}px;height:${size.h}px;line-height:${size.h}px;text-align:center;font-size:${size.f}px;font-weight:bold;border:2px solid #c7d2fe;border-radius:12px;background:#f5f7ff;color:#1e1b4b;font-family:Arial,sans-serif;">${d}</div></td>`;
  const html = `<!doctype html><html lang="fa" dir="rtl"><body style="margin:0;padding:24px;background:#f4f6fb;font-family:Tahoma,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px;line-height:2;color:#1a2233;text-align:center;">
    <h2 style="margin:0 0 6px;font-size:20px;">بازیابی رمز عبور</h2>
    <p style="margin:0 0 18px;">سلام ${esc(name)}، این کد را در صفحه‌ی بازیابی رمز Workora وارد کنید:</p>
    <table role="presentation" align="center" dir="ltr" style="margin:0 auto 18px;border-collapse:separate;"><tr>${String(code).split("").map(box).join("")}</tr></table>
    <p style="margin:0 0 4px;color:#6b7690;font-size:13px;">این کد ۱۰ دقیقه معتبر است و فقط یک‌بار قابل استفاده است.</p>
    <p style="margin:0;color:#6b7690;font-size:13px;">اگر شما درخواست نداده‌اید، این ایمیل را نادیده بگیرید؛ رمز عبور شما تغییر نمی‌کند.</p>
  </div></body></html>`;
  await sendMail({ to, subject, html, text });
}
