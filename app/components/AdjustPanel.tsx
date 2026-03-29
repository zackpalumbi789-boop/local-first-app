"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const QUICK_ADJUSTMENTS = [
  { label: "少糖", icon: "🍬" },
  { label: "少盐", icon: "🧂" },
  { label: "少油", icon: "🫒" },
  { label: "不吃辣", icon: "🌶️" },
  { label: "减量一半", icon: "📉" },
  { label: "适合小孩", icon: "👶" },
];

interface AdjustPanelProps {
  recipeId: string;
  onAdjust: (instruction: string) => void;
  isAdjusting: boolean;
  isVisible: boolean;
}

export default function AdjustPanel({ recipeId, onAdjust, isAdjusting, isVisible }: AdjustPanelProps) {
  const [instruction, setInstruction] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (instruction.trim() && !isAdjusting) {
      onAdjust(instruction.trim());
      setInstruction("");
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
            backdropFilter: "blur(20px)",
            background: "linear-gradient(180deg, rgba(246,241,234,0.92) 0%, rgba(246,241,234,0.98) 100%)",
            borderTop: "1px solid rgba(160,140,110,0.15)",
            boxShadow: "0 -4px 24px rgba(100,80,50,0.06)",
          }}
        >
          <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 24px" }}>
            {/* Quick chips */}
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8, marginBottom: 12 }}>
              {QUICK_ADJUSTMENTS.map((adj) => (
                <button
                  key={adj.label}
                  onClick={() => !isAdjusting && onAdjust(adj.label)}
                  disabled={isAdjusting}
                  className="chip-clay"
                  style={{
                    padding: "6px 12px", borderRadius: 20, fontSize: 13, fontWeight: 500,
                    cursor: isAdjusting ? "not-allowed" : "pointer",
                    opacity: isAdjusting ? 0.35 : 1,
                    transition: "all 0.2s",
                    fontFamily: "var(--font-outfit), system-ui, sans-serif",
                  }}
                >
                  <span style={{ marginRight: 4 }}>{adj.icon}</span>
                  {adj.label}
                </button>
              ))}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
              <div style={{
                flex: 1, display: "flex", alignItems: "center", padding: "0 16px",
                height: 44, borderRadius: 12, background: "#FFFDF9",
                border: "1.5px solid rgba(160,140,110,0.2)",
                transition: "all 0.2s",
              }}>
                <input
                  type="text"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="告诉 AI 你的调整需求..."
                  disabled={isAdjusting}
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none",
                    fontSize: 14, color: "#1C1915",
                    fontFamily: "var(--font-outfit), system-ui, sans-serif",
                    opacity: isAdjusting ? 0.4 : 1,
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={!instruction.trim() || isAdjusting}
                className="btn-primary"
                style={{
                  height: 44, padding: "0 20px", borderRadius: 12,
                  fontSize: 14, fontWeight: 600, cursor: "pointer", flexShrink: 0,
                  fontFamily: "var(--font-outfit), system-ui, sans-serif",
                }}
              >
                {isAdjusting ? "调整中..." : "调整菜谱"}
              </button>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
