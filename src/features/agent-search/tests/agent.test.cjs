const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Compile the repository's actual TS modules in memory; no generated files or extra dependency.
const srcRoot = path.resolve(__dirname, '../../..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (specifier, ...args) {
  return resolve.call(this, specifier.startsWith('@/') ? path.join(srcRoot, specifier.slice(2)) : specifier, ...args);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } },
).outputText, filename);

const { TOOLS } = require('../../../core/registry.ts');
const { runAgent } = require('../logic/run-agent.ts');
const { createAgentHandler } = require('../api/create-handler.ts');
const { createDeepSeekComplete } = require('../api/deepseek.ts');
const { z } = require('zod');
const { searchLunarData } = require('../ui/search-client.ts');
const signal = () => new AbortController().signal;
const answer = { content: 'Answer based on the tool output.', toolCalls: [] };
const call = (name, args, id = 'call-1') => ({ content: '', toolCalls: [{ id, name, arguments: args }] });
const request = body => new Request('http://localhost/api/agent', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test('search client sends only the message and preserves actual source data', async t => {
  const result = { answer: 'Tool-based answer', sources: [{tool:'list_presets',input:{},result:{presets:[]}}] };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/agent');
    assert.deepEqual(JSON.parse(options.body), {message:'List presets'});
    assert.equal(options.method, 'POST');
    assert.ok(options.signal);
    return Response.json(result);
  });
  assert.deepEqual((await searchLunarData('List presets', signal())).sources, result.sources);
});

test('search client gives safe errors for HTML, empty answers, malformed sources and rate limits', async t => {
  const cases = [
    [new Response('<html>Internal detail</html>'), /unreadable answer/],
    [Response.json({answer:' ',sources:[]}), /unreadable answer/],
    [Response.json({answer:'Hello',sources:[null]}), /unreadable answer/],
    [new Response('PRIVATE', {status:429}), /Too many requests/],
    [new Response('PRIVATE', {status:503}), /not available/],
  ];
  for (const [response, message] of cases) {
    const mock = t.mock.method(globalThis, 'fetch', async () => response);
    await assert.rejects(searchLunarData('Hello', signal()), message);
    mock.mock.restore();
  }
});

test('terrain and period guidance is passed to the model with real data tools', async () => {
  await runAgent({message:'Compare sunlight'}, {tools:TOOLS, signal:signal(), complete:async ({messages}) => {
    const prompt = messages[0].content;
    assert.match(prompt, /periodStartUtc and periodEndUtc separately from the query timeUtc/);
    assert.match(prompt, /non-null group object can still contain null fields/);
    assert.match(prompt, /never claim a safe landing/);
    return answer;
  }});
});

test('real point tool returns unchanged data with real terrain data and its provenance', async () => {
  let count = 0;
  const args = { latDeg: -89.71, lonDeg: 62.5, time: '2030-01-01T12:00:00Z' };
  const result = await runAgent({ message: 'Check this point' }, { tools: TOOLS, signal: signal(),
    complete: async ({ messages }) => {
      count++;
      if (count === 1) return call('get_point_conditions', args);
      const data = JSON.parse(messages.at(-1).content);
      // Terrain is wired in (pipeline v1, 0.25 degree map cells): real numbers and provenance 'ok'
      // (docs/SHARED_INTERFACES.md section 2). If the data files cannot be read, the group degrades to
      // all-null fields with provenance 'unavailable' instead of failing the request.
      assert.equal(typeof data.terrain.heightM, 'number');
      assert.equal(data.terrain.horizonProfile.length, 32);
      assert.equal(data.provenance.terrain.status, 'ok');
      return answer;
    },
  });
  assert.equal(count, 2);
  assert.deepEqual(result.sources[0].result, TOOLS.find(t => t.name === 'get_point_conditions').run(args));
});

test('real presets and comparison can run in one question', async () => {
  let round = 0;
  const result = await runAgent({ message: 'Compare the presets' }, { tools: TOOLS, signal: signal(),
    complete: async () => {
      if (round++ === 0) return call('list_presets', {});
      if (round === 2) return call('compare_points', { points: [{ latDeg: -90, lonDeg: 0 }, { latDeg: 0, lonDeg: 0 }], time: '2030-01-01T00:00:00Z' }, 'call-2');
      return answer;
    },
  });
  assert.equal(result.sources.length, 2);
  assert.equal(result.sources[1].result.results.length, 2);
});

