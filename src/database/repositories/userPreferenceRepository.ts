import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { RepositoryClient } from "./types";

export type UpsertUserPreferenceInput = Omit<
  Prisma.UserPreferenceUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt"
>;

export const userPreferenceRepository = {
  findByUserId(userId: string, db: RepositoryClient = prisma) {
    return db.userPreference.findUnique({
      where: { userId }
    });
  },

  upsert(input: UpsertUserPreferenceInput, db: RepositoryClient = prisma) {
    const { userId, ...values } = input;

    return db.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        ...values
      },
      update: values
    });
  },

  updateByUserId(
    userId: string,
    data: Prisma.UserPreferenceUpdateInput,
    db: RepositoryClient = prisma
  ) {
    return db.userPreference.update({
      where: { userId },
      data
    });
  }
};
