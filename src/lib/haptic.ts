/**
 * Provides gentle tactile haptic feedback on supported mobile devices (Vibration API).
 * Silently ignored on unsupported browsers or desktop environments.
 */
export function triggerHapticFeedback(pattern: number | number[] = 25): void {
  if (typeof window !== "undefined" && typeof window.navigator !== "undefined" && "vibrate" in window.navigator) {
    try {
      window.navigator.vibrate(pattern);
    } catch {
      // Ignored if vibration is blocked by user settings or permissions
    }
  }
}
