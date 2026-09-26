import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { renderTraceHtml, type TraceEntry } from "@/lib/session/trace-html";

const entrySchema = z.object({
  at: z.number(),
  event: z.string(),
  detail: z.string(),
  state: z.string(),
  screenshot: z.string().nullable(),
});

const requestSchema = z.object({
  sessionId: z.string().regex(/^[a-zA-Z0-9-]{8,80}$/),
  entries: z.array(entrySchema).max(5000),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const directory = path.join(process.cwd(), "logs");
    await mkdir(directory, { recursive: true });
    const filename = `${body.sessionId}.html`;
    const filePath = path.join(directory, filename);
    await writeFile(filePath, renderTraceHtml(body.sessionId, body.entries as TraceEntry[]), "utf8");
    return NextResponse.json({ file: `logs/${filename}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not write session log";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
