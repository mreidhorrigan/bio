'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const FILE = path.join(__dirname, '..', 'MCQer.html');
const html = fs.readFileSync(FILE, 'utf8');

// Pull the inline IIFE body out of the page.
const m = html.match(/\(function \(\) \{([\s\S]*?)\}\)\(\);/);
if (!m) { console.error('Could not locate the IIFE'); process.exit(2); }
let body = m[1];

// Expose the internal closures for testing (and a setter for parsedQuestions,
// which buildVersionParas reads from its closure).
body += `
globalThis.__mcq = {
  parseAllParagraphs, collectAllQuestions, textToRichParagraphs, cleanTextBlock,
  stripVersionXParagraph, assignOptionPools, pickStandaloneSubset, isMcqQ,
  isWrittenQ, buildVersionParas, shuffle, summarizeParse,
  setParsed: (x) => { parsedQuestions = x; }
};`;

// Minimal DOM/browser stubs sufficient for load-time execution.
function el() {
  const e = {
    style: {}, value: '', textContent: '', innerHTML: '', className: '',
    disabled: false,
    classList: { add() {}, remove() {}, contains() { return false; } },
    appendChild() {}, removeChild() {}, addEventListener() {}, click() {},
    setAttribute() {}, getAttribute() { return null; },
    querySelector() { return el(); }
  };
  return e;
}
const document = {
  getElementById: () => el(),
  createElement: () => el(),
  querySelectorAll: () => [],
  body: el()
};
const sandbox = {
  document, window: {}, console,
  Math, JSON, RegExp, Array, Object, String, Number, Promise, Image: function () {},
  FileReader: function () {}, Blob: function () {}, URL: {}, atob: () => '',
  setTimeout: () => {}, parseInt, parseFloat, isNaN
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(`(function(){\n${body}\n})();`, sandbox);
const M = sandbox.__mcq;

// ── tiny assert ─────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  - ' + name); }
  else { fail++; console.log('  FAIL- ' + name + (extra ? '  :: ' + extra : '')); }
}
const rt = runs => runs.map(r => r.text).join('');

// ── TEST 1: plain-text splitting and parity with an equivalent docx ──────────
console.log('\nTEST 1: .txt/.md splitting + parity with equivalent docx');
const txt = [
  '[Question.] What is 2+2? [Answer.] 4 [Distractor.] 3 [Distractor.] 5',
  '',
  '[Question.] Capital of France that wraps',          // a soft-wrapped question
  'across two physical lines [Answer.] Paris [Distractor.] Rome',
  '',
  '# A markdown heading that should be dropped',
  '',
  '[Paragraph.] Shared scenario text.',
  '',
  '[Each version take 2 of the following options.]',
  '',
  '- [Option.] [Question.] Discuss photosynthesis.',  // leading "- " markdown bullet
  '',
  '[Option.] [Question.] Explain mitosis.',
  '',
  '[Option.] [Question.] Describe osmosis.'
].join('\n');

const txtParas = M.textToRichParagraphs(txt);
// blocks: Q1, Q2(wrapped), heading, paragraph, pool-header, opt1, opt2, opt3 = 8
ok('blank lines split into 8 blocks', txtParas.length === 8, 'got ' + txtParas.length);
ok('soft wrap collapsed to spaces', rt(txtParas[1]).indexOf('\n') === -1 &&
   rt(txtParas[1]).includes('wraps across two physical lines'));
ok('leading "- " bullet stripped so [Option.] is at start',
   rt(txtParas[5]).startsWith('[Option.]'), JSON.stringify(rt(txtParas[5])));
ok('leading "# " heading marker stripped',
   rt(txtParas[2]).startsWith('A markdown heading'));

const txtItems = M.parseAllParagraphs(M.stripVersionXParagraph(txtParas));
const txtQs = M.collectAllQuestions(txtItems);

// Equivalent docx: identical paragraphs, but each is a single Word paragraph
// (no internal newline) and the heading is dropped by the author, mammoth-style.
const docxParas = [
  '[Question.] What is 2+2? [Answer.] 4 [Distractor.] 3 [Distractor.] 5',
  '[Question.] Capital of France that wraps across two physical lines [Answer.] Paris [Distractor.] Rome',
  'A markdown heading that should be dropped',
  '[Paragraph.] Shared scenario text.',
  '[Each version take 2 of the following options.]',
  '[Option.] [Question.] Discuss photosynthesis.',
  '[Option.] [Question.] Explain mitosis.',
  '[Option.] [Question.] Describe osmosis.'
].map(t => [{ text: t, underline: false }]);
const docxItems = M.parseAllParagraphs(M.stripVersionXParagraph(docxParas));
const docxQs = M.collectAllQuestions(docxItems);

ok('txt question count == docx question count (5)',
   txtQs.length === 5 && docxQs.length === 5, 'txt=' + txtQs.length + ' docx=' + docxQs.length);
