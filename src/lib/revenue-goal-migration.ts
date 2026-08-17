export type RevenueGoalMap = Record<string, number>;

export type RevenueGoalMerge = {
  goals: RevenueGoalMap;
  migratedMonths: string[];
  conflicts: string[];
};

export function mergeRevenueGoalScopes(
  remoteGoals: RevenueGoalMap,
  deviceGoals: RevenueGoalMap,
  uidGoals: RevenueGoalMap,
): RevenueGoalMerge {
  const goals = { ...remoteGoals };
  const migratedMonths: string[] = [];
  const conflicts: string[] = [];

  for (const [month, amount] of Object.entries(deviceGoals)) {
    if (goals[month] !== undefined) {
      if (goals[month] !== amount) conflicts.push(month);
      continue;
    }
    goals[month] = amount;
    migratedMonths.push(month);
  }

  if (Object.keys(remoteGoals).length === 0) {
    for (const [month, amount] of Object.entries(uidGoals)) {
      if (goals[month] === undefined) goals[month] = amount;
    }
  }

  return { goals, migratedMonths, conflicts };
}