test('invalid coordinates/date/point count never execute a tool', async () => {
  const cases = [
    ['get_point_conditions', { latDeg: 91, lonDeg: 0 }],
    ['get_point_conditions', { latDeg: 0, lonDeg: 0, time: '2030-01-01' }],
    ['compare_points', { points: Array.from({ length: 11 }, () => ({ latDeg: 0, lonDeg: 0 })) }],
  ];
  for (const [name, args] of cases) {
    let executions = 0, round = 0;
    const tools = TOOLS.map(tool => ({ ...tool, run: () => { executions++; } }));
    const result = await runAgent({ message: 'Check' }, { tools, signal: signal(), complete: async () => round++ ? answer : call(name, args) });
    assert.equal(executions, 0);
    assert.deepEqual(result.sources, []);
  }
});

test('unknown tools, write tools and duplicate ids are rejected', async () => {
  for (const name of ['run_shell', 'get_point_conditions']) {
    const tools = TOOLS.map(tool => name === 'get_point_conditions' ? { ...tool, access: 'write' } : tool);
    await assert.rejects(runAgent({ message: 'Check' }, { tools, signal: signal(), complete: async () => call(name, {}) }), { code: 'invalid_tool' });
  }
  await assert.rejects(runAgent({ message: 'Check' }, { tools: TOOLS, signal: signal(), complete: async () => call('list_presets', {}) }), { code: 'invalid_tool' });
});

test('model loop and total tool calls are bounded', async () => {
  let count = 0, runs = 0;
  const tools = [{ name: 'list_presets', description: '', access: 'read', inputSchema: z.object({}), run: () => { runs++; return {}; } }];
  await assert.rejects(runAgent({ message: 'Loop' }, { tools, signal: signal(), complete: async () => call('list_presets', {}, `c${++count}`) }), { code: 'step_limit' });
  assert.equal(count, 4);
  assert.equal(runs, 3);
  count = 0; runs = 0;
  await assert.rejects(runAgent({ message: 'Many tools' }, { tools, signal: signal(), complete: async () => ({ content: '', toolCalls: Array.from({length: 5}, (_, i) => ({ id: `${count}-${i}`, name: 'list_presets', arguments: {} })).map(c => { count++; return c; }) }) }), { code: 'step_limit' });
  assert.equal(runs, 5);
});

test('HTTP rejects invalid/oversized requests before constructing model provider', async () => {
  let calls = 0;
  const handler = createAgentHandler({ tools: TOOLS, getComplete: () => { calls++; return async () => answer; } });
  for (const body of [{ message: '' }, { message: 'x'.repeat(2001) }, { message: 'hello', mode: 'test' }, { message: 'x'.repeat(9000) }]) {
    const response = await handler(request(body));
    assert.ok([400, 413].includes(response.status));
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(calls, 0);
  assert.equal((await handler(new Request('http://localhost/api/agent'))).status, 405);
});

test('missing key fails without a network call', async () => {
  let calls = 0;
  const handler = createAgentHandler({ tools: TOOLS, getComplete: () => createDeepSeekComplete('', async () => { calls++; }) });
  assert.equal((await handler(request({ message: 'Hello' }))).status, 503);
  assert.equal(calls, 0);
});

test('DeepSeek request uses Flash, tool schemas, disabled thinking and bounded tokens', async () => {
  const provider = createDeepSeekComplete('test-placeholder', async (url, options) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(options.redirect, 'error');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'deepseek-flash');
    assert.deepEqual(body.thinking, { type: 'disabled' });
    assert.equal(body.max_tokens, 2400);
    assert.equal(body.tools.length, 6);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'Hello' } }] });
  });
  const handler = createAgentHandler({ tools: TOOLS, getComplete: () => provider });
  const response = await handler(request({ message: 'Hello' }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).answer, 'Hello');
});

test('official 429 returns 429 without retry or leaking upstream response', async () => {
  let calls = 0;
  const handler = createAgentHandler({ tools: TOOLS, getComplete: () => createDeepSeekComplete('test-placeholder', async () => {
    calls++; return new Response('PRIVATE UPSTREAM DETAILS', { status: 429 });
  }) });
  const response = await handler(request({ message: 'Hello' }));
  assert.equal(response.status, 429);
  assert.equal(calls, 1);
  assert.ok(!(await response.text()).includes('PRIVATE'));
});

