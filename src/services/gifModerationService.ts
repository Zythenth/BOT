import type { Gif } from "@prisma/client";
import { gifRepository, guildRepository, type GifStatus } from "../database";
import type { ActionCategory, ActionGifSelection, ActionName } from "../types";
import { ADMIN_LOG_ACTIONS, adminLogService } from "./adminLogService";
import { gifService } from "./gifService";
import { giphyProviderService, type GiphyProviderStatus } from "./giphyProviderService";

export interface GifModerationBaseInput {
  guildId: string;
  actorUserId: string;
}

export interface AddManualGifInput extends GifModerationBaseInput {
  provider?: "giphy";
  providerGifId: string;
  action: ActionName;
  category: ActionCategory;
  status?: GifStatus;
  rating?: string;
  searchTerm?: string;
  giphyPageUrl?: string;
  notes?: string;
}

export interface SearchGiphyForModerationInput extends GifModerationBaseInput {
  searchTerm: string;
  action: ActionName;
  category: ActionCategory;
  limit?: number;
  status?: GifStatus;
}

export interface GifStatusChangeInput extends GifModerationBaseInput {
  id: string;
  notes?: string;
}

export interface MoveGifInput extends GifModerationBaseInput {
  id: string;
  action?: ActionName;
  category?: ActionCategory;
}

export interface ListModerationGifsInput extends GifModerationBaseInput {
  action?: ActionName;
  category?: ActionCategory;
  status?: GifStatus;
  provider?: "giphy";
  take?: number;
}

export interface TestGifSelectionInput extends GifModerationBaseInput {
  action: ActionName;
  category: ActionCategory;
}

export interface ImportedGifSummary {
  gif: Gif;
  created: boolean;
}

export interface GifSearchModerationResult {
  items: ImportedGifSummary[];
  duplicateCount: number;
}

export interface GifTestResult {
  selection?: ActionGifSelection;
  storedGif?: Gif;
}

export type GifModerationResult<T> =
  | {
      ok: true;
      message: string;
      data: T;
    }
  | {
      ok: false;
      message: string;
    };

