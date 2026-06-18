-- telegram_chat_id: nullable + partial unique (multiple NULLs allowed for unlinked users)

DROP INDEX IF EXISTS "users_telegram_chat_id_key";

CREATE UNIQUE INDEX "users_telegram_chat_id_key"
  ON "users" ("telegram_chat_id")
  WHERE "telegram_chat_id" IS NOT NULL;
