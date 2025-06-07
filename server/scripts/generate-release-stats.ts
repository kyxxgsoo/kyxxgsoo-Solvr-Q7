import axios from 'axios';
import { format } from '@fast-csv/format';
import { createWriteStream } from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv-safe';

// 헬퍼 함수: ISO 주차 계산 (주 일요일 시작)
function getWeekNumber(d: Date): number {
    // 원본 Date 객체를 수정하지 않기 위해 복사
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // 가장 가까운 목요일로 설정: 현재 날짜 + 4 - 현재 요일 (일요일을 7로)
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    // 연도의 첫째 날 가져오기
    const yearStart = new Date(Date.UTC(d.getFullYear(), 0, 1));
    // 가장 가까운 목요일까지의 전체 주차 계산
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
}

// .env 파일 로드 (server/.env 경로)
dotenv.config({
  path: path.resolve(__dirname, '../../server/.env'),
  example: path.resolve(__dirname, '../../server/.env.example'),
});

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error('환경 변수 GITHUB_TOKEN이 설정되지 않았습니다.');
  process.exit(1);
}

interface Release {
  tag_name: string;
  published_at: string;
  html_url: string;
  name: string | null;
}

interface ReleaseData {
  repo: string;
  tag_name: string;
  published_at: string;
  year: number;
  month: number;
  day: number;
  week: number;
  date_string: string;
  html_url: string;
}

const REPOS = [
  'daangn/stackflow',
  'daangn/seed-design',
];

async function fetchAllReleases(owner: string, repo: string): Promise<Release[]> {
  let allReleases: Release[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await axios.get<Release[]>(
        `https://api.github.com/repos/${owner}/${repo}/releases`,
        {
          headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
          },
          params: {
            per_page: 100, // 한 페이지에 100개씩 가져오기 (최대)
            page: page,
          },
        }
      );

      if (response.data.length === 0) {
        hasMore = false;
      } else {
        allReleases = allReleases.concat(response.data);
        page++;
      }
    } catch (error: any) {
      console.error(`Error fetching releases for ${owner}/${repo} (page ${page}):`, error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      }
      hasMore = false; // 에러 발생 시 중단
    }
  }
  return allReleases;
}

async function generateReleaseStats() {
  const allParsedReleases: ReleaseData[] = [];

  console.log('Fetching release data...');
  for (const repoName of REPOS) {
    const [owner, repo] = repoName.split('/');
    const releases = await fetchAllReleases(owner, repo);
    console.log(`Fetched ${releases.length} releases for ${repoName}`);

    for (const release of releases) {
      const date = new Date(release.published_at);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const week = getWeekNumber(date);
      const date_string = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      allParsedReleases.push({
        repo: repoName,
        tag_name: release.tag_name,
        published_at: release.published_at,
        year: year,
        month: month,
        day: day,
        week: week,
        date_string: date_string,
        html_url: release.html_url,
      });
    }
  }

  console.log('Generating statistics...');
  const stats: { [key: string]: number | string } = {
    'Total Releases': allParsedReleases.length,
  };
  const releasesByYear: { [year: number]: number } = {};
  const releasesByMonth: { [year_month: string]: number } = {};
  const releasesByWeek: { [year_week: string]: number } = {};
  const releasesByDay: { [date_string: string]: number } = {};
  const releasesByRepo: { [repo_name: string]: number } = {};

  const sortedReleaseDates: Date[] = allParsedReleases
    .map(r => new Date(r.published_at))
    .sort((a, b) => a.getTime() - b.getTime());

  for (const release of allParsedReleases) {
    // 연간 통계
    releasesByYear[release.year] = (releasesByYear[release.year] || 0) + 1;

    // 월간 통계 (YYYY-MM)
    const yearMonth = `${release.year}-${String(release.month).padStart(2, '0')}`;
    releasesByMonth[yearMonth] = (releasesByMonth[yearMonth] || 0) + 1;

    // 주간 통계 (YYYY-WXX)
    const yearWeek = `${release.year}-W${String(release.week).padStart(2, '0')}`;
    releasesByWeek[yearWeek] = (releasesByWeek[yearWeek] || 0) + 1;

    // 일간 통계 (YYYY-MM-DD)
    releasesByDay[release.date_string] = (releasesByDay[release.date_string] || 0) + 1;

    // 저장소별 통계
    releasesByRepo[release.repo] = (releasesByRepo[release.repo] || 0) + 1;
  }

  // 연간 통계를 stats에 추가
  Object.entries(releasesByYear).sort(([yearA], [yearB]) => parseInt(yearA) - parseInt(yearB)).forEach(([year, count]) => {
    stats[`Releases in ${year}`] = count;
  });

  // 월간 통계를 stats에 추가
  Object.entries(releasesByMonth).sort().forEach(([yearMonth, count]) => {
    stats[`Releases in ${yearMonth}`] = count;
  });

  // 주간 통계를 stats에 추가
  Object.entries(releasesByWeek).sort().forEach(([yearWeek, count]) => {
    stats[`Releases in ${yearWeek}`] = count;
  });

  // 일간 통계를 stats에 추가
  Object.entries(releasesByDay).sort().forEach(([dateString, count]) => {
    stats[`Releases in ${dateString}`] = count;
  });

  // 저장소별 통계를 stats에 추가
  Object.entries(releasesByRepo).sort().forEach(([repoName, count]) => {
    stats[`Total Releases for ${repoName}`] = count;
  });

  // 평균 릴리즈 간격 계산 (일수)
  let totalDaysBetweenReleases = 0;
  for (let i = 1; i < sortedReleaseDates.length; i++) {
    const diffTime = Math.abs(sortedReleaseDates[i].getTime() - sortedReleaseDates[i - 1].getTime());
    totalDaysBetweenReleases += Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // 밀리초를 일수로 변환
  }
  if (sortedReleaseDates.length > 1) {
    stats['Average Days Between Releases'] = (totalDaysBetweenReleases / (sortedReleaseDates.length - 1)).toFixed(2);
  } else {
    stats['Average Days Between Releases'] = 'N/A';
  }

  const csvPath = path.resolve(__dirname, '../../release_stats.csv'); // 프로젝트 루트에 저장

  console.log(`Writing statistics to ${csvPath}...`);
  const ws = createWriteStream(csvPath);
  const csvStream = format({ headers: true });

  csvStream.pipe(ws).on('end', () => console.log('CSV file successfully written.'));

  // CSV에 통계 데이터 쓰기
  csvStream.write({ Metric: 'Total Releases', Value: stats['Total Releases'] });
  Object.entries(stats).forEach(([metric, value]) => {
    if (metric !== 'Total Releases') {
      csvStream.write({ Metric: metric, Value: value });
    }
  });

  // 개별 릴리즈 데이터도 CSV에 추가 (선택 사항)
  // csvStream.write({}); // 빈 줄 추가 또는 구분
  // csvStream.write({ Metric: '--- Individual Releases ---', Value: '' });
  // csvStream.write({ Metric: 'Repo', Value: 'Tag Name', Other: 'Published At', URL: 'URL' }); // 헤더 추가
  // allParsedReleases.forEach(release => {
  //   csvStream.write({
  //     Metric: release.repo,
  //     Value: release.tag_name,
  //     Other: release.published_at,
  //     URL: release.html_url
  //   });
  // });

  csvStream.end();
}

generateReleaseStats(); 