export const gifModerationService = {
  async addManualGif(input: AddManualGifInput): Promise<GifModerationResult<ImportedGifSummary>> {
    await ensureGuild(input.guildId);

    const provider = input.provider ?? "giphy";
    const providerGifId = normalizeRequired(input.providerGifId);

    if (!providerGifId) {
      await logGifAdminAction(input, ADMIN_LOG_ACTIONS.GIF_ADD, undefined, {
        outcome: "invalid_provider_gif_id"
      });
      return {
        ok: false,
        message: "Informe um providerGifId valido."
      };
    }

    if (!isRatingAllowed(input.rating)) {
      await logGifAdminAction(input, ADMIN_LOG_ACTIONS.GIF_ADD, undefined, {
        provider,
        providerGifId,
        outcome: "nsfw_blocked"
      });
      return {
        ok: false,
        message: "Rating r nao esta liberado pelo ALLOW_NSFW."
      };
    }

    const existingGif = await gifRepository.findByProviderGifId(provider, providerGifId);

    if (existingGif) {
      const isSameGuild = existingGif.guildId === input.guildId;

      await logGifAdminAction(
        input,
        ADMIN_LOG_ACTIONS.GIF_ADD,
        isSameGuild ? existingGif.id : undefined,
        {
          provider,
          providerGifId,
          outcome: isSameGuild ? "duplicate" : "global_duplicate"
        }
      );

      if (!isSameGuild) {
        return {
          ok: false,
          message: "Este providerGifId ja existe e nao pode ser duplicado."
        };
      }

      return {
        ok: true,
        message: "Este GIF ja estava cadastrado.",
        data: {
          gif: existingGif,
          created: false
        }
      };
    }

    const gif = await gifRepository.createGif({
      guildId: input.guildId,
      provider,
      providerGifId,
      action: input.action,
      category: input.category,
      status: input.status ?? "pending",
      rating: input.rating ?? "pg",
      searchTerm: normalizeOptional(input.searchTerm),
      giphyPageUrl: normalizeOptional(input.giphyPageUrl),
      notes: normalizeOptional(input.notes),
      addedBy: input.actorUserId
    });

    await logGifAdminAction(input, ADMIN_LOG_ACTIONS.GIF_ADD, gif.id, {
      provider,
      providerGifId,
      action: input.action,
      category: input.category,
      status: gif.status,
      outcome: "created"
    });

    return {
      ok: true,
      message: "GIF cadastrado para moderacao.",
      data: {
        gif,
        created: true
      }
    };
  },

  async searchGiphy(
    input: SearchGiphyForModerationInput
  ): Promise<GifModerationResult<GifSearchModerationResult>> {
    await ensureGuild(input.guildId);

    const searchTerm = normalizeRequired(input.searchTerm);

    if (!searchTerm) {
      await logGifAdminAction(input, ADMIN_LOG_ACTIONS.GIF_SEARCH, undefined, {
        outcome: "invalid_search_term"
      });
      return {
        ok: false,
        message: "Informe um termo de busca valido."
      };
    }

    const result = await giphyProviderService.search({
      searchTerm,
      limit: clampInteger(input.limit ?? 5, 1, 10)
    });

    if (result.status !== "ok") {
      await logGifAdminAction(input, ADMIN_LOG_ACTIONS.GIF_SEARCH, undefined, {
        searchTerm,
        action: input.action,
        category: input.category,
        outcome: result.status
      });
      return {
        ok: false,
        message: formatGiphyStatusMessage(result.status)
      };
    }

    const imported: ImportedGifSummary[] = [];
    let duplicateCount = 0;

    for (const giphyGif of result.gifs) {
      const existingGif = await gifRepository.findByProviderGifId(
        giphyGif.provider,
        giphyGif.providerGifId
      );

      if (existingGif) {
        duplicateCount += 1;

        if (existingGif.guildId === input.guildId) {
          imported.push({
            gif: existingGif,
            created: false
          });
        }

        continue;
      }

      const gif = await gifRepository.createGif({
        guildId: input.guildId,
        provider: giphyGif.provider,
        providerGifId: giphyGif.providerGifId,
        action: input.action,
        category: input.category,
        status: input.status ?? "pending",
        rating: giphyGif.rating ?? "pg",
        searchTerm,
        giphyPageUrl: giphyGif.pageUrl,
        addedBy: input.actorUserId
      });

      imported.push({
        gif,
        created: true
      });
    }

    await logGifAdminAction(input, ADMIN_LOG_ACTIONS.GIF_SEARCH, undefined, {
      searchTerm,
      action: input.action,
      category: input.category,
      requestedLimit: input.limit ?? 5,
      created: imported.filter((item) => item.created).length,
      duplicates: duplicateCount,
      outcome: "ok"
    });

    return {
      ok: true,
      message: "Busca na GIPHY concluida.",
      data: {
        items: imported,
        duplicateCount
      }
    };
  },

  async approve(input: GifStatusChangeInput): Promise<GifModerationResult<Gif>> {
    const gif = await getModeratedGif(input, ADMIN_LOG_ACTIONS.GIF_APPROVE);

    if (!gif.ok) {
      return gif;
    }

    const updatedGif = await gifRepository.approve({
      id: input.id,
      actorUserId: input.actorUserId,
      notes: normalizeOptional(input.notes)
    });

    await logGifAdminAction(input, ADMIN_LOG_ACTIONS.GIF_APPROVE, updatedGif.id, {
      previousStatus: gif.data.status,
      status: updatedGif.status,
      outcome: "approved"
    });

    return {
      ok: true,
      message: "GIF aprovado.",
      data: updatedGif
    };
  },

  async block(input: GifStatusChangeInput): Promise<GifModerationResult<Gif>> {
    const gif = await getModeratedGif(input, ADMIN_LOG_ACTIONS.GIF_BLOCK);

    if (!gif.ok) {
      return gif;
    }

    const updatedGif = await gifRepository.block({
      id: input.id,
      actorUserId: input.actorUserId,
      notes: normalizeOptional(input.notes)
    });

    await logGifAdminAction(input, ADMIN_LOG_ACTIONS.GIF_BLOCK, updatedGif.id, {
      previousStatus: gif.data.status,
      status: updatedGif.status,
      outcome: "blocked"
    });

    return {
      ok: true,
      message: "GIF bloqueado.",
      data: updatedGif
    };
  },

  async remove(input: GifStatusChangeInput): Promise<GifModerationResult<Gif>> {
    const gif = await getModeratedGif(input, ADMIN_LOG_ACTIONS.GIF_REMOVE);

    if (!gif.ok) {
      return gif;
    }

    const updatedGif = await gifRepository.disable(input.id);

    await logGifAdminAction(input, ADMIN_LOG_ACTIONS.GIF_REMOVE, updatedGif.id, {
      previousStatus: gif.data.status,
      status: updatedGif.status,
      outcome: "disabled"
    });

    return {
      ok: true,
      message: "GIF desativado logicamente.",
      data: updatedGif
    };
  },

  async move(input: MoveGifInput): Promise<GifModerationResult<Gif>> {
    const gif = await getModeratedGif(input, ADMIN_LOG_ACTIONS.GIF_MOVE);

    if (!gif.ok) {
      return gif;
    }

    if (!input.action && !input.category) {
      await logGifAdminAction(input, ADMIN_LOG_ACTIONS.GIF_MOVE, input.id, {
        outcome: "missing_destination"
      });
      return {
        ok: false,
        message: "Informe action, category ou ambos para mover."
      };
    }

    const updatedGif = await gifRepository.moveActionCategory(input.id, {
      action: input.action,
      category: input.category
    });

    await logGifAdminAction(input, ADMIN_LOG_ACTIONS.GIF_MOVE, updatedGif.id, {
      previousAction: gif.data.action,
      previousCategory: gif.data.category,
      action: updatedGif.action,
      category: updatedGif.category,
      outcome: "moved"
    });

    return {
      ok: true,
      message: "GIF movido.",
      data: updatedGif
    };
  },

  async list(input: ListModerationGifsInput): Promise<GifModerationResult<Gif[]>> {
    await ensureGuild(input.guildId);

    const gifs = await gifRepository.list({
      guildId: input.guildId,
      action: input.action,
      category: input.category,
      status: input.status,
      provider: input.provider,
      take: clampInteger(input.take ?? 10, 1, 25)
    });

    await logGifAdminAction(input, ADMIN_LOG_ACTIONS.GIF_LIST, undefined, {
      action: input.action,
      category: input.category,
      status: input.status,
      provider: input.provider,
      count: gifs.length,
      outcome: "ok"
    });

    return {
      ok: true,
      message: "Lista de GIFs carregada.",
      data: gifs
    };
  },

  async testSelection(input: TestGifSelectionInput): Promise<GifModerationResult<GifTestResult>> {
    await ensureGuild(input.guildId);

    const selection = await gifService.chooseGif({
      guildId: input.guildId,
      action: input.action,
      category: input.category,
      addedBy: input.actorUserId
    });
    const storedGif = selection?.id
      ? ((await gifRepository.findById(selection.id)) ?? undefined)
      : undefined;

    await logGifAdminAction(input, ADMIN_LOG_ACTIONS.GIF_TEST, selection?.id, {
      action: input.action,
      category: input.category,
      selected: Boolean(selection),
      status: storedGif?.status,
      provider: storedGif?.provider,
      outcome: "ok"
    });

    return {
      ok: true,
      message: selection
        ? "Sorteio de GIF executado."
        : "Sorteio executado, mas nenhum GIF ficou disponivel.",
      data: {
        selection,
        storedGif
      }
    };
  }
};

