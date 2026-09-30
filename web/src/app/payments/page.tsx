import { Suspense } from "react";
import { AddPanel } from "@/components/AddPanel";
import { AdminNotice } from "@/components/AdminNotice";
import { ConfirmForm } from "@/components/ConfirmForm";
import { EditToggle } from "@/components/EditToggle";
import { createPaymentRange, deletePayment, updatePayment } from "@/lib/actions";
import { formatMoney, MONTH_NAMES, paymentKindLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    add?: string;
    created?: string;
    skipped?: string;
    skippedMonths?: string;
    error?: string;
    updated?: string;
  }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.year) || now.getFullYear();
  const created = sp.created ? Number(sp.created) : undefined;
  const skipped = sp.skipped ? Number(sp.skipped) : undefined;
  const updated = sp.updated ? Number(sp.updated) : undefined;

  const [residents, payments, yearsRaw] = await Promise.all([
    prisma.resident.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.payment.findMany({
      where: { year },
      include: { resident: true },
      orderBy: [{ month: "desc" }, { createdAt: "desc" }],
    }),
    prisma.payment.findMany({
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    }),
  ]);

  const years = yearsRaw.map((y) => y.year);
  if (!years.includes(year)) years.unshift(year);

  const yearTotal = payments
    .filter((p) => p.kind !== "PRIOR_DEBT")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">الإيرادات</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            إجمالي {year}:{" "}
            <span className="font-semibold text-[var(--good)]">
              {formatMoney(yearTotal)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1 no-print">
          {years.map((y) => (
            <a
              key={y}
              href={`/payments?year=${y}`}
              className={`rounded-lg px-3 py-1.5 text-sm border ${
                y === year
                  ? "bg-[var(--accent)] text-white border-transparent"
                  : "border-[var(--line)] bg-white"
              }`}
            >
              {y}
            </a>
          ))}
        </div>
      </div>

      <AdminNotice
        created={created}
        skipped={skipped}
        skippedMonths={sp.skippedMonths}
        error={sp.error}
        updated={updated}
        clearHref={`/payments?year=${year}`}
      />

      <Suspense fallback={null}>
        <AddPanel label="إضافة دفعة">
          <ConfirmForm
            message="هل أنت متأكد من حفظ الدفعات؟"
            action={createPaymentRange}
            className="panel grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
          >
            <input
              type="hidden"
              name="redirectTo"
              value={`/payments?year=${year}`}
            />
            <div className="field lg:col-span-2">
              <label>الجار</label>
              <select name="residentId" required defaultValue="">
                <option value="" disabled>
                  اختر الجار
                </option>
                {residents.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>السنة</label>
              <input name="year" type="number" required defaultValue={year} />
            </div>
            <div className="field">
              <label>من شهر</label>
              <select name="fromMonth" defaultValue={now.getMonth() + 1}>
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {i + 1} — {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>إلى شهر</label>
              <select name="toMonth" defaultValue={now.getMonth() + 1}>
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {i + 1} — {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>المبلغ لكل شهر</label>
              <input
                name="amount"
                type="number"
                step="0.001"
                required
                defaultValue={10}
              />
            </div>
            <div className="field">
              <label>النوع</label>
              <select name="kind" defaultValue="MONTHLY">
                <option value="MONTHLY">اشتراك شهري</option>
                <option value="SETTLEMENT">دفعة سداد</option>
                <option value="PRIOR_DEBT">مستحقات سابقة</option>
              </select>
            </div>
            <div className="field lg:col-span-5">
              <label>ملاحظة (اختياري)</label>
              <input
                name="note"
                placeholder="مثال: دفع عن 3 أشهر دفعة واحدة"
              />
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn btn-primary w-full">
                حفظ الدفعات
              </button>
            </div>
            <p className="lg:col-span-6 text-xs text-[var(--muted)]">
              لاختيار شهر واحد: اجعل «من شهر» و«إلى شهر» نفس الرقم. الأشهر
              المسجّلة مسبقاً كاشتراك شهري تُتخطى تلقائياً.
            </p>
          </ConfirmForm>
        </AddPanel>
      </Suspense>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>الجار</th>
              <th>الفترة</th>
              <th>النوع</th>
              <th>ملاحظة</th>
              <th>المبلغ</th>
              <th className="no-print"></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{p.resident.name}</td>
                <td>
                  {MONTH_NAMES[p.month - 1]} {p.year}
                </td>
                <td>{paymentKindLabel(p.kind)}</td>
                <td className="text-[var(--muted)]">{p.note || "—"}</td>
                <td className="tabular-nums font-semibold text-[var(--good)]">
                  {formatMoney(p.amount)}
                </td>
                <td className="no-print">
                  <div className="flex flex-wrap items-center gap-1">
                    <EditToggle title="تعديل الدفعة">
                      <ConfirmForm
                        message="هل أنت متأكد من حفظ التعديل؟"
                        action={updatePayment}
                        className="grid gap-3 sm:grid-cols-2"
                      >
                        <input type="hidden" name="id" value={p.id} />
                        <input
                          type="hidden"
                          name="redirectTo"
                          value={`/payments?year=${year}`}
                        />
                        <div className="field sm:col-span-2">
                          <label>الجار</label>
                          <select name="residentId" required defaultValue={p.residentId}>
                            {residents.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                            {!residents.some((r) => r.id === p.residentId) && (
                              <option value={p.residentId}>{p.resident.name}</option>
                            )}
                          </select>
                        </div>
                        <div className="field">
                          <label>السنة</label>
                          <input
                            name="year"
                            type="number"
                            required
                            defaultValue={p.year}
                          />
                        </div>
                        <div className="field">
                          <label>الشهر</label>
                          <select name="month" defaultValue={p.month}>
                            {MONTH_NAMES.map((m, i) => (
                              <option key={m} value={i + 1}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label>المبلغ</label>
                          <input
                            name="amount"
                            type="number"
                            step="0.001"
                            required
                            defaultValue={p.amount}
                          />
                        </div>
                        <div className="field">
                          <label>النوع</label>
                          <select name="kind" defaultValue={p.kind}>
                            <option value="MONTHLY">اشتراك شهري</option>
                            <option value="SETTLEMENT">دفعة سداد</option>
                            <option value="PRIOR_DEBT">مستحقات سابقة</option>
                          </select>
                        </div>
                        <div className="field sm:col-span-2">
                          <label>ملاحظة</label>
                          <input name="note" defaultValue={p.note ?? ""} />
                        </div>
                        <div className="sm:col-span-2">
                          <button type="submit" className="btn btn-primary w-full">
                            حفظ التعديل
                          </button>
                        </div>
                      </ConfirmForm>
                    </EditToggle>
                    <ConfirmForm
                      message="هل أنت متأكد من حذف هذه الدفعة؟ لا يمكن التراجع."
                      action={async () => {
                        "use server";
                        await deletePayment(p.id);
                      }}
                    >
                      <button type="submit" className="btn btn-danger text-xs py-1">
                        حذف
                      </button>
                    </ConfirmForm>
                  </div>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={6} className="text-[var(--muted)]">
                  لا توجد إيرادات لهذه السنة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
