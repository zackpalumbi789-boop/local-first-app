"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [timingInfo, setTimingInfo] = useState<string | null>(null);

  useEffect(() => {
    router.prefetch("/dashboard");
    // Warm up auth route and DB connection during idle time.
    void fetch("/api/auth/get-session", {
      credentials: "include",
      cache: "no-store",
    }).catch(() => undefined);
  }, [router]);

  const oauthErrorMessage = (() => {
    const oauth = searchParams.get("oauth");
    const oauthError = searchParams.get("error");
    if (oauth !== "github-error") return null;
    const extra =
      oauthError === "invalid_code"
        ? "（通常是 GitHub Client Secret 不匹配、未重启服务，或 callback URL 配置不一致）"
        : "";
    return `GitHub 登录失败：${oauthError ?? "unknown_error"} ${extra}`.trim();
  })();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setTimingInfo(null);
    setLoading(true);
    const submitStart = performance.now();

    const res = await fetch("/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        email,
        password,
      }),
    });

    if (!res.ok) {
      let message = "登录失败，请检查邮箱或密码。";
      try {
        const body = (await res.json()) as { message?: string; error?: { message?: string } };
        message = body.error?.message || body.message || message;
      } catch {}
      setLoading(false);
      setError(message);
      return;
    }

    const apiMs = Math.round(performance.now() - submitStart);
    const navStart = Date.now();
    sessionStorage.setItem("auth_debug_nav_start", String(navStart));
    sessionStorage.setItem("auth_debug_api_ms", String(apiMs));
    sessionStorage.setItem("auth_debug_flow", "login");
    const pendingDebug = {
      flow: "login",
      apiMs,
      navStart,
      at: new Date().toISOString(),
    };
    localStorage.setItem("auth_debug_pending", JSON.stringify(pendingDebug));
    console.info("[auth-debug] login pending", pendingDebug);
    setTimingInfo(`登录 API 耗时 ${apiMs}ms，正在跳转...`);

    router.replace("/dashboard");
  };

  const handleGithubSignIn = async () => {
    setError(null);
    setOauthLoading(true);
    const result = await authClient.signIn.social({
      provider: "github",
      callbackURL: "/dashboard",
      errorCallbackURL: "/login?oauth=github-error",
    });
    if (result?.error) {
      setOauthLoading(false);
      setError(result.error.message ?? "GitHub 登录失败，请稍后重试。");
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "40px 20px",
        background:
          "radial-gradient(circle at 20% 0%, #F3E6D4 0%, #F6F1EA 40%, #F6F1EA 100%)",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link
            href="/"
            style={{
              fontSize: 13,
              color: "#5F574B",
              textDecoration: "none",
              border: "1px solid rgba(160,140,110,0.25)",
              borderRadius: 10,
              padding: "8px 12px",
              background: "rgba(255,255,255,0.6)",
            }}
          >
            返回首页
          </Link>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "#B8432E",
              background: "#F4DDD6",
              borderRadius: 999,
              padding: "6px 10px",
            }}
          >
            AUTH
          </span>
        </div>

        <section
          style={{
            borderRadius: 20,
            border: "1px solid rgba(160,140,110,0.22)",
            background: "rgba(255,255,255,0.78)",
            backdropFilter: "blur(10px)",
            padding: 24,
            boxShadow: "0 16px 40px rgba(100,76,40,0.10)",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 32, color: "#1C1915", letterSpacing: "-0.02em" }}>欢迎回来</h1>
          <p style={{ margin: "10px 0 20px", color: "#7C7264", fontSize: 14 }}>
            登录后可保存你的菜谱生成记录，并在 Dashboard 管理账户。
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              style={{
                borderRadius: 12,
                border: "1px solid rgba(168,146,112,0.35)",
                background: "#FFFDF9",
                padding: "12px 14px",
                fontSize: 14,
                color: "#2C261F",
              }}
              type="email"
              placeholder="邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
            <input
              style={{
                borderRadius: 12,
                border: "1px solid rgba(168,146,112,0.35)",
                background: "#FFFDF9",
                padding: "12px 14px",
                fontSize: 14,
                color: "#2C261F",
              }}
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
            {error || oauthErrorMessage ? (
              <p
                style={{
                  margin: "2px 0 0",
                  color: "#A83C31",
                  fontSize: 13,
                  background: "#FBEAE7",
                  border: "1px solid #F3CCC5",
                  borderRadius: 10,
                  padding: "8px 10px",
                }}
              >
                {error ?? oauthErrorMessage}
              </p>
            ) : null}
            <button
              style={{
                marginTop: 4,
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg, #B8432E, #D25A32)",
                color: "white",
                fontWeight: 600,
                letterSpacing: "0.02em",
                padding: "12px 14px",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
              type="submit"
              disabled={loading}
            >
              {loading ? "登录中..." : "登录"}
            </button>
            <button
              type="button"
              onClick={handleGithubSignIn}
              disabled={loading || oauthLoading}
              style={{
                borderRadius: 12,
                border: "1px solid rgba(160,140,110,0.25)",
                background: "rgba(255,255,255,0.85)",
                color: "#1C1915",
                fontWeight: 600,
                letterSpacing: "0.01em",
                padding: "12px 14px",
                cursor: loading || oauthLoading ? "not-allowed" : "pointer",
                opacity: loading || oauthLoading ? 0.7 : 1,
              }}
            >
              {oauthLoading ? "正在跳转 GitHub..." : "使用 GitHub 登录"}
            </button>
            {timingInfo ? (
              <p style={{ margin: 0, fontSize: 12, color: "#7C7264" }}>{timingInfo}</p>
            ) : null}
          </form>

          <p style={{ margin: "16px 0 0", color: "#766A5B", fontSize: 14 }}>
            还没有账号？{" "}
            <Link href="/register" style={{ color: "#B8432E", textDecoration: "none", fontWeight: 600 }}>
              去注册
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            padding: "40px 20px",
            background:
              "radial-gradient(circle at 20% 0%, #F3E6D4 0%, #F6F1EA 40%, #F6F1EA 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#7C7264",
            fontSize: 14,
          }}
        >
          加载中…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
