import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

/**
 * Goes back when there is somewhere to go back to, otherwise navigates to a
 * fallback screen. Plain router.back() throws "The action 'GO_BACK' was not
 * handled by any navigator" when a screen was opened directly — a deep link,
 * a notification, or a browser refresh on web.
 */
export function safeBack(router: Pick<Router, 'back' | 'canGoBack' | 'replace'>, fallback: string = '/(tabs)/home') {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as never);
  }
}
