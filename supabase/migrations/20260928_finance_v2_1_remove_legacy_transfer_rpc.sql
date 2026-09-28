-- Finance V2.1 cleanup: remove the obsolete single-amount transfer RPC.
-- The replacement create_transfer_v2 stores both original currency amounts.
drop function if exists public.create_transfer(uuid,uuid,uuid,numeric,text,timestamptz,text);
