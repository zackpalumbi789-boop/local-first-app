import { v4 as uuidv4 } from "uuid";
import { eq, inArray, asc } from "drizzle-orm";
import { db } from "./db";
import { recipeStepIngredients, recipeSteps, recipes } from "@/db/schema";
import type { Recipe, RecipeStep, RecipeStatus, ImageStatus, Ingredient } from "./types";

function toIsoDate(d: Date): string {
  return d.toISOString();
}

export async function createRecipe(
  query: string,
  userId: string = "anonymous",
): Promise<Recipe> {
  const now = new Date();
  const id = uuidv4();

  await db
    .insert(recipes)
    .values({
      id,
      user_id: userId,
      original_query: query,
      title: "",
      summary: "",
      source_links: [],
      status: "GENERATING",
      created_at: now,
      updated_at: now,
    })
    .returning();

  return {
    id,
    user_id: userId,
    original_query: query,
    title: "",
    summary: "",
    source_links: [],
    status: "GENERATING",
    created_at: toIsoDate(now),
  };
}

export async function updateRecipe(
  id: string,
  patch: Partial<Pick<Recipe, "title" | "summary" | "source_links" | "status">>,
): Promise<Recipe | null> {
  const now = new Date();
  const updated = await db
    .update(recipes)
    .set({
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(patch.source_links !== undefined ? { source_links: patch.source_links } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      updated_at: now,
    })
    .where(eq(recipes.id, id))
    .returning();

  const row = updated[0];
  if (!row) return null;

  return {
    id: row.id,
    user_id: row.user_id,
    original_query: row.original_query,
    title: row.title,
    summary: row.summary,
    source_links: row.source_links,
    status: row.status as RecipeStatus,
    created_at: toIsoDate(row.created_at),
  };
}

export async function getRecipe(id: string): Promise<Recipe | null> {
  const rows = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    user_id: row.user_id,
    original_query: row.original_query,
    title: row.title,
    summary: row.summary,
    source_links: row.source_links,
    status: row.status as RecipeStatus,
    created_at: toIsoDate(row.created_at),
  };
}

export async function createStep(
  recipeId: string,
  order: number,
  description: string,
  ingredients: Ingredient[],
  duration: number,
): Promise<RecipeStep> {
  const now = new Date();
  const id = uuidv4();

  await db.transaction(async (tx) => {
    await tx.insert(recipeSteps).values({
      id,
      recipe_id: recipeId,
      step_order: order,
      description,
      duration,
      image_status: "PENDING",
      image_url: null,
      created_at: now,
      updated_at: now,
    });

    if (ingredients.length > 0) {
      await tx.insert(recipeStepIngredients).values(
        ingredients.map((ing) => ({
          id: uuidv4(),
          step_id: id,
          name: ing.name,
          amount: ing.amount,
          substitute: ing.substitute ?? null,
          created_at: now,
          updated_at: now,
        })),
      );
    }
  });

  return {
    id,
    recipe_id: recipeId,
    step_order: order,
    description,
    ingredients,
    duration,
    image_url: null,
    image_status: "PENDING",
  };
}

export async function updateStepImage(
  stepId: string,
  imageUrl: string | null,
  status: ImageStatus,
): Promise<RecipeStep | null> {
  const now = new Date();
  const updated = await db
    .update(recipeSteps)
    .set({
      image_url: imageUrl,
      image_status: status,
      updated_at: now,
    })
    .where(eq(recipeSteps.id, stepId))
    .returning();

  const row = updated[0];
  if (!row) return null;

  const ingredients = await loadIngredientsForSteps([row.id]);
  return {
    id: row.id,
    recipe_id: row.recipe_id,
    step_order: row.step_order,
    description: row.description,
    ingredients: ingredients[row.id] ?? [],
    duration: row.duration,
    image_url: row.image_url ?? null,
    image_status: row.image_status as ImageStatus,
  };
}

