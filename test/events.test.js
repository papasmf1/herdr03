import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isFree, matches, filterEvents, guCounts, guOf, sortEvents, linkOf, periodText, feeText,
  fallbackName, FALLBACKS, isFiltered,
} from '../public/events.js';

const row = (o = {}) => ({
  TITLE: 't', GUNAME: '종로구', IS_FREE: '유료', STRTDATE: '2026-11-10 00:00:00.0', END_DATE: '2026-11-20 00:00:00.0',
  USE_FEE: '', HMPG_ADDR: '', ORG_LINK: '', CODENAME: '콘서트', ...o,
});

test('무료 판별은 IS_FREE만 본다', () => {
  assert.equal(isFree(row({ IS_FREE: '무료', USE_FEE: '30,000원' })), true);
  assert.equal(isFree(row({ IS_FREE: '유료', USE_FEE: '무료' })), false);
});

test('구 필터와 기타(빈 GUNAME)', () => {
  const rows = [row({ GUNAME: '강동구' }), row({ GUNAME: '' }), row({ GUNAME: undefined }), row({ GUNAME: '종로구' })];
  assert.equal(guOf(rows[1]), '기타');
  assert.equal(filterEvents(rows, { gu: '기타' }).length, 2);
  assert.equal(filterEvents(rows, { gu: '강동구' }).length, 1);
  assert.equal(filterEvents(rows, { gu: '' }).length, 4);
});

test('guCounts: 가나다순, 기타는 맨 끝, 빈 value 없음', () => {
  const rows = [row({ GUNAME: '종로구' }), row({ GUNAME: '' }), row({ GUNAME: '강동구' }), row({ GUNAME: '종로구' })];
  assert.deepEqual(guCounts(rows), [
    { gu: '강동구', count: 1 }, { gu: '종로구', count: 2 }, { gu: '기타', count: 1 },
  ]);
});

test('날짜 경계: 시작일·종료일 당일 포함, 전날·다음날 제외', () => {
  const r = row();
  assert.equal(matches(r, { date: '2026-11-10' }), true);
  assert.equal(matches(r, { date: '2026-11-20' }), true);
  assert.equal(matches(r, { date: '2026-11-09' }), false);
  assert.equal(matches(r, { date: '2026-11-21' }), false);
  assert.equal(matches(r, { date: '' }), true);
});

test('필터 조합은 AND', () => {
  const rows = [
    row({ TITLE: 'a', GUNAME: '강동구', IS_FREE: '무료' }),
    row({ TITLE: 'b', GUNAME: '강동구', IS_FREE: '유료' }),
    row({ TITLE: 'c', GUNAME: '종로구', IS_FREE: '무료' }),
    row({ TITLE: 'd', GUNAME: '강동구', IS_FREE: '무료', STRTDATE: '2026-12-01 00:00:00.0', END_DATE: '2026-12-02 00:00:00.0' }),
  ];
  const out = filterEvents(rows, { gu: '강동구', freeOnly: true, date: '2026-11-15' });
  assert.deepEqual(out.map((r) => r.TITLE), ['a']);
  assert.equal(isFiltered({}), false);
  assert.equal(isFiltered({ freeOnly: true }), true);
});

test('정렬: 종료일 → 시작일 → 제목, 원본 불변', () => {
  const rows = [
    row({ TITLE: 'c', END_DATE: '2026-12-01 00:00:00.0' }),
    row({ TITLE: 'b', END_DATE: '2026-11-20 00:00:00.0', STRTDATE: '2026-11-12 00:00:00.0' }),
    row({ TITLE: 'a', END_DATE: '2026-11-20 00:00:00.0', STRTDATE: '2026-11-12 00:00:00.0' }),
    row({ TITLE: 'z', END_DATE: '2026-11-20 00:00:00.0', STRTDATE: '2026-11-01 00:00:00.0' }),
    row({ TITLE: 'open', END_DATE: '2626-08-08 00:00:00.0' }),
  ];
  const before = rows.map((r) => r.TITLE).join();
  assert.deepEqual(sortEvents(rows).map((r) => r.TITLE), ['z', 'a', 'b', 'c', 'open']);
  assert.equal(rows.map((r) => r.TITLE).join(), before);
});

test('링크 선택: HMPG_ADDR → ORG_LINK → null, http(s)만', () => {
  assert.equal(linkOf(row({ HMPG_ADDR: 'https://a.kr', ORG_LINK: 'https://b.kr' })), 'https://a.kr');
  assert.equal(linkOf(row({ HMPG_ADDR: '', ORG_LINK: ' https://b.kr ' })), 'https://b.kr');
  assert.equal(linkOf(row({ HMPG_ADDR: 'javascript:alert(1)', ORG_LINK: 'http://b.kr' })), 'http://b.kr');
  assert.equal(linkOf(row({ HMPG_ADDR: 'javascript:alert(1)', ORG_LINK: 'ftp://x' })), null);
  assert.equal(linkOf(row()), null);
});

test('기간 표시: 하루/범위/상시', () => {
  assert.equal(periodText(row({ END_DATE: '2026-11-10 00:00:00.0' })), '2026-11-10');
  assert.equal(periodText(row()), '2026-11-10 ~ 2026-11-20');
  assert.equal(periodText(row({ END_DATE: '2099-12-31 00:00:00.0' })), '2026-11-10 ~ 상시');
  assert.equal(periodText(row({ END_DATE: '2626-08-08 00:00:00.0' })), '2026-11-10 ~ 상시');
  assert.equal(periodText(row({ END_DATE: '2098-12-31 00:00:00.0' })), '2026-11-10 ~ 2098-12-31');
});

test('요금 표시', () => {
  assert.equal(feeText(row({ USE_FEE: '전석 50,000원' })), '전석 50,000원');
  assert.equal(feeText(row({ IS_FREE: '무료' })), '무료');
  assert.equal(feeText(row()), '요금 정보 없음');
});

test('대체 그림: 분류별, 결정적, 항상 존재하는 파일 이름', () => {
  assert.equal(fallbackName(row({ CODENAME: '국악' })), 'gugak');
  assert.equal(fallbackName(row({ CODENAME: '축제-자연/경관' })), 'festival');
  const r = row({ CODENAME: '기타', TITLE: 'x' });
  assert.equal(fallbackName(r), fallbackName({ ...r }));
  assert.ok(FALLBACKS.includes(fallbackName(r)));
});
