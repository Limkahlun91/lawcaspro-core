
// src/modules/gov/ubl.generator.ts

export interface InvoiceData {
    invoiceNo: string;
    issueDate: string; // YYYY-MM-DD
    issueTime: string; // HH:mm:ss
    supplier: {
        name: string;
        tin: string;
        regNo: string;
        msic: string; // Default '69101'
        contact: string;
        email: string;
        address: Address;
    };
    buyer: {
        name: string;
        tin: string;
        idType: string; // NRIC, BRN, PASSPORT, ARMY
        idValue: string;
        contact: string;
        email: string;
        address: Address;
    };
    items: InvoiceLineItem[];
    totalExclTax: number;
    totalTax: number;
    totalInclTax: number;
}

export interface Address {
    line1: string;
    line2?: string;
    city: string;
    state: string; // State Code e.g. '14' for KL
    country: string; // 'MYS'
    postalCode: string;
}

export interface InvoiceLineItem {
    description: string;
    quantity: number;
    unitPrice: number;
    taxType: string; // '01' or '06'
    taxRate: number;
    taxAmount: number;
    subtotal: number;
}

export const generateUBL = (data: InvoiceData) => {
    // Helper to format decimals to 2 places
    const fmt = (num: number) => num.toFixed(2);

    // Hardcoded MSIC as per requirement (Legal Activities)
    const MSIC_CODE = '69101'; 

    // Construct UBL 2.1 JSON Structure (Simplified for MyInvois)
    // Note: The actual structure is complex XML or specific JSON schema.
    // Assuming we are generating the JSON payload for the API.

    const payload = {
        "_D": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
        "_A": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
        "_B": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
        "Invoice": [{
            "ID": [{ "_": data.invoiceNo }],
            "IssueDate": [{ "_": data.issueDate }],
            "IssueTime": [{ "_": data.issueTime }],
            "InvoiceTypeCode": [{ "_": "01", "listVersionID": "1.0" }], // 01 = Invoice
            "DocumentCurrencyCode": [{ "_": "MYR" }],
            "TaxCurrencyCode": [{ "_": "MYR" }],
            "AccountingSupplierParty": [{
                "Party": [{
                    "PartyIdentification": [{
                        "ID": [{ "_": data.supplier.tin, "schemeID": "TIN" }]
                    }, {
                        "ID": [{ "_": data.supplier.regNo, "schemeID": "BRN" }]
                    }],
                    "PartyName": [{ "Name": [{ "_": data.supplier.name }] }],
                    "PostalAddress": [{
                        "CityName": [{ "_": data.supplier.address.city }],
                        "PostalZone": [{ "_": data.supplier.address.postalCode }],
                        "CountrySubentityCode": [{ "_": data.supplier.address.state }],
                        "AddressLine": [{ "Line": [{ "_": data.supplier.address.line1 }] }],
                        "Country": [{ "IdentificationCode": [{ "_": "MYS" }] }]
                    }],
                    "PartyLegalEntity": [{ "RegistrationName": [{ "_": data.supplier.name }] }],
                    "Contact": [{
                        "Telephone": [{ "_": data.supplier.contact }],
                        "ElectronicMail": [{ "_": data.supplier.email }]
                    }],
                    // Industry Classification
                    "IndustryClassificationCode": [{ "_": MSIC_CODE, "name": "Legal activities" }] 
                }]
            }],
            "AccountingCustomerParty": [{
                "Party": [{
                    "PartyIdentification": [{
                        "ID": [{ "_": data.buyer.tin, "schemeID": "TIN" }]
                    }, {
                        "ID": [{ "_": data.buyer.idValue, "schemeID": data.buyer.idType }]
                    }],
                    "PartyName": [{ "Name": [{ "_": data.buyer.name }] }],
                    "PostalAddress": [{
                        "CityName": [{ "_": data.buyer.address.city }],
                        "PostalZone": [{ "_": data.buyer.address.postalCode }],
                        "CountrySubentityCode": [{ "_": data.buyer.address.state }],
                        "AddressLine": [{ "Line": [{ "_": data.buyer.address.line1 }] }],
                        "Country": [{ "IdentificationCode": [{ "_": "MYS" }] }]
                    }],
                    "Contact": [{
                        "Telephone": [{ "_": data.buyer.contact }],
                        "ElectronicMail": [{ "_": data.buyer.email }]
                    }]
                }]
            }],
            "TaxTotal": [{
                "TaxAmount": [{ "_": fmt(data.totalTax), "currencyID": "MYR" }]
            }],
            "LegalMonetaryTotal": [{
                "LineExtensionAmount": [{ "_": fmt(data.totalExclTax), "currencyID": "MYR" }],
                "TaxExclusiveAmount": [{ "_": fmt(data.totalExclTax), "currencyID": "MYR" }],
                "TaxInclusiveAmount": [{ "_": fmt(data.totalInclTax), "currencyID": "MYR" }],
                "PayableAmount": [{ "_": fmt(data.totalInclTax), "currencyID": "MYR" }]
            }],
            "InvoiceLine": data.items.map((item, index) => ({
                "ID": [{ "_": (index + 1).toString() }],
                "InvoicedQuantity": [{ "_": item.quantity, "unitCode": "C62" }], // C62 = Unit
                "LineExtensionAmount": [{ "_": fmt(item.subtotal), "currencyID": "MYR" }],
                "Item": [{
                    "Description": [{ "_": item.description }],
                    "ClassifiedTaxCategory": [{
                        "ID": [{ "_": item.taxType }], // 01 or 06
                        "Percent": [{ "_": item.taxRate }]
                    }]
                }],
                "Price": [{
                    "PriceAmount": [{ "_": fmt(item.unitPrice), "currencyID": "MYR" }]
                }]
            }))
        }]
    };

    return payload;
};
