import { FastifyInstance } from 'fastify';
import * as path from 'path';
import * as fs from 'fs';
import { parse } from '@fast-csv/parse';
import { ReleaseData, DashboardStats, MonthlyReleaseStats, RepoReleaseStats, WeekendReleaseStats } from '../types/release';
import { isWeekend } from '../utils/dateUtils';

/**
 * CSV 파일에서 데이터를 읽어오는 함수
 */
async function readCsv<T>(filePath: string): Promise<T[]> {
  const records: T[] = [];
  const csvStream = fs.createReadStream(filePath)
    .pipe(parse({ headers: true, skipRows: 0 }));

  for await (const record of csvStream) {
    records.push(record as T);
  }
  return records;
}

/**
 * 월별 릴리즈 통계를 계산하는 함수
 */
function calculateMonthlyStats(releases: ReleaseData[]): MonthlyReleaseStats[] {
  const monthlyReleases = releases.reduce((acc: { [key: string]: number }, curr) => {
    const key = `${curr.year}-${String(curr.month).padStart(2, '0')}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(monthlyReleases)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 저장소별 릴리즈 통계를 계산하는 함수
 */
function calculateRepoStats(releases: ReleaseData[]): RepoReleaseStats[] {
  const repoReleases = releases.reduce((acc: { [key: string]: number }, curr) => {
    acc[curr.repo] = (acc[curr.repo] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(repoReleases)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * 주말/평일 릴리즈 통계를 계산하는 함수
 */
function calculateWeekendStats(releases: ReleaseData[]): WeekendReleaseStats[] {
  const weekendReleases = releases.reduce(
    (acc: { weekend: number; weekday: number }, curr) => {
      if (curr.is_weekend) {
        acc.weekend += 1;
      } else {
        acc.weekday += 1;
      }
      return acc;
    },
    { weekend: 0, weekday: 0 }
  );

  return [
    { name: 'Weekend', value: weekendReleases.weekend },
    { name: 'Weekday', value: weekendReleases.weekday },
  ];
}

export const dashboardRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/release-stats', async (request, reply) => {
    try {
      const rawCsvPath = path.resolve(__dirname, '../../data/release_raw_data.csv');
      const allParsedReleases: ReleaseData[] = [];

      // CSV 파일에서 데이터 읽기
      const csvData = await readCsv<any>(rawCsvPath);

      // CSV 데이터를 ReleaseData 형식으로 변환
      csvData.forEach(release => {
        const date = new Date(release['Published At']);
        allParsedReleases.push({
          repo: release.Repo,
          tag_name: release['Tag Name'],
          release_name: release['Release Name'],
          published_at: release['Published At'],
          year: parseInt(release.Year),
          month: parseInt(release.Month),
          day: parseInt(release.Day),
          week: parseInt(release.Week),
          date_string: release.Date,
          is_weekend: release['Is Weekend'] === 'TRUE',
          html_url: release.URL,
        });
      });

      // 통계 데이터 계산
      const dashboardStats: DashboardStats = {
        monthlyData: calculateMonthlyStats(allParsedReleases),
        repoData: calculateRepoStats(allParsedReleases),
        weekendData: calculateWeekendStats(allParsedReleases),
      };

      reply.send(dashboardStats);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      reply.status(500).send({ error: 'Failed to fetch dashboard data' });
    }
  });
}; 