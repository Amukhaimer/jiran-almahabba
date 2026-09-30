"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

function revalidatePaymentPaths(residentId: string) {
  revalidatePath("/");
  revalidatePath("/payments");
  revalidatePath("/residents");
  revalidatePath("/reports");
  revalidatePath(`/residents/${residentId}`);
}

function redirectWithNotice(
  redirectTo: string,
  notice: Record<string, string | number>,
) {
  const [path, existing = ""] = redirectTo.split("?");
  const params = new URLSearchParams(existing);
  for (const [key, value] of Object.entries(notice)) {
    params.set(key, String(value));
  }
  redirect(`${path}?${params.toString()}`);
}

async function hasMonthlyPayment(
  residentId: string,
  year: number,
  month: number,
  excludeId?: string,
) {
  const found = await prisma.payment.findFirst({
    where: {
      residentId,
      year,
      month,
      kind: "MONTHLY",
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(found);
}

export async function createPayment(formData: FormData) {
  const residentId = String(formData.get("residentId") || "");
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const amount = Number(formData.get("amount"));
  const kind = String(formData.get("kind") || "MONTHLY");
  const note = String(formData.get("note") || "") || null;
  const redirectTo = String(formData.get("redirectTo") || "/payments");

  if (!residentId || !year || !month || !Number.isFinite(amount)) {
    throw new Error("بيانات الدفعة غير مكتملة");
  }

  if (kind === "MONTHLY" && (await hasMonthlyPayment(residentId, year, month))) {
    revalidatePaymentPaths(residentId);
    redirectWithNotice(redirectTo, {
      year,
      error: "duplicate",
      skipped: 1,
      skippedMonths: String(month),
    });
  }

  await prisma.payment.create({
    data: { residentId, year, month, amount, kind, note },
  });

  revalidatePaymentPaths(residentId);
  redirectWithNotice(redirectTo, { year, created: 1 });
}

/** تسجيل دفعات لعدة أشهر دفعة واحدة (قيد منفصل لكل شهر) */
export async function createPaymentRange(formData: FormData) {
  const residentId = String(formData.get("residentId") || "");
  const year = Number(formData.get("year"));
  let fromMonth = Number(formData.get("fromMonth") || formData.get("month"));
  let toMonth = Number(formData.get("toMonth") || fromMonth);
  const amount = Number(formData.get("amount"));
  const kind = String(formData.get("kind") || "MONTHLY");
  const note = String(formData.get("note") || "") || null;
  const redirectTo = String(formData.get("redirectTo") || "/payments");

  if (
    !residentId ||
    !year ||
    !fromMonth ||
    !toMonth ||
    !Number.isFinite(amount)
  ) {
    throw new Error("بيانات الدفعة غير مكتملة");
  }

  if (fromMonth > toMonth) {
    const t = fromMonth;
    fromMonth = toMonth;
    toMonth = t;
  }
  if (fromMonth < 1 || toMonth > 12) {
    throw new Error("نطاق الأشهر غير صالح");
  }

  const existing = await prisma.payment.findMany({
    where: {
      residentId,
      year,
      month: { gte: fromMonth, lte: toMonth },
      kind: "MONTHLY",
    },
    select: { month: true },
  });
  const existingMonths = new Set(existing.map((p) => p.month));

  const toCreate: {
    residentId: string;
    year: number;
    month: number;
    amount: number;
    kind: string;
    note: string | null;
  }[] = [];
  const skippedMonths: number[] = [];

  for (let month = fromMonth; month <= toMonth; month++) {
    if (kind === "MONTHLY" && existingMonths.has(month)) {
      skippedMonths.push(month);
      continue;
    }
    toCreate.push({
      residentId,
      year,
      month,
      amount,
      kind,
      note:
        fromMonth !== toMonth && note
          ? note
          : fromMonth !== toMonth
            ? `اشتراك أشهر ${fromMonth}–${toMonth}`
            : note,
    });
  }

  if (toCreate.length > 0) {
    await prisma.payment.createMany({ data: toCreate });
  }

  revalidatePaymentPaths(residentId);

  const notice: Record<string, string | number> = {
    year,
    created: toCreate.length,
    skipped: skippedMonths.length,
  };
  if (skippedMonths.length > 0) {
    notice.skippedMonths = skippedMonths.join("، ");
  }
  if (toCreate.length === 0 && skippedMonths.length > 0) {
    notice.error = "duplicate";
  }
  redirectWithNotice(redirectTo, notice);
}

export async function deletePayment(id: string) {
  const payment = await prisma.payment.findUnique({ where: { id } });
  await prisma.payment.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/payments");
  revalidatePath("/residents");
  if (payment) revalidatePath(`/residents/${payment.residentId}`);
}

export async function updatePayment(formData: FormData) {
  const id = String(formData.get("id") || "");
  const residentId = String(formData.get("residentId") || "");
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const amount = Number(formData.get("amount"));
  const kind = String(formData.get("kind") || "MONTHLY");
  const note = String(formData.get("note") || "") || null;
  const redirectTo = String(formData.get("redirectTo") || "/payments");

  if (!id || !residentId || !year || !month || !Number.isFinite(amount)) {
    throw new Error("بيانات الدفعة غير مكتملة");
  }

  if (
    kind === "MONTHLY" &&
    (await hasMonthlyPayment(residentId, year, month, id))
  ) {
    revalidatePaymentPaths(residentId);
    redirectWithNotice(redirectTo, {
      year,
      error: "duplicate_edit",
    });
  }

  const existing = await prisma.payment.findUnique({ where: { id } });
  await prisma.payment.update({
    where: { id },
    data: { residentId, year, month, amount, kind, note },
  });

  revalidatePaymentPaths(residentId);
  if (existing && existing.residentId !== residentId) {
    revalidatePath(`/residents/${existing.residentId}`);
  }
  redirectWithNotice(redirectTo, { year, updated: 1 });
}

export async function createExpense(formData: FormData) {
  const categoryId = String(formData.get("categoryId") || "");
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const amount = Number(formData.get("amount"));
  const note = String(formData.get("note") || "") || null;

  if (!categoryId || !year || !month || !Number.isFinite(amount)) {
    throw new Error("بيانات المصروف غير مكتملة");
  }

  await prisma.expense.create({
    data: { categoryId, year, month, amount, note },
  });

  revalidatePath("/");
  revalidatePath("/expenses");
}

export async function deleteExpense(id: string) {
  await prisma.expense.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/expenses");
}

export async function updateExpense(formData: FormData) {
  const id = String(formData.get("id") || "");
  const categoryId = String(formData.get("categoryId") || "");
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const amount = Number(formData.get("amount"));
  const note = String(formData.get("note") || "") || null;

  if (!id || !categoryId || !year || !month || !Number.isFinite(amount)) {
    throw new Error("بيانات المصروف غير مكتملة");
  }

  await prisma.expense.update({
    where: { id },
    data: { categoryId, year, month, amount, note },
  });

  revalidatePath("/");
  revalidatePath("/expenses");
  revalidatePath("/reports");
}

export async function toggleResident(id: string, active: boolean) {
  await prisma.resident.update({ where: { id }, data: { active } });
  revalidatePath("/residents");
  revalidatePath("/");
  revalidatePath("/reports");
}

function parseOptionalMonthField(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : null;
}

function parseOptionalYearField(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 2000 && n <= 2100 ? n : null;
}

export async function updateResident(formData: FormData) {
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const monthlyFee = Number(formData.get("monthlyFee") || 10);
  const activeFromYear = Number(formData.get("activeFromYear"));
  const activeFromMonth = Number(formData.get("activeFromMonth"));
  const activeToYear = parseOptionalYearField(formData, "activeToYear");
  const activeToMonth = parseOptionalMonthField(formData, "activeToMonth");
  const markInactive = String(formData.get("markInactive") || "") === "1";

  if (!id || !name) throw new Error("بيانات الجار غير مكتملة");
  if (
    !Number.isFinite(activeFromYear) ||
    !Number.isFinite(activeFromMonth) ||
    activeFromMonth < 1 ||
    activeFromMonth > 12
  ) {
    throw new Error("تاريخ بداية السكن غير صالح");
  }
  if ((activeToYear == null) !== (activeToMonth == null)) {
    throw new Error("حدد سنة وشهر الخروج معاً، أو اتركهما فارغين");
  }

  await prisma.resident.update({
    where: { id },
    data: {
      name,
      monthlyFee: Number.isFinite(monthlyFee) ? monthlyFee : 10,
      activeFromYear,
      activeFromMonth,
      activeToYear,
      activeToMonth,
      ...(markInactive || activeToYear != null ? { active: false } : {}),
    },
  });

  revalidatePath("/residents");
  revalidatePath(`/residents/${id}`);
  revalidatePath("/");
  revalidatePath("/payments");
  revalidatePath("/reports");
}

/** ساكن جديد في شقة (مع تاريخ دخول) */
export async function createResident(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const monthlyFee = Number(formData.get("monthlyFee") || 10);
  const activeFromYear = Number(formData.get("activeFromYear"));
  const activeFromMonth = Number(formData.get("activeFromMonth"));
  if (!name) throw new Error("اسم الساكن مطلوب");
  if (
    !Number.isFinite(activeFromYear) ||
    !Number.isFinite(activeFromMonth) ||
    activeFromMonth < 1 ||
    activeFromMonth > 12
  ) {
    throw new Error("تاريخ الدخول غير صالح");
  }

  const max = await prisma.resident.aggregate({ _max: { sortOrder: true } });
  await prisma.resident.create({
    data: {
      name,
      monthlyFee: Number.isFinite(monthlyFee) ? monthlyFee : 10,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
      active: true,
      activeFromYear,
      activeFromMonth,
      activeToYear: null,
      activeToMonth: null,
    },
  });

  revalidatePath("/residents");
  revalidatePath("/");
  revalidatePath("/reports");
}

export async function createCategory(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("اسم البند مطلوب");
  const max = await prisma.expenseCategory.aggregate({
    _max: { sortOrder: true },
  });
  await prisma.expenseCategory.create({
    data: { name, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  revalidatePath("/expenses");
}
