/**
 * Wrapper de fetch contra la API de Apps Script.
 *
 * GET: query string normal, sin problema de CORS.
 * POST: se manda con Content-Type "text/plain;charset=utf-8" a propósito.
 * Si se manda como "application/json", el navegador dispara un preflight
 * OPTIONS que Apps Script Web Apps no puede responder, y falla. Con
 * text/plain el navegador lo trata como "solicitud simple" y funciona.
 * El body sigue siendo JSON válido - Code.gs lo parsea con JSON.parse().
 *
 * Manejo de errores: toda llamada tiene un timeout (por defecto 15s) y hasta
 * 2 reintentos automáticos con backoff corto - Apps Script a veces tarda en
 * "despertar" (cold start) y una sola llamada lenta no debe dejar la
 * pantalla colgada para siempre. Si after eso sigue fallando, se lanza un
 * Error con mensaje entendible para mostrarlo en pantalla.
 */

const API_TIMEOUT_MS = 15000;
const API_REINTENTOS = 2;

const _cacheGet = new Map(); // key -> { data, expira }

function _fetchConTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function _parsearRespuesta(res) {
  if (!res.ok) {
    throw new Error("El servidor respondió con error " + res.status + ". Probá de nuevo en unos segundos.");
  }
  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error("La respuesta no fue JSON válido. Verificá que la URL de config.js sea la del deploy actual de Apps Script.");
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

function _mensajeErrorAmigable(err) {
  if (err.name === "AbortError") {
    return "El servidor tardó demasiado en responder (más de " + (API_TIMEOUT_MS / 1000) + "s). Puede ser Apps Script iniciando en frío - probá de nuevo.";
  }
  if (err instanceof TypeError) {
    return "No se pudo conectar con el servidor. Revisá tu conexión, o si la URL en config.js sigue siendo válida.";
  }
  return err.message || String(err);
}

async function _conReintentos(fn) {
  let ultimoError;
  for (let intento = 0; intento <= API_REINTENTOS; intento++) {
    try {
      return await fn();
    } catch (err) {
      ultimoError = err;
      if (err.name === "AbortError" || err instanceof TypeError) {
        // solo reintenta fallas de red/timeout, no errores de negocio (esos vienen del backend y no se van a resolver solos)
        if (intento < API_REINTENTOS) {
          await new Promise(r => setTimeout(r, 400 * (intento + 1)));
          continue;
        }
      }
      break;
    }
  }
  const amigable = new Error(_mensajeErrorAmigable(ultimoError));
  amigable.original = ultimoError;
  throw amigable;
}

/**
 * cacheKey/cacheMs opcionales: si se pasan, cachea la respuesta en memoria
 * por ese tiempo (para datos que casi no cambian, como sectores/personal,
 * y evitar pegarle a Apps Script de nuevo en cada pantalla).
 */
async function apiGet(route, params, { cacheMs } = {}) {
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set("route", route);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });
  const urlStr = url.toString();

  if (cacheMs) {
    const cacheado = _cacheGet.get(urlStr);
    if (cacheado && cacheado.expira > Date.now()) return cacheado.data;
  }

  const data = await _conReintentos(async () => {
    const res = await _fetchConTimeout(urlStr, { method: "GET" });
    return _parsearRespuesta(res);
  });

  if (cacheMs) _cacheGet.set(urlStr, { data, expira: Date.now() + cacheMs });
  return data;
}

async function apiPost(route, payload) {
  return _conReintentos(async () => {
    const res = await _fetchConTimeout(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ route, ...payload }),
    });
    return _parsearRespuesta(res);
  });
}

function limpiarCacheApi() {
  _cacheGet.clear();
}
