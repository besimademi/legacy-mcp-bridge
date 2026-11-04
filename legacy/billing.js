// billing.js -- original invoicing module (circa 2014).
// No tests, no types, no docs. The original author has left.
// DO NOT EDIT: this file is frozen. New behaviour goes in src/ behind the strangler facade.
/* eslint-disable */
// @ts-nocheck

var DB = {
  customers: [
    { id: 1, name: "Alfa Trade DOOEL", tier: "G", country: "MK" },
    { id: 2, name: "Vardar Logistics", tier: "S", country: "MK" },
    { id: 3, name: "Ohrid Retail", tier: "", country: "MK" },
    { id: 4, name: "Balkan Supply", tier: "g", country: "AL" }
  ]
};

var TAX = 0.18;

function findCust(id) {
  var c = null;
  for (var i = 0; i < DB.customers.length; i++) {
    if (DB.customers[i].id == id) c = DB.customers[i];
  }
  return c;
}

function calc(cust_id, items) {
  var c = findCust(cust_id);
  if (!c) return { err: "NO_CUST" };
  var sub = 0;
  for (var j = 0; j < items.length; j++) {
    var it = items[j];
    var q = it.qty < 0 ? 0 : it.qty;
    var line = it.price * q;
    if (q >= 10) line = line * 0.98; // bulk discount, per line
    line = Math.round(line * 100) / 100;
    sub += line;
  }
  var d = 0;
  if (c.tier == "G") d = 0.1;
  else if (c.tier == "S") d = 0.05;
  var afterDisc = Math.round(sub * (1 - d) * 100) / 100;
  var tax = Math.round(afterDisc * TAX * 100) / 100;
  var ship = afterDisc > 1000 ? 0 : 5;
  if (items.length == 0) ship = 0;
  return {
    sub: sub,
    disc: Math.round((sub - afterDisc) * 100) / 100,
    tax: tax,
    ship: ship,
    total: Math.round((afterDisc + tax + ship) * 100) / 100
  };
}

function getCustomers() {
  return DB.customers;
}

export { calc, findCust, getCustomers };
