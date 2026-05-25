use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::tokens::types::TokenEvent;

const LITELLM_PRICING_URL: &str =
    "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";

/// How long the LiteLLM pricing cache is considered fresh (24 hours).
const CACHE_TTL_SECS: u64 = 86_400;

// ── Public types ──────────────────────────────────────────────────────────────

/// Per-model pricing information.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModelPricing {
    pub model: String,
    pub provider: String,
    pub input_cost_per_1m: f64,
    pub output_cost_per_1m: f64,
    pub cache_read_cost_per_1m: Option<f64>,
    pub cache_write_cost_per_1m: Option<f64>,
    pub max_input_tokens: Option<u64>,
}

// ── LiteLLM JSON format ───────────────────────────────────────────────────────

/// Raw entry from LiteLLM's model_prices_and_context_window.json
#[derive(Deserialize, Debug)]
struct LiteLLMEntry {
    #[serde(default)]
    input_cost_per_token: Option<f64>,
    #[serde(default)]
    output_cost_per_token: Option<f64>,
    #[serde(default)]
    cache_read_input_token_cost: Option<f64>,
    #[serde(default)]
    cache_creation_input_token_cost: Option<f64>,
    #[serde(default)]
    litellm_provider: Option<String>,
    #[serde(default)]
    max_input_tokens: Option<u64>,
}

/// Disk cache envelope — wraps the pricing map with a timestamp.
#[derive(Serialize, Deserialize)]
struct PricingCacheFile {
    fetched_at: u64, // unix epoch seconds
    prices: HashMap<String, ModelPricing>,
}

// ── Static fallback ───────────────────────────────────────────────────────────

