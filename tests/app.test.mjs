import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { webcrypto } from 'node:crypto';
import ExcelJS from 'exceljs';

async function app(t) {
    const dom = new JSDOM(await readFile('docs/index.html', 'utf8'), {
        url: 'https://app.example.test', runScripts: 'outside-only', pretendToBeVisual: true
    });
    t.after(() => dom.window.close());
    const w = dom.window;
    w.TextEncoder = TextEncoder;
    Object.defineProperty(w.crypto, 'subtle', { value: webcrypto.subtle });
    w.eval(await readFile('docs/js/vendor/exceljs.min.js', 'utf8'));
    w.matchMedia = () => ({ matches: true });
    const avisos = [];
    w.alert = text => avisos.push(text);
    w.confirm = () => true;
    const state = { user: null, role: 'guardia', insertados: [], fallo: false };
    const contenido = nombre => ({ version: 6, tiposReportes: [{ id: 1, clave: 'rondin', nombre, activo: true, campos: [], plantilla: '*Rondín*', orden: 1 }], catalogos: [] });
    const datos = {
        ubicaciones: [{ id: 'norte', nombre: 'Planta Norte', activa: true }, { id: 'sur', nombre: 'Planta Sur', activa: true }],
        configuraciones_ubicacion: [{ id: 'pub1', ubicacion_id: 'norte', version: 1, contenido: contenido('Rondín Norte') }, { id: 'pub2', ubicacion_id: 'sur', version: 1, contenido: contenido('Rondín Sur') }],
        asignaciones: [], reportes: []
    };
    w.supabaseClient = {
        auth: {
            getUser: async () => ({ data: { user: state.user }, error: null }),
            getSession: async () => ({ data: { session: state.user ? { user: state.user } : null } }),
            signInWithPassword: async ({ email }) => { state.user = { id: 'cuenta', email }; return { data: { session: { user: state.user } } }; },
            signOut: async () => { state.user = null; return { data: {} }; }
        },
        from(tabla) {
            let filtros = [], uno = false, limite = Infinity, insertar, offset = 0;
            const predicados = [];
            const consulta = {
                select() { return this; }, eq(k,v) { filtros.push([k,v]); return this; },
                order() { return this; }, limit(n) { limite = n; return this; }, single() { uno = true; return this; },
                range(inicio, fin) { offset = inicio; limite = fin - inicio + 1; return this; },
                gte(k,v) { predicados.push(r => r[k] >= v); return this; },
                lt(k,v) { predicados.push(r => r[k] < v); return this; },
                lte(k,v) { predicados.push(r => r[k] <= v); return this; },
                ilike(k,v) { predicados.push(r => r[k].toLowerCase().includes(v.slice(1,-1).toLowerCase())); return this; },
                insert(row) { insertar = row; return this; },
                then(resolve, reject) {
                    if (state.fallo) return Promise.resolve({ error: { message: 'Sin conexión' } }).then(resolve, reject);
                    if (insertar) { state.insertados.push(insertar); return Promise.resolve({ data: null }).then(resolve,reject); }
                    const origen = tabla === 'perfiles' ? [{ id: 'cuenta', nombre: 'Ana', rol: state.role }] : datos[tabla];
                    const encontradas = origen.filter(r => filtros.every(([k,v]) => r[k] === v) && predicados.every(p => p(r)));
                    const filas = encontradas.slice(offset,offset + limite);
                    return Promise.resolve({ data: uno ? filas[0] : filas, count: encontradas.length }).then(resolve,reject);
                }
            };
            return consulta;
        },
        rpc: async (_, params) => {
            const actual = datos.configuraciones_ubicacion.find(p => p.ubicacion_id === params.destino);
            if (params.version_base !== actual.version) return { error: { message: 'Otra persona publicó cambios' } };
            const nueva = { ...actual, id: 'publicacion-nueva', version: actual.version + 1, contenido: params.contenido_nuevo };
            datos.configuraciones_ubicacion[datos.configuraciones_ubicacion.indexOf(actual)] = nueva;
            return { data: nueva };
        }
    };
    const cloud = await readFile('docs/js/cloud.js', 'utf8');
    const fuente = await readFile('docs/js/app.js', 'utf8');
    const contexto = await readFile('docs/js/report-context.js', 'utf8');
    const admin = await readFile('docs/js/admin-ui.js', 'utf8');
    w.eval(cloud + '\n' + contexto + '\n' + admin + '\n' + fuente.replace(/inicializarAplicacion\(\);\s*$/, '') + '\nwindow.prueba = { nube, get key() { return STORAGE_CONFIG_KEY; }, get preview() { return vistaPreviaActual; } };');
    return { w, state, datos, avisos };
}

