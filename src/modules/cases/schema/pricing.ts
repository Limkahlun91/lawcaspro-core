import { FormSection } from "@/components/form-engine-v2/types";

export const pricingSection: FormSection = {
  id: "pricing",
  title: "Pricing & Fees",
  fields: [
    {
      id: "spa_price",
      label: "SPA Price",
      type: "currency",
      validation: [{ type: "required", message: "SPA Price is required" }],
      gridCols: 6,
    },
    {
      id: "approved_purchase_price",
      label: "Approved Purchase Price",
      type: "currency",
      gridCols: 6,
    },
    {
      id: "developer_discount",
      label: "Developer Discount",
      type: "currency",
      gridCols: 6,
    },
    {
      id: "apdl_price",
      label: "APDL Price",
      type: "currency",
      gridCols: 6,
    },
    {
      id: "is_bumiputra",
      label: "Is Bumiputra?",
      type: "checkbox",
      gridCols: 6,
    },
  ],
};
