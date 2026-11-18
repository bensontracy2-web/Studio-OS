import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRIMARY_MODEL = "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-3.5-flash-lite";
const TTS_MODEL = "gemini-3.8-flash-tts";

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_PER_SESSION = 25;
const RATE_LIMIT_MAX_PER_IP = 75;

interface RateBucket {
  count: number;
  resetAt: number;
}

const sessionRateBuckets = new Map<string, RateBucket>();
const ipRateBuckets = new Map<string, RateBucket>();

function extractUserGeminiKey(req: Request): string {
  const raw = req.header("x-user-gemini-key");
  return typeof raw === "string" ? raw.trim() : "";
}

function getClientIp(req: Request): string {
  const fwd = req.header("x-forwarded-for");
  if (typeof fwd === "string" && fwd.trim()) {
    return fwd.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown-ip";
}

function getSessionBucketKey(req: Request): string {
  const sessionId = req.header("x-studio-session");
  const ip = getClientIp(req);
  const cleanSess =
    typeof sessionId === "string" && sessionId.trim()
      ? sessionId.trim().slice(0, 80)
      : "no-session";
  return `${ip}::${cleanSess}`;
}

function pruneExpiredBuckets(map: Map<string, RateBucket>, now: number): void {
  if (map.size < 200) return;
  for (const [k, b] of map.entries()) {
    if (b.resetAt <= now) {
      map.delete(k);
    }
  }
}

function getRemainingSessionQuota(req: Request): {
  remaining: number;
  limit: number;
  resetInSec: number;
} {
  const now = Date.now();
  const key = getSessionBucketKey(req);
  const bucket = sessionRateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    return {
      remaining: RATE_LIMIT_MAX_PER_SESSION,
      limit: RATE_LIMIT_MAX_PER_SESSION,
      resetInSec: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
    };
  }
  return {
    remaining: Math.max(0, RATE_LIMIT_MAX_PER_SESSION - bucket.count),
    limit: RATE_LIMIT_MAX_PER_SESSION,
    resetInSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

function checkServerKeyRateLimit(req: Request, res: Response): boolean {
  if (extractUserGeminiKey(req)) {
    return true;
  }

  const now = Date.now();
  pruneExpiredBuckets(sessionRateBuckets, now);
  pruneExpiredBuckets(ipRateBuckets, now);

  const sessKey = getSessionBucketKey(req);
  const ipKey = getClientIp(req);

  let sessBucket = sessionRateBuckets.get(sessKey);
  if (!sessBucket || sessBucket.resetAt <= now) {
    sessBucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    sessionRateBuckets.set(sessKey, sessBucket);
  }

  let ipBucket = ipRateBuckets.get(ipKey);
  if (!ipBucket || ipBucket.resetAt <= now) {
    ipBucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    ipRateBuckets.set(ipKey, ipBucket);
  }

  if (
    sessBucket.count >= RATE_LIMIT_MAX_PER_SESSION ||
    ipBucket.count >= RATE_LIMIT_MAX_PER_IP
  ) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((Math.max(sessBucket.resetAt, ipBucket.resetAt) - now) / 1000)
    );
    res.setHeader("Retry-After", String(retryAfterSec));
    res.status(429).json({
      error:
        "Shared server AI quota reached for this session (25 requests / 10 min). Wait a moment or add your own free Google AI Studio key in Security & Privacy Settings (shield icon) for unlimited personal requests.",
      code: "SERVER_KEY_RATE_LIMITED",
      retryAfterSec,
    });
    return false;
  }

  sessBucket.count += 1;
  ipBucket.count += 1;
  return true;
}

function hasConfiguredAiKey(userApiKey?: string): boolean {
  const cleanedUserKey = typeof userApiKey === "string" ? userApiKey.trim() : "";
  return Boolean(cleanedUserKey || process.env.GEMINI_API_KEY);
}

