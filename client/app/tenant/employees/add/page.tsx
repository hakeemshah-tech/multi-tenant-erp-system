// "use client";

// import { useState, useEffect } from "react";
// import { useRouter } from "next/navigation";
// import {
//   Input,
//   Select,
//   Button,
//   Stepper,
//   Tab,
//   Textarea,
//   Checkbox,
// } from "rizzui";
// import { useFormik } from "formik";
// import * as Yup from "yup";
// import axiosInstance from "@/app/lib/axios";
// import { Card } from "@/app/components/ui/Card";
// import ReactDatePicker from "@/app/components/ui/DatePicker";

// interface ShowIf {
//   fieldKey: string;
//   operator: "equals" | "notEquals";
//   value: any;
// }

// interface FieldConfig {
//   key: string;
//   label: string;
//   placeholder: string;
//   hint?: string;
//   required: boolean;
//   type:
//     | "text"
//     | "select"
//     | "date"
//     | "file"
//     | "number"
//     | "email"
//     | "checkbox"
//     | "textarea";
//   options?: string[];
//   fileTypes?: string[];
//   showIf?: ShowIf;
// }

// interface InnerSection {
//   sectionKey: string;
//   sectionLabel: string;
//   fields: FieldConfig[];
// }

// interface Section {
//   sectionKey: string;
//   sectionLabel: string;
//   fields: FieldConfig[];
//   innerSections?: InnerSection[];
// }

// const accountValidationSchema = Yup.object().shape({
//   email: Yup.string().email("Invalid email").required("Email is required"),
//   password: Yup.string()
//     .min(6, "Min 6 characters")
//     .required("Password is required"),
//   designationId: Yup.string().required("Designation is required"),
//   firstName: Yup.string().required("First name is required"),
//   lastName: Yup.string().required("Last name is required"),
// });

// export default function CreateEmployeeStepper() {
//   const router = useRouter();
//   const [step, setStep] = useState(0);
//   const [designationOptions, setDesignationOptions] = useState([]);
//   const [designationId, setDesignationId] = useState("");
//   const [employeeProfileId, setEmployeeProfileId] = useState("");
//   const [sections, setSections] = useState<Section[]>([]);
//   const [initialValues, setInitialValues] = useState<Record<string, any>>({});

//   const accountFormik = useFormik({
//     initialValues: {
//       email: "",
//       password: "",
//       designationId: "",
//       firstName: "",
//       lastName: "",
//     },
//     validationSchema: accountValidationSchema,
//     onSubmit: async (values) => {
//       const payload = {
//         email: values.email,
//         password: values.password,
//         designationId: values.designationId,
//         firstname: values.firstName,
//         lastname: values.lastName,
//       };

//       const res = await axiosInstance.post(
//         "/employee-profiles/register",
//         payload
//       );
//       const empData = res.data.data;
//       setEmployeeProfileId(empData.employeeProfileId);
//       setDesignationId(values.designationId);

//       const designation = designationOptions.find(
//         (d) => d.value === values.designationId
//       );

//       setInitialValues((prev) => ({
//         ...prev,
//         firstname: values.firstName,
//         lastname: values.lastName,
//         employeename: `${values.firstName} ${values.lastName}`,
//         designation: designation?.label || "",
//         department: designation?.department || "",
//       }));

//       setStep(1);
//     },
//   });

//   useEffect(() => {
//     const fetchDesignations = async () => {
//       const res = await axiosInstance.get("/designations");
//       const options = res.data.data.map((d: any) => ({
//         label: d.name,
//         value: d._id,
//         department: d.department?.name || "",
//       }));
//       setDesignationOptions(options);
//     };
//     fetchDesignations();
//   }, []);

//   useEffect(() => {
//     if (step !== 1) return;
//     const fetchConfig = async () => {
//       const res = await axiosInstance.get("/employee-field-config");
//       const sectionsData = res.data.data.sections;
//       const values: Record<string, any> = {};
//       for (const section of sectionsData) {
//         section.fields.forEach((field) => {
//           values[field.key] = field.type === "checkbox" ? false : "";
//         });
//         section.innerSections?.forEach((inner) => {
//           inner.fields.forEach((field) => {
//             values[field.key] = field.type === "checkbox" ? false : "";
//           });
//         });
//       }
//       setInitialValues(values);
//       setSections(sectionsData);
//     };
//     fetchConfig();
//   }, [step]);

