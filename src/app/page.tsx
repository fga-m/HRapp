import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#ECE3DF] p-4">
      <div className="w-full max-w-md px-6 py-10 md:px-8 md:py-12 bg-white rounded-2xl shadow-lg text-center">
        {/* Logo / Org Name */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#223149] mb-4">
            <span
              className="text-white text-2xl font-bold"
              style={{ fontFamily: "var(--font-league-spartan)" }}
            >
              FGA
            </span>
          </div>
          <h1
            className="text-3xl font-bold text-[#223149]"
            style={{ fontFamily: "var(--font-league-spartan)" }}
          >
            FGA Melbourne
          </h1>
          <p className="text-[#50676E] mt-1 text-sm">Staff HR Portal</p>
        </div>

        {/* Sign in form */}
        <form
          action={async () => {
            "use server";
            const { signIn } = await import("@/lib/auth");
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="flex items-center justify-center gap-3 w-full px-6 py-3 rounded-xl bg-[#223149] text-white font-semibold hover:bg-[#1a2638] transition-colors"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with your FGAM Account
          </button>
        </form>

        <p className="text-xs text-[#50676E] mt-4">
          Only @fgam.org.au accounts are permitted
        </p>
      </div>
    </main>
  );
}
