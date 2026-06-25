create table conversas (
  phone text primary key,
  messages jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table pacientes (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  nome text,
  email text,
  objetivo text,
  prontuario_id text,
  created_at timestamptz default now()
);
