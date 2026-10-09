# Stripe no site Manu Psicóloga

## Decisão de integração

O repositório é um site estático em HTML/CSS/JS, com domínio `manupsico.com.br`, Calendly para a avaliação gratuita e Formspree para contato. Não havia backend ou integração Stripe nos arquivos inspecionados.

O plano foi validado com o `stripe_implementation_planner` em 09/10/2026. Caminhos escolhidos: Payment Links, faturas manuais com apresentação reutilizável, identidade visual da marca, Hosted Invoice Page e conciliação pelo Dashboard. A integração inicial aproveita a hospedagem estática. Checkout Sessions dinâmicas e webhooks ficam para uma evolução com backend quando houver necessidade de confirmação automática na agenda.

O Payment Link abre o Checkout hospedado. O site nunca confirma sozinho que houve pagamento. A profissional verifica a transação no Dashboard e combina o horário com o cliente. A primeira avaliação de 30 minutos continua gratuita.

## O que está pronto

- `pagamento.html`: página independente, acessível pelo rodapé, sem tags de publicidade ou coleta de dados clínicos.
- `js/payment-config.js`: configuração pública, desabilitada por padrão.
- `js/payments.js`: aceita somente URLs HTTPS de Payment Links da Stripe, sem parâmetros ou dados pessoais. Links de teste só aparecem em localhost.
- Utilitário Node local para criar Payment Links e rascunhos de Invoice pela API, sem chaves no navegador.
- Política de Privacidade atualizada para descrever o fluxo de pagamentos.

O valor informado pelo responsável é **R$ 200,00 por sessão**. Foram criados pelo app Stripe, exclusivamente no ambiente de testes:

- Produto: `prod_VPSpQbJ67BQv8E`.
- Preço avulso BRL 20000 centavos: `price_1UOdtcFklHQ3YChNuhGjublv`.
- Payment Link: `plink_1UOdtnFklHQ3YChNahNSA27t`.
- URL de teste: https://buy.stripe.com/test_dRmaEXei2bam4daeo0grS00

Não houve cobrança, envio de fatura ou configuração de credenciais no repositório. O link de teste está em `js/payment-config.js`, com `enabled: false`. Nenhum pagamento foi concluído no sandbox; essa etapa e a ativação de produção permanecem pendentes.

## Ativação sem backend

1. O valor da sessão é R$ 200,00; definir as regras de cancelamento e reagendamento. Não cobrar a avaliação gratuita.
2. Reutilizar o produto e preço de teste acima. Eles têm descrição administrativa neutra, sem diagnósticos, objetivos clínicos ou nomes de pacientes.
3. Reutilizar o Payment Link de teste acima. A ferramenta abaixo cria outros links quando necessário; não recriar o mesmo recurso apenas para testar. Configurar os meios de pagamento disponíveis, marca e comprovantes no Dashboard. Pix depende do produto, país e habilitação da conta; não presumir que Pix disponível em Checkout também estará disponível em Invoicing.
4. Testar o link localmente usando somente dados de teste Stripe. O link não cria uma reserva de horário.
5. Depois da validação, criar recursos de produção de R$ 200,00 e alterar `js/payment-config.js` com o Payment Link público de produção e `enabled: true`. Não reutilizar IDs ou chaves de teste em produção. Conferir se o preço exibido em `pagamento.html` corresponde ao preço na Stripe antes de publicar, inclusive em reajustes futuros.
6. Publicar a alteração revisada pelo fluxo existente do repositório. Esta branch não precisa mudar a hospedagem.

```js
export const paymentConfig = Object.freeze({
  enabled: true,
  paymentLink: 'COLE_AQUI_O_PAYMENT_LINK_DE_PRODUCAO',
});
```

O endereço acima é deliberadamente inválido. Enquanto o link real não for configurado, a página oferece contato via WhatsApp. Ela nunca recebe chaves da Stripe. A opção pública serve para preço padronizado; valores individuais devem ser cobrados por fatura privada, sem publicar o link dessa fatura no repositório.

## Invoicing

No Dashboard, criar/selecionar o cliente financeiro, incluir a sessão, definir vencimento e revisar o total. Finalizar e enviar a fatura somente após conferir destinatário e valor. O cliente usa a Hosted Invoice Page para pagar e baixar o documento. Não cobrar a mesma sessão simultaneamente pelo link genérico e por uma fatura.

Usar descrições neutras. Nunca inserir GAD-7, diagnóstico ou prontuário em metadata, PDFs ou observações financeiras. A emissão fiscal brasileira deve ser tratada pelo processo contábil adequado; esta integração não emite NFS-e.

A tabela de Invoicing consultada em 09/10/2026 não lista Brasil entre as localizações de empresa suportadas para Pix em faturas. Validar o suporte da conta antes de oferecer esse meio em Invoicing. Para Checkout/Payment Links, a documentação permite Pix avulso em contas brasileiras. Não ativar recorrência sem uma definição explícita do negócio.

## Uso da API com suas chaves

