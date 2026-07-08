import { describe, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Diff Logs', () => {
  it('diffs old and new values in logs', () => {
    const dataPath = path.join('/Users/karthikmac/Documents/GitHub/ThirumalaGroup-IT/scratch', 'loan_data_output.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    
    data.logs.forEach((log: any, idx: number) => {
      console.log(`\n=== Log ${idx + 1} (${log.edited_by} @ ${log.edited_at}) ===`);
      const oldVal = log.old_values;
      const newVal = log.new_values;
      const diff: any = {};
      
      const allKeys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
      allKeys.forEach((key: any) => {
        if (JSON.stringify(oldVal[key]) !== JSON.stringify(newVal[key])) {
          diff[key] = {
            old: oldVal[key],
            new: newVal[key]
          };
        }
      });
      console.log(JSON.stringify(diff, null, 2));
    });
  });
});
