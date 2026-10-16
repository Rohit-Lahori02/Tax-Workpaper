CREATE TABLE "blobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"data_base64" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigserial NOT NULL,
	"client_id" text NOT NULL,
	"kind" text NOT NULL,
	"actor_id" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"target" text NOT NULL,
	"body" jsonb NOT NULL,
	"batch_id" uuid,
	"supersedes" uuid,
	CONSTRAINT "facts_seq_unique" UNIQUE("seq")
);
--> statement-breakpoint
CREATE INDEX "blobs_client_idx" ON "blobs" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "facts_client_target_idx" ON "facts" USING btree ("client_id","target");--> statement-breakpoint
CREATE INDEX "facts_client_seq_idx" ON "facts" USING btree ("client_id","seq");--> statement-breakpoint
CREATE INDEX "facts_client_kind_idx" ON "facts" USING btree ("client_id","kind");