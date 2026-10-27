// 설치 가능(PWA) 조건을 위한 최소 서비스 워커 (캐시 없이 네트워크 그대로 사용)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
