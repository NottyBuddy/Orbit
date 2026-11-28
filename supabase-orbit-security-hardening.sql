-- INDINEXT ORBIT hardening and avatar gate
-- Applied to Supabase project icootmtssyergamuxlxb on 2026-11-26.
-- WARNING: the final DELETE invalidates all existing sessions once. Do not rerun casually.

-- Notifications centre (idempotent setup)
create table if not exists public.ctr_notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 kind text not null check(kind in ('group','direct','followup')),
 reference_id uuid,
 title text not null,
 body text not null default '',
 created_at timestamptz not null default now(),
 read_at timestamptz
);
create index if not exists ctr_notifications_recipient_created_idx on public.ctr_notifications(recipient_id,created_at desc);
alter table public.ctr_notifications enable row level security;
revoke all on public.ctr_notifications from anon,authenticated;
grant select,update,delete on public.ctr_notifications to authenticated;

create or replace function public.ctr_notify_group_note() returns trigger language plpgsql security definer set search_path=public,auth as $$
begin insert into public.ctr_notifications(recipient_id,actor_id,kind,reference_id,title,body)
select id,new.user_id,'group',new.id,'New group update','A team member shared a new group note.' from auth.users where id<>new.user_id; return new; end;$$;
create or replace function public.ctr_notify_direct_message() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.ctr_notifications(recipient_id,actor_id,kind,reference_id,title,body)
values(new.recipient_id,new.sender_id,'direct',new.id,'New direct message','You received a new private team message.');return new;end;$$;
create or replace function public.ctr_notify_followup() returns trigger language plpgsql security definer set search_path=public,auth as $$
begin insert into public.ctr_notifications(recipient_id,actor_id,kind,reference_id,title,body)
select id,new.user_id,'followup',new.id,'New follow-up scheduled','A team callback has been added to the shared queue.' from auth.users where id<>new.user_id;return new;end;$$;
drop trigger if exists ctr_group_note_notify on public.ctr_group_notes;
create trigger ctr_group_note_notify after insert on public.ctr_group_notes for each row execute function public.ctr_notify_group_note();
drop trigger if exists ctr_direct_message_notify on public.ctr_direct_messages;
create trigger ctr_direct_message_notify after insert on public.ctr_direct_messages for each row execute function public.ctr_notify_direct_message();
drop trigger if exists ctr_followup_notify on public.ctr_followups;
create trigger ctr_followup_notify after insert on public.ctr_followups for each row execute function public.ctr_notify_followup();
do $$ begin alter publication supabase_realtime add table public.ctr_notifications; exception when duplicate_object then null; when undefined_object then null; end $$;

-- Session validity: revoked refresh sessions are also denied by RLS.
create or replace function public.ctr_session_is_active() returns boolean language sql stable security definer set search_path=public as $$
select auth.uid() is not null and exists(select 1 from auth.sessions s where s.id=(auth.jwt()->>'session_id')::uuid and s.user_id=auth.uid());$$;
revoke all on function public.ctr_session_is_active() from public,anon;
grant execute on function public.ctr_session_is_active() to authenticated;

create or replace function public.ctr_is_team_member() returns boolean language sql stable security definer set search_path=public as $$
select public.ctr_session_is_active() and exists(select 1 from public.ctr_team_directory t where t.user_id=auth.uid());$$;
revoke all on function public.ctr_is_team_member() from public,anon;
grant execute on function public.ctr_is_team_member() to authenticated;

create or replace function public.ctr_has_avatar() returns boolean language sql stable security definer set search_path=public as $$
select public.ctr_session_is_active() and exists(select 1 from public.ctr_team_directory t join public.ctr_user_avatars a on a.user_id=t.user_id where t.user_id=auth.uid() and a.avatar is not null);$$;
revoke all on function public.ctr_has_avatar() from public,anon;
grant execute on function public.ctr_has_avatar() to authenticated;

drop policy if exists "Users read own notifications" on public.ctr_notifications;
create policy "Users read own notifications" on public.ctr_notifications for select to authenticated using(auth.uid()=recipient_id and public.ctr_has_avatar());
drop policy if exists "Users mark own notifications read" on public.ctr_notifications;
create policy "Users mark own notifications read" on public.ctr_notifications for update to authenticated using(auth.uid()=recipient_id and public.ctr_has_avatar()) with check(auth.uid()=recipient_id and public.ctr_has_avatar());
drop policy if exists "Users delete own notifications" on public.ctr_notifications;
create policy "Users delete own notifications" on public.ctr_notifications for delete to authenticated using(auth.uid()=recipient_id and public.ctr_has_avatar());

