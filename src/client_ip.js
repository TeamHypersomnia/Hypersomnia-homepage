/*
  The address a request came from, for the per-address limits: X-Real-IP only from nginx on this machine -
  anyone reaching the port directly could otherwise claim any address in it.
*/

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function clientIp(req) {
  const direct = req.socket && req.socket.remoteAddress;

  if (LOOPBACK.has(direct) && typeof req.headers['x-real-ip'] === 'string' && req.headers['x-real-ip']) {
    return req.headers['x-real-ip'];
  }

  return direct || req.ip;
}

module.exports = { clientIp };
