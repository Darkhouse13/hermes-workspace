
import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { ApprovalsScreen } from '@/screens/approvals/approvals-screen'

export const Route = createFileRoute('/approvals')({
  component: function ApprovalsRoute() {
    usePageTitle('Approvals')
    return <ApprovalsScreen />
  },
})
