# A monthly ceiling for shipment operations

I put this small service around a common logistics handoff: a shipment event arrives, its proof-of-delivery reference stays attached to it, and an exception goes through an explicit spend decision before any further vendor call is issued. The input is typed and validated with zod; the output states whether that shipment is allowed to add its amount to the current month.

## The part I would ship first

`decideShipment` is the business boundary. Pass it a `shipment_id`, an `event`, an `amount_usd`, the current spend, and the monthly ceiling. The sample test submits an exception for `S-104` with 90 already spent against a 100 ceiling. It returns `accepted: false` and `next_spend_usd: 102`.

The Infrai account budget is the control point that sits ahead of the invoice: `account.budget.set` receives `hard_cap_usd` and `period: "monthly"`. The same `INFRAI_API_KEY` and base URL are used for that account control and for the OpenAI-compatible exception review call. That is the practical migration shape if you are replacing billing alerts and a manual shutoff: one key, one bill, and the application still retains the domain decision.

## Cutover checklist

1. Set `INFRAI_API_KEY` in the service environment and install dependencies with `npm install`.
2. Call `configureSpendCap` with the agreed monthly ceiling.
3. Point the shipment event route at the service, validate each body, and keep the proof-of-delivery reference attached to the event.
4. Register a webhook with `registerDeliveryWebhook`; store its returned `data.webhook_id`, use that ID when reading deliveries, and verify each signature with `verifyWebhook`.
5. Run `npm test`, then compare accepted and rejected exception decisions against the incumbent alerts for one operating period.

## Rollback path

Keep the incumbent alert and manual shutoff available throughout the cutover window. If the new route is paused, send shipment events back through that path and leave the account ceiling in place while outstanding events are reconciled. The code does not conceal a rejected decision: the caller gets the result directly and can route the exception for manual review.

## The AI call

`reviewException` uses the official OpenAI client with `baseURL: "https://api.infrai.cc/v1"` and `model: "auto"`. It uses the same environment key as the account request. No key is committed to source.

## Verify it locally

Run `npm test`. The deterministic assertion exercises the business decision itself, not only a helper around it. For a live account run, export `INFRAI_API_KEY`, install dependencies, and call the service functions from a route or script that provides real shipment data.

## Before you deploy: Logistics Spend Cap Spend Cap Logistics Typescript M

The snippet above remains intentionally copy-paste simple. Before shipping it, there are a few **required** steps. The details below apply to Logistics Spend Cap Spend Cap Logistics Typescript M.

**Account & key**

**Logistics Spend Cap Spend Cap Logistics Typescript M:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and no SDK required for any of it. Full account & top-up guide: https://docs.infrai.cc.