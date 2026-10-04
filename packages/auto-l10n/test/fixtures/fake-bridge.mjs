// Stands in for python/argos_bridge.py: same JSON-lines protocol, no models.
import readline from 'node:readline';

const rl = readline.createInterface({ input: process.stdin });
for await (const line of rl) {
  const { id, text, from, to } = JSON.parse(line);
  if (text.includes('BOOM')) process.stdout.write(`${JSON.stringify({ id, error: 'RuntimeError: Argos has no model' })}\n`);
  else process.stdout.write(`${JSON.stringify({ id, text: `${from}>${to}:${text}` })}\n`);
}
