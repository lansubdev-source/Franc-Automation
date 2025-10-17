import React, { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  Settings as SettingsIcon,
  Save,
  Upload,
  Users,
  Star,
  Mail,
  Quote,
  Heading,
  AlignLeft,
  UserPlus,
} from "lucide-react";

const Settings: React.FC = () => {
  // Form states
  const [siteName, setSiteName] = useState("");
  const [siteDescription, setSiteDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [footerText, setFooterText] = useState("");
  const [registrationEnabled, setRegistrationEnabled] = useState(true);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [clientLogoFile, setClientLogoFile] = useState<File | null>(null);

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Placeholder: backend connection to be implemented later
    console.log({
      siteName,
      siteDescription,
      contactEmail,
      footerText,
      registrationEnabled,
      logoFile,
      faviconFile,
      clientLogoFile,
    });

    // Temporary success message
    setSuccessMessage("Settings updated successfully!");
    setErrorMessage("");
    setTimeout(() => setSuccessMessage(""), 2000);
  };

  return (
    <DashboardLayout>
      <div className="text-gray-100 min-h-screen p-6 bg-gradient-to-b from-gray-900 to-gray-950">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold flex items-center text-blue-400">
            <SettingsIcon className="mr-2" /> Site Settings
          </h2>
        </div>

        <Card className="bg-gray-800 border border-gray-700 shadow-lg">
          <CardHeader className="border-b border-gray-700 text-gray-300 font-semibold flex items-center gap-2">
            <SettingsIcon className="text-blue-400" />
            Update Site Settings
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Site Name */}
              <div>
                <label className="block mb-1 text-sm font-semibold text-gray-300">
                  <Heading className="inline w-4 h-4 mr-1 text-blue-400" />
                  Site Name
                </label>
                <Input
                  type="text"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="Enter site name"
                  className="bg-gray-900 border-gray-700 text-gray-200"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block mb-1 text-sm font-semibold text-gray-300">
                  <AlignLeft className="inline w-4 h-4 mr-1 text-blue-400" />
                  Description
                </label>
                <Textarea
                  value={siteDescription}
                  onChange={(e) => setSiteDescription(e.target.value)}
                  placeholder="Enter site description"
                  className="bg-gray-900 border-gray-700 text-gray-200"
                />
              </div>

              {/* Logo Upload */}
              <div>
                <label className="block mb-1 text-sm font-semibold text-gray-300">
                  <Upload className="inline w-4 h-4 mr-1 text-blue-400" />
                  Upload Logo
                </label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  className="bg-gray-900 border-gray-700 text-gray-200"
                />
                {logoFile && (
                  <p className="text-xs text-gray-400 mt-1">
                    Selected: {logoFile.name}
                  </p>
                )}
              </div>

              {/* Favicon */}
              <div>
                <label className="block mb-1 text-sm font-semibold text-gray-300">
                  <Star className="inline w-4 h-4 mr-1 text-blue-400" />
                  Favicon
                </label>
                <Input
                  type="file"
                  accept="image/*,.ico"
                  onChange={(e) => setFaviconFile(e.target.files?.[0] || null)}
                  className="bg-gray-900 border-gray-700 text-gray-200"
                />
                {faviconFile && (
                  <p className="text-xs text-gray-400 mt-1">
                    Selected: {faviconFile.name}
                  </p>
                )}
              </div>

              {/* Client Logo */}
              <div>
                <label className="block mb-1 text-sm font-semibold text-gray-300">
                  <Users className="inline w-4 h-4 mr-1 text-blue-400" />
                  Client Logo
                </label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setClientLogoFile(e.target.files?.[0] || null)
                  }
                  className="bg-gray-900 border-gray-700 text-gray-200"
                />
                {clientLogoFile && (
                  <p className="text-xs text-gray-400 mt-1">
                    Selected: {clientLogoFile.name}
                  </p>
                )}
              </div>

              {/* Contact Email */}
              <div>
                <label className="block mb-1 text-sm font-semibold text-gray-300">
                  <Mail className="inline w-4 h-4 mr-1 text-blue-400" />
                  Contact Email
                </label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="bg-gray-900 border-gray-700 text-gray-200"
                />
              </div>

              {/* Footer Text */}
              <div>
                <label className="block mb-1 text-sm font-semibold text-gray-300">
                  <Quote className="inline w-4 h-4 mr-1 text-blue-400" />
                  Footer Text
                </label>
                <Textarea
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  placeholder="Enter footer message"
                  className="bg-gray-900 border-gray-700 text-gray-200"
                />
              </div>

              {/* Registration Checkbox */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={registrationEnabled}
                  onChange={(e) => setRegistrationEnabled(e.target.checked)}
                  className="w-4 h-4 accent-blue-500"
                />
                <label className="text-gray-300 text-sm font-semibold">
                  <UserPlus className="inline w-4 h-4 mr-1 text-blue-400" />
                  Enable User Registration
                </label>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Save Settings
              </Button>
            </form>

            {successMessage && (
              <div className="mt-4 p-3 bg-green-700 text-green-100 rounded-md">
                {successMessage}
              </div>
            )}
            {errorMessage && (
              <div className="mt-4 p-3 bg-red-700 text-red-100 rounded-md">
                {errorMessage}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
