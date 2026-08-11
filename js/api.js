/**
 * Wrapper de fetch contra la API de Apps Script.
 *
 * GET: query string normal, sin problema de CORS.
 * POST: se manda con Content-Type "text/plain;charset=utf-8" a propósito.
 * Si se manda como "application/json", el navegador dispara un preflight
 * OPTIONS que Apps Script Web Apps no puede responder, y falla. Con
 * text/plain el navegador lo trata como "solicitud simple" y funciona.
 * El body sigue siendo JSON válido - Code.gs lo parsea con JSON.parse().
 */

async function apiGet(route, params) {
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set("route", route);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString(), { method: "GET" });
  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

async function apiPost(route, payload) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ route, ...payload }),
  });
  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}
