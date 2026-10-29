export type BodyKey = "council" | "cpc" | "znd";        // Legistar BodyId 1, 272, 11
export interface EventRecord { legistarId: number; bodyId: number; bodyName: string; startsAt: string /* ISO, America/Chicago */; clipId?: number; agendaUrl?: string; minutesUrl?: string; insiteUrl?: string }
export interface EventItemRecord { legistarId: number; eventId: number; sequence: number | null; matterId?: number; fileNumber?: string; title: string; actionName?: string; passed?: boolean; videoStartSec?: number; mover?: string; seconder?: string; minutesNote?: string }
export interface MatterRecord { legistarId: number; fileNumber: string; title: string; typeName: string; statusName: string; introDate?: string }
export interface HistoryRecord { legistarId: number; matterId: number; date: string; bodyName: string; actionName: string; passed?: boolean; eventId?: number }
export interface VoteRecord { eventItemId: number; personId: number; personName: string; value: string }
export interface Tally { aye: number; no: number; excused: number; other: number }
export interface TimelineStep { body: string; date: string; actions: string[]; passed?: boolean; eventId?: number; eventItemId?: number; videoStartSec?: number; tally?: Tally; upcoming: boolean }
export interface Turn { eventId: number; turnKey: string /* `${chunk}:${turnId}` */; chunk: number; startMs: number; endMs: number; label: string | null /* `c${chunk}:${speaker}` */; text: string }
export interface Cue { kind: "self" | "recognized"; name: string; affiliation?: string; turnKey: string; targetTurnKey: string }
export interface SpeakerAssignment { label: string; name: string; personId?: number; source: "legistar" | "self-intro" | "manual"; evidenceTurnKey: string; at?: number /* manual only: ms epoch, latest wins */; by?: string }
export interface ChapterPart { kind: "presentation" | "applicant" | "testimony" | "discussion" | "vote"; startMs: number; endMs: number }
export interface Chapter { eventItemId: number; startMs: number | null; endMs: number | null; located: "video-index" | "cue" | "not-located"; parts: ChapterPart[] }
export interface Change { kind: "hearing_scheduled" | "decision" | "step_added"; matterId: number; eventId?: number; at: string; sourceKey: string }
export interface Follow { userId: string; kind: "file" | "address" | "alder" | "topic"; value: string }
export interface EditorVerdict { ok: boolean; reason?: "no-source" | "unknown-source" | "evaluative" | "unsupported" }
