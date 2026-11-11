import { redirect } from "next/navigation";
import { setupAccount } from "@/lib/auth-actions";
import { MIN_PASSWORD_LENGTH, ensureUserTable } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  token: "رمز الإعداد غير صحيح.",
  locked: "محاولات كثيرة خاطئة. حاول مجدداً بعد 15 دقيقة.",
  username: "اسم المستخدم: 3 إلى 32 خانة من أحرف إنجليزية صغيرة وأرقام و . _ -",
  password: `كلمة المرور يجب ألا تقل عن ${MIN_PASSWORD_LENGTH} خانات.`,
  mismatch: "كلمتا المرور غير متطابقتين.",
};

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; token?: string }>;
}) {
  const { error, token } = await searchParams;
  await ensureUserTable();
  if ((await prisma.user.count()) > 0) redirect("/login");

  return (
    <div className="mx-auto max-w-sm">
      <form action={setupAccount} className="panel space-y-4">
        <div>
          <h1 className="text-xl font-bold">إنشاء حساب المدير</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            خطوة لمرة واحدة. بعدها ستُفعّل التحقق بخطوتين من تطبيق المصادقة.
          </p>
        </div>
        {error && ERRORS[error] ? (
          <p className="rounded-lg border border-[#f0cfcf] bg-white px-3 py-2 text-sm text-[var(--bad)]">
            {ERRORS[error]}
          </p>
        ) : null}
        <div className="field">
          <label htmlFor="token">رمز الإعداد</label>
          <input id="token" name="token" defaultValue={token ?? ""} dir="ltr" autoComplete="off" required />
        </div>
        <div className="field">
          <label htmlFor="username">اسم المستخدم</label>
          <input id="username" name="username" autoComplete="username" dir="ltr" required />
        </div>
        <div className="field">
          <label htmlFor="password">كلمة المرور ({MIN_PASSWORD_LENGTH} خانات على الأقل)</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            dir="ltr"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="confirm">تأكيد كلمة المرور</label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            dir="ltr"
            required
          />
        </div>
        <button type="submit" className="btn btn-primary w-full">
          إنشاء الحساب
        </button>
      </form>
    </div>
  );
}