function createAiClient(userApiKey?: string): GoogleGenAI {
  const cleanedUserKey = typeof userApiKey === "string" ? userApiKey.trim() : "";
  const apiKey = cleanedUserKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment secrets.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function generateWithFreeTierFallback(params: {
  contents: string;
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: Record<string, unknown>;
  userApiKey?: string;
  preferredModel?: "primary" | "fast-lite";
}): Promise<{ text: string; modelUsed: string; usedFallback: boolean }> {
  const ai = createAiClient(params.userApiKey);
  const preferLite = params.preferredModel === "fast-lite";
  const firstModel = preferLite ? FALLBACK_MODEL : PRIMARY_MODEL;
  const secondModel = preferLite ? PRIMARY_MODEL : FALLBACK_MODEL;

  const buildConfig = (modelName: string) => {
    const config: Record<string, unknown> = {};
    if (params.systemInstruction) {
      config.systemInstruction = params.systemInstruction;
    }
    if (params.responseMimeType) {
      config.responseMimeType = params.responseMimeType;
    }
    if (params.responseSchema) {
      config.responseSchema = params.responseSchema;
    }
    if (modelName === PRIMARY_MODEL) {
      config.thinkingConfig = {
        thinkingLevel: ThinkingLevel.LOW,
      };
    }
    return config;
  };

  try {
    const primaryCall = ai.models.generateContent({
      model: firstModel,
      contents: params.contents,
      config: buildConfig(firstModel),
    });
    const response = await Promise.race([
      primaryCall,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${firstModel} timed out after 9s.`)), 9000)
      ),
    ]);
    const text = response.text ?? "";
    if (!text) {
      throw new Error(`Empty response from ${firstModel}.`);
    }
    return { text, modelUsed: firstModel, usedFallback: false };
  } catch (firstErr) {
    console.warn(
      `[Gemini] ${firstModel} failed, falling back to ${secondModel}:`,
      firstErr instanceof Error ? firstErr.message : String(firstErr)
    );

    const fallbackResponse = await ai.models.generateContent({
      model: secondModel,
      contents: params.contents,
      config: buildConfig(secondModel),
    });
    const text = fallbackResponse.text ?? "";
    if (!text) {
      throw new Error(`Empty response from ${secondModel}.`);
    }
    return { text, modelUsed: secondModel, usedFallback: true };
  }
}

const STREAM_META_START = "<<<STUDIO_META>>>";
const STREAM_META_END = "<<<END_META>>>";

function getTrailingPartialMatchLength(text: string, marker: string): number {
  const maxCheck = Math.min(text.length, marker.length - 1);
  for (let len = maxCheck; len > 0; len--) {
    if (text.endsWith(marker.slice(0, len))) {
      return len;
    }
  }
  return 0;
}

function sendSseEvent(res: Response, payload: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function streamTextWithMeta(params: {
  res: Response;
  userApiKey?: string;
  contents: string;
  systemInstruction: string;
  preferredModel?: "primary" | "fast-lite";
  onComplete: (visibleText: string, rawMetaJson: string | null, modelUsed: string, usedFallback: boolean) => Record<string, unknown>;
}): Promise<void> {
  const { res, userApiKey, contents, systemInstruction, preferredModel, onComplete } = params;
  const ai = createAiClient(userApiKey);
  const preferLite = preferredModel === "fast-lite";
  const firstModel = preferLite ? FALLBACK_MODEL : PRIMARY_MODEL;
  const secondModel = preferLite ? PRIMARY_MODEL : FALLBACK_MODEL;

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const runModelStream = async (modelName: string, firstChunkTimeoutMs?: number) => {
    const config: Record<string, unknown> = {
      systemInstruction,
    };
    if (modelName === PRIMARY_MODEL) {
      config.thinkingConfig = {
        thinkingLevel: ThinkingLevel.LOW,
      };
    }

    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let abortedBeforeFirstChunk = false;

    const clearFirstChunkTimer = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    };

    const firstChunkGuard = firstChunkTimeoutMs
      ? new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            abortedBeforeFirstChunk = true;
            reject(new Error(`${modelName} exceeded ${firstChunkTimeoutMs}ms first-chunk timeout`));
          }, firstChunkTimeoutMs);
        })
      : null;

    const streamWork = (async () => {
      const stream = await ai.models.generateContentStream({
        model: modelName,
        contents,
        config,
      });

      let pendingBuffer = "";
      let metaStarted = false;
      let visibleAccum = "";
      let metaAccum = "";
      let emittedAnyChunk = false;

      for await (const chunk of stream) {
        if (abortedBeforeFirstChunk) {
          throw new Error(`${modelName} aborted after first-chunk timeout`);
        }
        clearFirstChunkTimer();

        const piece = chunk.text ?? "";
        if (!piece) continue;

        if (metaStarted) {
          metaAccum += piece;
          continue;
        }

        pendingBuffer += piece;
        const startIdx = pendingBuffer.indexOf(STREAM_META_START);
        if (startIdx !== -1) {
          const beforeMeta = pendingBuffer.slice(0, startIdx);
          if (beforeMeta) {
            visibleAccum += beforeMeta;
            emittedAnyChunk = true;
            sendSseEvent(res, { type: "chunk", delta: beforeMeta });
          }
          metaStarted = true;
          metaAccum += pendingBuffer.slice(startIdx + STREAM_META_START.length);
          pendingBuffer = "";
        } else {
          const holdLen = getTrailingPartialMatchLength(pendingBuffer, STREAM_META_START);
          const safeOut = pendingBuffer.slice(0, pendingBuffer.length - holdLen);
          if (safeOut) {
            visibleAccum += safeOut;
            emittedAnyChunk = true;
            sendSseEvent(res, { type: "chunk", delta: safeOut });
          }
          pendingBuffer = pendingBuffer.slice(pendingBuffer.length - holdLen);
        }
      }

      clearFirstChunkTimer();
      if (abortedBeforeFirstChunk) {
        throw new Error(`${modelName} aborted after first-chunk timeout`);
      }

      if (!metaStarted && pendingBuffer) {
        visibleAccum += pendingBuffer;
        emittedAnyChunk = true;
        sendSseEvent(res, { type: "chunk", delta: pendingBuffer });
      }

      if (!emittedAnyChunk && !metaStarted && !visibleAccum.trim()) {
        throw new Error(`Empty stream from ${modelName}.`);
      }

      let rawMetaJson: string | null = null;
      if (metaStarted) {
        const endIdx = metaAccum.indexOf(STREAM_META_END);
        rawMetaJson = (endIdx !== -1 ? metaAccum.slice(0, endIdx) : metaAccum).trim();
      }

      return { visibleAccum: visibleAccum.trimEnd(), rawMetaJson, emittedAnyChunk };
    })();

    try {
      return firstChunkGuard ? await Promise.race([streamWork, firstChunkGuard]) : await streamWork;
    } finally {
      clearFirstChunkTimer();
    }
  };

  try {
    const first = await runModelStream(firstModel, 5500);
    const donePayload = onComplete(first.visibleAccum, first.rawMetaJson, firstModel, false);
    sendSseEvent(res, { type: "done", ...donePayload });
    res.end();
  } catch (primaryErr) {
    console.warn(
      `[Gemini Stream] ${firstModel} failed, falling back to ${secondModel}:`,
      primaryErr instanceof Error ? primaryErr.message : String(primaryErr)
    );
    try {
      const fallback = await runModelStream(secondModel);
      const donePayload = onComplete(fallback.visibleAccum, fallback.rawMetaJson, secondModel, true);
      sendSseEvent(res, { type: "done", ...donePayload });
      res.end();
    } catch (fallbackErr) {
      const formatted = formatApiError(fallbackErr, Boolean(userApiKey));
      sendSseEvent(res, {
        type: "error",
        error: formatted.message,
        code: formatted.code,
      });
      res.end();
    }
  }
}

function formatApiError(
  err: unknown,
  usingUserKey = false
): { status: number; message: string; code?: string } {
  const rawMsg = err instanceof Error ? err.message : "Unknown AI error";
  // Redact any accidental AIza... token substrings just in case an upstream message echoes anything
  const msg = rawMsg.replace(/AIza[0-9A-Za-z_-]{10,}/g, "[REDACTED_KEY]");
  if (msg.includes("GEMINI_API_KEY")) {
    return {
      status: 401,
      code: "MISSING_API_KEY",
      message:
        "No Gemini API key is configured yet. Add your own free Google AI Studio key in Security & Privacy Settings (shield icon) to chat with Bestie & VA.",
    };
  }
  if (
    msg.includes("403") ||
    msg.includes("PERMISSION_DENIED") ||
    msg.includes("API_KEY_INVALID") ||
    msg.includes("API key not valid")
  ) {
    return {
      status: 403,
      code: "INVALID_API_KEY",
      message: usingUserKey
        ? "Your Personal Gemini API Key was rejected. Please check or clear it in Security & Privacy Settings."
        : "Server Gemini API key was rejected. Please verify it in Settings > Secrets or add your own free key in Security & Privacy Settings.",
    };
  }
  if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      code: "RATE_LIMITED",
      message: usingUserKey
        ? "Your personal Gemini API key hit a temporary rate limit. Please wait a moment and try again."
        : "Free-tier rate limit reached temporarily. Please wait a moment or add your personal key in Security & Privacy Settings.",
    };
  }
  return { status: 500, message: msg };
}

function encodeMimeEmail(params: {
  to: string;
  subject: string;
  body: string;
}): string {
  const safeTo = params.to.replace(/[\r\n]/g, "").trim();
  const safeSubject = params.subject.replace(/[\r\n]/g, "").trim();
  const rawLines = [
    `To: ${safeTo}`,
    `Subject: ${safeSubject}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    "",
    params.body,
  ].join("\r\n");

  return Buffer.from(rawLines, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function extractHeader(
  headers: Array<{ name?: string; value?: string }> | undefined,
  name: string
): string {
  if (!Array.isArray(headers)) return "";
  const match = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return match?.value ?? "";
}

function decodeBase64Url(data: string | undefined): string {
  if (!data) return "";
  try {
    const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(normalized, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function extractPlainTextBody(payload: Record<string, unknown> | undefined): string {
  if (!payload) return "";
  const body = payload.body as { data?: string } | undefined;
  if (payload.mimeType === "text/plain" && body?.data) {
    return decodeBase64Url(body.data);
  }
  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(parts)) {
    for (const part of parts) {
      const text = extractPlainTextBody(part);
      if (text) return text;
    }
  }
  if (body?.data) {
    return decodeBase64Url(body.data).replace(/<[^>]+>/g, " ");
  }
  return "";
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "2mb" }));

  // Security & Quota Status (never returns any key material)
  app.get("/api/security/status", (req: Request, res: Response) => {
    const userKey = extractUserGeminiKey(req);
    const quota = getRemainingSessionQuota(req);
    res.json({
      serverKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
      usingPersonalKey: Boolean(userKey),
      sessionRemaining: quota.remaining,
      sessionLimit: quota.limit,
      windowMinutes: Math.round(RATE_LIMIT_WINDOW_MS / 60000),
      resetInSec: quota.resetInSec,
    });
  });

  // 1. Second Brain: Quick Capture auto-tagging, title & task extraction
  app.post("/api/brain/capture", async (req: Request, res: Response) => {
    const userApiKey = extractUserGeminiKey(req);
    if (!checkServerKeyRateLimit(req, res)) return;
    try {
      const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
      if (!content) {
        res.status(400).json({ error: "Please enter a thought, note, or link to capture." });
        return;
      }

      const result = await generateWithFreeTierFallback({
        userApiKey,
        preferredModel: "fast-lite",
        systemInstruction:
          "You are an intelligent Second Brain organizer for a solo creator and digital entrepreneur. " +
          "Given a raw thought, note, or URL, classify it into the best single workspace tag from: " +
          "'Personal', 'My content', 'Client work', 'Ideas', or 'Learning'. " +
          "Generate a concise, clear title (max 8 words), a crisp 1-2 sentence summary, " +
          "extract 0 to 4 concrete actionable tasks if implied (or empty array if purely informational), " +
          "and suggest the best social platform ('TikTok', 'YouTube', 'Instagram', or 'LinkedIn') if it were turned into content.",
        contents: `Capture input:\n"""\n${content}\n"""`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Concise 3-8 word title for the note." },
            tag: {
              type: Type.STRING,
              description: "Must be one of: Personal, My content, Client work, Ideas, Learning.",
            },
            summary: { type: Type.STRING, description: "Clean 1-2 sentence synthesis of the input." },
            tasks: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Actionable next-step tasks extracted from the capture.",
            },
            suggestedPlatform: {
              type: Type.STRING,
              description: "One of: TikTok, YouTube, Instagram, LinkedIn.",
            },
          },
          required: ["title", "tag", "summary", "tasks", "suggestedPlatform"],
        },
      });

      const parsed = JSON.parse(result.text);
      const allowedTags = ["Personal", "My content", "Client work", "Ideas", "Learning"];
      const normalizedTag = allowedTags.includes(parsed.tag) ? parsed.tag : "Ideas";
      const allowedPlatforms = ["TikTok", "YouTube", "Instagram", "LinkedIn"];
      const suggestedPlatform = allowedPlatforms.includes(parsed.suggestedPlatform)
        ? parsed.suggestedPlatform
        : "YouTube";

      res.json({
        title: String(parsed.title || "Captured Note").slice(0, 120),
        tag: normalizedTag,
        summary: String(parsed.summary || content.slice(0, 180)),
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks.map((t: unknown) => String(t)).filter(Boolean) : [],
        suggestedPlatform,
        modelUsed: result.modelUsed,
        usedFallback: result.usedFallback,
      });
    } catch (err) {
      const formatted = formatApiError(err, Boolean(userApiKey));
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 2. Second Brain: Ask My Brain Q&A grounded in saved notes and tasks
  app.post("/api/brain/ask", async (req: Request, res: Response) => {
    const userApiKey = extractUserGeminiKey(req);
    if (!checkServerKeyRateLimit(req, res)) return;
    try {
      const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
      const notes = Array.isArray(req.body?.notes) ? req.body.notes : [];
      const tasks = Array.isArray(req.body?.tasks) ? req.body.tasks : [];

      if (!question) {
        res.status(400).json({ error: "Please enter a question for your Second Brain." });
        return;
      }

      const notesContext = notes
        .slice(0, 40)
        .map(
          (n: { id: string; title: string; tag: string; summary: string; rawContent: string }) =>
            `[Note ID: ${n.id}] (${n.tag}) ${n.title}\nSummary: ${n.summary}\nContent: ${n.rawContent}`
        )
        .join("\n---\n");

      const tasksContext = tasks
        .slice(0, 40)
        .map(
          (t: { title: string; tag: string; completed: boolean }) =>
            `- [${t.completed ? "DONE" : "OPEN"}] (${t.tag}) ${t.title}`
        )
        .join("\n");

      const result = await generateWithFreeTierFallback({
        userApiKey,
        systemInstruction:
          "You are the user's Second Brain assistant. Answer their question using the provided saved notes and tasks whenever relevant. " +
          "Be concise, practical, and specific. Reference relevant note titles naturally, and return the exact IDs of notes you relied on in citedNoteIds.",
        contents: `Saved Notes:\n${notesContext || "(No saved notes yet)"}\n\nSaved Tasks:\n${tasksContext || "(No tasks yet)"}\n\nUser Question: ${question}`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: {
              type: Type.STRING,
              description: "Direct, helpful, grounded answer to the user's question.",
            },
            citedNoteIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Exact Note IDs from the context that informed the answer.",
            },
          },
          required: ["answer", "citedNoteIds"],
        },
      });

      const parsed = JSON.parse(result.text);
      res.json({
        answer: String(parsed.answer || "I couldn't find enough context to answer that yet."),
        citedNoteIds: Array.isArray(parsed.citedNoteIds)
          ? parsed.citedNoteIds.map((id: unknown) => String(id))
          : [],
        modelUsed: result.modelUsed,
        usedFallback: result.usedFallback,
      });
    } catch (err) {
      const formatted = formatApiError(err, Boolean(userApiKey));
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 2b. Second Brain: Streaming Q&A (SSE word-by-word response + citedNoteIds)
  app.post("/api/brain/ask/stream", async (req: Request, res: Response) => {
    const userApiKey = extractUserGeminiKey(req);
    if (!checkServerKeyRateLimit(req, res)) return;
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    const notes = Array.isArray(req.body?.notes) ? req.body.notes : [];
    const tasks = Array.isArray(req.body?.tasks) ? req.body.tasks : [];

    if (!question) {
      res.status(400).json({ error: "Please enter a question for your Second Brain." });
      return;
    }

    const notesContext = notes
      .slice(0, 40)
      .map(
        (n: { id: string; title: string; tag: string; summary: string; rawContent: string }) =>
          `[Note ID: ${n.id}] (${n.tag}) ${n.title}\nSummary: ${n.summary}\nContent: ${n.rawContent}`
      )
      .join("\n---\n");

    const tasksContext = tasks
      .slice(0, 40)
      .map(
        (t: { title: string; tag: string; completed: boolean }) =>
          `- [${t.completed ? "DONE" : "OPEN"}] (${t.tag}) ${t.title}`
      )
      .join("\n");

    try {
      await streamTextWithMeta({
        res,
        userApiKey,
        systemInstruction:
          "You are the user's Second Brain assistant. Answer their question using the provided saved notes and tasks whenever relevant. " +
          "Be concise, practical, and specific, and reference relevant note titles naturally.\n\n" +
          "OUTPUT FORMAT:\n" +
          "1. Write your conversational answer immediately in plain prose/markdown.\n" +
          "2. At the VERY END, on a new line, output the cited note IDs wrapped EXACTLY like this:\n" +
          `${STREAM_META_START}{"citedNoteIds":["id1","id2"]}${STREAM_META_END}\n` +
          "If no notes were cited, emit an empty array. Do NOT mention this metadata block in your answer.",
        contents: `Saved Notes:\n${notesContext || "(No saved notes yet)"}\n\nSaved Tasks:\n${tasksContext || "(No tasks yet)"}\n\nUser Question: ${question}`,
        onComplete: (visibleText, rawMetaJson, modelUsed, usedFallback) => {
          let citedNoteIds: string[] = [];
          if (rawMetaJson) {
            try {
              const cleaned = rawMetaJson.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
              const parsed = JSON.parse(cleaned) as { citedNoteIds?: unknown[] };
              if (Array.isArray(parsed.citedNoteIds)) {
                citedNoteIds = parsed.citedNoteIds.map((id) => String(id));
              }
            } catch {
              citedNoteIds = [];
            }
          }
          return {
            answer: visibleText || "I couldn't find enough context to answer that yet.",
            citedNoteIds,
            modelUsed,
            usedFallback,
          };
        },
      });
    } catch (err) {
      const formatted = formatApiError(err, Boolean(userApiKey));
      if (!res.headersSent) {
        res.status(formatted.status).json({ error: formatted.message });
      } else {
        sendSseEvent(res, { type: "error", error: formatted.message });
        res.end();
      }
    }
  });

  // 3. Edit Desk: Generate timecoded cut sheet & social captions for + New Brief
  app.post("/api/edit-desk/generate-brief", async (req: Request, res: Response) => {
    const userApiKey = extractUserGeminiKey(req);
    if (!checkServerKeyRateLimit(req, res)) return;
    try {
      const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";
      const platform = typeof req.body?.platform === "string" ? req.body.platform : "TikTok";
      const goal = typeof req.body?.goal === "string" ? req.body.goal.trim() : "";
      const duration = typeof req.body?.duration === "string" ? req.body.duration.trim() : "45-60s";
      const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";

      if (!topic) {
        res.status(400).json({ error: "Please provide a video topic or brief idea." });
        return;
      }

      const result = await generateWithFreeTierFallback({
        userApiKey,
        systemInstruction:
          "You are an expert short-form & long-form creator producer and video editor. " +
          "Create a production-ready video brief with a scroll-stopping hook, tight creative concept, " +
          "a timecoded cut sheet (4 to 7 sequential segments with exact timestamp ranges, B-roll/visual direction, on-screen text overlays, and audio/SFX/music cues), " +
          "and platform-native social captions tailored specifically to the target platform.",
        contents: `Target Platform: ${platform}\nTarget Duration: ${duration}\nTopic: ${topic}\nGoal/CTA: ${goal || "Engagement & saves"}\nExtra Notes: ${notes || "None"}`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Working production title (max 10 words)." },
            hook: { type: Type.STRING, description: "Opening 3-second spoken/visual hook." },
            concept: { type: Type.STRING, description: "1-2 sentence production angle." },
            cutSheet: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timestamp: { type: Type.STRING, description: "e.g. 0:00 - 0:04" },
                  bRoll: { type: Type.STRING, description: "Visual shot, framing, or B-roll direction." },
                  onScreenText: { type: Type.STRING, description: "Bold kinetic caption or overlay text." },
                  audioNotes: { type: Type.STRING, description: "Voiceover tone, SFX riser, or music cue." },
                },
                required: ["timestamp", "bRoll", "onScreenText", "audioNotes"],
              },
            },
            captions: {
              type: Type.OBJECT,
              properties: {
                primary: { type: Type.STRING, description: "Main platform-optimized social caption." },
                shortAlt: { type: Type.STRING, description: "Punchy 1-2 line alternative caption." },
                hashtags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "3 to 5 relevant hashtags without spaces.",
                },
              },
              required: ["primary", "shortAlt", "hashtags"],
            },
          },
          required: ["title", "hook", "concept", "cutSheet", "captions"],
        },
      });

      const parsed = JSON.parse(result.text);
      res.json({
        title: String(parsed.title || topic),
        hook: String(parsed.hook || ""),
        concept: String(parsed.concept || ""),
        cutSheet: Array.isArray(parsed.cutSheet) ? parsed.cutSheet : [],
        captions: {
          primary: String(parsed.captions?.primary || ""),
          shortAlt: String(parsed.captions?.shortAlt || ""),
          hashtags: Array.isArray(parsed.captions?.hashtags)
            ? parsed.captions.hashtags.map((h: unknown) => String(h))
            : [],
        },
        modelUsed: result.modelUsed,
        usedFallback: result.usedFallback,
      });
    } catch (err) {
      const formatted = formatApiError(err, Boolean(userApiKey));
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 4. Bestie & VA: Dual-personality companion chat + Memory Vault + Structured App-Control Actions + Email Drafting
  app.post("/api/bestie/chat", async (req: Request, res: Response) => {
    const userApiKey = extractUserGeminiKey(req);
    if (!hasConfiguredAiKey(userApiKey)) {
      res.status(401).json({
        error:
          "No Gemini API key is configured yet. Add your own free Google AI Studio key in Security & Privacy Settings (shield icon) to chat with Bestie & VA.",
        code: "MISSING_API_KEY",
      });
      return;
    }
    if (!checkServerKeyRateLimit(req, res)) return;
    try {
      const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
      const personality = req.body?.personality === "va" ? "va" : "bestie";
      const memories = Array.isArray(req.body?.memories) ? req.body.memories : [];
      const history = Array.isArray(req.body?.history) ? req.body.history : [];
      const studioContext = req.body?.studioContext ?? {};

      if (!message) {
        res.status(400).json({ error: "Please enter a message for Bestie & VA." });
        return;
      }

      const memoryText =
        memories.length > 0
          ? memories
              .map((m: { category: string; content: string }) => `- [${m.category}] ${m.content}`)
              .join("\n")
          : "(No personal memories saved yet)";

      const historyText = history
        .slice(-10)
        .map((h: { role: string; text: string }) => `${h.role === "user" ? "User" : "Assistant"}: ${h.text}`)
        .join("\n");

      const personalityInstruction =
        personality === "bestie"
          ? "PERSONALITY MODE: Best Friend & Hype Buddy. You are a real, warm, witty, emotionally intelligent best friend. Hold natural human conversations, answer questions thoughtfully, give tailored advice using the Memory Vault and user's roles, and celebrate real wins without ever sounding like a rigid checklist or bot."
          : "PERSONALITY MODE: Executive VA (Chief of Staff). You are crisp, sharp, warm, and proactive. Hold natural conversations, prioritize next steps, offer inbox/calendar leverage, and give clean executive advice tailored to the user's roles and Memory Vault.";

      const result = await generateWithFreeTierFallback({
        userApiKey,
        systemInstruction:
          `${personalityInstruction}\n\n` +
          `COMPANION MEMORY VAULT (personalize naturally around these saved details):\n${memoryText}\n\n` +
          `LIVE STUDIO CONTEXT:\n${JSON.stringify(studioContext)}\n\n` +
          `SMART DASHBOARD EXTRACTION RULES (CRITICAL — FOLLOW EXACTLY):\n` +
          `Only emit items in 'actions' when the user genuinely shares an actionable task, daily habit, financial amount, health log, note, or personal fact. For normal conversation, greetings, questions, advice requests, or venting, return actions: [].\n` +
          `1. TODAY'S ACTIVITIES / ONE-OFF TASKS -> ADD_TASK (NEVER ADD_HABIT!):\n` +
          `   - Examples: "I'm making a dress today", "finish my CS assignment", "film 2 TikToks", "reply to Sarah", "study chapter 4".\n` +
          `   - Emit { type:"ADD_TASK", title, tag:"Personal"|"My content"|"Client work"|"Ideas"|"Learning", label }.\n` +
          `   - NEVER turn today's activities or one-off plans into habits!\n` +
          `2. EXPLICIT DAILY ROUTINES ONLY -> ADD_HABIT:\n` +
          `   - ONLY emit ADD_HABIT when the user explicitly requests a recurring daily habit/routine (e.g., "remind me to drink water daily", "add habit morning stretch", "every day I want to read 10 pages").\n` +
          `   - Set title to a clean habit label and label to "Added habit: ...".\n` +
          `3. MONEY -> LOG_MONEY:\n` +
          `   - Examples: "I just made ₦20,000", "spent $15 on lunch" -> set amount, currency ("NGN"|"USD"), moneyType ("income"|"expense"), title, label.\n` +
          `4. HYDRATION / SLEEP / POSTS -> LOG_WATER, LOG_SLEEP, LOG_POST, TOGGLE_HABIT when explicitly mentioned.\n` +
          `5. NOTES & PERSONAL FACTS -> SAVE_NOTE (when asked to save a note/idea) or SAVE_MEMORY (lasting personal facts, preferences, or goals; set title & memoryCategory:"Personal"|"Goals"|"Projects"|"Skills").\n\n` +
          `EMAIL DRAFTING:\n` +
          `If the user asks you to draft, write, or send an email, set hasEmailDraft=true and populate emailDraft { to, subject, body }. Never claim the email is already sent; tell them to review & approve the inline card before sending.`,
        contents: `${historyText ? `Recent conversation:\n${historyText}\n\n` : ""}Latest user message: ${message}`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: "Natural conversational reply in the active personality voice.",
            },
            actions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    description:
                      "One of: LOG_MONEY, ADD_TASK, LOG_WATER, LOG_SLEEP, LOG_POST, TOGGLE_HABIT, ADD_HABIT, SAVE_NOTE, SAVE_MEMORY",
                  },
                  label: {
                    type: Type.STRING,
                    description: "Short confirmation badge text",
                  },
                  amount: { type: Type.NUMBER },
                  currency: { type: Type.STRING },
                  moneyType: { type: Type.STRING },
                  title: { type: Type.STRING },
                  tag: { type: Type.STRING },
                  delta: { type: Type.NUMBER },
                  habitQuery: { type: Type.STRING },
                  noteContent: { type: Type.STRING },
                  memoryCategory: { type: Type.STRING },
                },
                required: ["type", "label"],
              },
            },
            hasEmailDraft: { type: Type.BOOLEAN },
            emailDraft: {
              type: Type.OBJECT,
              properties: {
                to: { type: Type.STRING },
                subject: { type: Type.STRING },
                body: { type: Type.STRING },
              },
              required: ["to", "subject", "body"],
            },
          },
          required: ["reply", "actions", "hasEmailDraft"],
        },
      });

      const parsed = JSON.parse(result.text);
      res.json({
        reply: String(parsed.reply || "Got it!"),
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        hasEmailDraft: Boolean(parsed.hasEmailDraft),
        emailDraft: parsed.hasEmailDraft && parsed.emailDraft ? parsed.emailDraft : undefined,
        modelUsed: result.modelUsed,
        usedFallback: result.usedFallback,
      });
    } catch (err) {
      const formatted = formatApiError(err, Boolean(userApiKey));
      res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
    }
  });

  // 4a. Bestie & VA: Streaming Conversational AI Chat & Morning Greeting (SSE word-by-word)
  app.post("/api/bestie/chat/stream", async (req: Request, res: Response) => {
    const userApiKey = extractUserGeminiKey(req);
    if (!hasConfiguredAiKey(userApiKey)) {
      res.status(401).json({
        error:
          "No Gemini API key is configured yet. Add your own free Google AI Studio key in Security & Privacy Settings (shield icon) to chat with Bestie & VA.",
        code: "MISSING_API_KEY",
      });
      return;
    }
    if (!checkServerKeyRateLimit(req, res)) return;

    const isMorningGreeting = Boolean(req.body?.isMorningGreeting);
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const personality = req.body?.personality === "va" ? "va" : "bestie";
    const memories = Array.isArray(req.body?.memories) ? req.body.memories : [];
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    const studioContext = req.body?.studioContext ?? {};
    const scannedEmails = Array.isArray(req.body?.scannedEmails) ? req.body.scannedEmails : [];
    const calendarEvents = Array.isArray(req.body?.calendarEvents) ? req.body.calendarEvents : [];

    if (!message && !isMorningGreeting) {
      res.status(400).json({ error: "Please enter a message for Bestie & VA." });
      return;
    }

    const memoryText =
      memories.length > 0
        ? memories
            .map((m: { category: string; content: string }) => `- [${m.category}] ${m.content}`)
            .join("\n")
        : "(No personal memories saved yet)";

    const historyText = history
      .slice(-10)
      .map((h: { role: string; text: string }) => `${h.role === "user" ? "User" : "Assistant"}: ${h.text}`)
      .join("\n");

    const inboxText =
      scannedEmails.length > 0 || calendarEvents.length > 0
        ? `CONNECTED GOOGLE WORKSPACE HIGHLIGHTS:\n` +
          (scannedEmails.length > 0
            ? `Recent Emails:\n${scannedEmails
                .slice(0, 3)
                .map((e: { from?: string; subject?: string; priority?: string }) => `- [${e.priority || "Normal"}] ${e.from}: "${e.subject}"`)
                .join("\n")}\n`
            : "") +
          (calendarEvents.length > 0
            ? `Upcoming Calendar:\n${calendarEvents
                .slice(0, 3)
                .map((ev: { summary?: string; start?: string }) => `- ${ev.summary} (${ev.start})`)
                .join("\n")}`
            : "")
        : "";

    const personalityInstruction =
      personality === "bestie"
        ? "PERSONALITY MODE: Best Friend & Hype Buddy. You are a real, warm, witty, emotionally intelligent best friend. Respond naturally like a close human confidant—answering questions, giving thoughtful advice tailored to the user's roles and Memory Vault, hyping up wins, and holding a genuine back-and-forth conversation. NEVER run a numbered questionnaire or quiz."
        : "PERSONALITY MODE: Executive VA (Chief of Staff). You are crisp, sharp, warm, and proactive. Respond naturally like an elite chief of staff—answering questions, organizing priorities, leveraging inbox/calendar context, and turning concrete intentions into clean execution without sounding robotic.";

    const morningContextPrompt = isMorningGreeting
      ? `The user just opened StudioOS for their day! Write a warm, natural, conversational greeting (2-4 sentences) addressing them by name (if known in studioContext). Naturally weave in 1 relevant detail from their Companion Memory Vault, active roles, open tasks, or connected Gmail/Calendar highlights if present, and invite them to chat casually about what they're up to today. Do NOT run a multi-step quiz or numbered checklist, and emit NO actions.`
      : `${historyText ? `Recent conversation:\n${historyText}\n\n` : ""}Latest user message: ${message}`;

    try {
      await streamTextWithMeta({
        res,
        userApiKey,
        preferredModel: isMorningGreeting ? "fast-lite" : "primary",
        systemInstruction:
          `${personalityInstruction}\n\n` +
          `COMPANION MEMORY VAULT (always remember and personalize naturally around these facts):\n${memoryText}\n\n` +
          `LIVE STUDIO CONTEXT:\n${JSON.stringify(studioContext)}\n` +
          (inboxText ? `\n${inboxText}\n` : "") +
          `\nSMART DASHBOARD EXTRACTION RULES (CRITICAL — FOLLOW STRICTLY):\n` +
          `- First and foremost, write a great, natural, helpful conversational reply!\n` +
          `- For normal greetings, questions, advice requests, or small talk, do NOT force any actions (actions: []).\n` +
          `- TODAY'S ACTIVITIES & ONE-OFF TASKS -> ADD_TASK (NEVER ADD_HABIT!):\n` +
          `  Examples: "I'm making a dress today", "I need to finish my CS assignment", "editing a vlog later", "calling my supplier".\n` +
          `  Emit: { type:"ADD_TASK", label:"Added to Work & Deliverables: ...", title:"...", tag:"Personal"|"My content"|"Client work"|"Ideas"|"Learning" }.\n` +
          `  NEVER convert one-off activities or normal comma-separated thoughts into habits!\n` +
          `- EXPLICIT DAILY ROUTINES ONLY -> ADD_HABIT:\n` +
          `  ONLY emit ADD_HABIT when the user explicitly asks for a recurring daily routine/habit (e.g. "remind me to drink water daily", "add habit 20m walk", "every morning I want to stretch").\n` +
          `  Emit: { type:"ADD_HABIT", label:"Added habit: ...", title:"..." }.\n` +
          `- MONEY -> LOG_MONEY: When income/spending amounts are mentioned (e.g. "I just made ₦20,000", "spent $15 on coffee"), emit { type:"LOG_MONEY", label, amount, currency:"NGN"|"USD", moneyType:"income"|"expense", title }.\n` +
          `- WELLNESS / POSTS -> LOG_WATER, LOG_SLEEP, LOG_POST, TOGGLE_HABIT only when explicitly logged.\n` +
          `- NOTES / LASTING FACTS -> SAVE_NOTE (when saving an idea/note) or SAVE_MEMORY (lasting personal facts, projects, goals, or preferences: { type:"SAVE_MEMORY", label, title, memoryCategory:"Personal"|"Goals"|"Projects"|"Skills" }).\n\n` +
          `EMAIL DRAFTING:\n` +
          `If the user asks you to draft, write, or send an email, set hasEmailDraft=true and include emailDraft { to, subject, body }. Never claim the email is already sent; tell them to review & approve the inline card.\n\n` +
          `OUTPUT FORMAT (STRICT):\n` +
          `1. Write ONLY your natural conversational reply immediately.\n` +
          `2. ONLY if you extracted genuine actions OR an email draft, append at the VERY END on a new line:\n` +
          `${STREAM_META_START}{"actions":[...],"hasEmailDraft":false}${STREAM_META_END}\n` +
          `Do NOT wrap your main reply in JSON and do NOT mention the metadata marker.`,
        contents: morningContextPrompt,
        onComplete: (visibleText, rawMetaJson, modelUsed, usedFallback) => {
          let actions: unknown[] = [];
          let hasEmailDraft = false;
          let emailDraft: Record<string, string> | undefined = undefined;

          if (rawMetaJson && !isMorningGreeting) {
            try {
              const cleaned = rawMetaJson.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
              const parsed = JSON.parse(cleaned) as {
                actions?: unknown[];
                hasEmailDraft?: boolean;
                emailDraft?: { to?: string; subject?: string; body?: string };
              };
              actions = Array.isArray(parsed.actions) ? parsed.actions : [];
              hasEmailDraft = Boolean(parsed.hasEmailDraft);
              if (hasEmailDraft && parsed.emailDraft) {
                emailDraft = {
                  to: String(parsed.emailDraft.to || ""),
                  subject: String(parsed.emailDraft.subject || ""),
                  body: String(parsed.emailDraft.body || ""),
                };
              }
            } catch {
              // Ignore malformed trailing meta cleanly
            }
          }

          return {
            reply: visibleText || "Hey! How's your day going?",
            actions,
            hasEmailDraft,
            emailDraft,
            modelUsed,
            usedFallback,
          };
        },
      });
    } catch (err) {
      const formatted = formatApiError(err, Boolean(userApiKey));
      if (!res.headersSent) {
        res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
      } else {
        sendSseEvent(res, { type: "error", error: formatted.message, code: formatted.code });
        res.end();
      }
    }
  });

  // 4b. Retired 4-step questionnaire endpoint retained only as conversational forwarder if called
  app.post("/api/bestie/proactive-step", async (_req: Request, res: Response) => {
    res.status(410).json({
      error: "Daily check-ins now run through natural conversational AI on /api/bestie/chat/stream.",
    });
  });

  // 5. Bestie & VA: Voice Replies via gemini-3.8-flash-tts (unary WAV)
  app.post("/api/bestie/tts", async (req: Request, res: Response) => {
    const userApiKey = extractUserGeminiKey(req);
    if (!checkServerKeyRateLimit(req, res)) return;
    try {
      const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
      const personality = req.body?.personality === "va" ? "va" : "bestie";
      const targetLang = typeof req.body?.language === "string" ? req.body.language.trim() : "";

      if (!text) {
        res.status(400).json({ error: "No text provided for voice synthesis." });
        return;
      }

      const ai = createAiClient(userApiKey);
      const clipped = text.slice(0, 900);
      const voiceName = personality === "bestie" ? "Kore" : "Zephyr";
      const style = targetLang
        ? `Clear, natural native ${targetLang} pronunciation spoken warmly at a helpful learner pace`
        : personality === "bestie"
        ? "Warm, encouraging, conversational best friend with upbeat energy"
        : "Clear, poised, efficient executive assistant";

      const response = await ai.models.generateContent({
        model: TTS_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: clipped,
                speechMetadata: { style },
              },
            ],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        res.status(502).json({ error: "TTS audio stream was empty." });
        return;
      }

      res.json({
        audioBase64: base64Audio,
        mimeType: "audio/wav",
        modelUsed: TTS_MODEL,
      });
    } catch (err) {
      const formatted = formatApiError(err, Boolean(userApiKey));
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 6. Google Workspace: Scan Inbox & Calendar and summarize via Gemini
  app.post("/api/google/inbox-brief", async (req: Request, res: Response) => {
    const userApiKey = extractUserGeminiKey(req);
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Google account access token is required." });
        return;
      }

      const memories = Array.isArray(req.body?.memories) ? req.body.memories : [];

      // Fetch recent Gmail messages
      const listRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=7&q=in:inbox",
        { headers: { Authorization: authHeader } }
      );
      if (!listRes.ok) {
        const errBody = await listRes.text();
        res.status(listRes.status).json({
          error:
            listRes.status === 401
              ? "Google session expired. Please reconnect your Google Account."
              : `Gmail API error (${listRes.status}): ${errBody.slice(0, 180)}`,
        });
        return;
      }

      const listData = (await listRes.json()) as {
        messages?: Array<{ id: string; threadId: string }>;
      };
      const messageRefs = Array.isArray(listData.messages) ? listData.messages : [];

      const rawEmails = await Promise.all(
        messageRefs.slice(0, 7).map(async (ref) => {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${ref.id}?format=full`,
            { headers: { Authorization: authHeader } }
          );
          if (!msgRes.ok) return null;
          const msgJson = (await msgRes.json()) as {
            id: string;
            threadId: string;
            snippet?: string;
            payload?: {
              headers?: Array<{ name?: string; value?: string }>;
              mimeType?: string;
              body?: { data?: string };
              parts?: Array<Record<string, unknown>>;
            };
          };

          const headers = msgJson.payload?.headers;
          const from = extractHeader(headers, "From") || "Unknown sender";
          const subject = extractHeader(headers, "Subject") || "(No subject)";
          const date = extractHeader(headers, "Date") || "";
          const bodyText = extractPlainTextBody(
            msgJson.payload as Record<string, unknown> | undefined
          )
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 600);

          return {
            id: msgJson.id,
            threadId: msgJson.threadId,
            from,
            subject,
            date,
            snippet: msgJson.snippet || bodyText.slice(0, 140),
            bodyPreview: bodyText || msgJson.snippet || "",
          };
        })
      );

      const validEmails = rawEmails.filter(
        (e): e is NonNullable<typeof e> => e !== null
      );

      // Fetch upcoming Google Calendar events
      let calendarEvents: Array<{
        id: string;
        summary: string;
        start: string;
        end: string;
        location?: string;
      }> = [];
      try {
        const nowIso = new Date().toISOString();
        const calRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
            nowIso
          )}&maxResults=8&singleEvents=true&orderBy=startTime`,
          { headers: { Authorization: authHeader } }
        );
        if (calRes.ok) {
          const calJson = (await calRes.json()) as {
            items?: Array<{
              id?: string;
              summary?: string;
              location?: string;
              start?: { dateTime?: string; date?: string };
              end?: { dateTime?: string; date?: string };
            }>;
          };
          calendarEvents = (calJson.items ?? []).map((ev, idx) => ({
            id: ev.id || `ev-${idx}`,
            summary: ev.summary || "Untitled event",
            start: ev.start?.dateTime || ev.start?.date || "",
            end: ev.end?.dateTime || ev.end?.date || "",
            location: ev.location,
          }));
        }
      } catch (calErr) {
        console.warn("Calendar fetch warning:", calErr);
      }

      if (validEmails.length === 0 && calendarEvents.length === 0) {
        res.json({
          executiveSummary: "Your inbox has no recent messages and your upcoming calendar looks clear.",
          emails: [],
          calendarEvents: [],
          modelUsed: PRIMARY_MODEL,
        });
        return;
      }

      const memoryText = memories
        .map((m: { category: string; content: string }) => `- [${m.category}] ${m.content}`)
        .join("\n");

      if (!checkServerKeyRateLimit(req, res)) return;

      const aiResult = await generateWithFreeTierFallback({
        userApiKey,
        systemInstruction:
          "You are a sharp Executive VA briefing your creator/founder on their Gmail inbox and Google Calendar. " +
          "Use their Memory Vault context to prioritize what matters most. " +
          "For each email, assign priority ('High', 'Normal', or 'Low'), write a crisp 1-sentence summary, " +
          "suggest an actionable task if needed, and draft a concise, polite reply subject and reply body.",
        contents:
          `User Memory Vault:\n${memoryText || "None"}\n\n` +
          `Upcoming Calendar Events:\n${JSON.stringify(calendarEvents)}\n\n` +
          `Recent Inbox Emails:\n${JSON.stringify(validEmails)}`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: {
              type: Type.STRING,
              description: "2-4 sentence executive briefing covering top inbox priorities and schedule.",
            },
            emailBriefs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  priority: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  suggestedTask: { type: Type.STRING },
                  suggestedReplySubject: { type: Type.STRING },
                  suggestedReplyBody: { type: Type.STRING },
                },
                required: [
                  "id",
                  "priority",
                  "summary",
                  "suggestedTask",
                  "suggestedReplySubject",
                  "suggestedReplyBody",
                ],
              },
            },
          },
          required: ["executiveSummary", "emailBriefs"],
        },
      });

      const parsed = JSON.parse(aiResult.text) as {
        executiveSummary?: string;
        emailBriefs?: Array<{
          id: string;
          priority: string;
          summary: string;
          suggestedTask: string;
          suggestedReplySubject: string;
          suggestedReplyBody: string;
        }>;
      };

      const briefMap = new Map(
        (parsed.emailBriefs ?? []).map((b) => [b.id, b])
      );

      const mergedEmails = validEmails.map((em) => {
        const ai = briefMap.get(em.id);
        const priority =
          ai?.priority === "High" || ai?.priority === "Low" ? ai.priority : "Normal";
        return {
          id: em.id,
          threadId: em.threadId,
          from: em.from,
          subject: em.subject,
          date: em.date,
          snippet: em.snippet,
          priority,
          summary: ai?.summary || em.snippet,
          suggestedTask: ai?.suggestedTask || `Follow up: ${em.subject}`,
          suggestedReplySubject:
            ai?.suggestedReplySubject ||
            (em.subject.startsWith("Re:") ? em.subject : `Re: ${em.subject}`),
          suggestedReplyBody: ai?.suggestedReplyBody || "Thanks for reaching out—",
        };
      });

      res.json({
        executiveSummary:
          parsed.executiveSummary ||
          `Scanned ${mergedEmails.length} emails and ${calendarEvents.length} upcoming events.`,
        emails: mergedEmails,
        calendarEvents,
        modelUsed: aiResult.modelUsed,
      });
    } catch (err) {
      const formatted = formatApiError(err, Boolean(userApiKey));
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 7. Google Workspace: Save Gmail Draft (gmail.compose)
  app.post("/api/google/create-draft", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Google account access token is required." });
        return;
      }

      const to = typeof req.body?.to === "string" ? req.body.to.trim() : "";
      const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
      const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
      const threadId = typeof req.body?.threadId === "string" ? req.body.threadId : undefined;

      if (!to || !subject || !body) {
        res.status(400).json({ error: "Recipient, subject, and body are required." });
        return;
      }

      const raw = encodeMimeEmail({ to, subject, body });
      const payload: Record<string, unknown> = {
        message: threadId ? { raw, threadId } : { raw },
      };

      const gmailRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
        {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const gmailJson = await gmailRes.json();
      if (!gmailRes.ok) {
        res.status(gmailRes.status).json({
          error: gmailJson?.error?.message || "Failed to save Gmail draft.",
        });
        return;
      }

      res.json({ ok: true, draftId: gmailJson.id });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 8. Google Workspace: Send Email after user Review & Approve (gmail.send)
  app.post("/api/google/send-email", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Google account access token is required." });
        return;
      }

      const to = typeof req.body?.to === "string" ? req.body.to.trim() : "";
      const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
      const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
      const threadId = typeof req.body?.threadId === "string" ? req.body.threadId : undefined;

      if (!to || !subject || !body) {
        res.status(400).json({ error: "Recipient, subject, and body are required to send." });
        return;
      }

      const raw = encodeMimeEmail({ to, subject, body });
      const payload = threadId ? { raw, threadId } : { raw };

      const gmailRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const gmailJson = await gmailRes.json();
      if (!gmailRes.ok) {
        res.status(gmailRes.status).json({
          error: gmailJson?.error?.message || "Failed to send email via Gmail.",
        });
        return;
      }

      res.json({ ok: true, messageId: gmailJson.id });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 9. Academy: Context-Aware Startup & Tech Mentor Micro-Lesson Generator
  app.post("/api/academy/generate-lesson", async (req: Request, res: Response) => {
    const userApiKey = extractUserGeminiKey(req);
    if (!checkServerKeyRateLimit(req, res)) return;
    try {
      const track = typeof req.body?.track === "string" ? req.body.track : "Micro-Lesson";
      const customTopic = typeof req.body?.customTopic === "string" ? req.body.customTopic.trim() : "";
      const memories = Array.isArray(req.body?.memories) ? req.body.memories : [];
      const userRoles = Array.isArray(req.body?.userRoles)
        ? req.body.userRoles.map((r: unknown) => String(r).trim()).filter(Boolean)
        : [];

      const rolesText = userRoles.length > 0 ? userRoles.join(", ") : "General Creator / Learner";

      const memoryText =
        memories.length > 0
          ? memories
              .map((m: { category: string; content: string }) => `- [${m.category}] ${m.content}`)
              .join("\n")
          : "(No memories saved yet — focus on solo creator & tech founder fundamentals)";

      const result = await generateWithFreeTierFallback({
        userApiKey,
        systemInstruction:
          "You are a sharp Startup & Tech Mentor. Read the user's Active Roles and Companion Memory Vault and craft a focused 5-minute interactive lesson " +
          "tailored to every hat they wear as well as their real projects, goals, and skills. " +
          "Depending on the requested track ('Micro-Lesson', 'Startup Scenario', or 'Tech & Coding Drill'), " +
          "deliver 2 to 3 crisp teaching sections (concrete frameworks, tradeoffs, or code patterns) and 3 multiple-choice quiz questions with clear explanations.",
        contents:
          `Track: ${track}\n` +
          `User Active Roles: ${rolesText}\n` +
          `Custom Topic Focus: ${customTopic || "Choose the highest-leverage topic from their active roles & Memory Vault"}\n` +
          `Companion Memory Vault:\n${memoryText}`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            tailoredReason: {
              type: Type.STRING,
              description: "1 sentence explaining which Memory Vault fact/goal this lesson builds on.",
            },
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  heading: { type: Type.STRING },
                  body: { type: Type.STRING },
                },
                required: ["heading", "body"],
              },
            },
            quiz: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctIndex: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                },
                required: ["question", "options", "correctIndex", "explanation"],
              },
            },
            xpReward: { type: Type.INTEGER },
          },
          required: ["title", "tailoredReason", "sections", "quiz", "xpReward"],
        },
      });

      const parsed = JSON.parse(result.text);
      res.json({
        title: String(parsed.title || "5-Minute Founder & Tech Lesson"),
        track,
        estimatedMinutes: 5,
        tailoredReason: String(parsed.tailoredReason || "Tailored to your Memory Vault goals."),
        sections: Array.isArray(parsed.sections) ? parsed.sections : [],
        quiz: Array.isArray(parsed.quiz)
          ? parsed.quiz.map((q: Record<string, unknown>, idx: number) => ({
              id: `aq-${Date.now()}-${idx}`,
              question: String(q.question || ""),
              options: Array.isArray(q.options) ? q.options.map(String) : ["Option A", "Option B"],
              correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
              explanation: String(q.explanation || ""),
            }))
          : [],
        xpReward: typeof parsed.xpReward === "number" ? parsed.xpReward : 60,
        modelUsed: result.modelUsed,
      });
    } catch (err) {
      const formatted = formatApiError(err, Boolean(userApiKey));
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 10. Academy: Language Studio AI Roleplay
  app.post("/api/academy/language-roleplay", async (req: Request, res: Response) => {
    const userApiKey = extractUserGeminiKey(req);
    if (!checkServerKeyRateLimit(req, res)) return;
    try {
      const language = typeof req.body?.language === "string" ? req.body.language : "Spanish";
      const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
      const scenario = typeof req.body?.scenario === "string" ? req.body.scenario.trim() : "Coffee & Startup Chat";
      const history = Array.isArray(req.body?.history) ? req.body.history : [];

      if (!message) {
        res.status(400).json({ error: "Please enter a message in your target language or English." });
        return;
      }

      const historyText = history
        .slice(-6)
        .map((h: { role: string; text: string }) => `${h.role === "user" ? "Learner" : "Partner"}: ${h.text}`)
        .join("\n");

      const result = await generateWithFreeTierFallback({
        userApiKey,
        systemInstruction:
          `You are a friendly, natural native ${language} conversation partner in a "${scenario}" roleplay. ` +
          `Reply primarily in ${language} (1-3 natural sentences appropriate for an intermediate learner), ` +
          `provide a clear English translation, give 1 short practical grammar or phrasing tip, and extract 2-3 useful vocabulary items with phonetic pronunciation.`,
        contents: `${historyText ? `Conversation so far:\n${historyText}\n\n` : ""}Learner message: ${message}`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            replyTarget: { type: Type.STRING, description: `Natural reply in ${language}` },
            translation: { type: Type.STRING, description: "Natural English translation" },
            grammarTip: { type: Type.STRING, description: "Concise grammar or usage tip" },
            vocabulary: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  phrase: { type: Type.STRING },
                  meaning: { type: Type.STRING },
                  phonetic: { type: Type.STRING },
                },
                required: ["phrase", "meaning", "phonetic"],
              },
            },
          },
          required: ["replyTarget", "translation", "grammarTip", "vocabulary"],
        },
      });

      const parsed = JSON.parse(result.text);
      res.json({
        replyTarget: String(parsed.replyTarget || ""),
        translation: String(parsed.translation || ""),
        grammarTip: String(parsed.grammarTip || ""),
        vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
        modelUsed: result.modelUsed,
      });
    } catch (err) {
      const formatted = formatApiError(err, Boolean(userApiKey));
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 10b. Academy: Guided Duolingo-Style Interactive Language Lesson Generator
  app.post("/api/academy/language-lesson", async (req: Request, res: Response) => {
    const userApiKey = extractUserGeminiKey(req);
    if (!checkServerKeyRateLimit(req, res)) return;
    try {
      const language = typeof req.body?.language === "string" ? req.body.language.trim() : "Spanish";
      const unitId = typeof req.body?.unitId === "string" ? req.body.unitId.trim() : "u1";
      const unitTitle = typeof req.body?.unitTitle === "string" ? req.body.unitTitle.trim() : "Greetings & Essentials";
      const lessonTitle = typeof req.body?.lessonTitle === "string" ? req.body.lessonTitle.trim() : "First Hello & Introductions";
      const levelLabel = typeof req.body?.levelLabel === "string" ? req.body.levelLabel.trim() : "Beginner · A1";
      const userRoles = Array.isArray(req.body?.userRoles)
        ? req.body.userRoles.map((r: unknown) => String(r).trim()).filter(Boolean)
        : [];
      const rolesContext = userRoles.length > 0 ? userRoles.join(", ") : "Creator & Lifelong Learner";

      const result = await generateWithFreeTierFallback({
        userApiKey,
        systemInstruction:
          `You are an encouraging, structured language tutor designing a Duolingo-style interactive micro-lesson in ${language}. ` +
          `Teach first, then test! Output exactly 7 bite-sized interactive steps in strict JSON matching the schema:\n` +
          `1. type="intro": Introduce core ${language} phrase #1 (with phonetic guide, English meaning, concise culturalTip, exampleSentence, exampleTranslation).\n` +
          `2. type="intro": Introduce core ${language} phrase #2 (related to "${lessonTitle}").\n` +
          `3. type="multiple-choice" (mode="translate"): Test phrase #1 or #2 with 4 short distinct options (1 correct, 3 plausible distractors).\n` +
          `4. type="intro": Introduce a 3rd useful phrase or full natural expression combining this lesson's vocab.\n` +
          `5. type="tile-builder": Sentence assembly puzzle WITHOUT typing! Provide a short targetPhrase in ${language} (3 to 6 words/tokens), exact ordered correctTokens array (each word/token clean and tap-friendly), englishMeaning, prompt like "Tap the tiles to build: '...'", and 2 to 3 plausible distractorTokens.\n` +
          `6. type="multiple-choice" (mode="listening"): Listening quiz where the learner taps Listen to hear targetPhrase and chooses what it means from 4 English options.\n` +
          `7. type="match-pairs": Exactly 4 pairs ({ target, english, phonetic }) reviewing the 4 key words/phrases taught in this lesson.\n` +
          `Rules: For Yoruba use proper diacritics/tonal marks and helpful tone tips; for Japanese include natural Japanese plus clear romaji in phonetic; keep every option concise and natural.`,
        contents:
          `Target Language: ${language}\n` +
          `Unit: ${unitTitle} (${levelLabel})\n` +
          `Lesson: ${lessonTitle}\n` +
          `Learner Context: ${rolesContext}`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    description: "One of: intro, multiple-choice, tile-builder, match-pairs",
                  },
                  phrase: { type: Type.STRING },
                  phonetic: { type: Type.STRING },
                  meaning: { type: Type.STRING },
                  culturalTip: { type: Type.STRING },
                  exampleSentence: { type: Type.STRING },
                  exampleTranslation: { type: Type.STRING },
                  mode: { type: Type.STRING, description: "translate or listening (for multiple-choice)" },
                  prompt: { type: Type.STRING },
                  targetPhrase: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctIndex: { type: Type.INTEGER },
                  englishMeaning: { type: Type.STRING },
                  correctTokens: { type: Type.ARRAY, items: { type: Type.STRING } },
                  distractorTokens: { type: Type.ARRAY, items: { type: Type.STRING } },
                  pairs: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        target: { type: Type.STRING },
                        english: { type: Type.STRING },
                        phonetic: { type: Type.STRING },
                      },
                      required: ["target", "english"],
                    },
                  },
                  explanation: { type: Type.STRING },
                },
                required: ["type"],
              },
            },
            xpBonus: { type: Type.INTEGER },
          },
          required: ["steps", "xpBonus"],
        },
      });

      const parsed = JSON.parse(result.text) as {
        steps?: Array<Record<string, unknown>>;
        xpBonus?: number;
      };

      const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
      const normalizedSteps = rawSteps
        .map((s, idx) => {
          const id = `gls-${Date.now()}-${idx}`;
          const stepType = String(s.type || "").trim();

          if (stepType === "intro") {
            const phrase = String(s.phrase || s.targetPhrase || "").trim();
            const meaning = String(s.meaning || s.englishMeaning || "").trim();
            if (phrase && meaning) {
              return {
                id,
                type: "intro" as const,
                phrase,
                phonetic: String(s.phonetic || phrase),
                meaning,
                culturalTip: String(
                  s.culturalTip ||
                    s.explanation ||
                    "Listen to the natural rhythm and repeat aloud once."
                ),
                exampleSentence: s.exampleSentence ? String(s.exampleSentence) : undefined,
                exampleTranslation: s.exampleTranslation
                  ? String(s.exampleTranslation)
                  : undefined,
              };
            }
          }

          if (
            stepType === "multiple-choice" &&
            Array.isArray(s.options) &&
            s.options.length >= 2
          ) {
            const opts = s.options.slice(0, 4).map(String);
            const rawIdx = typeof s.correctIndex === "number" ? s.correctIndex : 0;
            const correctIndex = Math.max(0, Math.min(opts.length - 1, rawIdx));
            const rawTarget = String(s.targetPhrase || s.phrase || "").trim();
            const quotedMatch = String(s.prompt || "").match(/['"]([^'"]+)['"]/);
            const targetPhrase = rawTarget || (quotedMatch ? quotedMatch[1] : "");
            return {
              id,
              type: "multiple-choice" as const,
              mode: s.mode === "listening" ? ("listening" as const) : ("translate" as const),
              prompt: String(
                s.prompt ||
                  (s.mode === "listening"
                    ? "Tap Listen, then choose what you hear:"
                    : `What does "${targetPhrase}" mean?`)
              ),
              targetPhrase,
              phonetic: s.phonetic ? String(s.phonetic) : undefined,
              options: opts,
              correctIndex,
              explanation: String(
                s.explanation || `The correct answer is "${opts[correctIndex]}".`
              ),
            };
          }

          if (
            stepType === "tile-builder" &&
            Array.isArray(s.correctTokens) &&
            s.correctTokens.length >= 2
          ) {
            const correctTokens = s.correctTokens.map(String).filter(Boolean);
            const distractorTokens = Array.isArray(s.distractorTokens)
              ? s.distractorTokens.map(String).filter(Boolean).slice(0, 4)
              : [];
            return {
              id,
              type: "tile-builder" as const,
              prompt: String(s.prompt || "Tap the word tiles in order:"),
              englishMeaning: String(s.englishMeaning || ""),
              targetPhrase: String(s.targetPhrase || correctTokens.join(" ")),
              correctTokens,
              distractorTokens,
              explanation: String(
                s.explanation || `Correct order: "${correctTokens.join(" ")}"`
              ),
            };
          }

          if (
            stepType === "match-pairs" &&
            Array.isArray(s.pairs) &&
            s.pairs.length >= 2
          ) {
            const pairs = s.pairs.slice(0, 4).map((p, pIdx) => {
              const pairObj = p as Record<string, unknown>;
              return {
                id: `${id}-p-${pIdx}`,
                target: String(pairObj.target || ""),
                english: String(pairObj.english || ""),
                phonetic: pairObj.phonetic ? String(pairObj.phonetic) : undefined,
              };
            }).filter((p) => p.target && p.english);

            if (pairs.length >= 2) {
              return {
                id,
                type: "match-pairs" as const,
                prompt: String(s.prompt || "Tap matching pairs across the columns:"),
                pairs,
                explanation: String(
                  s.explanation || "Great matching! Connecting sounds with meanings locks vocab in faster."
                ),
              };
            }
          }

          return null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      if (normalizedSteps.length < 4) {
        res.status(502).json({ error: "Generated lesson steps were incomplete. Try again." });
        return;
      }

      res.json({
        lesson: {
          id: `gll-${unitId}-${Date.now()}`,
          language,
          unitId,
          unitTitle,
          lessonTitle,
          levelLabel,
          steps: normalizedSteps,
          xpBonus: typeof parsed.xpBonus === "number" ? parsed.xpBonus : 25,
          source: "gemini",
          createdAt: new Date().toISOString(),
        },
        modelUsed: result.modelUsed,
      });
    } catch (err) {
      const formatted = formatApiError(err, Boolean(userApiKey));
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 11. Free Media Studio: Split Script into Timed Kinetic Scenes + Veo/CapCut B-roll Prompts
  app.post("/api/media/split-script", async (req: Request, res: Response) => {
    const userApiKey = extractUserGeminiKey(req);
    if (!checkServerKeyRateLimit(req, res)) return;
    try {
      const script = typeof req.body?.script === "string" ? req.body.script.trim() : "";
      const aspectRatio = req.body?.aspectRatio === "16:9" ? "16:9" : "9:16";

      if (!script) {
        res.status(400).json({ error: "Please enter a script to split into scenes." });
        return;
      }

      const framingNote =
        aspectRatio === "9:16"
          ? "vertical 9:16 portrait framing (mobile Reels/TikTok/Shorts composition)"
          : "horizontal 16:9 widescreen cinematic framing";

      const result = await generateWithFreeTierFallback({
        userApiKey,
        systemInstruction:
          `You are an elite kinetic-typography video editor and Google Flow / Veo 3 director creating a ${aspectRatio} short-form video. ` +
          "Split the user's script into 3 to 7 punchy timed scenes (each 2.0 to 4.0 seconds). " +
          "For each scene, return:\n" +
          "- text: exact on-screen caption line\n" +
          "- emphasisWord: 1-2 word badge highlight\n" +
          "- durationSec: scene length in seconds (2.0 to 4.0)\n" +
          "- bRollCue: concise 3-6 word visual summary\n" +
          `- veoPrompt: a rich, copy-paste-ready Google Flow / Veo 3 video generation prompt (2-3 vivid sentences) specifying realistic human subject(s), natural expressions/wardrobe/body language, exact camera angle & subtle movement (e.g. eye-level medium close-up, slow handheld push-in), natural lighting (e.g. soft golden window key light, shallow depth of field), ${framingNote}, and natural spoken dialogue or ambient studio audio cues matching the scene text.`,
        contents: `Script:\n"""\n${script}\n"""`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  emphasisWord: { type: Type.STRING },
                  durationSec: { type: Type.NUMBER },
                  bRollCue: { type: Type.STRING },
                  veoPrompt: {
                    type: Type.STRING,
                    description:
                      "Rich Google Flow / Veo 3 prompt with human subject, camera angle, lighting, aspect-ratio framing, and audio/dialogue cue.",
                  },
                },
                required: ["text", "emphasisWord", "durationSec", "bRollCue", "veoPrompt"],
              },
            },
          },
          required: ["scenes"],
        },
      });

      const parsed = JSON.parse(result.text);
      res.json({
        scenes: Array.isArray(parsed.scenes) ? parsed.scenes : [],
        modelUsed: result.modelUsed,
      });
    } catch (err) {
      const formatted = formatApiError(err, Boolean(userApiKey));
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 11b. Free Media Studio: Reel Voiceover Narration via gemini-3.8-flash-tts (unary WAV)
  app.post("/api/media/voiceover", async (req: Request, res: Response) => {
    const userApiKey = extractUserGeminiKey(req);
    if (!checkServerKeyRateLimit(req, res)) return;
    try {
      const script = typeof req.body?.script === "string" ? req.body.script.trim() : "";
      const requestedVoice = typeof req.body?.voiceName === "string" ? req.body.voiceName.trim() : "Kore";
      const allowedVoices = ["Kore", "Puck", "Zephyr", "Charon", "Fenrir"];
      const voiceName = allowedVoices.includes(requestedVoice) ? requestedVoice : "Kore";

      if (!script) {
        res.status(400).json({ error: "Please provide script or scene text to narrate." });
        return;
      }

      const ai = createAiClient(userApiKey);
      const clipped = script.slice(0, 2200);
      const styleMap: Record<string, string> = {
        Kore: "Warm, engaging, natural short-form creator voiceover with crisp pacing",
        Puck: "Upbeat, energetic social reel host voiceover with clear emphasis",
        Zephyr: "Poised, clear, modern editorial narrator",
        Charon: "Calm, confident, grounded storytelling voiceover",
        Fenrir: "Bold, punchy documentary-style narrator",
      };

      const response = await ai.models.generateContent({
        model: TTS_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: clipped,
                speechMetadata: {
                  style: styleMap[voiceName] || styleMap.Kore,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        res.status(502).json({ error: "Voiceover audio output was empty." });
        return;
      }

      res.json({
        audioBase64: base64Audio,
        mimeType: "audio/wav",
        modelUsed: TTS_MODEL,
      });
    } catch (err) {
      const formatted = formatApiError(err, Boolean(userApiKey));
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 12. Cozy Game Room: Generate AI Quiz from Second Brain Notes or Academy Lessons
  app.post("/api/gameroom/generate-quiz", async (req: Request, res: Response) => {
    const userApiKey = extractUserGeminiKey(req);
    if (!checkServerKeyRateLimit(req, res)) return;
    try {
      const sourceType = req.body?.sourceType === "academy" ? "academy" : "brain";
      const notes = Array.isArray(req.body?.notes) ? req.body.notes : [];
      const lessons = Array.isArray(req.body?.lessons) ? req.body.lessons : [];

      const contextText =
        sourceType === "brain"
          ? notes
              .slice(0, 15)
              .map((n: { title: string; summary: string; rawContent: string }) =>
                `- ${n.title}: ${n.summary || n.rawContent}`
              )
              .join("\n")
          : lessons
              .slice(0, 10)
              .map((l: { title: string; sections?: Array<{ heading: string; body: string }> }) =>
                `- ${l.title}: ${(l.sections ?? []).map((s) => `${s.heading}: ${s.body}`).join(" ")}`
              )
              .join("\n");

      const result = await generateWithFreeTierFallback({
        userApiKey,
        systemInstruction:
          "Create a fun, crisp 5-question multiple-choice quiz based strictly on the provided user knowledge context. " +
          "Each question must have 3 plausible options, a valid correctIndex (0-2), and a 1-sentence explanation.",
        contents: `Source Type: ${sourceType}\nKnowledge Context:\n${contextText || "Creator productivity, short-form hooks, and startup systems."}`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctIndex: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                },
                required: ["question", "options", "correctIndex", "explanation"],
              },
            },
          },
          required: ["title", "questions"],
        },
      });

      const parsed = JSON.parse(result.text);
      res.json({
        title: String(parsed.title || "StudioOS Knowledge Arena"),
        questions: Array.isArray(parsed.questions)
          ? parsed.questions.map((q: Record<string, unknown>, idx: number) => ({
              id: `gq-${Date.now()}-${idx}`,
              question: String(q.question || ""),
              options: Array.isArray(q.options) ? q.options.map(String) : ["Option A", "Option B", "Option C"],
              correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
              explanation: String(q.explanation || ""),
            }))
          : [],
        modelUsed: result.modelUsed,
      });
    } catch (err) {
      const formatted = formatApiError(err, Boolean(userApiKey));
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`StudioOS server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
