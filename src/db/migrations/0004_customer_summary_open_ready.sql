-- Adds `open_ready_to_buy_requests` to customer_summary.
--
-- WHY IT IS NEEDED
-- The "Hot lead" rule in src/features/customers/summary.ts asks a narrower question
-- than the original column answered: not "has this person ever said they were ready to
-- buy" but "are they saying it right now". A customer whose ready-to-buy enquiry was
-- delivered six weeks ago is not a hot lead, and counting them as one puts a satisfied
-- customer at the top of today's call list.
--
-- The existing `ready_to_buy_requests` stays: it is the lifetime figure, and it is what
-- a report on intent quality wants.
--
-- WHY DROP AND CREATE RATHER THAN REPLACE
-- `create or replace view` can only append columns at the end. The new count belongs
-- beside the one it qualifies, so the view is rebuilt. Nothing depends on it - no
-- other view, no foreign key - so the drop is safe, and it happens inside the
-- migration's transaction, so no request can see the view missing.

DROP VIEW IF EXISTS "customer_summary";
--> statement-breakpoint
CREATE VIEW "customer_summary" AS
WITH counts AS (
  SELECT
    l.customer_id,
    count(*)::int AS total_requests,
    count(*) FILTER (WHERE NOT s.is_terminal)::int AS open_requests,
    count(*) FILTER (WHERE u.is_ready_to_buy)::int AS ready_to_buy_requests,
    count(*) FILTER (WHERE u.is_ready_to_buy AND NOT s.is_terminal)::int
      AS open_ready_to_buy_requests,
    count(*) FILTER (WHERE s.is_won)::int AS won_requests,
    count(*) FILTER (WHERE s.is_terminal AND NOT s.is_won)::int AS lost_requests,
    sum(l.quantity)::int AS total_quantity,
    min(l.contacted_at) AS first_contact_at,
    max(l.contacted_at) AS last_contact_at
  FROM leads l
  JOIN lead_statuses s ON s.id = l.status_id
  LEFT JOIN urgency_levels u ON u.id = l.urgency_id
  WHERE l.deleted_at IS NULL
  GROUP BY l.customer_id
),

-- The most recent enquiry, whatever it contains. `created_at` and `id` break ties
-- so the answer is stable when two enquiries share a contact timestamp - which the
-- CSV import will produce, since a spreadsheet only records the date.
latest AS (
  SELECT DISTINCT ON (l.customer_id)
    l.customer_id,
    l.id AS latest_lead_id,
    l.reference AS latest_lead_reference,
    l.status_id AS latest_status_id,
    l.urgency_id AS latest_urgency_id,
    l.platform_id AS latest_platform_id
  FROM leads l
  WHERE l.deleted_at IS NULL
  ORDER BY l.customer_id, l.contacted_at DESC, l.created_at DESC, l.id
),

-- How we met them: the platform of their first enquiry. This is the "Platform"
-- column on the customer list, and it is the figure that answers "which channel is
-- worth posting on", so it must be the first touch and not the most recent one.
first_touch AS (
  SELECT DISTINCT ON (l.customer_id)
    l.customer_id,
    l.platform_id AS first_platform_id
  FROM leads l
  WHERE l.deleted_at IS NULL
  ORDER BY l.customer_id, l.contacted_at, l.created_at, l.id
),

-- "Last Interest": the newest enquiry that actually names a product. Separate from
-- `latest` on purpose - a follow-up message with no product attached must not blank
-- out what we know they were after.
last_interest AS (
  SELECT DISTINCT ON (l.customer_id)
    l.customer_id,
    l.category_id AS last_interest_category_id,
    l.subcategory_id AS last_interest_subcategory_id
  FROM leads l
  WHERE l.deleted_at IS NULL AND l.subcategory_id IS NOT NULL
  ORDER BY l.customer_id, l.contacted_at DESC, l.created_at DESC, l.id
)

SELECT
  c.id AS customer_id,

  coalesce(n.total_requests, 0) AS total_requests,
  coalesce(n.open_requests, 0) AS open_requests,
  coalesce(n.ready_to_buy_requests, 0) AS ready_to_buy_requests,
  coalesce(n.open_ready_to_buy_requests, 0) AS open_ready_to_buy_requests,
  coalesce(n.won_requests, 0) AS won_requests,
  coalesce(n.lost_requests, 0) AS lost_requests,
  n.total_quantity,

  n.first_contact_at,
  n.last_contact_at,

  -- Repeat or new. More than one enquiry is the whole signal the business is after:
  -- it means the person came back, which no single message tells you.
  coalesce(n.total_requests, 0) > 1 AS is_repeat,

  l.latest_lead_id,
  l.latest_lead_reference,
  l.latest_status_id,
  l.latest_urgency_id,
  l.latest_platform_id,

  ft.first_platform_id,

  li.last_interest_category_id,
  li.last_interest_subcategory_id

FROM customers c
LEFT JOIN counts n ON n.customer_id = c.id
LEFT JOIN latest l ON l.customer_id = c.id
LEFT JOIN first_touch ft ON ft.customer_id = c.id
LEFT JOIN last_interest li ON li.customer_id = c.id
-- Soft-deleted customers are excluded here rather than in every caller, so no query
-- can leak one by forgetting. The few screens that need to see removed customers
-- read the table directly.
WHERE c.deleted_at IS NULL;
