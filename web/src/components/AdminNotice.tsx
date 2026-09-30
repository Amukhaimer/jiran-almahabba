import Link from "next/link";

export function AdminNotice({
  created,
  skipped,
  skippedMonths,
  error,
  updated,
  clearHref,
}: {
  created?: number;
  skipped?: number;
  skippedMonths?: string;
  error?: string;
  updated?: number;
  clearHref: string;
}) {
  if (!error && !created && !skipped && !updated) return null;

  let tone: "good" | "warn" | "bad" = "good";
  let title = "";
  let detail = "";

  if (error === "duplicate") {
    tone = "bad";
    title = "تعذّر التسجيل — تكرار لنفس الشهر";
    detail = skippedMonths
      ? `الأشهر المسجّلة مسبقاً لهذا الجار: ${skippedMonths}. لا يمكن تكرار الاشتراك الشهري لنفس الشهر.`
      : "يوجد دفع اشتراك شهري مسجّل مسبقاً لهذا الجار في نفس السنة والشهر. لا يمكن التكرار.";
  } else if (error === "duplicate_edit") {
    tone = "bad";
    title = "تعذّر التعديل — الشهر مستخدم";
    detail =
      "يوجد دفع اشتراك آخر لنفس الجار في هذه السنة والشهر. اختر شهراً آخر أو عدّل السجل الموجود.";
  } else if (updated) {
    tone = "good";
    title = "تم حفظ التعديل بنجاح";
    detail = "";
  } else if ((created ?? 0) === 0 && (skipped ?? 0) > 0) {
    tone = "warn";
    title = "لم يُسجّل شيء جديد";
    detail = skippedMonths
      ? `الأشهر التالية مسجّلة مسبقاً لهذا الجار: ${skippedMonths}`
      : `تم تخطي ${skipped} شهر لأنها مسجّلة مسبقاً.`;
  } else if ((created ?? 0) > 0 && (skipped ?? 0) > 0) {
    tone = "warn";
    title = `تم تسجيل ${created} دفعة، مع تخطي مكرّر`;
    detail = skippedMonths
      ? `تخطّي الأشهر المسجّلة مسبقاً: ${skippedMonths}`
      : `تم تخطي ${skipped} شهر لأنها مسجّلة مسبقاً.`;
  } else if ((created ?? 0) > 0) {
    tone = "good";
    title =
      created === 1 ? "تم تسجيل الدفعة بنجاح" : `تم تسجيل ${created} دفعة بنجاح`;
    detail = "لن يُسمح بتكرار الاشتراك لنفس الشهر مرة أخرى.";
  } else {
    return null;
  }

  const colors =
    tone === "good"
      ? "border-[var(--good)]/30 bg-[#eef8f1] text-[var(--good)]"
      : tone === "warn"
        ? "border-[var(--warn)]/30 bg-[#fff8e8] text-[var(--warn)]"
        : "border-[var(--bad)]/30 bg-[#fdeeee] text-[var(--bad)]";

  return (
    <div className={`panel no-print border ${colors}`} role="status">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-bold">{title}</div>
          {detail ? (
            <p className="mt-1 text-sm opacity-90 text-[var(--ink)]">{detail}</p>
          ) : null}
        </div>
        <Link href={clearHref} className="btn btn-ghost text-xs py-1 shrink-0">
          إغلاق
        </Link>
      </div>
    </div>
  );
}
