import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { useAuthGate } from '@/config/AuthGateContext';
import { useServerConfig } from '@/config/ServerConfigContext';

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// Reverse-proxy login pages (e.g. Authelia) often don't set autocapitalize on
// their username field, so iOS capitalizes the first letter and you can't enter a
// lowercase username. Force the right input attributes on every text field. Run
// before content loads so the MutationObserver is watching when Authelia (a SPA)
// renders the form, and re-apply on focus as a backstop.
const FIX_INPUTS_JS = `
(function() {
  function setIf(el, name, val) {
    if (el.getAttribute(name) !== val) el.setAttribute(name, val);
  }
  function fix() {
    var els = document.querySelectorAll('input, textarea');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if ((el.getAttribute('type') || '').toLowerCase() === 'password') continue;
      setIf(el, 'autocapitalize', 'none');
      setIf(el, 'autocorrect', 'off');
      setIf(el, 'spellcheck', 'false');
    }
  }
  function start() {
    fix();
    try {
      new MutationObserver(fix).observe(document.documentElement || document, {
        childList: true,
        subtree: true,
      });
    } catch (e) {}
    document.addEventListener('focusin', fix, true);
  }
  if (document.documentElement) start();
  else document.addEventListener('DOMContentLoaded', start);
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

  const sawForeignOrigin = useRef(false);
  const [currentURL, setCurrentURL] = useState<string | null>(null);

  if (!loginVisible || !serverURL) return null;

  const serverOrigin = originOf(serverURL);

  function onNavChange(nav: WebViewNavigation) {
    setCurrentURL(nav.url);
    if (nav.loading) return;
    const here = originOf(nav.url);
    if (here && here !== serverOrigin) {
      // We've been bounced to the SSO host (login page).
      sawForeignOrigin.current = true;
    } else if (here === serverOrigin && sawForeignOrigin.current) {
      // Returned to the Stash origin after authenticating → logged in.
      completeLogin();
    }
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
          <Pressable onPress={completeLogin} hitSlop={12} style={styles.barBtn}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
        <WebView
          source={{ uri: serverURL }}
          onNavigationStateChange={onNavChange}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          domStorageEnabled
          javaScriptEnabled
          incognito={false}
          injectedJavaScriptBeforeContentLoaded={FIX_INPUTS_JS}
          injectedJavaScript={FIX_INPUTS_JS}
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
