-- Ejecutar en Supabase SQL Editor (proyecto ContacNeed)

create table if not exists public.anuncios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  cuerpo text,
  imagen_url text,
  enlace_url text,
  estado text,
  usuario_id uuid references public.perfiles(id) on delete set null,
  activo boolean not null default true,
  prioridad integer not null default 0,
  tipo text not null default 'banner',
  fecha_inicio timestamptz default now(),
  fecha_fin timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.comentarios (
  id uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  contenido text not null,
  fecha_creacion timestamptz default now()
);

create table if not exists public.solicitudes_pro (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  metodo text not null default 'paypal',
  monto numeric,
  estatus text not null default 'pendiente',
  notas text,
  created_at timestamptz default now()
);

alter table public.perfiles add column if not exists avatar_url text;
alter table public.perfiles add column if not exists bloqueado boolean default false;

create index if not exists idx_anuncios_activo on public.anuncios (activo, tipo, prioridad desc);
create index if not exists idx_comentarios_post on public.comentarios (publicacion_id);
create index if not exists idx_solicitudes_pro_estatus on public.solicitudes_pro (estatus);