async function loadIngredientsForSteps(stepIds: string[]): Promise<Record<string, Ingredient[]>> {
  if (stepIds.length === 0) return {};

  const rows = await db
    .select()
    .from(recipeStepIngredients)
    .where(inArray(recipeStepIngredients.step_id, stepIds))
    .orderBy(asc(recipeStepIngredients.created_at));

  const grouped: Record<string, Ingredient[]> = {};
  for (const r of rows) {
    const key = r.step_id;
    grouped[key] ??= [];
    grouped[key].push({
      name: r.name,
      amount: r.amount,
      substitute: r.substitute ?? undefined,
    });
  }
  return grouped;
}

export async function getStepsByRecipe(recipeId: string): Promise<RecipeStep[]> {
  const steps = await db
    .select()
    .from(recipeSteps)
    .where(eq(recipeSteps.recipe_id, recipeId))
    .orderBy(asc(recipeSteps.step_order));

  const ingredientGroups = await loadIngredientsForSteps(steps.map((s) => s.id));

  return steps.map((s) => ({
    id: s.id,
    recipe_id: s.recipe_id,
    step_order: s.step_order,
    description: s.description,
    ingredients: ingredientGroups[s.id] ?? [],
    duration: s.duration,
    image_url: s.image_url ?? null,
    image_status: s.image_status as ImageStatus,
  }));
}

export async function getStep(stepId: string): Promise<RecipeStep | null> {
  const steps = await db.select().from(recipeSteps).where(eq(recipeSteps.id, stepId)).limit(1);
  const step = steps[0];
  if (!step) return null;

  const ingredientGroups = await loadIngredientsForSteps([step.id]);
  return {
    id: step.id,
    recipe_id: step.recipe_id,
    step_order: step.step_order,
    description: step.description,
    ingredients: ingredientGroups[step.id] ?? [],
    duration: step.duration,
    image_url: step.image_url ?? null,
    image_status: step.image_status as ImageStatus,
  };
}

export async function updateStep(
  stepId: string,
  patch: Partial<Pick<RecipeStep, "description" | "ingredients" | "duration" | "image_status">>,
): Promise<RecipeStep | null> {
  const now = new Date();

  // Update step main fields
  const updated = await db
    .update(recipeSteps)
    .set({
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.duration !== undefined ? { duration: patch.duration } : {}),
      ...(patch.image_status !== undefined ? { image_status: patch.image_status } : {}),
      updated_at: now,
    })
    .where(eq(recipeSteps.id, stepId))
    .returning();

  const row = updated[0];
  if (!row) return null;

  // Replace ingredients if provided
  const newIngredients = patch.ingredients;
  if (newIngredients !== undefined) {
    await db.transaction(async (tx) => {
      await tx
        .delete(recipeStepIngredients)
        .where(eq(recipeStepIngredients.step_id, stepId));

      if (newIngredients.length > 0) {
        await tx.insert(recipeStepIngredients).values(
          newIngredients.map((ing) => ({
            id: uuidv4(),
            step_id: stepId,
            name: ing.name,
            amount: ing.amount,
            substitute: ing.substitute ?? null,
            created_at: now,
            updated_at: now,
          })),
        );
      }
    });
  }

  const ingredients = await loadIngredientsForSteps([stepId]);
  return {
    id: row.id,
    recipe_id: row.recipe_id,
    step_order: row.step_order,
    description: row.description,
    ingredients: ingredients[stepId] ?? [],
    duration: row.duration,
    image_url: row.image_url ?? null,
    image_status: row.image_status as ImageStatus,
  };
}

export async function clearStepsByRecipe(recipeId: string): Promise<void> {
  const steps = await db
    .select({ id: recipeSteps.id })
    .from(recipeSteps)
    .where(eq(recipeSteps.recipe_id, recipeId));
  const stepIds = steps.map((s) => s.id);

  await db.transaction(async (tx) => {
    if (stepIds.length > 0) {
      await tx.delete(recipeStepIngredients).where(inArray(recipeStepIngredients.step_id, stepIds));
    }
    await tx.delete(recipeSteps).where(eq(recipeSteps.recipe_id, recipeId));
  });
}

export async function setRecipeStatus(id: string, status: RecipeStatus): Promise<void> {
  await db
    .update(recipes)
    .set({ status, updated_at: new Date() })
    .where(eq(recipes.id, id));
}
