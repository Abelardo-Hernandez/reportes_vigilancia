// El código es un bloqueo de interfaz; RLS sigue siendo la autoridad de permisos.
let avanzadaHasta = 0;
let avanzadaUsuario = null;
const HASH_AVANZADA = '87ce0da4c7bdf748e0fa1271fb19271fc6a9bad70ad053ba814b4d84e0749696';

function bloquearAvanzada() { avanzadaHasta = 0; avanzadaUsuario = null; }
function avanzadaActiva() {
    return sesionAdminActiva() && avanzadaUsuario === nube.usuario.id && Date.now() < avanzadaHasta;
}
async function validarCodigoAvanzado(codigo) {
    if (!sesionAdminActiva()) return false;
    const usuario = nube.usuario.id;
    const bytes = new TextEncoder().encode(codigo);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(b => b.toString(16).padStart(2, '0')).join('');
    if (hash !== HASH_AVANZADA || !sesionAdminActiva() || nube.usuario.id !== usuario) return false;
    avanzadaUsuario = usuario;
    avanzadaHasta = Date.now() + 10 * 60 * 1000;
    return true;
}
function requerirAvanzada() {
    if (avanzadaActiva()) return true;
    mostrarAvanzada();
    return false;
}

function mostrarDashboardAdmin(opciones = {}) {
    if (!sesionAdminActiva()) return mostrarAccesoNube();
    registrarNavegacion('adminPanel', {}, opciones);
    cambiarHeader('Administración', 'Personas, unidades y reportes');
    const editando = nube.ubicacion && STORAGE_CONFIG_KEY.startsWith('rv_borrador_');
    const config = editando ? obtenerConfiguracion() : null;
    const version = editando ? Number(localStorage.getItem(`${STORAGE_CONFIG_KEY}_base`) || 0) : 0;
    appContent.className = 'app-content admin-dashboard';
    appContent.innerHTML = `
      <section class="admin-welcome"><span class="eyebrow">PANEL GLOBAL</span><h2>Hola, ${escaparNube(nube.perfil.nombre || 'administrador')}</h2><p>Todo lo necesario para organizar la vigilancia.</p></section>
      <div class="admin-shortcuts">
        <button class="action-tile" onclick="mostrarHistorico()"><span class="tile-icon" aria-hidden="true">▤</span><strong>Histórico</strong><small>Buscar reportes, ver fotos y descargar Excel</small></button>
        <button class="action-tile" onclick="mostrarGestionNube()"><span class="tile-icon" aria-hidden="true">◎</span><strong>Unidades y vigilantes</strong><small>Organizar plantas y asignar accesos</small></button>
      </div>
      <section class="workspace-card"><span class="eyebrow">CONFIGURAR UNA UNIDAD</span><label for="unidadEditor">Planta o sucursal</label>
        <select id="unidadEditor"><option value="">Seleccione una unidad</option>${nube.ubicaciones.filter(u => u.activa).map(u => `<option value="${u.id}" ${editando && nube.ubicacion.id === u.id ? 'selected' : ''}>${escaparNube(u.nombre)}</option>`).join('')}</select>
        <p class="muted">${editando ? 'Los cambios del editor se guardan como borrador. Publique cuando estén listos.' : 'Elija dónde desea editar los formularios y catálogos.'}</p>
        <p id="estadoUnidadEditor" role="status"></p>
        ${editando ? `<div class="workspace-summary"><strong>${escaparNube(nube.ubicacion.nombre)}</strong><span class="status-pill">${version ? `Versión base ${version}` : 'Sin publicar'}</span></div>
        <div class="admin-shortcuts"><button class="action-tile compact" onclick="mostrarAdminFormularios()"><strong>Formularios</strong><small>${config.tiposReportes.filter(t => t.activo).length} activos · Campos y mensajes</small></button><button class="action-tile compact" onclick="mostrarAdminCatalogos()"><strong>Catálogos</strong><small>Opciones disponibles al reportar</small></button></div>
        <button class="btn-main-small" id="publicarNube" onclick="publicarNube()">Publicar cambios en esta unidad</button>` : '<div class="empty-inline">Seleccione una unidad para habilitar el editor.</div>'}
      </section>
      <button class="advanced-link" onclick="mostrarAvanzada()"><span>⚙ Configuración avanzada</span><small>Respaldo y recuperación · Requiere código</small></button>
      <button class="btn-volver" onclick="mostrarInicio()">Volver al inicio</button>`;
    document.getElementById('unidadEditor').onchange = async event => {
        const select = event.target;
        if (!select.value) return;
        select.disabled = true;
        document.getElementById('estadoUnidadEditor').textContent = 'Cargando configuración…';
        try { await seleccionarUbicacionNube(select.value, true); if (vistaActual === 'adminPanel') mostrarDashboardAdmin({ desdeHistorial: true }); }
        catch (error) { if (select.isConnected) { document.getElementById('estadoUnidadEditor').textContent = error.message; select.disabled = false; } }
    };
}

