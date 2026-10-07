import { createClient } from 'npm:@supabase/supabase-js@2';
import { crearHandlerLimpieza } from './limpieza.mjs';

Deno.serve(crearHandlerLimpieza({
    env: (nombre: string) => Deno.env.get(nombre),
    createClient,
}));
