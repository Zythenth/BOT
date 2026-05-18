import { Collection } from "discord.js";
import type { PrefixCommandDefinition, SlashCommandDefinition } from "../types";
import { affinityCommand, rankAffinityCommand } from "./affinityCommands";
import { helpCommand } from "./helpCommand";
import { rpSlashCommands } from "./rpCommands";

export * from "./actionResponseAdapter";

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