//   const formik = useFormik({
//     enableReinitialize: true,
//     initialValues,
//     onSubmit: async (values) => {
//       const structuredData = sections.map((section) => {
//         const sectionFields = section.fields.map((field) => ({
//           key: field.key,
//           value: values[field.key],
//         }));

//         const innerSections =
//           section.innerSections?.map((inner) => ({
//             sectionKey: inner.sectionKey,
//             sectionLabel: inner.sectionLabel,
//             fields: inner.fields.map((field) => ({
//               key: field.key,
//               value: values[field.key],
//             })),
//           })) || [];

//         return {
//           sectionKey: section.sectionKey,
//           sectionLabel: section.sectionLabel,
//           fields: sectionFields,
//           innerSections,
//         };
//       });

//       await axiosInstance.put(`/employee-profiles/${employeeProfileId}`, {
//         sections: structuredData,
//       });
//       localStorage.removeItem("employeeStepper");
//       router.push("/tenant/employees");
//     },
//   });

//   const evaluateShowIf = (field: FieldConfig): boolean => {
//     if (!field.showIf) return true;
//     const dependentValue = formik.values[field.showIf.fieldKey];
//     return field.showIf.operator === "equals"
//       ? dependentValue === field.showIf.value
//       : dependentValue !== field.showIf.value;
//   };

//   const renderField = (field: FieldConfig) => {
//     if (!evaluateShowIf(field)) return null;
//     const {
//       key,
//       label,
//       placeholder,
//       required,
//       type,
//       options,
//       hint,
//       fileTypes,
//     } = field;
//     const commonProps = {
//       label,
//       placeholder,
//       required,
//       name: key,
//       value: formik.values[key],
//       onChange: formik.handleChange,
//     };

//     const renderHint = () =>
//       hint ? (
//         <p className="text-xs text-gray-400 mt-1" key={`${key}-hint`}>
//           {hint}
//         </p>
//       ) : null;

//     switch (type) {
//       case "text":
//       case "number":
//       case "email":
//         return (
//           <div key={key}>
//             <Input type={type} {...commonProps} />
//             {renderHint()}
//           </div>
//         );
//       case "textarea":
//         return (
//           <div key={key}>
//             <Textarea {...commonProps} />
//             {renderHint()}
//           </div>
//         );
//       case "date":
//         return (
//           <div key={key} className="space-y-1">
//             <label className="text-sm font-medium text-gray-700">
//               {label} {required && <span className="text-red-500">*</span>}
//             </label>
//             <br />
//             <ReactDatePicker
//               selected={formik.values[key]}
//               onChange={(val) => formik.setFieldValue(key, val)}
//               inputProps={{ placeholder }}
//             />
//             {renderHint()}
//           </div>
//         );
//       case "checkbox":
//         return (
//           <div key={key}>
//             <Checkbox
//               label={label}
//               checked={formik.values[key]}
//               onChange={(e) => formik.setFieldValue(key, e.target.checked)}
//             />
//             {renderHint()}
//           </div>
//         );
//       case "select":
//         return (
//           <div key={key}>
//             <Select
//               label={label}
//               placeholder={placeholder}
//               required={required}
//               value={
//                 options
//                   ?.map((o) => ({ label: o, value: o }))
//                   .find((opt) => opt.value === formik.values[key]) || null
//               }
//               onChange={(option) =>
//                 formik.setFieldValue(key, option?.value || "")
//               }
//               options={options?.map((o) => ({ label: o, value: o })) || []}
//             />
//             {renderHint()}
//           </div>
//         );
//       case "file":
//         return (
//           <div key={key} className="space-y-1">
//             <label className="block text-sm font-medium text-gray-700">
//               {label} {required && <span className="text-red-500">*</span>}
//             </label>
//             <div className="border border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-between bg-gray-50 hover:border-gray-400 transition-colors">
//               <div className="flex flex-col">
//                 {formik.values[key] ? (
//                   <a
//                     href={formik.values[key]}
//                     target="_blank"
//                     rel="noopener noreferrer"
//                     className="text-sm text-blue-600 underline"
//                   >
//                     View Uploaded Document
//                   </a>
//                 ) : (
//                   <p className="text-sm text-gray-500">No file uploaded</p>
//                 )}
//                 {renderHint()}
//               </div>
//               <label className="ml-4 bg-white border border-gray-300 px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer hover:bg-gray-100 transition">
//                 Browse
//                 <input
//                   type="file"
//                   accept={fileTypes?.map((t) => `.${t}`).join(",")}
//                   className="hidden"
//                   onChange={async (e) => {
//                     const file = e.target.files?.[0];
//                     if (!file) return;
//                     try {
//                       const formData = new FormData();
//                       formData.append("file", file);
//                       const { data } = await axiosInstance.post(
//                         "/uploads",
//                         formData,
//                         {
//                           headers: { "Content-Type": "multipart/form-data" },
//                         }
//                       );
//                       formik.setFieldValue(key, data.url);
//                     } catch (error) {
//                       console.error("File upload failed:", error);
//                       alert("File upload failed. Please try again.");
//                     }
//                   }}
//                 />
//               </label>
//             </div>
//           </div>
//         );
//       default:
//         return null;
//     }
//   };

