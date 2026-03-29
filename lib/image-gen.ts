const TEXT2IMAGE_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis";
const TASK_URL = "https://dashscope.aliyuncs.com/api/v1/tasks";

/** Phase 1: structured understanding before any image prompt. */
const STEP_ANALYSIS_SYSTEM = `你是烹饪工序与食材状态分析专家。根据菜谱原文每一步的描述，推理「该步进行到此刻」画面中每种主要食材应有的状态，供后续文生图严格遵循。

铁律：
- 严格按步骤顺序与文字推理，禁止凭菜名联想最终成品（如「红烧肉」第1步绝不能是全熟红烧形态）。
- 前段步骤只能是生鲜、清洗、切配、腌制、冷水浸泡等；熟度必须从「未加热」或「刚开始受热」写起。
- 中段步骤写锅内/烤箱中进行中：断生、半熟、上色中、汤汁未收浓等，不得写成已精致装盘。
- 仅当该步原文明确装盘、出锅、盛碗、点缀上桌等，才允许该步相关食材为「成品呈现」类描述。
- 每种食材要拆到「这一刻」实际在画面里会出现的样子；未在该步出现的食材不要列入。

对每个步骤输出：
- step_index：步骤序号（从1开始）
- step_scene_one_liner：本步视觉场景一句话（25字内），如「砧板上切配生肉」「铁锅中翻炒上色中」
- ingredients：本步画面中主要食材列表，每项含：
  - name：食材名称
  - doneness：生熟程度（如：生鲜未烹、腌制静置中、冷水下锅未沸、表面断生、半熟、七八分熟、全熟软烂、收汁浓稠等，须与步骤时刻一致）
  - cut_shape：形态与尺度（如：整颗、对半开、滚刀块约2cm、细丝、薄片透明、剁成末、保持整块未切等）
  - surface_visual：可见外观（色泽、油光、水汽、焦边、挂浆与否等，简短）
  - in_container：所在容器/空间（砧板、陶瓷碗、炒锅、汤锅、砂锅、烤盘、成品深盘等）

只返回一个 JSON 对象，格式如下（不要 markdown）：
{"steps":[{"step_index":1,"step_scene_one_liner":"...","ingredients":[{"name":"...","doneness":"...","cut_shape":"...","surface_visual":"...","in_container":"..."}]}]}
steps 数组长度必须等于用户给出的步骤总数，step_index 必须依次为 1..N。`;

/** Phase 2: image prompts must follow phase-1 analysis verbatim on doneness/shape. */
const IMAGE_PROMPT_FROM_ANALYSIS_SYSTEM = `你是美食摄影提示词专家。你会收到一份已由前序分析完成的「每步食材状态 JSON」和菜谱原文步骤。你的任务：为每一步写一条中文 AI 绘画提示词。

必须遵守：
- **熟度、切配形态、所在容器**必须与 JSON 中该步的 ingredients 及 step_scene_one_liner 一致，禁止擅自把生鲜画成全熟、禁止把砧板备料画成成品大盘。
- 提示词里要写出关键视觉：容器类型、主要食材的切割尺度、生熟与色泽（可引用 analysis 中的用词）。
- 45~80 字，纯视觉描述，不写具体温度火候数字。
- 若某步 ingredients 为空，则根据 step_scene_one_liner + 该步原文写画面，仍禁止跳级成品。

只返回 JSON：{"prompts":["第1步提示词","第2步提示词",...]}，prompts 长度必须等于步骤总数。不要其他文字。`;

