-- A distinct campaign cannot reserve the same normalized code within an installation.
create unique index campaigns_reserved_coupon_code_idx
  on campaigns (store_id, upper(coupon_code))
  where coupon_input is not null and coupon_code is not null;

create or replace function record_campaign_coupon(
  p_store_id uuid,
  p_campaign_id uuid,
  p_user_id uuid,
  p_from text,
  p_to text,
  p_event text,
  p_coupon_id bigint default null,
  p_release_creation boolean default false
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_campaign campaigns%rowtype;
begin
  select * into v_campaign from campaigns
  where id = p_campaign_id and store_id = p_store_id
  for update;
  if not found or not exists (
    select 1 from users where id = p_user_id and store_id = p_store_id
  ) then
    return false;
  end if;

  -- A retry can finish reconciliation after the original request has already recorded success.
  if v_campaign.status = p_to and (p_coupon_id is null or v_campaign.coupon_external_id = p_coupon_id) then
    return true;
  end if;
  if v_campaign.status <> p_from then
    return false;
  end if;

  update campaigns set
    status = p_to,
    coupon_external_id = coalesce(p_coupon_id, coupon_external_id),
    coupon_input = case when p_release_creation then null else coupon_input end,
    activated_at = case when p_event = 'activate' then now() else activated_at end,
    invitations_marked_at = case when p_event = 'mark_invitations_sent' then now() else invitations_marked_at end,
    updated_at = now()
  where id = p_campaign_id and store_id = p_store_id;

  insert into campaign_events (campaign_id, event_type, from_status, to_status, actor_user_id)
  values (p_campaign_id, p_event, p_from, p_to, p_user_id);
  return true;
end;
$$;

revoke execute on function record_campaign_coupon(uuid, uuid, uuid, text, text, text, bigint, boolean) from public, anon, authenticated;
grant execute on function record_campaign_coupon(uuid, uuid, uuid, text, text, text, bigint, boolean) to service_role;
