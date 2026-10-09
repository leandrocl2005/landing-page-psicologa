import Stripe from 'stripe';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { runOperation } from './operations.mjs';

const usage = `Uso (prévia por padrão):
  npm run stripe -- create-payment-link --price price_ID --operation UUID
  npm run stripe -- draft-invoice --price price_ID --customer cus_ID --days-due 7 --operation UUID
Adicione --execute somente após conferir a prévia. A fatura permanece em rascunho.
Configure STRIPE_API_KEY e STRIPE_MODE=test no ambiente administrativo.`;

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    price: { type: 'string' }, customer: { type: 'string' },
    'days-due': { type: 'string' }, operation: { type: 'string' },
    execute: { type: 'boolean', default: false }, help: { type: 'boolean' },
  } });
  if (values.help || !positionals.length) {
    console.log(usage);
  } else {
    if (positionals.length !== 1) throw new Error('Informe apenas um comando.');
    const mode = process.env.STRIPE_MODE || 'test';
    const key = process.env.STRIPE_API_KEY || '';
    if (!['test', 'live'].includes(mode) || !new RegExp(`^(rk|sk)_${mode}_[A-Za-z0-9]+$`).test(key)) {
      throw new Error('Configure uma chave de API válida e compatível com STRIPE_MODE.');
    }
    // O SDK fixado define a versão de API; não usar uma versão preview implicitamente.
    const stripe = new Stripe(key, { maxNetworkRetries: 2, timeout: 20000 });
    const result = await runOperation(stripe, {
      command: positionals[0], mode, price: values.price, customer: values.customer,
      daysDue: values['days-due'] ? Number(values['days-due']) : undefined,
      operation: values.operation, execute: values.execute,
    }, fileURLToPath(new URL('./.stripe-state/', import.meta.url)));
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  // Não imprimir payloads, cabeçalhos, chaves ou informações do cliente.
  if (error.type?.startsWith('Stripe')) console.error('A Stripe recusou a operação. Verifique permissões e logs no Dashboard.');
  else console.error(error.message);
  process.exitCode = 1;
}
