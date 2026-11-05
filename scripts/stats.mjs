import fs from 'node:fs';

const USER = 'RellZM';
const query = `query($login:String!){user(login:$login){contributionsCollection{
  totalCommitContributions totalIssueContributions
  totalPullRequestContributions totalPullRequestReviewContributions
  contributionCalendar{totalContributions weeks{contributionDays{date contributionCount contributionLevel}}}
}}}`;

const response = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query, variables: { login: USER } }),
});
if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);

const payload = await response.json();
if (payload.errors?.length || !payload.data?.user) {
  throw new Error(payload.errors?.map(({ message }) => message).join('; ') || `User ${USER} not found`);
}

const collection = payload.data.user.contributionsCollection;
const calendar = collection.contributionCalendar;
const colors = {
  NONE: '#20243a',
  FIRST_QUARTILE: '#3b4a8a',
  SECOND_QUARTILE: '#536bc0',
  THIRD_QUARTILE: '#8067ca',
  FOURTH_QUARTILE: '#c4a7ff',
};
const cell = 11;
const gap = 3;
const left = 52;
const top = 43;
let months = '';
let cells = '';
let previousMonth = -1;

calendar.weeks.forEach((week, weekIndex) => {
  const firstDay = new Date(`${week.contributionDays[0].date}T00:00:00Z`);
  if (firstDay.getUTCMonth() !== previousMonth) {
    months += `<text x="${left + weekIndex * (cell + gap)}" y="29" class="muted">${firstDay.toLocaleString('en', { month: 'short', timeZone: 'UTC' })}</text>`;
    previousMonth = firstDay.getUTCMonth();
  }

  for (const day of week.contributionDays) {
    const row = new Date(`${day.date}T00:00:00Z`).getUTCDay();
    const x = left + weekIndex * (cell + gap);
    const y = top + row * (cell + gap);
    cells += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="3" fill="${colors[day.contributionLevel] ?? colors.NONE}"><title>${day.date}: ${day.contributionCount} contributions</title></rect>`;
  }
});

const dayLabels = ['Mon', 'Wed', 'Fri'].map((label, index) =>
  `<text x="10" y="${top + (index * 2 + 1) * (cell + gap) + 9}" class="muted">${label}</text>`,
).join('');

const values = {
  commits: collection.totalCommitContributions,
  issues: collection.totalIssueContributions,
  prs: collection.totalPullRequestContributions,
  reviews: collection.totalPullRequestReviewContributions,
};
const total = Object.values(values).reduce((sum, value) => sum + value, 0);
const percent = (value) => total ? Math.round(value * 100 / total) : 0;
const max = Math.max(...Object.values(values), 1);
const centerX = 690;
const centerY = 292;
const radius = 83;
const reach = (value) => radius * Math.sqrt(value / max);
const points = {
  reviews: [centerX, centerY - reach(values.reviews)],
  issues: [centerX + reach(values.issues), centerY],
  prs: [centerX, centerY + reach(values.prs)],
  commits: [centerX - reach(values.commits), centerY],
};
const polygon = Object.values(points).map((point) => point.join(',')).join(' ');
const dots = Object.values(points).map(([x, y]) =>
  `<circle cx="${x}" cy="${y}" r="4" fill="#10131f" stroke="#c4a7ff" stroke-width="2"/>`,
).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="440" viewBox="0 0 900 440">
<style>
  .muted{fill:#9298b4;font:12px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  .label{fill:#d8daf0;font:600 13px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  .number{fill:#f2eaff;font:700 30px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
</style>
<rect x="1" y="1" width="898" height="438" rx="18" fill="#11131d" stroke="#30344c"/>
<text x="28" y="30" class="label">CONTRIBUTION MAP</text>
${months}${dayLabels}${cells}
<line x1="28" y1="176" x2="872" y2="176" stroke="#30344c"/>
<text x="30" y="211" class="label">LAST 12 MONTHS</text>
<text x="30" y="257" class="number">${calendar.totalContributions.toLocaleString('en-US')}</text>
<text x="30" y="280" class="muted">total contributions</text>
<text x="30" y="326" class="label">ACTIVITY MIX</text>
<text x="30" y="352" class="muted">${values.commits.toLocaleString('en-US')} commits · ${values.issues.toLocaleString('en-US')} issues</text>
<text x="30" y="373" class="muted">${values.prs.toLocaleString('en-US')} pull requests · ${values.reviews.toLocaleString('en-US')} reviews</text>
<line x1="450" y1="195" x2="450" y2="412" stroke="#30344c"/>
<circle cx="${centerX}" cy="${centerY}" r="${radius * .33}" fill="none" stroke="#393d58"/>
<circle cx="${centerX}" cy="${centerY}" r="${radius * .66}" fill="none" stroke="#393d58"/>
<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="#393d58"/>
<line x1="${centerX}" y1="${centerY - radius}" x2="${centerX}" y2="${centerY + radius}" stroke="#454a69"/>
<line x1="${centerX - radius}" y1="${centerY}" x2="${centerX + radius}" y2="${centerY}" stroke="#454a69"/>
<polygon points="${polygon}" fill="#a78bfa" fill-opacity=".22" stroke="#c4a7ff" stroke-width="2"/>
${dots}
<text x="${centerX}" y="${centerY - radius - 15}" text-anchor="middle" class="muted">REVIEWS ${percent(values.reviews)}%</text>
<text x="${centerX}" y="${centerY + radius + 25}" text-anchor="middle" class="muted">PULL REQUESTS ${percent(values.prs)}%</text>
<text x="${centerX - radius - 18}" y="${centerY + 4}" text-anchor="end" class="muted">${percent(values.commits)}% COMMITS</text>
<text x="${centerX + radius + 18}" y="${centerY + 4}" class="muted">${percent(values.issues)}% ISSUES</text>
</svg>`;

fs.mkdirSync('assets', { recursive: true });
fs.writeFileSync('assets/stats.svg', svg);