function mostrarAvanzada(opciones = {}) {
    if (!sesionAdminActiva()) return mostrarAccesoNube();
    registrarNavegacion('adminAvanzada', {}, opciones);
    cambiarHeader('Configuración avanzada', 'Herramientas de respaldo y recuperación');
    appContent.className = 'app-content admin-dashboard';
    if (!avanzadaActiva()) {
        appContent.innerHTML = `<form id="accesoAvanzado" class="workspace-card"><span class="eyebrow">ACCESO ADICIONAL</span><h2>Ingrese el código</h2><p>Las herramientas avanzadas se habilitan durante 10 minutos en esta sesión.</p><label for="codigoAvanzado">Código de acceso</label><input id="codigoAvanzado" type="password" required autocomplete="off"><button class="btn-main-small">Habilitar configuración avanzada</button><p id="errorAvanzado" role="status"></p></form><button class="btn-volver" onclick="mostrarPanelAdmin()">Volver al panel</button>`;
        document.getElementById('accesoAvanzado').onsubmit = async event => {
            event.preventDefault();
            const form = event.currentTarget;
            form.querySelector('button').disabled = true;
            try {
                const valido = await validarCodigoAvanzado(document.getElementById('codigoAvanzado').value);
                if (!form.isConnected) { bloquearAvanzada(); return; }
                document.getElementById('codigoAvanzado').value = '';
                if (valido) mostrarAvanzada({ desdeHistorial: true });
                else document.getElementById('errorAvanzado').textContent = 'Código incorrecto. Intente nuevamente.';
            } catch { if (form.isConnected) document.getElementById('errorAvanzado').textContent = 'No se pudo verificar el código. Vuelva a abrir la app.'; }
            finally { if (form.isConnected) form.querySelector('button').disabled = false; }
        };
        return;
    }
    const editando = nube.ubicacion && STORAGE_CONFIG_KEY.startsWith('rv_borrador_');
    appContent.innerHTML = `<section class="workspace-card"><span class="status-pill">Acceso habilitado temporalmente</span><h2>Respaldo de configuración</h2><p>${editando ? `Unidad seleccionada: <strong>${escaparNube(nube.ubicacion.nombre)}</strong>` : 'Seleccione una unidad desde el panel para usar estas herramientas.'}</p>
      <button class="btn-main-small" onclick="mostrarAdminDatos()" ${!editando ? 'disabled' : ''}>Importar o exportar configuración</button>
      <button class="btn-secondary-small" onclick="recargarPublicacionNube()" ${!editando ? 'disabled' : ''}>Reemplazar borrador con la versión publicada</button></section>
      <section class="workspace-card"><h2>Conservación del histórico</h2><p>El proceso de limpieza existente conserva 15 días cuando está programado en Supabase. Esta pantalla no cambia ni activa ese proceso.</p><p class="muted">Descargue un Excel desde Histórico para conservar una copia de los registros disponibles.</p></section>
      <button class="btn-secondary-small" onclick="bloquearAvanzada(); mostrarAvanzada({desdeHistorial:true})">Bloquear herramientas avanzadas</button><button class="btn-volver" onclick="mostrarPanelAdmin()">Volver al panel</button>`;
}

