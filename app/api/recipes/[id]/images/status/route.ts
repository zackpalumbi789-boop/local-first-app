import type { NextRequest } from "next/server";
import { getRecipe, getStepsByRecipe } from "@/lib/store";
import type { ImageStatusResponse } from "@/lib/types";

/**
 * @swagger
 * /api/recipes/{id}/images/status:
 *   get:
 *     summary: 查询菜谱各步骤配图状态
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 各步骤 image_status / image_url
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 steps:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       step_order:
 *                         type: integer
 *                       image_status:
 *                         type: string
 *                       image_url:
 *                         type: string
 *                         nullable: true
 *       404:
 *         description: 菜谱不存在
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const recipe = await getRecipe(id);
  if (!recipe) {
    return Response.json({ error: "菜谱不存在" }, { status: 404 });
  }

  const steps = await getStepsByRecipe(id);
  const response: ImageStatusResponse = {
    steps: steps.map((s) => ({
      id: s.id,
      step_order: s.step_order,
      image_status: s.image_status,
      image_url: s.image_url,
    })),
  };

  return Response.json(response);
}
