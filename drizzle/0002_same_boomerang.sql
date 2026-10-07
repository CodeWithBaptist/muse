CREATE TABLE "music_profile_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"top_artists" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"top_genres" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"time_range" text NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "music_profile_snapshots" ADD CONSTRAINT "music_profile_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "music_profile_snapshots_user_captured_idx" ON "music_profile_snapshots" USING btree ("user_id","captured_at");