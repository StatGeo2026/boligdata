// Boligdata-legeplads: R (webR) in the browser + encrypted course data + gallery.

import { NEON_URL, WEBR_VERSION, R_PACKAGES } from "./config.js";
import { EKSEMPLER, STARTKODE } from "./eksempler.js";

const $ = (id) => document.getElementById(id);
const store = {   // localStorage can throw (private mode, blocked storage)
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

// R graphics device size per aspect ratio (CSS pixels; webR renders sharper).
const SIZES = { "3:2": [600, 400], "1:1": [520, 520], "16:9": [640, 360], "4:5": [480, 600] };
const RDS_PATH = "/home/web_user/boligdata.rds";

const R_LOAD = `
local({
  d <- readRDS("${RDS_PATH}")
  for (nm in names(d)) assign(nm, tibble::as_tibble(d[[nm]]), envir = globalenv())
})`;

const R_HELPERS = `
afstand_km <- function(lat1, lon1, lat2, lon2) {
  # Afstand i km i fugleflugt mellem to punkter (haversine-formlen).
  rad <- pi / 180
  a <- sin((lat2 - lat1) * rad / 2)^2 +
    cos(lat1 * rad) * cos(lat2 * rad) * sin((lon2 - lon1) * rad / 2)^2
  2 * 6371 * asin(pmin(1, sqrt(a)))
}
options(width = 80, max.print = 2000, dplyr.summarise.inform = FALSE)`;

let webR = null;
let ready = false;
let running = false;
let password = null;
let images = [];
let imageIndex = 0;
let lastPlotCode = null;
const gallery = new Map();

// ---------------------------------------------------------------- status ----
function setStatus(text, state = "loading") {
  $("status").dataset.state = state;
  $("status-text").textContent = text;
}

// ---------------------------------------------------------------- editor ----
let editor;
async function makeEditor() {
  const initial = store.get("boligdata:kode") ?? STARTKODE;
  try {
    const { createEditor } = await import("./vendor/editor.js");
    editor = createEditor($("editor"), initial, run);
  } catch (err) {
    console.error(err);   // fall back to a plain textarea
    const ta = document.createElement("textarea");
    ta.className = "fallback";
    ta.spellcheck = false;
    ta.value = initial;
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey || e.shiftKey)) { e.preventDefault(); run(); }
    });
    $("editor").append(ta);
    editor = {
      get: () => ta.value,
      set: (t) => { ta.value = t; },
      focus: () => ta.focus(),
      insert: (t) => { ta.setRangeText(t, ta.selectionStart, ta.selectionEnd, "end"); ta.focus(); },
    };
  }
}
const saveDraft = () => editor && store.set("boligdata:kode", editor.get());
document.addEventListener("visibilitychange", saveDraft);
window.addEventListener("pagehide", saveDraft);

// --------------------------------------------------------------- console ----
const MAX_CONSOLE = 150_000;
function log(text, cls = "stdout") {
  const con = $("console");
  const span = document.createElement("span");
  span.className = cls;
  span.textContent = text.endsWith("\n") ? text : text + "\n";
  con.append(span);
  while (con.textContent.length > MAX_CONSOLE && con.firstChild) con.firstChild.remove();
  con.scrollTop = con.scrollHeight;
}
$("clear-console").onclick = () => { $("console").textContent = ""; };

async function conditionMessage(cond) {
  // Ask R: rlang/cli conditions carry call traces that cannot become JS objects.
  try {
    return await webR.evalRString(
      "paste(conditionMessage(cond), collapse = '\\n')", { env: { cond } });
  } catch {
    try {
      const js = await cond.toJs({ depth: 1 });
      return String(js.values[js.names.indexOf("message")].values.join(""));
    } catch {
      return "(beskeden kunne ikke vises)";
    }
  }
}

// ------------------------------------------------------------------ data ----
const binPromise = fetch("data/boligdata.bin").then((r) => {
  if (!r.ok) throw new Error(`Kunne ikke hente data (HTTP ${r.status})`);
  return r.arrayBuffer();
});

async function decrypt(pw) {
  const buf = new Uint8Array(await binPromise);
  if (new TextDecoder().decode(buf.subarray(0, 8)) !== "BOLIGv1\0") throw new Error("Ukendt dataformat");
  const iterations = new DataView(buf.buffer, buf.byteOffset).getUint32(8);
  const salt = buf.subarray(12, 28), iv = buf.subarray(28, 40), cipher = buf.subarray(40);
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" }, base,
    { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher));
}

