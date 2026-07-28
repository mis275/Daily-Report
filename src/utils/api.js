/**
 * Safely fetches JSON from an API endpoint (such as Google Apps Script Web App).
 * Gracefully handles non-OK status codes, non-JSON HTML error pages (e.g. 404 Not Found,
 * Google sign-in redirects, or server error pages), and JSON parsing errors.
 */
export async function safeFetchJson(url, options = {}) {
  const resp = await fetch(url, options);
  const text = await resp.text();

  if (!resp.ok) {
    throw new Error(`Server returned status ${resp.status}${resp.statusText ? ': ' + resp.statusText : ''}.`);
  }

  const trimmed = text.trim();
  if (trimmed.startsWith('<') || trimmed.toLowerCase().startsWith('<!doctype')) {
    throw new Error(
      'Received HTML error page instead of JSON. Please verify that your Google Apps Script URL is correct and deployed with access set to "Anyone".'
    );
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse JSON response: ${err.message}`);
  }
}
