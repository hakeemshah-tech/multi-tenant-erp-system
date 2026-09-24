import axios from "../lib/axios";

export type TemplateTypeInput = {
  title: string;
  description?: string;
  contractTypeId: string;
};

export type TemplateType = TemplateTypeInput & {
  _id: string;
  tenantId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

class TemplateTypesService {
  private baseURL = "/template-types";

  async list(contractTypeId?: string): Promise<TemplateType[]> {
    const res = await axios.get(this.baseURL, { params: { contractTypeId } });
    return res.data.data;
  }

  async create(payload: TemplateTypeInput): Promise<TemplateType> {
    const res = await axios.post(this.baseURL, payload);
    return res.data.data;
  }

  async update(
    id: string,
    payload: Partial<TemplateTypeInput>
  ): Promise<TemplateType> {
    const res = await axios.patch(`${this.baseURL}/${id}`, payload);
    return res.data.data;
  }
}

export const templateTypesService = new TemplateTypesService();
