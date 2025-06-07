import axios from 'axios';
import { format } from '@fast-csv/format';
import { createWriteStream } from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv-safe';
import { GitHubRelease, ReleaseData } from '../src/types/release';
import { getWeekNumber, isWeekend, formatDate } from '../src/utils/dateUtils';
import { GITHUB_API, TARGET_REPOS, CSV } from '../src/constants/release';

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

/**
 * GitHub API에서 모든 릴리즈 데이터를 가져오는 함수
 */
async function fetchAllReleases(owner: string, repo: string): Promise<GitHubRelease[]> {
  let allReleases: GitHubRelease[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await axios.get<GitHubRelease[]>(
        `${GITHUB_API.BASE_URL}/repos/${owner}/${repo}/releases`,
        {
          headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
          },
          params: {
            per_page: GITHUB_API.PER_PAGE,
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

/**
 * 릴리즈 데이터를 가공하는 함수
 */
function processReleaseData(release: GitHubRelease, repoName: string): ReleaseData {
  const date = new Date(release.published_at);
  return {
    repo: repoName,
    tag_name: release.tag_name,
    release_name: release.name,
    published_at: release.published_at,
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    week: getWeekNumber(date),
    date_string: formatDate(date),
    html_url: release.html_url,
    is_weekend: isWeekend(date),
  };
}

/**
 * 통계 데이터를 계산하는 함수
 */
function calculateStats(releases: ReleaseData[]) {
  const workingDayReleases = releases.filter(r => !r.is_weekend);
  const stats: { [key: string]: number | string } = {
    'Total Releases (Working Days)': workingDayReleases.length,
  };

  // 연도별 통계
  const releasesByYear = workingDayReleases.reduce((acc: { [year: number]: number }, curr) => {
    acc[curr.year] = (acc[curr.year] || 0) + 1;
    return acc;
  }, {});

  // 월별 통계
  const releasesByMonth = workingDayReleases.reduce((acc: { [year_month: string]: number }, curr) => {
    const key = `${curr.year}-${String(curr.month).padStart(2, '0')}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  // 주별 통계
  const releasesByWeek = workingDayReleases.reduce((acc: { [year_week: string]: number }, curr) => {
    const key = `${curr.year}-W${String(curr.week).padStart(2, '0')}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  // 일별 통계
  const releasesByDay = workingDayReleases.reduce((acc: { [date_string: string]: number }, curr) => {
    acc[curr.date_string] = (acc[curr.date_string] || 0) + 1;
    return acc;
  }, {});

  // 저장소별 통계
  const releasesByRepo = releases.reduce((acc: { [repo_name: string]: number }, curr) => {
    acc[curr.repo] = (acc[curr.repo] || 0) + 1;
    return acc;
  }, {});

  // 통계 데이터 정렬 및 추가
  Object.entries(releasesByYear)
    .sort(([yearA], [yearB]) => parseInt(yearA) - parseInt(yearB))
    .forEach(([year, count]) => {
      stats[`Releases (Working Days) in ${year}`] = count;
    });

  Object.entries(releasesByMonth)
    .sort()
    .forEach(([yearMonth, count]) => {
      stats[`Releases (Working Days) in ${yearMonth}`] = count;
    });

  Object.entries(releasesByWeek)
    .sort()
    .forEach(([yearWeek, count]) => {
      stats[`Releases (Working Days) in ${yearWeek}`] = count;
    });

  Object.entries(releasesByDay)
    .sort()
    .forEach(([dateString, count]) => {
      stats[`Releases (Working Days) in ${dateString}`] = count;
    });

  Object.entries(releasesByRepo)
    .sort()
    .forEach(([repoName, count]) => {
      stats[`Total Releases for ${repoName}`] = count;
    });

  // 평균 릴리즈 간격 계산
  const sortedDates = workingDayReleases
    .map(r => new Date(r.published_at))
    .sort((a, b) => a.getTime() - b.getTime());

  let totalDaysBetweenReleases = 0;
  for (let i = 1; i < sortedDates.length; i++) {
    const diffTime = Math.abs(sortedDates[i].getTime() - sortedDates[i - 1].getTime());
    totalDaysBetweenReleases += Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  if (sortedDates.length > 1) {
    stats['Average Days Between Working Day Releases'] = (totalDaysBetweenReleases / (sortedDates.length - 1)).toFixed(2);
  } else {
    stats['Average Days Between Working Day Releases'] = 'N/A';
  }

  return stats;
}

async function generateReleaseStats() {
  const allParsedReleases: ReleaseData[] = [];

  console.log('Fetching release data...');
  for (const repoName of TARGET_REPOS) {
    const [owner, repo] = repoName.split('/');
    const releases = await fetchAllReleases(owner, repo);
    console.log(`Fetched ${releases.length} releases for ${repoName}`);

    releases.forEach(release => {
      allParsedReleases.push(processReleaseData(release, repoName));
    });
  }

  console.log('Generating statistics...');
  const stats = calculateStats(allParsedReleases);

  // 통계 데이터 CSV 파일 생성
  const aggregatedCsvPath = path.resolve(__dirname, '../../release_stats.csv');
  console.log(`Writing aggregated statistics to ${aggregatedCsvPath}...`);
  const aggregatedWs = createWriteStream(aggregatedCsvPath);
  const aggregatedCsvStream = format({ headers: CSV.HEADERS.STATS });

  aggregatedCsvStream.pipe(aggregatedWs).on('end', () => console.log('Aggregated statistics CSV file successfully written.'));

  Object.entries(stats).forEach(([metric, value]) => {
    aggregatedCsvStream.write({ Metric: metric, Value: value });
  });
  aggregatedCsvStream.end();

  // Raw 데이터 CSV 파일 생성
  const rawCsvPath = path.resolve(__dirname, '../../release_raw_data.csv');
  console.log(`Writing raw release data to ${rawCsvPath}...`);
  const rawWs = createWriteStream(rawCsvPath);
  const rawCsvStream = format({ headers: CSV.HEADERS.RAW });

  rawCsvStream.pipe(rawWs).on('end', () => console.log('Raw data CSV file successfully written.'));

  allParsedReleases.forEach(release => {
    rawCsvStream.write({
      'Repo': release.repo,
      'Tag Name': release.tag_name,
      'Release Name': release.release_name || '',
      'Published At': release.published_at,
      'Year': release.year,
      'Month': release.month,
      'Day': release.day,
      'Week': release.week,
      'Date': release.date_string,
      'Is Weekend': release.is_weekend ? 'TRUE' : 'FALSE',
      'URL': release.html_url,
    });
  });

  rawCsvStream.end();
}

generateReleaseStats().catch(console.error); 