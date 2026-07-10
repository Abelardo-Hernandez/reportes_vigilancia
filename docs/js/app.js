const STORAGE_CONFIG_KEY = "rv_configuracion";
const STORAGE_HISTORIAL_KEY = "rv_historial";
const CONFIG_INICIAL_URL = "./configuracion-reportes-vigilancia.json";
const ADMIN_USUARIO = "admin";
const ADMIN_PASSWORD = "admin123";

const appContent = document.getElementById("appContent");
const tituloVista = document.getElementById("tituloVista");
const subtituloVista = document.getElementById("subtituloVista");

let vistaPreviaActual = null;
let formularioActual = null;
let valoresReporteActual = {};
let adminActual = null;
let adminTipoReporteSeleccionado = null;
let adminCampoEditandoId = null;
let navegacionInicializada = false;

const TIPOS_CAMPOS = [
    { id: 1, clave: "texto", nombre: "Texto corto" },
    { id: 2, clave: "textarea", nombre: "Texto largo" },
    { id: 3, clave: "select", nombre: "Lista desplegable" },
    { id: 4, clave: "numero", nombre: "Numero" },
    { id: 5, clave: "fecha", nombre: "Fecha" },
    { id: 6, clave: "hora", nombre: "Hora" },
    { id: 7, clave: "checkbox", nombre: "Casilla" },
    { id: 8, clave: "catalogo", nombre: "Catalogo" }
];

function crearConfiguracionInicial() {
    return {
        version: 5,
        guardias: [],
        lugares: [
            { id: 1, nombre: "Caseta Principal", activo: true },
            { id: 2, nombre: "Caseta Norte", activo: true },
            { id: 3, nombre: "Caseta Sur", activo: true },
            { id: 4, nombre: "Patio", activo: true },
            { id: 5, nombre: "Estacionamiento", activo: true }
        ],
        turnos: [
            { id: 1, nombre: "24 x 24", activo: true },
            { id: 2, nombre: "12 x 12", activo: true }
        ],
        tiposReportes: [
            {
                id: 1,
                nombre: "ASISTENCIA",
                clave: "asistencia",
                emoji: "👮",
                color: "#2563eb",
                orden: 1,
                activo: true,
                campos: [
                    crearCampo(1, "Guardia", "guardia", "catalogo", "", "guardias", true, 1),
                    crearCampo(2, "Turno", "turno", "catalogo", "", "turnos", true, 2),
                    crearCampo(3, "Observaciones", "observaciones", "textarea", "", "", false, 3)
                ],
                plantilla: plantillaBase("ASISTENCIA", ["guardia", "turno", "observaciones"])
            },
            {
                id: 2,
                nombre: "NOVEDAD",
                clave: "novedad",
                emoji: "📝",
                color: "#16a34a",
                orden: 2,
                activo: true,
                campos: [
                    crearCampo(4, "Guardia", "guardia", "catalogo", "", "guardias", true, 1),
                    crearCampo(5, "Ubicación", "ubicacion", "catalogo", "", "lugares", true, 2),
                    crearCampo(6, "Descripcion de la novedad", "descripcion", "textarea", "", "", true, 3)
                ],
                plantilla: `*{{tipo_reporte}}*
*Fecha:* {{fecha}}
*Hora:* {{hora}}

*Guardia:* {{guardia}}
*Ubicación:* {{ubicacion}}
*Novedad:* {{descripcion}}`
            },
            {
                id: 3,
                nombre: "RONDIN",
                clave: "rondin",
                emoji: "🚶",
                color: "#f59e0b",
                orden: 3,
                activo: true,
                campos: [
                    crearCampo(7, "Guardia", "guardia", "catalogo", "", "guardias", true, 1),
                    crearCampo(8, "Zona", "zona", "texto", "", "", true, 2),
                    crearCampo(9, "Resultado", "resultado", "textarea", "", "", true, 3)
                ],
                plantilla: plantillaBase("RONDIN", ["guardia", "zona", "resultado"])
            },
            {
                id: 4,
                nombre: "INCIDENCIA",
                clave: "incidencia",
                emoji: "🚨",
                color: "#dc2626",
                orden: 4,
                activo: true,
                campos: [
                    crearCampo(10, "Guardia", "guardia", "catalogo", "", "guardias", true, 1),
                    crearCampo(11, "Ubicacion", "ubicacion", "texto", "", "", true, 2),
                    crearCampo(12, "Descripcion", "descripcion", "textarea", "", "", true, 3)
                ],
                plantilla: plantillaBase("INCIDENCIA", ["guardia", "ubicacion", "descripcion"])
            }
        ]
    };
}

