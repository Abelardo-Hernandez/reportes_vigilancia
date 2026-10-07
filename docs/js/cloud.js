/* Administración central. Los permisos efectivos se verifican con RLS en Supabase. */
const nube = { usuario: null, perfil: null, ubicaciones: [], ubicacion: null, publicacion: null, vigilante: null };

function escaparNube(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function clienteNube() {
    if (!window.supabaseClient) throw new Error('No se pudo conectar. Compruebe su conexión a internet y vuelva a abrir la app.');
    return window.supabaseClient;
}

async function resultadoNube(consulta) {
    const { data, error } = await consulta;
    if (error) throw new Error(error.message);
    return data;
}

function limpiarContextoNube() {
    bloquearAvanzada();
    nube.vigilante = null;
    nube.usuario = null;
    nube.perfil = null;
    nube.ubicaciones = [];
    nube.ubicacion = null;
    nube.publicacion = null;
    adminActual = null;
    formularioActual = null;
    vistaPreviaActual = null;
    evidenciaActual = null;
    valoresReporteActual = {};
    STORAGE_CONFIG_KEY = 'rv_sin_ubicacion';
}

async function cargarCuentaNube() {
    limpiarContextoNube();
    const { data, error } = await clienteNube().auth.getUser();
    if (error || !data.user || data.user.is_anonymous) return false;
    const perfil = await resultadoNube(clienteNube().from('perfiles').select('id,rol,nombre,correo').eq('id', data.user.id).single());
    nube.usuario = data.user;
    nube.perfil = perfil;
    adminActual = perfil.rol === 'admin' ? perfil : null;
    await cargarUbicacionesNube();
    return true;
}

async function cargarUbicacionesNube() {
    nube.ubicaciones = await resultadoNube(clienteNube().from('ubicaciones').select('*').order('nombre'));
    if (nube.ubicacion && !nube.ubicaciones.some(u => u.id === nube.ubicacion.id && u.activa)) {
        nube.ubicacion = null;
        nube.publicacion = null;
    }
}

function mostrarAccesoNube(mensaje = '') {
    registrarNavegacion('login');
    cambiarHeader('PT REPORTES', 'Administración y vigilancia por ubicación');
    appContent.className = 'app-content access-content';
    appContent.innerHTML = `
      <form id="accesoNube" class="login-card workspace-card">
        <span class="eyebrow">BIENVENIDO A PT REPORTES</span>
        <h2>Iniciar sesión</h2>
        <p>Entre con su cuenta para recibir los formularios de sus ubicaciones.</p>
        <label for="correoNube">Correo electrónico</label>
        <input id="correoNube" name="email" type="email" autocomplete="username" required>
        <label for="claveNube">Contraseña</label>
        <input id="claveNube" name="password" type="password" autocomplete="current-password" required minlength="8">
        <label for="nombreNube">Nombre de la cuenta o unidad (solo para crear una cuenta)</label>
        <input id="nombreNube" name="nombre" autocomplete="name" maxlength="120">
        <button class="btn-main-small" type="submit">Ingresar</button>
        <button class="btn-secondary-small" type="submit" name="registro" value="si">Crear cuenta de unidad</button>
        <p id="mensajeNube" role="status">${escaparNube(mensaje)}</p>
      </form>`;
    document.getElementById('accesoNube').addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const campos = new FormData(form);
        const registro = event.submitter?.name === 'registro';
        form.querySelectorAll('button').forEach(b => b.disabled = true);
        try {
            const credenciales = { email: campos.get('email').trim(), password: campos.get('password') };
            if (registro) {
                if (!campos.get('nombre').trim()) throw new Error('Escriba su nombre para crear la cuenta.');
                const data = await resultadoNube(clienteNube().auth.signUp({ ...credenciales, options: { data: { nombre: campos.get('nombre').trim() } } }));
                if (!data.session) {
                    document.getElementById('mensajeNube').textContent = 'Revise su correo para confirmar la cuenta. Después ingrese aquí. El administrador deberá asignarle una ubicación.';
                    return;
                }
            } else {
                await resultadoNube(clienteNube().auth.signInWithPassword(credenciales));
            }
            if (!await cargarCuentaNube()) throw new Error('No se pudo verificar la cuenta. Intente ingresar nuevamente.');
            mostrarInicio();
        } catch (error) {
            limpiarContextoNube();
            document.getElementById('mensajeNube').textContent = error.message;
        } finally {
            form.querySelectorAll('button').forEach(b => b.disabled = false);
        }
    });
}

