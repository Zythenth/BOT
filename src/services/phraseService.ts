import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Phrase } from "@prisma/client";
import { getRpActionDefinition } from "../config";
import { phraseRepository } from "../database";
import type { ActionCategory, ActionName, ActionPhraseSelection } from "../types";

export interface PhraseSelectionRequest {
  guildId: string;
  action: ActionName;
  category: ActionCategory;
}

export interface BasePhraseEntry {
  id: string;
  action: ActionName;
  category: ActionCategory;
  text: string;
  source: "base";
}

export interface PhraseService {
  selectForAction(request: PhraseSelectionRequest): Promise<ActionPhraseSelection | undefined>;
  listBasePhrases(filters?: ListBasePhraseFilters): BasePhraseEntry[];
}

export interface ListBasePhraseFilters {
  action?: ActionName;
  category?: ActionCategory;
}

type PhrasesFile = Record<string, string[]>;

export function createPhraseService(
  phrasesFilePath = path.resolve(process.cwd(), "data", "phrases.json")
): PhraseService {
  return {
    async selectForAction(request) {
      const customPhrases = await phraseRepository.list({
        guildId: request.guildId,
        action: request.action,
        category: request.category,
        isEnabled: true,
        take: 50
      });
      const basePhrases = loadBasePhrases(phrasesFilePath, {
        action: request.action,
        category: request.category
      });
      const candidates = [
        ...customPhrases.map(toPhraseSelection),
        ...basePhrases.map((phrase) => ({
          id: phrase.id,
          text: phrase.text
        }))
      ];

      return pickRandom(candidates);
    },

    listBasePhrases(filters = {}) {
      return loadBasePhrases(phrasesFilePath, filters);
    }
  };
}

export const phraseService = createPhraseService();

function loadBasePhrases(
  phrasesFilePath: string,
  filters: ListBasePhraseFilters = {}
): BasePhraseEntry[] {
  if (!existsSync(phrasesFilePath)) {
    return [];
  }

  const rawJson = readFileSync(phrasesFilePath, "utf8");
  const phrases = JSON.parse(rawJson) as PhrasesFile;

  return Object.entries(phrases).flatMap(([action, values]) => {
    const definition = getRpActionDefinition(action);

    if (!definition) {
      return [];
    }

    if (filters.action && filters.action !== action) {
      return [];
    }

    if (filters.category && filters.category !== definition.category) {
      return [];
    }

    return values.map((text, index) => ({
      id: `base:${action}:${index + 1}`,
      action,
      category: definition.category,
      text,
      source: "base" as const
    }));
  });
}

function toPhraseSelection(phrase: Phrase): ActionPhraseSelection {
  return {
    id: phrase.id,
    text: phrase.text
  };
}

function pickRandom<T>(values: T[]): T | undefined {
  if (values.length === 0) {
    return undefined;
  }

  return values[Math.floor(Math.random() * values.length)];
}
