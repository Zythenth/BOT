import type { Phrase } from "@prisma/client";
import { getRpActionDefinition } from "../config";
import {
  guildRepository,
  phraseRepository
} from "../database";
import type { ActionCategory, ActionName } from "../types";
import { ADMIN_LOG_ACTIONS, adminLogService } from "./adminLogService";
import { phraseService, type BasePhraseEntry } from "./phraseService";

const ALLOWED_PLACEHOLDERS = ["autor", "alvo", "pontos", "total", "marco"] as const;
const MAX_PHRASE_LENGTH = 240;
const BLOCKED_CONTENT_PATTERNS: readonly RegExp[] = [
  /\b(18\+|nsfw|porno|pornografia|sexual|sexo|transar|nude|nudes|pelad[aoa]?|fetiche)\b/i,
  /\b(tesao|gozar|gemer|boquete|oral|putaria|safad[aoa]?|sensual)\b/i,
  /\b(matar|morrer|sangue|torturar|espancar|agredir|ferir|machucar|facada|arma)\b/i,
  /\b(humilhar|degradar|submisso|submissa|obedecer|dominar)\b/i,
  /\b(te amo|apaixonad[aoa]?|namorad[aoa]?|casar|alma gemea|para sempre juntos)\b/i,
  /\b(voce e meu|voce e minha|so meu|so minha|pertence a mim|minha propriedade)\b/i
];

export interface PhraseModerationBaseInput {
  guildId: string;
  actorUserId: string;
}

export interface AddPhraseInput extends PhraseModerationBaseInput {
  action: ActionName;
  category?: ActionCategory;
  text: string;
}

export interface RemovePhraseInput extends PhraseModerationBaseInput {
  id: string;
}

export interface ListPhrasesInput extends PhraseModerationBaseInput {
  action?: ActionName;
  category?: ActionCategory;
  take?: number;
}

export interface PhraseListItem {
  id: string;
  source: "base" | "custom";
  action: ActionName;
  category: ActionCategory;
  text: string;
  isEnabled: boolean;
}

export interface PhraseListResult {
  items: PhraseListItem[];
  baseCount: number;
  customCount: number;
}

export type PhraseModerationResult<T> =
  | {
      ok: true;
      message: string;
      data: T;
    }
  | {
      ok: false;
      message: string;
    };

export const phraseModerationService = {
  async addPhrase(input: AddPhraseInput): Promise<PhraseModerationResult<Phrase>> {
    await ensureGuild(input.guildId);

    const normalizedText = normalizePhraseText(input.text);
    const category = resolveCategory(input.action, input.category);

    if (!category) {
      await logPhraseAdminAction(input, ADMIN_LOG_ACTIONS.PHRASE_ADD, undefined, {
        action: input.action,
        outcome: "missing_category"
      });
      return {
        ok: false,
        message: "Informe uma categoria para essa action."
      };
    }

    const validationError = validatePhraseText(normalizedText);

    if (validationError) {
      await logPhraseAdminAction(input, ADMIN_LOG_ACTIONS.PHRASE_ADD, undefined, {
        action: input.action,
        category,
        outcome: "validation_failed",
        reason: validationError
      });
      return {
        ok: false,
        message: validationError
      };
    }

    const duplicated = await findEnabledDuplicate(input.guildId, input.action, category, normalizedText);

    if (duplicated) {
      await logPhraseAdminAction(input, ADMIN_LOG_ACTIONS.PHRASE_ADD, duplicated.id, {
        action: input.action,
        category,
        outcome: "duplicate"
      });
      return {
        ok: false,
        message: "Essa frase customizada ja existe para essa action/category."
      };
    }

    const phrase = await phraseRepository.create({
      guildId: input.guildId,
      action: input.action,
      category,
      text: normalizedText,
      isDefault: false,
      isEnabled: true,
      createdBy: input.actorUserId
    });

    await logPhraseAdminAction(input, ADMIN_LOG_ACTIONS.PHRASE_ADD, phrase.id, {
      action: phrase.action,
      category: phrase.category,
      outcome: "created"
    });

    return {
      ok: true,
      message: "Frase customizada adicionada.",
      data: phrase
    };
  },

  async removePhrase(input: RemovePhraseInput): Promise<PhraseModerationResult<Phrase>> {
    await ensureGuild(input.guildId);

    if (input.id.startsWith("base:")) {
      await logPhraseAdminAction(input, ADMIN_LOG_ACTIONS.PHRASE_REMOVE, input.id, {
        outcome: "base_phrase_blocked"
      });
      return {
        ok: false,
        message: "Frases base do JSON nao podem ser removidas por comando."
      };
    }

    const phrase = await phraseRepository.findById(input.id);

    if (!phrase || phrase.guildId !== input.guildId) {
      await logPhraseAdminAction(input, ADMIN_LOG_ACTIONS.PHRASE_REMOVE, input.id, {
        outcome: "not_found"
      });
      return {
        ok: false,
        message: "Frase customizada nao encontrada neste servidor."
      };
    }

    if (phrase.isDefault) {
      await logPhraseAdminAction(input, ADMIN_LOG_ACTIONS.PHRASE_REMOVE, phrase.id, {
        outcome: "default_phrase_blocked"
      });
      return {
        ok: false,
        message: "Frases base nao podem ser removidas por comando."
      };
    }

    const updatedPhrase = await phraseRepository.setEnabled(phrase.id, false);

    await logPhraseAdminAction(input, ADMIN_LOG_ACTIONS.PHRASE_REMOVE, updatedPhrase.id, {
      action: updatedPhrase.action,
      category: updatedPhrase.category,
      outcome: "disabled"
    });

    await logPhraseAdminAction(input, ADMIN_LOG_ACTIONS.PHRASE_LIST, undefined, {
      action: input.action,
      category: input.category,
      returned: items.length,
      baseCount: baseItems.length,
      customCount: customItems.length
    });

    return {
      ok: true,
      message: "Frase customizada removida da rotacao.",
      data: updatedPhrase
    };
  },

  async listPhrases(input: ListPhrasesInput): Promise<PhraseModerationResult<PhraseListResult>> {
    await ensureGuild(input.guildId);

    const customPhrases = await phraseRepository.list({
      guildId: input.guildId,
      action: input.action,
      category: input.category,
      isEnabled: true,
      take: clampInteger(input.take ?? 25, 1, 50)
    });
    const basePhrases = phraseService.listBasePhrases({
      action: input.action,
      category: input.category
    });
    const baseItems = basePhrases.map(toBaseListItem);
    const customItems = customPhrases.map(toCustomListItem);
    const items = [...baseItems, ...customItems].slice(0, clampInteger(input.take ?? 25, 1, 50));

    return {
      ok: true,
      message: "Frases carregadas.",
      data: {
        items,
        baseCount: baseItems.length,
        customCount: customItems.length
      }
    };
  }
};

