/* ============================================================
   HATTA SAFETY — app.js
   Login, tabs, dashboard, reporte rápido, lista de observaciones.
   Mismo patrón que HATTA YMS: funciones globales + Supabase.
   ============================================================ */

const sb = supabase.createClient(
  SAFETY_CONFIG.SUPABASE_URL,
  SAFETY_CONFIG.SUPABASE_ANON_KEY
);

// Estado del reporte en curso
const rep = { tipo: null, riesgo: "medio", foto: null, gps: null };
let perfilActual = null;

/* ============================================================
   ARRANQUE
   ============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  lucide.createIcons();

  if (SAFETY_CONFIG.SUPABASE_URL.includes("TU-PROYECTO")) {
    mostrarErrorLogin("Falta configurar js/config.js con tus claves de Supabase.");
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  if (session) await entrarApp();
});

/* ============================================================
   AUTENTICACIÓN
   ============================================================ */
async function login() {
  const email = document.getElementById("lf-user").value.trim();
  const pass  = document.getElementById("lf-pass").value;
  if (!email || !pass) return mostrarErrorLogin("Escribe tu correo y contraseña.");

  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) return mostrarErrorLogin("Correo o contraseña incorrectos.");

  await entrarApp();
}

function mostrarErrorLogin(msg) {
  const el = document.getElementById("lf-error");
  el.textContent = msg;
  el.style.display = "block";
}

async function logout() {
  await sb.auth.signOut();
  location.reload();
}

async function entrarApp() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  const { data: perfil } = await sb
    .from("perfiles")
    .select("nombre, rol, empresa_id, empresas(nombre)")
    .eq("id", user.id)
    .single();

  if (!perfil) {
    mostrarErrorLogin("Tu usuario no tiene perfil. Pide al administrador que te registre.");
    await sb.auth.signOut();
    return;
  }

  perfilActual = perfil;
  document.getElementById("hdr-usuario").textContent = perfil.nombre;
  document.getElementById("hdr-empresa").textContent =
    perfil.empresas?.nombre ?? "Empresa";

  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app").style.display = "flex";
  lucide.createIcons();

  iniciarGPS();
  cargarDashboard();
}

/* ============================================================
   TABS
   ============================================================ */
