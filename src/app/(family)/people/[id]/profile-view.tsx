"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  Pencil, MapPin, Briefcase, Sparkles, Trophy, Flower, Upload, BookOpen, Cake, Lock, Phone, Mail, Home, Trash2, Gift,
  GitFork, ImagePlus, Milestone,
} from "lucide-react";
import { Countryside } from "@/components/scene/countryside";
import { Portrait } from "@/components/portrait";
import { Button } from "@/components/ui/button";
import { Badge, Field, Select, Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useViewer } from "@/components/shell/viewer-context";
import { PersonForm } from "@/components/people/person-form";
import { GreetingCardView, GreetingComposer, type Greeting } from "@/components/people/greetings";
import { MediaGallery } from "@/components/media/media-gallery";
import { UploaderDialog } from "@/components/media/uploader-dialog";
import { uploadFile } from "@/lib/uploader";
import { api, ApiError } from "@/lib/client";
import { ageOn, cn, formatDate, fullName, mediaUrl, shortName } from "@/lib/utils";
import type { Album, MediaItem, Partnership, PersonFull, PersonLite, TreeData } from "@/lib/types";

type Story = { id: string; title: string; kind: string; createdAt: string; authorName: string | null };
type Ev = { id: string; title: string; eventDate: string; datePrecision: "day" | "month" | "year"; kind: string; description: string | null };

const TABS = ["Life story", "Family", "Memories", "Life events", "Greetings"] as const;


function daysUntilAnniversary(date: string | null) {
  if (!date) return null;
  const [, m, d] = date.split("-").map(Number);
  if (!m || !d) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), m - 1, d);
  if (next < today) next = new Date(now.getFullYear() + 1, m - 1, d);
  const diff = Math.round((next.getTime() - today.getTime()) / 86400000);
  const prev = new Date(next.getFullYear() - 1, m - 1, d);
  const since = Math.round((today.getTime() - prev.getTime()) / 86400000);
  return since <= 7 ? -since : diff;
}

