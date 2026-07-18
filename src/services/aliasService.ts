import { aliasRepository } from "../database";

export interface AliasRecordLike {
  commandName: string;
  isEnabled: boolean;
}

export interface AliasRepositoryLike {
  findByAlias(guildId: string, alias: string): Promise<AliasRecordLike | null>;
}

export interface AliasService {
  normalizeAlias(value: string): string;
  resolveCommandName(guildId: string, rawCommandName: string): Promise<string | undefined>;
}

const BUILT_IN_ALIASES: Record<string, string> = {
  abraco: "hug",
  abracar: "hug",
  kiss: "kiss",
  selinho: "kiss",
  beijonatesta: "beijotesta",
  bjt: "beijotesta",
  foreheadkiss: "beijotesta",
  testada: "beijotesta",
  beijobochecha: "beijobochecha",
  bjb: "beijobochecha",
  bochecha: "beijobochecha",
  cheekkiss: "beijobochecha",
  cafune: "cafune",
  carinho: "cafune",
  headpat: "cafune",
  pat: "cafune",
  consolo: "consolar",
  comfort: "consolar",
  proteger: "proteger",
  protect: "proteger",
  bite: "morder",
  mordida: "morder",
  poke: "cutucar",
  cutucao: "cutucar"
};

export function createAliasService(
  repository: AliasRepositoryLike = aliasRepository
): AliasService {
  return {
    normalizeAlias,

    async resolveCommandName(guildId, rawCommandName) {
      const normalizedAlias = normalizeAlias(rawCommandName);

      if (!normalizedAlias) {
        return undefined;
      }

      const builtInCommand = BUILT_IN_ALIASES[normalizedAlias];

      if (builtInCommand) {
        return builtInCommand;
      }

      const customAlias = await repository.findByAlias(guildId, normalizedAlias);

      if (!customAlias || !customAlias.isEnabled) {
        return normalizedAlias;
      }

      return customAlias.commandName;
    }
  };
}

export const aliasService = createAliasService();

export function listBuiltInAliases(): Array<{ alias: string; commandName: string }> {
  return Object.entries(BUILT_IN_ALIASES).map(([alias, commandName]) => ({
    alias,
    commandName
  }));
}

export function normalizeAlias(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}