async function unlock() {
  const saved = store.get("boligdata:kodeord");
  if (saved) {
    try { const plain = await decrypt(saved); password = saved; return plain; }
    catch { store.del("boligdata:kodeord"); }
  }
  return new Promise((resolve) => {
    const dlg = $("unlock");
    dlg.addEventListener("cancel", (e) => e.preventDefault());
    dlg.showModal();
    $("unlock-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const pw = $("unlock-pw").value.trim();
      const btn = $("unlock-btn");
      btn.disabled = true;
      btn.textContent = "Tjekker …";
      $("unlock-error").hidden = true;
      try {
        const plain = await decrypt(pw);
        password = pw;
        if ($("unlock-remember").checked) store.set("boligdata:kodeord", pw);
        dlg.close();
        resolve(plain);
      } catch (err) {
        $("unlock-error").textContent = err.name === "OperationError"
          ? "Forkert kodeord. Prøv igen." : `Fejl: ${err.message}`;
        $("unlock-error").hidden = false;
      } finally {
        btn.disabled = false;
        btn.textContent = "Åbn data";
      }
    });
  });
}

// --------------------------------------------------------------------- R ----
async function startR() {
  setStatus("Henter R …");
  const base = `https://webr.r-wasm.org/${WEBR_VERSION}/`;
  const { WebR } = await import(base + "webr.mjs");
  webR = new WebR({ baseUrl: base });
  await webR.init();
  setStatus("Henter R-pakker …");
  await webR.installPackages(R_PACKAGES, { quiet: true });
  await webR.evalRVoid(`suppressPackageStartupMessages({ ${R_PACKAGES.map((p) => `library(${p})`).join("; ")} })`);
  await webR.evalRVoid(R_HELPERS);
}

async function run() {
  if (!ready || running) return;
  const code = editor.get();
  saveDraft();
  running = true;
  $("run").disabled = true;
  $("spinner").hidden = false;
  log(`> kørsel ${new Date().toLocaleTimeString("da-DK")}`, "echo");
  const [width, height] = SIZES[$("format").value] ?? SIZES["3:2"];
  const shelter = await new webR.Shelter();
  try {
    const res = await shelter.captureR(code, {
      withAutoprint: true, captureStreams: true, captureConditions: true,
      throwJsException: false, captureGraphics: { width, height, bg: "white" },
    });
    for (const item of res.output) {
      if (item.type === "stdout" || item.type === "stderr") log(item.data, item.type);
      else {
        const msg = await conditionMessage(item.data);
        const label = { error: "Fejl: ", warning: "Advarsel: " }[item.type] ?? "";
        log(label + msg, item.type);
      }
    }
    if (res.images.length) {
      images = res.images;
      imageIndex = images.length - 1;
      lastPlotCode = code;
      drawPlot();
    }
  } catch (err) {
    log(`Fejl: ${err.message}`, "error");
  } finally {
    await shelter.purge();
    running = false;
    $("run").disabled = false;
    $("spinner").hidden = true;
  }
}

function drawPlot() {
  const bmp = images[imageIndex];
  const canvas = $("plot");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  canvas.getContext("2d").drawImage(bmp, 0, 0);
  canvas.hidden = false;
  $("plot-empty").hidden = true;
  const many = images.length > 1;
  $("plot-count").textContent = many ? `Figur ${imageIndex + 1} af ${images.length}` : "";
  $("prev-plot").hidden = $("next-plot").hidden = !many;
  $("prev-plot").disabled = imageIndex === 0;
  $("next-plot").disabled = imageIndex === images.length - 1;
  $("download").disabled = false;
  $("submit").disabled = !NEON_URL;
}
$("prev-plot").onclick = () => { imageIndex = Math.max(0, imageIndex - 1); drawPlot(); };
$("next-plot").onclick = () => { imageIndex = Math.min(images.length - 1, imageIndex + 1); drawPlot(); };
$("download").onclick = () => {
  $("plot").toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "boligfigur.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, "image/png");
};
$("run").onclick = run;
$("format").onchange = () => { if (lastPlotCode !== null && lastPlotCode === editor.get()) run(); };
$("reset").onclick = async () => {
  if (!ready) return;
  await webR.evalRVoid(R_LOAD);
  log("Data er genindlæst.", "message");
};

