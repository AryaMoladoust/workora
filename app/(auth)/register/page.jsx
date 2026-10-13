import RegisterForm from "../../../components/auth/RegisterForm";
import { registrationKeyRequired, registrationOpen } from "../../../lib/registration";
import { displayInviteCode } from "../../../lib/invite";

export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }) {
  searchParams = await searchParams;
  const code = typeof searchParams?.code === "string" ? displayInviteCode(searchParams.code) : "";

  // No workspace yet → the first visitor creates it (owner). Otherwise people join with an invite code.
  let ownerMode = true;
  try {
    ownerMode = (await registrationOpen()) && !code;
  } catch {
    /* database unreachable: the API reports the real error on submit */
  }

  return ownerMode ? <RegisterForm mode="owner" needsKey={registrationKeyRequired()} /> : <RegisterForm mode="join" initialCode={code} />;
}
