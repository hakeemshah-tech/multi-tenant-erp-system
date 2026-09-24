export const swaggerSchemas = {
  RegisterTenantInput: {
    type: "object",
    required: [
      "fullName",
      "email",
      "password",
      "companyName",
      "companyLocation",
      "employeeCount",
      "businessCategory",
    ],
    properties: {
      fullName: {
        type: "string",
        example: "John Doe",
      },
      email: {
        type: "string",
        example: "john@example.com",
      },
      password: {
        type: "string",
        example: "P@ssw0rd123",
      },
      companyName: {
        type: "string",
        example: "Inworthit Technologies",
      },
      companyLocation: {
        type: "string",
        example: "Kochi, India",
      },
      employeeCount: {
        type: "integer",
        example: 50,
      },
      businessCategory: {
        type: "string",
        description: "MongoDB ObjectId",
        example: "665f31f88292ff9f41c556ec",
      },
    },
  },

  RegisterUserInput: {
    type: "object",
    required: ["fullName", "email", "phone", "password"],
    properties: {
      fullName: {
        type: "string",
        example: "Jane Doe",
      },
      email: {
        type: "string",
        example: "jane@example.com",
      },
      phone: {
        type: "string",
        example: "+1234567890",
      },
      password: {
        type: "string",
        format: "password",
        example: "StrongPass123!",
      },
    },
  },

  LoginInput: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: {
        type: "string",
        example: "john@example.com",
      },
      password: {
        type: "string",
        example: "P@ssw0rd123",
      },
    },
  },

  // departments
  CreateDepartmentInput: {
    type: "object",
    required: ["name", "designationIds"],
    properties: {
      name: { type: "string", example: "Engineering" },
      description: {
        type: "string",
        example: "Responsible for product development",
      },
    },
  },

  UpdateDepartmentInput: {
    type: "object",
    properties: {
      name: { type: "string", example: "R&D" },
      description: {
        type: "string",
        example: "Updated department description",
      },
    },
  },

  // Designations
  CreateDesignationInput: {
    type: "object",
    required: ["name", "departmentIds"],
    properties: {
      name: { type: "string", example: "Software Engineer" },
      description: {
        type: "string",
        example: "Responsible for writing and maintaining code",
      },
      departmentIds: {
        type: "array",
        items: {
          type: "string",
          description: "MongoDB ObjectId of department",
          example: "665f31f88292ff9f41c556ec",
        },
      },
    },
  },

  UpdateDesignationInput: {
    type: "object",
    properties: {
      name: { type: "string", example: "Lead Engineer" },
      description: {
        type: "string",
        example: "Updated designation description",
      },
      departmentIds: {
        type: "array",
        items: {
          type: "string",
          description: "MongoDB ObjectId of department",
          example: "665f31f88292ff9f41c556ec",
        },
      },
    },
  },
};