function mostrarInicioNube(opciones = {}) {
    if (!nube.usuario) return mostrarAccesoNube();
    registrarNavegacion('inicio', {}, opciones);
    cambiarHeader('PT REPORTES', `${nube.perfil.nombre || nube.usuario.email} · ${sesionAdminActiva() ? 'Administrador' : 'Vigilante'}`);
    const disponibles = nube.ubicaciones.filter(u => u.activa);
    const seleccionada = nube.ubicacion?.id || (disponibles.length === 1 ? disponibles[0].id : '');
    appContent.className = 'app-content home-actions';
    appContent.innerHTML = `
      <div class="home-brand"><img src="img/logo.png" alt="Punto Textil"></div>
      <section class="workspace-card cloud-card">
        <span class="eyebrow">SU JORNADA</span>
        <h2>Crear un reporte</h2>
        <label for="ubicacionNube">Unidad de trabajo (planta o sucursal)</label>
        <select id="ubicacionNube"><option value="">Seleccione una unidad</option>${disponibles.map(u => `<option value="${u.id}" ${seleccionada === u.id ? 'selected' : ''}>${escaparNube(u.nombre)}</option>`).join('')}</select>
        <label for="vigilanteNube">¿Quién está reportando?</label>
        <select id="vigilanteNube" disabled><option value="">Seleccione primero una unidad</option></select>
        <p id="estadoVigilantesNube" role="status"></p>
        ${!disponibles.length ? '<p>No tiene ubicaciones asignadas. Solicite la asignación a su administrador y pulse Actualizar.</p>' : ''}
        <p>Los formularios se actualizan al entrar a reportar. Se necesita internet para enviar el reporte.</p>
        <button class="btn-main-small" id="nuevoReporteNube" ${!disponibles.length ? 'disabled' : ''}>Nuevo reporte</button>
        <button class="btn-secondary-small" id="actualizarCuentaNube">Actualizar ubicaciones</button>
      </section>
      ${sesionAdminActiva() ? '<button class="btn-admin" onclick="mostrarPanelAdmin()">Administración</button>' : ''}
      <button class="btn-volver" onclick="cerrarSesionAdmin()">Cerrar sesión</button>
      <span class="app-version">v. ${APP_VERSION}</span>`;
    document.getElementById('nuevoReporteNube').onclick = async event => {
        const id = document.getElementById('ubicacionNube').value;
        if (!id) return alert('Seleccione la ubicación donde está trabajando.');
        event.currentTarget.disabled = true;
        try {
            const vigilanteId = document.getElementById('vigilanteNube').value;
            if (!vigilanteId) throw new Error('Seleccione el vigilante que está reportando.');
            await seleccionarUbicacionNube(id, false);
            nube.vigilante = await resultadoNube(clienteNube().from('vigilantes').select('*').eq('id', vigilanteId).eq('ubicacion_id', id).eq('activo', true).single());
            mostrarMenuReportes();
        } catch (error) { alert(error.message); }
        finally { if (document.getElementById('nuevoReporteNube')) document.getElementById('nuevoReporteNube').disabled = false; }
    };
    const unidadSelector = document.getElementById('ubicacionNube');
    const vigilanteSelector = document.getElementById('vigilanteNube');
    let solicitudVigilantes = 0;
    const cargarVigilantes = async () => {
        const solicitud = ++solicitudVigilantes;
        const unidadId = unidadSelector.value;
        vigilanteSelector.disabled = true;
        vigilanteSelector.innerHTML = '<option value="">Seleccione un vigilante</option>';
        const estado = document.getElementById('estadoVigilantesNube');
        estado.textContent = unidadId ? 'Cargando vigilantes…' : '';
        if (!unidadId) return;
        try {
            const vigilantes = await resultadoNube(clienteNube().from('vigilantes').select('*').eq('ubicacion_id', unidadId).eq('activo', true).order('nombre'));
            if (solicitud !== solicitudVigilantes || !vigilanteSelector.isConnected) return;
            vigilanteSelector.innerHTML += vigilantes.map(v => `<option value="${v.id}">${escaparNube(v.nombre)}</option>`).join('');
            vigilanteSelector.disabled = !vigilantes.length;
            estado.textContent = vigilantes.length ? 'Seleccione su nombre en cada relevo.' : 'El administrador debe registrar vigilantes en esta unidad.';
        } catch (error) { if (solicitud === solicitudVigilantes && estado.isConnected) estado.textContent = error.message; }
    };
    unidadSelector.onchange = cargarVigilantes;
    cargarVigilantes();
    document.getElementById('actualizarCuentaNube').onclick = async () => {
        try { await cargarCuentaNube(); mostrarInicio(); } catch (error) { mostrarAccesoNube(error.message); }
    };
}

