-- Daily Duel – Grundschema
-- Ausführen mit: supabase db push   (oder psql -f)
--
-- Leitgedanke: der Server ist die einzige Wahrheit. Der Client erfährt nie,
-- welche Antwort richtig ist, bevor er geantwortet hat, und rechnet keine
-- Punkte selbst aus.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- Stammdaten

create table categories (
  id          smallserial primary key,
  slug        text        not null unique,
  label_de    text        not null,
  label_en    text        not null,
  is_premium  boolean     not null default false
);

create type question_status as enum ('draft', 'live', 'retired');

create table questions (
  id              uuid primary key default gen_random_uuid(),
  category_id     smallint not null references categories (id),
  locale          text     not null,
  text            text     not null,
  options         text[]   not null,
  correct_index   smallint not null,
  status          question_status not null default 'draft',

  -- Kalibrierung: füllt sich im Betrieb von selbst, siehe apply_answer_stats()
  times_served    integer  not null default 0,
  times_correct   integer  not null default 0,
  sum_answer_ms   bigint   not null default 0,

  created_at      timestamptz not null default now(),

  constraint questions_four_options check (cardinality(options) = 4),
  constraint questions_correct_index_range check (correct_index between 0 and 3)
);

create index questions_pool_idx on questions (locale, category_id) where status = 'live';

-- Empirische Schwierigkeit und Durchschnittszeit. NULL, solange zu wenig
-- Daten da sind – dann fällt die Set-Erzeugung auf Defaults zurück.
create view question_stats as
select
  id,
  category_id,
  locale,
  case when times_served >= 30
       then times_correct::numeric / times_served end as p_correct,
  case when times_served >= 30
       then (sum_answer_ms / times_served)::integer end as mean_answer_ms
from questions;

-- ----------------------------------------------------------------- Spieler

create table users (
  id                 uuid primary key references auth.users (id) on delete cascade,
  display_name       text        not null,
  country            text,
  elo                integer     not null default 1200,
  matches_played     integer     not null default 0,
  streak             integer     not null default 0,
  last_played_on     date,
  subscription_until timestamptz,
  created_at         timestamptz not null default now()
);

create index users_elo_idx on users (elo desc);

-- Tagesbudget an Duellen. Eine Zeile pro Spieler und Tag.
create table daily_slots (
  user_id     uuid not null references users (id) on delete cascade,
  play_date   date not null,
  slots_used    smallint not null default 0,
  slots_granted smallint not null default 1,
  primary key (user_id, play_date),
  constraint daily_slots_not_overdrawn check (slots_used <= slots_granted)
);

-- ------------------------------------------------------------- Fragensets

-- Beide Spieler eines Duells sehen dieselben fünf Fragen in derselben
-- Reihenfolge – nur so ist das Ergebnis vergleichbar.
create table question_sets (
  id                uuid primary key default gen_random_uuid(),
  locale            text     not null,
  difficulty_bucket smallint not null,   -- 0 = leicht … 4 = schwer
  question_ids      uuid[]   not null,
  created_at        timestamptz not null default now(),

  constraint question_sets_five_questions check (cardinality(question_ids) = 5)
);

create index question_sets_pool_idx on question_sets (locale, difficulty_bucket);

-- ----------------------------------------------------------------- Duelle

create type match_state as enum ('open', 'playing', 'finished', 'abandoned');

-- Ein Duell ist asynchron: player_a spielt, seine Spur wird gespeichert,
-- player_b tritt später gegen diese Spur an. opponent_is_synthetic markiert
-- Übungsgegner – die werden im Client sichtbar als solche gekennzeichnet.
create table matches (
  id            uuid primary key default gen_random_uuid(),
  set_id        uuid not null references question_sets (id),
  player_id     uuid not null references users (id) on delete cascade,
  opponent_id   uuid references users (id) on delete set null,
  opponent_is_synthetic boolean not null default false,
  opponent_elo  integer not null,

  player_score    integer,
  opponent_score  integer,
  player_elo_before integer not null,
  player_elo_delta  integer,

  state         match_state not null default 'open',
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create index matches_player_idx on matches (player_id, started_at desc);

-- Antwortspur. Eine Zeile pro Duell und Spieler (auch für synthetische
-- Gegner, damit ein späterer Gegner dieselbe Spur wiederverwenden kann).
create table traces (
  match_id  uuid not null references matches (id) on delete cascade,
  user_id   uuid references users (id) on delete cascade,
  is_synthetic boolean not null default false,
  answers   jsonb not null,   -- [{ q: uuid, chosen: 0-3|null, ms: int }]
  score     integer not null,
  primary key (match_id, is_synthetic)
);

-- Serverseitiger Zeitstempel je ausgelieferter Frage. Grundlage der
-- Plausibilitätsprüfung in submit-answer: unter 400 ms hat niemand gelesen,
-- über 13 s ist die Runde abgelaufen.
create table served_questions (
  match_id    uuid not null references matches (id) on delete cascade,
  position    smallint not null,
  question_id uuid not null references questions (id),
  served_at   timestamptz not null default now(),
  answered_at timestamptz,
  chosen_index smallint,
  is_correct  boolean,
  points      integer,
  primary key (match_id, position),
  constraint served_questions_position_range check (position between 0 and 4)
);

-- ------------------------------------------------- Statistik-Fortschreibung

-- Hält die Kalibrierungszähler auf questions aktuell. Läuft im selben
-- Transaktionskontext wie das Speichern der Antwort.
create function apply_answer_stats() returns trigger
language plpgsql as $$
begin
  if new.answered_at is not null and old.answered_at is null then
    update questions
       set times_served  = times_served + 1,
           times_correct = times_correct + case when new.is_correct then 1 else 0 end,
           sum_answer_ms = sum_answer_ms
                           + extract(epoch from (new.answered_at - new.served_at)) * 1000
     where id = new.question_id;
  end if;
  return new;
end;
$$;

create trigger served_questions_stats
  after update on served_questions
  for each row execute function apply_answer_stats();

-- ------------------------------------------------------------------- RLS
-- Ohne Ausnahme: Clients lesen nur ihre eigenen Zeilen und schreiben nie
-- direkt. Alle Schreibpfade laufen über Edge Functions mit Service-Role-Key.

alter table users            enable row level security;
alter table daily_slots      enable row level security;
alter table matches          enable row level security;
alter table traces           enable row level security;
alter table served_questions enable row level security;
alter table questions        enable row level security;
alter table question_sets    enable row level security;

create policy users_read_self on users
  for select using (auth.uid() = id);

create policy users_update_self on users
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

create policy daily_slots_read_self on daily_slots
  for select using (auth.uid() = user_id);

create policy matches_read_self on matches
  for select using (auth.uid() = player_id);

create policy traces_read_own_match on traces
  for select using (
    exists (select 1 from matches m
             where m.id = traces.match_id and m.player_id = auth.uid())
  );

-- questions und question_sets bekommen bewusst KEINE select-Policy für
-- anon/authenticated: correct_index darf den Client nie erreichen. Fragen
-- werden ausschliesslich von den Edge Functions ausgeliefert, ohne dieses
-- Feld.

-- Bestenliste ohne Klarnamen-Leak: nur Rang, Anzeigename, Elo.
create view leaderboard
with (security_invoker = false) as
select
  row_number() over (order by elo desc, matches_played desc) as rank,
  display_name,
  country,
  elo
from users
where matches_played >= 5
order by elo desc
limit 100;

grant select on leaderboard to authenticated;
