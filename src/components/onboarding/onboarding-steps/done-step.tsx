import type * as React from 'react'

type DoneStepProps = {
  mutedStyle: React.CSSProperties
  cardStyle: React.CSSProperties
  enhancedFeatures: Array<string>
  onComplete: () => void
}

export function DoneStep({
  mutedStyle,
  cardStyle,
  enhancedFeatures,
  onComplete,
}: DoneStepProps) {
  return (
    <div className="space-y-4 text-center">
      <div className="text-5xl">🎉</div>
      <h2 className="text-xl font-bold">Workspace Ready</h2>
      <p className="text-sm" style={mutedStyle}>
        Core chat is set up.{' '}
        {enhancedFeatures.length > 0
          ? 'This backend also exposes Hermes gateway enhancements.'
          : 'If you later connect a Hermes gateway, enhanced features unlock automatically.'}
      </p>
      <div
        className="grid grid-cols-3 gap-2 text-xs"
        style={mutedStyle}
      >
        <div className="rounded-xl p-2" style={cardStyle}>
          <div className="mb-1 text-lg">💬</div>
          <div>Chat Ready</div>
        </div>
        <div className="rounded-xl p-2" style={cardStyle}>
          <div className="mb-1 text-lg">🔗</div>
          <div>
            {enhancedFeatures.length > 0 ? 'Enhanced' : 'Portable'}
          </div>
        </div>
        <div className="rounded-xl p-2" style={cardStyle}>
          <div className="mb-1 text-lg">🧠</div>
          <div>
            {enhancedFeatures.length > 0
              ? enhancedFeatures.length
              : 'Optional'}{' '}
            Extras
          </div>
        </div>
      </div>
      {enhancedFeatures.length > 0 ? (
        <p className="text-xs" style={mutedStyle}>
          Available now: {enhancedFeatures.join(', ')}.
        </p>
      ) : null}
      <button
        onClick={onComplete}
        className="w-full rounded-xl bg-accent-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
      >
        Open Workspace
      </button>
    </div>
  )
}
