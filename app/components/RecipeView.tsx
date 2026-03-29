"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import StepCard from "./StepCard";
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

interface RecipeViewProps {
  recipeId: string | null;
  title: string;
  summary: string;
  sourceLinks: string[];
  steps: StepData[];
  status: "idle" | "generating" | "completed" | "failed";
  errorMessage: string | null;
}

export default function RecipeView({
  recipeId, title, summary, sourceLinks, steps, status, errorMessage,
}: RecipeViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasPendingImages = steps.some(
    (s) => s.isComplete && (s.imageStatus === "PENDING" || s.imageStatus === "GENERATING")
  );

  const updateImageStatuses = useCallback(async () => {
    const id = recipeId?.trim();
    if (!id) return;
    const path = `/api/recipes/${encodeURIComponent(id)}/images/status`;
    const maxAttempts = 5;
    const pauseMs = 500;

    try {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, pauseMs));
        }
        const res = await fetch(path, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.steps) {
            window.dispatchEvent(
              new CustomEvent("image-status-update", { detail: data.steps })
            );
          }
          return;
        }
        if (res.status !== 404) {
          return;
        }
      }
    } catch {
      /* ignore */
    }
  }, [recipeId]);

  useEffect(() => {
    if (hasPendingImages && recipeId) {
      updateImageStatuses();
      pollRef.current = setInterval(updateImageStatuses, 5000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [hasPendingImages, recipeId, updateImageStatuses]);

  useEffect(() => {
    if (status === "generating") bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [steps.length, status]);

  if (errorMessage) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        style={{ maxWidth: 560, margin: "32px auto 0" }}>
        <div className="banner-error" style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 20 }}>
          <span style={{ fontSize: 22 }}>⚠️</span>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "#943526" }}>{errorMessage}</p>
        </div>
      </motion.div>
    );
  }

  if (!title && status === "idle") return null;

  return (
    <div style={{ maxWidth: 560, margin: "40px auto 0", paddingBottom: 140 }}>
      {/* Recipe Title */}
      <AnimatePresence mode="wait">
        {title && (
          <motion.div key="header" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }} style={{ marginBottom: 36 }}>

            {/* Decorative accent */}
            <div style={{
              width: 40, height: 4, borderRadius: 2, marginBottom: 20,
              background: "linear-gradient(90deg, #B8432E, #D4956A)",
            }} />

            <h2 style={{
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
              fontSize: "clamp(1.6rem, 4vw, 2.2rem)",
              lineHeight: 1.2, color: "#1C1915", margin: 0,
            }}>
              {title}
            </h2>
            {summary && (
              <p style={{ marginTop: 10, fontSize: 15, lineHeight: 1.7, color: "#5C5549" }}>
                {summary}
              </p>
            )}
            {sourceLinks.length > 0 && (
              <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap" as const, gap: 10 }}>
                {sourceLinks.map((link, i) => (
                  <a key={i} href={link} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#9E9486", textDecoration: "none" }}>
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                    参考来源 {i + 1}
                  </a>
                ))}
              </div>
            )}
            <div className="divider-warm" style={{ marginTop: 24 }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {steps.map((step, idx) => (
          <StepCard key={step.id} index={idx} stepOrder={step.stepOrder}
            text={step.text} isComplete={step.isComplete} ingredients={step.ingredients}
            duration={step.duration} imageStatus={step.imageStatus} imageUrl={step.imageUrl} />
        ))}
      </div>

      {/* Generating */}
      {status === "generating" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ marginTop: 40, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <div style={{ display: "flex", gap: 4 }}>
            {[0, 1, 2].map((i) => (
              <motion.div key={i}
                style={{ width: 6, height: 6, borderRadius: "50%", background: "#B8432E" }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
          <span style={{ fontSize: 14, color: "#9E9486" }}>AI 正在编写菜谱...</span>
        </motion.div>
      )}

      {/* Completed */}
      {status === "completed" && steps.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 32 }}>
          <div className="banner-success" style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", background: "rgba(93,122,82,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#5D7A52" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#3D5C34", margin: 0 }}>菜谱编写完成</p>
              <p style={{ fontSize: 12, color: "#5D7A52", margin: "2px 0 0", opacity: 0.8 }}>
                共 {steps.length} 个步骤 · 配图生成中
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
