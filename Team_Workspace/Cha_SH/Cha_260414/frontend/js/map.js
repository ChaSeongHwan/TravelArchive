/**
 * map.js
 * 카카오맵 초기화 및 부모 창과의 통신을 담당합니다.
 *
 * 의존 모듈
 *  - mapOverlayControls.js  → 레이어 토글 + 줌 사이드바 (지도 위 absolute)
 *  - mapMarkerInfo.js       → 마커 장소 정보 패널 (지도 아래 플로우)
 *
 * 
 */

import { initOverlayControls } from './mapOverlayControls.js';
import { initMarkerInfo }       from './mapMarkerInfo.js';

// ── API 키 ────────────────────────────────────────────────────────
const KAKAO_API_KEY = import.meta.env.VITE_KAKAO_MAP_KEY;

// ── SDK 로드 (services 라이브러리 포함) ───────────────────────────
const script = document.createElement('script');
script.src = [
  'https://dapi.kakao.com/v2/maps/sdk.js',
  `?appkey=${KAKAO_API_KEY}`,
  '&autoload=false',     // 스크립트 로드 완료 후 수동으로 init하기 위해 false 설정
  '&libraries=services', // 주소-좌표 변환(Geocoder) 기능 활성화
].join('');

script.onload = () => {
  kakao.maps.load(() => {
    const container  = document.getElementById('map');
    const defaultPos = new kakao.maps.LatLng(37.5665, 126.9780); // 서울

    // ── 상태 관리 변수 ─────────────────────────────────────────────────
    let activeMarkerPos   = null;        // 현재 활성화된(포커스된) 마커의 좌표
    const clickMarkers    = new Map();   // 생성된 마커 객체들을 추적 (키: markerId, 값: Marker 인스턴스)
    let   markerSeq       = 0;           // 고유한 마커 ID 생성을 위한 시퀀스
    let   _markerImage    = null;        // 마커 이미지 캐싱 (Lazy-init)

    // ── 마커 이미지 (오렌지-레드 SVG) ────────────────────────────
    // 외부 이미지 리소스에 의존하지 않고 SVG를 Data URI로 변환하여 사용합니다.
    function getMarkerImage() {
      if (_markerImage) return _markerImage;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
        <path fill="#FF5733" stroke="#CC3300" stroke-width="1.5"
          d="M14 0C6.268 0 0 6.268 0 14c0 10.667 14 26 14 26S28 24.667 28 14C28 6.268 21.732 0 14 0z"/>
        <circle fill="white" cx="14" cy="14" r="6"/>
      </svg>`;
      _markerImage = new kakao.maps.MarkerImage(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        new kakao.maps.Size(28, 40),
        { offset: new kakao.maps.Point(14, 40) }
      );
      return _markerImage;
    }

    // ── 마커 추가 ─────────────────────────────────────────────────
    function addMarker(map, latlng, markerId, markerInfo) {
      const marker = new kakao.maps.Marker({ position: latlng, map, image: getMarkerImage() });

      // 우클릭 → 삭제
      kakao.maps.event.addListener(marker, 'rightclick', () => {
        marker.setMap(null);
        clickMarkers.delete(markerId);

        // 삭제 후 남은 마커 중 가장 마지막 마커를 활성 상태로 변경
        const rem = [...clickMarkers.values()];
        activeMarkerPos = rem.length ? rem[rem.length - 1].getPosition() : null;
        markerInfo.hide(markerId);

        // 서버(API) 동기화 (부모 창의 세션 ID 활용)
        const sid = window.parent?.currentSessionId;
        if (sid) {
          fetch(`/api/sessions/${sid}/map/markers/${encodeURIComponent(markerId)}`, { method: 'DELETE' })
            .catch(() => {});
        }
        // 부모 창의 UI 갱신을 위해 메시지 전달
        if (window.parent) window.parent.postMessage({ type: 'MARKER_REMOVED', markerId }, '*');
      });

      // 좌클릭 → 정보 패널 열기
      kakao.maps.event.addListener(marker, 'click', () => {
        kakao.maps.event.preventMap();
        markerInfo.show(latlng, markerId);
      });

      clickMarkers.set(markerId, marker);
      activeMarkerPos = latlng;
      return marker;
    }

    // ── 마커 ID로 제거 ────────────────────────────────────────────
    function removeMarkerById(markerId, markerInfo) {
      const m = clickMarkers.get(markerId);
      if (!m) return;
      m.setMap(null);
      clickMarkers.delete(markerId);
      const rem = [...clickMarkers.values()];
      activeMarkerPos = rem.length ? rem[rem.length - 1].getPosition() : null;
      markerInfo.hide(markerId);
    }

    // ── 지도 공통 초기화 ──────────────────────────────────────────
    function initMap(map) {
      if (window.parent) {
        window.parent.kakaoMap       = map;
        window.parent.kakaoMapCenter = map.getCenter();
        kakao.maps.event.addListener(map, 'center_changed', () => {
          window.parent.kakaoMapCenter = map.getCenter();
        });
      }

      // 오버레이 컨트롤 (지도 위 absolute 패널)
      initOverlayControls(map, container);

      // 마커 정보 (지도 아래 플로우 패널)
      const markerInfo = initMarkerInfo(map, container);

      addLocationButton(map, container);
      setupClickListener(map, markerInfo);
      setupMessageListener(map, markerInfo);
    }

    // ── IP 기반 초기 위치로 지도 생성 ────────────────────────────
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(d => {
        const pos = (d.latitude && d.longitude)
          ? new kakao.maps.LatLng(d.latitude, d.longitude)
          : defaultPos;
        initMap(new kakao.maps.Map(container, { center: pos, level: 8 }));
      })
      .catch(() => {
        initMap(new kakao.maps.Map(container, { center: defaultPos, level: 8 }));
      });

    // ── 내 위치 버튼 ──────────────────────────────────────────────
    function addLocationButton(map, container) {
      let locMarker = null;

      const btn = document.createElement('button');
      btn.id    = 'location-btn';
      btn.title = '내 위치 보기';
      btn.innerHTML = `<svg viewBox="0 0 24 24">
        <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3
          c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06
          c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06
          zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
      </svg>`;

      // 전달받은 좌표로 지도를 이동하고 내 위치 마커를 찍는 함수
      const moveTo = (locPos, level = 3) => {
        map.setCenter(locPos);
        map.setLevel(level);
        if (locMarker) locMarker.setMap(null);
        locMarker = new kakao.maps.Marker({ position: locPos, map });
        activeMarkerPos = locPos;
      };

      // GPS 권한 거부 시 fallback
      const ipFallback = () =>
        fetch('https://ipapi.co/json/')
          .then(r => r.json())
          .then(d => {
            if (d.latitude && d.longitude) {
              moveTo(new kakao.maps.LatLng(d.latitude, d.longitude), 5);
              alert('IP 기반 대략적인 위치로 이동합니다.');
            }
          });

      btn.onclick = e => {
        e.stopPropagation();
        if (navigator.geolocation && window.isSecureContext) {
          navigator.geolocation.getCurrentPosition(
            p  => moveTo(new kakao.maps.LatLng(p.coords.latitude, p.coords.longitude)),
            () => ipFallback(),
            { enableHighAccuracy: true }
          );
        } else {
          ipFallback();
        }
      };

      container.appendChild(btn);
    }

    // ── 지도 클릭 → 마커 추가 + 정보 패널 열기 ──────────────────
    function setupClickListener(map, markerInfo) {
      kakao.maps.event.addListener(map, 'click', e => {
        const latlng   = e.latLng;
        const markerId = `click_${Date.now()}_${markerSeq++}`; // 고유 ID 생성

        addMarker(map, latlng, markerId, markerInfo);
        markerInfo.show(latlng, markerId); // 좌표를 바탕으로 주소 조회 트리거

        // 서버 저장 로직
        const sid = window.parent?.currentSessionId;
        if (sid) {
          // ... fetch 생략 ...
        }

        // 부모 창으로 데이터 전달 (React, Vue 등 외부 프레임워크와의 연동점)
        if (window.parent) {
          window.parent.postMessage({
            type: 'MARKER_ADDED', markerId,
            lat: latlng.getLat(), lng: latlng.getLng(),
          }, '*');
        }
      });
    }

    // ── 부모 창(Window)으로부터의 메시지 수신 (postMessage) ───────────────────
    // iframe 외부(부모)에서 지도를 조작할 수 있도록 인터페이스를 열어둡니다.
    function setupMessageListener(map, markerInfo) {
      let lastCenter = map.getCenter();
      kakao.maps.event.addListener(map, 'center_changed', () => {
        lastCenter = map.getCenter();
        if (window.parent) window.parent.kakaoMapCenter = lastCenter;
      });

      window.addEventListener('message', e => {
        const { type, lat, lng, title, markerId } = e.data;

        // 특정 좌표로 지도 중심 이동 및 인포윈도우 표시
        if (type === 'MOVE_TO') {
          // ... 로직 생략 ...
        } 
        // 지도 컨테이너 크기 변경 시 렌더링 깨짐 방지
        else if (type === 'relayout' || type === 'recenter') {
          map.relayout();
          const t = activeMarkerPos || lastCenter;
          if (t) map.setCenter(t);
        } 
        // 외부에서 마커 추가 요청
        else if (type === 'ADD_MARKER') {
          // ... 로직 생략 ...
        } 
        // 외부에서 마커 삭제 요청
        else if (type === 'REMOVE_MARKER') {
          if (markerId) removeMarkerById(markerId, markerInfo);
        }
      });
    }
  });
};

document.head.appendChild(script);