-- Team-only directory/avatar access.
drop policy if exists "Authenticated users can view team directory" on public.ctr_team_directory;
create policy "Authenticated users can view team directory" on public.ctr_team_directory for select to authenticated using(public.ctr_is_team_member());
drop policy if exists "Signed-in users can see chosen avatars" on public.ctr_user_avatars;
create policy "Signed-in users can see chosen avatars" on public.ctr_user_avatars for select to authenticated using(public.ctr_is_team_member());

-- Avatar RPC: globally unique; one change per India calendar day; membership + active session required.
create or replace function public.ctr_choose_avatar(p_avatar text) returns table(chosen_avatar text,selections_used smallint)
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); old_avatar text; used smallint; changed_on date; today_ist date:=(now() at time zone 'Asia/Kolkata')::date;
begin
 if uid is null or not public.ctr_session_is_active() then raise exception 'Session expired. Sign in again.'; end if;
 if not exists(select 1 from public.ctr_team_directory where user_id=uid) then raise exception 'This account is not part of the workspace team'; end if;
 if p_avatar not in ('⚔️','🛡️','🐉','🐺','🦊','🐯','🦅','🐼','🦁','🐲','🌙','🔥','🎭','👑','🌸','☯️') then raise exception 'Invalid avatar choice'; end if;
 select avatar,selection_count,last_changed_on into old_avatar,used,changed_on from public.ctr_user_avatars where user_id=uid for update;
 if old_avatar=p_avatar then return query select old_avatar,used;return;end if;
 if old_avatar is not null and changed_on=today_ist then raise exception 'Avatar already changed today. You can change it again tomorrow (IST).';end if;
 if old_avatar is null then insert into public.ctr_user_avatars(user_id,avatar,selection_count,last_changed_on) values(uid,p_avatar,1,today_ist);
 else update public.ctr_user_avatars set avatar=p_avatar,selection_count=selection_count+1,last_changed_on=today_ist,updated_at=now() where user_id=uid;end if;
 return query select p_avatar,(case when old_avatar is null then 1 else used+1 end)::smallint;
exception when unique_violation then raise exception 'This avatar is already selected by another team member. Choose a different one.';
end;$$;
revoke all on function public.ctr_choose_avatar(text) from public,anon;
grant execute on function public.ctr_choose_avatar(text) to authenticated;

-- Require active team member + avatar on all workspace records.
drop policy if exists "Users can read group notes" on public.ctr_group_notes;
create policy "Users can read group notes" on public.ctr_group_notes for select to authenticated using(public.ctr_has_avatar());
drop policy if exists "Users can post own group notes" on public.ctr_group_notes;
create policy "Users can post own group notes" on public.ctr_group_notes for insert to authenticated with check(auth.uid()=user_id and public.ctr_has_avatar());
drop policy if exists "Users and admin update group notes" on public.ctr_group_notes;
create policy "Users and admin update group notes" on public.ctr_group_notes for update to authenticated using((auth.uid()=user_id or lower(coalesce(auth.jwt()->>'email',''))='mahesh.s@hrhnext.com') and public.ctr_has_avatar()) with check((auth.uid()=user_id or lower(coalesce(auth.jwt()->>'email',''))='mahesh.s@hrhnext.com') and public.ctr_has_avatar());
drop policy if exists "Only CTR admin can delete group notes" on public.ctr_group_notes;
drop policy if exists "Owners and admin delete group notes" on public.ctr_group_notes;
create policy "Owners and admin delete group notes" on public.ctr_group_notes for delete to authenticated using((auth.uid()=user_id or lower(coalesce(auth.jwt()->>'email',''))='mahesh.s@hrhnext.com') and public.ctr_has_avatar());

