# Frartistico DM Bot

Bot minimale per Instagram:

Commento con keyword → risposta pubblica → Private Reply in DM.

## Variabili ambiente

- `VERIFY_TOKEN`: parola segreta scelta da te, da copiare anche in Meta Webhook.
- `ACCESS_TOKEN`: token generato da Meta.
- `KEYWORD`: parola da intercettare, esempio `glowy`.
- `PUBLIC_REPLY`: risposta pubblica al commento.
- `DM_TEXT`: messaggio privato da inviare.
- `GRAPH_VERSION`: versione Graph API, default `v23.0`.

## Endpoint

- `GET /` health check
- `GET /webhook` verifica webhook Meta
- `POST /webhook` ricezione commenti
- `POST /test-private-reply` test manuale con `{ "commentId": "..." }`

