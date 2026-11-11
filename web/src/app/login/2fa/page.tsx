import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { confirmTotp } from "@/lib/auth-actions";
import { getPendingUser } from "@/lib/auth";
import { otpauthUri } from "@/lib/totp";

export const dynamic = "force-dynamic";

export default async function TwoFactorSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await getPendingUser();
  if (!user || !user.totpSecret) redirect("/login");

  const uri = otpauthUri(user.totpSecret, user.username, "Jiran Almahabba");
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220 });

  return (
    <div className="mx-auto max-w-sm">
      <form action={confirmTotp} className="panel space-y-4">
        <div>
          <h1 className="text-xl font-bold">تفعيل التحقق بخطوتين</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            افتح تطبيق المصادقة (Google Authenticator أو Microsoft Authenticator أو Authy)
            وامسح الرمز، ثم أدخل الرمز المكوّن من 6 أرقام للتأكيد.
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qr}
          alt="رمز QR لتطبيق المصادقة"
          width={220}
          height={220}
          className="mx-auto rounded-lg bg-white p-2"
        />
        <div className="field">
          <label>أو أدخل المفتاح يدوياً</label>
          <code
            dir="ltr"
            className="break-all rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
          >
            {user.totpSecret}
          </code>
        </div>
        {error === "code" ? (
          <p className="rounded-lg border border-[#f0cfcf] bg-white px-3 py-2 text-sm text-[var(--bad)]">
            الرمز غير صحيح. تأكد من ضبط وقت الهاتف تلقائياً وحاول مجدداً.
          </p>
        ) : null}
        <div className="field">
          <label htmlFor="code">رمز التحقق</label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            dir="ltr"
            placeholder="123456"
            required
            autoFocus
          />
        </div>
        <button type="submit" className="btn btn-primary w-full">
          تأكيد وتفعيل
        </button>
      </form>
    </div>
  );
}
