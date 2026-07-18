import { Events, type Client, type Interaction } from "discord.js";
import { replyWithActionResult, slashCommands } from "../commands";
import type { AppConfig } from "../config";
import { guildAccessService, isRetributeButtonCustomId, retributeService } from "../services";
import { logger } from "../utils";

export function registerInteractionHandler(client: Client, config: AppConfig): void {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (!(await ensureAllowedGuildInteraction(interaction, config))) {
        return;
      }

      if (interaction.isAutocomplete()) {
        const command = slashCommands.get(interaction.commandName);
        const context = getInteractionLogContext(
          interaction,
          `/${interaction.commandName}`,
          "slash"
        );

        if (!command?.autocomplete) {
          logger.warn("Ignored autocomplete without handler.", context);
          return;
        }

        await command.autocomplete(interaction);
        return;
      }

      if (interaction.isChatInputCommand()) {
        const command = slashCommands.get(interaction.commandName);
        const context = getInteractionLogContext(
          interaction,
          `/${interaction.commandName}`,
          "slash"
        );

        if (!command) {
          logger.warn("Ignored unregistered slash command.", context);
          await interaction.reply({
            content:
              "Este comando esta desatualizado ou indisponivel. Sincronize os slash commands.",
            ephemeral: true
          });
          return;
        }

        logger.command(context);
        await command.execute(interaction);
        return;
      }

      if (interaction.isButton() && isRetributeButtonCustomId(interaction.customId)) {
        logger.command(getInteractionLogContext(interaction, "button:retribute", "button"));
        await interaction.deferReply({ ephemeral: true });
        const result = await retributeService.execute(interaction);
        await replyWithActionResult(interaction, result);
      }
    } catch (error) {
      logger.error("Interaction failed.", {
        error,
        ...getInteractionFailureLogContext(interaction)
      });
      try {
        await replyWithGenericInteractionError(interaction);
      } catch (replyError) {
        logger.error("Failed to send generic interaction error.", {
          error: replyError,
          ...getInteractionFailureLogContext(interaction)
        });
      }
    }
  });
}

async function ensureAllowedGuildInteraction(
  interaction: Interaction,
  config: AppConfig
): Promise<boolean> {
  if (
    !interaction.guildId ||
    guildAccessService.isGuildAllowed(interaction.guildId, config.discord.allowedGuildIds)
  ) {
    return true;
  }

  logger.warn("Ignored interaction from unauthorized guild.", {
    commandName: getInteractionFailureLogContext(interaction).commandName,
    commandType: getInteractionFailureLogContext(interaction).commandType,
    guildId: interaction.guildId,
    userId: interaction.user.id
  });

  if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
    await interaction.reply({
      content: "Este servidor nao esta autorizado a usar a Aurora.",
      ephemeral: true
    });
  }

  return false;
}

async function replyWithGenericInteractionError(interaction: Interaction): Promise<void> {
  if (!interaction.isRepliable()) {
    return;
  }

  if (interaction.deferred && !interaction.replied) {
    await interaction.editReply({
      content: "Nao consegui concluir esta interacao agora."
    });
    return;
  }

  if (interaction.replied) {
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
