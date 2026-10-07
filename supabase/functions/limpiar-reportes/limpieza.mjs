const DIAS_RETENCION = 15;
const TAMANO_LOTE = 100;
const MAX_LOTES = 10;

function comprobar(error, paso) {
    if (error) throw new Error(`${paso}: ${error.message}`);
}

// Se vuelve a consultar el primer lote después de borrarlo: no usar offset al eliminar.
export async function limpiarReportes(cliente, fechaLimite, resultado, { maxLotes = MAX_LOTES, reloj = Date.now } = {}) {
    const inicio = reloj();
    for (let lote = 0; lote < maxLotes && reloj() - inicio < 45000; lote++) {
        const { data: reportes, error } = await cliente.from('reportes')
            .select('id,evidencia_ruta').lt('creado_en', fechaLimite)
            .order('creado_en').order('id').limit(TAMANO_LOTE);
        comprobar(error, 'Consultar reportes');
        if (!reportes.length) return 'succeeded';

        const rutas = [...new Set(reportes.map(r => r.evidencia_ruta).filter(Boolean))];
        if (rutas.length) {
            const { data: fotos, error: errorFotos } = await cliente.storage.from('evidencias').remove(rutas);
            // Ante un fallo se conservan los reportes y sus rutas para reintentar.
            comprobar(errorFotos, 'Eliminar evidencias');
            resultado.fotos_eliminadas += fotos?.length || 0;
        }
        const { data: borrados, error: errorReportes } = await cliente.from('reportes')
            .delete().in('id', reportes.map(r => r.id)).lt('creado_en', fechaLimite).select('id');
        comprobar(errorReportes, 'Eliminar reportes');
        resultado.reportes_eliminados += borrados.length;
        if (reportes.length < TAMANO_LOTE) return 'succeeded';
    }
    // Consultar si queda trabajo al alcanzar el límite de tiempo/lotes.
    const { data, error } = await cliente.from('reportes').select('id').lt('creado_en', fechaLimite).limit(1);
    comprobar(error, 'Consultar pendientes');
    return data.length ? 'partial' : 'succeeded';
}

async function secretoValido(recibido, esperado) {
    if (!recibido) return false;
    const encoder = new TextEncoder();
    const [a, b] = await Promise.all([recibido, esperado].map(s => crypto.subtle.digest('SHA-256', encoder.encode(s))));
    const x = new Uint8Array(a), y = new Uint8Array(b);
    let diferencia = 0;
    for (let i = 0; i < x.length; i++) diferencia |= x[i] ^ y[i];
    return diferencia === 0;
}

export function crearHandlerLimpieza({ env, createClient, ahora = () => new Date() }) {
    return async request => {
        if (request.method !== 'POST') return Response.json({ error: 'Use POST' }, { status: 405, headers: { Allow: 'POST' } });
        const secreto = env('LIMPIEZA_SECRET');
        const url = env('SUPABASE_URL'), clave = env('SUPABASE_SERVICE_ROLE_KEY');
        if (!secreto || secreto.length < 32 || !url || !clave) {
            return Response.json({ error: 'Falta configurar la función de limpieza' }, { status: 503 });
        }
        if (!await secretoValido(request.headers.get('x-limpieza-secret'), secreto)) {
            return Response.json({ error: 'No autorizado' }, { status: 401 });
        }
        const fechaLimite = new Date(ahora().getTime() - DIAS_RETENCION * 86400000).toISOString();
        const resultado = { reportes_eliminados: 0, fotos_eliminadas: 0 };
        let cliente, ejecucion;
        try {
            cliente = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
            const { data, error } = await cliente.from('limpieza_ejecuciones')
                .insert({ estado: 'running', fecha_limite: fechaLimite }).select('id').single();
            comprobar(error, 'Registrar inicio');
            ejecucion = data.id;
            const estado = await limpiarReportes(cliente, fechaLimite, resultado);
            const { error: errorRegistro } = await cliente.from('limpieza_ejecuciones')
                .update({ ...resultado, estado, terminado_en: ahora().toISOString() }).eq('id', ejecucion);
            comprobar(errorRegistro, 'Registrar resultado');
            return Response.json({ id: ejecucion, estado, fecha_limite: fechaLimite, ...resultado });
        } catch (error) {
            console.error('Limpieza de reportes fallida', error.message);
            if (cliente && ejecucion) {
                try {
                    const { error: errorRegistro } = await cliente.from('limpieza_ejecuciones')
                        .update({ ...resultado, estado: 'failed', error: error.message, terminado_en: ahora().toISOString() }).eq('id', ejecucion);
                    if (errorRegistro) console.error('No se pudo registrar el fallo', errorRegistro.message);
                } catch { console.error('No se pudo registrar el fallo'); }
            }
            return Response.json({ id: ejecucion, estado: 'failed', ...resultado, error: 'Consulte limpieza_ejecuciones y los logs de la función' }, { status: 500 });
        }
    };
}
