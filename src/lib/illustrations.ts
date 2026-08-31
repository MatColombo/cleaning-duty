export const illustrationManifest = {
  homeMark: { path: '/illustrations/home-mark.svg', use: 'brand mark' },
  emptyOverview: { path: '/illustrations/empty-overview.svg', use: 'empty Overview' },
  allDone: { path: '/illustrations/all-done.svg', use: 'all planned work handled' },
  emptyRoom: { path: '/illustrations/empty-room.svg', use: 'empty room' },
  pausedRoutine: { path: '/illustrations/paused-routine.svg', use: 'paused routine' },
  onboardingHome: { path: '/illustrations/onboarding-home.svg', use: 'first-home onboarding' },
  offline: { path: '/illustrations/offline.svg', use: 'offline state' },
} as const

export type IllustrationId = keyof typeof illustrationManifest
