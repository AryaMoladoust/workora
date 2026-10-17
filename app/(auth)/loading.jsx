import PenLoader from "../../components/loading/PenLoader";

// Shown while /login, /register or /forgot-password is being prepared on the server.
export default function Loading() {
  return <PenLoader blocking delay={0.1} />;
}
