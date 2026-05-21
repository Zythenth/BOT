import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
  type Message,
  type MessageReplyOptions
} from "discord.js";
import type { ActionResponseButton, ActionResult } from "../types";

type ActionInteraction = ChatInputCommandInteraction | ButtonInteraction;

export async function replyWithActionResult(
  interaction: ActionInteraction,
  result: ActionResult
): Promise<void> {
  const options = toActionReplyOptions(result);

  if (interaction.deferred) {
    await interaction.editReply(toEditReplyOptions(options));
    return;
  }

  if (interaction.replied) {
    await interaction.followUp(options);
    return;
  }

  await interaction.reply(options);
}

export async function replyToMessageWithActionResult(
  message: Message,
  result: ActionResult
): Promise<void> {
  await message.reply(toActionMessageReplyOptions(result));
}

export function toActionReplyOptions(result: ActionResult): InteractionReplyOptions {
  if (!result.ok) {
    return {
      content: result.message,
      ephemeral: result.ephemeral
    };
  }

  const embed = new EmbedBuilder()
    .setColor(0xf2a7b8)
    .setDescription(result.payload.embed.description)
    .addFields(
      {
        name: "Autor",
        value: result.payload.embed.authorLabel ?? `<@${result.actorUserId}>`,
        inline: true
      },
      {
        name: "Acao",
        value: result.payload.embed.actionLabel ?? `/${result.action}`,
        inline: true
      },
      {
        name: "Alvo",
        value: result.payload.embed.targetLabel ?? `<@${result.targetUserId}>`,
        inline: true
      }
    );

  if (result.payload.embed.imageUrl) {
    embed.setImage(result.payload.embed.imageUrl);
  }

  if (result.payload.embed.footer) {
    embed.setFooter({ text: result.payload.embed.footer });
  }

  if (result.payload.embed.timestamp) {
    embed.setTimestamp(result.payload.embed.timestamp);
  }

  const rows = buildActionRows(result.payload.components);
  const options: InteractionReplyOptions = {
    embeds: [embed]
  };

  if (result.payload.content) {
    options.content = result.payload.content;
  }

  if (rows.length > 0) {
    options.components = rows;
  }

  return options;
}

export function toActionMessageReplyOptions(result: ActionResult): MessageReplyOptions {
  if (!result.ok) {
    return {
      content: result.message
    };
  }

  const options = toActionReplyOptions(result);
  return {
    content: options.content,
    embeds: options.embeds,
    components: options.components
  };
}

function buildActionRows(
  components: readonly ActionResponseButton[]
): ActionRowBuilder<ButtonBuilder>[] {
  const buttons = components
    .filter((component) => component.type === "button")
    .map((component) => {
      const button = new ButtonBuilder()
        .setCustomId(component.customId)
        .setLabel(component.label)
        .setStyle(toDiscordButtonStyle(component.style))
        .setDisabled(component.disabled ?? false);

      if (component.emoji) {
        button.setEmoji(component.emoji);
      }

      return button;
    });

  if (buttons.length === 0) {
    return [];
  }

  return [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)];
}

function toDiscordButtonStyle(style: ActionResponseButton["style"]): ButtonStyle {
  const styles: Record<ActionResponseButton["style"], ButtonStyle> = {
    primary: ButtonStyle.Primary,
    secondary: ButtonStyle.Secondary,
    success: ButtonStyle.Success,
    danger: ButtonStyle.Danger
  };

  return styles[style];
}

function toEditReplyOptions(options: InteractionReplyOptions): InteractionEditReplyOptions {
  return {
    content: options.content,
    embeds: options.embeds,
    components: options.components
  };
}
