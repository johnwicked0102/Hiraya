// Shared types (safe for both server and client code).

export type Role = "admin" | "editor" | "viewer";
export type Gender = "female" | "male" | "other" | "unknown";
export type DatePrecision = "day" | "month" | "year";
export type Frame = "round" | "storybook" | "leaf" | "polaroid" | "oval";
export type ParentKind = "biological" | "adopted" | "step" | "foster" | "guardian";
export type PartnerKind = "married" | "partner" | "engaged";
export type PartnerStatus = "current" | "divorced" | "separated" | "widowed";
export type MediaKind = "image" | "video" | "audio" | "document";

export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PersonLite {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string | null;
  nickname: string | null;
  gender: Gender;
  birthDate: string | null;
  birthDatePrecision: DatePrecision;
  isDeceased: boolean;
  deathDate: string | null;
  deathDatePrecision: DatePrecision;
  photoMediaId: string | null;
  photoCrop: Crop | null;
  photoFrame: Frame;
  createdAt?: string;
}

export interface PersonFull extends PersonLite {
  maidenName: string | null;
  birthPlace: string | null;
  deathPlace: string | null;
  restingPlace: string | null;
  occupation: string | null;
  hobbies: string | null;
  achievements: string | null;
  biography: string | null;
  memorialMessage: string | null;
  coverMediaId: string | null;
  sensitive: SensitiveDetails | null; // null when the viewer may not see it
  updatedAt: string;
}

export interface SensitiveDetails {
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface ParentLink {
  id: string;
  parentId: string;
  childId: string;
  kind: ParentKind;
}

export interface Partnership {
  id: string;
  personA: string;
  personB: string;
  kind: PartnerKind;
  status: PartnerStatus;
  startDate: string | null;
  endDate: string | null;
  place: string | null;
}

export interface TreeData {
  persons: PersonLite[];
  parents: ParentLink[];
  partnerships: Partnership[];
}

export interface MediaItem {
  id: string;
  kind: MediaKind;
  mimeType: string;
  fileName: string;
  sizeBytes: string | number;
  width: number | null;
  height: number | null;
  title: string | null;
  caption: string | null;
  takenOn: string | null;
  location: string | null;
  albumId: string | null;
  purpose: string;
  uploadedBy: string | null;
  uploaderName?: string | null;
  createdAt: string;
  people: string[];
}

export interface Album {
  id: string;
  title: string;
  description: string | null;
  eventDate: string | null;
  coverMediaId: string | null;
  mediaCount: number;
}

export interface ViewerInfo {
  accountId: string;
  personId: string | null;
  displayName: string;
  role: Role;
  effectiveRole: Role;
  authLevel: "code" | "strong";
  canEditTree: boolean;
  canContribute: boolean;
  isAdmin: boolean;
  canDownload: boolean;
}
