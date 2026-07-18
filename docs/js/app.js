const STORAGE_CONFIG_KEY = "rv_configuracion";
const STORAGE_HISTORIAL_KEY = "rv_historial";
const STORAGE_ONBOARDING_KEY = "rv_presentacion_aceptada";
const APP_VERSION = "1.2.2";
const ADMIN_USUARIO = "admin";
const ADMIN_PASSWORD_HASH = "87ce0da4c7bdf748e0fa1271fb19271fc6a9bad70ad053ba814b4d84e0749696";

const appContent = document.getElementById("appContent");
const appHeader = document.querySelector(".app-header");
const tituloVista = document.getElementById("tituloVista");
const subtituloVista = document.getElementById("subtituloVista");
const HEADER_INICIO_TITULO = tituloVista.textContent;
const HEADER_INICIO_SUBTITULO = subtituloVista.textContent;

let vistaPreviaActual = null;
let formularioActual = null;
let valoresReporteActual = {};
let adminActual = null;
let adminTipoReporteSeleccionado = null;
let adminCampoEditandoId = null;
let adminCatalogoSeleccionado = null;
let navegacionInicializada = false;
let vistaActual = "inicio";
let paramsVistaActual = {};

const TIPOS_CAMPOS = [
    { id: 1, clave: "texto", nombre: "Texto corto" },
    { id: 2, clave: "textarea", nombre: "Texto largo" },
    { id: 3, clave: "select", nombre: "Lista desplegable" },
    { id: 4, clave: "numero", nombre: "Número" },
    { id: 5, clave: "fecha", nombre: "Fecha" },
    { id: 6, clave: "hora", nombre: "Hora" },
    { id: 7, clave: "checkbox", nombre: "Casilla" },
    { id: 8, clave: "catalogo", nombre: "Catálogo" }
];

function crearConfiguracionInicial() {
    return {
        version: 6,
        guardias: [],
        lugares: [],
        turnos: [],
        tiposReportes: [],
        catalogos: []
    };
}

function plantillaBase(nombre, variables) {
    const lineas = variables.map(variable => `*${capitalizarEtiqueta(variable.replace(/_/g, " "))}:* {{${variable}}}`).join("\n");

    return `*${nombre}*
*Fecha:* {{fecha}}
*Hora:* {{hora}}

${lineas}`;
}

function obtenerConfiguracion() {
    const raw = localStorage.getItem(STORAGE_CONFIG_KEY);

    if (!raw) {
        const inicial = crearConfiguracionInicial();
        guardarConfiguracion(inicial);
        return inicial;
    }

    const configuracion = JSON.parse(raw);
    const migrada = migrarConfiguracion(configuracion);
    guardarConfiguracion(migrada);
    return migrada;
}

async function asegurarConfiguracionInicial() {
    const rawActual = localStorage.getItem(STORAGE_CONFIG_KEY);

    if (rawActual) {
        obtenerConfiguracion();
        return;
    }

    guardarConfiguracion(crearConfiguracionInicial(), { preservarCatalogos: false });
}

async function inicializarAplicacion() {
    const configuracionExistia = Boolean(localStorage.getItem(STORAGE_CONFIG_KEY));

    try {
        await asegurarConfiguracionInicial();
    } catch (error) {
        console.error(error);
        guardarConfiguracion(crearConfiguracionInicial(), { preservarCatalogos: false });
    } finally {
        history.replaceState({ vista: "inicio", params: {} }, "");
        navegacionInicializada = true;
        if (configuracionExistia || localStorage.getItem(STORAGE_ONBOARDING_KEY) === "si") {
            localStorage.setItem(STORAGE_ONBOARDING_KEY, "si");
            mostrarInicio({ desdeHistorial: true });
        } else {
            mostrarPresentacionInicial({ desdeHistorial: true });
        }
        marcarAplicacionLista();
    }
}

function registrarNavegacion(vista, params = {}, opciones = {}) {
    vistaActual = vista;
    paramsVistaActual = params;
    programarAnimacionVista();

    if (opciones.desdeHistorial || !navegacionInicializada) {
        return;
    }

    const estadoActual = history.state || {};
    const mismosParams = JSON.stringify(estadoActual.params || {}) === JSON.stringify(params);

    if (estadoActual.vista === vista && mismosParams) {
        return;
    }

    history.pushState({ vista, params }, "");
}

function volverLogico() {
    if (vistaActual === "reporte") {
        volverAlMenuReportes({ desdeHistorial: true });
        return;
    }

    const anterior = obtenerVistaAnterior(vistaActual, paramsVistaActual);

    if (!anterior) {
        return;
    }

    renderizarVista(anterior.vista, anterior.params, { desdeHistorial: true });
    history.replaceState({ vista: anterior.vista, params: anterior.params }, "");
}

function obtenerVistaAnterior(vista, params = {}) {
    const flujo = {
        presentacion: null,
        importacionInicial: { vista: "presentacion", params: {} },
        menuReportes: { vista: "inicio", params: {} },
        reporte: { vista: "menuReportes", params: {} },
        preview: { vista: "reporte", params },
        login: { vista: "inicio", params: {} },
        adminPanel: { vista: "inicio", params: {} },
        adminFormularios: { vista: "adminPanel", params: {} },
        adminCatalogos: { vista: "adminPanel", params: {} },
        adminHistorial: { vista: "adminPanel", params: {} },
        adminDatos: { vista: "adminPanel", params: {} }
    };

    return flujo[vista] || null;
}

function renderizarVista(vista, params = {}, opciones = {}) {
    const esVistaAdmin = vista.startsWith("admin");

    if (esVistaAdmin && !sesionAdminActiva()) {
        mostrarLogin(opciones);
        return;
    }

    if (vista === "menuReportes") {
        mostrarMenuReportes(opciones);
        return;
    }

    if (vista === "presentacion") {
        mostrarPresentacionInicial(opciones);
        return;
    }

    if (vista === "importacionInicial") {
        mostrarOpcionesImportacionInicial(opciones);
        return;
    }

    if (vista === "reporte") {
        mostrarReporte(params.clave, opciones);
        return;
    }

    if (vista === "preview") {
        mostrarVistaPrevia(params.clave, opciones);
        return;
    }

    if (vista === "login") {
        mostrarLogin(opciones);
        return;
    }

    if (vista === "adminPanel") {
        mostrarPanelAdmin(opciones);
        return;
    }

    if (vista === "adminFormularios") {
        mostrarAdminFormularios(opciones);
        return;
    }

    if (vista === "adminCatalogos") {
        mostrarAdminCatalogos(opciones);
        return;
    }

    if (vista === "adminHistorial") {
        mostrarHistorialAdmin(opciones);
        return;
    }

    if (vista === "adminDatos") {
        mostrarAdminDatos(opciones);
        return;
    }

    mostrarInicio(opciones);
}

function sesionAdminActiva() {
    return Boolean(adminActual || localStorage.getItem("rv_admin_sesion") === "activa");
}

function migrarConfiguracion(configuracion) {
    configuracion.guardias = configuracion.guardias || [];
    configuracion.lugares = configuracion.lugares || [];
    configuracion.turnos = configuracion.turnos || [];
    configuracion.tiposReportes = configuracion.tiposReportes || [];

    configuracion.tiposReportes.forEach(tipo => {
        tipo.activo = tipo.activo !== false;
        tipo.campos = tipo.campos || [];
        tipo.campos.forEach(campo => {
            campo.activo = campo.activo !== false;
        });
    });

    asegurarCatalogosConfiguracion(configuracion);
    configuracion.version = 6;
    return configuracion;
}

function asegurarCatalogosConfiguracion(configuracion) {
    const mapa = new Map();

    (configuracion.catalogos || []).forEach(catalogo => {
        if (!catalogo?.clave) {
            return;
        }
        mapa.set(catalogo.clave, {
            ...mapa.get(catalogo.clave),
            ...catalogo,
            activo: catalogo.activo !== false
        });
    });

    configuracion.tiposReportes
        .flatMap(tipo => tipo.campos || [])
        .filter(campo => campo.tipo_campo === "catalogo" && campo.catalogo_origen)
        .forEach(campo => {
            if (!mapa.has(campo.catalogo_origen)) {
                mapa.set(campo.catalogo_origen, {
                    clave: campo.catalogo_origen,
                    nombre: capitalizarEtiqueta(campo.catalogo_origen.replace(/_/g, " ")),
                    activo: true,
                    sistema: false
                });
            }
        });

    configuracion.catalogos = Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    configuracion.catalogos.forEach(catalogo => {
        if (!Array.isArray(configuracion[catalogo.clave])) {
            configuracion[catalogo.clave] = [];
        }
    });
}

