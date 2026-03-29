import type { NextRequest } from "next/server";
import { getRecipe, getStepsByRecipe } from "@/lib/store";
import { generateImagePrompts, isImageGenConfigured } from "@/lib/image-gen";

/**
 * 单独请求生成各步文生图提示词。与 SSE 主流程拆开，避免 EdgeOne 等网关在
 * 「单条长连接」上 context deadline exceeded。
 */

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const raw = (await params).id?.trim() ?? "";
  if (!UUID_RE.test(raw)) {
    return Response.json({ error: "无效的菜谱 id" }, { status: 400 });
  }

  if (!isImageGenConfigured()) {
    return Response.json({ configured: false, prompts: [] as string[] });
  }

  const recipe = await getRecipe(raw);
  if (!recipe) {
    return Response.json({ error: "菜谱不存在" }, { status: 404 });
  }

  const steps = await getStepsByRecipe(raw);
  if (steps.length === 0) {
    return Response.json({ error: "无步骤" }, { status: 400 });
  }

  const prompts = await generateImagePrompts(
    recipe.title,
    steps.map((s) => s.description)
  );

  return Response.json({
    configured: true,
    prompts: prompts ?? [],
  });
}
