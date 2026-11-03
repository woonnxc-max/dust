// Vercel 서버리스 프록시 API 엔드포인트 주소
const API_URL = '/api/dust';

// Chart.js 인스턴스 전역 저장 변수
let dustChartInstance = null;

// 시도 선택 드롭다운 HTML 요소 참조
const sidoSelect = document.getElementById('sidoSelect');

// 현재 선택된 지역명 표시 텍스트 참조
const currentRegion = document.getElementById('currentRegion');

// 기준 시각 안내 텍스트 참조
const baseTimeText = document.getElementById('baseTimeText');

// 공기 신호등 전체 카드 컨테이너 참조
const trafficLightCard = document.getElementById('trafficLightCard');

// 공기 신호등 대형 이모지 요소 참조 (🔵🟢🟠🔴)
const trafficEmoji = document.getElementById('trafficEmoji');

// 공기 신호등 상태명 텍스트 요소 참조 (좋음/보통/나쁨/매우나쁨)
const trafficStatus = document.getElementById('trafficStatus');

// 지역 평균 미세먼지 수치 텍스트 요소 참조
const averagePm10 = document.getElementById('averagePm10');

// 하단 한 줄 외출 가이드 문구 요소 참조
const trafficGuide = document.getElementById('trafficGuide');

// 각 측정소별 카드를 나열할 그리드 컨테이너 참조
const stationContainer = document.getElementById('stationContainer');

// '2026-11-03 12:00' 포맷을 '2026년 11월 3일 12시 기준' 한국어 형식으로 변환하는 함수
function formatKoreanDateTime(dateTimeStr) {
    // 시각 문자열이 없거나 유효하지 않은 경우 대체 문구 반환
    if (!dateTimeStr || typeof dateTimeStr !== 'string') {
        return '측정 시각 미제공';
    }
    try {
        // 날짜와 시각 분리
        const parts = dateTimeStr.trim().split(' ');
        if (parts.length >= 2) {
            // 연, 월, 일 분리
            const [year, month, day] = parts[0].split('-');
            // 시간 추출
            const [hour] = parts[1].split(':');
            // 한국어 문자열로 조합하여 반환 (09월 -> 9월, 08시 -> 8시)
            return `${year}년 ${Number(month)}월 ${Number(day)}일 ${Number(hour)}시 기준`;
        }
        return `${dateTimeStr} 기준`;
    } catch (e) {
        return `${dateTimeStr} 기준`;
    }
}

// 측정값 유효성 검사 및 '측정 안 됨' 예외 처리 함수
function formatMeasureValue(value) {
    // 결측치('-', 빈값, null)인 경우 예외 처리
    if (!value || value.trim() === '' || value.trim() === '-') {
        return { text: '측정 안 됨', isValidNumber: false, number: 0 };
    }
    // 숫자로 변환
    const num = Number(value);
    // 숫자가 아닌 경우 측정 안 됨 처리
    if (isNaN(num)) {
        return { text: '측정 안 됨', isValidNumber: false, number: 0 };
    }
    // 유효한 수치 반환
    return { text: `${num} ㎍/㎥`, isValidNumber: true, number: num };
}

// 미세먼지 등급별 은은한 카드 테마 및 상태 라벨 반환 함수
function getGradeInfo(grade) {
    // 1등급: 좋음 (은은한 파랑)
    if (grade === '1') {
        return { className: 'grade-1', label: '좋음' };
    }
    // 2등급: 보통 (은은한 초록)
    if (grade === '2') {
        return { className: 'grade-2', label: '보통' };
    }
    // 3등급: 나쁨 (은은한 주황)
    if (grade === '3') {
        return { className: 'grade-3', label: '나쁨' };
    }
    // 4등급: 매우나쁨 (은은한 빨강)
    if (grade === '4') {
        return { className: 'grade-4', label: '매우나쁨' };
    }
    // 등급 누락 시 은은한 회색 테마
    return { className: 'grade-unknown', label: '정보 없음' };
}

// 차트 막대용 등급별 색상 반환 함수 (파랑/초록/주황/빨강/회색)
function getGradeChartColor(grade) {
    // 1등급(좋음): 파랑
    if (grade === '1') {
        return { bg: '#3b82f6', border: '#2563eb' };
    }
    // 2등급(보통): 초록
    if (grade === '2') {
        return { bg: '#10b981', border: '#059669' };
    }
    // 3등급(나쁨): 주황
    if (grade === '3') {
        return { bg: '#f59e0b', border: '#d97706' };
    }
    // 4등급(매우나쁨): 빨강
    if (grade === '4') {
        return { bg: '#ef4444', border: '#dc2626' };
    }
    // 등급 없음: 회색
    return { bg: '#9ca3af', border: '#6b7280' };
}

