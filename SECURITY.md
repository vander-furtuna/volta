# Segurança e dados

## Reportar um problema

Fale direto com a liderança do squad. Não abra issue pública com detalhes de vulnerabilidade.

## Regras do projeto

- **Tokens da CW** (`access_token`, `refresh_token`) ficam só no servidor, cifrados com AES-256-GCM (`src/server/security/token-encryption.ts`). Nunca vão para o navegador, para logs ou para mensagens de erro.
- **Nunca registre em log** `access_token`, `refresh_token`, `code`, `code_verifier`, tickets de SSO nem telefones de clientes.
- **Webhooks:** pedidos são autenticados pelo `X-Webhook-Token`; cobrança, pela assinatura HMAC `X-Cardapio-Signature`. Requisições sem autenticação válida recebem 401.
- **Banco:** Row Level Security ativado em todas as tabelas, sem políticas públicas. Só o servidor, com a service role, acessa os dados.
- **Isolamento por loja:** toda consulta filtra por `store_id`. Cada instalação da CW vale para uma única unidade.
- **Chave de serviço do Supabase** nunca recebe o prefixo `NEXT_PUBLIC_`.

## LGPD

- **Minimização:** do cadastro de clientes guardamos só nome, telefone e a autorização de WhatsApp (`notifications_enabled`). Não usamos data de nascimento, gênero nem endereço.
- **Finalidade:** os dados servem para montar o público da campanha e medir o retorno. Não são vendidos nem cruzados entre lojas.
- **Desinstalação:** os tokens são revogados pela CW e o Volta para de chamar a API daquela loja. A política de retenção e exclusão dos dados restantes ainda precisa ser definida (ver `docs/open-questions.md`).
- **Mensagens:** o Volta não envia mensagens. O gestor envia pelos canais dele e respeita a autorização de cada cliente.
