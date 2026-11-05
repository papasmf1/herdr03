// 문화행사 필터·판별 순수 함수. DOM과 시간대 변환을 쓰지 않는다.
export const OTHER_GU = '기타';
export const OPEN_ENDED_YEAR = 2099; // 종료일이 이 해 이상이면 '상시'로 본다

export const isFree = (row) => row.IS_FREE === '무료';

export const datePart = (value) => String(value ?? '').slice(0, 10);

export const eventDates = (row) => ({ start: datePart(row.STRTDATE), end: datePart(row.END_DATE) });

// 구 이름. GUNAME이 비어 있으면 '기타'.
export const guOf = (row) => String(row.GUNAME ?? '').trim() || OTHER_GU;

export function matches(row, { gu = '', date = '', freeOnly = false } = {}) {
  if (gu && guOf(row) !== gu) return false;
  if (freeOnly && !isFree(row)) return false;
  if (date) {
    const { start, end } = eventDates(row);
    if (!(start <= date && date <= end)) return false;
  }
  return true;
}

export const filterEvents = (rows, conditions) => rows.filter((row) => matches(row, conditions));

export const isFiltered = ({ gu = '', date = '', freeOnly = false } = {}) => Boolean(gu || date || freeOnly);

// 구 목록: 가나다순, '기타'는 맨 끝. 전체 데이터 기준 건수.
export function guCounts(rows) {
  const counts = new Map();
  for (const row of rows) {
    const gu = guOf(row);
    counts.set(gu, (counts.get(gu) ?? 0) + 1);
  }
  const rank = (gu) => (gu === OTHER_GU ? 1 : 0);
  return [...counts]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, 'ko'))
    .map(([gu, count]) => ({ gu, count }));
}

// 정렬: 종료일이 가까운 순, 같으면 시작일, 그다음 제목. 원본 배열은 바꾸지 않는다.
export function sortEvents(rows) {
  return [...rows].sort((a, b) => {
    const da = eventDates(a), db = eventDates(b);
    return (
      da.end.localeCompare(db.end) ||
      da.start.localeCompare(db.start) ||
      String(a.TITLE ?? '').localeCompare(String(b.TITLE ?? ''), 'ko')
    );
  });
}

export const isHttpUrl = (value) => /^https?:\/\//i.test(String(value ?? '').trim());

// 카드 제목 링크 대상: HMPG_ADDR, 없거나 http(s)가 아니면 ORG_LINK, 그것도 아니면 null.
export function linkOf(row) {
  for (const candidate of [row.HMPG_ADDR, row.ORG_LINK]) {
    if (isHttpUrl(candidate)) return candidate.trim();
  }
  return null;
}

// 종료일이 2099년 이후 같은 비정상 값인가.
export function isOpenEnded(row) {
  const year = Number(eventDates(row).end.slice(0, 4));
  return Number.isFinite(year) && year >= OPEN_ENDED_YEAR;
}

export function periodText(row) {
  const { start, end } = eventDates(row);
  if (isOpenEnded(row)) return `${start} ~ 상시`;
  return start === end ? start : `${start} ~ ${end}`;
}

export function feeText(row) {
  const fee = String(row.USE_FEE ?? '').trim();
  if (fee) return fee;
  return isFree(row) ? '무료' : '요금 정보 없음';
}

// 사진 대체 그림(public/fallback/<이름>.jpg). 분류(CODENAME)에 맞추고, 매핑이 없으면 행사 키로 결정적으로 고른다.
export const FALLBACKS = ['concert', 'gallery', 'workshop', 'festival', 'theater', 'gugak', 'film', 'classical'];
const FALLBACK_BY_CODE = {
  '콘서트': 'concert',
  '클래식': 'classical',
  '뮤지컬/오페라': 'theater',
  '연극': 'theater',
  '무용': 'theater',
  '국악': 'gugak',
  '영화': 'film',
  '전시/미술': 'gallery',
  '교육/체험': 'workshop',
};

export function fallbackName(row) {
  const code = String(row.CODENAME ?? '');
  if (FALLBACK_BY_CODE[code]) return FALLBACK_BY_CODE[code];
  if (code.startsWith('축제')) return 'festival';
  const key = `${row.TITLE ?? ''}${row.STRTDATE ?? ''}`;
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return FALLBACKS[hash % FALLBACKS.length];
}
