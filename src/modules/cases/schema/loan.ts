import { FormSection } from "@/components/form-engine-v2/types";

export const loanSection: FormSection = {
  id: "loan",
  title: "Loan Information",
  fields: [
    {
      id: "purchase_mode",
      label: "Purchase Mode",
      type: "select",
      options: [
        { label: "Loan", value: "LOAN" },
        { label: "Cash", value: "CASH" },
        { label: "Others", value: "OTHERS" },
      ],
      hidden: true, // Used for condition check, but already in Basic Info
    },
    {
      id: "bank_name",
      label: "Bank Name",
      type: "text",
      conditions: [{ field: "purchase_mode", operator: "eq", value: "LOAN" }],
      gridCols: 6,
    },
    {
      id: "bank_branch",
      label: "Bank Branch",
      type: "text",
      conditions: [{ field: "purchase_mode", operator: "eq", value: "LOAN" }],
      gridCols: 6,
    },
    {
      id: "property_financing_sum",
      label: "Financing Sum",
      type: "currency",
      conditions: [{ field: "purchase_mode", operator: "eq", value: "LOAN" }],
      gridCols: 6,
    },
    {
      id: "total_loan",
      label: "Total Loan",
      type: "currency",
      conditions: [{ field: "purchase_mode", operator: "eq", value: "LOAN" }],
      gridCols: 6,
    },
    {
      id: "party_type",
      label: "Party Type",
      type: "select",
      options: [
        { label: "1st Party (Same as Purchaser)", value: "1ST_PARTY" },
        { label: "3rd Party (Different Borrower)", value: "3RD_PARTY" },
      ],
      conditions: [{ field: "purchase_mode", operator: "eq", value: "LOAN" }],
      gridCols: 6,
    },
  ],
};
