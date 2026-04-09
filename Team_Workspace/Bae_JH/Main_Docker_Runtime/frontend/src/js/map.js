/**
 * map.js
 * handles Kakao Map initialization and communication with the parent window.
 */

// 1. Get Kakao Map API Key from environment variables
const KAKAO_API_KEY = import.meta.env.VITE_KAKAO_MAP_KEY;

// 2. Dynamically load the Kakao Map SDK
const script = document.createElement('script');
script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_API_KEY}&autoload=false`;

script.onload = () => {
  // Initialize Kakao Map after the SDK is loaded
  kakao.maps.load(() => {
    const container = document.getElementById('map');
    const defaultPos = new kakao.maps.LatLng(37.5665, 126.9780); // Default: Seoul

    // Shared state: track the active marker position across both location button and resize listener
    let activeMarkerPos = null;

    // --- 클릭 마커 공유 상태 (setupMapClickListener ↔ setupMapListeners) ---
    const clickMarkers = new Map(); // markerId -> kakao.maps.Marker
    let markerSeq = 0;
    let _clickMarkerImage = null; // lazy-initialized

    function getClickMarkerImage() {
      if (_clickMarkerImage) return _clickMarkerImage;
      // 오렌지-레드 계열 커스텀 SVG 마커
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
        <path fill="#FF5733" stroke="#CC3300" stroke-width="1.5"
          d="M14 0C6.268 0 0 6.268 0 14c0 10.667 14 26 14 26S28 24.667 28 14C28 6.268 21.732 0 14 0z"/>
        <circle fill="white" cx="14" cy="14" r="6"/>
      </svg>`;
      const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      _clickMarkerImage = new kakao.maps.MarkerImage(
        src,
        new kakao.maps.Size(28, 40),
        { offset: new kakao.maps.Point(14, 40) }
      );
      return _clickMarkerImage;
    }

    // 클릭 마커 추가 (클릭 이벤트 및 백엔드 push 공용)
    function addClickMarker(map, latlng, markerId) {
      const marker = new kakao.maps.Marker({
        position: latlng,
        map: map,
        image: getClickMarkerImage()
      });

      // 우클릭 시 마커 제거
      kakao.maps.event.addListener(marker, 'rightclick', function() {
        marker.setMap(null);
        clickMarkers.delete(markerId);

        // activeMarkerPos: 남아있는 마커 중 마지막 것으로 fallback
        const remaining = [...clickMarkers.values()];
        activeMarkerPos = remaining.length > 0
          ? remaining[remaining.length - 1].getPosition()
          : null;

        // 백엔드 삭제 API 호출
        const sid = window.parent?.currentSessionId;
        if (sid) {
          fetch(`/api/sessions/${sid}/map/markers/${encodeURIComponent(markerId)}`, {
            method: 'DELETE'
          }).catch(() => {});
        }
        // 부모 창에 제거 이벤트 알림
        if (window.parent) window.parent.postMessage({ type: 'MARKER_REMOVED', markerId }, '*');
      });

      clickMarkers.set(markerId, marker);
      activeMarkerPos = latlng;
      return marker;
    }

    // 마커 ID로 제거 (백엔드 push REMOVE_MARKER 처리용)
    function removeClickMarkerById(markerId) {
      const marker = clickMarkers.get(markerId);
      if (!marker) return;
      marker.setMap(null);
      clickMarkers.delete(markerId);
      const remaining = [...clickMarkers.values()];
      activeMarkerPos = remaining.length > 0
        ? remaining[remaining.length - 1].getPosition()
        : null;
    }

    // Fetch IP-based location and initialize map
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        const initialPos = (data.latitude && data.longitude)
          ? new kakao.maps.LatLng(data.latitude, data.longitude)
          : defaultPos;

        const map = new kakao.maps.Map(container, {
          center: initialPos,
          level: 8 // Regional view
        });

        // Fix Item 13: Expose map and center to parent for resizing logic
        if (window.parent) {
          window.parent.kakaoMap = map;
          window.parent.kakaoMapCenter = map.getCenter();

          kakao.maps.event.addListener(map, 'center_changed', () => {
            window.parent.kakaoMapCenter = map.getCenter();
          });
        }

        addLocationButton(map, container);
        setupMapListeners(map);
        setupMapClickListener(map);
      })
      .catch(() => {
        const map = new kakao.maps.Map(container, {
          center: defaultPos,
          level: 8
        });

        // Fix Item 13: Expose map and center to parent
        if (window.parent) {
          window.parent.kakaoMap = map;
          window.parent.kakaoMapCenter = map.getCenter();

          kakao.maps.event.addListener(map, 'center_changed', () => {
            window.parent.kakaoMapCenter = map.getCenter();
          });
        }

        addLocationButton(map, container);
        setupMapListeners(map);
        setupMapClickListener(map);
      });

    function addLocationButton(map, container) {
      let currentLocationMarker = null;

      const btn = document.createElement('button');
      btn.id = 'location-btn';
      btn.title = '내 위치 보기';
      btn.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
        </svg>
      `;

      btn.onclick = (e) => {
        // Prevent map click events
        e.stopPropagation();

        const handleGeolocation = (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const locPos = new kakao.maps.LatLng(lat, lng);
          map.setCenter(locPos);
          map.setLevel(3);

          if (currentLocationMarker) {
            currentLocationMarker.setMap(null);
          }
          currentLocationMarker = new kakao.maps.Marker({ position: locPos, map: map });
          activeMarkerPos = locPos; // 리사이즈 시 재중앙 정렬 기준점 저장
        };

        const handleIPFallback = () => {
          fetch('https://ipapi.co/json/')
            .then(res => res.json())
            .then(data => {
              if (data.latitude && data.longitude) {
                const locPos = new kakao.maps.LatLng(data.latitude, data.longitude);
                map.setCenter(locPos);
                map.setLevel(5); // IP 기반이므로 조금 덜 확대

                if (currentLocationMarker) {
                  currentLocationMarker.setMap(null);
                }
                currentLocationMarker = new kakao.maps.Marker({ position: locPos, map: map });
                activeMarkerPos = locPos; // 리사이즈 시 재중앙 정렬 기준점 저장

                alert('현재 접속 환경이 보안 연결(HTTPS)이 아니어서 IP 기반 대략적인 위치로 이동합니다.');
              }
            });
        };

        if (navigator.geolocation && window.isSecureContext) {
          navigator.geolocation.getCurrentPosition(handleGeolocation, (err) => {
            console.warn('Geolocation failed, falling back to IP:', err.message);
            handleIPFallback();
          }, { enableHighAccuracy: true });
        } else {
          // HTTPS가 아니거나 Geolocation 미지원 시 IP 기반 위치 사용
          handleIPFallback();
        }
      };

      container.appendChild(btn);
    }

    // 좌클릭: 오렌지 마커 추가 (다중), 우클릭: 마커 제거
    // 백엔드 push ADD_MARKER / REMOVE_MARKER postMessage도 여기서 처리
    function setupMapClickListener(map) {
      kakao.maps.event.addListener(map, 'click', function(mouseEvent) {
        const latlng = mouseEvent.latLng;
        const markerId = `click_${Date.now()}_${markerSeq++}`;

        addClickMarker(map, latlng, markerId);

        // 백엔드 추가 API 호출
        const sid = window.parent?.currentSessionId;
        if (sid) {
          fetch(`/api/sessions/${sid}/map/markers/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              marker_id: markerId,
              lat: latlng.getLat(),
              lng: latlng.getLng()
            })
          }).catch(() => {});
        }
        // 부모 창에 추가 이벤트 알림
        if (window.parent) {
          window.parent.postMessage({
            type: 'MARKER_ADDED',
            markerId,
            lat: latlng.getLat(),
            lng: latlng.getLng()
          }, '*');
        }
      });
    }

    function setupMapListeners(map) {
      // activeMarkerPos는 외부 스코프 공유 변수 사용 (addLocationButton과 공유)
      let lastValidCenter = map.getCenter();

      // Track center changes to always have a fallback for re-centering
      kakao.maps.event.addListener(map, 'center_changed', () => {
          lastValidCenter = map.getCenter();
          if (window.parent) window.parent.kakaoMapCenter = lastValidCenter;
      });

      window.addEventListener('message', (e) => {
        const { type, lat, lng, title, markerId } = e.data;

        if (type === 'MOVE_TO') {
          const pos = new kakao.maps.LatLng(lat, lng);
          activeMarkerPos = pos;
          map.setCenter(pos);
          map.setLevel(3);

          const marker = new kakao.maps.Marker({ position: pos, map });
          const infoWindow = new kakao.maps.InfoWindow({
            content: `<div style="padding:6px 10px;font-size:13px;color:#333;">${title}</div>`
          });
          infoWindow.open(map, marker);

        } else if (type === 'relayout') {
          // 리사이즈 중에도 마커 위치(또는 마지막 중심)로 계속 재정렬
          map.relayout();
          const targetPos = activeMarkerPos || lastValidCenter;
          if (targetPos) map.setCenter(targetPos);

        } else if (type === 'recenter') {
          // 리사이즈 완료 후 최종 정렬 (mouseup)
          map.relayout();
          const targetPos = activeMarkerPos || lastValidCenter;
          if (targetPos) map.setCenter(targetPos);

        } else if (type === 'ADD_MARKER') {
          // 백엔드가 지도에 마커를 추가하도록 요청
          if (lat == null || lng == null) return;
          const pos = new kakao.maps.LatLng(lat, lng);
          const id = markerId || `ext_${Date.now()}_${markerSeq++}`;
          addClickMarker(map, pos, id);

        } else if (type === 'REMOVE_MARKER') {
          // 백엔드가 특정 마커를 제거하도록 요청
          if (markerId) removeClickMarkerById(markerId);
        }
      });
    }
  });
};

document.head.appendChild(script);
