import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EXCEL_CANDIDATES = [
  path.resolve(__dirname, "../data/جيران المحبة 2025.xlsx"),
  path.resolve(__dirname, "../../جيران المحبة 2025.xlsx"),
];

const EXCEL_PATH =
  EXCEL_CANDIDATES.find((p) => fs.existsSync(p)) || EXCEL_CANDIDATES[0];

function cellNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function parsePeriod(label: unknown): {
  year: number;
  month: number;
  kind: "MONTHLY" | "PRIOR_DEBT" | "SETTLEMENT";
  note?: string;
} | null {
  if (label instanceof Date) {
    return {
      year: label.getFullYear(),
      month: label.getMonth() + 1,
      kind: "MONTHLY",
    };
  }
  if (typeof label === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(label);
    if (d) return { year: d.y, month: d.m, kind: "MONTHLY" };
  }
  if (typeof label === "string") {
    const s = label.trim();
    if (s.includes("مستحقات سابقة")) {
      return { year: 2017, month: 3, kind: "PRIOR_DEBT", note: s };
    }
    if (s.includes("سداد")) {
      return { year: 2017, month: 3, kind: "SETTLEMENT", note: s };
    }
    if (s.includes("مجموع")) return null;
  }
  return null;
}

async function seed() {
  console.log("قراءة الإكسل من:", EXCEL_PATH);

  await prisma.payment.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.resident.deleteMany();
  await prisma.expenseCategory.deleteMany();

  const wb = XLSX.readFile(EXCEL_PATH);

  // --- الإيرادات ---
  const revSheet = wb.Sheets["ايرادات"];
  const revRows: unknown[][] = XLSX.utils.sheet_to_json(revSheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  const header = (revRows[0] || []) as unknown[];
  const residentNames: { name: string; col: number }[] = [];
  for (let col = 1; col < header.length; col++) {
    const name = header[col];
    if (typeof name === "string" && name.trim() && name.trim() !== "المجموع") {
      residentNames.push({ name: name.trim(), col });
    }
  }

  const residents = [];
  for (let i = 0; i < residentNames.length; i++) {
    const r = await prisma.resident.create({
      data: {
        name: residentNames[i].name,
        monthlyFee: 10,
        sortOrder: i,
      },
    });
    residents.push({ ...r, col: residentNames[i].col });
  }
  console.log(`الجيران: ${residents.length}`);

  let paymentCount = 0;
  for (let i = 1; i < revRows.length; i++) {
    const row = revRows[i];
    if (!row || !row[0]) continue;
    const period = parsePeriod(row[0]);
    if (!period) continue;

    for (const resident of residents) {
      const amount = cellNum(row[resident.col]);
      if (amount === null || amount === 0) continue;
      await prisma.payment.create({
        data: {
          residentId: resident.id,
          year: period.year,
          month: period.month,
          amount,
          kind: period.kind,
          note: period.note,
        },
      });
      paymentCount++;
    }
  }
  console.log(`الدفعات: ${paymentCount}`);

  // تعيين بداية السكن من أول اشتراك شهري لكل جار
  for (const resident of residents) {
    const first = await prisma.payment.findFirst({
      where: { residentId: resident.id, kind: "MONTHLY" },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    });
    await prisma.resident.update({
      where: { id: resident.id },
      data: {
        activeFromYear: first?.year ?? 2017,
        activeFromMonth: first?.month ?? 4,
        activeToYear: null,
        activeToMonth: null,
        active: true,
      },
    });
  }
  console.log("تم ضبط فترات السكن من أول دفعة شهرية.");

  // --- المصاريف ---
  const expSheet = wb.Sheets["المصاريف"];
  const expRows: unknown[][] = XLSX.utils.sheet_to_json(expSheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  const expHeader = (expRows[0] || []) as unknown[];
  const categories: { name: string; col: number; id: string }[] = [];
  for (let col = 1; col < expHeader.length; col++) {
    const name = expHeader[col];
    if (
      typeof name === "string" &&
      name.trim() &&
      name.trim() !== "المجموع" &&
      name.trim() !== "الرصيد"
    ) {
      const cat = await prisma.expenseCategory.create({
        data: { name: name.trim(), sortOrder: categories.length },
      });
      categories.push({ name: cat.name, col, id: cat.id });
    }
  }
  console.log(`بنود المصاريف: ${categories.length}`);

  // note column is after الرصيد (col 14 typically)
  const noteCol = expHeader.findIndex(
    (h) => h === null || h === undefined || h === "",
  );
  // From analysis, notes are in column index 14 (0-based) when present after الرصيد
  const notesColumn = 14;

  let expenseCount = 0;
  for (let i = 1; i < expRows.length; i++) {
    const row = expRows[i];
    if (!row || row[0] === null || row[0] === undefined || row[0] === "")
      continue;

    // Skip the totals row (row 2 in excel often has category sums with empty first cell partially)
    // Row index 1 in 0-based after header: first data might be totals with empty label
    const label = row[0];
    if (label === null || label === "") continue;
    if (typeof label === "string" && label.includes("مجموع")) continue;

    const period = parsePeriod(label);
    if (!period) continue;

    // Skip pure totals row that has category grand totals (first expense data row after header
    // in their sheet row 2 is totals - first cell empty so already skipped)
    const note =
      typeof row[notesColumn] === "string"
        ? (row[notesColumn] as string)
        : period.note;

    for (const cat of categories) {
      const amount = cellNum(row[cat.col]);
      if (amount === null || amount === 0) continue;
      await prisma.expense.create({
        data: {
          categoryId: cat.id,
          year: period.year,
          month: period.month,
          amount,
          note: note || null,
        },
      });
      expenseCount++;
    }
  }
  console.log(`قيود المصاريف: ${expenseCount}`);

  await prisma.setting.upsert({
    where: { key: "buildingName" },
    update: { value: "جيران المحبة" },
    create: { key: "buildingName", value: "جيران المحبة" },
  });
  await prisma.setting.upsert({
    where: { key: "defaultMonthlyFee" },
    update: { value: "10" },
    create: { key: "defaultMonthlyFee", value: "10" },
  });

  const income = await prisma.payment.aggregate({ _sum: { amount: true } });
  const expense = await prisma.expense.aggregate({ _sum: { amount: true } });
  const bal = (income._sum.amount ?? 0) - (expense._sum.amount ?? 0);
  console.log(
    `الإيرادات: ${income._sum.amount} | المصاريف: ${expense._sum.amount} | الرصيد: ${bal}`,
  );
  console.log("تم الاستيراد بنجاح.");
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
