import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runOperation } from '../operations.mjs';
import { validatePaymentLink, renderPaymentLink } from '../../../js/payments.js';

const operation = '79a4e312-292a-44a6-8b7f-3a4f94ea9c01';
const options = { command: 'create-payment-link', mode: 'test', price: 'price_sample', operation, execute: true };
function mockStripe(overrides = {}) {
  const calls = [];
  let invoice = { id: 'in_sample', livemode: false, status: 'draft', auto_advance: false, total: 0 };
  const price = { id: 'price_sample', livemode: false, active: true, currency: 'brl', type: 'one_time', billing_scheme: 'per_unit', unit_amount: 10000, ...overrides };
  const link = { id: 'plink_sample', livemode: false, active: true, url: 'https://buy.stripe.com/test_example' };
  return { calls, prices: { retrieve: async () => price },
    customers: { retrieve: async () => ({ id: 'cus_sample', livemode: false }) },
    paymentLinks: {
      create: async (body, request) => { calls.push(['link', body, request]); return link; },
      retrieve: async () => link,
    },
    invoices: {
      create: async (body, request) => { calls.push(['invoice', body, request]); return invoice; },
      retrieve: async () => invoice,
    },
    invoiceItems: { create: async (body, request) => {
      calls.push(['item', body, request]); invoice = { ...invoice, total: 10000 }; return { id: 'ii_sample' };
    } },
  };
}
async function temp(t) {
  const path = await mkdtemp(join(tmpdir(), 'manupsico-stripe-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

test('pagamento desabilitado por padrão e sem endereço', () => {
  assert.equal(validatePaymentLink({ enabled: false, paymentLink: 'https://buy.stripe.com/liveExample' }, 'manupsico.com.br'), null);
  assert.equal(validatePaymentLink({ enabled: true, paymentLink: '' }, 'manupsico.com.br'), null);
});
test('somente link Stripe de produção em host público', () => {
  assert.equal(validatePaymentLink({ enabled: true, paymentLink: 'https://buy.stripe.com/liveExample' }, 'manupsico.com.br').test, false);
  assert.equal(validatePaymentLink({ enabled: true, paymentLink: 'https://buy.stripe.com/test_example' }, 'manupsico.com.br'), null);
  assert.equal(validatePaymentLink({ enabled: true, paymentLink: 'https://buy.stripe.com/test_example' }, 'localhost').test, true);
});
for (const url of ['javascript:alert(1)', 'http://buy.stripe.com/abc', 'https://buy.stripe.com.evil.example/abc', 'https://buy.stripe.com@evil.example/abc', 'https://user:pass@buy.stripe.com/abc', 'https://invoice.stripe.com/i/private', 'https://buy.stripe.com/abc?prefilled_email=person@example.com', 'https://buy.stripe.com/abc#patient', 'https://buy.stripe.com:444/abc']) {
  test(`rejeita destino inseguro ou personalizado: ${url}`, () => {
    assert.equal(validatePaymentLink({ enabled: true, paymentLink: url }, 'manupsico.com.br'), null);
  });
}
test('configuração inválida mantém botão oculto e remove href', () => {
  const link = { hidden: false, href: 'old', removeAttribute: () => { delete link.href; } };
  const status = {};
  const document = { getElementById: id => id === 'payment-link' ? link : status };
  renderPaymentLink(document, {}, 'manupsico.com.br');
  assert.equal(link.hidden, true); assert.equal(link.href, undefined);
  assert.match(status.textContent, /WhatsApp/);
});
test('prévia não escreve na Stripe nem cria diário', async t => {
  const dir = await temp(t); const stripe = mockStripe();
  const result = await runOperation(stripe, { ...options, execute: false }, dir);
  assert.equal(result.dryRun, true); assert.equal(stripe.calls.length, 0);
  await assert.rejects(readFile(join(dir, operation + '.json')), { code: 'ENOENT' });
});
test('repetir criação de link recupera o mesmo link', async t => {
  const dir = await temp(t); const stripe = mockStripe();
  const first = await runOperation(stripe, options, dir);
  assert.deepEqual(await runOperation(stripe, options, dir), first);
  assert.equal(stripe.calls.length, 1);
  assert.equal(stripe.calls[0][1].line_items[0].quantity, 1);
  assert.match(stripe.calls[0][2].idempotencyKey, /payment-link$/);
});
for (const invalid of [{ currency: 'usd' }, { unit_amount: 0 }, { unit_amount: -1 }, { active: false }, { type: 'recurring' }, { livemode: true }, { custom_unit_amount: {} }, { transform_quantity: {} }]) {
  test(`rejeita preço incompatível: ${JSON.stringify(invalid)}`, async t => {
    const stripe = mockStripe(invalid);
    await assert.rejects(runOperation(stripe, options, await temp(t)), /preço deve/);
    assert.equal(stripe.calls.length, 0);
  });
}
test('fatura continua rascunho e item vai somente para a fatura indicada', async t => {
  const dir = await temp(t); const stripe = mockStripe();
  const opts = { ...options, command: 'draft-invoice', customer: 'cus_sample', daysDue: 7 };
  const result = await runOperation(stripe, opts, dir);
  await runOperation(stripe, opts, dir);
  assert.equal(result.status, 'draft'); assert.equal(result.autoAdvance, false);
  assert.equal(stripe.calls.length, 2);
  assert.equal(stripe.calls[0][1].auto_advance, false);
  assert.equal(stripe.calls[0][1].pending_invoice_items_behavior, 'exclude');
  assert.equal(stripe.calls[0][1].collection_method, 'send_invoice');
  assert.equal(stripe.calls[1][1].invoice, 'in_sample');
  assert.deepEqual(stripe.calls[1][1].pricing, { price: 'price_sample' });
});
test('falha no item permite retomar a mesma fatura', async t => {
  const dir = await temp(t); const stripe = mockStripe();
  const create = stripe.invoiceItems.create; let failed = false;
  stripe.invoiceItems.create = async (...args) => {
    if (!failed) { failed = true; throw new Error('Falha transitória'); }
    return create(...args);
  };
  const opts = { ...options, command: 'draft-invoice', customer: 'cus_sample', daysDue: 7 };
  await assert.rejects(runOperation(stripe, opts, dir), /transitória/);
  await runOperation(stripe, opts, dir);
  assert.equal(stripe.calls.filter(c => c[0] === 'invoice').length, 1);
  assert.equal(stripe.calls.filter(c => c[0] === 'item').length, 1);
});
test('recusa repetição com preço alterado', async t => {
  const dir = await temp(t); const stripe = mockStripe();
  await runOperation(stripe, options, dir);
  await assert.rejects(runOperation(stripe, { ...options, price: 'price_another' }, dir), /parâmetros diferentes/);
  assert.equal(stripe.calls.length, 1);
});
test('não repete mutação fora da janela de idempotência', async t => {
  const dir = await temp(t); const stripe = mockStripe();
  await runOperation(stripe, options, dir);
  const path = join(dir, operation + '.json');
  const state = JSON.parse(await readFile(path, 'utf8'));
  state.createdAt = Date.now() - 24 * 60 * 60 * 1000;
  await writeFile(path, JSON.stringify(state));
  await assert.rejects(runOperation(stripe, options, dir), /Janela segura/);
  assert.equal(stripe.calls.length, 1);
});
test('cliente excluído não gera rascunho', async t => {
  const stripe = mockStripe();
  stripe.customers.retrieve = async () => ({ deleted: true });
  await assert.rejects(runOperation(stripe, { ...options, command: 'draft-invoice', customer: 'cus_sample', daysDue: 7 }, await temp(t)), /Cliente inválido/);
  assert.equal(stripe.calls.length, 0);
});
