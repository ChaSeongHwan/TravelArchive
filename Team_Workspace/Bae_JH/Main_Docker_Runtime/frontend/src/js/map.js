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

    function setupMapListeners(map) {
      // activeMarkerPos는 외부 스코프 공유 변수 사용 (addLocationButton과 공유)
      let lastValidCenter = map.getCenter();

      // Track center changes to always have a fallback for re-centering
      kakao.maps.event.addListener(map, 'center_changed', () => {
          lastValidCenter = map.getCenter();
          if (window.parent) window.parent.kakaoMapCenter = lastValidCenter;
      });

      window.addEventListener('message', (e) => {
        const { type, lat, lng, title } = e.data;

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
        }
      });
    }
  });
};

document.head.appendChild(script);