async function seleccionarUbicacionNube(id, editar) {
    const ubicacion = await resultadoNube(clienteNube().from('ubicaciones').select('*').eq('id', id).eq('activa', true).single());
    const versiones = await resultadoNube(clienteNube().from('configuraciones_ubicacion').select('*').eq('ubicacion_id', id).order('version', { ascending: false }).limit(1));
    const publicacion = versiones[0] || null;
    if (!editar && !publicacion) throw new Error('El administrador aún no ha publicado formularios para esta ubicación.');
    nube.vigilante = null;
    nube.ubicacion = ubicacion;
    nube.publicacion = publicacion;
    formularioActual = null;
    vistaPreviaActual = null;
    evidenciaActual = null;
    valoresReporteActual = {};
    adminTipoReporteSeleccionado = null;
    adminCampoEditandoId = null;
    adminCatalogoSeleccionado = null;
    STORAGE_CONFIG_KEY = `rv_${editar ? 'borrador' : 'publicado'}_${nube.usuario.id}_${id}`;
    if (!editar || !localStorage.getItem(STORAGE_CONFIG_KEY)) {
        guardarConfiguracion(publicacion?.contenido || crearConfiguracionInicial(), { preservarCatalogos: false });
        if (editar) localStorage.setItem(`${STORAGE_CONFIG_KEY}_base`, String(publicacion?.version || 0));
    }
}

function requiereEditorNube() {
    if (!sesionAdminActiva()) { mostrarAccesoNube(); return false; }
    if (!nube.ubicacion || !STORAGE_CONFIG_KEY.startsWith('rv_borrador_')) {
        alert('Primero seleccione una ubicación para configurar.');
        mostrarGestionNube();
        return false;
    }
    return true;
}

