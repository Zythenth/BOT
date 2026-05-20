export interface ParsedPrefixCommand {
  commandName: string;
  args: string[];
  rawArgs: string;
  prefixUsed: string;
}

export function parsePrefixCommand(content: string, prefix: string): ParsedPrefixCommand | null {
  if (!prefix || !content.startsWith(prefix)) {
    return null;
  }

  return parseCommandBody(content.slice(prefix.length), prefix);
}

export function parseBotMentionPrefixCommand(
  content: string,
  botUserId: string | undefined
): ParsedPrefixCommand | null {
  if (!botUserId) {
    return null;
  }

  for (const mentionPrefix of [`<@${botUserId}>`, `<@!${botUserId}>`]) {
    if (!content.startsWith(mentionPrefix)) {
      continue;
    }

    const remainder = content.slice(mentionPrefix.length);

    if (remainder && !/^\s/.test(remainder)) {
      return null;
    }

    return parseCommandBody(remainder, `${mentionPrefix} `);
  }

  return null;
}

function parseCommandBody(rawBody: string, prefixUsed: string): ParsedPrefixCommand | null {
  const body = rawBody.trim();

  if (!body) {
    return null;
  }

  const firstSpaceIndex = body.search(/\s/);
  const rawCommandName = firstSpaceIndex === -1 ? body : body.slice(0, firstSpaceIndex);
  const rawArgs = firstSpaceIndex === -1 ? "" : body.slice(firstSpaceIndex).trim();

  if (!rawCommandName) {
    return null;
  }

  return {
    commandName: rawCommandName.toLowerCase(),
    args: rawArgs ? rawArgs.split(/\s+/) : [],
    rawArgs,
    prefixUsed
  };
}
