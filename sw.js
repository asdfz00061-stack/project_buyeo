/* 부여 시간 탐정 서비스 워커
 * - 게임 화면(HTML)은 항상 인터넷에서 먼저 받아 최신 버전을 쓰고, 끊겼을 때만 저장본 사용
 * - 버전이 고정된 라이브러리·음성·사진은 한 번 받으면 저장해 두고 재사용 (유적지에서 신호가 약해도 동작)
 * 파일 구성을 크게 바꾸면 CACHE 이름의 숫자를 올려 주세요.
 */
const CACHE = 'buyeo-detective-v35'; // v35: 대사는 금동이로, 수료증에 '금동이와 함께'
const CORE = [
  './',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdn.tailwindcss.com/3.4.16',
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
  'https://unpkg.com/lucide-react@0.460.0/dist/umd/lucide-react.min.js',
  'https://unpkg.com/@babel/standalone@7.26.4/babel.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // index.html 이 불러오는 방식과 같게: unpkg 스크립트는 crossorigin(cors), tailwind 는 no-cors
      .then((cache) =>
        Promise.all(
          CORE.map((url) => {
            const mode = url.includes('unpkg.com') ? 'cors' : url.startsWith('http') ? 'no-cors' : 'same-origin';
            const req = new Request(url, { mode });
            // cache.add 는 no-cors(불투명) 응답을 거부하므로 직접 받아서 저장
            return fetch(req)
              .then((res) => (res.ok || res.type === 'opaque' ? cache.put(req, res) : undefined))
              .catch(() => {});
          }),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const networkFirst = async (request) => {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request)) || (await cache.match('./')) || Response.error();
  }
};

const cacheFirst = async (request) => {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
  return res;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  // 음성 파일은 브라우저가 구간(Range)으로 요청할 수 있어 저장본 대신 그대로 받음
  if (request.headers.has('range')) return;
  const url = new URL(request.url);

  if (request.mode === 'navigate' || (url.origin === location.origin && url.pathname.endsWith('/'))) {
    event.respondWith(networkFirst(request));
  } else if (url.origin === location.origin) {
    // 음성(파일 이름에 내용 해시 포함)·사진·아이콘
    event.respondWith(cacheFirst(request));
  } else if (/^(cdn\.tailwindcss\.com|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname)) {
    event.respondWith(cacheFirst(request));
  }
});
