import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { RP_ACTION_DEFINITIONS } from "../config/rpActions";
import type { GiphyGif, GiphyProviderService } from "../services/giphyProviderService";

type AuditMode = "sample" | "apply-review";
type AttemptMode = "specific" | "fallback";
type VisualClassification =
  | "anime_ok"
  | "fallback_generico_ok"
  | "ai_suspeito"
  | "nao_anime"
  | "acao_errada"
  | "conteudo_inadequado"
  | "inconclusivo";

interface SearchTermsByAction {
  [action: string]: string[] | undefined;
}

interface AuditArgs {
  mode: AuditMode;
  actions: string[];
  attempts: AttemptMode;
  samplesPerAttempt: number;
  manifestPath?: string;
  reviewPath?: string;
}

interface AuditManifest {
  runId: string;
  createdAt: string;
  attempts: AttemptMode;
  samples: AuditSample[];
}

interface AuditSample {
  sampleId: string;
  action: string;
  category: string;
  attempt: number;
  searchTerm: string;
  provider: "giphy";
  providerGifId: string;
  title?: string;
  pageUrl?: string;
  mediaUrl?: string;
  existingGifId?: string;
  metadataStatus: "candidate" | "rejected";
  motivo: string;
}

interface AuditReview {
  manifestPath?: string;
  classifications: Record<string, VisualClassification>;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const REPORT_PATH = path.join(DATA_DIR, "gif-audit-report.jsonl");
const STATE_PATH = path.join(DATA_DIR, "gif-audit-state.json");
const SEARCH_TERMS_PATH = path.join(DATA_DIR, "giphy-search-terms.json");
const GENERIC_AFFECTION_SEARCH_TERMS_KEY = "__generic_affection";
const MAX_GIPHY_REQUESTS_PER_HOUR = 90;
const EXTERNAL_CALL_DELAY_MS = 40_000;
const MAX_RUN_MS = 8 * 60 * 60 * 1000;
const PROVIDER_ERROR_LIMIT = 2;
const REVIEW_BLOCK_ACTOR = "gif-audit";

let prisma: PrismaClient;

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  await prisma?.$disconnect();
  process.exitCode = 1;
});

async function main(): Promise<void> {
  loadAuditEnv();
  ensureDataDir();
  prisma = new PrismaClient();

  const args = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();

  if (args.mode === "sample") {
    await runSampleMode(args, startedAt);
  } else {
    await runApplyReviewMode(args);
  }

  await prisma.$disconnect();
}

async function runSampleMode(args: AuditArgs, startedAt: number): Promise<void> {
  const searchTerms = loadSearchTerms();
  validateRomanceSearchTerms(searchTerms);

  const provider = await createAuditProvider();
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const manifest: AuditManifest = {
    runId,
    createdAt: new Date().toISOString(),
    attempts: args.attempts,
    samples: []
  };

  let providerErrors = 0;

  for (const action of args.actions) {
    const definition = RP_ACTION_DEFINITIONS.find((item) => item.action === action);

    if (!definition) {
      appendAuditReport({
        action,
        category: "unknown",
        searchTerm: "",
        tentativa: 0,
        gifId: null,
        providerGifId: null,
        title: null,
        pageUrl: null,
        status: "skipped",
        motivo: "acao desconhecida"
      });
      continue;
    }

    const terms = getAttemptTerms(searchTerms, action, args.attempts);

    for (const attempt of terms) {
      if (Date.now() - startedAt >= MAX_RUN_MS) {
        writeManifest(manifest, args.manifestPath);
        console.log(JSON.stringify(publicSummary(manifest, "max_run_reached")));
        return;
      }

      const snapshot = await provider.getQuotaSnapshot();

      if (snapshot.remaining <= 0) {
        await sleepUntil(snapshot.resetAt);
      }

      await waitForExternalCallSlot();

      const result = await provider.search({
        searchTerm: attempt.term,
        limit: 15
      });

      markExternalCall();

      if (result.status !== "ok") {
        providerErrors += 1;
        appendAuditReport({
          action,
          category: definition.category,
          searchTerm: attempt.term,
          tentativa: attempt.number,
          gifId: null,
          providerGifId: null,
          title: null,
          pageUrl: null,
          status: result.status,
          motivo: "busca GIPHY falhou"
        });

        if (providerErrors >= PROVIDER_ERROR_LIMIT) {
          throw new Error("Provider retornou erro repetido; auditoria interrompida.");
        }

        continue;
      }

      providerErrors = 0;

      const sampled = await pickSamples({
        action,
        category: definition.category,
        attemptNumber: attempt.number,
        attemptMode: args.attempts,
        searchTerm: attempt.term,
        gifs: result.gifs,
        samplesPerAttempt: args.samplesPerAttempt
      });

      for (const sample of sampled) {
        manifest.samples.push(sample);
        appendAuditReport({
          action: sample.action,
          category: sample.category,
          searchTerm: sample.searchTerm,
          tentativa: sample.attempt,
          gifId: sample.existingGifId ?? null,
          providerGifId: sample.providerGifId,
          title: sample.title ?? null,
          pageUrl: sample.pageUrl ?? null,
          status: `sampled_${sample.metadataStatus}`,
          motivo: sample.motivo
        });
      }
    }
  }

  writeManifest(manifest, args.manifestPath);
  console.log(JSON.stringify(publicSummary(manifest, "sampled")));
}

