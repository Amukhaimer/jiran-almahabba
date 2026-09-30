import Link from "next/link";
import { Suspense } from "react";
import { AddPanel } from "@/components/AddPanel";
import { ConfirmForm } from "@/components/ConfirmForm";
import { EditToggle } from "@/components/EditToggle";
import {
  createResident,
  toggleResident,
  updateResident,
} from "@/lib/actions";
import { formatMoney, MONTH_NAMES } from "@/lib/format";
import { formatOccupancyLabel } from "@/lib/stats";
import { prisma } from "@/lib/prisma";

const now = new Date();
const defaultYear = now.getFullYear();
const defaultMonth = now.getMonth() + 1;

function OccupancyFields({
  fromYear,
  fromMonth,
  toYear,
  toMonth,
  showExit = true,
}: {
  fromYear: number;
  fromMonth: number;
  toYear?: number | null;
  toMonth?: number | null;
  showExit?: boolean;
}) {
  return (
    <>
      <div className="field">
        <label>بداية السكن — السنة</label>
        <input
          name="activeFromYear"
          type="number"
          required
          defaultValue={fromYear}
        />
      </div>
      <div className="field">
        <label>بداية السكن — الشهر</label>
        <select name="activeFromMonth" defaultValue={fromMonth}>
          {MONTH_NAMES.map((m, i) => (
            <option key={m} value={i + 1}>
              {i + 1} — {m}
            </option>
          ))}
        </select>
      </div>
      {showExit ? (
        <>
          <div className="field">
            <label>نهاية السكن — السنة (اختياري)</label>
            <input
              name="activeToYear"
              type="number"
              placeholder="فارغ = ما زال ساكناً"
              defaultValue={toYear ?? ""}
            />
          </div>
          <div className="field">
            <label>نهاية السكن — الشهر</label>
            <select name="activeToMonth" defaultValue={toMonth ?? ""}>
              <option value="">—</option>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {i + 1} — {m}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}
    </>
  );
}

export default async function ResidentsPage() {
  const residents = await prisma.resident.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
    include: {
      payments: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">الجيران</h1>
          <p className="text-[var(--muted)] text-sm mt-1">
            تعديل السكّان وفترات السكن — الأشهر خارج الفترة تُعد شغوراً وليست
            متأخرات
          </p>
        </div>
      </div>

      <Suspense fallback={null}>
        <AddPanel label="ساكن جديد">
          <ConfirmForm
            message="هل أنت متأكد من إضافة ساكن جديد؟"
            action={createResident}
            className="panel grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div className="field sm:col-span-2 lg:col-span-1">
              <label>الاسم</label>
              <input name="name" required placeholder="مثال: أبو محمد" />
            </div>
            <div className="field">
              <label>الاشتراك الشهري</label>
              <input
                name="monthlyFee"
                type="number"
                step="0.001"
                defaultValue={10}
              />
            </div>
            <OccupancyFields
              fromYear={defaultYear}
              fromMonth={defaultMonth}
              showExit={false}
            />
            <div className="sm:col-span-2 lg:col-span-3 flex items-end">
              <button type="submit" className="btn btn-primary">
                حفظ الساكن الجديد
              </button>
            </div>
            <p className="sm:col-span-2 lg:col-span-3 text-xs text-[var(--muted)]">
              عند خروج ساكن قديم: عدّل سجله وضع تاريخ الخروج. ثم أضف الساكن
              الجديد بتاريخ دخول — الأشهر بينهما لا تُحسب متأخرات.
            </p>
          </ConfirmForm>
        </AddPanel>
      </Suspense>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>فترة السكن</th>
              <th>الاشتراك</th>
              <th>إجمالي المدفوع</th>
              <th>الحالة</th>
              <th className="no-print"></th>
            </tr>
          </thead>
          <tbody>
            {residents.map((r) => {
              const total = r.payments.reduce((s, p) => s + p.amount, 0);
              return (
                <tr key={r.id}>
                  <td>
                    <Link
                      href={`/residents/${r.id}`}
                      className="font-semibold text-[var(--accent)] hover:underline"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="tabular-nums text-sm">
                    {formatOccupancyLabel(r)}
                  </td>
                  <td className="tabular-nums">{formatMoney(r.monthlyFee)}</td>
                  <td className="tabular-nums font-semibold">
                    {formatMoney(total)}
                  </td>
                  <td>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        r.active
                          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "bg-[#eee] text-[var(--muted)]"
                      }`}
                    >
                      {r.active ? "نشط" : "خرج"}
                    </span>
                  </td>
                  <td className="no-print">
                    <div className="flex flex-wrap items-center gap-1">
                      <Link
                        href={`/reports/unit/${r.id}`}
                        className="btn btn-ghost text-xs py-1"
                      >
                        تقرير الشقة
                      </Link>
                      <EditToggle title={`تعديل: ${r.name}`}>
                        <ConfirmForm
                          message="هل أنت متأكد من حفظ التعديل؟"
                          action={updateResident}
                          className="grid gap-3 sm:grid-cols-2"
                        >
                          <input type="hidden" name="id" value={r.id} />
                          <div className="field sm:col-span-2">
                            <label>الاسم</label>
                            <input name="name" required defaultValue={r.name} />
                          </div>
                          <div className="field">
                            <label>الاشتراك الشهري</label>
                            <input
                              name="monthlyFee"
                              type="number"
                              step="0.001"
                              required
                              defaultValue={r.monthlyFee}
                            />
                          </div>
                          <OccupancyFields
                            fromYear={r.activeFromYear}
                            fromMonth={r.activeFromMonth}
                            toYear={r.activeToYear}
                            toMonth={r.activeToMonth}
                          />
                          <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              name="markInactive"
                              value="1"
                              defaultChecked={!r.active}
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
                      <ConfirmForm
                        message={
                          r.active
                            ? "هل أنت متأكد من إيقاف هذا الساكن؟"
                            : "هل أنت متأكد من تفعيل هذا الساكن؟"
                        }
                        action={async () => {
                          "use server";
                          await toggleResident(r.id, !r.active);
                        }}
                      >
                        <button
                          type="submit"
                          className="btn btn-ghost text-xs py-1"
                        >
                          {r.active ? "إيقاف" : "تفعيل"}
                        </button>
                      </ConfirmForm>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
