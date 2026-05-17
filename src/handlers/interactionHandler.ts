import { Events, type Client } from "discord.js";
import { slashCommands } from "../commands";
import { logger } from "../utils";

export function registerInteractionHandler(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = slashCommands.get(interaction.commandName);

    if (!command) {
      logger.warn(`Ignored unregistered slash command: /${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(`Slash command failed: /${interaction.commandName}`, error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "Nao consegui concluir este comando agora.",
          ephemeral: true
        });
        return;
      }

      await interaction.reply({
        content: "Nao consegui concluir este comando agora.",
        ephemeral: true
      });
    }
  });
}
