
import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { ProjectDetailScreen } from '@/screens/projects/project-detail-screen'

export const Route = createFileRoute('/projects/$projectId')({
  component: function ProjectDetailRoute() {
    const { projectId } = Route.useParams()
    usePageTitle('Project')
    return <ProjectDetailScreen projectId={projectId} />
  },
})