// 측정소 단일 카드 요소 생성 함수
function createStationCard(item) {
    // 미세먼지 수치 계산
    const pm10 = formatMeasureValue(item.pm10Value);
    // 초미세먼지 수치 계산
    const pm25 = formatMeasureValue(item.pm25Value);
    // 등급 스타일 정보 추출
    const gradeInfo = getGradeInfo(item.pm10Grade);
    // 한국어 포맷 측정 시각 생성
    const timeFormatted = formatKoreanDateTime(item.dataTime);
    // 측정소 명칭
    const stationName = item.stationName || '알 수 없음';

    // 카드 요소 생성
    const card = document.createElement('article');
    // 등급별 은은한 테두리와 배경 클래스 적용
    card.className = `station-card ${gradeInfo.className}`;

    // 카드 내부 마크업 주입
    card.innerHTML = `
        <div class="card-header">
            <h3 class="station-name">${stationName}</h3>
            <span class="grade-badge">${gradeInfo.label}</span>
        </div>
        <div class="measure-info">
            <div class="info-row">
                <span class="info-label">미세먼지 (PM10)</span>
                <span class="info-value ${pm10.isValidNumber ? '' : 'not-measured'}">${pm10.text}</span>
            </div>
            <div class="info-row">
                <span class="info-label">초미세먼지 (PM2.5)</span>
                <span class="info-value ${pm25.isValidNumber ? '' : 'not-measured'}">${pm25.text}</span>
            </div>
        </div>
        <p class="card-time">${timeFormatted}</p>
    `;

    return card;
}

// 상단 공기 신호등(이모지, 상태명, 평균 수치, 안내 문구) 업데이트 함수
function updateTrafficLight(items) {
    // '-' 및 결측치를 제외한 유효한 미세먼지 수치 필터링
    const validItems = items
        .map(item => formatMeasureValue(item.pm10Value))
        .filter(result => result.isValidNumber);

    // 가장 최신 측정 시각을 상단 기준 시각으로 설정
    const latestTimeItem = items.find(item => item.dataTime);
    if (latestTimeItem && latestTimeItem.dataTime) {
        baseTimeText.textContent = formatKoreanDateTime(latestTimeItem.dataTime);
    } else {
        baseTimeText.textContent = '측정 시각 미제공';
    }

    // 유효한 수치가 있는 경우 평균 계산 및 신호등 상태 도출
    if (validItems.length > 0) {
        const sum = validItems.reduce((acc, cur) => acc + cur.number, 0);
        // 정수 단위 평균 미세먼지 수치
        const avg = Math.round(sum / validItems.length);
        averagePm10.textContent = avg;

        // 환경공단 미세먼지(PM10) 기준 구간별 상태 및 이모지 설정
        if (avg <= 30) {
            // 0 ~ 30: 좋음 (파랑 신호등)
            trafficLightCard.className = 'traffic-light-card status-good';
            trafficEmoji.textContent = '🔵';
            trafficStatus.textContent = '좋음';
            trafficGuide.textContent = '공기가 깨끗하고 상쾌해요! 환기하기 좋은 날입니다.';
        } else if (avg <= 80) {
            // 31 ~ 80: 보통 (초록 신호등)
            trafficLightCard.className = 'traffic-light-card status-normal';
            trafficEmoji.textContent = '🟢';
            trafficStatus.textContent = '보통';
            trafficGuide.textContent = '공기가 무난해요. 일상적인 야외 활동이 가능합니다.';
        } else if (avg <= 150) {
            // 81 ~ 150: 나쁨 (주황 신호등) - 마스크 권고 문구
            trafficLightCard.className = 'traffic-light-card status-bad';
            trafficEmoji.textContent = '🟠';
            trafficStatus.textContent = '나쁨';
            trafficGuide.textContent = '외출 시 마스크를 챙기세요';
        } else {
            // 151 이상: 매우나쁨 (빨강 신호등) - 마스크 권고 문구
            trafficLightCard.className = 'traffic-light-card status-very-bad';
            trafficEmoji.textContent = '🔴';
            trafficStatus.textContent = '매우나쁨';
            trafficGuide.textContent = '외출 시 마스크를 챙기세요';
        }
    } else {
        // 측정 데이터가 없을 경우 기본 상태 처리
        trafficLightCard.className = 'traffic-light-card status-unknown';
        trafficEmoji.textContent = '⚪';
        trafficStatus.textContent = '정보 없음';
        averagePm10.textContent = '-';
        trafficGuide.textContent = '측정 가능한 대기질 데이터가 없습니다.';
    }
}

