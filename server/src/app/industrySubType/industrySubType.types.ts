export interface CreateIndustrySubTypeInput {
  name: string;
  description?: string;
  code?: string;
  industryTypeId: string;
  isActive?: boolean;
}

export interface UpdateIndustrySubTypeInput {
  name?: string;
  description?: string;
  code?: string;
  industryTypeId?: string;
  isActive?: boolean;
}
