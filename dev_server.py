import http.server
import socketserver
import urllib.request
import urllib.parse
import json
import os
import webbrowser

# 로컬 개발 서버 포트 번호 설정
PORT = 3000

# .env.local 파일에서 AIRKOREA_KEY 값을 읽어오는 함수
def get_api_key():
    env_path = os.path.join(os.path.dirname(__file__), '.env.local')
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('AIRKOREA_KEY='):
                    return line.split('=', 1)[1].strip()
    return os.environ.get('AIRKOREA_KEY', '')

# HTTP 요청 처리 핸들러 (정적 파일 서빙 및 /api/dust 프록시)
class DustDevHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        
        # /api/dust 요청인 경우 공공데이터포털 API를 호출하여 반환
        if parsed.path == '/api/dust':
            query_params = urllib.parse.parse_qs(parsed.query)
            sido = query_params.get('sido', ['서울'])[0]
            
            # 인증키 확인
            api_key = get_api_key()
            if not api_key:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'error': '.env.local 파일에 AIRKOREA_KEY가 설정되지 않았습니다.'}, ensure_ascii=False).encode('utf-8'))
                return

            try:
                # Decoding 키 및 시도 이름 URL 인코딩
                encoded_key = urllib.parse.quote(api_key.strip())
                encoded_sido = urllib.parse.quote(sido)
                api_url = (
                    f"https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty"
                    f"?serviceKey={encoded_key}&returnType=json&sidoName={encoded_sido}&numOfRows=100&pageNo=1&ver=1.3"
                )
                
                # 에어코리아 API 요청 전송
                req = urllib.request.Request(api_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    resp_text = resp.read().decode('utf-8')

                # JSON 유효성 검사 (XML 에러 대응)
                try:
                    data = json.loads(resp_text)
                except Exception:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': '인증키 또는 요청값을 확인해주세요.', 'detail': resp_text}, ensure_ascii=False).encode('utf-8'))
                    return

                # 에어코리아 응답 결과 코드 확인
                result_code = data.get('response', {}).get('header', {}).get('resultCode')
                if result_code != '00':
                    result_msg = data.get('response', {}).get('header', {}).get('resultMsg', '알 수 없는 오류')
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': f'에어코리아 API 호출 실패 (코드: {result_code}): {result_msg}'}, ensure_ascii=False).encode('utf-8'))
                    return

                # 정상 JSON 데이터 클라이언트에 반환
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(resp_text.encode('utf-8'))

            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'error': f'서버 통신 중 오류가 발생했습니다: {str(e)}'}, ensure_ascii=False).encode('utf-8'))
                return
        else:
            # HTML, CSS, JS 정적 파일 서빙
            super().do_GET()

if __name__ == '__main__':
    # 스크립트가 위치한 디렉토리로 작업 경로 이동
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), DustDevHandler) as httpd:
        print(f"로컬 개발 서버가 실행되었습니다: http://localhost:{PORT}")
        # 기본 브라우저 자동 실행
        webbrowser.open(f"http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n서버를 종료합니다.")