async function runApplyReviewMode(args: AuditArgs): Promise<void> {
  if (!args.reviewPath) {
    throw new Error("Informe --review para aplicar a revisao visual.");
  }

  const review = JSON.parse(readFileSync(path.resolve(args.reviewPath), "utf8")) as AuditReview;
  const manifestPath = path.resolve(review.manifestPath ?? args.manifestPath ?? "");

  if (!manifestPath || !existsSync(manifestPath)) {
    throw new Error("Manifesto da auditoria nao encontrado.");
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as AuditManifest;
  const changed: string[] = [];
  const badGifIds: string[] = [];
  const inconclusive: string[] = [];

  for (const sample of manifest.samples) {
    const classification = review.classifications[sample.sampleId];

    if (!classification) {
      continue;
    }

    const existingGif = await prisma.gif.findUnique({
      where: {
        provider_providerGifId: {
          provider: sample.provider,
          providerGifId: sample.providerGifId
        }
      }
    });
    const existingGifId = existingGif?.id ?? sample.existingGifId;
    const acceptable = isAcceptableClassification(manifest.attempts, classification);

    if (acceptable && sample.metadataStatus === "candidate") {
      if (existingGif?.status === "blocked") {
        appendAuditReport({
          action: sample.action,
          category: sample.category,
          searchTerm: sample.searchTerm,
          tentativa: sample.attempt,
          gifId: existingGif.id,
          providerGifId: sample.providerGifId,
          title: sample.title ?? null,
          pageUrl: sample.pageUrl ?? null,
          status: "manual_review",
          motivo: `visual ${classification}; GIF ja estava blocked`
        });
        continue;
      }

      if (!existingGif) {
        appendAuditReport({
          action: sample.action,
          category: sample.category,
          searchTerm: sample.searchTerm,
          tentativa: sample.attempt,
          gifId: null,
          providerGifId: sample.providerGifId,
          title: sample.title ?? null,
          pageUrl: sample.pageUrl ?? null,
          status: "visual_accepted_not_saved",
          motivo: `visual ${classification}; sem contexto de guild para salvar automaticamente`
        });
        continue;
      }

      const saved = await prisma.gif.update({
        where: { id: existingGif.id },
        data: {
          action: sample.action,
          category: sample.category,
          status: "approved",
          rating: "pg",
          searchTerm: sample.searchTerm,
          giphyPageUrl: sample.pageUrl
        }
      });

      changed.push(saved.id);
      appendAuditReport({
        action: sample.action,
        category: sample.category,
        searchTerm: sample.searchTerm,
        tentativa: sample.attempt,
        gifId: saved.id,
        providerGifId: sample.providerGifId,
        title: sample.title ?? null,
        pageUrl: sample.pageUrl ?? null,
        status: "approved_existing",
        motivo: `visual ${classification}`
      });
      continue;
    }

    if (classification === "inconclusivo") {
      inconclusive.push(sample.sampleId);
      appendAuditReport({
        action: sample.action,
        category: sample.category,
        searchTerm: sample.searchTerm,
        tentativa: sample.attempt,
        gifId: existingGifId ?? null,
        providerGifId: sample.providerGifId,
        title: sample.title ?? null,
        pageUrl: sample.pageUrl ?? null,
        status: "visual_inconclusive",
        motivo: "validacao visual inconclusiva"
      });
      continue;
    }

    if (isClearlyBadClassification(classification)) {
      if (existingGifId) {
        await prisma.gif.update({
          where: { id: existingGifId },
          data: {
            status: "blocked",
            blockedBy: REVIEW_BLOCK_ACTOR,
            notes: `Auditoria visual: ${classification}`
          }
        });
        badGifIds.push(existingGifId);
      }

      appendAuditReport({
        action: sample.action,
        category: sample.category,
        searchTerm: sample.searchTerm,
        tentativa: sample.attempt,
        gifId: existingGifId ?? null,
        providerGifId: sample.providerGifId,
        title: sample.title ?? null,
        pageUrl: sample.pageUrl ?? null,
        status: existingGifId ? "blocked" : "visual_rejected",
        motivo: `visual ${classification}`
      });
    }
  }

  console.log(JSON.stringify({
    status: "review_applied",
    approvedOrUpdated: changed.length,
    blocked: badGifIds.length,
    inconclusive: inconclusive.length,
    badGifIds,
    inconclusiveSampleIds: inconclusive
  }));
}

function loadAuditEnv(): void {
  const configuredPath = process.env.DOTENV_CONFIG_PATH;
  const auroraEnvPath = path.join(DATA_DIR, "aurora.env");

  if (configuredPath) {
    dotenv.config({ path: configuredPath, override: true });
  } else if (existsSync(auroraEnvPath)) {
    dotenv.config({ path: auroraEnvPath, override: true });
  } else {
    dotenv.config({ override: true });
  }
}

async function createAuditProvider(): Promise<GiphyProviderService> {
  const { createGiphyProviderService } = await import("../services/giphyProviderService");
  const requestedLimit = readInteger("GIPHY_REQUESTS_PER_HOUR", 100);

  return createGiphyProviderService({
    apiKey: process.env.GIPHY_API_KEY?.trim(),
    requestsPerHour: Math.min(requestedLimit, MAX_GIPHY_REQUESTS_PER_HOUR),
    rating: readGiphyRating(),
    lang: process.env.GIPHY_LANG?.trim() || "pt"
  });
}

function parseArgs(args: string[]): AuditArgs {
  const values = new Map<string, string>();

  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];

    if (!key?.startsWith("--")) {
      continue;
    }

    values.set(key.slice(2), args[index + 1] ?? "");
    index += 1;
  }

  const mode = readMode(values.get("mode") ?? "sample");
  const attempts = readAttemptMode(values.get("attempts") ?? "specific");
  const actions = (values.get("actions") ?? "all")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    mode,
    attempts,
    actions: actions.includes("all")
      ? RP_ACTION_DEFINITIONS.map((definition) => definition.action)
      : actions,
    samplesPerAttempt: readPositiveInteger(values.get("samples-per-attempt"), 1),
    manifestPath: values.get("manifest"),
    reviewPath: values.get("review")
  };
}

