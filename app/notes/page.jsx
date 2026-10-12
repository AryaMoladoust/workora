import ComingSoon from "../../components/shared/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Notes"
      title="یادداشت‌ها"
      description="یادداشت‌های شخصی و مشترک."
      icon="note"
      stage="مرحله ۶"
      features={[
    "یادداشت شخصی و اشتراکی",
    "ارتباط یادداشت با پروژه",
    "جستجو و دسته‌بندی",
      ]}
    />
  );
}
