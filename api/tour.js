// api/tour.js
export default async function handler(req, res) {
  // CORS 및 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const API_KEY = process.env.TOUR_API_KEY;

  // API 키가 세팅되지 않은 경우 처리
  if (!API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'TOUR_API_KEY 환경변수가 설정되지 않았습니다.'
    });
  }

  try {
    // 오늘 날짜 계산 (YYYYMMDD 형식)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const eventStartDate = `${year}${month}${day}`;

    // 한국관광공사 TourAPI 4.0 - 행사정보조회 (searchFestival1)
    // areaCode: 32 (강원특별자치도), sigunguCode: 9 (원주시)
    const endpoint = 'http://apis.data.go.kr/B551011/KorService1/searchFestival1';
    const queryParams = new URLSearchParams({
      serviceKey: decodeURIComponent(API_KEY), // 키 이중 인코딩 방지
      numOfRows: '30',
      pageNo: '1',
      MobileOS: 'ETC',
      MobileApp: 'MoeudaWonju',
      _type: 'json',
      listYN: 'Y',
      arrange: 'A', // 정렬 (A=촬영일순, C=수정일순, D=생성일순)
      areaCode: '32',
      sigunguCode: '9',
      eventStartDate: eventStartDate
    });

    const response = await fetch(`${endpoint}?${queryParams.toString()}`);

    if (!response.ok) {
      throw new Error(`공공데이터 API 응답 오류 (${response.status})`);
    }

    const data = await response.json();
    const items = data?.response?.body?.items?.item;

    if (!items) {
      return res.status(200).json({ success: true, events: [] });
    }

    // 배열 형태 보장 (결과가 1개일 경우 객체로 들어오는 경우 방지)
    const rawEvents = Array.isArray(items) ? items : [items];

    // 프론트엔드 데이터 규격에 맞게 정제 및 변환
    const events = rawEvents.map((item, index) => {
      // 제목 내 ( ) 나 [ ] 특수문자 정돈
      const cleanTitle = item.title ? item.title.replace(/\[.*?\]|\(.*?\)/g, '').trim() : '원주 행사';
      
      // 카테고리 구별 (축제/영화제 vs 일반 팝업·행사)
      const isFestival = cleanTitle.includes('축제') || cleanTitle.includes('영화제') || cleanTitle.includes('페스티벌');

      return {
        id: item.contentid || `tour-${index}`,
        title: item.title,
        startDate: item.eventstartdate || eventStartDate,
        endDate: item.eventenddate || item.eventstartdate || eventStartDate,
        addr: item.addr1 || '강원특별자치도 원주시',
        place: item.eventplace || item.addr1 || '원주시 일원',
        mapx: item.mapx ? parseFloat(item.mapx) : null,
        mapy: item.mapy ? parseFloat(item.mapy) : null,
        tel: item.tel || '',
        firstimage: item.firstimage || item.firstimage2 || '',
        category: isFestival ? 'festival' : 'popup'
      };
    });

    // 시작일자 오름차순 정렬 (가장 가까운 행사부터)
    events.sort((a, b) => a.startDate.localeCompare(b.startDate));

    return res.status(200).json({
      success: true,
      totalCount: events.length,
      events: events
    });

  } catch (error) {
    console.error('TourAPI Fetch Error:', error);
    return res.status(500).json({
      success: false,
      error: '원주 행사 정보를 불러오는 중 오류가 발생했습니다.'
    });
  }
}