function limitesFechasHistorico(desde, hasta) {
    const inicio = desde ? new Date(`${desde}T00:00:00`) : null;
    const fin = hasta ? new Date(`${hasta}T00:00:00`) : null;
    if ((inicio && !Number.isFinite(inicio.getTime())) || (fin && !Number.isFinite(fin.getTime())) || (inicio && fin && inicio > fin)) throw new Error('Revise el rango de fechas: Desde debe ser anterior o igual a Hasta.');
    if (fin) fin.setDate(fin.getDate() + 1);
    return { inicio: inicio?.toISOString(), fin: fin?.toISOString() };
}

function consultaHistorico(filtros, desde, cantidad, contar = false) {
    let consulta = clienteNube().from('reportes').select('id,creado_por,vigilante_id,vigilante_nombre,creado_en,tipo_nombre,tipo_clave,ubicacion_id,configuracion_id,mensaje_whatsapp,valores,formulario_snapshot,evidencia_ruta', contar ? { count: 'exact' } : {});
    const limites = limitesFechasHistorico(filtros.desde, filtros.hasta);
    if (limites.inicio) consulta = consulta.gte('creado_en', limites.inicio);
    if (limites.fin) consulta = consulta.lt('creado_en', limites.fin);
    if (filtros.unidad) consulta = consulta.eq('ubicacion_id', filtros.unidad);
    if (filtros.vigilante) consulta = consulta.eq(filtros.vigilante.startsWith('cuenta:') ? 'creado_por' : 'vigilante_id', filtros.vigilante.replace(/^cuenta:/, ''));
    if (filtros.tipo) consulta = consulta.ilike('tipo_nombre', `%${filtros.tipo.replace(/[\\%_]/g, '\\$&')}%`);
    return consulta.lte('creado_en', filtros.corte).order('creado_en', { ascending: false }).order('id', { ascending: false }).range(desde, desde + cantidad - 1);
}

function nombreAutorReporte(reporte, perfiles) {
    return reporte.vigilante_nombre || reporte.valores?.vigilante || reporte.valores?.nombre_guardia || perfiles.find(p => p.id === reporte.creado_por)?.nombre || perfiles.find(p => p.id === reporte.creado_por)?.correo || 'Cuenta anterior';
}

