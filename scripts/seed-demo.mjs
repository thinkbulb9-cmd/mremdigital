import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
const root=path.resolve('local-demo-storage');
const tree={
 'Aerospace Engineering/Aerodynamics/Lecture Notes.txt':'Aerodynamics NPTEL lecture 01. This is synthetic demonstration content.',
 'Aerospace Engineering/Aerodynamics/Question Bank.txt':'Sample questions for demonstration only.',
 'Mechanical Engineering/Thermodynamics/Thermo Basics.txt':'Thermodynamics sample notes for demo.',
 'Computer Science/Algorithms/Sorting Notes.txt':'Algorithms course demonstration notes.',
 'AI and Machine Learning/Neural Networks/Introduction.txt':'Introductory neural networks sample for the MREM library.'
};
for(const [relative,content] of Object.entries(tree)) {
 const file=path.join(root,...relative.split('/')); await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,content);
}
const db=new pg.Client({connectionString:process.env.DATABASE_URL}); await db.connect();
try {await db.query(`INSERT INTO storage_sources(id,name,root_path) VALUES($1,$2,$3)
 ON CONFLICT(id) DO UPDATE SET root_path=EXCLUDED.root_path,name=EXCLUDED.name,enabled=TRUE`,['demo','MREM Sample Library',root]);}
finally {await db.end();}
console.log('Created 5 harmless sample files in',root,'; run npm run scan');
