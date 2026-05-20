import { Events, type Client, type Interaction } from "discord.js";
import { replyWithActionResult, slashCommands } from "../commands";
import { isRetributeButtonCustomId, retributeService } from "../services";
import { logger } from "../utils";

export function registerInteractionHandler(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const command = slashCommands.get(interaction.commandName);
        const context = getInteractionLogContext(interaction, `/${interaction.commandName}`, "slash");

        if (!command) {
          logger.warn("Ignored unregistered slash command.", context);
          return;
        }

        logger.command(context);
        await command.execute(interaction);
        return;
      }

      if (interaction.isButton() && isRetributeButtonCustomId(interaction.customId)) {
        logger.command(getInteractionLogContext(interaction, "button:retribute", "button"));
        const result = await retributeService.execute(interaction);
        await replyWithActionResult(interaction, result);
      }
    } catch (error) {
      logger.error("Interaction failed.", {
        error,
        ...getInteractionFailureLogContext(interaction)
      });
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

function getInteractionLogContext(
  interaction: Interaction,
  commandName: string,
  commandType: "slash" | "button"
) {
  return {
    commandName,
    commandType,
    guildId: interaction.guildId,
    userId: interaction.user.id
  };
}

function getInteractionFailureLogContext(interaction: Interaction) {
  if (interaction.isChatInputCommand()) {
    return getInteractionLogContext(interaction, `/${interaction.commandName}`, "slash");
  }

  if (interaction.isButton()) {
    return getInteractionLogContext(
      interaction,
      isRetributeButtonCustomId(interaction.customId) ? "button:retribute" : "button:unknown",
      "button"
    );
  }

  return {
    commandName: "interaction:unknown",
    commandType: "system" as const,
    guildId: interaction.guildId,
    userId: interaction.user.id
  };
}
