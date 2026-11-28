-- Orbit avatar policy: one avatar change per India calendar day.
-- Run this script in Supabase SQL Editor to enforce the rule server-side.

alter table public.ctr_user_avatars
  add column if not exists last_changed_on date;

create or replace function public.ctr_choose_avatar(p_avatar text)
returns table(chosen_avatar text, selections_used smallint)
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  old_avatar text;
  used smallint;
  changed_on date;
  today_ist date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if uid is null or not public.ctr_session_is_active() then
    raise exception 'Session expired. Sign in again.';
  end if;
  if not exists(select 1 from public.ctr_team_directory where user_id=uid) then
    raise exception 'This account is not part of the workspace team';
  end if;
  if p_avatar not in ('⚔️','🛡️','🐉','🐺','🦊','🐯','🦅','🐼','🦁','🐲','🌙','🔥','🎭','👑','🌸','☯️') then
    raise exception 'Invalid avatar choice';
  end if;

  select avatar, selection_count, last_changed_on
    into old_avatar, used, changed_on
    from public.ctr_user_avatars
    where user_id=uid
    for update;

  if old_avatar=p_avatar then
    return query select old_avatar, used;
    return;
  end if;

  if old_avatar is not null and changed_on=today_ist then
    raise exception 'Avatar already changed today. You can change it again tomorrow (IST).';
  end if;

  if old_avatar is null then
    insert into public.ctr_user_avatars(user_id,avatar,selection_count,last_changed_on)
    values(uid,p_avatar,1,today_ist);
  else
    update public.ctr_user_avatars
      set avatar=p_avatar,
          selection_count=selection_count+1,
          last_changed_on=today_ist,
          updated_at=now()
      where user_id=uid;
  end if;

  return query select p_avatar, (case when old_avatar is null then 1 else used+1 end)::smallint;
exception
  when unique_violation then
    raise exception 'This avatar is already selected by another team member. Choose a different one.';
end;
$$;

revoke all on function public.ctr_choose_avatar(text) from public, anon;
grant execute on function public.ctr_choose_avatar(text) to authenticated;