function guardarConfiguracion(configuracion, opciones = {}) {
    const debePreservarCatalogos = opciones.preservarCatalogos !== false;
    const rawActual = localStorage.getItem(STORAGE_CONFIG_KEY);

    if (debePreservarCatalogos && rawActual) {
        try {
            const actual = JSON.parse(rawActual);
            const clavesCatalogos = new Set([
                "guardias",
                "lugares",
                "turnos",
                ...(actual.catalogos || []).map(catalogo => catalogo.clave),
                ...(configuracion.catalogos || []).map(catalogo => catalogo.clave)
            ]);

            clavesCatalogos.forEach(clave => {
                if (Array.isArray(actual[clave]) || Array.isArray(configuracion[clave])) {
                    configuracion[clave] = fusionarCatalogo(actual[clave], configuracion[clave]);
                }
            });
        } catch (error) {
            console.error(error);
        }
    }

    localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(configuracion));
}

function fusionarCatalogo(actual = [], siguiente = []) {
    const mapa = new Map();

    actual.forEach(item => {
        mapa.set(item.id || item.nombre, item);
    });

    siguiente.forEach(item => {
        mapa.set(item.id || item.nombre, item);
    });

    return Array.from(mapa.values());
}

function obtenerHistorial() {
    return JSON.parse(localStorage.getItem(STORAGE_HISTORIAL_KEY) || "[]");
}

function guardarHistorial(historial) {
    localStorage.setItem(STORAGE_HISTORIAL_KEY, JSON.stringify(historial));
}

