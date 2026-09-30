"use client";

function isMobilePrintContext() {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 900px)").matches;
  const ua = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return coarse || narrow || ua;
}

function withPrintParam(href?: string) {
  const url = new URL(href || window.location.href, window.location.origin);
  url.searchParams.set("print", "1");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function PrintButton({
  label = "طباعة التقرير",
  documentTitle,
  href,
}: {
  label?: string;
  /** اسم ملف/عنوان نافذة الطباعة (يظهر كاسم الحفظ عند PDF) */
  documentTitle?: string;
  /** رابط وضع المعاينة على الموبايل (اختياري؛ الافتراضي الصفحة الحالية + print=1) */
  href?: string;
}) {
  function handlePrint() {
    if (isMobilePrintContext()) {
      window.location.assign(withPrintParam(href));
      return;
    }

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
    <button
      type="button"
      className="btn btn-primary no-print"
      onClick={handlePrint}
    >
      {label}
    </button>
  );
}
