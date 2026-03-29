export type RecipeStatus = "GENERATING" | "COMPLETED" | "FAILED";
export type ImageStatus = "PENDING" | "GENERATING" | "SUCCESS" | "FAILED";

export interface Recipe {
  id: string;
  user_id: string;
  original_query: string;
  title: string;
  summary: string;
  source_links: string[];
  status: RecipeStatus;
  created_at: string;
}

export interface RecipeStep {
  id: string;
  recipe_id: string;
  step_order: number;
  description: string;
  ingredients: Ingredient[];
  duration: number;
  image_url: string | null;
  image_status: ImageStatus;
}

export interface Ingredient {
  name: string;
  amount: string;
  substitute?: string;
}

export interface RecipeKnowledge {
  id: string;
  content: string;
  embedding: number[];
}

export interface GenerateRequest {
  query: string;
  user_id?: string;
}

export interface AdjustRequest {
  instruction: string;
}

export interface ImageCallbackPayload {
  step_id: string;
  image_url: string;
  success: boolean;
}

export interface StreamEvent {
  type: "meta" | "step" | "done" | "error";
  data: Record<string, unknown>;
}

export interface ImageStatusResponse {
  steps: {
    id: string;
    step_order: number;
    image_status: ImageStatus;
    image_url: string | null;
  }[];
}