function cambiarTab(nombre) {
  document.querySelectorAll(".tab-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === nombre));
  document.querySelectorAll(".tab-content").forEach(c =>
    c.classList.toggle("active", c.id === "tab-" + nombre));

  if (nombre === "dashboard") cargarDashboard();
  if (nombre === "observaciones") cargarObservaciones();
}

/* ============================================================
   DASHBOARD
   ============================================================ */
const MESES = ["enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre"];

async function cargarDashboard() {
  const hoy = new Date();
  document.getElementById("dash-mes").textContent =
    "Panel · " + MESES[hoy.getMonth()] + " " + hoy.getFullYear();

  const { data: k, error } = await sb.from("v_dashboard_kpis").select("*").single();
  if (error || !k) {
    toast("No se pudieron cargar los KPIs. Revisa tu conexión.", "error");
    return;
  }

  setKpi("kpi-incidentes",    k.incidentes_mes);
  setKpi("kpi-observaciones", k.observaciones_mes);
  setKpi("kpi-actos",         k.actos_inseguros_mes);
  setKpi("kpi-condiciones",   k.condiciones_inseguras_mes);
  setKpi("kpi-abiertas",      k.acciones_abiertas);
  setKpi("kpi-vencidas",      k.acciones_vencidas);

  const pct = Math.min(Number(k.cumplimiento_inspecciones) || 0, 100);
  document.getElementById("cumplimiento-txt").textContent = pct + "%";
  const bar = document.getElementById("cumplimiento-bar");
  bar.style.width = pct + "%";
  bar.style.background = pct >= 80 ? "var(--success)"
                       : pct >= 50 ? "var(--warning)" : "var(--danger)";

  cargarRecientes();
}

function setKpi(id, valor) {
  document.getElementById(id).textContent = valor ?? 0;
}

async function cargarRecientes() {
  const { data } = await sb
    .from("observaciones")
    .select("tipo, riesgo, estado, descripcion, ocurrio_en")
    .order("ocurrio_en", { ascending: false })
    .limit(5);

  pintarLista("lista-recientes", data,
    "Aún no hay observaciones. Sé el primero en reportar.");
}

/* ============================================================
   LISTA DE OBSERVACIONES
   ============================================================ */
async function cargarObservaciones() {
  const { data } = await sb
    .from("observaciones")
    .select("tipo, riesgo, estado, descripcion, ocurrio_en")
    .order("ocurrio_en", { ascending: false })
    .limit(50);

  pintarLista("lista-observaciones", data, "No hay observaciones registradas.");
}

function pintarLista(idContenedor, filas, msgVacio) {
  const cont = document.getElementById(idContenedor);
  if (!filas || filas.length === 0) {
    cont.innerHTML = '<p class="empty">' + msgVacio + "</p>";
    return;
  }
  cont.innerHTML = filas.map(o => {
    const esActo = o.tipo === "acto_inseguro";
    const fecha = new Date(o.ocurrio_en).toLocaleDateString("es-DO",
      { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    return (
      '<div class="obs-item">' +
        '<div class="obs-icon ' + (esActo ? "acto" : "condicion") + '">' +
          '<i data-lucide="' + (esActo ? "user-x" : "shield-alert") + '"></i></div>' +
        '<div class="obs-body">' +
          '<div class="obs-desc">' + escapeHtml(o.descripcion) + "</div>" +
          '<div class="obs-meta">' +
            '<span class="state-pill ' + o.estado + '">' + o.estado.replace("_", " ") + "</span>" +
            '<span class="state-pill r-' + o.riesgo + '">' + o.riesgo + "</span>" +
            "<span>" + fecha + "</span>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }).join("");
  lucide.createIcons();
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

/* ============================================================
   REPORTE RÁPIDO
   ============================================================ */
function setTipo(t) {
  rep.tipo = t;
  document.getElementById("btn-acto")
    .classList.toggle("active", t === "acto_inseguro");
  document.getElementById("btn-condicion")
    .classList.toggle("active", t === "condicion_insegura");
}

function setRiesgo(r) {
  rep.riesgo = r;
  document.querySelectorAll(".riesgo-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.riesgo === r));
}

function fotoSeleccionada(e) {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  rep.foto = f;
  const img = document.getElementById("foto-preview");
  img.src = URL.createObjectURL(f);
  img.style.display = "block";
  document.getElementById("foto-label").textContent = "Cambiar foto";
}

function iniciarGPS() {
  const el = document.getElementById("gps-status");
  if (!("geolocation" in navigator)) {
    el.innerHTML = "Sin GPS — el reporte se envía igual.";
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      rep.gps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      el.innerHTML = "📍 Ubicación capturada · " +
        rep.gps.lat.toFixed(4) + ", " + rep.gps.lng.toFixed(4);
    },
    () => { el.innerHTML = "Sin GPS — el reporte se envía igual."; },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

async function enviarReporte() {
  const desc = document.getElementById("rep-descripcion").value.trim();
  const errEl = document.getElementById("rep-error");
  errEl.style.display = "none";

  if (!rep.tipo || !desc) {
    errEl.textContent = "Selecciona el tipo y escribe una descripción breve.";
    errEl.style.display = "block";
    return;
  }

  const btn = document.getElementById("btn-enviar");
  btn.disabled = true;

  const { data: { user } } = await sb.auth.getUser();

  // 1. Guardar la observación
  const { data: obs, error } = await sb
    .from("observaciones")
    .insert({
      empresa_id: perfilActual.empresa_id,
      tipo: rep.tipo,
      riesgo: rep.riesgo,
      descripcion: desc,
      reportado_por: user.id,
      latitud: rep.gps ? rep.gps.lat : null,
      longitud: rep.gps ? rep.gps.lng : null,
    })
    .select("id")
    .single();

  if (error || !obs) {
    errEl.textContent = "No se pudo guardar. Revisa tu conexión e intenta de nuevo.";
    errEl.style.display = "block";
    btn.disabled = false;
    return;
  }

  // 2. Subir la foto como evidencia (si hay)
  if (rep.foto) {
    const ext = (rep.foto.name.split(".").pop() || "jpg").toLowerCase();
    const path = perfilActual.empresa_id + "/observaciones/" + obs.id + "." + ext;
    const { error: upErr } = await sb.storage
      .from("evidencias")
      .upload(path, rep.foto, { upsert: true });
    if (!upErr) {
      await sb.from("evidencias").insert({
        empresa_id: perfilActual.empresa_id,
        entidad_tipo: "observacion",
        entidad_id: obs.id,
        storage_path: path,
        tipo_archivo: rep.foto.type,
        subido_por: user.id,
      });
    }
  }

  // Limpiar formulario
  rep.tipo = null; rep.foto = null;
  document.getElementById("rep-descripcion").value = "";
  document.getElementById("btn-acto").classList.remove("active");
  document.getElementById("btn-condicion").classList.remove("active");
  document.getElementById("foto-preview").style.display = "none";
  document.getElementById("foto-label").textContent = "Tomar foto (opcional)";
  setRiesgo("medio");
  btn.disabled = false;

  toast("✅ Reporte enviado. Cada reporte previene un accidente.", "ok");
  cambiarTab("dashboard");
}

/* ============================================================
   TOASTS (patrón YMS)
   ============================================================ */
function toast(msg, tipo) {
  const cont = document.getElementById("toast-container");
  const t = document.createElement("div");
  t.className = "toast " + (tipo || "");
  t.textContent = msg;
  cont.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}
