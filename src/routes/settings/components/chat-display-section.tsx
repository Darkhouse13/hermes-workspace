import { MessageMultiple01Icon } from '@hugeicons/core-free-icons'
import { Switch } from '@/components/ui/switch'
import { useChatSettingsStore } from '@/hooks/use-chat-settings'
import { SettingsSection, SettingsRow } from './settings-layout'

export function ChatDisplaySection() {
  const { settings: chatSettings, updateSettings: updateChatSettings } =
    useChatSettingsStore()

  return (
    <>
    <SettingsSection
      title="Chat Display"
      description="Control what's visible in chat messages."
      icon={MessageMultiple01Icon}
    >
      <SettingsRow
        label="Show tool messages"
        description="Display tool call details when the agent uses tools."
      >
        <Switch
          checked={chatSettings.showToolMessages}
          onCheckedChange={(checked) =>
            updateChatSettings({ showToolMessages: checked })
          }
          aria-label="Show tool messages"
        />
      </SettingsRow>
      <SettingsRow
        label="Show reasoning blocks"
        description="Display model thinking and reasoning process."
      >
        <Switch
          checked={chatSettings.showReasoningBlocks}
          onCheckedChange={(checked) =>
            updateChatSettings({ showReasoningBlocks: checked })
          }
          aria-label="Show reasoning blocks"
        />
      </SettingsRow>
    </SettingsSection>
    {/* Mobile Navigation removed — not relevant for Hermes Workspace */}
    </>
  )
}
