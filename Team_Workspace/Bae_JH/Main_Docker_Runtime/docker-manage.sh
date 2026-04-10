#!/bin/bash

################################################################################
# TravelArchive Docker 관리 스크립트
# 용도: TA 관련 모든 도커 컨테이너를 통합 관리
# 작성일: 2026-04-10
################################################################################

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 스크립트 위치
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Docker Compose 파일들
COMPOSE_FILES=(
  "docker-compose-db.yml"
  "docker-compose-redis.yml"
  "docker-compose-system.yml"
  "docker-compose-nginx.yml"
)

################################################################################
# 함수 정의
################################################################################

# 배너 출력
print_banner() {
  echo -e "${BLUE}"
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║       TravelArchive Docker 관리 도구 v1.0                 ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

# 메인 메뉴
show_menu() {
  echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}메인 메뉴${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo "1) 🟢 모든 컨테이너 시작"
  echo "2) 🔴 모든 컨테이너 중지"
  echo "3) 🔄 모든 컨테이너 재부팅"
  echo "4) 🗑️  모든 컨테이너 삭제"
  echo "5) 📊 컨테이너 상태 확인"
  echo "6) 📜 컨테이너 로그 보기"
  echo "7) 🔨 서비스별 관리"
  echo "8) ❌ 종료"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# 서비스별 메뉴
show_service_menu() {
  echo -e "\n${YELLOW}서비스 선택${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo "1) 🗄️  Database (PostgreSQL)"
  echo "2) 💾 Cache (Redis)"
  echo "3) ⚙️  Backend API"
  echo "4) 🌐 Frontend (Nginx)"
  echo "5) ↩️  돌아가기"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# 로그 메뉴
show_log_menu() {
  echo -e "\n${YELLOW}로그 선택${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo "1) 🗄️  Database 로그"
  echo "2) 💾 Cache 로그"
  echo "3) ⚙️  Backend 로그"
  echo "4) 🌐 Frontend 로그"
  echo "5) 📋 모든 로그 (실시간)"
  echo "6) ↩️  돌아가기"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# 성공 메시지
print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

# 실패 메시지
print_error() {
  echo -e "${RED}✗ $1${NC}"
}

# 정보 메시지
print_info() {
  echo -e "${BLUE}ℹ $1${NC}"
}

# 모든 컨테이너 시작
start_all() {
  echo -e "\n${YELLOW}모든 컨테이너 시작 중...${NC}"
  cd "$SCRIPT_DIR"

  for file in "${COMPOSE_FILES[@]}"; do
    if [ -f "$file" ]; then
      print_info "$file 실행 중..."
      docker-compose -f "$file" up -d
    fi
  done

  echo ""
  print_success "모든 컨테이너가 시작되었습니다!"
  sleep 2
}

# 모든 컨테이너 중지
stop_all() {
  echo -e "\n${YELLOW}모든 컨테이너 중지 중...${NC}"
  cd "$SCRIPT_DIR"

  for file in "${COMPOSE_FILES[@]}"; do
    if [ -f "$file" ]; then
      print_info "$file 중지 중..."
      docker-compose -f "$file" down
    fi
  done

  echo ""
  print_success "모든 컨테이너가 중지되었습니다!"
  sleep 2
}

# 모든 컨테이너 재부팅
restart_all() {
  echo -e "\n${YELLOW}모든 컨테이너 재부팅 중...${NC}"

  stop_all
  sleep 3
  start_all

  print_success "재부팅이 완료되었습니다!"
  sleep 2
}

# 모든 컨테이너 삭제 (확인 포함)
remove_all() {
  echo -e "\n${RED}⚠️  경고: 모든 컨테이너를 삭제하려고 합니다!${NC}"
  echo "데이터는 유지되지만 컨테이너는 완전히 제거됩니다."
  read -p "정말 삭제하시겠습니까? (y/N): " -r

  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "\n${YELLOW}컨테이너 삭제 중...${NC}"
    cd "$SCRIPT_DIR"

    for file in "${COMPOSE_FILES[@]}"; do
      if [ -f "$file" ]; then
        print_info "$file의 컨테이너 삭제..."
        docker-compose -f "$file" rm -f
      fi
    done

    echo ""
    print_success "모든 컨테이너가 삭제되었습니다!"
  else
    print_info "취소되었습니다."
  fi

  sleep 2
}

# 컨테이너 상태 확인
status_check() {
  echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}컨테이너 상태${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  docker ps -a --filter "name=TA_" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"

  echo ""
  echo -e "${YELLOW}컨테이너 상세 정보:${NC}"
  docker ps -a --filter "name=TA_" --format "{{.Names}}: {{.State}}" | while read -r line; do
    if [[ $line == *"running"* ]]; then
      print_success "$line"
    else
      print_error "$line"
    fi
  done

  echo ""
  read -p "Enter 키를 눌러 메인 메뉴로 돌아가기..."
}

# 로그 보기
show_logs() {
  while true; do
    show_log_menu
    read -p "선택 (1-6): " log_choice

    case $log_choice in
      1)
        print_info "Database 로그 (최근 50줄):"
        docker logs --tail 50 TA_db 2>/dev/null || print_error "Database 컨테이너를 찾을 수 없습니다."
        ;;
      2)
        print_info "Cache 로그 (최근 50줄):"
        docker logs --tail 50 TA_redis 2>/dev/null || print_error "Cache 컨테이너를 찾을 수 없습니다."
        ;;
      3)
        print_info "Backend 로그 (최근 50줄):"
        docker logs --tail 50 TA_backend 2>/dev/null || print_error "Backend 컨테이너를 찾을 수 없습니다."
        ;;
      4)
        print_info "Frontend 로그 (최근 50줄):"
        docker logs --tail 50 TA_nginx 2>/dev/null || print_error "Frontend 컨테이너를 찾을 수 없습니다."
        ;;
      5)
        print_info "모든 TA 컨테이너 실시간 로그 (Ctrl+C로 종료):"
        docker logs -f --all $(docker ps -aq --filter "name=TA_") 2>/dev/null || print_error "실행 중인 컨테이너가 없습니다."
        ;;
      6)
        break
        ;;
      *)
        print_error "잘못된 선택입니다."
        ;;
    esac

    echo ""
    read -p "Enter 키를 눌러 계속..."
  done
}