async function mostrarGestionNube(opciones = {}) {
    if (!sesionAdminActiva()) return mostrarAccesoNube();
    registrarNavegacion('adminUbicaciones', {}, opciones);
    cambiarHeader('UNIDADES Y VIGILANTES', 'Enlace correos a unidades y registre sus vigilantes');
    appContent.className = 'app-content admin-dashboard';
    appContent.innerHTML = '<p role="status">Cargando ubicaciones y cuentas…</p>';
    try {
        const [ubicaciones, perfiles, asignaciones, vigilantes] = await Promise.all([
            resultadoNube(clienteNube().from('ubicaciones').select('*').order('nombre')),
            resultadoNube(clienteNube().from('perfiles').select('id,nombre,correo,rol').order('nombre')),
            resultadoNube(clienteNube().from('asignaciones').select('*')),
            resultadoNube(clienteNube().from('vigilantes').select('*').order('nombre'))
        ]);
        if (vistaActual !== 'adminUbicaciones' || !sesionAdminActiva()) return;
        nube.ubicaciones = ubicaciones;
        appContent.innerHTML = `
          <div class="section-tabs" role="tablist" aria-label="Administrar"><button role="tab" id="tabUnidades" aria-selected="true" aria-controls="gestionUnidades">Unidades (${ubicaciones.length})</button><button role="tab" id="tabVigilantes" aria-selected="false" aria-controls="gestionVigilantes">Correos de acceso (${perfiles.filter(p => p.rol === 'guardia' && p.correo).length})</button></div>
          <section id="gestionUnidades" class="gestion-section" role="tabpanel" aria-labelledby="tabUnidades">
          <form id="crearUbicacionNube" class="workspace-card"><span class="eyebrow">PLANTAS Y SUCURSALES</span><label for="nombreUbicacion">Nueva unidad</label><input id="nombreUbicacion" name="nombre" required maxlength="120" placeholder="Ej. Planta Norte"><button class="btn-main-small">Crear unidad</button></form>
          <section class="workspace-card"><span class="eyebrow">ADMINISTRAR UNIDAD</span>
          <label for="unidadGestionNube">Unidad de trabajo</label>
          <select id="unidadGestionNube" ${!ubicaciones.length ? 'disabled' : ''}><option value="">Seleccione una unidad</option>${ubicaciones.map(u => `<option value="${escaparNube(u.id)}">${escaparNube(u.nombre)}${u.activa ? '' : ' (inactiva)'}</option>`).join('')}</select>
          <div id="listaUbicacionesNube" class="unit-detail" aria-live="polite"></div></section>
          </section><section id="gestionVigilantes" class="gestion-section" role="tabpanel" aria-labelledby="tabVigilantes" hidden>
          <details class="workspace-card"><summary>Correos de acceso a unidades</summary><div class="directory-list">${perfiles.filter(p => p.rol === 'guardia' && p.correo).map(p => `<div><strong>${escaparNube(p.nombre || p.correo)}</strong><small>${escaparNube(p.correo)}</small><span class="status-pill">${asignaciones.filter(a => a.usuario_id === p.id).length} unidades asignadas</span></div>`).join('') || '<p>Aún no hay cuentas de unidades.</p>'}</div></details>
          <form id="asignarNube" class="workspace-card"><h2>Asignar unidad</h2><p>Seleccione una cuenta y la unidad que puede cubrir. Para quitarle acceso, use Retirar en la lista inferior.</p><small>Las cuentas nuevas se registran desde la pantalla de acceso.</small>
            <label for="usuarioAsignado">Correo de la unidad</label><select id="usuarioAsignado" name="usuario" required><option value="">Seleccione una cuenta</option>${perfiles.filter(p => p.rol === 'guardia' && p.correo).map(p => `<option value="${p.id}">${escaparNube(p.correo)}</option>`).join('')}</select>
            <label for="ubicacionAsignada">Ubicación</label><select id="ubicacionAsignada" name="ubicacion" required><option value="">Seleccione una ubicación</option>${ubicaciones.filter(u => u.activa).map(u => `<option value="${u.id}">${escaparNube(u.nombre)}</option>`).join('')}</select><button class="btn-main-small">Asignar ubicación</button>
          </form><div id="listaAsignacionesNube" class="admin-list"></div></section>
          <button class="btn-volver" onclick="mostrarPanelAdmin()">Volver</button>`;
        const cambiarSeccion = vigilantes => {
            document.getElementById('gestionUnidades').hidden = vigilantes;
            document.getElementById('gestionVigilantes').hidden = !vigilantes;
            document.getElementById('tabUnidades').setAttribute('aria-selected', String(!vigilantes));
            document.getElementById('tabVigilantes').setAttribute('aria-selected', String(vigilantes));
        };
        document.getElementById('tabUnidades').onclick = () => cambiarSeccion(false);
        document.getElementById('tabVigilantes').onclick = () => cambiarSeccion(true);
        cambiarSeccion(Boolean(opciones.vigilantes));
        const lista = document.getElementById('listaUbicacionesNube');
        const selectorUnidad = document.getElementById('unidadGestionNube');
        const mostrarUnidad = () => {
            lista.replaceChildren();
            const u = ubicaciones.find(unidad => unidad.id === selectorUnidad.value);
            if (!u) {
                lista.innerHTML = `<p class="empty-inline">${ubicaciones.length ? 'Seleccione una unidad para configurar sus formularios, cambiar su nombre o su estado.' : 'Aún no hay unidades. Cree la primera para comenzar.'}</p>`;
                return;
            }
            const card = document.createElement('div');
            card.className = 'unit-actions';
            card.innerHTML = `<strong>${escaparNube(u.nombre)}</strong><span class="status-pill">${u.activa ? 'Activa' : 'Inactiva'}</span><button class="btn-main-small" ${!u.activa ? 'disabled' : ''}>Configurar formularios y catálogos</button><button class="btn-secondary-small">${u.activa ? 'Desactivar' : 'Activar'}</button>`;
            card.querySelectorAll('button')[0].onclick = () => ejecutarNube(async () => { await seleccionarUbicacionNube(u.id, true); mostrarPanelAdmin(); });
            card.querySelectorAll('button')[1].onclick = () => ejecutarNube(async () => {
                if (u.activa && !confirm(`¿Desactivar ${u.nombre}? Los vigilantes dejarán de poder enviar reportes en esta unidad.`)) return;
                await resultadoNube(clienteNube().from('ubicaciones').update({ activa: !u.activa }).eq('id', u.id));
                if (nube.ubicacion?.id === u.id) { nube.ubicacion = null; nube.publicacion = null; }
                await mostrarGestionNube({ desdeHistorial: true, unidad: u.id });
            });
            const editar = document.createElement('button'); editar.className = 'text-button'; editar.textContent = 'Editar nombre de la unidad';
            editar.onclick = () => ejecutarNube(async () => {
                const nuevo = prompt('Nombre de la unidad', u.nombre)?.trim();
                if (!nuevo || nuevo === u.nombre) return;
                if (nuevo.length > 120) throw new Error('El nombre debe tener como máximo 120 caracteres.');
                await resultadoNube(clienteNube().from('ubicaciones').update({ nombre: nuevo }).eq('id', u.id));
                if (nube.ubicacion?.id === u.id) nube.ubicacion.nombre = nuevo;
                await mostrarGestionNube({ desdeHistorial: true, unidad: u.id });
            });
            card.appendChild(editar);
            const personal = document.createElement('section');
            personal.className = 'workspace-card';
            personal.innerHTML = `<h3>Vigilantes de ${escaparNube(u.nombre)}</h3><form id="crearVigilanteNube"><label>Nombre del vigilante<input name="nombre" required maxlength="120"></label><button class="btn-main-small">Registrar vigilante</button></form><div class="directory-list"></div>`;
            personal.querySelector('form').onsubmit = event => {
                event.preventDefault();
                const nombre = new FormData(event.currentTarget).get('nombre').trim();
                if (!nombre) return;
                ejecutarNube(async () => {
                    await resultadoNube(clienteNube().from('vigilantes').insert({ ubicacion_id: u.id, nombre }));
                    await mostrarGestionNube({ desdeHistorial: true, unidad: u.id });
                });
            };
            for (const v of vigilantes.filter(v => v.ubicacion_id === u.id)) {
                const fila = document.createElement('div');
                fila.innerHTML = `<strong>${escaparNube(v.nombre)}</strong><span>${v.activo ? 'Activo' : 'Inactivo'}</span><button type="button">${v.activo ? 'Desactivar' : 'Activar'}</button>`;
                fila.querySelector('button').onclick = () => ejecutarNube(async () => {
                    await resultadoNube(clienteNube().from('vigilantes').update({ activo: !v.activo }).eq('id', v.id));
                    await mostrarGestionNube({ desdeHistorial: true, unidad: u.id });
                });
                personal.querySelector('.directory-list').appendChild(fila);
            }
            lista.appendChild(card);
            lista.appendChild(personal);
        };
        selectorUnidad.value = opciones.unidad || nube.ubicacion?.id || (ubicaciones.length === 1 ? ubicaciones[0].id : '');
        selectorUnidad.onchange = mostrarUnidad;
        mostrarUnidad();
        asignaciones.forEach(a => {
            const p = perfiles.find(p => p.id === a.usuario_id);
            const u = ubicaciones.find(u => u.id === a.ubicacion_id);
            const card = document.createElement('div');
            card.className = 'admin-field-card';
            card.innerHTML = `<span>${escaparNube(p?.nombre || p?.correo || a.usuario_id)} → ${escaparNube(u?.nombre)}</span><button type="button">Retirar</button>`;
            card.querySelector('button').onclick = () => ejecutarNube(async () => {
                if (!confirm(`¿Retirar a ${p?.correo || 'esta cuenta'} de ${u?.nombre}? Sus reportes anteriores se conservan.`)) return;
                await resultadoNube(clienteNube().from('asignaciones').delete().eq('usuario_id', a.usuario_id).eq('ubicacion_id', a.ubicacion_id));
                await mostrarGestionNube({ desdeHistorial: true, vigilantes: true });
            });
            document.getElementById('listaAsignacionesNube').appendChild(card);
        });
        document.getElementById('crearUbicacionNube').onsubmit = event => {
            event.preventDefault();
            const nombre = new FormData(event.currentTarget).get('nombre').trim();
            if (!nombre) return;
            ejecutarNube(async () => { await resultadoNube(clienteNube().from('ubicaciones').insert({ nombre })); await mostrarGestionNube({ desdeHistorial: true }); });
        };
        document.getElementById('asignarNube').onsubmit = event => {
            event.preventDefault();
            const datos = new FormData(event.currentTarget);
            if (asignaciones.some(a => a.usuario_id === datos.get('usuario') && a.ubicacion_id === datos.get('ubicacion'))) return alert('Esta unidad ya está habilitada para esta cuenta.');
            ejecutarNube(async () => {
                await resultadoNube(clienteNube().from('asignaciones').insert({ usuario_id: datos.get('usuario'), ubicacion_id: datos.get('ubicacion') }));
                await mostrarGestionNube({ desdeHistorial: true, vigilantes: true });
            });
        };
    } catch (error) {
        appContent.innerHTML = `<div class="info-card">${escaparNube(error.message)}</div><button class="btn-volver" onclick="mostrarPanelAdmin()">Volver</button>`;
    }
}

