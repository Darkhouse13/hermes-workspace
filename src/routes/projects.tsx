
import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/projects')({
  component: function ProjectsLayoutRoute() {
    return <Outlet />
  },
})
