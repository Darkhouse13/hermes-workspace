import type * as React from 'react'

type WelcomeStepProps = {
  mutedStyle: React.CSSProperties
  onConnect: () => void
  onSkip: () => void
}

export function WelcomeStep({ mutedStyle, onConnect, onSkip }: WelcomeStepProps) {
  return (
    <div className="space-y-4 text-center">
      <img
        src="/hermes-avatar.webp"
        alt="Hermes"
        className="mx-auto size-20 rounded-2xl"
        style={{
          filter: 'drop-shadow(0 8px 24px rgba(99,102,241,0.3))',
        }}
      />
      <h2 className="text-xl font-bold">Welcome to Hermes Workspace</h2>
      <p className="text-sm" style={mutedStyle}>
        Works with any OpenAI-compatible backend. Hermes gateway APIs
        unlock sessions, memory, skills, and other extras automatically.
      </p>
      <button
        onClick={onConnect}
        className="w-full rounded-xl bg-accent-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
      >
        Connect Backend
      </button>
      <button onClick={onSkip} className="text-xs" style={mutedStyle}>
        Skip setup
      </button>
    </div>
  )
}