ok('txt item types match docx item types',
   JSON.stringify(txtItems.map(i => i.type)) === JSON.stringify(docxItems.map(i => i.type)),
   JSON.stringify(txtItems.map(i => i.type)));
const pool = txtItems.find(i => i.type === 'option-pool');
ok('pool header parsed take=2 with 3 options', pool && pool.take === 2 && pool.questions.length === 3);

// ── TEST 2: max-MCQ cap (50 -> 30), shared subset, order preserved ───────────
console.log('\nTEST 2: max MCQs cap (50 standalone MCQs -> 30)');
function mcq(i) {
  return { type: 'question', idx: i,
    question: [{ text: 'Q' + i, underline: false }],
    answer:   [{ text: 'ans', underline: false }],
    distractors: [[{ text: 'd1', underline: false }], [{ text: 'd2', underline: false }]] };
}
const fifty = Array.from({ length: 50 }, (_, i) => mcq(i + 1));
const keep30 = M.pickStandaloneSubset(fifty, 30, 0);
ok('keepSet keeps exactly 30', keep30.size === 30, 'got ' + keep30.size);
const survivors = fifty.filter(q => keep30.has(q));
ok('all survivors are MCQs', survivors.every(M.isMcqQ));
const order = survivors.map(q => q.idx);
const ascending = order.every((v, i) => i === 0 || v > order[i - 1]);
ok('survivors stay in original document order', ascending, JSON.stringify(order));

// shared across versions: build 3 versions with the same keepSet
M.setParsed(fifty);
const vA = M.buildVersionParas('A', new Map(), keep30);
const vB = M.buildVersionParas('B', new Map(), keep30);
const stemsA = vA.filter(p => p.type === 'question').map(p => rt(p.content).replace(/^\d+\.\s*/, ''));
const stemsB = vB.filter(p => p.type === 'question').map(p => rt(p.content).replace(/^\d+\.\s*/, ''));
ok('each version emits 30 questions', stemsA.length === 30 && stemsB.length === 30,
   'A=' + stemsA.length + ' B=' + stemsB.length);
ok('every version tests the SAME 30 items (fair)',
   JSON.stringify(stemsA) === JSON.stringify(stemsB));
ok('emitted questions renumber 1..30 with no gaps',
   rt(vA.filter(p => p.type === 'question')[0].content).startsWith('1.') &&
   rt(vA.filter(p => p.type === 'question')[29].content).startsWith('30.'));

// ── TEST 3: max-written caps standalone written AND take-N pool ──────────────
console.log('\nTEST 3: max written answers cap');
function written(i) {
  return { type: 'question', idx: i, question: [{ text: 'W' + i, underline: false }],
    answer: null, distractors: [] };
}
ok('isWrittenQ true for no-distractor question', M.isWrittenQ(written(1)));
ok('isMcqQ false for no-distractor question', !M.isMcqQ(written(1)));

const writtenPool = { type: 'option-pool', take: 5,
  questions: Array.from({ length: 8 }, (_, i) => written(100 + i)) };
const asg = M.assignOptionPools([writtenPool], ['A', 'B', 'C'], 3); // cap N to 3
const mapW = asg.get(writtenPool);
ok('max-written lowers take-5 pool to 3 per version',
   mapW.A.length === 3 && mapW.B.length === 3 && mapW.C.length === 3,
   'A=' + mapW.A.length + ' B=' + mapW.B.length + ' C=' + mapW.C.length);
ok('a single version has no duplicate pool items',
   new Set(mapW.A).size === mapW.A.length);

const tenWritten = Array.from({ length: 10 }, (_, i) => written(i + 1));
const keepW = M.pickStandaloneSubset(tenWritten, 0, 4);
ok('standalone written capped to 4', keepW.size === 4, 'got ' + keepW.size);

// ── TEST 4: blank/0 = exact current behavior ─────────────────────────────────
console.log('\nTEST 4: blank/0 leaves everything unchanged');
ok('pickStandaloneSubset(_,0,0) returns null', M.pickStandaloneSubset(fifty, 0, 0) === null);
const asg0 = M.assignOptionPools([writtenPool], ['A', 'B'], 0); // maxWritten=0
ok('maxWritten=0 keeps the document take (5)', asg0.get(writtenPool).A.length === 5,
   'got ' + asg0.get(writtenPool).A.length);
// With keepSet=null buildVersionParas emits all 50
M.setParsed(fifty);
const vAll = M.buildVersionParas('A', new Map(), null);
ok('keepSet=null emits all 50 standalone questions',
   vAll.filter(p => p.type === 'question').length === 50,
   'got ' + vAll.filter(p => p.type === 'question').length);

// ── TEST 5: cap larger than supply is a no-op ────────────────────────────────
console.log('\nTEST 5: cap above available supply does nothing');
const keepBig = M.pickStandaloneSubset(fifty, 999, 0);
ok('cap 999 over 50 keeps all 50', keepBig.size === 50, 'got ' + keepBig.size);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
