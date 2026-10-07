// Fuentes automáticas compatibles con formularios publicados anteriormente.
function fuenteAutomatica(campo) {
    if (campo.tipo_campo === 'hora' || campo.nombre_campo === 'hora') return 'hora';
    if (campo.catalogo_origen === 'guardias' || ['guardia', 'vigilante', 'nombre_guardia', 'nombre_vigilante'].includes(campo.nombre_campo)) return 'vigilante';
    if (['unidad', 'ubicacion'].includes(campo.nombre_campo)) return 'unidad';
    if (['hora', 'vigilante', 'unidad'].includes(campo.fuente_dato)) return campo.fuente_dato;
    return '';
}

function datosAutomaticosReporte(instante = new Date()) {
    const vigilante = nube.vigilante?.nombre?.trim() || '';
    const unidad = nube.ubicacion?.nombre || '';
    return {
        hora: instante.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase(),
        fecha: instante.toLocaleDateString('es-MX'),
        vigilante, guardia: vigilante, nombre_guardia: vigilante, nombre_vigilante: vigilante,
        unidad, ubicacion: unidad,
        vigilante_id: nube.vigilante?.id || '', registrado_dispositivo: instante.toISOString()
    };
}

function valorAutomatico(campo, contexto = datosAutomaticosReporte()) {
    return contexto[fuenteAutomatica(campo)] || '';
}

function actualizarDatosAutomaticos() {
    const contexto = datosAutomaticosReporte();
    document.querySelectorAll('[data-fuente-automatica]').forEach(input => {
        input.value = contexto[input.dataset.fuenteAutomatica] || '';
    });
}

function completarMensajeAutomatico(mensaje, plantilla, campos, contexto) {
    for (const [fuente, etiqueta] of [['hora', 'Hora'], ['vigilante', 'Vigilante'], ['unidad', 'Unidad']]) {
        const claves = campos.filter(c => fuenteAutomatica(c) === fuente).map(c => c.nombre_campo);
        claves.push(...({ hora: ['hora'], vigilante: ['vigilante', 'guardia', 'nombre_guardia', 'nombre_vigilante'], unidad: ['unidad', 'ubicacion'] }[fuente]));
        const incluida = plantilla
            ? claves.some(clave => plantilla.includes(`{{${clave}}}`))
            : fuente === 'hora' || campos.some(c => fuenteAutomatica(c) === fuente);
        if (!incluida) mensaje += `\n*${etiqueta}:* ${contexto[fuente]}`;
    }
    return mensaje;
}

function blobBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(new Error('No se pudo preparar la foto.'));
        reader.readAsDataURL(blob);
    });
}

async function prepararFotoCompartir(reporte, archivo) {
    if (!archivo || reporte.fotoCompartir) return;
    const blob = await comprimirEvidencia(archivo);
    reporte.fotoCompartir = new File([blob], 'evidencia.jpg', { type: 'image/jpeg' });
}

function esAndroidNativo() {
    return window.Capacitor?.getPlatform?.() === 'android';
}

async function compartirReporte(reporte) {
    const foto = reporte.fotoCompartir;
    if (esAndroidNativo()) {
        const Share = window.Capacitor.Plugins?.Share;
        if (!Share) throw new Error('Actualice el APK para habilitar el envío de fotos.');
        const opciones = { title: reporte.tipo_nombre, text: reporte.mensaje_whatsapp, dialogTitle: 'Elija WhatsApp para enviar el reporte' };
        if (foto) {
            const Filesystem = window.Capacitor.Plugins?.Filesystem;
            if (!Filesystem) throw new Error('Actualice el APK para habilitar el envío de fotos.');
            // Se conserva en caché para que WhatsApp pueda leerlo después del selector.
            const { uri } = await Filesystem.writeFile({ path: `reportes/${reporte.id}.jpg`, directory: 'CACHE', recursive: true, data: await blobBase64(foto) });
            opciones.files = [uri];
        }
        await Share.share(opciones);
        return;
    }
    if (foto) {
        const datos = { text: reporte.mensaje_whatsapp, files: [foto] };
        if (!navigator.share || !navigator.canShare?.(datos)) {
            throw new Error('Este navegador no permite compartir fotos. Use la app Android para enviar la foto junto con el mensaje. El reporte y la foto ya quedaron guardados.');
        }
        // En web se invoca desde un segundo clic para conservar la activación del usuario.
        await navigator.share(datos);
        return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(reporte.mensaje_whatsapp)}`, '_blank', 'noopener');
}
