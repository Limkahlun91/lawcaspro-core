import { ExternalLink, ShieldCheck, FileText, Globe } from 'lucide-react'

export default function GovGateway() {
  const links = [
    {
      title: 'EFS Kehakiman',
      description: 'E-Filing System for Court Documents',
      url: 'https://efs.kehakiman.gov.my/',
      icon: ShieldCheck,
      color: 'bg-blue-100 text-blue-600'
    },
    {
      title: 'eCKHT (LHDN)',
      description: 'Real Property Gains Tax (RPGT) Submission',
      url: 'https://mytax.hasil.gov.my/',
      icon: FileText,
      color: 'bg-green-100 text-green-600'
    },
    {
      title: 'e-Duti Setem',
      description: 'Stamp Duty Assessment & Payment',
      url: 'https://stamps.hasil.gov.my/',
      icon: FileText,
      color: 'bg-purple-100 text-purple-600'
    },
    {
      title: 'MyTax Portal',
      description: 'LHDN Main Tax Dashboard',
      url: 'https://mytax.hasil.gov.my/',
      icon: Globe,
      color: 'bg-yellow-100 text-yellow-600'
    },
    {
      title: 'SSM e-Info',
      description: 'Company & Business Information',
      url: 'https://www.ssm-einfo.my/',
      icon: Globe,
      color: 'bg-orange-100 text-orange-600'
    },
    {
      title: 'e-Tanah',
      description: 'Land Office Online Search',
      url: 'https://etanah.gov.my/',
      icon: Globe,
      color: 'bg-teal-100 text-teal-600'
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-[#003366]">Government Gateway</h2>
          <p className="text-gray-500 text-sm">Direct access to essential government and court portals.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {links.map((link) => (
          <a 
            key={link.title}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl ${link.color}`}>
                <link.icon size={24} />
              </div>
              <ExternalLink size={18} className="text-gray-400 group-hover:text-blue-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 group-hover:text-[#003366]">{link.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{link.description}</p>
          </a>
        ))}
      </div>
    </div>
  )
}
