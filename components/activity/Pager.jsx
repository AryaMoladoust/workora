import Link from "next/link";

export default function Pager({ basePath, query, page, pages }) {
  if (pages <= 1) return null;
  const href = (p) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <nav className="pager" aria-label="صفحه‌بندی">
      {page > 1 ? <Link className="secondary-button" href={href(page - 1)}>← قبلی</Link> : <span />}
      <span className="pager-info">صفحه {page.toLocaleString("fa-IR")} از {pages.toLocaleString("fa-IR")}</span>
      {page < pages ? <Link className="secondary-button" href={href(page + 1)}>بعدی →</Link> : <span />}
    </nav>
  );
}
