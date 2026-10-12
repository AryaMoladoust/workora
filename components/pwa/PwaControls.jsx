"use client";

import { useState } from "react";
import Icon from "../ui/Icon";
import { usePwa } from "./PwaProvider";

// Install + notification rows. `rowClass` lets the host menu (bottom sheet / user popover) style the rows.
export default function PwaControls({ rowClass = "menu-item" }) {
  const pwa = usePwa();
  const [showIosHint, setShowIosHint] = useState(false);

  const showInstall = !pwa.standalone && (pwa.canInstall || pwa.ios);
  const iosNeedsInstall = pwa.ios && !pwa.standalone && !pwa.pushSupported;

  if (!pwa.signedIn) return null;

  return (
    <>
      {showInstall && (
        <>
          <button
            type="button"
            className={rowClass}
            onClick={() => (pwa.canInstall ? pwa.install() : setShowIosHint((v) => !v))}
          >
            <Icon name="plus" size={19} />
            <span>نصب برنامه روی دستگاه</span>
          </button>
          {showIosHint && !pwa.canInstall && (
            <p className="pwa-hint">در Safari دکمه‌ی اشتراک‌گذاری (Share) را بزن و «Add to Home Screen» را انتخاب کن.</p>
          )}
        </>
      )}

      {iosNeedsInstall && <p className="pwa-hint">برای دریافت اعلان در آیفون، اول برنامه را به صفحه‌ی اصلی اضافه کن.</p>}

      {pwa.pushSupported && pwa.permission === "denied" && (
        <p className="pwa-hint">اعلان‌ها در تنظیمات مرورگر مسدود شده‌اند. از تنظیمات سایت اجازه‌ی «Notifications» را بده.</p>
      )}

      {pwa.pushSupported && pwa.permission !== "denied" && (
        <>
          <button
            type="button"
            className={rowClass}
            disabled={pwa.busy}
            onClick={() => (pwa.subscribed ? pwa.disablePush() : pwa.enablePush())}
            aria-pressed={pwa.subscribed}
          >
            <Icon name="bell" size={19} />
            <span>{pwa.subscribed ? "اعلان‌های دستگاه روشن است" : "روشن کردن اعلان‌های دستگاه"}</span>
            <span className={`pwa-switch ${pwa.subscribed ? "is-on" : ""}`} aria-hidden="true" />
          </button>
          {pwa.subscribed && (
            <button type="button" className={rowClass} disabled={pwa.busy} onClick={pwa.sendTest}>
              <Icon name="send" size={19} />
              <span>ارسال اعلان آزمایشی</span>
            </button>
          )}
        </>
      )}

      {pwa.message && <p className="pwa-hint" role="status">{pwa.message}</p>}
    </>
  );
}
