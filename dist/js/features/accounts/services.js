import { createSupabaseServices } from './providers/supabase.js?v=acdad351dbea';
import { validateAccountServices } from './service-contract.js?v=acdad351dbea';

// Add explicitly registered adapters; never import code from a configured URL.
const PROVIDERS = Object.freeze({ supabase: createSupabaseServices });
export function createAccountServices(config, options = {}, providers = PROVIDERS) {
  const provider = config.provider ?? 'supabase'; // Preserve older public configs.
  if (
    typeof provider !== 'string' ||
    !Object.hasOwn(providers, provider) ||
    typeof providers[provider] !== 'function'
  )
    throw new Error('This account provider is not supported. You can continue on this device.');
  const services = validateAccountServices(providers[provider](config, options));
  return Object.freeze({
    provider,
    auth: Object.freeze(services.auth),
    notes: Object.freeze(services.notes),
    preferences: Object.freeze(services.preferences),
  });
}
