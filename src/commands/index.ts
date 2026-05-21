import { Collection } from "discord.js";
import type { PrefixCommandDefinition, SlashCommandDefinition } from "../types";
import { affinityCommand, rankAffinityCommand } from "./affinityCommands";
import { configCommand } from "./configCommand";
import { gifAdminSlashCommands } from "./gifAdminCommands";
import { helpCommand } from "./helpCommand";
import { phraseAdminSlashCommands } from "./phraseAdminCommands";
import { prefixCommandDefinitions } from "./prefixCommands";
import { prefixStatusCommand } from "./prefixStatusCommand";
import { privacySlashCommands } from "./privacyCommands";
import { rpSlashCommands } from "./rpCommands";

export * from "./actionResponseAdapter";
export * from "./prefixParser";

export const slashCommands = new Collection<string, SlashCommandDefinition>();
export const prefixCommands = new Collection<string, PrefixCommandDefinition>();

for (const command of [
  ...rpSlashCommands,
  affinityCommand,
  rankAffinityCommand,
  ...privacySlashCommands,
  ...gifAdminSlashCommands,
  ...phraseAdminSlashCommands,
  configCommand,
  prefixStatusCommand,
  helpCommand
]) {
  slashCommands.set(command.name, command);
}

for (const command of prefixCommandDefinitions) {
  prefixCommands.set(command.name, command);
}
