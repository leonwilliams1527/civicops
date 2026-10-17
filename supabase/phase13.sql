-- CivicOps Phase 13: server-only email queue claims. No existing data is removed.
-- Run after Phases 8.3, 10, and 12.1. Do not expose the service-role key in the browser.
BEGIN;
ALTER TABLE public.notification_email_outbox
 ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
 ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS civicops_email_queue_ready_idx
 ON public.notification_email_outbox(state,next_attempt_at,created_at);
-- Atomically claim a small batch; reclaim interrupted processing after 15 minutes.
CREATE OR REPLACE FUNCTION public.civicops_claim_email_batch(p_limit integer DEFAULT 10)
RETURNS TABLE(id uuid,notification_id uuid,recipient_id uuid,attempts integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_limit IS NULL OR p_limit < 1 OR p_limit > 25 THEN RAISE EXCEPTION 'Batch size must be 1-25'; END IF;
 RETURN QUERY
 WITH chosen AS (
   SELECT q.id FROM public.notification_email_outbox q
   WHERE (q.state IN ('pending','failed') AND q.next_attempt_at <= now() AND q.attempts < 5)
      OR (q.state='processing' AND q.processing_started_at < now() - interval '15 minutes' AND q.attempts < 5)
   ORDER BY q.created_at
   FOR UPDATE SKIP LOCKED LIMIT p_limit
 ), updated AS (
   UPDATE public.notification_email_outbox q
   SET state='processing', processing_started_at=now(), attempts=q.attempts+1, last_error=NULL
   FROM chosen c WHERE q.id=c.id
   RETURNING q.id,q.notification_id,q.recipient_id,q.attempts
 ) SELECT u.id,u.notification_id,u.recipient_id,u.attempts FROM updated u;
END; $$;
CREATE OR REPLACE FUNCTION public.civicops_finish_email(p_id uuid,p_sent boolean,p_error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.notification_email_outbox
 SET state=CASE WHEN p_sent THEN 'sent' ELSE 'failed' END,
     sent_at=CASE WHEN p_sent THEN now() ELSE NULL END,
     processing_started_at=NULL,
     last_error=CASE WHEN p_sent THEN NULL ELSE left(coalesce(p_error,'Delivery failed'),500) END,
     next_attempt_at=CASE WHEN p_sent THEN now() ELSE now()+make_interval(mins=>LEAST(240, 5 * power(2,LEAST(attempts,5))::integer)) END
 WHERE id=p_id AND state='processing';
 IF NOT FOUND THEN RAISE EXCEPTION 'Queue item not in processing state'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.civicops_claim_email_batch(integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.civicops_finish_email(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.civicops_claim_email_batch(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.civicops_finish_email(uuid,boolean,text) TO service_role;
COMMIT;
