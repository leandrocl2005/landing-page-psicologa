import { paymentConfig } from './payment-config.js';

export function validatePaymentLink(config, hostname) {
  if (config?.enabled !== true || typeof config.paymentLink !== 'string') return null;
  try {
    const url = new URL(config.paymentLink);
    if (url.protocol !== 'https:' || url.hostname !== 'buy.stripe.com' ||
        url.username || url.password || url.port || url.search || url.hash ||
        !/^\/(?:test_)?[a-zA-Z0-9]+$/.test(url.pathname)) return null;
    const test = url.pathname.startsWith('/test_');
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
    if (test && !local) return null;
    return { url: url.href, test };
  } catch {
    return null;
  }
}

export function renderPaymentLink(document, config, hostname) {
  const link = document.getElementById('payment-link');
  const status = document.getElementById('payment-status');
  if (!link || !status) return;
  link.hidden = true;
  link.removeAttribute('href');
  const payment = validatePaymentLink(config, hostname);
  if (!payment) {
    status.textContent = 'Para receber o link de pagamento da sua sessão, entre em contato pelo WhatsApp.';
    return;
  }
  link.href = payment.url;
  link.hidden = false;
  status.textContent = payment.test
    ? 'Ambiente de teste: use somente dados de teste da Stripe. Nenhum valor real será cobrado.'
    : 'Confira o valor combinado e os meios de pagamento disponíveis na próxima tela.';
}

if (typeof document !== 'undefined') {
  renderPaymentLink(document, paymentConfig, window.location.hostname);
}
