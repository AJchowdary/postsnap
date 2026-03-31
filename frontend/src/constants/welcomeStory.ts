/**
 * First-launch welcome carousel before onboarding. Bump version to show the story again.
 */
export const WELCOME_STORY_VERSION = 1 as const;

export function welcomeStorySeenStorageKey(version: number = WELCOME_STORY_VERSION): string {
  return `welcome_story_seen_v${version}`;
}
