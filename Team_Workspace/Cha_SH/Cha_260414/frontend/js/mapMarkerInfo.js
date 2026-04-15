/**
 * mapMarkerInfo.js  (iframe 내부 실행)
 *
 * 역할
 *  DOM 패널을 직접 만들지 않습니다.
 *  카카오 Geocoder 로 주소를 조회한 뒤 window.parent.postMessage 로
 *  결과를 부모 페이지에 전달합니다.
 *
 *  부모 페이지의 rightSidebarMarkerPanel.js 가 이 메시지를 받아
 *  right-sidebar 하단의 패널을 열고 닫습니다.
 *
 * postMessage 이벤트 목록
 *  { type: 'MI_LOADING' }               – 조회 시작 (로딩 표시)
 *  { type: 'MI_DATA', payload: {...} }  – 조회 완료 (데이터 표시)
 *  { type: 'MI_ERROR' }                 – 조회 실패
 *  { type: 'MI_HIDE'  }                 – 패널 닫기 요청
 *
 * @module mapMarkerInfo
 * export { initMarkerInfo }
 */

// ─────────────────────────────────────────────────────────────────
//  부모에게 메시지 전달 (window.parent 없으면 무시)
// ─────────────────────────────────────────────────────────────────
function post(msg) {
  try { window.parent?.postMessage(msg, '*'); } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────
//  Geocoder 병렬 조회 (도로명 주소)
// ─────────────────────────────────────────────────────────────────
function fetchAddressInfo(geocoder, latlng) {
  const lat = latlng.getLat();
  const lng = latlng.getLng();

  return new Promise(resolve => {
    let roadAddr   = null;
    let jibunAddr  = null;
    let regionText = null;
    let done       = 0;

    const finish = () => {
      if (++done === 2) resolve({ roadAddr, jibunAddr, regionText, lat, lng });
    };

    // 1. 상세 주소 (도로명, 지번) 조회
    geocoder.coord2Address(lng, lat, (result, status) => {
      if (status === kakao.maps.services.Status.OK && result[0]) {
        roadAddr  = result[0].road_address?.address_name || null;
        jibunAddr = result[0].address?.address_name      || null;
      }
      finish();
    });

    // 2. 행정구역 정보 (도, 시, 동) 조회 (바다나 산 등 상세 주소가 없는 곳을 클릭했을 때의 Fallback)
    geocoder.coord2RegionCode(lng, lat, (result, status) => {
      if (status === kakao.maps.services.Status.OK) {
        const r = result.find(r => r.region_type === 'H') || result[0];
        if (r) {
          regionText = [
            r.region_1depth_name, r.region_2depth_name,
            r.region_3depth_name, r.region_4depth_name,
          ].filter(Boolean).join(' ');
        }
      }
      finish();
    });
  });
}

// ─────────────────────────────────────────────────────────────────
//  공개 API
// ─────────────────────────────────────────────────────────────────
/**
 * @param {kakao.maps.Map} map
 * @param {HTMLElement}    _container  (사용 안 함 – 시그니처 호환 유지)
 * @returns {{ show, hide, destroy }}
 */
export function initMarkerInfo(map, _container) {
  // services 라이브러리 미로드 대비
  if (!kakao.maps.services) {
    console.warn('[mapMarkerInfo] kakao.maps.services 미로드. SDK URL에 &libraries=services 추가 필요.');
    return { show: () => {}, hide: () => {}, destroy: () => {} };
  }

  const geocoder     = new kakao.maps.services.Geocoder();
  let   currentMarkerId = null;

  // 지도의 빈 공간을 클릭하면 마커 정보 패널을 닫음
  kakao.maps.event.addListener(map, 'click', () => _hide());

  function _show(latlng, markerId) {
    currentMarkerId = markerId;
    post({ type: 'MI_LOADING' });

    fetchAddressInfo(geocoder, latlng)
      .then(data => {
        if (currentMarkerId !== markerId) return; // 다른 마커로 교체됨
        post({ type: 'MI_DATA', payload: data });
      })
      .catch(() => post({ type: 'MI_ERROR' }));
  }

  function _hide(markerId) {
    // markerId 가 전달됐으나 현재 것과 다르면 무시
    if (markerId != null && markerId !== currentMarkerId) return;
    currentMarkerId = null;
    post({ type: 'MI_HIDE' });
  }

  return {
    show(latlng, markerId) { _show(latlng, markerId); },
    hide(markerId)         { _hide(markerId); },
    destroy()              { kakao.maps.event.removeListener(map, 'click', _hide); },
  };
}
