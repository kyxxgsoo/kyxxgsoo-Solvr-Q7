# 풀스택 서비스 보일러 플레이트

## 프로젝트 개요

이 보일러 플레이트는 풀스택 웹 애플리케이션 개발을 위한 기본 구조를 제공합니다. monorepo 구조로 클라이언트와 서버를 효율적으로 관리하며, 현대적인 웹 개발 기술 스택을 활용합니다.

## 기술 스택

### 공통

- 패키지 매니저: pnpm (workspace 기능 활용)
- 언어: TypeScript
- Node.js 버전: 22.x
- 테스트: Vitest
- 코드 품질: Prettier

### 클라이언트

- 프레임워크: React
- 빌드 도구: Vite
- 라우팅: React Router
- 스타일링: TailwindCSS

### 서버

- 프레임워크: Fastify
- 데이터베이스: SQLite with DirzzleORM

## 설치 및 실행

### 초기 설치

```bash
# 프로젝트 루트 디렉토리에서 실행
pnpm install
```

### 개발 서버 실행

```bash
# 클라이언트 및 서버 동시 실행
pnpm dev

# 클라이언트만 실행
pnpm dev:client

# 서버만 실행
pnpm dev:server
```

### 테스트 실행

```bash
# 클라이언트 테스트
pnpm test:client

# 서버 테스트
pnpm test:server

# 모든 테스트 실행
pnpm test
```

### 빌드

```bash
# 클라이언트 및 서버 빌드
pnpm build
```

## 환경 변수 설정

- 클라이언트: `client/.env` 파일에 설정 (예시는 `client/.env.example` 참조)
- 서버: `server/.env` 파일에 설정 (예시는 `server/.env.example` 참조)

## API 엔드포인트

서버는 다음과 같은 기본 API 엔드포인트를 제공합니다:

- `GET /api/health`: 서버 상태 확인
- `GET /api/users`: 유저 목록 조회
- `GET /api/users/:id`: 특정 유저 조회
- `POST /api/users`: 새 유저 추가
- `PUT /api/users/:id`: 유저 정보 수정
- `DELETE /api/users/:id`: 유저 삭제

## 릴리즈 통계 대시보드

이 프로젝트는 GitHub 저장소의 릴리즈 데이터를 시각화하는 대시보드를 제공합니다.

### 주요 기능

1. **월별 릴리즈 추이**
   - 시간에 따른 릴리즈 빈도를 선 그래프로 표시
   - 월별 릴리즈 수의 변화 추이를 한눈에 파악 가능

2. **저장소별 릴리즈 수**
   - 각 저장소별 총 릴리즈 수를 막대 그래프로 표시
   - 저장소 간 릴리즈 활동 비교 가능

3. **주말 vs 평일 릴리즈 비율**
   - 주말과 평일의 릴리즈 비율을 파이 차트로 표시
   - 릴리즈 패턴의 시간적 분포 파악 가능

### 기술 스택

- React + TypeScript
- Recharts (차트 라이브러리)
- TailwindCSS (스타일링)

### 데이터 소스

대시보드는 `release_raw_data.csv` 파일의 데이터를 기반으로 동작합니다. 이 파일은 다음 정보를 포함합니다:

- 저장소 정보
- 릴리즈 태그 및 이름
- 발행 일시
- 연도, 월, 일, 주차 정보
- 주말 여부
- 릴리즈 URL

### 확장성

대시보드는 모듈식으로 설계되어 있어 다음과 같은 확장이 가능합니다:

- 새로운 차트 추가
- 기존 차트의 시각화 방식 변경
- 추가 데이터 필드 통합
- 필터링 및 정렬 기능 추가
