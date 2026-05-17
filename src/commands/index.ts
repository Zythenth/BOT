import { Collection } from "discord.js";
import type { PrefixCommandDefinition, SlashCommandDefinition } from "../types";

export const slashCommands = new Collection<string, SlashCommandDefinition>();
export const prefixCommands = new Collection<string, PrefixCommandDefinition>();
