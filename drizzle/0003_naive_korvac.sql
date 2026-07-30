CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"correlation_id" text NOT NULL,
	"action" text NOT NULL,
	"worker_id" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dead_shipping_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"failed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"attempts" integer DEFAULT 5 NOT NULL,
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "fraud_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"phone" text,
	"email" text,
	"ip_address" text,
	"device_fingerprint" text,
	"spam_score" integer DEFAULT 0 NOT NULL,
	"fraud_score" integer DEFAULT 0 NOT NULL,
	"is_cod_disabled" boolean DEFAULT false NOT NULL,
	"reason" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"razorpay_order_id" text,
	"razorpay_payment_id" text,
	"razorpay_signature" text,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_type" text NOT NULL,
	"is_booking_payment" boolean DEFAULT false NOT NULL,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_razorpay_payment_id_unique" UNIQUE("razorpay_payment_id")
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"colour_name" text NOT NULL,
	"colour_hex" text,
	"images" text[] DEFAULT '{}'::text[] NOT NULL,
	"sizes" text[] DEFAULT '{"XS", "S", "M", "L", "XL", "XXL"}'::text[] NOT NULL,
	"stock_quantity" jsonb DEFAULT '{"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 0}'::jsonb NOT NULL,
	"stock_qty" integer DEFAULT 0 NOT NULL,
	"sku" text NOT NULL,
	"price_override" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "shipment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"status" text NOT NULL,
	"courier" text,
	"location" text,
	"description" text,
	"event_timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "shipping_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"run_after" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_at" timestamp with time zone,
	"worker_id" text,
	"last_error" text,
	"qstash_message_id" text,
	"qstash_published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_name" text DEFAULT 'DRFTN CLOTHING' NOT NULL,
	"legal_name" text,
	"gstin" text,
	"address" text,
	"city" text,
	"state" text,
	"state_code" text,
	"pincode" text,
	"phone" text,
	"email" text,
	"invoice_prefix" text DEFAULT 'DRFTN' NOT NULL,
	"current_fy" text DEFAULT '2025-26' NOT NULL,
	"current_sequence" integer DEFAULT 1000 NOT NULL,
	"terms_footer" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_type" text NOT NULL,
	"event_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_provider_event_id_unique" UNIQUE("provider","event_id")
);
--> statement-breakpoint
CREATE TABLE "wishlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_reminder_sent_at" timestamp with time zone,
	"reminder_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "wishlist_user_product_unique" UNIQUE("user_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "wishlist_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_name" text NOT NULL,
	"email_type" text NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"subject" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
ALTER TABLE "discount_codes" ALTER COLUMN "min_order_value" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "shipping_charge" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "discount_amount" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "discount_amount" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "order_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "order_status" SET DEFAULT 'CREATED';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "fulfillment_type" SET DEFAULT 'shiprocket';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "remaining_amount" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "remaining_amount" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "dead_shipping_jobs" ADD CONSTRAINT "dead_shipping_jobs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_jobs" ADD CONSTRAINT "shipping_jobs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_order_id_idx" ON "audit_logs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "audit_logs_correlation_id_idx" ON "audit_logs" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "dead_shipping_jobs_order_id_idx" ON "dead_shipping_jobs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "fraud_scores_phone_idx" ON "fraud_scores" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "fraud_scores_user_id_idx" ON "fraud_scores" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fraud_scores_email_idx" ON "fraud_scores" USING btree ("email");--> statement-breakpoint
CREATE INDEX "payments_order_id_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_razorpay_payment_id_idx" ON "payments" USING btree ("razorpay_payment_id");--> statement-breakpoint
CREATE INDEX "shipment_events_order_id_idx" ON "shipment_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "shipping_jobs_status_run_after_idx" ON "shipping_jobs" USING btree ("status","run_after");--> statement-breakpoint
CREATE INDEX "shipping_jobs_order_id_idx" ON "shipping_jobs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "wishlist_user_id_idx" ON "wishlist" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wishlist_product_id_idx" ON "wishlist" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category");--> statement-breakpoint
CREATE INDEX "products_slug_idx" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_units_sold_idx" ON "products" USING btree ("units_sold");