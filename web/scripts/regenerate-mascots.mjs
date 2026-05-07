/**
 * 重绘 7 个 mascot — DashScope wanx2.1-t2i-turbo,统一品牌 spec
 *
 * 用法:
 *   cd web
 *   vercel env pull .env.local --scope=jiamizhongshifus-projects --yes
 *   node scripts/regenerate-mascots.mjs
 *   rm .env.local
 *
 * 出图后会自动 sips resize 256x256 + pngquant 压缩。
 * 写入 web/public/mascot-<kind>.png 覆盖。
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const env = {};
readFileSync('.env.local', 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^([A-Z_]+)="?(.*?)"?$/);
  if (m) env[m[1]] = m[2];
});
const KEY = env.DASHSCOPE_API_KEY;
if (!KEY) {
  console.error('DASHSCOPE_API_KEY missing in .env.local');
  process.exit(1);
}

const SUBMIT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis';
const TASK = 'https://dashscope.aliyuncs.com/api/v1/tasks/';
const MODEL = 'wanx2.1-t2i-turbo';

const STYLE_BASE = `Soft crayon watercolor children's book illustration style, warm earth-tone palette (beige, peach, soft sage green leaf), consistent stroke weight 1.5-1.8 pixels.
Subject: a chubby friendly water capybara (mascot) with soft brown beige fur, simple bean-shaped eyes, plump rounded body, with a small fresh orange (with tiny green leaf) balanced on top of its head.
The capybara is centered, occupies about 70% of the frame, facing slightly forward (3/4 view).
Pure white background. No scenery, no rainbow, no confetti, no text, no logos.`;

const MASCOTS = [
  {
    file: 'mascot-happy.png',
    expression: 'gentle content smile, eyes are soft crescents, ears slightly raised, paws relaxed at sides, peaceful warmth.'
  },
  {
    file: 'mascot-cheer.png',
    expression: 'both small paws raised in celebration above its body (still under the orange on head), eyes sparkling closed-curve smile, mouth slightly open in joy. Energetic but clean — no confetti or stars.'
  },
  {
    file: 'mascot-content.png',
    expression: 'peaceful satisfied look, both paws softly crossed in front of the chest, eyes are gentle downward curves, very slight smile, calm vibe.'
  },
  {
    file: 'mascot-pensive.png',
    expression: 'one small paw under chin in a thinking pose, head tilted slightly to one side, eyes looking up-left with a soft curious expression, neutral closed mouth.'
  },
  {
    file: 'mascot-caring.png',
    expression: 'both paws softly pressed to its own chest (heart area), gentle empathetic smile (NOT sad, NOT anxious), eyes warm and slightly soft, conveying care and reassurance.'
  },
  {
    file: 'mascot-worried.png',
    expression: 'eyebrows slightly furrowed (mild concern, not panicked), mouth a small soft "o", paws clutched together in front, eyes a bit wider but still friendly. Vulnerable, not scared.'
  },
  {
    file: 'mascot-thinking.png',
    expression: 'one small paw raised pointing up like having an idea, eyes looking up to one side, a slight open-mouth realization expression, one ear slightly flicked. Curious and bright.'
  }
];

async function submitTask(prompt) {
  const res = await fetch(SUBMIT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable'
    },
    body: JSON.stringify({
      model: MODEL,
      input: { prompt },
      parameters: { size: '1024*1024', n: 1 }
    })
  });
  const j = await res.json();
  if (!res.ok || !j.output?.task_id) {
    throw new Error(`submit failed: ${JSON.stringify(j).slice(0, 200)}`);
  }
  return j.output.task_id;
}

async function pollTask(taskId, budgetMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < budgetMs) {
    const res = await fetch(TASK + taskId, {
      headers: { Authorization: `Bearer ${KEY}` }
    });
    const j = await res.json();
    const status = j.output?.task_status;
    if (status === 'SUCCEEDED') {
      const url = j.output?.results?.[0]?.url;
      if (!url) throw new Error('no url in success');
      return url;
    }
    if (status === 'FAILED') {
      throw new Error(`task failed: ${j.output?.message ?? 'unknown'}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('poll timeout');
}

async function downloadAndPostprocess(url, outPath) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
  // Resize 1024 → 256 + pngquant 70-85
  execSync(`sips -z 256 256 "${outPath}" >/dev/null`);
  execSync(`pngquant --force --output "${outPath}" --quality=70-85 "${outPath}"`);
  const stat = readFileSync(outPath);
  return stat.length;
}

async function main() {
  const PUBLIC_DIR = join(process.cwd(), 'public');
  const results = [];
  for (let i = 0; i < MASCOTS.length; i++) {
    const m = MASCOTS[i];
    const out = join(PUBLIC_DIR, m.file);
    const prompt = `${STYLE_BASE}\n\nExpression: ${m.expression}`;
    process.stdout.write(`[${i + 1}/${MASCOTS.length}] ${m.file} ... `);
    try {
      const taskId = await submitTask(prompt);
      const url = await pollTask(taskId);
      const size = await downloadAndPostprocess(url, out);
      console.log(`${(size / 1024).toFixed(1)} KB ✓`);
      results.push({ file: m.file, ok: true, size });
    } catch (err) {
      console.log(`✗ ${err.message}`);
      results.push({ file: m.file, ok: false, error: err.message });
    }
  }
  console.log('\n— Summary —');
  for (const r of results) {
    if (r.ok) console.log(`  ${r.file}  ${(r.size / 1024).toFixed(1)} KB`);
    else console.log(`  ${r.file}  FAILED: ${r.error}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  if (failed > 0) process.exit(2);
}

main().catch((e) => {
  console.error('fatal:', e.message);
  process.exit(1);
});