function normalizarClave(texto) {
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function capitalizarEtiqueta(texto = "") {
    const valor = String(texto).trim();
    return valor ? valor.charAt(0).toUpperCase() + valor.slice(1) : "";
}

function normalizarEtiquetasPlantilla(plantilla = "") {
    return plantilla.replace(/\*([^*\n{}][^*\n{}]*):\*/g, (coincidencia, etiqueta) => {
        return `*${capitalizarEtiqueta(etiqueta)}:*`;
    });
}

function actualizarFechaHora() {
    const ahora = new Date();
    const opciones = {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    };

    document.getElementById("fechaHora").textContent =
        ahora.toLocaleDateString("es-MX", opciones);
}

actualizarFechaHora();
setInterval(actualizarFechaHora, 1000);

const tiemposAnimacion = new WeakMap();
let animacionVistaProgramada = null;

function prefiereMovimientoReducido() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function animarElemento(elemento, clase, duracion = 340) {
    if (!elemento || prefiereMovimientoReducido()) {
        return;
    }

    clearTimeout(tiemposAnimacion.get(elemento));
    elemento.classList.remove(clase);
    void elemento.offsetWidth;
    elemento.classList.add(clase);

    tiemposAnimacion.set(elemento, setTimeout(() => {
        elemento.classList.remove(clase);
    }, duracion));
}

function programarAnimacionVista() {
    clearTimeout(animacionVistaProgramada);
    animacionVistaProgramada = setTimeout(() => {
        animarElemento(appContent, "view-enter");
    }, 0);
}

function marcarAplicacionLista() {
    requestAnimationFrame(() => {
        document.body.classList.add("app-ready");
    });
}

function cambiarHeader(titulo, subtitulo) {
    tituloVista.textContent = titulo;
    subtituloVista.textContent = subtitulo;
    animarElemento(appHeader, "header-enter", 300);
}

function mostrarPresentacionInicial(opciones = {}) {
    registrarNavegacion("presentacion", {}, opciones);
    cambiarHeader("Bienvenido", "Asistente de reportes por WhatsApp");
    appContent.className = "app-content onboarding-content";
    appContent.innerHTML = `
        <section class="onboarding-card">
            <div class="onboarding-mark">HOLA</div>
            <h2>Reportes más rápidos</h2>
            <p>
                Esta aplicación te ayudará a agilizar los reportes por WhatsApp: organiza los datos,
                arma el mensaje y lo deja listo para enviar.
            </p>
            <p>
                Puede importar una configuración existente para cargar sus formularios,
                catálogos y plantillas en este dispositivo.
            </p>
            <button class="btn-main-small" type="button" onclick="mostrarOpcionesImportacionInicial()">
                Aceptar
            </button>
        </section>
    `;
}

function mostrarOpcionesImportacionInicial(opciones = {}) {
    registrarNavegacion("importacionInicial", {}, opciones);
    cambiarHeader("Configuracion", "Importar o iniciar en blanco");
    appContent.className = "app-content onboarding-content";
    appContent.innerHTML = `
        <section class="onboarding-card">
            <h2>Importar configuración</h2>
            <p>
                Si ya tiene un archivo JSON de configuración, importelo ahora para activar
                los formularios de reporte.
            </p>
            <label class="btn-main-small file-button">
                Importar configuración
                <input type="file" accept="application/json" onchange="importarConfiguracion(event, { destino: 'inicio' })">
            </label>
            <button class="btn-secondary-small" type="button" onclick="continuarSinImportar()">
                Continuar sin importar
            </button>
        </section>
    `;
}

function continuarSinImportar() {
    guardarConfiguracion(crearConfiguracionInicial(), { preservarCatalogos: false });
    localStorage.setItem(STORAGE_ONBOARDING_KEY, "si");
    mostrarInicio();
}

function mostrarInicio(opciones = {}) {
    registrarNavegacion("inicio", {}, opciones);
    cambiarHeader(HEADER_INICIO_TITULO, HEADER_INICIO_SUBTITULO);
    appContent.className = "app-content home-actions";
    appContent.innerHTML = `
        <div class="home-primary">
            <div class="home-brand">
                <img src="img/logo.png" alt="Punto Textil">
            </div>

            <button class="btn-main" onclick="mostrarMenuReportes()">
                NUEVO REPORTE
            </button>
        </div>

        <div class="home-secondary">
            <label class="btn-admin file-button">
                Importar
                <input type="file" accept="application/json" onchange="importarConfiguracion(event, { destino: 'inicio' })">
            </label>

            <button class="btn-admin" onclick="mostrarLogin()">
                Administrador
            </button>
        </div>

        <span class="app-version">v. ${APP_VERSION}</span>
    `;
}

function mostrarMenuReportes(opciones = {}) {
    registrarNavegacion("menuReportes", {}, opciones);
    const configuracion = obtenerConfiguracion();
    const tipos = configuracion.tiposReportes
        .filter(tipo => tipo.activo)
        .sort((a, b) => a.orden - b.orden);

    cambiarHeader("NUEVO REPORTE", "Seleccione el tipo de reporte");
    appContent.className = "app-content menu-grid";
    appContent.innerHTML = "";

    if (tipos.length === 0) {
        appContent.innerHTML = `
            <div class="empty-state">
                <strong>Sin formularios</strong>
                <span>Importe una configuración para habilitar los tipos de reporte.</span>
            </div>
        `;
    }

    tipos.forEach(tipo => {
        const button = document.createElement("button");
        button.className = "menu-card";
        button.style.borderLeftColor = tipo.color;
        button.innerHTML = `
            <div class="emoji">${tipo.emoji || "📋"}</div>
            <span>${tipo.nombre}</span>
        `;
        button.onclick = () => mostrarReporte(tipo.clave);
        appContent.appendChild(button);
    });

    const btnVolver = document.createElement("button");
    btnVolver.className = "btn-volver";
    btnVolver.textContent = "Volver";
    btnVolver.onclick = volverLogico;
    appContent.appendChild(btnVolver);
}

function volverAlMenuReportes(opciones = {}) {
    limpiarReporteActual();
    renderizarVista("menuReportes", {}, opciones);
    history.replaceState({ vista: "menuReportes", params: {} }, "");
}

function limpiarReporteActual() {
    const clave = paramsVistaActual?.clave || formularioActual?.tipo?.clave || vistaPreviaActual?.tipo_clave;

    if (clave) {
        delete valoresReporteActual[clave];
    }

    vistaPreviaActual = null;
    formularioActual = null;
}

function mostrarReporte(clave, opciones = {}) {
    registrarNavegacion("reporte", { clave }, opciones);
    const configuracion = obtenerConfiguracion();
    const tipo = configuracion.tiposReportes.find(item => item.clave === clave && item.activo);

    if (!tipo) {
        appContent.innerHTML = `
            <div class="error-box">No fue posible cargar el formulario.</div>
            <button class="btn-volver" onclick="volverLogico()">Volver</button>
        `;
        return;
    }

    formularioActual = {
        tipo,
        campos: tipo.campos.filter(campo => campo.activo).sort((a, b) => a.orden - b.orden),
        plantilla: tipo.plantilla || ""
    };

    cambiarHeader(`${tipo.emoji || ""} ${tipo.nombre}`, "Complete la información del reporte");
    appContent.className = "app-content formulario-content";

    let html = `
        <form id="formReporte" class="form-card">
    `;

    formularioActual.campos.forEach(campo => {
        html += crearCampoHTML(campo);
    });

    html += `
        <button type="button" class="btn-main-small" onclick="generarVistaPrevia('${tipo.clave}')">
            Generar mensaje
        </button>
    </form>

    <button class="btn-volver" onclick="volverLogico()">Volver</button>
    `;

    appContent.innerHTML = html;
    restaurarValoresReporte(clave);
}

function crearCampoHTML(campo) {
    const required = campo.obligatorio ? "required" : "";
    const obligatorioTexto = campo.obligatorio ? "<small>Obligatorio</small>" : "";
    const atributos = `name="${campo.nombre_campo}" data-label="${campo.etiqueta}" data-campo-id="${campo.id}" ${required}`;

    if (campo.tipo_campo === "catalogo") {
        const elementos = obtenerElementosCatalogo(campo.catalogo_origen);

        if (elementos.length > 0) {
            const opciones = elementos.map(item => `<option value="${item.nombre}">${item.nombre}</option>`).join("");
            return `
                <div class="form-group catalogo-form-group" data-catalogo-grupo="${campo.nombre_campo}">
                    <label>${campo.etiqueta}</label>
                    <select ${atributos} onchange="actualizarCampoCatalogoOtro('${campo.nombre_campo}')">
                        <option value="">Seleccione ${nombreCatalogo(campo.catalogo_origen)}</option>
                        ${opciones}
                        <option value="__otro__">Otro</option>
                    </select>
                    <input class="catalogo-otro-input" type="text" name="${campo.nombre_campo}_otro" placeholder="Escriba otro valor" oninput="actualizarCampoCatalogoOtro('${campo.nombre_campo}')">
                    <small class="catalogo-error" data-catalogo-error="${campo.nombre_campo}"></small>
                    ${obligatorioTexto}
                </div>
            `;
        }
    }

    if (campo.tipo_campo === "select") {
        const opciones = (campo.opciones || "")
            .split("|")
            .filter(Boolean)
            .map(opcion => `<option value="${opcion}">${opcion}</option>`)
            .join("");

        return `
            <div class="form-group">
                <label>${campo.etiqueta}</label>
                <select ${atributos}>
                    <option value="">Seleccione una opción</option>
                    ${opciones}
                </select>
                ${obligatorioTexto}
            </div>
        `;
    }

    if (campo.tipo_campo === "textarea") {
        return `
            <div class="form-group">
                <label>${campo.etiqueta}</label>
                <textarea ${atributos} rows="4"></textarea>
                ${obligatorioTexto}
            </div>
        `;
    }

    if (campo.tipo_campo === "hora") {
        return crearCampoHoraHTML(campo, required, obligatorioTexto);
    }

    if (campo.tipo_campo === "fecha" || campo.tipo_campo === "numero") {
        const inputType = campo.tipo_campo === "numero" ? "number" : "date";
        return `
            <div class="form-group">
                <label>${campo.etiqueta}</label>
                <input type="${inputType}" ${atributos}>
                ${obligatorioTexto}
            </div>
        `;
    }

    if (campo.tipo_campo === "checkbox") {
        return `
            <label class="checkbox-field report-checkbox">
                <input type="checkbox" ${atributos}>
                ${campo.etiqueta}
            </label>
        `;
    }

    return `
        <div class="form-group">
            <label>${campo.etiqueta}</label>
            <input type="text" ${atributos}>
            ${obligatorioTexto}
        </div>
    `;
}

function crearCampoHoraHTML(campo, required, obligatorioTexto) {
    const horas = crearValoresNumericos(1, 12);
    const minutos = crearValoresNumericos(0, 59, { rellenar: true });
    const requerido = campo.obligatorio ? "data-required=\"true\"" : "";

    return `
        <div class="form-group time-form-group">
            <label>${campo.etiqueta}</label>
            <input type="hidden" name="${campo.nombre_campo}" data-label="${campo.etiqueta}" data-campo-id="${campo.id}">
            <div class="time-selector">
                <div class="time-part">
                    <span>Hora</span>
                    <button type="button" class="time-picker-trigger" aria-label="${campo.etiqueta}: hora" data-hora-selector data-hora-campo="${campo.nombre_campo}" data-hora-parte="hora" data-placeholder="Hora" ${requerido} onclick="alternarMenuHora(this)">
                        Hora
                    </button>
                    <div class="time-picker-menu">
                        ${crearOpcionesHoraBotones(campo.nombre_campo, "hora", horas)}
                    </div>
                </div>
                <div class="time-separator">:</div>
                <div class="time-part">
                    <span>Min</span>
                    <button type="button" class="time-picker-trigger" aria-label="${campo.etiqueta}: minutos" data-hora-selector data-hora-campo="${campo.nombre_campo}" data-hora-parte="minuto" data-placeholder="Min" ${requerido} onclick="alternarMenuHora(this)">
                        Min
                    </button>
                    <div class="time-picker-menu time-picker-menu-minutes">
                        ${crearOpcionesHoraBotones(campo.nombre_campo, "minuto", minutos)}
                    </div>
                </div>
                <div class="time-part time-period">
                    <span>AM/PM</span>
                    <button type="button" class="time-picker-trigger" aria-label="${campo.etiqueta}: periodo" data-hora-selector data-hora-campo="${campo.nombre_campo}" data-hora-parte="periodo" data-placeholder="AM/PM" ${requerido} onclick="alternarMenuHora(this)">
                        AM/PM
                    </button>
                    <div class="time-picker-menu">
                        ${crearOpcionesHoraBotones(campo.nombre_campo, "periodo", [
                            { valor: "a.m.", etiqueta: "AM" },
                            { valor: "p.m.", etiqueta: "PM" }
                        ])}
                    </div>
                </div>
            </div>
            <small class="time-error" data-hora-error="${campo.nombre_campo}"></small>
            ${obligatorioTexto}
        </div>
    `;
}

function crearValoresNumericos(inicio, fin, opcionesConfig = {}) {
    const valores = [];

    for (let numero = inicio; numero <= fin; numero += 1) {
        const valor = opcionesConfig.rellenar ? String(numero).padStart(2, "0") : String(numero);
        valores.push({ valor, etiqueta: valor });
    }

    return valores;
}

function crearOpcionesHoraBotones(nombreCampo, parte, opciones) {
    return opciones.map(opcion => `
        <button type="button" class="time-picker-option" data-hora-opcion data-hora-campo="${nombreCampo}" data-hora-parte="${parte}" data-valor="${opcion.valor}" data-etiqueta="${opcion.etiqueta}" onclick="seleccionarParteHora(this)">
            ${opcion.etiqueta}
        </button>
    `).join("");
}

function alternarMenuHora(trigger) {
    const parte = trigger.closest(".time-part");
    const estabaAbierto = parte.classList.contains("open");

    cerrarMenusHora();

    if (!estabaAbierto) {
        parte.classList.add("open");
    }
}

function cerrarMenusHora() {
    document.querySelectorAll(".time-part.open").forEach(parte => {
        parte.classList.remove("open");
    });
}

function seleccionarParteHora(opcion) {
    const form = document.getElementById("formReporte");
    const nombreCampo = opcion.dataset.horaCampo;
    const parte = opcion.dataset.horaParte;
    const trigger = Array.from(form.querySelectorAll("[data-hora-selector]"))
        .find(elemento => elemento.dataset.horaCampo === nombreCampo && elemento.dataset.horaParte === parte);

    if (!trigger) {
        return;
    }

    aplicarParteHora(trigger, opcion.dataset.valor, opcion.dataset.etiqueta);
    cerrarMenusHora();
    actualizarCampoHora(nombreCampo);
}

function aplicarParteHora(trigger, valor, etiqueta = valor) {
    trigger.dataset.valor = valor || "";
    trigger.textContent = etiqueta || trigger.dataset.placeholder;
    trigger.classList.toggle("has-value", Boolean(valor));

    const parte = trigger.dataset.horaParte;
    const nombreCampo = trigger.dataset.horaCampo;
    const opciones = document.querySelectorAll(`[data-hora-opcion][data-hora-campo="${nombreCampo}"][data-hora-parte="${parte}"]`);
    opciones.forEach(opcion => {
        opcion.classList.toggle("active", opcion.dataset.valor === valor);
    });
}

function actualizarCampoHora(nombreCampo) {
    const form = document.getElementById("formReporte");

    if (!form) {
        return;
    }

    const campo = obtenerCampoFormulario(form, nombreCampo);
    const hora = obtenerParteHora(form, nombreCampo, "hora");
    const minuto = obtenerParteHora(form, nombreCampo, "minuto");
    const periodo = obtenerParteHora(form, nombreCampo, "periodo");

    if (campo) {
        campo.value = hora && minuto && periodo ? `${hora}:${minuto} ${periodo}` : "";
    }
}

function actualizarCamposHoraFormulario(form) {
    formularioActual.campos
        .filter(campo => campo.tipo_campo === "hora")
        .forEach(campo => actualizarCampoHora(campo.nombre_campo));
}

function validarCamposHoraFormulario(form) {
    const camposHora = formularioActual.campos.filter(campo => campo.tipo_campo === "hora" && campo.obligatorio);
    let esValido = true;

    camposHora.forEach(campo => {
        const valor = obtenerCampoFormulario(form, campo.nombre_campo)?.value || "";
        const error = form.querySelector(`[data-hora-error="${campo.nombre_campo}"]`);
        const selector = error?.closest(".time-form-group")?.querySelector(".time-selector");

        if (!valor) {
            esValido = false;
            if (error) {
                error.textContent = "Seleccione hora, minutos y AM/PM.";
            }
            selector?.classList.add("time-selector-error");
        } else {
            if (error) {
                error.textContent = "";
            }
            selector?.classList.remove("time-selector-error");
        }
    });

    return esValido;
}

function actualizarCampoCatalogoOtro(nombreCampo) {
    const form = document.getElementById("formReporte");

    if (!form) {
        return;
    }

    const select = obtenerCampoFormulario(form, nombreCampo);
    const inputOtro = obtenerCampoFormulario(form, `${nombreCampo}_otro`);
    const grupo = select?.closest(".catalogo-form-group");

    if (!select || !inputOtro || !grupo) {
        return;
    }

    const esOtro = select.value === "__otro__";
    grupo.classList.toggle("catalogo-otro-activo", esOtro);
    inputOtro.required = esOtro && select.required;

    if (!esOtro) {
        inputOtro.value = "";
        limpiarErrorCatalogo(form, nombreCampo);
    }
}

function validarCamposCatalogoFormulario(form) {
    const camposCatalogo = formularioActual.campos.filter(campo => campo.tipo_campo === "catalogo");
    let esValido = true;

    camposCatalogo.forEach(campo => {
        const select = obtenerCampoFormulario(form, campo.nombre_campo);
        const inputOtro = obtenerCampoFormulario(form, `${campo.nombre_campo}_otro`);

        if (!select || select.value !== "__otro__") {
            limpiarErrorCatalogo(form, campo.nombre_campo);
            return;
        }

        if (!inputOtro?.value.trim()) {
            esValido = false;
            mostrarErrorCatalogo(form, campo.nombre_campo, "Escriba el valor para Otro.");
        } else {
            limpiarErrorCatalogo(form, campo.nombre_campo);
        }
    });

    return esValido;
}

function obtenerValorCampoReporte(form, formData, campoConfig) {
    if (campoConfig.tipo_campo === "checkbox") {
        const campo = obtenerCampoFormulario(form, campoConfig.nombre_campo);
        return campo.checked ? "Si" : "No";
    }

    if (campoConfig.tipo_campo === "catalogo") {
        const valorCatalogo = formData.get(campoConfig.nombre_campo);

        if (valorCatalogo === "__otro__") {
            return (formData.get(`${campoConfig.nombre_campo}_otro`) || "").trim();
        }

        return valorCatalogo;
    }

    return formData.get(campoConfig.nombre_campo);
}

function mostrarErrorCatalogo(form, nombreCampo, mensaje) {
    const error = form.querySelector(`[data-catalogo-error="${nombreCampo}"]`);
    const grupo = error?.closest(".catalogo-form-group");

    if (error) {
        error.textContent = mensaje;
    }
    grupo?.classList.add("catalogo-error-activo");
}

function limpiarErrorCatalogo(form, nombreCampo) {
    const error = form.querySelector(`[data-catalogo-error="${nombreCampo}"]`);
    const grupo = error?.closest(".catalogo-form-group");

    if (error) {
        error.textContent = "";
    }
    grupo?.classList.remove("catalogo-error-activo");
}

function obtenerCampoFormulario(form, nombreCampo) {
    return Array.from(form.elements).find(elemento => elemento.name === nombreCampo);
}

function obtenerParteHora(form, nombreCampo, parte) {
    const selector = Array.from(form.querySelectorAll("[data-hora-selector]"))
        .find(elemento => elemento.dataset.horaCampo === nombreCampo && elemento.dataset.horaParte === parte);

    return selector?.dataset.valor || "";
}

function obtenerElementosCatalogo(catalogoOrigen) {
    const configuracion = obtenerConfiguracion();
    const catalogo = configuracion[catalogoOrigen] || [];
    return catalogo.filter(item => item.activo);
}

function nombreCatalogo(catalogoOrigen) {
    const configuracion = obtenerConfiguracion();
    const catalogo = configuracion.catalogos?.find(item => item.clave === catalogoOrigen);

    return catalogo?.nombre?.toLowerCase() || "opción";
}

function generarVistaPrevia(clave) {
    const form = document.getElementById("formReporte");
    actualizarCamposHoraFormulario(form);

    if (!validarCamposHoraFormulario(form) || !validarCamposCatalogoFormulario(form) || !form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const formData = new FormData(form);
    const respuestas = [];
    const valores = {};

    formularioActual.campos.forEach(campoConfig => {
        const valorFinal = obtenerValorCampoReporte(form, formData, campoConfig);

        valores[campoConfig.nombre_campo] = valorFinal || "";
        respuestas.push({
            campo_reporte_id: campoConfig.id,
            nombre_campo: campoConfig.nombre_campo,
            etiqueta: campoConfig.etiqueta,
            valor: valorFinal || ""
        });
    });
    valoresReporteActual[clave] = valores;

    const mensajeTexto = formularioActual.plantilla
        ? renderizarPlantillaWhatsApp(formularioActual.plantilla, clave, valores)
        : construirMensajeAutomatico(clave, respuestas);

    vistaPreviaActual = {
        tipo_clave: clave,
        tipo_nombre: formularioActual.tipo.nombre,
        mensaje_whatsapp: mensajeTexto,
        valores
    };

    registrarNavegacion("preview", { clave });
    renderizarVistaPrevia(clave, mensajeTexto);
}

function mostrarVistaPrevia(clave, opciones = {}) {
    registrarNavegacion("preview", { clave }, opciones);

    if (!vistaPreviaActual || vistaPreviaActual.tipo_clave !== clave) {
        mostrarReporte(clave, { desdeHistorial: true });
        return;
    }

    renderizarVistaPrevia(clave, vistaPreviaActual.mensaje_whatsapp);
}

function renderizarVistaPrevia(clave, mensajeTexto) {
    appContent.className = "app-content";
    appContent.innerHTML = `
        <div class="preview-card">
            <h3>Vista previa</h3>
            <p>${mensajeTexto.replace(/\n/g, "<br>")}</p>
        </div>

        <button class="btn-main-small" id="btnWhatsApp" onclick="abrirWhatsApp()">
            Abrir WhatsApp
        </button>

        <button class="btn-volver" onclick="editarReporteDesdeVistaPrevia('${clave}')">
            Editar
        </button>

        <button class="btn-menu-reporte" type="button" onclick="volverAlMenuReportes()">
            Menu
        </button>
    `;
}

function editarReporteDesdeVistaPrevia(clave) {
    volverLogico();
}

function restaurarValoresReporte(clave) {
    const valores = valoresReporteActual[clave];
    const form = document.getElementById("formReporte");

    if (!valores || !form) {
        return;
    }

    formularioActual.campos.forEach(campoConfig => {
        const campo = obtenerCampoFormulario(form, campoConfig.nombre_campo);

        if (!campo) {
            return;
        }

        const valor = valores[campoConfig.nombre_campo] || "";

        if (campoConfig.tipo_campo === "checkbox") {
            campo.checked = valor === "Si";
            return;
        }

        if (campoConfig.tipo_campo === "hora") {
            restaurarCampoHora(form, campoConfig.nombre_campo, valor);
            return;
        }

        if (campoConfig.tipo_campo === "catalogo") {
            restaurarCampoCatalogo(form, campoConfig.nombre_campo, valor);
            return;
        }

        campo.value = valor;
    });
}

function restaurarCampoCatalogo(form, nombreCampo, valor) {
    const select = obtenerCampoFormulario(form, nombreCampo);
    const inputOtro = obtenerCampoFormulario(form, `${nombreCampo}_otro`);

    if (!select) {
        return;
    }

    const existeOpcion = Array.from(select.options).some(opcion => opcion.value === valor);

    if (valor && !existeOpcion && inputOtro) {
        select.value = "__otro__";
        inputOtro.value = valor;
    } else {
        select.value = valor;
    }

    actualizarCampoCatalogoOtro(nombreCampo);
}

function restaurarCampoHora(form, nombreCampo, valor) {
    const horaNormalizada = normalizarHoraParaSelector(valor);
    const campo = obtenerCampoFormulario(form, nombreCampo);
    const selectorHora = Array.from(form.querySelectorAll("[data-hora-selector]"))
        .find(elemento => elemento.dataset.horaCampo === nombreCampo && elemento.dataset.horaParte === "hora");
    const selectorMinuto = Array.from(form.querySelectorAll("[data-hora-selector]"))
        .find(elemento => elemento.dataset.horaCampo === nombreCampo && elemento.dataset.horaParte === "minuto");
    const selectorPeriodo = Array.from(form.querySelectorAll("[data-hora-selector]"))
        .find(elemento => elemento.dataset.horaCampo === nombreCampo && elemento.dataset.horaParte === "periodo");

    if (campo) {
        campo.value = horaNormalizada.valor;
    }

    if (selectorHora) {
        aplicarParteHora(selectorHora, horaNormalizada.hora);
    }

    if (selectorMinuto) {
        aplicarParteHora(selectorMinuto, horaNormalizada.minuto);
    }

    if (selectorPeriodo) {
        const etiquetaPeriodo = horaNormalizada.periodo
            ? (horaNormalizada.periodo === "a.m." ? "AM" : "PM")
            : "";
        aplicarParteHora(selectorPeriodo, horaNormalizada.periodo, etiquetaPeriodo);
    }
}

function normalizarHoraParaSelector(valor) {
    const vacia = { hora: "", minuto: "", periodo: "", valor: "" };

    if (!valor) {
        return vacia;
    }

    const horaConPeriodo = valor.match(/^(\d{1,2}):(\d{2})\s*(a\.m\.|p\.m\.)$/i);

    if (horaConPeriodo) {
        const hora = String(Number(horaConPeriodo[1]));
        const minuto = horaConPeriodo[2];
        const periodo = horaConPeriodo[3].toLowerCase();
        return { hora, minuto, periodo, valor: `${hora}:${minuto} ${periodo}` };
    }

    const horaVeinticuatro = valor.match(/^(\d{1,2}):(\d{2})$/);

    if (!horaVeinticuatro) {
        return vacia;
    }

    const horaNumero = Number(horaVeinticuatro[1]);
    const minuto = horaVeinticuatro[2];
    const periodo = horaNumero >= 12 ? "p.m." : "a.m.";
    const hora = horaNumero === 0 ? "12" : horaNumero > 12 ? String(horaNumero - 12) : String(horaNumero);

    return { hora, minuto, periodo, valor: `${hora}:${minuto} ${periodo}` };
}

function construirMensajeAutomatico(clave, respuestas) {
    const tipoNombre = formularioActual?.tipo?.nombre || clave.toUpperCase();
    const respuestaHora = respuestas.find(respuesta => respuesta.nombre_campo === "hora");
    let mensaje = `*${tipoNombre}*\n`;
    mensaje += `*Fecha:* ${new Date().toLocaleDateString("es-MX")}\n`;
    mensaje += `*Hora:* ${respuestaHora?.valor || obtenerHoraActual12()}\n\n`;

    respuestas.forEach(respuesta => {
        mensaje += `*${respuesta.etiqueta}:* ${respuesta.valor}\n`;
    });

    return mensaje;
}

function renderizarPlantillaWhatsApp(plantilla, clave, valores) {
    const variables = {
        ...valores,
        fecha: new Date().toLocaleDateString("es-MX"),
        hora: valores.hora || obtenerHoraActual12(),
        tipo_reporte: formularioActual?.tipo?.nombre || clave.toUpperCase()
    };

    return plantilla.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (coincidencia, variable) => {
        return variables[variable] ?? "";
    });
}

function obtenerHoraActual12() {
    return new Date().toLocaleTimeString("es-MX", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    }).toLowerCase();
}

