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
    category: "carinho",
    commandName: "hug",
    description: "Abracar outro usuario."
  },
  {
    action: "beijotesta",
    category: "carinho",
    commandName: "beijotesta",
    description: "Dar um beijo na testa de outro usuario."
  },
  {
    action: "beijobochecha",
    category: "carinho",
    commandName: "beijobochecha",
    description: "Dar um beijo na bochecha de outro usuario."
  },
  {
    action: "cafune",
    category: "carinho",
    commandName: "cafune",
    description: "Fazer cafune em outro usuario."
  },
  {
    action: "consolar",
    category: "apoio",
    commandName: "consolar",
    description: "Consolar outro usuario."
  },
  {
    action: "proteger",
    category: "apoio",
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

export function getRpActionDefinition(action: string): RpActionDefinition | undefined {
  return RP_ACTION_DEFINITIONS.find((definition) => definition.action === action);
}
