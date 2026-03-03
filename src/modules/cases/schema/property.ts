import { FormSection } from "@/components/form-engine-v2/types";

export const propertySection: FormSection = {
  id: "property",
  title: "Property Details",
  fields: [
    // Hidden field to store project_type for conditions
    {
        id: "project_type",
        label: "Project Type",
        type: "text",
        hidden: true
    },
    // Common Fields
    {
      id: "building_type",
      label: "Building Type",
      type: "text",
      gridCols: 6,
    },
    {
      id: "unit_type",
      label: "Unit Type",
      type: "text",
      gridCols: 6,
    },
    // LANDED Fields
    {
      id: "developer_parcel_no",
      label: "Developer Parcel No",
      type: "text",
      gridCols: 6,
      conditions: [{ field: "project_type", operator: "eq", value: "LANDED" }]
    },
    {
      id: "land_area",
      label: "Land Area (sq ft)",
      type: "number",
      gridCols: 6,
      conditions: [{ field: "project_type", operator: "eq", value: "LANDED" }]
    },
    {
      id: "build_up_area",
      label: "Build Up Area (sq ft)",
      type: "number",
      gridCols: 6,
      conditions: [{ field: "project_type", operator: "eq", value: "LANDED" }]
    },
    // HIGHRISE Fields (Also applies to TOWNHOUSE/COMMERCIAL/MIXED usually, but strict for now)
    // Assuming 'HIGHRISE' for now. We might need 'neq LANDED' logic?
    // Engine supports 'neq'. So let's use 'neq LANDED' for Highrise fields?
    // User said: "LANDED displays X", "HIGHRISE displays Y".
    // Let's use specific inclusion for Highrise.
    {
      id: "parcel_area",
      label: "Parcel Area (sq ft)",
      type: "number",
      gridCols: 6,
      conditions: [{ field: "project_type", operator: "eq", value: "HIGHRISE" }]
    },
    {
      id: "storey_no",
      label: "Storey No",
      type: "text",
      gridCols: 6,
      conditions: [{ field: "project_type", operator: "eq", value: "HIGHRISE" }]
    },
    {
      id: "building_no",
      label: "Building No",
      type: "text",
      gridCols: 6,
      conditions: [{ field: "project_type", operator: "eq", value: "HIGHRISE" }]
    },
    {
      id: "car_park_no",
      label: "Car Park No",
      type: "text",
      gridCols: 6,
      conditions: [{ field: "project_type", operator: "eq", value: "HIGHRISE" }]
    },
    {
      id: "car_park_level",
      label: "Car Park Level",
      type: "text",
      gridCols: 6,
      conditions: [{ field: "project_type", operator: "eq", value: "HIGHRISE" }]
    },
    {
      id: "accessory_parcel_no",
      label: "Accessory Parcel No",
      type: "text",
      gridCols: 6,
      conditions: [{ field: "project_type", operator: "eq", value: "HIGHRISE" }]
    },
    {
      id: "share_units",
      label: "Share Units",
      type: "text",
      gridCols: 6,
      conditions: [{ field: "project_type", operator: "eq", value: "HIGHRISE" }]
    },
  ],
};
