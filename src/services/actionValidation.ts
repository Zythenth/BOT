import type { ActionContext, ActionFailureCode, ActionResult, ActionUserContext } from "../types";

export function validateBaseActionContext(context: ActionContext): ActionResult | null {
  if (!context.guild?.id) {
    return failAction("dm_not_allowed", "Acoes de RP so podem ser usadas em servidores.");
  }

  if (!isValidUser(context.actor)) {
    return failAction("invalid_actor", "Nao consegui identificar quem executou a acao.");
  }

  if (!isValidUser(context.target)) {
    return failAction("invalid_target", "Escolha um alvo valido para esta acao.");
  }

  if (context.actor.id === context.botUser.id) {
    return failAction("bot_actor", "Bots nao podem iniciar acoes de RP.");
  }

  if (context.target.id === context.botUser.id) {
    return failAction("own_bot_target", "Nao posso ser o alvo dessa acao.");
  }

  if (context.actor.isBot) {
    return failAction("bot_actor", "Bots nao podem iniciar acoes de RP.");
  }

  if (context.target.isBot) {
    return failAction("bot_target", "O alvo da acao nao pode ser um bot.");
  }

  if (context.actor.id === context.target.id) {
    return failAction("self_target", "Voce precisa escolher outra pessoa para esta acao.");
  }

  if (context.permissions?.canSendMessages === false) {
    return failAction("missing_permission", "Nao tenho permissao para responder neste canal.");
  }

  if (context.permissions?.canEmbedLinks === false) {
    return failAction("missing_permission", "Nao tenho permissao para enviar embeds neste canal.");
  }

  return null;
}

export function failAction(code: ActionFailureCode, message: string): ActionResult {
  return {
    ok: false,
    code,
    message,
    ephemeral: true
  };
}

function isValidUser(user: ActionUserContext | null | undefined): user is ActionUserContext {
  return Boolean(user?.id);
}
