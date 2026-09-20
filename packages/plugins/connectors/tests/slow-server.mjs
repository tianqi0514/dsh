import readline from 'node:readline';

const write = message => process.stdout.write(`${JSON.stringify(message)}\n`);
const result = (id, value) => write({ jsonrpc: '2.0', id, result: value });
const failure = (id, code, message) => write({ jsonrpc: '2.0', id, error: { code, message } });
const text = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value });

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on('line', line => {
  if (!line.trim()) return;
  let request;
  try { request = JSON.parse(line); } catch { return; }
  if (request.id === undefined) return;
  switch (request.method) {
    case 'initialize':
      result(request.id, {
        protocolVersion: request.params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: 'workdsh-timeout-probe', version: '1.0.0' },
      });
      break;
    case 'ping': result(request.id, {}); break;
    case 'tools/list':
      result(request.id, { tools: [{
        name: 'wait',
        description: 'Wait for the requested bounded duration so cancellation and timeout behavior can be verified.',
        inputSchema: {
          type: 'object',
          properties: { delayMs: { type: 'integer', minimum: 0, maximum: 5_000 } },
          required: ['delayMs'],
          additionalProperties: false,
        },
      }] });
      break;
    case 'tools/call': {
      if (request.params?.name !== 'wait') {
        failure(request.id, -32602, `Unknown tool: ${String(request.params?.name)}`);
        break;
      }
      const delayMs = Number(request.params?.arguments?.delayMs);
      if (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > 5_000) {
        failure(request.id, -32602, 'delayMs must be an integer from 0 to 5000.');
        break;
      }
      setTimeout(() => result(request.id, text({ waitedMs: delayMs })), delayMs);
      break;
    }
    case 'resources/list': result(request.id, { resources: [] }); break;
    case 'resources/templates/list': result(request.id, { resourceTemplates: [] }); break;
    default: failure(request.id, -32601, `Method not found: ${request.method}`);
  }
});
