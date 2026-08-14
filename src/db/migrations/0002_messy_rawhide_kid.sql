CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"whatsapp_number" text,
	"on_whatsapp" boolean DEFAULT true NOT NULL,
	"city_id" uuid,
	"notes" text,
	"blocked_at" timestamp with time zone,
	"blocked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lead_tags" (
	"lead_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "lead_tags_lead_id_tag_id_pk" PRIMARY KEY("lead_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" integer GENERATED ALWAYS AS IDENTITY (sequence name "leads_reference_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"customer_id" uuid NOT NULL,
	"contacted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"platform_id" uuid NOT NULL,
	"category_id" uuid,
	"subcategory_id" uuid,
	"cloth_gender_id" uuid,
	"fabric_id" uuid,
	"size_id" uuid,
	"quantity" integer,
	"request" text,
	"urgency_id" uuid,
	"status_id" uuid NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "leads_subcategory_needs_category" CHECK ("leads"."subcategory_id" is null or "leads"."category_id" is not null),
	CONSTRAINT "leads_quantity_positive" CHECK ("leads"."quantity" is null or "leads"."quantity" > 0),
	CONSTRAINT "leads_source_valid" CHECK ("source" in ('manual', 'import', 'automation'))
);
--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_tags" ADD CONSTRAINT "lead_tags_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_tags" ADD CONSTRAINT "lead_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_cloth_gender_id_cloth_genders_id_fk" FOREIGN KEY ("cloth_gender_id") REFERENCES "public"."cloth_genders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_fabric_id_fabrics_id_fk" FOREIGN KEY ("fabric_id") REFERENCES "public"."fabrics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_size_id_sizes_id_fk" FOREIGN KEY ("size_id") REFERENCES "public"."sizes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_urgency_id_urgency_levels_id_fk" FOREIGN KEY ("urgency_id") REFERENCES "public"."urgency_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_status_id_lead_statuses_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."lead_statuses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_id_app_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_phone_key" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "customers_city_idx" ON "customers" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "customers_created_idx" ON "customers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "lead_tags_tag_idx" ON "lead_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_reference_key" ON "leads" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "leads_customer_idx" ON "leads" USING btree ("customer_id","contacted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "leads_contacted_idx" ON "leads" USING btree ("contacted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status_id","contacted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "leads_subcategory_idx" ON "leads" USING btree ("subcategory_id");--> statement-breakpoint
CREATE INDEX "leads_category_idx" ON "leads" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "leads_fabric_idx" ON "leads" USING btree ("fabric_id");--> statement-breakpoint
CREATE INDEX "leads_platform_idx" ON "leads" USING btree ("platform_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subcategories_id_category_key" ON "subcategories" USING btree ("id","category_id");--> statement-breakpoint
-- Moved by hand: drizzle-kit emits foreign keys before indexes, but this one
-- references the unique index above and Postgres refuses to create it first.
ALTER TABLE "leads" ADD CONSTRAINT "leads_subcategory_in_category_fk" FOREIGN KEY ("subcategory_id","category_id") REFERENCES "public"."subcategories"("id","category_id") ON DELETE restrict ON UPDATE no action;