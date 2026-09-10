import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { HiSparkles, HiArrowPath, HiCheck } from "react-icons/hi2";
import { FiInfo, FiTag, FiX, FiAlertCircle } from "react-icons/fi";
import { generateAiListing } from "../services/aiService.js";
import "../styles/aiAssistant.css";

const LOADING_STEPS = [
  "Preparing product photos for analysis...",
  "Gemini Vision identifying product, brand & model...",
  "Evaluating visual condition and accessories...",
  "Estimating student campus price range & keywords...",
];

const AiAssistantCard = ({ images = [], onApplySuggestions, disabled = false }) => {
  const [sellerContext, setSellerContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [suggestions, setSuggestions] = useState(null);
  const [error, setError] = useState(null);
  const [chosenPrice, setChosenPrice] = useState("");
  const [tags, setTags] = useState([]);
  const [applied, setApplied] = useState(false);

  // Cycle through informative loading steps while awaiting Gemini
  useEffect(() => {
    let interval;
    if (loading) {
      setLoadingStepIndex(0);
      interval = setInterval(() => {
        setLoadingStepIndex((prev) => (prev + 1) % LOADING_STEPS.length);
      }, 2200);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleGenerate = async (isRegeneration = false) => {
    if (images.length === 0) {
      toast.error("Please add at least 1 product photo below first");
      return;
    }

    if (images.length > 5) {
      toast.error("Please select a maximum of 5 images for AI analysis");
      return;
    }

    setLoading(true);
    setError(null);
    setApplied(false);

    try {
      const data = await generateAiListing(images, sellerContext);
      setSuggestions(data);
      // Pre-select average estimated price
      const avgPrice = Math.round((data.estimatedPriceMin + data.estimatedPriceMax) / 2);
      setChosenPrice(avgPrice.toString());
      setTags(data.tags || []);
      toast.success(
        isRegeneration ? "Suggestions regenerated!" : "AI analysis complete! Review suggestions below."
      );
    } catch (err) {
      console.error("AI Generation error:", err);
      const msg =
        err.message ||
        "AI analysis is temporarily unavailable. You can continue creating your listing manually.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleApply = () => {
    if (!suggestions) return;

    onApplySuggestions({
      title: suggestions.suggestedTitle,
      description: suggestions.description,
      category: suggestions.category,
      condition: suggestions.condition,
      price: chosenPrice || suggestions.estimatedPriceMin.toString(),
      tags,
    });

    setApplied(true);
    toast.success("AI suggestions applied to form! You can review and edit all fields.");
  };

  const hasImages = images.length > 0;

  return (
    <div className="ai-card-shell">
      <div className="ai-header">
        <div className="ai-title-wrap">
          <div className="ai-sparkle-badge">
            <HiSparkles />
          </div>
          <div>
            <h3>AI Listing Assistant</h3>
            <p className="ai-subtitle">
              Upload photos to automatically generate title, category, condition, price & description.
            </p>
          </div>
        </div>
        <div className="ai-gemini-tag">
          <HiSparkles size={14} /> Gemini 2.5 Vision
        </div>
      </div>

      {/* Seller optional notes */}
      <div className="ai-context-group">
        <label className="ai-context-label" htmlFor="sellerContext">
          Optional seller notes (enhances AI accuracy):
        </label>
        <textarea
          id="sellerContext"
          className="ai-context-input"
          placeholder="e.g. Purchased 1 year ago for Semester 3, works flawlessly, original box and bill included..."
          value={sellerContext}
          onChange={(e) => setSellerContext(e.target.value)}
          disabled={loading || disabled}
          maxLength={500}
        />
      </div>

      {/* Action Button */}
      <div className="ai-trigger-row">
        <button
          type="button"
          className="ai-btn-generate"
          onClick={() => handleGenerate(false)}
          disabled={loading || !hasImages || disabled}
        >
          <HiSparkles size={18} />
          {loading ? "Analyzing Images..." : "Generate Listing with AI"}
        </button>

        {!hasImages && (
          <span className="ai-hint-text">
            👈 Add 1–5 product photos below to unlock AI suggestions
          </span>
        )}
        {hasImages && !loading && !suggestions && (
          <span className="ai-hint-text">
            {images.length} photo{images.length > 1 ? "s" : ""} selected — click to analyze
          </span>
        )}
      </div>

      {/* Loading Box */}
      {loading && (
        <div className="ai-loading-box">
          <HiSparkles size={32} className="ai-pulse-icon" />
          <h4 className="ai-loading-title">{LOADING_STEPS[loadingStepIndex]}</h4>
          <p className="ai-loading-desc">
            Processing image features and running Gemini multimodal inference...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="ai-error-banner">
          <FiAlertCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>AI Assistant Notice:</strong>
            <p style={{ margin: "4px 0 0" }}>{error}</p>
            <p style={{ margin: "4px 0 0", fontSize: "0.8rem", opacity: 0.9 }}>
              You can proceed to fill out the listing form manually without any issues.
            </p>
          </div>
        </div>
      )}

      {/* Structured Suggestions Panel */}
      {suggestions && !loading && (
        <div className="ai-results-panel">
          <div className="ai-result-meta-bar">
            <div className="ai-detected-product">
              <span>Detected Item:</span>
              <span className="ai-detected-tag">{suggestions.detectedProduct}</span>
            </div>

            <div
              className={`ai-confidence-pill ${suggestions.confidence < 0.75 ? "moderate" : ""}`}
              title="AI-generated confidence heuristic based on image clarity and match certainty."
            >
              <HiSparkles size={13} />
              <span>AI Confidence: {Math.round(suggestions.confidence * 100)}%</span>
            </div>
          </div>

          <div className="ai-field-grid">
            <div className="ai-field-box">
              <span className="ai-field-label">Suggested Title</span>
              <div className="ai-field-value">{suggestions.suggestedTitle}</div>
            </div>

            <div className="ai-field-box">
              <span className="ai-field-label">Category & Condition</span>
              <div className="ai-field-value">
                <strong>{suggestions.category}</strong> • <span>{suggestions.condition}</span>
              </div>
            </div>
          </div>

          <div className="ai-field-box" style={{ marginBottom: "14px" }}>
            <span className="ai-field-label">Suggested Description</span>
            <div className="ai-field-desc">{suggestions.description}</div>
          </div>

          {/* Price Range */}
          <div className="ai-price-range-wrap">
            <div>
              <span className="ai-field-label">Estimated Campus Resale Price</span>
              <div className="ai-price-figures">
                <span className="ai-price-amount">
                  ₹{suggestions.estimatedPriceMin} – ₹{suggestions.estimatedPriceMax}
                </span>
              </div>
            </div>

            <div className="ai-price-buttons">
              <button
                type="button"
                className="ai-btn-price-apply"
                onClick={() => setChosenPrice(suggestions.estimatedPriceMin.toString())}
              >
                Min ₹{suggestions.estimatedPriceMin}
              </button>
              <button
                type="button"
                className="ai-btn-price-apply"
                onClick={() =>
                  setChosenPrice(
                    Math.round(
                      (suggestions.estimatedPriceMin + suggestions.estimatedPriceMax) / 2
                    ).toString()
                  )
                }
              >
                Avg ₹
                {Math.round(
                  (suggestions.estimatedPriceMin + suggestions.estimatedPriceMax) / 2
                )}
              </button>
              <button
                type="button"
                className="ai-btn-price-apply"
                onClick={() => setChosenPrice(suggestions.estimatedPriceMax.toString())}
              >
                Max ₹{suggestions.estimatedPriceMax}
              </button>
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div style={{ marginBottom: "14px" }}>
              <span className="ai-field-label">Searchable Tags</span>
              <div className="ai-tags-row">
                {tags.map((t) => (
                  <span className="ai-tag-chip" key={t}>
                    <FiTag size={11} />
                    {t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                      aria-label={`Remove tag ${t}`}
                    >
                      <FiX size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Observations notes */}
          {suggestions.notes && suggestions.notes.length > 0 && (
            <div className="ai-disclaimer" style={{ marginBottom: "10px" }}>
              <FiInfo size={14} style={{ flexShrink: 0 }} />
              <span>Notes: {suggestions.notes.join("; ")}</span>
            </div>
          )}

          {/* Actions Bar */}
          <div className="ai-actions-bar">
            <button
              type="button"
              className="ai-btn-generate"
              onClick={handleApply}
              style={{ background: applied ? "var(--color-sage)" : "var(--gradient-cta)" }}
            >
              {applied ? <HiCheck size={18} /> : <HiSparkles size={18} />}
              {applied ? "Suggestions Applied!" : "Use Suggestions in Form"}
            </button>

            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => handleGenerate(true)}
              disabled={loading}
            >
              <HiArrowPath size={14} /> Regenerate
            </button>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSuggestions(null)}
            >
              Dismiss
            </button>
          </div>

          <div className="ai-disclaimer">
            <FiInfo size={13} />
            AI-generated estimate. You can freely edit any field before submitting your listing.
          </div>
        </div>
      )}
    </div>
  );
};

export default AiAssistantCard;
