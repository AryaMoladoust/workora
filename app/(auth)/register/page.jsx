import Link from "next/link";
import RegisterForm from "../../../components/auth/RegisterForm";
import { registrationKeyRequired, registrationOpen } from "../../../lib/registration";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  let open = true;
  try {
    open = await registrationOpen();
  } catch {
    /* database unreachable: let the form show the real error on submit */
  }

  if (!open) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <span className="auth-brand">Workora</span>
          <h1>ثبت‌نام بسته است</h1>
          <p>فضای کاری این سازمان قبلاً ساخته شده است. حساب کاربری را مالک فضای کاری برای شما می‌سازد؛ با او تماس بگیرید.</p>
          <Link href="/login" className="primary-button">رفتن به صفحه ورود</Link>
        </div>
      </main>
    );
  }

  return <RegisterForm needsKey={registrationKeyRequired()} />;
}
