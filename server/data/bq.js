import { spawn } from 'node:child_process';

const BQ = process.platform === 'win32' ? 'bq.cmd' : 'bq';

export function runQuery(sql, params = []) {
  const args = ['query', '--quiet', '--format=json', '--use_legacy_sql=false', '--max_rows=1000000'];
  for (const p of params) args.push(`--parameter=${p.name}:${p.type}:${p.value}`);
  return new Promise((resolve, reject) => {
    const proc = spawn(BQ, args, { shell: process.platform === 'win32', windowsHide: true });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (d) => (stdout += d));
    proc.stderr.on('data', (d) => (stderr += d));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`bq falhou (código ${code}): ${stderr.trim()}`));
      const txt = stdout.trim();
      try { resolve(txt ? JSON.parse(txt) : []); }
      catch (e) { reject(new Error(`JSON inválido do bq: ${e.message}`)); }
    });
    proc.stdin.write(sql);
    proc.stdin.end();
  });
}