async function mostrarHistorico(opciones = {}) {
    if (!sesionAdminActiva()) return mostrarAccesoNube();
    registrarNavegacion('adminHistorial', {}, opciones);
    cambiarHeader('Histórico', 'Consulte y descargue sus reportes');
    appContent.className = 'app-content admin-dashboard';
    appContent.innerHTML = '<p role="status">Cargando filtros…</p>';
    try {
        const [unidades, perfiles, vigilantes] = await Promise.all([
            resultadoNube(clienteNube().from('ubicaciones').select('*').order('nombre')),
            resultadoNube(clienteNube().from('perfiles').select('id,nombre,correo,rol').order('nombre')),
            resultadoNube(clienteNube().from('vigilantes').select('*').order('nombre'))
        ]);
        if (vistaActual !== 'adminHistorial' || !sesionAdminActiva()) return;
        appContent.innerHTML = `<form id="filtrosHistorico" class="workspace-card"><span class="eyebrow">BUSCAR REPORTES</span><div class="filter-grid"><label>Desde<input type="date" name="desde"></label><label>Hasta<input type="date" name="hasta"></label>
          <label>Unidad<select name="unidad"><option value="">Todas las unidades</option>${unidades.map(u => `<option value="${u.id}">${escaparNube(u.nombre)}${u.activa ? '' : ' (inactiva)'}</option>`).join('')}</select></label>
          <label>Vigilante<select name="vigilante"><option value="">Todos los vigilantes</option>${vigilantes.map(v => `<option value="${v.id}">${escaparNube(v.nombre)} · ${escaparNube(unidades.find(u => u.id === v.ubicacion_id)?.nombre)}${v.activo ? '' : ' (inactivo)'}</option>`).join('')}<optgroup label="Por cuenta (incluye reportes anteriores)">${perfiles.map(p => `<option value="cuenta:${p.id}">${escaparNube(p.nombre || p.correo || 'Cuenta anterior')}</option>`).join('')}</optgroup></select></label></div>
          <label>Tipo de reporte<input name="tipo" maxlength="120" placeholder="Ej. Rondín, entrada, novedad"></label><button class="btn-main-small">Buscar reportes</button><button type="reset" class="text-button">Limpiar filtros</button></form>
          <div class="history-toolbar"><strong id="resumenHistorico" role="status"></strong><button class="btn-secondary-small" id="excelHistorico" disabled>Descargar Excel</button></div>
          <p id="estadoHistorico" role="status"></p><div id="listaHistorico" class="history-list"></div>
          <nav class="history-pagination" aria-label="Páginas del histórico"><button id="anteriorHistorico">Anterior</button><span id="paginaHistorico"></span><button id="siguienteHistorico">Siguiente</button></nav><button class="btn-volver" onclick="mostrarPanelAdmin()">Volver al panel</button>`;
        const form = document.getElementById('filtrosHistorico');
        const lista = document.getElementById('listaHistorico');
        const estado = document.getElementById('estadoHistorico');
        const excel = document.getElementById('excelHistorico');
        const anterior = document.getElementById('anteriorHistorico');
        const siguiente = document.getElementById('siguienteHistorico');
        let filtros = { corte: new Date().toISOString() }, pagina = 0, total = 0, solicitud = 0, exportando = false;
        const cargar = async () => {
            const numero = ++solicitud;
            lista.innerHTML = '';
            estado.textContent = 'Buscando reportes…';
            excel.disabled = anterior.disabled = siguiente.disabled = true;
            try {
                const { data, error, count } = await consultaHistorico(filtros, pagina * 50, 50, true);
                if (numero !== solicitud || !lista.isConnected || !sesionAdminActiva()) return;
                if (error) throw error;
                total = count ?? data.length;
                document.getElementById('resumenHistorico').textContent = `${total} ${total === 1 ? 'reporte encontrado' : 'reportes encontrados'}`;
                document.getElementById('paginaHistorico').textContent = `Página ${pagina + 1} de ${Math.max(1, Math.ceil(total / 50))}`;
                estado.textContent = data.length ? 'Abra un reporte para consultar el mensaje y su evidencia.' : 'No hay reportes con estos filtros. Pruebe otras fechas o unidades.';
                for (const r of data) {
                    const card = document.createElement('details');
                    card.className = 'history-card';
                    const unidad = unidades.find(u => u.id === r.ubicacion_id)?.nombre || 'Sin unidad (registro anterior)';
                    card.innerHTML = `<summary><span class="history-heading"><strong>${escaparNube(r.tipo_nombre)}</strong><small>${escaparNube(new Date(r.creado_en).toLocaleString('es-MX'))}</small></span><span class="history-meta">${escaparNube(unidad)} · ${escaparNube(nombreAutorReporte(r, perfiles))}</span>${r.evidencia_ruta ? '<span class="status-pill">Con foto</span>' : ''}</summary><div class="history-detail"><pre class="cloud-message">${escaparNube(r.mensaje_whatsapp)}</pre></div>`;
                    if (r.evidencia_ruta) {
                        const boton = document.createElement('button');
                        boton.className = 'btn-secondary-small'; boton.textContent = 'Ver fotografía';
                        boton.onclick = async () => {
                            boton.disabled = true;
                            try {
                                const data = await resultadoNube(clienteNube().storage.from('evidencias').createSignedUrl(r.evidencia_ruta, 120));
                                if (!boton.isConnected) return;
                                const img = document.createElement('img'); img.src = data.signedUrl; img.alt = 'Evidencia del reporte'; img.className = 'history-photo';
                                img.onerror = () => { img.remove(); boton.disabled = false; boton.textContent = 'No se pudo cargar. Reintentar foto'; };
                                boton.after(img); boton.textContent = 'Fotografía cargada';
                            } catch (error) { boton.disabled = false; boton.textContent = `Reintentar foto: ${error.message}`; }
                        };
                        card.querySelector('.history-detail').appendChild(boton);
                    }
                    lista.appendChild(card);
                }
                anterior.disabled = pagina === 0; siguiente.disabled = (pagina + 1) * 50 >= total; excel.disabled = !total || exportando;
            } catch (error) { if (numero === solicitud && lista.isConnected) estado.textContent = `No se pudo consultar: ${error.message}. Pulse Buscar reportes para reintentar.`; }
        };
        form.onsubmit = event => {
            event.preventDefault();
            const nuevos = Object.fromEntries(new FormData(form));
            try { limitesFechasHistorico(nuevos.desde, nuevos.hasta); }
            catch (error) { estado.textContent = error.message; return; }
            filtros = { ...nuevos, corte: new Date().toISOString() }; pagina = 0; cargar();
        };
        form.onreset = () => { filtros = { corte: new Date().toISOString() }; pagina = 0; cargar(); };
        anterior.onclick = () => { pagina--; cargar(); };
        siguiente.onclick = () => { pagina++; cargar(); };
        excel.onclick = async () => {
            if (exportando) return;
            exportando = true; excel.disabled = true;
            const seleccion = { ...filtros };
            try {
                const reportes = await obtenerTodosHistorico(seleccion, cantidad => { if (estado.isConnected) estado.textContent = `Preparando Excel: ${cantidad} reportes…`; });
                if (!excel.isConnected || !sesionAdminActiva()) return;
                const buffer = await crearExcelHistorico(reportes, unidades, perfiles, seleccion);
                if (!excel.isConnected || !sesionAdminActiva()) return;
                await entregarExcel(buffer);
                if (estado.isConnected) estado.textContent = `Excel preparado con ${reportes.length} reportes de la búsqueda seleccionada.`;
            } catch (error) { if (estado.isConnected) estado.textContent = `No se pudo exportar: ${error.message}`; }
            finally { exportando = false; if (excel.isConnected) excel.disabled = !total; }
        };
        await cargar();
    } catch (error) {
        if (vistaActual === 'adminHistorial') appContent.innerHTML = `<div class="workspace-card"><p>${escaparNube(error.message)}</p><button class="btn-main-small" onclick="mostrarHistorico({desdeHistorial:true})">Reintentar</button></div><button class="btn-volver" onclick="mostrarPanelAdmin()">Volver al panel</button>`;
    }
}