function abrirWhatsApp() {
    if (!vistaPreviaActual) {
        return;
    }

    guardarHistorialReporte(vistaPreviaActual);
    window.open(`https://wa.me/?text=${encodeURIComponent(vistaPreviaActual.mensaje_whatsapp)}`, "_blank");

    const btnWhatsApp = document.getElementById("btnWhatsApp");
    if (btnWhatsApp) {
        btnWhatsApp.textContent = "Registro guardado";
    }
}

function guardarHistorialReporte(reporte) {
    const historial = obtenerHistorial();
    historial.unshift({
        id: Date.now(),
        tipo_clave: reporte.tipo_clave,
        tipo_nombre: reporte.tipo_nombre,
        fecha: new Date().toISOString()
    });
    guardarHistorial(historial.slice(0, 200));
}

function mostrarLogin(opciones = {}) {
    registrarNavegacion("login", {}, opciones);
    cambiarHeader("ADMINISTRADOR", "Inicio de sesión local");
    appContent.className = "app-content";
    appContent.innerHTML = `
        <form id="formLoginAdmin" class="login-card">
            <label>Usuario</label>
            <input type="text" name="usuario" placeholder="Usuario" autocomplete="username" required>

            <label>Contraseña</label>
            <input type="password" name="password" placeholder="Contraseña" autocomplete="current-password" required>

            <button type="submit" class="btn-main-small">Ingresar</button>
        </form>

        <button class="btn-volver" onclick="volverLogico()">Volver</button>
    `;

    document.getElementById("formLoginAdmin").addEventListener("submit", iniciarSesionAdmin);
}

