// The application shell (sidebar + header) is now rendered once by app/layout.jsx
// through <AppShell/>. Pages that still wrap themselves in <AppLayout> keep working:
// this component is intentionally a pass-through to avoid rendering the shell twice.
export default function AppLayout({ children }) {
  return <>{children}</>;
}
