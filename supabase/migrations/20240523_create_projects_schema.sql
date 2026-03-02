
-- Create developers table
create table if not exists developers (
  id bigint primary key generated always as identity,
  name text not null,
  created_at timestamptz default now()
);

-- Create projects table
create table if not exists projects (
  id bigint primary key generated always as identity,
  name text not null,
  phase text,
  developer_id bigint references developers(id),
  created_at timestamptz default now()
);

-- Insert mock data
insert into developers (name) values ('Eco World Development Group Berhad'), ('SP Setia Berhad'), ('Mah Sing Group Berhad');

insert into projects (name, phase, developer_id) 
select 'Eco Grandeur', 'Phase 1 - Avenham', id from developers where name = 'Eco World Development Group Berhad';

insert into projects (name, phase, developer_id) 
select 'Setia Alam', 'Precinct 15', id from developers where name = 'SP Setia Berhad';

-- Enable RLS (optional but good practice, keeping it open for now for simplicity in demo)
alter table developers enable row level security;
alter table projects enable row level security;

create policy "Public read access" on developers for select using (true);
create policy "Public read access" on projects for select using (true);