async function iniciarSesionAdmin(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const usuario = formData.get("usuario");
    const password = formData.get("password");
    const passwordHash = await generarHashSha256(password);

    if (usuario !== ADMIN_USUARIO || passwordHash !== ADMIN_PASSWORD_HASH) {
        mostrarMensajeLogin("Usuario o contraseña incorrectos.");
        return;
    }

    adminActual = { usuario: ADMIN_USUARIO, nombre: "Administrador" };
    localStorage.setItem("rv_admin_sesion", "activa");
    mostrarPanelAdmin();
}

async function generarHashSha256(texto) {
    const bytes = new TextEncoder().encode(texto);
    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hashBuffer))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

function mostrarMensajeLogin(mensaje) {
    const anterior = document.querySelector(".login-message");

    if (anterior) {
        anterior.remove();
    }

    const alerta = document.createElement("div");
    alerta.className = "login-message";
    alerta.textContent = mensaje;
    document.getElementById("formLoginAdmin").appendChild(alerta);
}

function mostrarPanelAdmin(opciones = {}) {
    registrarNavegacion("adminPanel", {}, opciones);
    cambiarHeader("ADMINISTRADOR", "Configuración local offline");
    appContent.className = "app-content admin-panel";
    appContent.innerHTML = `
        <button class="admin-card" type="button" onclick="mostrarAdminFormularios()">
            <span>Formularios</span>
            <small>Tipos de reporte, campos y plantilla de WhatsApp</small>
        </button>

        <button class="admin-card" type="button" onclick="mostrarAdminCatalogos()">
            <span>Catálogos</span>
            <small>Listas disponibles para los formularios importados</small>
        </button>

        <button class="admin-card" type="button" onclick="mostrarHistorialAdmin()">
            <span>Historial</span>
            <small>Solo tipo de registro y fecha/hora</small>
        </button>

        <button class="admin-card" type="button" onclick="mostrarAdminDatos()">
            <span>Datos</span>
            <small>Exportar, importar o restaurar configuración</small>
        </button>

        <button class="btn-volver" onclick="cerrarSesionAdmin()">Cerrar sesión</button>
    `;
}

function mostrarAdminFormularios(opciones = {}) {
    registrarNavegacion("adminFormularios", {}, opciones);
    const configuracion = obtenerConfiguracion();
    adminTipoReporteSeleccionado = adminTipoReporteSeleccionado || configuracion.tiposReportes[0]?.id;
    renderAdminFormularios();
}

function renderAdminFormularios() {
    const configuracion = obtenerConfiguracion();
    const tipo = configuracion.tiposReportes.find(item => item.id === Number(adminTipoReporteSeleccionado) && item.activo)
        || configuracion.tiposReportes.find(item => item.activo);

    adminTipoReporteSeleccionado = tipo?.id || null;

    cambiarHeader("Formularios", "Diseño local del mensaje");
    appContent.className = "app-content admin-formularios";

    const opcionesTipos = configuracion.tiposReportes.filter(item => item.activo).map(item => `
        <option value="${item.id}" ${item.id === adminTipoReporteSeleccionado ? "selected" : ""}>
            ${item.nombre}
        </option>
    `).join("");

    appContent.innerHTML = `
        <div class="admin-toolbar">
            <select id="adminTipoReporteSelect">${opcionesTipos}</select>
            <button class="btn-secondary-small" type="button" onclick="agregarTipoReporteAdmin()">Nuevo tipo</button>
        </div>

        ${tipo ? renderEditorTipoReporte(tipo) : ""}
        ${tipo ? renderListaCamposAdmin(tipo) : ""}
        ${tipo ? renderEditorPlantillaAdmin(tipo) : ""}
        ${tipo ? renderEditorCampoAdmin(tipo) : ""}

        <button class="btn-volver" onclick="volverLogico()">Volver</button>
    `;

    document.getElementById("adminTipoReporteSelect")?.addEventListener("change", event => {
        adminTipoReporteSeleccionado = Number(event.target.value);
        adminCampoEditandoId = null;
        renderAdminFormularios();
    });

    document.getElementById("formAdminTipo")?.addEventListener("submit", guardarTipoReporteAdmin);
    document.getElementById("formAdminPlantilla")?.addEventListener("submit", guardarPlantillaAdmin);
    document.getElementById("formAdminCampo")?.addEventListener("submit", guardarCampoAdmin);
    document.querySelector("#formAdminCampo select[name='tipo_campo']")?.addEventListener("change", actualizarVisibilidadOpcionesCampo);
    inicializarArrastreCamposAdmin();
    actualizarVisibilidadOpcionesCampo();
}

function renderEditorTipoReporte(tipo) {
    return `
        <form id="formAdminTipo" class="form-card">
            <div class="form-row">
                <div class="form-group compact">
                    <label>Nombre</label>
                    <input type="text" name="nombre" value="${tipo.nombre}" required>
                </div>
                <div class="form-group compact">
                    <label>Orden</label>
                    <input type="number" name="orden" value="${tipo.orden || 0}" min="0">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group compact">
                    <label>Icono</label>
                    <input type="text" name="emoji" value="${tipo.emoji || ""}">
                </div>
                <div class="form-group compact">
                    <label>Color</label>
                    <input type="color" name="color" value="${tipo.color || "#198754"}">
                </div>
            </div>
            <button class="btn-main-small" type="submit">Guardar tipo</button>
            <button class="btn-secondary-small" type="button" onclick="desactivarTipoReporteAdmin(${tipo.id})">Eliminar formulario</button>
        </form>
    `;
}

