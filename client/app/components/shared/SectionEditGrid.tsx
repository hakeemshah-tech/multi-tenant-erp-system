// "use client";
// import React from "react";
// import { FieldControl } from "./FieldControl";
// import { passesShowIf, isProfilePhotoField } from "@/app/utils/common";
// import { SectionConfig } from "@/app/types/employee-fields";

// export function SectionEditGrid({
//   section,
//   draft,
//   setDraft,
//   makeDraftLookup,
//   referenceOptions,
// }: {
//   section: SectionConfig;
//   draft: any;
//   setDraft: React.Dispatch<React.SetStateAction<any>>;
//   makeDraftLookup: (section: SectionConfig) => (key: string) => any;
//   referenceOptions?: Record<string, { label: string; value: string }[]>;
// }) {
//   return (
//     <>
//       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//         {(section?.fields || [])
//           .filter((f) => !isProfilePhotoField(section?.sectionKey, f.key))
//           .filter((f) => passesShowIf(f, makeDraftLookup(section)))
//           .map((f) => (
//             <div key={`top.${f.key}`}>
//               <FieldControl
//                 field={f}
//                 value={draft?.[f.key]}
//                 onChange={(v) => setDraft((d: any) => ({ ...d, [f.key]: v }))}
//                 referenceOptions={referenceOptions}
//               />
//             </div>
//           ))}
//       </div>

//       {(section?.innerSections || []).map((inn) => (
//         <div key={inn.sectionKey} className="mt-8 border-t pt-6">
//           <h4 className="text-sm font-semibold text-gray-800 mb-4">
//             {inn.sectionLabel}
//           </h4>
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//             {(inn.fields || [])
//               .filter((f) => !isProfilePhotoField(section?.sectionKey, f.key))
//               .filter((f) => passesShowIf(f, makeDraftLookup(section)))
//               .map((f) => (
//                 <div key={`inner.${inn.sectionKey}.${f.key}`}>
//                   <FieldControl
//                     field={f}
//                     value={draft.__inners?.[inn.sectionKey]?.[f.key]}
//                     onChange={(v) =>
//                       setDraft((d: any) => ({
//                         ...d,
//                         __inners: {
//                           ...(d.__inners || {}),
//                           [inn.sectionKey]: {
//                             ...(d.__inners?.[inn.sectionKey] || {}),
//                             [f.key]: v,
//                           },
//                         },
//                       }))
//                     }
//                     referenceOptions={referenceOptions}
//                   />
//                 </div>
//               ))}
//           </div>
//         </div>
//       ))}
//     </>
//   );
// }

"use client";

import { Input, Select, Textarea, Checkbox, Table } from "rizzui";
import type { SectionConfig, FieldConfig } from "@/app/types/employee-fields";
import { passesShowIf } from "@/app/utils/common";
import {
  Dispatch,
  SetStateAction,
  useMemo,
  useEffect,
  useState,
  useRef,
} from "react";
import { PhoneInput } from "./PhoneInput";
import axiosInstance from "@/app/lib/axios";
import { TrendingUp, Calendar, HelpCircle } from "lucide-react";
import { EditDrawer } from "./EditDrawer";
import { COUNTRIES } from "@/app/utils/countries";

type DraftShape = {
  [key: string]: any;
  __inners?: Record<string, Record<string, any>>;
};

