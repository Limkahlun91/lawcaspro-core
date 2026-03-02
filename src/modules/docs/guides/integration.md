# LawCasPro API Integration Guide

## Authentication
We use Bearer Token authentication with API Keys.
Header: `Authorization: Bearer sk_live_...`

## Rate Limits
- Basic: 60 req/min
- Pro: 300 req/min
- Headers returned:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## Webhooks
Validate webhook payloads using the `X-Signature` header.
Algorithm: `HMAC-SHA256(secret, timestamp + "." + payload)`

## Error Codes
- `QUOTA_EXCEEDED`: You have reached your monthly LHDN submission limit.
- `INVALID_PAYLOAD`: Missing required fields.
- `FEATURE_DISABLED`: Your plan does not support this API.
