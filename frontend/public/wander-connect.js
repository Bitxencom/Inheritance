(function (exports) {
  'use strict';

  // wallet-api-dist/wallet-sdk.es.js
  var Xt = Object.defineProperty;
  var Yt = (i, l, m) => l in i ? Xt(i, l, { enumerable: true, configurable: true, writable: true, value: m }) : i[l] = m;
  var $ = (i, l, m) => Yt(i, typeof l != "symbol" ? l + "" : l, m);
  var Be = (i = 21) => crypto.getRandomValues(new Uint8Array(i)).reduce((l, m) => (m &= 63, m < 36 ? l += m.toString(36) : m < 62 ? l += (m - 26).toString(36).toUpperCase() : m > 62 ? l += "-" : l += "_", l), "");
  var Zt = {
    functionName: "getPermissions",
    permissions: []
  };
  var Qt = () => {
  };
  var er = ["ACCESS_ADDRESS"];
  var tr = {
    functionName: "getActiveAddress",
    permissions: er
  };
  var rr = () => {
  };
  var nr = ["ACCESS_ALL_ADDRESSES"];
  var ir = {
    functionName: "getAllAddresses",
    permissions: nr
  };
  var ar = () => {
  };
  var sr = ["ACCESS_PUBLIC_KEY"];
  var or = {
    functionName: "getActivePublicKey",
    permissions: sr
  };
  var cr = () => {
  };
  var ur = ["ACCESS_ALL_ADDRESSES"];
  var fr = {
    functionName: "getWalletNames",
    permissions: ur
  };
  var lr = () => {
  };
  var hr = ["ACCESS_ARWEAVE_CONFIG"];
  var dr = {
    functionName: "getArweaveConfig",
    permissions: hr
  };
  var pr = () => {
  };
  var wr = [];
  var gr = {
    functionName: "disconnect",
    permissions: wr
  };
  var yr = () => {
  };
  var mr = () => {
    dispatchEvent(
      new CustomEvent("walletSwitch", {
        detail: { address: void 0 }
      })
    );
  };
  var Er = [];
  var Ar = {
    functionName: "addToken",
    permissions: Er
  };
  var vr = (i, l, m) => (m && typeof m != "string" && (m = void 0, console.warn("Gateway is deprecated for tokens. Provide a DRE node instead.")), [i, l, m]);
  var Tr = [];
  var Sr = {
    functionName: "isTokenAdded",
    permissions: Tr
  };
  var _r = () => {
  };
  var Nr = [];
  var Ir = {
    functionName: "connect",
    permissions: Nr
  };
  var Br = [
    {
      host: "arweave.net",
      port: 443,
      protocol: "https"
    },
    {
      host: "ar-io.net",
      port: 443,
      protocol: "https"
    },
    {
      host: "arweave.dev",
      port: 443,
      protocol: "https"
    },
    {
      host: "g8way.io",
      port: 443,
      protocol: "https"
    }
  ];
  var xr = Br[0];
  function kr(i) {
    return i ? new URL(i).host : "";
  }
  var Ur = -42;
  var Rr = -420;
  var ve;
  var Dr = /(\d+)x\d+/;
  var Cr = 2e3;
  var br = 1e3;
  var Ge = (i, l = window.location.origin) => {
    if (i)
      try {
        return new URL(i, l).href;
      } catch {
      }
  };
  var Mt = async (i, l = {}, m = Cr) => {
    const p = new AbortController(), c = setTimeout(() => p.abort(), m);
    try {
      return await fetch(i, {
        ...l,
        signal: p.signal
      });
    } finally {
      clearTimeout(c);
    }
  };
  var ft = (i) => {
    var m;
    if (!((m = i.sizes) != null && m.value)) return 0;
    const l = i.sizes.value.match(Dr);
    return l ? parseInt(l[1], 10) : 0;
  };
  var Or = async () => {
    var m;
    const i = document.querySelector("link[rel='manifest']");
    if (!(i instanceof HTMLLinkElement)) return;
    const l = Ge(i.href);
    if (l)
      try {
        const p = await Mt(l, {
          method: "GET",
          cache: "force-cache",
          credentials: "same-origin"
        });
        if (!p.ok)
          throw new Error(`Failed to fetch manifest: ${p.status}`);
        const c = await p.json();
        if (!((m = c.icons) != null && m.length)) return;
        const h = c.icons.filter((a) => a == null ? void 0 : a.src);
        if (!h.length) return;
        const u = h.sort((a, y) => {
          var N, I, D, q;
          const v = a.type === "image/svg+xml" || ((N = a.src) == null ? void 0 : N.endsWith(".svg")), S = y.type === "image/svg+xml" || ((I = y.src) == null ? void 0 : I.endsWith(".svg"));
          if (v && !S) return -1;
          if (!v && S) return 1;
          const _ = parseInt(((D = a.sizes) == null ? void 0 : D.split("x")[0]) || "0", 10);
          return parseInt(((q = y.sizes) == null ? void 0 : q.split("x")[0]) || "0", 10) - _;
        });
        return Ge(u[0].src, l);
      } catch (p) {
        console.error("Error fetching web app manifest:", p);
      }
  };
  var Fr = () => {
    const i = [
      "link[rel='icon'][type='image/svg+xml']",
      "link[rel='icon']",
      "link[rel='apple-touch-icon']",
      "link[rel='apple-touch-icon-precomposed']",
      "link[rel='shortcut icon']",
      "img[alt*='logo']",
      "img[src*='logo']"
    ];
    for (const l of i) {
      const m = document.querySelectorAll(l);
      if (!m.length) continue;
      const p = Array.from(m).filter(
        (u) => u instanceof HTMLLinkElement && u.href || u instanceof HTMLImageElement && u.src
      );
      if (!p.length) continue;
      p.sort((u, a) => u instanceof HTMLLinkElement && a instanceof HTMLLinkElement ? ft(a) - ft(u) : 0);
      const c = p[0];
      let h;
      if (c instanceof HTMLLinkElement ? h = Ge(c.href) : c instanceof HTMLImageElement && (h = Ge(c.src)), h) return h;
    }
  };
  var Mr = async () => {
    const i = `${window.location.origin}/favicon.ico`;
    try {
      return (await Mt(i, { method: "HEAD" }, br)).ok ? i : void 0;
    } catch {
    }
  };
  async function $r() {
    if (ve) return ve;
    try {
      const i = await Or();
      if (i)
        return ve = i, i;
      const l = Fr();
      if (l)
        return ve = l, l;
      const m = await Mr();
      return ve = m, m;
    } catch (i) {
      console.error("Error in getAppLogo:", i), ve = void 0;
    }
  }
  var Lr = async (i, l = {}, m) => {
    if (!i || i.length === 0)
      throw new Error("No permissions requested");
    if (!l.name) {
      const p = document.title, c = kr(window.location.href);
      l.name = p.length < 11 ? p : c;
    }
    return l.logo || (l.logo = await $r()), [i, l, m];
  };
  var Pr = ["SIGN_TRANSACTION"];
  var qr = {
    functionName: "sign",
    permissions: Pr
  };
  function $t(i) {
    const l = document.createElement("img"), m = { x: 0, y: 0 }, p = `ar-coin-animation-${document.querySelectorAll(".ar-coing-animation").length}`;
    let c = 100;
    l.setAttribute("src", i), l.setAttribute("alt", "a"), l.style.position = "fixed", l.style.bottom = "0", l.style.right = `${Math.floor(Math.random() * 30)}px`, l.style.width = "18px", l.style.zIndex = "1000000", l.style.transition = "all .23s ease", l.id = p, l.classList.add("ar-coing-animation"), document.body.appendChild(l);
    const h = setInterval(() => {
      var u;
      if (c < 0)
        return (u = document.querySelector(`#${p}`)) == null || u.remove(), clearInterval(h);
      c -= 6.5, m.x += Math.floor(Math.random() * 30) - 10, m.y += Math.floor(Math.random() * 24), l.style.transform = `translate(-${m.x}px, -${m.y}px)`, l.style.opacity = `${c / 100}`;
    }, 100);
  }
  function Hr(i) {
    return !!i && typeof i == "object" && i.hasOwnProperty("callID") && i.hasOwnProperty("type") && i.hasOwnProperty("data");
  }
  function st(i) {
    return Hr(i) && !!i.error;
  }
  var Wr = { NODE_ENV: "production" };
  var { search: Kr = "", ancestorOrigins: lt = [] } = typeof document < "u" ? document.location : {};
  var me = new URLSearchParams(Kr);
  var Lt = lt[lt.length - 1];
  function je() {
    try {
      return typeof window < "u" && (window.self !== window.top || !!Lt);
    } catch {
      return true;
    }
  }
  var Pt = Wr.NODE_ENV;
  var zr = {
    development: {
      DEFAULT_EMBEDDED_CLIENT_ID: "ALPHA",
      DEFAULT_EMBEDDED_SERVER_BASE_URL: "https://connect-api-dev.wander.app"
    },
    production: {
      DEFAULT_EMBEDDED_CLIENT_ID: "ALPHA",
      DEFAULT_EMBEDDED_SERVER_BASE_URL: "https://connect-api-dev.wander.app"
    },
    test: {
      DEFAULT_EMBEDDED_CLIENT_ID: "test",
      DEFAULT_EMBEDDED_SERVER_BASE_URL: "https://test.com"
    }
  };
  var ot = zr[Pt];
  if (!ot) throw new Error(`Missing ENV vars for NODE_ENV = "${Pt}"`);
  var jr = "client-id";
  var Vr = "theme";
  var Gr = "ancestor-origin";
  var Jr = "hide-be";
  var Xr = "injected-be";
  var Yr = "server-base-url";
  var Zr = "skip-storage-access-warning";
  me.get(jr) || ot.DEFAULT_EMBEDDED_CLIENT_ID;
  me.get(Vr);
  var Qr = Lt || me.get(Gr);
  me.get(Jr);
  me.get(Xr);
  me.get(Yr) || ot.DEFAULT_EMBEDDED_SERVER_BASE_URL;
  me.get(Zr);
  function at() {
    return Qr;
  }
  var et = { NODE_ENV: "production" };
  var ye = /* @__PURE__ */ ((i) => (i.API = "API", i.AUTH = "AUTH", i.CHUNKS = "CHUNKS", i.EMBEDDED_FLOWS = "EMBEDDED_FLOWS", i.GATEWAYS = "GATEWAYS", i.MSG = "MSG", i.ROUTING = "ROUTING", i.SETUP = "SETUP", i.WALLET_GENERATION = "WALLET_GENERATION", i.SESSION = "SESSION", i.STORAGE = "STORAGE", i.AGENTS = "AGENTS", i.TIERS = "TIERS", i.TRANSAK = "TRANSAK", i.FAIR_LAUNCH = "FAIR_LAUNCH", i.TRANSACTIONS = "TRANSACTIONS", i.EARN = "EARN", i.SWAP = "SWAP", i.ARNS = "ARNS", i))(ye || {});
  var en = {
    API: false,
    AUTH: et.NODE_ENV === "development",
    CHUNKS: false,
    EMBEDDED_FLOWS: false,
    GATEWAYS: false,
    MSG: false,
    ROUTING: false,
    SETUP: false,
    WALLET_GENERATION: false,
    SESSION: false,
    STORAGE: false,
    AGENTS: false,
    TIERS: false,
    TRANSAK: false,
    FAIR_LAUNCH: false,
    TRANSACTIONS: false,
    EARN: false,
    SWAP: et.NODE_ENV === "development",
    ARNS: et.NODE_ENV === "development"
  };
  function tn() {
    const { pathname: i } = location;
    return i.includes("auth.html") ? "color: yellow;" : "color: inherit;";
  }
  function _e(i, ...l) {
    if (!en[i]) return;
    const m = location.protocol === "chrome-extension:" ? "" : "[Wander] ";
    console.log(`${m}%c[${i}]`, tn(), ...l);
  }
  var qt = {};
  var Ht = null;
  var Wt = "";
  var rn = {
    auth_chunk: "background",
    event: "background",
    switch_wallet_event: "background",
    copy_address: "background"
  };
  function nn(i) {
    Ht = i.contentWindow, Wt = new URL(i.src).origin;
  }
  var an = 0;
  function sn(i) {
    let l = null, m = "";
    const { destination: p, messageId: c, data: h } = i;
    if (p === "background")
      je() || (l = Ht, m = Wt);
    else if (p.startsWith("content-script")) {
      if (!je())
        throw new Error('Can only send messages to the "content-script" (SDK) from the "background" (iframe context).');
      l = window.parent, m = at();
    } else if (p.startsWith("web_accessible") && !je())
      throw new Error(
        'Can only send messages to "web_accessible" (auth popup) from the "background" (iframe context).'
      );
    return l && m ? async function () {
      return new Promise(async (a) => {
        if (c === "event" || c === "switch_wallet_event" || c === "embedded_signOut" || c === "embedded_setTheme" || c === "embedded_navigate") {
          l.postMessage(
            {
              id: Be(),
              type: c,
              data: h
            },
            m
          );
          return;
        }
        l.postMessage(h, m), window.addEventListener("message", y);
        async function y(v) {
          let { data: S } = v;
          !h || typeof h != "object" || !S || typeof S != "object" || !("callID" in h) || h.callID !== S.callID || `${h.type}_result` === S.type && (window.removeEventListener("message", y), a(S));
        }
      });
    } : async function () {
      const a = qt[c];
      if (!a) {
        console.warn(`No listeners registered for ${c}.`);
        return;
      }
      a.size > 1 && console.warn(
        `${a.size} handlers found for ${c}. Only the first response will be returned.`
      );
      const y = Array.from(a).map((v) => v({
        id: "0",
        timestamp: Date.now(),
        sender: {
          tabId: Rr,
          context: rn[c] || null
        },
        data: h
      }));
      return await Promise.race(y);
    };
  }
  async function Kt(i) {
    const { destination: l, messageId: m } = i, p = parseInt(l.split("@")[1] || "0");
    if (isNaN(p))
      throw new Error("Unexpected NaN tabId");
    const c = an++, h = sn(i);
    return new Promise(async (u) => {
      _e(ye.MSG, `[${c}] Sending ${m} to ${l}`), h().then((a) => {
        _e(ye.MSG, `[${c}] ${m} sent`), u(a);
      });
    });
  }
  function on() {
    typeof window > "u" || window.addEventListener("message", async ({ origin: i, data: l }) => {
      if (!l || typeof l != "object" || i !== at()) return;
      let m = l.type;
      l.app === "wanderEmbedded" ? m = l.type === "chunk" ? "chunk" : "api_call" : l = l.data;
      const p = qt[m];
      if (!p) {
        console.warn(`No listeners registered for ${m}.`);
        return;
      }
      const c = Array.from(p).map((u) => u({
        id: Be(),
        timestamp: Date.now(),
        data: l,
        sender: {
          tabId: Ur,
          context: "content-script"
        }
      })), h = await Promise.race(c);
      if (window.parent === null)
        throw new Error("Unexpected `null` parent Window.");
      window.parent.postMessage(h, at());
    });
  }
  je() && on();
  function Ne(i) {
    return new Promise(async (l, m) => {
      const c = {
        app: "wanderEmbedded",
        // TODO: Add Wallet API version:
        version: "",
        callID: Be(),
        type: "chunk",
        data: i
      }, h = await Kt({
        destination: "background",
        messageId: "chunk",
        data: c
      });
      if (st(h) || typeof h.data == "string")
        return m(h.data);
      l();
    });
  }
  function cn(i) {
    return i && i.__esModule && Object.prototype.hasOwnProperty.call(i, "default") ? i.default : i;
  }
  var Te = {};
  var oe = {};
  var Ue = {};
  var ht;
  function zt() {
    if (ht) return Ue;
    ht = 1, Ue.byteLength = a, Ue.toByteArray = v, Ue.fromByteArray = x;
    for (var i = [], l = [], m = typeof Uint8Array < "u" ? Uint8Array : Array, p = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", c = 0, h = p.length; c < h; ++c)
      i[c] = p[c], l[p.charCodeAt(c)] = c;
    l[45] = 62, l[95] = 63;
    function u(N) {
      var I = N.length;
      if (I % 4 > 0)
        throw new Error("Invalid string. Length must be a multiple of 4");
      var D = N.indexOf("=");
      D === -1 && (D = I);
      var q = D === I ? 0 : 4 - D % 4;
      return [D, q];
    }
    function a(N) {
      var I = u(N), D = I[0], q = I[1];
      return (D + q) * 3 / 4 - q;
    }
    function y(N, I, D) {
      return (I + D) * 3 / 4 - D;
    }
    function v(N) {
      var I, D = u(N), q = D[0], z = D[1], L = new m(y(N, q, z)), V = 0, Y = z > 0 ? q - 4 : q, U;
      for (U = 0; U < Y; U += 4)
        I = l[N.charCodeAt(U)] << 18 | l[N.charCodeAt(U + 1)] << 12 | l[N.charCodeAt(U + 2)] << 6 | l[N.charCodeAt(U + 3)], L[V++] = I >> 16 & 255, L[V++] = I >> 8 & 255, L[V++] = I & 255;
      return z === 2 && (I = l[N.charCodeAt(U)] << 2 | l[N.charCodeAt(U + 1)] >> 4, L[V++] = I & 255), z === 1 && (I = l[N.charCodeAt(U)] << 10 | l[N.charCodeAt(U + 1)] << 4 | l[N.charCodeAt(U + 2)] >> 2, L[V++] = I >> 8 & 255, L[V++] = I & 255), L;
    }
    function S(N) {
      return i[N >> 18 & 63] + i[N >> 12 & 63] + i[N >> 6 & 63] + i[N & 63];
    }
    function _(N, I, D) {
      for (var q, z = [], L = I; L < D; L += 3)
        q = (N[L] << 16 & 16711680) + (N[L + 1] << 8 & 65280) + (N[L + 2] & 255), z.push(S(q));
      return z.join("");
    }
    function x(N) {
      for (var I, D = N.length, q = D % 3, z = [], L = 16383, V = 0, Y = D - q; V < Y; V += L)
        z.push(_(N, V, V + L > Y ? Y : V + L));
      return q === 1 ? (I = N[D - 1], z.push(
        i[I >> 2] + i[I << 4 & 63] + "=="
      )) : q === 2 && (I = (N[D - 2] << 8) + N[D - 1], z.push(
        i[I >> 10] + i[I >> 4 & 63] + i[I << 2 & 63] + "="
      )), z.join("");
    }
    return Ue;
  }
  var dt;
  function de() {
    if (dt) return oe;
    dt = 1, Object.defineProperty(oe, "__esModule", { value: true }), oe.concatBuffers = l, oe.b64UrlToString = m, oe.bufferToString = p, oe.stringToBuffer = c, oe.stringToB64Url = h, oe.b64UrlToBuffer = u, oe.bufferTob64 = a, oe.bufferTob64Url = y, oe.b64UrlEncode = v, oe.b64UrlDecode = S;
    const i = /* @__PURE__ */ zt();
    function l(_) {
      let x = 0;
      for (let D = 0; D < _.length; D++)
        x += _[D].byteLength;
      let N = new Uint8Array(x), I = 0;
      N.set(new Uint8Array(_[0]), I), I += _[0].byteLength;
      for (let D = 1; D < _.length; D++)
        N.set(new Uint8Array(_[D]), I), I += _[D].byteLength;
      return N;
    }
    function m(_) {
      let x = u(_);
      return p(x);
    }
    function p(_) {
      return new TextDecoder("utf-8", { fatal: true }).decode(_);
    }
    function c(_) {
      return new TextEncoder().encode(_);
    }
    function h(_) {
      return y(c(_));
    }
    function u(_) {
      return new Uint8Array(i.toByteArray(S(_)));
    }
    function a(_) {
      return i.fromByteArray(new Uint8Array(_));
    }
    function y(_) {
      return v(a(_));
    }
    function v(_) {
      try {
        return _.replace(/\+/g, "-").replace(/\//g, "_").replace(/\=/g, "");
      } catch (x) {
        throw new Error("Failed to encode string", { cause: x });
      }
    }
    function S(_) {
      try {
        _ = _.replace(/\-/g, "+").replace(/\_/g, "/");
        let x;
        return _.length % 4 == 0 ? x = 0 : x = 4 - _.length % 4, _.concat("=".repeat(x));
      } catch (x) {
        throw new Error("Failed to decode string", { cause: x });
      }
    }
    return oe;
  }
  var Oe = {};
  var Fe = {};
  var Me = {};
  var Ve = { exports: {} };
  var un = Ve.exports;
  var pt;
  function fn() {
    return pt || (pt = 1, function (i) {
      (function (l) {
        var m, p = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i, c = Math.ceil, h = Math.floor, u = "[BigNumber Error] ", a = u + "Number primitive has more than 15 significant digits: ", y = 1e14, v = 14, S = 9007199254740991, _ = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13], x = 1e7, N = 1e9;
        function I(B) {
          var k, M, W, C = b.prototype = { constructor: b, toString: null, valueOf: null }, J = new b(1), R = 20, F = 4, j = -7, Z = 21, re = -1e7, ie = 1e7, ue = false, pe = 1, le = 0, Q = {
            prefix: "",
            groupSize: 3,
            secondaryGroupSize: 0,
            groupSeparator: ",",
            decimalSeparator: ".",
            fractionGroupSize: 0,
            fractionGroupSeparator: "\xA0",
            // non-breaking space
            suffix: ""
          }, ee = "0123456789abcdefghijklmnopqrstuvwxyz", Ee = true;
          function b(o, f) {
            var d, A, g, E, r, e, t, n, s = this;
            if (!(s instanceof b)) return new b(o, f);
            if (f == null) {
              if (o && o._isBigNumber === true) {
                s.s = o.s, !o.c || o.e > ie ? s.c = s.e = null : o.e < re ? s.c = [s.e = 0] : (s.e = o.e, s.c = o.c.slice());
                return;
              }
              if ((e = typeof o == "number") && o * 0 == 0) {
                if (s.s = 1 / o < 0 ? (o = -o, -1) : 1, o === ~~o) {
                  for (E = 0, r = o; r >= 10; r /= 10, E++);
                  E > ie ? s.c = s.e = null : (s.e = E, s.c = [o]);
                  return;
                }
                n = String(o);
              } else {
                if (!p.test(n = String(o))) return W(s, n, e);
                s.s = n.charCodeAt(0) == 45 ? (n = n.slice(1), -1) : 1;
              }
              (E = n.indexOf(".")) > -1 && (n = n.replace(".", "")), (r = n.search(/e/i)) > 0 ? (E < 0 && (E = r), E += +n.slice(r + 1), n = n.substring(0, r)) : E < 0 && (E = n.length);
            } else {
              if (L(f, 2, ee.length, "Base"), f == 10 && Ee)
                return s = new b(o), ae(s, R + s.e + 1, F);
              if (n = String(o), e = typeof o == "number") {
                if (o * 0 != 0) return W(s, n, e, f);
                if (s.s = 1 / o < 0 ? (n = n.slice(1), -1) : 1, b.DEBUG && n.replace(/^0\.0*|\./, "").length > 15)
                  throw Error(a + o);
              } else
                s.s = n.charCodeAt(0) === 45 ? (n = n.slice(1), -1) : 1;
              for (d = ee.slice(0, f), E = r = 0, t = n.length; r < t; r++)
                if (d.indexOf(A = n.charAt(r)) < 0) {
                  if (A == ".") {
                    if (r > E) {
                      E = t;
                      continue;
                    }
                  } else if (!g && (n == n.toUpperCase() && (n = n.toLowerCase()) || n == n.toLowerCase() && (n = n.toUpperCase()))) {
                    g = true, r = -1, E = 0;
                    continue;
                  }
                  return W(s, String(o), e, f);
                }
              e = false, n = M(n, f, 10, s.s), (E = n.indexOf(".")) > -1 ? n = n.replace(".", "") : E = n.length;
            }
            for (r = 0; n.charCodeAt(r) === 48; r++);
            for (t = n.length; n.charCodeAt(--t) === 48;);
            if (n = n.slice(r, ++t)) {
              if (t -= r, e && b.DEBUG && t > 15 && (o > S || o !== h(o)))
                throw Error(a + s.s * o);
              if ((E = E - r - 1) > ie)
                s.c = s.e = null;
              else if (E < re)
                s.c = [s.e = 0];
              else {
                if (s.e = E, s.c = [], r = (E + 1) % v, E < 0 && (r += v), r < t) {
                  for (r && s.c.push(+n.slice(0, r)), t -= v; r < t;)
                    s.c.push(+n.slice(r, r += v));
                  r = v - (n = n.slice(r)).length;
                } else
                  r -= t;
                for (; r--; n += "0");
                s.c.push(+n);
              }
            } else
              s.c = [s.e = 0];
          }
          b.clone = I, b.ROUND_UP = 0, b.ROUND_DOWN = 1, b.ROUND_CEIL = 2, b.ROUND_FLOOR = 3, b.ROUND_HALF_UP = 4, b.ROUND_HALF_DOWN = 5, b.ROUND_HALF_EVEN = 6, b.ROUND_HALF_CEIL = 7, b.ROUND_HALF_FLOOR = 8, b.EUCLID = 9, b.config = b.set = function (o) {
            var f, d;
            if (o != null)
              if (typeof o == "object") {
                if (o.hasOwnProperty(f = "DECIMAL_PLACES") && (d = o[f], L(d, 0, N, f), R = d), o.hasOwnProperty(f = "ROUNDING_MODE") && (d = o[f], L(d, 0, 8, f), F = d), o.hasOwnProperty(f = "EXPONENTIAL_AT") && (d = o[f], d && d.pop ? (L(d[0], -N, 0, f), L(d[1], 0, N, f), j = d[0], Z = d[1]) : (L(d, -N, N, f), j = -(Z = d < 0 ? -d : d))), o.hasOwnProperty(f = "RANGE"))
                  if (d = o[f], d && d.pop)
                    L(d[0], -N, -1, f), L(d[1], 1, N, f), re = d[0], ie = d[1];
                  else if (L(d, -N, N, f), d)
                    re = -(ie = d < 0 ? -d : d);
                  else
                    throw Error(u + f + " cannot be zero: " + d);
                if (o.hasOwnProperty(f = "CRYPTO"))
                  if (d = o[f], d === !!d)
                    if (d)
                      if (typeof crypto < "u" && crypto && (crypto.getRandomValues || crypto.randomBytes))
                        ue = d;
                      else
                        throw ue = !d, Error(u + "crypto unavailable");
                    else
                      ue = d;
                  else
                    throw Error(u + f + " not true or false: " + d);
                if (o.hasOwnProperty(f = "MODULO_MODE") && (d = o[f], L(d, 0, 9, f), pe = d), o.hasOwnProperty(f = "POW_PRECISION") && (d = o[f], L(d, 0, N, f), le = d), o.hasOwnProperty(f = "FORMAT"))
                  if (d = o[f], typeof d == "object") Q = d;
                  else throw Error(u + f + " not an object: " + d);
                if (o.hasOwnProperty(f = "ALPHABET"))
                  if (d = o[f], typeof d == "string" && !/^.?$|[+\-.\s]|(.).*\1/.test(d))
                    Ee = d.slice(0, 10) == "0123456789", ee = d;
                  else
                    throw Error(u + f + " invalid: " + d);
              } else
                throw Error(u + "Object expected: " + o);
            return {
              DECIMAL_PLACES: R,
              ROUNDING_MODE: F,
              EXPONENTIAL_AT: [j, Z],
              RANGE: [re, ie],
              CRYPTO: ue,
              MODULO_MODE: pe,
              POW_PRECISION: le,
              FORMAT: Q,
              ALPHABET: ee
            };
          }, b.isBigNumber = function (o) {
            if (!o || o._isBigNumber !== true) return false;
            if (!b.DEBUG) return true;
            var f, d, A = o.c, g = o.e, E = o.s;
            e: if ({}.toString.call(A) == "[object Array]") {
              if ((E === 1 || E === -1) && g >= -N && g <= N && g === h(g)) {
                if (A[0] === 0) {
                  if (g === 0 && A.length === 1) return true;
                  break e;
                }
                if (f = (g + 1) % v, f < 1 && (f += v), String(A[0]).length == f) {
                  for (f = 0; f < A.length; f++)
                    if (d = A[f], d < 0 || d >= y || d !== h(d)) break e;
                  if (d !== 0) return true;
                }
              }
            } else if (A === null && g === null && (E === null || E === 1 || E === -1))
              return true;
            throw Error(u + "Invalid BigNumber: " + o);
          }, b.maximum = b.max = function () {
            return be(arguments, -1);
          }, b.minimum = b.min = function () {
            return be(arguments, 1);
          }, b.random = function () {
            var o = 9007199254740992, f = Math.random() * o & 2097151 ? function () {
              return h(Math.random() * o);
            } : function () {
              return (Math.random() * 1073741824 | 0) * 8388608 + (Math.random() * 8388608 | 0);
            };
            return function (d) {
              var A, g, E, r, e, t = 0, n = [], s = new b(J);
              if (d == null ? d = R : L(d, 0, N), r = c(d / v), ue)
                if (crypto.getRandomValues) {
                  for (A = crypto.getRandomValues(new Uint32Array(r *= 2)); t < r;)
                    e = A[t] * 131072 + (A[t + 1] >>> 11), e >= 9e15 ? (g = crypto.getRandomValues(new Uint32Array(2)), A[t] = g[0], A[t + 1] = g[1]) : (n.push(e % 1e14), t += 2);
                  t = r / 2;
                } else if (crypto.randomBytes) {
                  for (A = crypto.randomBytes(r *= 7); t < r;)
                    e = (A[t] & 31) * 281474976710656 + A[t + 1] * 1099511627776 + A[t + 2] * 4294967296 + A[t + 3] * 16777216 + (A[t + 4] << 16) + (A[t + 5] << 8) + A[t + 6], e >= 9e15 ? crypto.randomBytes(7).copy(A, t) : (n.push(e % 1e14), t += 7);
                  t = r / 7;
                } else
                  throw ue = false, Error(u + "crypto unavailable");
              if (!ue)
                for (; t < r;)
                  e = f(), e < 9e15 && (n[t++] = e % 1e14);
              for (r = n[--t], d %= v, r && d && (e = _[v - d], n[t] = h(r / e) * e); n[t] === 0; n.pop(), t--);
              if (t < 0)
                n = [E = 0];
              else {
                for (E = -1; n[0] === 0; n.splice(0, 1), E -= v);
                for (t = 1, e = n[0]; e >= 10; e /= 10, t++);
                t < v && (E -= v - t);
              }
              return s.e = E, s.c = n, s;
            };
          }(), b.sum = function () {
            for (var o = 1, f = arguments, d = new b(f[0]); o < f.length;) d = d.plus(f[o++]);
            return d;
          }, M = /* @__PURE__ */ function () {
            var o = "0123456789";
            function f(d, A, g, E) {
              for (var r, e = [0], t, n = 0, s = d.length; n < s;) {
                for (t = e.length; t--; e[t] *= A);
                for (e[0] += E.indexOf(d.charAt(n++)), r = 0; r < e.length; r++)
                  e[r] > g - 1 && (e[r + 1] == null && (e[r + 1] = 0), e[r + 1] += e[r] / g | 0, e[r] %= g);
              }
              return e.reverse();
            }
            return function (d, A, g, E, r) {
              var e, t, n, s, w, T, O, P, K = d.indexOf("."), G = R, H = F;
              for (K >= 0 && (s = le, le = 0, d = d.replace(".", ""), P = new b(A), T = P.pow(d.length - K), le = s, P.c = f(
                U(q(T.c), T.e, "0"),
                10,
                g,
                o
              ), P.e = P.c.length), O = f(d, A, g, r ? (e = ee, o) : (e = o, ee)), n = s = O.length; O[--s] == 0; O.pop());
              if (!O[0]) return e.charAt(0);
              if (K < 0 ? --n : (T.c = O, T.e = n, T.s = E, T = k(T, P, G, H, g), O = T.c, w = T.r, n = T.e), t = n + G + 1, K = O[t], s = g / 2, w = w || t < 0 || O[t + 1] != null, w = H < 4 ? (K != null || w) && (H == 0 || H == (T.s < 0 ? 3 : 2)) : K > s || K == s && (H == 4 || w || H == 6 && O[t - 1] & 1 || H == (T.s < 0 ? 8 : 7)), t < 1 || !O[0])
                d = w ? U(e.charAt(1), -G, e.charAt(0)) : e.charAt(0);
              else {
                if (O.length = t, w)
                  for (--g; ++O[--t] > g;)
                    O[t] = 0, t || (++n, O = [1].concat(O));
                for (s = O.length; !O[--s];);
                for (K = 0, d = ""; K <= s; d += e.charAt(O[K++]));
                d = U(d, n, e.charAt(0));
              }
              return d;
            };
          }(), k = /* @__PURE__ */ function () {
            function o(A, g, E) {
              var r, e, t, n, s = 0, w = A.length, T = g % x, O = g / x | 0;
              for (A = A.slice(); w--;)
                t = A[w] % x, n = A[w] / x | 0, r = O * t + n * T, e = T * t + r % x * x + s, s = (e / E | 0) + (r / x | 0) + O * n, A[w] = e % E;
              return s && (A = [s].concat(A)), A;
            }
            function f(A, g, E, r) {
              var e, t;
              if (E != r)
                t = E > r ? 1 : -1;
              else
                for (e = t = 0; e < E; e++)
                  if (A[e] != g[e]) {
                    t = A[e] > g[e] ? 1 : -1;
                    break;
                  }
              return t;
            }
            function d(A, g, E, r) {
              for (var e = 0; E--;)
                A[E] -= e, e = A[E] < g[E] ? 1 : 0, A[E] = e * r + A[E] - g[E];
              for (; !A[0] && A.length > 1; A.splice(0, 1));
            }
            return function (A, g, E, r, e) {
              var t, n, s, w, T, O, P, K, G, H, X, ne, we, Ze, Qe, he, ke, ce = A.s == g.s ? 1 : -1, se = A.c, te = g.c;
              if (!se || !se[0] || !te || !te[0])
                return new b(
                  // Return NaN if either NaN, or both Infinity or 0.
                  !A.s || !g.s || (se ? te && se[0] == te[0] : !te) ? NaN : (
                    // Return ±0 if x is ±0 or y is ±Infinity, or return ±Infinity as y is ±0.
                    se && se[0] == 0 || !te ? ce * 0 : ce / 0
                  )
                );
              for (K = new b(ce), G = K.c = [], n = A.e - g.e, ce = E + n + 1, e || (e = y, n = D(A.e / v) - D(g.e / v), ce = ce / v | 0), s = 0; te[s] == (se[s] || 0); s++);
              if (te[s] > (se[s] || 0) && n--, ce < 0)
                G.push(1), w = true;
              else {
                for (Ze = se.length, he = te.length, s = 0, ce += 2, T = h(e / (te[0] + 1)), T > 1 && (te = o(te, T, e), se = o(se, T, e), he = te.length, Ze = se.length), we = he, H = se.slice(0, he), X = H.length; X < he; H[X++] = 0);
                ke = te.slice(), ke = [0].concat(ke), Qe = te[0], te[1] >= e / 2 && Qe++;
                do {
                  if (T = 0, t = f(te, H, he, X), t < 0) {
                    if (ne = H[0], he != X && (ne = ne * e + (H[1] || 0)), T = h(ne / Qe), T > 1)
                      for (T >= e && (T = e - 1), O = o(te, T, e), P = O.length, X = H.length; f(O, H, P, X) == 1;)
                        T--, d(O, he < P ? ke : te, P, e), P = O.length, t = 1;
                    else
                      T == 0 && (t = T = 1), O = te.slice(), P = O.length;
                    if (P < X && (O = [0].concat(O)), d(H, O, X, e), X = H.length, t == -1)
                      for (; f(te, H, he, X) < 1;)
                        T++, d(H, he < X ? ke : te, X, e), X = H.length;
                  } else t === 0 && (T++, H = [0]);
                  G[s++] = T, H[0] ? H[X++] = se[we] || 0 : (H = [se[we]], X = 1);
                } while ((we++ < Ze || H[0] != null) && ce--);
                w = H[0] != null, G[0] || G.splice(0, 1);
              }
              if (e == y) {
                for (s = 1, ce = G[0]; ce >= 10; ce /= 10, s++);
                ae(K, E + (K.e = s + n * v - 1) + 1, r, w);
              } else
                K.e = n, K.r = +w;
              return K;
            };
          }();
          function Ae(o, f, d, A) {
            var g, E, r, e, t;
            if (d == null ? d = F : L(d, 0, 8), !o.c) return o.toString();
            if (g = o.c[0], r = o.e, f == null)
              t = q(o.c), t = A == 1 || A == 2 && (r <= j || r >= Z) ? Y(t, r) : U(t, r, "0");
            else if (o = ae(new b(o), f, d), E = o.e, t = q(o.c), e = t.length, A == 1 || A == 2 && (f <= E || E <= j)) {
              for (; e < f; t += "0", e++);
              t = Y(t, E);
            } else if (f -= r + (A === 2 && E > r), t = U(t, E, "0"), E + 1 > e) {
              if (--f > 0) for (t += "."; f--; t += "0");
            } else if (f += E - e, f > 0)
              for (E + 1 == e && (t += "."); f--; t += "0");
            return o.s < 0 && g ? "-" + t : t;
          }
          function be(o, f) {
            for (var d, A, g = 1, E = new b(o[0]); g < o.length; g++)
              A = new b(o[g]), (!A.s || (d = z(E, A)) === f || d === 0 && E.s === f) && (E = A);
            return E;
          }
          function xe(o, f, d) {
            for (var A = 1, g = f.length; !f[--g]; f.pop());
            for (g = f[0]; g >= 10; g /= 10, A++);
            return (d = A + d * v - 1) > ie ? o.c = o.e = null : d < re ? o.c = [o.e = 0] : (o.e = d, o.c = f), o;
          }
          W = /* @__PURE__ */ function () {
            var o = /^(-?)0([xbo])(?=\w[\w.]*$)/i, f = /^([^.]+)\.$/, d = /^\.([^.]+)$/, A = /^-?(Infinity|NaN)$/, g = /^\s*\+(?=[\w.])|^\s+|\s+$/g;
            return function (E, r, e, t) {
              var n, s = e ? r : r.replace(g, "");
              if (A.test(s))
                E.s = isNaN(s) ? null : s < 0 ? -1 : 1;
              else {
                if (!e && (s = s.replace(o, function (w, T, O) {
                  return n = (O = O.toLowerCase()) == "x" ? 16 : O == "b" ? 2 : 8, !t || t == n ? T : w;
                }), t && (n = t, s = s.replace(f, "$1").replace(d, "0.$1")), r != s))
                  return new b(s, n);
                if (b.DEBUG)
                  throw Error(u + "Not a" + (t ? " base " + t : "") + " number: " + r);
                E.s = null;
              }
              E.c = E.e = null;
            };
          }();
          function ae(o, f, d, A) {
            var g, E, r, e, t, n, s, w = o.c, T = _;
            if (w) {
              e: {
                for (g = 1, e = w[0]; e >= 10; e /= 10, g++);
                if (E = f - g, E < 0)
                  E += v, r = f, t = w[n = 0], s = h(t / T[g - r - 1] % 10);
                else if (n = c((E + 1) / v), n >= w.length)
                  if (A) {
                    for (; w.length <= n; w.push(0));
                    t = s = 0, g = 1, E %= v, r = E - v + 1;
                  } else
                    break e;
                else {
                  for (t = e = w[n], g = 1; e >= 10; e /= 10, g++);
                  E %= v, r = E - v + g, s = r < 0 ? 0 : h(t / T[g - r - 1] % 10);
                }
                if (A = A || f < 0 || // Are there any non-zero digits after the rounding digit?
                  // The expression  n % pows10[d - j - 1]  returns all digits of n to the right
                  // of the digit at j, e.g. if n is 908714 and j is 2, the expression gives 714.
                  w[n + 1] != null || (r < 0 ? t : t % T[g - r - 1]), A = d < 4 ? (s || A) && (d == 0 || d == (o.s < 0 ? 3 : 2)) : s > 5 || s == 5 && (d == 4 || A || d == 6 && // Check whether the digit to the left of the rounding digit is odd.
                    (E > 0 ? r > 0 ? t / T[g - r] : 0 : w[n - 1]) % 10 & 1 || d == (o.s < 0 ? 8 : 7)), f < 1 || !w[0])
                  return w.length = 0, A ? (f -= o.e + 1, w[0] = T[(v - f % v) % v], o.e = -f || 0) : w[0] = o.e = 0, o;
                if (E == 0 ? (w.length = n, e = 1, n--) : (w.length = n + 1, e = T[v - E], w[n] = r > 0 ? h(t / T[g - r] % T[r]) * e : 0), A)
                  for (; ;)
                    if (n == 0) {
                      for (E = 1, r = w[0]; r >= 10; r /= 10, E++);
                      for (r = w[0] += e, e = 1; r >= 10; r /= 10, e++);
                      E != e && (o.e++, w[0] == y && (w[0] = 1));
                      break;
                    } else {
                      if (w[n] += e, w[n] != y) break;
                      w[n--] = 0, e = 1;
                    }
                for (E = w.length; w[--E] === 0; w.pop());
              }
              o.e > ie ? o.c = o.e = null : o.e < re && (o.c = [o.e = 0]);
            }
            return o;
          }
          function fe(o) {
            var f, d = o.e;
            return d === null ? o.toString() : (f = q(o.c), f = d <= j || d >= Z ? Y(f, d) : U(f, d, "0"), o.s < 0 ? "-" + f : f);
          }
          return C.absoluteValue = C.abs = function () {
            var o = new b(this);
            return o.s < 0 && (o.s = 1), o;
          }, C.comparedTo = function (o, f) {
            return z(this, new b(o, f));
          }, C.decimalPlaces = C.dp = function (o, f) {
            var d, A, g, E = this;
            if (o != null)
              return L(o, 0, N), f == null ? f = F : L(f, 0, 8), ae(new b(E), o + E.e + 1, f);
            if (!(d = E.c)) return null;
            if (A = ((g = d.length - 1) - D(this.e / v)) * v, g = d[g]) for (; g % 10 == 0; g /= 10, A--);
            return A < 0 && (A = 0), A;
          }, C.dividedBy = C.div = function (o, f) {
            return k(this, new b(o, f), R, F);
          }, C.dividedToIntegerBy = C.idiv = function (o, f) {
            return k(this, new b(o, f), 0, 1);
          }, C.exponentiatedBy = C.pow = function (o, f) {
            var d, A, g, E, r, e, t, n, s, w = this;
            if (o = new b(o), o.c && !o.isInteger())
              throw Error(u + "Exponent not an integer: " + fe(o));
            if (f != null && (f = new b(f)), e = o.e > 14, !w.c || !w.c[0] || w.c[0] == 1 && !w.e && w.c.length == 1 || !o.c || !o.c[0])
              return s = new b(Math.pow(+fe(w), e ? o.s * (2 - V(o)) : +fe(o))), f ? s.mod(f) : s;
            if (t = o.s < 0, f) {
              if (f.c ? !f.c[0] : !f.s) return new b(NaN);
              A = !t && w.isInteger() && f.isInteger(), A && (w = w.mod(f));
            } else {
              if (o.e > 9 && (w.e > 0 || w.e < -1 || (w.e == 0 ? w.c[0] > 1 || e && w.c[1] >= 24e7 : w.c[0] < 8e13 || e && w.c[0] <= 9999975e7)))
                return E = w.s < 0 && V(o) ? -0 : 0, w.e > -1 && (E = 1 / E), new b(t ? 1 / E : E);
              le && (E = c(le / v + 2));
            }
            for (e ? (d = new b(0.5), t && (o.s = 1), n = V(o)) : (g = Math.abs(+fe(o)), n = g % 2), s = new b(J); ;) {
              if (n) {
                if (s = s.times(w), !s.c) break;
                E ? s.c.length > E && (s.c.length = E) : A && (s = s.mod(f));
              }
              if (g) {
                if (g = h(g / 2), g === 0) break;
                n = g % 2;
              } else if (o = o.times(d), ae(o, o.e + 1, 1), o.e > 14)
                n = V(o);
              else {
                if (g = +fe(o), g === 0) break;
                n = g % 2;
              }
              w = w.times(w), E ? w.c && w.c.length > E && (w.c.length = E) : A && (w = w.mod(f));
            }
            return A ? s : (t && (s = J.div(s)), f ? s.mod(f) : E ? ae(s, le, F, r) : s);
          }, C.integerValue = function (o) {
            var f = new b(this);
            return o == null ? o = F : L(o, 0, 8), ae(f, f.e + 1, o);
          }, C.isEqualTo = C.eq = function (o, f) {
            return z(this, new b(o, f)) === 0;
          }, C.isFinite = function () {
            return !!this.c;
          }, C.isGreaterThan = C.gt = function (o, f) {
            return z(this, new b(o, f)) > 0;
          }, C.isGreaterThanOrEqualTo = C.gte = function (o, f) {
            return (f = z(this, new b(o, f))) === 1 || f === 0;
          }, C.isInteger = function () {
            return !!this.c && D(this.e / v) > this.c.length - 2;
          }, C.isLessThan = C.lt = function (o, f) {
            return z(this, new b(o, f)) < 0;
          }, C.isLessThanOrEqualTo = C.lte = function (o, f) {
            return (f = z(this, new b(o, f))) === -1 || f === 0;
          }, C.isNaN = function () {
            return !this.s;
          }, C.isNegative = function () {
            return this.s < 0;
          }, C.isPositive = function () {
            return this.s > 0;
          }, C.isZero = function () {
            return !!this.c && this.c[0] == 0;
          }, C.minus = function (o, f) {
            var d, A, g, E, r = this, e = r.s;
            if (o = new b(o, f), f = o.s, !e || !f) return new b(NaN);
            if (e != f)
              return o.s = -f, r.plus(o);
            var t = r.e / v, n = o.e / v, s = r.c, w = o.c;
            if (!t || !n) {
              if (!s || !w) return s ? (o.s = -f, o) : new b(w ? r : NaN);
              if (!s[0] || !w[0])
                return w[0] ? (o.s = -f, o) : new b(s[0] ? r : (
                  // IEEE 754 (2008) 6.3: n - n = -0 when rounding to -Infinity
                  F == 3 ? -0 : 0
                ));
            }
            if (t = D(t), n = D(n), s = s.slice(), e = t - n) {
              for ((E = e < 0) ? (e = -e, g = s) : (n = t, g = w), g.reverse(), f = e; f--; g.push(0));
              g.reverse();
            } else
              for (A = (E = (e = s.length) < (f = w.length)) ? e : f, e = f = 0; f < A; f++)
                if (s[f] != w[f]) {
                  E = s[f] < w[f];
                  break;
                }
            if (E && (g = s, s = w, w = g, o.s = -o.s), f = (A = w.length) - (d = s.length), f > 0) for (; f--; s[d++] = 0);
            for (f = y - 1; A > e;) {
              if (s[--A] < w[A]) {
                for (d = A; d && !s[--d]; s[d] = f);
                --s[d], s[A] += y;
              }
              s[A] -= w[A];
            }
            for (; s[0] == 0; s.splice(0, 1), --n);
            return s[0] ? xe(o, s, n) : (o.s = F == 3 ? -1 : 1, o.c = [o.e = 0], o);
          }, C.modulo = C.mod = function (o, f) {
            var d, A, g = this;
            return o = new b(o, f), !g.c || !o.s || o.c && !o.c[0] ? new b(NaN) : !o.c || g.c && !g.c[0] ? new b(g) : (pe == 9 ? (A = o.s, o.s = 1, d = k(g, o, 0, 3), o.s = A, d.s *= A) : d = k(g, o, 0, pe), o = g.minus(d.times(o)), !o.c[0] && pe == 1 && (o.s = g.s), o);
          }, C.multipliedBy = C.times = function (o, f) {
            var d, A, g, E, r, e, t, n, s, w, T, O, P, K, G, H = this, X = H.c, ne = (o = new b(o, f)).c;
            if (!X || !ne || !X[0] || !ne[0])
              return !H.s || !o.s || X && !X[0] && !ne || ne && !ne[0] && !X ? o.c = o.e = o.s = null : (o.s *= H.s, !X || !ne ? o.c = o.e = null : (o.c = [0], o.e = 0)), o;
            for (A = D(H.e / v) + D(o.e / v), o.s *= H.s, t = X.length, w = ne.length, t < w && (P = X, X = ne, ne = P, g = t, t = w, w = g), g = t + w, P = []; g--; P.push(0));
            for (K = y, G = x, g = w; --g >= 0;) {
              for (d = 0, T = ne[g] % G, O = ne[g] / G | 0, r = t, E = g + r; E > g;)
                n = X[--r] % G, s = X[r] / G | 0, e = O * n + s * T, n = T * n + e % G * G + P[E] + d, d = (n / K | 0) + (e / G | 0) + O * s, P[E--] = n % K;
              P[E] = d;
            }
            return d ? ++A : P.splice(0, 1), xe(o, P, A);
          }, C.negated = function () {
            var o = new b(this);
            return o.s = -o.s || null, o;
          }, C.plus = function (o, f) {
            var d, A = this, g = A.s;
            if (o = new b(o, f), f = o.s, !g || !f) return new b(NaN);
            if (g != f)
              return o.s = -f, A.minus(o);
            var E = A.e / v, r = o.e / v, e = A.c, t = o.c;
            if (!E || !r) {
              if (!e || !t) return new b(g / 0);
              if (!e[0] || !t[0]) return t[0] ? o : new b(e[0] ? A : g * 0);
            }
            if (E = D(E), r = D(r), e = e.slice(), g = E - r) {
              for (g > 0 ? (r = E, d = t) : (g = -g, d = e), d.reverse(); g--; d.push(0));
              d.reverse();
            }
            for (g = e.length, f = t.length, g - f < 0 && (d = t, t = e, e = d, f = g), g = 0; f;)
              g = (e[--f] = e[f] + t[f] + g) / y | 0, e[f] = y === e[f] ? 0 : e[f] % y;
            return g && (e = [g].concat(e), ++r), xe(o, e, r);
          }, C.precision = C.sd = function (o, f) {
            var d, A, g, E = this;
            if (o != null && o !== !!o)
              return L(o, 1, N), f == null ? f = F : L(f, 0, 8), ae(new b(E), o, f);
            if (!(d = E.c)) return null;
            if (g = d.length - 1, A = g * v + 1, g = d[g]) {
              for (; g % 10 == 0; g /= 10, A--);
              for (g = d[0]; g >= 10; g /= 10, A++);
            }
            return o && E.e + 1 > A && (A = E.e + 1), A;
          }, C.shiftedBy = function (o) {
            return L(o, -S, S), this.times("1e" + o);
          }, C.squareRoot = C.sqrt = function () {
            var o, f, d, A, g, E = this, r = E.c, e = E.s, t = E.e, n = R + 4, s = new b("0.5");
            if (e !== 1 || !r || !r[0])
              return new b(!e || e < 0 && (!r || r[0]) ? NaN : r ? E : 1 / 0);
            if (e = Math.sqrt(+fe(E)), e == 0 || e == 1 / 0 ? (f = q(r), (f.length + t) % 2 == 0 && (f += "0"), e = Math.sqrt(+f), t = D((t + 1) / 2) - (t < 0 || t % 2), e == 1 / 0 ? f = "5e" + t : (f = e.toExponential(), f = f.slice(0, f.indexOf("e") + 1) + t), d = new b(f)) : d = new b(e + ""), d.c[0]) {
              for (t = d.e, e = t + n, e < 3 && (e = 0); ;)
                if (g = d, d = s.times(g.plus(k(E, g, n, 1))), q(g.c).slice(0, e) === (f = q(d.c)).slice(0, e))
                  if (d.e < t && --e, f = f.slice(e - 3, e + 1), f == "9999" || !A && f == "4999") {
                    if (!A && (ae(g, g.e + R + 2, 0), g.times(g).eq(E))) {
                      d = g;
                      break;
                    }
                    n += 4, e += 4, A = 1;
                  } else {
                    (!+f || !+f.slice(1) && f.charAt(0) == "5") && (ae(d, d.e + R + 2, 1), o = !d.times(d).eq(E));
                    break;
                  }
            }
            return ae(d, d.e + R + 1, F, o);
          }, C.toExponential = function (o, f) {
            return o != null && (L(o, 0, N), o++), Ae(this, o, f, 1);
          }, C.toFixed = function (o, f) {
            return o != null && (L(o, 0, N), o = o + this.e + 1), Ae(this, o, f);
          }, C.toFormat = function (o, f, d) {
            var A, g = this;
            if (d == null)
              o != null && f && typeof f == "object" ? (d = f, f = null) : o && typeof o == "object" ? (d = o, o = f = null) : d = Q;
            else if (typeof d != "object")
              throw Error(u + "Argument not an object: " + d);
            if (A = g.toFixed(o, f), g.c) {
              var E, r = A.split("."), e = +d.groupSize, t = +d.secondaryGroupSize, n = d.groupSeparator || "", s = r[0], w = r[1], T = g.s < 0, O = T ? s.slice(1) : s, P = O.length;
              if (t && (E = e, e = t, t = E, P -= E), e > 0 && P > 0) {
                for (E = P % e || e, s = O.substr(0, E); E < P; E += e) s += n + O.substr(E, e);
                t > 0 && (s += n + O.slice(E)), T && (s = "-" + s);
              }
              A = w ? s + (d.decimalSeparator || "") + ((t = +d.fractionGroupSize) ? w.replace(
                new RegExp("\\d{" + t + "}\\B", "g"),
                "$&" + (d.fractionGroupSeparator || "")
              ) : w) : s;
            }
            return (d.prefix || "") + A + (d.suffix || "");
          }, C.toFraction = function (o) {
            var f, d, A, g, E, r, e, t, n, s, w, T, O = this, P = O.c;
            if (o != null && (e = new b(o), !e.isInteger() && (e.c || e.s !== 1) || e.lt(J)))
              throw Error(u + "Argument " + (e.isInteger() ? "out of range: " : "not an integer: ") + fe(e));
            if (!P) return new b(O);
            for (f = new b(J), n = d = new b(J), A = t = new b(J), T = q(P), E = f.e = T.length - O.e - 1, f.c[0] = _[(r = E % v) < 0 ? v + r : r], o = !o || e.comparedTo(f) > 0 ? E > 0 ? f : n : e, r = ie, ie = 1 / 0, e = new b(T), t.c[0] = 0; s = k(e, f, 0, 1), g = d.plus(s.times(A)), g.comparedTo(o) != 1;)
              d = A, A = g, n = t.plus(s.times(g = n)), t = g, f = e.minus(s.times(g = f)), e = g;
            return g = k(o.minus(d), A, 0, 1), t = t.plus(g.times(n)), d = d.plus(g.times(A)), t.s = n.s = O.s, E = E * 2, w = k(n, A, E, F).minus(O).abs().comparedTo(
              k(t, d, E, F).minus(O).abs()
            ) < 1 ? [n, A] : [t, d], ie = r, w;
          }, C.toNumber = function () {
            return +fe(this);
          }, C.toPrecision = function (o, f) {
            return o != null && L(o, 1, N), Ae(this, o, f, 2);
          }, C.toString = function (o) {
            var f, d = this, A = d.s, g = d.e;
            return g === null ? A ? (f = "Infinity", A < 0 && (f = "-" + f)) : f = "NaN" : (o == null ? f = g <= j || g >= Z ? Y(q(d.c), g) : U(q(d.c), g, "0") : o === 10 && Ee ? (d = ae(new b(d), R + g + 1, F), f = U(q(d.c), d.e, "0")) : (L(o, 2, ee.length, "Base"), f = M(U(q(d.c), g, "0"), 10, o, A, true)), A < 0 && d.c[0] && (f = "-" + f)), f;
          }, C.valueOf = C.toJSON = function () {
            return fe(this);
          }, C._isBigNumber = true, B != null && b.set(B), b;
        }
        function D(B) {
          var k = B | 0;
          return B > 0 || B === k ? k : k - 1;
        }
        function q(B) {
          for (var k, M, W = 1, C = B.length, J = B[0] + ""; W < C;) {
            for (k = B[W++] + "", M = v - k.length; M--; k = "0" + k);
            J += k;
          }
          for (C = J.length; J.charCodeAt(--C) === 48;);
          return J.slice(0, C + 1 || 1);
        }
        function z(B, k) {
          var M, W, C = B.c, J = k.c, R = B.s, F = k.s, j = B.e, Z = k.e;
          if (!R || !F) return null;
          if (M = C && !C[0], W = J && !J[0], M || W) return M ? W ? 0 : -F : R;
          if (R != F) return R;
          if (M = R < 0, W = j == Z, !C || !J) return W ? 0 : !C ^ M ? 1 : -1;
          if (!W) return j > Z ^ M ? 1 : -1;
          for (F = (j = C.length) < (Z = J.length) ? j : Z, R = 0; R < F; R++) if (C[R] != J[R]) return C[R] > J[R] ^ M ? 1 : -1;
          return j == Z ? 0 : j > Z ^ M ? 1 : -1;
        }
        function L(B, k, M, W) {
          if (B < k || B > M || B !== h(B))
            throw Error(u + (W || "Argument") + (typeof B == "number" ? B < k || B > M ? " out of range: " : " not an integer: " : " not a primitive number: ") + String(B));
        }
        function V(B) {
          var k = B.c.length - 1;
          return D(B.e / v) == k && B.c[k] % 2 != 0;
        }
        function Y(B, k) {
          return (B.length > 1 ? B.charAt(0) + "." + B.slice(1) : B) + (k < 0 ? "e" : "e+") + k;
        }
        function U(B, k, M) {
          var W, C;
          if (k < 0) {
            for (C = M + "."; ++k; C += M);
            B = C + B;
          } else if (W = B.length, ++k > W) {
            for (C = M, k -= W; --k; C += M);
            B += C;
          } else k < W && (B = B.slice(0, k) + "." + B.slice(k));
          return B;
        }
        m = I(), m.default = m.BigNumber = m, i.exports ? i.exports = m : (l || (l = typeof self < "u" && self ? self : window), l.BigNumber = m);
      })(un);
    }(Ve)), Ve.exports;
  }
  var wt;
  function ln() {
    if (wt) return Me;
    wt = 1, Object.defineProperty(Me, "__esModule", { value: true });
    const i = /* @__PURE__ */ fn();
    class l {
      constructor() {
        $(this, "BigNum");
        this.BigNum = (p, c) => {
          let h = i.BigNumber.clone({ DECIMAL_PLACES: c });
          return new h(p);
        };
      }
      winstonToAr(p, { formatted: c = false, decimals: h = 12, trim: u = true } = {}) {
        let a = this.stringToBigNum(p, h).shiftedBy(-12);
        return c ? a.toFormat(h) : a.toFixed(h);
      }
      arToWinston(p, { formatted: c = false } = {}) {
        let h = this.stringToBigNum(p).shiftedBy(12);
        return c ? h.toFormat() : h.toFixed(0);
      }
      compare(p, c) {
        let h = this.stringToBigNum(p), u = this.stringToBigNum(c);
        return h.comparedTo(u);
      }
      isEqual(p, c) {
        return this.compare(p, c) === 0;
      }
      isLessThan(p, c) {
        let h = this.stringToBigNum(p), u = this.stringToBigNum(c);
        return h.isLessThan(u);
      }
      isGreaterThan(p, c) {
        let h = this.stringToBigNum(p), u = this.stringToBigNum(c);
        return h.isGreaterThan(u);
      }
      add(p, c) {
        let h = this.stringToBigNum(p);
        return this.stringToBigNum(c), h.plus(c).toFixed(0);
      }
      sub(p, c) {
        let h = this.stringToBigNum(p);
        return this.stringToBigNum(c), h.minus(c).toFixed(0);
      }
      stringToBigNum(p, c = 12) {
        return this.BigNum(p, c);
      }
    }
    return Me.default = l, Me;
  }
  var $e = {};
  var gt;
  function hn() {
    if (gt) return $e;
    gt = 1, Object.defineProperty($e, "__esModule", { value: true });
    class i {
      constructor(c) {
        $(this, "METHOD_GET", "GET");
        $(this, "METHOD_POST", "POST");
        $(this, "config");
        this.applyConfig(c);
      }
      applyConfig(c) {
        this.config = this.mergeDefaults(c);
      }
      getConfig() {
        return this.config;
      }
      mergeDefaults(c) {
        const h = c.protocol || "http", u = c.port || (h === "https" ? 443 : 80);
        return {
          host: c.host || "127.0.0.1",
          protocol: h,
          port: u,
          timeout: c.timeout || 2e4,
          logging: c.logging || false,
          logger: c.logger || console.log,
          network: c.network
        };
      }
      async get(c, h) {
        return await this.request(c, { ...h, method: this.METHOD_GET });
      }
      async post(c, h, u) {
        var y;
        const a = new Headers((u == null ? void 0 : u.headers) || {});
        return (y = a.get("content-type")) != null && y.includes("application/json") || a.append("content-type", "application/json"), a.append("accept", "application/json, text/plain, */*"), await this.request(c, {
          ...u,
          method: this.METHOD_POST,
          body: typeof h != "string" ? JSON.stringify(h) : h,
          headers: a
        });
      }
      async request(c, h) {
        var I;
        const u = new Headers((h == null ? void 0 : h.headers) || {}), a = `${this.config.protocol}://${this.config.host}:${this.config.port}`, y = h == null ? void 0 : h.responseType;
        h == null || delete h.responseType, c.startsWith("/") && (c = c.slice(1)), this.config.network && u.append("x-network", this.config.network), this.config.logging && this.config.logger(`Requesting: ${a}/${c}`);
        let v = await fetch(`${a}/${c}`, {
          ...h || {},
          headers: u
        });
        this.config.logging && this.config.logger(`Response:   ${v.url} - ${v.status}`);
        const S = v.headers.get("content-type"), _ = (I = S == null ? void 0 : S.match(/charset=([^()<>@,;:\"/[\]?.=\s]*)/i)) == null ? void 0 : I[1], x = v, N = async () => {
          if (_)
            try {
              x.data = new TextDecoder(_).decode(await v.arrayBuffer());
            } catch {
              x.data = await v.text();
            }
          else
            x.data = await v.text();
        };
        if (y === "arraybuffer")
          x.data = await v.arrayBuffer();
        else if (y === "text")
          await N();
        else if (y === "webstream")
          x.data = l(v.body);
        else
          try {
            let D = await v.clone().json();
            typeof D != "object" ? await N() : x.data = await v.json(), D = null;
          } catch {
            await N();
          }
        return x;
      }
    }
    $e.default = i;
    const l = (p) => {
      const c = p;
      return typeof c[Symbol.asyncIterator] > "u" && (c[Symbol.asyncIterator] = m(p)), c;
    }, m = function (p) {
      return async function* () {
        const h = p.getReader();
        try {
          for (; ;) {
            const { done: u, value: a } = await h.read();
            if (u)
              return;
            yield a;
          }
        } finally {
          h.releaseLock();
        }
      };
    };
    return $e;
  }
  var Le = {};
  var yt;
  function dn() {
    if (yt) return Le;
    yt = 1, Object.defineProperty(Le, "__esModule", { value: true });
    const i = /* @__PURE__ */ de();
    class l {
      constructor() {
        $(this, "keyLength", 4096);
        $(this, "publicExponent", 65537);
        $(this, "hashAlgorithm", "sha256");
        $(this, "driver");
        if (!this.detectWebCrypto())
          throw new Error("SubtleCrypto not available!");
        this.driver = crypto.subtle;
      }
      async generateJWK() {
        let p = await this.driver.generateKey({
          name: "RSA-PSS",
          modulusLength: 4096,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: {
            name: "SHA-256"
          }
        }, true, ["sign"]), c = await this.driver.exportKey("jwk", p.privateKey);
        return {
          kty: c.kty,
          e: c.e,
          n: c.n,
          d: c.d,
          p: c.p,
          q: c.q,
          dp: c.dp,
          dq: c.dq,
          qi: c.qi
        };
      }
      async sign(p, c, { saltLength: h } = {}) {
        let u = await this.driver.sign({
          name: "RSA-PSS",
          saltLength: h ?? 32
        }, await this.jwkToCryptoKey(p), c);
        return new Uint8Array(u);
      }
      async hash(p, c = "SHA-256") {
        let h = await this.driver.digest(c, p);
        return new Uint8Array(h);
      }
      async verify(p, c, h) {
        const u = {
          kty: "RSA",
          e: "AQAB",
          n: p
        }, a = await this.jwkToPublicCryptoKey(u), y = await this.driver.digest("SHA-256", c), v = await this.driver.verify({
          name: "RSA-PSS",
          saltLength: 0
        }, a, h, c), S = await this.driver.verify({
          name: "RSA-PSS",
          saltLength: 32
        }, a, h, c), _ = Math.ceil((a.algorithm.modulusLength - 1) / 8) - y.byteLength - 2, x = await this.driver.verify({
          name: "RSA-PSS",
          saltLength: _
        }, a, h, c), N = v || S || x;
        if (!N) {
          const I = {
            algorithm: a.algorithm.name,
            modulusLength: a.algorithm.modulusLength,
            keyUsages: a.usages,
            saltLengthsAttempted: `0, 32, ${_}`
          };
          console.warn(`Transaction Verification Failed! 
`, `Details: ${JSON.stringify(I, null, 2)} 
`, "N.B. ArweaveJS is only guaranteed to verify txs created using ArweaveJS.");
        }
        return N;
      }
      async jwkToCryptoKey(p) {
        return this.driver.importKey("jwk", p, {
          name: "RSA-PSS",
          hash: {
            name: "SHA-256"
          }
        }, false, ["sign"]);
      }
      async jwkToPublicCryptoKey(p) {
        return this.driver.importKey("jwk", p, {
          name: "RSA-PSS",
          hash: {
            name: "SHA-256"
          }
        }, false, ["verify"]);
      }
      detectWebCrypto() {
        if (typeof crypto > "u")
          return false;
        const p = crypto == null ? void 0 : crypto.subtle;
        return p === void 0 ? false : [
          "generateKey",
          "importKey",
          "exportKey",
          "digest",
          "sign"
        ].every((h) => typeof p[h] == "function");
      }
      async encrypt(p, c, h) {
        const u = await this.driver.importKey("raw", typeof c == "string" ? i.stringToBuffer(c) : c, {
          name: "PBKDF2",
          length: 32
        }, false, ["deriveKey"]), a = await this.driver.deriveKey({
          name: "PBKDF2",
          salt: h ? i.stringToBuffer(h) : i.stringToBuffer("salt"),
          iterations: 1e5,
          hash: "SHA-256"
        }, u, {
          name: "AES-CBC",
          length: 256
        }, false, ["encrypt", "decrypt"]), y = new Uint8Array(16);
        crypto.getRandomValues(y);
        const v = await this.driver.encrypt({
          name: "AES-CBC",
          iv: y
        }, a, p);
        return i.concatBuffers([y, v]);
      }
      async decrypt(p, c, h) {
        const u = await this.driver.importKey("raw", typeof c == "string" ? i.stringToBuffer(c) : c, {
          name: "PBKDF2",
          length: 32
        }, false, ["deriveKey"]), a = await this.driver.deriveKey({
          name: "PBKDF2",
          salt: h ? i.stringToBuffer(h) : i.stringToBuffer("salt"),
          iterations: 1e5,
          hash: "SHA-256"
        }, u, {
          name: "AES-CBC",
          length: 256
        }, false, ["encrypt", "decrypt"]), y = p.slice(0, 16), v = await this.driver.decrypt({
          name: "AES-CBC",
          iv: y
        }, a, p.slice(16));
        return i.concatBuffers([v]);
      }
    }
    return Le.default = l, Le;
  }
  var Pe = {};
  var mt;
  function pn() {
    if (mt) return Pe;
    mt = 1, Object.defineProperty(Pe, "__esModule", { value: true });
    class i {
      constructor(m) {
        $(this, "api");
        this.api = m;
      }
      getInfo() {
        return this.api.get("info").then((m) => m.data);
      }
      getPeers() {
        return this.api.get("peers").then((m) => m.data);
      }
    }
    return Pe.default = i, Pe;
  }
  var qe = {};
  var Re = {};
  var Et;
  function Ye() {
    if (Et) return Re;
    Et = 1, Object.defineProperty(Re, "__esModule", { value: true }), Re.getError = l;
    class i extends Error {
      constructor(h, u = {}) {
        var c = (...m) => (super(...m), $(this, "type"), $(this, "response"), this);
        u.message ? c(u.message) : c(), this.type = h, this.response = u.response;
      }
      getType() {
        return this.type;
      }
    }
    Re.default = i;
    function l(p) {
      let c = p.data;
      if (typeof p.data == "string")
        try {
          c = JSON.parse(p.data);
        } catch {
        }
      if (p.data instanceof ArrayBuffer || p.data instanceof Uint8Array)
        try {
          c = JSON.parse(c.toString());
        } catch {
        }
      return c ? c.error || c : p.statusText || "unknown";
    }
    return Re;
  }
  var De = {};
  var tt = {};
  var He = {};
  var At;
  function wn() {
    return At || (At = 1, He.read = function (i, l, m, p, c) {
      var h, u, a = c * 8 - p - 1, y = (1 << a) - 1, v = y >> 1, S = -7, _ = m ? c - 1 : 0, x = m ? -1 : 1, N = i[l + _];
      for (_ += x, h = N & (1 << -S) - 1, N >>= -S, S += a; S > 0; h = h * 256 + i[l + _], _ += x, S -= 8)
        ;
      for (u = h & (1 << -S) - 1, h >>= -S, S += p; S > 0; u = u * 256 + i[l + _], _ += x, S -= 8)
        ;
      if (h === 0)
        h = 1 - v;
      else {
        if (h === y)
          return u ? NaN : (N ? -1 : 1) * (1 / 0);
        u = u + Math.pow(2, p), h = h - v;
      }
      return (N ? -1 : 1) * u * Math.pow(2, h - p);
    }, He.write = function (i, l, m, p, c, h) {
      var u, a, y, v = h * 8 - c - 1, S = (1 << v) - 1, _ = S >> 1, x = c === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0, N = p ? 0 : h - 1, I = p ? 1 : -1, D = l < 0 || l === 0 && 1 / l < 0 ? 1 : 0;
      for (l = Math.abs(l), isNaN(l) || l === 1 / 0 ? (a = isNaN(l) ? 1 : 0, u = S) : (u = Math.floor(Math.log(l) / Math.LN2), l * (y = Math.pow(2, -u)) < 1 && (u--, y *= 2), u + _ >= 1 ? l += x / y : l += x * Math.pow(2, 1 - _), l * y >= 2 && (u++, y /= 2), u + _ >= S ? (a = 0, u = S) : u + _ >= 1 ? (a = (l * y - 1) * Math.pow(2, c), u = u + _) : (a = l * Math.pow(2, _ - 1) * Math.pow(2, c), u = 0)); c >= 8; i[m + N] = a & 255, N += I, a /= 256, c -= 8)
        ;
      for (u = u << c | a, v += c; v > 0; i[m + N] = u & 255, N += I, u /= 256, v -= 8)
        ;
      i[m + N - I] |= D * 128;
    }), He;
  }
  var vt;
  function gn() {
    return vt || (vt = 1, function (i) {
      var l = /* @__PURE__ */ zt(), m = /* @__PURE__ */ wn(), p = typeof Symbol == "function" && typeof Symbol.for == "function" ? Symbol.for("nodejs.util.inspect.custom") : null;
      i.Buffer = a, i.SlowBuffer = L, i.INSPECT_MAX_BYTES = 50;
      var c = 2147483647;
      i.kMaxLength = c, a.TYPED_ARRAY_SUPPORT = h(), !a.TYPED_ARRAY_SUPPORT && typeof console < "u" && typeof console.error == "function" && console.error(
        "This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support."
      );
      function h() {
        try {
          var r = new Uint8Array(1), e = {
            foo: function () {
              return 42;
            }
          };
          return Object.setPrototypeOf(e, Uint8Array.prototype), Object.setPrototypeOf(r, e), r.foo() === 42;
        } catch {
          return false;
        }
      }
      Object.defineProperty(a.prototype, "parent", {
        enumerable: true,
        get: function () {
          if (a.isBuffer(this))
            return this.buffer;
        }
      }), Object.defineProperty(a.prototype, "offset", {
        enumerable: true,
        get: function () {
          if (a.isBuffer(this))
            return this.byteOffset;
        }
      });
      function u(r) {
        if (r > c)
          throw new RangeError('The value "' + r + '" is invalid for option "size"');
        var e = new Uint8Array(r);
        return Object.setPrototypeOf(e, a.prototype), e;
      }
      function a(r, e, t) {
        if (typeof r == "number") {
          if (typeof e == "string")
            throw new TypeError(
              'The "string" argument must be of type string. Received type number'
            );
          return _(r);
        }
        return y(r, e, t);
      }
      a.poolSize = 8192;
      function y(r, e, t) {
        if (typeof r == "string")
          return x(r, e);
        if (ArrayBuffer.isView(r))
          return I(r);
        if (r == null)
          throw new TypeError(
            "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof r
          );
        if (A(r, ArrayBuffer) || r && A(r.buffer, ArrayBuffer) || typeof SharedArrayBuffer < "u" && (A(r, SharedArrayBuffer) || r && A(r.buffer, SharedArrayBuffer)))
          return D(r, e, t);
        if (typeof r == "number")
          throw new TypeError(
            'The "value" argument must not be of type number. Received type number'
          );
        var n = r.valueOf && r.valueOf();
        if (n != null && n !== r)
          return a.from(n, e, t);
        var s = q(r);
        if (s) return s;
        if (typeof Symbol < "u" && Symbol.toPrimitive != null && typeof r[Symbol.toPrimitive] == "function")
          return a.from(
            r[Symbol.toPrimitive]("string"),
            e,
            t
          );
        throw new TypeError(
          "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof r
        );
      }
      a.from = function (r, e, t) {
        return y(r, e, t);
      }, Object.setPrototypeOf(a.prototype, Uint8Array.prototype), Object.setPrototypeOf(a, Uint8Array);
      function v(r) {
        if (typeof r != "number")
          throw new TypeError('"size" argument must be of type number');
        if (r < 0)
          throw new RangeError('The value "' + r + '" is invalid for option "size"');
      }
      function S(r, e, t) {
        return v(r), r <= 0 ? u(r) : e !== void 0 ? typeof t == "string" ? u(r).fill(e, t) : u(r).fill(e) : u(r);
      }
      a.alloc = function (r, e, t) {
        return S(r, e, t);
      };
      function _(r) {
        return v(r), u(r < 0 ? 0 : z(r) | 0);
      }
      a.allocUnsafe = function (r) {
        return _(r);
      }, a.allocUnsafeSlow = function (r) {
        return _(r);
      };
      function x(r, e) {
        if ((typeof e != "string" || e === "") && (e = "utf8"), !a.isEncoding(e))
          throw new TypeError("Unknown encoding: " + e);
        var t = V(r, e) | 0, n = u(t), s = n.write(r, e);
        return s !== t && (n = n.slice(0, s)), n;
      }
      function N(r) {
        for (var e = r.length < 0 ? 0 : z(r.length) | 0, t = u(e), n = 0; n < e; n += 1)
          t[n] = r[n] & 255;
        return t;
      }
      function I(r) {
        if (A(r, Uint8Array)) {
          var e = new Uint8Array(r);
          return D(e.buffer, e.byteOffset, e.byteLength);
        }
        return N(r);
      }
      function D(r, e, t) {
        if (e < 0 || r.byteLength < e)
          throw new RangeError('"offset" is outside of buffer bounds');
        if (r.byteLength < e + (t || 0))
          throw new RangeError('"length" is outside of buffer bounds');
        var n;
        return e === void 0 && t === void 0 ? n = new Uint8Array(r) : t === void 0 ? n = new Uint8Array(r, e) : n = new Uint8Array(r, e, t), Object.setPrototypeOf(n, a.prototype), n;
      }
      function q(r) {
        if (a.isBuffer(r)) {
          var e = z(r.length) | 0, t = u(e);
          return t.length === 0 || r.copy(t, 0, 0, e), t;
        }
        if (r.length !== void 0)
          return typeof r.length != "number" || g(r.length) ? u(0) : N(r);
        if (r.type === "Buffer" && Array.isArray(r.data))
          return N(r.data);
      }
      function z(r) {
        if (r >= c)
          throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + c.toString(16) + " bytes");
        return r | 0;
      }
      function L(r) {
        return +r != r && (r = 0), a.alloc(+r);
      }
      a.isBuffer = function (e) {
        return e != null && e._isBuffer === true && e !== a.prototype;
      }, a.compare = function (e, t) {
        if (A(e, Uint8Array) && (e = a.from(e, e.offset, e.byteLength)), A(t, Uint8Array) && (t = a.from(t, t.offset, t.byteLength)), !a.isBuffer(e) || !a.isBuffer(t))
          throw new TypeError(
            'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
          );
        if (e === t) return 0;
        for (var n = e.length, s = t.length, w = 0, T = Math.min(n, s); w < T; ++w)
          if (e[w] !== t[w]) {
            n = e[w], s = t[w];
            break;
          }
        return n < s ? -1 : s < n ? 1 : 0;
      }, a.isEncoding = function (e) {
        switch (String(e).toLowerCase()) {
          case "hex":
          case "utf8":
          case "utf-8":
          case "ascii":
          case "latin1":
          case "binary":
          case "base64":
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return true;
          default:
            return false;
        }
      }, a.concat = function (e, t) {
        if (!Array.isArray(e))
          throw new TypeError('"list" argument must be an Array of Buffers');
        if (e.length === 0)
          return a.alloc(0);
        var n;
        if (t === void 0)
          for (t = 0, n = 0; n < e.length; ++n)
            t += e[n].length;
        var s = a.allocUnsafe(t), w = 0;
        for (n = 0; n < e.length; ++n) {
          var T = e[n];
          if (A(T, Uint8Array))
            w + T.length > s.length ? a.from(T).copy(s, w) : Uint8Array.prototype.set.call(
              s,
              T,
              w
            );
          else if (a.isBuffer(T))
            T.copy(s, w);
          else
            throw new TypeError('"list" argument must be an Array of Buffers');
          w += T.length;
        }
        return s;
      };
      function V(r, e) {
        if (a.isBuffer(r))
          return r.length;
        if (ArrayBuffer.isView(r) || A(r, ArrayBuffer))
          return r.byteLength;
        if (typeof r != "string")
          throw new TypeError(
            'The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof r
          );
        var t = r.length, n = arguments.length > 2 && arguments[2] === true;
        if (!n && t === 0) return 0;
        for (var s = false; ;)
          switch (e) {
            case "ascii":
            case "latin1":
            case "binary":
              return t;
            case "utf8":
            case "utf-8":
              return ae(r).length;
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return t * 2;
            case "hex":
              return t >>> 1;
            case "base64":
              return f(r).length;
            default:
              if (s)
                return n ? -1 : ae(r).length;
              e = ("" + e).toLowerCase(), s = true;
          }
      }
      a.byteLength = V;
      function Y(r, e, t) {
        var n = false;
        if ((e === void 0 || e < 0) && (e = 0), e > this.length || ((t === void 0 || t > this.length) && (t = this.length), t <= 0) || (t >>>= 0, e >>>= 0, t <= e))
          return "";
        for (r || (r = "utf8"); ;)
          switch (r) {
            case "hex":
              return pe(this, e, t);
            case "utf8":
            case "utf-8":
              return j(this, e, t);
            case "ascii":
              return ie(this, e, t);
            case "latin1":
            case "binary":
              return ue(this, e, t);
            case "base64":
              return F(this, e, t);
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return le(this, e, t);
            default:
              if (n) throw new TypeError("Unknown encoding: " + r);
              r = (r + "").toLowerCase(), n = true;
          }
      }
      a.prototype._isBuffer = true;
      function U(r, e, t) {
        var n = r[e];
        r[e] = r[t], r[t] = n;
      }
      a.prototype.swap16 = function () {
        var e = this.length;
        if (e % 2 !== 0)
          throw new RangeError("Buffer size must be a multiple of 16-bits");
        for (var t = 0; t < e; t += 2)
          U(this, t, t + 1);
        return this;
      }, a.prototype.swap32 = function () {
        var e = this.length;
        if (e % 4 !== 0)
          throw new RangeError("Buffer size must be a multiple of 32-bits");
        for (var t = 0; t < e; t += 4)
          U(this, t, t + 3), U(this, t + 1, t + 2);
        return this;
      }, a.prototype.swap64 = function () {
        var e = this.length;
        if (e % 8 !== 0)
          throw new RangeError("Buffer size must be a multiple of 64-bits");
        for (var t = 0; t < e; t += 8)
          U(this, t, t + 7), U(this, t + 1, t + 6), U(this, t + 2, t + 5), U(this, t + 3, t + 4);
        return this;
      }, a.prototype.toString = function () {
        var e = this.length;
        return e === 0 ? "" : arguments.length === 0 ? j(this, 0, e) : Y.apply(this, arguments);
      }, a.prototype.toLocaleString = a.prototype.toString, a.prototype.equals = function (e) {
        if (!a.isBuffer(e)) throw new TypeError("Argument must be a Buffer");
        return this === e ? true : a.compare(this, e) === 0;
      }, a.prototype.inspect = function () {
        var e = "", t = i.INSPECT_MAX_BYTES;
        return e = this.toString("hex", 0, t).replace(/(.{2})/g, "$1 ").trim(), this.length > t && (e += " ... "), "<Buffer " + e + ">";
      }, p && (a.prototype[p] = a.prototype.inspect), a.prototype.compare = function (e, t, n, s, w) {
        if (A(e, Uint8Array) && (e = a.from(e, e.offset, e.byteLength)), !a.isBuffer(e))
          throw new TypeError(
            'The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof e
          );
        if (t === void 0 && (t = 0), n === void 0 && (n = e ? e.length : 0), s === void 0 && (s = 0), w === void 0 && (w = this.length), t < 0 || n > e.length || s < 0 || w > this.length)
          throw new RangeError("out of range index");
        if (s >= w && t >= n)
          return 0;
        if (s >= w)
          return -1;
        if (t >= n)
          return 1;
        if (t >>>= 0, n >>>= 0, s >>>= 0, w >>>= 0, this === e) return 0;
        for (var T = w - s, O = n - t, P = Math.min(T, O), K = this.slice(s, w), G = e.slice(t, n), H = 0; H < P; ++H)
          if (K[H] !== G[H]) {
            T = K[H], O = G[H];
            break;
          }
        return T < O ? -1 : O < T ? 1 : 0;
      };
      function B(r, e, t, n, s) {
        if (r.length === 0) return -1;
        if (typeof t == "string" ? (n = t, t = 0) : t > 2147483647 ? t = 2147483647 : t < -2147483648 && (t = -2147483648), t = +t, g(t) && (t = s ? 0 : r.length - 1), t < 0 && (t = r.length + t), t >= r.length) {
          if (s) return -1;
          t = r.length - 1;
        } else if (t < 0)
          if (s) t = 0;
          else return -1;
        if (typeof e == "string" && (e = a.from(e, n)), a.isBuffer(e))
          return e.length === 0 ? -1 : k(r, e, t, n, s);
        if (typeof e == "number")
          return e = e & 255, typeof Uint8Array.prototype.indexOf == "function" ? s ? Uint8Array.prototype.indexOf.call(r, e, t) : Uint8Array.prototype.lastIndexOf.call(r, e, t) : k(r, [e], t, n, s);
        throw new TypeError("val must be string, number or Buffer");
      }
      function k(r, e, t, n, s) {
        var w = 1, T = r.length, O = e.length;
        if (n !== void 0 && (n = String(n).toLowerCase(), n === "ucs2" || n === "ucs-2" || n === "utf16le" || n === "utf-16le")) {
          if (r.length < 2 || e.length < 2)
            return -1;
          w = 2, T /= 2, O /= 2, t /= 2;
        }
        function P(ne, we) {
          return w === 1 ? ne[we] : ne.readUInt16BE(we * w);
        }
        var K;
        if (s) {
          var G = -1;
          for (K = t; K < T; K++)
            if (P(r, K) === P(e, G === -1 ? 0 : K - G)) {
              if (G === -1 && (G = K), K - G + 1 === O) return G * w;
            } else
              G !== -1 && (K -= K - G), G = -1;
        } else
          for (t + O > T && (t = T - O), K = t; K >= 0; K--) {
            for (var H = true, X = 0; X < O; X++)
              if (P(r, K + X) !== P(e, X)) {
                H = false;
                break;
              }
            if (H) return K;
          }
        return -1;
      }
      a.prototype.includes = function (e, t, n) {
        return this.indexOf(e, t, n) !== -1;
      }, a.prototype.indexOf = function (e, t, n) {
        return B(this, e, t, n, true);
      }, a.prototype.lastIndexOf = function (e, t, n) {
        return B(this, e, t, n, false);
      };
      function M(r, e, t, n) {
        t = Number(t) || 0;
        var s = r.length - t;
        n ? (n = Number(n), n > s && (n = s)) : n = s;
        var w = e.length;
        n > w / 2 && (n = w / 2);
        for (var T = 0; T < n; ++T) {
          var O = parseInt(e.substr(T * 2, 2), 16);
          if (g(O)) return T;
          r[t + T] = O;
        }
        return T;
      }
      function W(r, e, t, n) {
        return d(ae(e, r.length - t), r, t, n);
      }
      function C(r, e, t, n) {
        return d(fe(e), r, t, n);
      }
      function J(r, e, t, n) {
        return d(f(e), r, t, n);
      }
      function R(r, e, t, n) {
        return d(o(e, r.length - t), r, t, n);
      }
      a.prototype.write = function (e, t, n, s) {
        if (t === void 0)
          s = "utf8", n = this.length, t = 0;
        else if (n === void 0 && typeof t == "string")
          s = t, n = this.length, t = 0;
        else if (isFinite(t))
          t = t >>> 0, isFinite(n) ? (n = n >>> 0, s === void 0 && (s = "utf8")) : (s = n, n = void 0);
        else
          throw new Error(
            "Buffer.write(string, encoding, offset[, length]) is no longer supported"
          );
        var w = this.length - t;
        if ((n === void 0 || n > w) && (n = w), e.length > 0 && (n < 0 || t < 0) || t > this.length)
          throw new RangeError("Attempt to write outside buffer bounds");
        s || (s = "utf8");
        for (var T = false; ;)
          switch (s) {
            case "hex":
              return M(this, e, t, n);
            case "utf8":
            case "utf-8":
              return W(this, e, t, n);
            case "ascii":
            case "latin1":
            case "binary":
              return C(this, e, t, n);
            case "base64":
              return J(this, e, t, n);
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return R(this, e, t, n);
            default:
              if (T) throw new TypeError("Unknown encoding: " + s);
              s = ("" + s).toLowerCase(), T = true;
          }
      }, a.prototype.toJSON = function () {
        return {
          type: "Buffer",
          data: Array.prototype.slice.call(this._arr || this, 0)
        };
      };
      function F(r, e, t) {
        return e === 0 && t === r.length ? l.fromByteArray(r) : l.fromByteArray(r.slice(e, t));
      }
      function j(r, e, t) {
        t = Math.min(r.length, t);
        for (var n = [], s = e; s < t;) {
          var w = r[s], T = null, O = w > 239 ? 4 : w > 223 ? 3 : w > 191 ? 2 : 1;
          if (s + O <= t) {
            var P, K, G, H;
            switch (O) {
              case 1:
                w < 128 && (T = w);
                break;
              case 2:
                P = r[s + 1], (P & 192) === 128 && (H = (w & 31) << 6 | P & 63, H > 127 && (T = H));
                break;
              case 3:
                P = r[s + 1], K = r[s + 2], (P & 192) === 128 && (K & 192) === 128 && (H = (w & 15) << 12 | (P & 63) << 6 | K & 63, H > 2047 && (H < 55296 || H > 57343) && (T = H));
                break;
              case 4:
                P = r[s + 1], K = r[s + 2], G = r[s + 3], (P & 192) === 128 && (K & 192) === 128 && (G & 192) === 128 && (H = (w & 15) << 18 | (P & 63) << 12 | (K & 63) << 6 | G & 63, H > 65535 && H < 1114112 && (T = H));
            }
          }
          T === null ? (T = 65533, O = 1) : T > 65535 && (T -= 65536, n.push(T >>> 10 & 1023 | 55296), T = 56320 | T & 1023), n.push(T), s += O;
        }
        return re(n);
      }
      var Z = 4096;
      function re(r) {
        var e = r.length;
        if (e <= Z)
          return String.fromCharCode.apply(String, r);
        for (var t = "", n = 0; n < e;)
          t += String.fromCharCode.apply(
            String,
            r.slice(n, n += Z)
          );
        return t;
      }
      function ie(r, e, t) {
        var n = "";
        t = Math.min(r.length, t);
        for (var s = e; s < t; ++s)
          n += String.fromCharCode(r[s] & 127);
        return n;
      }
      function ue(r, e, t) {
        var n = "";
        t = Math.min(r.length, t);
        for (var s = e; s < t; ++s)
          n += String.fromCharCode(r[s]);
        return n;
      }
      function pe(r, e, t) {
        var n = r.length;
        (!e || e < 0) && (e = 0), (!t || t < 0 || t > n) && (t = n);
        for (var s = "", w = e; w < t; ++w)
          s += E[r[w]];
        return s;
      }
      function le(r, e, t) {
        for (var n = r.slice(e, t), s = "", w = 0; w < n.length - 1; w += 2)
          s += String.fromCharCode(n[w] + n[w + 1] * 256);
        return s;
      }
      a.prototype.slice = function (e, t) {
        var n = this.length;
        e = ~~e, t = t === void 0 ? n : ~~t, e < 0 ? (e += n, e < 0 && (e = 0)) : e > n && (e = n), t < 0 ? (t += n, t < 0 && (t = 0)) : t > n && (t = n), t < e && (t = e);
        var s = this.subarray(e, t);
        return Object.setPrototypeOf(s, a.prototype), s;
      };
      function Q(r, e, t) {
        if (r % 1 !== 0 || r < 0) throw new RangeError("offset is not uint");
        if (r + e > t) throw new RangeError("Trying to access beyond buffer length");
      }
      a.prototype.readUintLE = a.prototype.readUIntLE = function (e, t, n) {
        e = e >>> 0, t = t >>> 0, n || Q(e, t, this.length);
        for (var s = this[e], w = 1, T = 0; ++T < t && (w *= 256);)
          s += this[e + T] * w;
        return s;
      }, a.prototype.readUintBE = a.prototype.readUIntBE = function (e, t, n) {
        e = e >>> 0, t = t >>> 0, n || Q(e, t, this.length);
        for (var s = this[e + --t], w = 1; t > 0 && (w *= 256);)
          s += this[e + --t] * w;
        return s;
      }, a.prototype.readUint8 = a.prototype.readUInt8 = function (e, t) {
        return e = e >>> 0, t || Q(e, 1, this.length), this[e];
      }, a.prototype.readUint16LE = a.prototype.readUInt16LE = function (e, t) {
        return e = e >>> 0, t || Q(e, 2, this.length), this[e] | this[e + 1] << 8;
      }, a.prototype.readUint16BE = a.prototype.readUInt16BE = function (e, t) {
        return e = e >>> 0, t || Q(e, 2, this.length), this[e] << 8 | this[e + 1];
      }, a.prototype.readUint32LE = a.prototype.readUInt32LE = function (e, t) {
        return e = e >>> 0, t || Q(e, 4, this.length), (this[e] | this[e + 1] << 8 | this[e + 2] << 16) + this[e + 3] * 16777216;
      }, a.prototype.readUint32BE = a.prototype.readUInt32BE = function (e, t) {
        return e = e >>> 0, t || Q(e, 4, this.length), this[e] * 16777216 + (this[e + 1] << 16 | this[e + 2] << 8 | this[e + 3]);
      }, a.prototype.readIntLE = function (e, t, n) {
        e = e >>> 0, t = t >>> 0, n || Q(e, t, this.length);
        for (var s = this[e], w = 1, T = 0; ++T < t && (w *= 256);)
          s += this[e + T] * w;
        return w *= 128, s >= w && (s -= Math.pow(2, 8 * t)), s;
      }, a.prototype.readIntBE = function (e, t, n) {
        e = e >>> 0, t = t >>> 0, n || Q(e, t, this.length);
        for (var s = t, w = 1, T = this[e + --s]; s > 0 && (w *= 256);)
          T += this[e + --s] * w;
        return w *= 128, T >= w && (T -= Math.pow(2, 8 * t)), T;
      }, a.prototype.readInt8 = function (e, t) {
        return e = e >>> 0, t || Q(e, 1, this.length), this[e] & 128 ? (255 - this[e] + 1) * -1 : this[e];
      }, a.prototype.readInt16LE = function (e, t) {
        e = e >>> 0, t || Q(e, 2, this.length);
        var n = this[e] | this[e + 1] << 8;
        return n & 32768 ? n | 4294901760 : n;
      }, a.prototype.readInt16BE = function (e, t) {
        e = e >>> 0, t || Q(e, 2, this.length);
        var n = this[e + 1] | this[e] << 8;
        return n & 32768 ? n | 4294901760 : n;
      }, a.prototype.readInt32LE = function (e, t) {
        return e = e >>> 0, t || Q(e, 4, this.length), this[e] | this[e + 1] << 8 | this[e + 2] << 16 | this[e + 3] << 24;
      }, a.prototype.readInt32BE = function (e, t) {
        return e = e >>> 0, t || Q(e, 4, this.length), this[e] << 24 | this[e + 1] << 16 | this[e + 2] << 8 | this[e + 3];
      }, a.prototype.readFloatLE = function (e, t) {
        return e = e >>> 0, t || Q(e, 4, this.length), m.read(this, e, true, 23, 4);
      }, a.prototype.readFloatBE = function (e, t) {
        return e = e >>> 0, t || Q(e, 4, this.length), m.read(this, e, false, 23, 4);
      }, a.prototype.readDoubleLE = function (e, t) {
        return e = e >>> 0, t || Q(e, 8, this.length), m.read(this, e, true, 52, 8);
      }, a.prototype.readDoubleBE = function (e, t) {
        return e = e >>> 0, t || Q(e, 8, this.length), m.read(this, e, false, 52, 8);
      };
      function ee(r, e, t, n, s, w) {
        if (!a.isBuffer(r)) throw new TypeError('"buffer" argument must be a Buffer instance');
        if (e > s || e < w) throw new RangeError('"value" argument is out of bounds');
        if (t + n > r.length) throw new RangeError("Index out of range");
      }
      a.prototype.writeUintLE = a.prototype.writeUIntLE = function (e, t, n, s) {
        if (e = +e, t = t >>> 0, n = n >>> 0, !s) {
          var w = Math.pow(2, 8 * n) - 1;
          ee(this, e, t, n, w, 0);
        }
        var T = 1, O = 0;
        for (this[t] = e & 255; ++O < n && (T *= 256);)
          this[t + O] = e / T & 255;
        return t + n;
      }, a.prototype.writeUintBE = a.prototype.writeUIntBE = function (e, t, n, s) {
        if (e = +e, t = t >>> 0, n = n >>> 0, !s) {
          var w = Math.pow(2, 8 * n) - 1;
          ee(this, e, t, n, w, 0);
        }
        var T = n - 1, O = 1;
        for (this[t + T] = e & 255; --T >= 0 && (O *= 256);)
          this[t + T] = e / O & 255;
        return t + n;
      }, a.prototype.writeUint8 = a.prototype.writeUInt8 = function (e, t, n) {
        return e = +e, t = t >>> 0, n || ee(this, e, t, 1, 255, 0), this[t] = e & 255, t + 1;
      }, a.prototype.writeUint16LE = a.prototype.writeUInt16LE = function (e, t, n) {
        return e = +e, t = t >>> 0, n || ee(this, e, t, 2, 65535, 0), this[t] = e & 255, this[t + 1] = e >>> 8, t + 2;
      }, a.prototype.writeUint16BE = a.prototype.writeUInt16BE = function (e, t, n) {
        return e = +e, t = t >>> 0, n || ee(this, e, t, 2, 65535, 0), this[t] = e >>> 8, this[t + 1] = e & 255, t + 2;
      }, a.prototype.writeUint32LE = a.prototype.writeUInt32LE = function (e, t, n) {
        return e = +e, t = t >>> 0, n || ee(this, e, t, 4, 4294967295, 0), this[t + 3] = e >>> 24, this[t + 2] = e >>> 16, this[t + 1] = e >>> 8, this[t] = e & 255, t + 4;
      }, a.prototype.writeUint32BE = a.prototype.writeUInt32BE = function (e, t, n) {
        return e = +e, t = t >>> 0, n || ee(this, e, t, 4, 4294967295, 0), this[t] = e >>> 24, this[t + 1] = e >>> 16, this[t + 2] = e >>> 8, this[t + 3] = e & 255, t + 4;
      }, a.prototype.writeIntLE = function (e, t, n, s) {
        if (e = +e, t = t >>> 0, !s) {
          var w = Math.pow(2, 8 * n - 1);
          ee(this, e, t, n, w - 1, -w);
        }
        var T = 0, O = 1, P = 0;
        for (this[t] = e & 255; ++T < n && (O *= 256);)
          e < 0 && P === 0 && this[t + T - 1] !== 0 && (P = 1), this[t + T] = (e / O >> 0) - P & 255;
        return t + n;
      }, a.prototype.writeIntBE = function (e, t, n, s) {
        if (e = +e, t = t >>> 0, !s) {
          var w = Math.pow(2, 8 * n - 1);
          ee(this, e, t, n, w - 1, -w);
        }
        var T = n - 1, O = 1, P = 0;
        for (this[t + T] = e & 255; --T >= 0 && (O *= 256);)
          e < 0 && P === 0 && this[t + T + 1] !== 0 && (P = 1), this[t + T] = (e / O >> 0) - P & 255;
        return t + n;
      }, a.prototype.writeInt8 = function (e, t, n) {
        return e = +e, t = t >>> 0, n || ee(this, e, t, 1, 127, -128), e < 0 && (e = 255 + e + 1), this[t] = e & 255, t + 1;
      }, a.prototype.writeInt16LE = function (e, t, n) {
        return e = +e, t = t >>> 0, n || ee(this, e, t, 2, 32767, -32768), this[t] = e & 255, this[t + 1] = e >>> 8, t + 2;
      }, a.prototype.writeInt16BE = function (e, t, n) {
        return e = +e, t = t >>> 0, n || ee(this, e, t, 2, 32767, -32768), this[t] = e >>> 8, this[t + 1] = e & 255, t + 2;
      }, a.prototype.writeInt32LE = function (e, t, n) {
        return e = +e, t = t >>> 0, n || ee(this, e, t, 4, 2147483647, -2147483648), this[t] = e & 255, this[t + 1] = e >>> 8, this[t + 2] = e >>> 16, this[t + 3] = e >>> 24, t + 4;
      }, a.prototype.writeInt32BE = function (e, t, n) {
        return e = +e, t = t >>> 0, n || ee(this, e, t, 4, 2147483647, -2147483648), e < 0 && (e = 4294967295 + e + 1), this[t] = e >>> 24, this[t + 1] = e >>> 16, this[t + 2] = e >>> 8, this[t + 3] = e & 255, t + 4;
      };
      function Ee(r, e, t, n, s, w) {
        if (t + n > r.length) throw new RangeError("Index out of range");
        if (t < 0) throw new RangeError("Index out of range");
      }
      function b(r, e, t, n, s) {
        return e = +e, t = t >>> 0, s || Ee(r, e, t, 4), m.write(r, e, t, n, 23, 4), t + 4;
      }
      a.prototype.writeFloatLE = function (e, t, n) {
        return b(this, e, t, true, n);
      }, a.prototype.writeFloatBE = function (e, t, n) {
        return b(this, e, t, false, n);
      };
      function Ae(r, e, t, n, s) {
        return e = +e, t = t >>> 0, s || Ee(r, e, t, 8), m.write(r, e, t, n, 52, 8), t + 8;
      }
      a.prototype.writeDoubleLE = function (e, t, n) {
        return Ae(this, e, t, true, n);
      }, a.prototype.writeDoubleBE = function (e, t, n) {
        return Ae(this, e, t, false, n);
      }, a.prototype.copy = function (e, t, n, s) {
        if (!a.isBuffer(e)) throw new TypeError("argument should be a Buffer");
        if (n || (n = 0), !s && s !== 0 && (s = this.length), t >= e.length && (t = e.length), t || (t = 0), s > 0 && s < n && (s = n), s === n || e.length === 0 || this.length === 0) return 0;
        if (t < 0)
          throw new RangeError("targetStart out of bounds");
        if (n < 0 || n >= this.length) throw new RangeError("Index out of range");
        if (s < 0) throw new RangeError("sourceEnd out of bounds");
        s > this.length && (s = this.length), e.length - t < s - n && (s = e.length - t + n);
        var w = s - n;
        return this === e && typeof Uint8Array.prototype.copyWithin == "function" ? this.copyWithin(t, n, s) : Uint8Array.prototype.set.call(
          e,
          this.subarray(n, s),
          t
        ), w;
      }, a.prototype.fill = function (e, t, n, s) {
        if (typeof e == "string") {
          if (typeof t == "string" ? (s = t, t = 0, n = this.length) : typeof n == "string" && (s = n, n = this.length), s !== void 0 && typeof s != "string")
            throw new TypeError("encoding must be a string");
          if (typeof s == "string" && !a.isEncoding(s))
            throw new TypeError("Unknown encoding: " + s);
          if (e.length === 1) {
            var w = e.charCodeAt(0);
            (s === "utf8" && w < 128 || s === "latin1") && (e = w);
          }
        } else typeof e == "number" ? e = e & 255 : typeof e == "boolean" && (e = Number(e));
        if (t < 0 || this.length < t || this.length < n)
          throw new RangeError("Out of range index");
        if (n <= t)
          return this;
        t = t >>> 0, n = n === void 0 ? this.length : n >>> 0, e || (e = 0);
        var T;
        if (typeof e == "number")
          for (T = t; T < n; ++T)
            this[T] = e;
        else {
          var O = a.isBuffer(e) ? e : a.from(e, s), P = O.length;
          if (P === 0)
            throw new TypeError('The value "' + e + '" is invalid for argument "value"');
          for (T = 0; T < n - t; ++T)
            this[T + t] = O[T % P];
        }
        return this;
      };
      var be = /[^+/0-9A-Za-z-_]/g;
      function xe(r) {
        if (r = r.split("=")[0], r = r.trim().replace(be, ""), r.length < 2) return "";
        for (; r.length % 4 !== 0;)
          r = r + "=";
        return r;
      }
      function ae(r, e) {
        e = e || 1 / 0;
        for (var t, n = r.length, s = null, w = [], T = 0; T < n; ++T) {
          if (t = r.charCodeAt(T), t > 55295 && t < 57344) {
            if (!s) {
              if (t > 56319) {
                (e -= 3) > -1 && w.push(239, 191, 189);
                continue;
              } else if (T + 1 === n) {
                (e -= 3) > -1 && w.push(239, 191, 189);
                continue;
              }
              s = t;
              continue;
            }
            if (t < 56320) {
              (e -= 3) > -1 && w.push(239, 191, 189), s = t;
              continue;
            }
            t = (s - 55296 << 10 | t - 56320) + 65536;
          } else s && (e -= 3) > -1 && w.push(239, 191, 189);
          if (s = null, t < 128) {
            if ((e -= 1) < 0) break;
            w.push(t);
          } else if (t < 2048) {
            if ((e -= 2) < 0) break;
            w.push(
              t >> 6 | 192,
              t & 63 | 128
            );
          } else if (t < 65536) {
            if ((e -= 3) < 0) break;
            w.push(
              t >> 12 | 224,
              t >> 6 & 63 | 128,
              t & 63 | 128
            );
          } else if (t < 1114112) {
            if ((e -= 4) < 0) break;
            w.push(
              t >> 18 | 240,
              t >> 12 & 63 | 128,
              t >> 6 & 63 | 128,
              t & 63 | 128
            );
          } else
            throw new Error("Invalid code point");
        }
        return w;
      }
      function fe(r) {
        for (var e = [], t = 0; t < r.length; ++t)
          e.push(r.charCodeAt(t) & 255);
        return e;
      }
      function o(r, e) {
        for (var t, n, s, w = [], T = 0; T < r.length && !((e -= 2) < 0); ++T)
          t = r.charCodeAt(T), n = t >> 8, s = t % 256, w.push(s), w.push(n);
        return w;
      }
      function f(r) {
        return l.toByteArray(xe(r));
      }
      function d(r, e, t, n) {
        for (var s = 0; s < n && !(s + t >= e.length || s >= r.length); ++s)
          e[s + t] = r[s];
        return s;
      }
      function A(r, e) {
        return r instanceof e || r != null && r.constructor != null && r.constructor.name != null && r.constructor.name === e.name;
      }
      function g(r) {
        return r !== r;
      }
      var E = function () {
        for (var r = "0123456789abcdef", e = new Array(256), t = 0; t < 16; ++t)
          for (var n = t * 16, s = 0; s < 16; ++s)
            e[n + s] = r[t] + r[s];
        return e;
      }();
    }(tt)), tt;
  }
  var Tt = /* @__PURE__ */ gn();
  (function (i) {
    function l() {
      var p = this || self;
      return delete i.prototype.__magic__, p;
    }
    if (typeof globalThis == "object")
      return globalThis;
    if (this)
      return l();
    i.defineProperty(i.prototype, "__magic__", {
      configurable: true,
      get: l
    });
    var m = __magic__;
    return m;
  })(Object);
  var rt = {};
  var St;
  function jt() {
    return St || (St = 1, function (i) {
      Object.defineProperty(i, "__esModule", { value: true }), i.arrayCompare = i.MIN_CHUNK_SIZE = i.MAX_CHUNK_SIZE = void 0, i.chunkData = h, i.generateLeaves = u, i.computeRootHash = a, i.generateTree = y, i.generateTransactionChunks = v, i.buildLayers = S, i.generateProofs = _, i.arrayFlatten = N, i.intToBuffer = q, i.bufferToInt = z, i.validatePath = V, i.debug = Y;
      const l = /* @__PURE__ */ Je(), m = /* @__PURE__ */ de();
      i.MAX_CHUNK_SIZE = 256 * 1024, i.MIN_CHUNK_SIZE = 32 * 1024;
      const p = 32, c = 32;
      async function h(U) {
        let B = [], k = U, M = 0;
        for (; k.byteLength >= i.MAX_CHUNK_SIZE;) {
          let W = i.MAX_CHUNK_SIZE, C = k.byteLength - i.MAX_CHUNK_SIZE;
          C > 0 && C < i.MIN_CHUNK_SIZE && (W = Math.ceil(k.byteLength / 2));
          const J = k.slice(0, W), R = await l.default.crypto.hash(J);
          M += J.byteLength, B.push({
            dataHash: R,
            minByteRange: M - J.byteLength,
            maxByteRange: M
          }), k = k.slice(W);
        }
        return B.push({
          dataHash: await l.default.crypto.hash(k),
          minByteRange: M,
          maxByteRange: M + k.byteLength
        }), B;
      }
      async function u(U) {
        return Promise.all(U.map(async ({ dataHash: B, minByteRange: k, maxByteRange: M }) => ({
          type: "leaf",
          id: await D(await Promise.all([D(B), D(q(M))])),
          dataHash: B,
          minByteRange: k,
          maxByteRange: M
        })));
      }
      async function a(U) {
        return (await y(U)).id;
      }
      async function y(U) {
        return await S(await u(await h(U)));
      }
      async function v(U) {
        const B = await h(U), k = await u(B), M = await S(k), W = await _(M), C = B.slice(-1)[0];
        return C.maxByteRange - C.minByteRange === 0 && (B.splice(B.length - 1, 1), W.splice(W.length - 1, 1)), {
          data_root: M.id,
          chunks: B,
          proofs: W
        };
      }
      async function S(U, B = 0) {
        if (U.length < 2)
          return U[0];
        const k = [];
        for (let M = 0; M < U.length; M += 2)
          k.push(await I(U[M], U[M + 1]));
        return S(k, B + 1);
      }
      function _(U) {
        const B = x(U);
        return Array.isArray(B) ? N(B) : [B];
      }
      function x(U, B = new Uint8Array(), k = 0) {
        if (U.type == "leaf")
          return {
            offset: U.maxByteRange - 1,
            proof: (0, m.concatBuffers)([
              B,
              U.dataHash,
              q(U.maxByteRange)
            ])
          };
        if (U.type == "branch") {
          const M = (0, m.concatBuffers)([
            B,
            U.leftChild.id,
            U.rightChild.id,
            q(U.byteRange)
          ]);
          return [
            x(U.leftChild, M, k + 1),
            x(U.rightChild, M, k + 1)
          ];
        }
        throw new Error("Unexpected node type");
      }
      function N(U) {
        const B = [];
        return U.forEach((k) => {
          Array.isArray(k) ? B.push(...N(k)) : B.push(k);
        }), B;
      }
      async function I(U, B) {
        return B ? {
          type: "branch",
          id: await D([
            await D(U.id),
            await D(B.id),
            await D(q(U.maxByteRange))
          ]),
          byteRange: U.maxByteRange,
          maxByteRange: B.maxByteRange,
          leftChild: U,
          rightChild: B
        } : U;
      }
      async function D(U) {
        return Array.isArray(U) && (U = l.default.utils.concatBuffers(U)), new Uint8Array(await l.default.crypto.hash(U));
      }
      function q(U) {
        const B = new Uint8Array(p);
        for (var k = B.length - 1; k >= 0; k--) {
          var M = U % 256;
          B[k] = M, U = (U - M) / 256;
        }
        return B;
      }
      function z(U) {
        let B = 0;
        for (var k = 0; k < U.length; k++)
          B *= 256, B += U[k];
        return B;
      }
      const L = (U, B) => U.every((k, M) => B[M] === k);
      i.arrayCompare = L;
      async function V(U, B, k, M, W) {
        if (M <= 0)
          return false;
        if (B >= M)
          return V(U, 0, M - 1, M, W);
        if (B < 0)
          return V(U, 0, 0, M, W);
        if (W.length == c + p) {
          const re = W.slice(0, c), ie = W.slice(re.length, re.length + p), ue = await D([
            await D(re),
            await D(ie)
          ]);
          return (0, i.arrayCompare)(U, ue) ? {
            offset: M - 1,
            leftBound: k,
            rightBound: M,
            chunkSize: M - k
          } : false;
        }
        const C = W.slice(0, c), J = W.slice(C.length, C.length + c), R = W.slice(C.length + J.length, C.length + J.length + p), F = z(R), j = W.slice(C.length + J.length + R.length), Z = await D([
          await D(C),
          await D(J),
          await D(R)
        ]);
        return (0, i.arrayCompare)(U, Z) ? B < F ? await V(C, B, k, Math.min(M, F), j) : await V(J, B, Math.max(k, F), M, j) : false;
      }
      async function Y(U, B = "") {
        if (U.byteLength < 1)
          return B;
        const k = U.slice(0, c), M = U.slice(k.length, k.length + c), W = U.slice(k.length + M.length, k.length + M.length + p), C = z(W), J = U.slice(k.length + M.length + W.length), R = await D([
          await D(k),
          await D(M),
          await D(W)
        ]), F = `${B}
${JSON.stringify(Tt.Buffer.from(k))},${JSON.stringify(Tt.Buffer.from(M))},${C} => ${JSON.stringify(R)}`;
        return Y(J, F);
      }
    }(rt)), rt;
  }
  var _t;
  function yn() {
    if (_t) return De;
    _t = 1, Object.defineProperty(De, "__esModule", { value: true }), De.TransactionUploader = void 0;
    const i = /* @__PURE__ */ ct(), l = /* @__PURE__ */ de(), m = /* @__PURE__ */ Ye(), p = /* @__PURE__ */ jt(), c = 1, h = [
      "invalid_json",
      "chunk_too_big",
      "data_path_too_big",
      "offset_too_big",
      "data_size_too_big",
      "chunk_proof_ratio_not_attractive",
      "invalid_proof"
    ], u = 1e3 * 40;
    class a {
      constructor(v, S) {
        $(this, "api");
        $(this, "chunkIndex", 0);
        $(this, "txPosted", false);
        $(this, "transaction");
        $(this, "lastRequestTimeEnd", 0);
        $(this, "totalErrors", 0);
        $(this, "data");
        $(this, "lastResponseStatus", 0);
        $(this, "lastResponseError", "");
        if (this.api = v, !S.id)
          throw new Error("Transaction is not signed");
        if (!S.chunks)
          throw new Error("Transaction chunks not prepared");
        this.data = S.data, this.transaction = new i.default(Object.assign({}, S, { data: new Uint8Array(0) }));
      }
      get isComplete() {
        return this.txPosted && this.chunkIndex === this.transaction.chunks.chunks.length;
      }
      get totalChunks() {
        return this.transaction.chunks.chunks.length;
      }
      get uploadedChunks() {
        return this.chunkIndex;
      }
      get pctComplete() {
        return Math.trunc(this.uploadedChunks / this.totalChunks * 100);
      }
      /**
       * Uploads the next part of the transaction.
       * On the first call this posts the transaction
       * itself and on any subsequent calls uploads the
       * next chunk until it completes.
       */
      async uploadChunk(v) {
        if (this.isComplete)
          throw new Error("Upload is already complete");
        if (this.lastResponseError !== "" ? this.totalErrors++ : this.totalErrors = 0, this.totalErrors === 100)
          throw new Error(`Unable to complete upload: ${this.lastResponseStatus}: ${this.lastResponseError}`);
        let S = this.lastResponseError === "" ? 0 : Math.max(this.lastRequestTimeEnd + u - Date.now(), u);
        if (S > 0 && (S = S - S * Math.random() * 0.3, await new Promise((I) => setTimeout(I, S))), this.lastResponseError = "", !this.txPosted) {
          await this.postTransaction();
          return;
        }
        v && (this.chunkIndex = v);
        const _ = this.transaction.getChunk(v || this.chunkIndex, this.data);
        if (!await (0, p.validatePath)(this.transaction.chunks.data_root, parseInt(_.offset), 0, parseInt(_.data_size), l.b64UrlToBuffer(_.data_path)))
          throw new Error(`Unable to validate chunk ${this.chunkIndex}`);
        const N = await this.api.post("chunk", this.transaction.getChunk(this.chunkIndex, this.data)).catch((I) => (console.error(I.message), { status: -1, data: { error: I.message } }));
        if (this.lastRequestTimeEnd = Date.now(), this.lastResponseStatus = N.status, this.lastResponseStatus == 200)
          this.chunkIndex++;
        else if (this.lastResponseError = (0, m.getError)(N), h.includes(this.lastResponseError))
          throw new Error(`Fatal error uploading chunk ${this.chunkIndex}: ${this.lastResponseError}`);
      }
      /**
       * Reconstructs an upload from its serialized state and data.
       * Checks if data matches the expected data_root.
       *
       * @param serialized
       * @param data
       */
      static async fromSerialized(v, S, _) {
        if (!S || typeof S.chunkIndex != "number" || typeof S.transaction != "object")
          throw new Error("Serialized object does not match expected format.");
        var x = new i.default(S.transaction);
        x.chunks || await x.prepareChunks(_);
        const N = new a(v, x);
        if (N.chunkIndex = S.chunkIndex, N.lastRequestTimeEnd = S.lastRequestTimeEnd, N.lastResponseError = S.lastResponseError, N.lastResponseStatus = S.lastResponseStatus, N.txPosted = S.txPosted, N.data = _, N.transaction.data_root !== S.transaction.data_root)
          throw new Error("Data mismatch: Uploader doesn't match provided data.");
        return N;
      }
      /**
       * Reconstruct an upload from the tx metadata, ie /tx/<id>.
       *
       * @param api
       * @param id
       * @param data
       */
      static async fromTransactionId(v, S) {
        const _ = await v.get(`tx/${S}`);
        if (_.status !== 200)
          throw new Error(`Tx ${S} not found: ${_.status}`);
        const x = _.data;
        return x.data = new Uint8Array(0), {
          txPosted: true,
          chunkIndex: 0,
          lastResponseError: "",
          lastRequestTimeEnd: 0,
          lastResponseStatus: 0,
          transaction: x
        };
      }
      toJSON() {
        return {
          chunkIndex: this.chunkIndex,
          transaction: this.transaction,
          lastRequestTimeEnd: this.lastRequestTimeEnd,
          lastResponseStatus: this.lastResponseStatus,
          lastResponseError: this.lastResponseError,
          txPosted: this.txPosted
        };
      }
      // POST to /tx
      async postTransaction() {
        if (this.totalChunks <= c) {
          this.transaction.data = this.data;
          const _ = await this.api.post("tx", this.transaction).catch((x) => (console.error(x), { status: -1, data: { error: x.message } }));
          if (this.lastRequestTimeEnd = Date.now(), this.lastResponseStatus = _.status, this.transaction.data = new Uint8Array(0), _.status >= 200 && _.status < 300) {
            this.txPosted = true, this.chunkIndex = c;
            return;
          }
          throw this.lastResponseError = (0, m.getError)(_), new Error(`Unable to upload transaction: ${_.status}, ${this.lastResponseError}`);
        }
        const S = await this.api.post("tx", this.transaction);
        if (this.lastRequestTimeEnd = Date.now(), this.lastResponseStatus = S.status, !(S.status >= 200 && S.status < 300))
          throw this.lastResponseError = (0, m.getError)(S), new Error(`Unable to upload transaction: ${S.status}, ${this.lastResponseError}`);
        this.txPosted = true;
      }
    }
    return De.TransactionUploader = a, De;
  }
  var Nt;
  function mn() {
    if (Nt) return qe;
    Nt = 1, Object.defineProperty(qe, "__esModule", { value: true });
    const i = /* @__PURE__ */ Ye(), l = /* @__PURE__ */ ct(), m = /* @__PURE__ */ de(), p = /* @__PURE__ */ yn();
    class c {
      constructor(u, a, y) {
        $(this, "api");
        $(this, "crypto");
        $(this, "chunks");
        this.api = u, this.crypto = a, this.chunks = y;
      }
      async getTransactionAnchor() {
        const u = await this.api.get("tx_anchor");
        if (!u.data.match(/^[a-z0-9_-]{43,}/i) || !u.ok)
          throw new Error(`Could not getTransactionAnchor. Received: ${u.data}. Status: ${u.status}, ${u.statusText}`);
        return u.data;
      }
      async getPrice(u, a) {
        let y = a ? `price/${u}/${a}` : `price/${u}`;
        const v = await this.api.get(y);
        if (!/^\d+$/.test(v.data) || !v.ok)
          throw new Error(`Could not getPrice. Received: ${v.data}. Status: ${v.status}, ${v.statusText}`);
        return v.data;
      }
      async get(u) {
        const a = await this.api.get(`tx/${u}`);
        if (a.status == 200) {
          const y = parseInt(a.data.data_size);
          if (a.data.format >= 2 && y > 0 && y <= 1024 * 1024 * 12) {
            const v = await this.getData(u);
            return new l.default({
              ...a.data,
              data: v
            });
          }
          return new l.default({
            ...a.data,
            format: a.data.format || 1
          });
        }
        throw a.status == 404 ? new i.default(
          "TX_NOT_FOUND"
          /* ArweaveErrorType.TX_NOT_FOUND */
        ) : a.status == 410 ? new i.default(
          "TX_FAILED"
          /* ArweaveErrorType.TX_FAILED */
        ) : new i.default(
          "TX_INVALID"
          /* ArweaveErrorType.TX_INVALID */
        );
      }
      fromRaw(u) {
        return new l.default(u);
      }
      /** @deprecated use GQL https://gql-guide.arweave.net */
      async search(u, a) {
        return this.api.post("arql", {
          op: "equals",
          expr1: u,
          expr2: a
        }).then((y) => y.data ? y.data : []);
      }
      getStatus(u) {
        return this.api.get(`tx/${u}/status`).then((a) => a.status == 200 ? {
          status: 200,
          confirmed: a.data
        } : {
          status: a.status,
          confirmed: null
        });
      }
      async getData(u, a) {
        let y;
        try {
          y = await this.chunks.downloadChunkedData(u);
        } catch (v) {
          console.error(`Error while trying to download chunked data for ${u}`), console.error(v);
        }
        if (!y) {
          console.warn(`Falling back to gateway cache for ${u}`);
          try {
            const { data: v, ok: S, status: _, statusText: x } = await this.api.get(`/${u}`, { responseType: "arraybuffer" });
            if (!S)
              throw new Error("Bad http status code", {
                cause: { status: _, statusText: x }
              });
            y = v;
          } catch (v) {
            console.error(`Error while trying to download contiguous data from gateway cache for ${u}`), console.error(v);
          }
        }
        if (!y)
          throw new Error(`${u} data was not found!`);
        return a && a.decode && !a.string ? y : a && a.decode && a.string ? m.bufferToString(y) : m.bufferTob64Url(y);
      }
      async sign(u, a, y) {
        const S = typeof a == "object" && ((x) => {
          let N = true;
          return ["n", "e", "d", "p", "q", "dp", "dq", "qi"].map((I) => !(I in x) && (N = false)), N;
        })(a), _ = typeof arweaveWallet == "object";
        if (!S && !_)
          throw new Error("No valid JWK or external wallet found to sign transaction.");
        if (S) {
          u.setOwner(a.n);
          let x = await u.getSignatureData(), N = await this.crypto.sign(a, x, y), I = await this.crypto.hash(N);
          u.setSignature({
            id: m.bufferTob64Url(I),
            owner: a.n,
            signature: m.bufferTob64Url(N)
          });
        } else if (_) {
          try {
            (await arweaveWallet.getPermissions()).includes("SIGN_TRANSACTION") || await arweaveWallet.connect(["SIGN_TRANSACTION"]);
          } catch {
          }
          const x = await arweaveWallet.sign(u, y);
          u.setSignature({
            id: x.id,
            owner: x.owner,
            reward: x.reward,
            tags: x.tags,
            signature: x.signature
          });
        } else
          throw new Error("An error occurred while signing. Check wallet is valid");
      }
      async verify(u) {
        const a = await u.getSignatureData(), y = u.get("signature", {
          decode: true,
          string: false
        }), v = m.bufferTob64Url(await this.crypto.hash(y));
        if (u.id !== v)
          throw new Error("Invalid transaction signature or ID! The transaction ID doesn't match the expected SHA-256 hash of the signature.");
        return this.crypto.verify(u.owner, a, y);
      }
      async post(u) {
        if (typeof u == "string" ? u = new l.default(JSON.parse(u)) : typeof u.readInt32BE == "function" ? u = new l.default(JSON.parse(u.toString())) : typeof u == "object" && !(u instanceof l.default) && (u = new l.default(u)), !(u instanceof l.default))
          throw new Error("Must be Transaction object");
        u.chunks || await u.prepareChunks(u.data);
        const a = await this.getUploader(u, u.data);
        try {
          for (; !a.isComplete;)
            await a.uploadChunk();
        } catch (y) {
          if (a.lastResponseStatus > 0)
            return {
              status: a.lastResponseStatus,
              statusText: a.lastResponseError,
              data: {
                error: a.lastResponseError
              }
            };
          throw y;
        }
        return {
          status: 200,
          statusText: "OK",
          data: {}
        };
      }
      /**
       * Gets an uploader than can be used to upload a transaction chunk by chunk, giving progress
       * and the ability to resume.
       *
       * Usage example:
       *
       * ```
       * const uploader = arweave.transactions.getUploader(transaction);
       * while (!uploader.isComplete) {
       *   await uploader.uploadChunk();
       *   console.log(`${uploader.pctComplete}%`);
       * }
       * ```
       *
       * @param upload a Transaction object, a previously save progress object, or a transaction id.
       * @param data the data of the transaction. Required when resuming an upload.
       */
      async getUploader(u, a) {
        let y;
        if (a instanceof ArrayBuffer && (a = new Uint8Array(a)), u instanceof l.default) {
          if (a || (a = u.data), !(a instanceof Uint8Array))
            throw new Error("Data format is invalid");
          u.chunks || await u.prepareChunks(a), y = new p.TransactionUploader(this.api, u), (!y.data || y.data.length === 0) && (y.data = a);
        } else {
          if (typeof u == "string" && (u = await p.TransactionUploader.fromTransactionId(this.api, u)), !a || !(a instanceof Uint8Array))
            throw new Error("Must provide data when resuming upload");
          y = await p.TransactionUploader.fromSerialized(this.api, u, a);
        }
        return y;
      }
      /**
       * Async generator version of uploader
       *
       * Usage example:
       *
       * ```
       * for await (const uploader of arweave.transactions.upload(tx)) {
       *  console.log(`${uploader.pctComplete}%`);
       * }
       * ```
       *
       * @param upload a Transaction object, a previously save uploader, or a transaction id.
       * @param data the data of the transaction. Required when resuming an upload.
       */
      async *upload(u, a) {
        const y = await this.getUploader(u, a);
        for (; !y.isComplete;)
          await y.uploadChunk(), yield y;
        return y;
      }
    }
    return qe.default = c, qe;
  }
  var We = {};
  var It;
  function En() {
    if (It) return We;
    It = 1, Object.defineProperty(We, "__esModule", { value: true });
    const i = /* @__PURE__ */ de();
    class l {
      constructor(p, c) {
        $(this, "api");
        $(this, "crypto");
        this.api = p, this.crypto = c;
      }
      /**
       * Get the wallet balance for the given address.
       *
       * @param {string} address - The arweave address to get the balance for.
       *
       * @returns {Promise<string>} - Promise which resolves with a winston string balance.
       */
      getBalance(p) {
        return this.api.get(`wallet/${p}/balance`).then((c) => c.data);
      }
      /**
       * Get the last transaction ID for the given wallet address.
       *
       * @param {string} address - The arweave address to get the transaction for.
       *
       * @returns {Promise<string>} - Promise which resolves with a transaction ID.
       */
      getLastTransactionID(p) {
        return this.api.get(`wallet/${p}/last_tx`).then((c) => c.data);
      }
      generate() {
        return this.crypto.generateJWK();
      }
      async jwkToAddress(p) {
        return !p || p === "use_wallet" ? this.getAddress() : this.getAddress(p);
      }
      async getAddress(p) {
        if (!p || p === "use_wallet") {
          try {
            await arweaveWallet.connect(["ACCESS_ADDRESS"]);
          } catch {
          }
          return arweaveWallet.getActiveAddress();
        } else
          return this.ownerToAddress(p.n);
      }
      async ownerToAddress(p) {
        return i.bufferTob64Url(await this.crypto.hash(i.b64UrlToBuffer(p)));
      }
    }
    return We.default = l, We;
  }
  var Se = {};
  var Bt;
  function An() {
    if (Bt) return Se;
    Bt = 1, Object.defineProperty(Se, "__esModule", { value: true }), Se.SiloResource = void 0;
    const i = /* @__PURE__ */ de();
    class l {
      constructor(c, h, u) {
        $(this, "api");
        $(this, "crypto");
        $(this, "transactions");
        this.api = c, this.crypto = h, this.transactions = u;
      }
      async get(c) {
        if (!c)
          throw new Error("No Silo URI specified");
        const h = await this.parseUri(c), u = await this.transactions.search("Silo-Name", h.getAccessKey());
        if (u.length == 0)
          throw new Error(`No data could be found for the Silo URI: ${c}`);
        const a = await this.transactions.get(u[0]);
        if (!a)
          throw new Error(`No data could be found for the Silo URI: ${c}`);
        const y = a.get("data", { decode: true, string: false });
        return this.crypto.decrypt(y, h.getEncryptionKey());
      }
      async readTransactionData(c, h) {
        if (!h)
          throw new Error("No Silo URI specified");
        const u = await this.parseUri(h), a = c.get("data", { decode: true, string: false });
        return this.crypto.decrypt(a, u.getEncryptionKey());
      }
      async parseUri(c) {
        const h = c.match(/^([a-z0-9-_]+)\.([0-9]+)/i);
        if (!h)
          throw new Error("Invalid Silo name, must be a name in the format of [a-z0-9]+.[0-9]+, e.g. 'bubble.7'");
        const u = h[1], a = Math.pow(2, parseInt(h[2])), y = await this.hash(i.stringToBuffer(u), a), v = i.bufferTob64(y.slice(0, 15)), S = await this.hash(y.slice(16, 31), 1);
        return new m(c, v, S);
      }
      async hash(c, h) {
        let u = await this.crypto.hash(c);
        for (let a = 0; a < h - 1; a++)
          u = await this.crypto.hash(u);
        return u;
      }
    }
    Se.default = l;
    class m {
      constructor(c, h, u) {
        $(this, "uri");
        $(this, "accessKey");
        $(this, "encryptionKey");
        this.uri = c, this.accessKey = h, this.encryptionKey = u;
      }
      getUri() {
        return this.uri;
      }
      getAccessKey() {
        return this.accessKey;
      }
      getEncryptionKey() {
        return this.encryptionKey;
      }
    }
    return Se.SiloResource = m, Se;
  }
  var Ke = {};
  var xt;
  function vn() {
    if (xt) return Ke;
    xt = 1, Object.defineProperty(Ke, "__esModule", { value: true });
    const i = /* @__PURE__ */ Ye(), l = /* @__PURE__ */ de();
    class m {
      constructor(c) {
        $(this, "api");
        this.api = c;
      }
      async getTransactionOffset(c) {
        const h = await this.api.get(`tx/${c}/offset`);
        if (h.status === 200)
          return h.data;
        throw new Error(`Unable to get transaction offset: ${(0, i.getError)(h)}`);
      }
      async getChunk(c) {
        const h = await this.api.get(`chunk/${c}`);
        if (h.status === 200)
          return h.data;
        throw new Error(`Unable to get chunk: ${(0, i.getError)(h)}`);
      }
      async getChunkData(c) {
        const h = await this.getChunk(c);
        return l.b64UrlToBuffer(h.chunk);
      }
      firstChunkOffset(c) {
        return parseInt(c.offset) - parseInt(c.size) + 1;
      }
      async downloadChunkedData(c) {
        const h = await this.getTransactionOffset(c), u = parseInt(h.size), y = parseInt(h.offset) - u + 1, v = new Uint8Array(u);
        let S = 0;
        for (; S < u;) {
          this.api.config.logging && console.log(`[chunk] ${S}/${u}`);
          let _;
          try {
            _ = await this.getChunkData(y + S);
          } catch {
            console.error(`[chunk] Failed to fetch chunk at offset ${y + S}`), console.error("[chunk] This could indicate that the chunk wasn't uploaded or hasn't yet seeded properly to a particular gateway/node");
          }
          if (_)
            v.set(_, S), S += _.length;
          else
            throw new Error(`Couldn't complete data download at ${S}/${u}`);
        }
        return v;
      }
    }
    return Ke.default = m, Ke;
  }
  var ze = {};
  var kt;
  function Tn() {
    if (kt) return ze;
    kt = 1, Object.defineProperty(ze, "__esModule", { value: true });
    const i = /* @__PURE__ */ Ye(), m = class m2 {
      constructor(c, h) {
        $(this, "api");
        $(this, "network");
        this.api = c, this.network = h;
      }
      /**
       * Gets a block by its "indep_hash"
       */
      async get(c) {
        const h = await this.api.get(`${m2.HASH_ENDPOINT}${c}`);
        if (h.status === 200)
          return h.data;
        throw h.status === 404 ? new i.default(
          "BLOCK_NOT_FOUND"
          /* ArweaveErrorType.BLOCK_NOT_FOUND */
        ) : new Error(`Error while loading block data: ${h}`);
      }
      /**
       * Gets a block by its "height"
       */
      async getByHeight(c) {
        const h = await this.api.get(`${m2.HEIGHT_ENDPOINT}${c}`);
        if (h.status === 200)
          return h.data;
        throw h.status === 404 ? new i.default(
          "BLOCK_NOT_FOUND"
          /* ArweaveErrorType.BLOCK_NOT_FOUND */
        ) : new Error(`Error while loading block data: ${h}`);
      }
      /**
       * Gets current block data (ie. block with indep_hash = Network.getInfo().current)
       */
      async getCurrent() {
        const { current: c } = await this.network.getInfo();
        return await this.get(c);
      }
    };
    $(m, "HASH_ENDPOINT", "block/hash/"), $(m, "HEIGHT_ENDPOINT", "block/height/");
    let l = m;
    return ze.default = l, ze;
  }
  var Ut;
  function Je() {
    if (Ut) return Fe;
    Ut = 1, Object.defineProperty(Fe, "__esModule", { value: true });
    const i = /* @__PURE__ */ ln(), l = /* @__PURE__ */ hn(), m = /* @__PURE__ */ dn(), p = /* @__PURE__ */ pn(), c = /* @__PURE__ */ mn(), h = /* @__PURE__ */ En(), u = /* @__PURE__ */ ct(), a = /* @__PURE__ */ de(), y = /* @__PURE__ */ An(), v = /* @__PURE__ */ vn(), S = /* @__PURE__ */ Tn(), x = class x2 {
      constructor(I) {
        $(this, "api");
        $(this, "wallets");
        $(this, "transactions");
        $(this, "network");
        $(this, "blocks");
        $(this, "ar");
        $(this, "silo");
        $(this, "chunks");
        this.api = new l.default(I), this.wallets = new h.default(this.api, x2.crypto), this.chunks = new v.default(this.api), this.transactions = new c.default(this.api, x2.crypto, this.chunks), this.silo = new y.default(this.api, this.crypto, this.transactions), this.network = new p.default(this.api), this.blocks = new S.default(this.api, this.network), this.ar = new i.default();
      }
      /** @deprecated */
      get crypto() {
        return x2.crypto;
      }
      /** @deprecated */
      get utils() {
        return x2.utils;
      }
      getConfig() {
        return {
          api: this.api.getConfig(),
          crypto: null
        };
      }
      async createTransaction(I, D) {
        const q = {};
        if (Object.assign(q, I), !I.data && !(I.target && I.quantity))
          throw new Error("A new Arweave transaction must have a 'data' value, or 'target' and 'quantity' values.");
        if (I.owner == null && D && D !== "use_wallet" && (q.owner = D.n), I.last_tx == null && (q.last_tx = await this.transactions.getTransactionAnchor()), typeof I.data == "string" && (I.data = a.stringToBuffer(I.data)), I.data instanceof ArrayBuffer && (I.data = new Uint8Array(I.data)), I.data && !(I.data instanceof Uint8Array))
          throw new Error("Expected data to be a string, Uint8Array or ArrayBuffer");
        if (I.reward == null) {
          const L = I.data ? I.data.byteLength : 0;
          q.reward = await this.transactions.getPrice(L, q.target);
        }
        q.data_root = "", q.data_size = I.data ? I.data.byteLength.toString() : "0", q.data = I.data || new Uint8Array(0);
        const z = new u.default(q);
        return await z.getSignatureData(), z;
      }
      async createSiloTransaction(I, D, q) {
        const z = {};
        if (Object.assign(z, I), !I.data)
          throw new Error("Silo transactions must have a 'data' value");
        if (!q)
          throw new Error("No Silo URI specified.");
        if (I.target || I.quantity)
          throw new Error("Silo transactions can only be used for storing data, sending AR to other wallets isn't supported.");
        if (I.owner == null) {
          if (!D || !D.n)
            throw new Error("A new Arweave transaction must either have an 'owner' attribute, or you must provide the jwk parameter.");
          z.owner = D.n;
        }
        I.last_tx == null && (z.last_tx = await this.transactions.getTransactionAnchor());
        const L = await this.silo.parseUri(q);
        if (typeof I.data == "string") {
          const Y = await this.crypto.encrypt(a.stringToBuffer(I.data), L.getEncryptionKey());
          z.reward = await this.transactions.getPrice(Y.byteLength), z.data = a.bufferTob64Url(Y);
        }
        if (I.data instanceof Uint8Array) {
          const Y = await this.crypto.encrypt(I.data, L.getEncryptionKey());
          z.reward = await this.transactions.getPrice(Y.byteLength), z.data = a.bufferTob64Url(Y);
        }
        const V = new u.default(z);
        return V.addTag("Silo-Name", L.getAccessKey()), V.addTag("Silo-Version", "0.1.0"), V;
      }
      arql(I) {
        return this.api.post("/arql", I).then((D) => D.data || []);
      }
    };
    $(x, "init"), $(x, "crypto", new m.default()), $(x, "utils", a);
    let _ = x;
    return Fe.default = _, Fe;
  }
  var Rt;
  function Sn() {
    if (Rt) return Oe;
    Rt = 1, Object.defineProperty(Oe, "__esModule", { value: true }), Oe.default = l;
    const i = /* @__PURE__ */ Je();
    async function l(p) {
      if (Array.isArray(p)) {
        const u = i.default.utils.concatBuffers([
          i.default.utils.stringToBuffer("list"),
          i.default.utils.stringToBuffer(p.length.toString())
        ]);
        return await m(p, await i.default.crypto.hash(u, "SHA-384"));
      }
      const c = i.default.utils.concatBuffers([
        i.default.utils.stringToBuffer("blob"),
        i.default.utils.stringToBuffer(p.byteLength.toString())
      ]), h = i.default.utils.concatBuffers([
        await i.default.crypto.hash(c, "SHA-384"),
        await i.default.crypto.hash(p, "SHA-384")
      ]);
      return await i.default.crypto.hash(h, "SHA-384");
    }
    async function m(p, c) {
      if (p.length < 1)
        return c;
      const h = i.default.utils.concatBuffers([
        c,
        await l(p[0])
      ]), u = await i.default.crypto.hash(h, "SHA-384");
      return await m(p.slice(1), u);
    }
    return Oe;
  }
  var Dt;
  function ct() {
    if (Dt) return Te;
    Dt = 1, Object.defineProperty(Te, "__esModule", { value: true }), Te.Tag = void 0;
    const i = /* @__PURE__ */ de(), l = /* @__PURE__ */ Sn(), m = /* @__PURE__ */ jt();
    class p {
      get(a, y) {
        if (!Object.getOwnPropertyNames(this).includes(a))
          throw new Error(`Field "${a}" is not a property of the Arweave Transaction class.`);
        if (this[a] instanceof Uint8Array)
          return y && y.decode && y.string ? i.bufferToString(this[a]) : y && y.decode && !y.string ? this[a] : i.bufferTob64Url(this[a]);
        if (this[a] instanceof Array) {
          if ((y == null ? void 0 : y.decode) !== void 0 || (y == null ? void 0 : y.string) !== void 0)
            throw a === "tags" && console.warn(`Did you mean to use 'transaction["tags"]' ?`), new Error("Cannot decode or stringify an array.");
          return this[a];
        }
        return y && y.decode == true ? y && y.string ? i.b64UrlToString(this[a]) : i.b64UrlToBuffer(this[a]) : this[a];
      }
    }
    class c extends p {
      constructor(y, v, S = false) {
        super();
        $(this, "name");
        $(this, "value");
        this.name = y, this.value = v;
      }
    }
    Te.Tag = c;
    class h extends p {
      constructor(y = {}) {
        super();
        $(this, "format", 2);
        $(this, "id", "");
        $(this, "last_tx", "");
        $(this, "owner", "");
        $(this, "tags", []);
        $(this, "target", "");
        $(this, "quantity", "0");
        $(this, "data_size", "0");
        $(this, "data", new Uint8Array());
        $(this, "data_root", "");
        $(this, "reward", "0");
        $(this, "signature", "");
        $(this, "chunks");
        Object.assign(this, y), typeof this.data == "string" && (this.data = i.b64UrlToBuffer(this.data)), y.tags && (this.tags = y.tags.map((v) => new c(v.name, v.value)));
      }
      addTag(y, v) {
        this.tags.push(new c(i.stringToB64Url(y), i.stringToB64Url(v)));
      }
      toJSON() {
        return {
          format: this.format,
          id: this.id,
          last_tx: this.last_tx,
          owner: this.owner,
          tags: this.tags,
          target: this.target,
          quantity: this.quantity,
          data: i.bufferTob64Url(this.data),
          data_size: this.data_size,
          data_root: this.data_root,
          data_tree: this.data_tree,
          reward: this.reward,
          signature: this.signature
        };
      }
      setOwner(y) {
        this.owner = y;
      }
      setSignature({ id: y, owner: v, reward: S, tags: _, signature: x }) {
        this.id = y, this.owner = v, S && (this.reward = S), _ && (this.tags = _), this.signature = x;
      }
      async prepareChunks(y) {
        !this.chunks && y.byteLength > 0 && (this.chunks = await (0, m.generateTransactionChunks)(y), this.data_root = i.bufferTob64Url(this.chunks.data_root)), !this.chunks && y.byteLength === 0 && (this.chunks = {
          chunks: [],
          data_root: new Uint8Array(),
          proofs: []
        }, this.data_root = "");
      }
      // Returns a chunk in a format suitable for posting to /chunk.
      // Similar to `prepareChunks()` this does not operate `this.data`,
      // instead using the data passed in.
      getChunk(y, v) {
        if (!this.chunks)
          throw new Error("Chunks have not been prepared");
        const S = this.chunks.proofs[y], _ = this.chunks.chunks[y];
        return {
          data_root: this.data_root,
          data_size: this.data_size,
          data_path: i.bufferTob64Url(S.proof),
          offset: S.offset.toString(),
          chunk: i.bufferTob64Url(v.slice(_.minByteRange, _.maxByteRange))
        };
      }
      async getSignatureData() {
        switch (this.format) {
          case 1:
            let y = this.tags.reduce((S, _) => i.concatBuffers([
              S,
              _.get("name", { decode: true, string: false }),
              _.get("value", { decode: true, string: false })
            ]), new Uint8Array());
            return i.concatBuffers([
              this.get("owner", { decode: true, string: false }),
              this.get("target", { decode: true, string: false }),
              this.get("data", { decode: true, string: false }),
              i.stringToBuffer(this.quantity),
              i.stringToBuffer(this.reward),
              this.get("last_tx", { decode: true, string: false }),
              y
            ]);
          case 2:
            this.data_root || await this.prepareChunks(this.data);
            const v = this.tags.map((S) => [
              S.get("name", { decode: true, string: false }),
              S.get("value", { decode: true, string: false })
            ]);
            return await (0, l.default)([
              i.stringToBuffer(this.format.toString()),
              this.get("owner", { decode: true, string: false }),
              this.get("target", { decode: true, string: false }),
              i.stringToBuffer(this.quantity),
              i.stringToBuffer(this.reward),
              this.get("last_tx", { decode: true, string: false }),
              v,
              i.stringToBuffer(this.data_size),
              this.get("data_root", { decode: true, string: false })
            ]);
          default:
            throw new Error(`Unexpected transaction format: ${this.format}`);
        }
      }
    }
    return Te.default = h, Te;
  }
  var nt = 5e5;
  var Xe = "1.25.0";
  var ge = {};
  var Ce = {};
  var Ct;
  function _n() {
    if (Ct) return Ce;
    Ct = 1, Object.defineProperty(Ce, "__esModule", { value: true }), Ce.getDefaultConfig = void 0;
    const i = (p, c) => {
      const h = /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/, u = c.split("."), a = u[u.length - 1], y = ["localhost", "[::1]"];
      return y.includes(c) || p == "file" || y.includes(a) || !!c.match(h) || !!a.match(h);
    }, l = (p) => {
      const c = p.charAt(0) === "[", h = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/;
      return !!p.match(h) || c;
    }, m = (p, c) => {
      if (i(p, c))
        return {
          protocol: "https",
          host: "arweave.net",
          port: 443
        };
      if (!l(c)) {
        let h = c.split(".");
        if (h.length >= 3) {
          h.shift();
          const u = h.join(".");
          return {
            protocol: p,
            host: u
          };
        }
      }
      return {
        protocol: p,
        host: c
      };
    };
    return Ce.getDefaultConfig = m, Ce;
  }
  var bt;
  function Nn() {
    return bt || (bt = 1, function (i) {
      var l = ge && ge.__createBinding || (Object.create ? function (h, u, a, y) {
        y === void 0 && (y = a);
        var v = Object.getOwnPropertyDescriptor(u, a);
        (!v || ("get" in v ? !u.__esModule : v.writable || v.configurable)) && (v = {
          enumerable: true, get: function () {
            return u[a];
          }
        }), Object.defineProperty(h, y, v);
      } : function (h, u, a, y) {
        y === void 0 && (y = a), h[y] = u[a];
      }), m = ge && ge.__exportStar || function (h, u) {
        for (var a in h) a !== "default" && !Object.prototype.hasOwnProperty.call(u, a) && l(u, h, a);
      };
      Object.defineProperty(i, "__esModule", { value: true });
      const p = /* @__PURE__ */ Je(), c = /* @__PURE__ */ _n();
      p.default.init = function (h = {}) {
        const u = {
          host: "arweave.net",
          port: 443,
          protocol: "https"
        };
        if (typeof location != "object" || !location.protocol || !location.hostname)
          return new p.default({
            ...h,
            ...u
          });
        const a = location.protocol.replace(":", ""), y = location.hostname, v = location.port ? parseInt(location.port) : a == "https" ? 443 : 80, S = (0, c.getDefaultConfig)(a, y), _ = h.protocol || S.protocol, x = h.host || S.host, N = h.port || S.port || v;
        return new p.default({
          ...h,
          host: x,
          protocol: _,
          port: N
        });
      }, typeof globalThis == "object" ? globalThis.Arweave = p.default : typeof self == "object" && (self.Arweave = p.default), m(/* @__PURE__ */ Je(), i), i.default = p.default;
    }(ge)), ge;
  }
  var In = /* @__PURE__ */ Nn();
  var ut = /* @__PURE__ */ cn(In);
  var Bn = new ut(xr);
  function Vt(i) {
    const l = Be(), m = i.tags.map((h, u) => ({
      collectionID: l,
      type: "tag",
      index: u,
      value: h
    })), p = [];
    if (typeof i.data == "string")
      try {
        i.data = Bn.utils.b64UrlToBuffer(i.data);
      } catch {
      }
    for (let h = 0; h < Math.ceil(i.data.length / nt); h++) {
      const u = h * nt, a = i.data.slice(u, u + nt);
      p.push({
        collectionID: l,
        type: "data",
        // the index has to be added to the already
        // existing indexes of the tag chunks
        index: h + m.length,
        value: Array.from(a)
      });
    }
    return {
      transaction: {
        ...i,
        data: void 0,
        tags: void 0
      },
      tagChunks: m,
      dataChunks: p,
      chunkCollectionID: l
    };
  }
  var xn = async (i, l) => {
    const {
      transaction: m,
      // transaction without data and tags
      dataChunks: p,
      tagChunks: c,
      chunkCollectionID: h
    } = Vt(i);
    try {
      await Ne({
        collectionID: h,
        type: "start",
        index: -1
      });
    } catch (u) {
      throw new Error(`Failed to initiate transaction chunk stream: 
${u}`);
    }
    for (const u of p)
      try {
        await Ne(u);
      } catch (a) {
        throw new Error(`Error while sending a data chunk of collection "${h}": 
${a}`);
      }
    for (const u of c)
      try {
        await Ne(u);
      } catch (a) {
        throw new Error(`Error while sending a tag chunk for tx from chunk collection "${h}": 
${a}`);
      }
    return [m, l, h];
  };
  var kn = (i, l, [m]) => {
    if (!i) throw new Error("No transaction returned");
    const c = new ut({
      host: "arweave.net",
      port: 443,
      protocol: "https"
    }).transactions.fromRaw({
      ...i.transaction,
      // some wander tags are sent back, so we need to concat them
      tags: [...m.tags || [], ...i.transaction.tags || []],
      data: m.data
    });
    if (i.arConfetti)
      for (let h = 0; h < 8; h++)
        setTimeout(() => $t(i.arConfetti), h * 150);
    return c;
  };
  var Un = ["DISPATCH"];
  var Rn = {
    functionName: "dispatch",
    permissions: Un
  };
  var Dn = async (i, l) => {
    const {
      transaction: m,
      // transaction without data and tags
      dataChunks: p,
      tagChunks: c,
      chunkCollectionID: h
    } = Vt(i);
    try {
      await Ne({
        collectionID: h,
        type: "start",
        index: -1
      });
    } catch (u) {
      throw new Error(`Failed to initiate dispatch chunk stream: 
${u}`);
    }
    for (const u of p)
      try {
        await Ne(u);
      } catch (a) {
        throw new Error(`Error while sending a data (dispatch) chunk of collection "${h}": 
${a}`);
      }
    for (const u of c)
      try {
        await Ne(u);
      } catch (a) {
        throw new Error(`Error while sending a tag chunk for tx from chunk collection "${h}": 
${a}`);
      }
    return [m, h, l];
  };
  var Cn = (i) => {
    if (i.arConfetti)
      for (let l = 0; l < 8; l++)
        setTimeout(() => $t(i.arConfetti), l * 150);
    return i.res;
  };
  var bn = ["ENCRYPT"];
  var On = {
    functionName: "encrypt",
    permissions: bn
  };
  var Fn = (i, l) => (l.algorithm && console.warn(
    `[Wander] YOU'RE USING DEPRECATED PARAMS FOR "encrypt()". Please check the documentation.
https://github.com/wanderwallet/Wander#encryptdata-options-promiseuint8array`
  ), [typeof i == "string" ? i : new Uint8Array(i), l]);
  var Mn = (i) => new Uint8Array(Object.values(i));
  var $n = ["DECRYPT"];
  var Ln = {
    functionName: "decrypt",
    permissions: $n
  };
  var Pn = (i, l) => (l.algorithm && console.warn(
    `[Wander] YOU'RE USING DEPRECATED PARAMS FOR "decrypt()". Please check the documentation.
https://github.com/wanderwallet/Wander#decryptdata-options-promisestring`
  ), [new Uint8Array(i), l]);
  var qn = (i) => new Uint8Array(Object.values(i));
  var Hn = ["SIGNATURE"];
  var Wn = {
    functionName: "signature",
    permissions: Hn
  };
  var Kn = (i, l) => (console.warn(
    `Warning: The signature API is deprecated and it will be removed.
Visit https://docs.wander.app/api/signature for alternatives.`
  ), [Object.values(i), l]);
  var zn = (i) => new Uint8Array(i);
  var jn = ["SIGNATURE"];
  var Vn = {
    functionName: "signMessage",
    permissions: jn
  };
  var it = {};
  var Ot;
  function Gn() {
    return Ot || (Ot = 1, function (i) {
      Object.defineProperty(i, "__esModule", { value: true }), i.check = i.isPromise = i.isInstanceOf = i.isOneOfType = i.isOneOf = i.isOptionOfType = i.isArrayOfType = i.isRecordOfType = i.isArray = i.isRecordWithKeys = i.isRecord = i.isDate = i.isString = i.isNumber = i.isBoolean = i.isExactly = i.isNotVoid = i.isNotUndefined = i.isNotNull = i.isNever = i.isUnknown = i.safeJsonParse = i.setBaseAssert = i.assert = i.defaultAssert = void 0;
      const l = (R) => `expected to be ${R}`, m = (R, F) => {
        if (!R)
          throw new TypeError(F);
      };
      i.defaultAssert = m;
      let p = i.defaultAssert;
      const c = (R, F) => p(R, F);
      i.assert = c;
      function h(R) {
        R && (p = R);
      }
      i.setBaseAssert = h;
      const u = (R) => JSON.parse(R);
      i.safeJsonParse = u;
      function a(R) {
        return true;
      }
      i.isUnknown = a;
      function y(R, F = l("unreachable")) {
        throw new TypeError(F);
      }
      i.isNever = y;
      function v(R, F = l("not null")) {
        (0, i.assert)(R !== null, F);
      }
      i.isNotNull = v;
      function S(R, F = l("not undefined")) {
        (0, i.assert)(R !== void 0, F);
      }
      i.isNotUndefined = S;
      function _(R, F = l("neither null nor undefined")) {
        (0, i.assert)(R != null, F);
      }
      i.isNotVoid = _;
      function x(R, F, j = l(`exactly ${F}`)) {
        (0, i.assert)(R === F, j);
      }
      i.isExactly = x;
      function N(R, F = l("a boolean")) {
        (0, i.assert)(typeof R == "boolean", F);
      }
      i.isBoolean = N;
      function I(R, F = l("a number")) {
        (0, i.assert)(typeof R == "number", F);
      }
      i.isNumber = I;
      function D(R, F = l("a string")) {
        (0, i.assert)(typeof R == "string", F);
      }
      i.isString = D;
      function q(R, F = l("a Date")) {
        (0, i.assert)(R instanceof Date, F);
      }
      i.isDate = q;
      function z(R, F = l("a record")) {
        (0, i.assert)(typeof R == "object", F), v(R, F);
        for (const j of Object.keys(R))
          D(j, F);
      }
      i.isRecord = z;
      function L(R, F, j = l(`a record with keys ${F.join(", ")}`)) {
        z(R, j);
        for (const Z of F)
          S(R[Z]);
      }
      i.isRecordWithKeys = L;
      function V(R, F = l("an array")) {
        (0, i.assert)(Array.isArray(R), F);
      }
      i.isArray = V;
      function Y(R, F, j = l("a record of given type"), Z = l("of given type")) {
        z(R, j);
        for (const re of Object.values(R))
          F(re, Z);
      }
      i.isRecordOfType = Y;
      function U(R, F, j = l("an array of given type"), Z = l("of given type")) {
        V(R, j);
        for (const re of R)
          F(re, Z);
      }
      i.isArrayOfType = U;
      function B(R, F, j = l("option of given type")) {
        R !== void 0 && F(R, j);
      }
      i.isOptionOfType = B;
      function k(R, F, j = l(`one of ${F.join(", ")}`)) {
        (0, i.assert)(F.includes(R), j);
      }
      i.isOneOf = k;
      function M(R, F, j = l("one of type"), Z) {
        for (const re of F)
          try {
            re(R, Z);
            return;
          } catch {
          }
        throw new TypeError(j);
      }
      i.isOneOfType = M;
      function W(R, F, j = l("an instance of given constructor")) {
        (0, i.assert)(R instanceof F, j);
      }
      i.isInstanceOf = W;
      function C(R, F = l("a promise")) {
        W(R, Promise, F);
      }
      i.isPromise = C;
      function J(R) {
        return (F) => {
          try {
            return R(F), true;
          } catch {
            return false;
          }
        };
      }
      i.check = J;
    }(it)), it;
  }
  var Ft = /* @__PURE__ */ Gn();
  function Ie(i) {
    Ft.isNotUndefined("Data has to be defined."), Ft.assert(ArrayBuffer.isView(i), "Input is not an ArrayBuffer.");
  }
  var Jn = (i, l) => (Ie(i), [Object.values(i), l]);
  var Xn = (i) => new Uint8Array(i);
  var Yn = ["ACCESS_ADDRESS"];
  var Zn = {
    functionName: "subscription",
    permissions: Yn
  };
  var Qn = (i) => {
    const l = [
      "arweaveAccountAddress",
      "applicationName",
      "subscriptionName",
      "subscriptionFeeAmount",
      "recurringPaymentFrequency",
      "subscriptionManagementUrl",
      "subscriptionEndDate"
    ];
    for (const p of l)
      if (i[p] === void 0)
        throw new Error(`Missing required field: ${p}`);
    const m = [...l, "applicationIcon"];
    return Object.keys(i).forEach((p) => {
      if (!m.includes(p))
        throw new Error(`Unexpected extra field: ${p}`);
    }), [
        {
          ...i,
          applicationIcon: i.applicationIcon
        }
      ];
  };
  var ei = ["SIGNATURE"];
  var ti = {
    functionName: "privateHash",
    permissions: ei
  };
  var ri = (i, l) => (Ie(i), [Object.values(i), l]);
  var ni = (i) => new Uint8Array(i);
  var ii = ["SIGNATURE"];
  var ai = {
    functionName: "verifyMessage",
    permissions: ii
  };
  var si = (i, l, m, p) => (Ie(i), typeof l == "string" && (l = ut.utils.b64UrlToBuffer(l)), Ie(l), [Object.values(i), Object.values(l), m, p]);
  var oi = ["SIGN_TRANSACTION"];
  var ci = {
    functionName: "batchSignDataItem",
    permissions: oi
  };
  var ui = 200 * 1024;
  var fi = async (i, l) => {
    if (!Array.isArray(i))
      throw new Error("Input must be an array of data items");
    if (i.reduce((c, h) => {
      const u = typeof h.data == "string" ? new TextEncoder().encode(h.data).length : h.data.length;
      return c + u;
    }, 0) > ui)
      throw new Error("Total size of data items exceeds 200 KB");
    return [i.map((c) => {
      let h;
      return typeof c.data != "string" ? (Ie(c.data), h = {
        ...c,
        data: Array.from(c.data)
      }) : h = {
        ...c,
        data: Array.from(new TextEncoder().encode(c.data))
      }, h;
    }), l];
  };
  var li = (i) => i.map((l) => new Uint8Array(l).buffer);
  var hi = ["SIGN_TRANSACTION"];
  var di = {
    functionName: "signDataItem",
    permissions: hi
  };
  var pi = async (i, l) => {
    let m;
    return typeof i.data != "string" ? (Ie(i.data), m = {
      ...i,
      data: Array.from(i.data)
    }) : m = {
      ...i,
      data: Array.from(new TextEncoder().encode(i.data))
    }, [m, l];
  };
  var wi = (i) => new Uint8Array(i).buffer;
  var gi = ["ACCESS_TOKENS"];
  var yi = {
    functionName: "userTokens",
    permissions: gi
  };
  var mi = () => {
  };
  var Ei = ["ACCESS_TOKENS"];
  var Ai = {
    functionName: "tokenBalance",
    permissions: Ei
  };
  var vi = (i) => [i];
  var Ti = ["ACCESS_ADDRESS"];
  var Si = {
    functionName: "getWanderTierInfo",
    permissions: Ti
  };
  var _i = () => {
  };
  var Gt = [
    { ...Zt, function: Qt },
    { ...tr, function: rr },
    { ...ir, function: ar },
    { ...or, function: cr },
    { ...fr, function: lr },
    { ...dr, function: pr },
    { ...gr, function: yr, finalizer: mr },
    { ...Ir, function: Lr },
    { ...qr, function: xn, finalizer: kn },
    { ...Rn, function: Dn, finalizer: Cn },
    { ...On, function: Fn, finalizer: Mn },
    { ...Ln, function: Pn, finalizer: qn },
    { ...Wn, function: Kn, finalizer: zn },
    { ...Ar, function: vr },
    { ...Sr, function: _r },
    {
      ...Vn,
      function: Jn,
      finalizer: Xn
    },
    {
      ...ti,
      function: ri,
      finalizer: ni
    },
    { ...ai, function: si },
    {
      ...di,
      function: pi,
      finalizer: wi
    },
    { ...Zn, function: Qn },
    { ...yi, function: mi },
    { ...Ai, function: vi },
    {
      ...ci,
      function: fi,
      finalizer: li
    },
    { ...Si, function: _i }
  ];
  function Jt(i) {
    return {
      all: i = i || /* @__PURE__ */ new Map(), on: function (l, m) {
        var p = i.get(l);
        p ? p.push(m) : i.set(l, [m]);
      }, off: function (l, m) {
        var p = i.get(l);
        p && (m ? p.splice(p.indexOf(m) >>> 0, 1) : i.set(l, []));
      }, emit: function (l, m) {
        var p = i.get(l);
        p && p.slice().map(function (c) {
          c(m);
        }), (p = i.get("*")) && p.slice().map(function (c) {
          c(l, m);
        });
      }
    };
  }
  function Bi(i = window) {
    if (_e(ye.SETUP, "injectWanderConnectWalletAPI()"), !(i instanceof HTMLIFrameElement))
      throw new Error("Target for Wander Embedded must be an IFRAME element.");
    nn(i);
    const l = Jt(), m = {
      walletName: "Wander Connect",
      walletVersion: Xe,
      events: l
    };
    for (const c of Gt)
      m[c.functionName] = (...h) => p(c, h);
    async function p(c, h) {
      return new Promise(async (u, a) => {
        const y = typeof c == "string" ? c : c.functionName, v = typeof c == "string" ? h : await c.function(...h), S = Be(), _ = {
          app: "wanderEmbedded",
          version: Xe,
          callID: S,
          type: `api_${y}`,
          data: {
            params: v
          }
        };
        _e(ye.API, `${_.type} (${_.callID})...`);
        const x = await Kt({
          destination: "background",
          messageId: _.type === "chunk" ? "chunk" : "api_call",
          data: _
        });
        if (_e(ye.API, `${_.type} (${_.callID}) =`, x), st(x))
          return a(x.data);
        const N = typeof c == "string" ? null : c.finalizer;
        if (N)
          try {
            const I = await N(x.data, v, h);
            I && (x.data = I);
          } catch (I) {
            a(I);
            return;
          }
        u(x.data);
      });
    }
    window.arweaveWallet = m;
  }

  // src/components/button/button.template.ts
  var getButtonTemplateContent = ({
    wanderLogo,
    i18n,
    showLabel,
    showBalance,
    customStyles,
    cssVariableKeys = []
  }) => `
<style>

  @media (prefers-color-scheme: light) {
    :host {
      ${cssVariableKeys.map((cssVariableKey) => {
    return `--${cssVariableKey}: var(--${cssVariableKey}Light);`;
  }).join("\n")}
    }
  }

  @media (prefers-color-scheme: dark) {
    :host {
      ${cssVariableKeys.map((cssVariableKey) => {
    return `--${cssVariableKey}: var(--${cssVariableKey}Dark);`;
  }).join("\n")}
    }
  }

  .button {
    position: absolute;
    bottom: 10px;
    right: 30px;
    display: flex;
    align-items: center;
    gap: var(--gapInside);
    outline: none;
    user-select: none;
    cursor: pointer;
    min-width: var(--minWidth);
    min-height: var(--minHeight);
    z-index: 0;
    padding: var(--padding);
    font: var(--font);
    color: var(--color);
    background: transparent;
    border: none;
    border-radius: var(--borderRadius);
  }

  .button::before {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--background);
    border: var(--borderWidth) solid var(--borderColor);
    border-radius: var(--borderRadius);
    box-shadow: var(--boxShadow);
    z-index: -1;
    transition: transform linear 50ms;
  }

  .button::after {
    content: "";
    position: absolute;
    right: calc(4px + var(--borderWidth));
    bottom: calc(4px + var(--borderWidth));
    border-radius: 32px;
    height: 22px;
    width: 22px;
    transform: translate(50%, 50%) scale(1);
  }

  .button:hover .wanderLogo {
    animation: sail 3s infinite;
  }

  .button:active::before {
    transform: scale(0.95);
  }

  .wanderLogo {
    width: 32px;
    aspect-ratio: 1;
    transition: transform linear 50ms;
  }

  .label {
  }

  .label[hidden],
  .label:empty:not(.isLoading) {
    display: none;
  }

  .label.isLoading {
    background: currentColor;
    width: 64px;
    height: 12px;
    border-radius: 6px;
    animation: blink-opacity 3s infinite;
  }

  .balance {
    filter: blur(0px);
    transition: filter linear 300ms;
    display: none;
  }

  .label:empty:not(.isLoading) + .balance:not([hidden]) {
    display: block;
  }

  .balance:empty {
    background: currentColor;
    width: 64px;
    height: 12px;
    border-radius: 6px;
    animation: blink-opacity 3s infinite;
  }

  .balance.isHidden {
    filter: blur(6px);
  }

  .indicator,
  .notifications {
    position: absolute;
    right: calc(4px + var(--borderWidth));
    bottom: calc(4px + var(--borderWidth));
    border-radius: 32px;
    transition: transform linear 150ms, background linear 150ms;
    pointer-events: none;
  }

  .indicator {
    width: 8px;
    height: 8px;
    z-index: 8;
    background: #CCC;
    transform: translate(50%, 50%);
  }

  .indicator.isLoading {
    animation: blink-indicator 3s infinite;
  }

  .notifications {
    background: red;
    color: white;
    font-size: 12px;
    font-weight: bold;
    min-height: 22px;
    min-width: 22px;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    transform: translate(50%, 50%) scale(1);
  }

  .isConnected + .indicator {
    /* TODO: Add CSS var */
    background: #56C980;
  }

  .notifications:empty {
    transform: translate(50%, 50%) scale(0);
  }

  @keyframes sail {
    0% {
      transform: rotate(-10deg) translate(0, 1px);
    }
    50% {
      transform: rotate(10deg) translate(0, -1px);
    }
    100% {
      transform: rotate(-10deg) translate(0, 1px);
    }
  }

  @keyframes blink-opacity {
    0%, 100% {
      opacity: 0.5;
    }
    50% {
      opacity: 0.25;
    }
  }

  @keyframes blink-indicator {
    0%, 100% {
      background: #CCC;
    }
    50% {
      background: #56C980;
    }
  }

  ${customStyles}
</style>

<button class="button">

  <svg
    class="wanderLogo"
    ${wanderLogo === "none" ? "hidden" : ""}
    viewBox="0 0 257 121"
    fill="none"
    xmlns="http://www.w3.org/2000/svg">

    <path d="M177.235 60.5134L131.532 2.56198C129.607 0.0634354 127.719 -0.344614 125.651 2.33897L79.8771 60.4191L124.181 100.462L128.483 8.72145L132.785 100.462L177.235 60.5134Z"
      fill="${wanderLogo === "text-color" ? "currentColor" : "url(#gradient1)"}"
      fill-rule="evenodd"
      clip-rule="evenodd" />
    <path d="M209.689 120.406L256.138 21.2852C257.135 19.114 254.755 16.9443 252.685 18.1364L183.231 58.0562L138.086 108.914L209.689 120.406Z"
      fill="${wanderLogo === "text-color" ? "currentColor" : "url(#gradient2)"}" />
    <path d="M47.211 120.406L0.762138 21.2853C-0.234245 19.1141 2.14523 16.9445 4.21552 18.1365L73.6694 58.0564L118.814 108.914L47.211 120.406Z"
      fill="${wanderLogo === "text-color" ? "currentColor" : "url(#gradient3)"}" />

    <defs>
      <linearGradient
        id="gradient1"
        x1="128.213"
        y1="100.462"
        x2="128.213"
        y2="0.5"
        gradientUnits="userSpaceOnUse">
        <stop stop-color="#6B57F9"/>
        <stop offset="1" stop-color="#9787FF"/>
      </linearGradient>

      <linearGradient
        id="gradient2"
        x1="156.561"
        y1="80.0762"
        x2="218.926"
        y2="115.502"
        gradientUnits="userSpaceOnUse">
        <stop stop-color="#6B57F9"/>
        <stop offset="1" stop-color="#9787FF"/>
      </linearGradient>

      <linearGradient
        id="gradient3"
        x1="100.34"
        y1="80.0764"
        x2="37.9744"
        y2="115.502"
        gradientUnits="userSpaceOnUse">
        <stop stop-color="#6B57F9"/>
        <stop offset="1" stop-color="#9787FF"/>
      </linearGradient>
    </defs>
  </svg>

  <span class="label" ${showLabel ? "" : "hidden"}></span>
  <span class="balance" ${showBalance ? "" : "hidden"} title="${i18n.loadingBalance}"></span>
</button>

<span class="indicator"></span>
<span class="notifications"></span>
`;

  // node_modules/.pnpm/ts-deepmerge@7.0.3/node_modules/ts-deepmerge/esm/index.js
  var isObject = (obj) => {
    if (typeof obj === "object" && obj !== null) {
      if (typeof Object.getPrototypeOf === "function") {
        const prototype = Object.getPrototypeOf(obj);
        return prototype === Object.prototype || prototype === null;
      }
      return Object.prototype.toString.call(obj) === "[object Object]";
    }
    return false;
  };
  var merge = (...objects) => objects.reduce((result, current) => {
    if (current === void 0) {
      return result;
    }
    if (Array.isArray(current)) {
      throw new TypeError("Arguments provided to ts-deepmerge must be objects, not arrays.");
    }
    Object.keys(current).forEach((key) => {
      if (["__proto__", "constructor", "prototype"].includes(key)) {
        return;
      }
      if (Array.isArray(result[key]) && Array.isArray(current[key])) {
        result[key] = merge.options.mergeArrays ? merge.options.uniqueArrayItems ? Array.from(new Set(result[key].concat(current[key]))) : [...result[key], ...current[key]] : current[key];
      } else if (isObject(result[key]) && isObject(current[key])) {
        result[key] = merge(result[key], current[key]);
      } else if (!isObject(result[key]) && isObject(current[key])) {
        result[key] = merge(current[key], void 0);
      } else {
        result[key] = current[key] === void 0 ? merge.options.allowUndefinedOverrides ? current[key] : result[key] : current[key];
      }
    });
    return result;
  }, {});
  var defaultOptions = {
    allowUndefinedOverrides: true,
    mergeArrays: true,
    uniqueArrayItems: true
  };
  merge.options = defaultOptions;
  merge.withOptions = (options, ...objects) => {
    merge.options = Object.assign(Object.assign({}, defaultOptions), options);
    const result = merge(...objects);
    merge.options = defaultOptions;
    return result;
  };

  // src/utils/styles/styles.utils.ts
  function isThemeRecord(cssVars) {
    return !!(cssVars && typeof cssVars === "object" && ("light" in cssVars || "dark" in cssVars));
  }
  function addCSSVariables(element, vars, suffix = "") {
    for (const key in vars) {
      const name = `--${key}${suffix}`;
      const value = vars[key];
      if (typeof value === "string") element.style.setProperty(name, value);
      else if (typeof value === "number") element.style.setProperty(name, `${value}px`);
    }
  }
  function addCSSVariablesForTheme(element, vars, themeOption) {
    if (!vars || Object.keys(vars).length === 0) return;
    if (isThemeRecord(vars)) {
      if (themeOption === "system") {
        addCSSVariables(element, vars.light, "Light");
        addCSSVariables(element, vars.dark, "Dark");
      } else if (themeOption === "dark") {
        addCSSVariables(element, vars.dark, "Light");
        addCSSVariables(element, vars.dark, "Dark");
      } else {
        addCSSVariables(element, vars.light, "Light");
        addCSSVariables(element, vars.light, "Dark");
      }
    } else {
      addCSSVariables(element, vars, "Light");
      addCSSVariables(element, vars, "Dark");
    }
  }
  function mergeCSSVariablesOption(cssVarsOption, themeOption, defaultLightCssVars, defaultDarkCssVars) {
    let cssVarsLight = defaultLightCssVars;
    let cssVarsDark = defaultDarkCssVars;
    if (cssVarsOption && Object.keys(cssVarsOption).length > 0) {
      if (isThemeRecord(cssVarsOption)) {
        cssVarsLight = merge(cssVarsLight, cssVarsOption?.light || {});
        cssVarsDark = merge(defaultDarkCssVars, cssVarsOption?.dark || {});
      } else if (themeOption === "dark") {
        cssVarsDark = merge(defaultDarkCssVars, cssVarsOption || {});
      } else {
        cssVarsLight = merge(cssVarsLight, cssVarsOption || {});
      }
    }
    return {
      light: cssVarsLight,
      dark: cssVarsDark
    };
  }
  var THEMES = ["system", "light", "dark"];

  // src/components/button/button.component.ts
  var _Button = class _Button {
    constructor(options = {}) {
      // State:
      this.variant = null;
      this.status = {};
      const cssVars = mergeCSSVariablesOption(
        options.cssVars,
        options.theme,
        _Button.DEFAULT_LIGHT_CSS_VARS,
        _Button.DEFAULT_DARK_CSS_VARS
      );
      this.config = {
        parent: options.parent || _Button.DEFAULT_CONFIG.parent,
        id: options.id || _Button.DEFAULT_CONFIG.id,
        theme: options.theme || _Button.DEFAULT_CONFIG.theme,
        cssVars,
        customStyles: options.customStyles || _Button.DEFAULT_CONFIG.customStyles,
        position: options.position || (!!options.parent ? "static" : _Button.DEFAULT_CONFIG.position),
        wanderLogo: options.wanderLogo || _Button.DEFAULT_CONFIG.wanderLogo,
        label: options.label ?? _Button.DEFAULT_CONFIG.label,
        balance: options.balance === false ? false : {
          balanceOf: (options.balance === true ? null : options.balance?.balanceOf) ?? _Button.DEFAULT_CONFIG.balance.balanceOf,
          currency: (options.balance === true ? null : options.balance?.currency) ?? _Button.DEFAULT_CONFIG.balance.currency
        },
        notifications: options.notifications || _Button.DEFAULT_CONFIG.notifications,
        i18n: options.i18n || _Button.DEFAULT_CONFIG.i18n
      };
      const elements = _Button.initializeButton(this.config);
      this.parent = this.config.parent;
      this.host = elements.host;
      this.button = elements.button;
      this.wanderLogo = elements.wanderLogo;
      this.label = elements.label;
      this.balance = elements.balance;
      this.indicator = elements.indicator;
      this.notifications = elements.notifications;
    }
    static initializeButton(config) {
      const host = document.createElement("div");
      host.id = config.id;
      const shadow = host.attachShadow({ mode: "open" });
      const template = document.createElement("template");
      template.innerHTML = getButtonTemplateContent({
        wanderLogo: config.wanderLogo,
        i18n: config.i18n,
        showLabel: config.label,
        showBalance: !!config.balance,
        customStyles: config.customStyles,
        // TODO: It would be better to create an interface with the subset of vars that we can override when changing themes:
        cssVariableKeys: Object.keys(_Button.DEFAULT_LIGHT_CSS_VARS)
      });
      addCSSVariablesForTheme(host, config.cssVars, config.theme);
      shadow.appendChild(template.content);
      const button = shadow.querySelector(".button");
      const wanderLogo = shadow.querySelector(".wanderLogo");
      const label = shadow.querySelector(".label");
      const balance = shadow.querySelector(".balance");
      const indicator = shadow.querySelector(".indicator");
      const notifications = shadow.querySelector(".notifications");
      if (!button || !wanderLogo || !label || !balance || !indicator || !notifications)
        throw new Error("Missing elements");
      if (config.position === "static") {
        host.style.position = "relative";
      } else {
        const [y, x] = config.position.split("-");
        host.style.position = "fixed";
        host.style.zIndex = "var(--zIndex)";
        host.style[y] = "var(--gapY)";
        host.style[x] = "var(--gapX)";
      }
      host.style.transition = "opacity linear 150ms";
      host.style.opacity = "0";
      setTimeout(() => {
        host.style.opacity = "1";
      });
      label.textContent = config.i18n.signIn;
      if (config.balance === false) {
        balance.setAttribute("hidden", "true");
      }
      return {
        host,
        button,
        wanderLogo,
        label,
        balance,
        indicator,
        notifications
      };
    }
    getElements() {
      return {
        parent: this.parent,
        host: this.host,
        button: this.button,
        wanderLogo: this.wanderLogo,
        label: this.label,
        balance: this.balance,
        indicator: this.indicator,
        notifications: this.notifications
      };
    }
    setBalance(balanceInfo) {
      if (this.balance.getAttribute("hidden")) return;
      this.balance.textContent = balanceInfo.formattedBalance;
      this.balance.removeAttribute("title");
      if (balanceInfo.amount === null) {
        this.balance.classList.add("isHidden");
      } else {
        this.balance.classList.remove("isHidden");
      }
    }
    setNotifications(notificationCountOrType) {
      const { notifications, i18n } = this.config;
      if (notifications === "off") return;
      if (!notificationCountOrType) {
        this.notifications.textContent = "";
        this.button.removeAttribute("title");
        this.label.textContent = "";
      } else if (typeof notificationCountOrType === "string") {
        this.notifications.textContent = "!";
        this.button.title = i18n[notificationCountOrType];
        this.label.textContent = "";
      } else {
        this.notifications.textContent = notifications === "counter" ? `${notificationCountOrType}` : "!";
        this.button.removeAttribute("title");
        this.label.textContent = i18n.reviewRequests;
      }
    }
    setVariant(variant) {
      this.variant = variant;
      this.button.dataset.variant = variant;
      if (variant === "loading") {
        this.indicator.classList.add("isLoading");
        this.label.classList.add("isLoading");
        this.label.textContent = "";
        this.label.title = this.config.i18n.loading;
      } else {
        this.indicator.classList.remove("isLoading");
        this.label.classList.remove("isLoading");
        if (variant === "onboarding") {
          this.label.textContent = "Wander";
          this.label.title = this.config.i18n.completeSignUp;
        } else if (variant === "authenticated") {
          this.label.textContent = "";
          this.label.removeAttribute("title");
        } else {
          this.label.textContent = this.config.i18n.signIn;
          this.label.removeAttribute("title");
          this.balance.textContent = "";
        }
      }
    }
    setStatus(status) {
      this.status[status] = true;
      this.button.classList.add(status);
    }
    unsetStatus(status) {
      this.status[status] = false;
      this.button.classList.remove(status);
    }
    setTheme(theme) {
      addCSSVariablesForTheme(this.host, this.config.cssVars, theme);
    }
    destroy() {
      this.host?.remove();
    }
  };
  _Button.DEFAULT_LIGHT_CSS_VARS = {
    // Button (button):
    gapX: 16,
    gapY: 16,
    gapInside: 12,
    minWidth: 0,
    minHeight: 0,
    zIndex: "9999",
    padding: "12px 20px 12px 16px",
    font: "16px monospace",
    background: "white",
    color: "black",
    borderWidth: 2,
    borderColor: "white",
    borderRadius: 128,
    boxShadow: "0 0 32px 0px rgba(0, 0, 0, 0.25)",
    // Logo (img / svg):
    logoBackground: "",
    logoBorderWidth: "",
    logoBorderColor: "",
    logoBorderRadius: "",
    // Notifications (span):
    notificationsBackground: "",
    notificationsBorderWidth: "",
    notificationsBorderColor: "",
    notificationsBorderRadius: "",
    notificationsBoxShadow: "",
    notificationsPadding: ""
  };
  _Button.DEFAULT_DARK_CSS_VARS = {
    ..._Button.DEFAULT_LIGHT_CSS_VARS,
    // Button (button, affected by :hover & :focus):
    background: "black",
    color: "white",
    borderColor: "black",
    // Logo (img / svg):
    logoBackground: "",
    logoBorderWidth: "",
    logoBorderColor: "",
    logoBorderRadius: "",
    // Notifications (span):
    notificationsBackground: "",
    notificationsBorderWidth: "",
    notificationsBorderColor: "",
    notificationsBorderRadius: "",
    notificationsBoxShadow: "",
    notificationsPadding: ""
  };
  _Button.DEFAULT_CONFIG = {
    id: "wanderConnectButtonHost",
    theme: "system",
    cssVars: {
      light: _Button.DEFAULT_LIGHT_CSS_VARS,
      dark: _Button.DEFAULT_DARK_CSS_VARS
    },
    customStyles: "",
    parent: typeof document !== "undefined" ? document.body : null,
    position: "bottom-right",
    wanderLogo: "default",
    label: true,
    balance: {
      balanceOf: "total",
      currency: "auto"
    },
    notifications: "counter",
    i18n: {
      loading: "Loading",
      loadingBalance: "Loading balance",
      completeSignUp: "Complete sign up",
      signIn: "Sign in",
      reviewRequests: "Review requests",
      backupNeeded: "Backup needed",
      unexpectedError: "Unexpected error"
    }
  };
  var Button = _Button;

  // src/components/iframe/iframe.template.ts
  var getIframeTemplateContent = ({ customStyles, cssVariableKeys = [] }) => {
    return `
  <style>

    @media (prefers-color-scheme: light) {
      :host {
        ${cssVariableKeys.map((cssVariableKey) => {
      return `--${cssVariableKey}: var(--${cssVariableKey}Light);`;
    }).join("\n")}
      }
    }

    @media (prefers-color-scheme: dark) {
      :host {
        ${cssVariableKeys.map((cssVariableKey) => {
      return `--${cssVariableKey}: var(--${cssVariableKey}Dark);`;
    }).join("\n")}
      }
    }

    /* Base backdrop styles */

    .backdrop {
      position: fixed;
      z-index: calc(var(--zIndex) + 1);
      inset: 0;
      background: var(--backdropBackground);
      backdrop-filter: var(--backdropBackdropFilter);
      padding: var(--backdropPadding);
      transition:
        display linear 150ms allow-discrete,
        background linear 230ms,
        opacity linear 150ms;
      display: none;
      opacity: 0;
    }

    .backdrop.show {
      display: block;
      opacity: 1;

      @starting-style {
        opacity: 0;
      }
    }

    /* Iframe wrapper styles */

    .iframe-wrapper {
      position: fixed;
      z-index: calc(var(--zIndex, 9999) + 3);
      background: var(--background);
      border: var(--borderWidth) solid var(--borderColor);
      border-radius: var(--borderRadius);
      box-shadow: var(--boxShadow);
      width: calc(var(--preferredWidth) + 2 * var(--borderWidth));
      height: min(calc(var(--preferredHeight) + 2 * var(--borderWidth)), 800px);
      min-width: calc(400px + 2 * var(--borderWidth));
      min-height: calc(400px + 2 * var(--borderWidth));
      max-width: calc(100dvw - 2 * var(--backdropPadding));
      max-height: calc(100dvh - 2 * var(--backdropPadding));
      box-sizing: border-box;
      overflow: hidden;
      transition:
        display linear 150ms allow-discrete,
        background linear 230ms,
        border linear 230ms,
        opacity linear 150ms;
      display: none;
      opacity: 0;
    }

    .iframe-wrapper.show {
      display: block;
      opacity: 1;

      @starting-style {
        opacity: 0;
      }
    }

    /* Base iframe styles */
    .iframe {
      position: absolute;
      display: block;
      border: none;
      width: 100%;
      height: 100%;
    }

    /* Half layout image styles */

    .half-image {
      position: fixed;
      width: calc(50vw - 2 * var(--backdropPadding, 0px));
      z-index: calc(var(--zIndex) + 2);
      opacity: 0;
      transition: opacity 300ms ease-in-out;
      pointer-events: none;
      top: 50%;
      transform: translateY(-50%);
      display: none;

    }

    .half-image.show {
      opacity: 1;
    }

    /* Position-specific styles for half-image */

    .half-image[data-position="left"] {
      left: 0;
    }

    .half-image[data-position="right"] {
      right: 0;
    }

    /* Mobile styles */

    @media (max-width: 540px) {
      .backdrop {
        padding: var(--mobilePadding, 0);
      }

      .iframe-wrapper {
        inset: var(--mobilePadding, 0);
        width: calc(100dvw - 2 * var(--mobilePadding, 0));
        height: var(--mobileHeight, 100dvh);
        min-width: calc(100dvw - 2 * var(--mobilePadding, 0));
        min-height: var(--mobileHeight, 100dvh);
        max-width: calc(100dvw - 2 * var(--mobilePadding, 0));
        max-height: var(--mobileHeight, 100dvh);
        border-width: var(--mobileBorderWidth, 0);
        border-color: var(--mobileBorderColor, rgba(0, 0, 0, .125));
        border-radius: var(--mobileBorderRadius, 0);
        box-shadow: var(--mobileBoxShadow, none);
        transform: none;
      }

      .half-image {
        display: none;
      }

      .iframe-wrapper[data-expand-on-mobile="true"] {
        inset: 0;
        width: 100dvw;
        height: 100dvh;
        min-width: 100dvw;
        min-height: 100dvh;
        max-width: 100dvw;
        max-height: 100dvh;
        border: none;
        border-radius: 0;
        box-shadow: none;
      }
    }

    /* Popup specific styles */

    .iframe-wrapper[data-layout="popup"] {
      transition:
        display linear 150ms allow-discrete,
        opacity linear 150ms,
        height ease-in-out 150ms;
    }

    .iframe-wrapper[data-layout="popup"][data-position="top-left"] {
      top: var(--backdropPadding);
      left: var(--backdropPadding);
    }

    .iframe-wrapper[data-layout="popup"][data-position="top-right"] {
      top: var(--backdropPadding);
      right: var(--backdropPadding);
    }

    .iframe-wrapper[data-layout="popup"][data-position="bottom-left"] {
      bottom: var(--backdropPadding);
      left: var(--backdropPadding);
    }

    .iframe-wrapper[data-layout="popup"][data-position="bottom-right"] {
      bottom: var(--backdropPadding);
      right: var(--backdropPadding);
    }

    /* Modal specific styles */

    .iframe-wrapper[data-layout="modal"] {
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      transition:
        display linear 150ms allow-discrete,
        background linear 230ms,
        border linear 230ms,
        opacity linear 150ms,
        height ease-in-out 150ms;
    }

    /* Sidebar specific styles */

    .iframe-wrapper[data-layout="sidebar"] {
      opacity: 1;
      transition:
        display linear 150ms allow-discrete,
        background linear 230ms,
        border linear 230ms,
        transform linear 150ms;
    }

    /* Half specific styles */

    .iframe-wrapper[data-layout="half"] {
      transition:
        display linear 150ms allow-discrete,
        background linear 230ms,
        border linear 230ms,
        opacity linear 150ms;
    }

    /* Right position - Sidebar & Half */

    .iframe-wrapper[data-layout="sidebar"][data-position="right"],
    .iframe-wrapper[data-layout="half"][data-position="right"] {
      top: var(--backdropPadding, 0);
      right: var(--backdropPadding, 0);
      border-width: 0;
    }

    /* Left position - Sidebar & Half */

    .iframe-wrapper[data-layout="sidebar"][data-position="left"],
    .iframe-wrapper[data-layout="half"][data-position="left"] {
      top: var(--backdropPadding, 0);
      left: var(--backdropPadding, 0);
      border-width: 0;
    }

    /* Hide transform states - Sidebar */

    .iframe-wrapper[data-layout="sidebar"][data-position="right"]:not(.show) {
      transform: translate(calc(100% + var(--backdropPadding) + 32px), 0);
    }

    .iframe-wrapper[data-layout="sidebar"][data-position="left"]:not(.show) {
      transform: translate(calc(-100% - var(--backdropPadding) - 32px), 0);
    }

    /* Show transform state - Sidebar */

    .iframe-wrapper[data-layout="sidebar"].show {
      transform: translate(0, 0);
    }

    /* Expanded styles */

    .iframe-wrapper[data-layout="sidebar"][data-expanded="true"],
    .iframe-wrapper[data-layout="half"][data-expanded="true"] {
      top: 0;
      height: var(--preferredHeight);
      max-height: var(--preferredHeight);
      border-radius: 0;
    }

    .iframe-wrapper[data-layout="sidebar"][data-expanded="true"][data-position="right"],
    .iframe-wrapper[data-layout="half"][data-expanded="true"][data-position="right"] {
      right: 0;
      border-width: 0 0 0 var(--borderWidth);
    }

    .iframe-wrapper[data-layout="sidebar"][data-expanded="true"][data-position="left"],
    .iframe-wrapper[data-layout="half"][data-expanded="true"][data-position="left"] {
      left: 0;
      border-width: 0 var(--borderWidth) 0 0;
    }

    ${customStyles}
  </style>
`;
  };

  // src/utils/layout/layout.utils.ts
  var LAYOUT_TYPES = ["modal", "popup", "sidebar", "half"];
  function isRouteConfig(obj) {
    return !!(obj && typeof obj === "object" && "type" in obj && LAYOUT_TYPES.includes(obj.type));
  }

  // src/components/iframe/iframe.component.ts
  var _Iframe = class _Iframe {
    constructor(src, options = {}) {
      // State:
      this.imageBaseUrl = null;
      this.currentLayoutType = null;
      this.isOpen = false;
      this.layoutCssVars = {};
      const cssVars = mergeCSSVariablesOption(
        options.cssVars,
        options.theme,
        _Iframe.DEFAULT_LIGHT_CSS_VARS,
        _Iframe.DEFAULT_DARK_CSS_VARS
      );
      const routeLayoutOption = options.routeLayout;
      let routeLayout = null;
      if (typeof routeLayoutOption === "string" || isRouteConfig(routeLayoutOption)) {
        const defaultLayoutConfig = _Iframe.getLayoutConfig(routeLayoutOption);
        routeLayout = {
          default: defaultLayoutConfig,
          auth: _Iframe.DEFAULT_CONFIG.routeLayout.auth,
          account: _Iframe.DEFAULT_CONFIG.routeLayout.auth,
          settings: defaultLayoutConfig,
          "auth-request": defaultLayoutConfig
        };
      } else {
        const defaultLayoutConfig = routeLayoutOption?.default ? _Iframe.getLayoutConfig(routeLayoutOption?.default) : _Iframe.DEFAULT_CONFIG.routeLayout.default;
        const authLayoutConfig = routeLayoutOption?.auth ? _Iframe.getLayoutConfig(routeLayoutOption?.auth) : _Iframe.DEFAULT_CONFIG.routeLayout.auth;
        routeLayout = {
          default: defaultLayoutConfig,
          auth: authLayoutConfig,
          account: routeLayoutOption?.account ? _Iframe.getLayoutConfig(routeLayoutOption.account) : authLayoutConfig,
          settings: routeLayoutOption?.settings ? _Iframe.getLayoutConfig(routeLayoutOption.settings) : defaultLayoutConfig,
          "auth-request": routeLayoutOption?.["auth-request"] ? _Iframe.getLayoutConfig(routeLayoutOption["auth-request"]) : defaultLayoutConfig
        };
      }
      this.config = {
        id: options.id || _Iframe.DEFAULT_CONFIG.id,
        theme: options.theme || _Iframe.DEFAULT_CONFIG.theme,
        cssVars,
        customStyles: options.customStyles || _Iframe.DEFAULT_CONFIG.customStyles,
        routeLayout,
        clickOutsideBehavior: options.clickOutsideBehavior || _Iframe.DEFAULT_CONFIG.clickOutsideBehavior
      };
      this.imageBaseUrl = new URL(src).origin;
      const elements = _Iframe.initializeIframe(src, this.config);
      this.host = elements.host;
      this.backdrop = elements.backdrop;
      this.wrapper = elements.wrapper;
      this.iframe = elements.iframe;
      this.halfImage = elements.halfImage;
      this.resize({
        routeType: "auth",
        preferredLayoutType: routeLayout.auth.type,
        height: 0
      });
    }
    getRouteImageUrl(imgPath) {
      if (!imgPath || !_Iframe.ALLOWED_IMG_PATHS.has(imgPath)) {
        return null;
      }
      return `${this.imageBaseUrl}/assets/routes/${imgPath}`;
    }
    static getLayoutConfig(layoutConfig) {
      return typeof layoutConfig === "object" ? layoutConfig : {
        type: layoutConfig
      };
    }
    static initializeIframe(src, config) {
      const host = document.createElement("div");
      host.id = config.id;
      const shadow = host.attachShadow({ mode: "open" });
      const template = document.createElement("template");
      template.innerHTML = getIframeTemplateContent({
        customStyles: config.customStyles,
        // TODO: It would be better to create an interface with the subset of vars that we can override when changing themes:
        cssVariableKeys: Object.keys(_Iframe.DEFAULT_LIGHT_CSS_VARS)
      });
      addCSSVariablesForTheme(host, config.cssVars, config.theme);
      shadow.appendChild(template.content);
      const backdrop = document.createElement("div");
      backdrop.className = "backdrop";
      const wrapper = document.createElement("div");
      wrapper.className = "iframe-wrapper";
      const iframe = document.createElement("iframe");
      iframe.className = "iframe";
      iframe.allow = "camera *;";
      iframe.src = src;
      wrapper.appendChild(iframe);
      const halfImage = document.createElement("img");
      halfImage.className = "half-image";
      shadow.appendChild(wrapper);
      shadow.appendChild(backdrop);
      shadow.appendChild(halfImage);
      return {
        iframe,
        host,
        backdrop,
        wrapper,
        halfImage
      };
    }
    getElements() {
      return {
        host: this.host,
        backdrop: this.backdrop,
        wrapper: this.wrapper,
        iframe: this.iframe,
        halfImage: this.halfImage
      };
    }
    show() {
      this.isOpen = true;
      this.backdrop.classList.add("show");
      this.wrapper.classList.add("show");
      this.iframe.contentWindow?.focus();
      if (this.currentLayoutType === "half" && this.halfImage.src) {
        this.halfImage.classList.add("show");
      }
    }
    hide() {
      this.isOpen = false;
      this.backdrop.classList.remove("show");
      this.wrapper.classList.remove("show");
      document.activeElement?.blur();
      this.halfImage.classList.remove("show");
    }
    resize(routeConfig) {
      const { config, wrapper } = this;
      const layoutConfig = config.routeLayout[routeConfig.routeType];
      const layoutType = layoutConfig.type;
      this.currentLayoutType = layoutType;
      if (layoutType !== "half") {
        this.halfImage.style.display = "none";
        this.halfImage.classList.remove("show");
      }
      wrapper.dataset.layout = layoutType;
      wrapper.dataset.position = "";
      wrapper.dataset.expanded = "";
      wrapper.dataset.expandOnMobile = layoutConfig.expandOnMobile !== false ? "true" : "false";
      const layoutCssVars = {};
      switch (layoutConfig.type) {
        case "modal": {
          layoutCssVars.preferredWidth = layoutConfig.fixedWidth || routeConfig.width || "";
          layoutCssVars.preferredHeight = layoutConfig.fixedHeight || routeConfig.height || "";
          break;
        }
        case "popup": {
          wrapper.dataset.position = layoutConfig.position || "bottom-right";
          layoutCssVars.preferredWidth = layoutConfig.fixedWidth || routeConfig.width || "";
          layoutCssVars.preferredHeight = layoutConfig.fixedHeight || routeConfig.height || "";
          break;
        }
        case "sidebar": {
          wrapper.dataset.position = layoutConfig.position || "right";
          wrapper.dataset.expanded = layoutConfig.expanded ? "true" : "false";
          if (layoutConfig.expanded) layoutCssVars.backdropPadding = 0;
          layoutCssVars.preferredWidth = layoutConfig.fixedWidth || routeConfig.width || "";
          layoutCssVars.preferredHeight = "calc(100dvh - 2 * var(--backdropPadding, 0))";
          break;
        }
        case "half": {
          const position = wrapper.dataset.position = layoutConfig.position || "right";
          wrapper.dataset.expanded = layoutConfig.expanded ? "true" : "false";
          if (layoutConfig.expanded) layoutCssVars.backdropPadding = 0;
          layoutCssVars.preferredWidth = "calc(50vw - 2 * var(--backdropPadding, 0))";
          layoutCssVars.preferredHeight = "calc(100dvh - 2 * var(--backdropPadding, 0))";
          this.halfImage.dataset.position = position === "left" ? "right" : "left";
          this.halfImage.dataset.expanded = layoutConfig.expanded ? "true" : "false";
          const imgSrc = this.getRouteImageUrl(`${routeConfig.routeType}.png`);
          if (this.isOpen && imgSrc) {
            this.halfImage.src = imgSrc;
            this.halfImage.style.display = "block";
            this.halfImage.classList.add("show");
          } else {
            this.halfImage.style.display = "none";
            this.halfImage.classList.remove("show");
          }
          break;
        }
      }
      this.host.removeAttribute("style");
      this.layoutCssVars = layoutCssVars;
      this.setTheme(this.config.theme);
    }
    setTheme(theme) {
      addCSSVariablesForTheme(this.host, this.config.cssVars, theme);
      addCSSVariablesForTheme(this.host, this.layoutCssVars);
    }
    destroy() {
      this.host?.remove();
    }
  };
  _Iframe.DEFAULT_LIGHT_CSS_VARS = {
    // Iframe Wrapper (div.iframe-wrapper)
    background: "white",
    borderWidth: 2,
    borderColor: "rgba(0, 0, 0, .125)",
    borderRadius: 10,
    boxShadow: "0 0 16px 0 rgba(0, 0, 0, 0.125)",
    zIndex: "9999",
    preferredWidth: 400,
    preferredHeight: 400,
    // Iframe Content:
    contentPadding: 0,
    contentMaxWidth: 600,
    contentMaxHeight: "100dvh",
    // Backdrop (div):
    backdropBackground: "rgba(255, 255, 255, .0625)",
    backdropBackdropFilter: "blur(12px)",
    backdropPadding: 8,
    // Mobile-specific:
    mobilePadding: 0,
    mobileHeight: 0,
    mobileBorderRadius: 0,
    mobileBorderWidth: 0,
    mobileBorderColor: "transparent",
    mobileBoxShadow: "none"
  };
  _Iframe.DEFAULT_DARK_CSS_VARS = {
    ..._Iframe.DEFAULT_LIGHT_CSS_VARS,
    background: "black"
  };
  _Iframe.DEFAULT_CONFIG = {
    id: "wanderConnectIframeHost",
    theme: "system",
    cssVars: {
      light: _Iframe.DEFAULT_LIGHT_CSS_VARS,
      dark: _Iframe.DEFAULT_DARK_CSS_VARS
    },
    customStyles: "",
    routeLayout: {
      default: _Iframe.getLayoutConfig("popup"),
      auth: _Iframe.getLayoutConfig("modal"),
      account: _Iframe.getLayoutConfig("modal"),
      settings: _Iframe.getLayoutConfig("popup"),
      "auth-request": _Iframe.getLayoutConfig("popup")
    },
    clickOutsideBehavior: true
  };
  _Iframe.IMAGE_EXTENSIONS = ["png", "webp"];
  _Iframe.DEFAULT_ROUTE_TYPES = [
    "default",
    "auth",
    "account",
    "auth-request",
    "settings"
  ];
  _Iframe.ALLOWED_IMG_PATHS = new Set(
    _Iframe.DEFAULT_ROUTE_TYPES.flatMap((route) => _Iframe.IMAGE_EXTENSIONS.map((ext) => `${route}.${ext}`))
  );
  var Iframe = _Iframe;

  // src/utils/auth/auth.constants.ts
  var AUTH_STATUS = [
    "loading",
    "onboarding",
    "authenticated",
    "not-authenticated"
  ];

  // src/utils/message/message.utils.ts
  function isEventMessage(message) {
    if (!message || typeof message !== "object" || !("id" in message && "type" in message && "data" in message) || message.type !== "event") {
      return false;
    }
    const data = message.data;
    return typeof data.name === "string";
  }
  function isWalletSwitchMessage(message) {
    if (!message || typeof message !== "object" || !("id" in message && "type" in message && "data" in message) || message.type !== "switch_wallet_event") {
      return false;
    }
    const data = message.data;
    return data === null || typeof data === "string";
  }
  function isIncomingMessage(message) {
    if (!message || typeof message !== "object" || !("id" in message && "type" in message && "data" in message)) {
      return false;
    }
    switch (message.type) {
      case "embedded_auth": {
        const data = message.data;
        if (!data || typeof data !== "object") return false;
        if (data.authType === "NATIVE_WALLET") {
          return data.authStatus === null && data.userDetails === null;
        }
        if (data.authStatus === "not-authenticated") {
          return data.authType === null && data.userDetails === null;
        }
        return (
          // AUTH_TYPES.includes(data.authType) &&
          !!data.authType && AUTH_STATUS.includes(data.authStatus) && (data.userDetails === null || !!data.userDetails && typeof data.userDetails === "object")
        );
      }
      case "embedded_backup": {
        const data = message.data;
        return !!(data && typeof data === "object" && typeof data.backupsNeeded === "number" && (typeof data.backupMessage === "undefined" || typeof data.backupMessage === "string"));
      }
      case "embedded_open":
      case "embedded_close":
        return true;
      case "embedded_resize": {
        const data = message.data;
        return !!(data && typeof data === "object" && typeof data.routeType === "string" && typeof data.preferredLayoutType === "string" && typeof data.height === "number");
      }
      case "embedded_balance": {
        const data = message.data;
        return !!(data && typeof data === "object" && (data.amount === null || typeof data.amount === "number") && (data.currency === null || typeof data.currency === "string") && typeof data.formattedBalance == "string");
      }
      case "embedded_request": {
        const data = message.data;
        return !!(data && typeof data === "object" && typeof data.pendingRequests === "number");
      }
      default:
        return false;
    }
  }

  // src/utils/url/url.utils.ts
  var PARAM_CLIENT_ID = "client-id";
  var PARAM_THEME = "theme";
  var PARAM_ANCESTOR_ORIGIN = "ancestor-origin";
  var PARAM_HIDE_BE = "hide-be";
  var PARAM_INJECTED_BE = "injected-be";
  var PARAM_SERVER_BASE_URL = "server-base-url";
  var PARAM_SKIP_STORAGE_ACCESS_WARNING = "skip-storage-access-warning";
  function getWanderConnectAppURL({
    baseURL,
    clientId,
    theme,
    hideBE,
    injectedBE,
    baseServerURL,
    skipStorageAccessWarning
  }) {
    const url = new URL(baseURL);
    const { searchParams } = url;
    searchParams.set(PARAM_CLIENT_ID, clientId);
    searchParams.set(PARAM_THEME, theme);
    searchParams.set(PARAM_ANCESTOR_ORIGIN, window.location.origin);
    if (hideBE) searchParams.set(PARAM_HIDE_BE, "1");
    if (injectedBE) searchParams.set(PARAM_INJECTED_BE, "1");
    if (baseServerURL) searchParams.set(PARAM_SERVER_BASE_URL, baseServerURL);
    if (skipStorageAccessWarning) searchParams.set(PARAM_SKIP_STORAGE_ACCESS_WARNING, "1");
    return url.toString();
  }

  // src/utils/deep-clone/deep-clone.utils.ts
  var deepClone = typeof structuredClone === "function" ? structuredClone : function (value) {
    return JSON.parse(JSON.stringify(value));
  };

  // src/wander-connect.ts
  var NOOP = () => {
  };
  var _WanderConnect = class _WanderConnect {
    /**
     * Creates a new instance of the WanderEmbedded SDK
     *
     * Initializes the wallet interface with the provided configuration options.
     * Only one instance of WanderEmbedded can exist at a time.
     *
     * @param options Configuration options for the SDK including:
     *   - clientId: Required identifier for your application
     *   - baseURL: Optional custom URL for the embedded iframe
     *   - baseServerURL: Optional custom URL for the API server
     *   - iframe: Configuration for the iframe (layout, styling, behavior)
     *   - button: Configuration for the button (position, styling, behavior)
     *   - callbacks: onAuth, onOpen, onClose, onResize, onBalance, onRequest
     * @throws Error if an instance already exists or if clientId is not provided
     */
    constructor(options) {
      // Callbacks:
      this.onAuth = NOOP;
      this.onBackup = NOOP;
      this.onOpen = NOOP;
      this.onClose = NOOP;
      this.onResize = NOOP;
      this.onBalance = NOOP;
      this.onRequest = NOOP;
      this.signOutMethodCallback = NOOP;
      // Components:
      this.buttonComponent = null;
      this.iframeComponent = null;
      // State:
      this.iframeRef = null;
      this.openReason = null;
      this.allowOpeningAutomatically = true;
      this.hasIndependentIframeTheme = false;
      this.hasIndependentButtonTheme = false;
      this.setThemeTimeoutID = 0;
      /**
       * Contains the current authentication state of the SDK, and it is initialized with cached data in order to show as
       * soon as possible the non-auth or the loading auth UIs.
       */
      this.authInfo = {
        authType: null,
        authStatus: "not-authenticated",
        userDetails: null
      };
      /**
       * Current route configuration including dimensions and layout preferences.
       */
      this.routeConfig = null;
      /**
       * User's current backup information.
       */
      this.backupInfo = null;
      /**
       * User's current balance information.
       */
      this.balanceInfo = null;
      /**
       * Number of pending requests awaiting user action.
       */
      this.pendingRequests = 0;
      // Injected APIs:
      this.isWalletReady = false;
      this.isBrowserWalletEnabled = false;
      this.windowArweaveWallet = null;
      if (_WanderConnect.instance) {
        throw new Error(
          "WanderEmbedded instance already exists. Make sure you call `instance.destroy()` before instantiating it again."
        );
      }
      _WanderConnect.instance = this;
      this.onAuth = options.onAuth ?? NOOP;
      this.onBackup = options.onBackup ?? NOOP;
      this.onOpen = options.onOpen ?? NOOP;
      this.onClose = options.onClose ?? NOOP;
      this.onResize = options.onResize ?? NOOP;
      this.onBalance = options.onBalance ?? NOOP;
      this.onRequest = options.onRequest ?? NOOP;
      const optionsWithDefaults = merge(
        {
          clientId: "",
          iframe: {
            clickOutsideBehavior: true
          },
          button: true,
          skipStorageAccessWarning: false
        },
        options || {}
      );
      if (optionsWithDefaults.clientId !== "FREE_TRIAL") {
        throw new Error(
          `The clientId option is required and must be set to "FREE_TRIAL". This will change in the future, when you'll be required to register your app(s) to get a valid client ID.`
        );
      }
      try {
        const authInfo = JSON.parse(localStorage.getItem(_WanderConnect.AUTH_STATE_LS_KEY) || "null");
        if (authInfo) {
          this.authInfo = {
            authType: authInfo.authType || null,
            authStatus: "loading",
            userDetails: authInfo.userDetails || null
          };
        }
      } catch (err) {
        console.warn("Error parsing last authentication state:", err);
      }
      try {
        this.isBrowserWalletEnabled = localStorage.getItem(_WanderConnect.BROWSER_WALLET_ENABLED_KEY) === "true";
      } catch (err) {
        console.warn("Error parsing last native wallet enabled:", err);
      }
      this.initializeComponents(optionsWithDefaults);
      if (!this.iframeRef) throw new Error("Error creating iframe");
      this.handleMessage = this.handleMessage.bind(this);
      window.addEventListener("message", this.handleMessage);
      if (window.arweaveWallet && window.arweaveWallet?.walletName !== _WanderConnect.WANDER_CONNECT_WALLET_NAME) {
        this.windowArweaveWallet = window.arweaveWallet;
      }
      this.injectWanderConnectWalletAPI(this.iframeRef);
    }
    injectWanderConnectWalletAPI(iframeRef) {
      if (this.isBrowserWalletEnabled || window.arweaveWallet?.walletName === _WanderConnect.WANDER_CONNECT_WALLET_NAME)
        return;
      this.isWalletReady = false;
      Bi(iframeRef);
    }
    restoreBrowserWalletAPI() {
      if (!this.isBrowserWalletEnabled || window.arweaveWallet?.walletName !== _WanderConnect.WANDER_CONNECT_WALLET_NAME)
        return;
      this.isWalletReady = false;
      window.arweaveWallet = this.windowArweaveWallet;
    }
    async dispatchWalletLoadedEvents() {
      if (this.isBrowserWalletEnabled || this.isWalletReady) return;
      this.isWalletReady = true;
      const permissions = await window.arweaveWallet.getPermissions().catch(() => []);
      dispatchEvent(
        new CustomEvent("arweaveWalletLoaded", {
          detail: {
            permissions
          }
        })
      );
      if (permissions.length > 0) {
        this.buttonComponent?.setStatus("isConnected");
      } else {
        this.buttonComponent?.unsetStatus("isConnected");
      }
      const events = window.arweaveWallet?.events;
      if (events && permissions.length > 0) {
        events.emit("connect", null);
        const [activeAddress, addresses] = await Promise.all([
          window.arweaveWallet.getActiveAddress().catch(() => ""),
          window.arweaveWallet.getAllAddresses().catch(() => [])
        ]);
        events.emit("activeAddress", activeAddress);
        events.emit("addresses", addresses);
      }
    }
    initializeComponents(options) {
      const {
        clientId,
        baseURL = _WanderConnect.DEFAULT_IFRAME_SRC,
        theme = _WanderConnect.DEFAULT_THEME,
        hideBE,
        baseServerURL,
        skipStorageAccessWarning
      } = options;
      const iframeOptions = options.iframe instanceof HTMLElement ? options.iframe : deepClone(options.iframe || {});
      let buttonOptions = null;
      if (options.button === true) {
        buttonOptions = {};
      } else if (options.button) {
        buttonOptions = { ...deepClone({ ...options.button, parent: null }), parent: options.button.parent };
      }
      const srcWithParams = getWanderConnectAppURL({
        baseURL,
        clientId,
        theme,
        hideBE,
        injectedBE: this.isBrowserWalletEnabled,
        baseServerURL,
        skipStorageAccessWarning
      });
      if (iframeOptions instanceof HTMLElement) {
        if (iframeOptions.src && iframeOptions.src !== srcWithParams) {
          console.warn(`Replacing iframe.src ("${iframeOptions.src}") with ${srcWithParams}`);
        }
        iframeOptions.src = srcWithParams;
        this.iframeRef = iframeOptions;
      } else {
        if (iframeOptions.theme) this.hasIndependentIframeTheme = true;
        iframeOptions.theme || (iframeOptions.theme = theme);
        this.iframeComponent = new Iframe(srcWithParams, iframeOptions);
        const elements = this.iframeComponent.getElements();
        this.iframeRef = elements.iframe;
        if (iframeOptions?.clickOutsideBehavior) {
          elements.backdrop.addEventListener("click", () => {
            this.close();
          });
        }
      }
      if (buttonOptions) {
        if (buttonOptions.theme) this.hasIndependentButtonTheme = true;
        buttonOptions.theme || (buttonOptions.theme = theme);
        this.buttonComponent = new Button(buttonOptions);
        this.buttonComponent.setVariant(this.authInfo.authStatus || "not-authenticated");
        const elements = this.buttonComponent.getElements();
        elements.parent.appendChild(elements.host);
        this.handleButtonClick = this.handleButtonClick.bind(this);
        elements.button.addEventListener("click", this.handleButtonClick);
      }
      if (this.iframeComponent) {
        document.body.appendChild(this.iframeComponent.getElements().host);
      }
    }
    async handleMessage(event) {
      const message = event.data;
      if (!this.iframeRef || event.origin !== new URL(this.iframeRef.src).origin) return;
      if (isEventMessage(message) && this.isWalletReady) {
        if (message.data.name === "permissions" && message.data.value.length > 0 || message.data.name === "connect") {
          this.buttonComponent?.setStatus("isConnected");
        } else if (message.data.name === "permissions" && message.data.value.length === 0 || message.data.name === "disconnect") {
          this.buttonComponent?.unsetStatus("isConnected");
        }
        const events = window.arweaveWallet?.events;
        if (events) events.emit(message.data.name, message.data.value);
        return;
      }
      if (isWalletSwitchMessage(message)) {
        dispatchEvent(
          new CustomEvent("walletSwitch", {
            detail: { address: message.data }
          })
        );
        return;
      }
      if (!isIncomingMessage(message)) return;
      switch (message.type) {
        case "embedded_auth":
          const messageData = message.data;
          const { authType, authStatus } = messageData;
          this.authInfo = messageData;
          if (authStatus === "not-authenticated") {
            localStorage.removeItem(_WanderConnect.AUTH_STATE_LS_KEY);
          } else {
            try {
              localStorage.setItem(_WanderConnect.AUTH_STATE_LS_KEY, JSON.stringify(messageData));
            } catch (err) {
              console.warn("Error storing last authentication state:", err);
            }
          }
          if (authType === "NATIVE_WALLET") {
            this.isBrowserWalletEnabled = true;
            localStorage.setItem(_WanderConnect.BROWSER_WALLET_ENABLED_KEY, "true");
            this._close();
            this.restoreBrowserWalletAPI();
          } else {
            if (authType) {
              this.isBrowserWalletEnabled = false;
              localStorage.removeItem(_WanderConnect.BROWSER_WALLET_ENABLED_KEY);
            }
            this.injectWanderConnectWalletAPI(this.iframeRef);
            if (authStatus === "authenticated") {
              this.dispatchWalletLoadedEvents();
            } else if (authStatus === "not-authenticated") {
              this.backupInfo = null;
              this.balanceInfo = null;
              this.pendingRequests = 0;
              this.isWalletReady = false;
              this.buttonComponent?.unsetStatus("isConnected");
              this.updateButtonNotification();
            }
            this.buttonComponent?.setVariant(authStatus);
          }
          if (this.isBrowserWalletEnabled) {
            this.onAuth({
              authType: "NATIVE_WALLET",
              authStatus: null,
              userDetails: null
            });
          } else {
            this.onAuth(messageData);
          }
          if (messageData.authStatus === "not-authenticated") {
            this.signOutMethodCallback();
          }
          break;
        case "embedded_backup":
          const backupInfo = message.data;
          this.backupInfo = backupInfo.backupsNeeded === 0 ? null : backupInfo;
          this.updateButtonNotification();
          this.onBackup(backupInfo);
          break;
        case "embedded_open":
          this._open("embedded_open");
          break;
        case "embedded_close":
          this._close();
          break;
        case "embedded_resize":
          const routeConfig = message.data;
          this.iframeComponent?.resize(routeConfig);
          this.onResize(routeConfig);
          break;
        case "embedded_balance":
          const balanceInfo = message.data;
          this.balanceInfo = balanceInfo;
          this.buttonComponent?.setBalance(balanceInfo);
          this.onBalance(balanceInfo);
          break;
        case "embedded_request":
          const { pendingRequests, hasNewConnectRequest } = message.data;
          this.pendingRequests = pendingRequests;
          if (pendingRequests > 0 && (this.shouldOpenAutomatically || hasNewConnectRequest)) {
            this._open("embedded_request");
          } else if (pendingRequests === 0 && this.shouldCloseAutomatically) {
            this._close(true);
          }
          this.updateButtonNotification();
          this.onRequest(message.data);
          break;
      }
    }
    handleButtonClick() {
      if (this.isOpen) this.close();
      else this.open(this.backupInfo ? "backup" : void 0);
    }
    updateButtonNotification() {
      const { buttonComponent, pendingRequests, backupInfo } = this;
      if (!buttonComponent) return;
      if (pendingRequests > 0) {
        buttonComponent.setNotifications(pendingRequests);
      } else if (backupInfo && backupInfo.backupsNeeded > 0) {
        buttonComponent.setNotifications("backupNeeded");
      } else {
        buttonComponent.setNotifications(null);
      }
    }
    _open(openReason, directAccess) {
      if (!this.iframeComponent && !this.buttonComponent) {
        console.warn("Wander Embedded's iframe and button has been created manually");
      }
      if (directAccess) {
        Kt({
          destination: "background",
          // @ts-ignore
          messageId: "embedded_navigate",
          // @ts-ignore
          data: directAccess
        });
      }
      if (!this.isOpen) {
        this.openReason ?? (this.openReason = openReason);
        this.buttonComponent?.setStatus("isOpen");
        this.iframeComponent?.show();
      }
      this.onOpen();
    }
    /**
     * Opens the wallet interface
     *
     * @throws Error if Wander Embedded's iframe and button has been created manually
     */
    open(directAccess) {
      this._open("manually", directAccess);
    }
    _close(allowOpeningAutomatically = false) {
      if (!this.iframeComponent && !this.buttonComponent) {
        console.warn("Wander Embedded's iframe and button has been created manually");
      }
      if (this.isOpen) {
        this.openReason = null;
        this.allowOpeningAutomatically = this.pendingRequests === 0 ? true : allowOpeningAutomatically;
        this.buttonComponent?.unsetStatus("isOpen");
        this.iframeComponent?.hide();
      }
      this.onClose();
    }
    /**
     * Closes the wallet interface
     *
     * @throws Error if Wander Embedded's iframe and button has been created manually
     */
    close() {
      this._close();
    }
    /**
     * Signs out the user.
     *
     * @throws Error if the user is not currently authenticating (or the authentication is still loading).
     */
    signOut() {
      if (this.authInfo.authStatus === "not-authenticated" || this.authInfo.authStatus === "loading") {
        throw new Error("The user is not authenticated");
      }
      return new Promise((resolve, reject) => {
        const { iframeRef } = this;
        const contentWindow = iframeRef?.contentWindow;
        if (!iframeRef || !contentWindow) {
          reject(new Error("Missing Wander Connect iframe"));
          return;
        }
        Kt({
          destination: "background",
          // @ts-ignore
          messageId: "embedded_signOut",
          // @ts-ignore
          data: void 0
        });
        this.signOutMethodCallback = resolve;
      });
    }
    /**
     * Update the app, iframe and button themes. Note that if `options.iframe.theme` or `options.button.theme` were used,
     * the iframe theme and/or the button theme, respectively, won't be updated. In that case, you should call
     * `setIframeTheme()` and/or `setButtonTheme()`.
     */
    setTheme(theme) {
      if (!THEMES.includes(theme)) throw new Error(`${theme} is not a valid theme. Use: ${THEMES.join(", ")}`);
      Kt({
        destination: "background",
        // @ts-ignore
        messageId: "embedded_setTheme",
        // @ts-ignore
        data: theme
      });
      window.clearTimeout(this.setThemeTimeoutID);
      this.setThemeTimeoutID = window.setTimeout(() => {
        if (!this.hasIndependentIframeTheme && this.iframeComponent) this.iframeComponent.setTheme(theme);
        if (!this.hasIndependentButtonTheme && this.buttonComponent) this.buttonComponent.setTheme(theme);
      }, 230);
    }
    /**
     * Update the iframe theme (outside only, doesn't affect the iframe content's / app theme).
     */
    setIframeTheme(theme) {
      if (!THEMES.includes(theme)) throw new Error(`${theme} is not a valid theme. Use: ${THEMES.join(", ")}`);
      this.iframeComponent?.setTheme(theme);
    }
    /**
     * Update the button theme.
     */
    setButtonTheme(theme) {
      if (!THEMES.includes(theme)) throw new Error(`${theme} is not a valid theme. Use: ${THEMES.join(", ")}`);
      this.buttonComponent?.setTheme(theme);
    }
    /**
     * Removes all elements and event listeners
     */
    destroy() {
      window.removeEventListener("message", this.handleMessage);
      window.removeEventListener("click", this.handleButtonClick);
      if (this.iframeComponent) {
        this.iframeComponent.destroy();
      }
      if (this.buttonComponent) {
        this.buttonComponent.destroy();
      }
      _WanderConnect.instance = null;
      delete window.arweaveWallet;
      if (this.windowArweaveWallet) {
        window.arweaveWallet = this.windowArweaveWallet;
      }
    }
    get shouldOpenAutomatically() {
      return this.openReason === null && this.allowOpeningAutomatically;
    }
    get shouldCloseAutomatically() {
      return this.openReason === "embedded_request";
    }
    /**
     * Indicates whether the wallet interface is currently open/visible.
     */
    get isOpen() {
      return this.openReason !== null;
    }
    /**
     * Current width of the wallet interface in pixels.
     * @returns Width if available
     */
    get width() {
      return this.routeConfig?.width;
    }
    /**
     * Current height of the wallet interface in pixels.
     * @returns Height if available
     */
    get height() {
      return this.routeConfig?.height;
    }
  };
  _WanderConnect.instance = null;
  _WanderConnect.WANDER_CONNECT_WALLET_NAME = "Wander Connect";
  _WanderConnect.AUTH_STATE_LS_KEY = "WANDER_CONNECT_AUTH_STATE";
  _WanderConnect.BROWSER_WALLET_ENABLED_KEY = "WANDER_CONNECT_BROWSER_WALLET_ENABLED";
  _WanderConnect.DEFAULT_IFRAME_SRC = "https://connect.wander.app/";
  _WanderConnect.DEFAULT_THEME = "system";
  var WanderConnect = _WanderConnect;
  /*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
  /*!
   * The buffer module from node.js, for the browser.
   *
   * @author   Feross Aboukhadijeh <https://feross.org>
   * @license  MIT
   */

  exports.WanderConnect = WanderConnect;

  return exports;

})(window.WanderSDK = window.WanderSDK || {});
//# sourceMappingURL=index.global.js.map
//# sourceMappingURL=index.global.js.map