import { requireAuth } from "../../lib/require-auth";
import { isVaultOpen, queryVault, seedPresetsOnce } from "../../lib/vault";
import { listWorkspaceMembers } from "../../lib/members";
import VaultManager from "../../components/vault/VaultManager";

export const dynamic = "force-dynamic";

export default async function VaultPage() {
  const current = await requireAuth();
  const open = await isVaultOpen(current);

  let items = [];
  let members = [];
  if (open) {
    await seedPresetsOnce(current);
    const [list, all] = await Promise.all([queryVault(current), listWorkspaceMembers(current.workspace.id)]);
    items = list;
    members = all.map((m) => ({ userId: m.userId, firstName: m.firstName, lastName: m.lastName, role: m.role }));
  }

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">Passwords</span>
          <h1>رمزها</h1>
          <p>رمزهای خودتان را با عنوان‌های مختلف نگه دارید و مشخص کنید چه کسانی ببینند.</p>
        </div>
      </div>
      <VaultManager locked={!open} initialItems={items} members={members} meId={current.user.id} />
    </div>
  );
}
