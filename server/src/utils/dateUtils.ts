/**
 * ISO 주차 계산 (주 일요일 시작)
 * @param date 계산할 날짜
 * @returns ISO 주차 번호
 */
export function getWeekNumber(date: Date): number {
    // 원본 Date 객체를 수정하지 않기 위해 복사
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // 가장 가까운 목요일로 설정: 현재 날짜 + 4 - 현재 요일 (일요일을 7로)
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    // 연도의 첫째 날 가져오기
    const yearStart = new Date(Date.UTC(d.getFullYear(), 0, 1));
    // 가장 가까운 목요일까지의 전체 주차 계산
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * 날짜가 주말인지 확인
 * @param date 확인할 날짜
 * @returns 주말 여부
 */
export function isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
}

/**
 * 날짜를 YYYY-MM-DD 형식의 문자열로 변환
 * @param date 변환할 날짜
 * @returns YYYY-MM-DD 형식의 문자열
 */
export function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
} 