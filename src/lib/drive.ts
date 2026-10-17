import "server-only";
import { sql } from "./db";
import { decrypt, encrypt } from "./crypto";
import { HttpError } from "./http";

/**
 * Google Drive integration.
 *
 * Scope: `drive.file` — Hiraya can only see and manage files it created itself,
 * never the rest of the administrator's Drive. Family members never touch Google
 * directly: the server holds the (encrypted) refresh token and every media read
 * is streamed through /api/media/[id]/content after a permission check.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const DRIVE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
export const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/drive.file"];

export function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function clientCreds() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new HttpError(500, "Google Drive isn't configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).");
  return { id, secret };
}

export function redirectUri() {
  return `${appUrl()}/api/drive/callback`;
}

export function authorizationUrl(state: string) {
  const { id } = clientCreds();
  const q = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${q}`;
}

export async function exchangeCode(code: string) {
  const { id, secret } = clientCreds();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirectUri(), grant_type: "authorization_code" }),
  });
  const j = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string };
  if (!res.ok || !j.access_token) throw new HttpError(400, `Google sign-in failed: ${j.error ?? res.status}`);
  if (!j.refresh_token) throw new HttpError(400, "Google didn't return offline access. Remove Hiraya from your Google account's third-party access and try again.");
  if (!j.scope?.includes("drive.file")) throw new HttpError(400, "Drive permission wasn't granted. Please allow Hiraya to manage the files it creates.");
  const info = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${j.access_token}` } }).then((r) => r.json() as Promise<{ email?: string }>);
  return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresIn: j.expires_in ?? 3600, email: info.email ?? null };
}

// ---------------------------------------------------------------------------
// Access tokens (cached per server instance)
// ---------------------------------------------------------------------------
let cached: { token: string; exp: number; refreshEnc: string } | null = null;

type Conn = { refreshTokenEnc: string; rootFolderId: string | null; folderCache: Record<string, string>; status: string; googleEmail: string | null };

export async function getConnection(): Promise<Conn | null> {
  const [c] = await sql<Conn[]>`select refresh_token_enc, root_folder_id, folder_cache, status, google_email from drive_connection where id = 1`;
  return c ?? null;
}

export async function accessToken(): Promise<string> {
  const conn = await getConnection();
  if (!conn) throw new HttpError(409, "Google Drive isn't connected yet. Ask your family admin to connect it.");
  if (cached && cached.refreshEnc === conn.refreshTokenEnc && cached.exp > Date.now() + 60_000) return cached.token;
  const { id, secret } = clientCreds();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: decrypt(conn.refreshTokenEnc), grant_type: "refresh_token" }),
  });
  const j = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !j.access_token) {
    if (j.error === "invalid_grant") await sql`update drive_connection set status = 'broken' where id = 1`;
    throw new HttpError(502, "Google Drive access has expired. The admin needs to reconnect Drive in the dashboard.");
  }
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000, refreshEnc: conn.refreshTokenEnc };
  return j.access_token;
}

export async function driveFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  let res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    cached = null;
    headers.set("Authorization", `Bearer ${await accessToken()}`);
    res = await fetch(url, { ...init, headers });
  }
  return res;
}

async function driveJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await driveFetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    console.error("[drive]", res.status, url.replace(/\?.*$/, ""), text.slice(0, 500));
    if (res.status === 404) throw new HttpError(404, "That file is no longer in the Google Drive archive.");
    if (res.status === 403 && text.includes("storageQuotaExceeded")) throw new HttpError(507, "The family's Google Drive is full.");
    throw new HttpError(502, `Google Drive error (${res.status}).`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Connection lifecycle
// ---------------------------------------------------------------------------
export async function saveConnection(refreshToken: string, email: string | null, accountId: string) {
  cached = null;
  await sql`
    insert into drive_connection (id, google_email, refresh_token_enc, root_folder_id, folder_cache, status, connected_by, connected_at)
    values (1, ${email}, ${encrypt(refreshToken)}, null, '{}'::jsonb, 'ok', ${accountId}, now())
    on conflict (id) do update set google_email = excluded.google_email, refresh_token_enc = excluded.refresh_token_enc,
      root_folder_id = null, folder_cache = '{}'::jsonb, status = 'ok', connected_by = excluded.connected_by, connected_at = now()`;
  await ensureRoot();
}

export async function disconnect() {
  const conn = await getConnection();
  if (conn) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decrypt(conn.refreshTokenEnc))}`, { method: "POST" });
    } catch {
      /* best effort */
    }
  }
  cached = null;
  await sql`delete from drive_connection where id = 1`;
}

