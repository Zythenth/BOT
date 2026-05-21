import type { Message, User } from "discord.js";

const DISCORD_ID_PATTERN = /^\d{17,20}$/;
const USER_MENTION_PATTERN = /^<@!?(\d{17,20})>$/;
const MAX_CUSTOM_MESSAGE_LENGTH = 120;

export type PrefixTargetResolution =
  | {
      ok: true;
      user: User;
      customMessage?: string;
    }
  | {
      ok: false;
      message: string;
    };

export async function resolvePrefixTarget(
  message: Message,
  args: readonly string[]
): Promise<PrefixTargetResolution> {
  const targetToken = args[0];

  if (!targetToken) {
    return {
      ok: false,
      message: "Informe o alvo por mencao ou ID."
    };
  }

  const targetUserId = parseUserIdToken(targetToken);

  if (!targetUserId) {
    return {
      ok: false,
      message: "Use mencao ou ID do usuario como alvo."
    };
  }

  const mentionedUser = message.mentions.users.get(targetUserId);

  if (mentionedUser) {
    return {
      ok: true,
      user: mentionedUser,
      customMessage: sanitizeCustomMessage(args.slice(1))
    };
  }

  if (!message.guild) {
    return {
      ok: false,
      message: "Nao consegui confirmar esse usuario no servidor. Tente mencionar a pessoa."
    };
  }

  try {
    const member = await message.guild.members.fetch(targetUserId);

    return {
      ok: true,
      user: member.user,
      customMessage: sanitizeCustomMessage(args.slice(1))
    };
  } catch {
    return {
      ok: false,
      message: "Nao encontrei esse usuario no servidor."
    };
  }
}

export function parseUserIdToken(token: string): string | null {
  const mentionMatch = token.match(USER_MENTION_PATTERN);

  if (mentionMatch) {
    return mentionMatch[1];
  }

  if (DISCORD_ID_PATTERN.test(token)) {
    return token;
  }

  return null;
}

export function sanitizeCustomMessage(args: readonly string[]): string | undefined {
  const rawMessage = args.join(" ").trim();

  if (!rawMessage) {
    return undefined;
  }

  const normalizedMessage = rawMessage
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/@everyone/gi, "everyone")
    .replace(/@here/gi, "here")
    .replace(/<@!?\d{17,20}>/g, "[mencao]")
    .replace(/<@&\d{17,20}>/g, "[cargo]")
    .replace(/<#\d{17,20}>/g, "[canal]")
    .trim();

  if (!normalizedMessage) {
    return undefined;
  }

  return normalizedMessage.slice(0, MAX_CUSTOM_MESSAGE_LENGTH).trim();
}
