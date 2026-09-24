import axios from "../lib/axios";

export type ContractTypeInput = {
  title: string;
  description?: string;
};

export type ContractType = ContractTypeInput & {
  _id: string;
  tenantId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

class ContractTypesService {
  private baseURL = "/contract-types";

  async list(): Promise<ContractType[]> {
    const res = await axios.get(this.baseURL);
    return res.data.data;
  }

  async create(payload: ContractTypeInput): Promise<ContractType> {
    const res = await axios.post(this.baseURL, payload);
    return res.data.data;
  }

  async update(
    id: string,
    payload: Partial<ContractTypeInput>
  ): Promise<ContractType> {
    const res = await axios.patch(`${this.baseURL}/${id}`, payload);
    return res.data.data;
  }
}

export const contractTypesService = new ContractTypesService();