Este utilitário é administrativo e deve rodar em um computador controlado, nunca no navegador nem como endpoint público. O diretório começa com `_` para ficar fora do processamento normal de GitHub Pages/Jekyll. Isso não substitui proteger os segredos: `.env` e `.stripe-state` estão excluídos do Git e não devem ser enviados à hospedagem.

Pré-requisito: Node.js 22 ou superior. A dependência Stripe está fixada no lockfile. A versão de API padrão é a associada a esse SDK; revisar o changelog antes de atualizar.

```bash
cd _tools/stripe
npm ci --ignore-scripts
cp .env.example .env
```

Preencher `.env` localmente com `STRIPE_API_KEY` e `STRIPE_MODE=test`. Preferir chave restrita, com leitura dos preços e clientes usados e escrita somente nos recursos necessários à operação (Payment Links ou Invoices/Invoice Items). Não colar a chave no chat, no código ou em commits. A instalação do app no ChatGPT não disponibiliza automaticamente uma chave de API ao processo Node.

Gerar um UUID v4 uma vez para cada operação de negócio e preservá-lo nas repetições:

```bash
node -e "console.log(require('node:crypto').randomUUID())"
```

Prévia de um link (substituir `price_ID` e `UUID`):

```bash
npm run stripe -- create-payment-link --price price_ID --operation UUID
```

Depois de conferir o modo e valor, executar a mesma operação:

```bash
npm run stripe -- create-payment-link --price price_ID --operation UUID --execute
```

O resultado contém o link genérico, sem informações de pacientes. Não publicar um link de teste no site.

Rascunho de fatura para um cliente já cadastrado (substituir os IDs):

```bash
npm run stripe -- draft-invoice --price price_ID --customer cus_ID --days-due 7 --operation UUID
npm run stripe -- draft-invoice --price price_ID --customer cus_ID --days-due 7 --operation UUID --execute
```

O prazo de sete dias é apenas um exemplo de comando. O código cria uma Invoice com `auto_advance: false`, exclui itens pendentes de outras cobranças e associa o novo item explicitamente à Invoice criada. Não finaliza, envia e-mail nem cobra cartão. Revise cliente, moeda, descontos, tributos, total e vencimento no Dashboard. Descontos/configurações da conta podem alterar o total do rascunho.

Em produção, configurar conscientemente `STRIPE_MODE=live` e uma chave correspondente em ambiente administrativo seguro. A ferramenta valida o ambiente do preço e do cliente. Os comandos de escrita exigem `--execute`; sem essa opção, apenas consultam dados para mostrar a prévia.

## Repetição e falhas

As mutações usam idempotência e um diário local em `.stripe-state`, com IDs financeiros e sem nome/e-mail do cliente. O arquivo deve ser preservado e protegido: não apagar nem trocar de computador para repetir uma operação incerta. Reutilizar o UUID e os mesmos parâmetros. Não criar um novo UUID apenas para contornar uma falha.

Há bloqueio contra concorrência e retomada de rascunhos cujo item falhou. Após 23 horas, a ferramenta interrompe repetições: conferir `metadata.operation_id` e os recursos no Dashboard antes de iniciar uma nova operação. Se o processo foi interrompido deixando um `.lock`, confirmar que ele terminou e conciliar a operação antes de remover somente esse bloqueio. Nunca apagar o diário para repetir.

Esse diário é um mecanismo para administração local, não uma fila distribuída. O Payment Link público é reutilizável e não identifica uma sessão específica; a conferência de pagamentos e possíveis duplicidades é administrativa. Para controle automático por cobrança, implementar um backend com banco transacional, tokens individuais e webhooks.

## Validação

```bash
cd _tools/stripe
npm test
```

Os testes usam doubles da API e verificam: modo e preço incompatíveis, URLs inseguras, bloqueio de links de teste em host público, prévia sem escrita, retomada, duplicidade, fatura em rascunho e item associado à fatura correta. Não equivalem a transações executadas no sandbox.

Para a página, servir a raiz do repositório por HTTP:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Abrir `http://127.0.0.1:8765/pagamento.html`. Validar versão móvel, estado desabilitado e um Payment Link de teste. Verificar sucesso, recusa e autenticação adicional na Stripe, comprovantes e conferência no Dashboard antes da ativação pública.

## Evolução quando necessária

Para automatizar agenda/financeiro, adicionar backend que autorize cada cobrança, controle preço no servidor e crie Checkout Sessions. Persistir webhooks assinados, tratar eventos duplicados/fora de ordem, confirmar valor/moeda e conciliar reembolsos/notas de crédito. Nunca usar uma página de sucesso como prova de pagamento, nem colocar um webhook apenas em um arquivo estático.

## Referências

- https://docs.stripe.com/payment-links/create
- https://docs.stripe.com/invoicing/dashboard
- https://docs.stripe.com/invoicing/hosted-invoice-page
- https://docs.stripe.com/invoicing/payment-methods
- https://docs.stripe.com/api/invoiceitems/create
- https://docs.stripe.com/keys
- https://docs.stripe.com/api/idempotent_requests
- https://docs.stripe.com/checkout/fulfillment
