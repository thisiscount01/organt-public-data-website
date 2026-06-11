# Design Spec — 한국 대기질 공공데이터 웹사이트

> **토큰 시스템**: `public/tokens.css`
> **규칙**: 컴포넌트 CSS에 직접 색·간격·반경 값 하드코딩 금지. 모든 값은 `var(--token)` 참조.
> **다크모드**: `@media (prefers-color-scheme: dark)` 오버라이드 자동 적용 (토큰 레벨에서 처리, 컴포넌트 추가 작업 불필요).

---

## 1. 디자인 언어

### 1.1 AQI 등급 체계 (6단계)

| 등급 | 토큰 접두사 | 범위(AQI) | 의미 | 배경색(참고) | 텍스트색 |
|------|------------|-----------|------|-------------|---------|
| 좋음 | `--ui-aqi-good` | 0–50 | 쾌적 | 연두/초록 | 어두운 초록 |
| 보통 | `--ui-aqi-moderate` | 51–100 | 수용 가능 | 노랑 | 어두운 노랑 |
| 민감군나쁨 | `--ui-aqi-sensitive` | 101–150 | 민감군 주의 | 주황 | 어두운 주황 |
| 나쁨 | `--ui-aqi-bad` | 151–200 | 주의 | 적색 | 흰색 |
| 매우나쁨 | `--ui-aqi-very-bad` | 201–300 | 위험 | 보라 | 흰색 |
| 위험 | `--ui-aqi-hazardous` | 301+ | 긴급 위험 | 암적색 | 흰색 |

#### 토큰 3종 세트 (등급마다 동일 패턴)

```css
/* 배지 전체 배경 — 단독 칩, 지도 마커 fill */
background-color: var(--ui-aqi-good);

/* 배지 텍스트 — WCAG AA(4.5:1) 보장 */
color: var(--ui-aqi-good-text);

/* 카드 배경 틴트 — 목록 행·패널 배경 강조 */
background-color: var(--ui-aqi-good-surface);
```

#### ⚠ 절대 하지 말 것

```css
/* ❌ JS 에서 조건문으로 색 하드코딩 */
const color = aqi < 50 ? '#00e400' : '#ff0000';

/* ✅ 올바른 방법 — data-aqi 속성 + CSS 토큰 */
element.dataset.aqiGrade = 'good';
/* CSS */
[data-aqi-grade="good"] { background-color: var(--ui-aqi-good); color: var(--ui-aqi-good-text); }
```

**JS `data-aqi-grade` 값 매핑** (서버 AQI 숫자 → 등급 문자열)

| AQI 범위 | data 값 |
|---------|---------|
| 0–50 | `good` |
| 51–100 | `moderate` |
| 101–150 | `sensitive` |
| 151–200 | `bad` |
| 201–300 | `very-bad` |
| 301+ | `hazardous` |

---

## 2. 컴포넌트 명세

### 2.1 AQI 배지 (Badge)

```
┌─────────────────┐
│  ● 좋음  32    │  ← AQI 수치 + 등급 레이블
└─────────────────┘
```

| 속성 | 토큰 |
|------|------|
| 배경 | `var(--ui-aqi-{grade})` |
| 텍스트 | `var(--ui-aqi-{grade}-text)` |
| 패딩 X | `var(--ui-space-badge-x)` = 12px |
| 패딩 Y | `var(--ui-space-badge-y)` = 4px |
| 반경 | `var(--ui-radius-full)` |
| 폰트 | `var(--ui-font-size-sm)` `var(--ui-font-weight-semibold)` |
| 숫자 | `font-variant-numeric: var(--ui-font-variant-numeric)` |

**상태별 시각**

| 상태 | 표현 |
|------|------|
| 기본 | 배경 `--ui-aqi-{grade}` + 텍스트 `--ui-aqi-{grade}-text` |
| 호버 | `filter: brightness(0.92)` + `cursor: pointer` (마커용) |
| 활성(선택됨) | `outline: 2px solid var(--ui-color-border-focus)` + `outline-offset: 2px` |
| 로딩 | 텍스트 대신 스켈레톤 바 (`--ui-color-skeleton-base` shimmer) |
| 데이터없음 | 텍스트 `--` + 배경 `--ui-color-surface-muted` + 텍스트 `--ui-color-text-disabled` |

