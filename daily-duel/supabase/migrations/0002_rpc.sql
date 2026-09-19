-- Serverseitige Operationen, die atomar sein müssen.

-- Verbraucht einen Tages-Slot und legt die Zeile bei Bedarf an.
-- Gibt false zurück, wenn das Tagesbudget erschöpft ist.
--
-- Muss atomar sein: zwei parallele Starts dürfen nicht beide durchgehen,
-- sonst spielt ein Free-User zwei Duelle am Tag. Das `on conflict do update`
-- sperrt die Zeile, die `where`-Klausel entscheidet.
create function consume_daily_slot(p_user_id uuid, p_play_date date)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_granted smallint;
  v_updated integer;
begin
  -- Abonnenten bekommen fünf Duelle, alle anderen eines.
  select case when subscription_until > now() then 5 else 1 end
    into v_granted
    from users where id = p_user_id;

  if v_granted is null then
    raise exception 'unbekannter Spieler: %', p_user_id;
  end if;

  insert into daily_slots (user_id, play_date, slots_used, slots_granted)
       values (p_user_id, p_play_date, 1, v_granted)
  on conflict (user_id, play_date) do update
          set slots_used = daily_slots.slots_used + 1,
              -- Ein zwischenzeitlich abgeschlossenes Abo erhöht das Budget
              -- noch am selben Tag.
              slots_granted = greatest(daily_slots.slots_granted, v_granted)
        where daily_slots.slots_used < greatest(daily_slots.slots_granted, v_granted);

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

-- Schaltet nach einer belohnten Werbeeinblendung ein Zusatzduell frei.
-- Gedeckelt, damit ein manipulierter Client nicht beliebig viele nachlegt.
create function grant_bonus_slot(p_user_id uuid, p_play_date date)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  insert into daily_slots (user_id, play_date, slots_used, slots_granted)
       values (p_user_id, p_play_date, 0, 2)
  on conflict (user_id, play_date) do update
          set slots_granted = daily_slots.slots_granted + 1
        where daily_slots.slots_granted < 6;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

-- Schreibt das Ergebnis eines Duells fest: Elo, Streak, Zählerstände.
-- In einer Funktion, damit ein abgebrochener Request keinen halben
-- Spielstand hinterlässt.
create function finalize_match(
  p_match_id       uuid,
  p_player_score   integer,
  p_opponent_score integer,
  p_elo_delta      integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_today     date;
begin
  update matches
     set player_score   = p_player_score,
         opponent_score = p_opponent_score,
         player_elo_delta = p_elo_delta,
         state          = 'finished',
         finished_at    = now()
   where id = p_match_id and state = 'playing'
   returning player_id into v_player_id;

  if v_player_id is null then
    raise exception 'Duell % ist nicht offen', p_match_id;
  end if;

  v_today := current_date;

  update users
     set elo            = greatest(100, elo + p_elo_delta),
         matches_played = matches_played + 1,
         -- Serie: nur ein zusammenhängender Tagesrhythmus zählt.
         streak = case
                    when last_played_on = v_today then streak
                    when last_played_on = v_today - 1 then streak + 1
                    else 1
                  end,
         last_played_on = v_today
   where id = v_player_id;
end;
$$;

revoke execute on function consume_daily_slot(uuid, date) from public, anon, authenticated;
revoke execute on function grant_bonus_slot(uuid, date)   from public, anon, authenticated;
revoke execute on function finalize_match(uuid, integer, integer, integer)
  from public, anon, authenticated;