function renderListaCamposAdmin(tipo) {
    const campos = tipo.campos.filter(campo => campo.activo).sort((a, b) => a.orden - b.orden);

    if (campos.length === 0) {
        return `<div class="info-card">Este formulario aún no tiene campos.</div>`;
    }

    return `
        <div class="admin-list" id="adminCamposList">
            ${campos.map(campo => `
                <div class="admin-field-card ${esCampoHoraFija(campo) ? "admin-field-fixed" : "admin-field-draggable"}" data-campo-id="${campo.id}">
                    ${esCampoHoraFija(campo)
                        ? `<span class="drag-handle drag-handle-fixed" aria-label="Hora fija" title="Hora fija">H</span>`
                        : `<span class="drag-handle" role="button" aria-label="Arrastrar campo" title="Arrastrar campo">
                            <i></i>
                            <i></i>
                            <i></i>
                        </span>`}
                    <div class="admin-field-main">
                        <strong>${campo.orden}. ${campo.etiqueta}</strong>
                        <span>${campo.tipo_campo} - {{${campo.nombre_campo}}}</span>
                    </div>
                    <div class="admin-field-actions">
                        <button type="button" onclick="editarCampoAdmin(${campo.id})">Editar</button>
                        <button type="button" onclick="desactivarCampoAdmin(${campo.id})">Quitar</button>
                    </div>
                </div>
            `).join("")}
        </div>
    `;
}

function esCampoHoraFija(campo) {
    return campo.nombre_campo === "hora";
}

function renderEditorPlantillaAdmin(tipo) {
    const variables = [
        "fecha",
        "hora",
        "tipo_reporte",
        ...tipo.campos
            .filter(campo => campo.activo)
            .sort((a, b) => a.orden - b.orden)
            .map(campo => campo.nombre_campo)
    ];

    return `
        <form id="formAdminPlantilla" class="form-card">
            <div class="form-group">
                <label>Plantilla de WhatsApp</label>
                <textarea name="plantilla" id="adminPlantillaContenido" rows="8" required>${tipo.plantilla || ""}</textarea>
                <small>Use variables como {{fecha}}, {{hora}} y los nombres internos.</small>
            </div>
            <div class="variables-list">
                ${variables.map(variable => `
                    <button type="button" onclick="insertarVariablePlantilla('${variable}')">{{${variable}}}</button>
                `).join("")}
            </div>
            <button class="btn-main-small" type="submit">Guardar plantilla</button>
        </form>
    `;
}

function sincronizarPlantillaConCampos(tipo) {
    const variablesEncabezado = new Set(["tipo_reporte", "fecha", "hora"]);
    const camposActivos = tipo.campos
        .filter(campo => campo.activo)
        .filter(campo => !esCampoHoraFija(campo))
        .sort((a, b) => a.orden - b.orden);
    const nombresCampos = new Set(tipo.campos.filter(campo => !esCampoHoraFija(campo)).map(campo => campo.nombre_campo));
    const nombresActivos = new Set(camposActivos.map(campo => campo.nombre_campo));
    const lineasOriginales = (tipo.plantilla || plantillaBase(tipo.nombre, [])).split("\n");
    const lineasPorCampo = new Map();
    const lineasBase = [];
    const lineasFinales = [];
    let encontroBloqueCampos = false;

    lineasOriginales.forEach(linea => {
        const variables = Array.from(linea.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)).map(match => match[1]);
        const variableCampo = variables.find(variable => nombresCampos.has(variable));
        const variableEncabezado = variables.find(variable => variablesEncabezado.has(variable));

        if (variableEncabezado && !variableCampo) {
            lineasBase.push(linea);
            return;
        }

        if (variableCampo) {
            encontroBloqueCampos = true;

            if (nombresActivos.has(variableCampo) && !lineasPorCampo.has(variableCampo)) {
                lineasPorCampo.set(variableCampo, linea);
            }

            return;
        }

        if (encontroBloqueCampos) {
            lineasFinales.push(linea);
        } else {
            lineasBase.push(linea);
        }
    });

    while (lineasBase[lineasBase.length - 1] === "") {
        lineasBase.pop();
    }

    while (lineasFinales[0] === "") {
        lineasFinales.shift();
    }

    const lineasCampos = camposActivos.map(campo => {
        const variable = `{{${campo.nombre_campo}}}`;
        return lineasPorCampo.get(campo.nombre_campo) || `*${campo.etiqueta}:* ${variable}`;
    });

    const lineas = [
        ...lineasBase,
        ...(lineasBase.length && lineasCampos.length ? [""] : []),
        ...lineasCampos,
        ...(lineasFinales.length ? ["", ...lineasFinales] : [])
    ];

    tipo.plantilla = normalizarEtiquetasPlantilla(lineas.join("\n").replace(/\n{3,}/g, "\n\n").trim());
}

function inicializarArrastreCamposAdmin() {
    const lista = document.getElementById("adminCamposList");

    if (!lista) {
        return;
    }

    let tarjetaActiva = null;
    let ordenInicial = [];

    lista.querySelectorAll(".drag-handle:not(.drag-handle-fixed)").forEach(handle => {
        handle.addEventListener("pointerdown", event => {
            tarjetaActiva = event.currentTarget.closest(".admin-field-card");
            ordenInicial = obtenerOrdenCamposDesdeDOM();
            tarjetaActiva.classList.add("is-dragging");
            event.currentTarget.setPointerCapture(event.pointerId);
            event.preventDefault();
        });

        handle.addEventListener("pointermove", event => {
            if (!tarjetaActiva) {
                return;
            }

            const siguiente = obtenerTarjetaDespuesDePosicion(lista, event.clientY, tarjetaActiva);

            if (siguiente) {
                lista.insertBefore(tarjetaActiva, siguiente);
            } else {
                lista.appendChild(tarjetaActiva);
            }
        });

        handle.addEventListener("pointerup", event => {
            if (!tarjetaActiva) {
                return;
            }

            event.currentTarget.releasePointerCapture(event.pointerId);
            tarjetaActiva.classList.remove("is-dragging");
            tarjetaActiva = null;

            const ordenFinal = obtenerOrdenCamposDesdeDOM();
            if (ordenFinal.join(",") !== ordenInicial.join(",")) {
                guardarOrdenCamposAdmin(ordenFinal);
            }
        });

        handle.addEventListener("pointercancel", event => {
            if (!tarjetaActiva) {
                return;
            }

            event.currentTarget.releasePointerCapture(event.pointerId);
            tarjetaActiva.classList.remove("is-dragging");
            tarjetaActiva = null;
            renderAdminFormularios();
        });
    });
}

function obtenerTarjetaDespuesDePosicion(lista, posicionY, tarjetaActiva) {
    return Array.from(lista.querySelectorAll(".admin-field-draggable:not(.is-dragging)"))
        .reduce((cercana, tarjeta) => {
            const caja = tarjeta.getBoundingClientRect();
            const distancia = posicionY - caja.top - caja.height / 2;

            if (distancia < 0 && distancia > cercana.distancia) {
                return { distancia, tarjeta };
            }

            return cercana;
        }, { distancia: Number.NEGATIVE_INFINITY, tarjeta: null }).tarjeta;
}

function obtenerOrdenCamposDesdeDOM() {
    return Array.from(document.querySelectorAll("#adminCamposList [data-campo-id]"))
        .map(elemento => Number(elemento.dataset.campoId));
}

function guardarOrdenCamposAdmin(ordenIds) {
    const configuracion = obtenerConfiguracion();
    const tipo = configuracion.tiposReportes.find(item => item.id === Number(adminTipoReporteSeleccionado));

    if (!tipo) {
        return;
    }

    ordenIds.forEach((campoId, index) => {
        const campo = tipo.campos.find(item => item.id === campoId);

        if (campo) {
            campo.orden = index + 1;
        }
    });

    sincronizarPlantillaConCampos(tipo);
    guardarConfiguracion(configuracion);
    renderAdminFormularios();
}

