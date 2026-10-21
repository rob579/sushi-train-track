#!/usr/bin/env node
// One command runs every check:  npm test   (or: node tests/run.js)
// Options: --quick  (skips the slow browser-like suites)   <name>  (runs only suites whose file name contains it)
const fs = require('fs');
const path = require('path');
const { build, makeT } = require('./lib/harness');

(async () => {
  const args = process.argv.slice(2);
  const quick = args.includes('--quick');
  const only = args.filter(a => !a.startsWith('--'));
  build();
  const dir = path.join(__dirname, 'suites');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()
    .filter(f => !only.length || only.some(o => f.includes(o)));
  let pass = 0, fail = 0;
  for (const f of files) {
    const mod = require(path.join(dir, f));
    if (quick && mod.slow) continue;
    const t = makeT(f.replace(/^\d+-|\.js$/g, ''));
    try { await mod.run(t); } catch (e) { t.failed.push('SUITE CRASHED: ' + (e && e.stack || e)); }
    pass += t.passed; fail += t.failed.length;
    console.log(`${t.failed.length ? 'FAIL' : ' ok '}  ${t.name.padEnd(14)} ${String(t.passed).padStart(3)} passed${t.failed.length ? ', ' + t.failed.length + ' FAILED' : ''}`);
    for (const m of t.failed) console.log('        x ' + m);
  }
  console.log(`\n${fail ? 'SOME CHECKS FAILED' : 'ALL CHECKS PASSED'}: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
