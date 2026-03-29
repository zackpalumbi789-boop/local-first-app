import {
  generateFoodImage,
  isImageGenConfigured,
} from "@/lib/image-gen";
import { updateStepImage } from "@/lib/store";
import type { ImageStatus } from "@/lib/types";

export type StepImageResult = {
  image_status: ImageStatus;
  image_url: string | null;
};

/**
 * 同步等待文生图并写库。用于 SSE 流程内，避免 serverless 在响应结束后杀掉未 await 的后台 Promise
 * （EdgeOne / Vercel 等上「全部配图失败」常见原因）。
 */
export async function generateStepImageAndSave(
  stepId: string,
  dishName: string,
  stepDescription: string,
  stepOrder: number,
  totalSteps: number,
  customPrompt?: string
): Promise<StepImageResult> {
  if (!isImageGenConfigured()) {
    await updateStepImage(stepId, null, "FAILED");
    return { image_status: "FAILED", image_url: null };
  }

  await updateStepImage(stepId, null, "GENERATING");
  try {
    const url = await generateFoodImage(
      dishName,
      stepDescription,
      stepOrder,
      customPrompt,
      totalSteps
    );
    if (url) {
      await updateStepImage(stepId, url, "SUCCESS");
      return { image_status: "SUCCESS", image_url: url };
    }
    await updateStepImage(stepId, null, "FAILED");
    return { image_status: "FAILED", image_url: null };
  } catch (err) {
    console.error("[ImageGen] Uncaught error:", err);
    await updateStepImage(stepId, null, "FAILED");
    return { image_status: "FAILED", image_url: null };
  }
}
