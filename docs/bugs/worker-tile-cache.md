# Workers 타일 캐시 호환성

운영 Workers에서 타일 요청이 `TypeError: Invalid URL: [object Request]`로 실패했다. OpenNext가 전달한 Next.js Request 객체를 Workers Cache API의 네이티브 Request로 사용할 수 없었다. 페이지 HTML과 DB API는 정상이어서 로컬 화면 검사만으로 발견되지 않았다.

캐시 조회와 저장에 Request 대신 `request.url` 문자열을 전달하도록 수정했다. URL의 `?v=`는 그대로 유지해 버전마다 별도 캐시를 사용한다.

`tests/tile-cache.test.cjs`는 Request 객체를 거부하는 캐시를 사용해 실제 라우트의 캐시 미스·저장·적중·버전 구분을 검사한다. 수정 전 동작으로 실행하면 두 테스트 모두 동일한 Invalid URL 오류로 실패하며, 수정 후 통과한다.
