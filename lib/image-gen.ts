const TEXT2IMAGE_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis";
const TASK_URL = "https://dashscope.aliyuncs.com/api/v1/tasks";

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
 * Use the LLM to generate visually-differentiated image prompts for all steps.
 * Returns an array of prompts (one per step), or null if LLM call fails.
 */
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
  const stepList = stepDescriptions
    .map((d, i) => `步骤${i + 1}/${n}: ${d}`)
    .join("\n");

  const stageReminder =
    n <= 1
      ? "仅一步时也要严格按该步文字写当前工序与食材状态，不要无依据画成品大餐。"
      : `第 1 步到第 ${n - 1} 步（除非该步原文已写装盘/出锅）一律写「工序进行中」：生鲜、备料或锅内半熟等；禁止中间步画成品装盘。仅当某步原文明确装盘/出锅/上桌时，该步才可画完成品。`;

  const userMsg = `菜名：${dishName}
本菜谱共 ${n} 步。请输出恰好 ${n} 条提示词，与步骤顺序一一对应。
${stageReminder}

${stepList}`;

  try {
    console.log(
      `[ImagePrompt] Generating visual prompts for "${dishName}" (${stepDescriptions.length} steps)`
    );
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: IMAGE_PROMPT_SYSTEM },
          { role: "user", content: userMsg },
        ],
        temperature: 0.7,
        max_tokens: 900,
      }),
    });

    if (!res.ok) {
      console.error(`[ImagePrompt] LLM failed (${res.status})`);
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    console.log(
      `[ImagePrompt] Raw response: ${content.substring(0, 200)}`
    );

    const jsonStr = extractJSON(content);
    if (!jsonStr) {
      console.error("[ImagePrompt] No JSON found in response");
      return null;
    }

    const parsed = JSON.parse(jsonStr);
    const prompts: string[] = parsed.prompts ?? [];

    if (prompts.length !== stepDescriptions.length) {
      console.warn(
        `[ImagePrompt] Got ${prompts.length} prompts for ${stepDescriptions.length} steps`
      );
    }

    console.log("[ImagePrompt] Generated prompts:");
    prompts.forEach((p, i) => console.log(`  Step ${i + 1}: ${p}`));

    return prompts.length > 0 ? prompts : null;
  } catch (err) {
    console.error("[ImagePrompt] Error:", err);
    return null;
  }
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
 * Short suffix for the image model: reinforces step position + don’t default to plated dish.
 */
function cookingStageSuffixForImage(
  stepOrder: number,
  totalSteps: number,
  stepDescription: string
): string {
  const desc = stepDescription;
  const looksLikePlating =
    /装盘|出锅|盛入|盛出|摆盘|点缀|上桌|淋在|撒在|装入碗|装盘即可|出锅装|盛出装盘/.test(
      desc
    );
  const isOnlyStep = totalSteps <= 1;

  if (isOnlyStep) {
    return looksLikePlating
      ? "，单步菜谱，按描述表现最终或当前状态即可"
      : "，单步菜谱，严格按描述表现当前工序与食材状态，避免无依据的成品大餐摆盘";
  }

  if (stepOrder >= totalSteps && looksLikePlating) {
    return `，第${stepOrder}/${totalSteps}步且为装盘/出锅类描述，可表现成品或近成品呈现`;
  }

  const progress = (stepOrder - 1) / Math.max(totalSteps - 1, 1);
  if (progress <= 0.33) {
    return `，烹饪第${stepOrder}/${totalSteps}步（偏前段），须为备料或初加工/生鲜未烹或刚处理状态，禁止成品装盘`;
  }
  if (progress <= 0.66) {
    return `，烹饪第${stepOrder}/${totalSteps}步（中段），须为锅内制作中、半熟或入味过程，禁止精致成品大盘`;
  }
  return `，烹饪第${stepOrder}/${totalSteps}步（后段），仍须贴合步骤文字；若未写装盘出锅则保持灶上/锅中状态，勿画餐厅成品特写`;
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
  const prompt = customPrompt
    ? `专业美食摄影，${dishName}，${customPrompt}，自然光线，高清细节，真实质感${stage}`
    : buildFallbackPrompt(dishName, stepDescription, stepOrder, n);

  console.log(
    `[ImageGen] Step ${stepOrder}: model=${model}, prompt="${prompt.substring(0, 100)}..."`
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
