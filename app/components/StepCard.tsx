"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { ImageStatus, Ingredient } from "@/lib/types";

interface StepCardProps {
  index: number;
  stepOrder: number;
  text: string;
  isComplete: boolean;
  ingredients: Ingredient[];
  duration: number;
  imageStatus: ImageStatus;
  imageUrl: string | null;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec === 0 ? `${min}分钟` : `${min}分${sec}秒`;
}

function ImageSkeleton({ status }: { status: ImageStatus }) {
  if (status === "SUCCESS") return null;
  return (
    <div style={{
      width: "100%", aspectRatio: "4/3", borderRadius: 12, overflow: "hidden",
      position: "relative", background: "#EDE8DF",
    }}>
      {(status === "PENDING" || status === "GENERATING") && (
        <>
          <div className="animate-shimmer" style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
          }} />
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 10,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%", animation: "spin 1s linear infinite",
              border: "2px solid #F4DDD6", borderTopColor: "#B8432E",
            }} />
            <span style={{ fontSize: 12, color: "#9E9486" }}>
              {status === "PENDING" ? "等待生图..." : "AI 绘制中 · 约30s"}
            </span>
          </div>
        </>
      )}
      {status === "FAILED" && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 8, background: "#FEF0E8",
        }}>
          <span style={{ fontSize: 28, opacity: 0.4 }}>🍽️</span>
          <span style={{ fontSize: 12, color: "#B8432E" }}>图片生成失败</span>
        </div>
      )}
    </div>
  );
}

function StepImage({ imageUrl, stepOrder }: { imageUrl: string; stepOrder: number }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div style={{
        width: "100%", aspectRatio: "4/3", borderRadius: 12, background: "#EDE8DF",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        <span style={{ fontSize: 28, opacity: 0.3 }}>🍽️</span>
        <span style={{ fontSize: 12, color: "#9E9486" }}>图片加载失败</span>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 12 }}>
      {!loaded && (
        <div style={{ width: "100%", aspectRatio: "4/3", borderRadius: 12, background: "#EDE8DF", animation: "pulse 2s ease infinite" }} />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={`步骤 ${stepOrder}`}
        style={{
          width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 12,
          transition: "opacity 0.7s",
          opacity: loaded ? 1 : 0,
          position: loaded ? "relative" : "absolute",
          inset: loaded ? undefined : 0,
        }}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}

export default function StepCard({
  index, stepOrder, text, isComplete, ingredients, duration, imageStatus, imageUrl,
}: StepCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="card-step"
      style={{ overflow: "hidden" }}
    >
      <div style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", gap: 16 }}>
          {/* Step number */}
          <div style={{ flexShrink: 0, marginTop: 2 }}>
            <div className={!isComplete ? "animate-pulse-ring" : ""} style={{
              width: 34, height: 34, borderRadius: "50%",
              background: "linear-gradient(135deg, #B8432E, #D25A32)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", fontSize: 14, fontWeight: 700,
              boxShadow: "0 2px 6px rgba(184,67,46,0.2)",
            }}>
              {stepOrder}
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, lineHeight: 1.75, color: "#1C1915", margin: 0 }}>
              {text}
              {!isComplete && (
                <span className="cursor-blink" style={{
                  display: "inline-block", width: 2, height: 16, marginLeft: 2,
                  verticalAlign: "middle", borderRadius: 1, background: "#B8432E",
                }} />
              )}
            </p>

            {/* Ingredients */}
            {isComplete && ingredients.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
                style={{ marginTop: 14 }}>
                <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
                  {ingredients.map((ing, idx) => (
                    <span key={idx} className="chip-sage"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 500 }}
                      title={ing.substitute ? `可替换为 ${ing.substitute}` : undefined}
                    >
                      {ing.name}
                      <span style={{ opacity: 0.6, fontWeight: 400 }}>{ing.amount}</span>
                    </span>
                  ))}
                </div>
                {ingredients.some((i) => i.substitute) && (
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
                    {ingredients.filter((i) => i.substitute).map((ing, idx) => (
                      <span key={idx} className="chip-honey"
                        style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500 }}>
                        💡 {ing.name} → {ing.substitute}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Duration */}
            {isComplete && duration > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#9E9486" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span style={{ fontSize: 13, color: "#9E9486" }}>约 {formatDuration(duration)}</span>
              </motion.div>
            )}
          </div>
        </div>

        {/* Image */}
        {isComplete && (
          <div style={{ marginTop: 20, marginLeft: 50 }}>
            {imageStatus === "SUCCESS" && imageUrl ? (
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
                <StepImage imageUrl={imageUrl} stepOrder={stepOrder} />
              </motion.div>
            ) : (
              <ImageSkeleton status={imageStatus} />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
