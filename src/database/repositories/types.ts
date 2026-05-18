import type { PrismaClientInstance } from "../prisma";

export type RepositoryClient = PrismaClientInstance;

export const GIF_STATUSES = [
  "pending",
  "approved",
  "blocked",
  "disabled",
  "uncategorized"
] as const;

export type GifStatus = (typeof GIF_STATUSES)[number];

export interface ListOptions {
  take?: number;
  skip?: number;
}

export const DEFAULT_LIST_TAKE = 50;