async function ejecutarNube(accion) {
    try { await accion(); } catch (error) { alert(error.message); }
}

async function publicarNube() {
    if (!requiereEditorNube()) return;
    const boton = document.getElementById('publicarNube');
    if (boton) boton.disabled = true;
    try {
        const contenido = obtenerConfiguracion();
        if (!contenido.tiposReportes.some(t => t.activo)) throw new Error('Agregue al menos un formulario activo antes de publicar.');
        const key = STORAGE_CONFIG_KEY;
        const publicacion = await resultadoNube(clienteNube().rpc('publicar_configuracion', {
            destino: nube.ubicacion.id, contenido_nuevo: contenido,
            version_base: Number(localStorage.getItem(`${key}_base`) || 0)
        }));
        localStorage.setItem(`${key}_base`, String(publicacion.version));
        nube.publicacion = publicacion;
        alert(`Versión ${publicacion.version} publicada. Los vigilantes la recibirán al entrar a Nuevo reporte.`);
        mostrarPanelAdmin();
    } catch (error) { alert(error.message); }
    finally { if (boton) boton.disabled = false; }
}

async function recargarPublicacionNube() {
    if (!requerirAvanzada()) return;
    if (!requiereEditorNube() || !confirm('¿Reemplazar el borrador local por la última versión publicada? Exporte primero si desea conservar sus cambios.')) return;
    await ejecutarNube(async () => {
        const versiones = await resultadoNube(clienteNube().from('configuraciones_ubicacion').select('*').eq('ubicacion_id', nube.ubicacion.id).order('version', { ascending: false }).limit(1));
        nube.publicacion = versiones[0] || null;
        guardarConfiguracion(nube.publicacion?.contenido || crearConfiguracionInicial(), { preservarCatalogos: false });
        localStorage.setItem(`${STORAGE_CONFIG_KEY}_base`, String(nube.publicacion?.version || 0));
        mostrarPanelAdmin();
    });
}

