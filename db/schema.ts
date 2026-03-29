import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const recipes = pgTable("recipes", {
  id: uuid("id").primaryKey(),
  user_id: varchar("user_id", { length: 64 }).notNull(),
  original_query: text("original_query").notNull(),

  title: varchar("title", { length: 255 }).notNull(),
  summary: text("summary").notNull().default(""),
  source_links: jsonb("source_links").$type<string[]>().notNull(),

  status: varchar("status", { length: 32 }).notNull().default("GENERATING"),

  created_at: timestamp("created_at", { withTimezone: true }).notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const recipeSteps = pgTable("recipe_steps", {
  id: uuid("id").primaryKey(),
  recipe_id: uuid("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),

  step_order: integer("step_order").notNull(),
  description: text("description").notNull(),
  duration: integer("duration").notNull().default(0),

  image_status: varchar("image_status", { length: 32 })
    .notNull()
    .default("PENDING"),
  image_url: text("image_url"),

  created_at: timestamp("created_at", { withTimezone: true }).notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull(),
});

// ingredients 单独建表：每个步骤对应多行 ingredients
export const recipeStepIngredients = pgTable("recipe_step_ingredients", {
  id: uuid("id").primaryKey(),

  step_id: uuid("step_id")
    .notNull()
    .references(() => recipeSteps.id, { onDelete: "cascade" }),

  name: text("name").notNull(),
  amount: text("amount").notNull(),
  substitute: text("substitute"),

  created_at: timestamp("created_at", { withTimezone: true }).notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull(),
});
