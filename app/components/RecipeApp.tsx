"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import SearchInput from "./SearchInput";
import RecipeView from "./RecipeView";
import AdjustPanel from "./AdjustPanel";
import HomeAuthEntry from "./auth/HomeAuthEntry";
import type { ImageStatus, Ingredient } from "@/lib/types";

interface StepData {
  id: string;
  stepOrder: number;
  text: string;
  isComplete: boolean;
  ingredients: Ingredient[];
  duration: number;
  imageStatus: ImageStatus;
  imageUrl: string | null;
}

type AppStatus = "idle" | "generating" | "completed" | "failed";

type RecipeAppProps = {
  initialUser?: {
    email: string;
  } | null;
};

type RecipeStreamFollowUp = { recipeId: string; stepIds: string[] };

export default function RecipeApp({ initialUser = null }: RecipeAppProps) {
  const router = useRouter();
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [sourceLinks, setSourceLinks] = useState<string[]>([]);
  const [steps, setSteps] = useState<StepData[]>([]);
  const [status, setStatus] = useState<AppStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        id: string;
        step_order: number;
        image_status: ImageStatus;
        image_url: string | null;
      }[];
      setSteps((prev) =>
        prev.map((step) => {
          const update = detail.find((d) => d.id === step.id);
          return update
            ? { ...step, imageStatus: update.image_status, imageUrl: update.image_url }
            : step;
        })
      );
    };
    window.addEventListener("image-status-update", handler);
    return () => window.removeEventListener("image-status-update", handler);
  }, []);

  const fillRecipeStepImages = useCallback(
    async (recipeIdForImages: string, stepIds: string[]) => {
      if (stepIds.length === 0) return;
      try {
        const pr = await fetch(`/api/recipes/${recipeIdForImages}/image-prompts`, {
          method: "POST",
        });
        if (!pr.ok) return;
        const data = (await pr.json()) as {
          configured?: boolean;
          prompts?: string[];
        };
        if (!data.configured || !Array.isArray(data.prompts)) return;
        const prompts = data.prompts;
        if (prompts.length !== stepIds.length) return;

        await Promise.all(
          stepIds.map((stepId, i) =>
            fetch(`/api/recipes/${recipeIdForImages}/step-image`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                step_id: stepId,
                prompt: prompts[i] ?? "",
              }),
            }).then(async (r) => {
              if (!r.ok) return;
              const j = (await r.json()) as {
                image_status: ImageStatus;
                image_url: string | null;
              };
              window.dispatchEvent(
                new CustomEvent("image-status-update", {
                  detail: [
                    {
                      id: stepId,
                      step_order: 0,
                      image_status: j.image_status,
                      image_url: j.image_url,
                    },
                  ],
                })
              );
            })
          )
        );
      } catch {
        /* 配图失败不影响正文展示 */
      }
    },
    []
  );

  const processStream = useCallback(
    async (
      response: Response,
      isAdjust = false
    ): Promise<RecipeStreamFollowUp | null> => {
      const reader = response.body?.getReader();
      if (!reader) return null;
      const followUp: RecipeStreamFollowUp = { recipeId: "", stepIds: [] };
      let sawDone = false;
      let sawError = false;
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          try {
            const event = JSON.parse(jsonStr);
            switch (event.type) {
              case "meta": {
                const rid = event.data.recipe_id;
                if (typeof rid === "string" && rid.trim()) {
                  followUp.recipeId = rid.trim();
                }
                if (!isAdjust && typeof rid === "string" && rid.trim()) {
                  setRecipeId(rid.trim());
                }
                setTitle(String(event.data.title ?? ""));
                setSummary(String(event.data.summary ?? ""));
                setSourceLinks(
                  Array.isArray(event.data.source_links)
                    ? (event.data.source_links as string[])
                    : []
                );
                if (isAdjust) setSteps([]);
                break;
              }
              case "step": {
                const d = event.data;
                if (d.is_complete && typeof d.step_id === "string") {
                  followUp.stepIds.push(d.step_id);
                }
                setSteps((prev) => {
                  const existing = prev.find((s) => s.id === d.step_id);
                  if (existing) {
                    return prev.map((s) =>
                      s.id === d.step_id
                        ? {
                            ...s,
                            text: d.is_complete ? d.description : s.text + d.text_chunk,
                            isComplete: d.is_complete,
                            ingredients: d.is_complete ? d.ingredients : s.ingredients,
                            duration: d.is_complete ? d.duration : s.duration,
                            imageStatus: d.is_complete
                              ? ((d.image_status as ImageStatus) ?? "PENDING")
                              : s.imageStatus,
                            imageUrl: d.is_complete
                              ? typeof d.image_url === "string"
                                ? d.image_url
                                : d.image_url === null
                                  ? null
                                  : s.imageUrl
                              : s.imageUrl,
                          }
                        : s
                    );
                  }
                  return [
                    ...prev,
                    {
                      id: d.step_id,
                      stepOrder: d.step_order,
                      text: d.is_complete
                        ? String(d.description ?? "")
                        : d.text_chunk,
                      isComplete: Boolean(d.is_complete),
                      ingredients: d.is_complete ? d.ingredients ?? [] : [],
                      duration: d.is_complete ? d.duration ?? 0 : 0,
                      imageStatus: (d.is_complete
                        ? ((d.image_status as ImageStatus) ?? "PENDING")
                        : "PENDING") as ImageStatus,
                      imageUrl: d.is_complete
                        ? typeof d.image_url === "string"
                          ? d.image_url
                          : d.image_url === null
                            ? null
                            : null
                        : null,
                    },
                  ];
                });
                break;
              }
              case "done": {
                sawDone = true;
                const rid = event.data.recipe_id;
                if (typeof rid === "string" && rid.trim()) {
                  followUp.recipeId = rid.trim();
                  setRecipeId(rid.trim());
                }
                setStatus("completed");
                break;
              }
              case "error":
                sawError = true;
                setErrorMessage(event.data.message);
                setStatus("failed");
                break;
            }
          } catch { /* skip */ }
        }
      }
      if (!sawDone && !sawError) {
        setStatus((s) => (s === "generating" ? "failed" : s));
        setErrorMessage(
          (prev) =>
            prev ?? "生成中断（常见于网关超时）。请重试；若仍失败需在 EdgeOne 侧放宽页面函数超时。"
        );
      }
      if (
        sawDone &&
        !sawError &&
        followUp.recipeId &&
        followUp.stepIds.length > 0
      ) {
        return followUp;
      }
      return null;
    },
    []
  );

  const handleGenerate = useCallback(
    async (query: string) => {
      if (!initialUser) {
        router.push("/login");
        return;
      }
      if (abortRef.current) abortRef.current.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setStatus("generating");
      setErrorMessage(null);
      setTitle(""); setSummary(""); setSourceLinks([]); setSteps([]); setRecipeId(null);
      try {
        const res = await fetch("/api/generate/recipe", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }), signal: ac.signal,
        });
        if (!res.ok) throw new Error("请求失败");
        const followUp = await processStream(res);
        if (followUp) void fillRecipeStepImages(followUp.recipeId, followUp.stepIds);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setErrorMessage("网络连接失败，请稍后重试");
        setStatus("failed");
      }
    },
    [processStream, fillRecipeStepImages, initialUser, router]
  );

  const handleAdjust = useCallback(
    async (instruction: string) => {
      if (!initialUser) {
        router.push("/login");
        return;
      }
      if (!recipeId) return;
      setIsAdjusting(true);
      setStatus("generating");
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/recipes/${recipeId}/adjust`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instruction }),
        });
        if (!res.ok) throw new Error("调整失败");
        const followUp = await processStream(res, true);
        if (followUp) void fillRecipeStepImages(followUp.recipeId, followUp.stepIds);
      } catch {
        setErrorMessage("调整失败，请稍后重试");
        setStatus("failed");
      } finally {
        setIsAdjusting(false);
      }
    },
    [recipeId, processStream, fillRecipeStepImages, initialUser, router]
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* ── Header Bar ── */}
      <header
        style={{
          position: "sticky", top: 0, zIndex: 40,
          backdropFilter: "blur(20px)",
          backgroundColor: "rgba(246, 241, 234, 0.85)",
          borderBottom: "1px solid rgba(160,140,110,0.15)",
        }}
      >
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Logo */}
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #B8432E, #D25A32)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(184,67,46,0.25)",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M12 2c.5 3.5-1.5 6-3 8 1.5-.5 3-.5 4 1-2 1-3 3-3 5.5C11 18 12.5 19 14 19c-1 1-3 2-6 2-4 0-6-3-6-6.5 0-5.5 5-10 10-12.5z" />
              </svg>
            </div>
            <span style={{ fontSize: 17, fontWeight: 600, color: "#1C1915", letterSpacing: "-0.01em" }}>
              智能菜谱
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, color: "#B8432E",
              letterSpacing: "0.14em", textTransform: "uppercase" as const,
              background: "#F4DDD6", padding: "3px 8px", borderRadius: 6,
            }}>
              AI
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {recipeId && status === "completed" && (
              <span style={{
                fontSize: 11, fontFamily: "monospace", color: "#9E9486",
                background: "#EDE8DF", padding: "4px 10px", borderRadius: 6,
              }}>
                #{recipeId.slice(0, 8)}
              </span>
            )}
            <HomeAuthEntry initialUser={initialUser} />
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ flex: 1, padding: "24px 24px 40px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>

          {/* Hero — idle only */}
          {status === "idle" && (
            <div className="hero-panel animate-fade-up" style={{ padding: "48px 40px 44px", marginBottom: 32, textAlign: "center" as const }}>
              {/* Decorative top bar */}
              <div style={{
                width: 48, height: 4, borderRadius: 2, margin: "0 auto 24px",
                background: "linear-gradient(90deg, #B8432E, #D4956A)",
              }} />

              <p style={{
                fontSize: 13, fontWeight: 600, letterSpacing: "0.16em",
                textTransform: "uppercase" as const, color: "#B8432E", marginBottom: 16,
              }}>
                AI-Powered Recipe Studio
              </p>

              <h1 style={{
                fontFamily: "var(--font-instrument-serif), Georgia, serif",
                fontSize: "clamp(2.2rem, 5vw, 3.2rem)",
                lineHeight: 1.15, color: "#1C1915",
                margin: "0 0 8px",
              }}>
                想吃什么，
              </h1>
              <h1 style={{
                fontFamily: "var(--font-instrument-serif), Georgia, serif",
                fontSize: "clamp(2.2rem, 5vw, 3.2rem)",
                lineHeight: 1.15, color: "#B8432E",
                margin: "0 0 20px",
              }}>
                告诉我就好
              </h1>

              <p style={{ fontSize: 16, lineHeight: 1.7, color: "#5C5549", maxWidth: 380, margin: "0 auto" }}>
                输入一道菜名，AI 拆解详细步骤<br />并为每一步生成写实效果图
              </p>
            </div>
          )}

          <SearchInput onSubmit={handleGenerate} isGenerating={status === "generating"} />

          <RecipeView
            recipeId={recipeId} title={title} summary={summary}
            sourceLinks={sourceLinks} steps={steps} status={status}
            errorMessage={errorMessage}
          />
        </div>
      </main>

      <AdjustPanel
        recipeId={recipeId || ""} onAdjust={handleAdjust}
        isAdjusting={isAdjusting} isVisible={status === "completed" && !!recipeId}
      />
    </div>
  );
}
