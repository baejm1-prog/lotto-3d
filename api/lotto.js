// Vercel 서버리스 함수: /api/lotto?drwNo=1234
// 브라우저의 CORS 제한을 피하고, 공용 프록시(allorigins 등)에 의존하지 않기 위한 중계 함수입니다.
//
// ※ 동행복권 사이트는 개편되어 응답 구조가 바뀔 수 있습니다.
//   1) 기존 주소(common.do?method=getLottoNumber)를 먼저 시도하고,
//   2) 실패하면 개편 후 주소(lt645/selectPstLt645Info.do)를 시도해 기존 형식으로 변환합니다.
//   배포 후 /api/lotto?drwNo=1 을 직접 열어 returnValue가 "success"인지 꼭 확인하세요.

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; lotto-3d/1.0)',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://www.dhlottery.co.kr/',
};

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return JSON.parse(await res.text()); // HTML 점검 페이지 등이 오면 여기서 예외 발생
}

function formatDate(ymd) {
  const d = String(ymd || '');
  return /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d;
}

module.exports = async (req, res) => {
  const drwNo = parseInt(req.query.drwNo, 10);
  if (!Number.isInteger(drwNo) || drwNo < 1 || drwNo > 5000) {
    return res.status(400).json({ returnValue: 'fail', message: 'invalid drwNo' });
  }

  // 1) 기존 API
  try {
    const d = await getJson(`https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo}`);
    if (d && d.returnValue === 'success') {
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
      return res.status(200).json(d);
    }
  } catch (e) {
    /* 다음 방식 시도 */
  }

  // 2) 개편 후 API (구조 미검증: 필드명이 다르면 아래 normalize 부분을 수정하세요)
  try {
    const j = await getJson(`https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do?srchLtEpsd=${drwNo}`);
    const list = j && j.data && Array.isArray(j.data.list) ? j.data.list : [];
    const row = list.find((x) => Number(x.ltEpsd) === drwNo);
    if (row) {
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
      return res.status(200).json({
        returnValue: 'success',
        drwNo: Number(row.ltEpsd),
        drwNoDate: formatDate(row.ltRflYmd),
        drwtNo1: Number(row.tm1WnNo),
        drwtNo2: Number(row.tm2WnNo),
        drwtNo3: Number(row.tm3WnNo),
        drwtNo4: Number(row.tm4WnNo),
        drwtNo5: Number(row.tm5WnNo),
        drwtNo6: Number(row.tm6WnNo),
        bnusNo: Number(row.bnsWnNo),
      });
    }
  } catch (e) {
    /* 실패 처리 */
  }

  return res.status(502).json({ returnValue: 'fail' });
};
