
import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { MissionsScreen } from '@/screens/missions/missions-screen'

export const Route = createFileRoute('/missions')({
  component: function MissionsRoute() {
    usePageTitle('Missions')
    return <MissionsScreen />
  },
})
