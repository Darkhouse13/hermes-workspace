
import fs from 'node:fs/promises'
import { createLogger } from './logger'
import type { PaperclipEvent, PaperclipEventType, PaperclipSessionLink } from '@/types/paperclip'

const log = createLogger('paperclip-continuity')
import {
  getPaperclipProjectDir,
  getPaperclipProjectSessionLinkPath,
  getPaperclipProjectSessionsDir,
} from '@/server/paperclip-paths'
import { makePaperclipId, nowIso, readJsonOrDefault, writeJsonPretty } from '@/server/paperclip-store'
import { getProject } from '@/server/paperclip-projects'

function getEventsPath(projectSlug: string): string {
  return `${getPaperclipProjectDir(projectSlug)}/events.json`
}

export async function listProjectEvents(projectIdOrSlug: string): Promise<Array<PaperclipEvent>> {
  const project = await getProject(projectIdOrSlug)
  if (!project) throw new Error('Project not found')
  const items = await readJsonOrDefault<Array<PaperclipEvent>>(getEventsPath(project.slug), [])
  return items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

export async function appendProjectEvent(input: {
  projectId: string
  missionId?: string
  type: PaperclipEventType
  summary: string
  metadata?: Record<string, unknown>
}): Promise<PaperclipEvent> {
  const project = await getProject(input.projectId)
  if (!project) throw new Error('Project not found')
  const event: PaperclipEvent = {
    id: makePaperclipId('event'),
    projectId: project.id,
    missionId: input.missionId,
    type: input.type,
    summary: input.summary,
    metadata: input.metadata,
    createdAt: nowIso(),
  }
  const current = await readJsonOrDefault<Array<PaperclipEvent>>(getEventsPath(project.slug), [])
  await writeJsonPretty(getEventsPath(project.slug), [...current, event])
  return event
}

export async function listProjectSessionLinks(projectIdOrSlug: string): Promise<Array<PaperclipSessionLink>> {
  const project = await getProject(projectIdOrSlug)
  if (!project) throw new Error('Project not found')
  const dir = getPaperclipProjectSessionsDir(project.slug)
  try {
    const entries = await fs.readdir(dir)
    const items = await Promise.all(
      entries
        .filter((entry) => entry.endsWith('.json'))
        .map((entry) => readJsonOrDefault<PaperclipSessionLink | null>(`${dir}/${entry}`, null)),
    )
    return (items.filter(Boolean) as Array<PaperclipSessionLink>).sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    )
  } catch (err) {
    log.warn('Failed to list project session links', { dir, error: String(err) })
    return []
  }
}

export async function writeProjectSessionLink(link: PaperclipSessionLink): Promise<void> {
  const project = await getProject(link.projectId)
  if (!project) throw new Error('Project not found')
  await writeJsonPretty(getPaperclipProjectSessionLinkPath(project.slug, link.sessionId), link)
}