test('inicio sin sesión, permisos locales y cierre de sesión', async t => {
    const { w, state } = await app(t);
    await w.inicializarAplicacion();
    assert.match(w.document.body.textContent, /Iniciar sesión/);
    w.localStorage.setItem('rv_admin_sesion','activa');
    assert.equal(w.sesionAdminActiva(),false);
    state.user = { id: 'cuenta', email: 'ana@example.test' };
    await w.cargarCuentaNube();
    w.mostrarInicio();
    assert.match(w.document.body.textContent,/Planta Norte/);
    assert.doesNotMatch(w.document.getElementById('appContent').textContent,/Administración/);
    w.mostrarPanelAdmin();
    assert.match(w.document.body.textContent,/Iniciar sesión/);
    await w.cerrarSesionAdmin();
    assert.equal(w.prueba.nube.usuario,null);
    assert.equal(w.prueba.nube.publicacion,null);
});

test('borradores por ubicación, publicación y reportes con versión publicada', async t => {
    const { w, state, avisos, datos } = await app(t);
    state.user = { id: 'cuenta', email: 'admin@example.test' }; state.role = 'admin';
    await w.cargarCuentaNube();
    await w.seleccionarUbicacionNube('norte',true);
    const keyNorte = w.prueba.key;
    const borrador = w.obtenerConfiguracion();
    borrador.tiposReportes[0].nombre = 'Rondín modificado';
    w.guardarConfiguracion(borrador);
    await w.seleccionarUbicacionNube('sur',true);
    assert.equal(w.obtenerConfiguracion().tiposReportes[0].nombre,'Rondín Sur');
    await w.seleccionarUbicacionNube('norte',true);
    assert.equal(w.obtenerConfiguracion().tiposReportes[0].nombre,'Rondín modificado');
    await w.publicarNube();
    assert.match(avisos.at(-1),/Versión 2 publicada/);
    assert.equal(w.localStorage.getItem(`${keyNorte}_base`),'2');
    datos.configuraciones_ubicacion[0].version = 3;
    await w.publicarNube();
    assert.match(avisos.at(-1),/Otra persona publicó/);
    state.role = 'guardia';
    await w.cargarCuentaNube();
    await w.seleccionarUbicacionNube('norte',false);
    w.mostrarMenuReportes();
    assert.match(w.document.body.textContent,/Rondín modificado/);
    w.mostrarReporte('rondin');
    w.generarVistaPrevia('rondin');
    assert.equal(w.prueba.preview.ubicacion_id,'norte');
    assert.equal(w.prueba.preview.configuracion_id,'publicacion-nueva');
    await w.guardarReporteEnSupabase(w.prueba.preview,null);
    assert.equal(state.insertados[0].ubicacion_id,'norte');
    assert.equal(state.insertados[0].configuracion_id,'publicacion-nueva');
    await w.guardarReporteEnSupabase(w.prueba.preview,null);
    assert.equal(state.insertados.length,1, 'reintentar un reporte guardado no lo duplica');
    await w.seleccionarUbicacionNube('sur',false);
    assert.equal(w.prueba.preview,null);
    assert.equal(w.obtenerConfiguracion().tiposReportes[0].nombre,'Rondín Sur');
    state.fallo = true;
    await assert.rejects(w.seleccionarUbicacionNube('norte',false),/Sin conexión/);
});