---

### 2.2 측정소 카드 (StationCard)

```
┌────────────────────────────────────────┐
│  📍 서울 중구 정동     [좋음 32]       │
│  PM2.5: 12  PM10: 24  O₃: 0.042       │
│  업데이트: 2026-06-11 14:00             │
└────────────────────────────────────────┘
```

| 속성 | 토큰 |
|------|------|
| 배경 | `var(--brand-surface)` |
| 패딩 | `var(--ui-space-card-padding)` = 24px |
| 간격(내부) | `var(--ui-space-card-gap)` = 16px |
| 반경 | `var(--ui-radius-xl)` = 16px |
| 테두리 | `1px solid var(--ui-color-border)` |
| 그림자 | `var(--ui-shadow-sm)` |
| 텍스트(제목) | `var(--ui-font-size-md)` `var(--ui-font-weight-semibold)` `var(--ui-color-text)` |
| 텍스트(부제) | `var(--ui-font-size-sm)` `var(--ui-color-text-secondary)` |
| 숫자 | `font-variant-numeric: var(--ui-font-variant-numeric)` `var(--ui-font-size-sm)` |

**상태별 시각**

| 상태 | 표현 |
|------|------|
| 기본 | 위 명세 그대로 |
| 호버 | `background: var(--ui-color-surface-hover)` + `box-shadow: var(--ui-shadow-md)` + `transform: translateY(-1px)` + `transition: var(--ui-transition-fast)` |
| 활성(클릭됨) | `background: var(--ui-color-surface-active)` + `box-shadow: var(--ui-shadow-xs)` + `transform: translateY(0)` |
| 선택됨(지도 연동) | `outline: 2px solid var(--brand-accent)` + `box-shadow: var(--ui-shadow-lg)` |
| 로딩 | 전체 배경 스켈레톤 shimmer (아래 §2.7 참조) |
| 에러 | 배경 `var(--ui-color-error-surface)` + 상단 `4px solid var(--ui-color-error)` 바 |
| 데이터없음 | 텍스트 `--` 표시 + 배경 정상 + 배지 데이터없음 상태 |

---

### 2.3 검색 입력 (SearchInput)

```
┌────────────────────────────────────┐
│  🔍  측정소 검색...                 │
└────────────────────────────────────┘
     ↓ 포커스 + 입력 시 드롭다운
┌────────────────────────────────────┐
│  서울 중구 정동                     │  ← 결과 항목
│  서울 마포 공덕                     │
│  검색 결과 없음 (0건)               │  ← 빈 결과 상태
└────────────────────────────────────┘
```

| 속성 | 토큰 |
|------|------|
| 배경 | `var(--ui-search-bg)` |
| 패딩 X | `var(--ui-space-input-x)` = 16px |
| 패딩 Y | `var(--ui-space-input-y)` = 12px |
| 반경 | `var(--ui-radius-lg)` = 12px |
| 테두리 | `1px solid var(--ui-search-border)` |
| placeholder | `color: var(--ui-search-placeholder)` |
| 아이콘 | `color: var(--ui-search-icon)` |
| 최소 높이 | `var(--ui-touch-target)` = 44px |

**상태별 시각**

| 상태 | 표현 |
|------|------|
| 기본 | 위 명세 |
| 호버 | `background: var(--ui-search-bg-hover)` + `border-color: var(--ui-color-border-strong)` |
| 포커스 | `border-color: var(--ui-search-border-focus)` + `box-shadow: var(--ui-shadow-focus)` + `outline: none` |
| 로딩(검색 중) | 우측 스피너 아이콘 (CSS only, `border-top: 2px solid var(--brand-accent)` 회전) |
| 에러(API 실패) | `border-color: var(--ui-color-error)` + `box-shadow: var(--ui-shadow-focus-error)` |
| 비활성 | `background: var(--ui-color-surface-disabled)` + `color: var(--ui-color-text-disabled)` + `cursor: not-allowed` |

**드롭다운 항목 상태**

| 상태 | 표현 |
|------|------|
| 기본 | `background: var(--ui-search-dropdown-bg)` |
| 호버/키보드 포커스 | `background: var(--ui-search-dropdown-item-hover)` |
| 선택됨 | `background: var(--ui-search-dropdown-item-selected)` + 체크 아이콘 |
| 빈 결과 | 전용 행 — `color: var(--ui-color-text-secondary)` `font-style: italic` "검색 결과 없음" |

