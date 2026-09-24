export interface UpdateBranchDetailsInput {
  logo?: string;
  name?: string;
  abn?: string;
  acn?: string;
  businessStructureId?: string;
  industryTypeIds?: string[];
  industrySubTypeIds?: string[];
  addresses?: Array<{
    buildingPropertyName?: string;
    flatUnitNumber?: string;
    streetNumber?: string;
    streetName?: string;
    suburbCity?: string;
    stateTerritory?: string;
    country?: string;
    zipPostalCode?: string;
  }>;
  email?: string;
  phone?: string;
  websiteUrl?: string;
  physicalWorkLocations?: Array<{
    state: string;
    place: string;
  }>;
  businessHoursOfOperation?: {
    officeWorker?: {
      startTime?: string;
      endTime?: string;
      weekDays?: string[];
    };
    shiftWorker?: {
      description?: string;
      weekDays?: string[];
    };
  };
  isNotForProfit?: boolean;
  isSalaryPackagingAvailable?: boolean;
  salaryPackagingMaximumAmount?: number;
}