function crearCampo(id, etiqueta, nombreCampo, tipoCampo, opciones, catalogoOrigen, obligatorio, orden) {
    return {
        id,
        etiqueta,
        nombre_campo: nombreCampo,
        tipo_campo: tipoCampo,
        opciones,
        catalogo_origen: catalogoOrigen,
        obligatorio,
        orden,
        activo: true
    };
}

function plantillaBase(nombre, variables) {
    const etiquetas = {
        guardia: "Guardia",
        turno: "Turno",
        observaciones: "Observaciones",
        ubicacion: "Ubicación",
        descripcion: "Descripción",
        zona: "Zona",
        resultado: "Resultado"
    };
    const lineas = variables.map(variable => `*${etiquetas[variable] || variable}:* {{${variable}}}`).join("\n");

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

async function cargarConfiguracionInicial() {
    try {
        const respuesta = await fetch(CONFIG_INICIAL_URL);

        if (!respuesta.ok) {
            throw new Error("No fue posible cargar la configuracion inicial.");
        }

        const configuracion = await respuesta.json();

        if (!Array.isArray(configuracion.tiposReportes)) {
            throw new Error("La configuracion inicial no tiene formularios.");
        }

        return migrarConfiguracion(configuracion);
    } catch (error) {
        console.error(error);
        return migrarConfiguracion(crearConfiguracionInicial());
    }
}

async function asegurarConfiguracionInicial() {
    if (localStorage.getItem(STORAGE_CONFIG_KEY)) {
        obtenerConfiguracion();
        return;
    }

    const inicial = await cargarConfiguracionInicial();
    guardarConfiguracion(inicial, { preservarCatalogos: false });
}

async function inicializarAplicacion() {
    await asegurarConfiguracionInicial();
    history.replaceState({ vista: "inicio", params: {} }, "");
    navegacionInicializada = true;
    mostrarInicio({ desdeHistorial: true });
}

function registrarNavegacion(vista, params = {}, opciones = {}) {
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

function renderizarDesdeHistorial(estado) {
    const vista = estado?.vista || "inicio";
    const params = estado?.params || {};
    const opciones = { desdeHistorial: true };
    const esVistaAdmin = vista.startsWith("admin");

    if (esVistaAdmin && !sesionAdminActiva()) {
        mostrarLogin(opciones);
        return;
    }

    if (vista === "menuReportes") {
        mostrarMenuReportes(opciones);
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

    if (vista === "adminGuardias") {
        mostrarAdminGuardias(opciones);
        return;
    }

    if (vista === "adminLugares") {
        mostrarAdminLugares(opciones);
        return;
    }

    if (vista === "adminTurnos") {
        mostrarAdminTurnos(opciones);
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
    configuracion.guardias.forEach(guardia => {
        delete guardia.turno;
    });
    configuracion.lugares = configuracion.lugares || [
        { id: 1, nombre: "Caseta Principal", activo: true },
        { id: 2, nombre: "Caseta Norte", activo: true },
        { id: 3, nombre: "Caseta Sur", activo: true },
        { id: 4, nombre: "Patio", activo: true },
        { id: 5, nombre: "Estacionamiento", activo: true }
    ];
    configuracion.turnos = configuracion.turnos || [
        { id: 1, nombre: "24 x 24", activo: true },
        { id: 2, nombre: "12 x 12", activo: true }
    ];

    configuracion.tiposReportes.forEach(tipo => {
        tipo.activo = tipo.activo !== false;
        tipo.campos = tipo.campos || [];

        tipo.campos.forEach(campo => {
            campo.activo = campo.activo !== false;
            campo.etiqueta = capitalizarEtiqueta(campo.etiqueta);

            if (campo.nombre_campo === "turno") {
                campo.tipo_campo = "catalogo";
                campo.catalogo_origen = "turnos";
                campo.opciones = "";
            }

            if (campo.nombre_campo === "guardia_id") {
                campo.nombre_campo = "guardia";
            }

            if (campo.nombre_campo === "lugar") {
                campo.etiqueta = "Ubicación";
                campo.nombre_campo = "ubicacion";
                campo.tipo_campo = "catalogo";
                campo.catalogo_origen = "lugares";
                campo.opciones = "";
            }
        });

        if (tipo.plantilla) {
            tipo.plantilla = tipo.plantilla
                .replace(/\{\{guardia_id\}\}/g, "{{guardia}}")
                .replace(/\*guardia_id:\*/g, "*Guardia:*");
            tipo.plantilla = tipo.plantilla.replace(
                /(?:\*REPORTE DE VIGILANCIA\*\n)?Tipo: ([^\n]+)\nFecha: \{\{fecha\}\}\nHora: \{\{hora\}\}/,
                "*$1*\n*Fecha:* {{fecha}}\n*Hora:* {{hora}}"
            );
            tipo.plantilla = tipo.plantilla
                .replace(/\{\{lugar\}\}/g, "{{ubicacion}}")
                .replace(/\*Lugar:\*/g, "*Ubicación:*");
            tipo.plantilla = normalizarEtiquetasPlantilla(tipo.plantilla);
        }
    });

    configuracion.version = 5;
    return configuracion;
}

function guardarConfiguracion(configuracion, opciones = {}) {
    const debePreservarCatalogos = opciones.preservarCatalogos !== false;
    const rawActual = localStorage.getItem(STORAGE_CONFIG_KEY);

    if (debePreservarCatalogos && rawActual) {
        try {
            const actual = JSON.parse(rawActual);
            configuracion.guardias = fusionarCatalogo(actual.guardias, configuracion.guardias);
            configuracion.lugares = fusionarCatalogo(actual.lugares, configuracion.lugares);
            configuracion.turnos = fusionarCatalogo(actual.turnos, configuracion.turnos);
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

function cambiarHeader(titulo, subtitulo) {
    tituloVista.textContent = titulo;
    subtituloVista.textContent = subtitulo;
}

function mostrarInicio(opciones = {}) {
    registrarNavegacion("inicio", {}, opciones);
    cambiarHeader("SEGURIDAD PATRIMONIAL", "Asistente offline de reportes por WhatsApp");
    appContent.className = "app-content home-actions";
    appContent.innerHTML = `
        <button class="btn-main" onclick="mostrarMenuReportes()">
            NUEVO REPORTE
        </button>

        <button class="btn-admin" onclick="mostrarLogin()">
            Administrador
        </button>
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
    btnVolver.onclick = mostrarInicio;
    appContent.appendChild(btnVolver);
}

function mostrarReporte(clave, opciones = {}) {
    registrarNavegacion("reporte", { clave }, opciones);
    const configuracion = obtenerConfiguracion();
    const tipo = configuracion.tiposReportes.find(item => item.clave === clave && item.activo);

    if (!tipo) {
        appContent.innerHTML = `
            <div class="error-box">No fue posible cargar el formulario.</div>
            <button class="btn-volver" onclick="mostrarMenuReportes()">Volver</button>
        `;
        return;
    }

    formularioActual = {
        tipo,
        campos: tipo.campos.filter(campo => campo.activo).sort((a, b) => a.orden - b.orden),
        plantilla: tipo.plantilla || ""
    };

    cambiarHeader(`${tipo.emoji || ""} ${tipo.nombre}`, "Complete la informacion del reporte");
    appContent.className = "app-content formulario-content";

    let html = `<form id="formReporte" class="form-card">`;

    formularioActual.campos.forEach(campo => {
        html += crearCampoHTML(campo);
    });

    html += `
        <button type="button" class="btn-main-small" onclick="generarVistaPrevia('${tipo.clave}')">
            Generar mensaje
        </button>
    </form>

    <button class="btn-volver" onclick="mostrarMenuReportes()">Volver</button>
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
                <div class="form-group">
                    <label>${campo.etiqueta}</label>
                    <select ${atributos}>
                        <option value="">Seleccione ${nombreCatalogo(campo.catalogo_origen)}</option>
                        ${opciones}
                    </select>
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
                    <option value="">Seleccione una opcion</option>
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

    if (campo.tipo_campo === "fecha" || campo.tipo_campo === "hora" || campo.tipo_campo === "numero") {
        const inputType = campo.tipo_campo === "numero" ? "number" : campo.tipo_campo === "fecha" ? "date" : "time";
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

function obtenerElementosCatalogo(catalogoOrigen) {
    const configuracion = obtenerConfiguracion();
    const catalogo = configuracion[catalogoOrigen] || [];
    return catalogo.filter(item => item.activo);
}

function nombreCatalogo(catalogoOrigen) {
    const nombres = {
        guardias: "guardia",
        lugares: "ubicación",
        turnos: "turno"
    };

    return nombres[catalogoOrigen] || "opcion";
}

function generarVistaPrevia(clave) {
    const form = document.getElementById("formReporte");

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const formData = new FormData(form);
    const respuestas = [];
    const valores = {};

    formularioActual.campos.forEach(campoConfig => {
        const campo = form.querySelector(`[name="${campoConfig.nombre_campo}"]`);
        let valorFinal = campoConfig.tipo_campo === "checkbox"
            ? (campo.checked ? "Si" : "No")
            : formData.get(campoConfig.nombre_campo);

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
    `;
}

function editarReporteDesdeVistaPrevia(clave) {
    if (history.state?.vista === "preview") {
        history.back();
        return;
    }

    mostrarReporte(clave);
}

function restaurarValoresReporte(clave) {
    const valores = valoresReporteActual[clave];
    const form = document.getElementById("formReporte");

    if (!valores || !form) {
        return;
    }

    formularioActual.campos.forEach(campoConfig => {
        const campo = form.querySelector(`[name="${campoConfig.nombre_campo}"]`);

        if (!campo) {
            return;
        }

        const valor = valores[campoConfig.nombre_campo] || "";

        if (campoConfig.tipo_campo === "checkbox") {
            campo.checked = valor === "Si";
            return;
        }

        campo.value = valor;
    });
}

function construirMensajeAutomatico(clave, respuestas) {
    const tipoNombre = formularioActual?.tipo?.nombre || clave.toUpperCase();
    let mensaje = `*${tipoNombre}*\n`;
    mensaje += `*Fecha:* ${new Date().toLocaleDateString("es-MX")}\n`;
    mensaje += `*Hora:* ${new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}\n\n`;

    respuestas.forEach(respuesta => {
        mensaje += `*${respuesta.etiqueta}:* ${respuesta.valor}\n`;
    });

    return mensaje;
}

function renderizarPlantillaWhatsApp(plantilla, clave, valores) {
    const variables = {
        ...valores,
        fecha: new Date().toLocaleDateString("es-MX"),
        hora: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
        tipo_reporte: formularioActual?.tipo?.nombre || clave.toUpperCase()
    };
    variables.guardia = variables.guardia || variables.guardia_id || "";
    variables.guardia_id = variables.guardia;

    return plantilla.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (coincidencia, variable) => {
        return variables[variable] ?? "";
    });
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
    cambiarHeader("ADMINISTRADOR", "Inicio de sesion local");
    appContent.className = "app-content";
    appContent.innerHTML = `
        <form id="formLoginAdmin" class="login-card">
            <label>Usuario</label>
            <input type="text" name="usuario" placeholder="Usuario" autocomplete="username" required>

            <label>Contrasena</label>
            <input type="password" name="password" placeholder="Contraseña" autocomplete="current-password" required>

            <button type="submit" class="btn-main-small">Ingresar</button>
        </form>

        <button class="btn-volver" onclick="mostrarInicio()">Volver</button>
    `;

    document.getElementById("formLoginAdmin").addEventListener("submit", iniciarSesionAdmin);
}

function iniciarSesionAdmin(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const usuario = formData.get("usuario");
    const password = formData.get("password");

    if (usuario !== ADMIN_USUARIO || password !== ADMIN_PASSWORD) {
        mostrarMensajeLogin("Usuario o contrasena incorrectos.");
        return;
    }

    adminActual = { usuario: ADMIN_USUARIO, nombre: "Administrador" };
    localStorage.setItem("rv_admin_sesion", "activa");
    mostrarPanelAdmin();
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
    cambiarHeader("ADMINISTRADOR", "Configuracion local offline");
    appContent.className = "app-content admin-panel";
    appContent.innerHTML = `
        <button class="admin-card" type="button" onclick="mostrarAdminFormularios()">
            <span>Formularios</span>
            <small>Tipos de reporte, campos y plantilla de WhatsApp</small>
        </button>

        <button class="admin-card" type="button" onclick="mostrarAdminGuardias()">
            <span>Guardias</span>
            <small>Catalogo local para los formularios</small>
        </button>

        <button class="admin-card" type="button" onclick="mostrarAdminLugares()">
            <span>Ubicaciones</span>
            <small>Catalogo local para campos de ubicación</small>
        </button>

        <button class="admin-card" type="button" onclick="mostrarAdminTurnos()">
            <span>Turnos</span>
            <small>Catalogo local para campos de turno</small>
        </button>

        <button class="admin-card" type="button" onclick="mostrarHistorialAdmin()">
            <span>Historial</span>
            <small>Solo tipo de registro y fecha/hora</small>
        </button>

        <button class="admin-card" type="button" onclick="mostrarAdminDatos()">
            <span>Datos</span>
            <small>Exportar, importar o restaurar configuracion</small>
        </button>

        <button class="btn-volver" onclick="cerrarSesionAdmin()">Cerrar sesion</button>
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

    cambiarHeader("Formularios", "Diseno local del mensaje");
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

        <button class="btn-volver" onclick="mostrarPanelAdmin()">Volver</button>
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
        return `<div class="info-card">Este formulario aun no tiene campos.</div>`;
    }

    return `
        <div class="admin-list">
            ${campos.map(campo => `
                <div class="admin-field-card">
                    <div>
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

function renderEditorPlantillaAdmin(tipo) {
    const variables = ["fecha", "hora", "tipo_reporte", ...tipo.campos.filter(campo => campo.activo).map(campo => campo.nombre_campo)];

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
    const camposActivos = tipo.campos
        .filter(campo => campo.activo)
        .sort((a, b) => a.orden - b.orden);
    const nombresActivos = new Set(camposActivos.map(campo => campo.nombre_campo));
    const lineas = (tipo.plantilla || plantillaBase(tipo.nombre, []))
        .split("\n")
        .filter(linea => {
            const match = linea.match(/\{\{([a-zA-Z0-9_]+)\}\}/);

            if (!match) {
                return true;
            }

            const variable = match[1];
            const esCampo = tipo.campos.some(campo => campo.nombre_campo === variable);

            return !esCampo || nombresActivos.has(variable);
        });

    camposActivos.forEach(campo => {
        const variable = `{{${campo.nombre_campo}}}`;
        const existe = lineas.some(linea => linea.includes(variable));

        if (!existe) {
            lineas.push(`*${campo.etiqueta}:* ${variable}`);
        }
    });

    tipo.plantilla = normalizarEtiquetasPlantilla(lineas.join("\n").replace(/\n{3,}/g, "\n\n").trim());
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
                <input type="text" name="nombre_campo" value="${campo.nombre_campo}" placeholder="se genera desde la etiqueta">
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
                <textarea name="opciones" rows="3" placeholder="Una|Dos|Tres">${campo.opciones || ""}</textarea>
                <small>Solo para lista desplegable. Separe cada opcion con |</small>
            </div>
            <div class="form-group" data-config-campo="catalogo">
                <label>Catalogo</label>
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
    return [
        { clave: "guardias", nombre: "Guardias" },
        { clave: "lugares", nombre: "Ubicaciones" },
        { clave: "turnos", nombre: "Turnos" }
    ];
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
    return Math.max(0, ...configuracion.tiposReportes.flatMap(tipo => tipo.campos.map(campo => campo.id))) + 1;
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

function mostrarAdminGuardias(opciones = {}) {
    registrarNavegacion("adminGuardias", {}, opciones);
    const configuracion = obtenerConfiguracion();
    cambiarHeader("Guardias", "Catalogo local");
    appContent.className = "app-content admin-formularios";
    appContent.innerHTML = `
        <form id="formGuardia" class="form-card">
            <div class="form-group">
                <label>Nombre</label>
                <input type="text" name="nombre" required>
            </div>
            <button class="btn-main-small" type="submit">Agregar guardia</button>
        </form>
        <div class="admin-list">
            ${configuracion.guardias.filter(guardia => guardia.activo).map(guardia => `
                <div class="admin-field-card">
                    <div>
                        <strong>${guardia.nombre}</strong>
                        <span>Guardia activo</span>
                    </div>
                    <div class="admin-field-actions">
                        <button type="button" onclick="desactivarGuardia(${guardia.id})">Quitar</button>
                    </div>
                </div>
            `).join("") || `<div class="info-card">No hay guardias registrados.</div>`}
        </div>
        <button class="btn-volver" onclick="mostrarPanelAdmin()">Volver</button>
    `;
    document.getElementById("formGuardia").addEventListener("submit", guardarGuardiaAdmin);
}

function guardarGuardiaAdmin(event) {
    event.preventDefault();
    const configuracion = obtenerConfiguracion();
    const formData = new FormData(event.target);
    configuracion.guardias.push({
        id: Math.max(0, ...configuracion.guardias.map(guardia => guardia.id || 0)) + 1,
        nombre: formData.get("nombre"),
        activo: true
    });
    guardarConfiguracion(configuracion);
    mostrarAdminGuardias();
}

function desactivarGuardia(id) {
    const configuracion = obtenerConfiguracion();
    const guardia = configuracion.guardias.find(item => item.id === id);
    guardia.activo = false;
    guardarConfiguracion(configuracion);
    mostrarAdminGuardias();
}

function mostrarAdminLugares(opciones = {}) {
    registrarNavegacion("adminLugares", {}, opciones);
    const configuracion = obtenerConfiguracion();
    cambiarHeader("Ubicaciones", "Catalogo local");
    appContent.className = "app-content admin-formularios";
    appContent.innerHTML = `
        <form id="formLugar" class="form-card">
            <div class="form-group">
                <label>Nombre de la ubicación</label>
                <input type="text" name="nombre" required>
            </div>
            <button class="btn-main-small" type="submit">Agregar ubicación</button>
        </form>
        <div class="admin-list">
            ${configuracion.lugares.filter(lugar => lugar.activo).map(lugar => `
                <div class="admin-field-card">
                    <div>
                        <strong>${lugar.nombre}</strong>
                        <span>Disponible en campos tipo ubicación</span>
                    </div>
                    <div class="admin-field-actions">
                        <button type="button" onclick="desactivarLugar(${lugar.id})">Quitar</button>
                    </div>
                </div>
            `).join("") || `<div class="info-card">No hay ubicaciones registradas.</div>`}
        </div>
        <button class="btn-volver" onclick="mostrarPanelAdmin()">Volver</button>
    `;
    document.getElementById("formLugar").addEventListener("submit", guardarLugarAdmin);
}

function guardarLugarAdmin(event) {
    event.preventDefault();
    const configuracion = obtenerConfiguracion();
    const formData = new FormData(event.target);
    configuracion.lugares.push({
        id: Math.max(0, ...configuracion.lugares.map(lugar => lugar.id || 0)) + 1,
        nombre: formData.get("nombre"),
        activo: true
    });
    guardarConfiguracion(configuracion);
    mostrarAdminLugares();
}

function desactivarLugar(id) {
    const configuracion = obtenerConfiguracion();
    const lugar = configuracion.lugares.find(item => item.id === id);
    lugar.activo = false;
    guardarConfiguracion(configuracion);
    mostrarAdminLugares();
}

function mostrarAdminTurnos(opciones = {}) {
    registrarNavegacion("adminTurnos", {}, opciones);
    const configuracion = obtenerConfiguracion();
    cambiarHeader("Turnos", "Catalogo local");
    appContent.className = "app-content admin-formularios";
    appContent.innerHTML = `
        <form id="formTurno" class="form-card">
            <div class="form-group">
                <label>Nombre del turno</label>
                <input type="text" name="nombre" required>
            </div>
            <button class="btn-main-small" type="submit">Agregar turno</button>
        </form>
        <div class="admin-list">
            ${configuracion.turnos.filter(turno => turno.activo).map(turno => `
                <div class="admin-field-card">
                    <div>
                        <strong>${turno.nombre}</strong>
                        <span>Disponible en campos tipo turno</span>
                    </div>
                    <div class="admin-field-actions">
                        <button type="button" onclick="desactivarTurno(${turno.id})">Quitar</button>
                    </div>
                </div>
            `).join("") || `<div class="info-card">No hay turnos registrados.</div>`}
        </div>
        <button class="btn-volver" onclick="mostrarPanelAdmin()">Volver</button>
    `;
    document.getElementById("formTurno").addEventListener("submit", guardarTurnoAdmin);
}

function guardarTurnoAdmin(event) {
    event.preventDefault();
    const configuracion = obtenerConfiguracion();
    const formData = new FormData(event.target);
    configuracion.turnos.push({
        id: Math.max(0, ...configuracion.turnos.map(turno => turno.id || 0)) + 1,
        nombre: formData.get("nombre"),
        activo: true
    });
    guardarConfiguracion(configuracion);
    mostrarAdminTurnos();
}

function desactivarTurno(id) {
    const configuracion = obtenerConfiguracion();
    const turno = configuracion.turnos.find(item => item.id === id);
    turno.activo = false;
    guardarConfiguracion(configuracion);
    mostrarAdminTurnos();
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
            `).join("") || `<div class="info-card">Aun no hay historial local.</div>`}
        </div>
        <button class="btn-secondary-small" onclick="limpiarHistorial()">Limpiar historial</button>
        <button class="btn-volver" onclick="mostrarPanelAdmin()">Volver</button>
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
            La configuracion vive en este dispositivo. Exporte el JSON para copiarla a otros celulares.
        </div>
        <button class="btn-main-small" onclick="exportarConfiguracion()">Exportar configuracion</button>
        <label class="btn-secondary-small file-button">
            Importar configuracion
            <input type="file" accept="application/json" onchange="importarConfiguracion(event)">
        </label>
        <button class="btn-secondary-small" onclick="restaurarConfiguracionInicial()">Restaurar inicial</button>
        <button class="btn-volver" onclick="mostrarPanelAdmin()">Volver</button>
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

function importarConfiguracion(event) {
    const file = event.target.files[0];

    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const configuracion = JSON.parse(reader.result);
            if (!Array.isArray(configuracion.tiposReportes)) {
                throw new Error("Archivo invalido");
            }
            guardarConfiguracion(configuracion, { preservarCatalogos: false });
            alert("Configuracion importada.");
            mostrarPanelAdmin();
        } catch (error) {
            console.error(error);
            alert("No fue posible importar el archivo.");
        }
    };
    reader.readAsText(file);
}

async function restaurarConfiguracionInicial() {
    if (confirm("Restaurar la configuracion inicial?")) {
        const configuracion = await cargarConfiguracionInicial();
        guardarConfiguracion(configuracion, { preservarCatalogos: false });
        mostrarPanelAdmin();
    }
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
    renderizarDesdeHistorial(event.state);
});

inicializarAplicacion();
