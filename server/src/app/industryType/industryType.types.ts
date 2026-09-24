export interface CreateIndustryTypeInput {
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateIndustryTypeInput {
  name?: string;
  description?: string;
  isActive?: boolean;
}
