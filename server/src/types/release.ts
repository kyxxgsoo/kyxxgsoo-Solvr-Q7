/**
 * GitHub API에서 받아오는 릴리즈 데이터 타입
 */
export interface GitHubRelease {
    tag_name: string;
    published_at: string;
    html_url: string;
    name: string | null;
}

/**
 * 가공된 릴리즈 데이터 타입
 */
export interface ReleaseData {
    repo: string;
    tag_name: string;
    release_name: string | null;
    published_at: string;
    year: number;
    month: number;
    day: number;
    week: number;
    date_string: string;
    html_url: string;
    is_weekend: boolean;
}

/**
 * 월별 릴리즈 통계 데이터 타입
 */
export interface MonthlyReleaseStats {
    date: string;
    count: number;
}

/**
 * 저장소별 릴리즈 통계 데이터 타입
 */
export interface RepoReleaseStats {
    name: string;
    value: number;
}

/**
 * 주말/평일 릴리즈 통계 데이터 타입
 */
export interface WeekendReleaseStats {
    name: string;
    value: number;
}

/**
 * 대시보드 API 응답 데이터 타입
 */
export interface DashboardStats {
    monthlyData: MonthlyReleaseStats[];
    repoData: RepoReleaseStats[];
    weekendData: WeekendReleaseStats[];
} 