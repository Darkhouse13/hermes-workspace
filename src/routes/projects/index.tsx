
import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { ProjectsScreen } from '@/screens/projects/projects-screen'

export const Route = createFileRoute('/projects/')({
  component: function ProjectsIndexRoute() {
    usePageTitle('Projects')
    return <ProjectsScreen />
  },
})
