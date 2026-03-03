import { FormSection } from "@/components/form-engine-v2/types";

export const basicInfoSection: FormSection = {
  id: "basic-info",
  title: "Basic Information",
  fields: [
    {
      id: "project_id",
      label: "Project",
      type: "select",
      validation: [{ type: "required", message: "Project is required" }],
      gridCols: 6,
      options: [], // Will be loaded dynamically
    },
    {
      id: "file_no",
      label: "File No",
      type: "text",
      validation: [{ type: "required", message: "File No is required" }],
      gridCols: 6,
    },
    {
      id: "client_name",
      label: "Client Name (Ref)",
      type: "text",
      validation: [{ type: "required", message: "Client Name is required" }],
      gridCols: 6,
    },
    {
      id: "purchase_mode",
      label: "Purchase Mode",
      type: "select",
      options: [
        { label: "Loan", value: "LOAN" },
        { label: "Cash", value: "CASH" },
        { label: "Others", value: "OTHERS" },
      ],
      validation: [{ type: "required", message: "Purchase Mode is required" }],
      gridCols: 6,
      defaultValue: "LOAN",
    },
    {
      id: "unit_category",
      label: "Unit Category",
      type: "select",
      options: [
        { label: "Residential", value: "RESIDENTIAL" },
        { label: "Commercial", value: "COMMERCIAL" },
        { label: "Industrial", value: "INDUSTRIAL" },
        { label: "Agricultural", value: "AGRICULTURAL" },
        { label: "Land", value: "LAND" },
      ],
      validation: [{ type: "required", message: "Unit Category is required" }],
      gridCols: 6,
      defaultValue: "RESIDENTIAL",
    },
    {
      id: "unit_no",
      label: "Unit No",
      type: "text",
      gridCols: 6,
    },
  ],
};
