import ComingSoon from "../../components/shared/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Settings"
      title="تنظیمات"
      description="پروفایل و تنظیمات فضای کاری."
      icon="settings"
      stage="مرحله ۷"
      features={[
    "ویرایش پروفایل و رمز عبور",
    "تنظیمات فضای کاری",
    "ترجیحات اعلان‌ها",
      ]}
    />
  );
}