//   return (
//     <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
//       <Card className="p-6 sm:p-8 space-y-8">
//         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
//           <div>
//             <h2 className="text-2xl font-semibold text-gray-900">
//               Register New Employee
//             </h2>
//             <p className="text-sm text-gray-500 mt-1">
//               Step {step + 1} of 2:{" "}
//               {step === 0 ? "Account Details" : "Profile Fields"}
//             </p>
//           </div>
//         </div>

//         <Stepper currentIndex={step} className="mb-4">
//           <Stepper.Step title="Account" description="Email, password & role" />
//           <Stepper.Step title="Details" description="Employee profile data" />
//         </Stepper>

//         {step === 0 ? (
//           <form
//             onSubmit={accountFormik.handleSubmit}
//             className="grid grid-cols-1 md:grid-cols-2 gap-6"
//           >
//             <Input
//               label="First Name"
//               name="firstName"
//               value={accountFormik.values.firstName}
//               onChange={accountFormik.handleChange}
//               onBlur={accountFormik.handleBlur}
//               error={
//                 accountFormik.touched.firstName &&
//                 accountFormik.errors.firstName
//               }
//               required
//             />
//             <Input
//               label="Last Name"
//               name="lastName"
//               value={accountFormik.values.lastName}
//               onChange={accountFormik.handleChange}
//               onBlur={accountFormik.handleBlur}
//               error={
//                 accountFormik.touched.lastName && accountFormik.errors.lastName
//               }
//               required
//             />
//             <Input
//               label="Email"
//               name="email"
//               value={accountFormik.values.email}
//               onChange={accountFormik.handleChange}
//               onBlur={accountFormik.handleBlur}
//               error={accountFormik.touched.email && accountFormik.errors.email}
//               required
//             />
//             <Input
//               label="Password"
//               name="password"
//               type="password"
//               value={accountFormik.values.password}
//               onChange={accountFormik.handleChange}
//               onBlur={accountFormik.handleBlur}
//               error={
//                 accountFormik.touched.password && accountFormik.errors.password
//               }
//               required
//             />
//             <Select
//               label="Designation"
//               name="designationId"
//               value={
//                 designationOptions.find(
//                   (option) =>
//                     option.value === accountFormik.values.designationId
//                 ) || null
//               }
//               onChange={(option) =>
//                 accountFormik.setFieldValue(
//                   "designationId",
//                   option?.value || ""
//                 )
//               }
//               onBlur={accountFormik.handleBlur}
//               error={
//                 accountFormik.touched.designationId &&
//                 accountFormik.errors.designationId
//               }
//               options={designationOptions}
//               required
//             />
//             <div className="md:col-span-2">
//               <Button type="submit">Continue</Button>
//             </div>
//           </form>
//         ) : (
//           <form onSubmit={formik.handleSubmit} className="space-y-8">
//             <Tab>
//               <Tab.List className="gap-2 border-b pb-2 mb-4">
//                 {sections.map((section) => (
//                   <Tab.ListItem
//                     key={section.sectionKey}
//                     className="text-sm font-medium px-4 py-2 rounded-md"
//                   >
//                     {section.sectionLabel}
//                   </Tab.ListItem>
//                 ))}
//               </Tab.List>
//               <Tab.Panels>
//                 {sections.map((section) => (
//                   <Tab.Panel key={section.sectionKey}>
//                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                       {section.fields.map(renderField)}
//                     </div>
//                     {section.innerSections?.map((inner) => (
//                       <div
//                         key={inner.sectionKey}
//                         className="mt-8 border-t border-gray-200 pt-6"
//                       >
//                         <h4 className="text-base font-medium text-gray-700 mb-4">
//                           {inner.sectionLabel}
//                         </h4>
//                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                           {inner.fields.map(renderField)}
//                         </div>
//                       </div>
//                     ))}
//                   </Tab.Panel>
//                 ))}
//               </Tab.Panels>
//             </Tab>
//             <Button type="submit">Submit</Button>
//           </form>
//         )}
//       </Card>
//     </div>
//   );
// }

// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";
// import { Input, Select, Button } from "rizzui";
// import { useFormik } from "formik";
// import * as Yup from "yup";
// import axiosInstance from "@/app/lib/axios";
// import { Card } from "@/app/components/ui/Card";
// import toast from "react-hot-toast";

// const accountValidationSchema = Yup.object().shape({
//   email: Yup.string().email("Invalid email").required("Email is required"),
//   password: Yup.string()
//     .min(6, "Min 6 characters")
//     .required("Password is required"),
//   designationId: Yup.string().required("Designation is required"),
//   firstName: Yup.string().required("First name is required"),
//   lastName: Yup.string().required("Last name is required"),
// });

// export default function RegisterEmployeeForm() {
//   const router = useRouter();
//   const [designationOptions, setDesignationOptions] = useState([]);

//   const accountFormik = useFormik({
//     initialValues: {
//       email: "",
//       password: "",
//       designationId: "",
//       firstName: "",
//       lastName: "",
//     },
//     validationSchema: accountValidationSchema,
//     onSubmit: async (values) => {
//       const payload = {
//         email: values.email,
//         password: values.password,
//         designationId: values.designationId,
//         firstname: values.firstName,
//         lastname: values.lastName,
//       };

//       try {
//         const res = await axiosInstance.post(
//           "/employee-profiles/register",
//           payload
//         );
//         const newEmployeeId = res.data?.data?.employee?._id;

//         if (newEmployeeId) {
//           toast.success("Employee Register. Please Complete the profile");
//           router.push(`/tenant/employees/${newEmployeeId}/edit`);
//         } else {
//           console.error("Employee ID not returned from response.");
//           alert("Registration succeeded but no ID returned.");
//         }
//       } catch (error) {
//         console.error("Registration failed:", error);
//         alert("Registration failed. Please try again.");
//       }
//     },
//   });

//   useEffect(() => {
//     const fetchDesignations = async () => {
//       const res = await axiosInstance.get("/designations");
//       const options = res.data.data.map((d: any) => ({
//         label: d.name,
//         value: d._id,
//       }));
//       setDesignationOptions(options);
//     };
//     fetchDesignations();
//   }, []);

//   return (
//     <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
//       <Card className="p-6 sm:p-8 space-y-6">
//         <div>
//           <h2 className="text-2xl font-semibold text-gray-900">
//             Register New Employee
//           </h2>
//           <p className="text-sm text-gray-500 mt-1">Fill the details below</p>
//         </div>

