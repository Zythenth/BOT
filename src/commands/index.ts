import { Collection } from "discord.js";
import type { PrefixCommandDefinition, SlashCommandDefinition } from "../types";
import { affinityCommand, rankAffinityCommand } from "./affinityCommands";
import { helpCommand } from "./helpCommand";
import { prefixCommandDefinitions } from "./prefixCommands";
import { rpSlashCommands } from "./rpCommands";

export * from "./actionResponseAdapter";
export * from "./prefixParser";

export const slashCommands = new Collection<string, SlashCommandDefinition>();
export const prefixCommands = new Collection<string, PrefixCommandDefinition>();

for (const command of [
  ...rpSlashCommands,
  affinityCommand,
  rankAffinityCommand,
  helpCommand
]) {
  slashCommands.set(command.name, command);
}

for (const command of prefixCommandDefinitions) {
  prefixCommands.set(command.name, command);
}