---

### 2.4 지도 마커 (MapMarker)

```
  ●   ← 원형 마커 (AQI 등급 색)
  ↑
  42  ← 툴팁 (호버시)
```

| 속성 | 토큰 |
|------|------|
| 크기(기본) | `var(--ui-marker-size)` = 32px |
| 크기(선택됨) | `var(--ui-marker-size-lg)` = 40px |
| 크기(클러스터) | `var(--ui-marker-size-sm)` = 24px |
| 배경 | `var(--ui-aqi-{grade})` |
| 텍스트 | `var(--ui-aqi-{grade}-text)` `var(--ui-font-size-xs)` `var(--ui-font-weight-bold)` |
| 테두리 | `var(--ui-marker-border-width)` `solid var(--ui-marker-border)` |
| 그림자 | `var(--ui-marker-shadow)` |

**상태별 시각**

| 상태 | 표현 |
|------|------|
| 기본 | 원형, 등급 색 |
| 호버 | `transform: scale(1.15)` + `box-shadow: var(--ui-shadow-md)` + `z-index: var(--ui-z-raised)` |
| 선택됨 | `transform: scale(1.25)` + `box-shadow: var(--ui-shadow-lg)` + 테두리 `var(--brand-accent)` + `z-index: var(--ui-z-dropdown)` |
| 로딩 | 회색 원 + `--ui-color-skeleton-base` pulse |
| 데이터없음 | `var(--ui-color-surface-muted)` 배경 + `?` 텍스트 |

---

### 2.5 AQI 상세 패널 (DetailPanel)

상단 섹션 — 현재 측정값 수치

```
┌─────────────────────────────────────┐
│  서울 중구 정동        [좋음  32]   │
│  ─────────────────────────────────  │
│  PM2.5   PM10    O₃      NO₂        │
│   12      24    0.042   0.018       │  ← tabular-nums
│  μg/m³   μg/m³  ppm     ppm        │
└─────────────────────────────────────┘
```

하단 섹션 — 예보 차트

```
┌──────────────────────────────────────────────────────┐
│  48시간 예보 차트                                     │
│                                                       │
│   μg/m³                                               │
│   40 ─·─────────────────·──────────                  │
│   20 ────────────────────────────────                 │
│        12h  24h  36h  48h                             │
│                                                       │
│   ■ PM2.5  ■ PM10  ■ O₃  ■ NO₂                      │
└──────────────────────────────────────────────────────┘
```

| 속성 | 토큰 |
|------|------|
| 패널 배경 | `var(--brand-surface-raised)` |
| 수치 폰트 | `var(--ui-font-size-3xl)` `var(--ui-font-weight-bold)` `var(--ui-font-variant-numeric)` |
| 레이블 | `var(--ui-font-size-sm)` `var(--ui-color-text-secondary)` |
| 단위 | `var(--ui-font-size-xs)` `var(--ui-color-text-secondary)` |
| 차트 그리드 | `var(--ui-chart-grid)` |
| 차트 PM2.5 | `var(--ui-chart-pm25)` (선) + `var(--ui-chart-pm25-fill)` (면) |
| 차트 PM10 | `var(--ui-chart-pm10)` + `var(--ui-chart-pm10-fill)` |
| 차트 O₃ | `var(--ui-chart-o3)` + `var(--ui-chart-o3-fill)` |
| 차트 NO₂ | `var(--ui-chart-no2)` + `var(--ui-chart-no2-fill)` |
| 예보 밴드 | `var(--ui-chart-forecast-band)` |

---

### 2.6 페이지 헤더 (Header)

| 속성 | 토큰 |
|------|------|
| 배경 | `var(--brand-header-bg)` |
| 텍스트 | `var(--brand-header-text)` |
| 높이 | `var(--ui-layout-header-height)` = 56px |
| 패딩 X | `var(--ui-layout-content-padding-x)` |
| 그림자 | `var(--ui-shadow-md)` |
| z-index | `var(--ui-z-sticky)` |

---

### 2.7 로딩 스켈레톤 (Skeleton)

카드·배지·수치가 로딩 중일 때 shimmer 애니메이션.