//         <form
//           onSubmit={accountFormik.handleSubmit}
//           className="grid grid-cols-1 md:grid-cols-2 gap-6"
//         >
//           <Input
//             label="First Name"
//             name="firstName"
//             value={accountFormik.values.firstName}
//             onChange={accountFormik.handleChange}
//             onBlur={accountFormik.handleBlur}
//             error={
//               accountFormik.touched.firstName && accountFormik.errors.firstName
//             }
//             required
//           />
//           <Input
//             label="Last Name"
//             name="lastName"
//             value={accountFormik.values.lastName}
//             onChange={accountFormik.handleChange}
//             onBlur={accountFormik.handleBlur}
//             error={
//               accountFormik.touched.lastName && accountFormik.errors.lastName
//             }
//             required
//           />
//           <Input
//             label="Email"
//             name="email"
//             value={accountFormik.values.email}
//             onChange={accountFormik.handleChange}
//             onBlur={accountFormik.handleBlur}
//             error={accountFormik.touched.email && accountFormik.errors.email}
//             required
//           />
//           <Input
//             label="Password"
//             name="password"
//             type="password"
//             value={accountFormik.values.password}
//             onChange={accountFormik.handleChange}
//             onBlur={accountFormik.handleBlur}
//             error={
//               accountFormik.touched.password && accountFormik.errors.password
//             }
//             required
//           />
//           <Select
//             label="Designation"
//             name="designationId"
//             value={
//               designationOptions.find(
//                 (option) => option.value === accountFormik.values.designationId
//               ) || null
//             }
//             onChange={(option) =>
//               accountFormik.setFieldValue("designationId", option?.value || "")
//             }
//             onBlur={accountFormik.handleBlur}
//             error={
//               accountFormik.touched.designationId &&
//               accountFormik.errors.designationId
//             }
//             options={designationOptions}
//             required
//           />
//           <div className="md:col-span-2">
//             <Button type="submit">Register</Button>
//           </div>
//         </form>
//       </Card>
//     </div>
//   );
// }

"use client";

import { useEffect, useState } from "react";
import { Input, Select, Button } from "rizzui";
import { useFormik } from "formik";
import * as Yup from "yup";
import axiosInstance from "@/app/lib/axios";
import { Card } from "@/app/components/ui/Card";
import toast from "react-hot-toast";

const invitationSchema = Yup.object().shape({
  email: Yup.string().email("Invalid email").required("Email is required"),
  designationId: Yup.string().required("Designation is required"),
});

interface DesignationOption {
  label: string;
  value: string;
}

export default function SendEmployeeInviteForm() {
  const [designationOptions, setDesignationOptions] = useState<
    DesignationOption[]
  >([]);
  const [loading, setLoading] = useState(false);

  const formik = useFormik({
    initialValues: {
      email: "",
      designationId: "",
    },
    validationSchema: invitationSchema,
    onSubmit: async (values, { resetForm }) => {
      setLoading(true);
      try {
        await axiosInstance.post("/employee-invitation/invite", values);
        toast.success("Invitation sent successfully!");
        resetForm();
      } catch (error: unknown) {
        console.error("Error sending invitation:", error);
        // Display the error message from the backend
        const errorMessage =
          (error as { response?: { data?: { message?: string } } })?.response
            ?.data?.message || "Failed to send invitation. Try again later.";
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
  });

  useEffect(() => {
    const fetchDesignations = async () => {
      try {
        const res = await axiosInstance.get("/designations");
        const options: DesignationOption[] = res.data.data.map(
          (d: { name: string; _id: string }) => ({
            label: d.name,
            value: d._id,
          })
        );
        setDesignationOptions(options);
      } catch (error) {
        console.error("Failed to load designations", error);
      }
    };
    fetchDesignations();
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <Card className="p-8 sm:p-10 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-gray-900">
            Invite New Employee
          </h2>
          <p className="text-sm text-gray-500">
            Send an invite to join your organisation. If the employee
            doesn&apos;t have an account, they&apos;ll be asked to register
            first.
          </p>
        </div>

        <form onSubmit={formik.handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <Input
                label="Work Email"
                placeholder="employee@company.com"
                name="email"
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={
                  formik.touched.email && formik.errors.email
                    ? formik.errors.email
                    : undefined
                }
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Invitation will be sent to this address
              </p>
            </div>

            <div>
              <Select
                label="Job Title"
                name="designationId"
                value={
                  designationOptions.find(
                    (option) => option.value === formik.values.designationId
                  ) || null
                }
                onChange={(option: DesignationOption | null) =>
                  formik.setFieldValue("designationId", option?.value || "")
                }
                onBlur={formik.handleBlur}
                error={
                  formik.touched.designationId && formik.errors.designationId
                    ? formik.errors.designationId
                    : undefined
                }
                options={designationOptions}
              />
              <p className="text-xs text-gray-400 mt-1">
                Assign Job Title for the invited employee
              </p>
            </div>
          </div>

          <div className="pt-4">
            <Button
              type="submit"
              className="w-full sm:w-auto"
              isLoading={loading}
            >
              ✉️ Send Invitation
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
