import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { RepositoryClient } from "./types";

export interface UpsertGuildInput {
  id: string;
  prefix?: string;
  isAllowed?: boolean;
  affinityEnabled?: boolean;
  gifsEnabled?: boolean;
  cooldownEnabled?: boolean;
  cooldownSeconds?: number;
  locale?: string;
  mentionUsers?: boolean;
  rankingEnabled?: boolean;
  disabledCategories?: string;
  allowedChannelIds?: string;
}

export const guildRepository = {
  findById(id: string, db: RepositoryClient = prisma) {
    return db.guild.findUnique({
      where: { id }
    });
  },

  upsert(input: UpsertGuildInput, db: RepositoryClient = prisma) {
    return db.guild.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        prefix: input.prefix,
        isAllowed: input.isAllowed,
        affinityEnabled: input.affinityEnabled,
        gifsEnabled: input.gifsEnabled,
        cooldownEnabled: input.cooldownEnabled,
        cooldownSeconds: input.cooldownSeconds,
        locale: input.locale,
        mentionUsers: input.mentionUsers,
        rankingEnabled: input.rankingEnabled,
        disabledCategories: input.disabledCategories,
        allowedChannelIds: input.allowedChannelIds
      },
      update: {
        prefix: input.prefix,
        isAllowed: input.isAllowed,
        affinityEnabled: input.affinityEnabled,
        gifsEnabled: input.gifsEnabled,
        cooldownEnabled: input.cooldownEnabled,
        cooldownSeconds: input.cooldownSeconds,
        locale: input.locale,
        mentionUsers: input.mentionUsers,
        rankingEnabled: input.rankingEnabled,
        disabledCategories: input.disabledCategories,
        allowedChannelIds: input.allowedChannelIds
      }
    });
  },

  update(id: string, data: Prisma.GuildUpdateInput, db: RepositoryClient = prisma) {
    return db.guild.update({
      where: { id },
      data
    });
  },

  listAllowed(db: RepositoryClient = prisma) {
    return db.guild.findMany({
      where: { isAllowed: true },
      orderBy: { createdAt: "asc" }
    });
  }
};