```css
/* 스켈레톤 구현 패턴 */
.skeleton {
  background: linear-gradient(
    90deg,
    var(--ui-color-skeleton-base)  25%,
    var(--ui-color-skeleton-shine) 50%,
    var(--ui-color-skeleton-base)  75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer var(--ui-duration-lazy) infinite linear;
}

@keyframes skeleton-shimmer {
  0%   { background-position: 200% center; }
  100% { background-position: -200% center; }
}
```

| 적용 부위 | 크기 | 반경 |
|----------|------|------|
| 제목 텍스트 | h=1em w=60% | `var(--ui-radius-sm)` |
| 부제 텍스트 | h=0.8em w=40% | `var(--ui-radius-sm)` |
| AQI 배지 | h=24px w=64px | `var(--ui-radius-full)` |
| 수치(숫자) | h=2em w=3em | `var(--ui-radius-md)` |
| 차트 영역 | h=200px w=100% | `var(--ui-radius-lg)` |

---

### 2.8 에러 상태 (ErrorState)

API 요청 실패·네트워크 오류 시 표시.

```
┌─────────────────────────────────────┐
│  ⚠  데이터를 불러올 수 없습니다     │  ← error-surface 배경
│  잠시 후 다시 시도해 주세요.         │
│                                     │
│           [다시 시도]               │  ← 버튼
└─────────────────────────────────────┘
```

| 속성 | 토큰 |
|------|------|
| 카드 배경 | `var(--ui-color-error-surface)` |
| 상단 강조선 | `border-top: 4px solid var(--ui-color-error)` |
| 아이콘/제목 | `color: var(--ui-color-error)` `var(--ui-font-size-md)` `var(--ui-font-weight-semibold)` |
| 설명 | `color: var(--ui-color-error-text)` `var(--ui-font-size-sm)` |
| 버튼 배경 | `var(--ui-color-error)` |
| 버튼 텍스트 | `var(--brand-header-text)` |

---

### 2.9 데이터없음 상태 (EmptyState)

측정소 검색 결과 없음, 또는 특정 오염물질 측정값 미제공 시.

```
┌──────────────────────────────────────────────┐
│                                              │
│         🌫  측정 데이터가 없습니다           │
│         이 측정소에서 현재 제공되지 않는      │
│         항목입니다.                          │
│                                              │
└──────────────────────────────────────────────┘
```

| 속성 | 토큰 |
|------|------|
| 배경 | `var(--ui-color-surface-muted)` |
| 아이콘 | `color: var(--ui-color-text-disabled)` `font-size: 2.5rem` |
| 제목 | `var(--ui-color-text-secondary)` `var(--ui-font-size-md)` `var(--ui-font-weight-medium)` |
| 설명 | `var(--ui-color-text-disabled)` `var(--ui-font-size-sm)` |
| 수치 자리 | 텍스트 `--` + `color: var(--ui-color-text-disabled)` + `font-variant-numeric: var(--ui-font-variant-numeric)` |

> **공공 데이터 특기사항**: 한국 공공 대기 API는 측정소에 따라 일부 항목(O₃, NO₂ 등)이 `null`이거나 아예 필드 자체가 누락될 수 있음. 이 케이스를 "데이터없음"으로 처리하는 것이 "에러"와 구분되는 1급 UI 상태임.

---

## 3. 공통 인터랙션 원칙

### 3.1 포커스 관리
- 모든 인터랙티브 요소: `focus-visible` pseudo-class + `box-shadow: var(--ui-shadow-focus)`
- `outline: none` 단독 사용 금지 (→ 반드시 `box-shadow` 포커스 링 대체)
- 키보드 Tab 순서: 헤더 검색 → 지도 마커 → 상세 패널 순

### 3.2 최소 터치 영역
- 모든 버튼·마커·아이콘 버튼: `min-width: var(--ui-touch-target)` `min-height: var(--ui-touch-target)`
- 작은 보조 버튼(닫기 등): `var(--ui-touch-target-sm)` = 32px (모바일 예외 허용)

### 3.3 숫자 표현
- AQI 수치·PM2.5·PM10·O₃·NO₂: `font-variant-numeric: var(--ui-font-variant-numeric)` (tabular-nums)
- 소수점 자리 통일 → PM2.5/PM10: 정수, O₃/NO₂: 3자리 소수

