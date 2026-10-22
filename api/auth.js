/* Acceso al panel: ingreso, salida, estado de la sesión y cambio de contraseña.
   POST /api/auth?a=login | logout | password     GET /api/auth?a=session */
'use strict';
const L = require('./_lib');

const secure = req => !/^(localhost|127\.|\[::1\])/.test(String(req.headers.host || ''));
const setCookie = (req, res, val, age) => res.setHeader('Set-Cookie', L.cookie('setp_admin', val, age).replace(secure(req) ? '' : '; Secure', ''));

module.exports = async function handler(req, res) {
  try {
    const a = L.query(req).a;

    if (a === 'session' && req.method === 'GET') {
      const conf = { almacenamiento: L.hasStorage(), credenciales: false };
      if (!conf.almacenamiento) return L.send(res, 200, { autenticado: false, configurado: conf });
      conf.credenciales = await L.hasCredentials();
      const s = await L.readSession(req);
      return L.send(res, 200, { autenticado: !!s, usuario: s ? s.u : null, configurado: conf, horas: L.SESSION_HOURS });
    }

    if (req.method !== 'POST') return L.send(res, 405, { error: 'metodo' });
    if (!L.csrfOk(req)) return L.send(res, 403, { error: 'origen_invalido', mensaje: 'Solicitud no permitida.' });
    if (!L.hasStorage()) return L.send(res, 503, { error: 'sin_almacenamiento', mensaje: 'Falta conectar el almacenamiento (Upstash Redis) en Vercel.' });
    const body = await L.readBody(req, 20000);

    if (a === 'login') {
      if (!(await L.hasCredentials())) return L.send(res, 503, { error: 'sin_credenciales', mensaje: 'Falta configurar las variables ADMIN_USER y ADMIN_PASSWORD en Vercel.' });
      const ac = body.acepta || {};
      if (ac.terminos !== true || ac.privacidad !== true) return L.send(res, 400, { error: 'consentimiento', mensaje: 'Debes aceptar por separado los Términos y Condiciones y la Política de Privacidad.' });
      const ip = L.clientIp(req);
      if ((await L.failCount(ip)) >= 8) return L.send(res, 429, { error: 'bloqueado', mensaje: 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.' });
      const ok = await L.checkCredentials(body.usuario, body.clave);
      if (!ok) { await L.failHit(ip); await L.sleep(700 + Math.floor(Math.random() * 400)); return L.send(res, 401, { error: 'credenciales', mensaje: 'Usuario o contraseña incorrectos.' }); }
      await L.failClear(ip);
      await L.setJSON('setp:acept:' + String(body.usuario).slice(0, 60), { ts: Date.now(), terminos: '1.0', privacidad: '1.0' }); /* constancia de la autorización (Decreto 1377 de 2013) */
      setCookie(req, res, await L.signSession(String(body.usuario)), L.SESSION_HOURS * 3600);
      return L.send(res, 200, { ok: true, usuario: String(body.usuario), horas: L.SESSION_HOURS });
    }

    if (a === 'logout') { setCookie(req, res, '', 0); return L.send(res, 200, { ok: true }); }

    if (a === 'password') {
      const s = await L.readSession(req);
      if (!s) return L.send(res, 401, { error: 'no_autenticado', mensaje: 'Tu sesión terminó. Ingresa de nuevo.' });
      if (!(await L.checkCredentials(s.u, body.actual))) { await L.sleep(700); return L.send(res, 400, { error: 'clave_actual', mensaje: 'La contraseña actual no es correcta.' }); }
      if (!L.passwordOk(body.nueva)) return L.send(res, 400, { error: 'clave_debil', mensaje: 'La nueva contraseña debe tener al menos 10 caracteres, con mayúscula, minúscula y número.' });
      if (body.nueva === body.actual) return L.send(res, 400, { error: 'clave_igual', mensaje: 'La nueva contraseña debe ser distinta de la actual.' });
      await L.storeCredentials(s.u, body.nueva);
      setCookie(req, res, await L.signSession(s.u), L.SESSION_HOURS * 3600);
      return L.send(res, 200, { ok: true });
    }
    return L.send(res, 404, { error: 'no_existe' });
  } catch (e) {
    return L.send(res, e && e.status ? e.status : 500, { error: 'error', mensaje: e && e.status ? 'Solicitud no válida.' : 'Ocurrió un error. Inténtalo de nuevo.' });
  }
};
