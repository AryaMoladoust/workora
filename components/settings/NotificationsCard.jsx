"use client";

import Icon from "../ui/Icon";
import PwaControls from "../pwa/PwaControls";

// Install the app + turn device notifications on/off (same controls as the user menu).
export default function NotificationsCard() {
  return (
    <section className="card settings-card">
      <div className="card-head">
        <h2 className="card-title"><span className="card-title-icon"><Icon name="bell" size={17} /></span>اعلان‌ها و نصب برنامه</h2>
      </div>
      <p className="field-hint" style={{ marginBottom: 10 }}>
        اعلان‌های دستگاه برای هر دستگاه جدا روشن می‌شود. با روشن بودنش، حتی وقتی برنامه بسته است وظیفه‌های تازه، کامنت‌ها و پیام‌ها را می‌بینید.
      </p>
      <div className="settings-pwa">
        <PwaControls rowClass="menu-item" />
      </div>
    </section>
  );
}
