/** Infer legacy NPTEL subject departments from the first three digits of a
 * nine-digit course code. Offline metadata only; never reads or edits media.
 * IMPORTANT: A department inference is NOT college approval or title verification.
 * Source: historical NPTEL subject-code/discipline catalogue (2019).
 * Run: node --env-file=.env.local scripts/map-nptel-departments.mjs
 */
import pg from 'pg';
const map = new Map(Object.entries({
 '101':'Aerospace Engineering','102':'Biotechnology','103':'Chemical Engineering',
 '104':'Chemistry and Biochemistry','105':'Civil Engineering',
 '106':'Computer Science and Engineering','107':'Engineering Design',
 '108':'Electrical Engineering','109':'Humanities and Social Sciences',
 '110':'Management','111':'Mathematics','112':'Mechanical Engineering',
 '113':'Metallurgy and Material Science','114':'Ocean Engineering',
 '115':'Physics','116':'Textile Engineering',
 '117':'Electronics and Communication Engineering','118':'Nanotechnology',
 '119':'Atmospheric Science','121':'General','122':'Basic Courses',
 '123':'Mining Engineering','124':'Architecture','126':'Agriculture',
 '127':'Multi-Disciplinary','128':'Special Lecture Series'
}));
if(!process.env.DATABASE_URL) throw Error('Set DATABASE_URL in .env.local');
const db = new pg.Client({connectionString: process.env.DATABASE_URL});
await db.connect();
try {
  const rows = await db.query("SELECT DISTINCT course_code FROM resources WHERE availability='available' AND course_code ~ '^[0-9]{9}$'");
  let mapped=0,unknown=0,preserved=0;
  await db.query('BEGIN');
  try {
    for (const {course_code:code} of rows.rows) {
      const dept=map.get(code.slice(0,3));
      if(!dept){unknown++;continue}
      const out=await db.query(
        "INSERT INTO course_catalog(course_code,title,department,title_source,verified) VALUES($1,$2,$3,'nptel-discipline-prefix-inferred',FALSE) "+
        "ON CONFLICT(course_code) DO UPDATE SET department=EXCLUDED.department,updated_at=now() "+
        "WHERE course_catalog.verified=FALSE AND course_catalog.department IN ('Unclassified','General','') RETURNING course_code",
        [code,'Course '+code,dept]);
      if(out.rowCount)mapped++;else preserved++;
    }
    await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e}
  console.log(JSON.stringify({distinct_codes:rows.rowCount,mapped_or_updated:mapped,unknown_prefix:unknown,pre_existing_metadata_preserved:preserved}));
  console.log('Department suggestions only. Course title verification and college publication approvals remain separate.');
} finally { await db.end() }
