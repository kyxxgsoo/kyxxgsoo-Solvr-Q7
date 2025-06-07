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
  name: string | null;
  is_weekend: boolean;
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
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

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
        name: release.name,
        is_weekend: isWeekend,
      });
    }
  }

  console.log('Generating statistics...');

  const releasesForStats = allParsedReleases.filter(r => !r.is_weekend);

  const stats: { [key: string]: number | string } = {
    'Total Releases (Working Days)': releasesForStats.length,
  };
  const releasesByYear: { [year: number]: number } = {};
  const releasesByMonth: { [year_month: string]: number } = {};
  const releasesByWeek: { [year_week: string]: number } = {};
  const releasesByDay: { [date_string: string]: number } = {};
  const releasesByRepo: { [repo_name: string]: number } = {};

  const sortedWorkingDayReleaseDates: Date[] = releasesForStats
    .map(r => new Date(r.published_at))
    .sort((a, b) => a.getTime() - b.getTime());

  for (const release of releasesForStats) {
    releasesByYear[release.year] = (releasesByYear[release.year] || 0) + 1;

    const yearMonth = `${release.year}-${String(release.month).padStart(2, '0')}`;
    releasesByMonth[yearMonth] = (releasesByMonth[yearMonth] || 0) + 1;

    const yearWeek = `${release.year}-W${String(release.week).padStart(2, '0')}`;
    releasesByWeek[yearWeek] = (releasesByWeek[yearWeek] || 0) + 1;

    releasesByDay[release.date_string] = (releasesByDay[release.date_string] || 0) + 1;
  }

  for (const release of allParsedReleases) {
    releasesByRepo[release.repo] = (releasesByRepo[release.repo] || 0) + 1;
  }

  Object.entries(releasesByYear).sort(([yearA], [yearB]) => parseInt(yearA) - parseInt(yearB)).forEach(([year, count]) => {
    stats[`Releases (Working Days) in ${year}`] = count;
  });

  Object.entries(releasesByMonth).sort().forEach(([yearMonth, count]) => {
    stats[`Releases (Working Days) in ${yearMonth}`] = count;
  });

  Object.entries(releasesByWeek).sort().forEach(([yearWeek, count]) => {
    stats[`Releases (Working Days) in ${yearWeek}`] = count;
  });

  Object.entries(releasesByDay).sort().forEach(([dateString, count]) => {
    stats[`Releases (Working Days) in ${dateString}`] = count;
  });

  Object.entries(releasesByRepo).sort().forEach(([repoName, count]) => {
    stats[`Total Releases for ${repoName}`] = count;
  });

  let totalDaysBetweenReleases = 0;
  for (let i = 1; i < sortedWorkingDayReleaseDates.length; i++) {
    const diffTime = Math.abs(sortedWorkingDayReleaseDates[i].getTime() - sortedWorkingDayReleaseDates[i - 1].getTime());
    totalDaysBetweenReleases += Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  if (sortedWorkingDayReleaseDates.length > 1) {
    stats['Average Days Between Working Day Releases'] = (totalDaysBetweenReleases / (sortedWorkingDayReleaseDates.length - 1)).toFixed(2);
  } else {
    stats['Average Days Between Working Day Releases'] = 'N/A';
  }

  const aggregatedCsvPath = path.resolve(__dirname, '../../release_stats.csv');
  console.log(`Writing aggregated statistics to ${aggregatedCsvPath}...`);
  const aggregatedWs = createWriteStream(aggregatedCsvPath);
  const aggregatedCsvStream = format({ headers: true });

  aggregatedCsvStream.pipe(aggregatedWs).on('end', () => console.log('Aggregated statistics CSV file successfully written.'));

  aggregatedCsvStream.write({ Metric: 'Total Releases (Working Days)', Value: stats['Total Releases (Working Days)'] });
  Object.entries(stats).forEach(([metric, value]) => {
    if (metric !== 'Total Releases (Working Days)') {
      aggregatedCsvStream.write({ Metric: metric, Value: value });
    }
  });
  aggregatedCsvStream.end();

  const rawCsvPath = path.resolve(__dirname, '../../release_raw_data.csv');
  console.log(`Writing raw release data to ${rawCsvPath}...`);
  const rawWs = createWriteStream(rawCsvPath);
  const rawCsvStream = format({
    headers: [
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
    ],
  });

  rawCsvStream.pipe(rawWs).on('end', () => console.log('Raw data CSV file successfully written.'));

  allParsedReleases.forEach(release => {
    rawCsvStream.write({
      'Repo': release.repo,
      'Tag Name': release.tag_name,
      'Release Name': release.name || '',
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

generateReleaseStats(); 