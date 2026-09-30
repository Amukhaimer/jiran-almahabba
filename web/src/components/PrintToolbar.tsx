"use client";

import { useRouter } from "next/navigation";

export function PrintToolbar({
  documentTitle,
  backHref,
}: {
  documentTitle?: string;
  /** رابط الرجوع بدون وضع الطباعة */
  backHref: string;
}) {
  const router = useRouter();

  function handlePrint() {
    const previous = document.title;
    if (documentTitle) {
      document.title = documentTitle;
    }

    const restore = () => {
      document.title = previous;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.setTimeout(restore, 2000);
    window.print();
  }

  return (
    <div className="print-toolbar no-print">
      <p className="print-toolbar__hint">
        معاينة الطباعة — اضغط «اطبع الآن» لفتح ورقة الطباعة أو حفظ PDF
      </p>
      <div className="print-toolbar__actions">
        <button type="button" className="btn btn-primary" onClick={handlePrint}>
          اطبع الآن
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => router.replace(backHref)}
        >
          رجوع
        </button>
      </div>
    </div>
  );
}
