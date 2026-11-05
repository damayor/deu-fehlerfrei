# fehlerfrei-push (streak reminder Worker)

Sends one empty Web Push per day when the daily goal is not met yet. Stores only: push subscription, reminder hour, time zone, and the date the goal was last met. No learning data.

Endpoints (all but the first need `Authorization: Bearer <AUTH_TOKEN>`):
`GET /vapid-public-key`, `PUT /subscription`, `DELETE /subscription`, `POST /test`.

## Deploy (David)

```bash
cd worker/push
npx wrangler kv namespace create SUBS        # copy the id into wrangler.toml
# edit wrangler.toml: ALLOWED_ORIGIN (app origin) and VAPID_SUBJECT (your contact)
node generate-keys.mjs                       # prints the private key JWK
npx wrangler secret put VAPID_PRIVATE_JWK    # paste that JSON line
npx wrangler secret put AUTH_TOKEN           # choose a long random string
npx wrangler deploy
```

Then in the app: Einstellungen > Erinnerung: enter the Worker URL and the token, choose the hour, tap "Aktivieren" and allow notifications. "Test senden" checks the whole chain.

Tests: `node --test worker/push/tests/*.test.js`.
