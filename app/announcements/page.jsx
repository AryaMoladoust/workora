import ComingSoon from "../../components/shared/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Announcements"
      title="اطلاعیه‌ها"
      description="اطلاع‌رسانی رسمی به کل تیم."
      icon="megaphone"
      stage="مرحله ۶"
      features={[
    "انتشار اطلاعیه برای کل فضای کاری",
    "سنجاق کردن اطلاعیه‌های مهم",
    "نمایش اطلاعیه‌ها در داشبورد",
      ]}
    />
  );
}
