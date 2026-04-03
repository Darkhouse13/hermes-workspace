export type SkillsTab = 'installed' | 'marketplace' | 'featured'
export type SkillsSort = 'name' | 'category'

export type SecurityRisk = {
  level: 'safe' | 'low' | 'medium' | 'high'
  flags: Array<string>
  score: number
}

export type SkillSummary = {
  id: string
  slug: string
  name: string
  description: string
  author: string
  triggers: Array<string>
  tags: Array<string>
  homepage: string | null
  category: string
  icon: string
  content: string
  fileCount: number
  sourcePath: string
  installed: boolean
  enabled: boolean
  featuredGroup?: string
  security?: SecurityRisk
}

export type SkillsApiResponse = {
  skills: Array<SkillSummary>
  total: number
  page: number
  categories: Array<string>
}

export type SkillSearchTier = 0 | 1 | 2 | 3

export const PAGE_LIMIT = 30

export const DEFAULT_CATEGORIES = [
  'All',
  'Web & Frontend',
  'Coding Agents',
  'Git & GitHub',
  'DevOps & Cloud',
  'Browser & Automation',
  'Image & Video',
  'Search & Research',
  'AI & LLMs',
  'Productivity',
  'Marketing & Sales',
  'Communication',
  'Data & Analytics',
  'Finance & Crypto',
]
