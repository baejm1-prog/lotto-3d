// Vercel 서버리스 함수: /api/visits  (GET=조회, POST=방문 1회 집계)
// Upstash Redis(Vercel Storage)가 연결되어 있지 않으면 {enabled:false}를 돌려주고, 화면에는 아무것도 표시하지 않습니다.
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse/i;

const kstDate = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

async function pipeline(commands) {
  const r = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(4000),
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  return r.json();
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(200).json({ enabled: false });

  const totalKey = 'lotto3d:visits:total';
  const dayKey = `lotto3d:visits:${kstDate()}`;
  try {
    if (req.method === 'POST' && !BOT.test(req.headers['user-agent'] || '')) {
      const out = await pipeline([['INCR', totalKey], ['INCR', dayKey], ['EXPIRE', dayKey, 60 * 60 * 24 * 45]]);
      return res.status(200).json({ enabled: true, total: out[0].result, today: out[1].result });
    }
    const out = await pipeline([['GET', totalKey], ['GET', dayKey]]);
    return res.status(200).json({ enabled: true, total: Number(out[0].result || 0), today: Number(out[1].result || 0) });
  } catch (e) {
    return res.status(200).json({ enabled: false });
  }
};
