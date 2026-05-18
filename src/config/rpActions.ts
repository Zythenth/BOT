import type { ActionCategory, ActionName } from "../types";

export interface RpActionDefinition {
  action: ActionName;
  category: ActionCategory;
  commandName: string;
  description: string;
}

export const RP_ACTION_DEFINITIONS: readonly RpActionDefinition[] = [
  {
    action: "hug",
    category: "carinho_fofo",
    commandName: "hug",
    description: "Abracar outro usuario."
  },
  {
    action: "beijotesta",
    category: "carinho_fofo",
    commandName: "beijotesta",
    description: "Dar um beijo na testa de outro usuario."
  },
  {
    action: "beijobochecha",
    category: "carinho_fofo",
    commandName: "beijobochecha",
    description: "Dar um beijo na bochecha de outro usuario."
  },
  {
    action: "cafune",
    category: "carinho_fofo",
    commandName: "cafune",
    description: "Fazer cafune em outro usuario."
  },
  {
    action: "consolar",
    category: "apoio_emocional",
    commandName: "consolar",
    description: "Consolar outro usuario."
  },
  {
    action: "proteger",
    category: "apoio_emocional",
    commandName: "proteger",
    description: "Proteger outro usuario."
  },
  {
    action: "morder",
    category: "brincadeira",
    commandName: "morder",
    description: "Dar uma mordidinha leve em outro usuario."
  },
  {
    action: "cutucar",
    category: "brincadeira",
    commandName: "cutucar",
    description: "Cutucar outro usuario."
  }
];

export const RP_ACTION_STATS_LABELS: Record<string, string> = {
  hug: "Abracos",
  beijotesta: "Beijos na testa",
  beijobochecha: "Beijos na bochecha",
  cafune: "Cafunes",
  consolar: "Consolos",
  proteger: "Protecoes",
  morder: "Mordidas",
  cutucar: "Cutucadas"
};

export function getRpActionDefinition(action: string): RpActionDefinition | undefined {
  return RP_ACTION_DEFINITIONS.find((definition) => definition.action === action);
}

export function getRpActionStatsLabel(action: string): string {
  return RP_ACTION_STATS_LABELS[action] ?? action;
}