function renderEditorCampoAdmin(tipo) {
    const campo = tipo.campos.find(item => item.id === adminCampoEditandoId) || {
        id: "",
        etiqueta: "",
        nombre_campo: "",
        tipo_campo: "texto",
        opciones: "",
        catalogo_origen: "",
        obligatorio: false,
        orden: siguienteOrden(tipo.campos),
        activo: true
    };

    return `
        <form id="formAdminCampo" class="form-card">
            <input type="hidden" name="id" value="${campo.id}">
            <div class="form-group">
                <label>Etiqueta</label>
                <input type="text" name="etiqueta" value="${campo.etiqueta}" required>
            </div>
            <div class="form-group">
                <label>Nombre interno</label>
                <input type="text" name="nombre_campo" value="${campo.nombre_campo}" placeholder="Se genera desde la etiqueta">
            </div>
            <div class="form-group">
                <label>Tipo de campo</label>
                <select name="tipo_campo">
                    ${TIPOS_CAMPOS.map(tipoCampo => `
                        <option value="${tipoCampo.clave}" ${tipoCampo.clave === campo.tipo_campo ? "selected" : ""}>
                            ${tipoCampo.nombre}
                        </option>
                    `).join("")}
                </select>
            </div>
            <div class="form-group" data-config-campo="opciones">
                <label>Opciones</label>
                <textarea name="opciones" rows="3" placeholder="Opción 1|Opción 2|Opción 3">${campo.opciones || ""}</textarea>
                <small>Solo para lista desplegable. Separe cada opción con |</small>
            </div>
            <div class="form-group" data-config-campo="catalogo">
                <label>Catálogo</label>
                <select name="catalogo_origen">
                    ${obtenerCatalogosDisponibles().map(catalogo => `
                        <option value="${catalogo.clave}" ${catalogo.clave === campo.catalogo_origen ? "selected" : ""}>
                            ${catalogo.nombre}
                        </option>
                    `).join("")}
                </select>
            </div>
            <div class="form-row">
                <label class="checkbox-field">
                    <input type="checkbox" name="obligatorio" ${campo.obligatorio ? "checked" : ""}>
                    Obligatorio
                </label>
                <div class="form-group compact">
                    <label>Orden</label>
                    <input type="number" name="orden" value="${campo.orden || 0}" min="0">
                </div>
            </div>
            <button class="btn-main-small" type="submit">Guardar campo</button>
            <button class="btn-secondary-small" type="button" onclick="nuevoCampoAdmin()">Nuevo campo</button>
        </form>
    `;
}

function obtenerCatalogosDisponibles() {
    const configuracion = obtenerConfiguracion();
    return (configuracion.catalogos || []).filter(catalogo => catalogo.activo);
}

function actualizarVisibilidadOpcionesCampo() {
    const form = document.getElementById("formAdminCampo");

    if (!form) {
        return;
    }

    const tipoCampo = form.elements.tipo_campo.value;
    const grupoOpciones = form.querySelector('[data-config-campo="opciones"]');
    const grupoCatalogo = form.querySelector('[data-config-campo="catalogo"]');

    grupoOpciones.style.display = tipoCampo === "select" ? "flex" : "none";
    grupoCatalogo.style.display = tipoCampo === "catalogo" ? "flex" : "none";
}

function guardarTipoReporteAdmin(event) {
    event.preventDefault();
    const configuracion = obtenerConfiguracion();
    const tipo = configuracion.tiposReportes.find(item => item.id === adminTipoReporteSeleccionado);
    const formData = new FormData(event.target);

    tipo.nombre = formData.get("nombre");
    tipo.clave = normalizarClave(tipo.nombre);
    tipo.emoji = formData.get("emoji");
    tipo.color = formData.get("color");
    tipo.orden = Number(formData.get("orden") || 0);

    guardarConfiguracion(configuracion);
    renderAdminFormularios();
}

function desactivarTipoReporteAdmin(tipoId) {
    const configuracion = obtenerConfiguracion();
    const activos = configuracion.tiposReportes.filter(tipo => tipo.activo);

    if (activos.length <= 1) {
        alert("Debe existir al menos un formulario activo.");
        return;
    }

    if (!confirm("Eliminar este formulario de la lista?")) {
        return;
    }

    const tipo = configuracion.tiposReportes.find(item => item.id === tipoId);
    tipo.activo = false;
    guardarConfiguracion(configuracion);
    adminTipoReporteSeleccionado = configuracion.tiposReportes.find(item => item.activo)?.id || null;
    renderAdminFormularios();
}

function guardarPlantillaAdmin(event) {
    event.preventDefault();
    const configuracion = obtenerConfiguracion();
    const tipo = configuracion.tiposReportes.find(item => item.id === adminTipoReporteSeleccionado);
    tipo.plantilla = normalizarEtiquetasPlantilla(new FormData(event.target).get("plantilla"));
    guardarConfiguracion(configuracion);
    alert("Plantilla guardada.");
}

function guardarCampoAdmin(event) {
    event.preventDefault();
    const configuracion = obtenerConfiguracion();
    const tipo = configuracion.tiposReportes.find(item => item.id === adminTipoReporteSeleccionado);
    const formData = new FormData(event.target);
    const campoId = Number(formData.get("id"));
    const etiqueta = capitalizarEtiqueta(formData.get("etiqueta"));
    const nombreCampo = normalizarClave(formData.get("nombre_campo") || etiqueta);
    const campo = campoId
        ? tipo.campos.find(item => item.id === campoId)
        : { id: siguienteIdCampo(configuracion), activo: true };

    campo.etiqueta = etiqueta;
    campo.nombre_campo = nombreCampo;
    campo.tipo_campo = formData.get("tipo_campo");
    campo.opciones = campo.tipo_campo === "select" ? formData.get("opciones") : "";
    campo.catalogo_origen = campo.tipo_campo === "catalogo" ? formData.get("catalogo_origen") : "";
    campo.obligatorio = formData.get("obligatorio") === "on";
    campo.orden = Number(formData.get("orden") || 0);

    if (!campoId) {
        tipo.campos.push(campo);
    }

    sincronizarPlantillaConCampos(tipo);
    guardarConfiguracion(configuracion);
    adminCampoEditandoId = null;
    renderAdminFormularios();
}

function editarCampoAdmin(campoId) {
    adminCampoEditandoId = campoId;
    renderAdminFormularios();
}

function nuevoCampoAdmin() {
    adminCampoEditandoId = null;
    renderAdminFormularios();
}

function desactivarCampoAdmin(campoId) {
    if (!confirm("Quitar este campo del formulario?")) {
        return;
    }

    const configuracion = obtenerConfiguracion();
    const tipo = configuracion.tiposReportes.find(item => item.id === adminTipoReporteSeleccionado);
    const campo = tipo.campos.find(item => item.id === campoId);
    campo.activo = false;
    sincronizarPlantillaConCampos(tipo);
    guardarConfiguracion(configuracion);
    renderAdminFormularios();
}

function agregarTipoReporteAdmin() {
    const nombre = prompt("Nombre del nuevo tipo de reporte");

    if (!nombre) {
        return;
    }

    const configuracion = obtenerConfiguracion();
    const nuevoTipo = {
        id: siguienteIdTipo(configuracion),
        nombre,
        clave: normalizarClave(nombre),
        emoji: "📋",
        color: "#198754",
        orden: configuracion.tiposReportes.length + 1,
        activo: true,
        campos: [],
        plantilla: `*{{tipo_reporte}}*
*Fecha:* {{fecha}}
*Hora:* {{hora}}`
    };

    configuracion.tiposReportes.push(nuevoTipo);
    guardarConfiguracion(configuracion);
    adminTipoReporteSeleccionado = nuevoTipo.id;
    renderAdminFormularios();
}

function siguienteOrden(campos) {
    return Math.max(0, ...campos.map(campo => Number(campo.orden) || 0)) + 1;
}

function siguienteIdTipo(configuracion) {
    return Math.max(0, ...configuracion.tiposReportes.map(tipo => tipo.id)) + 1;
}

function siguienteIdCampo(configuracion) {
    return Math.max(0, ...configuracion.tiposReportes.flatMap(tipo => (tipo.campos || []).map(campo => campo.id))) + 1;
}

function insertarVariablePlantilla(variable) {
    const textarea = document.getElementById("adminPlantillaContenido");
    const texto = `{{${variable}}}`;
    const inicio = textarea.selectionStart;
    const fin = textarea.selectionEnd;

    textarea.value = `${textarea.value.slice(0, inicio)}${texto}${textarea.value.slice(fin)}`;
    textarea.focus();
    textarea.selectionStart = inicio + texto.length;
    textarea.selectionEnd = inicio + texto.length;
}

function mostrarAdminCatalogos(opciones = {}) {
    registrarNavegacion("adminCatalogos", {}, opciones);
    const configuracion = obtenerConfiguracion();
    const catalogosActivos = obtenerCatalogosDisponibles();
    adminCatalogoSeleccionado = adminCatalogoSeleccionado && catalogosActivos.some(catalogo => catalogo.clave === adminCatalogoSeleccionado)
        ? adminCatalogoSeleccionado
        : catalogosActivos[0]?.clave;
    renderAdminCatalogos();
}

