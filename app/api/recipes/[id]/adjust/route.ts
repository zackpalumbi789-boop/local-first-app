import type { NextRequest } from "next/server";
import {
  getRecipe,
  getStepsByRecipe,
  clearStepsByRecipe,
  createStep,
  updateRecipe,
} from "@/lib/store";
import { applyAdjustment } from "@/lib/recipe-generator";
import type { StreamEvent } from "@/lib/types";

/**
 * @swagger
 * /api/recipes/{id}/adjust:
 *   post:
 *     summary: 按指令调整已有菜谱步骤（SSE）
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 菜谱 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [instruction]
 *             properties:
 *               instruction:
 *                 type: string
 *                 description: 自然语言调整说明
 *     responses:
 *       200:
 *         description: SSE 流（步骤与配图进度）
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       400:
 *         description: 缺少 instruction
 *       404:
 *         description: 菜谱不存在
 */

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { instruction } = await request.json();

  if (!instruction || typeof instruction !== "string") {
    return Response.json({ error: "缺少调整指令" }, { status: 400 });
  }

  const recipe = await getRecipe(id);
  if (!recipe) {
    return Response.json({ error: "菜谱不存在" }, { status: 404 });
  }

  const existingSteps = await getStepsByRecipe(id);
  const rawSteps = existingSteps.map((s) => ({
    description: s.description,
    ingredients: s.ingredients,
    duration: s.duration,
  }));

  await clearStepsByRecipe(id);
  await updateRecipe(id, { status: "GENERATING" });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { steps: adjustedSteps, summary_suffix } =
          await applyAdjustment(recipe.title, rawSteps, instruction);

        const newSummary = recipe.summary.replace(/（已根据.*/, "") + summary_suffix;

        const metaEvent: StreamEvent = {
          type: "meta",
          data: {
            recipe_id: id,
            title: recipe.title,
            summary: newSummary,
            source_links: recipe.source_links,
            total_steps: adjustedSteps.length,
            is_adjustment: true,
          },
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(metaEvent)}\n\n`)
        );

        for (let i = 0; i < adjustedSteps.length; i++) {
          const rawStep = adjustedSteps[i];
          const step = await createStep(
            id,
            i + 1,
            rawStep.description,
            rawStep.ingredients,
            rawStep.duration
          );

          const completeEvent: StreamEvent = {
            type: "step",
            data: {
              step_id: step.id,
              step_order: i + 1,
              text_chunk: "",
              is_complete: true,
              description: rawStep.description,
              ingredients: rawStep.ingredients,
              duration: rawStep.duration,
              image_status: "PENDING",
              image_url: null,
            },
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(completeEvent)}\n\n`)
          );
        }

        await updateRecipe(id, {
          status: "COMPLETED",
          summary: newSummary,
        });

        const doneEvent: StreamEvent = {
          type: "done",
          data: { recipe_id: id },
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`)
        );
      } catch (err) {
        console.error("Recipe adjustment error:", err);
        await updateRecipe(id, { status: "FAILED" });
        const errEvent: StreamEvent = {
          type: "error",
          data: { message: "调整过程中发生错误" },
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(errEvent)}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