drop policy if exists "Owners and CTR admin can read personal notes" on public.ctr_personal_notes;
create policy "Owners and CTR admin can read personal notes" on public.ctr_personal_notes for select to authenticated using((auth.uid()=user_id or lower(coalesce(auth.jwt()->>'email',''))='mahesh.s@hrhnext.com') and public.ctr_has_avatar());
drop policy if exists "Users can add own personal notes" on public.ctr_personal_notes;
create policy "Users can add own personal notes" on public.ctr_personal_notes for insert to authenticated with check(auth.uid()=user_id and public.ctr_has_avatar());
drop policy if exists "Users update own personal notes" on public.ctr_personal_notes;
create policy "Users update own personal notes" on public.ctr_personal_notes for update to authenticated using((auth.uid()=user_id or lower(coalesce(auth.jwt()->>'email',''))='mahesh.s@hrhnext.com') and public.ctr_has_avatar()) with check((auth.uid()=user_id or lower(coalesce(auth.jwt()->>'email',''))='mahesh.s@hrhnext.com') and public.ctr_has_avatar());
drop policy if exists "Only CTR admin can delete personal notes" on public.ctr_personal_notes;
drop policy if exists "Users delete own personal notes" on public.ctr_personal_notes;
create policy "Users delete own personal notes" on public.ctr_personal_notes for delete to authenticated using((auth.uid()=user_id or lower(coalesce(auth.jwt()->>'email',''))='mahesh.s@hrhnext.com') and public.ctr_has_avatar());

drop policy if exists "Participants and admin can read direct messages" on public.ctr_direct_messages;
create policy "Participants and admin can read direct messages" on public.ctr_direct_messages for select to authenticated using((auth.uid()=sender_id or auth.uid()=recipient_id or lower(coalesce(auth.jwt()->>'email',''))='mahesh.s@hrhnext.com') and public.ctr_has_avatar());
drop policy if exists "Users can send direct messages" on public.ctr_direct_messages;
create policy "Users can send direct messages" on public.ctr_direct_messages for insert to authenticated with check(auth.uid()=sender_id and auth.uid()<>recipient_id and public.ctr_has_avatar());
drop policy if exists "Users can edit own direct messages" on public.ctr_direct_messages;
create policy "Users can edit own direct messages" on public.ctr_direct_messages for update to authenticated using(auth.uid()=sender_id and public.ctr_has_avatar()) with check(auth.uid()=sender_id and public.ctr_has_avatar());
drop policy if exists "CTR admin can delete any direct message" on public.ctr_direct_messages;
drop policy if exists "Users delete own direct messages" on public.ctr_direct_messages;
create policy "Users delete own direct messages" on public.ctr_direct_messages for delete to authenticated using((auth.uid()=sender_id or lower(coalesce(auth.jwt()->>'email',''))='mahesh.s@hrhnext.com') and public.ctr_has_avatar());

drop policy if exists "CTR members can view followups" on public.ctr_followups;
create policy "CTR members can view followups" on public.ctr_followups for select to authenticated using(public.ctr_has_avatar());
drop policy if exists "CTR members can create own followups" on public.ctr_followups;
create policy "CTR members can create own followups" on public.ctr_followups for insert to authenticated with check(auth.uid()=user_id and public.ctr_has_avatar());
drop policy if exists "CTR members can complete followups" on public.ctr_followups;
create policy "CTR members can complete followups" on public.ctr_followups for update to authenticated using(public.ctr_has_avatar()) with check(public.ctr_has_avatar());

drop policy if exists "Admin can read moderation log" on public.ctr_moderation_log;
create policy "Admin can read moderation log" on public.ctr_moderation_log for select to authenticated using(lower(coalesce(auth.jwt()->>'email',''))='mahesh.s@hrhnext.com' and public.ctr_has_avatar());

drop policy if exists "Signed in users can see colours" on public.ctr_profiles;
create policy "Signed in users can see colours" on public.ctr_profiles for select to authenticated using(public.ctr_is_team_member());
drop policy if exists "Users choose own colour once" on public.ctr_profiles;
create policy "Users choose own colour once" on public.ctr_profiles for insert to authenticated with check(auth.uid()=user_id and public.ctr_is_team_member());
drop policy if exists "No profile colour changes" on public.ctr_profiles;
create policy "No profile colour changes" on public.ctr_profiles for update to authenticated using(false) with check(false);

-- Revoke all currently issued sessions to force every user through fresh login + avatar gate.
delete from auth.sessions;
