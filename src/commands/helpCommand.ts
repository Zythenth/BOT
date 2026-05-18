import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { RP_ACTION_DEFINITIONS } from "../config";
import type { SlashCommandDefinition } from "../types";

export const helpCommand: SlashCommandDefinition = {
  name: "help",
  description: "Lista os comandos principais do MVP.",
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Lista os comandos principais do MVP."),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0xf2a7b8)
      .setTitle("Aurora - comandos do MVP")
      .addFields(
        {
          name: "Carinho",
          value: formatCommandsByCategory("carinho")
        },
        {
          name: "Apoio",
          value: formatCommandsByCategory("apoio")
        },
        {
          name: "Brincadeira",
          value: formatCommandsByCategory("brincadeira")
        },
        {
          name: "Afinidade",
          value: "`/afinidade`, `/rankafinidade`"
        },
        {
          name: "Ajuda",
          value: "`/help`"
        }
      )
      .setFooter({ text: "Comandos por prefixo e aliases entram em outra etapa." })
      .setTimestamp(new Date());

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};

function formatCommandsByCategory(category: string): string {
  return RP_ACTION_DEFINITIONS
    .filter((definition) => definition.category === category)
    .map((definition) => `\`/${definition.commandName}\``)
    .join(", ");
}
