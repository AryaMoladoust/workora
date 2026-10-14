import RegisterForm from "../../../components/auth/RegisterForm";
import { registrationKeyRequired, registrationOpen } from "../../../lib/registration";
import { displayInviteCode } from "../../../lib/invite";
import { mailConfigured } from "../../../lib/mail";
import { findPrimaryWorkspace, signupDomainHint, signupRequestsEnabled } from "../../../lib/signup";

export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }) {
  searchParams = await searchParams;
  const code = typeof searchParams?.code === "string" ? displayInviteCode(searchParams.code) : "";

  // No workspace yet → the first visitor creates it (owner).
  // With an invite code → join instantly. Otherwise → ask for access with an e-mail (owner approves).
  let mode = "owner";
  let canRequest = false;
  try {
    if ((await registrationOpen()) && !code) {
      mode = "owner";
    } else {
      canRequest = signupRequestsEnabled(await findPrimaryWorkspace());
      mode = code || !canRequest ? "join" : "request";
    }
  } catch {
    /* database unreachable: the API reports the real error on submit */
  }

  if (mode === "owner") return <RegisterForm mode="owner" needsKey={registrationKeyRequired()} />;
  return <RegisterForm mode={mode} initialCode={code} canRequest={canRequest} domainHint={signupDomainHint()} mailEnabled={mailConfigured()} />;
}
