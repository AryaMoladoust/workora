import { ProfileSkeleton } from "../../components/skeleton/pages";
import PenLoader from "../../components/loading/PenLoader";

export default function Loading() {
  return (
    <>
      <PenLoader />
      <ProfileSkeleton />
    </>
  );
}
