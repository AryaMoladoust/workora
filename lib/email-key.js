// One mailbox = one account.
// People can write the same mailbox in many ways (Gmail ignores dots and "+tag"), so accounts are matched on a
// canonical "email key" instead of the raw address:
//   John.Doe+work@GoogleMail.com  →  johndoe@gmail.com
//   name+anything@outlook.com     →  name@outlook.com   ("+tag" is dropped for every provider)
// Pure function (no imports) so it can be used by models, API routes and scripts.
const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export function emailKey(value) {
  const raw = String(value || "").trim().toLowerCase();
  const at = raw.lastIndexOf("@");
  if (at < 1) return raw;
  let local = raw.slice(0, at);
  let domain = raw.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus > 0) local = local.slice(0, plus);
  if (GMAIL_DOMAINS.has(domain)) {
    local = local.replace(/\./g, "");
    domain = "gmail.com";
  }
  return `${local}@${domain}`;
}
