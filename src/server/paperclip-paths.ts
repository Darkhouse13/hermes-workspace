import os from 'node:os'
import path from 'node:path'

const HERMES_HOME = (process.env.HERMES_HOME || path.join(os.homedir(), '.hermes')).trim()

export function getPaperclipRoot(): string {
  return path.join(HERMES_HOME, 'paperclip')
}

export function getPaperclipCompanyDir(): string {
  return path.join(getPaperclipRoot(), 'company')
}

export function getPaperclipProjectsRoot(): string {
  return path.join(getPaperclipRoot(), 'projects')
}

export function getPaperclipProjectsIndexPath(): string {
  return path.join(getPaperclipProjectsRoot(), 'projects.json')
}

export function getPaperclipCompanyPath(): string {
  return path.join(getPaperclipCompanyDir(), 'company.json')
}

export function getPaperclipProjectDir(projectSlug: string): string {
  return path.join(getPaperclipProjectsRoot(), projectSlug)
}

export function getPaperclipProjectStatePath(projectSlug: string): string {
  return path.join(getPaperclipProjectDir(projectSlug), 'STATE.json')
}

export function getPaperclipProjectMarkdownPath(
  projectSlug: string,
  name: 'PROJECT.md' | 'DECISIONS.md' | 'NOTES.md' | 'HANDOFFS.md',
): string {
  return path.join(getPaperclipProjectDir(projectSlug), name)
}

export function getPaperclipMissionsDir(projectSlug: string): string {
  return path.join(getPaperclipProjectDir(projectSlug), 'missions')
}

export function getPaperclipMissionPath(projectSlug: string, missionId: string): string {
  return path.join(getPaperclipMissionsDir(projectSlug), `${missionId}.json`)
}

export function getPaperclipProjectHandoffsPath(projectSlug: string): string {
  return path.join(getPaperclipProjectDir(projectSlug), 'handoffs.json')
}

export function getPaperclipProjectApprovalsPath(projectSlug: string): string {
  return path.join(getPaperclipProjectDir(projectSlug), 'approvals.json')
}

export function getPaperclipProjectArtifactsPath(projectSlug: string): string {
  return path.join(getPaperclipProjectDir(projectSlug), 'artifacts.json')
}

export function getPaperclipProjectSessionsDir(projectSlug: string): string {
  return path.join(getPaperclipProjectDir(projectSlug), 'sessions')
}

export function getPaperclipProjectSessionLinkPath(
  projectSlug: string,
  sessionId: string,
): string {
  return path.join(getPaperclipProjectSessionsDir(projectSlug), `${sessionId}.json`)
}
