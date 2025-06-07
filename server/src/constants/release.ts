/**
 * GitHub API 관련 상수
 */
export const GITHUB_API = {
    BASE_URL: 'https://api.github.com',
    PER_PAGE: 100,
} as const;

/**
 * 분석 대상 저장소 목록
 */
export const TARGET_REPOS = [
    'daangn/stackflow',
    'daangn/seed-design',
] as const;

/**
 * CSV 파일 관련 상수
 */
export const CSV = {
    HEADERS: {
        RAW: [
            'Repo',
            'Tag Name',
            'Release Name',
            'Published At',
            'Year',
            'Month',
            'Day',
            'Week',
            'Date',
            'Is Weekend',
            'URL',
        ] as string[],
        STATS: ['Metric', 'Value'] as string[],
    },
} as const; 