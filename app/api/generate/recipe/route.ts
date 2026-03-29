import {
  createRecipe,
  createStep,
  updateRecipe,
} from "@/lib/store";
import { findRecipe, isRecipeQuery } from "@/lib/recipe-generator";
import type { StreamEvent } from "@/lib/types";

/**
 * @swagger
 * /api/generate/recipe:
 *   post:
 *     summary: 根据自然语言生成菜谱（SSE）
 *     description: |
 *       成功时返回 `text/event-stream`，事件为 JSON 的 StreamEvent。
 *       校验失败时也可能返回 SSE error 事件。
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query:
 *                 type: string
 *                 description: 用户描述的菜谱需求
 *               user_id:
 *                 type: string
 *                 description: 可选，用户标识
 *     responses:
 *       200:
 *         description: SSE 流
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       400:
 *         description: 缺少 query
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { query, user_id } = await request.json();

  if (!query || typeof query !== "string") {
    return Response.json({ error: "缺少 query 参数" }, { status: 400 });
  }

  if (!isRecipeQuery(query)) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const event: StreamEvent = {
          type: "error",
          data: {
            message:
              "看起来您输入的不是菜谱相关内容哦~ 试试输入一道菜名，比如「红烧肉」「蛋糕」「抹茶拿铁」？",
          },
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
        controller.close();
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

  const recipe = await createRecipe(query, user_id ?? "anonymous");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const generated = await findRecipe(query);

        await updateRecipe(recipe.id, {
          title: generated.title,
          summary: generated.summary,
          source_links: generated.source_links,
        });

        const metaEvent: StreamEvent = {
          type: "meta",
          data: {
            recipe_id: recipe.id,
            title: generated.title,
            summary: generated.summary,
            source_links: generated.source_links,
            total_steps: generated.steps.length,
          },
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(metaEvent)}\n\n`)
        );

        for (let i = 0; i < generated.steps.length; i++) {
          const rawStep = generated.steps[i];
          const step = await createStep(
            recipe.id,
            i + 1,
            rawStep.description,
            rawStep.ingredients,
            rawStep.duration
          );

          // 不在此连接上做「逐字打字」延迟：EdgeOne 等网关在单条 SSE 上有总时长上限，
          // 过长会 context deadline exceeded，客户端只能收到 meta、收不到 step。
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

        await updateRecipe(recipe.id, { status: "COMPLETED" });

        const doneEvent: StreamEvent = {
          type: "done",
          data: { recipe_id: recipe.id },
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`)
        );
      } catch (err) {
        console.error("Recipe generation error:", err);
        await updateRecipe(recipe.id, { status: "FAILED" });
        const errEvent: StreamEvent = {
          type: "error",
          data: { message: "生成过程中发生错误，请稍后重试" },
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
