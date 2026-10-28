// Compatibility exports for existing adapter tests and private developer tools.
// App features use services.js instead of depending on a provider implementation.
export {
  SupabaseClient as CloudClient,
  validateConfig,
} from './providers/supabase.js?v=11da2bfc29ac';
export { CloudError } from './errors.js?v=11da2bfc29ac';
export { takeSignInReturn } from './sign-in-return.js?v=11da2bfc29ac';
