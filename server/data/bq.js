import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const pexec = promisify(execFile);
const BQ = process.platform === 'win32' ? 'bq.cmd' : 'bq';

export async function runQuery(sql, params = []) {
  const args = [
    'query', '--quiet', '--format=json',
    '--use_legacy_sql=false', '--max_rows=1000000',
  ];
  for (const p of params) args.push(`--parameter=${p.name}:${p.type}:${p.value}`);
  args.push(sql);
  const { stdout } = await pexec(BQ, args, { maxBuffer: 128 * 1024 * 1024 });
  const txt = stdout.trim();
  return txt ? JSON.parse(txt) : [];
}
