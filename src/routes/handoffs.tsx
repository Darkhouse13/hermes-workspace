
import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { HandoffsScreen } from '@/screens/handoffs/handoffs-screen'

export const Route = createFileRoute('/handoffs')({
  component: function HandoffsRoute() {
    usePageTitle('Handoffs')
    return <HandoffsScreen />
  },
})
