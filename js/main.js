(function () {
  var d = document,
    h = d.querySelector("header"),
    b = d.querySelector(".burger"),
    n = d.getElementById("menu"),
    cur = d.getElementById("cur"),
    lab = d.getElementById("lab"),
    cnt = d.getElementById("cnt"),
    pg = d.querySelector(".pg");
  var rm = matchMedia("(prefers-reduced-motion: reduce)").matches,
    busy = false;
  function set(o, f) {
    b.setAttribute("aria-expanded", o);
    b.setAttribute("aria-label", o ? "Close menu" : "Open menu");
    n.classList.toggle("open", o);
    d.body.classList.toggle("menu-open", o);
    d.body.style.overflow = o ? "hidden" : "";
    [].forEach.call(d.querySelectorAll("main,footer"), function (e) {
      o ? e.setAttribute("inert", "") : e.removeAttribute("inert");
    });
    o ? n.removeAttribute("inert") : n.setAttribute("inert", "");
    b.querySelector(".lbl").textContent = o ? "Close" : "Menu";
    if (o)
      setTimeout(function () {
        n.querySelector("a").focus();
      }, 500);
    else if (f !== 0) b.focus();
  }
  b.addEventListener("click", function () {
    set(b.getAttribute("aria-expanded") !== "true");
  });
  d.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && n.classList.contains("open")) set(false);
  });
  n.addEventListener("mouseover", function (e) {
    var a = e.target.closest(".mn a");
    n.dataset.hot = a ? a.dataset.hot : "";
  });
  n.addEventListener("mouseleave", function () {
    n.dataset.hot = "";
  });
  n.addEventListener("focusin", function (e) {
    var a = e.target.closest(".mn a");
    n.dataset.hot = a ? a.dataset.hot : "";
  });
  addEventListener(
    "scroll",
    function () {
      h.classList.toggle("solid", scrollY > 40);
    },
    { passive: true },
  );
  var els = d.querySelectorAll(".rv");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    els.forEach(function (e) {
      io.observe(e);
    });
  } else
    els.forEach(function (e) {
      e.classList.add("in");
    });
  var v = d.getElementById("hv");
  if (rm) {
    v.removeAttribute("autoplay");
    v.pause();
  } else {
    var pp = v.play();
    if (pp && pp.catch) pp.catch(function () {});
  }
  d.addEventListener("visibilitychange", function () {
    if (!rm) d.hidden ? v.pause() : v.play().catch(function () {});
  });
  function split(el) {
    [].slice.call(el.childNodes).forEach(function (c) {
      if (c.nodeType === 3) {
        var f = d.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach(function (s) {
          if (!s) return;
          if (/^\s+$/.test(s)) f.appendChild(d.createTextNode(s));
          else {
            var w = d.createElement("span");
            w.className = "w";
            w.textContent = s;
            f.appendChild(w);
          }
        });
        c.replaceWith(f);
      } else if (c.nodeType === 1) split(c);
    });
  }
  var ih = d.querySelector(".intro h2");
  split(ih);
  var W = ih.querySelectorAll(".w"),
    gi = 0;
  d.querySelectorAll(".hero h1 em").forEach(function (em) {
    var tx = em.textContent,
      ws = tx.split(" ");
    em.textContent = "";
    ws.forEach(function (w, wi) {
      var s = d.createElement("span");
      s.style.cssText = "display:inline-block;white-space:nowrap";
      w.split("").forEach(function (ch) {
        var c = d.createElement("span");
        c.className = "ch";
        c.style.setProperty("--i", gi++);
        c.textContent = ch;
        s.appendChild(c);
      });
      em.appendChild(s);
      if (wi < ws.length - 1) em.appendChild(d.createTextNode(" "));
    });
  });
  var rdy = 0;
  function countUp() {
    [].forEach.call(d.querySelectorAll(".cnt"), function (e) {
      var to = +e.dataset.to;
      if (rm) {
        e.textContent = to;
        return;
      }
      var s = 0;
      (function f(t) {
        if (!s) s = t;
        var k = Math.min((t - s) / 1600, 1);
        e.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(f);
      })(performance.now());
    });
  }
  function ready() {
    if (rdy) return;
    rdy = 1;
    d.body.classList.add("ready");
    d.body.classList.remove("loading");
    countUp();
  }
  setTimeout(ready, 4500);
  if (rm) {
    ready();
  } else {
    var s0 = 0;
    (function c(t) {
      if (!s0) s0 = t;
      var k = Math.min((t - s0) / 2200, 1);
      cnt.textContent = Math.round(k * 100);
      if (k < 1) requestAnimationFrame(c);
      else
        setTimeout(function () {
          cur.style.transform = "translateY(-100%)";
          ready();
        }, 200);
    })(performance.now());
    var hero = d.querySelector(".hero"),
      vid = hero.querySelector("video"),
      hw = hero.querySelector(".wrap"),
      sc = hero.querySelector(".scroll"),
      intro = d.querySelector(".intro"),
      mq = [].slice.call(d.querySelectorAll(".mt"));
    [].forEach.call(d.querySelectorAll(".card"), function (c, i) {
      c.dataset.speed = [0.05, 0.12, 0.03, 0.16][i];
    });
    var pan = d.querySelector(".legend");
    if (pan) pan.dataset.speed = ".06";
    var par = [].slice.call(d.querySelectorAll("[data-speed]")),
      sy = scrollY,
      sl = [].slice.call(d.querySelectorAll("[data-slide]")),
      bg = d.querySelector(".bgfx"),
      h1s = hw.querySelectorAll("h1>span"),
      ld = hw.querySelector(".lede"),
      ct = hw.querySelector(".ctas"),
      gh = hero.querySelector(".ghost"),
      hud = hero.querySelector(".hud"),
      dim = hero.querySelector(".dim"),
      p2 = [].slice.call(hero.querySelectorAll(".ph2>*")),
      pho = d.querySelector(".pho"),
      phi = pho.querySelector(".phi"),
      pht = pho.querySelector(".pht"),
      how = d.querySelector(".how"),
      hn = d.querySelector(".hn"),
      hl = [].slice.call(d.querySelectorAll(".hws li")),
      hi = -1;
    var hzs = [].map.call(d.querySelectorAll(".hz"), function (h) {
      return { h: h, k: h.querySelector(".hzt"), m: 1 };
    });
    function size() {
      hzs.forEach(function (o) {
        o.m = Math.max(1, o.k.offsetWidth - innerWidth);
        o.h.style.height = o.m + innerHeight + "px";
      });
    }
    size();
    addEventListener("resize", size);
    addEventListener("load", size);
    if (matchMedia("(hover:hover)").matches)
      addEventListener("pointermove", function (e) {
        hero.style.setProperty("--mx", (e.clientX / innerWidth - 0.5) * 2);
        hero.style.setProperty("--my", (e.clientY / innerHeight - 0.5) * 2);
      });
    function cl(x) {
      return Math.max(0, Math.min(1, x));
    }
    (function tick(t) {
      sy += (scrollY - sy) * 0.075;
      if (Math.abs(scrollY - sy) < 0.1) sy = scrollY;
      var vh = innerHeight,
        p = Math.min(sy / vh, 1.2);
      var hp = cl(sy / Math.max(1, hero.offsetHeight - vh)),
        e1 = cl(hp / 0.4);
      e1 = e1 * e1 * (3 - 2 * e1);
      vid.style.setProperty("--vs", 1.02 + hp * 0.08);
      vid.style.setProperty("--vy", hp * vh * 0.08 + "px");
      h1s[0].style.translate = -e1 * innerWidth * 0.6 + "px 0";
      h1s[1].style.translate = e1 * innerWidth * 0.6 + "px 0";
      ld.style.translate = "0 " + e1 * 70 + "px";
      ct.style.translate = "0 " + e1 * 70 + "px";
      hw.style.opacity = 1 - cl((hp - 0.1) / 0.28);
      sc.style.opacity = Math.max(0, 1 - hp * 8);
      gh.style.scale = 1 + hp * 0.5;
      gh.style.opacity = 1 - cl((hp - 0.5) / 0.4);
      hud.style.scale = 1 + hp * 0.3;
      hud.style.opacity = 1 - cl((hp - 0.55) / 0.3);
      dim.style.opacity = 0.6 * cl((hp - 0.3) / 0.35);
      p2.forEach(function (e, i) {
        var k = cl((hp - (0.34 + i * 0.11)) / 0.16);
        e.style.opacity = k;
        e.style.translate = "0 " + (1 - k) * 46 + "px";
      });
      pg.style.transform = "scaleX(" + cl(sy / (d.documentElement.scrollHeight - vh)) + ")";
      var ip = cl((sy - intro.offsetTop) / (intro.offsetHeight - vh)),
        N = W.length;
      for (var i = 0; i < N; i++) W[i].style.opacity = 0.15 + 0.85 * cl(ip * (N + 4) - i);
      par.forEach(function (e) {
        var r = e.parentElement.getBoundingClientRect();
        e.style.translate =
          "0 " + -(r.top + r.height / 2 - vh / 2) * parseFloat(e.dataset.speed) + "px";
      });
      mq.forEach(function (m, i) {
        var w = m.firstElementChild.offsetWidth,
          x = (sy * 0.5 + t * 0.04) % w;
        m.style.transform = "translateX(" + (i % 2 ? x - w : -x) + "px)";
      });
      sl.forEach(function (e) {
        var r = e.closest("section").getBoundingClientRect(),
          k = cl((vh * 0.95 - r.top) / (vh * 0.8));
        e.style.translate = (1 - k) * +e.dataset.slide * innerWidth * 0.45 + "px 0";
      });
      var pk = cl((sy - pho.offsetTop) / (pho.offsetHeight - vh)),
        pe = cl(pk / 0.6);
      pe = pe * pe * (3 - 2 * pe);
      phi.style.clipPath = "inset(" + 16 * (1 - pe) + "% " + 14 * (1 - pe) + "%)";
      phi.style.scale = 1.12 - 0.12 * pe;
      var tk2 = cl((pk - 0.55) / 0.3);
      pht.style.opacity = tk2;
      pht.style.translate = "0 " + (1 - tk2) * 50 + "px";
      var wk = cl((sy - how.offsetTop) / (how.offsetHeight - vh)),
        ix = Math.min(3, Math.floor(wk * 4));
      if (ix !== hi) {
        hi = ix;
        hn.textContent = "0" + (ix + 1);
        hl.forEach(function (e, j) {
          e.classList.toggle("on", j === ix);
        });
      }
      bg.style.setProperty("--p", cl(sy / (d.documentElement.scrollHeight - vh)));
      hero.style.setProperty("--gy", p * vh * 0.25 + "px");
      hzs.forEach(function (o) {
        o.k.style.transform = "translateX(" + -cl((sy - o.h.offsetTop) / o.m) * o.m + "px)";
      });
      requestAnimationFrame(tick);
    })(0);
  }
  d.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href").slice(1),
      tg = id === "hero" ? d.body : d.getElementById(id);
    if (!tg) return;
    e.preventDefault();
    if (busy) return;
    set(false);
    function jump() {
      id === "hero"
        ? scrollTo({ top: 0, behavior: "instant" })
        : tg.scrollIntoView({ behavior: "instant" });
    }
    if (rm) {
      jump();
      return;
    }
    busy = true;
    lab.textContent = a.classList.contains("mark")
      ? "Home"
      : (a.querySelector("span") || a).textContent.replace(/\(.*\)/, "").trim();
    cur.classList.add("nav");
    cur.style.transition = "none";
    cur.style.transform = "translateY(100%)";
    cur.offsetWidth;
    cur.style.transition = "";
    cur.style.transform = "translateY(0)";
    setTimeout(function () {
      jump();
      cur.style.transform = "translateY(-100%)";
      setTimeout(function () {
        busy = false;
      }, 1500);
    }, 1400);
  });
})();