### 3.4 전환 효과
| 전환 유형 | 토큰 |
|----------|------|
| 호버 색상 변화 | `var(--ui-transition-fast)` |
| 드롭다운 열림/닫힘 | `var(--ui-transition-normal)` |
| 패널 슬라이드 | `var(--ui-transition-slow)` |
| 카드 호버 이동 | `var(--ui-transition-fast)` |
| 스켈레톤 shimmer | `var(--ui-duration-lazy)` linear |

### 3.5 z-index 레이어 순서
```
페이지 기본 콘텐츠     z: 0  (--ui-z-base)
지도 위 카드 등        z: 10 (--ui-z-raised)
검색 드롭다운          z: 100(--ui-z-dropdown)
헤더 sticky            z: 200(--ui-z-sticky)
지도 오버레이          z: 300(--ui-z-overlay)
모달                   z: 400(--ui-z-modal)
토스트 알림            z: 500(--ui-z-toast)
툴팁                   z: 600(--ui-z-tooltip)
```

---

## 4. 반응형 브레이크포인트

| 이름 | 최소 너비 | 레이아웃 |
|------|----------|---------|
| mobile | 0 | 단일 컬럼, 지도 접힘, 패널 하단 시트 |
| tablet | 768px | 지도 좌측 + 측정소 목록 우측 |
| desktop | 1024px | 사이드바 + 지도 + 상세 패널 3단 |
| wide | 1280px | max-width 80rem 고정 |

---

## 5. 토큰 사용 체크리스트

프론트엔드가 컴포넌트를 구현할 때 아래 항목을 자가 점검합니다:

- [ ] 색 하드코딩 없음: `grep -E '#[0-9a-fA-F]{3,6}|rgb\(|hsl\(' public/*.css` = 0건
- [ ] AQI 색은 `data-aqi-grade` 속성 + CSS 토큰으로만 결정
- [ ] 모든 수치에 `font-variant-numeric: tabular-nums` 적용
- [ ] 모든 인터랙티브 요소 min-height/width ≥ 44px
- [ ] 호버·활성·포커스·비활성 상태 CSS 존재
- [ ] 로딩 상태: 스켈레톤 shimmer 표시
- [ ] 에러 상태: 에러 표면색 + 재시도 버튼 존재
- [ ] 데이터없음 상태: `--` 표시 (null 값을 그냥 비워 두지 않음)
- [ ] 포커스링: `box-shadow: var(--ui-shadow-focus)` 적용
- [ ] 다크모드: 추가 CSS 없이 토큰 자동 전환 확인

---

## 6. 토큰 → CSS 클래스 빠른 참조

```css
/* AQI 배지 클래스 패턴 */
.aqi-badge[data-aqi-grade="good"]      { background: var(--ui-aqi-good);      color: var(--ui-aqi-good-text); }
.aqi-badge[data-aqi-grade="moderate"]  { background: var(--ui-aqi-moderate);  color: var(--ui-aqi-moderate-text); }
.aqi-badge[data-aqi-grade="sensitive"] { background: var(--ui-aqi-sensitive); color: var(--ui-aqi-sensitive-text); }
.aqi-badge[data-aqi-grade="bad"]       { background: var(--ui-aqi-bad);       color: var(--ui-aqi-bad-text); }
.aqi-badge[data-aqi-grade="very-bad"]  { background: var(--ui-aqi-very-bad);  color: var(--ui-aqi-very-bad-text); }
.aqi-badge[data-aqi-grade="hazardous"] { background: var(--ui-aqi-hazardous); color: var(--ui-aqi-hazardous-text); }

/* 카드 표면 틴트 */
.station-card[data-aqi-grade="good"]   { background: var(--ui-aqi-good-surface); }
/* (나머지 등급 동일 패턴) */

/* 유틸리티 */
.text-secondary   { color: var(--ui-color-text-secondary); }
.text-disabled    { color: var(--ui-color-text-disabled); }
.surface-muted    { background: var(--ui-color-surface-muted); }
.surface-error    { background: var(--ui-color-error-surface); border-top: 4px solid var(--ui-color-error); }
.numeric          { font-variant-numeric: var(--ui-font-variant-numeric); }
.focus-ring:focus-visible { box-shadow: var(--ui-shadow-focus); outline: none; }
```
