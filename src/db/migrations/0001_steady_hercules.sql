CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cloth_genders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fabrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lead_statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"tone" text DEFAULT 'neutral' NOT NULL,
	"is_terminal" boolean DEFAULT false NOT NULL,
	"is_won" boolean DEFAULT false NOT NULL,
	CONSTRAINT "lead_statuses_tone_valid" CHECK ("tone" in ('neutral', 'accent', 'success', 'warning', 'error', 'info'))
);
--> statement-breakpoint
CREATE TABLE "platforms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"is_social" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sizes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"size_group" text DEFAULT 'adult' NOT NULL,
	CONSTRAINT "sizes_size_group_valid" CHECK ("size_group" in ('adult', 'kids', 'other'))
);
--> statement-breakpoint
CREATE TABLE "subcategories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"category_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"tag_group" text DEFAULT 'details' NOT NULL,
	CONSTRAINT "tags_tag_group_valid" CHECK ("tag_group" in ('print', 'silhouette', 'length', 'neckline', 'sleeve', 'occasion', 'details', 'origin'))
);
--> statement-breakpoint
CREATE TABLE "urgency_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"tone" text DEFAULT 'neutral' NOT NULL,
	"is_ready_to_buy" boolean DEFAULT false NOT NULL,
	CONSTRAINT "urgency_levels_tone_valid" CHECK ("tone" in ('neutral', 'accent', 'success', 'warning', 'error', 'info'))
);
--> statement-breakpoint
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_key" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_sort_idx" ON "categories" USING btree ("sort_order","name");--> statement-breakpoint
CREATE UNIQUE INDEX "cities_slug_key" ON "cities" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "cities_sort_idx" ON "cities" USING btree ("sort_order","name");--> statement-breakpoint
CREATE UNIQUE INDEX "cloth_genders_slug_key" ON "cloth_genders" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "cloth_genders_sort_idx" ON "cloth_genders" USING btree ("sort_order","name");--> statement-breakpoint
CREATE UNIQUE INDEX "fabrics_slug_key" ON "fabrics" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "fabrics_sort_idx" ON "fabrics" USING btree ("sort_order","name");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_statuses_slug_key" ON "lead_statuses" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "lead_statuses_sort_idx" ON "lead_statuses" USING btree ("sort_order","name");--> statement-breakpoint
CREATE UNIQUE INDEX "platforms_slug_key" ON "platforms" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "platforms_sort_idx" ON "platforms" USING btree ("sort_order","name");--> statement-breakpoint
CREATE UNIQUE INDEX "sizes_slug_key" ON "sizes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sizes_sort_idx" ON "sizes" USING btree ("sort_order","name");--> statement-breakpoint
CREATE INDEX "sizes_group_idx" ON "sizes" USING btree ("size_group","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "subcategories_category_slug_key" ON "subcategories" USING btree ("category_id","slug");--> statement-breakpoint
CREATE INDEX "subcategories_category_idx" ON "subcategories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "subcategories_sort_idx" ON "subcategories" USING btree ("sort_order","name");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_key" ON "tags" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tags_sort_idx" ON "tags" USING btree ("sort_order","name");--> statement-breakpoint
CREATE INDEX "tags_group_idx" ON "tags" USING btree ("tag_group","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "urgency_levels_slug_key" ON "urgency_levels" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "urgency_levels_sort_idx" ON "urgency_levels" USING btree ("sort_order","name");