/** Legacy single-shot prompt generation if phase-1 fails. */
const IMAGE_PROMPT_SYSTEM = `你是美食摄影提示词专家。给你一道菜的烹饪步骤，为每个步骤生成一段AI绘画提示词。

【工序进度与食材状态 — 必须严格遵守，否则视为错误】
- 每一步的画面必须对应该步文字所描述的「这一刻」：生鲜、腌制中、冷水下锅、翻炒半熟、汤汁未收浓、尚在锅内等；不得跳到最后成品形态。
- 前面步骤若是洗切腌拌备料，必须写生食或初加工状态（生肉生粉、蔬菜原色、砧板碗盆），禁止出现金黄酥烂、浓油赤酱成品、精致餐厅装盘。
- 中间步骤若是炒炖煮蒸，必须写锅内/灶上制作中的样子（可半熟、上色中、冒泡未收干），禁止默认画「已装盘的大菜特写」。
- 只有步骤原文明确写到装盘、出锅、盛入碗中、点缀上桌、淋汁完成等收尾动作时，该步提示词才可描述成品或近成品呈现；否则一律按「进行中」处理。
- 不要用菜名联想成品：即使用户做的是「红烧肉」，第1步也绝不能画一碗红烧肉成品。
- 提示词里可点明熟度词：生鲜、半透明、边缘微焦、七八分熟、汤汁清亮未稠等，帮助模型锁定状态。

画面与格式：
1. 描述该步骤【具体可见画面】：食材外观、颜色、质感、熟成状态、厨具容器与环境
2. 各步之间画面差异明显（备料≠锅中≠装盘）
3. 40~70字中文，只写视觉描述，不写火候数字温度
4. 返回JSON：{"prompts":["步骤1提示词","步骤2提示词",...]}
只返回JSON，不要其他文字。`;

type StepIngredientAnalysis = {
  name: string;
  doneness: string;
  cut_shape: string;
  surface_visual: string;
  in_container: string;
};

type StepAnalysisRecord = {
  step_index: number;
  step_scene_one_liner?: string;
  ingredients: StepIngredientAnalysis[];
};

type RecipeStepsAnalysis = {
  steps: StepAnalysisRecord[];
};

function normalizeAnalysis(
  raw: unknown,
  n: number
): RecipeStepsAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const arr = (raw as { steps?: unknown }).steps;
  if (!Array.isArray(arr) || arr.length !== n) return null;

  const sorted = [...arr].sort(
    (a, b) =>
      Number((a as StepAnalysisRecord).step_index ?? 0) -
      Number((b as StepAnalysisRecord).step_index ?? 0)
  );

  const steps: StepAnalysisRecord[] = [];
  for (let i = 0; i < n; i++) {
    const s = sorted[i] as Record<string, unknown>;
    if (!s || typeof s !== "object") return null;
    const ingRaw = s.ingredients;
    const ingredients: StepIngredientAnalysis[] = Array.isArray(ingRaw)
      ? ingRaw
          .filter((x) => x && typeof x === "object")
          .map((x) => {
            const o = x as Record<string, unknown>;
            return {
              name: String(o.name ?? ""),
              doneness: String(o.doneness ?? ""),
              cut_shape: String(o.cut_shape ?? ""),
              surface_visual: String(o.surface_visual ?? ""),
              in_container: String(o.in_container ?? ""),
            };
          })
      : [];
    steps.push({
      step_index:
        typeof s.step_index === "number" ? s.step_index : i + 1,
      step_scene_one_liner:
        typeof s.step_scene_one_liner === "string"
          ? s.step_scene_one_liner
          : undefined,
      ingredients,
    });
  }
  return { steps };
}