test('hora e identidad automáticas, unidad autorizada y vista previa con texto seguro', async t => {
    const { w, state, datos } = await app(t);
    state.user = { id: 'cuenta', email: 'ana@example.test' };
    datos.ubicaciones.splice(1);
    const configuracion = datos.configuraciones_ubicacion[0].contenido;
    configuracion.guardias = [{ id: 1, nombre: 'Otra persona', activo: true }];
    configuracion.catalogos = [{ clave: 'guardias', nombre: 'Guardias', activo: true }];
    configuracion.tiposReportes[0].campos = [
        { id: 1, nombre_campo: 'hora', etiqueta: 'Hora', tipo_campo: 'hora', activo: true, obligatorio: true },
        { id: 2, nombre_campo: 'nombre', etiqueta: 'Nombre', tipo_campo: 'catalogo', catalogo_origen: 'guardias', activo: true, obligatorio: true },
        { id: 3, nombre_campo: 'unidad', etiqueta: 'Unidad', tipo_campo: 'texto', activo: true, obligatorio: true },
        { id: 4, nombre_campo: 'observaciones', etiqueta: 'Observaciones', tipo_campo: 'textarea', activo: true }
    ];
    configuracion.tiposReportes[0].plantilla = '{{hora}} {{nombre}} {{unidad}}\n{{observaciones}}';
    await w.cargarCuentaNube();
    w.mostrarInicio();
    assert.equal(w.document.getElementById('ubicacionNube').value,'norte');
    await w.seleccionarUbicacionNube('norte',false);
    w.mostrarReporte('rondin');
    const form = w.document.getElementById('formReporte');
    assert.equal(form.querySelectorAll('[data-hora-selector]').length,0);
    assert.equal(form.elements.nombre.readOnly,true);
    assert.equal(form.elements.nombre.value,'Ana');
    assert.equal(form.elements.unidad.value,'Planta Norte');
    form.elements.hora.value = '01:01 inventada';
    form.elements.nombre.value = 'Suplantación';
    form.elements.unidad.value = 'Otra planta';
    form.elements.observaciones.value = '<img src=x onerror=alert(1)>' + ' mensaje largo'.repeat(1000);
    w.generarVistaPrevia('rondin');
    const reporte = w.prueba.preview;
    assert.equal(reporte.valores.nombre,'Ana');
    assert.equal(reporte.valores.unidad,'Planta Norte');
    assert.equal(reporte.valores.vigilante_id,'cuenta');
    assert.notEqual(reporte.valores.hora,'01:01 inventada');
    assert.equal(reporte.valores.hora,new w.Date(reporte.valores.registrado_dispositivo).toLocaleTimeString('es-MX',{hour:'numeric',minute:'2-digit',hour12:true}).toLowerCase());
    assert.equal(w.document.querySelector('.preview-message img'),null);
    assert.ok(w.document.querySelector('.preview-scroll .preview-message'));
    assert.ok(w.document.querySelector('.preview-actions #btnWhatsApp'));
    assert.equal(w.document.querySelector('.preview-scroll #btnWhatsApp'),null);
    assert.equal(w.document.getElementById('evidenciaReporte').getAttribute('capture'),'environment');
    w.editarReporteDesdeVistaPrevia('rondin');
    assert.equal(w.document.getElementById('formReporte').elements.nombre.value,'Ana');
});

test('foto subida antes de compartir, cancelar y reintentar sin duplicar', async t => {
    const { w, state } = await app(t);
    state.user = { id: 'cuenta', email: 'ana@example.test' };
    await w.cargarCuentaNube();
    await w.seleccionarUbicacionNube('norte',false);
    w.mostrarReporte('rondin'); w.generarVistaPrevia('rondin');
    const foto = new w.File(['foto original'], 'camara.jpg', { type: 'image/jpeg' });
    w.seleccionarEvidencia({ files: [foto] });
    w.seleccionarEvidencia({ files: [] }); // Cancelar no elimina la foto anterior.
    w.comprimirEvidencia = async () => new w.Blob(['foto comprimida'], { type: 'image/jpeg' });
    const subidas = [], compartidos = [], archivos = [];
    w.supabaseClient.storage = { from: () => ({ upload: async (ruta, file) => { subidas.push({ruta,file}); return {}; } }) };
    w.Capacitor = {
        getPlatform: () => 'android',
        Plugins: {
            Filesystem: { writeFile: async opciones => { archivos.push(opciones); return {uri:'file:///cache/evidencia.jpg'}; } },
            Share: { share: async opciones => {
                assert.equal(state.insertados.length,1);
                assert.equal(subidas.length,1);
                compartidos.push(opciones);
                if (compartidos.length === 1) throw new Error('Share canceled');
            } }
        }
    };
    await w.abrirWhatsApp();
    assert.match(w.document.getElementById('estadoEnvio').textContent,/canceló/);
    assert.equal(w.document.getElementById('btnWhatsApp').disabled,false);
    assert.equal(w.document.getElementById('evidenciaReporte').disabled,true);
    assert.equal(subidas[0].file.type,'image/jpeg');
    assert.equal(archivos[0].directory,'CACHE');
    assert.equal(archivos[0].data,Buffer.from('foto comprimida').toString('base64'));
    assert.deepEqual(Array.from(compartidos[0].files),['file:///cache/evidencia.jpg']);
    assert.equal(compartidos[0].text,w.prueba.preview.mensaje_whatsapp);
    await w.abrirWhatsApp();
    assert.equal(compartidos.length,2);
    assert.equal(state.insertados.length,1);
    assert.equal(subidas.length,1);
});

