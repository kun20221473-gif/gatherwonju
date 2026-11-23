/**
 * api/tour.js - 한국관광공사 TourAPI 4.0 연동 모듈
 * 원주시(지역코드: 32, 시군구코드: 13)의 진행중/진행예정 행사 정보 조회
 */

// TourAPI 기본 엔드포인트
const TOUR_API_BASE_URL = 'https://apis.data.go.kr/B551011/KorService1';
const WONJU_AREA_CODE = '32';    // 강원특별자치도
const WONJU_SIGUNGU_CODE = '13'; // 원주시

/**
 * 오늘 날짜 구하기 (YYYYMMDD 형식)
 */
function getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

/**
 * 날짜 문자열 포맷 변환 (YYYYMMDD -> YYYY-MM-DD)
 */
function formatDate(dateStr) {
    if (!dateStr || dateStr.length < 8) return '2026-10-01';
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
}

/**
 * 원주시 행사/축제 목록 조회
 * @param {string} serviceKey - 공공데이터포털에서 발급받은 TOUR_API_KEY
 * @returns {Promise<Array>} 변환된 행사 목록 객체 배열
 */
export async function getWonjuEvents(serviceKey) {
    if (!serviceKey) {
        console.warn('[TourAPI] SERVICE_KEY가 설정되지 않았습니다.');
        return null;
    }

    try {
        const today = getTodayString();
        
        // TourAPI 행사 정보 조회 엔드포인트 URL 생성 (searchFestival1)
        const params = new URLSearchParams({
            serviceKey: serviceKey,
            numOfRows: '30',
            pageNo: '1',
            MobileOS: 'ETC',
            MobileApp: 'MoadaWonju',
            _type: 'json',
            listYN: 'Y',
            arrange: 'A', // 정렬: 대표이미지가 있는 항목 우선
            areaCode: WONJU_AREA_CODE,
            sigunguCode: WONJU_SIGUNGU_CODE,
            eventStartDate: today // 오늘 날짜 이후/진행 중인 행사만 조회
        });

        const requestUrl = `${TOUR_API_BASE_URL}/searchFestival1?${params.toString()}`;
        
        const response = await fetch(requestUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const items = data?.response?.body?.items?.item;

        if (!items) {
            console.info('[TourAPI] 해당 조건의 원주시 행사 데이터가 없습니다.');
            return [];
        }

        return parseTourApiItems(items);
    } catch (error) {
        console.error('[TourAPI] 원주시 행사 데이터 가져오기 실패:', error);
        return null;
    }
}

/**
 * TourAPI 응답 항목을 '모으다 원주' 웹앱 규격으로 변환
 */
function parseTourApiItems(items) {
    const itemList = Array.isArray(items) ? items : [items];

    return itemList.map((item, index) => {
        const startDate = formatDate(item.eventstartdate);
        const endDate = formatDate(item.eventenddate);

        return {
            id: `tour-${item.contentid || index}`,
            title: item.title || '원주 행사',
            category: 'FESTIVAL',
            categoryLabel: '🎉 축제/문화',
            startDate: startDate,
            endDate: endDate,
            reserveEndDate: startDate, // 기본 사전예약 마감일을 행사 시작일로 설정
            venue: item.addr1 || '강원특별자치도 원주시 일원',
            lat: parseFloat(item.mapy) || 37.3422,
            lng: parseFloat(item.mapx) || 127.9201,
            image: item.firstimage || item.firstimage2 || 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=800&q=80',
            fee: '무료 (상세 홈페이지 참고)',
            organizer: item.tel ? `문의처: ${item.tel}` : '원주시청 / 관련 기관',
            description: `${item.title}에 여러분을 초대합니다.\n\n주소: ${item.addr1 || '원주시 일원'}\n자세한 축제 일정 및 프로그램 정보는 원주시 공식 관광안내 또는 사이트를 참조해 주세요.`,
            reserveUrl: 'https://www.wonju.go.kr',
            transit: {
                buses: [
                    { num: '원주시내 30번, 31번, 51번', stop: '행사장 인근 정류장 하차', detail: '원주역/시외버스터미널에서 이동 가능' }
                ],
                walk: '가장 가까운 버스 정류장에서 하차 후 도보 3~5분 거리에 행사장 입구가 있습니다.'
            },
            parking: {
                mainName: item.addr1 ? `${item.addr1} 인근 공영주차장` : '행사장 전용 주차장',
                address: item.addr1 || '강원특별자치도 원주시',
                fee: '최초 1시간 무료 / 10분당 200원 (행사별 상이)',
                altName: '원주천 둔치 및 인근 임시 주차장',
                altTip: '주말 및 행사 개막일 혼잡 시 대중교통 이용을 권장합니다.'
            }
        };
    });
}
