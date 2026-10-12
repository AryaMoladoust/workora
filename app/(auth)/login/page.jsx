import LoginForm from "../../../components/auth/LoginForm";
import { registrationOpen } from "../../../lib/registration";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  let open = false;
  try {
    open = await registrationOpen();
  } catch {
    /* database unreachable: the login API reports the real error */
  }
  return <LoginForm registrationOpen={open} />;
}
