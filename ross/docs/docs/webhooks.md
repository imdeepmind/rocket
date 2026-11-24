---
sidebar_position: 12
---

# Webhooks

ROSS provides an event-driven outbound webhook engine that automatically dispatches HTTP `POST` notifications to external endpoints when your API routes execute.

Webhooks allow you to integrate ROSS with third-party systems such as triggering Slack or Discord notifications, syncing data to external CRMs, or streaming events to downstream microservices without writing custom dispatch logic.

## Example Configuration

Webhooks are configured under the `apis` configuration section using the target route's **API Identifier**:

```json
{
  "apis": {
    "model.v1.orders.unknown.post": {
      "webhooks": [
        {
          "url": "https://api.example.com/webhooks/order-events",
          "data": ["body", "response"],
          "triggerOnRequest": false,
          "triggerOnResponse": true
        }
      ]
    }
  }
}
```

## Fields Reference

Each entry in the `webhooks` array accepts the following properties:

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `url` | `string` | **Yes** | The destination HTTP or HTTPS endpoint URL. Supports environment variables (e.g., `"env:ORDER_WEBHOOK_URL"`). |
| `data` | `string[]` | **Yes** | Array of request/response segments to include in the payload. Allowed values: `"body"`, `"query"`, `"params"`, `"response"`. |
| `triggerOnRequest` | `boolean` | **Yes** | If `true`, the webhook fires **before** the route handler executes. |
| `triggerOnResponse` | `boolean` | **Yes** | If `true`, the webhook fires **after** the route handler completes and passes the response data. |

## Payload Structure

ROSS constructs a unified JSON payload containing only the segments specified in the `data` array:

```json
{
  "body": { ... },
  "query": { ... },
  "params": { ... },
  "response": { ... }
}
```

- **`body`**: Injected if `"body"` is present in `data`. Contains the incoming request body (`request.body`).
- **`query`**: Injected if `"query"` is present in `data`. Contains the URL search parameters (`request.query`).
- **`params`**: Injected if `"params"` is present in `data`. Contains dynamic route parameters (`request.params`, such as `:id`).
- **`response`**: Injected if `"response"` is present in `data` and the webhook was fired on a response trigger (`triggerOnResponse: true`). Contains the structured response payload returned by the handler.

### HTTP Headers Sent by ROSS

Every outbound webhook request includes the following standard headers:

```http
POST /webhooks/order-events HTTP/1.1
Host: api.example.com
Content-Type: application/json
X-Rocket-Webhook: true
```

The `X-Rocket-Webhook: true` header allows receiving servers to quickly identify and verify that the request originated from ROSS.

## Trigger Lifecycle

ROSS routes support two execution trigger points for webhooks:

```text
Incoming Request
       │
       ▼
[Trigger: request]  ──────►  Fires webhooks with triggerOnRequest: true
       │                     (Payload contains body, query, params)
       ▼
Route Handler Executes
(Database operations, validation, business logic)
       │
       ▼
[Trigger: response] ──────►  Fires webhooks with triggerOnResponse: true
       │                     (Payload contains body, query, params, response)
       ▼
Client Receives Response
```

### 1. `triggerOnRequest: true`

Fires immediately before the route handler runs. Useful for:

- Auditing incoming requests before mutation.
- Ingestion notifications.

### 2. `triggerOnResponse: true`

Fires immediately after the route handler successfully finishes and generates its response. Useful for:

- Post-creation notifications (e.g. sending created database IDs or timestamps).
- Sending responses to downstream queues.

## Error Handling & Reliability

- **Non-blocking Execution:** Webhook delivery is performed using native `fetch`.
- **Fault Tolerance:** If a webhook endpoint is unreachable, times out, or responds with an HTTP error code (such as `500 Internal Server Error`), ROSS logs the failure at `warn` or `error` level.
- **Client Safety:** A webhook failure **never fails or crashes the primary client request**. Your API consumers will always receive their intended response regardless of whether the external webhook receiver is online.

## Practical Examples

### 1. Order Creation Event (Post-Response)

Send the order body and the newly created database record to an analytics service after an order is inserted:

```json
{
  "apis": {
    "model.v1.orders.unknown.post": {
      "webhooks": [
        {
          "url": "https://analytics.internal/events/orders",
          "data": ["body", "response"],
          "triggerOnRequest": false,
          "triggerOnResponse": true
        }
      ]
    }
  }
}
```

### 2. Audit Logging on User Updates

Audit when user records are edited, sending the route parameters (user ID), update body, and query parameters:

```json
{
  "apis": {
    "model.v1.users.unknown.edit": {
      "webhooks": [
        {
          "url": "https://audit.internal/log",
          "data": ["params", "body"],
          "triggerOnRequest": true,
          "triggerOnResponse": false
        }
      ]
    }
  }
}
```

### 3. Custom Endpoints Integration

Webhooks work seamlessly with custom function and SQL endpoints using their custom API identifier:

```json
{
  "apis": {
    "custom.v1.all.unknown.processPayment": {
      "webhooks": [
        {
          "url": "https://notifications.service.com/payment-alert",
          "data": ["body", "response"],
          "triggerOnRequest": false,
          "triggerOnResponse": true
        }
      ]
    }
  }
}
```
