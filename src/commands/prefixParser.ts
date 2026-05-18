export interface ParsedPrefixCommand {
  commandName: string;
  args: string[];
  rawArgs: string;
}

export function parsePrefixCommand(content: string, prefix: string): ParsedPrefixCommand | null {
  if (!prefix || !content.startsWith(prefix)) {
    return null;
  }

  const body = content.slice(prefix.length).trim();

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
    rawArgs
  };
}
