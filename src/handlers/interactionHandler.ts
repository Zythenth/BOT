import { Events, type Client, type Interaction } from "discord.js";
import { replyWithActionResult, slashCommands } from "../commands";
import { isRetributeButtonCustomId, retributeService } from "../services";
import { logger } from "../utils";

export function registerInteractionHandler(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const command = slashCommands.get(interaction.commandName);

        if (!command) {
          logger.warn(`Ignored unregistered slash command: /${interaction.commandName}`);
          return;
        }

        await command.execute(interaction);
        return;
      }

      if (interaction.isButton() && isRetributeButtonCustomId(interaction.customId)) {
        const result = await retributeService.execute(interaction);
        await replyWithActionResult(interaction, result);
      }
    } catch (error) {
      logger.error("Interaction failed.", error);
      await replyWithGenericInteractionError(interaction);
    }
  });
}

async function replyWithGenericInteractionError(interaction: Interaction): Promise<void> {
  if (!interaction.isRepliable()) {
    return;
  }

  if (interaction.replied || interaction.deferred) {
    await interaction.followUp({
      content: "Nao consegui concluir esta interacao agora.",
      ephemeral: true
    });
    return;
  }

  await interaction.reply({
    content: "Nao consegui concluir esta interacao agora.",
    ephemeral: true
  });
}
