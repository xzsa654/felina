use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use crate::tokens::types::TokenEvent;

/// Per-model pricing information.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModelPricing {
    pub model: String,
    pub provider: String,
    pub input_cost_per_1m: f64,
    pub output_cost_per_1m: f64,
    pub cache_read_cost_per_1m: Option<f64>,
    pub cache_write_cost_per_1m: Option<f64>,
}

/// Static pricing map covering Claude, OpenAI, and Google models.
fn static_pricing_map() -> HashMap<String, ModelPricing> {
    let mut map = HashMap::new();

    // Anthropic Claude models (prices per 1M tokens in USD)
    let claude_models = vec![
        ("claude-opus-4-6", 15.0, 75.0, Some(1.5), Some(18.75)),
        (
            "claude-opus-4-5-20251101",
            15.0,
            75.0,
            Some(1.5),
            Some(18.75),
        ),
        ("claude-sonnet-4-6", 3.0, 15.0, Some(0.3), Some(3.75)),
        (
            "claude-sonnet-4-5-20250929",
            3.0,
            15.0,
            Some(0.3),
            Some(3.75),
        ),
        ("claude-haiku-3-5", 1.0, 5.0, Some(0.1), Some(1.25)),
        ("claude-opus-4-20250514", 15.0, 75.0, Some(1.5), Some(18.75)),
        ("claude-sonnet-4-20250514", 3.0, 15.0, Some(0.3), Some(3.75)),
        (
            "claude-3-5-sonnet-20241022",
            3.0,
            15.0,
            Some(0.3),
            Some(3.75),
        ),
        ("claude-3-5-haiku-20241022", 1.0, 5.0, Some(0.1), Some(1.25)),
    ];

    for (model, input, output, cache_read, cache_write) in claude_models {
        map.insert(
            model.to_string(),
            ModelPricing {
                model: model.to_string(),
                provider: "anthropic".to_string(),
                input_cost_per_1m: input,
                output_cost_per_1m: output,
                cache_read_cost_per_1m: cache_read,
                cache_write_cost_per_1m: cache_write,
            },
        );
    }

    // OpenAI models
    let openai_models = vec![
        ("gpt-4o", 2.5, 10.0, None, None),
        ("gpt-4o-mini", 0.15, 0.6, None, None),
        ("gpt-4.1", 2.0, 8.0, None, None),
        ("gpt-4.1-mini", 0.4, 1.6, None, None),
        ("gpt-4-turbo", 10.0, 30.0, None, None),
        ("o3", 10.0, 40.0, None, None),
        ("o4-mini", 1.1, 4.4, None, None),
    ];

    for (model, input, output, cache_read, cache_write) in openai_models {
        map.insert(
            model.to_string(),
            ModelPricing {
                model: model.to_string(),
                provider: "openai".to_string(),
                input_cost_per_1m: input,
                output_cost_per_1m: output,
                cache_read_cost_per_1m: cache_read,
                cache_write_cost_per_1m: cache_write,
            },
        );
    }

    // Google Gemini models
    let google_models = vec![
        ("gemini-2.5-pro", 2.5, 10.0, None, None),
        ("gemini-2.5-flash", 0.15, 0.6, None, None),
        ("gemini-2.0-flash", 0.15, 0.6, None, None),
    ];

    for (model, input, output, cache_read, cache_write) in google_models {
        map.insert(
            model.to_string(),
            ModelPricing {
                model: model.to_string(),
                provider: "google".to_string(),
                input_cost_per_1m: input,
                output_cost_per_1m: output,
                cache_read_cost_per_1m: cache_read,
                cache_write_cost_per_1m: cache_write,
            },
        );
    }

    map
}

/// Pricing service with LiteLLM HTTP fetch + disk cache + static fallback.
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

        // Load disk cache on startup
        service.load_cache();
        service
    }

    fn cache_dir(&self) -> PathBuf {
        self.cache_path
            .parent()
            .unwrap_or(&PathBuf::from("/tmp"))
            .to_path_buf()
    }

    /// Get pricing for a model. Order: memory → disk cache → LiteLLM → static fallback.
    pub fn get_price(&mut self, model: &str) -> Result<ModelPricing, String> {
        // 1. Check in-memory cache
        if let Some(p) = self.prices.get(model) {
            return Ok(p.clone());
        }

        // 2. Try static map (fastest, no network needed)
        if let Some(p) = self.static_map.get(model) {
            self.prices.insert(model.to_string(), p.clone());
            return Ok(p.clone());
        }

        // 3. Try partial match (model name starts with known prefix)
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
                // Fallback estimate for unknown models. Keep cache/reasoning
                // visible so cache-heavy tokscale rows are not priced near zero.
                let input_cost = event.input_tokens as f64 / 1_000_000.0 * 3.0;
                let output_cost =
                    (event.output_tokens + event.reasoning_tokens) as f64 / 1_000_000.0 * 15.0;
                let cache_read_cost = event.cache_read_tokens as f64 / 1_000_000.0 * 0.3;
                let cache_write_cost = event.cache_write_tokens as f64 / 1_000_000.0 * 3.75;
                input_cost + output_cost + cache_read_cost + cache_write_cost
            }
        }
    }

    /// Try to fetch fresh pricing from LiteLLM (best-effort, async in real usage).
    pub fn try_fetch_litellm(&mut self) {
        // In the Tauri context, we can't easily do async here.
        // The disk cache is loaded on startup. In a future version,
        // this could spawn a tokio task for async HTTP fetch.
        //
        // For now, the static map provides comprehensive coverage for
        // all major models from Claude, OpenAI, and Google.
    }

    fn load_cache(&mut self) {
        if let Ok(content) = fs::read_to_string(&self.cache_path) {
            if let Ok(cached_prices) =
                serde_json::from_str::<HashMap<String, ModelPricing>>(&content)
            {
                for (model, pricing) in cached_prices {
                    self.prices.entry(model).or_insert(pricing);
                }
            }
        }
    }

    #[allow(dead_code)]
    fn save_cache(&self) {
        if let Ok(json) = serde_json::to_string(&self.prices) {
            let _ = fs::create_dir_all(self.cache_dir());
            let _ = fs::write(&self.cache_path, json);
        }
    }
}
