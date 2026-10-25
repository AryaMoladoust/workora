import RegisterForm from "../../../components/auth/RegisterForm";
import { registrationKeyRequired, registrationOpen } from "../../../lib/registration";
import { mailConfigured } from "../../../lib/mail";
import { findPrimaryWorkspace, signupDomainHint, signupRequestsEnabled } from "../../../lib/signup";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {

  // No workspace yet → the first visitor creates it (owner).
  // Otherwise → ask for access with an e-mail (the owner approves).
  let mode = "owner";
  let canRequest = false;
  try {
    if (await registrationOpen()) {
      mode = "owner";
    } else {
      canRequest = signupRequestsEnabled(await findPrimaryWorkspace());
      mode = "request";
    }
  } catch {
    /* database unreachable: the API reports the real error on submit */
  }

  if (mode === "owner") return <RegisterForm mode="owner" needsKey={registrationKeyRequired()} />;
  return <RegisterForm mode={mode} canRequest={canRequest} domainHint={signupDomainHint()} mailEnabled={mailConfigured()} />;
}
