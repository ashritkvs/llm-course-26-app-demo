export const isValidPastOrPresentDate = (value) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getTime() <= now.getTime();
};

export const getWeekStartFromDate = (value) => {
  if (!isValidPastOrPresentDate(value)) return null;
  const date = new Date(value);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
};

export const getEntryWeekKey = (entry) => {
  if (!entry) return null;
  if (entry.weekStart && isValidPastOrPresentDate(entry.weekStart)) {
    return entry.weekStart;
  }
  if (entry.createdAt) {
    return getWeekStartFromDate(entry.createdAt);
  }
  return null;
};
