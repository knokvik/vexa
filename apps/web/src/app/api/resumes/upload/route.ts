import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { dataPath } from "@/lib/data-root";

const DIR = dataPath("uploads", "resumes");
const META = path.join(DIR, "meta.json");

export type UploadedResumeMeta = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  storedName: string;
  uploadedAt: string;
};

async function ensureDir() {
  await fs.mkdir(DIR, { recursive: true });
}

async function loadMeta(): Promise<UploadedResumeMeta | null> {
  try {
    const raw = await fs.readFile(META, "utf8");
    return JSON.parse(raw) as UploadedResumeMeta;
  } catch {
    return null;
  }
}

async function saveMeta(meta: UploadedResumeMeta) {
  await ensureDir();
  await fs.writeFile(META, JSON.stringify(meta, null, 2), "utf8");
}

/** GET — current uploaded resume metadata (if any) */
export async function GET() {
  const meta = await loadMeta();
  return NextResponse.json({
    ok: true,
    resume: meta,
    previewUrl: meta ? `/api/resumes/upload/file` : null,
  });
}

/**
 * POST — multipart form field "file"
 * Stores one active user resume for as-is preview (no AI rewrite).
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    const name = file.name || "resume";
    const mime = file.type || "application/octet-stream";
    const ext = path.extname(name).toLowerCase();
    const okExt = [".pdf", ".doc", ".docx", ".txt"].includes(ext);
    if (!okExt && !allowed.includes(mime)) {
      return NextResponse.json(
        { error: "Upload PDF, DOCX, DOC, or TXT only" },
        { status: 400 }
      );
    }
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large (max 12MB)" },
        { status: 400 }
      );
    }

    await ensureDir();
    // Remove previous file if present
    const prev = await loadMeta();
    if (prev?.storedName) {
      try {
        await fs.unlink(path.join(DIR, prev.storedName));
      } catch {
        /* ignore */
      }
    }

    const id = `up_${Date.now()}`;
    const storedName = `${id}${ext || ".bin"}`;
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(DIR, storedName), buf);

    const meta: UploadedResumeMeta = {
      id,
      originalName: name,
      mimeType: mime || guessMime(ext),
      size: buf.length,
      storedName,
      uploadedAt: new Date().toISOString(),
    };
    await saveMeta(meta);

    return NextResponse.json({
      ok: true,
      resume: meta,
      previewUrl: `/api/resumes/upload/file`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "upload failed" },
      { status: 500 }
    );
  }
}

/** DELETE — remove uploaded resume */
export async function DELETE() {
  const prev = await loadMeta();
  if (prev?.storedName) {
    try {
      await fs.unlink(path.join(DIR, prev.storedName));
    } catch {
      /* ignore */
    }
  }
  try {
    await fs.unlink(META);
  } catch {
    /* ignore */
  }
  return NextResponse.json({ ok: true });
}

function guessMime(ext: string) {
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".doc") return "application/msword";
  if (ext === ".txt") return "text/plain";
  return "application/octet-stream";
}
