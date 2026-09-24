export interface IRate {
  level: number;
  baseMinimumHourlyRates: number;
}

export interface CreateHourlyRateManagementInput {
  awardId: string;
  awardEmployeeTypeId: string;
  startDate: string | Date;
  endDate?: string | Date;
  rates: IRate[];
}

export interface UpdateHourlyRateManagementInput {
  awardId?: string;
  awardEmployeeTypeId?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  rates?: IRate[];
}