/// Hardcoded prices used when the LiteLLM fetch is unavailable.
/// Source: https://platform.claude.com/docs/en/about-claude/models (2026-05)
fn static_pricing_map() -> HashMap<String, ModelPricing> {
    let mut map = HashMap::new();

    // (model, input $/1M, output $/1M, cache_read, cache_write, max_input_tokens)
    let claude: &[(&str, f64, f64, Option<f64>, Option<f64>, Option<u64>)] = &[
        // Current generation
        (
            "claude-opus-4-7",
            5.0,
            25.0,
            Some(0.5),
            Some(6.25),
            Some(1_000_000),
        ),
        (
            "claude-opus-4-6",
            5.0,
            25.0,
            Some(0.5),
            Some(6.25),
            Some(1_000_000),
        ),
        (
            "claude-sonnet-4-6",
            3.0,
            15.0,
            Some(0.3),
            Some(3.75),
            Some(1_000_000),
        ),
        (
            "claude-haiku-4-5-20251001",
            1.0,
            5.0,
            Some(0.1),
            Some(1.25),
            Some(200_000),
        ),
        (
            "claude-haiku-4-5",
            1.0,
            5.0,
            Some(0.1),
            Some(1.25),
            Some(200_000),
        ),
        // Legacy
        (
            "claude-opus-4-5-20251101",
            5.0,
            25.0,
            Some(0.5),
            Some(6.25),
            Some(200_000),
        ),
        (
            "claude-opus-4-5",
            5.0,
            25.0,
            Some(0.5),
            Some(6.25),
            Some(200_000),
        ),
        (
            "claude-opus-4-1-20250805",
            15.0,
            75.0,
            Some(1.5),
            Some(18.75),
            Some(200_000),
        ),
        (
            "claude-opus-4-1",
            15.0,
            75.0,
            Some(1.5),
            Some(18.75),
            Some(200_000),
        ),
        (
            "claude-sonnet-4-5-20250929",
            3.0,
            15.0,
            Some(0.3),
            Some(3.75),
            Some(200_000),
        ),
        (
            "claude-sonnet-4-5",
            3.0,
            15.0,
            Some(0.3),
            Some(3.75),
            Some(200_000),
        ),
        (
            "claude-opus-4-20250514",
            15.0,
            75.0,
            Some(1.5),
            Some(18.75),
            Some(200_000),
        ),
        (
            "claude-sonnet-4-20250514",
            3.0,
            15.0,
            Some(0.3),
            Some(3.75),
            Some(200_000),
        ),
        (
            "claude-3-5-sonnet-20241022",
            3.0,
            15.0,
            Some(0.3),
            Some(3.75),
            Some(200_000),
        ),
        (
            "claude-3-5-haiku-20241022",
            1.0,
            5.0,
            Some(0.1),
            Some(1.25),
            Some(200_000),
        ),
        (
            "claude-haiku-3-5",
            1.0,
            5.0,
            Some(0.1),
            Some(1.25),
            Some(200_000),
        ),
        (
            "claude-3-haiku-3",
            0.25,
            1.25,
            Some(0.03),
            Some(0.3),
            Some(200_000),
        ),
    ];

    for &(model, input, output, cr, cw, ctx) in claude {
        map.insert(
            model.to_string(),
            ModelPricing {
                model: model.to_string(),
                provider: "anthropic".to_string(),
                input_cost_per_1m: input,
                output_cost_per_1m: output,
                cache_read_cost_per_1m: cr,
                cache_write_cost_per_1m: cw,
                max_input_tokens: ctx,
            },
        );
    }

    let openai: &[(&str, f64, f64, Option<f64>, Option<f64>, Option<u64>)] = &[
        ("gpt-5.5", 5.0, 30.0, Some(0.5), None, Some(1_047_576)),
        ("gpt-5", 2.5, 10.0, Some(0.625), None, Some(1_047_576)),
        ("gpt-4o", 2.5, 10.0, Some(1.25), None, Some(128_000)),
        ("gpt-4o-mini", 0.15, 0.6, Some(0.075), None, Some(128_000)),
        ("gpt-4.1", 2.0, 8.0, Some(0.5), None, Some(1_047_576)),
        ("gpt-4.1-mini", 0.4, 1.6, Some(0.1), None, Some(1_047_576)),
        ("gpt-4-turbo", 10.0, 30.0, None, None, Some(128_000)),
        ("o3", 10.0, 40.0, Some(2.5), None, Some(200_000)),
        ("o4-mini", 1.1, 4.4, Some(0.275), None, Some(200_000)),
    ];

    for &(model, input, output, cr, cw, ctx) in openai {
        map.insert(
            model.to_string(),
            ModelPricing {
                model: model.to_string(),
                provider: "openai".to_string(),
                input_cost_per_1m: input,
                output_cost_per_1m: output,
                cache_read_cost_per_1m: cr,
                cache_write_cost_per_1m: cw,
                max_input_tokens: ctx,
            },
        );
    }

    let deepseek: &[(&str, f64, f64, Option<f64>, Option<f64>, Option<u64>)] = &[
        (
            "deepseek-v4-flash",
            0.14,
            0.28,
            Some(0.003),
            None,
            Some(1_048_576),
        ),
        (
            "deepseek-v4-pro",
            1.74,
            3.48,
            Some(0.004),
            None,
            Some(1_048_576),
        ),
        ("deepseek-v3", 0.27, 1.1, Some(0.07), None, Some(1_048_576)),
        ("deepseek-r1", 0.55, 2.19, Some(0.14), None, Some(1_048_576)),
    ];

    for &(model, input, output, cr, cw, ctx) in deepseek {
        map.insert(
            model.to_string(),
            ModelPricing {
                model: model.to_string(),
                provider: "deepseek".to_string(),
                input_cost_per_1m: input,
                output_cost_per_1m: output,
                cache_read_cost_per_1m: cr,
                cache_write_cost_per_1m: cw,
                max_input_tokens: ctx,
            },
        );
    }

    let gemini: &[(&str, f64, f64, Option<u64>)] = &[
        ("gemini-2.5-pro", 2.5, 10.0, Some(1_048_576)),
        ("gemini-2.5-flash", 0.15, 0.6, Some(1_048_576)),
        ("gemini-2.0-flash", 0.1, 0.4, Some(1_048_576)),
    ];

    for &(model, input, output, ctx) in gemini {
        map.insert(
            model.to_string(),
            ModelPricing {
                model: model.to_string(),
                provider: "google".to_string(),
                input_cost_per_1m: input,
                output_cost_per_1m: output,
                cache_read_cost_per_1m: None,
                cache_write_cost_per_1m: None,
                max_input_tokens: ctx,
            },
        );
    }

    map
}

