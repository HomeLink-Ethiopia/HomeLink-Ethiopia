/**
 * DoH DNS preload for MongoDB Atlas behind flaky/filtered local DNS.
 *
 * Context: on Ethio Telecom networks, plain UDP DNS (port 53) intermittently
 * fails entirely, so the Mongo driver cannot resolve *.mongodb.net hosts and
 * the backend falls into in-memory MOCK mode — data silently stops reaching
 * the real database. UDP 53 is broken, but outbound HTTPS (443) works.
 *
 * Loaded with `node -r scripts/doh-preload.js server.js`, this module patches
 * dns.lookup / dns.resolve4 so names ending in .mongodb.net are resolved via
 * DNS-over-HTTPS (Cloudflare first, Google fallback — both JSON APIs).
 * Everything else keeps using the OS resolver. No team files are modified.
 */
const https = require("https");
const dns = require("dns");

const SUFFIX = ".mongodb.net";
const RESOLVERS = ["https://cloudflare-dns.com/dns-query", "https://dns.google/resolve"];

const cache = new Map(); // name -> { ips, expires }
const CACHE_TTL_MS = 60_000;

function dohQuery(name, type) {
  const tryOne = (url) =>
    new Promise((resolve, reject) => {
      const full = url + "?name=" + encodeURIComponent(name) + "&type=" + type;
      const req = https.get(full, { headers: { accept: "application/dns-json" }, timeout: 5000 }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const j = JSON.parse(data);
            if (j.Status !== 0) return resolve(null);
            resolve(j.Answer || []);
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on("timeout", () => req.destroy(new Error("timeout")));
      req.on("error", reject);
    });

  return (async () => {
    let lastErr;
    for (const url of RESOLVERS) {
      try {
        const answer = await tryOne(url);
        if (answer) return answer;
      } catch (e) {
        lastErr = e;
      }
    }
    if (lastErr) throw lastErr;
    return [];
  })();
}

async function resolveViaDoh(name, type) {
  const key = name + "|" + type;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.ips;

  const answer = await dohQuery(name, type);
  const ips = [];
  const cnames = [];
  for (const a of answer) {
    if (a.type === 1) ips.push(a.data); // A
    else if (a.type === 28) ips.push(a.data); // AAAA
    else if (a.type === 5) cnames.push(a.data.replace(/\.$/, "")); // CNAME
  }
  // Follow CNAME chains (Atlas shards CNAME to mutable hostnames)
  for (const cname of cnames) {
    try {
      ips.push(...(await resolveViaDoh(cname, type)));
    } catch {}
  }
  cache.set(key, { ips, expires: Date.now() + CACHE_TTL_MS });
  return ips;
}

const isAtlas = (name) => typeof name === "string" && name.toLowerCase().endsWith(SUFFIX);

// Patch dns.lookup (used by net.connect / tls.connect with hostnames)
const origLookup = dns.lookup;
dns.lookup = function patchedLookup(name, opts, cb) {
  if (!isAtlas(name)) return origLookup.apply(this, arguments);
  if (typeof opts === "function") { cb = opts; opts = {}; }
  const family = (opts && opts.family) || 0;
  const all = !!(opts && opts.all);
  resolveViaDoh(name, family === 6 ? "AAAA" : "A")
    .then((ips) => {
      if (!ips.length) {
        const e = new Error("DoH: no addresses for " + name);
        e.code = "ENOTFOUND";
        return cb(e);
      }
      const use6 = family === 6;
      let picked = use6 ? ips.filter((i) => i.includes(":")) : ips.filter((i) => !i.includes(":"));
      if (!picked.length) picked = ips;
      if (all) {
        cb(null, picked.map((ip) => ({ address: ip, family: ip.includes(":") ? 6 : 4 })));
      } else {
        const ip = picked[0];
        cb(null, ip, ip.includes(":") ? 6 : 4);
      }
    })
    .catch((e) => cb(e));
};

// Patch resolve4/resolve6 (used by some driver code paths)
for (const [method, type] of [["resolve4", "A"], ["resolve6", "AAAA"]]) {
  const orig = dns[method].bind(dns);
  dns[method] = function patchedResolve(name, opts, cb) {
    if (!isAtlas(name)) return orig(name, opts, cb);
    if (typeof opts === "function") { cb = opts; opts = {}; }
    resolveViaDoh(name, type)
      .then((ips) => cb(null, ips.filter((i) => (type === "AAAA" ? i.includes(":") : !i.includes(":")))))
      .catch((e) => cb(e));
  };
}

// SRV support: resolve _mongodb._tcp.<cluster>.mongodb.net via DoH SRV records.
// The Mongo driver uses dns.promises.resolveSrv (and resolveTxt for the
// seedlist), so both the callback API and the promises API must be patched.
function parseSrv(answer) {
  return (answer || [])
    .filter((a) => a.type === 33)
    .map((a) => {
      const parts = a.data.trim().split(/\s+/); // priority weight port target
      return { priority: +parts[0], weight: +parts[1], port: +parts[2], name: parts[3].replace(/\.$/, "") };
    });
}

if (dns.resolveSrv) {
  const origResolveSrv = dns.resolveSrv.bind(dns);
  dns.resolveSrv = function patchedResolveSrv(name, cb) {
    if (!isAtlas(name)) return origResolveSrv(name, cb);
    dohQuery(name, "SRV").then((a) => cb(null, parseSrv(a))).catch((e) => cb(e));
  };
}
if (dns.promises && dns.promises.resolveSrv) {
  const origPromisesSrv = dns.promises.resolveSrv.bind(dns.promises);
  dns.promises.resolveSrv = async function patchedPromisesSrv(name) {
    if (!isAtlas(name)) return origPromisesSrv(name);
    return parseSrv(await dohQuery(name, "SRV"));
  };
}

// TXT records (mongodb+srv seedlist validation)
function parseTxt(answer) {
  return (answer || []).filter((a) => a.type === 16).map((a) => String(a.data).replace(/^"|"$/g, ""));
}
if (dns.resolveTxt) {
  const origResolveTxt = dns.resolveTxt.bind(dns);
  dns.resolveTxt = function patchedResolveTxt(name, cb) {
    if (!isAtlas(name)) return origResolveTxt(name, cb);
    dohQuery(name, "TXT").then((a) => cb(null, parseTxt(a).map((t) => [t]))).catch((e) => cb(e));
  };
}
if (dns.promises && dns.promises.resolveTxt) {
  const origPromisesTxt = dns.promises.resolveTxt.bind(dns.promises);
  dns.promises.resolveTxt = async function patchedPromisesTxt(name) {
    if (!isAtlas(name)) return origPromisesTxt(name);
    return parseTxt(await dohQuery(name, "TXT")).map((t) => [t]);
  };
}

// promises API for lookup/resolve4/resolve6 (driver uses these too)
if (dns.promises) {
  const origPromisesLookup = dns.promises.lookup.bind(dns.promises);
  dns.promises.lookup = async function patchedPromisesLookup(name, opts) {
    if (!isAtlas(name)) return origPromisesLookup(name, opts);
    const family = (opts && opts.family) || 0;
    const all = !!(opts && opts.all);
    const ips = await resolveViaDoh(name, family === 6 ? "AAAA" : "A");
    if (!ips.length) {
      const e = new Error("DoH: no addresses for " + name);
      e.code = "ENOTFOUND";
      throw e;
    }
    let picked = family === 6 ? ips.filter((i) => i.includes(":")) : ips.filter((i) => !i.includes(":"));
    if (!picked.length) picked = ips;
    if (all) return picked.map((ip) => ({ address: ip, family: ip.includes(":") ? 6 : 4 }));
    const ip = picked[0];
    return { address: ip, family: ip.includes(":") ? 6 : 4 };
  };
  for (const [method, type] of [["resolve4", "A"], ["resolve6", "AAAA"]]) {
    const orig = dns.promises[method].bind(dns.promises);
    dns.promises[method] = async function patchedPromisesResolve(name) {
      if (!isAtlas(name)) return orig(name);
      return (await resolveViaDoh(name, type)).filter((i) => (type === "AAAA" ? i.includes(":") : !i.includes(":")));
    };
  }

  // mongodb 7.x uses dns.promises.resolve(name, 'SRV'|'TXT') — patch the
  // generic resolver for Atlas names as well.
  const origPromisesResolve = dns.promises.resolve.bind(dns.promises);
  dns.promises.resolve = async function patchedPromisesResolveAny(name, rrtype) {
    if (!isAtlas(name)) return origPromisesResolve(name, rrtype);
    const t = String(rrtype || "A").toUpperCase();
    if (t === "SRV") return parseSrv(await dohQuery(name, "SRV"));
    if (t === "TXT") return parseTxt(await dohQuery(name, "TXT")).map((x) => [x]);
    if (t === "A" || t === "AAAA") {
      return (await resolveViaDoh(name, t)).filter((i) => (t === "AAAA" ? i.includes(":") : !i.includes(":")));
    }
    return origPromisesResolve(name, rrtype); // exotic types: OS resolver
  };
}

console.log("[doh-preload] DNS-over-HTTPS patch active for *.mongodb.net");
