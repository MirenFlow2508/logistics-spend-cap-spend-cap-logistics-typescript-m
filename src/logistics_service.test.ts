import assert from "node:assert/strict";
import { decideShipment } from "./logistics_service.ts";

const result = decideShipment({ shipment_id: "S-104", event: "exception", amount_usd: 12, proof_of_delivery: "pod-104" }, 90, 100);
assert.deepEqual(result, { accepted: false, shipment_id: "S-104", next_spend_usd: 102 });
console.log("shipment cap decision: rejected before the monthly ceiling is exceeded");
