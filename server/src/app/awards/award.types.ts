export interface CreateAwardInput {
  title: string;
  description?: string;
  icon?: string;
  isActive?: boolean;
}

export interface UpdateAwardInput {
  title?: string;
  description?: string;
  icon?: string;
  isActive?: boolean;
}