async function obtenerTodosHistorico(filtros, progreso = () => {}) {
    const reportes = [], ids = new Set();
    for (let offset = 0; ; ) {
        if (!sesionAdminActiva()) throw new Error('La sesión de administrador terminó.');
        const lote = await resultadoNube(consultaHistorico(filtros, offset, 500));
        if (!lote.length) break;
        for (const r of lote) { if (!ids.has(r.id)) { ids.add(r.id); reportes.push(r); } }
        offset += lote.length;
        progreso(reportes.length);
    }
    return reportes;
}

function fechaExcelHistorico(valor) {
    if (!valor) return '';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return '';
    const partes = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(fecha).map(p => [p.type, p.value]));
    return `${partes.year}-${partes.month}-${partes.day} ${partes.hour}:${partes.minute}`;
}

async function crearExcelHistorico(reportes, unidades, perfiles, filtros) {
    const libro = new ExcelJS.Workbook();
    libro.creator = 'PT Reportes';
    const grupos = new Map();
    for (const reporte of reportes) {
        const clave = reporte.tipo_clave || reporte.tipo_nombre || 'Reportes';
        if (!grupos.has(clave)) grupos.set(clave, []);
        grupos.get(clave).push(reporte);
    }
    const nombres = new Set();
    const nombreHoja = nombre => {
        const base = String(nombre || 'Reportes').replace(/[\\/?*\[\]:\x00-\x1f]/g, ' ').replace(/^'+|'+$/g, '').trim() || 'Reportes';
        let candidato = base.slice(0, 31), numero = 2;
        while (nombres.has(candidato.toLowerCase()) || candidato.toLowerCase() === 'history') {
            const sufijo = ` (${numero++})`;
            candidato = base.slice(0, 31 - sufijo.length) + sufijo;
        }
        nombres.add(candidato.toLowerCase());
        return candidato;
    };
    const internos = new Set(['vigilante_id', 'registrado_dispositivo']);
    const identidad = new Set(['vigilante', 'guardia', 'nombre_guardia', 'nombre_vigilante', 'unidad', 'ubicacion']);
    const texto = valor => valor == null ? '' : typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
    for (const filas of grupos.values()) {
        const hoja = libro.addWorksheet(nombreHoja(filas[0].tipo_nombre || filas[0].tipo_clave));
        const campos = new Map();
        for (const r of filas) {
            const definidos = r.formulario_snapshot?.campos || [];
            const candidatos = [
                ...definidos,
                ...Object.keys(r.valores || {}).filter(clave => !definidos.some(c => c.nombre_campo === clave)).map(clave => ({ nombre_campo: clave, etiqueta: clave }))
            ];
            for (const campo of candidatos) {
                const clave = campo.nombre_campo;
                if (!clave || internos.has(clave) || identidad.has(clave)) continue;
                // Fecha y hora del contexto se reflejan en la fecha de recepcion;
                // conservarlas si pertenecen explicitamente al formulario.
                if (['fecha', 'hora'].includes(clave) && !definidos.some(c => c.nombre_campo === clave)) continue;
                if (!campos.has(clave)) campos.set(clave, { clave, etiqueta: campo.etiqueta || clave, partes: 1 });
                const columna = campos.get(clave);
                columna.partes = Math.max(columna.partes, Math.ceil(texto(r.valores?.[clave]).length / 30000));
            }
        }
        const columnas = [...campos.values()].flatMap(campo => Array.from({ length: campo.partes }, (_, parte) => ({
            ...campo, parte, titulo: campo.etiqueta + (parte ? ` (${parte + 1})` : '')
        })));
        hoja.addRow(['Fecha de recepci\u00f3n (CDMX)', 'Vigilante', 'Unidad', ...columnas.map(c => c.titulo)]);
        for (const r of filas) {
            hoja.addRow([
                fechaExcelHistorico(r.creado_en), nombreAutorReporte(r, perfiles),
                r.valores?.unidad || r.valores?.ubicacion || unidades.find(u => u.id === r.ubicacion_id)?.nombre || 'Sin unidad',
                ...columnas.map(c => texto(r.valores?.[c.clave]).slice(c.parte * 30000, (c.parte + 1) * 30000))
            ]);
        }
    }
    if (!grupos.size) libro.addWorksheet('Reportes').addRow(['Sin reportes para exportar']);
    libro.eachSheet(hoja => {
        hoja.views = [{ state: 'frozen', ySplit: 1 }];
        hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        hoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16634B' } };
        hoja.getRow(1).alignment = { vertical: 'middle', wrapText: true };
        hoja.getRow(1).height = 32;
        hoja.eachRow((fila, numero) => {
            if (numero > 1) fila.alignment = { vertical: 'top', wrapText: true };
        });
        for (let columna = 1; columna <= hoja.columnCount; columna++) hoja.getColumn(columna).width = 28;
        hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: hoja.rowCount, column: hoja.columnCount } };
    });
    return libro.xlsx.writeBuffer();
}

async function entregarExcel(buffer) {
    const nombre = `reportes-${new Date().toISOString().slice(0, 10)}.xlsx`;
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return entregarArchivoAdmin(blob, nombre, 'Histórico de vigilancia');
}

async function entregarArchivoAdmin(blob, nombre, titulo) {
    if (esAndroidNativo()) {
        const { uri } = await window.Capacitor.Plugins.Filesystem.writeFile({ path: `exportaciones/${Date.now()}-${nombre}`, directory: 'CACHE', recursive: true, data: await blobBase64(blob) });
        await window.Capacitor.Plugins.Share.share({ title: titulo, files: [uri], dialogTitle: 'Guardar o compartir archivo' });
    } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = nombre; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}