// ── PricingService ────────────────────────────────────────────────────────────

/// Pricing service with LiteLLM HTTP fetch + disk cache + static fallback.
/// Lookup order: in-memory → LiteLLM cache → static table → prefix match.
pub struct PricingService {
    static_map: HashMap<String, ModelPricing>,
    cache_path: PathBuf,
    /// In-memory cache: model_name -> pricing
    prices: HashMap<String, ModelPricing>,
}

impl PricingService {
    pub fn new() -> Self {
        let cache_path = dirs::home_dir()
            .unwrap_or_default()
            .join(".glyphic")
            .join("pricing_cache.json");

        let mut service = PricingService {
            static_map: static_pricing_map(),
            cache_path,
            prices: HashMap::new(),
        };

        // Load disk cache (from previous fetch) first so we have prices fast.
        service.load_cache();
        service
    }

    fn cache_dir(&self) -> PathBuf {
        self.cache_path
            .parent()
            .unwrap_or(&PathBuf::from("/tmp"))
            .to_path_buf()
    }

    fn now_epoch() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0)
    }

    /// Returns true if the disk cache exists and is younger than CACHE_TTL_SECS.
    fn cache_is_fresh(&self) -> bool {
        if let Ok(content) = fs::read_to_string(&self.cache_path) {
            if let Ok(envelope) = serde_json::from_str::<PricingCacheFile>(&content) {
                let age = Self::now_epoch().saturating_sub(envelope.fetched_at);
                return age < CACHE_TTL_SECS;
            }
        }
        false
    }

    /// Fetch LiteLLM pricing JSON and merge into in-memory + disk cache.
    /// Spawns a background thread so it never blocks callers.
    pub fn try_fetch_litellm(&mut self) {
        if self.cache_is_fresh() {
            return; // disk cache is still valid
        }

        // Clone what we need to move into the thread.
        let cache_path = self.cache_path.clone();
        let cache_dir = self.cache_dir();

        std::thread::spawn(move || {
            eprintln!("pricing: fetching LiteLLM prices from GitHub…");
            let result = Self::fetch_litellm_blocking();
            match result {
                Ok(new_prices) => {
                    eprintln!("pricing: fetched {} model prices", new_prices.len());
                    let envelope = PricingCacheFile {
                        fetched_at: Self::now_epoch(),
                        prices: new_prices,
                    };
                    if let Ok(json) = serde_json::to_string(&envelope) {
                        let _ = fs::create_dir_all(&cache_dir);
                        let _ = fs::write(&cache_path, json);
                        eprintln!("pricing: saved LiteLLM cache to disk");
                    }
                }
                Err(e) => {
                    eprintln!(
                        "pricing: LiteLLM fetch failed (will use static fallback): {}",
                        e
                    );
                }
            }
        });
    }

    /// Blocking HTTP fetch + parse of LiteLLM's pricing JSON.
    fn fetch_litellm_blocking() -> Result<HashMap<String, ModelPricing>, String> {
        let response = reqwest::blocking::get(LITELLM_PRICING_URL)
            .map_err(|e| format!("HTTP error: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("HTTP {}", response.status()));
        }

        let raw: HashMap<String, serde_json::Value> = response
            .json()
            .map_err(|e| format!("JSON parse error: {}", e))?;

        let mut prices = HashMap::new();
        for (model, value) in &raw {
            // Skip non-object entries (e.g. "sample_spec" key)
            let entry: LiteLLMEntry = match serde_json::from_value(value.clone()) {
                Ok(e) => e,
                Err(_) => continue,
            };

            let input = match entry.input_cost_per_token {
                Some(v) if v > 0.0 => v * 1_000_000.0,
                _ => continue, // skip entries without input cost
            };
            let output = match entry.output_cost_per_token {
                Some(v) => v * 1_000_000.0,
                None => continue,
            };

            let provider = entry
                .litellm_provider
                .clone()
                .unwrap_or_else(|| "unknown".to_string());

            prices.insert(
                model.clone(),
                ModelPricing {
                    model: model.clone(),
                    provider,
                    input_cost_per_1m: input,
                    output_cost_per_1m: output,
                    cache_read_cost_per_1m: entry
                        .cache_read_input_token_cost
                        .map(|v| v * 1_000_000.0),
                    cache_write_cost_per_1m: entry
                        .cache_creation_input_token_cost
                        .map(|v| v * 1_000_000.0),
                    max_input_tokens: entry.max_input_tokens,
                },
            );
        }

        Ok(prices)
    }

    /// Load the disk cache into in-memory prices (called at startup).
    fn load_cache(&mut self) {
        if let Ok(content) = fs::read_to_string(&self.cache_path) {
            if let Ok(envelope) = serde_json::from_str::<PricingCacheFile>(&content) {
                for (model, pricing) in envelope.prices {
                    self.prices.entry(model).or_insert(pricing);
                }
            }
        }
    }

    /// Get pricing for a model.
    /// Order: in-memory → static map → prefix match → hardcoded fallback.
    pub fn get_price(&mut self, model: &str) -> Result<ModelPricing, String> {
        // 1. In-memory (includes previously loaded LiteLLM cache).
        //    If found but max_input_tokens is missing, patch it from the static map.
        if let Some(p) = self.prices.get(model) {
            if p.max_input_tokens.is_some() {
                return Ok(p.clone());
            }
            // Fall through to enrich with static_map context window info.
            let mut enriched = p.clone();
            if let Some(s) = self.static_map.get(model) {
                enriched.max_input_tokens = s.max_input_tokens;
            } else {
                for (known, s) in &self.static_map {
                    if model.starts_with(known.as_str()) || known.starts_with(model) {
                        enriched.max_input_tokens = s.max_input_tokens;
                        break;
                    }
                }
            }
            self.prices.insert(model.to_string(), enriched.clone());
            return Ok(enriched);
        }

        // 2. Static map
        if let Some(p) = self.static_map.get(model) {
            self.prices.insert(model.to_string(), p.clone());
            return Ok(p.clone());
        }

        // 3. Prefix / substring match (handles dated variants like claude-sonnet-4-6-20260101)
        for (known, pricing) in &self.static_map {
            if model.starts_with(known.as_str()) || known.starts_with(model) {
                let matched = ModelPricing {
                    model: model.to_string(),
                    ..pricing.clone()
                };
                self.prices.insert(model.to_string(), matched.clone());
                return Ok(matched);
            }
        }

        Err(format!("No pricing found for model: {}", model))
    }

    /// Calculate cost for a TokenEvent.
    pub fn calculate_cost(&mut self, event: &TokenEvent) -> f64 {
        match self.get_price(&event.model) {
            Ok(pricing) => {
                let mut cost = 0.0;
                cost += (event.input_tokens as f64 / 1_000_000.0) * pricing.input_cost_per_1m;
                cost += ((event.output_tokens + event.reasoning_tokens) as f64 / 1_000_000.0)
                    * pricing.output_cost_per_1m;
                if let Some(cr) = pricing.cache_read_cost_per_1m {
                    cost += (event.cache_read_tokens as f64 / 1_000_000.0) * cr;
                }
                if let Some(cw) = pricing.cache_write_cost_per_1m {
                    cost += (event.cache_write_tokens as f64 / 1_000_000.0) * cw;
                }
                cost
            }
            Err(_) => {
                // Generic fallback for completely unknown models (Sonnet-level estimate)
                let input = event.input_tokens as f64 / 1_000_000.0 * 3.0;
                let output =
                    (event.output_tokens + event.reasoning_tokens) as f64 / 1_000_000.0 * 15.0;
                let cr = event.cache_read_tokens as f64 / 1_000_000.0 * 0.3;
                let cw = event.cache_write_tokens as f64 / 1_000_000.0 * 3.75;
                input + output + cr + cw
            }
        }
    }
}
