// Compatibility exports for existing adapter tests and private developer tools.
// App features use services.js instead of depending on a provider implementation.
export {
  SupabaseClient as CloudClient,
  validateConfig,
} from './providers/supabase.js?v=b2e9b49cec79';
export { CloudError } from './errors.js?v=b2e9b49cec79';
export { takeSignInReturn } from './sign-in-return.js?v=b2e9b49cec79';
