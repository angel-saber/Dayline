// Consume callback parameters before any later navigation can retain them.
// Only PKCE returns are accepted; arbitrary bearer tokens in URLs cannot log in.
export function takeSignInReturn(location, history) {
  const url = new URL(location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const code = url.searchParams.get('code');
  const failed = url.searchParams.has('error') || fragment.has('error');
  const implicit = fragment.has('access_token') || fragment.has('refresh_token');
  if (!code && !failed && !implicit) return null;
  for (const key of ['code', 'error', 'error_code', 'error_description'])
    url.searchParams.delete(key);
  url.hash = '';
  history.replaceState(null, '', `${url.pathname}${url.search}`);
  return failed || implicit
    ? { error: 'Please request a fresh sign-in link below and open it in the same browser.' }
    : { code };
}
