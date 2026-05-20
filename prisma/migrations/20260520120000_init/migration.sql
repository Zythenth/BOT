-- Initial Aurora schema.
-- The IF NOT EXISTS guards keep this migration non-destructive for local SQLite
-- databases that were created before versioned migrations existed.

CREATE TABLE IF NOT EXISTS "Guild" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "prefix" TEXT NOT NULL DEFAULT '-',
  "isAllowed" BOOLEAN NOT NULL DEFAULT true,
  "affinityEnabled" BOOLEAN NOT NULL DEFAULT true,
  "gifsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "cooldownEnabled" BOOLEAN NOT NULL DEFAULT true,
  "cooldownSeconds" INTEGER NOT NULL DEFAULT 30,
  "locale" TEXT NOT NULL DEFAULT 'pt-BR',
  "mentionUsers" BOOLEAN NOT NULL DEFAULT true,
  "rankingEnabled" BOOLEAN NOT NULL DEFAULT true,
  "disabledCategories" TEXT NOT NULL DEFAULT '[]',
  "allowedChannelIds" TEXT NOT NULL DEFAULT '[]',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "UserPreference" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'pt-BR',
  "allowRomance" BOOLEAN NOT NULL DEFAULT false,
  "hideFromRankings" BOOLEAN NOT NULL DEFAULT false,
  "optedOutOfAffinity" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "AffinityPair" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "guildId" TEXT NOT NULL,
  "userAId" TEXT NOT NULL,
  "userBId" TEXT NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 0,
  "interactionCount" INTEGER NOT NULL DEFAULT 0,
  "lastInteractionAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "AffinityPair_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Interaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "guildId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
  "affinityPairId" TEXT,
  "gifId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Interaction_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Interaction_affinityPairId_fkey" FOREIGN KEY ("affinityPairId") REFERENCES "AffinityPair" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Interaction_gifId_fkey" FOREIGN KEY ("gifId") REFERENCES "Gif" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Gif" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "guildId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'giphy',
  "providerGifId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "rating" TEXT NOT NULL DEFAULT 'pg',
  "searchTerm" TEXT,
  "giphyPageUrl" TEXT,
  "timesUsed" INTEGER NOT NULL DEFAULT 0,
  "lastUsedAt" DATETIME,
  "addedBy" TEXT,
  "approvedBy" TEXT,
  "blockedBy" TEXT,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Gif_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Phrase" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "guildId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Phrase_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Alias" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "guildId" TEXT NOT NULL,
  "commandName" TEXT NOT NULL,
  "alias" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Alias_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Block" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "guildId" TEXT NOT NULL,
  "blockerUserId" TEXT NOT NULL,
  "blockedUserId" TEXT,
  "category" TEXT,
  "action" TEXT,
  "reason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Block_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AdminLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "guildId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "details" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminLog_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ButtonInteractionState" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "guildId" TEXT NOT NULL,
  "customId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "originalAuthorId" TEXT NOT NULL,
  "originalTargetId" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "usedAt" DATETIME,
  "details" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ButtonInteractionState_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "GiphyQuotaWindow" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "windowStartedAt" DATETIME NOT NULL,
  "windowEndsAt" DATETIME NOT NULL,
  "used" INTEGER NOT NULL DEFAULT 0,
  "limit" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserPreference_userId_key" ON "UserPreference" ("userId");
CREATE INDEX IF NOT EXISTS "UserPreference_userId_idx" ON "UserPreference" ("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "AffinityPair_guildId_userAId_userBId_key" ON "AffinityPair" ("guildId", "userAId", "userBId");
CREATE INDEX IF NOT EXISTS "AffinityPair_guildId_idx" ON "AffinityPair" ("guildId");
CREATE INDEX IF NOT EXISTS "AffinityPair_guildId_userAId_idx" ON "AffinityPair" ("guildId", "userAId");
CREATE INDEX IF NOT EXISTS "AffinityPair_guildId_userBId_idx" ON "AffinityPair" ("guildId", "userBId");

CREATE INDEX IF NOT EXISTS "Interaction_guildId_createdAt_idx" ON "Interaction" ("guildId", "createdAt");
CREATE INDEX IF NOT EXISTS "Interaction_guildId_actorUserId_idx" ON "Interaction" ("guildId", "actorUserId");
CREATE INDEX IF NOT EXISTS "Interaction_guildId_targetUserId_idx" ON "Interaction" ("guildId", "targetUserId");
CREATE INDEX IF NOT EXISTS "Interaction_guildId_action_idx" ON "Interaction" ("guildId", "action");

CREATE UNIQUE INDEX IF NOT EXISTS "Gif_provider_providerGifId_key" ON "Gif" ("provider", "providerGifId");
CREATE INDEX IF NOT EXISTS "Gif_guildId_idx" ON "Gif" ("guildId");
CREATE INDEX IF NOT EXISTS "Gif_guildId_action_category_idx" ON "Gif" ("guildId", "action", "category");
CREATE INDEX IF NOT EXISTS "Gif_guildId_status_idx" ON "Gif" ("guildId", "status");

CREATE INDEX IF NOT EXISTS "Phrase_guildId_action_category_idx" ON "Phrase" ("guildId", "action", "category");
CREATE INDEX IF NOT EXISTS "Phrase_guildId_isEnabled_idx" ON "Phrase" ("guildId", "isEnabled");

CREATE UNIQUE INDEX IF NOT EXISTS "Alias_guildId_alias_key" ON "Alias" ("guildId", "alias");
CREATE INDEX IF NOT EXISTS "Alias_guildId_commandName_idx" ON "Alias" ("guildId", "commandName");

CREATE INDEX IF NOT EXISTS "Block_guildId_blockerUserId_idx" ON "Block" ("guildId", "blockerUserId");
CREATE INDEX IF NOT EXISTS "Block_guildId_blockedUserId_idx" ON "Block" ("guildId", "blockedUserId");
CREATE INDEX IF NOT EXISTS "Block_guildId_category_idx" ON "Block" ("guildId", "category");

CREATE INDEX IF NOT EXISTS "AdminLog_guildId_createdAt_idx" ON "AdminLog" ("guildId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminLog_guildId_actorUserId_idx" ON "AdminLog" ("guildId", "actorUserId");
CREATE INDEX IF NOT EXISTS "AdminLog_guildId_action_idx" ON "AdminLog" ("guildId", "action");

CREATE UNIQUE INDEX IF NOT EXISTS "ButtonInteractionState_customId_key" ON "ButtonInteractionState" ("customId");
CREATE INDEX IF NOT EXISTS "ButtonInteractionState_guildId_action_idx" ON "ButtonInteractionState" ("guildId", "action");
CREATE INDEX IF NOT EXISTS "ButtonInteractionState_expiresAt_idx" ON "ButtonInteractionState" ("expiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "GiphyQuotaWindow_provider_windowStartedAt_key" ON "GiphyQuotaWindow" ("provider", "windowStartedAt");
CREATE INDEX IF NOT EXISTS "GiphyQuotaWindow_provider_windowEndsAt_idx" ON "GiphyQuotaWindow" ("provider", "windowEndsAt");
