import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { useAuthGate } from '@/config/AuthGateContext';
import { useServerConfig } from '@/config/ServerConfigContext';
import { captureSessionCookies } from '@/lib/session';

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// iOS auto-capitalizes the first letter of text inputs, which corrupts the
// Authelia username (and fails the login). The WebView has no autoCapitalize
// prop, so force the HTML attributes off on every non-password input. Authelia
// is a React SPA that renders the form after load, so we apply this three ways:
// at document-start (below, before content), on every DOM mutation, and again
// the instant a field is focused — so the attribute is in place before the
// keyboard appears no matter when the input renders.
const FIX_INPUT_CAPITALIZATION = `
(function () {
  var fixEl = function (el) {
    if (!el || el.tagName !== 'INPUT') return;
    if ((el.getAttribute('type') || 'text').toLowerCase() === 'password') return;
    el.setAttribute('autocapitalize', 'none');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('spellcheck', 'false');
  };
  var fixAll = function () {
    var inputs = document.querySelectorAll('input');
    for (var i = 0; i < inputs.length; i++) fixEl(inputs[i]);
  };
  fixAll();
  document.addEventListener('focusin', function (e) { fixEl(e.target); }, true);
  try {
    new MutationObserver(fixAll).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
})();
true;
`;

/**
 * Full-screen web login for proxy mode. Loads the Stash URL inside a WebView with
 * the system cookie jar enabled; the reverse proxy (Authelia, etc.) redirects to
 * its login page and back. Once we return to the Stash origin, the session cookie
 * is in the shared store and all native requests (GraphQL, images, video) carry
 * it automatically. Rendered as an absolute sibling of the router.
 */
export function LoginOverlay() {
  const { loginVisible, completeLogin, cancelLogin } = useAuthGate();
  const { serverURL } = useServerConfig();

  const [currentURL, setCurrentURL] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  if (!loginVisible || !serverURL) return null;

  const serverOrigin = originOf(serverURL);

  // Sign in through the page(s), then tap Done. We capture the WebView's session
  // cookies (timeout-bounded so it can't hang) and hand back to the app, which
  // replays them on its requests. No auto-detect (it false-fired on the
  // intermediate Stash login page and completed before login finished).
  async function done() {
    setClosing(true);
    if (serverURL) await captureSessionCookies(serverURL);
    completeLogin();
  }

  const hostLabel = currentURL ? originOf(currentURL) : serverOrigin;

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.bar}>
          <Pressable onPress={cancelLogin} hitSlop={12} style={styles.barBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.barTitle} numberOfLines={1}>
            {hostLabel ?? 'Sign in'}
          </Text>
          <Pressable onPress={done} hitSlop={12} style={styles.barBtn}>
            {closing ? <ActivityIndicator color="#e0245e" /> : <Text style={styles.doneText}>Done</Text>}
          </Pressable>
        </View>
        <WebView
          source={{ uri: serverURL }}
          onNavigationStateChange={(nav) => setCurrentURL(nav.url)}
          injectedJavaScriptBeforeContentLoaded={FIX_INPUT_CAPITALIZATION}
          injectedJavaScript={FIX_INPUT_CAPITALIZATION}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          domStorageEnabled
          javaScriptEnabled
          incognito={false}
          style={styles.web}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0a0a0b',
    zIndex: 900,
  },
  safe: { flex: 1, backgroundColor: '#0a0a0b' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  barBtn: { minWidth: 50 },
  barTitle: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  doneText: { color: '#e0245e', fontSize: 16, fontWeight: '700', textAlign: 'right' },
  web: { flex: 1, backgroundColor: '#fff' },
});
