"use client";

export function PrintButton({
  label = "طباعة التقرير",
  documentTitle,
}: {
  label?: string;
  /** اسم ملف/عنوان نافذة الطباعة (يظهر كاسم الحفظ عند PDF) */
  documentTitle?: string;
}) {
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

    // احتياط إذا لم يُطلق afterprint في بعض المتصفحات
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