async function llmChatJson(params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  system: string;
  user: string;
  max_tokens: number;
  temperature: number;
  logLabel: string;
}): Promise<unknown | null> {
  try {
    const res = await fetch(`${params.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model,
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
        temperature: params.temperature,
        max_tokens: params.max_tokens,
      }),
    });

    if (!res.ok) {
      console.error(
        `[${params.logLabel}] LLM HTTP ${res.status}`
      );
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    console.log(
      `[${params.logLabel}] Raw (truncated): ${content.substring(0, 220)}`
    );

    const jsonStr = extractJSON(content);
    if (!jsonStr) {
      console.error(`[${params.logLabel}] No JSON in response`);
      return null;
    }
    return JSON.parse(jsonStr) as unknown;
  } catch (err) {
    console.error(`[${params.logLabel}] Error:`, err);
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiKey(): string {
  return (process.env.LLM_API_KEY ?? "").trim();
}

export function isImageGenConfigured(): boolean {
  const key = getApiKey();
  return key.length > 0 && key !== "your-api-key-here";
}

/**
 * 两阶段：分析 JSON + 写提示词。仅当 `IMAGE_PROMPTS_TWO_PHASE=true` 时作为主路径尝试；
 * 失败或未启用时退回单次 legacy（默认），避免 EdgeOne 等网关单请求超时（504）。
 */
async function generateImagePromptsTwoPhase(
  dishName: string,
  apiKey: string,
  baseUrl: string,
  model: string,
  n: number,
  stepList: string
): Promise<string[] | null> {
  console.log(
    `[ImagePrompt] Phase 1 — step/ingredient analysis for "${dishName}" (${n} steps)`
  );

  const analysisUserMsg = `菜名：${dishName}
本菜谱共 ${n} 步。请为每一步输出 step_index、step_scene_one_liner、ingredients（逐项填写 doneness / cut_shape / surface_visual / in_container）。

${stepList}`;

  const analysisRaw = await llmChatJson({
    apiKey,
    baseUrl,
    model,
    system: STEP_ANALYSIS_SYSTEM,
    user: analysisUserMsg,
    max_tokens: 4000,
    temperature: 0.35,
    logLabel: "ImagePrompt/Analysis",
  });

  const analysis = normalizeAnalysis(analysisRaw, n);

  if (!analysis) {
    console.warn(
      "[ImagePrompt] Phase 1 failed or invalid shape, will try legacy single-shot"
    );
    return null;
  }

  console.log(
    `[ImagePrompt] Phase 1 OK — ${analysis.steps.length} steps analyzed`
  );
  analysis.steps.forEach((s, i) => {
    const ing = s.ingredients
      .map(
        (x) =>
          `${x.name}[${x.doneness}|${x.cut_shape}|${x.in_container}]`
      )
      .join("; ");
    console.log(
      `  Step ${i + 1}: ${s.step_scene_one_liner ?? ""} | ${ing || "(无分项)"}`
    );
  });

  const phase2UserMsg = `菜名：${dishName}
共 ${n} 步。以下为「工序与食材状态分析」JSON，必须严格据此写绘画提示词（不可提高熟度、不可更换容器为成品盘除非分析如此）。

【分析 JSON】
${JSON.stringify(analysis)}

【原文步骤】（核对用，与分析冲突时以分析为准）
${stepList}`;

  const promptRaw = await llmChatJson({
    apiKey,
    baseUrl,
    model,
    system: IMAGE_PROMPT_FROM_ANALYSIS_SYSTEM,
    user: phase2UserMsg,
    max_tokens: 1600,
    temperature: 0.55,
    logLabel: "ImagePrompt/PromptsFromAnalysis",
  });

  const promptParsed = promptRaw as { prompts?: string[] } | null;
  const prompts = Array.isArray(promptParsed?.prompts)
    ? promptParsed.prompts
    : [];

  if (prompts.length === n) {
    console.log("[ImagePrompt] Phase 2 OK — prompts:");
    prompts.forEach((p, i) => console.log(`  Step ${i + 1}: ${p}`));
    return prompts;
  }

  console.warn(
    `[ImagePrompt] Phase 2 length mismatch (${prompts.length} vs ${n}), will try legacy single-shot`
  );
  return null;
}

export async function generateImagePrompts(
  dishName: string,
  stepDescriptions: string[]
): Promise<string[] | null> {
  const apiKey = getApiKey();
  const baseUrl = (
    process.env.LLM_BASE_URL ??
    "https://dashscope.aliyuncs.com/compatible-mode/v1"
  ).trim();
  const model = process.env.LLM_MODEL ?? "qwen-plus";

  if (!apiKey || apiKey === "your-api-key-here") return null;

  const n = stepDescriptions.length;
  if (n === 0) return null;

  const stepList = stepDescriptions
    .map((d, i) => `步骤${i + 1}/${n}: ${d}`)
    .join("\n");

  const useTwoPhase = process.env.IMAGE_PROMPTS_TWO_PHASE === "true";

  if (!useTwoPhase) {
    console.log(
      `[ImagePrompt] Single-shot mode (default; set IMAGE_PROMPTS_TWO_PHASE=true for two-phase LLM)`
    );
    return generateImagePromptsLegacy(
      dishName,
      stepDescriptions,
      apiKey,
      baseUrl,
      model,
      n,
      stepList
    );
  }

  const fromTwoPhase = await generateImagePromptsTwoPhase(
    dishName,
    apiKey,
    baseUrl,
    model,
    n,
    stepList
  );
  if (fromTwoPhase) return fromTwoPhase;

  return generateImagePromptsLegacy(
    dishName,
    stepDescriptions,
    apiKey,
    baseUrl,
    model,
    n,
    stepList
  );
}

async function generateImagePromptsLegacy(
  dishName: string,
  stepDescriptions: string[],
  apiKey: string,
  baseUrl: string,
  model: string,
  n: number,
  stepList: string
): Promise<string[] | null> {
  const stageReminder =
    n <= 1
      ? "仅一步时也要严格按该步文字写当前工序与食材状态，不要无依据画成品大餐。"
      : `第 1 步到第 ${n - 1} 步（除非该步原文已写装盘/出锅）一律写「工序进行中」：生鲜、备料或锅内半熟等；禁止中间步画成品装盘。仅当某步原文明确装盘/出锅/上桌时，该步才可画完成品。`;

  const userMsg = `菜名：${dishName}
本菜谱共 ${n} 步。请输出恰好 ${n} 条提示词，与步骤顺序一一对应。
${stageReminder}

${stepList}`;

  console.log(`[ImagePrompt/Legacy] Single-shot prompts for "${dishName}"`);

  const parsed = await llmChatJson({
    apiKey,
    baseUrl,
    model,
    system: IMAGE_PROMPT_SYSTEM,
    user: userMsg,
    max_tokens: 1200,
    temperature: 0.65,
    logLabel: "ImagePrompt/Legacy",
  });

  const prompts: string[] =
    parsed && typeof parsed === "object" && Array.isArray((parsed as { prompts?: unknown }).prompts)
      ? ((parsed as { prompts: string[] }).prompts)
      : [];

  if (prompts.length !== stepDescriptions.length) {
    console.warn(
      `[ImagePrompt/Legacy] Got ${prompts.length} prompts for ${stepDescriptions.length} steps`
    );
  }

  if (prompts.length > 0) {
    prompts.forEach((p, i) => console.log(`  Step ${i + 1}: ${p}`));
    return prompts;
  }
  return null;
}

function extractJSON(text: string): string | null {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Minimal Chinese tail for T2I — same semantics as before but no 「第3/5步」metadata
 * (avoids template-like text in the image and in logs).
 */
function cookingStageSuffixForImage(
  stepOrder: number,
  totalSteps: number,
  stepDescription: string
): string {
  const looksLikePlating =
    /装盘|出锅|盛入|盛出|摆盘|点缀|上桌|淋在|撒在|装入碗|装盘即可|出锅装|盛出装盘/.test(
      stepDescription
    );
  const isOnlyStep = totalSteps <= 1;

  if (isOnlyStep) {
    return looksLikePlating ? "，按步骤呈现" : "，工序进行中勿画成品装盘";
  }

  if (stepOrder >= totalSteps && looksLikePlating) {
    return "，可表现装盘成品";
  }

  const progress = (stepOrder - 1) / Math.max(totalSteps - 1, 1);
  if (progress <= 0.33) {
    return "，生鲜备料勿成品装盘";
  }
  if (progress <= 0.66) {
    return "，锅内制作中勿成品大盘";
  }
  return "，灶上过程勿餐厅成品特写";
}

/**
 * Call DashScope wanx to generate a food image.
 * If customPrompt is provided, use it; otherwise build a generic one.
 */
export async function generateFoodImage(
  dishName: string,
  stepDescription: string,
  stepOrder: number,
  customPrompt?: string,
  totalSteps?: number
): Promise<string | null> {
  const apiKey = getApiKey();
  if (!apiKey || apiKey === "your-api-key-here") {
    console.log("[ImageGen] No API key configured");
    return null;
  }

  const model = (process.env.IMAGE_MODEL ?? "wanx2.1-t2i-turbo").trim();
  const n = totalSteps ?? stepOrder;
  const stage = cookingStageSuffixForImage(stepOrder, n, stepDescription);
  const longLlmPrompt = Boolean(customPrompt && customPrompt.length >= 100);
  const stageTail = longLlmPrompt ? "" : stage;
  const prompt = customPrompt
    ? `专业美食摄影，${dishName}，${customPrompt}，自然光线，高清细节，真实质感${stageTail}`
    : buildFallbackPrompt(dishName, stepDescription, stepOrder, n);

  console.log(
    `[ImageGen] Step ${stepOrder}: model=${model}, promptChars=${prompt.length}${longLlmPrompt ? " (LLM prompt long, stage tail omitted)" : ""}`
  );

  const result = await submitAndPoll(apiKey, model, prompt);

  if (result) return result;

  if (model !== "wanx-v1") {
    console.log("[ImageGen] Retrying with wanx-v1 fallback...");
    return await submitAndPoll(apiKey, "wanx-v1", prompt);
  }

  return null;
}

async function submitAndPoll(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string | null> {
  try {
    const submitRes = await fetch(TEXT2IMAGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model,
        input: { prompt },
        parameters: {
          size: "1024*1024",
          n: 1,
        },
      }),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      console.error(
        `[ImageGen] ${model} submit failed (${submitRes.status}):`,
        errText.substring(0, 300)
      );
      return null;
    }

    const submitData = await submitRes.json();
    const taskId = submitData.output?.task_id;
    if (!taskId) {
      console.error(
        "[ImageGen] No task_id in response:",
        JSON.stringify(submitData).substring(0, 200)
      );
      return null;
    }

    console.log(`[ImageGen] ${model} task submitted: ${taskId}`);
    return await pollTask(apiKey, taskId);
  } catch (error) {
    console.error(`[ImageGen] ${model} error:`, error);
    return null;
  }
}

async function pollTask(
  apiKey: string,
  taskId: string
): Promise<string | null> {
  const maxAttempts = 40;

  for (let i = 0; i < maxAttempts; i++) {
    await sleep(3000);

    try {
      const res = await fetch(`${TASK_URL}/${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!res.ok) {
        console.error(`[ImageGen] Poll HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const status = data.output?.task_status;

      if (status === "SUCCEEDED") {
        const url =
          data.output?.results?.[0]?.url ?? data.output?.results?.[0]?.b64_image;
        if (url) {
          console.log(`[ImageGen] Done: ${url.substring(0, 100)}...`);
          return url;
        }
        console.error("[ImageGen] SUCCEEDED but no URL found");
        return null;
      }

      if (status === "FAILED") {
        const msg =
          data.output?.message ??
          JSON.stringify(data.output).substring(0, 300);
        console.error(`[ImageGen] Task FAILED: ${msg}`);
        return null;
      }

      if (i % 5 === 0) {
        console.log(
          `[ImageGen] Polling ${taskId}: attempt ${i + 1}/${maxAttempts}, status=${status}`
        );
      }
    } catch (err) {
      console.error("[ImageGen] Poll error:", err);
    }
  }

  console.error("[ImageGen] Timeout (120s) for task", taskId);
  return null;
}

function buildFallbackPrompt(
  dishName: string,
  stepDescription: string,
  stepOrder: number,
  totalSteps: number
): string {
  const shortDesc = stepDescription
    .substring(0, 60)
    .replace(/[，。；！（）]/g, " ")
    .replace(/\d+[gml秒分钟度℃]/g, "")
    .trim();
  const stage = cookingStageSuffixForImage(stepOrder, totalSteps, stepDescription);
  return `专业美食摄影，${dishName}，${shortDesc}，自然光线，高清细节，真实质感${stage}`;
}
