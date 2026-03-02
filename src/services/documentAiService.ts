
// Mock AI Document Analysis Service
// Simulates extracting structured legal data from SPA/Loan Agreements/ID Documents

export interface ExtractedData {
  purchaser_name?: string;
  ic_no?: string;
  spa_price?: number;
  unit_no?: string;
  project_name?: string;
  file_ref?: string;
  property_address?: string;
  vendor_name?: string;
  doc_type?: 'SPA' | 'LOAN' | 'ID';
}

export const documentAiService = {
  analyzeDocument: async (file: File): Promise<ExtractedData> => {
    console.log(`AI Analysis started for: ${file.name}`);
    
    // Simulate network delay for AI processing
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Mock logic based on file name triggers (for demo purposes)
    const fileName = file.name.toLowerCase();
    
    // Default Mock Data
    let data: ExtractedData = {
      doc_type: 'SPA',
      purchaser_name: 'AHMAD BIN ABDULLAH',
      ic_no: '850101-14-1234',
      spa_price: 550000.00,
      unit_no: 'A-12-05',
      project_name: 'Eco Grandeur',
      property_address: 'No. 5, Jalan Eco 1, 40170 Shah Alam, Selangor',
      vendor_name: 'Eco World Development Sdn Bhd'
    };

    if (fileName.includes('loan')) {
      data = {
        ...data,
        doc_type: 'LOAN',
        spa_price: 500000.00, // Loan amount usually lower
        vendor_name: 'PUBLIC BANK BERHAD'
      };
    } else if (fileName.includes('ic') || fileName.includes('mykad')) {
      data = {
        doc_type: 'ID',
        purchaser_name: 'LIM KAH LUN',
        ic_no: '901212-10-5566',
        property_address: '123, Jalan Gasing, 46000 Petaling Jaya'
      };
    }

    return data;
  }
};
