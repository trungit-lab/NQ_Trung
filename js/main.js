/* ==========================================================
   main.js — Responsive bilingual CV renderer (Bootstrap).
   • Content loaded from data/cv.json & data/projects.json (with fallback for file://).
   • Song ngữ VI/EN: đổi ngôn ngữ & re-render.
   • Bấm 1 project → chi tiết (icon, screenshots, platform link, "Tôi đã làm").
   • Save as PDF: gói toàn bộ CV vào 1 trang A4 chuẩn.
   ========================================================== */
(function () {
  "use strict";

  var G = { cv: null, proj: null, sel: 0, detail: false };
  var LANG = "vi";
  var UI = {
    vi: {
      whatIDid: "Tôi đã làm",
      pickProject: "Chọn một dự án để xem chi tiết.",
      savePdf: "Lưu PDF",
      savePdfFull: "Lưu PDF đầy đủ",
      preparing: "Đang chuẩn bị…"
    },
    en: {
      whatIDid: "What I did",
      pickProject: "Select a project to see details.",
      savePdf: "Save as PDF",
      savePdfFull: "Save full PDF",
      preparing: "Preparing…"
    }
  };

  function T(k) { return (UI[LANG] || UI.vi)[k]; }

  // resolve a value that may be a plain string or a {vi,en} object
  function L(x) {
    if (x && typeof x === "object" && !Array.isArray(x) && ("vi" in x || "en" in x)) {
      return x[LANG] != null ? x[LANG] : (x.vi != null ? x.vi : x.en);
    }
    return x;
  }

  /* ---- DOM helpers ------------------------------------- */
  function E(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function icon(id, cls) {
    return '<svg class="' + (cls || "ic") + '" aria-hidden="true"><use href="' + id + '"/></svg>';
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function title(sectionEl, label, iconId) {
    sectionEl.appendChild(E("div", "sec-title", icon(iconId) + "<span>" + esc(label) + "</span>"));
  }
  function mediaIcon(cls, src, fallbackId, eager) {
    var box = E("span", cls);
    if (src && src.charAt(0) === "#") { box.innerHTML = icon(src, "ph"); return box; }
    var img = E("img"); img.alt = ""; img.loading = eager ? "eager" : "lazy"; img.src = src;
    img.onerror = function () { box.innerHTML = icon(fallbackId || "#i-gamepad", "ph"); };
    box.appendChild(img);
    return box;
  }

  /* ---- Header ------------------------------------------ */
  function renderHeader(cv) {
    var host = document.getElementById("header");
    clear(host);

    var av = E("div", "avatar");
    av.innerHTML = '<img src="' + esc(cv.avatar) + '" alt="Avatar">';
    host.appendChild(av);

    var body = E("div", "h-body");
    body.appendChild(E("h1", "nm-name", esc(L(cv.name))));
    body.appendChild(E("div", "nm-role", esc(L(cv.role))));
    if (cv.objective) body.appendChild(E("p", "nm-intro", esc(L(cv.objective))));

    var row = E("div", "contact-row");
    (cv.contacts || []).forEach(function (c) {
      var tag = c.href ? "a" : "span";
      var e = E(tag, "contact");
      if (c.href) {
        e.setAttribute("href", c.href);
        if (c.href.startsWith("http")) {
          e.setAttribute("target", "_blank");
          e.setAttribute("rel", "noopener noreferrer");
        }
      }
      e.innerHTML = '<span class="ci-ico">' + icon(c.icon) + "</span><span>" + esc(L(c.text)) + "</span>";
      row.appendChild(e);
    });
    body.appendChild(row);
    host.appendChild(body);
  }

  /* ---- Skills ------------------------------------------ */
  function renderSkills(cv) {
    var host = document.getElementById("skills");
    clear(host);
    title(host, "Skills", "#i-code");
    (cv.skills || []).forEach(function (g) {
      var grp = E("div", "sk-group");
      grp.appendChild(E("div", "sk-name", esc(L(g.group))));
      var r = E("div", "chip-row");
      (g.items || []).forEach(function (it, i) {
        r.appendChild(E("span", "chip" + (i === 0 ? " chip--acc" : ""), esc(L(it))));
      });
      grp.appendChild(r);
      host.appendChild(grp);
    });
  }

  /* ---- Experience + Education -------------------------- */
  function renderExperience(cv) {
    var host = document.getElementById("experience");
    clear(host);
    title(host, "Experience", "#i-sparkle");

    (cv.experience || []).forEach(function (w) {
      var item = E("div", "exp-item");
      var head = E("div", "exp-head");
      head.appendChild(E("div", "exp-co", esc(L(w.company))));
      head.appendChild(E("span", "exp-time", esc(L(w.time))));
      item.appendChild(head);
      if (w.position) item.appendChild(E("div", "exp-pos", esc(L(w.position))));
      var ul = E("ul", "exp-points");
      (w.points || []).forEach(function (p) { ul.appendChild(E("li", "exp-point", esc(L(p)))); });
      item.appendChild(ul);
      host.appendChild(item);
    });

    if ((cv.education || []).length) {
      host.appendChild(E("div", "sec-sub", icon("#i-cap") + "<span>Education</span>"));
      cv.education.forEach(function (ed) {
        var item = E("div", "edu-item");
        item.appendChild(E("div", "edu-degree", esc(L(ed.degree))));
        item.appendChild(E("div", "edu-school", esc(L(ed.school))));
        item.appendChild(E("div", "edu-time", esc(L(ed.time))));
        if (ed.honors) {
          var hBox = E("div", "edu-honors");
          if (Array.isArray(ed.honors)) {
            ed.honors.forEach(function (h) {
              hBox.appendChild(E("div", "edu-honor-item", esc(L(h))));
            });
          } else {
            hBox.appendChild(E("div", "edu-honor-item", esc(L(ed.honors))));
          }
          item.appendChild(hBox);
        }
        host.appendChild(item);
      });
    }
  }

  /* ---- Project Detail ---------------------------------- */
  function renderDetail(p) {
    var host = document.getElementById("project-detail");
    clear(host);
    if (!p) { host.appendChild(E("p", "text-muted", T("pickProject"))); return; }

    var top = E("div", "pd-top");
    top.appendChild(mediaIcon("pd-icon", p.icon, "#i-gamepad"));
    var meta = E("div", "pd-meta");
    meta.appendChild(E("h2", "pd-name", esc(L(p.name))));
    if (p.genre) meta.appendChild(E("span", "pd-genre", esc(L(p.genre))));
    top.appendChild(meta);
    host.appendChild(top);

    if (p.description) host.appendChild(E("p", "pd-desc", esc(L(p.description))));

    if ((p.screenshots || []).length) {
      var shots = E("div", "pd-shots");
      p.screenshots.forEach(function (src) {
        var cell = E("div", "pd-shot");
        var img = E("img"); img.alt = ""; img.loading = "lazy"; img.src = src;
        img.onerror = function () { cell.innerHTML = icon("#i-image", "ph"); };
        cell.appendChild(img);
        shots.appendChild(cell);
      });
      host.appendChild(shots);
    }

    if ((p.platforms || []).length) {
      var plats = E("div", "pd-plats");
      p.platforms.forEach(function (pl, i) {
        var a = E("a", "plat " + (i === 0 ? "plat--a" : "plat--i"));
        a.setAttribute("href", pl.url || "#");
        if (pl.url && pl.url !== "#") { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
        a.innerHTML = "<span>" + esc(L(pl.name)) + "</span>" + icon("#i-external");
        plats.appendChild(a);
      });
      host.appendChild(plats);
    }

    if ((p.contributions || []).length) {
      host.appendChild(E("div", "pd-work-title", T("whatIDid")));
      var ul = E("ul", "pd-work");
      p.contributions.forEach(function (c) { ul.appendChild(E("li", null, esc(L(c)))); });
      host.appendChild(ul);
    }
  }

  /* ---- Project List (+ Print Grid) --------------------- */
  function renderProjects(proj) {
    var host = document.getElementById("project-list");
    clear(host);

    var list = E("div", "proj-list");
    var items = [];
    (proj.projects || []).forEach(function (p, idx) {
      var btn = E("button", "proj-item");
      btn.type = "button";
      btn.title = L(p.name);
      btn.setAttribute("aria-label", L(p.name));
      btn.appendChild(mediaIcon("p-ico", p.icon, "#i-gamepad"));
      var name = E("span", "p-name", esc(L(p.name)));
      if (p.studio) name.appendChild(E("span", "p-studio", esc(L(p.studio))));
      btn.appendChild(name);
      btn.appendChild(E("span", "p-chev", icon("#i-chevron")));
      btn.addEventListener("click", function () { select(idx); });
      list.appendChild(btn);
      items.push(btn);
    });
    host.appendChild(list);

    function select(i) {
      G.sel = i;
      items.forEach(function (b, j) { b.classList.toggle("is-active", j === i); });
      renderDetail(proj.projects[i]);
    }
    var n = (proj.projects || []).length;
    if (n) select(G.sel < n ? G.sel : 0); else renderDetail(null);

    // print-only compact 4-col icon grid
    var grid = document.getElementById("project-print-grid");
    if (grid) {
      clear(grid);
      (proj.projects || []).forEach(function (p) {
        var cell = E("div", "pp-item");
        cell.appendChild(mediaIcon("pp-ico", p.icon, "#i-gamepad"));
        cell.appendChild(E("div", "pp-name", esc(L(p.name))));
        grid.appendChild(cell);
      });
    }
  }

  /* ---- Print-only full project detail ------------------ */
  function renderPrintDetail(proj) {
    var host = document.getElementById("project-print-detail");
    if (!host) return;
    clear(host);
    if (!G.detail) return;

    var lead = E("div", "pp-lead");
    title(lead, "Projects", "#i-gamepad");
    host.appendChild(lead);

    (proj.projects || []).forEach(function (p, idx) {
      var card = E("div", "pp-card");

      var top = E("div", "ppc-top");
      top.appendChild(mediaIcon("ppc-ico", p.icon, "#i-gamepad", true));
      var meta = E("div", "ppc-meta");
      meta.appendChild(E("h3", "ppc-name", esc(L(p.name))));
      var sub = [L(p.studio), L(p.genre)].filter(Boolean).join(" — ");
      if (sub) meta.appendChild(E("div", "ppc-sub", esc(sub)));
      top.appendChild(meta);
      card.appendChild(top);

      if (p.description) card.appendChild(E("p", "ppc-desc", esc(L(p.description))));

      if ((p.screenshots || []).length) {
        var shots = E("div", "ppc-shots");
        p.screenshots.slice(0, 3).forEach(function (src) {
          var cell = E("div", "ppc-shot");
          var img = E("img"); img.alt = ""; img.loading = "eager"; img.src = src;
          img.onerror = function () {
            if (cell.parentNode) cell.parentNode.removeChild(cell);
            if (!shots.childNodes.length && shots.parentNode) shots.parentNode.removeChild(shots);
          };
          cell.appendChild(img);
          shots.appendChild(cell);
        });
        card.appendChild(shots);
      }

      if ((p.platforms || []).length) {
        var plats = E("div", "ppc-plats");
        p.platforms.forEach(function (pl, i) {
          var a = E("a", "plat " + (i === 0 ? "plat--a" : "plat--i"));
          a.setAttribute("href", pl.url || "#");
          a.innerHTML = "<span>" + esc(L(pl.name)) + "</span>" + icon("#i-external");
          plats.appendChild(a);
        });
        card.appendChild(plats);
      }

      if ((p.contributions || []).length) {
        card.appendChild(E("div", "ppc-work-title", T("whatIDid")));
        var ul = E("ul", "ppc-work");
        p.contributions.forEach(function (c) { ul.appendChild(E("li", null, esc(L(c)))); });
        card.appendChild(ul);
      }

      (idx === 0 ? lead : host).appendChild(card);
    });
  }

  /* ---- Footer ------------------------------------------ */
  function renderFooter(cv) {
    var host = document.getElementById("footer");
    clear(host);
    var name = E("div", "f-name");
    name.innerHTML = esc(L(cv.name)) + " <span>· " + esc(L(cv.appliedPosition || cv.role)) + "</span>";
    host.appendChild(name);
    host.appendChild(E("div", "f-made", "© " + new Date().getFullYear() + " Nguyễn Quốc Trung · Unity Game Developer"));
  }

  function renderAll() {
    if (!G.cv || !G.proj) return;
    renderHeader(G.cv);
    renderSkills(G.cv);
    renderExperience(G.cv);
    renderProjects(G.proj);
    renderPrintDetail(G.proj);
    renderFooter(G.cv);
  }

  /* ---- Language ---------------------------------------- */
  function setLang(lang) {
    LANG = lang === "en" ? "en" : "vi";
    try { localStorage.setItem("cv-lang", LANG); } catch (e) {}
    document.documentElement.lang = LANG;
    var btns = document.querySelectorAll(".lang-toggle button");
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle("is-active", btns[i].getAttribute("data-lang") === LANG);
    }
    var pb = document.querySelector("[data-print]");
    if (pb) pb.textContent = T("savePdf");
    var pbf = document.querySelector("[data-print-full]");
    if (pbf) pbf.textContent = T("savePdfFull");
    renderAll();
  }

  /* ---- Print entry points ------------------------------ */
  function printCompact() {
    G.detail = false;
    renderPrintDetail(G.proj || {});
    window.print();
  }
  function printFull(btn) {
    G.detail = true;
    renderPrintDetail(G.proj || {});
    var label = btn ? btn.textContent : null;
    if (btn) { btn.style.minWidth = btn.offsetWidth + "px"; btn.disabled = true; btn.textContent = T("preparing"); }
    imagesReady(document.getElementById("project-print-detail"), 8000).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = label; btn.style.minWidth = ""; }
      window.print();
    });
  }

  function imagesReady(host, ms) {
    var imgs = host ? Array.prototype.slice.call(host.querySelectorAll("img")) : [];
    var all = Promise.all(imgs.map(function (img) {
      if (img.complete) return Promise.resolve();
      return new Promise(function (res) {
        img.addEventListener("load", res, { once: true });
        img.addEventListener("error", res, { once: true });
      });
    }));
    var cap = new Promise(function (res) { setTimeout(res, ms || 5000); });
    return Promise.race([all, cap]);
  }

  /* ---- One-page print scaling -------------------------- */
  var PRINT = { W: 1080, pageW: 730, pageH: 1040 };
  function applyPrintLayout() {
    var html = document.documentElement;
    if (html.classList.contains("printing")) return;
    html.classList.add("printing");
    var cv = document.querySelector(".cv");
    var wrap = document.getElementById("print-wrap");
    if (!cv || !wrap) return;

    if (G.detail) {
      html.classList.add("printing--full");
      cv.style.zoom = PRINT.pageW / PRINT.W;
      return;
    }

    cv.style.transform = "none";
    cv.style.position = "static";
    var H = cv.offsetHeight;
    var s = Math.min(PRINT.pageW / PRINT.W, PRINT.pageH / H, 1) * 0.995;
    cv.style.transformOrigin = "top left";
    cv.style.transform = "scale(" + s + ")";
    cv.style.position = "absolute";
    cv.style.top = "0";
    cv.style.left = "0";
    wrap.style.position = "relative";
    wrap.style.margin = "0 auto";
    wrap.style.overflow = "hidden";
    wrap.style.width = Math.ceil(PRINT.W * s) + "px";
    wrap.style.height = Math.ceil(H * s) + "px";
  }
  function clearPrintLayout() {
    var html = document.documentElement;
    if (!html.classList.contains("printing")) return;
    html.classList.remove("printing");
    html.classList.remove("printing--full");
    var cv = document.querySelector(".cv");
    var wrap = document.getElementById("print-wrap");
    if (cv) ["transform", "transformOrigin", "position", "top", "left", "zoom"].forEach(function (p) { cv.style[p] = ""; });
    if (wrap) ["position", "margin", "overflow", "width", "height"].forEach(function (p) { wrap.style[p] = ""; });
  }

  /* ---- Data fetching & initialization ------------------ */
  function getJSON(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(url + " → HTTP " + r.status);
      return r.json();
    });
  }

  function run() {
    var pb = document.querySelector("[data-print]");
    if (pb) pb.addEventListener("click", function () { printCompact(); });
    var pbf = document.querySelector("[data-print-full]");
    if (pbf) pbf.addEventListener("click", function () { printFull(pbf); });
    var langBtns = document.querySelectorAll(".lang-toggle button");
    for (var i = 0; i < langBtns.length; i++) {
      (function (b) { b.addEventListener("click", function () { setLang(b.getAttribute("data-lang")); }); })(langBtns[i]);
    }
    window.addEventListener("beforeprint", applyPrintLayout);
    window.addEventListener("afterprint", clearPrintLayout);

    var saved = "vi";
    try { saved = localStorage.getItem("cv-lang") || "vi"; } catch (e) {}
    var m = /[?&]lang=(vi|en)/.exec(location.search);
    LANG = m ? m[1] : (saved === "en" ? "en" : "vi");
    G.detail = /[?&]detail=1/.test(location.search);

    // Attempt to fetch data/cv.json & data/projects.json; fallback to window.DEFAULT_DATA if CORS/file://
    Promise.all([getJSON("data/cv.json"), getJSON("data/projects.json")])
      .then(function (res) {
        G.cv = res[0]; G.proj = res[1];
        setLang(LANG);
        if (/[?&]print=1/.test(location.search)) applyPrintLayout();
      })
      .catch(function () {
        if (window.DEFAULT_CV && window.DEFAULT_PROJECTS) {
          G.cv = window.DEFAULT_CV;
          G.proj = window.DEFAULT_PROJECTS;
          setLang(LANG);
          if (/[?&]print=1/.test(location.search)) applyPrintLayout();
        } else {
          document.querySelector(".cv").innerHTML =
            '<div class="panel text-center py-5"><h3>Không tải được dữ liệu</h3><p>Vui lòng kiểm tra lại file data/cv.json và data/projects.json</p></div>';
        }
      });
  }

  if (document.readyState !== "loading") run();
  else document.addEventListener("DOMContentLoaded", run);
})();

