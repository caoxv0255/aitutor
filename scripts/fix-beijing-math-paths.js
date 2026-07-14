import { getDb } from '../api/core/db.js';

const updates = [
  { year: 2008, path: '2. 北京高考数学2008-2025/2008年北京高考数学试卷（理科）（原卷版）.doc' },
  { year: 2009, path: '2. 北京高考数学2008-2025/2009年北京高考数学试卷（理科）（原卷版）.doc' },
  { year: 2011, path: '2. 北京高考数学2008-2025/2011年北京高考数学试卷（理科）（原卷版）.doc' },
  { year: 2019, path: '2. 北京高考数学2008-2025/2019年北京高考数学试卷（理科）（原卷版）.doc' },
];

const db = await getDb();
for (const u of updates) {
  const res = await db.query(
    `UPDATE exam_papers SET paper_file_path = $1
     WHERE province_code = 'beijing' AND year = $2 AND subject = 'math'
     AND exam_level = 'gaokao' AND math_type = 'science'`,
    [u.path, u.year]
  );
  console.log(`${u.year} science: ${res.rowCount} row updated`);
}
process.exit(0);
