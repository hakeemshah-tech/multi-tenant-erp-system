// "use client";

// import { useRouter } from "next/navigation";
// import { Building, User } from "lucide-react";
// import { motion } from "framer-motion";

// const Onboarding = () => {
//   const router = useRouter();

//   const handleOptionClick = (mode: "employer" | "employee") => {
//     if (mode === "employer") {
//       router.push("/register-tenant");
//     } else {
//       router.push("/create-nexus-profile");
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex flex-col items-center justify-center px-6 py-12">
//       {/* Title Section */}
//       <motion.div
//         initial={{ opacity: 0, y: -20 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ duration: 0.5 }}
//         className="text-center mb-12"
//       >
//         <h1 className="text-4xl font-bold text-blue-800 mb-4">
//           Welcome to HR Nexus 👋
//         </h1>
//         <p className="text-gray-600 max-w-xl mx-auto">
//           Let’s get started by choosing who you are. Are you setting up a
//           company, or are you joining one as an employee?
//         </p>
//       </motion.div>

//       {/* Interactive Cards */}
//       <div className="flex flex-col gap-6 w-full max-w-xl">
//         <motion.div
//           whileHover={{ scale: 1.05 }}
//           whileTap={{ scale: 0.98 }}
//           onClick={() => handleOptionClick("employer")}
//           className="cursor-pointer border border-gray-200 bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all text-center"
//         >
//           <div className="flex justify-center items-center mb-4">
//             <div className="bg-blue-100 text-blue-600 p-4 rounded-full">
//               <Building className="w-6 h-6" />
//             </div>
//           </div>
//           <h3 className="text-xl font-semibold text-gray-800 mb-2">
//             I'm an Employer
//           </h3>
//           <p className="text-sm text-gray-500">
//             Set up your company profile, manage branches and onboard employees
//             seamlessly.
//           </p>
//         </motion.div>

//         <motion.div
//           whileHover={{ scale: 1.05 }}
//           whileTap={{ scale: 0.98 }}
//           onClick={() => handleOptionClick("employee")}
//           className="cursor-pointer border border-gray-200 bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all text-center"
//         >
//           <div className="flex justify-center items-center mb-4">
//             <div className="bg-blue-100 text-blue-600 p-4 rounded-full">
//               <User className="w-6 h-6" />
//             </div>
//           </div>
//           <h3 className="text-xl font-semibold text-gray-800 mb-2">
//             I'm an Employee
//           </h3>
//           <p className="text-sm text-gray-500">
//             Join your organization by creating your profile and get started with
//             your onboarding.
//           </p>
//         </motion.div>
//       </div>
//     </div>
//   );
// };

// export default Onboarding;

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building, User } from "lucide-react";
import { motion } from "framer-motion";
import { Modal, Button, Title, Text } from "rizzui";
import axiosInstance from "../lib/axios";

const Onboarding = () => {
  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleOptionClick = (mode: "employer" | "employee") => {
    if (mode === "employer") {
      router.push("/register-tenant");
    } else {
      setIsConfirmOpen(true);
    }
  };

  const confirmEmployee = async () => {
    try {
      setLoading(true);
      await axiosInstance.post(`/employee-profiles/self`, {});
      setIsConfirmOpen(false);
      router.push("/nexus-profile");
    } catch (error) {
      console.error("Error creating employee profile:", error);
      // optionally show a toast/error message here
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex flex-col items-center justify-center px-6 py-12">
      {/* Title Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl font-bold text-blue-800 mb-4">
          Welcome to HR Nexus 👋
        </h1>
        <p className="text-gray-600 max-w-xl mx-auto">
          Let’s get started by choosing who you are. Are you setting up a
          company, or are you joining one as an employee?
        </p>
      </motion.div>

      {/* Interactive Cards */}
      <div className="flex flex-col gap-6 w-full max-w-xl">
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleOptionClick("employer")}
          className="cursor-pointer border border-gray-200 bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all text-center"
        >
          <div className="flex justify-center items-center mb-4">
            <div className="bg-blue-100 text-blue-600 p-4 rounded-full">
              <Building className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            I'm an Employer
          </h3>
          <p className="text-sm text-gray-500">
            Set up your company profile, manage branches and onboard employees
            seamlessly.
          </p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleOptionClick("employee")}
          className="cursor-pointer border border-gray-200 bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all text-center"
        >
          <div className="flex justify-center items-center mb-4">
            <div className="bg-blue-100 text-blue-600 p-4 rounded-full">
              <User className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            I'm an Employee
          </h3>
          <p className="text-sm text-gray-500">
            Join your organisation by creating your profile and get started with
            your onboarding.
          </p>
        </motion.div>
      </div>

      {/* Confirm Dialog */}
      <Modal
        isOpen={isConfirmOpen}
        onClose={() => !loading && setIsConfirmOpen(false)}
        size="sm"
        rounded="lg"
      >
        <div className="m-auto px-7 pt-6 pb-7">
          <Title as="h3" className="mb-2">
            Confirm Registration
          </Title>
          <Text className="text-gray-600 mb-6">
            Are you sure you want to register as an{" "}
            <span className="font-semibold">Employee</span>?
          </Text>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsConfirmOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={confirmEmployee} disabled={loading}>
              {loading ? "Processing..." : "Yes, continue"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Onboarding;
