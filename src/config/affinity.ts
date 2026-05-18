import type { ActionAffinityMilestone, ActionCategory } from "../types";

export const DEFAULT_AFFINITY_MAX_POINTS = 1000;
export const DEFAULT_AFFINITY_PAIR_DAILY_POINTS = 25;
export const DEFAULT_AFFINITY_USER_DAILY_POINTS = 100;
export const DEFAULT_AFFINITY_USER_DAILY_SCORED_INTERACTIONS = 50;
export const DEFAULT_AFFINITY_USER_COOLDOWN_MS = 8 * 1000;
export const DEFAULT_AFFINITY_PAIR_ACTION_COOLDOWN_MS = 10 * 60 * 1000;
export const DEFAULT_AFFINITY_TIME_ZONE = "America/Sao_Paulo";

export const AFFINITY_CATEGORY_POINTS: Record<string, number> = {
  carinho_fofo: 2,
  romance_leve: 3,
  apoio_emocional: 3,
  brincadeira: 1,
  utilitario: 0,
  admin: 0,
  consulta: 0,
  neutro: 0,
  carinho: 2,
  romance: 3,
  apoio: 3
};

export const AFFINITY_MILESTONES: readonly ActionAffinityMilestone[] = [
  {
    key: "desconhecidos",
    name: "Desconhecidos",
    minPoints: 0
  },
  {
    key: "conhecidos",
    name: "Conhecidos",
    minPoints: 10
  },
  {
    key: "colegas",
    name: "Colegas",
    minPoints: 25
  },
  {
    key: "amigos",
    name: "Amigos",
    minPoints: 50
  },
  {
    key: "bons_amigos",
    name: "Bons Amigos",
    minPoints: 100
  },
  {
    key: "proximos",
    name: "Pr\u00f3ximos",
    minPoints: 200
  },
  {
    key: "laco_fofo",
    name: "La\u00e7o Fofo",
    minPoints: 350
  },
  {
    key: "laco_especial",
    name: "La\u00e7o Especial",
    minPoints: 500
  },
  {
    key: "inseparaveis",
    name: "Insepar\u00e1veis",
    minPoints: 750
  },
  {
    key: "laco_lendario",
    name: "La\u00e7o Lend\u00e1rio",
    minPoints: 1000
  }
];

export function getAffinityPointsForCategory(category: ActionCategory): number {
  return AFFINITY_CATEGORY_POINTS[category] ?? 0;
}

export function getAffinityMilestone(points: number): ActionAffinityMilestone {
  const normalizedPoints = Math.max(0, points);
  const milestone = [...AFFINITY_MILESTONES]
    .reverse()
    .find((candidate) => normalizedPoints >= candidate.minPoints);

  return milestone ?? AFFINITY_MILESTONES[0];
}
