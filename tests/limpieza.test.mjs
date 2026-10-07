import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { limpiarReportes, crearHandlerLimpieza } from '../supabase/functions/limpiar-reportes/limpieza.mjs';

const CORTE = '2026-09-22T03:15:00.000Z';
const vencido = (id, foto = true) => ({ id: String(id), creado_en: '2026-09-21T00:00:00.000Z', evidencia_ruta: foto ? `cuenta/${id}/evidencia.jpg` : null });
const contadores = () => ({ reportes_eliminados: 0, fotos_eliminadas: 0 });

function simular(filas) {
    const estado = { filas: [...filas], fotos: new Set(filas.map(r => r.evidencia_ruta).filter(Boolean)), eventos: [], logs: [], falloStorage: false, falloBorrado: false };
    const cliente = {
        storage: { from(bucket) {
            assert.equal(bucket, 'evidencias');
            return { async remove(rutas) {
                assert.ok(rutas.length <= 100);
                estado.eventos.push(['storage', [...rutas]]);
                if (estado.falloStorage) return { error: { message: 'Storage no disponible' } };
                const eliminadas = rutas.filter(r => estado.fotos.has(r));
                rutas.forEach(r => estado.fotos.delete(r));
                return { data: eliminadas.map(name => ({ name })) };
            } };
        } },
        from(tabla) {
            let corte, ids, limite = Infinity, accion = 'select', registro;
            const query = {
                select() { return this; }, order() { return this; },
                lt(campo, valor) { assert.equal(campo, 'creado_en'); corte = valor; return this; },
                limit(valor) { limite = valor; return this; },
                in(campo, valor) { assert.equal(campo, 'id'); ids = valor; return this; },
                delete() { accion = 'delete'; return this; },
                insert(valor) { accion = 'insert'; registro = valor; return this; },
                update(valor) { accion = 'update'; registro = valor; return this; },
                eq(campo, valor) { ids = [valor]; return this; },
                single() { return this; },
                then(resolve, reject) {
                    const ejecutar = () => {
                        if (tabla === 'limpieza_ejecuciones') {
                            if (accion === 'insert') { estado.logs.push({ id: 'ejecucion', ...registro }); return { data: { id: 'ejecucion' } }; }
                            Object.assign(estado.logs.find(r => ids.includes(r.id)), registro);
                            return {};
                        }
                        assert.equal(tabla, 'reportes');
                        assert.ok(corte, 'Siempre filtrar por antigüedad');
                        const encontrados = estado.filas.filter(r => r.creado_en < corte && (!ids || ids.includes(r.id))).slice(0, limite);
                        if (accion === 'delete') {
                            estado.eventos.push(['reportes', encontrados.map(r => r.id)]);
                            if (estado.falloBorrado) return { error: { message: 'Postgres no disponible' } };
                            for (const r of encontrados) assert.ok(!r.evidencia_ruta || !estado.fotos.has(r.evidencia_ruta), 'Borrar la foto primero');
                            estado.filas = estado.filas.filter(r => !encontrados.includes(r));
                        }
                        return { data: encontrados };
                    };
                    return Promise.resolve().then(ejecutar).then(resolve, reject);
                },
            };
            return query;
        },
    };
    return { cliente, estado };
}

test('limpieza elimina fotos por API, pagina sin saltar registros y respeta los 15 días', async () => {
    const recientes = [{ ...vencido('limite'), creado_en: CORTE }, { ...vencido('nuevo'), creado_en: '2026-10-01T00:00:00.000Z' }];
    const { cliente, estado } = simular([...Array.from({ length: 235 }, (_, i) => vencido(i, i % 2 === 0)), ...recientes]);
    const resultado = contadores();
    assert.equal(await limpiarReportes(cliente, CORTE, resultado), 'succeeded');
    assert.deepEqual(resultado, { reportes_eliminados: 235, fotos_eliminadas: 118 });
    assert.deepEqual(estado.filas, recientes);
    assert.equal(estado.eventos.filter(e => e[0] === 'reportes').length, 3);
});

test('si Storage falla, los reportes y rutas se conservan para reintentar', async () => {
    const { cliente, estado } = simular([vencido(1)]);
    estado.falloStorage = true;
    await assert.rejects(limpiarReportes(cliente, CORTE, contadores()), /Eliminar evidencias/);
    assert.equal(estado.filas.length, 1);
    assert.equal(estado.eventos.filter(e => e[0] === 'reportes').length, 0);
    estado.falloStorage = false;
    assert.equal(await limpiarReportes(cliente, CORTE, contadores()), 'succeeded');
});

test('si falla PostgreSQL después de Storage, el reintento tolera fotos ya eliminadas', async () => {
    const { cliente, estado } = simular([vencido(1)]);
    estado.falloBorrado = true;
    await assert.rejects(limpiarReportes(cliente, CORTE, contadores()), /Eliminar reportes/);
    assert.equal(estado.fotos.size, 0);
    assert.equal(estado.filas.length, 1);
    estado.falloBorrado = false;
    const resultado = contadores();
    await limpiarReportes(cliente, CORTE, resultado);
    assert.deepEqual(resultado, { reportes_eliminados: 1, fotos_eliminadas: 0 });
});