// ------------------------------------------------------- variables panel ----
async function loadVariables() {
  const meta = await (await fetch("data/variabler.json")).json();
  const n = meta.tables.find((t) => t.table === "boliger")?.nrow;
  if (n) {
    const date = new Date(meta.hentet).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });
    $("dataline").textContent = `${n.toLocaleString("da-DK")} boliger til salg i Danmark · Boligsiden, ${date}`;
  }
  const list = $("var-list");
  list.textContent = "";
  for (const t of meta.tables) {
    const box = document.createElement("div");
    box.className = "var-table";
    const h = document.createElement("h4");
    const tn = document.createElement("button");
    tn.className = "linklike";
    tn.innerHTML = `<code></code>`;
    tn.firstChild.textContent = t.table;
    tn.onclick = () => editor.insert(t.table);
    h.append(tn, Object.assign(document.createElement("span"), {
      className: "muted", textContent: `${t.nrow.toLocaleString("da-DK")} rækker, ${t.columns.length} variabler` }));
    box.append(h);
    for (const c of t.columns) {
      const row = document.createElement("div");
      row.className = "var";
      row.dataset.search = `${t.table} ${c.name} ${c.desc}`.toLowerCase();
      const left = document.createElement("div");
      const name = Object.assign(document.createElement("button"), { className: "name", textContent: c.name, title: "Sæt ind i koden" });
      name.onclick = () => editor.insert(c.name);
      left.append(name, Object.assign(document.createElement("span"), { className: "type", textContent: shortType(c.type) }));
      const right = document.createElement("div");
      right.textContent = c.desc;
      if (c.levels?.length) {
        right.append(document.createElement("br"),
          Object.assign(document.createElement("span"), { className: "lv", textContent: "Værdier: " + c.levels.join(", ") }));
      }
      if (c.n_na > 0) {
        right.append(" ", Object.assign(document.createElement("span"), {
          className: "lv", textContent: `(${c.n_na.toLocaleString("da-DK")} mangler)` }));
      }
      row.append(left, right);
      box.append(row);
    }
    list.append(box);
  }
}
function shortType(t) {
  return { numeric: "num", integer: "int", character: "chr", logical: "lgl", factor: "fct", ordered: "ord", Date: "dato" }[t] ?? t;
}
$("var-search").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  for (const row of document.querySelectorAll(".var")) row.hidden = q && !row.dataset.search.includes(q);
});

// --------------------------------------------------------- examples/tabs ----
function renderExamples() {
  const list = $("example-list");
  for (const ex of EKSEMPLER) {
    const b = document.createElement("button");
    b.className = "example";
    b.append(Object.assign(document.createElement("b"), { textContent: ex.titel }),
             Object.assign(document.createElement("span"), { textContent: ex.tekst }));
    b.onclick = () => { editor.set(ex.kode); run(); };
    list.append(b);
  }
}
for (const tab of document.querySelectorAll("[role=tab]")) {
  tab.onclick = () => {
    for (const t of document.querySelectorAll("[role=tab]")) {
      t.setAttribute("aria-selected", String(t === tab));
      $("tab-" + t.dataset.tab).hidden = t !== tab;
    }
  };
}

// --------------------------------------------------------- Neon gallery -----
const NEON = NEON_URL ? neonUrls(NEON_URL) : null;
function neonUrls(baseUrl) {
  // Same derivation as @neon/neon-js: insert "neonauth"/"apirest" after the
  // first hostname label and append /auth or /rest/v1 to the path.
  const u = new URL(baseUrl);
  const [first, ...rest] = u.hostname.split(".");
  const path = u.pathname.replace(/\/$/, "");
  const port = u.port ? `:${u.port}` : "";
  return {
    auth: `${u.protocol}//${[first, "neonauth", ...rest].join(".")}${port}${path}/auth`,
    rest: `${u.protocol}//${[first, "apirest", ...rest].join(".")}${port}${path}/rest/v1`,
  };
}
let tokenCache = null;
async function anonToken() {
  if (tokenCache && Date.now() < tokenCache.expires - 30_000) return tokenCache.token;
  const r = await fetch(NEON.auth + "/token/anonymous");
  if (!r.ok) throw new Error(`Kunne ikke få adgang til galleriet (HTTP ${r.status})`);
  const j = await r.json();
  tokenCache = { token: j.token, expires: j.expires_at > 1e12 ? j.expires_at : j.expires_at * 1000 };
  return j.token;
}
async function neon(path, options = {}) {
  const token = await anonToken();
  const r = await fetch(NEON.rest + path, {
    ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers ?? {}) } });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
}

