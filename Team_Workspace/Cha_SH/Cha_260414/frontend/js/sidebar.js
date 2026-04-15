/**
 * sidebar.js
 * Facade wrapper that exports all sidebar functionality.
 * Implementation is delegated to specialized manager modules:
 * - sidebar-base: open/close, mobile detection
 * - sidebar-tabs: tab switching
 * - sidebar-resizer: drag-to-resize
 * - sidebar-folding: collapse/expand sections
 * - memo-manager: memo CRUD
 * - schedule-manager: schedule CRUD
 * - rightSidebarMarkerPanel: 마커 장소 정보 패널 (right-sidebar 하단)
 */

import { SidebarBase }    from './managers/sidebar-base.js';
import { SidebarTabs }    from './managers/sidebar-tabs.js';
import { SidebarResizer } from './managers/sidebar-resizer.js';
import { SidebarFolding } from './managers/sidebar-folding.js';
import { MemoManager }    from './managers/memo-manager.js';
import { ScheduleManager } from './managers/schedule-manager.js';
import { initRightSidebarMarkerPanel } from './rightSidebarMarkerPanel.js';

// ── 마커 정보 패널 초기화 ────────────────────────────────────────
// #kakaoMapContainer 가 DOM 에 존재하면 즉시, 없으면 DOMContentLoaded 후 실행.
let _markerPanel = null;

function _initMarkerPanel() {
  const mapContainer = document.getElementById('kakaoMapContainer');
  if (!mapContainer || _markerPanel) return;
  _markerPanel = initRightSidebarMarkerPanel({ mapContainerEl: mapContainer });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initMarkerPanel);
} else {
  _initMarkerPanel();
}

/**
 * SidebarManager – Backwards compatible facade.
 * All methods delegate to specialized managers.
 */
export const SidebarManager = {
  // ── SidebarBase ────────────────────────────────────────────────
  isMobile:           (...args) => SidebarBase.isMobile(...args),
  mobileSidebarMode:  (...args) => SidebarBase.mobileSidebarMode(...args),
  syncContentState:   (...args) => SidebarBase.syncContentState(...args),
  openSidebar:        (...args) => SidebarBase.openSidebar(...args),
  closeSidebar:       (...args) => SidebarBase.closeSidebar(...args),
  openRightSidebar:   (...args) => {
    // 패널이 아직 없으면 지연 초기화 재시도 (동적으로 삽입된 경우 대비)
    _initMarkerPanel();
    return SidebarBase.openRightSidebar(...args);
  },
  closeRightSidebar:  (...args) => SidebarBase.closeRightSidebar(...args),

  // ── SidebarTabs ────────────────────────────────────────────────
  initTabs:              (...args) => SidebarTabs.initTabs(...args),
  adjustAllMemoHeights:  (...args) => SidebarTabs.adjustAllMemoHeights(...args),

  // ── SidebarResizer ─────────────────────────────────────────────
  initResizers:  (...args) => SidebarResizer.initResizers(...args),

  // ── SidebarFolding ─────────────────────────────────────────────
  initFolding:  (...args) => SidebarFolding.initFolding(...args),

  // ── MemoManager ────────────────────────────────────────────────
  initMemoRows:  (...args) => MemoManager.initMemoRows(...args),

  // ── ScheduleManager ────────────────────────────────────────────
  initScheduleRows:  (...args) => ScheduleManager.initScheduleRows(...args),

  // ── MarkerPanel ────────────────────────────────────────────────
  /** 마커 정보 패널을 수동으로 파괴합니다 (페이지 언마운트 시 사용). */
  destroyMarkerPanel() { _markerPanel?.destroy(); _markerPanel = null; },
};
