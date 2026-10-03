import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('publicación, aislamiento por ubicación, roles e historial en PostgreSQL', async t => {
    const db = new PGlite();
    t.after(() => db.close());
    // Sustitutos mínimos de los esquemas administrados por Supabase.
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      grant usage on schema public, auth, storage to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      create table storage.buckets(id text primary key, name text, public boolean);
      create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
      alter table storage.objects enable row level security;
      create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1, '/')$$;
    `);
    await db.exec(await readFile('supabase/schema.sql', 'utf8'));
    const migration = await readFile('supabase/multiubicacion.sql', 'utf8');
    await db.exec(migration);
    await db.exec(migration); // Seguro al volver a ejecutar.
    const admin = '00000000-0000-0000-0000-000000000001';
    const guardia = '00000000-0000-0000-0000-000000000002';
    const otro = '00000000-0000-0000-0000-000000000003';
    await db.query(`insert into auth.users(id,email,raw_user_meta_data) values
      ($1,'admin@example.test','{}'),($2,'guardia@example.test','{"nombre":"Ana","rol":"admin"}'),($3,'otro@example.test','{}')`, [admin, guardia, otro]);
    await db.query("update public.perfiles set rol='admin' where id=$1", [admin]);
    const sesion = async id => {
        await db.exec('reset role');
        await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
        await db.exec('set role authenticated');
    };
    await sesion(admin);
    const norte = (await db.query("insert into public.ubicaciones(nombre) values('Norte') returning id")).rows[0].id;
    const sur = (await db.query("insert into public.ubicaciones(nombre) values('Sur') returning id")).rows[0].id;
    await db.query('insert into public.asignaciones values($1,$2),($3,$4)', [guardia,norte,otro,sur]);
    const contenido = { tiposReportes: [{ clave: 'rondin', nombre: 'Rondín', activo: true, campos: [] }], catalogos: [] };
    const publicar = async (destino, base, datos = contenido) => (await db.query('select * from public.publicar_configuracion($1,$2,$3)', [destino,JSON.stringify(datos),base])).rows[0];
    const v1 = await publicar(norte,0);
    const vsur = await publicar(sur,0);
    assert.equal(v1.version,1);
    await assert.rejects(publicar(norte,0), /Otra persona publicó/);
    await assert.rejects(publicar(norte,1,{}), /Configuración inválida/);
    await sesion(guardia);
    assert.equal((await db.query('select rol from public.perfiles')).rows[0].rol,'guardia');
    assert.deepEqual((await db.query('select nombre from public.ubicaciones')).rows.map(u => u.nombre),['Norte']);
    assert.equal((await db.query('select * from public.configuraciones_ubicacion')).rows.length,1);
    await assert.rejects(publicar(norte,1), /Solo un administrador/);
    await assert.rejects(db.query("update public.perfiles set rol='admin'"), /permission denied/);
    await assert.rejects(db.query('insert into public.asignaciones values($1,$2)',[guardia,sur]), /row-level security/);
    await assert.rejects(db.query('delete from public.configuraciones_ubicacion'), /permission denied/);
    await assert.rejects(db.query('select public.eliminar_reportes_vencidos()'), /permission denied/);
    const insertar = (ubicacion,configuracion,clave = 'rondin', autor = guardia) => db.query(`insert into public.reportes
      (id,creado_por,ubicacion_id,configuracion_id,tipo_clave,tipo_nombre,mensaje_whatsapp)
      values(gen_random_uuid(),$1,$2,$3,$4,'Nombre manipulado','Reporte') returning *`, [autor,ubicacion,configuracion,clave]);
    const reporte = (await insertar(norte,v1.id)).rows[0];
    assert.equal(reporte.tipo_nombre,'Rondín');
    assert.equal(reporte.formulario_snapshot.nombre,'Rondín');
    await assert.rejects(insertar(sur,vsur.id), /Formulario no publicado|row-level security/);
    await assert.rejects(insertar(norte,vsur.id), /Formulario no publicado/);
    await assert.rejects(insertar(norte,v1.id,'inventado'), /Formulario no publicado/);
    await assert.rejects(insertar(norte,v1.id,'rondin',otro), /row-level security/);
    await sesion(admin);
    const v2 = await publicar(norte,1,{...contenido,tiposReportes:[{...contenido.tiposReportes[0],nombre:'Rondín actualizado'}]});
    assert.equal(v2.version,2);
    assert.equal((await db.query('select formulario_snapshot from public.reportes')).rows[0].formulario_snapshot.nombre,'Rondín');
    await db.query('delete from public.asignaciones where usuario_id=$1',[guardia]);
    await sesion(guardia);
    assert.equal((await db.query('select * from public.configuraciones_ubicacion')).rows.length,0);
    await assert.rejects(insertar(norte,v1.id), /Formulario no publicado|row-level security/);
    await sesion(admin);
    await db.query('insert into public.asignaciones values($1,$2)',[guardia,norte]);
    await db.query('update public.ubicaciones set activa=false where id=$1',[norte]);
    await sesion(guardia);
    assert.equal((await db.query('select * from public.ubicaciones')).rows.length,0);
    await assert.rejects(insertar(norte,v1.id), /Formulario no publicado|row-level security/);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select * from public.ubicaciones'), /permission denied/);
});