// 상위 10개 측정소 미세먼지 가로 막대그래프 렌더링 함수
function renderTop10Chart(items) {
    // 캔버스 엘리먼트 가져오기
    const canvas = document.getElementById('dustChart');
    if (!canvas) return;

    // 결측치('-', 빈값)를 제외한 유효한 측정소 데이터만 추출
    const validStations = items
        .map(item => {
            const pm10 = formatMeasureValue(item.pm10Value);
            return {
                name: item.stationName || '알 수 없음',
                value: pm10.number,
                isValid: pm10.isValidNumber,
                grade: item.pm10Grade
            };
        })
        .filter(item => item.isValid);

    // 미세먼지 수치가 높은 순으로 내림차순 정렬
    validStations.sort((a, b) => b.value - a.value);

    // 상위 10개 측정소만 추출
    const top10 = validStations.slice(0, 10);

    // 기존 차트 인스턴스가 존재할 경우 파괴 후 재생성
    if (dustChartInstance) {
        dustChartInstance.destroy();
        dustChartInstance = null;
    }

    // 유효 데이터가 없을 경우 종료
    if (top10.length === 0) return;

    // 차트 레이블(측정소명) 배열 생성
    const labels = top10.map(item => item.name);
    // 차트 수치 배열 생성
    const dataValues = top10.map(item => item.value);
    // 각 측정소별 등급에 일치하는 배경색상 배열 생성
    const backgroundColors = top10.map(item => getGradeChartColor(item.grade).bg);
    // 각 측정소별 등급에 일치하는 테두리색상 배열 생성
    const borderColors = top10.map(item => getGradeChartColor(item.grade).border);

    // Chart.js를 사용한 가로 막대그래프 생성
    dustChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '미세먼지 (PM10)',
                data: dataValues,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1.5,
                borderRadius: 6,
                barThickness: 16
            }]
        },
        options: {
            indexAxis: 'y', // 가로 막대그래프 축 설정
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // 단일 지표이므로 상단 범례 숨김
                },
                tooltip: {
                    callbacks: {
                        // 툴팁 단위 안내 포맷 설정
                        label: (ctx) => ` 미세먼지 농도: ${ctx.parsed.x} ㎍/㎥`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: {
                        color: '#f1f5f9'
                    },
                    ticks: {
                        font: {
                            family: 'Pretendard'
                        }
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            family: 'Pretendard',
                            weight: '600'
                        }
                    }
                }
            }
        }
    });
}

// 대기오염 데이터 로딩 함수 (로딩 상태 표출 포함)
async function fetchAirQualityData(sido) {
    // 선택 지역 이름 표시
    currentRegion.textContent = sido;
    // 로딩 중 신호등 초기화
    trafficLightCard.className = 'traffic-light-card status-unknown';
    trafficEmoji.textContent = '⏳';
    trafficStatus.textContent = '불러오는 중...';
    averagePm10.textContent = '-';
    trafficGuide.textContent = '최신 대기오염 정보를 불러오는 중입니다...';
    baseTimeText.textContent = '불러오는 중...';
    // 로딩 중 안내 카드 노출
    stationContainer.innerHTML = '<div class="status-message">불러오는 중...</div>';

    try {
        // 서버리스 API 호출
        const requestUrl = `${API_URL}?sido=${encodeURIComponent(sido)}`;
        const response = await fetch(requestUrl);
        const result = await response.json();

        // 응답 에러 확인
        if (!response.ok) {
            throw new Error(result.error || '대기오염 정보를 가져오는데 실패했습니다.');
        }

        // 측정소 목록 추출
        const items = result?.response?.body?.items;

        // 측정 데이터 유효성 검사
        if (!items || !Array.isArray(items) || items.length === 0) {
            trafficLightCard.className = 'traffic-light-card status-unknown';
            trafficEmoji.textContent = '⚪';
            trafficStatus.textContent = '정보 없음';
            trafficGuide.textContent = '해당 지역의 측정소 데이터가 없습니다.';
            stationContainer.innerHTML = '<div class="status-message">해당 지역의 대기질 측정 데이터가 없습니다.</div>';
            if (dustChartInstance) dustChartInstance.destroy();
            return;
        }

        // 상단 공기 신호등 영역 갱신
        updateTrafficLight(items);

        // 상위 10개 측정소 가로 막대그래프 렌더링
        renderTop10Chart(items);

        // 하단 측정소 카드 컨테이너 비우기
        stationContainer.innerHTML = '';

        // 각 측정소별 은은한 카드 추가
        items.forEach(item => {
            const card = createStationCard(item);
            stationContainer.appendChild(card);
        });

    } catch (error) {
        // 에러 로그 기록
        console.error('대기질 데이터 요청 실패:', error);
        // 에러 상태 신호등 갱신
        trafficLightCard.className = 'traffic-light-card status-unknown';
        trafficEmoji.textContent = '⚠️';
        trafficStatus.textContent = '오류 발생';
        trafficGuide.textContent = error.message;
        stationContainer.innerHTML = `
            <div class="status-message">
                데이터를 불러오지 못했습니다.<br>
                <strong>${error.message}</strong>
            </div>
        `;
        if (dustChartInstance) dustChartInstance.destroy();
    }
}

// 지역 선택 드롭다운 변경 감지
sidoSelect.addEventListener('change', (e) => {
    fetchAirQualityData(e.target.value);
});

// 문서 로드 완료 시 기본 지역(서울) 데이터 조회
document.addEventListener('DOMContentLoaded', () => {
    fetchAirQualityData(sidoSelect.value);
});
