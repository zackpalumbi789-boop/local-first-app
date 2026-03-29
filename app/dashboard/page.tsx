"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "@/app/components/auth/LogoutButton";
import { authClient } from "@/lib/auth-client";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  // Must stay null until after mount — reading storage in useState init causes
  // server HTML (null) vs client hydration (string) mismatch.
  const [debugTiming, setDebugTiming] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.replace("/login");
    }
  }, [isPending, session?.user, router]);

  useEffect(() => {
    const navStartRaw = sessionStorage.getItem("auth_debug_nav_start");
    const apiMsRaw = sessionStorage.getItem("auth_debug_api_ms");
    const flow = sessionStorage.getItem("auth_debug_flow");

    let line: string | null = null;

    if (navStartRaw && apiMsRaw && flow) {
      const navStart = Number(navStartRaw);
      const apiMs = Number(apiMsRaw);
      if (!Number.isNaN(navStart) && !Number.isNaN(apiMs)) {
        const navMs = Date.now() - navStart;
        const totalMs = apiMs + navMs;
        line = `${flow === "login" ? "登录" : "注册"}: API ${apiMs}ms + 跳转/渲染 ${navMs}ms = 总计 ${totalMs}ms`;
        const result = {
          flow,
          apiMs,
          navMs,
          totalMs,
          line,
          at: new Date().toISOString(),
        };
        localStorage.setItem(
          "auth_debug_last_result",
          JSON.stringify(result),
        );
        console.info("[auth-debug] result", { flow, apiMs, navMs, totalMs });
      }
    } else {
      const lastRaw = localStorage.getItem("auth_debug_last_result");
      if (lastRaw) {
        try {
          const last = JSON.parse(lastRaw) as { line?: string };
          line = last.line ?? null;
        } catch {
          line = null;
        }
      }
    }

    sessionStorage.removeItem("auth_debug_nav_start");
    sessionStorage.removeItem("auth_debug_api_ms");
    sessionStorage.removeItem("auth_debug_flow");

    setDebugTiming(line);
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "40px 20px",
        background:
          "radial-gradient(circle at 20% 0%, #F3E6D4 0%, #F6F1EA 40%, #F6F1EA 100%)",
      }}
    >
      <section
        style={{
          maxWidth: 760,
          margin: "0 auto",
          borderRadius: 22,
          border: "1px solid rgba(160,140,110,0.2)",
          background: "rgba(255,255,255,0.8)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 18px 42px rgba(100,76,40,0.10)",
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, #B8432E, #D25A32)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: 700,
              }}
            >
              A
            </div>
            <span style={{ fontSize: 12, color: "#7F7466", letterSpacing: "0.09em" }}>ACCOUNT CENTER</span>
          </div>
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
            返回主页面
          </Link>
        </div>

        <h1 style={{ margin: 0, fontSize: 34, color: "#1C1915", letterSpacing: "-0.02em" }}>Dashboard</h1>
        {isPending ? (
          <p style={{ margin: "10px 0 20px", color: "#877D6F", fontSize: 14 }}>正在加载账号信息...</p>
        ) : (
          <>
            <p style={{ margin: "10px 0 0", color: "#564E43", fontSize: 18 }}>
              欢迎你，{session?.user?.name ?? session?.user?.email}
            </p>
            <p style={{ margin: "8px 0 20px", color: "#877D6F", fontSize: 14 }}>
              当前登录邮箱：{session?.user?.email}
            </p>
          </>
        )}

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            marginBottom: 20,
          }}
        >
          <article
            style={{
              borderRadius: 14,
              padding: "14px 16px",
              background: "#FFF9F2",
              border: "1px solid #F0DECB",
            }}
          >
            <p style={{ margin: 0, fontSize: 12, color: "#9A6B41", letterSpacing: "0.08em" }}>STATUS</p>
            <p style={{ margin: "6px 0 0", fontSize: 16, color: "#2D261E", fontWeight: 600 }}>已登录</p>
          </article>
          <article
            style={{
              borderRadius: 14,
              padding: "14px 16px",
              background: "#FFF7F4",
              border: "1px solid #F0D8CF",
            }}
          >
            <p style={{ margin: 0, fontSize: 12, color: "#A75A41", letterSpacing: "0.08em" }}>AUTH</p>
            <p style={{ margin: "6px 0 0", fontSize: 16, color: "#2D261E", fontWeight: 600 }}>邮箱密码</p>
          </article>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <LogoutButton />
        </div>
        {debugTiming ? (
          <p
            style={{
              margin: "12px 0 0",
              fontSize: 12,
              color: "#6D6254",
              background: "#F7EFE4",
              border: "1px solid #EAD9C3",
              borderRadius: 10,
              padding: "8px 10px",
            }}
          >
            调试耗时：{debugTiming}
          </p>
        ) : null}
      </section>
    </main>
  );
}