async function loadGallery() {
  const box = $("gallery");
  try {
    const rows = await (await neon(
      "/indsendelser?select=id,created_at,navn,titel,kode,billede&order=created_at.desc&limit=300")).json();
    box.textContent = "";
    if (!rows.length) {
      box.append(Object.assign(document.createElement("p"), {
        className: "empty", textContent: "Ingen figurer endnu. Bliv den første!" }));
      return;
    }
    for (const row of rows) {
      gallery.set(String(row.id), row);
      const card = document.createElement("button");
      card.className = "card";
      card.dataset.id = row.id;
      const img = Object.assign(document.createElement("img"), { src: row.billede, alt: row.titel, loading: "lazy" });
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.append(Object.assign(document.createElement("b"), { textContent: row.titel }),
                  Object.assign(document.createElement("span"), { textContent: row.navn }));
      card.append(img, meta);
      card.onclick = () => openItem(row);
      box.append(card);
    }
  } catch (err) {
    box.textContent = "";
    box.append(Object.assign(document.createElement("p"), {
      className: "empty", textContent: `Galleriet kunne ikke hentes. ${err.message}` }));
  }
}

function openItem(row) {
  $("item-img").src = row.billede;
  $("item-img").alt = row.titel;
  $("item-title").textContent = row.titel;
  $("item-by").textContent = `${row.navn} · ${new Date(row.created_at).toLocaleDateString("da-DK")}`;
  $("item-code").textContent = row.kode;
  $("item-open").onclick = () => {
    editor.set(row.kode);
    $("item-dialog").close();
    window.scrollTo({ top: 0, behavior: "smooth" });
    run();
  };
  $("item-dialog").showModal();
}
$("item-close").onclick = () => $("item-dialog").close();

function snapshot(maxWidth = 1000) {
  const bmp = images[imageIndex];
  const scale = Math.min(1, maxWidth / bmp.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  let url = c.toDataURL("image/webp", 0.85);
  if (!url.startsWith("data:image/webp")) url = c.toDataURL("image/jpeg", 0.88);
  return url;
}

async function submissionHash() {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("boligdata-indsend:" + password));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

$("submit").onclick = () => {
  if (!images.length || lastPlotCode === null) return;
  $("submit-preview").src = snapshot();
  $("submit-code").textContent = lastPlotCode;
  $("submit-name").value = store.get("boligdata:navn") ?? "";
  $("submit-error").hidden = true;
  $("submit-send").disabled = false;
  $("submit-send").textContent = "Indsend";
  $("submit-dialog").showModal();
};
$("submit-cancel").onclick = () => $("submit-dialog").close();
$("submit-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const send = $("submit-send");
  send.disabled = true;
  send.textContent = "Sender …";
  $("submit-error").hidden = true;
  const navn = $("submit-name").value.trim();
  store.set("boligdata:navn", navn);
  try {
    await neon("/indsendelser", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        navn, titel: $("submit-title").value.trim(), kode: lastPlotCode,
        billede: $("submit-preview").src, kursuskode: await submissionHash(),
      }),
    });
    send.textContent = "Tak! Sendt til godkendelse ✓";
    $("submit-title").value = "";
    setTimeout(() => $("submit-dialog").close(), 1600);
  } catch (err) {
    $("submit-error").textContent = `Det gik ikke: ${err.message}`;
    $("submit-error").hidden = false;
    send.disabled = false;
    send.textContent = "Prøv igen";
  }
});

// ------------------------------------------------------------------ main ----
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !document.querySelector("dialog[open]")) {
    e.preventDefault();
    run();
  }
});

(async function main() {
  if (!NEON) {
    $("gallery-section").hidden = true;
    $("submit").hidden = true;
  } else {
    loadGallery();
  }
  renderExamples();
  loadVariables().catch((err) => { $("var-list").textContent = `Kunne ikke hente variabelliste: ${err.message}`; });
  await makeEditor();
  const rStart = startR();
  rStart.catch(() => {});   // reported below
  try {
    const plain = await unlock();
    await rStart;
    setStatus("Indlæser data …");
    await webR.FS.writeFile(RDS_PATH, plain);
    await webR.evalRVoid(R_LOAD);
    ready = true;
    $("run").disabled = false;
    setStatus("Klar", "ready");
    run();
  } catch (err) {
    console.error(err);
    setStatus("Fejl ved start", "error");
    log(`Kunne ikke starte: ${err.message}\nPrøv at genindlæse siden. Virker det stadig ikke, så prøv en anden browser (Chrome, Firefox, Edge eller Safari i en nyere version).`, "error");
  }
})();
