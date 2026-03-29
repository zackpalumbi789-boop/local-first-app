CREATE TABLE "recipe_step_ingredients" (
	"id" uuid PRIMARY KEY NOT NULL,
	"step_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount" text NOT NULL,
	"substitute" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recipe_id" uuid NOT NULL,
	"step_order" integer NOT NULL,
	"description" text NOT NULL,
	"duration" integer DEFAULT 0 NOT NULL,
	"image_status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"image_url" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"original_query" text NOT NULL,
	"title" varchar(255) NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"source_links" jsonb NOT NULL,
	"status" varchar(32) DEFAULT 'GENERATING' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe_step_ingredients" ADD CONSTRAINT "recipe_step_ingredients_step_id_recipe_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."recipe_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;