async function ensureGuild(guildId: string): Promise<void> {
  await guildRepository.upsert({ id: guildId });
}

function resolveCategory(action: ActionName, category?: ActionCategory): ActionCategory | undefined {
  return category ?? getRpActionDefinition(action)?.category;
}

function normalizePhraseText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function validatePhraseText(text: string): string | undefined {
  if (!text) {
    return "Informe uma frase valida.";
  }

  if (text.length > MAX_PHRASE_LENGTH) {
    return `A frase deve ter no maximo ${MAX_PHRASE_LENGTH} caracteres.`;
  }

  const invalidPlaceholders = findInvalidPlaceholders(text);

  if (invalidPlaceholders.length > 0) {
    return `Placeholders permitidos: ${ALLOWED_PLACEHOLDERS.map((value) => `{${value}}`).join(", ")}. Invalidos: ${invalidPlaceholders.join(", ")}.`;
  }

  const searchableText = toSearchableText(text);

  if (BLOCKED_CONTENT_PATTERNS.some((pattern) => pattern.test(searchableText))) {
    return "A frase foi bloqueada por conter conteudo adulto, pesado, sugestivo, violento, possessivo ou romance forcado.";
  }

  return undefined;
}

function findInvalidPlaceholders(text: string): string[] {
  const placeholders = text.match(/\{[^{}]+\}/g) ?? [];
  const allowed = new Set<string>(ALLOWED_PLACEHOLDERS.map((value) => `{${value}}`));

  return [...new Set(placeholders.filter((placeholder) => !allowed.has(placeholder)))];
}

function toSearchableText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

async function findEnabledDuplicate(
  guildId: string,
  action: ActionName,
  category: ActionCategory,
  text: string
): Promise<Phrase | undefined> {
  const phrases = await phraseRepository.list({
    guildId,
    action,
    category,
    isEnabled: true,
    take: 100
  });
  const normalizedText = normalizePhraseText(text).toLowerCase();

  return phrases.find((phrase) => normalizePhraseText(phrase.text).toLowerCase() === normalizedText);
}

function toBaseListItem(phrase: BasePhraseEntry): PhraseListItem {
  return {
    id: phrase.id,
    source: "base",
    action: phrase.action,
    category: phrase.category,
    text: phrase.text,
    isEnabled: true
  };
}

function toCustomListItem(phrase: Phrase): PhraseListItem {
  return {
    id: phrase.id,
    source: "custom",
    action: phrase.action,
    category: phrase.category,
    text: phrase.text,
    isEnabled: phrase.isEnabled
  };
}

async function logPhraseAdminAction(
  input: PhraseModerationBaseInput,
  action: string,
  targetId: string | undefined,
  details: Record<string, unknown>
): Promise<void> {
  await adminLogService.log({
    guildId: input.guildId,
    actorUserId: input.actorUserId,
    action,
    targetType: "phrase",
    targetId,
    details
  });
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isInteger(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}