test('no se abre compartir si falla el guardado y web conserva el clic para compartir', async t => {
    const { w, state } = await app(t);
    state.user = { id: 'cuenta', email: 'ana@example.test' };
    await w.cargarCuentaNube(); await w.seleccionarUbicacionNube('norte',false);
    w.mostrarReporte('rondin'); w.generarVistaPrevia('rondin');
    let abierto = 0;
    w.open = () => { abierto++; };
    state.fallo = true;
    await w.abrirWhatsApp();
    assert.equal(abierto,0);
    assert.match(w.document.getElementById('estadoEnvio').textContent,/No se pudo guardar/);
    state.fallo = false;
    await w.abrirWhatsApp();
    assert.equal(abierto,0);
    await w.abrirWhatsApp();
    assert.equal(abierto,1);
    assert.equal(state.insertados.length,1);
});

test('el acceso avanzado exige administrador, código y caduca sin persistirse', async t => {
    const { w, state } = await app(t);
    state.user = { id: 'cuenta', email: 'ana@example.test' };
    await w.cargarCuentaNube();
    assert.equal(await w.validarCodigoAvanzado('1a2b3c*'),false);
    state.role = 'admin'; await w.cargarCuentaNube();
    await w.seleccionarUbicacionNube('norte',true);
    w.mostrarAdminDatos();
    assert.ok(w.document.getElementById('codigoAvanzado'));
    assert.equal(await w.validarCodigoAvanzado('incorrecto'),false);
    assert.equal(await w.validarCodigoAvanzado('1a2b3c*'),true);
    w.mostrarAvanzada();
    assert.match(w.document.body.textContent,/Acceso habilitado/);
    const ahora = w.Date.now;
    w.Date.now = () => ahora() + 11 * 60 * 1000;
    assert.equal(w.avanzadaActiva(),false);
    w.Date.now = ahora;
    await w.validarCodigoAvanzado('1a2b3c*');
    await w.cerrarSesionAdmin();
    assert.equal(w.avanzadaActiva(),false);
});

test('histórico paginado, filtros y Excel completo con mensajes largos como texto', async t => {
    const { w, state, datos } = await app(t);
    state.user = { id: 'cuenta', email: 'admin@example.test' }; state.role = 'admin';
    await w.cargarCuentaNube();
    datos.reportes = Array.from({length:1203},(_,i) => ({ id: `reporte-${i}`, creado_por: 'cuenta', creado_en:'2026-01-20T12:00:00.000Z', ubicacion_id: i === 1202 ? 'sur' : 'norte', tipo_nombre:'Rondín', valores:{vigilante:'Ana',nota:'=1+1'}, mensaje_whatsapp:i === 0 ? 'a'.repeat(65000) : 'Todo correcto' }));
    await w.mostrarHistorico();
    assert.equal(w.document.querySelectorAll('.history-card').length,50);
    assert.match(w.document.getElementById('resumenHistorico').textContent,/1203/);
    const filtros = { unidad:'norte', desde:'2026-01-20', hasta:'2026-01-20', corte:'2026-01-31T00:00:00.000Z' };
    const todos = await w.obtenerTodosHistorico(filtros);
    assert.equal(todos.length,1202);
    assert.throws(() => w.limitesFechasHistorico('2026-01-21','2026-01-20'),/rango de fechas/);
    const buffer = await w.crearExcelHistorico(todos,datos.ubicaciones,[{id:'cuenta',nombre:'Ana'}],filtros);
    const libro = new ExcelJS.Workbook(); await libro.xlsx.load(Buffer.from(buffer));
    assert.equal(libro.getWorksheet('Reportes').rowCount,1203);
    const respuestas = libro.getWorksheet('Respuestas');
    assert.equal(respuestas.getRow(3).getCell(5).value,'=1+1');
    assert.equal(respuestas.getRow(3).getCell(5).type,ExcelJS.ValueType.String);
    const mensajes = libro.getWorksheet('Mensajes');
    assert.equal([2,3,4].map(i => mensajes.getRow(i).getCell(3).value).join('').length,65000);
    assert.equal(libro.getWorksheet('Consulta').getRow(9).getCell(2).value,1202);
});
