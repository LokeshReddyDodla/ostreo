"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Info,
  Download,
  Copy,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";

export default function OsteoFlagDashboard() {
  const [formData, setFormData] = useState({
    patient_age_years: 58,
    sex: "female",
    cxr_view: "PA",
    model_name: "cxr-osteoflag-v0",
    model_risk_score_0_1: null,
    model_uncertainty_0_1: null,
    risk_factors: {
      postmenopausal: true,
      long_term_glucocorticoids: null,
      prior_low_trauma_fracture: null,
      rheumatoid_arthritis: null,
      low_body_weight: null,
      smoking: null,
      parental_hip_fracture: null,
      alcohol_high: null,
      secondary_osteoporosis: null,
    },
    bmd: {
      available: false,
      femoral_neck_t_score: null,
      extraction_confidence_0_1: null,
    },
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [xrayPreview, setXrayPreview] = useState(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        setXrayPreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setXrayPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!xrayPreview) {
        throw new Error("Please upload an X-ray image");
      }

      const response = await fetch("/api/osteo-screening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          xray_image: xrayPreview,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Per spec: Never show HTTP errors, show user-friendly message
        throw new Error(
          errorData.error || "Unable to complete screening. Please retry.",
        );
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      // Per spec: Frontend shows user-friendly message
      setError("Unable to complete screening. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      patient_age_years: null,
      sex: "unknown",
      cxr_view: "unknown",
      model_name: "cxr-osteoflag-v0",
      model_risk_score_0_1: null,
      model_uncertainty_0_1: null,
      risk_factors: {
        postmenopausal: null,
        long_term_glucocorticoids: null,
        prior_low_trauma_fracture: null,
        rheumatoid_arthritis: null,
        low_body_weight: null,
        smoking: null,
        parental_hip_fracture: null,
        alcohol_high: null,
        secondary_osteoporosis: null,
      },
      bmd: {
        available: false,
        femoral_neck_t_score: null,
        extraction_confidence_0_1: null,
      },
    });
    setXrayPreview(null);
    setResult(null);
    setError(null);
  };

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    }
  };

  const getFlagColor = (flag) => {
    switch (flag) {
      case "flag":
        return "text-[#DC2626] bg-[#FEE2E2]";
      case "needs_review":
        return "text-[#D97706] bg-[#FEF3C7]";
      case "no_flag":
        return "text-[#059669] bg-[#D1FAE5]";
      default:
        return "text-[#6B7280] bg-[#F3F4F6]";
    }
  };

  const getRiskBandColor = (band) => {
    switch (band) {
      case "very_high":
        return "bg-[#DC2626]";
      case "high":
        return "bg-[#F59E0B]";
      case "moderate":
        return "bg-[#3B82F6]";
      case "low":
        return "bg-[#10B981]";
      default:
        return "bg-[#6B7280]";
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      {/* Header */}
      <header className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1600px] mx-auto px-8 py-6">
          <div className="flex items-center gap-3">
            <Activity size={32} className="text-[#3B82F6]" strokeWidth={2} />
            <div>
              <h1 className="text-2xl font-bold text-[#111827] font-inter">
                Osteo AiHealth
              </h1>
              <p className="text-sm text-[#6B7280] font-inter">
                Clinical Decision Support for Osteoporosis Risk Screening
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <div className="max-w-[1600px] mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Panel - Input Form */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm">
              <div className="px-6 py-5 border-b border-[#E5E7EB]">
                <h2 className="text-lg font-semibold text-[#111827] font-inter">
                  Patient Data Input
                </h2>
                <p className="text-sm text-[#6B7280] mt-1 font-inter">
                  Upload X-ray and enter patient information
                </p>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* X-ray Upload */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-[#374151] uppercase tracking-wide font-inter">
                    X-ray Upload
                  </h3>

                  {!xrayPreview ? (
                    <div className="border-2 border-dashed border-[#D1D5DB] rounded-lg p-8 text-center hover:border-[#3B82F6] transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="xray-upload"
                      />
                      <label htmlFor="xray-upload" className="cursor-pointer">
                        <Upload
                          size={48}
                          className="text-[#9CA3AF] mx-auto mb-3"
                        />
                        <p className="text-sm font-medium text-[#374151] mb-1 font-inter">
                          Upload Chest X-ray
                        </p>
                        <p className="text-xs text-[#6B7280] font-inter">
                          Click to browse or drag and drop
                        </p>
                      </label>
                    </div>
                  ) : (
                    <div className="relative">
                      <img
                        src={xrayPreview}
                        alt="X-ray preview"
                        className="w-full rounded-lg border border-[#E5E7EB]"
                      />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute top-2 right-2 bg-[#DC2626] text-white p-2 rounded-full hover:bg-[#B91C1C] transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Patient Demographics */}
                <div className="space-y-4 pt-4 border-t border-[#E5E7EB]">
                  <h3 className="text-sm font-semibold text-[#374151] uppercase tracking-wide font-inter">
                    Patient Demographics
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-2 font-inter">
                      Age (years)
                    </label>
                    <input
                      type="number"
                      value={formData.patient_age_years || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          patient_age_years: e.target.value
                            ? parseInt(e.target.value)
                            : null,
                        })
                      }
                      className="w-full px-4 py-2 border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent font-inter"
                      placeholder="Enter age"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-2 font-inter">
                      Sex
                    </label>
                    <select
                      value={formData.sex}
                      onChange={(e) => {
                        const newSex = e.target.value;
                        // Per spec: Clear postmenopausal for male patients
                        const updatedRiskFactors = { ...formData.risk_factors };
                        if (newSex === "male") {
                          updatedRiskFactors.postmenopausal = null;
                        }
                        setFormData({
                          ...formData,
                          sex: newSex,
                          risk_factors: updatedRiskFactors,
                        });
                      }}
                      className="w-full px-4 py-2 border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent font-inter"
                    >
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="other">Other</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>
                </div>

                {/* X-ray Details */}
                <div className="space-y-4 pt-4 border-t border-[#E5E7EB]">
                  <h3 className="text-sm font-semibold text-[#374151] uppercase tracking-wide font-inter">
                    X-ray Details
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-2 font-inter">
                      CXR View
                    </label>
                    <select
                      value={formData.cxr_view}
                      onChange={(e) =>
                        setFormData({ ...formData, cxr_view: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent font-inter"
                    >
                      <option value="PA">PA (Posterior-Anterior)</option>
                      <option value="AP">AP (Anterior-Posterior)</option>
                      <option value="lateral">Lateral</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>
                </div>

                {/* Risk Factors */}
                <div className="space-y-4 pt-4 border-t border-[#E5E7EB]">
                  <h3 className="text-sm font-semibold text-[#374151] uppercase tracking-wide font-inter">
                    Risk Factors
                  </h3>

                  {Object.keys(formData.risk_factors)
                    .filter((factor) => {
                      // Per spec: Hide postmenopausal for male patients
                      if (factor === "postmenopausal" && formData.sex === "male") {
                        return false;
                      }
                      return true;
                    })
                    .map((factor) => (
                      <div
                        key={factor}
                        className="flex items-center justify-between"
                      >
                        <label className="text-sm text-[#374151] font-inter capitalize">
                          {factor.replace(/_/g, " ")}
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                risk_factors: {
                                  ...formData.risk_factors,
                                  [factor]: true,
                                },
                              })
                            }
                            className={`px-3 py-1 text-xs rounded-md font-medium transition-colors font-inter ${
                              formData.risk_factors[factor] === true
                                ? "bg-[#3B82F6] text-white"
                                : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"
                            }`}
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                risk_factors: {
                                  ...formData.risk_factors,
                                  [factor]: false,
                                },
                              })
                            }
                            className={`px-3 py-1 text-xs rounded-md font-medium transition-colors font-inter ${
                              formData.risk_factors[factor] === false
                                ? "bg-[#6B7280] text-white"
                                : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"
                            }`}
                          >
                            No
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                risk_factors: {
                                  ...formData.risk_factors,
                                  [factor]: null,
                                },
                              })
                            }
                            className={`px-3 py-1 text-xs rounded-md font-medium transition-colors font-inter ${
                              formData.risk_factors[factor] === null
                                ? "bg-[#D1D5DB] text-[#374151]"
                                : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"
                            }`}
                          >
                            Unknown
                          </button>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Optional BMD/DXA */}
                <div className="space-y-4 pt-4 border-t border-[#E5E7EB]">
                  <h3 className="text-sm font-semibold text-[#374151] uppercase tracking-wide font-inter">
                    Optional DXA / BMD Data
                  </h3>

                  <div className="flex items-center justify-between">
                    <label className="text-sm text-[#374151] font-inter">
                      BMD Available
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            bmd: {
                              ...formData.bmd,
                              available: true,
                            },
                          })
                        }
                        className={`px-3 py-1 text-xs rounded-md font-medium transition-colors font-inter ${
                          formData.bmd.available === true
                            ? "bg-[#3B82F6] text-white"
                            : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            bmd: {
                              available: false,
                              femoral_neck_t_score: null,
                              extraction_confidence_0_1: null,
                            },
                          })
                        }
                        className={`px-3 py-1 text-xs rounded-md font-medium transition-colors font-inter ${
                          formData.bmd.available === false
                            ? "bg-[#6B7280] text-white"
                            : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>

                  {formData.bmd.available && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-[#374151] mb-2 font-inter">
                          Femoral Neck T-score
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={formData.bmd.femoral_neck_t_score ?? ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bmd: {
                                ...formData.bmd,
                                femoral_neck_t_score: e.target.value
                                  ? parseFloat(e.target.value)
                                  : null,
                              },
                            })
                          }
                          className="w-full px-4 py-2 border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent font-inter"
                          placeholder="e.g., -2.5"
                        />
                        <p className="text-xs text-[#6B7280] mt-1 font-inter">
                          Note: T-scores are never displayed to patients
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-[#374151] mb-2 font-inter">
                          Extraction Confidence (0-1)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="1"
                          value={formData.bmd.extraction_confidence_0_1 ?? ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bmd: {
                                ...formData.bmd,
                                extraction_confidence_0_1: e.target.value
                                  ? parseFloat(e.target.value)
                                  : null,
                              },
                            })
                          }
                          className="w-full px-4 py-2 border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent font-inter"
                          placeholder="0.8 or higher (or leave empty for manual entry)"
                        />
                        <p className="text-xs text-[#6B7280] mt-1 font-inter">
                          Leave empty for manual entry
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-[#3B82F6] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#2563EB] active:bg-[#1D4ED8] disabled:bg-[#9CA3AF] disabled:cursor-not-allowed transition-colors font-inter"
                  >
                    {loading ? "Analyzing..." : "Run Screening"}
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-6 py-3 rounded-lg font-semibold border border-[#D1D5DB] text-[#374151] hover:bg-[#F9FAFB] active:bg-[#F3F4F6] transition-colors font-inter flex items-center gap-2"
                  >
                    <RefreshCw size={16} />
                    Reset
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Panel - Results */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm">
              <div className="px-6 py-5 border-b border-[#E5E7EB] flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#111827] font-inter">
                    Screening Results
                  </h2>
                  <p className="text-sm text-[#6B7280] mt-1 font-inter">
                    AI-powered risk assessment and clinical recommendations
                  </p>
                </div>
                {result && (
                  <button
                    onClick={copyToClipboard}
                    className="px-4 py-2 text-sm rounded-lg border border-[#D1D5DB] text-[#374151] hover:bg-[#F9FAFB] transition-colors font-inter flex items-center gap-2"
                  >
                    <Copy size={16} />
                    Copy JSON
                  </button>
                )}
              </div>

              <div className="p-6">
                {error && (
                  <div className="bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <AlertTriangle
                        size={20}
                        className="text-[#DC2626] flex-shrink-0 mt-0.5"
                      />
                      <div>
                        <h3 className="text-sm font-semibold text-[#DC2626] font-inter">
                          Error
                        </h3>
                        <p className="text-sm text-[#991B1B] mt-1 font-inter">
                          {error}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!result && !error && (
                  <div className="text-center py-16">
                    <Info size={48} className="text-[#D1D5DB] mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-[#6B7280] font-inter">
                      No results yet
                    </h3>
                    <p className="text-sm text-[#9CA3AF] mt-2 font-inter">
                      Upload an X-ray image and click "Run Screening" to view AI
                      analysis
                    </p>
                  </div>
                )}

                {result && (
                  <div className="space-y-6">
                    {/* Screening Flag */}
                    <div className="bg-[#F9FAFB] rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-[#374151] uppercase tracking-wide font-inter">
                          Screening Status
                        </h3>
                        <span
                          className={`px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wide ${getFlagColor(result.screening_flag)} font-inter`}
                        >
                          {result.screening_flag.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-[#111827] font-medium font-inter">
                        {result.summary_one_liner}
                      </p>
                    </div>

                    {/* Risk Score & Band */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#F9FAFB] rounded-lg p-6">
                        <div className="text-sm text-[#6B7280] mb-2 font-inter">
                          Risk Score
                        </div>
                        <div className="text-4xl font-bold text-[#111827] font-inter">
                          {result.risk_score_0_100}
                          <span className="text-lg text-[#6B7280]">/100</span>
                        </div>
                      </div>
                      <div className="bg-[#F9FAFB] rounded-lg p-6">
                        <div className="text-sm text-[#6B7280] mb-2 font-inter">
                          Risk Band
                        </div>
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-3 h-3 rounded-full ${getRiskBandColor(result.risk_band)}`}
                          ></div>
                          <span className="text-2xl font-bold text-[#111827] capitalize font-inter">
                            {result.risk_band.replace(/_/g, " ")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Urgency */}
                    <div className="bg-[#F9FAFB] rounded-lg p-6">
                      <div className="text-sm text-[#6B7280] mb-2 font-inter">
                        Urgency Level
                      </div>
                      <div className="text-xl font-semibold text-[#111827] capitalize font-inter">
                        {result.urgency}
                      </div>
                    </div>

                    {/* Recommendations */}
                    <div className="space-y-4">
                      <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-5">
                        <div className="flex items-start gap-3">
                          <Info
                            size={20}
                            className="text-[#3B82F6] flex-shrink-0 mt-0.5"
                          />
                          <div>
                            <h4 className="text-sm font-semibold text-[#1E40AF] mb-2 font-inter">
                              Clinician Recommendation
                            </h4>
                            <p className="text-sm text-[#1E3A8A] font-inter">
                              {result.recommendation_clinician}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-5">
                        <div className="flex items-start gap-3">
                          <CheckCircle2
                            size={20}
                            className="text-[#059669] flex-shrink-0 mt-0.5"
                          />
                          <div>
                            <h4 className="text-sm font-semibold text-[#065F46] mb-2 font-inter">
                              Patient Message
                            </h4>
                            <p className="text-sm text-[#064E3B] font-inter">
                              {result.patient_facing_message}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Safety Disclaimer */}
                    <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-lg p-5">
                      <div className="flex items-start gap-3">
                        <AlertTriangle
                          size={20}
                          className="text-[#D97706] flex-shrink-0 mt-0.5"
                        />
                        <div>
                          <h4 className="text-sm font-semibold text-[#92400E] mb-2 font-inter">
                            Safety Disclaimer
                          </h4>
                          <p className="text-sm text-[#78350F] font-inter">
                            {result.safety_disclaimer}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Raw JSON Toggle */}
                    <div className="pt-4">
                      <button
                        onClick={() => setShowRawJson(!showRawJson)}
                        className="text-sm text-[#3B82F6] hover:text-[#2563EB] font-semibold font-inter"
                      >
                        {showRawJson ? "Hide" : "Show"} Raw JSON Output
                      </button>

                      {showRawJson && (
                        <pre className="mt-4 bg-[#1F2937] text-[#F9FAFB] p-4 rounded-lg text-xs overflow-x-auto font-mono">
                          {JSON.stringify(result, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom fonts */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        .font-inter {
          font-family: 'Inter', sans-serif;
        }
      `}</style>
    </div>
  );
}
