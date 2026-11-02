/*
 * 2026 제주독서대전 스탬프 투어 설정 파일
 * ------------------------------------------------------------
 * 이 파일 하나만 고치면 프로그램·인증코드·설문 링크가 바뀝니다.
 * - programs[].code   : 현장 스태프가 알려주는 4자리 인증코드 (프로그램끼리, 설문 확인코드와 겹치면 안 됨)
 * - programs[].token  : QR코드에 들어가는 고유값 (영문·숫자, 바꾸면 기존 QR은 무효)
 * - programs[].stamp  : true = 스탬프 대상(만나멍·읽으멍·보멍), false = 안내만(놀멍·즐기멍·지키멍)
 * - programs[].rainPlace : 우천 시 장소 (없으면 빈 문자열)
 * - survey.code / survey.token : 1층 로비 담당자용 설문 확인코드 / 설문 확인 QR 값
 * - staffPin  : 선물 "교환 완료" 처리용 담당자 PIN
 * - adminPassword : 관리자 화면 비밀번호 (운영 전 꼭 바꾸세요)
 * 관리자 화면에서 코드를 새로 만들면 서버가 이 파일을 다시 씁니다.
 */
(function (root, factory) {
  var cfg = factory();
  if (typeof module === "object" && module.exports) module.exports = cfg;
  else root.STAMP_CONFIG = cfg;
})(typeof self !== "undefined" ? self : this, function () {
  return {
  "event": {
    "title": "2026 제주독서대전",
    "edition": "열 번째 가을",
    "slogan": "책밭에 모다들엉, 제주의 아름다운 독서 문화를 만들어 가요!",
    "period": "2026.10.24.(토) ~ 10.25.(일)",
    "venue": "제주시 우당도서관 일원",
    "hours": [
      { "day": "10.24.(토)", "time": "11:00~18:00" },
      { "day": "10.25.(일)", "time": "11:00~17:00" }
    ]
  },
  "rules": {
    "requiredStamps": 3,
    "maxStamps": 5
  },
  "gift": {
    "name": "〈나만의 키캡 키링 만들기〉 체험",
    "place": "우당도서관 1층 로비"
  },
  "survey": {
    "title": "2026 제주독서대전 참여자 만족도 설문조사",
    "url": "https://docs.google.com/forms/d/e/1FAIpQLSdRRI-RF57LFT34cyooVWkcbTbc3_jhHizvn-fDgQhBZ7FVqA/viewform",
    "place": "우당도서관 1층 로비",
    "code": "7310",
    "token": "SV9q4mT2xk"
  },
  "staffPin": "2610",
  "adminPassword": "jeju2026",
  "areas": [
    { "id": "manna", "name": "만나멍", "desc": "작가와 만나요", "stamp": true },
    { "id": "ilgeu", "name": "읽으멍", "desc": "책을 읽어요", "stamp": true },
    { "id": "bo", "name": "보멍", "desc": "전시·공연을 봐요", "stamp": true },
    { "id": "nol", "name": "놀멍", "desc": "책으로 놀아요", "stamp": false },
    { "id": "jeulgi", "name": "즐기멍", "desc": "사진으로 남겨요", "stamp": false },
    { "id": "jiki", "name": "지키멍", "desc": "환경을 지켜요", "stamp": false }
  ],
  "programs": [
    { "id": "m1", "area": "manna", "name": "김애란 작가 강연 〈안녕이라 그랬어〉", "day": "10.24", "time": "14:00~16:00", "place": "북카페", "rainPlace": "", "code": "4182", "token": "Mk7aL2pQ9r", "stamp": true },
    { "id": "m2", "area": "manna", "name": "박중훈 작가 강연 〈후회하지마〉 북 콘서트", "day": "10.24", "time": "18:00~20:00", "place": "야외무대", "rainPlace": "", "code": "5937", "token": "Hd3wP8nB1z", "stamp": true },
    { "id": "m3", "area": "manna", "name": "지토 작가 강연 〈지토툰〉", "day": "10.25", "time": "11:00~13:00", "place": "북카페", "rainPlace": "", "code": "2864", "token": "Zt6yQ4cV8m", "stamp": true },
    { "id": "m4", "area": "manna", "name": "박희순 작가 강연 〈나를 이해하는 힘, 자아문해력〉", "day": "10.25", "time": "15:00~17:00", "place": "북카페", "rainPlace": "", "code": "6415", "token": "Ph2sK9eW5d", "stamp": true },
    { "id": "m5", "area": "manna", "name": "북마켓 (출판사·책방·창작자·기관 30개 팀)", "day": "양일", "time": "운영시간 중", "place": "우당도서관 일원", "rainPlace": "", "code": "3092", "token": "Bm5tR1uX7g", "stamp": true },

    { "id": "r1", "area": "ilgeu", "name": "야외도서관", "day": "양일", "time": "상설", "place": "야외 잔디마당", "rainPlace": "", "code": "8251", "token": "Od4nF6hJ2s", "stamp": true },
    { "id": "r2", "area": "ilgeu", "name": "(문학상주작가와 함께하는) 필담하는 도서관", "day": "양일", "time": "상설", "place": "1층 로비", "rainPlace": "", "code": "1746", "token": "Pl8vC3kM6t", "stamp": true },
    { "id": "r3", "area": "ilgeu", "name": "(문학상주작가와 함께하는) 책 속 문장 키링 만들기", "day": "양일", "time": "상설", "place": "1층 로비", "rainPlace": "", "code": "9023", "token": "Kr1bN7wE4y", "stamp": true },
    { "id": "r4", "area": "ilgeu", "name": "책들의 수다방 〈해녀들〉, 〈안녕이라 그랬어〉", "day": "양일", "time": "12:00 / 15:00", "place": "울타리길", "rainPlace": "", "code": "5568", "token": "Sd9xG2pA5q", "stamp": true },

    { "id": "b1", "area": "bo", "name": "책밭 전시", "detail": "2017~2026 제주독서대전 전시 · 2014~2026 제주시 올해의 책 · 제주 향토 북 큐레이션 · 우당도서관 이달의 서가 · 〈나의 작은 책방〉 북 큐레이션 · 책보고·책넝쿨·북스타트 북 큐레이션", "day": "양일", "time": "상설", "place": "야외 잔디마당", "rainPlace": "", "code": "2379", "token": "Ex3hT8mZ1c", "stamp": true },
    { "id": "b2", "area": "bo", "name": "삼양초 오케스트라", "day": "10.24", "time": "11:00", "place": "야외무대", "rainPlace": "", "code": "4806", "token": "Or6jD1sL9v", "stamp": true },
    { "id": "b3", "area": "bo", "name": "어린이 마술쇼", "day": "10.24", "time": "13:00", "place": "야외무대", "rainPlace": "", "code": "7154", "token": "Mg2fW7rN3b", "stamp": true },
    { "id": "b4", "area": "bo", "name": "박완서 소설 낭독극", "day": "10.24", "time": "15:00", "place": "야외무대", "rainPlace": "", "code": "3627", "token": "Rd5kY4qH8n", "stamp": true },
    { "id": "b5", "area": "bo", "name": "가을밤 음악 콘서트 〈별소달소〉, 〈설향〉", "day": "10.24", "time": "17:30", "place": "야외무대", "rainPlace": "", "code": "8930", "token": "Cn9pU3eS6w", "stamp": true },
    { "id": "b6", "area": "bo", "name": "브레멘 음악대 싱어롱 공연", "day": "10.25", "time": "11:00", "place": "야외무대", "rainPlace": "", "code": "1583", "token": "Bv4mI8tR2k", "stamp": true },
    { "id": "b7", "area": "bo", "name": "불를락 들을락 제주어 동요제", "day": "10.25", "time": "14:00", "place": "야외무대", "rainPlace": "", "code": "6049", "token": "Jd7cO5zF1x", "stamp": true },

    { "id": "n1", "area": "nol", "name": "자파리 책 놀이터 (15개 \"씨앗\" 체험)", "day": "양일", "time": "11:00~16:00", "place": "오솔길", "rainPlace": "", "code": "", "token": "", "stamp": false },
    { "id": "j1", "area": "jeulgi", "name": "책 속 등장인물 코스프레 & 포토존", "day": "양일", "time": "운영시간 중", "place": "본관 입구", "rainPlace": "", "code": "", "token": "", "stamp": false },
    { "id": "j2", "area": "jeulgi", "name": "인생책컷", "day": "양일", "time": "운영시간 중", "place": "본관 입구", "rainPlace": "", "code": "", "token": "", "stamp": false },
    { "id": "k1", "area": "jiki", "name": "환경사랑 솜사탕", "day": "양일", "time": "운영시간 중", "place": "꿈오름강당 앞", "rainPlace": "", "code": "", "token": "", "stamp": false },
    { "id": "k2", "area": "jiki", "name": "에코카페", "day": "양일", "time": "운영시간 중", "place": "꿈오름강당 앞", "rainPlace": "", "code": "", "token": "", "stamp": false }
  ]
};
});
