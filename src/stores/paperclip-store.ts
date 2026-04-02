
import { create } from 'zustand'
import type { PaperclipApproval, PaperclipHandoff, PaperclipMission, PaperclipProjectDetail, PaperclipProjectSummary, RouteNextAction } from '@/types/paperclip'
import * as api from '@/lib/paperclip-api'

type PaperclipStore = {
  projects: Array<PaperclipProjectSummary>
  currentProject: PaperclipProjectDetail | null
  missions: Array<PaperclipMission>
  handoffs: Array<PaperclipHandoff>
  approvals: Array<PaperclipApproval>
  recommendation: RouteNextAction | null
  loading: boolean
  error: string | null
  projectFilter: string
  missionFilter: string
  handoffFilter: string
  approvalFilter: string
  setProjectFilter: (value: string) => void
  setMissionFilter: (value: string) => void
  setHandoffFilter: (value: string) => void
  setApprovalFilter: (value: string) => void
  fetchProjects: () => Promise<void>
  fetchProjectDetail: (projectId: string) => Promise<void>
  fetchMissions: (projectId?: string) => Promise<void>
  fetchHandoffs: (projectId?: string) => Promise<void>
  fetchApprovals: (projectId?: string) => Promise<void>
  fetchRecommendation: (projectId: string) => Promise<void>
  createProject: (payload: Record<string, unknown>) => Promise<void>
  createMission: (payload: Record<string, unknown>) => Promise<void>
  createHandoff: (payload: Record<string, unknown>) => Promise<void>
  launchRole: (payload: any) => Promise<void>
  updateMission: (missionId: string, payload: Record<string, unknown>) => Promise<void>
  updateApproval: (payload: Record<string, unknown>) => Promise<void>
}

async function withLoad<T>(set: any, fn: () => Promise<T>): Promise<T> {
  set({ loading: true, error: null })
  try {
    const result = await fn()
    set({ loading: false })
    return result
  } catch (error) {
    set({ loading: false, error: error instanceof Error ? error.message : String(error) })
    throw error
  }
}

export const usePaperclipStore = create<PaperclipStore>((set, get) => ({
  projects: [],
  currentProject: null,
  missions: [],
  handoffs: [],
  approvals: [],
  recommendation: null,
  loading: false,
  error: null,
  projectFilter: '',
  missionFilter: '',
  handoffFilter: '',
  approvalFilter: '',
  setProjectFilter: (value) => set({ projectFilter: value }),
  setMissionFilter: (value) => set({ missionFilter: value }),
  setHandoffFilter: (value) => set({ handoffFilter: value }),
  setApprovalFilter: (value) => set({ approvalFilter: value }),
  fetchProjects: () => withLoad(set, async () => set({ projects: (await api.listProjects()).items })),
  fetchProjectDetail: (projectId) => withLoad(set, async () => set({ currentProject: (await api.getProject(projectId)).detail })),
  fetchMissions: (projectId) => withLoad(set, async () => set({ missions: (await api.listMissions(projectId)).items })),
  fetchHandoffs: (projectId) => withLoad(set, async () => set({ handoffs: (await api.listHandoffs(projectId)).items })),
  fetchApprovals: (projectId) => withLoad(set, async () => set({ approvals: (await api.listApprovals(projectId)).items })),
  fetchRecommendation: (projectId) => withLoad(set, async () => set({ recommendation: (await api.routeNext(projectId)).recommendation })),
  createProject: (payload) => withLoad(set, async () => { await api.createProject(payload); await get().fetchProjects() }),
  createMission: (payload) => withLoad(set, async () => {
    await api.createMission(payload)
    await get().fetchMissions(String(payload.projectId || ''))
    await get().fetchProjectDetail(String(payload.projectId || ''))
  }),
  createHandoff: (payload) => withLoad(set, async () => {
    await api.createHandoff(payload)
    await get().fetchHandoffs(String(payload.projectId || ''))
    await get().fetchProjectDetail(String(payload.projectId || ''))
  }),
  launchRole: (payload) => withLoad(set, async () => {
    await api.launchRole(payload)
    await get().fetchProjectDetail(String(payload.projectId || ''))
    await get().fetchMissions(String(payload.projectId || ''))
    await get().fetchRecommendation(String(payload.projectId || ''))
  }),
  updateMission: (missionId, payload) => withLoad(set, async () => {
    const mission = (await api.updateMission(missionId, payload)).mission
    await get().fetchMissions(mission.projectId)
    await get().fetchProjectDetail(mission.projectId)
    await get().fetchHandoffs(mission.projectId)
    await get().fetchApprovals(mission.projectId)
  }),
  updateApproval: (payload) => withLoad(set, async () => {
    const approval = (await api.updateApproval(payload)).approval
    await get().fetchApprovals(approval.projectId)
    await get().fetchProjectDetail(approval.projectId)
  }),
}))
