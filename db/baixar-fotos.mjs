// Baixa todas as fotos dos pets do CloudFront para public/pets/ e
// reescreve src/data/pets.json com os caminhos locais.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url)); // /db
const projectRoot = path.resolve(root, '..');
const outDir = path.join(projectRoot, 'public', 'pets');
const dataDir = path.join(projectRoot, 'src', 'data');

await mkdir(outDir, { recursive: true });
await mkdir(dataDir, { recursive: true });

const raw = JSON.parse(await readFile(path.join(root, 'pets-raw.json'), 'utf8'));

// Detecta extensao pelos magic bytes
function sniffExt(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf[0] === 0x47 && buf[1] === 0x49) return 'gif';
  if (buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'webp';
  return 'jpg';
}

async function download(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    if (attempt < 3) return download(url, attempt + 1);
    throw e;
  }
}

let ok = 0, fail = 0;
for (const pet of raw.pets) {
  try {
    const buf = await download(pet.foto);
    const ext = sniffExt(buf);
    const fname = `${pet.id}.${ext}`;
    await writeFile(path.join(outDir, fname), buf);
    pet.fotoRemota = pet.foto; // guarda a original como fallback/referencia
    pet.foto = `/pets/${fname}`;
    ok++;
    process.stdout.write(`\r  baixadas ${ok}/${raw.pets.length}  (${pet.nome})            `);
  } catch (e) {
    fail++;
    console.error(`\n  FALHOU ${pet.nome} (${pet.id}): ${e.message}`);
  }
}

await writeFile(path.join(dataDir, 'pets.json'), JSON.stringify(raw, null, 2), 'utf8');
console.log(`\n\nConcluido. OK=${ok} FALHAS=${fail}. pets.json escrito em src/data/`);
