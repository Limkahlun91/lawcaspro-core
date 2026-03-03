import { FormSchema } from "@/components/form-engine-v2/types";
import { basicInfoSection } from "./schema/basicInfo";
import { pricingSection } from "./schema/pricing";
import { propertySection } from "./schema/property";
import { loanSection } from "./schema/loan";

export const caseSchemaV2: FormSchema = {
  id: "case-form-v2",
  title: "New Case (Enterprise)",
  sections: [
    basicInfoSection,
    pricingSection,
    propertySection,
    loanSection
  ],
};
