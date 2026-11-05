"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Globe2,
  Mail,
  MapPin,
  Phone,
  Save,
  Loader2,
  Upload,
  Trash2,
} from "lucide-react";
import { CompanyProfile } from "@/lib/api/settings";
import { TIMEZONE_OPTIONS } from "../types";

export interface BusinessTabProps {
  compName: string;
  setCompName: (v: string) => void;
  legalName: string;
  setLegalName: (v: string) => void;
  industry: string;
  setIndustry: (v: string) => void;
  businessEmail: string;
  setBusinessEmail: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  website: string;
  setWebsite: (v: string) => void;
  country: string;
  setCountry: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
  businessDesc: string;
  setBusinessDesc: (v: string) => void;
  timezone: string;
  setTimezone: (v: string) => void;
  saveCompanyProfile: () => Promise<void>;
  savingSection: string | null;
  handleCompanyLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleCompanyLogoRemove: () => Promise<void>;
  uploadingLogo: boolean;
  currentCompany: CompanyProfile | null;
  companyLogoInputRef: React.RefObject<HTMLInputElement | null>;
  logoVersion: number;
  companyLogoUrl: string | null;
}

export default function BusinessTab({
  compName,
  setCompName,
  legalName,
  setLegalName,
  industry,
  setIndustry,
  businessEmail,
  setBusinessEmail,
  phone,
  setPhone,
  website,
  setWebsite,
  country,
  setCountry,
  address,
  setAddress,
  businessDesc,
  setBusinessDesc,
  timezone,
  setTimezone,
  saveCompanyProfile,
  savingSection,
  handleCompanyLogoUpload,
  handleCompanyLogoRemove,
  uploadingLogo,
  currentCompany,
  companyLogoInputRef,
  logoVersion,
  companyLogoUrl,
}: BusinessTabProps) {
  return (
<Card className="border-[#D5E4DB] bg-white shadow-sm overflow-hidden">
          <CardContent className="p-7 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-[#19372B] flex items-center gap-2">
                  <Building2 size={19} className="text-[#087F5B]" />
                  Company & Workspace Profile
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update business identity, contact details, official office address, and uploaded brand logo.
                </p>
              </div>
              <Button
                onClick={saveCompanyProfile}
                disabled={savingSection === "business" || !currentCompany}
                className="bg-[#0C4A31] hover:bg-[#093A27] text-white text-xs font-bold"
              >
                {savingSection === "business" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save Business Profile
              </Button>
            </div>

            {/* Logo Preview & Upload Section */}
            <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-r from-[#F7FAF8] to-white p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                <div className="flex items-center gap-5">
                  <div className="relative grid h-20 w-20 place-items-center rounded-2xl border-2 border-dashed border-[#BDE0C8] bg-white shadow-sm overflow-hidden p-2">
                    {companyLogoUrl ? (
                      <img
                        key={companyLogoUrl}
                        src={companyLogoUrl}
                        alt="Company Logo"
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <Building2 className="text-slate-300" size={32} />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-800">Workspace Brand Logo</p>
                      {companyLogoUrl ? (
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          Active & Uploaded
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          No Logo Uploaded
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Displayed on caller screens, customer portals, and GST invoices. PNG, SVG, JPG. Max 2MB.
                    </p>

                    <div className="mt-3 flex items-center gap-2">
                      <input
                        ref={companyLogoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleCompanyLogoUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={uploadingLogo || !currentCompany}
                        onClick={() => companyLogoInputRef.current?.click()}
                        className="bg-[#0C4A31] hover:bg-[#093A27] text-white text-xs font-bold"
                      >
                        {uploadingLogo ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {companyLogoUrl ? "Replace Logo" : "Upload Logo"}
                      </Button>

                      {companyLogoUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadingLogo}
                          onClick={handleCompanyLogoRemove}
                          className="border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold"
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-white p-3 text-xs text-slate-600 space-y-1">
                  <p className="font-bold text-slate-800">Tenant Slug: <span className="font-mono text-[#0C4A31]">{currentCompany?.slug || "—"}</span></p>
                  <p className="text-[11px] text-slate-400">Plan: <span className="font-medium text-slate-700 capitalize">{currentCompany?.plan || "Standard"}</span></p>
                </div>
              </div>
            </div>

            {/* Profile Input Grid */}
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Company / Organization Name
                </label>
                <Input
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  placeholder="e.g. ZeniaOne Technologies"
                  className="font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Legal Entity Name
                </label>
                <Input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="e.g. ZeniaOne Private Limited"
                  className="font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Industry & Category
                </label>
                <Input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g. Healthcare, Telephony AI, FinTech"
                  className="text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Business Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium focus:border-[#285A42] focus:outline-none"
                >
                  {TIMEZONE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Mail size={12} className="text-slate-400" /> Business Contact Email
                </label>
                <Input
                  type="email"
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                  placeholder="support@zeniaone.ai"
                  className="text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Phone size={12} className="text-slate-400" /> Primary Phone Number
                </label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 90998 87880"
                  className="text-xs font-medium font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Globe2 size={12} className="text-slate-400" /> Website URL
                </label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://zeniaone.ai"
                  className="text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Country
                </label>
                <Input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="India"
                  className="text-xs font-medium"
                />
              </div>
            </div>

            {/* Office Address Full Width */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                <MapPin size={13} className="text-[#087F5B]" /> Official Physical Office Address
              </label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="305, Capitol Icon, Opp. Aashka Hospital, Nr. Sargasan Cross Road, Gandhinagar, Gujarat 382421, India"
                className="text-xs font-medium"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Used in AI customer assistant responses whenever callers ask "where is your clinic/office located?".
              </p>
            </div>

            {/* Business Description */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Business Description & Overview
              </label>
              <Textarea
                rows={3}
                value={businessDesc}
                onChange={(e) => setBusinessDesc(e.target.value)}
                placeholder="Provide a clear overview of services, core offerings, and specialties to align voice agents..."
                className="text-xs leading-relaxed"
              />
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button
                onClick={saveCompanyProfile}
                disabled={savingSection === "business" || !currentCompany}
                className="bg-[#0C4A31] hover:bg-[#093A27] text-white text-xs font-bold"
              >
                {savingSection === "business" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save Business Profile
              </Button>
            </div>
          </CardContent>
        </Card>
  );
}