# 서비스별 관리
manage_service() {
  while true; do
    show_service_menu
    read -p "선택 (1-5): " service_choice

    case $service_choice in
      1)
        manage_database
        ;;
      2)
        manage_cache
        ;;
      3)
        manage_backend
        ;;
      4)
        manage_frontend
        ;;
      5)
        break
        ;;
      *)
        print_error "잘못된 선택입니다."
        ;;
    esac
  done
}

# Database 관리
manage_database() {
  echo -e "\n${YELLOW}Database (PostgreSQL) 관리${NC}"
  echo "1) 시작"
  echo "2) 중지"
  echo "3) 재부팅"
  echo "4) 로그"
  read -p "선택 (1-4): " db_choice

  cd "$SCRIPT_DIR"
  case $db_choice in
    1) docker-compose -f docker-compose-db.yml up -d && print_success "Database 시작됨" ;;
    2) docker-compose -f docker-compose-db.yml down && print_success "Database 중지됨" ;;
    3) docker-compose -f docker-compose-db.yml restart && print_success "Database 재부팅됨" ;;
    4) docker logs --tail 50 -f TA_db ;;
    *) print_error "잘못된 선택입니다." ;;
  esac

  sleep 2
}

# Cache 관리
manage_cache() {
  echo -e "\n${YELLOW}Cache (Redis) 관리${NC}"
  echo "1) 시작"
  echo "2) 중지"
  echo "3) 재부팅"
  echo "4) 로그"
  read -p "선택 (1-4): " cache_choice

  cd "$SCRIPT_DIR"
  case $cache_choice in
    1) docker-compose -f docker-compose-redis.yml up -d && print_success "Cache 시작됨" ;;
    2) docker-compose -f docker-compose-redis.yml down && print_success "Cache 중지됨" ;;
    3) docker-compose -f docker-compose-redis.yml restart && print_success "Cache 재부팅됨" ;;
    4) docker logs --tail 50 -f TA_redis ;;
    *) print_error "잘못된 선택입니다." ;;
  esac

  sleep 2
}

# Backend 관리
manage_backend() {
  echo -e "\n${YELLOW}Backend API 관리${NC}"
  echo "1) 시작"
  echo "2) 중지"
  echo "3) 재부팅"
  echo "4) 로그"
  read -p "선택 (1-4): " backend_choice

  cd "$SCRIPT_DIR"
  case $backend_choice in
    1) docker-compose -f docker-compose-system.yml up -d && print_success "Backend 시작됨" ;;
    2) docker-compose -f docker-compose-system.yml down && print_success "Backend 중지됨" ;;
    3) docker-compose -f docker-compose-system.yml restart && print_success "Backend 재부팅됨" ;;
    4) docker logs --tail 50 -f TA_backend ;;
    *) print_error "잘못된 선택입니다." ;;
  esac

  sleep 2
}

# Frontend 관리
manage_frontend() {
  echo -e "\n${YELLOW}Frontend (Nginx) 관리${NC}"
  echo "1) 시작"
  echo "2) 중지"
  echo "3) 재부팅"
  echo "4) 로그"
  read -p "선택 (1-4): " frontend_choice

  cd "$SCRIPT_DIR"
  case $frontend_choice in
    1) docker-compose -f docker-compose-nginx.yml up -d && print_success "Frontend 시작됨" ;;
    2) docker-compose -f docker-compose-nginx.yml down && print_success "Frontend 중지됨" ;;
    3) docker-compose -f docker-compose-nginx.yml restart && print_success "Frontend 재부팅됨" ;;
    4) docker logs --tail 50 -f TA_nginx ;;
    *) print_error "잘못된 선택입니다." ;;
  esac

  sleep 2
}

################################################################################
# 메인 루프
################################################################################

main() {
  # Docker 설치 확인
  if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose가 설치되어 있지 않습니다!"
    exit 1
  fi

  # 메인 루프
  while true; do
    clear
    print_banner
    show_menu
    read -p "선택 (1-8): " choice

    case $choice in
      1) start_all ;;
      2) stop_all ;;
      3) restart_all ;;
      4) remove_all ;;
      5) status_check ;;
      6) show_logs ;;
      7) manage_service ;;
      8)
        echo -e "\n${GREEN}TravelArchive 관리 도구를 종료합니다.${NC}"
        exit 0
        ;;
      *)
        print_error "잘못된 선택입니다. 다시 시도해주세요."
        sleep 2
        ;;
    esac
  done
}

# 스크립트 실행
main
