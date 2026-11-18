# Estados da campanha

Implementação: `src/domain/campaign/campaign-status.ts`. Rótulos em pt-BR: `src/copy/pt-BR.ts`.

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> audience_frozen: freeze_audience
  audience_frozen --> draft: unfreeze_audience
  audience_frozen --> coupon_created: coupon_created
  audience_frozen --> creation_failed: coupon_creation_failed
  creation_failed --> audience_frozen: retry_creation
  coupon_created --> active: activate
  coupon_created --> closed: close
  active --> invitations_sent: mark_invitations_sent
  active --> paused: pause
  active --> closed: close
  invitations_sent --> paused: pause
  invitations_sent --> closed: close
  paused --> active: resume
  paused --> closed: close
  closed --> [*]
```

| Estado             | Rótulo na interface      | Efeito na CW                                                    |
| ------------------ | ------------------------ | --------------------------------------------------------------- |
| `draft`            | Rascunho                 | nenhum                                                          |
| `audience_frozen`  | Rascunho                 | nenhum                                                          |
| `creation_failed`  | Rascunho, criação falhou | talvez; conferir pelo código antes de repetir                   |
| `coupon_created`   | Cupom criado, desativado | cupom existe com `active: false`                                |
| `active`           | Ativa, convite pendente  | cupom ativo                                                     |
| `invitations_sent` | Ativa, convites enviados | cupom ativo; gestor marcou o envio (sem confirmação de entrega) |
| `paused`           | Pausada por você         | cupom desativado                                                |
| `closed`           | Encerrada                | cupom desativado ou expirado                                    |

## Regras

- Cada transição grava uma linha em `campaign_events` com estado de origem, destino e quem fez.
- O público só pode ser congelado uma vez por tentativa de criação; descongelar volta ao rascunho.
- Ativar reenvia o `coupon_input` completo com `active: true` (a CW exige corpo completo no `PUT`).
- "Convites enviados" é uma declaração do gestor. Nunca escreva "enviada" ou "entregue" na interface.
