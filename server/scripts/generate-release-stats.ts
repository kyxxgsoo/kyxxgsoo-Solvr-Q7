import axios from 'axios';
import { format } from '@fast-csv/format';
import { createWriteStream } from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv-safe';

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
      allParsedReleases.push({
        repo: repoName,
        tag_name: release.tag_name,
        published_at: release.published_at,
        year: date.getFullYear(),
        month: date.getMonth() + 1, // 월은 0부터 시작하므로 +1
        day: date.getDate(),
        html_url: release.html_url,
      });
    }
  }

  console.log('Generating statistics...');
  const stats: { [key: string]: number } = {
    'Total Releases': allParsedReleases.length,
  };
  const releasesByYear: { [year: number]: number } = {};
  const releasesByMonth: { [year_month: string]: number } = {};

  for (const release of allParsedReleases) {
    // 연간 통계
    releasesByYear[release.year] = (releasesByYear[release.year] || 0) + 1;

    // 월간 통계 (YYYY-MM)
    const yearMonth = `${release.year}-${String(release.month).padStart(2, '0')}`;
    releasesByMonth[yearMonth] = (releasesByMonth[yearMonth] || 0) + 1;
  }

  // 연간 통계를 stats에 추가
  Object.entries(releasesByYear).sort(([yearA], [yearB]) => parseInt(yearA) - parseInt(yearB)).forEach(([year, count]) => {
    stats[`Releases in ${year}`] = count;
  });

  // 월간 통계를 stats에 추가
  Object.entries(releasesByMonth).sort().forEach(([yearMonth, count]) => {
    stats[`Releases in ${yearMonth}`] = count;
  });

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