test('el límite de lotes informa pendientes y permite continuar', async () => {
    const { cliente, estado } = simular(Array.from({ length: 101 }, (_, i) => vencido(i, false)));
    assert.equal(await limpiarReportes(cliente, CORTE, contadores(), { maxLotes: 1 }), 'partial');
    assert.equal(estado.filas.length, 1);
    assert.equal(await limpiarReportes(cliente, CORTE, contadores()), 'succeeded');
});

test('Edge Function exige secreto privado y registra el resultado real', async () => {
    const { cliente, estado } = simular([vencido(1)]);
    const secreto = 'secreto-de-prueba-aleatorio-mas-de-32-caracteres';
    let clientes = 0;
    const handler = crearHandlerLimpieza({
        env: n => ({ LIMPIEZA_SECRET: secreto, SUPABASE_URL: 'https://proyecto.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'solo-servidor' })[n],
        createClient: () => { clientes++; return cliente; },
        ahora: () => new Date('2026-10-07T03:15:00Z'),
    });
    assert.equal((await handler(new Request('https://funcion', { method: 'GET' }))).status, 405);
    assert.equal((await handler(new Request('https://funcion', { method: 'POST' }))).status, 401);
    assert.equal((await handler(new Request('https://funcion', { method: 'POST', headers: { 'x-limpieza-secret': 'incorrecto' } }))).status, 401);
    assert.equal(clientes, 0);
    const respuesta = await handler(new Request('https://funcion', { method: 'POST', headers: { 'x-limpieza-secret': secreto } }));
    assert.equal(respuesta.status, 200);
    assert.equal((await respuesta.json()).reportes_eliminados, 1);
    assert.equal(estado.logs[0].fecha_limite, CORTE);
    assert.equal(estado.logs[0].estado, 'succeeded');
    assert.ok(estado.logs[0].terminado_en);
    estado.filas.push(vencido(2)); estado.fotos.add(vencido(2).evidencia_ruta);
    estado.falloStorage = true;
    const fallo = await handler(new Request('https://funcion', { method: 'POST', headers: { 'x-limpieza-secret': secreto } }));
    assert.equal(fallo.status, 500);
    assert.equal(estado.logs[0].estado, 'failed');
    assert.match(estado.logs[0].error, /Eliminar evidencias/);
    assert.equal(estado.filas.length, 1);
});

test('SQL de limpieza es idempotente y las cuentas no acceden al secreto ni ejecutan la limpieza', async t => {
    const db = new PGlite();
    t.after(() => db.close());
    // pg_net y Vault pertenecen a Supabase; simular sus firmas para verificar el SQL y los permisos.
    await db.exec(`
        create role anon; create role authenticated; create role service_role bypassrls;
        create schema net; create schema vault;
        create table public.reportes(id uuid primary key, creado_en timestamptz);
        create function public.es_administrador() returns boolean language sql as $$select false$$;
        create table vault.decrypted_secrets(name text, decrypted_secret text);
        create table public.solicitudes_prueba(url text, headers jsonb, body jsonb, timeout_milliseconds integer);
        create function net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds integer)
        returns bigint language plpgsql as $$ begin
            insert into public.solicitudes_prueba values(url,headers,body,timeout_milliseconds); return 42;
        end; $$;
        grant usage on schema public to authenticated, anon, service_role;
    `);
    const sql = (await readFile('supabase/limpieza_reportes.sql', 'utf8')).replace('create extension if not exists pg_net with schema extensions;', '');
    await db.exec(sql); await db.exec(sql);
    await assert.rejects(db.query('select public.ejecutar_limpieza_reportes()'), /Configure project_url/);
    await db.query('insert into vault.decrypted_secrets values($1,$2),($3,$4)', ['project_url','https://proyecto.supabase.co','limpieza_secret','secreto-de-prueba-aleatorio-mas-de-32-caracteres']);
    assert.equal((await db.query('select public.ejecutar_limpieza_reportes() as id')).rows[0].id, 42);
    const solicitud = (await db.query('select * from solicitudes_prueba')).rows[0];
    assert.equal(solicitud.url, 'https://proyecto.supabase.co/functions/v1/limpiar-reportes');
    assert.ok(solicitud.headers['x-limpieza-secret']);
    await assert.rejects(db.query('select public.eliminar_reportes_vencidos()'), /API de Storage/);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select public.ejecutar_limpieza_reportes()'), /permission denied/);
    await assert.rejects(db.query('select * from vault.decrypted_secrets'), /permission denied/);
    await assert.rejects(db.query("insert into limpieza_ejecuciones(fecha_limite,estado) values(now(),'running')"), /permission denied/);
    assert.equal((await db.query('select * from limpieza_ejecuciones')).rows.length, 0);
    await db.exec('reset role; set role service_role');
    await db.query("insert into limpieza_ejecuciones(fecha_limite,estado) values(now(),'running')");
    assert.equal((await db.query('select * from limpieza_ejecuciones')).rows.length, 1);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select * from limpieza_ejecuciones'), /permission denied/);
});
