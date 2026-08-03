export const timFourWeekPlan = Object.freeze([
    { week: 1, repScheme: '6s', days: ['core+chest', 'legs', 'shoulders', 'run+recovery', 'core+back', 'arms', 'long-run+recovery'] },
    { week: 2, repScheme: '8s', days: ['core+chest', 'legs', 'shoulders', 'run+recovery', 'core+back', 'arms', 'long-run+recovery'] },
    { week: 3, repScheme: '10s', days: ['core+chest', 'legs', 'shoulders', 'run+recovery', 'core+back', 'arms', 'long-run+recovery'] },
    { week: 4, repScheme: '10/8/6', days: ['core+chest', 'legs', 'shoulders', 'run+recovery', 'core+back', 'arms', 'long-run+recovery'] }
]);

export const timPlanWeeklyFixture = Object.freeze({
    meaningfulSessions: 7,
    strengthSessions: 5,
    cardioSessions: 2,
    mobilitySessions: 7,
    meditationSessions: 7,
    rawBasePowerGain: 240,
    description: 'The built-in Tim four-week strength split, two running days, daily mobility and meditation.'
});

export function timPlanWeek(calendarWeek) {
    const index = Math.max(0, Math.floor(Number(calendarWeek) || 1) - 1) % timFourWeekPlan.length;
    return timFourWeekPlan[index];
}
