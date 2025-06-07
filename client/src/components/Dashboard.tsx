import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface ReleaseData {
  Repo: string;
  'Tag Name': string;
  'Release Name': string;
  'Published At': string;
  Year: string;
  Month: string;
  Day: string;
  Week: string;
  Date: string;
  'Is Weekend': string;
  URL: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function Dashboard() {
  const [data, setData] = useState<ReleaseData[]>([]);

  useEffect(() => {
    fetch('/release_raw_data.csv')
      .then((response) => response.text())
      .then((text) => {
        const rows = text.split('\n').slice(1); // Skip header
        const parsedData = rows
          .filter((row) => row.trim())
          .map((row) => {
            const [
              Repo,
              TagName,
              ReleaseName,
              PublishedAt,
              Year,
              Month,
              Day,
              Week,
              Date,
              IsWeekend,
              URL,
            ] = row.split(',');
            return {
              Repo,
              'Tag Name': TagName,
              'Release Name': ReleaseName,
              'Published At': PublishedAt,
              Year,
              Month,
              Day,
              Week,
              Date,
              'Is Weekend': IsWeekend,
              URL,
            };
          });
        setData(parsedData);
      });
  }, []);

  // 월별 릴리즈 수 집계
  const monthlyReleases = data.reduce((acc: { [key: string]: number }, curr) => {
    const key = `${curr.Year}-${curr.Month}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const monthlyData = Object.entries(monthlyReleases).map(([date, count]) => ({
    date,
    count,
  }));

  // 저장소별 릴리즈 수 집계
  const repoReleases = data.reduce((acc: { [key: string]: number }, curr) => {
    acc[curr.Repo] = (acc[curr.Repo] || 0) + 1;
    return acc;
  }, {});

  const repoData = Object.entries(repoReleases).map(([name, value]) => ({
    name,
    value,
  }));

  // 주말 vs 평일 릴리즈 비율
  const weekendReleases = data.reduce(
    (acc: { weekend: number; weekday: number }, curr) => {
      if (curr['Is Weekend'] === 'TRUE') {
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

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">릴리즈 통계 대시보드</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 월별 릴리즈 추이 */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">월별 릴리즈 추이</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#8884d8"
                  name="릴리즈 수"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 저장소별 릴리즈 수 */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">저장소별 릴리즈 수</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={repoData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#82ca9d" name="릴리즈 수" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 주말 vs 평일 릴리즈 비율 */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">주말 vs 평일 릴리즈 비율</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={weekendData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {weekendData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
} 