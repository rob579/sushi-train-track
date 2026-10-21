const { open } = require('../lib/harness');
exports.run = async t => {
  const a = await open();
  const c = (v, cur) => a.ev(`toCents(${JSON.stringify(v)}, ${JSON.stringify(cur)})`);
  // amounts typed in any style become hundredths
  t.eq('4.50', c('4.50', 'USD'), 450);
  t.eq('4,50 (comma decimal)', c('4,50', 'EUR'), 450);
  t.eq('1,234.50', c('1,234.50', 'USD'), 123450);
  t.eq('1.234,50', c('1.234,50', 'EUR'), 123450);
  t.eq('whole number', c('3', 'USD'), 300);
  t.eq('yen 450', c('450', 'JPY'), 45000);
  t.eq('yen 1,200 (thousands comma)', c('1,200', 'JPY'), 120000);
  t.eq('yen 1.200 (thousands dot)', c('1.200', 'JPY'), 120000);
  t.eq('currency symbol ignored', c('$4.50', 'USD'), 450);
  t.eq('empty is invalid', c('', 'USD'), null);
  t.eq('negative is invalid', c('-2', 'USD'), null);
  t.eq('letters are invalid', c('abc', 'USD'), null);
  // short symbols, not codes
  t.eq('euro symbol', a.ev("symOf('EUR')"), '€');
  t.eq('yen symbol', a.ev("symOf('JPY')"), '¥');
  t.eq('pound symbol', a.ev("symOf('GBP')"), '£');
  t.eq('yen has no decimals', a.ev("digitsOf('JPY')"), 0);
  t.eq('dollar has 2 decimals', a.ev("digitsOf('USD')"), 2);
  t.check('money() uses the symbol, not the code', /^€\s?3\.50$|^3[.,]50\s?€$/.test(a.ev("money(350, {currency:'EUR'})")), a.ev("money(350, {currency:'EUR'})"));
  t.check('yen shows no decimals', /¥\s?450$/.test(a.ev("money(45000, {currency:'JPY'})")), a.ev("money(45000, {currency:'JPY'})"));
  // an invalid browser language tag must not break the page (headless browsers report en-US@posix)
  t.eq('page loads without errors', a.errors.length, 0);
  a.close();
};
