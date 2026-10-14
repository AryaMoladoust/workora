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

// "Your request was approved – you can log in now."
export async function sendApprovalEmail({ to, name, workspaceName, loginUrl }) {
  const subject = `درخواست شما در ${workspaceName} تایید شد`;
  const text = `سلام ${name}،\nدرخواست ثبت‌نام شما در «${workspaceName}» تایید شد. با همان ایمیل و رمزی که ثبت‌نام کردید می‌توانید وارد شوید:\n${loginUrl}\n\nWorkora`;
  const html = `<!doctype html><html lang="fa" dir="rtl"><body style="margin:0;padding:24px;background:#f4f6fb;font-family:Tahoma,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px;line-height:2;color:#1a2233;">
    <h2 style="margin:0 0 8px;font-size:20px;">درخواست شما تایید شد ✅</h2>
    <p style="margin:0 0 6px;">سلام ${esc(name)}،</p>
    <p style="margin:0 0 18px;">درخواست ثبت‌نام شما در «${esc(workspaceName)}» توسط مالک تایید شد. حالا با همان ایمیل و رمز عبوری که هنگام ثبت‌نام انتخاب کردید می‌توانید وارد شوید.</p>
    <p style="margin:0 0 22px;"><a href="${esc(loginUrl)}" style="display:inline-block;padding:12px 24px;border-radius:12px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;">ورود به Workora</a></p>
    <p style="margin:0;color:#6b7690;font-size:13px;">اگر دکمه کار نکرد این آدرس را در مرورگر باز کنید:<br><span dir="ltr">${esc(loginUrl)}</span></p>
  </div></body></html>`;
  await sendMail({ to, subject, html, text });
}
