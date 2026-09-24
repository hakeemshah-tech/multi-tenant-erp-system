export interface CreateAwardEmployeeTypeInput {
  title: string;
  description?: string;
  awardId: string;
}

export interface UpdateAwardEmployeeTypeInput {
  title?: string;
  description?: string;
  awardId?: string;
}
