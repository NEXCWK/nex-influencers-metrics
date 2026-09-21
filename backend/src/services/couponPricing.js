'use strict';

// Port fiel de nexcupominflu/src/lib/pricing.ts — mantém os mesmos preços,
// descontos e comissões do sistema original.

const PRODUCTS = {
  access_pass: {
    key: 'access_pass',
    label: 'Cupom Access Pass',
    shortLabel: 'Access Pass',
    group: 'access_pass',
    price: 130,
    discountRate: 0.2, // 20% de desconto ao cliente
    commissionRate: 0.1, // 10% de comissão ao influenciador
  },
  atrium: {
    key: 'atrium',
    label: 'Cupom Atrium',
    shortLabel: 'Atrium',
    group: 'espacos',
    price: 890,
    discountRate: 0,
    commissionRate: 0.5,
  },
  gallery: {
    key: 'gallery',
    label: 'Cupom Gallery',
    shortLabel: 'Gallery',
    group: 'espacos',
    price: 640,
    discountRate: 0,
    commissionRate: 0.5,
  },
};

const PRODUCT_LIST = Object.values(PRODUCTS);

function computeTotals(product) {
  const cfg = PRODUCTS[product];
  if (!cfg) throw new Error(`Produto de cupom inválido: ${product}`);
  const price = cfg.price;
  const discount = Math.round(price * cfg.discountRate * 100) / 100;
  const amountPaid = Math.round((price - discount) * 100) / 100;
  const commission = Math.round(price * cfg.commissionRate * 100) / 100;
  return { price, discount, amountPaid, commission };
}

module.exports = { PRODUCTS, PRODUCT_LIST, computeTotals };