function recuperarConfiguracionAnterior() {
    if (!requerirAvanzada()) return;
    if (!requiereEditorNube()) return;
    const anterior = localStorage.getItem('rv_configuracion');
    if (!anterior) return alert('Este dispositivo no tiene una configuración de la versión anterior. Puede importar su archivo JSON.');
    if (!confirm('¿Copiar la configuración anterior al borrador de esta ubicación? Después deberá publicarla.')) return;
    try {
        const configuracion = JSON.parse(anterior);
        if (!Array.isArray(configuracion.tiposReportes)) throw new Error('Configuración anterior inválida.');
        guardarConfiguracion(migrarConfiguracion(configuracion), { preservarCatalogos: false });
        alert('Configuración recuperada en el borrador. Revísela y publique cuando esté lista.');
    } catch (error) { alert(error.message); }
}

async function mostrarHistorialNube(opciones = {}) {
    if (!sesionAdminActiva()) return mostrarAccesoNube();
    registrarNavegacion('adminHistorial', {}, opciones);
    cambiarHeader('REPORTES', 'Últimos 100 reportes por ubicación');
    appContent.className = 'app-content admin-formularios';
    appContent.innerHTML = '<p>Cargando reportes…</p>';
    try {
        await cargarUbicacionesNube();
        appContent.innerHTML = `<label for="filtroUbicacion">Ubicación</label><select id="filtroUbicacion"><option value="">Todas las ubicaciones</option>${nube.ubicaciones.map(u => `<option value="${u.id}">${escaparNube(u.nombre)}</option>`).join('')}</select><div id="reportesNube" class="admin-list"></div><button class="btn-volver" onclick="mostrarPanelAdmin()">Volver</button>`;
        let solicitud = 0;
        const cargar = async () => {
            const numero = ++solicitud;
            const destino = document.getElementById('reportesNube');
            destino.textContent = 'Cargando…';
            try {
                let consulta = clienteNube().from('reportes').select('id,tipo_nombre,creado_en,ubicacion_id,configuracion_id,mensaje_whatsapp,evidencia_ruta').order('creado_en', { ascending: false }).limit(100);
                const filtro = document.getElementById('filtroUbicacion').value;
                if (filtro) consulta = consulta.eq('ubicacion_id', filtro);
                const reportes = await resultadoNube(consulta);
                if (numero !== solicitud || !destino.isConnected) return;
                destino.innerHTML = reportes.length ? '' : '<p>Aún no hay reportes.</p>';
                reportes.forEach(r => {
                    const card = document.createElement('div');
                    card.className = 'form-card cloud-card';
                    card.innerHTML = `<strong>${escaparNube(r.tipo_nombre)}</strong><span>${escaparNube(nube.ubicaciones.find(u => u.id === r.ubicacion_id)?.nombre || 'Sin ubicación (reporte anterior)')}</span><small>${escaparNube(new Date(r.creado_en).toLocaleString('es-MX'))}</small><pre class="cloud-message">${escaparNube(r.mensaje_whatsapp)}</pre>`;
                    if (r.evidencia_ruta) {
                        const button = document.createElement('button');
                        button.className = 'btn-secondary-small';
                        button.textContent = 'Ver evidencia';
                        button.onclick = () => ejecutarNube(async () => {
                            const data = await resultadoNube(clienteNube().storage.from('evidencias').createSignedUrl(r.evidencia_ruta, 60));
                            const img = document.createElement('img');
                            img.src = data.signedUrl; img.alt = 'Evidencia del reporte'; img.style.maxWidth = '100%';
                            button.replaceWith(img);
                        });
                        card.appendChild(button);
                    }
                    destino.appendChild(card);
                });
            } catch (error) { destino.textContent = error.message; }
        };
        document.getElementById('filtroUbicacion').onchange = cargar;
        await cargar();
    } catch (error) { appContent.innerHTML = `<p>${escaparNube(error.message)}</p><button class="btn-volver" onclick="mostrarPanelAdmin()">Volver</button>`; }
}
