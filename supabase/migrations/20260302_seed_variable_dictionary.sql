-- Seed variable_dictionary with standard legal variables

INSERT INTO public.variable_dictionary (variable_key, description, data_type, source_table, source_field)
VALUES
  -- Borrower Info
  ('BORROWER_NAME', 'Full legal name of the borrower', 'text', 'borrowers', 'full_name'),
  ('BORROWER_ADDRESS', 'Residential address of the borrower', 'text', 'borrowers', 'address'),
  ('BORROWER_PHONE', 'Contact phone number of the borrower', 'text', 'borrowers', 'phone'),
  ('BORROWER_EMAIL', 'Email address of the borrower', 'text', 'borrowers', 'email'),
  ('BORROWER_SSN', 'Social Security Number of the borrower', 'text', 'borrowers', 'ssn'),

  -- Loan Info
  ('LOAN_AMOUNT', 'Principal amount of the loan', 'currency', 'loans', 'amount'),
  ('LOAN_DATE', 'Date of loan origination', 'date', 'loans', 'origination_date'),
  ('INTEREST_RATE', 'Annual interest rate', 'number', 'loans', 'interest_rate'),
  ('LOAN_TERM_MONTHS', 'Duration of the loan in months', 'number', 'loans', 'term_months'),
  ('LOAN_ID', 'Unique identifier for the loan', 'text', 'loans', 'loan_number'),

  -- Property Info
  ('PROPERTY_ADDRESS', 'Physical address of the collateral property', 'text', 'properties', 'address'),
  ('PROPERTY_VALUE', 'Appraised value of the property', 'currency', 'properties', 'appraised_value'),
  ('PROPERTY_TYPE', 'Type of property (e.g., Single Family, Condo)', 'text', 'properties', 'property_type'),

  -- Lender Info
  ('LENDER_NAME', 'Name of the lending institution', 'text', 'lenders', 'name'),
  ('LENDER_ADDRESS', 'Address of the lending institution', 'text', 'lenders', 'address')

ON CONFLICT (variable_key) DO UPDATE
SET 
  description = EXCLUDED.description,
  data_type = EXCLUDED.data_type,
  source_table = EXCLUDED.source_table,
  source_field = EXCLUDED.source_field;
