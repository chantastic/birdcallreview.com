import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hashFor, labelFor } from './time-link';

const TURN = /^\*\*\[(\d{2}):(\d{2}):(\d{2})\] ([^:]+):\*\*\s*(.*)$/;

export interface TranscriptTurn {
  seconds: number;
  hash: string;
  id: string;
  label: string;
  speaker: string;
  slot: number;
  continued: boolean;
  text: string;
}

/**
 * Names already written in the export are shown as written.
 * A trailing ` - N` is AssemblyAI's extra channel for that same name.
 * A single letter stays generic (`Speaker C`) until an episode mapping replaces it.
 */
export function speakerName(raw: string, mapping?: Record<string, string>): string {
  const exact = mapping?.[raw]?.trim();
  if (exact) return exact;
  const base = raw.replace(/ - \d+$/, '');
  const mappedBase = mapping?.[base]?.trim();
  if (mappedBase) return mappedBase;
  if (/^[A-Z]$/.test(base)) return `Speaker ${base}`;
  return base;
}

export function parseTranscript(markdown: string, mapping?: Record<string, string>): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  const slots = new Map<string, number>();
  const usedAnchors = new Set<string>();
  for (const line of markdown.split('\n')) {
    const match = TURN.exec(line);
    if (!match) continue;
    const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
    const speaker = speakerName(match[4], mapping);
    let slot = slots.get(speaker);
    if (slot == null) {
      slot = Math.min(slots.size, 2);
      slots.set(speaker, slot);
    }
    const previous = turns[turns.length - 1];
    const hash = hashFor(seconds);
    const anchor = `t=${hash}`;
    const id = usedAnchors.has(anchor) ? `turn-${turns.length}` : anchor;
    usedAnchors.add(anchor);
    turns.push({
      seconds,
      hash,
      id,
      label: labelFor(seconds),
      speaker,
      slot,
      continued: previous?.speaker === speaker,
      text: match[5].trim(),
    });
  }
  return turns;
}

export function loadTranscript(slug: string, mapping?: Record<string, string>): TranscriptTurn[] {
  const markdown = readFileSync(resolve('transcripts', `${slug}.md`), 'utf8');
  const turns = parseTranscript(markdown, mapping);
  if (turns.length === 0) throw new Error(`No transcript turns in transcripts/${slug}.md`);
  return turns;
}
