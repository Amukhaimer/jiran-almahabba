import Link from "next/link";
import { login } from "@/lib/auth-actions";
import { redirect } from "next/navigation";
import { ensureUserTable, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid: "بيانات الدخول أو رمز التحقق غير صحيح.",
  locked: "محاولات كثيرة خاطئة. حاول مجدداً بعد 15 دقيقة.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (await getSessionUser()) redirect("/");
  await ensureUserTable();
  const hasUser = (await prisma.user.count()) > 0;

  return (
    <div className="mx-auto max-w-sm">
      <form action={login} className="panel space-y-4">
        <h1 className="text-xl font-bold">تسجيل الدخول</h1>
        {error && ERRORS[error] ? (
          <p className="rounded-lg border border-[#f0cfcf] bg-white px-3 py-2 text-sm text-[var(--bad)]">
            {ERRORS[error]}
          </p>
        ) : null}
        {!hasUser ? (
          <p className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--muted)]">
            لم يُنشأ حساب بعد. استخدم{" "}
            <Link href="/setup" className="text-[var(--accent)] underline">
              رابط الإعداد
            </Link>{" "}
            لإنشاء الحساب.
          </p>
        ) : null}
        <div className="field">
          <label htmlFor="username">اسم المستخدم</label>
          <input id="username" name="username" autoComplete="username" dir="ltr" required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="password">كلمة المرور</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="code">رمز التحقق (من تطبيق المصادقة)</label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            dir="ltr"
            placeholder="123456"
          />
        </div>
        <button type="submit" className="btn btn-primary w-full">
          دخول
        </button>
      </form>
    </div>
  );
}
