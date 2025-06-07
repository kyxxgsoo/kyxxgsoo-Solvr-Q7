import { FastifyInstance } from 'fastify';
import * as path from 'path';
import * as fs from 'fs';
import { parse } from '@fast-csv/parse';

interface Release {
  tag_name: string;
  published_at: string;
  html_url: string;
  name: string | null;
}

interface ReleaseData {
  Repo: string;
  'Tag Name': string;
  'Release Name': string | null;
  'Published At': string;
  Year: number;
  Month: number;
  Day: number;
  Week: number;
  Date: string;
  'Is Weekend': boolean;
  URL: string;
}

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

async function readCsv<T>(filePath: string): Promise<T[]> {
  const records: T[] = [];
  const csvStream = fs.createReadStream(filePath)
    .pipe(parse({ headers: true, skipRows: 0 }));

  for await (const record of csvStream) {
    records.push(record as T);
  }
  return records;
}

export const dashboardRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/api/dashboard/release-stats', async (request, reply) => {
    try {
      const rawCsvPath = path.resolve(__dirname, '../../data/release_raw_data.csv');
      const allParsedReleases: ReleaseData[] = [];

      // CSV 파일에서 데이터 읽기
      const csvData = await readCsv<any>(rawCsvPath);

      csvData.forEach(release => {
        const date = new Date(release['Published At']);
        const isWeekend = release['Is Weekend'] === 'TRUE'; // CSV에서는 문자열로 저장됨

        allParsedReleases.push({
          Repo: release.Repo,
          'Tag Name': release['Tag Name'],
          'Release Name': release['Release Name'],
          'Published At': release['Published At'],
          Year: parseInt(release.Year),
          Month: parseInt(release.Month),
          Day: parseInt(release.Day),
          Week: parseInt(release.Week),
          Date: release.Date,
          'Is Weekend': isWeekend,
          URL: release.URL,
        });
      });

      // 월별 릴리즈 수 집계
      const monthlyReleases = allParsedReleases.reduce((acc: { [key: string]: number }, curr) => {
        const key = `${curr.Year}-${String(curr.Month).padStart(2, '0')}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const monthlyData = Object.entries(monthlyReleases).map(([date, count]) => ({
        date,
        count,
      }));

      // 저장소별 릴리즈 수 집계
      const repoReleases = allParsedReleases.reduce((acc: { [key: string]: number }, curr) => {
        acc[curr.Repo] = (acc[curr.Repo] || 0) + 1;
        return acc;
      }, {});

      const repoData = Object.entries(repoReleases).map(([name, value]) => ({
        name,
        value,
      }));

      // 주말 vs 평일 릴리즈 비율
      const weekendReleases = allParsedReleases.reduce(
        (acc: { weekend: number; weekday: number }, curr) => {
          if (curr['Is Weekend']) {
            acc.weekend += 1;
          } else {
            acc.weekday += 1;
          }
          return acc;
        },
        { weekend: 0, weekday: 0 }
      );

      const weekendData = [
        { name: 'Weekend', value: weekendReleases.weekend },
        { name: 'Weekday', value: weekendReleases.weekday },
      ];

      reply.send({
        monthlyData,
        repoData,
        weekendData,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      reply.status(500).send({ error: 'Failed to fetch dashboard data' });
    }
  });
}; 