test('malformed/truncated model responses fail safely', async () => {
  for (const payload of [ {}, { choices: [{ finish_reason: 'length', message: { content: 'partial' } }] },
    { choices: [{ finish_reason: 'tool_calls', message: { tool_calls: [{ id: 'x', type: 'function', function: { name: 'list_presets', arguments: '{bad' } }] } }] } ]) {
    const handler = createAgentHandler({ tools: TOOLS, getComplete: () => createDeepSeekComplete('test-placeholder', async () => Response.json(payload)) });
    assert.equal((await handler(request({ message: 'Hello' }))).status, 502);
  }
});

test('timeouts abort provider and return even when provider ignores abort', async () => {
  let providerSignal;
  const handler = createAgentHandler({ tools: TOOLS, timeoutMs: 10, getComplete: () => async ({ signal }) => {
    providerSignal = signal; return new Promise(() => {});
  } });
  assert.equal((await handler(request({ message: 'Hello' }))).status, 504);
  assert.equal(providerSignal.aborted, true);
});

test('unexpected upstream exceptions do not disclose details', async () => {
  const handler = createAgentHandler({ tools: TOOLS, getComplete: () => async () => { throw new Error('PRIVATE UPSTREAM DETAILS'); } });
  const response = await handler(request({ message: 'Hello' }));
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('PRIVATE'));
});

test('HTTP to provider to real tool to final answer preserves call ids and sources', async () => {
  let count = 0;
  const provider = createDeepSeekComplete('test-placeholder', async (_, options) => {
    const body = JSON.parse(options.body);
    if (++count === 1) return Response.json({ choices: [{ finish_reason: 'tool_calls', message: {
      content: null, tool_calls: [{ id: 'preset-call', type: 'function', function: { name: 'list_presets', arguments: '{}' } }],
    } }] });
    assert.equal(body.messages.at(-2).tool_calls[0].id, 'preset-call');
    assert.equal(body.messages.at(-1).tool_call_id, 'preset-call');
    assert.ok(JSON.parse(body.messages.at(-1).content).presets.length > 0);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'These are the available presets.' } }] });
  });
  const response = await createAgentHandler({ tools: TOOLS, getComplete: () => provider })(request({ message: 'List presets' }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.sources[0].tool, 'list_presets');
  assert.equal(count, 2);
});

test('stalled request body is cancelled on timeout before any provider call', async () => {
  let cancelled = false, calls = 0;
  const body = new ReadableStream({ cancel() { cancelled = true; } });
  const handler = createAgentHandler({ tools: TOOLS, timeoutMs: 10, getComplete: () => { calls++; return async () => answer; } });
  const response = await handler(new Request('http://localhost/api/agent', {
    method: 'POST', body, duplex: 'half', headers: { 'Content-Type': 'application/json' },
  }));
  assert.equal(response.status, 504);
  assert.equal(cancelled, true);
  assert.equal(calls, 0);
});

test('the model is offered exactly the six read-only data tools', async () => {
  let offered = [];
  await runAgent({ message: 'Which tools?' }, { tools: TOOLS, signal: signal(), complete: async ({ tools }) => {
    offered = tools.map(tool => tool.name).sort();
    return answer;
  } });
  assert.deepEqual(offered, ['compare_dates', 'compare_points', 'find_sites', 'get_point_conditions', 'get_point_timeline', 'list_presets']);
});

test('tool-choice and coarse-screening guidance is passed to the model', async () => {
  await runAgent({ message: 'Find sites' }, { tools: TOOLS, signal: signal(), complete: async ({ messages, tools }) => {
    const prompt = messages[0].content;
    assert.match(prompt, /find_sites returns 0\.25-degree map cells for coarse screening, not landing sites/);
    assert.match(prompt, /at most 6 points per call/);
    assert.doesNotMatch(prompt, /find an optimal site without suitable data/);
    assert.match(tools.find(tool => tool.name === 'compare_points').description, /at most 6 points per call/);
    const agentSchema = tools.find(tool => tool.name === 'compare_points').inputSchema;
    const sharedSchema = TOOLS.find(tool => tool.name === 'compare_points').inputSchema;
    assert.equal(z.toJSONSchema(agentSchema).properties.points.maxItems, 6);
    assert.equal(z.toJSONSchema(sharedSchema).properties.points.maxItems, 10);
    const points = Array.from({ length: 10 }, () => ({ latDeg: -85, lonDeg: 0 }));
    assert.equal(sharedSchema.safeParse({ points }).success, true);
    assert.equal(agentSchema.safeParse({ points }).success, false);
    return answer;
  } });
});