export function ProfileView({ person, tree, media, albums, stories, events, greetings }: {
  person: PersonFull; tree: TreeData; media: MediaItem[]; albums: Album[]; stories: Story[]; events: Ev[]; greetings: Greeting[];
}) {
  const viewer = useViewer();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Life story");
  const [editOpen, setEditOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const canEdit = viewer.canEditTree || viewer.personId === person.id;
  const p = person;

  const byId = useMemo(() => new Map(tree.persons.map((x) => [x.id, x])), [tree]);
  const rel = useMemo(() => {
    const parents = tree.parents.filter((l) => l.childId === p.id).map((l) => ({ link: l, person: byId.get(l.parentId)! })).filter((x) => x.person);
    const children = tree.parents.filter((l) => l.parentId === p.id).map((l) => ({ link: l, person: byId.get(l.childId)! })).filter((x) => x.person);
    const parentIds = new Set(parents.map((x) => x.person.id));
    const sibIds = new Set<string>();
    for (const l of tree.parents) if (parentIds.has(l.parentId) && l.childId !== p.id) sibIds.add(l.childId);
    const siblings = [...sibIds].map((id) => {
      const theirParents = new Set(tree.parents.filter((l) => l.childId === id).map((l) => l.parentId));
      const shared = [...parentIds].filter((x) => theirParents.has(x)).length;
      return { person: byId.get(id)!, half: shared < 2 && (parentIds.size >= 2 || theirParents.size >= 2) };
    }).filter((x) => x.person);
    const partners = tree.partnerships.filter((x) => x.personA === p.id || x.personB === p.id)
      .map((x) => ({ link: x, person: byId.get(x.personA === p.id ? x.personB : x.personA)! })).filter((x) => x.person);
    return { parents, children, siblings, partners };
  }, [tree, byId, p.id]);

  const bdayIn = !p.isDeceased ? daysUntilAnniversary(p.birthDate) : null;
  const memorialIn = p.isDeceased ? daysUntilAnniversary(p.deathDate) : null;
  const greetingOccasion = bdayIn !== null && Math.abs(bdayIn) <= 7 ? "birthday" : memorialIn !== null && Math.abs(memorialIn) <= 7 ? "memorial" : null;
  const age = !p.isDeceased ? ageOn(p.birthDate) : null;

  async function setCover(file: File | undefined) {
    if (!file) return;
    setCoverBusy(true);
    try {
      const r = await uploadFile(file, { purpose: "cover" });
      await api(`/api/persons/${p.id}`, { method: "PATCH", body: { coverMediaId: r.mediaId } });
      toast("Cover updated");
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't update cover", "error");
    } finally {
      setCoverBusy(false);
    }
  }

  async function unlink(type: "parent" | "partner", id: string) {
    if (!confirm("Remove this relationship link? Both people stay in the tree.")) return;
    try {
      await api(`/api/relationships/${type}/${id}`, { method: "DELETE" });
      toast("Link removed");
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't remove link", "error");
    }
  }

  async function updatePartner(x: Partnership, status: string) {
    try {
      await api(`/api/relationships/partner/${x.id}`, { method: "PATCH", body: { kind: x.kind, status, startDate: x.startDate, endDate: x.endDate, place: x.place } });
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't update", "error");
    }
  }

  async function removePerson() {
    if (!confirm(`Remove ${fullName(p)} from the family tree? Their memories stay in the garden, and the profile can be restored from a backup.`)) return;
    try {
      await api(`/api/persons/${p.id}`, { method: "DELETE" });
      toast("Removed from the tree");
      router.replace("/tree");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't remove", "error");
    }
  }

  return (
    <div className={cn(p.isDeceased && "memorial")}>
      {/* Cover */}
      <div className="relative h-56 overflow-hidden sm:h-72">
        {p.coverMediaId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(p.coverMediaId, { thumb: 1600 })} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <Countryside variant="subtle" align="middle" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/10 to-transparent" />
        {p.isDeceased && <div className="absolute inset-0 bg-dusk/15 mix-blend-multiply" />}
        {canEdit && (
          <label className="absolute right-4 top-4 flex cursor-pointer items-center gap-2 rounded-2xl bg-surface/85 px-3 py-2 text-sm font-bold backdrop-blur hover:bg-surface">
            <ImagePlus className="size-4" /> {coverBusy ? "Uploading…" : "Change cover"}
            <input type="file" accept="image/*" className="hidden" disabled={coverBusy}
              onClick={(e) => {
                if (!viewer.driveConnected) {
                  e.preventDefault();
                  toast("Photo uploads start once the family admin connects Google Drive.", "error");
                }
              }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = ""; // let the same file be picked again
                setCover(file);
              }} />
          </label>
        )}
      </div>

      <div className="mx-auto -mt-24 max-w-6xl px-4 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative flex flex-col items-center gap-5 text-center sm:flex-row sm:items-end sm:text-left">
          <Portrait person={p} size={168} thumb={800} />
          <div className="min-w-0 flex-1 pb-2">
            {p.isDeceased && <p className="mb-1 flex items-center justify-center gap-2 text-sm font-extrabold uppercase tracking-[0.15em] text-dusk sm:justify-start"><Flower className="size-4" /> In loving memory</p>}
            <h1 className="h-display break-words text-4xl sm:text-5xl">{fullName(p)}</h1>
            <p className="mt-1 text-lg text-ink-soft">
              {p.nickname && <span className="font-display italic">“{p.nickname}” · </span>}
              {p.maidenName && <span>née {p.maidenName} · </span>}
              {p.birthDate && <span>{formatDate(p.birthDate, p.birthDatePrecision)}</span>}
              {p.isDeceased && <span> — {p.deathDate ? formatDate(p.deathDate, p.deathDatePrecision) : "?"}</span>}
              {age !== null && p.birthDatePrecision === "day" && <span> · {age} years young</span>}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 pb-2">
            {greetingOccasion && (
              <Button variant="gold" onClick={() => setCardOpen(true)}><Gift /> {greetingOccasion === "birthday" ? "Send a birthday card" : "Leave a remembrance"}</Button>
            )}
            <Button variant="secondary" asChild><Link href={`/tree?person=${p.id}`}><GitFork /> See in tree</Link></Button>
            {canEdit && <Button onClick={() => setEditOpen(true)}><Pencil /> Edit</Button>}
          </div>
        </motion.div>

        {bdayIn !== null && bdayIn >= 0 && bdayIn <= 30 && (
          <div className="mt-6 flex items-center gap-3 rounded-3xl bg-sun/30 px-5 py-3 font-bold text-ink">
            <Cake className="size-5 text-gold" />
            {bdayIn === 0 ? `It's ${p.firstName}'s birthday today! 🎉` : `${p.firstName}'s birthday is in ${bdayIn} day${bdayIn === 1 ? "" : "s"}.`}
          </div>
        )}

        <div className="sticky top-16 z-20 -mx-4 mt-8 overflow-x-auto border-b border-line bg-bg/85 px-4 backdrop-blur sm:mx-0 sm:px-0" role="tablist">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={cn("relative whitespace-nowrap px-4 py-3.5 font-bold transition", tab === t ? "text-forest-deep" : "text-ink-soft hover:text-ink")}>
                {t}
                {t === "Memories" && media.length > 0 && <span className="ml-1.5 text-xs text-ink-faint">{media.length}</span>}
                {tab === t && <motion.span layoutId="profile-tab" className="absolute inset-x-2 -bottom-px h-1 rounded-full bg-gold" />}
              </button>
            ))}
          </div>
        </div>

        <div className="py-8">
          {tab === "Life story" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-6">
                {p.isDeceased && p.memorialMessage && (
                  <blockquote className="card border-l-4 border-l-dusk p-6 font-display text-xl italic leading-relaxed text-ink">{p.memorialMessage}</blockquote>
                )}
                <div className="card p-6 sm:p-8">
                  <h2 className="h-display mb-4 text-2xl">Their story</h2>
                  {p.biography ? (
                    <div className="prose-story text-[1.06rem] leading-relaxed">
                      {p.biography.split(/\n{2,}/).map((para, i) => <p key={i} className="whitespace-pre-line">{para}</p>)}
                    </div>
                  ) : (
                    <p className="text-ink-soft">No story written yet. {canEdit ? "Add memories of where they grew up, what they loved, and the stories everyone tells." : ""}</p>
                  )}
                </div>
                {stories.length > 0 && (
                  <div className="card p-6">
                    <h2 className="h-display mb-3 flex items-center gap-2 text-2xl"><BookOpen className="size-5 text-forest" /> Stories about {p.firstName}</h2>
                    <ul className="divide-y divide-line">
                      {stories.map((s) => (
                        <li key={s.id}><Link href={`/stories/${s.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-forest">
                          <span className="font-bold">{s.title}</span><Badge tone="ink">{s.kind}</Badge>
                        </Link></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <aside className="space-y-4">
                <div className="card space-y-3 p-5">
                  {p.birthPlace && <Fact icon={MapPin} label="Born in">{p.birthPlace}</Fact>}
                  {p.isDeceased && p.deathPlace && <Fact icon={Flower} label="Passed in">{p.deathPlace}</Fact>}
                  {p.isDeceased && p.restingPlace && <Fact icon={Flower} label="Resting place">{p.restingPlace}</Fact>}
                  {p.occupation && <Fact icon={Briefcase} label="Work">{p.occupation}</Fact>}
                  {p.hobbies && <Fact icon={Sparkles} label="Loved">{p.hobbies}</Fact>}
                  {p.achievements && <Fact icon={Trophy} label="Proud moments"><span className="whitespace-pre-line">{p.achievements}</span></Fact>}
                  {!p.birthPlace && !p.occupation && !p.hobbies && !p.achievements && <p className="text-sm text-ink-faint">No details added yet.</p>}
                </div>
                {p.sensitive && (p.sensitive.phone || p.sensitive.email || p.sensitive.address || p.sensitive.notes) && (
                  <div className="card space-y-3 border-dashed p-5">
                    <p className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-gold"><Lock className="size-4" /> Private — only you{viewer.isAdmin ? " and admins" : ""} see this</p>
                    {p.sensitive.phone && <Fact icon={Phone} label="Phone">{p.sensitive.phone}</Fact>}
                    {p.sensitive.email && <Fact icon={Mail} label="Email">{p.sensitive.email}</Fact>}
                    {p.sensitive.address && <Fact icon={Home} label="Address">{p.sensitive.address}</Fact>}
                    {p.sensitive.notes && <p className="whitespace-pre-line text-sm text-ink-soft">{p.sensitive.notes}</p>}
                  </div>
                )}
                {viewer.isAdmin && (
                  <Button variant="ghost" className="w-full text-danger" onClick={removePerson}><Trash2 /> Remove from tree</Button>
                )}
              </aside>
            </div>
          )}

          {tab === "Family" && (
            <div className="grid gap-6 md:grid-cols-2">
              <RelGroup title="Parents" items={rel.parents.map((x) => ({ person: x.person, note: x.link.kind !== "biological" ? x.link.kind : null, onRemove: viewer.canEditTree ? () => unlink("parent", x.link.id) : undefined }))} />
              <RelGroup title="Partners" items={rel.partners.map((x) => ({
                person: x.person,
                note: `${x.link.kind}${x.link.status !== "current" ? ` · ${x.link.status}` : ""}${x.link.startDate ? ` · since ${formatDate(x.link.startDate, "year")}` : ""}`,
                onRemove: viewer.canEditTree ? () => unlink("partner", x.link.id) : undefined,
                extra: viewer.canEditTree ? (
                  <Select value={x.link.status} onChange={(e) => updatePartner(x.link, e.target.value)} className="h-9 w-32 text-sm" aria-label="Status">
                    <option value="current">Together</option><option value="divorced">Divorced</option><option value="separated">Separated</option><option value="widowed">Widowed</option>
                  </Select>
                ) : null,
              }))} />
              <RelGroup title="Children" items={rel.children.map((x) => ({ person: x.person, note: x.link.kind !== "biological" ? x.link.kind : null, onRemove: viewer.canEditTree ? () => unlink("parent", x.link.id) : undefined }))} />
              <RelGroup title="Siblings" items={rel.siblings.map((x) => ({ person: x.person, note: x.half ? "half / step sibling" : null }))} />
            </div>
          )}

          {tab === "Memories" && (
            <div>
              {viewer.canContribute && (
                <div className="mb-6 flex justify-end"><Button onClick={() => setUploadOpen(true)}><Upload /> Add memories of {p.firstName}</Button></div>
              )}
              <MediaGallery items={media} people={tree.persons} albums={albums} onChanged={() => router.refresh()} emptyText={`No photos of ${p.firstName} yet. Tag ${p.firstName} in the Memory Garden to see them here.`} />
            </div>
          )}

          {tab === "Life events" && (
            <ol className="relative ml-3 space-y-6 border-l-2 border-dashed border-moss pl-8">
              {p.birthDate && <EventItem date={formatDate(p.birthDate, p.birthDatePrecision)} title={`Born${p.birthPlace ? ` in ${p.birthPlace}` : ""}`} />}
              {rel.partners.filter((x) => x.link.startDate).map((x) => (
                <EventItem key={x.link.id} date={formatDate(x.link.startDate, "day")} title={`${x.link.kind === "married" ? "Married" : "Partnered with"} ${shortName(x.person)}`} />
              ))}
              {rel.children.filter((x) => x.person.birthDate).map((x) => (
                <EventItem key={x.link.id} date={formatDate(x.person.birthDate, x.person.birthDatePrecision)} title={`Welcomed ${shortName(x.person)}`} />
              ))}
              {events.map((e) => <EventItem key={e.id} date={formatDate(e.eventDate, e.datePrecision)} title={e.title} body={e.description} />)}
              {p.isDeceased && p.deathDate && <EventItem date={formatDate(p.deathDate, p.deathDatePrecision)} title="Passed away, forever remembered" />}
              <li className="text-sm text-ink-faint"><Link href="/timeline" className="inline-flex items-center gap-1 font-bold text-forest hover:underline"><Milestone className="size-4" /> Open the family timeline</Link></li>
            </ol>
          )}

          {tab === "Greetings" && (
            <div>
              <div className="mb-6 flex justify-end"><Button variant="gold" onClick={() => setCardOpen(true)}><Gift /> {p.isDeceased ? "Leave a remembrance" : "Write a card"}</Button></div>
              {greetings.length === 0 ? (
                <div className="card p-10 text-center text-ink-soft">No cards yet. Be the first to write one.</div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {greetings.map((g, i) => <GreetingCardView key={g.id} g={g} i={i} canDelete={viewer.isAdmin || g.authorId === viewer.accountId} onDeleted={() => router.refresh()} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <PersonForm open={editOpen} onOpenChange={setEditOpen} person={p} canSeePrivate={viewer.isAdmin || viewer.personId === p.id} onSaved={() => router.refresh()} />
      <UploaderDialog open={uploadOpen} onOpenChange={setUploadOpen} people={tree.persons} albums={albums} defaults={{ people: [p.id] }} onDone={() => router.refresh()} />
      <GreetingComposer open={cardOpen} onOpenChange={setCardOpen} person={p} defaultOccasion={p.isDeceased ? "memorial" : "birthday"} onSent={() => { setTab("Greetings"); router.refresh(); }} />
    </div>
  );
}

function Fact({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-1 size-4 shrink-0 text-moss" />
      <div><p className="text-xs font-extrabold uppercase tracking-wider text-ink-faint">{label}</p><div className="text-ink">{children}</div></div>
    </div>
  );
}

function RelGroup({ title, items }: { title: string; items: { person: PersonLite; note?: string | null; onRemove?: () => void; extra?: React.ReactNode }[] }) {
  return (
    <section className="card p-5">
      <h2 className="h-display mb-3 text-xl">{title}</h2>
      {items.length === 0 ? <p className="text-sm text-ink-faint">None recorded.</p> : (
        <ul className="space-y-2">
          {items.map(({ person, note, onRemove, extra }) => (
            <li key={person.id} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-surface-2">
              <Link href={`/people/${person.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Portrait person={person} size={48} thumb={128} frame="round" />
                <span className="min-w-0">
                  <span className="block truncate font-bold">{fullName(person)}</span>
                  {note && <span className="text-sm capitalize text-ink-faint">{note}</span>}
                </span>
              </Link>
              {extra}
              {onRemove && <button onClick={onRemove} className="rounded-full p-2 text-ink-faint hover:bg-danger/10 hover:text-danger" aria-label="Remove link" title="Remove link"><Trash2 className="size-4" /></button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EventItem({ date, title, body }: { date: string; title: string; body?: string | null }) {
  return (
    <li className="relative">
      <span className="absolute -left-[2.6rem] top-1 grid size-5 place-items-center rounded-full border-4 border-bg bg-gold" />
      <p className="text-sm font-extrabold uppercase tracking-wider text-moss">{date}</p>
      <p className="font-display text-lg font-semibold">{title}</p>
      {body && <p className="text-ink-soft">{body}</p>}
    </li>
  );
}

