// Configuração pública: somente um Payment Link genérico, nunca chaves ou faturas individuais.
export const paymentConfig = Object.freeze({
  enabled: false,
  // Link de TESTE de R$ 200,00. Substituir pelo link de produção antes da ativação pública.
  paymentLink: 'https://buy.stripe.com/test_dRmaEXei2bam4daeo0grS00',
});
