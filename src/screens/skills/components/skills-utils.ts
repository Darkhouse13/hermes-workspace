import type { SkillSearchTier, SkillSummary } from './skills-types'

export function resolveSkillSearchTier(
  skill: SkillSummary,
  query: string,
): SkillSearchTier {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return 0

  if (skill.name.toLowerCase().includes(normalizedQuery)) return 0

  const tagText = skill.tags.join(' ').toLowerCase()
  const triggerText = skill.triggers.join(' ').toLowerCase()
  if (
    tagText.includes(normalizedQuery) ||
    triggerText.includes(normalizedQuery)
  ) {
    return 1
  }

  if (skill.description.toLowerCase().includes(normalizedQuery)) return 2
  return 3
}
