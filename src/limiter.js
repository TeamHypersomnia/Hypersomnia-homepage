const net = require('net');

// An IPv6 address counts as its /64 - one home usually holds a whole one and may switch addresses within it
function limitKey(ip) {
  if (!net.isIPv6(ip) || ip.startsWith('::ffff:')) return ip;

  const [head, tail = ''] = ip.split('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail ? tail.split(':') : [];
  const missing = Array(8 - headGroups.length - tailGroups.length).fill('0');

  return [...headGroups, ...missing, ...tailGroups].slice(0, 4).join(':') + '::/64';
}

/*
  Requests per minute, per address and (optionally) in all. Only what an address was allowed counts in all,
  so that one address over its own limit can not use up everyone's.
*/
function makeLimiter({ perAddress, total = Infinity, keyOf = limitKey }) {
  const counts = new Map();
  let all = 0;
  let windowStart = Date.now();

  return function allow(ip) {
    const now = Date.now();

    if (now - windowStart > 60 * 1000) {
      counts.clear();
      all = 0;
      windowStart = now;
    }

    const key = keyOf(ip);
    const count = (counts.get(key) || 0) + 1;
    counts.set(key, count);

    if (count > perAddress) return false;

    return ++all <= total;
  };
}

// An IPv4 address counts as its /24, an IPv6 one as its /48 - for limits that a handful of hosts must not get around
function wideLimitKey(ip) {
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;

  if (net.isIPv4(v4)) {
    return v4.split('.').slice(0, 3).join('.') + '.0/24';
  }

  return limitKey(ip).split(':').slice(0, 3).join(':') + '::/48';
}

module.exports = { limitKey, wideLimitKey, makeLimiter };
