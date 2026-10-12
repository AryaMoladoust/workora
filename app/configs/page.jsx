import ComingSoon from "../../components/shared/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Configs"
      title="کانفیگ‌ها"
      description="نگهداری تنظیمات و مقادیر مهم پروژه‌ها."
      icon="code"
      stage="مرحله ۷"
      features={[
    "ذخیره‌ی کانفیگ‌های هر پروژه به‌صورت ساختاریافته",
    "سطح دسترسی برای مشاهده و ویرایش",
    "تاریخچه‌ی تغییرات",
      ]}
    />
  );
}