export function SectionEditGrid({
  section,
  draft,
  setDraft,
  makeDraftLookup,
  referenceOptions = {},
}: {
  section: SectionConfig;
  draft: DraftShape;
  setDraft: Dispatch<SetStateAction<DraftShape>>;
  makeDraftLookup: (section: SectionConfig) => (key: string) => any;
  referenceOptions?: Record<string, { label: string; value: string }[]>;
}) {
  const lookup = useMemo(
    () => makeDraftLookup(section),
    [makeDraftLookup, section]
  );

  // State for hourly rate management data (for awardsandlevels section)
  const [hourlyRateData, setHourlyRateData] = useState<{
    rates: Array<{ level: number; baseMinimumHourlyRates: number }>;
    startDate?: string;
    endDate?: string | null;
  } | null>(null);
  const [loadingRates, setLoadingRates] = useState(false);
  const [showRatesModal, setShowRatesModal] = useState(false);

  // Find the awardsandlevels inner section
  const awardsAndLevelsSection = section.innerSections?.find(
    (inn) => inn.sectionKey === "awardsandlevels"
  );

  // Track previous award and awardtype values to detect changes
  const prevAwardRef = useRef<any>(null);
  const prevAwardTypeRef = useRef<any>(null);

  // Watch for changes to award and awardtype in awardsandlevels section
  useEffect(() => {
    if (!awardsAndLevelsSection) return;

    const awardId = draft.__inners?.["awardsandlevels"]?.["award"];
    const awardTypeId = draft.__inners?.["awardsandlevels"]?.["awardtype"];

    // Extract IDs for comparison
    const extractedAwardId = awardId
      ? typeof awardId === "object"
        ? String(awardId._id || awardId.id || awardId)
        : String(awardId)
      : null;
    const extractedAwardTypeId = awardTypeId
      ? typeof awardTypeId === "object"
        ? String(awardTypeId._id || awardTypeId.id || awardTypeId)
        : String(awardTypeId)
      : null;

    // Check if award or awardtype has changed (only if we had previous values)
    const awardChanged =
      prevAwardRef.current !== null &&
      String(prevAwardRef.current) !== String(extractedAwardId);
    const awardTypeChanged =
      prevAwardTypeRef.current !== null &&
      String(prevAwardTypeRef.current) !== String(extractedAwardTypeId);

    // Clear hourly rate and awardlevel if award or awardtype changed (but not on initial load)
    if (awardChanged || awardTypeChanged) {
      setDraft((d) => ({
        ...d,
        __inners: {
          ...(d.__inners || {}),
          awardsandlevels: {
            ...(d.__inners?.["awardsandlevels"] || {}),
            hourlyrate: "",
            awardlevel: "",
          },
        },
      }));
    }

    // Update refs after checking for changes
    prevAwardRef.current = extractedAwardId;
    prevAwardTypeRef.current = extractedAwardTypeId;

    if (awardId && awardTypeId) {
      console.log("Fetching hourly rates for:", {
        awardId: extractedAwardId,
        awardEmployeeTypeId: extractedAwardTypeId,
        rawAwardId: awardId,
        rawAwardTypeId: awardTypeId,
      });

      // Both are selected, fetch the active hourly rate management
      setLoadingRates(true);
      axiosInstance
        .get("/hourly-rate-managements/active", {
          params: {
            awardId: extractedAwardId,
            awardEmployeeTypeId: extractedAwardTypeId,
          },
        })
        .then((res) => {
          console.log("Hourly rate management response:", res.data);
          if (res.data?.data) {
            setHourlyRateData({
              rates: res.data.data.rates || [],
              startDate: res.data.data.startDate,
              endDate: res.data.data.endDate,
            });
            console.log("Set hourly rate data:", {
              ratesCount: res.data.data.rates?.length || 0,
              rates: res.data.data.rates,
            });
          } else {
            console.log("No hourly rate data in response");
            setHourlyRateData(null);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch hourly rate management:", err);
          console.error("Error details:", err.response?.data || err.message);
          setHourlyRateData(null);
        })
        .finally(() => {
          setLoadingRates(false);
        });
    } else {
      // Clear rates if either is not selected
      setHourlyRateData(null);
    }
  }, [
    draft.__inners?.["awardsandlevels"]?.["award"],
    draft.__inners?.["awardsandlevels"]?.["awardtype"],
    awardsAndLevelsSection,
  ]);

  // Helper function to render label with hint tooltip
  const renderLabelWithHint = (label: string, hint?: string) => {
    if (!hint) return label;

    return (
      <div className="flex items-center gap-1.5">
        <span>{label}</span>
        <div className="relative group">
          <HelpCircle className="w-4 h-4 text-gray-400 hover:text-blue-500 transition-colors cursor-help" />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
            <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-xl whitespace-nowrap max-w-2xl">
              {hint}
              <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderControl = (
    field: FieldConfig,
    value: any,
    onChange: (v: any) => void,
    innerSectionKey?: string
  ) => {
    const labelText = field.required ? `${field.label} *` : field.label;
    const labelWithHint = field.hint
      ? renderLabelWithHint(labelText, field.hint)
      : labelText;

    if (
      field.type === "text" ||
      field.type === "email" ||
      field.type === "number"
    ) {
      // Check if this is a mobile/phone field
      if (field.key === "mobile" || field.key === "phone") {
        return (
          <div className="space-y-1">
            {field.hint ? (
              <label className="block text-sm font-medium text-gray-700">
                {labelWithHint}
              </label>
            ) : null}
            <PhoneInput
              label={field.hint ? undefined : labelText}
              value={value ?? ""}
              onChange={(val) => onChange(val || "")}
              defaultCountry="AU"
              placeholder={field.placeholder || "Enter phone number"}
            />
          </div>
        );
      }

      // Special handling for hourlyrate field in awardsandlevels section
      if (
        field.key === "hourlyrate" &&
        (innerSectionKey === "awardsandlevels" || awardsAndLevelsSection)
      ) {
        // Get selected award level to show hint
        const selectedAwardLevel =
          draft.__inners?.["awardsandlevels"]?.["awardlevel"];
        let hintText: string | null = null;

        if (
          selectedAwardLevel &&
          hourlyRateData &&
          hourlyRateData.rates &&
          hourlyRateData.rates.length > 0
        ) {
          const levelNum = parseFloat(String(selectedAwardLevel));
          const matchingRate = hourlyRateData.rates.find(
            (rate) => rate.level === levelNum
          );
          if (matchingRate) {
            hintText = `Level ${levelNum} has minimum hourly rate of $${matchingRate.baseMinimumHourlyRates.toFixed(
              2
            )}`;
          }
        }

        return (
          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {labelWithHint}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium z-10">
                  $
                </span>
                <Input
                  type="number"
                  value={value ?? ""}
                  onChange={(e) => onChange(e.target.value)}
                  autoComplete="off"
                  placeholder={field.placeholder || "Enter hourly rate"}
                  className="pl-7"
                />
              </div>
            </div>
            {hintText && (
              <p className="text-xs text-blue-600 mt-1">{hintText}</p>
            )}
            {!loadingRates &&
              hourlyRateData &&
              hourlyRateData.rates.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowRatesModal(true)}
                  className="text-xs text-blue-600 hover:text-blue-800 underline mt-1"
                >
                  Click here to view all award level rates
                </button>
              )}
            {loadingRates && (
              <p className="text-xs text-gray-500 mt-1">Loading rates...</p>
            )}
            {!loadingRates && hourlyRateData === null && (
              <p className="text-xs text-gray-400 mt-1">
                Select Award and Award Employee Type to see available rates
              </p>
            )}

            {/* Drawer for displaying rates */}
            <EditDrawer
              open={showRatesModal}
              title="Available Rates & Levels"
              onClose={() => setShowRatesModal(false)}
            >
              <div className="space-y-4">
                {hourlyRateData && hourlyRateData.rates.length > 0 ? (
                  <>
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-100">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-100 rounded-lg">
                          <TrendingUp className="text-blue-600" size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-900">
                            Award Level Rates
                          </p>
                          <p className="text-[10px] text-gray-600 mt-0.5">
                            Base minimum hourly rates for each level
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                      <Table className="[&_thead]:bg-gray-50 [&_thead_th]:font-semibold [&_thead_th]:text-gray-700 [&_thead_th]:text-xs [&_thead_th]:uppercase [&_thead_th]:tracking-wider [&_thead_th]:py-2.5 [&_tbody_tr]:border-b [&_tbody_tr]:border-gray-100 [&_tbody_tr:hover]:bg-blue-50/50 [&_tbody_td]:py-2">
                        <Table.Header>
                          <Table.Row>
                            <Table.Head className="pl-4">Level</Table.Head>
                            <Table.Head className="pr-4 text-right">
                              Hourly Rate
                            </Table.Head>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {hourlyRateData.rates
                            .sort((a, b) => a.level - b.level)
                            .map((rate, idx) => (
                              <Table.Row
                                key={idx}
                                className="transition-colors duration-150"
                              >
                                <Table.Cell className="pl-4">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 rounded-md flex items-center justify-center shadow-sm ring-1 ring-blue-100">
                                      <span className="text-white font-bold text-xs">
                                        {rate.level}
                                      </span>
                                    </div>
                                    <span className="font-medium text-gray-900 text-xs">
                                      Level {rate.level}
                                    </span>
                                  </div>
                                </Table.Cell>
                                <Table.Cell className="pr-4">
                                  <div className="text-right">
                                    <span className="text-base font-bold text-blue-600">
                                      ${rate.baseMinimumHourlyRates.toFixed(2)}
                                    </span>
                                  </div>
                                </Table.Cell>
                              </Table.Row>
                            ))}
                        </Table.Body>
                      </Table>
                    </div>

                    {(hourlyRateData.startDate || hourlyRateData.endDate) && (
                      <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <Calendar
                          className="text-amber-600 flex-shrink-0 mt-0.5"
                          size={16}
                        />
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-amber-900 mb-1">
                            Validity Period
                          </p>
                          <p className="text-xs text-amber-800">
                            Valid from{" "}
                            <span className="font-medium">
                              {hourlyRateData.startDate
                                ? new Date(
                                    hourlyRateData.startDate
                                  ).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })
                                : "N/A"}
                            </span>
                            {hourlyRateData.endDate ? (
                              <>
                                {" "}
                                to{" "}
                                <span className="font-medium">
                                  {new Date(
                                    hourlyRateData.endDate
                                  ).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })}
                                </span>
                              </>
                            ) : (
                              <span className="font-medium"> onwards</span>
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-3">
                      <TrendingUp className="text-gray-400" size={24} />
                    </div>
                    <p className="text-sm font-medium text-gray-700">
                      No rates available
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Please select an award and award employee type to view
                      rates
                    </p>
                  </div>
                )}
              </div>
            </EditDrawer>
          </div>
        );
      }

      return (
        <Input
          type={field.type === "number" ? "number" : field.type}
          label={labelWithHint}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          placeholder={field.placeholder}
        />
      );
    }

    if (field.type === "phone" || field.type === "tel") {
      return (
        <div className="space-y-1">
          {field.hint ? (
            <label className="block text-sm font-medium text-gray-700">
              {labelWithHint}
            </label>
          ) : null}
          <PhoneInput
            label={field.hint ? undefined : labelText}
            value={value ?? ""}
            onChange={(val) => onChange(val || "")}
            defaultCountry="AU"
            placeholder={field.placeholder || "Enter phone number"}
          />
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <Textarea
          label={labelWithHint}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      );
    }

    if (field.type === "checkbox") {
      return (
        <div className="pt-6">
          <div className="flex items-center gap-1.5">
            <Checkbox
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
            />
            {labelWithHint}
          </div>
        </div>
      );
    }

    if (field.type === "date") {
      const toYMD = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(d.getDate()).padStart(2, "0")}`;

      const isDob = field.key === "dob";
      const today = new Date();
      const eighteenYearsAgo = new Date(
        today.getFullYear() - 18,
        today.getMonth(),
        today.getDate()
      );
      const maxForDob = toYMD(eighteenYearsAgo);

      const resolvedValue =
        value && String(value).slice(0, 10)
          ? String(value).slice(0, 10)
          : isDob
            ? maxForDob // default to 18 years ago if empty
            : "";

      return (
        <Input
          type="date"
          label={labelWithHint}
          value={resolvedValue}
          onChange={(e) => onChange(e.target.value || "")}
          // prevent selecting dates that make the user younger than 18
          max={isDob ? maxForDob : undefined}
          // (optional) better UX hint
          placeholder={
            field.placeholder || (isDob ? "Select DOB (18+)" : undefined)
          }
        />
      );
    }

    if (field.type === "select") {
      // Special handling for fixedterm field - render as year and month dropdowns
      if (field.key === "fixedterm") {
        // Parse existing value (e.g., "1 Year", "6 Months", "1 Year 6 Months", "2Months")
        const parseFixedTerm = (val: string | null | undefined) => {
          if (!val) return { years: "", months: "" };

          const str = String(val).toLowerCase();
          let years = "";
          let months = "";

          // Extract years - handle both "year" and "years" (singular and plural)
          const yearMatch = str.match(/(\d+)\s*years?/i);
          if (yearMatch) {
            years = yearMatch[1];
          }

          // Extract months - handle both "month" and "months" (singular and plural)
          // Also handle cases like "2Months" (no space)
          const monthMatch = str.match(/(\d+)\s*months?/i);
          if (monthMatch) {
            months = monthMatch[1];
          }

          return { years, months };
        };

        const { years: currentYears, months: currentMonths } =
          parseFixedTerm(value);

        // Generate year options (0-10 years)
        const yearOptions = Array.from({ length: 11 }, (_, i) => ({
          label: i === 0 ? "0 Years" : i === 1 ? "1 Year" : `${i} Years`,
          value: String(i),
        }));

        // Generate month options (0-12 months)
        const monthOptions = Array.from({ length: 13 }, (_, i) => ({
          label:
            i === 0
              ? "0 Month"
              : i === 1
                ? "1 Month"
                : i === 12
                  ? "12 Months"
                  : `${i} Months`,
          value: String(i),
        }));

        const handleYearChange = (opt: any) => {
          const newYears = opt?.value || "0";
          const newMonths = currentMonths || "";
          const combined = combineFixedTerm(newYears, newMonths);
          onChange(combined || "");
        };

        const handleMonthChange = (opt: any) => {
          const newMonths = opt?.value || "0";
          const newYears = currentYears || "0";
          const combined = combineFixedTerm(newYears, newMonths);
          onChange(combined || "");
        };

        const combineFixedTerm = (years: string, months: string) => {
          const y = parseInt(years) || 0;
          const m = parseInt(months) || 0;

          if (y === 0 && m === 0) return "";
          if (y === 0) return m === 1 ? "1 Month" : `${m} Months`;
          if (m === 0) return y === 1 ? "1 Year" : `${y} Years`;

          const yearPart = y === 1 ? "1 Year" : `${y} Years`;
          const monthPart = m === 1 ? "1 Month" : `${m} Months`;
          return `${yearPart} ${monthPart}`;
        };

        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {labelWithHint}
            </label>
            <div className="flex gap-3">
              <div className="flex-1">
                <Select
                  label=""
                  value={
                    currentYears
                      ? yearOptions.find((o) => o.value === currentYears) ||
                        null
                      : null
                  }
                  onChange={handleYearChange}
                  options={yearOptions}
                  placeholder="Years"
                />
              </div>
              <div className="flex-1">
                <Select
                  label=""
                  value={
                    currentMonths !== undefined && currentMonths !== ""
                      ? monthOptions.find((o) => o.value === currentMonths) ||
                        monthOptions[0] // Default to "0 Month" if not found
                      : monthOptions[0] // Default to "0 Month" when empty
                  }
                  onChange={handleMonthChange}
                  options={monthOptions}
                  placeholder="Months"
                />
              </div>
            </div>
          </div>
        );
      }

      // Special handling for awardlevel field - populate options from hourly rate data
      let opts: { label: string; value: string }[] = [];
      let isDisabled = false;
      let placeholder = field.placeholder || `Select ${field.label}`;

      if (field.key === "awardlevel" && innerSectionKey === "awardsandlevels") {
        // Get levels from hourly rate data
        if (
          hourlyRateData &&
          hourlyRateData.rates &&
          hourlyRateData.rates.length > 0
        ) {
          // Extract unique levels and sort them
          const levels = Array.from(
            new Set(hourlyRateData.rates.map((rate) => rate.level))
          ).sort((a, b) => a - b);
          opts = levels.map((level) => ({
            label: `Level ${level}`,
            value: String(level),
          }));
        } else {
          // No rates available yet
          const awardTypeId =
            draft.__inners?.["awardsandlevels"]?.["awardtype"];
          if (!awardTypeId) {
            placeholder = "Please select an award employeetype first";
            isDisabled = true;
          } else if (loadingRates) {
            placeholder = "Loading levels...";
            isDisabled = true;
          } else {
            placeholder = "No levels available for this award employeetype";
            isDisabled = true;
          }
        }
      } else {
        // Check if this is a country select field
        if (field.isCountrySelect) {
          // Use COUNTRIES list from utils
          opts = COUNTRIES;
        } else {
          // Default behavior for other select fields
          opts = (field.options || []).map((o) => ({ label: o, value: o }));
        }
      }

      // Handle multi-select fields
      if (field.isMulti) {
        // For multi-select, value should be an array
        // Handle comma-separated strings (e.g., "Italian,French,English" -> ["Italian", "French", "English"])
        let currentValues: any[] = [];
        if (Array.isArray(value)) {
          currentValues = value;
        } else if (value) {
          const strValue = String(value).trim();
          // Check if it's a comma-separated string
          if (strValue.includes(",")) {
            currentValues = strValue
              .split(",")
              .map((v) => v.trim())
              .filter((v) => v.length > 0);
          } else {
            currentValues = [strValue];
          }
        }

        return (
          <div className="space-y-1">
            {field.hint ? (
              <label className="block text-sm font-medium text-gray-700">
                {labelWithHint}
              </label>
            ) : null}
            <div className="space-y-2">
              {/* Display selected values as chips */}
              {currentValues.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {currentValues.map((val, idx) => {
                    const normalizedVal = String(val).trim();
                    const option = opts.find((o) => o.value === normalizedVal);
                    const displayLabel = option?.label || normalizedVal;
                    return (
                      <span
                        key={`${normalizedVal}-${idx}`}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm"
                      >
                        {displayLabel}
                        <button
                          type="button"
                          onClick={() => {
                            // Normalize both values for comparison
                            const newValues = currentValues.filter(
                              (v) => String(v).trim() !== normalizedVal
                            );
                            onChange(newValues);
                          }}
                          className="hover:text-blue-900 focus:outline-none"
                          aria-label={`Remove ${displayLabel}`}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <Select
                label={field.hint ? undefined : ""}
                value={null}
                onChange={(opt: any) => {
                  if (opt?.value && !currentValues.includes(opt.value)) {
                    onChange([...currentValues, opt.value]);
                  }
                }}
                options={opts.filter((o) => !currentValues.includes(o.value))}
                disabled={isDisabled}
                placeholder={
                  field.placeholder || `Add ${field.label.toLowerCase()}`
                }
                searchable={field.isCountrySelect || opts.length > 10}
              />
            </div>
          </div>
        );
      }

      // Single select
      const current = value
        ? { label: String(value), value: String(value) }
        : null;

      return (
        <div className="space-y-1">
          {field.hint ? (
            <label className="block text-sm font-medium text-gray-700">
              {labelWithHint}
            </label>
          ) : null}
          <Select
            label={field.hint ? undefined : labelText}
            value={current}
            onChange={(opt: any) => onChange(opt?.value || "")}
            options={opts}
            disabled={isDisabled}
            placeholder={field.placeholder || placeholder}
            searchable={field.isCountrySelect || opts.length > 10}
          />
        </div>
      );
    }

    if (field.type === "reference") {
      const model = field.referenceModel || "";
      let opts = referenceOptions[model] || [];

      // Special filtering for AwardEmployeeType: filter by selected award
      if (
        model === "AwardEmployeeType" &&
        innerSectionKey === "awardsandlevels"
      ) {
        const selectedAwardId = draft.__inners?.["awardsandlevels"]?.["award"];
        if (selectedAwardId) {
          const extractedAwardId =
            typeof selectedAwardId === "object" && selectedAwardId
              ? String(
                  selectedAwardId._id || selectedAwardId.id || selectedAwardId
                )
              : String(selectedAwardId);
          opts = opts.filter((opt: any) => {
            const optAwardId = opt.awardId ? String(opt.awardId) : null;
            return (
              optAwardId && String(optAwardId) === String(extractedAwardId)
            );
          });
        } else {
          // If no award is selected, show no options
          opts = [];
        }
      }

      const currentId =
        typeof value === "object" && value
          ? value._id || value.id || ""
          : value || "";
      const current =
        opts.find((o) => String(o.value) === String(currentId)) || null;

      // Disable while loading (no options yet) or if filtered options are empty
      const isLoading = model && !(model in referenceOptions);
      const isDisabled =
        isLoading ||
        (model === "AwardEmployeeType" &&
          innerSectionKey === "awardsandlevels" &&
          !draft.__inners?.["awardsandlevels"]?.["award"]);

      const placeholderText =
        field.placeholder ||
        (isLoading
          ? "Loading..."
          : isDisabled && model === "AwardEmployeeType"
            ? "Please select an award first"
            : `Select ${model || "option"}`);

      return (
        <div className="space-y-1">
          {field.hint ? (
            <label className="block text-sm font-medium text-gray-700">
              {labelWithHint}
            </label>
          ) : null}
          <Select
            label={field.hint ? undefined : labelText}
            value={current}
            onChange={(opt: any) => onChange(opt?.value || "")}
            options={opts}
            searchable
            disabled={isDisabled}
            placeholder={placeholderText}
          />
        </div>
      );
    }

    if (field.type === "file") {
      // The page likely handles file uploads in a separate modal, so keep this simple:
      return (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            {labelWithHint}
          </label>
          {value ? (
            <a
              className="inline-block text-blue-600 underline text-sm"
              target="_blank"
              href={typeof value === "string" ? value : value?.url}
            >
              View current file
            </a>
          ) : (
            <p className="text-xs text-gray-400">No file uploaded</p>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {/* top-level fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(section.fields || [])
          .filter((f) => passesShowIf(f, lookup))
          // ⬇️ hide personaldetails.employeephoto in the editor
          .filter(
            (f) =>
              !(
                section.sectionKey === "personaldetails" &&
                f.key === "employeephoto"
              )
          )
          .map((f) => (
            <div key={`top.${f.key}`}>
              {renderControl(
                f,
                (draft as any)[f.key],
                (v) => setDraft((d) => ({ ...d, [f.key]: v })),
                undefined
              )}
            </div>
          ))}
      </div>

      {/* inner groups */}
      {(section.innerSections || []).map((inn) => (
        <div key={inn.sectionKey} className="mt-8 border-t pt-6">
          <h4 className="text-sm font-semibold text-gray-800 mb-4">
            {inn.sectionLabel}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {inn.fields
              .filter((f) => passesShowIf(f, lookup))
              .map((f) => (
                <div key={`inner.${inn.sectionKey}.${f.key}`}>
                  {renderControl(
                    f,
                    draft.__inners?.[inn.sectionKey]?.[f.key],
                    (v) =>
                      setDraft((d) => ({
                        ...d,
                        __inners: {
                          ...(d.__inners || {}),
                          [inn.sectionKey]: {
                            ...(d.__inners?.[inn.sectionKey] || {}),
                            [f.key]: v,
                          },
                        },
                      })),
                    inn.sectionKey
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
    </>
  );
}
