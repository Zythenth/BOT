import { GatewayIntentBits, SlashCommandBuilder } from "discord.js";
import { DEFAULT_PREFIX } from "../config";
import { prefixService } from "../services";
import type { SlashCommandDefinition } from "../types";

export const prefixStatusCommand: SlashCommandDefinition = {
  name: "prefixstatus",
  description: "Mostra diagnostico dos comandos por prefixo.",
  data: new SlashCommandBuilder()
    .setName("prefixstatus")
    .setDescription("Mostra diagnostico dos comandos por prefixo.")
    .setDMPermission(false),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "Use este comando em um servidor.",
        ephemeral: true
      });
      return;
    }

    const prefix = await prefixService.getPrefixForGuild(interaction.guildId, DEFAULT_PREFIX);
    const hasMessageContentIntent = interaction.client.options.intents.has(
      GatewayIntentBits.MessageContent
    );

    await interaction.reply({
      content: [
        `Prefixo salvo: \`${prefix}\``,
        `Message Content Intent no client: ${hasMessageContentIntent ? "sim" : "nao"}`,
        `Teste agora: \`${prefix}help\` e depois veja se aparece log de prefixo no console.`
      ].join("\n"),
      ephemeral: true
    });
  }
};
