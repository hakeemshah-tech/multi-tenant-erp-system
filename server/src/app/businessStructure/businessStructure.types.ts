export interface CreateBusinessStructureInput {
  name: string;
  description?: string;
  code?: string;
  isActive?: boolean;
}

export interface UpdateBusinessStructureInput {
  name?: string;
  description?: string;
  code?: string;
  isActive?: boolean;
}
