export async function POST(request) {
  try {
    // Debug: Log environment variables (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log("Environment check:", {
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        appUrl: process.env.APP_URL,
        openAIKeyPrefix: process.env.OPENAI_API_KEY?.substring(0, 10) + "...",
      });
    }
    
    const input = await request.json();

    // Extract inputs
    const {
      patient_age_years,
      sex,
      cxr_view,
      model_name = "cxr-osteoflag-v0",
      xray_image,
      risk_factors = {},
      bmd = {},
    } = input;

    // CRITICAL: Ignore postmenopausal for male patients
    if (sex === "male" && risk_factors.postmenopausal !== undefined) {
      risk_factors.postmenopausal = null;
    }

    let model_risk_score_0_1;
    let model_uncertainty_0_1;

    // If X-ray image is provided, analyze it with vision model
    if (xray_image) {
      try {
        // Use OpenAI API directly if API key is available, otherwise use integration proxy
        const useDirectAPI = !!process.env.OPENAI_API_KEY;
        const apiUrl = useDirectAPI
          ? "https://api.openai.com/v1/chat/completions"
          : `${process.env.APP_URL || "http://localhost:4000"}/integrations/gpt-vision/`;
        
        const headers = {
          "Content-Type": "application/json",
        };
        
        if (useDirectAPI) {
          headers["Authorization"] = `Bearer ${process.env.OPENAI_API_KEY}`;
        }

        const visionResponse = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(
            useDirectAPI
              ? {
                  model: "gpt-4o",
                  messages: [
                    {
                      role: "system",
                      content:
                        'You are a medical AI assistant specialized in analyzing chest X-rays for osteoporosis risk assessment. Analyze bone density indicators visible in the X-ray, particularly rib cage density, vertebral body appearance, and cortical thickness. Respond in STRICT JSON format with exactly these fields: {"model_name": "cxr-osteoflag-v0", "model_risk_score_0_1": <number 0-1>, "model_uncertainty_0_1": <number 0-1>}.',
                    },
                    {
                      role: "user",
                      content: [
                        {
                          type: "text",
                          text: `Analyze this chest X-ray for osteoporosis risk. Patient age: ${patient_age_years || "unknown"}, Sex: ${sex}, View: ${cxr_view}. Provide model_risk_score_0_1 and model_uncertainty_0_1 as JSON.`,
                        },
                        {
                          type: "image_url",
                          image_url: {
                            url: xray_image,
                          },
                        },
                      ],
                    },
                  ],
                  max_tokens: 300,
                }
              : {
                  messages: [
                    {
                      role: "system",
                      content: [
                        {
                          type: "text",
                          text: 'You are a medical AI assistant specialized in analyzing chest X-rays for osteoporosis risk assessment. Analyze bone density indicators visible in the X-ray, particularly rib cage density, vertebral body appearance, and cortical thickness. Respond in STRICT JSON format with exactly these fields: {"model_name": "cxr-osteoflag-v0", "model_risk_score_0_1": <number 0-1>, "model_uncertainty_0_1": <number 0-1>}.',
                        },
                      ],
                    },
                    {
                      role: "user",
                      content: [
                        {
                          type: "text",
                          text: `Analyze this chest X-ray for osteoporosis risk. Patient age: ${patient_age_years || "unknown"}, Sex: ${sex}, View: ${cxr_view}. Provide model_risk_score_0_1 and model_uncertainty_0_1 as JSON.`,
                        },
                        {
                          type: "image_url",
                          image_url: {
                            url: xray_image,
                          },
                        },
                      ],
                    },
                  ],
                }
          ),
        });

        if (!visionResponse.ok) {
          const errorText = await visionResponse.text();
          console.error("Vision API error:", {
            status: visionResponse.status,
            statusText: visionResponse.statusText,
            error: errorText,
            url: apiUrl,
            useDirectAPI,
          });
          throw new Error(
            `Vision API failed: ${visionResponse.status} - ${errorText}`,
          );
        }

        const visionData = await visionResponse.json();
        console.log("Vision API response:", visionData);
        
        if (!visionData.choices || !visionData.choices[0] || !visionData.choices[0].message) {
          console.error("Invalid vision API response structure:", visionData);
          throw new Error("Invalid response format from vision API");
        }
        
        const aiResponse = visionData.choices[0].message.content;

        // Parse the AI response to extract risk score and uncertainty
        try {
          const parsed = JSON.parse(aiResponse);
          model_risk_score_0_1 = parsed.model_risk_score_0_1 ?? parsed.risk_score ?? 0;
          model_uncertainty_0_1 = parsed.model_uncertainty_0_1 ?? parsed.uncertainty ?? null;
        } catch (e) {
          console.log(
            "Could not parse JSON, using regex fallback. AI response:",
            aiResponse,
          );
          // If JSON parsing fails, try to extract numbers from text
          const riskMatch = aiResponse.match(/model_risk_score_0_1["\s:]+([0-9.]+)/i) ||
                           aiResponse.match(/risk[_\s]score["\s:]+([0-9.]+)/i);
          const uncertaintyMatch = aiResponse.match(/model_uncertainty_0_1["\s:]+([0-9.]+)/i) ||
                                  aiResponse.match(/uncertainty["\s:]+([0-9.]+)/i);
          model_risk_score_0_1 = riskMatch ? parseFloat(riskMatch[1]) : 0.5;
          model_uncertainty_0_1 = uncertaintyMatch
            ? parseFloat(uncertaintyMatch[1])
            : 0.3;
        }
      } catch (visionError) {
        console.error("Vision processing error:", visionError);
        throw new Error(
          `Failed to analyze X-ray image: ${visionError.message}`,
        );
      }
    } else {
      // Use provided scores if no image
      model_risk_score_0_1 = input.model_risk_score_0_1 || 0;
      model_uncertainty_0_1 = input.model_uncertainty_0_1 ?? null;
    }

    // Calculate risk_score_0_100
    let risk_score_0_100 = Math.round(model_risk_score_0_1 * 100);

    // Apply BMD refinement if available and confidence is high
    if (bmd?.available === true && bmd?.femoral_neck_t_score !== null && bmd?.femoral_neck_t_score !== undefined) {
      const t_score = bmd.femoral_neck_t_score;
      const extraction_confidence = bmd.extraction_confidence_0_1 ?? 1.0;
      
      // Only apply if confidence >= 0.8 or manual entry (confidence null/undefined treated as manual)
      if (extraction_confidence === null || extraction_confidence === undefined || extraction_confidence >= 0.8) {
        if (t_score <= -2.5) {
          risk_score_0_100 = Math.min(100, risk_score_0_100 + 20);
        } else if (t_score >= -2.4 && t_score <= -1.0) {
          risk_score_0_100 = Math.min(100, risk_score_0_100 + 10);
        }
        // T >= -1.0: no change
      }
    }

    // Determine risk band
    let risk_band;
    if (risk_score_0_100 <= 24) {
      risk_band = "low";
    } else if (risk_score_0_100 <= 49) {
      risk_band = "moderate";
    } else if (risk_score_0_100 <= 74) {
      risk_band = "high";
    } else {
      risk_band = "very_high";
    }

    // Count high impact factors (ignore postmenopausal for males)
    const high_impact_factors = [];
    if (sex === "female" && risk_factors.postmenopausal === true) {
      high_impact_factors.push(true);
    }
    if (risk_factors.long_term_glucocorticoids === true) {
      high_impact_factors.push(true);
    }
    if (risk_factors.prior_low_trauma_fracture === true) {
      high_impact_factors.push(true);
    }
    if (risk_factors.rheumatoid_arthritis === true) {
      high_impact_factors.push(true);
    }
    const high_impact_count = high_impact_factors.length;

    // Count moderate impact factors
    const moderate_impact_factors = [
      risk_factors.low_body_weight === true,
      risk_factors.smoking === true,
      risk_factors.parental_hip_fracture === true,
      risk_factors.alcohol_high === true,
      risk_factors.secondary_osteoporosis === true,
    ];
    const moderate_impact_count = moderate_impact_factors.filter(
      (f) => f === true,
    ).length;

    // Apply flag rules per spec
    let is_flag_candidate = false;
    
    // Rule 1: Probability >= 0.50
    if (model_risk_score_0_1 >= 0.5) {
      is_flag_candidate = true;
    }
    // Rule 2: Probability >= 0.40 AND >=1 high-impact factor
    else if (model_risk_score_0_1 >= 0.4 && high_impact_count >= 1) {
      is_flag_candidate = true;
    }
    // Rule 3: Probability >= 0.35 AND >=2 moderate-impact factors
    else if (model_risk_score_0_1 >= 0.35 && moderate_impact_count >= 2) {
      is_flag_candidate = true;
    }
    // Rule 4: BMD T-score <= -2.5
    else if (bmd?.available === true && bmd?.femoral_neck_t_score !== null && bmd?.femoral_neck_t_score !== undefined) {
      const t_score = bmd.femoral_neck_t_score;
      const extraction_confidence = bmd.extraction_confidence_0_1 ?? 1.0;
      if ((extraction_confidence === null || extraction_confidence === undefined || extraction_confidence >= 0.8) && t_score <= -2.5) {
        is_flag_candidate = true;
      }
    }

    // Check uncertainty conditions (needs_review gate)
    const has_high_uncertainty =
      (model_uncertainty_0_1 !== null && model_uncertainty_0_1 >= 0.35) ||
      patient_age_years === null ||
      cxr_view === "unknown";

    // Determine final screening_flag
    let screening_flag;
    if (has_high_uncertainty && risk_score_0_100 < 85) {
      screening_flag = "needs_review";
    } else if (is_flag_candidate) {
      screening_flag = "flag";
    } else {
      screening_flag = "no_flag";
    }

    // Determine urgency per spec
    let urgency;
    if (
      (bmd?.available === true && bmd?.femoral_neck_t_score !== null && bmd?.femoral_neck_t_score !== undefined && bmd.femoral_neck_t_score <= -2.5) ||
      risk_factors.prior_low_trauma_fracture === true ||
      risk_factors.long_term_glucocorticoids === true ||
      risk_score_0_100 >= 85
    ) {
      urgency = "priority";
    } else if (
      (risk_score_0_100 >= 50 && risk_score_0_100 <= 84) ||
      risk_factors.rheumatoid_arthritis === true ||
      (sex === "female" && risk_factors.postmenopausal === true && risk_score_0_100 >= 40)
    ) {
      urgency = "soon";
    } else {
      urgency = "routine";
    }

    // Prepare inputs for LLM layer
    const llmInputs = {
      patient_age_years,
      sex,
      cxr_view,
      model_name,
      model_risk_score_0_1,
      model_uncertainty_0_1,
      risk_factors: {
        postmenopausal: sex === "male" ? null : risk_factors.postmenopausal,
        long_term_glucocorticoids: risk_factors.long_term_glucocorticoids ?? null,
        prior_low_trauma_fracture: risk_factors.prior_low_trauma_fracture ?? null,
        rheumatoid_arthritis: risk_factors.rheumatoid_arthritis ?? null,
        low_body_weight: risk_factors.low_body_weight ?? null,
        smoking: risk_factors.smoking ?? null,
        parental_hip_fracture: risk_factors.parental_hip_fracture ?? null,
        alcohol_high: risk_factors.alcohol_high ?? null,
        secondary_osteoporosis: risk_factors.secondary_osteoporosis ?? null,
      },
      bmd: {
        available: bmd?.available === true,
        femoral_neck_t_score: bmd?.femoral_neck_t_score ?? null,
        extraction_confidence_0_1: bmd?.extraction_confidence_0_1 ?? null,
      },
    };

    // Call LLM layer with exact system prompt from spec
    const SYSTEM_PROMPT = `You are AiHealth OsteoFlag, a clinical decision support assistant for opportunistic osteoporosis risk screening using chest X-ray derived signals.

You do NOT diagnose.
You ONLY flag risk and recommend confirmatory assessment when appropriate.

Hard safety rules:
1. Never state or imply osteoporosis, osteopenia, or low bone mineral density as confirmed.
2. Never use the words "diagnosis" or "diagnosed".
3. Never recommend treatment or medication.
4. Only suggest DXA or clinician review.
5. Use only the provided inputs. Do not invent data.
6. Output must be STRICT JSON only.

Inputs you may receive:
{
  "patient_age_years": number | null,
  "sex": "female" | "male" | "other" | "unknown",
  "cxr_view": "PA" | "AP" | "lateral" | "unknown",
  "model_name": string,
  "model_risk_score_0_1": number,
  "model_uncertainty_0_1": number | null,
  "risk_factors": {
    "postmenopausal": true | false | null,
    "long_term_glucocorticoids": true | false | null,
    "prior_low_trauma_fracture": true | false | null,
    "rheumatoid_arthritis": true | false | null,
    "low_body_weight": true | false | null,
    "smoking": true | false | null,
    "parental_hip_fracture": true | false | null,
    "alcohol_high": true | false | null,
    "secondary_osteoporosis": true | false | null
  },
  "bmd": {
    "available": true | false,
    "femoral_neck_t_score": number | null,
    "extraction_confidence_0_1": number | null
  }
}

Rules:
- Ignore postmenopausal field completely if sex is male.
- Convert model_risk_score_0_1 to risk_score_0_100.
- Apply risk bands and escalation logic.
- Apply BMD refinement only if confidence is high.
- If uncertainty is high or inputs missing, return needs_review.

Output JSON (exactly this):
{
  "screening_flag": "flag" | "no_flag" | "needs_review",
  "risk_score_0_100": number,
  "risk_band": "low" | "moderate" | "high" | "very_high",
  "urgency": "routine" | "soon" | "priority",
  "summary_one_liner": string,
  "recommendation_clinician": string,
  "patient_facing_message": string,
  "safety_disclaimer": string,
  "audit": {
    "inputs_used": string[],
    "logic_trace": string
  }
}

Safety disclaimer must include:
- This is a screening support tool, not a diagnosis.
- Confirmatory testing such as DXA may be needed.
- Clinical context and clinician judgement are required.`;

    let llmOutput;
    try {
      // Use OpenAI API directly if API key is available, otherwise use integration proxy
      const useDirectAPI = !!process.env.OPENAI_API_KEY;
      const apiUrl = useDirectAPI
        ? "https://api.openai.com/v1/chat/completions"
        : `${process.env.APP_URL || "http://localhost:4000"}/integrations/openai/chat/completions`;
      
      const headers = {
        "Content-Type": "application/json",
      };
      
      if (useDirectAPI) {
        headers["Authorization"] = `Bearer ${process.env.OPENAI_API_KEY}`;
      }

      // Try LLM endpoint - fallback gracefully if unavailable
      const llmResponse = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "gpt-4o", // Use gpt-4o which supports json_object response format
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: `Process this screening input and return STRICT JSON only:\n\n${JSON.stringify(llmInputs, null, 2)}`,
            },
          ],
          temperature: 0.1,
          response_format: { type: "json_object" },
        }),
      });

      if (llmResponse.ok) {
        const llmData = await llmResponse.json();
        const llmContent = llmData.choices[0]?.message?.content;
        if (llmContent) {
          llmOutput = JSON.parse(llmContent);
        }
      }
    } catch (llmError) {
      console.error("LLM processing error (using fallback):", llmError);
      // Fallback to deterministic logic if LLM fails
      llmOutput = null;
    }

    // Helper function to sanitize text and remove diagnostic language
    const sanitizeText = (text) => {
      if (!text || typeof text !== 'string') return text;
      // Replace diagnostic language with screening language
      return text
        .replace(/\b(diagnos(ed|is|ed with))\b/gi, 'screening indicates')
        .replace(/\b(has osteoporosis|has osteopenia|confirmed osteoporosis|confirmed osteopenia)\b/gi, 'shows risk indicators')
        .replace(/\b(patient has|patient is diagnosed with)\b/gi, 'screening suggests')
        .replace(/\b(treat|treatment|medication|prescribe)\b/gi, 'consider clinical evaluation');
    };

    // Use LLM output if available, otherwise fallback to deterministic logic
    let output;
    if (llmOutput && llmOutput.screening_flag) {
      // Validate LLM output matches our deterministic flag
      // Use LLM for phrasing but ensure flag matches logic and sanitize diagnostic language
      output = {
        ...llmOutput,
        screening_flag, // Override with deterministic flag for safety
        risk_score_0_100, // Override with calculated score
        risk_band, // Override with calculated band
        urgency, // Override with calculated urgency
        // Sanitize all text fields to remove any diagnostic language
        summary_one_liner: sanitizeText(llmOutput.summary_one_liner),
        recommendation_clinician: sanitizeText(llmOutput.recommendation_clinician),
        patient_facing_message: sanitizeText(llmOutput.patient_facing_message),
        safety_disclaimer: sanitizeText(llmOutput.safety_disclaimer) || "This is a screening support tool, not a diagnosis. Confirmatory testing such as DXA may be needed. Clinical context and clinician judgement are required.",
      };
    } else {
      // Fallback deterministic output
      // Generate summary one-liner
      let summary_one_liner;
      if (screening_flag === "flag") {
        summary_one_liner = `Model indicates ${risk_band} risk for low bone mineral density. Clinical review and confirmatory testing recommended.`;
      } else if (screening_flag === "needs_review") {
        summary_one_liner = `Screening requires clinical review due to uncertainty or missing data. Risk score suggests ${risk_band} risk.`;
      } else {
        summary_one_liner = `Model indicates ${risk_band} risk for low bone mineral density. No immediate flag, but consider clinical context.`;
      }

      // Generate clinician recommendation
      let recommendation_clinician;
      if (screening_flag === "flag") {
        if (urgency === "priority") {
          recommendation_clinician =
            "Priority follow-up recommended. Consider DXA scan to assess bone mineral density. Review patient history for fracture risk factors and medication optimization.";
        } else if (urgency === "soon") {
          recommendation_clinician =
            "Timely follow-up recommended. Consider DXA scan to confirm bone mineral density status. Review clinical context and risk factors.";
        } else {
          recommendation_clinician =
            "Routine follow-up recommended. Consider DXA scan based on clinical judgement and patient risk profile.";
        }
      } else if (screening_flag === "needs_review") {
        recommendation_clinician =
          "Manual review required due to high model uncertainty or incomplete data. Consider obtaining additional clinical information and possibly DXA scan based on clinical suspicion.";
      } else {
        recommendation_clinician =
          "No immediate action flagged by screening tool. Continue routine clinical assessment. Consider DXA if clinical context warrants further evaluation.";
      }

      // Generate patient-facing message
      let patient_facing_message;
      if (screening_flag === "flag") {
        patient_facing_message =
          "Your chest X-ray screening suggests you may benefit from a bone density test. Your healthcare provider will discuss next steps with you.";
      } else if (screening_flag === "needs_review") {
        patient_facing_message =
          "Your screening results require additional review by your healthcare provider. They will discuss any next steps with you.";
      } else {
        patient_facing_message =
          "Your chest X-ray screening did not identify concerns requiring immediate bone density testing. Your provider will continue to monitor your bone health.";
      }

      // Safety disclaimer
      const safety_disclaimer =
        "This is a screening support tool, not a diagnosis. Confirmatory testing such as DXA may be needed. Clinical context and clinician judgement are required.";

      // Build audit trail
      const inputs_used = [];
      if (patient_age_years !== null)
        inputs_used.push(`age=${patient_age_years}`);
      inputs_used.push(`sex=${sex}`);
      inputs_used.push(`cxr_view=${cxr_view}`);
      inputs_used.push(`model=${model_name}`);
      inputs_used.push(`risk_score=${model_risk_score_0_1}`);
      if (model_uncertainty_0_1 !== null)
        inputs_used.push(`uncertainty=${model_uncertainty_0_1}`);

      Object.entries(llmInputs.risk_factors).forEach(([key, value]) => {
        if (value !== null) {
          inputs_used.push(`${key}=${value}`);
        }
      });

      if (bmd?.available === true) {
        inputs_used.push(`bmd_available=true`);
        if (bmd?.femoral_neck_t_score !== null) {
          inputs_used.push(`bmd_t_score=${bmd.femoral_neck_t_score}`);
        }
      }

      const logic_trace = `Risk score ${model_risk_score_0_1} → ${risk_score_0_100}/100 → ${risk_band} band. High-impact factors: ${high_impact_count}. Moderate-impact factors: ${moderate_impact_count}. Uncertainty check: ${has_high_uncertainty}. Flag candidate: ${is_flag_candidate}. Final: ${screening_flag}. Urgency: ${urgency}.`;

      output = {
        screening_flag,
        risk_score_0_100,
        risk_band,
        urgency,
        summary_one_liner,
        recommendation_clinician,
        patient_facing_message,
        safety_disclaimer,
        audit: {
          inputs_used,
          logic_trace,
        },
      };
    }

    return Response.json(output);
  } catch (error) {
    console.error("Screening error:", error);
    console.error("Error stack:", error.stack);
    console.error("Error message:", error.message);
    // Per spec: backend logs full error, returns structured failure
    // Include more details in development
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? `Unable to complete screening: ${error.message}` 
      : "Unable to complete screening. Please retry.";
    return Response.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
