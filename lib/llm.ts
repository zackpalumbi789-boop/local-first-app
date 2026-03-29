import type { Ingredient } from "./types";

export interface LLMRecipeStep {
  description: string;
  ingredients: Ingredient[];
  duration: number;
}

export interface LLMRecipeResult {
  title: string;
  summary: string;
  steps: LLMRecipeStep[];
}

const SYSTEM_PROMPT = `你是一个专业的菜谱 AI 助手。用户会输入一道菜名或食物名称，你需要生成详细、专业、可操作的菜谱。

要求：
1. 根据菜品类型（中餐/西点/烘焙/饮品/甜品等）给出对应的制作方法，不要一律当作炒菜处理
2. 步骤要具体可执行，包含火候、时间、手法等细节
3. 每个步骤列出该步骤需要的食材和用量
4. 如果某个食材有常见替代品，提供 substitute 字段
5. 步骤数量 4-8 个为佳

你必须严格只返回 JSON，不要有其他任何文字、解释或 markdown 标记：
{"title":"菜谱名称","summary":"一句话介绍","steps":[{"description":"详细步骤描述50-100字","ingredients":[{"name":"食材名","amount":"用量","substitute":"可选替代品"}],"duration":预估秒数}]}`;

function getApiConfig() {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl =
    process.env.LLM_BASE_URL ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const model = process.env.LLM_MODEL || "qwen-plus";

  return { apiKey, baseUrl, model };
}

export function isLLMConfigured(): boolean {
  const key = process.env.LLM_API_KEY;
  const configured = !!key && key.length > 5;
  console.log(
    `[LLM] isConfigured=${configured}, key=${key ? key.slice(0, 8) + "..." : "empty"}`
  );
  return configured;
}

function extractJSON(text: string): string | null {
  // 1. Try to find ```json ... ``` block first (qwen often wraps in markdown)
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // 2. Find the outermost { ... } block
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

export async function generateRecipeWithLLM(
  query: string
): Promise<LLMRecipeResult | null> {
  const { apiKey, baseUrl, model } = getApiConfig();
  if (!apiKey) return null;

  console.log(`[LLM] Calling ${baseUrl} with model=${model} for query="${query}"`);

  try {
    const url = `${baseUrl}/chat/completions`;
    console.log(`[LLM] POST ${url}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `请为「${query}」生成菜谱` },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    console.log(`[LLM] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[LLM] API error ${response.status}: ${errorText}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("[LLM] No content in response:", JSON.stringify(data).slice(0, 500));
      return null;
    }

    console.log(`[LLM] Raw response (first 300 chars): ${content.slice(0, 300)}`);

    const jsonStr = extractJSON(content);
    if (!jsonStr) {
      console.error("[LLM] Could not extract JSON from:", content.slice(0, 500));
      return null;
    }

    const parsed = JSON.parse(jsonStr) as LLMRecipeResult;

    if (!parsed.title || !parsed.steps || !Array.isArray(parsed.steps)) {
      console.error("[LLM] Invalid structure:", JSON.stringify(parsed).slice(0, 300));
      return null;
    }

    parsed.steps = parsed.steps.map((s) => ({
      description: s.description || "",
      ingredients: Array.isArray(s.ingredients) ? s.ingredients : [],
      duration: typeof s.duration === "number" ? s.duration : 120,
    }));

    console.log(
      `[LLM] Success: "${parsed.title}" with ${parsed.steps.length} steps`
    );
    return parsed;
  } catch (err) {
    console.error("[LLM] Exception:", err);
    return null;
  }
}

export async function adjustRecipeWithLLM(
  currentRecipe: LLMRecipeResult,
  instruction: string
): Promise<LLMRecipeResult | null> {
  const { apiKey, baseUrl, model } = getApiConfig();
  if (!apiKey) return null;

  console.log(`[LLM] Adjusting recipe "${currentRecipe.title}" with: "${instruction}"`);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `当前菜谱如下：\n${JSON.stringify(currentRecipe)}\n\n请根据以下要求调整菜谱：「${instruction}」\n\n只返回调整后的完整菜谱 JSON，不要有任何其他文字。`,
          },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    console.log(`[LLM adjust] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[LLM adjust] API error ${response.status}: ${errorText}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    console.log(`[LLM adjust] Raw (first 300): ${content.slice(0, 300)}`);

    const jsonStr = extractJSON(content);
    if (!jsonStr) return null;

    const parsed = JSON.parse(jsonStr) as LLMRecipeResult;
    if (!parsed.title || !parsed.steps) return null;

    parsed.steps = parsed.steps.map((s) => ({
      description: s.description || "",
      ingredients: Array.isArray(s.ingredients) ? s.ingredients : [],
      duration: typeof s.duration === "number" ? s.duration : 120,
    }));

    console.log(`[LLM adjust] Success: ${parsed.steps.length} steps`);
    return parsed;
  } catch (err) {
    console.error("[LLM adjust] Exception:", err);
    return null;
  }
}