function renderAdminCatalogos() {
    const configuracion = obtenerConfiguracion();
    const catalogos = obtenerCatalogosDisponibles();
    const catalogo = catalogos.find(item => item.clave === adminCatalogoSeleccionado) || catalogos[0];

    adminCatalogoSeleccionado = catalogo?.clave || null;
    cambiarHeader("Catálogos", "Listas disponibles para formularios");
    appContent.className = "app-content admin-formularios";

    const opcionesCatalogos = catalogos.map(item => `
        <option value="${item.clave}" ${item.clave === adminCatalogoSeleccionado ? "selected" : ""}>
            ${item.nombre}
        </option>
    `).join("");

    appContent.innerHTML = `
        <div class="admin-toolbar">
            <select id="adminCatalogoSelect">${opcionesCatalogos}</select>
            <button class="btn-secondary-small" type="button" onclick="agregarCatalogoAdmin()">Nuevo catálogo</button>
        </div>

        ${catalogo ? renderEditorCatalogoAdmin(configuracion, catalogo) : `<div class="info-card">No hay catálogos activos.</div>`}

        <button class="btn-secondary-small" onclick="guardarJsonBaseActualizado()">Descargar JSON base actualizado</button>
        <button class="btn-volver" onclick="volverLogico()">Volver</button>
    `;

    document.getElementById("adminCatalogoSelect")?.addEventListener("change", event => {
        adminCatalogoSeleccionado = event.target.value;
        renderAdminCatalogos();
    });
    document.getElementById("formCatalogoItem")?.addEventListener("submit", guardarItemCatalogoAdmin);
}

function renderEditorCatalogoAdmin(configuracion, catalogo) {
    const elementos = (configuracion[catalogo.clave] || []).filter(item => item.activo);
    const estaEnUso = catalogoEnUso(configuracion, catalogo.clave);

    return `
        <form id="formCatalogoItem" class="form-card">
            <div class="form-group">
                <label>Nuevo elemento en ${catalogo.nombre}</label>
                <input type="text" name="nombre" required>
            </div>
            <button class="btn-main-small" type="submit">Agregar elemento</button>
        </form>

        <div class="admin-list">
            ${elementos.map(item => `
                <div class="admin-field-card">
                    <div>
                        <strong>${item.nombre}</strong>
                        <span>${catalogo.nombre}</span>
                    </div>
                    <div class="admin-field-actions">
                        <button type="button" onclick="desactivarItemCatalogo('${catalogo.clave}', ${item.id})">Quitar</button>
                    </div>
                </div>
            `).join("") || `<div class="info-card">Este catálogo no tiene elementos activos.</div>`}
        </div>

        <button class="btn-secondary-small ${estaEnUso ? "is-disabled" : ""}" type="button" onclick="eliminarCatalogoAdmin('${catalogo.clave}')">
            Eliminar catálogo
        </button>
        ${estaEnUso ? `<div class="info-card compact-info">Este catálogo está siendo usado por uno o más campos activos.</div>` : ""}
    `;
}

function agregarCatalogoAdmin() {
    const nombre = prompt("Nombre del nuevo catálogo");

    if (!nombre) {
        return;
    }

    const configuracion = obtenerConfiguracion();
    const clave = normalizarClave(nombre);

    if (!clave) {
        alert("Nombre de catálogo inválido.");
        return;
    }

    if ((configuracion.catalogos || []).some(catalogo => catalogo.clave === clave && catalogo.activo !== false)) {
        alert("Ya existe un catálogo con ese nombre.");
        return;
    }

    configuracion.catalogos = configuracion.catalogos || [];
    configuracion.catalogos.push({
        clave,
        nombre: capitalizarEtiqueta(nombre),
        activo: true,
        sistema: false
    });
    configuracion[clave] = configuracion[clave] || [];
    guardarConfiguracion(configuracion, { preservarCatalogos: false });
    adminCatalogoSeleccionado = clave;
    renderAdminCatalogos();
}

function guardarItemCatalogoAdmin(event) {
    event.preventDefault();
    const configuracion = obtenerConfiguracion();
    const formData = new FormData(event.target);
    const clave = adminCatalogoSeleccionado;

    if (!clave || !Array.isArray(configuracion[clave])) {
        return;
    }

    configuracion[clave].push({
        id: siguienteIdItemCatalogo(configuracion[clave]),
        nombre: formData.get("nombre"),
        activo: true
    });
    guardarConfiguracion(configuracion);
    renderAdminCatalogos();
}

function desactivarItemCatalogo(clave, id) {
    const configuracion = obtenerConfiguracion();
    const item = (configuracion[clave] || []).find(elemento => elemento.id === id);

    if (!item) {
        return;
    }

    item.activo = false;
    guardarConfiguracion(configuracion);
    renderAdminCatalogos();
}

function eliminarCatalogoAdmin(clave) {
    const configuracion = obtenerConfiguracion();
    const catalogo = (configuracion.catalogos || []).find(item => item.clave === clave);

    if (!catalogo) {
        return;
    }

    if (catalogoEnUso(configuracion, clave)) {
        alert("No se puede eliminar porque está asignado a campos activos. Primero cambie o quite esos campos.");
        return;
    }

    if (!confirm(`Eliminar el catálogo "${catalogo.nombre}"?`)) {
        return;
    }

    catalogo.activo = false;
    (configuracion[clave] || []).forEach(item => {
        item.activo = false;
    });
    guardarConfiguracion(configuracion, { preservarCatalogos: false });
    adminCatalogoSeleccionado = null;
    renderAdminCatalogos();
}

function catalogoEnUso(configuracion, clave) {
    return configuracion.tiposReportes.some(tipo => tipo.activo && (tipo.campos || []).some(campo => {
        return campo.activo && campo.tipo_campo === "catalogo" && campo.catalogo_origen === clave;
    }));
}

function siguienteIdItemCatalogo(items = []) {
    return Math.max(0, ...items.map(item => item.id || 0)) + 1;
}

async function guardarJsonBaseActualizado() {
    const contenido = JSON.stringify(obtenerConfiguracion(), null, 2);

    if ("showSaveFilePicker" in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: "configuracion-reportes-vigilancia.json",
                types: [{
                    description: "Archivo JSON",
                    accept: { "application/json": [".json"] }
                }]
            });
            const writable = await handle.createWritable();
            await writable.write(contenido);
            await writable.close();
            alert("JSON base actualizado.");
            return;
        } catch (error) {
            if (error.name === "AbortError") {
                return;
            }
            console.error(error);
        }
    }

    exportarConfiguracion();
}

function mostrarHistorialAdmin(opciones = {}) {
    registrarNavegacion("adminHistorial", {}, opciones);
    const historial = obtenerHistorial();
    cambiarHeader("Historial", "Registros locales");
    appContent.className = "app-content admin-formularios";
    appContent.innerHTML = `
        <div class="admin-list">
            ${historial.map(item => `
                <div class="admin-field-card">
                    <div>
                        <strong>${item.tipo_nombre}</strong>
                        <span>${new Date(item.fecha).toLocaleString("es-MX")}</span>
                    </div>
                </div>
            `).join("") || `<div class="info-card">Aún no hay historial local.</div>`}
        </div>
        <button class="btn-secondary-small" onclick="limpiarHistorial()">Limpiar historial</button>
        <button class="btn-volver" onclick="volverLogico()">Volver</button>
    `;
}

function limpiarHistorial() {
    if (confirm("Limpiar historial local?")) {
        guardarHistorial([]);
        mostrarHistorialAdmin();
    }
}

function mostrarAdminDatos(opciones = {}) {
    registrarNavegacion("adminDatos", {}, opciones);
    cambiarHeader("Datos", "Respaldo local");
    appContent.className = "app-content admin-formularios";
    appContent.innerHTML = `
        <div class="info-card">
            La configuración vive en este dispositivo. Exporte el JSON para copiarla a otros celulares.
        </div>
        <button class="btn-main-small" onclick="exportarConfiguracion()">Exportar configuración</button>
        <label class="btn-secondary-small file-button">
            Importar configuración
            <input type="file" accept="application/json" onchange="importarConfiguracion(event, { destino: 'adminDatos' })">
        </label>
        <button class="btn-volver" onclick="volverLogico()">Volver</button>
    `;
}

function exportarConfiguracion() {
    const blob = new Blob([JSON.stringify(obtenerConfiguracion(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "configuracion-reportes-vigilancia.json";
    link.click();
    URL.revokeObjectURL(url);
}

function importarConfiguracion(event, opciones = {}) {
    const file = event.target.files[0];

    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const configuracion = JSON.parse(reader.result);
            if (!Array.isArray(configuracion.tiposReportes)) {
                throw new Error("Archivo inválido");
            }
            guardarConfiguracion(configuracion, { preservarCatalogos: false });
            localStorage.setItem(STORAGE_ONBOARDING_KEY, "si");
            alert("Configuración importada.");
            if (opciones.destino === "inicio") {
                mostrarInicio();
            } else if (opciones.destino === "adminDatos") {
                mostrarAdminDatos();
            } else {
                mostrarPanelAdmin();
            }
        } catch (error) {
            console.error(error);
            alert("No fue posible importar el archivo.");
        }
    };
    reader.readAsText(file);
}

function cerrarSesionAdmin() {
    adminActual = null;
    localStorage.removeItem("rv_admin_sesion");
    mostrarInicio();
}

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js").catch(console.error);
    });
}

window.addEventListener("popstate", event => {
    volverLogico();
});

document.addEventListener("click", event => {
    if (!event.target.closest(".time-part")) {
        cerrarMenusHora();
    }
});

inicializarAplicacion();
