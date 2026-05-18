import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { SlashCommandDefinition } from "../types";
import { buildHelpEmbed } from "./helpResponseAdapter";

export const helpCommand: SlashCommandDefinition = {
  name: "help",
  description: "Lista os comandos principais do MVP.",
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Lista os comandos principais do MVP."),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({ embeds: [buildHelpEmbed()], ephemeral: true });
  }
};
