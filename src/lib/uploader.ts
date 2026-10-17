"use client";
import { api, ApiError } from "./client";

/**
 * Browser → Google Drive resumable uploads.
 *
 * 1. Ask Hiraya for an upload session (server checks permissions, de-duplicates,
 *    picks the right archive folder and opens a Drive resumable session).
 * 2. Send the original file to Google in 8 MiB chunks — no compression, with
 *    progress and automatic resume after network hiccups.
 * 3. Tell Hiraya the upload finished; the server verifies the file with Google
 *    before recording it.
 */

export interface UploadOptions {
  purpose?: "memory" | "portrait" | "cover" | "story" | "capsule" | "logo";
  title?: string | null;
  caption?: string | null;
  takenOn?: string | null;
  location?: string | null;
  albumId?: string | null;
  people?: string[];
  onProgress?: (fraction: number, phase: "hashing" | "uploading" | "finishing") => void;
  signal?: AbortSignal;
}

export interface UploadResult {
  mediaId: string;
  duplicate?: boolean;
}

const CHUNK = 8 * 1024 * 1024; // multiple of 256 KiB as Google requires
const HASH_LIMIT = 400 * 1024 * 1024; // hash in-browser up to 400 MB; larger files use Drive's checksum

async function sha256(file: File): Promise<string | null> {
  if (file.size > HASH_LIMIT || !crypto?.subtle) return null;
  try {
    const buf = await file.arrayBuffer();
    const h = await crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

function localDate(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function guessMime(file: File) {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", heif: "image/heif", webp: "image/webp",
    gif: "image/gif", mp4: "video/mp4", mov: "video/quicktime", m4v: "video/x-m4v", webm: "video/webm", "3gp": "video/3gpp",
    mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg", aac: "audio/aac", pdf: "application/pdf", txt: "text/plain",
  };
  return (ext && map[ext]) || "application/octet-stream";
}

type ChunkResult = { status: number; range: string | null; body: string };

function putChunk(url: string, blob: Blob | null, contentRange: string, onBytes: (n: number) => void, signal?: AbortSignal): Promise<ChunkResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Range", contentRange);
    xhr.upload.onprogress = (e) => onBytes(e.loaded);
    xhr.onload = () => resolve({ status: xhr.status, range: xhr.getResponseHeader("Range"), body: xhr.responseText });
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("network"));
    if (signal) {
      if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
      xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    }
    xhr.send(blob);
  });
}

function confirmedOffset(range: string | null, fallback: number): number {
  const m = range?.match(/bytes=0-(\d+)/);
  return m ? Number(m[1]) + 1 : fallback;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function uploadFile(file: File, opts: UploadOptions = {}): Promise<UploadResult> {
  const mimeType = guessMime(file);
  opts.onProgress?.(0, "hashing");
  const hash = await sha256(file);

  const session = await api<{ duplicate?: boolean; mediaId?: string; uploadId?: string; uploadUrl?: string }>(
    "/api/media/upload-session",
    {
      body: {
        fileName: file.name,
        mimeType,
        size: file.size,
        sha256: hash,
        purpose: opts.purpose ?? "memory",
        takenOn: opts.takenOn ?? (file.lastModified ? localDate(file.lastModified) : null),
      },
    },
  );
  if (session.duplicate && session.mediaId) {
    opts.onProgress?.(1, "finishing");
    return { mediaId: session.mediaId, duplicate: true };
  }

  const total = file.size;
  let offset = 0;
  let driveFileId: string | null = null;
  let failures = 0;

  while (driveFileId === null) {
    if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const end = Math.min(offset + CHUNK, total);
    try {
      const res = await putChunk(
        session.uploadUrl!,
        total === 0 ? null : file.slice(offset, end),
        total === 0 ? "bytes */0" : `bytes ${offset}-${end - 1}/${total}`,
        (n) => opts.onProgress?.(Math.min(0.99, (offset + n) / Math.max(total, 1)), "uploading"),
        opts.signal,
      );
      if (res.status === 200 || res.status === 201) {
        driveFileId = (JSON.parse(res.body) as { id: string }).id;
      } else if (res.status === 308) {
        offset = confirmedOffset(res.range, end);
        failures = 0;
      } else if (res.status >= 500 || res.status === 429) {
        throw new Error("retry");
      } else if (res.status === 404 || res.status === 410) {
        throw new ApiError(410, "The upload session expired. Please try this file again.");
      } else {
        throw new ApiError(res.status, `Google Drive refused the upload (${res.status}).`);
      }
    } catch (e) {
      if (e instanceof ApiError || (e as Error).name === "AbortError") throw e;
      failures++;
      if (failures > 6) throw new ApiError(0, "Upload kept failing — check your internet connection and try again.");
      await sleep(Math.min(30000, 1000 * 2 ** failures));
      // Ask Google how much it already has, then resume from there.
      try {
        const st = await putChunk(session.uploadUrl!, null, `bytes */${total}`, () => {}, opts.signal);
        if (st.status === 200 || st.status === 201) driveFileId = (JSON.parse(st.body) as { id: string }).id;
        else if (st.status === 308) offset = confirmedOffset(st.range, 0);
      } catch {
        /* still offline; loop and retry */
      }
    }
  }

  opts.onProgress?.(0.995, "finishing");
  const done = await api<{ mediaId: string; duplicate?: boolean }>("/api/media/complete", {
    body: {
      uploadId: session.uploadId,
      driveFileId,
      title: opts.title ?? null,
      caption: opts.caption ?? null,
      takenOn: opts.takenOn ?? null,
      location: opts.location ?? null,
      albumId: opts.albumId ?? null,
      people: opts.people ?? [],
    },
  });
  opts.onProgress?.(1, "finishing");
  return done;
}