test('find_sites, timeline and compare_dates run through the agent on real data and become sources', async () => {
  let round = 0, site;
  const result = await runAgent({ message: 'Find a flat place near the south pole and show its next month' }, { tools: TOOLS, signal: signal(),
    complete: async ({ messages }) => {
      if (round++ === 0) return call('find_sites', { maxSlopeDeg: 10, latMaxDeg: -80, limit: 3 });
      if (round === 2) {
        site = JSON.parse(messages.at(-1).content).sites[0];
        return { content: '', toolCalls: [
          { id: 'call-2', name: 'get_point_timeline', arguments: { latDeg: site.latDeg, lonDeg: site.lonDeg, time: '2030-03-05T00:00:00Z', durationH: 720 } },
          { id: 'call-3', name: 'compare_dates', arguments: { points: [{ latDeg: site.latDeg, lonDeg: site.lonDeg }], times: ['2030-01-05T00:00:00Z', '2030-07-05T00:00:00Z'] } },
        ] };
      }
      return answer;
    },
  });
  assert.deepEqual(result.sources.map(source => source.tool), ['find_sites', 'get_point_timeline', 'compare_dates']);
  assert.equal(result.sources[0].result.sites.length, 3);
  assert.equal(result.sources[0].input.latMaxDeg, -80);
  assert.ok(result.sources[0].result.sites.every(site => site.latDeg <= -80));
  assert.deepEqual(result.sources[1].result.position, { latDeg: site.latDeg, lonDeg: site.lonDeg });
  assert.equal(result.sources[2].result.timesUtc.length, 2);
  assert.equal(result.sources[0].result.provenance.status, 'ok');
});

test('compare_points above the assistant limit is refused without running; the limit itself fits the size cap on the largest real point', async () => {
  const points = count => Array.from({ length: count }, () => ({ latDeg: -89.9, lonDeg: 50 })); // largest single-point result found by scanning the whole Moon grid (9.9 KB)
  let executions = 0, refusal;
  const counting = TOOLS.map(tool => ({ ...tool, run: input => { executions++; return tool.run(input); } }));
  let round = 0;
  const refused = await runAgent({ message: 'Compare seven' }, { tools: counting, signal: signal(), complete: async ({ messages }) => {
    if (round++ === 0) return call('compare_points', { points: points(7), time: '2030-03-05T00:00:00Z' });
    refusal = JSON.parse(messages.at(-1).content);
    return answer;
  } });
  assert.equal(executions, 0);
  assert.equal(refusal.error, 'invalid_arguments');
  assert.deepEqual(refused.sources, []);

  round = 0;
  const allowed = await runAgent({ message: 'Compare six' }, { tools: counting, signal: signal(), complete: async () =>
    round++ === 0 ? call('compare_points', { points: points(6), time: '2030-03-05T00:00:00Z', minEarthElevationDeg: 5 }) : answer } );
  assert.equal(executions, 1);
  assert.equal(allowed.sources[0].result.results.length, 6);
  assert.ok(Buffer.byteLength(JSON.stringify(allowed.sources[0].result)) < 65536);
});

test('an oversized tool result is reported to the model instead of failing the whole answer', async () => {
  const huge = { name: 'compare_points', description: '', access: 'read', inputSchema: z.object({}), run: () => ({ filler: 'x'.repeat(70000) }) };
  let round = 0, toolMessage;
  const result = await runAgent({ message: 'Compare' }, { tools: [huge], signal: signal(), complete: async ({ messages }) => {
    if (round++ === 0) return call('compare_points', {});
    toolMessage = JSON.parse(messages.at(-1).content);
    return answer;
  } });
  assert.equal(toolMessage.error, 'result_too_large');
  assert.deepEqual(result.sources, []);
  assert.equal(result.answer, answer.content);
});

