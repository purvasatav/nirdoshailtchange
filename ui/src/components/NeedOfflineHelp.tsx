import { ExternalLink } from 'lucide-react';

interface OfficialLink {
  key: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  sub: string;
  url: string;
}

const OFFICIAL_LINKS: OfficialLink[] = [
  {
    key: 'myaadhaar',
    icon: '\u{1FAAA}',
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    title: 'UIDAI myAadhaar (Self-Service)',
    sub: 'myaadhaar.uidai.gov.in',
    url: 'https://myaadhaar.uidai.gov.in/',
  },
  {
    key: 'utiitsl',
    icon: '\u{1F4B3}',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    title: 'PAN Centre (UTIITSL)',
    sub: 'psaonline.utiitsl.com',
    url: 'https://psaonline.utiitsl.com/PanPSACenters/forms/applicationCenters',
  },
  {
    key: 'aadhaar',
    icon: '\u{1FAAA}',
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    title: 'UIDAI Aadhaar',
    sub: 'appointments.uidai.gov.in',
    url: 'https://appointments.uidai.gov.in/easearch.aspx',
  },
  {
    key: 'pan',
    icon: '\u{1F4B3}',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    title: 'PAN Centre (Protean)',
    sub: 'tinpan.proteantech.in',
    url: 'https://tinpan.proteantech.in/pan-center.html',
  },
  {
    key: 'csc',
    icon: '\u{1F3E2}',
    iconBg: 'bg-orange-50',
    iconColor: 'text-saffron-600',
    title: 'CSC Locator',
    sub: 'csc.gov.in',
    url: 'https://locator.csccloud.in/',
  },
  {
    key: 'aaple',
    icon: '\u{1F3DB}\u{FE0F}',
    iconBg: 'bg-pink-50',
    iconColor: 'text-pink-600',
    title: 'Aaple Sarkar (MH)',
    sub: 'aaplesarkar.mahaonline.gov.in',
    url: 'https://aaplesarkar.mahaonline.gov.in/en/CommonForm/SewaKendraDetails',
  },
];

export default function NeedOfflineHelp() {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-bold mb-1">Need Offline Help?</h3>
      <p className="text-sm text-slate-500 mb-4">
        Official government portals for services not yet in our local directory.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OFFICIAL_LINKS.map((link) => (
          <a
            key={link.key}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-saffron-400 hover:bg-saffron-50 transition-colors"
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0 ${link.iconBg} ${link.iconColor}`}>
              {link.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-bold">{link.title}</div>
              <div className="text-[11px] text-slate-500 truncate">{link.sub}</div>
            </div>
            <ExternalLink size={14} className="text-slate-400 shrink-0" />
          </a>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[11.5px] text-slate-500 bg-slate-100 rounded-lg px-3 py-2.5 mt-4">
        <span>ℹ️</span>
        <span>These are official government sites. You'll leave Nirdosh Vault when you tap a link.</span>
      </div>
    </div>
  );
}

