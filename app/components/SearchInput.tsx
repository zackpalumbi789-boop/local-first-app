"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

const SUGGESTIONS = [
  "红烧肉", "番茄炒蛋", "宫保鸡丁", "提拉米苏", "麻婆豆腐", "抹茶蛋糕",
];

interface SearchInputProps {
  onSubmit: (query: string) => void;
  isGenerating: boolean;
}

export default function SearchInput({ onSubmit, isGenerating }: SearchInputProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = (val?: string) => {
    const v = (val ?? query).trim();
    if (v && !isGenerating) onSubmit(v);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.12 }}
      style={{ maxWidth: 560, margin: "0 auto" }}
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div style={{
          display: "flex", alignItems: "center", height: 54, borderRadius: 16,
          background: "#FFFDF9",
          border: focused ? "2px solid #B8432E" : "2px solid rgba(160,140,110,0.2)",
          boxShadow: focused
            ? "0 0 0 4px rgba(184,67,46,0.1), 0 4px 16px rgba(100,80,50,0.06)"
            : "0 2px 8px rgba(100,80,50,0.04)",
          transition: "all 0.25s ease",
        }}>
          {/* icon */}
          <div style={{ paddingLeft: 18, paddingRight: 4, display: "flex", alignItems: "center" }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={focused ? "#B8432E" : "#9E9486"} strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="输入菜名，比如「红烧肉」「蛋糕」「拿铁」..."
            disabled={isGenerating}
            style={{
              flex: 1, height: "100%", background: "transparent", border: "none",
              outline: "none", fontSize: 15, color: "#1C1915",
              fontFamily: "var(--font-outfit), system-ui, sans-serif",
              opacity: isGenerating ? 0.4 : 1,
            }}
          />
          <button
            type="submit"
            disabled={!query.trim() || isGenerating}
            className="btn-primary"
            style={{
              marginRight: 6, height: 40, padding: "0 20px", borderRadius: 12,
              fontSize: 14, fontWeight: 600, cursor: "pointer",
              fontFamily: "var(--font-outfit), system-ui, sans-serif",
            }}
          >
            {isGenerating ? (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite" }}>
                  <circle opacity={0.25} cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                  <path opacity={0.75} fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                生成中
              </span>
            ) : "生成菜谱"}
          </button>
        </div>
      </form>

      {/* Suggestion chips */}
      {!isGenerating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{ marginTop: 16, display: "flex", flexWrap: "wrap" as const, gap: 8, justifyContent: "center", alignItems: "center" }}
        >
          <span style={{ fontSize: 13, color: "#9E9486" }}>试试</span>
          {SUGGESTIONS.map((s, i) => (
            <motion.button
              key={s}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 + i * 0.05 }}
              onClick={() => { setQuery(s); submit(s); }}
              className="chip-clay"
              style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 13,
                fontWeight: 500, cursor: "pointer", transition: "all 0.2s",
                fontFamily: "var(--font-outfit), system-ui, sans-serif",
              }}
            >
              {s}
            </motion.button>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
