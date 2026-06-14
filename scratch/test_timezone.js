const baseDate = new Date('2026-06-18');
baseDate.setHours(0,0,0,0);
const nextDueDateObj = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
const tzoffset = nextDueDateObj.getTimezoneOffset() * 60000;
const localISOTime = new Date(nextDueDateObj.getTime() - tzoffset).toISOString().split('T')[0];
console.log("Local ISO string:", localISOTime);
console.log("Original ISO string:", nextDueDateObj.toISOString().split('T')[0]);
