
import type {
  LaunchRoleRequest,
  LaunchRoleResponse,
  PaperclipApproval,
  PaperclipHandoff,
  PaperclipMission,
  PaperclipProject,
  PaperclipProjectDetail,
  PaperclipProjectSummary,
  RouteNextAction,
} from '@/types/paperclip'

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${res.status}`)
  return data as T
}

export async function listProjects() {
  return api<{ ok: true; items: Array<PaperclipProjectSummary> }>('/api/paperclip/projects')
}
export async function createProject(payload: Record<string, unknown>) {
  return api<{ ok: true; project: PaperclipProject }>('/api/paperclip/projects', { method: 'POST', body: JSON.stringify(payload) })
}
export async function getProject(projectId: string) {
  return api<{ ok: true; detail: PaperclipProjectDetail }>(`/api/paperclip/projects/${projectId}`)
}
export async function updateProject(projectId: string, payload: Record<string, unknown>) {
  return api<{ ok: true; project: PaperclipProject }>(`/api/paperclip/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify(payload) })
}
export async function listMissions(projectId?: string) {
  return api<{ ok: true; items: Array<PaperclipMission> }>(`/api/paperclip/missions${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`)
}
export async function createMission(payload: Record<string, unknown>) {
  return api<{ ok: true; mission: PaperclipMission }>('/api/paperclip/missions', { method: 'POST', body: JSON.stringify(payload) })
}
export async function updateMission(missionId: string, payload: Record<string, unknown>) {
  return api<{ ok: true; mission: PaperclipMission }>(`/api/paperclip/missions/${missionId}`, { method: 'PATCH', body: JSON.stringify(payload) })
}
export async function listHandoffs(projectId?: string) {
  return api<{ ok: true; items: Array<PaperclipHandoff> }>(`/api/paperclip/handoffs${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`)
}
export async function createHandoff(payload: Record<string, unknown>) {
  return api<{ ok: true; handoff: PaperclipHandoff }>('/api/paperclip/handoffs', { method: 'POST', body: JSON.stringify(payload) })
}
export async function listApprovals(projectId?: string) {
  return api<{ ok: true; items: Array<PaperclipApproval> }>(`/api/paperclip/approvals${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`)
}
export async function updateApproval(payload: Record<string, unknown>) {
  return api<{ ok: true; approval: PaperclipApproval }>('/api/paperclip/approvals', { method: 'POST', body: JSON.stringify(payload) })
}
export async function launchRole(payload: LaunchRoleRequest) {
  return api<{ ok: true; launch: LaunchRoleResponse }>('/api/paperclip/launch-role', { method: 'POST', body: JSON.stringify(payload) })
}
export async function resumeMission(missionId: string) {
  return api<{ ok: true; result: { mission: PaperclipMission; sessionId: string | null } }>('/api/paperclip/resume-mission', { method: 'POST', body: JSON.stringify({ missionId }) })
}
export async function routeNext(projectId: string) {
  return api<{ ok: true; recommendation: RouteNextAction }>(`/api/paperclip/route-next?projectId=${encodeURIComponent(projectId)}`)
}
