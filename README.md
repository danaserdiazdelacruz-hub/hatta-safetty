# HATTA Safety — MVP

Reporta actos y condiciones inseguras en menos de 2 minutos, desde el celular.

## Puesta en marcha (15 minutos)

### 1. Base de datos
En Supabase → SQL Editor, pega y ejecuta `hatta_safety_schema.sql` completo.

### 2. Bucket de evidencias
En Supabase → Storage, crea un bucket privado llamado `evidencias`.
Luego en SQL Editor ejecuta:

```sql
create policy "subir evidencias de mi empresa"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'evidencias'
  and (storage.foldername(name))[1] = auth_empresa_id()::text
);

create policy "ver evidencias de mi empresa"
on storage.objects for select to authenticated
using (
  bucket_id = 'evidencias'
  and (storage.foldername(name))[1] = auth_empresa_id()::text
);
```

### 3. Variables de entorno
```bash
cp .env.local.example .env.local
```
Pon tu URL y anon key (Supabase → Settings → API).

### 4. Primer usuario
En Supabase → Authentication → Users, crea un usuario con email y contraseña.
Luego en SQL Editor, crea su empresa y perfil:

```sql
insert into empresas (id, nombre) values (gen_random_uuid(), 'Mi Empresa')
returning id; -- copia este id

insert into perfiles (id, empresa_id, nombre, rol)
values ('UUID_DEL_USUARIO_AUTH', 'UUID_DE_LA_EMPRESA', 'Tu Nombre', 'admin');
```

### 5. Correr
```bash
npm install
npm run dev
```

Abre http://localhost:3000 → te redirige al login → entra → reporta.

## Estructura
- `src/app/login` — autenticación
- `src/app/(app)` — rutas protegidas (dashboard, reportar, inspecciones)
- `src/middleware.ts` — protección de sesión en cada request
- `src/lib/supabase` — clientes browser y server

## PWA
El `manifest.json` ya está configurado. Falta agregar los íconos en
`public/icons/` (192x192 y 512x512 con el logo HATTA) para que sea instalable.
