import { spawn } from 'node:child_process';
import { config } from '../../config.js';

const BQ = process.platform === 'win32' ? 'bq.cmd' : 'bq';

// O bq CLI é escrito em Python e serializa caractere fora do plano básico com
// escape de Python (\U0001f98b, U maiúsculo e 8 dígitos). JSON só admite \u
// minúsculo de 4 dígitos, então a saída dele não é JSON válido quando algum
// campo tem emoji — e tem: existe uma lead chamada "Camila 🦋✨".
// O lookbehind evita mexer num \\U onde a barra já está escapada.
function consertarEscapesDoPython(texto) {
  return texto.replace(/(?<!\\)\\U([0-9a-fA-F]{8})/g, (inteiro, hex) => {
    const ponto = Number.parseInt(hex, 16);
    if (!Number.isFinite(ponto) || ponto > 0x10ffff) return inteiro;
    return JSON.stringify(String.fromCodePoint(ponto)).slice(1, -1);
  });
}

export function runQuery(sql, params = []) {
  // O --project_id define onde o job é faturado. As tabelas são referenciadas
  // pelo nome completo, então a consulta cruza os dois projetos numa query só.
  const args = [
    `--project_id=${config.projectId}`,
    'query', '--quiet', '--format=json', '--use_legacy_sql=false', '--max_rows=1000000',
  ];
  for (const p of params) args.push(`--parameter=${p.name}:${p.type}:${p.value}`);
  return new Promise((resolve, reject) => {
    // Sem PYTHONIOENCODING o bq escreve na codepage do console (cp1252 aqui), e
    // "Ribeirão" volta com um byte só no lugar do "ã" — que decodificado como
    // UTF-8 vira caractere de substituição. Não dá para consertar depois: a
    // informação já se perdeu. Forçar UTF-8 na saída resolve na origem.
    const proc = spawn(BQ, args, {
      shell: process.platform === 'win32',
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    });
    // Acumula em Buffer e decodifica uma vez só. Concatenar como string decodifica
    // cada pedaço isolado, e aí um caractere acentuado ou uma barra escapada que
    // caia na emenda de dois pedaços corrompe o JSON.
    const pedacos = [];
    let stderr = '';
    proc.stdout.on('data', (d) => pedacos.push(d));
    proc.stderr.on('data', (d) => (stderr += d));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`bq falhou (código ${code}): ${stderr.trim()}`));
      const txt = consertarEscapesDoPython(Buffer.concat(pedacos).toString('utf8').trim());
      try { resolve(txt ? JSON.parse(txt) : []); }
      catch (e) { reject(new Error(`JSON inválido do bq: ${e.message}`)); }
    });
    proc.stdin.write(sql);
    proc.stdin.end();
  });
}
