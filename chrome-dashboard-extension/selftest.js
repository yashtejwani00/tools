// Checks the pure parsing helpers in script.js. Run: node selftest.js
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const context = { document: { addEventListener() {} }, chrome: {}, console };
vm.runInNewContext(fs.readFileSync(`${__dirname}/script.js`, 'utf8'), context);
const { parseTicketKey, toUrl, parseJiraViews, timeAgo } = context;

assert.strictEqual(parseTicketKey('123'), 'ZMOB-123');
assert.strictEqual(parseTicketKey('abc-45'), 'ABC-45');
assert.strictEqual(parseTicketKey('login bug'), null);
assert.strictEqual(parseTicketKey('-45'), null);

assert.strictEqual(toUrl('github.com/foo'), 'https://github.com/foo');
assert.strictEqual(toUrl('localhost:3000/x'), 'http://localhost:3000/x');
assert.strictEqual(toUrl('https://a.b/c?d=1'), 'https://a.b/c?d=1');
assert.strictEqual(toUrl('1.5'), null);
assert.strictEqual(toUrl('fix login bug'), null);

// JSON round-trip: arrays from the vm context have a different prototype
const views = text => JSON.parse(JSON.stringify(parseJiraViews(text)));
assert.deepStrictEqual(views('assignee = x ORDER BY updated'), [{ name: 'Mine', jql: 'assignee = x ORDER BY updated' }]);
assert.deepStrictEqual(views('Mine | a = 1\n\n  Team | b = 2 OR c = 3  \nd = 4'), [
    { name: 'Mine', jql: 'a = 1' },
    { name: 'Team', jql: 'b = 2 OR c = 3' },
    { name: 'View 3', jql: 'd = 4' }
]);
assert.deepStrictEqual(views('Empty |'), []);
// A "|" inside legacy, unnamed JQL is not a name separator
assert.deepStrictEqual(views('text ~ "crash|anr" ORDER BY updated DESC'), [{ name: 'Mine', jql: 'text ~ "crash|anr" ORDER BY updated DESC' }]);
assert.deepStrictEqual(views('Crashes | text ~ "crash|anr"'), [{ name: 'Crashes', jql: 'text ~ "crash|anr"' }]);

const now = Date.now() / 1000;
assert.strictEqual(timeAgo(now - 10), 'just now');
assert.strictEqual(timeAgo(now - 5 * 60), '5m ago');
assert.strictEqual(timeAgo(now - 3 * 3600), '3h ago');
assert.strictEqual(timeAgo(now - 2 * 86400), '2d ago');

console.log('selftest: ok');
