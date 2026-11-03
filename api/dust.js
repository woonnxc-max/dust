// Vercel 서버리스 함수: 클라이언트의 요청을 받아 에어코리아 API를 호출하고 결과를 반환합니다.
module.exports = async function handler(req, res) {
    // 브라우저 응답 헤더 설정 (UTF-8 인코딩 JSON)
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    // 쿼리 파라미터에서 sido(시도 이름) 추출, 없으면 기본값 '서울' 설정
    const sido = req.query.sido || '서울';

    // 환경변수에서 에어코리아 인증키(Decoding 키) 가져오기
    const apiKey = process.env.AIRKOREA_KEY;

    // 인증키 환경변수가 설정되지 않은 경우 에러 반환
    if (!apiKey) {
        return res.status(500).json({
            error: '서버 환경변수(AIRKOREA_KEY)가 설정되지 않았습니다. .env.local 또는 Vercel 환경변수를 확인해주세요.'
        });
    }

    try {
        // Decoding 인증키 및 시도 이름을 URL 인코딩 처리
        const encodedKey = encodeURIComponent(apiKey.trim());
        const encodedSido = encodeURIComponent(sido);

        // 에어코리아 API 요청 주소 및 파라미터 조합
        const apiUrl = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${encodedKey}&returnType=json&sidoName=${encodedSido}&numOfRows=100&pageNo=1&ver=1.3`;

        // 공공데이터포털 서버로 비동기 GET 요청 전송
        const response = await fetch(apiUrl);

        // 응답 본문을 우선 텍스트 형태로 읽어옴 (XML 에러 응답 파싱 대비)
        const responseText = await response.text();

        // JSON 파싱 시도 (인증키 오류 등으로 XML 응답이 올 경우 catch로 이동)
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            // JSON이 아닌 XML 에러 응답인 경우 안내 메시지 반환
            return res.status(400).json({
                error: '인증키 또는 요청값을 확인해주세요.',
                detail: responseText
            });
        }

        // 응답 본문 내부의 resultCode 추출
        const resultCode = data?.response?.header?.resultCode;
        const resultMsg = data?.response?.header?.resultMsg;

        // 결과 코드가 성공('00')이 아닐 경우 한국어 에러 메시지 반환
        if (resultCode !== '00') {
            return res.status(400).json({
                error: `에어코리아 API 호출 실패 (코드: ${resultCode}): ${resultMsg || '알 수 없는 오류'}`,
                header: data?.response?.header
            });
        }

        // 정상적인 대기질 측정 데이터 클라이언트에 전달
        return res.status(200).json(data);

    } catch (error) {
        // 서버 내부 통신 오류 발생 시 에러 반환
        return res.status(500).json({
            error: `서버 통신 중 오류가 발생했습니다: ${error.message}`
        });
    }
};