async function getModeratedGif(
  input: GifStatusChangeInput | MoveGifInput,
  action: string
): Promise<GifModerationResult<Gif>> {
  await ensureGuild(input.guildId);

  const gif = await gifRepository.findById(input.id);

  if (!gif) {
    await logGifAdminAction(input, action, input.id, {
      outcome: "not_found"
    });
    return {
      ok: false,
      message: "GIF nao encontrado neste servidor."
    };
  }

  if (gif.guildId !== input.guildId) {
    await logGifAdminAction(input, action, input.id, {
      outcome: "wrong_guild"
    });
    return {
      ok: false,
      message: "GIF nao encontrado neste servidor."
    };
  }

  return {
    ok: true,
    message: "GIF encontrado.",
    data: gif
  };
}

async function ensureGuild(guildId: string): Promise<void> {
  await guildRepository.upsert({ id: guildId });
}

async function logGifAdminAction(
  input: GifModerationBaseInput,
  action: string,
  targetId: string | undefined,
  details: Record<string, unknown>
): Promise<void> {
  await adminLogService.log({
    guildId: input.guildId,
    actorUserId: input.actorUserId,
    action,
    targetType: "gif",
    targetId,
    details
  });
}

function normalizeRequired(value: string): string {
  return value.trim();
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isInteger(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function formatGiphyStatusMessage(status: GiphyProviderStatus): string {
  const messages: Record<GiphyProviderStatus, string> = {
    ok: "Busca na GIPHY concluida.",
    missing_api_key: "Configure GIPHY_API_KEY antes de buscar GIFs.",
    quota_exhausted: "A cota horaria da GIPHY acabou. Use GIFs aprovados do banco por enquanto.",
    provider_error: "A GIPHY nao respondeu corretamente agora.",
    not_found: "Nenhum GIF foi encontrado na GIPHY."
  };

  return messages[status];
}

function isRatingAllowed(rating?: string): boolean {
  if (rating?.toLowerCase() !== "r") {
    return true;
  }

  return readBoolean("ALLOW_NSFW", false);
}

function readBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();

  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes", "y", "on"].includes(value);
}
