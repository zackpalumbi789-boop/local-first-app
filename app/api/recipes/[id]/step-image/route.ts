import type { NextRequest } from "next/server";
import { getRecipe, getStep, getStepsByRecipe } from "@/lib/store";
import { generateStepImageAndSave } from "@/lib/step-image-job";

/**
 * 单步配图。由前端在 SSE 结束后并发调用，使每次请求耗时落在网关单请求超时内。
 */

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const raw = (await params).id?.trim() ?? "";
  if (!UUID_RE.test(raw)) {
    return Response.json({ error: "无效的菜谱 id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求体无效" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const stepId = typeof o.step_id === "string" ? o.step_id.trim() : "";
  const prompt = typeof o.prompt === "string" ? o.prompt : "";

  if (!UUID_RE.test(stepId)) {
    return Response.json({ error: "无效的 step_id" }, { status: 400 });
  }

  const recipe = await getRecipe(raw);
  if (!recipe) {
    return Response.json({ error: "菜谱不存在" }, { status: 404 });
  }

  const step = await getStep(stepId);
  if (!step || step.recipe_id !== raw) {
    return Response.json({ error: "步骤不存在" }, { status: 404 });
  }

  const allSteps = await getStepsByRecipe(raw);
  const result = await generateStepImageAndSave(
    step.id,
    recipe.title,
    step.description,
    step.step_order,
    allSteps.length,
    prompt || undefined
  );

  return Response.json({
    image_status: result.image_status,
    image_url: result.image_url,
  });
}
