import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export function validateOptions(options) {
  if (!['create-payment-link', 'draft-invoice'].includes(options.command)) throw new Error('Comando inválido.');
  if (!['test', 'live'].includes(options.mode)) throw new Error('STRIPE_MODE deve ser test ou live.');
  if (!/^price_[A-Za-z0-9]+$/.test(options.price || '')) throw new Error('Informe um Price ID válido em --price.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(options.operation || '')) {
    throw new Error('Informe um UUID v4 em --operation; reutilize-o nas tentativas da mesma operação.');
  }
  if (options.command === 'draft-invoice') {
    if (!/^cus_[A-Za-z0-9]+$/.test(options.customer || '')) throw new Error('Informe um Customer ID válido em --customer.');
    if (!Number.isInteger(options.daysDue) || options.daysDue < 1 || options.daysDue > 365) throw new Error('--days-due deve estar entre 1 e 365.');
  }
}

async function withJournal(directory, options, fn) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const file = join(directory, options.operation + '.json');
  const lockPath = file + '.lock';
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Operação bloqueada. Verifique se existe outro processo ou uma execução interrompida antes de tentar novamente.');
    throw error;
  }
  try {
    const fingerprint = createHash('sha256').update(JSON.stringify({
      command: options.command, mode: options.mode, price: options.price,
      customer: options.customer, daysDue: options.daysDue,
    })).digest('hex');
    let state;
    try { state = JSON.parse(await readFile(file, 'utf8')); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      state = { fingerprint, createdAt: Date.now() };
    }
    if (state.fingerprint !== fingerprint) throw new Error('Este --operation já foi usado com parâmetros diferentes.');
    if (Date.now() - state.createdAt >= 23 * 60 * 60 * 1000) {
      throw new Error('Janela segura de repetição encerrada. Concilie os recursos no Dashboard antes de iniciar outra operação.');
    }
    const save = async () => {
      await writeFile(file + '.tmp', JSON.stringify(state), { mode: 0o600 });
      await rename(file + '.tmp', file);
    };
    await save();
    return await fn(state, save);
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}

export async function runOperation(stripe, options, directory) {
  validateOptions(options);
  const live = options.mode === 'live';
  const price = await stripe.prices.retrieve(options.price);
  if (price.livemode !== live || !price.active || price.currency !== 'brl' ||
      price.type !== 'one_time' || price.billing_scheme !== 'per_unit' ||
      price.custom_unit_amount || price.transform_quantity ||
      !Number.isSafeInteger(price.unit_amount) || price.unit_amount <= 0) {
    throw new Error('O preço deve ser ativo, avulso, fixo, positivo, em BRL e do ambiente selecionado.');
  }
  if (options.command === 'draft-invoice') {
    const customer = await stripe.customers.retrieve(options.customer);
    if (customer.deleted || customer.livemode !== live) throw new Error('Cliente inválido para o ambiente selecionado.');
  }
  const summary = { mode: options.mode, command: options.command, price: price.id, amountInCents: price.unit_amount, currency: 'brl' };
  if (!options.execute) return { ...summary, dryRun: true };

  return withJournal(directory, options, async (state, save) => {
    const metadata = { integration: 'manupsico_static_v1', operation_id: options.operation };
    const request = step => ({ idempotencyKey: `manupsico:${options.mode}:${options.operation}:${step}` });
    if (options.command === 'create-payment-link') {
      const link = state.linkId
        ? await stripe.paymentLinks.retrieve(state.linkId)
        : await stripe.paymentLinks.create({
          line_items: [{ price: price.id, quantity: 1 }],
          customer_creation: 'always',
          metadata,
          payment_intent_data: { metadata },
          after_completion: { type: 'hosted_confirmation', hosted_confirmation: {
            custom_message: 'Guarde seu comprovante. O horário da sessão é combinado diretamente com a Manu.',
          } },
        }, request('payment-link'));
      state.linkId = link.id;
      await save();
      if (link.livemode !== live || !link.active) throw new Error('Link inativo ou de ambiente diferente. Revise no Dashboard.');
      return { ...summary, id: link.id, url: link.url };
    }
    let invoice = state.invoiceId
      ? await stripe.invoices.retrieve(state.invoiceId)
      : await stripe.invoices.create({
        customer: options.customer,
        collection_method: 'send_invoice',
        days_until_due: options.daysDue,
        auto_advance: false,
        pending_invoice_items_behavior: 'exclude',
        metadata,
      }, request('invoice'));
    state.invoiceId = invoice.id;
    await save();
    if (invoice.status !== 'draft' || invoice.auto_advance !== false || invoice.livemode !== live) {
      throw new Error('A fatura deixou de ser um rascunho controlado. Revise no Dashboard.');
    }
    if (!state.itemId) {
      const item = await stripe.invoiceItems.create({
        customer: options.customer,
        invoice: invoice.id,
        pricing: { price: price.id },
        quantity: 1,
        description: 'Sessão de atendimento online',
        metadata,
      }, request('invoice-item'));
      state.itemId = item.id;
      await save();
    }
    invoice = await stripe.invoices.retrieve(invoice.id);
    return { ...summary, id: invoice.id, status: invoice.status,
      totalInCents: invoice.total, autoAdvance: invoice.auto_advance,
      note: 'Rascunho criado. Revise cliente, total e vencimento no Dashboard antes de finalizar ou enviar.' };
  });
}
