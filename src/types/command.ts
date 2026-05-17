import type { ChatInputCommandInteraction, Message } from "discord.js";

export interface SlashCommandDefinition {
  name: string;
  description: string;
  data: {
    toJSON(): unknown;
  };
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

export interface PrefixCommandContext {
  message: Message;
  args: string[];
  commandName: string;
}

export interface PrefixCommandDefinition {
  name: string;
  description: string;
  aliases?: string[];
  execute(context: PrefixCommandContext): Promise<void>;
}
