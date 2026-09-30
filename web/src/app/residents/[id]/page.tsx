import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AddPanel } from "@/components/AddPanel";
import { AdminNotice } from "@/components/AdminNotice";
import { ConfirmForm } from "@/components/ConfirmForm";
import { EditToggle } from "@/components/EditToggle";
import {
  createPaymentRange,
  deletePayment,
  updatePayment,
  updateResident,
} from "@/lib/actions";
import { formatMoney, MONTH_NAMES, paymentKindLabel } from "@/lib/format";
import { formatOccupancyLabel } from "@/lib/stats";
import { prisma } from "@/lib/prisma";

export default async function ResidentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    add?: string;
    created?: string;
    skipped?: string;
    skippedMonths?: string;
    error?: string;
    updated?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const created = sp.created ? Number(sp.created) : undefined;
  const skipped = sp.skipped ? Number(sp.skipped) : undefined;
  const updated = sp.updated ? Number(sp.updated) : undefined;
  const resident = await prisma.resident.findUnique({
    where: { id },
    include: {
      payments: {
        orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
      },
    },
  });
  if (!resident) notFound();

  const total = resident.payments.reduce((s, p) => s + p.amount, 0);
  const now = new Date();
  const clearHref = `/residents/${resident.id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/residents"
            className="text-sm text-[var(--accent)] no-print"
          >
            ← الجيران
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{resident.name}</h1>
          <p className="text-[var(--muted)] text-sm">
            اشتراك شهري {formatMoney(resident.monthlyFee)} — إجمالي المدفوع{" "}
            <span className="font-semibold text-[var(--good)]">
              {formatMoney(total)}
            </span>
          </p>
          <p className="text-sm text-[var(--muted)] mt-1 tabular-nums">
            فترة السكن: {formatOccupancyLabel(resident)}
            {!resident.active ? " — خارج" : ""}
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <Link
            href={`/reports/unit/${resident.id}`}
            className="btn btn-primary text-sm"
          >
            تقرير الشقة
          </Link>
          <EditToggle title={`تعديل: ${resident.name}`}>
            <ConfirmForm
              message="هل أنت متأكد من حفظ التعديل؟"
              action={updateResident}
              className="grid gap-3 sm:grid-cols-2"
            >
              <input type="hidden" name="id" value={resident.id} />
              <div className="field sm:col-span-2">
                <label>الاسم</label>
                <input name="name" required defaultValue={resident.name} />
              </div>
              <div className="field">
                <label>الاشتراك الشهري</label>
                <input
                  name="monthlyFee"
                  type="number"
                  step="0.001"
                  required
                  defaultValue={resident.monthlyFee}
                />
              </div>
              <div className="field">
                <label>بداية السكن — السنة</label>
                <input
                  name="activeFromYear"
                  type="number"
                  required
                  defaultValue={resident.activeFromYear}
                />
              </div>
              <div className="field">
                <label>بداية السكن — الشهر</label>
                <select
                  name="activeFromMonth"
                  defaultValue={resident.activeFromMonth}
                >
                  {MONTH_NAMES.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {i + 1} — {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>نهاية السكن — السنة (اختياري)</label>
                <input
                  name="activeToYear"
                  type="number"
                  placeholder="فارغ = ما زال ساكناً"
                  defaultValue={resident.activeToYear ?? ""}
                />
              </div>
              <div className="field">
                <label>نهاية السكن — الشهر</label>
                <select
                  name="activeToMonth"
                  defaultValue={resident.activeToMonth ?? ""}
                >
                  <option value="">—</option>
                  {MONTH_NAMES.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {i + 1} — {m}
                    </option>
                  ))}
                </select>
              </div>
              <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="markInactive"
                  value="1"
                  defaultChecked={!resident.active}
                />
                تعليم كخارج (موقوف)
              </label>
              <div className="sm:col-span-2">
                <button type="submit" className="btn btn-primary">
                  حفظ التعديل
                </button>
              </div>
            </ConfirmForm>
          </EditToggle>
        </div>
      </div>

      <AdminNotice
        created={created}
        skipped={skipped}
        skippedMonths={sp.skippedMonths}
        error={sp.error}
        updated={updated}
        clearHref={clearHref}
      />

      <Suspense fallback={null}>
        <AddPanel label="إضافة دفعة">
          <ConfirmForm
            message="هل أنت متأكد من حفظ الدفعات؟"
            action={createPaymentRange}
            className="panel grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
          >
            <input type="hidden" name="residentId" value={resident.id} />
            <input type="hidden" name="redirectTo" value={clearHref} />
            <div className="field">
              <label>السنة</label>
              <input
                name="year"
                type="number"
                required
                defaultValue={now.getFullYear()}
              />
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
                defaultValue={resident.monthlyFee}
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
            <div className="field lg:col-span-4">
              <label>ملاحظة (اختياري)</label>
              <input
                name="note"
                placeholder="مثال: دفع عن عدة أشهر"
              />
            </div>
            <div className="flex items-end lg:col-span-2">
              <button type="submit" className="btn btn-primary w-full">
                حفظ الدفعات
              </button>
            </div>
            <p className="lg:col-span-6 text-xs text-[var(--muted)]">
              شهر واحد: نفس الرقم في من/إلى. الأشهر المسجّلة مسبقاً تُتخطى.
            </p>
          </ConfirmForm>
        </AddPanel>
      </Suspense>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>الفترة</th>
              <th>النوع</th>
              <th>ملاحظة</th>
              <th>المبلغ</th>
              <th className="no-print"></th>
            </tr>
          </thead>
          <tbody>
            {resident.payments.map((p) => (
              <tr key={p.id}>
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
                          name="residentId"
                          value={resident.id}
                        />
                        <input type="hidden" name="redirectTo" value={clearHref} />
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
                          <button
                            type="submit"
                            className="btn btn-primary w-full"
                          >
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
                      <button
                        type="submit"
                        className="btn btn-danger text-xs py-1"
                      >
                        حذف
                      </button>
                    </ConfirmForm>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
