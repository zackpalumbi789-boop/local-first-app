import { updateStepImage, getStep } from "@/lib/store";
import type { ImageCallbackPayload } from "@/lib/types";

/**
 * @swagger
 * /api/webhooks/image-callback:
 *   post:
 *     summary: 异步配图完成回调
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [step_id]
 *             properties:
 *               step_id:
 *                 type: string
 *               image_url:
 *                 type: string
 *               success:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 已处理
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *       400:
 *         description: 参数或 JSON 无效
 *       404:
 *         description: 步骤不存在
 */

export async function POST(request: Request) {
  try {
    const payload: ImageCallbackPayload = await request.json();
    const { step_id, image_url, success } = payload;

    if (!step_id) {
      return Response.json({ error: "缺少 step_id" }, { status: 400 });
    }

    const step = await getStep(step_id);
    if (!step) {
      return Response.json({ error: "步骤不存在" }, { status: 404 });
    }

    if (success && image_url) {
      await updateStepImage(step_id, image_url, "SUCCESS");
    } else {
      await updateStepImage(step_id, null, "FAILED");
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }
}
