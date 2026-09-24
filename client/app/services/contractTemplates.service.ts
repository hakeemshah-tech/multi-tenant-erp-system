import axios from "../lib/axios";

export type ContractTemplateInput = {
  title: string;
  description?: string;
  contractTypeId?: string; // legacy single
  contractTypeIds?: string[];
  employmentType?: string; // legacy single
  employmentTypes?: string[];
  designationIds?: string[];
  version?: string;
  recommended?: boolean;
  builder?: any;
};

export type ContractTemplate = ContractTemplateInput & {
  _id: string;
  tenantId: string;
  branchId: string;
  userId: string;
  status: "draft" | "published";
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

class ContractTemplatesService {
  private baseURL = "/contract-templates";

  async list(
    params: Partial<{
      search: string;
      contractTypeId: string;
      employmentType: string;
      designationId: string;
    }> = {}
  ): Promise<ContractTemplate[]> {
    const res = await axios.get(this.baseURL, { params });
    return res.data.data;
  }

  async create(payload: ContractTemplateInput): Promise<ContractTemplate> {
    const res = await axios.post(this.baseURL, payload);
    return res.data.data;
  }

  async remove(id: string): Promise<void> {
    await axios.delete(`${this.baseURL}/${id}`);
  }

  async get(id: string): Promise<ContractTemplate> {
    const res = await axios.get(`${this.baseURL}/${id}`);
    return res.data.data;
  }

  async update(
    id: string,
    payload: Partial<ContractTemplateInput>
  ): Promise<ContractTemplate> {
    const res = await axios.put(`${this.baseURL}/${id}`, payload);
    return res.data.data;
  }

  async publish(id: string): Promise<ContractTemplate> {
    const res = await axios.post(`${this.baseURL}/${id}/publish`, {});
    return res.data.data;
  }

  async duplicate(id: string, version: string): Promise<ContractTemplate> {
    const res = await axios.post(`${this.baseURL}/${id}/duplicate`, {
      version,
    });
    return res.data.data;
  }
}

export const contractTemplatesService = new ContractTemplatesService();
