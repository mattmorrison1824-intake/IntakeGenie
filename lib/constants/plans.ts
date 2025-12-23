// Plan limits and details
export const PLAN_LIMITS = {
  starter: {
    name: 'Starter',
    price: 49,
    minutesPerMonth: 60,
    approxCalls: 30,
  },
  professional: {
    name: 'Professional',
    price: 149,
    minutesPerMonth: 200,
    approxCalls: 100,
  },
  turbo: {
    name: 'Turbo',
    price: 499,
    minutesPerMonth: 1000,
    approxCalls: 500,
  },
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;

export function getPlanLimit(plan: PlanName): number {
  return PLAN_LIMITS[plan].minutesPerMonth;
}

export function getPlanDetails(plan: PlanName) {
  return PLAN_LIMITS[plan];
}