function readMode(value: string): AuditMode {
  if (value === "sample" || value === "apply-review") {
    return value;
  }

  throw new Error(`Modo invalido: ${value}`);
}

function readAttemptMode(value: string): AttemptMode {
  if (value === "specific" || value === "fallback") {
    return value;
  }

  throw new Error(`Tentativas invalidas: ${value}`);
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readInteger(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function readGiphyRating(): "g" | "pg" | "pg-13" | "r" {
  const allowNsfw = ["1", "true", "yes", "y", "on"].includes(
    process.env.ALLOW_NSFW?.trim().toLowerCase() ?? ""
  );
  const rating = process.env.GIPHY_RATING?.trim().toLowerCase() ?? "pg";

  if (!["g", "pg", "pg-13", "r"].includes(rating)) {
    return "pg";
  }

  if (!allowNsfw && rating === "r") {
    return "pg";
  }

  return rating as "g" | "pg" | "pg-13" | "r";
}

function loadSearchTerms(): SearchTermsByAction {
  return JSON.parse(readFileSync(SEARCH_TERMS_PATH, "utf8")) as SearchTermsByAction;
}

function validateRomanceSearchTerms(searchTerms: SearchTermsByAction): void {
  const kissTerms = searchTerms.kiss ?? [];
  const foreheadTerms = searchTerms.beijotesta ?? [];
  const cheekTerms = searchTerms.beijobochecha ?? [];

  if (kissTerms.some((term) => hasAny(term, ["forehead", "testa", "cheek", "bochecha"]))) {
    throw new Error("Termos de kiss misturam beijo na testa/bochecha.");
  }

  if (foreheadTerms.some((term) => hasAny(term, ["cheek", "bochecha"]))) {
    throw new Error("Termos de beijotesta misturam beijo na bochecha.");
  }

  if (cheekTerms.some((term) => hasAny(term, ["forehead", "testa"]))) {
    throw new Error("Termos de beijobochecha misturam beijo na testa.");
  }
}

function getAttemptTerms(
  searchTerms: SearchTermsByAction,
  action: string,
  attempts: AttemptMode
): Array<{ number: number; term: string }> {
  if (attempts === "fallback") {
    const genericTerms = searchTerms[GENERIC_AFFECTION_SEARCH_TERMS_KEY] ?? [];
    return genericTerms.slice(0, 1).map((term) => ({
      number: 4,
      term
    }));
  }

  return (searchTerms[action] ?? []).slice(0, 3).map((term, index) => ({
    number: index + 1,
    term
  }));
}

async function pickSamples(input: {
  action: string;
  category: string;
  attemptNumber: number;
  attemptMode: AttemptMode;
  searchTerm: string;
  gifs: GiphyGif[];
  samplesPerAttempt: number;
}): Promise<AuditSample[]> {
  const evaluated = input.gifs.map((gif) => evaluateGif(input.action, input.attemptMode, gif));
  const candidates = evaluated.filter((item) => item.metadataStatus === "candidate");
  const rejected = evaluated.filter((item) => item.metadataStatus === "rejected");
  const picked = (candidates.length > 0 ? candidates : rejected).slice(0, input.samplesPerAttempt);
  const samples: AuditSample[] = [];

  for (let index = 0; index < picked.length; index += 1) {
    const item = picked[index];
    const existingGif = await prisma.gif.findUnique({
      where: {
        provider_providerGifId: {
          provider: item.gif.provider,
          providerGifId: item.gif.providerGifId
        }
      }
    });

    samples.push({
      sampleId: [
        input.action,
        `t${input.attemptNumber}`,
        String(index + 1),
        Date.now().toString(36)
      ].join("-"),
      action: input.action,
      category: input.category,
      attempt: input.attemptNumber,
      searchTerm: input.searchTerm,
      provider: item.gif.provider,
      providerGifId: item.gif.providerGifId,
      title: item.gif.title,
      pageUrl: item.gif.pageUrl,
      mediaUrl: item.gif.mediaUrl,
      existingGifId: existingGif?.id,
      metadataStatus: item.metadataStatus,
      motivo: item.motivo
    });
  }

  if (samples.length === 0) {
    appendAuditReport({
      action: input.action,
      category: input.category,
      searchTerm: input.searchTerm,
      tentativa: input.attemptNumber,
      gifId: null,
      providerGifId: null,
      title: null,
      pageUrl: null,
      status: "empty_result",
      motivo: "GIPHY retornou zero resultados"
    });
  }

  return samples;
}

function evaluateGif(
  action: string,
  attemptMode: AttemptMode,
  gif: GiphyGif
): {
  gif: GiphyGif;
  metadataStatus: "candidate" | "rejected";
  motivo: string;
} {
  const searchableText = getSearchableGifText(gif);

  if (BLOCKED_RESULT_KEYWORDS.some((keyword) => includesNormalizedKeyword(searchableText, keyword))) {
    return {
      gif,
      metadataStatus: "rejected",
      motivo: "metadados indicam AI ou termo bloqueado"
    };
  }

  if (attemptMode === "fallback") {
    return {
      gif,
      metadataStatus: "candidate",
      motivo: "fallback generico sem termo bloqueado"
    };
  }

  if (!ANIME_RESULT_KEYWORDS.some((keyword) => includesNormalizedKeyword(searchableText, keyword))) {
    return {
      gif,
      metadataStatus: "rejected",
      motivo: "metadados nao indicam anime"
    };
  }

  const actionKeywords = ACTION_RESULT_KEYWORDS[action] ?? [action];

  if (!actionKeywords.some((keyword) => includesNormalizedKeyword(searchableText, keyword))) {
    return {
      gif,
      metadataStatus: "rejected",
      motivo: "metadados nao batem com a acao"
    };
  }

  return {
    gif,
    metadataStatus: "candidate",
    motivo: "metadados batem com anime e acao"
  };
}

function isAcceptableClassification(
  attemptMode: AttemptMode,
  classification: VisualClassification
): boolean {
  if (attemptMode === "fallback") {
    return classification === "fallback_generico_ok" || classification === "anime_ok";
  }

  return classification === "anime_ok";
}

function isClearlyBadClassification(classification: VisualClassification): boolean {
  return [
    "ai_suspeito",
    "nao_anime",
    "acao_errada",
    "conteudo_inadequado"
  ].includes(classification);
}

function writeManifest(manifest: AuditManifest, manifestPath?: string): void {
  const outputPath = path.resolve(manifestPath ?? path.join(DATA_DIR, `gif-audit-manifest-${manifest.runId}.json`));
  writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function appendAuditReport(record: Record<string, unknown>): void {
  appendFileSync(REPORT_PATH, `${JSON.stringify({
    auditedAt: new Date().toISOString(),
    ...record
  })}\n`, "utf8");
}

function publicSummary(manifest: AuditManifest, status: string): Record<string, unknown> {
  const byAction: Record<string, number> = {};

  for (const sample of manifest.samples) {
    byAction[sample.action] = (byAction[sample.action] ?? 0) + 1;
  }

  return {
    status,
    runId: manifest.runId,
    attempts: manifest.attempts,
    sampleCount: manifest.samples.length,
    byAction
  };
}

function ensureDataDir(): void {
  mkdirSync(DATA_DIR, { recursive: true });
}

async function waitForExternalCallSlot(): Promise<void> {
  const lastCallAt = readLastExternalCallAt();

  if (!lastCallAt) {
    return;
  }

  const elapsed = Date.now() - lastCallAt.getTime();

  if (elapsed < EXTERNAL_CALL_DELAY_MS) {
    await sleep(EXTERNAL_CALL_DELAY_MS - elapsed);
  }
}

function markExternalCall(): void {
  writeFileSync(STATE_PATH, `${JSON.stringify({
    lastExternalCallAt: new Date().toISOString()
  }, null, 2)}\n`, "utf8");
}

function readLastExternalCallAt(): Date | undefined {
  if (!existsSync(STATE_PATH)) {
    return undefined;
  }

  const raw = JSON.parse(readFileSync(STATE_PATH, "utf8")) as {
    lastExternalCallAt?: string;
  };

  return raw.lastExternalCallAt ? new Date(raw.lastExternalCallAt) : undefined;
}

async function sleepUntil(resetAt: Date): Promise<void> {
  const waitMs = resetAt.getTime() - Date.now() + 1_000;

  if (waitMs > 0) {
    await sleep(waitMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getSearchableGifText(gif: GiphyGif): string {
  return normalizeText([
    gif.title,
    gif.pageUrl,
    gif.mediaUrl
  ]
    .filter((value): value is string => Boolean(value))
    .join(" "));
}

function includesNormalizedKeyword(searchableText: string, keyword: string): boolean {
  return searchableText.includes(normalizeText(keyword));
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(value: string, keywords: readonly string[]): boolean {
  const normalized = normalizeText(value);
  return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
}

const ANIME_RESULT_KEYWORDS = [
  "anime",
  "manga",
  "crunchyroll",
  "funimation",
  "shoujo",
  "shojo",
  "shounen",
  "shonen",
  "naruto",
  "one-piece",
  "one piece",
  "bleach",
  "jujutsu",
  "demon-slayer",
  "demon slayer",
  "kimetsu",
  "haikyuu",
  "horimiya",
  "toradora",
  "clannad",
  "sailor-moon",
  "sailor moon",
  "fruits-basket",
  "fruits basket",
  "kimi-ni-todoke",
  "kimi ni todoke",
  "kaguya-sama",
  "kaguya sama",
  "maid-sama",
  "maid sama",
  "umamusume",
  "uma musume",
  "chibi",
  "spy-x-family",
  "spy x family",
  "violet-evergarden",
  "violet evergarden",
  "my-hero-academia",
  "my hero academia",
  "boku-no-hero",
  "boku no hero"
];

const BLOCKED_RESULT_KEYWORDS = [
  "ai generated",
  "ai-generated",
  "pixai",
  "stable diffusion",
  "midjourney",
  "novelai",
  "waifu diffusion",
  "gif by persona",
  "cat humor",
  "dog playing",
  "voting turn up",
  "jelly london",
  "best friends animal society"
];

const ACTION_RESULT_KEYWORDS: Record<string, readonly string[]> = {
  kiss: [
    "kiss",
    "kissing",
    "couple kiss",
    "romantic kiss",
    "selinho"
  ],
  beijotesta: [
    "forehead kiss",
    "kiss forehead",
    "kiss on forehead",
    "forehead peck",
    "forehead"
  ],
  beijobochecha: [
    "cheek kiss",
    "kiss cheek",
    "kiss on cheek",
    "cheek peck",
    "cheek"
  ],
  hug: [
    "hug",
    "hugs",
    "hugging",
    "embrace",
    "cuddle"
  ],
  cafune: [
    "headpat",
    "head pat",
    "pat",
    "hair pat"
  ],
  consolar: [
    "comfort",
    "comforting",
    "console",
    "consoling",
    "sad hug",
    "crying hug"
  ],
  proteger: [
    "protect",
    "protecting",
    "protective",
    "saving",
    "shield"
  ],
  morder: [
    "bite",
    "biting",
    "nibble",
    "chomp"
  ],
  cutucar: [
    "poke",
    "poking",
    "cheek poke"
  ]
};