// ---------------------------------------------------------------------------
// Folders: "Hiraya Family Archive / Photos / 2026" etc.
// ---------------------------------------------------------------------------
function q(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findOrCreateFolder(name: string, parent: string | null): Promise<string> {
  const query = `mimeType='${FOLDER_MIME}' and name='${q(name)}' and trashed=false` + (parent ? ` and '${q(parent)}' in parents` : "");
  const found = await driveJson<{ files: { id: string }[] }>(`${DRIVE}/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1&spaces=drive`);
  if (found.files[0]) return found.files[0].id;
  const created = await driveJson<{ id: string }>(`${DRIVE}/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: parent ? [parent] : undefined, description: "Managed by Hiraya — Where Family Stories Live Forever" }),
  });
  return created.id;
}

export async function ensureRoot(): Promise<string> {
  const conn = await getConnection();
  if (!conn) throw new HttpError(409, "Google Drive isn't connected.");
  if (conn.rootFolderId) {
    const r = await driveFetch(`${DRIVE}/files/${conn.rootFolderId}?fields=id,trashed`);
    if (r.ok && !((await r.json()) as { trashed?: boolean }).trashed) return conn.rootFolderId;
  }
  const rootName = process.env.DRIVE_ROOT_FOLDER_NAME || "Hiraya Family Archive";
  const root = await findOrCreateFolder(rootName, null);
  const cache: Record<string, string> = {};
  for (const sub of ["Photos", "Videos", "Audio", "Documents", "Backups"]) cache[sub] = await findOrCreateFolder(sub, root);
  await sql`update drive_connection set root_folder_id = ${root}, folder_cache = ${sql.json(cache)} where id = 1`;
  return root;
}

export async function ensureFolder(path: string[]): Promise<string> {
  const root = await ensureRoot();
  const conn = (await getConnection())!;
  const cache = { ...conn.folderCache };
  let parent = root;
  let key = "";
  let changed = false;
  for (const seg of path) {
    key = key ? `${key}/${seg}` : seg;
    if (!cache[key]) {
      cache[key] = await findOrCreateFolder(seg, parent);
      changed = true;
    }
    parent = cache[key]!;
  }
  if (changed) {
    await sql`update drive_connection set folder_cache = folder_cache || ${sql.json(cache)} where id = 1`;
  }
  return parent;
}

export function folderFor(kind: string, year: number | null): string[] {
  const top = kind === "image" ? "Photos" : kind === "video" ? "Videos" : kind === "audio" ? "Audio" : "Documents";
  return year ? [top, String(year)] : [top, "Undated"];
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------
export async function createResumableSession(opts: {
  name: string;
  mimeType: string;
  size: number;
  folderId: string;
  origin: string;
  appProperties: Record<string, string>;
}): Promise<string> {
  const res = await driveFetch(`${UPLOAD}/files?uploadType=resumable&fields=id`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": opts.mimeType,
      "X-Upload-Content-Length": String(opts.size),
      // Lets the browser upload straight to Google with CORS.
      Origin: opts.origin,
    },
    body: JSON.stringify({ name: opts.name, parents: [opts.folderId], appProperties: opts.appProperties }),
  });
  const loc = res.headers.get("location");
  if (!res.ok || !loc) {
    console.error("[drive] resumable session failed", res.status, (await res.text()).slice(0, 400));
    throw new HttpError(502, "Couldn't start the upload with Google Drive.");
  }
  return loc;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  md5Checksum?: string;
  parents?: string[];
  trashed?: boolean;
  thumbnailLink?: string;
  appProperties?: Record<string, string>;
  imageMediaMetadata?: { width?: number; height?: number; time?: string };
  videoMediaMetadata?: { width?: number; height?: number; durationMillis?: string };
}

export function getFile(id: string, fields = "id,name,mimeType,size,md5Checksum,parents,trashed,appProperties,imageMediaMetadata,videoMediaMetadata") {
  return driveJson<DriveFile>(`${DRIVE}/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}`);
}

export function fetchContent(id: string, range?: string | null) {
  const headers: Record<string, string> = {};
  if (range) headers.Range = range;
  return driveFetch(`${DRIVE}/files/${encodeURIComponent(id)}?alt=media`, { headers });
}

export async function fetchThumbnail(id: string, size: number): Promise<Response | null> {
  const f = await getFile(id, "thumbnailLink");
  if (!f.thumbnailLink) return null;
  const url = f.thumbnailLink.replace(/=s\d+(-c)?$/, `=s${size}`);
  const res = await driveFetch(url);
  return res.ok ? res : null;
}

export async function trashFile(id: string) {
  await driveJson(`${DRIVE}/files/${encodeURIComponent(id)}?fields=id`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
}

export async function uploadSmallFile(name: string, mimeType: string, content: string | Buffer, folderId: string) {
  const boundary = `hiraya${Date.now()}`;
  const meta = JSON.stringify({ name, parents: [folderId] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    Buffer.isBuffer(content) ? content : Buffer.from(content),
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  return driveJson<{ id: string; name: string }>(`${UPLOAD}/files?uploadType=multipart&fields=id,name`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
}

export async function storageQuota() {
  return driveJson<{ storageQuota: { limit?: string; usage?: string; usageInDrive?: string }; user?: { emailAddress?: string } }>(
    `${DRIVE}/about?fields=storageQuota,user(emailAddress)`,
  );
}

export function rootFolderLink(id: string) {
  return `https://drive.google.com/drive/folders/${id}`;
}
